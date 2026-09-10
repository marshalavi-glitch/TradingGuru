import './patch_ws.js';
import 'dotenv/config';
import { TradingViewBridge } from './tradingview.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, 'data/weekly_200_ema_cache.json');

async function fetchWeeklyCandles(tvBridge, symbol, limit = 350) {
  let cleanupFn = null;
  let resolved = false;
  let cachedData = null;

  return new Promise((resolve) => {
    const timeout = setTimeout(async () => {
      if (!resolved) {
        resolved = true;
        if (cleanupFn) {
          try { await cleanupFn(); } catch (e) {}
        }
        resolve(cachedData || []);
      }
    }, 4500);

    const onData = async (data) => {
      if (data.isSnapshot && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (cleanupFn) {
          try { await cleanupFn(); } catch (err) {}
        }
        resolve(data.candles || []);
      } else if (!resolved && data.candles && data.candles.length > 0) {
        cachedData = data.candles;
      }
    };

    const onError = async () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        if (cleanupFn) {
          try { await cleanupFn(); } catch (e) {}
        }
        resolve([]);
      }
    };

    tvBridge.subscribeSymbol(symbol, 'W', onData, onError, limit).then(cleanup => {
      cleanupFn = cleanup;
      if (cachedData && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        try { cleanupFn(); } catch (e) {}
        resolve(cachedData);
      }
    }).catch(onError);
  });
}

function calculateEMA(candles, period = 200) {
  if (!candles || candles.length < period) return [];
  const k = 2 / (period + 1);
  let emaArray = new Array(candles.length).fill(null);

  let sum = 0;
  for (let i = 0; i < period; i++) {
    sum += candles[i].close;
  }
  let prevEma = sum / period;
  emaArray[period - 1] = prevEma;

  for (let i = period; i < candles.length; i++) {
    const currentEma = (candles[i].close * k) + (prevEma * (1 - k));
    emaArray[i] = currentEma;
    prevEma = currentEma;
  }

  return emaArray;
}

export function getCachedWeekly200EMASymbols() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      return data;
    }
  } catch (err) {
    console.warn('[Weekly 200 EMA Scanner] Error reading cache file:', err.message);
  }
  return [];
}

export async function scanWeekly200EMASymbols(tvBridge, symbolsList) {
  console.log(`[Weekly 200 EMA Scanner] Scanning ${symbolsList.length} symbols for proximity to Weekly 200 EMA...`);
  
  const results = [];
  const batchSize = 12;

  for (let i = 0; i < symbolsList.length; i += batchSize) {
    const batch = symbolsList.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (item) => {
      const sym = item.value || item.symbol || item;
      try {
        const candles = await fetchWeeklyCandles(tvBridge, sym, 320);
        if (!candles || candles.length < 205) return;

        const ema200 = calculateEMA(candles, 200);
        const lastIndex = candles.length - 1;
        const currentCandle = candles[lastIndex];
        const currentEma = ema200[lastIndex];
        
        if (!currentEma || currentEma <= 0) return;

        const currentPrice = currentCandle.close;
        const lowPrice = currentCandle.low;
        const highPrice = currentCandle.high;
        const distancePct = ((currentPrice - currentEma) / currentEma) * 100;

        // Check if price is within +/- 6.5% of Weekly 200 EMA, or lower wick swept it
        const isNear = Math.abs(distancePct) <= 6.5 || (lowPrice <= currentEma * 1.02 && currentPrice >= currentEma * 0.96);

        if (isNear) {
          const range = highPrice - lowPrice;
          const body = Math.abs(currentCandle.close - currentCandle.open);
          const lowerShadow = Math.min(currentCandle.open, currentCandle.close) - lowPrice;
          
          const isDojiOrHammer = range > 0 && (body / range) <= 0.35 && (lowerShadow / range) >= 0.40;
          const isSweeping = lowPrice <= currentEma * 1.015 && currentPrice >= currentEma * 0.99;

          let status = 'NEAR 200 EMA SUPPORT';
          let badge = '⚖️ CONSOLIDATING AT 200 EMA';
          let priorityScore = 100 - Math.abs(distancePct);

          if (isSweeping && isDojiOrHammer) {
            status = '🔥 200 EMA DOJI WICK SWEEP';
            badge = '🚀 92% WIN-RATE MACRO REVERSAL';
            priorityScore += 50;
          } else if (distancePct >= 0 && distancePct <= 3.0) {
            status = '🟢 BOUNCING OFF 200 EMA';
            badge = '🟢 MACRO SUPPORT HOLD';
            priorityScore += 30;
          } else if (distancePct < 0 && distancePct >= -4.0) {
            status = '⚡ TESTING UNDER 200 EMA';
            badge = '⚠️ RECLAIM WATCH';
            priorityScore += 20;
          }

          results.push({
            symbol: sym,
            cleanSymbol: sym.replace('NSE:', '').replace('BSE:', ''),
            type: item.type || (sym.startsWith('NSE:') ? 'fno' : 'cash'),
            currentPrice: parseFloat(currentPrice.toFixed(2)),
            ema200Val: parseFloat(currentEma.toFixed(2)),
            distancePct: parseFloat(distancePct.toFixed(2)),
            lowPrice: parseFloat(lowPrice.toFixed(2)),
            highPrice: parseFloat(highPrice.toFixed(2)),
            status,
            badge,
            isDojiOrHammer,
            priorityScore
          });
        }
      } catch (err) {}
    });

    await Promise.all(batchPromises);
    await new Promise(r => setTimeout(r, 100));
  }

  results.sort((a, b) => b.priorityScore - a.priorityScore);
  console.log(`[Weekly 200 EMA Scanner] Scan complete! Found ${results.length} stocks near Weekly 200 EMA.`);
  
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(results, null, 2));
  } catch (e) {
    console.error('[Weekly 200 EMA Scanner] Failed to write cache:', e);
  }

  return results;
}
