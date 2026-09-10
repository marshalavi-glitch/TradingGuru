import './patch_ws.js';
import { createSession, createChart, createSeries } from "@ch99q/twc";

async function testSymbols() {
  const list = [
    { sym: 'CL1!', exch: 'NYMEX' },
    { sym: 'USOIL', exch: 'TVC' },
    { sym: 'OIL_CRUDE', exch: 'CAPITALCOM' },
    { sym: 'CRUDEOIL', exch: 'MCX' }
  ];

  const session = await createSession();

  for (const item of list) {
    try {
      const chart = await createChart(session);
      const res = await chart.resolve(item.sym, item.exch);
      const series = await createSeries(session, chart, res, '5', 10);
      console.log(`✅ [${item.exch}:${item.sym}] SUCCESS! Candles:`, series.history.length, 'Last Close:', series.history[series.history.length - 1][4]);
      await series.close();
      await chart.close();
    } catch (err) {
      console.log(`❌ [${item.exch}:${item.sym}] FAILED:`, err.message || err);
    }
  }
  process.exit(0);
}

testSymbols();
