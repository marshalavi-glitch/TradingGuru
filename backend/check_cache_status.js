import fetch from 'node-fetch';

async function check() {
  try {
    const res = await fetch('http://localhost:3002/api/scanner/opening-bias');
    const json = await res.json();
    console.log('NIFTY Straddle Skew (Live Cache Check):');
    console.log(`CE LTP: ${json.nifty?.straddleSkew?.ceLtp}`);
    console.log(`PE LTP: ${json.nifty?.straddleSkew?.peLtp}`);
    console.log(`Total Straddle: ${json.nifty?.straddleSkew?.totalStraddle}`);
    console.log(`Skew Spread: ${json.nifty?.straddleSkew?.skewSpreadPct}%`);
    console.log(`Is Cache Active: ${json.nifty?.straddleSkew?.ceLtp < 100 ? 'YES (Live price returned)' : 'NO (Fallback returned)'}`);
  } catch (e) {
    console.error('Error fetching opening-bias:', e);
  }
}

check();
