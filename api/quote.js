// GET /api/quote?symbol=<symbol>
//
// Live stock/ETF quote via Yahoo Finance's public chart endpoint. Works for US
// AND international listings using Yahoo's exchange-suffixed symbols, e.g.
// AAPL (US), NESN.SW (Swiss), VOD.L (London), AIR.PA (Paris), SAP.DE (Frankfurt),
// 7203.T (Tokyo). No API key required. Returns the price in the listing's NATIVE
// currency (meta.currency); the client converts to the user's base currency.
//
// London & friends quote in minor units (GBp/GBX = pence). We pass the raw
// currency string straight through and let the client normalise it.

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const symbol = (new URL(req.url, 'http://x').searchParams.get('symbol') || '').trim();
  if (!symbol) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'no_symbol' })); return; }

  // Try both Yahoo hosts — query1 is occasionally rate-limited.
  for (const host of HOSTS) {
    try {
      const url = 'https://' + host + '/v8/finance/chart/' + encodeURIComponent(symbol) + '?interval=1d&range=1d';
      const r = await fetch(url, { headers: { 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const meta = j && j.chart && j.chart.result && j.chart.result[0] && j.chart.result[0].meta;
      const price = meta && Number(meta.regularMarketPrice);
      if (!meta || !isFinite(price)) continue;
      res.statusCode = 200;
      res.end(JSON.stringify({
        ok: true,
        symbol: meta.symbol || symbol,
        price: price,
        currency: meta.currency || 'USD',
        exchange: meta.fullExchangeName || meta.exchangeName || null,
        previousClose: meta.chartPreviousClose != null ? Number(meta.chartPreviousClose) : null,
      }));
      return;
    } catch (e) { /* try next host */ }
  }
  res.statusCode = 200;
  res.end(JSON.stringify({ ok: false, error: 'not_found' }));
};
