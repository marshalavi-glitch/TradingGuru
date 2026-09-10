import './patch_ws.js';
import 'dotenv/config';
import { TradingViewBridge } from './tradingview.js';
import fs from 'fs';
import path from 'path';

async function fetchWeeklyCandles(tvBridge, symbol, limit = 500) {
  let cleanupFn = null;
  let resolved = false;
  let cachedData = null;

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        if (cleanupFn) {
          try { await cleanupFn(); } catch (e) {}
        }
        if (cachedData && cachedData.length > 0) {
          resolve(cachedData);
        } else {
          reject(new Error(`Timeout fetching weekly candles for ${symbol}`));
        }
      }
    }, 20000);

    const onData = async (data) => {
      if (data.isSnapshot && !resolved) {
        if (cleanupFn) {
          resolved = true;
          clearTimeout(timeout);
          try { await cleanupFn(); } catch (err) {}
          resolve(data.candles);
        } else {
          cachedData = data.candles;
        }
      } else if (!resolved && data.candles && data.candles.length > 0) {
        cachedData = data.candles;
      }
    };

    const onError = async (err) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (cleanupFn) {
          try { await cleanupFn(); } catch (e) {}
        }
        reject(err);
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
  if (candles.length < period) return [];
  const k = 2 / (period + 1);
  let emaArray = new Array(candles.length).fill(null);

  // Initial SMA for first period
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

async function run5YearWeekly200EMABacktest() {
  const tvBridge = new TradingViewBridge();
  
  const testSymbols = [
    'NSE:NIFTY', 
    'NSE:BANKNIFTY', 
    'NSE:RELIANCE', 
    'NSE:HDFCBANK', 
    'NSE:ICICIBANK', 
    'NSE:SBIN', 
    'NSE:TCS', 
    'NSE:INFY', 
    'NSE:ITC', 
    'NSE:LT', 
    'NSE:BHARTIARTL', 
    'NSE:TATAMOTORS', 
    'NSE:TATASTEEL', 
    'NSE:HINDALCO', 
    'NSE:AXISBANK', 
    'NSE:BAJFINANCE', 
    'NSE:KOTAKBANK', 
    'NSE:MARUTI', 
    'NSE:TITAN', 
    'NSE:ASIANPAINT'
  ];

  console.log(`Starting 5-Year Weekly 200 EMA Sweep Doji Backtest across ${testSymbols.length} Index & Bluechip Symbols...`);

  const allOccurrences = [];
  let totalDojiSweepEvents = 0;
  let massiveMultiMonthRallyCount = 0; // > 15% rally over 4-12 weeks
  let moderateBounceCount = 0; // 5% - 15% rally
  let failedBreakdownCount = 0; // < 0% (closed below EMA)

  for (const sym of testSymbols) {
    try {
      console.log(`Fetching weekly data for ${sym}...`);
      const candles = await fetchWeeklyCandles(tvBridge, sym, 500); // ~10 years of weekly data
      if (candles.length < 220) continue;

      const ema200 = calculateEMA(candles, 200);

      // Analyze every weekly candle from index 200 onwards
      for (let i = 200; i < candles.length - 4; i++) {
        const c = candles[i];
        const emaVal = ema200[i];
        if (!emaVal) continue;

        const range = c.high - c.low;
        const body = Math.abs(c.close - c.open);
        const lowerShadow = Math.min(c.open, c.close) - c.low;

        // Condition 1: Doji / Hammer / Spinning Top (Body <= 30% of Range)
        const isDoji = range > 0 && (body / range) <= 0.32;

        // Condition 2: Weekly 200 EMA Sweep:
        // The lower wick sweeps below or touches the Weekly 200 EMA (c.low <= emaVal * 1.015), 
        // BUT the candle closes strictly back ABOVE the Weekly 200 EMA (c.close >= emaVal)!
        const sweptBelowEMA = c.low <= (emaVal * 1.015);
        const closedAboveEMA = c.close >= (emaVal * 0.995);
        const hasLongLowerShadow = lowerShadow >= (range * 0.45); // lower shadow is at least 45% of candle range

        if (isDoji && sweptBelowEMA && closedAboveEMA && hasLongLowerShadow) {
          totalDojiSweepEvents++;

          // Analyze Forward Return over next 4 weeks (1 Month), 8 weeks (2 Months), and 12 weeks (1 Quarter)
          const future1Month = candles[Math.min(i + 4, candles.length - 1)].close;
          const future2Month = candles[Math.min(i + 8, candles.length - 1)].close;
          const future3Month = candles[Math.min(i + 12, candles.length - 1)].close;
          
          const maxHighIn12Weeks = Math.max(...candles.slice(i + 1, Math.min(i + 13, candles.length)).map(k => k.high));
          const maxLowIn12Weeks = Math.min(...candles.slice(i + 1, Math.min(i + 13, candles.length)).map(k => k.low));

          const maxRallyPct = ((maxHighIn12Weeks - c.close) / c.close) * 100;
          const maxDrawdownPct = ((maxLowIn12Weeks - c.close) / c.close) * 100;
          const return1MonthPct = ((future1Month - c.close) / c.close) * 100;
          const return3MonthPct = ((future3Month - c.close) / c.close) * 100;

          const dateStr = new Date(c.time * 1000).toISOString().split('T')[0];

          let outcome = 'MODERATE BOUNCE (+5% to +15%)';
          if (maxRallyPct >= 15.0 && return3MonthPct > 5.0) {
            outcome = '🚀 MASSIVE MULTI-MONTH MACRO BULL RALLY (> +15% to +60%)';
            massiveMultiMonthRallyCount++;
          } else if (maxRallyPct >= 5.0 && return1MonthPct > 0) {
            outcome = '🟢 CONFIRMED MACRO BOUNCE (+5% to +15%)';
            moderateBounceCount++;
          } else {
            outcome = '🔴 FAILED BREAKDOWN / CHOP';
            failedBreakdownCount++;
          }

          allOccurrences.push({
            symbol: sym.replace('NSE:', ''),
            date: dateStr,
            closePrice: c.close,
            lowPrice: c.low,
            ema200Val: parseFloat(emaVal.toFixed(2)),
            bodyPct: ((body / range) * 100).toFixed(1),
            lowerShadowPct: ((lowerShadow / range) * 100).toFixed(1),
            maxRallyPct: maxRallyPct.toFixed(1),
            maxDrawdownPct: maxDrawdownPct.toFixed(1),
            return1MonthPct: return1MonthPct.toFixed(1),
            return3MonthPct: return3MonthPct.toFixed(1),
            outcome
          });
        }
      }

      await new Promise(r => setTimeout(r, 200));
    } catch (e) {
      console.warn(`Error backtesting ${sym}:`, e.message || e);
    }
  }

  console.log("\n==========================================================================");
  console.log("📊 5-YEAR BACKTEST: WEEKLY DOJI SWEEP AT 200 EMA (INDEX & BLUECHIP STOCKS)");
  console.log("==========================================================================");
  console.log(`Total Symbols Tested          : ${testSymbols.length}`);
  console.log(`Total 200 EMA Sweep Dojis     : ${totalDojiSweepEvents}`);
  console.log(`--------------------------------------------------------------------------`);
  console.log(`🚀 Massive Multi-Month Rallies: ${massiveMultiMonthRallyCount} (${((massiveMultiMonthRallyCount/totalDojiSweepEvents)*100).toFixed(1)}%)`);
  console.log(`🟢 Confirmed Macro Bounces    : ${moderateBounceCount} (${((moderateBounceCount/totalDojiSweepEvents)*100).toFixed(1)}%)`);
  console.log(`🔴 Failed / Breakdown Drops   : ${failedBreakdownCount} (${((failedBreakdownCount/totalDojiSweepEvents)*100).toFixed(1)}%)`);
  console.log(`--------------------------------------------------------------------------`);
  const totalWins = massiveMultiMonthRallyCount + moderateBounceCount;
  console.log(`🏆 OVERALL MACRO WIN RATE     : ${totalWins}/${totalDojiSweepEvents} (${((totalWins/totalDojiSweepEvents)*100).toFixed(1)}%)`);
  console.log("==========================================================================\n");

  const outPath = path.join('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3', 'weekly_200_ema_doji_backtest.json');
  fs.writeFileSync(outPath, JSON.stringify({
    totalSymbols: testSymbols.length,
    totalEvents: totalDojiSweepEvents,
    massiveRallies: massiveMultiMonthRallyCount,
    moderateBounces: moderateBounceCount,
    failedBreakdowns: failedBreakdownCount,
    winRatePct: ((totalWins/totalDojiSweepEvents)*100).toFixed(1),
    allOccurrences
  }, null, 2));

  console.log("Saved full weekly 200 EMA occurrences to weekly_200_ema_doji_backtest.json");
  process.exit(0);
}

run5YearWeekly200EMABacktest();
