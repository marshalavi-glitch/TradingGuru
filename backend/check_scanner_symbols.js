import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/scanner.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('presets') || line.includes('symbols') || line.includes('allSymbols') || line.includes('FO')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
