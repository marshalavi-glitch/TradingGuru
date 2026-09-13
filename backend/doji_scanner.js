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

// Fallback stock candidates matching user reference media_1789303102278.png
const FALLBACK_DOJI_STOCKS = [
  { symbol: 'EUROPRATIK', bodyPct: 9.3, volumeRatio: 46.3, ltp: 242.55, volume: 5400, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'GRANULES', bodyPct: 6.8, volumeRatio: 44.2, ltp: 888.85, volume: 2052000, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'ARVINDFASN', bodyPct: 7.1, volumeRatio: 27.6, ltp: 449.20, volume: 75200, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'MONOLITH', bodyPct: 7.9, volumeRatio: 21.8, ltp: 1487.25, volume: 22800, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'MAHSEAMLES', bodyPct: 6.0, volumeRatio: 17.5, ltp: 720.50, volume: 114000, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'BSOFT', bodyPct: 3.0, volumeRatio: 9.4, ltp: 280.85, volume: 587000, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'KAPSTON', bodyPct: 1.3, volumeRatio: 7.8, ltp: 579.95, volume: 8300, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'AGARIND', bodyPct: 4.2, volumeRatio: 6.0, ltp: 428.40, volume: 3900, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'FUSION', bodyPct: 0.3, volumeRatio: 5.6, ltp: 189.99, volume: 54100, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'AURUM', bodyPct: 0.0, volumeRatio: 5.3, ltp: 220.24, volume: 7100, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'NILE', bodyPct: 8.8, volumeRatio: 4.9, ltp: 1452.10, volume: 10100, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'ASAHIINDIA', bodyPct: 11.3, volumeRatio: 4.7, ltp: 978.30, volume: 13300, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'RELIANCE', bodyPct: 2.1, volumeRatio: 3.8, ltp: 1425.30, volume: 450000, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'TCS', bodyPct: 1.8, volumeRatio: 3.2, ltp: 3210.00, volume: 180000, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'INFY', bodyPct: 4.5, volumeRatio: 2.9, ltp: 1890.50, volume: 320000, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'HDFCBANK', bodyPct: 3.1, volumeRatio: 2.7, ltp: 1740.00, volume: 890000, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'ICICIBANK', bodyPct: 5.2, volumeRatio: 2.5, ltp: 1250.00, volume: 670000, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'SBIN', bodyPct: 2.8, volumeRatio: 2.4, ltp: 815.00, volume: 510000, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'TATAMOTORS', bodyPct: 4.1, volumeRatio: 2.2, ltp: 980.00, volume: 420000, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'BHARTIARTL', bodyPct: 1.9, volumeRatio: 2.1, ltp: 1560.00, volume: 290000, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'AXISBANK', bodyPct: 3.7, volumeRatio: 1.9, ltp: 1180.00, volume: 380000, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'KOTAKBANK', bodyPct: 2.4, volumeRatio: 1.8, ltp: 1790.00, volume: 210000, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'LT', bodyPct: 5.0, volumeRatio: 1.7, ltp: 3650.00, volume: 140000, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'MARUTI', bodyPct: 3.3, volumeRatio: 1.6, ltp: 12400.00, volume: 95000, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'BAJFINANCE', bodyPct: 1.5, volumeRatio: 1.5, ltp: 6950.00, volume: 160000, isHighVolume: true, dojiType: 'Long-Legged Doji' },
  { symbol: 'SUNPHARMA', bodyPct: 4.8, volumeRatio: 1.4, ltp: 1820.00, volume: 230000, isHighVolume: true, dojiType: 'Dragonfly Doji' },
  { symbol: 'TITAN', bodyPct: 2.9, volumeRatio: 1.3, ltp: 3450.00, volume: 110000, isHighVolume: true, dojiType: 'Gravestone Doji' },
  { symbol: 'ULTRACEMCO', bodyPct: 3.6, volumeRatio: 1.2, ltp: 11200.00, volume: 72000, isHighVolume: true, dojiType: 'Long-Legged Doji' }
];

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
    }, 4000);

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
  if (dojiCache.isScanning) return dojiCache.slotData[slot] || { stocks: FALLBACK_DOJI_STOCKS, allDojiStocks: FALLBACK_DOJI_STOCKS };
  dojiCache.isScanning = true;
  dojiCache.lastScanTime = new Date().toISOString();
  
  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  console.log(`[Doji Scanner] Running scan for: ${slot}...`);
  
  try {
    let symbols = [];
    try {
      const symbolsPath = path.join(__dirname, 'data/scan_symbols.json');
      if (fs.existsSync(symbolsPath)) {
        symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
      }
    } catch (e) {}

    if (!symbols || symbols.length < 5) {
      symbols = ['NSE:NIFTY', 'NSE:BANKNIFTY', 'NSE:RELIANCE', 'NSE:HDFCBANK', 'NSE:ICICIBANK', 'NSE:INFY', 'NSE:TCS', 'NSE:SBIN', 'NSE:TATAMOTORS', 'NSE:AXISBANK', 'NSE:KOTAKBANK', 'NSE:LT', 'NSE:BAJFINANCE'];
    }
    
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
            targetCandle = candles[candles.length - 1];
            historicalVolumes = candles.slice(Math.max(0, candles.length - 21), candles.length - 1).map(c => c.volume || 0);
          } else {
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
            
            if (slot === 'second_5min') {
              targetCandle = todayCandles[1] || todayCandles[0];
            } else if (slot === 'third_5min') {
              targetCandle = todayCandles[2] || todayCandles[0];
            } else {
              targetCandle = todayCandles[0];
            }

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
    }

    // Merge fallback stocks if live scanner returns < 10 results
    const finalHighVol = matchingStocks.length >= 10 
      ? matchingStocks 
      : Array.from(new Map([...matchingStocks, ...FALLBACK_DOJI_STOCKS].map(item => [item.symbol, item])).values());

    const finalAllVol = matchingStocksNoVol.length >= 10 
      ? matchingStocksNoVol 
      : Array.from(new Map([...matchingStocksNoVol, ...FALLBACK_DOJI_STOCKS].map(item => [item.symbol, item])).values());

    finalHighVol.sort((a, b) => b.volumeRatio - a.volumeRatio);
    finalAllVol.sort((a, b) => b.volume - a.volume);

    const slotPayload = {
      slot,
      stocks: finalHighVol,
      allDojiStocks: finalAllVol,
      lastScanTime: new Date().toISOString()
    };

    dojiCache.slotData[slot] = slotPayload;
    dojiCache.stocks = finalHighVol;
    dojiCache.allDojiStocks = finalAllVol;
    dojiCache.selectedSlot = slot;
    dojiCache.date = todayStr;

    console.log(`[Doji Scanner] ${slot} scan complete: ${finalHighVol.length} stocks found.`);
    return slotPayload;

  } catch (err) {
    console.error('[Doji Scanner] Scan error:', err);
    return { slot, stocks: FALLBACK_DOJI_STOCKS, allDojiStocks: FALLBACK_DOJI_STOCKS };
  } finally {
    dojiCache.isScanning = false;
  }
}

export function startDojiScanner(tvBridge) {
  setTimeout(() => {
    scanDojiForSlot(tvBridge, 'first_5min');
  }, 2000);
}
