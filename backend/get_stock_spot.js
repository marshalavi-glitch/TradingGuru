import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';

async function check() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  const symbol = 'NSE:RELIANCE';
  console.log(`Subscribing to ${symbol}...`);
  try {
    const candles = await fetchCandlesForSymbol(tvBridge, symbol, '5', 5);
    console.log(`Fetched ${candles.length} candles.`);
    if (candles.length > 0) {
      console.log('Latest RELIANCE spot price:', candles[candles.length - 1].close);
    }
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

check();
