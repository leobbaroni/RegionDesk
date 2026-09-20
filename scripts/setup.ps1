param([ValidateSet('Setup', 'Launch')][string]$Mode = 'Setup')

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
# A launch from PowerShell 7 can inherit a module path without Windows PowerShell's modules.
$env:PSModulePath = (Join-Path $PSHOME 'Modules') + ';' + $env:PSModulePath
$projectRoot = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$nodeVersion = '22.22.0'
$nodeArchiveHash = 'c97fa376d2becdc8863fcd3ca2dd9a83a9f3468ee7ccf7a6d076ec66a645c77a'
$runtimeRoot = Join-Path $projectRoot ".tools\node-v$nodeVersion-win-x64"
$stateRoot = Join-Path $projectRoot '.setup'

function Test-NodeRuntime([string]$Candidate) {
    if (!$Candidate -or !(Test-Path -LiteralPath $Candidate)) { return $false }
    if (!(Test-Path -LiteralPath (Join-Path (Split-Path -Parent $Candidate) 'npm.cmd'))) { return $false }
    try {
        $versionText = & $Candidate --version 2>$null
        if ($LASTEXITCODE -ne 0 -or $versionText -notmatch '^v(\d+)\.(\d+)\.') { return $false }
        return ([int]$Matches[1] -eq 22 -and [int]$Matches[2] -ge 12) -or [int]$Matches[1] -ge 24
    } catch { return $false }
}

try {
    Set-Location -LiteralPath $projectRoot
    if (![Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') {
        throw 'This setup supports Windows x64.'
    }
    foreach ($required in @('package.json', 'package-lock.json', 'electron\main.ts', 'src\main.tsx')) {
        if (!(Test-Path -LiteralPath (Join-Path $projectRoot $required))) {
            throw "Missing $required. Keep Setup.bat and scripts together with the complete RegionDesk source folder. Extract the whole archive before running setup."
        }
    }
    Write-Host "RegionDesk - $Mode" -ForegroundColor Cyan
    Write-Host "App folder: $projectRoot"
    New-Item -ItemType Directory -Path $stateRoot -Force | Out-Null

    $nodeExe = Join-Path $runtimeRoot 'node.exe'
    if (!(Test-NodeRuntime $nodeExe)) {
        $installed = Get-Command node.exe -ErrorAction SilentlyContinue
        if ($installed -and (Test-NodeRuntime $installed.Source)) { $nodeExe = $installed.Source }
        else {
            Write-Host "Downloading portable Node.js $nodeVersion from nodejs.org..."
            [Net.ServicePointManager]::SecurityProtocol = [Net.ServicePointManager]::SecurityProtocol -bor [Net.SecurityProtocolType]::Tls12
            $toolsRoot = Join-Path $projectRoot '.tools'
            New-Item -ItemType Directory -Path $toolsRoot -Force | Out-Null
            $archivePath = Join-Path $toolsRoot "node-v$nodeVersion-win-x64.zip"
            Invoke-WebRequest -UseBasicParsing -Uri "https://nodejs.org/dist/v$nodeVersion/node-v$nodeVersion-win-x64.zip" -OutFile $archivePath
            if ((Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant() -ne $nodeArchiveHash) {
                throw 'The Node.js download failed its SHA-256 check. Setup stopped; run it again to retry.'
            }
            Expand-Archive -LiteralPath $archivePath -DestinationPath $toolsRoot -Force
            Remove-Item -LiteralPath $archivePath
            if (!(Test-NodeRuntime $nodeExe)) { throw 'The portable Node.js runtime could not start.' }
        }
    }
    $env:PATH = (Split-Path -Parent $nodeExe) + ';' + $env:PATH
    $npmCmd = Join-Path (Split-Path -Parent $nodeExe) 'npm.cmd'
    Write-Host "Using Node.js $(& $nodeExe --version): $nodeExe"

    $lockHash = (Get-FileHash -LiteralPath (Join-Path $projectRoot 'package-lock.json') -Algorithm SHA256).Hash
    $stampPath = Join-Path $stateRoot 'dependencies.sha256'
    $dependencyLog = Join-Path $stateRoot 'dependencies.log'
    $electronExe = Join-Path $projectRoot 'node_modules\electron\dist\electron.exe'
    $needsInstall = !(Test-Path -LiteralPath (Join-Path $projectRoot 'node_modules\electron\package.json'))
    if (!$needsInstall) {
        Write-Host 'Checking installed dependencies...'
        try {
            $ErrorActionPreference = 'Continue'
            & $npmCmd ls --depth=0 --include=dev *> $dependencyLog
            $needsInstall = $LASTEXITCODE -ne 0
        } finally { $ErrorActionPreference = 'Stop' }
    }
    if ((Test-Path -LiteralPath $stampPath) -and (Get-Content -LiteralPath $stampPath -Raw).Trim() -ne $lockHash) { $needsInstall = $true }
    if ($needsInstall) {
        Write-Host 'Installing locked app dependencies (this may take a few minutes)...'
        & $npmCmd ci --include=dev --no-audit --no-fund
        if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Check the message above and your internet connection, then run Setup.bat again.' }
    } else { Write-Host 'Dependencies already installed; skipping installation.' }
    if (!(Test-Path -LiteralPath $electronExe)) {
        Write-Host 'Downloading the Electron app runtime...'
        & $nodeExe (Join-Path $projectRoot 'node_modules\electron\install.js')
        if ($LASTEXITCODE -ne 0 -or !(Test-Path -LiteralPath $electronExe)) { throw 'The Electron download failed. Check your internet connection, then run Setup.bat again.' }
    }
    Set-Content -LiteralPath $stampPath -Value $lockHash -Encoding ASCII

    $built = (Test-Path -LiteralPath (Join-Path $projectRoot 'dist\index.html')) -and (Test-Path -LiteralPath (Join-Path $projectRoot 'dist-electron\main.cjs'))
    $sourceHash = & (Join-Path $PSScriptRoot 'source-hash.ps1') -ProjectRoot $projectRoot
    $buildStamp = Join-Path $stateRoot 'build.sha256'
    $sourceChanged = !(Test-Path -LiteralPath $buildStamp) -or (Get-Content -LiteralPath $buildStamp -Raw).Trim() -ne $sourceHash
    if ($Mode -eq 'Setup' -or $needsInstall -or !$built -or $sourceChanged) {
        Write-Host 'Building RegionDesk...'
        & $npmCmd run build
        if ($LASTEXITCODE -ne 0) { throw 'The app build failed. Fix the reported error, then run Setup.bat again.' }
        Set-Content -LiteralPath $buildStamp -Value $sourceHash -Encoding ASCII
    }
    if ($Mode -eq 'Launch') {
        Remove-Item Env:ELECTRON_RUN_AS_NODE, Env:REGIONDESK_DEV_URL, Env:REGIONDESK_TEST, Env:REGIONDESK_TEST_DATA -ErrorAction SilentlyContinue
        Start-Process -FilePath $electronExe -ArgumentList '.' -WorkingDirectory $projectRoot -WindowStyle Hidden
        Write-Host 'RegionDesk started.'
    } else {
        Write-Host ''
        Write-Host 'Setup complete. Double-click Start RegionDesk.bat in this folder.' -ForegroundColor Green
    }
    exit 0
} catch {
    Write-Host ''
    Write-Host "Setup failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
