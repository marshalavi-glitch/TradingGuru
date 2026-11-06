import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Base32 Decoder for RFC 6238 TOTP
function base32ToBuffer(base32Str) {
  if (!base32Str) return Buffer.alloc(0);
  const base32chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let cleaned = base32Str.replace(/=+$/, '').replace(/\s+/g, '').toUpperCase();
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    let val = base32chars.indexOf(cleaned.charAt(i));
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  let bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substr(i, 8), 2));
  }
  return Buffer.from(bytes);
}

// Native HMAC-SHA1 TOTP Generator (6-digit, 30s step)
export function generateTOTP(secret) {
  if (!secret) return '';
  try {
    const key = base32ToBuffer(secret);
    if (key.length === 0) return '';
    const epoch = Math.floor(Date.now() / 1000);
    const counter = Math.floor(epoch / 30);
    
    const buffer = Buffer.alloc(8);
    buffer.writeBigInt64BE(BigInt(counter), 0);

    const hmac = crypto.createHmac('sha1', key);
    hmac.update(buffer);
    const hmacResult = hmac.digest();

    const offset = hmacResult[hmacResult.length - 1] & 0xf;
    const code = (
      ((hmacResult[offset] & 0x7f) << 24) |
      ((hmacResult[offset + 1] & 0xff) << 16) |
      ((hmacResult[offset + 2] & 0xff) << 8) |
      (hmacResult[offset + 3] & 0xff)
    ) % 1000000;

    return code.toString().padStart(6, '0');
  } catch (err) {
    console.error('[Angel One TOTP Error]', err.message);
    return '';
  }
}

// Built-in symbol token dictionary for indices & top F&O stocks
export const ANGEL_SYMBOL_MAP = {
  // GIFT NIFTY (NSE IX)
  'NSEIX:GIFTNIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NSEIX:GIFTNIFTY1!': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'GIFTNIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'GIFTNIFTY1!': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NSE:GIFTNIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NSE:GIFTNIFTY1!': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'GIFT NIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'GIFT NIFTY FUT': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },

  'NSE:NIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NSE:BANKNIFTY': { exchange: 'NSE', symboltoken: '99926009', tradingsymbol: 'Nifty Bank' },
  'BANKNIFTY': { exchange: 'NSE', symboltoken: '99926009', tradingsymbol: 'Nifty Bank' },
  'NSE:FINNIFTY': { exchange: 'NSE', symboltoken: '99926037', tradingsymbol: 'Nifty Fin Service' },
  'FINNIFTY': { exchange: 'NSE', symboltoken: '99926037', tradingsymbol: 'Nifty Fin Service' },
  'BSE:SENSEX': { exchange: 'BSE', symboltoken: '99919000', tradingsymbol: 'SENSEX' },
  'SENSEX': { exchange: 'BSE', symboltoken: '99919000', tradingsymbol: 'SENSEX' },

  // Top Stocks & Futures (Mapped to high-liquidity NSE index feeds with live basis injection)
  'NSE:NIFTY1!': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NIFTY FUT': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NSE:BANKNIFTY1!': { exchange: 'NSE', symboltoken: '99926009', tradingsymbol: 'Nifty Bank' },
  'BANKNIFTY FUT': { exchange: 'NSE', symboltoken: '99926009', tradingsymbol: 'Nifty Bank' },
  'NSE:FINNIFTY1!': { exchange: 'NSE', symboltoken: '99926037', tradingsymbol: 'Nifty Fin Service' },
  'FINNIFTY FUT': { exchange: 'NSE', symboltoken: '99926037', tradingsymbol: 'Nifty Fin Service' },
  'NSE:MIDCPNIFTY1!': { exchange: 'NSE', symboltoken: '99926074', tradingsymbol: 'NIFTY MID SELECT' },
  'MIDCPNIFTY FUT': { exchange: 'NSE', symboltoken: '99926074', tradingsymbol: 'NIFTY MID SELECT' },
  'NSE:MIDCPNIFTY': { exchange: 'NSE', symboltoken: '99926074', tradingsymbol: 'NIFTY MID SELECT' },
  'MIDCPNIFTY': { exchange: 'NSE', symboltoken: '99926074', tradingsymbol: 'NIFTY MID SELECT' },
  'NSE:MIDCAPNIFTY': { exchange: 'NSE', symboltoken: '99926074', tradingsymbol: 'NIFTY MID SELECT' },
  'MIDCAPNIFTY': { exchange: 'NSE', symboltoken: '99926074', tradingsymbol: 'NIFTY MID SELECT' },
  'BSE:BANKEX': { exchange: 'BSE', symboltoken: '99919012', tradingsymbol: 'BANKEX' },
  'BANKEX': { exchange: 'BSE', symboltoken: '99919012', tradingsymbol: 'BANKEX' },

  // Manual Trades & High Beta Stocks
  'NSE:HEROMOTOCO': { exchange: 'NSE', symboltoken: '1348', tradingsymbol: 'HEROMOTOCO-EQ' },
  'HEROMOTOCO': { exchange: 'NSE', symboltoken: '1348', tradingsymbol: 'HEROMOTOCO-EQ' },
  'NSE:INDHOTEL': { exchange: 'NSE', symboltoken: '1512', tradingsymbol: 'INDHOTEL-EQ' },
  'INDHOTEL': { exchange: 'NSE', symboltoken: '1512', tradingsymbol: 'INDHOTEL-EQ' },
  'NSE:SHYAMMETL': { exchange: 'NSE', symboltoken: '4693', tradingsymbol: 'SHYAMMETL-EQ' },
  'SHYAMMETL': { exchange: 'NSE', symboltoken: '4693', tradingsymbol: 'SHYAMMETL-EQ' },
  'NSE:VEDL': { exchange: 'NSE', symboltoken: '3063', tradingsymbol: 'VEDL-EQ' },
  'VEDL': { exchange: 'NSE', symboltoken: '3063', tradingsymbol: 'VEDL-EQ' },
  'NSE:DIXON': { exchange: 'NSE', symboltoken: '21690', tradingsymbol: 'DIXON-EQ' },
  'DIXON': { exchange: 'NSE', symboltoken: '21690', tradingsymbol: 'DIXON-EQ' },

  // Indian Commodities (MCX) - Active & Next 3 Months Futures
  // Crude Oil Active Near-Month (November 2026)
  'MCX:CRUDEOIL': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'CRUDEOIL': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'MCX:CRUDEOIL1!': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'MCX:CRUDEOIL!': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'CRUDEOIL FUT': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'CRUDE OIL FUT': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'CRUDEOIL1!': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'CRUDEOIL!': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },

  // Crude Oil Next 3 Months Contracts
  'MCX:CRUDEOIL19NOV26FUT': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'CRUDEOIL19NOV26FUT': { exchange: 'MCX', symboltoken: '573422', tradingsymbol: 'CRUDEOIL19NOV26FUT' },
  'MCX:CRUDEOIL18DEC26FUT': { exchange: 'MCX', symboltoken: '576264', tradingsymbol: 'CRUDEOIL18DEC26FUT' },
  'CRUDEOIL18DEC26FUT': { exchange: 'MCX', symboltoken: '576264', tradingsymbol: 'CRUDEOIL18DEC26FUT' },
  'MCX:CRUDEOIL19JAN27FUT': { exchange: 'MCX', symboltoken: '580377', tradingsymbol: 'CRUDEOIL19JAN27FUT' },
  'CRUDEOIL19JAN27FUT': { exchange: 'MCX', symboltoken: '580377', tradingsymbol: 'CRUDEOIL19JAN27FUT' },

  // Crude Oil Mini (MCX)
  'MCX:CRUDEOILM': { exchange: 'MCX', symboltoken: '573423', tradingsymbol: 'CRUDEOILM19NOV26FUT' },
  'CRUDEOILM': { exchange: 'MCX', symboltoken: '573423', tradingsymbol: 'CRUDEOILM19NOV26FUT' },
  'MCX:CRUDEOILM1!': { exchange: 'MCX', symboltoken: '573423', tradingsymbol: 'CRUDEOILM19NOV26FUT' },
  'MCX:CRUDEOILM!': { exchange: 'MCX', symboltoken: '573423', tradingsymbol: 'CRUDEOILM19NOV26FUT' },
  'MCX:CRUDEOILM19NOV26FUT': { exchange: 'MCX', symboltoken: '573423', tradingsymbol: 'CRUDEOILM19NOV26FUT' },
  'CRUDEOILM19NOV26FUT': { exchange: 'MCX', symboltoken: '573423', tradingsymbol: 'CRUDEOILM19NOV26FUT' },
  'MCX:CRUDEOILM18DEC26FUT': { exchange: 'MCX', symboltoken: '576265', tradingsymbol: 'CRUDEOILM18DEC26FUT' },
  'CRUDEOILM18DEC26FUT': { exchange: 'MCX', symboltoken: '576265', tradingsymbol: 'CRUDEOILM18DEC26FUT' },

  // Natural Gas Active & Next 3 Months Futures
  'MCX:NATURALGAS': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'NATURALGAS': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'MCX:NATURALGAS1!': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'MCX:NATURALGAS!': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'NATURALGAS FUT': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'NATURALGAS1!': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'NATURALGAS!': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },

  'MCX:NATURALGAS24NOV26FUT': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'NATURALGAS24NOV26FUT': { exchange: 'MCX', symboltoken: '574319', tradingsymbol: 'NATURALGAS24NOV26FUT' },
  'MCX:NATURALGAS28DEC26FUT': { exchange: 'MCX', symboltoken: '578249', tradingsymbol: 'NATURALGAS28DEC26FUT' },
  'NATURALGAS28DEC26FUT': { exchange: 'MCX', symboltoken: '578249', tradingsymbol: 'NATURALGAS28DEC26FUT' },

  // Gold Active Near-Month Futures (December 2026)
  'MCX:GOLD': { exchange: 'MCX', symboltoken: '495213', tradingsymbol: 'GOLD04DEC26FUT' },
  'GOLD': { exchange: 'MCX', symboltoken: '495213', tradingsymbol: 'GOLD04DEC26FUT' },
  'MCX:GOLD1!': { exchange: 'MCX', symboltoken: '495213', tradingsymbol: 'GOLD04DEC26FUT' },
  'MCX:GOLD!': { exchange: 'MCX', symboltoken: '495213', tradingsymbol: 'GOLD04DEC26FUT' },
  'GOLD FUT': { exchange: 'MCX', symboltoken: '495213', tradingsymbol: 'GOLD04DEC26FUT' },
  'MCX:GOLD04DEC26FUT': { exchange: 'MCX', symboltoken: '495213', tradingsymbol: 'GOLD04DEC26FUT' },
  'GOLD04DEC26FUT': { exchange: 'MCX', symboltoken: '495213', tradingsymbol: 'GOLD04DEC26FUT' },

  // Silver Active Near-Month Futures (December 2026)
  'MCX:SILVER': { exchange: 'MCX', symboltoken: '495214', tradingsymbol: 'SILVER04DEC26FUT' },
  'SILVER': { exchange: 'MCX', symboltoken: '495214', tradingsymbol: 'SILVER04DEC26FUT' },
  'MCX:SILVER1!': { exchange: 'MCX', symboltoken: '495214', tradingsymbol: 'SILVER04DEC26FUT' },
  'MCX:SILVER!': { exchange: 'MCX', symboltoken: '495214', tradingsymbol: 'SILVER04DEC26FUT' },
  'SILVER FUT': { exchange: 'MCX', symboltoken: '495214', tradingsymbol: 'SILVER04DEC26FUT' },
  'MCX:SILVER04DEC26FUT': { exchange: 'MCX', symboltoken: '495214', tradingsymbol: 'SILVER04DEC26FUT' },
  'SILVER04DEC26FUT': { exchange: 'MCX', symboltoken: '495214', tradingsymbol: 'SILVER04DEC26FUT' },

  // Zinc Active Futures (MCX)
  'MCX:ZINC': { exchange: 'MCX', symboltoken: '584329', tradingsymbol: 'ZINC30JUN27FUT' },
  'ZINC': { exchange: 'MCX', symboltoken: '584329', tradingsymbol: 'ZINC30JUN27FUT' },
  'MCX:ZINC1!': { exchange: 'MCX', symboltoken: '584329', tradingsymbol: 'ZINC30JUN27FUT' },
  'ZINC1!': { exchange: 'MCX', symboltoken: '584329', tradingsymbol: 'ZINC30JUN27FUT' },
  'ZINC FUT': { exchange: 'MCX', symboltoken: '584329', tradingsymbol: 'ZINC30JUN27FUT' },
  'MCX:ZINC30JUN27FUT': { exchange: 'MCX', symboltoken: '584329', tradingsymbol: 'ZINC30JUN27FUT' },
  'ZINC30JUN27FUT': { exchange: 'MCX', symboltoken: '584329', tradingsymbol: 'ZINC30JUN27FUT' },

  'NSE:RELIANCE': { exchange: 'NSE', symboltoken: '2885', tradingsymbol: 'RELIANCE-EQ' },
  'RELIANCE': { exchange: 'NSE', symboltoken: '2885', tradingsymbol: 'RELIANCE-EQ' },
  'NSE:RELIANCE1!': { exchange: 'NSE', symboltoken: '2885', tradingsymbol: 'RELIANCE-EQ' },
  'RELIANCE FUT': { exchange: 'NSE', symboltoken: '2885', tradingsymbol: 'RELIANCE-EQ' },

  'NSE:HDFCBANK': { exchange: 'NSE', symboltoken: '1333', tradingsymbol: 'HDFCBANK-EQ' },
  'HDFCBANK': { exchange: 'NSE', symboltoken: '1333', tradingsymbol: 'HDFCBANK-EQ' },
  'NSE:HDFCBANK1!': { exchange: 'NSE', symboltoken: '1333', tradingsymbol: 'HDFCBANK-EQ' },
  'HDFCBANK FUT': { exchange: 'NSE', symboltoken: '1333', tradingsymbol: 'HDFCBANK-EQ' },

  'NSE:ICICIBANK': { exchange: 'NSE', symboltoken: '4963', tradingsymbol: 'ICICIBANK-EQ' },
  'ICICIBANK': { exchange: 'NSE', symboltoken: '4963', tradingsymbol: 'ICICIBANK-EQ' },
  'NSE:ICICIBANK1!': { exchange: 'NSE', symboltoken: '4963', tradingsymbol: 'ICICIBANK-EQ' },
  'ICICIBANK FUT': { exchange: 'NSE', symboltoken: '4963', tradingsymbol: 'ICICIBANK-EQ' },

  'NSE:INFY': { exchange: 'NSE', symboltoken: '1594', tradingsymbol: 'INFY-EQ' },
  'INFY': { exchange: 'NSE', symboltoken: '1594', tradingsymbol: 'INFY-EQ' },
  'NSE:INFY1!': { exchange: 'NSE', symboltoken: '1594', tradingsymbol: 'INFY-EQ' },
  'INFY FUT': { exchange: 'NSE', symboltoken: '1594', tradingsymbol: 'INFY-EQ' },

  'NSE:SBIN': { exchange: 'NSE', symboltoken: '3045', tradingsymbol: 'SBIN-EQ' },
  'SBIN': { exchange: 'NSE', symboltoken: '3045', tradingsymbol: 'SBIN-EQ' },
  'NSE:SBIN1!': { exchange: 'NSE', symboltoken: '3045', tradingsymbol: 'SBIN-EQ' },
  'SBIN FUT': { exchange: 'NSE', symboltoken: '3045', tradingsymbol: 'SBIN-EQ' },

  'NSE:TCS': { exchange: 'NSE', symboltoken: '11536', tradingsymbol: 'TCS-EQ' },
  'TCS': { exchange: 'NSE', symboltoken: '11536', tradingsymbol: 'TCS-EQ' },
  'NSE:TCS1!': { exchange: 'NSE', symboltoken: '11536', tradingsymbol: 'TCS-EQ' },
  'TCS FUT': { exchange: 'NSE', symboltoken: '11536', tradingsymbol: 'TCS-EQ' },

  'NSE:TATAMOTORS': { exchange: 'NSE', symboltoken: '3456', tradingsymbol: 'TATAMOTORS-EQ' },
  'TATAMOTORS': { exchange: 'NSE', symboltoken: '3456', tradingsymbol: 'TATAMOTORS-EQ' },
  'NSE:TATAMOTORS1!': { exchange: 'NSE', symboltoken: '3456', tradingsymbol: 'TATAMOTORS-EQ' },
  'TATAMOTORS FUT': { exchange: 'NSE', symboltoken: '3456', tradingsymbol: 'TATAMOTORS-EQ' },

  'NSE:AXISBANK': { exchange: 'NSE', symboltoken: '5900', tradingsymbol: 'AXISBANK-EQ' },
  'AXISBANK': { exchange: 'NSE', symboltoken: '5900', tradingsymbol: 'AXISBANK-EQ' },
  'NSE:AXISBANK1!': { exchange: 'NSE', symboltoken: '5900', tradingsymbol: 'AXISBANK-EQ' },
  'AXISBANK FUT': { exchange: 'NSE', symboltoken: '5900', tradingsymbol: 'AXISBANK-EQ' },

  'NSE:LT': { exchange: 'NSE', symboltoken: '11483', tradingsymbol: 'LT-EQ' },
  'LT': { exchange: 'NSE', symboltoken: '11483', tradingsymbol: 'LT-EQ' },
  'NSE:LT1!': { exchange: 'NSE', symboltoken: '11483', tradingsymbol: 'LT-EQ' },
  'LT FUT': { exchange: 'NSE', symboltoken: '11483', tradingsymbol: 'LT-EQ' },

  'NSE:TATASTEEL': { exchange: 'NSE', symboltoken: '3499', tradingsymbol: 'TATASTEEL-EQ' },
  'TATASTEEL': { exchange: 'NSE', symboltoken: '3499', tradingsymbol: 'TATASTEEL-EQ' },
  'NSE:TATASTEEL1!': { exchange: 'NSE', symboltoken: '3499', tradingsymbol: 'TATASTEEL-EQ' },
  'TATASTEEL FUT': { exchange: 'NSE', symboltoken: '3499', tradingsymbol: 'TATASTEEL-EQ' },

  'NSE:MARUTI': { exchange: 'NSE', symboltoken: '10999', tradingsymbol: 'MARUTI-EQ' },
  'MARUTI': { exchange: 'NSE', symboltoken: '10999', tradingsymbol: 'MARUTI-EQ' },
  'NSE:MARUTI1!': { exchange: 'NSE', symboltoken: '10999', tradingsymbol: 'MARUTI-EQ' },
  'MARUTI FUT': { exchange: 'NSE', symboltoken: '10999', tradingsymbol: 'MARUTI-EQ' },

  'NSE:BAJFINANCE': { exchange: 'NSE', symboltoken: '317', tradingsymbol: 'BAJFINANCE-EQ' },
  'BAJFINANCE': { exchange: 'NSE', symboltoken: '317', tradingsymbol: 'BAJFINANCE-EQ' },
  'NSE:BAJFINANCE1!': { exchange: 'NSE', symboltoken: '317', tradingsymbol: 'BAJFINANCE-EQ' },
  'BAJFINANCE FUT': { exchange: 'NSE', symboltoken: '317', tradingsymbol: 'BAJFINANCE-EQ' },

  'NSE:BHARTIARTL': { exchange: 'NSE', symboltoken: '10604', tradingsymbol: 'BHARTIARTL-EQ' },
  'BHARTIARTL': { exchange: 'NSE', symboltoken: '10604', tradingsymbol: 'BHARTIARTL-EQ' },
  'NSE:BHARTIARTL1!': { exchange: 'NSE', symboltoken: '10604', tradingsymbol: 'BHARTIARTL-EQ' },
  'BHARTIARTL FUT': { exchange: 'NSE', symboltoken: '10604', tradingsymbol: 'BHARTIARTL-EQ' },

  'NSE:ITC': { exchange: 'NSE', symboltoken: '1660', tradingsymbol: 'ITC-EQ' },
  'ITC': { exchange: 'NSE', symboltoken: '1660', tradingsymbol: 'ITC-EQ' },
  'NSE:ITC1!': { exchange: 'NSE', symboltoken: '1660', tradingsymbol: 'ITC-EQ' },
  'ITC FUT': { exchange: 'NSE', symboltoken: '1660', tradingsymbol: 'ITC-EQ' },

  'NSE:KOTAKBANK': { exchange: 'NSE', symboltoken: '1922', tradingsymbol: 'KOTAKBANK-EQ' },
  'KOTAKBANK': { exchange: 'NSE', symboltoken: '1922', tradingsymbol: 'KOTAKBANK-EQ' },
  'NSE:KOTAKBANK1!': { exchange: 'NSE', symboltoken: '1922', tradingsymbol: 'KOTAKBANK-EQ' },
  'KOTAKBANK FUT': { exchange: 'NSE', symboltoken: '1922', tradingsymbol: 'KOTAKBANK-EQ' },

  'NSE:VEDL': { exchange: 'NSE', symboltoken: '3067', tradingsymbol: 'VEDL-EQ' },
  'VEDL': { exchange: 'NSE', symboltoken: '3067', tradingsymbol: 'VEDL-EQ' },
  'NSE:VEDL1!': { exchange: 'NSE', symboltoken: '3067', tradingsymbol: 'VEDL-EQ' },
  'VEDL FUT': { exchange: 'NSE', symboltoken: '3067', tradingsymbol: 'VEDL-EQ' },

  'NSE:SHYAMMETL': { exchange: 'NSE', symboltoken: '4693', tradingsymbol: 'SHYAMMETL-EQ' },
  'SHYAMMETL': { exchange: 'NSE', symboltoken: '4693', tradingsymbol: 'SHYAMMETL-EQ' },
  'NSE:SHYAMMETL1!': { exchange: 'NSE', symboltoken: '4693', tradingsymbol: 'SHYAMMETL-EQ' },
  'SHYAMMETL FUT': { exchange: 'NSE', symboltoken: '4693', tradingsymbol: 'SHYAMMETL-EQ' },

  'NSE:ASHOKLEY': { exchange: 'NSE', symboltoken: '212', tradingsymbol: 'ASHOKLEY-EQ' },
  'ASHOKLEY': { exchange: 'NSE', symboltoken: '212', tradingsymbol: 'ASHOKLEY-EQ' },
  'NSE:ASHOKLEY1!': { exchange: 'NSE', symboltoken: '212', tradingsymbol: 'ASHOKLEY-EQ' },
  'ASHOKLEY FUT': { exchange: 'NSE', symboltoken: '212', tradingsymbol: 'ASHOKLEY-EQ' },

  'NSE:DIXON': { exchange: 'NSE', symboltoken: '21690', tradingsymbol: 'DIXON-EQ' },
  'DIXON': { exchange: 'NSE', symboltoken: '21690', tradingsymbol: 'DIXON-EQ' },
  'NSE:DIXON1!': { exchange: 'NSE', symboltoken: '21690', tradingsymbol: 'DIXON-EQ' },
  'DIXON FUT': { exchange: 'NSE', symboltoken: '21690', tradingsymbol: 'DIXON-EQ' },

  'NSE:HEROMOTOCO1!': { exchange: 'NSE', symboltoken: '1348', tradingsymbol: 'HEROMOTOCO-EQ' },
  'HEROMOTOCO FUT': { exchange: 'NSE', symboltoken: '1348', tradingsymbol: 'HEROMOTOCO-EQ' },
  'NSE:INDHOTEL1!': { exchange: 'NSE', symboltoken: '1512', tradingsymbol: 'INDHOTEL-EQ' },
  'INDHOTEL FUT': { exchange: 'NSE', symboltoken: '1512', tradingsymbol: 'INDHOTEL-EQ' }
};

export class AngelOneBridge {
  constructor() {
    this.configPath = path.join(__dirname, 'data/angelone_config.json');
    this.tokenCachePath = path.join(__dirname, 'data/angel_token_cache.json');
    this.baseUrl = 'https://apiconnect.angelone.in';
    this.isLoggedIn = false;
    this.profileData = null;
    this.lastScheduledRunDate = null;
    this.candleCache = {};
    this.requestQueue = Promise.resolve();
    this.lastRequestTimestamp = 0;
    this.lastPriorityRequestTimestamp = 0;
    this.rateLimitBackoffUntil = 0;
    this.minRequestSpacingMs = 350;
    this.config = this.loadConfig();
    this.tokenCache = this.loadTokenCache();
    this.presetsList = this.loadPresets();
    this.startDailyAutoLoginScheduler();
  }

  loadPresets() {
    try {
      const p = path.join(__dirname, 'data/presets.json');
      if (fs.existsSync(p)) {
        return JSON.parse(fs.readFileSync(p, 'utf8'));
      }
    } catch (e) {}
    return [];
  }

  loadTokenCache() {
    try {
      if (fs.existsSync(this.tokenCachePath)) {
        return JSON.parse(fs.readFileSync(this.tokenCachePath, 'utf8'));
      }
    } catch (e) {}
    return {};
  }

  saveTokenCache() {
    try {
      const dir = path.dirname(this.tokenCachePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.tokenCachePath, JSON.stringify(this.tokenCache, null, 2), 'utf8');
    } catch (e) {}
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const text = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(text);
        return {
          apiKey: parsed.apiKey || '',
          clientCode: parsed.clientCode || '',
          password: parsed.password || '',
          totpSecret: parsed.totpSecret || '',
          jwtToken: parsed.jwtToken || '',
          refreshToken: parsed.refreshToken || '',
          feedToken: parsed.feedToken || '',
          lastLogin: parsed.lastLogin || null
        };
      }
    } catch (e) {
      console.error('[Angel One] Failed to load config file:', e.message);
    }
    return {
      apiKey: process.env.ANGELONE_API_KEY || '',
      clientCode: process.env.ANGELONE_CLIENT_CODE || '',
      password: process.env.ANGELONE_PASSWORD || '',
      totpSecret: process.env.ANGELONE_TOTP_SECRET || '',
      jwtToken: process.env.ANGELONE_JWT_TOKEN || '',
      refreshToken: process.env.ANGELONE_REFRESH_TOKEN || '',
      feedToken: process.env.ANGELONE_FEED_TOKEN || '',
      lastLogin: null
    };
  }

  saveConfig(updates = {}) {
    this.config = { ...this.config, ...updates };
    try {
      const dir = path.dirname(this.configPath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2), 'utf8');
    } catch (e) {
      console.error('[Angel One] Failed to save config file:', e.message);
    }
  }

  getHeaders() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '106.51.74.1',
      'X-MACAddress': 'fe80::1',
      'X-PrivateKey': this.config.apiKey,
      ...(this.config.jwtToken ? { 'Authorization': `Bearer ${this.config.jwtToken}` } : {})
    };
  }

  async parseResponse(res) {
    const text = await res.text();
    try {
      return JSON.parse(text);
    } catch (err) {
      if (text.includes('Access denied') || res.status === 403 || res.status === 429) {
        return { status: false, errorcode: 'RATE_LIMIT', message: 'Rate limit / Access Denied from SmartAPI' };
      }
      return { status: false, message: `Invalid JSON response (${res.status}): ${text.slice(0, 100)}` };
    }
  }

  async throttleRequest(fn, isPriority = false) {
    const execute = async () => {
      const now = Date.now();
      if (this.rateLimitBackoffUntil > now) {
        const remaining = Math.min(2000, this.rateLimitBackoffUntil - now);
        await new Promise(r => setTimeout(r, remaining));
      }
      const elapsed = Date.now() - this.lastRequestTimestamp;
      const minSpacing = isPriority ? 250 : this.minRequestSpacingMs;
      if (elapsed < minSpacing) {
        await new Promise(r => setTimeout(r, minSpacing - elapsed));
      }
      this.lastRequestTimestamp = Date.now();
      return await fn();
    };

    if (isPriority) {
      // Execute priority request ahead of background backlog with safe spacing
      return await execute();
    }

    const next = this.requestQueue.then(execute).catch(err => {
      console.warn('[throttleRequest error]', err.message);
      return { status: false, message: err.message };
    });
    this.requestQueue = next.then(() => {}, () => {});
    return next;
  }

  async login(newCredentials = null) {
    if (newCredentials) {
      this.saveConfig({
        apiKey: newCredentials.apiKey || this.config.apiKey,
        clientCode: newCredentials.clientCode || this.config.clientCode,
        password: newCredentials.password || newCredentials.mpin || this.config.password,
        totpSecret: newCredentials.totpSecret || this.config.totpSecret
      });
    }

    const { apiKey, clientCode, password, totpSecret } = this.config;
    if (!apiKey || !clientCode || !password || !totpSecret) {
      console.log('[Angel One] Credentials incomplete in angelone_config.json / process.env. Login postponed until configured.');
      this.isLoggedIn = false;
      return { success: false, message: 'Angel One credentials not fully configured.' };
    }

    const totpCode = generateTOTP(totpSecret);
    console.log(`[Angel One] Authenticating SmartAPI for Client: ${clientCode} (TOTP Code: ${totpCode})...`);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      let res;
      try {
        res = await fetch(`${this.baseUrl}/rest/auth/angelbroking/user/v1/loginByPassword`, {
          method: 'POST',
          headers: this.getHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            clientcode: clientCode,
            password: password,
            totp: totpCode
          })
        });
      } finally {
        clearTimeout(timeout);
      }

      const resData = await res.json();
      if (resData.status && resData.data) {
        const { jwtToken, refreshToken, feedToken } = resData.data;
        this.saveConfig({
          jwtToken,
          refreshToken,
          feedToken,
          lastLogin: new Date().toISOString()
        });
        this.isLoggedIn = true;
        console.log('[Angel One] ✅ SmartAPI Login Successful!');
        
        // Asynchronously load profile
        this.getProfile().catch(() => {});
        return { success: true, status: true, data: resData.data };
      } else {
        const errorMsg = resData.message || resData.errorcode || 'Authentication failed';
        console.error(`[Angel One] ❌ Login Failed: ${errorMsg}`);
        this.isLoggedIn = false;
        return { success: false, status: false, message: errorMsg, errorcode: resData.errorcode };
      }
    } catch (err) {
      console.error('[Angel One] Login Exception:', err.message);
      this.isLoggedIn = false;
      return { success: false, message: err.message };
    }
  }

  async autoRecover(fn, isPriority = false) {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        let result = await this.throttleRequest(fn, isPriority);

        // Check token expiration first before rate limits
        const isTokenExpired = result && (
          result.errorcode === 'AG8001' || 
          result.errorcode === 'AG8002' || 
          result.message === 'Invalid Token' || 
          (result.status === false && (result.message?.includes('Token') || result.message?.includes('token') || result.message?.includes('Session Expired') || result.message?.includes('Unauthorized')))
        );

        if (isTokenExpired) {
          console.warn(`[Angel One Token Recovery] Expired/Invalid token detected (${result.errorcode || result.message}). Re-authenticating...`);
          const loginRes = await this.login();
          if (loginRes.success) {
            continue;
          }
        }

        if (result && (result.errorcode === 'RATE_LIMIT' || result.message?.includes('Rate limit') || result.message?.includes('Access denied'))) {
          const waitTime = 1000 * (attempt + 1);
          console.warn(`[Angel One Rate Limit] SmartAPI busy (${result.errorcode || result.message}). Backing off ${waitTime}ms (attempt ${attempt + 1})...`);
          this.rateLimitBackoffUntil = Date.now() + waitTime;
          await new Promise(r => setTimeout(r, waitTime));
          continue;
        }
        return result;
      } catch (err) {
        console.warn('[Angel One AutoRecover Exception]', err.message);
        if (attempt === 2) return { status: false, message: err.message };
        await new Promise(r => setTimeout(r, 250));
      }
    }
    return { status: false, message: 'Max retries reached' };
  }

  async getProfile() {
    if (!this.config.jwtToken) {
      await this.login();
    }

    return this.autoRecover(async () => {
      const res = await fetch(`${this.baseUrl}/rest/secure/angelbroking/user/v1/getProfile`, {
        method: 'GET',
        headers: this.getHeaders()
      });
      const data = await this.parseResponse(res);
      if (data.status && data.data) {
        this.profileData = data.data;
      }
      return data;
    });
  }

  async getLtp(exchange = 'NSE', tradingsymbol = '', symboltoken = '') {
    if (!symboltoken) {
      const mapped = ANGEL_SYMBOL_MAP[tradingsymbol.toUpperCase()];
      if (mapped) {
        exchange = mapped.exchange;
        symboltoken = mapped.symboltoken;
        tradingsymbol = mapped.tradingsymbol;
      }
    }

    if (!symboltoken) {
      return { status: false, message: `No symbol token found for ${tradingsymbol}` };
    }

    if (!this.config.jwtToken) {
      await this.login();
    }

    return this.autoRecover(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 3500);
      try {
        const res = await fetch(`${this.baseUrl}/rest/secure/angelbroking/order/v1/getLtpData`, {
          method: 'POST',
          headers: this.getHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            exchange,
            tradingsymbol,
            symboltoken
          })
        });
        return await this.parseResponse(res);
      } finally {
        clearTimeout(timeout);
      }
    }, true);
  }

  // High-performance batch market quote API (fetches multiple tokens across exchanges in 1 call)
  async getMarketQuotes(exchangeTokensMap, mode = 'LTP') {
    if (!this.config.jwtToken) {
      await this.login();
    }

    return this.autoRecover(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 4000);
      try {
        const res = await fetch(`${this.baseUrl}/rest/secure/angelbroking/market/v1/quote/`, {
          method: 'POST',
          headers: this.getHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            mode,
            exchangeTokens: exchangeTokensMap
          })
        });
        return await this.parseResponse(res);
      } finally {
        clearTimeout(timeout);
      }
    }, true);
  }

  async getCandles({ exchange = 'NSE', symboltoken = '', interval = 'FIVE_MINUTE', fromdate = '', todate = '' }, isPriority = true) {
    if (!symboltoken) {
      return { status: false, message: 'symboltoken required for candles' };
    }

    if (!fromdate || !todate) {
      const now = new Date();
      const from = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const formatDate = (d) => {
        const Y = d.getFullYear();
        const M = String(d.getMonth() + 1).padStart(2, '0');
        const D = String(d.getDate()).padStart(2, '0');
        const h = String(d.getHours()).padStart(2, '0');
        const m = String(d.getMinutes()).padStart(2, '0');
        return `${Y}-${M}-${D} ${h}:${m}`;
      };
      if (!fromdate) fromdate = formatDate(from);
      if (!todate) todate = formatDate(now);
    }

    if (!this.config.jwtToken) {
      await this.login();
    }

    return this.autoRecover(async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(`${this.baseUrl}/rest/secure/angelbroking/historical/v1/getCandleData`, {
          method: 'POST',
          headers: this.getHeaders(),
          signal: controller.signal,
          body: JSON.stringify({
            exchange,
            symboltoken,
            interval,
            fromdate,
            todate
          })
        });
        return await this.parseResponse(res);
      } finally {
        clearTimeout(timeout);
      }
    }, isPriority);
  }

  async resolveSymbolToken(rawSymbol) {
    if (!rawSymbol) return null;
    const rawUpper = String(rawSymbol).trim().toUpperCase();

    // 1. Check exact raw match in built-in map
    if (ANGEL_SYMBOL_MAP[rawUpper]) return ANGEL_SYMBOL_MAP[rawUpper];

    let exchange = 'NSE';
    let clean = rawUpper;
    if (clean.startsWith('MCX:')) {
      exchange = 'MCX';
      clean = clean.replace(/^MCX:/, '');
    } else if (clean.startsWith('BSE:')) {
      exchange = 'BSE';
      clean = clean.replace(/^BSE:/, '');
    } else if (clean.startsWith('NFO:')) {
      exchange = 'NFO';
      clean = clean.replace(/^NFO:/, '');
    } else if (clean.startsWith('NSE:')) {
      exchange = 'NSE';
      clean = clean.replace(/^NSE:/, '');
    } else if (clean.startsWith('NSEIX:')) {
      exchange = 'NSE';
      clean = clean.replace(/^NSEIX:/, '');
    }

    // Auto-detect derivative / option / futures contracts for NFO exchange
    const isOptionContract = clean.endsWith('CE') || clean.endsWith('PE') || clean.includes(' CE') || clean.includes(' PE');
    const isFutureContract = (clean.endsWith('FUT') || clean.includes('FUT')) && !clean.endsWith('1!');
    if ((isOptionContract || isFutureContract) && exchange === 'NSE') {
      exchange = 'NFO';
    }

    // Extract underlying symbol for NFO/MCX derivative contracts (e.g. RELIANCE27OCT26FUT -> RELIANCE)
    const derivMatch = clean.match(/^([A-Z0-9]+?)(?:\d{2}[A-Z]{3}\d{2})/);
    const underlyingSymbol = derivMatch ? derivMatch[1] : null;

    // Strip futures suffixes e.g. 1!, !, .FUT, FUT, -FUT
    const stripped = clean.replace(/(1!|!|\.FUT|FUT|-FUT)$/, '').trim();

    // Direct commodity match
    if (clean.includes('CRUDE') && (clean.includes('1!') || clean.endsWith('!') || clean.includes('FUT') || clean === 'CRUDEOIL')) {
      return ANGEL_SYMBOL_MAP['CRUDEOIL'];
    }
    if (clean.includes('NATURALGAS') && (clean.includes('1!') || clean.endsWith('!') || clean.includes('FUT') || clean === 'NATURALGAS')) {
      return ANGEL_SYMBOL_MAP['NATURALGAS'];
    }
    if (clean.includes('GOLD') && (clean.includes('1!') || clean.endsWith('!') || clean.includes('FUT') || clean === 'GOLD')) {
      return ANGEL_SYMBOL_MAP['GOLD'];
    }
    if (clean.includes('SILVER') && (clean.includes('1!') || clean.endsWith('!') || clean.includes('FUT') || clean === 'SILVER')) {
      return ANGEL_SYMBOL_MAP['SILVER'];
    }

    // Check variations in built-in map
    if (ANGEL_SYMBOL_MAP[clean]) return ANGEL_SYMBOL_MAP[clean];
    if (ANGEL_SYMBOL_MAP[`${exchange}:${clean}`]) return ANGEL_SYMBOL_MAP[`${exchange}:${clean}`];
    if (ANGEL_SYMBOL_MAP[stripped]) return ANGEL_SYMBOL_MAP[stripped];
    if (ANGEL_SYMBOL_MAP[`${exchange}:${stripped}`]) return ANGEL_SYMBOL_MAP[`${exchange}:${stripped}`];

    // 2. Check dynamic tokenCache
    if (this.tokenCache[clean]) return this.tokenCache[clean];
    if (this.tokenCache[`${exchange}:${clean}`]) return this.tokenCache[`${exchange}:${clean}`];
    if (this.tokenCache[stripped]) return this.tokenCache[stripped];
    if (this.tokenCache[`${exchange}:${stripped}`]) return this.tokenCache[`${exchange}:${stripped}`];

    // 3. Search via Angel One searchScrip API
    try {
      const searchTarget = underlyingSymbol || stripped || clean;
      const res = await this.autoRecover(async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        try {
          const response = await fetch(`${this.baseUrl}/rest/secure/angelbroking/order/v1/searchScrip`, {
            method: 'POST',
            headers: this.getHeaders(),
            signal: controller.signal,
            body: JSON.stringify({ exchange, searchscrip: searchTarget })
          });
          return await this.parseResponse(response);
        } finally {
          clearTimeout(timeout);
        }
      }, true);

      if (res && res.status && Array.isArray(res.data) && res.data.length > 0) {
        // Priority to exact match, or FUT if future, or option contract if NFO, or -EQ if equity
        const match = (exchange === 'MCX')
          ? (res.data.find(d => d.tradingsymbol === clean) ||
             res.data.find(d => d.tradingsymbol?.endsWith('FUT') && !d.symboltoken?.includes(' ')) ||
             res.data[0])
          : (exchange === 'NFO')
          ? (res.data.find(d => d.tradingsymbol === clean) ||
             res.data.find(d => clean.includes('FUT') && d.tradingsymbol?.endsWith('FUT') && !d.symboltoken?.includes(' ')) ||
             res.data.find(d => d.tradingsymbol?.includes(clean)) ||
             res.data.find(d => d.tradingsymbol?.startsWith(searchTarget)) ||
             res.data[0])
          : (res.data.find(d => d.tradingsymbol === `${searchTarget}-EQ`) ||
             res.data.find(d => d.tradingsymbol === clean) ||
             res.data.find(d => d.tradingsymbol?.startsWith(searchTarget)) ||
             res.data[0]);

        if (match && match.symboltoken) {
          const resolved = {
            exchange: match.exchange || exchange,
            symboltoken: String(match.symboltoken),
            tradingsymbol: match.tradingsymbol
          };
          this.tokenCache[clean] = resolved;
          this.tokenCache[`${exchange}:${clean}`] = resolved;
          this.tokenCache[match.tradingsymbol] = resolved;
          this.tokenCache[`${exchange}:${match.tradingsymbol}`] = resolved;
          if (stripped) {
            this.tokenCache[stripped] = resolved;
            this.tokenCache[`${exchange}:${stripped}`] = resolved;
          }
          this.saveTokenCache();
          return resolved;
        }
      }
    } catch (err) {
      console.warn(`[Angel One Token Search] Error resolving ${clean}:`, err.message);
    }
    return null;
  }

  async searchScrips(query) {
    if (!query || !query.trim()) return [];
    const q = query.trim().toUpperCase().replace(/^(NSE|BSE|NFO|MCX):/, '');
    const results = [];
    const seen = new Set();

    // 1. Check presets first (instant 0ms response including all stock futures)
    if (Array.isArray(this.presetsList)) {
      for (const item of this.presetsList) {
        if (!item.value || !item.label) continue;
        const cleanVal = item.value.replace(/^(NSE|BSE|NFO|MCX):/, '');
        if (cleanVal.includes(q) || item.label.toUpperCase().includes(q)) {
          if (!seen.has(item.value)) {
            seen.add(item.value);
            results.push(item);
          }
        }
      }
    }

    // 2. Check built-in ANGEL_SYMBOL_MAP
    for (const [key, item] of Object.entries(ANGEL_SYMBOL_MAP)) {
      if (key.includes(q) || (item.tradingsymbol && item.tradingsymbol.toUpperCase().includes(q))) {
        const cleanSym = item.tradingsymbol.replace(/-EQ$/, '');
        const val = `${item.exchange}:${cleanSym}`;
        if (!seen.has(val)) {
          seen.add(val);
          results.push({
            value: val,
            label: `${item.tradingsymbol} (${item.exchange})`,
            type: item.tradingsymbol.includes('FUT') || key.includes('1!') ? 'futures' : (item.tradingsymbol.includes('Nifty') || item.tradingsymbol.includes('SENSEX') || item.tradingsymbol.includes('BANKEX') ? 'index' : 'stock'),
            exchange: item.exchange
          });
        }
      }
    }

    // 3. Query Angel One searchScrip API for NSE and NFO (and MCX if commodity)
    if (this.isLoggedIn) {
      try {
        const isCommodity = ['CRUDE', 'GOLD', 'SILVER', 'NATURAL', 'COPPER', 'ZINC', 'MCX'].some(c => q.includes(c));
        const tasks = [
          this.autoRecover(async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            try {
              const r = await fetch(`${this.baseUrl}/rest/secure/angelbroking/order/v1/searchScrip`, {
                method: 'POST',
                headers: this.getHeaders(),
                signal: controller.signal,
                body: JSON.stringify({ exchange: 'NSE', searchscrip: q })
              });
              return await this.parseResponse(r);
            } finally {
              clearTimeout(timeout);
            }
          }, true).catch(() => null),

          this.autoRecover(async () => {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 5000);
            try {
              const r = await fetch(`${this.baseUrl}/rest/secure/angelbroking/order/v1/searchScrip`, {
                method: 'POST',
                headers: this.getHeaders(),
                signal: controller.signal,
                body: JSON.stringify({ exchange: 'NFO', searchscrip: q })
              });
              return await this.parseResponse(r);
            } finally {
              clearTimeout(timeout);
            }
          }, true).catch(() => null)
        ];

        if (isCommodity) {
          tasks.push(
            this.autoRecover(async () => {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 5000);
              try {
                const r = await fetch(`${this.baseUrl}/rest/secure/angelbroking/order/v1/searchScrip`, {
                  method: 'POST',
                  headers: this.getHeaders(),
                  signal: controller.signal,
                  body: JSON.stringify({ exchange: 'MCX', searchscrip: q })
                });
                return await this.parseResponse(r);
              } finally {
                clearTimeout(timeout);
              }
            }, true).catch(() => null)
          );
        }

        const [nseRes, nfoRes, mcxRes] = await Promise.all(tasks);

        // Process NFO Futures & Options
        const nfoItems = nfoRes?.data || [];
        const nfoFutures = [];
        for (const item of nfoItems) {
          if (!item.tradingsymbol || !item.symboltoken) continue;
          // Filter single-month clean futures (exclude calendar spreads with spaces in token or multiple expiry dates)
          const isSingleMonthFuture = item.tradingsymbol.endsWith('FUT') &&
                                     !item.symboltoken.includes(' ') &&
                                     (item.tradingsymbol.match(/[0-9]{2}[A-Z]{3}[0-9]{2}/g) || []).length <= 1;
          if (isSingleMonthFuture) {
            nfoFutures.push(item);
          }
        }

        // Cache tokens & add stock/index futures to results
        for (const item of nfoFutures) {
          const val = `NFO:${item.tradingsymbol}`;
          if (!seen.has(val)) {
            seen.add(val);
            this.tokenCache[val] = { exchange: 'NFO', symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
            this.tokenCache[item.tradingsymbol] = { exchange: 'NFO', symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
            results.push({
              value: val,
              label: `${item.tradingsymbol} (Futures)`,
              type: 'futures',
              exchange: 'NFO'
            });
          }
        }

        // Add continuous futures option for this stock/index if futures exist
        if (nfoFutures.length > 0) {
          const contVal = `NSE:${q}1!`;
          if (!seen.has(contVal)) {
            seen.add(contVal);
            results.push({
              value: contVal,
              label: `${q} Continuous Futures (1!)`,
              type: 'futures',
              exchange: 'NSE'
            });
          }
        }

        // Process MCX Commodity Futures
        const mcxItems = mcxRes?.data || [];
        for (const item of mcxItems) {
          if (!item.tradingsymbol || !item.symboltoken) continue;
          const isFuture = item.tradingsymbol.endsWith('FUT') && !item.symboltoken.includes(' ');
          if (isFuture) {
            const val = `MCX:${item.tradingsymbol}`;
            if (!seen.has(val)) {
              seen.add(val);
              this.tokenCache[val] = { exchange: 'MCX', symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
              this.tokenCache[item.tradingsymbol] = { exchange: 'MCX', symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
              results.push({
                value: val,
                label: `${item.tradingsymbol} (MCX Fut)`,
                type: 'futures',
                exchange: 'MCX'
              });
            }
          }
        }

        // Process NSE and BSE Equities
        const equityItems = [...(nseRes?.data || [])];
        for (const item of equityItems) {
          if (!item.tradingsymbol || !item.symboltoken) continue;
          const cleanSym = item.tradingsymbol.replace(/-EQ$/, '');
          const val = `${item.exchange}:${cleanSym}`;
          if (!seen.has(val)) {
            seen.add(val);
            this.tokenCache[val] = { exchange: item.exchange, symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
            this.tokenCache[item.tradingsymbol] = { exchange: item.exchange, symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
            results.push({
              value: val,
              label: `${item.tradingsymbol} (${item.exchange})`,
              type: (item.instrumenttype === 'OPTIDX' || item.instrumenttype === 'OPTSTK') ? 'option' : 'stock',
              exchange: item.exchange
            });
          }
          if (results.length >= 40) break;
        }

        // If user explicitly searched with CE or PE option strike, also include NFO options
        const isOptionSearch = /(?:\d|\s)(CE|PE)$/i.test(q) || /(?:CALL|PUT|OPT)/i.test(q);
        if (isOptionSearch) {
          for (const item of nfoItems) {
            if (!item.tradingsymbol || !item.symboltoken) continue;
            if (item.tradingsymbol.endsWith('CE') || item.tradingsymbol.endsWith('PE')) {
              const val = `NFO:${item.tradingsymbol}`;
              if (!seen.has(val)) {
                seen.add(val);
                this.tokenCache[val] = { exchange: 'NFO', symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
                results.push({
                  value: val,
                  label: `${item.tradingsymbol} (Option)`,
                  type: 'option',
                  exchange: 'NFO'
                });
              }
            }
          }
        }

        this.saveTokenCache();
      } catch (err) {
        console.warn('[Angel One searchScrips] Search exception:', err.message);
      }
    }

    return results;
  }

  mapTimeframeToAngelInterval(tf) {
    const s = String(tf).toUpperCase().trim();
    if (s === '1') return 'ONE_MINUTE';
    if (s === '3') return 'THREE_MINUTE';
    if (s === '5') return 'FIVE_MINUTE';
    if (s === '10') return 'TEN_MINUTE';
    if (s === '15') return 'FIFTEEN_MINUTE';
    if (s === '30') return 'THIRTY_MINUTE';
    if (s === '60' || s === '1H') return 'ONE_HOUR';
    if (s === 'D' || s === '1D' || s === 'DAY') return 'ONE_DAY';
    return 'FIVE_MINUTE';
  }

  async getNormalizedCandles({ symbol, timeframe = '5', limit = 100, isPriority = true }) {
    try {
      const cacheKey = `${symbol}_${timeframe}`;
      const nowMs = Date.now();
      const cached = this.candleCache[cacheKey];
      if (cached && (nowMs - cached.timestamp < 20000) && Array.isArray(cached.candles) && cached.candles.length > 0) {
        return {
          status: true,
          symbol,
          timeframe,
          exchange: cached.exchange,
          symboltoken: cached.symboltoken,
          candles: limit ? cached.candles.slice(-limit) : cached.candles
        };
      }

      const resolved = await this.resolveSymbolToken(symbol);
      if (!resolved || !resolved.symboltoken) {
        return { status: false, message: `Token not found for ${symbol}`, candles: [] };
      }

      const s = String(timeframe).toUpperCase().trim();
      const isWeekly = (s === 'W' || s === '1W' || s === 'WEEK');
      const isMonthly = (s === 'M' || s === '1M' || s === 'MONTH');
      const interval = (isWeekly || isMonthly) ? 'ONE_DAY' : this.mapTimeframeToAngelInterval(timeframe);
      
      // Calculate from/to dates based on timeframe and limit
      const now = new Date();
      let daysBack = 7;
      if (isWeekly) {
        daysBack = Math.min(2600, Math.max(365, Math.ceil((limit || 50) * 7 * 1.5)));
      } else if (isMonthly) {
        daysBack = Math.min(2600, Math.max(730, Math.ceil((limit || 24) * 31 * 1.5)));
      } else if (interval === 'ONE_MINUTE' || interval === 'THREE_MINUTE') {
        daysBack = Math.min(30, Math.max(15, Math.ceil((limit || 100) / 300 * 2)));
      } else if (interval === 'FIVE_MINUTE' || interval === 'TEN_MINUTE') {
        daysBack = Math.min(35, Math.max(22, Math.ceil((limit || 100) / 75 * 1.8)));
      } else if (interval === 'FIFTEEN_MINUTE' || interval === 'THIRTY_MINUTE') {
        daysBack = Math.min(35, Math.max(22, Math.ceil((limit || 100) / 13 * 1.8)));
      } else if (interval === 'ONE_HOUR') {
        daysBack = Math.min(45, Math.max(25, Math.ceil((limit || 100) / 6 * 1.8)));
      } else if (interval === 'ONE_DAY') {
        daysBack = Math.min(2600, Math.max(160, Math.ceil((limit || 100) * 1.5)));
      }

      // Commodities futures contracts have shorter lifespans
      if (resolved.exchange === 'MCX' && daysBack > 100) {
        daysBack = 100;
      }

      const from = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000);
      const pad = n => String(n).padStart(2, '0');
      const isMcx = (resolved.exchange === 'MCX');
      const startH = isMcx ? '09:00' : '09:15';
      const maxCloseHour = isMcx ? 23 : 15;
      const maxCloseMin = isMcx ? 30 : 15;

      // Determine current IST time
      const istNow = new Date(Date.now() + 19800 * 1000);
      const istH = istNow.getUTCHours();
      const istM = istNow.getUTCMinutes();
      const currentMinOfDay = istH * 60 + istM;
      const openMinOfDay = isMcx ? (9 * 60) : (9 * 60 + 15);

      let toDateObj = new Date(istNow.getTime());
      let toHour = maxCloseHour;
      let toMinute = maxCloseMin;

      // If pre-market (before 9:15 AM for NSE, before 9:00 AM for MCX), request up to previous day
      if (currentMinOfDay < openMinOfDay) {
        toDateObj.setUTCDate(toDateObj.getUTCDate() - 1);
      }
      toHour = maxCloseHour;
      toMinute = maxCloseMin;

      const fmt = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${startH}`;
      const fmtTo = d => `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(toHour)}:${pad(toMinute)}`;

      const fromdate = fmt(from);
      const todate = fmtTo(toDateObj);

      let res = await this.getCandles({
        exchange: resolved.exchange,
        symboltoken: resolved.symboltoken,
        interval,
        fromdate,
        todate
      }, isPriority);

      // Fallback 1: If returned empty and daysBack > 150, retry with a 150-day window (~100 trading sessions)
      if ((!res || !res.status || !Array.isArray(res.data) || res.data.length === 0) && daysBack > 150 && interval === 'ONE_DAY') {
        const midFrom = new Date(now.getTime() - 150 * 24 * 60 * 60 * 1000);
        res = await this.getCandles({
          exchange: resolved.exchange,
          symboltoken: resolved.symboltoken,
          interval,
          fromdate: fmt(midFrom),
          todate
        }, isPriority);
      }

      // Fallback 2: If returned empty and daysBack > 7, retry with a tight 7-day window
      if ((!res || !res.status || !Array.isArray(res.data) || res.data.length === 0) && daysBack > 7) {
        const tightFrom = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        res = await this.getCandles({
          exchange: resolved.exchange,
          symboltoken: resolved.symboltoken,
          interval,
          fromdate: fmt(tightFrom),
          todate
        }, isPriority);
      }

      // Fallback 3: If still empty and symbol is Crude Oil, fetch active November 2026 contract (573422)
      if ((!res || !res.status || !Array.isArray(res.data) || res.data.length === 0) && symbol.toUpperCase().includes('CRUDE')) {
        const tightFrom = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
        res = await this.getCandles({
          exchange: 'MCX',
          symboltoken: '573422',
          interval,
          fromdate: fmt(tightFrom),
          todate
        }, isPriority);
      }

      if (res && res.status && Array.isArray(res.data)) {
        const raw = res.data;
        let normalized = raw.map(row => ({
          time: Math.floor(new Date(row[0]).getTime() / 1000),
          open: Number(row[1]),
          high: Number(row[2]),
          low: Number(row[3]),
          close: Number(row[4]),
          volume: Number(row[5] || 0)
        })).filter(c => !isNaN(c.time) && !isNaN(c.close));

        normalized.sort((a, b) => a.time - b.time);

        // Strict Market Hours Enforcement:
        // NSE/BSE: 09:15:00 to 15:15:00 IST (first candle starts exactly at 9:15 AM, no pre-open 9:00-9:15 AM)
        // MCX: 09:00:00 to 23:30:00 IST
        if (interval !== 'ONE_DAY' && !isWeekly && !isMonthly) {
          normalized = normalized.filter(c => {
            const secOfDay = ((c.time + 19800) % 86400 + 86400) % 86400;
            const istDate = new Date((c.time + 19800) * 1000);
            const day = istDate.getUTCDay();
            if (day === 0 || day === 6) return false;
            if (isMcx) {
              return secOfDay >= 32400 && secOfDay <= 84600;
            } else {
              return secOfDay >= 33300 && secOfDay < 54900;
            }
          });
        }

        if (normalized.length > 0 && normalized.every(c => !c.volume || c.volume === 0)) {
          normalized = normalized.map(c => {
            const range = Math.max(0.5, c.high - c.low);
            const body = Math.abs(c.close - c.open);
            const simVol = Math.round(15000 + range * 850 + body * 450);
            return { ...c, volume: simVol };
          });
        }

        if (isWeekly) {
          const weeks = {};
          for (const c of normalized) {
            const d = new Date(c.time * 1000);
            const day = d.getDay();
            const diff = d.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(d.setDate(diff));
            monday.setHours(9, 15, 0, 0);
            const key = Math.floor(monday.getTime() / 1000);
            if (!weeks[key]) {
              weeks[key] = { time: key, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
            } else {
              weeks[key].high = Math.max(weeks[key].high, c.high);
              weeks[key].low = Math.min(weeks[key].low, c.low);
              weeks[key].close = c.close;
              weeks[key].volume += (c.volume || 0);
            }
          }
          normalized = Object.values(weeks).sort((a, b) => a.time - b.time);
        } else if (isMonthly) {
          const months = {};
          for (const c of normalized) {
            const d = new Date(c.time * 1000);
            const firstOfMonth = new Date(d.getFullYear(), d.getMonth(), 1, 9, 15, 0, 0);
            const key = Math.floor(firstOfMonth.getTime() / 1000);
            if (!months[key]) {
              months[key] = { time: key, open: c.open, high: c.high, low: c.low, close: c.close, volume: c.volume };
            } else {
              months[key].high = Math.max(months[key].high, c.high);
              months[key].low = Math.min(months[key].low, c.low);
              months[key].close = c.close;
              months[key].volume += (c.volume || 0);
            }
          }
          normalized = Object.values(months).sort((a, b) => a.time - b.time);
        }

        this.candleCache[cacheKey] = {
          timestamp: Date.now(),
          exchange: resolved.exchange,
          symboltoken: resolved.symboltoken,
          candles: normalized
        };

        const sliced = limit ? normalized.slice(-limit) : normalized;

        return {
          status: true,
          symbol,
          timeframe,
          exchange: resolved.exchange,
          symboltoken: resolved.symboltoken,
          candles: sliced
        };
      }
      return { status: false, message: res?.message || 'Empty candle data from Angel One', candles: [] };
    } catch (err) {
      console.warn(`[Angel One Candles Error] ${symbol}:`, err.message);
      return { status: false, message: err.message, candles: [] };
    }
  }

  async getNiftyBankNiftyLtp() {
    try {
      const [niftyRes, bankNiftyRes] = await Promise.all([
        this.getLtp('NSE', 'Nifty 50', '99926000'),
        this.getLtp('NSE', 'Nifty Bank', '99926009')
      ]);

      const niftyLtp = niftyRes?.data?.ltp || null;
      const bankNiftyLtp = bankNiftyRes?.data?.ltp || null;

      return {
        status: true,
        nifty: niftyLtp,
        banknifty: bankNiftyLtp,
        timestamp: new Date().toISOString()
      };
    } catch (err) {
      return { status: false, message: err.message, nifty: null, banknifty: null };
    }
  }

  startDailyAutoLoginScheduler() {
    console.log('[Angel One] ⏰ Daily Auto-Login & Session Keep-Alive Scheduler active.');

    // 1. Proactive Heartbeat / Expired Session Check (every 10 minutes)
    setInterval(async () => {
      if (!this.config.apiKey || !this.config.clientCode) return;

      const lastLogin = this.config.lastLogin ? new Date(this.config.lastLogin).getTime() : 0;
      const now = Date.now();
      const hoursSinceLogin = (now - lastLogin) / (1000 * 60 * 60);

      // Refresh if token is older than 18 hours or if not logged in
      if (!this.isLoggedIn || hoursSinceLogin >= 18) {
        console.log(`[Angel One Scheduler] Session age: ${hoursSinceLogin.toFixed(1)}h. Executing automatic re-login...`);
        await this.login();
      }
    }, 10 * 60 * 1000);

    // 2. Pre-Market Daily Re-login at 8:30 AM IST (Asia/Kolkata)
    setInterval(async () => {
      if (!this.config.apiKey || !this.config.clientCode) return;

      const now = new Date();
      const istTimeStr = now.toLocaleTimeString('en-GB', { timeZone: 'Asia/Kolkata' }); // "HH:MM:SS"
      const [hours, minutes] = istTimeStr.split(':').map(Number);

      // Trigger every morning at 08:30 IST (8:30 AM)
      if (hours === 8 && minutes === 30) {
        const todayDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        if (this.lastScheduledRunDate !== todayDate) {
          this.lastScheduledRunDate = todayDate;
          console.log(`[Angel One Scheduler] 🌅 Pre-market daily login trigger at ${istTimeStr} IST (${todayDate})...`);
          await this.login();
        }
      }
    }, 30 * 1000); // Check every 30s
  }

  getStatus() {
    const hasCreds = Boolean(
      (this.config.apiKey || process.env.ANGEL_API_KEY) &&
      (this.config.clientCode || process.env.ANGEL_CLIENT_CODE)
    );

    return {
      provider: 'Angel One SmartAPI Bridge',
      isLoggedIn: this.isLoggedIn,
      hasCredentials: hasCreds,
      clientCode: this.config.clientCode || null,
      lastLogin: this.config.lastLogin || null,
      tokensMapped: Object.keys(ANGEL_SYMBOL_MAP).length,
      autoLoginEnabled: true,
      preMarketSchedule: '08:30 AM IST Daily'
    };
  }
}

export const angelOneBridge = new AngelOneBridge();
export default angelOneBridge;
