# ==============================================================================
# Trading Guru - 24/7 Watchdog Script
# Keeps Node.js Backend Server & Cloudflare Tunnel running continuously
# ==============================================================================

$backendDir = "C:\Users\Admin-pc\Downloads\agents\backend"
$nodeExe = "C:\Users\Admin-pc\AppData\Local\ms-playwright-go\1.57.0\node.exe"

Write-Host "🚀 Starting 24/7 Trading Guru Watchdog Manager..." -ForegroundColor Green

function Start-BackendProcess {
    Write-Host "🔥 Launching Node.js Backend Server on Port 3002..." -ForegroundColor Cyan
    return Start-Process -FilePath $nodeExe -ArgumentList "server.js" -WorkingDirectory $backendDir -PassThru -NoNewWindow
}

function Start-TunnelProcess {
    Write-Host "🌐 Launching Cloudflare Tunnel Auto-Publisher Daemon..." -ForegroundColor Cyan
    return Start-Process -FilePath $nodeExe -ArgumentList "start_cloudflare_tunnel.js" -WorkingDirectory $backendDir -PassThru -NoNewWindow
}

$backendProc = Start-BackendProcess
Start-Sleep -Seconds 3
$tunnelProc = Start-TunnelProcess

while ($true) {
    Start-Sleep -Seconds 5

    if ($null -eq $backendProc -or $backendProc.HasExited) {
        Write-Host "⚠️ [Watchdog Alert] Backend Server exited. Restarting now..." -ForegroundColor Yellow
        $backendProc = Start-BackendProcess
    }

    if ($null -eq $tunnelProc -or $tunnelProc.HasExited) {
        Write-Host "⚠️ [Watchdog Alert] Cloudflare Tunnel Daemon exited. Restarting now..." -ForegroundColor Yellow
        $tunnelProc = Start-TunnelProcess
    }
}
