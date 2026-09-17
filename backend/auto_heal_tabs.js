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
  '/api/candles?symbol=NSE:NIFTY&timeframe=5&limit=2',
  '/api/scanner/results',
  '/api/scanner/confluences',
  '/api/scanner/early-picks',
  '/api/scanner/weekly-200-ema',
  '/api/scanner/opening-bias',
  '/api/doji-signals',
  '/api/volume-breakouts',
  '/api/nr7-breakouts',
  '/api/swing-scanner',
  '/api/manual-trades',
  '/api/options/chain?symbol=NSE:NIFTY'
];

async function checkEndpoints() {
  const baseUrl = 'http://localhost:3002';
  let passed = 0;
  let failed = 0;

  for (const ep of ENDPOINTS_TO_CHECK) {
    try {
      const res = await fetch(`${baseUrl}${ep}`, { signal: AbortSignal.timeout(4000) });
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
    const res = await angelOneBridge.getLtp('NSE', 'Nifty 50', '99926000');
    if (res && res.status && res.data && res.data.ltp) {
      console.log(`🩺 [Auto-Healer] Angel One SmartAPI session ACTIVE. Nifty 50 LTP: ₹${res.data.ltp}`);
    } else {
      const code = res?.errorcode || res?.message || 'Unknown';
      console.warn(`⚠️ [Auto-Healer] Angel One session check returned ${code}. Triggering re-authentication...`);
      const loginRes = await angelOneBridge.login();
      if (loginRes.success) {
        console.log(`✅ [Auto-Healer] Angel One session successfully recovered with fresh TOTP!`);
      } else {
        console.error(`❌ [Auto-Healer] Angel One re-login failed: ${loginRes.message}`);
      }
    }
  } catch (err) {
    console.warn(`⚠️ [Auto-Healer] Angel One check exception: ${err.message}. Attempting re-login...`);
    try {
      await angelOneBridge.login();
    } catch (e) {}
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
