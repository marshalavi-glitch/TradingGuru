

async function test() {
  console.log('Sending request to opening-bias endpoint...');
  try {
    const res = await fetch('http://localhost:3002/api/scanner/opening-bias');
    const data = await res.json();
    console.log('Endpoint responded with status:', res.status);
    console.log('Timestamp:', data.timestamp);
    console.log('NIFTY Option Premium Levels:');
    console.log(JSON.stringify(data.nifty?.optionPremiumLevels, null, 2));
    console.log('BANKNIFTY Option Premium Levels:');
    console.log(JSON.stringify(data.banknifty?.optionPremiumLevels, null, 2));
  } catch (e) {
    console.error('Failed to query endpoint:', e.message);
  }
}

test();
