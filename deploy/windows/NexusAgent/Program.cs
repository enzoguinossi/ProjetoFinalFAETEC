using System.Net;
using System.Reflection;
using System.Runtime.Versioning;
using System.Text.Json;
using System.Text.Json.Serialization;
using NexusAgent;

[assembly: SupportedOSPlatform("windows")]

string[] rawArgs = Environment.GetCommandLineArgs().Skip(1).ToArray();
bool console = rawArgs.Any(arg => string.Equals(arg, "--console", StringComparison.OrdinalIgnoreCase));
string[] builderArgs = rawArgs
    .Where(arg => !string.Equals(arg, "--console", StringComparison.OrdinalIgnoreCase))
    .ToArray();

AgentOptions options = AgentOptions.Load();
WebApplicationBuilder builder = WebApplication.CreateBuilder(new WebApplicationOptions { Args = builderArgs });

builder.Services.AddWindowsService(service => service.ServiceName = "NexusAgent");
builder.WebHost.ConfigureKestrel(kestrel =>
{
    // Somente loopback e sem HTTPS: o acesso externo passa pelo Caddy.
    kestrel.Listen(IPAddress.Loopback, options.Port);
});

builder.Services.ConfigureHttpJsonOptions(json =>
{
    json.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    json.SerializerOptions.Converters.Add(new JsonStringEnumConverter());
});

builder.Services.AddSingleton(options);
builder.Services.AddSingleton<JobStore>();
builder.Services.AddSingleton<ProgressPublisher>();
builder.Services.AddSingleton<ScheduleStore>();
builder.Services.AddSingleton<ManifestStore>();
builder.Services.AddSingleton<BackupRunner>();
builder.Services.AddSingleton<RestoreRunner>();
builder.Services.AddSingleton<JobEngine>();
builder.Services.AddHostedService<BackupScheduler>();

WebApplication app = builder.Build();

app.UseMiddleware<AuthMiddleware>();

app.MapGet("/v1/health", () => Results.Json(new
{
    status = "ok",
    version = Assembly.GetExecutingAssembly().GetName().Version?.ToString(3) ?? "1.0.0",
    mysql = ServiceControl.GetStatus(AgentOptions.MySqlServiceName),
    agentDir = options.AgentDir,
}));

app.MapGet("/v1/status", (JobEngine engine, JobStore store, ScheduleStore schedule) =>
    Results.Json(new
    {
        current = engine.Current,
        last = store.LastFinished(),
        schedule = schedule.Current,
    }));

app.MapPost("/v1/backup", (BackupRequest? body, JobEngine engine) =>
{
    StartOutcome outcome = engine.TryStartBackup(body?.RequestedBy);
    if (!outcome.Started)
    {
        return Results.Json(
            new { error = outcome.Error, job = outcome.Job },
            statusCode: StatusCodes.Status409Conflict);
    }

    return Results.Json(new { job = outcome.Job }, statusCode: StatusCodes.Status202Accepted);
});

app.MapPost("/v1/restore", (
    RestoreRequest? body,
    JobEngine engine,
    ManifestStore manifest) =>
{
    if (body == null || string.IsNullOrWhiteSpace(body.FileName))
    {
        return Results.Json(
            new { error = "fileName é obrigatório." },
            statusCode: StatusCodes.Status400BadRequest);
    }

    if (!manifest.TryResolve(body.FileName, out string path, out string error))
    {
        return Results.Json(new { error }, statusCode: StatusCodes.Status400BadRequest);
    }

    bool includeUploads = body.IncludeUploads ?? true;
    if (includeUploads &&
        !manifest.TryResolveUploadsSnapshot(body.FileName, out _, out string uploadsError))
    {
        return Results.Json(new { error = uploadsError }, statusCode: StatusCodes.Status400BadRequest);
    }

    StartOutcome outcome = engine.TryStartRestore(
        body.FileName,
        path,
        includeUploads,
        body.RequestedBy);
    if (!outcome.Started)
    {
        return Results.Json(
            new { error = outcome.Error, job = outcome.Job },
            statusCode: StatusCodes.Status409Conflict);
    }

    return Results.Json(new { job = outcome.Job }, statusCode: StatusCodes.Status202Accepted);
});

app.MapGet("/v1/jobs", (int? limit, JobStore store) =>
{
    int take = Math.Clamp(limit ?? 50, 1, 100);
    return Results.Json(new { jobs = store.List(take) });
});

app.MapGet("/v1/jobs/{id}", (string id, JobStore store) =>
{
    Job? job = store.Get(id);
    return job == null
        ? Results.Json(new { error = "Job não encontrado." }, statusCode: StatusCodes.Status404NotFound)
        : Results.Json(job);
});

app.MapGet("/v1/backups", (ManifestStore manifest) =>
    Results.Json(new { files = manifest.List() }));

app.MapGet("/v1/schedule", (ScheduleStore store) => Results.Json(store.Current));

app.MapPut("/v1/schedule", (ScheduleInput? body, ScheduleStore store) =>
{
    if (body == null ||
        body.Enabled is null ||
        body.Time is null ||
        body.Weekdays is null ||
        body.RetentionDays is null ||
        body.IncludeUploads is null)
    {
        return Results.Json(
            new { error = "enabled, time, weekdays, retentionDays e includeUploads são obrigatórios." },
            statusCode: StatusCodes.Status400BadRequest);
    }

    var schedule = new Schedule
    {
        Enabled = body.Enabled.Value,
        Time = body.Time,
        Weekdays = body.Weekdays,
        RetentionDays = body.RetentionDays.Value,
        IncludeUploads = body.IncludeUploads.Value,
    };

    string? error = ScheduleStore.Validate(schedule);
    if (error != null)
    {
        return Results.Json(new { error }, statusCode: StatusCodes.Status400BadRequest);
    }

    store.Save(schedule);
    return Results.Json(schedule);
});

app.Logger.LogInformation(
    "NexusAgent iniciado em http://127.0.0.1:{Port} (modo {Mode}).",
    options.Port,
    console ? "console" : "serviço");
app.Run();

namespace NexusAgent
{
    public sealed class BackupRequest
    {
        public int? RequestedBy { get; set; }
    }

    public sealed class RestoreRequest
    {
        public string? FileName { get; set; }
        public bool? IncludeUploads { get; set; }
        public int? RequestedBy { get; set; }
    }

    public sealed class ScheduleInput
    {
        public bool? Enabled { get; set; }
        public string? Time { get; set; }
        public List<int>? Weekdays { get; set; }
        public int? RetentionDays { get; set; }
        public bool? IncludeUploads { get; set; }
    }
}
