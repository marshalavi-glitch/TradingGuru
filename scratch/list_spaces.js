const fs = require('fs');
const env = fs.readFileSync('backend/.env', 'utf8');
const match = env.match(/HF_TOKEN=(.+)/);
const token = match ? match[1].trim() : null;

(async () => {
  try {
    const res = await fetch('https://huggingface.co/api/spaces?author=marshalavi', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const spaces = await res.json();
    console.log('Spaces found:', spaces.map(s => s.id));
  } catch (err) {
    console.error('Error:', err);
  }
})();
