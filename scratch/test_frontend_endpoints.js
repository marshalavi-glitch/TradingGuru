const fs = require('fs');
const path = require('path');

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat && stat.isDirectory()) {
      results = results.concat(getFiles(fullPath));
    } else if (file.endsWith('.ts') || file.endsWith('.tsx') || file.endsWith('.js')) {
      results.push(fullPath);
    }
  });
  return results;
}

const frontendFiles = getFiles('frontend/src');
const apiPaths = new Set();

frontendFiles.forEach(file => {
  const content = fs.readFileSync(file, 'utf8');
  // Match /api/... inside strings or template literals
  const regex = /\/api\/[a-zA-Z0-9_\-\/]+/g;
  let m;
  while ((m = regex.exec(content)) !== null) {
    apiPaths.add(m[0]);
  }
});

console.log('Discovered API endpoints in frontend/src:', Array.from(apiPaths).sort());

(async () => {
  const BASE = 'http://localhost:3002';
  for (const ep of Array.from(apiPaths).sort()) {
    try {
      const res = await fetch(`${BASE}${ep}`);
      if (res.status === 404) {
        console.log(`❌ 404 NOT FOUND: ${ep}`);
      } else {
        console.log(`✅ OK (${res.status}): ${ep}`);
      }
    } catch (e) {
      console.log(`💥 ERROR ${ep}: ${e.message}`);
    }
  }
})();
