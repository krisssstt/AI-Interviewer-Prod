$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path $taskRoot '.runtime'
New-Item -ItemType Directory -Force -Path $taskRuntime | Out-Null
$taskLog = Join-Path $taskRuntime 'system-install.log'
Start-Transcript -Path $taskLog -Append
try {
    $taskIdentity = [Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()
    if (-not $taskIdentity.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw 'Administrative token is required for Windows optional features.'
    }
    & dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
    & dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
    & winget.exe install --exact --id Microsoft.WSL --source winget --silent --accept-package-agreements --accept-source-agreements --disable-interactivity
    $taskInstaller = Join-Path $taskRuntime 'DockerDesktopInstaller.exe'
    if (Test-Path -LiteralPath $taskInstaller) {
        $taskSignature = Get-AuthenticodeSignature -LiteralPath $taskInstaller
        if ($taskSignature.Status -ne 'Valid' -or $taskSignature.SignerCertificate.Subject -notmatch 'Docker') {
            throw 'Docker installer signature verification failed.'
        }
        $taskInstallProcess = Start-Process -FilePath $taskInstaller -ArgumentList 'install','--quiet','--accept-license','--backend=wsl-2' -WindowStyle Hidden -Wait -PassThru
        Write-Output ('Docker installer exit code: ' + $taskInstallProcess.ExitCode)
    }
    Write-Output 'System setup attempted. No automatic restart was requested.'
} finally {
    Stop-Transcript
}
