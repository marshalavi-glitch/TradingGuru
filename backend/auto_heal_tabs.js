import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('🩺 [Auto-Healer] Initializing Tab & Endpoint Health Monitor Daemon (60s loop)...');

const ENDPOINTS_TO_CHECK = [
  '/health',
  '/api/online-users',
  '/api/market-indices',
  '/api/scanner/results',
  '/api/doji-signals',
  '/api/volume-breakouts',
  '/api/sr-breakouts',
  '/api/mp-3day-patterns',
  '/api/manual-trades'
];

async function checkEndpoints() {
  const baseUrl = 'http://localhost:3002';
  let passed = 0;
  let failed = 0;

  for (const ep of ENDPOINTS_TO_CHECK) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, { signal: AbortSignal.timeout(5000) });
      if (res.ok) {
        passed++;
      } else {
        failed++;
        console.warn(`⚠️ [Auto-Healer] Endpoint ${ep} returned HTTP ${res.status}`);
      }
    } catch (err) {
      failed++;
      console.warn(`⚠️ [Auto-Healer] Endpoint ${ep} failed: ${err.message}`);
    }
  }

  console.log(`🩺 [Auto-Healer] Endpoints Check: ${passed}/${ENDPOINTS_TO_CHECK.length} operational (${failed} failed)`);
}

async function checkAngelOneSession() {
  try {
    const res = await fetch('http://localhost:3002/api/angelone/status', { signal: AbortSignal.timeout(5000) });
    const data = await res.json();
    if (data && data.isLoggedIn) {
      console.log(`🩺 [Auto-Healer] Angel One SmartAPI session ACTIVE on server.`);
    } else {
      console.warn(`⚠️ [Auto-Healer] Angel One session not logged in.`);
    }
  } catch (err) {
    console.warn(`⚠️ [Auto-Healer] Angel One check exception: ${err.message}`);
  }
}

async function checkLiveBackendJson() {
  try {
    const jsonPath = path.join(__dirname, '../live_backend.json');
    if (fs.existsSync(jsonPath)) {
      const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      if (data && data.backendUrl) {
        if (data.backendUrl.startsWith('http://bore.pub') || data.backendUrl.includes('silly-papers-crash')) {
          console.warn(`⚠️ [Auto-Healer] Unstable or HTTP URL detected in live_backend.json (${data.backendUrl}). Waiting for Cloudflare tunnel...`);
        }
      }
    }
  } catch (e) {}
}

async function runAutoHealerCycle() {
  console.log(`\n=============================================================`);
  console.log(`🩺 [Auto-Healer Cycle] Running 60-second health check: ${new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`);
  console.log(`=============================================================`);
  await checkEndpoints();
  await checkAngelOneSession();
  await checkLiveBackendJson();
}

// Initial cycle
runAutoHealerCycle();

// 60-second recurring health loop
setInterval(runAutoHealerCycle, 60000);
