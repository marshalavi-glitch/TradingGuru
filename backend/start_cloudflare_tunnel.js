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
let currentChildProcess = null;
let isPublishing = false;

function killExistingCloudflared() {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM cloudflared.exe /T 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f cloudflared 2>/dev/null', { stdio: 'ignore' });
    }
  } catch (e) {}
}

async function publishToHuggingFace(tunnelUrl) {
  if (isPublishing) return;
  isPublishing = true;
  try {
    const jsonContent = JSON.stringify({
      backendUrl: tunnelUrl,
      timestamp: new Date().toISOString()
    }, null, 2);

    const jsonFilePath = path.join(rootDir, 'live_backend.json');
    fs.writeFileSync(jsonFilePath, jsonContent, 'utf8');

    console.log(`\n==================================================`);
    console.log(`🎉 [Cloudflare Tunnel] Active URL: ${tunnelUrl}`);
    console.log(`==================================================\n`);
    console.log(`[HF Auto-Publisher] Saved live_backend.json locally.`);

    if (hfToken) {
      console.log('[HF Auto-Publisher] Uploading live_backend.json directly via HF API...');
      const commitUrl = 'https://huggingface.co/api/spaces/marshalavi/TradingGuru/commit/main';
      const payload = {
        summary: `Auto-publish active Cloudflare Tunnel URL: ${tunnelUrl}`,
        files: [
          {
            path: 'live_backend.json',
            content: Buffer.from(jsonContent).toString('base64'),
            encoding: 'base64'
          }
        ]
      };

      const res = await fetch(commitUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${hfToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        console.log('✅ [HF Auto-Publisher] Direct HF API Upload Succeeded in <200ms!');
      } else {
        console.warn(`⚠️ [HF Auto-Publisher] Direct API upload status: ${res.status}, falling back to git push...`);
        execSync('git add live_backend.json', { cwd: rootDir, stdio: 'inherit' });
        try { execSync(`git commit -m "Auto-publish active Cloudflare Tunnel URL: ${tunnelUrl}"`, { cwd: rootDir, stdio: 'inherit' }); } catch (e) {}
        execSync(`git push -f ${hfSpaceRepo} main`, { cwd: rootDir, stdio: 'inherit' });
      }
    }
  } catch (err) {
    console.error('⚠️ [HF Auto-Publisher] Failed to publish live_backend.json:', err.message);
  } finally {
    isPublishing = false;
  }
}

function startTunnel() {
  killExistingCloudflared();
  currentTunnelUrl = null;

  const binary = fs.existsSync(cloudflaredPath) ? cloudflaredPath : 'cloudflared';
  console.log(`[Cloudflare Tunnel] Spawning binary: ${binary}`);
  
  const child = spawn(binary, ['tunnel', '--url', 'http://localhost:3002']);
  currentChildProcess = child;

  let buffer = '';

  const handleData = (data) => {
    const text = data.toString();
    buffer += text;

    if (!currentTunnelUrl) {
      const match = buffer.match(/(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/);
      if (match && match[1]) {
        const url = match[1];
        currentTunnelUrl = url;
        console.log(`[Cloudflare Tunnel] Active URL detected: ${url}`);
        publishToHuggingFace(url);
      }
    }
  };

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);

  child.on('close', (code) => {
    console.log(`⚠️ Cloudflare Tunnel exited with code ${code}. Reconnecting in 3s...`);
    currentTunnelUrl = null;
    currentChildProcess = null;
    setTimeout(startTunnel, 3000);
  });
}

// Local health monitor: verify localhost:3002 is alive
setInterval(async () => {
  try {
    const res = await fetch('http://localhost:3002/health', { signal: AbortSignal.timeout(3000) });
    if (!res.ok) {
      console.warn('⚠️ Backend on localhost:3002 returned non-200.');
    }
  } catch (e) {
    console.warn('⚠️ Backend on localhost:3002 unreachable:', e.message);
  }
}, 30000);

startTunnel();
