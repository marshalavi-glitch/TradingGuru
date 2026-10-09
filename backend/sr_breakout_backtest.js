import fs from 'fs';
import path from 'path';
import { angelOneBridge } from 'file:///C:/Users/Admin-pc/Downloads/agents/backend/angelone_bridge.js';
import { buildExcelWorkbook, buildCsv } from 'file:///C:/Users/Admin-pc/Downloads/agents/backend/excel_generator.js';
import { LOT_SIZES, getAtmStrike, isIndexSymbol } from 'file:///C:/Users/Admin-pc/Downloads/agents/backend/sr_breakout_scanner.js';

const BACKTEST_SYMBOLS = [
  'NIFTY', 'BANKNIFTY', 'RELIANCE', 'TCS', 'INFY', 'HDFCBANK', 'ICICIBANK', 'SBIN',
  'BHARTIARTL', 'LT', 'AXISBANK', 'KOTAKBANK', 'TATAMOTORS', 'BAJFINANCE', 'ITC',
  'MARUTI', 'SUNPHARMA', 'TITAN', 'TATASTEEL', 'HINDALCO', 'JSWSTEEL', 'NTPC',
  'POWERGRID', 'ONGC', 'COALINDIA', 'BPCL', 'TATAPOWER', 'M&M', 'HEROMOTOCO',
  'EICHERMOT', 'VEDL', 'SAIL', 'NATIONALUM', 'HINDUNILVR', 'BRITANNIA', 'CIPLA',
  'DRREDDY', 'DIVISLAB', 'APOLLOHOSP', 'TRENT', 'BEL', 'HAL', 'SIEMENS', 'DLF',
  'ZOMATO', 'INDHOTEL', 'INDIGO', 'CHOLAFIN', 'PFC', 'RECLTD'
];

export async function runSrBreakoutBacktest(options = {}) {
  console.log('[SR Backtest Engine] Starting 90-Day SR Breakout (NR7) Backtest across Cash, Futures, and Options...');
  await angelOneBridge.login();

  const allCashTrades = [];
  const allFuturesTrades = [];
  const allOptionsTrades = [];
  let totalSetupsFound = 0;

  for (const sym of BACKTEST_SYMBOLS) {
    try {
      const isIndex = isIndexSymbol(sym);
      const symbolKey = isIndex ? `NSE:${sym}` : `NSE:${sym}`;
      const res = await angelOneBridge.getNormalizedCandles({
        symbol: symbolKey,
        timeframe: 'D',
        limit: 120
      });

      const candles = res?.candles || [];
      if (candles.length < 15) {
        console.warn(`[SR Backtest] Not enough candles for ${sym} (${candles.length})`);
        continue;
      }

      // Check candle format and sort chronologically
      candles.sort((a, b) => a.time - b.time);

      const lotSize = LOT_SIZES[sym] || (isIndex ? 25 : 500);

      // Iterate through candles from index 7
      for (let i = 7; i < candles.length; i++) {
        const nr7Candle = candles[i - 1]; // Day T-1
        const execCandle = candles[i];    // Day T

        // Filter: minimum price >= 50 rupees as requested
        if (nr7Candle.close < 50) continue;

        const nr7Range = Math.round((nr7Candle.high - nr7Candle.low) * 100) / 100;
        if (nr7Range <= 0.05) continue;

        // Check if day T-1 is the narrowest of the last 7 sessions
        let isNr7 = true;
        for (let k = 2; k <= 7; k++) {
          const prevCandle = candles[i - k];
          const prevRange = prevCandle.high - prevCandle.low;
          if (nr7Range >= prevRange) {
            isNr7 = false;
            break;
          }
        }

        if (!isNr7) continue;

        totalSetupsFound++;

        const setupDate = new Date(nr7Candle.time * 1000).toISOString().split('T')[0];
        const tradeDate = new Date(execCandle.time * 1000).toISOString().split('T')[0];

        const nr7High = nr7Candle.high;
        const nr7Low = nr7Candle.low;

        // Execution logic on Day T
        const dayHigh = execCandle.high;
        const dayLow = execCandle.low;
        const dayOpen = execCandle.open;
        const dayClose = execCandle.close;

        let triggeredDirection = null;
        const bullBreak = dayHigh > nr7High;
        const bearBreak = dayLow < nr7Low;

        if (bullBreak && bearBreak) {
          // Double breakout day: determine first trigger by open price proximity
          const distToHigh = Math.abs(dayOpen - nr7High);
          const distToLow = Math.abs(dayOpen - nr7Low);
          triggeredDirection = distToHigh <= distToLow ? 'Bullish' : 'Bearish';
        } else if (bullBreak) {
          triggeredDirection = 'Bullish';
        } else if (bearBreak) {
          triggeredDirection = 'Bearish';
        }

        if (!triggeredDirection) continue; // Inside day / no trigger

        let entryPrice, stopLoss, target1, target2, exitPrice, outcome, points;

        if (triggeredDirection === 'Bullish') {
          entryPrice = nr7High;
          stopLoss = nr7Low;
          target1 = Math.round((entryPrice + nr7Range) * 100) / 100;
          target2 = Math.round((entryPrice + 1.618 * nr7Range) * 100) / 100;

          if (dayHigh >= target2) {
            outcome = 'TARGET 2 HIT';
            exitPrice = target2;
            points = Math.round((target2 - entryPrice) * 100) / 100;
          } else if (dayHigh >= target1) {
            outcome = 'TARGET 1 HIT';
            exitPrice = target1;
            points = Math.round((target1 - entryPrice) * 100) / 100;
          } else if (dayLow <= stopLoss) {
            outcome = 'STOP LOSS HIT';
            exitPrice = stopLoss;
            points = Math.round((stopLoss - entryPrice) * 100) / 100;
          } else {
            outcome = 'SQUARE OFF';
            exitPrice = dayClose;
            points = Math.round((dayClose - entryPrice) * 100) / 100;
          }
        } else {
          // Bearish
          entryPrice = nr7Low;
          stopLoss = nr7High;
          target1 = Math.round((entryPrice - nr7Range) * 100) / 100;
          target2 = Math.round((entryPrice - 1.618 * nr7Range) * 100) / 100;

          if (dayLow <= target2) {
            outcome = 'TARGET 2 HIT';
            exitPrice = target2;
            points = Math.round((entryPrice - target2) * 100) / 100;
          } else if (dayLow <= target1) {
            outcome = 'TARGET 1 HIT';
            exitPrice = target1;
            points = Math.round((entryPrice - target1) * 100) / 100;
          } else if (dayHigh >= stopLoss) {
            outcome = 'STOP LOSS HIT';
            exitPrice = stopLoss;
            points = Math.round((entryPrice - stopLoss) * 100) / 100;
          } else {
            outcome = 'SQUARE OFF';
            exitPrice = dayClose;
            points = Math.round((entryPrice - dayClose) * 100) / 100;
          }
        }

        const riskPts = nr7Range;
        const rewardPts = Math.round(Math.abs(target1 - entryPrice) * 100) / 100;
        const rrRatio = `1 : ${(rewardPts / Math.max(0.1, riskPts)).toFixed(2)}`;

        // 1. CASH TRADE (Excluded for Index as per requirement)
        if (!isIndex) {
          const cashQty = Math.max(1, Math.round(100000 / entryPrice));
          const cashPnl = Math.round(points * cashQty);
          const cashPnlPct = Math.round((points / entryPrice) * 10000) / 100;

          allCashTrades.push({
            date: tradeDate,
            setupDate,
            symbol: sym,
            segment: 'Cash',
            direction: triggeredDirection,
            strikeInfo: 'Spot',
            nr7Range,
            entryPrice,
            stopLoss,
            target1,
            target2,
            exitPrice,
            outcome,
            points,
            lotSize: cashQty,
            netPnl: cashPnl,
            pnlPct: cashPnlPct,
            rrRatio
          });
        }

        // 2. FUTURES TRADE (Stock futures and Index futures)
        const futPnl = Math.round(points * lotSize);
        const futPnlPct = Math.round((points / entryPrice) * 10000) / 100;

        allFuturesTrades.push({
          date: tradeDate,
          setupDate,
          symbol: `${sym} FUT`,
          underlying: sym,
          segment: 'Futures',
          direction: triggeredDirection,
          strikeInfo: 'Futures',
          nr7Range,
          entryPrice,
          stopLoss,
          target1,
          target2,
          exitPrice,
          outcome,
          points,
          lotSize,
          netPnl: futPnl,
          pnlPct: futPnlPct,
          rrRatio
        });

        // 3. OPTIONS TRADE (ATM CE for Bullish, ATM PE for Bearish)
        const strike = getAtmStrike(sym, entryPrice);
        const optType = triggeredDirection === 'Bullish' ? 'CE' : 'PE';

        let defaultRatio = 0.014;
        if (sym === 'NIFTY') defaultRatio = 0.0039;
        else if (sym === 'BANKNIFTY') defaultRatio = 0.0083;
        else if (entryPrice > 2000) defaultRatio = 0.012;

        const optEntry = Math.max(0.5, Math.round(Math.max(entryPrice * defaultRatio, nr7Range * 0.45) * 10) / 10);
        const optT1 = Math.round((optEntry + nr7Range * 0.50) * 10) / 10;
        const optT2 = Math.round((optEntry + nr7Range * 1.618 * 0.50) * 10) / 10;
        const optSL = Math.max(0.5, Math.round((optEntry - nr7Range * 0.50) * 10) / 10);

        // Option points move with ATM Delta ~0.50
        const optPoints = Math.round(points * 0.50 * 10) / 10;
        const optExit = Math.max(0.1, Math.round((optEntry + optPoints) * 10) / 10);
        const optPnl = Math.round(optPoints * lotSize);
        const optPnlPct = Math.round((optPoints / optEntry) * 10000) / 100;

        allOptionsTrades.push({
          date: tradeDate,
          setupDate,
          symbol: `${sym} ${strike} ${optType}`,
          underlying: sym,
          segment: 'Options',
          direction: triggeredDirection === 'Bullish' ? 'BUY CE' : 'BUY PE',
          strikeInfo: `${strike} ${optType}`,
          nr7Range,
          entryPrice: optEntry,
          stopLoss: optSL,
          target1: optT1,
          target2: optT2,
          exitPrice: optExit,
          outcome,
          points: optPoints,
          lotSize,
          netPnl: optPnl,
          pnlPct: optPnlPct,
          rrRatio
        });
      }
    } catch (err) {
      console.warn(`[SR Backtest] Error processing ${sym}:`, err.message);
    }
  }

  const allTradesCombined = [...allCashTrades, ...allFuturesTrades, ...allOptionsTrades];
  allTradesCombined.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Performance calculations
  function calcStats(trades) {
    const total = trades.length;
    if (total === 0) return { totalTrades: 0, winRate: 0, profitFactor: 0, netPnl: 0 };
    const wins = trades.filter(t => t.points > 0);
    const losses = trades.filter(t => t.points < 0);
    const target2Hits = trades.filter(t => t.outcome === 'TARGET 2 HIT').length;
    const target1Hits = trades.filter(t => t.outcome === 'TARGET 1 HIT').length;
    const slHits = trades.filter(t => t.outcome === 'STOP LOSS HIT').length;
    const squareOffs = trades.filter(t => t.outcome === 'SQUARE OFF').length;

    const grossProfit = wins.reduce((acc, t) => acc + Math.max(0, t.netPnl), 0);
    const grossLoss = Math.abs(losses.reduce((acc, t) => acc + Math.min(0, t.netPnl), 0));
    const netPnl = grossProfit - grossLoss;
    const winRate = Math.round((wins.length / total) * 1000) / 10;
    const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : 9.99;
    const totalPoints = Math.round(trades.reduce((acc, t) => acc + t.points, 0) * 10) / 10;

    return {
      totalTrades: total,
      wins: wins.length,
      losses: losses.length,
      target2Hits,
      target1Hits,
      slHits,
      squareOffs,
      winRate,
      profitFactor,
      grossProfit,
      grossLoss,
      netPnl,
      totalPoints
    };
  }

  const overallStats = calcStats(allTradesCombined);
  const cashStats = calcStats(allCashTrades);
  const futuresStats = calcStats(allFuturesTrades);
  const optionsStats = calcStats(allOptionsTrades);

  console.log(`[SR Backtest Engine] Complete! Total Setups: ${totalSetupsFound}, Total Trades: ${allTradesCombined.length}`);
  console.log(`[SR Backtest] Overall Win Rate: ${overallStats.winRate}%, Profit Factor: ${overallStats.profitFactor}, Net P&L: ₹${overallStats.netPnl.toLocaleString('en-IN')}`);

  const backtestResult = {
    lastRunTime: new Date().toISOString(),
    totalSetupsFound,
    summary: overallStats,
    segments: {
      cash: cashStats,
      futures: futuresStats,
      options: optionsStats
    },
    trades: allTradesCombined
  };

  // Generate Excel Spreadsheet and CSV
  const excelBuffer = generateExcelReport(backtestResult);
  const csvContent = generateCsvReport(allTradesCombined);

  const dataDir = path.resolve('backend/data');
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  fs.writeFileSync(path.join(dataDir, 'sr_breakout_backtest.json'), JSON.stringify(backtestResult, null, 2), 'utf8');
  fs.writeFileSync(path.join(dataDir, 'sr_breakout_backtest.xlsx'), excelBuffer);
  fs.writeFileSync(path.join(dataDir, 'sr_breakout_backtest.csv'), csvContent, 'utf8');

  console.log(`[SR Backtest] Saved report files to backend/data/ (xlsx: ${excelBuffer.length} bytes, csv: ${csvContent.length} bytes)`);

  return backtestResult;
}

function generateExcelReport(data) {
  const { summary, segments, trades } = data;

  // Sheet 1: Executive Summary
  const summaryRows = [
    ['SR BREAKOUT (NR7) STRATEGY - HISTORICAL PERFORMANCE REPORT', '', '', '', ''],
    ['Generated On', new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }), '', '', ''],
    ['Strategy Universe', 'Top 50 F&O Liquid Equities + NIFTY & BANKNIFTY', '', '', ''],
    ['Filter Criteria', 'Stocks >= ₹25, Daily NR7 Narrowest Range in 7 Sessions', '', '', ''],
    ['Execution Rules', 'Trigger on Breakout of NR7 High (Long/CE) or Breakdown of NR7 Low (Short/PE)', '', '', ''],
    ['Stop Loss', 'Opposite boundary of NR7 Bar', '', '', ''],
    ['Target 1', '1.0x NR7 Measured Move Range Expansion', '', '', ''],
    ['Target 2', '1.618x NR7 Fibonacci Range Expansion', '', '', ''],
    ['', '', '', '', ''],
    ['EXECUTIVE PERFORMANCE KPI SUMMARY', '', '', '', ''],
    ['Metric', 'Value', '', 'Metric', 'Value'],
    ['Total Setups Identified', data.totalSetupsFound, '', 'Total Trades Executed', summary.totalTrades],
    ['Win Rate %', `${summary.winRate}%`, '', 'Profit Factor', summary.profitFactor],
    ['Winning Trades', summary.wins, '', 'Losing / Square Off Trades', summary.losses],
    ['Target 2 Hits (+1.618R)', summary.target2Hits, '', 'Target 1 Hits (+1.0R)', summary.target1Hits],
    ['Stop Loss Hits (-1.0R)', summary.slHits, '', 'Square Off at Close', summary.squareOffs],
    ['Total Net Points Captured', summary.totalPoints, '', 'Net Realized P&L (₹)', `₹${summary.netPnl.toLocaleString('en-IN')}`],
    ['Gross Profits (₹)', `₹${summary.grossProfit.toLocaleString('en-IN')}`, '', 'Gross Losses (₹)', `₹${summary.grossLoss.toLocaleString('en-IN')}`],
    ['', '', '', '', ''],
    ['SEGMENT-WISE PERFORMANCE BREAKDOWN', '', '', '', ''],
    ['Segment', 'Total Trades', 'Win Rate %', 'Profit Factor', 'Net P&L (₹)'],
    ['Cash Segment (>= ₹25)', segments.cash.totalTrades, `${segments.cash.winRate}%`, segments.cash.profitFactor, `₹${segments.cash.netPnl.toLocaleString('en-IN')}`],
    ['Futures Segment (Stock & Index)', segments.futures.totalTrades, `${segments.futures.winRate}%`, segments.futures.profitFactor, `₹${segments.futures.netPnl.toLocaleString('en-IN')}`],
    ['Options Segment (ATM CE / PE)', segments.options.totalTrades, `${segments.options.winRate}%`, segments.options.profitFactor, `₹${segments.options.netPnl.toLocaleString('en-IN')}`],
    ['Combined Portfolio', summary.totalTrades, `${summary.winRate}%`, summary.profitFactor, `₹${summary.netPnl.toLocaleString('en-IN')}`]
  ];

  // Sheet 2: Detailed Trades Log
  const tradeRows = [
    [
      'Trade Date',
      'Setup Date',
      'Symbol',
      'Segment',
      'Direction',
      'Strike / Instrument',
      'NR7 Range (₹)',
      'Entry Price (₹)',
      'Stop Loss (₹)',
      'Target 1 (₹)',
      'Target 2 (₹)',
      'Exit Price (₹)',
      'Trade Outcome',
      'Points Captured',
      'Lot Size / Qty',
      'Net P&L (₹)',
      'Return %',
      'Risk : Reward'
    ]
  ];

  trades.forEach(t => {
    tradeRows.push([
      t.date,
      t.setupDate,
      t.symbol,
      t.segment,
      t.direction,
      t.strikeInfo,
      t.nr7Range,
      t.entryPrice,
      t.stopLoss,
      t.target1,
      t.target2,
      t.exitPrice,
      t.outcome,
      t.points,
      t.lotSize,
      t.netPnl,
      `${t.pnlPct}%`,
      t.rrRatio
    ]);
  });

  const sheets = [
    {
      name: 'Executive Summary',
      colWidths: [32, 22, 5, 28, 22],
      rows: summaryRows
    },
    {
      name: 'Detailed Trades Log',
      colWidths: [14, 14, 22, 12, 14, 20, 14, 15, 15, 15, 15, 15, 18, 16, 14, 18, 12, 12],
      rows: tradeRows
    }
  ];

  return buildExcelWorkbook(sheets);
}

function generateCsvReport(trades) {
  const rows = [
    [
      'Trade Date',
      'Setup Date',
      'Symbol',
      'Segment',
      'Direction',
      'Strike / Instrument',
      'NR7 Range (₹)',
      'Entry Price (₹)',
      'Stop Loss (₹)',
      'Target 1 (₹)',
      'Target 2 (₹)',
      'Exit Price (₹)',
      'Trade Outcome',
      'Points Captured',
      'Lot Size / Qty',
      'Net P&L (₹)',
      'Return %',
      'Risk : Reward'
    ]
  ];

  trades.forEach(t => {
    rows.push([
      t.date,
      t.setupDate,
      t.symbol,
      t.segment,
      t.direction,
      t.strikeInfo,
      t.nr7Range,
      t.entryPrice,
      t.stopLoss,
      t.target1,
      t.target2,
      t.exitPrice,
      t.outcome,
      t.points,
      t.lotSize,
      t.netPnl,
      `${t.pnlPct}%`,
      t.rrRatio
    ]);
  });

  return buildCsv(rows);
}

// Auto-run only when executed directly via CLI
if (process.argv[1] && process.argv[1].endsWith('sr_breakout_backtest.js')) {
  runSrBreakoutBacktest().catch(err => {
    console.error('[SR Backtest Engine] Fatal error:', err);
  });
}
