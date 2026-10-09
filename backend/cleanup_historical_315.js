import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');

function isCommodity(symbol) {
  if (!symbol || typeof symbol !== 'string') return false;
  const s = symbol.toUpperCase();
  return s.startsWith('MCX:') || s.includes('CRUDE') || s.includes('NATURALGAS') || 
         s.includes('GOLD') || s.includes('SILVER') || s.includes('COPPER') || 
         s.includes('ZINC') || s.includes('LEAD') || s.includes('ALUMINIUM') || s.includes('NICKEL');
}

function isAfter315PM(timeStr) {
  if (!timeStr) return false;
  if (typeof timeStr === 'number') {
    const secOfDay = ((timeStr + 19800) % 86400 + 86400) % 86400;
    return secOfDay > 54900;
  }
  const t = String(timeStr).trim();
  const m12 = t.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(am|pm)$/i);
  if (m12) {
    let h = parseInt(m12[1], 10);
    const m = parseInt(m12[2], 10);
    const meridiem = m12[3].toLowerCase();
    if (meridiem === 'pm' && h < 12) h += 12;
    if (meridiem === 'am' && h === 12) h = 0;
    return (h * 3600 + m * 60) > 54900;
  }
  const m24 = t.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (m24) {
    const h = parseInt(m24[1], 10);
    const m = parseInt(m24[2], 10);
    const s = m24[3] ? parseInt(m24[3], 10) : 0;
    return (h * 3600 + m * 60 + s) > 54900;
  }
  if (t.includes('T') || t.includes(' ')) {
    const d = new Date(t);
    if (!isNaN(d.getTime())) {
      const istSec = Math.floor(d.getTime() / 1000) + 19800;
      const secOfDay = ((istSec % 86400) + 86400) % 86400;
      return secOfDay > 54900;
    }
  }
  return false;
}

function isDateOnOrAfterAug3(dateStr) {
  if (!dateStr) return false;
  let y, m, d;
  if (dateStr.includes('_')) {
    const p = dateStr.split('_');
    y = +p[0]; m = +p[1]; d = +p[2];
  } else if (dateStr.includes('-')) {
    const p = dateStr.split('-');
    if (p[0].length === 4) {
      y = +p[0]; m = +p[1]; d = +p[2];
    } else {
      d = +p[0]; m = +p[1]; y = +p[2];
    }
  } else if (dateStr.includes('/')) {
    const p = dateStr.split('/');
    const a = +p[0];
    const b = +p[1];
    y = +p[2];
    if (a > 12) {
      d = a; m = b;
    } else if (b > 12) {
      m = a; d = b;
    } else if (b >= 8) {
      // D/M/YYYY format e.g. 1/10/2026 (Oct 1)
      d = a; m = b;
    } else if (a >= 8) {
      // M/D/YYYY format e.g. 10/5/2026 (Oct 5)
      m = a; d = b;
    } else {
      m = a; d = b;
    }
  }
  if (y && m && d) {
    const dateVal = y * 10000 + m * 100 + d;
    return dateVal >= 20260803; // August 3, 2026
  }
  return false;
}

export function runHistoricalCleanup(dryRun = false) {
  console.log(`=== [Historical Cleanup] Starting 3:15 PM Cutoff Cleanup (DryRun: ${dryRun}) ===`);
  let totalCleanedCount = 0;

  // 1. Clean today_signals_log.json
  const todaySignalsFile = path.join(DATA_DIR, 'today_signals_log.json');
  if (fs.existsSync(todaySignalsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(todaySignalsFile, 'utf8'));
      if (Array.isArray(data.signals) && isDateOnOrAfterAug3(data.date)) {
        const initialLen = data.signals.length;
        data.signals = data.signals.filter(s => {
          if (isCommodity(s.symbol)) return true;
          return !isAfter315PM(s.touchTime || s.time);
        });
        const removed = initialLen - data.signals.length;
        console.log(`[today_signals_log.json] Removed ${removed} of ${initialLen} signals after 3:15 PM.`);
        totalCleanedCount += removed;
        if (!dryRun && removed > 0) {
          fs.writeFileSync(todaySignalsFile, JSON.stringify(data, null, 2), 'utf8');
        }
      }
    } catch (e) {
      console.error(`Error processing today_signals_log.json:`, e.message);
    }
  }

  // 2. Clean historical_signals_*.json
  const files = fs.readdirSync(DATA_DIR);
  for (const file of files) {
    if (file.startsWith('historical_signals_') && file.endsWith('.json')) {
      const datePart = file.replace('historical_signals_', '').replace('.json', '');
      if (isDateOnOrAfterAug3(datePart)) {
        const filePath = path.join(DATA_DIR, file);
        try {
          const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
          if (Array.isArray(data.signals)) {
            const initialLen = data.signals.length;
            data.signals = data.signals.filter(s => {
              if (isCommodity(s.symbol)) return true;
              return !isAfter315PM(s.touchTime || s.time);
            });
            const removed = initialLen - data.signals.length;
            console.log(`[${file}] Removed ${removed} of ${initialLen} signals after 3:15 PM.`);
            totalCleanedCount += removed;
            if (!dryRun && removed > 0) {
              fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
            }
          }
        } catch (e) {
          console.error(`Error processing ${file}:`, e.message);
        }
      }
    }
  }

  // 3. Clean volume_breakouts_today.json
  const volFile = path.join(DATA_DIR, 'volume_breakouts_today.json');
  if (fs.existsSync(volFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(volFile, 'utf8'));
      if (Array.isArray(data.results) && isDateOnOrAfterAug3(data.date)) {
        const initialLen = data.results.length;
        data.results = data.results.filter(b => {
          if (isCommodity(b.symbol)) return true;
          return !isAfter315PM(b.time);
        });
        const removed = initialLen - data.results.length;
        console.log(`[volume_breakouts_today.json] Removed ${removed} of ${initialLen} breakouts after 3:15 PM.`);
        totalCleanedCount += removed;
        if (!dryRun && removed > 0) {
          fs.writeFileSync(volFile, JSON.stringify(data, null, 2), 'utf8');
        }
      }
    } catch (e) {
      console.error(`Error processing volume_breakouts_today.json:`, e.message);
    }
  }

  // 4. Clean nr7_breakouts_today.json
  const nr7File = path.join(DATA_DIR, 'nr7_breakouts_today.json');
  if (fs.existsSync(nr7File)) {
    try {
      const data = JSON.parse(fs.readFileSync(nr7File, 'utf8'));
      if (Array.isArray(data.results) && isDateOnOrAfterAug3(data.date)) {
        const initialLen = data.results.length;
        data.results = data.results.filter(b => {
          if (isCommodity(b.symbol)) return true;
          return !isAfter315PM(b.time);
        });
        const removed = initialLen - data.results.length;
        console.log(`[nr7_breakouts_today.json] Removed ${removed} of ${initialLen} breakouts after 3:15 PM.`);
        totalCleanedCount += removed;
        if (!dryRun && removed > 0) {
          fs.writeFileSync(nr7File, JSON.stringify(data, null, 2), 'utf8');
        }
      }
    } catch (e) {
      console.error(`Error processing nr7_breakouts_today.json:`, e.message);
    }
  }

  // 5. Clean live_market_learnings.json
  const learningsFile = path.join(DATA_DIR, 'live_market_learnings.json');
  if (fs.existsSync(learningsFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(learningsFile, 'utf8'));
      if (Array.isArray(data)) {
        const initialLen = data.length;
        const filtered = data.filter(item => {
          if (isDateOnOrAfterAug3(item.date)) {
            // Equities/indices learning: filter out if after 3:15 PM
            return !isAfter315PM(item.time);
          }
          return true; // Keep prior to Aug 3
        });
        const removed = initialLen - filtered.length;
        console.log(`[live_market_learnings.json] Removed ${removed} of ${initialLen} learnings after 3:15 PM.`);
        totalCleanedCount += removed;
        if (!dryRun && removed > 0) {
          fs.writeFileSync(learningsFile, JSON.stringify(filtered, null, 2), 'utf8');
        }
      }
    } catch (e) {
      console.error(`Error processing live_market_learnings.json:`, e.message);
    }
  }

  // 6. Clean reports in backend/data/reports/
  const reportsDir = path.join(DATA_DIR, 'reports');
  if (fs.existsSync(reportsDir)) {
    const reportFiles = fs.readdirSync(reportsDir);
    for (const rFile of reportFiles) {
      if (rFile.startsWith('report_') && rFile.endsWith('.json')) {
        const datePart = rFile.replace('report_', '').replace('.json', '');
        if (isDateOnOrAfterAug3(datePart)) {
          const rPath = path.join(reportsDir, rFile);
          try {
            const rData = JSON.parse(fs.readFileSync(rPath, 'utf8'));
            let fileRemoved = 0;
            const arrayKeys = ['bouncesSupport', 'rejectionsResistance', 'breakouts', 'breakdowns', 'niftyLevelsHit', 'bankniftyLevelsHit'];
            for (const k of arrayKeys) {
              if (Array.isArray(rData[k])) {
                const initLen = rData[k].length;
                rData[k] = rData[k].filter(item => {
                  if (item.symbol && isCommodity(item.symbol)) return true;
                  return !isAfter315PM(item.touchTime || item.time);
                });
                fileRemoved += (initLen - rData[k].length);
              }
            }
            if (fileRemoved > 0) {
              console.log(`[${rFile}] Removed ${fileRemoved} items after 3:15 PM.`);
              totalCleanedCount += fileRemoved;
              if (!dryRun) {
                fs.writeFileSync(rPath, JSON.stringify(rData, null, 2), 'utf8');
              }
            }
          } catch (e) {
            console.error(`Error processing ${rFile}:`, e.message);
          }
        }
      }
    }
  }

  console.log(`=== [Historical Cleanup] Finished. Total records cleaned: ${totalCleanedCount} ===`);
  return totalCleanedCount;
}

// If executed directly, run cleanup
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const isDry = process.argv.includes('--dry');
  runHistoricalCleanup(isDry);
}
