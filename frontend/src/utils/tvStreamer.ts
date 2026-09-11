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

    // If already connected to targetWsUrl, keep connection open
    if (this.ws && this.ws.readyState === WebSocket.OPEN && this.url === targetWsUrl) {
      this.isConnecting = false;
      this.setStatus('connected');
      return;
    }

    // Close existing socket if connecting/connected to a different or stale URL
    if (this.ws && (this.url !== targetWsUrl || this.ws.readyState === WebSocket.CLOSED || this.ws.readyState === WebSocket.CLOSING)) {
      try {
        this.ws.close();
      } catch (e) {}
      this.ws = null;
    }

    if (this.ws && this.ws.readyState === WebSocket.CONNECTING && this.url === targetWsUrl) {
      this.isConnecting = false;
      return;
    }

    this.url = targetWsUrl;
    this.setStatus('connecting');
    console.log(`Connecting to backend WebSocket at ${this.url}...`);

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        console.log(`WebSocket connection established with ${this.url}`);
        this.isConnecting = false;
        this.setStatus('connected');
        
        // Resubscribe if we had an active subscription
        if (this.currentSubscription) {
          this.sendSubscription(this.currentSubscription.symbol, this.currentSubscription.timeframe);
        }
      };

      this.ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === 'data') {
            if (this.onDataCallback) {
              this.onDataCallback(payload);
            }
          } else if (payload.type === 'error') {
            console.error('WebSocket Error message from server:', payload.message);
            if (this.onErrorCallback) {
              this.onErrorCallback(payload.message);
            }
          }
        } catch (e) {
          console.error('Error parsing WebSocket message:', e);
        }
      };

      this.ws.onclose = () => {
        console.log('WebSocket connection closed. Reconnecting...');
        this.isConnecting = false;
        this.setStatus('connecting');
        this.ws = null;
        clearBackendUrlCache();
        this.triggerReconnect();
      };

      this.ws.onerror = (err) => {
        console.error('WebSocket connection error:', err);
        this.isConnecting = false;
        this.setStatus('connecting');
        clearBackendUrlCache();
        this.triggerReconnect();
      };
    } catch (err) {
      console.error('Failed to create WebSocket client:', err);
      this.isConnecting = false;
      this.setStatus('connecting');
      clearBackendUrlCache();
      this.triggerReconnect();
    }
  }

  private triggerReconnect() {
    if (this.reconnectTimeout) return;

    this.reconnectTimeout = window.setTimeout(() => {
      this.reconnectTimeout = null;
      console.log('Attempting instant reconnect with fresh backend URL...');
      clearBackendUrlCache();
      this.connect(true);
    }, 1500);
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
    } else {
      console.warn('Cannot send subscription, WebSocket not open. Will subscribe upon connection.');
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
