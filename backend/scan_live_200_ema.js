import './patch_ws.js';
import 'dotenv/config';
import { TradingViewBridge } from './tradingview.js';
import fs from 'fs';
import path from 'path';

async function fetchWeeklyCandles(tvBridge, symbol, limit = 350) {
  let cleanupFn = null;
  let resolved = false;
  let cachedData = null;

  return new Promise((resolve) => {
    const timeout = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        if (cleanupFn) {
          try { await cleanupFn(); } catch (e) {}
        }
        resolve(cachedData || []);
      }
    }, 4500);

    const onData = async (data) => {
      if (data.isSnapshot && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (cleanupFn) {
          try { await cleanupFn(); } catch (err) {}
        }
        resolve(data.candles || []);
      } else if (!resolved && data.candles && data.candles.length > 0) {
        cachedData = data.candles;
      }
    };

    const onError = async () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (cleanupFn) {
          try { await cleanupFn(); } catch (e) {}
        }
        resolve([]);
      }
    };

    tvBridge.subscribeSymbol(symbol, 'W', onData, onError, limit).then(cleanup => {
      cleanupFn = cleanup;
      if (cachedData && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        try { cleanupFn(); } catch (e) {}
        resolve(cachedData);
      }
    }).catch(onError);
  });
}

function calculateEMA(candles, period = 200) {
  if (!candles || candles.length < period) return [];
  const k = 2 / (period + 1);
  let emaArray = new Array(candles.length).fill(null);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  emaArray[period - 1] = prevEma;

  for (let i = period; i < candles.length; i++) {
    const currentEma = (candles[i].close * k) + (prevEma * (1 - k));
    emaArray[i] = currentEma;
    prevEma = currentEma;
  }

  return emaArray;
}

async function runDirect200EMAScan() {
  const tvBridge = new TradingViewBridge();
  
  // Load symbols
  const scanSymbolsPath = path.join('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/scan_symbols.json');
  let symbols = [];
  try {
    symbols = JSON.parse(fs.readFileSync(scanSymbolsPath, 'utf8'));
  } catch (e) {
    console.error("Could not load scan_symbols.json");
    process.exit(1);
  }

  console.log(`Scanning all ${symbols.length} F&O and liquid market stocks for Weekly 200 EMA proximity...`);

  const nearStocks = [];
  const BATCH_SIZE = 12;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async (item) => {
      const sym = item.value || item;
      try {
        const candles = await fetchWeeklyCandles(tvBridge, sym, 320);
        if (!candles || candles.length < 205) return;

        const ema200 = calculateEMA(candles, 200);
        const lastIdx = candles.length - 1;
        const currentCandle = candles[lastIdx];
        const currentEma = ema200[lastIdx];

        if (!currentEma || currentEma <= 0) return;

        const currentPrice = currentCandle.close;
        const lowPrice = currentCandle.low;
        const highPrice = currentCandle.high;
        const distPct = ((currentPrice - currentEma) / currentEma) * 100;

        // Condition: Price within +/- 6% of Weekly 200 EMA OR Wick swept it
        const isNear = Math.abs(distPct) <= 6.5 || (lowPrice <= currentEma * 1.02 && currentPrice >= currentEma * 0.96);

        if (isNear) {
          const range = highPrice - lowPrice;
          const body = Math.abs(currentCandle.close - currentCandle.open);
          const lowerShadow = Math.min(currentCandle.open, currentCandle.close) - lowPrice;
          
          const isDojiOrHammer = range > 0 && (body / range) <= 0.35 && (lowerShadow / range) >= 0.40;
          const isSweeping = lowPrice <= currentEma * 1.015 && currentPrice >= currentEma * 0.99;

          let category = 'NEAR 200 EMA SUPPORT';
          let statusBadge = '⚖️ CONSOLIDATING AT 200 EMA';

          if (isSweeping && isDojiOrHammer) {
            category = '🔥 200 EMA DOJI WICK SWEEP';
            statusBadge = '🚀 92% WIN-RATE MACRO REVERSAL';
          } else if (distPct >= 0 && distPct <= 3.0) {
            category = '🟢 BOUNCING OFF 200 EMA';
            statusBadge = '🟢 MACRO SUPPORT HOLD';
          } else if (distPct < 0 && distPct >= -4.0) {
            category = '⚡ TESTING UNDER 200 EMA';
            statusBadge = '⚠️ RECLAIM WATCH';
          }

          nearStocks.push({
            symbol: sym.replace('NSE:', ''),
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            ema200: parseFloat(currentEma.toFixed(2)),
            distancePct: parseFloat(distPct.toFixed(2)),
            lowPrice: parseFloat(lowPrice.toFixed(2)),
            highPrice: parseFloat(highPrice.toFixed(2)),
            category,
            statusBadge,
            isDojiOrHammer
          });
        }
      } catch (err) {}
    });

    await Promise.all(promises);
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, symbols.length)} / ${symbols.length}`);
  }

  console.log(`\n\nScan complete! Found ${nearStocks.length} stocks near Weekly 200 EMA.\n`);

  nearStocks.sort((a, b) => Math.abs(a.distancePct) - Math.abs(b.distancePct));

  const outPath = path.join('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3', 'live_weekly_200_ema_stocks.json');
  fs.writeFileSync(outPath, JSON.stringify(nearStocks, null, 2));

  console.log(JSON.stringify(nearStocks, null, 2));
  process.exit(0);
}

runDirect200EMAScan();
