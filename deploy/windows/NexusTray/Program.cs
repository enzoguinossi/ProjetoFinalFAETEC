using System.Threading;

namespace NexusTray;

internal static class Program
{
    private const string MutexName = @"Global\NexusTray";

    [STAThread]
    private static void Main()
    {
        using Mutex mutex = new(initiallyOwned: true, MutexName, out bool createdNew);
        if (!createdNew)
        {
            return;
        }

        try
        {
            ApplicationConfiguration.Initialize();

            using TrayApp app = new(TrayConfig.Load());
            Application.Run(app);
        }
        catch (Exception ex)
        {
            // Falha fatal e inesperada: registra localmente (sem segredos) em vez de
            // mostrar uma janela de erro. O polling trata falhas de rede/serviço.
            TryWriteCrashLog(ex);
        }

        GC.KeepAlive(mutex);
    }

    private static void TryWriteCrashLog(Exception exception)
    {
        try
        {
            string dir = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "NexusTray");
            Directory.CreateDirectory(dir);
            File.AppendAllText(
                Path.Combine(dir, "tray.log"),
                $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {exception}{Environment.NewLine}");
        }
        catch
        {
            // O log é auxiliar: nunca deve impedir o encerramento.
        }
    }
}
