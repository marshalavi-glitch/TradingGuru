const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/TestingContainer.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, idx) => {
  if (l.includes('tf')) {
    console.log(`L${idx + 1}: ${l.trim()}`);
  }
});
