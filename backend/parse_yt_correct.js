import fs from 'fs';
import path from 'path';

const filePath = 'C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/.system_generated/steps/7420/content.md';
const content = fs.readFileSync(filePath, 'utf8');

const responseIndex = content.indexOf('ytInitialPlayerResponse =');
if (responseIndex !== -1) {
  const chunk = content.slice(responseIndex, responseIndex + 15000);
  
  // Find where it starts and ends
  // ytInitialPlayerResponse = { ... };
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
        console.log('Parsed successfully!');
        console.log('Keys of parsed object:', Object.keys(parsed));
        if (parsed.videoDetails) {
          console.log('Title:', parsed.videoDetails.title);
          console.log('Author:', parsed.videoDetails.author);
          console.log('Short Description:', parsed.videoDetails.shortDescription ? parsed.videoDetails.shortDescription.slice(0, 500) : 'None');
        } else {
          console.log('videoDetails not present. keys:', Object.keys(parsed));
        }
        if (parsed.microformat && parsed.microformat.playerMicroformatRenderer) {
          console.log('Microformat Title:', parsed.microformat.playerMicroformatRenderer.title?.simpleText);
          console.log('Microformat Desc:', parsed.microformat.playerMicroformatRenderer.description?.simpleText?.slice(0, 500));
        }
      } catch (e) {
        console.log('JSON parse failed:', e.message);
        console.log('Substring of failed JSON string:', jsonStr.slice(0, 1000));
      }
    } else {
      console.log('Could not find matching closing brace.');
    }
  }
} else {
  console.log('ytInitialPlayerResponse not found.');
}
