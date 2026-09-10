import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TradingViewBridge } from './tradingview.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const volumeTvBridge = new TradingViewBridge();

export const volumeCache = {
  lastScanTime: null,
  isScanning: false,
  results: [],
  date: null
};

const backupFilePath = path.join(__dirname, 'data/volume_breakouts_today.json');

function saveVolumeCacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: volumeCache.date,
      results: volumeCache.results,
      lastScanTime: volumeCache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[Volume Scanner] Failed to save backup to disk:', err);
  }
}

function loadVolumeCacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.date === todayStr) {
        volumeCache.date = data.date;
        volumeCache.results = data.results || [];
        volumeCache.lastScanTime = data.lastScanTime || null;
        console.log(`[Volume Scanner] Successfully restored ${volumeCache.results.length} accumulated breakouts from backup disk file.`);
      } else {
        console.log('[Volume Scanner] Backup file is from a previous day or empty, starting clean.');
      }
    }
  } catch (err) {
    console.error('[Volume Scanner] Failed to load backup from disk:', err);
  }
}

// Helper to fetch candles
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
        resolve([]);
      }
    }, 3000);

    const onData = async (data) => {
      if (data.isSnapshot && !resolved) {
        if (cleanupFn) {
          resolved = true;
          clearTimeout(timeout);
          try { await cleanupFn(); } catch (err) {}
          resolve(data.candles || []);
        } else {
          cachedData = data.candles || [];
        }
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

// Get upcoming expiry date (YYMMDD) based on day of week (3=Wednesday, 4=Thursday)
function getNearestExpiry(dayOfWeek) {
  const today = new Date();
  
  // Parse current hour/minute in Kolkata timezone
  const istTimeStr = today.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
  const [hours, minutes] = istTimeStr.split(':').map(Number);
  const timeVal = hours * 100 + minutes;

  for (let i = 0; i < 10; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === dayOfWeek) {
      // If it is today but past market hours (after 3:30 PM), skip to next week
      if (i === 0 && timeVal > 1530) {
        continue;
      }
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      return `${yy}${mm}${dd}`;
    }
  }
  return '';
}

// Retrieve F&O scan symbols
function getScanSymbols() {
  try {
    const symbolsPath = path.join(__dirname, 'data/scan_symbols.json');
    return JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
  } catch (err) {
    return ['NSE:NIFTY', 'NSE:BANKNIFTY'];
  }
}

export async function scanVolumeBreakouts(tvBridge) {
  if (volumeCache.isScanning) return;
  volumeCache.isScanning = true;
  volumeCache.lastScanTime = new Date().toISOString();

  console.log('[Volume Scanner] Starting intraday volume climax scan...');

  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  if (volumeCache.date !== todayStr) {
    volumeCache.results = [];
    volumeCache.date = todayStr;
  }
  const symbols = getScanSymbols();
  
  // Add base indices
  if (!symbols.includes('NSE:NIFTY')) symbols.unshift('NSE:NIFTY');
  if (!symbols.includes('NSE:BANKNIFTY')) symbols.unshift('NSE:BANKNIFTY');

  // Dynamically resolve ATM/OTM options for Nifty & Bank Nifty
  const niftyExp = getNearestExpiry(2); // Nifty expires on Tuesdays
  const bankExp = getNearestExpiry(2);  // Bank Nifty expires on Tuesdays
  const optionSymbols = [];

  // We fetch spot prices first to find ATM
  let niftySpot = 0;
  let bankSpot = 0;

  try {
    const niftyCandles = await fetchCandlesForSymbol(volumeTvBridge, 'NSE:NIFTY', 'D', 2);
    if (niftyCandles.length > 0) niftySpot = niftyCandles[niftyCandles.length - 1].close;

    const bankCandles = await fetchCandlesForSymbol(volumeTvBridge, 'NSE:BANKNIFTY', 'D', 2);
    if (bankCandles.length > 0) bankSpot = bankCandles[bankCandles.length - 1].close;
  } catch (e) {
    // Spot fetch failed
  }

  if (niftySpot > 0 && niftyExp) {
    const atm = Math.round(niftySpot / 50) * 50;
    // Scan ATM ± 300 range (13 strikes)
    const strikes = [
      atm - 300, atm - 250, atm - 200, atm - 150, atm - 100, atm - 50,
      atm,
      atm + 50, atm + 100, atm + 150, atm + 200, atm + 250, atm + 300
    ];
    strikes.forEach(s => {
      optionSymbols.push({ symbol: `NSE:NIFTY${niftyExp}C${s}`, strike: s, type: 'CE' });
      optionSymbols.push({ symbol: `NSE:NIFTY${niftyExp}P${s}`, strike: s, type: 'PE' });
    });
  }

  if (bankSpot > 0 && bankExp) {
    const atm = Math.round(bankSpot / 100) * 100;
    // Scan ATM ± 600 range (13 strikes)
    const strikes = [
      atm - 600, atm - 500, atm - 400, atm - 300, atm - 200, atm - 100,
      atm,
      atm + 100, atm + 200, atm + 300, atm + 400, atm + 500, atm + 600
    ];
    strikes.forEach(s => {
      optionSymbols.push({ symbol: `NSE:BANKNIFTY${bankExp}C${s}`, strike: s, type: 'CE' });
      optionSymbols.push({ symbol: `NSE:BANKNIFTY${bankExp}P${s}`, strike: s, type: 'PE' });
    });
  }

  const breakouts = [];
  const BATCH_SIZE = 15;

  // 1. Scan Stocks & Indices
  for (let i = 0; i < symbols.length; i += BATCH_SIZE) {
    const batch = symbols.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (symbol) => {
      try {
        const candles = await fetchCandlesForSymbol(volumeTvBridge, symbol, '5', 100);
        if (!candles || candles.length < 2) return;

        // Filter today's candles
        const todayCandles = candles.filter(c => {
          const d = new Date(c.time * 1000);
          return d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }) === todayStr;
        }).sort((a, b) => a.time - b.time);

        if (todayCandles.length < 2) return;

        // Evaluate all candles of today starting from the second candle
        for (let k = 1; k < todayCandles.length; k++) {
          const currentCandle = todayCandles[k];
          const prevCandles = todayCandles.slice(0, k);

          const prevMaxVol = Math.max(...prevCandles.map(c => c.volume));
          if (currentCandle.volume > prevMaxVol && currentCandle.volume > 20000) {
            const ratio = parseFloat((currentCandle.volume / prevMaxVol).toFixed(1));
            const date = new Date(currentCandle.time * 1000);
            const timeStr = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
            
            breakouts.push({
              symbol: symbol.replace('NSE:', ''),
              time: timeStr,
              currentVolume: currentCandle.volume,
              prevMaxVolume: prevMaxVol,
              ratio: ratio,
              close: currentCandle.close,
              direction: currentCandle.close >= currentCandle.open ? 'UP' : 'DOWN',
              type: symbol.includes('NIFTY') && !symbol.includes('BANK') && symbol.length <= 9 ? 'index' : 'stock'
            });
          }
        }
      } catch (err) {
        // Ignore errors
      }
    }));
    await new Promise(r => setTimeout(r, 350));
  }

  // 2. Scan Options
  for (let i = 0; i < optionSymbols.length; i += BATCH_SIZE) {
    const batch = optionSymbols.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (opt) => {
      try {
        const candles = await fetchCandlesForSymbol(volumeTvBridge, opt.symbol, '5', 100);
        if (!candles || candles.length < 2) return;

        const todayCandles = candles.filter(c => {
          const d = new Date(c.time * 1000);
          return d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }) === todayStr;
        }).sort((a, b) => a.time - b.time);

        if (todayCandles.length < 2) return;

        // Evaluate all candles of today starting from the second candle
        for (let k = 1; k < todayCandles.length; k++) {
          const currentCandle = todayCandles[k];
          const prevCandles = todayCandles.slice(0, k);

          const prevMaxVol = Math.max(...prevCandles.map(c => c.volume));
          if (currentCandle.volume > prevMaxVol && currentCandle.volume > 5000) {
            const ratio = parseFloat((currentCandle.volume / prevMaxVol).toFixed(1));
            const date = new Date(currentCandle.time * 1000);
            const timeStr = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });

            breakouts.push({
              symbol: opt.symbol.replace('NSE:', ''),
              time: timeStr,
              currentVolume: currentCandle.volume,
              prevMaxVolume: prevMaxVol,
              ratio: ratio,
              close: currentCandle.close,
              direction: currentCandle.close >= currentCandle.open ? 'UP' : 'DOWN',
              type: 'option',
              optionType: opt.type,
              strike: opt.strike
            });
          }
        }
      } catch (err) {
        // Ignore
      }
    }));
    await new Promise(r => setTimeout(r, 350));
  }

  // 3. Scan Futures
  const futuresSymbols = [
    'NSE:NIFTY1!', 'NSE:BANKNIFTY1!', 'NSE:FINNIFTY1!',
    'NSE:RELIANCE1!', 'NSE:HDFCBANK1!', 'NSE:ICICIBANK1!', 'NSE:SBIN1!',
    'NSE:TCS1!', 'NSE:INFY1!', 'NSE:BHARTIARTL1!', 'NSE:LT1!', 'NSE:ITC1!', 'NSE:AXISBANK1!'
  ];

  for (let i = 0; i < futuresSymbols.length; i += BATCH_SIZE) {
    const batch = futuresSymbols.slice(i, i + BATCH_SIZE);
    await Promise.all(batch.map(async (symbol) => {
      try {
        const candles = await fetchCandlesForSymbol(volumeTvBridge, symbol, '5', 100);
        if (!candles || candles.length < 2) return;

        const todayCandles = candles.filter(c => {
          const d = new Date(c.time * 1000);
          return d.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' }) === todayStr;
        }).sort((a, b) => a.time - b.time);

        if (todayCandles.length < 2) return;

        // Evaluate all candles of today starting from the second candle
        for (let k = 1; k < todayCandles.length; k++) {
          const currentCandle = todayCandles[k];
          const prevCandles = todayCandles.slice(0, k);

          const prevMaxVol = Math.max(...prevCandles.map(c => c.volume));
          if (currentCandle.volume > prevMaxVol && currentCandle.volume > 5000) {
            const ratio = parseFloat((currentCandle.volume / prevMaxVol).toFixed(1));
            const date = new Date(currentCandle.time * 1000);
            const timeStr = date.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });

            breakouts.push({
              symbol: symbol.replace('NSE:', ''),
              time: timeStr,
              currentVolume: currentCandle.volume,
              prevMaxVolume: prevMaxVol,
              ratio: ratio,
              close: currentCandle.close,
              direction: currentCandle.close >= currentCandle.open ? 'UP' : 'DOWN',
              type: 'futures'
            });
          }
        }
      } catch (err) {
        // Ignore
      }
    }));
    await new Promise(r => setTimeout(r, 350));
  }

  // Append new breakouts, avoiding duplicates (same symbol and time)
  breakouts.forEach(b => {
    const exists = volumeCache.results.some(existing => existing.symbol === b.symbol && existing.time === b.time);
    if (!exists) {
      volumeCache.results.push(b);
    }
  });

  // Sort by latest breakout time first (Time descending)
  volumeCache.results.sort((a, b) => b.time.localeCompare(a.time));

  console.log(`[Volume Scanner] Completed volume scan. Total accumulated breakouts today: ${volumeCache.results.length}`);
  
  // Save updated results to disk backup
  saveVolumeCacheToDisk();
  
  // Close the dedicated session after 10 seconds to allow all pending cleanups to finish safely
  const sessionToClose = volumeTvBridge.sharedSession;
  volumeTvBridge.sharedSession = null;
  volumeTvBridge.sessionPromise = null;
  
  if (sessionToClose) {
    setTimeout(async () => {
      console.log('[Volume Scanner] Closing dedicated WebSocket session to release resources.');
      try {
        await sessionToClose.close();
      } catch (e) {}
    }, 10000);
  }

  volumeCache.isScanning = false;
}

export function startVolumeScanner(tvBridge) {
  // Restore backup from disk if available
  loadVolumeCacheFromDisk();

  // Run volume scan 2 minutes after server boot to avoid startup congestion
  setTimeout(async () => {
    await scanVolumeBreakouts(tvBridge);
  }, 120000);

  // Repeat scan every 3 minutes to capture volume expansions in real-time
  setInterval(async () => {
    const now = new Date();
    const day = now.toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' });
    const isWeekday = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].includes(day);
    if (!isWeekday) return;

    const istTimeStr = now.toLocaleTimeString('en-US', { timeZone: 'Asia/Kolkata', hour12: false });
    const [hours, minutes] = istTimeStr.split(':').map(Number);
    const timeVal = hours * 100 + minutes;

    // Run only during active market hours (9:15 AM - 3:30 PM IST)
    if (timeVal >= 915 && timeVal <= 1530) {
      console.log(`[Volume Scanner] Running scheduled volume scan...`);
      await scanVolumeBreakouts(tvBridge);
    }
  }, 3 * 60 * 1000);
}
