import type { Candle } from './profileCalculator';

export interface MatrixSeriesPoint {
  time: number;
  value: number;
}

export interface MatrixSeriesData {
  level1: MatrixSeriesPoint[];
  level2: MatrixSeriesPoint[];
  level3: MatrixSeriesPoint[];
  level4: MatrixSeriesPoint[];
  level5: MatrixSeriesPoint[];
  level6: MatrixSeriesPoint[];
  level7: MatrixSeriesPoint[];
  level8: MatrixSeriesPoint[];
  level9: MatrixSeriesPoint[];
  level10: MatrixSeriesPoint[];
}

// In-memory daily anchor cache to prevent intraday level jitter/drifting
const dailyLevelsCache = new Map<string, any>();

export function calculateMatrixSeriesData(
  candles: Candle[], 
  timeframe: string = '5',
  matrixHistory?: Record<string, any> | null
): MatrixSeriesData {
  // Support flexible argument order in case matrixHistory is passed as 2nd param
  let effTimeframe = timeframe;
  let effMatrixHistory = matrixHistory;
  if (typeof timeframe === 'object' && timeframe !== null) {
    effMatrixHistory = timeframe as any;
    effTimeframe = '5';
  }

  const isDailyAnchor = !(effTimeframe === 'D' || effTimeframe === 'W' || effTimeframe === 'M');
  
  const seriesData: MatrixSeriesData = {
    level1: [], level2: [], level3: [], level4: [], level5: [],
    level6: [], level7: [], level8: [], level9: [], level10: []
  };

  if (!candles || candles.length === 0) return seriesData;

  // 1. Group candles chronologically by anchor key in IST
  const groups: Record<string, Candle[]> = {};
  const groupKeys: string[] = [];
  
  candles.forEach((c) => {
    const date = new Date(c.time * 1000);
    let key = '';
    if (isDailyAnchor) {
      // YYYY-MM-DD daily grouping in Indian Standard Time (IST)
      key = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    } else {
      // YYYY-MM monthly grouping in Indian Standard Time (IST)
      key = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 7);
    }
    if (!groups[key]) {
      groups[key] = [];
      groupKeys.push(key);
    }
    groups[key].push(c);
  });

  groupKeys.sort();
  if (groupKeys.length === 0) return seriesData;

  const currentKey = groupKeys[groupKeys.length - 1];
  const currentCandles = groups[currentKey] || [];
  if (currentCandles.length === 0) return seriesData;

  // 2. PRIORITY A: Use official pre-calculated static anchor levels from backend matrixHistory
  if (effMatrixHistory && typeof effMatrixHistory === 'object') {
    let levels = effMatrixHistory[currentKey];
    if (!levels) {
      const historyKeys = Object.keys(effMatrixHistory).sort();
      if (historyKeys.length > 0) {
        levels = effMatrixHistory[historyKeys[historyKeys.length - 1]];
      }
    }

    if (levels && typeof levels.level4 === 'number' && typeof levels.level7 === 'number') {
      const sortedCurrent = [...currentCandles].sort((a, b) => a.time - b.time);
      sortedCurrent.forEach((c) => {
        seriesData.level1.push({ time: c.time, value: levels.level1 });
        seriesData.level2.push({ time: c.time, value: levels.level2 });
        seriesData.level3.push({ time: c.time, value: levels.level3 });
        seriesData.level4.push({ time: c.time, value: levels.level4 }); // R3 Sell Reversal
        seriesData.level5.push({ time: c.time, value: levels.level5 });
        seriesData.level6.push({ time: c.time, value: levels.level6 });
        seriesData.level7.push({ time: c.time, value: levels.level7 }); // S3 Buy Reversal
        seriesData.level8.push({ time: c.time, value: levels.level8 }); // S4 Breakdown
        seriesData.level9.push({ time: c.time, value: levels.level9 });
        seriesData.level10.push({ time: c.time, value: levels.level10 });
      });

      // Save to static cache for this session
      dailyLevelsCache.set(currentKey, levels);
      return seriesData;
    }
  }

  // 3. PRIORITY B: Calculate from Completed Previous Session Candles
  let levels: any = null;

  if (groupKeys.length >= 2) {
    const prevKey = groupKeys[groupKeys.length - 2];
    const prevCandles = groups[prevKey];

    if (prevCandles && prevCandles.length > 0) {
      const h_prev = Math.max(...prevCandles.map((c) => c.high));
      const l_prev = Math.min(...prevCandles.map((c) => c.low));
      const sortedPrev = [...prevCandles].sort((a, b) => a.time - b.time);
      const c_prev = sortedPrev[sortedPrev.length - 1].close;

      let r_prev = h_prev - l_prev;
      if (r_prev <= 0) {
        r_prev = Math.max(1, c_prev * 0.01);
      }

      if (r_prev > 0) {
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

        levels = {
          level1: Math.round(r6 * 100) / 100,
          level2: Math.round(r5 * 100) / 100,
          level3: Math.round(r4 * 100) / 100,
          level4: Math.round(r3 * 100) / 100,
          level5: Math.round(r2 * 100) / 100,
          level6: Math.max(0.05, Math.round(s2 * 100) / 100),
          level7: Math.max(0.05, Math.round(s3 * 100) / 100),
          level8: Math.max(0.05, Math.round(s4 * 100) / 100),
          level9: Math.max(0.05, Math.round(s5 * 100) / 100),
          level10: Math.max(0.05, Math.round(s6 * 100) / 100)
        };

        // Cache so levels remain permanently frozen today even if previous candles roll off
        dailyLevelsCache.set(currentKey, levels);
      }
    }
  } else {
    // Only 1 day of candles in slice (today):
    // DO NOT calculate from today's forming candles! Check static session cache first
    levels = dailyLevelsCache.get(currentKey);
  }

  // 4. Apply static levels to today's candles
  if (levels) {
    const sortedCurrent = [...currentCandles].sort((a, b) => a.time - b.time);
    sortedCurrent.forEach((c) => {
      seriesData.level1.push({ time: c.time, value: levels.level1 });
      seriesData.level2.push({ time: c.time, value: levels.level2 });
      seriesData.level3.push({ time: c.time, value: levels.level3 });
      seriesData.level4.push({ time: c.time, value: levels.level4 });
      seriesData.level5.push({ time: c.time, value: levels.level5 });
      seriesData.level6.push({ time: c.time, value: levels.level6 });
      seriesData.level7.push({ time: c.time, value: levels.level7 });
      seriesData.level8.push({ time: c.time, value: levels.level8 });
      seriesData.level9.push({ time: c.time, value: levels.level9 });
      seriesData.level10.push({ time: c.time, value: levels.level10 });
    });
  }

  return seriesData;
}
