import fs from 'fs';
import path from 'path';

const logPath = 'C:/Users/mihir/.gemini/antigravity/brain/72c07760-95ed-49e5-b483-b830a193b22b/.system_generated/tasks/task-942.log';

try {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  console.log(`Total lines in log: ${lines.length}`);
  
  // Find any line containing Error, Exception, or crash
  console.log('\n--- Searching for Errors/Exceptions in log ---');
  let matchCount = 0;
  lines.forEach((line, idx) => {
    if (/error|exception|fail|crash|throw|reject/i.test(line)) {
      matchCount++;
      if (matchCount < 50) {
        console.log(`[Line ${idx + 1}] ${line}`);
      }
    }
  });
  console.log(`Total error-like lines: ${matchCount}`);

  console.log('\n--- Last 50 lines of the log file ---');
  const last50 = lines.slice(-50);
  console.log(last50.join('\n'));

} catch (err) {
  console.error('Failed to read log:', err);
}
