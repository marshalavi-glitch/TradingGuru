import React, { useState, useMemo, useEffect } from 'react';
import { 
  FileText, Search, Target, ShieldAlert, Award, TrendingUp, TrendingDown, 
  Activity, CheckCircle2, RefreshCw, BarChart2, Zap, ArrowUpRight, Flame, Layers, Clock,
  Plus, Edit2, Trash2, X, Save, RotateCcw
} from 'lucide-react';

export interface ManualTrade {
  id: string;
  date: string;
  symbol: string;
  displayName: string;
  tradeType: 'CALL BUY' | 'PUT BUY' | 'FUT LONG' | 'FUT SHORT';
  setupName: string;
  entryPrice: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  finalAchievedPrice: number;
  finalStatus: 'TARGET 3 HIT' | 'TARGET 2 HIT' | 'TARGET 1 HIT' | 'LIVE ACTIVE' | 'STOP LOSS HIT';
  currentPrice?: number;
  ptsGained?: number;
  roiPct?: number;
  holdingTime?: string;
  riskReward?: string;
  notes?: string;
}

const STORAGE_KEY = 'tradingguru_manual_trades_v6';

// DEFAULT MANUAL TRADE DATASET FOR 2026-09-15
const DEFAULT_MANUAL_TRADES: ManualTrade[] = [
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
    currentPrice: 40.00,
    target1: 20.00,
    target2: 27.00,
    target3: 40.00,
    stopLoss: 5.00,
    finalAchievedPrice: 40.00,
    finalStatus: 'TARGET 3 HIT',
    ptsGained: 27.5,
    roiPct: 220.00,
    holdingTime: 'Hold Till Expiry',
    riskReward: '1:3.67',
    notes: 'Hero or Zero setup. BUY RELIANCE 1260 CE @ 15/10. Targets: 20, 27, 40+. Hold Till Expiry. Posted at 09:26 AM.'
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
    ptsGained: 125.0,
    roiPct: 166.67,
    holdingTime: 'Intraday',
    riskReward: '1:3.57',
    notes: 'Hero or Zero setup triggered at 09:16 AM. Targets: 92, 130, 200+. Target 3 Achieved!'
  }
];

export const ManualTradesContainer: React.FC = () => {
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

  const [filterStatus, setFilterStatus] = useState<'ALL' | 'NIFTY' | 'BANKNIFTY' | 'LIVE_ACTIVE' | 'TARGET_HIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Form Modal state
  const [isFormOpen, setIsFormOpen] = useState<boolean>(false);
  const [editingTradeId, setEditingTradeId] = useState<string | null>(null);

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
    notes: string;
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
    notes: '',
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
      notes: '',
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
      notes: t.notes || '',
      date: t.date || new Date().toISOString().replace('T', ' ').substring(0, 16)
    });
    setIsFormOpen(true);
  };

  const handleDeleteTrade = (id: string) => {
    if (window.confirm('Are you sure you want to delete this trade entry?')) {
      setTrades((prev) => prev.filter((t) => t.id !== id));
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
      ptsGained: Number(pts.toFixed(2)),
      roiPct: Number(roi.toFixed(2)),
      holdingTime: 'Intraday',
      riskReward: sl !== entry ? `1:${((t1 - entry) / Math.abs(entry - sl)).toFixed(1)}` : '1:2.0',
      notes: formData.notes.trim()
    };

    if (editingTradeId) {
      setTrades((prev) => prev.map((t) => (t.id === editingTradeId ? newTradeRecord : t)));
    } else {
      setTrades((prev) => [newTradeRecord, ...prev]);
    }

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
    const targetHits = trades.filter(t => t.finalStatus && t.finalStatus.startsWith('TARGET')).length;
    const target3Hits = trades.filter(t => t.finalStatus === 'TARGET 3 HIT').length;
    const liveActive = trades.filter(t => t.finalStatus === 'LIVE ACTIVE').length;
    const denominator = total - liveActive;
    const winRate = denominator > 0 ? Math.round((targetHits / denominator) * 1000) / 10 : (targetHits > 0 ? 100 : 0);
    
    const totalPts = trades.reduce((acc, t) => {
      const pts = t.ptsGained ?? (t.finalAchievedPrice && t.entryPrice ? t.finalAchievedPrice - t.entryPrice : 0);
      return acc + pts;
    }, 0);
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
  }, [trades]);

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
              Record and track custom manual trade setups with Entry Range, Stop Loss, Targets 1–3, and Achieved Exit Price.
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
                const isLive = t.finalStatus === 'LIVE ACTIVE';
                const isT3 = t.finalStatus === 'TARGET 3 HIT';
                const isT2 = t.finalStatus === 'TARGET 2 HIT';
                const isSL = t.finalStatus === 'STOP LOSS HIT';

                return (
                  <tr
                    key={t.id}
                    style={{
                      borderBottom: '1px solid rgba(255, 255, 255, 0.04)',
                      background: isLive 
                        ? 'rgba(0, 240, 255, 0.08)' 
                        : isT3 ? 'rgba(16, 185, 129, 0.06)' : 'transparent'
                    }}
                  >
                    {/* Symbol & Date */}
                    <td style={{ padding: '12px', textAlign: 'left' }}>
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '13px', fontWeight: '900', color: '#ffffff' }}>
                          {t.displayName}
                        </span>
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

                    {/* Current Price / LTP */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '900', color: '#00f0ff', fontSize: '13px' }}>
                      ₹{(t.currentPrice ?? t.finalAchievedPrice ?? t.entryPrice ?? 0).toFixed(2)}
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

                    {/* Achieved Price */}
                    <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '900', color: isT3 || isT2 ? '#10b981' : isLive ? '#00f0ff' : '#ffffff', fontSize: '13px' }}>
                      ₹{(t.finalAchievedPrice ?? 0).toFixed(2)}
                    </td>

                    {/* Points Gained */}
                    <td style={{ padding: '12px', fontWeight: '900', color: (t.ptsGained ?? (t.finalAchievedPrice - t.entryPrice) ?? 0) >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontSize: '13px' }}>
                      {(() => {
                        const pts = t.ptsGained ?? ((t.finalAchievedPrice && t.entryPrice) ? t.finalAchievedPrice - t.entryPrice : 0);
                        return pts >= 0 ? `+${pts.toFixed(1)} pts` : `${pts.toFixed(1)} pts`;
                      })()}
                    </td>

                    {/* Final Status */}
                    <td style={{ padding: '12px' }}>
                      {isLive ? (
                        <span style={{ background: 'rgba(0, 240, 255, 0.2)', color: '#00f0ff', border: '1px solid #00f0ff', padding: '3px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '10px' }} className="animate-pulse">
                          ⚡ LIVE ACTIVE
                        </span>
                      ) : isT3 ? (
                        <span style={{ background: 'rgba(245, 158, 11, 0.2)', color: '#facc15', border: '1px solid #f59e0b', padding: '3px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '10px' }}>
                          🎯 TARGET 3 HIT
                        </span>
                      ) : isT2 ? (
                        <span style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#10b981', border: '1px solid #10b981', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px' }}>
                          🚀 TARGET 2 HIT
                        </span>
                      ) : isSL ? (
                        <span style={{ background: 'rgba(239, 68, 68, 0.2)', color: '#ef4444', border: '1px solid #ef4444', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px' }}>
                          🛑 STOP LOSS HIT
                        </span>
                      ) : (
                        <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', border: '1px solid #3b82f6', padding: '3px 8px', borderRadius: '4px', fontWeight: '800', fontSize: '10px' }}>
                          ✅ TARGET 1 HIT
                        </span>
                      )}
                    </td>

                    {/* Actions */}
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
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

    </div>
  );
};
