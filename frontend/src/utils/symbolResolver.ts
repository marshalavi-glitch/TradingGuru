/**
 * Symbol Resolver & Instrument Mapping Layer
 * Converts user input strings into authoritative market instrument identifiers.
 */

export interface SymbolInfo {
  rawSymbol: string;
  formattedSymbol: string; // e.g. "NSE:RELIANCE"
  displayName: string;     // e.g. "RELIANCE"
  exchange: 'NSE' | 'BSE' | 'MCX' | 'INDEX' | 'NFO';
  type: 'stock' | 'index' | 'futures' | 'commodity' | 'option';
}

const INDEX_MAP: Record<string, { symbol: string; display: string; type?: 'index' | 'futures' | 'commodity' }> = {
  'NIFTY': { symbol: 'NSE:NIFTY', display: 'NIFTY 50', type: 'index' },
  'NIFTY50': { symbol: 'NSE:NIFTY', display: 'NIFTY 50', type: 'index' },
  'NSE:NIFTY': { symbol: 'NSE:NIFTY', display: 'NIFTY 50', type: 'index' },
  'BANKNIFTY': { symbol: 'NSE:BANKNIFTY', display: 'BANK NIFTY', type: 'index' },
  'NSE:BANKNIFTY': { symbol: 'NSE:BANKNIFTY', display: 'BANK NIFTY', type: 'index' },
  'FINNIFTY': { symbol: 'NSE:FINNIFTY', display: 'FIN NIFTY', type: 'index' },
  'NSE:FINNIFTY': { symbol: 'NSE:FINNIFTY', display: 'FIN NIFTY', type: 'index' },
  'MIDCPNIFTY': { symbol: 'NSE:MIDCPNIFTY', display: 'MIDCAP NIFTY', type: 'index' },
  'SENSEX': { symbol: 'BSE:SENSEX', display: 'BSE SENSEX', type: 'index' },
  'BSE:SENSEX': { symbol: 'BSE:SENSEX', display: 'BSE SENSEX', type: 'index' },

  // Quick Symbol Tabs Mappings
  'NF - W': { symbol: 'NSE:NIFTY', display: 'NIFTY 50', type: 'index' },
  'NIFTY_I': { symbol: 'NSE:NIFTY1!', display: 'NIFTY FUT', type: 'futures' },
  'BNF': { symbol: 'NSE:BANKNIFTY1!', display: 'BANK NIFTY FUT', type: 'futures' },
  'BANKNIFTY_I': { symbol: 'NSE:BANKNIFTY1!', display: 'BANK NIFTY FUT', type: 'futures' },
  'FINNIFTY_I': { symbol: 'NSE:FINNIFTY1!', display: 'FIN NIFTY FUT', type: 'futures' },
  'MIDCPNIFTY_I': { symbol: 'NSE:MIDCPNIFTY1!', display: 'MIDCAP NIFTY FUT', type: 'futures' },
  'HDFCBANK_I': { symbol: 'NSE:HDFCBANK', display: 'HDFC BANK', type: 'index' },
  'AXISBANK_I': { symbol: 'NSE:AXISBANK', display: 'AXIS BANK', type: 'index' },
  'TATAMOTORS': { symbol: 'NSE:TATAMOTORS', display: 'TATA MOTORS', type: 'index' },
  'SBIN': { symbol: 'NSE:SBIN', display: 'STATE BANK OF INDIA', type: 'index' },

  // Futures Mappings
  'NIFTY1!': { symbol: 'NSE:NIFTY1!', display: 'NIFTY FUT', type: 'futures' },
  'NIFTY FUT': { symbol: 'NSE:NIFTY1!', display: 'NIFTY FUT', type: 'futures' },
  'NSE:NIFTY1!': { symbol: 'NSE:NIFTY1!', display: 'NIFTY FUT', type: 'futures' },
  'BANKNIFTY1!': { symbol: 'NSE:BANKNIFTY1!', display: 'BANK NIFTY FUT', type: 'futures' },
  'BANKNIFTY FUT': { symbol: 'NSE:BANKNIFTY1!', display: 'BANK NIFTY FUT', type: 'futures' },
  'NSE:BANKNIFTY1!': { symbol: 'NSE:BANKNIFTY1!', display: 'BANK NIFTY FUT', type: 'futures' },
  'FINNIFTY1!': { symbol: 'NSE:FINNIFTY1!', display: 'FIN NIFTY FUT', type: 'futures' },
  'FINNIFTY FUT': { symbol: 'NSE:FINNIFTY1!', display: 'FIN NIFTY FUT', type: 'futures' },
  'NSE:FINNIFTY1!': { symbol: 'NSE:FINNIFTY1!', display: 'FIN NIFTY FUT', type: 'futures' },
  'MIDCPNIFTY1!': { symbol: 'NSE:MIDCPNIFTY1!', display: 'MIDCAP NIFTY FUT', type: 'futures' },
  'MIDCPNIFTY FUT': { symbol: 'NSE:MIDCPNIFTY1!', display: 'MIDCAP NIFTY FUT', type: 'futures' },
  'NSE:MIDCPNIFTY1!': { symbol: 'NSE:MIDCPNIFTY1!', display: 'MIDCAP NIFTY FUT', type: 'futures' },

  // Stock Futures
  'RELIANCE1!': { symbol: 'NSE:RELIANCE1!', display: 'RELIANCE FUT', type: 'futures' },
  'RELIANCE FUT': { symbol: 'NSE:RELIANCE1!', display: 'RELIANCE FUT', type: 'futures' },
  'NSE:RELIANCE1!': { symbol: 'NSE:RELIANCE1!', display: 'RELIANCE FUT', type: 'futures' },
  'HDFCBANK1!': { symbol: 'NSE:HDFCBANK1!', display: 'HDFC BANK FUT', type: 'futures' },
  'NSE:HDFCBANK1!': { symbol: 'NSE:HDFCBANK1!', display: 'HDFC BANK FUT', type: 'futures' },
  'ICICIBANK1!': { symbol: 'NSE:ICICIBANK1!', display: 'ICICI BANK FUT', type: 'futures' },
  'NSE:ICICIBANK1!': { symbol: 'NSE:ICICIBANK1!', display: 'ICICI BANK FUT', type: 'futures' },
  'SBIN1!': { symbol: 'NSE:SBIN1!', display: 'SBIN FUT', type: 'futures' },
  'NSE:SBIN1!': { symbol: 'NSE:SBIN1!', display: 'SBIN FUT', type: 'futures' },
  'TCS1!': { symbol: 'NSE:TCS1!', display: 'TCS FUT', type: 'futures' },
  'NSE:TCS1!': { symbol: 'NSE:TCS1!', display: 'TCS FUT', type: 'futures' },
  'INFY1!': { symbol: 'NSE:INFY1!', display: 'INFY FUT', type: 'futures' },
  'NSE:INFY1!': { symbol: 'NSE:INFY1!', display: 'INFY FUT', type: 'futures' },
  'BHARTIARTL1!': { symbol: 'NSE:BHARTIARTL1!', display: 'BHARTI AIRTEL FUT', type: 'futures' },
  'NSE:BHARTIARTL1!': { symbol: 'NSE:BHARTIARTL1!', display: 'BHARTI AIRTEL FUT', type: 'futures' },
  'TATAMOTORS1!': { symbol: 'NSE:TATAMOTORS1!', display: 'TATA MOTORS FUT', type: 'futures' },
  'NSE:TATAMOTORS1!': { symbol: 'NSE:TATAMOTORS1!', display: 'TATA MOTORS FUT', type: 'futures' },
  'LT1!': { symbol: 'NSE:LT1!', display: 'L&T FUT', type: 'futures' },
  'NSE:LT1!': { symbol: 'NSE:LT1!', display: 'L&T FUT', type: 'futures' },
  'AXISBANK1!': { symbol: 'NSE:AXISBANK1!', display: 'AXIS BANK FUT', type: 'futures' },
  'NSE:AXISBANK1!': { symbol: 'NSE:AXISBANK1!', display: 'AXIS BANK FUT', type: 'futures' },
  'MARUTI1!': { symbol: 'NSE:MARUTI1!', display: 'MARUTI FUT', type: 'futures' },
  'NSE:MARUTI1!': { symbol: 'NSE:MARUTI1!', display: 'MARUTI FUT', type: 'futures' },
  'BAJFINANCE1!': { symbol: 'NSE:BAJFINANCE1!', display: 'BAJAJ FINANCE FUT', type: 'futures' },
  'NSE:BAJFINANCE1!': { symbol: 'NSE:BAJFINANCE1!', display: 'BAJAJ FINANCE FUT', type: 'futures' },
  'VEDL1!': { symbol: 'NSE:VEDL1!', display: 'VEDANTA FUT', type: 'futures' },
  'NSE:VEDL1!': { symbol: 'NSE:VEDL1!', display: 'VEDANTA FUT', type: 'futures' },

  // Crude Oil Active & Next 3 Months (MCX)
  'CRUDEOIL': { symbol: 'MCX:CRUDEOIL19NOV26FUT', display: 'CRUDE OIL (NOV 26)', type: 'commodity' },
  'CRUDEOIL1!': { symbol: 'MCX:CRUDEOIL19NOV26FUT', display: 'CRUDE OIL (NOV 26)', type: 'commodity' },
  'MCX:CRUDEOIL': { symbol: 'MCX:CRUDEOIL19NOV26FUT', display: 'CRUDE OIL (NOV 26)', type: 'commodity' },
  'MCX:CRUDEOIL1!': { symbol: 'MCX:CRUDEOIL19NOV26FUT', display: 'CRUDE OIL (NOV 26)', type: 'commodity' },
  'CRUDEOIL19OCT26FUT': { symbol: 'MCX:CRUDEOIL19OCT26FUT', display: 'CRUDE OIL (OCT 26)', type: 'commodity' },
  'MCX:CRUDEOIL19OCT26FUT': { symbol: 'MCX:CRUDEOIL19OCT26FUT', display: 'CRUDE OIL (OCT 26)', type: 'commodity' },
  'CRUDEOIL19NOV26FUT': { symbol: 'MCX:CRUDEOIL19NOV26FUT', display: 'CRUDE OIL (NOV 26)', type: 'commodity' },
  'MCX:CRUDEOIL19NOV26FUT': { symbol: 'MCX:CRUDEOIL19NOV26FUT', display: 'CRUDE OIL (NOV 26)', type: 'commodity' },
  'CRUDEOIL18DEC26FUT': { symbol: 'MCX:CRUDEOIL18DEC26FUT', display: 'CRUDE OIL (DEC 26)', type: 'commodity' },
  'MCX:CRUDEOIL18DEC26FUT': { symbol: 'MCX:CRUDEOIL18DEC26FUT', display: 'CRUDE OIL (DEC 26)', type: 'commodity' },

  // Crude Oil Mini (MCX)
  'CRUDEOILM': { symbol: 'MCX:CRUDEOILM19NOV26FUT', display: 'CRUDE OIL MINI (NOV 26)', type: 'commodity' },
  'MCX:CRUDEOILM': { symbol: 'MCX:CRUDEOILM19NOV26FUT', display: 'CRUDE OIL MINI (NOV 26)', type: 'commodity' },
  'CRUDEOILM19OCT26FUT': { symbol: 'MCX:CRUDEOILM19OCT26FUT', display: 'CRUDE OIL MINI (OCT 26)', type: 'commodity' },
  'MCX:CRUDEOILM19OCT26FUT': { symbol: 'MCX:CRUDEOILM19OCT26FUT', display: 'CRUDE OIL MINI (OCT 26)', type: 'commodity' },
  'CRUDEOILM19NOV26FUT': { symbol: 'MCX:CRUDEOILM19NOV26FUT', display: 'CRUDE OIL MINI (NOV 26)', type: 'commodity' },
  'MCX:CRUDEOILM19NOV26FUT': { symbol: 'MCX:CRUDEOILM19NOV26FUT', display: 'CRUDE OIL MINI (NOV 26)', type: 'commodity' },
  'CRUDEOILM18DEC26FUT': { symbol: 'MCX:CRUDEOILM18DEC26FUT', display: 'CRUDE OIL MINI (DEC 26)', type: 'commodity' },
  'MCX:CRUDEOILM18DEC26FUT': { symbol: 'MCX:CRUDEOILM18DEC26FUT', display: 'CRUDE OIL MINI (DEC 26)', type: 'commodity' },

  // Natural Gas Active & Next 3 Months (MCX)
  'NATURALGAS': { symbol: 'MCX:NATURALGAS24NOV26FUT', display: 'NATURAL GAS (NOV 26)', type: 'commodity' },
  'NATURALGAS1!': { symbol: 'MCX:NATURALGAS24NOV26FUT', display: 'NATURAL GAS (NOV 26)', type: 'commodity' },
  'MCX:NATURALGAS': { symbol: 'MCX:NATURALGAS24NOV26FUT', display: 'NATURAL GAS (NOV 26)', type: 'commodity' },
  'MCX:NATURALGAS1!': { symbol: 'MCX:NATURALGAS24NOV26FUT', display: 'NATURAL GAS (NOV 26)', type: 'commodity' },
  'NATURALGAS27OCT26FUT': { symbol: 'MCX:NATURALGAS27OCT26FUT', display: 'NATURAL GAS (OCT 26)', type: 'commodity' },
  'MCX:NATURALGAS27OCT26FUT': { symbol: 'MCX:NATURALGAS27OCT26FUT', display: 'NATURAL GAS (OCT 26)', type: 'commodity' },
  'NATURALGAS24NOV26FUT': { symbol: 'MCX:NATURALGAS24NOV26FUT', display: 'NATURAL GAS (NOV 26)', type: 'commodity' },
  'MCX:NATURALGAS24NOV26FUT': { symbol: 'MCX:NATURALGAS24NOV26FUT', display: 'NATURAL GAS (NOV 26)', type: 'commodity' },
  'NATURALGAS28DEC26FUT': { symbol: 'MCX:NATURALGAS28DEC26FUT', display: 'NATURAL GAS (DEC 26)', type: 'commodity' },
  'MCX:NATURALGAS28DEC26FUT': { symbol: 'MCX:NATURALGAS28DEC26FUT', display: 'NATURAL GAS (DEC 26)', type: 'commodity' },

  // Gold (MCX)
  'GOLD': { symbol: 'MCX:GOLD1!', display: 'GOLD FUT', type: 'commodity' },
  'GOLD1!': { symbol: 'MCX:GOLD1!', display: 'GOLD FUT', type: 'commodity' },
  'MCX:GOLD1!': { symbol: 'MCX:GOLD1!', display: 'GOLD FUT', type: 'commodity' },

  // Silver (MCX)
  'SILVER': { symbol: 'MCX:SILVER1!', display: 'SILVER FUT', type: 'commodity' },
  'SILVER1!': { symbol: 'MCX:SILVER1!', display: 'SILVER FUT', type: 'commodity' },
  'MCX:SILVER1!': { symbol: 'MCX:SILVER1!', display: 'SILVER FUT', type: 'commodity' },
  'SILVER04DEC26FUT': { symbol: 'MCX:SILVER04DEC26FUT', display: 'SILVER (DEC 26)', type: 'commodity' },
  'MCX:SILVER04DEC26FUT': { symbol: 'MCX:SILVER04DEC26FUT', display: 'SILVER (DEC 26)', type: 'commodity' },

  // Zinc (MCX)
  'ZINC': { symbol: 'MCX:ZINC1!', display: 'ZINC FUT', type: 'commodity' },
  'ZINC1!': { symbol: 'MCX:ZINC1!', display: 'ZINC FUT', type: 'commodity' },
  'MCX:ZINC': { symbol: 'MCX:ZINC1!', display: 'ZINC FUT', type: 'commodity' },
  'MCX:ZINC1!': { symbol: 'MCX:ZINC1!', display: 'ZINC FUT', type: 'commodity' },
};

export function resolveSymbol(input: string): SymbolInfo {
  if (!input || !input.trim()) {
    return {
      rawSymbol: 'NSE:NIFTY',
      formattedSymbol: 'NSE:NIFTY',
      displayName: 'NIFTY 50',
      exchange: 'NSE',
      type: 'index',
    };
  }

  const clean = input.trim().toUpperCase();

  // Check known index map
  if (INDEX_MAP[clean]) {
    return {
      rawSymbol: clean,
      formattedSymbol: INDEX_MAP[clean].symbol,
      displayName: INDEX_MAP[clean].display,
      exchange: INDEX_MAP[clean].symbol.startsWith('BSE:') ? 'BSE' : (INDEX_MAP[clean].symbol.startsWith('MCX:') ? 'MCX' : 'NSE'),
      type: INDEX_MAP[clean].type || (INDEX_MAP[clean].symbol.startsWith('MCX:') ? 'commodity' : 'index'),
    };
  }

  // Handle prefix format "NSE:RELIANCE", "NFO:NIFTY29SEP2622700CE", or "BSE:RELIANCE"
  if (clean.includes(':')) {
    const parts = clean.split(':');
    const ex = parts[0] as 'NSE' | 'BSE' | 'MCX' | 'NFO';
    const ticker = parts[1];

    if (INDEX_MAP[ticker]) {
      return {
        rawSymbol: clean,
        formattedSymbol: INDEX_MAP[ticker].symbol,
        displayName: INDEX_MAP[ticker].display,
        exchange: ex || 'NSE',
        type: 'index',
      };
    }

    const isOption = ticker.endsWith('CE') || ticker.endsWith('PE') || ex === 'NFO';

    return {
      rawSymbol: clean,
      formattedSymbol: `${ex || (isOption ? 'NFO' : 'NSE')}:${ticker}`,
      displayName: ticker,
      exchange: ex || (isOption ? 'NFO' : 'NSE'),
      type: isOption ? 'option' : (ex === 'MCX' ? 'commodity' : 'stock'),
    };
  }

  // Check if unadorned option contract
  if (clean.endsWith('CE') || clean.endsWith('PE')) {
    return {
      rawSymbol: clean,
      formattedSymbol: `NFO:${clean}`,
      displayName: clean,
      exchange: 'NFO',
      type: 'option',
    };
  }

  // Default to NSE equity cash stock
  return {
    rawSymbol: clean,
    formattedSymbol: `NSE:${clean}`,
    displayName: clean,
    exchange: 'NSE',
    type: 'stock',
  };
}
