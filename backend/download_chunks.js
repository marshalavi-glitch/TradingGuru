import fs from 'fs';
import https from 'https';

const chunks = [
  '/_next/static/chunks/66a8c16702b8a250.js',
  '/_next/static/chunks/1a28dbab76f5085d.js',
  '/_next/static/chunks/0cf0476fc314f1a2.js',
  '/_next/static/chunks/77e20afd0aa65abc.js',
  '/_next/static/chunks/236f7e5abd6f09ff.js',
  '/_next/static/chunks/turbopack-ff4b249ac2295268.js',
  '/_next/static/chunks/ff1a16fafef87110.js',
  '/_next/static/chunks/7340adf74ff47ec0.js',
  '/_next/static/chunks/b67db2cc87801140.js',
  '/_next/static/chunks/a6fff54ec4c03273.js',
  '/_next/static/chunks/588f3588b7ca55db.js',
  '/_next/static/chunks/4f9aea65e9c476ff.js',
  '/_next/static/chunks/3e079659064b7825.js',
  '/_next/static/chunks/a6dad97d9634a72d.js'
];

function downloadAndSearch(chunkPath) {
  return new Promise((resolve) => {
    const url = 'https://youtubetranscript.pro' + chunkPath;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        console.log(`Downloaded ${chunkPath} (${data.length} bytes)`);
        
        // Search for "/api/" or "api/" or endpoints
        const regex = /"\/api\/[a-zA-Z0-9_/.-]+"/g;
        let match;
        const found = [];
        while ((match = regex.exec(data)) !== null) {
          found.push(match[0]);
        }
        
        // Search for fetch requests
        const fetchRegex = /fetch\([^)]+\)/g;
        const fetchMatches = [];
        while ((match = fetchRegex.exec(data)) !== null) {
          fetchMatches.push(match[0]);
        }
        
        resolve({ chunkPath, found, fetchMatches: fetchMatches.slice(0, 10) });
      });
    }).on('error', (e) => {
      resolve({ chunkPath, error: e.message });
    });
  });
}

async function run() {
  for (const chunk of chunks) {
    const result = await downloadAndSearch(chunk);
    if (result.found && result.found.length > 0) {
      console.log(`Found APIs in ${result.chunkPath}:`, result.found);
    }
    if (result.fetchMatches && result.fetchMatches.length > 0) {
      console.log(`Found fetch calls in ${result.chunkPath}:`, result.fetchMatches);
    }
  }
}

run();
