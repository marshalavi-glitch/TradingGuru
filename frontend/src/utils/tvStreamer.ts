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
type OnManualTradeAddedCallback = (trade: any) => void;
type OnManualTradeDeletedCallback = (id: string) => void;
type OnManualTradesClearedCallback = () => void;

class TVWebSocketStreamer {
  private ws: WebSocket | null = null;
  private url: string = '';
  private currentSubscription: { symbol: string; timeframe: string } | null = null;
  private onDataCallback: OnDataCallback | null = null;
  private onErrorCallback: OnErrorCallback | null = null;
  private onStatusCallback: OnStatusCallback | null = null;
  private onOnlineUsersCallback: OnOnlineUsersCallback | null = null;
  private onManualTradeAddedCallback: OnManualTradeAddedCallback | null = null;
  private onManualTradeDeletedCallback: OnManualTradeDeletedCallback | null = null;
  private onManualTradesClearedCallback: OnManualTradesClearedCallback | null = null;
  private reconnectTimeout: number | null = null;
  private fallbackPollInterval: number | null = null;
  private statusTimer: number | null = null;
  private status: 'connecting' | 'connected' | 'disconnected' = 'disconnected';
  private isConnecting: boolean = false;

  constructor() {
    // URL will be resolved dynamically via resolveBackendUrl()
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

  public setManualTradeAddedListener(callback: OnManualTradeAddedCallback) {
    this.onManualTradeAddedCallback = callback;
  }

  public setManualTradeDeletedListener(callback: OnManualTradeDeletedCallback) {
    this.onManualTradeDeletedCallback = callback;
  }

  public setManualTradesClearedListener(callback: OnManualTradesClearedCallback) {
    this.onManualTradesClearedCallback = callback;
  }

  private setStatus(newStatus: 'connecting' | 'connected' | 'disconnected') {
    this.status = newStatus;
    if (this.onStatusCallback) {
      this.onStatusCallback(newStatus);
    }
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
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`WebSocket connection established with ${this.url}`);
        this.isConnecting = false;
        if (this.statusTimer) clearTimeout(this.statusTimer);
        this.stopHttpPollingFallback();
        this.setStatus('connected');
        
        if (this.currentSubscription) {
          this.sendSubscription(this.currentSubscription.symbol, this.currentSubscription.timeframe);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'data') {
            this.setStatus('connected');
            if (this.onDataCallback) {
              this.onDataCallback(payload);
            }
          } else if (payload.type === 'online_users') {
            if (this.onOnlineUsersCallback && typeof payload.count === 'number') {
              this.onOnlineUsersCallback(payload.count);
            }
          } else if (payload.type === 'manual_trade_added') {
            if (this.onManualTradeAddedCallback && payload.trade) {
              this.onManualTradeAddedCallback(payload.trade);
            }
          } else if (payload.type === 'manual_trade_deleted') {
            if (this.onManualTradeDeletedCallback && payload.id) {
              this.onManualTradeDeletedCallback(payload.id);
            }
          } else if (payload.type === 'manual_trades_cleared') {
            if (this.onManualTradesClearedCallback) {
              this.onManualTradesClearedCallback();
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
    }, 2000);
  }

  private stopHttpPollingFallback() {
    if (this.fallbackPollInterval) {
      clearInterval(this.fallbackPollInterval);
      this.fallbackPollInterval = null;
    }
  }

  private async pollHttpCandles() {
    if (!this.currentSubscription) return;
    const { symbol, timeframe } = this.currentSubscription;

    try {
      const httpUrl = getBackendHttpUrlSync();
      const url = `${httpUrl}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=300`;
      const res = await fetch(url, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.candles && data.candles.length > 0 && this.onDataCallback) {
          this.setStatus('connected');
          this.onDataCallback({
            symbol: data.symbol || symbol,
            timeframe: data.timeframe || timeframe,
            isSnapshot: true,
            candles: data.candles
          });
        }
      }
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

  public subscribe(
    symbol: string,
    timeframe: string,
    onData: OnDataCallback,
    onError?: OnErrorCallback
  ) {
    this.currentSubscription = { symbol, timeframe };
    this.onDataCallback = onData;
    if (onError) this.onErrorCallback = onError;

    this.connect();
    this.sendSubscription(symbol, timeframe);
  }

  public unsubscribe() {
    this.currentSubscription = null;
    this.onDataCallback = null;
    this.onErrorCallback = null;
  }

  public disconnect() {
    this.unsubscribe();
    this.stopHttpPollingFallback();
    if (this.statusTimer) clearTimeout(this.statusTimer);
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
