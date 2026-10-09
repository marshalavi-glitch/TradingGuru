const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/TestContainer.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (/ladder|statistic|table|delta|cvd|canvas|render|sync/i.test(l)) {
    if (l.includes('<canvas') || l.includes('stats') || l.includes('Ladder') || l.includes('footer') || l.includes('Bottom')) {
      console.log(`L${i + 1}: ${l.trim().slice(0, 100)}`);
    }
  }
});
