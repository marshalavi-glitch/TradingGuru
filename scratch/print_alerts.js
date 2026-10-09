import fs from 'fs';
const d = JSON.parse(fs.readFileSync('backend/data/mp_3day_backtest_20days.json', 'utf8'));
console.log('Total alerts:', d.alerts.length);
console.log('Triggered:', d.summary.triggeredTrades, 'Wins:', d.summary.winTrades, 'Losses:', d.summary.lossTrades, 'Win Rate:', d.summary.winRate + '%');
console.log('---------------------------------------------------------------------------------------------------------');
d.alerts.forEach((a, i) => {
  console.log(`${(i+1).toString().padStart(2)}. [${a.triggerDateDay4}] ${a.cleanName.padEnd(10)} | ${a.insideType.padEnd(12)} | ${a.triggeredDirection.padEnd(5)} | Entry: ${String(a.entryPrice).padEnd(8)} | Exit: ${String(a.exitPrice).padEnd(8)} | P&L: ${(a.pnlPct >= 0 ? '+' : '') + a.pnlPct}% | MFE: +${a.mfePct}% | ${a.outcome}`);
});
