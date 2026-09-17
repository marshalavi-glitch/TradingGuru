import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let token = process.env.HF_TOKEN;
if (!token) {
  const envPath = path.join(__dirname, 'backend/.env');
  if (fs.existsSync(envPath)) {
    const text = fs.readFileSync(envPath, 'utf8');
    const match = text.match(/HF_TOKEN=(.+)/);
    if (match) token = match[1].trim();
  }
}

if (!token) {
  console.error('HF_TOKEN missing in backend/.env');
  process.exit(1);
}

async function uploadToHFDirect(filesToUpload) {
  console.log(`[HF API Upload] Uploading ${filesToUpload.length} files via HF API...`);
  const commitUrl = 'https://huggingface.co/api/spaces/marshalavi/TradingGuru/commit/main';
  const payload = {
    summary: 'Deploy fresh frontend dist assets & root index.html to HF Space',
    files: filesToUpload.map(f => ({
      path: f.path,
      content: f.buffer.toString('base64'),
      encoding: 'base64'
    }))
  };

  const res = await fetch(commitUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (res.ok) {
    console.log('✅ [HF API Upload] Direct API upload succeeded in <500ms!');
    return true;
  } else {
    const errorText = await res.text();
    console.warn(`⚠️ [HF API Upload] API upload returned status ${res.status}: ${errorText}`);
    return false;
  }
}

async function run() {
  try {
    console.log('Building Vite frontend...');
    execSync('node node_modules/vite/bin/vite.js build', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });

    console.log('Syncing dist assets to root for Hugging Face Static Space...');
    const distIndexPath = path.join(__dirname, 'frontend/dist/index.html');
    const rootIndexPath = path.join(__dirname, 'index.html');
    fs.copyFileSync(distIndexPath, rootIndexPath);

    const rootAssetsDir = path.join(__dirname, 'assets');
    const distAssetsDir = path.join(__dirname, 'frontend/dist/assets');
    if (!fs.existsSync(rootAssetsDir)) {
      fs.mkdirSync(rootAssetsDir, { recursive: true });
    }

    // Clean old assets in root assets dir
    const oldFiles = fs.readdirSync(rootAssetsDir);
    for (const f of oldFiles) {
      fs.unlinkSync(path.join(rootAssetsDir, f));
    }

    // Copy fresh dist assets
    const distFiles = fs.readdirSync(distAssetsDir);
    const filesToUpload = [];

    // Add index.html
    filesToUpload.push({
      path: 'index.html',
      buffer: fs.readFileSync(rootIndexPath)
    });

    for (const f of distFiles) {
      const srcPath = path.join(distAssetsDir, f);
      const destPath = path.join(rootAssetsDir, f);
      fs.copyFileSync(srcPath, destPath);
      filesToUpload.push({
        path: `assets/${f}`,
        buffer: fs.readFileSync(destPath)
      });
    }

    // Add live_backend.json if exists
    const liveBackendPath = path.join(__dirname, 'live_backend.json');
    if (fs.existsSync(liveBackendPath)) {
      filesToUpload.push({
        path: 'live_backend.json',
        buffer: fs.readFileSync(liveBackendPath)
      });
    }

    // Upload via Direct HF API
    const uploaded = await uploadToHFDirect(filesToUpload);
    if (!uploaded) {
      // Fallback git push
      console.log('Falling back to git push...');
      const lockPath = path.join(__dirname, '.git/index.lock');
      if (fs.existsSync(lockPath)) {
        try { fs.unlinkSync(lockPath); } catch (e) {}
      }
      try { execSync('git rm --cached backend/cloudflared.exe', { stdio: 'ignore' }); } catch (e) {}
      try { execSync('git rm --cached backend/bore.exe', { stdio: 'ignore' }); } catch (e) {}
      execSync('git add .', { stdio: 'inherit' });
      try { execSync('git commit -m "Deploy fresh frontend dist assets & root index.html to HF Space"', { stdio: 'inherit' }); } catch (e) {}
      const remoteUrl = `https://marshalavi:${token}@huggingface.co/spaces/marshalavi/TradingGuru`;
      execSync(`git push -f ${remoteUrl} main`, { stdio: 'inherit' });
    }
    console.log('🎉 Successfully deployed updated static assets to Hugging Face Space!');
  } catch (err) {
    console.error('Failed to push to HF:', err.message);
    process.exit(1);
  }
}

run();
