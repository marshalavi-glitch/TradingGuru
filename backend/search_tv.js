import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/tradingview.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('subscribeSymbol')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
