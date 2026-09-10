import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';

async function test() {
  console.log('Instantiating TradingViewBridge...');
  const tvBridge = new TradingViewBridge();
  
  // Wait a few seconds for bridge connection
  await new Promise(r => setTimeout(r, 3000));
  
  console.log('Testing tvBridge connection...');
  try {
    const candles = await fetchCandlesForSymbol(tvBridge, 'NSE:NIFTY', '5', 100);
    console.log(`Fetched ${candles.length} candles of NIFTY 5-min`);
    
    // Sort candles by time
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    
    console.log('Last 5 candles:');
    sorted.slice(-5).forEach(c => {
      const date = new Date(c.time * 1000);
      console.log(`Time: ${c.time} (IST: ${date.toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})}), O: ${c.open}, H: ${c.high}, L: ${c.low}, C: ${c.close}`);
    });
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

test();
