import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';
import fs from 'fs';

async function run() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Fetching Nifty 5m candles for today...');
  try {
    const spotCandles = await fetchCandlesForSymbol(tvBridge, 'NSE:NIFTY', '5', 10);
    
    // Filter for today's candles
    const todayStr = '18/8/2026';
    const todaySpot = spotCandles.filter(c => {
      const d = new Date(c.time * 1000).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      return d === todayStr;
    }).sort((a, b) => a.time - b.time);
    
    if (todaySpot.length === 0) {
      console.log('Error: First 5m candle not formed yet. Wait until 09:20 AM IST.');
      process.exit(1);
    }
    
    const firstCandle = todaySpot[0];
    const H5m = firstCandle.high;
    const L5m = firstCandle.low;
    const O5m = firstCandle.open;
    const C5m = firstCandle.close;
    const Lprev = 24230.40; // Yesterday's Low
    
    console.log('\n--- First 5-Min Candle Values ---');
    console.log(`Open: ${O5m.toFixed(2)}`);
    console.log(`High: ${H5m.toFixed(2)}`);
    console.log(`Low: ${L5m.toFixed(2)}`);
    console.log(`Close: ${C5m.toFixed(2)}`);
    console.log(`Yesterday Low: ${Lprev.toFixed(2)}`);
    
    // Ascending sort
    const values = [O5m, H5m, L5m, C5m, Lprev];
    values.sort((a, b) => a - b);
    
    console.log('\n--- Ascending Order ---');
    console.log(values.map((v, i) => `V${i+1}: ${v.toFixed(2)}`).join(' | '));
    
    // Strike Selection: 100+ points ITM below L5m
    const rawStrike = L5m - 100;
    const strike = Math.floor(rawStrike / 50) * 50; // round to nearest 50 strike
    
    console.log(`\nSelected Call Strike: NIFTY260825C${strike} (ITM Call)`);
    
    // Calculate Option Levels
    const floorDefense = Lprev - strike;
    const breakoutTrigger = O5m - strike;
    
    console.log('\n======================================================');
    console.log(`🔥 OPTION ONE (CE) MATH FOR STRIKE ${strike}:`);
    console.log(`1. Floor Defense Level: ₹${floorDefense.toFixed(2)}`);
    console.log(`   (If Call stays above this, Spot cannot break Yesterday's Low)`);
    console.log(`2. Bullish Breakout Trigger: ₹${breakoutTrigger.toFixed(2)}`);
    console.log(`   (If Call reclaims this, Spot breaks Open into a Trend Drive)`);
    console.log('======================================================\n');
  } catch (e) {
    console.error('Error fetching data:', e.message || e);
  }
  process.exit(0);
}

run();
