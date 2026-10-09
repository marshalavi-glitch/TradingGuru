import fs from 'fs';
import path from 'path';

const futures = JSON.parse(fs.readFileSync('scratch/futures_watchlist.json', 'utf8'));

const content = `export interface WatchlistItem {
  symbol: string;
  name: string;
  price: number;
}

export const WATCHLIST_DATA: Record<string, WatchlistItem[]> = {
  Futures: ${JSON.stringify(futures, null, 2)},
  Stocks: [
    { symbol: 'NSE:RELIANCE', name: 'RELIANCE', price: 1284 },
    { symbol: 'NSE:TATAMOTORS', name: 'TATA MOTORS', price: 890 },
    { symbol: 'NSE:HDFCBANK', name: 'HDFC BANK', price: 1712 },
    { symbol: 'NSE:ICICIBANK', name: 'ICICI BANK', price: 1296 },
    { symbol: 'NSE:SBIN', name: 'SBIN', price: 812 },
    { symbol: 'NSE:TCS', name: 'TCS', price: 3904 },
    { symbol: 'NSE:INFY', name: 'INFY', price: 1840 },
    { symbol: 'NSE:BHARTIARTL', name: 'BHARTI AIRTEL', price: 1650 },
    { symbol: 'NSE:LT', name: 'L&T', price: 3620 },
    { symbol: 'NSE:ITC', name: 'ITC', price: 485 }
  ],
  MCX: [
    { symbol: 'MCX:CRUDEOIL1!', name: 'CRUDE OIL', price: 6120 },
    { symbol: 'MCX:CRUDEOILM1!', name: 'CRUDE MINI', price: 6120 },
    { symbol: 'MCX:GOLD1!', name: 'GOLD', price: 76450 },
    { symbol: 'MCX:SILVER1!', name: 'SILVER', price: 91200 },
    { symbol: 'MCX:NATURALGAS1!', name: 'NATURAL GAS', price: 245 }
  ],
  Indices: [
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50', price: 22421 },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY', price: 54450 },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY', price: 24556 },
    { symbol: 'NSE:MIDCPNIFTY', name: 'MIDCAP NIFTY', price: 13562 },
    { symbol: 'BSE:SENSEX', name: 'SENSEX', price: 71909 }
  ]
};
`;

const targetDir = 'frontend/src/data';
if (!fs.existsSync(targetDir)) {
  fs.mkdirSync(targetDir, { recursive: true });
}

fs.writeFileSync(path.join(targetDir, 'watchlistData.ts'), content, 'utf8');
console.log('Successfully written frontend/src/data/watchlistData.ts with', futures.length, 'futures items!');
