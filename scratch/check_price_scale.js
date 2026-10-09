const fs = require('fs');
const dts = fs.readFileSync('./frontend/node_modules/lightweight-charts/dist/typings.d.ts', 'utf8');

// Search for priceScale methods or autoscaleInfoProvider
function search(term) {
  let idx = 0;
  while ((idx = dts.indexOf(term, idx)) !== -1) {
    console.log(`=== Found '${term}' at ${idx} ===`);
    console.log(dts.slice(Math.max(0, idx - 50), idx + 250));
    idx += term.length;
  }
}

search('autoscaleInfoProvider');
search('scaleMargins');
