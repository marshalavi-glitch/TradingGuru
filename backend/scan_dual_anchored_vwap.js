import './patch_ws.js';
import 'dotenv/config';
import { TradingViewBridge } from './tradingview.js';
import fs from 'fs';
import path from 'path';

async function fetchWeeklyCandles(tvBridge, symbol, limit = 250) {
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

// Find Previous Significant Swing High on Weekly Timeframe (e.g. 5-bar to 20-bar lookback pivot high)
function findPreviousWeeklySwingHigh(candles) {
  if (!candles || candles.length < 20) return -1;

  // Search backward from 3 weeks ago to 60 weeks ago
  for (let i = candles.length - 3; i >= 5; i--) {
    const currHigh = candles[i].high;
    const isSwingHigh = 
      currHigh >= candles[i - 1].high &&
      currHigh >= candles[i - 2].high &&
      currHigh >= candles[i + 1].high &&
      currHigh >= candles[i + 2].high;

    if (isSwingHigh) {
      return i; // Return candle index of the Swing High
    }
  }

  // Fallback to absolute highest high in last 30 weeks
  let maxIdx = candles.length - 5;
  let maxVal = -1;
  for (let i = candles.length - 30; i < candles.length - 2; i++) {
    if (i >= 0 && candles[i].high > maxVal) {
      maxVal = candles[i].high;
      maxIdx = i;
    }
  }
  return maxIdx;
}

// Calculate the Two Dual Anchored VWAPs from Swing High Index:
// VWAP 1 (Typical Price): Sum( (High + Low + Close) / 3 * Volume ) / Sum( Volume )
// VWAP 2 (Swing High Source): Sum( High * Volume ) / Sum( Volume ) (or standard Close * Vol from Swing High anchor)
function calculateDualAnchoredVWAP(candles, anchorIdx) {
  if (anchorIdx < 0 || anchorIdx >= candles.length) return null;

  let sumTypicalVol = 0;
  let sumHighVol = 0;
  let sumVol = 0;

  for (let i = anchorIdx; i < candles.length; i++) {
    const c = candles[i];
    const vol = c.volume || 1;
    const typicalPrice = (c.high + c.low + c.close) / 3;
    const highPrice = c.high;

    sumTypicalVol += typicalPrice * vol;
    sumHighVol += highPrice * vol;
    sumVol += vol;
  }

  if (sumVol <= 0) return null;

  const vwapTypical = sumTypicalVol / sumVol; // (H+L+C)/3 Anchored VWAP
  const vwapHigh = sumHighVol / sumVol;       // High Anchored VWAP

  return {
    vwapTypical,
    vwapHigh,
    upperVwap: Math.max(vwapTypical, vwapHigh),
    lowerVwap: Math.min(vwapTypical, vwapHigh)
  };
}

async function runDualAnchoredVwapScan() {
  const tvBridge = new TradingViewBridge();
  
  const scanSymbolsPath = path.join('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/scan_symbols.json');
  let symbols = [];
  try {
    symbols = JSON.parse(fs.readFileSync(scanSymbolsPath, 'utf8'));
  } catch (e) {
    console.error("Could not load scan_symbols.json");
    process.exit(1);
  }

  console.log(`Scanning ${symbols.length} F&O and Index symbols for Weekly Dual Anchored VWAP compression...`);

  const matchedStocks = [];
  const BATCH_SIZE = 12;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async (item) => {
      const sym = item.value || item;
      try {
        const candles = await fetchWeeklyCandles(tvBridge, sym, 200);
        if (!candles || candles.length < 25) return;

        const anchorIdx = findPreviousWeeklySwingHigh(candles);
        if (anchorIdx < 0) return;

        const anchorCandle = candles[anchorIdx];
        const anchorDate = new Date(anchorCandle.time * 1000).toISOString().split('T')[0];
        const anchorPrice = anchorCandle.high;

        const vwaps = calculateDualAnchoredVWAP(candles, anchorIdx);
        if (!vwaps) return;

        const latestCandle = candles[candles.length - 1];
        const currentPrice = latestCandle.close;

        // Condition: Weekly close is strictly PINNED BETWEEN the two Anchored VWAPs
        // lowerVwap <= currentPrice <= upperVwap (or within 0.75% band)
        const isBetween = currentPrice >= (vwaps.lowerVwap * 0.9925) && currentPrice <= (vwaps.upperVwap * 1.0075);

        if (isBetween) {
          const vwapSpreadPct = ((vwaps.upperVwap - vwaps.lowerVwap) / vwaps.lowerVwap) * 100;
          const distToLowerPct = ((currentPrice - vwaps.lowerVwap) / vwaps.lowerVwap) * 100;
          const distToUpperPct = ((vwaps.upperVwap - currentPrice) / vwaps.upperVwap) * 100;

          matchedStocks.push({
            symbol: sym.replace('NSE:', ''),
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            swingHighDate: anchorDate,
            swingHighPrice: parseFloat(anchorPrice.toFixed(2)),
            vwapTypicalHLC3: parseFloat(vwaps.vwapTypical.toFixed(2)),
            vwapHigh: parseFloat(vwaps.vwapHigh.toFixed(2)),
            lowerVwap: parseFloat(vwaps.lowerVwap.toFixed(2)),
            upperVwap: parseFloat(vwaps.upperVwap.toFixed(2)),
            vwapSpreadPct: parseFloat(vwapSpreadPct.toFixed(2)),
            status: '🎯 PINNED BETWEEN DUAL ANCHORED VWAPs',
            action: currentPrice >= vwaps.vwapTypical ? '🟢 Bullish Breakout Test' : '🔴 Pullback Support Test'
          });
        }
      } catch (err) {}
    });

    await Promise.all(promises);
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, symbols.length)} / ${symbols.length}`);
  }

  console.log(`\n\nScan complete! Found ${matchedStocks.length} stocks closed BETWEEN the Two Dual Anchored VWAPs!\n`);

  matchedStocks.sort((a, b) => a.vwapSpreadPct - b.vwapSpreadPct);

  const outPath = path.join('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3', 'weekly_dual_anchored_vwap_stocks.json');
  fs.writeFileSync(outPath, JSON.stringify(matchedStocks, null, 2));

  console.log(JSON.stringify(matchedStocks, null, 2));
  process.exit(0);
}

runDualAnchoredVwapScan();
