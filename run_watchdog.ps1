# ==============================================================================
# Trading Guru - 24/7 Watchdog Script
# Keeps Node.js Backend Server & Cloudflare Tunnel running continuously
# ==============================================================================

$backendDir = "C:\Users\Admin-pc\Downloads\agents\backend"
$nodeExe = "C:\Users\Admin-pc\AppData\Local\ms-playwright-go\1.57.0\node.exe"

Write-Host "[INIT] Starting 24/7 Trading Guru Watchdog Manager..." -ForegroundColor Green

# Cleanup orphan processes on boot
Stop-Process -Name cloudflared -Force -ErrorAction SilentlyContinue
Get-Process -Name node -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*ms-playwright-go*" } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

function Start-BackendProcess {
    Write-Host "[BACKEND] Launching Node.js Backend Server on Port 3002..." -ForegroundColor Cyan
    return (Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden)
}

function Start-TunnelProcess {
    Write-Host "[TUNNEL] Launching Cloudflare Tunnel Auto-Publisher Daemon..." -ForegroundColor Cyan
    return (Start-Process -FilePath $nodeExe -ArgumentList "start_cloudflare_tunnel.js" -WorkingDirectory $backendDir -PassThru -WindowStyle Hidden)
}

$backendProc = Start-BackendProcess
Start-Sleep -Seconds 4
$tunnelProc = Start-TunnelProcess

while ($true) {
    Start-Sleep -Seconds 5

    if ($null -eq $backendProc -or $backendProc.HasExited) {
        Write-Host "[Watchdog Alert] Backend Server exited. Restarting now..." -ForegroundColor Yellow
        $backendProc = Start-BackendProcess
    }

    if ($null -eq $tunnelProc -or $tunnelProc.HasExited) {
        Write-Host "[Watchdog Alert] Cloudflare Tunnel Daemon exited. Restarting now..." -ForegroundColor Yellow
        $tunnelProc = Start-TunnelProcess
    }
}
