import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getMp3DayUniverse } from '../backend/mp_3day_scanner.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load SheetJS
const XLSX = await import('./xlsx.full.min.js').then(m => m.default || m);

function computeDayProfileFromDaily(candle) {
  const dayHigh = Math.round(candle.high * 100) / 100;
  const dayLow = Math.round(candle.low * 100) / 100;
  const openPrice = Math.round(candle.open * 100) / 100;
  const closePrice = Math.round(candle.close * 100) / 100;
  const range = Math.round((dayHigh - dayLow) * 100) / 100;

  // Typical Price / POC
  const pocPrice = Math.round(((dayHigh + dayLow + closePrice) / 3) * 100) / 100;

  // Standard 70% Value Area Distribution
  let vahPrice, valPrice;
  if (closePrice >= openPrice) {
    // Bullish day: VA skews upwards
    vahPrice = Math.round(Math.min(dayHigh, pocPrice + 0.38 * range) * 100) / 100;
    valPrice = Math.round(Math.max(dayLow, pocPrice - 0.32 * range) * 100) / 100;
  } else {
    // Bearish day: VA skews downwards
    vahPrice = Math.round(Math.min(dayHigh, pocPrice + 0.32 * range) * 100) / 100;
    valPrice = Math.round(Math.max(dayLow, pocPrice - 0.38 * range) * 100) / 100;
  }

  const d = new Date((candle.time + 19800) * 1000);
  const dateStr = d.toISOString().split('T')[0];

  return {
    dateStr,
    dayHigh,
    dayLow,
    openPrice,
    closePrice,
    range,
    pocPrice,
    vahPrice,
    valPrice,
    volume: candle.volume || 0,
    time: candle.time
  };
}

function evaluate3DayCompressionPattern(sessions) {
  if (!sessions || sessions.length < 8) return null;

  const prior5 = sessions.slice(0, 5);
  const day1 = sessions[5];
  const day2 = sessions[6];
  const day3 = sessions[7];

  // 1. Day 1 Range must be strictly larger than ALL 5 previous trading days
  const prior5MaxRange = Math.max(...prior5.map(s => s.range));
  const isDay1Expansion = day1.range > (prior5MaxRange * 1.0001);
  if (!isDay1Expansion) {
    return null;
  }

  // 2. Day 2 VAH and VAL must be completely inside Day 1 VAH and VAL
  const isDay2VaInside = (day2.vahPrice <= day1.vahPrice * 1.0008) && (day2.valPrice >= day1.valPrice * 0.9992);
  if (!isDay2VaInside) {
    return null;
  }

  // 3. Day 3 must remain inside Day 2
  const isDay3VaInside = (day3.vahPrice <= day2.vahPrice * 1.0008) && (day3.valPrice >= day2.valPrice * 0.9992);
  const isDay3RangeInside = (day3.dayHigh <= day2.dayHigh * 1.0008) && (day3.dayLow >= day2.dayLow * 0.9992);

  if (!isDay3VaInside && !isDay3RangeInside) {
    return null;
  }

  let insideType = 'INSIDE_DAY_2';
  if (isDay3VaInside && isDay3RangeInside) {
    insideType = 'ULTRA_COIL';
  } else if (isDay3VaInside) {
    insideType = 'VA_INSIDE';
  } else {
    insideType = 'RANGE_INSIDE';
  }

  const rangeExpansionPct = Math.round(((day1.range - prior5MaxRange) / prior5MaxRange) * 1000) / 10;
  const compressionRatio = Math.round((day3.range / day1.range) * 1000) / 10;
  const day1VaWidth = Math.max(0.01, day1.vahPrice - day1.valPrice);
  const day3VaWidth = Math.max(0.01, day3.vahPrice - day3.valPrice);
  const vahCompressionRatio = Math.round((day3VaWidth / day1VaWidth) * 1000) / 10;

  const breakoutTriggerHigh = Math.round(Math.max(day1.vahPrice, day2.dayHigh, day3.dayHigh) * 100) / 100;
  const breakoutTriggerLow = Math.round(Math.min(day1.valPrice, day2.dayLow, day3.dayLow) * 100) / 100;

  const target1Bullish = Math.round((breakoutTriggerHigh + day1.range * 0.618) * 100) / 100;
  const target2Bullish = Math.round((breakoutTriggerHigh + day1.range * 1.0) * 100) / 100;
  const target1Bearish = Math.round((breakoutTriggerLow - day1.range * 0.618) * 100) / 100;
  const target2Bearish = Math.round((breakoutTriggerLow - day1.range * 1.0) * 100) / 100;

  return {
    day1,
    day2,
    day3,
    prior5: prior5.map(p => ({ date: p.dateStr, range: p.range, high: p.dayHigh, low: p.dayLow })),
    prior5MaxRange,
    rangeExpansionPct,
    compressionRatio,
    vahCompressionRatio,
    insideType,
    isDay2VaInside,
    isDay3VaInside,
    isDay3RangeInside,
    breakoutTriggerHigh,
    breakoutTriggerLow,
    target1Bullish,
    target2Bullish,
    target1Bearish,
    target2Bearish
  };
}

const BACKEND_URL = 'http://localhost:3002';

async function fetchCandles(symbol) {
  try {
    const res = await fetch(`${BACKEND_URL}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=D&limit=140`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.candles || [];
  } catch (err) {
    return [];
  }
}

async function run100DayBacktest() {
  console.log('🚀 Starting 100-Day Comprehensive Backtest for Market Profile • 3-Day Compression Pattern Scanner...');

  const universe = getMp3DayUniverse();
  console.log(`Universe size: ${universe.length} instruments.`);

  const allAlerts = [];
  const scannedSymbols = [];

  for (let i = 0; i < universe.length; i++) {
    const symbol = universe[i];
    process.stdout.write(`Scanning [${i + 1}/${universe.length}] ${symbol}... `);

    // Smooth delay between calls
    await new Promise(r => setTimeout(r, 200));

    let rawCandles = await fetchCandles(symbol);
    if (!rawCandles || rawCandles.length < 20) {
      console.log(`only ${rawCandles ? rawCandles.length : 0} candles, skipped`);
      continue;
    }

    rawCandles.sort((a, b) => a.time - b.time);
    scannedSymbols.push(symbol);

    const sessions = rawCandles.map(computeDayProfileFromDaily);

    const cleanName = symbol.replace(/^NSE:/, '').replace(/^MCX:/, '').replace(/^BSE:/, '');
    const sector = cleanName.includes('NIFTY') ? 'Index' : (symbol.startsWith('MCX:') ? 'Commodity' : 'Equity / F&O');

    let setupsFoundForSym = 0;

    // Slide window: sessions[idx-7..idx-3] = prior 5, sessions[idx-2] = Day 1, sessions[idx-1] = Day 2, sessions[idx] = Day 3
    // sessions[idx+1] = Day 4 (Alert Trigger Day)
    // sessions[idx+2] = Day 5 (Swing holding Day 1)
    // sessions[idx+3] = Day 6 (Swing holding Day 2)
    for (let idx = 7; idx < sessions.length - 1; idx++) {
      const window8 = sessions.slice(idx - 7, idx + 1);
      const pattern = evaluate3DayCompressionPattern(window8);
      if (!pattern) continue;

      const day1 = pattern.day1;
      const day2 = pattern.day2;
      const day3 = pattern.day3;
      const day4 = sessions[idx + 1];
      const day5 = sessions[idx + 2] || null;
      const day6 = sessions[idx + 3] || null;

      const triggerHigh = pattern.breakoutTriggerHigh;
      const triggerLow = pattern.breakoutTriggerLow;
      const target1Bull = pattern.target1Bullish;
      const target2Bull = pattern.target2Bullish;
      const target1Bear = pattern.target1Bearish;
      const target2Bear = pattern.target2Bearish;

      const stopLossBull = Math.round(day3.dayLow * 100) / 100;
      const stopLossBear = Math.round(day3.dayHigh * 100) / 100;

      // Check Day 4 triggers
      const isLongTrigger = day4.dayHigh >= triggerHigh;
      const isShortTrigger = day4.dayLow <= triggerLow;

      let triggeredDirection = 'NONE';
      let alertStatus = 'NO_BREAKOUT';
      let entryPrice = 'N/A';
      let exitPrice = day4.closePrice;
      let exitReason = 'N/A';
      let outcome = 'NO BREAKOUT (COILING) ⏸️';
      let mfePts = 0;
      let maePts = 0;
      let pnlPts = 0;
      let pnlPct = 0;
      let target1Hit = false;
      let target2Hit = false;
      let stoppedOut = false;

      if (isLongTrigger && !isShortTrigger) {
        triggeredDirection = 'LONG';
        alertStatus = 'BULLISH_BREAKOUT';
        entryPrice = Math.round(Math.max(day4.openPrice, triggerHigh) * 100) / 100;

        mfePts = Math.round((day4.dayHigh - entryPrice) * 100) / 100;
        maePts = Math.round((entryPrice - day4.dayLow) * 100) / 100;

        target2Hit = day4.dayHigh >= target2Bull;
        target1Hit = day4.dayHigh >= target1Bull;
        stoppedOut = day4.dayLow <= stopLossBull;

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

      } else if (isShortTrigger && !isLongTrigger) {
        triggeredDirection = 'SHORT';
        alertStatus = 'BEARISH_BREAKDOWN';
        entryPrice = Math.round(Math.min(day4.openPrice, triggerLow) * 100) / 100;

        mfePts = Math.round((entryPrice - day4.dayLow) * 100) / 100;
        maePts = Math.round((day4.dayHigh - entryPrice) * 100) / 100;

        target2Hit = day4.dayLow <= target2Bear;
        target1Hit = day4.dayLow <= target1Bear;
        stoppedOut = day4.dayHigh >= stopLossBear;

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

      } else if (isLongTrigger && isShortTrigger) {
        // Outside day: determine trigger by opening side
        if (day4.openPrice >= triggerHigh) {
          triggeredDirection = 'LONG';
          alertStatus = 'BULLISH_BREAKOUT';
          entryPrice = Math.round(day4.openPrice * 100) / 100;
          mfePts = Math.round((day4.dayHigh - entryPrice) * 100) / 100;
          maePts = Math.round((entryPrice - day4.dayLow) * 100) / 100;
          target1Hit = day4.dayHigh >= target1Bull;
          if (target1Hit) {
            outcome = 'TARGET 1 HIT 🎯';
            exitPrice = target1Bull;
            pnlPts = Math.round((target1Bull - entryPrice) * 100) / 100;
          } else {
            outcome = 'STOPPED OUT 🛑';
            exitPrice = stopLossBull;
            pnlPts = Math.round((stopLossBull - entryPrice) * 100) / 100;
          }
          pnlPct = Math.round(((pnlPts / entryPrice) * 100) * 100) / 100;
        } else {
          triggeredDirection = 'SHORT';
          alertStatus = 'BEARISH_BREAKDOWN';
          entryPrice = Math.round(day4.openPrice * 100) / 100;
          mfePts = Math.round((entryPrice - day4.dayLow) * 100) / 100;
          maePts = Math.round((day4.dayHigh - entryPrice) * 100) / 100;
          target1Hit = day4.dayLow <= target1Bear;
          if (target1Hit) {
            outcome = 'TARGET 1 HIT 🎯';
            exitPrice = target1Bear;
            pnlPts = Math.round((entryPrice - target1Bear) * 100) / 100;
          } else {
            outcome = 'STOPPED OUT 🛑';
            exitPrice = stopLossBear;
            pnlPts = Math.round((entryPrice - stopLossBear) * 100) / 100;
          }
          pnlPct = Math.round(((pnlPts / entryPrice) * 100) * 100) / 100;
        }
      }

      // Swing follow-through check
      let swingMfePts = mfePts;
      let swingPnlPts = pnlPts;
      let swingOutcome = outcome;
      if (triggeredDirection !== 'NONE') {
        const swingSessions = [day5, day6].filter(Boolean);
        if (swingSessions.length > 0) {
          if (triggeredDirection === 'LONG') {
            const swingHigh = Math.max(...swingSessions.map(s => s.dayHigh));
            const lastClose = swingSessions[swingSessions.length - 1].closePrice;
            swingMfePts = Math.round((Math.max(day4.dayHigh, swingHigh) - entryPrice) * 100) / 100;
            swingPnlPts = Math.round((lastClose - entryPrice) * 100) / 100;
            if (swingHigh >= target2Bull) swingOutcome = 'TARGET 2 HIT (SWING) 🎯🎯';
            else if (swingHigh >= target1Bull) swingOutcome = 'TARGET 1 HIT (SWING) 🎯';
          } else if (triggeredDirection === 'SHORT') {
            const swingLow = Math.min(...swingSessions.map(s => s.dayLow));
            const lastClose = swingSessions[swingSessions.length - 1].closePrice;
            swingMfePts = Math.round((entryPrice - Math.min(day4.dayLow, swingLow)) * 100) / 100;
            swingPnlPts = Math.round((entryPrice - lastClose) * 100) / 100;
            if (swingLow <= target2Bear) swingOutcome = 'TARGET 2 HIT (SWING) 🎯🎯';
            else if (swingLow <= target1Bear) swingOutcome = 'TARGET 1 HIT (SWING) 🎯';
          }
        }
      }

      const mfePct = (triggeredDirection !== 'NONE' && entryPrice > 0) ? Math.round(((mfePts / entryPrice) * 100) * 100) / 100 : 0;
      const maePct = (triggeredDirection !== 'NONE' && entryPrice > 0) ? Math.round(((maePts / entryPrice) * 100) * 100) / 100 : 0;
      const rrAchieved = (triggeredDirection !== 'NONE' && maePts > 0) ? Math.round((mfePts / maePts) * 10) / 10 : (mfePts > 0 ? 3.0 : 0);

      const monthStr = day4.dateStr.substring(0, 7); // YYYY-MM

      allAlerts.push({
        patternDateDay3: day3.dateStr,
        triggerDateDay4: day4.dateStr,
        monthStr,
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
        triggeredDirection,
        entryPrice,
        day4Open: day4.openPrice,
        day4High: day4.dayHigh,
        day4Low: day4.dayLow,
        day4Close: day4.closePrice,
        exitPrice: triggeredDirection !== 'NONE' ? exitPrice : 'N/A',
        exitReason: triggeredDirection !== 'NONE' ? exitReason : 'N/A',
        outcome,
        pnlPts: triggeredDirection !== 'NONE' ? pnlPts : 0,
        pnlPct: triggeredDirection !== 'NONE' ? pnlPct : 0,
        mfePts: triggeredDirection !== 'NONE' ? mfePts : 0,
        mfePct,
        maePts: triggeredDirection !== 'NONE' ? maePts : 0,
        maePct,
        rrAchieved,
        swingMfePts: triggeredDirection !== 'NONE' ? swingMfePts : 0,
        swingPnlPts: triggeredDirection !== 'NONE' ? swingPnlPts : 0,
        swingOutcome
      });

      setupsFoundForSym++;
    }

    console.log(`found ${setupsFoundForSym} setups`);
  }

  // Sort alerts chronologically
  allAlerts.sort((a, b) => a.triggerDateDay4.localeCompare(b.triggerDateDay4));

  console.log(`\n======================================================`);
  console.log(`🏁 100-Day Backtest Complete! Scanned ${scannedSymbols.length} symbols.`);
  console.log(`Total 3-Day Compression Setups: ${allAlerts.length}`);

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

  console.log(`Triggered Alerts: ${triggeredTrades.length} (Longs: ${longTrades.length}, Shorts: ${shortTrades.length}, Dormant: ${noBreakouts.length})`);
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
    ['MARKET PROFILE • 3-DAY COMPRESSION PATTERN SCANNER — 100-DAY BACKTEST REPORT'],
    ['Strategy Reference: Day 1 Range Expansion > Prior 5 Days | Day 2 VA Inside Day 1 VA | Day 3 Inside Day 2 (Ultra-Coil / VA Inside / Range Inside)'],
    ['Backtest Window: May 2026 – October 2026 (100+ Trading Sessions) | Universe: Major F&O Heavyweights, Indices & Commodities'],
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
    'Month',
    'Compression Type',
    'Direction',
    'Alert Status',
    'Trigger / Entry Price (₹)',
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
    'Swing MFE (Pts)',
    'Swing Outcome',
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
    'Day 3 VAL (₹)'
  ];

  const logRows = [headers];

  stats.allAlerts.forEach(a => {
    logRows.push([
      a.triggerDateDay4,
      a.symbol,
      a.cleanName,
      a.sector,
      a.monthStr,
      a.insideType,
      a.triggeredDirection,
      a.alertStatus,
      a.entryPrice,
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
      a.swingMfePts,
      a.swingOutcome,
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
      a.day3Val
    ]);
  });

  const wsLog = XLSX.utils.aoa_to_sheet(logRows);
  wsLog['!cols'] = [
    { wch: 14 }, { wch: 16 }, { wch: 14 }, { wch: 14 }, { wch: 10 },
    { wch: 16 }, { wch: 12 }, { wch: 20 }, { wch: 18 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 22 }, { wch: 22 }, { wch: 12 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 12 }, { wch: 14 }, { wch: 24 }, { wch: 14 }, { wch: 16 }
  ];
  XLSX.utils.book_append_sheet(wb, wsLog, 'Alerts & Trade Log');

  // 3. MONTHLY & DAILY BREAKDOWN SHEET
  const monthMap = {};
  stats.allAlerts.forEach(a => {
    const m = a.monthStr;
    if (!monthMap[m]) {
      monthMap[m] = {
        month: m,
        totalSetups: 0,
        triggered: 0,
        dormant: 0,
        wins: 0,
        losses: 0,
        t1Count: 0,
        t2Count: 0,
        totalPnlPct: 0
      };
    }
    monthMap[m].totalSetups++;
    if (a.triggeredDirection !== 'NONE') {
      monthMap[m].triggered++;
      monthMap[m].totalPnlPct += a.pnlPct;
      if (a.pnlPts > 0) monthMap[m].wins++;
      else monthMap[m].losses++;
      if (a.outcome.includes('TARGET 1')) monthMap[m].t1Count++;
      if (a.outcome.includes('TARGET 2')) monthMap[m].t2Count++;
    } else {
      monthMap[m].dormant++;
    }
  });

  const monthlyHeaders = [
    'Month',
    'Setups Found',
    'Triggered Trades',
    'Dormant / Coiling',
    'Wins',
    'Losses',
    'Win Rate (%)',
    'Target 1 Hits',
    'Target 2 Hits',
    'Net Return (%)',
    'Avg Trade Gain (%)'
  ];

  const monthlyRows = [monthlyHeaders];
  Object.keys(monthMap).sort().forEach(m => {
    const mm = monthMap[m];
    const mWinRate = mm.triggered > 0 ? Math.round((mm.wins / mm.triggered) * 1000) / 10 : 0;
    const avgGain = mm.triggered > 0 ? Math.round((mm.totalPnlPct / mm.triggered) * 100) / 100 : 0;
    monthlyRows.push([
      mm.month,
      mm.totalSetups,
      mm.triggered,
      mm.dormant,
      mm.wins,
      mm.losses,
      mWinRate,
      mm.t1Count,
      mm.t2Count,
      Math.round(mm.totalPnlPct * 100) / 100,
      avgGain
    ]);
  });

  const wsMonthly = XLSX.utils.aoa_to_sheet(monthlyRows);
  wsMonthly['!cols'] = [
    { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 },
    { wch: 10 }, { wch: 10 }, { wch: 14 }, { wch: 14 },
    { wch: 14 }, { wch: 14 }, { wch: 18 }
  ];
  XLSX.utils.book_append_sheet(wb, wsMonthly, 'Monthly Breakdown');

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

  // Write Excel file
  const excelBuffer = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });

  const filename = 'Market_Profile_3Day_Compression_Backtest_100Days.xlsx';

  const targetDirs = [
    path.join(__dirname, '../frontend/public/downloads'),
    path.join(__dirname, '../backend/data'),
    path.join(__dirname, '../frontend/dist/downloads'),
    path.join(__dirname, '../scratch'),
    path.join(__dirname, '..'),
    'C:/Users/Admin-pc/.gemini/antigravity/brain/3d25794b-336c-4bec-bda7-0ea4621d7e57'
  ];

  targetDirs.forEach(dir => {
    try {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      const fullPath = path.join(dir, filename);
      fs.writeFileSync(fullPath, excelBuffer);
      console.log(`Saved 100D Excel file to: ${fullPath} (${(excelBuffer.length / 1024).toFixed(1)} KB)`);
    } catch (e) {
      console.warn(`Failed to write to ${dir}:`, e.message);
    }
  });

  // Save JSON report
  const jsonReportPath = path.join(__dirname, '../backend/data/mp_3day_backtest_100days.json');
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
  console.log(`Saved 100D JSON report to: ${jsonReportPath}`);
}

run100DayBacktest().catch(err => {
  console.error('Backtest Fatal Error:', err);
});
