import fs from 'fs';
import path from 'path';

const filePath = 'C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/market_learnings.md';
if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf8');
  console.log('File size:', content.length);
  
  // Search for mentions of 5-minute or 5-min or option premium method
  const keywords = ['5-minute', '5-min', 'jipu', 'jaga', 'premium method', 'opening range'];
  for (const kw of keywords) {
    const idx = content.toLowerCase().indexOf(kw.toLowerCase());
    if (idx !== -1) {
      console.log(`Keyword "${kw}" found at index ${idx}`);
      console.log(content.slice(Math.max(0, idx - 100), idx + 500));
      console.log('-------------------');
    } else {
      console.log(`Keyword "${kw}" not found`);
    }
  }
} else {
  console.log('market_learnings.md not found in brain directory.');
}
