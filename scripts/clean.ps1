param([switch]$Preview)
$ErrorActionPreference = 'Stop'
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..')).TrimEnd('\')
$manifest = Get-Content -LiteralPath (Join-Path $projectRoot 'package.json') -Raw | ConvertFrom-Json
if ($manifest.name -ne 'regiondesk' -or !(Test-Path -LiteralPath (Join-Path $projectRoot '.gitignore'))) { throw 'Run this script only from a complete RegionDesk project.' }
$keepDownload = "RegionDesk-$($manifest.version)-Setup.exe"
$targets = @((Join-Path $projectRoot '.test-data'))
$releaseRoot = Join-Path $projectRoot 'release'
if (Test-Path -LiteralPath $releaseRoot) {
    $targets += @(Get-ChildItem -LiteralPath $releaseRoot -Force | Where-Object {
        ($_.Name -match '^RegionDesk-\d+\.\d+\.\d+-(Windows(\.zip|\.exe)?|Setup\.exe(\.blockmap)?)$' -and $_.Name -ne $keepDownload) -or $_.Name -in @('win-unpacked', 'builder-debug.yml', 'latest.yml')
    } | ForEach-Object FullName)
}
$removed = 0L
foreach ($target in $targets) {
    if (!(Test-Path -LiteralPath $target)) { continue }
    $resolved = [IO.Path]::GetFullPath((Resolve-Path -LiteralPath $target).Path)
    if (!$resolved.StartsWith($projectRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Cleanup target is outside the project.' }
    $item = Get-Item -LiteralPath $resolved -Force
    $children = @(if ($item.PSIsContainer) { Get-ChildItem -LiteralPath $resolved -Recurse -Force })
    if (@($item) + $children | Where-Object { $_.Attributes -band [IO.FileAttributes]::ReparsePoint }) { throw "Cleanup stopped at a link: $resolved" }
    $bytes = if ($item.PSIsContainer) { ($children | Where-Object { !$_.PSIsContainer } | Measure-Object Length -Sum).Sum } else { $item.Length }
    Write-Host ("{0}: {1} ({2:N1} MB)" -f $(if ($Preview) { 'Would remove' } else { 'Removing' }), $resolved, ($bytes / 1MB))
    if (!$Preview) { Remove-Item -LiteralPath $resolved -Recurse -Force }
    $removed += $bytes
}
Write-Host ("{0:N1} MB {1}. Kept the current download, stable app folder, source, dependencies and saved user profiles." -f ($removed / 1MB), $(if ($Preview) { 'eligible for cleanup' } else { 'removed' }))
