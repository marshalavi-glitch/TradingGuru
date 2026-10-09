const fs = require('fs');
const env = fs.readFileSync('backend/.env', 'utf8');
const match = env.match(/HF_TOKEN=(.+)/);
const token = match ? match[1].trim() : null;

(async () => {
  try {
    const whoami = await fetch('https://huggingface.co/api/whoami-v2', {
      headers: { 'Authorization': 'Bearer ' + token }
    });
    const user = await whoami.json();
    fs.writeFileSync('scratch/hf_info.json', JSON.stringify({ user: user.name, auth: whoami.status }, null, 2));
    console.log('Success:', user.name);
  } catch (err) {
    fs.writeFileSync('scratch/hf_info.json', JSON.stringify({ error: err.message }, null, 2));
  }
})();
