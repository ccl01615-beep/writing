/* Turns what a person types, or what TradingView shows, into a Yahoo Finance symbol.
   Examples: BTC -> BTC-USD, BINANCE:BTCUSDT -> BTC-USD, NASDAQ:AAPL -> AAPL, TSX:SHOP -> SHOP.TO, BRK.B -> BRK-B */
(function (root) {
"use strict";

// Common coins. A bare symbol in this list is read as the coin, with an option to load the stock instead.
const COINS = new Set(("BTC ETH SOL XRP BNB DOGE ADA AVAX TRX DOT LINK POL MATIC LTC BCH SHIB XLM ATOM UNI NEAR APT ARB OP SUI " +
  "TON PEPE ETC FIL HBAR ICP INJ AAVE RENDER RNDR XMR ALGO KAS SEI TIA WIF BONK FET IMX MKR STX VET GRT LDO CRO " +
  "TAO ONDO JUP ENA WLD FLOKI HYPE TRUMP XTZ EOS SAND MANA AXS CHZ CRV COMP SNX ZEC DASH QNT EGLD FLOW THETA").split(" "));
const CRYPTO_EXCHANGES = new Set(("BINANCE BINANCEUS COINBASE BYBIT KRAKEN BITSTAMP OKX BITFINEX KUCOIN GEMINI CRYPTO CRYPTOCAP " +
  "MEXC BITGET GATEIO HTX POLONIEX BITMEX DERIBIT UPBIT BITHUMB PHEMEX WHITEBIT").split(" "));
// TradingView exchange prefix -> Yahoo suffix for non-US listings.
const SUFFIX = { TSX: ".TO", TSXV: ".V", NEO: ".NE", LSE: ".L", LSIN: ".L", ASX: ".AX", XETR: ".DE", FWB: ".F", EURONEXT: ".PA",
  SIX: ".SW", BME: ".MC", MIL: ".MI", TSE: ".T", HKEX: ".HK", NSE: ".NS", BSE: ".BO", KRX: ".KS", TWSE: ".TW", SGX: ".SI", OMXSTO: ".ST", OSL: ".OL", OMXCOP: ".CO", NZX: ".NZ", JSE: ".JO", BMFBOVESPA: ".SA", BMV: ".MX" };
const INDEXES = { SPX: "^GSPC", SPX500: "^GSPC", NDX: "^NDX", NAS100: "^NDX", DJI: "^DJI", US30: "^DJI", VIX: "^VIX", RUT: "^RUT", IXIC: "^IXIC" };
const QUOTES = ["USDT", "USDC", "FDUSD", "BUSD", "USD", "EUR", "GBP"];

function resolveSymbol(input, opts) {
  const preferStock = !!(opts && opts.preferStock);
  let s = String(input || "").trim().toUpperCase().replace(/^\$/, "").replace(/\s+/g, "");
  if (!s) return null;
  let ex = null;
  const m = s.match(/^([A-Z0-9_]+):(.+)$/);
  if (m) { ex = m[1]; s = m[2]; }
  s = s.replace(/\.P$/, "").replace(/PERP$/, "");  // perpetual futures read as the spot coin

  // Crypto pairs: BTCUSDT, BTC/USD, BTC-USD, ETHEUR
  const cryptoVenue = ex && CRYPTO_EXCHANGES.has(ex);
  for (const q of QUOTES) {
    const pm = s.match(new RegExp("^([A-Z0-9]{2,12}?)[-/]?" + q + "$"));
    if (pm && (cryptoVenue || COINS.has(pm[1]))) {
      const fiat = q === "EUR" || q === "GBP" ? q : "USD";
      return { symbol: `${pm[1]}-${fiat}`, kind: "crypto", base: pm[1] };
    }
  }
  if (cryptoVenue) return { symbol: `${s}-USD`, kind: "crypto", base: s };
  if (!ex && !preferStock && COINS.has(s)) return { symbol: `${s}-USD`, kind: "crypto", base: s, alsoStock: s };

  if (INDEXES[s] && (!ex || /^(TVC|SP|CBOE|DJ|NASDAQ|CAPITALCOM|OANDA|FOREXCOM|PEPPERSTONE)$/.test(ex))) return { symbol: INDEXES[s], kind: "index" };
  if (ex && SUFFIX[ex] && !s.includes(".")) return { symbol: s + SUFFIX[ex], kind: "stock" };
  const cls = s.match(/^([A-Z]+)\.([ABC])$/);  // share classes: BRK.B -> BRK-B
  if (cls) return { symbol: `${cls[1]}-${cls[2]}`, kind: "stock" };
  return { symbol: s, kind: "stock" };
}

// TradingView titles look like "AAPL 227.52 ▲ +1.2% Unnamed" or "BINANCE:BTCUSDT 64,210 ▼ −0.4% My layout".
function symbolFromTitle(title) {
  if (!title) return null;
  const tok = String(title).trim().split(/\s+/)[0];
  if (!tok || /^tradingview$/i.test(tok)) return null;
  if (!/^[A-Za-z0-9:._!\-/^]{1,32}$/.test(tok)) return null;
  if (!/[A-Za-z]/.test(tok)) return null;
  return tok.toUpperCase();
}

const api = { resolveSymbol, symbolFromTitle, COINS };
if (typeof module !== "undefined" && module.exports) module.exports = api;
root.TrendSymbols = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
