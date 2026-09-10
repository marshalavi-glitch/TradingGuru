import './patch_ws.js';
import { createSession, createChart } from "@ch99q/twc";

console.log("Starting session test...");
try {
  const session = await createSession();
  console.log("Session connected!");
  
  console.log("Creating chart...");
  const chart = await createChart(session);
  console.log("Chart created successfully! ID:", chart.id);
  
  console.log("Resolving symbol NSE:NIFTY...");
  const resolved = await chart.resolve('NIFTY', 'NSE');
  console.log("Symbol resolved! Name:", resolved.name);
  
  process.exit(0);
} catch (e) {
  console.error("Test failed with error:", e);
  process.exit(1);
}
