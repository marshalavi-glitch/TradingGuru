const fs = require('fs');
const code = fs.readFileSync('./frontend/node_modules/lightweight-charts/dist/lightweight-charts.development.cjs', 'utf8');

console.log(code.slice(211000, 212200));
