import React, { useState, useEffect } from 'react';
import { 
  Sparkles, 
  Flame, 
  Search, 
  RefreshCw 
} from 'lucide-react';

interface DadaThoughtsProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

export const DadaThoughtsContainer: React.FC<DadaThoughtsProps> = ({ onSymbolSelect, onSwitchToChart }) => {
  const [liveStocks, setLiveStocks] = useState<any[]>([]);
  const [loadingScanner, setLoadingScanner] = useState(false);
  const [searchFilter, setSearchFilter] = useState('');
  const [stockTypeFilter, setStockTypeFilter] = useState<'all' | 'fno' | 'cash'>('all');

  const fetchLive200EmaStocks = async (force = false) => {
    setLoadingScanner(true);
    try {
      const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
      const res = await fetch(`${backendUrl}/api/scanner/weekly-200-ema?force=${force ? 'true' : 'false'}`);
      if (res.ok) {
        const data = await res.json();
        setLiveStocks(data.stocks || []);
      }
    } catch (err) {
      console.error('Failed to fetch live weekly 200 EMA stocks:', err);
    } finally {
      setLoadingScanner(false);
    }
  };

  useEffect(() => {
    fetchLive200EmaStocks(false);
  }, []);

  const handleStockClick = (sym: string) => {
    onSymbolSelect(`NSE:${sym}`);
    onSwitchToChart();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'fadeIn 0.25s ease-out' }}>
      
      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '20px 24px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, rgba(234, 179, 8, 0.12) 0%, rgba(20, 24, 39, 0.95) 100%)',
        border: '1px solid rgba(234, 179, 8, 0.3)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '16px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{
            background: 'rgba(234, 179, 8, 0.2)',
            padding: '12px',
            borderRadius: '12px',
            border: '1px solid rgba(234, 179, 8, 0.4)'
          }}>
            <Sparkles size={26} color="#eab308" />
          </div>
          <div>
            <h2 style={{ margin: '0 0 4px 0', fontSize: '22px', fontWeight: '800', color: 'white', letterSpacing: '-0.3px' }}>
              🧠 Dada Thoughts: Live Stocks Near Weekly 200 EMA
            </h2>
            <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
              Real-time scanner across all F&O and Cash stocks trading within &plusmn;5% of their Weekly 200 EMA.
            </p>
          </div>
        </div>

        {/* Filter and Refresh Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', borderRadius: '8px', padding: '2px', border: '1px solid rgba(255,255,255,0.06)' }}>
            <button
              onClick={() => setStockTypeFilter('all')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                background: stockTypeFilter === 'all' ? 'rgba(255,255,255,0.15)' : 'transparent',
                color: 'white',
                cursor: 'pointer'
              }}
            >
              All
            </button>
            <button
              onClick={() => setStockTypeFilter('fno')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                background: stockTypeFilter === 'fno' ? '#10b981' : 'transparent',
                color: stockTypeFilter === 'fno' ? '#000' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              F&amp;O Only
            </button>
            <button
              onClick={() => setStockTypeFilter('cash')}
              style={{
                padding: '5px 12px',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '700',
                border: 'none',
                background: stockTypeFilter === 'cash' ? '#3b82f6' : 'transparent',
                color: stockTypeFilter === 'cash' ? '#fff' : 'var(--text-secondary)',
                cursor: 'pointer'
              }}
            >
              Cash Only
            </button>
          </div>

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={14} color="var(--text-muted)" style={{ position: 'absolute', left: '10px' }} />
            <input
              type="text"
              placeholder="Search symbol..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              style={{
                padding: '6px 12px 6px 30px',
                borderRadius: '8px',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'white',
                fontSize: '12px',
                width: '140px'
              }}
            />
          </div>

          <button
            onClick={() => fetchLive200EmaStocks(true)}
            disabled={loadingScanner}
            style={{
              background: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#10b981',
              padding: '6px 14px',
              borderRadius: '8px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}
          >
            <RefreshCw size={13} className={loadingScanner ? 'animate-spin' : ''} /> {loadingScanner ? 'Scanning...' : 'Rescan'}
          </button>
        </div>
      </div>

      {/* Live Stock Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '14px' }}>
        {liveStocks && liveStocks.length > 0 ? (
          liveStocks
            .filter(s => {
              const symName = (s.cleanSymbol || s.symbol || '').toLowerCase();
              const matchSearch = symName.includes(searchFilter.toLowerCase());
              const sType = (s.type || '').toLowerCase();
              const matchType = stockTypeFilter === 'all' ? true : (stockTypeFilter === 'fno' ? sType === 'fno' || sType === 'stock' || sType === 'futures' || sType === 'index' : sType === 'cash');
              return matchSearch && matchType;
            })
            .map((s, idx) => {
              const symName = s.cleanSymbol || s.symbol.replace('NSE:', '').replace('BSE:', '');
              const currentPrice = s.currentPrice;
              const emaVal = s.ema200Val || s.ema200;
              const dist = s.distancePct;
              const statusText = s.status || s.category || 'NEAR 200 EMA';
              const badgeText = s.badge || s.statusBadge || 'SUPPORT HOLD';
              const isDoji = statusText.includes('DOJI') || s.isDojiOrHammer;

              return (
                <div
                  key={idx}
                  onClick={() => handleStockClick(symName)}
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: isDoji ? '1px solid rgba(234, 179, 8, 0.4)' : (dist >= 0 ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(239, 68, 68, 0.25)'),
                    background: isDoji ? 'rgba(234, 179, 8, 0.04)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>{symName}</span>
                      <span style={{
                        fontSize: '10px',
                        fontWeight: '800',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        background: 'rgba(255,255,255,0.08)',
                        color: 'var(--text-secondary)'
                      }}>
                        {(s.type || 'F&O').toUpperCase()}
                      </span>
                    </div>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '800',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: dist >= 0 ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                      color: dist >= 0 ? '#10b981' : '#ef4444'
                    }}>
                      {dist >= 0 ? '+' : ''}{dist}% from 200 EMA
                    </span>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>Spot: <strong style={{ color: 'white' }}>₹{currentPrice}</strong></span>
                    <span>200 EMA: <strong style={{ color: '#60a5fa' }}>₹{emaVal}</strong></span>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: isDoji ? '1px solid rgba(234, 179, 8, 0.3)' : '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status: {statusText}</span>
                    <span style={{ fontSize: '10px', fontWeight: '800', color: isDoji ? '#eab308' : (dist >= 0 ? '#10b981' : '#ef4444') }}>
                      {badgeText}
                    </span>
                  </div>
                </div>
              );
            })
        ) : (
          <div style={{ gridColumn: '1 / -1', padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
            {loadingScanner ? 'Scanning all F&O and Cash stocks for 200 EMA proximity...' : 'No stocks currently near Weekly 200 EMA. Click Rescan to refresh.'}
          </div>
        )}
      </div>

    </div>
  );
};
