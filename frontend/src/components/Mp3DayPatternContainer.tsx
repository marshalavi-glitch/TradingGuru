import React, { useState, useEffect, useMemo } from 'react';
import { 
  Zap, 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  Search, 
  Layers, 
  Target, 
  Compass, 
  Activity, 
  Filter, 
  Calendar,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  ShieldCheck,
  BarChart2,
  Download,
  FileSpreadsheet
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

export interface DayProfileInfo {
  dateStr: string;
  dayHigh: number;
  dayLow: number;
  range: number;
  openPrice: number;
  closePrice: number;
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  totalVolume: number;
  candlesCount: number;
}

export interface Mp3DayPatternItem {
  symbol: string;
  cleanName: string;
  sector: string;
  currentPrice: number;
  changePts: number;
  changePct: number;
  status: 'ACTIVE_COIL' | 'BREAKOUT_BULLISH' | 'BREAKOUT_BEARISH';
  statusText: string;
  action: string;
  isLatestSession: boolean;
  day1: DayProfileInfo;
  day2: DayProfileInfo;
  day3: DayProfileInfo;
  prior5: { date: string; range: number; high: number; low: number }[];
  prior5MaxRange: number;
  rangeExpansionPct: number;
  compressionRatio: number;
  vahCompressionRatio: number;
  insideType: 'ULTRA_COIL' | 'VA_INSIDE' | 'RANGE_INSIDE' | 'INSIDE_DAY_2';
  isDay2VaInside: boolean;
  isDay3VaInside: boolean;
  isDay3RangeInside: boolean;
  breakoutTriggerHigh: number;
  breakoutTriggerLow: number;
  target1Bullish: number;
  target2Bullish: number;
  target1Bearish: number;
  target2Bearish: number;
}

interface Mp3DayPatternContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: (symbol: string) => void;
  onSwitchToMarketProfile?: (symbol: string) => void;
}

export const Mp3DayPatternContainer: React.FC<Mp3DayPatternContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart,
  onSwitchToMarketProfile
}) => {
  const [items, setItems] = useState<Mp3DayPatternItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [summary, setSummary] = useState({
    totalScanned: 0,
    matchedCount: 0,
    activeCoilCount: 0,
    bullishBreakoutCount: 0,
    bearishBreakoutCount: 0,
    ultraCoilCount: 0
  });
  const [lastScanTime, setLastScanTime] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE_COIL' | 'BREAKOUT_BULLISH' | 'BREAKOUT_BEARISH' | 'ULTRA_COIL'>('ALL');
  const [sectorFilter, setSectorFilter] = useState<'ALL' | 'Index' | 'Commodity' | 'Equity / F&O'>('ALL');
  const [selectedItem, setSelectedItem] = useState<Mp3DayPatternItem | null>(null);
  const [showBacktestModal, setShowBacktestModal] = useState<boolean>(false);

  const handleDownloadBacktest = async () => {
    try {
      const baseUrl = await getBackendHttpUrl();
      const downloadUrl = `${baseUrl}/api/mp-3day-patterns/download-backtest`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'Market_Profile_3Day_Compression_Backtest_20Days.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open('/downloads/Market_Profile_3Day_Compression_Backtest_20Days.xlsx', '_blank');
    }
  };

  const handleDownloadBacktest100D = async () => {
    try {
      const baseUrl = await getBackendHttpUrl();
      const downloadUrl = `${baseUrl}/api/mp-3day-patterns/download-backtest-100d`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', 'Market_Profile_3Day_Compression_Backtest_100Days.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      window.open('/downloads/Market_Profile_3Day_Compression_Backtest_100Days.xlsx', '_blank');
    }
  };

  const fetchResults = async (manualScan = false) => {
    try {
      if (manualScan) setIsScanning(true);
      const baseUrl = await getBackendHttpUrl();
      const url = `${baseUrl}/api/mp-3day-patterns${manualScan ? '?scan=true' : ''}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        if (data.results) {
          setItems(data.results);
          if (data.summary) setSummary(data.summary);
          if (data.lastScanTime) setLastScanTime(data.lastScanTime);
          if (data.results.length > 0 && !selectedItem) {
            setSelectedItem(data.results[0]);
          }
        }
      }
    } catch (err) {
      console.warn('[MP 3-Day Pattern] Fetch error:', err);
    } finally {
      setLoading(false);
      if (manualScan) {
        setTimeout(() => setIsScanning(false), 3000);
      }
    }
  };

  useEffect(() => {
    fetchResults();
    const interval = setInterval(() => fetchResults(false), 30000);
    return () => clearInterval(interval);
  }, []);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      // Search filter
      const matchesSearch = 
        item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.cleanName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.sector.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchesSearch) return false;

      // Status filter
      if (statusFilter === 'ACTIVE_COIL' && item.status !== 'ACTIVE_COIL') return false;
      if (statusFilter === 'BREAKOUT_BULLISH' && item.status !== 'BREAKOUT_BULLISH') return false;
      if (statusFilter === 'BREAKOUT_BEARISH' && item.status !== 'BREAKOUT_BEARISH') return false;
      if (statusFilter === 'ULTRA_COIL' && item.insideType !== 'ULTRA_COIL') return false;

      // Sector filter
      if (sectorFilter !== 'ALL' && item.sector !== sectorFilter) return false;

      return true;
    });
  }, [items, searchQuery, statusFilter, sectorFilter]);

  const activeSelectedItem = selectedItem || filteredItems[0] || null;

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '16px',
      color: '#e2e8f0',
      backgroundColor: '#0a0d14',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif'
    }}>
      {/* HEADER SECTION */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '16px 20px',
        backgroundColor: '#111624',
        borderRadius: '12px',
        border: '1px solid #232c42',
        boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
        gap: '12px'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '22px' }}>🏛️</span>
            <h1 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc', letterSpacing: '-0.3px' }}>
              Market Profile • 3-Day Compression Pattern Scanner
            </h1>
            <span style={{
              fontSize: '11px',
              fontWeight: 800,
              padding: '3px 9px',
              borderRadius: '20px',
              backgroundColor: 'rgba(236, 72, 153, 0.15)',
              color: '#f472b6',
              border: '1px solid rgba(236, 72, 153, 0.4)'
            }}>
              DALTON COIL ENGINE
            </span>
          </div>
          <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span><strong>Rule 1:</strong> Day 1 Range &gt; Prior 5 Days Max Range</span>
            <span>•</span>
            <span><strong>Rule 2:</strong> Day 2 VAH/VAL inside Day 1 VAH/VAL</span>
            <span>•</span>
            <span><strong>Rule 3:</strong> Day 3 remains completely inside Day 2</span>
          </div>
        </div>

        {/* Scan Actions & Last Scan */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {lastScanTime && (
            <div style={{ fontSize: '11px', color: '#64748b' }}>
              Last scan: {new Date(lastScanTime).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' })} IST
            </div>
          )}

          <button
            onClick={handleDownloadBacktest}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#059669',
              color: '#ffffff',
              border: '1px solid #34d399',
              borderRadius: '8px',
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(16, 185, 129, 0.35)',
              transition: 'all 0.2s ease'
            }}
            title="Download complete 20-day backtest report with trade triggers & outcomes in Excel format"
          >
            <Download size={14} />
            <span>20D Backtest</span>
          </button>

          <button
            onClick={handleDownloadBacktest100D}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#0284c7',
              color: '#ffffff',
              border: '1px solid #38bdf8',
              borderRadius: '8px',
              padding: '8px 14px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              boxShadow: '0 2px 10px rgba(2, 132, 199, 0.35)',
              transition: 'all 0.2s ease'
            }}
            title="Download full 100-day backtest report with all 53 trade triggers & outcomes in Excel format"
          >
            <Download size={14} />
            <span>100D Backtest Excel</span>
          </button>

          <button
            onClick={() => fetchResults(true)}
            disabled={isScanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isScanning ? '#1e293b' : '#db2777',
              color: '#ffffff',
              border: '1px solid #f472b6',
              borderRadius: '8px',
              padding: '8px 16px',
              fontWeight: 700,
              fontSize: '12px',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              boxShadow: '0 2px 10px rgba(219, 39, 119, 0.4)',
              transition: 'all 0.2s ease'
            }}
          >
            <RefreshCw size={14} className={isScanning ? 'animate-spin' : ''} />
            <span>{isScanning ? 'Scanning 110+ Universe...' : 'Rescan All'}</span>
          </button>
        </div>
      </div>

      {/* TOP SUMMARY METRIC CARDS */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '12px'
      }}>
        {/* Total Monitored */}
        <div style={{
          backgroundColor: '#121726',
          borderRadius: '10px',
          padding: '14px 18px',
          border: '1px solid #1f273d',
          boxShadow: '0 2px 10px rgba(0,0,0,0.3)'
        }}>
          <div style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase' }}>
            Monitored Universe
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f8fafc', marginTop: '4px' }}>
            {summary.totalScanned || items.length} <span style={{ fontSize: '12px', color: '#64748b', fontWeight: 500 }}>Instruments</span>
          </div>
          <div style={{ fontSize: '11px', color: '#38bdf8', marginTop: '4px' }}>
            Indices, MCX & Top F&O Stocks
          </div>
        </div>

        {/* Active Coils */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'ACTIVE_COIL' ? 'ALL' : 'ACTIVE_COIL')}
          style={{
            backgroundColor: statusFilter === 'ACTIVE_COIL' ? 'rgba(234, 179, 8, 0.15)' : '#121726',
            borderRadius: '10px',
            padding: '14px 18px',
            border: '1px solid ' + (statusFilter === 'ACTIVE_COIL' ? '#eab308' : '#2a2717'),
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '11px', color: '#fde047', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Zap size={13} /> Active Coils (Day 3 Inside)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#facc15', marginTop: '4px' }}>
            {summary.activeCoilCount} <span style={{ fontSize: '12px', color: '#ca8a04', fontWeight: 500 }}>Setups</span>
          </div>
          <div style={{ fontSize: '11px', color: '#eab308', marginTop: '4px' }}>
            Compressed & ready to break out
          </div>
        </div>

        {/* Ultra Coils */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'ULTRA_COIL' ? 'ALL' : 'ULTRA_COIL')}
          style={{
            backgroundColor: statusFilter === 'ULTRA_COIL' ? 'rgba(168, 85, 247, 0.15)' : '#121726',
            borderRadius: '10px',
            padding: '14px 18px',
            border: '1px solid ' + (statusFilter === 'ULTRA_COIL' ? '#a855f7' : '#261b36'),
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '11px', color: '#c084fc', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Sparkles size={13} /> Ultra-Coil (VA & Range)
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#d8b4fe', marginTop: '4px' }}>
            {summary.ultraCoilCount} <span style={{ fontSize: '12px', color: '#a855f7', fontWeight: 500 }}>Setups</span>
          </div>
          <div style={{ fontSize: '11px', color: '#c084fc', marginTop: '4px' }}>
            Both VA & Range swallowed
          </div>
        </div>

        {/* Bullish Breakouts */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'BREAKOUT_BULLISH' ? 'ALL' : 'BREAKOUT_BULLISH')}
          style={{
            backgroundColor: statusFilter === 'BREAKOUT_BULLISH' ? 'rgba(16, 185, 129, 0.15)' : '#121726',
            borderRadius: '10px',
            padding: '14px 18px',
            border: '1px solid ' + (statusFilter === 'BREAKOUT_BULLISH' ? '#10b981' : '#172e25'),
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '11px', color: '#6ee7b7', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingUp size={13} /> Bullish Breakout
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#34d399', marginTop: '4px' }}>
            {summary.bullishBreakoutCount} <span style={{ fontSize: '12px', color: '#059669', fontWeight: 500 }}>Active</span>
          </div>
          <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px' }}>
            Trading above Day 1/2 VAH
          </div>
        </div>

        {/* Bearish Breakdowns */}
        <div 
          onClick={() => setStatusFilter(statusFilter === 'BREAKOUT_BEARISH' ? 'ALL' : 'BREAKOUT_BEARISH')}
          style={{
            backgroundColor: statusFilter === 'BREAKOUT_BEARISH' ? 'rgba(239, 68, 68, 0.15)' : '#121726',
            borderRadius: '10px',
            padding: '14px 18px',
            border: '1px solid ' + (statusFilter === 'BREAKOUT_BEARISH' ? '#ef4444' : '#331818'),
            cursor: 'pointer',
            transition: 'all 0.2s'
          }}
        >
          <div style={{ fontSize: '11px', color: '#fca5a5', fontWeight: 700, textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <TrendingDown size={13} /> Bearish Breakdown
          </div>
          <div style={{ fontSize: '24px', fontWeight: 800, color: '#f87171', marginTop: '4px' }}>
            {summary.bearishBreakoutCount} <span style={{ fontSize: '12px', color: '#dc2626', fontWeight: 500 }}>Active</span>
          </div>
          <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px' }}>
            Trading below Day 1/2 VAL
          </div>
        </div>
      </div>

      {/* 20-DAY & 100-DAY BACKTEST EXECUTIVE BANNER */}
      <div style={{
        backgroundColor: '#0f172a',
        border: '1px solid #1e293b',
        borderRadius: '10px',
        padding: '12px 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <FileSpreadsheet size={24} color="#38bdf8" />
          <div>
            <div style={{ fontSize: '13px', fontWeight: 800, color: '#f8fafc' }}>
              📊 Backtest Performance: <span style={{ color: '#34d399' }}>80% Win Rate (20 Days)</span> • <span style={{ color: '#38bdf8' }}>53 Trades (100 Days)</span>
            </div>
            <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
              20-Day recent market: 12 Wins / 3 Losses (80% Win Rate). 100-Day multi-month audit: 79 Setups, 53 Triggered trades, 7 Target hits (up to +2.58% intraday).
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={handleDownloadBacktest}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              color: '#34d399',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '6px',
              padding: '7px 12px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Download the 20-day backtest report (.xlsx)"
          >
            <Download size={13} />
            <span>20D Backtest (.xlsx)</span>
          </button>
          <button
            onClick={handleDownloadBacktest100D}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: 'rgba(2, 132, 199, 0.15)',
              color: '#38bdf8',
              border: '1px solid rgba(56, 189, 248, 0.4)',
              borderRadius: '6px',
              padding: '7px 12px',
              fontSize: '11.5px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s'
            }}
            title="Download the full 100-day backtest report with all 53 trades (.xlsx)"
          >
            <Download size={13} />
            <span>100D Backtest (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* FILTER & SEARCH CONTROLS */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '10px 14px',
        backgroundColor: '#121726',
        borderRadius: '10px',
        border: '1px solid #20293d',
        gap: '10px'
      }}>
        {/* Status Filter Pills */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All Matches (${items.length})` },
            { id: 'ACTIVE_COIL', label: `⚡ Active Coils (${summary.activeCoilCount})` },
            { id: 'ULTRA_COIL', label: `🔮 Ultra-Coil (${summary.ultraCoilCount})` },
            { id: 'BREAKOUT_BULLISH', label: `🚀 Bullish (${summary.bullishBreakoutCount})` },
            { id: 'BREAKOUT_BEARISH', label: `🔻 Bearish (${summary.bearishBreakoutCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              style={{
                backgroundColor: statusFilter === tab.id ? '#2563eb' : '#182033',
                color: statusFilter === tab.id ? '#ffffff' : '#94a3b8',
                border: '1px solid ' + (statusFilter === tab.id ? '#3b82f6' : '#27344f'),
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Sector and Search Filter */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <select
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value as any)}
            style={{
              backgroundColor: '#182033',
              color: '#cbd5e1',
              border: '1px solid #27344f',
              padding: '6px 10px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              outline: 'none'
            }}
          >
            <option value="ALL">All Segments</option>
            <option value="Index">Indices</option>
            <option value="Commodity">Commodities (MCX)</option>
            <option value="Equity / F&O">Equities / F&O</option>
          </select>

          <div style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                backgroundColor: '#182033',
                color: '#f8fafc',
                border: '1px solid #27344f',
                padding: '6px 12px 6px 30px',
                borderRadius: '6px',
                fontSize: '12px',
                outline: 'none',
                width: '160px'
              }}
            />
          </div>
        </div>
      </div>

      {/* MAIN TWO-COLUMN SPLIT: LEFT LIST / RIGHT DEEP DIVE */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: '14px', alignItems: 'start' }}>
        
        {/* LEFT LIST: MATCHED STOCKS */}
        <div style={{
          backgroundColor: '#111624',
          borderRadius: '12px',
          border: '1px solid #1f273d',
          padding: '12px',
          maxHeight: 'calc(100vh - 270px)',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          {loading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: '#94a3b8' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
              <div>Running Market Profile 3-Day Pattern Scanner...</div>
            </div>
          ) : filteredItems.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: '#94a3b8' }}>
              <Compass size={28} style={{ margin: '0 auto 10px', opacity: 0.5 }} />
              <div style={{ fontWeight: 700, fontSize: '13px', color: '#cbd5e1' }}>No matching 3-day compression setups right now</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                Try clicking "Rescan All" or changing the status filter above.
              </div>
            </div>
          ) : (
            filteredItems.map(item => {
              const isSelected = activeSelectedItem?.symbol === item.symbol;
              const isUltra = item.insideType === 'ULTRA_COIL';
              const isBull = item.status === 'BREAKOUT_BULLISH';
              const isBear = item.status === 'BREAKOUT_BEARISH';

              return (
                <div
                  key={item.symbol}
                  onClick={() => setSelectedItem(item)}
                  style={{
                    backgroundColor: isSelected ? '#192238' : '#141a2b',
                    borderRadius: '8px',
                    padding: '12px 14px',
                    border: '1px solid ' + (isSelected ? '#3b82f6' : '#222c42'),
                    cursor: 'pointer',
                    transition: 'all 0.15s ease',
                    boxShadow: isSelected ? '0 2px 12px rgba(59, 130, 246, 0.25)' : 'none'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: '#f8fafc' }}>
                        {item.cleanName}
                      </span>
                      <span style={{ fontSize: '10px', color: '#94a3b8', backgroundColor: '#1c2438', padding: '1px 6px', borderRadius: '4px' }}>
                        {item.sector}
                      </span>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 800, fontSize: '14px', color: '#f8fafc' }}>
                        ₹{item.currentPrice?.toLocaleString()}
                      </span>
                      <span style={{
                        marginLeft: '6px',
                        fontSize: '11px',
                        fontWeight: 700,
                        color: item.changePct >= 0 ? '#34d399' : '#f87171'
                      }}>
                        {item.changePct >= 0 ? '+' : ''}{item.changePct}%
                      </span>
                    </div>
                  </div>

                  {/* Status & Compression Badges */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', flexWrap: 'wrap' }}>
                    <span style={{
                      fontSize: '10.5px',
                      fontWeight: 800,
                      padding: '2px 8px',
                      borderRadius: '4px',
                      backgroundColor: isBull ? 'rgba(16, 185, 129, 0.15)' : (isBear ? 'rgba(239, 68, 68, 0.15)' : 'rgba(234, 179, 8, 0.15)'),
                      color: isBull ? '#34d399' : (isBear ? '#f87171' : '#facc15'),
                      border: '1px solid ' + (isBull ? 'rgba(16, 185, 129, 0.4)' : (isBear ? 'rgba(239, 68, 68, 0.4)' : 'rgba(234, 179, 8, 0.4)'))
                    }}>
                      {item.statusText}
                    </span>

                    {isUltra && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 800,
                        padding: '2px 6px',
                        borderRadius: '4px',
                        backgroundColor: 'rgba(168, 85, 247, 0.2)',
                        color: '#d8b4fe',
                        border: '1px solid rgba(168, 85, 247, 0.4)'
                      }}>
                        🔮 ULTRA COIL
                      </span>
                    )}

                    <span style={{ fontSize: '10.5px', color: '#94a3b8', marginLeft: 'auto' }}>
                      Coil Ratio: <strong style={{ color: '#38bdf8' }}>{item.compressionRatio}%</strong>
                    </span>
                  </div>

                  {/* Range Progression: Day 1 -> Day 2 -> Day 3 */}
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    marginTop: '8px',
                    padding: '6px 8px',
                    backgroundColor: '#0e1320',
                    borderRadius: '5px',
                    fontSize: '10.5px',
                    color: '#94a3b8'
                  }}>
                    <span>D1: <strong>₹{item.day1.range}</strong></span>
                    <span>➔</span>
                    <span>D2: <strong>₹{item.day2.range}</strong></span>
                    <span>➔</span>
                    <span>D3: <strong style={{ color: '#facc15' }}>₹{item.day3.range}</strong></span>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* RIGHT DEEP DIVE: INTERACTIVE 3-DAY VISUALIZER & EXECUTION MATRIX */}
        {activeSelectedItem ? (
          <div style={{
            backgroundColor: '#111624',
            borderRadius: '12px',
            border: '1px solid #1f273d',
            padding: '18px 20px',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Top Symbol Banner */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '10px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 800, color: '#f8fafc' }}>
                    {activeSelectedItem.cleanName}
                  </h2>
                  <span style={{ fontSize: '11px', color: '#94a3b8', backgroundColor: '#1c2438', padding: '2px 8px', borderRadius: '4px' }}>
                    {activeSelectedItem.symbol}
                  </span>
                  <span style={{
                    fontSize: '11px',
                    fontWeight: 800,
                    padding: '2px 8px',
                    borderRadius: '4px',
                    backgroundColor: activeSelectedItem.insideType === 'ULTRA_COIL' ? 'rgba(168, 85, 247, 0.2)' : 'rgba(56, 189, 248, 0.2)',
                    color: activeSelectedItem.insideType === 'ULTRA_COIL' ? '#d8b4fe' : '#38bdf8'
                  }}>
                    {activeSelectedItem.insideType}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>
                  {activeSelectedItem.statusText} • 3-Day Compression Ratio: <strong>{activeSelectedItem.compressionRatio}%</strong>
                </div>
              </div>

              {/* Navigation Action Buttons */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => onSwitchToMarketProfile && onSwitchToMarketProfile(activeSelectedItem.symbol)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: '1px solid #38bdf8',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Open full interactive Market Profile chart with Dalton letters"
                >
                  <Compass size={13} /> Full Market Profile
                </button>

                <button
                  onClick={() => onSwitchToChart && onSwitchToChart(activeSelectedItem.symbol)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px',
                    backgroundColor: '#1e293b',
                    color: '#38bdf8',
                    border: '1px solid #38bdf8',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontSize: '11.5px',
                    fontWeight: 700,
                    cursor: 'pointer'
                  }}
                  title="Open Candlestick Chart"
                >
                  <BarChart2 size={13} /> Candlestick Chart
                </button>
              </div>
            </div>

            {/* ACTIONABLE EXECUTION PLAN CALLOUT */}
            <div style={{
              backgroundColor: '#141c2e',
              border: '1px solid #273754',
              borderRadius: '8px',
              padding: '12px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#f8fafc', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Target size={14} color="#f472b6" /> ACTIONABLE EXECUTION PLAN:
              </div>
              <div style={{ fontSize: '13px', fontWeight: 700, color: '#facc15' }}>
                {activeSelectedItem.action}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '4px' }}>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  🚀 <strong>Bullish Trigger:</strong> Buy &gt; ₹{activeSelectedItem.breakoutTriggerHigh} (Target 1: ₹{activeSelectedItem.target1Bullish} • Target 2: ₹{activeSelectedItem.target2Bullish})
                </div>
                <div style={{ fontSize: '11px', color: '#94a3b8' }}>
                  🔻 <strong>Bearish Trigger:</strong> Sell &lt; ₹{activeSelectedItem.breakoutTriggerLow} (Target 1: ₹{activeSelectedItem.target1Bearish} • Target 2: ₹{activeSelectedItem.target2Bearish})
                </div>
              </div>
            </div>

            {/* 3-DAY MARKET PROFILE COMPRESSION VISUAL CONE GRAPHIC */}
            <div style={{
              backgroundColor: '#0c0f17',
              borderRadius: '10px',
              border: '1px solid #1e2638',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <div style={{ fontSize: '12px', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                📊 3-Day Market Profile Compression Geometry (Value Area &amp; Range Tightening)
              </div>

              {/* Graphic Columns: Day 1, Day 2, Day 3 Side-by-Side */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr 1fr',
                gap: '16px',
                marginTop: '10px'
              }}>
                {/* DAY 1 COLUMN */}
                <div style={{
                  backgroundColor: '#131929',
                  border: '1px solid #283552',
                  borderRadius: '8px',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#38bdf8' }}>DAY 1: EXPANSION</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{activeSelectedItem.day1.dateStr}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '8px' }}>
                    Range: <strong style={{ color: '#f8fafc' }}>₹{activeSelectedItem.day1.range}</strong>
                    <span style={{ color: '#34d399', marginLeft: '6px' }}>(&gt; 5-Day Max ₹{activeSelectedItem.prior5MaxRange})</span>
                  </div>

                  {/* Level Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>High:</span> <span>₹{activeSelectedItem.day1.dayHigh}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c084fc', fontWeight: 700 }}>
                      <span>VAH (70%):</span> <span>₹{activeSelectedItem.day1.vahPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171', fontWeight: 700 }}>
                      <span>POC:</span> <span>₹{activeSelectedItem.day1.pocPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#c084fc', fontWeight: 700 }}>
                      <span>VAL (70%):</span> <span>₹{activeSelectedItem.day1.valPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Low:</span> <span>₹{activeSelectedItem.day1.dayLow}</span>
                    </div>
                  </div>
                </div>

                {/* DAY 2 COLUMN */}
                <div style={{
                  backgroundColor: '#161d2e',
                  border: '1px solid #eab308',
                  borderRadius: '8px',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#facc15' }}>DAY 2: INSIDE VA</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{activeSelectedItem.day2.dateStr}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '8px' }}>
                    Range: <strong style={{ color: '#f8fafc' }}>₹{activeSelectedItem.day2.range}</strong>
                    <span style={{ color: '#eab308', marginLeft: '6px' }}>(VA Inside D1)</span>
                  </div>

                  {/* Level Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>High:</span> <span>₹{activeSelectedItem.day2.dayHigh}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#facc15', fontWeight: 700 }}>
                      <span>VAH (Inside D1):</span> <span>₹{activeSelectedItem.day2.vahPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171', fontWeight: 700 }}>
                      <span>POC:</span> <span>₹{activeSelectedItem.day2.pocPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#facc15', fontWeight: 700 }}>
                      <span>VAL (Inside D1):</span> <span>₹{activeSelectedItem.day2.valPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Low:</span> <span>₹{activeSelectedItem.day2.dayLow}</span>
                    </div>
                  </div>
                </div>

                {/* DAY 3 COLUMN */}
                <div style={{
                  backgroundColor: '#1a182c',
                  border: '1px solid #ec4899',
                  borderRadius: '8px',
                  padding: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 800, color: '#f472b6' }}>DAY 3: INSIDE DAY 2</span>
                    <span style={{ fontSize: '11px', color: '#94a3b8' }}>{activeSelectedItem.day3.dateStr}</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#cbd5e1', marginBottom: '8px' }}>
                    Range: <strong style={{ color: '#f472b6' }}>₹{activeSelectedItem.day3.range}</strong>
                    <span style={{ color: '#f472b6', marginLeft: '6px' }}>({activeSelectedItem.compressionRatio}% of D1)</span>
                  </div>

                  {/* Level Bars */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '10.5px', fontFamily: 'monospace' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>High:</span> <span>₹{activeSelectedItem.day3.dayHigh}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f472b6', fontWeight: 700 }}>
                      <span>VAH (Inside D2):</span> <span>₹{activeSelectedItem.day3.vahPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f87171', fontWeight: 700 }}>
                      <span>POC:</span> <span>₹{activeSelectedItem.day3.pocPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#f472b6', fontWeight: 700 }}>
                      <span>VAL (Inside D2):</span> <span>₹{activeSelectedItem.day3.valPrice}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1' }}>
                      <span>Low:</span> <span>₹{activeSelectedItem.day3.dayLow}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* PRIOR 5-DAYS COMPARATIVE CONTEXT TABLE */}
            <div style={{
              backgroundColor: '#0c0f17',
              borderRadius: '8px',
              border: '1px solid #1e2638',
              padding: '12px 16px'
            }}>
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: '#94a3b8', marginBottom: '8px' }}>
                PRIOR 5 TRADING DAYS RANGE COMPARISON (BEFORE DAY 1 EXPANSION):
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px', textAlign: 'center' }}>
                {activeSelectedItem.prior5.map((p, idx) => (
                  <div key={idx} style={{ backgroundColor: '#131929', padding: '6px', borderRadius: '5px', fontSize: '10.5px' }}>
                    <div style={{ color: '#64748b' }}>{p.date}</div>
                    <div style={{ fontWeight: 800, color: '#cbd5e1', marginTop: '2px' }}>₹{p.range}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '11px', color: '#10b981', marginTop: '8px', textAlign: 'right' }}>
                ✓ Day 1 Range (₹{activeSelectedItem.day1.range}) is <strong>+{activeSelectedItem.rangeExpansionPct}%</strong> larger than the prior 5-day maximum (₹{activeSelectedItem.prior5MaxRange}).
              </div>
            </div>

          </div>
        ) : (
          <div style={{
            backgroundColor: '#111624',
            borderRadius: '12px',
            border: '1px solid #1f273d',
            padding: '40px',
            textAlign: 'center',
            color: '#64748b'
          }}>
            Select a stock setup from the left list to view detailed Market Profile 3-Day geometry & breakout targets.
          </div>
        )}
      </div>
    </div>
  );
};
