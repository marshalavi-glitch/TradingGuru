import './patch_ws.js';
import { createSession, createChart } from "@ch99q/twc";

console.log("Resolving stock option symbols with YYMMDD format...");
try {
  const session = await createSession();
  const chart = await createChart(session);
  
  const symbols = [
    'NSE:RELIANCE260730C1300',
    'NSE:RELIANCE260730C1280',
    'NSE:GLAXO260730C2500',
    'NSE:JKCEMENT260730C5600',
    'NSE:POONAWALLA260730C460'
  ];
  
  for (const sym of symbols) {
    try {
      const parts = sym.split(':');
      const resolved = await chart.resolve(parts[1], parts[0]);
      console.log(`Successfully resolved: ${sym} -> ${resolved.name}`);
    } catch (e) {
      console.log(`Failed to resolve: ${sym} - ${e.message || e}`);
    }
  }
  process.exit(0);
} catch (e) {
  console.error("Test failed:", e);
  process.exit(1);
}
