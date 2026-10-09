const fs = require('fs');
const path = require('path');

function checkFile(file) {
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    // If line has `tf` but not `const tf`, `let tf`, `(tf`, `tf:`, `tf.`, `tf =`, `'tf'`, `"tf"`
    const matches = l.match(/\b(tf)\b/g);
    if (matches) {
      if (!l.includes('const tf') && !l.includes('let tf') && !l.includes('var tf') && !l.includes('(tf') && !l.includes('tf =>') && !l.includes('tf:') && !l.includes('tf =') && !l.includes('tf?') && !l.includes("'tf'") && !l.includes('"tf"') && !l.includes('`tf`')) {
        console.log(`${file}:${idx + 1}: ${l.trim()}`);
      }
    }
  });
}

function searchDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = path.join(dir, f);
    const stat = fs.statSync(full);
    if (stat.isDirectory()) {
      searchDir(full);
    } else if (f.endsWith('.tsx') || f.endsWith('.ts')) {
      checkFile(full);
    }
  }
}

searchDir('frontend/src');
