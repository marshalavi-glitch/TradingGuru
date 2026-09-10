import './patch_ws.js';
import { createSession, createChart, createSeries } from "@ch99q/twc";

async function testMCXSymbols() {
  const testList = [
    { sym: 'CRUDEOIL1!', exch: 'MCX' },
    { sym: 'CRUDEOILQ2026', exch: 'MCX' },
    { sym: 'CRUDEOIL26AUGFUT', exch: 'MCX' },
    { sym: 'CRUDEOIL26SEPFUT', exch: 'MCX' },
    { sym: 'CRUDEOILM1!', exch: 'MCX' },
    { sym: 'CRUDEOIL1!', exch: 'MCX_FO' },
    { sym: 'CRUDEOIL', exch: 'CAPITALCOM' }
  ];

  const session = await createSession();

  for (const item of testList) {
    try {
      const chart = await createChart(session);
      const res = await chart.resolve(item.sym, item.exch);
      const series = await createSeries(session, chart, res, '5', 10);
      const lastClose = series.history[series.history.length - 1][4];
      console.log(`✅ [${item.exch}:${item.sym}] SUCCESS! Last Close: ₹${lastClose}`);
      await series.close();
      await chart.close();
    } catch (err) {
      console.log(`❌ [${item.exch}:${item.sym}] FAILED:`, err.message || err);
    }
  }
  process.exit(0);
}

testMCXSymbols();
