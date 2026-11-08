using System.Text.Json;

namespace NexusAgent;

public enum JobType
{
    BACKUP,
    RESTORE,
}

public enum JobStatus
{
    QUEUED,
    RUNNING,
    SUCCESS,
    FAILED,
}

public enum StepStatus
{
    pending,
    running,
    done,
    error,
}

public sealed class JobStep
{
    public string Name { get; set; } = "";
    public StepStatus Status { get; set; } = StepStatus.pending;
    public string Message { get; set; } = "";

    public JobStep Clone() => new() { Name = Name, Status = Status, Message = Message };
}

public sealed class Job
{
    public string Id { get; set; } = "";
    public JobType Type { get; set; }
    public JobStatus Status { get; set; } = JobStatus.QUEUED;
    public int Percent { get; set; }
    public string Step { get; set; } = "";
    public string Message { get; set; } = "";
    public DateTimeOffset? StartedAt { get; set; }
    public DateTimeOffset? FinishedAt { get; set; }
    public int? RequestedBy { get; set; }
    public string? FileName { get; set; }
    public bool IncludeUploads { get; set; }
    public string? LogPath { get; set; }
    public List<JobStep> Steps { get; set; } = new();

    public Job Clone() => new()
    {
        Id = Id,
        Type = Type,
        Status = Status,
        Percent = Percent,
        Step = Step,
        Message = Message,
        StartedAt = StartedAt,
        FinishedAt = FinishedAt,
        RequestedBy = RequestedBy,
        FileName = FileName,
        IncludeUploads = IncludeUploads,
        LogPath = LogPath,
        Steps = Steps.Select(step => step.Clone()).ToList(),
    };
}

/// <summary>Plano de etapas exibido no job (nome + percentual mínimo).</summary>
public static class JobPlans
{
    public static IReadOnlyList<(string Name, int Percent)> For(JobType type) => type switch
    {
        JobType.BACKUP => new[]
        {
            ("Pre-checagem", 5),
            ("Banco de dados", 15),
            ("Compactacao", 35),
            ("Uploads", 70),
            ("Configuracao", 85),
            ("Retencao", 95),
            ("Concluido", 100),
        },
        _ => new[]
        {
            ("Pre-checagem", 5),
            ("Backup de seguranca", 15),
            ("Parando aplicacao", 30),
            ("Restaurando banco", 50),
            ("Restaurando uploads", 70),
            ("Iniciando aplicacao", 85),
            ("Validando health", 100),
        },
    };
}

public static class AgentJson
{
    public static readonly JsonSerializerOptions Options = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false,
        Converters = { new System.Text.Json.Serialization.JsonStringEnumConverter() },
    };
}

public static class AtomicFile
{
    /// <summary>Grava o arquivo por troca atômica (.tmp + Move com overwrite).</summary>
    public static void WriteAllText(string path, string contents)
    {
        string? dir = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }

        string tmp = path + ".tmp";
        File.WriteAllText(tmp, contents, new System.Text.UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
        File.Move(tmp, path, overwrite: true);
    }
}
