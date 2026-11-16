# Types a path into a native file dialog that a running Production One (or its LiveTest copy) opened, then presses Enter.
# Usage: powershell -ExecutionPolicy Bypass -File pick-dialog.ps1 "Open|project" "D:/films/my-film.pone"
# The first argument is a regular expression matched against the app window title while the dialog is up ("Choose image", "Open project", "Save project as").
param([string]$TitleRx, [string]$Path)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName Microsoft.VisualBasic
for ($i = 0; $i -lt 40; $i++) {
  $t = (Get-Process ProductionOne -ErrorAction SilentlyContinue | Select -First 1).MainWindowTitle
  if ($t -match $TitleRx) {
    Start-Sleep -Milliseconds 700
    [Microsoft.VisualBasic.Interaction]::AppActivate($t) | Out-Null
    Start-Sleep -Milliseconds 400
    [System.Windows.Forms.SendKeys]::SendWait($Path)
    Start-Sleep -Milliseconds 400
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
    Write-Output "typed into: $t"
    exit 0
  }
  Start-Sleep -Milliseconds 500
}
Write-Output 'no dialog'
exit 1
