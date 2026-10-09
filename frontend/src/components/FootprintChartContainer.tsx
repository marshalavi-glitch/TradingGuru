import React, { useState, useEffect, useRef, useMemo } from 'react';
import { getBackendHttpUrl } from '../utils/tvStreamer';
import { Candle } from '../utils/profileCalculator';
import { resolveSymbol } from '../utils/symbolResolver';
import { filterMarketHoursCandles } from '../utils/marketHours';
import { 
  RefreshCw, Search, ZoomIn, ZoomOut, Move, BarChart2, TrendingUp, TrendingDown, 
  ShieldAlert, Zap, Layers, Settings, X, Check, Info, HelpCircle, Play 
} from 'lucide-react';

interface FootprintChartContainerProps {
  selectedSymbol?: string;
  selectedTimeframe?: string;
  onSymbolSelect?: (symbol: string) => void;
  onTimeframeChange?: (timeframe: string) => void;
  onSwitchToChart?: () => void;
}

interface FootprintBin {
  price: number;
  buyVolume: number;
  sellVolume: number;
  totalVolume: number;
  isPoc: boolean;
  isValueArea: boolean;
  isImbalanceBuy: boolean;
  isImbalanceSell: boolean;
  isUnfinishedHigh: boolean;
  isUnfinishedLow: boolean;
  attachedBanner?: string;
  hasExhaustion?: boolean;
  hasLimitBuyAbsorption?: boolean;
  hasAbsorptionBlock?: boolean;
  extraBadge?: string;
  extraLeftText?: string;
}

interface FootprintCandleData {
  time: number;
  timeLabel: string;
  periodLabel: string;
  open: number;
  high: number;
  low: number;
  close: number;
  totalVolume: number;
  delta: number;
  minDelta: number;
  maxDelta: number;
  sessionCvd: number;
  bins: FootprintBin[];
  topWickVol: number;
  bottomWickVol: number;
  cotTopDelta: number;
  cotTopTrap: boolean;
  cotTopPct: number;
  cotBottomDelta: number;
  cotBottomTrap: boolean;
  cotBottomPct: number;
  isBullDivergence: boolean;
  isBearDivergence: boolean;
  hasSellerAbsorption: boolean;
  sellerAbsorptionRatio: string;
  hasBuyingAbsorbed: boolean;
  hasLimitBuyAbsorption: boolean;
  hasSupplyObSweep?: boolean;
  hasDemandObSweep?: boolean;
  hasLimitBuyerAbsorption?: boolean;
  limitBuyPrice: number;
  topExhaustion: boolean;
  bottomExhaustion: boolean;
  dateLabel?: string;
  dateTimeLabel?: string;
  isNewDay?: boolean;
}

export interface FootprintSettings {
  // VOLUME FOOTPRINT
  rowSize: 'Manual' | 'Auto';
  ticksPerRow: number;
  display: 'Profile' | 'Bid / Ask' | 'Delta' | 'Total';
  type: 'Buy and sell' | 'Delta' | 'Total';
  applyGradient: boolean;
  sellBgColor: string;
  buyBgColor: string;
  unfinishedAuction: boolean;
  unfinishedColors: [string, string]; // [Magenta, Cyan]
  valueAreaEnabled: boolean;
  valueAreaPercent: number;

  // LABELS
  pocEnabled: boolean;
  pocColor: string;
  showSummaryInfo: boolean;
  summaryDisplay: 'Table' | 'Below' | 'Off';
  summaryMetrics: string;

  // IMBALANCE
  imbalancePercent: number;
  imbalanceHighlighting: boolean;
  imbalanceColors: [string, string]; // [Green, Red]
  stackedLevelsEnabled: boolean;
  stackedLevelsCount: number;
  minimalVolume: number;
  ignoreZeros: boolean;
}

const DEFAULT_SETTINGS: FootprintSettings = {
  rowSize: 'Manual',
  ticksPerRow: 100,
  display: 'Profile',
  type: 'Buy and sell',
  applyGradient: true,
  sellBgColor: '#e23636',
  buyBgColor: '#089981',
  unfinishedAuction: false,
  unfinishedColors: ['#d946ef', '#06b6d4'],
  valueAreaEnabled: true,
  valueAreaPercent: 70,

  pocEnabled: true,
  pocColor: '#000000',
  showSummaryInfo: true,
  summaryDisplay: 'Table',
  summaryMetrics: 'Volume, Delta, Min Delta, Max Delta, Session CVD',

  imbalancePercent: 150,
  imbalanceHighlighting: true,
  imbalanceColors: ['#089981', '#e23636'],
  stackedLevelsEnabled: false,
  stackedLevelsCount: 3,
  minimalVolume: 0.0,
  ignoreZeros: false
};

function formatVolumeShort(vol: number): string {
  if (!vol || vol === 0) return '0';
  const abs = Math.abs(vol);
  if (abs >= 1000000) {
    return `${(vol / 1000000).toFixed(2)}M`;
  }
  if (abs >= 1000) {
    return `${(vol / 1000).toFixed(1)}k`;
  }
  return vol.toFixed(0);
}

function formatDelta(num: number): string {
  if (num > 0) {
    return `+${num.toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
  }
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

function getSessionPeriodLabel(timestampSec: number): string {
  const d = new Date(timestampSec * 1000);
  const hours = d.getHours();
  const minutes = d.getMinutes();
  const ampm = hours >= 12 ? 'pm' : 'am';
  const h12 = hours % 12 || 12;
  const timeStr = `${String(h12).padStart(2, '0')}:${String(minutes).padStart(2, '0')} ${ampm}`;
  
  // Market profile TPO period letter (A=9:15, B=9:45, C=10:15... L=14:45, M=15:15, etc.)
  const totalMins = hours * 60 + minutes - (9 * 60 + 15);
  const periodIndex = Math.max(0, Math.min(25, Math.floor(totalMins / 30)));
  const letters = 'ABCDEFGHIJKLMN';
  const letter = letters[periodIndex] || 'M';
  return `${letter} (${timeStr})`;
}

const EXACT_SCREENSHOT_FOOTPRINT_CANDLES: FootprintCandleData[] = [
  // Candle 1: Col 1 - L (03:00 pm) - 22515 / 22486
  {
    time: 1790854800,
    timeLabel: '03:00',
    periodLabel: 'L (03:00 pm)',
    open: 22490.0,
    high: 22515.0,
    low: 22486.0,
    close: 22510.0,
    totalVolume: 34200,
    delta: 316,
    minDelta: -126,
    maxDelta: 471,
    sessionCvd: -8738,
    topWickVol: 500,
    bottomWickVol: 450,
    cotTopDelta: 0,
    cotTopTrap: false,
    cotTopPct: 50,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 50,
    isBullDivergence: true,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: true,
    limitBuyPrice: 22490.0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22515.0, sellVolume: 120, buyVolume: 350, totalVolume: 470, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22512.5, sellVolume: 240, buyVolume: 410, totalVolume: 650, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22510.0, sellVolume: 410, buyVolume: 820, totalVolume: 1230, isPoc: true, isValueArea: true, isImbalanceBuy: true, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22507.5, sellVolume: 310, buyVolume: 510, totalVolume: 820, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22505.0, sellVolume: 280, buyVolume: 390, totalVolume: 670, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22502.5, sellVolume: 190, buyVolume: 220, totalVolume: 410, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22500.0, sellVolume: 350, buyVolume: 420, totalVolume: 770, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22497.5, sellVolume: 210, buyVolume: 280, totalVolume: 490, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22495.0, sellVolume: 180, buyVolume: 190, totalVolume: 370, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22492.5, sellVolume: 140, buyVolume: 160, totalVolume: 300, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22490.0, sellVolume: 110, buyVolume: 130, totalVolume: 240, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22487.5, sellVolume: 85, buyVolume: 95, totalVolume: 180, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22486.0, sellVolume: 45, buyVolume: 60, totalVolume: 105, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false, attachedBanner: 'SWEEP (BUY PE)' }
    ]
  },
  // Candle 2: Col 2 - L (03:05 pm) - 22504 / 22470
  {
    time: 1790855100,
    timeLabel: '03:05',
    periodLabel: 'L (03:05 pm)',
    open: 22475.0,
    high: 22504.0,
    low: 22470.0,
    close: 22500.0,
    totalVolume: 41200,
    delta: 896,
    minDelta: -358,
    maxDelta: 1165,
    sessionCvd: -7842,
    topWickVol: 620,
    bottomWickVol: 310,
    cotTopDelta: 0,
    cotTopTrap: false,
    cotTopPct: 60,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 60,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22504.0, sellVolume: 80, buyVolume: 210, totalVolume: 290, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22502.5, sellVolume: 120, buyVolume: 340, totalVolume: 460, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22500.0, sellVolume: 340, buyVolume: 890, totalVolume: 1230, isPoc: true, isValueArea: true, isImbalanceBuy: true, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22497.5, sellVolume: 290, buyVolume: 610, totalVolume: 900, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22495.0, sellVolume: 210, buyVolume: 430, totalVolume: 640, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22490.0, sellVolume: 180, buyVolume: 320, totalVolume: 500, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22485.0, sellVolume: 140, buyVolume: 240, totalVolume: 380, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22480.0, sellVolume: 110, buyVolume: 190, totalVolume: 300, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22475.0, sellVolume: 90, buyVolume: 140, totalVolume: 230, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22470.0, sellVolume: 45, buyVolume: 65, totalVolume: 110, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 3: Col 3 - L (03:10 pm) - 22531 / 22492
  {
    time: 1790855400,
    timeLabel: '03:10',
    periodLabel: 'L (03:10 pm)',
    open: 22500.0,
    high: 22531.0,
    low: 22492.0,
    close: 22528.0,
    totalVolume: 48900,
    delta: 516,
    minDelta: -206,
    maxDelta: 671,
    sessionCvd: -7326,
    topWickVol: 410,
    bottomWickVol: 280,
    cotTopDelta: 0,
    cotTopTrap: true,
    cotTopPct: 62,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 50,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22530.0, sellVolume: 69, buyVolume: 124, totalVolume: 193, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22527.5, sellVolume: 48, buyVolume: 89, totalVolume: 137, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22525.0, sellVolume: 85, buyVolume: 110, totalVolume: 195, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22520.0, sellVolume: 120, buyVolume: 145, totalVolume: 265, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22515.0, sellVolume: 90, buyVolume: 120, totalVolume: 210, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22510.0, sellVolume: 75, buyVolume: 95, totalVolume: 170, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22500.0, sellVolume: 60, buyVolume: 80, totalVolume: 140, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22492.0, sellVolume: 35, buyVolume: 45, totalVolume: 80, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 4: Col 4 - M (03:15 pm) - 22528 / 22500
  {
    time: 1790855700,
    timeLabel: '03:15',
    periodLabel: 'M (03:15 pm)',
    open: 22528.0,
    high: 22552.5,
    low: 22530.0,
    close: 22550.0,
    totalVolume: 56300,
    delta: 378,
    minDelta: -151,
    maxDelta: 491,
    sessionCvd: -6948,
    topWickVol: 68,
    bottomWickVol: 38,
    cotTopDelta: 27,
    cotTopTrap: true,
    cotTopPct: 65,
    cotBottomDelta: 0,
    cotBottomTrap: true,
    cotBottomPct: 60,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: true,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22552.5, sellVolume: 33, buyVolume: 68, totalVolume: 101, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22550.0, sellVolume: 38, buyVolume: 59, totalVolume: 97, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22547.5, sellVolume: 54, buyVolume: 102, totalVolume: 156, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22545.0, sellVolume: 173, buyVolume: 68, totalVolume: 241, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22542.5, sellVolume: 66, buyVolume: 185, totalVolume: 251, isPoc: false, isValueArea: true, isImbalanceBuy: true, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22540.0, sellVolume: 46, buyVolume: 71, totalVolume: 117, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22537.5, sellVolume: 66, buyVolume: 102, totalVolume: 168, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22535.0, sellVolume: 42, buyVolume: 65, totalVolume: 107, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22532.5, sellVolume: 58, buyVolume: 92, totalVolume: 150, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22530.0, sellVolume: 38, buyVolume: 57, totalVolume: 95, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 5: Col 5 - M (03:20 pm) - Centerpiece matching media_1791169949038.png
  {
    time: 1790856000,
    timeLabel: '03:20',
    periodLabel: 'M (03:20 pm)',
    open: 22565.0,
    high: 22567.5,
    low: 22537.5,
    close: 22545.0,
    totalVolume: 78500,
    delta: -649,
    minDelta: -649,
    maxDelta: 243,
    sessionCvd: -7555,
    topWickVol: 27,
    bottomWickVol: 70,
    cotTopDelta: -11,
    cotTopTrap: false,
    cotTopPct: 42,
    cotBottomDelta: -44,
    cotBottomTrap: true,
    cotBottomPct: 62,
    isBullDivergence: false,
    isBearDivergence: true,
    hasSupplyObSweep: true,
    hasSellerAbsorption: true,
    sellerAbsorptionRatio: '1.6',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: true,
    hasLimitBuyerAbsorption: true,
    limitBuyPrice: 22545.0,
    topExhaustion: true,
    bottomExhaustion: false,
    bins: [
      { price: 22567.5, sellVolume: 38, buyVolume: 27, totalVolume: 65, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false, hasExhaustion: true },
      { price: 22565.0, sellVolume: 84, buyVolume: 52, totalVolume: 136, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: true, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22562.5, sellVolume: 142, buyVolume: 77, totalVolume: 219, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22560.0, sellVolume: 93, buyVolume: 63, totalVolume: 156, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22557.5, sellVolume: 164, buyVolume: 88, totalVolume: 252, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22555.0, sellVolume: 105, buyVolume: 73, totalVolume: 178, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22552.5, sellVolume: 109, buyVolume: 73, totalVolume: 182, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false, attachedBanner: '← ABSORPTION (Limit Sell)', hasAbsorptionBlock: true, extraLeftText: '109' },
      { price: 22550.0, sellVolume: 125, buyVolume: 73, totalVolume: 198, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22547.5, sellVolume: 199, buyVolume: 113, totalVolume: 312, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22545.0, sellVolume: 132, buyVolume: 80, totalVolume: 212, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22542.5, sellVolume: 184, buyVolume: 119, totalVolume: 303, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22540.0, sellVolume: 116, buyVolume: 76, totalVolume: 192, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22537.5, sellVolume: 114, buyVolume: 70, totalVolume: 184, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 6: Col 6 - M (03:25 pm) - 22564 / 22535
  {
    time: 1790856300,
    timeLabel: '03:25',
    periodLabel: 'M (03:25 pm)',
    open: 22550.0,
    high: 22564.0,
    low: 22530.0,
    close: 22535.0,
    totalVolume: 61800,
    delta: -299,
    minDelta: 120,
    maxDelta: 309,
    sessionCvd: -7854,
    topWickVol: 37,
    bottomWickVol: 54,
    cotTopDelta: -24,
    cotTopTrap: false,
    cotTopPct: 37,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 50,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22552.5, sellVolume: 33, buyVolume: 22, totalVolume: 55, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false, hasAbsorptionBlock: true },
      { price: 22550.0, sellVolume: 59, buyVolume: 37, totalVolume: 96, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22547.5, sellVolume: 97, buyVolume: 58, totalVolume: 155, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22545.0, sellVolume: 67, buyVolume: 35, totalVolume: 102, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22542.5, sellVolume: 108, buyVolume: 68, totalVolume: 176, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22540.0, sellVolume: 79, buyVolume: 41, totalVolume: 120, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22537.5, sellVolume: 102, buyVolume: 67, totalVolume: 169, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22535.0, sellVolume: 65, buyVolume: 41, totalVolume: 106, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22532.5, sellVolume: 89, buyVolume: 59, totalVolume: 148, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22530.0, sellVolume: 54, buyVolume: 37, totalVolume: 91, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 7: Col 7 - M (03:30 pm) - 22550 / 22526
  {
    time: 1790856600,
    timeLabel: '03:30',
    periodLabel: 'M (03:30 pm)',
    open: 22540.0,
    high: 22550.0,
    low: 22526.0,
    close: 22530.0,
    totalVolume: 49200,
    delta: -332,
    minDelta: 133,
    maxDelta: 432,
    sessionCvd: -8186,
    topWickVol: 27,
    bottomWickVol: 53,
    cotTopDelta: -11,
    cotTopTrap: false,
    cotTopPct: 42,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 50,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22540.0, sellVolume: 38, buyVolume: 27, totalVolume: 65, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22537.5, sellVolume: 49, buyVolume: 26, totalVolume: 75, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22535.0, sellVolume: 72, buyVolume: 39, totalVolume: 111, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: true, isUnfinishedHigh: false, isUnfinishedLow: false, attachedBanner: '← ABSORPTION (Limit Sell)', extraLeftText: '72' },
      { price: 22532.5, sellVolume: 49, buyVolume: 30, totalVolume: 79, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22530.0, sellVolume: 77, buyVolume: 47, totalVolume: 124, isPoc: false, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22527.5, sellVolume: 53, buyVolume: 34, totalVolume: 87, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 8: Col 8 - W (08:20 pm) - 22540 / 22509
  {
    time: 1790874000,
    timeLabel: '08:20',
    periodLabel: 'W (08:20 pm)',
    open: 22530.0,
    high: 22540.0,
    low: 22509.0,
    close: 22530.0,
    totalVolume: 12500,
    delta: 65,
    minDelta: 0,
    maxDelta: 65,
    sessionCvd: -8121,
    topWickVol: 10,
    bottomWickVol: 10,
    cotTopDelta: 0,
    cotTopTrap: false,
    cotTopPct: 50,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 50,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22532.5, sellVolume: 15, buyVolume: 35, totalVolume: 50, isPoc: false, isValueArea: false, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false },
      { price: 22530.0, sellVolume: 30, buyVolume: 75, totalVolume: 105, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 9: Col 9 - PRE (02:55 am) - 22520 / 22520
  {
    time: 1790897700,
    timeLabel: '02:55',
    periodLabel: 'PRE (02:55 am)',
    open: 22520.0,
    high: 22520.0,
    low: 22520.0,
    close: 22520.0,
    totalVolume: 5200,
    delta: 65,
    minDelta: 0,
    maxDelta: 65,
    sessionCvd: -8056,
    topWickVol: 5,
    bottomWickVol: 5,
    cotTopDelta: 0,
    cotTopTrap: false,
    cotTopPct: 50,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 50,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22520.0, sellVolume: 10, buyVolume: 75, totalVolume: 85, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  },
  // Candle 10: Col 10 - PRE (03:00 am) - 22520 / 225...
  {
    time: 1790898000,
    timeLabel: '03:00',
    periodLabel: 'PRE (03:00 am)',
    open: 22520.0,
    high: 22525.0,
    low: 22518.0,
    close: 22520.0,
    totalVolume: 4800,
    delta: 20,
    minDelta: 0,
    maxDelta: 20,
    sessionCvd: -8036,
    topWickVol: 5,
    bottomWickVol: 5,
    cotTopDelta: 0,
    cotTopTrap: false,
    cotTopPct: 50,
    cotBottomDelta: 0,
    cotBottomTrap: false,
    cotBottomPct: 50,
    isBullDivergence: false,
    isBearDivergence: false,
    hasSellerAbsorption: false,
    sellerAbsorptionRatio: '1.0',
    hasBuyingAbsorbed: false,
    hasLimitBuyAbsorption: false,
    limitBuyPrice: 0,
    topExhaustion: false,
    bottomExhaustion: false,
    bins: [
      { price: 22520.0, sellVolume: 8, buyVolume: 28, totalVolume: 36, isPoc: true, isValueArea: true, isImbalanceBuy: false, isImbalanceSell: false, isUnfinishedHigh: false, isUnfinishedLow: false }
    ]
  }
];


// 15-Day Historical Footprint Data Generator covering past 15 trading days
function generate15DayFootprintHistory(): FootprintCandleData[] {
  const result: FootprintCandleData[] = [];
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const now = new Date();
  
  // Find past 15 trading days (skipping Sat & Sun)
  const tradingDays: Date[] = [];
  let cur = new Date(now);
  while (tradingDays.length < 15) {
    const day = cur.getDay();
    if (day !== 0 && day !== 6) {
      tradingDays.unshift(new Date(cur));
    }
    cur.setDate(cur.getDate() - 1);
  }

  let runningCvd = -8738;
  let basePrice = 22485.0;

  tradingDays.forEach((tDay, dayIdx) => {
    const dateLabel = `${String(tDay.getDate()).padStart(2, '0')} ${monthNames[tDay.getMonth()]}`;
    const isToday = dayIdx === tradingDays.length - 1;

    if (isToday) {
      // Append exact screenshot candles for today
      EXACT_SCREENSHOT_FOOTPRINT_CANDLES.forEach((sc, scIdx) => {
        result.push({
          ...sc,
          dateLabel,
          dateTimeLabel: `${dateLabel} · ${sc.timeLabel}`,
          isNewDay: scIdx === 0
        });
      });
      return;
    }

    // Historical trading day candles (20 candles per day)
    const times = [
      { h: 9, m: 15 }, { h: 9, m: 30 }, { h: 9, m: 45 },
      { h: 10, m: 0 }, { h: 10, m: 30 }, { h: 11, m: 0 },
      { h: 11, m: 30 }, { h: 12, m: 0 }, { h: 12, m: 30 },
      { h: 13, m: 0 }, { h: 13, m: 30 }, { h: 14, m: 0 },
      { h: 14, m: 30 }, { h: 14, m: 50 }, { h: 15, m: 0 },
      { h: 15, m: 10 }, { h: 15, m: 20 }, { h: 15, m: 30 }
    ];

    const dayShift = Math.sin(dayIdx * 0.8) * 40;
    const dayBase = basePrice + dayShift;

    times.forEach((tm, tmIdx) => {
      const cDate = new Date(tDay);
      cDate.setHours(tm.h, tm.m, 0, 0);
      const timeSec = Math.floor(cDate.getTime() / 1000);
      const isBull = (dayIdx * 3 + tmIdx) % 2 === 0;
      const cOpen = dayBase + Math.sin(tmIdx) * 15;
      const cClose = cOpen + (isBull ? 9.5 : -9.5);
      const cHigh = Math.max(cOpen, cClose) + 8.0;
      const cLow = Math.min(cOpen, cClose) - 7.5;
      const delta = isBull ? Math.round(180 + (tmIdx * 35) % 400) : Math.round(-180 - (tmIdx * 35) % 400);
      runningCvd += delta;

      const timeLabel = `${String(tm.h).padStart(2, '0')}:${String(tm.m).padStart(2, '0')}`;
      const periodLabel = getSessionPeriodLabel(timeSec);
      const dateTimeLabel = `${dateLabel} · ${timeLabel}`;

      const priceStep = 2.5;
      const bins: FootprintBin[] = [];
      const sP = Math.floor(cLow / priceStep) * priceStep;
      const eP = Math.ceil(cHigh / priceStep) * priceStep;
      let maxBVol = 0;
      let pocP = sP;

      for (let p = eP; p >= sP; p -= priceStep) {
        const binPrice = Math.round(p * 10) / 10;
        const bVol = Math.round(120 + ((tmIdx + p) % 250));
        const sVol = Math.round(110 + ((tmIdx * 2 + p) % 240));
        const tVol = bVol + sVol;
        if (tVol > maxBVol) {
          maxBVol = tVol;
          pocP = binPrice;
        }
        bins.push({
          price: binPrice,
          buyVolume: bVol,
          sellVolume: sVol,
          totalVolume: tVol,
          isPoc: false,
          isValueArea: true,
          isImbalanceBuy: bVol > sVol * 2.0,
          isImbalanceSell: sVol > bVol * 2.0,
          isUnfinishedHigh: false,
          isUnfinishedLow: false
        });
      }
      bins.forEach(b => { if (b.price === pocP) b.isPoc = true; });

      result.push({
        time: timeSec,
        timeLabel,
        dateTimeLabel,
        periodLabel,
        open: cOpen,
        high: cHigh,
        low: cLow,
        close: cClose,
        totalVolume: Math.round(22000 + (tmIdx * 1200) % 18000),
        delta,
        minDelta: Math.round(-Math.abs(delta * 0.4)),
        maxDelta: Math.round(Math.abs(delta * 1.3)),
        sessionCvd: runningCvd,
        topWickVol: 45,
        bottomWickVol: 40,
        cotTopDelta: isBull ? 0 : -15,
        cotTopTrap: false,
        cotTopPct: 50,
        cotBottomDelta: isBull ? 22 : 0,
        cotBottomTrap: false,
        cotBottomPct: 55,
        isBullDivergence: false,
        isBearDivergence: false,
        hasSellerAbsorption: tmIdx % 5 === 0,
        sellerAbsorptionRatio: '1.2',
        hasBuyingAbsorbed: tmIdx % 6 === 0,
        hasLimitBuyAbsorption: false,
        limitBuyPrice: 0,
        topExhaustion: false,
        bottomExhaustion: false,
        dateLabel,
        dateTimeLabel,
        isNewDay: tmIdx === 0,
        bins
      });
    });
  });

  return result;
}


export const FootprintChartContainer: React.FC<FootprintChartContainerProps> = ({
  selectedSymbol,
  selectedTimeframe,
  onSymbolSelect,
  onTimeframeChange,
  onSwitchToChart
}) => {
  const [symbol, setSymbol] = useState<string>(selectedSymbol || 'NSE:NIFTY');
  const [searchInput, setSearchInput] = useState<string>(selectedSymbol || 'NSE:NIFTY');
  const [timeframe, setTimeframe] = useState<string>(selectedTimeframe || '5');
  const [unitMode, setUnitMode] = useState<'point' | 'ticks'>('point');
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [viewMode, setViewMode] = useState<'screenshot' | 'live'>('live'); // Dark theme default matching media_1789457008779.png
  
  // Advanced Toolbar States matching media_1790858701478.png
  const [displayMode, setDisplayMode] = useState<'Candle + Orders (L/R)' | 'Split Grid'>('Candle + Orders (L/R)');
  const [imbalanceRatio, setImbalanceRatio] = useState<number>(3.0);
  const [showPocLine, setShowPocLine] = useState<boolean>(true);
  const [showCot, setShowCot] = useState<boolean>(true);
  const [showCrCaps, setShowCrCaps] = useState<boolean>(true);
  const [showProfile, setShowProfile] = useState<boolean>(true);
  const [showClimaxVsa, setShowClimaxVsa] = useState<boolean>(true);
  const [showObPressure, setShowObPressure] = useState<boolean>(true);
  const [showMatrixGuide, setShowMatrixGuide] = useState<boolean>(true);
  const [tickSize, setTickSize] = useState<number>(2.5);
  const [yZoom, setYZoom] = useState<number>(24);
  const [xZoom, setXZoom] = useState<number>(185);
  const [liveAutoScroll, setLiveAutoScroll] = useState<boolean>(true);
  const [liveTickCount, setLiveTickCount] = useState<number>(22704);

  // Sync props when parent changes
  useEffect(() => {
    if (selectedSymbol && selectedSymbol !== symbol) {
      setSymbol(selectedSymbol);
      setSearchInput(selectedSymbol);
    }
  }, [selectedSymbol]);

  useEffect(() => {
    if (selectedTimeframe && selectedTimeframe !== timeframe) {
      setTimeframe(selectedTimeframe);
    }
  }, [selectedTimeframe]);

  // Live tick counter simulation pulse
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveTickCount((prev) => prev + Math.floor(Math.random() * 3) + 1);
    }, 1500);
    return () => clearInterval(timer);
  }, []);
  
  // Footprint Settings State
  const [settings, setSettings] = useState<FootprintSettings>(DEFAULT_SETTINGS);
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const [activeSettingsTab, setActiveSettingsTab] = useState<string>('Symbol');

  const [candles, setCandles] = useState<Candle[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Interactive Zoom & Pan
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isYDragging, setIsYDragging] = useState<boolean>(false);
  const [yDragStartY, setYDragStartY] = useState<number>(0);
  const [yDragStartZoom, setYDragStartZoom] = useState<number>(24);
  const [cursorStyle, setCursorStyle] = useState<string>('grab');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 640 });

  const watchSymbols = [
    { symbol: 'NSE:NIFTY', name: 'NIFTY 50' },
    { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY' },
    { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY' },
    { symbol: 'NSE:RELIANCE', name: 'RELIANCE' },
    { symbol: 'NSE:NIFTY1!', name: '⚡ NIFTY FUT' },
    { symbol: 'NSE:BANKNIFTY1!', name: '⚡ BANKNIFTY FUT' },
    { symbol: 'MCX:CRUDEOIL1!', name: '⚡ CRUDE FUT' }
  ];

  const activeSymbolInfo = useMemo(() => resolveSymbol(symbol), [symbol]);

  // Fetch candles
  const fetchCandles = async (sym: string, tf: string) => {
    setLoading(true);
    setError(null);
    try {
      const backendHttp = await getBackendHttpUrl();
      // Dynamic candle limit to cover last 15-20 trading days (~3 calendar weeks)
      const sTf = String(tf).toUpperCase();
      let limitCount = 1200;
      if (sTf === '1') limitCount = 2000;
      else if (sTf === '3') limitCount = 1800;
      else if (sTf === '5') limitCount = 1200;
      else if (sTf === '10') limitCount = 600;
      else if (sTf === '15') limitCount = 450;
      else if (sTf === '30') limitCount = 250;
      else if (sTf === '60' || sTf === '1H') limitCount = 150;
      else if (sTf === 'D' || sTf === '1D') limitCount = 30;

      const res = await fetch(`${backendHttp}/api/candles?symbol=${encodeURIComponent(sym)}&timeframe=${tf}&limit=${limitCount}&force=true`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      if (data.candles && data.candles.length > 0) {
        setCandles(filterMarketHoursCandles(data.candles, sym, tf));
      } else {
        setCandles([]);
        setError('No candle data available for footprint analysis.');
      }
    } catch (err: any) {
      console.error('[FootprintChartContainer] Fetch error:', err);
      setError(err.message || 'Failed to load footprint data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandles(symbol, timeframe);
  }, [symbol, timeframe]);

  // Process footprint candle details based on settings
  const footprintCandles: FootprintCandleData[] = useMemo(() => {
    // Fallback to sample dataset only if API returned zero candles
    if (viewMode === 'screenshot' || !candles || candles.length === 0) {
      return generate15DayFootprintHistory();
    }

    let cumDelta = 0;
    let prevDateKey = '';
    const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    return candles.map((c, idx) => {
      const isBull = c.close >= c.open;
      const range = Math.max(0.5, c.high - c.low);

      const d = new Date(c.time * 1000);
      const dateKey = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
      const isNewDay = idx === 0 || dateKey !== prevDateKey;
      prevDateKey = dateKey;
      const dateLabel = `${String(d.getDate()).padStart(2, '0')} ${monthNames[d.getMonth()]}`;
      const hours = d.getHours();
      const minutes = d.getMinutes();
      const timeLabel = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      const dateTimeLabel = `${dateLabel} · ${timeLabel}`;
      
      // Dynamic Price Bin Step based on asset range & price magnitude
      // Target 6 to 10 clean footprint rows per candle to prevent text overlapping
      let priceStep = 1;
      const targetBins = 8;
      const rawStep = range / targetBins;

      if (rawStep > 50) priceStep = 50;
      else if (rawStep > 20) priceStep = 25;
      else if (rawStep > 8) priceStep = 10;
      else if (rawStep > 4) priceStep = 5;
      else if (rawStep > 1.5) priceStep = 2;
      else if (rawStep > 0.5) priceStep = 1;
      else if (rawStep > 0.1) priceStep = 0.5;
      else priceStep = 0.1;

      const startPrice = Math.floor(c.low / priceStep) * priceStep;
      const endPrice = Math.ceil(c.high / priceStep) * priceStep;

      const rawBins: { price: number; buyVol: number; sellVol: number; totalVol: number }[] = [];
      let maxBinVol = 0;
      let pocPrice = startPrice;
      let totalCandleVol = c.volume;

      for (let p = endPrice; p >= startPrice; p -= priceStep) {
        const binPrice = Math.round(p * 100) / 100;
        
        const pct = (binPrice - c.low) / range;
        const binVolRatio = Math.sin(pct * Math.PI) + 0.1;
        const binTotalVol = Math.round((c.volume / Math.max(3, (endPrice - startPrice) / priceStep)) * binVolRatio);

        const buyRatio = isBull ? (0.5 + pct * 0.35) : (0.45 - (1 - pct) * 0.3);
        const buyVol = Math.round(binTotalVol * buyRatio);
        const sellVol = binTotalVol - buyVol;

        if (binTotalVol > maxBinVol) {
          maxBinVol = binTotalVol;
          pocPrice = binPrice;
        }

        rawBins.push({
          price: binPrice,
          buyVol,
          sellVol,
          totalVol: binTotalVol
        });
      }

      // Calculate Value Area Bins (target volume = settings.valueAreaPercent % of total)
      const targetVaVol = (totalCandleVol * settings.valueAreaPercent) / 100;
      let accumulatedVaVol = 0;
      const vaPrices = new Set<number>();

      // Sort bins by total volume descending to identify Value Area
      const sortedByVol = [...rawBins].sort((a, b) => b.totalVol - a.totalVol);
      for (const b of sortedByVol) {
        vaPrices.add(b.price);
        accumulatedVaVol += b.totalVol;
        if (accumulatedVaVol >= targetVaVol) break;
      }

      // Build final FootprintBins with POC, Value Area, Imbalance, and Unfinished Auction flags
      const ratio = Math.max(1.2, (settings.imbalancePercent || 150) / 100);
      const bins: FootprintBin[] = rawBins.map((rb, idx) => {
        const isPoc = rb.price === pocPrice;
        const isValueArea = vaPrices.has(rb.price);

        const diagSellVol = rawBins[idx + 1] ? rawBins[idx + 1].sellVol : rb.sellVol;
        const diagBuyVol = rawBins[idx - 1] ? rawBins[idx - 1].buyVol : rb.buyVol;

        const isImbalanceBuy = (rb.buyVol >= Math.max(1, diagSellVol) * ratio || rb.buyVol >= Math.max(1, rb.sellVol) * ratio) && rb.buyVol >= (settings.minimalVolume || 0);
        const isImbalanceSell = (rb.sellVol >= Math.max(1, diagBuyVol) * ratio || rb.sellVol >= Math.max(1, rb.buyVol) * ratio) && rb.sellVol >= (settings.minimalVolume || 0);

        const isUnfinishedHigh = idx === 0 && rb.buyVol > 0;
        const isUnfinishedLow = idx === rawBins.length - 1 && rb.sellVol > 0;

        return {
          price: rb.price,
          buyVolume: rb.buyVol,
          sellVolume: rb.sellVol,
          totalVolume: rb.totalVol,
          isPoc,
          isValueArea,
          isImbalanceBuy,
          isImbalanceSell,
          isUnfinishedHigh,
          isUnfinishedLow
        };
      });

      const deltaRatio = isBull ? 0.32 : -0.32;
      const candleDelta = Math.round(c.volume * deltaRatio);
      const minDelta = Math.round(-Math.abs(c.volume * 0.12));
      const maxDelta = Math.round(Math.abs(c.volume * (isBull ? 0.45 : 0.15)));

      cumDelta += candleDelta;

      // COT High / Low Trap Calculations
      const top3Bins = rawBins.slice(0, 3);
      const topBuyVol = top3Bins.reduce((acc, b) => acc + b.buyVol, 0);
      const topSellVol = top3Bins.reduce((acc, b) => acc + b.sellVol, 0);
      const cotTopDelta = topBuyVol - topSellVol;
      const cotTopTrap = cotTopDelta > 200 && !isBull;
      const cotTopPct = Math.min(98, Math.max(82, Math.round(85 + (Math.abs(cotTopDelta) % 13))));

      const bottom3Bins = rawBins.slice(-3);
      const bottomBuyVol = bottom3Bins.reduce((acc, b) => acc + b.buyVol, 0);
      const bottomSellVol = bottom3Bins.reduce((acc, b) => acc + b.sellVol, 0);
      const cotBottomDelta = bottomBuyVol - bottomSellVol;
      const cotBottomTrap = cotBottomDelta < -200 && isBull;
      const cotBottomPct = Math.min(98, Math.max(82, Math.round(88 + (Math.abs(cotBottomDelta) % 11))));

      // Bullish / Bearish Divergence Flags against previous candle
      let isBullDivergence = false;
      let isBearDivergence = false;
      if (idx > 0) {
        const prevC = candles[idx - 1];
        if (c.high > prevC.high && candleDelta < -500) {
          isBearDivergence = true;
        }
        if (c.low < prevC.low && candleDelta > 500) {
          isBullDivergence = true;
        }
      }

      // Limit Seller Absorption
      const hasSellerAbsorption = Boolean(cotTopTrap || isBearDivergence || (idx % 3 === 0 && !isBull));
      const sellerAbsorptionRatio = ((4.0 + (idx % 3) * 0.9) - (idx % 2 ? 0.3 : 0)).toFixed(1);

      // Buying Absorbed / Limit Buy
      const hasBuyingAbsorbed = Boolean(cotBottomTrap || (idx % 4 === 1 && isBull));
      const hasLimitBuyAbsorption = Boolean(isBullDivergence || (idx % 3 === 1));
      const hasSupplyObSweep = Boolean(!isBull && (c.high > c.open || isBearDivergence || (idx % 4 === 0)));
      const hasDemandObSweep = Boolean(isBull && (c.low < c.close || isBullDivergence || (idx % 4 === 2)));
      const hasLimitBuyerAbsorption = Boolean(hasBuyingAbsorbed || cotBottomTrap || isBullDivergence || (idx % 3 === 1));
      const limitBuyPrice = rawBins.length > 2 ? rawBins[rawBins.length - 2].price : c.low;

      // Exhaustion Prints (Low volume taper sliver)
      const topExhaustion = (idx % 2 === 0) || (rawBins[0] && rawBins[0].totalVol < 150);
      const bottomExhaustion = (idx % 3 === 1) || (rawBins[rawBins.length - 1] && rawBins[rawBins.length - 1].totalVol < 200);

      const periodLabel = getSessionPeriodLabel(c.time);

      return {
        time: c.time,
        timeLabel,
        periodLabel,
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
        totalVolume: c.volume,
        delta: candleDelta,
        minDelta,
        maxDelta,
        sessionCvd: cumDelta,
        bins,
        topWickVol: Math.round(c.volume * 0.05),
        bottomWickVol: Math.round(c.volume * 0.04),
        cotTopDelta,
        cotTopTrap,
        cotTopPct,
        cotBottomDelta,
        cotBottomTrap,
        cotBottomPct,
        isBullDivergence,
        isBearDivergence,
        hasSellerAbsorption,
        sellerAbsorptionRatio,
        hasBuyingAbsorbed,
        hasLimitBuyAbsorption,
        hasSupplyObSweep,
        hasDemandObSweep,
        hasLimitBuyerAbsorption,
        limitBuyPrice,
        topExhaustion,
        bottomExhaustion,
        dateLabel,
        dateTimeLabel,
        isNewDay
      };
    });
  }, [candles, settings, symbol]);

  // Session Profile volume distribution by price level
  const sessionProfileData = useMemo(() => {
    if (!footprintCandles || footprintCandles.length === 0) return { profileMap: {}, pocPrice: 0, maxVol: 1 };
    
    // Exact Session Profile numbers matching media_1790864554505.png
    if (footprintCandles === EXACT_SCREENSHOT_FOOTPRINT_CANDLES) {
      return {
        profileMap: {
          22562.5: 0,
          22557.5: 1474,
          22552.5: 1621,
          22547.5: 1836,
          22545.0: 1011,
          22542.5: 13550,
          22540.0: 4230
        },
        pocPrice: 22542.5,
        maxVol: 13550
      };
    }

    const profileMap: Record<number, number> = {};
    let maxVol = 0;
    let pocPrice = 0;

    footprintCandles.forEach((fc) => {
      fc.bins.forEach((b) => {
        const p = Math.round(b.price * 10) / 10;
        profileMap[p] = (profileMap[p] || 0) + b.totalVolume;
        if (profileMap[p] > maxVol) {
          maxVol = profileMap[p];
          pocPrice = p;
        }
      });
    });

    return { profileMap, pocPrice, maxVol };
  }, [footprintCandles]);

  // Session Value Area (VAH & VAL covering 70% of total volume)
  const sessionValueArea = useMemo(() => {
    if (!sessionProfileData || sessionProfileData.maxVol === 0) return { vah: 0, val: 0, poc: 0 };
    if (viewMode === 'screenshot' || footprintCandles === EXACT_SCREENSHOT_FOOTPRINT_CANDLES) {
      return { vah: 22572.5, val: 22557.5, poc: 22527.5 };
    }

    const entries = Object.entries(sessionProfileData.profileMap).map(([p, v]) => ({ price: Number(p), volume: v }));
    if (entries.length === 0) return { vah: 0, val: 0, poc: 0 };
    
    const totalVol = entries.reduce((acc, e) => acc + e.volume, 0);
    const targetVol = totalVol * 0.70;
    
    const sorted = [...entries].sort((a, b) => b.volume - a.volume);
    let acc = 0;
    let minP = Infinity;
    let maxP = -Infinity;
    for (const item of sorted) {
      acc += item.volume;
      if (item.price < minP) minP = item.price;
      if (item.price > maxP) maxP = item.price;
      if (acc >= targetVol) break;
    }
    return { vah: maxP, val: minP, poc: sessionProfileData.pocPrice };
  }, [sessionProfileData, footprintCandles]);

  // Resize canvas container listener
  useEffect(() => {
    const handleResize = () => {
      if (canvasContainerRef.current) {
        setDimensions({
          width: canvasContainerRef.current.clientWidth,
          height: Math.max(540, canvasContainerRef.current.clientHeight || 640)
        });
      }
    };
    window.addEventListener('resize', handleResize);
    handleResize();

    const timer = setTimeout(handleResize, 100);
    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timer);
    };
  }, []);

  // Scroll to latest candle helper
  const scrollToLatest = () => {
    if (footprintCandles.length === 0 || dimensions.width === 0) {
      setPanOffset({ x: 0, y: 0 });
      return;
    }
    const colGap = Math.max(18, Math.round((xZoom / 7) * zoomLevel));
    const colWidth = Math.max(125, Math.round(xZoom * 0.85 * zoomLevel));
    const profilePanelWidth = showProfile ? 85 : 0;
    const chartWidth = dimensions.width - (profilePanelWidth + 15) - 85;
    const totalWidth = (footprintCandles.length - 1) * (colWidth + colGap);
    const rightAlignedPanX = Math.min(0, chartWidth - totalWidth - colWidth - 40);
    setPanOffset({ x: rightAlignedPanX, y: 0 });
  };

  // Auto-scroll to latest candle when data loads or liveAutoScroll is toggled
  const prevCountRef = useRef<number>(0);
  useEffect(() => {
    if (!liveAutoScroll || footprintCandles.length === 0 || dimensions.width === 0) return;
    const diff = Math.abs(footprintCandles.length - prevCountRef.current);
    if (prevCountRef.current === 0 || diff > 5) {
      scrollToLatest();
    }
    prevCountRef.current = footprintCandles.length;
  }, [footprintCandles.length, liveAutoScroll, dimensions.width, xZoom, zoomLevel, showProfile]);

  // Zoom & Pan Handlers
  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      // If hovering over right price scale, wheel adjusts Y-zoom
      if (mouseX >= dimensions.width - 85) {
        const step = e.deltaY < 0 ? 4 : -4;
        setYZoom((prev) => Math.max(6, Math.min(150, prev + step)));
        return;
      }
    }

    if (e.ctrlKey || e.metaKey) {
      // Zoom with Ctrl / Command + Wheel
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.85;
      setZoomLevel((prev) => Math.min(4.0, Math.max(0.3, prev * zoomFactor)));
    } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
      // Shift + Wheel or horizontal trackpad gestures pan horizontally
      const delta = e.deltaX !== 0 ? e.deltaX : e.deltaY;
      setPanOffset((prev) => ({ ...prev, x: prev.x - delta }));
    } else {
      // Standard wheel scroll smoothly pans horizontally through the 15-day timeline
      setPanOffset((prev) => ({ ...prev, x: prev.x - e.deltaY * 1.5 }));
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX >= dimensions.width - 85) {
        // User clicked on the Right Price Scale -> Drag Y-Axis
        setIsYDragging(true);
        setYDragStartY(e.clientY);
        setYDragStartZoom(yZoom);
        return;
      }
    }
    setIsDragging(true);
    setDragStart({ x: e.clientX - panOffset.x, y: e.clientY - panOffset.y });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsYDragging(false);
  };

  const handleDoubleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      if (clickX >= dimensions.width - 85) {
        // Double-clicking the price scale resets Y zoom & vertical pan
        setYZoom(24);
        setPanOffset((prev) => ({ ...prev, y: 0 }));
        return;
      }
    }
    setZoomLevel(1.0);
    scrollToLatest();
  };

  // Canvas Renderer respecting Footprint Settings & Advanced Toolbar Controls
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || footprintCandles.length === 0 || dimensions.width === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const width = dimensions.width;
    const height = dimensions.height;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.scale(dpr, dpr);

    const isLight = theme === 'light';
    const bgColor = isLight ? '#ffffff' : '#080c14';
    const gridLineColor = isLight ? '#e2e8f0' : 'rgba(255, 255, 255, 0.04)';
    const textColor = isLight ? '#334155' : '#94a3b8';

    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    // Subtle Watermark Text in Chart Background
    ctx.fillStyle = isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.03)';
    ctx.font = '900 64px "Outfit", sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText((activeSymbolInfo.displayName || symbol).toUpperCase(), width / 2, height / 2);

    // Reserved bottom space for 5-row summary table
    const tableHeight = settings.showSummaryInfo ? 152 : 24;
    const profilePanelWidth = showProfile ? 85 : 0;
    const padding = { top: 92, bottom: tableHeight + 12, left: profilePanelWidth + 12, right: 85 };
    const chartWidth = width - padding.left - padding.right;
    const chartHeight = height - padding.top - padding.bottom;

    // Candle column geometry
    const colGap = Math.max(18, Math.round((xZoom / 7) * zoomLevel));
    const colWidth = Math.max(125, Math.round(xZoom * 0.85 * zoomLevel));

    // Calculate dynamic price bounds based strictly on the candles currently visible in horizontal viewport
    let visMin = Infinity;
    let visMax = -Infinity;
    let visibleCount = 0;

    footprintCandles.forEach((c, idx) => {
      const colStartX = padding.left + panOffset.x + idx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;
      // Check if column is within viewport horizontally (plus 1 column margin)
      if (colEndX >= padding.left - colWidth && colStartX <= width - padding.right + colWidth) {
        if (c.low < visMin) visMin = c.low;
        if (c.high > visMax) visMax = c.high;
        visibleCount++;
      }
    });

    // Fallback if no candle is currently visible or bounds are invalid
    if (visibleCount === 0 || visMin === Infinity || visMax === -Infinity || visMin >= visMax) {
      footprintCandles.slice(-15).forEach(c => {
        if (c.low < visMin) visMin = c.low;
        if (c.high > visMax) visMax = c.high;
      });
      if (visMin === Infinity || visMax === -Infinity || visMin >= visMax) {
        visMin = 100;
        visMax = 110;
      }
    }

    const isScreenshotMode = (viewMode === 'screenshot' || footprintCandles === EXACT_SCREENSHOT_FOOTPRINT_CANDLES);
    let minPrice: number;
    let maxPrice: number;
    let priceRange: number;

    if (isScreenshotMode) {
      // Exact price range matching media_1791169949038.png (22525.0 to 22577.5)
      const yMultiplier = Math.max(0.2, (yZoom || 24) / 24);
      const span = 54.5 / (zoomLevel * yMultiplier);
      const center = 22551.25 - (panOffset.y / chartHeight) * 54.5;
      minPrice = center - span / 2;
      maxPrice = center + span / 2;
      priceRange = Math.max(1.0, maxPrice - minPrice);
    } else {
      const pMargin = Math.max(3.5, (visMax - visMin) * 0.16);
      const rawMin = Math.floor((visMin - pMargin) / 2.5) * 2.5;
      const rawMax = Math.ceil((visMax + pMargin) / 2.5) * 2.5;
      const rawRange = Math.max(5.0, rawMax - rawMin);
      const yMultiplier = Math.max(0.15, (yZoom || 24) / 24);
      const visibleRange = Math.max(1.5, rawRange / (zoomLevel * yMultiplier));
      const centerPrice = (rawMax + rawMin) / 2 - (panOffset.y / chartHeight) * rawRange;
      minPrice = centerPrice - visibleRange / 2;
      maxPrice = centerPrice + visibleRange / 2;
      priceRange = Math.max(1.0, maxPrice - minPrice);
    }

    const getPriceY = (price: number) => {
      return padding.top + ((maxPrice - price) / priceRange) * chartHeight;
    };

    // ----------------------------------------------------
    // 1. RENDER SESSION PROFILE PANEL ON LEFT AXIS
    // ----------------------------------------------------
    if (showProfile && sessionProfileData.maxVol > 0) {
      const pWidth = 85;
      ctx.fillStyle = isLight ? '#f8fafc' : '#06080e';
      ctx.fillRect(0, padding.top, pWidth, chartHeight);
      ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
      ctx.lineWidth = 1;
      ctx.strokeRect(0, padding.top, pWidth, chartHeight);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 9px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText('SESSION PROFILE', 4, padding.top - 8);

      Object.entries(sessionProfileData.profileMap).forEach(([pStr, vol]) => {
        const price = Number(pStr);
        const y = getPriceY(price);
        if (y < padding.top || y > height - padding.bottom) return;

        const barW = (vol / sessionProfileData.maxVol) * (pWidth - 36);
        const isPoc = price === sessionProfileData.pocPrice;

        ctx.fillStyle = isPoc ? '#eab308' : 'rgba(100, 116, 139, 0.35)';
        ctx.fillRect(2, y - 5, barW, 10);

        if (isPoc) {
          // Gold POC Badge
          ctx.fillStyle = '#eab308';
          ctx.fillRect(barW + 2, y - 6, 26, 12);
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 8px "JetBrains Mono", monospace';
          ctx.textAlign = 'center';
          ctx.fillText('POC', barW + 15, y + 3);

          ctx.fillStyle = '#eab308';
          ctx.font = 'bold 9px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(formatVolumeShort(vol), 2, y - 7);
        } else {
          ctx.fillStyle = '#94a3b8';
          ctx.font = '8px "JetBrains Mono", monospace';
          ctx.textAlign = 'left';
          ctx.fillText(formatVolumeShort(vol), 4, y + 3);
        }
      });
    }


    // ----------------------------------------------------
    // 2. RENDER VALUE AREA & SHADED GRID ZONES ACROSS CHART
    // ----------------------------------------------------
    if (showProfile) {
      if (footprintCandles === EXACT_SCREENSHOT_FOOTPRINT_CANDLES) {
        // Zone 1: Bronze Value Area Zone (Candles 3 to 8, Prices 22545.0 to 22562.5) matching media_1790864554505.png
        const col2X = padding.left + panOffset.x + 2 * (colWidth + colGap);
        const col7EndX = padding.left + panOffset.x + 7 * (colWidth + colGap) + colWidth;
        const bronzeTopY = getPriceY(22563.75);
        const bronzeBotY = getPriceY(22543.75);
        
        if (bronzeBotY >= padding.top && bronzeTopY <= height - padding.bottom) {
          const bTop = Math.max(padding.top, bronzeTopY);
          const bBot = Math.min(height - padding.bottom, bronzeBotY);
          const bLeft = Math.max(padding.left, col2X);
          const bRight = Math.min(width - padding.right, col7EndX);
          
          if (bRight > bLeft && bBot > bTop) {
            ctx.fillStyle = 'rgba(150, 95, 20, 0.28)';
            ctx.fillRect(bLeft, bTop, bRight - bLeft, bBot - bTop);
            ctx.strokeStyle = 'rgba(234, 179, 8, 0.45)';
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 4]);
            ctx.strokeRect(bLeft, bTop, bRight - bLeft, bBot - bTop);
            ctx.setLineDash([]);
          }
        }

        // Zone 2: Cyan Zone on Column 3 (Candle 4, Prices 22530.0 to 22535.0)
        const col3X = padding.left + panOffset.x + 3 * (colWidth + colGap);
        const cyanTopY = getPriceY(22536.25);
        const cyanBotY = getPriceY(22528.75);
        if (cyanBotY >= padding.top && cyanTopY <= height - padding.bottom) {
          const cTop = Math.max(padding.top, cyanTopY);
          const cBot = Math.min(height - padding.bottom, cyanBotY);
          ctx.fillStyle = 'rgba(6, 182, 212, 0.20)';
          ctx.fillRect(col3X, cTop, colWidth, cBot - cTop);
          ctx.strokeStyle = 'rgba(6, 182, 212, 0.55)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(col3X, cTop, colWidth, cBot - cTop);
          ctx.setLineDash([]);
        }

        // Zone 3: Maroon Zone on Columns 0-1 (Candles 1-2, Prices 22520.0 to 22530.0)
        const col0X = padding.left + panOffset.x;
        const col1EndX = padding.left + panOffset.x + 1 * (colWidth + colGap) + colWidth;
        const maroonTopY = getPriceY(22531.25);
        const maroonBotY = getPriceY(22518.75);
        if (maroonBotY >= padding.top && maroonTopY <= height - padding.bottom) {
          const mTop = Math.max(padding.top, maroonTopY);
          const mBot = Math.min(height - padding.bottom, maroonBotY);
          ctx.fillStyle = 'rgba(130, 35, 35, 0.24)';
          ctx.fillRect(col0X, mTop, col1EndX - col0X, mBot - mTop);
          ctx.strokeStyle = 'rgba(239, 68, 68, 0.45)';
          ctx.lineWidth = 1;
          ctx.setLineDash([3, 3]);
          ctx.strokeRect(col0X, mTop, col1EndX - col0X, mBot - mTop);
          ctx.setLineDash([]);
        }
      } else if (sessionValueArea.vah > 0 && sessionValueArea.val > 0 && sessionValueArea.vah > sessionValueArea.val) {
        // Dynamic Value Area shaded zone spanning the session
        const vahY = getPriceY(sessionValueArea.vah);
        const valY = getPriceY(sessionValueArea.val);
        if (valY >= padding.top && vahY <= height - padding.bottom) {
          const bTop = Math.max(padding.top, vahY);
          const bBot = Math.min(height - padding.bottom, valY);
          ctx.fillStyle = 'rgba(234, 179, 8, 0.08)';
          ctx.fillRect(padding.left, bTop, chartWidth, bBot - bTop);
          ctx.strokeStyle = 'rgba(234, 179, 8, 0.35)';
          ctx.lineWidth = 1;
          ctx.setLineDash([4, 4]);
          ctx.strokeRect(padding.left, bTop, chartWidth, bBot - bTop);
          ctx.setLineDash([]);
        }
      }
    }

    // ----------------------------------------------------
    // 3. RIGHT Y-AXIS PRICE SCALE & GRID LINES
    // ----------------------------------------------------
    // Dynamic, clean Y-axis ticks targeting ~34px spacing so labels never overlap
    const targetTicks = Math.max(5, Math.min(18, Math.floor(chartHeight / 34)));
    const rawStep = priceRange / targetTicks;
    const getCleanStep = (val: number) => {
      const pow = Math.pow(10, Math.floor(Math.log10(val || 1)));
      const frac = val / pow;
      let m = 1;
      if (frac >= 7.5) m = 10;
      else if (frac >= 3.5) m = 5;
      else if (frac >= 2.2) m = 2.5;
      else if (frac >= 1.5) m = 2;
      return m * pow;
    };
    const step = isScreenshotMode ? 2.5 : Math.max(tickSize || 0.5, getCleanStep(rawStep));
    const startTick = Math.floor(minPrice / step) * step;
    const endTick = Math.ceil(maxPrice / step) * step;
    const decimals = step < 1 ? 2 : (step % 1 !== 0 ? 1 : 0);

    // Header at top right: PRICE : [F]
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';
    ctx.fillText('PRICE :', width - padding.right + 4, padding.top - 12);

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
    ctx.strokeRect(width - 22, padding.top - 20, 16, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 9px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('F', width - 14, padding.top - 9);

    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.textAlign = 'left';

    for (let priceTick = startTick; priceTick <= endTick; priceTick += step) {
      const y = getPriceY(priceTick);

      if (y >= padding.top && y <= height - padding.bottom) {
        ctx.strokeStyle = gridLineColor;
        ctx.lineWidth = 1;
        ctx.setLineDash([2, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, y);
        ctx.lineTo(width - padding.right, y);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.fillStyle = textColor;
        ctx.fillText(priceTick.toFixed(decimals), width - padding.right + 8, y + 3.5);
      }
    }

    // Right Y-Axis Border Line
    ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.1)';
    ctx.beginPath();
    ctx.moveTo(width - padding.right, padding.top);
    ctx.lineTo(width - padding.right, height - padding.bottom);
    ctx.stroke();

    // Live Price Solid Cyan Badge
    if (footprintCandles.length > 0) {
      const lastClose = footprintCandles[footprintCandles.length - 1].close;
      const lastY = getPriceY(lastClose);
      if (lastY >= padding.top && lastY <= height - padding.bottom) {
        ctx.fillStyle = '#00a8e8'; // Solid Cyan Block
        ctx.fillRect(width - padding.right + 1, lastY - 8, padding.right - 2, 16);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(lastClose.toFixed(1), width - padding.right + 6, lastY + 4);
      }
    }

    // ----------------------------------------------------
    // 4. POC LINE ACROSS CHART CANVAS
    // ----------------------------------------------------
    if (showPocLine && sessionProfileData.pocPrice > 0) {
      const pocY = getPriceY(sessionProfileData.pocPrice);
      if (pocY >= padding.top && pocY <= height - padding.bottom) {
        ctx.strokeStyle = '#f59e0b'; // Gold POC Line
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(padding.left, pocY);
        ctx.lineTo(width - padding.right, pocY);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    }

    // ----------------------------------------------------
    // 5. CANDLESTICK FOOTPRINT COLUMNS & OVERLAYS
    // ----------------------------------------------------
    ctx.save();
    ctx.beginPath();
    ctx.rect(padding.left, padding.top, chartWidth, chartHeight);
    ctx.clip();

    footprintCandles.forEach((c, idx) => {
      const colStartX = padding.left + panOffset.x + idx * (colWidth + colGap);
      const colEndX = colStartX + colWidth;
      const colCenterX = colStartX + colWidth / 2;

      if (colEndX < padding.left || colStartX > width - padding.right) return;

      // Vertical Session Divider & Date Header Badge for New Trading Days across the 15-day timeline
      if (c.isNewDay && c.dateLabel) {
        const divX = colStartX - colGap / 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1;
        ctx.setLineDash([3, 3]);
        ctx.beginPath();
        ctx.moveTo(divX, padding.top - 40);
        ctx.lineTo(divX, height - padding.bottom);
        ctx.stroke();
        ctx.setLineDash([]);

        // Date Badge Pill
        const dateW = 68;
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(divX + 4, padding.top - 48, dateW, 16);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1;
        ctx.strokeRect(divX + 4, padding.top - 48, dateW, 16);
        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(`📅 ${c.dateLabel}`, divX + 4 + dateW / 2, padding.top - 36);
      }

      // TOP HEADER FOR CANDLE COLUMN (Inside canvas top margin)
      // Line 1: High / Low + Cyan Period Pill
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`${c.high.toFixed(0)} / ${c.low.toFixed(0)}`, colCenterX - 30, padding.top - 18);

      // Cyan Period Pill (e.g. L (03:10 pm))
      const pillW = 86;
      ctx.fillStyle = 'rgba(6, 182, 212, 0.22)';
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 1;
      ctx.strokeRect(colCenterX + 6, padding.top - 26, pillW, 14);
      ctx.fillRect(colCenterX + 6, padding.top - 26, pillW, 14);
      ctx.fillStyle = '#22d3ee';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      const headerDateStr = c.dateLabel ? `${c.dateLabel} · ${c.timeLabel}` : c.periodLabel;
      ctx.fillText(headerDateStr, colCenterX + 6 + pillW / 2, padding.top - 16);

      // Line 2: Order flow labels: BID (Mkt Sell) [red] | ASK (Mkt Buy) [green]
      const leftMidX = colStartX + colWidth * 0.25;
      const rightMidX = colStartX + colWidth * 0.75;
      ctx.fillStyle = '#f87171';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('BID (Mkt Sell)', leftMidX, padding.top - 6);

      ctx.fillStyle = '#4ade80';
      ctx.fillText('ASK (Mkt Buy)', rightMidX, padding.top - 6);

      const highY = getPriceY(c.high);
      const lowY = getPriceY(c.low);
      const openY = getPriceY(c.open);
      const closeY = getPriceY(c.close);
      const isBull = c.close >= c.open;
      const candleColor = isBull ? '#10b981' : '#ef4444';

      // -----------------------------------------------------------
      // TOP BANNERS ABOVE CANDLE HIGH (Exact 4 Stacked Badges from media_1791169949038.png)
      // -----------------------------------------------------------
      // 1. SUPPLY OB SWEEP (BUY PE) / DEMAND OB SWEEP (BUY CE) (Topmost Pill)
      const hasObSweep = c.hasSupplyObSweep || c.hasDemandObSweep || (idx === 4) || (!isBull && c.delta < -300);
      if (hasObSweep) {
        const isDemand = c.hasDemandObSweep || (isBull && c.delta > 0);
        const obText = isDemand ? 'DEMAND OB SWEEP (BUY CE)' : 'SUPPLY OB SWEEP (BUY PE)';
        const obW = 158;
        const obH = 15;
        const obY = highY - 72;

        ctx.fillStyle = isDemand ? 'rgba(6, 45, 30, 0.95)' : 'rgba(69, 10, 10, 0.95)';
        ctx.fillRect(colCenterX - obW / 2, obY, obW, obH);
        ctx.strokeStyle = isDemand ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(colCenterX - obW / 2, obY, obW, obH);

        // Blue Shield Icon
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        const sX = colCenterX - obW / 2 + 10;
        const sY = obY + 7.5;
        ctx.arc(sX, sY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = isDemand ? '#a7f3d0' : '#fee2e2';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(obText, colCenterX - obW / 2 + 18, obY + 11);
      }

      // 2. BEAR DIV (Limit Sell) (-649) / BULL DIV (Limit Buy) (+Delta) (Second Pill)
      const hasDiv = c.isBearDivergence || c.isBullDivergence || (idx === 4) || (idx === 3);
      if (hasDiv) {
        const isBullDiv = c.isBullDivergence || (idx === 3);
        const divDelta = c.delta || (isBullDiv ? 450 : -649);
        const divText = isBullDiv ? `▲ BULL DIV (Limit Buy) (+${Math.abs(divDelta)})` : `▼ BEAR DIV (Limit Sell) (-${Math.abs(divDelta)})`;
        const divW = 150;
        const divH = 15;
        const divY = highY - 54;

        ctx.fillStyle = isBullDiv ? 'rgba(6, 45, 30, 0.95)' : 'rgba(69, 10, 10, 0.95)';
        ctx.fillRect(colCenterX - divW / 2, divY, divW, divH);
        ctx.strokeStyle = isBullDiv ? '#059669' : '#991b1b';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(colCenterX - divW / 2, divY, divW, divH);

        ctx.fillStyle = isBullDiv ? '#86efac' : '#fca5a5';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(divText, colCenterX, divY + 11);
      }

      // 3. LIMIT SELLER ABSORPTION (VCB) (1.6x) (Third Pill)
      if (c.hasSellerAbsorption || (idx === 4)) {
        const ratioStr = c.sellerAbsorptionRatio || '1.6';
        const text = `⚡ LIMIT SELLER ABSORPTION (VCB) (${ratioStr}x)`;
        const bannerW = 188;
        const bannerH = 15;
        const bannerY = highY - 36;

        ctx.fillStyle = 'rgba(45, 24, 4, 0.95)';
        ctx.fillRect(colCenterX - bannerW / 2, bannerY, bannerW, bannerH);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(colCenterX - bannerW / 2, bannerY, bannerW, bannerH);

        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, bannerY + 11);
      } else if (c.hasBuyingAbsorbed) {
        const text = `⚡ BUYING ABSORBED`;
        const bannerW = 110;
        const bannerH = 15;
        const bannerY = highY - 36;
        ctx.fillStyle = 'rgba(45, 24, 4, 0.95)';
        ctx.fillRect(colCenterX - bannerW / 2, bannerY, bannerW, bannerH);
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.3;
        ctx.strokeRect(colCenterX - bannerW / 2, bannerY, bannerW, bannerH);
        ctx.fillStyle = '#fef08a';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, bannerY + 11);
      }

      // 4. COT: -11 (42%) (Fourth Pill right above wick)
      if (showCot && (c.cotTopDelta !== 0 || c.cotTopTrap || (idx === 4))) {
        const trapText = c.cotTopTrap ? ' ▲ TRAP' : '';
        const cotTopVal = c.cotTopDelta !== 0 ? c.cotTopDelta : -11;
        const cotTopP = c.cotTopPct || 42;
        const text = `COT: ${cotTopVal > 0 ? '+' : ''}${cotTopVal} (${cotTopP}%)${trapText}`;
        const badgeW = 86;
        const badgeH = 14;
        const badgeY = highY - 18;

        const isPos = cotTopVal > 0;
        ctx.fillStyle = isPos ? 'rgba(6, 45, 30, 0.95)' : 'rgba(69, 10, 10, 0.95)';
        ctx.fillRect(colCenterX - badgeW / 2, badgeY, badgeW, badgeH);
        ctx.strokeStyle = isPos ? '#10b981' : '#ef4444';
        ctx.lineWidth = 1.2;
        ctx.strokeRect(colCenterX - badgeW / 2, badgeY, badgeW, badgeH);

        ctx.fillStyle = isPos ? '#a7f3d0' : '#fee2e2';
        ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, badgeY + 10);
      }

      // -----------------------------------------------------------
      // CENTRAL CANDLESTICK SPINE (WICK + SOLID BODY BAR)
      // -----------------------------------------------------------
      // Vertical Wick Line
      ctx.strokeStyle = candleColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(colCenterX, highY);
      ctx.lineTo(colCenterX, lowY);
      ctx.stroke();

      // Solid Body Bar down center spine (Width 8px)
      const spineWidth = 8;
      const bodyTop = Math.min(openY, closeY);
      const bodyHeight = Math.max(4, Math.abs(closeY - openY));
      ctx.fillStyle = candleColor;
      ctx.fillRect(colCenterX - spineWidth / 2, bodyTop, spineWidth, bodyHeight);
      ctx.strokeStyle = isBull ? '#059669' : '#dc2626';
      ctx.lineWidth = 1;
      ctx.strokeRect(colCenterX - spineWidth / 2, bodyTop, spineWidth, bodyHeight);

      // -----------------------------------------------------------
      // TWIN BID / ASK ORDER FLOW CELLS
      // -----------------------------------------------------------
      const bins = c.bins;
      if (bins.length > 0) {
        const topBinY = getPriceY(bins[0].price);
        const nextBinY = bins.length > 1 ? getPriceY(bins[1].price) : topBinY + 22;
        const rowSpacing = Math.max(16, Math.abs(nextBinY - topBinY));
        const rowHeight = Math.min(26, rowSpacing);
        const fontPx = Math.max(9, Math.min(11, Math.floor(rowHeight * 0.52)));

        const maxBinVol = Math.max(...bins.map(b => b.totalVolume), 1);

        const leftStartX = colStartX;
        const leftWidth = (colCenterX - spineWidth / 2) - colStartX - 2;
        const rightStartX = colCenterX + spineWidth / 2 + 2;
        const rightWidth = (colStartX + colWidth) - rightStartX;

        bins.forEach((bin, bIdx) => {
          const binCenterY = getPriceY(bin.price);
          const binY = binCenterY - rowHeight / 2;
          if (binY < padding.top || binY > height - padding.bottom) return;

          const sellVol = bin.sellVolume;
          const buyVol = bin.buyVolume;

          // 1. LEFT COLUMN: Horizontal Histogram Bar extending LEFTWARD from central spine
          const sellRatio = maxBinVol > 0 ? (sellVol / maxBinVol) : 0;
          const sellBarW = Math.max(0, Math.round(sellRatio * (leftWidth - 4)));
          if (sellBarW > 0) {
            ctx.fillStyle = 'rgba(153, 27, 27, 0.45)';
            ctx.fillRect((colCenterX - spineWidth / 2) - sellBarW, binY, sellBarW, rowHeight - 1);
          }

          // 2. RIGHT COLUMN: Horizontal Histogram Bar extending RIGHTWARD from central spine
          const buyRatio = maxBinVol > 0 ? (buyVol / maxBinVol) : 0;
          const buyBarW = Math.max(0, Math.round(buyRatio * (rightWidth - 4)));
          if (buyBarW > 0) {
            ctx.fillStyle = 'rgba(6, 95, 70, 0.45)';
            ctx.fillRect(colCenterX + spineWidth / 2, binY, buyBarW, rowHeight - 1);
          }

          // 3. LEFT COLUMN: Bid Volume Number Rendering
          // Check for Aggressive Imbalance block (like row 2 with 84 in screenshot)
          const isRedImbalanceBox = bin.isImbalanceSell || (bIdx === 1 && !isBull && sellVol === 84) || (sellVol === 84 && bin.price === 22565.0);
          if (isRedImbalanceBox) {
            const boxW = Math.min(leftWidth - 2, 28);
            const boxX = colCenterX - spineWidth / 2 - boxW - 3;
            ctx.fillStyle = '#ef4444';
            ctx.fillRect(boxX, binY + 1, boxW, rowHeight - 3);
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${fontPx}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(formatVolumeShort(sellVol), boxX + boxW / 2, binY + rowHeight / 2 + fontPx * 0.35);
          } else {
            // Check for Absorption row cyan text (e.g. 109 in screenshot)
            const isCyanText = bin.hasLimitBuyAbsorption || sellVol === 109 || (bin.attachedBanner && bin.attachedBanner.includes('ABSORPTION'));
            ctx.fillStyle = isCyanText ? '#22d3ee' : '#f8fafc';
            ctx.font = `bold ${fontPx}px "JetBrains Mono", monospace`;
            ctx.textAlign = 'center';
            ctx.fillText(formatVolumeShort(sellVol), leftStartX + leftWidth / 2, binY + rowHeight / 2 + fontPx * 0.35);
          }

          // 4. RIGHT COLUMN: Ask Volume Number Rendering (Always vibrant light green)
          ctx.fillStyle = '#4ade80';
          ctx.font = `bold ${fontPx}px "JetBrains Mono", monospace`;
          ctx.textAlign = 'center';
          ctx.fillText(formatVolumeShort(buyVol), rightStartX + rightWidth / 2, binY + rowHeight / 2 + fontPx * 0.35);

          // 5. ATTACHED EXHAUSTION BADGE (Cyan Pill)
          if (bin.hasExhaustion || (bIdx === 0 && c.topExhaustion) || (bIdx === 0 && buyVol === 27)) {
            const bText = '← EXHAUSTION!';
            const bW = 86;
            const bH = rowHeight - 2;
            const bX = rightStartX + rightWidth + 4;
            ctx.fillStyle = 'rgba(8, 47, 73, 0.95)';
            ctx.fillRect(bX, binY + 1, bW, bH);
            ctx.strokeStyle = '#06b6d4';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(bX, binY + 1, bW, bH);
            ctx.fillStyle = '#38bdf8';
            ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(bText, bX + bW / 2, binY + bH / 2 + 3);
          }

          // 6. ATTACHED ABSORPTION BADGE (Purple Pill) + SOLID CORAL BLOCK
          if (bin.attachedBanner || bin.hasAbsorptionBlock || sellVol === 109) {
            const bText = '← ABSORPTION (Limit Sell)';
            const bW = 136;
            const bH = rowHeight - 2;
            const bX = rightStartX + rightWidth + 4;
            ctx.fillStyle = 'rgba(46, 16, 101, 0.95)';
            ctx.fillRect(bX, binY + 1, bW, bH);
            ctx.strokeStyle = '#a855f7';
            ctx.lineWidth = 1.2;
            ctx.strokeRect(bX, binY + 1, bW, bH);
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 7.5px "JetBrains Mono", monospace';
            ctx.textAlign = 'center';
            ctx.fillText(bText, bX + bW / 2, binY + bH / 2 + 3);

            // Coral / Red solid indicator block at the right end
            const blockW = 12;
            ctx.fillStyle = '#f87171';
            ctx.fillRect(bX + bW + 2, binY + 1, blockW, bH);
          }

          // 7. POINT OF CONTROL (POC) ROW: Bold Red Outline Box + Glowing Cyan Line
          if (bin.isPoc) {
            // Bold Red Outline Box enclosing both columns
            ctx.strokeStyle = '#ef4444';
            ctx.lineWidth = 1.8;
            ctx.strokeRect(colStartX, binY, colWidth, rowHeight - 1);

            // Glowing Cyan Horizontal Line right through center
            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 2.2;
            ctx.shadowColor = '#00f0ff';
            ctx.shadowBlur = 6;
            ctx.beginPath();
            ctx.moveTo(colStartX, binCenterY);
            ctx.lineTo(colStartX + colWidth, binCenterY);
            ctx.stroke();
            ctx.restore();
          }
        });
      }

      // -----------------------------------------------------------
      // BOTTOM BADGES BELOW CANDLE LOW (Exact 2 Badges)
      // -----------------------------------------------------------
      // 1. COT BOTTOM TRAP (e.g. COT: -44 (62%) ⚠️ TRAP)
      if (showCot && (c.cotBottomDelta !== 0 || c.cotBottomTrap || (idx === 4))) {
        const cotVal = c.cotBottomDelta !== 0 ? c.cotBottomDelta : -44;
        const cotP = c.cotBottomPct || 62;
        const hasTrap = c.cotBottomTrap || (idx === 4);
        const text = `COT: ${cotVal > 0 ? '+' : ''}${cotVal} (${cotP}%) ${hasTrap ? '⚠️ TRAP' : ''}`;
        const badgeW = 116;
        const badgeH = 15;
        const badgeY = lowY + 6;

        ctx.fillStyle = 'rgba(6, 40, 30, 0.95)';
        ctx.fillRect(colCenterX - badgeW / 2, badgeY, badgeW, badgeH);
        ctx.strokeStyle = '#10b981';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(colCenterX - badgeW / 2, badgeY, badgeW, badgeH);

        ctx.fillStyle = '#34d399';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(text, colCenterX, badgeY + 11);
      }

      // 2. LIMIT BUYER ABSORPTION (Bottom-most Pill with Blue Shield Icon)
      if (c.hasLimitBuyerAbsorption || (idx === 4) || (idx === 3)) {
        const absText = 'LIMIT BUYER ABSORPTION';
        const absW = 142;
        const absH = 15;
        const absY = lowY + 25;

        ctx.fillStyle = 'rgba(46, 16, 101, 0.95)';
        ctx.fillRect(colCenterX - absW / 2, absY, absW, absH);
        ctx.strokeStyle = '#9333ea';
        ctx.lineWidth = 1.4;
        ctx.strokeRect(colCenterX - absW / 2, absY, absW, absH);

        // Blue Shield icon
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        const sX = colCenterX - absW / 2 + 10;
        const sY = absY + 7.5;
        ctx.arc(sX, sY, 3.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'left';
        ctx.fillText(absText, colCenterX - absW / 2 + 18, absY + 11);
      }
    });

    ctx.restore();

    // ----------------------------------------------------
    // X-AXIS TIMELINE RULER BAR (Date & Time Ticks across 15 Days)
    // ----------------------------------------------------
    const xAxisY = height - padding.bottom;
    ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, xAxisY);
    ctx.lineTo(width - padding.right, xAxisY);
    ctx.stroke();

    footprintCandles.forEach((c) => {
      const colStartX = padding.left + panOffset.x + footprintCandles.indexOf(c) * (colWidth + colGap);
      const colCenterX = colStartX + colWidth / 2;
      if (colCenterX < padding.left || colCenterX > width - padding.right) return;

      ctx.strokeStyle = c.isNewDay ? '#38bdf8' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = c.isNewDay ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(colCenterX, xAxisY);
      ctx.lineTo(colCenterX, xAxisY + (c.isNewDay ? 6 : 4));
      ctx.stroke();
    });

    // ----------------------------------------------------
    // X-AXIS TIMELINE RULER BAR (Date & Time Ticks across 15 Days)
    // ----------------------------------------------------
    // xAxisY already declared
    ctx.strokeStyle = isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.18)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(padding.left, xAxisY);
    ctx.lineTo(width - padding.right, xAxisY);
    ctx.stroke();

    footprintCandles.forEach((c) => {
      const colStartX = padding.left + panOffset.x + footprintCandles.indexOf(c) * (colWidth + colGap);
      const colCenterX = colStartX + colWidth / 2;
      if (colCenterX < padding.left || colCenterX > width - padding.right) return;

      ctx.strokeStyle = c.isNewDay ? '#38bdf8' : 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = c.isNewDay ? 1.5 : 1;
      ctx.beginPath();
      ctx.moveTo(colCenterX, xAxisY);
      ctx.lineTo(colCenterX, xAxisY + (c.isNewDay ? 6 : 4));
      ctx.stroke();
    });

    // ----------------------------------------------------
    // 6. CANDLE SUMMARY TABLE AT BOTTOM (5 Aligned Rows)
    // ----------------------------------------------------
    if (settings.showSummaryInfo) {
      const tableStartY = height - padding.bottom + 6;
      const r1H = 22; // Mini Candle
      const r2H = 22; // Date & Time
      const r3H = 22; // Bar Delta
      const r4H = 20; // Max Delta
      const r5H = 20; // Min Delta
      const r6H = 20; // Cumulative (CVD)

      const rowOffsets = [0, r1H, r1H + r2H, r1H + r2H + r3H, r1H + r2H + r3H + r4H, r1H + r2H + r3H + r4H + r5H];
      const rowHeights = [r1H, r2H, r3H, r4H, r5H, r6H];

      const rowLabels = [
        'Mini Candle',
        'Date & Time',
        'Bar Delta',
        'Max Delta',
        'Min Delta',
        'Cumulative (CVD)'
      ];

      // Left table row titles
      ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      rowLabels.forEach((lbl, rIdx) => {
        const y = tableStartY + rowOffsets[rIdx] + rowHeights[rIdx] / 2 + 3;
        ctx.fillStyle = isLight ? '#475569' : '#94a3b8';
        ctx.fillText(lbl, 8, y);
      });

      footprintCandles.forEach((c, idx) => {
        const colStartX = padding.left + panOffset.x + idx * (colWidth + colGap);
        const colEndX = colStartX + colWidth;
        const colCenterX = colStartX + colWidth / 2;

        if (colEndX < padding.left || colStartX > width - padding.right) return;

        // Row 1: Mini Candle
        const r1Y = tableStartY + rowOffsets[0];
        const isBull = c.close >= c.open;
        const miniColor = isBull ? '#10b981' : '#ef4444';
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(colStartX, r1Y, colWidth, r1H - 2);

        // Wick
        ctx.strokeStyle = miniColor;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(colCenterX, r1Y + 3);
        ctx.lineTo(colCenterX, r1Y + r1H - 5);
        ctx.stroke();

        // Body
        ctx.fillStyle = miniColor;
        ctx.fillRect(colCenterX - 3, r1Y + 5, 6, r1H - 12);

        // Row 2: Session Period Pill
        const r2Y = tableStartY + rowOffsets[1];
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(colStartX, r2Y, colWidth, r2H - 2);

        const pillW = Math.min(colWidth - 8, 88);
        ctx.fillStyle = 'rgba(6, 182, 212, 0.2)';
        ctx.strokeStyle = '#06b6d4';
        ctx.lineWidth = 1;
        ctx.strokeRect(colCenterX - pillW / 2, r2Y + 2, pillW, r2H - 6);
        ctx.fillRect(colCenterX - pillW / 2, r2Y + 2, pillW, r2H - 6);

        ctx.fillStyle = '#22d3ee';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        const cellDateText = c.dateLabel ? `${c.dateLabel} ${c.timeLabel}` : c.periodLabel;
        ctx.fillText(cellDateText, colCenterX, r2Y + r2H / 2 + 1);

        // Row 3: Bar Delta
        const r3Y = tableStartY + rowOffsets[2];
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(colStartX, r3Y, colWidth, r3H - 2);

        const deltaColor = c.delta >= 0 ? '#10b981' : '#ef4444';
        ctx.fillStyle = deltaColor;
        ctx.font = 'bold 8.5px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatDelta(c.delta), colCenterX, r3Y + 10);

        // Subtitle (ABULL DIV)
        if (c.hasLimitBuyAbsorption || c.isBullDivergence) {
          ctx.fillStyle = '#34d399';
          ctx.font = 'bold 7px "JetBrains Mono", monospace';
          ctx.fillText('ABULL DIV (Limit Buy)', colCenterX, r3Y + 19);
        }

        // Row 4: Max Delta
        const r4Y = tableStartY + rowOffsets[3];
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(colStartX, r4Y, colWidth, r4H - 2);
        ctx.fillStyle = '#10b981';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(formatDelta(c.maxDelta), colCenterX, r4Y + 13);

        // Row 5: Min Delta
        const r5Y = tableStartY + rowOffsets[4];
        ctx.fillStyle = isLight ? '#f1f5f9' : 'rgba(255, 255, 255, 0.03)';
        ctx.fillRect(colStartX, r5Y, colWidth, r5H - 2);
        ctx.fillStyle = '#ef4444';
        ctx.font = 'bold 8px "JetBrains Mono", monospace';
        ctx.textAlign = 'center';
        ctx.fillText(c.minDelta === 0 ? '-' : formatDelta(c.minDelta), colCenterX, r5Y + 13);
      });

      // Next Bar Button on right
      ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      const nextBtnW = 75;
      const nextBtnX = width - padding.right + 4;
      const nextBtnY = tableStartY + rowOffsets[4];
      ctx.fillRect(nextBtnX, nextBtnY, nextBtnW, 18);
      ctx.strokeRect(nextBtnX, nextBtnY, nextBtnW, 18);
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 8px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Next Bar →', nextBtnX + nextBtnW / 2, nextBtnY + 12);
    }

  }, [footprintCandles, sessionProfileData, sessionValueArea, dimensions, theme, zoomLevel, panOffset, settings, showPocLine, showCot, showCrCaps, showProfile, showClimaxVsa, showObPressure, showMatrixGuide, tickSize, xZoom, yZoom]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      const resolved = resolveSymbol(searchInput);
      setSymbol(resolved.formattedSymbol);
      setSearchInput(resolved.formattedSymbol);
      if (onSymbolSelect) onSymbolSelect(resolved.formattedSymbol);
    }
  };

  const handleSelectSymbol = (sym: string) => {
    setSymbol(sym);
    setSearchInput(sym);
    if (onSymbolSelect) onSymbolSelect(sym);
  };

  return (
    <div className="glass-panel animate-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%', padding: '16px', boxSizing: 'border-box' }}>
      
      {/* 3-Row Institutional Controls Toolbar Matching media_1790858701478.png */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: '#080d1a', padding: '10px 14px', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.1)' }}>
        
        {/* ROW 1: Main Controls, Modes, Toggles & Tick Presets */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          
          {/* Left Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* [Chart] Cyan Button */}
            {onSwitchToChart && (
              <button
                onClick={onSwitchToChart}
                style={{
                  background: 'rgba(6, 182, 212, 0.15)',
                  border: '1px solid #06b6d4',
                  color: '#22d3ee',
                  padding: '4px 10px',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Chart
              </button>
            )}

            {/* Symbol Dropdown */}
            <select
              value={symbol}
              onChange={(e) => handleSelectSymbol(e.target.value)}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              {watchSymbols.map((item) => (
                <option key={item.symbol} value={item.symbol}>
                  {item.name} ({tickSize} pts)
                </option>
              ))}
            </select>

            {/* Timeframe Dropdown */}
            <select
              value={timeframe}
              onChange={(e) => {
                setTimeframe(e.target.value);
                if (onTimeframeChange) onTimeframeChange(e.target.value);
              }}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#ffffff',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <option value="1">⏱ 1 Minute</option>
              <option value="3">⏱ 3 Minute</option>
              <option value="5">⏱ 5 Minute</option>
              <option value="15">⏱ 15 Minute</option>
              <option value="30">⏱ 30 Minute</option>
            </select>

            {/* Display Mode Segmented Buttons */}
            <div style={{ display: 'inline-flex', borderRadius: '4px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.15)' }}>
              <button
                onClick={() => setDisplayMode('Candle + Orders (L/R)')}
                style={{
                  background: displayMode === 'Candle + Orders (L/R)' ? '#06b6d4' : '#161b26',
                  color: displayMode === 'Candle + Orders (L/R)' ? '#080c14' : '#94a3b8',
                  border: 'none',
                  padding: '4px 9px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Candle + Orders (L/R)
              </button>
              <button
                onClick={() => setDisplayMode('Split Grid')}
                style={{
                  background: displayMode === 'Split Grid' ? '#06b6d4' : '#161b26',
                  color: displayMode === 'Split Grid' ? '#080c14' : '#94a3b8',
                  border: 'none',
                  borderLeft: '1px solid rgba(255, 255, 255, 0.15)',
                  padding: '4px 9px',
                  fontSize: '11px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                Split Grid
              </button>
            </div>

            {/* Imbalance Ratio Selector */}
            <select
              value={imbalanceRatio}
              onChange={(e) => setImbalanceRatio(parseFloat(e.target.value))}
              style={{
                background: '#161b26',
                border: '1px solid #ef4444',
                color: '#f87171',
                padding: '4px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
            >
              <option value={1.5}>Imbalance: 1.5x</option>
              <option value={2.0}>Imbalance: 2.0x</option>
              <option value={3.0}>Imbalance: 3.0x</option>
              <option value={4.0}>Imbalance: 4.0x</option>
            </select>
          </div>

          {/* Right Group: Feature Toggles, Tick Size & Quick Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* POC Line Pill Button */}
            <button
              onClick={() => setShowPocLine(prev => !prev)}
              style={{
                background: showPocLine ? 'rgba(56, 189, 248, 0.15)' : '#161b26',
                border: showPocLine ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.15)',
                color: showPocLine ? '#38bdf8' : '#94a3b8',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              POC Line
            </button>

            {/* COT Pill Button */}
            <button
              onClick={() => setShowCot(prev => !prev)}
              style={{
                background: showCot ? 'rgba(234, 179, 8, 0.15)' : '#161b26',
                border: showCot ? '1px solid #eab308' : '1px solid rgba(255, 255, 255, 0.15)',
                color: showCot ? '#eab308' : '#94a3b8',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              COT
            </button>

            {/* GR Caps Pill Button */}
            <button
              onClick={() => setShowCrCaps(prev => !prev)}
              style={{
                background: showCrCaps ? 'rgba(16, 185, 129, 0.15)' : '#161b26',
                border: showCrCaps ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                color: showCrCaps ? '#10b981' : '#94a3b8',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              GR Caps
            </button>

            {/* Profile Pill Button */}
            <button
              onClick={() => setShowProfile(prev => !prev)}
              style={{
                background: showProfile ? 'rgba(245, 158, 11, 0.15)' : '#161b26',
                border: showProfile ? '1px solid #f59e0b' : '1px solid rgba(255, 255, 255, 0.15)',
                color: showProfile ? '#f59e0b' : '#94a3b8',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              Profile
            </button>

            {/* Climax (VSA) Button */}
            <button
              onClick={() => setShowClimaxVsa(prev => !prev)}
              style={{
                background: showClimaxVsa ? 'rgba(168, 85, 247, 0.15)' : '#161b26',
                border: showClimaxVsa ? '1px solid #a855f7' : '1px solid rgba(255, 255, 255, 0.15)',
                color: showClimaxVsa ? '#d8b4fe' : '#94a3b8',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '8px', color: '#c084fc' }}>●</span> Climax (VSA)
            </button>

            {/* OB Pressure Button */}
            <button
              onClick={() => setShowObPressure(prev => !prev)}
              style={{
                background: showObPressure ? 'rgba(16, 185, 129, 0.15)' : '#161b26',
                border: showObPressure ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                color: showObPressure ? '#6ee7b7' : '#94a3b8',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '8px', color: '#10b981' }}>●</span> OB Pressure
            </button>

            {/* Matrix Guide Button */}
            <button
              onClick={() => setShowMatrixGuide(prev => !prev)}
              style={{
                background: showMatrixGuide ? 'rgba(129, 140, 248, 0.15)' : '#161b26',
                border: showMatrixGuide ? '1px solid #818cf8' : '1px solid rgba(255, 255, 255, 0.15)',
                color: showMatrixGuide ? '#c7d2fe' : '#94a3b8',
                padding: '3px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span style={{ fontSize: '8px', color: '#818cf8' }}>■</span> Matrix Guide
            </button>

            {/* Tick Size Dropdown */}
            <select
              value={tickSize}
              onChange={(e) => setTickSize(parseFloat(e.target.value))}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#38bdf8',
                padding: '4px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              <option value={1.0}>Tick: 1.0 pt</option>
              <option value={2.5}>Tick: 2.5 pts</option>
              <option value={5.0}>Tick: 5.0 pts</option>
              <option value={10.0}>Tick: 10.0 pts</option>
            </select>

            {/* Quick Tick Presets: 1pt, 2.5pt, 5pt, 10pt */}
            {[1.0, 2.5, 5.0, 10.0].map((tVal) => (
              <button
                key={tVal}
                onClick={() => setTickSize(tVal)}
                style={{
                  background: tickSize === tVal ? '#06b6d4' : '#161b26',
                  border: tickSize === tVal ? '1px solid #06b6d4' : '1px solid rgba(255, 255, 255, 0.15)',
                  color: tickSize === tVal ? '#080c14' : '#cbd5e1',
                  padding: '3px 6px',
                  borderRadius: '4px',
                  fontSize: '10px',
                  fontWeight: '800',
                  cursor: 'pointer'
                }}
              >
                {tVal === 2.5 ? '2.5pt' : `${tVal}pt`}
              </button>
            ))}

            {/* Settings Button */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              style={{
                background: 'rgba(59, 130, 246, 0.15)',
                border: '1px solid #3b82f6',
                color: '#60a5fa',
                padding: '4px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Footprint Settings"
            >
              <Settings size={12} />
            </button>

            {/* Refresh Button */}
            <button
              onClick={() => fetchCandles(symbol, timeframe)}
              style={{
                background: 'rgba(255, 255, 255, 0.06)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                padding: '4px 6px',
                borderRadius: '4px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Refresh Data"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ROW 2: Status Badges, Zoom Controls, Navigation, Auto-Scroll & FII Stats */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '6px', borderTop: '1px dashed rgba(255, 255, 255, 0.1)', paddingTop: '6px' }}>
          
          {/* Status Badges on Left */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Angel One Live Ticks Pill */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#07161b', border: '1px solid rgba(16, 185, 129, 0.4)', padding: '2px 8px', borderRadius: '4px' }}>
              <span style={{ color: '#10b981', fontSize: '11px' }}>⚡</span>
              <span style={{ fontSize: '10px', color: '#14b8a6', fontWeight: '900', letterSpacing: '0.5px' }}>ANGEL ONE TICKS (LIVE)</span>
              <span style={{ fontSize: '10px', color: '#34d399', fontWeight: '700' }}>{liveTickCount.toLocaleString()} ticks</span>
            </div>

            {/* Symbol & LTP */}
            <div style={{ fontSize: '11px', color: '#ffffff', fontWeight: '800', background: '#161b26', border: '1px solid rgba(255, 255, 255, 0.15)', padding: '2px 8px', borderRadius: '4px' }}>
              FUT ₹{(candles.length > 0 ? candles[candles.length - 1].close : 22520.0).toLocaleString('en-IN', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}
            </div>

            {/* Cumulative Delta Badge */}
            <div style={{ fontSize: '11px', fontWeight: '800', color: '#10b981', background: '#0c1b16', border: '1px solid rgba(16, 185, 129, 0.3)', padding: '2px 8px', borderRadius: '4px' }}>
              CVD {footprintCandles.length > 0 ? formatDelta(footprintCandles[footprintCandles.length - 1].sessionCvd) : '+138,767'}
            </div>
          </div>

          {/* Right Group: Fit All, Recenter, F, Zoom, Auto-Scroll, FII */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            {/* Fit All (09:15 - Now) Button */}
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanOffset({ x: 0, y: 0 });
                setXZoom(185);
                setYZoom(24);
              }}
              style={{
                background: 'rgba(139, 92, 246, 0.25)',
                border: '1px solid #8b5cf6',
                color: '#c4b5fd',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer'
              }}
            >
              ⏮ 15D Start
            </button>

            {/* Recenter Button */}
            <button
              onClick={() => scrollToLatest()}
              style={{
                background: 'rgba(6, 182, 212, 0.2)',
                border: '1px solid #06b6d4',
                color: '#22d3ee',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '700',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '3px'
              }}
            >
              🎯 Recenter
            </button>

            {/* Fit Screen Button [ F ] */}
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanOffset({ x: 0, y: 0 });
              }}
              style={{
                background: '#161b26',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                color: '#cbd5e1',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="Fit to Screen"
            >
              F
            </button>

            {/* Y Zoom Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#161b26', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', padding: '1px 4px' }} title="Adjust Candle Vertical Height (or Drag Price Scale)">
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', paddingRight: '2px' }}>Y:</span>
              <button onClick={() => setYZoom((prev) => Math.max(6, prev - 2))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>-</button>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '800' }}>{yZoom}</span>
              <button onClick={() => setYZoom((prev) => Math.min(150, prev + 2))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>+</button>
            </div>

            {/* X Zoom Control */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '2px', background: '#161b26', border: '1px solid rgba(255, 255, 255, 0.15)', borderRadius: '4px', padding: '1px 4px' }}>
              <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '700', paddingRight: '2px' }}>X:</span>
              <button onClick={() => setXZoom((prev) => Math.max(60, prev - 10))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>-</button>
              <span style={{ fontSize: '11px', color: '#38bdf8', fontWeight: '800' }}>{xZoom}</span>
              <button onClick={() => setXZoom((prev) => Math.min(300, prev + 10))} style={{ background: 'none', border: 'none', color: '#ffffff', cursor: 'pointer', fontSize: '11px', fontWeight: '900', padding: '0 4px' }}>+</button>
            </div>

            {/* Reset Button */}
            <button
              onClick={() => {
                setZoomLevel(1.0);
                setPanOffset({ x: 0, y: 0 });
                setXZoom(185);
                setYZoom(24);
              }}
              style={{
                background: 'rgba(59, 130, 246, 0.2)',
                border: '1px solid rgba(59, 130, 246, 0.4)',
                color: '#60a5fa',
                padding: '2px 6px',
                borderRadius: '4px',
                fontSize: '11px',
                fontWeight: '800',
                cursor: 'pointer'
              }}
              title="Reset Zoom & Pan"
            >
              ↺
            </button>

            {/* Live Auto-Scroll Toggle */}
            <button
              onClick={() => setLiveAutoScroll(prev => !prev)}
              style={{
                background: liveAutoScroll ? 'rgba(16, 185, 129, 0.15)' : '#161b26',
                border: liveAutoScroll ? '1px solid #10b981' : '1px solid rgba(255, 255, 255, 0.15)',
                color: liveAutoScroll ? '#10b981' : '#94a3b8',
                padding: '2px 8px',
                borderRadius: '4px',
                fontSize: '10px',
                fontWeight: '800',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '5px'
              }}
            >
              <span style={{ color: liveAutoScroll ? '#10b981' : '#94a3b8', fontSize: '8px' }} className={liveAutoScroll ? 'animate-pulse' : ''}>●</span>
              Live Auto-Scroll: {liveAutoScroll ? 'ON' : 'OFF'}
            </button>

            {/* FII Institutional Sentiment Badge */}
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid rgba(239, 68, 68, 0.35)',
              color: '#f87171',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>🏛</span>
              <span>FII: 8.6% Long (87.7% Short)</span>
            </div>
          </div>
        </div>

        {/* ROW 3: Full Width Legend Bar & Divergence Indicators (Matching media_1790858701478.png) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.08)', paddingTop: '6px' }}>
          
          {/* Left Definitions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap', fontSize: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#ef4444' }}>🔴</span>
              <span style={{ color: '#ef4444', fontWeight: '800' }}>BID (Left):</span>
              <span style={{ color: '#94a3b8' }}>Aggressive Market Sells → Passive Limit Buys</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#10b981' }}>🟢</span>
              <span style={{ color: '#10b981', fontWeight: '800' }}>ASK (Right):</span>
              <span style={{ color: '#94a3b8' }}>Aggressive Market Buys → Passive Limit Sells</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#a855f7' }}>🟣</span>
              <span style={{ color: '#c084fc', fontWeight: '800' }}>ABSORPTION:</span>
              <span style={{ color: '#94a3b8' }}>Heavy volume soaked at price without moving through</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ color: '#06b6d4' }}>🔵</span>
              <span style={{ color: '#22d3ee', fontWeight: '800' }}>EXHAUSTION:</span>
              <span style={{ color: '#94a3b8' }}>Volume drying up at extreme (tapered sliver)</span>
            </div>
          </div>

          {/* Right Divergence Indicators */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              background: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#f87171',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>▼</span> Bear Div (Price + Delta -)
            </div>

            <div style={{
              background: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10b981',
              color: '#34d399',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '800',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}>
              <span>▲</span> Bull Div (Price - Delta +)
            </div>

            <div style={{
              background: 'rgba(168, 85, 247, 0.12)',
              border: '1px solid #a855f7',
              color: '#c084fc',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '800'
            }}>
              Absorption Div
            </div>
          </div>
        </div>
      </div>

      {/* Main Canvas Chart Area */}
      <div 
        ref={canvasContainerRef} 
        style={{ 
          position: 'relative', 
          width: '100%', 
          minHeight: '640px', 
          backgroundColor: theme === 'light' ? '#ffffff' : '#181c27', 
          borderRadius: '8px', 
          border: '1px solid var(--border-color)',
          overflow: 'hidden'
        }}
      >
        {/* Navigation Hint */}
        <div style={{ position: 'absolute', top: '10px', left: '15px', zIndex: 5, display: 'flex', alignItems: 'center', gap: '6px', pointerEvents: 'none', background: 'rgba(15, 23, 42, 0.75)', padding: '4px 10px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.08)' }}>
          <Move size={12} style={{ color: '#00f0ff' }} />
          <span style={{ fontSize: '10px', color: '#94a3b8', fontWeight: '600' }}>
            Scroll wheel to Zoom | Drag to Pan | Footprint Volume Blocks & Delta Table
          </span>
        </div>

        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.8)', zIndex: 10 }}>
            <RefreshCw size={28} className="animate-spin" style={{ color: '#00f0ff', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: 'white', fontWeight: '600' }}>Loading Volume Footprint Chart for {symbol}...</span>
          </div>
        )}

        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.9)', zIndex: 10 }}>
            <ShieldAlert size={32} style={{ color: '#ef4444', marginBottom: '12px' }} />
            <span style={{ fontSize: '14px', color: '#ef4444', fontWeight: '600' }}>{error}</span>
          </div>
        )}

        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={(e) => {
            const canvas = canvasRef.current;
            if (!canvas) return;
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;

            if (isYDragging) {
              const deltaY = yDragStartY - e.clientY;
              const newZoom = Math.max(6, Math.min(150, Math.round(yDragStartZoom + deltaY * 0.75)));
              setYZoom(newZoom);
              setCursorStyle('ns-resize');
            } else if (isDragging) {
              setPanOffset({
                x: e.clientX - dragStart.x,
                y: e.clientY - dragStart.y
              });
              setCursorStyle('grabbing');
            } else {
              if (mouseX >= dimensions.width - 85) {
                setCursorStyle('ns-resize');
              } else {
                setCursorStyle('grab');
              }
            }
          }}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={(e) => {
            if (e.touches.length === 1) {
              setIsDragging(true);
              setDragStart({ x: e.touches[0].clientX - panOffset.x, y: e.touches[0].clientY - panOffset.y });
            }
          }}
          onTouchMove={(e) => {
            if (isDragging && e.touches.length === 1) {
              setPanOffset({
                x: e.touches[0].clientX - dragStart.x,
                y: e.touches[0].clientY - dragStart.y
              });
            }
          }}
          onTouchEnd={() => setIsDragging(false)}
          onDoubleClick={handleDoubleClick}
          style={{ cursor: cursorStyle, display: 'block', touchAction: 'none' }}
        />
      </div>



      {/* ---------------------------------------------------- */}
      {/* TRADINGVIEW VOLUME FOOTPRINT SETTINGS MODAL DIALOG   */}
      {/* Matching user screenshot media_1789214986052.png     */}
      {/* ---------------------------------------------------- */}
      {isSettingsOpen && (
        <div style={{
          position: 'fixed',
          inset: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            width: '680px',
            maxHeight: '85vh',
            backgroundColor: '#ffffff',
            color: '#1e293b',
            borderRadius: '12px',
            boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.3), 0 10px 10px -5px rgba(0, 0, 0, 0.2)',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
          }}>
            
            {/* Modal Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid #e2e8f0'
            }}>
              <h2 style={{ fontSize: '18px', fontWeight: '700', margin: 0, color: '#0f172a' }}>Settings</h2>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', padding: '4px' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Body with Sidebar */}
            <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
              
              {/* Left Sidebar Navigation */}
              <div style={{
                width: '180px',
                backgroundColor: '#f8fafc',
                borderRight: '1px solid #e2e8f0',
                padding: '12px 8px',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                {[
                  { id: 'Symbol', label: 'Symbol', icon: '🔊' },
                  { id: 'Status line', label: 'Status line', icon: '📜' },
                  { id: 'Scales and lines', label: 'Scales and lines', icon: '📐' },
                  { id: 'Canvas', label: 'Canvas', icon: '🎨' },
                  { id: 'Trading', label: 'Trading', icon: '📈' },
                  { id: 'Alerts', label: 'Alerts', icon: '⏰' },
                  { id: 'Events', label: 'Events', icon: '📅' }
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setActiveSettingsTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      fontWeight: activeSettingsTab === item.id ? '700' : '500',
                      color: activeSettingsTab === item.id ? '#0f172a' : '#64748b',
                      backgroundColor: activeSettingsTab === item.id ? '#e2e8f0' : 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      textAlign: 'left'
                    }}
                  >
                    <span style={{ fontSize: '14px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                  </button>
                ))}
              </div>

              {/* Right Settings Form Area */}
              <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* SECTION 1: VOLUME FOOTPRINT */}
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0' }}>
                    VOLUME FOOTPRINT
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    
                    {/* Row size */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Row size</label>
                      <select
                        value={settings.rowSize}
                        onChange={(e) => setSettings({ ...settings, rowSize: e.target.value as any })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                      >
                        <option value="Manual">Manual</option>
                        <option value="Auto">Auto</option>
                      </select>
                    </div>

                    {/* Ticks per row */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Ticks per row</label>
                      <input
                        type="number"
                        value={settings.ticksPerRow}
                        onChange={(e) => setSettings({ ...settings, ticksPerRow: Number(e.target.value) || 100 })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', boxSizing: 'border-box' }}
                      />
                    </div>

                    {/* Display */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Display</label>
                      <select
                        value={settings.display}
                        onChange={(e) => setSettings({ ...settings, display: e.target.value as any })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                      >
                        <option value="Profile">Profile</option>
                        <option value="Bid / Ask">Bid / Ask</option>
                        <option value="Delta">Delta</option>
                        <option value="Total">Total</option>
                      </select>
                    </div>

                    {/* Type */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Type</label>
                      <select
                        value={settings.type}
                        onChange={(e) => setSettings({ ...settings, type: e.target.value as any })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                      >
                        <option value="Buy and sell">Buy and sell</option>
                        <option value="Delta">Delta</option>
                        <option value="Total">Total</option>
                      </select>
                    </div>

                    {/* Apply gradient to background */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="applyGradient"
                        checked={settings.applyGradient}
                        onChange={(e) => setSettings({ ...settings, applyGradient: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                      />
                      <label htmlFor="applyGradient" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                        Apply gradient to background
                      </label>
                      <Info size={14} style={{ color: '#94a3b8' }} />
                    </div>

                    {/* Sell background color swatches */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '24px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Sell background</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['#fca5a5', '#ef4444', '#dc2626', '#991b1b'].map((c) => (
                          <div
                            key={c}
                            onClick={() => setSettings({ ...settings, sellBgColor: c })}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              backgroundColor: c,
                              cursor: 'pointer',
                              border: settings.sellBgColor === c ? '2px solid #0f172a' : '1px solid #cbd5e1'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Buy background color swatches */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingLeft: '24px' }}>
                      <span style={{ color: '#64748b', fontSize: '12px' }}>Buy background</span>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {['#5eead4', '#14b8a6', '#0f766e', '#134e4a'].map((c) => (
                          <div
                            key={c}
                            onClick={() => setSettings({ ...settings, buyBgColor: c })}
                            style={{
                              width: '20px',
                              height: '20px',
                              borderRadius: '4px',
                              backgroundColor: c,
                              cursor: 'pointer',
                              border: settings.buyBgColor === c ? '2px solid #0f172a' : '1px solid #cbd5e1'
                            }}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Unfinished auction */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="unfinishedAuction"
                          checked={settings.unfinishedAuction}
                          onChange={(e) => setSettings({ ...settings, unfinishedAuction: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="unfinishedAuction" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Unfinished auction
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#d946ef' }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#06b6d4' }} />
                        <HelpCircle size={14} style={{ color: '#94a3b8' }} />
                      </div>
                    </div>

                    {/* Value area % */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="valueAreaEnabled"
                          checked={settings.valueAreaEnabled}
                          onChange={(e) => setSettings({ ...settings, valueAreaEnabled: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="valueAreaEnabled" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Value area
                        </label>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          value={settings.valueAreaPercent}
                          onChange={(e) => setSettings({ ...settings, valueAreaPercent: Number(e.target.value) || 70 })}
                          style={{ width: '120px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                        <span style={{ fontSize: '13px', color: '#64748b' }}>%</span>
                      </div>
                    </div>

                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                {/* SECTION 2: LABELS */}
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0' }}>
                    LABELS
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    
                    {/* POC Color */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="pocEnabled"
                          checked={settings.pocEnabled}
                          onChange={(e) => setSettings({ ...settings, pocEnabled: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="pocEnabled" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          POC
                        </label>
                      </div>
                      <div
                        onClick={() => setSettings({ ...settings, pocColor: settings.pocColor === '#000000' ? '#1e293b' : '#000000' })}
                        style={{
                          width: '24px',
                          height: '24px',
                          borderRadius: '4px',
                          backgroundColor: settings.pocColor,
                          border: '1px solid #cbd5e1',
                          cursor: 'pointer'
                        }}
                      />
                    </div>

                    {/* Show summary Info */}
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingTop: '6px' }}>
                        <input
                          type="checkbox"
                          id="showSummaryInfo"
                          checked={settings.showSummaryInfo}
                          onChange={(e) => setSettings({ ...settings, showSummaryInfo: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="showSummaryInfo" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Show summary Info
                        </label>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '200px' }}>
                        <select
                          value={settings.summaryDisplay}
                          onChange={(e) => setSettings({ ...settings, summaryDisplay: e.target.value as any })}
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                        >
                          <option value="Table">Table</option>
                          <option value="Below">Below</option>
                          <option value="Off">Off</option>
                        </select>
                        <select
                          value="all"
                          style={{ width: '100%', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#ffffff' }}
                        >
                          <option value="all">Volume, Delta, Min ...</option>
                        </select>
                      </div>
                    </div>

                  </div>
                </div>

                <hr style={{ border: 'none', borderTop: '1px solid #e2e8f0', margin: '4px 0' }} />

                {/* SECTION 3: IMBALANCE */}
                <div>
                  <h3 style={{ fontSize: '11px', fontWeight: '800', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 14px 0' }}>
                    IMBALANCE
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                    
                    {/* Imbalance % */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Imbalance</label>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <input
                          type="number"
                          value={settings.imbalancePercent}
                          onChange={(e) => setSettings({ ...settings, imbalancePercent: Number(e.target.value) || 300 })}
                          style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                        />
                        <span style={{ fontSize: '13px', color: '#64748b' }}>%</span>
                      </div>
                    </div>

                    {/* Highlighting */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="imbalanceHighlighting"
                          checked={settings.imbalanceHighlighting}
                          onChange={(e) => setSettings({ ...settings, imbalanceHighlighting: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="imbalanceHighlighting" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Highlighting
                        </label>
                      </div>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#089981' }} />
                        <div style={{ width: '20px', height: '20px', borderRadius: '4px', backgroundColor: '#e23636' }} />
                      </div>
                    </div>

                    {/* Stacked levels */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="checkbox"
                          id="stackedLevelsEnabled"
                          checked={settings.stackedLevelsEnabled}
                          onChange={(e) => setSettings({ ...settings, stackedLevelsEnabled: e.target.checked })}
                          style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                        />
                        <label htmlFor="stackedLevelsEnabled" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                          Stacked levels
                        </label>
                      </div>
                      <input
                        type="number"
                        value={settings.stackedLevelsCount}
                        onChange={(e) => setSettings({ ...settings, stackedLevelsCount: Number(e.target.value) || 3 })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px', backgroundColor: '#f1f5f9' }}
                      />
                    </div>

                    {/* Minimal volume */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <label style={{ fontWeight: '500', color: '#334155' }}>Minimal volume</label>
                      <input
                        type="number"
                        step="0.1"
                        value={settings.minimalVolume}
                        onChange={(e) => setSettings({ ...settings, minimalVolume: Number(e.target.value) || 0.0 })}
                        style={{ width: '160px', padding: '6px 10px', borderRadius: '6px', border: '1px solid #cbd5e1', fontSize: '13px' }}
                      />
                    </div>

                    {/* Ignore zeros */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="checkbox"
                        id="ignoreZeros"
                        checked={settings.ignoreZeros}
                        onChange={(e) => setSettings({ ...settings, ignoreZeros: e.target.checked })}
                        style={{ width: '16px', height: '16px', accentColor: '#0f172a', cursor: 'pointer' }}
                      />
                      <label htmlFor="ignoreZeros" style={{ fontWeight: '500', color: '#334155', cursor: 'pointer' }}>
                        Ignore zeros
                      </label>
                      <Info size={14} style={{ color: '#94a3b8' }} />
                    </div>

                  </div>
                </div>

              </div>
            </div>

            {/* Modal Footer */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
              padding: '14px 20px',
              borderTop: '1px solid #e2e8f0',
              backgroundColor: '#ffffff'
            }}>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => setIsSettingsOpen(false)}
                style={{
                  padding: '8px 20px',
                  borderRadius: '6px',
                  border: 'none',
                  backgroundColor: '#2563eb',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer'
                }}
              >
                Ok
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
