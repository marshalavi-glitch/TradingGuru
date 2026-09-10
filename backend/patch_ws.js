import WebSocket from 'ws';
globalThis.WebSocket = WebSocket;
console.log('[WebSocket Patch] Overrode native globalThis.WebSocket with ws package');
