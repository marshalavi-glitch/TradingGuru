import { TradingViewBridge } from '../backend/tradingview.js';

async function test() {
  const tv = new TradingViewBridge();
  try {
    // Wait for ws connection
    await new Promise(r => setTimeout(r, 3000));
    
    // Subscribe to Nifty
    tv.subscribeSymbol('NSE:NIFTY', 'D', (data) => {
      if (data.isSnapshot) {
        console.log("Keys of a candle:", Object.keys(data.candles[0]));
        console.log("Sample candle data:", data.candles[0]);
        process.exit(0);
      }
    }, (err) => {
      console.error(err);
      process.exit(1);
    }, 5);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

test();
