param([string]$Executable = "$PSScriptRoot\..\release\RegionDesk-0.1.2-Windows\RegionDesk.exe")
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName UIAutomationClient
Add-Type -AssemblyName UIAutomationTypes
$started = Start-Process -FilePath (Resolve-Path -LiteralPath $Executable).Path -PassThru
$owned = [Collections.Generic.HashSet[int]]::new()
[void]$owned.Add($started.Id)
$deadline = (Get-Date).AddSeconds(45)
try {
  while ((Get-Date) -lt $deadline) {
    $processes = Get-CimInstance Win32_Process -Filter "Name LIKE 'RegionDesk%'"
    foreach ($candidate in $processes) {
      if ($owned.Contains([int]$candidate.ParentProcessId)) { [void]$owned.Add([int]$candidate.ProcessId) }
    }
    foreach ($processId in @($owned)) {
      $candidate = Get-Process -Id $processId -ErrorAction SilentlyContinue
      if (!$candidate) { continue }
      $windowHandle = $candidate.MainWindowHandle
      if ($windowHandle -eq [IntPtr]::Zero) { continue }
      $root = [System.Windows.Automation.AutomationElement]::FromHandle($windowHandle)
      $names = @($root.FindAll([System.Windows.Automation.TreeScope]::Descendants, [System.Windows.Automation.Condition]::TrueCondition) | ForEach-Object { $_.Current.Name })
      if ($candidate.MainWindowTitle -eq 'Error') { throw "Portable startup error: $($names -join ' | ')" }
      if ($names -contains 'Your regional workspace' -and $names -contains 'Verify connection' -and ($names -join ' ') -match 'Windows credential encryption available') {
        Write-Output 'PASS exact portable executable launched normally with sandbox enabled and rendered the regional workspace'
        return
      }
    }
    Start-Sleep -Milliseconds 400
  }
  throw 'Portable executable did not render the workspace within 45 seconds.'
} finally {
  foreach ($processId in @($owned)) {
    if ($processId -ne $started.Id) { Stop-Process -Id $processId -Force -ErrorAction SilentlyContinue }
  }
  if (!$started.WaitForExit(5000)) { Stop-Process -Id $started.Id -Force -ErrorAction SilentlyContinue }
}
