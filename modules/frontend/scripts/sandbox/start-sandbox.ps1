<#
.SYNOPSIS
    Runs verify-install.ps1 in Windows Sandbox: a clean Windows without
    developer tools, with networking disabled.

.DESCRIPTION
    Windows Sandbox must be enabled once, as an administrator, followed by a
    restart:

        Enable-WindowsOptionalFeature -Online -FeatureName Containers-DisposableClientVM -All

    This script writes a .wsb configuration that maps the installers and the
    verification script read-only, maps a results folder writable, disables
    networking and runs the verification when the sandbox signs in. Close the
    sandbox when results.json appears; everything inside it is discarded.

.EXAMPLE
    .\start-sandbox.ps1
#>
[CmdletBinding()]
param(
    [string] $Installer = (Join-Path $PSScriptRoot '..\..\dist\Storage-Analyzer-Setup-1.0.0-beta.1.exe'),
    [string] $UpdateInstaller = (Join-Path $PSScriptRoot '..\..\dist-update\Storage-Analyzer-Setup-1.0.0-beta.2.exe'),
    [string] $ResultsDir = (Join-Path $PSScriptRoot '..\..\dist\sandbox-results')
)

$ErrorActionPreference = 'Stop'
$sandbox = Join-Path $env:SystemRoot 'System32\WindowsSandbox.exe'
if (-not (Test-Path $sandbox)) {
    throw 'Windows Sandbox is not enabled. See Get-Help .\start-sandbox.ps1 for how to enable it.'
}
$Installer = (Resolve-Path $Installer).Path
$UpdateInstaller = (Resolve-Path $UpdateInstaller).Path
New-Item -ItemType Directory -Force $ResultsDir | Out-Null
$ResultsDir = (Resolve-Path $ResultsDir).Path
Remove-Item (Join-Path $ResultsDir '*') -Force -ErrorAction SilentlyContinue

$scripts = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$installers = Split-Path $Installer
$updates = Split-Path $UpdateInstaller
$command = 'powershell.exe -NoProfile -ExecutionPolicy Bypass -File C:\sa\scripts\verify-install.ps1' +
    " -Installer `"C:\sa\installer\$(Split-Path $Installer -Leaf)`"" +
    " -UpdateInstaller `"C:\sa\update\$(Split-Path $UpdateInstaller -Leaf)`"" +
    ' -ResultsDir C:\sa\results'

$wsb = @"
<Configuration>
  <Networking>Disable</Networking>
  <vGPU>Disable</vGPU>
  <ClipboardRedirection>Disable</ClipboardRedirection>
  <MappedFolders>
    <MappedFolder><HostFolder>$scripts</HostFolder><SandboxFolder>C:\sa\scripts</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$installers</HostFolder><SandboxFolder>C:\sa\installer</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$updates</HostFolder><SandboxFolder>C:\sa\update</SandboxFolder><ReadOnly>true</ReadOnly></MappedFolder>
    <MappedFolder><HostFolder>$ResultsDir</HostFolder><SandboxFolder>C:\sa\results</SandboxFolder><ReadOnly>false</ReadOnly></MappedFolder>
  </MappedFolders>
  <LogonCommand><Command>$command</Command></LogonCommand>
</Configuration>
"@
$configuration = Join-Path $env:TEMP 'storage-analyzer-verify.wsb'
Set-Content -Path $configuration -Value $wsb -Encoding UTF8
Start-Process $configuration
Write-Host "Sandbox started. Results will appear in $ResultsDir\results.json."
