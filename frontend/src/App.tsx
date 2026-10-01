import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from './context/ThemeContext';
import { DashboardHeader } from './components/DashboardHeader';
import { TopMarketTickerBar } from './components/TopMarketTickerBar';
import { ChartContainer } from './components/ChartContainer';
import { tvStreamer, getBackendHttpUrl } from './utils/tvStreamer';
import type { Candle } from './utils/profileCalculator';
import { calculateMatrixSeriesData } from './utils/matrixCalculator';
import { AlertCircle, Loader2, Layers, Zap, X, Volume2 } from 'lucide-react';
import { TabErrorBoundary } from './components/TabErrorBoundary';
import { useLevelAlerts, playCallingBellSound } from './utils/useLevelAlerts';
import { RealtimeLevelAlertPopup } from './components/RealtimeLevelAlertPopup';
import { TopCallingBellAlertBar } from './components/TopCallingBellAlertBar';
import { ScannerContainer } from './components/ScannerContainer';
import { OptionsChain } from './components/OptionsChain';
import { SignalsContainer } from './components/SignalsContainer';
import { DojiContainer } from './components/DojiContainer';
import { VolumeContainer } from './components/VolumeContainer';
import { OpeningBiasContainer } from './components/OpeningBiasContainer';
import { EarlyPicksContainer } from './components/EarlyPicksContainer';
import { DadaThoughtsContainer } from './components/DadaThoughtsContainer';
import { HourlyUpdatesContainer } from './components/HourlyUpdatesContainer';
import { BacktestResultsContainer } from './components/BacktestResultsContainer';
import { FifteenMinForensicContainer } from './components/FifteenMinForensicContainer';
import { Nr7BreakoutContainer } from './components/Nr7BreakoutContainer';
import { OrderFlowContainer } from './components/OrderFlowContainer';
import { OrderFlowFootprintContainer } from './components/OrderFlowFootprintContainer';
import { CvdAdvContainer } from './components/CvdAdvContainer';
import { HeatMapContainer } from './components/HeatMapContainer';
import { MarketProfileContainer } from './components/MarketProfileContainer';
import { ProMarketProfileContainer } from './components/ProMarketProfileContainer';
import { FootprintChartContainer } from './components/FootprintChartContainer';
import { VsaContainer } from './components/VsaContainer';
import { HighBetaTradesContainer } from './components/HighBetaTradesContainer';
import { ManualTradesContainer } from './components/ManualTradesContainer';
import { ValueBreakoutContainer } from './components/ValueBreakoutContainer';
import { SrBreakoutContainer } from './components/SrBreakoutContainer';
import { TestContainer } from './components/TestContainer';
import { Mp3DayPatternContainer } from './components/Mp3DayPatternContainer';

export type TabType = 
  | 'chart' | 'dada_thoughts' | 'fifteen_min' 
  | 'scanner' | 'options' | 'signals' | 'doji' | 'doji_novol' | 'volume' 
  | 'opening_bias' | 'hourly_updates' | 'backtest_results' 
  | 'early_picks' | 'nr7_breakout' | 'order_flow' | 'order_flow_footprint' 
  | 'cvd_adv' | 'heatmap' | 'market_profile' | 'pro_market_profile' | 'mp_3day_pattern' | 'value_breakout' | 'footprint_chart' | 'vsa' | 'high_beta' | 'manual_trades' | 'sr_breakout' | 'test';

interface TabItem {
  id: TabType;
  label: string;
  color: string;
  badge?: string;
}

const TABS_LIST: TabItem[] = [
  { id: 'manual_trades', label: '📝 Manual Trades', color: '#10b981' },
  { id: 'test', label: '🧪 Test', color: '#8b5cf6' },
  { id: 'sr_breakout', label: '🎯 SR Breakout', color: '#06b6d4' },
  { id: 'chart', label: '📈 Candlestick Chart', color: '#3b82f6' },
  { id: 'market_profile', label: '🏛️ Market Profile', color: '#00f0ff' },
  { id: 'pro_market_profile', label: '🏛️ Pro TPO Profile', color: '#60a5fa' },
  { id: 'mp_3day_pattern', label: '🏛️ MP - 3 Day Pattern', color: '#ec4899', badge: 'NEW' },
  { id: 'value_breakout', label: '⚡ Value Breakout', color: '#f59e0b' },
  { id: 'high_beta', label: '🚀 High Beta Trades', color: '#f97316' },
  { id: 'vsa', label: '📊 VSA', color: '#a855f7' },
  { id: 'footprint_chart', label: '👣 Footprint', color: '#34d399' },
  { id: 'order_flow', label: '🍀 Lucky Flow', color: '#10b981' },
  { id: 'order_flow_footprint', label: '📊 Order Flow', color: '#60a5fa' },
  { id: 'cvd_adv', label: '📊 CVD / ADV', color: '#60a5fa' },
  { id: 'heatmap', label: '🔥 Heat Map', color: '#f87171' },
  { id: 'scanner', label: '🔍 Scanner', color: '#3b82f6' },
  { id: 'fifteen_min', label: '⏱️ 15 Mins Forensic', color: '#ec4899' },
  { id: 'hourly_updates', label: '🕒 Hourly Updates', color: '#8b5cf6' },
  { id: 'backtest_results', label: '🧪 Live Math Signals', color: '#10b981' },
  { id: 'options', label: '⛓️ Options Chain', color: '#3b82f6' },
  { id: 'signals', label: '📡 Signals', color: '#3b82f6' },
  { id: 'doji', label: '🎯 First Doji', color: '#3b82f6' },
  { id: 'doji_novol', label: '🎯 Doji (No Vol)', color: '#3b82f6' },
  { id: 'volume', label: '📊 Volume Breakouts', color: '#3b82f6' },
  { id: 'opening_bias', label: '🌅 Opening Bias', color: '#3b82f6' },
  { id: 'early_picks', label: '🌅 Early Picks', color: '#3b82f6' },
  { id: 'nr7_breakout', label: '🚀 20% UC Potential', color: '#f59e0b' },
  { id: 'dada_thoughts', label: '🧠 Dada Thoughts', color: '#eab308' }
];

function App() {
  const { isDark } = useTheme();
  const [symbol, setSymbol] = useState('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState('5'); // Default 5-minute interval
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [matrixHistory, setMatrixHistory] = useState<Record<string, any> | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check if opened as standalone workstation (e.g. via Pop Out button)
  const isStandalone = useMemo(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      return urlParams.get('standalone') === 'true';
    } catch (e) {
      return false;
    }
  }, []);

  const [activeTab, setActiveTab] = useState<TabType>(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tabParam = urlParams.get('tab') as TabType;
      if (tabParam && TABS_LIST.some(t => t.id === tabParam)) {
        return tabParam;
      }
      const savedTab = localStorage.getItem('activeTab') as TabType;
      if (savedTab && TABS_LIST.some(t => t.id === savedTab)) {
        return savedTab;
      }
    } catch (e) {}
    return 'test';
  });

  useEffect(() => {
    try {
      localStorage.setItem('activeTab', activeTab);
    } catch (e) {}
  }, [activeTab]);

  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  // Split tabs into 2 balanced lines
  const line1Tabs = useMemo(() => TABS_LIST.slice(0, 15), []);
  const line2Tabs = useMemo(() => TABS_LIST.slice(15), []);

  const renderTabButton = (tab: TabItem) => {
    const isActive = activeTab === tab.id;
    return (
      <button
        key={tab.id}
        ref={isActive ? activeTabRef : null}
        onClick={() => setActiveTab(tab.id)}
        style={{
          background: isActive ? `${tab.color}22` : 'transparent',
          border: 'none',
          borderBottom: isActive ? `2px solid ${tab.color}` : '2px solid transparent',
          color: isActive ? tab.color : (isDark ? 'var(--text-primary)' : '#475569'),
          padding: '2px 8px',
          fontSize: '11.5px',
          fontWeight: isActive ? '800' : '600',
          cursor: 'pointer',
          borderRadius: '4px',
          transition: 'all 0.15s',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px',
          whiteSpace: 'nowrap',
          flexShrink: 0
        }}
      >
        <span>{tab.label}</span>
        {tab.badge && (
          <span
            style={{
              fontSize: '8.5px',
              padding: '1px 4px',
              borderRadius: '3px',
              background: `${tab.color}33`,
              color: tab.color,
              fontWeight: '800',
              lineHeight: 1
            }}
          >
            {tab.badge}
          </span>
        )}
      </button>
    );
  };

  const [liveTradeAlert, setLiveTradeAlert] = useState<{ trade: any; message?: string; timestamp: number } | null>(null);

  // Melodic Chime + Natural Female AI Voice Speech Synthesizer
  const announceLiveTradeAlert = (trade: any, customMessage?: string) => {
    // 1. Melodic Institutional Chime
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      if (audioCtx.state === 'suspended') {
        audioCtx.resume().catch(() => {});
      }
      const now = audioCtx.currentTime;
      
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(659.25, now);
      gain1.gain.setValueAtTime(0.4, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start(now);
      osc1.stop(now + 0.3);

      const osc2 = audioCtx.createOscillator();
      const gain2 = audioCtx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(987.77, now + 0.12);
      gain2.gain.setValueAtTime(0.5, now + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.45);
      osc2.connect(gain2);
      gain2.connect(audioCtx.destination);
      osc2.start(now + 0.12);
      osc2.stop(now + 0.45);
    } catch (e) {}

    // 2. Natural Female AI Voice Announcement
    setTimeout(() => {
      try {
        if (!('speechSynthesis' in window)) return;
        window.speechSynthesis.cancel(); // Clear queued speech

        let speechText = customMessage;
        if (!speechText && trade) {
          const tradeTypeClean = (trade.tradeType || 'Call Buy').replace('BUY', 'Buy').replace('SHORT', 'Short').replace('LONG', 'Long');
          const nameClean = trade.displayName || trade.symbol || 'Contract';
          const entryClean = Number(trade.entryPrice || 0).toFixed(2);
          const slClean = Number(trade.stopLoss || 0).toFixed(2);
          const t1Clean = Number(trade.target1 || 0).toFixed(2);
          const t2Clean = Number(trade.target2 || 0).toFixed(2);
          const t3Clean = Number(trade.target3 || 0).toFixed(2);

          speechText = `Attention traders! Live alert: ${tradeTypeClean} ${nameClean} at ${entryClean} rupees. Targets ${t1Clean}, ${t2Clean}, and ${t3Clean}. Stop Loss ${slClean}.`;
        }

        if (!speechText) return;

        const utterance = new SpeechSynthesisUtterance(speechText);

        const selectAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          const femaleVoice = voices.find(v => 
            v.name.includes('Zira') || 
            v.name.includes('Jenny') || 
            v.name.includes('Aria') || 
            v.name.includes('Google UK English Female') || 
            v.name.includes('Google US English') ||
            v.name.includes('Samantha') || 
            v.name.includes('Victoria') ||
            (v.name.toLowerCase().includes('female') && v.lang.startsWith('en'))
          ) || voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en'));

          if (femaleVoice) {
            utterance.voice = femaleVoice;
          }
          
          utterance.rate = 1.0;
          utterance.pitch = 1.2; // Crisp female voice pitch
          utterance.volume = 1.0;

          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) {
          setTimeout(selectAndSpeak, 100);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            setTimeout(selectAndSpeak, 100);
          };
        }
      } catch (e) {
        console.warn('Speech synthesis error:', e);
      }
    }, 250);
  };

  // Subscribe to real-time manual trade & voice alert WebSocket broadcasts
  useEffect(() => {
    tvStreamer.addVoiceAnnouncementListener((alert) => {
      if (alert) {
        announceLiveTradeAlert(alert.trade, alert.message);
        setLiveTradeAlert({ trade: alert.trade, message: alert.message, timestamp: Date.now() });
      }
    });

    tvStreamer.addManualTradeAddedListener((trade) => {
      announceLiveTradeAlert(trade);
      setLiveTradeAlert({ trade, timestamp: Date.now() });
    });
  }, []);

  // Auto dismiss alert toast after 14 seconds
  useEffect(() => {
    if (liveTradeAlert) {
      const timer = setTimeout(() => {
        setLiveTradeAlert(null);
      }, 14000);
      return () => clearTimeout(timer);
    }
  }, [liveTradeAlert]);


  // Subscribe to symbol data via TradingView WebSocket & REST fallback
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCandles([]);
    setMatrixHistory(null);

    let isMounted = true;

    tvStreamer.setStatusListener((status) => {
      if (isMounted) {
        setConnectionStatus(status);
      }
    });

    const fetchInitialCandles = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const url = `${backendHttp}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}&limit=500`;
        const res = await fetch(url);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.candles && data.candles.length > 0 && isMounted) {
            setCandles(data.candles);
            setLoading(false);
            setConnectionStatus('connected');
          }
        }
      } catch (e) {
        // Fallback handled by WebSocket stream below
      }
    };

    fetchInitialCandles();

    tvStreamer.subscribe(
      symbol,
      timeframe,
      (data) => {
        if (!isMounted) return;
        setLoading(false);
        setConnectionStatus('connected');
        setError(null);
        if (data.matrixHistory) {
          setMatrixHistory(data.matrixHistory);
        }
        if (data.candles && data.candles.length > 0) {
          setCandles((prevCandles) => {
            if (data.isSnapshot) {
              return [...data.candles].sort((a, b) => (a.time as number) - (b.time as number));
            } else {
              const tick = data.candles[0];
              const index = prevCandles.findIndex((c) => c.time === tick.time);
              if (index !== -1) {
                const updated = [...prevCandles];
                updated[index] = tick;
                return updated;
              } else {
                const updated = [...prevCandles, tick];
                return updated.sort((a, b) => (a.time as number) - (b.time as number));
              }
            }
          });
        }
      },
      (err) => {
        if (!isMounted) return;
        setLoading(false);
        setError(err);
      }
    );

    const safetyTimer = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        setConnectionStatus('connected');
      }
    }, 2000);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      tvStreamer.unsubscribe();
    };
  }, [symbol, timeframe, refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  const matrixSeriesData = useMemo(() => {
    if (matrixHistory && candles && candles.length > 0) {
      const isDailyAnchor = !(timeframe === 'D' || timeframe === 'W' || timeframe === 'M');
      
      const seriesData = {
        level1: [], level2: [], level3: [], level4: [], level5: [],
        level6: [], level7: [], level8: [], level9: [], level10: []
      };

      const groups: Record<string, Candle[]> = {};
      const groupKeys: string[] = [];
      
      candles.forEach(c => {
        const date = new Date(c.time * 1000);
        let key = '';
        if (isDailyAnchor) {
          key = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
        } else {
          key = date.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }).substring(0, 7);
        }
        if (!groups[key]) {
          groups[key] = [];
          groupKeys.push(key);
        }
        groups[key].push(c);
      });

      groupKeys.sort();

      if (groupKeys.length > 0) {
        const latestKey = groupKeys[groupKeys.length - 1];
        const latestCandles = groups[latestKey];
        const levels = matrixHistory[latestKey];
        if (levels && latestCandles) {
          latestCandles.forEach(c => {
            seriesData.level1.push({ time: c.time as any, value: levels.level1 });
            seriesData.level2.push({ time: c.time as any, value: levels.level2 });
            seriesData.level3.push({ time: c.time as any, value: levels.level3 });
            seriesData.level4.push({ time: c.time as any, value: levels.level4 });
            seriesData.level5.push({ time: c.time as any, value: levels.level5 });
            seriesData.level6.push({ time: c.time as any, value: levels.level6 });
            seriesData.level7.push({ time: c.time as any, value: levels.level7 });
            seriesData.level8.push({ time: c.time as any, value: levels.level8 });
            seriesData.level9.push({ time: c.time as any, value: levels.level9 });
            seriesData.level10.push({ time: c.time as any, value: levels.level10 });
          });
        }
      }
      return seriesData;
    }
    return calculateMatrixSeriesData(candles, timeframe);
  }, [candles, timeframe, matrixHistory]);

  // Global Real-time Candlestick Chart Level Alerts Engine & Calling Bell Synthesizer
  // Active 24/7 across all dashboard tabs
  const {
    activeAlert: levelAlert,
    alertsMuted: levelAlertsMuted,
    firedCount: levelAlertsFiredCount,
    setAlertsMuted: setLevelAlertsMuted,
    handleCloseAlert: handleCloseLevelAlert,
    handleResetSetupAlerts,
    playCallingBellSound: triggerCallingBell
  } = useLevelAlerts({
    candles,
    matrixSeriesData,
    symbol,
    timeframe
  });

  const activeTabInfo = TABS_LIST.find((t) => t.id === activeTab) || TABS_LIST[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isStandalone ? '0' : '12px', width: '100%', minHeight: '100vh', height: isStandalone ? '100vh' : 'auto', boxSizing: 'border-box', overflowY: isStandalone ? 'hidden' : 'auto' }}>
      
      {/* Real-time Voice Alert Broadcast Notification Banner */}
      {!isStandalone && liveTradeAlert && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 99999,
          maxWidth: '460px',
          background: isDark 
            ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.98))' 
            : 'linear-gradient(135deg, #ffffff, #f8fafc)',
          border: '1px solid #f59e0b',
          boxShadow: isDark 
            ? '0 10px 30px rgba(0, 0, 0, 0.8), 0 0 20px rgba(245, 158, 11, 0.35)' 
            : '0 10px 30px rgba(0, 0, 0, 0.15), 0 0 15px rgba(245, 158, 11, 0.2)',
          borderRadius: '12px',
          padding: '14px 16px',
          color: isDark ? '#ffffff' : '#0f172a',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          backdropFilter: 'blur(12px)',
          animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{
                background: 'rgba(245, 158, 11, 0.25)',
                color: '#f59e0b',
                padding: '3px 8px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '900',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                letterSpacing: '0.5px'
              }}>
                <Volume2 size={13} className="animate-pulse" />
                BROADCAST ANNOUNCEMENT
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Live</span>
            </div>
            <button
              onClick={() => setLiveTradeAlert(null)}
              style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '2px', display: 'flex' }}
              title="Close notification"
            >
              <X size={15} />
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px',
              height: '38px',
              borderRadius: '50%',
              background: 'rgba(245, 158, 11, 0.2)',
              border: '1px solid rgba(245, 158, 11, 0.4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <Volume2 size={18} color="#f59e0b" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: '900', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <span>{liveTradeAlert.trade?.displayName || 'Trade Setup'}</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '800',
                  padding: '2px 6px',
                  borderRadius: '4px',
                  background: (liveTradeAlert.trade?.tradeType || '').includes('BUY') ? 'rgba(16, 185, 129, 0.25)' : 'rgba(239, 68, 68, 0.25)',
                  color: (liveTradeAlert.trade?.tradeType || '').includes('BUY') ? '#10b981' : '#ef4444'
                }}>
                  {liveTradeAlert.trade?.tradeType}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '3px', fontFamily: 'monospace' }}>
                Entry: <strong style={{ color: '#ffffff' }}>₹{liveTradeAlert.trade?.entryPrice}</strong> · T1: <strong style={{ color: '#60a5fa' }}>₹{liveTradeAlert.trade?.target1}</strong> · T2: <strong style={{ color: '#34d399' }}>₹{liveTradeAlert.trade?.target2}</strong> · T3: <strong style={{ color: '#facc15' }}>₹{liveTradeAlert.trade?.target3}</strong> · SL: <strong style={{ color: '#ef4444' }}>₹{liveTradeAlert.trade?.stopLoss}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', paddingTop: '6px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <span style={{ fontSize: '10px', color: '#94a3b8', fontStyle: 'italic' }}>
              🔊 Announced across all active dashboards
            </span>
            <button
              onClick={() => announceLiveTradeAlert(liveTradeAlert.trade, liveTradeAlert.message)}
              style={{
                background: 'rgba(245, 158, 11, 0.2)',
                border: '1px solid #f59e0b',
                color: '#f59e0b',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <Volume2 size={12} />
              Replay Audio
            </button>
          </div>
        </div>
      )}

      {/* Top of Dashboard D-Period Failure Alert Banner */}
      {/* Top of Dashboard Calling Bell Alert Banner (Active irrespective of which tab user is in) */}
      {!isStandalone && (
        <>
          <TopCallingBellAlertBar
            alert={levelAlert}
            onClose={handleCloseLevelAlert}
            onResetSetup={handleResetSetupAlerts}
            onSwitchToChart={() => {
              if (levelAlert?.symbol) {
                setSymbol(levelAlert.symbol);
              }
              setActiveTab('chart');
            }}
          />

          {/* Top Live Indices Ticker: NIFTY, NIFTY FUTURES, BANKNIFTY, BANKNIFTY FUTURES, SENSEX */}
          <TopMarketTickerBar
            currentSymbol={symbol}
            onSymbolSelect={(sym) => {
              setSymbol(sym);
              setActiveTab('chart');
            }}
          />

          {/* Responsive Header */}
          <DashboardHeader
            currentSymbol={symbol}
            currentTimeframe={timeframe}
            connectionStatus={connectionStatus}
            onSymbolChange={setSymbol}
            onTimeframeChange={setTimeframe}
            onRefresh={handleRefresh}
          />

          {/* Navigation Controls Bar (Dropdown Quick Select + 2-Line Tab Bar) */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`, 
              padding: '4px 6px', 
              width: '100%', 
              boxSizing: 'border-box' 
            }}
          >
            {/* Mobile / Desktop Quick Dropdown Selector (Do Not Remove) */}
            <div 
              style={{ 
                display: 'flex', 
                alignItems: 'center', 
                gap: '6px', 
                background: isDark ? 'rgba(30, 41, 59, 0.85)' : '#ffffff', 
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.12)' : '#cbd5e1'}`, 
                padding: '4px 8px', 
                borderRadius: '6px', 
                flexShrink: 0,
                alignSelf: 'center',
                boxShadow: isDark ? '0 1px 3px rgba(0, 0, 0, 0.3)' : '0 1px 3px rgba(0, 0, 0, 0.05)' 
              }}
            >
              <Layers size={14} color="#60a5fa" />
              <select
                value={activeTab}
                onChange={(e) => setActiveTab(e.target.value as TabType)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: activeTabInfo.color,
                  fontSize: '12px',
                  fontWeight: '800',
                  outline: 'none',
                  cursor: 'pointer',
                  maxWidth: '135px'
                }}
              >
                {TABS_LIST.map((tab) => (
                  <option key={tab.id} value={tab.id} style={{ backgroundColor: isDark ? '#0f172a' : '#ffffff', color: isDark ? '#ffffff' : '#0f172a' }}>
                    {tab.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 2-Line Tab Bar */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', flex: 1, minWidth: 0, overflow: 'hidden' }}>
              {/* Line 1: Primary Charts, Profiles, Order Flow & Execution */}
              <div className="mobile-tab-scroll" style={{ display: 'flex', alignItems: 'center', gap: '3px', margin: 0, paddingBottom: '1px' }}>
                {line1Tabs.map(renderTabButton)}
              </div>
              {/* Line 2: Scanners, Timeframes, Live Signals & Intelligence */}
              <div className="mobile-tab-scroll" style={{ display: 'flex', alignItems: 'center', gap: '3px', margin: 0, paddingBottom: '1px' }}>
                {line2Tabs.map(renderTabButton)}
              </div>
            </div>

          </div>
        </>
      )}

      {/* Main Workspace */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
        {activeTab === 'manual_trades' ? (
          <TabErrorBoundary tabName="Manual Trades">
            <ManualTradesContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'test' ? (
          <TabErrorBoundary tabName="Test">
            <TestContainer
              selectedSymbol={symbol}
              selectedTimeframe={timeframe}
              onSymbolSelect={setSymbol}
              onTimeframeChange={setTimeframe}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'sr_breakout' ? (
          <TabErrorBoundary tabName="SR Breakout">
            <SrBreakoutContainer
              initialSegment="cash"
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
              onSwitchToMarketProfile={() => setActiveTab('market_profile')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'high_beta' ? (
          <TabErrorBoundary tabName="High Beta Trades">
            <HighBetaTradesContainer />
          </TabErrorBoundary>
        ) : activeTab === 'vsa' ? (
          <TabErrorBoundary tabName="VSA">
            <VsaContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'footprint_chart' ? (
          <TabErrorBoundary tabName="Footprint">
            <FootprintChartContainer
              selectedSymbol={symbol}
              selectedTimeframe={timeframe}
              onSymbolSelect={setSymbol}
              onTimeframeChange={setTimeframe}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'market_profile' ? (
          <TabErrorBoundary tabName="Market Profile">
            <MarketProfileContainer
              selectedSymbol={symbol}
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'pro_market_profile' ? (
          <TabErrorBoundary tabName="Pro TPO Profile">
            <ProMarketProfileContainer
              selectedSymbol={symbol}
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'mp_3day_pattern' ? (
          <TabErrorBoundary tabName="MP - 3 Day Pattern">
            <Mp3DayPatternContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={(sym) => {
                setSymbol(sym);
                setActiveTab('chart');
              }}
              onSwitchToMarketProfile={(sym) => {
                setSymbol(sym);
                setActiveTab('market_profile');
              }}
            />
          </TabErrorBoundary>
        ) : activeTab === 'value_breakout' ? (
          <TabErrorBoundary tabName="Value Breakout">
            <ValueBreakoutContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
              onSwitchToMarketProfile={() => setActiveTab('market_profile')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'heatmap' ? (
          <TabErrorBoundary tabName="Heat Map">
            <HeatMapContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'cvd_adv' ? (
          <TabErrorBoundary tabName="CVD / ADV">
            <CvdAdvContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'fifteen_min' ? (
          <TabErrorBoundary tabName="15 Mins Forensic">
            <FifteenMinForensicContainer />
          </TabErrorBoundary>
        ) : activeTab === 'dada_thoughts' ? (
          <TabErrorBoundary tabName="Dada Thoughts">
            <DadaThoughtsContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'hourly_updates' ? (
          <TabErrorBoundary tabName="Hourly Updates">
            <HourlyUpdatesContainer />
          </TabErrorBoundary>
        ) : activeTab === 'backtest_results' ? (
          <TabErrorBoundary tabName="Live Math Signals">
            <BacktestResultsContainer />
          </TabErrorBoundary>
        ) : activeTab === 'scanner' ? (
          <TabErrorBoundary tabName="Scanner">
            <ScannerContainer 
              onSymbolSelect={setSymbol} 
              onSwitchToChart={() => setActiveTab('chart')} 
            />
          </TabErrorBoundary>
        ) : activeTab === 'options' ? (
          <TabErrorBoundary tabName="Options Chain">
            <OptionsChain
              currentSymbol={symbol}
              onSymbolChange={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
              onSwitchToMarketProfile={() => setActiveTab('market_profile')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'signals' ? (
          <TabErrorBoundary tabName="Live Signals">
            <SignalsContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'doji' ? (
          <TabErrorBoundary tabName="First Doji">
            <DojiContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'doji_novol' ? (
          <TabErrorBoundary tabName="Doji (No Vol)">
            <DojiContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
              noVolumeFilter={true}
            />
          </TabErrorBoundary>
        ) : activeTab === 'volume' ? (
          <TabErrorBoundary tabName="Volume Breakouts">
            <VolumeContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'opening_bias' ? (
          <TabErrorBoundary tabName="Opening Bias">
            <OpeningBiasContainer />
          </TabErrorBoundary>
        ) : activeTab === 'early_picks' ? (
          <TabErrorBoundary tabName="Early Picks">
            <EarlyPicksContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'nr7_breakout' ? (
          <TabErrorBoundary tabName="20% UC Potential">
            <Nr7BreakoutContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'order_flow' ? (
          <TabErrorBoundary tabName="Lucky Flow">
            <OrderFlowContainer
              candles={candles}
              currentSymbol={symbol}
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'order_flow_footprint' ? (
          <TabErrorBoundary tabName="Order Flow">
            <OrderFlowFootprintContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : (
          <>
            {error && (
              <div className="glass-panel animate-fade-in" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px', marginBottom: '20px' }}>
                <AlertCircle color="#ef4444" size={20} />
                <div>
                  <strong style={{ color: '#ef4444', fontSize: '14px' }}>Connection Error:</strong>
                  <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>{error}</p>
                </div>
              </div>
            )}

            {loading ? (
              <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '400px' }}>
                <Loader2 className="animate-spin" size={32} color="var(--accent-blue)" style={{ animation: 'spin 1.5s linear infinite' }} />
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Connecting to Angel One SmartAPI & streaming live data...</p>
              </div>
            ) : (
              <div style={{ flex: '1', display: 'flex', minHeight: '0' }}>
                <TabErrorBoundary tabName="Candlestick Chart">
                  <ChartContainer
                    candles={candles}
                    symbol={symbol}
                    timeframe={timeframe}
                    matrixSeriesData={matrixSeriesData}
                    connectionStatus={connectionStatus}
                    connectionError={error}
                    activeAlert={levelAlert}
                    onCloseAlert={handleCloseLevelAlert}
                    onResetSetupAlerts={handleResetSetupAlerts}
                    alertsMuted={levelAlertsMuted}
                    onToggleAlertsMuted={() => setLevelAlertsMuted(!levelAlertsMuted)}
                    firedAlertsCount={levelAlertsFiredCount}
                  />
                </TabErrorBoundary>
              </div>
            )}
          </>
        )}
      </div>

      {/* Global Realtime Level Alert Popup Modal - Visible irrespective of which tab user is in */}
      <RealtimeLevelAlertPopup
        alert={levelAlert}
        onClose={handleCloseLevelAlert}
        onResetSetup={handleResetSetupAlerts}
        onSwitchToChart={() => {
          if (levelAlert?.symbol) {
            setSymbol(levelAlert.symbol);
          }
          setActiveTab('chart');
        }}
      />

      {/* Global Disclaimer Footer */}
      <footer style={{
        padding: '10px 20px 0 20px',
        borderTop: '1px solid var(--border-color)',
        textAlign: 'center',
        fontSize: '11px',
        color: 'var(--text-muted)',
        lineHeight: '1.5',
        letterSpacing: '0.2px'
      }}>
        "Investments in the securities market are subject to market risks. Read all the related documents carefully before investing. All calls and ideas shared are for educational purposes only."
      </footer>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default App;
