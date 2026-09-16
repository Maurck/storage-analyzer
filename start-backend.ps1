<#
.SYNOPSIS
    Starts the Storage Analyzer backend with the toolchain the project expects.

.DESCRIPTION
    Spring Boot 3.2.0 pins Lombok 1.18.30, which only runs on JDK 17. A newer JDK
    compiles without annotation processing and the build fails with "cannot find
    symbol" on every Lombok-generated accessor, so this script pins JAVA_HOME to
    the JDK 17 under .tools when that folder is present.

    .tools is gitignored local tooling. When it is missing the script falls back
    to JAVA_HOME (then java on PATH) and to the default Maven repository, so the
    first run downloads dependencies.

.PARAMETER Goal
    Maven goals to run. Defaults to spring-boot:run.

.PARAMETER Online
    Skips offline mode. Needed for goals whose plugins are not in .tools/m2,
    such as clean.

.PARAMETER Force
    Runs even when the detected JDK is not 17.

.EXAMPLE
    .\start-backend.ps1

.EXAMPLE
    .\start-backend.ps1 -Goal test

.EXAMPLE
    .\start-backend.ps1 -Goal clean,package -Online
#>
[CmdletBinding()]
param(
    [string[]] $Goal = @('spring-boot:run'),
    [switch] $Online,
    [switch] $Force
)

$ErrorActionPreference = 'Stop'

$root       = $PSScriptRoot
$backendDir = Join-Path $root 'modules\backend'
$toolsDir   = Join-Path $root '.tools'
$mvnw       = Join-Path $backendDir 'mvnw.cmd'

if (-not (Test-Path $mvnw)) {
    throw "Maven wrapper not found at $mvnw."
}

# --- JDK -------------------------------------------------------------------

$bundledJdk = Get-ChildItem -Path (Join-Path $toolsDir 'java17') -Filter 'jdk-*' -Directory -ErrorAction SilentlyContinue |
    Select-Object -First 1

if ($bundledJdk) {
    $javaHome = $bundledJdk.FullName
    $javaFrom = 'bundled in .tools'
} elseif ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME 'bin\java.exe'))) {
    $javaHome = $env:JAVA_HOME
    $javaFrom = 'JAVA_HOME'
} else {
    $onPath = Get-Command java.exe -ErrorAction SilentlyContinue
    if (-not $onPath) {
        throw 'No JDK found. Install a JDK 17 and set JAVA_HOME, or restore .tools/java17.'
    }
    $javaHome = Split-Path (Split-Path $onPath.Source -Parent) -Parent
    $javaFrom = 'PATH'
}

$javaExe = Join-Path $javaHome 'bin\java.exe'

# java -version writes to stderr, which a native command turns into terminating
# errors under ErrorActionPreference Stop. An unreadable version only skips the
# check below, so failures here are swallowed on purpose.
$versionText = ''
$previousPreference = $ErrorActionPreference
try {
    $ErrorActionPreference = 'Continue'
    $versionText = (& $javaExe '-version' 2>&1 | Out-String)
} catch {
    $versionText = ''
} finally {
    $ErrorActionPreference = $previousPreference
}

if ($versionText -match 'version "(\d+)') {
    $major = [int] $Matches[1]
    if ($major -ne 17 -and -not $Force) {
        throw @"
This JDK reports major version $major, but the backend needs 17.
Lombok 1.18.30 (pinned by Spring Boot 3.2.0) does not support newer JDKs: the
build fails with 'cannot find symbol' on every Lombok-generated accessor.
Install a JDK 17 and set JAVA_HOME, or pass -Force to try anyway.
"@
    }
}

# --- Maven -----------------------------------------------------------------

$mavenArgs = @('-B', '--no-transfer-progress')

$mavenUserHome = Join-Path $toolsDir 'maven-user'
if (Test-Path $mavenUserHome) {
    $env:MAVEN_USER_HOME = $mavenUserHome
}

$localRepo = Join-Path $toolsDir 'm2'
if (Test-Path $localRepo) {
    $mavenArgs += "-Dmaven.repo.local=$localRepo"
    if (-not $Online) {
        $mavenArgs += '-o'
        $repoFrom = "$localRepo (offline)"
    } else {
        $repoFrom = $localRepo
    }
} else {
    $repoFrom = 'default (first run downloads dependencies)'
}

$mavenArgs += $Goal

$env:JAVA_HOME = $javaHome

Write-Host "JDK   : $javaHome ($javaFrom)"
Write-Host "Repo  : $repoFrom"
Write-Host "Maven : mvnw.cmd $($mavenArgs -join ' ')"
if ($Goal -contains 'spring-boot:run') {
    Write-Host 'URL   : http://127.0.0.1:5000  (Ctrl+C to stop)'
}
Write-Host ''

Push-Location $backendDir
try {
    & $mvnw @mavenArgs
    $exitCode = $LASTEXITCODE
} finally {
    Pop-Location
}

exit $exitCode
