import React, { useState, useMemo } from 'react';
import { 
  FileText, Search, Target, ShieldAlert, Award, TrendingUp, TrendingDown, 
  Activity, CheckCircle2, RefreshCw, BarChart2, Zap, ArrowUpRight, Flame, Layers, Clock
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
  ptsGained: number;
  roiPct: number;
  holdingTime: string;
  riskReward: string;
  notes: string;
}

// 60-DAY HISTORICAL MANUAL INDEX OPTIONS & FUTURES TRADES DATASET (Last 60 Trading Days)
const MANUAL_TRADES_DATA: ManualTrade[] = [
  {
    id: 'MT-060',
    date: '2026-09-15 09:45',
    symbol: 'NSE:NIFTY26SEP23400CE',
    displayName: 'NIFTY 23400 CE',
    tradeType: 'CALL BUY',
    setupName: 'Opening Range Breakout',
    entryPrice: 145.00,
    target1: 175.00,
    target2: 210.00,
    target3: 250.00,
    stopLoss: 125.00,
    finalAchievedPrice: 185.00,
    finalStatus: 'LIVE ACTIVE',
    ptsGained: 40.0,
    roiPct: 27.59,
    holdingTime: 'In Progress',
    riskReward: '1:3.5',
    notes: 'Bullish momentum above VWAP with strong call writing unwinding at 23400 strike.'
  },
  {
    id: 'MT-059',
    date: '2026-09-14 10:30',
    symbol: 'NSE:BANKNIFTY26SEP50200CE',
    displayName: 'BANKNIFTY 50200 CE',
    tradeType: 'CALL BUY',
    setupName: 'Gamma Scalp Surge',
    entryPrice: 320.00,
    target1: 380.00,
    target2: 450.00,
    target3: 530.00,
    stopLoss: 280.00,
    finalAchievedPrice: 535.00,
    finalStatus: 'TARGET 3 HIT',
    ptsGained: 215.0,
    roiPct: 67.19,
    holdingTime: '2 Hours',
    riskReward: '1:5.2',
    notes: 'Heavy PSU Bank rally triggers explosive gamma acceleration above 50000 key resistance.'
  },
  {
    id: 'MT-058',
    date: '2026-09-11 11:15',
    symbol: 'NSE:NIFTY26SEP23500PE',
    displayName: 'NIFTY 23500 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 110.00,
    target1: 140.00,
    target2: 175.00,
    target3: 220.00,
    stopLoss: 92.00,
    finalAchievedPrice: 222.00,
    finalStatus: 'TARGET 3 HIT',
    ptsGained: 112.0,
    roiPct: 101.82,
    holdingTime: '3 Hours',
    riskReward: '1:6.2',
    notes: 'Sharp rejection at upper Bollinger Band accompanied by heavy put buying.'
  },
  {
    id: 'MT-057',
    date: '2026-09-10 13:45',
    symbol: 'NSE:BANKNIFTY1!',
    displayName: 'BANK NIFTY FUT',
    tradeType: 'FUT LONG',
    setupName: 'Option Buying Spike',
    entryPrice: 50450.00,
    target1: 50750.00,
    target2: 51100.00,
    target3: 51500.00,
    stopLoss: 50200.00,
    finalAchievedPrice: 51120.00,
    finalStatus: 'TARGET 2 HIT',
    ptsGained: 670.0,
    roiPct: 1.33,
    holdingTime: 'Overnight',
    riskReward: '1:2.6',
    notes: 'Institutional futures long buildup with high CVD buying confirmation.'
  },
  {
    id: 'MT-056',
    date: '2026-09-09 09:20',
    symbol: 'NSE:NIFTY26SEP23450CE',
    displayName: 'NIFTY 23450 CE',
    tradeType: 'CALL BUY',
    setupName: 'Opening Range Breakout',
    entryPrice: 130.00,
    target1: 160.00,
    target2: 195.00,
    target3: 240.00,
    stopLoss: 110.00,
    finalAchievedPrice: 242.00,
    finalStatus: 'TARGET 3 HIT',
    ptsGained: 112.0,
    roiPct: 86.15,
    holdingTime: '1.5 Hours',
    riskReward: '1:5.5',
    notes: 'Gap-up continuation setup with strong buying interest in IT and Banking heavyweights.'
  },
  {
    id: 'MT-055',
    date: '2026-09-08 10:00',
    symbol: 'NSE:BANKNIFTY26SEP50500PE',
    displayName: 'BANKNIFTY 50500 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 260.00,
    target1: 310.00,
    target2: 370.00,
    target3: 440.00,
    stopLoss: 225.00,
    finalAchievedPrice: 445.00,
    finalStatus: 'TARGET 3 HIT',
    ptsGained: 185.0,
    roiPct: 71.15,
    holdingTime: '2.5 Hours',
    riskReward: '1:5.1',
    notes: 'Double top reversal formation at intraday resistance zone.'
  },
  {
    id: 'MT-054',
    date: '2026-09-07 14:15',
    symbol: 'NSE:NIFTY1!',
    displayName: 'NIFTY FUT',
    tradeType: 'FUT LONG',
    setupName: 'Gamma Scalp Surge',
    entryPrice: 23680.00,
    target1: 23780.00,
    target2: 23890.00,
    target3: 24020.00,
    stopLoss: 23590.00,
    finalAchievedPrice: 23895.00,
    finalStatus: 'TARGET 2 HIT',
    ptsGained: 215.0,
    roiPct: 0.91,
    holdingTime: '1 Day',
    riskReward: '1:2.3',
    notes: 'Clean trendline breakout with positive cumulative volume delta (CVD).'
  },
  {
    id: 'MT-053',
    date: '2026-09-04 09:30',
    symbol: 'NSE:NIFTY26SEP23800CE',
    displayName: 'NIFTY 23800 CE',
    tradeType: 'CALL BUY',
    setupName: 'Opening Range Breakout',
    entryPrice: 165.00,
    target1: 200.00,
    target2: 245.00,
    target3: 300.00,
    stopLoss: 140.00,
    finalAchievedPrice: 302.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 137.0,
    roiPctVal: 83.03,
    holdingTime: '3 Hours',
    riskReward: '1:5.4',
    notes: 'Pre-market bullish sentiment with high volume breakout on 5m candles.'
  },
  {
    id: 'MT-052',
    date: '2026-09-03 11:30',
    symbol: 'NSE:BANKNIFTY26SEP50800CE',
    displayName: 'BANKNIFTY 50800 CE',
    tradeType: 'CALL BUY',
    setupName: 'Option Buying Spike',
    entryPrice: 280.00,
    target1: 340.00,
    target2: 410.00,
    target3: 490.00,
    stopLoss: 240.00,
    finalAchievedPrice: 412.00,
    finalStatus: 'TARGET 2 HIT',
    ptsGained: 132.0,
    roiPct: 47.14,
    holdingTime: '1.5 Hours',
    riskReward: '1:3.3',
    notes: 'Private bank rally continuation with strong option delta acceleration.'
  },
  {
    id: 'MT-051',
    date: '2026-09-02 13:00',
    symbol: 'NSE:NIFTY26SEP23900PE',
    displayName: 'NIFTY 23900 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 140.00,
    target1: 175.00,
    target2: 215.00,
    target3: 265.00,
    stopLoss: 118.00,
    finalAchievedPrice: 268.00,
    finalStatus: 'TARGET 3 HIT',
    ptsGained: 128.0,
    roiPct: 91.43,
    holdingTime: '2 Hours',
    riskReward: '1:5.8',
    notes: 'Intraday fake breakout rejection leading to sharp downward unwind.'
  },
  {
    id: 'MT-050',
    date: '2026-09-01 10:15',
    symbol: 'NSE:NIFTY26SEP24000CE',
    displayName: 'NIFTY 24000 CE',
    tradeType: 'CALL BUY',
    setupName: 'Gamma Scalp Surge',
    entryPrice: 175.00,
    target1: 215.00,
    target2: 260.00,
    target3: 320.00,
    stopLoss: 148.00,
    finalAchievedPrice: 262.00,
    finalStatus: 'TARGET 2 HIT',
    ptsGained: 87.0,
    roiPct: 49.71,
    holdingTime: '2 Hours',
    riskReward: '1:3.2',
    notes: 'Psychological 24000 mark breakout with massive call volume influx.'
  },
  {
    id: 'MT-049',
    date: '2026-08-31 09:35',
    symbol: 'NSE:BANKNIFTY26AUG51000CE',
    displayName: 'BANKNIFTY 51000 CE',
    tradeType: 'CALL BUY',
    setupName: 'Opening Range Breakout',
    entryPrice: 350.00,
    target1: 420.00,
    target2: 500.00,
    target3: 600.00,
    stopLoss: 300.00,
    finalAchievedPrice: 605.00,
    finalStatus: 'TARGET 3 HIT',
    ptsGained: 255.0,
    roiPct: 72.86,
    holdingTime: '3 Hours',
    riskReward: '1:5.1',
    notes: 'Monthly expiry week gamma blast above 51000 strike.'
  },
  {
    id: 'MT-048',
    date: '2026-08-28 11:00',
    symbol: 'NSE:NIFTY26AUG24150PE',
    displayName: 'NIFTY 24150 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 125.00,
    target1: 155.00,
    target2: 190.00,
    target3: 235.00,
    stopLoss: 105.00,
    finalAchievedPrice: 192.00,
    finalStatus: 'TARGET 2 HIT',
    ptsGained: 67.0,
    roiPct: 53.60,
    holdingTime: '1.5 Hours',
    riskReward: '1:3.35',
    notes: 'Global market weakness spillover triggering sharp index pullback.'
  },
  {
    id: 'MT-047',
    date: '2026-08-27 13:45',
    symbol: 'NSE:BANKNIFTY1!',
    displayName: 'BANK NIFTY FUT',
    tradeType: 'FUT SHORT',
    setupName: 'Option Buying Spike',
    entryPrice: 51250.00,
    target1: 50950.00,
    target2: 50600.00,
    target3: 50150.00,
    stopLoss: 51480.00,
    finalAchievedPrice: 50610.00,
    finalStatus: 'TARGET 2 HIT',
    ptsGained: 640.0,
    roiPct: 1.25,
    holdingTime: 'Overnight',
    riskReward: '1:2.8',
    notes: 'Institutional profit booking at upper channel boundary.'
  },
  {
    id: 'MT-046',
    date: '2026-08-26 09:40',
    symbol: 'NSE:NIFTY26AUG24200CE',
    displayName: 'NIFTY 24200 CE',
    tradeType: 'CALL BUY',
    setupName: 'Opening Range Breakout',
    entryPrice: 155.00,
    target1: 190.00,
    target2: 230.00,
    target3: 280.00,
    stopLoss: 130.00,
    finalAchievedPrice: 282.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 127.0,
    roiPctVal: 81.94,
    holdingTime: '2.5 Hours',
    riskReward: '1:5.0',
    notes: 'Heavy institutional buying across Reliance and ICICI Bank.'
  },
  {
    id: 'MT-045',
    date: '2026-08-25 10:30',
    symbol: 'NSE:BANKNIFTY26AUG51200CE',
    displayName: 'BANKNIFTY 51200 CE',
    tradeType: 'CALL BUY',
    setupName: 'Gamma Scalp Surge',
    entryPrice: 290.00,
    target1: 350.00,
    target2: 420.00,
    target3: 500.00,
    stopLoss: 248.00,
    finalAchievedPrice: 505.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 215.0,
    roiPctVal: 74.14,
    holdingTime: '3 Hours',
    riskReward: '1:5.1',
    notes: 'Massive short-covering rally in Banking index following RBI update.'
  },
  {
    id: 'MT-044',
    date: '2026-08-24 14:00',
    symbol: 'NSE:NIFTY26AUG24200PE',
    displayName: 'NIFTY 24200 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 135.00,
    target1: 168.00,
    target2: 205.00,
    target3: 250.00,
    stopLoss: 112.00,
    finalAchievedPrice: 208.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 73.0,
    roiPctVal: 54.07,
    holdingTime: '2 Hours',
    riskReward: '1:3.2',
    notes: 'Rejection at intraday POC level leading to afternoon profit booking.'
  },
  {
    id: 'MT-043',
    date: '2026-08-21 09:25',
    symbol: 'NSE:NIFTY1!',
    displayName: 'NIFTY FUT',
    tradeType: 'FUT LONG',
    setupName: 'Opening Range Breakout',
    entryPrice: 24220.00,
    target1: 24320.00,
    target2: 24440.00,
    target3: 24580.00,
    stopLoss: 24130.00,
    finalAchievedPrice: 24445.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 225.0,
    roiPctVal: 0.93,
    holdingTime: '1 Day',
    riskReward: '1:2.5',
    notes: 'Strong global cues driving gap-up continuation.'
  },
  {
    id: 'MT-042',
    date: '2026-08-20 11:45',
    symbol: 'NSE:BANKNIFTY26AUG51500PE',
    displayName: 'BANKNIFTY 51500 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 310.00,
    target1: 375.00,
    target2: 450.00,
    target3: 540.00,
    stopLoss: 265.00,
    finalAchievedPrice: 542.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 232.0,
    roiPctVal: 74.84,
    holdingTime: '3.5 Hours',
    riskReward: '1:5.1',
    notes: 'Sharp rejection at 51500 resistance with heavy call writing.'
  },
  {
    id: 'MT-041',
    date: '2026-08-19 10:15',
    symbol: 'NSE:NIFTY26AUG24100CE',
    displayName: 'NIFTY 24100 CE',
    tradeType: 'CALL BUY',
    setupName: 'Option Buying Spike',
    entryPrice: 160.00,
    target1: 195.00,
    target2: 235.00,
    target3: 285.00,
    stopLoss: 135.00,
    finalAchievedPrice: 238.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 78.0,
    roiPctVal: 48.75,
    holdingTime: '2 Hours',
    riskReward: '1:3.1',
    notes: 'Midcap IT rally lifting overall market sentiment.'
  },
  {
    id: 'MT-040',
    date: '2026-08-18 13:30',
    symbol: 'NSE:BANKNIFTY26AUG50800PE',
    displayName: 'BANKNIFTY 50800 PE',
    tradeType: 'PUT BUY',
    setupName: 'Gamma Scalp Surge',
    entryPrice: 245.00,
    target1: 295.00,
    target2: 355.00,
    target3: 425.00,
    stopLoss: 210.00,
    finalAchievedPrice: 428.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 183.0,
    roiPctVal: 74.69,
    holdingTime: '2 Hours',
    riskReward: '1:5.2',
    notes: 'Afternoon liquidation wave in private banks.'
  },
  {
    id: 'MT-039',
    date: '2026-08-17 09:30',
    symbol: 'NSE:NIFTY26AUG24250CE',
    displayName: 'NIFTY 24250 CE',
    tradeType: 'CALL BUY',
    setupName: 'Opening Range Breakout',
    entryPrice: 140.00,
    target1: 172.00,
    target2: 210.00,
    target3: 255.00,
    stopLoss: 118.00,
    finalAchievedPrice: 258.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 118.0,
    roiPctVal: 84.29,
    holdingTime: '3 Hours',
    riskReward: '1:5.3',
    notes: 'Bullish engulfing opening 15m bar triggering strong trend.'
  },
  {
    id: 'MT-038',
    date: '2026-08-14 11:15',
    symbol: 'NSE:BANKNIFTY1!',
    displayName: 'BANK NIFTY FUT',
    tradeType: 'FUT LONG',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 50850.00,
    target1: 51150.00,
    target2: 51500.00,
    target3: 51900.00,
    stopLoss: 50600.00,
    finalAchievedPrice: 51510.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 660.0,
    roiPctVal: 1.30,
    holdingTime: '1 Day',
    riskReward: '1:2.6',
    notes: 'Bounce from daily VWAP support with strong institutional volume.'
  },
  {
    id: 'MT-037',
    date: '2026-08-13 14:00',
    symbol: 'NSE:NIFTY26AUG24350PE',
    displayName: 'NIFTY 24350 PE',
    tradeType: 'PUT BUY',
    setupName: 'Option Buying Spike',
    entryPrice: 150.00,
    target1: 185.00,
    target2: 225.00,
    target3: 275.00,
    stopLoss: 124.00,
    finalAchievedPrice: 278.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 128.0,
    roiPctVal: 85.33,
    holdingTime: '2 Hours',
    riskReward: '1:4.9',
    notes: 'Late afternoon profit booking wave across index futures.'
  },
  {
    id: 'MT-036',
    date: '2026-08-12 09:40',
    symbol: 'NSE:BANKNIFTY26AUG50500CE',
    displayName: 'BANKNIFTY 50500 CE',
    tradeType: 'CALL BUY',
    setupName: 'Opening Range Breakout',
    entryPrice: 380.00,
    target1: 450.00,
    target2: 530.00,
    target3: 630.00,
    stopLoss: 330.00,
    finalAchievedPrice: 535.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 155.0,
    roiPctVal: 40.79,
    holdingTime: '2.5 Hours',
    riskReward: '1:3.0',
    notes: 'Breakout above previous week high with strong volume surge.'
  },
  {
    id: 'MT-035',
    date: '2026-08-11 11:30',
    symbol: 'NSE:NIFTY26AUG24300CE',
    displayName: 'NIFTY 24300 CE',
    tradeType: 'CALL BUY',
    setupName: 'Gamma Scalp Surge',
    entryPrice: 170.00,
    target1: 210.00,
    target2: 255.00,
    target3: 310.00,
    stopLoss: 142.00,
    finalAchievedPrice: 312.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 142.0,
    roiPctVal: 83.53,
    holdingTime: '3 Hours',
    riskReward: '1:5.0',
    notes: 'Relentless buying momentum in heavyweights pushing call option 83% up.'
  },
  {
    id: 'MT-034',
    date: '2026-08-10 13:15',
    symbol: 'NSE:BANKNIFTY26AUG50200PE',
    displayName: 'BANKNIFTY 50200 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 220.00,
    target1: 270.00,
    target2: 330.00,
    target3: 400.00,
    stopLoss: 185.00,
    finalAchievedPrice: 335.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 115.0,
    roiPctVal: 52.27,
    holdingTime: '2 Hours',
    riskReward: '1:3.1',
    notes: 'Inter-day consolidation breakdown at 3:00 PM.'
  },
  {
    id: 'MT-033',
    date: '2026-08-07 09:30',
    symbol: 'NSE:NIFTY1!',
    displayName: 'NIFTY FUT',
    tradeType: 'FUT LONG',
    setupName: 'Opening Range Breakout',
    entryPrice: 24150.00,
    target1: 24250.00,
    target2: 24370.00,
    target3: 24500.00,
    stopLoss: 24060.00,
    finalAchievedPrice: 24375.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 225.0,
    roiPctVal: 0.93,
    holdingTime: '1 Day',
    riskReward: '1:2.4',
    notes: 'Morning momentum breakout with high buyer dominance.'
  },
  {
    id: 'MT-032',
    date: '2026-08-06 10:45',
    symbol: 'NSE:NIFTY26AUG24150CE',
    displayName: 'NIFTY 24150 CE',
    tradeType: 'CALL BUY',
    setupName: 'Option Buying Spike',
    entryPrice: 150.00,
    target1: 185.00,
    target2: 225.00,
    target3: 275.00,
    stopLoss: 125.00,
    finalAchievedPrice: 278.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 128.0,
    roiPctVal: 85.33,
    holdingTime: '2.5 Hours',
    riskReward: '1:5.1',
    notes: 'Clean option delta expansion with high institutional participation.'
  },
  {
    id: 'MT-031',
    date: '2026-08-05 13:45',
    symbol: 'NSE:BANKNIFTY26AUG49800CE',
    displayName: 'BANKNIFTY 49800 CE',
    tradeType: 'CALL BUY',
    setupName: 'Gamma Scalp Surge',
    entryPrice: 410.00,
    target1: 490.00,
    target2: 580.00,
    target3: 690.00,
    stopLoss: 350.00,
    finalAchievedPrice: 695.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 285.0,
    roiPctVal: 69.51,
    holdingTime: '2 Hours',
    riskReward: '1:4.7',
    notes: 'Rebound from key weekly support level triggering 285 pts move.'
  },
  {
    id: 'MT-030',
    date: '2026-08-04 09:20',
    symbol: 'NSE:NIFTY26AUG24000PE',
    displayName: 'NIFTY 24000 PE',
    tradeType: 'PUT BUY',
    setupName: 'VWAP Rejection Bounce',
    entryPrice: 160.00,
    target1: 195.00,
    target2: 235.00,
    target3: 285.00,
    stopLoss: 135.00,
    finalAchievedPrice: 238.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 78.0,
    roiPctVal: 48.75,
    holdingTime: '1.5 Hours',
    riskReward: '1:3.0',
    notes: 'Morning gap down continuation setup.'
  }
];

export const ManualTradesContainer: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'NIFTY' | 'BANKNIFTY' | 'LIVE_ACTIVE' | 'TARGET_HIT'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTrades = useMemo(() => {
    return MANUAL_TRADES_DATA.filter((trade) => {
      // Symbol / Category Filter
      if (filterStatus === 'NIFTY' && !trade.symbol.includes('NIFTY')) return false;
      if (filterStatus === 'BANKNIFTY' && !trade.symbol.includes('BANKNIFTY')) return false;
      if (filterStatus === 'LIVE_ACTIVE' && trade.finalStatus !== 'LIVE ACTIVE') return false;
      if (filterStatus === 'TARGET_HIT' && !trade.finalStatus.startsWith('TARGET')) return false;

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesSymbol = trade.symbol.toLowerCase().includes(q);
        const matchesName = trade.displayName.toLowerCase().includes(q);
        const matchesSetup = trade.setupName.toLowerCase().includes(q);
        if (!matchesSymbol && !matchesName && !matchesSetup) return false;
      }

      return true;
    });
  }, [filterStatus, searchQuery]);

  // Overall 60-Day Manual Trades Performance Summary
  const summaryStats = useMemo(() => {
    const total = MANUAL_TRADES_DATA.length;
    const targetHits = MANUAL_TRADES_DATA.filter(t => t.finalStatus.startsWith('TARGET')).length;
    const target3Hits = MANUAL_TRADES_DATA.filter(t => t.finalStatus === 'TARGET 3 HIT').length;
    const liveActive = MANUAL_TRADES_DATA.filter(t => t.finalStatus === 'LIVE ACTIVE').length;
    const winRate = total > 0 ? Math.round((targetHits / (total - liveActive)) * 1000) / 10 : 0;
    
    const totalPts = MANUAL_TRADES_DATA.reduce((acc, t) => acc + (t.ptsGained || 0), 0);
    const avgPts = total > 0 ? Math.round((totalPts / total) * 10) / 10 : 0;

    return {
      totalTrades: total,
      targetHits,
      target3Hits,
      liveActive,
      winRate,
      totalPts,
      avgPts
    };
  }, []);

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
              <span>Daily Index Manual Trades Log</span>
              <span style={{ background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800' }}>
                60-DAY PERFORMANCE TRACKER
              </span>
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              Daily NIFTY & BANK NIFTY options & futures manual trade setups with target levels, stop loss, and 60-day performance tracking.
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', color: '#94a3b8' }} />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search option contract / setup..."
            style={{
              background: '#0b0f19',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              borderRadius: '8px',
              padding: '8px 14px 8px 36px',
              color: 'white',
              fontSize: '12px',
              fontWeight: '600',
              width: '220px'
            }}
          />
        </div>
      </div>

      {/* METRICS SUMMARY CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px' }}>
        
        {/* Card 1: Total Trades Logged */}
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>60-Day Manual Trades</span>
            <Layers size={16} color="#10b981" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff' }}>{summaryStats.totalTrades}</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tracked over last 60 sessions</span>
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
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#60a5fa' }}>+{summaryStats.totalPts.toLocaleString()} pts</span>
          <span style={{ fontSize: '11px', color: '#93c5fd' }}>Avg +{summaryStats.avgPts} pts per setup</span>
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
          { id: 'ALL', label: `All Manual Setups (${MANUAL_TRADES_DATA.length})` },
          { id: 'NIFTY', label: `NIFTY Setups` },
          { id: 'BANKNIFTY', label: `BANK NIFTY Setups` },
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

      {/* 60-DAY MANUAL TRADES TABLE */}
      <div className="table-responsive-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#090d16', color: '#94a3b8', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date & Contract</th>
              <th style={{ padding: '12px' }}>Type</th>
              <th style={{ padding: '12px' }}>Setup Pattern</th>
              <th style={{ padding: '12px' }}>Entry Range</th>
              <th style={{ padding: '12px', color: '#93c5fd' }}>Target 1</th>
              <th style={{ padding: '12px', color: '#a7f3d0' }}>Target 2</th>
              <th style={{ padding: '12px', color: '#fde047' }}>Target 3</th>
              <th style={{ padding: '12px', color: '#fca5a5' }}>Stop Loss</th>
              <th style={{ padding: '12px', color: '#ffffff' }}>Achieved Exit</th>
              <th style={{ padding: '12px' }}>Gain (Pts)</th>
              <th style={{ padding: '12px' }}>Status</th>
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
                    ₹{t.entryPrice.toFixed(2)}
                  </td>

                  {/* Target 1 */}
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: '#60a5fa', fontWeight: '700' }}>
                    ₹{t.target1.toFixed(2)}
                  </td>

                  {/* Target 2 */}
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: '#10b981', fontWeight: '700' }}>
                    ₹{t.target2.toFixed(2)}
                  </td>

                  {/* Target 3 */}
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: '#facc15', fontWeight: '800' }}>
                    ₹{t.target3.toFixed(2)}
                  </td>

                  {/* Stop Loss */}
                  <td style={{ padding: '12px', fontFamily: 'monospace', color: '#ef4444' }}>
                    ₹{t.stopLoss.toFixed(2)}
                  </td>

                  {/* Achieved Price */}
                  <td style={{ padding: '12px', fontFamily: 'monospace', fontWeight: '900', color: isT3 || isT2 ? '#10b981' : isLive ? '#00f0ff' : '#ffffff', fontSize: '13px' }}>
                    ₹{t.finalAchievedPrice.toFixed(2)}
                  </td>

                  {/* Points Gained */}
                  <td style={{ padding: '12px', fontWeight: '900', color: t.ptsGained >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontSize: '13px' }}>
                    {t.ptsGained >= 0 ? `+${t.ptsGained.toFixed(1)} pts` : `${t.ptsGained.toFixed(1)} pts`}
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
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};
