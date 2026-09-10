import { spawn, execSync } from 'child_process';
import fs from 'fs';

console.log('Starting pinggy tunnel daemon on port 3001...');

const logFile = 'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/pinggy.log';
const urlFile = 'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/pinggy_url.txt';

// Ensure directories exist
fs.mkdirSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data', { recursive: true });

// Kill any previous ssh.exe pinggy/serveo processes
try {
  console.log('Killing old ssh processes...');
  execSync('taskkill /f /im ssh.exe', { stdio: 'ignore' });
} catch (e) {}

// Spawn ssh tunnel pointing to pinggy
const ssh = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=3',
  '-p', '443',
  '-R', '0:127.0.0.1:3001',
  'a.pinggy.io'
]);

const logStream = fs.createWriteStream(logFile, { flags: 'a' });
ssh.stdout.pipe(logStream);
ssh.stderr.pipe(logStream);

ssh.stdout.on('data', (data) => {
  const text = data.toString();
  console.log(`Pinggy: ${text.trim()}`);
  
  // Extract URL: e.g. https://xxxx.free.pinggy.net
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.free\.pinggy\.net/);
  if (match) {
    const url = match[0];
    fs.writeFileSync(urlFile, url, 'utf8');
    console.log(`Extracted Pinggy URL: ${url}`);
  }
});

ssh.on('close', (code) => {
  console.log(`Pinggy tunnel exited with code ${code}`);
});

// Keep process running
setInterval(() => {}, 1000);
