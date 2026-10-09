const fs = require('fs');
const path = require('path');

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      const content = fs.readFileSync(full, 'utf8');
      const lines = content.split('\n');
      lines.forEach((l, idx) => {
        if (l.includes('filterMarketHoursCandles') || l.includes('isWithinMarketHours')) {
          if (l.includes(', tf') || l.includes(',tf')) {
            console.log(`${f}:${idx + 1}: ${l.trim()}`);
          }
        }
      });
    }
  }
}

searchDir('frontend/src');
