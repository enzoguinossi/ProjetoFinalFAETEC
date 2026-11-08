using System.Diagnostics;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;

namespace NexusAgent;

public sealed record BackupOutcome(bool Success, int ExitCode, string? Error, string? LogPath, string? DbFile = null);

/// <summary>
/// Executa <c>backup.ps1</c> com <c>-AgentProgress -RequireMysql</c> e traduz as
/// linhas <c>##PROGRESS|percent|etapa|mensagem</c> em atualizações do job.
/// </summary>
public sealed class BackupRunner
{
    private static readonly Regex CredentialLine = new(
        @"(?im)^.*(password|identified\s+by|senha).*$",
        RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private readonly AgentOptions _options;
    private readonly ILogger<BackupRunner> _logger;

    public BackupRunner(AgentOptions options, ILogger<BackupRunner> logger)
    {
        _options = options;
        _logger = logger;
    }

    public async Task<BackupOutcome> RunAsync(
        Action<int, string, string> report,
        int retentionDays,
        bool includeUploads,
        CancellationToken ct,
        bool noRetention = false)
    {
        if (!File.Exists(_options.BackupScript))
        {
            return new BackupOutcome(
                false,
                -1,
                $"Script de backup não encontrado: {_options.BackupScript}",
                null);
        }

        DateTimeOffset started = DateTimeOffset.Now;
        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            StandardOutputEncoding = ConsoleEncoding(),
            StandardErrorEncoding = ConsoleEncoding(),
        };
        psi.ArgumentList.Add("-NoProfile");
        psi.ArgumentList.Add("-ExecutionPolicy");
        psi.ArgumentList.Add("Bypass");
        psi.ArgumentList.Add("-File");
        psi.ArgumentList.Add(_options.BackupScript);
        psi.ArgumentList.Add("-RetentionDays");
        psi.ArgumentList.Add(retentionDays.ToString(CultureInfo.InvariantCulture));
        if (!includeUploads)
        {
            psi.ArgumentList.Add("-SkipUploads");
        }
        if (noRetention)
        {
            psi.ArgumentList.Add("-NoRetention");
        }
        psi.ArgumentList.Add("-AgentProgress");
        psi.ArgumentList.Add("-RequireMysql");

        var tail = new Queue<string>();
        Process? process = null;
        string? line;
        int exitCode;
        try
        {
            process = new Process { StartInfo = psi };
            if (!process.Start())
            {
                return new BackupOutcome(false, -1, "Não foi possível iniciar o backup.", null);
            }

            Task stderrTask = Task.Run(async () =>
            {
                string? errorLine;
                while ((errorLine = await process.StandardError.ReadLineAsync(ct)) != null)
                {
                    Remember(tail, errorLine);
                }
            }, ct);

            while ((line = await process.StandardOutput.ReadLineAsync(ct)) != null)
            {
                if (TryParseProgress(line, out int percent, out string step, out string message))
                {
                    report(percent, step, message);
                }
                else
                {
                    Remember(tail, line);
                }
            }

            await process.WaitForExitAsync(ct);
            await stderrTask;
            exitCode = process.ExitCode;
        }
        catch (OperationCanceledException)
        {
            KillTree(process);
            return new BackupOutcome(false, -1, "Backup cancelado.", FindLog(started));
        }
        catch (Exception ex)
        {
            KillTree(process);
            _logger.LogError(ex, "Falha ao executar o backup.");
            return new BackupOutcome(false, -1, "Falha ao executar o backup.", FindLog(started));
        }
        finally
        {
            process?.Dispose();
        }

        string? logPath = FindLog(started);
        if (exitCode != 0)
        {
            string detail = Sanitize(string.Join(" | ", tail.TakeLast(4)));
            string message = detail.Length > 0
                ? $"backup.ps1 falhou (código {exitCode}): {detail}"
                : $"backup.ps1 falhou (código {exitCode}).";
            return new BackupOutcome(false, exitCode, message, logPath);
        }

        return new BackupOutcome(true, exitCode, null, logPath, FindDbFile(started));
    }

    /// <summary>Encerra o script e os filhos (mysqldump/robocopy) ao cancelar.</summary>
    private static void KillTree(Process? process)
    {
        try
        {
            if (process != null && !process.HasExited)
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

    /// <summary>Dump gerado por esta execução (usado como rollback da restauração).</summary>
    private string? FindDbFile(DateTimeOffset started)
    {
        try
        {
            if (!Directory.Exists(_options.DbBackupsDir))
            {
                return null;
            }

            return Directory.EnumerateFiles(_options.DbBackupsDir)
                .Where(path =>
                    path.EndsWith(".zip", StringComparison.OrdinalIgnoreCase) ||
                    path.EndsWith(".sql", StringComparison.OrdinalIgnoreCase))
                .Select(path => new FileInfo(path))
                .Where(info => info.LastWriteTimeUtc >= started.UtcDateTime.AddMinutes(-1))
                .OrderByDescending(info => info.LastWriteTimeUtc)
                .Select(info => info.FullName)
                .FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }

    internal static bool TryParseProgress(string line, out int percent, out string step, out string message)
    {
        percent = 0;
        step = "";
        message = "";
        if (!line.StartsWith("##PROGRESS|", StringComparison.Ordinal))
        {
            return false;
        }

        string[] parts = line.Split('|', 4);
        if (parts.Length < 3 || !int.TryParse(parts[1], NumberStyles.Integer, CultureInfo.InvariantCulture, out percent))
        {
            return false;
        }

        percent = Math.Clamp(percent, 0, 100);
        step = parts[2].Trim();
        message = parts.Length > 3 ? Sanitize(parts[3]) : "";
        return step.Length > 0;
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

    private static void Remember(Queue<string> tail, string line)
    {
        string trimmed = line.Trim();
        if (trimmed.Length == 0)
        {
            return;
        }
        tail.Enqueue(trimmed);
        while (tail.Count > 20)
        {
            tail.Dequeue();
        }
    }

    private string? FindLog(DateTimeOffset started)
    {
        try
        {
            if (!Directory.Exists(_options.LogsDir))
            {
                return null;
            }

            return Directory.EnumerateFiles(_options.LogsDir, "backup-*.log")
                .Select(path => new FileInfo(path))
                .Where(info => info.LastWriteTimeUtc >= started.UtcDateTime.AddMinutes(-1))
                .OrderByDescending(info => info.LastWriteTimeUtc)
                .Select(info => info.FullName)
                .FirstOrDefault();
        }
        catch
        {
            return null;
        }
    }

    private static Encoding ConsoleEncoding()
    {
        try
        {
            Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
            return Encoding.GetEncoding(CultureInfo.CurrentCulture.TextInfo.OEMCodePage);
        }
        catch
        {
            return Encoding.UTF8;
        }
    }
}
