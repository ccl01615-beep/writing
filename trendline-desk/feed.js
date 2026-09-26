// Parses Yahoo Finance's chart response into daily bars. No Electron dependency, so it can be unit-tested.
function isoDate(unixSec, gmtOffset) {
  return new Date((unixSec + (gmtOffset || 0)) * 1000).toISOString().slice(0, 10);
}

function marketSession(meta) {
  const p = meta.currentTradingPeriod;
  if (!p || !p.regular) return null;
  const now = Date.now() / 1000;
  if (p.pre && now >= p.pre.start && now < p.pre.end) return "Pre-market";
  if (now >= p.regular.start && now < p.regular.end) return "Market open";
  if (p.post && now >= p.post.start && now < p.post.end) return "After hours";
  return "Market closed";
}

function parseChart(json) {
  const r = json && json.chart && json.chart.result && json.chart.result[0];
  if (!r) {
    const e = json && json.chart && json.chart.error;
    throw new Error(e && e.description ? e.description : "No data came back for that symbol.");
  }
  const meta = r.meta || {};
  const ts = r.timestamp || [];
  const q = (r.indicators && r.indicators.quote && r.indicators.quote[0]) || {};
  const byDate = new Map();
  for (let i = 0; i < ts.length; i++) {
    const c = q.close && q.close[i];
    if (c == null || !(c > 0)) continue;
    const o = q.open[i] > 0 ? q.open[i] : c;
    const h = Math.max(q.high[i] > 0 ? q.high[i] : c, o, c);
    const l = Math.min(q.low[i] > 0 ? q.low[i] : c, o, c);
    byDate.set(isoDate(ts[i], meta.gmtoffset), { d: isoDate(ts[i], meta.gmtoffset), o, h, l, c, v: q.volume[i] || 0 });
  }
  const rows = [...byDate.values()].sort((a, b) => (a.d < b.d ? -1 : 1));
  // Fold the latest trade into today's bar so the read reflects the live price.
  const live = meta.regularMarketPrice;
  if (live > 0 && meta.regularMarketTime) {
    const d = isoDate(meta.regularMarketTime, meta.gmtoffset);
    const lastRow = rows[rows.length - 1];
    if (lastRow && lastRow.d === d) {
      lastRow.c = live; lastRow.h = Math.max(lastRow.h, live); lastRow.l = Math.min(lastRow.l, live);
    } else if (!lastRow || lastRow.d < d) {
      rows.push({ d, o: live, h: live, l: live, c: live, v: 0 });
    }
  }
  if (rows.length < 40) throw new Error(`Only ${rows.length} trading days of history are available for this symbol, and the read needs at least 40.`);
  return {
    rows,
    meta: {
      symbol: meta.symbol,
      name: meta.longName || meta.shortName || "",
      currency: meta.currency || "USD",
      exchange: meta.fullExchangeName || meta.exchangeName || "",
      price: live || rows[rows.length - 1].c,
      time: meta.regularMarketTime ? meta.regularMarketTime * 1000 : Date.now(),
      crypto: meta.instrumentType === "CRYPTOCURRENCY",
      session: meta.instrumentType === "CRYPTOCURRENCY" ? "Trades 24/7" : marketSession(meta),
    },
  };
}

module.exports = { parseChart, marketSession, isoDate };
