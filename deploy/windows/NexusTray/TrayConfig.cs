using System.Text.Json;
using System.Text.Json.Serialization;

namespace NexusTray;

/// <summary>
/// Configuração da bandeja lida de <c>tray.json</c> ao lado do executável.
/// O bootstrap grava o arquivo com os caminhos reais da instalação; quando ele
/// não existe (ou está inválido), os fallbacks abaixo mantêm a bandeja funcional.
/// Nenhum segredo é lido nem gravado.
/// </summary>
internal sealed class TrayConfig
{
    private const string DefaultBaseUrl = "https://localhost";
    private const string DefaultHealthUrl = "http://127.0.0.1:3000/api/health";
    private const string DefaultServiceName = "NexusApp";
    private const string DefaultNssmPath = @"C:\Program Files\Nexus\tools\nssm\nssm.exe";
    private const string DefaultLogsDir = @"C:\ProgramData\Nexus\logs";
    private const string DefaultDataDir = @"C:\ProgramData\Nexus";
    private const string DefaultBackupScript = @"C:\ProgramData\Nexus\scripts\backup.ps1";

    public string BaseUrl { get; init; } = DefaultBaseUrl;

    public string HealthUrl { get; init; } = DefaultHealthUrl;

    public string ServiceName { get; init; } = DefaultServiceName;

    public string NssmPath { get; init; } = DefaultNssmPath;

    public string LogsDir { get; init; } = DefaultLogsDir;

    public string DataDir { get; init; } = DefaultDataDir;

    public string BackupScript { get; init; } = DefaultBackupScript;

    public static TrayConfig Load()
    {
        TrayConfig defaults = new();
        string path = Path.Combine(AppContext.BaseDirectory, "tray.json");

        try
        {
            if (!File.Exists(path))
            {
                return defaults;
            }

            TrayConfigFile? file = JsonSerializer.Deserialize<TrayConfigFile>(File.ReadAllText(path));
            if (file is null)
            {
                return defaults;
            }

            return new TrayConfig
            {
                BaseUrl = Pick(file.BaseUrl, defaults.BaseUrl).TrimEnd('/'),
                HealthUrl = Pick(file.HealthUrl, defaults.HealthUrl),
                ServiceName = Pick(file.ServiceName, defaults.ServiceName),
                NssmPath = Pick(file.NssmPath, defaults.NssmPath),
                LogsDir = Pick(file.LogsDir, defaults.LogsDir),
                DataDir = Pick(file.DataDir, defaults.DataDir),
                BackupScript = Pick(file.BackupScript, defaults.BackupScript)
            };
        }
        catch (Exception)
        {
            return defaults;
        }
    }

    private static string Pick(string? value, string fallback)
    {
        return string.IsNullOrWhiteSpace(value) ? fallback : value.Trim();
    }

    private sealed class TrayConfigFile
    {
        [JsonPropertyName("baseUrl")]
        public string? BaseUrl { get; set; }

        [JsonPropertyName("healthUrl")]
        public string? HealthUrl { get; set; }

        [JsonPropertyName("serviceName")]
        public string? ServiceName { get; set; }

        [JsonPropertyName("nssmPath")]
        public string? NssmPath { get; set; }

        [JsonPropertyName("logsDir")]
        public string? LogsDir { get; set; }

        [JsonPropertyName("dataDir")]
        public string? DataDir { get; set; }

        [JsonPropertyName("backupScript")]
        public string? BackupScript { get; set; }
    }
}
