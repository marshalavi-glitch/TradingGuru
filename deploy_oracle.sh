#!/bin/bash
# ==============================================================================
# Trading Guru - Oracle Cloud VM One-Click Deployment Script
# Supports: Oracle Linux 8/9, Ubuntu 20.04/22.04/24.04 on OCI (ARM64 / x86_64)
# ==============================================================================

set -e

echo "🚀 Starting Trading Guru Deployment on Oracle Cloud VM..."

# 1. Update package manager & Install Dependencies
if [ -f /etc/oracle-release ] || [ -f /etc/redhat-release ]; then
    echo "📦 Detected Oracle Linux / RHEL environment..."
    sudo dnf update -y
    sudo dnf install -y curl git firewalld
    curl -fsSL https://rpm.nodesource.com/setup_20.x | sudo bash -
    sudo dnf install -y nodejs
elif [ -f /etc/lsb-release ] || [ -f /etc/debian_version ]; then
    echo "📦 Detected Ubuntu / Debian environment..."
    sudo apt update && sudo apt upgrade -y
    sudo apt install -y curl git iptables ufw
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
    sudo apt install -y nodejs
fi

echo "✅ Node.js $(node -v) & npm $(npm -v) installed."

# 2. Install PM2 Globally
echo "📦 Installing PM2 Process Manager..."
sudo npm install -g pm2

# 3. Install Backend Dependencies
echo "⚙️ Installing Backend Dependencies..."
cd backend
npm install --production=false
cd ..

# 4. Build Frontend Assets
echo "⚙️ Building Frontend Production Assets..."
cd frontend
npm install
npm run build
cd ..

# 5. Configure Firewall Ports for Oracle VM
echo "🛡️ Configuring Oracle VM Security & Firewall Ports..."
if command -v ufw &> /dev/null; then
    sudo ufw allow 3002/tcp
    sudo ufw allow 80/tcp
    sudo ufw allow 443/tcp
fi

if command -v firewall-cmd &> /dev/null; then
    sudo firewall-cmd --permanent --add-port=3002/tcp
    sudo firewall-cmd --permanent --add-port=80/tcp
    sudo firewall-cmd --permanent --add-port=443/tcp
    sudo firewall-cmd --reload
fi

if command -v iptables &> /dev/null; then
    sudo iptables -I INPUT -p tcp --dport 3002 -j ACCEPT || true
    sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT || true
    sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT || true
    sudo netfilter-persistent save 2>/dev/null || true
fi

# 6. Start Server with PM2
echo "🔥 Starting Trading Guru Server via PM2..."
cd backend
PORT=3002 pm2 start server.js --name "trading-guru" --update-env
pm2 save
sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u $USER --hp $HOME || true

echo "=============================================================================="
echo "🎉 DEPLOYMENT COMPLETE!"
echo "STATUS: Trading Guru is live on http://$(curl -s ifconfig.me):3002"
echo "To view live logs:  pm2 logs trading-guru"
echo "To restart server: pm2 restart trading-guru"
echo "=============================================================================="
