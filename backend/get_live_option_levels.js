import http from 'http';

function getBias(symbol) {
  return new Promise((resolve) => {
    http.get(`http://localhost:3001/api/scanner/opening-bias?symbol=${symbol}`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

async function run() {
  const nifty = await getBias('NSE:NIFTY');
  const bn = await getBias('NSE:BANKNIFTY');
  
  console.log('\n--- NIFTY OPTION PREMIUM LEVELS ---');
  if (nifty && nifty.optionPremiumLevels) {
    console.log(JSON.stringify(nifty.optionPremiumLevels, null, 2));
  } else {
    console.log('Nifty levels not available.');
  }
  
  console.log('\n--- BANKNIFTY OPTION PREMIUM LEVELS ---');
  if (bn && bn.optionPremiumLevels) {
    console.log(JSON.stringify(bn.optionPremiumLevels, null, 2));
  } else {
    console.log('Bank Nifty levels not available.');
  }
}

run();
