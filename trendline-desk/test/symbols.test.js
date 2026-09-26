const assert=require("node:assert");const test=require("node:test");
const {resolveSymbol:R,symbolFromTitle:S}=require("../symbols.js");
const sym=(x,o)=>R(x,o).symbol;
test("crypto in every common spelling maps to Yahoo pairs",()=>{
  for(const x of ["BTC","btc","$BTC","BTCUSD","BTCUSDT","BTC/USD","BTC-USD","BINANCE:BTCUSDT","COINBASE:BTCUSD","BYBIT:BTCUSDT.P","CRYPTO:BTCUSD"])assert.equal(sym(x),"BTC-USD",x);
  assert.equal(sym("ETHEUR"),"ETH-EUR");assert.equal(sym("KRAKEN:SOLUSD"),"SOL-USD");assert.equal(sym("BINANCE:NEWCOINUSDT"),"NEWCOIN-USD");
  assert.equal(R("SOL").alsoStock,"SOL");assert.equal(sym("SOL",{preferStock:true}),"SOL");
});
test("stocks and indexes map to Yahoo symbols",()=>{
  assert.equal(sym("aapl"),"AAPL");assert.equal(sym("NASDAQ:AAPL"),"AAPL");assert.equal(sym("NYSE:BRK.B"),"BRK-B");
  assert.equal(sym("TSX:SHOP"),"SHOP.TO");assert.equal(sym("LSE:VOD"),"VOD.L");assert.equal(sym("VOD.L"),"VOD.L");
  assert.equal(sym("SP:SPX"),"^GSPC");assert.equal(sym("SPX"),"^GSPC");assert.equal(sym("^GSPC"),"^GSPC");
  assert.equal(sym("USDJPY"),"USDJPY");  // not a coin: left alone
  assert.equal(R("AAPL").kind,"stock");
});
test("reads the symbol from TradingView window titles",()=>{
  assert.equal(S("AAPL 227.52 ▲ +1.2% Unnamed"),"AAPL");
  assert.equal(S("BINANCE:BTCUSDT 64,210.5 ▼ −0.4% My layout"),"BINANCE:BTCUSDT");
  assert.equal(S("BTCUSDT.P 64,210 ▲ +0.1%"),"BTCUSDT.P");
  assert.equal(S("TradingView"),null);assert.equal(S(""),null);assert.equal(S("64,210 ▲"),null);
});
