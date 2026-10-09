import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const valueBreakoutCache = {
  lastScanTime: null,
  isScanning: false,
  results: [],
  summary: {
    totalMonitored: 0,
    activeBalances: 0,
    bullishBreakouts: 0,
    bearishBreakdowns: 0,
    inBalanceCoiling: 0
  },
  featured: {
    nifty: null,
    banknifty: null,
    crudeoil: null
  },
  date: null
};

const backupFilePath = path.join(__dirname, 'data/value_breakouts_today.json');

function saveCacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: valueBreakoutCache.date,
      results: valueBreakoutCache.results,
      summary: valueBreakoutCache.summary,
      featured: valueBreakoutCache.featured,
      lastScanTime: valueBreakoutCache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[Value Breakout Scanner] Failed to save backup to disk:', err);
  }
}

export function loadValueBreakoutCacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.date === todayStr) {
        valueBreakoutCache.date = data.date;
        valueBreakoutCache.results = data.results || [];
        valueBreakoutCache.summary = data.summary || valueBreakoutCache.summary;
        valueBreakoutCache.featured = data.featured || valueBreakoutCache.featured;
        valueBreakoutCache.lastScanTime = data.lastScanTime || null;
        console.log(`[Value Breakout Scanner] Restored ${valueBreakoutCache.results.length} 2-day balance setups from disk cache.`);
      } else {
        console.log('[Value Breakout Scanner] Disk cache is empty or from previous day, starting clean.');
      }
    }
  } catch (err) {
    console.error('[Value Breakout Scanner] Failed to load backup from disk:', err);
  }
}

// Fetch candles via Angel One SmartAPI bridge
async function fetchCandles(symbol, timeframe, limit) {
  try {
    const angelRes = await angelOneBridge.getNormalizedCandles({ symbol, timeframe, limit });
    if (angelRes && angelRes.status && Array.isArray(angelRes.candles) && angelRes.candles.length > 0) {
      return angelRes.candles;
    }
  } catch (err) {
    console.warn(`[Value Breakout Scanner] Candle fetch error for ${symbol}:`, err.message);
  }
  return [];
}

// Compute standard Market Profile Value Area (70% Volume/TPO) from 30m candles
function computeDayProfileVA(candles, tickSize) {
  if (!candles || candles.length === 0) return null;
  const dayHigh = Math.max(...candles.map(c => c.high));
  const dayLow = Math.min(...candles.map(c => c.low));
  const openPrice = candles[0].open;
  const closePrice = candles[candles.length - 1].close;
  const totalVolume = candles.reduce((acc, c) => acc + (c.volume || 0), 0);

  // Auto-tune tick size if not provided
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

  return {
    dayHigh,
    dayLow,
    openPrice,
    closePrice,
    pocPrice,
    vahPrice,
    valPrice,
    totalVolume,
    candlesCount: candles.length
  };
}

// Get default scan list covering Key Indices, Commodities & Top F&O Stocks
function getDefaultSymbols() {
  return [
    // Indices
    'NSE:NIFTY',
    'NSE:BANKNIFTY',
    'NSE:FINNIFTY',
    'NSE:MIDCPNIFTY',
    'BSE:SENSEX',
    
    // MCX Commodities
    'MCX:CRUDEOIL1!',
    'MCX:NATURALGAS1!',
    'MCX:GOLD1!',
    'MCX:SILVER1!',

    // Top Liquid F&O Stocks
    'NSE:RELIANCE',
    'NSE:HDFCBANK',
    'NSE:ICICIBANK',
    'NSE:SBIN',
    'NSE:BHARTIARTL',
    'NSE:TCS',
    'NSE:INFY',
    'NSE:TATAMOTORS',
    'NSE:LT',
    'NSE:BAJFINANCE',
    'NSE:AXISBANK',
    'NSE:KOTAKBANK',
    'NSE:M&M',
    'NSE:MARUTI',
    'NSE:SUNPHARMA',
    'NSE:TITAN',
    'NSE:TATASTEEL',
    'NSE:HINDALCO',
    'NSE:NTPC',
    'NSE:COALINDIA',
    'NSE:ASIANPAINT',
    'NSE:WIPRO',
    'NSE:HCLTECH',
    'NSE:ADANIENT',
    'NSE:ADANIPORTS',
    'NSE:BPCL',
    'NSE:CIPLA',
    'NSE:DIVISLAB',
    'NSE:DRREDDY',
    'NSE:EICHERMOT',
    'NSE:GRASIM',
    'NSE:HEROMOTOCO',
    'NSE:HINDUNILVR',
    'NSE:ITC',
    'NSE:JSWSTEEL',
    'NSE:NESTLEIND',
    'NSE:POWERGRID',
    'NSE:SHRIRAMFIN',
    'NSE:TATACONSUM',
    'NSE:ULTRACEMCO',
    'NSE:VEDL',
    'NSE:HAL',
    'NSE:BEL',
    'NSE:DIXON',
    'NSE:POLYCAB',
    'NSE:PERSISTENT'
  ];
}

export async function scanValueBreakouts(customSymbols) {
  if (valueBreakoutCache.isScanning) return;
  valueBreakoutCache.isScanning = true;

  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  if (valueBreakoutCache.date !== todayStr) {
    valueBreakoutCache.date = todayStr;
    valueBreakoutCache.results = [];
  }

  const symbolsToScan = customSymbols && customSymbols.length > 0 ? customSymbols : getDefaultSymbols();
  console.log(`[Value Breakout Scanner] Scanning ${symbolsToScan.length} symbols for 2-Days Balance & Inner Logic...`);

  const matchedSetups = [];
  let activeBalances = 0;
  let bullishBreakouts = 0;
  let bearishBreakdowns = 0;
  let inBalanceCoiling = 0;

  for (let i = 0; i < symbolsToScan.length; i++) {
    const symbol = symbolsToScan[i];
    try {
      await new Promise(r => setTimeout(r, 360));
      // Fetch 30m candles to build accurate multi-day TPO profiles
      const candles = await fetchCandles(symbol, '30', 90);
      if (!candles || candles.length < 20) continue;

      // Group candles by IST date
      const daysMap = {};
      candles.forEach(c => {
        const istDateStr = new Date((c.time + 19800) * 1000).toISOString().split('T')[0];
        if (!daysMap[istDateStr]) daysMap[istDateStr] = [];
        daysMap[istDateStr].push(c);
      });

      const sortedDates = Object.keys(daysMap).sort();
      if (sortedDates.length < 3) continue;

      // Identify sessions:
      // Day T = Current Session (Today)
      // Day T-1 = Previous Day
      // Day T-2 = One Day Prior (Prior Reference Frame)
      const dateT0 = sortedDates[sortedDates.length - 1];
      const dateT1 = sortedDates[sortedDates.length - 2];
      const dateT2 = sortedDates[sortedDates.length - 3];

      const candlesT0 = daysMap[dateT0];
      const candlesT1 = daysMap[dateT1];
      const candlesT2 = daysMap[dateT2];

      const profT2 = computeDayProfileVA(candlesT2); // One Day Prior
      const profT1 = computeDayProfileVA(candlesT1); // Previous Day
      const profT0 = computeDayProfileVA(candlesT0); // Today

      if (!profT2 || !profT1 || !profT0) continue;

      // =========================================================================
      // 2 DAYS BALANCE & INNER LOGIC:
      // Previous Day (T-1) value should be inner to One Day Prior (T-2) value!
      // =========================================================================
      const isVaInner = profT1.vahPrice <= (profT2.vahPrice * 1.001) && profT1.valPrice >= (profT2.valPrice * 0.999);
      const isRangeInner = profT1.dayHigh <= (profT2.dayHigh * 1.001) && profT1.dayLow >= (profT2.dayLow * 0.999);
      const isStrictInner = isVaInner && isRangeInner;

      // If neither Value Area nor Range was Inner, this symbol was not in 2-Day Inner Balance
      if (!isVaInner && !isRangeInner) {
        continue;
      }

      // Compute 2-Day Balance Zone Boundaries:
      const balanceHigh = Math.max(profT2.dayHigh, profT1.dayHigh);
      const balanceLow = Math.min(profT2.dayLow, profT1.dayLow);
      const balanceVah = Math.max(profT2.vahPrice, profT1.vahPrice);
      const balanceVal = Math.min(profT2.valPrice, profT1.valPrice);
      const balancePoc = (profT2.pocPrice + profT1.pocPrice) / 2;
      const balanceRange = balanceHigh - balanceLow;

      // Current Price (from Today's latest candle)
      const currentPrice = profT0.closePrice;
      const changePts = currentPrice - profT1.closePrice;
      const changePct = (changePts / profT1.closePrice) * 100;

      // =========================================================================
      // VALUE BREAKOUT LOGIC (Today T-0 vs 2-Day Balance):
      // =========================================================================
      let status = 'IN_BALANCE';
      let statusText = 'Inside 2-Day Balance';
      let action = 'WATCH FOR BREAKOUT';
      let confidence = 75;
      let triggerPrice = balanceHigh;
      let stopLoss = balancePoc;
      let target1 = balanceHigh + balanceRange * 0.618;
      let target2 = balanceHigh + balanceRange * 1.0;
      let target3 = balanceHigh + balanceRange * 1.618;
      let distancePct = 0;

      // Bullish Value Breakout:
      if (currentPrice > balanceHigh || (currentPrice > balanceVah && profT0.dayHigh > balanceHigh)) {
        status = 'BULLISH_BREAKOUT';
        statusText = '🚀 Bullish Value Breakout';
        action = 'CALL BUY / LONG';
        triggerPrice = balanceHigh;
        stopLoss = Math.max(balanceVal, balancePoc);
        target1 = balanceHigh + balanceRange * 0.618;
        target2 = balanceHigh + balanceRange * 1.0;
        target3 = balanceHigh + balanceRange * 1.618;
        distancePct = ((currentPrice - balanceHigh) / balanceHigh) * 100;
        confidence = isStrictInner ? 92 : (isVaInner ? 88 : 82);
        bullishBreakouts++;
      } 
      // Bearish Value Breakdown:
      else if (currentPrice < balanceLow || (currentPrice < balanceVal && profT0.dayLow < balanceLow)) {
        status = 'BEARISH_BREAKDOWN';
        statusText = '🔻 Bearish Value Breakdown';
        action = 'PUT BUY / SHORT';
        triggerPrice = balanceLow;
        stopLoss = Math.min(balanceVah, balancePoc);
        target1 = balanceLow - balanceRange * 0.618;
        target2 = balanceLow - balanceRange * 1.0;
        target3 = balanceLow - balanceRange * 1.618;
        distancePct = ((balanceLow - currentPrice) / balanceLow) * 100;
        confidence = isStrictInner ? 92 : (isVaInner ? 88 : 82);
        bearishBreakdowns++;
      } 
      // In Balance (Coiling):
      else {
        status = 'IN_BALANCE';
        statusText = '⏳ Coiling in Balance';
        action = 'PRE-BREAKOUT WATCHLIST';
        const distToUpper = ((balanceHigh - currentPrice) / currentPrice) * 100;
        const distToLower = ((currentPrice - balanceLow) / currentPrice) * 100;
        distancePct = Math.min(distToUpper, distToLower);
        confidence = 75;
        inBalanceCoiling++;
      }

      activeBalances++;

      // Symbol categorization
      let category = 'stocks';
      let displayName = symbol.replace('NSE:', '').replace('BSE:', '').replace('MCX:', '').replace('1!', '');
      if (symbol.includes('CRUDEOIL') || symbol.includes('NATURALGAS') || symbol.includes('GOLD') || symbol.includes('SILVER')) {
        category = 'commodities';
      } else if (symbol.includes('NIFTY') || symbol.includes('SENSEX')) {
        category = 'indices';
      }

      const item = {
        symbol,
        displayName,
        category,
        currentPrice: Math.round(currentPrice * 100) / 100,
        changePts: Math.round(changePts * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        status,
        statusText,
        action,
        confidence,
        isVaInner,
        isRangeInner,
        isStrictInner,
        innerType: isStrictInner ? 'Strict Inner (VA + Range)' : (isVaInner ? 'Inner Value Area (VAH/VAL)' : 'Inside Day Range'),
        dateOneDayPrior: dateT2,
        datePreviousDay: dateT1,
        dateToday: dateT0,
        
        // One Day Prior (T-2)
        priorHigh: Math.round(profT2.dayHigh * 100) / 100,
        priorLow: Math.round(profT2.dayLow * 100) / 100,
        priorVah: Math.round(profT2.vahPrice * 100) / 100,
        priorVal: Math.round(profT2.valPrice * 100) / 100,
        priorPoc: Math.round(profT2.pocPrice * 100) / 100,

        // Previous Day (T-1)
        prevHigh: Math.round(profT1.dayHigh * 100) / 100,
        prevLow: Math.round(profT1.dayLow * 100) / 100,
        prevVah: Math.round(profT1.vahPrice * 100) / 100,
        prevVal: Math.round(profT1.valPrice * 100) / 100,
        prevPoc: Math.round(profT1.pocPrice * 100) / 100,

        // Today (T-0)
        todayHigh: Math.round(profT0.dayHigh * 100) / 100,
        todayLow: Math.round(profT0.dayLow * 100) / 100,
        todayOpen: Math.round(profT0.openPrice * 100) / 100,
        todayClose: Math.round(profT0.closePrice * 100) / 100,

        // Combined 2-Day Balance
        balanceHigh: Math.round(balanceHigh * 100) / 100,
        balanceLow: Math.round(balanceLow * 100) / 100,
        balanceVah: Math.round(balanceVah * 100) / 100,
        balanceVal: Math.round(balanceVal * 100) / 100,
        balancePoc: Math.round(balancePoc * 100) / 100,
        balanceRange: Math.round(balanceRange * 100) / 100,

        // Trade Plan
        triggerPrice: Math.round(triggerPrice * 100) / 100,
        stopLoss: Math.round(stopLoss * 100) / 100,
        target1: Math.round(target1 * 100) / 100,
        target2: Math.round(target2 * 100) / 100,
        target3: Math.round(target3 * 100) / 100,
        distancePct: Math.round(distancePct * 100) / 100,
        scanTime: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
      };

      matchedSetups.push(item);

      // Track featured benchmark instruments
      if (symbol === 'NSE:NIFTY') valueBreakoutCache.featured.nifty = item;
      if (symbol === 'NSE:BANKNIFTY') valueBreakoutCache.featured.banknifty = item;
      if (symbol.includes('CRUDEOIL')) valueBreakoutCache.featured.crudeoil = item;

      console.log(`[Value Breakout] 🎯 ${symbol}: ${statusText} @ ₹${item.currentPrice} (${item.changePct > 0 ? '+' : ''}${item.changePct}%)`);
    } catch (err) {
      console.warn(`[Value Breakout Scanner] Error processing ${symbol}:`, err.message);
    }
  }

  // Sort: Bullish/Bearish breakouts first, then closest in-balance
  matchedSetups.sort((a, b) => {
    const score = (s) => (s.status === 'BULLISH_BREAKOUT' || s.status === 'BEARISH_BREAKDOWN') ? 2 : 1;
    if (score(b) !== score(a)) return score(b) - score(a);
    return Math.abs(b.changePct) - Math.abs(a.changePct);
  });

  valueBreakoutCache.results = matchedSetups;
  valueBreakoutCache.summary = {
    totalMonitored: symbolsToScan.length,
    activeBalances,
    bullishBreakouts,
    bearishBreakdowns,
    inBalanceCoiling
  };
  valueBreakoutCache.lastScanTime = new Date().toISOString();
  valueBreakoutCache.isScanning = false;

  saveCacheToDisk();
  console.log(`[Value Breakout Scanner] Scan cycle complete. ${matchedSetups.length} 2-day balance setups detected (${bullishBreakouts} Bullish, ${bearishBreakdowns} Bearish, ${inBalanceCoiling} In-Balance).`);
}

export const valueBreakoutBacktestCache = {
  isRunning: false,
  lastRunTime: null,
  summary: {
    totalSetups: 0,
    targetHits: 0,
    slHits: 0,
    winRate: 0,
    profitFactor: 0
  },
  trades: []
};

export async function run60DayBacktest() {
  return valueBreakoutBacktestCache;
}
