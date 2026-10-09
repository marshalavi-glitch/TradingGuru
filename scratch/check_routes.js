const fs = require('fs');
const content = fs.readFileSync('backend/server.js', 'utf8');
const lines = content.split('\n');
console.log('Total lines in server.js:', lines.length);

const keywords = ['doji', '3day', 'mp-', 'orderflow', 'option', 'chain', 'profile'];
lines.forEach((line, idx) => {
  if (line.includes('app.get') || line.includes('app.post') || line.includes('app.use')) {
    const lower = line.toLowerCase();
    if (keywords.some(k => lower.includes(k))) {
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  }
});
