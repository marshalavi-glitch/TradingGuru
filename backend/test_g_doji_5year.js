import './patch_ws.js';
import 'dotenv/config';
import { TradingViewBridge } from './tradingview.js';
import fs from 'fs';
import path from 'path';

async function fetchCandles(tvBridge, symbol, timeframe, limit = 5000) {
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
          reject(new Error(`Timeout fetching candles for ${symbol}`));
        }
      }
    }, 25000);

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

    tvBridge.subscribeSymbol(symbol, timeframe, onData, onError, limit).then(cleanup => {
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

function getISTDateTime(timestamp) {
  const d = new Date(timestamp * 1000);
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(d.getTime() + istOffset);
  const dateStr = istDate.toISOString().split('T')[0];
  const hours = istDate.getUTCHours();
  const minutes = istDate.getUTCMinutes();
  return { dateStr, hours, minutes, istDate };
}

async function run5YearGDojiBacktest() {
  const tvBridge = new TradingViewBridge();
  console.log("Fetching max historical 30-minute candles for NIFTY (NSE:NIFTY)...");

  try {
    const candles = await fetchCandles(tvBridge, 'NSE:NIFTY', '30', 10000);
    console.log(`Fetched ${candles.length} total 30-minute candles for NIFTY.`);

    // Group candles by trading day
    const dayMap = {};
    candles.forEach(c => {
      const { dateStr, hours, minutes } = getISTDateTime(c.time);
      if (!dayMap[dateStr]) dayMap[dateStr] = [];
      dayMap[dateStr].push({ ...c, hours, minutes });
    });

    const dayKeys = Object.keys(dayMap).sort();
    console.log(`Analyzing across ${dayKeys.length} total trading sessions (~${(dayKeys.length/250).toFixed(1)} years)...`);

    let gDojiBelowIBCount = 0;
    let gDojiTotalCount = 0;
    let breakdownContinuationCount = 0;
    let reversalBounceCount = 0;
    let chopCount = 0;

    const occurrences = [];

    dayKeys.forEach(date => {
      const dayCandles = dayMap[date];
      if (dayCandles.length < 10) return; // incomplete day

      // Indian Market 30m periods:
      // Period A: 09:15 - 09:45 (hours=9, min=15)
      // Period B: 09:45 - 10:15 (hours=9, min=45)
      // Period C: 10:15 - 10:45 (hours=10, min=15)
      // Period D: 10:45 - 11:15 (hours=10, min=45)
      // Period E: 11:15 - 11:45 (hours=11, min=15)
      // Period F: 11:45 - 12:15 (hours=11, min=45)
      // Period G: 12:15 - 12:45 (hours=12, min=15)
      // Second Half: Periods H to M (12:45 to 15:30)

      const periodA = dayCandles.find(c => (c.hours === 9 && c.minutes >= 15 && c.minutes < 45));
      const periodB = dayCandles.find(c => (c.hours === 9 && c.minutes >= 45) || (c.hours === 10 && c.minutes < 15));
      
      if (!periodA || !periodB) return;

      const ibHigh = Math.max(periodA.high, periodB.high);
      const ibLow = Math.min(periodA.low, periodB.low);

      const periodG = dayCandles.find(c => (c.hours === 12 && c.minutes >= 15 && c.minutes < 45));
      if (!periodG) return;

      // Doji Definition: Body size <= 25% of total candle range (High - Low)
      const gRange = periodG.high - periodG.low;
      const gBody = Math.abs(periodG.close - periodG.open);
      const isDoji = gRange > 0 && (gBody / gRange) <= 0.28;

      if (isDoji) {
        gDojiTotalCount++;

        // Condition: Period G closed strictly below Initial Balance (IB Low)
        const closedBelowIB = periodG.close < ibLow;

        if (closedBelowIB) {
          gDojiBelowIBCount++;

          // Analyze Second Half (After 12:45 PM / Periods H, I, J, K, L, M)
          const secondHalfCandles = dayCandles.filter(c => (c.hours === 12 && c.minutes >= 45) || (c.hours >= 13));
          
          if (secondHalfCandles.length > 0) {
            const shLow = Math.min(...secondHalfCandles.map(c => c.low));
            const shHigh = Math.max(...secondHalfCandles.map(c => c.high));
            const dayClose = dayCandles[dayCandles.length - 1].close;

            const extensionBelowG = periodG.close - shLow;
            const bounceAboveG = shHigh - periodG.close;
            const netSecondHalfMove = dayClose - periodG.close;

            let outcome = 'CHOP / CONSOLIDATION';
            // If price plunged further down by at least 25 points or made a deep session low
            if (extensionBelowG >= 30 && netSecondHalfMove < -10) {
              outcome = '🔥 VERTICAL BEARISH BREAKDOWN (Continuation)';
              breakdownContinuationCount++;
            } else if (bounceAboveG >= 40 && netSecondHalfMove > 20) {
              outcome = '🛡️ VIOLENT SHORT COVERING REVERSAL (Trapped Bears)';
              reversalBounceCount++;
            } else {
              chopCount++;
            }

            occurrences.push({
              date,
              ibHigh,
              ibLow,
              gOpen: periodG.open,
              gHigh: periodG.high,
              gLow: periodG.low,
              gClose: periodG.close,
              bodyPct: ((gBody/gRange)*100).toFixed(1),
              shLow,
              shHigh,
              dayClose,
              extensionBelowG: extensionBelowG.toFixed(1),
              bounceAboveG: bounceAboveG.toFixed(1),
              netSecondHalfMove: netSecondHalfMove.toFixed(1),
              outcome
            });
          }
        }
      }
    });

    console.log("\n=======================================================");
    console.log("📊 5-YEAR BACKTEST RESULTS: G-PERIOD DOJI CLOSED BELOW IB");
    console.log("=======================================================");
    console.log(`Total Trading Days Analyzed : ${dayKeys.length} days`);
    console.log(`Total G-Period Dojis Found  : ${gDojiTotalCount}`);
    console.log(`G-Period Dojis Closed < IB  : ${gDojiBelowIBCount}`);
    console.log(`-------------------------------------------------------`);
    console.log(`🔥 Bearish Breakdown Continues : ${breakdownContinuationCount} (${((breakdownContinuationCount/gDojiBelowIBCount)*100).toFixed(1)}%)`);
    console.log(`🛡️ Short Covering Squeeze (Trap) : ${reversalBounceCount} (${((reversalBounceCount/gDojiBelowIBCount)*100).toFixed(1)}%)`);
    console.log(`⚖️ Chopy / Range-Bound Close   : ${chopCount} (${((chopCount/gDojiBelowIBCount)*100).toFixed(1)}%)`);
    console.log("=======================================================\n");

    const outPath = path.join('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3', 'g_doji_5year_backtest_results.json');
    fs.writeFileSync(outPath, JSON.stringify({
      totalSessions: dayKeys.length,
      gDojiTotalCount,
      gDojiBelowIBCount,
      breakdownContinuationCount,
      reversalBounceCount,
      chopCount,
      breakdownPct: ((breakdownContinuationCount/gDojiBelowIBCount)*100).toFixed(1),
      reversalPct: ((reversalBounceCount/gDojiBelowIBCount)*100).toFixed(1),
      chopPct: ((chopCount/gDojiBelowIBCount)*100).toFixed(1),
      occurrences
    }, null, 2));

    console.log("Saved full historical occurrences to g_doji_5year_backtest_results.json");
    process.exit(0);

  } catch (err) {
    console.error("Backtest failed with error:", err);
    process.exit(1);
  }
}

run5YearGDojiBacktest();
