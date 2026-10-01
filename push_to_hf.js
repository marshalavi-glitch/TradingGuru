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
    const liveBackendPath = path.join(__dirname, 'live_backend.json');
    const publicBackendPath = path.join(__dirname, 'frontend/public/live_backend.json');
    if (fs.existsSync(liveBackendPath)) {
      fs.copyFileSync(liveBackendPath, publicBackendPath);
    }

    console.log('Building Vite frontend...');
    execSync('node node_modules/vite/bin/vite.js build', { cwd: path.join(__dirname, 'frontend'), stdio: 'inherit' });

    console.log('Syncing dist assets to root for Hugging Face Static Space...');
    const distIndexPath = path.join(__dirname, 'frontend/dist/index.html');
    const rootIndexPath = path.join(__dirname, 'index.html');
    fs.copyFileSync(distIndexPath, rootIndexPath);

    const distBackendPath = path.join(__dirname, 'frontend/dist/live_backend.json');
    if (fs.existsSync(liveBackendPath)) {
      fs.copyFileSync(liveBackendPath, distBackendPath);
    }

    const rootAssetsDir = path.join(__dirname, 'assets');
    const distAssetsDir = path.join(__dirname, 'frontend/dist/assets');
    if (!fs.existsSync(rootAssetsDir)) {
      fs.mkdirSync(rootAssetsDir, { recursive: true });
    }

    // Clean old assets in root assets dir
    if (fs.existsSync(rootAssetsDir)) {
      fs.rmSync(rootAssetsDir, { recursive: true, force: true });
    }
    fs.mkdirSync(rootAssetsDir, { recursive: true });

    // Copy fresh dist assets
    fs.cpSync(distAssetsDir, rootAssetsDir, { recursive: true });

    const filesToUpload = [];

    // Add index.html
    filesToUpload.push({
      path: 'index.html',
      buffer: fs.readFileSync(rootIndexPath)
    });

    // Recursively collect all files in assets directory
    function collectFiles(dir, prefix = '') {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        const relPath = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          collectFiles(fullPath, relPath);
        } else if (entry.isFile()) {
          filesToUpload.push({
            path: `assets/${relPath.replace(/\\/g, '/')}`,
            buffer: fs.readFileSync(fullPath)
          });
        }
      }
    }
    collectFiles(rootAssetsDir);

    // Add live_backend.json if exists
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
