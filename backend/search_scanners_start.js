import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('startDojiScanner') || line.includes('startVolumeScanner') || line.includes('scanWeekly200EMA') || line.includes('setInterval') || line.includes('setTimeout')) {
    if (idx > 1300) { // check startup/scheduler area
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  }
});
