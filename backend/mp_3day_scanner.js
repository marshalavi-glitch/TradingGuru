import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const mp3DayCache = {
  lastScanTime: null,
  isScanning: false,
  results: [],
  summary: {
    totalScanned: 0,
    matchedCount: 0,
    activeCoilCount: 0,
    bullishBreakoutCount: 0,
    bearishBreakoutCount: 0,
    ultraCoilCount: 0
  },
  date: null
};

const backupFilePath = path.join(__dirname, 'data/mp_3day_patterns_today.json');

function saveCacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: mp3DayCache.date,
      results: mp3DayCache.results,
      summary: mp3DayCache.summary,
      lastScanTime: mp3DayCache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[MP 3-Day Scanner] Failed to save backup to disk:', err);
  }
}

export function loadMp3DayCacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.results && data.results.length > 0) {
        mp3DayCache.date = data.date || todayStr;
        mp3DayCache.results = data.results || [];
        mp3DayCache.summary = data.summary || mp3DayCache.summary;
        mp3DayCache.lastScanTime = data.lastScanTime || null;
        console.log(`[MP 3-Day Scanner] Restored ${mp3DayCache.results.length} 3-Day MP Compression setups from disk cache.`);
      }
    }
  } catch (err) {
    console.error('[MP 3-Day Scanner] Failed to load backup from disk:', err);
  }
}

// Compute accurate standard Market Profile Value Area (70% Volume/TPO) from 30m candles
export function computeDayProfileVA(candles, tickSize) {
  if (!candles || candles.length === 0) return null;
  const dayHigh = Math.max(...candles.map(c => c.high));
  const dayLow = Math.min(...candles.map(c => c.low));
  const openPrice = candles[0].open;
  const closePrice = candles[candles.length - 1].close;
  const totalVolume = candles.reduce((acc, c) => acc + (c.volume || 0), 0);

  const span = dayHigh - dayLow;
  const effectiveTick = tickSize || Math.max(0.05, Math.round((span / 40) * 100) / 100);

  const startPrice = Math.floor(dayLow / effectiveTick) * effectiveTick;
  const endPrice = Math.ceil(dayHigh / effectiveTick) * effectiveTick;

  const binsMap = {};
  const prices = [];
  for (let p = startPrice; p <= endPrice + effectiveTick / 2; p += effectiveTick) {
    const rp = Math.round(p * 10000) / 10000;
    binsMap[rp] = { price: rp, count: 0, volume: 0 };
    prices.push(rp);
  }

  candles.forEach(c => {
    const volPerBin = (c.volume || 1) / Math.max(1, prices.filter(p => p >= c.low - effectiveTick / 2 && p <= c.high + effectiveTick / 2).length);
    prices.forEach(price => {
      const bottom = price - effectiveTick / 2;
      const top = price + effectiveTick / 2;
      if (c.high >= bottom && c.low <= top) {
        binsMap[price].count++;
        binsMap[price].volume += volPerBin;
      }
    });
  });

  const bins = prices.map(p => binsMap[p]);
  let maxCount = 0;
  let pocIdx = 0;
  let totalTPOs = 0;
  bins.forEach((b, i) => {
    totalTPOs += b.count;
    if (b.count > maxCount) {
      maxCount = b.count;
      pocIdx = i;
    }
  });

  const pocPrice = bins[pocIdx] ? bins[pocIdx].price : (dayHigh + dayLow) / 2;
  let vahPrice = pocPrice;
  let valPrice = pocPrice;

  if (totalTPOs > 0 && bins.length > 0) {
    const targetTPOs = Math.round(totalTPOs * 0.70);
    let currentTPOs = maxCount;
    const isIncluded = new Array(bins.length).fill(false);
    isIncluded[pocIdx] = true;

    let L = 1;
    let N = 1;
    const j = bins.length;

    while (currentTPOs < targetTPOs) {
      const aboveIdx = pocIdx - N;
      const hasAbove = aboveIdx >= 0;
      const H = hasAbove ? bins[aboveIdx].count : 0;

      const belowIdx = pocIdx + L;
      const hasBelow = belowIdx < j;
      const V = hasBelow ? bins[belowIdx].count : 0;

      if (V <= H) {
        currentTPOs += H;
        if (hasAbove) {
          isIncluded[aboveIdx] = true;
          N++;
        }
      } else {
        currentTPOs += V;
        if (hasBelow) {
          isIncluded[belowIdx] = true;
          L++;
        }
      }
      if (V === 0) L++;
      if (H === 0) N++;
      if (L > j && N > j) break;
    }

    let firstAreaIdx = -1;
    let lastAreaIdx = -1;
    for (let i = 0; i < j; i++) {
      if (isIncluded[i]) {
        if (firstAreaIdx === -1) firstAreaIdx = i;
        lastAreaIdx = i;
      }
    }
    if (firstAreaIdx !== -1 && lastAreaIdx !== -1) {
      valPrice = bins[firstAreaIdx].price;
      vahPrice = bins[lastAreaIdx].price;
    }
  }

  const d = new Date((candles[0].time + 19800) * 1000);
  const dateStr = d.toISOString().split('T')[0];

  return {
    dateStr,
    dayHigh: Math.round(dayHigh * 100) / 100,
    dayLow: Math.round(dayLow * 100) / 100,
    range: Math.round((dayHigh - dayLow) * 100) / 100,
    openPrice: Math.round(openPrice * 100) / 100,
    closePrice: Math.round(closePrice * 100) / 100,
    pocPrice: Math.round(pocPrice * 100) / 100,
    vahPrice: Math.round(vahPrice * 100) / 100,
    valPrice: Math.round(valPrice * 100) / 100,
    totalVolume,
    candlesCount: candles.length
  };
}

// Fetch historical candles via Angel One API
async function fetchCandles(symbol, timeframe, limit) {
  try {
    const angelRes = await angelOneBridge.getNormalizedCandles({ symbol, timeframe, limit });
    if (angelRes && angelRes.status && Array.isArray(angelRes.candles) && angelRes.candles.length > 0) {
      return angelRes.candles;
    }
  } catch (err) {
    console.warn(`[MP 3-Day Scanner] Candle fetch error for ${symbol}:`, err.message);
  }
  return [];
}

// Key F&O Universe + Major Indices + Commodities
export function getMp3DayUniverse() {
  return [
    // Major Indices & Benchmarks
    'NSE:NIFTY',
    'NSE:BANKNIFTY',
    'NSE:FINNIFTY',
    'NSE:MIDCPNIFTY',
    'BSE:SENSEX',

    // Commodities
    'MCX:CRUDEOIL1!',
    'MCX:NATURALGAS1!',
    'MCX:GOLD1!',
    'MCX:SILVER1!',

    // High Beta & Core F&O Heavyweights
    'NSE:RELIANCE',
    'NSE:HDFCBANK',
    'NSE:ICICIBANK',
    'NSE:SBIN',
    'NSE:TCS',
    'NSE:INFY',
    'NSE:BHARTIARTL',
    'NSE:LT',
    'NSE:KOTAKBANK',
    'NSE:AXISBANK',
    'NSE:ITC',
    'NSE:BAJFINANCE',
    'NSE:M&M',
    'NSE:MARUTI',
    'NSE:TITAN',
    'NSE:TATAMOTORS',
    'NSE:TATASTEEL',
    'NSE:JSWSTEEL',
    'NSE:HINDALCO',
    'NSE:VEDL',
    'NSE:COALINDIA',
    'NSE:NTPC',
    'NSE:POWERGRID',
    'NSE:ONGC',
    'NSE:BPCL',
    'NSE:HCLTECH',
    'NSE:TECHM',
    'NSE:WIPRO',
    'NSE:SUNPHARMA',
    'NSE:CIPLA',
    'NSE:DRREDDY',
    'NSE:DIVISLAB',
    'NSE:APOLLOHOSP',
    'NSE:ASIANPAINT',
    'NSE:ULTRACEMCO',
    'NSE:GRASIM',
    'NSE:NESTLEIND',
    'NSE:BRITANNIA',
    'NSE:HINDUNILVR',
    'NSE:ADANIENT',
    'NSE:ADANIPORTS',
    'NSE:BEL',
    'NSE:HAL',
    'NSE:BHEL',
    'NSE:DLF',
    'NSE:GODREJPROP',
    'NSE:EICHERMOT',
    'NSE:HEROMOTOCO',
    'NSE:BAJAJ-AUTO',
    'NSE:TVSMOTOR',
    'NSE:CHOLAFIN',
    'NSE:SHRIRAMFIN',
    'NSE:MUTHOOTFIN',
    'NSE:PFC',
    'NSE:RECLTD',
    'NSE:CANBK',
    'NSE:BANKBARODA',
    'NSE:PNB',
    'NSE:FEDERALBNK',
    'NSE:INDUSINDBK',
    'NSE:AUBANK',
    'NSE:TRENT',
    'NSE:DIXON',
    'NSE:POLYCAB',
    'NSE:HAVELLS',
    'NSE:CUMMINSIND',
    'NSE:VOLTAS',
    'NSE:SIEMENS',
    'NSE:ABB',
    'NSE:PERSISTENT',
    'NSE:COFORGE',
    'NSE:LTIM',
    'NSE:NAUKRI',
    'NSE:INDIGO',
    'NSE:INDHOTEL',
    'NSE:TATACONSUM',
    'NSE:DABUR',
    'NSE:MARICO',
    'NSE:COLPAL',
    'NSE:LUPIN',
    'NSE:AUROPHARMA',
    'NSE:BIOCON',
    'NSE:GLENMARK',
    'NSE:TORNTPHARM',
    'NSE:JINDALSTEL',
    'NSE:NMDC',
    'NSE:SAIL',
    'NSE:NATIONALUM',
    'NSE:ESCORTS',
    'NSE:ASHOKLEY',
    'NSE:BHARATFORG',
    'NSE:BALKRISIND',
    'NSE:APOLLOTYRE',
    'NSE:CONCOR',
    'NSE:IRCTC',
    'NSE:PETRONET',
    'NSE:GAIL',
    'NSE:IGL',
    'NSE:MGL',
    'NSE:GUJGASLTD',
    'NSE:MCX',
    'NSE:BSE',
    'NSE:IEX'
  ];
}

// Evaluate whether a sliding 8-session sequence satisfies the 3-Day MP Compression Pattern
export function evaluate3DayCompressionPattern(sessions) {
  if (!sessions || sessions.length < 8) return null;

  // Window: 5 prior days [0..4], Day 1 [5], Day 2 [6], Day 3 [7]
  const prior5 = sessions.slice(0, 5);
  const day1 = sessions[5];
  const day2 = sessions[6];
  const day3 = sessions[7];

  // 1. Day 1 Range must be strictly larger than ALL 5 previous trading days
  const prior5MaxRange = Math.max(...prior5.map(s => s.range));
  const isDay1Expansion = day1.range > (prior5MaxRange * 1.0001); // Day 1 strictly larger
  if (!isDay1Expansion) {
    return null;
  }

  // 2. Day 2 VAH and VAL must be completely inside Day 1 VAH and VAL
  const isDay2VaInside = (day2.vahPrice <= day1.vahPrice * 1.0008) && (day2.valPrice >= day1.valPrice * 0.9992);
  if (!isDay2VaInside) {
    return null;
  }

  // 3. Day 3 must remain inside Day 2
  // Check if Day 3 Value Area is inside Day 2 Value Area, OR Day 3 Range is inside Day 2 Range
  const isDay3VaInside = (day3.vahPrice <= day2.vahPrice * 1.0008) && (day3.valPrice >= day2.valPrice * 0.9992);
  const isDay3RangeInside = (day3.dayHigh <= day2.dayHigh * 1.0008) && (day3.dayLow >= day2.dayLow * 0.9992);

  if (!isDay3VaInside && !isDay3RangeInside) {
    return null;
  }

  let insideType = 'INSIDE_DAY_2';
  if (isDay3VaInside && isDay3RangeInside) {
    insideType = 'ULTRA_COIL'; // Both VA and Range inside Day 2
  } else if (isDay3VaInside) {
    insideType = 'VA_INSIDE'; // Value Area inside Day 2 Value Area
  } else {
    insideType = 'RANGE_INSIDE'; // Range inside Day 2 Range
  }

  // Key levels and compression metrics
  const rangeExpansionPct = Math.round(((day1.range - prior5MaxRange) / prior5MaxRange) * 1000) / 10;
  const compressionRatio = Math.round((day3.range / day1.range) * 1000) / 10;
  const day1VaWidth = Math.max(0.01, day1.vahPrice - day1.valPrice);
  const day2VaWidth = Math.max(0.01, day2.vahPrice - day2.valPrice);
  const day3VaWidth = Math.max(0.01, day3.vahPrice - day3.valPrice);
  const vahCompressionRatio = Math.round((day3VaWidth / day1VaWidth) * 1000) / 10;

  // Trigger boundaries: Breakout above Day 1 VAH / Day 2 High, or breakdown below Day 1 VAL / Day 2 Low
  const breakoutTriggerHigh = Math.round(Math.max(day1.vahPrice, day2.dayHigh, day3.dayHigh) * 100) / 100;
  const breakoutTriggerLow = Math.round(Math.min(day1.valPrice, day2.dayLow, day3.dayLow) * 100) / 100;

  // Measured move targets based on Day 1 range expansion
  const target1Bullish = Math.round((breakoutTriggerHigh + day1.range * 0.618) * 100) / 100;
  const target2Bullish = Math.round((breakoutTriggerHigh + day1.range * 1.0) * 100) / 100;
  const target1Bearish = Math.round((breakoutTriggerLow - day1.range * 0.618) * 100) / 100;
  const target2Bearish = Math.round((breakoutTriggerLow - day1.range * 1.0) * 100) / 100;

  return {
    day1,
    day2,
    day3,
    prior5: prior5.map(p => ({ date: p.dateStr, range: p.range, high: p.dayHigh, low: p.dayLow })),
    prior5MaxRange,
    rangeExpansionPct,
    compressionRatio,
    vahCompressionRatio,
    insideType,
    isDay2VaInside,
    isDay3VaInside,
    isDay3RangeInside,
    breakoutTriggerHigh,
    breakoutTriggerLow,
    target1Bullish,
    target2Bullish,
    target1Bearish,
    target2Bearish
  };
}

// Main scan runner across universe
export async function scanMp3DayPatterns(customSymbols) {
  if (mp3DayCache.isScanning) {
    return mp3DayCache.results;
  }
  mp3DayCache.isScanning = true;

  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  mp3DayCache.date = todayStr;

  const symbolsToScan = (customSymbols && customSymbols.length > 0) ? customSymbols : getMp3DayUniverse();
  console.log(`[MP 3-Day Scanner] 🔍 Scanning ${symbolsToScan.length} symbols for 3-Day Market Profile Compression Pattern...`);

  const matchedSetups = [];
  let activeCoilCount = 0;
  let bullishBreakoutCount = 0;
  let bearishBreakoutCount = 0;
  let ultraCoilCount = 0;

  for (let i = 0; i < symbolsToScan.length; i++) {
    const symbol = symbolsToScan[i];
    try {
      // Pace requests to respect Angel One SmartAPI 3 req/sec limit smoothly
      await new Promise(resolve => setTimeout(resolve, 360));

      // 150 30-min candles cover 11-12 trading sessions
      const candles = await fetchCandles(symbol, '30', 150);
      if (!candles || candles.length < 50) continue;

      // Group candles by IST date
      const daysMap = {};
      candles.forEach(c => {
        const istDateStr = new Date((c.time + 19800) * 1000).toISOString().split('T')[0];
        if (!daysMap[istDateStr]) daysMap[istDateStr] = [];
        daysMap[istDateStr].push(c);
      });

      const sortedDates = Object.keys(daysMap).sort();
      if (sortedDates.length < 8) continue; // Need at least 5 prior + 3 pattern days

      // Calculate profile for each day
      const sessions = sortedDates.map(dt => computeDayProfileVA(daysMap[dt])).filter(Boolean);
      if (sessions.length < 8) continue;

      // Check the latest window ending on the most recent completed session
      const latestWindow = sessions.slice(sessions.length - 8);
      let patternResult = evaluate3DayCompressionPattern(latestWindow);
      let isLatestSession = true;

      // If not matched on latest window, check previous window (Day 3 was previous session, today Day 4 breaking out)
      if (!patternResult && sessions.length >= 9) {
        const prevWindow = sessions.slice(sessions.length - 9, sessions.length - 1);
        const prevResult = evaluate3DayCompressionPattern(prevWindow);
        if (prevResult) {
          patternResult = prevResult;
          isLatestSession = false; // Pattern ended yesterday, today is Day 4
        }
      }

      if (!patternResult) {
        if ((i + 1) % 15 === 0 || i === symbolsToScan.length - 1) {
          console.log(`[MP 3-Day Scanner] Progress: ${i + 1}/${symbolsToScan.length} scanned, ${matchedSetups.length} setups found so far...`);
        }
        continue;
      }

      console.log(`[MP 3-Day Scanner] 🎯 MATCH FOUND: ${symbol} (${patternResult.insideType}) - Range Exp: +${patternResult.rangeExpansionPct}%, D3/D1: ${patternResult.compressionRatio}%`);

      // Determine current status & live action
      const latestDay = sessions[sessions.length - 1];
      const currentPrice = latestDay.closePrice;
      const prevClose = sessions[sessions.length - 2]?.closePrice || currentPrice;
      const changePts = Math.round((currentPrice - prevClose) * 100) / 100;
      const changePct = Math.round(((currentPrice - prevClose) / prevClose) * 10000) / 100;

      let status = 'ACTIVE_COIL';
      let statusText = '⚡ Coiling Inside Day 2 (Breakout Ready)';
      let action = 'WATCH BREAKOUT LEVEL';

      if (currentPrice > patternResult.breakoutTriggerHigh) {
        status = 'BREAKOUT_BULLISH';
        statusText = '🚀 Bullish Breakout Active';
        action = `BUY ABOVE ₹${patternResult.breakoutTriggerHigh} (Target: ₹${patternResult.target1Bullish})`;
        bullishBreakoutCount++;
      } else if (currentPrice < patternResult.breakoutTriggerLow) {
        status = 'BREAKOUT_BEARISH';
        statusText = '🔻 Bearish Breakdown Active';
        action = `SELL BELOW ₹${patternResult.breakoutTriggerLow} (Target: ₹${patternResult.target1Bearish})`;
        bearishBreakoutCount++;
      } else {
        activeCoilCount++;
        action = `COILING: Buy > ₹${patternResult.breakoutTriggerHigh} | Sell < ₹${patternResult.breakoutTriggerLow}`;
      }

      if (patternResult.insideType === 'ULTRA_COIL') {
        ultraCoilCount++;
      }

      const cleanName = symbol.replace(/^NSE:/, '').replace(/^MCX:/, '').replace(/^BSE:/, '');
      const sector = cleanName.includes('NIFTY') ? 'Index' : (symbol.startsWith('MCX:') ? 'Commodity' : 'Equity / F&O');

      matchedSetups.push({
        symbol,
        cleanName,
        sector,
        currentPrice,
        changePts,
        changePct,
        status,
        statusText,
        action,
        isLatestSession,
        ...patternResult
      });

    } catch (err) {
      console.warn(`[MP 3-Day Scanner] Error scanning ${symbol}:`, err.message);
    }
  }

  // Sort: Active Coils and Ultra Coils first, then by tightness of compression
  matchedSetups.sort((a, b) => {
    if (a.insideType === 'ULTRA_COIL' && b.insideType !== 'ULTRA_COIL') return -1;
    if (b.insideType === 'ULTRA_COIL' && a.insideType !== 'ULTRA_COIL') return 1;
    return a.compressionRatio - b.compressionRatio;
  });

  mp3DayCache.results = matchedSetups;
  mp3DayCache.summary = {
    totalScanned: symbolsToScan.length,
    matchedCount: matchedSetups.length,
    activeCoilCount,
    bullishBreakoutCount,
    bearishBreakoutCount,
    ultraCoilCount
  };
  mp3DayCache.lastScanTime = new Date().toISOString();
  mp3DayCache.isScanning = false;

  saveCacheToDisk();
  console.log(`[MP 3-Day Scanner] ✅ Scan completed. Found ${matchedSetups.length} 3-Day MP Compression setups (${activeCoilCount} Active Coils, ${bullishBreakoutCount} Bullish, ${bearishBreakoutCount} Bearish, ${ultraCoilCount} Ultra-Coils).`);

  return matchedSetups;
}
