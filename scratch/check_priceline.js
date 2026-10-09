const fs = require('fs');
const content = fs.readFileSync('frontend/node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js', 'utf8');
const idx = content.indexOf('createPriceLine');
console.log('createPriceLine definition:');
console.log(content.slice(Math.max(0, idx - 100), Math.min(content.length, idx + 400)));
