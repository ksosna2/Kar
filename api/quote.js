// GET /api/quote?symbol=<symbol>
//
// Live stock/ETF quote via Yahoo Finance's public chart endpoint. Works for US
// AND international listings using Yahoo's exchange-suffixed symbols, e.g.
// AAPL (US), NESN.SW (Swiss), VOD.L (London), AIR.PA (Paris), SAP.DE (Frankfurt),
// 7203.T (Tokyo), WPL.WA (Warsaw). No API key required. Returns the price in the
// listing's NATIVE currency (meta.currency); the client converts to the user's
// base currency.
//
// London & friends quote in minor units (GBp/GBX = pence). We pass the raw
// currency string straight through and let the client normalise it.
//
// Forgiving symbols: people often guess an ISO country code (WPL.PL) instead of
// Yahoo's exchange code (WPL.WA). If the given symbol misses, we retry the
// corrected suffix and return the resolved symbol so the client can adopt it.

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

// Common wrong guess (ISO country) → Yahoo exchange suffix.
const SUFFIX_FIX = {
  PL: 'WA',                 // Poland → Warsaw
  UK: 'L', GB: 'L', LON: 'L', // UK → London
  JP: 'T', JT: 'T',         // Japan → Tokyo
  FR: 'PA',                 // France → Paris
  CH: 'SW', SIX: 'SW',      // Switzerland → SIX
  GER: 'DE', GE: 'DE', FRA: 'DE', // Germany → Xetra/Frankfurt
  ES: 'MC', SP: 'MC',       // Spain → Madrid
  IT: 'MI',                 // Italy → Milan
  NL: 'AS',                 // Netherlands → Amsterdam
  SE: 'ST',                 // Sweden → Stockholm
  NO: 'OL',                 // Norway → Oslo
  DK: 'CO',                 // Denmark → Copenhagen
  FI: 'HE',                 // Finland → Helsinki
  PT: 'LS',                 // Portugal → Lisbon
  AT: 'VI',                 // Austria → Vienna
  BE: 'BR',                 // Belgium → Brussels
  IE: 'IR',                 // Ireland → Dublin
  AU: 'AX', ASX: 'AX',      // Australia → ASX
  NZ: 'NZ',                 // New Zealand (already correct, kept for clarity)
  CA: 'TO', TSX: 'TO',      // Canada → Toronto
  US: '', USA: '',          // US → no suffix
};

// Commodities: ISO metal codes / plain names → Yahoo front-month futures, which
// quote reliably (in USD). Front-month future ≈ spot for a personal tracker.
const COMMODITY_ALIAS = {
  XAU: 'GC=F', GOLD: 'GC=F',         // gold (USD / troy oz)
  XAG: 'SI=F', SILVER: 'SI=F',       // silver (USD / troy oz)
  XPT: 'PL=F', PLATINUM: 'PL=F',     // platinum
  XPD: 'PA=F', PALLADIUM: 'PA=F',    // palladium
  COPPER: 'HG=F',                    // copper (USD / lb)
  WTI: 'CL=F', CRUDE: 'CL=F', OIL: 'CL=F', // WTI crude (USD / bbl)
  BRENT: 'BZ=F',                     // Brent crude
  NATGAS: 'NG=F', NGAS: 'NG=F',      // natural gas
};

// Build the list of symbols to try: the raw input first, then a commodity
// alias, then a corrected suffix if the input's suffix looks like a
// country-code mistake.
function candidates(symbol) {
  const out = [symbol];
  const up = symbol.toUpperCase();
  if (COMMODITY_ALIAS[up] && COMMODITY_ALIAS[up] !== symbol) out.push(COMMODITY_ALIAS[up]);
  const m = symbol.match(/^(.+)\.([A-Za-z]+)$/);
  if (m) {
    const base = m[1], suf = m[2].toUpperCase();
    if (Object.prototype.hasOwnProperty.call(SUFFIX_FIX, suf)) {
      const fixed = SUFFIX_FIX[suf];
      const alt = fixed ? base + '.' + fixed : base;
      if (alt !== symbol) out.push(alt);
    }
  }
  return out;
}

// Fetch the Yahoo chart result for a symbol with the given query string,
// trying both hosts. Returns chart.result[0] or null.
async function fetchResult(symbol, query) {
  for (const host of HOSTS) {
    try {
      const url = 'https://' + host + '/v8/finance/chart/' + encodeURIComponent(symbol) + query;
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const res = j && j.chart && j.chart.result && j.chart.result[0];
      if (res) return res;
    } catch (e) { /* try next host */ }
  }
  return null;
}

async function quote(symbol) {
  const res = await fetchResult(symbol, '?interval=1d&range=1d');
  const meta = res && res.meta;
  const price = meta && Number(meta.regularMarketPrice);
  if (!meta || !isFinite(price)) return null;
  return {
    ok: true,
    symbol: meta.symbol || symbol,
    price: price,
    currency: meta.currency || 'USD',
    exchange: meta.fullExchangeName || meta.exchangeName || null,
    previousClose: meta.chartPreviousClose != null ? Number(meta.chartPreviousClose) : null,
  };
}

// Historical daily-close series. points: [{ t: unixSeconds, c: nativeClose }].
async function series(symbol, range, interval) {
  const res = await fetchResult(symbol, '?interval=' + encodeURIComponent(interval) + '&range=' + encodeURIComponent(range));
  const meta = res && res.meta;
  const ts = res && res.timestamp;
  const q = res && res.indicators && res.indicators.quote && res.indicators.quote[0];
  const closes = q && q.close;
  if (!meta || !Array.isArray(ts) || !Array.isArray(closes)) return null;
  const points = [];
  for (let i = 0; i < ts.length; i++) { const c = Number(closes[i]); if (isFinite(c)) points.push({ t: ts[i], c: c }); }
  if (!points.length) return null;
  return { ok: true, symbol: meta.symbol || symbol, currency: meta.currency || 'USD', points: points };
}

const RANGES = { '1mo': 1, '3mo': 1, '6mo': 1, '1y': 1, '2y': 1, '5y': 1, 'max': 1 };
const INTERVALS = { '1d': 1, '1wk': 1, '1mo': 1 };

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const u = new URL(req.url, 'http://x');
  const symbol = (u.searchParams.get('symbol') || '').trim();
  if (!symbol) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'no_symbol' })); return; }

  // Historical series mode (for the investments chart backfill).
  if (u.searchParams.get('series')) {
    const range = RANGES[u.searchParams.get('range')] ? u.searchParams.get('range') : '1y';
    const interval = INTERVALS[u.searchParams.get('interval')] ? u.searchParams.get('interval') : '1d';
    for (const cand of candidates(symbol)) {
      const s = await series(cand, range, interval);
      if (s) { res.statusCode = 200; res.end(JSON.stringify(s)); return; }
    }
    res.statusCode = 200; res.end(JSON.stringify({ ok: false, error: 'not_found' })); return;
  }

  for (const cand of candidates(symbol)) {
    const q = await quote(cand);
    if (q) { res.statusCode = 200; res.end(JSON.stringify(q)); return; }
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
};
