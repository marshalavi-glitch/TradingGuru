#!/usr/bin/env bash
# ==============================================================================
# TradingGuru Terminal & Algo Engine - Automated 1-Click Hostinger VPS Installer
# ==============================================================================

set -e

echo ""
echo "=========================================================="
echo "🚀 Starting 1-Click TradingGuru Setup on Hostinger VPS..."
echo "=========================================================="
echo ""

# 1. Update system & set Timezone to Asia/Kolkata (IST)
echo "⏰ [1/7] Setting Server Timezone to Indian Standard Time (IST)..."
export DEBIAN_FRONTEND=noninteractive
timedatectl set-timezone Asia/Kolkata || true
apt-get update -y
apt-get install -y curl git ufw nginx build-essential psmisc lsof

# 2. Install Node.js 20 LTS & PM2
echo "📦 [2/7] Installing Node.js 20 LTS and PM2..."
if ! command -v node &> /dev/null || [[ $(node -v) != v20* && $(node -v) != v22* ]]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm install -g pm2

# 3. Clone or Update TradingGuru Repository
echo "📂 [3/7] Downloading TradingGuru Codebase..."
mkdir -p /var/www
if [ -d "/var/www/tradingguru/.git" ]; then
  cd /var/www/tradingguru
  git reset --hard
  git pull origin main
else
  rm -rf /var/www/tradingguru
  git clone https://github.com/marshalavi-glitch/TradingGuru.git /var/www/tradingguru
fi

# 4. Setup Backend Environment (.env)
echo "🔑 [4/7] Configuring Angel One SmartAPI Credentials..."
cat << 'EOF' > /var/www/tradingguru/backend/.env
PORT=3002
NODE_ENV=production
ANGEL_API_KEY=1yxgn0n4
ANGEL_CLIENT_CODE=M307862
ANGEL_PASSWORD=5262
ANGEL_TOTP_SECRET=WICKROSIYOJJ7LMFMZOUCK7YNI
EOF
chmod 600 /var/www/tradingguru/backend/.env

# 5. Install Backend & Frontend Dependencies
echo "⚙️ [5/7] Installing Dependencies & Building Frontend..."
cd /var/www/tradingguru/backend
npm install --production --legacy-peer-deps

cd /var/www/tradingguru/frontend
npm install --legacy-peer-deps
npm run build

SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')
cat << EOF > /var/www/tradingguru/frontend/dist/live_backend.json
{
  "backendUrl": "http://${SERVER_IP}",
  "backupUrl": "http://${SERVER_IP}",
  "cloudflareUrl": "http://${SERVER_IP}",
  "localtunnelUrl": "http://${SERVER_IP}",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)"
}
EOF

# 6. Configure Nginx Web Server & WebSocket Proxy
echo "🌐 [6/7] Configuring Nginx Web Server & Real-time WebSockets..."

# Stop Coolify / Docker containers & proxy if pre-installed (frees up port 80 & 443)
echo "🛑 Reclaiming Port 80 & 443 from any conflicting services (Coolify, Docker, Traefik, Apache)..."
docker stop $(docker ps -aq) 2>/dev/null || true
docker kill $(docker ps -q) 2>/dev/null || true
systemctl stop coolify coolify-proxy docker containerd apache2 2>/dev/null || true
systemctl disable coolify coolify-proxy docker containerd apache2 2>/dev/null || true
killall -9 traefik 2>/dev/null || true
killall -9 apache2 2>/dev/null || true
fuser -k 80/tcp 2>/dev/null || true
fuser -k 443/tcp 2>/dev/null || true
sleep 1

cat << 'EOF' > /etc/nginx/sites-available/tradingguru
server {
    listen 80 default_server;
    server_name _;

    root /var/www/tradingguru/frontend/dist;
    index index.html;

    # Static Frontend Assets
    location / {
        try_files $uri $uri/ /index.html;
    }

    # REST API Proxy
    location /api/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Direct Health Check
    location /health {
        proxy_pass http://127.0.0.1:3002/health;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Real-Time WebSocket Proxy
    location /socket.io/ {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }

    # Direct WS Stream Route
    location /ws {
        proxy_pass http://127.0.0.1:3002;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_read_timeout 86400s;
        proxy_send_timeout 86400s;
    }
}
EOF

rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/tradingguru /etc/nginx/sites-enabled/tradingguru
systemctl unmask nginx 2>/dev/null || true
systemctl enable nginx 2>/dev/null || true
nginx -t
systemctl restart nginx

# 7. Start TradingGuru Engine with PM2 Auto-Restart
echo "🔄 [7/7] Launching TradingGuru Daemon with PM2..."
cd /var/www/tradingguru/backend
pm2 delete tradingguru || true
pm2 start server.js --name "tradingguru"
pm2 startup systemd -u root --hp /root || true
pm2 save

# Setup Firewall
ufw allow OpenSSH || true
ufw allow 'Nginx Full' || true
ufw --force enable || true

SERVER_IP=$(curl -s -4 ifconfig.me || hostname -I | awk '{print $1}')

echo ""
echo "=========================================================="
echo "🎉 DEPLOYMENT COMPLETE! YOUR TERMINAL IS LIVE 24/7!"
echo "=========================================================="
echo ""
echo "👉 Open your Dashboard in your browser:"
echo "   http://${SERVER_IP}"
echo ""
echo "⚙️ Management Commands:"
echo "   • Check Engine Status: pm2 status"
echo "   • View Live Logs:      pm2 logs tradingguru"
echo "   • Restart Engine:      pm2 restart tradingguru"
echo "=========================================================="
echo ""
