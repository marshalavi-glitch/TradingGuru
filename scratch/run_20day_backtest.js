import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { computeDayProfileVA, getMp3DayUniverse, evaluate3DayCompressionPattern } from '../backend/mp_3day_scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load SheetJS
const XLSX = await import('./xlsx.full.min.js').then(m => m.default || m);

const BACKEND_URL = 'http://localhost:3002';

async function fetchCandles(symbol) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=30&limit=300`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.candles || [];
  } catch (err) {
    console.error(`Failed to fetch candles for ${symbol}:`, err.message);
    return [];
  }
}

function formatISTTime(unixSec) {
  const d = new Date((unixSec + 19800) * 1000);
  return d.toISOString().replace('T', ' ').substring(0, 19);
}

function formatTimeOnly(unixSec) {
  const d = new Date((unixSec + 19800) * 1000);
  return d.toISOString().substring(11, 16) + ' IST';
}

async function runBacktest() {
  console.log('🚀 Starting 20-Day Backtest for Market Profile • 3-Day Compression Pattern Scanner...');
  const universe = getMp3DayUniverse();
  console.log(`Universe size: ${universe.length} instruments.`);

  const allAlerts = [];
  const scannedSymbols = [];

  for (let i = 0; i < universe.length; i++) {
    const symbol = universe[i];
    process.stdout.write(`Scanning [${i + 1}/${universe.length}] ${symbol}... `);

    // Rate limiting delay
    await new Promise(r => setTimeout(r, 200));

    const candles = await fetchCandles(symbol);
    if (!candles || candles.length < 50) {
      console.log('insufficient candles');
      continue;
    }

    // Group candles by IST date (YYYY-MM-DD)
    const daysMap = {};
    candles.forEach(c => {
      const istDate = new Date((c.time + 19800) * 1000).toISOString().split('T')[0];
      if (!daysMap[istDate]) daysMap[istDate] = [];
      daysMap[istDate].push(c);
    });

    const sortedDates = Object.keys(daysMap).sort();
    if (sortedDates.length < 9) { // Need at least 5 prior + Day 1 + Day 2 + Day 3 + Day 4 (trigger)
      console.log(`only ${sortedDates.length} days, skipped`);
      continue;
    }

    scannedSymbols.push(symbol);

    // Compute day profile for each session
    const sessions = sortedDates.map(dateStr => {
      const dayCandles = daysMap[dateStr];
      const prof = computeDayProfileVA(dayCandles);
      if (prof) {
        prof.rawCandles = dayCandles;
      }
      return prof;
    }).filter(Boolean);

    // Slide window: sessions[idx-7..idx-3] = prior 5, sessions[idx-2] = Day 1, sessions[idx-1] = Day 2, sessions[idx] = Day 3
    // sessions[idx+1] = Day 4 (Alert Trigger / Execution session)
    // Optional sessions[idx+2] = Day 5 (Swing follow-through)
    let symbolSetupsCount = 0;

    for (let idx = 7; idx < sessions.length - 1; idx++) {
      const window8 = sessions.slice(idx - 7, idx + 1); // 8 sessions ending at Day 3
      const pattern = evaluate3DayCompressionPattern(window8);
      if (!pattern) continue;

      const day1 = pattern.day1;
      const day2 = pattern.day2;
      const day3 = pattern.day3;
      const day4 = sessions[idx + 1]; // Trade execution day
      const day5 = sessions[idx + 2] || null; // Follow through

      const cleanName = symbol.replace(/^NSE:/, '').replace(/^MCX:/, '').replace(/^BSE:/, '');
      const sector = cleanName.includes('NIFTY') ? 'Index' : (symbol.startsWith('MCX:') ? 'Commodity' : 'Equity / F&O');

      const triggerHigh = pattern.breakoutTriggerHigh;
      const triggerLow = pattern.breakoutTriggerLow;
      const target1Bull = pattern.target1Bullish;
      const target2Bull = pattern.target2Bullish;
      const target1Bear = pattern.target1Bearish;
      const target2Bear = pattern.target2Bearish;

      // Stop Loss levels (tight SL based on Day 3 extremes, conservative based on opposite boundary)
      const stopLossBull = Math.round(day3.dayLow * 100) / 100;
      const stopLossBear = Math.round(day3.dayHigh * 100) / 100;

      // Analyze Day 4 candles chronologically
      const day4Candles = day4.rawCandles || [];
      let triggeredDirection = null; // 'LONG' | 'SHORT' | null
      let entryPrice = null;
      let entryTime = null;
      let entryCandleIdx = -1;

      for (let cIdx = 0; cIdx < day4Candles.length; cIdx++) {
        const c = day4Candles[cIdx];
        if (c.high >= triggerHigh && triggeredDirection === null) {
          triggeredDirection = 'LONG';
          entryPrice = Math.round(Math.max(c.open, triggerHigh) * 100) / 100;
          entryTime = formatTimeOnly(c.time);
          entryCandleIdx = cIdx;
          break;
        } else if (c.low <= triggerLow && triggeredDirection === null) {
          triggeredDirection = 'SHORT';
          entryPrice = Math.round(Math.min(c.open, triggerLow) * 100) / 100;
          entryTime = formatTimeOnly(c.time);
          entryCandleIdx = cIdx;
          break;
        }
      }

      let alertStatus = 'NO_BREAKOUT';
      let outcome = 'NO BREAKOUT (COILING) ⏸️';
      let exitPrice = day4.closePrice;
      let exitReason = 'EOD Close';
      let mfePts = 0;
      let maePts = 0;
      let pnlPts = 0;
      let pnlPct = 0;
      let target1Hit = false;
      let target2Hit = false;
      let stoppedOut = false;
      let day4HighAfterEntry = day4.dayHigh;
      let day4LowAfterEntry = day4.dayLow;

      if (triggeredDirection === 'LONG') {
        alertStatus = 'BULLISH_BREAKOUT';
        const postEntryCandles = day4Candles.slice(entryCandleIdx);
        day4HighAfterEntry = Math.max(...postEntryCandles.map(c => c.high));
        day4LowAfterEntry = Math.min(...postEntryCandles.map(c => c.low));

        mfePts = Math.round((day4HighAfterEntry - entryPrice) * 100) / 100;
        maePts = Math.round((entryPrice - day4LowAfterEntry) * 100) / 100;

        // Check chronological target vs stop hit
        for (const c of postEntryCandles) {
          if (c.high >= target2Bull) {
            target2Hit = true;
            target1Hit = true;
          } else if (c.high >= target1Bull) {
            target1Hit = true;
          }
          if (c.low <= stopLossBull) {
            stoppedOut = true;
          }
        }

        if (target2Hit && !stoppedOut) {
          outcome = 'TARGET 2 HIT 🎯🎯';
          exitPrice = target2Bull;
          exitReason = 'Target 2 (1.0x Range Exp)';
          pnlPts = Math.round((target2Bull - entryPrice) * 100) / 100;
        } else if (target1Hit && !stoppedOut) {
          outcome = 'TARGET 1 HIT 🎯';
          exitPrice = target1Bull;
          exitReason = 'Target 1 (0.618x Range Exp)';
          pnlPts = Math.round((target1Bull - entryPrice) * 100) / 100;
        } else if (stoppedOut && !target1Hit) {
          outcome = 'STOPPED OUT 🛑';
          exitPrice = stopLossBull;
          exitReason = 'Day 3 Low Stop Loss';
          pnlPts = Math.round((stopLossBull - entryPrice) * 100) / 100;
        } else {
          exitPrice = day4.closePrice;
          pnlPts = Math.round((day4.closePrice - entryPrice) * 100) / 100;
          if (pnlPts > 0) {
            outcome = 'CLOSED IN PROFIT 📈';
            exitReason = 'Day 4 EOD Market Close';
          } else {
            outcome = 'CLOSED IN LOSS 📉';
            exitReason = 'Day 4 EOD Market Close';
          }
        }
        pnlPct = Math.round(((pnlPts / entryPrice) * 100) * 100) / 100;

      } else if (triggeredDirection === 'SHORT') {
        alertStatus = 'BEARISH_BREAKDOWN';
        const postEntryCandles = day4Candles.slice(entryCandleIdx);
        day4HighAfterEntry = Math.max(...postEntryCandles.map(c => c.high));
        day4LowAfterEntry = Math.min(...postEntryCandles.map(c => c.low));

        mfePts = Math.round((entryPrice - day4LowAfterEntry) * 100) / 100;
        maePts = Math.round((day4HighAfterEntry - entryPrice) * 100) / 100;

        for (const c of postEntryCandles) {
          if (c.low <= target2Bear) {
            target2Hit = true;
            target1Hit = true;
          } else if (c.low <= target1Bear) {
            target1Hit = true;
          }
          if (c.high >= stopLossBear) {
            stoppedOut = true;
          }
        }

        if (target2Hit && !stoppedOut) {
          outcome = 'TARGET 2 HIT 🎯🎯';
          exitPrice = target2Bear;
          exitReason = 'Target 2 (1.0x Range Exp)';
          pnlPts = Math.round((entryPrice - target2Bear) * 100) / 100;
        } else if (target1Hit && !stoppedOut) {
          outcome = 'TARGET 1 HIT 🎯';
          exitPrice = target1Bear;
          exitReason = 'Target 1 (0.618x Range Exp)';
          pnlPts = Math.round((entryPrice - target1Bear) * 100) / 100;
        } else if (stoppedOut && !target1Hit) {
          outcome = 'STOPPED OUT 🛑';
          exitPrice = stopLossBear;
          exitReason = 'Day 3 High Stop Loss';
          pnlPts = Math.round((entryPrice - stopLossBear) * 100) / 100;
        } else {
          exitPrice = day4.closePrice;
          pnlPts = Math.round((entryPrice - day4.closePrice) * 100) / 100;
          if (pnlPts > 0) {
            outcome = 'CLOSED IN PROFIT 📈';
            exitReason = 'Day 4 EOD Market Close';
          } else {
            outcome = 'CLOSED IN LOSS 📉';
            exitReason = 'Day 4 EOD Market Close';
          }
        }
        pnlPct = Math.round(((pnlPts / entryPrice) * 100) * 100) / 100;
      }

      // Day 5 Swing Extension Check
      let day5MfePts = mfePts;
      let day5PnlPts = pnlPts;
      if (day5 && triggeredDirection) {
        if (triggeredDirection === 'LONG') {
          day5MfePts = Math.round((Math.max(day4HighAfterEntry, day5.dayHigh) - entryPrice) * 100) / 100;
          day5PnlPts = Math.round((day5.closePrice - entryPrice) * 100) / 100;
        } else if (triggeredDirection === 'SHORT') {
          day5MfePts = Math.round((entryPrice - Math.min(day4LowAfterEntry, day5.dayLow)) * 100) / 100;
          day5PnlPts = Math.round((entryPrice - day5.closePrice) * 100) / 100;
        }
      }

      const alertRecord = {
        patternDateDay3: day3.dateStr,
        triggerDateDay4: day4.dateStr,
        symbol,
        cleanName,
        sector,
        insideType: pattern.insideType,
        rangeExpansionPct: pattern.rangeExpansionPct,
        compressionRatioPct: pattern.compressionRatio,
        vahCompressionRatioPct: pattern.vahCompressionRatio,
        day1Date: day1.dateStr,
        day1High: day1.dayHigh,
        day1Low: day1.dayLow,
        day1Range: day1.range,
        day1Vah: day1.vahPrice,
        day1Val: day1.valPrice,
        day2Date: day2.dateStr,
        day2High: day2.dayHigh,
        day2Low: day2.dayLow,
        day2Range: day2.range,
        day2Vah: day2.vahPrice,
        day2Val: day2.valPrice,
        day3Date: day3.dateStr,
        day3High: day3.dayHigh,
        day3Low: day3.dayLow,
        day3Range: day3.range,
        day3Vah: day3.vahPrice,
        day3Val: day3.valPrice,
        breakoutTriggerHigh: triggerHigh,
        breakoutTriggerLow: triggerLow,
        target1Bullish: target1Bull,
        target2Bullish: target2Bull,
        target1Bearish: target1Bear,
        target2Bearish: target2Bear,
        stopLossLong: stopLossBull,
        stopLossShort: stopLossBear,
        alertStatus,
        triggeredDirection: triggeredDirection || 'NONE',
        entryPrice: entryPrice || 'N/A',
        entryTime: entryTime || 'N/A',
        day4Open: day4.openPrice,
        day4High: day4.dayHigh,
        day4Low: day4.dayLow,
        day4Close: day4.closePrice,
        exitPrice: triggeredDirection ? exitPrice : 'N/A',
        exitReason: triggeredDirection ? exitReason : 'N/A',
        outcome,
        pnlPts: triggeredDirection ? pnlPts : 0,
        pnlPct: triggeredDirection ? pnlPct : 0,
        mfePts: triggeredDirection ? mfePts : 0,
        mfePct: triggeredDirection && entryPrice ? Math.round(((mfePts / entryPrice) * 100) * 100) / 100 : 0,
        maePts: triggeredDirection ? maePts : 0,
        maePct: triggeredDirection && entryPrice ? Math.round(((maePts / entryPrice) * 100) * 100) / 100 : 0,
        rrAchieved: triggeredDirection && maePts > 0 ? Math.round((mfePts / maePts) * 10) / 10 : (mfePts > 0 ? 3.0 : 0),
        day5Date: day5 ? day5.dateStr : 'N/A',
        day5Close: day5 ? day5.closePrice : 'N/A',
        day5MfePts: triggeredDirection ? day5MfePts : 0,
        day5PnlPts: triggeredDirection ? day5PnlPts : 0
      };

      allAlerts.push(alertRecord);
      symbolSetupsCount++;
    }

    console.log(`found ${symbolSetupsCount} setups`);
  }

  console.log(`\n======================================================`);
  console.log(`🏁 Backtest Complete! Scanned ${scannedSymbols.length} symbols.`);
  console.log(`Total Compression Setups Found: ${allAlerts.length}`);

  const triggeredTrades = allAlerts.filter(a => a.triggeredDirection !== 'NONE');
  const longTrades = triggeredTrades.filter(a => a.triggeredDirection === 'LONG');
  const shortTrades = triggeredTrades.filter(a => a.triggeredDirection === 'SHORT');
  const noBreakouts = allAlerts.filter(a => a.triggeredDirection === 'NONE');

  const winTrades = triggeredTrades.filter(a => a.pnlPts > 0);
  const lossTrades = triggeredTrades.filter(a => a.pnlPts < 0);
  const t1Hits = triggeredTrades.filter(a => a.outcome.includes('TARGET 1'));
  const t2Hits = triggeredTrades.filter(a => a.outcome.includes('TARGET 2'));
  const stoppedTrades = triggeredTrades.filter(a => a.outcome.includes('STOPPED'));

  const winRate = triggeredTrades.length > 0 ? Math.round((winTrades.length / triggeredTrades.length) * 1000) / 10 : 0;
  const t1Rate = triggeredTrades.length > 0 ? Math.round((t1Hits.length / triggeredTrades.length) * 1000) / 10 : 0;
  const t2Rate = triggeredTrades.length > 0 ? Math.round((t2Hits.length / triggeredTrades.length) * 1000) / 10 : 0;

  const totalWinPts = winTrades.reduce((acc, t) => acc + t.pnlPts, 0);
  const totalLossPts = Math.abs(lossTrades.reduce((acc, t) => acc + t.pnlPts, 0));
  const profitFactor = totalLossPts > 0 ? Math.round((totalWinPts / totalLossPts) * 100) / 100 : (totalWinPts > 0 ? 99.9 : 0);

  const avgWinPct = winTrades.length > 0 ? Math.round((winTrades.reduce((acc, t) => acc + t.pnlPct, 0) / winTrades.length) * 100) / 100 : 0;
  const avgLossPct = lossTrades.length > 0 ? Math.round((lossTrades.reduce((acc, t) => acc + t.pnlPct, 0) / lossTrades.length) * 100) / 100 : 0;
  const avgMfePct = triggeredTrades.length > 0 ? Math.round((triggeredTrades.reduce((acc, t) => acc + t.mfePct, 0) / triggeredTrades.length) * 100) / 100 : 0;

  console.log(`Triggered Alerts: ${triggeredTrades.length} (Longs: ${longTrades.length}, Shorts: ${shortTrades.length}, Dormant/Coiled: ${noBreakouts.length})`);
  console.log(`Wins: ${winTrades.length} | Losses: ${lossTrades.length} | Stopped: ${stoppedTrades.length}`);
  console.log(`Win Rate: ${winRate}% | T1 Hits: ${t1Hits.length} (${t1Rate}%) | T2 Hits: ${t2Hits.length} (${t2Rate}%)`);
  console.log(`Profit Factor: ${profitFactor} | Avg Win: +${avgWinPct}% | Avg Loss: ${avgLossPct}% | Avg MFE: +${avgMfePct}%`);
  console.log(`======================================================\n`);

  // Build Excel Workbook
  buildExcelWorkbook({
    allAlerts,
    triggeredTrades,
    longTrades,
    shortTrades,
    noBreakouts,
    winTrades,
    lossTrades,
    t1Hits,
    t2Hits,
    stoppedTrades,
    winRate,
    t1Rate,
    t2Rate,
    profitFactor,
    avgWinPct,
    avgLossPct,
    avgMfePct
  });
}

function buildExcelWorkbook(stats) {
  const wb = XLSX.utils.book_new();

  // 1. EXECUTIVE SUMMARY SHEET
  const summaryAoa = [
    ['MARKET PROFILE • 3-DAY COMPRESSION PATTERN SCANNER — 20-DAY BACKTEST REPORT'],
    ['Strategy Reference: Day 1 Range Expansion > Prior 5 Days | Day 2 VA Inside Day 1 VA | Day 3 Inside Day 2 (Ultra-Coil / VA Inside / Range Inside)'],
    ['Backtest Window: September 2026 – October 2026 (20 Trading Sessions) | Universe: Major F&O Heavyweights, Indices & Commodities'],
    ['Generated On: ' + new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }) + ' IST'],
    [],
    ['KEY PERFORMANCE INDICATORS (KPIs)', 'VALUE', 'BENCHMARK / NOTES'],
    ['Total Compression Setups Identified', stats.allAlerts.length, 'Eligible 3-Day coiling patterns meeting exact rules'],
    ['Total Breakout / Breakdown Alerts Triggered', stats.triggeredTrades.length, 'Passed upper or lower breakout triggers on Day 4'],
    ['Coiling Setups Without Breakout (Dormant)', stats.noBreakouts.length, 'Remained inside coil all day without false breakout'],
    ['Breakout Trigger Ratio', `${Math.round((stats.triggeredTrades.length / Math.max(1, stats.allAlerts.length)) * 1000) / 10}%`, 'Percentage of setups that resolved into active trade alerts'],
    [],
    ['TRADE OUTCOMES & ACCURACY', 'VALUE', 'DETAILS'],
    ['Overall Win Rate (Profitable Exits)', `${stats.winRate}%`, 'Trades achieving Target 1, Target 2, or closing positive at EOD'],
    ['Target 1 Hit Rate (0.618x Day 1 Range Expansion)', `${stats.t1Rate}%`, `${stats.t1Hits.length} trades hit initial measured expansion target`],
    ['Target 2 Hit Rate (1.00x Day 1 Range Expansion)', `${stats.t2Rate}%`, `${stats.t2Hits.length} trades hit full 1:1 range expansion runner`],
    ['Stopped Out Rate (Strict Day 3 Opposite Extreme)', `${Math.round((stats.stoppedTrades.length / Math.max(1, stats.triggeredTrades.length)) * 1000) / 10}%`, `${stats.stoppedTrades.length} trades breached initial invalidation stop`],
    ['Profit Factor (Gross Win / Gross Loss)', stats.profitFactor, 'Total profit points vs total loss points ratio'],
    [],
    ['DIRECTIONAL ANALYSIS', 'COUNT', 'WIN RATE', 'AVG GAIN %'],
    ['Bullish Breakouts (Long Trades)', stats.longTrades.length, `${Math.round((stats.longTrades.filter(t => t.pnlPts > 0).length / Math.max(1, stats.longTrades.length)) * 1000) / 10}%`, `+${Math.round((stats.longTrades.reduce((acc, t) => acc + t.pnlPct, 0) / Math.max(1, stats.longTrades.length)) * 100) / 100}%`],
    ['Bearish Breakdowns (Short Trades)', stats.shortTrades.length, `${Math.round((stats.shortTrades.filter(t => t.pnlPts > 0).length / Math.max(1, stats.shortTrades.length)) * 1000) / 10}%`, `+${Math.round((stats.shortTrades.reduce((acc, t) => acc + t.pnlPct, 0) / Math.max(1, stats.shortTrades.length)) * 100) / 100}%`],
    [],
    ['EXCURSION & RISK/REWARD METRICS', 'VALUE', 'DESCRIPTION'],
    ['Average Winning Trade Return', `+${stats.avgWinPct}%`, 'Mean gain among winning trades'],
    ['Average Losing Trade Loss', `${stats.avgLossPct}%`, 'Mean drawdown among stopped/losing trades'],
    ['Average Max Favorable Excursion (MFE)', `+${stats.avgMfePct}%`, 'Peak intra-day favorable move before exit'],
    ['Reward-to-Risk Ratio (Avg Win / Avg Loss)', `${Math.abs(stats.avgLossPct) > 0 ? (Math.round((stats.avgWinPct / Math.abs(stats.avgLossPct)) * 100) / 100) : 'N/A'}:1`, 'Realized R:R ratio across all completed trades'],
    [],
    ['SETUP CLASSIFICATION BREAKDOWN', 'COUNT', 'TARGET 1 HITS', 'WIN RATE %'],
    ['Ultra-Coil (Both VA & Range Inside Day 2)', stats.allAlerts.filter(a => a.insideType === 'ULTRA_COIL').length, stats.allAlerts.filter(a => a.insideType === 'ULTRA_COIL' && a.outcome.includes('TARGET')).length, `${Math.round((stats.allAlerts.filter(a => a.insideType === 'ULTRA_COIL' && a.pnlPts > 0).length / Math.max(1, stats.allAlerts.filter(a => a.insideType === 'ULTRA_COIL' && a.triggeredDirection !== 'NONE').length)) * 1000) / 10}%`],
    ['VA Inside (Value Area Inside Day 2 VA)', stats.allAlerts.filter(a => a.insideType === 'VA_INSIDE').length, stats.allAlerts.filter(a => a.insideType === 'VA_INSIDE' && a.outcome.includes('TARGET')).length, `${Math.round((stats.allAlerts.filter(a => a.insideType === 'VA_INSIDE' && a.pnlPts > 0).length / Math.max(1, stats.allAlerts.filter(a => a.insideType === 'VA_INSIDE' && a.triggeredDirection !== 'NONE').length)) * 1000) / 10}%`],
    ['Range Inside (Range Inside Day 2 Range)', stats.allAlerts.filter(a => a.insideType === 'RANGE_INSIDE').length, stats.allAlerts.filter(a => a.insideType === 'RANGE_INSIDE' && a.outcome.includes('TARGET')).length, `${Math.round((stats.allAlerts.filter(a => a.insideType === 'RANGE_INSIDE' && a.pnlPts > 0).length / Math.max(1, stats.allAlerts.filter(a => a.insideType === 'RANGE_INSIDE' && a.triggeredDirection !== 'NONE').length)) * 1000) / 10}%`]
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summaryAoa);
  wsSummary['!cols'] = [{ wch: 45 }, { wch: 18 }, { wch: 55 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsSummary, 'Executive Summary');

  // 2. COMPLETE TRADE-BY-TRADE LOG SHEET
  const headers = [
    'Trigger Date (Day 4)',
    'Symbol',
    'Clean Name',
    'Sector',
    'Compression Type',
    'Direction',
    'Alert Status',
    'Trigger / Entry Price (₹)',
    'Trigger Time (IST)',
    'Day 4 Open (₹)',
    'Day 4 High (₹)',
    'Day 4 Low (₹)',
    'Day 4 Close (₹)',
    'Target 1 (₹)',
    'Target 2 (₹)',
    'Stop Loss (₹)',
    'Exit Price (₹)',
    'Exit Reason',
    'Trade Outcome',
    'P&L (Pts)',
    'P&L (%)',
    'MFE (Pts)',
    'MFE (%)',
    'MAE (Pts)',
    'MAE (%)',
    'Realized R:R',
    'Pattern Date (Day 3)',
    'Day 1 Expansion (%)',
    'Compression Ratio (%)',
    'Day 1 Range (₹)',
    'Day 2 Range (₹)',
    'Day 3 Range (₹)',
    'Day 1 VAH (₹)',
    'Day 1 VAL (₹)',
    'Day 2 VAH (₹)',
    'Day 2 VAL (₹)',
    'Day 3 VAH (₹)',
    'Day 3 VAL (₹)',
    'Day 5 Swing MFE (Pts)',
    'Day 5 Swing P&L (Pts)'
  ];

  const logRows = [headers];

  stats.allAlerts.forEach(a => {
    logRows.push([
      a.triggerDateDay4,
      a.symbol,
      a.cleanName,
      a.sector,
      a.insideType,
      a.triggeredDirection,
      a.alertStatus,
      a.entryPrice,
      a.entryTime,
      a.day4Open,
      a.day4High,
      a.day4Low,
      a.day4Close,
      a.triggeredDirection === 'LONG' ? a.target1Bullish : (a.triggeredDirection === 'SHORT' ? a.target1Bearish : `${a.target1Bullish} / ${a.target1Bearish}`),
      a.triggeredDirection === 'LONG' ? a.target2Bullish : (a.triggeredDirection === 'SHORT' ? a.target2Bearish : `${a.target2Bullish} / ${a.target2Bearish}`),
      a.triggeredDirection === 'LONG' ? a.stopLossLong : (a.triggeredDirection === 'SHORT' ? a.stopLossShort : 'N/A'),
      a.exitPrice,
      a.exitReason,
      a.outcome,
      a.pnlPts,
      a.pnlPct,
      a.mfePts,
      a.mfePct,
      a.maePts,
      a.maePct,
      a.rrAchieved,
      a.patternDateDay3,
      a.rangeExpansionPct,
      a.compressionRatioPct,
      a.day1Range,
      a.day2Range,
      a.day3Range,
      a.day1Vah,
      a.day1Val,
      a.day2Vah,
      a.day2Val,
      a.day3Vah,
      a.day3Val,
      a.day5MfePts,
      a.day5PnlPts
    ]);
  });

  const wsLog = XLSX.utils.aoa_to_sheet(logRows);
  wsLog['!cols'] = [
    { wch: 14 }, // Trigger Date
    { wch: 16 }, // Symbol
    { wch: 14 }, // Clean Name
    { wch: 14 }, // Sector
    { wch: 16 }, // Type
    { wch: 12 }, // Direction
    { wch: 20 }, // Alert Status
    { wch: 18 }, // Entry
    { wch: 15 }, // Time
    { wch: 12 }, // Open
    { wch: 12 }, // High
    { wch: 12 }, // Low
    { wch: 12 }, // Close
    { wch: 14 }, // T1
    { wch: 14 }, // T2
    { wch: 14 }, // SL
    { wch: 14 }, // Exit
    { wch: 22 }, // Exit Reason
    { wch: 22 }, // Outcome
    { wch: 12 }, // PnL Pts
    { wch: 12 }, // PnL Pct
    { wch: 12 }, // MFE Pts
    { wch: 12 }, // MFE Pct
    { wch: 12 }, // MAE Pts
    { wch: 12 }, // MAE Pct
    { wch: 12 }, // R:R
    { wch: 14 }, // Pattern Date
    { wch: 16 }, // Expansion Pct
    { wch: 16 }  // Compression Pct
  ];
  XLSX.utils.book_append_sheet(wb, wsLog, 'Alerts & Trade Log');

  // 3. DAILY PERFORMANCE BREAKDOWN SHEET
  const dailyGroups = {};
  stats.allAlerts.forEach(a => {
    const dt = a.triggerDateDay4;
    if (!dailyGroups[dt]) {
      dailyGroups[dt] = {
        date: dt,
        totalSetups: 0,
        triggered: 0,
        dormant: 0,
        wins: 0,
        losses: 0,
        t1Count: 0,
        t2Count: 0,
        netPnlPct: 0,
        symbols: []
      };
    }
    dailyGroups[dt].totalSetups++;
    if (a.triggeredDirection !== 'NONE') {
      dailyGroups[dt].triggered++;
      dailyGroups[dt].symbols.push(`${a.cleanName} (${a.triggeredDirection}: ${a.pnlPct > 0 ? '+' : ''}${a.pnlPct}%)`);
      dailyGroups[dt].netPnlPct += a.pnlPct;
      if (a.pnlPts > 0) dailyGroups[dt].wins++;
      else dailyGroups[dt].losses++;
      if (a.outcome.includes('TARGET 1')) dailyGroups[dt].t1Count++;
      if (a.outcome.includes('TARGET 2')) dailyGroups[dt].t2Count++;
    } else {
      dailyGroups[dt].dormant++;
      dailyGroups[dt].symbols.push(`${a.cleanName} (Coiling)`);
    }
  });

  const dailyHeaders = [
    'Date (Day 4)',
    'Setups Active',
    'Triggered Alerts',
    'Dormant / Coiling',
    'Wins',
    'Losses',
    'Daily Win Rate (%)',
    'Target 1 Hits',
    'Target 2 Hits',
    'Net Return Sum (%)',
    'Participating Symbols & Results'
  ];

  const dailyRows = [dailyHeaders];
  Object.keys(dailyGroups).sort().forEach(dt => {
    const g = dailyGroups[dt];
    const dWinRate = g.triggered > 0 ? Math.round((g.wins / g.triggered) * 1000) / 10 : 0;
    dailyRows.push([
      g.date,
      g.totalSetups,
      g.triggered,
      g.dormant,
      g.wins,
      g.losses,
      dWinRate,
      g.t1Count,
      g.t2Count,
      Math.round(g.netPnlPct * 100) / 100,
      g.symbols.join(', ')
    ]);
  });

  const wsDaily = XLSX.utils.aoa_to_sheet(dailyRows);
  wsDaily['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 16 }, { wch: 14 },
    { wch: 14 }, { wch: 16 }, { wch: 80 }
  ];
  XLSX.utils.book_append_sheet(wb, wsDaily, 'Daily Performance');

  // 4. SYMBOL-WISE AGGREGATION SHEET
  const symbolMap = {};
  stats.allAlerts.forEach(a => {
    if (!symbolMap[a.symbol]) {
      symbolMap[a.symbol] = {
        symbol: a.symbol,
        cleanName: a.cleanName,
        sector: a.sector,
        totalSetups: 0,
        triggered: 0,
        wins: 0,
        losses: 0,
        t1Count: 0,
        t2Count: 0,
        stopped: 0,
        totalPnlPts: 0,
        totalPnlPct: 0,
        maxGainPct: 0
      };
    }
    const sm = symbolMap[a.symbol];
    sm.totalSetups++;
    if (a.triggeredDirection !== 'NONE') {
      sm.triggered++;
      sm.totalPnlPts += a.pnlPts;
      sm.totalPnlPct += a.pnlPct;
      if (a.pnlPct > sm.maxGainPct) sm.maxGainPct = a.pnlPct;
      if (a.pnlPts > 0) sm.wins++;
      else sm.losses++;
      if (a.outcome.includes('TARGET 1')) sm.t1Count++;
      if (a.outcome.includes('TARGET 2')) sm.t2Count++;
      if (a.outcome.includes('STOPPED')) sm.stopped++;
    }
  });

  const symbolHeaders = [
    'Symbol',
    'Clean Name',
    'Sector',
    'Setups Found',
    'Triggered Trades',
    'Wins',
    'Losses',
    'Win Rate (%)',
    'Target 1 Hits',
    'Target 2 Hits',
    'Stopped Out',
    'Net Return (%)',
    'Max Single Trade Gain (%)'
  ];

  const symbolRows = [symbolHeaders];
  Object.values(symbolMap)
    .sort((a, b) => b.totalPnlPct - a.totalPnlPct)
    .forEach(sm => {
      const symWinRate = sm.triggered > 0 ? Math.round((sm.wins / sm.triggered) * 1000) / 10 : 0;
      symbolRows.push([
        sm.symbol,
        sm.cleanName,
        sm.sector,
        sm.totalSetups,
        sm.triggered,
        sm.wins,
        sm.losses,
        symWinRate,
        sm.t1Count,
        sm.t2Count,
        sm.stopped,
        Math.round(sm.totalPnlPct * 100) / 100,
        Math.round(sm.maxGainPct * 100) / 100
      ]);
    });

  const wsSymbol = XLSX.utils.aoa_to_sheet(symbolRows);
  wsSymbol['!cols'] = [
    { wch: 18 }, { wch: 14 }, { wch: 16 }, { wch: 14 },
    { wch: 16 }, { wch: 10 }, { wch: 10 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 },
    { wch: 22 }
  ];
  XLSX.utils.book_append_sheet(wb, wsSymbol, 'Symbol Performance');

  // Write Excel file to targets
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const targetDirs = [
    path.join(__dirname, '../frontend/public/downloads'),
    path.join(__dirname, '../backend/data'),
    path.join(__dirname, '../frontend/dist/downloads'),
    path.join(__dirname, '../scratch'),
    'C:/Users/Admin-pc/.gemini/antigravity/brain/3d25794b-336c-4bec-bda7-0ea4621d7e57'
  ];

  const filename = 'Market_Profile_3Day_Compression_Backtest_20Days.xlsx';

  targetDirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fullPath = path.join(dir, filename);
      fs.writeFileSync(fullPath, excelBuffer);
      console.log(`Saved Excel file to: ${fullPath} (${(excelBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.warn(`Failed to write to ${dir}:`, e.message);
    }
  });

  // Also write raw JSON for frontend or API integration
  const jsonReportPath = path.join(__dirname, '../backend/data/mp_3day_backtest_20days.json');
  fs.writeFileSync(jsonReportPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    summary: {
      totalAlerts: stats.allAlerts.length,
      triggeredTrades: stats.triggeredTrades.length,
      noBreakouts: stats.noBreakouts.length,
      winTrades: stats.winTrades.length,
      lossTrades: stats.lossTrades.length,
      winRate: stats.winRate,
      t1Hits: stats.t1Hits.length,
      t1Rate: stats.t1Rate,
      t2Hits: stats.t2Hits.length,
      t2Rate: stats.t2Rate,
      profitFactor: stats.profitFactor,
      avgWinPct: stats.avgWinPct,
      avgLossPct: stats.avgLossPct,
      avgMfePct: stats.avgMfePct
    },
    alerts: stats.allAlerts
  }, null, 2));
  console.log(`Saved JSON report to: ${jsonReportPath}`);
}

runBacktest().catch(err => {
  console.error('Backtest Fatal Error:', err);
});
