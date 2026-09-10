import fs from 'fs';

const serverContent = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js', 'utf8');

// Find all routes or functions
const lines = serverContent.split('\n');
console.log('Total lines in server.js:', lines.length);

// Search for keywords
const keywords = ['levels', '5-min', 'bias', 'fetchBias', 'atmStrike', 'calculateStraddle'];
for (const kw of keywords) {
  const matches = [];
  lines.forEach((line, idx) => {
    if (line.includes(kw)) {
      matches.push({ lineNum: idx + 1, content: line.trim() });
    }
  });
  console.log(`\nMatches for "${kw}" (${matches.length} found):`);
  matches.slice(0, 15).forEach((m) => {
    console.log(`L${m.lineNum}: ${m.content}`);
  });
}
