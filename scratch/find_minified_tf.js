const fs = require('fs');

const bundle = fs.readFileSync('frontend/dist/assets/index-XDmI-tbZ.js', 'utf8');

// Look for occurrences of `tf` as an identifier
const regex = /([^a-zA-Z0-9_$])tf([^a-zA-Z0-9_$])/g;
let m;
let count = 0;
while ((m = regex.exec(bundle)) !== null) {
  const start = Math.max(0, m.index - 50);
  const end = Math.min(bundle.length, m.index + 50);
  const snippet = bundle.slice(start, end);
  // Filter out where tf is property like .tf or object {tf: or function param (tf
  if (!snippet.includes('.tf') && !snippet.includes('tf:') && !snippet.includes('(tf') && !snippet.includes('tf,')) {
    console.log(`Snippet at ${m.index}: ${snippet}`);
    count++;
    if (count > 20) break;
  }
}
