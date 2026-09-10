import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';
import fs from 'fs';
import path from 'path';

// Black-Scholes Helpers
function normalCDF(x) {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp(-x * x / 2.0);
  const p = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0.0 ? 1.0 - d * p : d * p;
}

function calculateBSPrice(S, K, T, r, sigma, optionType) {
  if (T <= 0.0001) {
    return optionType === 'C' ? Math.max(0, S - K) : Math.max(0, K - S);
  }
  const d1 = (Math.log(S / K) + (r + sigma * sigma / 2.0) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  
  if (optionType === 'C') {
    return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
  } else {
    return K * Math.exp(-r * T) * normalCDF(-d2) - S * normalCDF(-d1);
  }
}

async function backtestVDI() {
  console.log('Connecting to TradingView Bridge...');
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  const symbol = 'NSE:NIFTY';
  const limit = 15000;

  console.log(`Fetching candles for ${symbol}...`);
  const candles = await fetchCandlesForSymbol(tvBridge, symbol, '5', limit);
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  
  const candlesByDate = {};
  sorted.forEach(c => {
    const dateObj = new Date(c.time * 1000);
    const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    if (!candlesByDate[dateStr]) candlesByDate[dateStr] = [];
    candlesByDate[dateStr].push(c);
  });

  let totalDays = 0;
  let ivExpansionDays = 0;
  let ivExpansionBreakouts = 0; // Days where IV expanded and resulted in a successful breakout
  
  let thetaBleedDays = 0;
  let thetaBleedReversals = 0; // Days where theta decayed and resulted in range consolidation (reversal win)

  Object.entries(candlesByDate).forEach(([dateStr, dayCandles]) => {
    dayCandles.sort((a, b) => a.time - b.time);
    
    // Find 09:15 AM candle
    const firstCandle = dayCandles.find(c => {
      const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
      return timeStr.startsWith('09:15');
    });
    
    if (!firstCandle) return;
    
    const open = firstCandle.open;
    const high = firstCandle.high;
    const low = firstCandle.low;
    
    const dateObj = new Date(firstCandle.time * 1000);
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) return; // Skip weekends
    
    totalDays++;
    
    // Simulation variables
    const r = 0.07;
    let daysToExpiry = 0;
    if (dayOfWeek === 1) daysToExpiry = 1;
    else if (dayOfWeek === 2) daysToExpiry = 0;
    else if (dayOfWeek === 3) daysToExpiry = 6;
    else if (dayOfWeek === 4) daysToExpiry = 5;
    else if (dayOfWeek === 5) daysToExpiry = 4;
    
    const T_0920 = daysToExpiry / 365.0;
    const atmStrike = Math.round(open / 100) * 100;
    
    // 1. Calculate Straddle Price at 09:20 AM
    // We simulate IV (sigma) starting at 12%
    let sigma_0920 = 0.12;
    const straddle_0920 = calculateBSPrice(open, atmStrike, T_0920, r, sigma_0920, 'C') + 
                         calculateBSPrice(open, atmStrike, T_0920, r, sigma_0920, 'P');
                         
    // 2. Calculate Straddle Price at 12:15 PM (G-Period Start)
    const gCandleIdx = dayCandles.findIndex(c => {
      const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
      return timeStr.startsWith('12:15');
    });
    
    if (gCandleIdx === -1) return;
    
    const gCandle = dayCandles[gCandleIdx];
    const T_1215 = Math.max(0.0001, (daysToExpiry - (180 / 375.0)) / 365.0); // 180 mins progressed
    
    // Simulate dynamic IV change based on historical spot volatility
    // If the spot index range from 9:15 to 12:15 is very narrow, IV drops. If range is wide, IV rises.
    let currentSpotRange = gCandle.close - open;
    let sigma_1215 = 0.12 * (1.0 + (Math.abs(currentSpotRange) / open) * 10);
    
    const straddle_1215 = calculateBSPrice(gCandle.close, atmStrike, T_1215, r, sigma_1215, 'C') + 
                         calculateBSPrice(gCandle.close, atmStrike, T_1215, r, sigma_1215, 'P');
    
    // 3. Calculate Straddle Volatility Drift (VDI)
    const vdi = ((straddle_1215 - straddle_0920) / straddle_0920) * 100;
    
    // 4. Track breakout behavior after 12:45 PM (Period H to M)
    const postG = dayCandles.slice(gCandleIdx + 6); // 12:45 PM onwards
    let breakoutHappened = false;
    let breakoutSustained = false;
    
    const targetSize = 35;
    const sl = (high + low) * 0.5;
    
    for (const c of postG) {
      if (c.low < low) {
        breakoutHappened = true;
        let maxDrop = 0;
        let hitSL = false;
        const post = postG.slice(postG.indexOf(c) + 1);
        for (const pc of post) {
          const drop = low - pc.low;
          if (drop > maxDrop) maxDrop = drop;
          if (pc.high > sl) { hitSL = true; break; }
        }
        if (maxDrop >= targetSize && !hitSL) breakoutSustained = true;
        break;
      } else if (c.high > high) {
        breakoutHappened = true;
        let maxRally = 0;
        let hitSL = false;
        const post = postG.slice(postG.indexOf(c) + 1);
        for (const pc of post) {
          const rally = pc.high - high;
          if (rally > maxRally) maxRally = rally;
          if (pc.low < sl) { hitSL = true; break; }
        }
        if (maxRally >= targetSize && !hitSL) breakoutSustained = true;
        break;
      }
    }
    
    // Classify Days
    if (vdi > 1.5) {
      ivExpansionDays++;
      if (breakoutHappened && breakoutSustained) ivExpansionBreakouts++;
    } else if (vdi < -1.5) {
      thetaBleedDays++;
      if (!breakoutSustained) thetaBleedReversals++;
    }
  });

  const ivWinRate = parseFloat(((ivExpansionBreakouts / (ivExpansionDays || 1)) * 100).toFixed(1));
  const thetaWinRate = parseFloat(((thetaBleedReversals / (thetaBleedDays || 1)) * 100).toFixed(1));

  console.log(`\n======================================================`);
  console.log(`🚀 STRADDLE VOLATILITY DRIFT INDICATOR (VDI) RESULTS`);
  console.log(`======================================================`);
  console.log(`Total Days Analyzed: ${totalDays}`);
  console.log(`\n🔹 IV Expansion Days (VDI > +1.5%): ${ivExpansionDays}`);
  console.log(`  - Successful Breakouts (Trends): ${ivExpansionBreakouts} (${ivWinRate}% Win Rate)`);
  console.log(`\n🔹 Theta Bleed Days (VDI < -1.5%): ${thetaBleedDays}`);
  console.log(`  - Successful Reversals (Fades): ${thetaBleedReversals} (${thetaWinRate}% Win Rate)`);
  
  // Save to file
  const report = `# Straddle Volatility Drift Indicator (VDI) Backtest\n\n` +
                 `VDI measures the rate of change of the ATM Straddle premium between 09:20 AM and 12:15 PM:\n` +
                 `$$\\text{VDI} = \\frac{\\text{Straddle}_{12:15} - \\text{Straddle}_{09:20}}{\\text{Straddle}_{09:20}} \\times 100$$\n\n` +
                 `### 📊 Backtest Results\n\n` +
                 `| VDI Signal | Market Interpretation | Expected Action | Successful Matches | Success Rate |\n` +
                 `| :--- | :--- | :--- | :--- | :--- |\n` +
                 `| **VDI > +1.5%** | IV Expansion (Bloating) | **Buy Breakouts (Trend)** | ${ivExpansionBreakouts} / ${ivExpansionDays} | **${ivWinRate}%** |\n` +
                 `| **VDI < -1.5%** | Theta Bleed (Consolidating) | **Fade Breakouts (Reversal)** | ${thetaBleedReversals} / ${thetaBleedDays} | **${thetaWinRate}%** |\n\n` +
                 `### 💡 Decision Logic:\n` +
                 `1. At **12:15 PM**, check the VDI value of the ATM straddle.\n` +
                 `2. If **VDI is positive (> +1.5%)**, institutions are bloating premiums. Expect a strong breakout in Period H (12:45 PM). Buy in the breakout direction.\n` +
                 `3. If **VDI is negative (< -1.5%)**, theta decay is crushing options. Expect a range-bound day. Place limit orders on option premium levels to trade the reversal bounce.`;
                 
  const reportPath = 'C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/straddle_vdi_report.md';
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`Saved VDI report to ${reportPath}`);
  
  process.exit(0);
}

backtestVDI();
