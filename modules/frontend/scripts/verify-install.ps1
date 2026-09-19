<#
.SYNOPSIS
    Verifies the Windows installer end to end, without developer tools.

.DESCRIPTION
    Installs per user without elevation into a folder whose name has spaces and
    non-ASCII characters, starts the app with a PATH that holds no Node, Java or
    Maven, analyzes a generated fixture through the backend the app started,
    checks that a forced and a normal close leave no JVM behind, optionally
    updates to a second installer, and uninstalls, checking what remains.

    It only reads back its own fixture and aggregate numbers. It never scans or
    prints personal paths. Results are written as JSON to -ResultsDir.

    Run it on a clean machine (see scripts/sandbox) or, as a lesser check, on a
    development machine: the app's data folder is removed at the end either way.

.EXAMPLE
    .\verify-install.ps1 -Installer ..\dist\Storage-Analyzer-Setup-1.0.0-beta.1.exe `
        -UpdateInstaller ..\dist-update\Storage-Analyzer-Setup-1.0.0-beta.2.exe
#>
[CmdletBinding()]
param(
    [Parameter(Mandatory)] [string] $Installer,
    [string] $UpdateInstaller,
    [string] $InstallDir,
    [string] $ResultsDir = (Join-Path $env:TEMP 'storage-analyzer-verify')
)

$ErrorActionPreference = 'Stop'
# Built from code points so the script reads the same in any code page.
$nonAscii = -join ([char]0x00F1, [char]0x00E1)            # "ñá"
$unicode = -join ([char]0x5199, [char]0x771F)             # "写真"
if (-not $InstallDir) {
    $InstallDir = Join-Path $env:LOCALAPPDATA "Programs\Storage Analyzer beta $nonAscii"
}
$appExe = Join-Path $InstallDir 'Storage Analyzer.exe'
$javaExe = Join-Path $InstallDir 'resources\runtime\bin\java.exe'
$uninstaller = Join-Path $InstallDir 'Uninstall Storage Analyzer.exe'
$userData = Join-Path $env:APPDATA 'Storage Analyzer'
$startShortcut = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Storage Analyzer.lnk'
$desktopShortcut = Join-Path ([Environment]::GetFolderPath('Desktop')) 'Storage Analyzer.lnk'
$api = 'http://127.0.0.1:5000'
$results = [ordered]@{}
$failures = 0

function Step([string] $name, [scriptblock] $check) {
    try {
        $detail = & $check
        $results[$name] = @{ ok = $true; detail = "$detail" }
        Write-Host "PASS  $name  $detail"
    } catch {
        $script:failures++
        $results[$name] = @{ ok = $false; detail = $_.Exception.Message }
        Write-Host "FAIL  $name  $($_.Exception.Message)"
    }
}

function Wait-Until([scriptblock] $condition, [int] $seconds, [string] $what) {
    $deadline = (Get-Date).AddSeconds($seconds)
    while ((Get-Date) -lt $deadline) {
        if (& $condition) { return }
        Start-Sleep -Milliseconds 250
    }
    throw "Timed out after $seconds s waiting for $what."
}

function Test-Health {
    try { (Invoke-RestMethod "$api/health" -TimeoutSec 2).application -eq 'storage-analyzer' } catch { $false }
}

function Get-AppProcesses {
    Get-CimInstance Win32_Process | Where-Object { $_.ExecutablePath -and $_.ExecutablePath.StartsWith($InstallDir, [StringComparison]::OrdinalIgnoreCase) }
}

function Get-InstalledJava {
    Get-AppProcesses | Where-Object { $_.Name -eq 'java.exe' }
}

function Start-App {
    # A PATH with nothing but Windows itself, and no JAVA_HOME: the app must
    # bring everything it needs.
    $info = New-Object System.Diagnostics.ProcessStartInfo $appExe
    $info.UseShellExecute = $false
    $info.EnvironmentVariables['PATH'] = "$env:SystemRoot\System32;$env:SystemRoot;$env:SystemRoot\System32\WindowsPowerShell\v1.0"
    foreach ($name in 'JAVA_HOME', 'JDK_HOME', 'MAVEN_HOME', 'M2_HOME', 'NODE_PATH', 'STORAGE_ANALYZER_API_URL') {
        $info.EnvironmentVariables.Remove($name)
    }
    $started = [System.Diagnostics.Process]::Start($info)
    $clock = [Diagnostics.Stopwatch]::StartNew()
    Wait-Until { Test-Health } 120 'the backend to answer'
    return @{ process = $started; readyMs = $clock.ElapsedMilliseconds }
}

function Get-MainProcess {
    $all = @(Get-AppProcesses | Where-Object { $_.Name -eq 'Storage Analyzer.exe' })
    $ids = $all | ForEach-Object ProcessId
    $all | Where-Object { $ids -notcontains $_.ParentProcessId } | Select-Object -First 1
}

# Windows PowerShell reads JSON without a charset as ISO-8859-1; JSON is UTF-8.
function Get-Json([string] $uri) {
    $response = Invoke-WebRequest -Uri $uri -UseBasicParsing -TimeoutSec 10
    [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) | ConvertFrom-Json
}

function Send-Json([string] $uri, $body) {
    $bytes = [Text.Encoding]::UTF8.GetBytes(($body | ConvertTo-Json -Compress))
    $response = Invoke-WebRequest -Method Post -Uri $uri -UseBasicParsing -ContentType 'application/json; charset=utf-8' -Body $bytes
    [Text.Encoding]::UTF8.GetString($response.RawContentStream.ToArray()) | ConvertFrom-Json
}

New-Item -ItemType Directory -Force $ResultsDir | Out-Null
$results['machine'] = @{
    ok = $true
    detail = "Windows $([Environment]::OSVersion.Version); dev tools on PATH: java=$([bool](Get-Command java -ErrorAction SilentlyContinue)) node=$([bool](Get-Command node -ErrorAction SilentlyContinue)) mvn=$([bool](Get-Command mvn -ErrorAction SilentlyContinue))"
}

Step 'port 5000 is free before installing' {
    if (Test-Health) { throw 'A backend already answers on port 5000; stop it first.' }
    if (Get-NetTCPConnection -LocalPort 5000 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 5000 is in use.' }
    'free'
}

Step 'installs per user without elevation' {
    $clock = [Diagnostics.Stopwatch]::StartNew()
    # NSIS wants /D last and unquoted, even with spaces.
    $setup = Start-Process -FilePath $Installer -ArgumentList '/S', "/D=$InstallDir" -PassThru -Wait
    if ($setup.ExitCode -ne 0) { throw "Installer exit code $($setup.ExitCode)." }
    if (-not (Test-Path $appExe)) { throw "No app at $appExe." }
    if (-not (Test-Path $javaExe)) { throw 'No bundled Java runtime.' }
    if (-not (Test-Path $startShortcut)) { throw 'No Start menu shortcut.' }
    if (-not (Test-Path $desktopShortcut)) { throw 'No desktop shortcut.' }
    "$([math]::Round($clock.Elapsed.TotalSeconds))s, $([math]::Round((Get-ChildItem $InstallDir -Recurse -File | Measure-Object Length -Sum).Sum / 1MB)) MiB installed"
}

$version1 = (Get-Item $appExe -ErrorAction SilentlyContinue).VersionInfo.FileVersion

Step 'starts its bundled backend without developer tools' {
    $script:run = Start-App
    $java = @(Get-InstalledJava)
    if ($java.Count -ne 1) { throw "Expected one bundled JVM, found $($java.Count)." }
    $capacity = Invoke-RestMethod "$api/capacity"
    "ready in $([math]::Round($run.readyMs / 1000, 1))s; java=$($java[0].ExecutablePath.Substring($InstallDir.Length)); capacity=$($capacity.maxEntries) entries"
}

$fixture = Join-Path $env:TEMP "sa-verify $nonAscii $unicode"
Step 'analyzes a folder with spaces and non-ASCII names' {
    Remove-Item $fixture -Recurse -Force -ErrorAction SilentlyContinue
    $deep = New-Item -ItemType Directory -Force (Join-Path $fixture "a\b\c\d\e\f $unicode")
    $target = Join-Path $deep "objetivo $nonAscii.bin"
    [IO.File]::WriteAllBytes($target, (New-Object byte[] (3MB)))
    foreach ($side in 'left', 'right') {
        $folder = New-Item -ItemType Directory -Force (Join-Path $fixture $side)
        [IO.File]::WriteAllBytes((Join-Path $folder 'copy.bin'), (New-Object byte[] (1MB)))
    }
    $scan = Send-Json "$api/scans" @{ path = $fixture }
    Wait-Until { (Get-Json "$api/scans/$($scan.id)").status -ne 'SCANNING' } 60 'the scan'
    $status = Get-Json "$api/scans/$($scan.id)"
    if ($status.status -ne 'COMPLETE') { throw "Scan ended as $($status.status) ($($status.errorCode))." }
    $largest = Get-Json "$api/scans/$($scan.id)/largest?limit=10"
    if ($largest.files[0].absolutePath -ne $target) { throw "Unexpected first file: $($largest.files[0].name)" }
    "$($status.processedFiles) files; first ranked is the deep file"
}

Step 'a killed app leaves no JVM behind' {
    $main = Get-MainProcess
    if (-not $main) { throw 'App main process not found.' }
    Stop-Process -Id $main.ProcessId -Force
    Wait-Until { @(Get-InstalledJava).Count -eq 0 } 20 'the JVM to exit'
    Wait-Until { -not (Test-Health) } 10 'port 5000 to close'
    Wait-Until { @(Get-AppProcesses).Count -eq 0 } 20 'the app processes to exit'
    'JVM and app processes gone'
}

Step 'a normal close stops the backend' {
    $null = Start-App
    $main = Get-MainProcess
    $handle = [System.Diagnostics.Process]::GetProcessById($main.ProcessId)
    Wait-Until { $handle.Refresh(); $handle.MainWindowHandle -ne 0 } 20 'the window'
    if (-not $handle.CloseMainWindow()) { throw 'The window did not accept the close request.' }
    Wait-Until { @(Get-AppProcesses).Count -eq 0 } 30 'the app and JVM to exit'
    'app and JVM exited'
}

Step 'keeps a bounded backend log in its data folder' {
    $log = Join-Path $userData 'logs\backend.log'
    if (-not (Test-Path $log)) { throw "No log at $log." }
    "$([math]::Round((Get-Item $log).Length / 1KB)) KiB"
}

if ($UpdateInstaller) {
    Step 'updates in place and keeps the data folder' {
        $marker = Join-Path $userData 'verify-marker.txt'
        Set-Content -Path $marker -Value 'kept across updates'
        $setup = Start-Process -FilePath $UpdateInstaller -ArgumentList '/S', "/D=$InstallDir" -PassThru -Wait
        if ($setup.ExitCode -ne 0) { throw "Update exit code $($setup.ExitCode)." }
        $version2 = (Get-Item $appExe).VersionInfo.FileVersion
        if ($version2 -eq $version1) { throw "Version did not change ($version2)." }
        if (-not (Test-Path $marker)) { throw 'The data folder was not kept.' }
        $null = Start-App
        $main = Get-MainProcess
        Stop-Process -Id $main.ProcessId -Force
        Wait-Until { @(Get-AppProcesses).Count -eq 0 } 30 'the updated app to exit'
        "$version1 -> $version2; data kept; updated app starts"
    }
}

Step 'uninstalls and removes app and data' {
    Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait
    Wait-Until { -not (Test-Path $appExe) } 60 'the app files to be removed'
    Wait-Until { -not (Test-Path $userData) } 30 'the data folder to be removed'
    $left = @(Get-ChildItem $InstallDir -Recurse -ErrorAction SilentlyContinue).Count
    if (Test-Path $startShortcut) { throw 'The Start menu shortcut remains.' }
    if (Test-Path $desktopShortcut) { throw 'The desktop shortcut remains.' }
    "files left in install folder: $left; shortcuts removed"
}

Remove-Item $fixture -Recurse -Force -ErrorAction SilentlyContinue
$summary = [ordered]@{ passed = $failures -eq 0; failures = $failures; steps = $results }
$summary | ConvertTo-Json -Depth 4 | Set-Content -Path (Join-Path $ResultsDir 'results.json') -Encoding UTF8
Write-Host ''
Write-Host "$(if ($failures -eq 0) { 'All checks passed.' } else { "$failures check(s) failed." }) Results: $(Join-Path $ResultsDir 'results.json')"
exit $failures
