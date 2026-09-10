import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';
import fs from 'fs';

async function runAnalysis() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  console.log('Fetching Nifty Spot 5m candles for today...');
  try {
    const spotCandles = await fetchCandlesForSymbol(tvBridge, 'NSE:NIFTY', '5', 60);
    
    // Today's date in local time string formatting
    const todayStr = '17/8/2026';
    const todaySpot = spotCandles.filter(c => {
      const d = new Date(c.time * 1000).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' });
      return d === todayStr;
    }).sort((a, b) => a.time - b.time);
    
    console.log(`Found ${todaySpot.length} spot candles for today.`);
    if (todaySpot.length === 0) {
      console.log('No spot candles found for today yet.');
      process.exit(0);
    }
    
    // We will analyze the ATM strikes: 24300 and 24250 since spot moved from 24360 down to 24230.
    const selectedExpiry = '260818'; // Tomorrow's expiry
    
    const ce300Sym = `NSE:NIFTY${selectedExpiry}C24300`;
    const pe300Sym = `NSE:NIFTY${selectedExpiry}P24300`;
    
    const ce250Sym = `NSE:NIFTY${selectedExpiry}C24250`;
    const pe250Sym = `NSE:NIFTY${selectedExpiry}P24250`;
    
    console.log('Fetching Option candles for ATM strikes...');
    const ce300Candles = await fetchCandlesForSymbol(tvBridge, ce300Sym, '5', 60).catch(() => []);
    const pe300Candles = await fetchCandlesForSymbol(tvBridge, pe300Sym, '5', 60).catch(() => []);
    const ce250Candles = await fetchCandlesForSymbol(tvBridge, ce250Sym, '5', 60).catch(() => []);
    const pe250Candles = await fetchCandlesForSymbol(tvBridge, pe250Sym, '5', 60).catch(() => []);
    
    const ce300Map = new Map(ce300Candles.map(c => [c.time, c]));
    const pe300Map = new Map(pe300Candles.map(c => [c.time, c]));
    const ce250Map = new Map(ce250Candles.map(c => [c.time, c]));
    const pe250Map = new Map(pe250Candles.map(c => [c.time, c]));
    
    const report = [];
    
    todaySpot.forEach(spot => {
      const timeStr = new Date(spot.time * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false });
      
      // Determine ATM strike for this specific candle
      const atmStrike = Math.round(spot.close / 50) * 50;
      
      let ceCandle, peCandle;
      if (atmStrike === 24300) {
        ceCandle = ce300Map.get(spot.time);
        peCandle = pe300Map.get(spot.time);
      } else {
        ceCandle = ce250Map.get(spot.time);
        peCandle = pe250Map.get(spot.time);
      }
      
      const ceLtp = ceCandle ? ceCandle.close : null;
      const peLtp = peCandle ? peCandle.close : null;
      const ceVol = ceCandle ? (ceCandle.volume || 0) : 0;
      const peVol = peCandle ? (peCandle.volume || 0) : 0;
      
      let skew = null;
      let gamma = null;
      if (ceLtp && peLtp) {
        skew = ((ceLtp - peLtp) / (ceLtp + peLtp)) * 100;
        gamma = peVol > 0 ? (ceVol / peVol) : 1.0;
      }
      
      report.push({
        time: timeStr,
        spot: spot.close,
        atmStrike,
        ceLtp,
        peLtp,
        skew,
        gamma,
        ceVol,
        peVol
      });
    });
    
    console.log('\n--- CHRONOLOGICAL REPORT ---');
    console.log('| Time | Nifty Spot | ATM Strike | CE LTP | PE LTP | Skew % | Gamma Ratio |');
    console.log('|---|---|---|---|---|---|---|');
    report.forEach(r => {
      const skewStr = r.skew !== null ? `${r.skew.toFixed(1)}%` : 'N/A';
      const gammaStr = r.gamma !== null ? `${r.gamma.toFixed(2)}x` : 'N/A';
      console.log(`| ${r.time} | ${r.spot.toFixed(2)} | ${r.atmStrike} | ${r.ceLtp || 'N/A'} | ${r.peLtp || 'N/A'} | ${skewStr} | ${gammaStr} |`);
    });
    
    // Save report to file for permanent record
    fs.writeFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/today_gamma_skew_analysis.json', JSON.stringify(report, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

runAnalysis();
