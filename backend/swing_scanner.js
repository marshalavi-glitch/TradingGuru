import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { TradingViewBridge } from './tradingview.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const swingTvBridge = new TradingViewBridge();

export const swingCache = {
  lastScanTime: null,
  isScanning: false,
  results: {
    'D': [],
    'W': [],
    '60': []
  },
  date: null
};

const backupFilePath = path.join(__dirname, 'data/swing_trades_today.json');

const SWING_SYMBOLS = [
  { symbol: 'NSE:NIFTY', name: 'NIFTY 50 Index', category: 'Indices' },
  { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY Index', category: 'Indices' },
  { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY Index', category: 'Indices' },
  { symbol: 'BSE:SENSEX', name: 'SENSEX Index', category: 'Indices' },
  { symbol: 'NSE:RELIANCE', name: 'Reliance Industries', category: 'Energy' },
  { symbol: 'NSE:TCS', name: 'Tata Consultancy Services', category: 'IT' },
  { symbol: 'NSE:HDFCBANK', name: 'HDFC Bank', category: 'Banking' },
  { symbol: 'NSE:ICICIBANK', name: 'ICICI Bank', category: 'Banking' },
  { symbol: 'NSE:INFY', name: 'Infosys', category: 'IT' },
  { symbol: 'NSE:SBIN', name: 'State Bank of India', category: 'Banking' },
  { symbol: 'NSE:BHARTIARTL', name: 'Bharti Airtel', category: 'Telecom' },
  { symbol: 'NSE:ITC', name: 'ITC Limited', category: 'FMCG' },
  { symbol: 'NSE:LT', name: 'Larsen & Toubro', category: 'Infra' },
  { symbol: 'NSE:AXISBANK', name: 'Axis Bank', category: 'Banking' },
  { symbol: 'NSE:KOTAKBANK', name: 'Kotak Mahindra Bank', category: 'Banking' },
  { symbol: 'NSE:BAJFINANCE', name: 'Bajaj Finance', category: 'NBFC' },
  { symbol: 'NSE:TATAMOTORS', name: 'Tata Motors', category: 'Auto' },
  { symbol: 'NSE:M&M', name: 'Mahindra & Mahindra', category: 'Auto' },
  { symbol: 'NSE:MARUTI', name: 'Maruti Suzuki', category: 'Auto' },
  { symbol: 'NSE:SUNPHARMA', name: 'Sun Pharma', category: 'Pharma' },
  { symbol: 'NSE:TITAN', name: 'Titan Company', category: 'Consumer' },
  { symbol: 'NSE:TATASTEEL', name: 'Tata Steel', category: 'Metals' },
  { symbol: 'NSE:HINDALCO', name: 'Hindalco Industries', category: 'Metals' },
  { symbol: 'NSE:NTPC', name: 'NTPC Limited', category: 'Energy' },
  { symbol: 'NSE:POWERGRID', name: 'Power Grid Corp', category: 'Energy' },
  { symbol: 'NSE:ONGC', name: 'Oil & Natural Gas Corp', category: 'Energy' },
  { symbol: 'NSE:COALINDIA', name: 'Coal India', category: 'Energy' },
  { symbol: 'NSE:ASIANPAINT', name: 'Asian Paints', category: 'Consumer' },
  { symbol: 'NSE:ULTRACEMCO', name: 'UltraTech Cement', category: 'Materials' },
  { symbol: 'NSE:WIPRO', name: 'Wipro Limited', category: 'IT' },
  { symbol: 'NSE:HCLTECH', name: 'HCL Technologies', category: 'IT' },
  { symbol: 'NSE:TECHM', name: 'Tech Mahindra', category: 'IT' },
  { symbol: 'NSE:LTIM', name: 'LTIMindtree', category: 'IT' },
  { symbol: 'NSE:ADANIENT', name: 'Adani Enterprises', category: 'Conglomerate' },
  { symbol: 'NSE:ADANIPORTS', name: 'Adani Ports', category: 'Infra' },
  { symbol: 'NSE:BAJAJFINSV', name: 'Bajaj Finserv', category: 'NBFC' },
  { symbol: 'NSE:CIPLA', name: 'Cipla Limited', category: 'Pharma' },
  { symbol: 'NSE:DRREDDY', name: 'Dr Reddys Labs', category: 'Pharma' },
  { symbol: 'NSE:DIVISLAB', name: 'Divis Laboratories', category: 'Pharma' },
  { symbol: 'NSE:EICHERMOT', name: 'Eicher Motors', category: 'Auto' },
  { symbol: 'NSE:HEROMOTOCO', name: 'Hero MotoCorp', category: 'Auto' },
  { symbol: 'NSE:GRASIM', name: 'Grasim Industries', category: 'Materials' },
  { symbol: 'NSE:JSWSTEEL', name: 'JSW Steel', category: 'Metals' },
  { symbol: 'NSE:NESTLEIND', name: 'Nestle India', category: 'FMCG' },
  { symbol: 'NSE:TATACONSUM', name: 'Tata Consumer Products', category: 'FMCG' },
  { symbol: 'NSE:BRITANNIA', name: 'Britannia Industries', category: 'FMCG' },
  { symbol: 'NSE:INDUSINDBK', name: 'IndusInd Bank', category: 'Banking' },
  { symbol: 'NSE:BPCL', name: 'Bharat Petroleum', category: 'Energy' }
];

function calculateEma(prices, period) {
  if (!prices || prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema = new Array(prices.length);
  let sum = 0;
  const initialPeriod = Math.min(period, prices.length);
  for (let i = 0; i < initialPeriod; i++) sum += prices[i];
  let currentEma = sum / initialPeriod;

  for (let i = 0; i < prices.length; i++) {
    if (i < period - 1) {
      ema[i] = currentEma;
    } else if (i === period - 1) {
      ema[i] = currentEma;
    } else {
      currentEma = (prices[i] * k) + (currentEma * (1 - k));
      ema[i] = currentEma;
    }
  }
  return ema;
}

function calculateRsi(prices, period = 14) {
  if (!prices || prices.length <= period) return new Array(prices ? prices.length : 0).fill(50);
  const rsi = new Array(prices.length).fill(50);
  const gains = [];
  const losses = [];

  for (let i = 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    gains.push(diff > 0 ? diff : 0);
    losses.push(diff < 0 ? -diff : 0);
  }

  let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
  let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

  const initialRs = avgLoss === 0 ? 100 : avgGain / avgLoss;
  rsi[period] = 100 - (100 / (1 + initialRs));

  for (let i = period + 1; i < prices.length; i++) {
    const gain = gains[i - 1];
    const loss = losses[i - 1];

    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;

    if (avgLoss === 0) {
      rsi[i] = 100;
    } else {
      const rs = avgGain / avgLoss;
      rsi[i] = 100 - (100 / (1 + rs));
    }
  }
  return rsi;
}

function calculateMacd(prices, fastPeriod = 12, slowPeriod = 26, signalPeriod = 9) {
  const fastEma = calculateEma(prices, fastPeriod);
  const slowEma = calculateEma(prices, slowPeriod);
  const macdLine = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push((fastEma[i] || 0) - (slowEma[i] || 0));
  }
  const signalLine = calculateEma(macdLine, signalPeriod);
  const histogram = [];
  for (let i = 0; i < prices.length; i++) {
    histogram.push((macdLine[i] || 0) - (signalLine[i] || 0));
  }
  return { macdLine, signalLine, histogram };
}

function calculateAtr(candles, period = 14) {
  if (!candles || candles.length < 2) return 10;
  const trs = [];
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    const tr = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
    trs.push(tr);
  }
  const slice = trs.slice(-period);
  return slice.reduce((a, b) => a + b, 0) / (slice.length || 1);
}

function analyzeCandlesForSwing(symbolItem, candles, timeframe) {
  if (!candles || candles.length < 35) return null;
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 0);
  const lastIdx = candles.length - 1;
  const ltp = closes[lastIdx];
  const prevClose = closes[Math.max(0, lastIdx - 1)];
  const changePct = prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0;

  const last20Vol = volumes.slice(-20);
  const avgVol = last20Vol.reduce((a, b) => a + b, 0) / (last20Vol.length || 1);
  const volumeRatio = avgVol > 0 ? (volumes[lastIdx] / avgVol) : 1;

  const rsiSeries = calculateRsi(closes, 14);
  const currRsi = rsiSeries[lastIdx] || 50;
  const prevRsi = rsiSeries[lastIdx - 1] || 50;

  let rsiZone = 'NEUTRAL';
  if (currRsi <= 35) rsiZone = 'OVERSOLD';
  else if (currRsi >= 65) rsiZone = 'OVERBOUGHT';
  else if (currRsi >= 50 && currRsi < 65) rsiZone = 'BULLISH_MOMENTUM';
  else if (currRsi > 35 && currRsi < 50) rsiZone = 'BEARISH_MOMENTUM';

  let rsiSignal = 'NONE';
  if (prevRsi <= 30 && currRsi > 30) rsiSignal = 'OVERSOLD_BOUNCE';
  else if (prevRsi >= 70 && currRsi < 70) rsiSignal = 'OVERBOUGHT_REVERSAL';
  else if (prevRsi < 50 && currRsi >= 50) rsiSignal = 'BULLISH_CROSS_50';
  else if (prevRsi > 50 && currRsi <= 50) rsiSignal = 'BEARISH_CROSS_50';

  const { macdLine, signalLine, histogram } = calculateMacd(closes, 12, 26, 9);
  const currMacd = macdLine[lastIdx] || 0;
  const currSignal = signalLine[lastIdx] || 0;
  const currHist = histogram[lastIdx] || 0;
  const prevMacd = macdLine[lastIdx - 1] || 0;
  const prevSignal = signalLine[lastIdx - 1] || 0;
  const prevHist = histogram[lastIdx - 1] || 0;

  let macdCrossover = 'NONE';
  if (prevMacd <= prevSignal && currMacd > currSignal) {
    macdCrossover = 'GOLDEN_CROSS';
  } else if (prevMacd >= prevSignal && currMacd < currSignal) {
    macdCrossover = 'DEATH_CROSS';
  } else if (prevMacd <= 0 && currMacd > 0) {
    macdCrossover = 'ABOVE_ZERO';
  } else if (prevMacd >= 0 && currMacd < 0) {
    macdCrossover = 'BELOW_ZERO';
  }

  let histTrend = 'NEUTRAL';
  if (currHist > 0) {
    histTrend = currHist > prevHist ? 'EXPANDING_BULLISH' : 'WEAKENING_BULLISH';
  } else if (currHist < 0) {
    histTrend = currHist < prevHist ? 'EXPANDING_BEARISH' : 'WEAKENING_BEARISH';
  }

  let bias = 'NEUTRAL';
  let score = 50;
  let signalTitle = 'Consolidation Zone';
  let setupDescription = 'Stock trading in range without active MACD or RSI trigger.';

  let bullishPoints = 0;
  let bearishPoints = 0;

  if (macdCrossover === 'GOLDEN_CROSS') bullishPoints += 40;
  else if (currHist > 0 && histTrend === 'EXPANDING_BULLISH') bullishPoints += 25;
  else if (currMacd > currSignal) bullishPoints += 15;
  if (macdCrossover === 'ABOVE_ZERO' || currMacd > 0) bullishPoints += 10;

  if (rsiSignal === 'OVERSOLD_BOUNCE') bullishPoints += 35;
  else if (rsiSignal === 'BULLISH_CROSS_50') bullishPoints += 25;
  else if (currRsi >= 50 && currRsi <= 65) bullishPoints += 20;
  else if (currRsi < 40 && currRsi > prevRsi) bullishPoints += 15;

  if (macdCrossover === 'DEATH_CROSS') bearishPoints += 40;
  else if (currHist < 0 && histTrend === 'EXPANDING_BEARISH') bearishPoints += 25;
  else if (currMacd < currSignal) bearishPoints += 15;
  if (macdCrossover === 'BELOW_ZERO' || currMacd < 0) bearishPoints += 10;

  if (rsiSignal === 'OVERBOUGHT_REVERSAL') bearishPoints += 35;
  else if (rsiSignal === 'BEARISH_CROSS_50') bearishPoints += 25;
  else if (currRsi <= 50 && currRsi >= 35) bearishPoints += 20;
  else if (currRsi > 65 && currRsi < prevRsi) bearishPoints += 15;

  if (volumeRatio > 1.3) {
    if (bullishPoints > bearishPoints) bullishPoints += 10;
    else if (bearishPoints > bullishPoints) bearishPoints += 10;
  }

  if (bullishPoints >= bearishPoints + 15 && bullishPoints >= 30) {
    bias = 'BULLISH';
    score = Math.min(98, Math.round(50 + bullishPoints * 0.5));
    if (macdCrossover === 'GOLDEN_CROSS' && rsiSignal === 'OVERSOLD_BOUNCE') {
      signalTitle = '🚀 Prime Oversold Golden Cross';
      setupDescription = `RSI (${currRsi.toFixed(1)}) bounced from oversold level with fresh MACD Golden Crossover. High probability long swing setup!`;
    } else if (macdCrossover === 'GOLDEN_CROSS') {
      signalTitle = '⚡ MACD Golden Crossover';
      setupDescription = `MACD line crossed above Signal Line with expanding green histogram and healthy RSI (${currRsi.toFixed(1)}).`;
    } else if (rsiSignal === 'OVERSOLD_BOUNCE') {
      signalTitle = '🎯 RSI Oversold Reversal';
      setupDescription = `RSI (${currRsi.toFixed(1)}) recovering from oversold zone with positive momentum building.`;
    } else {
      signalTitle = '📈 Bullish Swing Momentum';
      setupDescription = `Strong RSI momentum (${currRsi.toFixed(1)}) paired with positive MACD histogram expansion.`;
    }
  } else if (bearishPoints >= bullishPoints + 15 && bearishPoints >= 30) {
    bias = 'BEARISH';
    score = Math.min(98, Math.round(50 + bearishPoints * 0.5));
    if (macdCrossover === 'DEATH_CROSS' && rsiSignal === 'OVERBOUGHT_REVERSAL') {
      signalTitle = '📉 Overbought Death Cross';
      setupDescription = `RSI (${currRsi.toFixed(1)}) reversed from overbought level with MACD Death Crossover. High probability short swing setup!`;
    } else if (macdCrossover === 'DEATH_CROSS') {
      signalTitle = '🚨 MACD Death Crossover';
      setupDescription = `MACD line crossed below Signal Line with expanding red histogram and weakening RSI (${currRsi.toFixed(1)}).`;
    } else if (rsiSignal === 'OVERBOUGHT_REVERSAL') {
      signalTitle = '⚠️ RSI Overbought Reversal';
      setupDescription = `RSI (${currRsi.toFixed(1)}) retreating from overbought zone. Watch for downward swing correction.`;
    } else {
      signalTitle = '📉 Bearish Swing Breakdown';
      setupDescription = `RSI slipping below 50 (${currRsi.toFixed(1)}) with negative MACD histogram expansion.`;
    }
  }

  let grade = 'NEUTRAL';
  if (bias === 'BULLISH') {
    if (score >= 82) grade = 'STRONG BUY';
    else if (score >= 68) grade = 'MODERATE BUY';
    else grade = 'WATCHLIST LONG';
  } else if (bias === 'BEARISH') {
    if (score >= 82) grade = 'STRONG SELL';
    else if (score >= 68) grade = 'MODERATE SELL';
    else grade = 'WATCHLIST SHORT';
  }

  const atr = calculateAtr(candles, 14);
  let stopLoss = ltp;
  let target1 = ltp;
  let target2 = ltp;
  let riskReward = '1 : 2.0';

  if (bias === 'BULLISH') {
    stopLoss = Math.round((ltp - Math.max(atr * 1.5, ltp * 0.025)) * 10) / 10;
    target1 = Math.round((ltp + Math.max(atr * 2.0, ltp * 0.04)) * 10) / 10;
    target2 = Math.round((ltp + Math.max(atr * 3.5, ltp * 0.07)) * 10) / 10;
    const risk = ltp - stopLoss;
    const reward = target1 - ltp;
    riskReward = `1 : ${(risk > 0 ? reward / risk : 2.0).toFixed(1)}`;
  } else if (bias === 'BEARISH') {
    stopLoss = Math.round((ltp + Math.max(atr * 1.5, ltp * 0.025)) * 10) / 10;
    target1 = Math.round((ltp - Math.max(atr * 2.0, ltp * 0.04)) * 10) / 10;
    target2 = Math.round((ltp - Math.max(atr * 3.5, ltp * 0.07)) * 10) / 10;
    const risk = stopLoss - ltp;
    const reward = ltp - target1;
    riskReward = `1 : ${(risk > 0 ? reward / risk : 2.0).toFixed(1)}`;
  } else {
    stopLoss = Math.round((ltp * 0.98) * 10) / 10;
    target1 = Math.round((ltp * 1.03) * 10) / 10;
    target2 = Math.round((ltp * 1.05) * 10) / 10;
  }

  return {
    symbol: symbolItem.symbol,
    name: symbolItem.name,
    category: symbolItem.category,
    timeframe,
    ltp,
    changePct: Math.round(changePct * 100) / 100,
    volume: volumes[lastIdx] || 0,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    macd: {
      macdLine: Math.round(currMacd * 100) / 100,
      signalLine: Math.round(currSignal * 100) / 100,
      histogram: Math.round(currHist * 100) / 100,
      prevMacdLine: Math.round(prevMacd * 100) / 100,
      prevSignalLine: Math.round(prevSignal * 100) / 100,
      prevHistogram: Math.round(prevHist * 100) / 100,
      crossover: macdCrossover,
      histogramTrend: histTrend
    },
    rsi: {
      rsi: Math.round(currRsi * 10) / 10,
      prevRsi: Math.round(prevRsi * 10) / 10,
      zone: rsiZone,
      signal: rsiSignal
    },
    bias,
    signalTitle,
    setupDescription,
    score,
    grade,
    entryPrice: ltp,
    target1,
    target2,
    stopLoss,
    riskReward,
    lastUpdated: new Date().toLocaleTimeString('en-IN', { hour12: false }),
    sparklineCloses: closes.slice(-15)
  };
}

function fetchCandlesForSymbol(tvBridge, symbol, timeframe, limit) {
  return new Promise((resolve) => {
    let cleanupFn = null;
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        if (cleanupFn) cleanupFn();
        resolve(null);
      }
    }, 6000);

    cleanupFn = tvBridge.subscribe(
      symbol,
      timeframe,
      (data) => {
        if (!resolved && data && data.candles && data.candles.length >= 20) {
          resolved = true;
          clearTimeout(timeout);
          if (cleanupFn) cleanupFn();
          resolve(data.candles);
        }
      },
      (err) => {
        if (!resolved) {
          resolved = true;
          clearTimeout(timeout);
          if (cleanupFn) cleanupFn();
          resolve(null);
        }
      }
    );
  });
}

function saveSwingCacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: swingCache.date,
      results: swingCache.results,
      lastScanTime: swingCache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[Swing Scanner] Failed to save backup:', err);
  }
}

export function loadSwingCacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.date === todayStr) {
        swingCache.date = data.date;
        swingCache.results = data.results || { 'D': [], 'W': [], '60': [] };
        swingCache.lastScanTime = data.lastScanTime || null;
        console.log(`[Swing Scanner] Restored swing results from disk cache.`);
      }
    }
  } catch (err) {
    console.error('[Swing Scanner] Failed to load backup:', err);
  }
}

export async function scanSwingTrades(timeframe = 'D') {
  if (swingCache.isScanning) return swingCache.results[timeframe] || [];
  swingCache.isScanning = true;
  console.log(`[Swing Scanner] Starting scan for timeframe ${timeframe}...`);

  const results = [];
  try {
    for (const symItem of SWING_SYMBOLS) {
      try {
        const candles = await fetchCandlesForSymbol(swingTvBridge, symItem.symbol, timeframe, 150);
        if (candles && candles.length >= 35) {
          const analysis = analyzeCandlesForSwing(symItem, candles, timeframe);
          if (analysis) {
            results.push(analysis);
          }
        }
      } catch (e) {
        // Continue to next stock
      }
      await new Promise(r => setTimeout(r, 150));
    }

    // Sort results by score descending
    results.sort((a, b) => b.score - a.score);

    swingCache.results[timeframe] = results;
    swingCache.lastScanTime = new Date().toISOString();
    swingCache.date = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
    saveSwingCacheToDisk();
    console.log(`[Swing Scanner] Scan complete. Found ${results.length} swing stock analyses.`);
  } catch (err) {
    console.error('[Swing Scanner] Error during scan:', err);
  } finally {
    swingCache.isScanning = false;
  }
  return results;
}

export function getSwingResults(timeframe = 'D') {
  return {
    lastScanTime: swingCache.lastScanTime,
    isScanning: swingCache.isScanning,
    results: swingCache.results[timeframe] || []
  };
}

// Background auto scanner timer (scans every 10 minutes)
setInterval(() => {
  scanSwingTrades('D');
}, 10 * 60 * 1000);
