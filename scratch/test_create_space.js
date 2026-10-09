const fs = require('fs');
const env = fs.readFileSync('backend/.env', 'utf8');
const match = env.match(/HF_TOKEN=(.+)/);
const token = match ? match[1].trim() : null;

(async () => {
  try {
    const res = await fetch('https://huggingface.co/api/repos/create', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        type: 'space',
        name: 'TradingGuru-Terminal',
        sdk: 'static',
        private: false
      })
    });
    const data = await res.json();
    console.log('Create Space response status:', res.status, data);
  } catch (err) {
    console.error('Error creating space:', err);
  }
})();
