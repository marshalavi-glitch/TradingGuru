import fs from 'fs';

const log = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/.system_generated/tasks/task-8225.log', 'utf8');
const lines = log.split('\n');

let count = 0;
lines.forEach((line, idx) => {
  if (line.includes('[LTP Stream]') && (line.includes('Subscribing') || line.includes('Error') || line.includes('Active'))) {
    count++;
    if (count < 100) {
      console.log(`L${idx + 1}: ${line.trim()}`);
    }
  }
});
console.log(`Total matching lines: ${count}`);
