import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { angelOneBridge } from './angelone_bridge.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Cache of parsed option contracts & tokens per symbol
const contractsCache = {};
const inFlightContracts = new Map();

// Cache of compiled option chains (2.5s cache for fast zero-latency polling across concurrent users)
const optionChainCache = {};
const optionChainCacheTime = {};
const inFlightOptionChains = new Map();

// Normal CDF for Black-Scholes
export function bsNormalCdf(x) {
  const a1 =  0.254829592, a2 = -0.284496736, a3 =  1.421413741, a4 = -1.453152027, a5 =  1.061405429, p  =  0.3275911;
  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x) / Math.sqrt(2.0);
  const t = 1.0 / (1.0 + p * absX);
  const erf = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);
  return 0.5 * (1.0 + sign * erf);
}

// Normal PDF for Black-Scholes
export function bsNormalPdf(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}

function parseExpiryDate(s) {
  const d = parseInt(s.substring(0, 2), 10);
  const mStr = s.substring(2, 5);
  const y = 2000 + parseInt(s.substring(5, 7), 10);
  const mNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return new Date(y, mNames.indexOf(mStr), d, 15, 30, 0);
}

// Fallback expiries generator in case Angel One is offline
function getFallbackExpiries(cleanSym) {
  const expiries = [];
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const targetDay = cleanSym === 'FINNIFTY' ? 2 : (cleanSym === 'BANKNIFTY' ? 3 : 4); // Thu for NIFTY, Wed for BANKNIFTY, Tue for FINNIFTY

  for (let i = 0; i < 45; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    if (d.getDay() === targetDay && d.getTime() >= todayMidnight) {
      const yy = String(d.getFullYear()).slice(-2);
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const mNames = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      const mStr = mNames[d.getMonth()];
      expiries.push({
        code: `${yy}${mm}${dd}`,
        tradExpiry: `${dd}${mStr}${yy}`,
        label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
      });
    }
  }
  return expiries;
}

// Fetch real option contracts & tokens from Angel One SmartAPI (with local caching & pre-seeding)
export async function getOptionContracts(symbol) {
  const cleanSym = symbol.replace(/^(NSE|BSE|NFO):/, '').toUpperCase();
  const exchange = cleanSym === 'SENSEX' ? 'BFO' : 'NFO';

  // 1. Return fresh cached contracts (cached for 4 hours)
  if (contractsCache[cleanSym] && (Date.now() - contractsCache[cleanSym].timestamp < 14400000)) {
    return contractsCache[cleanSym];
  }

  // Deduplicate concurrent contract parsing/fetching
  if (inFlightContracts.has(cleanSym)) {
    return await inFlightContracts.get(cleanSym);
  }

  const loadPromise = (async () => {
    const optionRegex = new RegExp(`^${cleanSym}(\\d{2}[A-Z]{3}\\d{2})(\\d+)(CE|PE)$`);
    const expiriesMap = {};
    const byExpiry = {};
    const today = new Date();
    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    // Pre-seed from local in-memory token cache & angel_option_tokens.json
    const localSources = [];
    if (angelOneBridge.tokenCache && typeof angelOneBridge.tokenCache === 'object') {
      localSources.push(...Object.values(angelOneBridge.tokenCache));
    }
    try {
      const optPath = path.join(__dirname, 'data/angel_option_tokens.json');
      if (fs.existsSync(optPath)) {
        const rawOpt = JSON.parse(fs.readFileSync(optPath, 'utf8'));
        localSources.push(...Object.values(rawOpt));
      }
    } catch (e) {}

    let localFound = 0;
    for (const item of localSources) {
      if (!item || !item.tradingsymbol) continue;
      const m = item.tradingsymbol.match(optionRegex);
      if (m) {
        const tradExp = m[1];
        const strike = parseInt(m[2], 10);
        const optType = m[3];
        if (!byExpiry[tradExp]) {
          byExpiry[tradExp] = {};
          expiriesMap[tradExp] = true;
        }
        if (!byExpiry[tradExp][strike]) {
          byExpiry[tradExp][strike] = {};
        }
        byExpiry[tradExp][strike][optType] = item;
        localFound++;
      }
    }

    // If local cache had 0 contracts, try a single timed-out searchScrip via throttleRequest
    if (localFound === 0 && angelOneBridge.isLoggedIn && (Date.now() > angelOneBridge.rateLimitBackoffUntil)) {
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3500);
        try {
          const res = await angelOneBridge.throttleRequest(async () => {
            const r = await fetch(`${angelOneBridge.baseUrl}/rest/secure/angelbroking/order/v1/searchScrip`, {
              method: 'POST',
              headers: angelOneBridge.getHeaders(),
              signal: controller.signal,
              body: JSON.stringify({ exchange, searchscrip: cleanSym })
            });
            return await angelOneBridge.parseResponse(r);
          }, false, 'search');

          if (res?.data && Array.isArray(res.data)) {
            for (const item of res.data) {
              const m = item.tradingsymbol?.match(optionRegex);
              if (m) {
                const tradExp = m[1];
                const strike = parseInt(m[2], 10);
                const optType = m[3];
                if (!byExpiry[tradExp]) {
                  byExpiry[tradExp] = {};
                  expiriesMap[tradExp] = true;
                }
                if (!byExpiry[tradExp][strike]) {
                  byExpiry[tradExp][strike] = {};
                }
                byExpiry[tradExp][strike][optType] = item;
                if (angelOneBridge.tokenCache) {
                  angelOneBridge.tokenCache[item.tradingsymbol] = { exchange, symboltoken: String(item.symboltoken), tradingsymbol: item.tradingsymbol };
                }
              }
            }
          }
        } finally {
          clearTimeout(timeout);
        }
      } catch (err) {
        console.warn(`[Option Service] SearchScrip skipped/failed for ${cleanSym}:`, err.message);
      }
    }

    const sortedTradExpiries = Object.keys(expiriesMap).sort((a, b) => {
      return parseExpiryDate(a).getTime() - parseExpiryDate(b).getTime();
    });

    const expiries = [];
    for (const te of sortedTradExpiries) {
      const d = parseExpiryDate(te);
      if (d.getTime() >= todayMidnight) {
        const yy = String(d.getFullYear()).slice(-2);
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        expiries.push({
          code: `${yy}${mm}${dd}`,
          tradExpiry: te,
          label: d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
        });
      }
    }

    if (expiries.length === 0) {
      expiries.push(...getFallbackExpiries(cleanSym));
    }

    const result = { cleanSym, exchange, expiries, byExpiry, timestamp: Date.now() };
    contractsCache[cleanSym] = result;
    return result;
  })();

  inFlightContracts.set(cleanSym, loadPromise);
  try {
    return await loadPromise;
  } finally {
    inFlightContracts.delete(cleanSym);
  }
}

// Synchronous expiries lookup used across backend modules
export function getExpiriesForSymbol(symbol) {
  const cleanSym = symbol.replace(/^(NSE|BSE|NFO):/, '').toUpperCase();
  if (contractsCache[cleanSym]?.expiries?.length > 0) {
    return contractsCache[cleanSym].expiries;
  }
  // Trigger async background caching for next time
  getOptionContracts(symbol).catch(() => {});
  return getFallbackExpiries(cleanSym);
}

// Strike interval detection helper
export function detectStrikeInterval(symbol, price) {
  const s = symbol.toUpperCase();
  if (s.includes('BANKNIFTY')) return 100;
  if (s.includes('NIFTY') || s.includes('FINNIFTY')) return 50;
  if (s.includes('MIDCPNIFTY')) return 25;
  if (s.includes('SENSEX')) return 100;
  if (price > 5000) return 50;
  if (price > 2500) return 20;
  if (price > 1000) return 10;
  if (price > 500) return 5;
  return 2.5;
}

// Compile complete Option Chain with live Angel One ticks & Open Interest
export async function compileOptionChain({
  symbol = 'NSE:NIFTY',
  requestedExpiry = '',
  fetchLiveMarketIndices,
  detectStrikeIntervalFn = detectStrikeInterval
}) {
  const cleanSym = symbol.replace(/^(NSE|BSE|NFO):/, '').toUpperCase();
  const contractInfo = await getOptionContracts(symbol);
  const expiries = contractInfo.expiries;

  let selectedItem = expiries.find(e => e.code === requestedExpiry || e.tradExpiry === requestedExpiry);
  if (!selectedItem && expiries.length > 0) {
    selectedItem = expiries[0];
  }
  const selectedExpiry = selectedItem?.code || '';
  const tradExpiry = selectedItem?.tradExpiry || '';

  const cacheKey = `${cleanSym}_${selectedExpiry}`;
  const now = Date.now();

  // Return fresh cache if polled within 2500ms
  if (optionChainCache[cacheKey] && (now - (optionChainCacheTime[cacheKey] || 0) < 2500)) {
    return optionChainCache[cacheKey];
  }

  // Deduplicate concurrent in-flight builds
  if (inFlightOptionChains.has(cacheKey)) {
    return await inFlightOptionChains.get(cacheKey);
  }

  const buildPromise = (async () => {
    let spotPrice = null;
  let change = 0;
  let changePct = 0;
  let futPrice = null;
  let lotSize = 75;

  if (cleanSym.includes('BANKNIFTY')) lotSize = 30;
  else if (cleanSym.includes('FINNIFTY')) lotSize = 40;
  else if (cleanSym.includes('MIDCPNIFTY')) lotSize = 75;
  else if (cleanSym.includes('SENSEX')) lotSize = 10;
  else lotSize = 250;

  // 1. Get Live Spot & Futures Prices from Market Indices
  if (typeof fetchLiveMarketIndices === 'function') {
    try {
      const indices = await fetchLiveMarketIndices();
      if (cleanSym.includes('BANK')) {
        spotPrice = indices?.banknifty;
        futPrice = indices?.bankniftyFut;
        const itm = indices?.items?.find(i => i.key === 'banknifty');
        if (itm) { change = itm.change; changePct = itm.changePct; }
      } else if (cleanSym === 'NIFTY') {
        spotPrice = indices?.nifty;
        futPrice = indices?.niftyFut;
        const itm = indices?.items?.find(i => i.key === 'nifty');
        if (itm) { change = itm.change; changePct = itm.changePct; }
      } else if (cleanSym === 'FINNIFTY') {
        spotPrice = indices?.finnifty;
        futPrice = indices?.finniftyFut;
        const itm = indices?.items?.find(i => i.key === 'finnifty');
        if (itm) { change = itm.change; changePct = itm.changePct; }
      } else if (cleanSym === 'SENSEX') {
        spotPrice = indices?.sensex;
        futPrice = spotPrice ? spotPrice + 35.0 : null;
        const itm = indices?.items?.find(i => i.key === 'sensex');
        if (itm) { change = itm.change; changePct = itm.changePct; }
      }
    } catch (e) {}
  }

  // Fallback to Angel One candles for stock spot price
  if (!spotPrice || isNaN(spotPrice)) {
    try {
      const cRes = await angelOneBridge.getNormalizedCandles({ symbol, timeframe: 'D', limit: 2 });
      if (cRes && cRes.status && Array.isArray(cRes.candles) && cRes.candles.length > 0) {
        const lastCandle = cRes.candles[cRes.candles.length - 1];
        spotPrice = lastCandle.close;
        if (cRes.candles.length > 1) {
          const prevClose = cRes.candles[cRes.candles.length - 2].close;
          change = Math.round((spotPrice - prevClose) * 100) / 100;
          changePct = prevClose ? Math.round(((spotPrice - prevClose) / prevClose) * 10000) / 100 : 0;
        }
      }
    } catch (e) {}
  }

  if (!spotPrice || isNaN(spotPrice)) {
    spotPrice = cleanSym.includes('BANK') ? 55400 : 22750;
  }
  if (!futPrice) {
    futPrice = Math.round((spotPrice + (cleanSym.includes('BANK') ? 65.0 : 18.5)) * 100) / 100;
  }

  const interval = detectStrikeIntervalFn(symbol, spotPrice);
  const atmStrike = Math.round(spotPrice / interval) * interval;

  // Calculate time to expiry in years
  let tYears = 2 / 365;
  if (selectedExpiry && selectedExpiry.length === 6) {
    try {
      const yr = 2000 + parseInt(selectedExpiry.substring(0, 2), 10);
      const mo = parseInt(selectedExpiry.substring(2, 4), 10) - 1;
      const dy = parseInt(selectedExpiry.substring(4, 6), 10);
      const expDate = new Date(yr, mo, dy, 15, 30, 0);
      const diffDays = (expDate.getTime() - now) / (1000 * 60 * 60 * 24);
      tYears = Math.max(0.5 / 365, diffDays / 365);
    } catch (e) {}
  }

  const iv = cleanSym.includes('BANK') ? 0.16 : 0.135;
  const r = 0.065;
  const sqrtT = Math.max(0.001, Math.sqrt(tYears));
  const disc = Math.exp(-r * tYears);

  // Generate 15 strikes below and 15 strikes above ATM (total 31 strikes)
  const strikes = [];
  for (let i = -15; i <= 15; i++) {
    strikes.push(atmStrike + (i * interval));
  }

  // 2. Collect Angel One Tokens for batch live quote request (prioritize strikes around ATM up to 40 tokens)
  const tokensToFetch = [];
  const sortedStrikes = [...strikes].sort((a, b) => Math.abs(a - atmStrike) - Math.abs(b - atmStrike));
  for (const strk of sortedStrikes) {
    const c = contractInfo.byExpiry[tradExpiry]?.[strk];
    if (c?.CE?.symboltoken && !tokensToFetch.includes(c.CE.symboltoken)) tokensToFetch.push(c.CE.symboltoken);
    if (c?.PE?.symboltoken && !tokensToFetch.includes(c.PE.symboltoken)) tokensToFetch.push(c.PE.symboltoken);
    if (tokensToFetch.length >= 40) break;
  }

  // 3. Batch fetch live quotes from Angel One SmartAPI in 1 single fast call
  const quotesMap = {};
  if (tokensToFetch.length > 0 && angelOneBridge.isLoggedIn && (Date.now() > angelOneBridge.rateLimitBackoffUntil)) {
    try {
      const qRes = await angelOneBridge.getMarketQuotes({ [contractInfo.exchange]: tokensToFetch }, 'FULL');
      if (qRes && qRes.status && Array.isArray(qRes.data?.fetched)) {
        for (const item of qRes.data.fetched) {
          quotesMap[item.tradingSymbol] = item;
          quotesMap[item.symbolToken] = item;
        }
      }
    } catch (quoteErr) {
      console.warn('[Option Service] Batch quote fetch exception:', quoteErr.message);
    }
  }

  let maxOi = 0;

  const data = strikes.map(strike => {
    const ceContract = contractInfo.byExpiry[tradExpiry]?.[strike]?.CE;
    const peContract = contractInfo.byExpiry[tradExpiry]?.[strike]?.PE;

    const ceSymbol = ceContract ? `${contractInfo.exchange}:${ceContract.tradingsymbol}` : `NFO:${cleanSym}${tradExpiry}${strike}CE`;
    const peSymbol = peContract ? `${contractInfo.exchange}:${peContract.tradingsymbol}` : `NFO:${cleanSym}${tradExpiry}${strike}PE`;

    const d1 = (Math.log(spotPrice / strike) + (r + 0.5 * iv * iv) * tYears) / (iv * sqrtT);
    const d2 = d1 - iv * sqrtT;

    const nd1 = bsNormalCdf(d1);
    const nd2 = bsNormalCdf(d2);
    const nNegD1 = bsNormalCdf(-d1);
    const nNegD2 = bsNormalCdf(-d2);
    const pdfD1 = bsNormalPdf(d1);

    // Black-Scholes theoretical fallback prices
    let cePriceBS = spotPrice * nd1 - strike * disc * nd2;
    let pePriceBS = strike * disc * nNegD2 - spotPrice * nNegD1;
    cePriceBS = cePriceBS < 0.05 ? 0.05 : Math.round(cePriceBS * 20) / 20;
    pePriceBS = pePriceBS < 0.05 ? 0.05 : Math.round(pePriceBS * 20) / 20;

    // Greeks
    const ceDelta = Math.min(1.00, Math.max(0.00, Math.round(nd1 * 100) / 100));
    const peDelta = Math.min(1.00, Math.max(0.00, Math.round((1 - nd1) * 100) / 100));

    const rawGamma = pdfD1 / (spotPrice * iv * sqrtT);
    const gamma = rawGamma < 0.0005 ? 0 : Math.round(rawGamma * 1000) / 1000;

    const rawVega = (spotPrice * sqrtT * pdfD1) / 100;
    const vega = rawVega < 0.5 ? 0 : Math.round(rawVega * 10) / 10;

    const thetaDecay = Math.abs((-(spotPrice * pdfD1 * iv) / (2 * sqrtT * 365)));
    const ceTheta = thetaDecay < 0.5 ? 0 : Math.round(thetaDecay);
    const peTheta = thetaDecay < 0.5 ? 0 : Math.round(thetaDecay);

    // Live quotes from Angel One
    const ceQuote = quotesMap[ceContract?.symboltoken] || quotesMap[ceContract?.tradingsymbol];
    const peQuote = quotesMap[peContract?.symboltoken] || quotesMap[peContract?.tradingsymbol];

    const ceLtp = (ceQuote && typeof ceQuote.ltp === 'number' && ceQuote.ltp > 0)
      ? ceQuote.ltp
      : cePriceBS;
    const peLtp = (peQuote && typeof peQuote.ltp === 'number' && peQuote.ltp > 0)
      ? peQuote.ltp
      : pePriceBS;

    const ceOiLakh = (ceQuote && typeof ceQuote.opnInterest === 'number')
      ? Math.round((ceQuote.opnInterest / 100000) * 10) / 10
      : 0;
    const peOiLakh = (peQuote && typeof peQuote.opnInterest === 'number')
      ? Math.round((peQuote.opnInterest / 100000) * 10) / 10
      : 0;

    if (ceOiLakh > maxOi) maxOi = ceOiLakh;
    if (peOiLakh > maxOi) maxOi = peOiLakh;

    return {
      strike,
      CE: {
        symbol: ceSymbol,
        ltp: ceLtp,
        oiLakh: ceOiLakh,
        delta: ceDelta,
        theta: ceTheta,
        vega: vega,
        gamma: gamma
      },
      PE: {
        symbol: peSymbol,
        ltp: peLtp,
        oiLakh: peOiLakh,
        delta: peDelta,
        theta: peTheta,
        vega: vega,
        gamma: gamma
      }
    };
  });

  const payload = {
    symbol,
    cleanSymbol: cleanSym,
    underlyingPrice: spotPrice,
    change,
    changePct,
    futPrice,
    ivp: '--',
    lotSize,
    expiries,
    selectedExpiry,
    maxOi: Math.max(maxOi, 1.0),
    data
  };

    optionChainCache[cacheKey] = payload;
    optionChainCacheTime[cacheKey] = Date.now();

    return payload;
  })();

  inFlightOptionChains.set(cacheKey, buildPromise);
  try {
    return await buildPromise;
  } finally {
    inFlightOptionChains.delete(cacheKey);
  }
}
