// GET /api/news?symbol=<symbol>
//
// Recent news for a holding, scraped from Google News RSS (no API key). Language
// is chosen per listing so the headlines are readable:
//   - Warsaw (.WA) listings  -> Polish (hl=pl, gl=PL)
//   - everything else        -> English (German .DE included — the owner can't
//                               read German, so we force English sources)
// The company name is resolved from Yahoo's search endpoint so the query is the
// real name (e.g. "Wirtualna Polska Holding") rather than a noisy ticker.

const HOSTS = ['query1.finance.yahoo.com', 'query2.finance.yahoo.com'];

// Commodity tickers -> a readable news query (and forced English).
const COMMODITY_NEWS = {
  XAU: 'gold price', GOLD: 'gold price',
  XAG: 'silver price', SILVER: 'silver price',
  XPT: 'platinum price', XPD: 'palladium price',
  COPPER: 'copper price',
  WTI: 'crude oil price', CRUDE: 'crude oil price', OIL: 'crude oil price',
  BRENT: 'brent crude oil', NATGAS: 'natural gas price', NGAS: 'natural gas price',
};

function langFor(symbol) {
  const m = symbol.match(/\.([A-Za-z]+)$/);
  const suf = m ? m[1].toUpperCase() : '';
  if (suf === 'WA') return { hl: 'pl', gl: 'PL', ceid: 'PL:pl' }; // Polish for Warsaw
  return { hl: 'en-US', gl: 'US', ceid: 'US:en' };                // English otherwise
}

// Drop trailing legal-entity suffixes so the news query is the plain brand name.
function cleanName(name) {
  return String(name || '')
    .replace(/\s+(S\.?A\.?|N\.?V\.?|AG|SE|S\.?p\.?A\.?|PLC|Inc\.?|Corp\.?|Corporation|Co\.?|Ltd\.?|AB|ASA|Oyj|SA)\.?$/i, '')
    .trim();
}

async function companyName(symbol) {
  for (const host of HOSTS) {
    try {
      const r = await fetch('https://' + host + '/v1/finance/search?q=' + encodeURIComponent(symbol) + '&quotesCount=1&newsCount=0&lang=en-US',
        { headers: { 'user-agent': 'Mozilla/5.0', 'accept': 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json();
      const q = j && j.quotes && j.quotes[0];
      if (q && (q.longname || q.shortname)) return q.longname || q.shortname;
    } catch (e) { /* next host */ }
  }
  return null;
}

function decode(s) {
  return String(s || '')
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

function tag(block, name) {
  const m = block.match(new RegExp('<' + name + '[^>]*>([\\s\\S]*?)</' + name + '>'));
  return m ? m[1] : '';
}

function parseRss(xml) {
  const items = [];
  const re = /<item>([\s\S]*?)<\/item>/g;
  let m;
  while ((m = re.exec(xml)) && items.length < 30) {
    const block = m[1];
    let title = decode(tag(block, 'title')).trim();
    let source = decode(tag(block, 'source')).trim();
    const link = decode(tag(block, 'link')).trim();
    const pub = tag(block, 'pubDate').trim();
    // Google News appends " - Source" to every title; strip it.
    if (source && title.endsWith(' - ' + source)) title = title.slice(0, title.length - source.length - 3).trim();
    else if (!source) { const i = title.lastIndexOf(' - '); if (i > 0) { source = title.slice(i + 3).trim(); title = title.slice(0, i).trim(); } }
    if (!title) continue;
    const published = pub ? Date.parse(pub) : null;
    items.push({ title: title, link: link, source: source, published: isFinite(published) ? published : null });
  }
  return items;
}

module.exports = async (req, res) => {
  res.setHeader('content-type', 'application/json');
  res.setHeader('cache-control', 'no-store');

  const u = new URL(req.url, 'http://x');
  const symbol = (u.searchParams.get('symbol') || '').trim();
  if (!symbol) { res.statusCode = 400; res.end(JSON.stringify({ ok: false, error: 'no_symbol' })); return; }

  try {
    const up = symbol.toUpperCase();
    let lang, query, name;
    if (COMMODITY_NEWS[up]) {
      lang = { hl: 'en-US', gl: 'US', ceid: 'US:en' };
      query = COMMODITY_NEWS[up];
      name = up.charAt(0) + up.slice(1).toLowerCase();
    } else {
      lang = langFor(symbol);
      const resolved = await companyName(symbol);
      name = resolved || symbol.replace(/\.[A-Za-z]+$/, '');
      query = cleanName(resolved) || symbol.replace(/\.[A-Za-z]+$/, '');
    }
    const rssUrl = 'https://news.google.com/rss/search?q=' + encodeURIComponent(query)
      + '&hl=' + lang.hl + '&gl=' + lang.gl + '&ceid=' + encodeURIComponent(lang.ceid);
    const r = await fetch(rssUrl, { headers: { 'user-agent': 'Mozilla/5.0' } });
    const xml = await r.text();
    const items = parseRss(xml);
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: true, symbol: symbol, name: name, lang: lang.hl, query: query, items: items }));
  } catch (e) {
    res.statusCode = 200;
    res.end(JSON.stringify({ ok: false, error: 'fetch_failed' }));
  }
};
