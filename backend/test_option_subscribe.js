import { TradingViewBridge } from './tradingview.js';

async function test() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  const symbol = 'NSE:NIFTY260818C24250';
  console.log(`Testing subscription to: ${symbol}`);
  
  try {
    const cleanup = await tvBridge.subscribeSymbol(symbol, '5', (data) => {
      console.log('Received data snapshot/update:', data.isSnapshot, data.candles?.length);
      if (data.candles && data.candles.length > 0) {
        console.log('LTP close:', data.candles[data.candles.length - 1].close);
      }
    }, (err) => {
      console.error('Subscription error:', err);
    }, 15);
    
    console.log('Subscription active. Waiting 10 seconds...');
    await new Promise(r => setTimeout(r, 10000));
    await cleanup();
    console.log('Cleanup completed.');
  } catch (err) {
    console.error('Subscription threw error:', err);
  }
  process.exit(0);
}

test();
