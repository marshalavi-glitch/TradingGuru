const fs = require('fs');
const content = fs.readFileSync('frontend/src/App.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('TabErrorBoundary')) {
    console.log(`L${i + 1}: ${l.trim()}`);
  }
});
