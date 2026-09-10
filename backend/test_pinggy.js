import { spawn } from 'child_process';

console.log('Starting pinggy tunnel on port 3002...');
// Spawn ssh tunnel pointing to pinggy
const ssh = spawn('ssh', [
  '-o', 'StrictHostKeyChecking=no',
  '-p', '443',
  '-R', '0:127.0.0.1:3002',
  'a.pinggy.io'
]);

ssh.stdout.on('data', (data) => {
  console.log(`Pinggy stdout: ${data.toString().trim()}`);
});

ssh.stderr.on('data', (data) => {
  console.error(`Pinggy stderr: ${data.toString().trim()}`);
});

setTimeout(() => {
  console.log('Exiting test...');
  ssh.kill();
  process.exit(0);
}, 10000);
