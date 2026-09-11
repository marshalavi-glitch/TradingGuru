import WebSocket from 'ws';

async function main() {
  const url = 'https://dee-before-railroad-dining.trycloudflare.com';
  console.log('Testing HTTP /health on:', url);
  try {
    const res = await fetch(`${url}/health`);
    console.log('HTTP STATUS:', res.status);
    const json = await res.json();
    console.log('HTTP RESPONSE:', json);
  } catch (e) {
    console.error('HTTP ERROR:', e.message);
  }

  const wsUrl = 'wss://dee-before-railroad-dining.trycloudflare.com/ws';
  console.log('\nTesting WebSocket connection on:', wsUrl);
  const ws = new WebSocket(wsUrl);

  ws.on('open', () => {
    console.log('🎉 WebSocket CONNECTED successfully!');
    ws.send(JSON.stringify({ type: 'subscribe', symbol: 'NSE:NIFTY', timeframe: '5' }));
  });

  ws.on('message', (data) => {
    console.log('🎉 WebSocket RECEIVED DATA:', data.toString().substring(0, 150));
    ws.close();
    process.exit(0);
  });

  ws.on('error', (err) => {
    console.error('❌ WebSocket ERROR:', err.message);
    process.exit(1);
  });

  setTimeout(() => {
    console.error('❌ WebSocket TIMEOUT after 10s');
    process.exit(1);
  }, 10000);
}

main();
