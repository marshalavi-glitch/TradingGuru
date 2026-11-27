import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LOGS_DIR = path.join(__dirname, 'logs');
if (!fs.existsSync(LOGS_DIR)) fs.mkdirSync(LOGS_DIR, { recursive: true });

const STATUS_FILE = path.join(LOGS_DIR, 'supervisor_status.json');
const STOP_SIGNAL_FILE = path.join(LOGS_DIR, 'stop.signal');
const LOCK_FILE = path.join(LOGS_DIR, 'supervisor.pid');

// Single-instance enforcement
if (fs.existsSync(LOCK_FILE)) {
  try {
    const existingPid = parseInt(fs.readFileSync(LOCK_FILE, 'utf8'), 10);
    if (existingPid && existingPid !== process.pid) {
      try {
        process.kill(existingPid, 0);
        console.log(`[Supervisor] Another instance is already running (PID: ${existingPid}). Exiting duplicate.`);
        process.exit(0);
      } catch (e) {
        // Stale lock file
      }
    }
  } catch (e) {}
}
try { fs.writeFileSync(LOCK_FILE, String(process.pid), 'utf8'); } catch (e) {}
process.on('exit', () => {
  try { if (fs.existsSync(LOCK_FILE)) fs.unlinkSync(LOCK_FILE); } catch (e) {}
});

// Clean any previous stop signal
if (fs.existsSync(STOP_SIGNAL_FILE)) {
  try { fs.unlinkSync(STOP_SIGNAL_FILE); } catch (e) {}
}

const nodePath = process.execPath || 'node';

function log(msg) {
  const ts = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const entry = `[${ts}] [Supervisor] ${msg}\n`;
  try {
    process.stdout.write(entry);
  } catch (e) {}
  try {
    fs.appendFileSync(path.join(LOGS_DIR, 'supervisor.log'), entry, 'utf8');
  } catch (e) {}
}

process.on('uncaughtException', (err) => {
  log(`FATAL uncaughtException: ${err.stack || err.message}`);
});
process.on('unhandledRejection', (reason) => {
  log(`FATAL unhandledRejection: ${reason}`);
});

log('Starting TradingGuru Background Supervisor...');

const services = [
  {
    name: 'backend',
    script: path.join(__dirname, 'backend/server.js'),
    cwd: path.join(__dirname, 'backend'),
    logFile: path.join(LOGS_DIR, 'backend.log'),
    healthUrl: 'http://localhost:3002/health',
    child: null,
    restartCount: 0,
    failStreak: 0
  },
  {
    name: 'frontend',
    script: path.join(__dirname, 'serve_port_3000.js'),
    cwd: __dirname,
    logFile: path.join(LOGS_DIR, 'frontend.log'),
    healthUrl: 'http://localhost:3000/index.html',
    child: null,
    restartCount: 0,
    failStreak: 0
  },
  {
    name: 'tunnel',
    script: path.join(__dirname, 'backend/start_cloudflare_tunnel.js'),
    cwd: __dirname,
    logFile: path.join(LOGS_DIR, 'tunnel.log'),
    child: null,
    restartCount: 0,
    failStreak: 0
  },
  {
    name: 'autohealer',
    script: path.join(__dirname, 'backend/auto_heal_tabs.js'),
    cwd: __dirname,
    logFile: path.join(LOGS_DIR, 'auto_heal.log'),
    child: null,
    restartCount: 0,
    failStreak: 0
  }
];

let isShuttingDown = false;

function saveStatus() {
  const status = {
    supervisorPid: process.pid,
    updatedAt: new Date().toISOString(),
    isShuttingDown,
    services: services.map(s => ({
      name: s.name,
      pid: s.child?.pid || null,
      alive: Boolean(s.child && !s.child.killed),
      restartCount: s.restartCount
    }))
  };
  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2), 'utf8');
  } catch (e) {}
}

function startService(svc) {
  if (isShuttingDown) return;
  try {
    const outStream = fs.openSync(svc.logFile, 'a');
    log(`Launching ${svc.name}: ${svc.script}`);

    const child = spawn(nodePath, [svc.script], {
      cwd: svc.cwd,
      stdio: ['ignore', outStream, outStream],
      detached: false,
      env: process.env
    });

    svc.child = child;
    saveStatus();

    child.on('exit', (code, signal) => {
      fs.closeSync(outStream);
      svc.child = null;
      saveStatus();

      if (!isShuttingDown) {
        svc.restartCount++;
        log(`⚠️ Service [${svc.name}] exited (code: ${code}, signal: ${signal}). Auto-restarting in 4s... (restart #${svc.restartCount})`);
        setTimeout(() => startService(svc), 4000);
      } else {
        log(`Service [${svc.name}] stopped cleanly.`);
      }
    });

    child.on('error', (err) => {
      log(`❌ Error in service [${svc.name}]: ${err.message}`);
    });

  } catch (err) {
    log(`❌ Failed to spawn [${svc.name}]: ${err.message}`);
    if (!isShuttingDown) {
      setTimeout(() => startService(svc), 8000);
    }
  }
}

// Start all services in order
services.forEach((svc, idx) => {
  setTimeout(() => startService(svc), idx * 2000);
});

// Periodic health monitor (every 15s)
setInterval(async () => {
  if (isShuttingDown) return;

  // Check for stop signal file
  if (fs.existsSync(STOP_SIGNAL_FILE)) {
    log('Stop signal file detected. Shutting down all services...');
    shutdown();
    return;
  }

  for (const svc of services) {
    if (!svc.healthUrl || !svc.child) continue;
    try {
      const res = await fetch(svc.healthUrl, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        svc.failStreak = 0;
      } else {
        svc.failStreak++;
      }
    } catch (e) {
      svc.failStreak++;
    }

    if (svc.failStreak >= 10) {
      log(`⚠️ Service [${svc.name}] failed 10 consecutive health checks. Force killing and restarting...`);
      svc.failStreak = 0;
      try {
        if (svc.child && svc.child.pid) {
          if (process.platform === 'win32') {
            execSync(`taskkill /F /PID ${svc.child.pid} /T 2>nul`, { stdio: 'ignore' });
          } else {
            svc.child.kill('SIGKILL');
          }
        }
      } catch (e) {}
    }
  }

  saveStatus();
}, 15000);

function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;
  log('Shutting down all services gracefully...');

  for (const svc of services) {
    if (svc.child && svc.child.pid) {
      try {
        log(`Stopping ${svc.name} (PID: ${svc.child.pid})...`);
        if (process.platform === 'win32') {
          execSync(`taskkill /F /PID ${svc.child.pid} /T 2>nul`, { stdio: 'ignore' });
        } else {
          svc.child.kill('SIGTERM');
        }
      } catch (e) {}
    }
  }

  try {
    if (fs.existsSync(STATUS_FILE)) fs.unlinkSync(STATUS_FILE);
    if (fs.existsSync(STOP_SIGNAL_FILE)) fs.unlinkSync(STOP_SIGNAL_FILE);
  } catch (e) {}

  log('All services terminated. Supervisor exiting.');
  setTimeout(() => process.exit(0), 1000);
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
