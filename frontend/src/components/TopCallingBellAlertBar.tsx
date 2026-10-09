import React from 'react';
import { Bell, RotateCcw, X, Zap, Volume2, ArrowRight } from 'lucide-react';
import type { LevelAlert } from './RealtimeLevelAlertPopup';
import { useTheme } from '../context/ThemeContext';

interface TopCallingBellAlertBarProps {
  alert: LevelAlert | null;
  onClose: () => void;
  onResetSetup: () => void;
  onSwitchToChart: () => void;
}

export const TopCallingBellAlertBar: React.FC<TopCallingBellAlertBarProps> = ({
  alert,
  onClose,
  onResetSetup,
  onSwitchToChart
}) => {
  const { isDark } = useTheme();
  if (!alert) return null;

  const effectiveType = String(alert.alertType || alert.type || '').toUpperCase();
  const effectiveLevelName = alert.levelName || alert.levelLabel || effectiveType;
  const isTarget = effectiveType.includes('TARGET');
  const isBreakout = effectiveType.includes('BREAKOUT');
  const isBreakdown = effectiveType.includes('BREAK DOWN') || effectiveType.includes('BREAKDOWN');
  const isBuyRev = effectiveType.includes('BUY REVERSAL') || (effectiveType.includes('BUY') && !isTarget);
  const isSellRev = effectiveType.includes('SELL REVERSAL') || (effectiveType.includes('SELL') && !isTarget);
  const isBullish = alert.isBullish ?? (isBuyRev || isBreakout || effectiveType.includes('R5') || effectiveType.includes('R6'));

  const baseEndColor = isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff';

  let primaryColor = '#10b981';
  let bannerBg = `linear-gradient(135deg, rgba(16, 185, 129, 0.16) 0%, ${baseEndColor} 100%)`;
  let borderColor = 'rgba(16, 185, 129, 0.4)';
  let glowColor = 'rgba(16, 185, 129, 0.25)';

  if (isTarget) {
    if (effectiveType.includes('2')) {
      primaryColor = '#facc15';
      bannerBg = `linear-gradient(135deg, rgba(250, 204, 21, 0.16) 0%, ${baseEndColor} 100%)`;
      borderColor = 'rgba(250, 204, 21, 0.4)';
      glowColor = 'rgba(250, 204, 21, 0.25)';
    } else {
      primaryColor = isBullish ? '#34d399' : '#ef4444';
      bannerBg = isBullish 
        ? `linear-gradient(135deg, rgba(52, 211, 153, 0.16) 0%, ${baseEndColor} 100%)`
        : `linear-gradient(135deg, rgba(239, 68, 68, 0.16) 0%, ${baseEndColor} 100%)`;
      borderColor = isBullish ? 'rgba(52, 211, 153, 0.4)' : 'rgba(239, 68, 68, 0.4)';
      glowColor = isBullish ? 'rgba(52, 211, 153, 0.25)' : 'rgba(239, 68, 68, 0.25)';
    }
  } else if (isBreakout) {
    primaryColor = '#06b6d4';
    bannerBg = `linear-gradient(135deg, rgba(6, 182, 212, 0.16) 0%, ${baseEndColor} 100%)`;
    borderColor = 'rgba(6, 182, 212, 0.4)';
    glowColor = 'rgba(6, 182, 212, 0.25)';
  } else if (isBreakdown) {
    primaryColor = '#f97316';
    bannerBg = `linear-gradient(135deg, rgba(249, 115, 22, 0.16) 0%, ${baseEndColor} 100%)`;
    borderColor = 'rgba(249, 115, 22, 0.4)';
    glowColor = 'rgba(249, 115, 22, 0.25)';
  } else if (isSellRev) {
    primaryColor = '#f43f5e';
    bannerBg = `linear-gradient(135deg, rgba(244, 63, 94, 0.16) 0%, ${baseEndColor} 100%)`;
    borderColor = 'rgba(244, 63, 94, 0.4)';
    glowColor = 'rgba(244, 63, 94, 0.25)';
  }

  return (
    <div 
      style={{
        width: '100%',
        background: bannerBg,
        border: `1px solid ${borderColor}`,
        borderRadius: '12px',
        padding: '10px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: `0 4px 20px rgba(0, 0, 0, 0.4), 0 0 15px ${glowColor}`,
        position: 'relative',
        animation: 'slideDownBar 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        boxSizing: 'border-box'
      }}
    >
      {/* Left: Calling Bell Icon & Alert Details */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', minWidth: '280px' }}>
        <div 
          style={{
            width: '38px',
            height: '38px',
            borderRadius: '10px',
            background: 'rgba(255, 255, 255, 0.08)',
            border: `1px solid ${primaryColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: `0 0 10px ${glowColor}`
          }}
        >
          <Bell size={20} color={primaryColor} className="calling-bell-ringing" />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{
              background: `${primaryColor}25`,
              color: primaryColor,
              border: `1px solid ${primaryColor}50`,
              padding: '2px 7px',
              borderRadius: '5px',
              fontSize: '10px',
              fontWeight: '900',
              letterSpacing: '0.4px',
              textTransform: 'uppercase',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              🔔 CALLING BELL ALERT
            </span>
            <strong style={{ fontSize: '13px', color: isDark ? '#ffffff' : '#0f172a' }}>
              {alert.symbol}
            </strong>
            <span style={{ fontSize: '12px', color: primaryColor, fontWeight: '800' }}>
              {effectiveLevelName}
            </span>
          </div>

          <div style={{ fontSize: '11px', color: isDark ? '#cbd5e1' : '#475569', display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <span>Triggered: <strong style={{ color: isDark ? '#ffffff' : '#0f172a', fontFamily: 'monospace' }}>₹{alert.triggeredPrice.toFixed(2)}</strong></span>
            <span>Level: <strong style={{ color: primaryColor, fontFamily: 'monospace' }}>₹{alert.levelPrice.toFixed(2)}</strong></span>
            <span style={{ color: isDark ? '#94a3b8' : '#64748b', fontSize: '10px' }}>• {alert.timestamp}</span>
          </div>
        </div>
      </div>

      {/* Right: Action Buttons */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <button
          onClick={onSwitchToChart}
          title="Open Candlestick Chart tab to see this level"
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            border: 'none',
            color: '#ffffff',
            padding: '5px 12px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '800',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px',
            boxShadow: '0 0 10px rgba(59, 130, 246, 0.4)',
            transition: 'all 0.15s ease'
          }}
        >
          <Zap size={12} />
          <span>View Candlestick Chart</span>
          <ArrowRight size={12} />
        </button>

        <button
          onClick={onResetSetup}
          title="Reset alert setup so levels can trigger again"
          style={{
            background: 'rgba(59, 130, 246, 0.15)',
            border: '1px solid rgba(59, 130, 246, 0.35)',
            color: '#93c5fd',
            padding: '5px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            fontWeight: '700',
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px'
          }}
        >
          <RotateCcw size={12} />
          <span>Reset</span>
        </button>

        <button
          onClick={onClose}
          title="Dismiss alert"
          style={{
            background: 'transparent',
            border: 'none',
            color: '#94a3b8',
            padding: '4px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: '4px'
          }}
        >
          <X size={16} />
        </button>
      </div>

      <style>{`
        @keyframes callingBellWobble {
          0% { transform: rotate(0deg); }
          15% { transform: rotate(18deg); }
          30% { transform: rotate(-16deg); }
          45% { transform: rotate(12deg); }
          60% { transform: rotate(-8deg); }
          75% { transform: rotate(4deg); }
          100% { transform: rotate(0deg); }
        }
        .calling-bell-ringing {
          animation: callingBellWobble 1s cubic-bezier(0.36, 0.07, 0.19, 0.97) infinite;
          transform-origin: top center;
        }
        @keyframes slideDownBar {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};
