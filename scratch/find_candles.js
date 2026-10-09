const fs = require('fs');
const content = fs.readFileSync('backend/server.js', 'utf8');
const lines = content.split('\n');
lines.forEach((l, i) => {
  if (l.includes('/api/candles')) {
    console.log((i+1) + ': ' + l.trim());
  }
});
