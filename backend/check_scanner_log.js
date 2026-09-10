import fs from 'fs';

const logPath = 'C:/Users/mihir/.gemini/antigravity/brain/72c07760-95ed-49e5-b483-b830a193b22b/.system_generated/tasks/task-865.log';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log('Last 150 lines of the dev log:');
  console.log(lines.slice(-150).join('\n'));
} catch (err) {
  console.error('Failed to read log:', err);
}
