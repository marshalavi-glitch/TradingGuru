import { TradingViewBridge } from '../backend/tradingview.js';

async function testOptionSubscription() {
  const tvBridge = new TradingViewBridge();
  
  // Nifty 24200 Call expiring July 23, 2026
  const optionSymbol = 'NSE:NIFTY260723C24200';
  
  console.log(`Attempting to subscribe to options chart: ${optionSymbol}...`);

  try {
    const candles = await new Promise((resolve, reject) => {
      let resolved = false;
      const timeout = setTimeout(async () => {
        if (!resolved) {
          resolved = true;
          try {
            const cleanupFn = await cleanupPromise;
            if (cleanupFn) await cleanupFn();
          } catch (e) {}
          reject(new Error('Timeout fetching option candles'));
        }
      }, 12000);

      const cleanupPromise = tvBridge.subscribeSymbol(
        optionSymbol,
        '5',
        async (data) => {
          if (data.isSnapshot && !resolved) {
            resolved = true;
            clearTimeout(timeout);
            try {
              const cleanupFn = await cleanupPromise;
              if (cleanupFn) await cleanupFn();
            } catch (err) {}
            resolve(data.candles);
          }
        },
        async (err) => {
          if (!resolved) {
            resolved = true;
            clearTimeout(timeout);
            try {
              const cleanupFn = await cleanupPromise;
              if (cleanupFn) await cleanupFn();
            } catch (e) {}
            reject(err);
          }
        },
        10 // Fetch 10 candles
      );
    });

    console.log(`Successfully retrieved option data for ${optionSymbol}!`);
    console.log('Candles count:', candles.length);
    if (candles.length > 0) {
      console.log('Latest Candle:', candles[candles.length - 1]);
    }
  } catch (err) {
    console.error('Failed to subscribe to option:', err.message || err);
  }
}

testOptionSubscription();
