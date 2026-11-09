import { useState, useEffect, useMemo, useRef } from 'react';
import { useTheme } from './context/ThemeContext';
import { DashboardHeader } from './components/DashboardHeader';
import { TopMarketTickerBar } from './components/TopMarketTickerBar';
import { ChartContainer } from './components/ChartContainer';
import { MultiChartContainer } from './components/MultiChartContainer';
import { tvStreamer, getBackendHttpUrl } from './utils/tvStreamer';
import type { Candle } from './utils/profileCalculator';
import { calculateMatrixSeriesData } from './utils/matrixCalculator';
import { filterMarketHoursCandles, isWithinMarketHours } from './utils/marketHours';
import { AlertCircle, Loader2, Layers, Zap, X, Volume2, Star } from 'lucide-react';
import { TabErrorBoundary } from './components/TabErrorBoundary';
import { useLevelAlerts, playCallingBellSound } from './utils/useLevelAlerts';
import { RealtimeLevelAlertPopup } from './components/RealtimeLevelAlertPopup';
import { TopCallingBellAlertBar } from './components/TopCallingBellAlertBar';
import { ScannerContainer } from './components/ScannerContainer';
import { OptionsChain } from './components/OptionsChain';
import { SignalsContainer } from './components/SignalsContainer';
import { DojiContainer } from './components/DojiContainer';
import { HourlyUpdatesContainer } from './components/HourlyUpdatesContainer';
import { BacktestResultsContainer } from './components/BacktestResultsContainer';
import { FifteenMinForensicContainer } from './components/FifteenMinForensicContainer';
import { Nr7BreakoutContainer } from './components/Nr7BreakoutContainer';
import { CvdAdvContainer } from './components/CvdAdvContainer';
import { HeatMapContainer } from './components/HeatMapContainer';
import { MarketProfileContainer } from './components/MarketProfileContainer';
import { ProMarketProfileContainer } from './components/ProMarketProfileContainer';
import { TrialContainer } from './components/TrialContainer';
import { FootprintChartContainer } from './components/FootprintChartContainer';
import { HighBetaTradesContainer } from './components/HighBetaTradesContainer';
import { ManualTradesContainer } from './components/ManualTradesContainer';
import { SrBreakoutContainer } from './components/SrBreakoutContainer';
import { TestContainer } from './components/TestContainer';
import { Test2Container } from './components/Test2Container';
import { Mp3DayPatternContainer } from './components/Mp3DayPatternContainer';
import { LoginScreen, getStoredAuthUser, clearStoredAuthUser, AUTH_EPOCH_KEY, CURRENT_AUTH_EPOCH } from './components/LoginScreen';
import { UserManagementModal } from './components/UserManagementModal';
import { ZerodhaConnectModal } from './components/ZerodhaConnectModal';
import { HomeContainer } from './components/HomeContainer';
import { AlgoTradeContainer } from './components/AlgoTradeContainer';
import { HomeBottomWidgets } from './components/HomeBottomWidgets';
import { WATCHLIST_DATA } from './data/watchlistData';

export type TabType = 
  | 'home'
  | 'chart' | 'fifteen_min' 
  | 'scanner' | 'options' | 'signals' | 'doji' | 'doji_novol' 
  | 'hourly_updates' | 'backtest_results' 
  | 'nr7_breakout' 
  | 'cvd_adv' | 'heatmap' | 'market_profile' | 'pro_market_profile' | 'trial' | 'mp_3day_pattern' | 'footprint_chart' | 'high_beta' | 'manual_trades' | 'algo_trade' | 'sr_breakout' | 'test' | 'test2';

interface TabItem {
  id: TabType;
  label: string;
  color: string;
  badge?: string;
}


interface ToolGroup {
  name: string;
  items: { id: TabType; label: string }[];
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    name: 'Charts',
    items: [
      { id: 'chart', label: 'Candlestick' },
      { id: 'market_profile', label: 'Market Profile' },
      { id: 'pro_market_profile', label: 'Pro TPO' },
      { id: 'trial', label: 'Trial Tab' },
      { id: 'test', label: 'Orderflow Chart' }
    ]
  },
  {
    name: 'Signals',
    items: [
      { id: 'scanner', label: 'Scanner' },
      { id: 'mp_3day_pattern', label: 'MP 3-Day Pattern' },
      { id: 'backtest_results', label: 'Live Math' },
      { id: 'options', label: 'Options Chain' },
      { id: 'signals', label: 'Signals' },
      { id: 'fifteen_min', label: '15 Mins Forensic' },
      { id: 'hourly_updates', label: 'Hourly Updates' }
    ]
  },
  {
    name: 'Breakouts',
    items: [
      { id: 'algo_trade', label: 'Algo Trade' },
      { id: 'sr_breakout', label: 'SR Breakout' },
      { id: 'high_beta', label: 'High Beta Trades' },
      { id: 'nr7_breakout', label: '20% UC Potential' }
    ]
  },
  {
    name: 'Flow',
    items: [
      { id: 'footprint_chart', label: 'Footprint' }
    ]
  },
  {
    name: 'Others',
    items: [
      { id: 'manual_trades', label: 'Manual Trades' },
      { id: 'test2', label: 'Test 2 (Exhaustion Radar)' },
      { id: 'cvd_adv', label: 'CVD / ADV' },
      { id: 'heatmap', label: 'Heat Map' },
      { id: 'doji', label: 'First Doji' },
      { id: 'doji_novol', label: 'Doji (No Vol)' }
    ]
  }
];

const ALL_VALID_TAB_IDS = new Set<string>(TOOL_GROUPS.flatMap(g => g.items.map(i => i.id)));

const ALL_TABS_MAP = new Map<TabType, { id: TabType; label: string; groupName: string }>();
TOOL_GROUPS.forEach(g => {
  g.items.forEach(i => {
    ALL_TABS_MAP.set(i.id, { ...i, groupName: g.name });
  });
});

function sanitizeFavoriteTabs(raw: any): TabType[] {
  if (!Array.isArray(raw)) return ['chart', 'test'];
  const validTabs: TabType[] = [];
  for (const item of raw) {
    const str = String(item).trim();
    if (ALL_VALID_TAB_IDS.has(str)) {
      if (!validTabs.includes(str as TabType)) {
        validTabs.push(str as TabType);
      }
    } else if (str === 'Charts') {
      // Migrate legacy group favorites
      if (!validTabs.includes('chart')) validTabs.push('chart');
      if (!validTabs.includes('test')) validTabs.push('test');
    } else if (str === 'Flow') {
      if (!validTabs.includes('footprint_chart')) validTabs.push('footprint_chart');
    } else if (str === 'Signals') {
      if (!validTabs.includes('scanner')) validTabs.push('scanner');
    }
  }
  return validTabs.length > 0 ? validTabs : ['chart', 'test'];
}

const TABS_LIST: TabItem[] = [
  { id: 'home', label: '🏠 Home', color: '#38bdf8' },
  { id: 'manual_trades', label: '📝 Manual Trades', color: '#10b981' },
  { id: 'test', label: '📊 Orderflow Chart', color: '#38bdf8' },
  { id: 'test2', label: '🛡️ Test 2: Exhaustion Radar', color: '#ef4444', badge: 'PRO' },
  { id: 'sr_breakout', label: '🎯 SR Breakout', color: '#06b6d4' },
  { id: 'chart', label: '📈 Candlestick Chart', color: '#3b82f6' },
  { id: 'market_profile', label: '🏛️ Market Profile', color: '#00f0ff' },
  { id: 'pro_market_profile', label: '🏛️ Pro TPO Profile', color: '#60a5fa' },
  { id: 'trial', label: '🏛️ Trial', color: '#f59e0b', badge: 'NEW' },
  { id: 'mp_3day_pattern', label: '🏛️ MP - 3 Day Pattern', color: '#ec4899', badge: 'NEW' },
  { id: 'high_beta', label: '🚀 High Beta Trades', color: '#f97316' },
  { id: 'footprint_chart', label: '👣 Footprint', color: '#34d399' },
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
  { id: 'nr7_breakout', label: '🚀 20% UC Potential', color: '#f59e0b' }
];

function App() {
  const { isDark } = useTheme();
  const [authUser, setAuthUser] = useState<string | null>(() => getStoredAuthUser());
  const [isUserManagementOpen, setIsUserManagementOpen] = useState(false);
  const [isZerodhaModalOpen, setIsZerodhaModalOpen] = useState(false);

  const handleLogout = () => {
    try {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('auth');
      window.history.replaceState({}, document.title, cleanUrl.toString());
    } catch {}
    try {
      if (authUser) {
        getBackendHttpUrl().then(backendHttp => {
          if (backendHttp) {
            fetch(`${backendHttp}/api/auth/heartbeat-leave`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ username: authUser })
            }).catch(() => {});
          }
        }).catch(() => {});
      }
    } catch {}
    clearStoredAuthUser();
    setAuthUser(null);
  };

  // Multi-Device Session Invalidation Engine & Real-Time Presence Heartbeat
  useEffect(() => {
    if (!authUser) return;

    tvStreamer.identifyUser(authUser);

    let isChecking = false;
    const checkSessionValidity = async () => {
      if (isChecking) return;
      isChecking = true;
      try {
        tvStreamer.identifyUser(authUser);
        const localEpoch = Number(localStorage.getItem(AUTH_EPOCH_KEY) || sessionStorage.getItem(AUTH_EPOCH_KEY) || 0);
        if (!localEpoch) {
          handleLogout();
          return;
        }

        const backendHttp = await getBackendHttpUrl();
        if (backendHttp) {
          // Active Presence Heartbeat
          fetch(`${backendHttp}/api/auth/heartbeat`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'bypass-tunnel-reminder': 'true',
              'x-auth-user': authUser
            },
            body: JSON.stringify({ username: authUser })
          }).catch(() => {});

          const res = await fetch(`${backendHttp}/api/auth/session-control`, {
            headers: { 'bypass-tunnel-reminder': 'true' }
          });
          if (res.ok) {
            const data = await res.json();
            if (data && data.adminSessionEpoch) {
              if (localEpoch < data.adminSessionEpoch) {
                console.warn('[Auth Engine] Active session has been revoked by Administrator.');
                handleLogout();
                return;
              }
            }
          }
        }
      } catch (e) {} finally {
        isChecking = false;
      }
    };

    checkSessionValidity();
    const interval = setInterval(checkSessionValidity, 12000);
    window.addEventListener('focus', checkSessionValidity);

    const handleBeforeUnload = () => {
      try {
        getBackendHttpUrl().then(backendHttp => {
          if (backendHttp && authUser) {
            const blob = new Blob([JSON.stringify({ username: authUser })], { type: 'application/json' });
            navigator.sendBeacon(`${backendHttp}/api/auth/heartbeat-leave`, blob);
          }
        }).catch(() => {});
      } catch {}
    };
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', checkSessionValidity);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [authUser]);

  const [symbol, setSymbol] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const sym = urlParams.get('symbol');
      if (sym) return sym;
    } catch (e) {}
    return 'NSE:NIFTY';
  });
  const [timeframe, setTimeframe] = useState(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      const tf = urlParams.get('timeframe');
      if (tf) return tf;
    } catch (e) {}
    return '5';
  });
  const [multiChartLayout, setMultiChartLayout] = useState<string | number>(() => {
    try {
      const saved = localStorage.getItem('tradingguru_multichart_layout');
      if (saved) return saved;
    } catch {}
    return '2_vertical';
  });
  const handleLayoutChange = (newLayout: string | number) => {
    setMultiChartLayout(newLayout);
    try {
      localStorage.setItem('tradingguru_multichart_layout', String(newLayout));
    } catch {}
  };
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [matrixHistory, setMatrixHistory] = useState<Record<string, any> | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [loadedSymbol, setLoadedSymbol] = useState<string>('');
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
    return 'chart';
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
    setLoadedSymbol('');

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
        const res = await fetch(url, { headers: { 'bypass-tunnel-reminder': 'true' } });
        if (res.ok && isMounted) {
          const data = await res.json();
          const sym = data.symbol || symbol;
          if (data.matrixHistory) {
            setMatrixHistory(data.matrixHistory);
          }
          if (data.candles && data.candles.length > 0 && isMounted && tvStreamer.isSymbolMatch(sym, symbol)) {
            setCandles(filterMarketHoursCandles(data.candles, symbol, timeframe));
            setLoadedSymbol(symbol);
            setLoading(false);
            setConnectionStatus('connected');
          }
        }

        // Parallel fetch matrix-levels to ensure anchor levels are fresh and locked
        fetch(`${backendHttp}/api/matrix-levels?symbol=${encodeURIComponent(symbol)}&timeframe=${timeframe}`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        })
          .then(r => r.json())
          .then(mlData => {
            if (mlData?.matrixHistory && isMounted) {
              setMatrixHistory(mlData.matrixHistory);
            }
          })
          .catch(() => {});
      } catch (e) {
        // Fallback handled by WebSocket stream below
      }
    };

    fetchInitialCandles();

    const unsubscribe = tvStreamer.subscribe(
      symbol,
      timeframe,
      (data) => {
        if (!isMounted) return;
        // Strictly verify symbol matches the currently active symbol
        if (!tvStreamer.isSymbolMatch(data.symbol, symbol)) {
          return;
        }

        setLoading(false);
        setLoadedSymbol(symbol);
        setConnectionStatus('connected');
        setError(null);
        if (data.matrixHistory) {
          setMatrixHistory(data.matrixHistory);
        }
        if (data.candles && data.candles.length > 0) {
          setCandles((prevCandles) => {
            if (data.isSnapshot) {
              const filtered = filterMarketHoursCandles(data.candles, symbol, timeframe);
              return [...filtered].sort((a, b) => (a.time as number) - (b.time as number));
            } else {
              // Only append real-time ticks if base candles are already loaded for this symbol
              if (prevCandles.length === 0) {
                return prevCandles;
              }
              const tick = data.candles[0];
              if (!isWithinMarketHours(tick.time as number, symbol, timeframe)) {
                return prevCandles; // Drop ticks outside market hours
              }
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
      if (isMounted) {
        setLoading(false);
        setConnectionStatus('connected');
      }
    }, 2500);

    return () => {
      isMounted = false;
      clearTimeout(safetyTimer);
      unsubscribe();
      tvStreamer.sendUnsubscribe(symbol);
    };
  }, [symbol, timeframe, refreshKey]);

  const handleRefresh = () => {
    setLoading(true);
    setRefreshKey((prev) => prev + 1);
  };

  const matrixSeriesData = useMemo(() => {
    return calculateMatrixSeriesData(candles, timeframe, matrixHistory);
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


  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Favorites: true,
    Charts: true,
    Signals: true,
    Breakouts: true,
    Flow: true,
    Others: false
  });

  const [favoriteTabs, setFavoriteTabs] = useState<TabType[]>(() => {
    const currentAuth = getStoredAuthUser();
    if (currentAuth) {
      try {
        const cached = localStorage.getItem(`trading_guru_favorites_${currentAuth.toLowerCase()}`);
        if (cached) return sanitizeFavoriteTabs(JSON.parse(cached));
      } catch {}
    }
    return ['chart', 'test'];
  });

  // Load and synchronize user's favorite tabs from backend
  useEffect(() => {
    if (!authUser) return;
    const cleanUser = authUser.toLowerCase();

    // Load cached preferences first for instant responsiveness
    try {
      const cached = localStorage.getItem(`trading_guru_favorites_${cleanUser}`);
      if (cached) {
        setFavoriteTabs(sanitizeFavoriteTabs(JSON.parse(cached)));
      }
    } catch {}

    let isMounted = true;
    const fetchUserFavorites = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/user/favorites?username=${encodeURIComponent(cleanUser)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.success && Array.isArray(data.favorites) && isMounted) {
            const sanitized = sanitizeFavoriteTabs(data.favorites);
            setFavoriteTabs(sanitized);
            localStorage.setItem(`trading_guru_favorites_${cleanUser}`, JSON.stringify(sanitized));
          }
        }
      } catch (err) {
        console.warn('[Favorites] Error loading favorites from backend:', err);
      }
    };

    fetchUserFavorites();
    return () => { isMounted = false; };
  }, [authUser]);

  const toggleFavoriteTab = async (tabId: TabType) => {
    const isFav = favoriteTabs.includes(tabId);
    const nextFavs = isFav
      ? favoriteTabs.filter(id => id !== tabId)
      : [...favoriteTabs, tabId];

    setFavoriteTabs(nextFavs);

    if (authUser) {
      const cleanUser = authUser.toLowerCase();
      try {
        localStorage.setItem(`trading_guru_favorites_${cleanUser}`, JSON.stringify(nextFavs));
        const backendHttp = await getBackendHttpUrl();
        await fetch(`${backendHttp}/api/user/favorites`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: cleanUser, favorites: nextFavs })
        });
      } catch (err) {
        console.warn('[Favorites] Error saving favorites to backend:', err);
      }
    }
  };

  const [watchlistCategory, setWatchlistCategory] = useState<'Futures' | 'Stocks' | 'MCX' | 'Indices'>('Futures');
  const [watchlistSearch, setWatchlistSearch] = useState('');
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);
  const [isWatchlistDrawerOpen, setIsWatchlistDrawerOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [mobileMenuTab, setMobileMenuTab] = useState<'watchlist' | 'favorites' | 'tools'>('watchlist');

  const filteredWatchlist = useMemo(() => {
    const list = WATCHLIST_DATA[watchlistCategory] || [];
    if (!watchlistSearch.trim()) return list;
    const q = watchlistSearch.toLowerCase().trim();
    return list.filter(item => item.name.toLowerCase().includes(q) || item.symbol.toLowerCase().includes(q));
  }, [watchlistCategory, watchlistSearch]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    TOOL_GROUPS.forEach(g => {
      if (g.items.some(item => item.id === activeTab)) {
        setOpenGroups(prev => ({ ...prev, [g.name]: true }));
      }
    });
  }, [activeTab]);

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const symbolDisplayName = useMemo(() => {
    if (!symbol || typeof symbol !== 'string') return 'NIFTY 50';
    if (symbol.includes('NIFTY1!')) return 'NIFTY FUT';
    if (symbol.includes('BANKNIFTY1!')) return 'BANK NIFTY FUT';
    if (symbol.includes('FINNIFTY1!')) return 'FIN NIFTY FUT';
    if (symbol.includes('MIDCPNIFTY1!')) return 'MIDCAP FUT';
    if (symbol.includes('CRUDEOIL')) return 'CRUDE OIL FUT';
    if (symbol === 'NSE:NIFTY') return 'NIFTY 50';
    if (symbol === 'NSE:BANKNIFTY') return 'BANK NIFTY';
    if (symbol === 'NSE:FINNIFTY') return 'FIN NIFTY';
    if (symbol.endsWith('1!')) {
      const clean = symbol.replace('NSE:', '').replace('MCX:', '').replace('BSE:', '').replace('1!', '');
      return `${clean} FUT`;
    }
    return symbol.replace('NSE:', '').replace('MCX:', '').replace('BSE:', '');
  }, [symbol]);

  const { lastPrice, priceChange, priceChangePct } = useMemo(() => {
    if (!candles || candles.length === 0) {
      return { lastPrice: 22421.95, priceChange: -198.58, priceChangePct: -0.88 };
    }
    const last = candles[candles.length - 1];
    const prev = candles.length > 1 ? candles[candles.length - 2].close : last.open;
    const ltp = last.close;
    const chg = ltp - prev;
    const chgPct = prev ? (chg / prev) * 100 : 0;
    return { lastPrice: ltp, priceChange: chg, priceChangePct: chgPct };
  }, [candles]);

  const activeTabInfo = TABS_LIST.find((t) => t.id === activeTab) || TABS_LIST[0];

  if (!authUser) {
    return <LoginScreen onLoginSuccess={setAuthUser} />;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: isStandalone ? '0' : '6px', width: '100%', minHeight: '100vh', height: (isStandalone || activeTab === 'chart' || activeTab === 'testing') ? '100vh' : 'auto', maxHeight: (isStandalone || activeTab === 'chart' || activeTab === 'testing') ? '100vh' : 'none', boxSizing: 'border-box', overflowY: (isStandalone || activeTab === 'chart' || activeTab === 'testing') ? 'hidden' : 'auto' }}>
      
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
          <TabErrorBoundary tabName="Dashboard Header">
            <DashboardHeader
              currentSymbol={symbol}
              currentTimeframe={timeframe}
              connectionStatus={connectionStatus}
              onSymbolChange={setSymbol}
              onTimeframeChange={setTimeframe}
              onRefresh={handleRefresh}
              authUser={authUser}
              onLogout={handleLogout}
              onOpenUserManagement={() => setIsUserManagementOpen(true)}
              onOpenZerodha={() => setIsZerodhaModalOpen(true)}
              isChartTab={activeTab === 'chart'}
              multiChartLayout={multiChartLayout}
              onMultiChartLayoutChange={handleLayoutChange}
            />
          </TabErrorBoundary>

          <TabErrorBoundary tabName="User Access Management">
            <ZerodhaConnectModal
        isOpen={isZerodhaModalOpen}
        onClose={() => setIsZerodhaModalOpen(false)}
        isDark={isDark}
      />

      <UserManagementModal
              isOpen={isUserManagementOpen}
              onClose={() => setIsUserManagementOpen(false)}
              currentUser={authUser}
            />
          </TabErrorBoundary>

        </>
      )}

      {/* Main 3-Column Layout: Left Sidebar (~140px) | Center Chart Workspace (flex: 1) | Right Panel (~150px) */}
      <div style={{ display: 'flex', flex: '1', minHeight: '0', gap: isMobile ? '0' : '8px', padding: isMobile ? '0 2px 48px 2px' : '0 8px 8px 8px', width: '100%', boxSizing: 'border-box', overflow: 'hidden' }}>
        
        {/* LEFT SIDEBAR (~140px fixed): Collapsible tool groups matching media_1790927764907.png */}
        {!isStandalone && (
          <aside 
            style={{ 
              width: isMobile ? '0' : '140px', 
              minWidth: isMobile ? '0' : '140px', 
              maxWidth: isMobile ? '0' : '140px', 
              display: isMobile ? 'none' : 'flex', 
            flexDirection: 'column', 
            background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff', 
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`, 
            borderRadius: '8px', 
            padding: '8px 6px', 
            boxSizing: 'border-box', 
            overflowY: 'auto' 
          }}
        >
          {/* HOME TAB (Prominent Blue Home Pill Matching Screenshot) */}
          <button
            onClick={() => setActiveTab('home')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '7px 10px',
              marginBottom: '8px',
              borderRadius: '6px',
              border: activeTab === 'home' ? '1px solid #38bdf8' : '1px solid transparent',
              background: activeTab === 'home' ? (isDark ? '#0284c7' : '#e0f2fe') : (isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'),
              color: activeTab === 'home' ? '#ffffff' : 'var(--text-primary)',
              fontSize: '11.5px',
              fontWeight: '800',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              width: '100%',
              boxSizing: 'border-box'
            }}
          >
            <span style={{ fontSize: '13px' }}>🏠</span>
            <span>Home</span>
          </button>

          {/* FAVORITES SECTION (Direct access to starred tabs) */}
          <div style={{ marginBottom: '8px', paddingBottom: '6px', borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}` }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '2px 4px' }}>
              <button
                onClick={() => toggleGroup('Favorites')}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  background: 'transparent',
                  border: 'none',
                  color: '#f59e0b',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  textAlign: 'left',
                  flex: 1,
                  padding: 0
                }}
              >
                <span style={{ fontSize: '9px', opacity: 0.7 }}>{openGroups['Favorites'] !== false ? '⌵' : '›'}</span>
                <Star size={11} fill="#f59e0b" strokeWidth={1.5} />
                <span>Favorites</span>
              </button>
              {favoriteTabs.length > 0 && (
                <span style={{ fontSize: '9px', fontWeight: '700', color: '#f59e0b', opacity: 0.85, background: 'rgba(245, 158, 11, 0.15)', padding: '0 4px', borderRadius: '4px' }}>
                  {favoriteTabs.length}
                </span>
              )}
            </div>

            {openGroups['Favorites'] !== false && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px', marginTop: '3px' }}>
                {favoriteTabs.length === 0 ? (
                  <span style={{ fontSize: '10px', color: 'var(--text-secondary)', padding: '3px 4px', fontStyle: 'italic', opacity: 0.75 }}>
                    Star any tab below for quick access
                  </span>
                ) : (
                  favoriteTabs.map(tabId => {
                    const item = ALL_TABS_MAP.get(tabId);
                    if (!item) return null;
                    const isActive = activeTab === tabId;
                    return (
                      <div
                        key={`fav-tab-${tabId}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          width: '100%',
                          borderRadius: '5px',
                          background: isActive ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe') : 'transparent',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <button
                          onClick={() => setActiveTab(tabId)}
                          style={{
                            display: 'block',
                            flex: 1,
                            minWidth: 0,
                            textAlign: 'left',
                            background: 'transparent',
                            color: isActive ? (isDark ? '#38bdf8' : '#0284c7') : 'var(--text-primary)',
                            fontWeight: isActive ? '800' : '500',
                            fontSize: '11px',
                            padding: '3px 6px',
                            borderRadius: '5px',
                            border: 'none',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis'
                          }}
                          title={item.label}
                        >
                          {item.label}
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavoriteTab(tabId);
                          }}
                          title={`Remove "${item.label}" from Favorites`}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            cursor: 'pointer',
                            padding: '2px 4px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: '#f59e0b',
                            flexShrink: 0
                          }}
                        >
                          <Star size={10} fill="#f59e0b" strokeWidth={1.8} />
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* REGULAR SECTIONS with Star Button on each Tab */}
          {TOOL_GROUPS.map((group) => {
            const isOpen = openGroups[group.name] !== false;
            return (
              <div key={group.name} style={{ marginBottom: '6px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '2px 4px'
                  }}
                >
                  <button
                    onClick={() => toggleGroup(group.name)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text-secondary)',
                      fontSize: '11px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      textAlign: 'left',
                      flex: 1,
                      padding: 0
                    }}
                  >
                    <span style={{ fontSize: '9px', opacity: 0.7 }}>{isOpen ? '⌵' : '›'}</span>
                    <span>{group.name}</span>
                  </button>
                </div>

                {isOpen && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '4px', marginTop: '2px' }}>
                    {group.items.map((item) => {
                      const isActive = activeTab === item.id;
                      const isFav = favoriteTabs.includes(item.id);
                      return (
                        <div
                          key={item.id}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            width: '100%',
                            borderRadius: '5px',
                            background: isActive ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe') : 'transparent',
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <button
                            onClick={() => setActiveTab(item.id)}
                            style={{
                              display: 'block',
                              flex: 1,
                              minWidth: 0,
                              textAlign: 'left',
                              background: 'transparent',
                              color: isActive ? (isDark ? '#38bdf8' : '#0284c7') : 'var(--text-primary)',
                              fontWeight: isActive ? '800' : '500',
                              fontSize: '11px',
                              padding: '3px 6px',
                              borderRadius: '5px',
                              border: 'none',
                              cursor: 'pointer',
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis'
                            }}
                            title={item.label}
                          >
                            {item.label}
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleFavoriteTab(item.id);
                            }}
                            title={isFav ? `Remove "${item.label}" from Favorites` : `Add "${item.label}" to Favorites`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              cursor: 'pointer',
                              padding: '2px 4px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: isFav ? '#f59e0b' : (isDark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(0, 0, 0, 0.25)'),
                              opacity: isFav ? 1 : 0.65,
                              transition: 'all 0.15s ease',
                              flexShrink: 0
                            }}
                          >
                            <Star size={10} fill={isFav ? '#f59e0b' : 'transparent'} strokeWidth={1.8} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </aside>
        )}

        {/* CENTER MAIN WORKSPACE: Takes all remaining width and height */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, overflow: 'hidden' }}>
          
          {/* Top Info Line above chart */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: isMobile ? '4px 8px' : '6px 12px',
            background: isDark ? 'rgba(15, 28, 61, 0.7)' : '#ffffff',
            border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.12)' : '#e2e8f0'}`,
            borderRadius: '8px 8px 0 0',
            flexWrap: 'nowrap',
            overflowX: 'auto',
            gap: isMobile ? '6px' : '10px'
          }} className="mobile-tab-scroll">
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '6px' : '8px', flexShrink: 0 }}>
              <span style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '900', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                {symbolDisplayName}
              </span>
              <span style={{ fontSize: isMobile ? '13px' : '15px', fontWeight: '800', color: '#38bdf8', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                {typeof lastPrice === 'number' && !isNaN(lastPrice) ? lastPrice.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '--'}
              </span>
              <span style={{
                fontSize: isMobile ? '11px' : '12px',
                fontWeight: '700',
                color: (priceChange || 0) >= 0 ? '#10b981' : '#ef4444',
                fontFamily: 'monospace',
                whiteSpace: 'nowrap'
              }}>
                {typeof priceChange === 'number' && !isNaN(priceChange) ? `${priceChange >= 0 ? '+' : ''}${priceChange.toFixed(2)}` : '--'} ({typeof priceChangePct === 'number' && !isNaN(priceChangePct) ? `${priceChangePct >= 0 ? '+' : ''}${priceChangePct.toFixed(2)}%` : '--'})
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
              <span className="desktop-only" style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600' }}>Contract:</span>
              <select
                value={symbol}
                onChange={(e) => setSymbol(e.target.value)}
                style={{
                  background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f8fafc',
                  border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.2)' : '#cbd5e1'}`,
                  color: 'var(--text-primary)',
                  fontSize: '11px',
                  fontWeight: '700',
                  padding: '2px 6px',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              >
                {!['NSE:NIFTY', 'NSE:NIFTY1!', 'NSE:BANKNIFTY', 'NSE:BANKNIFTY1!', 'NSE:FINNIFTY', 'NSE:RELIANCE', 'NSE:RELIANCE1!', 'MCX:CRUDEOIL1!', 'BSE:SENSEX'].includes(symbol) && (
                  <option value={symbol}>{symbolDisplayName || symbol}</option>
                )}
                <option value="NSE:NIFTY">NIFTY 50 (Spot)</option>
                <option value="NSE:NIFTY1!">NIFTY FUT (Current Expiry)</option>
                <option value="NSE:BANKNIFTY">BANK NIFTY (Spot)</option>
                <option value="NSE:BANKNIFTY1!">BANK NIFTY FUT</option>
                <option value="NSE:FINNIFTY">FIN NIFTY</option>
                <option value="NSE:RELIANCE">RELIANCE (Spot)</option>
                <option value="NSE:RELIANCE1!">RELIANCE FUT</option>
                <option value="MCX:CRUDEOIL1!">CRUDE OIL FUT</option>
                <option value="BSE:SENSEX">SENSEX</option>
              </select>
            </div>
          </div>

          {/* Active Workspace Component */}
          <div style={{ flex: 1, minHeight: 0, overflow: (activeTab === 'chart' || activeTab === 'testing') ? 'hidden' : 'auto', display: 'flex', flexDirection: 'column' }}>
        {activeTab === 'algo_trade' ? (
          <TabErrorBoundary tabName="Algo Trade">
            <AlgoTradeContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'manual_trades' ? (
          <TabErrorBoundary tabName="Manual Trades">
            <ManualTradesContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'test' ? (
          <TabErrorBoundary tabName="Orderflow Chart">
            <TestContainer
              selectedSymbol={symbol}
              selectedTimeframe={timeframe}
              onSymbolSelect={setSymbol}
              onTimeframeChange={setTimeframe}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'test2' ? (
          <TabErrorBoundary tabName="Test 2">
            <Test2Container
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
        ) : activeTab === 'trial' ? (
          <TabErrorBoundary tabName="Trial">
            <TrialContainer
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
        ) : activeTab === 'nr7_breakout' ? (
          <TabErrorBoundary tabName="20% UC Potential">
            <Nr7BreakoutContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'home' ? (
          <TabErrorBoundary tabName="Home">
            <HomeContainer
              currentSymbol={symbol}
              onSymbolSelect={setSymbol}
              onSwitchTab={(t) => setActiveTab(t as TabType)}
              levelAlert={levelAlert}
              onCloseLevelAlert={handleCloseLevelAlert}
              onResetSetupAlerts={handleResetSetupAlerts}
              levelAlertsMuted={levelAlertsMuted}
              onToggleAlertsMuted={() => setLevelAlertsMuted(!levelAlertsMuted)}
              levelAlertsFiredCount={levelAlertsFiredCount}
            />
          </TabErrorBoundary>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, minWidth: 0, height: '100%', width: '100%', overflow: 'hidden' }}>
            <TabErrorBoundary tabName="Candlestick Chart">
              <MultiChartContainer
                currentSymbol={symbol}
                currentTimeframe={timeframe}
                layout={multiChartLayout}
                onLayoutChange={handleLayoutChange}
                onActiveSymbolChange={(newSym) => setSymbol(newSym)}
                onActiveTimeframeChange={(newTf) => setTimeframe(newTf)}
                levelAlert={levelAlert}
                onCloseLevelAlert={handleCloseLevelAlert}
                onResetSetupAlerts={handleResetSetupAlerts}
                levelAlertsMuted={levelAlertsMuted}
                onToggleAlertsMuted={() => setLevelAlertsMuted(!levelAlertsMuted)}
                levelAlertsFiredCount={levelAlertsFiredCount}
              />
            </TabErrorBoundary>
          </div>
        )}
          </div>
        </main>

        {/* RIGHT PANEL (~160px): Futures / Stocks / MCX / Indices Watchlist */}
        <aside 
          style={{ 
            width: isMobile ? '0' : '160px', 
            minWidth: isMobile ? '0' : '160px', 
            maxWidth: isMobile ? '0' : '160px', 
            display: isMobile ? 'none' : 'flex', 
            flexDirection: 'column', 
            gap: '8px', 
            background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff', 
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`, 
            borderRadius: '8px', 
            padding: '8px 6px', 
            boxSizing: 'border-box' 
          }}
        >
          {/* Category Tabs: Futures / Stocks / MCX / Indices in 2x2 grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', borderRadius: '6px', padding: '3px', background: isDark ? 'rgba(0, 0, 0, 0.25)' : '#f1f5f9' }}>
            {(['Futures', 'Stocks', 'MCX', 'Indices'] as const).map((cat) => (
              <button
                key={cat}
                onClick={() => setWatchlistCategory(cat)}
                style={{
                  padding: '5px 2px',
                  fontSize: '10px',
                  fontWeight: '800',
                  borderRadius: '4px',
                  border: 'none',
                  background: watchlistCategory === cat ? (isDark ? '#0284c7' : '#e0f2fe') : 'transparent',
                  color: watchlistCategory === cat ? (isDark ? '#ffffff' : '#0284c7') : 'var(--text-secondary)',
                  cursor: 'pointer',
                  textAlign: 'center'
                }}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Quick Search Filter */}
          <input
            type="text"
            placeholder={`🔍 Search ${watchlistCategory}...`}
            value={watchlistSearch}
            onChange={(e) => setWatchlistSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '4px 6px',
              fontSize: '10px',
              borderRadius: '4px',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
              background: isDark ? 'rgba(0, 0, 0, 0.25)' : '#f8fafc',
              color: 'var(--text-primary)',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />

          {/* Instrument List */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflowY: 'auto', flex: 1 }}>
            {filteredWatchlist.length === 0 ? (
              <div style={{ fontSize: '10px', color: 'var(--text-secondary)', textAlign: 'center', padding: '12px 4px', fontStyle: 'italic' }}>
                No matching {watchlistCategory} found
              </div>
            ) : (
              filteredWatchlist.map((item) => {
              const isSelected = symbol === item.symbol;
              return (
                <div
                  key={item.symbol}
                  onClick={() => setSymbol(item.symbol)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '5px 6px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    background: isSelected ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe') : 'transparent',
                    border: isSelected ? `1px solid ${isDark ? '#38bdf8' : '#0284c7'}` : '1px solid transparent',
                    transition: 'all 0.15s ease'
                  }}
                  title={item.name}
                >
                  <span style={{ fontSize: '10.5px', fontWeight: isSelected ? '800' : '600', color: isSelected ? (isDark ? '#38bdf8' : '#0284c7') : 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {item.name}
                  </span>
                  <span style={{ fontSize: '10px', fontWeight: '700', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                    {item.price ? item.price.toLocaleString('en-IN') : '--'}
                  </span>
                </div>
              );
            }))}
          </div>
        </aside>

      </div>

      {/* Mobile Bottom Navigation & Slide-Up Drawer (< 768px) */}
      {isMobile && (
        <>
          <nav style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            background: isDark ? 'rgba(8, 13, 26, 0.96)' : '#ffffff',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderTop: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.2)' : '#e2e8f0'}`,
            padding: '4px 6px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-around',
            zIndex: 1000,
            boxShadow: isDark ? '0 -4px 20px rgba(0,0,0,0.6)' : '0 -2px 10px rgba(0,0,0,0.06)',
            boxSizing: 'border-box'
          }}>
            {[
              { id: 'home', label: 'Home', icon: '🏠' },
              { id: 'chart', label: 'Chart', icon: '📈' },
              { id: 'pro_market_profile', label: 'Pro TPO', icon: '🏛️' },
              { id: 'footprint_chart', label: 'Footprint', icon: '👣' },
              { id: 'scanner', label: 'Scanner', icon: '🔍' },
              { id: 'menu', label: 'More Tools', icon: '☰' },
            ].map((item) => {
              const isActive = item.id === 'menu' ? isMobileMenuOpen : activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'menu') {
                      setIsMobileMenuOpen(!isMobileMenuOpen);
                    } else {
                      setActiveTab(item.id as TabType);
                      setIsMobileMenuOpen(false);
                    }
                  }}
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '2px',
                    padding: '5px 2px',
                    background: isActive ? (isDark ? 'rgba(56, 189, 248, 0.16)' : '#e0f2fe') : 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    color: isActive ? '#38bdf8' : (isDark ? '#94a3b8' : '#64748b'),
                    cursor: 'pointer',
                    minHeight: '44px',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <span style={{ fontSize: '16px', lineHeight: 1 }}>{item.icon}</span>
                  <span style={{ fontSize: '10px', fontWeight: isActive ? '800' : '600', letterSpacing: '0.2px' }}>
                    {item.label}
                  </span>
                </button>
              );
            })}
          </nav>

          {/* Mobile All-In-One Slide-Up Drawer */}
          {(isMobileMenuOpen || isWatchlistDrawerOpen) && (
            <div 
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsWatchlistDrawerOpen(false);
              }}
              style={{
                position: 'fixed',
                inset: 0,
                background: 'rgba(0,0,0,0.65)',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-end',
                backdropFilter: 'blur(4px)',
                WebkitBackdropFilter: 'blur(4px)'
              }}
            >
              <div 
                onClick={(e) => e.stopPropagation()}
                style={{
                  background: isDark ? '#0b1329' : '#ffffff',
                  borderTop: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.3)' : '#cbd5e1'}`,
                  borderTopLeftRadius: '16px',
                  borderTopRightRadius: '16px',
                  padding: '14px 16px',
                  maxHeight: '75vh',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  boxShadow: '0 -10px 40px rgba(0,0,0,0.7)'
                }}
              >
                {/* Header with Switchable Tabs */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', gap: '4px', background: isDark ? 'rgba(0,0,0,0.3)' : '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                    {(['watchlist', 'favorites', 'tools'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setMobileMenuTab(t)}
                        style={{
                          background: mobileMenuTab === t ? (isDark ? '#0284c7' : '#e0f2fe') : 'transparent',
                          color: mobileMenuTab === t ? (isDark ? '#ffffff' : '#0284c7') : 'var(--text-secondary)',
                          border: 'none',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          fontWeight: '800',
                          cursor: 'pointer',
                          textTransform: 'capitalize'
                        }}
                      >
                        {t === 'watchlist' ? '📋 Watchlist' : t === 'favorites' ? '⭐ Favorites' : '🛠️ All Tools'}
                      </button>
                    ))}
                  </div>

                  <button 
                    onClick={() => {
                      setIsMobileMenuOpen(false);
                      setIsWatchlistDrawerOpen(false);
                    }}
                    style={{ background: 'rgba(255,255,255,0.06)', border: 'none', color: 'var(--text-secondary)', width: '28px', height: '28px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px' }}
                  >
                    ✕
                  </button>
                </div>

                {/* Tab Content 1: Watchlist */}
                {mobileMenuTab === 'watchlist' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto' }}>
                    <div style={{ display: 'flex', borderRadius: '6px', padding: '2px', background: isDark ? 'rgba(0, 0, 0, 0.25)' : '#f1f5f9' }}>
                      {(['Futures', 'Stocks', 'MCX', 'Indices'] as const).map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setWatchlistCategory(cat)}
                          style={{
                            flex: 1,
                            padding: '5px 0',
                            fontSize: '11px',
                            fontWeight: '800',
                            borderRadius: '4px',
                            border: 'none',
                            background: watchlistCategory === cat ? (isDark ? '#0284c7' : '#e0f2fe') : 'transparent',
                            color: watchlistCategory === cat ? (isDark ? '#ffffff' : '#0284c7') : 'var(--text-secondary)',
                            cursor: 'pointer'
                          }}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>

                    <input
                      type="text"
                      placeholder={`🔍 Search ${watchlistCategory}...`}
                      value={watchlistSearch}
                      onChange={(e) => setWatchlistSearch(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '7px 12px',
                        fontSize: '12px',
                        borderRadius: '6px',
                        border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.2)' : '#cbd5e1'}`,
                        background: isDark ? 'rgba(15, 28, 61, 0.5)' : '#f8fafc',
                        color: 'var(--text-primary)',
                        outline: 'none',
                        boxSizing: 'border-box'
                      }}
                    />

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '35vh', overflowY: 'auto' }}>
                      {filteredWatchlist.length === 0 ? (
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0', fontStyle: 'italic' }}>
                          No matching {watchlistCategory} found
                        </div>
                      ) : (
                        filteredWatchlist.map((item) => (
                          <div
                            key={item.symbol}
                            onClick={() => {
                              setSymbol(item.symbol);
                              setIsMobileMenuOpen(false);
                              setIsWatchlistDrawerOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '9px 12px',
                              borderRadius: '6px',
                              background: symbol === item.symbol ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe') : 'transparent',
                              cursor: 'pointer'
                            }}
                          >
                            <span style={{ fontSize: '12.5px', fontWeight: '700', color: 'var(--text-primary)' }}>{item.name}</span>
                            <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#38bdf8', fontWeight: '700' }}>₹{item.price}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab Content 2: Favorites */}
                {mobileMenuTab === 'favorites' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '42vh', overflowY: 'auto' }}>
                    {favoriteTabs.length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textAlign: 'center', padding: '24px 0', fontStyle: 'italic' }}>
                        No favorite tabs saved yet. Click the star ⭐ next to any tool to add it here.
                      </div>
                    ) : (
                      favoriteTabs.map(tabId => {
                        const item = ALL_TABS_MAP.get(tabId);
                        if (!item) return null;
                        const isActive = activeTab === item.id;
                        return (
                          <div
                            key={`fav-drawer-${item.id}`}
                            onClick={() => {
                              setActiveTab(item.id);
                              setIsMobileMenuOpen(false);
                              setIsWatchlistDrawerOpen(false);
                            }}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '10px 14px',
                              borderRadius: '8px',
                              background: isActive ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe') : 'rgba(255,255,255,0.03)',
                              cursor: 'pointer',
                              border: `1px solid ${isActive ? 'rgba(56, 189, 248, 0.4)' : 'transparent'}`
                            }}
                          >
                            <span style={{ fontSize: '13px', fontWeight: '700', color: isActive ? '#38bdf8' : 'var(--text-primary)' }}>
                              ⭐ {item.label}
                            </span>
                            <span style={{ fontSize: '11px', color: '#f59e0b', fontWeight: '800' }}>FAVORITE</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Tab Content 3: All Tools */}
                {mobileMenuTab === 'tools' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '45vh', overflowY: 'auto' }}>
                    {TOOL_GROUPS.map(g => (
                      <div key={`tool-grp-${g.name}`}>
                        <div style={{ fontSize: '11px', fontWeight: '800', color: '#60a5fa', textTransform: 'uppercase', marginBottom: '4px', letterSpacing: '0.5px' }}>
                          {g.name}
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                          {g.items.map(item => {
                            const isActive = activeTab === item.id;
                            return (
                              <button
                                key={`drawer-tool-${item.id}`}
                                onClick={() => {
                                  setActiveTab(item.id);
                                  setIsMobileMenuOpen(false);
                                  setIsWatchlistDrawerOpen(false);
                                }}
                                style={{
                                  display: 'flex',
                                  alignItems: 'center',
                                  gap: '6px',
                                  padding: '8px 10px',
                                  borderRadius: '6px',
                                  background: isActive ? (isDark ? 'rgba(56, 189, 248, 0.25)' : '#e0f2fe') : (isDark ? 'rgba(15, 28, 61, 0.5)' : '#f8fafc'),
                                  border: `1px solid ${isActive ? '#38bdf8' : 'rgba(255,255,255,0.05)'}`,
                                  color: isActive ? '#38bdf8' : 'var(--text-primary)',
                                  fontSize: '11px',
                                  fontWeight: '700',
                                  cursor: 'pointer',
                                  textAlign: 'left',
                                  whiteSpace: 'nowrap',
                                  overflow: 'hidden',
                                  textOverflow: 'ellipsis'
                                }}
                              >
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}

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
