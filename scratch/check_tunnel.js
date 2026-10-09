async function checkTunnel() {
  const tunnelUrl = 'https://monday-willing-kills-aerial.trycloudflare.com';
  try {
    const res = await fetch(`${tunnelUrl}/api/status`);
    console.log('/api/status:', res.status, await res.text());
  } catch (e) {
    console.log('Tunnel error:', e.message);
  }

  try {
    const res2 = await fetch(`${tunnelUrl}/api/candles?symbol=NSE:NIFTY&timeframe=5`);
    console.log('/api/candles status:', res2.status);
    const json = await res2.json();
    console.log('Candles count:', json.candles ? json.candles.length : (Array.isArray(json) ? json.length : json));
    if (json.candles && json.candles.length > 0) {
      console.log('Latest candle:', json.candles[json.candles.length - 1]);
    }
  } catch (e) {
    console.log('Candles error:', e.message);
  }
}
checkTunnel();
