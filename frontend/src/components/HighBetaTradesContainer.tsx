import React, { useState, useMemo, useRef, useEffect } from 'react';
import { RefreshCw, ArrowUpRight, ArrowDownRight, Layers, HelpCircle, ChevronDown, Check } from 'lucide-react';

interface StrikeGexData {
  strike: number;
  netGex: number; // in k ₹Cr
  callGex: number;
  putGex: number;
  concentration: number; // 0 to 8.0k scale for curve
}

interface IndexGexProfile {
  name: string;
  spot: number;
  netGexCr: string;
  netGexSign: 'positive' | 'negative';
  gexMomentum5m: string;
  gexMomentum15m: string;
  gexMomentumDay: string;
  flipLow: number;
  flipHigh: number;
  flipEst: number;
  flipSpreadPts: number;
  callWall: number;
  putWall: number;
  totalAbsGex: string;
  expiryDate: string;
  dte: number;
  updatedTime: string;
  strikes: StrikeGexData[];
}

// Generate realistic Gamma Exposure profiles matching media_1790925206843.png
function generateGexProfile(indexName: string): IndexGexProfile {
  if (indexName === 'NIFTY') {
    const spot = 22421.95;
    const putWall = 22300;
    const flipEst = 22364;
    const callWall = 22700;
    const startStrike = 20950;
    const endStrike = 23850;
    const step = 100;

    const strikes: StrikeGexData[] = [];
    for (let s = startStrike; s <= endStrike; s += step) {
      // Shape matching user screenshot media_1790925206843.png
      let netGex = 0;
      let concentration = 0;

      // Distance from ATM/spot
      const distFromSpot = (s - spot) / 450;
      const bellCurve = Math.exp(-0.5 * Math.pow(distFromSpot, 2));

      // Concentration curve (peaks around 22300 to 22650 with local bumps)
      const bump1 = Math.exp(-0.5 * Math.pow((s - 22300) / 120, 2)) * 5.2;
      const bump2 = Math.exp(-0.5 * Math.pow((s - 22450) / 100, 2)) * 6.4;
      const bump3 = Math.exp(-0.5 * Math.pow((s - 22650) / 110, 2)) * 4.9;
      const bump4 = Math.exp(-0.5 * Math.pow((s - 21950) / 150, 2)) * 2.3;
      const bump5 = Math.exp(-0.5 * Math.pow((s - 22950) / 140, 2)) * 2.4;
      const baseCurve = Math.max(0.1, bellCurve * 3.8 + (Math.sin(s / 180) * 0.4));
      concentration = Math.max(0.2, Math.min(7.8, baseCurve + bump1 + bump2 + bump3 + bump4 + bump5));

      if (s < flipEst) {
        // Put GEX / dealer-amplifying negative bars
        if (s === 22300) netGex = -3.2; // Put Wall
        else if (s === 22250) netGex = -2.8;
        else if (s === 22150) netGex = -2.7;
        else if (s === 21950) netGex = -2.5;
        else if (s === 22350) netGex = -0.7;
        else if (s === 22200) netGex = -0.9;
        else if (s === 22100) netGex = -1.1;
        else if (s === 22050) netGex = -0.4;
        else if (s === 21900) netGex = -0.7;
        else if (s === 21850) netGex = -0.5;
        else if (s === 21650) netGex = -0.4;
        else if (s === 21550) netGex = -0.5;
        else netGex = -Math.max(0, Math.sin((s - 21000) / 400) * 0.8);
      } else {
        // Call GEX / dealer-stabilizing positive bars
        if (s === 22700) netGex = 3.6; // Call Wall peak
        else if (s === 22650) netGex = 3.2;
        else if (s === 22600) netGex = 2.8;
        else if (s === 22550) netGex = 2.0;
        else if (s === 22450) netGex = 0.8;
        else if (s === 22500) netGex = 1.3;
        else if (s === 22750) netGex = 1.4;
        else if (s === 22800) netGex = 2.6;
        else if (s === 22850) netGex = 0.9;
        else if (s === 22950) netGex = 2.4;
        else if (s === 23050) netGex = 0.5;
        else if (s === 23200) netGex = 0.8;
        else if (s === 23300) netGex = 0.4;
        else if (s === 23550) netGex = 0.3;
        else netGex = Math.max(0, Math.sin((23800 - s) / 500) * 0.7);
      }

      const callGex = netGex > 0 ? netGex : Math.max(0.1, 0.4 - Math.abs(netGex) * 0.1);
      const putGex = netGex < 0 ? Math.abs(netGex) : Math.max(0.1, 0.3);

      strikes.push({
        strike: s,
        netGex: Math.round(netGex * 10) / 10,
        callGex: Math.round(callGex * 10) / 10,
        putGex: Math.round(putGex * 10) / 10,
        concentration: Math.round(concentration * 10) / 10
      });
    }

    return {
      name: 'NIFTY',
      spot,
      netGexCr: '+6.6k',
      netGexSign: 'positive',
      gexMomentum5m: '-2.1',
      gexMomentum15m: '-5.8',
      gexMomentumDay: '-309',
      flipLow: 22351,
      flipHigh: 22376,
      flipEst,
      flipSpreadPts: 25,
      callWall,
      putWall,
      totalAbsGex: '72.6k',
      expiryDate: '2026-10-06',
      dte: 4,
      updatedTime: '08:49:31 IST',
      strikes
    };
  }

  // Fallback / other indices
  const spotBase: Record<string, { spot: number; step: number; range: number; call: number; put: number; flip: number }> = {
    BANKNIFTY: { spot: 49150.40, step: 200, range: 4000, call: 49500, put: 48500, flip: 48950 },
    SENSEX: { spot: 73850.20, step: 200, range: 4000, call: 74500, put: 73000, flip: 73550 },
    FINNIFTY: { spot: 23120.80, step: 100, range: 2400, call: 23400, put: 22900, flip: 23050 },
    MIDCPNIFTY: { spot: 12180.50, step: 50, range: 1200, call: 12350, put: 12000, flip: 12120 },
    BANKEX: { spot: 55420.30, step: 200, range: 4000, call: 56000, put: 54800, flip: 55250 }
  };

  const meta = spotBase[indexName] || spotBase.BANKNIFTY;
  const startStrike = Math.floor((meta.spot - meta.range / 2) / meta.step) * meta.step;
  const endStrike = Math.ceil((meta.spot + meta.range / 2) / meta.step) * meta.step;
  const strikes: StrikeGexData[] = [];

  for (let s = startStrike; s <= endStrike; s += meta.step) {
    const isCall = s >= meta.flip;
    const dist = Math.abs(s - meta.spot) / (meta.range * 0.4);
    const mag = Math.max(0.2, (1 - dist) * 3.5);
    const netGex = isCall ? mag : -mag;
    const concentration = Math.min(7.5, mag * 1.8 + 0.4);
    strikes.push({
      strike: s,
      netGex: Math.round(netGex * 10) / 10,
      callGex: isCall ? mag : 0.3,
      putGex: !isCall ? mag : 0.3,
      concentration: Math.round(concentration * 10) / 10
    });
  }

  return {
    name: indexName,
    spot: meta.spot,
    netGexCr: '+14.2k',
    netGexSign: 'positive',
    gexMomentum5m: '-1.4',
    gexMomentum15m: '-3.2',
    gexMomentumDay: '-185',
    flipLow: meta.flip - 30,
    flipHigh: meta.flip + 20,
    flipEst: meta.flip,
    flipSpreadPts: 50,
    callWall: meta.call,
    putWall: meta.put,
    totalAbsGex: '104.8k',
    expiryDate: '2026-10-06',
    dte: 4,
    updatedTime: '08:49:31 IST',
    strikes
  };
}

export const HighBetaTradesContainer: React.FC = () => {
  const [selectedIndex, setSelectedIndex] = useState<string>('NIFTY');
  const [viewExpiry, setViewExpiry] = useState<'Nearest' | 'All expiries'>('Nearest');
  const [viewType, setViewType] = useState<'Net' | 'Call vs Put' | 'Table'>('Net');
  const [hoveredStrike, setHoveredStrike] = useState<StrikeGexData | null>(null);
  const [mousePos, setMousePos] = useState<{ x: number; y: number } | null>(null);

  const indices = ['NIFTY', 'BANKNIFTY', 'SENSEX', 'FINNIFTY', 'MIDCPNIFTY', 'BANKEX'];
  const profile = useMemo(() => generateGexProfile(selectedIndex), [selectedIndex]);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Render Gamma Exposure Chart matching media_1790925206843.png
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = canvas.parentElement?.clientWidth || 1100;
    const height = 440;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    // Ultra-dark background
    ctx.fillStyle = '#080c14';
    ctx.fillRect(0, 0, width, height);

    const padding = { top: 70, bottom: 45, left: 60, right: 30 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Y Axis Range: -3.0k to +8.0k
    const yMin = -3.0;
    const yMax = 8.0;
    const yRange = yMax - yMin;

    const getY = (val: number) => {
      return padding.top + ((yMax - val) / yRange) * chartHeight;
    };

    const zeroY = getY(0);

    // Draw horizontal dashed grid lines
    const yTicks = [-2.0, 0.0, 2.0, 4.0, 6.0, 8.0];
    ctx.lineWidth = 1;
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';

    yTicks.forEach(tick => {
      const y = getY(tick);
      ctx.strokeStyle = tick === 0 ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.05)';
      ctx.setLineDash(tick === 0 ? [] : [3, 4]);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(width - padding.right, y);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#64748b';
      const label = tick === 0 ? '0.0' : `${tick > 0 ? '' : ''}${tick.toFixed(1)}k`;
      ctx.fillText(label, padding.left - 10, y + 3.5);
    });

    const strikes = profile.strikes;
    if (strikes.length === 0) return;

    const numStrikes = strikes.length;
    const barSlotWidth = chartWidth / numStrikes;
    const barWidth = Math.max(5, barSlotWidth * 0.72);

    const getXForStrike = (strike: number) => {
      const minS = strikes[0].strike;
      const maxS = strikes[numStrikes - 1].strike;
      const ratio = (strike - minS) / (maxS - minS);
      return padding.left + ratio * chartWidth;
    };

    // 1. Draw Vertical Dashed Marker Lines & Badges for Walls, Flip, Spot
    const markers = [
      {
        label: `PUT WALL ${profile.putWall.toLocaleString('en-IN')}`,
        strike: profile.putWall,
        color: '#ef4444',
        bg: 'rgba(127, 29, 29, 0.85)',
        badgeY: padding.top - 46,
        lineColor: 'rgba(239, 68, 68, 0.65)'
      },
      {
        label: `FLIP ${profile.flipEst.toLocaleString('en-IN')}`,
        strike: profile.flipEst,
        color: '#eab308',
        bg: 'rgba(113, 63, 18, 0.85)',
        badgeY: padding.top - 28,
        lineColor: 'rgba(234, 179, 8, 0.65)'
      },
      {
        label: `SPOT ${profile.spot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
        strike: profile.spot,
        color: '#22d3ee',
        bg: 'rgba(8, 51, 68, 0.85)',
        badgeY: padding.top - 12,
        lineColor: 'rgba(34, 211, 238, 0.65)'
      },
      {
        label: `CALL WALL ${profile.callWall.toLocaleString('en-IN')}`,
        strike: profile.callWall,
        color: '#22c55e',
        bg: 'rgba(20, 83, 45, 0.85)',
        badgeY: padding.top - 46,
        lineColor: 'rgba(34, 197, 94, 0.65)'
      }
    ];

    markers.forEach(m => {
      const x = getXForStrike(m.strike);
      if (x < padding.left || x > width - padding.right) return;

      // Vertical dashed line
      ctx.strokeStyle = m.lineColor;
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(x, padding.top - 8);
      ctx.lineTo(x, height - padding.bottom);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top pill badge
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      const textW = ctx.measureText(m.label).width;
      const pillW = textW + 14;
      const pillH = 16;
      const pillX = x - pillW / 2;
      const pillY = m.badgeY;

      ctx.fillStyle = m.bg;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 8);
      ctx.fill();

      ctx.strokeStyle = m.color;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.roundRect(pillX, pillY, pillW, pillH, 8);
      ctx.stroke();

      ctx.fillStyle = m.color;
      ctx.textAlign = 'center';
      ctx.fillText(m.label, x, pillY + 11.5);
    });

    // 2. Draw GEX Bars (Green for Call/stabilizing, Red for Put/amplifying)
    strikes.forEach((sData, idx) => {
      const x = padding.left + idx * barSlotWidth + (barSlotWidth - barWidth) / 2;
      const barY = getY(sData.netGex);

      if (sData.netGex >= 0) {
        // Positive Green Bar (dealer-stabilizing)
        const h = zeroY - barY;
        ctx.fillStyle = '#22c55e'; // Vibrant emerald green
        ctx.fillRect(x, barY, barWidth, Math.max(1, h));
      } else {
        // Negative Salmon/Red Bar (dealer-amplifying)
        const h = barY - zeroY;
        ctx.fillStyle = '#f87171'; // Soft salmon red
        ctx.fillRect(x, zeroY, barWidth, Math.max(1, h));
      }

      // X Axis Strike Labels (draw every 2nd or 3rd strike to avoid crowding)
      const stepInterval = width < 900 ? 3 : 2;
      if (idx % stepInterval === 0 || idx === numStrikes - 1) {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '9px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(String(sData.strike), x + barWidth / 2, height - padding.bottom + 14);
      }
    });

    // 3. Draw Cyan Concentration Curve Overlay (|GEX| concentration)
    ctx.strokeStyle = '#22d3ee'; // Cyan line
    ctx.lineWidth = 1.8;
    ctx.beginPath();

    strikes.forEach((sData, idx) => {
      const x = padding.left + idx * barSlotWidth + barSlotWidth / 2;
      const y = getY(sData.concentration);
      if (idx === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    });
    ctx.stroke();

    // 4. Zero Baseline solid line
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, zeroY);
    ctx.lineTo(width - padding.right, zeroY);
    ctx.stroke();

  }, [profile, selectedIndex]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      backgroundColor: '#080c14',
      color: '#ffffff',
      padding: '16px 20px',
      boxSizing: 'border-box',
      gap: '14px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
    }}>
      
      {/* ------------------------------------------------------- */}
      {/* 1. TOP HEADER & INDEX SELECTOR TABS                    */}
      {/* Matching media_1790925206843.png                       */}
      {/* ------------------------------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '800', margin: 0, color: '#f8fafc', letterSpacing: '-0.3px' }}>
          {selectedIndex === 'NIFTY' ? 'Nifty' : selectedIndex} GEX — Live Gamma Exposure Chart
        </h2>

        {/* Index Selector Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0e1422', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '6px', padding: '2px' }}>
          {indices.map(idx => {
            const isActive = selectedIndex === idx;
            return (
              <button
                key={idx}
                onClick={() => setSelectedIndex(idx)}
                style={{
                  background: isActive ? '#00f0ff' : 'transparent',
                  color: isActive ? '#040810' : '#94a3b8',
                  border: 'none',
                  borderRadius: '4px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {idx}
              </button>
            );
          })}
          <button 
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', padding: '4px 6px', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            title="Refresh GEX Data"
            onClick={() => setSelectedIndex(prev => prev)}
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------- */}
      {/* 2. FREE VIEW BANNER ROW                                */}
      {/* ------------------------------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', borderBottom: '1px solid rgba(255, 255, 255, 0.05)', paddingBottom: '8px' }}>
        <span style={{ color: '#94a3b8' }}>
          Free view — live GEX data, updating every few seconds during market hours.
        </span>
        <a href="#platform" style={{ color: '#22d3ee', textDecoration: 'none', fontWeight: '600' }}>
          Log in free for the full platform →
        </a>
      </div>

      <div style={{ fontSize: '11px', color: '#64748b' }}>
        Live · updated {profile.updatedTime}
      </div>

      {/* ------------------------------------------------------- */}
      {/* 3. 4 KEY STAT CARDS                                    */}
      {/* Matching media_1790925206843.png                       */}
      {/* ------------------------------------------------------- */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '12px' }}>
        
        {/* CARD 1: NET GEX */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', letterSpacing: '0.5px' }}>NET GEX</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#22c55e' }}>{profile.netGexCr}</span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>₹Cr/1%</span>
          </div>
          <div>
            <span style={{ background: 'rgba(34, 197, 94, 0.15)', border: '1px solid #22c55e', color: '#22c55e', padding: '2px 8px', borderRadius: '12px', fontSize: '9px', fontWeight: '800' }}>
              LONG GAMMA
            </span>
          </div>
        </div>

        {/* CARD 2: ΔGEX MOMENTUM */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(244, 63, 94, 0.35)', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', letterSpacing: '0.5px' }}>ΔGEX MOMENTUM</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '22px', fontWeight: '900', color: '#ffffff' }}>{profile.gexMomentum5m}</span>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>Cr · 5m</span>
          </div>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            15m {profile.gexMomentum15m} · day {profile.gexMomentumDay}
          </span>
        </div>

        {/* CARD 3: GAMMA FLIP est. */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', letterSpacing: '0.5px' }}>GAMMA FLIP est.</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#ffffff' }}>
              {profile.flipLow.toLocaleString('en-IN')} — {profile.flipHigh.toLocaleString('en-IN')}
            </span>
          </div>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            spot above the flip band ({profile.spot.toLocaleString('en-IN')}) · ±10% IV surface → {profile.flipSpreadPts} pt spread
          </span>
        </div>

        {/* CARD 4: WALLS */}
        <div style={{ background: '#0d1322', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '8px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <span style={{ fontSize: '10px', fontWeight: '800', color: '#64748b', letterSpacing: '0.5px' }}>WALLS</span>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#22c55e' }}>{profile.callWall.toLocaleString('en-IN')}</span>
            <span style={{ fontSize: '18px', color: '#64748b' }}>/</span>
            <span style={{ fontSize: '20px', fontWeight: '900', color: '#ef4444' }}>{profile.putWall.toLocaleString('en-IN')}</span>
          </div>
          <span style={{ fontSize: '10px', color: '#64748b' }}>
            call +{Math.round(profile.callWall - profile.spot)} pts from spot · put -{Math.round(profile.spot - profile.putWall)} pts from spot
          </span>
        </div>

      </div>

      {/* Model Implication Note */}
      <div style={{ fontSize: '10.5px', color: '#64748b', fontStyle: 'italic' }}>
        Model implies counter-trend dealer hedging, implied by the assumed dealer sign — not measured.
      </div>

      {/* ------------------------------------------------------- */}
      {/* 4. YELLOW DISCLAIMER CALLOUT BOX                       */}
      {/* Matching media_1790925206843.png                       */}
      {/* ------------------------------------------------------- */}
      <div style={{
        background: 'rgba(234, 179, 8, 0.04)',
        border: '1px solid rgba(234, 179, 8, 0.35)',
        borderRadius: '6px',
        padding: '10px 14px',
        fontSize: '11px',
        lineHeight: '1.5',
        color: '#e2e8f0'
      }}>
        <strong style={{ color: '#facc15' }}>Dealer positioning is assumed, not measured.</strong> Calls are counted +gamma and puts -gamma (the US convention: dealers long calls, short puts). NSE publishes no trade-side data to verify that in India — if the true sign is inverted, every bar below and the flip level invert with it. 33% of total |GEX| sits within 2 strikes of ATM.{' '}
        <span style={{ color: '#38bdf8', cursor: 'pointer', textDecoration: 'underline' }}>
          What could make this chart wrong? →
        </span>
      </div>

      {/* ------------------------------------------------------- */}
      {/* 5. CHART HEADER & CONTROLS TOOLBAR                     */}
      {/* ------------------------------------------------------- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', fontWeight: '800', color: '#ffffff' }}>
            GEX by strike — nearest expiry ({profile.expiryDate})
          </span>
          <span style={{ background: '#1e293b', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', fontSize: '10px', fontWeight: '800', padding: '1px 6px', borderRadius: '4px' }}>
            {profile.dte} DTE
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Auto Range Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: '#0e1422', border: '1px solid rgba(255, 255, 255, 0.1)', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', color: '#cbd5e1', cursor: 'pointer' }}>
            <span>Auto range</span>
            <ChevronDown size={11} />
          </div>

          {/* Expiry Toggle: Nearest vs All Expiries */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#0e1422', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '2px' }}>
            <button
              onClick={() => setViewExpiry('Nearest')}
              style={{
                background: viewExpiry === 'Nearest' ? '#00f0ff' : 'transparent',
                color: viewExpiry === 'Nearest' ? '#040810' : '#94a3b8',
                border: 'none',
                borderRadius: '3px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              Nearest
            </button>
            <button
              onClick={() => setViewExpiry('All expiries')}
              style={{
                background: viewExpiry === 'All expiries' ? '#00f0ff' : 'transparent',
                color: viewExpiry === 'All expiries' ? '#040810' : '#94a3b8',
                border: 'none',
                borderRadius: '3px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              All expiries
            </button>
          </div>

          {/* View Type Toggle: Net vs Call vs Put vs Table */}
          <div style={{ display: 'flex', alignItems: 'center', background: '#0e1422', border: '1px solid rgba(255, 255, 255, 0.1)', borderRadius: '4px', padding: '2px' }}>
            {(['Net', 'Call vs Put', 'Table'] as const).map(t => (
              <button
                key={t}
                onClick={() => setViewType(t)}
                style={{
                  background: viewType === t ? '#00f0ff' : 'transparent',
                  color: viewType === t ? '#040810' : '#94a3b8',
                  border: 'none',
                  borderRadius: '3px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ------------------------------------------------------- */}
      {/* 6. MAIN GEX CANVAS CHART CONTAINER                     */}
      {/* ------------------------------------------------------- */}
      <div style={{
        position: 'relative',
        width: '100%',
        height: '440px',
        backgroundColor: '#080c14',
        borderRadius: '8px',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        overflow: 'hidden'
      }}>
        <canvas ref={canvasRef} style={{ display: 'block', width: '100%', height: '100%' }} />
      </div>

      {/* ------------------------------------------------------- */}
      {/* 7. BOTTOM LEGEND & TOTAL GEX SUMMARY                   */}
      {/* ------------------------------------------------------- */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        fontSize: '11px',
        color: '#94a3b8',
        paddingTop: '4px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '9px', height: '9px', backgroundColor: '#22c55e', borderRadius: '2px', display: 'inline-block' }} />
            <span>dealer-stabilizing</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '9px', height: '9px', backgroundColor: '#f87171', borderRadius: '2px', display: 'inline-block' }} />
            <span>dealer-amplifying</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <span style={{ width: '14px', height: '2px', backgroundColor: '#22d3ee', display: 'inline-block' }} />
            <span>|GEX| concentration</span>
          </div>
        </div>

        <div style={{ color: '#64748b' }}>
          Total |GEX| {profile.totalAbsGex} Cr · updated {profile.updatedTime}
        </div>
      </div>

    </div>
  );
};
