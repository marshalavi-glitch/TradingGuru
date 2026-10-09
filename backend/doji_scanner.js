import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const dojiCache = {
  selectedSlot: 'first_5min', // 'first_5min', 'second_5min', 'third_5min', or 'daily'
  date: null,
  stocks: [],
  allDojiStocks: [],
  isScanning: false,
  lastScanTime: null,
  slotData: {} // stores results per slot: { 'first_5min': { stocks: [], allDojiStocks: [], lastScanTime: '' }, ... }
};

const cacheFilePath = path.join(__dirname, 'data/doji_cache_today.json');

function saveDojiCacheToDisk() {
  try {
    const dir = path.dirname(cacheFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(cacheFilePath, JSON.stringify({
      date: dojiCache.date,
      lastScanTime: dojiCache.lastScanTime,
      slotData: dojiCache.slotData
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[Doji Scanner] Failed to save cache to disk:', err);
  }
}

export function loadDojiCacheFromDisk() {
  try {
    if (fs.existsSync(cacheFilePath)) {
      const data = JSON.parse(fs.readFileSync(cacheFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.date === todayStr) {
        dojiCache.date = data.date;
        dojiCache.lastScanTime = data.lastScanTime || null;
        dojiCache.slotData = data.slotData || {};
        const firstSlot = dojiCache.slotData['first_5min'];
        if (firstSlot) {
          dojiCache.stocks = firstSlot.stocks || [];
          dojiCache.allDojiStocks = firstSlot.allDojiStocks || [];
        }
        console.log(`[Doji Scanner] Restored today's Doji scan cache from disk (${Object.keys(dojiCache.slotData).length} slots).`);
      } else {
        console.log('[Doji Scanner] Cache file is from a previous date, starting clean for today.');
      }
    }
  } catch (err) {
    console.error('[Doji Scanner] Failed to load cache from disk:', err);
  }
}

async function fetchCandlesForSymbol(symbol, timeframe, limit) {
  // Pure Angel One SmartAPI datafeed
  try {
    const angelRes = await angelOneBridge.getNormalizedCandles({ symbol, timeframe, limit, isPriority: false });
    if (angelRes && angelRes.status && Array.isArray(angelRes.candles) && angelRes.candles.length > 0) {
      return angelRes.candles;
    }
  } catch (err) {
    console.warn(`[Doji Scanner] Angel One candle error for ${symbol}:`, err.message);
  }
  return [];
}

export async function scanDojiForSlot(slot = 'first_5min') {
  if (dojiCache.isScanning) {
    return dojiCache.slotData[slot] || { slot, stocks: [], allDojiStocks: [], lastScanTime: dojiCache.lastScanTime };
  }
  dojiCache.isScanning = true;
  dojiCache.lastScanTime = new Date().toISOString();
  
  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  if (dojiCache.date !== todayStr) {
    dojiCache.date = todayStr;
    dojiCache.slotData = {};
  }

  console.log(`[Doji Scanner] Running live market scan for slot: ${slot}...`);
  
  try {
    let symbols = [];
    try {
      const symbolsPath = path.join(__dirname, 'data/scan_symbols.json');
      if (fs.existsSync(symbolsPath)) {
        symbols = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
      }
    } catch (e) {}

    if (!symbols || symbols.length < 5) {
      symbols = ['NSE:RELIANCE', 'NSE:HDFCBANK', 'NSE:ICICIBANK', 'NSE:INFY', 'NSE:TCS', 'NSE:SBIN', 'NSE:TATAMOTORS', 'NSE:AXISBANK', 'NSE:KOTAKBANK', 'NSE:LT', 'NSE:BAJFINANCE'];
    }
    
    const matchingStocks = [];
    const matchingStocksNoVol = [];
    const BATCH_SIZE = 2;

    const tf = slot === 'daily' ? 'D' : '5';
    const limit = slot === 'daily' ? 100 : 300;

    for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
      const batch = symbols.slice(i, i + BATCH_SIZE);
      const batchPromises = batch.map(async (symbol) => {
        try {
          const candles = await fetchCandlesForSymbol(symbol, tf, limit);
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
      await new Promise(r => setTimeout(r, 450));
    }

    matchingStocks.sort((a, b) => b.volumeRatio - a.volumeRatio);
    matchingStocksNoVol.sort((a, b) => b.volume - a.volume);

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

    saveDojiCacheToDisk();

    console.log(`[Doji Scanner] Live market scan for ${slot} complete: ${matchingStocks.length} high-vol Dojis, ${matchingStocksNoVol.length} total Dojis found.`);
    return slotPayload;

  } catch (err) {
    console.error('[Doji Scanner] Live scan error:', err);
    return { slot, stocks: [], allDojiStocks: [], lastScanTime: new Date().toISOString() };
  } finally {
    dojiCache.isScanning = false;
  }
}

export function startDojiScanner() {
  loadDojiCacheFromDisk();

  setTimeout(() => {
    scanDojiForSlot('first_5min');
  }, 60000);
}
