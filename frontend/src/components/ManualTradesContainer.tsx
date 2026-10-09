import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Search, Target, ShieldAlert, Award, TrendingUp, TrendingDown, 
  Activity, CheckCircle2, RefreshCw, BarChart2, Zap, ArrowUpRight, Flame, Layers, Clock,
  Plus, Edit2, Trash2, X, Save, RotateCcw, Lock, Unlock, Volume2,
  Image, Upload, Maximize2, Download, ZoomIn
} from 'lucide-react';

export interface ManualTrade {
  id: string;
  date: string;
  symbol: string;
  displayName: string;
  tradeType: 'CALL BUY' | 'PUT BUY' | 'FUT LONG' | 'FUT SHORT' | 'EQUITY BUY';
  setupName: string;
  entryPrice: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  finalAchievedPrice: number;
  finalStatus: 'TARGET 3 HIT' | 'TARGET 2 HIT' | 'TARGET 1 HIT' | 'LIVE ACTIVE' | 'STOP LOSS HIT';
  currentPrice?: number;
  isPriceFrozen?: boolean;
  ptsGained?: number;
  roiPct?: number;
  holdingTime?: string;
  riskReward?: string;
  notes?: string;
  chartImage?: string;
}

const STORAGE_KEY = 'tradingguru_manual_trades_v10';

// DEFAULT MANUAL TRADE DATASET
const DEFAULT_MANUAL_TRADES: ManualTrade[] = [
  {
    id: 'MT-20260925-01',
    date: '2026-09-25 10:29',
    symbol: 'NSE:INDGN',
    displayName: 'INDGN',
    tradeType: 'EQUITY BUY',
    setupName: 'Positional Swing',
    entryPrice: 612.00,
    currentPrice: 614.50,
    target1: 625.00,
    target2: 635.00,
    target3: 650.00,
    stopLoss: 599.00,
    finalAchievedPrice: 614.50,
    finalStatus: 'LIVE ACTIVE',
    isPriceFrozen: false,
    ptsGained: 2.50,
    roiPct: 0.41,
    holdingTime: '4-5 Days Trade',
    riskReward: '1:1.77',
    notes: 'Buy INDGN near 609-615 | SL: 599 | TGT: 625-635 | 4-5 Days Positional Swing Trade'
  },
  {
    id: 'MT-20260921-02',
    date: '2026-09-21 09:57',
    symbol: 'MCX:CRUDEOIL8800PE',
    displayName: 'CRUDEOIL 8800 PE',
    tradeType: 'PUT BUY',
    setupName: 'Breakout Surge',
    entryPrice: 382.50,
    currentPrice: 382.50,
    target1: 395.00,
    target2: 405.00,
    target3: 415.00,
    stopLoss: 360.00,
    finalAchievedPrice: 382.50,
    finalStatus: 'LIVE ACTIVE',
    isPriceFrozen: false,
    ptsGained: 0,
    roiPct: 0,
    holdingTime: 'Intraday',
    riskReward: '1:1.44',
    notes: 'CRUDEOIL 8800 PE BUY ABOVE 380-85 | SL paid (360) | TGT 395/405/415++. Posted at 09:57 AM.',
    chartImage: '/assets/trades/crudeoil_8800pe_alert.png'
  },
  {
    id: 'MT-20260921-01',
    date: '2026-09-21 09:18',
    symbol: 'NSE:MIDCAPNIFTY14400PE',
    displayName: 'MIDCAPNIFTY 14400 PE',
    tradeType: 'PUT BUY',
    setupName: 'Intraday Momentum',
    entryPrice: 75.00,
    currentPrice: 75.00,
    target1: 92.00,
    target2: 115.00,
    target3: 170.00,
    stopLoss: 35.00,
    finalAchievedPrice: 75.00,
    finalStatus: 'LIVE ACTIVE',
    isPriceFrozen: false,
    ptsGained: 0,
    roiPct: 0,
    holdingTime: 'Intraday',
    riskReward: '1:2.38',
    notes: '💎 BUY MIDCAPNIFTY 14400 PE @ 70/80 💎 TGT: 92, 115, 170+. SL: 35. Posted at 09:18 AM.',
    chartImage: '/assets/trades/midcapnifty_14400pe_alert.png'
  },
  {
    id: 'MT-20260918-02',
    date: '2026-09-18 10:21',
    symbol: 'NSE:SHYAMMETL',
    displayName: 'SHYAMMETL',
    tradeType: 'EQUITY BUY',
    setupName: 'Positional 1-Week',
    entryPrice: 1090.50,
    currentPrice: 1092.50,
    target1: 1115.00,
    target2: 1126.00,
    target3: 1140.00,
    stopLoss: 1072.00,
    finalAchievedPrice: 1092.50,
    finalStatus: 'LIVE ACTIVE',
    isPriceFrozen: false,
    ptsGained: 2.00,
    roiPct: 0.18,
    holdingTime: '1 Week Trade',
    riskReward: '1:1.92',
    notes: 'Buy SHYAMMETL near 1085-1096. SL 1072. TGT 1115-1126. 1 Week Trade.'
  },
  {
    id: 'MT-20260918-01',
    date: '2026-09-18 09:21',
    symbol: 'NSE:NIFTY23300PE',
    displayName: 'NIFTY 23300 PE',
    tradeType: 'PUT BUY',
    setupName: 'Intraday Momentum',
    entryPrice: 85.00,
    currentPrice: 85.00,
    target1: 102.00,
    target2: 130.00,
    target3: 160.00,
    stopLoss: 30.00,
    finalAchievedPrice: 85.00,
    finalStatus: 'LIVE ACTIVE',
    isPriceFrozen: false,
    ptsGained: 0,
    roiPct: 0,
    holdingTime: 'Intraday',
    riskReward: '1:1.36',
    notes: '💎 BUY NIFTY 23300 PE @ 80/90 💎 TGT: 102, 130, 160+. SL: 30. Posted at 09:21 AM.'
  },
  {
    id: 'MT-20260916-03',
    date: '2026-09-16 09:40',
    symbol: 'NSE:VEDL26SEP255PE',
    displayName: 'VEDL 255 PE',
    tradeType: 'PUT BUY',
    setupName: 'Positional 1-Week',
    entryPrice: 6.50,
    currentPrice: 11.50,
    target1: 9.50,
    target2: 11.50,
    target3: 14.00,
    stopLoss: 5.30,
    finalAchievedPrice: 11.50,
    finalStatus: 'TARGET 2 HIT',
    isPriceFrozen: false,
    ptsGained: 5.00,
    roiPct: 76.92,
    holdingTime: '1 Week Trade',
    riskReward: '1:4.17',
    notes: 'Buy VEDL 29 Sep 2026 PE 255 near 6-7. SL 5.3. TGT 9.5-11.5. 1 Week Positional Trade. Posted at 09:40 AM.'
  },
  {
    id: 'MT-20260916-02',
    date: '2026-09-16 09:26',
    symbol: 'NSE:RELIANCE26SEP1260CE',
    displayName: 'RELIANCE 1260 CE',
    tradeType: 'CALL BUY',
    setupName: 'Hero or Zero',
    entryPrice: 12.50,
    currentPrice: 16.35,
    target1: 20.00,
    target2: 27.00,
    target3: 40.00,
    stopLoss: 5.00,
    finalAchievedPrice: 16.35,
    finalStatus: 'LIVE ACTIVE',
    isPriceFrozen: false,
    ptsGained: 3.85,
    roiPct: 30.80,
    holdingTime: 'Hold Till Expiry',
    riskReward: '1:3.67',
    notes: 'Hero or Zero setup. BUY RELIANCE 1260 CE @ 15/10. Current LTP: 16.35. Targets: 20, 27, 40+. Hold Till Expiry.'
  },
  {
    id: 'MT-20260916-01',
    date: '2026-09-16 09:15',
    symbol: 'NSE:DIXON26SEP13000PE',
    displayName: 'DIXON 13000 PE',
    tradeType: 'PUT BUY',
    setupName: 'Breakout Surge',
    entryPrice: 260.00,
    currentPrice: 320.00,
    target1: 280.00,
    target2: 300.00,
    target3: 320.00,
    stopLoss: 210.00,
    finalAchievedPrice: 320.00,
    finalStatus: 'TARGET 3 HIT',
    isPriceFrozen: true,
    ptsGained: 60.0,
    roiPct: 23.08,
    holdingTime: 'Intraday',
    riskReward: '1:1.20',
    notes: 'DIXON 13000 PE BUY ABOVE 260. SL 210. Targets: 280, 300, 320++. Target 3 Achieved!'
  },
  {
    id: 'MT-20260915-01',
    date: '2026-09-15 09:16',
    symbol: 'NSE:NIFTY26SEP23550PE',
    displayName: 'NIFTY 23550 PE',
    tradeType: 'PUT BUY',
    setupName: 'Hero or Zero',
    entryPrice: 75.00,
    currentPrice: 200.00,
    target1: 92.00,
    target2: 130.00,
    target3: 200.00,
    stopLoss: 40.00,
    finalAchievedPrice: 200.00,
    finalStatus: 'TARGET 3 HIT',
    isPriceFrozen: true,
    ptsGained: 125.0,
    roiPct: 166.67,
    holdingTime: 'Intraday',
    riskReward: '1:3.57',
    notes: 'Hero or Zero setup triggered at 09:16 AM. Targets: 92, 130, 200+. Target 3 Achieved!'
  }
];

function getUnderlyingSymbol(raw: string): string {
  const upper = raw.toUpperCase();
  if (upper.includes('CRUDE')) return 'MCX:CRUDEOIL1!';
  if (upper.includes('MIDCAP') || upper.includes('MIDCP')) return 'NSE:MIDCPNIFTY';
  if (upper.includes('NIFTY') && !upper.includes('BANKNIFTY')) return 'NSE:NIFTY';
  if (upper.includes('BANKNIFTY')) return 'NSE:BANKNIFTY';
  if (upper.includes('RELIANCE')) return 'NSE:RELIANCE';
  if (upper.includes('DIXON')) return 'NSE:DIXON';
  if (upper.includes('VEDL')) return 'NSE:VEDL';
  if (upper.includes('SHYAMMETL')) return 'NSE:SHYAMMETL';
  if (upper.includes('INDGN')) return 'NSE:INDGN';
  if (upper.includes('INDHOTEL')) return 'NSE:INDHOTEL';
  if (upper.includes('HEROMOTOCO')) return 'NSE:HEROMOTOCO';
  if (upper.includes('EIML')) return 'NSE:EIML';
  if (raw.startsWith('NSE:') || raw.startsWith('BSE:') || raw.startsWith('MCX:')) {
    if (!/[0-9]+[CP]E$/i.test(raw)) return raw;
  }
  return 'NSE:NIFTY';
}

function processImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (readerEvent) => {
      const img = new window.Image();
      img.onload = () => {
        const maxWidth = 1920;
        const maxHeight = 1080;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          if (width / height > maxWidth / maxHeight) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(readerEvent.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
        resolve(dataUrl);
      };
      img.onerror = () => {
        resolve(readerEvent.target?.result as string);
      };
      img.src = readerEvent.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export interface ManualTradesContainerProps {
  onSymbolSelect?: (symbol: string) => void;
  onSwitchToChart?: () => void;
}

export const ManualTradesContainer: React.FC<ManualTradesContainerProps> = ({ onSymbolSelect, onSwitchToChart }) => {
  // Load trades from localStorage (default to DEFAULT_MANUAL_TRADES)
  const [trades, setTrades] = useState<ManualTrade[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.error('Failed to parse saved manual trades:', e);
    }
    return DEFAULT_MANUAL_TRADES;
  });

  // Save to localStorage whenever trades change
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(trades));
    } catch (e) {
      console.error('Failed to save manual trades to localStorage:', e);
    }
  }, [trades]);

  // Sync with backend API on mount
  useEffect(() => {
    let isMounted = true;
    const syncBackendTrades = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/manual-trades`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && Array.isArray(data.trades) && data.trades.length > 0) {
            setTrades(prev => {
              const backendMap = new Map(data.trades.map((t: ManualTrade) => [t.id, t]));
              const merged = [...data.trades];
              prev.forEach(t => {
                if (!backendMap.has(t.id)) merged.push(t);
              });
              return merged;
            });
          }
        }
      } catch (e) {
        // Fall back to local trades
      }
    };
    syncBackendTrades();
    return () => { isMounted = false; };
  }, []);

  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [priceFlash, setPriceFlash] = useState<Record<string, 'up' | 'down' | null>>({});
  const livePricesRef = React.useRef<Record<string, number>>({});

  useEffect(() => {
    livePricesRef.current = livePrices;
  }, [livePrices]);

  // 1. WebSocket Live Quotes Listener for instant 0ms broadcast ticks
  useEffect(() => {
    tvStreamer.setManualTradesQuotesListener((quotes: Record<string, any>) => {
      setLivePrices((prev) => {
        const next = { ...prev };
        const flashes: Record<string, 'up' | 'down' | null> = {};
        let changed = false;

        for (const [id, q] of Object.entries(quotes)) {
          if (q && q.ltp !== undefined && q.ltp !== null) {
            const oldP = prev[id] ?? q.ltp;
            if (q.ltp !== oldP) {
              flashes[id] = q.ltp > oldP ? 'up' : 'down';
              changed = true;
            }
            next[id] = q.ltp;
          }
        }

        if (changed && Object.keys(flashes).length > 0) {
          setPriceFlash(flashes);
          setTimeout(() => setPriceFlash({}), 600);
        }
        return next;
      });
    });
  }, []);

  // 2. Continuous Real-Time Price Engine & REST Fallback Poller (1000ms)
  useEffect(() => {
    let isMounted = true;

    // Fetch real-time live quotes directly from backend
    const pollBackendQuotes = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/manual-trades/live-quotes`, {
          headers: { 'bypass-tunnel-reminder': 'true' }
        });
        if (res.ok) {
          const data = await res.json();
          if (isMounted && data && data.quotes) {
            setLivePrices((prev) => {
              const next = { ...prev };
              const flashes: Record<string, 'up' | 'down' | null> = {};
              let changed = false;

              for (const [id, q] of Object.entries(data.quotes as Record<string, any>)) {
                if (q && q.ltp !== undefined && q.ltp !== null) {
                  const oldP = prev[id] ?? q.ltp;
                  if (q.ltp !== oldP) {
                    flashes[id] = q.ltp > oldP ? 'up' : 'down';
                    changed = true;
                  }
                  next[id] = q.ltp;
                }
              }

              if (changed && Object.keys(flashes).length > 0) {
                setPriceFlash(flashes);
                setTimeout(() => {
                  if (isMounted) setPriceFlash({});
                }, 600);
              }
              return next;
            });
            return;
          }
        }
      } catch (e) {
        // Backend offline or static HF Space
      }
    };

    // Initial instant fetch
    pollBackendQuotes();

    // High frequency interval (every 1000ms) ensures continuous live pricing
    const interval = setInterval(pollBackendQuotes, 1000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [trades]);

  
  // Sync manual trades with backend & listen for real-time broadcasts
  useEffect(() => {
    const syncBackendTrades = async () => {
      try {
        const backendHttp = await getBackendHttpUrl();
        const res = await fetch(`${backendHttp}/api/manual-trades`);
        if (res.ok) {
          const data = await res.json();
          if (data.trades && Array.isArray(data.trades) && data.trades.length > 0) {
            setTrades(data.trades);
          }
        }
      } catch (e) {}
    };
    syncBackendTrades();

    tvStreamer.setManualTradeAddedListener((trade) => {
      setTrades((prev) => {
        const idx = prev.findIndex(t => t.id === trade.id);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = trade;
          return updated;
        }
        return [trade, ...prev];
      });
    });

    tvStreamer.setManualTradeDeletedListener((id) => {
      setTrades((prev) => prev.filter(t => t.id !== id));
    });

    tvStreamer.setManualTradesClearedListener(() => {
      setTrades([]);
      getBackendHttpUrl().then(backendHttp => {
        fetch(`${backendHttp}/api/manual-trades`, { method: 'DELETE' }).catch(() => {});
      });
    });
  }, []);

  // Radio button toggle function to stop/freeze price updates per trade
  const handleTogglePriceFreeze = (tradeId: string, freeze: boolean) => {
    setTrades((prev) =>
      prev.map((t) => {
        if (t.id === tradeId) {
          const frozenPrice = livePrices[t.id] ?? t.currentPrice ?? t.finalAchievedPrice ?? t.entryPrice ?? 0;
          const gain = Number((frozenPrice - (t.entryPrice || 0)).toFixed(1));
          let status = t.finalStatus;
          if (freeze) {
            if (t.target3 > 0 && frozenPrice >= t.target3) status = 'TARGET 3 HIT';
            else if (t.target2 > 0 && frozenPrice >= t.target2) status = 'TARGET 2 HIT';
            else if (t.target1 > 0 && frozenPrice >= t.target1) status = 'TARGET 1 HIT';
            else if (t.stopLoss > 0 && frozenPrice <= t.stopLoss) status = 'STOP LOSS HIT';
            else status = 'STOPPED';
          } else {
            status = 'LIVE ACTIVE';
          }

          const updatedTrade: ManualTrade = {
            ...t,
            isPriceFrozen: freeze,
            currentPrice: Number(frozenPrice.toFixed(2)),
            finalAchievedPrice: Number(frozenPrice.toFixed(2)),
            ptsGained: gain,
            finalStatus: status
          };
          // Post to backend REST API to sync freeze state across all connected users
          getBackendHttpUrl().then((backendHttp) => {
            fetch(`${backendHttp}/api/manual-trades`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(updatedTrade)
            }).catch((err) => console.error('Failed to sync price freeze to backend:', err));
          });
          return updatedTrade;
        }
        return t;
      })
    );
  };

  // State for visual pulse when a voice alert is broadcasting
  const [announcingTradeId, setAnnouncingTradeId] = useState<string | null>(null);

  // Subscribe to real-time voice alert broadcasts from any open dashboard
  useEffect(() => {
    tvStreamer.addVoiceAnnouncementListener((alert) => {
      if (alert && alert.tradeId) {
        setAnnouncingTradeId(alert.tradeId);
        setTimeout(() => setAnnouncingTradeId(null), 3500);
      }
    });
  }, []);

  // Broadcast Voice Alert Announcement to all open dashboards
  const handlePushVoiceAlert = async (trade: ManualTrade) => {
    setAnnouncingTradeId(trade.id);
    setTimeout(() => setAnnouncingTradeId(null), 3500);

    const tradeTypeClean = (trade.tradeType || 'Call Buy').replace('BUY', 'Buy').replace('SHORT', 'Short').replace('LONG', 'Long');
    const nameClean = trade.displayName || trade.symbol || 'Contract';
    const entryClean = Number(trade.entryPrice || 0).toFixed(2);
    const slClean = Number(trade.stopLoss || 0).toFixed(2);
    const t1Clean = Number(trade.target1 || 0).toFixed(2);
    const t2Clean = Number(trade.target2 || 0).toFixed(2);
    const t3Clean = Number(trade.target3 || 0).toFixed(2);
    const currentLtp = livePrices[trade.id] ?? trade.currentPrice ?? trade.entryPrice ?? 0;

    const message = `Attention traders! Live Trade Alert: ${tradeTypeClean} ${nameClean}. Entry triggered at ${entryClean} rupees. Target 1: ${t1Clean}. Target 2: ${t2Clean}. Target 3: ${t3Clean}. Stop Loss: ${slClean}. Current LTP is ${Number(currentLtp).toFixed(2)} rupees.`;

    try {
      const backendHttp = await getBackendHttpUrl();
      await fetch(`${backendHttp}/api/manual-trades/voice-alert`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tradeId: trade.id,
          trade,
          message,
          currentLtp
        })
      });
    } catch (err) {
      console.error('Failed to broadcast voice alert to backend:', err);
    }
  };


  const [filterStatus, setFilterStatus] = useState<'ALL' | 'NIFTY' | 'BANKNIFTY' | 'LIVE_ACTIVE' | 'TARGET_HIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);

  // Marked Chart Inspection Modal state
  const [selectedTradeForModal, setSelectedTradeForModal] = useState<ManualTrade | null>(null);
  const [isChartFullscreen, setIsChartFullscreen] = useState<boolean>(false);

  // Form Field State
  const [formData, setFormData] = useState<{
    displayName: string;
    symbol: string;
    tradeType: 'CALL BUY' | 'PUT BUY' | 'FUT LONG' | 'FUT SHORT';
    setupName: string;
    entryPrice: string;
    currentPrice: string;
    stopLoss: string;
    target1: string;
    target2: string;
    target3: string;
    finalAchievedPrice: string;
    finalStatus: 'TARGET 3 HIT' | 'TARGET 2 HIT' | 'TARGET 1 HIT' | 'LIVE ACTIVE' | 'STOP LOSS HIT';
    isPriceFrozen: boolean;
    notes: string;
    chartImage: string;
    date: string;
  }>({
    displayName: '',
    symbol: '',
    tradeType: 'CALL BUY',
    setupName: 'Hero or Zero',
    entryPrice: '',
    currentPrice: '',
    stopLoss: '',
    target1: '',
    target2: '',
    target3: '',
    finalAchievedPrice: '',
    finalStatus: 'LIVE ACTIVE',
    isPriceFrozen: false,
    notes: '',
    chartImage: '',
    date: new Date().toISOString().replace('T', ' ').substring(0, 16)
  });

  const resetForm = () => {
    const nowStr = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setFormData({
      displayName: '',
      symbol: '',
      tradeType: 'CALL BUY',
      setupName: 'Hero or Zero',
      entryPrice: '',
      currentPrice: '',
      stopLoss: '',
      target1: '',
      target2: '',
      target3: '',
      finalAchievedPrice: '',
      finalStatus: 'LIVE ACTIVE',
      isPriceFrozen: false,
      notes: '',
      chartImage: '',
      date: nowStr
    });
    setEditingTradeId(null);
  };

  const handleOpenNewForm = () => {
    resetForm();
    setIsFormOpen(true);
  };

  const handleEditTrade = (t: ManualTrade) => {
    setEditingTradeId(t.id);
    setFormData({
      displayName: t.displayName || '',
      symbol: t.symbol || '',
      tradeType: t.tradeType || 'CALL BUY',
      setupName: t.setupName || 'Hero or Zero',
      entryPrice: t.entryPrice !== undefined ? String(t.entryPrice) : '',
      currentPrice: t.currentPrice !== undefined ? String(t.currentPrice) : (t.finalAchievedPrice !== undefined ? String(t.finalAchievedPrice) : ''),
      stopLoss: t.stopLoss !== undefined ? String(t.stopLoss) : '',
      target1: t.target1 !== undefined ? String(t.target1) : '',
      target2: t.target2 !== undefined ? String(t.target2) : '',
      target3: t.target3 !== undefined ? String(t.target3) : '',
      finalAchievedPrice: t.finalAchievedPrice !== undefined ? String(t.finalAchievedPrice) : '',
      finalStatus: t.finalStatus || 'LIVE ACTIVE',
      isPriceFrozen: Boolean(t.isPriceFrozen),
      notes: t.notes || '',
      chartImage: t.chartImage || '',
      date: t.date || new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    setIsFormOpen(true);
  };

  const handleFormImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await processImageFile(file);
      setFormData(prev => ({ ...prev, chartImage: dataUrl }));
    } catch (err) {
      console.error('Failed to process image:', err);
    }
  };

  const handleModalChartUpload = async (tradeId: string, file: File) => {
    try {
      const dataUrl = await processImageFile(file);
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, chartImage: dataUrl } : t));
      setSelectedTradeForModal(prev => prev && prev.id === tradeId ? { ...prev, chartImage: dataUrl } : prev);

      const updatedTrade = trades.find(t => t.id === tradeId);
      if (updatedTrade) {
        const payload = { ...updatedTrade, chartImage: dataUrl };
        getBackendHttpUrl().then(backendHttp => {
          fetch(`${backendHttp}/api/manual-trades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => {});
        });
      }
    } catch (err) {
      console.error('Failed to process image:', err);
    }
  };

  const handleRemoveModalChart = (tradeId: string) => {
    if (window.confirm('Remove the marked chart from this trade?')) {
      setTrades(prev => prev.map(t => t.id === tradeId ? { ...t, chartImage: undefined } : t));
      setSelectedTradeForModal(prev => prev && prev.id === tradeId ? { ...prev, chartImage: undefined } : prev);

      const updatedTrade = trades.find(t => t.id === tradeId);
      if (updatedTrade) {
        const payload = { ...updatedTrade, chartImage: '' };
        getBackendHttpUrl().then(backendHttp => {
          fetch(`${backendHttp}/api/manual-trades`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          }).catch(() => {});
        });
      }
    }
  };

  const handleDeleteTrade = (id: string) => {
    if (window.confirm('Are you sure you want to delete this trade entry?')) {
      setTrades((prev) => prev.filter((t) => t.id !== id));
      getBackendHttpUrl().then(backendHttp => {
        fetch(`${backendHttp}/api/manual-trades/${id}`, { method: 'DELETE' }).catch(() => {});
      });
    }
  };

  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear ALL manual trades?')) {
      setTrades([]);
    }
  };

  const handleResetDefault = () => {
    if (window.confirm('Reset manual trades list to default trade?')) {
      setTrades(DEFAULT_MANUAL_TRADES);
    }
  };

  const handleSubmitForm = (e: React.FormEvent) => {
    e.preventDefault();

    const entry = parseFloat(formData.entryPrice) || 0;
    const currPrice = parseFloat(formData.currentPrice) || parseFloat(formData.finalAchievedPrice) || entry;
    const sl = parseFloat(formData.stopLoss) || 0;
    const t1 = parseFloat(formData.target1) || 0;
    const t2 = parseFloat(formData.target2) || 0;
    const t3 = parseFloat(formData.target3) || 0;
    const achieved = parseFloat(formData.finalAchievedPrice) || entry;

    let pts = achieved - entry;

    const roi = entry > 0 ? (pts / entry) * 100 : 0;
    const formattedSymbol = formData.symbol.trim() || `NSE:${formData.displayName.replace(/\s+/g, '')}`;

    const newTradeRecord: ManualTrade = {
      id: editingTradeId || `MT-${Date.now().toString().slice(-4)}`,
      date: formData.date.trim() || new Date().toISOString().replace('T', ' ').substring(0, 16),
      symbol: formattedSymbol,
      displayName: formData.displayName.trim() || 'CUSTOM CONTRACT',
      tradeType: formData.tradeType,
      setupName: formData.setupName.trim() || 'Manual Entry',
      entryPrice: entry,
      currentPrice: currPrice,
      stopLoss: sl,
      target1: t1,
      target2: t2,
      target3: t3,
      finalAchievedPrice: achieved,
      finalStatus: formData.finalStatus,
      isPriceFrozen: formData.isPriceFrozen,
      ptsGained: Number(pts.toFixed(2)),
      roiPct: Number(roi.toFixed(2)),
      holdingTime: 'Intraday',
      riskReward: sl !== entry ? `1:${((t1 - entry) / Math.abs(entry - sl)).toFixed(1)}` : '1:2.0',
      notes: formData.notes.trim(),
      chartImage: formData.chartImage || ''
    };

    if (editingTradeId) {
      setTrades((prev) => prev.map((t) => (t.id === editingTradeId ? newTradeRecord : t)));
    } else {
      setTrades((prev) => [newTradeRecord, ...prev]);
    }

    // Post to backend REST API to broadcast real-time alert to all connected users
    getBackendHttpUrl().then(backendHttp => {
      fetch(`${backendHttp}/api/manual-trades`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newTradeRecord)
      }).catch(err => console.error('Failed to post manual trade to backend:', err));
    });

    setIsFormOpen(false);
    resetForm();
  };

  const filteredTrades = useMemo(() => {
    return trades.filter((trade) => {
      // Symbol / Category Filter
      if (filterStatus === 'NIFTY' && !trade.displayName.toUpperCase().includes('NIFTY')) return false;
      if (filterStatus === 'BANKNIFTY' && !trade.displayName.toUpperCase().includes('BANKNIFTY')) return false;
      if (filterStatus === 'LIVE_ACTIVE' && trade.finalStatus !== 'LIVE ACTIVE') return false;
      if (filterStatus === 'TARGET_HIT' && !trade.finalStatus.startsWith('TARGET')) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSymbol = (trade.symbol || '').toLowerCase().includes(q);
        const matchesName = (trade.displayName || '').toLowerCase().includes(q);
        const matchesSetup = (trade.setupName || '').toLowerCase().includes(q);
        if (!matchesSymbol && !matchesName && !matchesSetup) return false;
      }

      return true;
    });
  }, [trades, filterStatus, searchQuery]);

  // Performance Summary
  const summaryStats = useMemo(() => {
    const total = trades.length;
    let targetHits = 0;
    let target3Hits = 0;
    let liveActive = 0;
    let totalPts = 0;

    trades.forEach((t) => {
      const isLiveUpdating = !t.isPriceFrozen;
      const liveLtp = isLiveUpdating
        ? (livePrices[t.id] ?? t.currentPrice ?? t.entryPrice ?? 0)
        : (t.currentPrice ?? t.finalAchievedPrice ?? t.entryPrice ?? 0);
      const achieved = isLiveUpdating ? liveLtp : (t.finalAchievedPrice ?? liveLtp);
      const pts = (achieved && t.entryPrice) ? (achieved - t.entryPrice) : (t.ptsGained ?? 0);
      totalPts += pts;

      const isT3 = (t.target3 > 0 && achieved >= t.target3) || t.finalStatus === 'TARGET 3 HIT';
      const isT2 = !isT3 && ((t.target2 > 0 && achieved >= t.target2) || t.finalStatus === 'TARGET 2 HIT');
      const isT1 = !isT3 && !isT2 && ((t.target1 > 0 && achieved >= t.target1) || t.finalStatus === 'TARGET 1 HIT');
      const isSL = (t.stopLoss > 0 && achieved <= t.stopLoss) || t.finalStatus === 'STOP LOSS HIT';

      if (isT3) {
        target3Hits++;
        targetHits++;
      } else if (isT2 || isT1) {
        targetHits++;
      } else if (!isSL) {
        liveActive++;
      }
    });

    const denominator = total - liveActive;
    const winRate = denominator > 0 ? Math.round((targetHits / denominator) * 1000) / 10 : (targetHits > 0 ? 100 : 0);
    const avgPts = total > 0 ? Math.round((totalPts / total) * 10) / 10 : 0;

    return {
      totalTrades: total,
      targetHits,
      target3Hits,
      liveActive,
      winRate,
      totalPts: Math.round(totalPts * 10) / 10,
      avgPts
    };
  }, [trades, livePrices]);

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      
      {/* HEADER TITLE BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(15, 23, 42, 0.8)', padding: '14px 20px', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #10b981, #059669)', padding: '8px', borderRadius: '10px', boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)' }}>
            <FileText size={22} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'white', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Manual Trades Tracker</span>
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800' }}>
                LIVE JOURNAL
              </span>
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Record and track custom manual trade setups with Entry Range, Stop Loss, Targets 1–3, and Radio button to Freeze / Stop live price updating.
            </p>
          </div>
        </div>

        {/* Action Buttons & Search */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search contract / setup..."
              style={{
                background: '#0b0f19',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                borderRadius: '8px',
                padding: '8px 14px 8px 36px',
                color: 'white',
                fontSize: '12px',
                fontWeight: '600',
                width: '180px'
              }}
            />
          </div>

          <button
            onClick={handleOpenNewForm}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              border: 'none',
              padding: '8px 16px',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: '0 0 14px rgba(16, 185, 129, 0.3)'
            }}
          >
            <Plus size={16} />
            <span>+ Add New Trade</span>
          </button>

          <button
            onClick={handleResetDefault}
            title="Reset to default trade"
            style={{
              background: 'rgba(59, 130, 246, 0.15)',
              color: '#60a5fa',
              border: '1px solid rgba(59, 130, 246, 0.3)',
              padding: '8px 12px',
              borderRadius: '8px',
              fontWeight: '700',
              fontSize: '12px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <RotateCcw size={14} />
            <span>Reset</span>
          </button>

          {trades.length > 0 && (
            <button
              onClick={handleClearAll}
              title="Clear all manual trades"
              style={{
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#f87171',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                padding: '8px 12px',
                borderRadius: '8px',
                fontWeight: '700',
                fontSize: '12px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <Trash2 size={14} />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        
        {/* Card 1: Total Trades Logged */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>Manual Trades Logged</span>
            <Layers size={16} color="#10b981" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff' }}>{summaryStats.totalTrades}</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Total entries recorded</span>
        </div>

        {/* Card 2: Target Win Rate */}
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: '700', textTransform: 'uppercase' }}>Target Win Rate</span>
            <Award size={16} color="#10b981" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>{summaryStats.winRate}%</span>
          <span style={{ fontSize: '11px', color: '#6ee7b7' }}>{summaryStats.targetHits} Target Hits achieved</span>
        </div>

        {/* Card 3: Total Points Captured */}
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase' }}>Total Points Captured</span>
            <TrendingUp size={16} color="#3b82f6" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#60a5fa' }}>{summaryStats.totalPts >= 0 ? `+${summaryStats.totalPts.toLocaleString()}` : summaryStats.totalPts.toLocaleString()} pts</span>
          <span style={{ fontSize: '11px', color: '#93c5fd' }}>Avg {summaryStats.avgPts >= 0 ? `+${summaryStats.avgPts}` : summaryStats.avgPts} pts / setup</span>
        </div>

        {/* Card 4: Target 3 Clean Sweeps */}
        <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#fde047', fontWeight: '700', textTransform: 'uppercase' }}>Target 3 Clean Sweeps</span>
            <Flame size={16} color="#f59e0b" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#facc15' }}>{summaryStats.target3Hits}</span>
          <span style={{ fontSize: '11px', color: '#fef08a' }}>Max target 3 hit setups</span>
        </div>
      </div>

      {/* FILTER TABS */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
        {[
          { id: 'ALL', label: `All Setups (${trades.length})` },
          { id: 'NIFTY', label: `NIFTY` },
          { id: 'BANKNIFTY', label: `BANK NIFTY` },
          { id: 'LIVE_ACTIVE', label: `Live Active (${summaryStats.liveActive})` },
          { id: 'TARGET_HIT', label: `Targets Achieved (${summaryStats.targetHits})` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id as any)}
            style={{
              background: filterStatus === tab.id ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: filterStatus === tab.id ? '1px solid #10b981' : '1px solid transparent',
              color: filterStatus === tab.id ? '#10b981' : 'var(--text-secondary)',
              padding: '6px 14px',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* MANUAL TRADES FORM MODAL */}
      {isFormOpen && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.75)',
          backdropFilter: 'blur(6px)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: '#0f172a',
            border: '1px solid rgba(16, 185, 129, 0.4)',
            borderRadius: '16px',
            width: '100%',
            maxWidth: '650px',
            maxHeight: '90vh',
            overflowY: 'auto',
            padding: '24px',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Target size={20} color="#10b981" />
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '900', color: '#ffffff' }}>
                  {editingTradeId ? 'Edit Manual Trade Entry' : 'Add New Manual Trade'}
                </h3>
              </div>
              <button
                onClick={() => setIsFormOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Contract Name */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', fontWeight: '700', marginBottom: '4px' }}>
                    Contract Name *
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.displayName}
                    onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                    placeholder="e.g. NIFTY 23550 PE"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                  />
                </div>

                {/* Trade Type */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', fontWeight: '700', marginBottom: '4px' }}>
                    Trade Type *
                  </label>
                  <select
                    value={formData.tradeType}
                    onChange={(e) => setFormData({ ...formData, tradeType: e.target.value as any })}
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                  >
                    <option value="EQUITY BUY">EQUITY BUY 📈</option>
                    <option value="CALL BUY">CALL BUY 📈</option>
                    <option value="PUT BUY">PUT BUY 📉</option>
                    <option value="FUT LONG">FUT LONG 🚀</option>
                    <option value="FUT SHORT">FUT SHORT 🔻</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {/* Setup Pattern */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', fontWeight: '700', marginBottom: '4px' }}>
                    Setup Pattern
                  </label>
                  <input
                    type="text"
                    value={formData.setupName}
                    onChange={(e) => setFormData({ ...formData, setupName: e.target.value })}
                    placeholder="e.g. Hero or Zero"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                  />
                </div>

                {/* Date & Time */}
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', fontWeight: '700', marginBottom: '4px' }}>
                    Date & Time
                  </label>
                  <input
                    type="text"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    placeholder="YYYY-MM-DD HH:mm"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              {/* Price Mode Radio Selection */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', fontWeight: '700', marginBottom: '4px' }}>
                  Price Live Stream Mode (Radio Selection)
                </label>
                <div style={{
                  display: 'flex',
                  gap: '16px',
                  alignItems: 'center',
                  background: '#0b0f19',
                  padding: '8px 12px',
                  borderRadius: '6px',
                  border: '1px solid rgba(255, 255, 255, 0.15)'
                }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: !formData.isPriceFrozen ? '#00f0ff' : '#94a3b8', fontWeight: '700', fontSize: '12px' }}>
                    <input
                      type="radio"
                      name="form_price_mode"
                      checked={!formData.isPriceFrozen}
                      onChange={() => setFormData({ ...formData, isPriceFrozen: false })}
                      style={{ accentColor: '#00f0ff', width: '13px', height: '13px', cursor: 'pointer' }}
                    />
                    <span>🟢 Live Updating (Stream Ticks)</span>
                  </label>

                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', color: formData.isPriceFrozen ? '#f59e0b' : '#94a3b8', fontWeight: '700', fontSize: '12px' }}>
                    <input
                      type="radio"
                      name="form_price_mode"
                      checked={Boolean(formData.isPriceFrozen)}
                      onChange={() => setFormData({ ...formData, isPriceFrozen: true })}
                      style={{ accentColor: '#f59e0b', width: '13px', height: '13px', cursor: 'pointer' }}
                    />
                    <span>🔒 Stop / Freeze Price (Static Exit)</span>
                  </label>
                </div>
              </div>

              {/* Price Parameters Grid */}
              <div style={{
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: '10px',
                padding: '12px',
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
                gap: '10px'
              }}>
                {/* Current Price / LTP */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#00f0ff', fontWeight: '900', marginBottom: '4px' }}>
                    Current Price / LTP (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.currentPrice}
                    onChange={(e) => setFormData({ ...formData, currentPrice: e.target.value })}
                    placeholder="40.00"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(0, 240, 255, 0.6)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#00f0ff',
                      fontSize: '12px',
                      fontWeight: '900'
                    }}
                  />
                </div>

                {/* Entry Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#ffffff', fontWeight: '800', marginBottom: '4px' }}>
                    Entry Price (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={formData.entryPrice}
                    onChange={(e) => setFormData({ ...formData, entryPrice: e.target.value })}
                    placeholder="75.00"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(16, 185, 129, 0.5)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}
                  />
                </div>

                {/* Stop Loss */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#f87171', fontWeight: '800', marginBottom: '4px' }}>
                    Stop Loss (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={formData.stopLoss}
                    onChange={(e) => setFormData({ ...formData, stopLoss: e.target.value })}
                    placeholder="40.00"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(239, 68, 68, 0.5)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#f87171',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}
                  />
                </div>

                {/* Target 1 */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#60a5fa', fontWeight: '800', marginBottom: '4px' }}>
                    Target 1 (₹) *
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    required
                    value={formData.target1}
                    onChange={(e) => setFormData({ ...formData, target1: e.target.value })}
                    placeholder="92.00"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(59, 130, 246, 0.5)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#60a5fa',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}
                  />
                </div>

                {/* Target 2 */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#34d399', fontWeight: '800', marginBottom: '4px' }}>
                    Target 2 (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.target2}
                    onChange={(e) => setFormData({ ...formData, target2: e.target.value })}
                    placeholder="130.00"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(52, 211, 153, 0.5)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#34d399',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}
                  />
                </div>

                {/* Target 3 */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#facc15', fontWeight: '800', marginBottom: '4px' }}>
                    Target 3 (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.target3}
                    onChange={(e) => setFormData({ ...formData, target3: e.target.value })}
                    placeholder="200.00"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(250, 204, 21, 0.5)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#facc15',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}
                  />
                </div>

                {/* Achieved Exit Price */}
                <div>
                  <label style={{ display: 'block', fontSize: '10px', color: '#00f0ff', fontWeight: '900', marginBottom: '4px' }}>
                    Achieved Exit (₹)
                  </label>
                  <input
                    type="number"
                    step="0.05"
                    value={formData.finalAchievedPrice}
                    onChange={(e) => setFormData({ ...formData, finalAchievedPrice: e.target.value })}
                    placeholder="200.00"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(0, 240, 255, 0.6)',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      color: '#00f0ff',
                      fontSize: '12px',
                      fontWeight: '900'
                    }}
                  />
                </div>
              </div>

              {/* Status & Notes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '12px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', fontWeight: '700', marginBottom: '4px' }}>
                    Final Status *
                  </label>
                  <select
                    value={formData.finalStatus}
                    onChange={(e) => setFormData({ ...formData, finalStatus: e.target.value as any })}
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: '800'
                    }}
                  >
                    <option value="LIVE ACTIVE">⚡ LIVE ACTIVE</option>
                    <option value="TARGET 1 HIT">✅ TARGET 1 HIT</option>
                    <option value="TARGET 2 HIT">🚀 TARGET 2 HIT</option>
                    <option value="TARGET 3 HIT">🎯 TARGET 3 HIT</option>
                    <option value="STOP LOSS HIT">🛑 STOP LOSS HIT</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: '#cbd5e1', fontWeight: '700', marginBottom: '4px' }}>
                    Notes / Comments
                  </label>
                  <input
                    type="text"
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="e.g. Hero or Zero setup posted at 09:16 AM"
                    style={{
                      width: '100%',
                      background: '#0b0f19',
                      border: '1px solid rgba(255, 255, 255, 0.15)',
                      borderRadius: '6px',
                      padding: '8px 10px',
                      color: '#ffffff',
                      fontSize: '12px'
                    }}
                  />
                </div>
              </div>

              {/* Upload Marked Chart in Form */}
              <div style={{ background: 'rgba(16, 185, 129, 0.04)', padding: '14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.25)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Image size={15} color="#10b981" />
                    <label style={{ fontSize: '11px', color: '#34d399', fontWeight: '800' }}>
                      Marked Chart Screenshot (Optional)
                    </label>
                  </div>
                  {formData.chartImage && (
                    <span style={{ fontSize: '10px', color: '#10b981', fontWeight: '800', background: 'rgba(16, 185, 129, 0.2)', padding: '2px 6px', borderRadius: '4px' }}>
                      ✓ Image Attached
                    </span>
                  )}
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', marginTop: '8px' }}>
                  <label style={{
                    background: 'rgba(16, 185, 129, 0.2)',
                    border: '1px solid #10b981',
                    color: '#34d399',
                    padding: '6px 14px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '11px',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}>
                    <Upload size={14} />
                    <span>{formData.chartImage ? 'Replace Image' : 'Upload Marked Chart File'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={handleFormImageUpload}
                    />
                  </label>

                  {formData.chartImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{
                        width: '48px',
                        height: '32px',
                        borderRadius: '4px',
                        overflow: 'hidden',
                        border: '1px solid #10b981',
                        background: '#000'
                      }}>
                        <img src={formData.chartImage} alt="Chart preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      </div>
                      <button
                        type="button"
                        onClick={() => setFormData({ ...formData, chartImage: '' })}
                        style={{
                          background: 'rgba(239, 68, 68, 0.2)',
                          border: '1px solid rgba(239, 68, 68, 0.4)',
                          color: '#ef4444',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontSize: '10px',
                          cursor: 'pointer'
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>
                <div style={{ fontSize: '10px', color: '#94a3b8', marginTop: '6px' }}>
                  Upload a TradingView/Angel One marked chart screenshot showing entry level, stop loss, or target zones.
                </div>
              </div>

              {/* Submit Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    color: '#cbd5e1',
                    padding: '8px 16px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    border: 'none',
                    color: '#ffffff',
                    padding: '8px 20px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: '800',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
                  }}
                >
                  <Save size={15} />
                  <span>{editingTradeId ? 'Update Trade' : 'Save Trade Entry'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TABLE / EMPTY STATE */}
      {filteredTrades.length === 0 ? (
        <div style={{
          background: 'rgba(15, 23, 42, 0.4)',
          border: '1px dashed rgba(255, 255, 255, 0.15)',
          borderRadius: '12px',
          padding: '40px 20px',
          textAlign: 'center',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '14px'
        }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', padding: '16px', borderRadius: '50%' }}>
            <Target size={32} color="#10b981" />
          </div>
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '800', color: '#ffffff' }}>
              No Manual Trades Recorded Yet
            </h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '12px', color: '#94a3b8', maxWidth: '400px' }}>
              Enter your manual NIFTY & BANK NIFTY trades with Entry, Stop Loss, Targets 1–3, and Achieved Exit Price to track live performance.
            </p>
          </div>
          <button
            onClick={handleOpenNewForm}
            style={{
              background: 'linear-gradient(135deg, #10b981, #059669)',
              color: '#ffffff',
              border: 'none',
              padding: '10px 20px',
              borderRadius: '8px',
              fontWeight: '800',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 0 16px rgba(16, 185, 129, 0.4)'
            }}
          >
            <Plus size={16} />
            <span>+ Add Your First Trade</span>
          </button>
        </div>
      ) : (
        <div className="table-responsive-wrapper">
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
            <thead>
              <tr style={{ background: '#090d16', color: '#94a3b8', borderBottom: '1px solid var(--border-color)' }}>
                <th style={{ padding: '12px', textAlign: 'left' }}>Date & Contract</th>
                <th style={{ padding: '12px' }}>Type</th>
                <th style={{ padding: '12px' }}>Setup Pattern</th>
                <th style={{ padding: '12px' }}>Entry Price</th>
                <th style={{ padding: '12px', color: '#00f0ff' }}>Current Price (LTP)</th>
                <th style={{ padding: '12px', color: '#60a5fa' }}>Target 1</th>
                <th style={{ padding: '12px', color: '#34d399' }}>Target 2</th>
                <th style={{ padding: '12px', color: '#facc15' }}>Target 3</th>
                <th style={{ padding: '12px', color: '#fca5a5' }}>Stop Loss</th>
                <th style={{ padding: '12px', color: '#00f0ff' }}>Achieved Exit</th>
                <th style={{ padding: '12px' }}>Gain (Pts)</th>
                <th style={{ padding: '12px' }}>Status</th>
                <th style={{ padding: '12px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredTrades.map((t) => {
                const isLiveUpdating = !t.isPriceFrozen;
                const liveLtp = isLiveUpdating
                  ? (livePrices[t.id] ?? t.currentPrice ?? t.entryPrice ?? 0)
                  : (t.currentPrice ?? t.finalAchievedPrice ?? t.entryPrice ?? 0);

                // When Live is active, achievedPrice dynamically tracks liveLtp. When Stopped/Frozen, it holds the locked exit price.
                const achievedPrice = isLiveUpdating ? liveLtp : (t.finalAchievedPrice ?? liveLtp);
                const gainPts = (achievedPrice && t.entryPrice) ? (achievedPrice - t.entryPrice) : (t.ptsGained ?? 0);
                const roiPct = (t.entryPrice && t.entryPrice > 0) ? (gainPts / t.entryPrice) * 100 : 0;

                // Dynamic target/SL evaluation
                const isT3 = (t.target3 > 0 && achievedPrice >= t.target3) || (!isLiveUpdating && t.finalStatus === 'TARGET 3 HIT');
                const isT2 = !isT3 && ((t.target2 > 0 && achievedPrice >= t.target2) || (!isLiveUpdating && t.finalStatus === 'TARGET 2 HIT'));
                const isT1 = !isT3 && !isT2 && ((t.target1 > 0 && achievedPrice >= t.target1) || (!isLiveUpdating && t.finalStatus === 'TARGET 1 HIT'));
                const isSL = !isT3 && !isT2 && !isT1 && ((t.stopLoss > 0 && achievedPrice <= t.stopLoss) || (!isLiveUpdating && t.finalStatus === 'STOP LOSS HIT'));
                const isLive = isLiveUpdating && !isT3 && !isT2 && !isT1 && !isSL;
                const isFrozen = !isLiveUpdating;

                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: t.isPriceFrozen 
                        ? 'rgba(245, 158, 11, 0.05)'
                        : isLive 
                          ? 'rgba(0, 240, 255, 0.08)' 
                          : isT3 ? 'rgba(16, 185, 129, 0.06)' : isT2 ? 'rgba(16, 185, 129, 0.04)' : 'transparent'
                    }}
                  >
                    {/* Symbol & Date */}
                    <td style={{ padding: '12px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span 
                            onClick={() => setSelectedTradeForModal(t)}
                            title={`Click to view Details & Marked Chart for ${t.displayName}`}
                            style={{ 
                              fontSize: '13px', 
                              fontWeight: '900', 
                              color: '#ffffff',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px'
                            }}
                          >
                            {t.displayName}
                          </span>
                          {t.chartImage && (
                            <span 
                              onClick={() => setSelectedTradeForModal(t)}
                              title="Marked Chart Attached - Click to inspect"
                              style={{
                                background: 'rgba(16, 185, 129, 0.2)',
                                border: '1px solid rgba(16, 185, 129, 0.4)',
                                color: '#34d399',
                                padding: '1px 5px',
                                borderRadius: '4px',
                                fontSize: '9px',
                                fontWeight: '800',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px'
                              }}
                            >
                              <Image size={10} />
                              <span>CHART</span>
                            </span>
                          )}
                          {(onSymbolSelect || onSwitchToChart) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSymbolSelect) onSymbolSelect(t.symbol);
                                if (onSwitchToChart) onSwitchToChart();
                              }}
                              title={`View Candlestick Chart for ${t.displayName}`}
                              style={{
                                background: 'rgba(59, 130, 246, 0.15)',
                                border: '1px solid rgba(59, 130, 246, 0.35)',
                                color: '#60a5fa',
                                padding: '2px 5px',
                                borderRadius: '4px',
                                cursor: 'pointer',
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '2px',
                                fontSize: '10px',
                                fontWeight: '700'
                              }}
                            >
                              <BarChart2 size={11} />
                              <span>Chart</span>
                            </button>
                          )}
                        </div>
                        <span style={{ fontSize: '10px', color: '#94a3b8', fontFamily: 'monospace' }}>
                          {t.date} · <strong style={{ color: '#10b981' }}>{t.symbol}</strong>
                        </span>
                      </div>
                    </td>

                    {/* Trade Type */}
                    <td style={{ padding: '12px' }}>
                      <span style={{
                        background: t.tradeType.includes('BUY') || t.tradeType.includes('LONG') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: t.tradeType.includes('BUY') || t.tradeType.includes('LONG') ? '#10b981' : '#ef4444',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: '800'
                      }}>
                        {t.tradeType}
                      </span>
                    </td>

                    {/* Setup Type */}
                    <td style={{ padding: '12px' }}>
                      <span style={{ background: 'rgba(255, 255, 255, 0.05)', color: '#cbd5e1', padding: '3px 8px', borderRadius: '4px', fontSize: '11px', fontWeight: '700' }}>
                        {t.setupName}
                      </span>
                    </td>

                    {/* Entry Trigger Price */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '800', color: '#ffffff', fontSize: '13px' }}>
                      ₹{(t.entryPrice ?? 0).toFixed(2)}
                    </td>

                    {/* Current Price / LTP (Streaming Live or Frozen via Radio Toggle) */}
                    <td style={{ padding: '12px 14px', textAlign: 'center' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                        {t.isPriceFrozen ? (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: '#f59e0b',
                            fontWeight: '900',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            background: 'rgba(245, 158, 11, 0.15)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: '1px solid rgba(245, 158, 11, 0.3)'
                          }}>
                            <Lock size={12} color="#f59e0b" />
                            ₹{liveLtp.toFixed(2)}
                          </span>
                        ) : (
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '5px',
                            color: priceFlash[t.id] === 'up' ? '#10b981' : priceFlash[t.id] === 'down' ? '#ef4444' : '#00f0ff',
                            fontWeight: '900',
                            fontFamily: 'monospace',
                            fontSize: '13px',
                            background: priceFlash[t.id] === 'up' ? 'rgba(16, 185, 129, 0.25)' : priceFlash[t.id] === 'down' ? 'rgba(239, 68, 68, 0.25)' : 'rgba(0, 240, 255, 0.1)',
                            padding: '3px 8px',
                            borderRadius: '6px',
                            border: priceFlash[t.id] === 'up' ? '1px solid #10b981' : priceFlash[t.id] === 'down' ? '1px solid #ef4444' : '1px solid rgba(0, 240, 255, 0.25)',
                            boxShadow: priceFlash[t.id] === 'up' ? '0 0 10px rgba(16, 185, 129, 0.5)' : priceFlash[t.id] === 'down' ? '0 0 10px rgba(239, 68, 68, 0.5)' : 'none',
                            transition: 'all 0.25s ease-in-out'
                          }}>
                            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: priceFlash[t.id] === 'up' ? '#10b981' : priceFlash[t.id] === 'down' ? '#ef4444' : '#00f0ff', boxShadow: '0 0 8px currentColor' }} className="animate-pulse" />
                            ₹{liveLtp.toFixed(2)}
                          </span>
                        )}

                        {/* Radio Buttons Pair to toggle Live vs Stop Price */}
                        <div style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: 'rgba(0, 0, 0, 0.5)',
                          padding: '2px 8px',
                          borderRadius: '12px',
                          border: '1px solid rgba(255, 255, 255, 0.1)'
                        }}>
                          <label style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10px',
                            fontWeight: '800',
                            color: !t.isPriceFrozen ? '#00f0ff' : '#64748b'
                          }}>
                            <input
                              type="radio"
                              name={`price_mode_${t.id}`}
                              checked={!t.isPriceFrozen}
                              onChange={() => handleTogglePriceFreeze(t.id, false)}
                              style={{ accentColor: '#00f0ff', cursor: 'pointer', margin: 0, width: '11px', height: '11px' }}
                            />
                            <span>Live</span>
                          </label>

                          <span style={{ color: '#475569', fontSize: '9px' }}>|</span>

                          <label style={{
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '3px',
                            fontSize: '10px',
                            fontWeight: '800',
                            color: t.isPriceFrozen ? '#f59e0b' : '#64748b'
                          }}>
                            <input
                              type="radio"
                              name={`price_mode_${t.id}`}
                              checked={Boolean(t.isPriceFrozen)}
                              onChange={() => handleTogglePriceFreeze(t.id, true)}
                              style={{ accentColor: '#f59e0b', cursor: 'pointer', margin: 0, width: '11px', height: '11px' }}
                            />
                            <span>Stop</span>
                          </label>
                        </div>
                      </div>
                    </td>

                    {/* Target 1 */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#60a5fa', fontWeight: '700' }}>
                      ₹{(t.target1 ?? 0).toFixed(2)}
                    </td>

                    {/* Target 2 */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#34d399', fontWeight: '700' }}>
                      ₹{(t.target2 ?? 0).toFixed(2)}
                    </td>

                    {/* Target 3 */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#facc15', fontWeight: '800' }}>
                      ₹{(t.target3 ?? 0).toFixed(2)}
                    </td>

                    {/* Stop Loss */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', color: '#ef4444' }}>
                      ₹{(t.stopLoss ?? 0).toFixed(2)}
                    </td>

                    {/* Achieved Exit Price */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '900', color: isT3 || isT2 ? '#10b981' : isLiveUpdating ? '#00f0ff' : '#ffffff', fontSize: '13px' }}>
                      ₹{achievedPrice.toFixed(2)}
                    </td>

                    {/* Points Gained & ROI */}
                    <td style={{ padding: '12px', fontWeight: '900', color: gainPts >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontSize: '13px' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                        <span>{gainPts >= 0 ? `+${gainPts.toFixed(1)} pts` : `${gainPts.toFixed(1)} pts`}</span>
                        <span style={{ fontSize: '10px', opacity: 0.85, color: gainPts >= 0 ? '#34d399' : '#f87171' }}>
                          ({roiPct >= 0 ? `+${roiPct.toFixed(1)}%` : `${roiPct.toFixed(1)}%`})
                        </span>
                      </div>
                    </td>

                    {/* Final Status */}
                    <td style={{ padding: '12px' }}>
                      {isLive ? (
                        <span style={{ background: 'rgba(0, 240, 255, 0.2)', color: '#00f0ff', border: '1px solid #00f0ff', padding: '3px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '10px' }} className="animate-pulse">
                          ⚡ LIVE ACTIVE
                        </span>
                      ) : isT3 ? (
                        <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#facc15', border: '1px solid #f59e0b', padding: '3px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '10px' }}>
                          🎯 TARGET 3 HIT {isFrozen && '🔒'}
                        </span>
                      ) : isT2 ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px' }}>
                          🚀 TARGET 2 HIT {isFrozen && '🔒'}
                        </span>
                      ) : isT1 ? (
                        <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px' }}>
                          ✅ TARGET 1 HIT {isFrozen && '🔒'}
                        </span>
                      ) : isSL ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px' }}>
                          🛑 STOP LOSS HIT {isFrozen && '🔒'}
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', border: '1px solid #f59e0b', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px' }}>
                          ⏸️ FROZEN
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {/* Marked Chart Popup Button */}
                        <button
                          onClick={() => setSelectedTradeForModal(t)}
                          title={t.chartImage ? `View Marked Chart & Details for ${t.displayName}` : `Upload Marked Chart for ${t.displayName}`}
                          style={{
                            background: t.chartImage ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                            border: t.chartImage ? '1px solid #10b981' : '1px dashed rgba(255, 255, 255, 0.25)',
                            color: t.chartImage ? '#34d399' : '#cbd5e1',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: '700',
                            fontSize: '11px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <Image size={13} color={t.chartImage ? '#34d399' : '#94a3b8'} />
                          <span>{t.chartImage ? 'Marked' : '+ Chart'}</span>
                        </button>

                        {/* Candlestick Chart Button */}
                        <button
                          onClick={() => {
                            if (onSymbolSelect) onSymbolSelect(t.symbol);
                            if (onSwitchToChart) onSwitchToChart();
                          }}
                          title={`Open Candlestick Chart for ${t.displayName} (${t.symbol})`}
                          style={{
                            background: 'rgba(59, 130, 246, 0.2)',
                            border: '1px solid #3b82f6',
                            color: '#93c5fd',
                            padding: '4px 8px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                            fontWeight: '700',
                            fontSize: '11px',
                            transition: 'all 0.15s'
                          }}
                        >
                          <BarChart2 size={13} color="#60a5fa" />
                          <span>Chart</span>
                        </button>

                        {/* Voice Alert Announcement Speaker Button */}
                        <button
                          onClick={() => handlePushVoiceAlert(t)}
                          title="🔊 Broadcast Voice Announcement to all open dashboards"
                          style={{
                            background: announcingTradeId === t.id ? 'rgba(245, 158, 11, 0.45)' : 'rgba(245, 158, 11, 0.15)',
                            border: announcingTradeId === t.id ? '1px solid #f59e0b' : '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#f59e0b',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: announcingTradeId === t.id ? '0 0 12px rgba(245, 158, 11, 0.8)' : 'none',
                            transform: announcingTradeId === t.id ? 'scale(1.15)' : 'scale(1)',
                            transition: 'all 0.2s ease-in-out'
                          }}
                        >
                          <Volume2 size={13} className={announcingTradeId === t.id ? 'animate-bounce' : ''} />
                        </button>

                        <button
                          onClick={() => handleTogglePriceFreeze(t.id, !t.isPriceFrozen)}
                          title={t.isPriceFrozen ? 'Resume Live Price Streaming' : 'Stop / Freeze Current Price'}
                          style={{
                            background: t.isPriceFrozen ? 'rgba(245, 158, 11, 0.2)' : 'rgba(0, 240, 255, 0.15)',
                            border: t.isPriceFrozen ? '1px solid rgba(245, 158, 11, 0.4)' : '1px solid rgba(0, 240, 255, 0.3)',
                            color: t.isPriceFrozen ? '#f59e0b' : '#00f0ff',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          {t.isPriceFrozen ? <Lock size={13} /> : <Unlock size={13} />}
                        </button>
                        <button
                          onClick={() => handleEditTrade(t)}
                          title="Edit Trade"
                          style={{
                            background: 'rgba(59, 130, 246, 0.15)',
                            border: '1px solid rgba(59, 130, 246, 0.3)',
                            color: '#60a5fa',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => handleDeleteTrade(t.id)}
                          title="Delete Trade"
                          style={{
                            background: 'rgba(239, 68, 68, 0.15)',
                            border: '1px solid rgba(239, 68, 68, 0.3)',
                            color: '#f87171',
                            padding: '4px 6px',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TRADE DETAILS & MARKED CHART INSPECTION MODAL */}
      {selectedTradeForModal && (() => {
        const t = selectedTradeForModal;
        const isLiveUpdating = !t.isPriceFrozen;
        const liveLtp = isLiveUpdating
          ? (livePrices[t.id] ?? t.currentPrice ?? t.entryPrice ?? 0)
          : (t.currentPrice ?? t.finalAchievedPrice ?? t.entryPrice ?? 0);
        const achievedPrice = isLiveUpdating ? liveLtp : (t.finalAchievedPrice ?? liveLtp);
        const gainPts = (achievedPrice && t.entryPrice) ? (achievedPrice - t.entryPrice) : (t.ptsGained ?? 0);
        const roiPct = (t.entryPrice && t.entryPrice > 0) ? (gainPts / t.entryPrice) * 100 : 0;

        return (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.82)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '20px'
          }} onClick={() => setSelectedTradeForModal(null)}>
            <div style={{
              background: 'linear-gradient(135deg, #0f172a, #0b0f17)',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              borderRadius: '16px',
              maxWidth: '1240px',
              width: '95%',
              padding: '24px',
              maxHeight: '92vh',
              overflowY: 'auto',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.8), 0 0 40px rgba(16, 185, 129, 0.15)'
            }} onClick={(e) => e.stopPropagation()}>
              
              {/* Modal Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ fontSize: '22px', fontWeight: '800', margin: 0, color: '#fff' }}>
                      {t.displayName}
                    </h3>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: t.tradeType.includes('BUY') || t.tradeType.includes('LONG') ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                      color: t.tradeType.includes('BUY') || t.tradeType.includes('LONG') ? '#10b981' : '#ef4444',
                      border: t.tradeType.includes('BUY') || t.tradeType.includes('LONG') ? '1px solid rgba(16, 185, 129, 0.3)' : '1px solid rgba(239, 68, 68, 0.3)'
                    }}>
                      {t.tradeType}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      color: '#cbd5e1',
                      border: '1px solid rgba(255, 255, 255, 0.1)'
                    }}>
                      {t.setupName}
                    </span>
                    <span style={{
                      fontSize: '11px',
                      fontWeight: '700',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      background: t.finalStatus.startsWith('TARGET') ? 'rgba(16, 185, 129, 0.2)' : t.finalStatus === 'STOP LOSS HIT' ? 'rgba(239, 68, 68, 0.2)' : 'rgba(0, 240, 255, 0.2)',
                      color: t.finalStatus.startsWith('TARGET') ? '#10b981' : t.finalStatus === 'STOP LOSS HIT' ? '#ef4444' : '#00f0ff',
                      border: t.finalStatus.startsWith('TARGET') ? '1px solid rgba(16, 185, 129, 0.3)' : t.finalStatus === 'STOP LOSS HIT' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(0, 240, 255, 0.3)'
                    }}>
                      {t.finalStatus} {t.isPriceFrozen && '🔒'}
                    </span>
                  </div>
                  <p style={{ fontSize: '13px', color: '#94a3b8', margin: '4px 0 0 0' }}>
                    {t.date} · <strong style={{ color: '#10b981' }}>{t.symbol}</strong> | LTP: <strong style={{ color: '#00f0ff' }}>₹{liveLtp.toFixed(2)}</strong> ({gainPts >= 0 ? `+${gainPts.toFixed(2)} pts` : `${gainPts.toFixed(2)} pts`} / {roiPct >= 0 ? `+${roiPct.toFixed(2)}%` : `${roiPct.toFixed(2)}%`})
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedTradeForModal(null)}
                  style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}
                >
                  <X size={22} />
                </button>
              </div>

              {/* Side-by-Side Responsive Layout */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))',
                gap: '20px',
                alignItems: 'start'
              }}>
                {/* Left Column: Execution, Targets & Notes */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {/* Execution Levels Card */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: '12px', padding: '16px' }}>
                    <span style={{ fontSize: '12px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🎯 Trade Execution & Target Levels
                    </span>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginTop: '14px' }}>
                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Entry Trigger Price</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                          ₹{(t.entryPrice ?? 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Execution Level</div>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Stop Loss</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#ef4444', marginTop: '2px' }}>
                          ₹{(t.stopLoss ?? 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Risk: ₹{Math.abs((t.entryPrice ?? 0) - (t.stopLoss ?? 0)).toFixed(2)} pts</div>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target 1</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#60a5fa', marginTop: '2px' }}>
                          ₹{(t.target1 ?? 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Reward: ₹{((t.target1 ?? 0) - (t.entryPrice ?? 0)).toFixed(2)} pts</div>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target 2</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#34d399', marginTop: '2px' }}>
                          ₹{(t.target2 ?? 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Reward: ₹{((t.target2 ?? 0) - (t.entryPrice ?? 0)).toFixed(2)} pts</div>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Target 3</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#facc15', marginTop: '2px' }}>
                          ₹{(t.target3 ?? 0).toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: '#64748b', marginTop: '2px' }}>Extended Runner</div>
                      </div>

                      <div style={{ background: 'rgba(0, 0, 0, 0.3)', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(0, 240, 255, 0.2)' }}>
                        <div style={{ fontSize: '11px', color: '#94a3b8' }}>Current / Exit LTP</div>
                        <div style={{ fontSize: '18px', fontWeight: '800', color: '#00f0ff', marginTop: '2px' }}>
                          ₹{liveLtp.toFixed(2)}
                        </div>
                        <div style={{ fontSize: '10px', color: gainPts >= 0 ? '#10b981' : '#ef4444', marginTop: '2px', fontWeight: '700' }}>
                          {gainPts >= 0 ? `+${gainPts.toFixed(2)} pts (+${roiPct.toFixed(2)}%)` : `${gainPts.toFixed(2)} pts (${roiPct.toFixed(2)}%)`}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes & Setup Summary Card */}
                  <div style={{ background: 'rgba(255, 255, 255, 0.02)', border: '1px solid rgba(255, 255, 255, 0.06)', borderRadius: '12px', padding: '16px' }}>
                    <div style={{ fontSize: '12px', fontWeight: '800', color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px' }}>
                      📝 Strategy Rationale & Notes
                    </div>
                    <div style={{ fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5', background: 'rgba(0, 0, 0, 0.25)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.04)' }}>
                      {t.notes || 'No custom notes provided for this trade entry.'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginTop: '12px', textAlign: 'center' }}>
                      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Risk : Reward</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{t.riskReward || '1:2.0'}</div>
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Holding Period</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: '#fff', marginTop: '2px' }}>{t.holdingTime || 'Intraday'}</div>
                      </div>
                      <div style={{ background: 'rgba(0, 0, 0, 0.2)', padding: '8px', borderRadius: '6px' }}>
                        <div style={{ fontSize: '10px', color: '#94a3b8' }}>Price State</div>
                        <div style={{ fontSize: '13px', fontWeight: '800', color: t.isPriceFrozen ? '#f59e0b' : '#00f0ff', marginTop: '2px' }}>
                          {t.isPriceFrozen ? 'Frozen 🔒' : 'Live Ticks ⚡'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right Column: Uploaded Marked Chart View */}
                <div style={{
                  background: 'rgba(16, 185, 129, 0.04)',
                  border: '1px solid rgba(16, 185, 129, 0.25)',
                  borderRadius: '12px',
                  padding: '16px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Image size={18} color="#10b981" />
                      <span style={{ fontSize: '13px', fontWeight: '800', color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Marked Chart Analysis
                      </span>
                      {t.chartImage && (
                        <span style={{ fontSize: '10px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '2px 6px', borderRadius: '4px', fontWeight: '700' }}>
                          ATTACHED
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <label style={{
                        background: 'rgba(16, 185, 129, 0.2)',
                        border: '1px solid #10b981',
                        color: '#34d399',
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '700',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <Upload size={12} />
                        <span>{t.chartImage ? 'Replace Chart' : 'Upload Chart'}</span>
                        <input
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) handleModalChartUpload(t.id, file);
                          }}
                        />
                      </label>

                      {t.chartImage && (
                        <>
                          <button
                            onClick={() => setIsChartFullscreen(true)}
                            title="View Fullscreen"
                            style={{
                              background: 'rgba(255, 255, 255, 0.08)',
                              border: '1px solid rgba(255, 255, 255, 0.15)',
                              color: '#fff',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                          >
                            <Maximize2 size={12} />
                            <span>Fullscreen</span>
                          </button>
                          <button
                            onClick={() => handleRemoveModalChart(t.id)}
                            title="Remove Chart"
                            style={{
                              background: 'rgba(239, 68, 68, 0.15)',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              color: '#f87171',
                              padding: '4px 8px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '11px'
                            }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Chart Container / Dropzone */}
                  {t.chartImage ? (
                    <div
                      style={{
                        position: 'relative',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        background: '#070a12',
                        cursor: 'zoom-in',
                        maxHeight: '480px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      onClick={() => setIsChartFullscreen(true)}
                    >
                      <img
                        src={t.chartImage}
                        alt={`Marked Chart for ${t.displayName}`}
                        style={{
                          width: '100%',
                          maxHeight: '480px',
                          objectFit: 'contain',
                          display: 'block'
                        }}
                      />
                      <div style={{
                        position: 'absolute',
                        bottom: '8px',
                        right: '8px',
                        background: 'rgba(0, 0, 0, 0.75)',
                        color: '#94a3b8',
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        pointerEvents: 'none',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <ZoomIn size={11} /> Click to expand
                      </div>
                    </div>
                  ) : (
                    /* Dropzone when no chart uploaded */
                    <label style={{
                      border: '2px dashed rgba(16, 185, 129, 0.35)',
                      borderRadius: '12px',
                      padding: '40px 20px',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '12px',
                      cursor: 'pointer',
                      background: 'rgba(0, 0, 0, 0.25)',
                      transition: 'all 0.2s',
                      minHeight: '340px'
                    }}>
                      <div style={{
                        width: '56px',
                        height: '56px',
                        borderRadius: '50%',
                        background: 'rgba(16, 185, 129, 0.15)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        border: '1px solid rgba(16, 185, 129, 0.3)'
                      }}>
                        <Upload size={24} color="#10b981" />
                      </div>
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '14px', fontWeight: '700', color: '#fff' }}>
                          Upload Marked Chart for {t.displayName}
                        </div>
                        <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px', maxWidth: '340px' }}>
                          Attach TradingView / Angel One chart screenshots with your marked entry, support/resistance, TPO levels, or stop loss.
                        </div>
                      </div>
                      <span style={{
                        background: 'linear-gradient(135deg, #10b981, #059669)',
                        color: '#000',
                        padding: '6px 16px',
                        borderRadius: '6px',
                        fontSize: '11px',
                        fontWeight: '800',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <Upload size={13} /> Select Image File (PNG, JPG, WebP)
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleModalChartUpload(t.id, file);
                        }}
                      />
                    </label>
                  )}
                </div>
              </div>

              {/* Modal Footer Actions */}
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', flexWrap: 'wrap' }}>
                <button
                  onClick={() => setSelectedTradeForModal(null)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    color: '#94a3b8',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    cursor: 'pointer'
                  }}
                >
                  Close
                </button>

                <button
                  onClick={() => {
                    handleEditTrade(t);
                    setSelectedTradeForModal(null);
                  }}
                  style={{
                    background: 'rgba(59, 130, 246, 0.15)',
                    color: '#60a5fa',
                    border: '1px solid rgba(59, 130, 246, 0.35)',
                    borderRadius: '8px',
                    padding: '8px 16px',
                    fontSize: '12px',
                    fontWeight: '700',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  <Edit2 size={14} /> Edit Trade
                </button>

                {(onSymbolSelect || onSwitchToChart) && (
                  <button
                    onClick={() => {
                      if (onSymbolSelect) onSymbolSelect(t.symbol);
                      if (onSwitchToChart) onSwitchToChart();
                      setSelectedTradeForModal(null);
                    }}
                    style={{
                      background: 'linear-gradient(135deg, #06b6d4, #0284c7)',
                      color: '#000',
                      border: 'none',
                      borderRadius: '8px',
                      padding: '8px 18px',
                      fontSize: '12px',
                      fontWeight: '700',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <BarChart2 size={14} /> Open Candlestick Chart
                  </button>
                )}
              </div>
            </div>
          </div>
        );
      })()}

      {/* FULLSCREEN CHART LIGHTBOX */}
      {isChartFullscreen && selectedTradeForModal?.chartImage && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0, 0, 0, 0.95)',
          zIndex: 100000,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '20px'
        }} onClick={() => setIsChartFullscreen(false)}>
          <div style={{
            position: 'absolute',
            top: '20px',
            right: '20px',
            display: 'flex',
            gap: '12px',
            zIndex: 10
          }}>
            <a
              href={selectedTradeForModal.chartImage}
              download={`${selectedTradeForModal.displayName}_marked_chart.jpg`}
              onClick={(e) => e.stopPropagation()}
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '8px',
                textDecoration: 'none',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700'
              }}
            >
              <Download size={15} /> Download
            </a>
            <button
              onClick={() => setIsChartFullscreen(false)}
              style={{
                background: 'rgba(239, 68, 68, 0.3)',
                border: '1px solid #ef4444',
                color: '#fff',
                padding: '8px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '12px',
                fontWeight: '700'
              }}
            >
              <X size={16} /> Close
            </button>
          </div>
          <div style={{
            position: 'absolute',
            top: '20px',
            left: '20px',
            color: '#fff',
            fontSize: '16px',
            fontWeight: '800'
          }}>
            {selectedTradeForModal.displayName} · Marked Chart
          </div>
          <img
            src={selectedTradeForModal.chartImage}
            alt="Fullscreen Marked Chart"
            style={{
              maxWidth: '96vw',
              maxHeight: '90vh',
              objectFit: 'contain',
              boxShadow: '0 0 50px rgba(0, 0, 0, 0.9)',
              borderRadius: '8px'
            }}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

    </div>
  );
};
