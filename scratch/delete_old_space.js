const fs = require('fs');
const env = fs.readFileSync('backend/.env', 'utf8');
const match = env.match(/HF_TOKEN=(.+)/);
const token = match ? match[1].trim() : null;

(async () => {
  try {
    console.log('Sending delete request for old Space: marshalavi/TradingGuru...');
    const res = await fetch('https://huggingface.co/api/repos/delete', {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'space',
        name: 'marshalavi/TradingGuru'
      })
    });
    console.log('Delete status:', res.status);
    const text = await res.text();
    console.log('Delete response:', text);
  } catch (err) {
    console.error('Error deleting space:', err);
  }
})();
