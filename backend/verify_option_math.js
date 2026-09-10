import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';
import fs from 'fs';
import path from 'path';

// Black-Scholes Simulation Helpers
function normalCDF(x) {
  const t = 1.0 / (1.0 + 0.2316419 * Math.abs(x));
  const d = 0.3989422804 * Math.exp(-x * x / 2.0);
  const p = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  return x >= 0.0 ? 1.0 - d * p : d * p;
}

function calculateBSPrice(S, K, T, r, sigma, optionType) {
  if (T <= 0.0001) {
    // Expiry day intrinsic value
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

async function runMathSimulation() {
  console.log('Connecting to TradingView Bridge...');
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  const symbol = 'NSE:NIFTY';
  const limit = 10000;
  
  console.log(`Fetching ${limit} candles for ${symbol}...`);
  const candles = await fetchCandlesForSymbol(tvBridge, symbol, '5', limit);
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  
  // Group candles by date in IST
  const candlesByDate = {};
  sorted.forEach(c => {
    const dateObj = new Date(c.time * 1000);
    const dateStr = dateObj.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
    if (!candlesByDate[dateStr]) candlesByDate[dateStr] = [];
    candlesByDate[dateStr].push(c);
  });

  console.log(`Total days to simulate: ${Object.keys(candlesByDate).length}`);
  
  let successfulBounces = 0;
  let failedBounces = 0;
  let timeValueFloorTriggers = 0;

  const dayOfWeekResults = {
    1: { total: 0, bounces: 0 },
    2: { total: 0, bounces: 0 },
    3: { total: 0, bounces: 0 },
    4: { total: 0, bounces: 0 },
    5: { total: 0, bounces: 0 }
  };

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
    const dayOfWeek = dateObj.getDay(); // 1 = Monday, 2 = Tuesday (Expiry)
    
    // Select 100-pt ITM strikes
    const interval = 100;
    let ceStrike = Math.floor((open - 100) / interval) * interval;
    if (ceStrike >= low) {
      ceStrike = Math.floor((low - 50) / interval) * interval;
    }
    
    const ceLevel = parseFloat((low - ceStrike).toFixed(2));
    
    // Simulation Parameters
    const r = 0.07; // Risk-free rate (7% for India)
    const sigma = 0.12; // Implied Volatility (12% VIX baseline)
    
    // Calculate Days to Expiry (T) based on Tuesday weekly expiry
    let daysToExpiry = 0;
    if (dayOfWeek === 1) daysToExpiry = 1;      // Monday (1 day to expiry)
    else if (dayOfWeek === 2) daysToExpiry = 0; // Tuesday (Expiry day)
    else if (dayOfWeek === 3) daysToExpiry = 6; // Wednesday (6 days to expiry)
    else if (dayOfWeek === 4) daysToExpiry = 5; // Thursday (5 days to expiry)
    else if (dayOfWeek === 5) daysToExpiry = 4; // Friday (4 days to expiry)
    
    const T_initial = daysToExpiry / 365.0;
    
    // Check subsequent candles for low breakdown tests
    const idx = dayCandles.indexOf(firstCandle);
    const remainingCandles = dayCandles.slice(idx + 1);
    
    let lowBreached = false;
    let bounced = false;
    let failed = false;
    
    for (let i = 0; i < remainingCandles.length; i++) {
      const c = remainingCandles[i];
      
      // Calculate time decay during the session (progressing through 375 minutes of trading)
      const minutesProgressed = i * 5;
      const T_current = Math.max(0.0001, (daysToExpiry - (minutesProgressed / 375.0)) / 365.0);
      
      // Calculate simulated Call option price at current spot price
      const optionPrice = calculateBSPrice(c.close, ceStrike, T_current, r, sigma, 'C');
      
      // Test breakdown of morning low
      if (c.low < low && !lowBreached) {
        lowBreached = true;
        
        // Find if premium defends the calculated ceLevel
        // Calculate option price at the exact moment of the low breach (simulated close)
        const optionPriceAtLow = calculateBSPrice(c.low, ceStrike, T_current, r, sigma, 'C');
        const premiumDifference = optionPriceAtLow - ceLevel;
        
        // Time value floor rule checks:
        if (daysToExpiry >= 3 && ceLevel < 40) {
          timeValueFloorTriggers++; // Natural time value floor prevents the breach!
        }
        
        // Track subsequent candles to see if premium bounces back or collapses below level
        let maxRecovery = 0;
        let isCollapse = false;
        
        const postBreach = remainingCandles.slice(i + 1);
        for (const pc of postBreach) {
          const pcOptPrice = calculateBSPrice(pc.close, ceStrike, T_current, r, sigma, 'C');
          
          if (pcOptPrice > optionPriceAtLow + 15) {
            bounced = true;
            break;
          }
          if (pcOptPrice < ceLevel - 10) {
            isCollapse = true;
            break;
          }
        }
        
        if (bounced) {
          successfulBounces++;
          if (dayOfWeekResults[dayOfWeek]) dayOfWeekResults[dayOfWeek].bounces++;
        } else if (isCollapse) {
          failedBounces++;
        }
        break; // Only test the first breakdown trigger of the day
      }
    }
    
    if (dayOfWeekResults[dayOfWeek]) {
      dayOfWeekResults[dayOfWeek].total++;
    }
  });

  // Calculate stats
  const totalBounces = successfulBounces + failedBounces;
  const winRate = parseFloat(((successfulBounces / (totalBounces || 1)) * 100).toFixed(1));

  console.log(`\n======================================================`);
  console.log(`📊 BLACK-SCHOLES OPTION PREMIUM SIMULATION BACKTEST`);
  console.log(`======================================================`);
  console.log(`Total Days Simulated: ${Object.keys(candlesByDate).length}`);
  console.log(`Total Low Breakdown Tests: ${totalBounces}`);
  console.log(`Successful Support Bounces (Win): ${successfulBounces}`);
  console.log(`Failed Support Breakdowns (Loss): ${failedBounces}`);
  console.log(`Reversal Bounce Win Rate: ${winRate}%`);
  console.log(`Time Value Floor Triggers (Mondays/Tuesdays): ${timeValueFloorTriggers}`);
  
  console.log('\n📅 Bounce Win Rate by Day of the Week:');
  const dayNames = { 1: 'Monday', 2: 'Tuesday (Expiry)', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday' };
  for (const [dayNum, stats] of Object.entries(dayOfWeekResults)) {
    const rate = parseFloat(((stats.bounces / (stats.total || 1)) * 100).toFixed(1));
    console.log(`  - ${dayNames[dayNum]}: ${stats.bounces} wins / ${stats.total} days (${rate}% win rate)`);
  }
  
  process.exit(0);
}

runMathSimulation();
