Option Explicit
' Reabre a bandeja do Nexus pela tarefa agendada (NexusTray), sem UAC.
' Não inicia os serviços: apenas abre a bandeja para o menu Iniciar Nexus.
On Error Resume Next
Dim shell
Set shell = CreateObject("WScript.Shell")
shell.Run "schtasks.exe /run /tn NexusTray", 0, False
