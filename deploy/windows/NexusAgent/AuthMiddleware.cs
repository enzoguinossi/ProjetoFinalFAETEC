using System.Security.Cryptography;
using System.Text;

namespace NexusAgent;

/// <summary>
/// Exige <c>Authorization: Bearer &lt;segredo&gt;</c> em todas as rotas /v1
/// (inclusive /v1/health). O segredo é lido de agent.secret e comparado em
/// tempo constante; ele nunca aparece em log.
/// </summary>
public sealed class AuthMiddleware
{
    private readonly RequestDelegate _next;
    private readonly AgentOptions _options;
    private readonly ILogger<AuthMiddleware> _logger;

    public AuthMiddleware(
        RequestDelegate next,
        AgentOptions options,
        ILogger<AuthMiddleware> logger)
    {
        _next = next;
        _options = options;
        _logger = logger;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        if (!context.Request.Path.StartsWithSegments("/v1"))
        {
            await _next(context);
            return;
        }

        string? secret = ReadSecret();
        if (secret == null)
        {
            _logger.LogError("Segredo do agente ausente em {Path}.", _options.SecretFile);
            context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
            await context.Response.WriteAsJsonAsync(new { error = "Segredo do agente não configurado." });
            return;
        }

        string header = context.Request.Headers.Authorization.ToString();
        const string prefix = "Bearer ";
        if (!header.StartsWith(prefix, StringComparison.OrdinalIgnoreCase))
        {
            await Unauthorized(context);
            return;
        }

        string token = header[prefix.Length..].Trim();
        if (token.Length == 0 || !FixedTimeEquals(token, secret))
        {
            await Unauthorized(context);
            return;
        }

        await _next(context);
    }

    private static async Task Unauthorized(HttpContext context)
    {
        context.Response.StatusCode = StatusCodes.Status401Unauthorized;
        context.Response.Headers.WWWAuthenticate = "Bearer";
        await context.Response.WriteAsJsonAsync(new { error = "Não autorizado." });
    }

    private string? ReadSecret()
    {
        try
        {
            if (!File.Exists(_options.SecretFile))
            {
                return null;
            }

            string value = File.ReadAllText(_options.SecretFile).Trim();
            return value.Length == 0 ? null : value;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Não foi possível ler o segredo do agente.");
            return null;
        }
    }

    /// <summary>
    /// Compara digests SHA-256: FixedTimeEquals exige o mesmo tamanho e o hash
    /// evita revelar o comprimento do segredo pelo tempo de comparação.
    /// </summary>
    private static bool FixedTimeEquals(string provided, string expected)
    {
        byte[] providedHash = SHA256.HashData(Encoding.UTF8.GetBytes(provided));
        byte[] expectedHash = SHA256.HashData(Encoding.UTF8.GetBytes(expected));
        return CryptographicOperations.FixedTimeEquals(providedHash, expectedHash);
    }
}
