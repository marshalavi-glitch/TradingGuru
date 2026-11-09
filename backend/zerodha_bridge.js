import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CONFIG_PATH = path.join(__dirname, 'data', 'zerodha_config.json');

class ZerodhaBridge {
  constructor() {
    this.apiKey = '';
    this.apiSecret = '';
    this.accessToken = '';
    this.publicToken = '';
    this.userId = '';
    this.userName = '';
    this.userType = '';
    this.email = '';
    this.broker = 'ZERODHA';
    this.isConnected = false;
    this.lastLogin = null;
    this.tokenExpiry = null;
    this.margins = null;

    this.loadConfig();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_PATH)) {
        const raw = fs.readFileSync(CONFIG_PATH, 'utf8');
        const data = JSON.parse(raw);
        this.apiKey = data.apiKey || '';
        this.apiSecret = data.apiSecret || '';
        this.accessToken = data.accessToken || '';
        this.publicToken = data.publicToken || '';
        this.userId = data.userId || '';
        this.userName = data.userName || '';
        this.email = data.email || '';
        this.lastLogin = data.lastLogin || null;
        this.tokenExpiry = data.tokenExpiry || null;

        if (this.accessToken && this.apiKey) {
          this.isConnected = true;
        }
      }
    } catch (err) {
      console.warn('[ZerodhaBridge] Failed to load config:', err.message);
    }
  }

  saveConfig(extra = {}) {
    try {
      const data = {
        apiKey: this.apiKey,
        apiSecret: this.apiSecret,
        accessToken: this.accessToken,
        publicToken: this.publicToken,
        userId: this.userId,
        userName: this.userName,
        email: this.email,
        lastLogin: this.lastLogin,
        tokenExpiry: this.tokenExpiry,
        ...extra
      };
      const dir = path.dirname(CONFIG_PATH);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf8');
    } catch (err) {
      console.error('[ZerodhaBridge] Failed to save config:', err.message);
    }
  }

  updateCredentials(apiKey, apiSecret) {
    this.apiKey = (apiKey || '').trim();
    this.apiSecret = (apiSecret || '').trim();
    this.saveConfig();
  }

  getLoginUrl(redirectUri) {
    if (!this.apiKey) {
      throw new Error('Zerodha API Key is not configured. Please enter your API Key first.');
    }
    const base = 'https://kite.zerodha.com/connect/login';
    const params = new URLSearchParams({
      v: '3',
      api_key: this.apiKey
    });
    if (redirectUri) {
      params.append('redirect_url', redirectUri);
    }
    return `${base}?${params.toString()}`;
  }

  async generateSession(requestToken) {
    if (!this.apiKey || !this.apiSecret) {
      throw new Error('Both Zerodha API Key and API Secret are required to generate an Access Token.');
    }
    if (!requestToken) {
      throw new Error('Request Token is missing.');
    }

    // Checksum = SHA-256(api_key + request_token + api_secret)
    const rawString = `${this.apiKey}${requestToken.trim()}${this.apiSecret}`;
    const checksum = crypto.createHash('sha256').update(rawString).digest('hex');

    const form = new URLSearchParams({
      api_key: this.apiKey,
      request_token: requestToken.trim(),
      checksum
    });

    const res = await fetch('https://api.kite.trade/session/token', {
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    const data = await res.json();
    if (data.status === 'success' && data.data?.access_token) {
      const d = data.data;
      this.accessToken = d.access_token;
      this.publicToken = d.public_token || '';
      this.userId = d.user_id || '';
      this.userName = d.user_name || '';
      this.email = d.email || '';
      this.userType = d.user_type || 'individual';
      this.isConnected = true;
      this.lastLogin = new Date().toISOString();

      // Kite access tokens expire at 6:00 AM next day IST
      const exp = new Date();
      exp.setDate(exp.getDate() + 1);
      exp.setHours(6, 0, 0, 0);
      this.tokenExpiry = exp.toISOString();

      this.saveConfig();
      console.log(`[ZerodhaBridge] ✅ Login successful for user ${this.userName} (${this.userId})`);
      return { success: true, data: d };
    } else {
      const errMsg = data.message || 'Failed to exchange request token for access token';
      this.isConnected = false;
      console.error('[ZerodhaBridge] ❌ Session generation failed:', errMsg);
      throw new Error(errMsg);
    }
  }

  getAuthHeaders() {
    if (!this.apiKey || !this.accessToken) {
      throw new Error('Zerodha is not connected. Active session token is missing.');
    }
    return {
      'X-Kite-Version': '3',
      'Authorization': `token ${this.apiKey}:${this.accessToken}`
    };
  }

  async getProfile() {
    const res = await fetch('https://api.kite.trade/user/profile', {
      headers: this.getAuthHeaders()
    });
    const data = await res.json();
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.message || 'Failed to fetch user profile');
  }

  async getMargins(segment = 'equity') {
    const res = await fetch(`https://api.kite.trade/user/margins/${segment}`, {
      headers: this.getAuthHeaders()
    });
    const data = await res.json();
    if (data.status === 'success') {
      this.margins = data.data;
      return data.data;
    }
    throw new Error(data.message || 'Failed to fetch margins');
  }

  async getPositions() {
    const res = await fetch('https://api.kite.trade/portfolio/positions', {
      headers: this.getAuthHeaders()
    });
    const data = await res.json();
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.message || 'Failed to fetch positions');
  }

  async getOrders() {
    const res = await fetch('https://api.kite.trade/orders', {
      headers: this.getAuthHeaders()
    });
    const data = await res.json();
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.message || 'Failed to fetch orders');
  }

  async placeOrder({
    variety = 'regular',
    tradingsymbol,
    exchange = 'NFO',
    transaction_type = 'BUY',
    order_type = 'MARKET',
    quantity,
    price = 0,
    product = 'MIS',
    validity = 'DAY',
    trigger_price = 0,
    tag = 'TradingGuruAlgo'
  }) {
    if (!tradingsymbol || !quantity) {
      throw new Error('tradingsymbol and quantity are mandatory for order placement');
    }

    const form = new URLSearchParams({
      tradingsymbol,
      exchange,
      transaction_type: transaction_type.toUpperCase(),
      order_type: order_type.toUpperCase(),
      quantity: String(quantity),
      product: product.toUpperCase(),
      validity: validity.toUpperCase(),
      tag
    });

    if (order_type.toUpperCase() === 'LIMIT' || order_type.toUpperCase() === 'SL') {
      form.append('price', String(price));
    }
    if (order_type.toUpperCase() === 'SL' || order_type.toUpperCase() === 'SL-M') {
      form.append('trigger_price', String(trigger_price));
    }

    const res = await fetch(`https://api.kite.trade/orders/${variety}`, {
      method: 'POST',
      headers: {
        ...this.getAuthHeaders(),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: form.toString()
    });

    const data = await res.json();
    if (data.status === 'success' && data.data?.order_id) {
      console.log(`[ZerodhaBridge] 🚀 Order placed successfully: OrderID=${data.data.order_id} (${transaction_type} ${quantity} ${tradingsymbol})`);
      return { success: true, orderId: data.data.order_id, data: data.data };
    }
    const err = data.message || 'Failed to place order on Zerodha';
    console.error('[ZerodhaBridge] ❌ Order placement error:', err);
    throw new Error(err);
  }

  async cancelOrder(orderId, variety = 'regular') {
    const res = await fetch(`https://api.kite.trade/orders/${variety}/${orderId}`, {
      method: 'DELETE',
      headers: this.getAuthHeaders()
    });
    const data = await res.json();
    if (data.status === 'success') {
      return { success: true, orderId: data.data?.order_id || orderId };
    }
    throw new Error(data.message || 'Failed to cancel order');
  }

  async getQuotes(instruments) {
    const list = Array.isArray(instruments) ? instruments : [instruments];
    const query = list.map(i => `i=${encodeURIComponent(i)}`).join('&');
    const res = await fetch(`https://api.kite.trade/quote?${query}`, {
      headers: this.getAuthHeaders()
    });
    const data = await res.json();
    if (data.status === 'success') {
      return data.data;
    }
    throw new Error(data.message || 'Failed to fetch live quotes');
  }

  getStatus() {
    return {
      broker: 'ZERODHA',
      isConnected: Boolean(this.isConnected && this.accessToken),
      hasCredentials: Boolean(this.apiKey && this.apiSecret),
      userId: this.userId,
      userName: this.userName,
      email: this.email,
      lastLogin: this.lastLogin,
      tokenExpiry: this.tokenExpiry
    };
  }
}

export const zerodhaBridge = new ZerodhaBridge();
