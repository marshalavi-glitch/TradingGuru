import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';

async function test() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  try {
    const candles = await fetchCandlesForSymbol(tvBridge, 'NSE:NIFTY', '5', 100);
    const sorted = [...candles].sort((a, b) => a.time - b.time);
    
    // Find the 09:15 candle for the most recent day in the dataset
    // We can group candles by date in IST and find the first candle of the most recent day
    const candlesByDate = {};
    sorted.forEach(c => {
      const date = new Date(c.time * 1000);
      const dateStr = date.toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      if (!candlesByDate[dateStr]) candlesByDate[dateStr] = [];
      candlesByDate[dateStr].push(c);
    });
    
    // Get the most recent date
    const dates = Object.keys(candlesByDate);
    const mostRecentDate = dates[dates.length - 1];
    const dayCandles = candlesByDate[mostRecentDate];
    
    console.log(`Analyzing most recent day: ${mostRecentDate}`);
    
    // Find the 09:15 candle
    const firstCandle = dayCandles.find(c => {
      const timeStr = new Date(c.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
      return timeStr.startsWith('09:15');
    });
    
    if (firstCandle) {
      console.log('Found 1st 5-Min Candle:');
      console.log(`O: ${firstCandle.open}, H: ${firstCandle.high}, L: ${firstCandle.low}, C: ${firstCandle.close}`);
      
      const open = firstCandle.open;
      const high = firstCandle.high;
      const low = firstCandle.low;
      
      // Calculate CE and PE strikes
      const interval = 50;
      const ceStrike = Math.round((open - 100) / interval) * interval;
      const peStrike = Math.round((open + 100) / interval) * interval;
      
      // Calculate levels
      const ceLevel = parseFloat((low - ceStrike).toFixed(2));
      const peLevel = parseFloat((peStrike - high).toFixed(2));
      
      console.log(`\n--- 1st 5-Min Option Premium Levels ---`);
      console.log(`Underlying Open: ${open}`);
      console.log(`Selected CE Strike (ITM): ${ceStrike} CE (Level: ${ceLevel})`);
      console.log(`Selected PE Strike (ITM): ${peStrike} PE (Level: ${peLevel})`);
    } else {
      console.log('09:15 candle not found for most recent day.');
    }
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

test();
