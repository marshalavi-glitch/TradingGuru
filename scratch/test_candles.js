(async () => {
  try {
    const res = await fetch('http://localhost:3002/api/candles?symbol=NSE:NIFTY&timeframe=5&limit=5');
    const data = await res.json();
    console.log('API /api/candles response:');
    console.log('Symbol:', data.symbol);
    console.log('Timeframe:', data.timeframe);
    console.log('Source:', data.source);
    console.log('Candles Count:', data.candles ? data.candles.length : 0);
    console.log('Last Candle:', data.candles ? data.candles[data.candles.length - 1] : null);
  } catch (err) {
    console.error('Error fetching candles:', err);
  }
})();
