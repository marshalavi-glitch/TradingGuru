import fs from 'fs';

const scannerContent = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/scanner.js', 'utf8');
const lines = scannerContent.split('\n');

const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('fetchCandlesForSymbol')) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches in scanner.js:');
matches.forEach((m) => {
  console.log(`L${m.lineNum}: ${m.content}`);
});
