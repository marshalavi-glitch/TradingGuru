import fs from 'fs';

const filePath = 'C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/.system_generated/steps/7420/content.md';
const content = fs.readFileSync(filePath, 'utf8');

const responseIndex = content.indexOf('ytInitialPlayerResponse =');
if (responseIndex !== -1) {
  const chunk = content.slice(responseIndex, responseIndex + 15000);
  const startIndex = chunk.indexOf('{');
  if (startIndex !== -1) {
    let braceCount = 0;
    let endIndex = -1;
    for (let i = startIndex; i < chunk.length; i++) {
      if (chunk[i] === '{') braceCount++;
      else if (chunk[i] === '}') {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i;
          break;
        }
      }
    }
    if (endIndex !== -1) {
      const jsonStr = chunk.slice(startIndex, endIndex + 1);
      try {
        const parsed = JSON.parse(jsonStr);
        console.log('Playability Status:', parsed.playabilityStatus);
      } catch (e) {
        console.log('JSON parse failed:', e.message);
      }
    }
  }
}
