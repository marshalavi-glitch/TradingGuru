import { useState, useEffect, useMemo, useRef } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { ChartContainer } from './components/ChartContainer';
import { tvStreamer, getBackendHttpUrl } from './utils/tvStreamer';
import type { Candle } from './utils/profileCalculator';
import { calculateMatrixSeriesData } from './utils/matrixCalculator';
import { AlertCircle, Loader2, Layers, Zap, X } from 'lucide-react';
import { TabErrorBoundary } from './components/TabErrorBoundary';
import { ScannerContainer } from './components/ScannerContainer';
import { OptionsChain } from './components/OptionsChain';
import { SignalsContainer } from './components/SignalsContainer';
import { DojiContainer } from './components/DojiContainer';
import { VolumeContainer } from './components/VolumeContainer';
import { OpeningBiasContainer } from './components/OpeningBiasContainer';
import { ConfluencesContainer } from './components/ConfluencesContainer';
import { EarlyPicksContainer } from './components/EarlyPicksContainer';
import { BhaicharaWorkContainer } from './components/BhaicharaWorkContainer';
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
import { TrumpMoodContainer } from './components/TrumpMoodContainer';
import { FootprintChartContainer } from './components/FootprintChartContainer';
import { CasPredictionContainer } from './components/CasPredictionContainer';
import { VsaContainer } from './components/VsaContainer';
import { HighBetaTradesContainer } from './components/HighBetaTradesContainer';
import { ManualTradesContainer } from './components/ManualTradesContainer';

export type TabType = 
  | 'chart' | 'bhaichara' | 'dada_thoughts' | 'trump_mood' | 'fifteen_min' 
  | 'scanner' | 'options' | 'signals' | 'doji' | 'doji_novol' | 'volume' 
  | 'opening_bias' | 'hourly_updates' | 'backtest_results' | 'confluences' 
  | 'early_picks' | 'nr7_breakout' | 'order_flow' | 'order_flow_footprint' 
  | 'cvd_adv' | 'heatmap' | 'market_profile' | 'pro_market_profile' | 'footprint_chart' | 'cas_prediction' | 'vsa' | 'high_beta' | 'manual_trades';

interface TabItem {
  id: TabType;
  label: string;
  color: string;
  badge?: string;
}

const TABS_LIST: TabItem[] = [
  { id: 'bhaichara', label: '🤝 Bhaichara Work', color: '#60a5fa' },
  { id: 'manual_trades', label: '📝 Manual Trades', color: '#10b981' },
  { id: 'high_beta', label: '🚀 High Beta Trades', color: '#f97316' },
  { id: 'dada_thoughts', label: '🧠 Dada Thoughts', color: '#eab308' },
  { id: 'trump_mood', label: '🎺 Trump Mood', color: '#f87171' },
  { id: 'cas_prediction', label: '🎯 CAS Prediction', color: '#00f0ff' },
  { id: 'vsa', label: '📊 Volume Spread (VSA)', color: '#a855f7' },
  { id: 'chart', label: '📈 Candlestick Chart', color: '#3b82f6' },
  { id: 'footprint_chart', label: '👣 Footprint Chart', color: '#34d399' },
  { id: 'market_profile', label: '🏛️ Market Profile', color: '#00f0ff' },
  { id: 'pro_market_profile', label: '🏛️ Pro TPO Profile', color: '#60a5fa' },
  { id: 'order_flow', label: '🍀 Lucky Flow', color: '#10b981' },
  { id: 'order_flow_footprint', label: '📊 Order Flow', color: '#60a5fa' },
  { id: 'cvd_adv', label: '📊 CVD / ADV', color: '#60a5fa' },
  { id: 'heatmap', label: '🔥 Heat Map', color: '#f87171' },
  { id: 'scanner', label: '🔍 Scanner', color: '#3b82f6' },
  { id: 'confluences', label: '⚡ Confluences', color: '#3b82f6' },
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
  { id: 'nr7_breakout', label: '🚀 20% Upper Circuit Potential', color: '#f59e0b' },
];

function App() {
  const [symbol, setSymbol] = useState('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState('5'); // Default 5-minute interval
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [matrixHistory, setMatrixHistory] = useState<Record<string, any> | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('bhaichara');

  const activeTabRef = useRef<HTMLButtonElement | null>(null);

  const [liveTradeAlert, setLiveTradeAlert] = useState<{ trade: any; timestamp: number } | null>(null);

  // Melodic Chime + Natural Female AI Voice Speech Synthesizer
  const announceLiveTradeAlert = (trade: any) => {
    // 1. Melodic Chime
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
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

        const tradeTypeClean = (trade.tradeType || 'Call Buy').replace('BUY', 'Buy').replace('SHORT', 'Short').replace('LONG', 'Long');
        const nameClean = trade.displayName || 'Contract';
        const entryClean = Number(trade.entryPrice || 0).toFixed(2);
        const slClean = Number(trade.stopLoss || 0).toFixed(2);
        const t1Clean = Number(trade.target1 || 0).toFixed(2);
        const t2Clean = Number(trade.target2 || 0).toFixed(2);
        const t3Clean = Number(trade.target3 || 0).toFixed(2);

        const speechText = `Attention traders! New trade alert: ${tradeTypeClean} ${nameClean} at ${entryClean} rupees. Stop Loss ${slClean}. Targets ${t1Clean}, ${t2Clean}, and ${t3Clean}.`;

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
          utterance.pitch = 1.25; // Crisp female voice pitch
          utterance.volume = 1.0;

          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) {
          setTimeout(selectAndSpeak, 150);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            setTimeout(selectAndSpeak, 150);
          };
        }
      } catch (e) {
        console.warn('Speech synthesis error:', e);
      }
    }, 300);
  };

  // Subscribe to real-time manual trade WebSocket alert broadcasts
  useEffect(() => {
    tvStreamer.setManualTradeAddedListener((trade) => {
      announceLiveTradeAlert(trade);
      setLiveTradeAlert({ trade, timestamp: Date.now() });
    });
  }, []);

  // Auto dismiss alert toast after 9 seconds
  useEffect(() => {
    if (liveTradeAlert) {
      const timer = setTimeout(() => {
        setLiveTradeAlert(null);
      }, 12000);
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
              return data.candles;
            } else {
              const tick = data.candles[0];
              const index = prevCandles.findIndex((c) => c.time === tick.time);
              if (index !== -1) {
                const updated = [...prevCandles];
                updated[index] = tick;
                return updated;
              } else {
                return [...prevCandles, tick];
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
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
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

  const activeTabInfo = TABS_LIST.find((t) => t.id === activeTab) || TABS_LIST[0];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%', minHeight: '100vh', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* Responsive Header */}
      <DashboardHeader
        currentSymbol={symbol}
        currentTimeframe={timeframe}
        connectionStatus={connectionStatus}
        onSymbolChange={setSymbol}
        onTimeframeChange={setTimeframe}
        onRefresh={handleRefresh}
      />

      {/* Navigation Controls Bar (Mobile Quick Select + Touch Scroll Tab List) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.08)', paddingBottom: '4px', width: '100%', boxSizing: 'border-box' }}>
        
        {/* Mobile Quick Dropdown Selector (Instant 1-tap jump to any tab) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(30, 41, 59, 0.8)', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px', borderRadius: '6px', shrink: 0 }}>
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
              maxWidth: '130px'
            }}
          >
            {TABS_LIST.map((tab) => (
              <option key={tab.id} value={tab.id} style={{ backgroundColor: '#0f172a', color: '#ffffff' }}>
                {tab.label}
              </option>
            ))}
          </select>
        </div>

        {/* Horizontally Scrollable Touch Tab Bar */}
        <div className="mobile-tab-scroll" style={{ flex: 1 }}>
          {TABS_LIST.map((tab) => {
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
                  color: isActive ? tab.color : 'var(--text-primary)',
                  padding: '4px 10px',
                  fontSize: '12px',
                  fontWeight: isActive ? '800' : '600',
                  cursor: 'pointer',
                  borderTopLeftRadius: '5px',
                  borderTopRightRadius: '5px',
                  transition: 'all 0.15s',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

      </div>

      {/* Main Workspace */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
        {activeTab === 'manual_trades' ? (
          <TabErrorBoundary tabName="Manual Trades">
            <ManualTradesContainer />
          </TabErrorBoundary>
        ) : activeTab === 'high_beta' ? (
          <TabErrorBoundary tabName="High Beta Trades">
            <HighBetaTradesContainer />
          </TabErrorBoundary>
        ) : activeTab === 'vsa' ? (
          <TabErrorBoundary tabName="Volume Spread (VSA)">
            <VsaContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'cas_prediction' ? (
          <TabErrorBoundary tabName="CAS Prediction">
            <CasPredictionContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'footprint_chart' ? (
          <TabErrorBoundary tabName="Footprint Chart">
            <FootprintChartContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'market_profile' ? (
          <TabErrorBoundary tabName="Market Profile">
            <MarketProfileContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'pro_market_profile' ? (
          <TabErrorBoundary tabName="Pro TPO Profile">
            <ProMarketProfileContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
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
        ) : activeTab === 'bhaichara' ? (
          <TabErrorBoundary tabName="Bhaichara Work">
            <BhaicharaWorkContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'dada_thoughts' ? (
          <TabErrorBoundary tabName="Dada Thoughts">
            <DadaThoughtsContainer
              onSymbolSelect={setSymbol}
              onSwitchToChart={() => setActiveTab('chart')}
            />
          </TabErrorBoundary>
        ) : activeTab === 'trump_mood' ? (
          <TabErrorBoundary tabName="Trump Mood">
            <TrumpMoodContainer
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
        ) : activeTab === 'confluences' ? (
          <TabErrorBoundary tabName="Confluences">
            <ConfluencesContainer 
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
          <TabErrorBoundary tabName="20% Upper Circuit Potential">
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
                <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Connecting to TradingView WebSocket & streaming data...</p>
              </div>
            ) : (
              <div style={{ flex: '1', display: 'flex', minHeight: '0' }}>
                <TabErrorBoundary tabName="Candlestick Chart">
                  <ChartContainer
                    candles={candles}
                    symbol={symbol}
                    timeframe={timeframe}
                    matrixSeriesData={matrixSeriesData}
                  />
                </TabErrorBoundary>
              </div>
            )}
          </>
        )}
      </div>

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
