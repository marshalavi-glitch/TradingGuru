import { TradingViewBridge } from './tradingview.js';

async function checkPut() {
  const tvBridge = new TradingViewBridge();
  const symbol = 'NSE:NIFTY260804P24700';
  
  console.log(`Checking volume for ${symbol}...`);
  try {
    const fn = await tvBridge.subscribeSymbol(symbol, '5', (data) => {
      if (data.isSnapshot) {
        const todayCandles = data.candles.filter(c => {
          const d = new Date(c.time * 1000);
          return d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }) === '8/3/2026';
        }).sort((a, b) => a.time - b.time);

        todayCandles.forEach(c => {
          const d = new Date(c.time * 1000);
          const t = d.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
          console.log(`Time: ${t}, Close: ${c.close}, Volume: ${c.volume}`);
        });

        setTimeout(() => process.exit(0), 1000);
      }
    }, (err) => {
      console.error(err);
      process.exit(1);
    }, 100);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
}

checkPut();
