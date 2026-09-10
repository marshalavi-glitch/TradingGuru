import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dojiCache = {
  selectedSlot: 'first_5min', // 'first_5min' or 'daily'
  date: null,
  stocks: [],
  allDojiStocks: [],
  isScanning: false,
  lastScanTime: null,
  slotData: {} // stores results per slot
};

// Helper function to fetch candles
function fetchCandlesForSymbol(tvBridge, symbol, timeframe, limit) {
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
    }, 6000);

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

    tvBridge.subscribeSymbol(symbol, timeframe, onData, onError, limit)
      .then(async (fn) => {
        cleanupFn = fn;
        if (resolved) {
          try { await cleanupFn(); } catch (e) {}
          return;
        }
        if (cachedData && !resolved) {
          resolved = true;
          clearTimeout(timeout);
          try { await cleanupFn(); } catch (err) {}
          resolve(cachedData);
        }
      })
      .catch(() => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          resolve([]);
        }
      });
  });
}

export async function scanDojiForSlot(tvBridge, slot = 'first_5min') {
  if (dojiCache.isScanning) return dojiCache.slotData[slot] || { stocks: [], allDojiStocks: [] };
  dojiCache.isScanning = true;
  dojiCache.lastScanTime = new Date().toISOString();
  
  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  console.log(`[Doji Scanner] Running scan for: ${slot === 'first_5min' ? 'First 5-Min Candle' : 'Daily End-of-Day'}...`);
  
  try {
    const symbolsPath = path.join(__dirname, 'data/scan_symbols.json');
    const symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
    
    const matchingStocks = [];
    const matchingStocksNoVol = [];
    const BATCH_SIZE = 12;

    const tf = slot === 'daily' ? 'D' : '5';
    const limit = slot === 'daily' ? 100 : 300;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (symbol) => {
        try {
          const candles = await fetchCandlesForSymbol(tvBridge, symbol, tf, limit);
          if (!candles || candles.length < 5) return;

          let targetCandle = null;
          let historicalVolumes = [];

          if (slot === 'daily') {
            // End of Day Daily Candle
            targetCandle = candles[candles.length - 1];
            historicalVolumes = candles.slice(Math.max(0, candles.length - 21), candles.length - 1).map(c => c.volume || 0);
          } else {
            // First 5-minute candle of the day
            const dailyGroups = {};
            candles.forEach(c => {
              const date = new Date(c.time * 1000);
              const dStr = date.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
              if (!dailyGroups[dStr]) dailyGroups[dStr] = [];
              dailyGroups[dStr].push(c);
            });

            const dayKeys = Object.keys(dailyGroups);
            if (dayKeys.length === 0) return;

            const latestDayKey = dayKeys[dayKeys.length - 1];
            const todayCandles = dailyGroups[latestDayKey];
            if (!todayCandles || todayCandles.length === 0) return;

            todayCandles.sort((a, b) => a.time - b.time);
            targetCandle = todayCandles[0]; // Exactly First 5-min candle (9:15-9:20 AM)

            // Gather volume of first 5-min candles across previous days
            dayKeys.forEach(dKey => {
              if (dKey !== latestDayKey && dailyGroups[dKey].length > 0) {
                dailyGroups[dKey].sort((a, b) => a.time - b.time);
                historicalVolumes.push(dailyGroups[dKey][0].volume || 0);
              }
            });
          }

          if (!targetCandle) return;

          const bodySize = Math.abs(targetCandle.close - targetCandle.open);
          const range = targetCandle.high - targetCandle.low;
          if (range <= 0) return;

          const bodyPct = (bodySize / range) * 100;
          // Strict Classic Doji only (Body <= 15.0% of total candle range)
          const isDoji = bodyPct <= 15.0;

          if (!isDoji) return;

          let avgHistVol = 1;
          if (historicalVolumes.length > 0) {
            avgHistVol = historicalVolumes.reduce((s, v) => s + v, 0) / historicalVolumes.length;
          }
          const currentVol = targetCandle.volume || 0;
          const volumeRatio = avgHistVol > 0 ? parseFloat((currentVol / avgHistVol).toFixed(1)) : 1.0;
          const isHighVolume = volumeRatio >= 1.2;

          const lowerShadow = Math.min(targetCandle.open, targetCandle.close) - targetCandle.low;
          const upperShadow = targetCandle.high - Math.max(targetCandle.open, targetCandle.close);
          
          let dojiType = 'Classic Neutral Doji';
          if (lowerShadow >= range * 0.6) dojiType = 'Dragonfly Doji';
          else if (upperShadow >= range * 0.6) dojiType = 'Gravestone Doji';
          else if (lowerShadow >= range * 0.35 && upperShadow >= range * 0.35) dojiType = 'Long-Legged Doji';

          const stockObj = {
            symbol: symbol.replace('NSE:', '').replace('BSE:', ''),
            bodyPct: parseFloat(bodyPct.toFixed(1)),
            volumeRatio,
            ltp: targetCandle.close,
            high: targetCandle.high,
            low: targetCandle.low,
            volume: currentVol,
            avgVolume: Math.round(avgHistVol),
            isHighVolume,
            dojiType,
            slot
          };

          matchingStocksNoVol.push(stockObj);
          if (isHighVolume) {
            matchingStocks.push(stockObj);
          }

        } catch (e) {}
      });

      await Promise.all(batchPromises);
      await new Promise(r => setTimeout(r, 60));
    }

    matchingStocks.sort((a, b) => b.volumeRatio - a.volumeRatio);
    matchingStocksNoVol.sort((a, b) => b.volume - a.volume); // Sort all dojis by volume quantity

    const slotPayload = {
      slot,
      stocks: matchingStocks,
      allDojiStocks: matchingStocksNoVol,
      lastScanTime: new Date().toISOString()
    };

    dojiCache.slotData[slot] = slotPayload;
    dojiCache.stocks = matchingStocks;
    dojiCache.allDojiStocks = matchingStocksNoVol;
    dojiCache.selectedSlot = slot;
    dojiCache.date = todayStr;

    console.log(`[Doji Scanner] ${slot} scan complete: ${matchingStocks.length} high volume & ${matchingStocksNoVol.length} total.`);
    return slotPayload;

  } catch (err) {
    console.error('[Doji Scanner] Scan error:', err);
    return { slot, stocks: [], allDojiStocks: [] };
  } finally {
    dojiCache.isScanning = false;
  }
}

export function startDojiScanner(tvBridge) {
  setTimeout(() => {
    scanDojiForSlot(tvBridge, 'first_5min');
  }, 2000);
}
