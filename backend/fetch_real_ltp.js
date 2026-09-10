import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';

async function checkLTP() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  const spotSym = 'NSE:NIFTY';
  const optSym = 'NSE:NIFTY260818C24300';
  
  console.log(`Fetching candles for Spot and Option...`);
  try {
    const spotCandles = await fetchCandlesForSymbol(tvBridge, spotSym, '1', 5);
    const optCandles = await fetchCandlesForSymbol(tvBridge, optSym, '1', 5);
    
    console.log('\nNIFTY Spot 1m Candles:');
    spotCandles.forEach((c, i) => {
      const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`[${timeStr}] Open: ${c.open}, High: ${c.high}, Low: ${c.low}, Close: ${c.close}`);
    });
    
    console.log('\nNIFTY 24300 CE 1m Candles:');
    optCandles.forEach((c, i) => {
      const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
      console.log(`[${timeStr}] Open: ${c.open}, High: ${c.high}, Low: ${c.low}, Close: ${c.close}`);
    });
    
  } catch (e) {
    console.error('Error fetching candles:', e);
  }
  process.exit(0);
}

checkLTP();
