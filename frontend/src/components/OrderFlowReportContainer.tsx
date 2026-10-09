import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  ShieldCheck, ShieldAlert, Lock, RefreshCw, Download, FileSpreadsheet, FileText, 
  Search, Filter, ArrowUpDown, ArrowUp, ArrowDown, ExternalLink, Zap, 
  TrendingUp, TrendingDown, Target, AlertTriangle, CheckCircle2, Clock, 
  BarChart2, Activity, Layers, HelpCircle
} from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { getStoredAuthUser } from './LoginScreen';
import { useTheme } from '../context/ThemeContext';

export interface OrderFlowStockItem {
  symbol: string;
  cleanSymbol: string;
  name: string;
  token: string;
  tradingsymbol: string;
  exchange: string;
  sector: string;
  isFno: boolean;
  ltp: number;
  changePct: number;
  changePts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  r2: number;
  r3: number;
  r4: number;
  r5: number;
  r6: number;
  s2: number;
  s3: number;
  s4: number;
  s5: number;
  s6: number;
  support: number;
  resistance: number;
  breakoutLevel: number;
  breakdownLevel: number;
  momentumHigh: number;
  momentumLow: number;
  buyEntryZone: string;
  sellEntryZone: string;
  targetBullishT1: number;
  targetBullishT2: number;
  targetBearishT1: number;
  targetBearishT2: number;
  stopLossLong: number;
  stopLossShort: number;
  distanceToBreakoutPct: number;
  distanceToBreakdownPct: number;
  distanceToBuyZonePct: number;
  distanceToSellZonePct: number;
  bias: string;
  biasLabel: string;
  biasColor: string;
  actionTag: string;
  isNearLevel: boolean;
  nearestLevelName: string;
  nearestLevelPrice: number;
  lastUpdated: string;
}

interface OrderFlowReportContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

export const OrderFlowReportContainer: React.FC<OrderFlowReportContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const { isDark } = useTheme();
  const currentAuthUser = getStoredAuthUser();
  const isAdmin = useMemo(() => {
    if (!currentAuthUser) return false;
    const clean = currentAuthUser.trim().toLowerCase();
    if (clean === 'admin') return true;
    try {
      const custom = localStorage.getItem('trading_guru_custom_accounts');
      if (custom) {
        const accounts = JSON.parse(custom);
        const match = accounts.find((a: any) => 
          (a.username || '').toLowerCase() === clean || (a.name || '').toLowerCase() === clean
        );
        if (match && match.role === 'admin') return true;
      }
    } catch {}
    return false;
  }, [currentAuthUser]);

  // State
  const [items, setItems] = useState<OrderFlowStockItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isScanning, setIsScanning] = useState<boolean>(false);
  const [scanProgress, setScanProgress] = useState<number>(100);
  const [scanStatus, setScanStatus] = useState<string>('Loading Report Data...');
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [summary, setSummary] = useState({
    total: 0,
    bullishBreakout: 0,
    bullish: 0,
    inBuyZone: 0,
    neutral: 0,
    inSellZone: 0,
    bearish: 0,
    bearishBreakdown: 0,
    nearLevels: 0
  });

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [biasFilter, setBiasFilter] = useState<string>('ALL');
  const [sectorFilter, setSectorFilter] = useState<string>('ALL');
  const [proximityFilter, setProximityFilter] = useState<string>('ALL');
  const [fnoOnly, setFnoOnly] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<keyof OrderFlowStockItem>('changePct');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination
  const [pageSize, setPageSize] = useState<number>(50);
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Fetch report data from backend
  const fetchReportData = useCallback(async (quiet = false) => {
    if (!isAdmin) {
      setLoading(false);
      return;
    }
    if (!quiet) setLoading(true);

    try {
      const baseUrl = await getBackendHttpUrl();
      const res = await fetch(`${baseUrl}/api/orderflow-report/data`, {
        headers: {
          'bypass-tunnel-reminder': 'true',
          'x-auth-user': currentAuthUser || 'admin'
        }
      });

      if (res.ok) {
        const data = await res.json();
        if (data.items) {
          setItems(data.items);
          if (data.summary) setSummary(data.summary);
          setLastUpdated(data.lastUpdated);
          setIsScanning(data.isScanning || false);
          setScanProgress(data.scanProgress || 100);
          setScanStatus(data.scanStatus || 'Data Ready');
        }
      } else if (res.status === 403) {
        setScanStatus('Access Denied: Admin authorization required.');
      }
    } catch (err) {
      console.error('[OrderFlow Report] Fetch error:', err);
      setScanStatus('Failed to connect to backend.');
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [isAdmin, currentAuthUser]);

  useEffect(() => {
    fetchReportData();
    // Auto-poll status every 15s
    const timer = setInterval(() => fetchReportData(true), 15000);
    return () => clearInterval(timer);
  }, [fetchReportData]);

  // Trigger manual live scan
  const handleTriggerScan = async (fullScan = false) => {
    if (!isAdmin) return;
    setIsScanning(true);
    setScanProgress(0);
    setScanStatus('Initiating universe batch scan...');

    try {
      const baseUrl = await getBackendHttpUrl();
      const res = await fetch(`${baseUrl}/api/orderflow-report/scan`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true',
          'x-auth-user': currentAuthUser || 'admin'
        },
        body: JSON.stringify({ fullScan })
      });

      if (res.ok) {
        // Poll quickly during scan
        const pollTimer = setInterval(async () => {
          const pollRes = await fetch(`${baseUrl}/api/orderflow-report/data`, {
            headers: { 
              'bypass-tunnel-reminder': 'true',
              'x-auth-user': currentAuthUser || 'admin' 
            }
          });
          if (pollRes.ok) {
            const pData = await pollRes.json();
            if (pData.items) setItems(pData.items);
            if (pData.summary) setSummary(pData.summary);
            setScanProgress(pData.scanProgress || 100);
            setScanStatus(pData.scanStatus || '');
            if (!pData.isScanning) {
              setIsScanning(false);
              clearInterval(pollTimer);
            }
          }
        }, 1500);
      }
    } catch (err) {
      console.error('[OrderFlow Report] Trigger scan error:', err);
      setIsScanning(false);
    }
  };

  // Download Excel
  const handleDownloadExcel = async () => {
    try {
      const baseUrl = await getBackendHttpUrl();
      const userParam = encodeURIComponent(currentAuthUser || 'admin');
      const downloadUrl = `${baseUrl}/api/orderflow-report/export-excel?admin=${userParam}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `OrderFlow_Levels_1000_Stocks_${new Date().toISOString().slice(0, 10)}.xlsx`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Failed to initiate Excel download.');
    }
  };

  // Download CSV
  const handleDownloadCsv = async () => {
    try {
      const baseUrl = await getBackendHttpUrl();
      const userParam = encodeURIComponent(currentAuthUser || 'admin');
      const downloadUrl = `${baseUrl}/api/orderflow-report/export-csv?admin=${userParam}`;
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', `OrderFlow_Levels_1000_Stocks_${new Date().toISOString().slice(0, 10)}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (e) {
      alert('Failed to initiate CSV download.');
    }
  };

  // Filter & Sort Pipeline
  const filteredItems = useMemo(() => {
    return items.filter(it => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchesSym = it.cleanSymbol.toLowerCase().includes(q);
        const matchesName = (it.name || '').toLowerCase().includes(q);
        if (!matchesSym && !matchesName) return false;
      }

      // F&O only
      if (fnoOnly && !it.isFno) return false;

      // Sector Filter
      if (sectorFilter !== 'ALL' && it.sector !== sectorFilter) return false;

      // Bias Filter
      if (biasFilter !== 'ALL') {
        if (biasFilter === 'BULLISH_BREAKOUT' && it.bias !== 'BULLISH_BREAKOUT') return false;
        if (biasFilter === 'APPROACHING_BREAKOUT' && it.bias !== 'APPROACHING_BREAKOUT') return false;
        if (biasFilter === 'IN_BUY_ZONE' && it.bias !== 'IN_BUY_ZONE') return false;
        if (biasFilter === 'IN_SELL_ZONE' && it.bias !== 'IN_SELL_ZONE') return false;
        if (biasFilter === 'APPROACHING_BREAKDOWN' && it.bias !== 'APPROACHING_BREAKDOWN') return false;
        if (biasFilter === 'BEARISH_BREAKDOWN' && it.bias !== 'BEARISH_BREAKDOWN') return false;
        if (biasFilter === 'NEUTRAL' && it.bias !== 'NEUTRAL_RANGE') return false;
      }

      // Proximity Filter
      if (proximityFilter === 'NEAR_LEVELS' && !it.isNearLevel) return false;
      if (proximityFilter === 'BUY_ZONE' && it.bias !== 'IN_BUY_ZONE') return false;
      if (proximityFilter === 'BREAKOUT' && it.bias !== 'BULLISH_BREAKOUT') return false;

      return true;
    });
  }, [items, searchQuery, fnoOnly, sectorFilter, biasFilter, proximityFilter]);

  // Sorted items
  const sortedItems = useMemo(() => {
    const list = [...filteredItems];
    list.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string') {
        return sortOrder === 'asc' 
          ? (valA as string).localeCompare(valB as string) 
          : (valB as string).localeCompare(valA as string);
      }

      const numA = Number(valA) || 0;
      const numB = Number(valB) || 0;
      return sortOrder === 'asc' ? numA - numB : numB - numA;
    });
    return list;
  }, [filteredItems, sortField, sortOrder]);

  // Paginated items
  const paginatedItems = useMemo(() => {
    if (pageSize === -1) return sortedItems;
    const start = (currentPage - 1) * pageSize;
    return sortedItems.slice(start, start + pageSize);
  }, [sortedItems, currentPage, pageSize]);

  const totalPages = pageSize === -1 ? 1 : Math.ceil(sortedItems.length / pageSize);

  const handleSort = (field: keyof OrderFlowStockItem) => {
    if (sortField === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Distinct sectors
  const availableSectors = useMemo(() => {
    const s = new Set<string>();
    items.forEach(it => { if (it.sector) s.add(it.sector); });
    return Array.from(s).sort();
  }, [items]);

  // =========================================================================
  // ACCESS DENIED VIEW FOR NON-ADMIN USERS
  // =========================================================================
  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '70vh',
        padding: '30px',
        textAlign: 'center'
      }}>
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#ffffff',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '16px',
          padding: '40px 32px',
          maxWidth: '560px',
          boxShadow: '0 20px 40px rgba(0,0,0,0.4)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.15)',
            border: '2px solid rgba(239, 68, 68, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#ef4444'
          }}>
            <Lock size={32} />
          </div>

          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: '#ef4444' }}>
            ADMINISTRATOR PRIVILEGES REQUIRED
          </h2>

          <p style={{ margin: 0, fontSize: '13px', color: '#94a3b8', lineHeight: '1.6' }}>
            The <strong>1,000 Stock Order Flow Trading Levels Report</strong> is protected by backend role-based access control (RBAC). 
            Only authenticated Administrator accounts have permission to inspect institutional levels, live batch scans, and multi-sheet exports.
          </p>

          <div style={{
            background: 'rgba(0, 0, 0, 0.25)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '8px',
            padding: '12px 16px',
            width: '100%',
            fontSize: '11px',
            color: '#64748b',
            textAlign: 'left'
          }}>
            <div>• Current User: <strong>{currentAuthUser || 'Unauthenticated'}</strong></div>
            <div>• Required Role: <strong>admin</strong></div>
            <div>• Protected Scope: 1,000 Universe Math, Marshall Camarilla Levels & Exports</div>
          </div>

          <button
            onClick={() => {
              window.location.reload();
            }}
            style={{
              marginTop: '8px',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              border: 'none',
              borderRadius: '8px',
              padding: '10px 24px',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 14px rgba(239, 68, 68, 0.4)'
            }}
          >
            <ShieldAlert size={16} /> Re-Authenticate / Login as Admin
          </button>
        </div>
      </div>
    );
  }

  // =========================================================================
  // ADMIN AUTHORIZED EXECUTIVE DASHBOARD VIEW
  // =========================================================================
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '14px',
      padding: '16px 20px',
      width: '100%',
      minHeight: '100vh',
      boxSizing: 'border-box',
      background: isDark ? '#0b0f17' : '#f8fafc',
      color: isDark ? '#f1f5f9' : '#0f172a'
    }}>
      {/* 1. Header Title & Role Badge */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        paddingBottom: '12px',
        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            background: 'linear-gradient(135deg, #00f0ff22, #3b82f633)',
            border: '1px solid #00f0ff66',
            borderRadius: '10px',
            padding: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#00f0ff'
          }}>
            <Layers size={22} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <h1 style={{ margin: 0, fontSize: '18px', fontWeight: '800', letterSpacing: '-0.02em' }}>
                ORDER FLOW TRADING LEVELS REPORT
              </h1>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(16, 185, 129, 0.15)',
                color: '#10b981',
                border: '1px solid rgba(16, 185, 129, 0.4)'
              }}>
                1,000 STOCKS
              </span>
              <span style={{
                fontSize: '10px',
                fontWeight: '800',
                padding: '2px 8px',
                borderRadius: '4px',
                background: 'rgba(245, 158, 11, 0.15)',
                color: '#f59e0b',
                border: '1px solid rgba(245, 158, 11, 0.4)',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <ShieldCheck size={12} /> ADMIN ACCESS ONLY
              </span>
            </div>
            <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
              Calculated using Marshall Matrix Camarilla Institutional Engine • Live Quotes via Angel One SmartAPI Batch Feeds
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            onClick={() => fetchReportData(false)}
            disabled={loading || isScanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'rgba(0, 240, 255, 0.1)',
              border: '1px solid rgba(0, 240, 255, 0.4)',
              color: '#00f0ff',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            title="Refresh latest quotes from cache"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button
            onClick={() => handleTriggerScan(false)}
            disabled={isScanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
              border: 'none',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '700',
              cursor: isScanning ? 'not-allowed' : 'pointer',
              opacity: isScanning ? 0.7 : 1
            }}
            title="Trigger fast live batch scan across 1,000 stocks via Angel One"
          >
            <Zap size={14} />
            {isScanning ? `Scanning (${scanProgress}%)` : 'Scan Universe (1,000)'}
          </button>

          <button
            onClick={handleDownloadExcel}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              color: '#10b981',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            title="Export multi-sheet Excel report with Breakouts, Dip Buys, and Levels"
          >
            <FileSpreadsheet size={14} />
            Excel (.xlsx)
          </button>

          <button
            onClick={handleDownloadCsv}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: '6px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: '#cbd5e1',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
            title="Export complete 1,000 stocks table in CSV format"
          >
            <FileText size={14} />
            CSV
          </button>
        </div>
      </div>

      {/* 2. Scanning Status / Progress Banner */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 14px',
        borderRadius: '8px',
        background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
        fontSize: '11px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '8px',
            height: '8px',
            borderRadius: '50%',
            background: isScanning ? '#f59e0b' : '#10b981',
            boxShadow: `0 0 8px ${isScanning ? '#f59e0b' : '#10b981'}`
          }} />
          <span style={{ fontWeight: '600', color: isDark ? '#cbd5e1' : '#334155' }}>
            Status: {scanStatus}
          </span>
          {isScanning && (
            <div style={{ width: '120px', height: '6px', background: 'rgba(255,255,255,0.1)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${scanProgress}%`, height: '100%', background: '#00f0ff', transition: 'width 0.2s' }} />
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b' }}>
          <Clock size={12} />
          <span>Last Updated: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : 'N/A'}</span>
        </div>
      </div>

      {/* 3. Executive KPI Cards */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
        gap: '10px'
      }}>
        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
          border: '1px solid rgba(0, 240, 255, 0.3)',
          borderRadius: '8px',
          padding: '12px 14px'
        }}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>Monitored Universe</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#00f0ff', marginTop: '4px' }}>{summary.total}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>NSE Active Equities</div>
        </div>

        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
          border: '1px solid rgba(16, 185, 129, 0.3)',
          borderRadius: '8px',
          padding: '12px 14px',
          cursor: 'pointer'
        }} onClick={() => setBiasFilter('BULLISH_BREAKOUT')}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>🚀 Bullish Breakout</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#10b981', marginTop: '4px' }}>{summary.bullishBreakout}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Above R4 Trigger</div>
        </div>

        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
          border: '1px solid rgba(6, 182, 212, 0.3)',
          borderRadius: '8px',
          padding: '12px 14px',
          cursor: 'pointer'
        }} onClick={() => setBiasFilter('IN_BUY_ZONE')}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>🟢 Buy Zone (S3)</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#06b6d4', marginTop: '4px' }}>{summary.inBuyZone}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Reversal Long Dips</div>
        </div>

        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          padding: '12px 14px',
          cursor: 'pointer'
        }} onClick={() => setBiasFilter('IN_SELL_ZONE')}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>🔴 Sell Zone (R3)</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#ef4444', marginTop: '4px' }}>{summary.inSellZone}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Reversal Short Rallies</div>
        </div>

        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
          border: '1px solid rgba(220, 38, 38, 0.3)',
          borderRadius: '8px',
          padding: '12px 14px',
          cursor: 'pointer'
        }} onClick={() => setBiasFilter('BEARISH_BREAKDOWN')}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>🔻 Bearish Breakdown</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#dc2626', marginTop: '4px' }}>{summary.bearishBreakdown}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Below S4 Trigger</div>
        </div>

        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
          border: '1px solid rgba(148, 163, 184, 0.2)',
          borderRadius: '8px',
          padding: '12px 14px',
          cursor: 'pointer'
        }} onClick={() => setBiasFilter('NEUTRAL')}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>🟡 Neutral Range</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#94a3b8', marginTop: '4px' }}>{summary.neutral}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Between S3 & R3</div>
        </div>

        <div style={{
          background: isDark ? 'rgba(15, 23, 42, 0.7)' : '#ffffff',
          border: '1px solid rgba(245, 158, 11, 0.3)',
          borderRadius: '8px',
          padding: '12px 14px',
          cursor: 'pointer'
        }} onClick={() => setProximityFilter(proximityFilter === 'NEAR_LEVELS' ? 'ALL' : 'NEAR_LEVELS')}>
          <div style={{ fontSize: '10px', color: '#64748b', fontWeight: '700', textTransform: 'uppercase' }}>🎯 Near Key Levels</div>
          <div style={{ fontSize: '20px', fontWeight: '900', color: '#f59e0b', marginTop: '4px' }}>{summary.nearLevels}</div>
          <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '2px' }}>Within ≤ 0.5% Range</div>
        </div>
      </div>

      {/* 4. Filter Toolbar & Search */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '12px 14px',
        borderRadius: '8px',
        background: isDark ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`
      }}>
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: '220px', flex: '1 1 220px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <Search size={14} style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
            <input
              type="text"
              placeholder="Search symbol or company name (e.g. RELIANCE, TCS)..."
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
              style={{
                width: '100%',
                padding: '7px 10px 7px 32px',
                borderRadius: '6px',
                background: isDark ? 'rgba(0,0,0,0.3)' : '#f1f5f9',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                color: isDark ? '#ffffff' : '#000000',
                fontSize: '12px',
                outline: 'none',
                boxSizing: 'border-box'
              }}
            />
          </div>
        </div>

        {/* Dropdowns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Bias Filter */}
          <select
            value={biasFilter}
            onChange={(e) => { setBiasFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: isDark ? 'rgba(0,0,0,0.4)' : '#f1f5f9',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              color: isDark ? '#ffffff' : '#000000',
              fontSize: '11px',
              fontWeight: '600',
              outline: 'none'
            }}
          >
            <option value="ALL">All Market Biases</option>
            <option value="BULLISH_BREAKOUT">🚀 Bullish Breakout (R4+)</option>
            <option value="APPROACHING_BREAKOUT">⚡ Approaching Breakout</option>
            <option value="IN_BUY_ZONE">🟢 In Buy Zone (S3 Dips)</option>
            <option value="IN_SELL_ZONE">🔴 In Sell Zone (R3 Rallies)</option>
            <option value="APPROACHING_BREAKDOWN">⚠️ Approaching Breakdown</option>
            <option value="BEARISH_BREAKDOWN">🔻 Bearish Breakdown (S4-)</option>
            <option value="NEUTRAL">🟡 Neutral / Inside Value</option>
          </select>

          {/* Sector Filter */}
          <select
            value={sectorFilter}
            onChange={(e) => { setSectorFilter(e.target.value); setCurrentPage(1); }}
            style={{
              padding: '6px 10px',
              borderRadius: '6px',
              background: isDark ? 'rgba(0,0,0,0.4)' : '#f1f5f9',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              color: isDark ? '#ffffff' : '#000000',
              fontSize: '11px',
              fontWeight: '600',
              outline: 'none'
            }}
          >
            <option value="ALL">All Sectors ({availableSectors.length})</option>
            {availableSectors.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Proximity Toggle */}
          <button
            onClick={() => { setProximityFilter(prev => prev === 'NEAR_LEVELS' ? 'ALL' : 'NEAR_LEVELS'); setCurrentPage(1); }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: proximityFilter === 'NEAR_LEVELS' ? 'rgba(245, 158, 11, 0.2)' : 'transparent',
              border: `1px solid ${proximityFilter === 'NEAR_LEVELS' ? '#f59e0b' : (isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1')}`,
              color: proximityFilter === 'NEAR_LEVELS' ? '#f59e0b' : (isDark ? '#94a3b8' : '#64748b'),
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            🎯 Near Level (≤0.5%)
          </button>

          {/* F&O Toggle */}
          <button
            onClick={() => { setFnoOnly(prev => !prev); setCurrentPage(1); }}
            style={{
              padding: '6px 12px',
              borderRadius: '6px',
              background: fnoOnly ? 'rgba(59, 130, 246, 0.2)' : 'transparent',
              border: `1px solid ${fnoOnly ? '#3b82f6' : (isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1')}`,
              color: fnoOnly ? '#3b82f6' : (isDark ? '#94a3b8' : '#64748b'),
              fontSize: '11px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            F&O Only
          </button>

          {/* Reset Filters */}
          {(searchQuery || biasFilter !== 'ALL' || sectorFilter !== 'ALL' || proximityFilter !== 'ALL' || fnoOnly) && (
            <button
              onClick={() => {
                setSearchQuery('');
                setBiasFilter('ALL');
                setSectorFilter('ALL');
                setProximityFilter('ALL');
                setFnoOnly(false);
                setCurrentPage(1);
              }}
              style={{
                padding: '6px 10px',
                borderRadius: '6px',
                background: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                color: '#ef4444',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* 5. Main Table Container */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.8)' : '#ffffff',
        border: `1px solid ${isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
        borderRadius: '10px',
        overflow: 'hidden',
        boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
      }}>
        <div style={{ overflowX: 'auto', maxHeight: '68vh' }}>
          <table style={{
            width: '100%',
            borderCollapse: 'collapse',
            textAlign: 'left',
            fontSize: '11px',
            fontFamily: '"JetBrains Mono", monospace'
          }}>
            <thead>
              <tr style={{
                background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f1f5f9',
                color: isDark ? '#94a3b8' : '#475569',
                position: 'sticky',
                top: 0,
                zIndex: 10,
                borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`
              }}>
                <th style={{ padding: '10px 12px', width: '30px' }}>#</th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('cleanSymbol')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Symbol {sortField === 'cleanSymbol' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('ltp')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    LTP (₹) {sortField === 'ltp' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('changePct')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Change % {sortField === 'changePct' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('bias')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Market Bias {sortField === 'bias' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px' }}>Action Signal</th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('s3')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Buy Reversal (S3) {sortField === 's3' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('r3')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Sell Reversal (R3) {sortField === 'r3' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('r4')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Breakout (R4) {sortField === 'r4' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px', cursor: 'pointer' }} onClick={() => handleSort('s4')}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    Breakdown (S4) {sortField === 's4' ? (sortOrder === 'asc' ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ArrowUpDown size={12} opacity={0.4} />}
                  </div>
                </th>
                <th style={{ padding: '10px 12px' }}>Momentum (S2 - R2)</th>
                <th style={{ padding: '10px 12px' }}>Bullish Targets (R5/R6)</th>
                <th style={{ padding: '10px 12px' }}>Bearish Targets (S5/S6)</th>
                <th style={{ padding: '10px 12px' }}>Stop Loss (L/S)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center' }}>Chart</th>
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={15} style={{ padding: '36px', textAlign: 'center', color: '#64748b' }}>
                    {loading ? 'Loading 1,000 stocks Order Flow levels...' : 'No stocks match the selected search or filter criteria.'}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((it, idx) => {
                  const globalIdx = (currentPage - 1) * (pageSize === -1 ? 0 : pageSize) + idx + 1;
                  const isPositive = it.changePct >= 0;
                  return (
                    <tr 
                      key={it.token || it.symbol}
                      style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(255,255,255,0.04)' : '#f1f5f9'}`,
                        background: it.isNearLevel 
                          ? (isDark ? 'rgba(245, 158, 11, 0.05)' : 'rgba(245, 158, 11, 0.08)')
                          : 'transparent',
                        transition: 'background 0.15s'
                      }}
                    >
                      <td style={{ padding: '8px 12px', color: '#64748b' }}>{globalIdx}</td>

                      {/* Symbol & Name */}
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontWeight: '800', color: isDark ? '#ffffff' : '#0f172a' }}>
                            {it.cleanSymbol}
                          </span>
                          {it.isFno && (
                            <span style={{
                              fontSize: '8px',
                              fontWeight: '800',
                              padding: '1px 4px',
                              borderRadius: '3px',
                              background: 'rgba(59, 130, 246, 0.2)',
                              color: '#60a5fa',
                              border: '1px solid rgba(59, 130, 246, 0.4)'
                            }}>
                              F&O
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: '9px', color: '#64748b', marginTop: '1px' }}>
                          {it.sector}
                        </div>
                      </td>

                      {/* LTP */}
                      <td style={{ padding: '8px 12px', fontWeight: '800', fontSize: '12px' }}>
                        ₹{it.ltp.toFixed(2)}
                      </td>

                      {/* Change % */}
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '11px',
                          fontWeight: '800',
                          background: isPositive ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                          color: isPositive ? '#10b981' : '#ef4444',
                          border: `1px solid ${isPositive ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`
                        }}>
                          {isPositive ? '+' : ''}{it.changePct.toFixed(2)}%
                        </span>
                      </td>

                      {/* Market Bias Badge */}
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{
                          padding: '3px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          fontWeight: '800',
                          background: `${it.biasColor}18`,
                          color: it.biasColor,
                          border: `1px solid ${it.biasColor}44`,
                          whiteSpace: 'nowrap'
                        }}>
                          {it.biasLabel}
                        </span>
                      </td>

                      {/* Action Signal */}
                      <td style={{ padding: '8px 12px', color: isDark ? '#cbd5e1' : '#334155', fontWeight: '600' }}>
                        {it.actionTag}
                      </td>

                      {/* Buy Reversal S3 */}
                      <td style={{ padding: '8px 12px', color: '#00f0ff', fontWeight: '700' }}>
                        ₹{it.s3.toFixed(2)}
                      </td>

                      {/* Sell Reversal R3 */}
                      <td style={{ padding: '8px 12px', color: '#f23645', fontWeight: '700' }}>
                        ₹{it.r3.toFixed(2)}
                      </td>

                      {/* Breakout R4 */}
                      <td style={{ padding: '8px 12px', color: '#f59e0b', fontWeight: '800' }}>
                        ₹{it.r4.toFixed(2)}
                      </td>

                      {/* Breakdown S4 */}
                      <td style={{ padding: '8px 12px', color: '#f59e0b', fontWeight: '800' }}>
                        ₹{it.s4.toFixed(2)}
                      </td>

                      {/* Momentum S2 - R2 */}
                      <td style={{ padding: '8px 12px', color: '#c084fc', fontSize: '10px' }}>
                        {it.s2.toFixed(1)} - {it.r2.toFixed(1)}
                      </td>

                      {/* Targets R5/R6 */}
                      <td style={{ padding: '8px 12px', color: '#34d399', fontSize: '10px' }}>
                        T1: {it.r5.toFixed(1)} | T2: {it.r6.toFixed(1)}
                      </td>

                      {/* Targets S5/S6 */}
                      <td style={{ padding: '8px 12px', color: '#f87171', fontSize: '10px' }}>
                        T1: {it.s5.toFixed(1)} | T2: {it.s6.toFixed(1)}
                      </td>

                      {/* Stop Loss */}
                      <td style={{ padding: '8px 12px', fontSize: '10px', color: '#94a3b8' }}>
                        L: {it.stopLossLong.toFixed(1)} | S: {it.stopLossShort.toFixed(1)}
                      </td>

                      {/* Action Button: Open Candlestick Chart */}
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>
                        <button
                          onClick={() => {
                            if (onSymbolSelect) onSymbolSelect(it.symbol);
                            if (onSwitchToChart) onSwitchToChart();
                          }}
                          style={{
                            background: 'rgba(0, 240, 255, 0.12)',
                            border: '1px solid rgba(0, 240, 255, 0.4)',
                            color: '#00f0ff',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontSize: '10px',
                            fontWeight: '700'
                          }}
                          title={`Open ${it.cleanSymbol} in Candlestick Chart`}
                        >
                          <BarChart2 size={12} /> Chart
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 6. Pagination Footer */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
          padding: '12px 16px',
          background: isDark ? 'rgba(15, 23, 42, 0.95)' : '#f8fafc',
          borderTop: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : '#e2e8f0'}`,
          fontSize: '11px',
          color: '#64748b'
        }}>
          <div>
            Showing <strong>{sortedItems.length > 0 ? (currentPage - 1) * (pageSize === -1 ? 0 : pageSize) + 1 : 0}</strong> to <strong>{pageSize === -1 ? sortedItems.length : Math.min(currentPage * pageSize, sortedItems.length)}</strong> of <strong>{sortedItems.length}</strong> matching stocks ({summary.total} total)
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setCurrentPage(1); }}
              style={{
                padding: '4px 8px',
                borderRadius: '4px',
                background: isDark ? 'rgba(0,0,0,0.3)' : '#ffffff',
                border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
                color: isDark ? '#ffffff' : '#000000',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={250}>250</option>
              <option value={-1}>All (1,000)</option>
            </select>

            {pageSize !== -1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginLeft: '12px' }}>
                <button
                  disabled={currentPage <= 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
                    border: 'none',
                    color: isDark ? '#cbd5e1' : '#334155',
                    cursor: currentPage <= 1 ? 'not-allowed' : 'pointer',
                    opacity: currentPage <= 1 ? 0.4 : 1
                  }}
                >
                  Prev
                </button>
                <span style={{ padding: '0 6px', fontWeight: '700', color: isDark ? '#ffffff' : '#000000' }}>
                  {currentPage} / {totalPages || 1}
                </span>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: '4px 8px',
                    borderRadius: '4px',
                    background: isDark ? 'rgba(255,255,255,0.05)' : '#e2e8f0',
                    border: 'none',
                    color: isDark ? '#cbd5e1' : '#334155',
                    cursor: currentPage >= totalPages ? 'not-allowed' : 'pointer',
                    opacity: currentPage >= totalPages ? 0.4 : 1
                  }}
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
