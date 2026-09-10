import fs from 'fs';
import path from 'path';

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
      }
    }
  });
}

searchDir('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src', 'PRE-MOVE CONFIDENCE');
searchDir('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src', 'NOISE ALERT ACTIVE');
searchDir('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/frontend/src', 'Option Entry Zone');
