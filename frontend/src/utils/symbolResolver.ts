/**
 * Symbol Resolver & Instrument Mapping Layer
 * Converts user input strings into authoritative TradingView instrument identifiers.
 */

export interface SymbolInfo {
  rawSymbol: string;
  formattedSymbol: string; // e.g. "NSE:RELIANCE"
  displayName: string;     // e.g. "RELIANCE"
  exchange: 'NSE' | 'BSE' | 'MCX' | 'INDEX';
  type: 'stock' | 'index' | 'futures' | 'commodity';
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
  'RELIANCE1!': { symbol: 'NSE:RELIANCE1!', display: 'RELIANCE FUT', type: 'futures' },
  'RELIANCE FUT': { symbol: 'NSE:RELIANCE1!', display: 'RELIANCE FUT', type: 'futures' },
  'NSE:RELIANCE1!': { symbol: 'NSE:RELIANCE1!', display: 'RELIANCE FUT', type: 'futures' },
  'CRUDEOIL': { symbol: 'MCX:CRUDEOIL1!', display: 'CRUDE OIL FUT', type: 'commodity' },
  'CRUDEOIL1!': { symbol: 'MCX:CRUDEOIL1!', display: 'CRUDE OIL FUT', type: 'commodity' },
  'MCX:CRUDEOIL1!': { symbol: 'MCX:CRUDEOIL1!', display: 'CRUDE OIL FUT', type: 'commodity' },
  'NATURALGAS': { symbol: 'MCX:NATURALGAS1!', display: 'NATURAL GAS FUT', type: 'commodity' },
  'NATURALGAS1!': { symbol: 'MCX:NATURALGAS1!', display: 'NATURAL GAS FUT', type: 'commodity' },
  'MCX:NATURALGAS1!': { symbol: 'MCX:NATURALGAS1!', display: 'NATURAL GAS FUT', type: 'commodity' },
  'GOLD': { symbol: 'MCX:GOLD1!', display: 'GOLD FUT', type: 'commodity' },
  'GOLD1!': { symbol: 'MCX:GOLD1!', display: 'GOLD FUT', type: 'commodity' },
  'MCX:GOLD1!': { symbol: 'MCX:GOLD1!', display: 'GOLD FUT', type: 'commodity' },
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
      exchange: INDEX_MAP[clean].symbol.startsWith('BSE:') ? 'BSE' : 'NSE',
      type: 'index',
    };
  }

  // Handle prefix format "NSE:RELIANCE" or "BSE:RELIANCE"
  if (clean.includes(':')) {
    const parts = clean.split(':');
    const ex = parts[0] as 'NSE' | 'BSE' | 'MCX';
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

    return {
      rawSymbol: clean,
      formattedSymbol: `${ex || 'NSE'}:${ticker}`,
      displayName: ticker,
      exchange: ex || 'NSE',
      type: ex === 'MCX' ? 'commodity' : 'stock',
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
