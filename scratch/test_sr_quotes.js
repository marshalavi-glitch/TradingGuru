async function test() {
  const r = await fetch('http://localhost:3002/api/sr-breakouts/live-quotes');
  console.log('Status:', r.status);
  const data = await r.json();
  console.log('Keys:', Object.keys(data));
  console.log('Quotes count:', data.quotes ? Object.keys(data.quotes).length : 0);
}
test().catch(console.error);
