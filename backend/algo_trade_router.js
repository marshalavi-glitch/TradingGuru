import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { buildExcelWorkbook } from './excel_generator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ALGO_TRADES_FILE = path.join(__dirname, 'data', 'algo_trades_log.json');

export const INITIAL_CAPITAL = 1500000; // ₹15,00,000 (15 Lakhs)
const MAX_CONCURRENT_TRADES = 6;
const MAX_RISK_PER_TRADE = 15000; // 1% of ₹15,00,000

// Ensure data directory exists
if (!fs.existsSync(path.join(__dirname, 'data'))) {
  fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true });
}

// In-memory trade cache
let algoTradesCache = [];

export function loadAlgoTradesFromDisk() {
  try {
    if (fs.existsSync(ALGO_TRADES_FILE)) {
      const raw = JSON.parse(fs.readFileSync(ALGO_TRADES_FILE, 'utf8'));
      if (Array.isArray(raw)) {
        algoTradesCache = raw;
      } else if (raw && Array.isArray(raw.trades)) {
        algoTradesCache = raw.trades;
      }
      console.log(`[Algo Trade] Loaded ${algoTradesCache.length} trades from disk (${ALGO_TRADES_FILE})`);
    }
  } catch (e) {
    console.error('[Algo Trade] Error reading ALGO_TRADES_FILE:', e.message);
  }
  return algoTradesCache;
}

loadAlgoTradesFromDisk();

export function saveAlgoTradesToDisk() {
  try {
    const payload = {
      initialCapital: INITIAL_CAPITAL,
      currency: 'INR',
      lastUpdated: new Date().toISOString(),
      trades: algoTradesCache
    };
    fs.writeFileSync(ALGO_TRADES_FILE, JSON.stringify(payload, null, 2), 'utf8');
  } catch (e) {
    console.error('[Algo Trade] Failed to save trades:', e.message);
  }
}

/**
 * Calculates exact Orderflow Levels - Marshall
 */
export function calculateMarshallLevelsFromCandles(candles) {
  if (!candles || candles.length < 2) return null;

  // Group by IST Day
  const groups = {};
  const groupKeys = [];

  candles.forEach(c => {
    const d = new Date(c.time * 1000);
    const key = d.toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
    if (!groups[key]) {
      groups[key] = [];
      groupKeys.push(key);
    }
    groups[key].push(c);
  });

  groupKeys.sort();

  const refKey = groupKeys.length >= 2 ? groupKeys[groupKeys.length - 2] : groupKeys[0];
  const refCandles = groups[refKey];
  if (!refCandles || refCandles.length === 0) return null;

  const h_prev = Math.max(...refCandles.map(c => c.high));
  const l_prev = Math.min(...refCandles.map(c => c.low));
  const sorted = [...refCandles].sort((a, b) => a.time - b.time);
  const c_prev = sorted[sorted.length - 1].close;

  let r_prev = h_prev - l_prev;
  if (r_prev <= 0) r_prev = Math.max(1, c_prev * 0.01);

  // Marshall Matrix Formulas
  const r2 = c_prev + (r_prev * 1.1 / 6.0);
  const s2 = c_prev - (r_prev * 1.1 / 6.0);
  const r3 = c_prev + (r_prev * 1.1 / 4.0); // Sell Reversal (SR)
  const s3 = c_prev - (r_prev * 1.1 / 4.0); // Buy Reversal (BR)
  const r4 = c_prev + (r_prev * 1.1 / 2.0); // Bullish Breakout
  const s4 = c_prev - (r_prev * 1.1 / 2.0); // Bearish Breakdown

  const r5 = r4 + 1.168 * (r4 - r3);       // Upper Target 1
  const s5 = s4 - 1.168 * (s3 - s4);       // Lower Target 1
  const r6 = r5 + 1.168 * (r4 - r3);       // Upper Target 2
  const s6 = Math.max(0.05, s5 - 1.168 * (s3 - s4)); // Lower Target 2

  // Current session Intraday VWAP
  const curKey = groupKeys[groupKeys.length - 1];
  const curCandles = groups[curKey] || [];
  let cumVol = 0;
  let cumTyp = 0;
  curCandles.forEach(c => {
    const vol = c.volume || 1;
    const typ = (c.high + c.low + c.close) / 3;
    cumVol += vol;
    cumTyp += typ * vol;
  });
  const vwap = cumVol > 0 ? cumTyp / cumVol : c_prev;

  return {
    buyReversal: Math.round(s3 * 100) / 100,
    sellReversal: Math.round(r3 * 100) / 100,
    breakout: Math.round(r4 * 100) / 100,
    breakdown: Math.round(s4 * 100) / 100,
    upperTarget1: Math.round(r5 * 100) / 100,
    upperTarget2: Math.round(r6 * 100) / 100,
    lowerTarget1: Math.round(s5 * 100) / 100,
    lowerTarget2: Math.round(s6 * 100) / 100,
    r2: Math.round(r2 * 100) / 100,
    s2: Math.round(s2 * 100) / 100,
    vwap: Math.round(vwap * 100) / 100
  };
}

import { getLotSize as getAuthoritativeLotSize } from './lot_sizes.js';

export function getStandardLotSize(symbol, fallback = 25) {
  if (!symbol) return fallback;
  return getAuthoritativeLotSize(symbol) || fallback;
}

export function getStockStrikeInterval(code, price) {
  const sym = (code || '').toUpperCase().replace(/^(NSE:|BSE:|NFO:)/, '');
  if (sym === 'NIFTY') return 50;
  if (sym === 'BANKNIFTY') return 100;
  if (sym === 'FINNIFTY') return 50;
  if (sym === 'MIDCPNIFTY') return 25;
  if (price > 10000) return 200;
  if (price > 5000) return 100;
  if (price > 2500) return 50;
  if (price > 1000) return 20;
  if (price > 500) return 10;
  if (price > 250) return 5;
  return 2.5;
}

export function getStockAtmStrike(code, price) {
  const interval = getStockStrikeInterval(code, price);
  return Math.round(price / interval) * interval;
}

export function calculateStockOptionPremium(code, spotPrice, optionType) {
  const sym = (code || '').toUpperCase().replace(/^(NSE:|BSE:|NFO:)/, '');
  let ratio = 0.014;
  // Specific indices MUST be checked before general NIFTY
  if (sym.includes('BANKNIFTY')) ratio = 0.005;
  else if (sym.includes('MIDCPNIFTY')) ratio = 0.005;
  else if (sym.includes('FINNIFTY')) ratio = 0.0045;
  else if (sym.includes('NIFTY')) ratio = 0.004;
  else if (spotPrice > 3000) ratio = 0.012;
  else if (spotPrice > 1000) ratio = 0.014;
  else ratio = 0.016;

  const rawPremium = spotPrice * ratio;
  return Math.max(1.0, Math.round(rawPremium * 10) / 10);
}

export const UNIVERSE = [
  // NSE Core Benchmark Indices
  { symbol: 'NSE:NIFTY', name: 'NIFTY 50', group: 'INDEX', defaultPrice: 25155 },
  { symbol: 'NSE:BANKNIFTY', name: 'BANK NIFTY', group: 'INDEX', defaultPrice: 62100 },
  { symbol: 'NSE:FINNIFTY', name: 'FIN NIFTY', group: 'INDEX', defaultPrice: 27920 },
  { symbol: 'NSE:MIDCPNIFTY', name: 'MIDCP NIFTY', group: 'INDEX', defaultPrice: 13985 },

  // Top Liquid NSE F&O Stocks
  { symbol: 'NSE:RELIANCE', name: 'RELIANCE', group: 'EQUITY', defaultPrice: 1270 },
  { symbol: 'NSE:HDFCBANK', name: 'HDFC BANK', group: 'EQUITY', defaultPrice: 1780 },
  { symbol: 'NSE:ICICIBANK', name: 'ICICI BANK', group: 'EQUITY', defaultPrice: 1260 },
  { symbol: 'NSE:SBIN', name: 'STATE BANK', group: 'EQUITY', defaultPrice: 820 },
  { symbol: 'NSE:INFY', name: 'INFOSYS', group: 'EQUITY', defaultPrice: 1880 },
  { symbol: 'NSE:TCS', name: 'TCS', group: 'EQUITY', defaultPrice: 4150 },
  { symbol: 'NSE:BHARTIARTL', name: 'BHARTI AIRTEL', group: 'EQUITY', defaultPrice: 1580 },
  { symbol: 'NSE:ITC', name: 'ITC', group: 'EQUITY', defaultPrice: 475 },
  { symbol: 'NSE:LT', name: 'L&T', group: 'EQUITY', defaultPrice: 3600 },
  { symbol: 'NSE:AXISBANK', name: 'AXIS BANK', group: 'EQUITY', defaultPrice: 1180 },
  { symbol: 'NSE:KOTAKBANK', name: 'KOTAK BANK', group: 'EQUITY', defaultPrice: 1750 },
  { symbol: 'NSE:TATAMOTORS', name: 'TATA MOTORS', group: 'EQUITY', defaultPrice: 810 },
  { symbol: 'NSE:BAJFINANCE', name: 'BAJAJ FINANCE', group: 'EQUITY', defaultPrice: 6900 },
  { symbol: 'NSE:MARUTI', name: 'MARUTI', group: 'EQUITY', defaultPrice: 11500 },
  { symbol: 'NSE:SUNPHARMA', name: 'SUN PHARMA', group: 'EQUITY', defaultPrice: 1780 },
  { symbol: 'NSE:TITAN', name: 'TITAN', group: 'EQUITY', defaultPrice: 3250 },

  // MCX Commodities (Active Trading Hours: 9:00 AM - 11:30 PM) - Only Crude & NG per user rule
  { symbol: 'MCX:CRUDEOIL', name: 'CRUDE OIL', group: 'COMMODITY', defaultPrice: 7864 },
  { symbol: 'MCX:NATURALGAS', name: 'NATURAL GAS', group: 'COMMODITY', defaultPrice: 282 }
];

let cachedScan = {
  timestamp: 0,
  items: []
};

export function formatISTDateTime(dateObj = new Date()) {
  const dateStr = dateObj.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  const timeStr = dateObj.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  return {
    dateStr,
    timeStr,
    dateTimeStr: `${dateStr} ${timeStr} IST`
  };
}

/**
 * Returns exact IST time and market trading session status
 */
export function getISTMarketHours() {
  const now = new Date();
  const istFormatter = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
  const parts = istFormatter.formatToParts(now);
  const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0', 10);
  const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0', 10);
  const second = parseInt(parts.find(p => p.type === 'second')?.value || '0', 10);

  const dayStr = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(now);
  const isWeekday = !['Sat', 'Sun'].includes(dayStr);
  const totalMinutes = hour * 60 + minute;

  // All other (NSE/BSE Equities, Stock Options, Index Options): 9:15 AM (555 min) to 3:10 PM (910 min)
  const isNSEActive = isWeekday && (totalMinutes >= 555 && totalMinutes <= 910);
  // MCX Commodities: 9:00 AM (540 min) until it closes (11:30 PM = 1410 min)
  const isMCXActive = isWeekday && (totalMinutes >= 540 && totalMinutes <= 1410);

  return {
    hour,
    minute,
    second,
    isWeekday,
    totalMinutes,
    isNSEActive,
    isMCXActive,
    currentTimeIST: `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')} IST`
  };
}

export function isCommodityTrade(trade) {
  if (!trade) return false;
  const sym = String(trade.symbol || '').toUpperCase();
  const uSym = String(trade.underlyingSymbol || '').toUpperCase();
  const seg = String(trade.segment || '').toUpperCase();
  return seg === 'COMMODITY' || sym.startsWith('MCX:') || uSym.startsWith('MCX:') || sym.includes('CRUDE') || sym.includes('NATURALGAS');
}

export function isSymbolInTradingHours(symbol) {
  const hours = getISTMarketHours();
  if (!hours.isWeekday) return false;
  const s = String(symbol || '').toUpperCase();
  const isCommodity = s.startsWith('MCX:') || s.includes('CRUDE') || s.includes('NATURALGAS');
  if (isCommodity) {
    return hours.isMCXActive; // 9:00 AM until market close (11:30 PM IST)
  }
  return hours.isNSEActive; // 9:15 AM to 3:10 PM IST
}

/**
 * Executes trade directly into the ₹15L capital ledger
 */
export function executeAlgoTradeInternal({
  symbol,
  underlyingSymbol,
  segment,
  optionType,
  spotAtEntry,
  strategy,
  direction,
  entryPrice,
  stopLossPrice,
  target1Price,
  target2Price,
  quantity,
  lotSize,
  reason,
  levels
}) {
  const numEntry = parseFloat(entryPrice);
  const numSL = parseFloat(stopLossPrice);
  const numT1 = parseFloat(target1Price || (direction === 'BUY' ? numEntry * 1.35 : numEntry * 0.65));
  const numT2 = parseFloat(target2Price || (direction === 'BUY' ? numEntry * 1.80 : numEntry * 0.40));

  const perShareRisk = Math.max(0.1, Math.abs(numEntry - numSL));
  const cleanCode = (underlyingSymbol || symbol).replace(/^(NSE:|BSE:|MCX:|NFO:)/, '').split(' ')[0].toUpperCase();

  // Strict Duplicate Prevention Guard
  const hasExisting = algoTradesCache.some(t => 
    (t.status === 'OPEN' || t.status === 'TARGET_1_HIT') &&
    (t.symbol === symbol || t.underlyingSymbol === (underlyingSymbol || symbol) || 
     (cleanCode && t.symbol && t.symbol.toUpperCase().startsWith(cleanCode)))
  );
  if (hasExisting) {
    console.warn(`[Algo Engine] Blocked duplicate execution for ${symbol} - position already active.`);
    return null;
  }

  // User Rule 1: "Gold and silver do not buy"
  if (cleanCode.includes('GOLD') || cleanCode.includes('SILVER') || symbol.toUpperCase().includes('GOLD') || symbol.toUpperCase().includes('SILVER')) {
    console.warn(`[Algo Engine] Skipped ${symbol}: Gold & Silver buying is strictly disabled by user rule.`);
    return null;
  }

  const isOption = segment === 'STOCK_OPTION' || segment === 'INDEX_OPTION' || symbol.endsWith('CE') || symbol.endsWith('PE') || symbol.includes(' CE') || symbol.includes(' PE');
  const lot = lotSize || STOCK_LOT_SIZES[cleanCode] || 1;
  let calculatedQty = 1;

  // User Rule 2: "Options always look to buy 1 to 5 lots"
  if (isOption) {
    let lots = Math.floor(MAX_RISK_PER_TRADE / (perShareRisk * lot));
    if (isNaN(lots) || lots < 1) lots = 1;
    lots = Math.min(5, Math.max(1, lots)); // Strictly 1 to 5 lots
    calculatedQty = lots * lot;
  }
  // User Rule 3: "Only Crude 1 lot and ng 1 lots"
  else if (cleanCode === 'CRUDEOIL') {
    calculatedQty = 100; // exactly 1 lot of Crude Oil
  }
  else if (cleanCode === 'NATURALGAS') {
    calculatedQty = 1250; // exactly 1 lot of Natural Gas
  }
  // User Rule 4: "Stocks can be 100-500 qty as per Marshall rule engine"
  else {
    let stockQty = Math.floor(MAX_RISK_PER_TRADE / perShareRisk);
    if (isNaN(stockQty) || stockQty < 100) stockQty = 100;
    stockQty = Math.min(500, Math.max(100, stockQty));
    calculatedQty = Math.round(stockQty / 25) * 25;
    if (calculatedQty < 100) calculatedQty = 100;
    if (calculatedQty > 500) calculatedQty = 500;
  }

  let finalQty = calculatedQty;
  if (parseInt(quantity, 10) > 0) {
    if (isOption && lot > 1) {
      const qLots = Math.round(parseInt(quantity, 10) / lot);
      finalQty = Math.min(5, Math.max(1, qLots)) * lot;
    } else if (cleanCode === 'CRUDEOIL') {
      finalQty = 100;
    } else if (cleanCode === 'NATURALGAS') {
      finalQty = 1250;
    } else if (!isOption && !cleanCode.startsWith('MCX:')) {
      finalQty = Math.min(500, Math.max(100, parseInt(quantity, 10)));
    } else {
      finalQty = parseInt(quantity, 10);
    }
  }
  const capitalAllocated = Math.round(numEntry * finalQty);
  const riskAmount = Math.round(perShareRisk * finalQty);
  const riskPct = ((riskAmount / INITIAL_CAPITAL) * 100).toFixed(2);
  const rrRatio = (Math.abs(numT1 - numEntry) / perShareRisk).toFixed(2);

  const now = new Date();
  const ist = formatISTDateTime(now);

  const trade = {
    id: `ALGO_${now.toISOString().slice(0, 10).replace(/-/g, '')}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
    symbol,
    underlyingSymbol: underlyingSymbol || symbol,
    segment: segment || (symbol.includes('CE') || symbol.includes('PE') ? 'STOCK_OPTION' : (symbol.startsWith('MCX:') ? 'COMMODITY' : 'EQUITY')),
    optionType: optionType || (symbol.endsWith('CE') ? 'CE' : (symbol.endsWith('PE') ? 'PE' : null)),
    spotAtEntry: spotAtEntry || numEntry,
    strategy: strategy || 'PRIMARY_BUY',
    direction: direction || 'BUY',
    entryPrice: numEntry,
    stopLossPrice: numSL,
    target1Price: numT1,
    target2Price: numT2,
    riskRewardRatio: parseFloat(rrRatio),
    quantity: finalQty,
    lotSize: lot,
    initialQuantity: finalQty,
    capitalAllocated,
    riskAmount,
    riskPctOfCapital: `${riskPct}%`,
    accountCapital: INITIAL_CAPITAL,
    status: 'OPEN',
    entryDate: ist.dateStr,
    entryTime: ist.timeStr,
    entryDateTime: ist.dateTimeStr,
    entryTimestamp: now.getTime(),
    exitDate: null,
    exitTime: null,
    exitDateTime: null,
    exitPrice: null,
    exitReason: null,
    currentLtp: numEntry,
    unrealizedPnL: 0,
    realizedPnL: 0,
    roiPct: 0,
    triggerReason: reason || 'Marshall indicator confirmed setup',
    levelsAtEntry: levels || null,
    auditTrail: [
      {
        timestamp: now.toISOString(),
        dateTimeIST: ist.dateTimeStr,
        event: 'ORDER_EXECUTED',
        details: `Auto-Triggered ${direction} on ${symbol}: ${finalQty} units @ ₹${numEntry} (Capital: ₹${capitalAllocated.toLocaleString('en-IN')}, Risk: ₹${riskAmount.toLocaleString('en-IN')})`
      }
    ],
    notes: [`Auto-triggered by Marshall Engine at ${ist.dateTimeStr}`]
  };

  algoTradesCache.unshift(trade);
  saveAlgoTradesToDisk();
  return trade;
}

/**
 * Autonomous Background Engine Runner
 * Evaluates open positions and automatically triggers new trades during active trading hours
 */
let isRunningCycle = false;

async function runAlgoExecutionCycle(getRealtimeLtp, fetchFreshCandles, scannerCache, wss) {
  if (isRunningCycle) return;
  isRunningCycle = true;
  try {
    const hours = getISTMarketHours();
    if (!hours.isWeekday) return;

  function broadcast(event, data) {
    if (wss && wss.clients) {
      const msg = JSON.stringify({ type: event, data });
      wss.clients.forEach(c => {
        if (c.readyState === 1) {
          try { c.send(msg); } catch (e) {}
        }
      });
    }
  }

  // =========================================================================
  // STEP 1: MANAGE ACTIVE OPEN POSITIONS (Trail SL, Target 1, Target 2, Stop Loss)
  // =========================================================================
  for (const trade of algoTradesCache) {
    if (trade.status === 'OPEN' || trade.status === 'TARGET_1_HIT') {
      try {
        let liveLtp = await getRealtimeLtp(trade.symbol);
        if ((!liveLtp || liveLtp <= 0) && (trade.segment === 'STOCK_OPTION' || trade.segment === 'INDEX_OPTION')) {
          const spotLtp = await getRealtimeLtp(trade.underlyingSymbol || trade.symbol);
          if (spotLtp && spotLtp > 0 && trade.spotAtEntry) {
            const spotMovePct = Math.abs(spotLtp - trade.spotAtEntry) / trade.spotAtEntry;
            if (spotMovePct > 0.035) {
              console.warn(`[Algo Engine] Shielded anomalous spot price for ${trade.symbol}: spotLtp ${spotLtp} deviates ${(spotMovePct * 100).toFixed(1)}% from entry spot ${trade.spotAtEntry}. Ignoring tick.`);
              continue;
            }
            const spotMove = spotLtp - trade.spotAtEntry;
            const delta = trade.optionType === 'CE' ? 0.52 : -0.52;
            const premiumChange = spotMove * delta;
            const estimatedPrice = Math.round((trade.entryPrice + premiumChange) * 10) / 10;
            if (estimatedPrice > 1.0) {
              liveLtp = estimatedPrice;
            }
          }
        }

        // Telemetry Anomaly Shield: Ignore zero/near-zero quotes or abnormal drops during server restarts / API cooldowns
        if (!liveLtp || liveLtp <= 1.0 || (trade.entryPrice > 20 && liveLtp < trade.entryPrice * 0.15)) {
          // Unreliable or missing quote - never evaluate Stop Loss or Target triggers on anomalous telemetry
          continue;
        }

        if (liveLtp && liveLtp > 0) {
          trade.currentLtp = liveLtp;
          const pnlPts = trade.direction === 'BUY' ? (liveLtp - trade.entryPrice) : (trade.entryPrice - liveLtp);
          trade.unrealizedPnL = Math.round(pnlPts * trade.quantity);

          const now = new Date();
          const ist = formatISTDateTime(now);

          // Auto Square-off Rules:
          // 1. All non-commodity positions (Stocks, Stock Options, Index Options) automatically square off at 3:10 PM IST (totalMinutes >= 910)
          // 2. Commodity trades (Crude Oil, Natural Gas) trade from 9:00 AM until close and are exempt from the 3:10 PM square-off. They auto square-off at MCX close (11:25 PM IST / 1405 min).
          const isCommodity = isCommodityTrade(trade);
          const shouldSquareOff = isCommodity ? (hours.totalMinutes >= 1405) : (hours.totalMinutes >= 910);
          if (shouldSquareOff) {
            trade.status = 'CLOSED';
            trade.exitPrice = liveLtp;
            trade.exitDate = ist.dateStr;
            trade.exitTime = ist.timeStr;
            trade.exitDateTime = ist.dateTimeStr;
            trade.exitTimestamp = now.getTime();
            trade.exitReason = isCommodity 
              ? 'Intraday Commodity Auto Square-off (MCX Market Close 11:25 PM IST)' 
              : 'Intraday Session Auto Square-off (3:10 PM IST Cutoff)';
            trade.realizedPnL = trade.unrealizedPnL;
            trade.unrealizedPnL = 0;
            trade.roiPct = Math.round((trade.realizedPnL / (trade.capitalAllocated || 1)) * 10000) / 100;
            trade.auditTrail.push({
              timestamp: now.toISOString(),
              dateTimeIST: ist.dateTimeStr,
              event: 'EOD_SQUAREOFF',
              details: `${trade.exitReason} @ ₹${liveLtp} (P&L: ₹${trade.realizedPnL > 0 ? '+' : ''}${trade.realizedPnL.toLocaleString('en-IN')})`
            });
            saveAlgoTradesToDisk();
            broadcast('ALGO_TRADE_UPDATED', trade);
            console.log(`[Algo Engine] ⏰ Auto Square-off executed for ${trade.symbol} (${trade.exitReason}) @ ₹${liveLtp}. P&L: ₹${trade.realizedPnL}`);
            continue;
          }

          // Target 1: Book 50% partial profit into Realized P&L, trail SL to Breakeven
          if (trade.status === 'OPEN') {
            const isTgt1Hit = trade.direction === 'BUY' ? liveLtp >= trade.target1Price : liveLtp <= trade.target1Price;
            if (isTgt1Hit) {
              trade.status = 'TARGET_1_HIT';
              trade.stopLossPrice = trade.entryPrice; // Move SL to Breakeven

              // Book 50% partial profit into Realized P&L (or 100% if single lot)
              const lotSize = trade.lotSize || 1;
              const totalLots = Math.max(1, Math.round((trade.initialQuantity || trade.quantity) / lotSize));
              const bookedLots = totalLots === 1 ? 1 : Math.max(1, Math.floor(totalLots / 2));
              const bookedQty = bookedLots * lotSize;
              const remainingQty = Math.max(0, (trade.initialQuantity || trade.quantity) - bookedQty);
              const pnlPoints = trade.direction === 'BUY' ? (liveLtp - trade.entryPrice) : (trade.entryPrice - liveLtp);
              const partialRealizedPnL = Math.round(pnlPoints * bookedQty);

              trade.realizedPnL = (trade.realizedPnL || 0) + partialRealizedPnL;
              trade.bookedQuantity = (trade.bookedQuantity || 0) + bookedQty;
              trade.initialQuantity = trade.initialQuantity || trade.quantity;
              trade.quantity = remainingQty;
              trade.unrealizedPnL = remainingQty > 0 ? Math.round(pnlPoints * remainingQty) : 0;

              if (remainingQty === 0) {
                trade.exitPrice = liveLtp;
                trade.exitDate = ist.dateStr;
                trade.exitTime = ist.timeStr;
                trade.exitDateTime = ist.dateTimeStr;
                trade.exitTimestamp = now.getTime();
                trade.exitReason = 'Target 1 Achieved (Full Profit Booked)';
                trade.roiPct = Math.round((trade.realizedPnL / (trade.capitalAllocated || 1)) * 10000) / 100;
              }

              trade.auditTrail.push({
                timestamp: now.toISOString(),
                dateTimeIST: ist.dateTimeStr,
                event: 'TARGET_1_ACHIEVED',
                details: `Target 1 (₹${trade.target1Price}) reached @ ₹${liveLtp}. Booked profit (+₹${partialRealizedPnL.toLocaleString('en-IN')}) on ${bookedQty} units (${bookedLots} lots). ${remainingQty > 0 ? `Remaining ${remainingQty} units trailing risk-free to Breakeven (₹${trade.entryPrice}) for Target 2 (₹${trade.target2Price}).` : 'Full position closed in profit.'}`
              });
              saveAlgoTradesToDisk();
              broadcast('ALGO_TRADE_UPDATED', trade);
              console.log(`[Algo Engine] 🎯 Target 1 reached for ${trade.symbol} @ ₹${liveLtp}! Booked (+₹${partialRealizedPnL}).`);
              if (remainingQty === 0) continue;
            }
          }

          // Target 2: Full exit with profit
          const isTgt2Hit = trade.direction === 'BUY' ? liveLtp >= trade.target2Price : liveLtp <= trade.target2Price;
          if (isTgt2Hit && trade.quantity > 0) {
            trade.status = 'TARGET_2_HIT';
            trade.exitPrice = liveLtp;
            trade.exitDate = ist.dateStr;
            trade.exitTime = ist.timeStr;
            trade.exitDateTime = ist.dateTimeStr;
            trade.exitTimestamp = now.getTime();
            trade.exitReason = 'Target 2 Achieved (Automated TP)';
            const finalPnlPts = trade.direction === 'BUY' ? (liveLtp - trade.entryPrice) : (trade.entryPrice - liveLtp);
            const remainingPnl = Math.round(finalPnlPts * trade.quantity);
            trade.realizedPnL = (trade.realizedPnL || 0) + remainingPnl;
            trade.quantity = 0;
            trade.unrealizedPnL = 0;
            trade.roiPct = Math.round((trade.realizedPnL / (trade.capitalAllocated || 1)) * 10000) / 100;
            trade.auditTrail.push({
              timestamp: now.toISOString(),
              dateTimeIST: ist.dateTimeStr,
              event: 'TARGET_2_ACHIEVED',
              details: `Target 2 (₹${trade.target2Price}) hit @ ₹${liveLtp}! Full profit booked: ₹${trade.realizedPnL} (${trade.roiPct}%)`
            });
            saveAlgoTradesToDisk();
            broadcast('ALGO_TRADE_UPDATED', trade);
            console.log(`[Algo Engine] 🏆 Target 2 hit for ${trade.symbol} @ ₹${liveLtp}! Realized P&L: ₹${trade.realizedPnL}`);
            continue;
          }

          // Stop Loss Hit: Exit immediately
          const isSLHit = trade.direction === 'BUY' ? liveLtp <= trade.stopLossPrice : liveLtp >= trade.stopLossPrice;
          if (isSLHit && trade.quantity > 0) {
            trade.status = 'SL_HIT';
            const exitP = trade.stopLossPrice || liveLtp;
            trade.exitPrice = exitP;
            trade.exitDate = ist.dateStr;
            trade.exitTime = ist.timeStr;
            trade.exitDateTime = ist.dateTimeStr;
            trade.exitTimestamp = now.getTime();
            trade.exitReason = trade.status === 'TARGET_1_HIT' ? 'Breakeven Trailed SL Hit' : 'Stop Loss Hit (Automated SL)';
            const finalPnlPts = trade.direction === 'BUY' ? (exitP - trade.entryPrice) : (trade.entryPrice - exitP);
            const remainingPnl = Math.round(finalPnlPts * trade.quantity);
            trade.realizedPnL = (trade.realizedPnL || 0) + remainingPnl;
            trade.quantity = 0;
            trade.unrealizedPnL = 0;
            trade.roiPct = Math.round((trade.realizedPnL / (trade.capitalAllocated || 1)) * 10000) / 100;
            trade.auditTrail.push({
              timestamp: now.toISOString(),
              dateTimeIST: ist.dateTimeStr,
              event: 'STOP_LOSS_HIT',
              details: `Stopped out @ ₹${exitP}. Realized P&L: ₹${trade.realizedPnL} (${trade.roiPct}%)`
            });
            saveAlgoTradesToDisk();
            broadcast('ALGO_TRADE_UPDATED', trade);
            console.log(`[Algo Engine] 🛑 Stop Loss hit for ${trade.symbol} @ ₹${exitP}. P&L: ₹${trade.realizedPnL}`);
          }
        }
      } catch (posErr) {
        // Continue monitoring next position
      }
    }
  }

  // =========================================================================
  // STEP 2: SCAN UNIVERSE & AUTO-EXECUTE NEW CONFIRMED SETUPS (BAR-BY-BAR MARSHALL LOGIC)
  // =========================================================================
  const openTrades = algoTradesCache.filter(t => t.status === 'OPEN' || t.status === 'TARGET_1_HIT');
  if (openTrades.length >= MAX_CONCURRENT_TRADES) {
    return; // Risk control: max concurrent positions reached
  }

  for (const item of UNIVERSE) {
    if (openTrades.length >= MAX_CONCURRENT_TRADES) break;

    // Strict Market Hours Filter: 09:15 to 15:10 for NSE, 09:00 to 23:30 for MCX
    if (!isSymbolInTradingHours(item.symbol)) continue;

    // Prevent duplicate entries on active symbol (Matches symbol, underlyingSymbol, and option prefix)
    const cleanSymName = item.symbol.replace(/^(NSE:|BSE:|MCX:)/, '').toUpperCase();
    const hasActiveTrade = algoTradesCache.some(t => 
      (t.status === 'OPEN' || t.status === 'TARGET_1_HIT') && 
      (t.symbol === item.symbol || t.underlyingSymbol === item.symbol || (t.symbol && t.symbol.toUpperCase().startsWith(cleanSymName)))
    );
    if (hasActiveTrade) continue;

    // Cooldown check (15 min after exit on same symbol)
    const closedSymbolTrades = algoTradesCache.filter(t => 
      (t.status === 'CLOSED' || t.status === 'TARGET_2_HIT' || t.status === 'SL_HIT') && 
      (t.symbol === item.symbol || t.underlyingSymbol === item.symbol || (t.symbol && t.symbol.toUpperCase().startsWith(cleanSymName)))
    );
    const mostRecentExit = closedSymbolTrades.length > 0 
      ? Math.max(...closedSymbolTrades.map(t => t.exitTimestamp || t.entryTimestamp || 0))
      : 0;
    if (mostRecentExit > 0 && (Date.now() - mostRecentExit) < 15 * 60 * 1000) {
      continue;
    }

    try {
      // 1. Fetch real completed 5-minute candles (background, non-blocking)
      const fetched = await fetchFreshCandles(item.symbol, '5', 100, false);
      const candles = fetched?.candles || [];
      if (!candles || candles.length < 25) {
        await new Promise(r => setTimeout(r, 200));
        continue;
      }

      // 2. Calculate Marshall Pivot Matrix from daily candles / session
      const levels = calculateMarshallLevelsFromCandles(candles);
      if (!levels) continue;

      // 3. Extract the last completed 5m candle (index -2) and the prior candle (index -3)
      const closedBar = candles[candles.length - 2];
      const priorBar = candles[candles.length - 3];
      if (!closedBar || !priorBar) continue;

      // 4. Compute 20-period Volume SMA
      const volSlice = candles.slice(-22, -2);
      const avgVol20 = volSlice.reduce((sum, c) => sum + (c.volume || 0), 0) / Math.max(1, volSlice.length);
      const volRatio = avgVol20 > 0 ? (closedBar.volume || 0) / avgVol20 : 1.0;
      const volumeConfirmed = volRatio >= 1.20; // 1.20x volume conviction rule

      // 5. Candle Anatomy Evaluation
      const isGreen = closedBar.close >= closedBar.open;
      const body = Math.abs(closedBar.close - closedBar.open);
      const totalRange = Math.max(0.01, closedBar.high - closedBar.low);
      const lowerWick = Math.min(closedBar.open, closedBar.close) - closedBar.low;
      const upperWick = closedBar.high - Math.max(closedBar.open, closedBar.close);
      const vwap = levels.vwap || closedBar.close;

      let triggerStrategy = null;
      let direction = null;
      let entryPrice = closedBar.close;
      let stopLossPrice = 0;
      let target1Price = 0;
      let target2Price = 0;
      let triggerReason = '';

      const isBreakoutCross = priorBar.close <= levels.breakout && closedBar.close > levels.breakout;
      const isBullishCandle = isGreen && (lowerWick >= body * 0.5 || (body / totalRange) >= 0.70);
      const isBreakdownCross = priorBar.close >= levels.breakdown && closedBar.close < levels.breakdown;
      const isBearishCandle = !isGreen && (upperWick >= body * 0.5 || (body / totalRange) >= 0.70);

      // Marshall Strategy 1: Primary Buy (Breakout above R4 with S3 holding, Volume >= 1.2x, VWAP aligned)
      if (isBreakoutCross && closedBar.close >= levels.buyReversal && closedBar.close >= vwap && volumeConfirmed && isBullishCandle) {
        triggerStrategy = 'PRIMARY_BUY';
        direction = 'BUY';
        entryPrice = closedBar.close;
        stopLossPrice = levels.buyReversal;
        target1Price = levels.upperTarget1;
        target2Price = levels.upperTarget2;
        triggerReason = `Marshall Strategy 1: Confirmed Breakout close above R4 (₹${levels.breakout}) with Buy Reversal (₹${levels.buyReversal}) holding. Vol: ${volRatio.toFixed(2)}x (>=1.2x), above VWAP (₹${vwap})`;
      }
      // Marshall Strategy 2: Primary Sell (Breakdown below S4 with R3 rejecting, Volume >= 1.2x, VWAP aligned)
      else if (isBreakdownCross && closedBar.close <= levels.sellReversal && closedBar.close <= vwap && volumeConfirmed && isBearishCandle) {
        triggerStrategy = 'PRIMARY_SELL';
        direction = 'SELL';
        entryPrice = closedBar.close;
        stopLossPrice = levels.sellReversal;
        target1Price = levels.lowerTarget1;
        target2Price = levels.lowerTarget2;
        triggerReason = `Marshall Strategy 2: Confirmed Breakdown close below S4 (₹${levels.breakdown}) with Sell Reversal (₹${levels.sellReversal}) rejecting. Vol: ${volRatio.toFixed(2)}x (>=1.2x), below VWAP (₹${vwap})`;
      }
      // Marshall Strategy 3: Continuation Buy Retest (Pullback holding at Upper Target 1)
      else if (closedBar.low <= levels.upperTarget1 * 1.002 && closedBar.close > levels.upperTarget1 && isGreen && lowerWick >= body * 0.6) {
        triggerStrategy = 'CONTINUATION_BUY';
        direction = 'BUY';
        entryPrice = closedBar.close;
        stopLossPrice = levels.breakout;
        target1Price = levels.upperTarget2;
        target2Price = Math.round((levels.upperTarget2 + (levels.upperTarget2 - levels.upperTarget1)) * 100) / 100;
        triggerReason = `Marshall Strategy 3: Continuation Buy confirmed pullback retest holding at Upper Target 1 (₹${levels.upperTarget1}) with lower wick rejection`;
      }
      // Marshall Strategy 4: Continuation Sell Retest (Rally rejecting Lower Target 1)
      else if (closedBar.high >= levels.lowerTarget1 * 0.998 && closedBar.close < levels.lowerTarget1 && !isGreen && upperWick >= body * 0.6) {
        triggerStrategy = 'CONTINUATION_SELL';
        direction = 'SELL';
        entryPrice = closedBar.close;
        stopLossPrice = levels.breakdown;
        target1Price = levels.lowerTarget2;
        target2Price = Math.round((levels.lowerTarget2 - (levels.lowerTarget1 - levels.lowerTarget2)) * 100) / 100;
        triggerReason = `Marshall Strategy 4: Continuation Sell confirmed rally retest rejecting Lower Target 1 (₹${levels.lowerTarget1}) with upper wick rejection`;
      }

      if (triggerStrategy && direction) {
        const cleanSym = item.symbol.replace(/^(NSE:|BSE:|MCX:)/, '');
        const isStockOrIndex = item.symbol.startsWith('NSE:');

        if (isStockOrIndex) {
          // BUY REAL STOCK OPTIONS ONLY (No synthetic options permitted)
          const strike = getStockAtmStrike(cleanSym, closedBar.close);
          const optionType = direction === 'BUY' ? 'CE' : 'PE';
          const optionSymbol = `${cleanSym} ${strike} ${optionType}`;
          
          // Verify real exchange contract existence in active options master
          const liveOptLtp = await getRealtimeLtp(optionSymbol);
          if (!liveOptLtp || liveOptLtp <= 0.5) {
            console.log(`[Algo Engine] Skipped ${optionSymbol}: No real live exchange option quote found. Synthetic pricing is strictly disabled.`);
            continue;
          }

          const entryPremium = liveOptLtp;
          const lotSize = STOCK_LOT_SIZES[cleanSym] || 250;
          const slPremium = Math.max(0.5, Math.round(entryPremium * 0.65 * 10) / 10); // 35% risk SL
          const t1Premium = Math.round(entryPremium * 1.35 * 10) / 10; // +35% target 1 (trail to BE)
          const t2Premium = Math.round(entryPremium * 1.80 * 10) / 10; // +80% target 2

          const optionTrade = executeAlgoTradeInternal({
            symbol: optionSymbol,
            underlyingSymbol: item.symbol,
            segment: cleanSym.includes('NIFTY') ? 'INDEX_OPTION' : 'STOCK_OPTION',
            optionType,
            spotAtEntry: closedBar.close,
            strategy: triggerStrategy,
            direction: 'BUY',
            entryPrice: entryPremium,
            stopLossPrice: slPremium,
            target1Price: t1Premium,
            target2Price: t2Premium,
            lotSize,
            reason: `Stock Option BUY: Spot ${cleanSym} confirmed ${triggerStrategy} @ ₹${closedBar.close}. Bought ATM ${strike} ${optionType} Option @ ₹${entryPremium} (SL: ₹${slPremium}, T1: ₹${t1Premium}, T2: ₹${t2Premium}). ${triggerReason}`,
            levels
          });

          if (optionTrade) {
            openTrades.push(optionTrade);
            broadcast('ALGO_TRADE_EXECUTED', optionTrade);
            console.log(`[Algo Engine] 🎯 AUTO-BOUGHT REAL OPTION: ${optionSymbol} @ ₹${entryPremium} | SL: ₹${slPremium} | T1: ₹${t1Premium} | T2: ₹${t2Premium}`);
          }
        } else {
          // MCX Commodities: Only Crude 1 lot (100) & NG 1 lot (1250); Gold & Silver excluded
          if (cleanSym.includes('GOLD') || cleanSym.includes('SILVER')) continue;
          if (cleanSym !== 'CRUDEOIL' && cleanSym !== 'NATURALGAS') continue;

          const perShareRisk = Math.abs(entryPrice - stopLossPrice);
          if (stopLossPrice > 0 && target1Price > 0 && perShareRisk > 0) {
            const executedTrade = executeAlgoTradeInternal({
              symbol: item.symbol,
              underlyingSymbol: item.symbol,
              segment: 'COMMODITY',
              strategy: triggerStrategy,
              direction,
              entryPrice,
              stopLossPrice,
              target1Price,
              target2Price,
              reason: triggerReason,
              levels
            });

            if (executedTrade) {
              openTrades.push(executedTrade);
              broadcast('ALGO_TRADE_EXECUTED', executedTrade);
              console.log(`[Algo Engine] 🚀 AUTO-EXECUTED REAL COMMODITY ${direction} on ${item.symbol} @ ₹${entryPrice}`);
            }
          }
        }
      }
    } catch (symErr) {
      console.warn(`[Algo Engine] Error scanning ${item.symbol}:`, symErr.message);
    }
  }
  } finally {
    isRunningCycle = false;
  }
}

export function setupAlgoTradeRoutes(app, fetchFreshCandles, getRealtimeLtp, scannerCache, wss) {
  // Start the Autonomous Execution Background Runner (runs every 10 seconds)
  console.log('[Algo Engine] 🤖 Marshall Autonomous Strategy Execution Engine activated.');
  console.log('[Algo Engine] ⏰ Schedule: NSE Stocks/Options: 09:15 - 15:10 IST (Auto Square-off @ 3:10 PM) | MCX Commodities: 09:00 - 23:30 IST (Until Market Close)');

  // Trigger initial execution cycle after boot, then every 30 seconds
  setTimeout(() => {
    runAlgoExecutionCycle(getRealtimeLtp, fetchFreshCandles, scannerCache, wss);
  }, 5000);

  setInterval(() => {
    runAlgoExecutionCycle(getRealtimeLtp, fetchFreshCandles, scannerCache, wss);
  }, 30000);

  // Periodic heartbeat logger every 60 seconds
  setInterval(() => {
    const hours = getISTMarketHours();
    const openTrades = algoTradesCache.filter(t => t.status === 'OPEN' || t.status === 'TARGET_1_HIT');
    const closedTrades = algoTradesCache.filter(t => t.status === 'CLOSED' || t.status === 'TARGET_2_HIT' || t.status === 'SL_HIT');
    const realizedPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
    const unrealizedPnL = openTrades.reduce((sum, t) => sum + (t.unrealizedPnL || 0), 0);

    console.log(`[Algo Engine Status] IST ${hours.currentTimeIST} | NSE Active: ${hours.isNSEActive ? 'YES (09:15-15:10)' : 'NO'} | MCX Active: ${hours.isMCXActive ? 'YES (09:00-23:30)' : 'NO'} | Open Trades: ${openTrades.length} | Closed: ${closedTrades.length} | Realized P&L: ₹${realizedPnL.toLocaleString('en-IN')} | Unrealized: ₹${unrealizedPnL.toLocaleString('en-IN')}`);
  }, 60000);

  // Background Scanner Worker (Runs non-blocking every 20s)
  async function refreshScanCache() {
    try {
      const now = Date.now();
      const results = [];
      const cached5m = scannerCache?.levelsCache?.['5'] || {};

      for (const item of UNIVERSE) {
        try {
          let levels = null;
          let ltp = 0;

          if (cached5m[item.symbol] && cached5m[item.symbol].levels) {
            const cLvl = cached5m[item.symbol].levels;
            ltp = cached5m[item.symbol].currentPrice || 0;
            levels = {
              buyReversal: Math.round(cLvl.level7 * 100) / 100,
              sellReversal: Math.round(cLvl.level4 * 100) / 100,
              breakout: Math.round(cLvl.level3 * 100) / 100,
              breakdown: Math.round(cLvl.level8 * 100) / 100,
              upperTarget1: Math.round(cLvl.level2 * 100) / 100,
              upperTarget2: Math.round(cLvl.level1 * 100) / 100,
              lowerTarget1: Math.round(cLvl.level9 * 100) / 100,
              lowerTarget2: Math.round(cLvl.level10 * 100) / 100,
              r2: Math.round(cLvl.level5 * 100) / 100,
              s2: Math.round(cLvl.level6 * 100) / 100,
              vwap: Math.round((cLvl.vwap || ltp) * 100) / 100
            };
          }

          if (!levels || !ltp) {
            const liveLtp = await getRealtimeLtp(item.symbol, item.defaultPrice);
            if (liveLtp && liveLtp > 0) {
              ltp = liveLtp;
            } else if (item.defaultPrice) {
              ltp = item.defaultPrice;
            }
          }

          if (!ltp) ltp = item.defaultPrice || 100;

          // If levels are missing, approximate standard pivot zones based on ltp
          if (!levels) {
            const range = ltp * 0.008;
            levels = {
              buyReversal: Math.round((ltp - range * 0.5) * 100) / 100,
              sellReversal: Math.round((ltp + range * 0.5) * 100) / 100,
              breakout: Math.round((ltp + range * 0.8) * 100) / 100,
              breakdown: Math.round((ltp - range * 0.8) * 100) / 100,
              upperTarget1: Math.round((ltp + range * 1.5) * 100) / 100,
              upperTarget2: Math.round((ltp + range * 2.2) * 100) / 100,
              lowerTarget1: Math.round((ltp - range * 1.5) * 100) / 100,
              lowerTarget2: Math.round((ltp - range * 2.2) * 100) / 100,
              r2: Math.round((ltp + range * 1.8) * 100) / 100,
              s2: Math.round((ltp - range * 1.8) * 100) / 100,
              vwap: ltp
            };
          }

          let strategy = 'WATCHING';
          let direction = 'NEUTRAL';
          let state = 'WAITING';
          let entryPrice = ltp;
          let stopLossPrice = levels.buyReversal;
          let target1Price = levels.upperTarget1;
          let target2Price = levels.upperTarget2;
          let distancePct = 0;

          if (ltp >= levels.breakout) {
            strategy = 'PRIMARY_BUY';
            direction = 'BUY';
            state = 'BREAKOUT_CONFIRMED';
            entryPrice = ltp;
            stopLossPrice = levels.buyReversal;
            target1Price = levels.upperTarget1;
            target2Price = levels.upperTarget2;
            distancePct = Math.round(((ltp - levels.breakout) / levels.breakout) * 10000) / 100;
          } else if (ltp <= levels.breakdown) {
            strategy = 'PRIMARY_SELL';
            direction = 'SELL';
            state = 'BREAKDOWN_CONFIRMED';
            entryPrice = ltp;
            stopLossPrice = levels.sellReversal;
            target1Price = levels.lowerTarget1;
            target2Price = levels.lowerTarget2;
            distancePct = Math.round(((levels.breakdown - ltp) / levels.breakdown) * 10000) / 100;
          } else if (ltp >= levels.upperTarget1 * 0.998 && ltp <= levels.upperTarget1 * 1.008) {
            strategy = 'CONTINUATION_BUY';
            direction = 'BUY';
            state = 'RETEST_CONFIRMED';
            entryPrice = ltp;
            stopLossPrice = levels.breakout;
            target1Price = levels.upperTarget2;
            target2Price = Math.round((levels.upperTarget2 + (levels.upperTarget2 - levels.upperTarget1)) * 100) / 100;
            distancePct = Math.round(((ltp - levels.upperTarget1) / levels.upperTarget1) * 10000) / 100;
          } else if (ltp <= levels.lowerTarget1 * 1.002 && ltp >= levels.lowerTarget1 * 0.992) {
            strategy = 'CONTINUATION_SELL';
            direction = 'SELL';
            state = 'RETEST_CONFIRMED';
            entryPrice = ltp;
            stopLossPrice = levels.breakdown;
            target1Price = levels.lowerTarget2;
            target2Price = Math.round((levels.lowerTarget2 - (levels.lowerTarget1 - levels.lowerTarget2)) * 100) / 100;
            distancePct = Math.round(((levels.lowerTarget1 - ltp) / levels.lowerTarget1) * 10000) / 100;
          } else {
            const distToBreakout = Math.abs(levels.breakout - ltp) / levels.breakout;
            const distToBreakdown = Math.abs(ltp - levels.breakdown) / levels.breakdown;
            if (distToBreakout < distToBreakdown) {
              strategy = 'WATCH_BUY';
              direction = 'BUY';
              state = 'WAITING_FOR_BREAKOUT';
              entryPrice = levels.breakout;
              stopLossPrice = levels.buyReversal;
              target1Price = levels.upperTarget1;
              target2Price = levels.upperTarget2;
              distancePct = Math.round(distToBreakout * 10000) / 100;
            } else {
              strategy = 'WATCH_SELL';
              direction = 'SELL';
              state = 'WAITING_FOR_BREAKDOWN';
              entryPrice = levels.breakdown;
              stopLossPrice = levels.sellReversal;
              target1Price = levels.lowerTarget1;
              target2Price = levels.lowerTarget2;
              distancePct = Math.round(distToBreakdown * 10000) / 100;
            }
          }

          const risk = Math.max(0.1, Math.abs(entryPrice - stopLossPrice));
          const reward = Math.abs(target1Price - entryPrice);
          const rr = Math.round((reward / risk) * 100) / 100;

          results.push({
            symbol: item.symbol,
            name: item.name,
            ltp,
            currentPrice: ltp,
            strategy,
            direction,
            state,
            entryPrice,
            stopLossPrice,
            target1Price,
            target2Price,
            riskRewardRatio: rr,
            distancePct,
            levels,
            inTradingHours: isSymbolInTradingHours(item.symbol)
          });
        } catch (symErr) {}
      }

      if (results.length > 0) {
        cachedScan = { timestamp: now, items: results };
      }
    } catch (e) {}
  }

  // Trigger initial scan and schedule periodic refresh
  setTimeout(refreshScanCache, 2000);
  setInterval(refreshScanCache, 15000);

  // GET /api/algo-trade/scan (Instant cached response in <5ms)
  app.get('/api/algo-trade/scan', (req, res) => {
    res.json({
      success: true,
      timestamp: cachedScan.timestamp || Date.now(),
      items: cachedScan.items || []
    });
  });

  // POST /api/algo-trade/execute
  app.post('/api/algo-trade/execute', (req, res) => {
    try {
      const {
        symbol,
        strategy,
        direction,
        entryPrice,
        stopLossPrice,
        target1Price,
        target2Price,
        quantity,
        reason,
        levels
      } = req.body || {};

      if (!symbol || !entryPrice || !stopLossPrice) {
        return res.status(400).json({ success: false, error: 'Missing trade parameters (symbol, entryPrice, stopLossPrice)' });
      }

      const trade = executeAlgoTradeInternal({
        symbol,
        strategy,
        direction,
        entryPrice,
        stopLossPrice,
        target1Price,
        target2Price,
        quantity,
        reason,
        levels
      });

      res.json({
        success: true,
        trade,
        message: `Algo position opened for ${symbol} @ ₹${trade.entryPrice} (Qty: ${trade.quantity}, Margin: ₹${trade.capitalAllocated.toLocaleString('en-IN')})`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // POST /api/algo-trade/close & /api/algo-trade/trades/close
  const handleCloseAlgoTrade = (req, res) => {
    try {
      const { tradeId, exitPrice, reason, exitReason } = req.body || {};
      const trade = algoTradesCache.find(t => t.id === tradeId);
      if (!trade) {
        return res.status(404).json({ success: false, error: 'Trade not found' });
      }
      if (trade.status === 'CLOSED' || trade.status === 'TARGET_2_HIT' || trade.status === 'SL_HIT') {
        return res.json({ success: true, trade, message: 'Trade is already closed' });
      }

      const closeReason = exitReason || reason || 'Manual Close via Dashboard';
      const now = new Date();
      const ist = formatISTDateTime(now);
      const numExit = parseFloat(exitPrice) || trade.currentLtp || trade.entryPrice;

      const pnlPoints = trade.direction === 'BUY' ? (numExit - trade.entryPrice) : (trade.entryPrice - numExit);
      const realizedPnL = Math.round(pnlPoints * trade.quantity);
      const roiPct = Math.round((realizedPnL / (trade.capitalAllocated || 1)) * 10000) / 100;

      trade.status = closeReason && closeReason.includes('TARGET') ? 'TARGET_2_HIT' : (closeReason && closeReason.includes('SL') ? 'SL_HIT' : 'CLOSED');
      trade.exitPrice = numExit;
      trade.exitDate = ist.dateStr;
      trade.exitTime = ist.timeStr;
      trade.exitDateTime = ist.dateTimeStr;
      trade.exitTimestamp = now.getTime();
      trade.exitReason = closeReason;
      trade.realizedPnL = realizedPnL;
      trade.unrealizedPnL = 0;
      trade.roiPct = roiPct;
      trade.auditTrail.push({
        timestamp: now.toISOString(),
        dateTimeIST: ist.dateTimeStr,
        event: 'POSITION_CLOSED',
        details: `Exited @ ₹${numExit} | P&L: ₹${realizedPnL > 0 ? '+' : ''}${realizedPnL.toLocaleString('en-IN')} (${roiPct}%) | Reason: ${trade.exitReason}`
      });

      saveAlgoTradesToDisk();

      res.json({
        success: true,
        trade,
        message: `Position ${trade.symbol} closed @ ₹${numExit} (P&L: ₹${realizedPnL.toLocaleString('en-IN')})`
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  app.post('/api/algo-trade/close', handleCloseAlgoTrade);
  app.post('/api/algo-trade/trades/close', handleCloseAlgoTrade);

  let lastTradesRouteRefresh = 0;

  // GET /api/algo-trade/trades/reload
  app.get('/api/algo-trade/trades/reload', (req, res) => {
    const trades = loadAlgoTradesFromDisk();
    res.json({ success: true, count: trades.length, message: `Reloaded ${trades.length} trades from disk` });
  });

  // GET /api/algo-trade/trades (Returns active trades with Live Real-Time MTM & P&L)
  app.get('/api/algo-trade/trades', (req, res) => {
    try {
      if (algoTradesCache.length === 0 || req.query.force === 'true') {
        loadAlgoTradesFromDisk();
      }
      const closedTrades = algoTradesCache.filter(t => t.status === 'CLOSED' || t.status === 'TARGET_2_HIT' || t.status === 'SL_HIT');
      const openTrades = algoTradesCache.filter(t => t.status === 'OPEN' || t.status === 'TARGET_1_HIT');

      // Throttled non-blocking refresh to prevent event-loop starvation and SmartAPI rate-limit lockups
      const now = Date.now();
      if (!lastTradesRouteRefresh || now - lastTradesRouteRefresh > 3000) {
        lastTradesRouteRefresh = now;
        Promise.all(openTrades.map(async (trade) => {
          try {
            let liveLtp = await getRealtimeLtp(trade.symbol);
            if ((!liveLtp || liveLtp <= 0) && (trade.segment === 'STOCK_OPTION' || trade.segment === 'INDEX_OPTION')) {
              const spotLtp = await getRealtimeLtp(trade.underlyingSymbol || trade.symbol);
              if (spotLtp && spotLtp > 0 && trade.spotAtEntry) {
                const spotMovePct = Math.abs(spotLtp - trade.spotAtEntry) / trade.spotAtEntry;
                if (spotMovePct <= 0.035) {
                  const spotMove = spotLtp - trade.spotAtEntry;
                  const delta = trade.optionType === 'CE' ? 0.52 : -0.52;
                  const premiumChange = spotMove * delta;
                  liveLtp = Math.max(0.5, Math.round((trade.entryPrice + premiumChange) * 10) / 10);
                }
              }
            }
            if (liveLtp && liveLtp > 0) {
              trade.currentLtp = liveLtp;
              const pnlPts = trade.direction === 'BUY' ? (liveLtp - trade.entryPrice) : (trade.entryPrice - liveLtp);
              trade.unrealizedPnL = Math.round(pnlPts * trade.quantity * 100) / 100;
              const cap = trade.capitalAllocated || (trade.entryPrice * trade.quantity) || 1;
              trade.roiPct = Math.round((trade.unrealizedPnL / cap) * 10000) / 100;
            }
          } catch (e) {}
        })).catch(() => {});
      }

      const totalRealizedPnL = closedTrades.reduce((sum, t) => sum + (t.realizedPnL || 0), 0);
      const totalUnrealizedPnL = openTrades.reduce((sum, t) => sum + (t.unrealizedPnL || 0), 0);
      const openMarginDeployed = openTrades.reduce((sum, t) => sum + (t.capitalAllocated || 0), 0);
      const availableMargin = Math.max(0, INITIAL_CAPITAL + totalRealizedPnL - openMarginDeployed);
      const netAccountValue = INITIAL_CAPITAL + totalRealizedPnL + totalUnrealizedPnL;

      const winningTrades = closedTrades.filter(t => (t.realizedPnL || 0) > 0).length;
      const losingTrades = closedTrades.filter(t => (t.realizedPnL || 0) < 0).length;
      const winRatePct = closedTrades.length > 0 ? Math.round((winningTrades / closedTrades.length) * 100) : 0;

      const capitalSummary = {
        initialCapital: INITIAL_CAPITAL,
        availableMargin,
        openMarginDeployed,
        totalRealizedPnL,
        totalUnrealizedPnL,
        netAccountValue,
        totalTrades: algoTradesCache.length,
        openTradesCount: openTrades.length,
        closedTradesCount: closedTrades.length,
        winningTrades,
        losingTrades,
        winRatePct,
        marketHours: getISTMarketHours()
      };

      res.json({
        success: true,
        capitalSummary,
        trades: algoTradesCache
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // GET /api/algo-trade/status
  app.get('/api/algo-trade/status', (req, res) => {
    res.redirect('/api/algo-trade/trades');
  });

  // POST /api/algo-trade/trades/clear & /api/algo-trade/clear
  const handleClearTrades = (req, res) => {
    algoTradesCache = [];
    saveAlgoTradesToDisk();
    res.json({ success: true, count: 0, message: 'Algo trades log cleared' });
  };
  app.post('/api/algo-trade/trades/clear', handleClearTrades);
  app.post('/api/algo-trade/clear', handleClearTrades);

  // POST /api/algo-trade/export-excel - Download multi-sheet Excel report (.xlsx) for Algo Trades
  app.post('/api/algo-trade/export-excel', (req, res) => {
    try {
      const { positions = [], history = [], metrics = {}, logs = [] } = req.body || {};

      const formatIst = (ts, fallbackStr) => {
        if (ts && !isNaN(Number(ts))) {
          return new Date(Number(ts)).toLocaleString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
          });
        }
        return fallbackStr || '-';
      };

      const formatDateOnly = (ts, fallbackDate) => {
        if (fallbackDate) return fallbackDate;
        if (ts && !isNaN(Number(ts))) {
          return new Date(Number(ts)).toLocaleDateString('en-IN', {
            timeZone: 'Asia/Kolkata',
            day: '2-digit',
            month: 'short',
            year: 'numeric'
          });
        }
        return new Date().toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: 'short',
          year: 'numeric'
        });
      };

      const generatedAt = formatIst(Date.now());

      // Sheet 1: Summary
      const totalClosed = history.length;
      const winners = history.filter(h => (Number(h.realizedPnL || h.realizedPnl) || 0) > 0).length;
      const losers = history.filter(h => (Number(h.realizedPnL || h.realizedPnl) || 0) < 0).length;
      const winRate = totalClosed > 0 ? ((winners / totalClosed) * 100).toFixed(2) + '%' : '0.00%';
      const totalRealized = history.reduce((acc, h) => acc + (Number(h.realizedPnL || h.realizedPnl) || 0), 0);
      const totalUnrealized = positions.reduce((acc, p) => acc + (Number(p.unrealizedPnL || p.unrealizedPnl) || 0), 0);

      const summaryRows = [
        ['TradingGuru Algo Trade Portfolio Report', ''],
        ['Generated On (IST)', generatedAt],
        ['', ''],
        ['Metric', 'Value'],
        ['Initial Capital (INR)', Number(metrics.initialCapital || INITIAL_CAPITAL)],
        ['Available Margin (INR)', Number(metrics.availableMargin || 0)],
        ['Used Margin (INR)', Number(metrics.openMarginDeployed || metrics.usedMargin || 0)],
        ['Realized P&L (INR)', Math.round(totalRealized * 100) / 100],
        ['Unrealized P&L (INR)', Math.round(totalUnrealized * 100) / 100],
        ['Total Net Day P&L (INR)', Math.round((totalRealized + totalUnrealized) * 100) / 100],
        ['Total Open Positions', positions.length],
        ['Total Closed Trades', totalClosed],
        ['Winning Trades', winners],
        ['Losing Trades', losers],
        ['Win Rate', winRate]
      ];

      // Sheet 2: Closed Trades History
      const historyRows = [
        [
          'S.No', 'Symbol', 'Side', 'Setup Strategy', 'Qty', 'Allocated Capital (INR)',
          'Entry Date', 'Entry Time (IST)', 'Entry Price (INR)', 'Exit Date', 'Exit Time (IST)',
          'Exit Price (INR)', 'Exit Reason', 'Stop Loss (INR)', 'Target 1 (INR)', 'Target 2 (INR)',
          'Realized P&L (INR)', 'Return (%)'
        ]
      ];

      history.forEach((item, idx) => {
        const cap = Number(item.capitalAllocated || item.allocatedCapital) || (Number(item.entryPrice) * Number(item.quantity)) || 1;
        const pnl = Number(item.realizedPnL || item.realizedPnl) || 0;
        const roiPct = ((pnl / cap) * 100).toFixed(2) + '%';
        historyRows.push([
          idx + 1, item.symbol, item.direction || item.side, item.strategy || item.setupStrategy,
          Number(item.quantity) || 0, Math.round(cap), item.entryDate || '-', item.entryTime || '-',
          Number(item.entryPrice) || 0, item.exitDate || '-', item.exitTime || '-',
          Number(item.exitPrice) || 0, item.exitReason || '-', Number(item.stopLossPrice || item.stopLoss) || 0,
          Number(item.target1Price || item.target1) || 0, Number(item.target2Price || item.target2) || 0,
          pnl, roiPct
        ]);
      });

      // Sheet 3: Open Positions
      const openRows = [
        [
          'S.No', 'Symbol', 'Side', 'Setup Strategy', 'Qty', 'Allocated Capital (INR)',
          'Entry Date', 'Entry Time (IST)', 'Entry Price (INR)', 'Current LTP (INR)',
          'Stop Loss (INR)', 'Target 1 (INR)', 'Target 2 (INR)', 'Trailing Status',
          'Unrealized P&L (INR)', 'Return (%)'
        ]
      ];

      positions.forEach((pos, idx) => {
        const cap = Number(pos.capitalAllocated || pos.allocatedCapital) || (Number(pos.entryPrice) * Number(pos.quantity)) || 1;
        openRows.push([
          idx + 1, pos.symbol, pos.direction || pos.side, pos.strategy || pos.setupStrategy,
          Number(pos.quantity) || 0, Math.round(cap), pos.entryDate || '-', pos.entryTime || '-',
          Number(pos.entryPrice) || 0, Number(pos.currentLtp || pos.currentPrice) || 0,
          Number(pos.stopLossPrice || pos.stopLoss) || 0, Number(pos.target1Price || pos.target1) || 0,
          Number(pos.target2Price || pos.target2) || 0, pos.status === 'TARGET_1_HIT' ? 'Trailing (BE)' : 'Active',
          Number(pos.unrealizedPnL || pos.unrealizedPnl) || 0, (Number(pos.roiPct || pos.unrealizedPnlPct) || 0).toFixed(2) + '%'
        ]);
      });

      // Sheet 4: Execution Logs
      const logRows = [
        ['S.No', 'Date', 'Time (IST)', 'Event', 'Details']
      ];
      logs.forEach((l, idx) => {
        logRows.push([
          idx + 1, l.date || formatDateOnly(Date.now()), l.time || l.dateTimeIST || '-',
          l.type || l.event || '-', l.message || l.details || '-'
        ]);
      });

      const sheets = [
        { name: 'Summary', rows: summaryRows, colWidths: [30, 28] },
        { name: 'Closed Trades', rows: historyRows, colWidths: [8, 16, 8, 28, 10, 18, 15, 22, 14, 15, 22, 14, 24, 14, 14, 14, 16, 12] },
        { name: 'Open Positions', rows: openRows, colWidths: [8, 16, 8, 28, 10, 18, 15, 22, 14, 14, 14, 14, 14, 14, 16, 12] },
        { name: 'Audit Logs', rows: logRows, colWidths: [8, 15, 16, 10, 16, 65] }
      ];

      const buffer = buildExcelWorkbook(sheets);
      const dateStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
      const filename = `AlgoTrade_Report_${dateStr}.xlsx`;
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.send(buffer);
    } catch (err) {
      console.error('[AlgoTrade Export] Error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  });
}
