const assert=require("node:assert");const test=require("node:test");
const {parseChart}=require("../feed.js");const F=require("./fixtures.js");
// Build a response in the shape Yahoo's v8 chart endpoint returns.
function yahoo(rows,{live,liveDay}={}){
  const ts=rows.map(r=>Date.parse(r.d+"T13:30:00Z")/1000);
  const q={open:[],high:[],low:[],close:[],volume:[]};
  for(const r of rows){q.open.push(r.o);q.high.push(r.h);q.low.push(r.l);q.close.push(r.c);q.volume.push(r.v)}
  q.close[3]=null; // Yahoo leaves gaps as null
  const lastTs=liveDay?Date.parse(liveDay+"T17:00:00Z")/1000:ts[ts.length-1]+3600;
  return {chart:{result:[{meta:{symbol:"TEST",currency:"USD",gmtoffset:-14400,regularMarketPrice:live,regularMarketTime:lastTs,
    currentTradingPeriod:{pre:{start:0,end:1},regular:{start:1,end:2},post:{start:2,end:3}}},timestamp:ts,indicators:{quote:[q]}}],error:null}};
}
test("parses bars, skips nulls, keeps dates in exchange time",()=>{
  const {rows,meta}=parseChart(yahoo(F.UP,{live:F.UP.at(-1).c}));
  assert.equal(rows.length,F.UP.length-1);
  assert.equal(rows.at(-1).d,F.UP.at(-1).d);
  assert.equal(meta.symbol,"TEST");assert.equal(meta.session,"Market closed");
});
test("folds the live price into today's bar",()=>{
  const live=F.UP.at(-1).h+5;const {rows}=parseChart(yahoo(F.UP,{live}));
  assert.equal(rows.at(-1).c,live);assert.equal(rows.at(-1).h,live);
});
test("appends a bar when the live trade is on a newer day",()=>{
  const {rows}=parseChart(yahoo(F.UP,{live:99,liveDay:"2026-09-28"}));
  assert.equal(rows.at(-1).d,"2026-09-28");assert.equal(rows.at(-1).c,99);
});
test("reports Yahoo's error text",()=>{
  assert.throws(()=>parseChart({chart:{result:null,error:{code:"Not Found",description:"No data found, symbol may be delisted"}}}),/delisted/);
});
test("refuses too-short histories",()=>{
  assert.throws(()=>parseChart(yahoo(F.SHORT.slice(0,30),{live:10})),/at least 40/);
});
