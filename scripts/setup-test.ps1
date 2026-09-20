$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$fixture = Join-Path $root ('.test-data\Source folder with spaces ' + [Guid]::NewGuid().ToString('N'))
foreach ($folder in @('src', 'electron', 'shared', 'scripts')) { New-Item -ItemType Directory -Path (Join-Path $fixture $folder) -Force | Out-Null }
foreach ($file in @('package.json', 'package-lock.json', 'index.html', 'tsconfig.json', 'vite.config.ts', 'scripts\build.mjs', 'src\App.tsx', 'electron\main.ts', 'shared\types.ts')) {
    Set-Content -LiteralPath (Join-Path $fixture $file) -Value 'fixture'
}
$helper = Join-Path $PSScriptRoot 'source-hash.ps1'
$before = & $helper -ProjectRoot $fixture
if ($before -ne (& $helper -ProjectRoot $fixture)) { throw 'Unchanged source should have a stable fingerprint.' }
$source = Join-Path $fixture 'src\App.tsx'
$stamp = (Get-Item -LiteralPath $source).LastWriteTimeUtc
Set-Content -LiteralPath $source -Value 'changed source'
(Get-Item -LiteralPath $source).LastWriteTimeUtc = $stamp
$changed = & $helper -ProjectRoot $fixture
if ($before -eq $changed) { throw 'Source edits must invalidate the build even with unchanged timestamps.' }
Set-Content -LiteralPath (Join-Path $fixture 'src\NewComponent.tsx') -Value 'new component'
if ($changed -eq (& $helper -ProjectRoot $fixture)) { throw 'New files must invalidate the build.' }
Write-Output 'PASS source fingerprint detects edits and new files, stays stable otherwise, and handles paths with spaces.'
