namespace NexusAgent;

/// <summary>
/// Dispara o backup agendado a cada 30 s. Considera o fuso America/Sao_Paulo,
/// os dias marcados e não repete quando já houve backup SUCCESS no dia.
/// </summary>
public sealed class BackupScheduler : BackgroundService
{
    private static readonly TimeSpan Tick = TimeSpan.FromSeconds(30);
    // Se a tentativa agendada falhar, o dia continua sem backup SUCCESS; a nova
    // tentativa espera 30 min em vez de repetir a cada tique.
    private static readonly TimeSpan RetryDelay = TimeSpan.FromMinutes(30);
    private readonly JobEngine _engine;
    private readonly JobStore _store;
    private readonly ScheduleStore _schedule;
    private readonly AgentOptions _options;
    private readonly ILogger<BackupScheduler> _logger;
    private DateTimeOffset? _lastAttempt;

    public BackupScheduler(
        JobEngine engine,
        JobStore store,
        ScheduleStore schedule,
        AgentOptions options,
        ILogger<BackupScheduler> logger)
    {
        _engine = engine;
        _store = store;
        _schedule = schedule;
        _options = options;
        _logger = logger;
    }

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                MaybeStart();
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Falha ao avaliar a agenda de backup.");
            }

            try
            {
                await Task.Delay(Tick, stoppingToken);
            }
            catch (OperationCanceledException)
            {
                return;
            }
        }
    }

    private void MaybeStart()
    {
        Schedule schedule = _schedule.Current;
        if (!schedule.Enabled)
        {
            return;
        }

        TimeZoneInfo zone = ResolveZone(_options.TimeZoneId);
        DateTime now = TimeZoneInfo.ConvertTime(DateTimeOffset.UtcNow, zone).DateTime;
        DateOnly today = DateOnly.FromDateTime(now);

        if (!schedule.Weekdays.Contains((int)now.DayOfWeek))
        {
            return;
        }

        if (!TimeOnly.TryParse(
                schedule.Time,
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None,
                out TimeOnly scheduled))
        {
            return;
        }

        if (TimeOnly.FromDateTime(now) < scheduled)
        {
            return;
        }

        // Já houve backup concluído hoje: nada a fazer (inclusive depois de reiniciar).
        if (_store.HasSuccessfulBackupOn(today, zone))
        {
            return;
        }

        if (_lastAttempt.HasValue && DateTimeOffset.Now - _lastAttempt.Value < RetryDelay)
        {
            return;
        }

        StartOutcome outcome = _engine.TryStartBackup(requestedBy: null);
        if (outcome.Started)
        {
            _lastAttempt = DateTimeOffset.Now;
            _logger.LogInformation("Backup agendado iniciado ({JobId}).", outcome.Job.Id);
        }
    }

    private static TimeZoneInfo ResolveZone(string id)
    {
        foreach (string candidate in new[] { id, "America/Sao_Paulo", "E. South America Standard Time" })
        {
            try
            {
                return TimeZoneInfo.FindSystemTimeZoneById(candidate);
            }
            catch
            {
                // Tenta o próximo identificador.
            }
        }

        return TimeZoneInfo.Local;
    }
}
