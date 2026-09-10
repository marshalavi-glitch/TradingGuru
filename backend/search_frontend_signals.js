import fs from 'fs';
import path from 'path';

// Recursively find files in src
function searchDir(dir, query) {
  const files = fs.readdirSync(dir);
  files.forEach(file => {
    const fullPath = path.join(dir, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      searchDir(fullPath, query);
    } else if (file.endsWith('.tsx') || file.endsWith('.ts')) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (content.includes(query)) {
        console.log(`Found in ${fullPath}`);
        // Print lines containing query
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          if (line.includes(query)) {
            console.log(`  L${idx+1}: ${line.trim()}`);
          }
        });
      }
    }
  });
}

searchDir('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src', 'LTP');
searchDir('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src', 'Option Entry Zone');
searchDir('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src', 'SignalsContainer');
