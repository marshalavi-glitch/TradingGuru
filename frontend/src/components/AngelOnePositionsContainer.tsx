import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { RefreshCw, Search, ArrowUpDown, ExternalLink, Maximize2, Minimize2 } from 'lucide-react';
import { getBackendHttpUrl } from '../utils/tvStreamer';

export interface UnifiedTradePosition {
  id: string;
  symboltoken?: string;
  symbolname: string;
  tradingsymbol: string;
  exchange: string;
  expirydate: string;
  strikeprice: string;
  optiontype: string;
  producttype: string;
  status: 'OPEN' | 'CLOSED' | 'TARGET_1_HIT';
  lotsize: number;
  lotCount: number;
  netqty: number;
  buyavgprice: number;
  sellavgprice: number;
  ltp: number;
  close: number;
  pctChange: number;
  pnl: number;
  realised: number;
  unrealised: number;
  dateStr: string;
}

interface AngelOnePositionsContainerProps {
  onSwitchToChart?: (symbol: string) => void;
  apiBaseUrl?: string; // Optional backend URL override (defaults to current origin)
}

export const AngelOnePositionsContainer: React.FC<AngelOnePositionsContainerProps> = ({ 
  onSwitchToChart,
  apiBaseUrl = ''
}) => {
  const [positions, setPositions] = useState<UnifiedTradePosition[]>([]);
  const [liveQuotes, setLiveQuotes] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'OPEN' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [sortField, setSortField] = useState<'SCRIP' | 'PNL'>('SCRIP');
  const [sortAsc, setSortAsc] = useState<boolean>(true);
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const isMountedRef = useRef<boolean>(true);

  // Fullscreen toggle: supports native Fullscreen API with seamless CSS viewport fallback
  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => {
      const next = !prev;
      if (next) {
        if (containerRef.current && containerRef.current.requestFullscreen) {
          containerRef.current.requestFullscreen().catch(() => {});
        }
      } else {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  // Pop out into a dedicated, resizable standalone workstation window
  const handlePopOut = useCallback(() => {
    const origin = window.location.origin;
    const pathname = window.location.pathname;
    const url = `${origin}${pathname}?tab=algo_trade&subview=angelone&standalone=true`;
    const width = Math.min(1480, window.screen.availWidth || 1480);
    const height = Math.min(920, window.screen.availHeight || 920);
    const left = Math.max(0, Math.floor((window.screen.availWidth - width) / 2));
    const top = Math.max(0, Math.floor((window.screen.availHeight - height) / 2));
    window.open(
      url,
      'AngelOnePositionsPopout',
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=no,toolbar=no,menubar=no`
    );
  }, []);

  // Sync fullscreen state on Esc or native change
  useEffect(() => {
    const handleFsChange = () => {
      if (!document.fullscreenElement && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        }
      }
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('fullscreenchange', handleFsChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isFullscreen]);

  // 1. Fetch Positions & Trades
  const fetchAllTodayTrades = useCallback(async (manual = false) => {
    try {
      if (manual) setIsRefreshing(true);
      let baseUrl = apiBaseUrl;
      if (!baseUrl) {
        try {
          baseUrl = await getBackendHttpUrl();
        } catch {
          baseUrl = window.location.origin;
        }
      }

      const [angelRes, algoRes] = await Promise.allSettled([
        fetch(`${baseUrl}/api/angelone/positions`).then(r => r.json()),
        fetch(`${baseUrl}/api/algo-trade/trades`).then(r => r.json())
      ]);

      if (!isMountedRef.current) return;

      const unified: UnifiedTradePosition[] = [];
      const symbolsToPoll: string[] = [];

      // 1. Process broker positions
      if (angelRes.status === 'fulfilled' && angelRes.value) {
        const rawAngel = angelRes.value.data || (Array.isArray(angelRes.value) ? angelRes.value : []);
        if (Array.isArray(rawAngel)) {
          rawAngel.forEach((p: any, idx: number) => {
            const netQty = parseInt(p.netqty || '0', 10);
            const rawLotSize = parseInt(p.lotsize || '1', 10);
            // Mandatory Rule: NIFTY option lot size is strictly 65
            const lotSize = (p.symbolname === 'NIFTY' || p.tradingsymbol?.includes('NIFTY')) ? 65 : rawLotSize;
            const buyQty = parseInt(p.buyqty || p.cfbuyqty || '0', 10);
            const tradeLots = buyQty > 0 ? Math.round(buyQty / (lotSize > 0 ? lotSize : 1)) : 2;
            const overallQty = tradeLots * lotSize;

            const buyPrice = parseFloat(p.buyavgprice || p.totalbuyavgprice || '0');
            const sellPrice = parseFloat(p.sellavgprice || p.totalsellavgprice || '0');
            const ltp = parseFloat(p.ltp || '0');
            const close = parseFloat(p.close || '0');
            const pctChange = close > 0 && ltp > 0 ? ((ltp - close) / close) * 100 : 0;
            
            // For closed/exited positions, P&L is strictly locked between buy and sell price
            const pnl = netQty === 0 && buyPrice > 0 && sellPrice > 0
              ? Math.round((sellPrice - buyPrice) * overallQty * 100) / 100
              : parseFloat(p.pnl || p.realised || '0');

            if (p.tradingsymbol) symbolsToPoll.push(p.tradingsymbol);

            unified.push({
              id: `broker_${p.symboltoken || p.tradingsymbol || idx}`,
              symboltoken: p.symboltoken,
              symbolname: p.symbolname || 'NIFTY',
              tradingsymbol: p.tradingsymbol || '',
              exchange: p.exchange === 'NFO' ? 'NSE FO' : (p.exchange || 'NSE'),
              expirydate: '23 Nov 2026',
              strikeprice: p.strikeprice ? parseFloat(p.strikeprice).toString() : '',
              optiontype: (p.optiontype || '').toUpperCase(),
              producttype: p.producttype === 'CARRYFORWARD' ? 'CF' : (p.producttype || 'CF'),
              status: netQty === 0 ? 'CLOSED' : 'OPEN',
              lotsize: lotSize,
              lotCount: tradeLots,
              netqty: netQty,
              buyavgprice: buyPrice,
              sellavgprice: sellPrice,
              ltp,
              close,
              pctChange,
              pnl,
              realised: pnl,
              unrealised: 0,
              dateStr: '17 Nov 2026'
            });
          });
        }
      }

      // 2. Process today's algo trades taken
      if (algoRes.status === 'fulfilled' && algoRes.value) {
        const rawAlgo = algoRes.value.trades || (Array.isArray(algoRes.value) ? algoRes.value : []);
        if (Array.isArray(rawAlgo)) {
          const todayTrades = rawAlgo.filter((t: any) => 
            t.entryDate === '17 Nov 2026' || 
            (t.entryDateTime && t.entryDateTime.includes('17 Nov 2026')) ||
            (t.id && t.id.includes('20261117'))
          );

          todayTrades.forEach((t: any) => {
            const match = (t.symbol || '').match(/^([A-Z]+)\s+(\d+)\s+(CE|PE)$/i);
            const baseSymbol = match ? match[1].toUpperCase() : (t.underlyingSymbol ? t.underlyingSymbol.replace(/^(NSE:|BSE:)/, '') : t.symbol);
            const strike = match ? match[2] : (t.strikePrice ? t.strikePrice.toString() : '');
            const optType = match ? match[3].toUpperCase() : (t.optionType || 'CE').toUpperCase();

            const isClosed = t.status === 'CLOSED' || t.status === 'TARGET_2_HIT' || t.status === 'SL_HIT';
            // Mandatory Rule: NIFTY option lot size is strictly 65
            const lotSize = (baseSymbol === 'NIFTY' || (t.symbol && t.symbol.toUpperCase().startsWith('NIFTY '))) ? 65 : (t.lotSize || 25);
            
            const totalTradedQty = t.initialQuantity || (t.bookedQuantity ? t.bookedQuantity + (t.quantity || 0) : t.quantity) || lotSize;
            const tradeLots = Math.max(1, Math.round(totalTradedQty / lotSize));
            const overallQty = tradeLots * lotSize;
            const currentNetQty = isClosed ? 0 : (t.quantity || 0);

            const buyPrice = t.entryPrice || 0;
            const sellPrice = isClosed ? (t.exitPrice || t.currentLtp || buyPrice) : (t.status === 'TARGET_1_HIT' ? t.currentLtp : 0);
            const ltp = t.currentLtp || t.exitPrice || buyPrice;
            const pctChange = buyPrice > 0 ? ((ltp - buyPrice) / buyPrice) * 100 : 0;
            
            // P&L calculation strictly based on overall lots traded from buy to sell price
            const pnl = isClosed 
              ? Math.round((sellPrice - buyPrice) * overallQty * 100) / 100
              : Math.round((ltp - buyPrice) * overallQty * 100) / 100;

            if (t.symbol) symbolsToPoll.push(t.symbol);

            unified.push({
              id: t.id,
              symbolname: baseSymbol,
              tradingsymbol: t.symbol,
              exchange: 'NSE FO',
              expirydate: '23 Nov 2026',
              strikeprice: strike,
              optiontype: optType,
              producttype: 'CF',
              status: isClosed ? 'CLOSED' : (t.status === 'TARGET_1_HIT' ? 'TARGET_1_HIT' : 'OPEN'),
              lotsize: lotSize,
              lotCount: tradeLots,
              netqty: currentNetQty,
              buyavgprice: buyPrice,
              sellavgprice: sellPrice,
              ltp,
              close: buyPrice,
              pctChange,
              pnl,
              realised: isClosed ? pnl : 0,
              unrealised: isClosed ? 0 : pnl,
              dateStr: t.entryDate || '17 Nov 2026'
            });
          });
        }
      }

      setPositions(unified);
      setLastUpdated(new Date().toLocaleTimeString());

      // Fetch live option quotes
      if (symbolsToPoll.length > 0) {
        try {
          const qRes = await fetch(`${baseUrl}/api/positions/live-quotes?symbols=${encodeURIComponent(symbolsToPoll.join(','))}`);
          const qData = await qRes.json();
          if (qData.success && qData.quotes) {
            setLiveQuotes(prev => ({ ...prev, ...qData.quotes }));
          }
        } catch (e) {}
      }
    } catch (err) {
      console.warn('[Positions Sync] Error updating positions:', err);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [apiBaseUrl]);

  // Initial load and fast 2.5-second live polling
  useEffect(() => {
    isMountedRef.current = true;
    fetchAllTodayTrades();
    const interval = setInterval(() => {
      fetchAllTodayTrades(false);
    }, 2500);
    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchAllTodayTrades]);

  // Aggregate KPI summary
  const summary = useMemo(() => {
    let totalPnl = 0;
    let totalRealised = 0;
    let totalUnrealised = 0;
    let openCount = 0;
    let closedCount = 0;

    positions.forEach(p => {
      totalPnl += p.pnl;
      totalRealised += p.realised;
      totalUnrealised += p.unrealised;

      if (p.status === 'CLOSED') {
        closedCount++;
      } else {
        openCount++;
      }
    });

    return {
      totalPnl,
      totalRealised,
      totalUnrealised,
      openCount,
      closedCount,
      totalCount: positions.length
    };
  }, [positions]);

  // Filtered & Sorted positions
  const filteredPositions = useMemo(() => {
    return positions.filter(p => {
      if (statusFilter === 'OPEN' && p.status === 'CLOSED') return false;
      if (statusFilter === 'CLOSED' && p.status !== 'CLOSED') return false;

      if (searchQuery.trim()) {
        const q = searchQuery.toUpperCase().trim();
        const full = `${p.symbolname} ${p.tradingsymbol} ${p.strikeprice} ${p.optiontype}`.toUpperCase();
        if (!full.includes(q)) return false;
      }
      return true;
    }).map(p => {
      const cleanSym = p.tradingsymbol.toUpperCase().trim();
      const simpleSym = `${p.symbolname} ${p.strikeprice} ${p.optiontype}`.toUpperCase().trim();
      const livePrice = liveQuotes[cleanSym] || liveQuotes[simpleSym] || liveQuotes[p.symbolname.toUpperCase()] || p.ltp;

      let pctChange = p.pctChange;
      if (p.close > 0 && livePrice > 0) {
        pctChange = ((livePrice - p.close) / p.close) * 100;
      }

      let dynamicPnl = p.pnl;
      if (p.status !== 'CLOSED' && livePrice > 0 && p.buyavgprice > 0) {
        dynamicPnl = Math.round((livePrice - p.buyavgprice) * (p.lotCount * p.lotsize) * 100) / 100;
      }

      return {
        ...p,
        ltp: livePrice,
        pctChange,
        pnl: dynamicPnl
      };
    }).sort((a, b) => {
      if (sortField === 'SCRIP') {
        const symA = (a.symbolname || a.tradingsymbol).toUpperCase();
        const symB = (b.symbolname || b.tradingsymbol).toUpperCase();
        return sortAsc ? symA.localeCompare(symB) : symB.localeCompare(symA);
      } else if (sortField === 'PNL') {
        return sortAsc ? a.pnl - b.pnl : b.pnl - a.pnl;
      }
      return 0;
    });
  }, [positions, liveQuotes, statusFilter, searchQuery, sortField, sortAsc]);

  const toggleSort = (field: 'SCRIP' | 'PNL') => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(field === 'SCRIP');
    }
  };

  return (
    <div
      ref={containerRef}
      style={{
        display: 'flex',
        flexDirection: 'column',
        width: isFullscreen ? '100vw' : '100%',
        height: isFullscreen ? '100vh' : '100%',
        position: isFullscreen ? 'fixed' : 'relative',
        top: isFullscreen ? 0 : undefined,
        left: isFullscreen ? 0 : undefined,
        right: isFullscreen ? 0 : undefined,
        bottom: isFullscreen ? 0 : undefined,
        zIndex: isFullscreen ? 999999 : undefined,
        backgroundColor: '#f1f5f9',
        color: '#0f172a',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
        overflowY: 'auto',
        boxSizing: 'border-box'
      }}
    >
      {/* 1. TOP HEADER & ACCOUNT STATUS BAR */}
      <div style={{
        backgroundColor: '#ffffff',
        borderBottom: '1px solid #e2e8f0',
        padding: '12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        {/* Left: Account & Connection Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#002855',
            color: '#ffffff',
            padding: '6px 14px',
            borderRadius: '6px',
            fontWeight: '800',
            fontSize: '13px',
            letterSpacing: '0.3px'
          }}>
            <span style={{ color: '#f25b2a', fontSize: '15px' }}>●</span>
            Positions &amp; Portfolio
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
            <span style={{ fontWeight: '600', color: '#334155' }}>Client ID:</span>
            <span style={{
              backgroundColor: '#f8fafc',
              padding: '2px 8px',
              borderRadius: '4px',
              border: '1px solid #e2e8f0',
              fontFamily: 'monospace',
              fontWeight: '700',
              color: '#0f172a'
            }}>
              M307862
            </span>
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '5px',
            backgroundColor: '#f0fdf4',
            border: '1px solid #bbf7d0',
            color: '#16a34a',
            padding: '3px 10px',
            borderRadius: '14px',
            fontSize: '11px',
            fontWeight: '700'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#16a34a' }}></span>
            Live Connected
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            padding: '3px 8px',
            borderRadius: '6px',
            fontSize: '11px',
            color: '#475569',
            fontWeight: '600'
          }}>
            <span>📅 17 Nov 2026 Session</span>
          </div>
        </div>

        {/* Right: Realised, Unrealised & Total Today's P&L Metrics */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>Realised P&L</span>
            <span style={{
              fontSize: '13px',
              fontWeight: '700',
              color: summary.totalRealised >= 0 ? '#16a34a' : '#c53030'
            }}>
              {summary.totalRealised >= 0 ? '+' : ''}₹{summary.totalRealised.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
            <span style={{ fontSize: '10.5px', color: '#64748b', fontWeight: '600' }}>Unrealised P&L</span>
            <span style={{
              fontSize: '13px',
              fontWeight: '700',
              color: summary.totalUnrealised >= 0 ? '#16a34a' : '#c53030'
            }}>
              {summary.totalUnrealised >= 0 ? '+' : ''}₹{summary.totalUnrealised.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Total Today's P&L Highlight Box */}
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            backgroundColor: summary.totalPnl >= 0 ? '#f0fdf4' : '#fef2f2',
            padding: '4px 12px',
            borderRadius: '6px',
            border: `1px solid ${summary.totalPnl >= 0 ? '#bbf7d0' : '#fecaca'}`
          }}>
            <span style={{ fontSize: '10.5px', color: summary.totalPnl >= 0 ? '#15803d' : '#b91c1c', fontWeight: '700', textTransform: 'uppercase' }}>
              Total Today's P&L
            </span>
            <span style={{
              fontSize: '15px',
              fontWeight: '800',
              color: summary.totalPnl >= 0 ? '#16a34a' : '#c53030'
            }}>
              {summary.totalPnl >= 0 ? '+' : ''}₹{summary.totalPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </span>
          </div>

          {/* Refresh Button */}
          <button
            onClick={() => fetchAllTodayTrades(true)}
            disabled={isRefreshing}
            title={`Last updated: ${lastUpdated || 'just now'}`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: isRefreshing ? 'not-allowed' : 'pointer',
              transition: 'all 0.15s ease'
            }}
          >
            <RefreshCw size={14} className={isRefreshing ? 'animate-spin' : ''} style={{ color: '#002855' }} />
            <span>{isRefreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {/* Pop Out Button */}
          <button
            onClick={handlePopOut}
            title="Pop out Positions & Portfolio into separate standalone window"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              color: '#334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = '#f1f5f9';
              e.currentTarget.style.borderColor = '#94a3b8';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = '#f8fafc';
              e.currentTarget.style.borderColor = '#cbd5e1';
            }}
          >
            <ExternalLink size={14} style={{ color: '#002855' }} />
            <span>Pop Out</span>
          </button>

          {/* Fullscreen Button */}
          <button
            onClick={toggleFullscreen}
            title={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Enter Fullscreen'}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: isFullscreen ? '#002855' : '#f8fafc',
              border: isFullscreen ? '1px solid #002855' : '1px solid #cbd5e1',
              color: isFullscreen ? '#ffffff' : '#334155',
              padding: '6px 12px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
            }}
            onMouseEnter={(e) => {
              if (!isFullscreen) {
                e.currentTarget.style.backgroundColor = '#f1f5f9';
                e.currentTarget.style.borderColor = '#94a3b8';
              }
            }}
            onMouseLeave={(e) => {
              if (!isFullscreen) {
                e.currentTarget.style.backgroundColor = '#f8fafc';
                e.currentTarget.style.borderColor = '#cbd5e1';
              }
            }}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} style={{ color: '#002855' }} />}
            <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
          </button>
        </div>
      </div>

      {/* 2. SUB-BAR: FILTER TABS & SEARCH */}
      <div style={{
        padding: '16px 24px 12px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'ALL', label: `All Trades (${summary.totalCount})` },
            { id: 'OPEN', label: `Open (${summary.openCount})` },
            { id: 'CLOSED', label: `Closed (${summary.closedCount})` }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setStatusFilter(tab.id as any)}
              style={{
                fontSize: '12px',
                fontWeight: statusFilter === tab.id ? '700' : '600',
                padding: '6px 14px',
                borderRadius: '6px',
                border: statusFilter === tab.id ? '1px solid #002855' : '1px solid #e2e8f0',
                backgroundColor: statusFilter === tab.id ? '#002855' : '#ffffff',
                color: statusFilter === tab.id ? '#ffffff' : '#475569',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div style={{ position: 'relative', width: '260px' }}>
          <Search size={14} style={{ position: 'absolute', left: '10px', top: '9px', color: '#94a3b8' }} />
          <input
            type="text"
            placeholder="Search Scrip Name or Strike..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '6px 10px 6px 30px',
              fontSize: '12px',
              color: '#0f172a',
              outline: 'none'
            }}
          />
        </div>
      </div>

      {/* 3. POSITIONS TABLE */}
      <div style={{
        padding: '0 24px 24px 24px',
        flex: 1
      }}>
        <div style={{
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          border: '1px solid #e2e8f0',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
          overflow: 'hidden'
        }}>
          {/* TABLE HEADER */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            padding: '12px 20px',
            fontSize: '12.5px',
            fontWeight: '600',
            color: '#334155',
            userSelect: 'none'
          }}>
            <div
              onClick={() => toggleSort('SCRIP')}
              style={{
                flex: '2.5',
                minWidth: '240px',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <span>Scrip Name</span>
              <ArrowUpDown size={13} style={{ color: sortField === 'SCRIP' ? '#002855' : '#94a3b8' }} />
            </div>

            <div style={{ flex: '1.2', minWidth: '130px' }}>
              Action/Product Type
            </div>

            <div style={{ flex: '1.3', minWidth: '130px' }}>
              Qty.
            </div>

            <div style={{
              flex: '2.0',
              minWidth: '180px',
              display: 'flex',
              justifyContent: 'space-between',
              paddingLeft: '14px',
              paddingRight: '14px',
              borderLeft: '1px solid #f1f5f9',
              borderRight: '1px solid #f1f5f9'
            }}>
              <span>ATP</span>
              <span>LTP</span>
            </div>

            <div
              onClick={() => toggleSort('PNL')}
              style={{
                flex: '1.4',
                minWidth: '120px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '4px',
                cursor: 'pointer'
              }}
            >
              <span>Gain &amp; Loss</span>
              <ArrowUpDown size={13} style={{ color: sortField === 'PNL' ? '#002855' : '#94a3b8' }} />
            </div>
          </div>

          {/* TABLE ROWS */}
          {isLoading ? (
            <div style={{
              padding: '60px 20px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              color: '#64748b',
              fontSize: '13px'
            }}>
              <RefreshCw size={18} className="animate-spin" style={{ color: '#002855' }} />
              <span>Fetching live positions...</span>
            </div>
          ) : filteredPositions.length === 0 ? (
            <div style={{
              padding: '60px 20px',
              textAlign: 'center',
              color: '#64748b'
            }}>
              <div style={{ fontSize: '15px', fontWeight: '700', color: '#334155', marginBottom: '6px' }}>
                No Trades Found for Today
              </div>
              <div style={{ fontSize: '12.5px' }}>
                {searchQuery ? 'No scrips match your search query.' : 'There are currently no trades recorded in today\'s session.'}
              </div>
            </div>
          ) : (
            filteredPositions.map((item, idx) => {
              const isClosed = item.status === 'CLOSED';
              const isPnlPositive = item.pnl >= 0;
              const isLtpPositive = item.ltp >= item.close;

              return (
                <div
                  key={`${item.id}_${idx}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: '#ffffff',
                    borderBottom: idx === filteredPositions.length - 1 ? 'none' : '1px solid #f1f5f9',
                    padding: '16px 20px',
                    fontSize: '13px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f8fafc')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                >
                  {/* Column 1: Scrip Name */}
                  <div
                    onClick={() => onSwitchToChart && onSwitchToChart(item.symbolname || item.tradingsymbol)}
                    style={{
                      flex: '2.5',
                      minWidth: '240px',
                      display: 'flex',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '8px',
                      cursor: onSwitchToChart ? 'pointer' : 'default'
                    }}
                    title="Click to view chart"
                  >
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#7c8ba1', letterSpacing: '-0.2px' }}>
                      {item.symbolname}
                    </span>

                    <span style={{ fontSize: '11px', fontWeight: '700', color: '#475569' }}>
                      {item.exchange}
                    </span>

                    {(item.expirydate || item.strikeprice) && (
                      <span style={{ fontSize: '13px', fontWeight: '400', color: '#8896aa' }}>
                        {item.expirydate} {item.strikeprice}
                      </span>
                    )}

                    {item.optiontype && (
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '700',
                        padding: '1px 6px',
                        borderRadius: '4px',
                        backgroundColor: item.optiontype.toUpperCase() === 'PE' ? '#fbf2ea' : '#eef4fc',
                        color: item.optiontype.toUpperCase() === 'PE' ? '#9c7a5c' : '#3b82f6'
                      }}>
                        {item.optiontype.toUpperCase()}
                      </span>
                    )}
                  </div>

                  {/* Column 2: Action/Product Type */}
                  <div style={{
                    flex: '1.2',
                    minWidth: '130px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '600',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      letterSpacing: '0.4px',
                      backgroundColor: isClosed ? '#f0f3fa' : (item.status === 'TARGET_1_HIT' ? '#fef3c7' : '#ecfdf5'),
                      color: isClosed ? '#818cf8' : (item.status === 'TARGET_1_HIT' ? '#b45309' : '#10b981')
                    }}>
                      {isClosed ? 'CLOSED' : (item.status === 'TARGET_1_HIT' ? 'TGT 1 HIT' : 'OPEN')}
                    </span>

                    <span style={{ fontSize: '12px', fontWeight: '500', color: '#94a3b8' }}>
                      {item.producttype}
                    </span>
                  </div>

                  {/* Column 3: Qty. */}
                  <div style={{
                    flex: '1.3',
                    minWidth: '130px',
                    fontSize: '13px',
                    fontWeight: '400',
                    color: '#7c8ba1'
                  }}>
                    {isClosed ? `0 Lot (1 Lot = ${item.lotsize})` : `${item.lotCount} ${item.lotCount === 1 ? 'Lot' : 'Lots'} (1 Lot = ${item.lotsize})`}
                  </div>

                  {/* Column 4: ATP & LTP */}
                  <div style={{
                    flex: '2.0',
                    minWidth: '180px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingLeft: '14px',
                    paddingRight: '14px',
                    borderLeft: '1px solid #f1f5f9',
                    borderRight: '1px solid #f1f5f9'
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                      {/* Buy ATP */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '16px',
                          height: '16px',
                          borderRadius: '3px',
                          backgroundColor: '#e6f9f0',
                          color: '#10b981',
                          fontSize: '10.5px',
                          fontWeight: '800'
                        }}>
                          B
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '400', color: '#7c8ba1' }}>
                          {item.buyavgprice > 0 ? item.buyavgprice.toFixed(2) : '-'}
                        </span>
                      </div>

                      {/* Sell ATP */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '16px',
                          height: '16px',
                          borderRadius: '3px',
                          backgroundColor: '#fef2f2',
                          color: '#ef4444',
                          fontSize: '10.5px',
                          fontWeight: '800'
                        }}>
                          S
                        </span>
                        <span style={{ fontSize: '13px', fontWeight: '400', color: '#7c8ba1' }}>
                          {item.sellavgprice > 0 ? item.sellavgprice.toFixed(2) : '-'}
                        </span>
                      </div>
                    </div>

                    {/* Right: Live LTP & Percentage Change */}
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '4px' }}>
                      <span style={{
                        fontSize: '13.5px',
                        fontWeight: '400',
                        color: isLtpPositive ? '#16a34a' : '#c53030',
                        transition: 'color 0.2s ease'
                      }}>
                        {item.ltp > 0 ? item.ltp.toFixed(2) : '-'}
                      </span>
                      {item.close > 0 && item.ltp > 0 && (
                        <span style={{ fontSize: '11px', color: '#5a687d', fontWeight: '400' }}>
                          ({item.pctChange >= 0 ? '+' : ''}{item.pctChange.toFixed(2)}%)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Column 5: Gain & Loss */}
                  <div style={{
                    flex: '1.4',
                    minWidth: '120px',
                    textAlign: 'right',
                    fontSize: '14px',
                    fontWeight: '600',
                    color: isPnlPositive ? '#16a34a' : '#c53030',
                    paddingRight: '6px'
                  }}>
                    {isPnlPositive && item.pnl > 0 ? '+' : ''}{item.pnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
