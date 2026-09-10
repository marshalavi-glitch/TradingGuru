import fs from 'fs';

const filePath = 'C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/.system_generated/steps/7564/content.md';
const content = fs.readFileSync(filePath, 'utf8');

// Find all script tags or next.js client chunks
const scriptMatches = content.match(/\/libs\/|\/_next\/static\/chunks\/[^"]+\.js/g);
console.log('Script matches:', scriptMatches);

// Find any api endpoints
const apiMatches = content.match(/\/api\/[a-zA-Z0-9_-]+/g);
console.log('API matches in HTML:', apiMatches);

// Check if there is any string matching "api/" or "/api"
const regex = /\/api\/[a-zA-Z0-9_/.-]+/g;
let match;
const allApis = new Set();
while ((match = regex.exec(content)) !== null) {
  allApis.add(match[0]);
}
console.log('All API-like patterns:', Array.from(allApis));
