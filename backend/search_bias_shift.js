import fs from 'fs';

const serverContent = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js', 'utf8');
const lines = serverContent.split('\n');

const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('niftyBias.straddleSkew')) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches:');
matches.forEach((m) => {
  console.log(`L${m.lineNum}: ${m.content}`);
});
