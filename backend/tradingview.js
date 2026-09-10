import './patch_ws.js';
import 'dotenv/config';
import { createSession, createChart, createSeries } from "@ch99q/twc";

export class TradingViewBridge {
  constructor() {
    console.log('[TV Bridge] Initialized');
    this.sharedSession = null;
    this.sessionPromise = null;
    this.activeSubscriptionCount = 0;
  }

  async getSession() {
    if (this.sharedSession) {
      return this.sharedSession;
    }
    if (this.sessionPromise) {
      return this.sessionPromise;
    }

    this.sessionPromise = (async () => {
      let token = process.env.TRADINGVIEW_TOKEN || undefined;
      if (token === 'your_tradingview_sessionid_cookie_here' || token === '') {
        token = undefined;
      }
      if (token) {
        console.log('[TV Bridge] Using TradingView session token');
      }
      
      console.log('[TV Bridge] Connecting new shared TradingView session...');
      const session = await createSession(token);
      
      // Patch the session's emit function to prevent benign events from triggering subscription errors in other concurrent charts
      const originalEmit = session.emit;
      session.emit = function (event, ...args) {
        if (event === "error" && (args[0] === "chart_deleted" || args[0] === "symbol_error")) {
          return; // Swallow benign events
        }
        return originalEmit.apply(this, [event, ...args]);
      };

      session.on("error", (err) => {
        if (err === "chart_deleted" || err === "symbol_error") {
          return; // Ignore benign events
        }
        console.error('[TV Bridge] Shared session socket error:', err);
        this.sharedSession = null;
        this.sessionPromise = null;
      });

      session.on("close", () => {
        console.log('[TV Bridge] Shared session socket closed.');
        this.sharedSession = null;
        this.sessionPromise = null;
      });

      this.sharedSession = session;
      return session;
    })();

    try {
      const session = await this.sessionPromise;
      return session;
    } catch (err) {
      this.sessionPromise = null;
      throw err;
    }
  }

  async subscribeSymbol(symbol, timeframe, onData, onError, limit = 1500) {
    this.activeSubscriptionCount++;
    let decremented = false;
    const decrementCounter = () => {
      if (!decremented) {
        decremented = true;
        this.activeSubscriptionCount = Math.max(0, this.activeSubscriptionCount - 1);
      }
    };
    
    console.log(`[TV Bridge] Subscribing to ${symbol} with timeframe ${timeframe}`);
    
    let session = null;
    let chart = null;
    let series = null;
    let active = true;
    let cleanupFunc = () => {};

    // Map timeframe for TradingView
    let tvTimeframe = timeframe;
    if (timeframe === 'D' || timeframe === 'd') {
      tvTimeframe = '1D';
    } else if (timeframe === 'W' || timeframe === 'w') {
      tvTimeframe = '1W';
    } else if (timeframe === 'M' || timeframe === 'm') {
      tvTimeframe = '1M';
    }

    // Split symbol into exchange and name
    let exchange = 'NASDAQ';
    let name = symbol.trim().toUpperCase();
    if (symbol.includes(':')) {
      const parts = symbol.split(':');
      exchange = parts[0].toUpperCase();
      name = parts[1].toUpperCase();
    }

    // Auto-map crude oil symbols to instant live streaming feeds
    if (name.includes('CRUDE') || name === 'CL1!' || name === 'USOIL') {
      exchange = 'TVC';
      name = 'USOIL';
    }

    try {
      session = await this.getSession();
      if (!active) return () => {};

      chart = await createChart(session);
      if (!active) {
        await chart.close();
        return () => {};
      }

      console.log(`[TV Bridge] Resolving name: ${name}, exchange: ${exchange}`);
      let resolvedSymbol;
      try {
        resolvedSymbol = await chart.resolve(name, exchange);
      } catch (err) {
        if (exchange === 'MCX' || name.includes('CRUDE')) {
          console.log('[TV Bridge] Falling back to TVC:USOIL for Crude Oil feed...');
          resolvedSymbol = await chart.resolve('USOIL', 'TVC');
        } else {
          throw err;
        }
      }
      
      if (!active) {
        await chart.close();
        return () => {};
      }

      series = await createSeries(session, chart, resolvedSymbol, tvTimeframe, limit);
      if (!active) {
        try { if (series) await series.close(); } catch (e) {}
        try { if (chart) await chart.close(); } catch (e) {}
        return () => {};
      }

      // Extract initial history candles
      const historyCandles = series.history.map(c => ({
        time: c[0],
        open: c[1],
        high: c[2],
        low: c[3],
        close: c[4],
        volume: c[5]
      })).sort((a, b) => a.time - b.time);

      const latestHistoryTime = historyCandles.length > 0 ? historyCandles[historyCandles.length - 1].time : 0;

      console.log(`[TV Bridge] Sending ${historyCandles.length} historical candles for ${symbol}`);
      onData({
        symbol,
        timeframe,
        isSnapshot: true,
        candles: historyCandles
      });

      // Define direct du event listener for real-time tick-by-tick updates
      const duListener = (payload) => {
        if (!active) return;
        if (!Array.isArray(payload) || payload[0] !== chart.id || typeof payload[1]?.[series.id] === "undefined") return;
        
        try {
          const data = payload[1][series.id].s.map((i) => i.v);
          for (const update of data) {
            // Skip redundant catch-up ticks
            if (update[0] < latestHistoryTime) {
              continue;
            }
            
            const cleanUpdate = {
              time: update[0],
              open: update[1],
              high: update[2],
              low: update[3],
              close: update[4],
              volume: update[5]
            };

            // Send real-time update
            onData({
              symbol,
              timeframe,
              isSnapshot: false,
              candles: [cleanUpdate]
            });
          }
        } catch (err) {
          console.error(`[TV Bridge] Error processing 'du' update for ${symbol}:`, err);
        }
      };

      session.on("du", duListener);

      // Define cleanup function
      cleanupFunc = async () => {
        console.log(`[TV Bridge] Cleaning up subscription for ${symbol}`);
        active = false;
        decrementCounter();
        try {
          session.off("du", duListener);
        } catch (e) {}
        try {
          if (series) await series.close();
        } catch (e) {}
        try {
          if (chart) await chart.close();
        } catch (e) {}
      };

      return () => cleanupFunc().catch(err => console.warn(`[TV Bridge] Cleanup error ignored for ${symbol}:`, err.message || err));

    } catch (err) {
      decrementCounter();
      console.error(`[TV Bridge] Failed to initialize subscription for ${symbol}:`, err);
      if (onError) onError(err);
      
      // Cleanup what was created
      try {
        if (series) await series.close();
      } catch (e) {}
      try {
        if (chart) await chart.close();
      } catch (e) {}

      return () => {};
    }
  }

  async closeSession() {
    if (this.activeSubscriptionCount > 0) {
      console.log(`[TV Bridge] Skipping session closure: ${this.activeSubscriptionCount} active subscriptions remaining.`);
      return;
    }
    if (this.sharedSession) {
      console.log('[TV Bridge] Closing shared TradingView session to free memory...');
      try {
        await this.sharedSession.close();
      } catch (e) {
        console.error('[TV Bridge] Error closing shared session:', e);
      }
      this.sharedSession = null;
      this.sessionPromise = null;
    }
  }
}
