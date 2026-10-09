const fs = require('fs');
const content = fs.readFileSync('frontend/src/components/TestContainer.tsx', 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('LEFT_GUTTER_WIDTH') || l.includes('RIGHT_GUTTER_WIDTH') || l.includes('RIGHT_SCROLL_PAD')) {
    console.log(`L${i + 1}: ${l.trim()}`);
  }
});
