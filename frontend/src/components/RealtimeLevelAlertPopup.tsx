import React, { useEffect, useState } from 'react';
import { 
  X, RotateCcw, TrendingUp, TrendingDown, Target, Zap, ArrowUpRight, ArrowDownRight, Clock, Bell
} from 'lucide-react';
import { playCallingBellSound } from '../utils/useLevelAlerts';
import { useTheme } from '../context/ThemeContext';

export interface LevelAlert {
  id?: string;
  symbol: string;
  alertType?: 'BUY REVERSAL' | 'SELL REVERSAL' | 'BREAKOUT' | 'BREAK DOWN' | 'TARGET 1 HIT' | 'TARGET 2 HIT' | string;
  type?: string;
  levelName?: string;
  levelLabel?: string;
  triggeredPrice: number;
  levelPrice: number;
  timestamp?: number | string;
  condition?: 'crossed_up' | 'crossed_down' | 'touched' | string;
  isBullish?: boolean;
  timeframe?: string;
  setupKey?: string;
}

interface RealtimeLevelAlertPopupProps {
  alert: LevelAlert | null;
  onClose: () => void;
  onResetSetup: () => void;
  onSwitchToChart?: () => void;
}

export const RealtimeLevelAlertPopup: React.FC<RealtimeLevelAlertPopupProps> = ({
  alert,
  onClose,
  onResetSetup,
  onSwitchToChart
}) => {
  const { isDark } = useTheme();
  const [countdown, setCountdown] = useState<number>(12);

  // Auto dismiss countdown
  useEffect(() => {
    if (!alert) return;
    setCountdown(12);

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [alert, onClose]);

  if (!alert) return null;

  // Visual color theme based on alert type - safely normalized
  const effectiveType = String(alert.alertType || alert.type || '').toUpperCase();
  const effectiveLevelName = alert.levelName || alert.levelLabel || effectiveType;
  const isTarget = effectiveType.includes('TARGET');
  const isBreakout = effectiveType.includes('BREAKOUT');
  const isBreakdown = effectiveType.includes('BREAK DOWN') || effectiveType.includes('BREAKDOWN');
  const isBuyRev = effectiveType.includes('BUY REVERSAL') || (effectiveType.includes('BUY') && !isTarget);
  const isSellRev = effectiveType.includes('SELL REVERSAL') || (effectiveType.includes('SELL') && !isTarget);
  const isBullish = alert.isBullish ?? (isBuyRev || isBreakout || effectiveType.includes('R5') || effectiveType.includes('R6'));

  let primaryColor = '#10b981';
  let badgeBg = 'rgba(16, 185, 129, 0.2)';
  let shadowColor = 'rgba(16, 185, 129, 0.35)';

  if (isTarget) {
    if (effectiveType.includes('2')) {
      primaryColor = '#facc15'; // Gold
      badgeBg = 'rgba(250, 204, 21, 0.2)';
      shadowColor = 'rgba(250, 204, 21, 0.35)';
    } else {
      primaryColor = isBullish ? '#34d399' : '#ef4444';
      badgeBg = isBullish ? 'rgba(52, 211, 153, 0.2)' : 'rgba(239, 68, 68, 0.2)';
      shadowColor = isBullish ? 'rgba(52, 211, 153, 0.35)' : 'rgba(239, 68, 68, 0.35)';
    }
  } else if (isBreakout) {
    primaryColor = '#06b6d4'; // Cyan
    badgeBg = 'rgba(6, 182, 212, 0.2)';
    shadowColor = 'rgba(6, 182, 212, 0.35)';
  } else if (isBreakdown) {
    primaryColor = '#f97316'; // Orange
    badgeBg = 'rgba(249, 115, 22, 0.2)';
    shadowColor = 'rgba(249, 115, 22, 0.35)';
  } else if (isSellRev) {
    primaryColor = '#f43f5e'; // Rose
    badgeBg = 'rgba(244, 63, 94, 0.2)';
    shadowColor = 'rgba(244, 63, 94, 0.35)';
  } else if (isBuyRev) {
    primaryColor = '#10b981'; // Green
    badgeBg = 'rgba(16, 185, 129, 0.2)';
    shadowColor = 'rgba(16, 185, 129, 0.35)';
  }

  const formattedTime = typeof alert.timestamp === 'string'
    ? alert.timestamp
    : typeof alert.timestamp === 'number'
      ? new Date(alert.timestamp).toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) + ' IST'
      : new Date().toLocaleTimeString('en-IN', {
          timeZone: 'Asia/Kolkata',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
          hour12: true
        }) + ' IST';

  return (
    <div 
      className="animate-slide-in"
      style={{
        position: 'fixed',
        top: '20px',
        right: '20px',
        zIndex: 99999,
        maxWidth: 'calc(100vw - 32px)',
        width: '420px',
        background: isDark 
          ? 'linear-gradient(135deg, rgba(15, 23, 42, 0.96), rgba(30, 41, 59, 0.98))' 
          : 'linear-gradient(135deg, #ffffff, #f8fafc)',
        border: `1px solid ${primaryColor}`,
        boxShadow: isDark 
          ? `0 10px 30px rgba(0, 0, 0, 0.8), 0 0 25px ${shadowColor}` 
          : `0 10px 30px rgba(0, 0, 0, 0.12), 0 0 20px ${shadowColor}`,
        borderRadius: '12px',
        padding: '16px',
        color: isDark ? '#ffffff' : '#0f172a',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        backdropFilter: 'blur(12px)',
        animation: 'slideInRight 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* Top Header Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{
            background: badgeBg,
            color: primaryColor,
            border: `1px solid ${primaryColor}55`,
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '900',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            letterSpacing: '0.5px'
          }}>
            <Zap size={13} className="animate-pulse" />
            REAL-TIME LEVEL TRIGGER
          </span>
          <span style={{ fontSize: '11px', color: '#94a3b8', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
            Live
          </span>
        </div>

        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            padding: '2px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '4px'
          }}
          title="Close alert popup"
        >
          <X size={16} />
        </button>
      </div>

      {/* Main Alert Body */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {/* Glowing Icon Box */}
        <div style={{
          width: '44px',
          height: '44px',
          borderRadius: '50%',
          background: badgeBg,
          border: `1px solid ${primaryColor}88`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: `0 0 15px ${shadowColor}`
        }}>
          {isTarget ? (
            <Target size={22} color={primaryColor} />
          ) : isBreakout ? (
            <ArrowUpRight size={22} color={primaryColor} />
          ) : isBreakdown ? (
            <ArrowDownRight size={22} color={primaryColor} />
          ) : isBuyRev ? (
            <TrendingUp size={22} color={primaryColor} />
          ) : (
            <TrendingDown size={22} color={primaryColor} />
          )}
        </div>

        {/* Info Content */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '15px', fontWeight: '900', color: isDark ? '#ffffff' : '#0f172a', letterSpacing: '0.3px' }}>
              {alert.symbol}
            </span>
            <span style={{
              fontSize: '11px',
              fontWeight: '800',
              padding: '2px 8px',
              borderRadius: '4px',
              background: badgeBg,
              color: primaryColor,
              border: `1px solid ${primaryColor}66`
            }}>
              {effectiveType}
            </span>
            {alert.timeframe && (
              <span style={{ fontSize: '10px', color: isDark ? '#94a3b8' : '#64748b', background: isDark ? 'rgba(255, 255, 255, 0.05)' : '#f1f5f9', padding: '1px 5px', borderRadius: '3px' }}>
                {alert.timeframe === 'D' ? 'Daily' : `${alert.timeframe}m`}
              </span>
            )}
          </div>

          <div style={{ fontSize: '12px', color: isDark ? '#e2e8f0' : '#334155', marginTop: '4px', display: 'flex', alignItems: 'baseline', gap: '8px', flexWrap: 'wrap' }}>
            <span>
              Trigger Price: <strong style={{ color: primaryColor, fontSize: '14px', fontFamily: 'monospace' }}>₹{alert.triggeredPrice.toFixed(2)}</strong>
            </span>
            <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '11px' }}>
              (Level: <strong style={{ color: isDark ? '#ffffff' : '#0f172a', fontFamily: 'monospace' }}>₹{alert.levelPrice.toFixed(2)}</strong>)
            </span>
          </div>

          <div style={{ fontSize: '11px', color: isDark ? '#94a3b8' : '#64748b', marginTop: '3px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ color: isDark ? '#cbd5e1' : '#475569' }}>{effectiveLevelName}</span>
            <span>•</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
              <Clock size={11} />
              {formattedTime}
            </span>
          </div>
        </div>
      </div>

      {/* Footer Bar: Auto dismiss countdown & Reset button */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '8px',
        paddingTop: '8px',
        borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <div style={{
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '10px',
            fontFamily: 'monospace',
            color: '#94a3b8'
          }}>
            {countdown}
          </div>
          <span style={{ fontSize: '11px', color: '#64748b' }}>
            Auto-dismissing
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {onSwitchToChart && (
            <button
              onClick={() => {
                onSwitchToChart();
                onClose();
              }}
              style={{
                background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                border: 'none',
                color: '#ffffff',
                borderRadius: '6px',
                padding: '3px 10px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)'
              }}
              title="Switch to Candlestick Chart tab"
            >
              <Zap size={11} />
              View Chart
            </button>
          )}

          <button
            onClick={onResetSetup}
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              color: '#60a5fa',
              borderRadius: '6px',
              padding: '3px 8px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}
            title="Reset all alert triggers for this setup so they can fire again"
          >
            <RotateCcw size={11} />
            Reset Setup
          </button>

          <button
            onClick={onClose}
            style={{
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              borderRadius: '6px',
              padding: '3px 10px',
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
};
