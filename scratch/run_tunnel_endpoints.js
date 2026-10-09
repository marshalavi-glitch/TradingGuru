const fs = require('fs');

async function run() {
  const code = fs.readFileSync('scratch/test_frontend_endpoints.js', 'utf8');
  // replace BASE with cloudflare tunnel
  const replaced = code.replace('http://localhost:3002', 'https://monday-willing-kills-aerial.trycloudflare.com');
  eval(replaced);
}
run();
