import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js', 'utf8');
const lines = content.split('\n');

const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('scannerCache') && (line.includes('require') || line.includes('import') || line.includes('let') || line.includes('const') || line.includes('var'))) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches:');
matches.forEach((m) => {
  console.log(`L${m.lineNum}: ${m.content}`);
});
