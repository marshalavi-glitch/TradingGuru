const fs = require('fs');
const path = require('path');

function walk(d) {
  let res = [];
  for (const f of fs.readdirSync(d)) {
    const p = path.join(d, f);
    if (fs.statSync(p).isDirectory()) {
      if (!p.includes('node_modules') && !p.includes('dist')) res.push(...walk(p));
    } else if (p.endsWith('.tsx') || p.endsWith('.ts')) {
      res.push(p);
    }
  }
  return res;
}

for (const f of walk('frontend/src')) {
  const lines = fs.readFileSync(f, 'utf8').split('\n');
  lines.forEach((l, i) => {
    if (l.includes('authUser') || l.includes('isAdmin') || l.includes('currentUser') || l.includes('role') || l.includes('guest') || l.includes('trader')) {
      console.log(f + ':' + (i+1) + ': ' + l.trim());
    }
  });
}
