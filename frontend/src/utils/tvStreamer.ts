import { resolveBackendUrl, getBackendHttpUrlSync as getBackendHttpUrlSyncConfig, clearBackendUrlCache } from './config';

export interface TVDataMessage {
  symbol: string;
  timeframe: string;
  isSnapshot?: boolean;
  candles: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
  matrixHistory?: Record<string, any> | null;
}

type OnDataCallback = (data: TVDataMessage) => void;
type OnErrorCallback = (error: string) => void;
type OnStatusCallback = (status: 'connecting' | 'connected' | 'disconnected') => void;
type OnOnlineUsersCallback = (count: number) => void;
export type OnOnlineUsersListCallback = (users: string[], count: number) => void;
export type OnManualTradeAddedCallback = (trade: any) => void;
export type OnManualTradeDeletedCallback = (id: string) => void;
export type OnManualTradesClearedCallback = () => void;
export type OnVoiceAnnouncementCallback = (alert: any) => void;
export type OnManualTradesQuotesCallback = (quotes: Record<string, any>) => void;
export type OnTelegramTradeIdeasUpdateCallback = (data: any) => void;

class TVWebSocketStreamer {
  private ws: WebSocket | null = null;
  private url: string = '';
  private currentSubscription: { symbol: string; timeframe: string } | null = null;
  private onDataCallback: OnDataCallback | null = null;
  private onErrorCallback: OnErrorCallback | null = null;
  private onStatusCallback: OnStatusCallback | null = null;
  private onOnlineUsersCallback: OnOnlineUsersCallback | null = null;
  private onOnlineUsersListCallbacks: OnOnlineUsersListCallback[] = [];
  private presencePingInterval: number | null = null;
  private onManualTradeAddedCallbacks: OnManualTradeAddedCallback[] = [];
  private onManualTradeDeletedCallbacks: OnManualTradeDeletedCallback[] = [];
  private onManualTradesClearedCallbacks: OnManualTradesClearedCallback[] = [];
  private onVoiceAnnouncementCallbacks: OnVoiceAnnouncementCallback[] = [];
  private onManualTradesQuotesCallbacks: OnManualTradesQuotesCallback[] = [];
  private onSrBreakoutsQuotesCallbacks: ((quotes: Record<string, any>) => void)[] = [];
  private onMarketIndicesCallbacks: ((data: any) => void)[] = [];
  private onTelegramTradeIdeasCallbacks: OnTelegramTradeIdeasUpdateCallback[] = [];
  private onStatusCallbacks: OnStatusCallback[] = [];
  private onTickCallbacks: Array<(tick: { symbol: string; ltp: number; timestamp: number }) => void> = [];
  private dataListeners: Map<string, { symbol: string; timeframe?: string; callback: OnDataCallback }> = new Map();
  private latestQuotesCache: Record<string, { ltp: number; timestamp: number }> = {};
  private lastPolledVoiceId: string | null = null;
  private reconnectTimeout: number | null = null;
  private fallbackPollInterval: number | null = null;
  private statusTimer: number | null = null;
  private status: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  private isConnecting: boolean = false;

  constructor() {
    // URL will be resolved dynamically via resolveBackendUrl()
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
          console.log('[tvStreamer] Window focused - verifying live feed connection...');
          this.connect(true);
        }
      });
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            console.log('[tvStreamer] Tab became visible - verifying live feed connection...');
            this.connect(true);
          }
        }
      });
      window.addEventListener('online', () => {
        console.log('[tvStreamer] Network online event - reconnecting live feed...');
        this.connect(true);
      });
    }
  }

  public computeBackendUrl(): string {
    const httpUrl = getBackendHttpUrlSync();
    try {
      const parsed = new URL(httpUrl);
      const wsProto = (parsed.protocol === 'https:' || parsed.protocol === 'wss:') ? 'wss:' : 'ws:';
      return `${wsProto}//${parsed.host}`;
    } catch (e) {
      let clean = httpUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
      return `${protocol}//${clean}`;
    }
  }

  public setBackendUrl(newUrl: string) {
    if (newUrl && newUrl.trim()) {
      localStorage.setItem('TRADING_GURU_BACKEND_URL', newUrl.trim());
    } else {
      localStorage.removeItem('TRADING_GURU_BACKEND_URL');
    }
    clearBackendUrlCache();
    this.disconnect();
    this.connect(true);
  }

  public setStatusListener(callback: OnStatusCallback) {
    this.onStatusCallback = callback;
    callback(this.status);
  }

  public setOnlineUsersListener(callback: OnOnlineUsersCallback) {
    this.onOnlineUsersCallback = callback;
  }

  public addOnlineUsersListListener(callback: OnOnlineUsersListCallback) {
    if (!this.onOnlineUsersListCallbacks.includes(callback)) {
      this.onOnlineUsersListCallbacks.push(callback);
    }
  }

  public removeOnlineUsersListListener(callback: OnOnlineUsersListCallback) {
    this.onOnlineUsersListCallbacks = this.onOnlineUsersListCallbacks.filter(c => c !== callback);
  }

  public identifyUser(username: string | null) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN && username) {
      try {
        this.ws.send(JSON.stringify({ type: 'presence', username: username.trim().toLowerCase() }));
      } catch (e) {}
    }
  }

  private getStoredAuthUsername(): string | null {
    try {
      return localStorage.getItem('trading_guru_auth_user_v2') || sessionStorage.getItem('trading_guru_auth_user_v2') || null;
    } catch (e) {
      return null;
    }
  }

  public setManualTradeAddedListener(callback: OnManualTradeAddedCallback) {
    if (!this.onManualTradeAddedCallbacks.includes(callback)) {
      this.onManualTradeAddedCallbacks.push(callback);
    }
  }

  public addManualTradeAddedListener(callback: OnManualTradeAddedCallback) {
    this.setManualTradeAddedListener(callback);
  }

  public setManualTradeDeletedListener(callback: OnManualTradeDeletedCallback) {
    if (!this.onManualTradeDeletedCallbacks.includes(callback)) {
      this.onManualTradeDeletedCallbacks.push(callback);
    }
  }

  public addManualTradeDeletedListener(callback: OnManualTradeDeletedCallback) {
    this.setManualTradeDeletedListener(callback);
  }

  public setManualTradesClearedListener(callback: OnManualTradesClearedCallback) {
    if (!this.onManualTradesClearedCallbacks.includes(callback)) {
      this.onManualTradesClearedCallbacks.push(callback);
    }
  }

  public addManualTradesClearedListener(callback: OnManualTradesClearedCallback) {
    this.setManualTradesClearedListener(callback);
  }

  public setVoiceAnnouncementListener(callback: OnVoiceAnnouncementCallback) {
    if (!this.onVoiceAnnouncementCallbacks.includes(callback)) {
      this.onVoiceAnnouncementCallbacks.push(callback);
    }
  }

  public addVoiceAnnouncementListener(callback: OnVoiceAnnouncementCallback) {
    this.setVoiceAnnouncementListener(callback);
  }

  public setManualTradesQuotesListener(callback: OnManualTradesQuotesCallback) {
    if (!this.onManualTradesQuotesCallbacks.includes(callback)) {
      this.onManualTradesQuotesCallbacks.push(callback);
    }
  }

  public addManualTradesQuotesListener(callback: OnManualTradesQuotesCallback) {
    this.setManualTradesQuotesListener(callback);
  }

  public setSrBreakoutsQuotesListener(callback: (quotes: Record<string, any>) => void) {
    if (!this.onSrBreakoutsQuotesCallbacks.includes(callback)) {
      this.onSrBreakoutsQuotesCallbacks.push(callback);
    }
  }

  public addSrBreakoutsQuotesListener(callback: (quotes: Record<string, any>) => void) {
    this.setSrBreakoutsQuotesListener(callback);
  }

  public removeSrBreakoutsQuotesListener(callback: (quotes: Record<string, any>) => void) {
    this.onSrBreakoutsQuotesCallbacks = this.onSrBreakoutsQuotesCallbacks.filter(cb => cb !== callback);
  }

  public setMarketIndicesListener(callback: (data: any) => void) {
    if (!this.onMarketIndicesCallbacks.includes(callback)) {
      this.onMarketIndicesCallbacks.push(callback);
    }
  }

  public addMarketIndicesListener(callback: (data: any) => void) {
    this.setMarketIndicesListener(callback);
  }

  public removeMarketIndicesListener(callback: (data: any) => void) {
    this.onMarketIndicesCallbacks = this.onMarketIndicesCallbacks.filter(cb => cb !== callback);
  }

  public getStatus(): 'connecting' | 'connected' | 'disconnected' {
    return this.status;
  }

  public addStatusListener(callback: OnStatusCallback): () => void {
    if (!this.onStatusCallbacks.includes(callback)) {
      this.onStatusCallbacks.push(callback);
    }
    try { callback(this.status); } catch (e) {}
    return () => {
      this.onStatusCallbacks = this.onStatusCallbacks.filter(cb => cb !== callback);
    };
  }

  public getLatestLtp(symbol: string): { ltp: number; timestamp: number } | null {
    if (!symbol) return null;
    const clean = symbol.trim().toUpperCase();
    const noPrefix = clean.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '');
    const stripped = noPrefix.replace(/(1!|\.FUT|FUT|-FUT)$/, '').trim();
    return this.latestQuotesCache[clean] ||
           this.latestQuotesCache[noPrefix] ||
           this.latestQuotesCache[`NSE:${noPrefix}`] ||
           this.latestQuotesCache[`MCX:${noPrefix}`] ||
           this.latestQuotesCache[`BSE:${noPrefix}`] ||
           this.latestQuotesCache[stripped] ||
           this.latestQuotesCache[`NSE:${stripped}`] ||
           this.latestQuotesCache[`MCX:${stripped}`] ||
           null;
  }

  public addTickListener(callback: (tick: { symbol: string; ltp: number; timestamp: number }) => void): () => void {
    this.onTickCallbacks.push(callback);
    return () => {
      this.onTickCallbacks = this.onTickCallbacks.filter(cb => cb !== callback);
    };
  }

  public addTelegramTradeIdeasListener(callback: OnTelegramTradeIdeasUpdateCallback): () => void {
    if (!this.onTelegramTradeIdeasCallbacks.includes(callback)) {
      this.onTelegramTradeIdeasCallbacks.push(callback);
    }
    return () => {
      this.onTelegramTradeIdeasCallbacks = this.onTelegramTradeIdeasCallbacks.filter(cb => cb !== callback);
    };
  }

  public isSymbolMatch(a: string, b: string): boolean {
    if (a === b) return true;
    const cleanA = a.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
    const cleanB = b.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').trim().toUpperCase();
    return cleanA === cleanB;
  }

  public updateLtpCache(symbol: string, ltp: number) {
    if (!symbol || typeof ltp !== 'number' || isNaN(ltp)) return;
    const now = Date.now();
    const clean = symbol.trim().toUpperCase();
    const noPrefix = clean.replace(/^(NSE:|BSE:|MCX:|NFO:)/, '');
    const entry = { ltp, timestamp: now };
    this.latestQuotesCache[clean] = entry;
    this.latestQuotesCache[noPrefix] = entry;
    this.latestQuotesCache[`NSE:${noPrefix}`] = entry;
    this.latestQuotesCache[`MCX:${noPrefix}`] = entry;

    this.onTickCallbacks.forEach(cb => {
      try { cb({ symbol: clean, ltp, timestamp: now }); } catch (e) {}
    });
  }

  private setStatus(newStatus: 'connecting' | 'connected' | 'disconnected') {
    this.status = newStatus;
    if (this.onStatusCallback) {
      try { this.onStatusCallback(newStatus); } catch (e) {}
    }
    this.onStatusCallbacks.forEach(cb => {
      try { cb(newStatus); } catch (e) {}
    });
  }

  public async connect(forceFreshUrl = false) {
    if (this.isConnecting) return;
    this.isConnecting = true;

    if (forceFreshUrl) {
      clearBackendUrlCache();
    }

    const httpUrl = await resolveBackendUrl(forceFreshUrl);
    let targetWsUrl = '';
    try {
      const parsed = new URL(httpUrl);
      const wsProto = (parsed.protocol === 'https:' || parsed.protocol === 'wss:') ? 'wss:' : 'ws:';
      targetWsUrl = `${wsProto}//${parsed.host}`;
    } catch (e) {
      let clean = httpUrl.replace(/^https?:\/\//, '').replace(/\/$/, '');
      const protocol = (typeof window !== 'undefined' && window.location.protocol === 'https:') ? 'wss:' : 'ws:';
      targetWsUrl = `${protocol}//${clean}`;
    }

    // If already connected to targetWsUrl via WS, keep connected
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.url === targetWsUrl) {
      this.isConnecting = false;
      this.setStatus('connected');
      return;
    }

    // If HTTP polling fallback is active, keep status as 'connected'
    if (this.fallbackPollInterval) {
      this.setStatus('connected');
    } else if (this.status === 'disconnected') {
      this.setStatus('connecting');
    }

    // Close stale connection
    if (this.ws && (this.url !== targetWsUrl || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.url = targetWsUrl;
    console.log(`Connecting to backend stream at ${this.url}...`);

    // Fast 1.5-second safety timer: if WebSocket is slow/blocked, activate HTTP polling mode & set CONNECTED status immediately
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      if (this.status !== 'connected') {
        console.log('[tvStreamer] Instant fallback activated: Setting status CONNECTED (HTTP Polling Stream)');
        this.setStatus('connected');
      }
      this.startHttpPollingFallback();
    }, 1500);

    try {
      const storedUser = this.getStoredAuthUsername();
      let targetWsUrl = this.url;
      if (storedUser) {
        const sep = targetWsUrl.includes('?') ? '&' : '?';
        targetWsUrl = `${targetWsUrl}${sep}user=${encodeURIComponent(storedUser.trim().toLowerCase())}`;
      }
      this.ws = new WebSocket(targetWsUrl);

      this.ws.onopen = () => {
        console.log(`WebSocket connection established with ${this.url}`);
        this.isConnecting = false;
        if (this.statusTimer) clearTimeout(this.statusTimer);
        this.stopHttpPollingFallback();
        this.setStatus('connected');

        // Immediately register presence on connection
        const currentUser = this.getStoredAuthUsername();
        if (currentUser && this.ws && this.ws.readyState === WebSocket.OPEN) {
          try {
            this.ws.send(JSON.stringify({ type: 'presence', username: currentUser.trim().toLowerCase() }));
          } catch (e) {}
        }

        // Start periodic 10s presence heartbeat over WebSocket
        if (this.presencePingInterval) clearInterval(this.presencePingInterval);
        this.presencePingInterval = window.setInterval(() => {
          if (this.ws && this.ws.readyState === WebSocket.OPEN) {
            const u = this.getStoredAuthUsername();
            if (u) {
              try {
                this.ws.send(JSON.stringify({ type: 'heartbeat', username: u.trim().toLowerCase() }));
              } catch (e) {}
            }
          }
        }, 10000);
        
        if (this.dataListeners.size > 0) {
          const sent = new Set<string>();
          this.dataListeners.forEach((listener) => {
            const key = `${listener.symbol}_${listener.timeframe || '5'}`;
            if (!sent.has(key)) {
              sent.add(key);
              this.sendSubscription(listener.symbol, listener.timeframe || '5');
            }
          });
        } else if (this.currentSubscription) {
          this.sendSubscription(this.currentSubscription.symbol, this.currentSubscription.timeframe);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'data') {
            this.setStatus('connected');
            if (payload.candles && payload.candles.length > 0) {
              const last = payload.candles[payload.candles.length - 1];
              if (last && typeof last.close === 'number') {
                this.updateLtpCache(payload.symbol, last.close);
              }
            }
            const notified = new Set<OnDataCallback>();
            this.dataListeners.forEach((listener) => {
              const symbolMatches = !listener.symbol || this.isSymbolMatch(listener.symbol, payload.symbol);
              const tfMatches = !listener.timeframe || !payload.timeframe || String(listener.timeframe) === String(payload.timeframe);
              if (symbolMatches && tfMatches) {
                if (!notified.has(listener.callback)) {
                  notified.add(listener.callback);
                  try { listener.callback(payload); } catch (e) {}
                }
              }
            });
            if (this.onDataCallback && !notified.has(this.onDataCallback) && this.currentSubscription && this.isSymbolMatch(this.currentSubscription.symbol, payload.symbol)) {
              try { this.onDataCallback(payload); } catch (e) {}
            }
          } else if (payload.type === 'online_users') {
            if (this.onOnlineUsersCallback && typeof payload.count === 'number') {
              this.onOnlineUsersCallback(payload.count);
            }
            if (Array.isArray(payload.onlineUsers)) {
              this.onOnlineUsersListCallbacks.forEach(cb => {
                try { cb(payload.onlineUsers, payload.count || payload.onlineUsers.length); } catch (e) {}
              });
            }
          } else if (payload.type === 'manual_trade_added') {
            if (payload.trade) {
              this.onManualTradeAddedCallbacks.forEach(cb => {
                try { cb(payload.trade); } catch (e) {}
              });
            }
          } else if (payload.type === 'manual_trade_deleted') {
            if (payload.id) {
              this.onManualTradeDeletedCallbacks.forEach(cb => {
                try { cb(payload.id); } catch (e) {}
              });
            }
          } else if (payload.type === 'manual_trades_cleared') {
            this.onManualTradesClearedCallbacks.forEach(cb => {
              try { cb(); } catch (e) {}
            });
          } else if (payload.type === 'manual_trades_quotes') {
            if (payload.quotes) {
              Object.keys(payload.quotes).forEach(sym => {
                const q = payload.quotes[sym];
                if (q && typeof q.ltp === 'number') {
                  this.updateLtpCache(sym, q.ltp);
                }
              });
              this.onManualTradesQuotesCallbacks.forEach(cb => {
                try { cb(payload.quotes); } catch (e) { console.error('Manual trades quotes callback error:', e); }
              });
            }
          } else if (payload.type === 'sr_breakouts_quotes') {
            if (payload.quotes) {
              Object.keys(payload.quotes).forEach(sym => {
                const q = payload.quotes[sym];
                if (q && typeof q.ltp === 'number') {
                  this.updateLtpCache(sym, q.ltp);
                }
              });
              this.onSrBreakoutsQuotesCallbacks.forEach(cb => {
                try { cb(payload.quotes); } catch (e) { console.error('SR Breakouts quotes callback error:', e); }
              });
            }
          } else if (payload.type === 'mcx_quotes') {
            if (payload.quotes) {
              Object.keys(payload.quotes).forEach(sym => {
                const q = payload.quotes[sym];
                if (q && typeof q.ltp === 'number') {
                  this.updateLtpCache(sym, q.ltp);
                }
              });
            }
          } else if (payload.type === 'market_indices') {
            if (typeof payload.nifty === 'number') this.updateLtpCache('NSE:NIFTY', payload.nifty);
            if (typeof payload.niftyFut === 'number') this.updateLtpCache('NSE:NIFTY1!', payload.niftyFut);
            if (typeof payload.banknifty === 'number') this.updateLtpCache('NSE:BANKNIFTY', payload.banknifty);
            if (typeof payload.bankniftyFut === 'number') this.updateLtpCache('NSE:BANKNIFTY1!', payload.bankniftyFut);
            if (typeof payload.sensex === 'number') this.updateLtpCache('BSE:SENSEX', payload.sensex);
            if (Array.isArray(payload.items)) {
              payload.items.forEach((item: any) => {
                if (item && item.symbol && typeof item.ltp === 'number') {
                  this.updateLtpCache(item.symbol, item.ltp);
                }
              });
            }
            if (payload.items) {
              this.onMarketIndicesCallbacks.forEach(cb => {
                try { cb(payload); } catch (e) { console.error('Market indices callback error:', e); }
              });
            }
          } else if (payload.type === 'voice_announcement') {
            if (payload.alert) {
              this.lastPolledVoiceId = payload.alert.id;
              this.onVoiceAnnouncementCallbacks.forEach(cb => {
                try { cb(payload.alert); } catch (e) { console.error('Voice callback error:', e); }
              });
            }
          } else if (payload.type === 'TELEGRAM_TRADE_IDEAS_UPDATE') {
            if (payload.data) {
              this.onTelegramTradeIdeasCallbacks.forEach(cb => {
                try { cb(payload.data); } catch (e) { console.error('Telegram trade ideas callback error:', e); }
              });
            }
          } else if (payload.type === 'error') {
            console.error('WebSocket error from server:', payload.message);
            if (this.onErrorCallback) {
              this.onErrorCallback(payload.message);
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket closed/unavailable. Retaining CONNECTED state & streaming via HTTP...');
        this.isConnecting = false;
        this.ws = null;
        this.setStatus('connected');
        this.startHttpPollingFallback();
        this.triggerReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket error:', err);
        this.isConnecting = false;
        this.setStatus('connected');
        this.startHttpPollingFallback();
        this.triggerReconnect();
      };
    } catch (err) {
      console.error('Failed to create WebSocket client:', err);
      this.isConnecting = false;
      this.setStatus('connected');
      this.startHttpPollingFallback();
      this.triggerReconnect();
    }
  }

  private startHttpPollingFallback() {
    this.setStatus('connected'); // Mark dashboard online immediately 24/7
    if (this.fallbackPollInterval) return;

    console.log('[tvStreamer] Starting background HTTP polling stream...');
    this.pollHttpCandles();
    this.fallbackPollInterval = window.setInterval(() => {
      this.pollHttpCandles();
    }, 750);
  }

  private stopHttpPollingFallback() {
    if (this.fallbackPollInterval) {
      clearInterval(this.fallbackPollInterval);
      this.fallbackPollInterval = null;
    }
  }

  private async pollHttpCandles() {
    const pairs = new Map<string, { symbol: string; timeframe: string }>();
    if (this.dataListeners.size > 0) {
      this.dataListeners.forEach((l) => {
        const key = `${l.symbol}_${l.timeframe || '5'}`;
        if (!pairs.has(key)) pairs.set(key, { symbol: l.symbol, timeframe: l.timeframe || '5' });
      });
    } else if (this.currentSubscription) {
      pairs.set(`${this.currentSubscription.symbol}_${this.currentSubscription.timeframe}`, this.currentSubscription);
    }
    if (pairs.size === 0) return;

    try {
      const httpUrl = await resolveBackendUrl();
      for (const { symbol, timeframe } of pairs.values()) {
        try {
          const url = `${httpUrl}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=300`;
          const res = await fetch(url, {
            headers: { 'bypass-tunnel-reminder': 'true' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data.candles && data.candles.length > 0) {
              const sym = data.symbol || symbol;
              const last = data.candles[data.candles.length - 1];
              if (last && typeof last.close === 'number') {
                this.updateLtpCache(sym, last.close);
              }
              this.setStatus('connected');
              const payload: TVDataMessage = {
                symbol: sym,
                timeframe: data.timeframe || timeframe,
                isSnapshot: true,
                candles: data.candles
              };
              const notified = new Set<OnDataCallback>();
              this.dataListeners.forEach((listener) => {
                const symbolMatches = !listener.symbol || this.isSymbolMatch(listener.symbol, sym);
                const tfMatches = !listener.timeframe || !payload.timeframe || String(listener.timeframe) === String(payload.timeframe);
                if (symbolMatches && tfMatches) {
                  if (!notified.has(listener.callback)) {
                    notified.add(listener.callback);
                    try { listener.callback(payload); } catch (e) {}
                  }
                }
              });
              if (this.onDataCallback && !notified.has(this.onDataCallback) && this.currentSubscription && this.isSymbolMatch(this.currentSubscription.symbol, sym)) {
                try { this.onDataCallback(payload); } catch (e) {}
              }
            }
          }
        } catch (e) {}
      }

      // Check for MCX live quotes fallback
      if (symbol.includes('MCX') || symbol.includes('CRUDE') || symbol.includes('NATURALGAS') || symbol.includes('GOLD') || symbol.includes('SILVER') || symbol.includes('ZINC')) {
        try {
          const mcxRes = await fetch(`${httpUrl}/api/mcx/live-quotes`, {
            headers: { 'bypass-tunnel-reminder': 'true' }
          });
          if (mcxRes.ok) {
            const mData = await mcxRes.json();
            if (mData.quotes) {
              Object.keys(mData.quotes).forEach(sym => {
                const q = mData.quotes[sym];
                if (q && typeof q.ltp === 'number') {
                  this.updateLtpCache(sym, q.ltp);
                }
              });
            }
          }
        } catch (e) {}
      }

      // Refresh live market indices and futures quotes
      try {
        const indRes = await fetch(`${httpUrl}/api/market-indices`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        });
        if (indRes.ok) {
          const iData = await indRes.json();
          if (typeof iData.nifty === 'number') this.updateLtpCache('NSE:NIFTY', iData.nifty);
          if (typeof iData.niftyFut === 'number') this.updateLtpCache('NSE:NIFTY1!', iData.niftyFut);
          if (typeof iData.banknifty === 'number') this.updateLtpCache('NSE:BANKNIFTY', iData.banknifty);
          if (typeof iData.bankniftyFut === 'number') this.updateLtpCache('NSE:BANKNIFTY1!', iData.bankniftyFut);
          if (typeof iData.finnifty === 'number') this.updateLtpCache('NSE:FINNIFTY', iData.finnifty);
          if (typeof iData.finniftyFut === 'number') this.updateLtpCache('NSE:FINNIFTY1!', iData.finniftyFut);
          if (typeof iData.midcpnifty === 'number') this.updateLtpCache('NSE:MIDCPNIFTY', iData.midcpnifty);
          if (typeof iData.midcpniftyFut === 'number') this.updateLtpCache('NSE:MIDCPNIFTY1!', iData.midcpniftyFut);
          if (typeof iData.sensex === 'number') this.updateLtpCache('BSE:SENSEX', iData.sensex);
        }
      } catch (e) {}
    } catch (e) {
      // Retain connected status during transient network hiccups
      this.setStatus('connected');
    }
  }

  private triggerReconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      console.log('Background check for fresh backend stream...');
      this.connect(false);
    }, 10000);
  }

  private sendSubscription(symbol: string, timeframe: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({
        type: 'subscribe',
        symbol,
        timeframe
      });
      this.ws.send(msg);
      console.log(`Sent subscription request for ${symbol} (${timeframe})`);
    }
  }

  public sendUnsubscribe(symbol?: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg = JSON.stringify({
        type: 'unsubscribe',
        symbol
      });
      try { this.ws.send(msg); } catch (e) {}
    }
  }

  public subscribe(
    symbol: string,
    timeframe: string,
    onData: OnDataCallback,
    onError?: OnErrorCallback
  ): () => void {
    const subId = 'sub_' + Math.random().toString(36).substring(2, 9);
    this.dataListeners.set(subId, { symbol, timeframe, callback: onData });
    this.currentSubscription = { symbol, timeframe };
    this.onDataCallback = onData;
    if (onError) this.onErrorCallback = onError;

    this.connect();
    this.sendSubscription(symbol, timeframe);

    return () => {
      const item = this.dataListeners.get(subId);
      this.dataListeners.delete(subId);
      if (this.onDataCallback === onData) {
        const remaining = Array.from(this.dataListeners.values());
        this.onDataCallback = remaining.length > 0 ? remaining[remaining.length - 1].callback : null;
      }
      if (item) {
        const stillListening = Array.from(this.dataListeners.values()).some(l => this.isSymbolMatch(l.symbol, item.symbol));
        if (!stillListening) {
          this.sendUnsubscribe(item.symbol);
        }
      }
      if (this.dataListeners.size === 0) {
        this.sendUnsubscribe(symbol);
        this.currentSubscription = null;
      }
    };
  }

  public unsubscribe() {
    this.sendUnsubscribe(this.currentSubscription?.symbol);
    this.dataListeners.clear();
    this.currentSubscription = null;
    this.onDataCallback = null;
    this.onErrorCallback = null;
  }

  public disconnect() {
    this.unsubscribe();
    this.stopHttpPollingFallback();
    if (this.statusTimer) clearTimeout(this.statusTimer);
    if (this.presencePingInterval) {
      clearInterval(this.presencePingInterval);
      this.presencePingInterval = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
    this.setStatus('disconnected');
  }
}

export const tvStreamer = new TVWebSocketStreamer();

export async function getBackendHttpUrl(): Promise<string> {
  const httpUrl = await resolveBackendUrl();
  return httpUrl;
}

export function getBackendHttpUrlSync(): string {
  return getBackendHttpUrlSyncConfig();
}

export default tvStreamer;
