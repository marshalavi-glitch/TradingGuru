import fs from 'fs';

const log = fs.readFileSync('C:/Users/mihir/.gemini/antigravity/brain/d6077fab-1eb6-4a96-b789-9642c442aeb3/.system_generated/tasks/task-8225.log', 'utf8');
const lines = log.split('\n');

let errorLines = [];
lines.forEach((line, idx) => {
  if (line.toLowerCase().includes('error') || line.toLowerCase().includes('exception') || line.toLowerCase().includes('reject')) {
    errorLines.push(`L${idx + 1}: ${line.trim()}`);
  }
});

console.log(`Total errors: ${errorLines.length}`);
errorLines.slice(0, 100).forEach(l => console.log(l));
