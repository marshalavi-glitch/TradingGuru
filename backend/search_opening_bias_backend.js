import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js', 'utf8');
const lines = content.split('\n');

const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('straddleSkew') || line.includes('ceLtp') || line.includes('peLtp') || line.includes('opening-bias')) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches in server.js:');
matches.forEach((m) => {
  console.log(`L${m.lineNum}: ${m.content}`);
});
