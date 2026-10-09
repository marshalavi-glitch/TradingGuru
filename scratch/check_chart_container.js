const fs = require('fs');
const c = fs.readFileSync('frontend/src/components/ChartContainer.tsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('createChart') || l.includes('ResizeObserver') || l.includes('chartContainerRef')) {
    console.log(`L${i + 1}: ${l.trim().slice(0, 100)}`);
  }
});
