import fs from 'fs';

const files = [
  'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js',
  'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/scanner.js'
];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('subscribeSymbol')) {
      console.log(`${file.split('/').pop()}:L${idx + 1}: ${line.trim()}`);
    }
  });
});
