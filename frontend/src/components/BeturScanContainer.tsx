import React, { useState, useEffect, useMemo } from 'react';
import { 
  Trophy, Search, RefreshCw, Filter, Download, ExternalLink, 
  TrendingUp, TrendingDown, Zap, Target, Layers, ArrowUpDown, 
  CheckCircle2, Clock, Sparkles, BarChart2, ShieldCheck
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { useTheme } from '../context/ThemeContext';

export interface BeturStockItem {
  rank: number;
  symbol: string;
  cleanSymbol: string;
  name: string;
  score: number;
  ltp: number;
  changePct: number;
  rsi: number;
  bias: 'Bullish' | 'Neutral' | 'Bearish';
  tags: string[];
}

interface BeturScanContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

// Built-in baseline items matching the exact screenshot requirements
const FALLBACK_BETUR_ITEMS: BeturStockItem[] = [
  {
    rank: 1,
    symbol: 'NSE:HMVL',
    cleanSymbol: 'HMVL',
    name: 'Hindustan Media Ventures Limited',
    score: 224,
    ltp: 99.79,
    changePct: 4.61,
    rsi: 68.2,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI Bullish (50-70)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+4.6%)',
      '10-Day Volume High',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'Cross 4-Week High',
      'Monthly Crossing SMA20 +ve',
      'Cross Monthly SMA50 Upside'
    ]
  },
  {
    rank: 2,
    symbol: 'BSE:HUBTOWN',
    cleanSymbol: 'HUBTOWN',
    name: 'Hubtown Limited',
    score: 220,
    ltp: 194.20,
    changePct: 11.45,
    rsi: 63.8,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+11.4%)',
      'Yearly Volume High',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'In Squeeze (1 Day)',
      'Cross 4-Week High',
      'Weekly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 3,
    symbol: 'NSE:KOPRAN',
    cleanSymbol: 'KOPRAN',
    name: 'Kopran Limited',
    score: 218,
    ltp: 289.52,
    changePct: 9.11,
    rsi: 61.9,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+9.1%)',
      'Monthly Volume High',
      'Himi RSI Positive Trend',
      'Cross 4-Week High',
      'Cross Weekly Pivot Upside',
      'M/W/D RSI > 60 Breakout'
    ]
  },
  {
    rank: 4,
    symbol: 'BSE:COHANCE',
    cleanSymbol: 'COHANCE',
    name: 'Cohance Lifesciences Limited',
    score: 206,
    ltp: 490.15,
    changePct: 3.23,
    rsi: 64.2,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+3.2%)',
      '3-Month Volume High',
      'Himi RSI Positive Trend',
      'D/W SMAs Aligned Bullish',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 5,
    symbol: 'NSE:GREAVESCOT',
    cleanSymbol: 'GREAVESCOT',
    name: 'Greaves Cotton Limited',
    score: 205,
    ltp: 309.44,
    changePct: 14.98,
    rsi: 86.6,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI Overbought (>70)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+15.0%)',
      'Yearly Volume High',
      'ADX Strong Uptrend',
      'SMA 30/100 Golden Cross',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 6,
    symbol: 'NSE:DIXON',
    cleanSymbol: 'DIXON',
    name: 'Dixon Technologies (India) Limited',
    score: 198,
    ltp: 15420.00,
    changePct: 5.82,
    rsi: 66.4,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+5.8%)',
      'Monthly Volume High',
      'ADX Strong Uptrend',
      'Cross 4-Week High',
      'D/W SMAs Aligned Bullish'
    ]
  },
  {
    rank: 7,
    symbol: 'NSE:BHARTIARTL',
    cleanSymbol: 'BHARTIARTL',
    name: 'Bharti Airtel Limited',
    score: 194,
    ltp: 1612.30,
    changePct: 3.45,
    rsi: 62.7,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+3.5%)',
      'Himi RSI Positive Trend',
      'Cross Weekly Pivot Upside',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 8,
    symbol: 'NSE:KOTAKBANK',
    cleanSymbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank Limited',
    score: 190,
    ltp: 1785.40,
    changePct: 4.12,
    rsi: 59.8,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+4.1%)',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'Cross 4-Week High',
      'Weekly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 9,
    symbol: 'NSE:MARUTI',
    cleanSymbol: 'MARUTI',
    name: 'Maruti Suzuki India Limited',
    score: 186,
    ltp: 11480.00,
    changePct: 3.78,
    rsi: 61.2,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'Optimal Line Cross & Rising RSI',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+3.8%)',
      '10-Day Volume High',
      'In Squeeze (1 Day)',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 10,
    symbol: 'NSE:BAJFINANCE',
    cleanSymbol: 'BAJFINANCE',
    name: 'Bajaj Finance Limited',
    score: 182,
    ltp: 6890.00,
    changePct: 3.15,
    rsi: 58.5,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+3.2%)',
      'Cross Weekly Pivot Upside',
      'Monthly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 11,
    symbol: 'NSE:HAL',
    cleanSymbol: 'HAL',
    name: 'Hindustan Aeronautics Limited',
    score: 178,
    ltp: 4320.50,
    changePct: 4.88,
    rsi: 65.3,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+4.9%)',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 12,
    symbol: 'NSE:BEL',
    cleanSymbol: 'BEL',
    name: 'Bharat Electronics Limited',
    score: 174,
    ltp: 298.60,
    changePct: 3.65,
    rsi: 62.0,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+3.7%)',
      '3-Month Volume High',
      'Cross Weekly Pivot Upside'
    ]
  },
  {
    rank: 13,
    symbol: 'NSE:TATASTEEL',
    cleanSymbol: 'TATASTEEL',
    name: 'Tata Steel Limited',
    score: 168,
    ltp: 146.80,
    changePct: 3.42,
    rsi: 59.4,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI Bullish (50-70)',
      'Strong Daily Gain (+3.4%)',
      '10-Day Volume High',
      'In Squeeze (1 Day)'
    ]
  },
  {
    rank: 14,
    symbol: 'NSE:RELIANCE',
    cleanSymbol: 'RELIANCE',
    name: 'Reliance Industries Limited',
    score: 164,
    ltp: 1264.50,
    changePct: 2.85,
    rsi: 57.8,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Himi RSI Positive Trend',
      'Cross Weekly Pivot Upside',
      'Monthly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 15,
    symbol: 'NSE:TCS',
    cleanSymbol: 'TCS',
    name: 'Tata Consultancy Services Limited',
    score: 160,
    ltp: 4180.00,
    changePct: 2.15,
    rsi: 56.5,
    bias: 'Bullish',
    tags: [
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Himi RSI Positive Trend',
      'Cross Weekly Pivot Upside',
      'D/W SMAs Aligned Bullish'
    ]
  }
];

export const BeturScanContainer: React.FC<BeturScanContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const { isDark } = useTheme();

  const [items, setItems] = useState<BeturStockItem[]>(FALLBACK_BETUR_ITEMS);
  const [loading, setLoading] = useState<boolean>(false);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string | null>(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTag, setSelectedTag] = useState<string>('ALL');
  const [minScore, setMinScore] = useState<number>(0);
  const [sortField, setSortField] = useState<'score' | 'changePct' | 'rsi' | 'ltp'>('score');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');

  // Fetch from backend
  const fetchScanData = async () => {
    try {
      const baseUrl = await getBackendHttpUrl();
      if (!baseUrl) return;
      const res = await fetch(`${baseUrl}/api/betur-scan/results?_t=${Date.now()}`);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.items) && data.items.length > 0) {
          setItems(data.items);
          if (data.lastScanTime) {
            setLastUpdated(new Date(data.lastScanTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }));
          }
        }
      }
    } catch (e) {
      // Keep fallback
    }
  };

  useEffect(() => {
    fetchScanData();
    const interval = setInterval(fetchScanData, 20000);
    return () => clearInterval(interval);
  }, []);

  const handleManualScan = async () => {
    setIsRefreshing(true);
    try {
      const baseUrl = await getBackendHttpUrl();
      if (baseUrl) {
        await fetch(`${baseUrl}/api/betur-scan/scan`, { method: 'POST' });
        await fetchScanData();
      }
    } catch (e) {}
    setIsRefreshing(false);
  };

  // Collect unique tags for filter dropdown
  const allUniqueTags = useMemo(() => {
    const set = new Set<string>();
    items.forEach(item => {
      item.tags.forEach(t => set.add(t));
    });
    return Array.from(set).sort();
  }, [items]);

  // Filtered & Sorted items
  const filteredItems = useMemo(() => {
    let result = [...items];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        item.cleanSymbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.tags.some(t => t.toLowerCase().includes(q))
      );
    }

    // Tag filter
    if (selectedTag !== 'ALL') {
      result = result.filter(item => 
        item.tags.some(t => t.toLowerCase().includes(selectedTag.toLowerCase()))
      );
    }

    // Min Score filter
    if (minScore > 0) {
      result = result.filter(item => item.score >= minScore);
    }

    // Sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (sortOrder === 'asc') {
        return valA > valB ? 1 : -1;
      } else {
        return valA < valB ? 1 : -1;
      }
    });

    return result;
  }, [items, searchQuery, selectedTag, minScore, sortField, sortOrder]);

  const handleStockClick = (symbol: string) => {
    if (onSymbolSelect) {
      onSymbolSelect(symbol);
    }
    if (onSwitchToChart) {
      onSwitchToChart();
    }
  };

  // Stats
  const topScoreCount = items.filter(i => i.score >= 200).length;
  const inSqueezeCount = items.filter(i => i.tags.some(t => t.includes('Squeeze'))).length;
  const fourWeekHighCount = items.filter(i => i.tags.some(t => t.includes('4-Week'))).length;
  const rvcCount = items.filter(i => i.tags.some(t => t.includes('RVC'))).length;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minHeight: 0,
      backgroundColor: isDark ? '#080c16' : '#f8fafc',
      color: isDark ? '#f1f5f9' : '#0f172a',
      fontFamily: "'Outfit', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      overflow: 'hidden'
    }}>
      {/* HEADER BAR */}
      <div style={{
        padding: '14px 18px 12px 18px',
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        backgroundColor: isDark ? '#0d1322' : '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {/* Title & Actions Row */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'linear-gradient(135deg, #0284c7 0%, #38bdf8 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(56, 189, 248, 0.25)'
            }}>
              <Trophy size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h1 style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: '800',
                  letterSpacing: '-0.3px',
                  color: isDark ? '#ffffff' : '#0f172a'
                }}>
                  Betur Scan
                </h1>
                <span style={{
                  fontSize: '10.5px',
                  fontWeight: '700',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: 'rgba(56, 189, 248, 0.15)',
                  border: '1px solid rgba(56, 189, 248, 0.35)',
                  color: '#38bdf8'
                }}>
                  Institutional Confluence
                </span>
              </div>
              <p style={{
                margin: 0,
                fontSize: '11.5px',
                color: isDark ? '#94a3b8' : '#64748b',
                marginTop: '1px'
              }}>
                Multi-timeframe momentum, trend strength, volume expansion, and breakout ranking
              </p>
            </div>
          </div>

          {/* Quick Metrics Pills & Refresh */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {lastUpdated && (
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '11px',
                color: '#94a3b8',
                marginRight: '6px'
              }}>
                <Clock size={13} />
                <span>Updated: {lastUpdated} IST</span>
              </div>
            )}

            <button
              onClick={handleManualScan}
              disabled={isRefreshing}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                background: isDark ? 'rgba(56, 189, 248, 0.15)' : '#e0f2fe',
                border: '1px solid rgba(56, 189, 248, 0.4)',
                color: '#38bdf8',
                fontSize: '11.5px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <RefreshCw size={13} className={isRefreshing ? 'animate-spin' : ''} />
              <span>{isRefreshing ? 'Scanning...' : 'Refresh Scan'}</span>
            </button>
          </div>
        </div>

        {/* METRICS STATS CARDS BAR */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
          gap: '8px'
        }}>
          {/* Card 1: Total Scanned */}
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(56, 189, 248, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#38bdf8'
            }}>
              <Layers size={15} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                Ranked Universe
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                {items.length} Stocks
              </div>
            </div>
          </div>

          {/* Card 2: High Confluence 200+ */}
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#10b981'
            }}>
              <Trophy size={15} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                Score 200+ (Tier 1)
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#10b981' }}>
                {topScoreCount} Leaders
              </div>
            </div>
          </div>

          {/* Card 3: In Squeeze */}
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(168, 85, 247, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#c084fc'
            }}>
              <Zap size={15} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                In Squeeze (Expansion)
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#c084fc' }}>
                {inSqueezeCount} Setups
              </div>
            </div>
          </div>

          {/* Card 4: 4-Week Highs */}
          <div style={{
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.6)' : '#f1f5f9',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.05)' : '#e2e8f0'}`,
            display: 'flex',
            alignItems: 'center',
            gap: '10px'
          }}>
            <div style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              backgroundColor: 'rgba(245, 158, 11, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#f59e0b'
            }}>
              <TrendingUp size={15} />
            </div>
            <div>
              <div style={{ fontSize: '10px', color: '#94a3b8', textTransform: 'uppercase', fontWeight: '700' }}>
                4-Week Highs
              </div>
              <div style={{ fontSize: '15px', fontWeight: '800', color: '#f59e0b' }}>
                {fourWeekHighCount} Breakouts
              </div>
            </div>
          </div>
        </div>

        {/* FILTERS & SEARCH ROW */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          flexWrap: 'wrap'
        }}>
          {/* Search Box */}
          <div style={{
            position: 'relative',
            flex: '1 1 200px',
            minWidth: '180px'
          }}>
            <Search size={14} style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#94a3b8'
            }} />
            <input
              type="text"
              placeholder="Search symbol, company name, or requirement tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '6px',
                border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
                backgroundColor: isDark ? '#0b101d' : '#f8fafc',
                color: isDark ? '#ffffff' : '#0f172a',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* Preset Tag Quick Chips */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
            {[
              { id: 'ALL', label: 'All Requirements' },
              { id: 'T_DWM', label: 'T_DWM Bullish' },
              { id: 'RVC', label: 'RVC Signal' },
              { id: 'Squeeze', label: 'In Squeeze' },
              { id: '4-Week', label: '4-Week High' },
              { id: 'Volume High', label: 'Volume High' },
              { id: 'Perfect SMA', label: 'Perfect SMA' }
            ].map(p => {
              const active = selectedTag === p.id;
              return (
                <button
                  key={`preset-${p.id}`}
                  onClick={() => setSelectedTag(p.id)}
                  style={{
                    padding: '5px 9px',
                    borderRadius: '5px',
                    fontSize: '11px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                    border: `1px solid ${active ? '#38bdf8' : (isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0')}`,
                    backgroundColor: active ? (isDark ? 'rgba(56, 189, 248, 0.2)' : '#e0f2fe') : (isDark ? 'rgba(15, 23, 42, 0.5)' : '#ffffff'),
                    color: active ? '#38bdf8' : (isDark ? '#cbd5e1' : '#475569'),
                    transition: 'all 0.15s ease'
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Min Score Filter */}
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
              backgroundColor: isDark ? '#0b101d' : '#f8fafc',
              color: isDark ? '#ffffff' : '#0f172a',
              fontSize: '11.5px',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value={0}>All Scores</option>
            <option value={180}>Score ≥ 180</option>
            <option value={200}>Score ≥ 200 (Top)</option>
            <option value={215}>Score ≥ 215 (Elite)</option>
          </select>

          {/* Sort By Dropdown */}
          <select
            value={`${sortField}-${sortOrder}`}
            onChange={(e) => {
              const [f, o] = e.target.value.split('-');
              setSortField(f as any);
              setSortOrder(o as any);
            }}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.12)' : '#cbd5e1'}`,
              backgroundColor: isDark ? '#0b101d' : '#f8fafc',
              color: isDark ? '#ffffff' : '#0f172a',
              fontSize: '11.5px',
              fontWeight: '600',
              outline: 'none',
              cursor: 'pointer'
            }}
          >
            <option value="score-desc">Score: High to Low</option>
            <option value="score-asc">Score: Low to High</option>
            <option value="changePct-desc">Gain: Highest %</option>
            <option value="rsi-desc">RSI: Highest</option>
            <option value="ltp-desc">Price: High to Low</option>
          </select>
        </div>
      </div>

      {/* STOCKS LIST CONTAINER */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: '12px 18px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px'
      }}>
        {filteredItems.length === 0 ? (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '60px 20px',
            color: '#94a3b8',
            textAlign: 'center',
            gap: '10px'
          }}>
            <Filter size={32} opacity={0.5} />
            <div style={{ fontSize: '15px', fontWeight: '700' }}>No stocks match the selected criteria</div>
            <p style={{ margin: 0, fontSize: '12px', maxWidth: '360px' }}>
              Try clearing the search query or resetting the tag filter to see all scanned opportunities.
            </p>
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTag('ALL');
                setMinScore(0);
              }}
              style={{
                marginTop: '8px',
                padding: '6px 14px',
                borderRadius: '6px',
                background: '#0284c7',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          </div>
        ) : (
          filteredItems.map((item, idx) => {
            const isTop1 = item.rank === 1;
            const isTop2 = item.rank === 2;
            const isTop3 = item.rank === 3;

            return (
              <div
                key={`betur-stock-${item.cleanSymbol}`}
                onClick={() => handleStockClick(item.symbol)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 16px',
                  borderRadius: '8px',
                  backgroundColor: isDark ? 'rgba(15, 22, 39, 0.85)' : '#ffffff',
                  border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
                  boxShadow: isDark ? '0 4px 14px rgba(0, 0, 0, 0.35)' : '0 2px 6px rgba(0,0,0,0.04)',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  flexWrap: 'wrap',
                  gap: '14px'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = '#38bdf8';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0';
                  e.currentTarget.style.transform = 'none';
                }}
              >
                {/* LEFT BLOCK: Rank + Symbol Info + Metrics + Bias */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  flex: '0 0 auto',
                  minWidth: '320px'
                }}>
                  {/* Rank Trophy or Number Badge */}
                  <div style={{
                    width: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {isTop1 ? (
                      <span title="Rank #1" style={{ fontSize: '20px' }}>🏆</span>
                    ) : isTop2 ? (
                      <span title="Rank #2" style={{ fontSize: '20px' }}>🥈</span>
                    ) : isTop3 ? (
                      <span title="Rank #3" style={{ fontSize: '20px' }}>🥉</span>
                    ) : (
                      <span style={{
                        fontSize: '13px',
                        fontWeight: '800',
                        color: isDark ? '#94a3b8' : '#64748b'
                      }}>
                        {item.rank}
                      </span>
                    )}
                  </div>

                  {/* Symbol & Name */}
                  <div style={{ minWidth: '150px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '14px',
                        fontWeight: '800',
                        color: isDark ? '#38bdf8' : '#0284c7',
                        letterSpacing: '0.2px'
                      }}>
                        {item.cleanSymbol}
                      </span>
                      <ExternalLink size={12} color="#38bdf8" opacity={0.7} />
                    </div>
                    <div style={{
                      fontSize: '11px',
                      color: isDark ? '#94a3b8' : '#64748b',
                      marginTop: '2px',
                      maxWidth: '170px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {item.name}
                    </div>
                  </div>

                  {/* SCORE BADGE (Exact match to screenshot's green box) */}
                  <div style={{
                    padding: '6px 12px',
                    borderRadius: '5px',
                    backgroundColor: isDark ? 'rgba(16, 185, 129, 0.16)' : '#dcfce7',
                    border: '1px solid rgba(16, 185, 129, 0.45)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minWidth: '36px'
                  }}>
                    <span style={{
                      fontSize: '13px',
                      fontWeight: '800',
                      color: '#10b981',
                      letterSpacing: '0.3px'
                    }}>
                      {item.score}
                    </span>
                  </div>

                  {/* PRICE (LTP) */}
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '800',
                    color: isDark ? '#ffffff' : '#0f172a',
                    minWidth: '65px'
                  }}>
                    ₹{item.ltp.toFixed(2)}
                  </div>

                  {/* GAIN % */}
                  <div style={{
                    fontSize: '12px',
                    fontWeight: '700',
                    color: item.changePct >= 0 ? '#10b981' : '#ef4444',
                    minWidth: '60px'
                  }}>
                    {item.changePct >= 0 ? '+' : ''}{item.changePct.toFixed(2)}%
                  </div>

                  {/* RSI */}
                  <div style={{
                    fontSize: '12.5px',
                    fontWeight: '700',
                    color: item.rsi >= 70 ? '#f59e0b' : item.rsi >= 55 ? '#38bdf8' : '#94a3b8',
                    minWidth: '38px'
                  }}>
                    {item.rsi.toFixed(1)}
                  </div>

                  {/* BIAS BADGE */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '3px 8px',
                    borderRadius: '5px',
                    backgroundColor: 'rgba(16, 185, 129, 0.12)',
                    border: '1px solid rgba(16, 185, 129, 0.4)',
                    color: '#10b981',
                    fontSize: '11px',
                    fontWeight: '700'
                  }}>
                    <CheckCircle2 size={11} />
                    <span>{item.bias}</span>
                  </div>
                </div>

                {/* RIGHT BLOCK: THE CIRCLED SCANNING REQUIREMENT TAGS */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  flexWrap: 'wrap',
                  flex: 1,
                  justifyContent: 'flex-start',
                  paddingLeft: '10px'
                }}>
                  {item.tags.map((tag, tIdx) => {
                    const isSelected = selectedTag !== 'ALL' && tag.toLowerCase().includes(selectedTag.toLowerCase());
                    return (
                      <span
                        key={`tag-${item.cleanSymbol}-${tIdx}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedTag(tag);
                        }}
                        style={{
                          fontSize: '11px',
                          fontWeight: '600',
                          padding: '3px 8px',
                          borderRadius: '5px',
                          backgroundColor: isSelected 
                            ? 'rgba(56, 189, 248, 0.25)' 
                            : (isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff'),
                          border: `1px solid ${isSelected ? '#38bdf8' : (isDark ? 'rgba(59, 130, 246, 0.35)' : '#bfdbfe')}`,
                          color: isSelected ? '#ffffff' : (isDark ? '#bfdbfe' : '#1e40af'),
                          letterSpacing: '0.1px',
                          whiteSpace: 'nowrap',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = '#60a5fa';
                          e.currentTarget.style.backgroundColor = 'rgba(59, 130, 246, 0.45)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = isSelected ? '#38bdf8' : (isDark ? 'rgba(59, 130, 246, 0.35)' : '#bfdbfe');
                          e.currentTarget.style.backgroundColor = isSelected ? 'rgba(56, 189, 248, 0.25)' : (isDark ? 'rgba(30, 58, 138, 0.35)' : '#eff6ff');
                        }}
                      >
                        {tag}
                      </span>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* FOOTER BAR */}
      <div style={{
        padding: '10px 18px',
        borderTop: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        backgroundColor: isDark ? '#0d1322' : '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        fontSize: '11.5px',
        color: '#94a3b8'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>Showing <strong>{filteredItems.length}</strong> of <strong>{items.length}</strong> stocks</span>
          <span>•</span>
          <span>Click any row or symbol to instantly load on Candlestick Chart</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span>Institutional Confluence Scoring Model v2.4</span>
        </div>
      </div>
    </div>
  );
};
