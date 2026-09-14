import React, { useState, useEffect, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { Candle } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { 
  calculateVsaAnalysis, 
  VsaSignal, 
  VsaCandleAnalysis, 
  VsaSummary,
  VsaSignalType
} from '../utils/vsaCalculator';
import { 
  BarChart2, Activity, Zap, TrendingUp, TrendingDown, RefreshCw, 
  Search, ShieldAlert, CheckCircle2, AlertTriangle, Layers, Info, Filter, ArrowUpRight, ArrowDownRight, BookOpen, Compass
} from 'lucide-react';

interface VsaContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

export const VsaContainer: React.FC<VsaContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const [symbol, setSymbol] = useState<string>('NSE:NIFTY');
  const [searchInput, setSearchInput] = useState<string>('NSE:NIFTY');
  const [timeframe, setTimeframe] = useState<string>('5');
  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Filter state for VSA Signal Scanner Table
  const [signalFilter, setSignalFilter] = useState<'ALL' | 'BULLISH' | 'BEARISH' | 'TESTS' | 'CLIMAX'>('ALL');
  const [activeGuideTab, setActiveGuideTab] = useState<string>('no_supply');

  const watchSymbols = [
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50' },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'NSE:RELIANCE', name: 'RELIANCE' },
    { symbol: 'NSE:TCS', name: 'TCS' },
    { symbol: 'NSE:HDFCBANK', name: 'HDFC BANK' },
    { symbol: 'NSE:INFY', name: 'INFOSYS' },
    { symbol: 'NSE:ICICIBANK', name: 'ICICI BANK' },
    { symbol: 'NSE:SBIN', name: 'SBIN' },
    { symbol: 'NSE:TATAMOTORS', name: 'TATA MOTORS' }
  ];

  // Fetch candle data for selected symbol & timeframe
  const fetchCandles = async () => {
    setLoading(true);
    setError(null);
    try {
      const backendHttp = await getBackendHttpUrl();
      const resolved = resolveSymbol(symbol);
      const url = `${backendHttp}/api/candles?symbol=${encodeURIComponent(resolved)}&timeframe=${timeframe}&limit=300`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.candles && data.candles.length > 0) {
          setCandles(data.candles);
        } else {
          setError('No candle data returned for this symbol.');
        }
      } else {
        setError(`Failed to fetch candles (HTTP ${res.status})`);
      }
    } catch (err: any) {
      console.error('Error fetching VSA candles:', err);
      setError(err.message || 'Error connecting to backend API');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles();
  }, [symbol, timeframe]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const formatted = searchInput.toUpperCase().includes(':')
        ? searchInput.toUpperCase()
        : `NSE:${searchInput.toUpperCase()}`;
      setSymbol(formatted);
      if (onSymbolSelect) onSymbolSelect(formatted);
    }
  };

  const handleSelectPreset = (sym: string) => {
    setSymbol(sym);
    setSearchInput(sym);
    if (onSymbolSelect) onSymbolSelect(sym);
  };

  // Run VSA Engine calculations
  const { analyzedCandles, latestSignals, summary } = useMemo(() => {
    return calculateVsaAnalysis(candles);
  }, [candles]);

  const latestCandleAnalysis: VsaCandleAnalysis | undefined = 
    analyzedCandles.length > 0 ? analyzedCandles[analyzedCandles.length - 1] : undefined;

  // Filtered signals for table
  const filteredSignals = useMemo(() => {
    if (signalFilter === 'ALL') return latestSignals;
    if (signalFilter === 'BULLISH') return latestSignals.filter((s) => s.type === 'BULLISH');
    if (signalFilter === 'BEARISH') return latestSignals.filter((s) => s.type === 'BEARISH');
    if (signalFilter === 'TESTS') return latestSignals.filter((s) => s.name.includes('No Supply') || s.name.includes('No Demand') || s.name.includes('Test'));
    if (signalFilter === 'CLIMAX') return latestSignals.filter((s) => s.name.includes('Climax') || s.name.includes('Spring') || s.name.includes('Shakeout') || s.name.includes('Upthrust'));
    return latestSignals;
  }, [latestSignals, signalFilter]);

  const getSignalBadgeColor = (type: VsaSignalType) => {
    if (type === 'BULLISH') return { bg: 'rgba(16, 185, 129, 0.15)', border: '#10b981', text: '#34d399' };
    if (type === 'BEARISH') return { bg: 'rgba(239, 68, 68, 0.15)', border: '#ef4444', text: '#f87171' };
    return { bg: 'rgba(168, 85, 247, 0.15)', border: '#a855f7', text: '#c084fc' };
  };

  return (
    <div style={{ padding: '16px', background: '#090d16', color: '#e2e8f0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '85vh' }}>
      
      {/* Top Header Bar & Search Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', padding: '8px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}>
            <BarChart2 size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '800', color: '#f8fafc', letterSpacing: '0.5px' }}>
              📊 VOLUME SPREAD ANALYSIS (VSA) RADAR
            </h2>
            <div style={{ fontSize: '12px', color: '#94a3b8' }}>
              Wyckoff Smart Money Volume & Spread Pattern Scanner
            </div>
          </div>
        </div>

        {/* Symbol Search and Timeframe Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', alignItems: 'center', background: '#1e293b', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.1)', padding: '2px 8px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search symbol e.g. NIFTY..."
              style={{ background: 'transparent', border: 'none', color: '#ffffff', padding: '6px 8px', fontSize: '12px', outline: 'none', width: '150px' }}
            />
            <button type="submit" style={{ background: '#3b82f6', border: 'none', color: '#fff', padding: '4px 10px', borderRadius: '4px', fontSize: '11px', fontWeight: '700', cursor: 'pointer' }}>
              GO
            </button>
          </form>

          {/* Timeframe Selector */}
          <div style={{ display: 'flex', background: '#1e293b', borderRadius: '6px', padding: '2px', border: '1px solid rgba(255,255,255,0.1)' }}>
            {['1', '3', '5', '15', '60', 'D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  background: timeframe === tf ? '#3b82f6' : 'transparent',
                  border: 'none',
                  color: timeframe === tf ? '#ffffff' : '#94a3b8',
                  padding: '4px 8px',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {tf === '60' ? '1H' : tf}
              </button>
            ))}
          </div>

          <button
            onClick={fetchCandles}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>

          {onSwitchToChart && (
            <button
              onClick={onSwitchToChart}
              style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#34d399', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Activity size={14} /> Open Chart
            </button>
          )}
        </div>
      </div>

      {/* Preset Watchlist Chips */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto', paddingBottom: '4px' }}>
        <span style={{ fontSize: '11px', fontWeight: '700', color: '#64748b', whiteSpace: 'nowrap' }}>WATCHLIST:</span>
        {watchSymbols.map((item) => (
          <button
            key={item.symbol}
            onClick={() => handleSelectPreset(item.symbol)}
            style={{
              background: symbol === item.symbol ? 'rgba(59, 130, 246, 0.25)' : '#1e293b',
              border: symbol === item.symbol ? '1px solid #3b82f6' : '1px solid rgba(255,255,255,0.08)',
              color: symbol === item.symbol ? '#60a5fa' : '#cbd5e1',
              padding: '4px 10px',
              borderRadius: '16px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
          >
            {item.name}
          </button>
        ))}
      </div>

      {/* VSA Radar Overview Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        
        {/* Card 1: Market Bias */}
        <div style={{ background: '#131c2e', border: '1px solid rgba(255,255,255,0.08)', padding: '14px', borderRadius: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8', marginBottom: '6px' }}>VSA MARKET BIAS</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{
              fontSize: '15px',
              fontWeight: '900',
              padding: '4px 10px',
              borderRadius: '6px',
              background: summary.marketBias.includes('BULLISH') ? 'rgba(16, 185, 129, 0.2)' : summary.marketBias.includes('BEARISH') ? 'rgba(239, 68, 68, 0.2)' : 'rgba(168, 85, 247, 0.2)',
              color: summary.marketBias.includes('BULLISH') ? '#34d399' : summary.marketBias.includes('BEARISH') ? '#f87171' : '#c084fc',
              border: `1px solid ${summary.marketBias.includes('BULLISH') ? '#10b981' : summary.marketBias.includes('BEARISH') ? '#ef4444' : '#a855f7'}`
            }}>
              {summary.marketBias}
            </span>
          </div>
          <div style={{ fontSize: '11px', color: '#64748b', marginTop: '8px' }}>
            Score: Net {summary.bullishCount - summary.bearishCount >= 0 ? '+' : ''}{summary.bullishCount - summary.bearishCount} Signals
          </div>
        </div>

        {/* Card 2: Bullish Signals */}
        <div style={{ background: '#131c2e', border: '1px solid rgba(16, 185, 129, 0.2)', padding: '14px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>BULLISH ACCUMULATION</span>
            <ArrowUpRight size={16} color="#34d399" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#34d399', margin: '4px 0' }}>
            {summary.bullishCount}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Stopping Vol, Absorption, Springs
          </div>
        </div>

        {/* Card 3: Bearish Signals */}
        <div style={{ background: '#131c2e', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '14px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>BEARISH DISTRIBUTION</span>
            <ArrowDownRight size={16} color="#f87171" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#f87171', margin: '4px 0' }}>
            {summary.bearishCount}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Upthrusts, Buying Climaxes, No Demand
          </div>
        </div>

        {/* Card 4: No Supply / Demand Tests */}
        <div style={{ background: '#131c2e', border: '1px solid rgba(168, 85, 247, 0.2)', padding: '14px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: '700', color: '#94a3b8' }}>SUPPLY / DEMAND TESTS</span>
            <Zap size={16} color="#c084fc" />
          </div>
          <div style={{ fontSize: '24px', fontWeight: '900', color: '#c084fc', margin: '4px 0' }}>
            {summary.noSupplyDemandCount}
          </div>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>
            Low volume test bars before markup/markdown
          </div>
        </div>

      </div>

      {/* Real-Time Candle VSA Inspector Card */}
      {latestCandleAnalysis && (
        <div style={{ background: 'linear-gradient(135deg, #0f172a, #1e293b)', border: '1px solid rgba(59, 130, 246, 0.3)', padding: '16px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Compass size={18} color="#60a5fa" />
              <span style={{ fontSize: '14px', fontWeight: '800', color: '#ffffff' }}>
                CURRENT CANDLE VSA DIMENSION BREAKDOWN ({symbol})
              </span>
            </div>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Close: <strong style={{ color: '#ffffff' }}>{latestCandleAnalysis.close}</strong> | Vol: <strong style={{ color: '#ffffff' }}>{latestCandleAnalysis.volume.toLocaleString()}</strong>
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px' }}>
            {/* Metric 1: Relative Volume */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>RELATIVE VOLUME (RVOL)</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: latestCandleAnalysis.volumeType.includes('HIGH') ? '#34d399' : latestCandleAnalysis.volumeType.includes('LOW') ? '#f87171' : '#e2e8f0', marginTop: '2px' }}>
                {latestCandleAnalysis.volumeRatio}x SMA ({latestCandleAnalysis.volumeType})
              </div>
            </div>

            {/* Metric 2: Spread Width */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>SPREAD WIDTH (HIGH-LOW)</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>
                {latestCandleAnalysis.spread} pts ({latestCandleAnalysis.spreadType})
              </div>
            </div>

            {/* Metric 3: Close Position */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>CLOSE POSITION %</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: latestCandleAnalysis.closePositionPct >= 75 ? '#34d399' : latestCandleAnalysis.closePositionPct <= 25 ? '#f87171' : '#f59e0b', marginTop: '2px' }}>
                {latestCandleAnalysis.closePositionPct}% ({latestCandleAnalysis.closeLocation})
              </div>
            </div>

            {/* Metric 4: Preceding Trend */}
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '10px', borderRadius: '6px' }}>
              <div style={{ fontSize: '10px', color: '#94a3b8' }}>BACKGROUND TREND</div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: latestCandleAnalysis.precedingTrend === 'UPTREND' ? '#34d399' : latestCandleAnalysis.precedingTrend === 'DOWNTREND' ? '#f87171' : '#e2e8f0', marginTop: '2px' }}>
                {latestCandleAnalysis.precedingTrend}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VSA Signal Scanner Table Header with Filter Tabs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Filter size={16} color="#3b82f6" /> RECENT VSA SIGNALS & TRADE RECOMMENDATIONS ({filteredSignals.length})
          </h3>

          {/* Filter Tabs */}
          <div style={{ display: 'flex', gap: '4px', background: '#1e293b', padding: '3px', borderRadius: '6px' }}>
            {[
              { id: 'ALL', label: 'ALL SIGNALS' },
              { id: 'BULLISH', label: '🟢 BULLISH VSA' },
              { id: 'BEARISH', label: '🔴 BEARISH VSA' },
              { id: 'TESTS', label: '⚡ TESTS (NO SUPPLY/DEMAND)' },
              { id: 'CLIMAX', label: '💥 CLIMAX / REVERSALS' }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSignalFilter(tab.id as any)}
                style={{
                  background: signalFilter === tab.id ? '#3b82f6' : 'transparent',
                  border: 'none',
                  color: signalFilter === tab.id ? '#ffffff' : '#94a3b8',
                  padding: '5px 10px',
                  fontSize: '11px',
                  fontWeight: '700',
                  borderRadius: '4px',
                  cursor: 'pointer'
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Signals Table */}
        <div style={{ overflowX: 'auto', background: '#0f172a', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'left' }}>
            <thead>
              <tr style={{ background: '#1e293b', color: '#94a3b8', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                <th style={{ padding: '10px 12px' }}>TIME / BAR</th>
                <th style={{ padding: '10px 12px' }}>VSA SIGNAL PATTERN</th>
                <th style={{ padding: '10px 12px' }}>TYPE</th>
                <th style={{ padding: '10px 12px' }}>WYCKOFF PHASE</th>
                <th style={{ padding: '10px 12px' }}>CONFIDENCE</th>
                <th style={{ padding: '10px 12px' }}>ACTIONABLE TRADE RECOMMENDATION</th>
                <th style={{ padding: '10px 12px' }}>TARGET / SL</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8' }}>
                    <RefreshCw size={20} className="spin" style={{ margin: '0 auto 8px auto' }} />
                    Scanning VSA signals...
                  </td>
                </tr>
              ) : filteredSignals.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', padding: '24px', color: '#64748b' }}>
                    No VSA signals matched the current filter criteria for {symbol}.
                  </td>
                </tr>
              ) : (
                filteredSignals.map((sig) => {
                  const badge = getSignalBadgeColor(sig.type);
                  const timeStr = new Date(sig.time * 1000).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
                  return (
                    <tr key={sig.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', background: 'transparent' }}>
                      <td style={{ padding: '10px 12px', color: '#cbd5e1', fontWeight: '700' }}>
                        {timeStr} <span style={{ fontSize: '10px', color: '#64748b' }}>(Bar #{sig.candleIndex})</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ fontWeight: '800', color: '#f8fafc', display: 'block' }}>{sig.name}</span>
                        <span style={{ fontSize: '10px', color: '#94a3b8' }}>{sig.description}</span>
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '800',
                          background: badge.bg,
                          border: `1px solid ${badge.border}`,
                          color: badge.text
                        }}>
                          {sig.type}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#60a5fa', fontWeight: '700', fontSize: '11px' }}>
                        {sig.wyckoffPhase}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '800', color: sig.confidence >= 90 ? '#34d399' : '#f59e0b' }}>
                        {sig.confidence}%
                      </td>
                      <td style={{ padding: '10px 12px', color: '#38bdf8', fontWeight: '700' }}>
                        {sig.tradeAction}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: '11px' }}>
                        <div style={{ color: '#34d399' }}>Tgt: <strong>{sig.targetPrice}</strong></div>
                        <div style={{ color: '#f87171' }}>SL: <strong>{sig.stopLoss}</strong></div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* VSA Core Concepts Interactive Cheat Sheet & Guide */}
      <div style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px', padding: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
          <BookOpen size={18} color="#eab308" />
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '800', color: '#ffffff' }}>
            📚 VSA & WYCKOFF CORE CONCEPTS CHEAT SHEET
          </h3>
        </div>

        {/* Concept Selector Buttons */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '12px' }}>
          {[
            { id: 'no_supply', label: '1. No Supply' },
            { id: 'no_demand', label: '2. No Demand' },
            { id: 'stopping_vol', label: '3. Stopping Volume' },
            { id: 'absorption_vol', label: '4. Absorption Volume' },
            { id: 'upthrust', label: '5. Upthrust' },
            { id: 'spring', label: '6. Spring / Shakeout' },
            { id: 'effort_result', label: '7. Effort vs Result' },
            { id: 'buying_climax', label: '8. Buying Climax' },
            { id: 'selling_climax', label: '9. Selling Climax' },
            { id: 'supply_test', label: '10. Supply Test' }
          ].map((g) => (
            <button
              key={g.id}
              onClick={() => setActiveGuideTab(g.id)}
              style={{
                background: activeGuideTab === g.id ? 'rgba(234, 179, 8, 0.2)' : '#1e293b',
                border: activeGuideTab === g.id ? '1px solid #eab308' : '1px solid rgba(255,255,255,0.08)',
                color: activeGuideTab === g.id ? '#fde047' : '#94a3b8',
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                whiteSpace: 'nowrap'
              }}
            >
              {g.label}
            </button>
          ))}
        </div>

        {/* Concept Detail View */}
        <div style={{ background: '#1e293b', padding: '14px', borderRadius: '6px', fontSize: '13px', lineHeight: '1.6' }}>
          {activeGuideTab === 'no_supply' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#34d399' }}>🟢 1. No Supply (Bullish)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Narrow or average spread down bar with volume lower than preceding two bars and below 20-period SMA volume.<br />
                <strong>Context:</strong> Appears during uptrends or pullbacks to key support/moving averages.<br />
                <strong>Meaning:</strong> Professional sellers have withdrawn. Supply is depleted. Low-risk entry for long positions (BUY CE).
              </p>
            </div>
          )}
          {activeGuideTab === 'no_demand' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#f87171' }}>🔴 2. No Demand (Bearish)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Narrow or average spread up bar with volume lower than preceding two bars and below 20-period SMA volume.<br />
                <strong>Context:</strong> Appears during downtrends or weak rallies into resistance.<br />
                <strong>Meaning:</strong> Professional buyers are not supporting higher prices. Low-risk short entry (BUY PE).
              </p>
            </div>
          )}
          {activeGuideTab === 'stopping_vol' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#34d399' }}>🟢 3. Stopping Volume (Bullish Reversal)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Wide spread down bar with High/Ultra-High volume that closes in the upper half or off the low.<br />
                <strong>Context:</strong> Occurs after a sustained price decline.<br />
                <strong>Meaning:</strong> Institutional money step in and absorb panic selling, capping the markdown phase.
              </p>
            </div>
          )}
          {activeGuideTab === 'absorption_vol' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#34d399' }}>🟢 4. Absorption Volume (Bullish Breakout)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> High/Ultra-High volume up bar closing at top 25% of range near multi-bar highs.<br />
                <strong>Context:</strong> Approaching major resistance level.<br />
                <strong>Meaning:</strong> Smart money is aggressively absorbing remaining overhead supply before driving a major breakout.
              </p>
            </div>
          )}
          {activeGuideTab === 'upthrust' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#f87171' }}>🔴 5. Upthrust (Bearish Reversal / Bull Trap)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Candle pushes above recent resistance/highs during the session but collapses to close in the bottom 30%.<br />
                <strong>Context:</strong> Wyckoff Phase C Distribution / Bull Trap.<br />
                <strong>Meaning:</strong> Traps breakout buyers and sweeps buy stops before aggressive distribution downward.
              </p>
            </div>
          )}
          {activeGuideTab === 'spring' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#34d399' }}>🟢 6. Spring / Shakeout (Bullish Reversal / Bear Trap)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Candle dips below recent support/lows, triggering stop-losses, but quickly recovers to close in upper range.<br />
                <strong>Context:</strong> Wyckoff Phase C Accumulation.<br />
                <strong>Meaning:</strong> Traps weak shorts and clears liquidity before major Markup phase.
              </p>
            </div>
          )}
          {activeGuideTab === 'effort_result' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#c084fc' }}>⚡ 7. Effort vs Result (Divergence)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Heavy/Ultra-High volume bar with very narrow price spread (range).<br />
                <strong>Context:</strong> Near key support or resistance levels.<br />
                <strong>Meaning:</strong> Huge volume effort with zero price progress indicates hidden institutional absorption opposing the current trend.
              </p>
            </div>
          )}
          {activeGuideTab === 'buying_climax' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#f87171' }}>🔴 8. Buying Climax (Bearish Top)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Ultra-High volume, wide spread up bar closing off the high after a long upward trend.<br />
                <strong>Context:</strong> Peak of extended rally.<br />
                <strong>Meaning:</strong> Smart money is transferring inventory into late retail FOMO buyers. Precedes distribution top.
              </p>
            </div>
          )}
          {activeGuideTab === 'selling_climax' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#34d399' }}>🟢 9. Selling Climax (Bullish Bottom)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Ultra-High volume, wide spread down bar closing off the low after a long downward trend.<br />
                <strong>Context:</strong> Bottom of extended decline.<br />
                <strong>Meaning:</strong> Smart money absorbs panic selling in bulk. Marks initiation of accumulation phase.
              </p>
            </div>
          )}
          {activeGuideTab === 'supply_test' && (
            <div>
              <h4 style={{ margin: '0 0 6px 0', color: '#34d399' }}>🟢 10. Supply Test (Bullish Confirmation)</h4>
              <p style={{ margin: 0, color: '#cbd5e1' }}>
                <strong>Characteristics:</strong> Low volume dip into previous support or breakdown area, closing in upper half of bar.<br />
                <strong>Context:</strong> Prior to markup phase initiation.<br />
                <strong>Meaning:</strong> Confirms floating supply is completely cleared. Green light for strong upward price expansion.
              </p>
            </div>
          )}
        </div>
      </div>

    </div>
  );
};
