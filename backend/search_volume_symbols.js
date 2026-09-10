import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/volume_scanner.js', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('symbolsPath') || line.includes('scan_symbols') || line.includes('symbols') || line.includes('allSymbols')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
