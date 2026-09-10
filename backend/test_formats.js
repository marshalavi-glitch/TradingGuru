import './patch_ws.js';
import { createSession, createChart } from "@ch99q/twc";

console.log("Brute-forcing RELIANCE option contract formats...");
try {
  const session = await createSession();
  const chart = await createChart(session);
  
  const formats = [
    // Format 1: TWC standard YYMMDD
    'NSE:RELIANCE260730C1300',
    'NSE:RELIANCE260730C1280',
    // Format 2: 3-letter month YYMMMSTRIKE
    'NSE:RELIANCE26JUL1300CE',
    'NSE:RELIANCE26JUL1280CE',
    'NSE:RELIANCE26JUL1300C',
    'NSE:RELIANCE26JUL1280C',
    // Format 3: Month/Year only YYMM (standard for monthly if no day)
    'NSE:RELIANCE2607C1300',
    'NSE:RELIANCE2607P1300',
    // Format 4: YYMMMTypeSTRIKE
    'NSE:RELIANCE26JULC1300',
    'NSE:RELIANCE26JULP1300',
    // Format 5: YYMMDDTypeSTRIKE (padded strike)
    'NSE:RELIANCE260730C01300',
    'NSE:RELIANCE260730C01280',
    // Format 6: YYMMMTypeSTRIKE (padded strike)
    'NSE:RELIANCE26JULC01300',
    'NSE:RELIANCE26JULC01280',
    // Format 7: YYMMMSTRIKEType (padded strike)
    'NSE:RELIANCE26JUL01300CE',
    'NSE:RELIANCE26JUL01280CE',
    // Format 8: Standard exchange ticker format without prefix
    'RELIANCE260730C1300',
    'RELIANCE26JUL1300CE'
  ];
  
  for (const sym of formats) {
    try {
      const parts = sym.includes(':') ? sym.split(':') : ['NSE', sym];
      const resolved = await chart.resolve(parts[1], parts[0]);
      console.log(`[SUCCESS] Resolved: ${sym} -> ${resolved.name}`);
    } catch (e) {
      // Don't log failures to keep console clean
    }
  }
  console.log("Done testing formats.");
  process.exit(0);
} catch (e) {
  console.error("Test failed:", e);
  process.exit(1);
}
