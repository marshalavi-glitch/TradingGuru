import localtunnel from 'localtunnel';

console.log('Starting localtunnel daemon on port 3002 with subdomain profundum...');

async function startTunnel() {
  try {
    const tunnel = await localtunnel({ port: 3002, subdomain: 'profundum' });
    console.log(`Localtunnel active link: ${tunnel.url}`);

    tunnel.on('close', () => {
      console.log('Localtunnel closed. Reconnecting...');
      setTimeout(startTunnel, 3000);
    });

    tunnel.on('error', (err) => {
      console.error(`Localtunnel error: ${err.message}`);
    });
  } catch (err) {
    console.error(`Failed to start localtunnel: ${err.message}`);
    setTimeout(startTunnel, 5000);
  }
}

startTunnel();

// Keep process running
setInterval(() => {}, 1000);

