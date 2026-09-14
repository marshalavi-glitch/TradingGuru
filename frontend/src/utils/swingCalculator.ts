import { Candle } from './profileCalculator';

export interface MacdResult {
  macdLine: number;
  signalLine: number;
  histogram: number;
  prevMacdLine: number;
  prevSignalLine: number;
  prevHistogram: number;
  crossover: 'GOLDEN_CROSS' | 'DEATH_CROSS' | 'ABOVE_ZERO' | 'BELOW_ZERO' | 'NONE';
  histogramTrend: 'EXPANDING_BULLISH' | 'WEAKENING_BULLISH' | 'EXPANDING_BEARISH' | 'WEAKENING_BEARISH' | 'NEUTRAL';
}

export interface RsiResult {
  rsi: number;
  prevRsi: number;
  zone: 'OVERSOLD' | 'BULLISH_MOMENTUM' | 'NEUTRAL' | 'BEARISH_MOMENTUM' | 'OVERBOUGHT';
  signal: 'OVERSOLD_BOUNCE' | 'OVERBOUGHT_REVERSAL' | 'BULLISH_CROSS_50' | 'BEARISH_CROSS_50' | 'NONE';
}

export interface SwingStockResult {
  symbol: string;
  name: string;
  category: string;
  timeframe: string;
  ltp: number;
  changePct: number;
  volume: number;
  volumeRatio: number; // Volume / 20 SMA Volume
  macd: MacdResult;
  rsi: RsiResult;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  signalTitle: string;
  setupDescription: string;
  score: number; // 0 - 100%
  grade: 'STRONG BUY' | 'MODERATE BUY' | 'WATCHLIST LONG' | 'NEUTRAL' | 'WATCHLIST SHORT' | 'MODERATE SELL' | 'STRONG SELL';
  entryPrice: number;
  target1: number;
  target2: number;
  stopLoss: number;
  riskReward: string;
  lastUpdated: string;
  sparklineCloses: number[];
}

/**
 * Calculates Exponential Moving Average (EMA)
 */
export function calculateEma(prices: number[], period: number): number[] {
  if (prices.length === 0) return [];
  const k = 2 / (period + 1);
  const ema: number[] = new Array(prices.length);
  
  // Initial SMA for first value
  let sum = 0;
  const initialPeriod = Math.min(period, prices.length);
  for (let i = 0; i < initialPeriod; i++) {
    sum += prices[i];
  }
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

/**
 * Calculates Relative Strength Index (RSI - 14)
 */
export function calculateRsi(prices: number[], period: number = 14): number[] {
  if (prices.length <= period) return new Array(prices.length).fill(50);
  
  const rsi: number[] = new Array(prices.length).fill(50);
  const gains: number[] = [];
  const losses: number[] = [];
  
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

/**
 * Calculates MACD (12, 26, 9)
 */
export function calculateMacd(prices: number[], fastPeriod: number = 12, slowPeriod: number = 26, signalPeriod: number = 9): {
  macdLine: number[];
  signalLine: number[];
  histogram: number[];
} {
  const fastEma = calculateEma(prices, fastPeriod);
  const slowEma = calculateEma(prices, slowPeriod);
  
  const macdLine: number[] = [];
  for (let i = 0; i < prices.length; i++) {
    macdLine.push((fastEma[i] || 0) - (slowEma[i] || 0));
  }
  
  const signalLine = calculateEma(macdLine, signalPeriod);
  const histogram: number[] = [];
  
  for (let i = 0; i < prices.length; i++) {
    histogram.push((macdLine[i] || 0) - (signalLine[i] || 0));
  }
  
  return { macdLine, signalLine, histogram };
}

/**
 * Calculates ATR (Average True Range)
 */
export function calculateAtr(candles: Candle[], period: number = 14): number {
  if (candles.length < 2) return 10;
  const trs: number[] = [];
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

/**
 * Analyzes MACD & RSI Swing Trade setup from candle data
 */
export function analyzeSwingTrade(
  symbol: string,
  stockName: string,
  category: string,
  candles: Candle[],
  timeframe: string = 'D'
): SwingStockResult | null {
  if (!candles || candles.length < 35) return null;
  
  const closes = candles.map(c => c.close);
  const volumes = candles.map(c => c.volume || 0);
  const lastIdx = candles.length - 1;
  const ltp = closes[lastIdx];
  const prevClose = closes[Math.max(0, lastIdx - 1)];
  const changePct = prevClose > 0 ? ((ltp - prevClose) / prevClose) * 100 : 0;
  
  // Volume ratio
  const last20Vol = volumes.slice(-20);
  const avgVol = last20Vol.reduce((a, b) => a + b, 0) / (last20Vol.length || 1);
  const volumeRatio = avgVol > 0 ? (volumes[lastIdx] / avgVol) : 1;
  
  // RSI Calculation
  const rsiSeries = calculateRsi(closes, 14);
  const currRsi = rsiSeries[lastIdx] || 50;
  const prevRsi = rsiSeries[lastIdx - 1] || 50;
  
  let rsiZone: RsiResult['zone'] = 'NEUTRAL';
  if (currRsi <= 35) rsiZone = 'OVERSOLD';
  else if (currRsi >= 65) rsiZone = 'OVERBOUGHT';
  else if (currRsi >= 50 && currRsi < 65) rsiZone = 'BULLISH_MOMENTUM';
  else if (currRsi > 35 && currRsi < 50) rsiZone = 'BEARISH_MOMENTUM';
  
  let rsiSignal: RsiResult['signal'] = 'NONE';
  if (prevRsi <= 30 && currRsi > 30) rsiSignal = 'OVERSOLD_BOUNCE';
  else if (prevRsi >= 70 && currRsi < 70) rsiSignal = 'OVERBOUGHT_REVERSAL';
  else if (prevRsi < 50 && currRsi >= 50) rsiSignal = 'BULLISH_CROSS_50';
  else if (prevRsi > 50 && currRsi <= 50) rsiSignal = 'BEARISH_CROSS_50';

  const rsiMetrics: RsiResult = {
    rsi: Math.round(currRsi * 10) / 10,
    prevRsi: Math.round(prevRsi * 10) / 10,
    zone: rsiZone,
    signal: rsiSignal
  };

  // MACD Calculation
  const { macdLine, signalLine, histogram } = calculateMacd(closes, 12, 26, 9);
  const currMacd = macdLine[lastIdx] || 0;
  const currSignal = signalLine[lastIdx] || 0;
  const currHist = histogram[lastIdx] || 0;
  const prevMacd = macdLine[lastIdx - 1] || 0;
  const prevSignal = signalLine[lastIdx - 1] || 0;
  const prevHist = histogram[lastIdx - 1] || 0;

  let macdCrossover: MacdResult['crossover'] = 'NONE';
  if (prevMacd <= prevSignal && currMacd > currSignal) {
    macdCrossover = 'GOLDEN_CROSS';
  } else if (prevMacd >= prevSignal && currMacd < currSignal) {
    macdCrossover = 'DEATH_CROSS';
  } else if (prevMacd <= 0 && currMacd > 0) {
    macdCrossover = 'ABOVE_ZERO';
  } else if (prevMacd >= 0 && currMacd < 0) {
    macdCrossover = 'BELOW_ZERO';
  }

  let histTrend: MacdResult['histogramTrend'] = 'NEUTRAL';
  if (currHist > 0) {
    histTrend = currHist > prevHist ? 'EXPANDING_BULLISH' : 'WEAKENING_BULLISH';
  } else if (currHist < 0) {
    histTrend = currHist < prevHist ? 'EXPANDING_BEARISH' : 'WEAKENING_BEARISH';
  }

  const macdMetrics: MacdResult = {
    macdLine: Math.round(currMacd * 100) / 100,
    signalLine: Math.round(currSignal * 100) / 100,
    histogram: Math.round(currHist * 100) / 100,
    prevMacdLine: Math.round(prevMacd * 100) / 100,
    prevSignalLine: Math.round(prevSignal * 100) / 100,
    prevHistogram: Math.round(prevHist * 100) / 100,
    crossover: macdCrossover,
    histogramTrend: histTrend
  };

  // Determine Bias, Score, and Setup Details
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let score = 50;
  let signalTitle = 'Neutral / Consolidated';
  let setupDescription = 'Price is consolidating within range with no active MACD/RSI trigger.';

  // Scoring Logic
  let bullishPoints = 0;
  let bearishPoints = 0;

  // MACD Bullish Factors
  if (macdCrossover === 'GOLDEN_CROSS') bullishPoints += 40;
  else if (currHist > 0 && histTrend === 'EXPANDING_BULLISH') bullishPoints += 25;
  else if (currMacd > currSignal) bullishPoints += 15;
  if (macdCrossover === 'ABOVE_ZERO' || currMacd > 0) bullishPoints += 10;

  // RSI Bullish Factors
  if (rsiSignal === 'OVERSOLD_BOUNCE') bullishPoints += 35;
  else if (rsiSignal === 'BULLISH_CROSS_50') bullishPoints += 25;
  else if (currRsi >= 50 && currRsi <= 65) bullishPoints += 20;
  else if (currRsi < 40 && currRsi > prevRsi) bullishPoints += 15;

  // MACD Bearish Factors
  if (macdCrossover === 'DEATH_CROSS') bearishPoints += 40;
  else if (currHist < 0 && histTrend === 'EXPANDING_BEARISH') bearishPoints += 25;
  else if (currMacd < currSignal) bearishPoints += 15;
  if (macdCrossover === 'BELOW_ZERO' || currMacd < 0) bearishPoints += 10;

  // RSI Bearish Factors
  if (rsiSignal === 'OVERBOUGHT_REVERSAL') bearishPoints += 35;
  else if (rsiSignal === 'BEARISH_CROSS_50') bearishPoints += 25;
  else if (currRsi <= 50 && currRsi >= 35) bearishPoints += 20;
  else if (currRsi > 65 && currRsi < prevRsi) bearishPoints += 15;

  // Volume Confirmation
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

  // Grade
  let grade: SwingStockResult['grade'] = 'NEUTRAL';
  if (bias === 'BULLISH') {
    if (score >= 82) grade = 'STRONG BUY';
    else if (score >= 68) grade = 'MODERATE BUY';
    else grade = 'WATCHLIST LONG';
  } else if (bias === 'BEARISH') {
    if (score >= 82) grade = 'STRONG SELL';
    else if (score >= 68) grade = 'MODERATE SELL';
    else grade = 'WATCHLIST SHORT';
  }

  // Risk Targets based on ATR
  const atr = calculateAtr(candles, 14);
  const entryPrice = ltp;
  let target1 = ltp;
  let target2 = ltp;
  let stopLoss = ltp;
  let riskReward = '1 : 2.0';

  if (bias === 'BULLISH') {
    stopLoss = Math.round((ltp - Math.max(atr * 1.5, ltp * 0.025)) * 10) / 10;
    target1 = Math.round((ltp + Math.max(atr * 2.0, ltp * 0.04)) * 10) / 10;
    target2 = Math.round((ltp + Math.max(atr * 3.5, ltp * 0.07)) * 10) / 10;
    const risk = ltp - stopLoss;
    const reward = target1 - ltp;
    const rr = risk > 0 ? (reward / risk).toFixed(1) : '2.0';
    riskReward = `1 : ${rr}`;
  } else if (bias === 'BEARISH') {
    stopLoss = Math.round((ltp + Math.max(atr * 1.5, ltp * 0.025)) * 10) / 10;
    target1 = Math.round((ltp - Math.max(atr * 2.0, ltp * 0.04)) * 10) / 10;
    target2 = Math.round((ltp - Math.max(atr * 3.5, ltp * 0.07)) * 10) / 10;
    const risk = stopLoss - ltp;
    const reward = ltp - target1;
    const rr = risk > 0 ? (reward / risk).toFixed(1) : '2.0';
    riskReward = `1 : ${rr}`;
  } else {
    stopLoss = Math.round((ltp * 0.98) * 10) / 10;
    target1 = Math.round((ltp * 1.03) * 10) / 10;
    target2 = Math.round((ltp * 1.05) * 10) / 10;
  }

  const sparklineCloses = closes.slice(-15);

  return {
    symbol,
    name: stockName,
    category,
    timeframe,
    ltp,
    changePct: Math.round(changePct * 100) / 100,
    volume: volumes[lastIdx] || 0,
    volumeRatio: Math.round(volumeRatio * 100) / 100,
    macd: macdMetrics,
    rsi: rsiMetrics,
    bias,
    signalTitle,
    setupDescription,
    score,
    grade,
    entryPrice,
    target1,
    target2,
    stopLoss,
    riskReward,
    lastUpdated: new Date().toLocaleTimeString('en-IN', { hour12: false }),
    sparklineCloses
  };
}
