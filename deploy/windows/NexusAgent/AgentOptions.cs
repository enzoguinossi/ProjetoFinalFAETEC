namespace NexusAgent;

/// <summary>
/// Caminhos e parâmetros do agente. Todos podem ser sobrescritos por variável de
/// ambiente para permitir testes em console sem tocar no diretório de produção.
/// </summary>
public sealed class AgentOptions
{
    public string ProgramRoot { get; init; } = @"C:\Program Files\Nexus";
    public string DataDir { get; init; } = @"C:\ProgramData\Nexus";
    public string SecretFile { get; init; } = @"C:\ProgramData\Nexus\config\agent.secret";
    public string ListenUrl { get; init; } = "http://127.0.0.1:3215";
    public string AppHealthUrl { get; init; } = "http://127.0.0.1:3000/api/health";
    public string TimeZoneId { get; init; } = "America/Sao_Paulo";

    public const string AppServiceName = "NexusApp";
    public const string MySqlServiceName = "NexusMySQL84";
    public const string CaddyServiceName = "NexusCaddy";

    public string AgentDir => Path.Combine(DataDir, "agent");
    public string ConfigDir => Path.Combine(DataDir, "config");
    public string LogsDir => Path.Combine(DataDir, "logs");
    public string BackupsDir => Path.Combine(DataDir, "backups");
    public string DbBackupsDir => Path.Combine(BackupsDir, "db");
    /// <summary>Raiz dos snapshots de uploads; cada backup fica em <c>uploads\&lt;timestamp&gt;</c>.</summary>
    public string UploadsBackupsRoot => Path.Combine(BackupsDir, "uploads");
    public string UploadsDir => Path.Combine(DataDir, "uploads");
    public string TmpDir => Path.Combine(AgentDir, "tmp");
    public string CaddyProgressDir => Path.Combine(DataDir, "caddy", "progresso");
    public string ProgressStatusFile => Path.Combine(CaddyProgressDir, "status.json");
    public string JobsFile => Path.Combine(AgentDir, "jobs.json");
    public string ScheduleFile => Path.Combine(AgentDir, "schedule.json");
    public string BackupScript => Path.Combine(ProgramRoot, "scripts", "backup.ps1");
    public string MysqlExe => Path.Combine(ProgramRoot, "mysql", "bin", "mysql.exe");
    public string BackupCnf => Path.Combine(ConfigDir, "backup.cnf");

    public int Port
    {
        get
        {
            if (!Uri.TryCreate(ListenUrl, UriKind.Absolute, out Uri? uri) || uri.Port <= 0)
            {
                return 3215;
            }
            return uri.Port;
        }
    }

    /// <summary>Diretório do snapshot de uploads do backup com o timestamp informado.</summary>
    public string UploadsSnapshotDir(string timestamp) => Path.Combine(UploadsBackupsRoot, timestamp);

    public static AgentOptions Load()
    {
        string data = Env("NEXUS_AGENT_DATA_DIR") ?? @"C:\ProgramData\Nexus";
        string program = Env("NEXUS_AGENT_PROGRAM_ROOT") ?? @"C:\Program Files\Nexus";
        return new AgentOptions
        {
            ProgramRoot = program,
            DataDir = data,
            SecretFile = Env("NEXUS_AGENT_SECRET_FILE") ?? Path.Combine(data, "config", "agent.secret"),
            ListenUrl = Env("NEXUS_AGENT_URL") ?? "http://127.0.0.1:3215",
            AppHealthUrl = Env("NEXUS_AGENT_APP_HEALTH") ?? "http://127.0.0.1:3000/api/health",
        };
    }

    private static string? Env(string name)
    {
        string? value = Environment.GetEnvironmentVariable(name);
        return string.IsNullOrWhiteSpace(value) ? null : value.Trim();
    }
}
