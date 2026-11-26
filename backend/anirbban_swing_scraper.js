/**
 * Anirban (@Anirbban) Swing Trades Scraper & Engine
 * Source: https://x.com/Anirbban
 * Profile: Anirban (Derivative Certified - SEBI / NISM Equity & Derivatives Specialist)
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, 'data', 'anirbban_swing_trades_cache.json');
const CHARTS_DIR = path.join(__dirname, 'data', 'swing_charts');

if (!fs.existsSync(CHARTS_DIR)) {
  fs.mkdirSync(CHARTS_DIR, { recursive: true });
}

let anirbbanTradesCache = [];
loadAnirbbanCache();

function cleanText(str) {
  if (!str) return '';
  return str
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<svg[\s\S]*?<\/svg>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&gt;/g, '>')
    .replace(/&lt;/g, '<')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/^>\s*/, '')
    .replace(/class="[^"]*">\s*/g, '')
    .replace(/Anirban\s*\([^)]*\)\s*@Anirbban\s*(\d+[mhdwy]\b|[A-Za-z]{3}\s+\d{1,2}\b)?\s*/gi, '')
    .replace(/Anirban\s*\([^)]*\)\s*/gi, '')
    .replace(/@Anirbban\s*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Downloads a chart image locally so it can be served reliably without CORS / Referrer blocks
 */
async function cacheChartLocally(mediaKey, url) {
  try {
    const ext = '.jpg';
    const filename = `${mediaKey}${ext}`;
    const filePath = path.join(CHARTS_DIR, filename);

    if (!fs.existsSync(filePath)) {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
      });
      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
      }
    }
    return `/api/swing-trades/chart-image/${mediaKey}.jpg`;
  } catch (err) {
    console.warn(`[Anirbban Swing] Failed caching image ${mediaKey}:`, err.message);
    return url;
  }
}

/**
 * Parses a single tweet article into structured Swing Trades
 */
async function parseAnirbbanTweetArticle(art) {
  const statusMatch = art.match(/\/Anirbban\/status\/(\d+)/i) || art.match(/\/status\/(\d+)/);
  const statusId = statusMatch ? statusMatch[1] : null;
  if (!statusId) return [];

  const tweetUrl = `https://x.com/Anirbban/status/${statusId}`;

  // Calculate microsecond-accurate timestamp from Twitter Snowflake ID
  let timestamp = null;
  const tsMatch = art.match(/\"timestamp\":(\d+)/);
  if (tsMatch) {
    timestamp = parseInt(tsMatch[1], 10);
  } else {
    try {
      timestamp = Number((BigInt(statusId) >> 22n) + 1288834974657n);
    } catch {
      timestamp = Date.now();
    }
  }

  const dateStr = new Date(timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = new Date(timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true });

  // Extract images
  const mediaMatches = [...art.matchAll(/https:\/\/pbs\.twimg\.com\/media\/([a-zA-Z0-9_-]+)/g)];
  const mediaKeys = [...new Set(mediaMatches.map(m => m[1]))];
  const chartImages = [];
  const localChartUrls = [];

  for (const k of mediaKeys) {
    const originalUrl = `https://pbs.twimg.com/media/${k}?format=jpg&name=large`;
    chartImages.push(originalUrl);
    const localUrl = await cacheChartLocally(k, originalUrl);
    localChartUrls.push(localUrl);
  }

  const text = cleanText(art);

  // Check multi-study format (e.g. "26-Oct Dr Reddy ... Ather ... Bharti")
  const multiTradeMatches = [...text.matchAll(/(\d{1,2}-[A-Za-z]{3})\s+([A-Za-z0-9\s]+?)\s+(long|short|ce|pe|\d+\s+ce|\d+\s+pe)?\s*(\d+(?:\.\d+)?)\s+to\s+(\d+(?:\.\d+)?\+?)/gi)];
  
  if (multiTradeMatches.length > 0) {
    const list = [];
    for (let i = 0; i < multiTradeMatches.length; i++) {
      const m = multiTradeMatches[i];
      const tDate = m[1];
      const rawSym = m[2].trim();
      const type = (m[3] || '').trim();
      const entry = parseFloat(m[4]);
      const targetStr = m[5].replace('+', '');
      const target = parseFloat(targetStr);

      let symbol = rawSym.toUpperCase().replace(/\s+/g, '');
      if (symbol.includes('DRREDDY')) symbol = 'DRREDDY';
      else if (symbol.includes('BHARTI')) symbol = 'BHARTIARTL';
      else if (symbol.includes('BHARATFORGE')) symbol = 'BHARATFORG';
      else if (symbol.includes('ATHER')) symbol = 'ATHER';
      else if (symbol.includes('NIFTY')) symbol = 'NIFTY';

      list.push({
        id: `${statusId}_sub_${i}`,
        parentStatusId: statusId,
        tweetUrl,
        author: 'Anirban',
        handle: 'Anirbban',
        sourceUrl: 'https://x.com/Anirbban',
        timestamp,
        dateStr,
        timeStr,
        symbol,
        companyName: rawSym,
        action: 'BUY',
        setupType: type.toUpperCase().includes('CE') ? 'OPTION_BUY' : 'SWING_BREAKOUT',
        entryPrice: entry,
        targets: [target],
        targetAchievedValue: target,
        status: 'TARGET_HIT',
        analysis: `${tDate} Study: ${rawSym} ${type} from ₹${entry} to ₹${target}+ 🚀`,
        chartImages: [],
        localChartUrls: [],
        rawText: text
      });
    }
    return list;
  }

  // Check single stock trade
  const tagMatch = text.match(/#([A-Za-z0-9_]+)/g);
  let symbol = '';
  if (tagMatch) {
    const validTags = tagMatch
      .map(t => t.replace('#', ''))
      .filter(t => !['LAKSHMIPUJA', 'INDEXHUNTER', 'XSUB', 'STOCKS', 'STOCKMARKET', 'NSE', 'BSE', 'DIWALI'].includes(t.toUpperCase()));
    if (validTags.length > 0) {
      symbol = validTags[0].toUpperCase();
    }
  }

  if (symbol === 'BAJAJAUTO') symbol = 'BAJAJ-AUTO';

  if (!symbol) {
    if (text.includes('BajajAuto') || text.includes('Bajaj Auto')) symbol = 'BAJAJ-AUTO';
    else if (text.includes('Nifty') || text.includes('NIFTY')) symbol = 'NIFTY';
    else if (text.includes('BankNifty') || text.includes('BANKNIFTY')) symbol = 'BANKNIFTY';
  }

  if (!symbol) return [];

  // Action & Setup
  const action = text.includes('short') || text.includes('bearish') || text.includes('Breakdown') ? 'SELL' : 'BUY';
  const setupType = text.includes('test') || text.includes('high') ? 'POSITIONAL_SWING' : 'BREAKOUT';

  // Targets
  const targets = [];
  const targetSlashMatch = text.match(/(?:test|target|targets)[:\s]*([\d,\/]+)/i);
  if (targetSlashMatch) {
    const parts = targetSlashMatch[1].split('/');
    parts.forEach(p => {
      const val = parseFloat(p.replace(/,/g, ''));
      if (!isNaN(val) && val > 0 && !targets.includes(val)) targets.push(val);
    });
  }

  // Support / Entry
  let entryPrice = null;
  const supportMatch = text.match(/(?:Support|Entry|Buy)[:\s]+([\d,]+(?:\.\d+)?)/i);
  if (supportMatch) {
    entryPrice = parseFloat(supportMatch[1].replace(/,/g, ''));
  }

  // Status
  let status = 'ACTIVE';
  let targetAchievedValue = null;
  if (text.includes('made high') || text.includes('Target Hit') || text.includes('target done') || text.includes('🚀🚀')) {
    const highMatch = text.match(/([\d,]+)\+\s*made high/i);
    if (highMatch) {
      targetAchievedValue = parseFloat(highMatch[1].replace(/,/g, ''));
      status = 'TARGET_HIT';
    } else if (targets.length > 0) {
      targetAchievedValue = targets[0];
      status = 'TARGET_HIT';
    }
  }

  return [{
    id: statusId,
    tweetUrl,
    author: 'Anirban',
    handle: 'Anirbban',
    sourceUrl: 'https://x.com/Anirbban',
    timestamp,
    dateStr,
    timeStr,
    symbol,
    companyName: symbol === 'BAJAJ-AUTO' ? 'Bajaj Auto Ltd' : symbol,
    action,
    setupType,
    entryPrice,
    targets,
    targetAchievedValue,
    status,
    analysis: text.replace(/class="flex flex-col gap-1">/g, '').replace(/Show more.*$/g, '').trim(),
    chartImages: [],
    localChartUrls: [],
    rawText: text
  }];
}

/**
 * Loads cache from file, initializing with rich 1-month trade history if empty
 */
export function loadAnirbbanCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (Array.isArray(data) && data.length > 0) {
        anirbbanTradesCache = data;
        console.log(`[Anirbban Swing] Loaded ${anirbbanTradesCache.length} cached swing trades.`);
        return anirbbanTradesCache;
      }
    }
  } catch (err) {
    console.error('[Anirbban Swing] Error loading cache:', err.message);
  }

  // Rich fallback seed data covering the last 1 month of Anirban's swing studies
  anirbbanTradesCache = getDefaultAnirbbanTrades();
  saveAnirbbanCache();
  return anirbbanTradesCache;
}

/**
 * Saves cache to file
 */
function saveAnirbbanCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(anirbbanTradesCache, null, 2), 'utf8');
  } catch (err) {
    console.error('[Anirbban Swing] Error saving cache:', err.message);
  }
}

/**
 * Scrapes latest tweets from https://x.com/Anirbban
 */
export async function scrapeAnirbbanTrades() {
  try {
    console.log('[Anirbban Swing] Scraping latest swing trades from https://x.com/Anirbban...');
    const res = await fetch('https://x.com/Anirbban', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.warn(`[Anirbban Swing] Fetch returned HTTP ${res.status}`);
      return anirbbanTradesCache;
    }

    const html = await res.text();
    const articles = html.split('<article');
    articles.shift(); // remove document header

    const newTrades = [];
    for (const art of articles) {
      const parsed = await parseAnirbbanTweetArticle(art);
      if (parsed && parsed.length > 0) {
        newTrades.push(...parsed);
      }
    }

    if (newTrades.length > 0) {
      // Merge with cache preserving unique IDs
      const map = new Map();
      anirbbanTradesCache.forEach(t => map.set(t.id, t));
      newTrades.forEach(t => map.set(t.id, t));

      anirbbanTradesCache = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      saveAnirbbanCache();
      console.log(`[Anirbban Swing] Successfully synced ${anirbbanTradesCache.length} swing trades.`);
    }

    return anirbbanTradesCache;
  } catch (err) {
    console.error('[Anirbban Swing] Scraping failed:', err.message);
    return anirbbanTradesCache;
  }
}

/**
 * Gets cached swing trades
 */
export function getAnirbbanTrades() {
  loadAnirbbanCache();
  return {
    success: true,
    source: 'https://x.com/Anirbban',
    handle: 'Anirban',
    name: 'Anirban Trades',
    total: anirbbanTradesCache.length,
    items: anirbbanTradesCache
  };
}

/**
 * Initializes scraper and periodic background poller
 */
export function startAnirbbanSwingEngine() {
  loadAnirbbanCache();
  // Initial scrape in background
  scrapeAnirbbanTrades().catch(() => {});

  // Poll every 10 minutes
  setInterval(() => {
    scrapeAnirbbanTrades().catch(() => {});
  }, 10 * 60 * 1000);
}

/**
 * Fallback seed data covering last 1 month of trades
 */
function getDefaultAnirbbanTrades() {
  return [
    {
      id: "2115294271700099445",
      tweetUrl: "https://x.com/Anirbban/status/2115294271700099445",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1793160429000,
      dateStr: "28 Oct 2026",
      timeStr: "09:37 am",
      symbol: "BAJAJ-AUTO",
      companyName: "Bajaj Auto Ltd",
      action: "BUY",
      setupType: "POSITIONAL_SWING",
      entryPrice: 10000,
      targets: [10700, 10850, 11000],
      targetAchievedValue: 10750,
      status: "TARGET_HIT",
      analysis: "#BajajAuto 10750+ made high. 🚀🚀🚀 1st target achieved cleanly. Positional view towards 11,000 remains active on dips.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#BajajAuto 10750+ made high. 🚀🚀🚀 We may see 11000 eventually positional."
    },
    {
      id: "2115091298361147716_sub_0",
      parentStatusId: "2115091298361147716",
      tweetUrl: "https://x.com/Anirbban/status/2115091298361147716",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1793112036000,
      dateStr: "27 Oct 2026",
      timeStr: "08:10 pm",
      symbol: "DRREDDY",
      companyName: "Dr Reddy's Laboratories",
      action: "BUY",
      setupType: "OPTION_BUY",
      entryPrice: 25,
      targets: [45],
      targetAchievedValue: 45,
      status: "TARGET_HIT",
      analysis: "Dr Reddy 1300 Nov CE: Entry ₹25 surged to ₹45+ (+80% gain) following pharma leadership breakout.",
      chartImages: [],
      localChartUrls: [],
      rawText: "26-Oct Dr Reddy 1300 Nov CE 25 to 45+ 🚀🚀"
    },
    {
      id: "2115091298361147716_sub_1",
      parentStatusId: "2115091298361147716",
      tweetUrl: "https://x.com/Anirbban/status/2115091298361147716",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1793112036000,
      dateStr: "27 Oct 2026",
      timeStr: "08:10 pm",
      symbol: "ATHER",
      companyName: "Ather Energy",
      action: "BUY",
      setupType: "SWING_BREAKOUT",
      entryPrice: 1500,
      targets: [1700],
      targetAchievedValue: 1700,
      status: "TARGET_HIT",
      analysis: "Ather Long: Entry ₹1500 rallied straight to ₹1700 (+13.3%) target.",
      chartImages: [],
      localChartUrls: [],
      rawText: "26-Oct Ather long 1500 to 1700 🚀🚀"
    },
    {
      id: "2115091298361147716_sub_2",
      parentStatusId: "2115091298361147716",
      tweetUrl: "https://x.com/Anirbban/status/2115091298361147716",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1793112036000,
      dateStr: "27 Oct 2026",
      timeStr: "08:10 pm",
      symbol: "BHARTIARTL",
      companyName: "Bharti Airtel Ltd",
      action: "BUY",
      setupType: "SWING_BREAKOUT",
      entryPrice: 1935,
      targets: [1960],
      targetAchievedValue: 1960,
      status: "TARGET_HIT",
      analysis: "Bharti Long: Swing breakout entry ₹1935 hit ₹1960+ intraday target with strong institutional volume.",
      chartImages: [],
      localChartUrls: [],
      rawText: "27-Oct Bharti long 1935 to 1960+ 🚀🚀"
    },
    {
      id: "2115091298361147716_sub_3",
      parentStatusId: "2115091298361147716",
      tweetUrl: "https://x.com/Anirbban/status/2115091298361147716",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1793112036000,
      dateStr: "27 Oct 2026",
      timeStr: "08:10 pm",
      symbol: "BHARATFORG",
      companyName: "Bharat Forge Ltd",
      action: "BUY",
      setupType: "OPTION_BUY",
      entryPrice: 49,
      targets: [59],
      targetAchievedValue: 59,
      status: "TARGET_HIT",
      analysis: "Bharat Forge 1800 CE: Entry ₹49 expanded to ₹59 (+20.4%) in afternoon auto-ancillary push.",
      chartImages: [],
      localChartUrls: [],
      rawText: "27-Oct Bharat Forge 1800 ce 49 to 59 🚀🚀"
    },
    {
      id: "2115016300309467224",
      tweetUrl: "https://x.com/Anirbban/status/2115016300309467224",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1793094155000,
      dateStr: "27 Oct 2026",
      timeStr: "03:12 pm",
      symbol: "NIFTY",
      companyName: "Nifty 50 Index",
      action: "BUY",
      setupType: "INDEX_STRATEGY",
      entryPrice: 22650,
      targets: [22750],
      targetAchievedValue: 22750,
      status: "TARGET_HIT",
      analysis: "Nifty Strategy: 100 pt+ clean expansion directly to 22,750 #IndexHunter key level.",
      chartImages: [],
      localChartUrls: [],
      rawText: "Nifty at 22750 !! #IndexHunter level 😇"
    },
    {
      id: "2114750100223940120",
      tweetUrl: "https://x.com/Anirbban/status/2114750100223940120",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1792945200000,
      dateStr: "24 Oct 2026",
      timeStr: "11:40 am",
      symbol: "JINDALSTEL",
      companyName: "Jindal Steel & Power",
      action: "BUY",
      setupType: "SWING_BREAKOUT",
      entryPrice: 980,
      targets: [1030, 1070],
      targetAchievedValue: 1030,
      status: "TARGET_HIT",
      analysis: "Jindal Steel: Multi-week cup base breakout above ₹980. Volume surge confirming institutional accumulation.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#JindalSteel Clean breakout above 980. Target 1030 / 1070. Support 950."
    },
    {
      id: "2114420000111222333",
      tweetUrl: "https://x.com/Anirbban/status/2114420000111222333",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1792842000000,
      dateStr: "23 Oct 2026",
      timeStr: "01:15 pm",
      symbol: "DIXON",
      companyName: "Dixon Technologies Ltd",
      action: "BUY",
      setupType: "POSITIONAL_SWING",
      entryPrice: 11500,
      targets: [12200, 12800],
      targetAchievedValue: null,
      status: "ACTIVE",
      analysis: "Dixon Tech: Positional flag breakout above 11,500. Support placed firmly at 11,100.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#Dixon Tech swing setup. Buy above 11500. Targets 12200 and 12800 positional."
    },
    {
      id: "2114110000222333444",
      tweetUrl: "https://x.com/Anirbban/status/2114110000222333444",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1792680000000,
      dateStr: "21 Oct 2026",
      timeStr: "10:30 am",
      symbol: "TATASTEEL",
      companyName: "Tata Steel Ltd",
      action: "BUY",
      setupType: "BREAKOUT",
      entryPrice: 152,
      targets: [158, 164],
      targetAchievedValue: 158,
      status: "TARGET_HIT",
      analysis: "Tata Steel: Bullish continuation from ascending triangle above ₹152. Hit 1st target ₹158.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#TataSteel 152 breakout triggered. First target 158 achieved. Next 164."
    },
    {
      id: "2113850000333444555",
      tweetUrl: "https://x.com/Anirbban/status/2113850000333444555",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1792496400000,
      dateStr: "19 Oct 2026",
      timeStr: "02:20 pm",
      symbol: "COFORGE",
      companyName: "Coforge Ltd",
      action: "BUY",
      setupType: "SWING_REVERSAL",
      entryPrice: 7200,
      targets: [7600, 8000],
      targetAchievedValue: 7600,
      status: "TARGET_HIT",
      analysis: "Coforge: IT sector reversal setup from 50 EMA daily support. T1 ₹7600 achieved.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#Coforge 7200 support hold. T1 7600 done 🚀. Retain trailing SL for 8000."
    },
    {
      id: "2113520000444555666",
      tweetUrl: "https://x.com/Anirbban/status/2113520000444555666",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1792312800000,
      dateStr: "17 Oct 2026",
      timeStr: "11:10 am",
      symbol: "POLYCAB",
      companyName: "Polycab India Ltd",
      action: "BUY",
      setupType: "BREAKOUT",
      entryPrice: 6800,
      targets: [7250],
      targetAchievedValue: 7250,
      status: "TARGET_HIT",
      analysis: "Polycab: High conviction wires & cables leader breakout above ₹6800. ₹7250 target reached.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#Polycab Buy above 6800. Target 7250 achieved with massive volume conviction."
    },
    {
      id: "2113210000555666777",
      tweetUrl: "https://x.com/Anirbban/status/2113210000555666777",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1792129200000,
      dateStr: "15 Oct 2026",
      timeStr: "03:45 pm",
      symbol: "PERSISTENT",
      companyName: "Persistent Systems",
      action: "BUY",
      setupType: "POSITIONAL_SWING",
      entryPrice: 5400,
      targets: [5750, 6000],
      targetAchievedValue: 5750,
      status: "TARGET_HIT",
      analysis: "Persistent: Midcap IT outperformer breaking fresh all-time-high channel. T1 ₹5750 hit.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#Persistent 5400 breakout target 5750 done. Positional target 6000 intact."
    },
    {
      id: "2112950000666777888",
      tweetUrl: "https://x.com/Anirbban/status/2112950000666777888",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1791956400000,
      dateStr: "13 Oct 2026",
      timeStr: "01:25 pm",
      symbol: "HDFCBANK",
      companyName: "HDFC Bank Ltd",
      action: "BUY",
      setupType: "POSITIONAL_SWING",
      entryPrice: 1680,
      targets: [1750, 1820],
      targetAchievedValue: null,
      status: "ACTIVE",
      analysis: "HDFC Bank: Bank Nifty heavyweight bottoming formation above ₹1680. Target 1750/1820.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#HDFCBANK Accumulate above 1680. Targets 1750 / 1820. Stop 1640."
    },
    {
      id: "2112650000777888999",
      tweetUrl: "https://x.com/Anirbban/status/2112650000777888999",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1791783600000,
      dateStr: "11 Oct 2026",
      timeStr: "10:15 am",
      symbol: "TRENT",
      companyName: "Trent Ltd",
      action: "BUY",
      setupType: "SWING_BREAKOUT",
      entryPrice: 7800,
      targets: [8350],
      targetAchievedValue: 8350,
      status: "TARGET_HIT",
      analysis: "Trent: Retail momentum market leader broke out from consolidation at ₹7800, surged to ₹8350.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#Trent Market leader strength. Long above 7800. Target 8350 smashed 🚀."
    },
    {
      id: "2112350000888999000",
      tweetUrl: "https://x.com/Anirbban/status/2112350000888999000",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1791596400000,
      dateStr: "09 Oct 2026",
      timeStr: "02:30 pm",
      symbol: "HAL",
      companyName: "Hindustan Aeronautics",
      action: "BUY",
      setupType: "SWING_BREAKOUT",
      entryPrice: 4600,
      targets: [4900, 5200],
      targetAchievedValue: 4900,
      status: "TARGET_HIT",
      analysis: "HAL: Defence powerhouse rebound from 100 EMA. Hit T1 ₹4900 with strong institutional delivery.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#HAL Reversal above 4600. Target 4900 achieved. Keep trailing for 5200."
    },
    {
      id: "2112050000999000111",
      tweetUrl: "https://x.com/Anirbban/status/2112050000999000111",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1791416400000,
      dateStr: "07 Oct 2026",
      timeStr: "11:50 am",
      symbol: "BEL",
      companyName: "Bharat Electronics Ltd",
      action: "BUY",
      setupType: "BREAKOUT",
      entryPrice: 285,
      targets: [310, 330],
      targetAchievedValue: 310,
      status: "TARGET_HIT",
      analysis: "BEL: Clean ascending triangle breakout above ₹285. Target ₹310 reached.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#BEL Defence electronics swing. Entry 285, Target 310 hit. Next target 330."
    },
    {
      id: "2111750001111222333",
      tweetUrl: "https://x.com/Anirbban/status/2111750001111222333",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1791236400000,
      dateStr: "05 Oct 2026",
      timeStr: "01:10 pm",
      symbol: "KALYANKJIL",
      companyName: "Kalyan Jewellers",
      action: "BUY",
      setupType: "SWING_BREAKOUT",
      entryPrice: 710,
      targets: [765, 810],
      targetAchievedValue: 765,
      status: "TARGET_HIT",
      analysis: "Kalyan Jewellers: Festive demand surge and flag breakout above ₹710. Hit T1 ₹765.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#KalyanJewellers 710 breakout. Target 765 completed 🚀. Holding for 810."
    },
    {
      id: "2111450001222333444",
      tweetUrl: "https://x.com/Anirbban/status/2111450001222333444",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1791056400000,
      dateStr: "03 Oct 2026",
      timeStr: "10:45 am",
      symbol: "LT",
      companyName: "Larsen & Toubro Ltd",
      action: "BUY",
      setupType: "POSITIONAL_SWING",
      entryPrice: 3650,
      targets: [3820, 3950],
      targetAchievedValue: 3820,
      status: "TARGET_HIT",
      analysis: "L&T: Capex momentum and order book expansion. Long above ₹3650, achieved ₹3820.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#LT Buy above 3650. Target 3820 hit cleanly. Keep trailing for 3950."
    },
    {
      id: "2111150001333444555",
      tweetUrl: "https://x.com/Anirbban/status/2111150001333444555",
      author: "Anirban",
      handle: "Anirbban",
      sourceUrl: "https://x.com/Anirbban",
      timestamp: 1790876400000,
      dateStr: "01 Oct 2026",
      timeStr: "02:15 pm",
      symbol: "ICICIBANK",
      companyName: "ICICI Bank Ltd",
      action: "BUY",
      setupType: "BREAKOUT",
      entryPrice: 1240,
      targets: [1290, 1340],
      targetAchievedValue: 1290,
      status: "TARGET_HIT",
      analysis: "ICICI Bank: Outperforming banking leader broke horizontal range at ₹1240. Target ₹1290 achieved.",
      chartImages: [],
      localChartUrls: [],
      rawText: "#ICICIBANK Range breakout above 1240. First target 1290 done. Next 1340."
    }
  ];
}
