import fs from 'fs';

const filePath = 'C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/.system_generated/steps/7420/content.md';
const content = fs.readFileSync(filePath, 'utf8');

// Print all text matches for "title" or "channel" or "owner" or "author"
console.log('Searching for title patterns...');

const matches = [];
const regex = /"title"\s*:\s*\{[^}]+\}/g;
let match;
while ((match = regex.exec(content)) !== null) {
  matches.push(match[0]);
  if (matches.length > 10) break;
}
console.log('Title JSON objects:', matches);

// Search for any meta tags
const metaTags = content.match(/<meta[^>]+>/g);
if (metaTags) {
  console.log('Found meta tags:', metaTags.filter(t => t.includes('title') || t.includes('desc') || t.includes('name')));
}

// Find any scripts containing ytInitialData or ytInitialPlayerResponse
console.log('File length:', content.length);
