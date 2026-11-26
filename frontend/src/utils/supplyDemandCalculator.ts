import type { Candle } from './profileCalculator';

export interface SupplyDemandZone {
  id: string;
  type: 'supply' | 'demand';
  high: number;
  low: number;
  startTime: number;
  label: string;
  isMitigated: boolean;
}

export interface HTFLevel {
  id: string;
  code: 'PDH' | 'PDL' | 'PWH' | 'PWL' | 'PMH' | 'PML';
  label: string;
  price: number;
  color: string;
  type: 'high' | 'low';
}

export interface SupplyDemandAnalysis {
  ema7Data: { time: number; value: number }[];
  currentEma7: number | null;
  supplyZones: SupplyDemandZone[];
  demandZones: SupplyDemandZone[];
  htfLevels: HTFLevel[];
}

/**
 * Calculates 7-period Exponential Moving Average (7 EMA).
 */
export function calculate7EMA(candles: Candle[]): { time: number; value: number }[] {
  if (!candles || candles.length === 0) return [];
  const period = 7;
  const k = 2 / (period + 1);

  const result: { time: number; value: number }[] = [];
  let ema = candles[0].close;

  for (let i = 0; i < candles.length; i++) {
    const close = candles[i].close;
    if (i === 0) {
      ema = close;
    } else {
      ema = (close - ema) * k + ema;
    }
    result.push({
      time: (candles[i].time + 19800), // Shift to Indian Market IST for Lightweight Charts
      value: parseFloat(ema.toFixed(2))
    });
  }

  return result;
}

/**
 * Calculates Higher Timeframe Levels:
 * - PDH (Previous Day High), PDL (Previous Day Low)
 * - PWH (Previous Week High), PWL (Previous Week Low)
 * - PMH (Previous Month High), PML (Previous Month Low)
 */
export function calculateHTFLevels(candles: Candle[]): HTFLevel[] {
  if (!candles || candles.length < 5) return [];

  const getIstDate = (t: number) => new Date((t + 19800) * 1000);

  // Group candles by calendar Day (IST)
  const daysMap = new Map<string, Candle[]>();
  // Group candles by calendar Week (Year-Week)
  const weeksMap = new Map<string, Candle[]>();
  // Group candles by calendar Month (Year-Month)
  const monthsMap = new Map<string, Candle[]>();

  candles.forEach(c => {
    const d = getIstDate(c.time);
    const dayKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;

    // Simple ISO week key
    const janFirst = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const dayOfYear = Math.floor((d.getTime() - janFirst.getTime()) / 86400000);
    const weekNum = Math.ceil((dayOfYear + janFirst.getUTCDay() + 1) / 7);
    const weekKey = `${d.getUTCFullYear()}-W${weekNum}`;

    const monthKey = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;

    if (!daysMap.has(dayKey)) daysMap.set(dayKey, []);
    daysMap.get(dayKey)!.push(c);

    if (!weeksMap.has(weekKey)) weeksMap.set(weekKey, []);
    weeksMap.get(weekKey)!.push(c);

    if (!monthsMap.has(monthKey)) monthsMap.set(monthKey, []);
    monthsMap.get(monthKey)!.push(c);
  });

  const sortedDayKeys = Array.from(daysMap.keys()).sort();
  const sortedWeekKeys = Array.from(weeksMap.keys()).sort();
  const sortedMonthKeys = Array.from(monthsMap.keys()).sort();

  const levels: HTFLevel[] = [];

  // Previous Day High & Low (PDH, PDL)
  if (sortedDayKeys.length >= 2) {
    const prevDayCandles = daysMap.get(sortedDayKeys[sortedDayKeys.length - 2]) || [];
    if (prevDayCandles.length > 0) {
      const pdh = Math.max(...prevDayCandles.map(c => c.high));
      const pdl = Math.min(...prevDayCandles.map(c => c.low));

      levels.push({
        id: 'pdh',
        code: 'PDH',
        label: `PDH: ${pdh.toFixed(1)}`,
        price: parseFloat(pdh.toFixed(2)),
        color: '#f59e0b', // Amber/Orange
        type: 'high'
      });

      levels.push({
        id: 'pdl',
        code: 'PDL',
        label: `PDL: ${pdl.toFixed(1)}`,
        price: parseFloat(pdl.toFixed(2)),
        color: '#22c55e', // Green
        type: 'low'
      });
    }
  }

  // Previous Week High & Low (PWH, PWL)
  if (sortedWeekKeys.length >= 2) {
    const prevWeekCandles = weeksMap.get(sortedWeekKeys[sortedWeekKeys.length - 2]) || [];
    if (prevWeekCandles.length > 0) {
      const pwh = Math.max(...prevWeekCandles.map(c => c.high));
      const pwl = Math.min(...prevWeekCandles.map(c => c.low));

      levels.push({
        id: 'pwh',
        code: 'PWH',
        label: `PWH: ${pwh.toFixed(1)}`,
        price: parseFloat(pwh.toFixed(2)),
        color: '#f97316', // Orange
        type: 'high'
      });

      levels.push({
        id: 'pwl',
        code: 'PWL',
        label: `PWL: ${pwl.toFixed(1)}`,
        price: parseFloat(pwl.toFixed(2)),
        color: '#10b981', // Emerald Green
        type: 'low'
      });
    }
  }

  // Previous Month High & Low (PMH, PML)
  if (sortedMonthKeys.length >= 2) {
    const prevMonthCandles = monthsMap.get(sortedMonthKeys[sortedMonthKeys.length - 2]) || [];
    if (prevMonthCandles.length > 0) {
      const pmh = Math.max(...prevMonthCandles.map(c => c.high));
      const pml = Math.min(...prevMonthCandles.map(c => c.low));

      levels.push({
        id: 'pmh',
        code: 'PMH',
        label: `PMH: ${pmh.toFixed(1)}`,
        price: parseFloat(pmh.toFixed(2)),
        color: '#ea580c', // Deep Orange
        type: 'high'
      });

      levels.push({
        id: 'pml',
        code: 'PML',
        label: `PML: ${pml.toFixed(1)}`,
        price: parseFloat(pml.toFixed(2)),
        color: '#34d399', // Mint Green
        type: 'low'
      });
    }
  }

  return levels;
}

/**
 * Detects Institutional Supply & Demand Order Block Zones.
 * - Supply Zones: Bearish base prior to displacement drop.
 * - Demand Zones: Bullish base prior to displacement rally.
 */
export function calculateSupplyDemandZones(candles: Candle[]): { supplyZones: SupplyDemandZone[]; demandZones: SupplyDemandZone[] } {
  if (!candles || candles.length < 15) return { supplyZones: [], demandZones: [] };

  const currentPrice = candles[candles.length - 1].close;

  // Calculate Average True Range (ATR)
  let atrSum = 0;
  const lookback = Math.min(20, candles.length - 1);
  for (let i = candles.length - lookback; i < candles.length; i++) {
    const tr = Math.max(
      candles[i].high - candles[i].low,
      Math.abs(candles[i].high - candles[i - 1].close),
      Math.abs(candles[i].low - candles[i - 1].close)
    );
    atrSum += tr;
  }
  const atr = Math.max(0.1, atrSum / lookback);

  const rawSupply: SupplyDemandZone[] = [];
  const rawDemand: SupplyDemandZone[] = [];

  // Scan for displacement moves
  for (let i = 2; i < candles.length - 1; i++) {
    const prev = candles[i - 1];
    const curr = candles[i];
    const next = candles[i + 1];

    const bodyCurr = Math.abs(curr.close - curr.open);
    const rangeCurr = curr.high - curr.low;

    // Bearish Displacement: Large red candle breaking down
    if (curr.close < curr.open && bodyCurr >= atr * 0.9 && curr.close < prev.low) {
      // Base candle is prev
      const high = parseFloat(Math.max(prev.high, curr.high).toFixed(2));
      const low = parseFloat(Math.min(Math.max(prev.open, prev.close), high - atr * 0.25).toFixed(2));

      if (high > low && high > currentPrice) {
        // Check if violated by any subsequent candle
        let violated = false;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].close > high) {
            violated = true;
            break;
          }
        }
        if (!violated) {
          rawSupply.push({
            id: `sup-${curr.time}`,
            type: 'supply',
            high,
            low,
            startTime: prev.time + 19800,
            label: `Supply [${high.toFixed(1)} - ${low.toFixed(1)}]`,
            isMitigated: false
          });
        }
      }
    }

    // Bullish Displacement: Large green candle breaking up
    if (curr.close > curr.open && bodyCurr >= atr * 0.9 && curr.close > prev.high) {
      // Base candle is prev
      const low = parseFloat(Math.min(prev.low, curr.low).toFixed(2));
      const high = parseFloat(Math.max(Math.min(prev.open, prev.close), low + atr * 0.25).toFixed(2));

      if (high > low && low < currentPrice) {
        // Check if violated by any subsequent candle
        let violated = false;
        for (let j = i + 1; j < candles.length; j++) {
          if (candles[j].close < low) {
            violated = true;
            break;
          }
        }
        if (!violated) {
          rawDemand.push({
            id: `dem-${curr.time}`,
            type: 'demand',
            high,
            low,
            startTime: prev.time + 19800,
            label: `Demand [${high.toFixed(1)} - ${low.toFixed(1)}]`,
            isMitigated: false
          });
        }
      }
    }
  }

  // Deduplicate overlapping zones
  const filterOverlapping = (zones: SupplyDemandZone[]): SupplyDemandZone[] => {
    const sorted = [...zones].sort((a, b) => b.startTime - a.startTime);
    const result: SupplyDemandZone[] = [];

    for (const z of sorted) {
      const isOverlap = result.some(existing => 
        Math.abs(existing.high - z.high) / (z.high || 1) < 0.005 ||
        (z.low <= existing.high && z.high >= existing.low)
      );
      if (!isOverlap) {
        result.push(z);
      }
    }
    return result;
  };

  const finalSupply = filterOverlapping(rawSupply).slice(0, 4);
  const finalDemand = filterOverlapping(rawDemand).slice(0, 4);

  return {
    supplyZones: finalSupply,
    demandZones: finalDemand
  };
}

/**
 * Master analysis function for Candlestick Chart.
 */
export function analyzeSupplyDemand(candles: Candle[]): SupplyDemandAnalysis {
  const ema7Data = calculate7EMA(candles);
  const currentEma7 = ema7Data.length > 0 ? ema7Data[ema7Data.length - 1].value : null;
  const htfLevels = calculateHTFLevels(candles);
  const { supplyZones, demandZones } = calculateSupplyDemandZones(candles);

  return {
    ema7Data,
    currentEma7,
    supplyZones,
    demandZones,
    htfLevels
  };
}
