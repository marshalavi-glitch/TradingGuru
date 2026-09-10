import fs from 'fs';

const content = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src/utils/tvStreamer.ts', 'utf8');
const lines = content.split('\n');

lines.forEach((line, idx) => {
  if (line.includes('ws') || line.includes('socket') || line.includes('WebSocket') || line.includes('connect') || line.includes('url') || line.includes('localhost')) {
    console.log(`L${idx + 1}: ${line.trim()}`);
  }
});
