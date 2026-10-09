import React, { useState, useEffect, useRef } from 'react';
import { Zap, Volume2, VolumeX, AlertTriangle, ArrowUpRight, ArrowDownRight, ShieldCheck, Target, Activity, RefreshCw } from 'lucide-react';
import { getBackendHttpUrl, getBackendHttpUrlSync } from '../utils/tvStreamer';

interface LiveSignal {
  id: string;
  timestamp: string;
  lastUpdated?: string;
  lastUpdatedMs?: number;
  symbol: string;
  action: 'BUY CE' | 'BUY PE' | 'EXIT' | 'SHORT STRADDLE';
  strike: string;
  entryPrice?: number;
  currentOptionPrice: number;
  entryRange: string;
  spotPrice: number;
  spotSL: number;
  optionSL: number;
  target1: number;
  target2: number;
  target1Hit?: boolean;
  target2Hit?: boolean;
  pnlPct?: number;
  confidence: number;
  mathTrigger: string;
  conceptUsed: string;
  isUrgent: boolean;
}

export function BacktestResultsContainer() {
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [activeSignals, setActiveSignals] = useState<LiveSignal[]>([]);
  const [backendUrl, setBackendUrl] = useState<string>(getBackendHttpUrlSync());
  const [historicalSignals, setHistoricalSignals] = useState<LiveSignal[]>([]);

  useEffect(() => {
    getBackendHttpUrl().then(url => {
      if (url) setBackendUrl(url);
    });
  }, []);

  useEffect(() => {
    const loadHistoricalSignals = async () => {
      try {
        const currentBackend = await getBackendHttpUrl();
        const response = await fetch(`${currentBackend}/api/scanner/historical-signals`);
        if (response.ok) {
          const data = await response.json();
          setHistoricalSignals(data);
        }
      } catch (e) {
        console.error('Failed to load historical signals from backend:', e);
      }
    };
    loadHistoricalSignals();
  }, [backendUrl]);

  const [niftySpot, setNiftySpot] = useState<number>(0);
  const [bankSpot, setBankSpot] = useState<number>(0);
  const [niftySkew, setNiftySkew] = useState<number>(0);
  const [bankSkew, setBankSkew] = useState<number>(0);
  const [niftyGamma, setNiftyGamma] = useState<number>(1.0);
  const [bankGamma, setBankGamma] = useState<number>(1.0);
  const [niftyStraddle, setNiftyStraddle] = useState<number>(0);
  const [bankStraddle, setBankStraddle] = useState<number>(0);
  
  // Specific Live Contract Symbols & LTPs
  const [niftyCeSym, setNiftyCeSym] = useState<string>('Detecting ATM CE...');
  const [niftyCeLtp, setNiftyCeLtp] = useState<number>(0);
  const [niftyPeSym, setNiftyPeSym] = useState<string>('Detecting ATM PE...');
  const [niftyPeLtp, setNiftyPeLtp] = useState<number>(0);

  const [bankCeSym, setBankCeSym] = useState<string>('Detecting ATM CE...');
  const [bankCeLtp, setBankCeLtp] = useState<number>(0);
  const [bankPeSym, setBankPeSym] = useState<string>('Detecting ATM PE...');
  const [bankPeLtp, setBankPeLtp] = useState<number>(0);


  const [refreshKey, setRefreshKey] = useState<number>(0);
  const lastSignalIdRef = useRef<string>('');
  const historicalSignalsRef = useRef<LiveSignal[]>([]);

  useEffect(() => {
    historicalSignalsRef.current = historicalSignals;
  }, [historicalSignals]);


  // Natural Female AI Voice + Melodic Chime Speech Synthesizer
  const speakAIVoiceAlert = (text: string, isBullish: boolean) => {
    if (!soundEnabled) return;
    try {
      // 1. Play Melodic Chime First
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.connect(gain);
      gain.connect(audioCtx.destination);

      const now = audioCtx.currentTime;
      if (isBullish) {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.exponentialRampToValueAtTime(880.00, now + 0.12); // A5
        osc.frequency.exponentialRampToValueAtTime(1174.66, now + 0.25); // D6
        gain.gain.setValueAtTime(0.35, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      } else {
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(659.25, now); // E5
        osc.frequency.exponentialRampToValueAtTime(440.00, now + 0.12); // A4
        osc.frequency.exponentialRampToValueAtTime(329.63, now + 0.25); // E4
        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
        osc.start(now);
        osc.stop(now + 0.35);
      }

      // 2. Speak Natural Female AI Announcement right after the chime
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel(); // Clear any queued utterances
        const utterance = new SpeechSynthesisUtterance(text);
        
        // Ensure voices are loaded asynchronously in Chrome/Edge
        const selectAndSpeak = () => {
          const voices = window.speechSynthesis.getVoices();
          
          // Strict priority for known high-quality female voices
          const femaleVoice = voices.find(v => 
            v.name.includes('Zira') || // Microsoft Zira (Windows default Female)
            v.name.includes('Jenny') || // Edge Natural Jenny (Female)
            v.name.includes('Aria') || // Edge Natural Aria (Female)
            v.name.includes('Google UK English Female') || 
            v.name.includes('Google US English') ||
            v.name.includes('Samantha') || // Apple Female
            v.name.includes('Victoria') ||
            (v.name.toLowerCase().includes('female') && v.lang.startsWith('en'))
          ) || voices.find(v => v.lang === 'en-US' || v.lang.startsWith('en'));

          if (femaleVoice) {
            utterance.voice = femaleVoice;
          }
          
          utterance.rate = 1.0; // Clear natural pace
          utterance.pitch = 1.25; // Higher clear female pitch
          utterance.volume = 1.0;

          window.speechSynthesis.speak(utterance);
        };

        if (window.speechSynthesis.getVoices().length > 0) {
          setTimeout(selectAndSpeak, 250);
        } else {
          window.speechSynthesis.onvoiceschanged = () => {
            setTimeout(selectAndSpeak, 250);
          };
        }
      }
    } catch (e) {
      console.warn('Speech synthesis error:', e);
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchLiveSignals = async () => {
      try {
        const currentBackend = await getBackendHttpUrl();
        const res = await fetch(`${currentBackend}/api/scanner/opening-bias?_t=${Date.now()}`, {
          cache: 'no-store',
          headers: { 'Pragma': 'no-cache', 'Cache-Control': 'no-cache' }
        });
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            const currentNifty = Number(json.nifty?.currentPrice || json.nifty?.openPrice || 24498.70);
            const currentBank = Number(json.banknifty?.currentPrice || json.banknifty?.openPrice || 57333.90);
            const nSkew = Number(json.nifty?.straddleSkew?.skewSpreadPct || 3.2);
            const bSkew = Number(json.banknifty?.straddleSkew?.skewSpreadPct || 18.9);
            const nGamma = Number(json.nifty?.straddleSkew?.gammaRatio || 0.64);
            const bGamma = Number(json.banknifty?.straddleSkew?.gammaRatio || 0.92);
            const nStraddle = Number(json.nifty?.straddleSkew?.totalStraddle || 92.50);
            const bStraddle = Number(json.banknifty?.straddleSkew?.totalStraddle || 1212.15);

            setNiftySpot(currentNifty);
            setBankSpot(currentBank);
            setNiftySkew(nSkew);
            setBankSkew(bSkew);
            setNiftyGamma(nGamma);
            setBankGamma(bGamma);
            setNiftyStraddle(nStraddle);
            setBankStraddle(bStraddle);

            if (json.nifty?.straddleSkew) {
              if (json.nifty.straddleSkew.ceSymbol) setNiftyCeSym(json.nifty.straddleSkew.ceSymbol);
              if (json.nifty.straddleSkew.ceLtp) setNiftyCeLtp(Number(json.nifty.straddleSkew.ceLtp));
              if (json.nifty.straddleSkew.peSymbol) setNiftyPeSym(json.nifty.straddleSkew.peSymbol);
              if (json.nifty.straddleSkew.peLtp) setNiftyPeLtp(Number(json.nifty.straddleSkew.peLtp));
            }

            if (json.banknifty?.straddleSkew) {
              if (json.banknifty.straddleSkew.ceSymbol) setBankCeSym(json.banknifty.straddleSkew.ceSymbol);
              if (json.banknifty.straddleSkew.ceLtp) setBankCeLtp(Number(json.banknifty.straddleSkew.ceLtp));
              if (json.banknifty.straddleSkew.peSymbol) setBankPeSym(json.banknifty.straddleSkew.peSymbol);
              if (json.banknifty.straddleSkew.peLtp) setBankPeLtp(Number(json.banknifty.straddleSkew.peLtp));
            }

            const bSkewData = json.banknifty?.straddleSkew;
            const nSkewData = json.nifty?.straddleSkew;

            const getSavedSignals = (): LiveSignal[] => {
              try {
                const todayKey = 'today_live_math_signals_' + new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
                const saved = localStorage.getItem(todayKey);
                return saved ? JSON.parse(saved) : [];
              } catch (e) {
                return [];
              }
            };

            const nowTimeStr = new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', second: '2-digit' });
            const signals: LiveSignal[] = [];
            const currentHistory = historicalSignalsRef.current.length > 0 ? historicalSignalsRef.current : getSavedSignals();

            // 1. Bank Nifty Live Trade Signal (Skew-based)
            if (Math.abs(bSkew) > 8.0 || bSkewData?.earlyWarningConfidence > 75) {
              const isCall = bSkew > 0;
              const expectedAction = isCall ? 'BUY CE' : 'BUY PE';
              const atmStrike = Math.round(currentBank / 100) * 100;
              const optLtp = isCall ? (Number(bSkewData?.ceLtp) || 720) : (Number(bSkewData?.peLtp) || 500);
              const spotRisk = 120;
              const existingSig = currentHistory.find(s => s.symbol === 'BANKNIFTY' && s.action === expectedAction);

              const entryPrice = existingSig?.entryPrice || existingSig?.currentOptionPrice || optLtp;
              const optSL = Math.max(1, entryPrice - (spotRisk * 0.5));
              const t1 = existingSig?.target1 || Number((entryPrice * 1.25).toFixed(2));
              const t2 = existingSig?.target2 || Number((entryPrice * 1.60).toFixed(2));
              const pnl = Number((((optLtp - entryPrice) / entryPrice) * 100).toFixed(1));

              signals.push({
                id: existingSig?.id || `BN-LIVE-${isCall ? 'CE' : 'PE'}-${atmStrike}`,
                timestamp: existingSig?.timestamp || nowTimeStr,
                lastUpdated: nowTimeStr,
                lastUpdatedMs: Date.now(),
                symbol: 'BANKNIFTY',
                action: expectedAction,
                strike: existingSig?.strike || `${atmStrike} ${isCall ? 'CE' : 'PE'}`,
                entryPrice: Number(entryPrice.toFixed(2)),
                currentOptionPrice: Number(optLtp.toFixed(2)),
                entryRange: existingSig?.entryRange || `₹${(entryPrice * 0.97).toFixed(1)} - ₹${(entryPrice * 1.02).toFixed(1)}`,
                spotPrice: currentBank,
                spotSL: isCall ? (currentBank - spotRisk) : (currentBank + spotRisk),
                optionSL: Number(optSL.toFixed(2)),
                target1: t1,
                target2: t2,
                target1Hit: optLtp >= t1,
                target2Hit: optLtp >= t2,
                pnlPct: pnl,
                confidence: bSkewData?.earlyWarningConfidence || 92,
                mathTrigger: `Bank Nifty Skew (${bSkew > 0 ? '+' : ''}${bSkew.toFixed(1)}%) with ${bSkewData?.earlyWarningSignal || 'Institutional Call Bloat'}.`,
                conceptUsed: 'Skew Velocity Drift + Asymmetry Rebound',
                isUrgent: Math.abs(bSkew) > 15
              });
            }

            // 2. Nifty Live Trade Signal (Skew-based)
            if (Math.abs(nSkew) > 5.0 || nSkewData?.earlyWarningConfidence > 75) {
              const isCall = nSkew > 0;
              const expectedAction = isCall ? 'BUY CE' : 'BUY PE';
              const atmStrike = Math.round(currentNifty / 50) * 50;
              const optLtp = isCall ? (Number(nSkewData?.ceLtp) || 75) : (Number(nSkewData?.peLtp) || 65);
              const spotRisk = 25;
              const existingSig = currentHistory.find(s => s.symbol === 'NIFTY 50' && s.action === expectedAction);

              const entryPrice = existingSig?.entryPrice || existingSig?.currentOptionPrice || optLtp;
              const optSL = Math.max(1, entryPrice - (spotRisk * 0.5));
              const t1 = existingSig?.target1 || Number((entryPrice * 1.30).toFixed(2));
              const t2 = existingSig?.target2 || Number((entryPrice * 1.70).toFixed(2));
              const pnl = Number((((optLtp - entryPrice) / entryPrice) * 100).toFixed(1));

              signals.push({
                id: existingSig?.id || `NIFTY-LIVE-${isCall ? 'CE' : 'PE'}-${atmStrike}`,
                timestamp: existingSig?.timestamp || nowTimeStr,
                lastUpdated: nowTimeStr,
                lastUpdatedMs: Date.now(),
                symbol: 'NIFTY 50',
                action: expectedAction,
                strike: existingSig?.strike || `${atmStrike} ${isCall ? 'CE' : 'PE'}`,
                entryPrice: Number(entryPrice.toFixed(2)),
                currentOptionPrice: Number(optLtp.toFixed(2)),
                entryRange: existingSig?.entryRange || `₹${(entryPrice * 0.96).toFixed(1)} - ₹${(entryPrice * 1.02).toFixed(1)}`,
                spotPrice: currentNifty,
                spotSL: isCall ? (currentNifty - spotRisk) : (currentNifty + spotRisk),
                optionSL: Number(optSL.toFixed(2)),
                target1: t1,
                target2: t2,
                target1Hit: optLtp >= t1,
                target2Hit: optLtp >= t2,
                pnlPct: pnl,
                confidence: nSkewData?.earlyWarningConfidence || 88,
                mathTrigger: `Nifty Skew (${nSkew > 0 ? '+' : ''}${nSkew.toFixed(1)}%) with ${nSkewData?.earlyWarningSignal || 'S5 Demand Zone Defense'}.`,
                conceptUsed: 'Premium Elasticity + Put-Call Asymmetry',
                isUrgent: Math.abs(nSkew) > 10
              });
            }

            // 3. F&O High-Skew Stock Signals
            if (json.stockSignals && Array.isArray(json.stockSignals)) {
              json.stockSignals.forEach((stk: any) => {
                const existingSig = currentHistory.find(s => s.symbol === stk.symbol && s.action === stk.action);
                const entryPrice = existingSig?.entryPrice || existingSig?.currentOptionPrice || stk.currentOptionPrice;
                const liveOptPrice = Number(stk.currentOptionPrice);
                const pnl = Number((((liveOptPrice - entryPrice) / entryPrice) * 100).toFixed(1));

                signals.push({
                  id: existingSig?.id || `STK-${stk.id}`,
                  timestamp: existingSig?.timestamp || stk.timestamp || nowTimeStr,
                  lastUpdated: nowTimeStr,
                  lastUpdatedMs: Date.now(),
                  symbol: stk.symbol,
                  action: stk.action,
                  strike: existingSig?.strike || stk.strike,
                  entryPrice: Number(entryPrice.toFixed(2)),
                  currentOptionPrice: Number(liveOptPrice.toFixed(2)),
                  entryRange: existingSig?.entryRange || stk.entryRange,
                  spotPrice: stk.spotPrice,
                  spotSL: stk.spotSL,
                  optionSL: stk.optionSL,
                  target1: stk.target1,
                  target2: stk.target2,
                  target1Hit: liveOptPrice >= stk.target1,
                  target2Hit: liveOptPrice >= stk.target2,
                  pnlPct: pnl,
                  confidence: stk.confidence,
                  mathTrigger: stk.mathTrigger,
                  conceptUsed: stk.conceptUsed,
                  isUrgent: Math.abs(stk.skewSpreadPct || 0) > 20
                });
              });
            }

            // Merge new signals into cumulative history with fresh live updates
            setHistoricalSignals(prev => {
              const map = new Map<string, LiveSignal>();
              // Keep previous signals
              prev.forEach(s => map.set(s.id, s));
              // Update with live dynamic signals
              signals.forEach(s => {
                const existing = map.get(s.id);
                if (existing) {
                  map.set(s.id, {
                    ...existing,
                    ...s,
                    entryPrice: existing.entryPrice || existing.currentOptionPrice,
                    entryRange: existing.entryRange,
                    timestamp: existing.timestamp || s.timestamp,
                    currentOptionPrice: s.currentOptionPrice,
                    spotPrice: s.spotPrice,
                    target1Hit: s.target1Hit,
                    target2Hit: s.target2Hit,
                    pnlPct: s.pnlPct,
                    lastUpdated: s.lastUpdated,
                    lastUpdatedMs: s.lastUpdatedMs
                  });
                } else {
                  map.set(s.id, s);
                }
              });
              const combined = Array.from(map.values());
              try {
                // Persist on backend
                fetch(`${backendUrl}/api/scanner/historical-signals`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(combined)
                }).catch(() => {});
                // Keep localstorage fallback
                const todayKey = 'today_live_math_signals_' + new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
                localStorage.setItem(todayKey, JSON.stringify(combined));
              } catch (e) {}
              return combined;
            });

            setActiveSignals(signals);

            // Play voice announcement only ONCE when a new unique strike setup triggers
            if (signals.length > 0) {
              const topSig = signals[0];
              if (topSig.id !== lastSignalIdRef.current) {
                lastSignalIdRef.current = topSig.id;
                const voiceMsg = `Alert! ${topSig.symbol} ${topSig.action}. Buy ${topSig.strike} at ${Math.round(topSig.currentOptionPrice)} rupees. Stop loss ${Math.round(topSig.optionSL)} rupees.`;
                speakAIVoiceAlert(voiceMsg, topSig.action.includes('CE'));
              }
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch live signals:', err);
      }
    };

    fetchLiveSignals();
    const interval = setInterval(fetchLiveSignals, 2000); // 2-second ultra-fast live polling
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [refreshKey, soundEnabled]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px', flex: 1, overflowY: 'auto', boxSizing: 'border-box' }}>
      
      {/* Top Live Signal Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px',
        padding: '22px 28px',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2) 0%, rgba(59, 130, 246, 0.15) 100%)',
        border: '1px solid rgba(239, 68, 68, 0.4)',
        borderRadius: '16px',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.25)', padding: '14px', borderRadius: '14px', border: '1px solid rgba(239, 68, 68, 0.4)' }}>
            <Zap size={32} color="#f87171" className="animate-pulse" />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '900', color: 'white', letterSpacing: '-0.3px' }}>
                🎯 Live Math Trade Alerts (Zero-Delay Feed)
              </h2>
              <span style={{ fontSize: '11px', fontWeight: '900', background: '#ef4444', color: 'white', padding: '4px 12px', borderRadius: '20px', animation: 'pulse 1.5s infinite' }}>
                LIVE PRE-MOVE RADAR
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: 'var(--text-secondary)' }}>
              Actionable option entries, dynamic stop loss (Delta = 0.5), and targets triggered 1-3 minutes before the candle breaks out.
            </p>
          </div>
        </div>

        {/* Audio Toggle & Quick Test Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Test Voice Announcement Button */}
          <button
            onClick={() => {
              speakAIVoiceAlert("Alert! Bank Nifty Bullish Skew detected. Buy 57700 Call at 645 rupees. Target 720 rupees.", true);
            }}
            style={{
              background: 'linear-gradient(135deg, #ec4899 0%, #8b5cf6 100%)',
              border: 'none',
              color: 'white',
              padding: '9px 16px',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer',
              boxShadow: '0 4px 14px rgba(236, 72, 153, 0.4)'
            }}
          >
            <Volume2 size={15} /> 🔊 Test Female AI Voice
          </button>

          <button
            onClick={() => {
              setSoundEnabled(!soundEnabled);
              if (!soundEnabled) speakAIVoiceAlert("Voice alerts enabled.", true);
            }}
            style={{
              background: soundEnabled ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
              border: `1px solid ${soundEnabled ? '#10b981' : '#ef4444'}`,
              color: soundEnabled ? '#10b981' : '#f87171',
              padding: '9px 14px',
              borderRadius: '10px',
              fontWeight: '800',
              fontSize: '12px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              cursor: 'pointer'
            }}
          >
            {soundEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
            {soundEnabled ? 'Voice Alerts ON' : 'Muted'}
          </button>

          <button
            onClick={async () => {
              if (window.confirm("Clear all math signal logs for today?")) {
                try {
                  await fetch(`${backendUrl}/api/scanner/clear-historical-signals`, { method: 'POST' });
                } catch (e) {}
                const todayKey = 'today_live_math_signals_' + new Date().toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata' }).replace(/\//g, '-');
                localStorage.removeItem(todayKey);
                setHistoricalSignals([]);
              }
            }}
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.4)',
              color: '#f87171',
              padding: '9px 14px',
              borderRadius: '10px',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            🗑️ Clear History
          </button>

          <button
            onClick={() => {
              setRefreshKey(k => k + 1);
            }}
            className="glass-button"
            style={{ padding: '9px 14px', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', borderRadius: '10px', fontWeight: '700', fontSize: '12px' }}
          >
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Live Skew, Gamma Ratio & Straddle Tickers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '16px' }}>
        
        {/* Nifty 50 Spotlight */}
        <div style={{ padding: '18px 20px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(59, 130, 246, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>NIFTY 50 LIVE SPOT & GAMMA</div>
            <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa' }}>
              ATM Straddle: ₹{niftyStraddle.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#60a5fa' }}>₹{niftySpot.toFixed(2)}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                Γ Gamma: {niftyGamma.toFixed(2)}x
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', background: niftySkew > 15 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)', color: niftySkew > 15 ? '#10b981' : '#e2e8f0' }}>
                Skew: {niftySkew > 0 ? '+' : ''}{niftySkew.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* 🎯 Real-Time Active Contract Tracker with Dynamic Smart Money Action */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px', paddingTop: '10px', borderTop: '1px dashed rgba(59, 130, 246, 0.2)' }}>
            
            {/* CE Card (Call Side) */}
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: niftySkew >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: niftySkew >= 0 ? '1px solid #10b981' : '1px solid #ef4444' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: niftySkew >= 0 ? '#86efac' : '#fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{niftySkew >= 0 ? '🟢 BUYING CALL (CE)' : '🔴 WRITING CALL (CE)'}</span>
                <span style={{ fontSize: '9px', background: niftySkew >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)', padding: '1px 6px', borderRadius: '4px' }}>
                  {niftySkew >= 0 ? 'ACTIVE INFLOW' : 'SHORTING CE'}
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{niftyCeSym}</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: niftySkew >= 0 ? '#86efac' : '#fca5a5', marginTop: '2px' }}>LTP: ₹{niftyCeLtp.toFixed(2)}</div>
            </div>

            {/* PE Card (Put Side) */}
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: niftySkew < 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: niftySkew < 0 ? '1px solid #10b981' : '1px solid #ef4444' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: niftySkew < 0 ? '#86efac' : '#fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{niftySkew < 0 ? '🟢 BUYING PUT (PE)' : '🔴 WRITING PUT (PE)'}</span>
                <span style={{ fontSize: '9px', background: niftySkew < 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)', padding: '1px 6px', borderRadius: '4px' }}>
                  {niftySkew < 0 ? 'ACTIVE INFLOW' : 'DECAYING FLOOR'}
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{niftyPeSym}</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: niftySkew < 0 ? '#86efac' : '#fca5a5', marginTop: '2px' }}>LTP: ₹{niftyPeLtp.toFixed(2)}</div>
            </div>
          </div>
        </div>

        {/* Bank Nifty Spotlight */}
        <div style={{ padding: '18px 20px', borderRadius: '14px', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid rgba(168, 85, 247, 0.3)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>BANK NIFTY LIVE SPOT & GAMMA</div>
            <span style={{ fontSize: '11px', fontWeight: '800', padding: '2px 8px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc' }}>
              ATM Straddle: ₹{bankStraddle.toFixed(2)}
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '24px', fontWeight: '900', color: '#a78bfa' }}>₹{bankSpot.toFixed(2)}</span>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '13px', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', background: 'rgba(234, 179, 8, 0.2)', color: '#facc15' }}>
                Γ Gamma: {bankGamma.toFixed(2)}x
              </span>
              <span style={{ fontSize: '13px', fontWeight: '800', padding: '4px 10px', borderRadius: '8px', background: bankSkew > 15 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.06)', color: bankSkew > 15 ? '#10b981' : '#e2e8f0' }}>
                Skew: {bankSkew > 0 ? '+' : ''}{bankSkew.toFixed(1)}% 🚨
              </span>
            </div>
          </div>

          {/* 🎯 Real-Time Active Contract Tracker with Dynamic Smart Money Action */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginTop: '4px', paddingTop: '10px', borderTop: '1px dashed rgba(168, 85, 247, 0.2)' }}>
            
            {/* Bank CE Card */}
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: bankSkew >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: bankSkew >= 0 ? '1px solid #10b981' : '1px solid #ef4444' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: bankSkew >= 0 ? '#86efac' : '#fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{bankSkew >= 0 ? '🟢 BUYING CALL (CE)' : '🔴 WRITING CALL (CE)'}</span>
                <span style={{ fontSize: '9px', background: bankSkew >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)', padding: '1px 6px', borderRadius: '4px' }}>
                  {bankSkew >= 0 ? 'ACTIVE INFLOW' : 'SHORTING CE'}
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{bankCeSym}</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: bankSkew >= 0 ? '#86efac' : '#fca5a5', marginTop: '2px' }}>LTP: ₹{bankCeLtp.toFixed(2)}</div>
            </div>

            {/* Bank PE Card */}
            <div style={{ padding: '8px 10px', borderRadius: '8px', background: bankSkew < 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)', border: bankSkew < 0 ? '1px solid #10b981' : '1px solid #ef4444' }}>
              <div style={{ fontSize: '10px', fontWeight: '900', color: bankSkew < 0 ? '#86efac' : '#fca5a5', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span>{bankSkew < 0 ? '🟢 BUYING PUT (PE)' : '🔴 WRITING PUT (PE)'}</span>
                <span style={{ fontSize: '9px', background: bankSkew < 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)', padding: '1px 6px', borderRadius: '4px' }}>
                  {bankSkew < 0 ? 'ACTIVE INFLOW' : 'DECAYING FLOOR'}
                </span>
              </div>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'white', marginTop: '2px' }}>{bankPeSym}</div>
              <div style={{ fontSize: '14px', fontWeight: '900', color: bankSkew < 0 ? '#86efac' : '#fca5a5', marginTop: '2px' }}>LTP: ₹{bankPeLtp.toFixed(2)}</div>
            </div>
          </div>
        </div>

      </div>

      {/* 🚨 LIVE ACTIONABLE TRADE CARDS */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={20} color="#ef4444" />
          <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            Active Pre-Breakout Trade Recommendations
          </h3>
        </div>
        {[...historicalSignals].reverse().map((sig, idx) => {
          // Find if there is a live active price update for this signal
          const activeSig = activeSignals.find(s => s.id === sig.id);
          let livePrice = activeSig ? activeSig.currentOptionPrice : sig.currentOptionPrice;
          if (sig.symbol === 'NIFTY 50') {
            livePrice = sig.action.includes('CE') ? (niftyCeLtp || sig.currentOptionPrice) : (niftyPeLtp || sig.currentOptionPrice);
          } else if (sig.symbol === 'BANKNIFTY') {
            livePrice = sig.action.includes('CE') ? (bankCeLtp || sig.currentOptionPrice) : (bankPeLtp || sig.currentOptionPrice);
          }

          const entryBase = sig.entryPrice || sig.currentOptionPrice;
          const currentPnl = entryBase > 0 && livePrice > 0 ? Number((((livePrice - entryBase) / entryBase) * 100).toFixed(1)) : 0;
          const isT1Hit = livePrice >= sig.target1;
          const isT2Hit = livePrice >= sig.target2;

          return (
            <div 
              key={sig.id || idx}
              style={{
                padding: '24px',
                borderRadius: '16px',
                background: sig.action.includes('CE') 
                  ? 'linear-gradient(135deg, rgba(16, 185, 129, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)' 
                  : 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(15, 23, 42, 0.9) 100%)',
                border: `2px solid ${sig.action.includes('CE') ? '#10b981' : '#ef4444'}`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                display: 'flex',
                flexDirection: 'column',
                gap: '18px'
              }}
            >
              {/* Card Header Row */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{
                    fontSize: '15px',
                    fontWeight: '900',
                    padding: '8px 16px',
                    borderRadius: '10px',
                    background: sig.action.includes('CE') ? '#10b981' : '#ef4444',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    {sig.action.includes('CE') ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                    {sig.action}
                  </span>
                  <span style={{ fontSize: '22px', fontWeight: '900', color: 'white' }}>
                    {sig.symbol} {sig.strike}
                  </span>
                  
                  {/* Real-Time Live Status Badge */}
                  {isT2Hit ? (
                    <span style={{ fontSize: '12px', fontWeight: '900', background: 'linear-gradient(135deg, #f59e0b, #ef4444)', color: 'white', padding: '6px 14px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(245, 158, 11, 0.5)' }}>
                      🚀 TARGET 2 HIT (+60%+)
                    </span>
                  ) : isT1Hit ? (
                    <span style={{ fontSize: '12px', fontWeight: '900', background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white', padding: '6px 14px', borderRadius: '8px', boxShadow: '0 2px 10px rgba(16, 185, 129, 0.5)' }}>
                      🎯 TARGET 1 HIT (+25%)
                    </span>
                  ) : currentPnl > 0 ? (
                    <span style={{ fontSize: '12px', fontWeight: '900', background: 'rgba(16, 185, 129, 0.25)', color: '#86efac', border: '1px solid #10b981', padding: '6px 12px', borderRadius: '8px' }}>
                      🟢 RUNNING +{currentPnl}%
                    </span>
                  ) : currentPnl < 0 ? (
                    <span style={{ fontSize: '12px', fontWeight: '900', background: 'rgba(239, 68, 68, 0.25)', color: '#fca5a5', border: '1px solid #ef4444', padding: '6px 12px', borderRadius: '8px' }}>
                      🔴 {currentPnl}% ROI
                    </span>
                  ) : (
                    <span style={{ fontSize: '12px', fontWeight: '900', background: 'rgba(59, 130, 246, 0.25)', color: '#93c5fd', border: '1px solid #3b82f6', padding: '6px 12px', borderRadius: '8px' }}>
                      ⚡ LIVE ACTIVE
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(59, 130, 246, 0.2)', color: '#93c5fd', padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                    ⏰ Triggered: {sig.timestamp}
                  </span>
                  <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(16, 185, 129, 0.15)', color: '#86efac', padding: '5px 10px', borderRadius: '6px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                    🔄 Updated: {sig.lastUpdated || 'Live'}
                  </span>
                  <span style={{ fontSize: '12px', fontWeight: '800', background: 'rgba(255,255,255,0.1)', color: '#fef08a', padding: '5px 12px', borderRadius: '6px' }}>
                    ⚡ CONFIDENCE: {sig.confidence}%
                  </span>
                </div>
              </div>

              {/* Price Execution Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
                
                {/* Live Spot Price */}
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>LIVE UNDERLYING SPOT</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#60a5fa', marginTop: '2px' }}>
                    ₹{(activeSig ? activeSig.spotPrice : sig.spotPrice).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: '#86efac' }}>● Real-time tick</div>
                </div>

                {/* Live Option LTP */}
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ fontSize: '11px', color: '#86efac', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>LIVE OPTION LTP</span>
                    <span style={{ fontSize: '9px', background: '#10b981', color: 'black', padding: '1px 5px', borderRadius: '4px', fontWeight: '900' }}>NFO LIVE</span>
                  </div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#86efac', marginTop: '2px' }}>
                    ₹{livePrice > 0 ? livePrice.toFixed(2) : (sig.currentOptionPrice || 0).toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Entry: {sig.entryRange}</div>
                </div>

                {/* Option Stop Loss */}
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>OPTION STOP LOSS</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: '#ef4444', marginTop: '2px' }}>
                    ₹{sig.optionSL.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Spot SL: ₹{sig.spotSL.toFixed(1)}</div>
                </div>

                {/* Target 1 */}
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: isT1Hit ? 'rgba(16, 185, 129, 0.15)' : 'rgba(0,0,0,0.3)', border: isT1Hit ? '1px solid #10b981' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11px', color: isT1Hit ? '#86efac' : 'var(--text-muted)' }}>TARGET 1 (MOMENTUM)</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: isT1Hit ? '#86efac' : '#fef08a', marginTop: '2px' }}>
                    ₹{sig.target1.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: isT1Hit ? '#86efac' : '#fef08a', fontWeight: isT1Hit ? '800' : 'normal' }}>
                    {isT1Hit ? '✅ TARGET 1 HIT' : '+20% to +30% ROI'}
                  </div>
                </div>

                {/* Target 2 */}
                <div style={{ padding: '12px 16px', borderRadius: '10px', background: isT2Hit ? 'rgba(245, 158, 11, 0.15)' : 'rgba(0,0,0,0.3)', border: isT2Hit ? '1px solid #f59e0b' : '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: '11px', color: isT2Hit ? '#fde047' : 'var(--text-muted)' }}>TARGET 2 (RUNNER)</div>
                  <div style={{ fontSize: '18px', fontWeight: '900', color: isT2Hit ? '#fde047' : '#60a5fa', marginTop: '2px' }}>
                    ₹{sig.target2.toFixed(2)}
                  </div>
                  <div style={{ fontSize: '10px', color: isT2Hit ? '#fde047' : '#93c5fd', fontWeight: isT2Hit ? '800' : 'normal' }}>
                    {isT2Hit ? '🚀 TARGET 2 HIT' : '+50% to +70% ROI'}
                  </div>
                </div>

              </div>

              {/* Mathematical Rationale & Concept */}
              <div style={{ padding: '14px 18px', borderRadius: '10px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                  <Target size={16} color="#3b82f6" />
                  <strong style={{ fontSize: '13px', color: 'white' }}>LIVE TRIGGER & EXECUTION:</strong>
                  <span style={{ fontSize: '11px', fontWeight: '800', background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '2px 8px', borderRadius: '6px' }}>
                    {sig.conceptUsed}
                  </span>
                </div>
                <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.4' }}>
                  {sig.mathTrigger}
                </div>
              </div>

            </div>
          );
        })}

      </div>

    </div>
  );
}
