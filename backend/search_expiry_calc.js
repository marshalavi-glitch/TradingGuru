import fs from 'fs';

const scannerContent = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/scanner.js', 'utf8');
const scannerLines = scannerContent.split('\n');

scannerLines.forEach((line, idx) => {
  if (line.includes('expiry') || line.includes('getExpiries') || line.includes('findClosestValidOptionSymbol')) {
    console.log(`scanner.js L${idx + 1}: ${line.trim()}`);
  }
});

const serverContent = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/server.js', 'utf8');
const serverLines = serverContent.split('\n');

serverLines.forEach((line, idx) => {
  if (line.includes('expiry') || line.includes('Strike') || line.includes('ceSymbol')) {
    if (idx > 700 && idx < 950) {
      console.log(`server.js L${idx + 1}: ${line.trim()}`);
    }
  }
});
