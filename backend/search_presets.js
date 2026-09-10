import fs from 'fs';
import path from 'path';

const presetsPath = 'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/presets.json';

if (fs.existsSync(presetsPath)) {
  const presets = JSON.parse(fs.readFileSync(presetsPath, 'utf8'));
  const matches = presets.filter(p => p.symbol && (p.symbol.includes('FINNIFTY') || p.symbol.includes('CNX') || p.symbol.includes('FIN')));
  console.log(`Found ${matches.length} matches:`);
  matches.forEach(m => console.log(m));
} else {
  console.log('Presets file not found.');
}
