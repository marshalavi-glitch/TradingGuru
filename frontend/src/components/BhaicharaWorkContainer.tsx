import React, { useState, useEffect, useRef } from 'react';
import { 
  Award, 
  RefreshCw,
  TrendingUp,
  Flame,
  ShieldAlert,
  Compass,
  Layers,
  Sparkles,
  Zap,
  Target,
  Volume2,
  VolumeX,
  BellRing
} from 'lucide-react';

interface ConfluenceAlert {
  id: string;
  type: string;
  symbol: string;
  confidence: number;
  probability: string;
  title: string;
  description: string;
  action: string;
}

interface BhaicharaData {
  timestamp: string;
  nifty: any;
  banknifty: any;
  topStockPicks: any[];
  confluenceAlerts: ConfluenceAlert[];
}

interface BhaicharaWorkProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

// Function to synthesize an institutional chime using Web Audio API
function playInstitutionalAlertSound(isBullish: boolean) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    
    // Play a two-tone melodic chime
    const now = ctx.currentTime;
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'sine';

    if (isBullish) {
      // Ascending Chime for Bullish CE Breakout (523.25Hz C5 -> 659.25Hz E5 -> 783.99Hz G5)
      osc1.frequency.setValueAtTime(523.25, now);
      osc1.frequency.exponentialRampToValueAtTime(783.99, now + 0.3);
      osc2.frequency.setValueAtTime(659.25, now);
      osc2.frequency.exponentialRampToValueAtTime(1046.50, now + 0.3);
    } else {
      // Descending Chime for Bearish PE Breakdown (659.25Hz E5 -> 523.25Hz C5 -> 392.00Hz G4)
      osc1.frequency.setValueAtTime(659.25, now);
      osc1.frequency.exponentialRampToValueAtTime(392.00, now + 0.3);
      osc2.frequency.setValueAtTime(523.25, now);
      osc2.frequency.exponentialRampToValueAtTime(261.63, now + 0.3);
    }

    gain.gain.setValueAtTime(0.3, now);
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);

    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
    osc1.stop(now + 0.6);
    osc2.stop(now + 0.6);
  } catch (e) {
    console.warn('Audio context blocked until user interacts:', e);
  }
}

export const BhaicharaWorkContainer: React.FC<BhaicharaWorkProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [data, setData] = useState<BhaicharaData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [selectedAsset, setSelectedAsset] = useState<'NIFTY' | 'BANKNIFTY' | 'STOCKS'>('NIFTY');
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  
  // Track previous skew state to alert only on threshold crossover
  const prevSkewRef = useRef<{ nifty: number; banknifty: number }>({ nifty: 0, banknifty: 0 });

  useEffect(() => {
    let isMounted = true;
    const fetchBhaicharaData = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        
        const [biasRes, picksRes, confluenceRes] = await Promise.all([
          fetch(`${backendUrl}/api/scanner/opening-bias`).catch(() => null),
          fetch(`${backendUrl}/api/scanner/early-picks?threshold=0.5`).catch(() => null),
          fetch(`${backendUrl}/api/scanner/confluence`).catch(() => null)
        ]);

        let biasData: any = {};
        let picksData: any = {};
        let confluenceData: any = { alerts: [] };

        if (biasRes && biasRes.ok) {
          biasData = await biasRes.json().catch(() => ({}));
        }
        if (picksRes && picksRes.ok) {
          picksData = await picksRes.json().catch(() => ({}));
        }
        if (confluenceRes && confluenceRes.ok) {
          confluenceData = await confluenceRes.json().catch(() => ({ alerts: [] }));
        }

        if (isMounted) {
          const currentNiftySkew = biasData?.nifty?.straddleSkew?.skewSpreadPct || 0;
          const currentBankSkew = biasData?.banknifty?.straddleSkew?.skewSpreadPct || 0;

          // Check if Skew just crossed above +15% or below -15%
          if (soundEnabled) {
            const niftyCrossedBull = currentNiftySkew > 15.0 && prevSkewRef.current.nifty <= 15.0;
            const niftyCrossedBear = currentNiftySkew < -15.0 && prevSkewRef.current.nifty >= -15.0;
            const bankCrossedBull = currentBankSkew > 15.0 && prevSkewRef.current.banknifty <= 15.0;
            const bankCrossedBear = currentBankSkew < -15.0 && prevSkewRef.current.banknifty >= -15.0;

            if (niftyCrossedBull || bankCrossedBull) {
              playInstitutionalAlertSound(true);
            } else if (niftyCrossedBear || bankCrossedBear) {
              playInstitutionalAlertSound(false);
            }
          }

          prevSkewRef.current = { nifty: currentNiftySkew, banknifty: currentBankSkew };

          setData({
            timestamp: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }),
            nifty: biasData.nifty || {
              symbol: 'NIFTY',
              currentPrice: 24565,
              openPrice: 24580,
              biasDirective: 'HOLD & MONITOR',
              biasRationale: 'Market initializing session.',
              straddleSkew: {
                biasState: 'EQUILIBRIUM',
                skewSpreadPct: 0,
                bigTraderAction: 'Open Auction Formation',
                atmStraddlePrice: 280,
                gammaRatio: 1.0,
                recommendedOption: 'ATM CE / PE on Range Break'
              }
            },
            banknifty: biasData.banknifty || {
              symbol: 'BANKNIFTY',
              currentPrice: 57740,
              openPrice: 57750,
              biasDirective: 'HOLD & MONITOR',
              biasRationale: 'Market initializing session.',
              straddleSkew: {
                biasState: 'EQUILIBRIUM',
                skewSpreadPct: 0,
                bigTraderAction: 'Open Auction Formation',
                atmStraddlePrice: 650,
                gammaRatio: 1.0,
                recommendedOption: 'ATM CE / PE on Range Break'
              }
            },
            topStockPicks: picksData.picks || [],
            confluenceAlerts: confluenceData.alerts || []
          });
          setLoading(false);
        }
      } catch (err) {
        console.error('Failed to fetch Bhaichara Work data:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchBhaicharaData();
    const interval = setInterval(fetchBhaicharaData, 2000); // Ultra-fast 2-second real-time skew polling
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey, soundEnabled]);

  const handleStockClick = (symbol: string) => {
    onSymbolSelect(symbol);
    onSwitchToChart();
  };

  if (loading && !data) {
    return (
      <div className="glass-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '500px', gap: '16px' }}>
        <RefreshCw className="animate-spin" size={36} color="#3b82f6" />
        <span style={{ fontSize: '15px', color: 'var(--text-secondary)' }}>Compiling Bhaichara Institutional Engine...</span>
      </div>
    );
  }

  const currentAssetData = selectedAsset === 'NIFTY' ? data?.nifty : (selectedAsset === 'BANKNIFTY' ? data?.banknifty : null);
  const activeSkew = currentAssetData?.straddleSkew;
  const isBullSkew = activeSkew && activeSkew.skewSpreadPct > 15;
  const isBearSkew = activeSkew && activeSkew.skewSpreadPct < -15;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', flex: 1, overflowY: 'auto' }}>
      
      {/* Top Bhaichara Master Header */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center', 
        flexWrap: 'wrap', 
        gap: '16px',
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.12) 0%, rgba(147, 51, 234, 0.08) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '12px' }}>
            <Award size={28} color="#3b82f6" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
                🤝 Bhaichara Work: Institutional Index & Option Master
              </h2>
              <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '3px 10px', borderRadius: '20px' }}>
                LIVE V3 ENGINE
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Unified decision terminal: Combines 9:15 AM Opening Imbalances, ATM Straddle Skew Asymmetry, Gamma Ratios, and Dynamic Stop Loss Math.
            </p>
          </div>
        </div>

        {/* Asset Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={() => setSelectedAsset('NIFTY')}
            style={{
              background: selectedAsset === 'NIFTY' ? '#3b82f6' : 'transparent',
              color: selectedAsset === 'NIFTY' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            NIFTY 50
          </button>
          <button
            onClick={() => setSelectedAsset('BANKNIFTY')}
            style={{
              background: selectedAsset === 'BANKNIFTY' ? '#3b82f6' : 'transparent',
              color: selectedAsset === 'BANKNIFTY' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            BANK NIFTY
          </button>
          <button
            onClick={() => setSelectedAsset('STOCKS')}
            style={{
              background: selectedAsset === 'STOCKS' ? '#3b82f6' : 'transparent',
              color: selectedAsset === 'STOCKS' ? 'white' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              padding: '6px 16px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            🔥 F&O EARLY HUNTER
          </button>

          {/* Sound Alert Toggle Button */}
          <button
            onClick={() => {
              const newState = !soundEnabled;
              setSoundEnabled(newState);
              if (newState) playInstitutionalAlertSound(true); // Preview chime on enable
            }}
            title={soundEnabled ? 'Noise Alerts Active (>+15% / <-15% Skew)' : 'Noise Alerts Muted'}
            style={{
              background: soundEnabled ? 'rgba(234, 179, 8, 0.15)' : 'rgba(255, 255, 255, 0.05)',
              color: soundEnabled ? '#eab308' : 'var(--text-muted)',
              border: `1px solid ${soundEnabled ? 'rgba(234, 179, 8, 0.3)' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s'
            }}
          >
            {soundEnabled ? <Volume2 size={15} color="#eab308" /> : <VolumeX size={15} color="var(--text-muted)" />}
            <span>{soundEnabled ? 'Audio Alert ON' : 'Muted'}</span>
          </button>
        </div>
      </div>

      {/* Active Skew Breakout Banner (Pulsing when Skew > 15% or < -15%) */}
      {(isBullSkew || isBearSkew) && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '14px 20px',
          borderRadius: '12px',
          background: isBullSkew ? 'linear-gradient(90deg, rgba(16, 185, 129, 0.2) 0%, rgba(16, 185, 129, 0.05) 100%)' : 'linear-gradient(90deg, rgba(239, 68, 68, 0.2) 0%, rgba(239, 68, 68, 0.05) 100%)',
          border: `1px solid ${isBullSkew ? '#10b981' : '#ef4444'}`,
          animation: 'pulse 1.5s infinite'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <BellRing size={22} color={isBullSkew ? '#10b981' : '#ef4444'} className="animate-bounce" />
            <div>
              <strong style={{ color: isBullSkew ? '#10b981' : '#ef4444', fontSize: '15px' }}>
                🚨 {selectedAsset} INSTITUTIONAL {isBullSkew ? 'BULLISH CE ACCUMULATION' : 'BEARISH PE DUMP'} TRIGGERED ({activeSkew?.skewSpreadPct > 0 ? '+' : ''}{activeSkew?.skewSpreadPct.toFixed(1)}% SKEW)
              </strong>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                {isBullSkew ? 'Smart money paying heavy premium for Calls. Copy institutional longs on 5m pullbacks.' : 'Smart money loading Put blocks. Copy institutional shorts on 5m bounces.'}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '800', background: isBullSkew ? '#10b981' : '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '6px' }}>
            {isBullSkew ? 'BUY CALLS (CE)' : 'BUY PUTS (PE)'}
          </span>
        </div>
      )}

      {/* Live Confluence & Acceleration Alerts Panel */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: '12px', 
        padding: '16px', 
        background: 'rgba(234, 179, 8, 0.03)', 
        border: '1px solid rgba(234, 179, 8, 0.15)', 
        borderRadius: '12px',
        marginBottom: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Zap size={18} color="#eab308" className="animate-pulse" />
          <h4 style={{ margin: 0, fontSize: '14px', fontWeight: '800', color: '#eab308', textTransform: 'uppercase', letterSpacing: '0.5px' }}>⚡ Live Confluence & Pre-Breakout Radar Alerts</h4>
        </div>
        
        {data?.confluenceAlerts && data.confluenceAlerts.filter(a => a.symbol === selectedAsset).length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {data.confluenceAlerts.filter(a => a.symbol === selectedAsset).map((alert) => (
              <div key={alert.id} style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(0,0,0,0.3)', borderLeft: '3px solid #eab308' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <strong style={{ fontSize: '13px', color: 'white' }}>{alert.title}</strong>
                  <span style={{ fontSize: '10px', color: '#eab308', background: 'rgba(234,179,8,0.15)', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>{alert.probability} Prob</span>
                </div>
                <p style={{ margin: '0 0 6px 0', fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>{alert.description}</p>
                <div style={{ fontSize: '11px', color: '#60a5fa', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <strong>Action:</strong> {alert.action}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ 
            padding: '20px', 
            textAlign: 'center', 
            background: 'rgba(0,0,0,0.2)', 
            borderRadius: '8px', 
            fontSize: '13px', 
            color: 'var(--text-muted)',
            border: '1px dashed rgba(255,255,255,0.05)'
          }}>
            🔍 Pre-Breakout Radar scanning live ticks. Standing by for Skew Velocity acceleration or CDD divergences...
          </div>
        )}
      </div>

      {selectedAsset !== 'STOCKS' ? (
        <>
          {/* Index Deep-Math Overview Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
            
            {/* Card 1: Live Decision Signal */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: `1px solid ${isBullSkew ? 'rgba(16, 185, 129, 0.3)' : (isBearSkew ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.06)')}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>INSTITUTIONAL DIRECTIVE</span>
                <span style={{ 
                  fontSize: '11px', 
                  fontWeight: '800', 
                  padding: '2px 8px', 
                  borderRadius: '6px',
                  background: isBullSkew ? 'rgba(16, 185, 129, 0.15)' : (isBearSkew ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)'),
                  color: isBullSkew ? '#10b981' : (isBearSkew ? '#ef4444' : 'var(--text-secondary)')
                }}>
                  {activeSkew?.biasState || 'EQUILIBRIUM'}
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '10px', margin: '8px 0 14px 0' }}>
                <span style={{ fontSize: '28px', fontWeight: '900', color: isBullSkew ? '#10b981' : (isBearSkew ? '#ef4444' : 'white') }}>
                  {isBullSkew ? 'BUY CALLS (CE)' : (isBearSkew ? 'BUY PUTS (PE)' : 'NEUTRAL / FADE')}
                </span>
              </div>

              <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)', lineHeight: '1.5' }}>
                {currentAssetData?.biasRationale || 'Institutional positioning analysis in progress.'}
              </p>
            </div>

            {/* Card 2: Straddle Skew & Big Money */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>ATM STRADDLE SKEW</span>
                <span style={{ fontSize: '12px', fontWeight: '800', color: '#60a5fa', background: 'rgba(59, 130, 246, 0.12)', padding: '2px 8px', borderRadius: '6px' }}>
                  ₹{activeSkew?.totalStraddle ? activeSkew.totalStraddle.toFixed(1) : (selectedAsset === 'NIFTY' ? '280.0' : '650.0')} Combined
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'baseline', gap: '8px', margin: '4px 0 10px 0' }}>
                <span style={{ fontSize: '26px', fontWeight: '800', color: activeSkew?.skewSpreadPct > 15 ? '#10b981' : (activeSkew?.skewSpreadPct < -15 ? '#ef4444' : 'white') }}>
                  {activeSkew?.skewSpreadPct ? (activeSkew.skewSpreadPct > 0 ? `+${activeSkew.skewSpreadPct.toFixed(1)}%` : `${activeSkew.skewSpreadPct.toFixed(1)}%`) : '0.0%'} Skew
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  (Gamma: {activeSkew?.gammaRatio ? activeSkew.gammaRatio.toFixed(2) : '1.00'}x)
                </span>
              </div>

              {/* Exact Live Call vs Put Premiums */}
              {activeSkew?.ceSymbol && activeSkew?.peSymbol && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: '8px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>ATM CE ({activeSkew.ceSymbol})</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#10b981' }}>₹{activeSkew.ceLtp ? activeSkew.ceLtp.toFixed(1) : '140.0'}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'bold' }}>ATM PE ({activeSkew.peSymbol})</span>
                    <span style={{ fontSize: '14px', fontWeight: '800', color: '#ef4444' }}>₹{activeSkew.peLtp ? activeSkew.peLtp.toFixed(1) : '140.0'}</span>
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.3)', padding: '8px 12px', borderRadius: '8px' }}>
                <Sparkles size={14} color="#eab308" />
                <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                  Big Trader Action: <strong style={{ color: 'white' }}>{activeSkew?.bigTraderAction || 'Market makers active at ATM strikes'}</strong>
                </span>
              </div>
            </div>

            {/* Card 3: Dynamic Stop Loss Proxy */}
            <div className="glass-panel" style={{ padding: '20px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-muted)', textTransform: 'uppercase' }}>DYNAMIC OPTION SL (DELTA = 0.5)</span>
                <Target size={16} color="#eab308" />
              </div>

              {/* Dynamic Strike & Exact Live Option Stop Loss Math */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', margin: '6px 0 10px 0' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '15px', fontWeight: '800', color: '#eab308' }}>
                    {selectedAsset === 'NIFTY' ? `${Math.round((currentAssetData?.currentPrice || 24560) / 50) * 50} ATM Strike` : `${Math.round((currentAssetData?.currentPrice || 57740) / 100) * 100} ATM Strike`}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '2px 8px', borderRadius: '4px' }}>
                    Risk: {selectedAsset === 'NIFTY' ? '25 pts Spot = 12.5 pts Option' : '80 pts Spot = 40 pts Option'}
                  </span>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', background: 'rgba(0,0,0,0.3)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Live ATM Call SL: <strong style={{ color: '#10b981' }}>Entry - {selectedAsset === 'NIFTY' ? '12.5' : '40.0'} pts</strong></span>
                  <span style={{ color: 'var(--text-muted)' }}>Live ATM Put SL: <strong style={{ color: '#ef4444' }}>Entry - {selectedAsset === 'NIFTY' ? '12.5' : '40.0'} pts</strong></span>
                </div>
              </div>

              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Master Rule: <code style={{ background: 'rgba(0,0,0,0.4)', padding: '2px 6px', borderRadius: '4px', color: '#60a5fa' }}>Option SL = Entry Premium - (Spot Risk × 0.5)</code>
              </div>
            </div>

          </div>
        </>
      ) : (
        /* Top Stock Early Hunters */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '17px', fontWeight: '800', color: 'white', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Flame size={20} color="#10b981" /> Top F&O Matrix Proximity Picks ({data?.topStockPicks?.length || 0})
            </h3>
            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
              Click any symbol to view real-time chart
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
            {data?.topStockPicks && data.topStockPicks.length > 0 ? (
              data.topStockPicks.map((pick, idx) => (
                <div
                  key={idx}
                  onClick={() => handleStockClick(pick.symbol)}
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>{pick.symbol.replace('NSE:', '')}</span>
                    <span style={{ 
                      fontSize: '11px', 
                      fontWeight: '800', 
                      color: pick.pickType?.includes('Bullish') ? '#10b981' : (pick.pickType?.includes('Bearish') ? '#ef4444' : '#eab308'), 
                      background: pick.pickType?.includes('Bullish') ? 'rgba(16, 185, 129, 0.15)' : (pick.pickType?.includes('Bearish') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)'), 
                      padding: '2px 8px', 
                      borderRadius: '4px' 
                    }}>
                      {pick.pickType || 'CONFLUENCE'}
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>Spot: <strong style={{ color: 'white' }}>₹{pick.currentPrice}</strong></span>
                    <span>Confluence: <strong style={{ color: '#60a5fa' }}>₹{pick.confluencePrice ? pick.confluencePrice.toFixed(1) : pick.currentPrice}</strong></span>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    fontSize: '11px'
                  }}>
                    <span style={{ color: 'var(--text-muted)' }}>Level: {pick.dailyLevelName || 'D-Lvl'} / {pick.monthlyLevelName || 'M-Lvl'}</span>
                    <span style={{ fontWeight: '700', color: '#60a5fa' }}>
                      {pick.distancePct ? `${pick.distancePct > 0 ? '+' : ''}${pick.distancePct.toFixed(2)}% Dist` : '0.00% Dist'}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No active early stock picks in current cycle. Check back during market hours.
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
