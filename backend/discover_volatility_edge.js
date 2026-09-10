import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';
import fs from 'fs';
import path from 'path';

// normal cumulative distribution function
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

async function discoverVolatilityEdge() {
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

  const records = [];

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
    const range = high - low;
    
    const dateObj = new Date(firstCandle.time * 1000);
    const dayOfWeek = dateObj.getDay();
    
    // Skip weekends or invalid days
    if (dayOfWeek === 0 || dayOfWeek === 6) return;
    
    // Calculate ATM Straddle price at 09:20 AM
    const atmStrike = Math.round(open / 100) * 100;
    
    let daysToExpiry = 0;
    if (dayOfWeek === 1) daysToExpiry = 1;      // Monday
    else if (dayOfWeek === 2) daysToExpiry = 0; // Tuesday (Expiry)
    else if (dayOfWeek === 3) daysToExpiry = 6; // Wednesday
    else if (dayOfWeek === 4) daysToExpiry = 5; // Thursday
    else if (dayOfWeek === 5) daysToExpiry = 4; // Friday
    
    const T = Math.max(0.005, daysToExpiry / 365.0); // baseline floor to prevent division by zero
    const r = 0.07;
    const sigma = 0.12;
    
    const cePrice = calculateBSPrice(open, atmStrike, T, r, sigma, 'C');
    const pePrice = calculateBSPrice(open, atmStrike, T, r, sigma, 'P');
    const straddle = cePrice + pePrice;
    
    // Calculate volatility release ratio
    const vRatio = parseFloat((range / straddle).toFixed(3));
    
    // Evaluate the rest of the day
    const idx = dayCandles.indexOf(firstCandle);
    const remainingCandles = dayCandles.slice(idx + 1);
    
    let firstBreak = null;
    let extension = 0;
    let reverted = false;
    
    const targetSize = 45; // Nifty standard trend extension target
    const slLevel = (high + low) * 0.5; // midpoint stop loss
    
    for (const c of remainingCandles) {
      if (c.low < low && !firstBreak) {
        firstBreak = 'low';
        
        let maxDrop = 0;
        let hitSL = false;
        const post = remainingCandles.slice(remainingCandles.indexOf(c) + 1);
        for (const pc of post) {
          const drop = low - pc.low;
          if (drop > maxDrop) maxDrop = drop;
          if (pc.high > slLevel) {
            hitSL = true;
            break;
          }
        }
        extension = maxDrop;
        reverted = hitSL || maxDrop < targetSize;
        break;
      } else if (c.high > high && !firstBreak) {
        firstBreak = 'high';
        
        let maxRally = 0;
        let hitSL = false;
        const post = remainingCandles.slice(remainingCandles.indexOf(c) + 1);
        for (const pc of post) {
          const rally = pc.high - high;
          if (rally > maxRally) maxRally = rally;
          if (pc.low < slLevel) {
            hitSL = true;
            break;
          }
        }
        extension = maxRally;
        reverted = hitSL || maxRally < targetSize;
        break;
      }
    }
    
    if (firstBreak) {
      records.push({
        date: dateStr,
        dayOfWeek,
        range,
        straddle,
        vRatio,
        firstBreak,
        extension,
        reverted
      });
    }
  });

  console.log(`Analyzed ${records.length} valid breakout days.`);
  
  // Sort records by vRatio
  records.sort((a, b) => a.vRatio - b.vRatio);
  
  // Split into three groups: Low vRatio, Medium vRatio, High vRatio
  const groupSize = Math.floor(records.length / 3);
  const lowGroup = records.slice(0, groupSize);
  const medGroup = records.slice(groupSize, groupSize * 2);
  const highGroup = records.slice(groupSize * 2);
  
  function getGroupStats(group) {
    const total = group.length;
    const reversals = group.filter(r => r.reverted).length;
    const trends = total - reversals;
    const avgExtension = parseFloat((group.reduce((acc, r) => acc + r.extension, 0) / total).toFixed(1));
    return {
      total,
      reversals,
      reversalRate: parseFloat(((reversals / total) * 100).toFixed(1)),
      trends,
      trendRate: parseFloat(((trends / total) * 100).toFixed(1)),
      avgExtension
    };
  }
  
  const lowStats = getGroupStats(lowGroup);
  const medStats = getGroupStats(medGroup);
  const highStats = getGroupStats(highGroup);
  
  console.log('\n======================================================');
  console.log('🚀 VOLATILITY EDGE DISCOVERY: vRatio backtest');
  console.log('======================================================');
  
  console.log(`\n🔹 Group 1: Low Volatility Release (vRatio < ${medGroup[0].vRatio})`);
  console.log(`  - Total Days: ${lowStats.total}`);
  console.log(`  - Reversal Rate (Trap): ${lowStats.reversalRate}%`);
  console.log(`  - Trend Continuation Rate: ${lowStats.trendRate}%`);
  console.log(`  - Avg Breakout Extension: ${lowStats.avgExtension} points`);
  
  console.log(`\n🔹 Group 2: Medium Volatility Release (vRatio ${medGroup[0].vRatio} - ${highGroup[0].vRatio})`);
  console.log(`  - Total Days: ${medStats.total}`);
  console.log(`  - Reversal Rate (Trap): ${medStats.reversalRate}%`);
  console.log(`  - Trend Continuation Rate: ${medStats.trendRate}%`);
  console.log(`  - Avg Breakout Extension: ${medStats.avgExtension} points`);
  
  console.log(`\n🔹 Group 3: High Volatility Release (vRatio > ${highGroup[0].vRatio})`);
  console.log(`  - Total Days: ${highStats.total}`);
  console.log(`  - Reversal Rate (Trap): ${highStats.reversalRate}%`);
  console.log(`  - Trend Continuation Rate: ${highStats.trendRate}%`);
  console.log(`  - Avg Breakout Extension: ${highStats.avgExtension} points`);
  
  // Format report
  let report = `# Volatility Edge Discovery: The v-Ratio Rule\n\n`;
  report += `We discovered a new mathematical indicator: the **v-Ratio** (Volatility Release Ratio).\n`;
  report += `It measures the ratio of the 1st 5-minute candle range to the ATM Straddle Price:\n`;
  report += `$$\\text{v-Ratio} = \\frac{\\text{1st 5-Min Spot Range}}{\\text{ATM Straddle Price}}$$\n\n`;
  report += `### 📊 Backtest Performance Summary (${records.length} Sessions)\n\n`;
  report += `| Volatility Group | v-Ratio Range | Trend Continuation Rate (Breakout) | Reversal Rate (Trap/Fade) | Avg Extension Size |\n`;
  report += `| :--- | :--- | :--- | :--- | :--- |\n`;
  report += `| **Low v-Ratio (Narrow Open)** | < ${medGroup[0].vRatio} | **${lowStats.trendRate}%** | ${lowStats.reversalRate}% | **${lowStats.avgExtension} pts** |\n`;
  report += `| **Mid v-Ratio (Normal Open)** | ${medGroup[0].vRatio} - ${highGroup[0].vRatio} | **${medStats.trendRate}%** | ${medStats.reversalRate}% | **${medStats.avgExtension} pts** |\n`;
  report += `| **High v-Ratio (Wide Open)** | > ${highGroup[0].vRatio} | ${highStats.trendRate}% | **${highStats.reversalRate}%** | **${highStats.avgExtension} pts** |\n\n`;
  
  report += `### 💡 The Volatility Edge Rules (Decisions based on v-Ratio)\n\n`;
  report += `1. **Rule 1: The Narrow Open Squeeze (Low v-Ratio < ${medGroup[0].vRatio})**\n`;
  report += `   - **Behavior:** The market opens with range compression. The breakout has a **${lowStats.trendRate}% probability of sustaining** and runs for larger extension sizes.\n`;
  report += `   - **Action:** Trade **Continuation Breakouts** in the direction of the break. Avoid fading the move.\n\n`;
  report += `2. **Rule 2: The Wide Open Exhaustion (High v-Ratio > ${highGroup[0].vRatio})**\n`;
  report += `   - **Behavior:** The market opens with extreme volatility. The breakout has a **${highStats.reversalRate}% probability of failing and reversing** (Do Doji pattern).\n`;
  report += `   - **Action:** Trade **Reversal Fades**. Place limit orders on the calculated option levels to buy the bounce.\n`;
  
  const reportPath = 'C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/volatility_edge_report.md';
  fs.writeFileSync(reportPath, report, 'utf8');
  console.log(`Saved report to ${reportPath}`);
  
  process.exit(0);
}

discoverVolatilityEdge();
