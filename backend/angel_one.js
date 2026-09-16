import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for Base32 decoding (used in TOTP calculation)
function base32Decode(base32) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let cleaned = base32.toUpperCase().replace(/=+$/, '').replace(/\s+/g, '');
  let bits = '';
  for (let i = 0; i < cleaned.length; i++) {
    const val = alphabet.indexOf(cleaned[i]);
    if (val === -1) continue;
    bits += val.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.substring(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

// Generate RFC 6238 6-digit TOTP
export function generateTOTP(secret) {
  if (!secret) return '';
  try {
    const key = base32Decode(secret);
    const epoch = Math.floor(Date.now() / 1000);
    const timeStep = 30;
    const counter = Math.floor(epoch / timeStep);
    
    const buf = Buffer.alloc(8);
    buf.writeBigInt64BE(BigInt(counter), 0);
    
    const hmac = crypto.createHmac('sha1', key).update(buf).digest();
    const offset = hmac[hmac.length - 1] & 0xf;
    const code = ((hmac[offset] & 0x7f) << 24) |
                 ((hmac[offset + 1] & 0xff) << 16) |
                 ((hmac[offset + 2] & 0xff) << 8) |
                 (hmac[offset + 3] & 0xff);
    
    return String(code % 1000000).padStart(6, '0');
  } catch (err) {
    console.error('[Angel One] TOTP Generation error:', err.message);
    return '';
  }
}

export class AngelOneBridge {
  constructor() {
    console.log('[Angel One] Initializing SmartAPI Bridge...');
    this.apiKey = process.env.ANGEL_API_KEY || '';
    this.clientCode = process.env.ANGEL_CLIENT_CODE || '';
    this.password = process.env.ANGEL_PASSWORD || '';
    this.totpSecret = process.env.ANGEL_TOTP_SECRET || '';

    this.jwtToken = null;
    this.feedToken = null;
    this.refreshToken = null;
    this.isLoggedIn = false;

    this.scripMap = new Map(); // symbol -> { token, exch, tradingsymbol, name }
    this.scripMasterFile = path.join(__dirname, 'data/angel_scrip_master.json');

    // Default static mapping for common symbols
    this.defaultTokens = {
      'NSE:NIFTY': { token: '99926000', exch: 'NSE', tradingsymbol: 'Nifty 50' },
      'NSE:BANKNIFTY': { token: '99926009', exch: 'NSE', tradingsymbol: 'Nifty Bank' },
      'NSE:FINNIFTY': { token: '99926037', exch: 'NSE', tradingsymbol: 'Nifty Fin Service' },
      'NSE:RELIANCE': { token: '2885', exch: 'NSE', tradingsymbol: 'RELIANCE-EQ' },
      'NSE:TCS': { token: '11536', exch: 'NSE', tradingsymbol: 'TCS-EQ' },
      'NSE:HDFCBANK': { token: '1333', exch: 'NSE', tradingsymbol: 'HDFCBANK-EQ' },
      'NSE:ICICIBANK': { token: '4963', exch: 'NSE', tradingsymbol: 'ICICIBANK-EQ' },
      'NSE:INFY': { token: '1594', exch: 'NSE', tradingsymbol: 'INFY-EQ' },
      'NSE:SBIN': { token: '3045', exch: 'NSE', tradingsymbol: 'SBIN-EQ' },
      'NSE:LT': { token: '11483', exch: 'NSE', tradingsymbol: 'LT-EQ' },
      'NSE:AXISBANK': { token: '5900', exch: 'NSE', tradingsymbol: 'AXISBANK-EQ' },
      'NSE:KOTAKBANK': { token: '1922', exch: 'NSE', tradingsymbol: 'KOTAKBANK-EQ' },
      'NSE:DIXON': { token: '21690', exch: 'NSE', tradingsymbol: 'DIXON-EQ' },
      'NSE:VEDL': { token: '30716', exch: 'NSE', tradingsymbol: 'VEDL-EQ' },
    };

    this.loadScripMaster();
  }

  async loadScripMaster() {
    try {
      if (fs.existsSync(this.scripMasterFile)) {
        const stats = fs.statSync(this.scripMasterFile);
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
        
        if (ageHours < 48) {
          const raw = fs.readFileSync(this.scripMasterFile, 'utf8');
          const data = JSON.parse(raw);
          data.forEach(item => {
            if (item.symbol && item.token && item.exch_seg) {
              const formattedSymbol = `${item.exch_seg}:${item.symbol.replace('-EQ', '')}`;
              this.scripMap.set(formattedSymbol, {
                token: item.token,
                exch: item.exch_seg,
                tradingsymbol: item.symbol,
                name: item.name
              });
            }
          });
          console.log(`[Angel One] Loaded ${this.scripMap.size} scrips from disk master file.`);
          return;
        }
      }

      // Download fresh Scrip Master from Angel Broking CDN
      console.log('[Angel One] Downloading fresh Scrip Master JSON from Angel Broking CDN...');
      const res = await fetch('https://margincalculator.angelbroking.com/OpenAPI_File/files/OpenAPIScripMaster.json');
      if (res.ok) {
        const data = await res.json();
        const dir = path.dirname(this.scripMasterFile);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        
        fs.writeFileSync(this.scripMasterFile, JSON.stringify(data.slice(0, 30000)), 'utf8');
        
        data.forEach(item => {
          if (item.symbol && item.token && item.exch_seg) {
            const formattedSymbol = `${item.exch_seg}:${item.symbol.replace('-EQ', '')}`;
            this.scripMap.set(formattedSymbol, {
              token: item.token,
              exch: item.exch_seg,
              tradingsymbol: item.symbol,
              name: item.name
            });
          }
        });
        console.log(`[Angel One] Scrip master cached: ${this.scripMap.size} instruments parsed.`);
      }
    } catch (err) {
      console.warn('[Angel One] Scrip Master load warning:', err.message);
    }
  }

  getScripInfo(rawSymbol) {
    const formatted = rawSymbol.trim().toUpperCase();
    if (this.scripMap.has(formatted)) {
      return this.scripMap.get(formatted);
    }
    if (this.defaultTokens[formatted]) {
      return this.defaultTokens[formatted];
    }

    // Try fuzzy match
    const cleanSym = formatted.replace('NSE:', '').replace('BSE:', '').replace('NFO:', '');
    for (const [key, val] of this.scripMap.entries()) {
      if (key.includes(cleanSym)) {
        return val;
      }
    }
    
    return { token: '2885', exch: 'NSE', tradingsymbol: `${cleanSym}-EQ` };
  }

  async login() {
    if (!this.apiKey || !this.clientCode || !this.password) {
      console.log('[Angel One] SmartAPI credentials not set in backend/.env (ANGEL_API_KEY, ANGEL_CLIENT_CODE). Operating in guest/hybrid fallback mode.');
      return false;
    }

    try {
      console.log(`[Angel One] Authenticating SmartAPI for client: ${this.clientCode}...`);
      const totpCode = generateTOTP(this.totpSecret);

      const payload = {
        clientcode: this.clientCode,
        password: this.password,
        totp: totpCode
      };

      const response = await fetch('https://apiconnect.angelbroking.com/rest/auth/angelbroking/user/v1/loginByPassword', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-UserType': 'USER',
          'X-SourceID': 'WEB',
          'X-ClientLocalIP': '127.0.0.1',
          'X-ClientPublicIP': '127.0.0.1',
          'X-MACAddress': 'FE:80:00:00:00:00',
          'X-PrivateKey': this.apiKey
        },
        body: JSON.stringify(payload)
      });

      const resData = await response.json();
      if (resData.status && resData.data) {
        this.jwtToken = resData.data.jwtToken;
        this.feedToken = resData.data.feedToken;
        this.refreshToken = resData.data.refreshToken;
        this.isLoggedIn = true;
        console.log('[Angel One] ✅ SmartAPI Authentication successful!');
        return true;
      } else {
        console.error('[Angel One] ❌ SmartAPI Login failed:', resData.message || resData.errorcode);
        this.isLoggedIn = false;
        return false;
      }
    } catch (err) {
      console.error('[Angel One] Login exception:', err.message);
      this.isLoggedIn = false;
      return false;
    }
  }

  mapTimeframe(timeframe) {
    const tf = String(timeframe).toUpperCase();
    if (tf === '1' || tf === '1M') return 'ONE_MINUTE';
    if (tf === '3' || tf === '3M') return 'THREE_MINUTE';
    if (tf === '5' || tf === '5M') return 'FIVE_MINUTE';
    if (tf === '15' || tf === '15M') return 'FIFTEEN_MINUTE';
    if (tf === '30' || tf === '30M') return 'THIRTY_MINUTE';
    if (tf === '60' || tf === '1H') return 'ONE_HOUR';
    if (tf === 'D' || tf === '1D') return 'ONE_DAY';
    return 'FIVE_MINUTE';
  }

  async fetchCandles(symbol, timeframe = '5', limit = 150) {
    const scrip = this.getScripInfo(symbol);
    const interval = this.mapTimeframe(timeframe);

    // If logged in via SmartAPI, call getCandleData
    if (this.isLoggedIn && this.jwtToken) {
      try {
        const now = new Date();
        const fromDate = new Date(now.getTime() - (limit * 5 * 60 * 1000));
        
        const formatAngelDate = (d) => {
          const yy = d.getFullYear();
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const hh = String(d.getHours()).padStart(2, '0');
          const min = String(d.getMinutes()).padStart(2, '0');
          return `${yy}-${mm}-${dd} ${hh}:${min}`;
        };

        const payload = {
          exchange: scrip.exch || 'NSE',
          symboltoken: scrip.token,
          interval,
          fromdate: formatAngelDate(fromDate),
          todate: formatAngelDate(now)
        };

        const res = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/historical/v1/getCandleData', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': '127.0.0.1',
            'X-ClientPublicIP': '127.0.0.1',
            'X-MACAddress': 'FE:80:00:00:00:00',
            'X-PrivateKey': this.apiKey
          },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.status && Array.isArray(json.data)) {
          return json.data.map(c => ({
            time: Math.floor(new Date(c[0]).getTime() / 1000),
            open: parseFloat(c[1]),
            high: parseFloat(c[2]),
            low: parseFloat(c[3]),
            close: parseFloat(c[4]),
            volume: parseInt(c[5], 10)
          }));
        }
      } catch (err) {
        console.error('[Angel One] Historical candle fetch error:', err.message);
      }
    }

    // Fallback: return scrip info metadata with clean structure
    return [];
  }

  async fetchLTP(symbol) {
    const scrip = this.getScripInfo(symbol);

    if (this.isLoggedIn && this.jwtToken) {
      try {
        const payload = {
          exchange: scrip.exch || 'NSE',
          tradingsymbol: scrip.tradingsymbol,
          symboltoken: scrip.token
        };

        const res = await fetch('https://apiconnect.angelbroking.com/rest/secure/angelbroking/order/v1/getLtpData', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${this.jwtToken}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'X-UserType': 'USER',
            'X-SourceID': 'WEB',
            'X-ClientLocalIP': '127.0.0.1',
            'X-ClientPublicIP': '127.0.0.1',
            'X-MACAddress': 'FE:80:00:00:00:00',
            'X-PrivateKey': this.apiKey
          },
          body: JSON.stringify(payload)
        });

        const json = await res.json();
        if (json.status && json.data && json.data.ltp) {
          return parseFloat(json.data.ltp);
        }
      } catch (e) {}
    }

    return null;
  }

  getStatus() {
    return {
      provider: 'Angel One SmartAPI',
      isConfigured: Boolean(this.apiKey && this.clientCode),
      isLoggedIn: this.isLoggedIn,
      scripCount: this.scripMap.size || Object.keys(this.defaultTokens).length,
      credentials: {
        apiKeySet: Boolean(this.apiKey),
        clientCodeSet: Boolean(this.clientCode),
        totpSecretSet: Boolean(this.totpSecret)
      },
      supportedExchanges: ['NSE', 'NFO', 'BSE', 'MCX']
    };
  }

  async updateCredentials({ apiKey, clientCode, password, totpSecret }) {
    if (apiKey !== undefined) this.apiKey = apiKey.trim();
    if (clientCode !== undefined) this.clientCode = clientCode.trim();
    if (password !== undefined) this.password = password.trim();
    if (totpSecret !== undefined) this.totpSecret = totpSecret.trim();

    try {
      const envPath = path.join(__dirname, '.env');
      let envContent = fs.existsSync(envPath) ? fs.readFileSync(envPath, 'utf8') : '';

      const updateEnvVar = (name, val) => {
        const regex = new RegExp(`^${name}=.*`, 'm');
        if (regex.test(envContent)) {
          envContent = envContent.replace(regex, `${name}="${val}"`);
        } else {
          envContent += `\n${name}="${val}"`;
        }
      };

      updateEnvVar('ANGEL_API_KEY', this.apiKey);
      updateEnvVar('ANGEL_CLIENT_CODE', this.clientCode);
      updateEnvVar('ANGEL_PASSWORD', this.password);
      updateEnvVar('ANGEL_TOTP_SECRET', this.totpSecret);

      fs.writeFileSync(envPath, envContent.trim() + '\n', 'utf8');
      console.log('[Angel One] Updated SmartAPI credentials in backend/.env');
    } catch (err) {
      console.error('[Angel One] Error updating .env file:', err.message);
    }

    const success = await this.login();
    return { success, status: this.getStatus() };
  }
}
