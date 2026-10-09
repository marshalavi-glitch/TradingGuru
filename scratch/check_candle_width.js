const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/TestContainer.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('setCandleWidth')) {
    console.log(`L${i + 1}: ${l.trim()}`);
  }
});
