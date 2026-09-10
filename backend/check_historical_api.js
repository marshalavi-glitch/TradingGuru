import http from 'http';

http.get('http://localhost:3001/api/scanner/historical-signals', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    console.log('Historical signals length:', JSON.parse(data).length);
    console.log('Historical signals data:', JSON.parse(data));
  });
});
