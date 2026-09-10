import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';

async function testFetch() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  const symbol = 'NSE:NIFTY260818C24300';
  console.log(`Subscribing to ${symbol}...`);
  try {
    const candles = await fetchCandlesForSymbol(tvBridge, symbol, '5', 10);
    console.log(`Fetched ${candles ? candles.length : 0} candles.`);
    if (candles && candles.length > 0) {
      console.log('Latest candle:', candles[candles.length - 1]);
    }
  } catch (e) {
    console.error('Error fetching candles:', e);
  }
  process.exit(0);
}

testFetch();
