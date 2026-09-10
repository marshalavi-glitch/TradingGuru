import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, TrendingUp, AlertTriangle, ShieldCheck, Zap } from 'lucide-react';

interface SymbolSkewData {
  skewSpreadPct: number;
  gammaRatio: number;
  totalStraddle: number;
  earlyWarningSignal?: string;
  earlyWarningAction?: string;
  earlyWarningConfidence?: number;
  expectedMoveDirection?: string;
}

export function HourlyUpdatesContainer() {
  const [timeline, setTimeline] = useState<HourlyTimelineSlot[]>([]);
  const [niftySpot, setNiftySpot] = useState<number>(0);
  const [bankSpot, setBankSpot] = useState<number>(0);
  const [niftySkewData, setNiftySkewData] = useState<SymbolSkewData | null>(null);
  const [bankSkewData, setBankSkewData] = useState<SymbolSkewData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);

  useEffect(() => {
    let isMounted = true;
    const fetchHourlyData = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/scanner/opening-bias?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setTimeline(json.hourlyTimeline || []);
            setNiftySpot(Number(json.nifty?.currentPrice || json.nifty?.openPrice || 24470));
            setBankSpot(Number(json.banknifty?.currentPrice || json.banknifty?.openPrice || 57180));
            setNiftySkewData(json.nifty?.straddleSkew || null);
            setBankSkewData(json.banknifty?.straddleSkew || null);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch hourly updates:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchHourlyData();
    const interval = setInterval(fetchHourlyData, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

  const activeSlot = timeline.find(t => t.isActive);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', flex: 1, overflowY: 'auto', boxSizing: 'border-box' }}>
      
      {/* Top Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(147, 51, 234, 0.1) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.25)',
        borderRadius: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '12px' }}>
            <Clock size={28} color="#3b82f6" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
                ⏱️ Hourly Market & ATM Skew Updates
              </h2>
              <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', padding: '3px 10px', borderRadius: '20px' }}>
                LIVE REAL-TIME TRACKER
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Full chronological record of straddle decay, option skew transitions, and institutional drivers across every hour of trading.
            </p>
          </div>
        </div>

        {/* Live Index Quick Badges & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>NIFTY SPOT: </span>
            <strong style={{ fontSize: '14px', color: '#60a5fa' }}>₹{niftySpot.toFixed(2)}</strong>
          </div>
          <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 14px', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>BANK NIFTY: </span>
            <strong style={{ fontSize: '14px', color: '#a78bfa' }}>₹{bankSpot.toFixed(2)}</strong>
          </div>
          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="glass-button"
            style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderRadius: '10px', fontWeight: '700', fontSize: '12px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* 🚀 REAL-TIME EARLY MOVE WARNING ENGINE (1-3 MIN PRE-BREAKOUT DETECTOR) */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '16px' }}>
        
        {/* NIFTY Early Warning Card */}
        <div style={{
          padding: '18px 20px',
          borderRadius: '14px',
          background: niftySkewData && Math.abs(niftySkewData.skewSpreadPct) > 15 ? 'rgba(239, 68, 68, 0.12)' : 'rgba(15, 23, 42, 0.8)',
          border: `1px solid ${niftySkewData && Math.abs(niftySkewData.skewSpreadPct) > 15 ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="#3b82f6" />
              <strong style={{ fontSize: '14px', color: 'white' }}>NIFTY EARLY MOVE SIGNAL (1-3 MIN FORECAST)</strong>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '3px 8px', borderRadius: '6px' }}>
              CONFIDENCE: {niftySkewData?.earlyWarningConfidence || 50}%
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: niftySkewData?.skewSpreadPct && niftySkewData.skewSpreadPct > 15 ? '#10b981' : (niftySkewData?.skewSpreadPct && niftySkewData.skewSpreadPct < -15 ? '#ef4444' : '#fef08a') }}>
            {niftySkewData?.earlyWarningSignal || '⚖️ SKEW EQUILIBRIUM: ROTATION MODE'}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {niftySkewData?.earlyWarningAction || 'Smart money writing straddles. Watch for skew velocity jump >3% to trigger pre-breakout entry.'}
          </p>
        </div>

        {/* BANKNIFTY Early Warning Card */}
        <div style={{
          padding: '18px 20px',
          borderRadius: '14px',
          background: bankSkewData && Math.abs(bankSkewData.skewSpreadPct) > 15 ? 'rgba(16, 185, 129, 0.12)' : 'rgba(15, 23, 42, 0.8)',
          border: `1px solid ${bankSkewData && Math.abs(bankSkewData.skewSpreadPct) > 15 ? 'rgba(16, 185, 129, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Zap size={18} color="#a78bfa" />
              <strong style={{ fontSize: '14px', color: 'white' }}>BANK NIFTY EARLY MOVE SIGNAL (1-3 MIN FORECAST)</strong>
            </div>
            <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(167, 139, 250, 0.2)', color: '#a78bfa', padding: '3px 8px', borderRadius: '6px' }}>
              CONFIDENCE: {bankSkewData?.earlyWarningConfidence || 50}%
            </span>
          </div>
          <div style={{ fontSize: '15px', fontWeight: '800', color: bankSkewData?.skewSpreadPct && bankSkewData.skewSpreadPct > 15 ? '#10b981' : (bankSkewData?.skewSpreadPct && bankSkewData.skewSpreadPct < -15 ? '#ef4444' : '#fef08a') }}>
            {bankSkewData?.earlyWarningSignal || '⚖️ SKEW EQUILIBRIUM: ROTATION MODE'}
          </div>
          <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-secondary)' }}>
            {bankSkewData?.earlyWarningAction || 'Smart money writing straddles. Watch for skew velocity jump >3% to trigger pre-breakout entry.'}
          </p>
        </div>

      </div>

      {/* Live "What to Expect Next & Suggested Trade" Spotlight Card */}
      {activeSlot && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '18px 24px',
          borderRadius: '14px',
          background: 'linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
          border: '1px solid rgba(16, 185, 129, 0.35)',
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'fadeIn 0.3s ease-in-out'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div style={{ background: 'rgba(16, 185, 129, 0.2)', padding: '10px', borderRadius: '10px' }}>
              <Zap size={26} color="#10b981" className="animate-pulse" />
            </div>
            <div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                CURRENT ACTIVE PERIOD ({activeSlot.timeWindow})
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#fef08a', marginTop: '2px' }}>
                🎯 Live Trade Setup: {activeSlot.suggestedTrade || 'Buy ATM Calls on 5m pullbacks / Range Breakout'}
              </div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                👉 What To Expect Next: {activeSlot.whatToExpectNext}
              </div>
            </div>
          </div>
          <span style={{ fontSize: '12px', fontWeight: '800', background: '#10b981', color: 'white', padding: '6px 16px', borderRadius: '8px' }}>
            LIVE ACTIONABLE SETUP
          </span>
        </div>
      )}

      {/* Main Full View Timeline Table Card */}
      <div className="glass-panel animate-fade-in" style={{ padding: '24px', borderRadius: '16px', border: '1px solid rgba(255, 255, 255, 0.08)', background: '#0f172a' }}>
        <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '1200px' }}>
            <thead>
              <tr style={{ background: '#1e293b', borderBottom: '2px solid rgba(255, 255, 255, 0.1)' }}>
                <th style={{ padding: '16px 18px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', width: '16%' }}>Time Window</th>
                <th style={{ padding: '16px 18px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', width: '11%' }}>NIFTY Skew</th>
                <th style={{ padding: '16px 18px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', width: '12%' }}>NIFTY Straddle</th>
                <th style={{ padding: '16px 18px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', width: '11%' }}>BANK NIFTY Skew</th>
                <th style={{ padding: '16px 18px', color: '#94a3b8', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', width: '18%' }}>Market Action & What Happened</th>
                <th style={{ padding: '16px 18px', color: '#10b981', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', width: '20%' }}>🎯 Suggested Live Trade</th>
                <th style={{ padding: '16px 18px', color: '#eab308', fontWeight: '800', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.5px', width: '12%' }}>⚡ What To Expect</th>
              </tr>
            </thead>
            <tbody>
              {timeline.length > 0 ? (
                timeline.map((row, idx) => {
                  const isSpikeNifty = row.niftySkew.includes('15') || row.niftySkew.includes('16') || row.niftySkew.includes('17') || row.niftySkew.includes('18');
                  const isSpikeBank = row.bankniftySkew.includes('15') || row.bankniftySkew.includes('16') || row.bankniftySkew.includes('17') || row.bankniftySkew.includes('18');

                  return (
                    <tr 
                      key={idx} 
                      style={{ 
                        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
                        background: row.isActive ? 'rgba(59, 130, 246, 0.15)' : (idx % 2 === 0 ? 'rgba(30, 41, 59, 0.4)' : 'rgba(15, 23, 42, 0.5)'),
                        transition: 'all 0.15s'
                      }}
                    >
                      {/* Time Window */}
                      <td style={{ padding: '18px 18px', fontWeight: '700', color: row.isActive ? '#60a5fa' : '#f1f5f9', verticalAlign: 'middle' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {row.isActive ? (
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#3b82f6', boxShadow: '0 0 10px #3b82f6', animation: 'pulse 1.5s infinite' }} />
                          ) : (
                            <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'rgba(255,255,255,0.2)' }} />
                          )}
                          <span style={{ fontSize: '13px' }}>{row.timeWindow}</span>
                        </div>
                      </td>

                      {/* NIFTY Skew */}
                      <td style={{ padding: '18px 18px', verticalAlign: 'middle' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '6px 12px', 
                          borderRadius: '8px', 
                          fontWeight: '800', 
                          fontSize: '12px',
                          background: isSpikeNifty ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSpikeNifty ? '#f87171' : '#e2e8f0',
                          border: `1px solid ${isSpikeNifty ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`
                        }}>
                          {row.niftySkew} {isSpikeNifty ? '🚨' : ''}
                        </span>
                      </td>

                      {/* NIFTY Straddle Price */}
                      <td style={{ padding: '18px 18px', verticalAlign: 'middle' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '6px 12px', 
                          borderRadius: '8px', 
                          fontWeight: '800', 
                          fontSize: '12px',
                          background: 'rgba(59, 130, 246, 0.12)',
                          color: '#60a5fa',
                          border: '1px solid rgba(59, 130, 246, 0.25)'
                        }}>
                          {row.niftyStraddlePrice}
                        </span>
                      </td>

                      {/* BANK NIFTY Skew */}
                      <td style={{ padding: '18px 18px', verticalAlign: 'middle' }}>
                        <span style={{ 
                          display: 'inline-block',
                          padding: '6px 12px', 
                          borderRadius: '8px', 
                          fontWeight: '800', 
                          fontSize: '12px',
                          background: isSpikeBank ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                          color: isSpikeBank ? '#f87171' : '#e2e8f0',
                          border: `1px solid ${isSpikeBank ? 'rgba(239, 68, 68, 0.4)' : 'rgba(255, 255, 255, 0.08)'}`
                        }}>
                          {row.bankniftySkew} {isSpikeBank ? '🚨' : ''}
                        </span>
                      </td>

                      {/* Market Action */}
                      <td style={{ padding: '18px 18px', color: '#cbd5e1', fontSize: '13px', lineHeight: '1.5', verticalAlign: 'middle' }}>
                        {row.marketAction}
                      </td>

                      {/* Suggested Live Trade */}
                      <td style={{ padding: '18px 18px', color: '#86efac', fontSize: '13px', lineHeight: '1.5', verticalAlign: 'middle', fontWeight: '700' }}>
                        {row.suggestedTrade || '—'}
                      </td>

                      {/* What to Expect Next */}
                      <td style={{ padding: '18px 18px', color: '#fef08a', fontSize: '12px', lineHeight: '1.5', verticalAlign: 'middle' }}>
                        {row.whatToExpectNext || '—'}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={7} style={{ padding: '40px', textAlign: 'center', color: '#94a3b8' }}>
                    {loading ? 'Fetching live timeline records...' : 'No timeline records compiled yet for today.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
