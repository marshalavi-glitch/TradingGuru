import React, { useState, useEffect, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import type { Candle } from '../utils/profileCalculator';
import { RefreshCw, Filter, ArrowUpRight, ArrowDownRight, Layers, BarChart2, PieChart, Activity, Zap, Search } from 'lucide-react';

interface HeatMapContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

export interface StockHeatData {
  symbol: string;
  name: string;
  sector: string;
  price: number;
  changePct: number;
  changeAmount: number;
  open: number;
  high: number;
  low: number;
  volume: number;
  prevClose: number;
}

export interface SectorSummary {
  name: string;
  key: string;
  avgChangePct: number;
  gainersCount: number;
  losersCount: number;
  totalCount: number;
  totalVolume: number;
  topGainer: string;
  topLoser: string;
}

export const SECTOR_MAP: Record<string, { name: string; key: string; icon: string; symbols: { symbol: string; name: string }[] }> = {
  ALL: {
    name: '🌐 All Sectors (Full Market Heatmap)',
    key: 'ALL',
    icon: '🌐',
    symbols: []
  },
  BANKING: {
    name: '🏦 NIFTY BANK / Banking & Financials',
    key: 'BANKING',
    icon: '🏦',
    symbols: [
      { symbol: 'NSE:HDFCBANK', name: 'HDFC Bank' },
      { symbol: 'NSE:ICICIBANK', name: 'ICICI Bank' },
      { symbol: 'NSE:SBIN', name: 'State Bank of India' },
      { symbol: 'NSE:KOTAKBANK', name: 'Kotak Mahindra Bank' },
      { symbol: 'NSE:AXISBANK', name: 'Axis Bank' },
      { symbol: 'NSE:INDUSINDBK', name: 'IndusInd Bank' },
      { symbol: 'NSE:PNB', name: 'Punjab National Bank' },
      { symbol: 'NSE:BANKBARODA', name: 'Bank of Baroda' },
      { symbol: 'NSE:FEDERALBNK', name: 'Federal Bank' },
      { symbol: 'NSE:IDFCFIRSTB', name: 'IDFC First Bank' },
      { symbol: 'NSE:BAJFINANCE', name: 'Bajaj Finance' },
      { symbol: 'NSE:BAJAJFINSV', name: 'Bajaj Finserv' },
      { symbol: 'NSE:SHRIRAMFIN', name: 'Shriram Finance' },
      { symbol: 'NSE:MUTHOOTFIN', name: 'Muthoot Finance' }
    ]
  },
  IT: {
    name: '💻 NIFTY IT / Technology',
    key: 'IT',
    icon: '💻',
    symbols: [
      { symbol: 'NSE:TCS', name: 'Tata Consultancy Services' },
      { symbol: 'NSE:INFY', name: 'Infosys Ltd' },
      { symbol: 'NSE:HCLTECH', name: 'HCL Technologies' },
      { symbol: 'NSE:WIPRO', name: 'Wipro Ltd' },
      { symbol: 'NSE:TECHM', name: 'Tech Mahindra' },
      { symbol: 'NSE:LTIM', name: 'LTIMindtree' },
      { symbol: 'NSE:COFORGE', name: 'Coforge Ltd' },
      { symbol: 'NSE:PERSISTENT', name: 'Persistent Systems' },
      { symbol: 'NSE:MPHASIS', name: 'Mphasis Ltd' },
      { symbol: 'NSE:LTTS', name: 'L&T Technology Services' }
    ]
  },
  AUTO: {
    name: '🚗 NIFTY AUTO / Automobiles',
    key: 'AUTO',
    icon: '🚗',
    symbols: [
      { symbol: 'NSE:TATAMOTORS', name: 'Tata Motors' },
      { symbol: 'NSE:M&M', name: 'Mahindra & Mahindra' },
      { symbol: 'NSE:MARUTI', name: 'Maruti Suzuki' },
      { symbol: 'NSE:BAJAJ-AUTO', name: 'Bajaj Auto' },
      { symbol: 'NSE:HEROMOTOCO', name: 'Hero MotoCorp' },
      { symbol: 'NSE:EICHERMOT', name: 'Eicher Motors' },
      { symbol: 'NSE:BOSCHLTD', name: 'Bosch Ltd' },
      { symbol: 'NSE:TVSMOTOR', name: 'TVS Motor Company' },
      { symbol: 'NSE:TIINDIA', name: 'Tube Investments' },
      { symbol: 'NSE:BHARATFORG', name: 'Bharat Forge' }
    ]
  },
  ENERGY: {
    name: '⚡ NIFTY ENERGY / Oil, Gas & Power',
    key: 'ENERGY',
    icon: '⚡',
    symbols: [
      { symbol: 'NSE:RELIANCE', name: 'Reliance Industries' },
      { symbol: 'NSE:NTPC', name: 'NTPC Ltd' },
      { symbol: 'NSE:POWERGRID', name: 'Power Grid Corp' },
      { symbol: 'NSE:ONGC', name: 'ONGC Ltd' },
      { symbol: 'NSE:BPCL', name: 'Bharat Petroleum' },
      { symbol: 'NSE:IOC', name: 'Indian Oil Corp' },
      { symbol: 'NSE:COALINDIA', name: 'Coal India' },
      { symbol: 'NSE:ADANIENT', name: 'Adani Enterprises' },
      { symbol: 'NSE:ADANIPORTS', name: 'Adani Ports' },
      { symbol: 'NSE:TATAPOWER', name: 'Tata Power' },
      { symbol: 'NSE:GAIL', name: 'GAIL India' }
    ]
  },
  PHARMA: {
    name: '💊 NIFTY PHARMA / Healthcare',
    key: 'PHARMA',
    icon: '💊',
    symbols: [
      { symbol: 'NSE:SUNPHARMA', name: 'Sun Pharma' },
      { symbol: 'NSE:DRREDDY', name: 'Dr Reddys Lab' },
      { symbol: 'NSE:CIPLA', name: 'Cipla Ltd' },
      { symbol: 'NSE:DIVISLAB', name: 'Divis Laboratories' },
      { symbol: 'NSE:APOLLOHOSP', name: 'Apollo Hospitals' },
      { symbol: 'NSE:LUPIN', name: 'Lupin Ltd' },
      { symbol: 'NSE:MANKIND', name: 'Mankind Pharma' },
      { symbol: 'NSE:TORNTPHARM', name: 'Torrent Pharma' },
      { symbol: 'NSE:ZYDUSLIFE', name: 'Zydus Lifesciences' },
      { symbol: 'NSE:BIOCON', name: 'Biocon Ltd' }
    ]
  },
  FMCG: {
    name: '🛒 NIFTY FMCG / Consumer Goods',
    key: 'FMCG',
    icon: '🛒',
    symbols: [
      { symbol: 'NSE:ITC', name: 'ITC Ltd' },
      { symbol: 'NSE:HINDUNILVR', name: 'Hindustan Unilever' },
      { symbol: 'NSE:NESTLEIND', name: 'Nestle India' },
      { symbol: 'NSE:BRITANNIA', name: 'Britannia Industries' },
      { symbol: 'NSE:TATACONSUM', name: 'Tata Consumer Products' },
      { symbol: 'NSE:VBL', name: 'Varun Beverages' },
      { symbol: 'NSE:DABUR', name: 'Dabur India' },
      { symbol: 'NSE:GODREJCP', name: 'Godrej Consumer' },
      { symbol: 'NSE:COLPAL', name: 'Colgate-Palmolive' },
      { symbol: 'NSE:MARICO', name: 'Marico Ltd' }
    ]
  },
  METAL: {
    name: '🧱 NIFTY METAL / Metals & Mining',
    key: 'METAL',
    icon: '🧱',
    symbols: [
      { symbol: 'NSE:TATASTEEL', name: 'Tata Steel' },
      { symbol: 'NSE:JSWSTEEL', name: 'JSW Steel' },
      { symbol: 'NSE:HINDALCO', name: 'Hindalco Industries' },
      { symbol: 'NSE:VEDL', name: 'Vedanta Ltd' },
      { symbol: 'NSE:JINDALSTEL', name: 'Jindal Steel & Power' },
      { symbol: 'NSE:NMDC', name: 'NMDC Ltd' },
      { symbol: 'NSE:NATIONALUM', name: 'National Aluminium' },
      { symbol: 'NSE:SAIL', name: 'Steel Authority of India' }
    ]
  },
  INFRA_REALTY: {
    name: '🏗️ NIFTY INFRA & REALTY / Infrastructure & Real Estate',
    key: 'INFRA_REALTY',
    icon: '🏗️',
    symbols: [
      { symbol: 'NSE:LT', name: 'Larsen & Toubro' },
      { symbol: 'NSE:DLF', name: 'DLF Ltd' },
      { symbol: 'NSE:LODHA', name: 'Macrotech Developers' },
      { symbol: 'NSE:GODREJPROP', name: 'Godrej Properties' },
      { symbol: 'NSE:OBEROIRLTY', name: 'Oberoi Realty' },
      { symbol: 'NSE:ULTRACEMCO', name: 'UltraTech Cement' },
      { symbol: 'NSE:GRASIM', name: 'Grasim Industries' },
      { symbol: 'NSE:AMBUJACEM', name: 'Ambuja Cements' },
      { symbol: 'NSE:ACC', name: 'ACC Ltd' }
    ]
  },
  TELECOM: {
    name: '📱 NIFTY TELECOM / Telecom & Media',
    key: 'TELECOM',
    icon: '📱',
    symbols: [
      { symbol: 'NSE:BHARTIARTL', name: 'Bharti Airtel' },
      { symbol: 'NSE:IDEA', name: 'Vodafone Idea' },
      { symbol: 'NSE:SUNTV', name: 'Sun TV Network' },
      { symbol: 'NSE:ZEEL', name: 'Zee Entertainment' }
    ]
  }
};

// Build ALL symbols array
SECTOR_MAP.ALL.symbols = Object.keys(SECTOR_MAP)
  .filter(k => k !== 'ALL')
  .flatMap(k => SECTOR_MAP[k].symbols);

export const HeatMapContainer: React.FC<HeatMapContainerProps> = ({ onSymbolSelect, onSwitchToChart }) => {
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [sortBy, setSortBy] = useState<'changeDesc' | 'changeAsc' | 'volumeDesc' | 'alpha'>('changeDesc');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [viewMode, setViewMode] = useState<'tiles' | 'summary'>('tiles');
  const [stockData, setStockData] = useState<StockHeatData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedStock, setSelectedStock] = useState<StockHeatData | null>(null);

  // Fetch real-time market candles for symbols in selected sector
  const fetchHeatMapData = async () => {
    setLoading(true);
    const backendHttp = getBackendHttpUrl();
    const activeSymbols = SECTOR_MAP[selectedSector]?.symbols || [];
    const results: StockHeatData[] = [];

    // Parallel fetch with concurrency chunking
    const chunkSize = 5;
    for (let i = 0; i < activeSymbols.length; i += chunkSize) {
      const chunk = activeSymbols.slice(i, i + chunkSize);
      await Promise.all(
        chunk.map(async (item) => {
          try {
            const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(item.symbol)}&timeframe=D&limit=5`);
            if (res.ok) {
              const data = await res.json();
              if (data.candles && data.candles.length > 0) {
                const candles: Candle[] = data.candles;
                const latest = candles[candles.length - 1];
                const prev = candles.length > 1 ? candles[candles.length - 2] : candles[0];

                const changeAmount = latest.close - prev.close;
                const changePct = prev.close !== 0 ? (changeAmount / prev.close) * 100 : 0;

                // Find sector name
                let sectorName = 'Other';
                for (const key of Object.keys(SECTOR_MAP)) {
                  if (key !== 'ALL' && SECTOR_MAP[key].symbols.some(s => s.symbol === item.symbol)) {
                    sectorName = SECTOR_MAP[key].name.split('/')[0].trim();
                    break;
                  }
                }

                results.push({
                  symbol: item.symbol,
                  name: item.name,
                  sector: sectorName,
                  price: latest.close,
                  changePct,
                  changeAmount,
                  open: latest.open,
                  high: latest.high,
                  low: latest.low,
                  volume: latest.volume || 100000,
                  prevClose: prev.close
                });
              }
            }
          } catch (e) {
            // Skip failed symbol
          }
        })
      );
    }

    setStockData(results);
    setLoading(false);
  };

  useEffect(() => {
    fetchHeatMapData();
  }, [selectedSector]);

  // Filtered & Sorted Stock List
  const processedStocks = useMemo(() => {
    let list = [...stockData];

    if (searchFilter.trim()) {
      const query = searchFilter.toLowerCase();
      list = list.filter(s => s.symbol.toLowerCase().includes(query) || s.name.toLowerCase().includes(query));
    }

    if (sortBy === 'changeDesc') {
      list.sort((a, b) => b.changePct - a.changePct);
    } else if (sortBy === 'changeAsc') {
      list.sort((a, b) => a.changePct - b.changePct);
    } else if (sortBy === 'volumeDesc') {
      list.sort((a, b) => b.volume - a.volume);
    } else if (sortBy === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  }, [stockData, sortBy, searchFilter]);

  // Sector Performance Summary Analysis
  const sectorSummaries = useMemo<SectorSummary[]>(() => {
    const keys = Object.keys(SECTOR_MAP).filter(k => k !== 'ALL');
    return keys.map((key) => {
      const sec = SECTOR_MAP[key];
      const items = stockData.filter(s => sec.symbols.some(item => item.symbol === s.symbol));
      
      if (items.length === 0) {
        return {
          name: sec.name,
          key,
          avgChangePct: 0,
          gainersCount: 0,
          losersCount: 0,
          totalCount: 0,
          totalVolume: 0,
          topGainer: '-',
          topLoser: '-'
        };
      }

      const totalChange = items.reduce((acc, s) => acc + s.changePct, 0);
      const avgChangePct = totalChange / items.length;
      const gainersCount = items.filter(s => s.changePct > 0).length;
      const losersCount = items.filter(s => s.changePct < 0).length;
      const totalVolume = items.reduce((acc, s) => acc + s.volume, 0);

      const sortedByGain = [...items].sort((a, b) => b.changePct - a.changePct);
      const topGainer = sortedByGain[0] ? `${sortedByGain[0].name} (${sortedByGain[0].changePct > 0 ? '+' : ''}${sortedByGain[0].changePct.toFixed(2)}%)` : '-';
      const topLoser = sortedByGain[sortedByGain.length - 1] ? `${sortedByGain[sortedByGain.length - 1].name} (${sortedByGain[sortedByGain.length - 1].changePct.toFixed(2)}%)` : '-';

      return {
        name: sec.name,
        key,
        avgChangePct,
        gainersCount,
        losersCount,
        totalCount: items.length,
        totalVolume,
        topGainer,
        topLoser
      };
    }).sort((a, b) => b.avgChangePct - a.avgChangePct);
  }, [stockData]);

  // Helper function for Heatmap Tile Background Color
  const getTileBackgroundColor = (pct: number) => {
    if (pct >= 4.0) return 'linear-gradient(135deg, #15803d, #16a34a)';
    if (pct >= 2.0) return 'linear-gradient(135deg, #166534, #15803d)';
    if (pct >= 0.5) return 'linear-gradient(135deg, #14532d, #166534)';
    if (pct > -0.5 && pct < 0.5) return 'linear-gradient(135deg, #334155, #1e293b)';
    if (pct <= -4.0) return 'linear-gradient(135deg, #7f1d1d, #991b1b)';
    if (pct <= -2.0) return 'linear-gradient(135deg, #991b1b, #b91c1c)';
    return 'linear-gradient(135deg, #b91c1c, #dc2626)';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', color: '#f1f5f9', paddingBottom: '30px' }}>
      
      {/* HEADER CONTROL BAR */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: '12px',
        padding: '16px 20px',
        flexWrap: 'wrap',
        gap: '14px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #ef4444, #f59e0b)',
            padding: '10px',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)'
          }}>
            <Activity size={22} color="#ffffff" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: '#ffffff', letterSpacing: '0.3px' }}>
              🔥 Sector-Wise Market Heatmap
            </h2>
            <span style={{ fontSize: '12px', color: '#94a3b8' }}>
              Interactive Visual Heatmap & Sector Performance Tracker across Top Indian Equities
            </span>
          </div>
        </div>

        {/* Sector Filter & View Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          
          {/* Sector Selector Dropdown */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#1e293b', padding: '4px 8px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.1)' }}>
            <Filter size={14} color="#38bdf8" />
            <select
              value={selectedSector}
              onChange={(e) => setSelectedSector(e.target.value)}
              style={{
                background: 'transparent',
                color: '#38bdf8',
                border: 'none',
                fontSize: '13px',
                fontWeight: '700',
                cursor: 'pointer',
                outline: 'none',
                maxWidth: '260px'
              }}
            >
              {Object.keys(SECTOR_MAP).map(key => (
                <option key={key} value={key} style={{ background: '#1e293b', color: '#ffffff' }}>
                  {SECTOR_MAP[key].name}
                </option>
              ))}
            </select>
          </div>

          {/* Sort By Dropdown */}
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            style={{
              background: '#1e293b',
              color: '#f8fafc',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <option value="changeDesc">🔥 Top Gainers First</option>
            <option value="changeAsc">📉 Top Losers First</option>
            <option value="volumeDesc">📊 Most Active Volume</option>
            <option value="alpha">🔤 Alphabetical (A-Z)</option>
          </select>

          {/* Search Input */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="#94a3b8" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Search stock..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                background: '#1e293b',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: '8px',
                padding: '6px 10px 6px 30px',
                fontSize: '12px',
                width: '140px'
              }}
            />
          </div>

          {/* View Mode Switcher */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.3)', padding: '4px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setViewMode('tiles')}
              style={{
                background: viewMode === 'tiles' ? '#3b82f6' : 'transparent',
                color: viewMode === 'tiles' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <PieChart size={14} />
              <span>Heatmap</span>
            </button>
            <button
              onClick={() => setViewMode('summary')}
              style={{
                background: viewMode === 'summary' ? '#3b82f6' : 'transparent',
                color: viewMode === 'summary' ? '#ffffff' : '#94a3b8',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '12px',
                fontWeight: '600',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <BarChart2 size={14} />
              <span>Sectors Overview</span>
            </button>
          </div>

          {/* Refresh Button */}
          <button
            onClick={fetchHeatMapData}
            disabled={loading}
            style={{
              background: 'rgba(59, 130, 246, 0.2)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.4)',
              borderRadius: '8px',
              padding: '6px 12px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>

        </div>
      </div>

      {/* QUICK SECTOR SUMMARY METRICS BAR */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px' }}>
        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Active Sector View</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#38bdf8', marginTop: '2px' }}>
            {SECTOR_MAP[selectedSector]?.name.split('/')[0]}
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '10px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Total Stocks Analyzed</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff', marginTop: '2px' }}>
            {processedStocks.length} Symbols
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(34, 197, 94, 0.2)', borderRadius: '10px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Gainers / Advances</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#4ade80', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowUpRight size={16} />
            <span>{processedStocks.filter(s => s.changePct > 0).length} Stocks</span>
          </div>
        </div>

        <div style={{ background: 'rgba(15, 23, 42, 0.75)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '10px', padding: '12px 16px' }}>
          <div style={{ fontSize: '11px', color: '#94a3b8' }}>Losers / Declines</div>
          <div style={{ fontSize: '14px', fontWeight: '700', color: '#f87171', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ArrowDownRight size={16} />
            <span>{processedStocks.filter(s => s.changePct < 0).length} Stocks</span>
          </div>
        </div>
      </div>

      {/* VIEW 1: INTERACTIVE TREEMAP HEATMAP TILE GRID */}
      {viewMode === 'tiles' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          {loading ? (
            <div style={{ height: '350px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b', gap: '10px' }}>
              <RefreshCw size={20} className="spin" />
              <span>Fetching live market prices for {SECTOR_MAP[selectedSector]?.name}...</span>
            </div>
          ) : processedStocks.length === 0 ? (
            <div style={{ height: '200px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
              No stocks found matching filter.
            </div>
          ) : (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))',
              gap: '12px'
            }}>
              {processedStocks.map((stock) => {
                const bg = getTileBackgroundColor(stock.changePct);
                const isSelected = selectedStock?.symbol === stock.symbol;

                return (
                  <div
                    key={stock.symbol}
                    onClick={() => {
                      setSelectedStock(stock);
                      if (onSymbolSelect) onSymbolSelect(stock.symbol);
                    }}
                    style={{
                      background: bg,
                      border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.15)',
                      borderRadius: '10px',
                      padding: '14px',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      justify: 'space-between',
                      gap: '8px',
                      transition: 'all 0.15s ease',
                      boxShadow: isSelected ? '0 0 16px rgba(255,255,255,0.3)' : '0 2px 8px rgba(0,0,0,0.3)',
                      transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ fontSize: '15px', fontWeight: '800', color: '#ffffff', letterSpacing: '0.4px' }}>
                          {stock.symbol.replace('NSE:', '')}
                        </span>
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          background: 'rgba(0,0,0,0.35)',
                          padding: '2px 6px',
                          borderRadius: '4px',
                          color: '#ffffff'
                        }}>
                          {stock.changePct >= 0 ? '+' : ''}{stock.changePct.toFixed(2)}%
                        </span>
                      </div>

                      <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.8)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {stock.name}
                      </div>
                    </div>

                    <div style={{ borderTop: '1px solid rgba(255,255,255,0.15)', paddingTop: '6px' }}>
                      <div style={{ fontSize: '14px', fontWeight: '700', color: '#ffffff' }}>
                        ₹{stock.price.toFixed(2)}
                      </div>
                      <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.7)', marginTop: '1px' }}>
                        Vol: {(stock.volume / 1000).toFixed(0)}k | High: ₹{stock.high.toFixed(1)}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: SECTOR OVERVIEW SUMMARY BARS */}
      {viewMode === 'summary' && (
        <div style={{
          background: 'rgba(15, 23, 42, 0.85)',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          borderRadius: '12px',
          padding: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px'
        }}>
          <h3 style={{ margin: 0, fontSize: '15px', fontWeight: '700', color: '#ffffff' }}>
            📊 All Sector Performance Ranking Summary
          </h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sectorSummaries.map((sec) => (
              <div
                key={sec.key}
                onClick={() => { setSelectedSector(sec.key); setViewMode('tiles'); }}
                style={{
                  background: 'rgba(30, 41, 59, 0.7)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: '10px',
                  padding: '14px 18px',
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  transition: 'all 0.15s'
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontWeight: '700', fontSize: '14px', color: '#ffffff' }}>
                    {sec.name}
                  </div>
                  <div style={{
                    fontSize: '14px',
                    fontWeight: '800',
                    color: sec.avgChangePct >= 0 ? '#4ade80' : '#f87171'
                  }}>
                    {sec.avgChangePct >= 0 ? '+' : ''}{sec.avgChangePct.toFixed(2)}% Avg
                  </div>
                </div>

                {/* Progress bar visualizer */}
                <div style={{ width: '100%', height: '8px', background: '#0f172a', borderRadius: '4px', overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: `${Math.max((sec.gainersCount / (sec.totalCount || 1)) * 100, 2)}%`, background: '#22c55e' }} />
                  <div style={{ width: `${Math.max((sec.losersCount / (sec.totalCount || 1)) * 100, 2)}%`, background: '#ef4444' }} />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8' }}>
                  <span>Advances: <strong style={{ color: '#4ade80' }}>{sec.gainersCount}</strong> | Declines: <strong style={{ color: '#f87171' }}>{sec.losersCount}</strong></span>
                  <span>Top Gainer: <strong style={{ color: '#e2e8f0' }}>{sec.topGainer}</strong></span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SELECTED STOCK QUICK ACTION MODAL / FLOATING DRAWER */}
      {selectedStock && (
        <div style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.95), rgba(15, 23, 42, 0.95))',
          border: '1px solid #3b82f6',
          borderRadius: '12px',
          padding: '16px 20px',
          display: 'flex',
          justify: 'space-between',
          alignItems: 'center',
          boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          <div>
            <div style={{ fontSize: '11px', color: '#94a3b8' }}>Active Selected Symbol from Heatmap:</div>
            <div style={{ fontSize: '16px', fontWeight: '800', color: '#ffffff', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span>{selectedStock.name} ({selectedStock.symbol})</span>
              <span style={{ fontSize: '14px', color: selectedStock.changePct >= 0 ? '#4ade80' : '#f87171' }}>
                ₹{selectedStock.price.toFixed(2)} ({selectedStock.changePct >= 0 ? '+' : ''}{selectedStock.changePct.toFixed(2)}%)
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px' }}>
            {onSwitchToChart && (
              <button
                onClick={onSwitchToChart}
                style={{
                  background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '8px 14px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}
              >
                <span>View Candlestick Chart</span>
                <ArrowUpRight size={14} />
              </button>
            )}
            <button
              onClick={() => setSelectedStock(null)}
              style={{
                background: 'rgba(255,255,255,0.08)',
                color: '#94a3b8',
                border: 'none',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
                cursor: 'pointer'
              }}
            >
              Close
            </button>
          </div>
        </div>
      )}

    </div>
  );
};
