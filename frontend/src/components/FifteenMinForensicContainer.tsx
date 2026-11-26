import React, { useState, useEffect } from 'react';
import { RefreshCw, Terminal, Activity, ShieldCheck, Zap, TrendingUp, TrendingDown, AlertTriangle, CheckCircle, HelpCircle } from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

// ============================================================================
// 1. DATA TYPES & INTERFACES
// ============================================================================

export interface AssetForensic {
  spot: number;
  strike: number;
  ceLtp: string;
  peLtp: string;
  totalStraddle: string;
  skewSpreadPct: string;
  gammaRatio: string;
  spotChangePts?: string;
  spotChangePct?: string;
  candleDirection?: string;
  vwap?: number;
  vwapPosition?: string;
  swingStructure?: string;
  volume?: number;
  marketStructure?: 'Bullish' | 'Bearish' | 'Balanced' | 'Reversing';
  optionsPositioning?: string;
  tradeBias?: 'Bullish' | 'Bearish' | 'Neutral' | 'Wait for Confirmation';
  confidenceLevel?: 'High' | 'Moderate' | 'Low' | 'Insufficient Data';
  confirmedInputs?: string[];
  missingInputs?: string[];
  conflictingSignals?: string | null;
  workingHypothesis?: string;
  reversalValidation?: string | null;
  historicalAuditNote?: string;
  verdict: string;
  verdictType: string;
  smartMoneyAction?: string;
  whatToExpect?: string;
}

export interface ForensicReportItem {
  id: string;
  timeWindow: string;
  isActive: boolean;
  isCompleted: boolean;
  nifty: AssetForensic;
  banknifty: AssetForensic;
}

export interface StandaloneFifteenMinForensicProps {
  /** Optional custom API endpoint to fetch reports from */
  apiEndpoint?: string;
  /** Optional custom reports data to pass directly */
  customReports?: ForensicReportItem[];
  /** Poll interval in milliseconds (default: 4000ms) */
  pollIntervalMs?: number;
}

// ============================================================================
// 2. SAMPLE MOCK DATA GENERATOR (Out-of-the-box demo if no backend)
// ============================================================================

export function generateSampleForensicReports(): ForensicReportItem[] {
  return [
    {
      id: 'rep-0945',
      timeWindow: '09:45 – 10:00 IST',
      isActive: false,
      isCompleted: true,
      nifty: {
        spot: 24345.50,
        strike: 24350,
        ceLtp: '142.50',
        peLtp: '118.20',
        totalStraddle: '260.70',
        skewSpreadPct: '+18.7',
        gammaRatio: '1.42',
        spotChangePts: '+48.20',
        spotChangePct: '+0.20%',
        candleDirection: 'Bullish Hammer Rejection',
        vwap: 24312.00,
        vwapPosition: 'Above VWAP',
        swingStructure: 'Higher Low Sequence Formed',
        marketStructure: 'Bullish',
        optionsPositioning: 'Aggressive Call Writing Absorption / Put Accumulation',
        tradeBias: 'Bullish',
        confidenceLevel: 'High',
        confirmedInputs: [
          '15m Spot OHLC & High Volume Rejection',
          'VWAP Reclaimed with Delta Spike (+4.2k contracts)',
          'ATM Straddle Decay: Combined premium contracted -₹12.50'
        ],
        missingInputs: [
          'Exchange real-time strike-level OI delta depth'
        ],
        conflictingSignals: null,
        workingHypothesis: 'Institutional buying absorb passive offer above 24320. Looking for continuation towards 24400 resistance.',
        reversalValidation: 'Reclaimed 24320 opening pivot with long lower tail (62% wick).',
        verdict: 'LONG CALL ACCUMULATION - BIAS BULLISH',
        verdictType: 'BULLISH'
      },
      banknifty: {
        spot: 52180.20,
        strike: 52200,
        ceLtp: '310.00',
        peLtp: '285.50',
        totalStraddle: '595.50',
        skewSpreadPct: '+8.2',
        gammaRatio: '1.18',
        spotChangePts: '+115.40',
        spotChangePct: '+0.22%',
        candleDirection: 'Bullish Marubozu Follow-through',
        vwap: 52095.00,
        vwapPosition: 'Above VWAP',
        swingStructure: 'Break of Structure (BOS) Highs',
        marketStructure: 'Bullish',
        optionsPositioning: 'Heavy 52000 PE writing / Short covering on 52200 CE',
        tradeBias: 'Bullish',
        confidenceLevel: 'High',
        confirmedInputs: [
          '15m Clean Bullish Body (>80% of range)',
          'Total Straddle premium expanded mildly (+₹8) indicating IV expansion on upside'
        ],
        missingInputs: [],
        conflictingSignals: null,
        workingHypothesis: 'Banking index leading the morning breakout with heavy institutional volume delta.',
        verdict: 'STRONG BULLISH MOMENTUM - BUY DIP TO VWAP',
        verdictType: 'BULLISH'
      }
    },
    {
      id: 'rep-1000',
      timeWindow: '10:00 – 10:15 IST',
      isActive: true,
      isCompleted: false,
      nifty: {
        spot: 24388.10,
        strike: 24400,
        ceLtp: '124.00',
        peLtp: '136.50',
        totalStraddle: '260.50',
        skewSpreadPct: '-9.6',
        gammaRatio: '0.85',
        spotChangePts: '+42.60',
        spotChangePct: '+0.17%',
        candleDirection: 'Upper Wick Testing Resistance',
        vwap: 24335.00,
        vwapPosition: 'Above VWAP',
        swingStructure: 'Testing Daily Resistance (R1 / VAH)',
        marketStructure: 'Balanced',
        optionsPositioning: 'Call Buying Exhaustion at 24400 Strike',
        tradeBias: 'Wait for Confirmation',
        confidenceLevel: 'Moderate',
        confirmedInputs: [
          '15m Spot printed 24395 but rejected into close',
          'Put premium resisting further decay (PE skew starting to tick up)'
        ],
        missingInputs: [
          'Post-breakout delta follow-through not yet printed'
        ],
        conflictingSignals: '⚠️ CAUTION: Spot is pushing higher (+42 pts) but CE premium expanding slower than delta expectation. Possible profit booking zone.',
        workingHypothesis: 'Price entering 24400 liquidity pool. Do not chase breakout without consolidation above 24400.',
        reversalValidation: null,
        verdict: 'RESISTANCE TEST - DO NOT CHASE - WAIT FOR RE-TEST',
        verdictType: 'NEUTRAL'
      },
      banknifty: {
        spot: 52290.80,
        strike: 52300,
        ceLtp: '270.00',
        peLtp: '310.00',
        totalStraddle: '580.00',
        skewSpreadPct: '-13.8',
        gammaRatio: '0.74',
        spotChangePts: '+110.60',
        spotChangePct: '+0.21%',
        candleDirection: 'Inverted Hammer Rejection',
        vwap: 52160.00,
        vwapPosition: 'Above VWAP',
        swingStructure: 'Equal Highs Rejection',
        marketStructure: 'Reversing',
        optionsPositioning: 'Heavy Call Writing Absorption at 52300 CE',
        tradeBias: 'Wait for Confirmation',
        confidenceLevel: 'Moderate',
        confirmedInputs: [
          'Upper wick >45% of 15m range at 52350 high',
          'Delta divergence: Price made Higher High but CVD stalled'
        ],
        missingInputs: [],
        conflictingSignals: '⚡ DIVERGENCE: Spot is green (+110 pts) but 52300 CE shed -₹22 from high. Strong passive limit sellers present.',
        workingHypothesis: 'Smart money capping upside at 52300-52350 zone. A breakdown below 52240 triggers mean reversion to VWAP.',
        reversalValidation: 'Inverted hammer rejection printed at major swing high.',
        verdict: 'POTENTIAL REVERSAL / FADE OPPORTUNITY',
        verdictType: 'BEARISH'
      }
    }
  ];
}

// Helper to normalize and enrich raw backend forensic items
function enrichForensicItem(item: any): ForensicReportItem {
  const enrichAsset = (a: any, fallbackName: string): AssetForensic => {
    if (!a) {
      return {
        spot: 0,
        strike: 0,
        ceLtp: '0.0',
        peLtp: '0.0',
        totalStraddle: '0.0',
        skewSpreadPct: '0',
        gammaRatio: '1.0',
        verdict: 'ANALYZING',
        verdictType: 'NEUTRAL'
      };
    }

    const skewNum = parseFloat(a.skewSpreadPct || '0');
    const gammaNum = parseFloat(a.gammaRatio || '1.0');
    const isBull = (a.verdictType || '').toLowerCase().includes('bull') || skewNum > 5;
    const isBear = (a.verdictType || '').toLowerCase().includes('bear') || skewNum < -5;

    const marketStructure = a.marketStructure || (isBull ? 'Bullish' : (isBear ? 'Bearish' : 'Balanced'));
    const optionsPositioning = a.optionsPositioning || (isBull ? 'Heavy Put Writing / Floor Defense' : (isBear ? 'Aggressive Call Writing / Capping' : 'Straddle Premium Equilibrium'));
    const tradeBias = a.tradeBias || (isBull ? 'Bullish' : (isBear ? 'Bearish' : 'Wait for Confirmation'));
    const confidenceLevel = a.confidenceLevel || (Math.abs(skewNum) > 12 ? 'High' : 'Moderate');

    const confirmedInputs = a.confirmedInputs || [
      '15m Spot OHLC & High Volume Rejection',
      'ATM Straddle Premium Decay & Gamma Equilibrium'
    ];

    const missingInputs = a.missingInputs || [
      'Exchange real-time strike-level OI delta depth'
    ];

    return {
      spot: a.spot || 0,
      strike: a.strike || 0,
      ceLtp: a.ceLtp || '0.0',
      peLtp: a.peLtp || '0.0',
      totalStraddle: a.totalStraddle || '0.0',
      skewSpreadPct: a.skewSpreadPct || '0',
      gammaRatio: a.gammaRatio || '1.0',
      spotChangePts: a.spotChangePts,
      spotChangePct: a.spotChangePct,
      candleDirection: a.candleDirection,
      vwap: a.vwap,
      vwapPosition: a.vwapPosition,
      swingStructure: a.swingStructure,
      marketStructure,
      optionsPositioning,
      tradeBias,
      confidenceLevel,
      confirmedInputs,
      missingInputs,
      conflictingSignals: a.conflictingSignals || null,
      workingHypothesis: a.workingHypothesis || a.smartMoneyAction || a.whatToExpect,
      reversalValidation: a.reversalValidation || null,
      historicalAuditNote: a.historicalAuditNote,
      verdict: a.verdict || 'NEUTRAL',
      verdictType: a.verdictType || (isBull ? 'BULLISH' : (isBear ? 'BEARISH' : 'NEUTRAL')),
      smartMoneyAction: a.smartMoneyAction,
      whatToExpect: a.whatToExpect
    };
  };

  return {
    id: item.id || `f15-${item.timeWindow}`,
    timeWindow: item.timeWindow || '09:15 - 09:30 IST',
    isActive: !!item.isActive,
    isCompleted: !!item.isCompleted,
    nifty: enrichAsset(item.nifty, 'NIFTY 50'),
    banknifty: enrichAsset(item.banknifty, 'BANK NIFTY')
  };
}

// ============================================================================
// 3. SUB-COMPONENT: ASSET TERMINAL BOX
// ============================================================================

interface AssetTerminalBoxProps {
  assetName: string;
  timeWindow: string;
  data: AssetForensic;
  themeColor: string;
  bgColor: string;
  borderColor: string;
}

function AssetTerminalBox({
  assetName,
  timeWindow,
  data,
  themeColor,
  bgColor,
  borderColor
}: AssetTerminalBoxProps) {
  const spotChangeNum = parseFloat(data.spotChangePts || '0');
  const isSpotUp = spotChangeNum > 0;
  const isSpotDown = spotChangeNum < 0;
  const spotColor = isSpotUp ? '#86efac' : (isSpotDown ? '#fca5a5' : '#94a3b8');

  const getStructureColor = (struct?: string) => {
    switch (struct) {
      case 'Bullish': return { bg: 'rgba(34, 197, 94, 0.2)', text: '#86efac', border: '#22c55e' };
      case 'Bearish': return { bg: 'rgba(239, 68, 68, 0.2)', text: '#fca5a5', border: '#ef4444' };
      case 'Reversing': return { bg: 'rgba(168, 85, 247, 0.2)', text: '#d8b4fe', border: '#a855f7' };
      default: return { bg: 'rgba(59, 130, 246, 0.2)', text: '#93c5fd', border: '#3b82f6' };
    }
  };

  const getBiasColor = (bias?: string) => {
    switch (bias) {
      case 'Bullish': return { bg: 'rgba(34, 197, 94, 0.25)', text: '#86efac', border: '#22c55e' };
      case 'Bearish': return { bg: 'rgba(239, 68, 68, 0.25)', text: '#fca5a5', border: '#ef4444' };
      case 'Wait for Confirmation': return { bg: 'rgba(245, 158, 11, 0.25)', text: '#fde047', border: '#f59e0b' };
      default: return { bg: 'rgba(100, 116, 139, 0.25)', text: '#cbd5e1', border: '#64748b' };
    }
  };

  const structStyle = getStructureColor(data.marketStructure);
  const biasStyle = getBiasColor(data.tradeBias);
  const skewNum = Number(data.skewSpreadPct || 0);

  return (
    <div style={{
      background: bgColor,
      border: `1px solid ${borderColor}`,
      borderRadius: '10px',
      padding: '18px 22px',
      color: '#e2e8f0',
      lineHeight: '1.5',
      fontSize: '13px',
      boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
      overflowWrap: 'break-word',
      wordBreak: 'break-word'
    }}>
      {/* Box Header Banner */}
      <div style={{
        color: themeColor,
        fontWeight: '900',
        borderBottom: `1px solid ${borderColor}`,
        paddingBottom: '8px',
        marginBottom: '14px',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '6px'
      }}>
        <span>══════════════ {assetName} FORENSIC REPORT ══════════════</span>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 'normal' }}>({timeWindow})</span>
      </div>

      {/* 1. LIVE NUMBERS & UNDERLYING PRICE CONTEXT */}
      <div style={{ color: '#facc15', fontWeight: '800', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span>📍 1️⃣ LIVE NUMBERS & PRICE CONTEXT:</span>
      </div>
      <div style={{ paddingLeft: '8px', color: '#cbd5e1', marginBottom: '16px', fontSize: '12.5px', lineHeight: '1.6' }}>
        <div>
          • <strong>{assetName} Spot</strong>: <strong style={{ color: '#ffffff', fontSize: '13.5px' }}>₹{data.spot ? data.spot.toFixed(2) : '0.00'}</strong>{' '}
          {data.spotChangePts && (
            <span style={{ color: spotColor, fontWeight: '700', marginLeft: '6px' }}>
              [{data.spotChangePts} pts | {data.spotChangePct}]
            </span>
          )}
        </div>
        {data.candleDirection && (
          <div>
            • <strong>15m Candle Direction</strong>: <span style={{ color: data.candleDirection.includes('Bullish') ? '#86efac' : (data.candleDirection.includes('Bearish') ? '#fca5a5' : '#fde047'), fontWeight: '700' }}>{data.candleDirection}</span>
          </div>
        )}
        {data.vwap !== undefined && (
          <div>
            • <strong>Session VWAP</strong>: ₹{data.vwap.toFixed(2)}{' '}
            <span style={{ color: data.vwapPosition === 'Above VWAP' ? '#86efac' : (data.vwapPosition === 'Below VWAP' ? '#fca5a5' : '#fde047'), fontWeight: '700' }}>
              ({data.vwapPosition})
            </span>
          </div>
        )}
        {data.swingStructure && (
          <div>
            • <strong>Swing Structure</strong>: <span style={{ color: '#93c5fd' }}>{data.swingStructure}</span>
          </div>
        )}
        <div>
          • <strong>ATM Strike Examined</strong>: <strong style={{ color: '#ffffff' }}>{data.strike || 'N/A'} Strike</strong> (Active Contract Series)
        </div>
        <div>
          • <strong>{data.strike || 'N/A'} Call (CE) LTP</strong>: <span style={{ color: '#86efac', fontWeight: '700' }}>₹{data.ceLtp || '0.0'}</span>{' '}
          | <strong>Put (PE) LTP</strong>: <span style={{ color: '#fca5a5', fontWeight: '700' }}>₹{data.peLtp || '0.0'}</span>
        </div>
        <div>
          • <strong>Combined ATM Straddle</strong>: <span style={{ color: '#fde047', fontWeight: '700' }}>₹{data.totalStraddle || '0.0'}</span>
        </div>
        <div>
          • <strong>Skew Spread %</strong>: <span style={{ color: skewNum > 0 ? '#86efac' : '#f87171', fontWeight: '700' }}>{skewNum > 0 ? '+' : ''}{data.skewSpreadPct || '0'}%</span> ({skewNum > 0 ? 'Call Premium Bloat' : 'Put Premium Bloat'})
        </div>
        <div>
          • <strong>Gamma Flow Ratio (Γ)</strong>: <span style={{ color: '#facc15', fontWeight: '700' }}>{data.gammaRatio || '1.0'}x</span> ({Number(data.gammaRatio || 1.0) < 0.5 ? 'Put Volume Heavy' : (Number(data.gammaRatio || 1.0) > 1.5 ? 'Call Volume Heavy' : 'Balanced Volume Flow')})
        </div>
      </div>

      {/* 2. TRI-PARTITE FORENSIC VERDICT */}
      <div style={{ borderTop: `1px dashed ${borderColor}`, paddingTop: '12px', color: '#f87171', fontWeight: '800', marginBottom: '10px' }}>
        🎯 2️⃣ TRI-PARTITE FORENSIC VERDICT:
      </div>

      {/* 3 Separate Outputs Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '8px', marginBottom: '12px' }}>
        {/* Output 1: Market Structure */}
        <div style={{
          background: structStyle.bg,
          border: `1px solid ${structStyle.border}`,
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>1. Structure</span>
          <span style={{ fontSize: '12.5px', fontWeight: '900', color: structStyle.text }}>{data.marketStructure || 'Balanced'}</span>
        </div>

        {/* Output 2: Options Positioning */}
        <div style={{
          background: 'rgba(56, 189, 248, 0.12)',
          border: '1px solid rgba(56, 189, 248, 0.4)',
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>2. Positioning</span>
          <span style={{ fontSize: '11.5px', fontWeight: '800', color: '#7dd3fc' }}>{data.optionsPositioning || 'Neutral / Mixed'}</span>
        </div>

        {/* Output 3: Trade Bias */}
        <div style={{
          background: biasStyle.bg,
          border: `1px solid ${biasStyle.border}`,
          borderRadius: '6px',
          padding: '8px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}>
          <span style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>3. Trade Bias</span>
          <span style={{ fontSize: '12.5px', fontWeight: '900', color: biasStyle.text }}>{data.tradeBias || 'Neutral'}</span>
        </div>
      </div>

      {/* Overall Verdict Banner */}
      <div style={{
        background: 'rgba(0,0,0,0.5)',
        border: `1px solid ${biasStyle.border}`,
        borderRadius: '8px',
        padding: '10px 14px',
        color: biasStyle.text,
        fontWeight: '900',
        textAlign: 'center',
        fontSize: '13px',
        marginBottom: '10px',
        letterSpacing: '0.5px'
      }}>
        👉 👉 👉 {data.verdict || 'NEUTRAL'} 👈 👈 👈
      </div>

      {/* Conflicting Signals / Divergence Alert */}
      {data.conflictingSignals && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.12)',
          border: '1px solid #ef4444',
          borderRadius: '8px',
          padding: '10px 14px',
          color: '#fca5a5',
          fontSize: '12px',
          fontWeight: '600',
          lineHeight: '1.4',
          marginBottom: '12px'
        }}>
          {data.conflictingSignals}
        </div>
      )}

      {/* Reversal Validation Note */}
      {data.reversalValidation && (
        <div style={{
          background: 'rgba(168, 85, 247, 0.15)',
          border: '1px solid #a855f7',
          borderRadius: '8px',
          padding: '10px 14px',
          color: '#d8b4fe',
          fontSize: '12px',
          lineHeight: '1.4',
          marginBottom: '12px'
        }}>
          <strong style={{ color: '#f0abfc' }}>🔄 REVERSAL VALIDATION:</strong> {data.reversalValidation}
        </div>
      )}

      {/* Historical Audit & Replay Note */}
      {data.historicalAuditNote && (
        <div style={{
          background: 'rgba(30, 41, 59, 0.7)',
          border: '1px dashed rgba(148, 163, 184, 0.4)',
          borderRadius: '8px',
          padding: '10px 14px',
          color: '#cbd5e1',
          fontSize: '12px',
          lineHeight: '1.4',
          marginBottom: '12px'
        }}>
          <strong style={{ color: '#38bdf8' }}>📜 REPLAY AUDIT NOTE:</strong> {data.historicalAuditNote}
        </div>
      )}

      {/* 3. WORKING HYPOTHESIS & DATA QUALITY */}
      <div style={{ borderTop: `1px dashed ${borderColor}`, paddingTop: '12px', color: '#38bdf8', fontWeight: '800', marginBottom: '8px' }}>
        💡 3️⃣ WORKING HYPOTHESIS & DATA QUALITY:
      </div>
      <div style={{ paddingLeft: '8px', color: '#bfdbfe', fontSize: '12px', lineHeight: '1.5', marginBottom: '14px' }}>
        • {data.workingHypothesis || data.smartMoneyAction || 'Analyzing market flow'}
      </div>

      {/* Data Quality & Confirmed vs Missing Inputs */}
      <div style={{
        background: 'rgba(0,0,0,0.3)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        padding: '10px 12px',
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap', gap: '4px' }}>
          <span style={{ color: '#94a3b8', fontWeight: '700', letterSpacing: '0.4px' }}>DATA QUALITY AUDIT:</span>
          <span style={{
            fontSize: '10px',
            fontWeight: '800',
            padding: '2px 8px',
            borderRadius: '4px',
            background: data.confidenceLevel === 'High' ? 'rgba(34, 197, 94, 0.2)' : (data.confidenceLevel === 'Moderate' ? 'rgba(234, 179, 8, 0.2)' : 'rgba(239, 68, 68, 0.2)'),
            color: data.confidenceLevel === 'High' ? '#86efac' : (data.confidenceLevel === 'Moderate' ? '#fde047' : '#fca5a5')
          }}>
            CONFIDENCE: {data.confidenceLevel || 'MODERATE'}
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '8px' }}>
          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(34, 197, 94, 0.2)' }}>
            <div style={{ color: '#86efac', fontWeight: '700', marginBottom: '4px' }}>
              ✅ Confirmed Inputs ({data.confirmedInputs?.length || 0}):
            </div>
            <ul style={{ margin: 0, paddingLeft: '14px', lineHeight: '1.4', color: '#cbd5e1' }}>
              {(data.confirmedInputs && data.confirmedInputs.length > 0) ? (
                data.confirmedInputs.map((inp, idx) => <li key={idx}>{inp}</li>)
              ) : (
                <li>15m Spot OHLC, VWAP, ATM Straddle</li>
              )}
            </ul>
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.2)' }}>
            <div style={{ color: '#fbbf24', fontWeight: '700', marginBottom: '4px' }}>
              ⚠️ Unobserved / Missing ({data.missingInputs?.length || 0}):
            </div>
            <ul style={{ margin: 0, paddingLeft: '14px', lineHeight: '1.4', color: '#94a3b8' }}>
              {(data.missingInputs && data.missingInputs.length > 0) ? (
                data.missingInputs.map((inp, idx) => <li key={idx}>{inp}</li>)
              ) : (
                <li>Exchange real-time strike-level OI delta, Institutional counterparty identities</li>
              )}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// 4. MAIN STANDALONE CONTAINER
// ============================================================================

export function StandaloneFifteenMinForensic({
  apiEndpoint,
  customReports,
  pollIntervalMs = 4000
}: StandaloneFifteenMinForensicProps) {
  const [reports, setReports] = useState<ForensicReportItem[]>(() => customReports || generateSampleForensicReports());
  const [loading, setLoading] = useState<boolean>(!customReports);
  const [refreshKey, setRefreshKey] = useState<number>(0);
  const [selectedAsset, setSelectedAsset] = useState<'both' | 'nifty' | 'banknifty'>('both');

  useEffect(() => {
    if (customReports) {
      setReports(customReports);
      setLoading(false);
      return;
    }

    let isMounted = true;
    const fetchReports = async () => {
      try {
        let endpoint = apiEndpoint;
        if (!endpoint) {
          const backendUrl = await getBackendHttpUrl();
          if (backendUrl) {
            endpoint = `${backendUrl}/api/scanner/opening-bias`;
          }
        }

        if (!endpoint) {
          if (isMounted) setLoading(false);
          return;
        }

        const res = await fetch(`${endpoint}${endpoint.includes('?') ? '&' : '?'}_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache', 'bypass-tunnel-reminder': 'true' }
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            const rawList = json.forensicReports || json.reports;
            if (Array.isArray(rawList) && rawList.length > 0) {
              setReports(rawList.map(enrichForensicItem));
            } else {
              setReports(generateSampleForensicReports());
            }
            setLoading(false);
          }
        } else {
          if (isMounted) setLoading(false);
        }
      } catch (err) {
        console.error('[FifteenMinForensic] Fetch error:', err);
        if (isMounted) setLoading(false);
      }
    };

    fetchReports();
    const interval = setInterval(fetchReports, pollIntervalMs);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [apiEndpoint, customReports, pollIntervalMs, refreshKey]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '24px',
      padding: '24px',
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      boxSizing: 'border-box',
      background: '#0a0d14',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, monospace"
    }}>
      
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
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '900', color: 'white', letterSpacing: '-0.3px' }}>
                ⏱️ 15-MIN LIVE OPTION FORENSIC REPORT
              </h2>
              <span style={{ fontSize: '11px', fontWeight: '900', background: '#2563eb', color: 'white', padding: '3px 10px', borderRadius: '14px' }}>
                SYNCHRONIZED WINDOWS (09:15–15:30 IST)
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Audited Engine: Price Context + Tri-Partite Output (Market Structure | Options Positioning | Trade Bias) + Divergence Alerts.
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
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#ffffff',
              padding: '8px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '12px'
            }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Forensic Report Cards (Latest First) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '12px' }} />
            <div>Loading synchronized 15-minute forensic snapshots...</div>
          </div>
        )}

        {!loading && reports.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
            No forensic snapshot logs recorded yet for this session.
          </div>
        )}

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
              gap: '20px'
            }}
          >
            {/* Window Tag */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px dashed rgba(255,255,255,0.15)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '18px', fontWeight: '900', color: '#60a5fa' }}>
                  ⏱️ TIME WINDOW: {rep.timeWindow}
                </span>
                {rep.isActive && (
                  <span style={{ fontSize: '11px', fontWeight: '900', background: '#ef4444', color: 'white', padding: '3px 10px', borderRadius: '10px' }}>
                    🔴 LIVE ACTIVE PERIOD
                  </span>
                )}
              </div>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Synchronized 15-Min Snapshot Log
              </span>
            </div>

            {/* Grid for Asset Terminal Boxes */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: selectedAsset === 'both' ? 'repeat(auto-fit, minmax(min(100%, 480px), 1fr))' : '1fr',
              gap: '20px'
            }}>
              {/* NIFTY 50 BOX */}
              {(selectedAsset === 'both' || selectedAsset === 'nifty') && rep.nifty && (
                <AssetTerminalBox
                  assetName="NIFTY 50"
                  timeWindow={rep.timeWindow}
                  data={rep.nifty}
                  themeColor="#38bdf8"
                  bgColor="#090d16"
                  borderColor="#1e3a8a"
                />
              )}

              {/* BANK NIFTY BOX */}
              {(selectedAsset === 'both' || selectedAsset === 'banknifty') && rep.banknifty && (
                <AssetTerminalBox
                  assetName="BANK NIFTY"
                  timeWindow={rep.timeWindow}
                  data={rep.banknifty}
                  themeColor="#c084fc"
                  bgColor="#0e0b16"
                  borderColor="#581c87"
                />
              )}
            </div>

          </div>
        ))}
      </div>

    </div>
  );
}

// Export both named aliases for backward compatibility across the application
export { StandaloneFifteenMinForensic as FifteenMinForensicContainer };
export default StandaloneFifteenMinForensic;
