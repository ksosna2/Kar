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

// Build the list of symbols to try: the raw input first, then a corrected
// suffix if the input's suffix looks like a country-code mistake.
function candidates(symbol) {
  const out = [symbol];
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

async function quote(symbol) {
  for (const host of HOSTS) {
    try {
      const url = 'https://' + host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=1d';
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const meta = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
      const price = meta && Number(meta.regularMarketPrice);
      if (!meta || !isFinite(price)) continue;
      return {
        ok: true,
        symbol: meta.symbol || symbol,
        price: price,
        currency: meta.currency || 'USD',
        exchange: meta.fullExchangeName || meta.exchangeName || null,
        previousClose: meta.chartPreviousClose != null ? Number(meta.chartPreviousClose) : null,
      };
    } catch (e) { /* try next host */ }
  }
  return null;
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const symbol = (new URL(req.url, 'http://x').searchParams.get('symbol') || '').trim();
  if (!symbol) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'no_symbol' })); return; }

  for (const cand of candidates(symbol)) {
    const q = await quote(cand);
    if (q) { res.statusCode = 200; res.end(JSON.stringify(q)); return; }
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
};
