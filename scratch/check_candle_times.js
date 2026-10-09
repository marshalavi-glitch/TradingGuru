async function run() {
  const res = await fetch('http://localhost:3002/api/candles?symbol=NSE:NIFTY&timeframe=5');
  const json = await res.json();
  const raw = json.candles || [];
  console.log('Count:', raw.length);
  if (raw.length > 0) {
    const last = raw[raw.length - 1];
    console.log('Last candle:', last);
    const secOfDay = ((last.time + 19800) % 86400 + 86400) % 86400;
    console.log('Sec of day in IST:', secOfDay);
    console.log('Is between 33300 and 55800?', secOfDay >= 33300 && secOfDay <= 55800);
    const d = new Date((last.time + 19800) * 1000);
    console.log('IST date string:', d.toUTCString());
    console.log('Day of week:', d.getUTCDay());
  }
}
run();
