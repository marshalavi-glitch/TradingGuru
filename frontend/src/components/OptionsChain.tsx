import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  LineChart, 
  BarChart2, 
  Info, 
  ChevronDown, 
  Eye, 
  HelpCircle, 
  X, 
  Loader2, 
  ArrowDown
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { useTheme } from '../context/ThemeContext';

interface OptionsChainProps {
  currentSymbol: string;
  onSymbolChange: (symbol: string) => void;
  onSwitchToChart: () => void;
  onSwitchToMarketProfile?: () => void;
}

interface ExpiryItem {
  code: string;
  label: string;
}

interface OptionMetric {
  symbol: string;
  ltp: number | null;
  oiLakh: number;
  delta: number;
  theta: number;
  vega: number;
  gamma: number;
}

interface OptionItem {
  strike: number;
  CE: OptionMetric;
  PE: OptionMetric;
}

interface OptionChainResponse {
  symbol: string;
  cleanSymbol: string;
  underlyingPrice: number;
  change?: number;
  changePct?: number;
  futPrice?: number | null;
  ivp?: string | number;
  lotSize?: number;
  expiries: ExpiryItem[];
  selectedExpiry: string;
  maxOi: number;
  data: OptionItem[];
}

interface SearchResult {
  value: string;
  label: string;
  type: string;
  exchange: string;
}

export function OptionsChain({ currentSymbol, onSymbolChange, onSwitchToChart, onSwitchToMarketProfile }: OptionsChainProps) {
  const { isDark } = useTheme();
  const [expiry, setExpiry] = useState<string>('');
  const [data, setData] = useState<OptionChainResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [perLot, setPerLot] = useState<boolean>(false);
  const [showInfoModal, setShowInfoModal] = useState<boolean>(false);

  // Search states
  const [searchOpen, setSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [loadingSearch, setLoadingSearch] = useState<boolean>(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Greek tooltip hover state
  const [activeTooltip, setActiveTooltip] = useState<string | null>(null);

  // Extract clean symbol name
  const underlyingSymbol = (() => {
    let clean = currentSymbol;
    if (currentSymbol.includes(':')) {
      clean = currentSymbol.split(':')[1];
    }
    const match = clean.match(/^([A-Z]+)\d+/);
    if (match) {
      return `NSE:${match[1]}`;
    }
    return currentSymbol;
  })();

  const cleanDisplaySymbol = underlyingSymbol.replace('NSE:', '').toUpperCase();

  // Load Option Chain data
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    const loadChain = async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const fetchUrl = `${backendUrl}/api/options/chain?symbol=${underlyingSymbol}${expiry ? `&expiry=${expiry}` : ''}`;
        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error('Failed to load options chain data');
        const payload: OptionChainResponse = await res.json();
        if (active) {
          setData(payload);
          if (!expiry || !payload.expiries.some(e => e.code === expiry)) {
            setExpiry(payload.selectedExpiry);
          }
          setLoading(false);
        }
      } catch (err: any) {
        if (active) {
          setError(err.message || 'An error occurred');
          setLoading(false);
        }
      }
    };

    loadChain();

    // Auto-refresh options chain periodically
    const timer = setInterval(() => {
      loadChain();
    }, 3000);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [underlyingSymbol, expiry]);

  // Debounced search query lookup
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }

    setLoadingSearch(true);
    const delayDebounce = setTimeout(async () => {
      try {
        const backendUrl = await getBackendHttpUrl();
        const res = await fetch(`${backendUrl}/api/search?query=${encodeURIComponent(searchQuery)}`);
        if (res.ok) {
          const results: SearchResult[] = await res.json();
          setSearchResults(results.slice(0, 8));
        }
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoadingSearch(false);
      }
    }, 200);

    return () => clearTimeout(delayDebounce);
  }, [searchQuery]);

  // Close search dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setSearchOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectUnderlying = (symbolCode: string) => {
    onSymbolChange(symbolCode);
    setSearchQuery('');
    setSearchOpen(false);
    setExpiry('');
  };

  const handleOptionClick = (optionSymbol: string, targetTab: 'chart' | 'profile' = 'chart') => {
    onSymbolChange(optionSymbol);
    if (targetTab === 'profile' && onSwitchToMarketProfile) {
      onSwitchToMarketProfile();
    } else {
      onSwitchToChart();
    }
  };

  const spot = data?.underlyingPrice ?? 22716.20;
  const changePct = data?.changePct ?? 0;
  const isPos = changePct >= 0;
  const futPrice = data?.futPrice ?? (spot ? spot + 18.5 : null);
  const ivp = data?.ivp ?? '--';
  const lotSize = data?.lotSize ?? (cleanDisplaySymbol.includes('BANK') ? 30 : 75);
  const maxOi = data?.maxOi && data.maxOi > 0 ? data.maxOi : 50;

  // Find closest strike for ATM marker
  const atmStrike = data?.data && data.data.length > 0
    ? data.data.reduce((prev, curr) => {
        return Math.abs(curr.strike - spot) < Math.abs(prev.strike - spot) ? curr : prev;
      }).strike
    : null;

  // Colors based on theme & Sensibull reference screenshot
  const themeStyles = {
    cardBg: isDark ? '#141820' : '#ffffff',
    cardBorder: isDark ? 'rgba(255, 255, 255, 0.08)' : '#e5e7eb',
    textMain: isDark ? '#f3f4f6' : '#111827',
    textMuted: isDark ? '#9ca3af' : '#6b7280',
    divider: isDark ? 'rgba(255, 255, 255, 0.1)' : '#e5e7eb',
    
    // Header banners
    callsBannerBg: isDark ? 'rgba(225, 29, 72, 0.14)' : '#fff1f2',
    callsBannerText: isDark ? '#fb7185' : '#e11d48',
    putsBannerBg: isDark ? 'rgba(16, 185, 129, 0.14)' : '#ecfdf5',
    putsBannerText: isDark ? '#34d399' : '#059669',
    
    // Table Rows: ITM (soft warm buttery yellow) vs OTM (white/slate)
    itmBg: isDark ? 'rgba(234, 179, 8, 0.09)' : '#fffdf0',
    otmBg: isDark ? '#11141c' : '#ffffff',
    strikeBg: isDark ? '#181d26' : '#f8fafc',
    strikeBorder: isDark ? 'rgba(255, 255, 255, 0.06)' : '#f1f5f9',
    rowBorder: isDark ? 'rgba(255, 255, 255, 0.04)' : '#f3f4f6',
    
    // Visual OI meters
    callOiBar: isDark ? 'rgba(239, 68, 68, 0.45)' : '#f87171',
    putOiBar: isDark ? 'rgba(16, 185, 129, 0.4)' : '#a7f3d0'
  };

  const renderGreekTooltip = (name: string, desc: string) => {
    if (activeTooltip !== name) return null;
    return (
      <div style={{
        position: 'absolute',
        top: '26px',
        left: '50%',
        transform: 'translateX(-50%)',
        background: isDark ? '#1f2937' : '#111827',
        color: '#ffffff',
        padding: '6px 10px',
        borderRadius: '6px',
        fontSize: '11px',
        fontWeight: 'normal',
        width: '180px',
        textAlign: 'center',
        boxShadow: '0 4px 12px rgba(0,0,0,0.25)',
        zIndex: 100,
        pointerEvents: 'none',
        lineHeight: '1.4'
      }}>
        {desc}
      </div>
    );
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      flex: '1',
      minHeight: '0',
      fontFamily: 'Inter, system-ui, -apple-system, sans-serif'
    }}>

      {/* TOP HEADER CONTROLS (SENSIBULL REPLICA) */}
      <div style={{
        background: themeStyles.cardBg,
        border: `1px solid ${themeStyles.cardBorder}`,
        borderRadius: '8px',
        padding: '8px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
      }}>

        {/* LEFT SECTION: Search & Underlying Spot & Action Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }} ref={searchContainerRef}>
          
          {/* Search Pill / Underlying Button */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setSearchOpen(!searchOpen)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 8px',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                color: themeStyles.textMain,
                transition: 'background 0.15s'
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            >
              <Search size={16} color={themeStyles.textMuted} />
              <span style={{ fontWeight: '700' }}>{cleanDisplaySymbol}</span>
              <span style={{ fontWeight: '600', color: themeStyles.textMain }}>
                {spot.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span style={{
                color: isPos ? '#10b981' : '#ef4444',
                fontWeight: '600',
                fontSize: '13px'
              }}>
                {isPos ? '+' : ''}{changePct.toFixed(2)}%
              </span>
            </button>

            {/* Interactive Search Dropdown */}
            {searchOpen && (
              <div style={{
                position: 'absolute',
                top: '36px',
                left: 0,
                width: '280px',
                background: themeStyles.cardBg,
                border: `1px solid ${themeStyles.cardBorder}`,
                borderRadius: '8px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
                zIndex: 200,
                padding: '8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '6px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 10px', background: isDark ? 'rgba(255,255,255,0.05)' : '#f3f4f6', borderRadius: '6px' }}>
                  <Search size={14} color={themeStyles.textMuted} />
                  <input
                    type="text"
                    placeholder="Search scrip (e.g. NIFTY, BANKNIFTY)..."
                    value={searchQuery}
                    autoFocus
                    onChange={(e) => setSearchQuery(e.target.value)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: themeStyles.textMain,
                      fontSize: '13px',
                      outline: 'none',
                      width: '100%'
                    }}
                  />
                  {searchQuery && (
                    <X size={14} color={themeStyles.textMuted} style={{ cursor: 'pointer' }} onClick={() => setSearchQuery('')} />
                  )}
                </div>

                <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                  {loadingSearch ? (
                    <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', color: themeStyles.textMuted, fontSize: '12px' }}>
                      <Loader2 className="animate-spin" size={14} /> Searching...
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '4px 0' }}>
                      <div style={{ fontSize: '11px', color: themeStyles.textMuted, padding: '4px 8px', fontWeight: '600' }}>POPULAR INDICES</div>
                      {['NSE:NIFTY', 'NSE:BANKNIFTY', 'NSE:FINNIFTY', 'BSE:SENSEX'].map((sym) => (
                        <div
                          key={sym}
                          onClick={() => handleSelectUnderlying(sym)}
                          style={{
                            padding: '8px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            fontSize: '13px',
                            fontWeight: '600',
                            color: themeStyles.textMain,
                            transition: 'background 0.15s'
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff')}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                        >
                          {sym.replace('NSE:', '').replace('BSE:', '')}
                        </div>
                      ))}
                    </div>
                  ) : (
                    searchResults.map((item) => (
                      <div
                        key={item.value}
                        onClick={() => handleSelectUnderlying(item.value)}
                        style={{
                          padding: '8px',
                          cursor: 'pointer',
                          borderRadius: '4px',
                          fontSize: '13px',
                          display: 'flex',
                          flexDirection: 'column',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = isDark ? 'rgba(59,130,246,0.15)' : '#eff6ff')}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                      >
                        <span style={{ fontWeight: '600', color: themeStyles.textMain }}>{item.value.replace('NSE:', '')}</span>
                        <span style={{ fontSize: '11px', color: themeStyles.textMuted }}>{item.label}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Chart Icon Button */}
          <button
            onClick={onSwitchToChart}
            title="Open Candlestick Chart"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              background: 'transparent',
              color: '#3b82f6',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <LineChart size={14} />
            Chart
          </button>

          {/* Market Profile Button */}
          <button
            onClick={() => onSwitchToMarketProfile ? onSwitchToMarketProfile() : onSwitchToChart()}
            title="Open Market Profile (TPO Profile)"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 8px',
              borderRadius: '6px',
              border: '1px solid #00f0ff',
              background: 'transparent',
              color: '#00f0ff',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(0, 240, 255, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <BarChart2 size={14} />
            Profile
          </button>

          {/* Info Button */}
          <button
            onClick={() => setShowInfoModal(!showInfoModal)}
            title="Contract Information"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '4px 10px',
              borderRadius: '6px',
              border: '1px solid #3b82f6',
              background: 'transparent',
              color: '#3b82f6',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background 0.15s'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.1)')}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
          >
            <Info size={13} />
            Info
          </button>
        </div>

        {/* Info Modal / Tooltip */}
        {showInfoModal && (
          <div style={{
            position: 'absolute',
            top: '70px',
            left: '20px',
            background: themeStyles.cardBg,
            border: `1px solid ${themeStyles.cardBorder}`,
            borderRadius: '8px',
            boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
            padding: '16px',
            zIndex: 300,
            width: '260px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontWeight: '700', fontSize: '13px', color: themeStyles.textMain }}>{cleanDisplaySymbol} Details</span>
              <X size={15} color={themeStyles.textMuted} style={{ cursor: 'pointer' }} onClick={() => setShowInfoModal(false)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '12px', color: themeStyles.textMuted }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Lot Size:</span>
                <span style={{ fontWeight: '600', color: themeStyles.textMain }}>{lotSize}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Underlying Spot:</span>
                <span style={{ fontWeight: '600', color: themeStyles.textMain }}>₹{spot.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Futures Price:</span>
                <span style={{ fontWeight: '600', color: themeStyles.textMain }}>₹{futPrice?.toFixed(2) || '--'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span>Exchange:</span>
                <span style={{ fontWeight: '600', color: themeStyles.textMain }}>NSE / NFO</span>
              </div>
            </div>
          </div>
        )}

        {/* RIGHT SECTION: Expiry Dropdown | Fut Price | IVP | Per Lot Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          
          {/* Expiry Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingRight: '12px', borderRight: `1px solid ${themeStyles.divider}` }}>
            <span style={{ fontSize: '13px', color: themeStyles.textMuted }}>Expiry</span>
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <select
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                style={{
                  appearance: 'none',
                  WebkitAppearance: 'none',
                  background: 'transparent',
                  border: 'none',
                  color: themeStyles.textMain,
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  paddingRight: '18px',
                  outline: 'none'
                }}
              >
                {data?.expiries?.map((exp) => (
                  <option key={exp.code} value={exp.code} style={{ background: themeStyles.cardBg, color: themeStyles.textMain }}>
                    {exp.label}
                  </option>
                ))}
              </select>
              <ChevronDown size={14} color={themeStyles.textMuted} style={{ position: 'absolute', right: 0, pointerEvents: 'none' }} />
            </div>
          </div>

          {/* Fut Price */}
          <div style={{ fontSize: '13px', color: themeStyles.textMain, paddingRight: '12px', borderRight: `1px solid ${themeStyles.divider}` }}>
            <span style={{ color: themeStyles.textMuted }}>Fut Price </span>
            <span style={{ fontWeight: '600' }}>{futPrice ? futPrice.toFixed(2) : '--'}</span>
          </div>

          {/* IVP */}
          <div style={{ fontSize: '13px', color: themeStyles.textMain, paddingRight: '12px', borderRight: `1px solid ${themeStyles.divider}` }}>
            <span style={{ color: themeStyles.textMuted }}>IVP </span>
            <span style={{ fontWeight: '600' }}>{ivp}</span>
          </div>

          {/* Per Lot Switch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div
              onClick={() => setPerLot(!perLot)}
              style={{
                width: '36px',
                height: '20px',
                borderRadius: '10px',
                background: perLot ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.2)' : '#d1d5db'),
                display: 'flex',
                alignItems: 'center',
                padding: '2px',
                cursor: 'pointer',
                transition: 'background 0.2s'
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: '#ffffff',
                transform: perLot ? 'translateX(16px)' : 'translateX(0)',
                transition: 'transform 0.2s',
                boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
              }} />
            </div>
            <span style={{ fontSize: '13px', color: themeStyles.textMain, cursor: 'pointer' }} onClick={() => setPerLot(!perLot)}>
              Per Lot
            </span>
          </div>

        </div>

      </div>

      {/* OPTIONS CHAIN TABLE */}
      {loading && !data ? (
        <div style={{
          background: themeStyles.cardBg,
          border: `1px solid ${themeStyles.cardBorder}`,
          borderRadius: '8px',
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '12px',
          minHeight: '400px'
        }}>
          <Loader2 className="animate-spin" size={28} color="#3b82f6" />
          <span style={{ color: themeStyles.textMuted, fontSize: '13px' }}>Compiling live options chain and Black-Scholes Greeks...</span>
        </div>
      ) : error ? (
        <div style={{
          background: themeStyles.cardBg,
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '24px',
          textAlign: 'center',
          color: '#ef4444'
        }}>
          {error}
        </div>
      ) : (
        <div style={{
          background: themeStyles.cardBg,
          border: `1px solid ${themeStyles.cardBorder}`,
          borderRadius: '8px',
          flex: '1',
          display: 'flex',
          flexDirection: 'column',
          minHeight: '0',
          overflow: 'hidden',
          boxShadow: isDark ? '0 1px 3px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.05)'
        }}>
          
          <div style={{ flex: '1', overflowY: 'auto', overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              borderCollapse: 'collapse',
              fontSize: '12px',
              fontVariantNumeric: 'tabular-nums'
            }}>
              
              {/* THE EXACT SENSIBULL HEADER (ROW 1: CALLS & PUTS BANNERS, ROW 2: 15 COLUMNS) */}
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: themeStyles.cardBg }}>
                
                {/* Banner Header Row */}
                <tr style={{ height: '32px' }}>
                  {/* Calls Banner spanning 7 columns */}
                  <th
                    colSpan={7}
                    style={{
                      background: themeStyles.callsBannerBg,
                      color: themeStyles.callsBannerText,
                      fontWeight: '700',
                      fontSize: '12px',
                      letterSpacing: '0.05em',
                      textAlign: 'right',
                      paddingRight: '24px',
                      borderBottom: `1px solid ${themeStyles.cardBorder}`
                    }}
                  >
                    CALLS
                  </th>

                  {/* Center Strike Spacer */}
                  <th
                    style={{
                      width: '90px',
                      background: themeStyles.strikeBg,
                      borderLeft: `1px solid ${themeStyles.strikeBorder}`,
                      borderRight: `1px solid ${themeStyles.strikeBorder}`,
                      borderBottom: `1px solid ${themeStyles.cardBorder}`
                    }}
                  />

                  {/* Puts Banner spanning 7 columns */}
                  <th
                    colSpan={7}
                    style={{
                      background: themeStyles.putsBannerBg,
                      color: themeStyles.putsBannerText,
                      fontWeight: '700',
                      fontSize: '12px',
                      letterSpacing: '0.05em',
                      textAlign: 'left',
                      paddingLeft: '24px',
                      borderBottom: `1px solid ${themeStyles.cardBorder}`
                    }}
                  >
                    PUTS
                  </th>
                </tr>

                {/* Sub-Header Column Names Row */}
                <tr style={{
                  height: '34px',
                  borderBottom: `1px solid ${themeStyles.cardBorder}`,
                  background: isDark ? '#161a22' : '#ffffff',
                  color: themeStyles.textMuted,
                  fontSize: '11px',
                  fontWeight: '600'
                }}>
                  {/* CALLS COLUMNS (1-7) */}
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('gamma')} onMouseLeave={() => setActiveTooltip(null)}>
                      Gamma <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('gamma', 'Rate of change of Delta per ₹1 move in spot')}
                    </div>
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('vega')} onMouseLeave={() => setActiveTooltip(null)}>
                      Vega <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('vega', 'Price change per 1% change in Implied Volatility')}
                    </div>
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('theta')} onMouseLeave={() => setActiveTooltip(null)}>
                      Theta <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('theta', 'Daily premium time decay in ₹ per day')}
                    </div>
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('delta')} onMouseLeave={() => setActiveTooltip(null)}>
                      Delta <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('delta', 'Option price sensitivity to ₹1 move in spot (0.00 to 1.00)')}
                    </div>
                  </th>
                  <th style={{ padding: '6px 10px', textAlign: 'right' }}>OI-lakh</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      Call OI
                      <div style={{ width: '16px', height: '6px', borderRadius: '3px', background: '#dc2626' }} />
                    </div>
                  </th>
                  <th style={{ padding: '6px 12px', textAlign: 'right' }}>LTP</th>

                  {/* CENTER COLUMN (8) */}
                  <th style={{
                    width: '90px',
                    textAlign: 'center',
                    background: themeStyles.strikeBg,
                    borderLeft: `1px solid ${themeStyles.strikeBorder}`,
                    borderRight: `1px solid ${themeStyles.strikeBorder}`,
                    color: themeStyles.textMain,
                    fontWeight: '700'
                  }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', justifyContent: 'center' }}>
                      Strike <ArrowDown size={12} />
                    </div>
                  </th>

                  {/* PUTS COLUMNS (9-15) */}
                  <th style={{ padding: '6px 12px', textAlign: 'left' }}>LTP</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', minWidth: '100px' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                      Put OI
                      <div style={{ width: '16px', height: '6px', borderRadius: '3px', background: '#10b981' }} />
                    </div>
                  </th>
                  <th style={{ padding: '6px 10px', textAlign: 'left' }}>OI-lakh</th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('pdelta')} onMouseLeave={() => setActiveTooltip(null)}>
                      Delta <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('pdelta', 'Put option price sensitivity to ₹1 move in spot')}
                    </div>
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('ptheta')} onMouseLeave={() => setActiveTooltip(null)}>
                      Theta <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('ptheta', 'Daily premium time decay in ₹ per day')}
                    </div>
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('pvega')} onMouseLeave={() => setActiveTooltip(null)}>
                      Vega <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('pvega', 'Price change per 1% change in Implied Volatility')}
                    </div>
                  </th>
                  <th style={{ padding: '6px 8px', textAlign: 'center', position: 'relative' }}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px' }} onMouseEnter={() => setActiveTooltip('pgamma')} onMouseLeave={() => setActiveTooltip(null)}>
                      Gamma <HelpCircle size={11} color={themeStyles.textMuted} />
                      {renderGreekTooltip('pgamma', 'Rate of change of Delta per ₹1 move in spot')}
                    </div>
                  </th>
                </tr>

              </thead>

              {/* TABLE BODY (STRIKE ROWS) */}
              <tbody>
                {data?.data?.map((row) => {
                  const isCallItm = row.strike < spot;
                  const isPutItm = row.strike > spot;
                  const isAtm = row.strike === atmStrike;

                  const callBg = isCallItm ? themeStyles.itmBg : themeStyles.otmBg;
                  const putBg = isPutItm ? themeStyles.itmBg : themeStyles.otmBg;

                  // Call & Put OI horizontal bar percentage
                  const callBarWidth = Math.min(100, Math.round((row.CE.oiLakh / maxOi) * 100));
                  const putBarWidth = Math.min(100, Math.round((row.PE.oiLakh / maxOi) * 100));

                  const ceDisplayLtp = row.CE.ltp !== null
                    ? (perLot ? (row.CE.ltp * lotSize).toFixed(2) : row.CE.ltp.toFixed(2))
                    : '-';
                  const peDisplayLtp = row.PE.ltp !== null
                    ? (perLot ? (row.PE.ltp * lotSize).toFixed(2) : row.PE.ltp.toFixed(2))
                    : '-';

                  return (
                    <tr
                      key={row.strike}
                      style={{
                        height: '32px',
                        borderBottom: `1px solid ${themeStyles.rowBorder}`,
                        transition: 'background 0.1s'
                      }}
                    >
                      {/* 1. Gamma (CE) */}
                      <td style={{ background: callBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.CE.gamma === 0 ? '0' : row.CE.gamma.toFixed(3)}
                      </td>

                      {/* 2. Vega (CE) */}
                      <td style={{ background: callBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.CE.vega === 0 ? '0' : row.CE.vega.toFixed(1)}
                      </td>

                      {/* 3. Theta (CE) */}
                      <td style={{ background: callBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.CE.theta === 0 ? '0' : row.CE.theta}
                      </td>

                      {/* 4. Delta (CE) */}
                      <td style={{ background: callBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.CE.delta.toFixed(2)}
                      </td>

                      {/* 5. OI-lakh (CE) */}
                      <td style={{ background: callBg, textAlign: 'right', color: themeStyles.textMain, padding: '4px 10px', fontWeight: '500' }}>
                        {row.CE.oiLakh.toFixed(1)}
                      </td>

                      {/* 6. Call OI visual meter */}
                      <td style={{ background: callBg, padding: '4px 8px', position: 'relative' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-end',
                          height: '16px',
                          width: '100%'
                        }}>
                          {callBarWidth > 0 && (
                            <div style={{
                              width: `${callBarWidth}%`,
                              height: '12px',
                              borderRadius: '4px',
                              background: themeStyles.callOiBar,
                              transition: 'width 0.3s ease-out'
                            }} />
                          )}
                        </div>
                      </td>

                      {/* 7. LTP (CE) with Eye & MP icon */}
                      <td
                        onClick={() => handleOptionClick(row.CE.symbol, 'chart')}
                        title={`Click to open Candlestick Chart for ${row.CE.symbol}`}
                        style={{
                          background: callBg,
                          padding: '4px 8px 4px 12px',
                          textAlign: 'right',
                          cursor: 'pointer',
                          fontWeight: '600',
                          color: row.CE.ltp && row.CE.ltp > 0 ? themeStyles.textMain : themeStyles.textMuted
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-end' }}>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOptionClick(row.CE.symbol, 'profile');
                            }}
                            title={`Open Market Profile for ${row.CE.symbol}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '2px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: '3px',
                              color: '#00f0ff',
                              opacity: 0.8
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                          >
                            <BarChart2 size={12} />
                          </button>
                          <span>{ceDisplayLtp}</span>
                          <Eye size={13} color={themeStyles.textMuted} style={{ opacity: 0.7 }} />
                        </div>
                      </td>

                      {/* 8. CENTER STRIKE COLUMN */}
                      <td 
                        onClick={() => handleOptionClick(isCallItm ? row.CE.symbol : row.PE.symbol, 'chart')}
                        title="Click to open Candlestick Chart"
                        style={{
                          background: isAtm ? (isDark ? '#252d3d' : '#e0e7ff') : themeStyles.strikeBg,
                          textAlign: 'center',
                          fontWeight: '700',
                          fontSize: '13px',
                          color: isAtm ? '#3b82f6' : themeStyles.textMain,
                          borderLeft: `1px solid ${themeStyles.strikeBorder}`,
                          borderRight: `1px solid ${themeStyles.strikeBorder}`,
                          padding: '4px 8px',
                          cursor: 'pointer'
                        }}
                      >
                        {row.strike.toLocaleString('en-IN')}
                        {isAtm && (
                          <span style={{
                            display: 'block',
                            fontSize: '9px',
                            fontWeight: '700',
                            color: '#3b82f6',
                            lineHeight: '1'
                          }}>
                            ATM
                          </span>
                        )}
                      </td>

                      {/* 9. LTP (PE) with Eye & MP icon */}
                      <td
                        onClick={() => handleOptionClick(row.PE.symbol, 'chart')}
                        title={`Click to open Candlestick Chart for ${row.PE.symbol}`}
                        style={{
                          background: putBg,
                          padding: '4px 12px 4px 8px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          fontWeight: '600',
                          color: row.PE.ltp && row.PE.ltp > 0 ? themeStyles.textMain : themeStyles.textMuted
                        }}
                      >
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', justifyContent: 'flex-start' }}>
                          <Eye size={13} color={themeStyles.textMuted} style={{ opacity: 0.7 }} />
                          <span>{peDisplayLtp}</span>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOptionClick(row.PE.symbol, 'profile');
                            }}
                            title={`Open Market Profile for ${row.PE.symbol}`}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              padding: '2px',
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              borderRadius: '3px',
                              color: '#00f0ff',
                              opacity: 0.8
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.opacity = '1')}
                            onMouseLeave={(e) => (e.currentTarget.style.opacity = '0.8')}
                          >
                            <BarChart2 size={12} />
                          </button>
                        </div>
                      </td>

                      {/* 10. Put OI visual meter */}
                      <td style={{ background: putBg, padding: '4px 8px', position: 'relative' }}>
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'flex-start',
                          height: '16px',
                          width: '100%'
                        }}>
                          {putBarWidth > 0 && (
                            <div style={{
                              width: `${putBarWidth}%`,
                              height: '12px',
                              borderRadius: '4px',
                              background: themeStyles.putOiBar,
                              transition: 'width 0.3s ease-out'
                            }} />
                          )}
                        </div>
                      </td>

                      {/* 11. OI-lakh (PE) */}
                      <td style={{ background: putBg, textAlign: 'left', color: themeStyles.textMain, padding: '4px 10px', fontWeight: '500' }}>
                        {row.PE.oiLakh.toFixed(1)}
                      </td>

                      {/* 12. Delta (PE) */}
                      <td style={{ background: putBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.PE.delta.toFixed(2)}
                      </td>

                      {/* 13. Theta (PE) */}
                      <td style={{ background: putBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.PE.theta === 0 ? '0' : row.PE.theta}
                      </td>

                      {/* 14. Vega (PE) */}
                      <td style={{ background: putBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.PE.vega === 0 ? '0' : row.PE.vega.toFixed(1)}
                      </td>

                      {/* 15. Gamma (PE) */}
                      <td style={{ background: putBg, textAlign: 'center', color: themeStyles.textMain, padding: '4px 8px' }}>
                        {row.PE.gamma === 0 ? '0' : row.PE.gamma.toFixed(3)}
                      </td>

                    </tr>
                  );
                })}
              </tbody>

            </table>
          </div>

        </div>
      )}

      {/* FOOTER STATS SUMMARY */}
      {data && (
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '11px',
          color: themeStyles.textMuted,
          padding: '0 4px'
        }}>
          <span>Source: Angel One SmartAPI Real-time Stream &middot; Black-Scholes Greeks</span>
          <span>Lot Size: {lotSize} Qty &middot; Expiry: {expiry}</span>
        </div>
      )}

    </div>
  );
}
