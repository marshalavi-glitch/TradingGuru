const fs = require('fs');

const code = fs.readFileSync('./frontend/src/components/ChartContainer.tsx', 'utf8');

// Check import of matrixCalculator
console.log('matrixCalculator imports:');
code.split('\n').filter(l => l.includes('matrixCalculator')).forEach(l => console.log(l));
