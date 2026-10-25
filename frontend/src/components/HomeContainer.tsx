import React, { useState, useEffect, useRef } from 'react';
import { ChartContainer } from './ChartContainer';
import { TrialContainer } from './TrialContainer';
import { HomeBottomWidgets } from './HomeBottomWidgets';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import type { Candle } from '../utils/profileCalculator';
import { calculateMatrixSeriesData, type MatrixSeriesData } from '../utils/matrixCalculator';
import { filterMarketHoursCandles } from '../utils/marketHours';
import { useTheme } from '../context/ThemeContext';
import { Loader2 } from 'lucide-react';

interface HomeContainerProps {
  currentSymbol?: string;
  onSymbolSelect?: (symbol: string) => void;
  onSwitchTab?: (tab: string) => void;
  levelAlert?: any;
  onCloseLevelAlert?: () => void;
  onResetSetupAlerts?: () => void;
  levelAlertsMuted?: boolean;
  onToggleAlertsMuted?: () => void;
  levelAlertsFiredCount?: number;
}

export const HomeContainer: React.FC<HomeContainerProps> = ({
  currentSymbol = 'NSE:NIFTY',
  onSymbolSelect,
  onSwitchTab,
  levelAlert,
  onCloseLevelAlert,
  onResetSetupAlerts,
  levelAlertsMuted,
  onToggleAlertsMuted,
  levelAlertsFiredCount
}) => {
  const { isDark } = useTheme();
  
  // Left Chart is set to NIFTY (5m Candlestick Chart)
  const leftSymbol = 'NSE:NIFTY';
  const leftTimeframe = '5';
  
  const [leftCandles, setLeftCandles] = useState<Candle[]>([]);
  const [leftLoading, setLeftLoading] = useState<boolean>(true);
  const [leftError, setLeftError] = useState<string | null>(null);
  const [leftConnectionStatus, setLeftConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [leftMatrixHistory, setLeftMatrixHistory] = useState<Record<string, any> | null>(null);

  // Right Chart (Trial Tab Component) - follows selected symbol or defaults to NIFTY
  const rightSymbol = currentSymbol || 'NSE:NIFTY';

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Fetch initial candles and setup live streaming for Left Chart (NIFTY 5m)
  useEffect(() => {
    setLeftLoading(true);
    setLeftError(null);
    let isSubscribed = true;

    // Safety timeout to avoid infinite loader
    const timer = setTimeout(() => {
      if (isMountedRef.current && isSubscribed) {
        setLeftLoading(false);
      }
    }, 3500);

    const fetchCandles = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(leftSymbol)}&timeframe=${leftTimeframe}&limit=500`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        });
        if (res.ok && isSubscribed && isMountedRef.current) {
          const data = await res.json();
          if (data.candles && Array.isArray(data.candles) && data.candles.length > 0) {
            const filtered = filterMarketHoursCandles(data.candles, leftSymbol, leftTimeframe);
            setLeftCandles(filtered);
            setLeftLoading(false);
            setLeftConnectionStatus('connected');
          }
        }
      } catch (err: any) {
        if (isMountedRef.current && isSubscribed) {
          setLeftError(err.message || 'Failed to fetch NIFTY candles');
          setLeftLoading(false);
        }
      }
    };

    fetchCandles();

    // Subscribe to live stream
    const unsubscribeStream = tvStreamer.subscribe(leftSymbol, leftTimeframe, (payload) => {
      if (!isMountedRef.current || !isSubscribed) return;
      if (payload.candles && payload.candles.length > 0) {
        setLeftCandles(filterMarketHoursCandles(payload.candles, leftSymbol, leftTimeframe));
        setLeftLoading(false);
        setLeftConnectionStatus('connected');
      }
      if (payload.matrixHistory) {
        setLeftMatrixHistory(payload.matrixHistory);
      }
    });

    const unsubscribeStatus = tvStreamer.addStatusListener((status) => {
      if (!isMountedRef.current || !isSubscribed) return;
      setLeftConnectionStatus(status === 'connected' ? 'connected' : 'disconnected');
    });

    return () => {
      isSubscribed = false;
      clearTimeout(timer);
      unsubscribeStream();
      unsubscribeStatus();
    };
  }, [leftSymbol, leftTimeframe]);

  const leftMatrixData = calculateMatrixSeriesData(leftCandles, leftMatrixHistory);

  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      minHeight: 0,
      minWidth: 0,
      height: '100%',
      width: '100%',
      overflowY: 'auto',
      gap: '8px'
    }}>
      {/* 1. TOP SUB-TABS NAVIGATION BAR MATCHING SCREENSHOT */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '4px 6px',
        background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
        borderRadius: '8px',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        flexShrink: 0
      }}>
        {[
          { id: 'home', label: 'Chart' },
          { id: 'test', label: 'Orderflow' },
          { id: 'footprint_chart', label: 'Footprint' },
          { id: 'market_profile', label: 'Market Profile' },
          { id: 'cvd_adv', label: 'Volume Profile' },
          { id: 'sr_breakout', label: 'VSA' }
        ].map((tab) => {
          const isActive = tab.id === 'home';
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.id === 'home') return;
                if (onSwitchTab) onSwitchTab(tab.id);
              }}
              style={{
                padding: '4px 14px',
                fontSize: '11px',
                fontWeight: '700',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? '#0284c7' : 'transparent',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* 2. SPLIT 2-CHART WORKSPACE */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
        gap: '6px',
        width: '100%',
        minHeight: '440px',
        flex: 1,
        boxSizing: 'border-box'
      }}>
        {/* CHART 1 (LEFT): NIFTY Candlestick Chart (5m) */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: '400px',
          background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          overflow: 'hidden'
        }}>
          {leftLoading && leftCandles.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <Loader2 className="animate-spin" size={24} color="#38bdf8" />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Loading NIFTY (5m)...</span>
            </div>
          ) : (
            <ChartContainer
              key="home-nifty-5m"
              candles={leftCandles}
              symbol={leftSymbol}
              timeframe={leftTimeframe}
              matrixSeriesData={leftMatrixData}
              connectionStatus={leftConnectionStatus}
              connectionError={leftError}
              isMultiChart={true}
              chartIndex={0}
              isActive={true}
              isMaximized={false}
              activeAlert={levelAlert}
              onCloseAlert={onCloseLevelAlert}
              onResetSetupAlerts={onResetSetupAlerts}
              alertsMuted={levelAlertsMuted}
              onToggleAlertsMuted={onToggleAlertsMuted}
              firedAlertsCount={levelAlertsFiredCount}
            />
          )}
        </div>

        {/* CHART 2 (RIGHT): Trial Tab Component (30m Candles, Volume Delta, TPO - Today 9:15 AM only) */}
        <div style={{
          position: 'relative',
          display: 'flex',
          flexDirection: 'column',
          width: '100%',
          height: '100%',
          minHeight: '400px',
          background: isDark ? 'rgba(15, 23, 42, 0.45)' : '#ffffff',
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          overflow: 'hidden'
        }}>
          <TrialContainer
            selectedSymbol={rightSymbol}
            initialTimeframe="30"
            initialLookbackDays={1}
            singleDayOnly={true}
            onSymbolSelect={onSymbolSelect}
            onSwitchToChart={() => onSwitchTab && onSwitchTab('chart')}
          />
        </div>
      </div>

      {/* 3. BOTTOM WIDGETS: Top Movers (Gainers) & Market Breadth (Without News / FII/DII / Market Depth) */}
      <HomeBottomWidgets onSymbolSelect={onSymbolSelect} />
    </div>
  );
};
