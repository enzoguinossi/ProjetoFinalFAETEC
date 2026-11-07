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
    private const string DefaultMysqlService = "NexusMySQL84";
    private const string DefaultCaddyService = "NexusCaddy";
    private const string DefaultNssmPath = @"C:\Program Files\Nexus\tools\nssm\nssm.exe";
    private const string DefaultLogsDir = @"C:\ProgramData\Nexus\logs";
    private const string DefaultDataDir = @"C:\ProgramData\Nexus";
    private const string DefaultBackupScript = @"C:\Program Files\Nexus\scripts\backup.ps1";
    private const string DefaultRestartScript = @"C:\Program Files\Nexus\scripts\restart.ps1";
    private const string DefaultStopScript = @"C:\Program Files\Nexus\scripts\encerrar-nexus.ps1";
    private const string DefaultStartScript = @"C:\Program Files\Nexus\scripts\iniciar-nexus.ps1";
    private const string DefaultStateFile = @"C:\ProgramData\Nexus\config\nexus-state.json";

    public string BaseUrl { get; init; } = DefaultBaseUrl;

    public string HealthUrl { get; init; } = DefaultHealthUrl;

    public string ServiceName { get; init; } = DefaultServiceName;

    public string MysqlService { get; init; } = DefaultMysqlService;

    public string CaddyService { get; init; } = DefaultCaddyService;

    public string NssmPath { get; init; } = DefaultNssmPath;

    public string LogsDir { get; init; } = DefaultLogsDir;

    public string DataDir { get; init; } = DefaultDataDir;

    public string BackupScript { get; init; } = DefaultBackupScript;

    public string RestartScript { get; init; } = DefaultRestartScript;

    public string StopScript { get; init; } = DefaultStopScript;

    public string StartScript { get; init; } = DefaultStartScript;

    public string StateFile { get; init; } = DefaultStateFile;

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
                MysqlService = Pick(file.MysqlService, defaults.MysqlService),
                CaddyService = Pick(file.CaddyService, defaults.CaddyService),
                NssmPath = Pick(file.NssmPath, defaults.NssmPath),
                LogsDir = Pick(file.LogsDir, defaults.LogsDir),
                DataDir = Pick(file.DataDir, defaults.DataDir),
                BackupScript = Pick(file.BackupScript, defaults.BackupScript),
                RestartScript = Pick(file.RestartScript, defaults.RestartScript),
                StopScript = Pick(file.StopScript, defaults.StopScript),
                StartScript = Pick(file.StartScript, defaults.StartScript),
                StateFile = Pick(file.StateFile, defaults.StateFile)
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

        [JsonPropertyName("mysqlService")]
        public string? MysqlService { get; set; }

        [JsonPropertyName("caddyService")]
        public string? CaddyService { get; set; }

        [JsonPropertyName("nssmPath")]
        public string? NssmPath { get; set; }

        [JsonPropertyName("logsDir")]
        public string? LogsDir { get; set; }

        [JsonPropertyName("dataDir")]
        public string? DataDir { get; set; }

        [JsonPropertyName("backupScript")]
        public string? BackupScript { get; set; }

        [JsonPropertyName("restartScript")]
        public string? RestartScript { get; set; }

        [JsonPropertyName("stopScript")]
        public string? StopScript { get; set; }

        [JsonPropertyName("startScript")]
        public string? StartScript { get; set; }

        [JsonPropertyName("stateFile")]
        public string? StateFile { get; set; }
    }
}
