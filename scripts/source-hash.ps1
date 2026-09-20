param([Parameter(Mandatory = $true)][string]$ProjectRoot)
$ErrorActionPreference = 'Stop'
$files = @()
foreach ($folder in @('src', 'electron', 'shared')) {
    $files += Get-ChildItem -LiteralPath (Join-Path $ProjectRoot $folder) -File -Recurse
}
foreach ($file in @('package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'scripts\build.mjs')) {
    $files += Get-Item -LiteralPath (Join-Path $ProjectRoot $file)
}
$manifest = ($files | Sort-Object FullName | ForEach-Object {
    $_.FullName.Substring($ProjectRoot.Length) + ':' + (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
}) -join "`n"
$hasher = [Security.Cryptography.SHA256]::Create()
try { [BitConverter]::ToString($hasher.ComputeHash([Text.Encoding]::UTF8.GetBytes($manifest))).Replace('-', '').ToLowerInvariant() }
finally { $hasher.Dispose() }
