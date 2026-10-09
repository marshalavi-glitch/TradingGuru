const WebSocket = require('ws');

const ws = new WebSocket('ws://localhost:3002');

ws.on('open', () => {
  console.log('Connected to ws://localhost:3002');
  ws.send(JSON.stringify({ type: 'subscribe', symbol: 'NSE:NIFTY', timeframe: '5' }));
});

ws.on('message', (data) => {
  const msg = JSON.parse(data.toString());
  console.log('WS msg received type:', msg.type, 'candles:', (msg.candles || []).length, 'candle:', msg.candle ? 'yes' : 'no');
  setTimeout(() => {
    ws.close();
    process.exit(0);
  }, 2000);
});

ws.on('error', (err) => {
  console.log('WS error:', err.message);
  process.exit(1);
});

setTimeout(() => {
  console.log('WS timeout after 10s');
  process.exit(1);
}, 10000);
