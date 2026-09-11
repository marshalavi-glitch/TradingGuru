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
  console.log('Un-tracking cloudflared.exe...');
  try { execSync('git rm --cached backend/cloudflared.exe', { stdio: 'ignore' }); } catch (e) {}
  
  // Ensure cloudflared.exe is in .gitignore
  const gitignorePath = path.join(__dirname, '.gitignore');
  let gitignore = fs.existsSync(gitignorePath) ? fs.readFileSync(gitignorePath, 'utf8') : '';
  if (!gitignore.includes('cloudflared.exe')) {
    gitignore += '\ncloudflared.exe\nbackend/cloudflared.exe\n';
    fs.writeFileSync(gitignorePath, gitignore, 'utf8');
  }

  console.log('Staging changes...');
  execSync('git add .', { stdio: 'inherit' });
  try {
    execSync('git commit -m "Fix blank screen issue: restore all dashboard tabs with TabErrorBoundary & API fallback"', { stdio: 'inherit' });
  } catch (e) {
    console.log('Already committed or amending...');
    execSync('git commit --amend -m "Fix blank screen issue: restore all dashboard tabs with TabErrorBoundary & API fallback"', { stdio: 'inherit' });
  }

  console.log('Pushing to Hugging Face Space...');
  const remoteUrl = `https://marshalavi:${token}@huggingface.co/spaces/marshalavi/TradingGuru`;
  execSync(`git push -f ${remoteUrl} main`, { stdio: 'inherit' });
  console.log('✅ Successfully pushed to Hugging Face Space!');
} catch (err) {
  console.error('Failed to push to HF:', err.message);
  process.exit(1);
}
