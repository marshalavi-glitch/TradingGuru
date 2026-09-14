import { Candle } from './profileCalculator';

export type WyckoffPhase = 
  | 'ACCUMULATION' 
  | 'MARKUP' 
  | 'DISTRIBUTION' 
  | 'MARKDOWN' 
  | 'RE-ACCUMULATION' 
  | 'RE-DISTRIBUTION';

export type VsaSignalType = 'BULLISH' | 'BEARISH' | 'NEUTRAL';

export interface VsaSignal {
  id: string;
  name: string;
  type: VsaSignalType;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number; // 1 - 100
  wyckoffPhase: WyckoffPhase;
  description: string;
  tradeAction: string;
  targetPrice: number;
  stopLoss: number;
  candleIndex: number;
  time: number;
}

export interface VsaCandleAnalysis {
  time: number;
  candleIndex: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  spread: number;
  spreadType: 'ULTRA_WIDE' | 'WIDE' | 'AVERAGE' | 'NARROW';
  volumeRatio: number; // relative to 20 SMA
  volumeType: 'ULTRA_HIGH' | 'HIGH' | 'AVERAGE' | 'LOW' | 'ULTRA_LOW';
  closePositionPct: number; // 0% at low, 100% at high
  closeLocation: 'TOP_25' | 'UPPER_MID' | 'LOWER_MID' | 'BOTTOM_25';
  candleType: 'BULLISH' | 'BEARISH' | 'DOJI';
  precedingTrend: 'UPTREND' | 'DOWNTREND' | 'SIDEWAYS';
  signals: VsaSignal[];
}

export interface VsaSummary {
  totalSignals: number;
  bullishCount: number;
  bearishCount: number;
  neutralCount: number;
  noSupplyDemandCount: number;
  climaxCount: number;
  topSignal?: VsaSignal;
  marketBias: 'STRONGLY BULLISH' | 'BULLISH' | 'NEUTRAL' | 'BEARISH' | 'STRONGLY BEARISH';
}

/**
 * Calculates VSA metrics and identifies all 10 VSA patterns across candle history.
 */
export function calculateVsaAnalysis(candles: Candle[]): {
  analyzedCandles: VsaCandleAnalysis[];
  latestSignals: VsaSignal[];
  summary: VsaSummary;
} {
  if (!candles || candles.length === 0) {
    return {
      analyzedCandles: [],
      latestSignals: [],
      summary: {
        totalSignals: 0,
        bullishCount: 0,
        bearishCount: 0,
        neutralCount: 0,
        noSupplyDemandCount: 0,
        climaxCount: 0,
        marketBias: 'NEUTRAL'
      }
    };
  }

  const period = 20;
  const analyzedCandles: VsaCandleAnalysis[] = [];
  const allSignals: VsaSignal[] = [];

  // Helper arrays for SMAs
  const volumes = candles.map((c) => c.volume || 0);
  const spreads = candles.map((c) => Math.max(0.01, c.high - c.low));

  for (let i = 0; i < candles.length; i++) {
    const c = candles[i];
    const spread = spreads[i];

    // Calculate 20-period SMAs for Volume and Spread up to current index
    const startIdx = Math.max(0, i - period + 1);
    const windowVol = volumes.slice(startIdx, i + 1);
    const windowSpread = spreads.slice(startIdx, i + 1);

    const smaVol = windowVol.reduce((acc, v) => acc + v, 0) / windowVol.length || 1;
    const smaSpread = windowSpread.reduce((acc, s) => acc + s, 0) / windowSpread.length || 1;

    const volumeRatio = c.volume / smaVol;
    const spreadRatio = spread / smaSpread;

    // Volume classification
    let volumeType: VsaCandleAnalysis['volumeType'] = 'AVERAGE';
    if (volumeRatio >= 2.2) volumeType = 'ULTRA_HIGH';
    else if (volumeRatio >= 1.4) volumeType = 'HIGH';
    else if (volumeRatio >= 0.75) volumeType = 'AVERAGE';
    else if (volumeRatio >= 0.4) volumeType = 'LOW';
    else volumeType = 'ULTRA_LOW';

    // Spread classification
    let spreadType: VsaCandleAnalysis['spreadType'] = 'AVERAGE';
    if (spreadRatio >= 1.8) spreadType = 'ULTRA_WIDE';
    else if (spreadRatio >= 1.3) spreadType = 'WIDE';
    else if (spreadRatio >= 0.7) spreadType = 'AVERAGE';
    else spreadType = 'NARROW';

    // Close position %
    const closePosPct = Math.round(((c.close - c.low) / (spread || 1)) * 100);
    let closeLocation: VsaCandleAnalysis['closeLocation'] = 'UPPER_MID';
    if (closePosPct >= 75) closeLocation = 'TOP_25';
    else if (closePosPct >= 50) closeLocation = 'UPPER_MID';
    else if (closePosPct >= 25) closeLocation = 'LOWER_MID';
    else closeLocation = 'BOTTOM_25';

    // Candle type
    const candleType: VsaCandleAnalysis['candleType'] = 
      c.close > c.open ? 'BULLISH' : c.close < c.open ? 'BEARISH' : 'DOJI';

    // Preceding Trend (10 candles lookback)
    let precedingTrend: VsaCandleAnalysis['precedingTrend'] = 'SIDEWAYS';
    if (i >= 5) {
      const prevClose = candles[Math.max(0, i - 10)].close;
      const pctChange = ((c.close - prevClose) / prevClose) * 100;
      if (pctChange > 0.35) precedingTrend = 'UPTREND';
      else if (pctChange < -0.35) precedingTrend = 'DOWNTREND';
    }

    const signals: VsaSignal[] = [];

    // Need at least 5 candles for reliable VSA background assessment
    if (i >= 5) {
      const prevC1 = candles[i - 1];
      const prevC2 = candles[i - 2];

      const past10High = Math.max(...candles.slice(Math.max(0, i - 10), i).map(k => k.high));
      const past10Low = Math.min(...candles.slice(Math.max(0, i - 10), i).map(k => k.low));

      // 1. NO SUPPLY (Bullish)
      // Narrow/Average spread, down or narrow bar, volume lower than past 2 bars & below average volume
      if (
        (spreadType === 'NARROW' || spreadType === 'AVERAGE') &&
        c.volume < prevC1.volume &&
        c.volume < prevC2.volume &&
        (volumeType === 'LOW' || volumeType === 'ULTRA_LOW') &&
        c.close <= c.open + (c.high - c.low) * 0.2
      ) {
        signals.push({
          id: `no-supply-${i}`,
          name: 'No Supply',
          type: 'BULLISH',
          severity: 'HIGH',
          confidence: precedingTrend === 'UPTREND' ? 92 : 82,
          wyckoffPhase: precedingTrend === 'UPTREND' ? 'RE-ACCUMULATION' : 'ACCUMULATION',
          description: 'Lack of selling pressure detected on test bar with low volume and narrow spread.',
          tradeAction: 'BUY CE on breakout of current bar high. Stop Loss below bar low.',
          targetPrice: +(c.close + spread * 2.5).toFixed(2),
          stopLoss: +(c.low - spread * 0.3).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 2. NO DEMAND (Bearish)
      // Narrow/Average spread, up or narrow bar, volume lower than past 2 bars & below average volume
      if (
        (spreadType === 'NARROW' || spreadType === 'AVERAGE') &&
        c.volume < prevC1.volume &&
        c.volume < prevC2.volume &&
        (volumeType === 'LOW' || volumeType === 'ULTRA_LOW') &&
        c.close >= c.open - (c.high - c.low) * 0.2
      ) {
        signals.push({
          id: `no-demand-${i}`,
          name: 'No Demand',
          type: 'BEARISH',
          severity: 'HIGH',
          confidence: precedingTrend === 'DOWNTREND' ? 90 : 80,
          wyckoffPhase: precedingTrend === 'DOWNTREND' ? 'RE-DISTRIBUTION' : 'DISTRIBUTION',
          description: 'Lack of buying interest on up move. Smart money withholding support.',
          tradeAction: 'BUY PE on breakdown of current bar low. Stop Loss above bar high.',
          targetPrice: +(c.close - spread * 2.5).toFixed(2),
          stopLoss: +(c.high + spread * 0.3).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 3. STOPPING VOLUME (Bullish Reversal)
      // Down candle with High/Ultra-High volume, wide spread, but close off the low (top 45%)
      if (
        candleType === 'BEARISH' &&
        (volumeType === 'HIGH' || volumeType === 'ULTRA_HIGH') &&
        closePosPct >= 40 &&
        precedingTrend === 'DOWNTREND'
      ) {
        signals.push({
          id: `stopping-vol-${i}`,
          name: 'Stopping Volume',
          type: 'BULLISH',
          severity: 'HIGH',
          confidence: 88,
          wyckoffPhase: 'ACCUMULATION',
          description: 'Professional buyers absorbing heavy panic selling, stopping downward momentum.',
          tradeAction: 'Bullish Reversal Alert! Look to BUY CE / Long Futures on confirm candle.',
          targetPrice: +(c.close + spread * 3.0).toFixed(2),
          stopLoss: +(c.low - spread * 0.2).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 4. ABSORPTION VOLUME (Bullish Breakout)
      // Up candle, High/Ultra-High volume, close near top (>= 70%) near 10-bar high
      if (
        candleType === 'BULLISH' &&
        (volumeType === 'HIGH' || volumeType === 'ULTRA_HIGH') &&
        closePosPct >= 70 &&
        c.high >= past10High * 0.998
      ) {
        signals.push({
          id: `absorption-vol-${i}`,
          name: 'Absorption Volume',
          type: 'BULLISH',
          severity: 'HIGH',
          confidence: 89,
          wyckoffPhase: 'MARKUP',
          description: 'Smart money absorbing overhead supply at resistance prior to major breakout.',
          tradeAction: 'Strong Continuation Buy! Target next resistance zone.',
          targetPrice: +(c.close + spread * 3.5).toFixed(2),
          stopLoss: +(c.open - spread * 0.4).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 5. UPTHRUST (Bearish Reversal / Bull Trap)
      // Candle high pushes past previous 10-bar high, but closes in lower 30%
      if (
        c.high > past10High &&
        closePosPct <= 35 &&
        (spreadType === 'WIDE' || spreadType === 'ULTRA_WIDE' || volumeType === 'HIGH' || volumeType === 'ULTRA_HIGH')
      ) {
        signals.push({
          id: `upthrust-${i}`,
          name: 'Upthrust (Bull Trap)',
          type: 'BEARISH',
          severity: 'HIGH',
          confidence: 94,
          wyckoffPhase: 'DISTRIBUTION',
          description: 'Classic Wyckoff Upthrust! Price breached resistance to catch late buyers before collapsing.',
          tradeAction: 'BUY PE / Short Futures immediately. Target lower support band.',
          targetPrice: +(c.close - spread * 3.0).toFixed(2),
          stopLoss: +(c.high + spread * 0.2).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 6. SPRING / SHAKEOUT (Bullish Reversal / Bear Trap)
      // Candle low breaks past previous 10-bar low, but closes in upper 40% (closePosPct >= 55%)
      if (
        c.low < past10Low &&
        closePosPct >= 55
      ) {
        signals.push({
          id: `spring-${i}`,
          name: volumeType === 'HIGH' || volumeType === 'ULTRA_HIGH' ? 'Shakeout' : 'Spring',
          type: 'BULLISH',
          severity: 'HIGH',
          confidence: 95,
          wyckoffPhase: 'ACCUMULATION',
          description: `Wyckoff ${volumeType === 'HIGH' || volumeType === 'ULTRA_HIGH' ? 'Shakeout' : 'Spring'}! Liquidity probe below support trapped weak shorts before strong recovery.`,
          tradeAction: 'High Probability BUY CE Entry! Enter on candle close or pullback.',
          targetPrice: +(c.close + spread * 3.2).toFixed(2),
          stopLoss: +(c.low - spread * 0.2).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 7. EFFORT VS RESULT DIVERGENCE
      // Heavy volume but narrow spread (Effort without price movement)
      if (
        (volumeType === 'HIGH' || volumeType === 'ULTRA_HIGH') &&
        spreadType === 'NARROW'
      ) {
        const isBullishEffort = candleType === 'BEARISH' || closePosPct >= 50;
        signals.push({
          id: `effort-no-result-${i}`,
          name: isBullishEffort ? 'Bullish Effort vs Result' : 'Bearish Effort vs Result',
          type: isBullishEffort ? 'BULLISH' : 'BEARISH',
          severity: 'MEDIUM',
          confidence: 85,
          wyckoffPhase: isBullishEffort ? 'ACCUMULATION' : 'DISTRIBUTION',
          description: `Huge volume effort (${volumeRatio.toFixed(1)}x avg) failed to push price ${isBullishEffort ? 'lower (Institutional buying)' : 'higher (Institutional selling)'}.`,
          tradeAction: isBullishEffort ? 'Prepare BUY CE setup.' : 'Prepare BUY PE setup.',
          targetPrice: +(c.close + (isBullishEffort ? spread * 2.5 : -spread * 2.5)).toFixed(2),
          stopLoss: +(isBullishEffort ? c.low - spread * 0.3 : c.high + spread * 0.3).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 8. BUYING CLIMAX (Bearish Reversal)
      // Extended uptrend, Ultra High volume, wide spread, close off high (closePosPct <= 65%)
      if (
        precedingTrend === 'UPTREND' &&
        volumeType === 'ULTRA_HIGH' &&
        (spreadType === 'WIDE' || spreadType === 'ULTRA_WIDE') &&
        closePosPct <= 65
      ) {
        signals.push({
          id: `buying-climax-${i}`,
          name: 'Buying Climax',
          type: 'BEARISH',
          severity: 'HIGH',
          confidence: 91,
          wyckoffPhase: 'DISTRIBUTION',
          description: 'Institutional smart money offloading inventory into retail excitement. Trend top forming.',
          tradeAction: 'Take profits on long positions. Prepare for BUY PE / Short trade.',
          targetPrice: +(c.close - spread * 3.5).toFixed(2),
          stopLoss: +(c.high + spread * 0.3).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 9. SELLING CLIMAX (Bullish Reversal)
      // Extended downtrend, Ultra High volume, wide spread, close off low (closePosPct >= 35%)
      if (
        precedingTrend === 'DOWNTREND' &&
        volumeType === 'ULTRA_HIGH' &&
        (spreadType === 'WIDE' || spreadType === 'ULTRA_WIDE') &&
        closePosPct >= 35
      ) {
        signals.push({
          id: `selling-climax-${i}`,
          name: 'Selling Climax',
          type: 'BULLISH',
          severity: 'HIGH',
          confidence: 93,
          wyckoffPhase: 'ACCUMULATION',
          description: 'Massive panic dumping absorbed by institutional smart money. Major bottom forming.',
          tradeAction: 'Accumulation zone! Look for secondary test or Spring for BUY CE entry.',
          targetPrice: +(c.close + spread * 3.5).toFixed(2),
          stopLoss: +(c.low - spread * 0.3).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }

      // 10. SUPPLY TEST (Bullish Confirmation)
      // Low volume dip into support or after Spring/Climax
      if (
        (volumeType === 'LOW' || volumeType === 'ULTRA_LOW') &&
        closePosPct >= 50 &&
        c.low <= past10Low * 1.005
      ) {
        signals.push({
          id: `supply-test-${i}`,
          name: 'Supply Test',
          type: 'BULLISH',
          severity: 'MEDIUM',
          confidence: 86,
          wyckoffPhase: 'RE-ACCUMULATION',
          description: 'Low volume test into support confirms supply has dried up. Clear path for price advance.',
          tradeAction: 'Confirmed low-risk BUY CE entry point.',
          targetPrice: +(c.close + spread * 2.8).toFixed(2),
          stopLoss: +(c.low - spread * 0.2).toFixed(2),
          candleIndex: i,
          time: c.time
        });
      }
    }

    const analyzedCandle: VsaCandleAnalysis = {
      time: c.time,
      candleIndex: i,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close,
      volume: c.volume,
      spread: +spread.toFixed(2),
      spreadType,
      volumeRatio: +volumeRatio.toFixed(2),
      volumeType,
      closePositionPct: closePosPct,
      closeLocation,
      candleType,
      precedingTrend,
      signals
    };

    analyzedCandles.push(analyzedCandle);
    allSignals.push(...signals);
  }

  // Generate summary
  const bullishCount = allSignals.filter((s) => s.type === 'BULLISH').length;
  const bearishCount = allSignals.filter((s) => s.type === 'BEARISH').length;
  const neutralCount = allSignals.filter((s) => s.type === 'NEUTRAL').length;

  const noSupplyDemandCount = allSignals.filter(
    (s) => s.name === 'No Supply' || s.name === 'No Demand'
  ).length;

  const climaxCount = allSignals.filter(
    (s) => s.name === 'Buying Climax' || s.name === 'Selling Climax' || s.name === 'Upthrust (Bull Trap)' || s.name === 'Spring' || s.name === 'Shakeout'
  ).length;

  // Recent 10 signals sorted by index (most recent first)
  const recentSignals = [...allSignals].reverse().slice(0, 30);
  const topSignal = recentSignals[0];

  let marketBias: VsaSummary['marketBias'] = 'NEUTRAL';
  const biasScore = bullishCount - bearishCount;
  if (biasScore >= 5) marketBias = 'STRONGLY BULLISH';
  else if (biasScore >= 2) marketBias = 'BULLISH';
  else if (biasScore <= -5) marketBias = 'STRONGLY BEARISH';
  else if (biasScore <= -2) marketBias = 'BEARISH';

  return {
    analyzedCandles,
    latestSignals: recentSignals,
    summary: {
      totalSignals: allSignals.length,
      bullishCount,
      bearishCount,
      neutralCount,
      noSupplyDemandCount,
      climaxCount,
      topSignal,
      marketBias
    }
  };
}
