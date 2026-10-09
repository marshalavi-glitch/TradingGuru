const fs = require('fs');
const env = fs.readFileSync('backend/.env', 'utf8');
const match = env.match(/HF_TOKEN=(.+)/);
const token = match ? match[1].trim() : null;

(async () => {
  // Test 1: name without org
  const r1 = await fetch('https://huggingface.co/api/repos/delete', {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'space', name: 'TradingGuru' })
  });
  console.log('Test 1 (name: TradingGuru):', r1.status, await r1.text());

  // Test 2: direct DELETE /api/spaces/marshalavi/TradingGuru
  const r2 = await fetch('https://huggingface.co/api/spaces/marshalavi/TradingGuru', {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token }
  });
  console.log('Test 2 (DELETE /api/spaces/...):', r2.status, await r2.text());
})();
