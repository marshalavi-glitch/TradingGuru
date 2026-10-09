const fs = require('fs');

// Check lightweight charts development code for autoscaleInfoProvider invocation
const code = fs.readFileSync('./frontend/node_modules/lightweight-charts/dist/lightweight-charts.development.cjs', 'utf8');

const regex = /autoscaleInfoProvider/g;
let match;
while ((match = regex.exec(code)) !== null) {
  console.log('Match at index:', match.index);
  console.log(code.slice(match.index - 50, match.index + 200));
  console.log('-------------------');
}
