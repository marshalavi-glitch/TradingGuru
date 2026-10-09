async function main() {
  const start = Date.now();
  console.log('Fetching opening-bias...');
  try {
    const r = await fetch('http://localhost:3002/api/scanner/opening-bias', { signal: AbortSignal.timeout(8000) });
    const d = await r.json();
    console.log('SUCCESS in', Date.now() - start, 'ms. Keys:', Object.keys(d));
  } catch (e) {
    console.log('ERROR in', Date.now() - start, 'ms:', e.message);
  }
}
main();
