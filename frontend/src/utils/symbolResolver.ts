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

const INDEX_MAP: Record<string, { symbol: string; display: string }> = {
  'NIFTY': { symbol: 'NSE:NIFTY', display: 'NIFTY 50' },
  'NIFTY50': { symbol: 'NSE:NIFTY', display: 'NIFTY 50' },
  'NSE:NIFTY': { symbol: 'NSE:NIFTY', display: 'NIFTY 50' },
  'BANKNIFTY': { symbol: 'NSE:BANKNIFTY', display: 'BANK NIFTY' },
  'NSE:BANKNIFTY': { symbol: 'NSE:BANKNIFTY', display: 'BANK NIFTY' },
  'FINNIFTY': { symbol: 'NSE:FINNIFTY', display: 'FIN NIFTY' },
  'NSE:FINNIFTY': { symbol: 'NSE:FINNIFTY', display: 'FIN NIFTY' },
  'MIDCPNIFTY': { symbol: 'NSE:MIDCPNIFTY', display: 'MIDCAP NIFTY' },
  'SENSEX': { symbol: 'BSE:SENSEX', display: 'BSE SENSEX' },
  'BSE:SENSEX': { symbol: 'BSE:SENSEX', display: 'BSE SENSEX' },
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
