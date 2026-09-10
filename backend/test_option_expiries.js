import { TradingViewBridge } from '../backend/tradingview.js';

async function testExpiries() {
  const tvBridge = new TradingViewBridge();
  
  // Test both today's expiry (260721) and next week's expiry (260728)
  const symbolsToTest = [
    'NSE:NIFTY260721C24200',
    'NSE:NIFTY260721P24200',
    'NSE:NIFTY260728C24200',
    'NSE:NIFTY260728P24200'
  ];

  for (const sym of symbolsToTest) {
    console.log(`\nAttempting to subscribe to: ${sym}...`);
    try {
      const candles = await fetchCandles(tvBridge, sym);
      console.log(`Success! Retrieved ${candles.length} candles for ${sym}`);
      if (candles.length > 0) {
        console.log(`  Last Price:`, candles[candles.length - 1].close);
      }
    } catch (err) {
      console.log(`Failed for ${sym}:`, err.message || err);
    }
  }
  
  try { process.exit(0); } catch (e) {}
}

function fetchCandles(tvBridge, symbol) {
  return new Promise((resolve, reject) => {
    let resolved = false;
    const timeout = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        try {
          const cleanupFn = await cleanupPromise;
          if (cleanupFn) await cleanupFn();
        } catch (e) {}
        reject(new Error('Timeout'));
      }
    }, 8000);

    const cleanupPromise = tvBridge.subscribeSymbol(
      symbol,
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
}

testExpiries();
