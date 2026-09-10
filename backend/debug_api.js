import http from 'http';

http.get('http://localhost:3001/api/scanner/opening-bias?symbol=NSE:NIFTY', (res) => {
  console.log('Status Code:', res.statusCode);
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Raw Data length:', data.length);
    console.log('Raw Data:', data);
  });
}).on('error', (err) => {
  console.error('HTTP Error:', err.message);
});
