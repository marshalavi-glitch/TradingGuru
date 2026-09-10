import fs from 'fs';
import path from 'path';

const serverContent = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js', 'utf8');
const lines = serverContent.split('\n');

const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('LTP') || line.includes('ltp') || line.includes('currentOptionPrice') || line.includes('optionSL')) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches in server.js:');
matches.forEach((m) => {
  console.log(`L${m.lineNum}: ${m.content}`);
});
