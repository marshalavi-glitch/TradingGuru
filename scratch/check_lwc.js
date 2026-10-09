const fs = require('fs');
const content = fs.readFileSync('frontend/node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.js', 'utf8');
console.log('Contains tradingview link:', content.includes('tradingview.com'));
const matches = content.match(/https?:\/\/[^\s"'`)]*tradingview[^\s"'`)]*/gi);
console.log('URL Matches:', matches);
