import React, { useState, useEffect } from 'react';
import { RefreshCw, Clock, Terminal, Activity, ShieldCheck, Zap, TrendingUp, TrendingDown, Target } from 'lucide-react';

interface AssetForensic {
  spot: number;
  strike: number;
  ceLtp: string;
  peLtp: string;
  totalStraddle: string;
  skewSpreadPct: string;
  gammaRatio: string;
  verdict: string;
  verdictType: 'bullish_writing' | 'bearish_buying' | 'equilibrium';
  smartMoneyAction: string;
  whatToExpect: string;
}

interface ForensicReportItem {
  id: string;
  timeWindow: string;
  isActive: boolean;
  isCompleted: boolean;
  nifty: AssetForensic;
  banknifty: AssetForensic;
}

export function FifteenMinForensicContainer() {
  const [reports, setReports] = useState<ForensicReportItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [selectedAsset, setSelectedAsset] = useState<'both' | 'nifty' | 'banknifty'>('both');

  useEffect(() => {
    let isMounted = true;
    const fetchReports = async () => {
      try {
        const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
        const res = await fetch(`${backendUrl}/api/scanner/opening-bias?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setReports(json.forensicReports || []);
            setLoading(false);
          }
        }
      } catch (err) {
        console.error('Failed to fetch 15-min forensic reports:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchReports();
    const interval = setInterval(fetchReports, 2000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', flex: 1, overflowY: 'auto', boxSizing: 'border-box', background: '#0a0d14' }}>
      
      {/* Top Header Banner */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '20px 24px',
        background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(30, 41, 59, 0.9) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.3)',
        borderRadius: '14px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.6)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ background: 'rgba(59, 130, 246, 0.2)', padding: '12px', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.4)' }}>
            <Terminal size={28} color="#60a5fa" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '22px', fontWeight: '900', color: 'white', letterSpacing: '-0.3px', fontFamily: 'monospace' }}>
                ⏱️ 15-MIN LIVE OPTION FORENSIC REPORT
              </h2>
              <span style={{ fontSize: '11px', fontWeight: '900', background: '#2563eb', color: 'white', padding: '3px 10px', borderRadius: '14px' }}>
                NIFTY & BANK NIFTY
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8', fontFamily: 'monospace' }}>
              Autonomous Institutional Forensic Log: [1] Live Numbers, [2] Verdict & Proof, [3] Smart Money Intent & 03:30 PM Forecasts.
            </p>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.6)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <button
              onClick={() => setSelectedAsset('both')}
              style={{
                background: selectedAsset === 'both' ? '#2563eb' : 'transparent',
                border: 'none',
                color: 'white',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Both
            </button>
            <button
              onClick={() => setSelectedAsset('nifty')}
              style={{
                background: selectedAsset === 'nifty' ? '#2563eb' : 'transparent',
                border: 'none',
                color: 'white',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              NIFTY 50
            </button>
            <button
              onClick={() => setSelectedAsset('banknifty')}
              style={{
                background: selectedAsset === 'banknifty' ? '#7c3aed' : 'transparent',
                border: 'none',
                color: 'white',
                padding: '6px 14px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              BANK NIFTY
            </button>
          </div>

          <button
            onClick={() => setRefreshKey(k => k + 1)}
            className="glass-button"
            style={{ padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderRadius: '8px', fontWeight: '700', fontSize: '12px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Forensic Report ASCII Box Cards (Latest First) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {reports.slice().reverse().map((rep) => (
          <div
            key={rep.id}
            style={{
              padding: '24px',
              borderRadius: '14px',
              background: '#0d1117',
              border: rep.isActive ? '2px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
              boxShadow: rep.isActive ? '0 0 25px rgba(59, 130, 246, 0.3)' : '0 8px 32px rgba(0,0,0,0.6)',
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
              fontFamily: 'monospace'
            }}
          >
            {/* Window Tag */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed rgba(255,255,255,0.15)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#60a5fa' }}>
                  ⏱️ TIME WINDOW: {rep.timeWindow}
                </span>
                {rep.isActive && (
                  <span style={{ fontSize: '11px', fontWeight: '900', background: '#ef4444', color: 'white', padding: '3px 10px', borderRadius: '10px', animation: 'pulse 1.5s infinite' }}>
                    🔴 LIVE ACTIVE PERIOD
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                15-Min Snapshot Log
              </span>
            </div>

            {/* Grid for Asset ASCII Boxes */}
            <div style={{ display: 'grid', gridTemplateColumns: selectedAsset === 'both' ? 'repeat(auto-fit, minmax(520px, 1fr))' : '1fr', gap: '20px' }}>
              
              {/* NIFTY 50 ASCII TERMINAL BOX */}
              {(selectedAsset === 'both' || selectedAsset === 'nifty') && (
                <div style={{
                  background: '#090d16',
                  border: '1px solid #1e3a8a',
                  borderRadius: '10px',
                  padding: '18px 22px',
                  color: '#e2e8f0',
                  lineHeight: '1.5',
                  fontSize: '13px'
                }}>
                  <div style={{ color: '#38bdf8', fontWeight: '900', borderBottom: '1px solid #1e3a8a', paddingBottom: '6px', marginBottom: '12px', fontSize: '14px' }}>
                    ══════════════ NIFTY 50 FORENSIC REPORT ({rep.timeWindow}) ══════════════
                  </div>

                  <div style={{ color: '#facc15', fontWeight: '800', marginBottom: '6px' }}>
                    📍 1️⃣ LIVE NUMBERS:
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#cbd5e1', marginBottom: '14px' }}>
                    • Nifty Spot Price     : <strong style={{ color: '#60a5fa' }}>₹{rep.nifty.spot.toFixed(2)}</strong><br />
                    • ATM Strike Examined  : <strong style={{ color: '#ffffff' }}>{rep.nifty.strike} Strike</strong> (Active Contract Series)<br />
                    • {rep.nifty.strike} Call (CE) LTP  : <strong style={{ color: '#86efac' }}>₹{rep.nifty.ceLtp}</strong><br />
                    • {rep.nifty.strike} Put (PE) LTP   : <strong style={{ color: '#fca5a5' }}>₹{rep.nifty.peLtp}</strong><br />
                    • Total Straddle Price : <strong style={{ color: '#fde047' }}>₹{rep.nifty.totalStraddle}</strong> (Combined ATM Premium)<br />
                    • Skew Spread %        : <strong style={{ color: Number(rep.nifty.skewSpreadPct) > 0 ? '#86efac' : '#f87171' }}>{Number(rep.nifty.skewSpreadPct) > 0 ? '+' : ''}{rep.nifty.skewSpreadPct}%</strong> ({Number(rep.nifty.skewSpreadPct) > 0 ? 'Positive Call Bloat' : 'Negative Put Bloat'})<br />
                    • Gamma Ratio (Γ)      : <strong style={{ color: '#facc15' }}>{rep.nifty.gammaRatio}x</strong> ({Number(rep.nifty.gammaRatio) < 0.5 ? 'Put Volume ~2x Call Volume' : 'Balanced Volume Flow'})
                  </div>

                  <div style={{ borderTop: '1px dashed #1e3a8a', paddingTop: '10px', color: '#f87171', fontWeight: '800', marginBottom: '6px' }}>
                    🎯 2️⃣ THE FORENSIC VERDICT:
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#86efac', fontWeight: '900', marginBottom: '4px' }}>
                    👉 👉 👉 {rep.nifty.verdict} 👈 👈 👈
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#94a3b8', fontSize: '12px', marginBottom: '14px' }}>
                    • {rep.nifty.smartMoneyAction}
                  </div>

                  <div style={{ borderTop: '1px dashed #1e3a8a', paddingTop: '10px', color: '#38bdf8', fontWeight: '800', marginBottom: '6px' }}>
                    💡 3️⃣ WHAT SMART MONEY IS DOING & WHAT TO EXPECT:
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#bfdbfe', fontSize: '12px' }}>
                    • {rep.nifty.whatToExpect}
                  </div>
                </div>
              )}

              {/* BANK NIFTY ASCII TERMINAL BOX */}
              {(selectedAsset === 'both' || selectedAsset === 'banknifty') && (
                <div style={{
                  background: '#0e0b16',
                  border: '1px solid #581c87',
                  borderRadius: '10px',
                  padding: '18px 22px',
                  color: '#e2e8f0',
                  lineHeight: '1.5',
                  fontSize: '13px'
                }}>
                  <div style={{ color: '#c084fc', fontWeight: '900', borderBottom: '1px solid #581c87', paddingBottom: '6px', marginBottom: '12px', fontSize: '14px' }}>
                    ════════════ BANK NIFTY FORENSIC REPORT ({rep.timeWindow}) ════════════
                  </div>

                  <div style={{ color: '#facc15', fontWeight: '800', marginBottom: '6px' }}>
                    📍 1️⃣ LIVE NUMBERS:
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#cbd5e1', marginBottom: '14px' }}>
                    • Bank Nifty Spot      : <strong style={{ color: '#c084fc' }}>₹{rep.banknifty.spot.toFixed(2)}</strong><br />
                    • ATM Strike Examined  : <strong style={{ color: '#ffffff' }}>{rep.banknifty.strike} Strike</strong><br />
                    • {rep.banknifty.strike} Call (CE) LTP : <strong style={{ color: '#86efac' }}>₹{rep.banknifty.ceLtp}</strong><br />
                    • {rep.banknifty.strike} Put (PE) LTP  : <strong style={{ color: '#fca5a5' }}>₹{rep.banknifty.peLtp}</strong><br />
                    • Total Straddle Price : <strong style={{ color: '#fde047' }}>₹{rep.banknifty.totalStraddle}</strong><br />
                    • Skew Spread %        : <strong style={{ color: Number(rep.banknifty.skewSpreadPct) > 0 ? '#86efac' : '#f87171' }}>{Number(rep.banknifty.skewSpreadPct) > 0 ? '+' : ''}{rep.banknifty.skewSpreadPct}%</strong> (Institutional Call Bloat)<br />
                    • Gamma Ratio (Γ)      : <strong style={{ color: '#facc15' }}>{rep.banknifty.gammaRatio}x</strong> (Coiled Spring Equilibrium)
                  </div>

                  <div style={{ borderTop: '1px dashed #581c87', paddingTop: '10px', color: '#f87171', fontWeight: '800', marginBottom: '6px' }}>
                    🎯 2️⃣ THE FORENSIC VERDICT:
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#c084fc', fontWeight: '900', marginBottom: '4px' }}>
                    👉 👉 👉 {rep.banknifty.verdict} 👈 👈 👈
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#94a3b8', fontSize: '12px', marginBottom: '14px' }}>
                    • {rep.banknifty.smartMoneyAction}
                  </div>

                  <div style={{ borderTop: '1px dashed #581c87', paddingTop: '10px', color: '#c084fc', fontWeight: '800', marginBottom: '6px' }}>
                    💡 3️⃣ WHAT SMART MONEY IS DOING & WHAT TO EXPECT:
                  </div>
                  <div style={{ paddingLeft: '12px', color: '#e9d5ff', fontSize: '12px' }}>
                    • {rep.banknifty.whatToExpect}
                  </div>
                </div>
              )}

            </div>

          </div>
        ))}
      </div>

    </div>
  );
}
