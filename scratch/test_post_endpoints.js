const postEndpoints = [
  '/api/auth/logout-all',
  '/api/auth/record-login',
  '/api/auth/verify',
  '/api/candlestick-patterns/scan',
  '/api/candlestick-patterns/scan-symbol',
  '/api/orderflow/switch',
  '/api/scanner/clear-historical-signals'
];

(async () => {
  const BASE = 'http://localhost:3002';
  for (const ep of postEndpoints) {
    try {
      const res = await fetch(`${BASE}${ep}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      console.log(`[${res.status}] POST ${ep}`);
    } catch (e) {
      console.log(`💥 ERROR ${ep}: ${e.message}`);
    }
  }
})();
