using System.Security.Cryptography;

namespace NexusAgent;

public sealed record StartOutcome(bool Started, Job Job, string? Error);

public sealed class JobEngine
{
    private readonly object _gate = new();
    private readonly JobStore _store;
    private readonly ProgressPublisher _publisher;
    private readonly BackupRunner _backup;
    private readonly RestoreRunner _restore;
    private readonly ScheduleStore _schedule;
    private readonly IHostApplicationLifetime _lifetime;
    private readonly ILogger<JobEngine> _logger;
    private Job? _current;

    public JobEngine(
        JobStore store,
        ProgressPublisher publisher,
        BackupRunner backup,
        RestoreRunner restore,
        ScheduleStore schedule,
        IHostApplicationLifetime lifetime,
        ILogger<JobEngine> logger)
    {
        _store = store;
        _publisher = publisher;
        _backup = backup;
        _restore = restore;
        _schedule = schedule;
        _lifetime = lifetime;
        _logger = logger;
    }

    public Job? Current
    {
        get
        {
            lock (_gate)
            {
                return _current?.Clone();
            }
        }
    }

    public bool IsBusy
    {
        get
        {
            lock (_gate)
            {
                return _current is { Status: JobStatus.QUEUED or JobStatus.RUNNING };
            }
        }
    }

    public StartOutcome TryStartBackup(int? requestedBy)
    {
        Schedule schedule = _schedule.Current;
        Job job = NewJob(JobType.BACKUP, null, schedule.IncludeUploads, requestedBy);
        return Start(job, async (target, report, ct) =>
        {
            BackupOutcome outcome = await _backup.RunAsync(
                report,
                schedule.RetentionDays,
                schedule.IncludeUploads,
                ct);
            return new RunOutcome(outcome.Success, outcome.Error, outcome.LogPath);
        });
    }

    public StartOutcome TryStartRestore(
        string fileName,
        string filePath,
        bool includeUploads,
        int? requestedBy)
    {
        Schedule schedule = _schedule.Current;
        Job job = NewJob(JobType.RESTORE, fileName, includeUploads, requestedBy);
        return Start(job, async (target, report, ct) =>
        {
            RestoreOutcome outcome = await _restore.RunAsync(
                report,
                target.Id,
                fileName,
                filePath,
                includeUploads,
                schedule.RetentionDays,
                ct);
            return new RunOutcome(outcome.Success, outcome.Error, outcome.LogPath);
        });
    }

    private StartOutcome Start(
        Job job,
        Func<Job, Action<int, string, string>, CancellationToken, Task<RunOutcome>> work)
    {
        lock (_gate)
        {
            if (_current is { Status: JobStatus.QUEUED or JobStatus.RUNNING })
            {
                return new StartOutcome(
                    false,
                    _current.Clone(),
                    "Já existe uma operação em andamento.");
            }

            job.Status = JobStatus.RUNNING;
            job.StartedAt = DateTimeOffset.Now;
            job.Percent = 0;
            job.Step = job.Steps.FirstOrDefault()?.Name ?? "";
            job.Message = "Iniciando";
            // M5: o primeiro passo já aparece em andamento enquanto a operação começa.
            if (job.Steps.Count > 0)
            {
                job.Steps[0].Status = StepStatus.running;
                job.Steps[0].Message = "Iniciando";
            }
            _current = job;
            _store.Upsert(job);
            _publisher.Publish(job, done: false, ok: false);
        }

        _ = Task.Run(() => RunAsync(job, work));
        return new StartOutcome(true, job.Clone(), null);
    }

    private async Task RunAsync(
        Job job,
        Func<Job, Action<int, string, string>, CancellationToken, Task<RunOutcome>> work)
    {
        RunOutcome outcome;
        try
        {
            outcome = await work(
                job,
                (percent, step, message) => Update(job, percent, step, message),
                _lifetime.ApplicationStopping);
        }
        catch (OperationCanceledException)
        {
            outcome = new RunOutcome(
                false,
                "Operação interrompida pelo desligamento do serviço.",
                job.LogPath);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Falha inesperada no job {JobId}.", job.Id);
            outcome = new RunOutcome(false, "Falha inesperada: " + ex.Message, job.LogPath);
        }

        lock (_gate)
        {
            if (!ReferenceEquals(_current, job))
            {
                return;
            }

            job.FinishedAt = DateTimeOffset.Now;
            job.LogPath = outcome.LogPath ?? job.LogPath;

            IReadOnlyList<(string Name, int Percent)> plan = JobPlans.For(job.Type);
            if (outcome.Success)
            {
                job.Status = JobStatus.SUCCESS;
                job.Percent = 100;
                job.Step = plan[^1].Name;
                job.Message = job.Type == JobType.BACKUP
                    ? "Backup concluído."
                    : "Restauração concluída.";
                foreach (JobStep step in job.Steps)
                {
                    step.Status = StepStatus.done;
                }
            }
            else
            {
                job.Status = JobStatus.FAILED;
                job.Message = outcome.Error ?? "Operação falhou.";
                JobStep? running = job.Steps.FirstOrDefault(step => step.Status == StepStatus.running);
                if (running != null)
                {
                    running.Status = StepStatus.error;
                    running.Message = job.Message;
                }
            }

            _store.Upsert(job);
            _publisher.Publish(job, done: true, ok: outcome.Success);
            if (!outcome.Success)
            {
                _logger.LogWarning("Job {JobId} falhou: {Message}", job.Id, job.Message);
            }
            _current = null;
        }
    }

    private void Update(Job job, int percent, string stepName, string message)
    {
        lock (_gate)
        {
            if (!ReferenceEquals(_current, job))
            {
                return;
            }

            IReadOnlyList<(string Name, int Percent)> plan = JobPlans.For(job.Type);
            int index = 0;
            for (int i = 0; i < plan.Count; i++)
            {
                if (percent >= plan[i].Percent)
                {
                    index = i;
                }
            }

            int effective = Math.Max(percent, job.Percent);
            job.Percent = Math.Clamp(effective, 0, 100);
            job.Step = plan[index].Name;
            job.Message = message;

            for (int i = 0; i < job.Steps.Count && i < plan.Count; i++)
            {
                if (i < index)
                {
                    job.Steps[i].Status = StepStatus.done;
                }
                else if (i == index)
                {
                    job.Steps[i].Status = StepStatus.running;
                    job.Steps[i].Message = message;
                }
            }

            _store.Upsert(job);
            _publisher.Publish(job, done: false, ok: false);
        }
    }

    private Job NewJob(JobType type, string? fileName, bool includeUploads, int? requestedBy)
    {
        IReadOnlyList<(string Name, int Percent)> plan = JobPlans.For(type);
        return new Job
        {
            Id = $"{DateTime.Now:yyyyMMdd-HHmmss}-{RandomHex()}",
            Type = type,
            Status = JobStatus.QUEUED,
            Percent = 0,
            Step = plan[0].Name,
            Message = "Aguardando início",
            FileName = fileName,
            IncludeUploads = includeUploads,
            RequestedBy = requestedBy,
            Steps = plan.Select(item => new JobStep { Name = item.Name }).ToList(),
        };
    }

    private static string RandomHex()
    {
        Span<byte> buffer = stackalloc byte[2];
        RandomNumberGenerator.Fill(buffer);
        return Convert.ToHexString(buffer).ToLowerInvariant();
    }

    private readonly record struct RunOutcome(bool Success, string? Error, string? LogPath);
}
