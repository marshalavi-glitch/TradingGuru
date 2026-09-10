import fs from 'fs';
import path from 'path';

const logPath = 'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/live_market_learnings.json';

if (fs.existsSync(logPath)) {
  try {
    const rawData = fs.readFileSync(logPath, 'utf8');
    const logs = JSON.parse(rawData);
    console.log(`Total data points in live_market_learnings.json: ${logs.length}`);
    
    // Group logs by date
    const logsByDate = {};
    logs.forEach(log => {
      if (!logsByDate[log.date]) logsByDate[log.date] = [];
      logsByDate[log.date].push(log);
    });
    
    const dates = Object.keys(logsByDate);
    console.log(`Total days logged: ${dates.length}`);
    console.log('Sample dates:', dates.slice(0, 10), '...', dates.slice(-5));
    
    // Inspect a single log entry format
    console.log('\nSample log entry:', JSON.stringify(logs[0], null, 2));
  } catch (err) {
    console.error('Error parsing learnings file:', err);
  }
} else {
  console.log('Learnings file does not exist.');
}
