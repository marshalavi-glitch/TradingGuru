import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';
import fs from 'fs';

// Helper to calculate daily levels based on previous day's daily candles
// Since we want to backtest precisely, we will load the daily levels from levels_cache_backup.json or calculate them.
async function runAnalysis() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Fetching Nifty Spot 5-minute candles...');
  try {
    // Fetch a large block of 5-minute candles to cover the last few sessions
    const spotCandles = await fetchCandlesForSymbol(tvBridge, 'NSE:NIFTY', '5', 500);
    console.log(`Fetched ${spotCandles.length} candles.`);
    
    // Group candles by date
    const days = {};
    spotCandles.forEach(c => {
      const dateStr = new Date(c.time * 1000).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      if (!days[dateStr]) days[dateStr] = [];
      days[dateStr].push(c);
    });
    
    console.log('\nSessions found:', Object.keys(days));
    
    // For each day, analyze the levels and breakout events
    for (const [dateStr, candles] of Object.entries(days)) {
      if (candles.length < 10) continue; // skip partial/incomplete days
      
      console.log(`\n======================================================`);
      console.log(`📅 SESSION: ${dateStr}`);
      console.log(`======================================================`);
      
      const openPrice = candles[0].open;
      const high5m = candles[0].high;
      const low5m = candles[0].low;
      const close5m = candles[0].close;
      
      console.log(`First 5m Candle -> Open: ${openPrice}, High: ${high5m}, Low: ${low5m}, Close: ${close5m}`);
      
      // Let's load the calculated levels for this day from levels_cache_backup.json if it exists
      // Otherwise, we can estimate s4 (Level 8) and r4 (Level 3) using a simple range approximation
      // For this study, we can estimate the levels using the first 5-min range or yesterday's close
      // Let's check the actual levels cache backup to find the real levels written by the scanner!
      let s4 = null;
      let r4 = null;
      try {
        const levelsCache = JSON.parse(fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/levels_cache_backup.json', 'utf8'));
        const dayCache = levelsCache[dateStr]?.['NSE:NIFTY'];
        if (dayCache && dayCache.levels) {
          s4 = dayCache.levels.s4;
          r4 = dayCache.levels.r4;
          console.log(`Loaded Daily Levels from Cache -> S8 (Breakdown): ${s4.toFixed(2)}, R3 (Breakout): ${r4.toFixed(2)}`);
        }
      } catch (e) {}
      
      if (!s4 || !r4) {
        // Fallback calculation using standard 5m opening range proxy
        s4 = openPrice - 50;
        r4 = openPrice + 50;
        console.log(`Using Proxy Levels -> S8 Support: ${s4.toFixed(2)}, R3 Resistance: ${r4.toFixed(2)}`);
      }
      
      // Find the first candle that broke below s4 or above r4
      let brokeDown = false;
      let brokeUp = false;
      
      for (let i = 1; i < candles.length; i++) {
        const c = candles[i];
        const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' });
        
        if (!brokeDown && c.close < s4) {
          brokeDown = true;
          console.log(`🚨 [Breakdown Triggered] at ${timeStr}`);
          console.log(`  - Spot Price: ${c.close} (Broke below S8 Support ${s4.toFixed(2)})`);
          console.log(`  - Candle Volume: ${c.volume || 0}`);
          
          // Look forward to see where it went
          let minAfter = c.close;
          let hitTarget = false;
          for (let j = i + 1; j < Math.min(i + 15, candles.length); j++) {
            if (candles[j].low < minAfter) minAfter = candles[j].low;
            // Target is typically s5 (level 9) which is below s4
            if (candles[j].close < s4 - 35) hitTarget = true;
          }
          console.log(`  - Max Downward Extension: ${minAfter} (Move size: ${(c.close - minAfter).toFixed(2)} pts)`);
          console.log(`  - Result: ${hitTarget ? '✅ TARGET HIT' : '❌ CHOPPED / REVERSED'}`);
        }
        
        if (!brokeUp && c.close > r4) {
          brokeUp = true;
          console.log(`🚀 [Breakout Triggered] at ${timeStr}`);
          console.log(`  - Spot Price: ${c.close} (Broke above R3 Resistance ${r4.toFixed(2)})`);
          console.log(`  - Candle Volume: ${c.volume || 0}`);
          
          let maxAfter = c.close;
          let hitTarget = false;
          for (let j = i + 1; j < Math.min(i + 15, candles.length); j++) {
            if (candles[j].high > maxAfter) maxAfter = candles[j].high;
            if (candles[j].close > r4 + 25) hitTarget = true;
          }
          console.log(`  - Max Upward Extension: ${maxAfter} (Move size: ${(maxAfter - c.close).toFixed(2)} pts)`);
          console.log(`  - Result: ${hitTarget ? '✅ TARGET HIT' : '❌ CHOPPED / REVERSED'}`);
        }
      }
    }
  } catch (e) {
    console.error('Error running study:', e);
  }
  process.exit(0);
}

runAnalysis();
