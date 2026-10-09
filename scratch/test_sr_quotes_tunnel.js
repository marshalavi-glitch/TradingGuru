async function test() {
  const r = await fetch('https://monday-willing-kills-aerial.trycloudflare.com/api/sr-breakouts/live-quotes', {
    headers: { 'bypass-tunnel-reminder': 'true' }
  });
  console.log('Tunnel Status:', r.status);
  const data = await r.json();
  console.log('Quotes count:', data.quotes ? Object.keys(data.quotes).length : 0);
}
test().catch(console.error);
