import { calculateMatrixSeriesData, type MatrixSeriesData } from './matrixCalculator';
import type { Candle } from './profileCalculator';

// ============================================================================
// 1. DATA TYPES & INTERFACES (Specification Section 2, 7, 8, 9, 10, 11)
// ============================================================================

export type MarshallStrategyType = 
  | 'PRIMARY_BUY' 
  | 'PRIMARY_SELL' 
  | 'CONTINUATION_BUY' 
  | 'CONTINUATION_SELL';

export type MarshallState = 
  | 'IDLE'
  | 'WAITING_FOR_SUPPORT'
  | 'WAITING_FOR_RESISTANCE'
  | 'WAITING_FOR_BREAKOUT'
  | 'WAITING_FOR_BREAKDOWN'
  | 'BREAKOUT_CONFIRMED'
  | 'BREAKDOWN_CONFIRMED'
  | 'WAITING_FOR_RETEST'
  | 'RETEST_CONFIRMED'
  | 'ENTRY_GENERATED'
  | 'TARGET_1_HIT'
  | 'TARGET_2_HIT'
  | 'STOP_LOSS_HIT'
  | 'TRADE_COMPLETED'
  | 'SETUP_INVALIDATED';

export interface MarshallLevels {
  buyReversal: number;      // S3 (Buy Reversal)
  sellReversal: number;     // R3 (Sell Reversal)
  breakout: number;         // R4 (Bullish Breakout)
  breakdown: number;        // S4 (Bearish Breakdown)
  upperTarget1: number;     // R5 (Upper Target 1)
  upperTarget2: number;     // R6 (Upper Target 2)
  lowerTarget1: number;     // S5 (Lower Target 1)
  lowerTarget2: number;     // S6 (Lower Target 2)
  r2: number;
  s2: number;
  vwap?: number;
  volumeAvg20?: number;
}

export interface ConfirmationStatus {
  priceConfirmed: boolean;
  volumeConfirmed: boolean;
  vwapConfirmed: boolean;
  candleConfirmed: boolean;
  overallConfirmed: boolean;
  details: {
    priceNote: string;
    volumeRatio: number;
    volumeNote: string;
    vwapNote: string;
    candlePattern: string;
  };
}

export interface MarshallSignal {
  id: string;
  symbol: string;
  timeframe: string;
  timestamp: number;
  timeStr: string;
  strategy: MarshallStrategyType;
  direction: 'BUY' | 'SELL';
  label: 'MARSHALL BUY' | 'MARSHALL SELL' | 'CONTINUATION BUY' | 'CONTINUATION SELL';
  entryPrice: number;
  stopLossPrice: number;
  target1Price: number;
  target2Price: number;
  riskPoints: number;
  rewardPointsT1: number;
  rewardPointsT2: number;
  riskRewardRatio: number;
  confirmation: ConfirmationStatus;
  status: MarshallState;
  activeQuantityPct: number;
  exitPrice?: number;
  exitTime?: number;
  pnlPoints?: number;
  pnlPct?: number;
  pnlRupees?: number;
  notes: string[];
}

export interface MarshallEngineConfig {
  enablePrimaryBuy: boolean;
  enablePrimarySell: boolean;
  enableContinuationBuy: boolean;
  enableContinuationSell: boolean;
  volumeFilterEnabled: boolean;
  volumeMultiplier: number;           // Default: 1.20x
  vwapFilterEnabled: boolean;         // Default: true
  candleStrengthRequired: boolean;    // Default: true
  trailingStopEnabled: boolean;       // Default: true (moves to breakeven after T1)
  target1BookingPct: number;          // Default: 50%
  target2BookingPct: number;          // Default: 50%
  slippagePct: number;                // Default: 0.05%
  brokeragePerTrade: number;          // Default: ₹20 flat
  retestBufferPct: number;            // Default: 0.25%
}

export const DEFAULT_MARSHALL_CONFIG: MarshallEngineConfig = {
  enablePrimaryBuy: true,
  enablePrimarySell: true,
  enableContinuationBuy: true,
  enableContinuationSell: true,
  volumeFilterEnabled: true,
  volumeMultiplier: 1.20,
  vwapFilterEnabled: true,
  candleStrengthRequired: true,
  trailingStopEnabled: true,
  target1BookingPct: 50,
  target2BookingPct: 50,
  slippagePct: 0.05,
  brokeragePerTrade: 20,
  retestBufferPct: 0.25
};

// ============================================================================
// 2. INDICATOR DATA ADAPTER (Specification Section 2 & 14)
// ============================================================================

/**
 * Computes exact Marshall Institutional Levels from candle series
 * Consumes the underlying mathematical Camarilla / Marshall Matrix formulation
 */
export function extractMarshallLevels(candles: Candle[], timeframe: string): MarshallLevels | null {
  if (!candles || candles.length < 2) return null;

  const isDailyAnchor = !(timeframe === 'D' || timeframe === 'W' || timeframe === 'M');
  const groups: Record<string, Candle[]> = {};
  const groupKeys: string[] = [];

  candles.forEach((c) => {
    const date = new Date(c.time * 1000);
    const key = isDailyAnchor
      ? date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
      : date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 7);

    if (!groups[key]) {
      groups[key] = [];
      groupKeys.push(key);
    }
    groups[key].push(c);
  });

  groupKeys.sort();

  // If we only have 1 day, calculate levels using current day's range
  const targetGroupKey = groupKeys.length >= 2 ? groupKeys[groupKeys.length - 2] : groupKeys[0];
  const refCandles = groups[targetGroupKey];
  if (!refCandles || refCandles.length === 0) return null;

  const h_prev = Math.max(...refCandles.map(c => c.high));
  const l_prev = Math.min(...refCandles.map(c => c.low));
  const sortedPrev = [...refCandles].sort((a, b) => a.time - b.time);
  const c_prev = sortedPrev[sortedPrev.length - 1].close;

  let r_prev = h_prev - l_prev;
  if (r_prev <= 0) r_prev = Math.max(1, c_prev * 0.01);

  // Exact Marshall Levels
  const r2 = c_prev + (r_prev * 1.1 / 6.0);
  const s2 = c_prev - (r_prev * 1.1 / 6.0);
  const r3 = c_prev + (r_prev * 1.1 / 4.0); // Sell Reversal (SR)
  const s3 = c_prev - (r_prev * 1.1 / 4.0); // Buy Reversal (BR)
  const r4 = c_prev + (r_prev * 1.1 / 2.0); // Bullish Breakout
  const s4 = c_prev - (r_prev * 1.1 / 2.0); // Bearish Breakdown

  const r5 = r4 + 1.168 * (r4 - r3);       // Upper Target 1
  const s5 = s4 - 1.168 * (s3 - s4);       // Lower Target 1
  const r6 = r5 + 1.168 * (r4 - r3);       // Upper Target 2
  const s6 = Math.max(0.05, s5 - 1.168 * (s3 - s4)); // Lower Target 2

  // Current session candles for Intraday VWAP & Volume
  const currentKey = groupKeys[groupKeys.length - 1];
  const curCandles = groups[currentKey] || [];
  
  let cumVol = 0;
  let cumTypVol = 0;
  curCandles.forEach(c => {
    const typ = (c.high + c.low + c.close) / 3;
    const vol = c.volume || 1;
    cumVol += vol;
    cumTypVol += typ * vol;
  });
  const vwap = cumVol > 0 ? cumTypVol / cumVol : c_prev;

  // 20-period average volume
  const last20 = candles.slice(-20);
  const volumeAvg20 = last20.reduce((acc, c) => acc + (c.volume || 0), 0) / Math.max(1, last20.length);

  return {
    buyReversal: Math.round(s3 * 100) / 100,
    sellReversal: Math.round(r3 * 100) / 100,
    breakout: Math.round(r4 * 100) / 100,
    breakdown: Math.round(s4 * 100) / 100,
    upperTarget1: Math.round(r5 * 100) / 100,
    upperTarget2: Math.round(r6 * 100) / 100,
    lowerTarget1: Math.round(s5 * 100) / 100,
    lowerTarget2: Math.round(s6 * 100) / 100,
    r2: Math.round(r2 * 100) / 100,
    s2: Math.round(s2 * 100) / 100,
    vwap: Math.round(vwap * 100) / 100,
    volumeAvg20: Math.round(volumeAvg20)
  };
}

// ============================================================================
// 3. CONFIRMATION CHECKLIST (Specification Section 7)
// ============================================================================

export function evaluateConfirmation(
  bar: Candle,
  triggerPrice: number,
  direction: 'BUY' | 'SELL',
  levels: MarshallLevels,
  config: MarshallEngineConfig,
  avgVol: number
): ConfirmationStatus {
  // A. Price Confirmation (Closed beyond trigger level)
  const isBuy = direction === 'BUY';
  const priceConfirmed = isBuy ? bar.close > triggerPrice : bar.close < triggerPrice;
  const priceNote = priceConfirmed
    ? `Close ${bar.close.toFixed(1)} cleared trigger ${triggerPrice.toFixed(1)}`
    : `Close ${bar.close.toFixed(1)} failed trigger ${triggerPrice.toFixed(1)}`;

  // B. Volume Confirmation (Volume >= multiplier * 20-SMA)
  const volRatio = avgVol > 0 ? (bar.volume || 0) / avgVol : 1.0;
  const volumeConfirmed = !config.volumeFilterEnabled || volRatio >= config.volumeMultiplier;
  const volumeNote = config.volumeFilterEnabled
    ? `${volRatio.toFixed(2)}x vol (${volRatio >= config.volumeMultiplier ? '✅ PASS' : '❌ FAIL, min ' + config.volumeMultiplier + 'x'})`
    : 'Volume filter disabled (BYPASSED)';

  // C. VWAP Confirmation (BUY above VWAP, SELL below VWAP)
  const vwap = levels.vwap || bar.close;
  const vwapConfirmed = !config.vwapFilterEnabled || (isBuy ? bar.close >= vwap : bar.close <= vwap);
  const vwapNote = config.vwapFilterEnabled
    ? `LTP ${bar.close.toFixed(1)} ${isBuy ? '>= ' : '<= '} VWAP ${vwap.toFixed(1)} (${vwapConfirmed ? '✅ PASS' : '❌ FAIL'})`
    : 'VWAP filter disabled (BYPASSED)';

  // D. Candle Confirmation
  const body = Math.abs(bar.close - bar.open);
  const totalRange = Math.max(0.01, bar.high - bar.low);
  const isGreen = bar.close >= bar.open;
  const lowerWick = Math.min(bar.open, bar.close) - bar.low;
  const upperWick = bar.high - Math.max(bar.open, bar.close);

  let candleConfirmed = true;
  let candlePattern = 'Standard';

  if (config.candleStrengthRequired) {
    if (isBuy) {
      const hasRejection = lowerWick >= body * 0.8 || isGreen;
      candleConfirmed = hasRejection && isGreen;
      candlePattern = isGreen ? (lowerWick > body ? 'Hammer Rejection' : 'Bullish Marubozu') : 'Bearish (Rejected)';
    } else {
      const hasRejection = upperWick >= body * 0.8 || !isGreen;
      candleConfirmed = hasRejection && !isGreen;
      candlePattern = !isGreen ? (upperWick > body ? 'Shooting Star Rejection' : 'Bearish Marubozu') : 'Bullish (Rejected)';
    }
  }

  const overallConfirmed = priceConfirmed && volumeConfirmed && vwapConfirmed && candleConfirmed;

  return {
    priceConfirmed,
    volumeConfirmed,
    vwapConfirmed,
    candleConfirmed,
    overallConfirmed,
    details: {
      priceNote,
      volumeRatio: volRatio,
      volumeNote,
      vwapNote,
      candlePattern
    }
  };
}

// ============================================================================
// 4. STRATEGY ENGINE & STATE MACHINE (Specification Section 3, 4, 5, 6, 8, 11)
// ============================================================================

export interface MarshallEngineResult {
  symbol: string;
  timeframe: string;
  levels: MarshallLevels | null;
  activeSignals: MarshallSignal[];
  completedTrades: MarshallSignal[];
  currentSignal: MarshallSignal | null;
  stateMachine: {
    primaryBuyState: MarshallState;
    primarySellState: MarshallState;
    contBuyState: MarshallState;
    contSellState: MarshallState;
  };
  metrics: {
    totalTrades: number;
    winningTrades: number;
    losingTrades: number;
    winRatePct: number;
    totalProfitPts: number;
    profitFactor: number;
    maxDrawdownPts: number;
  };
}

/**
 * Runs the full Marshall Strategy Engine bar-by-bar across the entire candle history
 * No look-ahead bias, maintains exact state machine per strategy
 */
export function runMarshallStrategyEngine(
  candles: Candle[],
  symbol = 'NSE:NIFTY',
  timeframe = '5',
  config: MarshallEngineConfig = DEFAULT_MARSHALL_CONFIG
): MarshallEngineResult {
  if (!candles || candles.length < 5) {
    return {
      symbol,
      timeframe,
      levels: null,
      activeSignals: [],
      completedTrades: [],
      currentSignal: null,
      stateMachine: {
        primaryBuyState: 'IDLE',
        primarySellState: 'IDLE',
        contBuyState: 'IDLE',
        contSellState: 'IDLE'
      },
      metrics: {
        totalTrades: 0,
        winningTrades: 0,
        losingTrades: 0,
        winRatePct: 0,
        totalProfitPts: 0,
        profitFactor: 0,
        maxDrawdownPts: 0
      }
    };
  }

  const activeSignals: MarshallSignal[] = [];
  const completedTrades: MarshallSignal[] = [];
  let currentSignal: MarshallSignal | null = null;

  let primaryBuyState: MarshallState = 'IDLE';
  let primarySellState: MarshallState = 'IDLE';
  let contBuyState: MarshallState = 'IDLE';
  let contSellState: MarshallState = 'IDLE';

  let primaryBuyRetestLow = 0;
  let primarySellRetestHigh = 0;
  let contBuySwingLow = 0;
  let contSellSwingHigh = 0;

  // Dynamic levels tracker
  let currentLevels: MarshallLevels | null = null;
  let lastSessionKey = '';

  // Volume rolling window
  const volWindow: number[] = [];

  for (let i = 0; i < candles.length; i++) {
    const bar = candles[i];
    volWindow.push(bar.volume || 1);
    if (volWindow.length > 20) volWindow.shift();
    const avgVol = volWindow.reduce((a, b) => a + b, 0) / volWindow.length;

    // Check session boundary
    const date = new Date(bar.time * 1000);
    const sessionKey = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    
    // Recalculate levels on session boundary or warmup
    if (sessionKey !== lastSessionKey) {
      lastSessionKey = sessionKey;
      const historyUpToBar = candles.slice(0, i + 1);
      currentLevels = extractMarshallLevels(historyUpToBar, timeframe);

      // Reset setup states for new session cycle (Specification Section 8)
      if (primaryBuyState !== 'ENTRY_GENERATED' && primaryBuyState !== 'TARGET_1_HIT') {
        primaryBuyState = 'IDLE';
      }
      if (primarySellState !== 'ENTRY_GENERATED' && primarySellState !== 'TARGET_1_HIT') {
        primarySellState = 'IDLE';
      }
      if (contBuyState !== 'ENTRY_GENERATED' && contBuyState !== 'TARGET_1_HIT') {
        contBuyState = 'IDLE';
      }
      if (contSellState !== 'ENTRY_GENERATED' && contSellState !== 'TARGET_1_HIT') {
        contSellState = 'IDLE';
      }
    }

    if (!currentLevels) continue;
    const { buyReversal, sellReversal, breakout, breakdown, upperTarget1, upperTarget2, lowerTarget1, lowerTarget2 } = currentLevels;

    // ========================================================================
    // A. TRADE MANAGEMENT FOR EXISTING OPEN TRADES (Specification Section 11)
    // ========================================================================
    for (let sIdx = activeSignals.length - 1; sIdx >= 0; sIdx--) {
      const trade = activeSignals[sIdx];
      let closed = false;

      if (trade.direction === 'BUY') {
        // Target 1 Hit
        if (trade.status === 'ENTRY_GENERATED' && bar.high >= trade.target1Price) {
          trade.status = 'TARGET_1_HIT';
          trade.activeQuantityPct = 100 - config.target1BookingPct;
          trade.notes.push(`Target 1 ₹${trade.target1Price.toFixed(1)} hit on ${new Date(bar.time * 1000).toLocaleTimeString('en-IN')}`);

          // Trailing Stop to Breakeven
          if (config.trailingStopEnabled) {
            trade.stopLossPrice = Math.max(trade.stopLossPrice, trade.entryPrice);
            trade.notes.push(`Stop Loss trailed to Breakeven ₹${trade.stopLossPrice.toFixed(1)}`);
          }
        }

        // Target 2 Hit
        if (bar.high >= trade.target2Price) {
          trade.status = 'TARGET_2_HIT';
          trade.exitPrice = trade.target2Price;
          trade.exitTime = bar.time;
          trade.pnlPoints = trade.target2Price - trade.entryPrice;
          trade.pnlPct = (trade.pnlPoints / trade.entryPrice) * 100;
          trade.notes.push(`Target 2 ₹${trade.target2Price.toFixed(1)} achieved`);
          closed = true;
        } 
        // Stop Loss Hit
        else if (bar.low <= trade.stopLossPrice) {
          trade.status = 'STOP_LOSS_HIT';
          trade.exitPrice = trade.stopLossPrice;
          trade.exitTime = bar.time;
          trade.pnlPoints = trade.stopLossPrice - trade.entryPrice;
          trade.pnlPct = (trade.pnlPoints / trade.entryPrice) * 100;
          trade.notes.push(`Stop Loss ₹${trade.stopLossPrice.toFixed(1)} triggered`);
          closed = true;
        }
      } else {
        // Direction === 'SELL'
        // Target 1 Hit
        if (trade.status === 'ENTRY_GENERATED' && bar.low <= trade.target1Price) {
          trade.status = 'TARGET_1_HIT';
          trade.activeQuantityPct = 100 - config.target1BookingPct;
          trade.notes.push(`Target 1 ₹${trade.target1Price.toFixed(1)} hit on ${new Date(bar.time * 1000).toLocaleTimeString('en-IN')}`);

          if (config.trailingStopEnabled) {
            trade.stopLossPrice = Math.min(trade.stopLossPrice, trade.entryPrice);
            trade.notes.push(`Stop Loss trailed to Breakeven ₹${trade.stopLossPrice.toFixed(1)}`);
          }
        }

        // Target 2 Hit
        if (bar.low <= trade.target2Price) {
          trade.status = 'TARGET_2_HIT';
          trade.exitPrice = trade.target2Price;
          trade.exitTime = bar.time;
          trade.pnlPoints = trade.entryPrice - trade.target2Price;
          trade.pnlPct = (trade.pnlPoints / trade.entryPrice) * 100;
          trade.notes.push(`Target 2 ₹${trade.target2Price.toFixed(1)} achieved`);
          closed = true;
        } 
        // Stop Loss Hit
        else if (bar.high >= trade.stopLossPrice) {
          trade.status = 'STOP_LOSS_HIT';
          trade.exitPrice = trade.stopLossPrice;
          trade.exitTime = bar.time;
          trade.pnlPoints = trade.entryPrice - trade.stopLossPrice;
          trade.pnlPct = (trade.pnlPoints / trade.entryPrice) * 100;
          trade.notes.push(`Stop Loss ₹${trade.stopLossPrice.toFixed(1)} triggered`);
          closed = true;
        }
      }

      if (closed) {
        trade.status = 'TRADE_COMPLETED';
        completedTrades.push(trade);
        activeSignals.splice(sIdx, 1);
        if (currentSignal?.id === trade.id) currentSignal = trade;
      }
    }

    // Prevent simultaneous opposing trades if active trade exists
    const hasActiveLong = activeSignals.some(s => s.direction === 'BUY');
    const hasActiveShort = activeSignals.some(s => s.direction === 'SELL');

    // ========================================================================
    // B. STRATEGY 1: PRIMARY BUY (Specification Section 3)
    // Setup: Support at Buy Reversal (s3) -> Breakout above R4 (r4)
    // ========================================================================
    if (config.enablePrimaryBuy && !hasActiveLong) {
      if (primaryBuyState === 'IDLE' || primaryBuyState === 'WAITING_FOR_SUPPORT') {
        // Step 1 & 2: Price approaches & holds Buy Reversal
        const nearBR = bar.low <= buyReversal * 1.004 && bar.close >= buyReversal * 0.996;
        if (nearBR) {
          primaryBuyState = 'WAITING_FOR_BREAKOUT';
          primaryBuyRetestLow = bar.low;
        }
      } else if (primaryBuyState === 'WAITING_FOR_BREAKOUT') {
        // Step 3: Must hold above Buy Reversal (invalidate if breaks BR)
        if (bar.close < buyReversal * 0.995) {
          primaryBuyState = 'SETUP_INVALIDATED';
        } else if (bar.close > breakout) {
          // Step 4 & 5: Breakout confirmed
          const conf = evaluateConfirmation(bar, breakout, 'BUY', currentLevels, config, avgVol);
          if (conf.overallConfirmed) {
            const entry = bar.close;
            const sl = buyReversal;
            // Target ordering rule: nearest upper target above entry
            const upperTargets = [upperTarget1, upperTarget2].filter(p => p > entry).sort((a, b) => a - b);
            const t1 = upperTargets[0] || entry + (entry - sl) * 1.5;
            const t2 = upperTargets[1] || t1 + (t1 - entry) * 0.8;

            const risk = entry - sl;
            const rew1 = t1 - entry;
            const rr = risk > 0 ? Math.round((rew1 / risk) * 100) / 100 : 1.5;

            if (risk > 0 && rr >= 1.0) {
              const sig: MarshallSignal = {
                id: `MB_${bar.time}_${Math.random().toString(36).substring(2, 6)}`,
                symbol,
                timeframe,
                timestamp: bar.time,
                timeStr: new Date(bar.time * 1000).toLocaleTimeString('en-IN', { hour12: false }),
                strategy: 'PRIMARY_BUY',
                direction: 'BUY',
                label: 'MARSHALL BUY',
                entryPrice: entry,
                stopLossPrice: sl,
                target1Price: t1,
                target2Price: t2,
                riskPoints: Math.round(risk * 100) / 100,
                rewardPointsT1: Math.round(rew1 * 100) / 100,
                rewardPointsT2: Math.round((t2 - entry) * 100) / 100,
                riskRewardRatio: rr,
                confirmation: conf,
                status: 'ENTRY_GENERATED',
                activeQuantityPct: 100,
                notes: [
                  `Buy Reversal support verified at ₹${buyReversal.toFixed(1)}`,
                  `Breakout confirmed above ₹${breakout.toFixed(1)} (Close: ₹${entry.toFixed(1)})`
                ]
              };
              activeSignals.push(sig);
              currentSignal = sig;
              primaryBuyState = 'ENTRY_GENERATED';
            }
          }
        }
      }
    }

    // ========================================================================
    // C. STRATEGY 2: PRIMARY SELL (Specification Section 4)
    // Setup: Rejection at Sell Reversal (r3) -> Breakdown below S4 (s4)
    // ========================================================================
    if (config.enablePrimarySell && !hasActiveShort) {
      if (primarySellState === 'IDLE' || primarySellState === 'WAITING_FOR_RESISTANCE') {
        // Step 1 & 2: Price approaches & rejects Sell Reversal
        const nearSR = bar.high >= sellReversal * 0.996 && bar.close <= sellReversal * 1.004;
        if (nearSR) {
          primarySellState = 'WAITING_FOR_BREAKDOWN';
          primarySellRetestHigh = bar.high;
        }
      } else if (primarySellState === 'WAITING_FOR_BREAKDOWN') {
        // Step 3: Must hold below Sell Reversal
        if (bar.close > sellReversal * 1.005) {
          primarySellState = 'SETUP_INVALIDATED';
        } else if (bar.close < breakdown) {
          // Step 4 & 5: Breakdown confirmed
          const conf = evaluateConfirmation(bar, breakdown, 'SELL', currentLevels, config, avgVol);
          if (conf.overallConfirmed) {
            const entry = bar.close;
            const sl = sellReversal;
            // Target ordering rule: nearest lower target below entry
            const lowerTargets = [lowerTarget1, lowerTarget2].filter(p => p < entry).sort((a, b) => b - a);
            const t1 = lowerTargets[0] || entry - (sl - entry) * 1.5;
            const t2 = lowerTargets[1] || t1 - (entry - t1) * 0.8;

            const risk = sl - entry;
            const rew1 = entry - t1;
            const rr = risk > 0 ? Math.round((rew1 / risk) * 100) / 100 : 1.5;

            if (risk > 0 && rr >= 1.0) {
              const sig: MarshallSignal = {
                id: `MS_${bar.time}_${Math.random().toString(36).substring(2, 6)}`,
                symbol,
                timeframe,
                timestamp: bar.time,
                timeStr: new Date(bar.time * 1000).toLocaleTimeString('en-IN', { hour12: false }),
                strategy: 'PRIMARY_SELL',
                direction: 'SELL',
                label: 'MARSHALL SELL',
                entryPrice: entry,
                stopLossPrice: sl,
                target1Price: t1,
                target2Price: t2,
                riskPoints: Math.round(risk * 100) / 100,
                rewardPointsT1: Math.round(rew1 * 100) / 100,
                rewardPointsT2: Math.round((entry - t2) * 100) / 100,
                riskRewardRatio: rr,
                confirmation: conf,
                status: 'ENTRY_GENERATED',
                activeQuantityPct: 100,
                notes: [
                  `Sell Reversal rejection verified at ₹${sellReversal.toFixed(1)}`,
                  `Breakdown confirmed below ₹${breakdown.toFixed(1)} (Close: ₹${entry.toFixed(1)})`
                ]
              };
              activeSignals.push(sig);
              currentSignal = sig;
              primarySellState = 'ENTRY_GENERATED';
            }
          }
        }
      }
    }

    // ========================================================================
    // D. STRATEGY 3: CONTINUATION BUY (Upper Target 1 Retest, Section 5)
    // Setup: Break above UT1 (r5) -> Pullback -> Retest holds -> Bullish Close
    // ========================================================================
    if (config.enableContinuationBuy && !hasActiveLong) {
      if (contBuyState === 'IDLE') {
        if (bar.close > upperTarget1 && bar.high > upperTarget1 * 1.002) {
          contBuyState = 'WAITING_FOR_RETEST';
          contBuySwingLow = bar.low;
        }
      } else if (contBuyState === 'WAITING_FOR_RETEST') {
        // Step 3 & 4: Pullback to UT1
        const touchedUT1 = bar.low <= upperTarget1 * (1 + config.retestBufferPct / 100) && bar.close >= upperTarget1 * 0.996;
        if (touchedUT1) {
          contBuySwingLow = Math.min(contBuySwingLow, bar.low);
          // Step 5: Bullish rejection candle closing back above Upper Target 1
          if (bar.close > upperTarget1) {
            const conf = evaluateConfirmation(bar, upperTarget1, 'BUY', currentLevels, config, avgVol);
            if (conf.overallConfirmed) {
              const entry = bar.close;
              const buffer = (entry - contBuySwingLow) * 0.1 || entry * 0.002;
              const sl = Math.min(entry - 2, contBuySwingLow - buffer);
              const t1 = upperTarget2 > entry ? upperTarget2 : entry + (entry - sl) * 1.5;
              const t2 = t1 + (t1 - entry) * 0.8;

              const risk = entry - sl;
              const rew1 = t1 - entry;
              const rr = risk > 0 ? Math.round((rew1 / risk) * 100) / 100 : 1.5;

              if (risk > 0 && rr >= 1.0) {
                const sig: MarshallSignal = {
                  id: `CB_${bar.time}_${Math.random().toString(36).substring(2, 6)}`,
                  symbol,
                  timeframe,
                  timestamp: bar.time,
                  timeStr: new Date(bar.time * 1000).toLocaleTimeString('en-IN', { hour12: false }),
                  strategy: 'CONTINUATION_BUY',
                  direction: 'BUY',
                  label: 'CONTINUATION BUY',
                  entryPrice: entry,
                  stopLossPrice: sl,
                  target1Price: t1,
                  target2Price: t2,
                  riskPoints: Math.round(risk * 100) / 100,
                  rewardPointsT1: Math.round(rew1 * 100) / 100,
                  rewardPointsT2: Math.round((t2 - entry) * 100) / 100,
                  riskRewardRatio: rr,
                  confirmation: conf,
                  status: 'ENTRY_GENERATED',
                  activeQuantityPct: 100,
                  notes: [
                    `Upper Target 1 breakout verified at ₹${upperTarget1.toFixed(1)}`,
                    `Support retest held at ₹${contBuySwingLow.toFixed(1)} with bullish close`
                  ]
                };
                activeSignals.push(sig);
                currentSignal = sig;
                contBuyState = 'ENTRY_GENERATED';
              }
            }
          }
        } else if (bar.close < upperTarget1 * 0.992) {
          contBuyState = 'SETUP_INVALIDATED';
        }
      }
    }

    // ========================================================================
    // E. STRATEGY 4: CONTINUATION SELL (Lower Target 1 Retest, Section 6)
    // Setup: Break below LT1 (s5) -> Pullback -> Retest holds -> Bearish Close
    // ========================================================================
    if (config.enableContinuationSell && !hasActiveShort) {
      if (contSellState === 'IDLE') {
        if (bar.close < lowerTarget1 && bar.low < lowerTarget1 * 0.998) {
          contSellState = 'WAITING_FOR_RETEST';
          contSellSwingHigh = bar.high;
        }
      } else if (contSellState === 'WAITING_FOR_RETEST') {
        // Step 3 & 4: Pullback to LT1
        const touchedLT1 = bar.high >= lowerTarget1 * (1 - config.retestBufferPct / 100) && bar.close <= lowerTarget1 * 1.004;
        if (touchedLT1) {
          contSellSwingHigh = Math.max(contSellSwingHigh, bar.high);
          // Step 5: Bearish rejection candle closing back below Lower Target 1
          if (bar.close < lowerTarget1) {
            const conf = evaluateConfirmation(bar, lowerTarget1, 'SELL', currentLevels, config, avgVol);
            if (conf.overallConfirmed) {
              const entry = bar.close;
              const buffer = (contSellSwingHigh - entry) * 0.1 || entry * 0.002;
              const sl = Math.max(entry + 2, contSellSwingHigh + buffer);
              const t1 = lowerTarget2 < entry ? lowerTarget2 : entry - (sl - entry) * 1.5;
              const t2 = t1 - (entry - t1) * 0.8;

              const risk = sl - entry;
              const rew1 = entry - t1;
              const rr = risk > 0 ? Math.round((rew1 / risk) * 100) / 100 : 1.5;

              if (risk > 0 && rr >= 1.0) {
                const sig: MarshallSignal = {
                  id: `CS_${bar.time}_${Math.random().toString(36).substring(2, 6)}`,
                  symbol,
                  timeframe,
                  timestamp: bar.time,
                  timeStr: new Date(bar.time * 1000).toLocaleTimeString('en-IN', { hour12: false }),
                  strategy: 'CONTINUATION_SELL',
                  direction: 'SELL',
                  label: 'CONTINUATION SELL',
                  entryPrice: entry,
                  stopLossPrice: sl,
                  target1Price: t1,
                  target2Price: t2,
                  riskPoints: Math.round(risk * 100) / 100,
                  rewardPointsT1: Math.round(rew1 * 100) / 100,
                  rewardPointsT2: Math.round((entry - t2) * 100) / 100,
                  riskRewardRatio: rr,
                  confirmation: conf,
                  status: 'ENTRY_GENERATED',
                  activeQuantityPct: 100,
                  notes: [
                    `Lower Target 1 breakdown verified at ₹${lowerTarget1.toFixed(1)}`,
                    `Resistance retest held at ₹${contSellSwingHigh.toFixed(1)} with bearish close`
                  ]
                };
                activeSignals.push(sig);
                currentSignal = sig;
                contSellState = 'ENTRY_GENERATED';
              }
            }
          }
        } else if (bar.close > lowerTarget1 * 1.008) {
          contSellState = 'SETUP_INVALIDATED';
        }
      }
    }
  }

  // ========================================================================
  // PERFORMANCE METRICS CALCULATION (Specification Section 13)
  // ========================================================================
  const allClosed = completedTrades;
  const totalTrades = allClosed.length;
  const wins = allClosed.filter(t => (t.pnlPoints || 0) > 0);
  const losses = allClosed.filter(t => (t.pnlPoints || 0) <= 0);
  const winningTrades = wins.length;
  const losingTrades = losses.length;
  const winRatePct = totalTrades > 0 ? Math.round((winningTrades / totalTrades) * 1000) / 10 : 0;

  const totalWinPts = wins.reduce((sum, t) => sum + (t.pnlPoints || 0), 0);
  const totalLossPts = Math.abs(losses.reduce((sum, t) => sum + (t.pnlPoints || 0), 0));
  const totalProfitPts = Math.round((totalWinPts - totalLossPts) * 10) / 10;
  const profitFactor = totalLossPts > 0 ? Math.round((totalWinPts / totalLossPts) * 100) / 100 : (totalWinPts > 0 ? 99 : 0);

  // Peak to trough max drawdown
  let peak = 0;
  let running = 0;
  let maxDD = 0;
  allClosed.forEach(t => {
    running += (t.pnlPoints || 0);
    if (running > peak) peak = running;
    const dd = peak - running;
    if (dd > maxDD) maxDD = dd;
  });

  return {
    symbol,
    timeframe,
    levels: currentLevels,
    activeSignals,
    completedTrades,
    currentSignal: currentSignal || (activeSignals.length > 0 ? activeSignals[activeSignals.length - 1] : null),
    stateMachine: {
      primaryBuyState,
      primarySellState,
      contBuyState,
      contSellState
    },
    metrics: {
      totalTrades,
      winningTrades,
      losingTrades,
      winRatePct,
      totalProfitPts,
      profitFactor,
      maxDrawdownPts: Math.round(maxDD * 10) / 10
    }
  };
}
