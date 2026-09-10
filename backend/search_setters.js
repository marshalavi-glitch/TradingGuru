import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src/components/BacktestResultsContainer.tsx', 'utf8');
const lines = content.split('\n');

const matches = [];
lines.forEach((line, idx) => {
  if (line.includes('setNiftyCeLtp') || line.includes('setNiftyPeLtp') || line.includes('setBankCeLtp') || line.includes('setBankPeLtp')) {
    matches.push({ lineNum: idx + 1, content: line.trim() });
  }
});

console.log('Matches:');
matches.forEach((m) => {
  console.log(`L${m.lineNum}: ${m.content}`);
});
