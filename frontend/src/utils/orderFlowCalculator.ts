import type { Candle, DayProfile } from './profileCalculator';

export interface VPBin {
  price: number;
  volume: number;
  buyVolume: number;
  sellVolume: number;
}

export interface VolumeProfileResult {
  vpocPrice: number;
  bins: VPBin[];
  hvnPrices: number[];
  lvnPrices: number[];
  volumeClusters: { startPrice: number; endPrice: number; totalVolume: number }[];
  vvahPrice: number; // Volume Value Area High (70%)
  vvalPrice: number; // Volume Value Area Low (70%)
  totalVolume: number;
}

export interface PocVpocAnalysis {
  pocPrice: number;
  vpocPrice: number;
  distanceAbs: number;
  distancePct: number;
  classification: 'VERY CLOSE' | 'CLOSE' | 'MODERATE' | 'WIDE';
  isConfluenceZone: boolean;
  confluenceZone?: { min: number; max: number };
  interpretation: string;
}

export interface PocImbalanceAnalysis {
  position: 'Near VAH' | 'Near VAL' | 'Centered in Value';
  valPct: number; // 0 (at VAL) to 1 (at VAH)
  interpretation: string;
}

export interface BalanceAreaAnalysis {
  isElongatedProfile: boolean;
  isBalancedArea: boolean;
  balanceHigh: number;
  balanceLow: number;
  balancePoc: number;
  durationPeriods: number;
  status: 'Balanced Area Active' | 'Elongated Profile Trend' | 'Expanding out of Balance' | 'Neutral Distribution';
  interpretation: string;
}

export interface ValueAcceptanceAnalysis {
  status: 'Acceptance Above VAH' | 'Rejection Above VAH' | 'Acceptance Below VAL' | 'Rejection Below VAL' | 'Inside Value (Accepted)' | 'Rotational In Value';
  bias: 'Bullish' | 'Bearish' | 'Neutral';
  interpretation: string;
}

export interface CvaAnalysis {
  status: 'Bullish Delta' | 'Bearish Delta' | 'Neutral Delta' | 'CVA DATA UNAVAILABLE';
  cumDelta: number;
  deltaRatio: number; // ratio of buy to total
  interpretation: string;
}

export interface VolumeDistributionAnalysis {
  majorHvn: number;
  majorLvn: number;
  volumeClusterZone: string;
  volumeAcceptanceRange: string;
  interpretation: string;
}

export interface TrendAnalysis {
  overallTrend: 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish';
  ema20: number;
  ema50: number;
  priceVsEma: string;
}

export interface OrderFlowAnalysisResult {
  symbol: string;
  timeframe: string;
  livePrice: number;
  trend: TrendAnalysis;
  balance: BalanceAreaAnalysis;
  cva: CvaAnalysis;
  valueAcceptance: ValueAcceptanceAnalysis;
  pocImbalance: PocImbalanceAnalysis;
  pocVpoc: PocVpocAnalysis;
  volumeDist: VolumeDistributionAnalysis;
  volumeProfile: VolumeProfileResult;
  confluenceScore: number; // 0 - 100
  setupBracket: 'NO TRADE' | 'WATCH' | 'DEVELOPING' | 'VALID SETUP' | 'HIGH-CONFLUENCE SETUP';
  bracketColor: string;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  whyThisBias: string[];
}

/**
 * Calculates Volume Profile from candles array
 */
export function calculateVolumeProfile(candles: Candle[], tickSize: number = 0.5): VolumeProfileResult {
  if (!candles || candles.length === 0) {
    return {
      vpocPrice: 0,
      bins: [],
      hvnPrices: [],
      lvnPrices: [],
      volumeClusters: [],
      vvahPrice: 0,
      vvalPrice: 0,
      totalVolume: 0,
    };
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  let totalVolume = 0;

  candles.forEach((c) => {
    if (c.low < minPrice) minPrice = c.low;
    if (c.high > maxPrice) maxPrice = c.high;
    totalVolume += c.volume;
  });

  // Adjust tickSize dynamically if range is large
  const range = maxPrice - minPrice;
  let effectiveTick = tickSize;
  if (range > 0) {
    const rawStep = range / 80; // ~80 price bins
    if (rawStep > effectiveTick) {
      effectiveTick = Math.ceil(rawStep / 0.5) * 0.5 || 0.5;
    }
  }

  const binMap: Map<number, VPBin> = new Map();

  candles.forEach((c) => {
    const cRange = Math.max(c.high - c.low, effectiveTick);
    const steps = Math.max(1, Math.round(cRange / effectiveTick));
    const volPerStep = c.volume / steps;

    // Approximate buy/sell volume split based on candle close location
    const bodyPct = c.high === c.low ? 0.5 : (c.close - c.low) / (c.high - c.low);
    const buyVolPerStep = volPerStep * bodyPct;
    const sellVolPerStep = volPerStep * (1 - bodyPct);

    for (let p = c.low; p <= c.high + 1e-5; p += effectiveTick) {
      const roundedP = Math.round(p / effectiveTick) * effectiveTick;
      const existing = binMap.get(roundedP) || { price: roundedP, volume: 0, buyVolume: 0, sellVolume: 0 };
      existing.volume += volPerStep;
      existing.buyVolume += buyVolPerStep;
      existing.sellVolume += sellVolPerStep;
      binMap.set(roundedP, existing);
    }
  });

  const bins = Array.from(binMap.values()).sort((a, b) => a.price - b.price);

  if (bins.length === 0) {
    return {
      vpocPrice: 0,
      bins: [],
      hvnPrices: [],
      lvnPrices: [],
      volumeClusters: [],
      vvahPrice: 0,
      vvalPrice: 0,
      totalVolume: 0,
    };
  }

  // Find VPOC (bin with max volume)
  let maxVolBin = bins[0];
  bins.forEach((b) => {
    if (b.volume > maxVolBin.volume) {
      maxVolBin = b;
    }
  });
  const vpocPrice = maxVolBin.price;

  // Calculate Volume Value Area (70% of total volume)
  const targetVol = totalVolume * 0.7;
  let accumVol = maxVolBin.volume;
  let pocIdx = bins.findIndex((b) => b.price === vpocPrice);
  let upperIdx = pocIdx;
  let lowerIdx = pocIdx;

  while (accumVol < targetVol && (upperIdx < bins.length - 1 || lowerIdx > 0)) {
    const upperVol = upperIdx < bins.length - 1 ? bins[upperIdx + 1].volume : 0;
    const lowerVol = lowerIdx > 0 ? bins[lowerIdx - 1].volume : 0;

    if (upperVol >= lowerVol && upperIdx < bins.length - 1) {
      upperIdx++;
      accumVol += bins[upperIdx].volume;
    } else if (lowerIdx > 0) {
      lowerIdx--;
      accumVol += bins[lowerIdx].volume;
    } else if (upperIdx < bins.length - 1) {
      upperIdx++;
      accumVol += bins[upperIdx].volume;
    } else {
      break;
    }
  }

  const vvahPrice = bins[upperIdx] ? bins[upperIdx].price : maxPrice;
  const vvalPrice = bins[lowerIdx] ? bins[lowerIdx].price : minPrice;

  // Detect HVNs and LVNs
  const hvnPrices: number[] = [];
  const lvnPrices: number[] = [];
  const avgVol = totalVolume / (bins.length || 1);

  for (let i = 2; i < bins.length - 2; i++) {
    const b = bins[i];
    const prev1 = bins[i - 1].volume;
    const prev2 = bins[i - 2].volume;
    const next1 = bins[i + 1].volume;
    const next2 = bins[i + 2].volume;

    // HVN: local peak higher than 1.3x average volume
    if (b.volume > prev1 && b.volume > prev2 && b.volume > next1 && b.volume > next2 && b.volume > avgVol * 1.3) {
      hvnPrices.push(b.price);
    }
    // LVN: local trough lower than 0.6x average volume
    if (b.volume < prev1 && b.volume < prev2 && b.volume < next1 && b.volume < next2 && b.volume < avgVol * 0.6) {
      lvnPrices.push(b.price);
    }
  }

  // Detect Volume Clusters (contiguous bins with volume above average)
  const volumeClusters: { startPrice: number; endPrice: number; totalVolume: number }[] = [];
  let currentCluster: { startPrice: number; endPrice: number; totalVolume: number } | null = null;

  bins.forEach((b) => {
    if (b.volume > avgVol * 1.1) {
      if (!currentCluster) {
        currentCluster = { startPrice: b.price, endPrice: b.price, totalVolume: b.volume };
      } else {
        currentCluster.endPrice = b.price;
        currentCluster.totalVolume += b.volume;
      }
    } else {
      if (currentCluster) {
        volumeClusters.push(currentCluster);
        currentCluster = null;
      }
    }
  });
  if (currentCluster) volumeClusters.push(currentCluster);

  return {
    vpocPrice,
    bins,
    hvnPrices: hvnPrices.slice(0, 5), // top 5
    lvnPrices: lvnPrices.slice(0, 5),
    volumeClusters,
    vvahPrice,
    vvalPrice,
    totalVolume,
  };
}

/**
 * Main Order Flow & Market Profile Analysis Function following the 7-step checklist sequence
 */
export function performOrderFlowAnalysis(
  candles: Candle[],
  profile: DayProfile | null,
  symbol: string = 'NIFTY',
  timeframe: string = '5m'
): OrderFlowAnalysisResult {
  const livePrice = candles && candles.length > 0 ? candles[candles.length - 1].close : 0;

  // Compute Volume Profile
  const vp = calculateVolumeProfile(candles, profile?.tickSize || 0.5);

  const pocPrice = profile?.pocPrice || vp.vpocPrice || livePrice;
  const vahPrice = profile?.vahPrice || vp.vvahPrice || livePrice * 1.01;
  const valPrice = profile?.valPrice || vp.vvalPrice || livePrice * 0.99;
  const vpocPrice = vp.vpocPrice || pocPrice;

  // -------------------------------------------------------------
  // STEP 1: SEE THE TREND
  // -------------------------------------------------------------
  let ema20 = livePrice;
  let ema50 = livePrice;
  if (candles && candles.length >= 20) {
    const k20 = 2 / (20 + 1);
    const k50 = 2 / (50 + 1);
    let e20 = candles[0].close;
    let e50 = candles[0].close;
    candles.forEach((c) => {
      e20 = c.close * k20 + e20 * (1 - k20);
      e50 = c.close * k50 + e50 * (1 - k50);
    });
    ema20 = e20;
    ema50 = e50;
  }

  let overallTrend: 'Strong Bullish' | 'Bullish' | 'Neutral' | 'Bearish' | 'Strong Bearish' = 'Neutral';
  if (livePrice > ema20 && ema20 > ema50) {
    overallTrend = livePrice > ema20 * 1.01 ? 'Strong Bullish' : 'Bullish';
  } else if (livePrice < ema20 && ema20 < ema50) {
    overallTrend = livePrice < ema20 * 0.99 ? 'Strong Bearish' : 'Bearish';
  }

  const trend: TrendAnalysis = {
    overallTrend,
    ema20: Math.round(ema20 * 100) / 100,
    ema50: Math.round(ema50 * 100) / 100,
    priceVsEma: livePrice >= ema20 ? `Above 20 EMA (₹${ema20.toFixed(2)})` : `Below 20 EMA (₹${ema20.toFixed(2)})`,
  };

  // -------------------------------------------------------------
  // STEP 2: LOOK FOR BALANCED AREA AFTER AN ELONGATED PROFILE
  // -------------------------------------------------------------
  const range = profile ? profile.dayHigh - profile.dayLow : livePrice * 0.02;
  const bodyRange = profile ? Math.abs(profile.closePrice - profile.openPrice) : 0;

  // Elongated profile check: directional movement > 65% of total day range
  const isElongatedProfile = bodyRange > range * 0.65 || range > livePrice * 0.025;

  // Balance area check: price consolidating inside prior value range
  const isBalancedArea = livePrice >= valPrice && livePrice <= vahPrice && !isElongatedProfile;

  let balanceStatus: BalanceAreaAnalysis['status'] = 'Neutral Distribution';
  let balanceInterp = 'Market is rotating smoothly without extreme expansion.';

  if (isElongatedProfile) {
    balanceStatus = 'Elongated Profile Trend';
    balanceInterp = 'Strong directional initiative move created an elongated profile. Watch for balance build-up at extremes.';
  } else if (isBalancedArea) {
    balanceStatus = 'Balanced Area Active';
    balanceInterp = 'Price accepted in a balanced bracket zone. Favorable for rotational & mean-reversion trades.';
  } else if (livePrice > vahPrice || livePrice < valPrice) {
    balanceStatus = 'Expanding out of Balance';
    balanceInterp = `Price broke outside ${livePrice > vahPrice ? 'VAH' : 'VAL'}. Potential breakout or imbalance auction in progress.`;
  }

  const balance: BalanceAreaAnalysis = {
    isElongatedProfile,
    isBalancedArea,
    balanceHigh: Math.round(vahPrice * 100) / 100,
    balanceLow: Math.round(valPrice * 100) / 100,
    balancePoc: Math.round(pocPrice * 100) / 100,
    durationPeriods: profile?.totalTPOs || candles.length || 0,
    status: balanceStatus,
    interpretation: balanceInterp,
  };

  // -------------------------------------------------------------
  // STEP 3: CHECK FOR CVA (Cumulative Delta Analysis)
  // -------------------------------------------------------------
  let cumDelta = 0;
  let totalVol = 0;
  let buyVol = 0;

  candles.forEach((c) => {
    totalVol += c.volume;
    const bodyPct = c.high === c.low ? 0.5 : (c.close - c.low) / (c.high - c.low);
    const buy = c.volume * bodyPct;
    const sell = c.volume * (1 - bodyPct);
    buyVol += buy;
    cumDelta += buy - sell;
  });

  let cvaStatus: CvaAnalysis['status'] = 'CVA DATA UNAVAILABLE';
  let cvaInterp = 'Cumulative Delta data unavailable from exchange feed.';
  const deltaRatio = totalVol > 0 ? buyVol / totalVol : 0.5;

  if (totalVol > 0) {
    if (deltaRatio >= 0.56) {
      cvaStatus = 'Bullish Delta';
      cvaInterp = `Aggressive buyers dominating order flow (Cumulative Delta: +${Math.round(cumDelta).toLocaleString()}).`;
    } else if (deltaRatio <= 0.44) {
      cvaStatus = 'Bearish Delta';
      cvaInterp = `Aggressive sellers dominating order flow (Cumulative Delta: ${Math.round(cumDelta).toLocaleString()}).`;
    } else {
      cvaStatus = 'Neutral Delta';
      cvaInterp = `Buy/Sell order flow delta is balanced (Ratio: ${(deltaRatio * 100).toFixed(1)}%).`;
    }
  }

  const cva: CvaAnalysis = {
    status: cvaStatus,
    cumDelta: Math.round(cumDelta),
    deltaRatio: Math.round(deltaRatio * 1000) / 1000,
    interpretation: cvaInterp,
  };

  // -------------------------------------------------------------
  // STEP 4: LOOK FOR VALUE ACCEPTANCE / REJECTION
  // -------------------------------------------------------------
  let valueStatus: ValueAcceptanceAnalysis['status'] = 'Inside Value (Accepted)';
  let valueBias: ValueAcceptanceAnalysis['bias'] = 'Neutral';
  let valueInterp = 'Price accepted within current Value Area (VAH to VAL range).';

  if (livePrice > vahPrice) {
    const distFromVah = (livePrice - vahPrice) / vahPrice;
    if (distFromVah > 0.003) {
      valueStatus = 'Acceptance Above VAH';
      valueBias = 'Bullish';
      valueInterp = `Price accepted above VAH (₹${vahPrice.toFixed(2)}). Initiative buyers driving higher valuation.`;
    } else {
      valueStatus = 'Rejection Above VAH';
      valueBias = 'Bearish';
      valueInterp = `Price testing above VAH (₹${vahPrice.toFixed(2)}) with low acceptance. Watch for seller rejection.`;
    }
  } else if (livePrice < valPrice) {
    const distFromVal = (valPrice - livePrice) / valPrice;
    if (distFromVal > 0.003) {
      valueStatus = 'Acceptance Below VAL';
      valueBias = 'Bearish';
      valueInterp = `Price accepted below VAL (₹${valPrice.toFixed(2)}). Initiative sellers driving lower valuation.`;
    } else {
      valueStatus = 'Rejection Below VAL';
      valueBias = 'Bullish';
      valueInterp = `Price testing below VAL (₹${valPrice.toFixed(2)}) with low acceptance. Watch for buyer rejection.`;
    }
  }

  const valueAcceptance: ValueAcceptanceAnalysis = {
    status: valueStatus,
    bias: valueBias,
    interpretation: valueInterp,
  };

  // -------------------------------------------------------------
  // STEP 5: LOOK FOR POC IMBALANCE
  // -------------------------------------------------------------
  const vaSpan = Math.max(0.01, vahPrice - valPrice);
  const valPct = (pocPrice - valPrice) / vaSpan;

  let pocPos: PocImbalanceAnalysis['position'] = 'Centered in Value';
  let pocImbalInterp = 'POC is well-balanced inside value area. Fair price accepted by both buyers and sellers.';

  if (valPct >= 0.72) {
    pocPos = 'Near VAH';
    pocImbalInterp = `POC positioned near VAH (₹${vahPrice.toFixed(2)}). Buyers migrated volume higher, indicating bullish sentiment.`;
  } else if (valPct <= 0.28) {
    pocPos = 'Near VAL';
    pocImbalInterp = `POC positioned near VAL (₹${valPrice.toFixed(2)}). Sellers migrated volume lower, indicating bearish sentiment.`;
  }

  const pocImbalance: PocImbalanceAnalysis = {
    position: pocPos,
    valPct: Math.round(valPct * 100) / 100,
    interpretation: pocImbalInterp,
  };

  // -------------------------------------------------------------
  // STEP 6: LOOK FOR POC & VPOC CONFLUENCE
  // -------------------------------------------------------------
  const distanceAbs = Math.abs(pocPrice - vpocPrice);
  const distancePct = pocPrice > 0 ? (distanceAbs / pocPrice) * 100 : 0;

  let pocVpocClass: PocVpocAnalysis['classification'] = 'WIDE';
  let isConfluenceZone = false;
  let pocVpocInterp = 'POC and VPOC are separated, reflecting distinct time vs volume fair prices.';

  if (distancePct <= 0.3) {
    pocVpocClass = 'VERY CLOSE';
    isConfluenceZone = true;
    pocVpocInterp = `TPO POC (₹${pocPrice.toFixed(2)}) and Volume VPOC (₹${vpocPrice.toFixed(2)}) are aligned very closely (${distancePct.toFixed(2)}% apart). Treat as a HIGHLY POTENT Support/Resistance zone!`;
  } else if (distancePct <= 0.6) {
    pocVpocClass = 'CLOSE';
    pocVpocInterp = `POC and VPOC are close (${distancePct.toFixed(2)}% apart). Solid structural anchor for price.`;
  } else if (distancePct <= 1.2) {
    pocVpocClass = 'MODERATE';
    pocVpocInterp = `POC and VPOC are moderately spaced (${distancePct.toFixed(2)}% apart).`;
  }

  const minZone = Math.min(pocPrice, vpocPrice) * 0.998;
  const maxZone = Math.max(pocPrice, vpocPrice) * 1.002;

  const pocVpoc: PocVpocAnalysis = {
    pocPrice: Math.round(pocPrice * 100) / 100,
    vpocPrice: Math.round(vpocPrice * 100) / 100,
    distanceAbs: Math.round(distanceAbs * 100) / 100,
    distancePct: Math.round(distancePct * 100) / 100,
    classification: pocVpocClass,
    isConfluenceZone,
    confluenceZone: isConfluenceZone ? { min: Math.round(minZone * 100) / 100, max: Math.round(maxZone * 100) / 100 } : undefined,
    interpretation: pocVpocInterp,
  };

  // -------------------------------------------------------------
  // STEP 7: LOOK FOR MAJOR VOLUME DISTRIBUTION
  // -------------------------------------------------------------
  const majorHvn = vp.hvnPrices[0] || vpocPrice;
  const majorLvn = vp.lvnPrices[0] || (vahPrice + valPrice) / 2;

  const volumeDist: VolumeDistributionAnalysis = {
    majorHvn: Math.round(majorHvn * 100) / 100,
    majorLvn: Math.round(majorLvn * 100) / 100,
    volumeClusterZone: `₹${vp.vvalPrice.toFixed(2)} - ₹${vp.vvahPrice.toFixed(2)}`,
    volumeAcceptanceRange: `₹${valPrice.toFixed(2)} - ₹${vahPrice.toFixed(2)}`,
    interpretation: `Major Volume Node at ₹${majorHvn.toFixed(2)} serves as magnet/support. Low Volume Node at ₹${majorLvn.toFixed(2)} indicates fast auction zone.`,
  };

  // -------------------------------------------------------------
  // FINAL SCORE & SETUP CLASSIFICATION (0 - 100)
  // -------------------------------------------------------------
  let score = 50; // base score

  // Trend factor (+/- 15)
  if (overallTrend.includes('Bullish')) score += 12;
  if (overallTrend === 'Strong Bullish') score += 5;
  if (overallTrend.includes('Bearish')) score -= 12;
  if (overallTrend === 'Strong Bearish') score -= 5;

  // CVA factor (+/- 15)
  if (cvaStatus === 'Bullish Delta') score += 15;
  if (cvaStatus === 'Bearish Delta') score -= 10;

  // Value Acceptance (+/- 20)
  if (valueStatus === 'Acceptance Above VAH') score += 18;
  if (valueStatus === 'Rejection Below VAL') score += 15;
  if (valueStatus === 'Acceptance Below VAL') score -= 18;
  if (valueStatus === 'Rejection Above VAH') score -= 12;

  // POC Imbalance (+/- 10)
  if (pocPos === 'Near VAH') score += 10;
  if (pocPos === 'Near VAL') score -= 8;

  // POC / VPOC Confluence (+10)
  if (isConfluenceZone) score += 10;

  // Clamp score 0 - 100
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  let setupBracket: OrderFlowAnalysisResult['setupBracket'] = 'WATCH';
  let bracketColor = '#eab308'; // yellow

  if (finalScore <= 30) {
    setupBracket = 'NO TRADE';
    bracketColor = '#ef4444'; // red
  } else if (finalScore <= 50) {
    setupBracket = 'WATCH';
    bracketColor = '#f59e0b'; // orange
  } else if (finalScore <= 70) {
    setupBracket = 'DEVELOPING';
    bracketColor = '#3b82f6'; // blue
  } else if (finalScore <= 85) {
    setupBracket = 'VALID SETUP';
    bracketColor = '#10b981'; // green
  } else {
    setupBracket = 'HIGH-CONFLUENCE SETUP';
    bracketColor = '#8b5cf6'; // purple
  }

  let bias: OrderFlowAnalysisResult['bias'] = 'NEUTRAL';
  if (finalScore >= 60) bias = 'BULLISH';
  else if (finalScore <= 40) bias = 'BEARISH';

  // -------------------------------------------------------------
  // WHY THIS BIAS? (3 to 5 concise data-backed reasons)
  // -------------------------------------------------------------
  const whyThisBias: string[] = [];

  whyThisBias.push(`Trend Alignment: ${overallTrend} market structure with price ${trend.priceVsEma}.`);

  if (isConfluenceZone) {
    whyThisBias.push(`Strong POC/VPOC Confluence: TPO POC (₹${pocPrice.toFixed(2)}) & Volume POC (₹${vpocPrice.toFixed(2)}) are aligned within ${distancePct.toFixed(2)}%, forming a key Support/Resistance zone.`);
  } else {
    whyThisBias.push(`POC vs VPOC Spacing: TPO POC (₹${pocPrice.toFixed(2)}) and VPOC (₹${vpocPrice.toFixed(2)}) are separated by ${distancePct.toFixed(2)}%.`);
  }

  whyThisBias.push(`Value Acceptance: ${valueStatus}. Price is trading at ₹${livePrice.toFixed(2)} relative to VAH (₹${vahPrice.toFixed(2)}) & VAL (₹${valPrice.toFixed(2)}).`);

  if (cvaStatus !== 'CVA DATA UNAVAILABLE') {
    whyThisBias.push(`Order Flow Delta: ${cvaStatus} with Cumulative Delta of ${cumDelta > 0 ? '+' : ''}${cumDelta.toLocaleString()} (Buy Volume: ${(deltaRatio * 100).toFixed(1)}%).`);
  }

  if (isElongatedProfile) {
    whyThisBias.push(`Profile Nuance: Directional expansion created an Elongated Profile day.`);
  } else if (isBalancedArea) {
    whyThisBias.push(`Profile Nuance: Price is consolidating inside a active Balanced Area range.`);
  }

  return {
    symbol,
    timeframe,
    livePrice,
    trend,
    balance,
    cva,
    valueAcceptance,
    pocImbalance,
    pocVpoc,
    volumeDist,
    volumeProfile: vp,
    confluenceScore: finalScore,
    setupBracket,
    bracketColor,
    bias,
    whyThisBias,
  };
}
