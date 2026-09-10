import http from 'http';

http.get('http://localhost:3001/api/scanner/opening-bias', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    try {
      const json = JSON.parse(data);
      console.log('NIFTY details:', JSON.stringify(json.nifty, null, 2));
    } catch (e) {
      console.error('Parse error:', e.message);
    }
  });
}).on('error', (err) => {
  console.error('API request failed:', err.message);
});
