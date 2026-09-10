import { useState, useEffect, useMemo } from 'react';
import { DashboardHeader } from './components/DashboardHeader';
import { ChartContainer } from './components/ChartContainer';
import { tvStreamer } from './utils/tvStreamer';
import type { Candle } from './utils/profileCalculator';
import { calculateMatrixSeriesData } from './utils/matrixCalculator';
import { AlertCircle, Loader2 } from 'lucide-react';
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

function App() {
  const [symbol, setSymbol] = useState('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState('30'); // Default to 30-minute interval
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [matrixHistory, setMatrixHistory] = useState<Record<string, any> | null>(null);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'chart' | 'bhaichara' | 'dada_thoughts' | 'fifteen_min' | 'scanner' | 'options' | 'signals' | 'doji' | 'doji_novol' | 'volume' | 'opening_bias' | 'hourly_updates' | 'backtest_results' | 'confluences' | 'early_picks'>('fifteen_min');

  // Subscribe to symbol data via TradingView WebSocket
  useEffect(() => {
    setLoading(true);
    setError(null);
    setCandles([]);
    setMatrixHistory(null);

    tvStreamer.setStatusListener((status) => {
      setConnectionStatus(status);
    });

    // Start streaming from TV WebSocket backend
    tvStreamer.subscribe(
      symbol,
      timeframe,
      (data) => {
        setLoading(false);
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
        setLoading(false);
        setError(err);
      }
    );

    return () => {
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
      
      candles.forEach(c => {
        const date = new Date(c.time * 1000);
        let key = '';
        if (isDailyAnchor) {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        } else {
          key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }
        
        const levels = matrixHistory[key];
        if (levels) {
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
        }
      });
      return seriesData;
    }
    return calculateMatrixSeriesData(candles, timeframe);
  }, [candles, timeframe, matrixHistory]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', minHeight: '100vh', boxSizing: 'border-box', overflowY: 'auto' }}>
      
      {/* Header controls */}
      <DashboardHeader
        currentSymbol={symbol}
        currentTimeframe={timeframe}
        connectionStatus={connectionStatus}
        onSymbolChange={setSymbol}
        onTimeframeChange={setTimeframe}
        onRefresh={handleRefresh}
      />

      {/* Navigation Tabs */}
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '2px', flexWrap: 'wrap' }}>
        <button
          onClick={() => setActiveTab('bhaichara')}
          style={{
            background: activeTab === 'bhaichara' ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'bhaichara' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'bhaichara' ? '#60a5fa' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🤝 Bhaichara Work
        </button>
        <button
          onClick={() => setActiveTab('dada_thoughts')}
          style={{
            background: activeTab === 'dada_thoughts' ? 'rgba(234, 179, 8, 0.15)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'dada_thoughts' ? '2px solid #eab308' : '2px solid transparent',
            color: activeTab === 'dada_thoughts' ? '#eab308' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🧠 Dada Thoughts
        </button>
        <button
          onClick={() => setActiveTab('chart')}
          style={{
            background: activeTab === 'chart' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'chart' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'chart' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          Candlestick Chart
        </button>
        <button
          onClick={() => setActiveTab('scanner')}
          style={{
            background: activeTab === 'scanner' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'scanner' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'scanner' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          Scanner
        </button>
        <button
          onClick={() => setActiveTab('confluences')}
          style={{
            background: activeTab === 'confluences' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'confluences' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'confluences' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          Confluences
        </button>
        <button
          onClick={() => setActiveTab('options')}
          style={{
            background: activeTab === 'options' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'options' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'options' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          Options Chain
        </button>
        <button
          onClick={() => setActiveTab('signals')}
          style={{
            background: activeTab === 'signals' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'signals' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'signals' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          Live Signals
        </button>
        <button
          onClick={() => setActiveTab('doji')}
          style={{
            background: activeTab === 'doji' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'doji' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'doji' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          First Doji
        </button>
        <button
          onClick={() => setActiveTab('doji_novol')}
          style={{
            background: activeTab === 'doji_novol' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'doji_novol' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'doji_novol' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          Doji (No Vol)
        </button>
        <button
          onClick={() => setActiveTab('volume')}
          style={{
            background: activeTab === 'volume' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'volume' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'volume' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          🔥 Volume Breakouts
        </button>
        <button
          onClick={() => setActiveTab('opening_bias')}
          style={{
            background: activeTab === 'opening_bias' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'opening_bias' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'opening_bias' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          ⚡ Opening Bias
        </button>
        <button
          onClick={() => setActiveTab('fifteen_min')}
          style={{
            background: activeTab === 'fifteen_min' ? 'rgba(59, 130, 246, 0.22)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'fifteen_min' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'fifteen_min' ? '#60a5fa' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⏱️ 15 Mins
        </button>
        <button
          onClick={() => setActiveTab('hourly_updates')}
          style={{
            background: activeTab === 'hourly_updates' ? 'rgba(168, 85, 247, 0.15)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'hourly_updates' ? '2px solid #a855f7' : '2px solid transparent',
            color: activeTab === 'hourly_updates' ? '#a855f7' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '700',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          ⏱️ Hourly Updates
        </button>
        <button
          onClick={() => setActiveTab('backtest_results')}
          style={{
            background: activeTab === 'backtest_results' ? 'rgba(239, 68, 68, 0.18)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'backtest_results' ? '2px solid #ef4444' : '2px solid transparent',
            color: activeTab === 'backtest_results' ? '#f87171' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '800',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s',
            display: 'flex',
            alignItems: 'center',
            gap: '6px'
          }}
        >
          🎯 Live Math Signals
        </button>
        <button
          onClick={() => setActiveTab('early_picks')}
          style={{
            background: activeTab === 'early_picks' ? 'rgba(59, 130, 246, 0.12)' : 'transparent',
            border: 'none',
            borderBottom: activeTab === 'early_picks' ? '2px solid #3b82f6' : '2px solid transparent',
            color: activeTab === 'early_picks' ? '#3b82f6' : 'var(--text-primary)',
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            borderTopLeftRadius: '6px',
            borderTopRightRadius: '6px',
            transition: 'all 0.15s'
          }}
        >
          ⚡ Early Picks
        </button>
      </div>

      {/* Main Workspace */}
      <div style={{ flex: '1', display: 'flex', flexDirection: 'column', minHeight: '0' }}>
        {activeTab === 'fifteen_min' ? (
          <FifteenMinForensicContainer />
        ) : activeTab === 'bhaichara' ? (
          <BhaicharaWorkContainer
            onSymbolSelect={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
          />
        ) : activeTab === 'dada_thoughts' ? (
          <DadaThoughtsContainer
            onSymbolSelect={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
          />
        ) : activeTab === 'hourly_updates' ? (
          <HourlyUpdatesContainer />
        ) : activeTab === 'backtest_results' ? (
          <BacktestResultsContainer />
        ) : activeTab === 'scanner' ? (
          <ScannerContainer 
            onSymbolSelect={setSymbol} 
            onSwitchToChart={() => setActiveTab('chart')} 
          />
        ) : activeTab === 'confluences' ? (
          <ConfluencesContainer 
            onSymbolSelect={setSymbol} 
            onSwitchToChart={() => setActiveTab('chart')} 
          />
        ) : activeTab === 'options' ? (
          <OptionsChain
            currentSymbol={symbol}
            onSymbolChange={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
          />
        ) : activeTab === 'signals' ? (
          <SignalsContainer
            onSymbolSelect={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
          />
        ) : activeTab === 'doji' ? (
          <DojiContainer
            onSymbolSelect={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
          />
        ) : activeTab === 'doji_novol' ? (
          <DojiContainer
            onSymbolSelect={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
            noVolumeFilter={true}
          />
        ) : activeTab === 'volume' ? (
          <VolumeContainer
            onSymbolSelect={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
          />
        ) : activeTab === 'opening_bias' ? (
          <OpeningBiasContainer />
        ) : activeTab === 'early_picks' ? (
          <EarlyPicksContainer
            onSymbolSelect={setSymbol}
            onSwitchToChart={() => setActiveTab('chart')}
          />
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
                <ChartContainer
                  candles={candles}
                  symbol={symbol}
                  timeframe={timeframe}
                  matrixSeriesData={matrixSeriesData}
                />
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
