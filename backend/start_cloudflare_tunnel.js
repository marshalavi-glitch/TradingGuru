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
const hfSpaceRepo = `https://marshalavi:${hfToken}@huggingface.co/spaces/marshalavi/TradingGuru`;
const cloudflaredPath = path.join(__dirname, 'cloudflared.exe');
const rootDir = path.join(__dirname, '..');

console.log('🚀 Starting Cloudflare & HTTPS Multi-Engine Tunnel Daemon for http://localhost:3002...');

let currentTunnelUrl = null;
let currentChildProcess = null;
let isPublishing = false;
let consecutiveFailures = 0;

function killExistingTunnelProcesses() {
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
    console.log(`🎉 [Live Tunnel Engine] Active Public HTTPS URL: ${tunnelUrl}`);
    console.log(`==================================================\n`);
    console.log(`[HF Auto-Publisher] Saved live_backend.json locally.`);

    if (hfToken) {
      console.log('[HF Auto-Publisher] Uploading live_backend.json to HF...');
      const commitUrl = 'https://huggingface.co/api/spaces/marshalavi/TradingGuru/commit/main';
      const payload = {
        summary: `Auto-publish active Tunnel URL: ${tunnelUrl}`,
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
          body: JSON.stringify(payload)
        });

        if (res.ok) {
          console.log('✅ [HF Auto-Publisher] Direct HF API Upload Succeeded in <200ms!');
          return;
        } else {
          console.warn(`⚠️ [HF Auto-Publisher] Direct API returned ${res.status}, falling back to git push...`);
        }
      } catch (e) {
        console.warn('⚠️ [HF Auto-Publisher] Fetch error, falling back to git push:', e.message);
      }

      // Git push fallback
      try {
        execSync('git add live_backend.json', { cwd: rootDir, stdio: 'ignore' });
        try { execSync(`git commit -m "Auto-publish active Tunnel URL: ${tunnelUrl}"`, { cwd: rootDir, stdio: 'ignore' }); } catch (e) {}
        execSync(`git push -f ${hfSpaceRepo} main`, { cwd: rootDir, stdio: 'ignore' });
        console.log('✅ [HF Auto-Publisher] Git push succeeded!');
      } catch (gitErr) {
        console.error('❌ [HF Auto-Publisher] Git push failed:', gitErr.message);
      }
    }
  } catch (err) {
    console.error('⚠️ [HF Auto-Publisher] Failed to publish live_backend.json:', err.message);
  } finally {
    isPublishing = false;
  }
}

async function startLocaltunnelFallback() {
  console.log('[Localtunnel Fallback] Launching localtunnel over HTTPS on port 3002...');
  try {
    const tunnel = await localtunnel({ port: 3002, local_host: '127.0.0.1' });
    const url = tunnel.url;
    if (url && url.startsWith('http')) {
      const httpsUrl = url.replace(/^http:\/\//, 'https://');
      currentTunnelUrl = httpsUrl;
      console.log(`[Localtunnel Fallback] Active HTTPS URL detected: ${httpsUrl}`);
      await publishToHuggingFace(httpsUrl);
      
      tunnel.on('close', () => {
        console.warn('⚠️ Localtunnel closed. Reconnecting to primary Cloudflare tunnel...');
        currentTunnelUrl = null;
        setTimeout(startCloudflareTunnel, 5000);
      });
      tunnel.on('error', (err) => {
        console.warn('⚠️ Localtunnel error:', err.message);
      });
    }
  } catch (ltErr) {
    console.warn('⚠️ Localtunnel failed to start:', ltErr.message);
    setTimeout(startCloudflareTunnel, 15000);
  }
}

function startCloudflareTunnel() {
  killExistingTunnelProcesses();
  currentTunnelUrl = null;

  const binary = fs.existsSync(cloudflaredPath) ? cloudflaredPath : 'cloudflared';
  console.log(`[Cloudflare Engine] Spawning binary: ${binary}`);

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
        consecutiveFailures = 0;
        console.log(`[Cloudflare Engine] Active HTTPS URL detected: ${url}`);
        publishToHuggingFace(url);
      }
    }
  };

  child.stdout.on('data', handleData);
  child.stderr.on('data', handleData);

  child.on('close', (code) => {
    console.warn(`⚠️ Cloudflare Tunnel exited with code ${code}.`);
    currentTunnelUrl = null;
    currentChildProcess = null;
    consecutiveFailures++;

    if (consecutiveFailures >= 2) {
      console.log('⚠️ Cloudflare repeated exit, switching to Localtunnel HTTPS fallback...');
      startLocaltunnelFallback();
    } else {
      const delay = 15000;
      console.log(`Reconnecting Cloudflare Tunnel in ${delay / 1000}s...`);
      setTimeout(startCloudflareTunnel, delay);
    }
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

startCloudflareTunnel();

