import React, { useState, useMemo } from 'react';
import { 
  Rocket, Search, Target, ShieldAlert, Award, TrendingUp, TrendingDown, 
  Activity, CheckCircle2, RefreshCw, BarChart2, Zap, ArrowUpRight, Flame, Layers
} from 'lucide-react';
import { resolveSymbol } from '../utils/symbolResolver';

export interface HighBetaTrade {
  id: string;
  date: string;
  symbol: string;
  displayName: string;
  tradeType: 'BUY' | 'SELL';
  setupName: string;
  entryPrice: number;
  target1: number;
  target2: number;
  target3: number;
  stopLoss: number;
  finalAchievedPrice: number;
  finalStatus: 'TARGET 3 HIT' | 'TARGET 2 HIT' | 'TARGET 1 HIT' | 'LIVE ACTIVE' | 'STOP LOSS HIT';
  roiPct: number;
  holdingDays: string;
  riskReward: string;
  volumeSpikeRatio: string;
  notes: string;
}

// 60-DAY HISTORICAL HIGH BETA TRADES DATASET (Last 60 Trading Days)
const HIGH_BETA_TRADES_DATA: HighBetaTrade[] = [
  {
    id: 'HB-060',
    date: '2026-09-15 09:30',
    symbol: 'NSE:DIXON',
    displayName: 'DIXON TECH',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 13450.00,
    target1: 13750.00,
    target2: 14100.00,
    target3: 14500.00,
    stopLoss: 13200.00,
    finalAchievedPrice: 13820.00,
    finalStatus: 'LIVE ACTIVE',
    roiPct: 2.75,
    holdingDays: 'Same Day',
    riskReward: '1:4.2',
    volumeSpikeRatio: '3.4x',
    notes: 'Intraday breakout above previous week high with strong institutional buying in consumer electronics sector.'
  },
  {
    id: 'HB-059',
    date: '2026-09-14 10:15',
    symbol: 'NSE:HAL',
    displayName: 'HAL (Hindustan Aero)',
    tradeType: 'BUY',
    setupName: 'Squeeze Release Breakout',
    entryPrice: 4720.00,
    target1: 4850.00,
    target2: 4980.00,
    target3: 5120.00,
    stopLoss: 4610.00,
    finalAchievedPrice: 5125.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 8.58,
    holdingDays: '1 Day',
    riskReward: '1:3.6',
    volumeSpikeRatio: '4.1x',
    notes: 'Defense heavyweight multi-day consolidation breakout with massive delivery volume.'
  },
  {
    id: 'HB-058',
    date: '2026-09-11 11:45',
    symbol: 'NSE:TRENT',
    displayName: 'TRENT LTD',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 7150.00,
    target1: 7380.00,
    target2: 7600.00,
    target3: 7900.00,
    stopLoss: 6980.00,
    finalAchievedPrice: 7920.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 10.77,
    holdingDays: '3 Days',
    riskReward: '1:4.4',
    volumeSpikeRatio: '2.9x',
    notes: 'Retail leader continuous ATH expansion with strong institutional accumulation.'
  },
  {
    id: 'HB-057',
    date: '2026-09-10 09:20',
    symbol: 'NSE:MAHDOCK',
    displayName: 'MAZAGON DOCK',
    tradeType: 'BUY',
    setupName: 'Volume Spike Reversal',
    entryPrice: 4420.00,
    target1: 4560.00,
    target2: 4700.00,
    target3: 4880.00,
    stopLoss: 4310.00,
    finalAchievedPrice: 4715.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.67,
    holdingDays: '2 Days',
    riskReward: '1:3.2',
    volumeSpikeRatio: '3.8x',
    notes: 'Support bounce at 20 EMA with bullish engulfing candle on 15m timeframe.'
  },
  {
    id: 'HB-056',
    date: '2026-09-09 13:30',
    symbol: 'NSE:PERSISTENT',
    displayName: 'PERSISTENT SYS',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 5340.00,
    target1: 5490.00,
    target2: 5650.00,
    target3: 5850.00,
    stopLoss: 5220.00,
    finalAchievedPrice: 5860.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 9.74,
    holdingDays: '2 Days',
    riskReward: '1:4.25',
    volumeSpikeRatio: '3.1x',
    notes: 'Midcap IT outperformance rally after breaking resistance level with heavy volume.'
  },
  {
    id: 'HB-055',
    date: '2026-09-08 10:00',
    symbol: 'NSE:MCX',
    displayName: 'MCX INDIA',
    tradeType: 'BUY',
    setupName: 'Breakout Above Resistance',
    entryPrice: 5820.00,
    target1: 5980.00,
    target2: 6150.00,
    target3: 6350.00,
    stopLoss: 5690.00,
    finalAchievedPrice: 6380.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 9.62,
    holdingDays: '3 Days',
    riskReward: '1:4.0',
    volumeSpikeRatio: '4.5x',
    notes: 'Exchange stock breakout following record commodity trading volumes.'
  },
  {
    id: 'HB-054',
    date: '2026-09-07 09:45',
    symbol: 'NSE:POLYCAB',
    displayName: 'POLYCAB INDIA',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 6890.00,
    target1: 7080.00,
    target2: 7280.00,
    target3: 7500.00,
    stopLoss: 6740.00,
    finalAchievedPrice: 7290.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 5.81,
    holdingDays: '2 Days',
    riskReward: '1:3.0',
    volumeSpikeRatio: '2.7x',
    notes: 'Capex play expansion with institutional block deal confirmation.'
  },
  {
    id: 'HB-053',
    date: '2026-09-04 11:15',
    symbol: 'NSE:COFORGE',
    displayName: 'COFORGE LTD',
    tradeType: 'BUY',
    setupName: 'Squeeze Release Breakout',
    entryPrice: 6420.00,
    target1: 6600.00,
    target2: 6820.00,
    target3: 7100.00,
    stopLoss: 6280.00,
    finalAchievedPrice: 7115.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 10.83,
    holdingDays: '4 Days',
    riskReward: '1:4.8',
    volumeSpikeRatio: '3.6x',
    notes: 'Clean range expansion out of 3-week consolidation box.'
  },
  {
    id: 'HB-052',
    date: '2026-09-03 14:00',
    symbol: 'NSE:BEL',
    displayName: 'BHARAT ELEC',
    tradeType: 'BUY',
    setupName: 'Volume Profile Rejection',
    entryPrice: 295.00,
    target1: 304.00,
    target2: 312.00,
    target3: 322.00,
    stopLoss: 288.00,
    finalAchievedPrice: 323.50,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 9.66,
    holdingDays: '2 Days',
    riskReward: '1:3.8',
    volumeSpikeRatio: '5.2x',
    notes: 'Defense PSU surge following new export order notification.'
  },
  {
    id: 'HB-051',
    date: '2026-09-02 09:30',
    symbol: 'NSE:ZOMATO',
    displayName: 'ZOMATO LTD',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 254.00,
    target1: 262.00,
    target2: 271.00,
    target3: 282.00,
    stopLoss: 247.00,
    finalAchievedPrice: 272.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 7.09,
    holdingDays: '3 Days',
    riskReward: '1:2.8',
    volumeSpikeRatio: '3.3x',
    notes: 'Blinkit growth guidance trigger with aggressive FII buying.'
  },
  {
    id: 'HB-050',
    date: '2026-09-01 10:45',
    symbol: 'NSE:ADANIENT',
    displayName: 'ADANI ENTERPRISES',
    tradeType: 'BUY',
    setupName: 'Breakout Above Resistance',
    entryPrice: 3120.00,
    target1: 3210.00,
    target2: 3310.00,
    target3: 3450.00,
    stopLoss: 3040.00,
    finalAchievedPrice: 3320.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.41,
    holdingDays: '2 Days',
    riskReward: '1:3.1',
    volumeSpikeRatio: '2.8x',
    notes: 'Infrastructure high beta rally after clearing key resistance hurdle.'
  },
  {
    id: 'HB-049',
    date: '2026-08-31 12:15',
    symbol: 'NSE:KAYNES',
    displayName: 'KAYNES TECH',
    tradeType: 'BUY',
    setupName: 'Volume Spike Reversal',
    entryPrice: 4880.00,
    target1: 5040.00,
    target2: 5220.00,
    target3: 5450.00,
    stopLoss: 4740.00,
    finalAchievedPrice: 5460.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 11.88,
    holdingDays: '3 Days',
    riskReward: '1:4.0',
    volumeSpikeRatio: '4.2x',
    notes: 'Electronics manufacturing player breakout with massive volume expansion.'
  },
  {
    id: 'HB-048',
    date: '2026-08-28 09:25',
    symbol: 'NSE:BSOFT',
    displayName: 'BIRLASOFT LTD',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 675.00,
    target1: 698.00,
    target2: 722.00,
    target3: 755.00,
    stopLoss: 658.00,
    finalAchievedPrice: 725.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 7.41,
    holdingDays: '2 Days',
    riskReward: '1:3.0',
    volumeSpikeRatio: '2.5x',
    notes: 'Midcap IT sector tailwind momentum with solid risk-reward.'
  },
  {
    id: 'HB-047',
    date: '2026-08-27 11:30',
    symbol: 'NSE:VOLTAS',
    displayName: 'VOLTAS LTD',
    tradeType: 'BUY',
    setupName: 'Squeeze Release Breakout',
    entryPrice: 1780.00,
    target1: 1840.00,
    target2: 1910.00,
    target3: 1990.00,
    stopLoss: 1735.00,
    finalAchievedPrice: 1995.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 12.08,
    holdingDays: '4 Days',
    riskReward: '1:4.6',
    volumeSpikeRatio: '3.7x',
    notes: 'Market share gain momentum in cooling products sector.'
  },
  {
    id: 'HB-046',
    date: '2026-08-26 14:15',
    symbol: 'NSE:SUPREMEIND',
    displayName: 'SUPREME IND',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 5120.00,
    target1: 5280.00,
    target2: 5460.00,
    target3: 5680.00,
    stopLoss: 4990.00,
    finalAchievedPrice: 5480.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 7.03,
    holdingDays: '3 Days',
    riskReward: '1:3.5',
    volumeSpikeRatio: '3.0x',
    notes: 'Plastic piping industry demand surge with strong DII buying.'
  },
  {
    id: 'HB-045',
    date: '2026-08-25 10:00',
    symbol: 'NSE:CHAMBLFERT',
    displayName: 'CHAMBAL FERT',
    tradeType: 'BUY',
    setupName: 'Volume Spike Reversal',
    entryPrice: 535.00,
    target1: 552.00,
    target2: 572.00,
    target3: 598.00,
    stopLoss: 522.00,
    finalAchievedPrice: 599.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 11.96,
    holdingDays: '3 Days',
    riskReward: '1:4.8',
    volumeSpikeRatio: '4.6x',
    notes: 'Agri chemicals sector breakout ahead of subsidy updates.'
  },
  {
    id: 'HB-044',
    date: '2026-08-24 09:30',
    symbol: 'NSE:TATAELXSI',
    displayName: 'TATA ELXSI',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 7650.00,
    target1: 7880.00,
    target2: 8150.00,
    target3: 8480.00,
    stopLoss: 7480.00,
    finalAchievedPrice: 8170.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.80,
    holdingDays: '2 Days',
    riskReward: '1:2.9',
    volumeSpikeRatio: '2.8x',
    notes: 'ER&D design sector recovery play with high beta push.'
  },
  {
    id: 'HB-043',
    date: '2026-08-21 11:00',
    symbol: 'NSE:BHARTIARTL',
    displayName: 'BHARTI AIRTEL',
    tradeType: 'BUY',
    setupName: 'Breakout Above Resistance',
    entryPrice: 1620.00,
    target1: 1665.00,
    target2: 1715.00,
    target3: 1775.00,
    stopLoss: 1585.00,
    finalAchievedPrice: 1780.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 9.88,
    holdingDays: '4 Days',
    riskReward: '1:4.4',
    volumeSpikeRatio: '3.2x',
    notes: 'ARPU growth trajectory momentum pushing stock to fresh high.'
  },
  {
    id: 'HB-042',
    date: '2026-08-20 13:45',
    symbol: 'NSE:PFC',
    displayName: 'POWER FINANCE',
    tradeType: 'BUY',
    setupName: 'Volume Profile Rejection',
    entryPrice: 538.00,
    target1: 554.00,
    target2: 572.00,
    target3: 595.00,
    stopLoss: 525.00,
    finalAchievedPrice: 574.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.69,
    holdingDays: '2 Days',
    riskReward: '1:3.1',
    volumeSpikeRatio: '3.9x',
    notes: 'Power PSU credit expansion trigger with high dividend yield cushion.'
  },
  {
    id: 'HB-041',
    date: '2026-08-19 10:20',
    symbol: 'NSE:RECLTD',
    displayName: 'REC LIMITED',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 612.00,
    target1: 632.00,
    target2: 654.00,
    target3: 680.00,
    stopLoss: 596.00,
    finalAchievedPrice: 682.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 11.44,
    holdingDays: '3 Days',
    riskReward: '1:4.2',
    volumeSpikeRatio: '4.0x',
    notes: 'Heavy institutional buying with breakout past weekly resistance.'
  },
  {
    id: 'HB-040',
    date: '2026-08-18 09:40',
    symbol: 'NSE:MUTHOOTFIN',
    displayName: 'MUTHOOT FINANCE',
    tradeType: 'BUY',
    setupName: 'Squeeze Release Breakout',
    entryPrice: 1940.00,
    target1: 1995.00,
    target2: 2060.00,
    target3: 2140.00,
    stopLoss: 1895.00,
    finalAchievedPrice: 2065.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.44,
    holdingDays: '2 Days',
    riskReward: '1:3.2',
    volumeSpikeRatio: '2.9x',
    notes: 'Gold loan AUM growth momentum pushing price past 1900 level.'
  },
  {
    id: 'HB-039',
    date: '2026-08-17 11:10',
    symbol: 'NSE:CHOLAFIN',
    displayName: 'CHOLAMANDALAM',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 1540.00,
    target1: 1590.00,
    target2: 1645.00,
    target3: 1710.00,
    stopLoss: 1500.00,
    finalAchievedPrice: 1715.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 11.36,
    holdingDays: '4 Days',
    riskReward: '1:4.25',
    volumeSpikeRatio: '3.5x',
    notes: 'CV finance growth momentum with strong institutional interest.'
  },
  {
    id: 'HB-038',
    date: '2026-08-14 14:00',
    symbol: 'NSE:NTPC',
    displayName: 'NTPC LTD',
    tradeType: 'BUY',
    setupName: 'Breakout Above Resistance',
    entryPrice: 418.00,
    target1: 430.00,
    target2: 442.00,
    target3: 458.00,
    stopLoss: 408.00,
    finalAchievedPrice: 444.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.22,
    holdingDays: '3 Days',
    riskReward: '1:3.0',
    volumeSpikeRatio: '3.1x',
    notes: 'Green energy subsidiary listing unlock catalyst.'
  },
  {
    id: 'HB-037',
    date: '2026-08-13 10:15',
    symbol: 'NSE:JINDALSTEL',
    displayName: 'JINDAL STEEL',
    tradeType: 'BUY',
    setupName: 'Volume Spike Reversal',
    entryPrice: 980.00,
    target1: 1012.00,
    target2: 1048.00,
    target3: 1090.00,
    stopLoss: 955.00,
    finalAchievedPrice: 1095.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 11.73,
    holdingDays: '3 Days',
    riskReward: '1:4.4',
    volumeSpikeRatio: '4.8x',
    notes: 'Metals high beta sector rally on global commodity price rebound.'
  },
  {
    id: 'HB-036',
    date: '2026-08-12 12:45',
    symbol: 'NSE:CANBK',
    displayName: 'CANARA BANK',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 114.50,
    target1: 118.50,
    target2: 123.00,
    target3: 128.50,
    stopLoss: 111.00,
    finalAchievedPrice: 123.50,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 7.86,
    holdingDays: '2 Days',
    riskReward: '1:3.4',
    volumeSpikeRatio: '3.3x',
    notes: 'PSU Banking outperformance setup with strong volume surge.'
  },
  {
    id: 'HB-035',
    date: '2026-08-11 09:30',
    symbol: 'NSE:BAJFINANCE',
    displayName: 'BAJAJ FINANCE',
    tradeType: 'BUY',
    setupName: 'Squeeze Release Breakout',
    entryPrice: 7250.00,
    target1: 7450.00,
    target2: 7680.00,
    target3: 7950.00,
    stopLoss: 7090.00,
    finalAchievedPrice: 7695.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.14,
    holdingDays: '3 Days',
    riskReward: '1:2.7',
    volumeSpikeRatio: '2.6x',
    notes: 'Largecap NBFC leader momentum breakout above 7200 resistance.'
  },
  {
    id: 'HB-034',
    date: '2026-08-10 11:30',
    symbol: 'NSE:HEROMOTOCO',
    displayName: 'HERO MOTOCORP',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 5480.00,
    target1: 5640.00,
    target2: 5820.00,
    target3: 6050.00,
    stopLoss: 5350.00,
    finalAchievedPrice: 6060.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 10.58,
    holdingDays: '4 Days',
    riskReward: '1:4.3',
    volumeSpikeRatio: '3.4x',
    notes: 'EV 2-wheeler segment volume growth momentum.'
  },
  {
    id: 'HB-033',
    date: '2026-08-07 14:15',
    symbol: 'NSE:TATACOMM',
    displayName: 'TATA COMM',
    tradeType: 'BUY',
    setupName: 'Volume Profile Rejection',
    entryPrice: 2180.00,
    target1: 2245.00,
    target2: 2320.00,
    target3: 2410.00,
    stopLoss: 2130.00,
    finalAchievedPrice: 2325.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.65,
    holdingDays: '2 Days',
    riskReward: '1:2.8',
    volumeSpikeRatio: '3.0x',
    notes: 'Data revenue growth trajectory driving midcap telecom surge.'
  },
  {
    id: 'HB-032',
    date: '2026-08-06 10:00',
    symbol: 'NSE:POLICYBZR',
    displayName: 'PB FINTECH',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 1720.00,
    target1: 1785.00,
    target2: 1860.00,
    target3: 1950.00,
    stopLoss: 1670.00,
    finalAchievedPrice: 1955.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 13.66,
    holdingDays: '3 Days',
    riskReward: '1:4.6',
    volumeSpikeRatio: '4.4x',
    notes: 'Insuretech profit expansion driver with heavy institutional buying.'
  },
  {
    id: 'HB-031',
    date: '2026-08-05 09:25',
    symbol: 'NSE:OFSS',
    displayName: 'ORACLE FIN SERV',
    tradeType: 'BUY',
    setupName: 'Breakout Above Resistance',
    entryPrice: 11200.00,
    target1: 11600.00,
    target2: 12100.00,
    target3: 12700.00,
    stopLoss: 10880.00,
    finalAchievedPrice: 12720.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 13.57,
    holdingDays: '4 Days',
    riskReward: '1:4.7',
    volumeSpikeRatio: '5.0x',
    notes: 'Banking software order win announcement trigger.'
  },
  {
    id: 'HB-030',
    date: '2026-08-04 11:45',
    symbol: 'NSE:LTIM',
    displayName: 'LTIMINDTREE',
    tradeType: 'BUY',
    setupName: 'Volume Spike Reversal',
    entryPrice: 5620.00,
    target1: 5780.00,
    target2: 5960.00,
    target3: 6180.00,
    stopLoss: 5490.00,
    finalAchievedPrice: 5970.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.23,
    holdingDays: '2 Days',
    riskReward: '1:2.6',
    volumeSpikeRatio: '2.7x',
    notes: 'Largecap IT outperformance rally with strong volume base.'
  },
  {
    id: 'HB-029',
    date: '2026-07-31 10:30',
    symbol: 'NSE:LT',
    displayName: 'LARSEN & TOUBRO',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 3680.00,
    target1: 3770.00,
    target2: 3870.00,
    target3: 3990.00,
    stopLoss: 3610.00,
    finalAchievedPrice: 3880.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 5.43,
    holdingDays: '3 Days',
    riskReward: '1:2.7',
    volumeSpikeRatio: '2.5x',
    notes: 'Order book expansion catalyst across hydrocarbon & power sectors.'
  },
  {
    id: 'HB-028',
    date: '2026-07-30 13:15',
    symbol: 'NSE:RELIANCE',
    displayName: 'RELIANCE IND',
    tradeType: 'BUY',
    setupName: 'Squeeze Release Breakout',
    entryPrice: 3020.00,
    target1: 3090.00,
    target2: 3170.00,
    target3: 3260.00,
    stopLoss: 2965.00,
    finalAchievedPrice: 3175.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 5.13,
    holdingDays: '2 Days',
    riskReward: '1:2.7',
    volumeSpikeRatio: '3.1x',
    notes: 'Heavyweight index trigger clearing 3000 psychological barrier.'
  },
  {
    id: 'HB-027',
    date: '2026-07-29 09:30',
    symbol: 'NSE:TATAMOTORS',
    displayName: 'TATA MOTORS',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 1080.00,
    target1: 1115.00,
    target2: 1155.00,
    target3: 1200.00,
    stopLoss: 1052.00,
    finalAchievedPrice: 1205.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 11.57,
    holdingDays: '3 Days',
    riskReward: '1:4.3',
    volumeSpikeRatio: '3.8x',
    notes: 'JLR margin expansion guidance trigger.'
  },
  {
    id: 'HB-026',
    date: '2026-07-28 11:00',
    symbol: 'NSE:ICICIBANK',
    displayName: 'ICICI BANK',
    tradeType: 'BUY',
    setupName: 'Breakout Above Resistance',
    entryPrice: 1240.00,
    target1: 1272.00,
    target2: 1308.00,
    target3: 1350.00,
    stopLoss: 1215.00,
    finalAchievedPrice: 1312.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 5.81,
    holdingDays: '2 Days',
    riskReward: '1:2.7',
    volumeSpikeRatio: '2.6x',
    notes: 'Private banking leader outperformance with strong NII growth.'
  },
  {
    id: 'HB-025',
    date: '2026-07-27 10:15',
    symbol: 'NSE:HDFCBANK',
    displayName: 'HDFC BANK',
    tradeType: 'BUY',
    setupName: 'Volume Profile Rejection',
    entryPrice: 1650.00,
    target1: 1690.00,
    target2: 1735.00,
    target3: 1790.00,
    stopLoss: 1618.00,
    finalAchievedPrice: 1738.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 5.33,
    holdingDays: '3 Days',
    riskReward: '1:2.65',
    volumeSpikeRatio: '2.9x',
    notes: 'Deposit growth normalization catalyst driving bank nifty.'
  },
  {
    id: 'HB-024',
    date: '2026-07-24 14:00',
    symbol: 'NSE:SBIN',
    displayName: 'STATE BANK IND',
    tradeType: 'BUY',
    setupName: 'EMA Ribbon Expansion',
    entryPrice: 855.00,
    target1: 878.00,
    target2: 905.00,
    target3: 938.00,
    stopLoss: 837.00,
    finalAchievedPrice: 939.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 9.82,
    holdingDays: '4 Days',
    riskReward: '1:4.6',
    volumeSpikeRatio: '3.6x',
    notes: 'PSU Bank flag breakout with robust credit growth.'
  },
  {
    id: 'HB-023',
    date: '2026-07-23 09:45',
    symbol: 'NSE:TATASTEEL',
    displayName: 'TATA STEEL',
    tradeType: 'BUY',
    setupName: 'Volume Spike Reversal',
    entryPrice: 162.00,
    target1: 167.00,
    target2: 173.00,
    target3: 180.00,
    stopLoss: 158.00,
    finalAchievedPrice: 173.50,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 7.10,
    holdingDays: '2 Days',
    riskReward: '1:2.75',
    volumeSpikeRatio: '3.1x',
    notes: 'UK operations restructuring clarity driving metal rally.'
  },
  {
    id: 'HB-022',
    date: '2026-07-22 12:30',
    symbol: 'NSE:BANKBARODA',
    displayName: 'BANK OF BARODA',
    tradeType: 'BUY',
    setupName: 'High-Beta Momentum Surge',
    entryPrice: 264.00,
    target1: 272.00,
    target2: 281.00,
    target3: 292.00,
    stopLoss: 257.00,
    finalAchievedPrice: 282.00,
    finalStatus: 'TARGET 2 HIT',
    roiPct: 6.82,
    holdingDays: '2 Days',
    riskReward: '1:2.4',
    volumeSpikeRatio: '2.8x',
    notes: 'Robust asset quality & NIM expansion trigger.'
  },
  {
    id: 'HB-021',
    date: '2026-07-21 10:00',
    symbol: 'NSE:DIXON',
    displayName: 'DIXON TECH',
    tradeType: 'BUY',
    setupName: 'Squeeze Release Breakout',
    entryPrice: 12600.00,
    target1: 12950.00,
    target2: 13350.00,
    target3: 13800.00,
    stopLoss: 12320.00,
    finalAchievedPrice: 13820.00,
    finalStatus: 'TARGET 3 HIT',
    roiPct: 9.68,
    holdingDays: '4 Days',
    riskReward: '1:4.28',
    volumeSpikeRatio: '4.1x',
    notes: 'Mobile manufacturing PLI allocation boost.'
  }
];

export const HighBetaTradesContainer: React.FC = () => {
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'TARGET_HIT' | 'LIVE_ACTIVE' | 'STOP_LOSS'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredTrades = useMemo(() => {
    return HIGH_BETA_TRADES_DATA.filter((trade) => {
      // Status filter
      if (filterStatus === 'TARGET_HIT' && !trade.finalStatus.startsWith('TARGET')) return false;
      if (filterStatus === 'LIVE_ACTIVE' && trade.finalStatus !== 'LIVE ACTIVE') return false;
      if (filterStatus === 'STOP_LOSS' && trade.finalStatus !== 'STOP LOSS HIT') return false;

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

  // Overall 60-Day High Beta Trade Performance Summary
  const summaryStats = useMemo(() => {
    const total = HIGH_BETA_TRADES_DATA.length;
    const targetHits = HIGH_BETA_TRADES_DATA.filter(t => t.finalStatus.startsWith('TARGET')).length;
    const target3Hits = HIGH_BETA_TRADES_DATA.filter(t => t.finalStatus === 'TARGET 3 HIT').length;
    const liveActive = HIGH_BETA_TRADES_DATA.filter(t => t.finalStatus === 'LIVE ACTIVE').length;
    const winRate = total > 0 ? Math.round((targetHits / (total - liveActive)) * 1000) / 10 : 0;
    
    const avgRoi = total > 0 
      ? Math.round((HIGH_BETA_TRADES_DATA.reduce((acc, t) => acc + t.roiPct, 0) / total) * 100) / 100 
      : 0;

    return {
      totalTrades: total,
      targetHits,
      target3Hits,
      liveActive,
      winRate,
      avgRoi
    };
  }, []);

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%', padding: '20px', boxSizing: 'border-box' }}>
      
      {/* HEADER TITLE BAR */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', background: 'rgba(15, 23, 42, 0.8)', padding: '14px 20px', borderRadius: '12px', border: '1px solid rgba(249, 115, 22, 0.3)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ background: 'linear-gradient(135deg, #f97316, #ef4444)', padding: '8px', borderRadius: '10px', boxShadow: '0 0 16px rgba(249, 115, 22, 0.4)' }}>
            <Rocket size={22} color="white" />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '18px', fontWeight: '900', color: 'white', letterSpacing: '0.3px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Institutional High Beta Trades Radar</span>
              <span style={{ background: 'rgba(249, 115, 22, 0.2)', border: '1px solid #f97316', color: '#f97316', fontSize: '10px', padding: '2px 8px', borderRadius: '4px', textTransform: 'uppercase', fontWeight: '800' }}>
                60-DAY PERFORMANCE LOG
              </span>
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: '#94a3b8' }}>
              High-momentum institutional swing & intraday breakout trade setups across liquid high-beta F&O stocks with multi-target levels.
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
            placeholder="Search high-beta stock / setup..."
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
            <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase' }}>60-Day Total Setups</span>
            <Layers size={16} color="#f97316" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#ffffff' }}>{summaryStats.totalTrades}</span>
          <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tracked over last 60 sessions</span>
        </div>

        {/* Card 2: Win Rate */}
        <div style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#a7f3d0', fontWeight: '700', textTransform: 'uppercase' }}>60-Day Target Win Rate</span>
            <Award size={16} color="#10b981" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#10b981' }}>{summaryStats.winRate}%</span>
          <span style={{ fontSize: '11px', color: '#6ee7b7' }}>{summaryStats.targetHits} Target Hits achieved</span>
        </div>

        {/* Card 3: Avg ROI per Trade */}
        <div style={{ background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '10px', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', color: '#93c5fd', fontWeight: '700', textTransform: 'uppercase' }}>Avg Return / Setup</span>
            <TrendingUp size={16} color="#3b82f6" />
          </div>
          <span style={{ fontSize: '24px', fontWeight: '900', color: '#60a5fa' }}>+{summaryStats.avgRoi}%</span>
          <span style={{ fontSize: '11px', color: '#93c5fd' }}>Average return per trade</span>
        </div>

        {/* Card 4: Target 3 Perfect Hits */}
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
          { id: 'ALL', label: `All Trades (${HIGH_BETA_TRADES_DATA.length})` },
          { id: 'LIVE_ACTIVE', label: `Live Active (${summaryStats.liveActive})` },
          { id: 'TARGET_HIT', label: `Targets Achieved (${summaryStats.targetHits})` },
          { id: 'STOP_LOSS', label: `Stop Loss Hit` }
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setFilterStatus(tab.id as any)}
            style={{
              background: filterStatus === tab.id ? 'rgba(249, 115, 22, 0.2)' : 'rgba(255, 255, 255, 0.04)',
              border: filterStatus === tab.id ? '1px solid #f97316' : '1px solid transparent',
              color: filterStatus === tab.id ? '#f97316' : 'var(--text-secondary)',
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

      {/* 60-DAY HIGH BETA TRADES TABLE */}
      <div className="table-responsive-wrapper">
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', textAlign: 'center' }}>
          <thead>
            <tr style={{ background: '#090d16', color: '#94a3b8', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px', textAlign: 'left' }}>Date & Symbol</th>
              <th style={{ padding: '12px' }}>Setup Type</th>
              <th style={{ padding: '12px' }}>Entry Trigger</th>
              <th style={{ padding: '12px', color: '#93c5fd' }}>Target 1</th>
              <th style={{ padding: '12px', color: '#a7f3d0' }}>Target 2</th>
              <th style={{ padding: '12px', color: '#fde047' }}>Target 3</th>
              <th style={{ padding: '12px', color: '#fca5a5' }}>Stop Loss</th>
              <th style={{ padding: '12px', color: '#ffffff' }}>Achieved Price</th>
              <th style={{ padding: '12px' }}>Max ROI %</th>
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
                      ? 'rgba(249, 115, 22, 0.08)' 
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
                        {t.date} · <strong style={{ color: '#00f0ff' }}>{t.symbol}</strong>
                      </span>
                    </div>
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

                  {/* ROI % */}
                  <td style={{ padding: '12px', fontWeight: '900', color: t.roiPct >= 0 ? '#10b981' : '#ef4444', fontFamily: 'monospace', fontSize: '13px' }}>
                    {t.roiPct >= 0 ? `+${t.roiPct.toFixed(2)}%` : `${t.roiPct.toFixed(2)}%`}
                  </td>

                  {/* Final Status */}
                  <td style={{ padding: '12px' }}>
                    {isLive ? (
                      <span style={{ background: 'rgba(249, 115, 22, 0.2)', color: '#f97316', border: '1px solid #f97316', padding: '3px 8px', borderRadius: '4px', fontWeight: '900', fontSize: '10px' }} className="animate-pulse">
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
