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
    console.error('[NR7 Scanner] Failed to save backup to disk:', err);
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
        console.log(`[NR7 Scanner] Successfully restored ${nr7Cache.results.length} NR7 breakouts from disk cache.`);
      } else {
        console.log('[NR7 Scanner] Disk cache is from a previous day or empty, starting clean.');
      }
    }
  } catch (err) {
    console.error('[NR7 Scanner] Failed to load backup from disk:', err);
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

  console.log(`[NR7 Scanner] Starting scan across ${symbolsList.length} symbols...`);
  const matchedList = [];

  for (let i = 0; i < symbolsList.length; i++) {
    const symbol = symbolsList[i];
    try {
      // 1. Fetch Daily Candles
      const dailyCandles = await fetchCandles(tvBridge, symbol, 'D', 90);
      if (!dailyCandles || dailyCandles.length < 68) continue; // Need at least 60 days for 60 SMA + 7 prior days

      const currentDaily = dailyCandles[dailyCandles.length - 1];
      const prevDaily = dailyCandles[dailyCandles.length - 2];

      // Condition 1: Today's price breaks above previous day's high
      const isBreakoutAbovePrevHigh = currentDaily.close > prevDaily.high || currentDaily.high > prevDaily.high;
      if (!isBreakoutAbovePrevHigh) continue;

      // Condition 2: NR7 - Prev day trading range was narrowest of previous 7 trading days (D-1 vs D-2..D-8)
      const prevDayRange = prevDaily.high - prevDaily.low;
      if (prevDayRange <= 0) continue;

      let isNr7 = true;
      for (let k = 3; k <= 9; k++) {
        const pastCandle = dailyCandles[dailyCandles.length - k];
        if (!pastCandle) continue;
        const pastRange = pastCandle.high - pastCandle.low;
        if (prevDayRange >= pastRange) {
          isNr7 = false;
          break;
        }
      }
      if (!isNr7) continue;

      // Condition 3: Daily Close > Daily Open
      const isDailyBullish = currentDaily.close > currentDaily.open;
      if (!isDailyBullish) continue;

      // Condition 4: Volume > 10,000
      const currentVolume = currentDaily.volume || 0;
      if (currentVolume < 10000) continue;

      // Condition 5: 20 SMA > 40 SMA > 60 SMA
      const sma20 = calculateSMA(dailyCandles, 20);
      const sma40 = calculateSMA(dailyCandles, 40);
      const sma60 = calculateSMA(dailyCandles, 60);

      if (!sma20 || !sma40 || !sma60) continue;
      if (!(sma20 > sma40 && sma40 > sma60)) continue;

      // Condition 6: Weekly Close > Weekly Open
      const weeklyCandles = await fetchCandles(tvBridge, symbol, 'W', 5);
      if (!weeklyCandles || weeklyCandles.length === 0) continue;
      const currentWeekly = weeklyCandles[weeklyCandles.length - 1];
      const isWeeklyBullish = currentWeekly.close > currentWeekly.open;
      if (!isWeeklyBullish) continue;

      // Condition 7: Monthly Close > Monthly Open
      const monthlyCandles = await fetchCandles(tvBridge, symbol, 'M', 5);
      if (!monthlyCandles || monthlyCandles.length === 0) continue;
      const currentMonthly = monthlyCandles[monthlyCandles.length - 1];
      const isMonthlyBullish = currentMonthly.close > currentMonthly.open;
      if (!isMonthlyBullish) continue;

      // Calculate Day Change %
      const changePts = currentDaily.close - prevDaily.close;
      const changePct = (changePts / prevDaily.close) * 100;
      const scanTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });

      matchedList.push({
        symbol,
        close: currentDaily.close,
        open: currentDaily.open,
        prevHigh: prevDaily.high,
        prevLow: prevDaily.low,
        prevRange: prevDayRange,
        changePts,
        changePct,
        volume: currentVolume,
        sma20,
        sma40,
        sma60,
        time: scanTime
      });

      console.log(`[NR7 Scanner] 🎯 MATCH FOUND: ${symbol} @ ₹${currentDaily.close.toFixed(2)} (${changePct >= 0 ? '+' : ''}${changePct.toFixed(2)}%)`);
    } catch (err) {
      console.warn(`[NR7 Scanner] Error scanning ${symbol}:`, err.message);
    }
  }

  // Sort by highest gain / strength
  matchedList.sort((a, b) => b.changePct - a.changePct);

  nr7Cache.results = matchedList;
  nr7Cache.lastScanTime = new Date().toISOString();
  nr7Cache.isScanning = false;

  saveNr7CacheToDisk();
  console.log(`[NR7 Scanner] Scan cycle complete. Found ${matchedList.length} matching stocks.`);
}
