using System.Text.Json;

namespace NexusAgent;

/// <summary>
/// Publica o estado do job atual em <c>C:\ProgramData\Nexus\caddy\progresso\status.json</c>
/// para a página estática servida pelo Caddy. O arquivo não contém segredos.
/// </summary>
public sealed class ProgressPublisher
{
    private readonly string _path;
    private readonly ILogger<ProgressPublisher> _logger;

    public ProgressPublisher(AgentOptions options, ILogger<ProgressPublisher> logger)
    {
        _path = options.ProgressStatusFile;
        _logger = logger;
    }

    public void Publish(Job job, bool done, bool ok)
    {
        try
        {
            var state = new
            {
                jobId = job.Id,
                type = job.Type.ToString(),
                percent = job.Percent,
                step = job.Step,
                message = job.Message,
                done,
                ok,
                startedAt = job.StartedAt,
                finishedAt = job.FinishedAt,
                steps = job.Steps.Select(step => new
                {
                    name = step.Name,
                    status = step.Status.ToString(),
                    message = step.Message,
                }).ToArray(),
            };

            AtomicFile.WriteAllText(_path, JsonSerializer.Serialize(state, AgentJson.Options));
        }
        catch (Exception ex)
        {
            // A página de progresso é auxiliar: nunca interrompe a operação.
            _logger.LogWarning(ex, "Não foi possível gravar o status de progresso.");
        }
    }
}
