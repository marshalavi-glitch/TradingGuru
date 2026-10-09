import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const patternTestingCache = {
  lastScanTime: null,
  isScanning: false,
  scanProgress: null,
  results: {
    intraday: [],
    daily: [],
    weekly: []
  },
  summary: {
    totalDetected: 0,
    bullishCount: 0,
    bearishCount: 0,
    neutralCount: 0,
    universeSize: 5017
  },
  date: null
};

const backupFilePath = path.join(__dirname, 'data/candlestick_patterns_today.json');

function saveCacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: patternTestingCache.date,
      results: patternTestingCache.results,
      summary: patternTestingCache.summary,
      lastScanTime: patternTestingCache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[Pattern Scanner] Failed to save backup to disk:', err.message);
  }
}

export function loadPatternTestingCacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.date === todayStr) {
        patternTestingCache.date = data.date;
        const rawResults = data.results || { intraday: [], daily: [], weekly: [] };
        // Exclude stocks trading below 50 rupees
        ['intraday', 'daily', 'weekly'].forEach(key => {
          if (Array.isArray(rawResults[key])) {
            rawResults[key] = rawResults[key].filter(item => {
              const p = Number(item.currentPrice || item.entry || 0);
              return p >= 50;
            });
          }
        });
        patternTestingCache.results = rawResults;
        patternTestingCache.summary = data.summary || patternTestingCache.summary;
        patternTestingCache.lastScanTime = data.lastScanTime || null;
        updateSummary();
        console.log(`[Pattern Scanner] Restored candlestick pattern cache from disk (excluding < 50 INR stocks).`);
      } else {
        console.log('[Pattern Scanner] Disk cache is empty or from previous day, starting clean.');
      }
    }
  } catch (err) {
    console.error('[Pattern Scanner] Failed to load backup from disk:', err.message);
  }
}

export function getDefaultSymbols() {
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

let ALL_SUPPORTED_SYMBOLS = [];

export function getAllSupportedSymbols() {
  if (ALL_SUPPORTED_SYMBOLS.length > 0) return ALL_SUPPORTED_SYMBOLS;

  const symbolSet = new Set();

  // 1. High priority benchmark indices & liquid commodities
  const priority = [
    'NSE:NIFTY', 'NSE:BANKNIFTY', 'NSE:FINNIFTY', 'NSE:MIDCPNIFTY', 'BSE:SENSEX',
    'MCX:CRUDEOIL1!', 'MCX:NATURALGAS1!', 'MCX:GOLD1!', 'MCX:SILVER1!'
  ];
  priority.forEach(s => symbolSet.add(s));

  // 2. Add top liquid F&O stocks first
  getDefaultSymbols().forEach(s => symbolSet.add(s));

  // 3. Load all 5000+ symbols from presets.json
  try {
    const presetsPath = path.join(__dirname, 'data/presets.json');
    if (fs.existsSync(presetsPath)) {
      const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
      presets.forEach(p => {
        if (p.value) {
          symbolSet.add(p.value.trim().toUpperCase());
        }
      });
    }
  } catch (err) {
    console.warn('[Pattern Scanner] Could not load presets.json:', err.message);
  }

  ALL_SUPPORTED_SYMBOLS = Array.from(symbolSet);
  console.log(`[Pattern Scanner] Loaded ${ALL_SUPPORTED_SYMBOLS.length} symbols in supported stock universe.`);
  return ALL_SUPPORTED_SYMBOLS;
}

// Fetch candles via Angel One SmartAPI bridge
async function fetchCandles(symbol, timeframe, limit = 60) {
  try {
    const angelRes = await angelOneBridge.getNormalizedCandles({ symbol, timeframe, limit });
    if (angelRes && angelRes.status && Array.isArray(angelRes.candles) && angelRes.candles.length > 0) {
      return angelRes.candles;
    }
  } catch (err) {
    console.warn(`[Pattern Scanner] Candle fetch error for ${symbol}:`, err.message);
  }
  return [];
}

/**
 * Pure Mathematical Candlestick Pattern Detection
 * Scans recent candle series and identifies patterns on the most recent completed/forming bars.
 */
export function detectCandlestickPatterns(candles, symbol, timeframeLabel = '15m') {
  if (!candles || candles.length < 3) return [];

  // Requirement: Skip stocks trading below 50 rupees
  const latestClose = Number(candles[candles.length - 1]?.close || 0);
  if (latestClose > 0 && latestClose < 50) {
    return [];
  }

  const patterns = [];
  const len = candles.length;
  // Inspect the last 3 possible ending bars (e.g. index len - 1, len - 2, len - 3)
  const evalIndices = [len - 1, len - 2, len - 3].filter(idx => idx >= 2);

  evalIndices.forEach(idx => {
    const c0 = candles[idx];     // Latest candle in window
    const c1 = candles[idx - 1]; // 1 bar ago
    const c2 = candles[idx - 2]; // 2 bars ago

    if (!c0 || !c1 || !c2) return;
    if (Number(c0.close) < 50) return; // Strict price filter >= 50 rupees

    const tickBuffer = c0.close > 5000 ? 5.0 : (c0.close > 500 ? 1.0 : 0.1);
    const decimals = c0.close > 5000 ? 1 : 2;

    const roundP = (val) => parseFloat(Number(val).toFixed(decimals));

    // Helper metrics for candle
    const getMetrics = (c) => {
      const range = Math.max(tickBuffer, c.high - c.low);
      const body = Math.abs(c.close - c.open);
      const upperWick = c.high - Math.max(c.open, c.close);
      const lowerWick = Math.min(c.open, c.close) - c.low;
      const isBull = c.close >= c.open;
      const isBear = c.close < c.open;
      return { range, body, upperWick, lowerWick, isBull, isBear };
    };

    const m0 = getMetrics(c0);
    const m1 = getMetrics(c1);
    const m2 = getMetrics(c2);

    const timeStr = c0.time ? new Date((c0.time + 19800) * 1000).toISOString().replace('T', ' ').substring(0, 16) : 'Live';

    // ------------------------------------------------------------------------
    // 1. MORNING STAR (3-Candle Bullish Reversal)
    // C2: Bearish body (>= 40% range)
    // C1: Star candle with small body (<= 38% range), making swing low
    // C0: Strong bullish candle (>= 40% range) closing above C2 body midpoint
    // ------------------------------------------------------------------------
    if (
      m2.isBear && (m2.body / m2.range >= 0.40) &&
      (m1.body / m1.range <= 0.38) && (c1.low <= c2.low * 1.002) &&
      m0.isBull && (m0.body / m0.range >= 0.40) &&
      c0.close >= ((c2.open + c2.close) / 2)
    ) {
      const entry = roundP(Math.max(c0.high, c1.high, c2.high * 0.999));
      const stopLoss = roundP(Math.min(c2.low, c1.low, c0.low) - tickBuffer);
      const risk = Math.max(tickBuffer * 2, entry - stopLoss);
      const target1 = roundP(entry + 1.5 * risk);
      const target2 = roundP(entry + 2.5 * risk);
      patterns.push({
        id: `${symbol}-morning-star-${c0.time || idx}`,
        symbol,
        pattern: 'Morning Star',
        direction: 'BULLISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: '3-candle bullish reversal: Star followed by strong thrust into bear body.'
      });
    }

    // ------------------------------------------------------------------------
    // 2. EVENING STAR (3-Candle Bearish Reversal)
    // C2: Bullish body (>= 40% range)
    // C1: Star candle with small body (<= 38% range), making swing high
    // C0: Strong bearish candle (>= 40% range) closing below C2 body midpoint
    // ------------------------------------------------------------------------
    if (
      m2.isBull && (m2.body / m2.range >= 0.40) &&
      (m1.body / m1.range <= 0.38) && (c1.high >= c2.high * 0.998) &&
      m0.isBear && (m0.body / m0.range >= 0.40) &&
      c0.close <= ((c2.open + c2.close) / 2)
    ) {
      const entry = roundP(Math.min(c0.low, c1.low));
      const stopLoss = roundP(Math.max(c2.high, c1.high, c0.high) + tickBuffer);
      const risk = Math.max(tickBuffer * 2, stopLoss - entry);
      const target1 = roundP(entry - 1.5 * risk);
      const target2 = roundP(entry - 2.5 * risk);
      patterns.push({
        id: `${symbol}-evening-star-${c0.time || idx}`,
        symbol,
        pattern: 'Evening Star',
        direction: 'BEARISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: '3-candle bearish reversal: Peak star followed by strong breakdown.'
      });
    }

    // ------------------------------------------------------------------------
    // 3. BULLISH ENGULFING (2-Candle Bullish Reversal: c1, c0)
    // C1: Bearish candle
    // C0: Bullish candle whose real body completely covers C1's real body
    // ------------------------------------------------------------------------
    if (
      m1.isBear && m0.isBull &&
      c0.open <= (c1.close * 1.002) && c0.close >= (c1.open * 0.998) &&
      (m0.body >= m1.body * 1.05) && (m0.body / m0.range >= 0.50)
    ) {
      const entry = roundP(c0.high);
      const stopLoss = roundP(Math.min(c1.low, c0.low) - tickBuffer);
      const risk = Math.max(tickBuffer * 2, entry - stopLoss);
      const target1 = roundP(entry + 1.5 * risk);
      const target2 = roundP(entry + 2.5 * risk);
      patterns.push({
        id: `${symbol}-bull-engulfing-${c0.time || idx}`,
        symbol,
        pattern: 'Bullish Engulfing',
        direction: 'BULLISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: '2-candle bullish reversal: Full engulfment of prior bear body.'
      });
    }

    // ------------------------------------------------------------------------
    // 4. BEARISH ENGULFING (2-Candle Bearish Reversal: c1, c0)
    // C1: Bullish candle
    // C0: Bearish candle whose real body completely covers C1's real body
    // ------------------------------------------------------------------------
    if (
      m1.isBull && m0.isBear &&
      c0.open >= (c1.close * 0.998) && c0.close <= (c1.open * 1.002) &&
      (m0.body >= m1.body * 1.05) && (m0.body / m0.range >= 0.50)
    ) {
      const entry = roundP(c0.low);
      const stopLoss = roundP(Math.max(c1.high, c0.high) + tickBuffer);
      const risk = Math.max(tickBuffer * 2, stopLoss - entry);
      const target1 = roundP(entry - 1.5 * risk);
      const target2 = roundP(entry - 2.5 * risk);
      patterns.push({
        id: `${symbol}-bear-engulfing-${c0.time || idx}`,
        symbol,
        pattern: 'Bearish Engulfing',
        direction: 'BEARISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: '2-candle bearish reversal: Aggressive sellers completely overwhelm buyers.'
      });
    }

    // ------------------------------------------------------------------------
    // 5. PIN BAR (Bullish Hammer / Bearish Shooting Star)
    // ------------------------------------------------------------------------
    // Bullish Pin Bar: Long lower wick (>= 58% range), small body in top 35%
    if (
      m0.lowerWick >= m0.range * 0.58 &&
      m0.body <= m0.range * 0.32 &&
      m0.upperWick <= m0.range * 0.20
    ) {
      const entry = roundP(c0.high);
      const stopLoss = roundP(c0.low - tickBuffer);
      const risk = Math.max(tickBuffer * 2, entry - stopLoss);
      const target1 = roundP(entry + 1.5 * risk);
      const target2 = roundP(entry + 2.5 * risk);
      patterns.push({
        id: `${symbol}-pin-bar-bull-${c0.time || idx}`,
        symbol,
        pattern: 'Pin Bar (Bullish Hammer)',
        direction: 'BULLISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: 'Price rejected lows with heavy institutional buying tail (>= 60% wick).'
      });
    }
    // Bearish Pin Bar: Long upper wick (>= 58% range), small body in bottom 35%
    else if (
      m0.upperWick >= m0.range * 0.58 &&
      m0.body <= m0.range * 0.32 &&
      m0.lowerWick <= m0.range * 0.20
    ) {
      const entry = roundP(c0.low);
      const stopLoss = roundP(c0.high + tickBuffer);
      const risk = Math.max(tickBuffer * 2, stopLoss - entry);
      const target1 = roundP(entry - 1.5 * risk);
      const target2 = roundP(entry - 2.5 * risk);
      patterns.push({
        id: `${symbol}-pin-bar-bear-${c0.time || idx}`,
        symbol,
        pattern: 'Pin Bar (Shooting Star)',
        direction: 'BEARISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: 'Price rejected highs with sharp overhead rejection tail (>= 60% wick).'
      });
    }

    // ------------------------------------------------------------------------
    // 6. DOJI (Dragonfly / Gravestone / Classic)
    // ------------------------------------------------------------------------
    if (m0.body <= m0.range * 0.10 && m0.range >= tickBuffer * 2) {
      const isDragonfly = m0.lowerWick >= m0.range * 0.60;
      const isGravestone = m0.upperWick >= m0.range * 0.60;
      const isBull = isDragonfly || (m1.isBear && c0.close >= c1.close);

      const patternName = isDragonfly ? 'Dragonfly Doji' : (isGravestone ? 'Gravestone Doji' : 'Doji');
      const direction = isDragonfly ? 'BULLISH' : (isGravestone ? 'BEARISH' : (isBull ? 'BULLISH' : 'BEARISH'));

      if (direction === 'BULLISH') {
        const entry = roundP(c0.high);
        const stopLoss = roundP(c0.low - tickBuffer);
        const risk = Math.max(tickBuffer * 2, entry - stopLoss);
        patterns.push({
          id: `${symbol}-doji-${c0.time || idx}`,
          symbol,
          pattern: patternName,
          direction: 'BULLISH',
          timeframe: timeframeLabel,
          entry,
          stopLoss,
          target1: roundP(entry + 1.5 * risk),
          target2: roundP(entry + 2.5 * risk),
          riskReward: '1 : 2.5',
          candleTime: timeStr,
          currentPrice: roundP(c0.close),
          description: 'Market indecision/equilibrium candle with potential reversal expansion.'
        });
      } else {
        const entry = roundP(c0.low);
        const stopLoss = roundP(c0.high + tickBuffer);
        const risk = Math.max(tickBuffer * 2, stopLoss - entry);
        patterns.push({
          id: `${symbol}-doji-${c0.time || idx}`,
          symbol,
          pattern: patternName,
          direction: 'BEARISH',
          timeframe: timeframeLabel,
          entry,
          stopLoss,
          target1: roundP(entry - 1.5 * risk),
          target2: roundP(entry - 2.5 * risk),
          riskReward: '1 : 2.5',
          candleTime: timeStr,
          currentPrice: roundP(c0.close),
          description: 'Market indecision/equilibrium candle with breakdown potential.'
        });
      }
    }

    // ------------------------------------------------------------------------
    // 7. TWEEZER TOP (2-Candle Matching High Rejection)
    // C1 & C0 share virtually identical highs (within 0.08% or tickBuffer)
    // C1 bullish or test high, C0 bearish or rejected
    // ------------------------------------------------------------------------
    if (
      Math.abs(c0.high - c1.high) <= Math.max(tickBuffer, c0.high * 0.0008) &&
      (m0.isBear || m0.upperWick >= m0.range * 0.35) &&
      c0.high >= Math.max(c2.high, c1.high) * 0.999
    ) {
      const entry = roundP(c0.low);
      const stopLoss = roundP(Math.max(c0.high, c1.high) + tickBuffer);
      const risk = Math.max(tickBuffer * 2, stopLoss - entry);
      const target1 = roundP(entry - 1.5 * risk);
      const target2 = roundP(entry - 2.5 * risk);
      patterns.push({
        id: `${symbol}-tweezer-top-${c0.time || idx}`,
        symbol,
        pattern: 'Tweezer Top',
        direction: 'BEARISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: 'Double peak at exact identical price level: Firm resistance ceiling confirmed.'
      });
    }

    // ------------------------------------------------------------------------
    // 8. TWEEZER BOTTOM (2-Candle Matching Low Bounce)
    // C1 & C0 share virtually identical lows (within 0.08% or tickBuffer)
    // C1 bearish or test low, C0 bullish or rejected from low
    // ------------------------------------------------------------------------
    if (
      Math.abs(c0.low - c1.low) <= Math.max(tickBuffer, c0.low * 0.0008) &&
      (m0.isBull || m0.lowerWick >= m0.range * 0.35) &&
      c0.low <= Math.min(c2.low, c1.low) * 1.001
    ) {
      const entry = roundP(c0.high);
      const stopLoss = roundP(Math.min(c0.low, c1.low) - tickBuffer);
      const risk = Math.max(tickBuffer * 2, entry - stopLoss);
      const target1 = roundP(entry + 1.5 * risk);
      const target2 = roundP(entry + 2.5 * risk);
      patterns.push({
        id: `${symbol}-tweezer-bottom-${c0.time || idx}`,
        symbol,
        pattern: 'Tweezer Bottom',
        direction: 'BULLISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: 'Double trough at exact identical price level: Firm demand floor confirmed.'
      });
    }

    // ------------------------------------------------------------------------
    // 9. BULLISH HARAMI (2-Candle Inside Bar Reversal)
    // C1: Large bearish candle
    // C0: Small body contained inside C1's real body
    // ------------------------------------------------------------------------
    if (
      m1.isBear && (m1.body / m1.range >= 0.45) &&
      (m0.body <= m1.body * 0.65) &&
      Math.max(c0.open, c0.close) <= c1.open &&
      Math.min(c0.open, c0.close) >= c1.close
    ) {
      const entry = roundP(Math.max(c0.high, (c1.open + c1.close) / 2));
      const stopLoss = roundP(c1.low - tickBuffer);
      const risk = Math.max(tickBuffer * 2, entry - stopLoss);
      const target1 = roundP(entry + 1.5 * risk);
      const target2 = roundP(entry + 2.5 * risk);
      patterns.push({
        id: `${symbol}-bull-harami-${c0.time || idx}`,
        symbol,
        pattern: 'Bullish Harami',
        direction: 'BULLISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: 'Inside bar compression following bearish drive, indicating exhaustion of selling.'
      });
    }

    // ------------------------------------------------------------------------
    // 10. BEARISH HARAMI (2-Candle Inside Bar Reversal)
    // C1: Large bullish candle
    // C0: Small body contained inside C1's real body
    // ------------------------------------------------------------------------
    if (
      m1.isBull && (m1.body / m1.range >= 0.45) &&
      (m0.body <= m1.body * 0.65) &&
      Math.max(c0.open, c0.close) <= c1.close &&
      Math.min(c0.open, c0.close) >= c1.open
    ) {
      const entry = roundP(Math.min(c0.low, (c1.open + c1.close) / 2));
      const stopLoss = roundP(c1.high + tickBuffer);
      const risk = Math.max(tickBuffer * 2, stopLoss - entry);
      const target1 = roundP(entry - 1.5 * risk);
      const target2 = roundP(entry - 2.5 * risk);
      patterns.push({
        id: `${symbol}-bear-harami-${c0.time || idx}`,
        symbol,
        pattern: 'Bearish Harami',
        direction: 'BEARISH',
        timeframe: timeframeLabel,
        entry,
        stopLoss,
        target1,
        target2,
        riskReward: '1 : 2.5',
        candleTime: timeStr,
        currentPrice: roundP(c0.close),
        description: 'Inside bar compression following bullish drive, indicating exhaustion of buying.'
      });
    }
  });

  // Deduplicate by pattern and entry
  const uniqueMap = new Map();
  patterns.forEach(p => {
    const key = `${p.symbol}-${p.pattern}-${p.timeframe}-${p.entry}`;
    if (!uniqueMap.has(key)) {
      uniqueMap.set(key, p);
    }
  });

  return Array.from(uniqueMap.values());
}

/**
 * Scan a single symbol across a specific timeframe
 */
export async function scanSymbolCandlestickPatterns(symbol, timeframe) {
  let tf = String(timeframe || '15').trim();
  let tfLabel = '15m';
  if (tf === 'D' || tf === '1D') { tf = 'D'; tfLabel = 'Daily'; }
  else if (tf === 'W' || tf === '1W') { tf = 'W'; tfLabel = 'Weekly'; }
  else if (tf === '5' || tf === '5m') { tf = '5'; tfLabel = '5m'; }
  else if (tf === '60' || tf === '1H') { tf = '60'; tfLabel = '1H'; }
  else { tf = '15'; tfLabel = '15m'; }

  const candles = await fetchCandles(symbol, tf, 60);
  if (!candles || candles.length < 5) return [];

  return detectCandlestickPatterns(candles, symbol, tfLabel);
}

/**
 * Helper to update summary counts across all timeframes
 */
function updateSummary() {
  const allResults = [
    ...(patternTestingCache.results.intraday || []),
    ...(patternTestingCache.results.daily || []),
    ...(patternTestingCache.results.weekly || [])
  ];

  patternTestingCache.summary = {
    totalDetected: allResults.length,
    bullishCount: allResults.filter(p => p.direction === 'BULLISH').length,
    bearishCount: allResults.filter(p => p.direction === 'BEARISH').length,
    neutralCount: allResults.filter(p => p.direction === 'NEUTRAL').length,
    universeSize: ALL_SUPPORTED_SYMBOLS.length || 5017
  };
}

/**
 * Scan the universe across a specific category (intraday, daily, weekly)
 * Iterates through all available stocks in the supported stock universe.
 */
export async function scanUniverseCandlestickPatterns(category = 'intraday', customSymbols = null) {
  if (patternTestingCache.isScanning) return patternTestingCache.results;
  patternTestingCache.isScanning = true;

  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  patternTestingCache.date = todayStr;

  const allSymbols = customSymbols && customSymbols.length > 0 ? customSymbols : getAllSupportedSymbols();
  const total = allSymbols.length;

  let tf = '15';
  let tfLabel = '15m';
  let catKey = 'intraday';

  if (category === 'daily' || category === 'D') {
    tf = 'D';
    tfLabel = 'Daily';
    catKey = 'daily';
  } else if (category === 'weekly' || category === 'W') {
    tf = 'W';
    tfLabel = 'Weekly';
    catKey = 'weekly';
  } else {
    tf = '15';
    tfLabel = '15m';
    catKey = 'intraday';
  }

  console.log(`[Pattern Scanner] Scanning supported stock universe (${total} symbols) for ${catKey} (${tfLabel})...`);

  patternTestingCache.scanProgress = {
    current: 0,
    total,
    category: catKey,
    timeframe: tfLabel
  };

  const detectedMap = new Map();
  // Preserve existing cached results for this category (filtering out any < 50 INR stocks)
  (patternTestingCache.results[catKey] || []).filter(item => {
    const p = Number(item.currentPrice || item.entry || 0);
    return p >= 50;
  }).forEach(item => {
    const key = `${item.symbol}-${item.pattern}-${item.timeframe}-${item.entry}`;
    detectedMap.set(key, item);
  });

  const BATCH_SIZE = 5;
  for (let i = 0; i < total; i += BATCH_SIZE) {
    const chunk = allSymbols.slice(i, i + BATCH_SIZE);

    await Promise.all(chunk.map(async (sym) => {
      try {
        const candles = await fetchCandles(sym, tf, 50);
        if (candles && candles.length >= 3) {
          const lastClose = Number(candles[candles.length - 1].close || 0);
          if (lastClose < 50) return; // Skip stocks trading below 50 rupees

          const pats = detectCandlestickPatterns(candles, sym, tfLabel);
          pats.forEach(p => {
            if (Number(p.currentPrice || p.entry || 0) >= 50) {
              const key = `${p.symbol}-${p.pattern}-${p.timeframe}-${p.entry}`;
              detectedMap.set(key, p);
            }
          });
        }
      } catch (e) {
        // Continue to next symbol
      }
    }));

    patternTestingCache.scanProgress.current = Math.min(total, i + BATCH_SIZE);

    // Incrementally update results every 15 symbols so frontend gets live stream of detected stocks
    if (i % 15 === 0 || i + BATCH_SIZE >= total) {
      patternTestingCache.results[catKey] = Array.from(detectedMap.values());
      patternTestingCache.lastScanTime = new Date().toISOString();
      updateSummary();
      saveCacheToDisk();
    }
  }

  patternTestingCache.results[catKey] = Array.from(detectedMap.values());
  patternTestingCache.lastScanTime = new Date().toISOString();
  patternTestingCache.isScanning = false;
  patternTestingCache.scanProgress = null;
  updateSummary();
  saveCacheToDisk();

  console.log(`[Pattern Scanner] Universe scan complete. Total matching stocks in ${catKey}: ${patternTestingCache.results[catKey].length}`);
  return patternTestingCache.results;
}

export function getCandlestickPatternsCache() {
  return patternTestingCache;
}
