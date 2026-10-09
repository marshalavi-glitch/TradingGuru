/**
 * Market Hours & Candle Formation Rules:
 * 
 * NSE / BSE / NFO / BFO:
 * - 9:00 AM – 9:15 AM IST: Pre-open session — do not form or display candles.
 * - 9:15 AM IST sharp: Start candle formation from actual market open (33300 sec).
 * - 9:15 AM – 3:15 PM IST: Candles form normally based on timeframe (up to 54900 sec).
 * - After 3:15 PM IST: Stop candle formation for trading day. Market data window ends at 3:15 PM IST.
 * - Pre-open data and data recorded after 3:15 PM IST must NOT be included in OHLC, indicators, Market Profile, Volume Profile, Footprint, or Order Flow calculations.
 * 
 * MCX:
 * - 9:00 AM – 11:30 PM IST (32400 to 84600 sec)
 */

export function isMcxSymbol(symbol?: string): boolean {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  return s.startsWith('MCX:') || s.includes('CRUDE') || s.includes('NATURALGAS') || s.includes('GOLD') || s.includes('SILVER') || s.includes('COPPER') || s.includes('ZINC') || s.includes('LEAD') || s.includes('ALUMINIUM') || s.includes('NICKEL');
}

export function isWithinMarketHours(timeSec: number, symbol?: string, timeframe?: string): boolean {
  const tf = String(timeframe || '').trim().toUpperCase();
  if (tf === 'D' || tf === '1D' || tf === 'W' || tf === '1W' || tf === 'M' || tf === '1M') {
    return true;
  }

  const isMcx = isMcxSymbol(symbol);
  const secOfDay = ((timeSec + 19800) % 86400 + 86400) % 86400;
  const istDate = new Date((timeSec + 19800) * 1000);
  const day = istDate.getUTCDay();
  // Filter out weekend candles
  if (day === 0 || day === 6) return false;

  if (isMcx) {
    // MCX: 09:00:00 to 23:30:00 IST
    return secOfDay >= 32400 && secOfDay <= 84600;
  } else {
    // NSE/BSE/NFO: 09:15:00 (33300) to 15:15:00 (54900) IST
    // Exclude pre-open 9:00-9:15 AM & post-market after 3:15 PM
    // Candles start before 15:15:00; any candle starting at or after 15:15:00 is excluded
    return secOfDay >= 33300 && secOfDay < 54900;
  }
}

export function filterMarketHoursCandles<T extends { time: number | string }>(
  candles: T[],
  symbol?: string,
  timeframe?: string
): T[] {
  if (!candles || !Array.isArray(candles) || candles.length === 0) return candles;
  const tf = String(timeframe || '').trim().toUpperCase();
  if (tf === 'D' || tf === '1D' || tf === 'W' || tf === '1W' || tf === 'M' || tf === '1M') {
    return candles;
  }

  return candles.filter((c) => {
    if (!c || c.time === undefined || c.time === null) return false;
    const timeNum = typeof c.time === 'string' ? Math.floor(new Date(c.time).getTime() / 1000) : c.time;
    if (isNaN(timeNum)) return false;
    return isWithinMarketHours(timeNum, symbol, timeframe);
  });
}
