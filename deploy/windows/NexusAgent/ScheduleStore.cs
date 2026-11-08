using System.Text.Json;

namespace NexusAgent;

public sealed class Schedule
{
    public bool Enabled { get; set; } = true;
    public string Time { get; set; } = "02:00";
    public List<int> Weekdays { get; set; } = Enumerable.Range(0, 7).ToList();
    public int RetentionDays { get; set; } = 30;
    public bool IncludeUploads { get; set; } = true;

    public Schedule Clone() => new()
    {
        Enabled = Enabled,
        Time = Time,
        Weekdays = Weekdays.ToList(),
        RetentionDays = RetentionDays,
        IncludeUploads = IncludeUploads,
    };
}

/// <summary>Agenda persistida em <c>agent\schedule.json</c>.</summary>
public sealed class ScheduleStore
{
    private readonly object _gate = new();
    private readonly string _path;
    private readonly ILogger<ScheduleStore> _logger;
    private Schedule _current = new();

    public ScheduleStore(AgentOptions options, ILogger<ScheduleStore> logger)
    {
        _path = options.ScheduleFile;
        _logger = logger;
        Load();
    }

    public Schedule Current
    {
        get
        {
            lock (_gate)
            {
                return _current.Clone();
            }
        }
    }

    public void Save(Schedule schedule)
    {
        lock (_gate)
        {
            Schedule copy = schedule.Clone();
            // Grava primeiro: se o disco falhar, a memória não diverge do arquivo.
            AtomicFile.WriteAllText(_path, JsonSerializer.Serialize(copy, AgentJson.Options));
            _current = copy;
        }
    }

    /// <summary>Valida e normaliza a agenda; devolve a mensagem de erro ou null.</summary>
    public static string? Validate(Schedule? schedule)
    {
        if (schedule == null)
        {
            return "Corpo da agenda ausente.";
        }

        if (!TimeOnly.TryParseExact(
                schedule.Time,
                "HH:mm",
                System.Globalization.CultureInfo.InvariantCulture,
                System.Globalization.DateTimeStyles.None,
                out _))
        {
            return "time deve estar no formato HH:mm.";
        }

        if (schedule.Weekdays == null)
        {
            return "weekdays é obrigatório.";
        }

        if (schedule.Weekdays.Count == 0)
        {
            return "weekdays precisa ter ao menos um dia.";
        }

        if (schedule.Weekdays.Any(day => day < 0 || day > 6))
        {
            return "weekdays aceita apenas valores de 0 a 6.";
        }

        if (schedule.Weekdays.Distinct().Count() != schedule.Weekdays.Count)
        {
            return "weekdays não pode ter dias duplicados.";
        }

        if (schedule.RetentionDays < 1 || schedule.RetentionDays > 365)
        {
            return "retentionDays deve ficar entre 1 e 365.";
        }

        return null;
    }

    private void Load()
    {
        try
        {
            if (!File.Exists(_path))
            {
                Save(new Schedule());
                return;
            }

            Schedule? loaded = JsonSerializer.Deserialize<Schedule>(
                File.ReadAllText(_path),
                AgentJson.Options);
            if (loaded != null && Validate(loaded) == null)
            {
                _current = loaded;
                return;
            }

            _logger.LogWarning("Agenda inválida em {Path}; usando o padrão.", _path);
            _current = new Schedule();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Não foi possível ler a agenda; usando o padrão.");
            _current = new Schedule();
        }
    }
}
