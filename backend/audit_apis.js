const urls = [
  'http://localhost:3002/health',
  'http://localhost:3002/api/scanner/opening-bias',
  'http://localhost:3002/api/scanner/doji',
  'http://localhost:3002/api/scanner/volume',
  'http://localhost:3002/api/scanner/weekly-200-ema',
  'http://localhost:3002/api/symbols/presets'
];

async function check() {
  console.log('=== RUNNING FULL API AUDIT ===');
  for (const u of urls) {
    try {
      const res = await fetch(u);
      console.log(`✅ [${res.status}] ${u}`);
    } catch (e) {
      console.error(`❌ [FAILED] ${u}:`, e.message);
    }
  }
}

check();
