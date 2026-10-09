import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UNIVERSE_PATH = path.join(__dirname, 'data/orderflow_universe_1000.json');
const REPORT_CACHE_PATH = path.join(__dirname, 'data/orderflow_report_1000.json');
const LEVELS_BACKUP_PATH = path.join(__dirname, 'data/levels_cache_backup.json');

// Memory Cache
export const orderFlowReportCache = {
  lastUpdated: null,
  isScanning: false,
  scanProgress: 100,
  scanStatus: 'Idle (Cached Data Ready)',
  totalCount: 0,
  summary: {
    total: 0,
    bullishBreakout: 0,
    bullish: 0,
    inBuyZone: 0,
    neutral: 0,
    inSellZone: 0,
    bearish: 0,
    bearishBreakdown: 0,
    nearLevels: 0
  },
  items: []
};

// Calculate Marshall Matrix Order Flow levels
export function calculateOrderFlowLevels(h_prev, l_prev, c_prev) {
  let r_prev = h_prev - l_prev;
  if (r_prev <= 0) {
    r_prev = Math.max(1, c_prev * 0.015);
  }

  // Exact Marshall Matrix / Camarilla formulation
  const r2 = c_prev + (r_prev * 1.1 / 6.0);
  const s2 = c_prev - (r_prev * 1.1 / 6.0);
  const r3 = c_prev + (r_prev * 1.1 / 4.0);
  const s3 = c_prev - (r_prev * 1.1 / 4.0);
  const r4 = c_prev + (r_prev * 1.1 / 2.0);
  const s4 = c_prev - (r_prev * 1.1 / 2.0);

  const r5 = r4 + 1.168 * (r4 - r3);
  const s5 = s4 - 1.168 * (s3 - s4);
  const r6 = l_prev > 0 ? (h_prev / l_prev) * c_prev : c_prev * 1.05;
  const s6 = c_prev - (r6 - c_prev);

  return {
    r2: Math.round(r2 * 100) / 100,
    r3: Math.round(r3 * 100) / 100,
    r4: Math.round(r4 * 100) / 100,
    r5: Math.round(r5 * 100) / 100,
    r6: Math.round(r6 * 100) / 100,
    s2: Math.round(s2 * 100) / 100,
    s3: Math.round(s3 * 100) / 100,
    s4: Math.round(s4 * 100) / 100,
    s5: Math.round(s5 * 100) / 100,
    s6: Math.round(s6 * 100) / 100
  };
}

// Determine real-time Market Bias and Action Zones
export function evaluateMarketBias(ltp, levels) {
  const { r4, r3, s3, s4 } = levels;
  if (!ltp || ltp <= 0) {
    return {
      bias: 'NEUTRAL_RANGE',
      biasLabel: 'Neutral Range',
      biasColor: '#94a3b8',
      actionTag: 'Observing',
      isNearLevel: false,
      nearestLevelName: 'N/A',
      nearestLevelPrice: 0
    };
  }

  // Proximity threshold is 0.35%
  const buyZoneLow = s3 * 0.9965;
  const buyZoneHigh = s3 * 1.0035;
  const sellZoneLow = r3 * 0.9965;
  const sellZoneHigh = r3 * 1.0035;

  let bias = 'NEUTRAL_RANGE';
  let biasLabel = 'Neutral Range';
  let biasColor = '#94a3b8';
  let actionTag = 'Wait for Setup';

  if (ltp >= r4) {
    bias = 'BULLISH_BREAKOUT';
    biasLabel = '🚀 Bullish Breakout';
    biasColor = '#10b981';
    actionTag = 'Momentum Long Active';
  } else if (ltp >= sellZoneLow && ltp <= sellZoneHigh) {
    bias = 'IN_SELL_ZONE';
    biasLabel = '🔴 In Sell Zone (R3)';
    biasColor = '#ef4444';
    actionTag = 'Reversal Short Opportunity';
  } else if (ltp > r3 && ltp < r4) {
    const distToR4 = ((r4 - ltp) / ltp) * 100;
    if (distToR4 <= 0.6) {
      bias = 'APPROACHING_BREAKOUT';
      biasLabel = '⚡ Approaching Breakout';
      biasColor = '#f59e0b';
      actionTag = 'Watch for R4 Breakout';
    } else {
      bias = 'BULLISH';
      biasLabel = '📈 Bullish';
      biasColor = '#34d399';
      actionTag = 'Trending Up to R4';
    }
  } else if (ltp <= s4) {
    bias = 'BEARISH_BREAKDOWN';
    biasLabel = '🔻 Bearish Breakdown';
    biasColor = '#dc2626';
    actionTag = 'Breakdown Short Active';
  } else if (ltp >= buyZoneLow && ltp <= buyZoneHigh) {
    bias = 'IN_BUY_ZONE';
    biasLabel = '🟢 In Buy Zone (S3)';
    biasColor = '#06b6d4';
    actionTag = 'Reversal Long Opportunity';
  } else if (ltp < s3 && ltp > s4) {
    const distToS4 = ((ltp - s4) / ltp) * 100;
    if (distToS4 <= 0.6) {
      bias = 'APPROACHING_BREAKDOWN';
      biasLabel = '⚠️ Approaching Breakdown';
      biasColor = '#f87171';
      actionTag = 'Watch for S4 Breakdown';
    } else {
      bias = 'BEARISH';
      biasLabel = '📉 Bearish';
      biasColor = '#fb7185';
      actionTag = 'Trending Down to S4';
    }
  }

  // Find nearest key level
  const candidates = [
    { name: 'R4 (Breakout)', price: r4, dist: Math.abs(ltp - r4) },
    { name: 'R3 (Sell Reversal)', price: r3, dist: Math.abs(ltp - r3) },
    { name: 'S3 (Buy Reversal)', price: s3, dist: Math.abs(ltp - s3) },
    { name: 'S4 (Breakdown)', price: s4, dist: Math.abs(ltp - s4) }
  ];
  candidates.sort((a, b) => a.dist - b.dist);
  const nearest = candidates[0];
  const isNearLevel = nearest.dist / ltp <= 0.005; // within 0.5%

  return {
    bias,
    biasLabel,
    biasColor,
    actionTag,
    isNearLevel,
    nearestLevelName: nearest.name,
    nearestLevelPrice: nearest.price
  };
}

// Load universe of 1,000 stocks
export function getUniverse1000() {
  try {
    if (fs.existsSync(UNIVERSE_PATH)) {
      return JSON.parse(fs.readFileSync(UNIVERSE_PATH, 'utf8'));
    }
  } catch (err) {
    console.error('[OrderFlow Report] Failed to load universe:', err.message);
  }
  return [];
}

// Initialize cache from disk on startup
export function initOrderFlowReportCache() {
  try {
    const universe = getUniverse1000();
    if (!universe || universe.length === 0) return;

    // Load existing backup calculations if available
    let existingLevelsBackup = {};
    if (fs.existsSync(LEVELS_BACKUP_PATH)) {
      try {
        const backupData = JSON.parse(fs.readFileSync(LEVELS_BACKUP_PATH, 'utf8'));
        existingLevelsBackup = backupData['5'] || {};
      } catch (e) {}
    }

    // Try loading persistent report data
    if (fs.existsSync(REPORT_CACHE_PATH)) {
      try {
        const saved = JSON.parse(fs.readFileSync(REPORT_CACHE_PATH, 'utf8'));
        if (saved && Array.isArray(saved.items) && saved.items.length >= 800) {
          orderFlowReportCache.lastUpdated = saved.lastUpdated;
          orderFlowReportCache.totalCount = saved.items.length;
          orderFlowReportCache.summary = saved.summary || orderFlowReportCache.summary;
          orderFlowReportCache.items = saved.items;
          orderFlowReportCache.scanStatus = 'Idle (Live Data Restored)';
          console.log(`[OrderFlow Report] Restored complete report for ${saved.items.length} stocks from disk.`);
          return;
        }
      } catch (e) {}
    }

    // Initialize baseline items
    console.log(`[OrderFlow Report] Initializing baseline Order Flow levels for 1,000 stocks universe...`);
    const items = [];

    for (const item of universe) {
      const sym = item.symbol;
      const cleanSym = item.cleanSymbol;
      
      // Check if we have pre-computed levels
      const preCalc = existingLevelsBackup[sym] || existingLevelsBackup[`NSE:${cleanSym}`];
      let ltp = 100;
      let levels;

      if (preCalc && preCalc.levels && preCalc.levels.level4 && preCalc.levels.level7) {
        ltp = preCalc.currentPrice || 100;
        levels = {
          r6: Math.round(preCalc.levels.level1 * 100) / 100,
          r5: Math.round(preCalc.levels.level2 * 100) / 100,
          r4: Math.round(preCalc.levels.level3 * 100) / 100,
          r3: Math.round(preCalc.levels.level4 * 100) / 100,
          r2: Math.round(preCalc.levels.level5 * 100) / 100,
          s2: Math.round(preCalc.levels.level6 * 100) / 100,
          s3: Math.round(preCalc.levels.level7 * 100) / 100,
          s4: Math.round(preCalc.levels.level8 * 100) / 100,
          s5: Math.round(preCalc.levels.level9 * 100) / 100,
          s6: Math.round(preCalc.levels.level10 * 100) / 100
        };
      } else {
        // Fallback baseline levels
        const c_prev = ltp;
        const r_prev = c_prev * 0.02;
        levels = calculateOrderFlowLevels(c_prev + r_prev * 0.5, c_prev - r_prev * 0.5, c_prev);
      }

      const evalResult = evaluateMarketBias(ltp, levels);

      items.push({
        symbol: sym,
        cleanSymbol: cleanSym,
        name: item.name || cleanSym,
        token: item.token,
        tradingsymbol: item.tradingsymbol,
        exchange: item.exchange || 'NSE',
        sector: item.sector || 'NSE Equity',
        isFno: !!item.isFno,
        ltp,
        changePct: 0.0,
        changePts: 0.0,
        open: ltp,
        high: ltp,
        low: ltp,
        close: ltp,
        volume: 0,
        ...levels,
        support: levels.s3,
        resistance: levels.r3,
        breakoutLevel: levels.r4,
        breakdownLevel: levels.s4,
        momentumHigh: levels.r2,
        momentumLow: levels.s2,
        buyEntryZone: `${(levels.s3 * 0.997).toFixed(1)} - ${(levels.s3 * 1.003).toFixed(1)}`,
        sellEntryZone: `${(levels.r3 * 0.997).toFixed(1)} - ${(levels.r3 * 1.003).toFixed(1)}`,
        targetBullishT1: levels.r5,
        targetBullishT2: levels.r6,
        targetBearishT1: levels.s5,
        targetBearishT2: levels.s6,
        stopLossLong: levels.s4,
        stopLossShort: levels.r4,
        distanceToBreakoutPct: Math.round(((levels.r4 - ltp) / ltp) * 10000) / 100,
        distanceToBreakdownPct: Math.round(((ltp - levels.s4) / ltp) * 10000) / 100,
        distanceToBuyZonePct: Math.round(((ltp - levels.s3) / ltp) * 10000) / 100,
        distanceToSellZonePct: Math.round(((levels.r3 - ltp) / ltp) * 10000) / 100,
        ...evalResult,
        lastUpdated: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST'
      });
    }

    orderFlowReportCache.items = items;
    orderFlowReportCache.totalCount = items.length;
    orderFlowReportCache.lastUpdated = new Date().toISOString();
    recalculateReportSummary();
    saveReportCacheToDisk();
  } catch (err) {
    console.error('[OrderFlow Report] Init error:', err);
  }
}

// Recalculate summary metrics across all 1,000 items
function recalculateReportSummary() {
  const summary = {
    total: orderFlowReportCache.items.length,
    bullishBreakout: 0,
    bullish: 0,
    inBuyZone: 0,
    neutral: 0,
    inSellZone: 0,
    bearish: 0,
    bearishBreakdown: 0,
    nearLevels: 0
  };

  for (const item of orderFlowReportCache.items) {
    if (item.bias === 'BULLISH_BREAKOUT') summary.bullishBreakout++;
    else if (item.bias === 'BULLISH' || item.bias === 'APPROACHING_BREAKOUT') summary.bullish++;
    else if (item.bias === 'IN_BUY_ZONE') summary.inBuyZone++;
    else if (item.bias === 'IN_SELL_ZONE') summary.inSellZone++;
    else if (item.bias === 'BEARISH_BREAKDOWN') summary.bearishBreakdown++;
    else if (item.bias === 'BEARISH' || item.bias === 'APPROACHING_BREAKDOWN') summary.bearish++;
    else summary.neutral++;

    if (item.isNearLevel) summary.nearLevels++;
  }

  orderFlowReportCache.summary = summary;
}

// Persist report data to disk
export function saveReportCacheToDisk() {
  try {
    const data = {
      lastUpdated: orderFlowReportCache.lastUpdated,
      summary: orderFlowReportCache.summary,
      items: orderFlowReportCache.items
    };
    fs.writeFileSync(REPORT_CACHE_PATH, JSON.stringify(data), 'utf8');
  } catch (err) {
    console.error('[OrderFlow Report] Failed to save report cache to disk:', err);
  }
}

// Scan/Refresh All 1,000 stocks with optimized batch processing
let isScanningUniverse = false;

export async function scanUniverse1000({ isFullScan = false } = {}) {
  if (isScanningUniverse) {
    console.log('[OrderFlow Report] Scan already in progress. Skipping duplicate run.');
    return { success: false, message: 'Scan already in progress' };
  }

  isScanningUniverse = true;
  orderFlowReportCache.isScanning = true;
  orderFlowReportCache.scanProgress = 0;
  orderFlowReportCache.scanStatus = 'Scanning 1,000 stocks in optimized batches...';

  const startTime = Date.now();
  console.log(`[OrderFlow Report] 🚀 Starting Order Flow scan across 1,000 stocks universe...`);

  try {
    const universe = getUniverse1000();
    if (!universe || universe.length === 0) {
      throw new Error('Universe file is empty');
    }

    // Chunk into batches of 50 tokens
    const BATCH_CHUNK_SIZE = 50;
    const chunks = [];
    for (let i = 0; i < universe.length; i += BATCH_CHUNK_SIZE) {
      chunks.push(universe.slice(i, i + BATCH_CHUNK_SIZE));
    }

    console.log(`[OrderFlow Report] Split 1,000 stocks into ${chunks.length} batches of 50.`);

    // Quick map of existing items
    const itemMap = new Map();
    orderFlowReportCache.items.forEach(it => itemMap.set(it.token, it));

    for (let cIdx = 0; cIdx < chunks.length; cIdx++) {
      const chunk = chunks[cIdx];
      const nseTokens = chunk.map(c => c.token);

      try {
        const quoteRes = await angelOneBridge.getMarketQuotes({ NSE: nseTokens }, 'FULL');
        const fetched = quoteRes?.data?.fetched || [];

        for (const q of fetched) {
          const tokenStr = String(q.symbolToken);
          const meta = chunk.find(c => c.token === tokenStr);
          if (!meta) continue;

          const ltp = Number(q.ltp) || 0;
          const prevClose = Number(q.close) || ltp;
          const open = Number(q.open) || ltp;
          const high = Number(q.high) || ltp;
          const low = Number(q.low) || ltp;
          const changePct = Number(q.percentChange) || (prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0);
          const changePts = Number(q.netChange) || (ltp - prevClose);
          const volume = Number(q.tradeVolume) || 0;

          let existingItem = itemMap.get(tokenStr);

          // Calculate levels
          let levels;
          if (existingItem && existingItem.r4 && existingItem.s4 && !isFullScan) {
            levels = {
              r2: existingItem.r2, r3: existingItem.r3, r4: existingItem.r4, r5: existingItem.r5, r6: existingItem.r6,
              s2: existingItem.s2, s3: existingItem.s3, s4: existingItem.s4, s5: existingItem.s5, s6: existingItem.s6
            };
          } else {
            // Compute Marshall levels from yesterday's close and daily candle/range
            const estimatedRange = Math.max(prevClose * 0.015, Math.abs(high - low));
            const h_prev = prevClose + estimatedRange * 0.5;
            const l_prev = prevClose - estimatedRange * 0.5;
            levels = calculateOrderFlowLevels(h_prev, l_prev, prevClose);
          }

          const evalResult = evaluateMarketBias(ltp, levels);
          const istTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST';

          const updatedItem = {
            symbol: meta.symbol,
            cleanSymbol: meta.cleanSymbol,
            name: meta.name || meta.cleanSymbol,
            token: meta.token,
            tradingsymbol: q.tradingSymbol || meta.tradingsymbol,
            exchange: 'NSE',
            sector: meta.sector || 'NSE Equity',
            isFno: !!meta.isFno,
            ltp,
            changePct: Math.round(changePct * 100) / 100,
            changePts: Math.round(changePts * 100) / 100,
            open,
            high,
            low,
            close: prevClose,
            volume,
            ...levels,
            support: levels.s3,
            resistance: levels.r3,
            breakoutLevel: levels.r4,
            breakdownLevel: levels.s4,
            momentumHigh: levels.r2,
            momentumLow: levels.s2,
            buyEntryZone: `${(levels.s3 * 0.997).toFixed(1)} - ${(levels.s3 * 1.003).toFixed(1)}`,
            sellEntryZone: `${(levels.r3 * 0.997).toFixed(1)} - ${(levels.r3 * 1.003).toFixed(1)}`,
            targetBullishT1: levels.r5,
            targetBullishT2: levels.r6,
            targetBearishT1: levels.s5,
            targetBearishT2: levels.s6,
            stopLossLong: levels.s4,
            stopLossShort: levels.r4,
            distanceToBreakoutPct: Math.round(((levels.r4 - ltp) / ltp) * 10000) / 100,
            distanceToBreakdownPct: Math.round(((ltp - levels.s4) / ltp) * 10000) / 100,
            distanceToBuyZonePct: Math.round(((ltp - levels.s3) / ltp) * 10000) / 100,
            distanceToSellZonePct: Math.round(((levels.r3 - ltp) / ltp) * 10000) / 100,
            ...evalResult,
            lastUpdated: istTime
          };

          itemMap.set(tokenStr, updatedItem);
        }
      } catch (err) {
        console.warn(`[OrderFlow Report] Batch ${cIdx + 1}/${chunks.length} warning:`, err.message);
      }

      orderFlowReportCache.scanProgress = Math.round(((cIdx + 1) / chunks.length) * 100);

      // Throttling to respect Angel One SmartAPI limits
      await new Promise(r => setTimeout(r, 280));
    }

    orderFlowReportCache.items = Array.from(itemMap.values());
    orderFlowReportCache.totalCount = orderFlowReportCache.items.length;
    orderFlowReportCache.lastUpdated = new Date().toISOString();
    recalculateReportSummary();
    saveReportCacheToDisk();

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
    orderFlowReportCache.scanStatus = `Scan Completed in ${elapsedSec}s (${orderFlowReportCache.items.length} stocks)`;
    console.log(`[OrderFlow Report] ✅ Finished scanning 1,000 stocks in ${elapsedSec}s!`);
    return { success: true, count: orderFlowReportCache.items.length, elapsedSec };
  } catch (err) {
    console.error('[OrderFlow Report] Scan error:', err);
    orderFlowReportCache.scanStatus = `Scan Failed: ${err.message}`;
    return { success: false, error: err.message };
  } finally {
    isScanningUniverse = false;
    orderFlowReportCache.isScanning = false;
  }
}

// Background market hours runner
function isNSEMarketHours() {
  const now = new Date();
  const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(now);
  if (dayStr === 'Sun' || dayStr === 'Sat') return false;

  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: 'numeric',
    hour12: false
  }).formatToParts(now);

  const hour = parseInt(parts.find(p => p.type === 'hour').value, 10);
  const minute = parseInt(parts.find(p => p.type === 'minute').value, 10);
  const totalMin = hour * 60 + minute;
  return totalMin >= 9 * 60 + 15 && totalMin <= 15 * 60 + 30; // 9:15 AM to 3:30 PM IST
}

// Auto-scan runner every 2 minutes during market hours
setInterval(() => {
  if (isNSEMarketHours() && !isScanningUniverse && angelOneBridge.isLoggedIn) {
    scanUniverse1000({ isFullScan: false }).catch(() => {});
  }
}, 120000);

// Export Excel workbook for 1,000 stocks report
export async function exportOrderFlowExcelBuffer() {
  const scratchXlsxPath = path.join(__dirname, '../scratch/xlsx.full.min.js').replace(/\\/g, '/');
  const XLSX = await import(`file:///${scratchXlsxPath}`).then(m => m.default || m);
  const wb = XLSX.utils.book_new();

  const items = orderFlowReportCache.items;
  const summary = orderFlowReportCache.summary;
  const updatedStr = orderFlowReportCache.lastUpdated ? new Date(orderFlowReportCache.lastUpdated).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'Live Realtime';

  // Sheet 1: Executive Summary
  const summaryAoa = [
    ['ORDER FLOW TRADING LEVELS REPORT (1,000 STOCKS)'],
    ['Powered by Marshall Matrix Order Flow Engine (Camarilla Institutional Structure)'],
    [],
    ['Report Metadata', 'Value'],
    ['Generated / Last Updated', updatedStr],
    ['Total Stocks Monitored', summary.total || items.length],
    ['Bullish Breakouts Active (R4+)', summary.bullishBreakout || 0],
    ['Approaching Breakout / Bullish', summary.bullish || 0],
    ['In Buy Reversal Zone (S3 Dips)', summary.inBuyZone || 0],
    ['Range-Bound / Neutral Value', summary.neutral || 0],
    ['In Sell Reversal Zone (R3 Rallies)', summary.inSellZone || 0],
    ['Approaching Breakdown / Bearish', summary.bearish || 0],
    ['Bearish Breakdowns Active (S4-)', summary.bearishBreakdown || 0],
    ['Stocks Near Critical Levels (<=0.5%)', summary.nearLevels || 0],
    [],
    ['Key Trading Rules & Framework Reference:'],
    ['1. Buy Reversal (S3): High-probability mean reversion dip buy zone. Target: R3. Invalidation SL: S4 breakdown.'],
    ['2. Sell Reversal (R3): High-probability mean reversion rally short zone. Target: S3. Invalidation SL: R4 breakout.'],
    ['3. Bullish Breakout (R4): Momentum expansion long trigger. Targets: R5 (Target 1), R6 (Target 2). Trail SL: R3.'],
    ['4. Bearish Breakdown (S4): Momentum expansion short trigger. Targets: S5 (Target 1), S6 (Target 2). Trail SL: S3.']
  ];
  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // Helper to format table rows
  const headers = [
    'Symbol', 'Name', 'Sector', 'F&O', 'LTP (₹)', 'Change %', 'Day High (₹)', 'Day Low (₹)', 'Prev Close (₹)',
    'Market Bias', 'Action Tag', 'Nearest Level', 'Distance to Near %',
    'Buy Reversal S3 (₹)', 'Buy Entry Zone', 'Sell Reversal R3 (₹)', 'Sell Entry Zone',
    'Bullish Breakout R4 (₹)', 'Bearish Breakdown S4 (₹)',
    'Momentum Range (S2 - R2)',
    'Bullish Target 1 R5 (₹)', 'Bullish Target 2 R6 (₹)',
    'Bearish Target 1 S5 (₹)', 'Bearish Target 2 S6 (₹)',
    'Stop Loss Long (₹)', 'Stop Loss Short (₹)',
    'Dist to Breakout %', 'Dist to Breakdown %'
  ];

  const formatRows = (list) => {
    return [
      headers,
      ...list.map(it => [
        it.symbol,
        it.name,
        it.sector,
        it.isFno ? 'YES' : 'NO',
        it.ltp,
        it.changePct,
        it.high,
        it.low,
        it.close,
        it.biasLabel,
        it.actionTag,
        it.nearestLevelName,
        Math.abs(it.distanceToBuyZonePct || 0),
        it.s3,
        it.buyEntryZone,
        it.r3,
        it.sellEntryZone,
        it.r4,
        it.s4,
        `${it.s2} - ${it.r2}`,
        it.r5,
        it.r6,
        it.s5,
        it.s6,
        it.stopLossLong,
        it.stopLossShort,
        it.distanceToBreakoutPct,
        it.distanceToBreakdownPct
      ])
    ];
  };

  // Sheet 2: All 1,000 Stocks
  const wsAll = XLSX.utils.aoa_to_sheet(formatRows(items));
  XLSX.utils.book_append_sheet(wb, wsAll, 'All 1000 Stocks');

  // Sheet 3: Bullish Breakouts & Momentum
  const bullishList = items.filter(it => it.bias === 'BULLISH_BREAKOUT' || it.bias === 'APPROACHING_BREAKOUT' || it.bias === 'BULLISH');
  if (bullishList.length > 0) {
    const wsBullish = XLSX.utils.aoa_to_sheet(formatRows(bullishList));
    XLSX.utils.book_append_sheet(wb, wsBullish, 'Bullish Breakouts');
  }

  // Sheet 4: Dip Buy Reversals (S3)
  const buyZoneList = items.filter(it => it.bias === 'IN_BUY_ZONE' || it.isNearLevel && it.nearestLevelName.includes('S3'));
  if (buyZoneList.length > 0) {
    const wsBuy = XLSX.utils.aoa_to_sheet(formatRows(buyZoneList));
    XLSX.utils.book_append_sheet(wb, wsBuy, 'Buy Zone (S3 Dips)');
  }

  // Sheet 5: Bearish Breakdown & Sell Zones (S4 / R3)
  const bearishList = items.filter(it => it.bias === 'BEARISH_BREAKDOWN' || it.bias === 'APPROACHING_BREAKDOWN' || it.bias === 'IN_SELL_ZONE');
  if (bearishList.length > 0) {
    const wsBearish = XLSX.utils.aoa_to_sheet(formatRows(bearishList));
    XLSX.utils.book_append_sheet(wb, wsBearish, 'Bearish Breakdowns & Sells');
  }

  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

// Export CSV string
export function exportOrderFlowCsvString() {
  const items = orderFlowReportCache.items;
  const headers = [
    'Symbol', 'Name', 'Sector', 'F&O', 'LTP', 'ChangePct', 'High', 'Low', 'PrevClose',
    'MarketBias', 'ActionTag', 'NearestLevel',
    'BuyReversal_S3', 'BuyEntryZone', 'SellReversal_R3', 'SellEntryZone',
    'BullishBreakout_R4', 'BearishBreakdown_S4', 'MomentumLow_S2', 'MomentumHigh_R2',
    'BullishTarget1_R5', 'BullishTarget2_R6', 'BearishTarget1_S5', 'BearishTarget2_S6',
    'StopLossLong', 'StopLossShort', 'DistanceBreakoutPct', 'DistanceBreakdownPct'
  ];

  const escapeCsv = (val) => {
    if (val === null || val === undefined) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };

  const rows = [
    headers.join(','),
    ...items.map(it => [
      escapeCsv(it.symbol),
      escapeCsv(it.name),
      escapeCsv(it.sector),
      it.isFno ? 'YES' : 'NO',
      it.ltp,
      it.changePct,
      it.high,
      it.low,
      it.close,
      escapeCsv(it.biasLabel),
      escapeCsv(it.actionTag),
      escapeCsv(it.nearestLevelName),
      it.s3,
      escapeCsv(it.buyEntryZone),
      it.r3,
      escapeCsv(it.sellEntryZone),
      it.r4,
      it.s4,
      it.s2,
      it.r2,
      it.r5,
      it.r6,
      it.s5,
      it.s6,
      it.stopLossLong,
      it.stopLossShort,
      it.distanceToBreakoutPct,
      it.distanceToBreakdownPct
    ].join(','))
  ];

  return rows.join('\r\n');
}

