import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/confluenceAnalyzer.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('updateConstraintsFromError') || line.includes('constraint')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
