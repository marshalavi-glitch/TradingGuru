import { spawn } from 'child_process';
import fs from 'fs';

console.log('Starting serveo tunnel daemon on port 3001...');

const logFile = 'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/serveo.log';
const urlFile = 'C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data/serveo_url.txt';

// Ensure directories exist
fs.mkdirSync('C:/Users/mihir/.gemini/antigravity/scratch/tradingview-dashboard/backend/data', { recursive: true });

// Kill any previous ssh.exe serveo processes
import { execSync } from 'child_process';
try {
  console.log('Killing old ssh processes...');
  execSync('taskkill /f /im ssh.exe', { stdio: 'ignore' });
} catch (e) {}

// Spawn ssh tunnel pointing to serveo.net
const ssh = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-o', 'ServerAliveInterval=30',
  '-o', 'ServerAliveCountMax=3',
  '-R', '80:127.0.0.1:3001',
  'serveo.net'
]);

const logStream = fs.createWriteStream(logFile, { flags: 'a' });
ssh.stdout.pipe(logStream);
ssh.stderr.pipe(logStream);

ssh.stdout.on('data', (data) => {
  const text = data.toString();
  console.log(`Serveo: ${text.trim()}`);
  
  // Extract URL: e.g. Forwarding HTTP traffic from https://xxxx.serveousercontent.com
  const match = text.match(/https:\/\/[a-zA-Z0-9-]+\.serveo(?:usercontent)?\.com/);
  if (match) {
    const url = match[0];
    fs.writeFileSync(urlFile, url, 'utf8');
    console.log(`Extracted Serveo URL: ${url}`);
  }
});

ssh.on('close', (code) => {
  console.log(`Serveo tunnel exited with code ${code}`);
});

// Keep process running
setInterval(() => {}, 1000);
