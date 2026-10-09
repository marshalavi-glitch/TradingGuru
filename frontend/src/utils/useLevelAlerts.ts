import { useState, useEffect, useRef, useCallback } from 'react';
import type { Candle } from './profileCalculator';
import type { MatrixSeriesData } from './matrixCalculator';
import type { LevelAlert } from '../components/RealtimeLevelAlertPopup';

// ==============================================================================
// CALLING BELL AUDIO SYNTHESIZER (Web Audio API)
// Automatically chimes behind the scenes whenever a level touches or crosses
// ==============================================================================
let sharedAudioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  try {
    if (!sharedAudioCtx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        sharedAudioCtx = new AudioContextClass();
      }
    }
    if (sharedAudioCtx && sharedAudioCtx.state === 'suspended') {
      sharedAudioCtx.resume().catch(() => {});
    }
    return sharedAudioCtx;
  } catch (e) {
    return null;
  }
}

// Automatically unlock Web Audio on first user interaction anywhere in the dashboard
if (typeof window !== 'undefined') {
  const unlockAudio = () => {
    getAudioContext();
    window.removeEventListener('click', unlockAudio);
    window.removeEventListener('keydown', unlockAudio);
    window.removeEventListener('touchstart', unlockAudio);
  };
  window.addEventListener('click', unlockAudio, { once: true, passive: true });
  window.addEventListener('keydown', unlockAudio, { once: true, passive: true });
  window.addEventListener('touchstart', unlockAudio, { once: true, passive: true });
}

export const playCallingBellSound = () => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    // Primary strike harmonics (Desk / Calling Bell)
    const tones = [
      { freq: 1046.5, gain: 0.35, decay: 1.2 }, // Fundamental C6
      { freq: 2093.0, gain: 0.20, decay: 0.8 }, // C7 overtone
      { freq: 3136.0, gain: 0.12, decay: 0.5 }, // G7 shimmer
      { freq: 4186.0, gain: 0.05, decay: 0.3 }  // Metallic impact ping
    ];

    tones.forEach(({ freq, gain, decay }) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(gain, now + 0.005);
      g.gain.exponentialRampToValueAtTime(0.0001, now + decay);

      osc.connect(g);
      g.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + decay);
    });

    // Melodic second bell strike (130ms later for classic "Ding-Ding!")
    setTimeout(() => {
      try {
        const now2 = ctx.currentTime;
        const tones2 = [
          { freq: 1318.5, gain: 0.30, decay: 1.0 }, // E6 resonance
          { freq: 2637.0, gain: 0.15, decay: 0.7 }  // E7 overtone
        ];
        tones2.forEach(({ freq, gain, decay }) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now2);

          g.gain.setValueAtTime(0, now2);
          g.gain.linearRampToValueAtTime(gain, now2 + 0.005);
          g.gain.exponentialRampToValueAtTime(0.0001, now2 + decay);

          osc.connect(g);
          g.connect(ctx.destination);

          osc.start(now2);
          osc.stop(now2 + decay);
        });
      } catch (e) {}
    }, 130);
  } catch (err) {
    console.warn('Calling bell audio error:', err);
  }
};

interface UseLevelAlertsProps {
  candles: Candle[];
  matrixSeriesData: MatrixSeriesData | null;
  symbol: string;
  timeframe: string;
}

export function useLevelAlerts({
  candles,
  matrixSeriesData,
  symbol,
  timeframe
}: UseLevelAlertsProps) {
  const [activeAlert, setActiveAlert] = useState<LevelAlert | null>(null);
  const [alertsMuted, setAlertsMuted] = useState<boolean>(false);
  const [firedCount, setFiredCount] = useState<number>(0);
  const triggeredAlertsRef = useRef<Set<string>>(new Set());
  const currentSetupRef = useRef<string>('');
  const prevPriceRef = useRef<number | null>(null);

  // Setup identifier (symbol + timeframe + session date)
  const latestCandle = candles && candles.length > 0 ? candles[candles.length - 1] : null;
  const sessionDate = latestCandle
    ? (typeof latestCandle.time === 'string'
        ? latestCandle.time.slice(0, 10)
        : new Date((latestCandle.time as number) * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }))
    : new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

  const setupKey = `${symbol}-${timeframe}-${sessionDate}`;

  // Reset alerts when setup changes (different stock, timeframe, or new day session)
  useEffect(() => {
    if (currentSetupRef.current && currentSetupRef.current !== setupKey) {
      triggeredAlertsRef.current.clear();
      prevPriceRef.current = null;
      setFiredCount(0);
      setActiveAlert(null);
    }
    currentSetupRef.current = setupKey;
  }, [setupKey]);

  // Manual reset mechanism for current trade setup
  const handleResetSetupAlerts = useCallback(() => {
    triggeredAlertsRef.current.clear();
    prevPriceRef.current = null;
    setFiredCount(0);
    setActiveAlert(null);
  }, []);

  const handleCloseAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  // Real-time touch/cross detection against matrix trading levels
  useEffect(() => {
    if (alertsMuted || !candles || candles.length === 0 || !matrixSeriesData) return;

    const currentCandle = candles[candles.length - 1];
    const currentPrice = currentCandle.close;
    const candleHigh = currentCandle.high;
    const candleLow = currentCandle.low;
    const prevPrice = prevPriceRef.current;

    const getLevelVal = (points?: { value: number }[]) =>
      points && points.length > 0 ? points[points.length - 1].value : undefined;

    const monitoredLevels: { id: string; type: LevelAlert['type']; price?: number; label: string }[] = [
      { id: 'level4_r3', type: 'SELL REVERSAL', price: getLevelVal(matrixSeriesData.level4), label: 'Sell Reversal (R3)' },
      { id: 'level7_s3', type: 'BUY REVERSAL', price: getLevelVal(matrixSeriesData.level7), label: 'Buy Reversal (S3)' },
      { id: 'level3_r4', type: 'BREAKOUT', price: getLevelVal(matrixSeriesData.level3), label: 'Bullish Breakout (R4)' },
      { id: 'level8_s4', type: 'BREAK DOWN', price: getLevelVal(matrixSeriesData.level8), label: 'Bearish Breakdown (S4)' },
      { id: 'level2_r5', type: 'TARGET 1', price: getLevelVal(matrixSeriesData.level2), label: 'Target 1 Hit (R5)' },
      { id: 'level9_s5', type: 'TARGET 1', price: getLevelVal(matrixSeriesData.level9), label: 'Target 1 Hit (S5)' },
      { id: 'level1_r6', type: 'TARGET 2', price: getLevelVal(matrixSeriesData.level1), label: 'Target 2 Hit (R6)' },
      { id: 'level10_s6', type: 'TARGET 2', price: getLevelVal(matrixSeriesData.level10), label: 'Target 2 Hit (S6)' },
    ];

    for (const lvl of monitoredLevels) {
      if (!lvl.price || lvl.price <= 0) continue;
      if (triggeredAlertsRef.current.has(lvl.id)) continue;

      let isTriggered = false;

      // 1. Cross up through level
      if (prevPrice !== null && prevPrice < lvl.price && currentPrice >= lvl.price) {
        isTriggered = true;
      }
      // 2. Cross down through level
      else if (prevPrice !== null && prevPrice > lvl.price && currentPrice <= lvl.price) {
        isTriggered = true;
      }
      // 3. Candle range touch
      else if (candleHigh >= lvl.price && candleLow <= lvl.price) {
        isTriggered = true;
      }
      // 4. Proximity touch within 0.05%
      else if (Math.abs(currentPrice - lvl.price) / lvl.price <= 0.0005) {
        isTriggered = true;
      }

      if (isTriggered) {
        triggeredAlertsRef.current.add(lvl.id);
        setFiredCount(triggeredAlertsRef.current.size);

        const istTime = new Intl.DateTimeFormat('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }).format(new Date()) + ' IST';

        // Trigger authentic calling bell sound
        playCallingBellSound();

        setActiveAlert({
          id: `${symbol}-${lvl.id}-${Date.now()}`,
          symbol,
          alertType: lvl.type,
          type: lvl.type,
          triggeredPrice: currentPrice,
          levelPrice: lvl.price,
          timestamp: istTime,
          setupKey,
          levelName: lvl.label,
          levelLabel: lvl.label,
          isBullish: lvl.type === 'BUY REVERSAL' || lvl.type === 'BREAKOUT' || lvl.id.startsWith('level2') || lvl.id.startsWith('level1'),
          condition: 'touched'
        });

        // One alert per price update
        break;
      }
    }

    prevPriceRef.current = currentPrice;
  }, [candles, matrixSeriesData, symbol, setupKey, alertsMuted]);

  return {
    activeAlert,
    alertsMuted,
    firedCount,
    setAlertsMuted,
    handleCloseAlert,
    handleResetSetupAlerts,
    playCallingBellSound
  };
}
