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

.PARAMETER ParentProcessId
    Stop once this process is gone. Electron passes its own id so that killing
    the desktop app never leaves the server holding port 5000.

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
    [switch] $Force,
    [int] $ParentProcessId = 0
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

# --- Shutdown --------------------------------------------------------------

# `spring-boot:run` forks its own JVM, so stopping Maven leaves the server
# holding port 5000. A job object fixes that at the operating-system level:
# Windows kills every process in the job once the last handle to it closes, and
# this script holds that handle, so the JVM dies even when the script is killed
# outright and no finally block ever runs.
Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

public static class ScanKillOnClose {
    [StructLayout(LayoutKind.Sequential)]
    struct BasicLimits {
        public long PerProcessUserTimeLimit;
        public long PerJobUserTimeLimit;
        public uint LimitFlags;
        public UIntPtr MinimumWorkingSetSize;
        public UIntPtr MaximumWorkingSetSize;
        public uint ActiveProcessLimit;
        public UIntPtr Affinity;
        public uint PriorityClass;
        public uint SchedulingClass;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct IoCounters {
        public ulong ReadOperationCount, WriteOperationCount, OtherOperationCount;
        public ulong ReadTransferCount, WriteTransferCount, OtherTransferCount;
    }

    [StructLayout(LayoutKind.Sequential)]
    struct ExtendedLimits {
        public BasicLimits BasicLimitInformation;
        public IoCounters IoInfo;
        public UIntPtr ProcessMemoryLimit;
        public UIntPtr JobMemoryLimit;
        public UIntPtr PeakProcessMemoryUsed;
        public UIntPtr PeakJobMemoryUsed;
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Unicode, SetLastError = true)]
    static extern IntPtr CreateJobObjectW(IntPtr attributes, string name);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool SetInformationJobObject(IntPtr job, int infoClass, IntPtr info, uint length);

    [DllImport("kernel32.dll", SetLastError = true)]
    static extern bool AssignProcessToJobObject(IntPtr job, IntPtr process);

    const int ExtendedLimitInformation = 9;
    const uint KillOnJobClose = 0x2000;

    // Held for the lifetime of the script: closing it is what kills the group.
    static IntPtr job = IntPtr.Zero;

    public static bool Create() {
        job = CreateJobObjectW(IntPtr.Zero, null);
        if (job == IntPtr.Zero) return false;
        ExtendedLimits limits = new ExtendedLimits();
        limits.BasicLimitInformation.LimitFlags = KillOnJobClose;
        int size = Marshal.SizeOf(typeof(ExtendedLimits));
        IntPtr buffer = Marshal.AllocHGlobal(size);
        try {
            Marshal.StructureToPtr(limits, buffer, false);
            return SetInformationJobObject(job, ExtendedLimitInformation, buffer, (uint)size);
        } finally {
            Marshal.FreeHGlobal(buffer);
        }
    }

    public static bool Add(IntPtr process) {
        return job != IntPtr.Zero && AssignProcessToJobObject(job, process);
    }
}
'@

$parentProcess = $null
if ($ParentProcessId -gt 0) {
    try {
        $parentProcess = [System.Diagnostics.Process]::GetProcessById($ParentProcessId)
    } catch {
        Write-Host "Parent process $ParentProcessId is already gone. Nothing to serve."
        exit 0
    }
}

$jobReady = $false
try {
    $jobReady = [ScanKillOnClose]::Create()
} catch {
    $jobReady = $false
}

# --- Run -------------------------------------------------------------------

$env:JAVA_HOME = $javaHome

Write-Host "JDK   : $javaHome ($javaFrom)"
Write-Host "Repo  : $repoFrom"
Write-Host "Maven : mvnw.cmd $($mavenArgs -join ' ')"
Write-Host "Stop  : $(if ($jobReady) { 'Ctrl+C, and the forked JVM is killed with this script' } else { 'Ctrl+C (job object unavailable; falling back to a process-tree kill)' })"
if ($Goal -contains 'spring-boot:run') {
    Write-Host 'URL   : http://127.0.0.1:5000'
}
Write-Host ''

# Start-Process needs one command line, and PowerShell 5.1 has no ArgumentList
# array for native processes, so arguments carrying spaces are quoted here.
$commandLine = ($mavenArgs | ForEach-Object {
    if ($_ -match '\s') { '"' + $_ + '"' } else { $_ }
}) -join ' '

$process = Start-Process -FilePath $mvnw -ArgumentList $commandLine `
    -WorkingDirectory $backendDir -NoNewWindow -PassThru

if ($jobReady) { [ScanKillOnClose]::Add($process.Handle) | Out-Null }

try {
    # Polling rather than WaitForExit so Ctrl+C reaches the finally block below.
    while (-not $process.HasExited) {
        if ($parentProcess -and $parentProcess.HasExited) {
            Write-Host "Parent process $ParentProcessId exited. Stopping the server."
            break
        }
        Start-Sleep -Milliseconds 150
    }
    if ($process.HasExited) { $exitCode = $process.ExitCode }
} finally {
    if (-not $process.HasExited) {
        # Reached on Ctrl+C. The job object covers a forced kill, but tearing the
        # tree down here shuts the server on the ordinary path too.
        & taskkill.exe /PID $process.Id /T /F 2>&1 | Out-Null
    }
    if ($null -eq $exitCode) { $exitCode = 130 }
}

exit $exitCode
