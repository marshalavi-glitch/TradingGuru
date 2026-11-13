import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Bot, Play, Pause, ShieldAlert, TrendingUp, TrendingDown, RefreshCw, 
  Clock, Zap, CheckCircle2, AlertTriangle, ArrowUpRight, ArrowDownRight, 
  ExternalLink, XCircle, RotateCcw, Wallet, Target, Activity, Settings2,
  DollarSign, PieChart, ShieldCheck, Flame, ListFilter, Download
} from 'lucide-react';
import { tvStreamer, getBackendHttpUrl } from '../utils/tvStreamer';
import { useTheme } from '../context/ThemeContext';
import { calculateMatrixSeriesData } from '../utils/matrixCalculator';
import type { Candle } from '../utils/profileCalculator';

export interface AlgoPosition {
  id: string;
  symbol: string;
  displayName: string;
  side: 'BUY' | 'SELL';
  setupType: 'BUY REVERSAL (S3)' | 'BUY REVERSAL (S3 RECLAIM)' | 'BUY REVERSAL BREAKDOWN (SHORT)' | 'SELL REVERSAL (PIVOT BREAKDOWN)' | 'SELL REVERSAL (R3)';
  entryDate?: string;
  entryTime: string;
  entryTimestamp: number;
  entryPrice: number;
  currentPrice: number;
  quantity: number;
  allocatedCapital: number;
  stopLoss: number;
  target1: number;
  target2: number;
  initialStopLoss: number;
  isTrailingActive: boolean;
  isBreakeven: boolean;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  reversalLevel: number;
  status: 'OPEN' | 'CLOSED';
  exitPrice?: number;
  exitDate?: string;
  exitTime?: string;
  exitTimestamp?: number;
  exitReason?: 'TARGET 1 HIT (PROFIT BOOKED)' | 'TARGET 1 HIT' | 'TARGET 2 HIT' | 'STOP LOSS HIT' | 'TRAILING SL HIT' | 'MIS EOD SQUARE-OFF (15:15)' | 'MCX EOD SQUARE-OFF (23:25)' | 'MANUAL SQUARE-OFF';
  realizedPnl?: number;
}

export interface AlgoLog {
  id: string;
  date?: string;
  time: string;
  type: 'ORDER' | 'SIGNAL' | 'EXIT' | 'INFO' | 'WARNING';
  message: string;
  symbol?: string;
}

export interface ShortSetupState {
  hasTestedR3: boolean;
  hasBrokeOutAboveR3: boolean;
  maxHighAboveR3: number;
  hasRejectedBelowR3: boolean;
  hasBrokenPivot: boolean;
  isReadyToShort: boolean;
  stageNumber: number; // 0 to 5
  stageText: string;
}

export interface BuyRevShortSetupState {
  hasTestedS3: boolean;
  hasBrokeOutAboveS3: boolean;
  maxHighAboveS3: number;
  hasRejectedBelowS3: boolean;
  hasMovedBelowS3: boolean;
  hasBrokenPivot: boolean;
  isChasedBelowS4: boolean;
  isReadyToShort: boolean;
  stageNumber: number; // 0 to 6
  stageText: string;
}

export interface ConfirmedLongSetupState {
  hasTestedS3: boolean;
  hasSweptBelowS3: boolean;
  minLowBelowS3: number;
  hasReclaimedS3: boolean;
  isReadyToLong: boolean;
  stageNumber: number; // 0 to 4
  stageText: string;
}

export interface ReversalRadarItem {
  symbol: string;
  displayName: string;
  ltp: number;
  s3: number; // Buy Reversal
  r3: number; // Sell Reversal
  s4: number; // Breakdown line
  r4: number; // Breakout line
  s1_r1: number; // S1 / R1 level (Level 6)
  s5: number; // Target 1 (Level 9)
  pivot: number;
  distanceToBuyPct: number;
  distanceToSellPct: number;
  status: 'IN BUY ZONE' | 'IN SELL ZONE' | 'APPROACHING BUY' | 'APPROACHING SELL' | 'NEUTRAL';
  shortSetupState: ShortSetupState;
  buyRevShortSetupState: BuyRevShortSetupState;
  longSetupState: ConfirmedLongSetupState;
  lastUpdated: number;
}

interface AlgoTradeContainerProps {
  onSymbolSelect: (symbol: string) => void;
  onSwitchToChart: () => void;
}

const TOTAL_CAPITAL = 1000000; // ₹10,00,000 (10 Lakhs)
const STORAGE_POSITIONS_KEY = 'tradingguru_algo_positions_v1';
const STORAGE_HISTORY_KEY = 'tradingguru_algo_history_v1';
const STORAGE_LOGS_KEY = 'tradingguru_algo_logs_v1';
const STORAGE_CONFIG_KEY = 'tradingguru_algo_config_v1';

const DEFAULT_UNIVERSE = [
  'NSE:NIFTY',
  'NSE:BANKNIFTY',
  'NSE:FINNIFTY',
  'NSE:RELIANCE',
  'NSE:HDFCBANK',
  'NSE:INFY',
  'NSE:ICICIBANK',
  'NSE:TCS',
  'NSE:SBIN',
  'NSE:TATAMOTORS',
  'NSE:BHARTIARTL',
  'NSE:KOTAKBANK',
  'NSE:LT',
  'NSE:AXISBANK',
  'NSE:BAJFINANCE',
  'MCX:CRUDEOIL',
  'MCX:NATURALGAS',
  'MCX:ZINC'
];

export function isCommoditySymbol(symbol?: string): boolean {
  if (!symbol) return false;
  const s = symbol.toUpperCase();
  return (
    s.startsWith('MCX:') ||
    s.includes('CRUDE') ||
    s.includes('NATURALGAS') ||
    s.includes('NATGAS') ||
    s.includes('ZINC') ||
    s.includes('GOLD') ||
    s.includes('SILVER') ||
    s.includes('COPPER') ||
    s.includes('LEAD') ||
    s.includes('ALUMINIUM') ||
    s.includes('NICKEL')
  );
}


export function formatIstDate(ms = Date.now()): string {
  return new Date(ms).toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

export function formatIstTime(ms = Date.now()): string {
  return new Date(ms).toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
}

export function formatTradeDateTimeDisplay(timeStr?: string, dateStr?: string, timestamp?: number): string {
  const resolvedDate = dateStr || (timestamp ? formatIstDate(timestamp) : '');
  const resolvedTime = timeStr || (timestamp ? formatIstTime(timestamp) : '');
  if (resolvedDate && resolvedTime) return `${resolvedDate}, ${resolvedTime}`;
  return resolvedTime || resolvedDate || '-';
}


function isIstDateNov9(ms?: number | string | null): boolean {
  if (!ms) return false;
  const num = Number(ms);
  if (isNaN(num) || num <= 0) return false;
  return new Date(num).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' }) === '2026-11-09';
}

function isNov9DateStr(str?: string): boolean {
  if (!str) return false;
  const s = String(str).trim().toLowerCase();
  return (
    /\b0?9[\s\-/]+nov(?:ember)?[\s,\-/]+2026\b/i.test(s) ||
    /\b2026[\s\-/]+11[\s\-/]+0?9\b/.test(s) ||
    /\b0?9[\s\-/]+11[\s\-/]+2026\b/.test(s) ||
    /\b11[\s\-/]+0?9[\s\-/]+2026\b/.test(s)
  );
}

export function isNov9AlgoTrade(item: any): boolean {
  if (!item || typeof item !== 'object') return false;
  if (isIstDateNov9(item.entryTimestamp) || isIstDateNov9(item.exitTimestamp)) return true;
  if (isNov9DateStr(item.entryDate) || isNov9DateStr(item.exitDate)) return true;
  if (typeof item.id === 'string' && item.id.startsWith('algo-pos-')) {
    const parts = item.id.split('-');
    if (parts.length >= 3 && isIstDateNov9(parts[2])) return true;
  }
  return false;
}

export function isNov9AlgoLog(log: any): boolean {
  if (!log || typeof log !== 'object') return false;
  if (isNov9DateStr(log.date)) return true;
  if (typeof log.id === 'string' && log.id.startsWith('log-')) {
    const parts = log.id.split('-');
    if (parts.length >= 2 && isIstDateNov9(parts[1])) return true;
  }
  return false;
}

export const AlgoTradeContainer: React.FC<AlgoTradeContainerProps> = ({
  onSymbolSelect,
  onSwitchToChart
}) => {
  const { isDark } = useTheme();
  // Engine Configuration State


  const [isEngineActive, setIsEngineActive] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      return saved ? JSON.parse(saved).isEngineActive ?? true : true;
    } catch {
      return true;
    }
  });

  const [riskPerTradePct, setRiskPerTradePct] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      return saved ? JSON.parse(saved).riskPerTradePct ?? 1.0 : 1.0;
    } catch {
      return 1.0;
    }
  });

  const [maxOpenPositions, setMaxOpenPositions] = useState<number>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_CONFIG_KEY);
      return saved ? JSON.parse(saved).maxOpenPositions ?? 4 : 4;
    } catch {
      return 4;
    }
  });

  const [activeSubTab, setActiveSubTab] = useState<'positions' | 'radar' | 'history' | 'logs'>('positions');

  // Positions, History & Logs State
  const [positions, setPositions] = useState<AlgoPosition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_POSITIONS_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((p) => !isNov9AlgoTrade(p)) : [];
    } catch {
      return [];
    }
  });

  const [history, setHistory] = useState<AlgoPosition[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_HISTORY_KEY);
      const parsed = saved ? JSON.parse(saved) : [];
      return Array.isArray(parsed) ? parsed.filter((h) => !isNov9AlgoTrade(h)) : [];
    } catch {
      return [];
    }
  });

  const [logs, setLogs] = useState<AlgoLog[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_LOGS_KEY);
      if (!saved) {
        return [
          {
            id: 'log-0',
            date: formatIstDate(),
            time: formatIstTime(),
            type: 'INFO',
            message: 'Intraday Algo Trading Engine initialized with ₹10,00,000 Capital. Strategy: S3 Buy & R3 Sell Reversals.'
          }
        ];
      }
      const parsed = JSON.parse(saved);
      return Array.isArray(parsed) ? parsed.filter((l) => !isNov9AlgoLog(l)) : [];
    } catch {
      return [];
    }
  });

  // Reversal Radar Items
  const [radarItems, setRadarItems] = useState<ReversalRadarItem[]>([]);
  const [isRadarLoading, setIsRadarLoading] = useState<boolean>(true);
  const [isExporting, setIsExporting] = useState<boolean>(false);
  const [lastScanTime, setLastScanTime] = useState<string>('');

  // Live Prices Map: Symbol -> Price
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  // Fixed Static Daily Anchor Levels (Locked per session date in IST to prevent intraday level jitter)
  const staticAnchorLevelsRef = useRef<Record<string, { s3: number; r3: number; s4: number; r4: number; s1_r1: number; s5: number; pivot: number; date: string }>>({});
  const tradeCooldownRef = useRef<Record<string, { lastExitTimestamp: number; setupType: string }>>({});

  // Time & Pure Intraday Square-off
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('');
  const [timeToEodStr, setTimeToEodStr] = useState<string>('');
  const [isEodSquareOffTriggered, setIsEodSquareOffTriggered] = useState<boolean>(false);

  // Synchronize config to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_CONFIG_KEY, JSON.stringify({
      isEngineActive,
      riskPerTradePct,
      maxOpenPositions
    }));
  }, [isEngineActive, riskPerTradePct, maxOpenPositions]);

  // Synchronize positions, history & logs to localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_POSITIONS_KEY, JSON.stringify(positions));
  }, [positions]);

  useEffect(() => {
    localStorage.setItem(STORAGE_HISTORY_KEY, JSON.stringify(history));
  }, [history]);

  useEffect(() => {
    localStorage.setItem(STORAGE_LOGS_KEY, JSON.stringify(logs.slice(-100)));
  }, [logs]);

  const addLog = (type: AlgoLog['type'], message: string, symbol?: string) => {
    const newLog: AlgoLog = {
      id: `log-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      date: formatIstDate(),
      time: formatIstTime(),
      type,
      message,
      symbol
    };
    setLogs(prev => [newLog, ...prev.slice(0, 99)]);
  };

  // Pure Intraday Clock & Dynamic Cutoff Tracker (Equity @ 15:15 IST, MCX Commodity @ 23:25 IST)
  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      // Format in IST
      const istTimeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
      setCurrentTimeStr(istTimeStr);

      const [hours, minutes, seconds] = istTimeStr.split(':').map(Number);
      const currentSeconds = hours * 3600 + minutes * 60 + (seconds || 0);

      const equityEodSeconds = 15 * 3600 + 15 * 60; // 15:15:00 IST (3:15 PM)
      const mcxEodSeconds = 23 * 3600 + 25 * 60;    // 23:25:00 IST (11:25 PM)
      const mcxCloseSeconds = 23 * 3600 + 30 * 60;  // 23:30:00 IST (11:30 PM)

      // 1. Check Equity MIS Cutoff (15:15 IST): Auto square-off active Equity positions only!
      if (currentSeconds >= equityEodSeconds) {
        setPositions(prev => {
          const equityPositions = prev.filter(p => !isCommoditySymbol(p.symbol));
          if (equityPositions.length === 0) return prev;

          const closed = equityPositions.map(pos => {
            const ltp = livePrices[pos.symbol] || pos.currentPrice;
            const pts = pos.side === 'BUY' ? (ltp - pos.entryPrice) : (pos.entryPrice - ltp);
            const realizedPnl = Math.round(pts * pos.quantity * 100) / 100;
            return {
              ...pos,
              currentPrice: ltp,
              exitPrice: ltp,
              exitDate: formatIstDate(),
              exitTime: formatIstTime(),
              exitTimestamp: Date.now(),
              status: 'CLOSED' as const,
              exitReason: 'MIS EOD SQUARE-OFF (15:15)' as const,
              realizedPnl
            };
          });

          setHistory(h => [...closed, ...h]);
          addLog('EXIT', `⏰ MIS Cutoff (15:15 IST): Auto squared off ${closed.length} Equity positions. MCX Commodity trades (Crude / NatGas / Zinc) remain actively trading till 23:25 IST.`);
          return prev.filter(p => isCommoditySymbol(p.symbol));
        });
      }

      // 2. Check MCX Commodity MIS Cutoff (23:25 IST): Auto square-off active Commodity positions!
      if (currentSeconds >= mcxEodSeconds) {
        setPositions(prev => {
          const commodityPositions = prev.filter(p => isCommoditySymbol(p.symbol));
          if (commodityPositions.length === 0) return prev;

          const closed = commodityPositions.map(pos => {
            const ltp = livePrices[pos.symbol] || pos.currentPrice;
            const pts = pos.side === 'BUY' ? (ltp - pos.entryPrice) : (pos.entryPrice - ltp);
            const realizedPnl = Math.round(pts * pos.quantity * 100) / 100;
            return {
              ...pos,
              currentPrice: ltp,
              exitPrice: ltp,
              exitDate: formatIstDate(),
              exitTime: formatIstTime(),
              exitTimestamp: Date.now(),
              status: 'CLOSED' as const,
              exitReason: 'MCX EOD SQUARE-OFF (23:25)' as const,
              realizedPnl
            };
          });

          setHistory(h => [...closed, ...h]);
          addLog('EXIT', `🌙 MCX EOD Cutoff (23:25 IST): Auto squared off ${closed.length} Commodity positions (Crude / NatGas / Zinc).`);
          return prev.filter(p => !isCommoditySymbol(p.symbol));
        });
      }

      // 3. Dynamic Status Banner
      if (currentSeconds >= mcxCloseSeconds) {
        setTimeToEodStr('ALL MARKETS CLOSED (Equity & MCX Squared Off)');
      } else if (currentSeconds >= equityEodSeconds) {
        const diffMcx = mcxEodSeconds - currentSeconds;
        const h = Math.floor(Math.max(0, diffMcx) / 3600);
        const m = Math.floor((Math.max(0, diffMcx) % 3600) / 60);
        const s = Math.max(0, diffMcx) % 60;
        setTimeToEodStr(`Equity Closed (15:15) | MCX Active (Crude, NatGas, Zinc): ${h}h ${m}m ${s}s to 23:25 Cutoff`);
      } else {
        const diffEq = equityEodSeconds - currentSeconds;
        const h = Math.floor(diffEq / 3600);
        const m = Math.floor((diffEq % 3600) / 60);
        const s = diffEq % 60;
        setTimeToEodStr(`Equity: ${h}h ${m}m ${s}s to 15:15 | MCX (Crude, NatGas, Zinc) active till 23:25 IST`);
      }
    };

    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, [livePrices]);

  // Calculate Reversal Levels for Monitored Symbols
  const fetchRadarLevels = async () => {
    setIsRadarLoading(true);
    try {
      const backendUrl = await getBackendHttpUrl();
      const updatedRadar: ReversalRadarItem[] = [];

      for (const symbol of DEFAULT_UNIVERSE) {
        try {
          const res = await fetch(`${backendUrl}/api/candles?symbol=${encodeURIComponent(symbol)}&timeframe=5&limit=150`, {
            headers: { 'bypass-tunnel-reminder': 'true' }
          });
          if (!res.ok) continue;
          const data = await res.json();
          if (!data || !Array.isArray(data.candles) || data.candles.length < 5) continue;

          const candles: Candle[] = data.candles;
          const currentCandle = candles[candles.length - 1];
          const ltp = livePrices[symbol] || currentCandle.close;

          const todayDateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

          let s3 = 0;
          let r3 = 0;
          let s4 = 0;
          let r4 = 0;
          let s1_r1 = 0;
          let s5 = 0;
          let pivot = 0;

          // Check if static levels are already locked for today's session
          const cachedLvl = staticAnchorLevelsRef.current[symbol];
          if (cachedLvl && cachedLvl.date === todayDateStr && cachedLvl.s3 > 0 && cachedLvl.r3 > 0) {
            s3 = cachedLvl.s3;
            r3 = cachedLvl.r3;
            s4 = cachedLvl.s4;
            r4 = cachedLvl.r4;
            s1_r1 = cachedLvl.s1_r1 || 0;
            s5 = cachedLvl.s5 || 0;
            pivot = cachedLvl.pivot;
          } else {
            const matrixData = calculateMatrixSeriesData(candles, '5', data.matrixHistory);
            const getVal = (points?: { value: number }[]) => 
              points && points.length > 0 ? points[points.length - 1].value : 0;

            s3 = getVal(matrixData.level7); // Buy Reversal
            r3 = getVal(matrixData.level4); // Sell Reversal
            s4 = getVal(matrixData.level8); // Breakdown
            r4 = getVal(matrixData.level3); // Breakout
            s1_r1 = getVal(matrixData.level6); // S1 / R1
            s5 = getVal(matrixData.level9); // S5 Target
            pivot = (r3 + s3) / 2;

            if (s3 > 0 && r3 > 0) {
              staticAnchorLevelsRef.current[symbol] = { s3, r3, s4, r4, s1_r1, s5, pivot, date: todayDateStr };
            }
          }

          if (s3 <= 0 || r3 <= 0) continue;

          const distanceToBuyPct = ((ltp - s3) / s3) * 100;
          const distanceToSellPct = ((r3 - ltp) / r3) * 100;

          // 7-Step Short Trade Sequence Detection:
          // 1. Price reaches Sell Reversal (tests R3)
          // 2. Breakout above Sell Reversal (moves above R3)
          // 3. Rejection of breakout (buyers fail to sustain)
          // 4. Move back below Sell Reversal (LTP < R3)
          // 5. Pivot Point breakdown (LTP < Pivot)
          // 6. Enter SHORT (Triggered only after Pivot breakdown)
          // 7. Stop Loss: Sell Reversal (R3)
                    // Filter candles strictly for TODAY'S trading session in IST (NO previous-day cross-leakage!)
          const sessionCandles = candles.filter(c => {
            const d = new Date(c.time * 1000).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
            return d === todayDateStr;
          }).sort((a, b) => a.time - b.time);

          // If session just opened and has fewer than 2 completed candles, remain neutral
          if (sessionCandles.length < 2) {
            continue;
          }

          // A) Sell Reversal (R3) Short Setup:
          // Strict Chronological Sequence:
          // Step 1: Candle tests R3 (high >= R3 * 0.9995)
          // Step 2: Candle breaks out above R3 (high > R3)
          // Step 3: Subsequent candle rejects and closes back below R3 (close < R3)
          // Step 4: Candle breaks down below Central Pivot (close < pivot or ltp < pivot)
          let r3TestIdx = -1;
          let r3BreakoutIdx = -1;
          let r3MaxHigh = 0;
          let r3RejectIdx = -1;
          let r3PivotBreakIdx = -1;

          for (let i = 0; i < sessionCandles.length; i++) {
            const c = sessionCandles[i];
            if (c.high > r3MaxHigh) r3MaxHigh = c.high;

            if (r3TestIdx === -1 && c.high >= r3 * 0.9995) {
              r3TestIdx = i;
            }
            if (r3TestIdx !== -1 && r3BreakoutIdx === -1 && c.high > r3) {
              r3BreakoutIdx = i;
            }
            if (r3BreakoutIdx !== -1 && r3RejectIdx === -1) {
              if (i > r3BreakoutIdx && c.close < r3) {
                r3RejectIdx = i;
              } else if (i === r3BreakoutIdx && c.close < r3 && (c.high - r3) > 0) {
                r3RejectIdx = i;
              }
            }
            if (r3RejectIdx !== -1 && r3PivotBreakIdx === -1) {
              if (c.close < pivot || c.low < pivot || ltp < pivot) {
                r3PivotBreakIdx = i;
              }
            }
          }

          const hasTestedR3 = r3TestIdx !== -1;
          const hasBrokeOutAboveR3 = r3BreakoutIdx !== -1;
          const hasRejectedBelowR3 = r3RejectIdx !== -1 && (ltp < r3);
          const hasBrokenPivot = r3PivotBreakIdx !== -1 && hasRejectedBelowR3 && (ltp < pivot);
          const isReadyToShort = hasBrokenPivot;

          let stageNumber = 0;
          let stageText = 'Awaiting R3 Test';
          if (hasBrokenPivot) {
            stageNumber = 5;
            stageText = '5. Pivot Broken ➔ SHORT READY';
          } else if (hasRejectedBelowR3) {
            stageNumber = 4;
            stageText = `4. Rejection ➔ Awaiting Pivot (₹${pivot.toFixed(2)})`;
          } else if (hasBrokeOutAboveR3) {
            stageNumber = 2;
            stageText = `2. Breakout Above R3 (High: ₹${r3MaxHigh.toFixed(2)})`;
          } else if (hasTestedR3) {
            stageNumber = 1;
            stageText = '1. Testing Sell Rev (R3)';
          }

          const shortSetupState: ShortSetupState = {
            hasTestedR3,
            hasBrokeOutAboveR3,
            maxHighAboveR3: Number(r3MaxHigh.toFixed(2)),
            hasRejectedBelowR3,
            hasBrokenPivot,
            isReadyToShort,
            stageNumber,
            stageText
          };

          // B) Buy Reversal Breakdown Short Setup (User Rule):
          // Requirement: Entry strictly upon breakdown below Buy Reversal (S3)
          // Stop Loss: Pivot / S1-R1 (Level 6 or Central Pivot)
          // Target 1: S4 Breakdown Level; Target 2: S5 Target Level
          // Entry Window: LTP must be < S3 AND must NOT be chased below S4! (ltp >= s4 * 0.998)
          let s3TestIdx = -1;
          let s3BounceIdx = -1;
          let s3MaxHigh = 0;
          let s3RejectIdx = -1;
          let s3BreakdownIdx = -1;

          for (let i = 0; i < sessionCandles.length; i++) {
            const c = sessionCandles[i];
            if (c.high > s3MaxHigh) s3MaxHigh = c.high;

            if (s3TestIdx === -1 && (c.low <= s3 * 1.002 || c.high >= s3 * 0.998)) {
              s3TestIdx = i;
            }
            if (s3TestIdx !== -1 && s3BounceIdx === -1 && c.high > s3 * 1.0005) {
              s3BounceIdx = i;
            }
            if (s3BounceIdx !== -1 && s3RejectIdx === -1) {
              if (i >= s3BounceIdx && c.close < s3) {
                s3RejectIdx = i;
              }
            }
            if (s3TestIdx !== -1 && s3BreakdownIdx === -1) {
              if (c.close < s3) {
                s3BreakdownIdx = i;
              }
            }
          }

          const hasTestedS3 = s3TestIdx !== -1;
          const hasBrokeOutAboveS3 = s3BounceIdx !== -1;
          const hasRejectedBelowS3 = s3RejectIdx !== -1;
          const hasBrokenS3 = s3BreakdownIdx !== -1;

          // CRITICAL: Entry must be between S3 and S4. If price has already broken below S4, the move is completed! Do NOT chase!
          const isChasedBelowS4 = s4 > 0 && ltp < (s4 * 0.998);
          const isWithinBreakdownEntry = hasBrokenS3 && ltp < s3 && !isChasedBelowS4;
          const isReadyToShortS3 = isWithinBreakdownEntry;

          let s3StageNum = 0;
          let s3StageText = 'Awaiting S3 Test';
          if (isChasedBelowS4) {
            s3StageNum = 5;
            s3StageText = `Move Completed (< ₹${s4.toFixed(2)}) ➔ Avoid Chasing`;
          } else if (isReadyToShortS3) {
            s3StageNum = 4;
            s3StageText = '4. S3 Breakdown Confirmed ➔ SHORT READY';
          } else if (hasBrokenS3) {
            s3StageNum = 3;
            s3StageText = '3. S3 Broken ➔ Watching Range';
          } else if (hasTestedS3) {
            s3StageNum = 1;
            s3StageText = `1. Testing Buy Rev (₹${s3.toFixed(2)})`;
          }

          const buyRevShortSetupState: BuyRevShortSetupState = {
            hasTestedS3,
            hasBrokeOutAboveS3,
            maxHighAboveS3: Number(s3MaxHigh.toFixed(2)),
            hasRejectedBelowS3,
            hasMovedBelowS3: hasBrokenS3 && ltp < s3,
            hasBrokenPivot: hasBrokenS3,
            isChasedBelowS4,
            isReadyToShort: isReadyToShortS3,
            stageNumber: s3StageNum,
            stageText: s3StageText
          };

          // C) Confirmed Long Setup (Smart Money Liquidity Sweep Reclaim):
          // Step 1: Candle sweeps below S3 (low < S3 * 0.999)
          // Step 2: Candle reclaims and closes back above S3 (close > S3)
          let s3SweepIdx = -1;
          let s3ReclaimIdx = -1;
          let s3MinLow = Infinity;

          for (let i = 0; i < sessionCandles.length; i++) {
            const c = sessionCandles[i];
            if (c.low < s3MinLow) s3MinLow = c.low;

            if (s3SweepIdx === -1 && c.low < s3 * 0.999) {
              s3SweepIdx = i;
            }
            if (s3SweepIdx !== -1 && s3ReclaimIdx === -1) {
              if (i >= s3SweepIdx && (c.close > s3 || ltp > s3 * 1.0005)) {
                s3ReclaimIdx = i;
              }
            }
          }

          const hasSweptBelowS3 = s3SweepIdx !== -1;
          const hasReclaimedS3 = s3ReclaimIdx !== -1 && (ltp > s3);
          const isReadyToLong = hasReclaimedS3;

          const longSetupState: ConfirmedLongSetupState = {
            hasTestedS3,
            hasSweptBelowS3,
            minLowBelowS3: s3MinLow < Infinity ? Number(s3MinLow.toFixed(2)) : 0,
            hasReclaimedS3,
            isReadyToLong,
            stageNumber: isReadyToLong ? 4 : (hasSweptBelowS3 ? 2 : (hasTestedS3 ? 1 : 0)),
            stageText: isReadyToLong ? '4. S3 Reclaimed ➔ BUY READY' : (hasSweptBelowS3 ? '2. S3 Swept ➔ Watching Reclaim' : 'Awaiting S3 Reclaim')
          };

          let status: ReversalRadarItem['status'] = 'NEUTRAL';
          if (isReadyToShort || isReadyToShortS3) {
            status = 'IN SELL ZONE';
          } else if (hasRejectedBelowR3 || hasMovedBelowS3) {
            status = 'APPROACHING SELL';
          } else if (isReadyToLong) {
            status = 'IN BUY ZONE';
          } else if (hasSweptBelowS3 || (distanceToBuyPct > 0 && distanceToBuyPct <= 0.45)) {
            status = 'APPROACHING BUY';
          }

          updatedRadar.push({
            symbol,
            displayName: symbol.replace('NSE:', '').replace('MCX:', ''),
            ltp,
            s3: Number(s3.toFixed(2)),
            r3: Number(r3.toFixed(2)),
            s4: Number(s4.toFixed(2)),
            r4: Number(r4.toFixed(2)),
            s1_r1: Number((s1_r1 || pivot).toFixed(2)),
            s5: Number((s5 || (s4 > 0 ? s4 * 0.995 : 0)).toFixed(2)),
            pivot: Number(pivot.toFixed(2)),
            distanceToBuyPct: Number(distanceToBuyPct.toFixed(2)),
            distanceToSellPct: Number(distanceToSellPct.toFixed(2)),
            status,
            shortSetupState,
            buyRevShortSetupState,
            longSetupState,
            lastUpdated: Date.now()
          });
        } catch (e) {
          // ignore individual symbol fetch error
        }
      }

      setRadarItems(updatedRadar);
      setLastScanTime(new Date().toLocaleTimeString('en-IN', { hour12: false }));
    } catch (err: any) {
      console.error('[Algo Trade] Radar level fetch error:', err);
    } finally {
      setIsRadarLoading(false);
    }
  };

  useEffect(() => {
    fetchRadarLevels();
    const interval = setInterval(fetchRadarLevels, 15000); // refresh levels every 15s
    return () => clearInterval(interval);
  }, []);

  // Subscribe to live websocket price feeds for positions & radar items
  useEffect(() => {
    const symbolsToSubscribe = Array.from(new Set([
      ...positions.map(p => p.symbol),
      ...DEFAULT_UNIVERSE
    ]));

    const unsubscribers = symbolsToSubscribe.map(sym => {
      return tvStreamer.subscribe(sym, '5', (data) => {
        if (data && data.candles && data.candles.length > 0) {
          const tick = data.candles[data.candles.length - 1];
          if (tick && tick.close > 0) {
            setLivePrices(prev => {
              const currentLtp = prev[sym];
              // Spike protection: ignore single-tick price jumps > 3% from active price
              if (currentLtp && currentLtp > 0 && Math.abs(tick.close - currentLtp) / currentLtp > 0.03) {
                return prev;
              }
              return {
                ...prev,
                [sym]: tick.close
              };
            });
          }
        }
      });
    });

    return () => {
      unsubscribers.forEach(unsub => unsub && unsub());
    };
  }, [positions.map(p => p.symbol).join(',')]);

  // Update open positions on live price updates & evaluate StopLoss / Targets
  useEffect(() => {
    if (positions.length === 0) return;

    setPositions(prevPositions => {
      let hasChanges = false;
      const closedTrades: AlgoPosition[] = [];
      const updatedPositions = prevPositions.map(pos => {
        const ltp = livePrices[pos.symbol] || pos.currentPrice;
        if (ltp === pos.currentPrice) return pos;

        hasChanges = true;
        const ptsGained = pos.side === 'BUY' ? (ltp - pos.entryPrice) : (pos.entryPrice - ltp);
        const unrealizedPnl = ptsGained * pos.quantity;
        const unrealizedPnlPct = (ptsGained / pos.entryPrice) * 100;

        let newStopLoss = pos.stopLoss;
        let isBreakeven = pos.isBreakeven;
        let isTrailingActive = pos.isTrailingActive;
        let status: 'OPEN' | 'CLOSED' = 'OPEN';
        let exitReason: AlgoPosition['exitReason'] = undefined;

        // BUY Position checks
        if (pos.side === 'BUY') {
          // Target 1 Hit: Immediately book profit and close position
          if (ltp >= pos.target1) {
            status = 'CLOSED';
            exitReason = 'TARGET 1 HIT (PROFIT BOOKED)';
          }
          // Stop Loss Hit
          else if (ltp <= newStopLoss) {
            status = 'CLOSED';
            exitReason = 'STOP LOSS HIT';
          }
        } 
        // SELL Position checks
        else {
          // Target 1 Hit: Immediately book profit and close position
          if (ltp <= pos.target1) {
            status = 'CLOSED';
            exitReason = 'TARGET 1 HIT (PROFIT BOOKED)';
          }
          // Stop Loss Hit
          else if (ltp >= newStopLoss) {
            status = 'CLOSED';
            exitReason = 'STOP LOSS HIT';
          }
        }

        const updatedPos: AlgoPosition = {
          ...pos,
          currentPrice: ltp,
          unrealizedPnl: Math.round(unrealizedPnl * 100) / 100,
          unrealizedPnlPct: Math.round(unrealizedPnlPct * 100) / 100,
          stopLoss: newStopLoss,
          isBreakeven,
          isTrailingActive,
          status,
          exitReason,
          exitPrice: status === 'CLOSED' ? ltp : undefined,
          exitDate: status === 'CLOSED' ? formatIstDate() : undefined,
          exitTime: status === 'CLOSED' ? formatIstTime() : undefined,
          exitTimestamp: status === 'CLOSED' ? Date.now() : undefined,
          realizedPnl: status === 'CLOSED' ? Math.round(unrealizedPnl * 100) / 100 : undefined
        };

        if (status === 'CLOSED') {
          closedTrades.push(updatedPos);
        }

        return updatedPos;
      });

      if (closedTrades.length > 0) {
        closedTrades.forEach(t => {
          tradeCooldownRef.current[t.symbol] = {
            lastExitTimestamp: Date.now(),
            setupType: t.setupType
          };
          const isTarget1 = t.exitReason?.includes('TARGET 1');
          const icon = (t.realizedPnl || 0) >= 0 ? '🎯' : '🔴';
          const msg = isTarget1
            ? `🎯 Target 1 HIT! Profit Booked on ${t.side} ${t.displayName} @ ₹${t.exitPrice?.toFixed(2)} | Realized P&L: +₹${t.realizedPnl?.toLocaleString('en-IN')}`
            : `${icon} Position Closed: ${t.side} ${t.displayName} | Exit: ₹${t.exitPrice?.toFixed(2)} | Reason: ${t.exitReason} | Realized P&L: ₹${t.realizedPnl?.toLocaleString('en-IN')}`;
          addLog('EXIT', msg, t.symbol);
        });
        setHistory(prev => [...closedTrades, ...prev]);
        return updatedPositions.filter(p => p.status === 'OPEN');
      }

      return hasChanges ? updatedPositions : prevPositions;
    });
  }, [livePrices]);

  // Execute Trade Helper (Position Sizing & Risk Management based on ₹10L Capital)
  const executeTrade = (
    symbol: string,
    displayName: string,
    side: 'BUY' | 'SELL',
    setupType: 'BUY REVERSAL (S3)' | 'BUY REVERSAL (S3 RECLAIM)' | 'BUY REVERSAL BREAKDOWN (SHORT)' | 'SELL REVERSAL (PIVOT BREAKDOWN)' | 'SELL REVERSAL (R3)',
    entryPrice: number,
    reversalLevel: number,
    s4Breakdown: number,
    r4Breakout: number,
    pivotPrice: number,
    s3Target?: number
  ) => {
    // Check if position already exists for symbol
    if (positions.some(p => p.symbol === symbol)) {
      addLog('WARNING', `Order rejected: Active position already open for ${displayName}.`, symbol);
      return;
    }

    if (positions.length >= maxOpenPositions) {
      addLog('WARNING', `Order rejected: Max concurrent position limit (${maxOpenPositions}) reached.`, symbol);
      return;
    }

    // Capital Allocation: Max 20% of 10L = ₹2,00,000 per position (allowing up to 5 concurrent trades)
    const maxCapitalPerTrade = TOTAL_CAPITAL / maxOpenPositions; // e.g. ₹2,50,000 for 4 slots
    const quantity = Math.max(1, Math.floor(maxCapitalPerTrade / entryPrice));
    const allocatedCapital = Math.round(quantity * entryPrice);

    // Calculate Stop Loss & Targets
    let stopLoss = 0;
    let target1 = 0;
    let target2 = 0;

    if (side === 'BUY') {
      // Long Reversal at S3:
      // Stop Loss placed at/below S3 (or S4 buffer)
      stopLoss = reversalLevel > 0 && reversalLevel < entryPrice
        ? reversalLevel
        : (s4Breakdown > 0 && s4Breakdown < entryPrice ? Math.round(s4Breakdown * 0.998 * 100) / 100 : Math.round(entryPrice * 0.994 * 100) / 100);
      
      const riskPts = Math.max(0.5, entryPrice - stopLoss);
      // Target 1: Central Pivot or 1.5x risk. Book profit immediately on Target 1!
      target1 = pivotPrice > entryPrice ? pivotPrice : Math.round((entryPrice + riskPts * 1.5) * 100) / 100;
      target2 = r4Breakout > target1 ? r4Breakout : Math.round((entryPrice + riskPts * 2.5) * 100) / 100;
    } else {
      // Short Trade Sequence:
      if (setupType === 'BUY REVERSAL BREAKDOWN (SHORT)') {
        // User Rule: Stop loss must be Pivot / S1-R1 (Level 6 or Central Pivot)
        stopLoss = reversalLevel > entryPrice
          ? reversalLevel
          : (pivotPrice > entryPrice ? pivotPrice : Math.round(entryPrice * 1.006 * 100) / 100);
        
        const riskPts = Math.max(0.5, stopLoss - entryPrice);
        // Target 1: S4 Breakdown Level
        target1 = (s4Breakdown > 0 && s4Breakdown < entryPrice)
          ? s4Breakdown
          : Math.round((entryPrice - riskPts * 1.5) * 100) / 100;
        // Target 2: S5 Target Level
        target2 = (s3Target && s3Target < target1)
          ? s3Target
          : Math.round((entryPrice - riskPts * 2.5) * 100) / 100;
      } else {
        // SELL REVERSAL (PIVOT BREAKDOWN):
        // Stop Loss: Sell Reversal (R3)
        stopLoss = reversalLevel > entryPrice ? reversalLevel : Math.round(entryPrice * 1.008 * 100) / 100;
        
        const riskPts = Math.max(0.5, Math.abs(stopLoss - entryPrice));
        // Target 1: S3 Buy Reversal. Book profit once Target 1 hits!
        const targetLvl = s3Target || s4Breakdown;
        target1 = (targetLvl > 0 && targetLvl < entryPrice)
          ? targetLvl
          : Math.round((entryPrice - riskPts * 1.5) * 100) / 100;
        target2 = Math.round((entryPrice - riskPts * 2.5) * 100) / 100;
      }
    }

    const newPosition: AlgoPosition = {
      id: `algo-pos-${Date.now()}-${symbol}`,
      symbol,
      displayName,
      side,
      setupType,
      entryDate: formatIstDate(),
      entryTime: formatIstTime(),
      entryTimestamp: Date.now(),
      entryPrice,
      currentPrice: entryPrice,
      quantity,
      allocatedCapital,
      stopLoss,
      target1,
      target2,
      initialStopLoss: stopLoss,
      isTrailingActive: false,
      isBreakeven: false,
      unrealizedPnl: 0,
      unrealizedPnlPct: 0,
      reversalLevel,
      status: 'OPEN'
    };
  
    setPositions(prev => [newPosition, ...prev]);
    addLog(
      'ORDER', 
      `⚡ EXECUTED ${side}: ${displayName} @ ₹${entryPrice.toFixed(2)} | Qty: ${quantity} | Cap: ₹${allocatedCapital.toLocaleString('en-IN')} | SL: ₹${stopLoss.toFixed(2)} (${side === 'SELL' ? 'Sell Reversal R3' : 'S4 Buffer'}) | T1 (Book Profit): ₹${target1.toFixed(2)} | Setup: ${setupType}`, 
      symbol
    );
  };

  // Automated Reversal Trigger Watcher (Auto-Pilot Execution)
  useEffect(() => {
    if (!isEngineActive || radarItems.length === 0) return;

    // Dynamic Market Timing Window Enforcement:
    // Equity entries allowed: 09:15 to 15:00 IST (no new entries in final 15m before 15:15 cutoff)
    // MCX Commodity entries (Crude, NatGas, Zinc) allowed: 09:00 to 23:15 IST (trades till MCX closes)
    const now = new Date();
    const istTimeStr = now.toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false });
    const [h, m, s] = istTimeStr.split(':').map(Number);
    const currentSeconds = h * 3600 + m * 60 + (s || 0);

    const isEquityEntryAllowed = currentSeconds >= (9 * 3600 + 15 * 60) && currentSeconds < (15 * 3600);
    const isMcxEntryAllowed = currentSeconds >= (9 * 3600) && currentSeconds < (23 * 3600 + 15 * 60);

    // If both markets are outside entry window, return early
    if (!isEquityEntryAllowed && !isMcxEntryAllowed) return;

    for (const item of radarItems) {
      if (positions.some(p => p.symbol === item.symbol)) continue;
      if (positions.length >= maxOpenPositions) break;

      const isCommodity = isCommoditySymbol(item.symbol);
      if (isCommodity && !isMcxEntryAllowed) continue;
      if (!isCommodity && !isEquityEntryAllowed) continue;

      // ⏱️ Anti-Churn Cooldown Protection: Prevent re-entering any stock within 20 minutes of an exit
      const cooldown = tradeCooldownRef.current[item.symbol];
      if (cooldown && (Date.now() - cooldown.lastExitTimestamp < 20 * 60 * 1000)) {
        continue;
      }
      const recentClosed = history.find(h => 
        h.symbol === item.symbol && 
        h.exitTimestamp && 
        (Date.now() - h.exitTimestamp < 20 * 60 * 1000)
      );
      if (recentClosed) {
        continue;
      }

      const ltp = livePrices[item.symbol] || item.ltp;
      if (ltp <= 0) continue;

      // 1. BUY REVERSAL BREAKDOWN SHORT SETUP (User Rule):
      // Entry: strictly after breakdown below Buy Reversal (S3) and before S4 (avoid chasing)
      // Stop Loss: Pivot / S1-R1 (Level 6 or Central Pivot)
      // Target 1: S4 Breakdown Level | Target 2: S5 Target Level
      if (item.buyRevShortSetupState && item.buyRevShortSetupState.isReadyToShort) {
        const slLevel = item.s1_r1 > ltp ? item.s1_r1 : (item.pivot > ltp ? item.pivot : item.s3);
        addLog(
          'SIGNAL',
          `🚨 S3 Breakdown SHORT Triggered: ${item.displayName} broke down below S3 Buy Reversal (₹${item.s3.toFixed(2)}). Entering SHORT @ ₹${ltp.toFixed(2)} with SL @ Pivot/S1-R1 (₹${slLevel.toFixed(2)}) & Target @ S4 (₹${item.s4.toFixed(2)}).`,
          item.symbol
        );
        executeTrade(
          item.symbol,
          item.displayName,
          'SELL',
          'BUY REVERSAL BREAKDOWN (SHORT)',
          ltp,
          slLevel, // Stop Loss = Pivot / S1-R1!
          item.s4, // Target 1 = S4 Breakdown Level
          item.r4,
          item.pivot,
          item.s5 || item.s4 // Target 2 = S5 Target Level
        );
      }
      // 2. SELL REVERSAL (R3) SHORT SETUP:
      // STRICT 7-STEP SEQUENCE: Only after breakout above R3, rejection back below R3, AND breakdown below Pivot!
      else if (item.shortSetupState && item.shortSetupState.isReadyToShort) {
        addLog(
          'SIGNAL', 
          `🚨 R3 SHORT Setup Triggered: ${item.displayName} tested R3 (₹${item.r3.toFixed(2)}), broke out to ₹${item.shortSetupState.maxHighAboveR3.toFixed(2)}, rejected back below R3, and broke below Pivot Point (₹${item.pivot.toFixed(2)}). Entering SHORT with SL @ Sell Reversal (₹${item.r3.toFixed(2)}).`, 
          item.symbol
        );
        executeTrade(
          item.symbol,
          item.displayName,
          'SELL',
          'SELL REVERSAL (PIVOT BREAKDOWN)',
          ltp,
          item.r3, // Stop Loss = Sell Reversal (R3)!
          item.s4,
          item.r4,
          item.pivot,
          item.s3  // Target 1 = S3 Buy Reversal (Book Profit)
        );
      }
      // 3. CONFIRMED LONG REVERSAL SETUP:
      // Price tests S3 ➔ Sweeps below S3 (liquidity sweep) ➔ Reclaims back above S3 ➔ Trigger confirmed BUY
      else if (item.longSetupState && item.longSetupState.isReadyToLong) {
        addLog(
          'SIGNAL',
          `🔔 Confirmed Long Reversal: ${item.displayName} swept below S3 (₹${item.s3.toFixed(2)}) and reclaimed above ₹${item.s3.toFixed(2)}. Entering LONG with SL @ ₹${item.s3.toFixed(2)}.`,
          item.symbol
        );
        executeTrade(
          item.symbol,
          item.displayName,
          'BUY',
          'BUY REVERSAL (S3 RECLAIM)',
          ltp,
          item.s3, // Stop Loss = S3
          item.s4,
          item.r4,
          item.pivot,
          item.pivot // Target 1 = Central Pivot (Book Profit)
        );
      }
    }
  }, [radarItems, isEngineActive, positions.length, maxOpenPositions, livePrices]);

  // Square Off Single Position
  const handleClosePosition = (id: string, reason: AlgoPosition['exitReason'] = 'MANUAL SQUARE-OFF') => {
    setPositions(prev => {
      const pos = prev.find(p => p.id === id);
      if (!pos) return prev;

      const ltp = livePrices[pos.symbol] || pos.currentPrice;
      const pts = pos.side === 'BUY' ? (ltp - pos.entryPrice) : (pos.entryPrice - ltp);
      const realizedPnl = Math.round(pts * pos.quantity * 100) / 100;

      const closedPos: AlgoPosition = {
        ...pos,
        currentPrice: ltp,
        exitPrice: ltp,
        exitDate: formatIstDate(),
        exitTime: formatIstTime(),
        exitTimestamp: Date.now(),
        status: 'CLOSED',
        exitReason: reason,
        realizedPnl
      };

      tradeCooldownRef.current[pos.symbol] = {
        lastExitTimestamp: Date.now(),
        setupType: pos.setupType
      };
      setHistory(h => [closedPos, ...h]);
      addLog('EXIT', `Manual Square-Off: ${pos.side} ${pos.displayName} @ ₹${ltp.toFixed(2)} | Realized P&L: ₹${realizedPnl.toLocaleString('en-IN')}`, pos.symbol);

      return prev.filter(p => p.id !== id);
    });
  };

  // Square Off All Positions (Emergency / MIS 15:15 Cutoff)
  const handleSquareOffAll = (reason: AlgoPosition['exitReason'] = 'MANUAL SQUARE-OFF') => {
    if (positions.length === 0) return;

    const closed = positions.map(pos => {
      const ltp = livePrices[pos.symbol] || pos.currentPrice;
      const pts = pos.side === 'BUY' ? (ltp - pos.entryPrice) : (pos.entryPrice - ltp);
      const realizedPnl = Math.round(pts * pos.quantity * 100) / 100;

      return {
        ...pos,
        currentPrice: ltp,
        exitPrice: ltp,
        exitDate: formatIstDate(),
        exitTime: formatIstTime(),
        exitTimestamp: Date.now(),
        status: 'CLOSED' as const,
        exitReason: reason,
        realizedPnl
      };
    });

    setHistory(prev => [...closed, ...prev]);
    setPositions([]);
    addLog('EXIT', `🚨 All ${closed.length} open positions squared off (${reason}).`);
  };

  // Download Multi-Sheet Excel Report (.xlsx)
  const handleDownloadExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const backendHttp = await getBackendHttpUrl();
      const res = await fetch(`${backendHttp}/api/algo-trade/export-excel`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'bypass-tunnel-reminder': 'true'
        },
        body: JSON.stringify({
          positions,
          history,
          metrics,
          logs
        })
      });

      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const a = document.createElement('a');
      a.href = url;
      a.download = `AlgoTrade_Report_${dateStr}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('INFO', `📊 Downloaded Excel Report: AlgoTrade_Report_${dateStr}.xlsx`);
    } catch (err: any) {
      console.warn('[AlgoTrade] Backend Excel export failed, using CSV fallback:', err.message);
      const escapeCsv = (v: any) => {
        const s = String(v ?? '');
        return (s.includes(',') || s.includes('"') || s.includes('\n')) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const headers = [
        'Status', 'Symbol', 'Side', 'Setup', 'Qty', 'Entry Date', 'Entry Time',
        'Entry Price', 'Exit Date', 'Exit Time', 'Exit Price', 'Exit Reason', 'P&L (INR)'
      ];
      const rows = [
        ...history.map(h => [
          'CLOSED', h.displayName, h.side, h.setupType, h.quantity,
          h.entryDate || (h.entryTimestamp ? formatIstDate(h.entryTimestamp) : ''),
          h.entryTime, h.entryPrice,
          h.exitDate || h.entryDate || (h.exitTimestamp ? formatIstDate(h.exitTimestamp) : ''),
          h.exitTime || '', h.exitPrice || '', h.exitReason || '', h.realizedPnl ?? 0
        ]),
        ...positions.map(p => [
          'OPEN', p.displayName, p.side, p.setupType, p.quantity,
          p.entryDate || (p.entryTimestamp ? formatIstDate(p.entryTimestamp) : ''),
          p.entryTime, p.entryPrice, '', '', p.currentPrice, 'OPEN POSITION', p.unrealizedPnl ?? 0
        ])
      ];
      const csv = '\uFEFF' + [headers, ...rows].map(r => r.map(escapeCsv).join(',')).join('\r\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const a = document.createElement('a');
      a.href = url;
      a.download = `AlgoTrade_Report_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      addLog('INFO', `📄 Downloaded CSV Report fallback: AlgoTrade_Report_${dateStr}.csv`);
    } finally {
      setIsExporting(false);
    }
  };

  // Reset Portfolio / Capital to Initial ₹10L
  const handleResetPortfolio = () => {
    if (window.confirm('Reset Algo Trading Portfolio and restore full ₹10,00,000 Capital?')) {
      setPositions([]);
      setHistory([]);
      localStorage.removeItem(STORAGE_POSITIONS_KEY);
      localStorage.removeItem(STORAGE_HISTORY_KEY);
      addLog('INFO', '🔄 Portfolio and Capital reset to initial ₹10,00,000 state.');
    }
  };

  // Capital & Performance Calculations
  const metrics = useMemo(() => {
    const usedMargin = positions.reduce((acc, p) => acc + p.allocatedCapital, 0);
    const unrealizedPnl = positions.reduce((acc, p) => acc + p.unrealizedPnl, 0);
    const realizedPnl = history.reduce((acc, h) => acc + (h.realizedPnl || 0), 0);
    const totalDayPnl = realizedPnl + unrealizedPnl;
    const availableMargin = Math.max(0, TOTAL_CAPITAL - usedMargin + realizedPnl);
    const totalCurrentValue = TOTAL_CAPITAL + totalDayPnl;
    const roiPct = (totalDayPnl / TOTAL_CAPITAL) * 100;

    const winTrades = history.filter(h => (h.realizedPnl || 0) > 0).length;
    const lossTrades = history.filter(h => (h.realizedPnl || 0) < 0).length;
    const winRate = history.length > 0 ? (winTrades / history.length) * 100 : 0;

    return {
      usedMargin,
      availableMargin,
      unrealizedPnl,
      realizedPnl,
      totalDayPnl,
      totalCurrentValue,
      roiPct,
      winTrades,
      lossTrades,
      winRate
    };
  }, [positions, history]);

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      width: '100%',
      height: '100%',
      minHeight: 0,
      background: isDark ? '#06080e' : '#f8fafc',
      color: 'var(--text-primary)',
      overflowY: 'auto',
      padding: '14px',
      gap: '14px',
      boxSizing: 'border-box'
    }}>
      {/* 1. TOP HERO BAR: Capital 10L, Day PnL & Pure Intraday Status */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '10px'
      }}>
        {/* Total Capital Card */}
        <div style={{
          background: isDark ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))' : '#ffffff',
          borderRadius: '10px',
          padding: '12px 14px',
          border: `1px solid ${isDark ? 'rgba(56, 189, 248, 0.25)' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>
              Allocated Capital
            </span>
            <Wallet size={16} color="#38bdf8" />
          </div>
          <div style={{ fontSize: '19px', fontWeight: '900', color: '#38bdf8' }}>
            ₹{TOTAL_CAPITAL.toLocaleString('en-IN')}
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Available: ₹{metrics.availableMargin.toLocaleString('en-IN')}</span>
            <span>Used: ₹{metrics.usedMargin.toLocaleString('en-IN')}</span>
          </div>
        </div>

        {/* Day P&L Card */}
        <div style={{
          background: isDark ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))' : '#ffffff',
          borderRadius: '10px',
          padding: '12px 14px',
          border: `1px solid ${metrics.totalDayPnl >= 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.05)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>
              Day Realized & Live P&L
            </span>
            {metrics.totalDayPnl >= 0 ? <TrendingUp size={16} color="#10b981" /> : <TrendingDown size={16} color="#ef4444" />}
          </div>
          <div style={{ 
            fontSize: '19px', 
            fontWeight: '900', 
            color: metrics.totalDayPnl >= 0 ? '#10b981' : '#ef4444' 
          }}>
            {metrics.totalDayPnl >= 0 ? '+' : ''}₹{metrics.totalDayPnl.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            <span style={{ fontSize: '12px', marginLeft: '6px', fontWeight: '700' }}>
              ({metrics.roiPct >= 0 ? '+' : ''}{metrics.roiPct.toFixed(2)}%)
            </span>
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Live: ₹{metrics.unrealizedPnl.toFixed(2)}</span>
            <span>Booked: ₹{metrics.realizedPnl.toFixed(2)}</span>
          </div>
        </div>

        {/* Win Rate & Performance */}
        <div style={{
          background: isDark ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))' : '#ffffff',
          borderRadius: '10px',
          padding: '12px 14px',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '700', textTransform: 'uppercase' }}>
              Strategy Win Rate
            </span>
            <Target size={16} color="#f59e0b" />
          </div>
          <div style={{ fontSize: '19px', fontWeight: '900', color: '#f59e0b' }}>
            {metrics.winRate.toFixed(1)}%
            <span style={{ fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px', fontWeight: '600' }}>
              ({metrics.winTrades}W / {metrics.lossTrades}L)
            </span>
          </div>
          <div style={{ fontSize: '10.5px', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between' }}>
            <span>Active: {positions.length} / {maxOpenPositions}</span>
            <span>Closed: {history.length}</span>
          </div>
        </div>

        {/* Pure Intraday & EOD Timer */}
        <div style={{
          background: isDark ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.8))' : '#ffffff',
          borderRadius: '10px',
          padding: '12px 14px',
          border: `1px solid ${isDark ? 'rgba(168, 85, 247, 0.3)' : '#e2e8f0'}`,
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#c084fc', fontWeight: '800', textTransform: 'uppercase' }}>
              Pure Intraday (MIS)
            </span>
            <Clock size={16} color="#c084fc" />
          </div>
          <div style={{ fontSize: '13px', fontWeight: '800', color: 'var(--text-primary)' }}>
            Equity: 15:15 IST | MCX (Crude/NatGas/Zinc): 23:25 IST
          </div>
          <div style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: '700' }}>
            ⏳ {timeToEodStr}
          </div>
        </div>
      </div>

      {/* 2. ENGINE CONTROL & ACTION BAR */}
      <div style={{
        background: isDark ? 'rgba(15, 23, 42, 0.75)' : '#ffffff',
        borderRadius: '10px',
        padding: '10px 14px',
        border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: '10px'
      }}>
        {/* Left: Engine Status Toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => {
              const nextState = !isEngineActive;
              setIsEngineActive(nextState);
              addLog('INFO', nextState ? '🟢 Algo Auto-Pilot Engine RESUMED.' : '⏸️ Algo Auto-Pilot Engine PAUSED.');
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 12px',
              borderRadius: '6px',
              border: 'none',
              background: isEngineActive ? '#10b981' : '#64748b',
              color: '#ffffff',
              fontSize: '12px',
              fontWeight: '800',
              cursor: 'pointer',
              boxShadow: isEngineActive ? '0 0 12px rgba(16, 185, 129, 0.4)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {isEngineActive ? <Play size={14} fill="#fff" /> : <Pause size={14} fill="#fff" />}
            <span>{isEngineActive ? 'AUTO-PILOT ACTIVE' : 'ENGINE PAUSED'}</span>
          </button>

          <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
            Strategy: <strong>Buy at S3 Reversal | Short: Test R3 ➔ Breakout ➔ Rejection below R3 ➔ Pivot Breakdown (SL: R3) ➔ Target 1 Profit Booking</strong>
          </span>
        </div>

        {/* Right: Risk per trade, Emergency Square-off, Reset */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
  
          {/* Max Positions Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--text-secondary)' }}>
            <span>Max Slots:</span>
            <select
              value={maxOpenPositions}
              onChange={(e) => setMaxOpenPositions(Number(e.target.value))}
              style={{
                background: isDark ? 'rgba(30, 41, 59, 0.8)' : '#f1f5f9',
                color: 'var(--text-primary)',
                border: '1px solid rgba(255,255,255,0.1)',
                padding: '3px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700'
              }}
            >
              <option value={2}>2 Positions (₹5.0L each)</option>
              <option value={4}>4 Positions (₹2.5L each)</option>
              <option value={5}>5 Positions (₹2.0L each)</option>
            </select>
          </div>

          {/* Emergency Square Off All */}
          {positions.length > 0 && (
            <button
              onClick={() => {
                if (window.confirm('Emergency Action: Square off ALL open intraday positions at market LTP?')) {
                  handleSquareOffAll('MANUAL SQUARE-OFF');
                }
              }}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '6px 10px',
                borderRadius: '6px',
                border: '1px solid #ef4444',
                background: 'rgba(239, 68, 68, 0.15)',
                color: '#ef4444',
                fontSize: '11.5px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              <ShieldAlert size={14} />
              <span>SQUARE OFF ALL ({positions.length})</span>
            </button>
          )}

          {/* Download Excel Report */}
          <button
            onClick={handleDownloadExcel}
            disabled={isExporting}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: '1px solid rgba(16, 185, 129, 0.4)',
              background: 'rgba(16, 185, 129, 0.12)',
              color: '#10b981',
              fontSize: '11px',
              fontWeight: '700',
              cursor: isExporting ? 'wait' : 'pointer'
            }}
            title="Download Multi-Sheet Excel Report (.xlsx) with Open Positions, Closed Trades & Summary"
          >
            <Download size={13} className={isExporting ? 'animate-bounce' : ''} />
            <span>{isExporting ? 'Exporting...' : 'Excel Report'}</span>
          </button>

          {/* Refresh Radar */}
          <button
            onClick={fetchRadarLevels}
            disabled={isRadarLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '6px 10px',
              borderRadius: '6px',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.1)' : '#cbd5e1'}`,
              background: 'transparent',
              color: 'var(--text-primary)',
              fontSize: '11px',
              fontWeight: '600',
              cursor: 'pointer'
            }}
          >
            <RefreshCw size={12} className={isRadarLoading ? 'animate-spin' : ''} />
            <span>Scan Levels</span>
          </button>

          {/* Reset Capital & History */}
          <button
            onClick={handleResetPortfolio}
            style={{
              padding: '6px 8px',
              borderRadius: '6px',
              border: 'none',
              background: 'transparent',
              color: 'var(--text-secondary)',
              cursor: 'pointer'
            }}
            title="Reset Capital & Portfolio"
          >
            <RotateCcw size={14} />
          </button>
        </div>
      </div>

      {/* 3. SUB-TABS NAVIGATION */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
        paddingBottom: '6px'
      }}>
        {[
          { id: 'positions', label: `Active Positions (${positions.length})`, icon: Activity },
          { id: 'radar', label: `Reversal Radar / Scanner (${radarItems.length})`, icon: Target },
          { id: 'history', label: `Trade History (${history.length})`, icon: Clock },
          { id: 'logs', label: `Execution Audit Logs (${logs.length})`, icon: Bot }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '6px',
                border: 'none',
                background: isActive ? (isDark ? '#0284c7' : '#e0f2fe') : 'transparent',
                color: isActive ? (isDark ? '#ffffff' : '#0369a1') : 'var(--text-secondary)',
                fontSize: '11.5px',
                fontWeight: isActive ? '800' : '600',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <Icon size={14} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* 4. CONTENT SECTIONS */}

      {/* 4A. ACTIVE POSITIONS VIEW */}
      {activeSubTab === 'positions' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {positions.length === 0 ? (
            <div style={{
              background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#ffffff',
              borderRadius: '8px',
              padding: '36px',
              textAlign: 'center',
              border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1'}`,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px'
            }}>
              <Bot size={36} color="#38bdf8" />
              <div style={{ fontSize: '14px', fontWeight: '800' }}>No Active Intraday Positions</div>
              <div style={{ fontSize: '11.5px', color: 'var(--text-secondary)', maxWidth: '440px' }}>
                Auto-Pilot is actively monitoring S3 Buy Reversals and R3 Sell Reversals across top F&O stocks. When a level triggers, orders execute automatically with strict SL & Targets.
              </div>
              <button
                onClick={() => setActiveSubTab('radar')}
                style={{
                  marginTop: '6px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  background: '#0284c7',
                  color: '#ffffff',
                  fontSize: '11px',
                  fontWeight: '700',
                  cursor: 'pointer'
                }}
              >
                <Target size={13} />
                <span>View Reversal Radar Setups</span>
              </button>
            </div>
          ) : (
            <div style={{
              overflowX: 'auto',
              borderRadius: '8px',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
              background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
                    background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                    color: 'var(--text-secondary)',
                    fontWeight: '800'
                  }}>
                    <th style={{ padding: '8px 12px' }}>Symbol</th>
                    <th style={{ padding: '8px 12px' }}>Side / Setup</th>
                    <th style={{ padding: '8px 12px' }}>Qty / Capital</th>
                    <th style={{ padding: '8px 12px' }}>Entry Price</th>
                    <th style={{ padding: '8px 12px' }}>Live LTP</th>
                    <th style={{ padding: '8px 12px' }}>Stop Loss</th>
                    <th style={{ padding: '8px 12px', color: '#10b981' }}>Target 1 (Book Profit)</th>
                    <th style={{ padding: '8px 12px' }}>Unrealized P&L</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map(pos => {
                    const isProfit = pos.unrealizedPnl >= 0;
                    return (
                      <tr 
                        key={pos.id}
                        style={{
                          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'}`,
                          transition: 'background 0.1s ease'
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{pos.displayName}</span>
                            {isCommoditySymbol(pos.symbol) ? (
                              <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                                MCX (Till 23:25)
                              </span>
                            ) : (
                              <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                                NSE (15:15 Cutoff)
                              </span>
                            )}
                            <button
                              onClick={() => {
                                onSymbolSelect(pos.symbol);
                                onSwitchToChart();
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                padding: 0,
                                display: 'inline-flex'
                              }}
                              title="Open in Candlestick Chart tab"
                            >
                              <ExternalLink size={12} />
                            </button>
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>Entry: {formatTradeDateTimeDisplay(pos.entryTime, pos.entryDate, pos.entryTimestamp)}</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '900',
                              background: pos.side === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                              color: pos.side === 'BUY' ? '#10b981' : '#ef4444'
                            }}>
                              {pos.side}
                            </span>
                            <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{pos.setupType}</span>
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '700' }}>{pos.quantity} shares</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>₹{pos.allocatedCapital.toLocaleString('en-IN')}</div>
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '700' }}>
                          ₹{pos.entryPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: '800', color: isProfit ? '#10b981' : '#ef4444' }}>
                          ₹{pos.currentPrice.toFixed(2)}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '700', color: '#ef4444' }}>₹{pos.stopLoss.toFixed(2)}</div>
                          {pos.isBreakeven && (
                            <span style={{ fontSize: '9.5px', color: '#10b981', fontWeight: '800' }}>Trailed to Entry</span>
                          )}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ color: '#10b981', fontWeight: '800' }}>T1: ₹{pos.target1.toFixed(2)}</div>
                          <span style={{ fontSize: '9.5px', color: '#10b981', fontWeight: '700' }}>Profit Booking Level</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '900', fontSize: '12.5px', color: isProfit ? '#10b981' : '#ef4444' }}>
                            {isProfit ? '+' : ''}₹{pos.unrealizedPnl.toFixed(2)}
                          </div>
                          <div style={{ fontSize: '10px', color: isProfit ? '#10b981' : '#ef4444', fontWeight: '700' }}>
                            ({isProfit ? '+' : ''}{pos.unrealizedPnlPct.toFixed(2)}%)
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => handleClosePosition(pos.id, 'MANUAL SQUARE-OFF')}
                            style={{
                              padding: '4px 8px',
                              borderRadius: '4px',
                              border: '1px solid #ef4444',
                              background: 'rgba(239, 68, 68, 0.1)',
                              color: '#ef4444',
                              fontSize: '10.5px',
                              fontWeight: '700',
                              cursor: 'pointer'
                            }}
                          >
                            Close MIS
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* 4B. REVERSAL RADAR & SCANNER VIEW */}
      {activeSubTab === 'radar' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '11.5px',
            color: 'var(--text-secondary)'
          }}>
            <span>Real-time proximity to S3 Buy Reversals and R3 Sell Reversals:</span>
            <span>Last scanned: {lastScanTime || 'Scanning...'}</span>
          </div>

          <div style={{
            overflowX: 'auto',
            borderRadius: '8px',
            border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
            background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff'
          }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
              <thead>
                <tr style={{
                  borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
                  background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                  color: 'var(--text-secondary)',
                  fontWeight: '800'
                }}>
                  <th style={{ padding: '8px 12px' }}>Symbol</th>
                  <th style={{ padding: '8px 12px' }}>Live LTP</th>
                  <th style={{ padding: '8px 12px', color: '#10b981' }}>Buy Reversal (S3)</th>
                  <th style={{ padding: '8px 12px', color: '#ef4444' }}>Sell Reversal (R3)</th>
                  <th style={{ padding: '8px 12px' }}>Central Pivot</th>
                  <th style={{ padding: '8px 12px' }}>Short Trade Sequence (7-Step)</th>
                  <th style={{ padding: '8px 12px', textAlign: 'right' }}>Trigger / Action</th>
                </tr>
              </thead>
              <tbody>
                {radarItems.map(item => {
                  const isBuyZone = item.status === 'IN BUY ZONE';
                  const isSellReady = item.shortSetupState?.isReadyToShort;
                  const isOpen = positions.some(p => p.symbol === item.symbol);

                  return (
                    <tr 
                      key={item.symbol}
                      style={{
                        borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'}`,
                        background: isBuyZone 
                          ? 'rgba(16, 185, 129, 0.06)' 
                          : (isSellReady ? 'rgba(239, 68, 68, 0.08)' : 'transparent')
                      }}
                    >
                      <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span>{item.displayName}</span>
                          {isCommoditySymbol(item.symbol) ? (
                            <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(234, 179, 8, 0.15)', color: '#eab308', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(234, 179, 8, 0.3)' }}>
                              MCX (Till 23:25)
                            </span>
                          ) : (
                            <span style={{ fontSize: '9px', fontWeight: '800', background: 'rgba(56, 189, 248, 0.15)', color: '#38bdf8', padding: '1px 5px', borderRadius: '4px', border: '1px solid rgba(56, 189, 248, 0.3)' }}>
                              NSE (15:15 Cutoff)
                            </span>
                          )}
                          <button
                            onClick={() => {
                              onSymbolSelect(item.symbol);
                              onSwitchToChart();
                            }}
                            style={{
                              background: 'transparent',
                              border: 'none',
                              color: '#38bdf8',
                              cursor: 'pointer',
                              padding: 0,
                              display: 'inline-flex'
                            }}
                            title="Open in Candlestick Chart tab"
                          >
                            <ExternalLink size={12} />
                          </button>
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                        ₹{item.ltp.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px', color: '#10b981', fontWeight: '700' }}>
                        <div>₹{item.s3.toFixed(2)}</div>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                          Dist: {item.distanceToBuyPct >= 0 ? '+' : ''}{item.distanceToBuyPct.toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: '#ef4444', fontWeight: '700' }}>
                        <div>₹{item.r3.toFixed(2)}</div>
                        <div style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                          Dist: {item.distanceToSellPct >= 0 ? '+' : ''}{item.distanceToSellPct.toFixed(2)}%
                        </div>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                        ₹{item.pivot.toFixed(2)}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {item.buyRevShortSetupState?.isReadyToShort ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '900',
                              background: '#ef4444',
                              color: '#ffffff',
                              boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
                              width: 'fit-content'
                            }}>
                              🚨 S3 BREAKDOWN ➔ SHORT READY
                            </span>
                            <span style={{ fontSize: '9.5px', color: '#ef4444', fontWeight: '700' }}>
                              SL: ₹{(item.s1_r1 || item.pivot).toFixed(2)} (Pivot/S1-R1) | T1: ₹{item.s4.toFixed(2)}
                            </span>
                          </div>
                        ) : item.shortSetupState?.isReadyToShort ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '900',
                              background: '#ef4444',
                              color: '#ffffff',
                              boxShadow: '0 0 10px rgba(239, 68, 68, 0.4)',
                              width: 'fit-content'
                            }}>
                              🔥 5. PIVOT BROKEN ➔ SHORT READY
                            </span>
                            <span style={{ fontSize: '9.5px', color: '#ef4444', fontWeight: '700' }}>
                              Stop Loss: ₹{item.r3.toFixed(2)} (Sell Reversal) | T1: ₹{item.s3.toFixed(2)}
                            </span>
                          </div>
                        ) : item.longSetupState?.isReadyToLong ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '900',
                              background: '#10b981',
                              color: '#ffffff',
                              boxShadow: '0 0 10px rgba(16, 185, 129, 0.4)',
                              width: 'fit-content'
                            }}>
                              🔔 4. S3 RECLAIMED ➔ BUY READY
                            </span>
                            <span style={{ fontSize: '9.5px', color: '#10b981', fontWeight: '700' }}>
                              Stop Loss: ₹{item.s3.toFixed(2)} | Target 1: ₹{item.pivot.toFixed(2)}
                            </span>
                          </div>
                        ) : item.buyRevShortSetupState?.isChasedBelowS4 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              background: 'rgba(148, 163, 184, 0.15)',
                              color: '#94a3b8',
                              border: '1px solid rgba(148, 163, 184, 0.3)',
                              width: 'fit-content'
                            }}>
                              ⏹️ S4 Hit: &lt; ₹{item.s4.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                              Move completed ➔ Chasing avoided
                            </span>
                          </div>
                        ) : item.buyRevShortSetupState?.hasMovedBelowS3 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              background: 'rgba(239, 68, 68, 0.15)',
                              color: '#f87171',
                              border: '1px solid rgba(239, 68, 68, 0.3)',
                              width: 'fit-content'
                            }}>
                              ⚠️ S3 Slip: &lt; ₹{item.s3.toFixed(2)}
                            </span>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                              Awaiting breakdown &lt; ₹{item.s4.toFixed(2)}
                            </span>
                          </div>
                        ) : item.shortSetupState?.hasRejectedBelowR3 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              background: 'rgba(245, 158, 11, 0.2)',
                              color: '#f59e0b',
                              border: '1px solid rgba(245, 158, 11, 0.3)',
                              width: 'fit-content'
                            }}>
                              ⚠️ 4. Rejection Confirmed
                            </span>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                              Awaiting Pivot Break &lt; ₹{item.pivot.toFixed(2)}
                            </span>
                          </div>
                        ) : item.longSetupState?.hasSweptBelowS3 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              width: 'fit-content'
                            }}>
                              🌊 2. S3 Swept (Low: ₹{item.longSetupState.minLowBelowS3.toFixed(2)})
                            </span>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                              Watching for Reclaim &gt; ₹{item.s3.toFixed(2)}
                            </span>
                          </div>
                        ) : item.shortSetupState?.hasBrokeOutAboveR3 ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span style={{
                              padding: '3px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '800',
                              background: 'rgba(56, 189, 248, 0.15)',
                              color: '#38bdf8',
                              width: 'fit-content'
                            }}>
                              📈 2. Broke Above R3 (High: ₹{item.shortSetupState.maxHighAboveR3.toFixed(2)})
                            </span>
                            <span style={{ fontSize: '9.5px', color: 'var(--text-secondary)' }}>
                              Watching for Rejection below ₹{item.r3.toFixed(2)}
                            </span>
                          </div>
                        ) : (
                          <span style={{
                            padding: '3px 8px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '600',
                            color: 'var(--text-secondary)'
                          }}>
                            Monitoring S3 / R3 Zones
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                        {isOpen ? (
                          <span style={{ fontSize: '10.5px', color: '#38bdf8', fontWeight: '800' }}>Position Active</span>
                        ) : (
                          <div style={{ display: 'inline-flex', gap: '4px' }}>
                            <button
                              onClick={() => executeTrade(
                                item.symbol,
                                item.displayName,
                                'BUY',
                                'BUY REVERSAL (S3 RECLAIM)',
                                item.ltp,
                                item.s3,
                                item.s4,
                                item.r4,
                                item.pivot,
                                item.pivot
                              )}
                              style={{
                                padding: '3px 7px',
                                borderRadius: '4px',
                                border: '1px solid #10b981',
                                background: 'rgba(16, 185, 129, 0.15)',
                                color: '#10b981',
                                fontSize: '10px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                              title="Execute BUY on S3 Reclaim"
                            >
                              BUY (S3)
                            </button>
                            <button
                              onClick={() => {
                                const isReady = item.buyRevShortSetupState?.isReadyToShort || item.shortSetupState?.isReadyToShort;
                                if (!isReady) {
                                  if (!window.confirm(`Notice: ${item.displayName} has not confirmed rejection / breakdown yet. Execute SHORT anyway?`)) {
                                    return;
                                  }
                                }
                                  const isS3Short = item.buyRevShortSetupState?.isReadyToShort;
                                  const s3Sl = item.s1_r1 > item.ltp ? item.s1_r1 : (item.pivot > item.ltp ? item.pivot : item.s3);
                                  executeTrade(
                                    item.symbol,
                                    item.displayName,
                                    'SELL',
                                    isS3Short ? 'BUY REVERSAL BREAKDOWN (SHORT)' : 'SELL REVERSAL (PIVOT BREAKDOWN)',
                                    item.ltp,
                                    isS3Short ? s3Sl : item.r3,
                                    item.s4,
                                    item.r4,
                                    item.pivot,
                                    isS3Short ? (item.s5 || item.s4) : item.s3
                                  );
                              }}
                              style={{
                                padding: '3px 7px',
                                borderRadius: '4px',
                                border: '1px solid #ef4444',
                                background: 'rgba(239, 68, 68, 0.15)',
                                color: '#ef4444',
                                fontSize: '10px',
                                fontWeight: '800',
                                cursor: 'pointer'
                              }}
                              title="Execute SHORT with SL @ Reversal Level"
                            >
                              SHORT
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 4C. TRADE HISTORY VIEW */}
      {activeSubTab === 'history' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {history.length === 0 ? (
            <div style={{
              background: isDark ? 'rgba(15, 23, 42, 0.4)' : '#ffffff',
              borderRadius: '8px',
              padding: '36px',
              textAlign: 'center',
              border: `1px dashed ${isDark ? 'rgba(255, 255, 255, 0.1)' : '#cbd5e1'}`,
              color: 'var(--text-secondary)'
            }}>
              No closed intraday trades recorded yet today.
            </div>
          ) : (
            <div style={{
              overflowX: 'auto',
              borderRadius: '8px',
              border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
              background: isDark ? 'rgba(15, 23, 42, 0.6)' : '#ffffff'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px', textAlign: 'left' }}>
                <thead>
                  <tr style={{
                    borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
                    background: isDark ? 'rgba(30, 41, 59, 0.5)' : '#f8fafc',
                    color: 'var(--text-secondary)',
                    fontWeight: '800'
                  }}>
                    <th style={{ padding: '8px 12px' }}>Symbol</th>
                    <th style={{ padding: '8px 12px' }}>Side / Setup</th>
                    <th style={{ padding: '8px 12px' }}>Entry Date & Time / Price</th>
                    <th style={{ padding: '8px 12px' }}>Exit Date & Time / Price</th>
                    <th style={{ padding: '8px 12px' }}>Exit Reason</th>
                    <th style={{ padding: '8px 12px', textAlign: 'right' }}>Realized P&L</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map(item => {
                    const isProfit = (item.realizedPnl || 0) >= 0;
                    return (
                      <tr 
                        key={item.id}
                        style={{
                          borderBottom: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.04)' : '#f1f5f9'}`
                        }}
                      >
                        <td style={{ padding: '10px 12px', fontWeight: '800' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{item.displayName}</span>
                            <button
                              onClick={() => {
                                onSymbolSelect(item.symbol);
                                onSwitchToChart();
                              }}
                              style={{
                                background: 'transparent',
                                border: 'none',
                                color: '#38bdf8',
                                cursor: 'pointer',
                                padding: 0
                              }}
                            >
                              <ExternalLink size={12} />
                            </button>
                          </div>
                          <span style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{item.quantity} shares</span>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '800',
                            background: item.side === 'BUY' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                            color: item.side === 'BUY' ? '#10b981' : '#ef4444'
                          }}>
                            {item.side}
                          </span>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px' }}>
                            {item.setupType}
                          </div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '700' }}>₹{item.entryPrice.toFixed(2)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{formatTradeDateTimeDisplay(item.entryTime, item.entryDate, item.entryTimestamp)}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <div style={{ fontWeight: '700' }}>₹{item.exitPrice?.toFixed(2)}</div>
                          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>{formatTradeDateTimeDisplay(item.exitTime, item.exitDate || item.entryDate, item.exitTimestamp)}</div>
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{
                            padding: '2px 6px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700',
                            background: item.exitReason?.includes('TARGET') 
                              ? 'rgba(16, 185, 129, 0.15)' 
                              : (item.exitReason?.includes('STOP') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(56, 189, 248, 0.15)'),
                            color: item.exitReason?.includes('TARGET') 
                              ? '#10b981' 
                              : (item.exitReason?.includes('STOP') ? '#ef4444' : '#38bdf8')
                          }}>
                            {item.exitReason}
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <div style={{ fontWeight: '900', fontSize: '13px', color: isProfit ? '#10b981' : '#ef4444' }}>
                            {isProfit ? '+' : ''}₹{item.realizedPnl?.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
      )}

      {/* 4D. EXECUTION AUDIT LOGS VIEW */}
      {activeSubTab === 'logs' && (
        <div style={{
          background: isDark ? 'rgba(10, 14, 23, 0.95)' : '#ffffff',
          borderRadius: '8px',
          border: `1px solid ${isDark ? 'rgba(255, 255, 255, 0.08)' : '#e2e8f0'}`,
          padding: '12px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          fontFamily: 'monospace',
          fontSize: '11px',
          maxHeight: '400px',
          overflowY: 'auto'
        }}>
          {logs.map(log => {
            let color = '#94a3b8';
            if (log.type === 'ORDER') color = '#38bdf8';
            if (log.type === 'SIGNAL') color = '#f59e0b';
            if (log.type === 'EXIT') color = '#10b981';
            if (log.type === 'WARNING') color = '#ef4444';

            return (
              <div 
                key={log.id} 
                style={{ 
                  display: 'flex', 
                  alignItems: 'flex-start', 
                  gap: '8px', 
                  borderBottom: '1px solid rgba(255,255,255,0.03)',
                  paddingBottom: '4px'
                }}
              >
                <span style={{ color: 'var(--text-secondary)', flexShrink: 0 }}>[{log.date ? `${log.date}, ${log.time}` : log.time}]</span>
                <span style={{ 
                  color, 
                  fontWeight: '800', 
                  padding: '1px 4px', 
                  borderRadius: '3px', 
                  background: 'rgba(255,255,255,0.04)',
                  flexShrink: 0 
                }}>
                  {log.type}
                </span>
                <span style={{ color: 'var(--text-primary)', wordBreak: 'break-word' }}>{log.message}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
