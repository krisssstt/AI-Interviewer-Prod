$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskRuntime = Join-Path $taskRoot '.runtime'
$taskExecutable = Join-Path $taskRuntime 'ollama/ollama.exe'
if (-not (Test-Path -LiteralPath $taskExecutable)) { throw 'Run bootstrap_ollama.py first.' }
if (Get-NetTCPConnection -LocalPort 11434 -State Listen -ErrorAction SilentlyContinue) {
    Write-Output 'Existing Ollama listener preserved.'
    exit 0
}
$env:OLLAMA_MODELS = Join-Path $taskRuntime 'models'
$env:OLLAMA_HOST = '127.0.0.1:11434'
$env:OLLAMA_MAX_LOADED_MODELS = '1'
$env:OLLAMA_NUM_PARALLEL = '1'
$taskProcess = Start-Process -FilePath $taskExecutable -ArgumentList 'serve' -WindowStyle Hidden -RedirectStandardOutput (Join-Path $taskRuntime 'ollama.stdout.log') -RedirectStandardError (Join-Path $taskRuntime 'ollama.stderr.log') -PassThru
Write-Output ('Ollama PID: ' + $taskProcess.Id)
