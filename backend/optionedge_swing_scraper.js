/**
 * OptionEdgeTamil Swing Trades Scraper & Engine
 * Source: https://x.com/Optionedgetamil
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, 'data', 'optionedge_swing_trades_cache.json');
const CHARTS_DIR = path.join(__dirname, 'data', 'swing_charts');

if (!fs.existsSync(CHARTS_DIR)) {
  fs.mkdirSync(CHARTS_DIR, { recursive: true });
}

let swingTradesCache = [];
loadSwingCache();

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
    console.warn(`[OptionEdge Swing] Failed caching image ${mediaKey}:`, err.message);
    return url;
  }
}

/**
 * Parses a single tweet article into a structured Swing Trade
 */
async function parseTweetArticle(art) {
  const statusMatch = art.match(/\/Optionedgetamil\/status\/(\d+)/);
  const statusId = statusMatch ? statusMatch[1] : null;
  if (!statusId) return null;

  const tweetUrl = `https://x.com/Optionedgetamil/status/${statusId}`;

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

  // Timestamp
  let timestamp = null;
  const tsMatch = art.match(/\"timestamp\":(\d+)/);
  if (tsMatch) {
    timestamp = parseInt(tsMatch[1], 10);
  }

  const text = cleanText(art);

  // Filter out non-trade commentary tweets
  const isTrade = text.includes('Breakdown Below') || 
                  text.includes('Buy Above') || 
                  text.includes('Breakout Level') || 
                  text.includes('Target') || 
                  text.includes('Breakout') ||
                  text.includes('Breakdown');

  if (!isTrade) return null;

  // Extract Hashtags / Symbol
  const tagMatch = text.match(/#([A-Z0-9_]+)/g);
  let symbol = '';
  if (tagMatch) {
    const validTags = tagMatch
      .map(t => t.replace('#', ''))
      .filter(t => !['NIFTY', 'BANKNIFTY', 'INTRADAY', 'SWING', 'OPTION', 'STOCKS', 'STOCKMARKET', 'INDIANMARKET', 'NSE', 'BSE'].includes(t.toUpperCase()));
    if (validTags.length > 0) {
      symbol = validTags[0].replace(/LTD|LIMITED|INDUSTRIES|HOTELS/gi, '').trim() || validTags[0];
    }
  }

  // Company Name
  let companyName = '';
  const compMatch = text.match(/(?:🔻|🏨|💰|🟢|🔴)?\s*([A-Za-z0-9\s]+(?:Ltd|Limited|Co Ltd|Industries|Hotels))/i);
  if (compMatch) {
    companyName = compMatch[1].trim();
  }

  // Manual symbol resolution if hashtag is generic or missing
  if (!symbol || symbol === 'SOLARINDUSTRIES') symbol = 'SOLARINDS';
  if (!symbol && companyName) {
    if (companyName.includes('Solar')) symbol = 'SOLARINDS';
    else if (companyName.includes('Indian Hotels')) symbol = 'INDHOTEL';
    else if (companyName.includes('Reliance')) symbol = 'RELIANCE';
    else if (companyName.includes('HFCL')) symbol = 'HFCL';
  }

  // Action & Setup
  let action = 'BUY';
  let setupType = 'BREAKOUT';
  if (text.includes('Breakdown') || text.includes('🔻') || text.includes('🔴')) {
    action = 'SELL';
    setupType = 'BREAKDOWN';
  }

  // Entry Price
  let entryPrice = null;
  const entryMatch = text.match(/(?:Breakdown Below|Buy Above|Breakout Level|Entry)[:\s]+([\d,]+(?:\.\d+)?)/i);
  if (entryMatch) {
    entryPrice = parseFloat(entryMatch[1].replace(/,/g, ''));
  }

  // Targets
  const targets = [];
  const targetRegex = /(?:Target|Targets|➡️)[^\d\w]{0,15}([\d,]+(?:\.\d+)?)/gi;
  let tm;
  while ((tm = targetRegex.exec(text)) !== null) {
    const val = parseFloat(tm[1].replace(/,/g, ''));
    if (!isNaN(val) && !targets.includes(val) && val !== entryPrice) {
      targets.push(val);
    }
  }

  // Status
  let status = 'ACTIVE';
  let targetAchievedValue = null;
  if (text.includes('Target') && (text.includes('Achieved') || text.includes('Done') || text.includes('✅'))) {
    status = 'TARGET_HIT';
    if (targets.length > 0) {
      targetAchievedValue = targets[targets.length - 1];
    }
  }

  // Extract analysis commentary
  let analysis = '';
  const analysisMatch = text.match(/(?:📈|📉|Price has|Breakout above|Price is)([\s\S]*?)(?:#|$)/);
  if (analysisMatch) {
    analysis = analysisMatch[0].replace(/#.*$/, '').trim();
  } else {
    analysis = text;
  }

  return {
    id: statusId,
    tweetUrl,
    author: 'Option Edge Tamil',
    handle: 'Optionedgetamil',
    sourceUrl: 'https://x.com/Optionedgetamil',
    timestamp: timestamp || Date.now(),
    dateStr: timestamp ? new Date(timestamp).toLocaleDateString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', year: 'numeric' }) : 'Recent',
    timeStr: timestamp ? new Date(timestamp).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }) : '',
    symbol: symbol || 'SWING',
    companyName: companyName || symbol || 'Equity Swing Trade',
    action,
    setupType,
    entryPrice,
    targets,
    targetAchievedValue,
    status,
    analysis,
    chartImages,
    localChartUrls: localChartUrls.length > 0 ? localChartUrls : chartImages,
    rawText: text
  };
}

/**
 * Loads cache from file
 */
export function loadSwingCache() {
  try {
    if (fs.existsSync(CACHE_FILE)) {
      const data = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'));
      if (Array.isArray(data)) {
        swingTradesCache = data;
        console.log(`[OptionEdge Swing] Loaded ${swingTradesCache.length} cached swing trades.`);
        return swingTradesCache;
      }
    }
  } catch (err) {
    console.error('[OptionEdge Swing] Error loading cache:', err.message);
  }
  return [];
}

/**
 * Saves cache to file
 */
function saveSwingCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(swingTradesCache, null, 2), 'utf8');
  } catch (err) {
    console.error('[OptionEdge Swing] Error saving cache:', err.message);
  }
}

/**
 * Scrapes latest tweets from https://x.com/Optionedgetamil
 */
export async function scrapeOptionEdgeSwing() {
  try {
    console.log('[OptionEdge Swing] Scraping latest swing trades from https://x.com/Optionedgetamil...');
    const res = await fetch('https://x.com/Optionedgetamil', {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
      }
    });

    if (!res.ok) {
      console.warn(`[OptionEdge Swing] Fetch returned HTTP ${res.status}`);
      return swingTradesCache;
    }

    const html = await res.text();
    const articles = html.split('<article');
    articles.shift(); // remove document header

    const newTrades = [];
    for (const art of articles) {
      const trade = await parseTweetArticle(art);
      if (trade) {
        newTrades.push(trade);
      }
    }

    if (newTrades.length > 0) {
      // Merge with cache
      const map = new Map();
      swingTradesCache.forEach(t => map.set(t.id, t));
      newTrades.forEach(t => map.set(t.id, t));

      swingTradesCache = Array.from(map.values()).sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      saveSwingCache();
      console.log(`[OptionEdge Swing] Successfully synced ${swingTradesCache.length} swing trades.`);
    }

    return swingTradesCache;
  } catch (err) {
    console.error('[OptionEdge Swing] Scraping failed:', err.message);
    return swingTradesCache;
  }
}

/**
 * Gets cached swing trades (with fallback seed data if initial scrape is empty)
 */
export function getOptionEdgeSwingTrades() {
  if (swingTradesCache.length === 0) {
    loadSwingCache();
  }
  return {
    success: true,
    source: 'https://x.com/Optionedgetamil',
    handle: '@Optionedgetamil',
    name: 'Option Edge Tamil',
    total: swingTradesCache.length,
    items: swingTradesCache
  };
}

/**
 * Initializes scraper and periodic background poller
 */
export function startOptionEdgeSwingEngine() {
  loadSwingCache();
  // Initial scrape in background
  scrapeOptionEdgeSwing().catch(() => {});

  // Poll every 10 minutes
  setInterval(() => {
    scrapeOptionEdgeSwing().catch(() => {});
  }, 10 * 60 * 1000);
}
