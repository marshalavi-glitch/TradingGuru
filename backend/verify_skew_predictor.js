import fs from 'fs';
import path from 'path';

const logPath = 'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/live_market_learnings.json';

if (!fs.existsSync(logPath)) {
  console.log('Learnings file not found.');
  process.exit(1);
}

const logs = JSON.parse(fs.readFileSync(logPath, 'utf8'));

// Group logs by date
const logsByDate = {};
logs.forEach(log => {
  if (!logsByDate[log.date]) logsByDate[log.date] = [];
  logsByDate[log.date].push(log);
});

console.log(`Analyzing Skew Drift for ${Object.keys(logsByDate).length} logged days...\n`);

Object.entries(logsByDate).forEach(([dateStr, dayLogs]) => {
  // Sort by time
  dayLogs.sort((a, b) => a.time.localeCompare(b.time));
  
  // Find first logged spot price of the day (near open)
  const openLog = dayLogs[0];
  const openPrice = openLog.niftySpot;
  
  // Find 9:20 AM or 9:30 AM log to check skew
  // We will find the log closest to 09:25:00
  const checkLog = dayLogs.find(l => l.time >= '09:25:00' && l.time <= '09:30:00') || dayLogs[Math.floor(dayLogs.length * 0.1)];
  const earlySkew = checkLog ? checkLog.niftySkew : 0;
  
  // Find the high and low of the day after 9:30 AM
  let maxSpot = openPrice;
  let minSpot = openPrice;
  let finalSpot = openPrice;
  
  dayLogs.forEach(l => {
    if (l.time > '09:30:00') {
      if (l.niftySpot > maxSpot) maxSpot = l.niftySpot;
      if (l.niftySpot < minSpot) minSpot = l.niftySpot;
      finalSpot = l.niftySpot;
    }
  });
  
  const upMove = maxSpot - openPrice;
  const downMove = openPrice - minSpot;
  const netMove = finalSpot - openPrice;
  
  console.log(`📅 Date: ${dateStr}`);
  console.log(`  - 09:20 Spot: ${openPrice.toFixed(2)}`);
  console.log(`  - Early Nifty Skew (09:25-09:30): ${earlySkew.toFixed(1)}%`);
  console.log(`  - Max Intraday Upside Move: +${upMove.toFixed(2)} pts`);
  console.log(`  - Max Intraday Downside Move: -${downMove.toFixed(2)} pts`);
  console.log(`  - Net Day Move: ${netMove >= 0 ? '+' : ''}${netMove.toFixed(2)} pts`);
  
  // Predictor verification
  const isSkewBullish = earlySkew > 10.0;
  const isSkewBearish = earlySkew < -10.0;
  
  let prediction = 'NEUTRAL (Range)';
  if (isSkewBullish) prediction = 'BULLISH';
  if (isSkewBearish) prediction = 'BEARISH';
  
  let result = 'UNCONFIRMED';
  if (isSkewBullish && netMove > 10) result = 'CORRECT (Rallied)';
  else if (isSkewBullish && netMove <= 10) result = 'FAILED (Failed to Rally)';
  else if (isSkewBearish && netMove < -10) result = 'CORRECT (Dropped)';
  else if (isSkewBearish && netMove >= -10) result = 'FAILED (Failed to Drop)';
  else if (!isSkewBullish && !isSkewBearish && Math.abs(netMove) < 30) result = 'CORRECT (Range Bound)';
  else result = 'FAILED (Trended unexpectedly)';
  
  console.log(`  - 🎯 Prediction: ${prediction} | Result: ${result}\n`);
});

process.exit(0);
