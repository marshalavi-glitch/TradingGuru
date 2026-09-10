import './patch_ws.js';
import 'dotenv/config';
import { TradingViewBridge } from './tradingview.js';
import fs from 'fs';
import path from 'path';

async function fetchWeeklyCandles(tvBridge, symbol, limit = 260) {
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

// 1. Find the Previous Significant Top / Swing High Anchor Candle
function findPreviousTopAnchor(candles) {
  if (!candles || candles.length < 15) return -1;

  // Look for the most significant Top / Swing High before current week
  // Case A: Look for standard swing high pivot (high > surrounding 2 bars)
  for (let i = candles.length - 2; i >= 5; i--) {
    const currHigh = candles[i].high;
    const isPivot = 
      currHigh >= candles[i - 1].high &&
      currHigh >= candles[i - 2].high &&
      currHigh >= candles[i + 1].high;

    if (isPivot) {
      return i;
    }
  }

  // Case B: Find highest high in past 52 weeks
  let maxIdx = candles.length - 2;
  let maxVal = -1;
  const lookback = Math.min(candles.length - 2, 52);
  for (let i = candles.length - lookback; i < candles.length - 1; i++) {
    if (candles[i].high > maxVal) {
      maxVal = candles[i].high;
      maxIdx = i;
    }
  }
  return maxIdx;
}

// 2. Compute the 2 VWAPs anchored from that SAME Previous Top:
// VWAP 1: Typical Price (High + Low + Close) / 3
// VWAP 2: Swing High Candle High Price Anchor
function computeDualVWAPsFromTop(candles, anchorIdx) {
  if (anchorIdx < 0 || anchorIdx >= candles.length) return null;

  let sumTypicalVol = 0;
  let sumHighVol = 0;
  let sumVol = 0;

  for (let i = anchorIdx; i < candles.length; i++) {
    const c = candles[i];
    const vol = c.volume || 1;
    const typicalPrice = (c.high + c.low + c.close) / 3;

    sumTypicalVol += typicalPrice * vol;
    sumHighVol += c.high * vol;
    sumVol += vol;
  }

  if (sumVol <= 0) return null;

  const vwap1_HLC3 = sumTypicalVol / sumVol;
  const vwap2_High = sumHighVol / sumVol;

  const lowerVwap = Math.min(vwap1_HLC3, vwap2_High);
  const upperVwap = Math.max(vwap1_HLC3, vwap2_High);

  return {
    vwap1_HLC3,
    vwap2_High,
    lowerVwap,
    upperVwap
  };
}

async function runPreciseBandScan() {
  const tvBridge = new TradingViewBridge();
  
  const scanSymbolsPath = path.join('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/scan_symbols.json');
  let symbols = [];
  try {
    symbols = JSON.parse(fs.readFileSync(scanSymbolsPath, 'utf8'));
  } catch (e) {
    console.error("Could not load scan_symbols.json");
    process.exit(1);
  }

  console.log(`Scanning ${symbols.length} F&O and Index symbols for weekly close strictly inside the Dual Anchored VWAP Band...`);

  const matchedStocks = [];
  const BATCH_SIZE = 12;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async (item) => {
      const sym = item.value || item;
      try {
        const candles = await fetchWeeklyCandles(tvBridge, sym, 250);
        if (!candles || candles.length < 20) return;

        const anchorIdx = findPreviousTopAnchor(candles);
        if (anchorIdx < 0) return;

        const anchorCandle = candles[anchorIdx];
        const topDate = new Date(anchorCandle.time * 1000).toISOString().split('T')[0];
        const topPrice = anchorCandle.high;
        const weeksFromTop = candles.length - 1 - anchorIdx;

        const vwaps = computeDualVWAPsFromTop(candles, anchorIdx);
        if (!vwaps) return;

        const latestCandle = candles[candles.length - 1];
        const currentClose = latestCandle.close;

        // Condition: Weekly candle closed INSIDE the band formed between vwap1 and vwap2
        const isInsideBand = currentClose >= vwaps.lowerVwap && currentClose <= vwaps.upperVwap;

        if (isInsideBand) {
          const bandWidthPts = vwaps.upperVwap - vwaps.lowerVwap;
          const bandWidthPct = (bandWidthPts / vwaps.lowerVwap) * 100;
          const distToLowerPct = ((currentClose - vwaps.lowerVwap) / vwaps.lowerVwap) * 100;
          const distToUpperPct = ((vwaps.upperVwap - currentClose) / vwaps.upperVwap) * 100;

          matchedStocks.push({
            symbol: sym.replace('NSE:', '').replace('BSE:', ''),
            currentClose: parseFloat(currentClose.toFixed(2)),
            topDate,
            topPrice: parseFloat(topPrice.toFixed(2)),
            weeksFromTop,
            vwap1_HLC3: parseFloat(vwaps.vwap1_HLC3.toFixed(2)),
            vwap2_High: parseFloat(vwaps.vwap2_High.toFixed(2)),
            lowerVwap: parseFloat(vwaps.lowerVwap.toFixed(2)),
            upperVwap: parseFloat(vwaps.upperVwap.toFixed(2)),
            bandWidthPct: parseFloat(bandWidthPct.toFixed(2)),
            distToLowerPct: parseFloat(distToLowerPct.toFixed(2)),
            distToUpperPct: parseFloat(distToUpperPct.toFixed(2)),
            status: '🎯 PINNED INSIDE VWAP BAND'
          });
        }
      } catch (err) {}
    });

    await Promise.all(promises);
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, symbols.length)} / ${symbols.length}`);
  }

  console.log(`\n\nScan complete! Found ${matchedStocks.length} stocks closed strictly inside the VWAP Band!\n`);

  matchedStocks.sort((a, b) => a.bandWidthPct - b.bandWidthPct);

  const outPath = path.join('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3', 'precise_weekly_vwap_band_stocks.json');
  fs.writeFileSync(outPath, JSON.stringify(matchedStocks, null, 2));

  console.log(JSON.stringify(matchedStocks, null, 2));
  process.exit(0);
}

runPreciseBandScan();
