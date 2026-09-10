import fetch from 'node-fetch';

async function check() {
  try {
    const res = await fetch('http://localhost:3002/api/scanner/opening-bias');
    const json = await res.json();
    console.log('NIFTY Straddle Skew details:');
    console.log(json.nifty?.straddleSkew);
    console.log('\nBANKNIFTY Straddle Skew details:');
    console.log(json.banknifty?.straddleSkew);
  } catch (e) {
    console.error('Error fetching opening-bias:', e);
  }
}

check();
