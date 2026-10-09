const fs = require('fs');
const path = require('path');
function search(dir) {
  for (const f of fs.readdirSync(dir)) {
    const full = path.join(dir, f);
    if (fs.statSync(full).isDirectory()) {
      if (!['node_modules', '.git', 'dist'].includes(f)) search(full);
    } else if (/\.(js|ts|tsx|json)$/.test(f)) {
      const c = fs.readFileSync(full, 'utf8');
      if (c.includes('ORDERFLOW LEVELS') || c.includes('Sell reversal') || c.includes('Buy Reversal') || c.includes('Break Down') || c.includes('matrixSeriesData') || c.includes('matrixCalculator')) {
        console.log(full);
      }
    }
  }
}
search('.');
