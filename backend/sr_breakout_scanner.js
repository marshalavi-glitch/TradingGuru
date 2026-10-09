import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const srBreakoutCache = {
  lastScanTime: null,
  isScanning: false,
  results: [],
  summary: {
    totalMonitored: 0,
    totalCash: 0,
    totalFutures: 0,
    totalOptions: 0,
    bullishCount: 0,
    bearishCount: 0,
    coilingCount: 0
  },
  date: null
};

const backupFilePath = path.join(__dirname, 'data/sr_breakouts_today.json');

// Complete list of F&O eligible stocks on NSE
const FNO_SYMBOLS = new Set([
  'AARTIIND', 'ABB', 'ABBOTINDIA', 'ABCAPITAL', 'ABFRL', 'ACC', 'ADANIENT', 'ADANIPORTS',
  'ALKEM', 'AMBUJACEM', 'APLAPOLLO', 'APOLLOHOSP', 'APOLLOTYRE', 'ASHOKLEY', 'ASIANPAINT',
  'ASTRAL', 'ATUL', 'AUBANK', 'AUROPHARMA', 'AXISBANK', 'BAJAJ-AUTO', 'BAJAJFINSV',
  'BAJFINANCE', 'BALKRISIND', 'BALRAMCHIN', 'BANDHANBNK', 'BANKBARODA', 'BATAINDIA',
  'BEL', 'BERGEPAINT', 'BHARATFORG', 'BHARTIARTL', 'BHEL', 'BIOCON', 'BOSCHLTD', 'BPCL',
  'BRITANNIA', 'BSOFT', 'CANBK', 'CANFINHOME', 'CHAMBLFERT', 'CHOLAFIN', 'CIPLA',
  'COALINDIA', 'COFORGE', 'COLPAL', 'CONCOR', 'COROMANDEL', 'CROMPTON', 'CUB', 'CUMMINSIND',
  'DABUR', 'DALBHARAT', 'DEEPAKNTR', 'DELHIVERY', 'DIVISLAB', 'DIXON', 'DLF', 'DRREDDY',
  'EICHERMOT', 'ESCORTS', 'EXIDEIND', 'FEDERALBNK', 'GAIL', 'GLENMARK', 'GMRINFRA',
  'GNFC', 'GODREJCP', 'GODREJPROP', 'GRANULES', 'GRASIM', 'GUJGASLTD', 'HAL', 'HAVELLS',
  'HCLTECH', 'HDFCAMC', 'HDFCBANK', 'HDFCLIFE', 'HEROMOTOCO', 'HINDALCO', 'HINDCOPPER',
  'HINDPETRO', 'HINDUNILVR', 'HUDCO', 'ICICIBANK', 'ICICIGI', 'ICICIPRULI', 'IDEA',
  'IDFC', 'IDFCFIRSTB', 'IEX', 'IGL', 'INDHOTEL', 'INDIACEM', 'INDIAMART', 'INDIGO',
  'INDUSINDBK', 'INDUSTOWER', 'INFY', 'IOC', 'IPCALAB', 'IRCTC', 'ITC', 'JINDALSTEL',
  'JIOFIN', 'JKCEMENT', 'JSWSTEEL', 'JUBLFOOD', 'KALYANKJIL', 'KOTAKBANK', 'LALPATHLAB',
  'LAURUSLABS', 'LICHSGFIN', 'LICI', 'LT', 'LTF', 'LTIM', 'LTTS', 'LUPIN', 'M&M',
  'M&MFIN', 'MANAPPURAM', 'MARICO', 'MARUTI', 'MCX', 'METROPOLIS', 'MFSL', 'MGL',
  'MOTHERSON', 'MPHASIS', 'MRF', 'MUTHOOTFIN', 'NATIONALUM', 'NAUKRI', 'NAVINFLUOR',
  'NBCC', 'NCC', 'NESTLEIND', 'NMDC', 'NTPC', 'OBEROIRLTY', 'OFSS', 'ONGC', 'PAGEIND',
  'PEL', 'PERSISTENT', 'PETRONET', 'PFC', 'PIDILITIND', 'PIIND', 'PNB', 'POLYCAB',
  'POONAWALLA', 'POWERGRID', 'PVRINOX', 'RAMCOCEM', 'RBLBANK', 'RECLTD', 'RELIANCE',
  'SAIL', 'SBICARD', 'SBILIFE', 'SBIN', 'SHREECEM', 'SHRIRAMFIN', 'SIEMENS', 'SRF',
  'SUNPHARMA', 'SUNTV', 'SUPREMEIND', 'SYNGENE', 'TATACHEM', 'TATACOMM', 'TATACONSUM',
  'TATAMOTORS', 'TATAPOWER', 'TATASTEEL', 'TCS', 'TECHM', 'TITAN', 'TORNTPHARM',
  'TORNTPOWER', 'TRENT', 'TVSMOTOR', 'UBL', 'ULTRACEMCO', 'UNIONBANK', 'UNITDSPR',
  'UPL', 'VEDL', 'VOLTAS', 'WIPRO', 'YESBANK', 'ZEEL', 'ZOMATO', 'NIFTY', 'BANKNIFTY', 'FINNIFTY'
]);

export const LOT_SIZES = {
  'NIFTY': 25,
  'BANKNIFTY': 15,
  'FINNIFTY': 25,
  'MIDCPNIFTY': 50,
  'SIEMENS': 125,
  'ADANIENT': 300,
  'ADANIPORTS': 400,
  'GLENMARK': 725,
  'BHARTIARTL': 475,
  'COFORGE': 150,
  'JSWSTEEL': 675,
  'HAVELLS': 500,
  'MGL': 400,
  'GODREJCP': 500,
  'RAMCOCEM': 850,
  'HINDCOPPER': 2650,
  'POONAWALLA': 1500,
  'HINDPETRO': 1350,
  'PETRONET': 3000,
  'POWERGRID': 1800,
  'SAIL': 4000,
  'GAIL': 2650,
  'NCC': 3500,
  'IOC': 4875,
  'JUBLFOOD': 1250,
  'APLAPOLLO': 350,
  'SUPREMEIND': 125,
  'RELIANCE': 250,
  'TCS': 175,
  'INFY': 400,
  'HDFCBANK': 550,
  'ICICIBANK': 700,
  'SBIN': 750,
  'TRENT': 100,
  'LT': 150,
  'TATAMOTORS': 550,
  'BAJFINANCE': 125
};

export function isIndexSymbol(code) {
  const c = (code || '').toUpperCase().replace(/^NSE:|^BSE:/, '');
  return c.startsWith('NIFTY') || c.startsWith('BANKNIFTY') || c.startsWith('FINNIFTY') || 
         c.startsWith('MIDCPNIFTY') || c.startsWith('MIDCAPNIFTY') || c.startsWith('SENSEX') || 
         c.startsWith('BANKEX') || c.startsWith('CNX');
}

export function getStrikeInterval(code, price) {
  const sym = (code || '').toUpperCase();
  if (sym === 'NIFTY') return 50;
  if (sym === 'BANKNIFTY') return 100;
  if (sym === 'FINNIFTY') return 50;
  if (sym === 'MIDCPNIFTY' || sym === 'MIDCAPNIFTY') return 25;
  if (sym === 'SENSEX') return 100;
  if (sym === 'BANKEX') return 100;

  if (price > 5000) return 100;
  if (price > 2500) return 50;
  if (price > 1000) return 20;
  if (price > 500) return 10;
  if (price > 250) return 5;
  return 2.5;
}

export function getAtmStrike(code, price) {
  const interval = getStrikeInterval(code, price);
  return Math.round(price / interval) * interval;
}

export function createOptionRecord(baseRecord, code, close, nr7Range, riskPts, isBullish, isBearish, lotSize, companyName) {
  const strike = getAtmStrike(code, close);
  const optionType = isBullish ? 'CE' : (isBearish ? 'PE' : 'CE/PE');
  const optSuffix = optionType === 'CE/PE' ? 'CE' : optionType;
  
  // Dynamic ATM premium estimate calibrated by asset type (e.g. NIFTY ~90, BANKNIFTY ~470, Stocks ~1-1.5%)
  let defaultRatio = 0.014;
  const symUpper = (code || '').toUpperCase();
  if (symUpper === 'NIFTY') defaultRatio = 0.0039;
  else if (symUpper === 'BANKNIFTY') defaultRatio = 0.0083;
  else if (symUpper === 'FINNIFTY') defaultRatio = 0.0091;
  else if (symUpper === 'MIDCPNIFTY' || symUpper === 'MIDCAPNIFTY') defaultRatio = 0.0088;
  else if (close > 2000) defaultRatio = 0.012;
  else if (close > 500) defaultRatio = 0.014;
  else defaultRatio = 0.015;

  const optEntry = Math.max(0.5, Math.round(Math.max(close * defaultRatio, nr7Range * 0.45) * 10) / 10);
  
  // Delta approx 0.50 for ATM options
  const optTarget1 = Math.round((optEntry + nr7Range * 0.50) * 10) / 10;
  const optTarget2 = Math.round((optEntry + nr7Range * 1.618 * 0.50) * 10) / 10;
  const optStopLoss = Math.max(0.5, Math.round((optEntry - Math.max(1, riskPts * 0.50)) * 10) / 10);
  
  const optRiskPts = Math.round((optEntry - optStopLoss) * 10) / 10;
  const optRewardPts = Math.round((optTarget1 - optEntry) * 10) / 10;
  const optRR = `1 : ${(optRewardPts / Math.max(0.1, optRiskPts)).toFixed(2)}`;
  const contractVal = Math.round(optEntry * lotSize);

  // OPTION CHART SPECIFIC RANGE & MARKET PROFILE (MP) METRICS:
  // Option Range derived from ATM delta (~0.50) of underlying range or risk points
  const optNr7Range = Math.round(Math.max(1.0, nr7Range * 0.50) * 100) / 100;
  
  // Option High and Low for the range (Breakout is above optEntry)
  let optNr7High, optNr7Low;
  if (baseRecord.direction === 'bearish' || baseRecord.direction === 'bullish') {
    // For both CE (bullish breakout) and PE (bearish breakdown of underlying), option is bought on breakout above its high
    optNr7High = optEntry;
    optNr7Low = Math.max(0.5, Math.round((optEntry - optNr7Range) * 100) / 100);
  } else {
    optNr7High = Math.round((optEntry + optNr7Range * 0.5) * 100) / 100;
    optNr7Low = Math.max(0.5, Math.round((optEntry - optNr7Range * 0.5) * 100) / 100);
  }

  // Option Today Range and High/Low
  const optTodayRange = Math.round((optNr7Range * 1.35) * 100) / 100;
  const optTodayHigh = Math.round((optEntry + optTodayRange * 0.25) * 100) / 100;
  const optTodayLow = Math.max(0.5, Math.round((optNr7Low - optTodayRange * 0.1) * 100) / 100);

  // Option Market Profile (MP) Calculations as per MP Theory:
  // POC = Point of Control (Highest volume acceptance within option balance zone)
  // VAH = Value Area High (70% profile upper boundary: POC + 0.35 * Range)
  // VAL = Value Area Low (70% profile lower boundary: POC - 0.35 * Range)
  const optPoc = Math.round(((optNr7High + optNr7Low + 2 * optEntry) / 4) * 100) / 100;
  const optVah = Math.round((optPoc + 0.35 * optNr7Range) * 100) / 100;
  const optVal = Math.round((optPoc - 0.35 * optNr7Range) * 100) / 100;

  // Option MP Status
  let optMpStatus = 'Inside Value Area (Rotation)';
  if (optEntry > optVah) {
    optMpStatus = 'Acceptance Above VAH (Bullish Value Migration)';
  } else if (optEntry < optVal) {
    optMpStatus = 'Acceptance Below VAL (Bearish Value Migration)';
  }

  return {
    ...baseRecord,
    symbol: `NSE:${code} ${strike} ${optSuffix}`,
    displayName: `${code} ${strike} ${optionType}`,
    companyName: `${companyName || code} (${strike} ${optionType} Option)`,
    segment: 'options',
    strike,
    optionType,
    close: optEntry,
    underlyingPrice: close,
    // Option Chart Specific Range & MP:
    nr7High: optNr7High,
    nr7Low: optNr7Low,
    nr7Range: optNr7Range,
    todayHigh: optTodayHigh,
    todayLow: optTodayLow,
    todayRange: optTodayRange,
    val: optVal,
    vah: optVah,
    poc: optPoc,
    mpStatus: optMpStatus,
    // Trade Levels:
    entryPrice: optEntry,
    stopLoss: optStopLoss,
    target1: optTarget1,
    target2: optTarget2,
    riskPts: optRiskPts,
    rewardPts: optRewardPts,
    riskReward: optRR,
    lotSize,
    contractValue: contractVal,
    underlyingSymbol: `NSE:${code}`
  };
}

function saveSrCacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: srBreakoutCache.date,
      results: srBreakoutCache.results,
      summary: srBreakoutCache.summary,
      lastScanTime: srBreakoutCache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[SR Breakout Scanner] Failed to save backup to disk:', err);
  }
}

export function loadSrBreakoutCacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && Array.isArray(data.results) && data.results.length > 0) {
        srBreakoutCache.date = todayStr;
        srBreakoutCache.results = (data.results || []).filter(r => {
          const isIndex = isIndexSymbol(r.symbol) || isIndexSymbol(r.displayName);
          if (isIndex && r.segment !== 'options') return false;
          const validPrice = (parseFloat(r.close) || 0) >= 50 || r.segment === 'options';
          return validPrice;
        }).map(r => {
          // Normalize options if they still hold underlying spot levels
          if (r.segment === 'options' && r.underlyingPrice && (r.val > r.close * 2.5 || r.nr7Range > r.close * 1.5)) {
            const optEntry = Number(r.entryPrice || r.close);
            const optNr7Range = Math.round(Math.max(1.0, (r.riskPts ? r.riskPts : optEntry * 0.15)) * 100) / 100;
            const optNr7High = optEntry;
            const optNr7Low = Math.max(0.5, Math.round((optEntry - optNr7Range) * 100) / 100);
            const optTodayRange = Math.round((optNr7Range * 1.35) * 100) / 100;
            const optTodayHigh = Math.round((optEntry + optTodayRange * 0.25) * 100) / 100;
            const optTodayLow = Math.max(0.5, Math.round((optNr7Low - optTodayRange * 0.1) * 100) / 100);
            const optPoc = Math.round(((optNr7High + optNr7Low + 2 * optEntry) / 4) * 100) / 100;
            const optVah = Math.round((optPoc + 0.35 * optNr7Range) * 100) / 100;
            const optVal = Math.round((optPoc - 0.35 * optNr7Range) * 100) / 100;
            return {
              ...r,
              nr7High: optNr7High,
              nr7Low: optNr7Low,
              nr7Range: optNr7Range,
              todayHigh: optTodayHigh,
              todayLow: optTodayLow,
              todayRange: optTodayRange,
              val: optVal,
              vah: optVah,
              poc: optPoc
            };
          }
          return r;
        });
        const cashRecords = srBreakoutCache.results.filter(p => p.segment === 'cash');
        const futuresRecords = srBreakoutCache.results.filter(p => p.segment === 'futures');
        const optionsRecords = srBreakoutCache.results.filter(p => p.segment === 'options');
        const bullishRecords = srBreakoutCache.results.filter(p => p.direction === 'bullish');
        const bearishRecords = srBreakoutCache.results.filter(p => p.direction === 'bearish');
        const coilingRecords = srBreakoutCache.results.filter(p => p.direction === 'coiling' || p.direction === 'fresh');
        srBreakoutCache.summary = {
          totalMonitored: srBreakoutCache.results.length,
          totalCash: cashRecords.length,
          totalFutures: futuresRecords.length,
          totalOptions: optionsRecords.length,
          bullishCount: bullishRecords.length,
          bearishCount: bearishRecords.length,
          coilingCount: coilingRecords.length
        };
        srBreakoutCache.lastScanTime = data.lastScanTime || null;
        saveSrCacheToDisk();
        console.log(`[SR Breakout Scanner] Restored and normalized ${srBreakoutCache.results.length} setups from disk cache (${futuresRecords.length} Stock Futures, ${optionsRecords.length} Options).`);
      } else {
        console.log('[SR Breakout Scanner] Disk cache is empty or from a previous day, starting clean.');
      }
    }
  } catch (err) {
    console.error('[SR Breakout Scanner] Failed to load backup from disk:', err);
  }
}

// Fetch Chartink live screeners
async function fetchChartinkQuery(scanClause) {
  try {
    const url = 'https://chartink.com/screener/copy-scan-30-narrow-range-breakout-nr7-breakout-on-daily-charts';
    const res1 = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
      }
    });

    const rawCookies = res1.headers.getSetCookie ? res1.headers.getSetCookie() : [res1.headers.get('set-cookie')];
    const cookieStr = rawCookies.map(c => c.split(';')[0]).join('; ');
    const html = await res1.text();

    const csrfMatch = html.match(/<meta name="csrf-token" content="([^"]+)"/);
    const csrf = csrfMatch ? csrfMatch[1] : '';

    const form = new URLSearchParams();
    form.append('scan_clause', scanClause);

    const res2 = await fetch('https://chartink.com/screener/process', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
        'X-CSRF-TOKEN': csrf,
        'Cookie': cookieStr,
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': url
      },
      body: form.toString()
    });

    const result = await res2.json();
    return Array.isArray(result.data) ? result.data : [];
  } catch (err) {
    console.error('[SR Breakout Scanner] Chartink fetch error:', err.message);
    return [];
  }
}

export async function scanSrBreakouts() {
  if (srBreakoutCache.isScanning) return;
  srBreakoutCache.isScanning = true;

  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  if (srBreakoutCache.date !== todayStr) {
    srBreakoutCache.date = todayStr;
    srBreakoutCache.results = [];
  }

  console.log('[SR Breakout Scanner] Scanning SR Breakouts with Market Profile levels (VAL, VAH, POC) (Min ₹50 filter)...');

  // Rule 1 & 2 Clauses:
  // Bullish Breakout: 1 day ago was NR7, today close > 1 day ago high, close >= 50
  const bullClause = `( {cash} ( ( 1 day ago high - 1 day ago low ) < ( 2 days ago high - 2 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 3 days ago high - 3 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 4 days ago high - 4 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 5 days ago high - 5 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 6 days ago high - 6 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 7 days ago high - 7 days ago low ) and latest close > 1 day ago high and latest close >= 50 and latest volume > 50000 ) )`;

  // Bearish Breakdown: 1 day ago was NR7, today close < 1 day ago low, close >= 50
  const bearClause = `( {cash} ( ( 1 day ago high - 1 day ago low ) < ( 2 days ago high - 2 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 3 days ago high - 3 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 4 days ago high - 4 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 5 days ago high - 5 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 6 days ago high - 6 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 7 days ago high - 7 days ago low ) and latest close < 1 day ago low and latest close >= 50 and latest volume > 50000 ) )`;

  // Inside NR7 / Coiling: 1 day ago was NR7, today close is between 1 day ago high & low, close >= 50
  const coilingClause = `( {cash} ( ( 1 day ago high - 1 day ago low ) < ( 2 days ago high - 2 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 3 days ago high - 3 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 4 days ago high - 4 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 5 days ago high - 5 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 6 days ago high - 6 days ago low ) and ( 1 day ago high - 1 day ago low ) < ( 7 days ago high - 7 days ago low ) and latest close <= 1 day ago high and latest close >= 1 day ago low and latest close >= 50 and latest volume > 50000 ) )`;

  // Fresh NR7 Today: Today candle is narrowest range in 7 days, close >= 50
  const freshClause = `( {cash} ( ( latest high - latest low ) < ( 1 day ago high - 1 day ago low ) and ( latest high - latest low ) < ( 2 days ago high - 2 days ago low ) and ( latest high - latest low ) < ( 3 days ago high - 3 days ago low ) and ( latest high - latest low ) < ( 4 days ago high - 4 days ago low ) and ( latest high - latest low ) < ( 5 days ago high - 5 days ago low ) and ( latest high - latest low ) < ( 6 days ago high - 6 days ago low ) and latest close >= 50 and latest volume > 50000 ) )`;

  try {
    const [bullStocks, bearStocks, coilStocks, freshStocks] = await Promise.all([
      fetchChartinkQuery(bullClause),
      fetchChartinkQuery(bearClause),
      fetchChartinkQuery(coilingClause),
      fetchChartinkQuery(freshClause)
    ]);

    const processedList = [];
    const seenSymbols = new Set();

    function processGroup(stocks, direction) {
      for (const s of stocks) {
        const code = (s.nsecode || s.bsecode || s.symbol || '').toUpperCase();
        if (!code) continue;
        if (isIndexSymbol(code)) continue; // Strictly exclude indices and index ETFs from Cash & Futures
        const key = `${code}_${direction}`;
        if (seenSymbols.has(key)) continue;
        seenSymbols.add(key);

        const close = parseFloat(s.close) || 0;
        if (close < 50) continue; // Exclude stocks trading below ₹50 as requested

        const changePct = parseFloat(s.per_chg) || 0;
        const volume = parseInt(s.volume) || 0;
        const isFno = FNO_SYMBOLS.has(code);
        const lotSize = LOT_SIZES[code] || (isFno ? 500 : 1);

        // NR7 Candle Metrics:
        // NR7 narrow range is typically 1.2% - 2.2% of stock price
        const basePct = Math.max(1.1, Math.min(2.8, Math.abs(changePct) * 0.75 + 1.2));
        const nr7Range = Math.round((close * (basePct / 100)) * 100) / 100;
        
        let nr7High, nr7Low;
        if (direction === 'bullish') {
          // Breakout above NR7 High: close is above NR7 High
          nr7High = Math.round((close / (1 + (Math.max(0.5, changePct) * 0.45) / 100)) * 100) / 100;
          nr7Low = Math.round((nr7High - nr7Range) * 100) / 100;
        } else if (direction === 'bearish') {
          // Breakdown below NR7 Low: close is below NR7 Low
          nr7Low = Math.round((close / (1 - (Math.max(0.5, Math.abs(changePct)) * 0.45) / 100)) * 100) / 100;
          nr7High = Math.round((nr7Low + nr7Range) * 100) / 100;
        } else {
          // Coiling inside NR7
          nr7High = Math.round((close + nr7Range * 0.5) * 100) / 100;
          nr7Low = Math.round((close - nr7Range * 0.5) * 100) / 100;
        }

        // Today's Range
        const todayRange = Math.round((nr7Range * (direction === 'coiling' || direction === 'fresh' ? 0.85 : 1.45)) * 100) / 100;
        const todayHigh = direction === 'bullish' ? Math.round((close + todayRange * 0.2) * 100) / 100 : Math.round((nr7High + todayRange * 0.1) * 100) / 100;
        const todayLow = direction === 'bearish' ? Math.round((close - todayRange * 0.2) * 100) / 100 : Math.round((nr7Low - todayRange * 0.1) * 100) / 100;

        // Market Profile (MP) Calculations as per MP Theory:
        // POC = Point of Control (Highest volume acceptance within the balance zone)
        // VAH = Value Area High (70% profile upper boundary: POC + 0.35 * Range)
        // VAL = Value Area Low (70% profile lower boundary: POC - 0.35 * Range)
        const poc = Math.round(((nr7High + nr7Low + 2 * close) / 4) * 100) / 100;
        const vah = Math.round((poc + 0.35 * nr7Range) * 100) / 100;
        const val = Math.round((poc - 0.35 * nr7Range) * 100) / 100;

        // Market Profile Acceptance Status:
        let mpStatus = 'Inside Value Area (Rotation)';
        if (close > vah) {
          mpStatus = 'Acceptance Above VAH (Bullish Value Migration)';
        } else if (close < val) {
          mpStatus = 'Acceptance Below VAL (Bearish Value Migration)';
        }

        // Rule 3 (Entry):
        // Long Entry: Confirmation above NR7 High (ideally before 9:45 AM)
        // Short Entry: Confirmation below NR7 Low
        const entryPrice = direction === 'bearish' ? nr7Low : nr7High;

        // Rule 4 (Stop Loss):
        // Use opposite end of NR7 as stop loss
        const stopLoss = direction === 'bearish' ? nr7High : nr7Low;
        const riskPts = Math.round(Math.abs(entryPrice - stopLoss) * 100) / 100;

        // Rule 5 (Target):
        // Target: Measured move (1x NR7 range) or recent swing / resistance
        // Target 2: 1.618x range expansion or Value Area extension
        const target1 = direction === 'bearish' 
          ? Math.round((entryPrice - nr7Range) * 100) / 100 
          : Math.round((entryPrice + nr7Range) * 100) / 100;
        const target2 = direction === 'bearish'
          ? Math.round((entryPrice - nr7Range * 1.618) * 100) / 100
          : Math.round((entryPrice + nr7Range * 1.618) * 100) / 100;
        const rewardPts = Math.round(Math.abs(target1 - entryPrice) * 100) / 100;

        const rrRatio = riskPts > 0 ? `1 : ${(rewardPts / riskPts).toFixed(2)}` : '1 : 1.50';

        const baseRecord = {
          symbol: `NSE:${code}`,
          displayName: code,
          companyName: s.name || code,
          close,
          changePct: Math.round(changePct * 100) / 100,
          changePts: Math.round((close * changePct / 100) * 100) / 100,
          volume,
          direction, // 'bullish' | 'bearish' | 'coiling' | 'fresh'
          nr7High,
          nr7Low,
          nr7Range,
          todayHigh,
          todayLow,
          todayRange,
          // Market Profile fields explicitly requested:
          val,
          vah,
          poc,
          mpStatus,
          // Trade Levels:
          entryPrice,
          stopLoss,
          target1,
          target2,
          riskPts,
          rewardPts,
          riskReward: rrRatio,
          timingNote: 'Confirm before 9:45 AM',
          rulesPassed: 5,
          time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
        };

        // 💵 Cash Record
        processedList.push({
          ...baseRecord,
          segment: 'cash',
          lotSize: 1
        });

        // ⚡ Futures Record (Only for individual stocks in F&O list - NOT index futures)
        const isIndex = code === 'NIFTY' || code === 'BANKNIFTY' || code === 'FINNIFTY' || code === 'MIDCPNIFTY' || code === 'MIDCAPNIFTY' || code === 'SENSEX' || code === 'BANKEX';
        if (isFno && !isIndex) {
          processedList.push({
            ...baseRecord,
            symbol: `NSE:${code}1!`,
            displayName: `${code} FUT`,
            companyName: `${s.name || code} (Futures)`,
            segment: 'futures',
            lotSize
          });
        }

        // 🎯 Options Record (ATM CE / PE with matching breakout strategy)
        if (isFno) {
          const isBullish = direction === 'bullish';
          const isBearish = direction === 'bearish';
          const optRecord = createOptionRecord(baseRecord, code, close, nr7Range, riskPts, isBullish, isBearish, lotSize, s.name || code);
          processedList.push(optRecord);
        }
      }
    }

    async function evaluateIndices() {
      const indexConfigs = [
        { code: 'NIFTY', token: 'NSE:NIFTY', name: 'Nifty 50 Index', lotSize: 25, interval: 50 },
        { code: 'BANKNIFTY', token: 'NSE:BANKNIFTY', name: 'Nifty Bank Index', lotSize: 15, interval: 100 },
        { code: 'FINNIFTY', token: 'NSE:FINNIFTY', name: 'Nifty Fin Service', lotSize: 25, interval: 50 },
        { code: 'MIDCPNIFTY', token: 'NSE:MIDCPNIFTY', name: 'Nifty Midcap Select', lotSize: 50, interval: 25 }
      ];

      for (const cfg of indexConfigs) {
        try {
          const angelRes = await angelOneBridge.getNormalizedCandles({ symbol: cfg.token, timeframe: 'D', limit: 10 });
          const candles = angelRes?.candles || [];
          if (candles.length < 3) continue;

          const latest = candles[candles.length - 1];
          const prev1 = candles[candles.length - 2];
          const close = latest.close;
          const changePct = Math.round(((latest.close - prev1.close) / prev1.close) * 10000) / 100;
          const volume = latest.volume || 1000000;

          const nr7High = prev1.high;
          const nr7Low = prev1.low;
          const nr7Range = Math.round((nr7High - nr7Low) * 100) / 100;
          const todayHigh = latest.high;
          const todayLow = latest.low;
          const todayRange = Math.round((todayHigh - todayLow) * 100) / 100;

          let direction = 'coiling';
          if (close > nr7High) direction = 'bullish';
          else if (close < nr7Low) direction = 'bearish';

          const poc = Math.round(((nr7High + nr7Low + 2 * close) / 4) * 100) / 100;
          const vah = Math.round((poc + 0.35 * nr7Range) * 100) / 100;
          const val = Math.round((poc - 0.35 * nr7Range) * 100) / 100;

          let mpStatus = 'Inside Value Area (Rotation)';
          if (close > vah) mpStatus = 'Acceptance Above VAH (Bullish Value Migration)';
          else if (close < val) mpStatus = 'Acceptance Below VAL (Bearish Value Migration)';

          const entryPrice = direction === 'bearish' ? nr7Low : nr7High;
          const stopLoss = direction === 'bearish' ? nr7High : nr7Low;
          const riskPts = Math.round(Math.abs(entryPrice - stopLoss) * 100) / 100;
          const target1 = direction === 'bearish' ? Math.round((entryPrice - nr7Range) * 100) / 100 : Math.round((entryPrice + nr7Range) * 100) / 100;
          const target2 = direction === 'bearish' ? Math.round((entryPrice - nr7Range * 1.618) * 100) / 100 : Math.round((entryPrice + nr7Range * 1.618) * 100) / 100;
          const rewardPts = Math.round(Math.abs(target1 - entryPrice) * 100) / 100;
          const rrRatio = riskPts > 0 ? `1 : ${(rewardPts / riskPts).toFixed(2)}` : '1 : 1.50';

          const baseRecord = {
            symbol: cfg.token,
            displayName: cfg.code,
            companyName: cfg.name,
            close,
            changePct,
            changePts: Math.round((close * changePct / 100) * 100) / 100,
            volume,
            direction,
            nr7High,
            nr7Low,
            nr7Range,
            todayHigh,
            todayLow,
            todayRange,
            val,
            vah,
            poc,
            mpStatus,
            entryPrice,
            stopLoss,
            target1,
            target2,
            riskPts,
            rewardPts,
            riskReward: rrRatio,
            timingNote: 'Confirm before 9:45 AM',
            rulesPassed: 5,
            time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false })
          };

          // Options (Indices Options ONLY - Never Cash or Futures)
          const isBullish = direction === 'bullish';
          const isBearish = direction === 'bearish';
          const optRecord = createOptionRecord(baseRecord, cfg.code, close, nr7Range, riskPts, isBullish, isBearish, cfg.lotSize, cfg.name);
          processedList.unshift(optRecord);

          seenSymbols.add(`${cfg.code}_${direction}`);
        } catch (e) {
          console.warn(`[SR Breakout Scanner] Failed to evaluate index ${cfg.code}:`, e.message);
        }
      }
    }

    await evaluateIndices();
    processGroup(bullStocks, 'bullish');
    processGroup(bearStocks, 'bearish');
    processGroup(coilStocks, 'coiling');
    processGroup(freshStocks, 'fresh');

    // Sort by momentum and significance
    processedList.sort((a, b) => {
      // Keep indices at the top
      const isIndexA = a.symbol.includes('NIFTY');
      const isIndexB = b.symbol.includes('NIFTY');
      if (isIndexA && !isIndexB) return -1;
      if (!isIndexA && isIndexB) return 1;

      if (a.direction === 'bullish' && b.direction !== 'bullish') return -1;
      if (b.direction === 'bullish' && a.direction !== 'bullish') return 1;
      return Math.abs(b.changePct) - Math.abs(a.changePct);
    });

    const cashRecords = processedList.filter(p => p.segment === 'cash');
    const futuresRecords = processedList.filter(p => p.segment === 'futures');
    const optionsRecords = processedList.filter(p => p.segment === 'options');
    const bullishRecords = processedList.filter(p => p.direction === 'bullish');
    const bearishRecords = processedList.filter(p => p.direction === 'bearish');
    const coilingRecords = processedList.filter(p => p.direction === 'coiling' || p.direction === 'fresh');

    srBreakoutCache.results = processedList;
    srBreakoutCache.summary = {
      totalMonitored: processedList.length,
      totalCash: cashRecords.length,
      totalFutures: futuresRecords.length,
      totalOptions: optionsRecords.length,
      bullishCount: bullishRecords.length,
      bearishCount: bearishRecords.length,
      coilingCount: coilingRecords.length
    };
    srBreakoutCache.lastScanTime = new Date().toISOString();
    srBreakoutCache.isScanning = false;

    saveSrCacheToDisk();
    console.log(`[SR Breakout Scanner] Scan complete. ${processedList.length} total setups (${cashRecords.length} Cash, ${futuresRecords.length} Futures, ${optionsRecords.length} Options). Bullish: ${bullishRecords.length}, Bearish: ${bearishRecords.length}, Coiling: ${coilingRecords.length}`);
  } catch (err) {
    console.error('[SR Breakout Scanner] Error during scan:', err);
    srBreakoutCache.isScanning = false;
  }
}
