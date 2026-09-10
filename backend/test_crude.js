import './patch_ws.js';
import { createSession, createChart } from "@ch99q/twc";

async function testSymbol(sym, exch) {
  try {
    console.log(`Testing ${exch}:${sym}...`);
    const session = await createSession();
    const chart = await createChart(session);
    const resolved = await chart.resolve(sym, exch);
    console.log(`Successfully resolved ${exch}:${sym}! Full name:`, resolved.name);
    await chart.close();
  } catch (err) {
    console.error(`Failed to resolve ${exch}:${sym}:`, err.message || err);
  }
}

async function run() {
  await testSymbol('CRUDEOIL1!', 'MCX');
  await testSymbol('CRUDEOIL', 'MCX');
  await testSymbol('CRUDEOILQ2026', 'MCX');
  await testSymbol('CL1!', 'NYMEX');
  process.exit(0);
}

run();
