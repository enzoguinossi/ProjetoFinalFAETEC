using System.Text.RegularExpressions;

namespace NexusAgent;

public sealed record BackupFile(string Name, long Size, DateTimeOffset ModifiedAt, bool HasUploads);

/// <summary>
/// Manifesto de backups: lista e valida os nomes em <c>backups\db</c>.
/// O nome é sempre confrontado com o padrão e com o caminho resolvido, o que
/// impede traversal. Cada dump informa se existe o snapshot de uploads
/// correspondente em <c>backups\uploads\&lt;timestamp&gt;</c>.
/// </summary>
public sealed class ManifestStore
{
    private static readonly Regex NamePattern = new(
        @"^nexus_prod-(\d{8}-\d{6})\.(zip|sql)$",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant | RegexOptions.Compiled);

    private readonly AgentOptions _options;

    public ManifestStore(AgentOptions options)
    {
        _options = options;
    }

    public IReadOnlyList<BackupFile> List()
    {
        string dir = _options.DbBackupsDir;
        if (!Directory.Exists(dir))
        {
            return Array.Empty<BackupFile>();
        }

        return Directory.EnumerateFiles(dir)
            .Where(path => NamePattern.IsMatch(Path.GetFileName(path)))
            // Backup interrompido: o backup.ps1 deixa <arquivo>.incomplete ao
            // lado do dump e só o remove no sucesso final.
            .Where(path => !File.Exists(path + ".incomplete"))
            .Select(path => new FileInfo(path))
            .OrderByDescending(info => info.LastWriteTimeUtc)
            .Select(info => new BackupFile(
                info.Name,
                info.Length,
                new DateTimeOffset(info.LastWriteTimeUtc, TimeSpan.Zero),
                HasUploadsSnapshot(info.Name)))
            .ToList();
    }

    public bool TryResolve(string? fileName, out string path, out string error)
    {
        path = "";
        error = "";

        if (string.IsNullOrWhiteSpace(fileName) || !NamePattern.IsMatch(fileName))
        {
            error = "fileName inválido; use o nome exibido em /v1/backups.";
            return false;
        }

        string fullDir = Path.GetFullPath(_options.DbBackupsDir);
        string candidate = Path.GetFullPath(Path.Combine(fullDir, fileName));
        if (!candidate.StartsWith(fullDir + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            error = "fileName inválido.";
            return false;
        }

        if (!File.Exists(candidate))
        {
            error = "Backup não encontrado em backups\\db.";
            return false;
        }

        // O manifesto não lista artefatos incompletos; recusa também por nome,
        // para um pedido explícito não restaurar um dump parcial.
        if (File.Exists(candidate + ".incomplete"))
        {
            error = "O backup está incompleto (marcador .incomplete); refaça o backup.";
            return false;
        }

        path = candidate;
        return true;
    }

    /// <summary>
    /// Resolve o diretório do snapshot de uploads do dump. Devolve <c>false</c>
    /// quando o snapshot não existe (backup antigo ou criado com -SkipUploads).
    /// </summary>
    public bool TryResolveUploadsSnapshot(string? fileName, out string path, out string error)
    {
        path = "";
        error = "";

        string? timestamp = TimestampFromName(fileName);
        if (timestamp == null)
        {
            error = "fileName inválido; use o nome exibido em /v1/backups.";
            return false;
        }

        string fullRoot = Path.GetFullPath(_options.UploadsBackupsRoot);
        string candidate = Path.GetFullPath(Path.Combine(fullRoot, timestamp));
        if (!candidate.StartsWith(fullRoot + Path.DirectorySeparatorChar, StringComparison.OrdinalIgnoreCase))
        {
            error = "fileName inválido.";
            return false;
        }

        if (!Directory.Exists(candidate))
        {
            error =
                $"O backup {fileName} não tem snapshot de uploads em backups\\uploads\\{timestamp}. " +
                "Restaure sem uploads ou escolha um backup que os inclua.";
            return false;
        }

        path = candidate;
        return true;
    }

    /// <summary>Timestamp (yyyyMMdd-HHmmss) embutido no nome do dump, ou <c>null</c>.</summary>
    public static string? TimestampFromName(string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName))
        {
            return null;
        }

        Match match = NamePattern.Match(fileName);
        return match.Success ? match.Groups[1].Value : null;
    }

    private bool HasUploadsSnapshot(string fileName)
    {
        string? timestamp = TimestampFromName(fileName);
        return timestamp != null && Directory.Exists(_options.UploadsSnapshotDir(timestamp));
    }
}
