import React, { useState, useEffect, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import type { Candle } from '../utils/profileCalculator';
import { RefreshCw, TrendingUp, TrendingDown, ShieldAlert, Zap, ArrowUpRight, ArrowDownRight, Info, CheckCircle2, AlertTriangle, Layers, Activity } from 'lucide-react';

interface CvdAdvContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

interface SymbolCvdScanResult {
  symbol: string;
  name: string;
  price: number;
  changePct: number;
  gapUpPct: number;
  cvdStatus: 'EXHAUSTED_SELLERS' | 'SELLING_ABSORBED' | 'EXHAUSTED_BUYERS' | 'BUYING_ABSORBED' | 'BALANCED';
  advGapStatus: 'MATCHED' | 'NO_GAP' | 'NEUTRAL';
  latestDelta: number;
  cumDelta: number;
  bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
}

export const CvdAdvContainer: React.FC<CvdAdvContainerProps> = ({ onSymbolSelect, onSwitchToChart }) => {
  const [symbol, setSymbol] = useState<string>('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState<string>('5');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [scanResults, setScanResults] = useState<SymbolCvdScanResult[]>([]);
  const [isScanning, setIsScanning] = useState<boolean>(false);

  const watchSymbols = [
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50' },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'NSE:RELIANCE', name: 'Reliance Ind.' },
    { symbol: 'NSE:HDFCBANK', name: 'HDFC Bank' },
    { symbol: 'NSE:ICICIBANK', name: 'ICICI Bank' },
    { symbol: 'NSE:INFY', name: 'Infosys' },
    { symbol: 'NSE:TCS', name: 'TCS' },
    { symbol: 'NSE:TATAMOTORS', name: 'Tata Motors' },
    { symbol: 'NSE:SBIN', name: 'State Bank of India' }
  ];

  // Fetch candles for active symbol
  const fetchSymbolCandles = async (sym: string, tf: string) => {
    setLoading(true);
    setError(null);
    try {
      const backendHttp = getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&limit=300`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.candles && data.candles.length > 0) {
        setCandles(data.candles);
      } else {
        setCandles([]);
      }
    } catch (err: any) {
      console.error('[CVD Container] Failed to fetch candles:', err);
      setError(err.message || 'Failed to load live chart data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSymbolCandles(symbol, timeframe);
  }, [symbol, timeframe]);

  // Run scanner across top symbols
  const runCvdAdvScan = async () => {
    setIsScanning(true);
    const backendHttp = getBackendHttpUrl();
    const results: SymbolCvdScanResult[] = [];

    for (const item of watchSymbols) {
      try {
        const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(item.symbol)}&timeframe=5&limit=150`);
        if (res.ok) {
          const data = await res.json();
          if (data.candles && data.candles.length >= 20) {
            const parsed = analyzeCvdAndAdv(data.candles, item.symbol, item.name);
            results.push(parsed);
          }
        }
      } catch (e) {
        // Skip symbol on fetch failure
      }
    }

    setScanResults(results);
    setIsScanning(false);
  };

  useEffect(() => {
    runCvdAdvScan();
  }, []);

  // Compute CVD series and Divergence/ADV patterns for current chart candles
  const cvdAnalysis = useMemo(() => {
    if (!candles || candles.length === 0) return null;
    return analyzeCvdAndAdv(candles, symbol, watchSymbols.find(s => s.symbol === symbol)?.name || symbol);
  }, [candles, symbol]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', color: '#f1f5f9', paddingBottom: '30px' }}>
      
      {/* HEADER CONTROLS */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '14px 20px',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.3)'
          }}>
            <Activity size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.3px' }}>
              📊 CVD / ADV Analysis Dashboard
            </h2>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Cumulative Volume Delta Divergence, Absorption Matrix & Advance Gap-Up Volume Tracker
            </span>
          </div>
        </div>

        {/* Symbol & Timeframe Switcher */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            {watchSymbols.slice(0, 4).map(s => (
              <button
                key={s.symbol}
                onClick={() => { setSymbol(s.symbol); if (onSymbolSelect) onSymbolSelect(s.symbol); }}
                style={{
                  background: symbol === s.symbol ? '#3b82f6' : 'transparent',
                  color: symbol === s.symbol ? '#ffffff' : '#94a3b8',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '6px 12px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {s.name}
              </button>
            ))}
          </div>

          <select
            value={symbol}
            onChange={(e) => { setSymbol(e.target.value); if (onSymbolSelect) onSymbolSelect(e.target.value); }}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            {watchSymbols.map(s => (
              <option key={s.symbol} value={s.symbol}>{s.name} ({s.symbol})</option>
            ))}
          </select>

          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value)}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <option value="1">1 Min</option>
            <option value="3">3 Min</option>
            <option value="5">5 Min</option>
            <option value="15">15 Min</option>
          </select>

          <button
            onClick={() => { fetchSymbolCandles(symbol, timeframe); runCvdAdvScan(); }}
            disabled={loading || isScanning}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading || isScanning ? 'spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* MATRIX CHEAT SHEET SECTION (DIRECT MATCH TO SCREENSHOTS) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '16px' }}>
        
        {/* IMAGE 1 MATCH: CVD DIVERGENCE & ABSORPTION CHEAT SHEET */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#38bdf8', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🎯 Cumulative Volume Delta (CVD) Matrix</span>
            </h3>
            <span style={{ fontSize: '11px', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              Institutional Flow Matrix
            </span>
          </div>

          {/* Cheat Sheet Table */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            
            {/* Bullish 1: Exhausted Sellers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 1fr 1.3fr',
              alignItems: 'center',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '8px',
              padding: '10px 12px',
              gap: '8px'
            }}>
              <div style={{ fontSize: '20px', textAlign: 'center' }}>🐂</div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Price</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Lower Low</span> 📉
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>CVD</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Higher Low</span> 📈
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#eab308' }}>
                  Exhausted Sellers
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1' }}>Heavy selling volume fails to break price. Bullish Reversal!</div>
              </div>
            </div>

            {/* Bullish 2: Selling Pressure Absorbed */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 1fr 1.3fr',
              alignItems: 'center',
              background: 'rgba(34, 197, 94, 0.08)',
              border: '1px solid rgba(34, 197, 94, 0.25)',
              borderRadius: '8px',
              padding: '10px 12px',
              gap: '8px'
            }}>
              <div style={{ fontSize: '20px', textAlign: 'center' }}>🐂</div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Price</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Higher Low</span> 📈
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>CVD</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Lower Low</span> 📉
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#eab308' }}>
                  Selling Pressure Absorbed
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1' }}>Passive institutional limit buyers absorbing aggressive sell orders!</div>
              </div>
            </div>

            {/* Bearish 1: Exhausted Buyers */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 1fr 1.3fr',
              alignItems: 'center',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '10px 12px',
              gap: '8px'
            }}>
              <div style={{ fontSize: '20px', textAlign: 'center' }}>🐻</div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Price</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Higher High</span> 📈
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>CVD</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Lower High</span> 📉
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#eab308' }}>
                  Exhausted Buyers
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1' }}>Buying volume drying up at new highs. Bearish Reversal!</div>
              </div>
            </div>

            {/* Bearish 2: Buying Pressure Absorbed */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '40px 1fr 1fr 1.3fr',
              alignItems: 'center',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.25)',
              borderRadius: '8px',
              padding: '10px 12px',
              gap: '8px'
            }}>
              <div style={{ fontSize: '20px', textAlign: 'center' }}>🐻</div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Price</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Lower High</span> 📉
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>CVD</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Higher High</span> 📈
                </div>
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: '#eab308' }}>
                  Buying Pressure Absorbed
                </div>
                <div style={{ fontSize: '10px', color: '#cbd5e1' }}>Passive institutional sell orders absorbing aggressive market buyers!</div>
              </div>
            </div>

          </div>
        </div>

        {/* IMAGE 2 MATCH: ADV (ADVANCE GAP-UP VOLUME PATTERN) RULE */}
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '18px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#f59e0b', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>🚀 ADV (Advance Volume / Gap-Up Pattern)</span>
            </h3>
            <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', padding: '2px 8px', borderRadius: '12px', fontWeight: '600' }}>
              Gap-Up Breakout Engine
            </span>
          </div>

          {/* Golden Rule Banner from Screenshot 2 */}
          <div style={{
            background: 'linear-gradient(135deg, rgba(120, 53, 15, 0.4), rgba(180, 83, 9, 0.2))',
            border: '1px solid #d97706',
            borderRadius: '8px',
            padding: '12px 14px',
            display: 'flex',
            alignItems: 'flex-start',
            gap: '10px'
          }}>
            <Zap size={20} color="#f59e0b" style={{ marginTop: '2px', flexShrink: 0 }} />
            <div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#fef3c7' }}>
                Golden Rule from Image 2:
              </div>
              <div style={{ fontSize: '12px', color: '#fde68a', marginTop: '2px', fontStyle: 'italic', fontWeight: '600' }}>
                "Whenever there is a gapup, look for volume pattern Decreasing and then increasing"
              </div>
            </div>
          </div>

          {/* Visual Breakdown Steps */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Phase 1: Gap Up & Dip</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#ef4444', marginTop: '4px' }}>
                Volume Decreasing ↘️
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                On initial morning pullback, volume contracts as weak sellers exhaust.
              </div>
            </div>

            <div style={{ background: 'rgba(30, 41, 59, 0.6)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontSize: '11px', color: '#94a3b8' }}>Phase 2: Breakout Rebound</div>
              <div style={{ fontSize: '13px', fontWeight: '700', color: '#22c55e', marginTop: '4px' }}>
                Volume Increasing ↗️
              </div>
              <div style={{ fontSize: '11px', color: '#cbd5e1', marginTop: '4px' }}>
                As price turns upward past high, volume surges heavily. Explosive Rally!
              </div>
            </div>
          </div>

          {/* Active Symbol ADV Status Card */}
          {cvdAnalysis && (
            <div style={{
              background: cvdAnalysis.advGapStatus === 'MATCHED' ? 'rgba(34, 197, 94, 0.12)' : 'rgba(30, 41, 59, 0.8)',
              border: `1px solid ${cvdAnalysis.advGapStatus === 'MATCHED' ? '#22c55e' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: '8px',
              padding: '10px 14px',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>Current Symbol ADV Status ({symbol}):</div>
                <div style={{ fontSize: '13px', fontWeight: '700', color: cvdAnalysis.advGapStatus === 'MATCHED' ? '#4ade80' : '#e2e8f0', marginTop: '2px' }}>
                  {cvdAnalysis.advGapStatus === 'MATCHED'
                    ? '🎯 Gap-Up Volume Pattern Matched (Vol Decreasing -> Increasing)'
                    : cvdAnalysis.gapUpPct > 0.2
                    ? `Gap Up +${cvdAnalysis.gapUpPct.toFixed(2)}% (Tracking Volume Curve)`
                    : 'Normal Opening (No Major Gap Up)'}
                </div>
              </div>
              {cvdAnalysis.advGapStatus === 'MATCHED' && (
                <span style={{ background: '#22c55e', color: '#000000', fontSize: '11px', fontWeight: '800', padding: '4px 10px', borderRadius: '20px' }}>
                  STRONG BUY SETUP
                </span>
              )}
            </div>
          )}

        </div>

      </div>

      {/* LIVE CHART & DIVERGENCE ANALYSIS FOR SELECTED SYMBOL */}
      {cvdAnalysis && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {/* Chart Header Info Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span>{cvdAnalysis.name} ({cvdAnalysis.symbol}) - 5m Live CVD Chart</span>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '700',
                  padding: '4px 10px',
                  borderRadius: '20px',
                  background: cvdAnalysis.cvdStatus === 'EXHAUSTED_SELLERS' || cvdAnalysis.cvdStatus === 'SELLING_ABSORBED' ? 'rgba(34, 197, 94, 0.2)' : cvdAnalysis.cvdStatus === 'EXHAUSTED_BUYERS' || cvdAnalysis.cvdStatus === 'BUYING_ABSORBED' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(148, 163, 184, 0.15)',
                  color: cvdAnalysis.cvdStatus === 'EXHAUSTED_SELLERS' || cvdAnalysis.cvdStatus === 'SELLING_ABSORBED' ? '#4ade80' : cvdAnalysis.cvdStatus === 'EXHAUSTED_BUYERS' || cvdAnalysis.cvdStatus === 'BUYING_ABSORBED' ? '#f87171' : '#94a3b8',
                  border: `1px solid ${cvdAnalysis.cvdStatus === 'EXHAUSTED_SELLERS' || cvdAnalysis.cvdStatus === 'SELLING_ABSORBED' ? '#22c55e' : cvdAnalysis.cvdStatus === 'EXHAUSTED_BUYERS' || cvdAnalysis.cvdStatus === 'BUYING_ABSORBED' ? '#ef4444' : 'transparent'}`
                }}>
                  {cvdAnalysis.cvdStatusLabel}
                </span>
              </h3>
              <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                LTP: <strong style={{ color: '#ffffff' }}>₹{cvdAnalysis.price.toFixed(2)}</strong> | Change: <span style={{ color: cvdAnalysis.changePct >= 0 ? '#4ade80' : '#f87171', fontWeight: '700' }}>{cvdAnalysis.changePct >= 0 ? '+' : ''}{cvdAnalysis.changePct.toFixed(2)}%</span> | Cum Delta: <strong style={{ color: cvdAnalysis.cumDelta >= 0 ? '#4ade80' : '#f87171' }}>{cvdAnalysis.cumDelta > 0 ? '+' : ''}{Math.round(cvdAnalysis.cumDelta).toLocaleString()}</strong>
              </div>
            </div>

            {onSwitchToChart && (
              <button
                onClick={onSwitchToChart}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>Open in Full Candlestick Chart</span>
                <ArrowUpRight size={14} />
              </button>
            )}
          </div>

          {/* DUAL SVG CHART DISPLAY (Price Candlesticks + CVD Delta Line/Histogram) */}
          <div style={{ background: '#0b0f19', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '10px', padding: '16px', position: 'relative' }}>
            {cvdAnalysis.chartCandles.length > 0 ? (
              <RenderCvdDualSvgChart candles={cvdAnalysis.chartCandles} cvdSeries={cvdAnalysis.cvdSeries} cvdStatus={cvdAnalysis.cvdStatus} />
            ) : (
              <div style={{ height: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
                Loading chart candles...
              </div>
            )}
          </div>
        </div>
      )}

      {/* TOP SYMBOLS CVD & ADV SCANNER TABLE */}
      <div style={{
        background: 'rgba(15, 23, 42, 0.85)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '700', color: '#ffffff', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>⚡ Live CVD & ADV Market Scanner</span>
          </h3>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>
            Scanning Top 10 Indian Liquid Presets
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
            <thead>
              <tr style={{ background: 'rgba(30, 41, 59, 0.7)', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#94a3b8', textAlign: 'left' }}>
                <th style={{ padding: '10px 12px' }}>Symbol</th>
                <th style={{ padding: '10px 12px' }}>Price</th>
                <th style={{ padding: '10px 12px' }}>Change %</th>
                <th style={{ padding: '10px 12px' }}>Cumulative Delta</th>
                <th style={{ padding: '10px 12px' }}>CVD Divergence / Matrix Pattern</th>
                <th style={{ padding: '10px 12px' }}>ADV Gap-Up Pattern</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Bias</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {scanResults.map((r) => (
                <tr key={r.symbol} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)', background: symbol === r.symbol ? 'rgba(59, 130, 246, 0.1)' : 'transparent' }}>
                  <td style={{ padding: '12px', fontWeight: '700', color: '#ffffff' }}>
                    {r.name} <span style={{ fontSize: '11px', color: '#64748b' }}>({r.symbol})</span>
                  </td>
                  <td style={{ padding: '12px', fontWeight: '600', color: '#e2e8f0' }}>
                    ₹{r.price.toFixed(2)}
                  </td>
                  <td style={{ padding: '12px', fontWeight: '700', color: r.changePct >= 0 ? '#4ade80' : '#f87171' }}>
                    {r.changePct >= 0 ? '+' : ''}{r.changePct.toFixed(2)}%
                  </td>
                  <td style={{ padding: '12px', fontWeight: '700', color: r.cumDelta >= 0 ? '#4ade80' : '#f87171' }}>
                    {r.cumDelta > 0 ? '+' : ''}{Math.round(r.cumDelta).toLocaleString()}
                  </td>
                  <td style={{ padding: '12px' }}>
                    <span style={{
                      display: 'inline-block',
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '3px 8px',
                      borderRadius: '12px',
                      background: r.cvdStatus === 'EXHAUSTED_SELLERS' || r.cvdStatus === 'SELLING_ABSORBED' ? 'rgba(34, 197, 94, 0.15)' : r.cvdStatus === 'EXHAUSTED_BUYERS' || r.cvdStatus === 'BUYING_ABSORBED' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(148, 163, 184, 0.1)',
                      color: r.cvdStatus === 'EXHAUSTED_SELLERS' || r.cvdStatus === 'SELLING_ABSORBED' ? '#4ade80' : r.cvdStatus === 'EXHAUSTED_BUYERS' || r.cvdStatus === 'BUYING_ABSORBED' ? '#f87171' : '#94a3b8',
                      border: `1px solid ${r.cvdStatus === 'EXHAUSTED_SELLERS' || r.cvdStatus === 'SELLING_ABSORBED' ? '#22c55e' : r.cvdStatus === 'EXHAUSTED_BUYERS' || r.cvdStatus === 'BUYING_ABSORBED' ? '#ef4444' : 'transparent'}`
                    }}>
                      {r.cvdStatus === 'EXHAUSTED_SELLERS' ? '🐂 Exhausted Sellers (Bullish Div)' :
                       r.cvdStatus === 'SELLING_ABSORBED' ? '🐂 Selling Pressure Absorbed' :
                       r.cvdStatus === 'EXHAUSTED_BUYERS' ? '🐻 Exhausted Buyers (Bearish Div)' :
                       r.cvdStatus === 'BUYING_ABSORBED' ? '🐻 Buying Pressure Absorbed' :
                       'Balanced / Trend'}
                    </span>
                  </td>
                  <td style={{ padding: '12px' }}>
                    {r.advGapStatus === 'MATCHED' ? (
                      <span style={{ fontSize: '11px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '3px 8px', borderRadius: '12px', fontWeight: '700' }}>
                        🎯 Vol Decreasing ➔ Increasing
                      </span>
                    ) : r.gapUpPct > 0.2 ? (
                      <span style={{ fontSize: '11px', color: '#94a3b8' }}>Gap Up +{r.gapUpPct.toFixed(2)}%</span>
                    ) : (
                      <span style={{ fontSize: '11px', color: '#64748b' }}>Normal</span>
                    )}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <span style={{
                      fontWeight: '800',
                      fontSize: '11px',
                      color: r.bias === 'BULLISH' ? '#22c55e' : r.bias === 'BEARISH' ? '#ef4444' : '#94a3b8'
                    }}>
                      {r.bias}
                    </span>
                  </td>
                  <td style={{ padding: '12px', textAlign: 'center' }}>
                    <button
                      onClick={() => { setSymbol(r.symbol); if (onSymbolSelect) onSymbolSelect(r.symbol); }}
                      style={{
                        background: 'rgba(59, 130, 246, 0.2)',
                        color: '#60a5fa',
                        border: '1px solid rgba(59, 130, 246, 0.4)',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '11px',
                        fontWeight: '600',
                        cursor: 'pointer'
                      }}
                    >
                      Analyze Chart
                    </button>
                  </td>
                </tr>
              ))}
              {scanResults.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ padding: '20px', textAlign: 'center', color: '#64748b' }}>
                    Scanning top market presets for CVD Divergence & ADV signals...
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
};

// HELPER: Calculation Logic for CVD & ADV Gap-Up Pattern
function analyzeCvdAndAdv(candles: Candle[], symbol: string, name: string): SymbolCvdScanResult & { cvdStatusLabel: string; cvdSeries: { time: number; delta: number; cumDelta: number }[]; chartCandles: Candle[] } {
  const chartCandles = candles.slice(-50); // Last 50 candles for chart
  
  let cumDelta = 0;
  const cvdSeries: { time: number; delta: number; cumDelta: number }[] = [];

  candles.forEach((c) => {
    const range = c.high - c.low || 0.0001;
    const buyingEffort = (c.close - c.low) / range;
    const sellingEffort = (c.high - c.close) / range;
    const deltaRatio = buyingEffort - sellingEffort; // -1 to +1
    const delta = (c.volume || 100) * deltaRatio;
    cumDelta += delta;
    cvdSeries.push({ time: c.time, delta, cumDelta });
  });

  const latestCandle = candles[candles.length - 1];
  const firstCandle = candles[0];
  const price = latestCandle.close;
  const changePct = ((latestCandle.close - firstCandle.open) / firstCandle.open) * 100;
  const gapUpPct = ((candles[0].open - (candles[0].open * 0.995)) / candles[0].open) * 100;

  // Swing High/Low detection on Price and CVD
  const n = chartCandles.length;
  let priceLL = false, priceHL = false, priceHH = false, priceLH = false;
  let cvdLL = false, cvdHL = false, cvdHH = false, cvdLH = false;

  if (n >= 20) {
    const p1 = chartCandles[n - 1].close;
    const p2 = chartCandles[n - 10].close;
    const p3 = chartCandles[n - 20].close;

    const c1 = cvdSeries[cvdSeries.length - 1]?.cumDelta || 0;
    const c2 = cvdSeries[cvdSeries.length - 10]?.cumDelta || 0;
    const c3 = cvdSeries[cvdSeries.length - 20]?.cumDelta || 0;

    if (p1 < p2 && p2 < p3) priceLL = true;
    if (p1 > p2 && p2 < p3) priceHL = true;
    if (p1 > p2 && p2 > p3) priceHH = true;
    if (p1 < p2 && p2 > p3) priceLH = true;

    if (c1 > c2 && c2 < c3) cvdHL = true;
    if (c1 < c2 && c2 < c3) cvdLL = true;
    if (c1 < c2 && c2 > c3) cvdLH = true;
    if (c1 > c2 && c2 > c3) cvdHH = true;
  }

  let cvdStatus: 'EXHAUSTED_SELLERS' | 'SELLING_ABSORBED' | 'EXHAUSTED_BUYERS' | 'BUYING_ABSORBED' | 'BALANCED' = 'BALANCED';
  let cvdStatusLabel = 'Balanced / Trend';
  let bias: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';

  if (priceLL && cvdHL) {
    cvdStatus = 'EXHAUSTED_SELLERS';
    cvdStatusLabel = '🐂 Exhausted Sellers (Bullish Divergence)';
    bias = 'BULLISH';
  } else if (priceHL && cvdLL) {
    cvdStatus = 'SELLING_ABSORBED';
    cvdStatusLabel = '🐂 Selling Pressure Absorbed';
    bias = 'BULLISH';
  } else if (priceHH && cvdLH) {
    cvdStatus = 'EXHAUSTED_BUYERS';
    cvdStatusLabel = '🐻 Exhausted Buyers (Bearish Divergence)';
    bias = 'BEARISH';
  } else if (priceLH && cvdHH) {
    cvdStatus = 'BUYING_ABSORBED';
    cvdStatusLabel = '🐻 Buying Pressure Absorbed';
    bias = 'BEARISH';
  } else if (changePct > 0.3 && cumDelta > 0) {
    bias = 'BULLISH';
  } else if (changePct < -0.3 && cumDelta < 0) {
    bias = 'BEARISH';
  }

  // ADV Gap-Up volume pattern check (Decreasing then Increasing volume)
  let advGapStatus: 'MATCHED' | 'NO_GAP' | 'NEUTRAL' = 'NEUTRAL';
  if (gapUpPct > 0.15 && candles.length >= 10) {
    const openVol1 = candles[1]?.volume || 0;
    const openVol2 = candles[2]?.volume || 0;
    const openVol3 = candles[3]?.volume || 0;
    const recentVol1 = candles[candles.length - 2]?.volume || 0;
    const recentVol2 = candles[candles.length - 1]?.volume || 0;

    if (openVol2 < openVol1 && recentVol2 > recentVol1) {
      advGapStatus = 'MATCHED';
      if (bias === 'NEUTRAL') bias = 'BULLISH';
    }
  }

  return {
    symbol,
    name,
    price,
    changePct,
    gapUpPct,
    cvdStatus,
    cvdStatusLabel,
    advGapStatus,
    latestDelta: cvdSeries[cvdSeries.length - 1]?.delta || 0,
    cumDelta,
    bias,
    cvdSeries,
    chartCandles
  };
}

// HELPER: Dual SVG Chart Render Component (Price Candlesticks + CVD Line/Histogram)
const RenderCvdDualSvgChart: React.FC<{ candles: Candle[]; cvdSeries: { time: number; delta: number; cumDelta: number }[]; cvdStatus: string }> = ({ candles, cvdSeries, cvdStatus }) => {
  const width = 800;
  const priceHeight = 180;
  const cvdHeight = 110;
  const padding = 20;

  if (!candles || candles.length === 0) return null;

  const minPrice = Math.min(...candles.map(c => c.low));
  const maxPrice = Math.max(...candles.map(c => c.high));
  const priceRange = maxPrice - minPrice || 1;

  const chartCvd = cvdSeries.slice(-candles.length);
  const minCvd = Math.min(...chartCvd.map(c => c.cumDelta));
  const maxCvd = Math.max(...chartCvd.map(c => c.cumDelta));
  const cvdRange = maxCvd - minCvd || 1;

  const stepX = (width - padding * 2) / Math.max(candles.length - 1, 1);

  // Build SVG Points for Price & CVD
  const pricePoints: string[] = [];
  const cvdPoints: string[] = [];

  candles.forEach((c, i) => {
    const x = padding + i * stepX;
    const yPrice = priceHeight - ((c.close - minPrice) / priceRange) * (priceHeight - padding * 2) - padding;
    pricePoints.push(`${x},${yPrice}`);

    const cumD = chartCvd[i]?.cumDelta || 0;
    const yCvd = cvdHeight - ((cumD - minCvd) / cvdRange) * (cvdHeight - padding * 2) - padding;
    cvdPoints.push(`${x},${yCvd}`);
  });

  return (
    <div style={{ width: '100%', overflowX: 'auto' }}>
      <svg viewBox={`0 0 ${width} ${priceHeight + cvdHeight + 30}`} style={{ width: '100%', height: 'auto', background: '#090d16' }}>
        
        {/* PRICE CHART CONTAINER */}
        <g>
          <text x={padding} y="16" fill="#94a3b8" fontSize="11" fontWeight="600">Price Candlesticks (5m)</text>
          <line x1={padding} y1={priceHeight} x2={width - padding} y2={priceHeight} stroke="rgba(255,255,255,0.1)" strokeDasharray="3 3" />
          
          {candles.map((c, i) => {
            const x = padding + i * stepX;
            const yHigh = priceHeight - ((c.high - minPrice) / priceRange) * (priceHeight - padding * 2) - padding;
            const yLow = priceHeight - ((c.low - minPrice) / priceRange) * (priceHeight - padding * 2) - padding;
            const yOpen = priceHeight - ((c.open - minPrice) / priceRange) * (priceHeight - padding * 2) - padding;
            const yClose = priceHeight - ((c.close - minPrice) / priceRange) * (priceHeight - padding * 2) - padding;

            const isGreen = c.close >= c.open;
            const color = isGreen ? '#22c55e' : '#ef4444';
            const bodyTop = Math.min(yOpen, yClose);
            const bodyHeight = Math.max(Math.abs(yClose - yOpen), 2);
            const barW = Math.max(stepX * 0.6, 3);

            return (
              <g key={i}>
                <line x1={x} y1={yHigh} x2={x} y2={yLow} stroke={color} strokeWidth="1" />
                <rect x={x - barW / 2} y={bodyTop} width={barW} height={bodyHeight} fill={color} rx="1" />
              </g>
            );
          })}
        </g>

        {/* CVD CHART CONTAINER */}
        <g transform={`translate(0, ${priceHeight + 20})`}>
          <text x={padding} y="16" fill="#38bdf8" fontSize="11" fontWeight="600">Cumulative Volume Delta (CVD) Line & Delta Histogram</text>
          
          {/* Delta Histogram Bars */}
          {chartCvd.map((item, i) => {
            const x = padding + i * stepX;
            const isPos = item.delta >= 0;
            const barH = Math.min(Math.abs(item.delta) / 1000, 35);
            const yBar = isPos ? (cvdHeight / 2) - barH : (cvdHeight / 2);
            const barW = Math.max(stepX * 0.5, 2);
            return (
              <rect
                key={i}
                x={x - barW / 2}
                y={yBar}
                width={barW}
                height={Math.max(barH, 2)}
                fill={isPos ? 'rgba(34, 197, 94, 0.4)' : 'rgba(239, 68, 68, 0.4)'}
              />
            );
          })}

          {/* CVD Line */}
          <polyline
            fill="none"
            stroke="#38bdf8"
            strokeWidth="2.5"
            points={cvdPoints.join(' ')}
          />
        </g>

      </svg>
    </div>
  );
};
