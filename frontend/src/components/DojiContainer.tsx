import { useEffect, useState } from 'react';
import { Loader2, RefreshCw, AlertCircle, Info, Clock, Calendar } from 'lucide-react';

interface DojiStock {
  symbol: string;
  bodyPct: number;
  volumeRatio: number;
  ltp: number;
  high?: number;
  low?: number;
  volume: number;
  avgVolume?: number;
  isHighVolume?: boolean;
  dojiType?: string;
  slot?: string;
}

interface DojiCache {
  slot: string;
  date: string | null;
  stocks: DojiStock[];
  allDojiStocks: DojiStock[];
  isScanning: boolean;
  lastScanTime: string | null;
}

interface DojiContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
  noVolumeFilter?: boolean;
}

function formatVolume(vol: number): string {
  if (!vol || isNaN(vol)) return '0';
  if (vol >= 10000000) return `${(vol / 10000000).toFixed(2)} Cr`;
  if (vol >= 100000) return `${(vol / 100000).toFixed(2)} L`;
  if (vol >= 1000) return `${(vol / 1000).toFixed(1)} K`;
  return `${vol.toLocaleString('en-IN')}`;
}

export function DojiContainer({ onSymbolSelect, onSwitchToChart, noVolumeFilter = false }: DojiContainerProps) {
  const [data, setData] = useState<DojiCache | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string>('first_5min'); // Default to First 5-Min Opening Doji
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timeSlots = [
    { code: 'first_5min', label: '⚡ First 5-Min Candle (9:15 AM)' },
    { code: 'daily', label: '📅 Daily Timeframe (End of Day)' }
  ];

  const fetchDojiSignals = async (slot = selectedSlot, force = false) => {
    try {
      setLoading(true);
      setError(null);
      const backendUrl = window.location.port === '5175' ? 'http://localhost:3002' : window.location.origin;
      const response = await fetch(`${backendUrl}/api/doji-signals?slot=${slot}&scan=${force ? 'true' : 'false'}`);
      if (!response.ok) {
        throw new Error('Failed to fetch Doji signals');
      }
      const json = await response.json();
      setData(json);
    } catch (err: any) {
      setError(err.message || 'Error loading Doji signals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDojiSignals(selectedSlot, false);
  }, [selectedSlot]);

  const handleStockClick = (symbol: string) => {
    onSymbolSelect(`NSE:${symbol}`);
    onSwitchToChart();
  };

  const stocksList = noVolumeFilter ? data?.allDojiStocks : data?.stocks;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', height: '100%', minHeight: '0' }}>
      
      {/* Top Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)', margin: '0 0 4px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
            {selectedSlot === 'daily' ? <Calendar size={22} color="#eab308" /> : <Clock size={22} color="#3b82f6" />}
            {noVolumeFilter 
              ? (selectedSlot === 'daily' ? 'All Daily Dojis (With Volume)' : 'All 5-Min Opening Dojis (With Volume)') 
              : (selectedSlot === 'daily' ? '🔥 High Volume Daily Doji (≥1.2x Vol)' : '🔥 First 5-Min High Volume Doji (≥1.2x Vol)')}
          </h2>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>
            {noVolumeFilter 
              ? `Displays ALL stocks that printed a Doji (sorted by raw volume quantity) without volume threshold.`
              : `Displays ONLY high-volume Doji breakouts (volume ≥ 1.2x historical average).`}
          </p>
        </div>

        {/* Time Slot Selector & Refresh */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <select
            value={selectedSlot}
            onChange={(e) => setSelectedSlot(e.target.value)}
            style={{
              padding: '8px 14px',
              borderRadius: '8px',
              background: 'rgba(0,0,0,0.4)',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.15)',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {timeSlots.map(t => (
              <option key={t.code} value={t.code} style={{ background: '#181b26' }}>
                {t.label}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchDojiSignals(selectedSlot, true)}
            disabled={loading || data?.isScanning}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#3b82f6',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              borderRadius: '8px',
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: '700',
              cursor: 'pointer',
              transition: 'all 0.15s'
            }}
          >
            {loading || data?.isScanning ? (
              <Loader2 className="animate-spin" size={14} style={{ animation: 'spin 1.5s linear infinite' }} />
            ) : (
              <RefreshCw size={14} />
            )}
            {data?.isScanning ? 'Scanning...' : 'Rescan Slot'}
          </button>
        </div>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '12px', border: '1px solid rgba(239, 68, 68, 0.3)', backgroundColor: 'rgba(239, 68, 68, 0.05)', borderRadius: '12px' }}>
          <AlertCircle color="#ef4444" size={20} />
          <span style={{ color: '#ef4444', fontSize: '13px' }}>{error}</span>
        </div>
      )}

      {loading && !data ? (
        <div className="glass-panel" style={{ flex: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px', minHeight: '300px' }}>
          <Loader2 className="animate-spin" size={32} color="var(--accent-blue)" style={{ animation: 'spin 1.5s linear infinite' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px', margin: 0 }}>Scanning stocks for {selectedSlot === 'daily' ? 'Daily' : 'First 5-Min'} Doji patterns...</p>
        </div>
      ) : (
        <div style={{ flex: '1', display: 'flex', flexDirection: 'column', gap: '16px', minHeight: '0', overflowY: 'auto' }}>
          
          <div style={{ display: 'flex', gap: '12px', padding: '12px 16px', background: 'rgba(59, 130, 246, 0.05)', border: '1px solid rgba(59, 130, 246, 0.15)', borderRadius: '10px', alignItems: 'center' }}>
            <Info size={16} color="#3b82f6" />
            <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
              Scan Status: <strong>{stocksList?.length || 0} stocks found</strong> for <strong>{selectedSlot === 'daily' ? 'Daily Timeframe (End of Day)' : 'First 5-Min Candle'}</strong>.
            </span>
          </div>

          {stocksList && stocksList.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '12px' }}>
              {stocksList.map((stock, index) => (
                <div
                  key={index}
                  onClick={() => handleStockClick(stock.symbol)}
                  className="glass-panel"
                  style={{
                    padding: '16px',
                    borderRadius: '12px',
                    border: stock.isHighVolume ? '1px solid rgba(234, 179, 8, 0.4)' : '1px solid rgba(255,255,255,0.06)',
                    background: stock.isHighVolume ? 'rgba(234, 179, 8, 0.04)' : 'rgba(255,255,255,0.02)',
                    cursor: 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px',
                    transition: 'all 0.15s'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.transform = 'translateY(-2px)'}
                  onMouseLeave={(e) => e.currentTarget.style.transform = 'translateY(0)'}
                >
                  {/* Symbol and Volume display */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: '16px', fontWeight: '800', color: 'white' }}>{stock.symbol}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{
                        fontSize: '11px',
                        fontWeight: '800',
                        padding: '2px 8px',
                        borderRadius: '6px',
                        background: 'rgba(59, 130, 246, 0.15)',
                        color: '#60a5fa'
                      }}>
                        Vol: {formatVolume(stock.volume)}
                      </span>
                      {stock.volumeRatio && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: '800',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          background: stock.volumeRatio >= 1.2 ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255,255,255,0.06)',
                          color: stock.volumeRatio >= 1.2 ? '#eab308' : 'var(--text-muted)'
                        }}>
                          {stock.volumeRatio}x
                        </span>
                      )}
                    </div>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <span>Spot: <strong style={{ color: 'white' }}>₹{stock.ltp}</strong></span>
                    <span>Body: <strong style={{ color: '#60a5fa' }}>{stock.bodyPct}%</strong></span>
                  </div>

                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    background: 'rgba(0,0,0,0.3)',
                    padding: '6px 10px',
                    borderRadius: '6px',
                    border: '1px solid rgba(255,255,255,0.04)'
                  }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Type:</span>
                    <span style={{ fontSize: '11px', fontWeight: '700', color: stock.dojiType?.includes('Dragonfly') ? '#10b981' : (stock.dojiType?.includes('Gravestone') ? '#ef4444' : '#eab308') }}>
                      {stock.dojiType || 'Doji'}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass-panel" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No stocks matched the Doji criteria for this selection. Click "Rescan Slot" to trigger fresh scan.
            </div>
          )}

        </div>
      )}

    </div>
  );
}
