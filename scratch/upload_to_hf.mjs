import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '../backend/.env');
let hfToken = process.env.HF_TOKEN;
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('HF_TOKEN=')) {
      hfToken = trimmed.slice('HF_TOKEN='.length).trim().replace(/^['"]|['"]$/g, '');
      break;
    }
  }
}

if (!hfToken) {
  console.error('No HF_TOKEN found in backend/.env');
  process.exit(1);
}

async function uploadFiles() {
  const commitUrl = 'https://huggingface.co/api/spaces/marshalavi/TradingGuru-Terminal/commit/main';
  
  const indexHtmlContent = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  const indexHtmlBuffer = Buffer.from(indexHtmlContent, 'utf8');

  // Extract referenced js and css bundles from index.html
  const jsMatch = indexHtmlContent.match(/src=["']\.\/assets\/([^"']+)["']/);
  const cssMatch = indexHtmlContent.match(/href=["']\.\/assets\/([^"']+)["']/);

  if (!jsMatch || !cssMatch) {
    console.error('Could not parse asset filenames from index.html');
    process.exit(1);
  }

  const jsFileName = jsMatch[1];
  const cssFileName = cssMatch[1];

  console.log(`Detected assets: js=${jsFileName}, css=${cssFileName}`);

  const jsPath = path.join(__dirname, '../assets', jsFileName);
  const cssPath = path.join(__dirname, '../assets', cssFileName);
  const liveBackendPath = path.join(__dirname, '../live_backend.json');

  const filesToUpload = [
    {
      path: 'index.html',
      content: indexHtmlBuffer.toString('base64'),
      encoding: 'base64'
    },
    {
      path: `assets/${jsFileName}`,
      content: fs.readFileSync(jsPath).toString('base64'),
      encoding: 'base64'
    },
    {
      path: `assets/${cssFileName}`,
      content: fs.readFileSync(cssPath).toString('base64'),
      encoding: 'base64'
    }
  ];

  if (fs.existsSync(liveBackendPath)) {
    filesToUpload.push({
      path: 'live_backend.json',
      content: fs.readFileSync(liveBackendPath).toString('base64'),
      encoding: 'base64'
    });
  }

  const payload = {
    summary: `Deploy build with ${jsFileName} and active live_backend.json`,
    files: filesToUpload
  };

  console.log('Uploading updated bundles and live_backend.json to Hugging Face space...');
  try {
    const res = await fetch(commitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      console.log('✅ Successfully uploaded latest build & assets to Hugging Face Space!');
    } else {
      const err = await res.text();
      console.error(`HF Error ${res.status}:`, err);
    }
  } catch (e) {
    console.error('Fetch error:', e.message);
  }
}

uploadFiles();
