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

export function calculateMatrixSeriesData(candles: Candle[], timeframe: string): MatrixSeriesData {
  const isDailyAnchor = !(timeframe === 'D' || timeframe === 'W' || timeframe === 'M');
  
  // 1. Group candles chronologically by anchor key
  const groups: Record<string, Candle[]> = {};
  const groupKeys: string[] = [];
  
  candles.forEach((c) => {
    const date = new Date(c.time * 1000);
    let key = '';
    if (isDailyAnchor) {
      // YYYY-MM-DD daily grouping
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
    } else {
      // YYYY-MM monthly grouping
      key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }
    if (!groups[key]) {
      groups[key] = [];
      groupKeys.push(key);
    }
    groups[key].push(c);
  });

  // Ensure keys are sorted chronologically
  groupKeys.sort();

  const seriesData: MatrixSeriesData = {
    level1: [], level2: [], level3: [], level4: [], level5: [],
    level6: [], level7: [], level8: [], level9: [], level10: []
  };

  // 2. Loop through each group starting from index 1 (since index 0 has no prior period to look back to)
  for (let i = 1; i < groupKeys.length; i++) {
    const currentKey = groupKeys[i];
    const prevKey = groupKeys[i - 1];

    const currentCandles = groups[currentKey];
    const prevCandles = groups[prevKey];

    if (!currentCandles || currentCandles.length === 0 || !prevCandles || prevCandles.length === 0) {
      continue;
    }

    // Calculate High, Low, Close of the previous period
    const h_prev = Math.max(...prevCandles.map((c) => c.high));
    const l_prev = Math.min(...prevCandles.map((c) => c.low));
    
    // Sort previous period candles chronologically to retrieve close
    const sortedPrev = [...prevCandles].sort((a, b) => a.time - b.time);
    const c_prev = sortedPrev[sortedPrev.length - 1].close;

    const r_prev = h_prev - l_prev;
    if (r_prev === 0) continue;

    // Matrix levels
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

    // Map values to 10 levels
    const levels = {
      level1: r6, level2: r5, level3: r4, level4: r3, level5: r2,
      level6: s2, level7: s3, level8: s4, level9: s5, level10: s6
    };

    // Sort current session candles chronologically and write matrix points
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
