const fs = require('fs');

// Verify that priceScale.applyOptions({ autoScale: true }) recalculates price range
const code = fs.readFileSync('./frontend/node_modules/lightweight-charts/dist/lightweight-charts.development.cjs', 'utf8');

const applyOptionsPos = code.indexOf('applyOptions(options) {');
console.log('applyOptions in code:');
console.log(code.slice(applyOptionsPos, applyOptionsPos + 600));
