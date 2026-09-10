import fs from 'fs';

const files = [
  'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js',
  'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src/components/BacktestResultsContainer.tsx'
];

files.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, idx) => {
    if (line.includes('81.7') || line.includes('44.3') || line.includes('81.70') || line.includes('44.30')) {
      console.log(`${file.split('/').pop()}:L${idx + 1}: ${line.trim()}`);
    }
  });
});
