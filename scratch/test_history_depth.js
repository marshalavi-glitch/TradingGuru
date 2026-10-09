import { angelOneBridge } from '../backend/angelone_bridge.js';

async function main() {
  await angelOneBridge.login();
  const resolved = await angelOneBridge.resolveSymbolToken('NSE:NIFTY');
  console.log('Resolved NIFTY:', resolved);

  // Test 1: Daily candles
  const dailyRes = await angelOneBridge.getCandles({
    exchange: resolved.exchange,
    symboltoken: resolved.symboltoken,
    interval: 'ONE_DAY',
    fromdate: '2026-04-01 09:15',
    todate: '2026-10-09 15:15'
  });
  console.log('Daily candles status:', dailyRes?.status, 'count:', dailyRes?.data?.length);

  // Test 2: Intraday 30-min chunk 1: Aug-Sept
  const chunk1 = await angelOneBridge.getCandles({
    exchange: resolved.exchange,
    symboltoken: resolved.symboltoken,
    interval: 'THIRTY_MINUTE',
    fromdate: '2026-08-01 09:15',
    todate: '2026-08-31 15:15'
  });
  console.log('Aug 30-min status:', chunk1?.status, 'count:', chunk1?.data?.length);

  // Test 3: Intraday 30-min chunk 2: July
  const chunk2 = await angelOneBridge.getCandles({
    exchange: resolved.exchange,
    symboltoken: resolved.symboltoken,
    interval: 'THIRTY_MINUTE',
    fromdate: '2026-07-01 09:15',
    todate: '2026-07-31 15:15'
  });
  console.log('July 30-min status:', chunk2?.status, 'count:', chunk2?.data?.length);

  // Test 4: Intraday 30-min chunk 3: June
  const chunk3 = await angelOneBridge.getCandles({
    exchange: resolved.exchange,
    symboltoken: resolved.symboltoken,
    interval: 'THIRTY_MINUTE',
    fromdate: '2026-06-01 09:15',
    todate: '2026-06-30 15:15'
  });
  console.log('June 30-min status:', chunk3?.status, 'count:', chunk3?.data?.length);

  // Test 5: Intraday 30-min chunk 4: May
  const chunk4 = await angelOneBridge.getCandles({
    exchange: resolved.exchange,
    symboltoken: resolved.symboltoken,
    interval: 'THIRTY_MINUTE',
    fromdate: '2026-05-01 09:15',
    todate: '2026-05-31 15:15'
  });
  console.log('May 30-min status:', chunk4?.status, 'count:', chunk4?.data?.length);
}

main().catch(console.error);
