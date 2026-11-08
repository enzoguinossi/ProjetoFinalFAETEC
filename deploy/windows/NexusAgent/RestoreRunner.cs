using System.Diagnostics;
using System.IO.Compression;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace NexusAgent;

public sealed record RestoreOutcome(bool Success, string? Error, string? LogPath);

public sealed class RestoreException : Exception
{
    public RestoreException(string message) : base(message)
    {
    }
}

/// <summary>
/// Restaura um backup do manifesto: cópia de trabalho + validação do dump,
/// backup de segurança obrigatório (sem retenção), parada somente do
/// <c>NexusApp</c> (o Caddy continua servindo o progresso), carga do dump via
/// <c>mysql.exe</c> com rollback do backup de segurança em caso de falha,
/// uploads do snapshot do próprio backup e validação do health.
/// </summary>
public sealed class RestoreRunner
{
    private static readonly Encoding Utf8NoBom = new UTF8Encoding(encoderShouldEmitUTF8Identifier: false);
    private static readonly Regex CredentialLine = new(
        @"(?im)^.*(password|identified\s+by|senha).*$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);
    private static readonly TimeSpan ServiceTimeout = TimeSpan.FromSeconds(60);
    private static readonly TimeSpan HealthTimeout = TimeSpan.FromSeconds(180);

    private readonly AgentOptions _options;
    private readonly BackupRunner _backup;
    private readonly ILogger<RestoreRunner> _logger;

    public RestoreRunner(AgentOptions options, BackupRunner backup, ILogger<RestoreRunner> logger)
    {
        _options = options;
        _backup = backup;
        _logger = logger;
    }

    public async Task<RestoreOutcome> RunAsync(
        Action<int, string, string> report,
        string jobId,
        string fileName,
        string filePath,
        bool includeUploads,
        int retentionDays,
        CancellationToken ct)
    {
        RestoreLog log = new(_options);
        string? workCopy = null;
        string? uploadsSnapshot = null;
        bool appStopped = false;
        bool appStarted = false;
        bool success = false;
        string? error = null;
        // O restore não deve ligar um Caddy que o operador deixou parado.
        bool caddyWasRunning =
            ServiceControl.GetStatus(AgentOptions.CaddyServiceName) == "Running";

        try
        {
            report(5, "Pre-checagem", $"Preparando a restauração de {fileName}");
            log.Write($"Restauração solicitada: {fileName} (uploads={includeUploads})");

            EnsureTools();

            // B5: o arquivo escolhido é copiado antes do backup de segurança, que
            // roda com -NoRetention e não pode apagá-lo. A cópia é a fonte do restore.
            report(8, "Pre-checagem", "Copiando o arquivo de backup para a área temporária");
            workCopy = CopyToTmp(filePath, jobId, log);

            // A3: valida o dump antes de qualquer operação destrutiva.
            ValidateDump(workCopy);
            log.Write("Arquivo de backup validado (sql legível e não vazio).");

            // B4: uploads vêm do snapshot do backup escolhido, não do último backup.
            if (includeUploads)
            {
                if (!TryResolveUploads(fileName, out uploadsSnapshot, out string uploadsError))
                {
                    throw new RestoreException(uploadsError);
                }
                log.Write($"Snapshot de uploads: {uploadsSnapshot}");
            }

            if (ct.IsCancellationRequested)
            {
                throw new OperationCanceledException(ct);
            }

            report(15, "Backup de seguranca", "Gerando backup de segurança antes de restaurar");
            log.Write("Iniciando backup de segurança obrigatório (sem retenção).");
            BackupOutcome safety = await _backup.RunAsync(
                (percent, _, message) => report(
                    15 + (int)Math.Round(percent * 0.14),
                    "Backup de seguranca",
                    message),
                retentionDays,
                includeUploads: true,
                ct,
                noRetention: true);
            log.Write($"Backup de segurança: {(safety.Success ? "OK" : "FALHOU")} ({(safety.LogPath ?? "sem log")})");
            if (!safety.Success)
            {
                throw new RestoreException(
                    "O backup de segurança falhou; a restauração foi cancelada. " +
                    (safety.Error ?? ""));
            }
            log.Write($"Arquivo de rollback: {safety.DbFile ?? "não localizado"}");

            // B5: revalida a cópia imediatamente antes de parar a aplicação.
            ValidateDump(workCopy);

            report(30, "Parando aplicacao", "Parando o serviço NexusApp");
            log.Write("Parando o serviço NexusApp.");
            // Marca antes da parada: se o Stop falhar no meio, o finally ainda
            // tenta religar a aplicação.
            appStopped = true;
            ServiceControl.Stop(AgentOptions.AppServiceName, ServiceTimeout);
            log.Write("Serviço NexusApp parado.");

            report(50, "Restaurando banco", "Restaurando o banco nexus_prod");
            log.Write("Restaurando o banco nexus_prod.");
            try
            {
                await RestoreDatabaseAsync(workCopy, log, ct);
                log.Write("Banco restaurado.");
            }
            catch (OperationCanceledException)
            {
                // Desligamento do serviço: não há tempo útil para rollback.
                throw;
            }
            catch (Exception databaseError)
            {
                // A3: rollback automático pelo backup de segurança antes de religar o app.
                string detail = await RollbackAsync(safety.DbFile, log);
                throw new RestoreException(
                    detail.Length == 0
                        ? $"{databaseError.Message} O backup de segurança foi restaurado automaticamente."
                        : $"CRÍTICO: {databaseError.Message} O rollback pelo backup de segurança também " +
                          $"falhou ({detail}); o banco pode estar inconsistente. Verifique o log.");
            }

            if (includeUploads)
            {
                report(70, "Restaurando uploads", "Sincronizando a pasta de uploads do backup");
                log.Write("Restaurando uploads com robocopy /MIR.");
                await RestoreUploadsAsync(uploadsSnapshot!, log, ct);
                log.Write("Uploads restaurados.");
            }
            else
            {
                report(70, "Restaurando uploads", "Uploads mantidos (não incluídos neste restore)");
                log.Write("Uploads não restaurados (includeUploads=false).");
            }

            report(85, "Iniciando aplicacao", "Iniciando o serviço NexusApp");
            log.Write("Iniciando o serviço NexusApp.");
            ServiceControl.Start(AgentOptions.AppServiceName, TimeSpan.FromSeconds(120));
            appStarted = true;
            log.Write("Serviço NexusApp em execução.");

            report(100, "Validando health", "Aguardando o health do NexusApp (db=true)");
            await WaitForHealthAsync(log, ct);

            log.Write("Restauração concluída com sucesso.");
            success = true;
        }
        catch (Exception ex)
        {
            error = ex is RestoreException or OperationCanceledException
                ? ex.Message
                : "Falha inesperada na restauração: " + ex.Message;
            log.Write("ERRO: " + error);

            if (ex is not OperationCanceledException)
            {
                _logger.LogError(ex, "Restauração falhou.");
            }
        }
        finally
        {
            // A2: o app sempre volta, mesmo em falha ou cancelamento.
            if (appStopped && !appStarted)
            {
                if (ServiceControl.TryStart(AgentOptions.AppServiceName, TimeSpan.FromSeconds(120)))
                {
                    log.Write("Serviço NexusApp religado após a restauração.");
                }
                else
                {
                    const string note = "O NexusApp não foi religado após a restauração.";
                    log.Write(note);
                    error = error == null ? note : error + " " + note;
                }
            }

            // B2/B3: se o Caddy já estava no ar, ele serve a página de progresso
            // e não pode terminar parado. Se estava parado de propósito, mantém.
            if (caddyWasRunning)
            {
                if (ServiceControl.TryStart(AgentOptions.CaddyServiceName, TimeSpan.FromSeconds(60)))
                {
                    log.Write("NexusCaddy em execução.");
                }
                else
                {
                    const string note = "O NexusCaddy não está em execução; a página /progresso/ ficou indisponível.";
                    log.Write(note);
                    error = error == null ? note : error + " " + note;
                }
            }
            else
            {
                log.Write("NexusCaddy já estava parado antes da restauração; mantido parado.");
            }

            if (workCopy != null)
            {
                try
                {
                    if (File.Exists(workCopy))
                    {
                        File.Delete(workCopy);
                        log.Write("Cópia de trabalho removida.");
                    }
                }
                catch
                {
                    log.Write("Não foi possível remover a cópia de trabalho.");
                }
            }

            log.Dispose();
        }

        if (error != null)
        {
            success = false;
        }

        return new RestoreOutcome(success, error, log.Path);
    }

    private void EnsureTools()
    {
        if (!File.Exists(_options.MysqlExe))
        {
            throw new RestoreException($"mysql.exe não encontrado em {_options.MysqlExe}.");
        }

        if (!File.Exists(_options.BackupCnf))
        {
            throw new RestoreException($"Arquivo de credenciais não encontrado: {_options.BackupCnf}.");
        }
    }

    /// <summary>Copia o backup escolhido para <c>agent\tmp</c> antes do backup de segurança.</summary>
    private string CopyToTmp(string filePath, string jobId, RestoreLog log)
    {
        Directory.CreateDirectory(_options.TmpDir);
        string safeId = new(jobId.Where(ch => char.IsLetterOrDigit(ch) || ch == '-').ToArray());
        if (safeId.Length == 0)
        {
            safeId = DateTime.Now.ToString("yyyyMMdd-HHmmss");
        }

        string target = Path.Combine(_options.TmpDir, $"restore-{safeId}{Path.GetExtension(filePath)}");
        if (File.Exists(target))
        {
            File.Delete(target);
        }

        File.Copy(filePath, target, overwrite: true);
        log.Write($"Cópia de trabalho: {target}");
        return target;
    }

    /// <summary>
    /// A3: valida o dump antes de parar o app — <c>.zip</c> com um <c>.sql</c>
    /// legível e não vazio, ou <c>.sql</c> não vazio.
    /// </summary>
    internal static void ValidateDump(string path)
    {
        if (!File.Exists(path))
        {
            throw new RestoreException("O arquivo de backup não existe.");
        }

        if (path.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                using ZipArchive archive = ZipFile.OpenRead(path);
                ZipArchiveEntry? entry = archive.Entries.FirstOrDefault(item =>
                    item.Name.EndsWith(".sql", StringComparison.OrdinalIgnoreCase));
                if (entry == null)
                {
                    throw new RestoreException("O .zip não contém um arquivo .sql.");
                }

                if (entry.Length <= 0)
                {
                    throw new RestoreException("O arquivo .sql dentro do .zip está vazio.");
                }

                using Stream stream = entry.Open();
                byte[] buffer = new byte[4096];
                if (stream.Read(buffer, 0, buffer.Length) <= 0)
                {
                    throw new RestoreException("O arquivo .sql dentro do .zip está vazio.");
                }
            }
            catch (RestoreException)
            {
                throw;
            }
            catch (Exception ex)
            {
                throw new RestoreException(
                    $"O arquivo .zip do backup não pôde ser lido: {ex.Message}");
            }

            return;
        }

        if (!path.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
        {
            throw new RestoreException("O backup precisa ser um arquivo .zip ou .sql.");
        }

        FileInfo info = new(path);
        if (info.Length <= 0)
        {
            throw new RestoreException("O arquivo .sql do backup está vazio.");
        }

        try
        {
            using FileStream stream = File.OpenRead(path);
            byte[] buffer = new byte[4096];
            if (stream.Read(buffer, 0, buffer.Length) <= 0)
            {
                throw new RestoreException("O arquivo .sql do backup está vazio.");
            }
        }
        catch (RestoreException)
        {
            throw;
        }
        catch (Exception ex)
        {
            throw new RestoreException($"O arquivo .sql do backup não pôde ser lido: {ex.Message}");
        }
    }

    private bool TryResolveUploads(string fileName, out string path, out string error)
    {
        string? timestamp = ManifestStore.TimestampFromName(fileName);
        if (timestamp == null)
        {
            path = "";
            error = "fileName inválido; use o nome exibido em /v1/backups.";
            return false;
        }

        string candidate = _options.UploadsSnapshotDir(timestamp);
        if (!Directory.Exists(candidate))
        {
            path = "";
            error =
                $"O backup {fileName} não tem snapshot de uploads em " +
                $"backups\\uploads\\{timestamp}. Restaure sem uploads ou escolha um backup que os inclua.";
            return false;
        }

        path = candidate;
        error = "";
        return true;
    }

    /// <summary>
    /// Rollback do banco pelo arquivo do backup de segurança. Devolve vazio no
    /// sucesso ou a mensagem de erro (sem credenciais).
    /// </summary>
    private async Task<string> RollbackAsync(string? safetyDb, RestoreLog log)
    {
        if (string.IsNullOrWhiteSpace(safetyDb) || !File.Exists(safetyDb))
        {
            log.Write("Rollback impossível: o arquivo do backup de segurança não foi localizado.");
            return "o arquivo do backup de segurança não foi localizado";
        }

        try
        {
            log.Write($"Rollback: restaurando o backup de segurança {safetyDb}.");
            await RestoreDatabaseAsync(safetyDb, log, CancellationToken.None);
            log.Write("Rollback concluído; o banco voltou ao estado anterior.");
            return "";
        }
        catch (Exception ex)
        {
            log.Write("ERRO no rollback: " + ex.Message);
            _logger.LogError(ex, "O rollback pelo backup de segurança falhou.");
            return Sanitize(ex.Message);
        }
    }

    private async Task RestoreDatabaseAsync(string filePath, RestoreLog log, CancellationToken ct)
    {
        var psi = new ProcessStartInfo
        {
            FileName = _options.MysqlExe,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardInput = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardErrorEncoding = Encoding.UTF8,
        };
        // --defaults-extra-file precisa ser o primeiro argumento.
        psi.ArgumentList.Add($"--defaults-extra-file={_options.BackupCnf}");
        psi.ArgumentList.Add("--default-character-set=utf8mb4");
        psi.ArgumentList.Add("nexus_prod");

        using Process mysql = new() { StartInfo = psi };
        if (!mysql.Start())
        {
            throw new RestoreException("Não foi possível iniciar o mysql.exe.");
        }

        var errors = new Queue<string>();
        Task stderrTask = Task.Run(async () =>
        {
            string? line;
            while ((line = await mysql.StandardError.ReadLineAsync(ct)) != null)
            {
                string trimmed = line.Trim();
                if (trimmed.Length == 0)
                {
                    continue;
                }
                errors.Enqueue(trimmed);
                while (errors.Count > 20)
                {
                    errors.Dequeue();
                }
            }
        }, ct);

        Task stdoutTask = Task.Run(async () =>
        {
            // O dump não produz saída normal; drenar evita travar o processo.
            while (await mysql.StandardOutput.ReadLineAsync(ct) != null)
            {
            }
        }, ct);

        try
        {
            StreamWriter writer = new(mysql.StandardInput.BaseStream, Utf8NoBom)
            {
                NewLine = "\n",
                AutoFlush = false,
            };

            int written = 0;
            try
            {
                await foreach (string line in ReadDumpLinesAsync(filePath, ct))
                {
                    await writer.WriteLineAsync(line);
                    written++;
                    if (written % 1000 == 0)
                    {
                        await writer.FlushAsync(ct);
                    }
                }

                await writer.FlushAsync(ct);
            }
            finally
            {
                // Fechar o stdin sinaliza o fim do dump para o mysql.
                await writer.DisposeAsync();
            }

            log.Write($"Dump enviado ao mysql ({written} linhas).");

            await mysql.WaitForExitAsync(ct);
            await stderrTask;
            await stdoutTask;
        }
        catch (Exception)
        {
            try
            {
                if (!mysql.HasExited)
                {
                    mysql.Kill(entireProcessTree: true);
                }
            }
            catch
            {
                // O processo já pode ter terminado.
            }
            throw;
        }

        if (mysql.ExitCode != 0)
        {
            string detail = Sanitize(string.Join(" | ", errors.TakeLast(4)));
            throw new RestoreException(
                detail.Length > 0
                    ? $"mysql.exe falhou (código {mysql.ExitCode}): {detail}"
                    : $"mysql.exe falhou (código {mysql.ExitCode}).");
        }
    }

    private static async IAsyncEnumerable<string> ReadDumpLinesAsync(
        string filePath,
        [System.Runtime.CompilerServices.EnumeratorCancellation] CancellationToken ct)
    {
        if (filePath.EndsWith(".zip", StringComparison.OrdinalIgnoreCase))
        {
            using ZipArchive archive = ZipFile.OpenRead(filePath);
            ZipArchiveEntry? entry = archive.Entries.FirstOrDefault(item =>
                item.Name.EndsWith(".sql", StringComparison.OrdinalIgnoreCase));
            if (entry == null)
            {
                throw new RestoreException("O .zip não contém um arquivo .sql.");
            }

            using Stream zipStream = entry.Open();
            using var zipReader = new StreamReader(zipStream, Utf8NoBom, detectEncodingFromByteOrderMarks: true);
            string? line;
            while ((line = await zipReader.ReadLineAsync(ct)) != null)
            {
                if (KeepLine(line))
                {
                    yield return line;
                }
            }
            yield break;
        }

        using var reader = new StreamReader(
            File.OpenRead(filePath),
            Utf8NoBom,
            detectEncodingFromByteOrderMarks: true);
        string? sqlLine;
        while ((sqlLine = await reader.ReadLineAsync(ct)) != null)
        {
            if (KeepLine(sqlLine))
            {
                yield return sqlLine;
            }
        }
    }

    /// <summary>
    /// Descarta CREATE DATABASE/USE: o nexus_app tem privilégios apenas em
    /// nexus_prod.* e não pode criar bancos no servidor.
    /// </summary>
    private static bool KeepLine(string line)
    {
        string trimmed = line.TrimStart();
        if (trimmed.StartsWith("CREATE DATABASE", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        if (trimmed.StartsWith("USE ", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }
        return true;
    }

    private async Task RestoreUploadsAsync(string snapshotDir, RestoreLog log, CancellationToken ct)
    {
        if (!Directory.Exists(snapshotDir))
        {
            throw new RestoreException($"A cópia de uploads não existe em {snapshotDir}.");
        }

        Directory.CreateDirectory(_options.UploadsDir);
        string robocopy = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.System),
            "robocopy.exe");
        var psi = new ProcessStartInfo
        {
            FileName = robocopy,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
        };
        foreach (string arg in new[]
                 {
                     snapshotDir,
                     _options.UploadsDir,
                     "/MIR", "/COPY:DAT", "/R:2", "/W:2",
                     "/NP", "/NFL", "/NDL", "/NJH", "/NJS",
                 })
        {
            psi.ArgumentList.Add(arg);
        }

        using Process process = new() { StartInfo = psi };
        if (!process.Start())
        {
            throw new RestoreException("Não foi possível iniciar o robocopy.");
        }

        // Drenar stdout e stderr ao mesmo tempo evita bloquear o processo
        // quando um dos buffers enche.
        Task stdoutTask = process.StandardOutput.ReadToEndAsync(ct);
        Task<string> stderrTask = process.StandardError.ReadToEndAsync(ct);
        try
        {
            await process.WaitForExitAsync(ct);
            await stdoutTask;
        }
        catch
        {
            KillTree(process);
            throw;
        }
        string stderr = await stderrTask;

        log.Write($"robocopy terminou com código {process.ExitCode}.");
        if (process.ExitCode >= 8)
        {
            string detail = Sanitize(string.Join(" | ", stderr
                .Split('\n', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .TakeLast(4)));
            throw new RestoreException(detail.Length > 0
                ? $"robocopy falhou (código {process.ExitCode}) ao restaurar uploads: {detail}"
                : $"robocopy falhou (código {process.ExitCode}) ao restaurar uploads.");
        }
    }

    private async Task WaitForHealthAsync(RestoreLog log, CancellationToken ct)
    {
        using HttpClient client = new() { Timeout = TimeSpan.FromSeconds(10) };
        DateTimeOffset deadline = DateTimeOffset.UtcNow.Add(HealthTimeout);
        string last = "sem resposta";

        while (DateTimeOffset.UtcNow < deadline)
        {
            try
            {
                using HttpResponseMessage response = await client.GetAsync(_options.AppHealthUrl, ct);
                if (response.IsSuccessStatusCode)
                {
                    string json = await response.Content.ReadAsStringAsync(ct);
                    using JsonDocument document = JsonDocument.Parse(json);
                    if (document.RootElement.TryGetProperty("db", out JsonElement db) &&
                        db.ValueKind == JsonValueKind.True)
                    {
                        log.Write("Health local OK (db=true).");
                        return;
                    }
                    last = "db=false";
                }
                else
                {
                    last = $"HTTP {(int)response.StatusCode}";
                }
            }
            catch (OperationCanceledException) when (!ct.IsCancellationRequested)
            {
                last = "timeout";
            }
            catch (Exception ex)
            {
                last = ex.Message;
            }

            await Task.Delay(TimeSpan.FromSeconds(3), ct);
        }

        throw new RestoreException(
            $"O health do NexusApp não respondeu 200 com db=true em 180 s ({last}).");
    }

    /// <summary>Encerra o processo e os filhos (robocopy) ao cancelar/falhar.</summary>
    private static void KillTree(Process process)
    {
        try
        {
            if (!process.HasExited)
            {
                process.Kill(entireProcessTree: true);
                process.WaitForExit(5000);
            }
        }
        catch
        {
            // O processo já pode ter terminado.
        }
    }

    private static string Sanitize(string value)
    {
        string trimmed = value.Replace("|", "/").Trim();
        if (CredentialLine.IsMatch(trimmed))
        {
            return "[credencial omitida]";
        }
        return trimmed.Length > 400 ? trimmed[..400] : trimmed;
    }

    private sealed class RestoreLog : IDisposable
    {
        private readonly StreamWriter? _writer;

        public string Path { get; }

        public RestoreLog(AgentOptions options)
        {
            Path = System.IO.Path.Combine(
                options.LogsDir,
                $"restore-{DateTime.Now:yyyyMMdd-HHmmss}.log");
            try
            {
                Directory.CreateDirectory(options.LogsDir);
                _writer = new StreamWriter(Path, append: true, Utf8NoBom) { AutoFlush = true };
            }
            catch
            {
                _writer = null;
            }
        }

        public void Write(string message)
        {
            try
            {
                _writer?.WriteLine($"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {message}");
            }
            catch
            {
                // O log é auxiliar e não interrompe a operação.
            }
        }

        public void Dispose()
        {
            try
            {
                _writer?.Dispose();
            }
            catch
            {
                // Ignora falha ao fechar o log.
            }
        }
    }
}
