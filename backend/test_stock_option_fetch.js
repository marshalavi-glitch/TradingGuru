import { TradingViewBridge } from './tradingview.js';
import { fetchCandlesForSymbol } from './scanner.js';

function getStockExpiry() {
  const today = new Date();
  const year = today.getFullYear();
  const month = today.getMonth();
  
  const lastDay = new Date(year, month + 1, 0);
  while (lastDay.getDay() !== 4) {
    lastDay.setDate(lastDay.getDate() - 1);
  }
  
  if (today.getTime() > lastDay.getTime() + 24 * 60 * 60 * 1000) {
    const nextMonthLastDay = new Date(year, month + 2, 0);
    while (nextMonthLastDay.getDay() !== 4) {
      nextMonthLastDay.setDate(nextMonthLastDay.getDate() - 1);
    }
    const yy = String(nextMonthLastDay.getFullYear()).slice(-2);
    const mm = String(nextMonthLastDay.getMonth() + 1).padStart(2, '0');
    const dd = String(nextMonthLastDay.getDate()).padStart(2, '0');
    return `${yy}${mm}${dd}`;
  }
  
  const yy = String(lastDay.getFullYear()).slice(-2);
  const mm = String(lastDay.getMonth() + 1).padStart(2, '0');
  const dd = String(lastDay.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

async function testFetch() {
  const tvBridge = new TradingViewBridge();
  await new Promise(r => setTimeout(r, 2000));
  
  const expiry = '260825';

  const symbol = `NSE:RELIANCE${expiry}C1300`;

  console.log(`Subscribing to Stock Option: ${symbol}...`);
  try {
    const candles = await fetchCandlesForSymbol(tvBridge, symbol, '5', 10);
    console.log(`Fetched ${candles ? candles.length : 0} candles.`);
    if (candles && candles.length > 0) {
      console.log('Latest candle:', candles[candles.length - 1]);
    }
  } catch (e) {
    console.error('Error fetching stock option:', e);
  }
  process.exit(0);
}

testFetch();
