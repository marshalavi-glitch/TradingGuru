import http from 'http';

function getUrl(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        resolve(data);
      });
    }).on('error', reject);
  });
}

async function main() {
  try {
    const raw = await getUrl('http://localhost:3001/api/scanner/opening-bias');
    const json = JSON.parse(raw);
    console.log('NIFTY Open Premium Levels:', json.nifty?.optionPremiumLevels);
    console.log('BANKNIFTY Open Premium Levels:', json.banknifty?.optionPremiumLevels);
    console.log('Full JSON keys:', Object.keys(json));
  } catch (err) {
    console.error('Error:', err.message);
  }
}
main();
