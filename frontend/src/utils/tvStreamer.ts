import { resolveBackendUrl, getBackendHttpUrlSync, clearBackendUrlCache } from './config';

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

class TVWebSocketStreamer {
  private ws: WebSocket | null = null;
  private url: string = '';
  private currentSubscription: { symbol: string; timeframe: string } | null = null;
  private onDataCallback: OnDataCallback | null = null;
  private onErrorCallback: OnErrorCallback | null = null;
  private onStatusCallback: OnStatusCallback | null = null;
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

    // If already connected to targetWsUrl, set connected and return
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.url === targetWsUrl) {
      this.isConnecting = false;
      this.setStatus('connected');
      return;
    }

    // Close stale connection
    if (this.ws && (this.url !== targetWsUrl || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    this.url = targetWsUrl;
    this.setStatus('connecting');
    console.log(`Connecting to backend stream at ${this.url}...`);

    // Set a fast 3-second safety timer: if WebSocket is slow or blocked, initiate HTTP polling mode & set CONNECTED status
    if (this.statusTimer) clearTimeout(this.statusTimer);
    this.statusTimer = window.setTimeout(() => {
      if (this.status === 'connecting') {
        console.log('[tvStreamer] Fast fallback activated: Marking status CONNECTED (HTTP Polling mode)');
        this.setStatus('connected');
        this.startHttpPollingFallback();
      }
    }, 3000);

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
        console.log('WebSocket closed. Reconnecting & using HTTP stream...');
        this.isConnecting = false;
        this.ws = null;
        this.startHttpPollingFallback();
        clearBackendUrlCache();
        this.triggerReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        this.isConnecting = false;
        this.startHttpPollingFallback();
        clearBackendUrlCache();
        this.triggerReconnect();
      };
    } catch (err) {
      console.error('Failed to create WebSocket client:', err);
      this.isConnecting = false;
      this.startHttpPollingFallback();
      clearBackendUrlCache();
      this.triggerReconnect();
    }
  }

  private startHttpPollingFallback() {
    this.setStatus('connected'); // Mark dashboard online immediately
    if (this.fallbackPollInterval) return;

    console.log('[tvStreamer] Starting background HTTP polling stream...');
    this.pollHttpCandles();
    this.fallbackPollInterval = window.setInterval(() => {
      this.pollHttpCandles();
    }, 5000);
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
      const res = await fetch(url);
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
      // Ignore polling errors
    }
  }

  private triggerReconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      console.log('Attempting instant reconnect with fresh backend URL...');
      clearBackendUrlCache();
      this.connect(true);
    }, 2000);
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

export function getBackendHttpUrl(): string {
  const httpUrl = getBackendHttpUrlSync();
  return httpUrl;
}

export default tvStreamer;
