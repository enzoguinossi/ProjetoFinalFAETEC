using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Globalization;
using System.Net;
using System.Net.Http;
using System.Runtime.InteropServices;
using System.ServiceProcess;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;
using System.Windows.Forms;

namespace NexusTray;

internal sealed class TrayApp : ApplicationContext
{
    private const int PollIntervalMs = 20_000;
    private const int BalloonTimeoutMs = 5_000;
    private const int TooltipLimit = 63;

    // Símbolo do Nexus (public/logo.svg) embutido no executável.
    private const string LogoSymbolResource = "NexusTray.logo.svg";
    private const float LogoViewWidth = 72f;
    private const float LogoViewHeight = 80f;
    private const int IconSize = 32;
    private const float IconMargin = 1f;

    private static readonly Color GreenColor = Color.FromArgb(46, 158, 68);
    private static readonly Color YellowColor = Color.FromArgb(224, 161, 0);
    private static readonly Color RedColor = Color.FromArgb(214, 69, 69);
    private static readonly Color GrayColor = Color.FromArgb(128, 128, 128);

    private static readonly Regex LogoSymbolPathRegex = new(
        "\\sd=\"(?<data>[^\"]+)\"",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Regex LogoSymbolTokenRegex = new(
        @"([A-Za-z])|(-?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)",
        RegexOptions.Compiled | RegexOptions.CultureInvariant);

    private static readonly Lazy<IReadOnlyList<PointF[]>> LogoSymbol = new(LoadLogoSymbol);

    private readonly TrayConfig _config;
    private readonly HttpClient _http;
    private readonly NotifyIcon _notifyIcon;
    private readonly ContextMenuStrip _menu;
    private readonly ToolStripMenuItem _statusItem;
    private readonly ToolStripMenuItem _startItem;
    private readonly ToolStripMenuItem _stopItem;
    private readonly ToolStripMenuItem _openItem;
    private readonly ToolStripMenuItem _restartItem;
    private readonly ToolStripMenuItem _backupItem;
    private readonly ToolStripMenuItem _closeItem;
    private readonly System.Windows.Forms.Timer _timer;

    private Icon? _icon;
    private IntPtr _iconHandle = IntPtr.Zero;
    private TrayState? _iconState;
    private TrayState? _lastState;
    private TraySnapshot? _lastSnapshot;
    private bool _polling;
    private bool _operationInProgress;
    private bool _closing;
    private bool _disposed;

    public TrayApp(TrayConfig config)
    {
        _config = config;
        _http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

        _statusItem = new ToolStripMenuItem("Status: verificando…") { Enabled = false };

        _startItem = new ToolStripMenuItem("Iniciar Nexus");
        _startItem.Click += OnStartClick;

        _stopItem = new ToolStripMenuItem("Encerrar Nexus");
        _stopItem.Click += OnStopClick;

        _openItem = new ToolStripMenuItem("Abrir Nexus");
        _openItem.Click += (_, _) => OpenUrl(_config.BaseUrl);

        _restartItem = new ToolStripMenuItem("Reiniciar aplicação");
        _restartItem.Click += OnRestartClick;

        ToolStripMenuItem logsItem = new("Abrir logs");
        logsItem.Click += (_, _) => OpenFolder(_config.LogsDir, "logs");

        _backupItem = new ToolStripMenuItem("Fazer backup agora");
        _backupItem.Click += OnBackupClick;

        ToolStripMenuItem dataItem = new("Abrir pasta de dados");
        dataItem.Click += (_, _) => OpenFolder(_config.DataDir, "dados");

        _closeItem = new ToolStripMenuItem("Fechar bandeja");
        _closeItem.Click += OnCloseClick;

        _menu = new ContextMenuStrip();
        _menu.Items.AddRange(new ToolStripItem[]
        {
            _startItem,
            _stopItem,
            _openItem,
            _statusItem,
            new ToolStripSeparator(),
            _restartItem,
            _backupItem,
            logsItem,
            dataItem,
            new ToolStripSeparator(),
            _closeItem
        });

        _notifyIcon = new NotifyIcon
        {
            Text = "Nexus — verificando…",
            Visible = true,
            ContextMenuStrip = _menu
        };
        _notifyIcon.DoubleClick += OnTrayDoubleClick;

        SetStateIcon(TrayState.Red);
        UpdateMenuEnabled();

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

    private void OnTrayDoubleClick(object? sender, EventArgs e)
    {
        TraySnapshot snapshot = _lastSnapshot.GetValueOrDefault();
        bool ready = _lastSnapshot.HasValue
            && snapshot.Services.AllRunning
            && snapshot.Health.Ok;

        if (ready)
        {
            OpenUrl(_config.BaseUrl);
            return;
        }

        // Não abrir uma URL morta: oferece o menu para iniciar o Nexus.
        ShowBalloon(
            "Nexus",
            "O Nexus não está em execução. Use Iniciar Nexus no menu da bandeja.",
            ToolTipIcon.Info);
        _menu.Show(Cursor.Position);
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
            ServiceSet services = ReadServices();
            HealthResult health = services.App.Running
                ? await CheckHealthAsync()
                : HealthResult.Unavailable("—");

            // Estado antigo só vale quando os três serviços estão parados; se
            // algum estiver rodando, o estado real vence.
            bool stoppedState = services.AllStopped && ReadNexusStopped();

            TrayState state;
            if (stoppedState)
            {
                state = TrayState.Gray;
            }
            else if (!services.AllRunning || !health.Reachable)
            {
                state = TrayState.Red;
            }
            else
            {
                state = health.Ok ? TrayState.Green : TrayState.Yellow;
            }

            Apply(new TraySnapshot(state, services, health));
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
        _lastSnapshot = snapshot;

        SetStateIcon(snapshot.State);
        _notifyIcon.Text = Truncate(BuildTooltip(snapshot), TooltipLimit);
        _statusItem.Text = BuildStatus(snapshot);
        UpdateMenuEnabled();

        if (previous.HasValue && previous.Value != snapshot.State)
        {
            NotifyTransition(snapshot.State);
        }
    }

    private void UpdateMenuEnabled()
    {
        bool busy = _operationInProgress || _closing;
        bool hasSnapshot = _lastSnapshot.HasValue;
        TraySnapshot snapshot = _lastSnapshot.GetValueOrDefault();
        bool allRunning = hasSnapshot && snapshot.Services.AllRunning;
        bool healthOk = hasSnapshot && snapshot.Health.Ok;

        _startItem.Visible = !allRunning;
        _startItem.Enabled = !busy && hasSnapshot && !allRunning;
        _stopItem.Visible = hasSnapshot && allRunning;
        _stopItem.Enabled = !busy && allRunning;
        _openItem.Enabled = !busy && allRunning && healthOk;
        _restartItem.Enabled = !busy && allRunning;
        _backupItem.Enabled = !busy && allRunning;
        _closeItem.Enabled = !busy;
    }

    private static string BuildTooltip(TraySnapshot snapshot)
    {
        string stateText = snapshot.State switch
        {
            TrayState.Green => "em execução",
            TrayState.Yellow => "degradado",
            TrayState.Gray => "parado",
            _ => "fora do ar"
        };

        string text = "Nexus — " + stateText;
        string? version = NormalizeVersion(snapshot.Health.Versao);
        if (version is not null)
        {
            text += " · " + version;
        }

        return text;
    }

    private static string BuildStatus(TraySnapshot snapshot)
    {
        ServiceSet services = snapshot.Services;
        string version = NormalizeVersion(snapshot.Health.Versao) ?? "versão desconhecida";
        return $"Status: MySQL {services.Mysql.Text} · App {services.App.Text} · " +
               $"Caddy {services.Caddy.Text} · Banco {snapshot.Health.Text} · {version}";
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
                    "Um serviço ou o health check não está respondendo.",
                    ToolTipIcon.Error);
                break;
            case TrayState.Yellow:
                ShowBalloon(
                    "Nexus degradado",
                    "O serviço está ativo, mas o banco de dados não respondeu.",
                    ToolTipIcon.Warning);
                break;
            case TrayState.Gray:
                ShowBalloon(
                    "Nexus parado",
                    "Os serviços foram encerrados. Use Iniciar Nexus para subir de novo.",
                    ToolTipIcon.Info);
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

        (Icon? icon, IntPtr handle) = CreateIcon(state);
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

    private static (Icon? Icon, IntPtr Handle) CreateIcon(TrayState state)
    {
        Color color = state switch
        {
            TrayState.Green => GreenColor,
            TrayState.Yellow => YellowColor,
            TrayState.Gray => GrayColor,
            _ => RedColor
        };

        try
        {
            IReadOnlyList<PointF[]> shapes = LogoSymbol.Value;
            if (shapes.Count == 0)
            {
                // Recurso/parse indisponível: mantém o círculo e a bandeja de pé.
                return CreateCircleIcon(color);
            }

            using Bitmap bitmap = DrawLogoSymbol(shapes, color);
            IntPtr handle = bitmap.GetHicon();
            return (Icon.FromHandle(handle), handle);
        }
        catch (ExternalException)
        {
            // GDI+ pode falhar no .NET 10 (ExternalException); a bandeja não pode cair.
            return FallbackIcon();
        }
        catch (OutOfMemoryException)
        {
            return FallbackIcon();
        }
        catch (Exception)
        {
            return FallbackIcon();
        }
    }

    private static IReadOnlyList<PointF[]> LoadLogoSymbol()
    {
        try
        {
            using Stream? stream = typeof(TrayApp).Assembly
                .GetManifestResourceStream(LogoSymbolResource);
            if (stream is null)
            {
                return Array.Empty<PointF[]>();
            }

            using StreamReader reader = new(stream, Encoding.UTF8);
            string svg = reader.ReadToEnd();

            List<PointF[]> shapes = new();
            foreach (Match match in LogoSymbolPathRegex.Matches(svg))
            {
                PointF[] shape = ParseLogoSymbolPath(match.Groups["data"].Value);
                if (shape.Length >= 3)
                {
                    shapes.Add(shape);
                }
            }

            return shapes;
        }
        catch (Exception)
        {
            // Qualquer falha na leitura/parse do recurso cai no fallback circular.
            return Array.Empty<PointF[]>();
        }
    }

    private static PointF[] ParseLogoSymbolPath(string data)
    {
        // O símbolo usa apenas M, L, V, H e Z maiúsculos, sem curvas.
        MatchCollection tokens = LogoSymbolTokenRegex.Matches(data);
        List<PointF> points = new();
        int index = 0;
        char command = '\0';
        float x = 0f;
        float y = 0f;
        float startX = 0f;
        float startY = 0f;
        bool hasStart = false;

        float NextNumber()
        {
            if (index >= tokens.Count || !tokens[index].Groups[2].Success)
            {
                throw new FormatException("Número esperado no path do símbolo.");
            }

            string value = tokens[index].Groups[2].Value;
            index++;
            return float.Parse(value, NumberStyles.Float, CultureInfo.InvariantCulture);
        }

        while (index < tokens.Count)
        {
            Match token = tokens[index];
            if (token.Groups[1].Success)
            {
                command = token.Groups[1].Value[0];
                index++;
                if (command is not ('M' or 'L' or 'V' or 'H' or 'Z'))
                {
                    throw new NotSupportedException($"Comando '{command}' não suportado no símbolo.");
                }
            }
            else if (command is '\0' or 'Z')
            {
                throw new FormatException("Coordenada sem comando no path do símbolo.");
            }

            switch (command)
            {
                case 'M':
                    x = NextNumber();
                    y = NextNumber();
                    startX = x;
                    startY = y;
                    hasStart = true;
                    points.Add(new PointF(x, y));
                    // Pares seguintes a um M são tratados como L, conforme o SVG.
                    command = 'L';
                    break;
                case 'L':
                    x = NextNumber();
                    y = NextNumber();
                    points.Add(new PointF(x, y));
                    break;
                case 'H':
                    x = NextNumber();
                    points.Add(new PointF(x, y));
                    break;
                case 'V':
                    y = NextNumber();
                    points.Add(new PointF(x, y));
                    break;
                case 'Z':
                    if (!hasStart)
                    {
                        throw new FormatException("Z sem ponto inicial no path do símbolo.");
                    }

                    points.Add(new PointF(startX, startY));
                    break;
            }
        }

        return points.ToArray();
    }

    private static Bitmap DrawLogoSymbol(IReadOnlyList<PointF[]> shapes, Color color)
    {
        // Escala 72x80 para 32x32 preservando a proporção (~1 px de margem)
        // e centraliza o símbolo no bitmap transparente.
        float scale = Math.Min(
            (IconSize - (IconMargin * 2f)) / LogoViewWidth,
            (IconSize - (IconMargin * 2f)) / LogoViewHeight);
        float offsetX = (IconSize - (LogoViewWidth * scale)) / 2f;
        float offsetY = (IconSize - (LogoViewHeight * scale)) / 2f;

        Bitmap bitmap = new(IconSize, IconSize);
        using (Graphics graphics = Graphics.FromImage(bitmap))
        {
            graphics.SmoothingMode = SmoothingMode.AntiAlias;
            graphics.PixelOffsetMode = PixelOffsetMode.HighQuality;
            graphics.Clear(Color.Transparent);

            using SolidBrush brush = new(color);
            foreach (PointF[] shape in shapes)
            {
                PointF[] scaled = new PointF[shape.Length];
                for (int i = 0; i < shape.Length; i++)
                {
                    scaled[i] = new PointF(
                        offsetX + (shape[i].X * scale),
                        offsetY + (shape[i].Y * scale));
                }

                graphics.FillPolygon(brush, scaled);
            }
        }

        return bitmap;
    }

    private static (Icon? Icon, IntPtr Handle) CreateCircleIcon(Color color)
    {
        using Bitmap bitmap = new(IconSize, IconSize);
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

    private static (Icon? Icon, IntPtr Handle) FallbackIcon()
    {
        try
        {
            return ((Icon)SystemIcons.Application.Clone(), IntPtr.Zero);
        }
        catch
        {
            return (null, IntPtr.Zero);
        }
    }

    private ServiceSet ReadServices()
    {
        return new ServiceSet(
            ReadService(_config.MysqlService),
            ReadService(_config.ServiceName),
            ReadService(_config.CaddyService));
    }

    private static ServiceSnapshot ReadService(string name)
    {
        try
        {
            using ServiceController controller = new(name);
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

    private bool ReadNexusStopped()
    {
        try
        {
            if (string.IsNullOrWhiteSpace(_config.StateFile) || !File.Exists(_config.StateFile))
            {
                return false;
            }

            NexusStatePayload? state = JsonSerializer.Deserialize<NexusStatePayload>(
                File.ReadAllText(_config.StateFile));
            return state?.NexusStopped == true;
        }
        catch (Exception)
        {
            return false;
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

    private async void OnStartClick(object? sender, EventArgs e)
    {
        await StartNexusAsync();
    }

    private async void OnStopClick(object? sender, EventArgs e)
    {
        await StopNexusAsync();
    }

    private async void OnRestartClick(object? sender, EventArgs e)
    {
        await RestartServiceAsync();
    }

    private async void OnBackupClick(object? sender, EventArgs e)
    {
        await RunBackupAsync();
    }

    private async void OnCloseClick(object? sender, EventArgs e)
    {
        await CloseTrayAsync();
    }

    private async Task StartNexusAsync()
    {
        if (_operationInProgress || _closing)
        {
            return;
        }

        _operationInProgress = true;
        UpdateMenuEnabled();
        try
        {
            ShowBalloon("Nexus", "Iniciando os serviços do Nexus…", ToolTipIcon.Info);
            int exitCode = await RunScriptAsync(_config.StartScript, "iniciar o Nexus");
            if (exitCode == 0)
            {
                ShowBalloon("Nexus", "Serviços iniciados. Validando o health…", ToolTipIcon.Info);
            }
            else
            {
                ShowBalloon(
                    "Falha ao iniciar",
                    $"O script terminou com código {exitCode}. Veja os logs.",
                    ToolTipIcon.Error);
            }
        }
        catch (Exception ex)
        {
            ShowBalloon("Falha ao iniciar", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            _operationInProgress = false;
            UpdateMenuEnabled();
            _ = PollAfterAsync(TimeSpan.FromSeconds(2));
        }
    }

    private async Task StopNexusAsync()
    {
        if (_operationInProgress || _closing)
        {
            return;
        }

        DialogResult answer = MessageBox.Show(
            "Encerrar o Nexus? Isso vai parar o Node, o Caddy e o MySQL agora. " +
            "A bandeja continua aberta para iniciar de novo.",
            "Nexus - encerrar serviços",
            MessageBoxButtons.YesNo,
            MessageBoxIcon.Warning,
            MessageBoxDefaultButton.Button2);

        if (answer != DialogResult.Yes)
        {
            return;
        }

        _operationInProgress = true;
        UpdateMenuEnabled();
        try
        {
            ShowBalloon("Nexus", "Encerrando os serviços do Nexus…", ToolTipIcon.Info);
            int exitCode = await RunScriptAsync(_config.StopScript, "encerrar o Nexus");
            if (exitCode == 0)
            {
                ShowBalloon(
                    "Nexus encerrado",
                    "Os serviços foram parados. Use Iniciar Nexus para subir de novo.",
                    ToolTipIcon.Info);
            }
            else
            {
                ShowBalloon(
                    "Falha ao encerrar",
                    $"O script terminou com código {exitCode}. Veja os logs em {_config.LogsDir}.",
                    ToolTipIcon.Error);
            }
        }
        catch (Exception ex)
        {
            ShowBalloon("Falha ao encerrar", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            _operationInProgress = false;
            UpdateMenuEnabled();
            _ = PollAfterAsync(TimeSpan.FromSeconds(1));
        }
    }

    private async Task RestartServiceAsync()
    {
        if (_operationInProgress || _closing)
        {
            return;
        }

        _operationInProgress = true;
        UpdateMenuEnabled();
        try
        {
            ShowBalloon("Nexus", "Reiniciando a aplicação…", ToolTipIcon.Info);
            int exitCode = await RunScriptAsync(_config.RestartScript, "reiniciar a aplicação");
            if (exitCode == 0)
            {
                ShowBalloon("Nexus", "Aplicação reiniciada com sucesso.", ToolTipIcon.Info);
            }
            else
            {
                ShowBalloon(
                    "Falha ao reiniciar",
                    $"O script terminou com código {exitCode}. Veja os logs.",
                    ToolTipIcon.Error);
            }
        }
        catch (Exception ex)
        {
            ShowBalloon("Falha ao reiniciar", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            _operationInProgress = false;
            UpdateMenuEnabled();
            _ = PollAfterAsync(TimeSpan.FromSeconds(2));
        }
    }

    private async Task RunBackupAsync()
    {
        if (_operationInProgress || _closing)
        {
            return;
        }

        _operationInProgress = true;
        UpdateMenuEnabled();
        try
        {
            ShowBalloon("Backup", "O backup foi iniciado em segundo plano.", ToolTipIcon.Info);
            int exitCode = await RunScriptAsync(_config.BackupScript, "fazer o backup");
            if (exitCode == 0)
            {
                ShowBalloon("Backup concluído", "O backup foi gerado com sucesso.", ToolTipIcon.Info);
            }
            else
            {
                ShowBalloon(
                    "Falha no backup",
                    $"O script terminou com código {exitCode}. Veja os logs.",
                    ToolTipIcon.Error);
            }
        }
        catch (Exception ex)
        {
            ShowBalloon("Falha no backup", ex.Message, ToolTipIcon.Error);
        }
        finally
        {
            _operationInProgress = false;
            UpdateMenuEnabled();
            _ = PollAfterAsync(TimeSpan.FromSeconds(2));
        }
    }

    private async Task CloseTrayAsync()
    {
        if (_closing || _operationInProgress)
        {
            return;
        }

        _closing = true;
        UpdateMenuEnabled();
        try
        {
            ServiceSet services = ReadServices();
            if (services.AnyRunning)
            {
                DialogResult answer = MessageBox.Show(
                    "Fechar a bandeja e encerrar o Nexus? Isso vai parar o Node, o Caddy e o MySQL agora." +
                    Environment.NewLine + Environment.NewLine +
                    "Para abrir de novo, use o atalho Bandeja do Nexus na Área de Trabalho.",
                    "Nexus - fechar bandeja",
                    MessageBoxButtons.YesNo,
                    MessageBoxIcon.Warning,
                    MessageBoxDefaultButton.Button2);

                if (answer != DialogResult.Yes)
                {
                    return;
                }

                int exitCode = await RunScriptAsync(_config.StopScript, "encerrar o Nexus");
                if (exitCode != 0)
                {
                    MessageBox.Show(
                        $"O Nexus não foi encerrado (código {exitCode}). A bandeja continua aberta." +
                        Environment.NewLine + Environment.NewLine +
                        $"Veja os logs em {_config.LogsDir}.",
                        "Nexus - falha ao encerrar",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Error);
                    return;
                }
            }

            // Tudo parado (ou encerrado agora): fecha sem prompt.
            ExitApplication();
        }
        catch (Exception ex)
        {
            MessageBox.Show(
                $"Falha ao fechar a bandeja: {ex.Message}",
                "Nexus - falha ao fechar",
                MessageBoxButtons.OK,
                MessageBoxIcon.Error);
        }
        finally
        {
            _closing = false;
            if (!_disposed)
            {
                UpdateMenuEnabled();
            }
        }
    }

    private async Task<int> RunScriptAsync(string scriptPath, string action)
    {
        if (string.IsNullOrWhiteSpace(scriptPath) || !File.Exists(scriptPath))
        {
            ShowBalloon(
                "Script não encontrado",
                $"O script para {action} não foi encontrado: {scriptPath}",
                ToolTipIcon.Error);
            return -1;
        }

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
        startInfo.ArgumentList.Add(scriptPath);

        using Process? process = Process.Start(startInfo);
        if (process is null)
        {
            ShowBalloon(
                "Falha ao executar",
                $"Não foi possível iniciar o script para {action}.",
                ToolTipIcon.Error);
            return -1;
        }

        await process.WaitForExitAsync();
        return process.ExitCode;
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
        Red,
        Gray
    }

    private readonly record struct ServiceSnapshot(bool Running, string Text);

    private readonly record struct ServiceSet(
        ServiceSnapshot Mysql,
        ServiceSnapshot App,
        ServiceSnapshot Caddy)
    {
        public bool AllRunning => Mysql.Running && App.Running && Caddy.Running;

        public bool AnyRunning => Mysql.Running || App.Running || Caddy.Running;

        public bool AllStopped => !AnyRunning;
    }

    private readonly record struct TraySnapshot(
        TrayState State,
        ServiceSet Services,
        HealthResult Health);

    private readonly record struct HealthResult(
        bool Reachable,
        bool Ok,
        string? Versao,
        string Text)
    {
        public static HealthResult Unavailable(string text) => new(false, false, null, text);
    }

    private sealed class NexusStatePayload
    {
        [JsonPropertyName("nexusStopped")]
        public bool? NexusStopped { get; set; }
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
