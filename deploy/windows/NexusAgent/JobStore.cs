using System.Text.Json;

namespace NexusAgent;

/// <summary>
/// Histórico de jobs em <c>agent\jobs.json</c>. Mantém no máximo 100 registros,
/// do mais recente para o mais antigo. Leituras e gravações trabalham com cópias
/// para não expor o objeto em edição a uma requisição concorrente.
/// </summary>
public sealed class JobStore
{
    private const string InterruptedMessage =
        "Interrompido pelo reinício do serviço; verifique o log antes de repetir.";

    private readonly object _gate = new();
    private readonly string _path;
    private readonly ProgressPublisher _publisher;
    private readonly ILogger<JobStore> _logger;
    private List<Job> _jobs = new();

    public JobStore(AgentOptions options, ProgressPublisher publisher, ILogger<JobStore> logger)
    {
        _path = options.JobsFile;
        _publisher = publisher;
        _logger = logger;
        Load();
    }

    public void Upsert(Job job)
    {
        lock (_gate)
        {
            int index = _jobs.FindIndex(item => item.Id == job.Id);
            if (index >= 0)
            {
                _jobs[index] = job.Clone();
            }
            else
            {
                _jobs.Insert(0, job.Clone());
            }

            if (_jobs.Count > 100)
            {
                _jobs.RemoveRange(100, _jobs.Count - 100);
            }

            Save();
        }
    }

    public IReadOnlyList<Job> List(int limit)
    {
        lock (_gate)
        {
            return _jobs.Take(limit).Select(job => job.Clone()).ToList();
        }
    }

    public Job? Get(string id)
    {
        lock (_gate)
        {
            return _jobs.FirstOrDefault(job => job.Id == id)?.Clone();
        }
    }

    public Job? LastFinished()
    {
        lock (_gate)
        {
            return _jobs
                .Where(job => job.FinishedAt.HasValue)
                .OrderByDescending(job => job.FinishedAt)
                .FirstOrDefault()?.Clone();
        }
    }

    public bool HasSuccessfulBackupOn(DateOnly date, TimeZoneInfo zone)
    {
        lock (_gate)
        {
            return _jobs.Any(job =>
                job.Type == JobType.BACKUP &&
                job.Status == JobStatus.SUCCESS &&
                job.FinishedAt.HasValue &&
                DateOnly.FromDateTime(TimeZoneInfo.ConvertTime(job.FinishedAt.Value, zone).DateTime) == date);
        }
    }

    private void Load()
    {
        try
        {
            if (!File.Exists(_path))
            {
                return;
            }

            string json = File.ReadAllText(_path);
            List<Job>? jobs = JsonSerializer.Deserialize<List<Job>>(json, AgentJson.Options);
            if (jobs != null)
            {
                _jobs = jobs
                    .OrderByDescending(job => job.StartedAt ?? DateTimeOffset.MinValue)
                    .Take(100)
                    .ToList();
            }

            FailInterruptedJobs();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Não foi possível ler o histórico de jobs; começando vazio.");
            _jobs = new List<Job>();
        }
    }

    /// <summary>
    /// Um job QUEUED/RUNNING no arquivo não sobreviveu ao processo anterior: o
    /// serviço reiniciou no meio da operação. Marca como FAILED e publica
    /// <c>done:true</c> para a página de progresso não ficar presa.
    /// </summary>
    private void FailInterruptedJobs()
    {
        List<Job> stale = _jobs
            .Where(job => job.Status is JobStatus.QUEUED or JobStatus.RUNNING)
            .ToList();
        if (stale.Count == 0)
        {
            return;
        }

        DateTimeOffset now = DateTimeOffset.Now;
        foreach (Job job in stale)
        {
            job.Status = JobStatus.FAILED;
            job.FinishedAt = now;
            job.Message = InterruptedMessage;
            JobStep? running = job.Steps.FirstOrDefault(step => step.Status == StepStatus.running);
            if (running != null)
            {
                running.Status = StepStatus.error;
                running.Message = InterruptedMessage;
            }
        }

        _logger.LogWarning(
            "{Count} job(s) interrompido(s) pelo reinício do serviço foram marcados como FAILED.",
            stale.Count);
        Save();

        Job mostRecent = stale[0];
        _publisher.Publish(mostRecent, done: true, ok: false);
    }

    private void Save()
    {
        try
        {
            AtomicFile.WriteAllText(_path, JsonSerializer.Serialize(_jobs, AgentJson.Options));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha ao gravar o histórico de jobs.");
        }
    }
}
