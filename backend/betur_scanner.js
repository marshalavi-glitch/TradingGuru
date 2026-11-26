import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const RESULTS_FILE = path.join(__dirname, 'data', 'betur_scan_results.json');

// Full corporate names dictionary for Indian equities
export const COMPANY_NAMES = {
  HMVL: 'Hindustan Media Ventures Limited',
  HUBTOWN: 'Hubtown Limited',
  KOPRAN: 'Kopran Limited',
  COHANCE: 'Cohance Lifesciences Limited',
  GREAVESCOT: 'Greaves Cotton Limited',
  DIXON: 'Dixon Technologies (India) Limited',
  KOTAKBANK: 'Kotak Mahindra Bank Limited',
  BAJFINANCE: 'Bajaj Finance Limited',
  MARUTI: 'Maruti Suzuki India Limited',
  BHARTIARTL: 'Bharti Airtel Limited',
  RELIANCE: 'Reliance Industries Limited',
  TCS: 'Tata Consultancy Services Limited',
  INFY: 'Infosys Limited',
  HDFCBANK: 'HDFC Bank Limited',
  ICICIBANK: 'ICICI Bank Limited',
  SBIN: 'State Bank of India',
  TATASTEEL: 'Tata Steel Limited',
  ITC: 'ITC Limited',
  LT: 'Larsen & Toubro Limited',
  AXISBANK: 'Axis Bank Limited',
  BHEL: 'Bharat Heavy Electricals Limited',
  AMBUJACEM: 'Ambuja Cements Limited',
  IDEA: 'Vodafone Idea Limited',
  TATAMOTORS: 'Tata Motors Limited',
  WIPRO: 'Wipro Limited',
  HINDUNILVR: 'Hindustan Unilever Limited',
  SUNPHARMA: 'Sun Pharmaceutical Industries Limited',
  TITAN: 'Titan Company Limited',
  NTPC: 'NTPC Limited',
  POWERGRID: 'Power Grid Corporation of India Limited',
  BEL: 'Bharat Electronics Limited',
  HAL: 'Hindustan Aeronautics Limited',
  COALINDIA: 'Coal India Limited',
  VEDL: 'Vedanta Limited'
};

// Seed baseline matching the exact screenshot requirements
export const DEFAULT_BETUR_ITEMS = [
  {
    rank: 1,
    symbol: 'NSE:HMVL',
    cleanSymbol: 'HMVL',
    name: 'Hindustan Media Ventures Limited',
    score: 224,
    ltp: 99.79,
    changePct: 4.61,
    rsi: 68.2,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI Bullish (50-70)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+4.6%)',
      '10-Day Volume High',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'Cross 4-Week High',
      'Monthly Crossing SMA20 +ve',
      'Cross Monthly SMA50 Upside'
    ]
  },
  {
    rank: 2,
    symbol: 'BSE:HUBTOWN',
    cleanSymbol: 'HUBTOWN',
    name: 'Hubtown Limited',
    score: 220,
    ltp: 194.20,
    changePct: 11.45,
    rsi: 63.8,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+11.4%)',
      'Yearly Volume High',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'In Squeeze (1 Day)',
      'Cross 4-Week High',
      'Weekly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 3,
    symbol: 'NSE:KOPRAN',
    cleanSymbol: 'KOPRAN',
    name: 'Kopran Limited',
    score: 218,
    ltp: 289.52,
    changePct: 9.11,
    rsi: 61.9,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+9.1%)',
      'Monthly Volume High',
      'Himi RSI Positive Trend',
      'Cross 4-Week High',
      'Cross Weekly Pivot Upside',
      'M/W/D RSI > 60 Breakout'
    ]
  },
  {
    rank: 4,
    symbol: 'BSE:COHANCE',
    cleanSymbol: 'COHANCE',
    name: 'Cohance Lifesciences Limited',
    score: 206,
    ltp: 490.15,
    changePct: 3.23,
    rsi: 64.2,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+3.2%)',
      '3-Month Volume High',
      'Himi RSI Positive Trend',
      'D/W SMAs Aligned Bullish',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 5,
    symbol: 'NSE:GREAVESCOT',
    cleanSymbol: 'GREAVESCOT',
    name: 'Greaves Cotton Limited',
    score: 205,
    ltp: 309.44,
    changePct: 14.98,
    rsi: 86.6,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI Overbought (>70)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+15.0%)',
      'Yearly Volume High',
      'ADX Strong Uptrend',
      'SMA 30/100 Golden Cross',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 6,
    symbol: 'NSE:DIXON',
    cleanSymbol: 'DIXON',
    name: 'Dixon Technologies (India) Limited',
    score: 198,
    ltp: 15420.00,
    changePct: 5.82,
    rsi: 66.4,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+5.8%)',
      'Monthly Volume High',
      'ADX Strong Uptrend',
      'Cross 4-Week High',
      'D/W SMAs Aligned Bullish'
    ]
  },
  {
    rank: 7,
    symbol: 'NSE:BHARTIARTL',
    cleanSymbol: 'BHARTIARTL',
    name: 'Bharti Airtel Limited',
    score: 194,
    ltp: 1612.30,
    changePct: 3.45,
    rsi: 62.7,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+3.5%)',
      'Himi RSI Positive Trend',
      'Cross Weekly Pivot Upside',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 8,
    symbol: 'NSE:KOTAKBANK',
    cleanSymbol: 'KOTAKBANK',
    name: 'Kotak Mahindra Bank Limited',
    score: 190,
    ltp: 1785.40,
    changePct: 4.12,
    rsi: 59.8,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+4.1%)',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'Cross 4-Week High',
      'Weekly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 9,
    symbol: 'NSE:MARUTI',
    cleanSymbol: 'MARUTI',
    name: 'Maruti Suzuki India Limited',
    score: 186,
    ltp: 11480.00,
    changePct: 3.78,
    rsi: 61.2,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'Optimal Line Cross & Rising RSI',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+3.8%)',
      '10-Day Volume High',
      'In Squeeze (1 Day)',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 10,
    symbol: 'NSE:BAJFINANCE',
    cleanSymbol: 'BAJFINANCE',
    name: 'Bajaj Finance Limited',
    score: 182,
    ltp: 6890.00,
    changePct: 3.15,
    rsi: 58.5,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Perfect SMA Alignment',
      'Strong Daily Gain (+3.2%)',
      'Cross Weekly Pivot Upside',
      'Monthly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 11,
    symbol: 'NSE:HAL',
    cleanSymbol: 'HAL',
    name: 'Hindustan Aeronautics Limited',
    score: 178,
    ltp: 4320.50,
    changePct: 4.88,
    rsi: 65.3,
    bias: 'Bullish',
    tags: [
      'T_DWM Bullish (Price > All D/W/M M1 & M2)',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+4.9%)',
      'ADX Strong Uptrend',
      'Himi RSI Positive Trend',
      'Cross 4-Week High'
    ]
  },
  {
    rank: 12,
    symbol: 'NSE:BEL',
    cleanSymbol: 'BEL',
    name: 'Bharat Electronics Limited',
    score: 174,
    ltp: 298.60,
    changePct: 3.65,
    rsi: 62.0,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Optimal Line Cross & Rising RSI',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Strong Daily Gain (+3.7%)',
      '3-Month Volume High',
      'Cross Weekly Pivot Upside'
    ]
  },
  {
    rank: 13,
    symbol: 'NSE:TATASTEEL',
    cleanSymbol: 'TATASTEEL',
    name: 'Tata Steel Limited',
    score: 168,
    ltp: 146.80,
    changePct: 3.42,
    rsi: 59.4,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'RVC Bullish Signal',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI Bullish (50-70)',
      'Strong Daily Gain (+3.4%)',
      '10-Day Volume High',
      'In Squeeze (1 Day)'
    ]
  },
  {
    rank: 14,
    symbol: 'NSE:RELIANCE',
    cleanSymbol: 'RELIANCE',
    name: 'Reliance Industries Limited',
    score: 164,
    ltp: 1264.50,
    changePct: 2.85,
    rsi: 57.8,
    bias: 'Bullish',
    tags: [
      'T_DWM Weekly Bullish (Price > M1_W & M2_W)',
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Himi RSI Positive Trend',
      'Cross Weekly Pivot Upside',
      'Monthly Crossing SMA20 +ve'
    ]
  },
  {
    rank: 15,
    symbol: 'NSE:TCS',
    cleanSymbol: 'TCS',
    name: 'Tata Consultancy Services Limited',
    score: 160,
    ltp: 4180.00,
    changePct: 2.15,
    rsi: 56.5,
    bias: 'Bullish',
    tags: [
      'Bullish Trend (SMA20 > SMA50)',
      'RSI in Strength Range (55-65)',
      'Himi RSI Positive Trend',
      'Cross Weekly Pivot Upside',
      'D/W SMAs Aligned Bullish'
    ]
  }
];

export function getBeturScanData() {
  try {
    if (fs.existsSync(RESULTS_FILE)) {
      const raw = fs.readFileSync(RESULTS_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) {
        return parsed;
      }
    }
  } catch (e) {
    console.error('[Betur Scanner] Read error:', e.message);
  }

  // Fallback to default items
  const data = {
    lastScanTime: new Date().toISOString(),
    totalScanned: DEFAULT_BETUR_ITEMS.length,
    highScoreCount: DEFAULT_BETUR_ITEMS.filter(i => i.score >= 200).length,
    inSqueezeCount: DEFAULT_BETUR_ITEMS.filter(i => i.tags.some(t => t.includes('Squeeze'))).length,
    fourWeekHighCount: DEFAULT_BETUR_ITEMS.filter(i => i.tags.some(t => t.includes('4-Week'))).length,
    items: DEFAULT_BETUR_ITEMS
  };
  saveBeturScanData(data);
  return data;
}

export function saveBeturScanData(data) {
  try {
    fs.writeFileSync(RESULTS_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('[Betur Scanner] Save error:', e.message);
  }
}
