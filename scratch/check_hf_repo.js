import fs from 'fs';
import path from 'path';

async function check() {
  const env = fs.readFileSync('backend/.env', 'utf8');
  const token = env.match(/HF_TOKEN=(.+)/)[1].trim();
  
  const res = await fetch('https://huggingface.co/api/spaces/marshalavi/TradingGuru-Terminal/tree/main', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const data = await res.json();
  console.log('Root tree:', data.map(x => ({ path: x.path, type: x.type })));
  
  // also check assets folder
  const resAssets = await fetch('https://huggingface.co/api/spaces/marshalavi/TradingGuru-Terminal/tree/main/assets', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (resAssets.ok) {
    const assetsData = await resAssets.json();
    console.log('Assets tree:', assetsData.map(x => ({ path: x.path, type: x.type })));
  } else {
    console.log('Assets tree status:', resAssets.status);
  }

  // check space status
  const resSpace = await fetch('https://huggingface.co/api/spaces/marshalavi/TradingGuru-Terminal', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const spaceData = await resSpace.json();
  console.log('Space host:', spaceData.host);
  console.log('Space subdomain:', spaceData.subdomain);
  console.log('Space runtime:', JSON.stringify(spaceData.runtime, null, 2));
}

check().catch(console.error);
