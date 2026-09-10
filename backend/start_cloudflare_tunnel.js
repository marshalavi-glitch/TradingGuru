import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const hfToken = process.env.HF_TOKEN;
const hfSpaceRepo = `https://marshalavi:${hfToken}@huggingface.co/spaces/marshalavi/TradingGuru`;
const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
const rootDir = path.join(__dirname, '..');

console.log('🚀 Starting Cloudflare Tunnel daemon on http://localhost:3002...');

let currentTunnelUrl = null;

function publishToHuggingFace(tunnelUrl) {
  try {
    const jsonContent = JSON.stringify({
      backendUrl: tunnelUrl,
      timestamp: new Date().toISOString()
    }, null, 2);

    const jsonFilePath = path.join(rootDir, 'live_backend.json');
    fs.writeFileSync(jsonFilePath, jsonContent, 'utf8');

    console.log(`[HF Auto-Publisher] Saved live_backend.json: ${tunnelUrl}`);
    console.log('[HF Auto-Publisher] Pushing live_backend.json to Hugging Face Space...');

    execSync('git add live_backend.json', { cwd: rootDir, stdio: 'inherit' });
    execSync(`git commit -m "Auto-publish active Cloudflare Tunnel URL: ${tunnelUrl}"`, { cwd: rootDir, stdio: 'inherit' });
    execSync(`git push -f ${hfSpaceRepo} main`, { cwd: rootDir, stdio: 'inherit' });

    console.log('✅ [HF Auto-Publisher] Published live_backend.json to Hugging Face Space successfully!');
  } catch (err) {
    console.error('⚠️ [HF Auto-Publisher] Failed to push to Hugging Face:', err.message);
  }
}

function startTunnel() {
  const binary = fs.existsSync(cloudflaredPath) ? cloudflaredPath : 'cloudflared';
  const child = spawn(binary, ['tunnel', '--url', 'http://localhost:3002']);

  const handleData = (data) => {
    const text = data.toString();
    const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
    if (match) {
      const url = match[0];
      if (url !== currentTunnelUrl) {
        currentTunnelUrl = url;
        console.log('\n==================================================');
        console.log(`🎉 [Cloudflare Tunnel] Active URL: ${url}`);
        console.log('==================================================\n');
        publishToHuggingFace(url);
      }
    }
  };

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);

  child.on('close', (code) => {
    console.log(`⚠️ Cloudflare Tunnel exited with code ${code}. Reconnecting in 3s...`);
    setTimeout(startTunnel, 3000);
  });
}

startTunnel();

setInterval(() => {}, 1000);
