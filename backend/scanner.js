import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Option Chain Helpers for Scanner
function detectStrikeInterval(symbol, ltp) {
  const sym = symbol.replace('NSE:', '').toUpperCase();
  if (sym === 'NIFTY') return 50;
  if (sym === 'BANKNIFTY') return 100;
  if (sym === 'FINNIFTY') return 50;
  
  const overrides = {
    'RELIANCE': 20,
    'HDFCBANK': 10,
    'ICICIBANK': 10,
    'SBIN': 10,
    'TCS': 50,
    'INFY': 20,
    'LT': 50,
    'ITC': 5,
    'AXISBANK': 10,
    'KOTAKBANK': 10,
    'BAJFINANCE': 100
  };
  if (overrides[sym]) return overrides[sym];
  
  if (ltp > 5000) return 100;
  if (ltp > 1500) return 20;
  if (ltp > 700) return 10;
  if (ltp > 250) return 5;
  return 2.5;
}

function getExpiriesForSymbol(symbol) {
  const sym = symbol.replace('NSE:', '').toUpperCase();
  const expiries = [];
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  
  if (sym === 'NIFTY' || sym === 'FINNIFTY') {
    for (let i = 0; i < 45; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      if (d.getDay() === 2) { // Tuesday
        if (d.getTime() >= todayMidnight) {
          const yy = String(d.getFullYear()).slice(-2);
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          expiries.push({
            code: `${yy}${mm}${dd}`,
            label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
          });
        }
      }
    }
  } else {
    for (let m = 0; m < 4; m++) {
      const d = new Date(today.getFullYear(), today.getMonth() + m + 1, 0); // Last day of month
      while (d.getDay() !== 2) { // Roll back to Tuesday
        d.setDate(d.getDate() - 1);
      }
      if (d.getTime() >= todayMidnight) {
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        expiries.push({
          code: `${yy}${mm}${dd}`,
          label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        });
      }
    }
  }
  return expiries;
}

function getAtmStrike(symbol, price) {
  const interval = detectStrikeInterval(symbol, price);
  return Math.round(price / interval) * interval;
}

async function findClosestValidOptionSymbol(symbol, price, optType, expiry) {
  const cleanSym = symbol.replace('NSE:', '').toUpperCase();
  const suffix = optType === 'C' ? 'CE' : 'PE';
  const interval = detectStrikeInterval(symbol, price);
  const estStrike = Math.round(price / interval) * interval;
  
  // Try querying Angel One SmartAPI for the exact scrip
  try {
    const searchPattern = `${cleanSym} ${estStrike} ${suffix}`;
    const angelResults = await angelOneBridge.searchScrips(searchPattern);
    if (angelResults && angelResults.length > 0) {
      return angelResults[0].value;
    }
  } catch (err) {}

  return `NSE:${cleanSym}${expiry}${optType === 'C' ? 'C' : 'P'}${estStrike}`;
}

// Global cached scan results for both 5m (Daily Levels) and Daily (Monthly Levels) scans
export const scannerCache = {
  lastScanTime: { '5': null, 'D': null },
  isScanning: { '5': false, 'D': false },
  results: {
    '5': {
      level1: [], level2: [], level3: [], level4: [], level5: [],
      level6: [], level7: [], level8: [], level9: [], level10: []
    },
    'D': {
      level1: [], level2: [], level3: [], level4: [], level5: [],
      level6: [], level7: [], level8: [], level9: [], level10: []
    }
  },
  levelsCache: { '5': {}, 'D': {} }, // Cache of calculated levels for all symbols
  todaySignals: [] // Persisted array of all level touches today
};

// Load persistent signals and levels cache from disk on startup
export function loadSignalsFromDisk() {
  try {
    const logPath = path.join(__dirname, 'data/today_signals_log.json');
    if (fs.existsSync(logPath)) {
      const fileData = JSON.parse(fs.readFileSync(logPath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (fileData.date === todayStr) {
        scannerCache.todaySignals = fileData.signals || [];
        console.log(`[Scanner] Loaded ${scannerCache.todaySignals.length} persistent signals from disk.`);
      } else {
        console.log('[Scanner] Stored signals belong to a previous day. Skipping reload.');
      }
    }

    const levelsPath = path.join(__dirname, 'data/levels_cache_backup.json');
    if (fs.existsSync(levelsPath)) {
      const cached = JSON.parse(fs.readFileSync(levelsPath, 'utf8'));
      if (cached['5'] && cached['D']) {
        scannerCache.levelsCache = cached;
        console.log(`[Scanner] Restored ${Object.keys(cached['5']).length} Daily and ${Object.keys(cached['D']).length} Monthly level calculations from disk.`);
      }
    }
  } catch (err) {
    console.error('[Scanner] Failed to load persistent signals:', err);
  }
}

export function saveLevelsCacheToDisk() {
  try {
    const levelsPath = path.join(__dirname, 'data/levels_cache_backup.json');
    fs.writeFileSync(levelsPath, JSON.stringify(scannerCache.levelsCache), 'utf8');
  } catch (e) {
    console.error('[Scanner] Failed to save levels cache to disk:', e);
  }
}


const BATCH_SIZE = 1; // Scan 1 symbol sequentially to respect Angel One rate limit
const PROXIMITY_THRESHOLD_PCT = 0.25; // 0.25% proximity threshold to classify a stock as "near" a level

// Load scan symbols list dynamically from scan_symbols.json on boot
let SCAN_SYMBOLS = [];
try {
  const symbolsPath = path.join(__dirname, 'data/scan_symbols.json');
  SCAN_SYMBOLS = JSON.parse(fs.readFileSync(symbolsPath, 'utf8'));
  console.log(`[Scanner] Loaded ${SCAN_SYMBOLS.length} symbols to scan.`);
} catch (err) {
  console.error('[Scanner] Failed to load scan_symbols.json, using fallback:', err);
  SCAN_SYMBOLS = ['NSE:NIFTY', 'NSE:BANKNIFTY'];
}

export { getExpiriesForSymbol, findClosestValidOptionSymbol, fetchCandlesForSymbol };

async function fetchCandlesForSymbol(symbol, timeframe, limit = 10) {
  // Pure 0ms Angel One SmartAPI datafeed
  try {
    const angelRes = await angelOneBridge.getNormalizedCandles({ symbol, timeframe, limit, isPriority: false });
    if (angelRes && angelRes.status && Array.isArray(angelRes.candles) && angelRes.candles.length > 0) {
      return angelRes.candles;
    }
  } catch (err) {
    console.warn(`[Scanner] Angel One candle error for ${symbol}:`, err.message);
  }
  return [];
}

// Calculate Matrix levels and current close from candle history
// For 5m scan: timeframe = '5', anchor grouping = Day (Daily Matrix calculated using daily candles)
// For Daily scan: timeframe = 'D', anchor grouping = Month (Monthly Matrix calculated using monthly candles)
function processMatrixForSymbol(candles, timeframe) {
  if (!candles || candles.length < 2) return null;

  const groups = {};
  const dates = [];

  candles.forEach((c) => {
    const date = new Date(c.time * 1000);
    
    let dateStr;
    if (timeframe === 'D') {
      // Group by Month (MM/YYYY) for Monthly Matrix anchor levels
      dateStr = `${date.getMonth() + 1}/${date.getFullYear()}`;
    } else {
      // Group by Day (DD/MM/YYYY) for Daily Matrix anchor levels
      dateStr = date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    }

    if (!groups[dateStr]) {
      groups[dateStr] = [];
      dates.push(dateStr);
    }
    groups[dateStr].push(c);
  });

  // Sort sessions chronologically
  dates.sort((a, b) => {
    const partsA = a.split('/').map(Number);
    const partsB = b.split('/').map(Number);
    
    if (timeframe === 'D') {
      const dateA = new Date(partsA[1], partsA[0] - 1, 1);
      const dateB = new Date(partsB[1], partsB[0] - 1, 1);
      return dateA.getTime() - dateB.getTime();
    } else {
      const dateA = new Date(partsA[2], partsA[1] - 1, partsA[0]);
      const dateB = new Date(partsB[2], partsB[1] - 1, partsB[0]);
      return dateA.getTime() - dateB.getTime();
    }
  });

  if (dates.length < 2) return null;

  // Previous session is index length - 2 (Yesterday or Previous Month)
  const prevDate = dates[dates.length - 2];
  const prevCandles = groups[prevDate];
  if (!prevCandles || prevCandles.length === 0) return null;

  const h_prev = Math.max(...prevCandles.map((c) => c.high));
  const l_prev = Math.min(...prevCandles.map((c) => c.low));
  
  const sortedPrev = [...prevCandles].sort((a, b) => a.time - b.time);
  const c_prev = sortedPrev[sortedPrev.length - 1].close;

  const r_prev = h_prev - l_prev;
  if (r_prev === 0) return null;

  // Today's latest close price (Current 5m close or today's Daily close)
  const todayDate = dates[dates.length - 1];
  const todayCandles = groups[todayDate];
  if (!todayCandles || todayCandles.length === 0) return null;
  const sortedToday = [...todayCandles].sort((a, b) => a.time - b.time);
  const currentClose = sortedToday[sortedToday.length - 1].close;

  // Matrix calculations
  const r2 = c_prev + (r_prev * 1.1 / 6.0);
  const s2 = c_prev - (r_prev * 1.1 / 6.0);
  const r3 = c_prev + (r_prev * 1.1 / 4.0);
  const s3 = c_prev - (r_prev * 1.1 / 4.0);
  const r4 = c_prev + (r_prev * 1.1 / 2.0);
  const s4 = c_prev - (r_prev * 1.1 / 2.0);

  const r5 = r4 + 1.168 * (r4 - r3);
  const s5 = s4 - 1.168 * (s3 - s4);
  const r6 = (h_prev / l_prev) * c_prev;
  const s6 = c_prev - (r6 - c_prev);

  return {
    currentPrice: currentClose,
    levels: {
      level1: r6,
      level2: r5,
      level3: r4,
      level4: r3,
      level5: r2,
      level6: s2,
      level7: s3,
      level8: s4,
      level9: s5,
      level10: s6
    }
  };
}

function isMarketHours() {
  const now = new Date();
  
  // Format current time in Asia/Kolkata timezone
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    second: 'numeric',
    hour12: false
  });
  
  const parts = formatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour').value);
  const minute = parseInt(parts.find(p => p.type === 'minute').value);
  
  // Get day of the week in Asia/Kolkata
  const dayStr = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short'
  }).format(now); // "Sun", "Mon", "Tue", etc.
  
  if (dayStr === 'Sun' || dayStr === 'Sat') {
    return false; // Weekend
  }
  
  const timeInMinutes = hour * 60 + minute;
  const startInMinutes = 9 * 60 + 15; // 9:15 AM IST
  const endInMinutes = 15 * 60 + 15; // 3:15 PM IST
  
  return timeInMinutes >= startInMinutes && timeInMinutes <= endInMinutes;
}

// Run one scanning pass over all symbols for a specific timeframe
export async function runScan(timeframe) {
  if (scannerCache.isScanning[timeframe]) return;
  
  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  const logPath = path.join(__dirname, 'data/today_signals_log.json');

  // Clear persistent signals log on start of a new trading day
  if (scannerCache.todaySignals.length > 0 && scannerCache.todaySignals[0].date !== todayStr) {
    console.log('[Scanner] New day detected. Clearing previous signals.');
    scannerCache.todaySignals = [];
    if (fs.existsSync(logPath)) {
      try { fs.unlinkSync(logPath); } catch (e) {}
    }
  }

  // For live 5m signals, restrict strictly to active market hours (after 9:15 AM and before 3:30 PM IST on weekdays)
  if (timeframe === '5' && !isMarketHours()) {
    console.log('[Scanner] Outside active market hours. Running scan to populate cache for confluences & early picks (live signals touch logging is disabled).');
  }
  
  console.log(`[Scanner] Starting ${timeframe} timeframe scanning cycle...`);
  scannerCache.isScanning[timeframe] = true;

  const tempResults = {
    level1: [], level2: [], level3: [], level4: [], level5: [],
    level6: [], level7: [], level8: [], level9: [], level10: []
  };

  // Determine the correct timeframe to subscribe to:
  // For '5' timeframe scanner (Daily Matrix levels), we fetch Daily ('D') candles
  // For 'D' timeframe scanner (Monthly Matrix levels), we fetch Monthly ('M') candles
  const fetchTimeframe = timeframe === '5' ? 'D' : 'M';

  // Process in batches
  for (let i = 0; i < SCAN_SYMBOLS.length; i += BATCH_SIZE) {
    const batch = SCAN_SYMBOLS.slice(i, i + BATCH_SIZE);
    await new Promise(r => setTimeout(r, 380));
    
    // Scan batch in parallel
    const scanPromises = batch.map(async (symbol) => {
      try {
        const candles = await fetchCandlesForSymbol(symbol, fetchTimeframe, 10);
        const calc = processMatrixForSymbol(candles, timeframe);
        if (!calc) return;

        const { currentPrice, levels } = calc;

        // Cache all calculated levels for confluence scan
        scannerCache.levelsCache[timeframe][symbol] = {
          currentPrice,
          levels
        };

        // Check proximity for all 10 levels
        for (const [lvlKey, lvlVal] of Object.entries(levels)) {
          const distancePts = currentPrice - lvlVal;
          const distancePct = (distancePts / lvlVal) * 100;

          const threshold = timeframe === '5' ? 0.5 : 1.5;
          const isTouch = Math.abs(distancePct) <= threshold;

          // Check wick sweep rejection on the last closed candle
          const lastClosedCandle = candles && candles.length >= 2 ? candles[candles.length - 2] : null;
          let isSweep = false;
          let sweepType = null; // 'bullish' or 'bearish'

          if (lastClosedCandle) {
            const isResistance = ['level1', 'level2', 'level3', 'level4', 'level5'].includes(lvlKey);
            if (isResistance) {
              const openedBelow = lastClosedCandle.open < lvlVal;
              const closedBelow = lastClosedCandle.close < lvlVal;
              const spikedAbove = lastClosedCandle.high > lvlVal;
              if (openedBelow && closedBelow && spikedAbove) {
                isSweep = true;
                sweepType = 'bearish';
              }
            } else { // Support levels L6-L10
              const openedAbove = lastClosedCandle.open > lvlVal;
              const closedAbove = lastClosedCandle.close > lvlVal;
              const spikedBelow = lastClosedCandle.low > 0 && lastClosedCandle.low < lvlVal;
              if (openedAbove && closedAbove && spikedBelow) {
                isSweep = true;
                sweepType = 'bullish';
              }
            }
          }

          if (isTouch || (timeframe === '5' && isSweep)) {
            tempResults[lvlKey].push({
              symbol,
              close: currentPrice,
              levelValue: lvlVal,
              distancePct,
              distancePts,
              isSweep,
              sweepType
            });

            // Log touch for today's persistent signals (only for 5m live scan during market hours)
            if (timeframe === '5' && isMarketHours()) {
              const exists = scannerCache.todaySignals.some(s => s.symbol === symbol && s.levelKey === lvlKey && s.signalType === (isSweep ? 'sweep' : 'touch'));
              if (!exists) {
                const touchTime = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });
                
                // Fetch actual live option premium just-in-time
                let actualPremium = null;
                let isFno = true;
                try {
                  const isBullish = isSweep ? (sweepType === 'bullish') : ['level7', 'level8', 'level9', 'level10'].includes(lvlKey);
                  const optType = isBullish ? 'C' : 'P';
                  const expiries = getExpiriesForSymbol(symbol);
                  if (expiries.length > 0) {
                    const selectedExpiry = expiries[0].code;
                    const optionSymbol = await findClosestValidOptionSymbol(symbol, currentPrice, optType, selectedExpiry);
                    
                    if (optionSymbol) {
                      console.log(`[Scanner] Fetching live option premium for ${optionSymbol}...`);
                      const optionCandles = await fetchCandlesForSymbol(optionSymbol, '5', 5);
                      if (optionCandles && optionCandles.length > 0) {
                        actualPremium = optionCandles[optionCandles.length - 1].close;
                        console.log(`[Scanner] Live option premium for ${optionSymbol} is ₹${actualPremium}`);
                      }
                    } else {
                      isFno = false;
                    }
                  } else {
                    isFno = false;
                  }
                } catch (optErr) {
                  console.warn(`[Scanner] Failed to fetch live option premium for ${symbol}:`, optErr.message || optErr);
                }

                scannerCache.todaySignals.push({
                  symbol,
                  levelKey: lvlKey,
                  levelValue: lvlVal,
                  price: currentPrice,
                  touchTime,
                  date: todayStr,
                  optionPremium: actualPremium,
                  isFno,
                  signalType: isSweep ? 'sweep' : 'touch',
                  sweepType,
                  sweepHigh: isSweep && lastClosedCandle ? lastClosedCandle.high : null,
                  sweepLow: isSweep && lastClosedCandle ? lastClosedCandle.low : null
                });

                // Write to disk
                try {
                  fs.writeFileSync(logPath, JSON.stringify({ date: todayStr, signals: scannerCache.todaySignals }, null, 2));
                } catch (err) {
                  console.error('[Scanner] Failed to write persistent signals to disk:', err);
                }
              }
            }
          }
        }
      } catch (e) {
        console.warn(`[Scanner] Failed to scan ${symbol} on ${timeframe} TF:`, e.message || e);
      }
    });

    await Promise.all(scanPromises);
    
    // Small sleep between batches to let the socket breathe
    await new Promise(r => setTimeout(r, 450));
  }

  // Update cached scan results for this timeframe
  scannerCache.results[timeframe] = tempResults;
  scannerCache.lastScanTime[timeframe] = new Date();
  scannerCache.isScanning[timeframe] = false;

  saveLevelsCacheToDisk();

  console.log(`[Scanner] Completed ${timeframe} timeframe scanning cycle successfully.`);
}

// Queue system to prevent concurrent scans
const scanQueue = [];
let isProcessingQueue = false;

async function processQueue() {
  if (isProcessingQueue) return;
  isProcessingQueue = true;
  
  while (scanQueue.length > 0) {
    const nextScan = scanQueue.shift();
    try {
      await runScan(nextScan.timeframe);
    } catch (err) {
      console.error(`[Scanner] Error running scan for tf ${nextScan.timeframe}:`, err);
    }
  }
  
  isProcessingQueue = false;
}

export function queueScan(timeframe) {
  if (!scanQueue.some(q => q.timeframe === timeframe)) {
    scanQueue.push({ timeframe });
  }
  processQueue();
}

// Start background scanner intervals
export function startScanner() {
  // Load any existing signals from today's session on boot
  loadSignalsFromDisk();

  // Queue scans on startup with delay to let pre-warming and socket settle
  setTimeout(() => {
    queueScan('5');
  }, 45000);
  
  // Wait before queueing the Daily scan on boot
  setTimeout(() => {
    queueScan('D');
  }, 90000);

  // Repeat 5m scan every 5 minutes (300000 ms)
  setInterval(() => {
    queueScan('5');
  }, 5 * 60 * 1000);

  // Repeat Daily scan every 15 minutes (since daily price changes much slower)
  setInterval(() => {
    queueScan('D');
  }, 15 * 60 * 1000);
}
