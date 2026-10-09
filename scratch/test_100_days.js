import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function test100Days() {
  const BACKEND_URL = 'http://localhost:3002';
  const testSymbols = ['NSE:NIFTY', 'NSE:BANKNIFTY', 'NSE:RELIANCE', 'NSE:BPCL', 'NSE:TATASTEEL'];

  for (const sym of testSymbols) {
    const res = await fetch(`${BACKEND_URL}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=D&limit=130`);
    const data = await res.json();
    const candles = data.candles || [];
    console.log(`${sym}: fetched ${candles.length} daily candles.`);
    if (candles.length > 0) {
      const firstDate = new Date((candles[0].time + 19800) * 1000).toISOString().split('T')[0];
      const lastDate = new Date((candles[candles.length - 1].time + 19800) * 1000).toISOString().split('T')[0];
      console.log(`   From: ${firstDate} to ${lastDate}`);
    }
  }
}

test100Days().catch(console.error);
