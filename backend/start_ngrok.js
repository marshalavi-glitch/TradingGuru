import { spawn, execSync } from 'child_process';
import http from 'http';

// 1. Kill existing ngrok processes
try {
  console.log('Killing existing ngrok processes...');
  execSync('taskkill /f /im ngrok.exe', { stdio: 'ignore' });
  console.log('Killed old ngrok processes.');
} catch (e) {
  console.log('No active ngrok processes found to kill.');
}

// 2. Start ngrok http 3002
const ngrokPath = 'C:\\Users\\mihir\\AppData\\Local\\ngrok\\ngrok.exe';
console.log(`Spawning ngrok from: ${ngrokPath}...`);
const ngrokProcess = spawn(ngrokPath, ['http', '3002'], {
  detached: true,
  stdio: 'ignore'
});
ngrokProcess.unref();

// 3. Poll ngrok local API to extract the new public URL
let attempts = 0;
const maxAttempts = 15;

function pollTunnels() {
  attempts++;
  http.get('http://127.0.0.1:4040/api/tunnels', (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      try {
        const json = JSON.parse(data);
        if (json.tunnels && json.tunnels.length > 0) {
          const publicUrl = json.tunnels[0].public_url;
          console.log('\n======================================================');
          console.log(`🚀 NEW NGROK TUNNEL CREATED SUCCESSFULLY!`);
          console.log(`URL: ${publicUrl}`);
          console.log('======================================================\n');
          process.exit(0);
        }
      } catch (e) {
        // incomplete json or parse error
      }
      retry();
    });
  }).on('error', () => {
    retry();
  });
}

function retry() {
  if (attempts >= maxAttempts) {
    console.error('Failed to get new ngrok tunnel URL after multiple attempts.');
    process.exit(1);
  }
  setTimeout(pollTunnels, 1000);
}

// Wait 1 second before first poll
setTimeout(pollTunnels, 1000);
