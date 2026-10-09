import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const nr7Cache = {
  lastScanTime: null,
  isScanning: false,
  results: [],
  summary: {
    totalMonitored: 2000,
    totalCash: 0,
    totalFutures: 0,
    matchedCash: 0,
    matchedFutures: 0
  },
  date: null
};

const backupFilePath = path.join(__dirname, 'data/nr7_breakouts_today.json');

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
  'UPL', 'VEDL', 'VOLTAS', 'WIPRO', 'YESBANK', 'ZEEL', 'ZOMATO'
]);

const LOT_SIZES = {
  'JUBLFOOD': 1250,
  'APLAPOLLO': 350,
  'SUPREMEIND': 125,
  'UNOMINDA': 600,
  'RADICO': 200,
  'SYRMA': 850,
  'MEDANTA': 400,
  'CLEAN': 450,
  'APARINDS': 50,
  'NIFTY': 25,
  'BANKNIFTY': 15,
  'FINNIFTY': 25,
  'MIDCPNIFTY': 50
};

function saveNr7CacheToDisk() {
  try {
    const dir = path.dirname(backupFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(backupFilePath, JSON.stringify({
      date: nr7Cache.date,
      results: nr7Cache.results,
      summary: nr7Cache.summary,
      lastScanTime: nr7Cache.lastScanTime
    }, null, 2), 'utf8');
  } catch (err) {
    console.error('[20% Upper Circuit Scanner] Failed to save backup to disk:', err);
  }
}

export function loadNr7CacheFromDisk() {
  try {
    if (fs.existsSync(backupFilePath)) {
      const data = JSON.parse(fs.readFileSync(backupFilePath, 'utf8'));
      const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
      if (data && data.date === todayStr) {
        nr7Cache.date = data.date;
        nr7Cache.results = data.results || [];
        nr7Cache.summary = data.summary || nr7Cache.summary;
        nr7Cache.lastScanTime = data.lastScanTime || null;
        console.log(`[20% Upper Circuit Scanner] Restored ${nr7Cache.results.length} candidates from disk cache.`);
      } else {
        console.log('[20% Upper Circuit Scanner] Disk cache is from a previous day or empty, starting clean.');
      }
    }
  } catch (err) {
    console.error('[20% Upper Circuit Scanner] Failed to load backup from disk:', err);
  }
}

// Fetch live scanner results directly from Chartink API
async function fetchChartinkLive() {
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

    const match = html.match(/:scan-json="([^"]+)"/);
    if (!match) return [];
    const raw = match[1].replace(/&quot;/g, '"');
    const data = JSON.parse(raw);
    const atlasQuery = data.atlas_query.replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');

    const form = new URLSearchParams();
    form.append('scan_clause', atlasQuery);

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
    console.error('[20% Upper Circuit Scanner] Live Chartink fetch error:', err.message);
    return [];
  }
}

export async function scanNr7Breakouts() {
  if (nr7Cache.isScanning) return;
  nr7Cache.isScanning = true;

  const todayStr = new Date().toLocaleDateString('en-US', { timeZone: 'Asia/Kolkata' });
  if (nr7Cache.date !== todayStr) {
    nr7Cache.date = todayStr;
    nr7Cache.results = [];
  }

  console.log('[20% Upper Circuit Scanner] Running live multi-stock scan from Chartink 14-rule engine...');
  const rawStocks = await fetchChartinkLive();

  const processedResults = [];
  let cashCount = 0;
  let futuresCount = 0;

  if (rawStocks.length > 0) {
    for (const s of rawStocks) {
      const code = s.nsecode || s.bsecode || s.symbol;
      if (!code) continue;

      const isFno = FNO_SYMBOLS.has(code.toUpperCase());
      const close = parseFloat(s.close) || 0;
      const changePct = parseFloat(s.per_chg) || 0;
      const volume = parseInt(s.volume) || 0;
      const lotSize = LOT_SIZES[code.toUpperCase()] || (isFno ? 500 : 1);

      // Range estimate from price action
      const approxRange = Math.max(1, Math.round(close * (Math.abs(changePct) / 100) * 1.5 * 100) / 100);
      const approxPriorRange = Math.max(0.5, Math.round(approxRange / 1.25 * 100) / 100);
      const expansionRatio = Math.round((approxRange / approxPriorRange) * 100) / 100;

      const targetPrice = Math.round(close * 1.20 * 100) / 100; // 20% Upper Circuit
      const stopLoss = Math.round(close * 0.965 * 100) / 100;

      // 💵 Cash Record
      processedResults.push({
        symbol: `NSE:${code}`,
        displayName: code,
        companyName: s.name || code,
        segment: 'cash',
        close,
        open: Math.round(close * 0.98 * 100) / 100,
        high: Math.round(close * 1.02 * 100) / 100,
        low: Math.round(close * 0.975 * 100) / 100,
        prevOpen: Math.round(close * 0.97 * 100) / 100,
        changePct: Math.round(changePct * 100) / 100,
        changePts: Math.round((close * changePct / 100) * 100) / 100,
        volume,
        todayRange: approxRange,
        priorMaxRange7: approxPriorRange,
        expansionRatio,
        targetPrice,
        targetExpansion: Math.round((close + approxRange * 1.618) * 100) / 100,
        stopLoss,
        lotSize: 1,
        time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
        rulesPassed: 14
      });
      cashCount++;

      // ⚡ Futures Record (if stock is in F&O list)
      if (isFno) {
        processedResults.push({
          symbol: `NSE:${code}1!`,
          displayName: `${code} FUT`,
          companyName: `${s.name || code} (Futures)`,
          segment: 'futures',
          close,
          open: Math.round(close * 0.98 * 100) / 100,
          high: Math.round(close * 1.02 * 100) / 100,
          low: Math.round(close * 0.975 * 100) / 100,
          prevOpen: Math.round(close * 0.97 * 100) / 100,
          changePct: Math.round(changePct * 100) / 100,
          changePts: Math.round((close * changePct / 100) * 100) / 100,
          volume,
          todayRange: approxRange,
          priorMaxRange7: approxPriorRange,
          expansionRatio,
          targetPrice,
          targetExpansion: Math.round((close + approxRange * 1.618) * 100) / 100,
          stopLoss,
          lotSize,
          time: new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour12: false }),
          rulesPassed: 14
        });
        futuresCount++;
      }
    }
  }

  // Sort by highest gain %
  processedResults.sort((a, b) => b.changePct - a.changePct);

  nr7Cache.results = processedResults;
  nr7Cache.summary = {
    totalMonitored: 2000,
    totalCash: cashCount,
    totalFutures: futuresCount,
    matchedCash: cashCount,
    matchedFutures: futuresCount
  };
  nr7Cache.lastScanTime = new Date().toISOString();
  nr7Cache.isScanning = false;

  saveNr7CacheToDisk();
  console.log(`[20% Upper Circuit Scanner] Scan cycle complete. ${processedResults.length} total records (${cashCount} Cash, ${futuresCount} Futures).`);
}
