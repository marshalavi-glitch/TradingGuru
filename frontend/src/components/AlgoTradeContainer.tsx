import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Zap, TrendingUp, TrendingDown, Target, Shield, Activity, CheckCircle2, 
  XCircle, AlertTriangle, Play, RotateCcw, Sliders, Settings, RefreshCw, 
  Search, Award, Volume2, VolumeX, Eye, ArrowUpRight, ArrowDownRight, 
  SlidersHorizontal, Check, Clock, ChevronRight, BarChart2, DollarSign,
  Maximize2, Minimize2, ExternalLink, FileText, ShieldCheck
} from 'lucide-react';
import { 
  runMarshallStrategyEngine, 
  extractMarshallLevels, 
  DEFAULT_MARSHALL_CONFIG, 
  type MarshallLevels, 
  type MarshallSignal, 
  type MarshallEngineConfig,
  type MarshallState,
  type MarshallStrategyType
} from '../utils/marshallStrategyEngine';
import type { Candle } from '../utils/profileCalculator';
import { getBackendHttpUrl, tvStreamer } from '../utils/tvStreamer';

interface AlgoTradeContainerProps {
  onSwitchToChart?: (symbol: string) => void;
}

const INSTRUMENTS = [
  { symbol: 'NSE:NIFTY', name: 'NIFTY 50', group: 'INDEX' },
  { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY', group: 'INDEX' },
  { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY', group: 'INDEX' },
  { symbol: 'NSE:MIDCPNIFTY', name: 'MIDCP NIFTY', group: 'INDEX' },
  { symbol: 'NSE:RELIANCE', name: 'RELIANCE', group: 'EQUITY' },
  { symbol: 'NSE:HDFCBANK', name: 'HDFC BANK', group: 'EQUITY' },
  { symbol: 'NSE:ICICIBANK', name: 'ICICI BANK', group: 'EQUITY' },
  { symbol: 'NSE:SBIN', name: 'STATE BANK', group: 'EQUITY' },
  { symbol: 'NSE:INFY', name: 'INFOSYS', group: 'EQUITY' },
  { symbol: 'NSE:TCS', name: 'TCS', group: 'EQUITY' },
  { symbol: 'NSE:BHARTIARTL', name: 'BHARTI AIRTEL', group: 'EQUITY' },
  { symbol: 'NSE:ITC', name: 'ITC', group: 'EQUITY' },
  { symbol: 'NSE:LT', name: 'L&T', group: 'EQUITY' },
  { symbol: 'NSE:AXISBANK', name: 'AXIS BANK', group: 'EQUITY' },
  { symbol: 'NSE:KOTAKBANK', name: 'KOTAK BANK', group: 'EQUITY' },
  { symbol: 'NSE:TATAMOTORS', name: 'TATA MOTORS', group: 'EQUITY' },
  { symbol: 'NSE:BAJFINANCE', name: 'BAJAJ FINANCE', group: 'EQUITY' },
  { symbol: 'NSE:MARUTI', name: 'MARUTI', group: 'EQUITY' },
  { symbol: 'NSE:SUNPHARMA', name: 'SUN PHARMA', group: 'EQUITY' },
  { symbol: 'NSE:TITAN', name: 'TITAN', group: 'EQUITY' },
  // MCX Commodities (Only Crude & NG per user rule)
  { symbol: 'MCX:CRUDEOIL', name: 'CRUDE OIL', group: 'COMMODITY' },
  { symbol: 'MCX:NATURALGAS', name: 'NATURAL GAS', group: 'COMMODITY' }
];

const TIMEFRAMES = [
  { value: '1', label: '1m Scalp' },
  { value: '3', label: '3m Momentum' },
  { value: '5', label: '5m Primary (Intraday)' },
  { value: '15', label: '15m Swing' },
  { value: '30', label: '30m Trend' },
  { value: '1H', label: '1 Hour' },
  { value: 'D', label: 'Daily' }
];

export const AlgoTradeContainer: React.FC<AlgoTradeContainerProps> = ({ onSwitchToChart }) => {
  // Navigation & Primary Selection
  const [symbol, setSymbol] = useState<string>('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState<string>('5');

  const isStandalone = useMemo(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('standalone') === 'true';
    } catch (e) {
      return false;
    }
  }, []);

  const [activeView, setActiveView] = useState<'POSITIONS' | 'AUDIT_LOG' | 'HISTORY' | 'REVERSAL_SCANNER' | 'CHART'>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sub = (urlParams.get('subview') || '').toUpperCase();
            if (sub === 'POSITIONS') return 'POSITIONS';
      if (sub === 'HISTORY') return 'HISTORY';
      if (sub === 'AUDIT_LOG') return 'AUDIT_LOG';
    } catch (e) {}
    return 'POSITIONS';
  });

  // Engine Configuration & Settings Drawer
  const [config, setConfig] = useState<MarshallEngineConfig>(DEFAULT_MARSHALL_CONFIG);
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // Candles & Live Telemetry
  const [candles, setCandles] = useState<Candle[]>([]);
  const [liveLtp, setLiveLtp] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');

  // Scanner Multi-Stock Feed
  const [scanItems, setScanItems] = useState<any[]>(() => {
    return INSTRUMENTS.map((inst, idx) => {
      const p = inst.symbol === 'NSE:NIFTY' ? 25173.75 : 
                inst.symbol.includes('BANKNIFTY') ? 61984.75 : 
                inst.symbol.includes('FINNIFTY') ? 27943.00 :
                inst.symbol.includes('MIDCPNIFTY') ? 14071.20 :
                inst.symbol.includes('CRUDE') ? 334.10 : 
                inst.symbol.includes('NATURALGAS') ? 131170.00 :
                inst.symbol.includes('RELIANCE') ? 1356.70 : 1000 + idx * 50;
      const isSell = idx % 2 === 1;
      return {
        symbol: inst.symbol,
        name: inst.name,
        ltp: p,
        currentPrice: p,
        strategy: isSell ? 'PRIMARY_SELL' : 'PRIMARY_BUY',
        direction: isSell ? 'SELL' : 'BUY',
        state: isSell ? 'BREAKDOWN_CONFIRMED' : 'BREAKOUT_CONFIRMED',
        entryPrice: p,
        stopLossPrice: isSell ? Math.round(p * 1.004 * 10) / 10 : Math.round(p * 0.996 * 10) / 10,
        target1Price: isSell ? Math.round(p * 0.994 * 10) / 10 : Math.round(p * 1.006 * 10) / 10,
        target2Price: isSell ? Math.round(p * 0.988 * 10) / 10 : Math.round(p * 1.012 * 10) / 10,
        riskRewardRatio: 1.5,
        distancePct: 0.2
      };
    });
  });
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scannerFilter, setScannerFilter] = useState<'ALL' | 'BUY' | 'SELL' | 'ACTIVE'>('ALL');

  // Live Position Book / Orders
  const [activeTrades, setActiveTrades] = useState<any[]>([]);
  const [capitalSummary, setCapitalSummary] = useState<any>({
    initialCapital: 1500000,
    availableMargin: 1500000,
    openMarginDeployed: 0,
    totalRealizedPnL: 0,
    totalUnrealizedPnL: 0,
    netAccountValue: 1500000,
    totalTrades: 0,
    openTradesCount: 0,
    closedTradesCount: 0,
    winningTrades: 0,
    losingTrades: 0,
    winRatePct: 0
  });
  const [tradeMessage, setTradeMessage] = useState<string>('');

  // Segregate open and closed positions
  const openTrades = useMemo(() => {
    return activeTrades.filter(t => t.status === 'OPEN' || t.status === 'ACTIVE' || t.status === 'TARGET_1_HIT');
  }, [activeTrades]);

  const closedTrades = useMemo(() => {
    return activeTrades.filter(t => t.status !== 'OPEN' && t.status !== 'ACTIVE' && t.status !== 'TARGET_1_HIT');
  }, [activeTrades]);

  // Unified chronological audit stream from all trades
  const unifiedAuditLogs = useMemo(() => {
    const list: any[] = [];
    activeTrades.forEach(trade => {
      if (trade.auditTrail && Array.isArray(trade.auditTrail) && trade.auditTrail.length > 0) {
        trade.auditTrail.forEach((item: any, idx: number) => {
          list.push({
            id: `${trade.id}_${idx}`,
            tradeId: trade.id,
            symbol: trade.symbol,
            direction: trade.direction,
            strategy: trade.strategy,
            timestamp: item.dateTimeIST || trade.entryDateTime || item.timestamp,
            rawTimestamp: item.timestamp ? new Date(item.timestamp).getTime() : 0,
            action: item.event || 'ALGO_ACTION',
            details: item.details || trade.triggerReason,
            pnl: item.event?.includes('TARGET_2') ? trade.realizedPnL : (item.event?.includes('STOP_LOSS') ? trade.realizedPnL : null),
            badgeColor: item.event?.includes('TARGET') ? '#10b981' : item.event?.includes('STOP') ? '#f43f5e' : item.event?.includes('TRAIL') ? '#f59e0b' : '#38bdf8'
          });
        });
      } else {
        list.push({
          id: `${trade.id}_entry`,
          tradeId: trade.id,
          symbol: trade.symbol,
          direction: trade.direction,
          strategy: trade.strategy,
          timestamp: trade.entryDateTime || `${trade.entryDate} ${trade.entryTime}`,
          rawTimestamp: trade.entryTimestamp || 0,
          action: 'ORDER_EXECUTED',
          details: trade.triggerReason || `Auto-Triggered ${trade.direction} on ${trade.symbol}`,
          pnl: trade.realizedPnL,
          badgeColor: '#38bdf8'
        });
      }
    });
    return list.sort((a, b) => b.rawTimestamp - a.rawTimestamp);
  }, [activeTrades]);


  // Alert Banner
  const [latestAlert, setLatestAlert] = useState<{
    text: string;
    type: 'BUY' | 'SELL' | 'INFO';
    timestamp: number;
  } | null>(null);

  const prevSignalIdRef = useRef<string>('');

  // 1. Audio Alert Synthesizer
  const playAlertBell = useCallback((isBuy: boolean) => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = isBuy ? 'triangle' : 'sawtooth';
      osc.frequency.setValueAtTime(isBuy ? 880 : 440, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.85);
    } catch (e) {}
  }, [soundEnabled]);

  // 2. Fetch Candle Data for Current Symbol & Timeframe (Direct 0 Latency)
  const fetchSymbolCandles = useCallback(async () => {
    try {
      setIsLoading(true);
      const base = await getBackendHttpUrl();
      const url = `${base}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${encodeURIComponent(timeframe)}&limit=300&_t=${Date.now()}`;
      const res = await fetch(url, { headers: { 'bypass-tunnel-reminder': 'true' } });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.candles) && data.candles.length > 0) {
          setCandles(data.candles);
          const latest = data.candles[data.candles.length - 1];
          setLiveLtp(latest.close);
          setLastUpdated(new Date().toLocaleTimeString('en-IN', { hour12: false }));
        }
      }
    } catch (err) {
      console.error('[Algo Trade] Failed to fetch candles:', err);
    } finally {
      setIsLoading(false);
    }
  }, [symbol, timeframe]);

  // 3. Fetch Multi-Symbol Live Scanner Results
  const fetchScannerData = useCallback(async () => {
    try {
      setIsScanning(true);
      const base = await getBackendHttpUrl();
      const res = await fetch(`${base}/api/algo-trade/scan?_t=${Date.now()}`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setScanItems(data.items.map((it: any) => ({
            ...it,
            ltp: it.ltp || it.currentPrice || 0
          })));
        }
      }
    } catch (e) {
    } finally {
      setIsScanning(false);
    }
  }, []);

  // 4. Fetch Active Orders / Trade History
  const fetchAlgoTrades = useCallback(async () => {
    try {
      const base = await getBackendHttpUrl();
      const res = await fetch(`${base}/api/algo-trade/trades?_t=${Date.now()}`, {
        headers: { 'bypass-tunnel-reminder': 'true' }
      });
      if (res.ok) {
        const data = await res.json();
        if (data) {
          if (Array.isArray(data.trades)) setActiveTrades(data.trades);
          if (data.capitalSummary) setCapitalSummary(data.capitalSummary);
        }
      }
    } catch (e) {}
  }, []);

  // Initial load & Polling
  useEffect(() => {
    fetchScannerData();
    fetchAlgoTrades();
    if (activeView === 'CHART') {
      fetchSymbolCandles();
    }

    // 2000ms poll for live tick-by-tick CMP & PnL
    const tradeInterval = setInterval(() => {
      fetchAlgoTrades();
    }, 2000);

    // 5000ms poll for multi-stock scanner & candles (only if in chart view)
    const scanInterval = setInterval(() => {
      fetchScannerData();
      if (activeView === 'CHART') {
        fetchSymbolCandles();
      }
    }, 5000);

    return () => {
      clearInterval(tradeInterval);
      clearInterval(scanInterval);
    };
  }, [activeView, fetchSymbolCandles, fetchScannerData, fetchAlgoTrades]);

  // WebSocket Live LTP subscription via tvStreamer
  useEffect(() => {
    const unsub = tvStreamer.subscribe(symbol, (tick) => {
      if (tick && tick.lp && tick.lp > 0) {
        setLiveLtp(tick.lp);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, [symbol]);

  // Real-time WebSocket listener for Algo Trade executions and live CMP / P&L updates
  useEffect(() => {
    const unsub = tvStreamer.addAlgoTradeListener((msg) => {
      if (!msg) return;
      if (msg.type === 'ALGO_TRADE_UPDATED' && msg.data) {
        const updated = msg.data;
        setActiveTrades((prev) => {
          const idx = prev.findIndex(t => t.id === updated.id);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = updated;
            return next;
          }
          return [updated, ...prev];
        });
      } else if (msg.type === 'ALGO_TRADE_EXECUTED' && msg.data) {
        const newTrade = msg.data;
        setActiveTrades((prev) => [newTrade, ...prev.filter(t => t.id !== newTrade.id)]);
      } else if (msg.type === 'ALGO_TRADE_CLEARED') {
        setActiveTrades([]);
      }
    });
    return () => {
      if (unsub) unsub();
    };
  }, []);

  // 5. Execute Full Marshall Strategy Engine on Loaded Candles
  const engineResult = useMemo(() => {
    return runMarshallStrategyEngine(candles, symbol, timeframe, config);
  }, [candles, symbol, timeframe, config]);

  const { levels, currentSignal, activeSignals, completedTrades, stateMachine, metrics } = engineResult;

  // Signal Alert Trigger
  useEffect(() => {
    if (currentSignal && currentSignal.status === 'ENTRY_GENERATED' && currentSignal.id !== prevSignalIdRef.current) {
      prevSignalIdRef.current = currentSignal.id;
      const isBuy = currentSignal.direction === 'BUY';
      const alertMsg = `${currentSignal.symbol} | ${currentSignal.timeframe}m | ${currentSignal.label} @ ₹${currentSignal.entryPrice.toFixed(1)} | SL: ₹${currentSignal.stopLossPrice.toFixed(1)} | T1: ₹${currentSignal.target1Price.toFixed(1)} | T2: ₹${currentSignal.target2Price.toFixed(1)}`;
      
      setLatestAlert({
        text: alertMsg,
        type: isBuy ? 'BUY' : 'SELL',
        timestamp: Date.now()
      });
      playAlertBell(isBuy);
    }
  }, [currentSignal, playAlertBell]);

  // Execute Paper / Algo Trade
  const handleExecuteTrade = async (sig: MarshallSignal) => {
    try {
      const base = await getBackendHttpUrl();
      const res = await fetch(`${base}/api/algo-trade/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: sig.symbol,
          strategy: sig.strategy,
          direction: sig.direction,
          entryPrice: sig.entryPrice,
          stopLossPrice: sig.stopLossPrice,
          target1Price: sig.target1Price,
          target2Price: sig.target2Price,
          reason: `${sig.strategy}: Confirmed entry at Marshall level with volume (${sig.volumeMultiplier.toFixed(2)}x) & VWAP filter`,
          levels
        })
      });
      const json = await res.json();
      if (json && json.success) {
        setTradeMessage(`✅ ${json.message}`);
        setTimeout(() => setTradeMessage(''), 5000);
        fetchAlgoTrades();
      }
    } catch (e: any) {
      setTradeMessage(`❌ Execution failed: ${e.message}`);
    }
  };

  const handleClosePosition = async (tradeId: string) => {
    try {
      const base = await getBackendHttpUrl();
      const res = await fetch(`${base}/api/algo-trade/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tradeId, reason: 'Manual Exit by Trader' })
      });
      const json = await res.json();
      if (json && json.success) {
        setTradeMessage(`✅ ${json.message}`);
        setTimeout(() => setTradeMessage(''), 5000);
        fetchAlgoTrades();
      }
    } catch (e: any) {
      setTradeMessage(`❌ Close failed: ${e.message}`);
    }
  };

  // Helper formatting
  const formatINR = (val: number) => {
    return `₹${val.toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 2 })}`;
  };

  
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      backgroundColor: '#070a0f',
      color: '#f8fafc',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, sans-serif",
      overflow: 'hidden'
    }}>
      {/* ===================================================================== */}
      {/* 1. TOP INSTRUMENT CONTROLS STRIP */}
      {/* ===================================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 16px',
        backgroundColor: '#0b0f19',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0,
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        {/* Left: Engine Branding & Symbol Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '7px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              border: '1px solid #38bdf8',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Zap size={16} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '900', letterSpacing: '-0.3px', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                MARSHALL REVERSAL & CONTINUATION ENGINE
                <span style={{ fontSize: '9px', fontWeight: '800', backgroundColor: '#3b82f6', color: '#fff', padding: '1px 5px', borderRadius: '3px' }}>
                  V1.0 ALGO
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '2px' }}>
                <span style={{ fontSize: '10px', color: '#64748b' }}>Orderflow Levels Institutional Strategy Automation</span>
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: 'rgba(16, 185, 129, 0.15)',
                  border: '1px solid rgba(16, 185, 129, 0.4)',
                  borderRadius: '12px',
                  padding: '1px 7px',
                  fontSize: '9.5px',
                  fontWeight: 700,
                  color: '#10b981'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
                  AUTONOMOUS TRIGGER ACTIVE (NSE 9:17 - 15:00 | MCX 9:00 - 23:30)
                </span>
              </div>
            </div>
          </div>

          {/* Symbol Select Dropdown */}
          <select
            value={symbol}
            onChange={(e) => setSymbol(e.target.value)}
            style={{
              backgroundColor: '#151d2f',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: '700',
              padding: '5px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            {INSTRUMENTS.map((inst) => (
              <option key={inst.symbol} value={inst.symbol}>
                {inst.name}
              </option>
            ))}
          </select>

          {/* Timeframe Select */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '3px', backgroundColor: '#151d2f', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)' }}>
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.value}
                onClick={() => setTimeframe(tf.value)}
                style={{
                  padding: '3px 8px',
                  fontSize: '10.5px',
                  fontWeight: timeframe === tf.value ? 800 : 600,
                  borderRadius: '4px',
                  cursor: 'pointer',
                  border: 'none',
                  backgroundColor: timeframe === tf.value ? '#38bdf8' : 'transparent',
                  color: timeframe === tf.value ? '#070a0f' : '#94a3b8'
                }}
              >
                {tf.value}
              </button>
            ))}
          </div>
        </div>

        {/* Center: Live LTP & Marshall Market Direction */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700' }}>LTP:</span>
            <span style={{ fontSize: '17px', fontWeight: '900', color: '#38bdf8' }}>
              {liveLtp > 0 ? formatINR(liveLtp) : '---'}
            </span>
          </div>

          {levels && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '11px',
              fontWeight: '800',
              padding: '3px 8px',
              borderRadius: '5px',
              backgroundColor: liveLtp >= levels.breakout
                ? 'rgba(16, 185, 129, 0.18)'
                : liveLtp <= levels.breakdown
                ? 'rgba(239, 68, 68, 0.18)'
                : 'rgba(245, 158, 11, 0.18)',
              color: liveLtp >= levels.breakout ? '#34d399' : liveLtp <= levels.breakdown ? '#f87171' : '#f59e0b',
              border: `1px solid ${liveLtp >= levels.breakout ? '#10b98155' : liveLtp <= levels.breakdown ? '#ef444455' : '#f59e0b55'}`
            }}>
              {liveLtp >= levels.breakout ? (
                <>
                  <ArrowUpRight size={13} /> BULLISH (Above Breakout ₹{levels.breakout})
                </>
              ) : liveLtp <= levels.breakdown ? (
                <>
                  <ArrowDownRight size={13} /> BEARISH (Below Breakdown ₹{levels.breakdown})
                </>
              ) : (
                <>
                  <Activity size={13} /> VALUE RANGE (Between S3 ₹{levels.buyReversal} & R3 ₹{levels.sellReversal})
                </>
              )}
            </div>
          )}
        </div>

        {/* Right: Sound & Config */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            style={{
              background: '#151d2f',
              border: '1px solid rgba(255,255,255,0.1)',
              color: soundEnabled ? '#38bdf8' : '#64748b',
              padding: '5px 7px',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
            title={soundEnabled ? 'Alert Sounds Active' : 'Sound Muted'}
          >
            {soundEnabled ? <Volume2 size={14} /> : <VolumeX size={14} />}
          </button>

          <button
            onClick={() => setIsConfigOpen(!isConfigOpen)}
            style={{
              backgroundColor: isConfigOpen ? '#3b82f6' : '#151d2f',
              border: '1px solid rgba(255,255,255,0.15)',
              color: '#f8fafc',
              padding: '5px 9px',
              borderRadius: '6px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '11px',
              fontWeight: 700
            }}
          >
            <Settings size={13} /> Config
          </button>
        </div>
      </div>

      {/* ===================================================================== */}
      {/* 2. PORTFOLIO KPI SCORECARDS GRID (5 CARDS MATCHING EXACT USER DESIGN) */}
      {/* ===================================================================== */}
      <div style={{
        padding: '12px 16px',
        backgroundColor: '#070a12',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)'
      }}>
        {(() => {
          const portfolioVal = capitalSummary?.netAccountValue || 1500000;
          const availCash = capitalSummary?.availableMargin || 1500000;
          const invCap = capitalSummary?.openMarginDeployed || 0;
          const realPnL = capitalSummary?.totalRealizedPnL || 0;
          const floatPnL = capitalSummary?.totalUnrealizedPnL || 0;
          const totPnL = realPnL + floatPnL;
          const totPnLPct = (totPnL / 1500000) * 100;
          const unallocPct = Math.round((availCash / Math.max(1, portfolioVal)) * 100);
          const wins = capitalSummary?.winningTrades || 0;
          const losses = capitalSummary?.losingTrades || 0;
          const winRate = capitalSummary?.winRatePct || 0;
          const pf = capitalSummary?.profitFactor || (losses > 0 ? (Math.abs(realPnL) / Math.max(1, losses * 250)).toFixed(2) : '3.25');

          return (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: '12px'
            }}>
              {/* Card 1: PORTFOLIO VALUE */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: `1px solid ${totPnL >= 0 ? 'rgba(16, 185, 129, 0.35)' : 'rgba(239, 68, 68, 0.35)'}`,
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  PORTFOLIO VALUE
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px' }}>
                  <span style={{ fontSize: '20px', fontWeight: '900', color: totPnL >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                    ₹{portfolioVal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', fontWeight: '700', color: totPnL >= 0 ? '#10b981' : '#ef4444' }}>
                  {totPnL >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                  <span>{totPnL >= 0 ? '+' : ''}₹{totPnL.toFixed(2)} ({totPnL >= 0 ? '+' : ''}{totPnLPct.toFixed(2)}%)</span>
                </div>
              </div>

              {/* Card 2: AVAILABLE CASH */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  AVAILABLE CASH
                </span>
                <span style={{ fontSize: '19px', fontWeight: '900', color: '#38bdf8', fontFamily: 'monospace' }}>
                  ₹{availCash.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Unallocated Margin ({unallocPct}%)
                </span>
              </div>

              {/* Card 3: INVESTED CAPITAL */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  INVESTED CAPITAL
                </span>
                <span style={{ fontSize: '19px', fontWeight: '900', color: '#e2e8f0', fontFamily: 'monospace' }}>
                  ₹{invCap.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  In {openTrades.length} Active Positions
                </span>
              </div>

              {/* Card 4: REALIZED P&L */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  REALIZED P&L
                </span>
                <span style={{ fontSize: '19px', fontWeight: '900', color: realPnL >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                  {realPnL >= 0 ? '+' : ''}₹{realPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  {closedTrades.length} Closed Trades ({wins}W / {losses}L)
                </span>
              </div>

              {/* Card 5: FLOATING P&L (LIVE) */}
              <div style={{
                background: 'rgba(30, 41, 59, 0.5)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '8px',
                padding: '10px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: '3px'
              }}>
                <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  FLOATING P&L (LIVE)
                </span>
                <span style={{ fontSize: '19px', fontWeight: '900', color: floatPnL >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace' }}>
                  {floatPnL >= 0 ? '+' : ''}₹{floatPnL.toFixed(2)}
                </span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>
                  Win Rate: {winRate}% | PF: {pf}
                </span>
              </div>
            </div>
          );
        })()}
      </div>

      {/* ===================================================================== */}
      {/* 3. NAVIGATION SUB-TABS (MATCHING USER SCREENSHOT EXACTLY) */}
      {/* ===================================================================== */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '4px',
        padding: '8px 16px',
        backgroundColor: '#05070e',
        borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'POSITIONS', label: `Active Positions (${openTrades.length})`, icon: Activity },
                        { id: 'AUDIT_LOG', label: 'What Did We Do (Execution Log)', icon: FileText },
            { id: 'HISTORY', label: `Closed Trade History (${closedTrades.length})`, icon: Clock },
            { id: 'REVERSAL_SCANNER', label: `Live Reversal Scanner (${scanItems.length})`, icon: Zap }
          ].map(tab => {
            const isActive = activeView === tab.id;
            const IconComponent = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveView(tab.id as any)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 14px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: isActive ? '#3b82f6' : 'transparent',
                  color: isActive ? '#ffffff' : '#94a3b8',
                  fontSize: '12px',
                  fontWeight: isActive ? 800 : 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <IconComponent size={14} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Tab: Toggle Strategy HUD & Candlestick Chart */}
        <button
          onClick={() => setActiveView(activeView === 'CHART' ? 'HISTORY' : 'CHART')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            borderRadius: '6px',
            border: activeView === 'CHART' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.12)',
            backgroundColor: activeView === 'CHART' ? 'rgba(56, 189, 248, 0.2)' : 'rgba(255, 255, 255, 0.03)',
            color: activeView === 'CHART' ? '#38bdf8' : '#cbd5e1',
            fontSize: '12px',
            fontWeight: 800,
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          <BarChart2 size={14} />
          <span>{activeView === 'CHART' ? '✕ Close Strategy Chart' : '📊 Strategy Chart & HUD'}</span>
        </button>
      </div>
      {/* ===================================================================== */}
      {/* MAIN CONTENT AREA */}
      {/* ===================================================================== */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', position: 'relative' }}>
        
        
        {/* VIEW 1: DASHBOARD & LIVE CHART */}
        {activeView === 'CHART' && (
          <div style={{ flex: 1, display: 'flex', minWidth: 0, overflow: 'hidden' }}>
            
            {/* LEFT / CENTER: INTERACTIVE STRATEGY CHART WITH PLOTTED MARSHALL LEVELS */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, borderRight: '1px solid rgba(255, 255, 255, 0.08)' }}>
              
              {/* Chart Top Info Bar */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 14px',
                backgroundColor: '#0a0d14',
                borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
                fontSize: '11px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontWeight: '800', color: '#f8fafc' }}>{symbol}</span>
                  <span style={{ color: '#64748b' }}>•</span>
                  <span style={{ color: '#38bdf8', fontWeight: '700' }}>{timeframe}m Candle Interval</span>
                  <span style={{ color: '#64748b' }}>•</span>
                  <span style={{ color: '#94a3b8' }}>Orderflow Levels – Marshall Engine</span>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  {levels && (
                    <>
                      <span style={{ color: '#089981' }}>BR: ₹{levels.buyReversal}</span>
                      <span style={{ color: '#f59e0b' }}>BO: ₹{levels.breakout}</span>
                      <span style={{ color: '#f23645' }}>SR: ₹{levels.sellReversal}</span>
                      <span style={{ color: '#f59e0b' }}>BD: ₹{levels.breakdown}</span>
                    </>
                  )}
                </div>
              </div>

              {/* Chart Visualizer (SVG Multi-Layer Engine) */}
              <div style={{ flex: 1, position: 'relative', overflow: 'hidden', backgroundColor: '#070a0f' }}>
                {candles.length === 0 ? (
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#94a3b8', fontSize: '13px', gap: '8px' }}>
                    <RefreshCw size={16} className="animate-spin" />
                    Loading real-time Marshall candles for {symbol}...
                  </div>
                ) : (
                  <svg style={{ width: '100%', height: '100%' }} viewBox="0 0 1000 500" preserveAspectRatio="none">
                    {(() => {
                      const displayBars = candles.slice(-60); // show last 60 candles
                      const n = displayBars.length;
                      if (n === 0) return null;

                      let minP = Math.min(...displayBars.map(c => c.low));
                      let maxP = Math.max(...displayBars.map(c => c.high));

                      if (levels) {
                        minP = Math.min(minP, levels.lowerTarget2 || minP);
                        maxP = Math.max(maxP, levels.upperTarget2 || maxP);
                      }

                      const span = Math.max(1, maxP - minP);
                      const priceToY = (p: number) => 460 - ((p - minP) / span) * 420;

                      const PLOT_LEFT = 20;
                      const PLOT_RIGHT = 920;
                      const USABLE_W = PLOT_RIGHT - PLOT_LEFT;
                      const getX = (idx: number) => PLOT_LEFT + (idx / Math.max(1, n - 1)) * USABLE_W;
                      const candleW = Math.max(2, Math.min(14, (USABLE_W / n) * 0.7));

                      return (
                        <>
                          {/* Grid Lines */}
                          <line x1={PLOT_LEFT} y1="460" x2={PLOT_RIGHT} y2="460" stroke="rgba(255,255,255,0.08)" />

                          {/* =================================================== */}
                          {/* 1. PLOTTED MARSHALL INDICATOR LEVELS (Section 2, 9) */}
                          {/* =================================================== */}
                          {levels && (
                            <>
                              {/* Upper Target 2 (R6) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.upperTarget2)} x2={PLOT_RIGHT} y2={priceToY(levels.upperTarget2)} stroke="#f23645" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.upperTarget2) + 3} fill="#f23645" fontSize="9" fontWeight="700">UT2 {levels.upperTarget2}</text>

                              {/* Upper Target 1 (R5) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.upperTarget1)} x2={PLOT_RIGHT} y2={priceToY(levels.upperTarget1)} stroke="#38bdf8" strokeWidth="1.2" opacity="0.8" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.upperTarget1) + 3} fill="#38bdf8" fontSize="9" fontWeight="700">UT1 {levels.upperTarget1}</text>

                              {/* Breakout (R4) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.breakout)} x2={PLOT_RIGHT} y2={priceToY(levels.breakout)} stroke="#f59e0b" strokeWidth="1.5" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.breakout) + 3} fill="#f59e0b" fontSize="9.5" fontWeight="800">BREAKOUT {levels.breakout}</text>

                              {/* Sell Reversal (R3) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.sellReversal)} x2={PLOT_RIGHT} y2={priceToY(levels.sellReversal)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.sellReversal) + 3} fill="#f87171" fontSize="9" fontWeight="700">SR (Sell Rev) {levels.sellReversal}</text>

                              {/* Buy Reversal (S3) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.buyReversal)} x2={PLOT_RIGHT} y2={priceToY(levels.buyReversal)} stroke="#94a3b8" strokeWidth="1" strokeDasharray="2,2" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.buyReversal) + 3} fill="#34d399" fontSize="9" fontWeight="700">BR (Buy Rev) {levels.buyReversal}</text>

                              {/* Breakdown (S4) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.breakdown)} x2={PLOT_RIGHT} y2={priceToY(levels.breakdown)} stroke="#f59e0b" strokeWidth="1.5" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.breakdown) + 3} fill="#f59e0b" fontSize="9.5" fontWeight="800">BREAKDOWN {levels.breakdown}</text>

                              {/* Lower Target 1 (S5) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.lowerTarget1)} x2={PLOT_RIGHT} y2={priceToY(levels.lowerTarget1)} stroke="#38bdf8" strokeWidth="1.2" opacity="0.8" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.lowerTarget1) + 3} fill="#38bdf8" fontSize="9" fontWeight="700">LT1 {levels.lowerTarget1}</text>

                              {/* Lower Target 2 (S6) */}
                              <line x1={PLOT_LEFT} y1={priceToY(levels.lowerTarget2)} x2={PLOT_RIGHT} y2={priceToY(levels.lowerTarget2)} stroke="#f23645" strokeWidth="1" strokeDasharray="3,3" opacity="0.7" />
                              <text x={PLOT_RIGHT + 6} y={priceToY(levels.lowerTarget2) + 3} fill="#f23645" fontSize="9" fontWeight="700">LT2 {levels.lowerTarget2}</text>

                              {/* VWAP Reference Line */}
                              {levels.vwap && (
                                <>
                                  <line x1={PLOT_LEFT} y1={priceToY(levels.vwap)} x2={PLOT_RIGHT} y2={priceToY(levels.vwap)} stroke="#a855f7" strokeWidth="1.2" strokeDasharray="4,3" />
                                  <text x={PLOT_RIGHT + 6} y={priceToY(levels.vwap) + 3} fill="#a855f7" fontSize="8.5" fontWeight="700">VWAP {levels.vwap}</text>
                                </>
                              )}
                            </>
                          )}

                          {/* =================================================== */}
                          {/* 2. CANDLESTICKS RENDERING */}
                          {/* =================================================== */}
                          {displayBars.map((bar, idx) => {
                            const cx = getX(idx);
                            const isUp = bar.close >= bar.open;
                            const col = isUp ? '#089981' : '#f23645';
                            const yH = priceToY(bar.high);
                            const yL = priceToY(bar.low);
                            const yO = priceToY(bar.open);
                            const yC = priceToY(bar.close);
                            const top = Math.min(yO, yC);
                            const h = Math.max(1.5, Math.abs(yC - yO));

                            return (
                              <g key={`bar-${bar.time}`}>
                                <line x1={cx} y1={yH} x2={cx} y2={yL} stroke={col} strokeWidth="1.2" opacity="0.85" />
                                <rect x={cx - candleW / 2} y={top} width={candleW} height={h} fill={col} rx="1" />
                              </g>
                            );
                          })}

                          {/* =================================================== */}
                          {/* 3. CONFIRMED STRATEGY SIGNALS & EXECUTION VISUALS */}
                          {/* =================================================== */}
                          {currentSignal && (
                            <g key={currentSignal.id}>
                              {/* Entry Level Line */}
                              <line
                                x1={PLOT_LEFT}
                                y1={priceToY(currentSignal.entryPrice)}
                                x2={PLOT_RIGHT}
                                y2={priceToY(currentSignal.entryPrice)}
                                stroke={currentSignal.direction === 'BUY' ? '#34d399' : '#f87171'}
                                strokeWidth="2"
                                strokeDasharray="4,4"
                              />
                              <rect x={PLOT_LEFT + 10} y={priceToY(currentSignal.entryPrice) - 10} width="160" height="20" fill="#0b0f19" stroke={currentSignal.direction === 'BUY' ? '#34d399' : '#f87171'} rx="4" />
                              <text x={PLOT_LEFT + 16} y={priceToY(currentSignal.entryPrice) + 4} fill="#ffffff" fontSize="10" fontWeight="800">
                                {currentSignal.label} @ ₹{currentSignal.entryPrice.toFixed(1)}
                              </text>

                              {/* Stop Loss Line */}
                              <line
                                x1={PLOT_LEFT}
                                y1={priceToY(currentSignal.stopLossPrice)}
                                x2={PLOT_RIGHT}
                                y2={priceToY(currentSignal.stopLossPrice)}
                                stroke="#ef4444"
                                strokeWidth="1.8"
                              />
                              <text x={PLOT_LEFT + 180} y={priceToY(currentSignal.stopLossPrice) - 4} fill="#ef4444" fontSize="9.5" fontWeight="800">
                                SL: ₹{currentSignal.stopLossPrice.toFixed(1)} ({currentSignal.riskPoints.toFixed(1)} pts)
                              </text>

                              {/* Target 1 Line */}
                              <line
                                x1={PLOT_LEFT}
                                y1={priceToY(currentSignal.target1Price)}
                                x2={PLOT_RIGHT}
                                y2={priceToY(currentSignal.target1Price)}
                                stroke="#10b981"
                                strokeWidth="1.8"
                              />
                              <text x={PLOT_LEFT + 180} y={priceToY(currentSignal.target1Price) - 4} fill="#10b981" fontSize="9.5" fontWeight="800">
                                Target 1: ₹{currentSignal.target1Price.toFixed(1)} (1:{currentSignal.riskRewardRatio} R:R)
                              </text>

                              {/* Target 2 Line */}
                              <line
                                x1={PLOT_LEFT}
                                y1={priceToY(currentSignal.target2Price)}
                                x2={PLOT_RIGHT}
                                y2={priceToY(currentSignal.target2Price)}
                                stroke="#38bdf8"
                                strokeWidth="1.8"
                              />
                              <text x={PLOT_LEFT + 180} y={priceToY(currentSignal.target2Price) - 4} fill="#38bdf8" fontSize="9.5" fontWeight="800">
                                Target 2: ₹{currentSignal.target2Price.toFixed(1)}
                              </text>
                            </g>
                          )}
                        </>
                      );
                    })()}
                  </svg>
                )}
              </div>
            </div>

            {/* RIGHT SIDEBAR: ANTIGRAVITY COMPACT LIVE DASHBOARD (Specification Section 10) */}
            <div style={{
              width: '360px',
              minWidth: '360px',
              maxWidth: '380px',
              backgroundColor: '#0c101a',
              display: 'flex',
              flexDirection: 'column',
              flexShrink: 0,
              overflowY: 'auto',
              borderLeft: '1px solid rgba(255, 255, 255, 0.08)',
              padding: '14px',
              gap: '14px'
            }}>
              {/* Header Badge */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '12px', fontWeight: '900', color: '#f8fafc', letterSpacing: '0.3px' }}>
                  🎯 MARSHALL STRATEGY HUD
                </span>
                <span style={{
                  fontSize: '9.5px',
                  fontWeight: '800',
                  padding: '2px 7px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(56, 189, 248, 0.15)',
                  color: '#38bdf8',
                  border: '1px solid rgba(56, 189, 248, 0.3)'
                }}>
                  {stateMachine.primaryBuyState !== 'IDLE' ? stateMachine.primaryBuyState : 'SCANNING'}
                </span>
              </div>

              {/* 1. Active Trading Signal Card */}
              {currentSignal ? (
                <div style={{
                  backgroundColor: '#151d2f',
                  borderRadius: '8px',
                  border: `1px solid ${currentSignal.direction === 'BUY' ? '#10b981' : '#ef4444'}`,
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '900',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: currentSignal.direction === 'BUY' ? '#10b981' : '#ef4444',
                      color: '#ffffff'
                    }}>
                      {currentSignal.label}
                    </span>
                    <span style={{ fontSize: '10px', color: '#94a3b8' }}>{currentSignal.timeStr}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px', fontSize: '11px', marginTop: '4px' }}>
                    <div>Entry: <strong style={{ color: '#f8fafc' }}>₹{currentSignal.entryPrice.toFixed(1)}</strong></div>
                    <div>Stop Loss: <strong style={{ color: '#ef4444' }}>₹{currentSignal.stopLossPrice.toFixed(1)}</strong></div>
                    <div>Target 1: <strong style={{ color: '#10b981' }}>₹{currentSignal.target1Price.toFixed(1)}</strong></div>
                    <div>Target 2: <strong style={{ color: '#38bdf8' }}>₹{currentSignal.target2Price.toFixed(1)}</strong></div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10.5px', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '6px' }}>
                    <span>Risk: <strong>{currentSignal.riskPoints.toFixed(1)} pts</strong></span>
                    <span>Reward (T1): <strong>{currentSignal.rewardPointsT1.toFixed(1)} pts</strong></span>
                    <span style={{ color: '#a855f7' }}>R:R: <strong>1:{currentSignal.riskRewardRatio}</strong></span>
                  </div>

                  {/* 1-Click Paper Trade Execution */}
                  <button
                    onClick={() => handleExecuteTrade(currentSignal)}
                    style={{
                      marginTop: '6px',
                      backgroundColor: currentSignal.direction === 'BUY' ? '#10b981' : '#ef4444',
                      border: 'none',
                      color: '#ffffff',
                      borderRadius: '5px',
                      padding: '7px',
                      fontSize: '11.5px',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '5px'
                    }}
                  >
                    <Play size={13} /> Execute Algo Paper Trade (50 Qty)
                  </button>
                </div>
              ) : (
                <div style={{
                  padding: '16px',
                  backgroundColor: '#151d2f',
                  borderRadius: '8px',
                  border: '1px dashed rgba(255,255,255,0.1)',
                  textAlign: 'center',
                  fontSize: '11px',
                  color: '#94a3b8'
                }}>
                  No active trade signal on {symbol} {timeframe}m.<br />
                  Waiting for Marshall Reversal Support or Breakout confirmation.
                </div>
              )}

              {/* 2. Plotted Indicator Levels HUD (Section 2, 10) */}
              <div style={{ backgroundColor: '#151d2f', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.3px' }}>
                  📐 PLOTTED MARSHALL LEVELS
                </div>
                {levels ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', fontSize: '11px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f23645' }}>
                      <span>Upper Target 2 (R6)</span>
                      <strong>₹{levels.upperTarget2.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                      <span>Upper Target 1 (R5)</span>
                      <strong>₹{levels.upperTarget1.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b', fontWeight: '800' }}>
                      <span>Breakout (R4)</span>
                      <strong>₹{levels.breakout.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Sell Reversal (R3)</span>
                      <strong>₹{levels.sellReversal.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#a855f7' }}>
                      <span>Session VWAP</span>
                      <strong>₹{levels.vwap?.toFixed(1) || '---'}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Buy Reversal (S3)</span>
                      <strong>₹{levels.buyReversal.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f59e0b', fontWeight: '800' }}>
                      <span>Break Down (S4)</span>
                      <strong>₹{levels.breakdown.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#38bdf8' }}>
                      <span>Lower Target 1 (S5)</span>
                      <strong>₹{levels.lowerTarget1.toFixed(1)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f23645' }}>
                      <span>Lower Target 2 (S6)</span>
                      <strong>₹{levels.lowerTarget2.toFixed(1)}</strong>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '11px' }}>Calculating levels...</div>
                )}
              </div>

              {/* 3. Signal Confirmation Checklist (Section 7) */}
              <div style={{ backgroundColor: '#151d2f', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8', marginBottom: '8px', letterSpacing: '0.3px' }}>
                  ⚖️ 4-STAGE CONFIRMATION ENGINE
                </div>
                {currentSignal?.confirmation ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '10.5px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>1. Price Close Beyond Trigger</span>
                      <span style={{ color: currentSignal.confirmation.priceConfirmed ? '#34d399' : '#f87171', fontWeight: '800' }}>
                        {currentSignal.confirmation.priceConfirmed ? '✅ Confirmed' : '❌ Pending'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>2. Volume Confirmation ({config.volumeMultiplier}x)</span>
                      <span style={{ color: currentSignal.confirmation.volumeConfirmed ? '#34d399' : '#f87171', fontWeight: '800' }}>
                        {currentSignal.confirmation.volumeConfirmed ? '✅ PASS' : '❌ Low Vol'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>3. VWAP Direction Alignment</span>
                      <span style={{ color: currentSignal.confirmation.vwapConfirmed ? '#34d399' : '#f87171', fontWeight: '800' }}>
                        {currentSignal.confirmation.vwapConfirmed ? '✅ Aligned' : '❌ Counter-VWAP'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <span>4. Rejection Candle Strength</span>
                      <span style={{ color: currentSignal.confirmation.candleConfirmed ? '#34d399' : '#f87171', fontWeight: '800' }}>
                        {currentSignal.confirmation.candleConfirmed ? '✅ Valid' : '❌ Weak Body'}
                      </span>
                    </div>
                  </div>
                ) : (
                  <div style={{ color: '#64748b', fontSize: '10.5px' }}>
                    Active filters: Candle Close, {config.volumeMultiplier}x Volume, VWAP Direction, Solid Rejection Body.
                  </div>
                )}
              </div>

              {/* 4. Strategy Performance Quick Glance */}
              <div style={{ backgroundColor: '#151d2f', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '10.5px', fontWeight: '800', color: '#94a3b8' }}>SESSION PERFORMANCE</span>
                  <button onClick={() => setActiveView('BACKTEST')} style={{ background: 'none', border: 'none', color: '#38bdf8', fontSize: '10px', cursor: 'pointer', fontWeight: '700' }}>
                    View Full Report ▶
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '11px' }}>
                  <div style={{ backgroundColor: '#0c101a', padding: '8px', borderRadius: '5px' }}>
                    <div style={{ color: '#64748b', fontSize: '9.5px' }}>Win Rate</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: metrics.winRatePct >= 50 ? '#34d399' : '#f87171' }}>
                      {metrics.winRatePct}%
                    </div>
                  </div>
                  <div style={{ backgroundColor: '#0c101a', padding: '8px', borderRadius: '5px' }}>
                    <div style={{ color: '#64748b', fontSize: '9.5px' }}>Profit Factor</div>
                    <div style={{ fontSize: '14px', fontWeight: '800', color: metrics.profitFactor >= 1.5 ? '#34d399' : '#f59e0b' }}>
                      {metrics.profitFactor}
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VIEW 2: MULTI-STOCK LIVE SCANNER TABLE (Section 10) */}
        {activeView === 'REVERSAL_SCANNER' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div>
                <h3 style={{ fontSize: '15px', fontWeight: '900', margin: 0 }}>
                  🎯 MARSHALL LIVE SCANNER – TOP NSE INSTRUMENTS
                </h3>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                  Real-time detection of Breakout, Breakdown, Support at BR & Retest setups
                </p>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ display: 'flex', gap: '4px', backgroundColor: '#151d2f', padding: '2px', borderRadius: '5px' }}>
                  {(['ALL', 'BUY', 'SELL', 'ACTIVE'] as const).map(f => (
                    <button
                      key={f}
                      onClick={() => setScannerFilter(f)}
                      style={{
                        padding: '4px 8px',
                        fontSize: '10.5px',
                        fontWeight: scannerFilter === f ? 800 : 600,
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        backgroundColor: scannerFilter === f ? '#38bdf8' : 'transparent',
                        color: scannerFilter === f ? '#070a0f' : '#94a3b8'
                      }}
                    >
                      {f}
                    </button>
                  ))}
                </div>

                <button
                  onClick={fetchScannerData}
                  style={{
                    backgroundColor: '#151d2f',
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: '#f8fafc',
                    padding: '5px 10px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  <RefreshCw size={12} className={isScanning ? 'animate-spin' : ''} /> Rescan
                </button>
              </div>
            </div>

            {/* Table */}
            <div style={{ backgroundColor: '#0c101a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11.5px' }}>
                <thead>
                  <tr style={{ backgroundColor: '#151d2f', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ padding: '10px 12px' }}>Symbol</th>
                    <th style={{ padding: '10px 12px' }}>LTP</th>
                    <th style={{ padding: '10px 12px' }}>Active Strategy</th>
                    <th style={{ padding: '10px 12px' }}>ATM Option Strike</th>
                    <th style={{ padding: '10px 12px' }}>Setup State</th>
                    <th style={{ padding: '10px 12px' }}>Trigger / Entry</th>
                    <th style={{ padding: '10px 12px' }}>Stop Loss</th>
                    <th style={{ padding: '10px 12px' }}>Target 1</th>
                    <th style={{ padding: '10px 12px' }}>Target 2</th>
                    <th style={{ padding: '10px 12px' }}>R:R</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const filtered = scanItems.filter(item => {
                      if (scannerFilter === 'BUY') return item.direction === 'BUY';
                      if (scannerFilter === 'SELL') return item.direction === 'SELL';
                      if (scannerFilter === 'ACTIVE') return item.strategy !== 'NONE' && item.strategy !== 'WATCHING';
                      return true;
                    });
                    if (filtered.length === 0) {
                      return (
                        <tr>
                          <td colSpan={11} style={{ textAlign: 'center', padding: '36px', color: '#94a3b8', fontSize: '12px' }}>
                            Scanning active instruments for live reversal triggers...
                          </td>
                        </tr>
                      );
                    }
                    return filtered.map((item, idx) => {
                      const isBuy = item.direction === 'BUY';
                      const isSell = item.direction === 'SELL';
                      return (
                        <tr key={`${item.symbol}-${idx}`} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', backgroundColor: idx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                          <td style={{ padding: '10px 12px', fontWeight: '800', color: '#f8fafc' }}>
                            {item.name || item.symbol}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: '800', color: '#38bdf8' }}>
                            ₹{item.ltp?.toFixed(1) || '---'}
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              backgroundColor: isBuy ? 'rgba(16, 185, 129, 0.2)' : isSell ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.05)',
                              color: isBuy ? '#34d399' : isSell ? '#f87171' : '#94a3b8'
                            }}>
                              {item.strategy}
                            </span>
                          </td>
                          <td style={{ padding: '10px 12px' }}>
                            {item.symbol.startsWith('NSE:') ? (
                              <span style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                fontSize: '10px',
                                fontWeight: '800',
                                backgroundColor: 'rgba(168, 85, 247, 0.15)',
                                color: '#d8b4fe',
                                border: '1px solid rgba(168, 85, 247, 0.3)'
                              }}>
                                🎯 {(() => {
                                  const clean = item.symbol.replace(/^(NSE:|BSE:)/, '');
                                  const p = item.ltp || 1000;
                                  let step = 50;
                                  if (p < 250) step = 2.5;
                                  else if (p < 500) step = 5;
                                  else if (p < 1000) step = 10;
                                  else if (p < 2500) step = 20;
                                  else if (p < 5000) step = 50;
                                  else step = 100;
                                  const strike = Math.round(p / step) * step;
                                  const optType = item.direction === 'SELL' ? 'PE' : 'CE';
                                  return `${clean} ${strike} ${optType}`;
                                })()}
                              </span>
                            ) : (
                              <span style={{ color: '#64748b', fontSize: '10px' }}>FUT</span>
                            )}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#cbd5e1' }}>
                            {item.state}
                          </td>
                          <td style={{ padding: '10px 12px', fontWeight: '700' }}>
                            ₹{item.entryPrice?.toFixed(1) || '---'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#ef4444' }}>
                            ₹{item.stopLossPrice?.toFixed(1) || '---'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#10b981' }}>
                            ₹{item.target1Price?.toFixed(1) || '---'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#38bdf8' }}>
                            ₹{item.target2Price?.toFixed(1) || '---'}
                          </td>
                          <td style={{ padding: '10px 12px', color: '#a855f7', fontWeight: '700' }}>
                            1:{item.riskRewardRatio || 1.5}
                          </td>
                          <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                            <button
                              onClick={() => {
                                if (onSwitchToChart) {
                                  onSwitchToChart(item.symbol);
                                } else {
                                  setSymbol(item.symbol);
                                  setActiveView('CHART');
                                }
                              }}
                              style={{
                                backgroundColor: '#3b82f6',
                                border: 'none',
                                color: '#ffffff',
                                borderRadius: '4px',
                                padding: '3px 8px',
                                fontSize: '10.5px',
                                fontWeight: '700',
                                cursor: 'pointer'
                              }}
                              title={`Open Chart for ${item.symbol}`}
                            >
                              Load Chart
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* VIEW 3: HISTORICAL BACKTESTING & PERFORMANCE (Section 13) */}
        {activeView === 'BACKTEST' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto', gap: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 style={{ fontSize: '16px', fontWeight: '900', margin: 0 }}>
                  📈 MARSHALL STRATEGY HISTORICAL BACKTEST REPORT
                </h3>
                <p style={{ fontSize: '11px', color: '#94a3b8', margin: '2px 0 0 0' }}>
                  Rigorous bar-by-bar execution simulation for {symbol} ({candles.length} bars)
                </p>
              </div>

              <button
                onClick={fetchSymbolCandles}
                style={{
                  backgroundColor: '#3b82f6',
                  border: 'none',
                  color: '#ffffff',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                Re-Run Simulation
              </button>
            </div>

            {/* Performance Metric Cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px' }}>
              <div style={{ backgroundColor: '#0c101a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#64748b', fontSize: '10px', fontWeight: '700' }}>TOTAL TRADES</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#f8fafc', marginTop: '4px' }}>
                  {metrics.totalTrades}
                </div>
              </div>
              <div style={{ backgroundColor: '#0c101a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#64748b', fontSize: '10px', fontWeight: '700' }}>WIN RATE</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: metrics.winRatePct >= 50 ? '#34d399' : '#f87171', marginTop: '4px' }}>
                  {metrics.winRatePct}%
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8' }}>{metrics.winningTrades}W / {metrics.losingTrades}L</div>
              </div>
              <div style={{ backgroundColor: '#0c101a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#64748b', fontSize: '10px', fontWeight: '700' }}>NET PROFIT POINTS</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: metrics.totalProfitPts >= 0 ? '#34d399' : '#f87171', marginTop: '4px' }}>
                  {metrics.totalProfitPts >= 0 ? '+' : ''}{metrics.totalProfitPts} pts
                </div>
              </div>
              <div style={{ backgroundColor: '#0c101a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#64748b', fontSize: '10px', fontWeight: '700' }}>PROFIT FACTOR</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: metrics.profitFactor >= 1.5 ? '#34d399' : '#f59e0b', marginTop: '4px' }}>
                  {metrics.profitFactor}
                </div>
              </div>
              <div style={{ backgroundColor: '#0c101a', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ color: '#64748b', fontSize: '10px', fontWeight: '700' }}>MAX DRAWDOWN</div>
                <div style={{ fontSize: '20px', fontWeight: '900', color: '#f87171', marginTop: '4px' }}>
                  -{metrics.maxDrawdownPts} pts
                </div>
              </div>
            </div>

            {/* Trades History Log */}
            <div style={{ backgroundColor: '#0c101a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden' }}>
              <div style={{ padding: '10px 14px', backgroundColor: '#151d2f', fontSize: '12px', fontWeight: '800' }}>
                COMPLETED BACKTEST TRADES ({completedTrades.length})
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '11px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'rgba(255,255,255,0.02)', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    <th style={{ padding: '8px 12px' }}>Time</th>
                    <th style={{ padding: '8px 12px' }}>Strategy</th>
                    <th style={{ padding: '8px 12px' }}>Dir</th>
                    <th style={{ padding: '8px 12px' }}>Entry</th>
                    <th style={{ padding: '8px 12px' }}>Exit</th>
                    <th style={{ padding: '8px 12px' }}>Status</th>
                    <th style={{ padding: '8px 12px' }}>P&L (Pts)</th>
                    <th style={{ padding: '8px 12px' }}>P&L (%)</th>
                  </tr>
                </thead>
                <tbody>
                  {completedTrades.map((t) => {
                    const isWin = (t.pnlPoints || 0) > 0;
                    return (
                      <tr key={t.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.03)' }}>
                        <td style={{ padding: '8px 12px' }}>{t.timeStr}</td>
                        <td style={{ padding: '8px 12px', fontWeight: '700' }}>{t.label}</td>
                        <td style={{ padding: '8px 12px', color: t.direction === 'BUY' ? '#34d399' : '#f87171', fontWeight: '800' }}>
                          {t.direction}
                        </td>
                        <td style={{ padding: '8px 12px' }}>₹{t.entryPrice.toFixed(1)}</td>
                        <td style={{ padding: '8px 12px' }}>₹{t.exitPrice?.toFixed(1) || '---'}</td>
                        <td style={{ padding: '8px 12px' }}>
                          <span style={{
                            padding: '2px 5px',
                            borderRadius: '3px',
                            fontSize: '9.5px',
                            fontWeight: '800',
                            backgroundColor: isWin ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: isWin ? '#34d399' : '#f87171'
                          }}>
                            {t.status}
                          </span>
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: '800', color: isWin ? '#34d399' : '#f87171' }}>
                          {isWin ? '+' : ''}{t.pnlPoints?.toFixed(1)} pts
                        </td>
                        <td style={{ padding: '8px 12px', fontWeight: '700', color: isWin ? '#34d399' : '#f87171' }}>
                          {isWin ? '+' : ''}{t.pnlPct?.toFixed(2)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* PANEL 1: ACTIVE POSITIONS */}
        {activeView === 'POSITIONS' && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: '16px', overflowY: 'auto', gap: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div>
                <span style={{ fontSize: '15px', fontWeight: '800', color: '#f8fafc' }}>
                  Open Positions (Mark-to-Market Live P&L)
                </span>
                <span style={{ display: 'block', fontSize: '11px', color: '#94a3b8' }}>
                  Autonomous Marshall Strategy Engine Active (MIS Intraday). Stop Loss automatically trailed to Breakeven on Target 1.
                </span>
              </div>

              {openTrades.length > 0 && (
                <button
                  onClick={async () => {
                    const base = await getBackendHttpUrl();
                    for (const pos of openTrades) {
                      await fetch(`${base}/api/algo-trade/trades/close`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ tradeId: pos.id, exitReason: 'MANUAL_SQUARE_OFF_ALL' })
                      });
                    }
                    fetchAlgoTrades();
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    background: '#f43f5e',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(244, 63, 94, 0.3)'
                  }}
                  title="Square off all leftover open intraday positions immediately"
                >
                  <AlertTriangle size={13} />
                  <span>Square Off All Open ({openTrades.length})</span>
                </button>
              )}
            </div>

            {openTrades.length === 0 ? (
              <div style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '60px 20px',
                background: 'rgba(15, 23, 42, 0.4)',
                borderRadius: '8px',
                border: '1px dashed rgba(255, 255, 255, 0.15)',
                color: '#94a3b8',
                gap: '8px'
              }}>
                <Activity size={32} style={{ color: '#38bdf8', opacity: 0.7 }} />
                <span style={{ fontSize: '15px', fontWeight: '700' }}>No Open Positions</span>
                <span style={{ fontSize: '12px', maxWidth: '440px', textAlign: 'center', color: '#64748b' }}>
                  The autonomous Marshall Strategy Engine is scanning 24 instruments for Buy Reversal, Sell Reversal, Breakout, and Continuation touches.
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {openTrades.map(pos => {
                  const currentLtp = (pos.currentLtp !== undefined && pos.currentLtp !== null && pos.currentLtp > 0) ? pos.currentLtp : (pos.currentPrice || pos.entryPrice);
                  const pnlPoints = pos.direction === 'BUY' ? (currentLtp - pos.entryPrice) : (pos.entryPrice - currentLtp);
                  const dynamicPnL = Math.round(pnlPoints * (pos.quantity || 1) * 100) / 100;
                  const capitalAllocated = pos.capitalAllocated || (pos.entryPrice * (pos.quantity || 1)) || 1;
                  const dynamicRoi = Math.round((dynamicPnL / capitalAllocated) * 10000) / 100;
                  const displayPnL = (pos.unrealizedPnL !== undefined && pos.unrealizedPnL !== 0) ? pos.unrealizedPnL : dynamicPnL;
                  const displayRoi = (pos.roiPct !== undefined && pos.roiPct !== 0) ? pos.roiPct : dynamicRoi;
                  const isProfit = displayPnL >= 0;
                  return (
                    <div
                      key={pos.id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.7)',
                        border: '1px solid rgba(255, 255, 255, 0.08)',
                        borderRadius: '8px',
                        padding: '14px 16px',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{
                            background: pos.direction === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                            color: pos.direction === 'BUY' ? '#10b981' : '#f87171',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontWeight: '900',
                            fontSize: '11px'
                          }}>
                            {pos.direction}
                          </span>
                          {pos.segment === 'STOCK_OPTION' ? (
                            <span style={{
                              background: 'rgba(168, 85, 247, 0.2)',
                              border: '1px solid #a855f7',
                              color: '#d8b4fe',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: '800',
                              fontSize: '10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>🎯 STOCK OPTION</span>
                              {pos.lotSize ? <span style={{ opacity: 0.85 }}>• {Math.max(1, Math.round(pos.quantity / (pos.lotSize || 1)))} Lots ({pos.lotSize}/lot)</span> : null}
                            </span>
                          ) : pos.segment === 'INDEX_OPTION' ? (
                            <span style={{
                              background: 'rgba(99, 102, 241, 0.2)',
                              border: '1px solid #6366f1',
                              color: '#a5b4fc',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontWeight: '800',
                              fontSize: '10px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}>
                              <span>⚡ INDEX OPTION</span>
                              {pos.lotSize ? <span style={{ opacity: 0.85 }}>• {Math.max(1, Math.round(pos.quantity / (pos.lotSize || 1)))} Lots ({pos.lotSize}/lot)</span> : null}
                            </span>
                          ) : (
                            <span style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              padding: '3px 7px',
                              borderRadius: '4px',
                              fontWeight: '800',
                              fontSize: '10px'
                            }}>
                              INTRADAY MIS
                            </span>
                          )}
                          <span
                            onClick={() => {
                              const chartSym = pos.symbol;
                              if (onSwitchToChart) onSwitchToChart(chartSym);
                            }}
                            style={{ fontSize: '16px', fontWeight: '900', color: '#ffffff', cursor: onSwitchToChart ? 'pointer' : 'default', textDecoration: onSwitchToChart ? 'underline dotted rgba(56, 189, 248, 0.5)' : 'none' }}
                            title={`Click to open Option Candlestick Chart for ${pos.symbol}`}
                          >
                            {pos.symbol}
                          </span>
                          {pos.spotAtEntry ? (
                            <span style={{
                              fontSize: '10px',
                              color: '#cbd5e1',
                              backgroundColor: 'rgba(255,255,255,0.06)',
                              padding: '2px 6px',
                              borderRadius: '4px'
                            }}>
                              Spot: ₹{pos.spotAtEntry.toFixed(1)}
                            </span>
                          ) : null}
                          <span style={{
                            background: 'rgba(56, 189, 248, 0.1)',
                            color: '#38bdf8',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700'
                          }}>
                            {pos.strategy}
                          </span>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            background: 'rgba(30, 41, 59, 0.8)',
                            border: '1px solid rgba(56, 189, 248, 0.3)',
                            color: '#38bdf8',
                            padding: '2px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700',
                            fontFamily: 'monospace'
                          }} title="Date and time when entry triggered">
                            <Clock size={11} style={{ color: '#38bdf8' }} />
                            <span>Triggered: {pos.entryDateTime || `${pos.entryDate || ''} ${pos.entryTime || ''}` || 'IST'}</span>
                          </span>
                        </div>

                        {/* Live P&L Badge */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{
                              fontSize: '18px',
                              fontWeight: '900',
                              color: isProfit ? '#10b981' : '#ef4444',
                              fontFamily: 'monospace'
                            }}>
                              {isProfit ? '+' : ''}₹{displayPnL.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                            <span style={{
                              display: 'block',
                              fontSize: '11px',
                              fontWeight: '700',
                              color: isProfit ? '#10b981' : '#ef4444'
                            }}>
                              ({isProfit ? '+' : ''}{displayRoi.toFixed(2)}%)
                            </span>
                          </div>

                          <button
                            onClick={() => handleClosePosition(pos.id)}
                            style={{
                              background: '#f43f5e',
                              color: '#ffffff',
                              border: 'none',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer'
                            }}
                            title="Square off position at CMP"
                          >
                            Square Off
                          </button>

                          <button
                            onClick={() => {
                              const chartSym = pos.symbol;
                              if (onSwitchToChart) {
                                onSwitchToChart(chartSym);
                              } else {
                                setSymbol(chartSym);
                                setActiveView('CHART');
                              }
                            }}
                            style={{
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              border: '1px solid rgba(56, 189, 248, 0.3)',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              fontWeight: '800',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease'
                            }}
                            title={`Open Option Candlestick Chart for ${pos.symbol}`}
                          >
                            <BarChart2 size={13} />
                            <span>Option Chart</span>
                          </button>
                        </div>
                      </div>

                      {/* Trade Metrics Line */}
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                        gap: '8px',
                        background: 'rgba(0, 0, 0, 0.25)',
                        padding: '8px 12px',
                        borderRadius: '6px',
                        fontSize: '11px'
                      }}>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Entry Price: </span>
                          <strong style={{ fontFamily: 'monospace' }}>₹{pos.entryPrice?.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Current CMP: </span>
                          <strong style={{ fontFamily: 'monospace', color: '#00f0ff', display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10b981', display: 'inline-block', boxShadow: '0 0 6px #10b981' }}></span>
                            ₹{(pos.currentLtp || pos.entryPrice)?.toFixed(2)}
                          </strong>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Quantity: </span>
                          <strong>{pos.quantity} units</strong>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Capital Deployed: </span>
                          <strong>₹{(pos.capitalAllocated || pos.entryPrice * pos.quantity).toLocaleString('en-IN')}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Trailing SL: </span>
                          <strong style={{ color: '#f87171', fontFamily: 'monospace' }}>₹{pos.stopLossPrice?.toFixed(2)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Target 1 / 2: </span>
                          <strong style={{ color: '#10b981', fontFamily: 'monospace' }}>₹{pos.target1Price?.toFixed(1)} / ₹{pos.target2Price?.toFixed(1)}</strong>
                        </div>
                        <div>
                          <span style={{ color: '#94a3b8' }}>Entry Triggered: </span>
                          <strong style={{ color: '#38bdf8', fontFamily: 'monospace' }}>
                            {pos.entryDateTime || `${pos.entryDate || ''} ${pos.entryTime || ''}`}
                          </strong>
                        </div>
                      </div>

                      {/* Execution Reasoning Narrative */}
                      <div style={{ fontSize: '11px', color: '#94a3b8', fontStyle: 'italic', borderLeft: '3px solid #38bdf8', paddingLeft: '8px' }}>
                        {pos.triggerReason || 'Marshall Orderflow Level Retest / Breakout Confirmation'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ===================================================================== */}
      {/* 5. CONFIGURATION DRAWER / MODAL (Specification Section 7, 11) */}
      {/* ===================================================================== */}
      {isConfigOpen && (
        <div style={{
          position: 'absolute',
          top: '46px',
          right: '16px',
          width: '320px',
          backgroundColor: '#0f172a',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '8px',
          padding: '16px',
          boxShadow: '0 8px 30px rgba(0,0,0,0.6)',
          zIndex: 50,
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
            <span style={{ fontSize: '13px', fontWeight: '900', color: '#f8fafc' }}>⚙️ Strategy Parameters</span>
            <button onClick={() => setIsConfigOpen(false)} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '13px' }}>✕</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '11px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enablePrimaryBuy}
                onChange={(e) => setConfig({ ...config, enablePrimaryBuy: e.target.checked })}
              />
              Enable Strategy 1: Primary Buy
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enablePrimarySell}
                onChange={(e) => setConfig({ ...config, enablePrimarySell: e.target.checked })}
              />
              Enable Strategy 2: Primary Sell
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enableContinuationBuy}
                onChange={(e) => setConfig({ ...config, enableContinuationBuy: e.target.checked })}
              />
              Enable Strategy 3: Continuation Buy (UT1 Retest)
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.enableContinuationSell}
                onChange={(e) => setConfig({ ...config, enableContinuationSell: e.target.checked })}
              />
              Enable Strategy 4: Continuation Sell (LT1 Retest)
            </label>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: '8px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginBottom: '6px' }}>
                <input
                  type="checkbox"
                  checked={config.volumeFilterEnabled}
                  onChange={(e) => setConfig({ ...config, volumeFilterEnabled: e.target.checked })}
                />
                Volume Multiplier Confirmation
              </label>
              {config.volumeFilterEnabled && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '22px' }}>
                  <span>Multiplier:</span>
                  <input
                    type="number"
                    step="0.05"
                    min="1.0"
                    max="3.0"
                    value={config.volumeMultiplier}
                    onChange={(e) => setConfig({ ...config, volumeMultiplier: parseFloat(e.target.value) || 1.2 })}
                    style={{ width: '60px', backgroundColor: '#1e293b', border: '1px solid #475569', color: '#fff', borderRadius: '4px', padding: '2px 5px', fontSize: '11px' }}
                  />
                  <span>x 20-SMA</span>
                </div>
              )}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.vwapFilterEnabled}
                onChange={(e) => setConfig({ ...config, vwapFilterEnabled: e.target.checked })}
              />
              VWAP Direction Filter
            </label>

            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={config.trailingStopEnabled}
                onChange={(e) => setConfig({ ...config, trailingStopEnabled: e.target.checked })}
              />
              Trail SL to Breakeven after Target 1
            </label>
          </div>

          <button
            onClick={() => {
              setConfig(DEFAULT_MARSHALL_CONFIG);
              setIsConfigOpen(false);
            }}
            style={{
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#38bdf8',
              borderRadius: '5px',
              padding: '6px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Reset to Default Specification
          </button>
        </div>
      )}

    </div>
  );
};

export const AlgoTradeDashboard = AlgoTradeContainer;
