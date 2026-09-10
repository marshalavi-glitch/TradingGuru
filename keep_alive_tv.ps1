# keep_alive_tv.ps1
# Keeps the TradingView Dashboard backend and Ngrok tunnel running silently in the background.

$baseDir = "C:\Users\mihir\.gemini\antigravity\scratch\tradingview-dashboard"
$backendDir = "$baseDir\backend"
$logFile = "$baseDir\keep_alive_tv.log"
$port = 3002

function Log-Message {
    param([string]$message)
    $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
    $logLine = "[$timestamp] $message"
    Write-Output $logLine
    Add-Content -Path $logFile -Value $logLine -ErrorAction SilentlyContinue
}

Log-Message "Keep-alive script started."

# Prevent duplicate instances of keep_alive_tv.ps1
$myPid = $PID
$otherInstances = Get-CimInstance Win32_Process -Filter "Name = 'powershell.exe'" | Where-Object {
    $_.CommandLine -like "*keep_alive_tv.ps1*" -and $_.CommandLine -notlike "*-Command *" -and $_.ProcessId -ne $myPid
}
if ($otherInstances) {
    $otherPids = ($otherInstances | Select-Object -ExpandProperty ProcessId) -join ", "
    Log-Message "Another instance of keep_alive_tv.ps1 is already running (PID: $otherPids). Exiting."
    exit
}

# Clean up any existing project-specific node or ngrok processes for Port 3002 for a fresh start
Log-Message "Cleaning up existing project-specific node and ngrok processes..."
$conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
if ($conn) {
    Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
}
Stop-Process -Name ngrok -Force -ErrorAction SilentlyContinue

$nodeFailures = 0
$ngrokFailures = 0

while ($true) {
    try {
        # 1. Check Node Backend Server
        $nodeProc = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*server.js*" -and $_.CommandLine -like "*tradingview-dashboard*" }
        $needStartNode = $false
        if ($null -eq $nodeProc) {
            $needStartNode = $true
            $nodeFailures = 0
        } else {
            # Active local health check
            try {
                $nodeHealth = Invoke-RestMethod -Uri "http://127.0.0.1:$port/health" -TimeoutSec 10 -ErrorAction Stop
                if ($nodeHealth.status -eq "OK") {
                    $nodeFailures = 0 # reset on success
                } else {
                    $nodeFailures++
                    Log-Message "Node TV local health check status not OK ($nodeFailures/3)."
                }
            } catch {
                $nodeFailures++
                Log-Message "Node TV local health check failed ($nodeFailures/3): $_"
            }

            if ($nodeFailures -ge 3) {
                Log-Message "Node TV backend failed 3 consecutive health checks. Restarting..."
                $needStartNode = $true
                $nodeProc | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
                $nodeFailures = 0
            }
        }
        
        if ($needStartNode) {
            Log-Message "Node TV backend server is not running. Starting..."
            try {
                if (Test-Path "$backendDir\out.log") { Remove-Item "$backendDir\out.log" -Force -ErrorAction SilentlyContinue }
                if (Test-Path "$backendDir\err.log") { Remove-Item "$backendDir\err.log" -Force -ErrorAction SilentlyContinue }
                
                Start-Process -FilePath "C:\Program Files\nodejs\node.exe" -ArgumentList "server.js --project=tradingview-dashboard" -WorkingDirectory $backendDir -RedirectStandardOutput "$backendDir\out.log" -RedirectStandardError "$backendDir\err.log" -WindowStyle Hidden -ErrorAction Stop
                Log-Message "Node TV backend server started successfully."
                Start-Sleep -Seconds 5
            } catch {
                Log-Message "Failed to start Node TV backend server: $_"
            }
        }

        # 2. Check Ngrok Tunnel
        $ngrokProc = Get-CimInstance Win32_Process -Filter "Name = 'ngrok.exe'"
        $needStartNgrok = $false
        if ($null -eq $ngrokProc) {
            $needStartNgrok = $true
            $ngrokFailures = 0
        } else {
            # Active Health Check via local ngrok api
            try {
                $ngrokHealth = Invoke-RestMethod -Uri "http://127.0.0.1:4040/api/tunnels" -TimeoutSec 5 -ErrorAction Stop
                if ($ngrokHealth.tunnels.Count -gt 0) {
                    $ngrokFailures = 0
                } else {
                    $ngrokFailures++
                    Log-Message "Ngrok has no active tunnels ($ngrokFailures/3)."
                }
            } catch {
                $ngrokFailures++
                Log-Message "Ngrok local API check failed ($ngrokFailures/3)."
            }

            if ($ngrokFailures -ge 3) {
                Log-Message "Ngrok failed 3 consecutive checks. Restarting..."
                $needStartNgrok = $true
                $ngrokProc | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
                $ngrokFailures = 0
            }
        }

        if ($needStartNgrok) {
            Log-Message "Ngrok tunnel is not running. Starting..."
            try {
                Start-Process -FilePath "C:\Users\mihir\AppData\Local\Programs\Python\Python313\Scripts\ngrok.exe" -ArgumentList "http 3002 --url=skimmer-savage-dipped.ngrok-free.dev" -WorkingDirectory $baseDir -WindowStyle Hidden -ErrorAction Stop
                Log-Message "Ngrok tunnel started successfully."
            } catch {
                Log-Message "Failed to start Ngrok tunnel: $_"
            }
        }
    } catch {
        Log-Message "Error in keep-alive loop: $_"
    }

    Start-Sleep -Seconds 15
}
