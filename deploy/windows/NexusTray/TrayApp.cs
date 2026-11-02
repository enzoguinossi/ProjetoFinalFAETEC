using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Windows.Forms;

namespace NexusTray;

internal sealed class TrayApp : ApplicationContext
{
    private const int PollIntervalMs = 20_000;
    private const int BalloonTimeoutMs = 5_000;
    private const int TooltipLimit = 63;

    private static readonly Color GreenColor = Color.FromArgb(46, 158, 68);
    private static readonly Color YellowColor = Color.FromArgb(224, 161, 0);
    private static readonly Color RedColor = Color.FromArgb(214, 69, 69);

    private readonly TrayConfig _config;
    private readonly HttpClient _http;
    private readonly NotifyIcon _notifyIcon;
    private readonly ContextMenuStrip _menu;
    private readonly ToolStripMenuItem _statusItem;
    private readonly ToolStripMenuItem _backupItem;
    private readonly System.Windows.Forms.Timer _timer;

    private Icon? _icon;
    private IntPtr _iconHandle = IntPtr.Zero;
    private TrayState? _iconState;
    private TrayState? _lastState;
    private bool _polling;
    private bool _restarting;
    private bool _disposed;

    public TrayApp(TrayConfig config)
    {
        _config = config;
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

        _statusItem = new ToolStripMenuItem("Status: verificando…") { Enabled = false };

        ToolStripMenuItem openItem = new("Abrir Nexus");
        openItem.Click += (_, _) => OpenUrl(_config.BaseUrl);

        ToolStripMenuItem restartItem = new("Reiniciar aplicação");
        restartItem.Click += async (_, _) => await RestartServiceAsync();

        ToolStripMenuItem logsItem = new("Abrir logs");
        logsItem.Click += (_, _) => OpenFolder(_config.LogsDir, "logs");

        _backupItem = new ToolStripMenuItem("Fazer backup agora");
        _backupItem.Click += (_, _) => RunBackup();

        ToolStripMenuItem dataItem = new("Abrir pasta de dados");
        dataItem.Click += (_, _) => OpenFolder(_config.DataDir, "dados");

        ToolStripMenuItem exitItem = new("Sair");
        exitItem.Click += (_, _) => ExitApplication();

        _menu = new ContextMenuStrip();
        _menu.Items.AddRange(new ToolStripItem[]
        {
            openItem,
            _statusItem,
            new ToolStripSeparator(),
            restartItem,
            logsItem,
            _backupItem,
            dataItem,
            new ToolStripSeparator(),
            exitItem
        });

        _notifyIcon = new NotifyIcon
        {
            Text = "Nexus — verificando…",
            Visible = true,
            ContextMenuStrip = _menu
        };
        _notifyIcon.DoubleClick += (_, _) => OpenUrl(_config.BaseUrl);

        SetStateIcon(TrayState.Red);

        _timer = new System.Windows.Forms.Timer { Interval = PollIntervalMs };
        _timer.Tick += OnTimerTick;

        Application.Idle += OnFirstIdle;
    }

    private void OnFirstIdle(object? sender, EventArgs e)
    {
        Application.Idle -= OnFirstIdle;
        _timer.Start();
        _ = PollAsync();
    }

    private void OnTimerTick(object? sender, EventArgs e)
    {
        _ = PollAsync();
    }

    private async Task PollAsync()
    {
        if (_polling || _disposed)
        {
            return;
        }

        _polling = true;
        try
        {
            ServiceSnapshot service = ReadService();
            HealthResult health = service.Running
                ? await CheckHealthAsync()
                : HealthResult.Unavailable("—");

            TrayState state;
            if (!service.Running)
            {
                state = TrayState.Red;
            }
            else if (!health.Reachable)
            {
                state = TrayState.Red;
            }
            else
            {
                state = health.Ok ? TrayState.Green : TrayState.Yellow;
            }

            Apply(new TraySnapshot(state, service.Text, health.Text, health.Versao));
        }
        catch (Exception)
        {
            // O polling nunca pode derrubar o processo.
        }
        finally
        {
            _polling = false;
        }
    }

    private void Apply(TraySnapshot snapshot)
    {
        TrayState? previous = _lastState;
        _lastState = snapshot.State;

        SetStateIcon(snapshot.State);
        _notifyIcon.Text = Truncate(BuildTooltip(snapshot), TooltipLimit);
        _statusItem.Text = BuildStatus(snapshot);

        if (previous.HasValue && previous.Value != snapshot.State)
        {
            NotifyTransition(snapshot.State);
        }
    }

    private static string BuildTooltip(TraySnapshot snapshot)
    {
        string stateText = snapshot.State switch
        {
            TrayState.Green => "em execução",
            TrayState.Yellow => "degradado",
            _ => "fora do ar"
        };

        string text = "Nexus — " + stateText;
        string? version = NormalizeVersion(snapshot.Version);
        if (version is not null)
        {
            text += " · " + version;
        }

        return text;
    }

    private static string BuildStatus(TraySnapshot snapshot)
    {
        string version = NormalizeVersion(snapshot.Version) ?? "versão desconhecida";
        return $"Serviço: {snapshot.ServiceText} · Banco: {snapshot.HealthText} · {version}";
    }

    private static string? NormalizeVersion(string? version)
    {
        if (string.IsNullOrWhiteSpace(version))
        {
            return null;
        }

        string trimmed = version.Trim();
        return trimmed.StartsWith("v", StringComparison.OrdinalIgnoreCase) ? trimmed : "v" + trimmed;
    }

    private static string Truncate(string value, int maxLength)
    {
        return value.Length <= maxLength ? value : value[..maxLength];
    }

    private void NotifyTransition(TrayState state)
    {
        switch (state)
        {
            case TrayState.Red:
                ShowBalloon(
                    "Nexus indisponível",
                    "O serviço ou o health check não está respondendo.",
                    ToolTipIcon.Error);
                break;
            case TrayState.Yellow:
                ShowBalloon(
                    "Nexus degradado",
                    "O serviço está ativo, mas o banco de dados não respondeu.",
                    ToolTipIcon.Warning);
                break;
            case TrayState.Green:
                ShowBalloon(
                    "Nexus normalizado",
                    "Serviço e banco de dados respondendo.",
                    ToolTipIcon.Info);
                break;
        }
    }

    private void SetStateIcon(TrayState state)
    {
        if (_iconState == state)
        {
            return;
        }

        (Icon icon, IntPtr handle) = CreateIcon(state);
        _notifyIcon.Icon = icon;

        if (_icon is not null)
        {
            _icon.Dispose();
        }

        if (_iconHandle != IntPtr.Zero)
        {
            DestroyIcon(_iconHandle);
        }

        _icon = icon;
        _iconHandle = handle;
        _iconState = state;
    }

    private static (Icon Icon, IntPtr Handle) CreateIcon(TrayState state)
    {
        Color color = state switch
        {
            TrayState.Green => GreenColor,
            TrayState.Yellow => YellowColor,
            _ => RedColor
        };

        using Bitmap bitmap = new(32, 32);
        using (Graphics graphics = Graphics.FromImage(bitmap))
        {
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.Clear(Color.Transparent);

            using (SolidBrush brush = new(color))
            {
                graphics.FillEllipse(brush, 2, 2, 28, 28);
            }

            using (Pen border = new(Color.FromArgb(70, 0, 0, 0), 1.5f))
            {
                graphics.DrawEllipse(border, 2.75f, 2.75f, 26.5f, 26.5f);
            }

            using (SolidBrush highlight = new(Color.FromArgb(80, Color.White)))
            {
                graphics.FillEllipse(highlight, 9, 8, 9, 7);
            }
        }

        IntPtr handle = bitmap.GetHicon();
        return (Icon.FromHandle(handle), handle);
    }

    private ServiceSnapshot ReadService()
    {
        try
        {
            using ServiceController controller = new(_config.ServiceName);
            ServiceControllerStatus status = controller.Status;
            return status switch
            {
                ServiceControllerStatus.Running => new ServiceSnapshot(true, "em execução"),
                ServiceControllerStatus.Stopped => new ServiceSnapshot(false, "parado"),
                ServiceControllerStatus.StartPending => new ServiceSnapshot(false, "iniciando"),
                ServiceControllerStatus.StopPending => new ServiceSnapshot(false, "parando"),
                ServiceControllerStatus.Paused => new ServiceSnapshot(false, "pausado"),
                ServiceControllerStatus.PausePending => new ServiceSnapshot(false, "pausando"),
                ServiceControllerStatus.ContinuePending => new ServiceSnapshot(false, "retomando"),
                _ => new ServiceSnapshot(false, "desconhecido")
            };
        }
        catch (InvalidOperationException)
        {
            return new ServiceSnapshot(false, "não instalado");
        }
        catch (Exception)
        {
            return new ServiceSnapshot(false, "indisponível");
        }
    }

    private async Task<HealthResult> CheckHealthAsync()
    {
        try
        {
            using HttpResponseMessage response = await _http.GetAsync(_config.HealthUrl);
            string body = await response.Content.ReadAsStringAsync();

            HealthPayload? payload = null;
            if (!string.IsNullOrWhiteSpace(body))
            {
                try
                {
                    payload = JsonSerializer.Deserialize<HealthPayload>(body);
                }
                catch (JsonException)
                {
                    // Resposta fora do contrato: tratada como degradada abaixo.
                }
            }

            bool ok = response.StatusCode == HttpStatusCode.OK
                && string.Equals(payload?.Status, "ok", StringComparison.OrdinalIgnoreCase)
                && payload?.Db == true;

            string text = ok
                ? "ok"
                : payload?.Db == false ? "banco indisponível" : "degradado";

            return new HealthResult(true, ok, payload?.Versao, text);
        }
        catch (Exception)
        {
            return new HealthResult(false, false, null, "sem resposta");
        }
    }

    private async Task RestartServiceAsync()
    {
        if (_restarting)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(_config.RestartScript) || !File.Exists(_config.RestartScript))
        {
            ShowBalloon(
                "Reinício não configurado",
                $"O script de reinício não foi encontrado: {_config.RestartScript}",
                ToolTipIcon.Error);
            return;
        }

        _restarting = true;
        try
        {
            ProcessStartInfo startInfo = new(GetPowerShellPath())
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            startInfo.ArgumentList.Add("-NoProfile");
            startInfo.ArgumentList.Add("-ExecutionPolicy");
            startInfo.ArgumentList.Add("Bypass");
            startInfo.ArgumentList.Add("-File");
            startInfo.ArgumentList.Add(_config.RestartScript);

            using Process? process = Process.Start(startInfo);
            if (process is null)
            {
                ShowBalloon(
                    "Falha ao reiniciar",
                    "Não foi possível iniciar o script de reinício.",
                    ToolTipIcon.Error);
                return;
            }

            ShowBalloon("Nexus", "Reiniciando a aplicação…", ToolTipIcon.Info);
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                ShowBalloon("Nexus", "Aplicação reiniciada com sucesso.", ToolTipIcon.Info);
            }
            else
            {
                ShowBalloon(
                    "Falha ao reiniciar",
                    $"O script terminou com código {process.ExitCode}. Veja os logs.",
                    ToolTipIcon.Error);
            }

            _ = PollAfterAsync(TimeSpan.FromSeconds(2));
        }
        catch (Exception ex)
        {
            ShowBalloon("Falha ao reiniciar", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            _restarting = false;
        }
    }

    private async Task PollAfterAsync(TimeSpan delay)
    {
        try
        {
            await Task.Delay(delay);
            await PollAsync();
        }
        catch (Exception)
        {
            // O próximo ciclo do timer tenta novamente.
        }
    }

    private void OpenUrl(string url)
    {
        try
        {
            if (!Uri.TryCreate(url, UriKind.Absolute, out Uri? uri)
                || (uri.Scheme != Uri.UriSchemeHttp && uri.Scheme != Uri.UriSchemeHttps))
            {
                ShowBalloon(
                    "Endereço inválido",
                    "O baseUrl configurado não é uma URL http(s).",
                    ToolTipIcon.Error);
                return;
            }

            // A bandeja roda elevada (requireAdministrator). Abrir a URL pelo
            // explorer entrega a solicitação ao shell do usuário e evita um
            // navegador com privilégios administrativos.
            Process.Start("explorer.exe", $"\"{uri.AbsoluteUri}\"");
        }
        catch (Exception ex)
        {
            ShowBalloon("Não foi possível abrir o Nexus", ex.Message, ToolTipIcon.Error);
        }
    }

    private void OpenFolder(string path, string label)
    {
        try
        {
            if (string.IsNullOrWhiteSpace(path) || !Directory.Exists(path))
            {
                ShowBalloon(
                    "Pasta não encontrada",
                    $"A pasta de {label} não existe: {path}",
                    ToolTipIcon.Warning);
                return;
            }

            Process.Start("explorer.exe", $"\"{path}\"");
        }
        catch (Exception ex)
        {
            ShowBalloon("Não foi possível abrir a pasta", ex.Message, ToolTipIcon.Error);
        }
    }

    private async void RunBackup()
    {
        if (!_backupItem.Enabled)
        {
            return;
        }

        if (string.IsNullOrWhiteSpace(_config.BackupScript) || !File.Exists(_config.BackupScript))
        {
            ShowBalloon(
                "Backup não configurado",
                $"O script de backup não foi encontrado: {_config.BackupScript}",
                ToolTipIcon.Error);
            return;
        }

        _backupItem.Enabled = false;
        try
        {
            ProcessStartInfo startInfo = new(GetPowerShellPath())
            {
                UseShellExecute = false,
                CreateNoWindow = true,
                WindowStyle = ProcessWindowStyle.Hidden
            };
            startInfo.ArgumentList.Add("-NoProfile");
            startInfo.ArgumentList.Add("-ExecutionPolicy");
            startInfo.ArgumentList.Add("Bypass");
            startInfo.ArgumentList.Add("-File");
            startInfo.ArgumentList.Add(_config.BackupScript);

            using Process? process = Process.Start(startInfo);
            if (process is null)
            {
                ShowBalloon(
                    "Falha no backup",
                    "Não foi possível iniciar o script de backup.",
                    ToolTipIcon.Error);
                return;
            }

            ShowBalloon("Backup", "O backup foi iniciado em segundo plano.", ToolTipIcon.Info);
            await process.WaitForExitAsync();

            if (process.ExitCode == 0)
            {
                ShowBalloon("Backup concluído", "O backup foi gerado com sucesso.", ToolTipIcon.Info);
            }
            else
            {
                ShowBalloon(
                    "Falha no backup",
                    $"O script terminou com código {process.ExitCode}. Veja os logs.",
                    ToolTipIcon.Error);
            }
        }
        catch (Exception ex)
        {
            ShowBalloon("Falha no backup", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            _backupItem.Enabled = true;
        }
    }

    private static string GetPowerShellPath()
    {
        string system = Environment.GetFolderPath(Environment.SpecialFolder.System);
        string path = Path.Combine(system, "WindowsPowerShell", "v1.0", "powershell.exe");
        return File.Exists(path) ? path : "powershell.exe";
    }

    private void ShowBalloon(string title, string text, ToolTipIcon icon)
    {
        if (_disposed || !_notifyIcon.Visible)
        {
            return;
        }

        _notifyIcon.ShowBalloonTip(BalloonTimeoutMs, title, text, icon);
    }

    private void ExitApplication()
    {
        _timer.Stop();
        _notifyIcon.Visible = false;
        ExitThread();
    }

    protected override void Dispose(bool disposing)
    {
        if (disposing && !_disposed)
        {
            _disposed = true;
            Application.Idle -= OnFirstIdle;
            _timer.Stop();
            _timer.Dispose();
            _notifyIcon.Visible = false;
            _notifyIcon.Dispose();
            _menu.Dispose();
            _http.Dispose();

            _icon?.Dispose();
            if (_iconHandle != IntPtr.Zero)
            {
                DestroyIcon(_iconHandle);
                _iconHandle = IntPtr.Zero;
            }
        }

        base.Dispose(disposing);
    }

    [DllImport("user32.dll", SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool DestroyIcon(IntPtr handle);

    private enum TrayState
    {
        Green,
        Yellow,
        Red
    }

    private readonly record struct ServiceSnapshot(bool Running, string Text);

    private readonly record struct TraySnapshot(
        TrayState State,
        string ServiceText,
        string HealthText,
        string? Version);

    private readonly record struct HealthResult(
        bool Reachable,
        bool Ok,
        string? Versao,
        string Text)
    {
        public static HealthResult Unavailable(string text) => new(false, false, null, text);
    }

    private sealed class HealthPayload
    {
        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("db")]
        public bool? Db { get; set; }

        [JsonPropertyName("versao")]
        public string? Versao { get; set; }
    }
}
