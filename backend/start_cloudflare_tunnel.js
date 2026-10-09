import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import localtunnel from 'localtunnel';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env') });

const hfToken = process.env.HF_TOKEN;
const hfSpaceRepo = `https://marshalavi:${hfToken}@huggingface.co/spaces/marshalavi/TradingGuru-Terminal`;
const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
const rootDir = path.join(__dirname, '..');

console.log('🚀 Starting Dual-Engine (Cloudflare + Localtunnel) HTTPS Daemon for http://localhost:3002...');

let cloudflareUrl = null;
let localtunnelUrl = null;
let isPublishing = false;
let hasPendingPublish = false;
let ltInstance = null;

function killExistingTunnelProcesses() {
  try {
    if (process.platform === 'win32') {
      execSync('taskkill /F /IM cloudflared.exe /T 2>nul', { stdio: 'ignore' });
    } else {
      execSync('pkill -f cloudflared 2>/dev/null', { stdio: 'ignore' });
    }
  } catch (e) {}
}

async function publishToHuggingFace() {
  if (isPublishing) {
    hasPendingPublish = true;
    return;
  }

  const primary = cloudflareUrl || localtunnelUrl;
  const backup = localtunnelUrl || cloudflareUrl;
  if (!primary) return;

  isPublishing = true;
  hasPendingPublish = false;

  try {
    const jsonContent = JSON.stringify({
      backendUrl: primary,
      backupUrl: backup,
      cloudflareUrl: cloudflareUrl,
      localtunnelUrl: localtunnelUrl,
      timestamp: new Date().toISOString()
    }, null, 2);

    // Write to root, frontend/public, and frontend/dist
    const targetPaths = [
      path.join(rootDir, 'live_backend.json'),
      path.join(rootDir, 'frontend/public/live_backend.json'),
      path.join(rootDir, 'frontend/dist/live_backend.json')
    ];

    for (const p of targetPaths) {
      try {
        const dir = path.dirname(p);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(p, jsonContent, 'utf8');
      } catch (e) {}
    }

    console.log(`\n==================================================`);
    console.log(`🎉 [Live Dual-Tunnel] Primary: ${primary}`);
    console.log(`🎉 [Live Dual-Tunnel] Backup:  ${backup}`);
    console.log(`==================================================\n`);

    if (hfToken) {
      console.log('[HF Auto-Publisher] Uploading live_backend.json to HF Space...');
      const commitUrl = 'https://huggingface.co/api/spaces/marshalavi/TradingGuru-Terminal/commit/main';
      const payload = {
        summary: `Auto-publish active Tunnel URLs (Primary: ${primary})`,
        files: [
          {
            path: 'live_backend.json',
            content: Buffer.from(jsonContent).toString('base64'),
            encoding: 'base64'
          }
        ]
      };

      try {
        const res = await fetch(commitUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${hfToken}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload),
          signal: AbortSignal.timeout(10000)
        });

        if (res.ok) {
          console.log('✅ [HF Auto-Publisher] Direct HF API Upload Succeeded in <200ms!');
        } else {
          const errText = await res.text().catch(() => '');
          console.warn(`⚠️ [HF Auto-Publisher] Direct API returned ${res.status}: ${errText}`);
        }
      } catch (e) {
        console.warn('⚠️ [HF Auto-Publisher] Fetch error:', e.message);
      }
    }
  } catch (err) {
    console.error('⚠️ [HF Auto-Publisher] Failed to publish live_backend.json:', err.message);
  } finally {
    isPublishing = false;
    if (hasPendingPublish) {
      setTimeout(publishToHuggingFace, 500);
    }
  }
}

async function startLocaltunnel() {
  try {
    if (ltInstance) {
      try { ltInstance.close(); } catch (e) {}
      ltInstance = null;
    }
    console.log('[Localtunnel Engine] Launching HTTPS tunnel on port 3002...');
    const tunnel = await localtunnel({ port: 3002, local_host: '127.0.0.1' });
    ltInstance = tunnel;

    if (tunnel.url && tunnel.url.startsWith('http')) {
      const httpsUrl = tunnel.url.replace(/^http:\/\//, 'https://');
      localtunnelUrl = httpsUrl;
      console.log(`[Localtunnel Engine] Active HTTPS URL: ${httpsUrl}`);
      await publishToHuggingFace();

      tunnel.on('close', () => {
        console.warn('⚠️ Localtunnel closed. Reconnecting in 10s...');
        localtunnelUrl = null;
        setTimeout(startLocaltunnel, 10000);
      });
      tunnel.on('error', (err) => {
        console.warn('⚠️ Localtunnel error:', err.message);
      });
    }
  } catch (err) {
    console.warn('⚠️ Localtunnel failed to start, retrying in 15s:', err.message);
    setTimeout(startLocaltunnel, 15000);
  }
}

async function startCloudflareTunnel() {
  // Check if quicktunnel API is already running and healthy
  try {
    const res = await fetch('http://127.0.0.1:20241/quicktunnel', { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const data = await res.json();
      if (data && data.hostname) {
        cloudflareUrl = `https://${data.hostname}`;
        console.log(`[Cloudflare Engine] Reusing active quicktunnel: ${cloudflareUrl}`);
        await publishToHuggingFace();
        return;
      }
    }
  } catch (e) {}

  killExistingTunnelProcesses();
  cloudflareUrl = null;

  const binary = fs.existsSync(cloudflaredPath) ? cloudflaredPath : 'cloudflared';
  console.log(`[Cloudflare Engine] Spawning binary: ${binary}`);

  const child = spawn(binary, ['tunnel', '--url', 'http://localhost:3002']);
  let buffer = '';

  const handleData = (data) => {
    const text = data.toString();
    buffer += text;

    if (!cloudflareUrl) {
      const match = buffer.match(/(https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com)/);
      if (match && match[1]) {
        const url = match[1];
        cloudflareUrl = url;
        console.log(`[Cloudflare Engine] Active HTTPS URL: ${url}`);
        publishToHuggingFace();
      }
    }
  };

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);

  child.on('close', (code) => {
    console.warn(`⚠️ Cloudflare Tunnel exited with code ${code}. Reconnecting in 15s...`);
    cloudflareUrl = null;
    setTimeout(startCloudflareTunnel, 15000);
  });

  // Fast poll cloudflared's internal quicktunnel API
  const pollTimer = setInterval(async () => {
    if (cloudflareUrl) {
      clearInterval(pollTimer);
      return;
    }
    try {
      const res = await fetch('http://127.0.0.1:20241/quicktunnel', { signal: AbortSignal.timeout(1000) });
      if (res.ok) {
        const data = await res.json();
        if (data && data.hostname) {
          cloudflareUrl = `https://${data.hostname}`;
          console.log(`[Cloudflare Engine API] Active HTTPS URL detected: ${cloudflareUrl}`);
          publishToHuggingFace();
          clearInterval(pollTimer);
        }
      }
    } catch (e) {}
  }, 1000);
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

// Launch both engines concurrently for 100% redundancy
startCloudflareTunnel();
setTimeout(startLocaltunnel, 2000);



