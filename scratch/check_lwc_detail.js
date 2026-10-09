const fs = require('fs');
const content = fs.readFileSync('frontend/node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js', 'utf8');
const idx = content.indexOf('utm_medium=lwc-link');
console.log(content.slice(Math.max(0, idx - 400), Math.min(content.length, idx + 400)));
