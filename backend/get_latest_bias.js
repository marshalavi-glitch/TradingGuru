import fetch from 'node-fetch';

async function check() {
  try {
    const res = await fetch('http://localhost:3002/api/scanner/opening-bias');
    const json = await res.json();
    console.log('LATEST NIFTY BIAS DATA:');
    console.log(JSON.stringify(json.nifty, null, 2));
  } catch (e) {
    console.error('Error:', e);
  }
  process.exit(0);
}

check();
