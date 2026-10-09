import fs from 'fs';
const d = JSON.parse(fs.readFileSync('backend/data/mp_3day_backtest_100days.json', 'utf8'));
const monthMap = {};
d.alerts.forEach(a => {
  const m = a.monthStr;
  if (!monthMap[m]) monthMap[m] = { month: m, total: 0, triggered: 0, wins: 0, losses: 0, t1: 0, t2: 0, pnlPct: 0 };
  monthMap[m].total++;
  if (a.triggeredDirection !== 'NONE') {
    monthMap[m].triggered++;
    monthMap[m].pnlPct += a.pnlPct;
    if (a.pnlPts > 0) monthMap[m].wins++;
    else monthMap[m].losses++;
    if (a.outcome.includes('TARGET 1')) monthMap[m].t1++;
    if (a.outcome.includes('TARGET 2')) monthMap[m].t2++;
  }
});

console.log('=== 100-DAY BACKTEST: MONTH-BY-MONTH BREAKDOWN ===');
for (const m of Object.values(monthMap).sort((a,b) => a.month.localeCompare(b.month))) {
  console.log(`${m.month} | Setups: ${m.total.toString().padStart(2)} | Trades: ${m.triggered.toString().padStart(2)} | Wins: ${m.wins.toString().padStart(2)} | Losses: ${m.losses.toString().padStart(2)} | Win Rate: ${(m.triggered > 0 ? (m.wins/m.triggered*100).toFixed(1) : '0.0').padStart(5)}% | T1 Hits: ${m.t1} | T2 Hits: ${m.t2} | Net P&L: ${(m.pnlPct >= 0 ? '+' : '') + m.pnlPct.toFixed(2)}%`);
}

console.log('\n=== TOP 10 WINNING TRADES (100 DAYS) ===');
const topTrades = d.alerts.filter(a => a.triggeredDirection !== 'NONE').sort((a,b) => b.pnlPct - a.pnlPct).slice(0, 10);
topTrades.forEach((t, i) => {
  console.log(`${(i+1).toString().padStart(2)}. [${t.triggerDateDay4}] ${t.cleanName.padEnd(10)} | ${t.triggeredDirection.padEnd(5)} | Entry: ${t.entryPrice.toString().padEnd(8)} | Exit: ${t.exitPrice.toString().padEnd(8)} | P&L: +${t.pnlPct}% | MFE: +${t.mfePct}% | ${t.outcome}`);
});
