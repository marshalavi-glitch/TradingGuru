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
  for (const f of distFiles) {
    fs.copyFileSync(path.join(distAssetsDir, f), path.join(rootAssetsDir, f));
  }

  console.log('Un-tracking cloudflared.exe & bore.exe...');
  try { execSync('git rm --cached backend/cloudflared.exe', { stdio: 'ignore' }); } catch (e) {}
  try { execSync('git rm --cached backend/bore.exe', { stdio: 'ignore' }); } catch (e) {}
  
  // Ensure cloudflared.exe and bore.exe are in .gitignore
  const gitignorePath = path.join(__dirname, '.gitignore');
  let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignore.includes('cloudflared.exe') || !gitignore.includes('bore.exe')) {
    gitignore += '\ncloudflared.exe\nbackend/cloudflared.exe\nbore.exe\nbackend/bore.exe\n';
    fs.writeFileSync(gitignorePath, gitignore, 'utf8');
  }

  console.log('Staging changes...');
  execSync('git add .', { stdio: 'inherit' });
  try {
    execSync('git commit -m "Deploy fresh frontend dist assets & root index.html to HF Space"', { stdio: 'inherit' });
  } catch (e) {
    console.log('Already committed or amending...');
    execSync('git commit --amend -m "Deploy fresh frontend dist assets & root index.html to HF Space"', { stdio: 'inherit' });
  }

  console.log('Pushing to Hugging Face Space...');
  const remoteUrl = `https://marshalavi:${token}@huggingface.co/spaces/marshalavi/TradingGuru`;
  execSync(`git push -f ${remoteUrl} main`, { stdio: 'inherit' });
  console.log('✅ Successfully pushed updated static assets to Hugging Face Space!');
} catch (err) {
  console.error('Failed to push to HF:', err.message);
  process.exit(1);
}
