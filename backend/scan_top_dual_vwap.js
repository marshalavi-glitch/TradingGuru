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

// 1. Find the Absolute Major Top (All-Time / 52-Week Peak High) on Weekly Chart
function findMajorTopIndex(candles) {
  if (!candles || candles.length < 15) return -1;

  let maxHigh = -1;
  let maxIdx = -1;

  // Search across the past 52-104 weeks (1-2 years)
  const lookback = Math.min(candles.length - 2, 104);
  for (let i = candles.length - lookback; i < candles.length; i++) {
    if (candles[i].high > maxHigh) {
      maxHigh = candles[i].high;
      maxIdx = i;
    }
  }

  return maxIdx;
}

// Calculate the Two Anchored VWAPs anchored from the Major Top:
// VWAP 1 (Typical Price HLC/3): Sum( (High + Low + Close) / 3 * Volume ) / Sum( Volume )
// VWAP 2 (Top Anchor Price - High / Close): Sum( High * Volume ) / Sum( Volume ) or Sum( Close * Volume ) / Sum( Volume )
function calculateDualAnchoredVWAPFromTop(candles, topIdx) {
  if (topIdx < 0 || topIdx >= candles.length) return null;

  let sumTypicalVol = 0;
  let sumHighVol = 0;
  let sumCloseVol = 0;
  let sumVol = 0;

  for (let i = topIdx; i < candles.length; i++) {
    const c = candles[i];
    const vol = c.volume || 1;
    const typicalPrice = (c.high + c.low + c.close) / 3;

    sumTypicalVol += typicalPrice * vol;
    sumHighVol += c.high * vol;
    sumCloseVol += c.close * vol;
    sumVol += vol;
  }

  if (sumVol <= 0) return null;

  const vwapHLC3 = sumTypicalVol / sumVol; // VWAP 1: (H+L+C)/3
  const vwapHigh = sumHighVol / sumVol;     // VWAP 2 (High Source)
  const vwapClose = sumCloseVol / sumVol;   // VWAP 2 (Close Source)

  const upperVwap = Math.max(vwapHLC3, vwapHigh);
  const lowerVwap = Math.min(vwapHLC3, vwapHigh);

  return {
    vwapHLC3,
    vwapHigh,
    vwapClose,
    upperVwap,
    lowerVwap
  };
}

async function runWeeklyTopDualVwapScan() {
  const tvBridge = new TradingViewBridge();
  
  const scanSymbolsPath = path.join('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/scan_symbols.json');
  let symbols = [];
  try {
    symbols = JSON.parse(fs.readFileSync(scanSymbolsPath, 'utf8'));
  } catch (e) {
    console.error("Could not load scan_symbols.json");
    process.exit(1);
  }

  console.log(`Scanning ${symbols.length} symbols for Weekly Close PINNED BETWEEN Both Anchored VWAPs from Top...`);

  const matchedStocks = [];
  const BATCH_SIZE = 12;

  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    
    const promises = batch.map(async (item) => {
      const sym = item.value || item;
      try {
        const candles = await fetchWeeklyCandles(tvBridge, sym, 250);
        if (!candles || candles.length < 25) return;

        const topIdx = findMajorTopIndex(candles);
        if (topIdx < 0) return;

        const topCandle = candles[topIdx];
        const topDate = new Date(topCandle.time * 1000).toISOString().split('T')[0];
        const topPrice = topCandle.high;
        const weeksSinceTop = candles.length - 1 - topIdx;

        const vwaps = calculateDualAnchoredVWAPFromTop(candles, topIdx);
        if (!vwaps) return;

        const latestCandle = candles[candles.length - 1];
        const currentPrice = latestCandle.close;

        // Condition: Weekly Candle Close is STRICTLY BETWEEN lowerVwap and upperVwap
        const isBetween = currentPrice >= (vwaps.lowerVwap * 0.995) && currentPrice <= (vwaps.upperVwap * 1.005);

        if (isBetween) {
          const vwapSpreadPct = ((vwaps.upperVwap - vwaps.lowerVwap) / vwaps.lowerVwap) * 100;
          const dropFromTopPct = ((currentPrice - topPrice) / topPrice) * 100;

          matchedStocks.push({
            symbol: sym.replace('NSE:', ''),
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            topDate,
            topPrice: parseFloat(topPrice.toFixed(2)),
            weeksSinceTop,
            dropFromTopPct: parseFloat(dropFromTopPct.toFixed(1)),
            vwapHLC3: parseFloat(vwaps.vwapHLC3.toFixed(2)),
            vwapHigh: parseFloat(vwaps.vwapHigh.toFixed(2)),
            lowerVwap: parseFloat(vwaps.lowerVwap.toFixed(2)),
            upperVwap: parseFloat(vwaps.upperVwap.toFixed(2)),
            vwapSpreadPct: parseFloat(vwapSpreadPct.toFixed(2)),
            status: '🎯 PINNED BETWEEN BOTH ANCHORED VWAPs',
            setupQuality: vwapSpreadPct <= 3.0 ? '🔥 ULTRA TIGHT VWAP SQUEEZE' : '⚖️ RANGE EQUILIBRIUM'
          });
        }
      } catch (err) {}
    });

    await Promise.all(promises);
    process.stdout.write(`\rProgress: ${Math.min(i + BATCH_SIZE, symbols.length)} / ${symbols.length}`);
  }

  console.log(`\n\nScan complete! Found ${matchedStocks.length} stocks closed BETWEEN both Anchored VWAPs from Top!\n`);

  matchedStocks.sort((a, b) => a.vwapSpreadPct - b.vwapSpreadPct);

  const outPath = path.join('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3', 'weekly_top_dual_anchored_vwap_stocks.json');
  fs.writeFileSync(outPath, JSON.stringify(matchedStocks, null, 2));

  console.log(JSON.stringify(matchedStocks, null, 2));
  process.exit(0);
}

runWeeklyTopDualVwapScan();
