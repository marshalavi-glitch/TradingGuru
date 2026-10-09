const fs = require('fs');
const path = require('path');

const dir = 'frontend/src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));
const endpoints = {};

files.forEach(f => {
  const content = fs.readFileSync(path.join(dir, f), 'utf8');
  const lines = content.split('\n');
  const fetches = [];
  lines.forEach((line, idx) => {
    if (line.includes('fetch(') || line.includes('fetch (`')) {
      fetches.push({ line: idx + 1, text: line.trim() });
    }
  });
  if (fetches.length > 0) {
    endpoints[f] = fetches;
  }
});

console.log(JSON.stringify(endpoints, null, 2));
