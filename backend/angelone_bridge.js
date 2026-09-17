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
  'NSE:NIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NIFTY': { exchange: 'NSE', symboltoken: '99926000', tradingsymbol: 'Nifty 50' },
  'NSE:BANKNIFTY': { exchange: 'NSE', symboltoken: '99926009', tradingsymbol: 'Nifty Bank' },
  'BANKNIFTY': { exchange: 'NSE', symboltoken: '99926009', tradingsymbol: 'Nifty Bank' },
  'NSE:FINNIFTY': { exchange: 'NSE', symboltoken: '99926037', tradingsymbol: 'Nifty Fin Service' },
  'FINNIFTY': { exchange: 'NSE', symboltoken: '99926037', tradingsymbol: 'Nifty Fin Service' },
  'BSE:SENSEX': { exchange: 'BSE', symboltoken: '99919000', tradingsymbol: 'SENSEX' },
  'SENSEX': { exchange: 'BSE', symboltoken: '99919000', tradingsymbol: 'SENSEX' },

  // Top Stocks
  'NSE:RELIANCE': { exchange: 'NSE', symboltoken: '2885', tradingsymbol: 'RELIANCE-EQ' },
  'RELIANCE': { exchange: 'NSE', symboltoken: '2885', tradingsymbol: 'RELIANCE-EQ' },
  'NSE:HDFCBANK': { exchange: 'NSE', symboltoken: '1333', tradingsymbol: 'HDFCBANK-EQ' },
  'HDFCBANK': { exchange: 'NSE', symboltoken: '1333', tradingsymbol: 'HDFCBANK-EQ' },
  'NSE:ICICIBANK': { exchange: 'NSE', symboltoken: '4963', tradingsymbol: 'ICICIBANK-EQ' },
  'ICICIBANK': { exchange: 'NSE', symboltoken: '4963', tradingsymbol: 'ICICIBANK-EQ' },
  'NSE:INFY': { exchange: 'NSE', symboltoken: '1594', tradingsymbol: 'INFY-EQ' },
  'INFY': { exchange: 'NSE', symboltoken: '1594', tradingsymbol: 'INFY-EQ' },
  'NSE:SBIN': { exchange: 'NSE', symboltoken: '3045', tradingsymbol: 'SBIN-EQ' },
  'SBIN': { exchange: 'NSE', symboltoken: '3045', tradingsymbol: 'SBIN-EQ' },
  'NSE:TCS': { exchange: 'NSE', symboltoken: '11536', tradingsymbol: 'TCS-EQ' },
  'TCS': { exchange: 'NSE', symboltoken: '11536', tradingsymbol: 'TCS-EQ' },
  'NSE:TATAMOTORS': { exchange: 'NSE', symboltoken: '3456', tradingsymbol: 'TATAMOTORS-EQ' },
  'TATAMOTORS': { exchange: 'NSE', symboltoken: '3456', tradingsymbol: 'TATAMOTORS-EQ' },
  'NSE:AXISBANK': { exchange: 'NSE', symboltoken: '5900', tradingsymbol: 'AXISBANK-EQ' },
  'AXISBANK': { exchange: 'NSE', symboltoken: '5900', tradingsymbol: 'AXISBANK-EQ' },
  'NSE:LT': { exchange: 'NSE', symboltoken: '11483', tradingsymbol: 'LT-EQ' },
  'LT': { exchange: 'NSE', symboltoken: '11483', tradingsymbol: 'LT-EQ' }
};

export class AngelOneBridge {
  constructor() {
    this.configPath = path.join(__dirname, 'data/angelone_config.json');
    this.baseUrl = 'https://apiconnect.angelone.in';
    this.isLoggedIn = false;
    this.profileData = null;
    this.lastScheduledRunDate = null;
    this.config = this.loadConfig();
    this.startDailyAutoLoginScheduler();
  }

  loadConfig() {
    try {
      if (fs.existsSync(this.configPath)) {
        const text = fs.readFileSync(this.configPath, 'utf8');
        const parsed = JSON.parse(text);
        return {
          apiKey: parsed.apiKey || process.env.ANGEL_API_KEY || '',
          clientCode: parsed.clientCode || process.env.ANGEL_CLIENT_CODE || '',
          password: parsed.password || parsed.mpin || process.env.ANGEL_PASSWORD || '',
          totpSecret: parsed.totpSecret || process.env.ANGEL_TOTP_SECRET || '',
          jwtToken: parsed.jwtToken || '',
          refreshToken: parsed.refreshToken || '',
          feedToken: parsed.feedToken || '',
          lastLogin: parsed.lastLogin || null
        };
      }
    } catch (e) {
      console.error('[Angel One] Failed to load config:', e.message);
    }
    return {
      apiKey: process.env.ANGEL_API_KEY || '',
      clientCode: process.env.ANGEL_CLIENT_CODE || '',
      password: process.env.ANGEL_PASSWORD || '',
      totpSecret: process.env.ANGEL_TOTP_SECRET || '',
      jwtToken: '',
      refreshToken: '',
      feedToken: '',
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
      'X-UserType': 'USER',
      'X-SourceID': 'WEB',
      'X-ClientLocalIP': '127.0.0.1',
      'X-ClientPublicIP': '106.51.74.1',
      'X-MACAddress': 'fe80::1',
      'X-PrivateKey': this.config.apiKey,
      ...(this.config.jwtToken ? { 'Authorization': `Bearer ${this.config.jwtToken}` } : {})
    };
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
      const res = await fetch(`${this.baseUrl}/rest/auth/angelbroking/user/v1/loginByPassword`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          clientcode: clientCode,
          password: password,
          totp: totpCode
        })
      });

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

  async autoRecover(fn) {
    try {
      const result = await fn();
      if (result && (result.errorcode === 'AG8001' || result.errorcode === 'AG8002' || result.message === 'Invalid Token' || result.status === false)) {
        console.warn(`[Angel One Token Recovery] Expired token detected (${result.errorcode || result.message}). Re-authenticating...`);
        const loginRes = await this.login();
        if (loginRes.success) {
          return await fn();
        }
      }
      return result;
    } catch (err) {
      console.warn('[Angel One AutoRecover Exception]', err.message);
      return { status: false, message: err.message };
    }
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
      const data = await res.json();
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
      const res = await fetch(`${this.baseUrl}/rest/secure/angelbroking/order/v1/getLtpData`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          exchange,
          tradingsymbol,
          symboltoken
        })
      });
      return await res.json();
    });
  }

  async getCandles({ exchange = 'NSE', symboltoken = '', interval = 'FIVE_MINUTE', fromdate = '', todate = '' }) {
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
      const res = await fetch(`${this.baseUrl}/rest/secure/angelbroking/historical/v1/getCandleData`, {
        method: 'POST',
        headers: this.getHeaders(),
        body: JSON.stringify({
          exchange,
          symboltoken,
          interval,
          fromdate,
          todate
        })
      });
      return await res.json();
    });
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
