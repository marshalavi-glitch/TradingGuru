import { spawn } from 'child_process';

console.log('Starting serveo tunnel on port 3002...');
// Spawn ssh tunnel
const ssh = spawn('ssh', ['-o', 'StrictHostKeyChecking=no', '-R', '80:127.0.0.1:3002', 'serveo.net']);

ssh.stdout.on('data', (data) => {
  console.log(`Serveo output: ${data.toString().trim()}`);
});

ssh.stderr.on('data', (data) => {
  console.error(`Serveo error: ${data.toString().trim()}`);
});

setTimeout(() => {
  console.log('Exiting test...');
  ssh.kill();
  process.exit(0);
}, 10000);
