import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const nr7Cache = {
  lastScanTime: null,
  isScanning: false,
  results: [],
  date: null
};

const backupFilePath = path.join(__dirname, 'data/nr7_breakouts_today.json');

function saveNr7CacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: nr7Cache.date,
      results: nr7Cache.results,
      lastScanTime: nr7Cache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[20% Upper Circuit Scanner] Failed to save backup to disk:', err);
  }
}

export function loadNr7CacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.date === todayStr) {
        nr7Cache.date = data.date;
        nr7Cache.results = data.results || [];
        nr7Cache.lastScanTime = data.lastScanTime || null;
        console.log(`[20% Upper Circuit Scanner] Restored ${nr7Cache.results.length} candidates from disk cache.`);
      } else {
        console.log('[20% Upper Circuit Scanner] Disk cache is from a previous day or empty, starting clean.');
      }
    }
  } catch (err) {
    console.error('[20% Upper Circuit Scanner] Failed to load backup from disk:', err);
  }
}

function fetchCandles(tvBridge, symbol, timeframe, limit) {
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
    }, 3500);

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

    tvBridge.subscribeSymbol(symbol, timeframe, onData, onError, limit).then((cleanup) => {
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

function calculateSMA(candles, period) {
  if (!candles || candles.length < period) return null;
  const slice = candles.slice(candles.length - period);
  const sum = slice.reduce((acc, c) => acc + c.close, 0);
  return sum / period;
}

export async function scanNr7Breakouts(tvBridge, symbolsList) {
  if (nr7Cache.isScanning) return;
  nr7Cache.isScanning = true;

  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  if (nr7Cache.date !== todayStr) {
    nr7Cache.date = todayStr;
    nr7Cache.results = [];
  }

  console.log(`[20% Upper Circuit Scanner] Starting scan across ${symbolsList.length} symbols as per Chartink rules...`);
  const matchedList = [];

  for (let i = 0; i < symbolsList.length; i++) {
    const symbol = symbolsList[i];
    try {
      // Fetch Daily Candles (need at least 68 days for 60 SMA + 7 prior days)
      const dailyCandles = await fetchCandles(tvBridge, symbol, 'D', 90);
      if (!dailyCandles || dailyCandles.length < 68) continue;

      const D0 = dailyCandles[dailyCandles.length - 1];   // Today
      const D1 = dailyCandles[dailyCandles.length - 2];   // 1 day ago
      const D2 = dailyCandles[dailyCandles.length - 3];   // 2 days ago
      const D3 = dailyCandles[dailyCandles.length - 4];   // 3 days ago
      const D4 = dailyCandles[dailyCandles.length - 5];   // 4 days ago
      const D5 = dailyCandles[dailyCandles.length - 6];   // 5 days ago
      const D6 = dailyCandles[dailyCandles.length - 7];   // 6 days ago
      const D7 = dailyCandles[dailyCandles.length - 8];   // 7 days ago

      const R0 = D0.high - D0.low; // Today Range (Daily High - Daily Low)
      if (R0 <= 0) continue;

      // Rules 1-7: Today's range (Daily High - Daily Low) > range of 1, 2, 3, 4, 5, 6, 7 days ago
      const R1 = D1.high - D1.low;
      const R2 = D2.high - D2.low;
      const R3 = D3.high - D3.low;
      const R4 = D4.high - D4.low;
      const R5 = D5.high - D5.low;
      const R6 = D6.high - D6.low;
      const R7 = D7.high - D7.low;

      if (!(R0 > R1 && R0 > R2 && R0 > R3 && R0 > R4 && R0 > R5 && R0 > R6 && R0 > R7)) {
        continue;
      }

      // Rule 8: Daily Close > Daily Open
      if (!(D0.close > D0.open)) continue;

      // Rule 9: Daily Close > 1 day ago Open
      if (!(D0.close > D1.open)) continue;

      // Rule 12: 1 day ago Volume > 10,000
      if (!((D1.volume || 0) > 10000)) continue;

      // Rule 13 & 14: Daily 20 SMA > 40 SMA > 60 SMA
      const sma20 = calculateSMA(dailyCandles, 20);
      const sma40 = calculateSMA(dailyCandles, 40);
      const sma60 = calculateSMA(dailyCandles, 60);

      if (!sma20 || !sma40 || !sma60) continue;
      if (!(sma20 > sma40 && sma40 > sma60)) continue;

      // Rule 10: Weekly Close > Weekly Open
      const weeklyCandles = await fetchCandles(tvBridge, symbol, 'W', 5);
      if (!weeklyCandles || weeklyCandles.length === 0) continue;
      const W0 = weeklyCandles[weeklyCandles.length - 1];
      if (!(W0.close > W0.open)) continue;

      // Rule 11: Monthly Close > Monthly Open
      const monthlyCandles = await fetchCandles(tvBridge, symbol, 'M', 5);
      if (!monthlyCandles || monthlyCandles.length === 0) continue;
      const M0 = monthlyCandles[monthlyCandles.length - 1];
      if (!(M0.close > M0.open)) continue;

      // Calculate Day Change %
      const changePts = D0.close - D1.close;
      const changePct = (changePts / D1.close) * 100;
      const scanTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });

      matchedList.push({
        symbol,
        close: D0.close,
        open: D0.open,
        prevHigh: D1.high,
        prevLow: D1.low,
        prevRange: R1,
        todayRange: R0,
        changePts,
        changePct,
        volume: D0.volume || 0,
        sma20,
        sma40,
        sma60,
        time: scanTime
      });

      console.log(`[20% Upper Circuit Scanner] 🎯 MATCH FOUND: ${symbol} @ ₹${D0.close.toFixed(2)} (+${changePct.toFixed(2)}%)`);
    } catch (err) {
      console.warn(`[20% Upper Circuit Scanner] Error scanning ${symbol}:`, err.message);
    }
  }

  // Deduplicate results by symbol to ensure no duplicates
  const uniqueMap = new Map();
  matchedList.forEach((item) => {
    const key = item.symbol.toUpperCase();
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, item);
    }
  });

  const uniqueResults = Array.from(uniqueMap.values());

  // Sort by highest gain / strength
  uniqueResults.sort((a, b) => b.changePct - a.changePct);

  nr7Cache.results = uniqueResults;
  nr7Cache.lastScanTime = new Date().toISOString();
  nr7Cache.isScanning = false;

  saveNr7CacheToDisk();
  console.log(`[20% Upper Circuit Scanner] Scan cycle complete. Found ${uniqueResults.length} unique matching stocks.`);
}
