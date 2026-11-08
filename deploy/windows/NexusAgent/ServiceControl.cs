using System.ServiceProcess;

namespace NexusAgent;

/// <summary>Controle dos serviços do Windows usados pelo agente.</summary>
public static class ServiceControl
{
    public static string GetStatus(string name)
    {
        try
        {
            using ServiceController controller = new(name);
            return controller.Status.ToString();
        }
        catch (InvalidOperationException)
        {
            return "missing";
        }
        catch (Exception)
        {
            return "unknown";
        }
    }

    public static void Stop(string name, TimeSpan timeout)
    {
        using ServiceController controller = new(name);
        if (controller.Status != ServiceControllerStatus.Stopped)
        {
            controller.Stop();
            controller.WaitForStatus(ServiceControllerStatus.Stopped, timeout);
        }
    }

    public static void Start(string name, TimeSpan timeout)
    {
        using ServiceController controller = new(name);
        if (controller.Status != ServiceControllerStatus.Running)
        {
            controller.Start();
            controller.WaitForStatus(ServiceControllerStatus.Running, timeout);
        }
    }

    /// <summary>Tenta religar o serviço; usado na recuperação de falhas.</summary>
    public static bool TryStart(string name, TimeSpan timeout)
    {
        try
        {
            Start(name, timeout);
            return true;
        }
        catch
        {
            return false;
        }
    }
}
