import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';

async function check() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Fetching Nifty Spot candles for today...');
  try {
    const spotCandles = await fetchCandlesForSymbol(tvBridge, 'NSE:NIFTY', '5', 20);
    console.log('\nNifty Spot 5m candles (latest 20):');
    spotCandles.forEach(c => {
      const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`[${timeStr}] Spot Close: ${c.close}, Vol: ${c.volume || 0}`);
    });
  } catch (e) {
    console.error('Error fetching Nifty candles:', e);
  }
  process.exit(0);
}

check();
