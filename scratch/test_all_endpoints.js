const BASE = 'http://localhost:3002';

const endpoints = [
  // Auth & System
  '/api/auth/session-control',
  '/api/online-users',
  '/api/symbols/presets',
  '/api/search?query=NIFTY',
  '/api/market-indices',
  
  // Scanners & Breakouts
  '/api/sr-breakouts',
  '/api/sr-breakouts/live-quotes',
  '/api/sr-breakouts/backtest',
  '/api/value-breakouts',
  '/api/volume-breakouts',
  '/api/nr7-breakouts',
  '/api/swing-scanner?timeframe=D',
  '/api/scanner/results?timeframe=5',
  '/api/scanner/opening-bias',
  '/api/scanner/early-picks?threshold=1.5',
  '/api/doji-signals?slot=9:15',
  '/api/mp-3day-patterns/results',
  '/api/candlestick-patterns/results?timeframe=5',
  
  // Trades & Orderflow
  '/api/manual-trades',
  '/api/orderflow/state?symbol=NIFTYFUT&timeframe=5',
  '/api/candles?symbol=NSE:NIFTY&timeframe=5&limit=10',
  '/api/orderflow/profile?symbol=NIFTYFUT',
  '/api/options-chain?symbol=NIFTY'
];

async function run() {
  console.log(`Testing ${endpoints.length} endpoints against ${BASE}...\n`);
  for (const ep of endpoints) {
    try {
      const res = await fetch(`${BASE}${ep}`);
      const text = await res.text();
      let isJson = false;
      let data = null;
      try {
        data = JSON.parse(text);
        isJson = true;
      } catch (e) {}

      if (!res.ok) {
        console.log(`❌ [HTTP ${res.status}] ${ep}`);
        if (text.length < 200) console.log(`   Response: ${text}`);
      } else if (!isJson) {
        console.log(`⚠️ [NON-JSON ${res.status}] ${ep} (length: ${text.length})`);
      } else {
        const preview = Array.isArray(data) ? `Array(${data.length})` : typeof data === 'object' ? Object.keys(data).slice(0, 4).join(', ') : data;
        console.log(`✅ [OK] ${ep} -> ${preview}`);
      }
    } catch (err) {
      console.log(`💥 [ERROR] ${ep}: ${err.message}`);
    }
  }
}

run();
