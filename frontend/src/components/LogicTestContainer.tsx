import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { createChart } from 'lightweight-charts';
import type { IChartApi, ISeriesApi, Time, LogicalRange } from 'lightweight-charts';
import { getBackendHttpUrl, tvStreamer } from '../utils/tvStreamer';
import type { Candle } from '../utils/profileCalculator';
import {
  detectSwings,
  detectBOSandCHoCH,
  detectSupplyDemandZones,
  calculateDealingRange,
  calculateOptionLevels,
  type SwingPoint,
  type StructureLine,
  type SmcZone,
  type DealingRange,
  type OptionLevels
} from '../utils/smcCalculator';
import {
  RotateCcw,
  Layers,
  ChevronDown,
  Plus,
  Minus,
  Check,
  TrendingUp,
  Activity,
  Maximize2,
  Calendar,
  Sliders,
  X
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

const IST_OFFSET_SECONDS = 19800; // UTC + 5:30 shift for Lightweight Charts

interface LogicTestContainerProps {
  onSwitchToChart?: () => void;
}

interface ContractInfo {
  id: string;
  symbol: string;
  displayName: string;
  type: 'CE' | 'PE';
  strike: number;
  expiry: string;
  isAtm: boolean;
}

const AVAILABLE_EXPIRIES = [
  '13 OCT 2026',
  '15 OCT 2026',
  '22 OCT 2026',
  '29 OCT 2026',
  '05 NOV 2026',
  '12 NOV 2026'
];

export const LogicTestContainer: React.FC<LogicTestContainerProps> = ({ onSwitchToChart }) => {
  const { isDark } = useTheme();

  // Toolbar & Contract states
  const [timeframe, setTimeframe] = useState<string>('5');
  const [expiry, setExpiry] = useState<string>('13 OCT 2026');
  const [manualAtmStrike, setManualAtmStrike] = useState<number | null>(null);
  const [selectedOtms, setSelectedOtms] = useState<string[]>([]);
  const [isOtmDropdownOpen, setIsOtmDropdownOpen] = useState<boolean>(false);
  const [isExpiryDropdownOpen, setIsExpiryDropdownOpen] = useState<boolean>(false);

  // Candles data state
  const [niftyCandles, setNiftyCandles] = useState<Candle[]>([]);
  const [optionCandlesMap, setOptionCandlesMap] = useState<Record<string, Candle[]>>({});
  const [loading, setLoading] = useState<boolean>(true);

  // Shared synchronized crosshair timestamp across all charts
  const [hoveredTime, setHoveredTime] = useState<number | null>(null);
  const [hoveredNifty, setHoveredNifty] = useState<Candle | null>(null);
  const [hoveredOptions, setHoveredOptions] = useState<Record<string, Candle | null>>({});

  // Current NIFTY Spot price & auto ATM strike
  const niftySpotPrice = useMemo(() => {
    if (niftyCandles.length > 0) {
      return niftyCandles[niftyCandles.length - 1].close;
    }
    return 22584.15;
  }, [niftyCandles]);

  const atmStrike = useMemo(() => {
    if (manualAtmStrike !== null) return manualAtmStrike;
    return Math.round(niftySpotPrice / 50) * 50;
  }, [niftySpotPrice, manualAtmStrike]);

  // Available OTM options (3 CALL OTMs and 3 PUT OTMs)
  const otmOptionsList = useMemo(() => {
    return [
      { id: `${atmStrike + 50}-CE`, type: 'CE' as const, strike: atmStrike + 50, label: `${atmStrike + 50} CE` },
      { id: `${atmStrike + 100}-CE`, type: 'CE' as const, strike: atmStrike + 100, label: `${atmStrike + 100} CE` },
      { id: `${atmStrike + 150}-CE`, type: 'CE' as const, strike: atmStrike + 150, label: `${atmStrike + 150} CE` },
      { id: `${atmStrike - 50}-PE`, type: 'PE' as const, strike: atmStrike - 50, label: `${atmStrike - 50} PE` },
      { id: `${atmStrike - 100}-PE`, type: 'PE' as const, strike: atmStrike - 100, label: `${atmStrike - 100} PE` },
      { id: `${atmStrike - 150}-PE`, type: 'PE' as const, strike: atmStrike - 150, label: `${atmStrike - 150} PE` }
    ];
  }, [atmStrike]);

  // List of active option contracts to display on the right
  const activeContracts = useMemo<ContractInfo[]>(() => {
    const list: ContractInfo[] = [
      {
        id: 'atm-ce',
        symbol: `NIFTY 50 ${expiry} CALL ${atmStrike}`,
        displayName: `NIFTY 50 ${expiry} CALL ${atmStrike}`,
        type: 'CE',
        strike: atmStrike,
        expiry,
        isAtm: true
      },
      {
        id: 'atm-pe',
        symbol: `NIFTY 50 ${expiry} PUT ${atmStrike}`,
        displayName: `NIFTY 50 ${expiry} PUT ${atmStrike}`,
        type: 'PE',
        strike: atmStrike,
        expiry,
        isAtm: true
      }
    ];

    selectedOtms.forEach((otmId) => {
      const found = otmOptionsList.find((o) => o.id === otmId);
      if (found) {
        list.push({
          id: `otm-${found.id}`,
          symbol: `NIFTY 50 ${expiry} ${found.type === 'CE' ? 'CALL' : 'PUT'} ${found.strike}`,
          displayName: `NIFTY 50 ${expiry} ${found.type === 'CE' ? 'CALL' : 'PUT'} ${found.strike}`,
          type: found.type,
          strike: found.strike,
          expiry,
          isAtm: false
        });
      }
    });

    return list;
  }, [expiry, atmStrike, selectedOtms, otmOptionsList]);

  // Toggle OTM selection (up to 3 total)
  const toggleOtmSelection = (id: string) => {
    setSelectedOtms((prev) => {
      if (prev.includes(id)) {
        return prev.filter((item) => item !== id);
      }
      if (prev.length >= 3) {
        return prev; // Maximum 3 allowed
      }
      return [...prev, id];
    });
  };

  // 1. Fetch NIFTY Spot candles
  useEffect(() => {
    let isMounted = true;
    const fetchNifty = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/candles?symbol=NSE:NIFTY&timeframe=${timeframe}&limit=120`);
        if (res.ok && isMounted) {
          const data = await res.json();
          if (data.candles && data.candles.length > 0) {
            setNiftyCandles(data.candles);
          }
        }
      } catch (e) {
        console.error('Failed to fetch NIFTY candles:', e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchNifty();

    // Subscribe to live NIFTY updates
    const unsub = tvStreamer.subscribe('NSE:NIFTY', timeframe, (data) => {
      if (!isMounted) return;
      if (data.candles && data.candles.length > 0) {
        setNiftyCandles((prev) => {
          if (data.isSnapshot) return data.candles;
          const tick = data.candles[0];
          const idx = prev.findIndex((c) => c.time === tick.time);
          if (idx !== -1) {
            const next = [...prev];
            next[idx] = tick;
            return next;
          }
          return [...prev, tick];
        });
      }
    });

    return () => {
      isMounted = false;
      unsub();
    };
  }, [timeframe]);

  // 2. Fetch candles for active option contracts
  useEffect(() => {
    let isMounted = true;

    activeContracts.forEach((contract) => {
      const fetchOption = async () => {
        try {
          const backendHttp = await getBackendHttpUrl();
          const res = await fetch(
            `${backendHttp}/api/candles?symbol=${encodeURIComponent(contract.symbol)}&timeframe=${timeframe}&limit=120`
          );
          if (res.ok && isMounted) {
            const data = await res.json();
            if (data.candles && data.candles.length > 0) {
              setOptionCandlesMap((prev) => ({
                ...prev,
                [contract.id]: data.candles
              }));
            }
          }
        } catch (e) {
          console.error(`Failed to fetch candles for ${contract.symbol}:`, e);
        }
      };

      fetchOption();
    });

    return () => {
      isMounted = false;
    };
  }, [activeContracts, timeframe]);

  // Synchronized time range across all charts
  const isSyncingRangeRef = useRef<boolean>(false);
  const chartInstancesRef = useRef<Map<string, IChartApi>>(new Map());

  const handleLogicalRangeChange = useCallback((sourceId: string, range: LogicalRange | null) => {
    if (!range || isSyncingRangeRef.current) return;
    isSyncingRangeRef.current = true;

    chartInstancesRef.current.forEach((chart, id) => {
      if (id !== sourceId) {
        try {
          chart.timeScale().setVisibleLogicalRange(range);
        } catch (e) {}
      }
    });

    setTimeout(() => {
      isSyncingRangeRef.current = false;
    }, 10);
  }, []);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: '100%',
        height: '100vh',
        maxHeight: '100vh',
        backgroundColor: isDark ? '#0b0e14' : '#f8fafc',
        color: isDark ? '#f1f5f9' : '#0f172a',
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        overflow: 'hidden'
      }}
    >
      {/* TOP COMPACT TOOLBAR */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '6px 14px',
          backgroundColor: isDark ? 'rgba(15, 23, 42, 0.85)' : '#ffffff',
          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          fontSize: '12px',
          fontWeight: '600',
          gap: '12px',
          flexShrink: 0,
          zIndex: 40
        }}
      >
        {/* Left Toolbar Items: NIFTY Spot, Expiry, ATM Strike, Timeframe */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* NIFTY Spot Tag */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(56, 189, 248, 0.12)' : '#e0f2fe',
              color: '#0284c7',
              fontWeight: '800'
            }}
          >
            <Activity size={15} />
            <span>NIFTY 50</span>
            <span style={{ color: isDark ? '#38bdf8' : '#0369a1', fontFamily: 'monospace', fontSize: '13px' }}>
              ₹{niftySpotPrice.toFixed(2)}
            </span>
          </div>

          {/* Expiry Selector */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsExpiryDropdownOpen(!isExpiryDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                borderRadius: '6px',
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
                color: isDark ? '#f8fafc' : '#334155',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '12px'
              }}
            >
              <Calendar size={13} color="#94a3b8" />
              <span>Expiry:</span>
              <span style={{ color: '#38bdf8' }}>{expiry}</span>
              <ChevronDown size={13} />
            </button>

            {isExpiryDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  left: 0,
                  marginTop: '4px',
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
                  borderRadius: '6px',
                  boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.4)',
                  zIndex: 100,
                  minWidth: '150px',
                  overflow: 'hidden'
                }}
              >
                {AVAILABLE_EXPIRIES.map((exp) => (
                  <div
                    key={exp}
                    onClick={() => {
                      setExpiry(exp);
                      setIsExpiryDropdownOpen(false);
                    }}
                    style={{
                      padding: '8px 12px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: expiry === exp ? '800' : '600',
                      color: expiry === exp ? '#38bdf8' : isDark ? '#e2e8f0' : '#334155',
                      backgroundColor: expiry === exp ? (isDark ? 'rgba(56, 189, 248, 0.15)' : '#f0f9ff') : 'transparent',
                      transition: 'background 0.15s'
                    }}
                  >
                    {exp}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ATM Strike Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 8px',
              borderRadius: '6px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`
            }}
          >
            <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>ATM:</span>
            <span style={{ fontWeight: '800', color: '#f59e0b', fontSize: '13px', fontFamily: 'monospace' }}>
              {atmStrike}
            </span>

            <button
              title="Decrease Strike -50"
              onClick={() => setManualAtmStrike(atmStrike - 50)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Minus size={12} />
            </button>

            <button
              title="Increase Strike +50"
              onClick={() => setManualAtmStrike(atmStrike + 50)}
              style={{
                background: 'transparent',
                border: 'none',
                color: isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                padding: '2px 4px',
                borderRadius: '3px',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Plus size={12} />
            </button>

            {manualAtmStrike !== null && (
              <button
                title="Reset to Auto Spot ATM"
                onClick={() => setManualAtmStrike(null)}
                style={{
                  background: '#38bdf822',
                  border: '1px solid #38bdf855',
                  color: '#38bdf8',
                  cursor: 'pointer',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  fontSize: '9.5px',
                  fontWeight: '800'
                }}
              >
                Auto
              </button>
            )}
          </div>

          {/* Timeframe Selector */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
              borderRadius: '6px',
              padding: '2px',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`
            }}
          >
            {['1', '3', '5', '15', '30', 'D'].map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                style={{
                  border: 'none',
                  backgroundColor: timeframe === tf ? '#0284c7' : 'transparent',
                  color: timeframe === tf ? '#ffffff' : isDark ? '#94a3b8' : '#64748b',
                  fontSize: '11px',
                  fontWeight: '800',
                  padding: '3px 7px',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  transition: 'all 0.15s'
                }}
              >
                {tf === 'D' ? 'D' : `${tf}m`}
              </button>
            ))}
          </div>
        </div>

        {/* Right Toolbar Items: Select OTM Options, Fullscreen / Fit */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          {/* Select OTM Options Button & Dropdown */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsOtmDropdownOpen(!isOtmDropdownOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                borderRadius: '6px',
                backgroundColor: selectedOtms.length > 0 ? (isDark ? '#0284c7' : '#0284c7') : isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
                border: `1px solid ${selectedOtms.length > 0 ? '#38bdf8' : isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
                color: selectedOtms.length > 0 ? '#ffffff' : isDark ? '#f8fafc' : '#334155',
                cursor: 'pointer',
                fontWeight: '700',
                fontSize: '12px'
              }}
            >
              <Sliders size={13} />
              <span>Select OTM Options</span>
              {selectedOtms.length > 0 && (
                <span
                  style={{
                    backgroundColor: '#ffffff33',
                    padding: '1px 5px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '800'
                  }}
                >
                  {selectedOtms.length}/3
                </span>
              )}
              <ChevronDown size={13} />
            </button>

            {/* OTM Options Selection Modal / Dropdown */}
            {isOtmDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  backgroundColor: isDark ? '#1e293b' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.15)' : '#cbd5e1'}`,
                  borderRadius: '8px',
                  boxShadow: '0 12px 30px -4px rgba(0, 0, 0, 0.5)',
                  zIndex: 100,
                  width: '280px',
                  padding: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#e2e8f0'}`, paddingBottom: '6px' }}>
                  <span style={{ fontSize: '12px', fontWeight: '800', color: isDark ? '#f8fafc' : '#0f172a' }}>
                    Select up to 3 OTM Contracts
                  </span>
                  {selectedOtms.length > 0 && (
                    <button
                      onClick={() => setSelectedOtms([])}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '11px',
                        cursor: 'pointer',
                        fontWeight: '700'
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* CALL OTM Section */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', marginBottom: '6px' }}>
                    CALL OTM (Above ATM)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {otmOptionsList.filter((o) => o.type === 'CE').map((opt) => {
                      const isSelected = selectedOtms.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => toggleOtmSelection(opt.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? (isDark ? 'rgba(16, 185, 129, 0.18)' : '#ecfdf5') : isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                            border: `1px solid ${isSelected ? '#10b981' : 'transparent'}`,
                            fontSize: '11.5px',
                            fontWeight: isSelected ? '800' : '600'
                          }}
                        >
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              border: `1px solid ${isSelected ? '#10b981' : '#64748b'}`,
                              backgroundColor: isSelected ? '#10b981' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {isSelected && <Check size={11} color="#ffffff" />}
                          </div>
                          <span>{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* PUT OTM Section */}
                <div>
                  <div style={{ fontSize: '11px', fontWeight: '800', color: '#ef4444', marginBottom: '6px' }}>
                    PUT OTM (Below ATM)
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {otmOptionsList.filter((o) => o.type === 'PE').map((opt) => {
                      const isSelected = selectedOtms.includes(opt.id);
                      return (
                        <div
                          key={opt.id}
                          onClick={() => toggleOtmSelection(opt.id)}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            padding: '6px 8px',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            backgroundColor: isSelected ? (isDark ? 'rgba(239, 68, 68, 0.18)' : '#fef2f2') : isDark ? 'rgba(255, 255, 255, 0.04)' : '#f8fafc',
                            border: `1px solid ${isSelected ? '#ef4444' : 'transparent'}`,
                            fontSize: '11.5px',
                            fontWeight: isSelected ? '800' : '600'
                          }}
                        >
                          <div
                            style={{
                              width: '14px',
                              height: '14px',
                              borderRadius: '3px',
                              border: `1px solid ${isSelected ? '#ef4444' : '#64748b'}`,
                              backgroundColor: isSelected ? '#ef4444' : 'transparent',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          >
                            {isSelected && <Check size={11} color="#ffffff" />}
                          </div>
                          <span>{opt.label}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <button
                  onClick={() => setIsOtmDropdownOpen(false)}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '5px',
                    fontSize: '11.5px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    marginTop: '4px'
                  }}
                >
                  Done
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2-COLUMN MAIN WORKSTATION: NIFTY SPOT (50%) LEFT | OPTIONS STACK (50%) RIGHT */}
      <div
        style={{
          display: 'flex',
          flex: 1,
          width: '100%',
          minHeight: 0,
          overflow: 'hidden'
        }}
      >
        {/* LEFT COLUMN (50% WIDTH): NIFTY SPOT FULL HEIGHT CHART */}
        <div
          style={{
            width: '50%',
            minWidth: '50%',
            maxWidth: '50%',
            height: '100%',
            borderRight: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
            display: 'flex',
            flexDirection: 'column',
            position: 'relative',
            overflow: 'hidden'
          }}
        >
          <NiftySpotChartPane
            candles={niftyCandles}
            timeframe={timeframe}
            isDark={isDark}
            onRegisterChart={(chart) => chartInstancesRef.current.set('nifty', chart)}
            onRangeChange={(range) => handleLogicalRangeChange('nifty', range)}
            hoveredTime={hoveredTime}
            onHoverTimeChange={(t, c) => {
              setHoveredTime(t);
              setHoveredNifty(c);
            }}
          />
        </div>

        {/* RIGHT COLUMN (50% WIDTH): STACK OF OPTIONS CHARTS */}
        <div
          style={{
            width: '50%',
            minWidth: '50%',
            maxWidth: '50%',
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            overflowY: activeContracts.length > 3 ? 'auto' : 'hidden'
          }}
        >
          {activeContracts.map((contract, index) => {
            const candles = optionCandlesMap[contract.id] || [];
            return (
              <div
                key={contract.id}
                style={{
                  flex: 1,
                  minHeight: activeContracts.length > 3 ? '220px' : '0',
                  borderBottom:
                    index < activeContracts.length - 1
                      ? `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`
                      : 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                <OptionChartPane
                  contract={contract}
                  candles={candles}
                  timeframe={timeframe}
                  isDark={isDark}
                  onRegisterChart={(chart) => chartInstancesRef.current.set(contract.id, chart)}
                  onRangeChange={(range) => handleLogicalRangeChange(contract.id, range)}
                  hoveredTime={hoveredTime}
                  onHoverTimeChange={(t, c) => {
                    setHoveredTime(t);
                    setHoveredOptions((prev) => ({ ...prev, [contract.id]: c }));
                  }}
                />
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// =========================================================================================
// SUB-COMPONENT 1: NIFTY SPOT CHART PANE (WITH SMART MONEY CONCEPTS, ZONES, SWINGS, BOS/CHoCH)
// =========================================================================================
interface NiftySpotChartPaneProps {
  candles: Candle[];
  timeframe: string;
  isDark: boolean;
  onRegisterChart: (chart: IChartApi) => void;
  onRangeChange: (range: LogicalRange | null) => void;
  hoveredTime: number | null;
  onHoverTimeChange: (time: number | null, candle: Candle | null) => void;
}

const NiftySpotChartPane: React.FC<NiftySpotChartPaneProps> = ({
  candles,
  timeframe,
  isDark,
  onRegisterChart,
  onRangeChange,
  hoveredTime,
  onHoverTimeChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [activeCandle, setActiveCandle] = useState<Candle | null>(null);
  const [svgOverlays, setSvgOverlays] = useState<{
    width: number;
    height: number;
    swings: Array<{ x: number; y: number; label: string; type: 'HIGH' | 'LOW'; isProminent?: boolean }>;
    structureLines: Array<{ id: string; x1: number; y1: number; x2: number; y2: number; type: 'BOS' | 'CHoCH' }>;
    zones: Array<{ id: string; y1: number; y2: number; label: string; subLabel?: string; color: string; borderColor: string }>;
    eqY: number | null;
  }>({ width: 0, height: 0, swings: [], structureLines: [], zones: [], eqY: null });

  // Calculate SMC structures
  const swings = useMemo(() => detectSwings(candles, 2), [candles]);
  const structureLines = useMemo(() => detectBOSandCHoCH(candles, swings), [candles, swings]);
  const zones = useMemo(() => detectSupplyDemandZones(candles, swings), [candles, swings]);
  const dealingRange = useMemo(() => calculateDealingRange(candles), [candles]);

  // Initialize TradingView Lightweight Chart
  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 600,
      height: containerRef.current.clientHeight || 500,
      layout: {
        background: { color: isDark ? '#0b0e14' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontSize: 11,
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#38bdf888', width: 1, style: 3 },
        horzLine: { color: '#38bdf888', width: 1, style: 3 }
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
        autoScale: true,
        scaleMargins: { top: 0.08, bottom: 0.15 }
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false
      }
    });

    chartRef.current = chart;
    onRegisterChart(chart);

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: true,
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645'
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'vol-scale'
    });
    chart.priceScale('vol-scale').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false
    });
    volumeSeriesRef.current = volumeSeries;

    // Crosshair listener for synchronized inspection
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !candleSeriesRef.current) {
        onHoverTimeChange(null, null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current) as any;
      if (data && typeof data.close === 'number') {
        const rawTime = (param.time as number) - IST_OFFSET_SECONDS;
        onHoverTimeChange(rawTime, {
          time: rawTime,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: 0
        });
      }
    });

    // Time scale listener for synchronized zoom/pan
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      onRangeChange(range);
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          chartRef.current.applyOptions({ width: w, height: h });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isDark]);

  // Update NIFTY candles and volume data
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const chartCandles = candles.map((c) => ({
      time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    const chartVolumes = candles.map((c) => ({
      time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
      value: c.volume || 1000,
      color: c.close >= c.open ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)'
    }));

    candleSeriesRef.current.setData(chartCandles);
    volumeSeriesRef.current.setData(chartVolumes);

    if (candles.length > 0) {
      setActiveCandle(candles[candles.length - 1]);
    }
  }, [candles]);

  // Recalculate SVG overlay coordinates (swings, BOS/CHoCH lines, supply/demand zones)
  const updateOverlays = useCallback(() => {
    if (!chartRef.current || !candleSeriesRef.current || !containerRef.current) return;

    try {
      const paneHeight = chartRef.current.paneSize().height;
      const width = containerRef.current.clientWidth;

      // 1. Swings coordinates
      const mappedSwings: any[] = [];
      swings.forEach((s) => {
        const x = chartRef.current!.timeScale().timeToCoordinate(((s.time + IST_OFFSET_SECONDS) as unknown) as Time);
        const y = candleSeriesRef.current!.priceToCoordinate(s.price);
        if (x !== null && y !== null && y >= 0 && y <= paneHeight) {
          mappedSwings.push({
            x,
            y,
            label: s.label,
            type: s.type,
            isProminent: s.isProminent
          });
        }
      });

      // 2. Structure lines (BOS, CHoCH)
      const mappedStructure: any[] = [];
      structureLines.forEach((line) => {
        const x1 = chartRef.current!.timeScale().timeToCoordinate(((line.startTime + IST_OFFSET_SECONDS) as unknown) as Time);
        const x2 = chartRef.current!.timeScale().timeToCoordinate(((line.endTime + IST_OFFSET_SECONDS) as unknown) as Time);
        const y = candleSeriesRef.current!.priceToCoordinate(line.price);
        if (x1 !== null && x2 !== null && y !== null && y >= 0 && y <= paneHeight) {
          mappedStructure.push({
            id: line.id,
            x1,
            x2: Math.max(x1 + 30, x2),
            y1: y,
            y2: y,
            type: line.type
          });
        }
      });

      // 3. Zones (Supply, Demand, Institutional, D-RPZ)
      const mappedZones: any[] = [];
      zones.forEach((z) => {
        const y1 = candleSeriesRef.current!.priceToCoordinate(z.high);
        const y2 = candleSeriesRef.current!.priceToCoordinate(z.low);
        if (y1 !== null && y2 !== null) {
          mappedZones.push({
            id: z.id,
            y1: Math.min(y1, y2),
            y2: Math.max(y1, y2),
            label: z.label,
            subLabel: z.subLabel,
            color: z.color,
            borderColor: z.borderColor
          });
        }
      });

      // 4. Equilibrium (EQ)
      let eqY = null;
      if (dealingRange.eq > 0) {
        eqY = candleSeriesRef.current!.priceToCoordinate(dealingRange.eq);
      }

      setSvgOverlays({
        width,
        height: paneHeight,
        swings: mappedSwings,
        structureLines: mappedStructure,
        zones: mappedZones,
        eqY
      });
    } catch (e) {}
  }, [swings, structureLines, zones, dealingRange]);

  // Hook into chart time scale visible range changes to update overlay
  useEffect(() => {
    if (!chartRef.current) return;
    const unsub = chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(updateOverlays);
    });
    return () => {
      try {
        chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(unsub);
      } catch (e) {}
    };
  }, [updateOverlays]);

  useEffect(() => {
    requestAnimationFrame(updateOverlays);
  }, [candles, updateOverlays]);

  // Display candle (hovered candle if user is inspecting, otherwise latest candle)
  const displayCandle = useMemo(() => {
    if (hoveredTime && candles.length > 0) {
      const found = candles.find((c) => c.time === hoveredTime);
      if (found) return found;
    }
    return activeCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
  }, [hoveredTime, candles, activeCandle]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* HEADER LEGEND */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '12px',
          zIndex: 20,
          pointerEvents: 'none',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: '800' }}>
          <span style={{ color: isDark ? '#ffffff' : '#0f172a' }}>Nifty 50 Index</span>
          <span style={{ color: '#94a3b8', fontSize: '11px', fontWeight: '700' }}>• {timeframe} • NSE</span>
        </div>

        {displayCandle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', fontWeight: '700' }}>
            <span style={{ color: '#94a3b8' }}>O <b style={{ color: '#0284c7' }}>{displayCandle.open.toFixed(2)}</b></span>
            <span style={{ color: '#94a3b8' }}>H <b style={{ color: '#10b981' }}>{displayCandle.high.toFixed(2)}</b></span>
            <span style={{ color: '#94a3b8' }}>L <b style={{ color: '#ef4444' }}>{displayCandle.low.toFixed(2)}</b></span>
            <span style={{ color: '#94a3b8' }}>C <b style={{ color: displayCandle.close >= displayCandle.open ? '#10b981' : '#ef4444' }}>{displayCandle.close.toFixed(2)}</b></span>
          </div>
        )}
      </div>


      {/* CHART CANVAS HOLDER */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* SVG OVERLAY: SMC SWINGS, BOS, CHoCH, SUPPLY / DEMAND ZONES */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 15
        }}
      >
        {/* Supply / Demand / Institutional Zones */}
        {svgOverlays.zones.map((zone) => {
          const zoneHeight = Math.max(8, zone.y2 - zone.y1);
          return (
            <g key={zone.id}>
              <rect
                x={0}
                y={zone.y1}
                width={svgOverlays.width - 65}
                height={zoneHeight}
                fill={zone.color}
                stroke={zone.borderColor}
                strokeWidth={1}
                strokeDasharray={zone.id === 'd-rpz-zone' ? '3,3' : 'none'}
              />
              <text
                x={svgOverlays.width * 0.42}
                y={zone.y1 + zoneHeight / 2 + 4}
                fill={zone.id === 'inst-buy-zone' ? '#10b981' : zone.id === 'd-rpz-zone' ? '#38bdf8' : '#f87171'}
                fontSize="10"
                fontWeight="800"
                textAnchor="middle"
              >
                {zone.label} {zone.subLabel ? `  ${zone.subLabel}` : ''}
              </text>
            </g>
          );
        })}

        {/* Equilibrium (EQ) Line */}
        {svgOverlays.eqY !== null && svgOverlays.eqY >= 0 && svgOverlays.eqY <= svgOverlays.height && (
          <g>
            <line
              x1={0}
              y1={svgOverlays.eqY}
              x2={svgOverlays.width - 65}
              y2={svgOverlays.eqY}
              stroke="#eab308"
              strokeWidth={1.5}
            />
            <rect
              x={svgOverlays.width - 110}
              y={svgOverlays.eqY - 8}
              width={38}
              height={16}
              rx={3}
              fill="#eab308"
            />
            <text
              x={svgOverlays.width - 91}
              y={svgOverlays.eqY + 3.5}
              fill="#000000"
              fontSize="9.5"
              fontWeight="900"
              textAnchor="middle"
            >
              EQ
            </text>
          </g>
        )}

        {/* Structure Lines (BOS, CHoCH) */}
        {svgOverlays.structureLines.map((line) => (
          <g key={line.id}>
            <line
              x1={line.x1}
              y1={line.y1}
              x2={line.x2}
              y2={line.y2}
              stroke={line.type === 'CHoCH' ? '#00f0ff' : '#64748b'}
              strokeWidth={1.2}
              strokeDasharray="4,3"
            />
            <text
              x={(line.x1 + line.x2) / 2}
              y={line.y1 - 3}
              fill={line.type === 'CHoCH' ? '#00f0ff' : '#94a3b8'}
              fontSize="9"
              fontWeight="800"
              textAnchor="middle"
            >
              {line.type}
            </text>
          </g>
        ))}

        {/* Swings (HH, LH, HL, LL) & Highlight Circles */}
        {svgOverlays.swings.map((swing, idx) => (
          <g key={`swing-${idx}`}>
            {/* Blue Highlight Circle around prominent swing turning points (matching reference screenshot) */}
            {swing.isProminent && (
              <circle
                cx={swing.x}
                cy={swing.y}
                r={12}
                fill="rgba(56, 189, 248, 0.15)"
                stroke="#38bdf8"
                strokeWidth={1.5}
                strokeDasharray="3,2"
              />
            )}
            <text
              x={swing.x}
              y={swing.type === 'HIGH' ? swing.y - 8 : swing.y + 14}
              fill={swing.label.startsWith('H') ? '#34d399' : '#f87171'}
              fontSize="9"
              fontWeight="800"
              textAnchor="middle"
            >
              {swing.label}
            </text>
          </g>
        ))}
      </svg>

      {/* BOTTOM-LEFT INSTITUTIONAL MATRIX BADGE (EXACT RECREATION FROM REFERENCE SCREENSHOT) */}
      <div
        style={{
          position: 'absolute',
          bottom: '16px',
          left: '12px',
          zIndex: 25,
          backgroundColor: '#0f172aee',
          border: '1px solid rgba(255, 255, 255, 0.15)',
          borderRadius: '6px',
          padding: '6px 10px',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 8px 20px rgba(0, 0, 0, 0.6)',
          fontSize: '10px',
          minWidth: '180px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '3px' }}>
          <span style={{ color: '#f59e0b', fontWeight: '900' }}>★ NORMAL DAY</span>
          <span style={{ color: '#38bdf8', fontWeight: '700' }}>Be Selective</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>D: <b style={{ color: '#ef4444' }}>🔴 -ve</b></span>
          <span>M30: <b style={{ color: '#ef4444' }}>🔴 -ve</b></span>
          <span>M5: <b style={{ color: '#ef4444' }}>🔴 -ve</b></span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>IB: <b style={{ color: '#f8fafc' }}>107.90</b></span>
          <span>09:15 - 09:45</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#94a3b8' }}>
          <span>IB Type: <b style={{ color: '#f59e0b' }}>Moderate ★★</b></span>
          <span>CPR: <b style={{ color: '#38bdf8' }}>Wide ★</b></span>
        </div>
      </div>
    </div>
  );
};

// =========================================================================================
// SUB-COMPONENT 2: OPTION CHART PANE (ATM CALL, ATM PUT, OTM WITH STEP LEVELS & BADGES)
// =========================================================================================
interface OptionChartPaneProps {
  contract: ContractInfo;
  candles: Candle[];
  timeframe: string;
  isDark: boolean;
  onRegisterChart: (chart: IChartApi) => void;
  onRangeChange: (range: LogicalRange | null) => void;
  hoveredTime: number | null;
  onHoverTimeChange: (time: number | null, candle: Candle | null) => void;
}

const OptionChartPane: React.FC<OptionChartPaneProps> = ({
  contract,
  candles,
  timeframe,
  isDark,
  onRegisterChart,
  onRangeChange,
  hoveredTime,
  onHoverTimeChange
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<'Candlestick'> | null>(null);
  const volumeSeriesRef = useRef<ISeriesApi<'Histogram'> | null>(null);

  const [activeCandle, setActiveCandle] = useState<Candle | null>(null);
  const [svgLines, setSvgLines] = useState<{
    width: number;
    height: number;
    premiumY: number | null;
    eqY: number | null;
    discountY: number | null;
    supportY: number | null;
    baseSupportY: number | null;
    swings: Array<{ x: number; y: number; isProminent?: boolean }>;
  }>({
    width: 0,
    height: 0,
    premiumY: null,
    eqY: null,
    discountY: null,
    supportY: null,
    baseSupportY: null,
    swings: []
  });

  const optionLevels = useMemo<OptionLevels>(() => {
    return calculateOptionLevels(candles, contract.type, contract.strike);
  }, [candles, contract.type, contract.strike]);

  const swings = useMemo(() => detectSwings(candles, 2), [candles]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      width: containerRef.current.clientWidth || 500,
      height: containerRef.current.clientHeight || 250,
      layout: {
        background: { color: isDark ? '#0b0e14' : '#ffffff' },
        textColor: isDark ? '#94a3b8' : '#475569',
        fontSize: 10,
        fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
      },
      grid: {
        vertLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9' },
        horzLines: { color: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9' }
      },
      crosshair: {
        mode: 1,
        vertLine: { color: '#38bdf888', width: 1, style: 3 },
        horzLine: { color: '#38bdf888', width: 1, style: 3 }
      },
      rightPriceScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
        autoScale: true,
        scaleMargins: { top: 0.12, bottom: 0.18 }
      },
      timeScale: {
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1',
        timeVisible: true,
        secondsVisible: false
      }
    });

    chartRef.current = chart;
    onRegisterChart(chart);

    const candleSeries = chart.addCandlestickSeries({
      upColor: '#089981',
      downColor: '#f23645',
      borderVisible: true,
      borderUpColor: '#089981',
      borderDownColor: '#f23645',
      wickUpColor: '#089981',
      wickDownColor: '#f23645'
    });
    candleSeriesRef.current = candleSeries;

    const volumeSeries = chart.addHistogramSeries({
      priceFormat: { type: 'volume' },
      priceScaleId: 'opt-vol'
    });
    chart.priceScale('opt-vol').applyOptions({
      scaleMargins: { top: 0.8, bottom: 0 },
      visible: false
    });
    volumeSeriesRef.current = volumeSeries;

    // Crosshair inspection listener
    chart.subscribeCrosshairMove((param) => {
      if (!param.time || !param.seriesData || !candleSeriesRef.current) {
        onHoverTimeChange(null, null);
        return;
      }
      const data = param.seriesData.get(candleSeriesRef.current) as any;
      if (data && typeof data.close === 'number') {
        const rawTime = (param.time as number) - IST_OFFSET_SECONDS;
        onHoverTimeChange(rawTime, {
          time: rawTime,
          open: data.open,
          high: data.high,
          low: data.low,
          close: data.close,
          volume: 0
        });
      }
    });

    // Time scale listener
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      onRangeChange(range);
    });

    const handleResize = () => {
      if (containerRef.current && chartRef.current) {
        const w = containerRef.current.clientWidth;
        const h = containerRef.current.clientHeight;
        if (w > 0 && h > 0) {
          chartRef.current.applyOptions({ width: w, height: h });
        }
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
    };
  }, [isDark]);

  // Update option candles
  useEffect(() => {
    if (!candleSeriesRef.current || !volumeSeriesRef.current || candles.length === 0) return;

    const chartCandles = candles.map((c) => ({
      time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
      open: c.open,
      high: c.high,
      low: c.low,
      close: c.close
    }));

    const chartVolumes = candles.map((c) => ({
      time: ((c.time as number) + IST_OFFSET_SECONDS) as Time,
      value: c.volume || 1000,
      color: c.close >= c.open ? 'rgba(8, 153, 129, 0.35)' : 'rgba(242, 54, 69, 0.35)'
    }));

    candleSeriesRef.current.setData(chartCandles);
    volumeSeriesRef.current.setData(chartVolumes);

    if (candles.length > 0) {
      setActiveCandle(candles[candles.length - 1]);
    }
  }, [candles]);

  // Update Step lines & badges (Premium, EQ, Discount, Support)
  const updateOptionOverlay = useCallback(() => {
    if (!chartRef.current || !candleSeriesRef.current || !containerRef.current) return;

    try {
      const paneHeight = chartRef.current.paneSize().height;
      const width = containerRef.current.clientWidth;

      const premiumY = candleSeriesRef.current.priceToCoordinate(optionLevels.premium);
      const eqY = candleSeriesRef.current.priceToCoordinate(optionLevels.eq);
      const discountY = candleSeriesRef.current.priceToCoordinate(optionLevels.discount);
      const supportY = candleSeriesRef.current.priceToCoordinate(optionLevels.support);
      const baseSupportY = candleSeriesRef.current.priceToCoordinate(optionLevels.baseSupport);

      const mappedSwings: any[] = [];
      swings.forEach((s) => {
        const x = chartRef.current!.timeScale().timeToCoordinate(((s.time + IST_OFFSET_SECONDS) as unknown) as Time);
        const y = candleSeriesRef.current!.priceToCoordinate(s.price);
        if (x !== null && y !== null && y >= 0 && y <= paneHeight) {
          mappedSwings.push({ x, y, isProminent: s.isProminent });
        }
      });

      setSvgLines({
        width,
        height: paneHeight,
        premiumY,
        eqY,
        discountY,
        supportY,
        baseSupportY,
        swings: mappedSwings
      });
    } catch (e) {}
  }, [optionLevels, swings]);

  useEffect(() => {
    if (!chartRef.current) return;
    const unsub = chartRef.current.timeScale().subscribeVisibleLogicalRangeChange(() => {
      requestAnimationFrame(updateOptionOverlay);
    });
    return () => {
      try {
        chartRef.current?.timeScale().unsubscribeVisibleLogicalRangeChange(unsub);
      } catch (e) {}
    };
  }, [updateOptionOverlay]);

  useEffect(() => {
    requestAnimationFrame(updateOptionOverlay);
  }, [candles, updateOptionOverlay]);

  const displayCandle = useMemo(() => {
    if (hoveredTime && candles.length > 0) {
      const found = candles.find((c) => c.time === hoveredTime);
      if (found) return found;
    }
    return activeCandle || (candles.length > 0 ? candles[candles.length - 1] : null);
  }, [hoveredTime, candles, activeCandle]);

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      {/* OPTION HEADER LEGEND */}
      <div
        style={{
          position: 'absolute',
          top: '6px',
          left: '10px',
          zIndex: 20,
          pointerEvents: 'none',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '11px',
          fontWeight: '700'
        }}
      >
        <span style={{ color: contract.type === 'CE' ? '#10b981' : '#ef4444', fontWeight: '900' }}>
          {contract.displayName}
        </span>
        <span style={{ color: '#94a3b8', fontSize: '10px' }}>• {timeframe} • NSE</span>

        {displayCandle && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', marginLeft: '6px' }}>
            <span style={{ color: '#94a3b8' }}>O <b>{displayCandle.open.toFixed(2)}</b></span>
            <span style={{ color: '#94a3b8' }}>H <b>{displayCandle.high.toFixed(2)}</b></span>
            <span style={{ color: '#94a3b8' }}>L <b>{displayCandle.low.toFixed(2)}</b></span>
            <span style={{ color: displayCandle.close >= displayCandle.open ? '#10b981' : '#ef4444' }}>
              C <b>{displayCandle.close.toFixed(2)}</b>
            </span>
            <span
              style={{
                marginLeft: '4px',
                padding: '1px 4px',
                borderRadius: '3px',
                fontSize: '9px',
                fontWeight: '800',
                backgroundColor: optionLevels.changePct >= 0 ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                color: optionLevels.changePct >= 0 ? '#10b981' : '#ef4444'
              }}
            >
              {optionLevels.changePct >= 0 ? `+${optionLevels.changePct}%` : `${optionLevels.changePct}%`}
            </span>
          </div>
        )}
      </div>

      {/* TOP RIGHT "INR" BADGE MATCHING REFERENCE SCREENSHOT */}
      <div
        style={{
          position: 'absolute',
          top: '6px',
          right: '58px',
          zIndex: 20,
          pointerEvents: 'none',
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#f1f5f9',
          color: '#94a3b8',
          fontSize: '9px',
          fontWeight: '800',
          padding: '1px 4px',
          borderRadius: '3px'
        }}
      >
        INR
      </div>

      {/* CHART CANVAS */}
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

      {/* SVG STEP LEVELS & PILL BADGES (PREMIUM, EQ, DISCOUNT) MATCHING REFERENCE SCREENSHOT */}
      <svg
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          pointerEvents: 'none',
          zIndex: 15
        }}
      >
        {/* PREMIUM LEVEL LINE & PILL BADGE */}
        {svgLines.premiumY !== null && svgLines.premiumY >= 0 && svgLines.premiumY <= svgLines.height && (
          <g>
            <line
              x1={0}
              y1={svgLines.premiumY}
              x2={svgLines.width - 55}
              y2={svgLines.premiumY}
              stroke="#0284c7"
              strokeWidth={1.5}
            />
            <rect
              x={svgLines.width - 110}
              y={svgLines.premiumY - 8}
              width={52}
              height={16}
              rx={3}
              fill="#0284c7"
            />
            <text
              x={svgLines.width - 84}
              y={svgLines.premiumY + 3.5}
              fill="#ffffff"
              fontSize="9"
              fontWeight="900"
              textAnchor="middle"
            >
              {contract.type === 'PE' ? 'Premium 1' : 'Premium'}
            </text>
          </g>
        )}

        {/* EQ LEVEL LINE & PILL BADGE */}
        {svgLines.eqY !== null && svgLines.eqY >= 0 && svgLines.eqY <= svgLines.height && (
          <g>
            <line
              x1={0}
              y1={svgLines.eqY}
              x2={svgLines.width - 55}
              y2={svgLines.eqY}
              stroke="#eab308"
              strokeWidth={1.5}
            />
            <rect
              x={svgLines.width - 95}
              y={svgLines.eqY - 8}
              width={38}
              height={16}
              rx={3}
              fill="#eab308"
            />
            <text
              x={svgLines.width - 76}
              y={svgLines.eqY + 3.5}
              fill="#000000"
              fontSize="9"
              fontWeight="900"
              textAnchor="middle"
            >
              EQ
            </text>
          </g>
        )}

        {/* DISCOUNT LEVEL LINE & PILL BADGE */}
        {svgLines.discountY !== null && svgLines.discountY >= 0 && svgLines.discountY <= svgLines.height && (
          <g>
            <line
              x1={0}
              y1={svgLines.discountY}
              x2={svgLines.width - 55}
              y2={svgLines.discountY}
              stroke="#0284c7"
              strokeWidth={1.5}
            />
            <rect
              x={svgLines.width - 112}
              y={svgLines.discountY - 8}
              width={54}
              height={16}
              rx={3}
              fill="#0284c7"
            />
            <text
              x={svgLines.width - 85}
              y={svgLines.discountY + 3.5}
              fill="#ffffff"
              fontSize="9"
              fontWeight="900"
              textAnchor="middle"
            >
              {contract.type === 'PE' ? 'Discount 1' : 'Discount'}
            </text>
          </g>
        )}

        {/* BASE SUPPORT RED LINE */}
        {svgLines.baseSupportY !== null && svgLines.baseSupportY >= 0 && svgLines.baseSupportY <= svgLines.height && (
          <line
            x1={0}
            y1={svgLines.baseSupportY}
            x2={svgLines.width - 55}
            y2={svgLines.baseSupportY}
            stroke="#ef4444"
            strokeWidth={1.5}
          />
        )}

        {/* SWING CIRCLE HIGHLIGHTS MATCHING REFERENCE SCREENSHOT */}
        {svgLines.swings.map((swing, idx) => (
          <g key={`opt-swing-${idx}`}>
            {swing.isProminent && (
              <circle
                cx={swing.x}
                cy={swing.y}
                r={11}
                fill="rgba(56, 189, 248, 0.15)"
                stroke="#38bdf8"
                strokeWidth={1.5}
                strokeDasharray="3,2"
              />
            )}
          </g>
        ))}
      </svg>
    </div>
  );
};
