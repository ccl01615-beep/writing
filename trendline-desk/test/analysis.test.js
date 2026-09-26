const assert=require("node:assert");const test=require("node:test");
const T=require("../analysis.js");const F=require("./fixtures.js");
for(const [name,rows] of Object.entries({UP:F.UP,DOWN:F.DOWN,SHORT:F.SHORT}))for(const H of [10,20,60]){
  test(`${name} H=${H} produces a finite, consistent read`,()=>{
    const A=T.analyze(rows,H);
    assert.ok(isFinite(A.px)&&A.cone.length===H+1);
    for(const c of A.cone)assert.ok(c.lo95<=c.lo68&&c.lo68<=c.mid&&c.mid<=c.hi68&&c.hi68<=c.hi95);
    assert.ok(A.above.every(l=>l.p>A.px)&&A.below.every(l=>l.p<A.px));
    assert.ok(A.signals.length>0&&A.signals.every(s=>s.title&&!/NaN|undefined/.test(s.detail)),JSON.stringify(A.signals));
    const S=T.scenarios(A);assert.equal(S.items.length,3);
    assert.ok(S.items.every(i=>!/NaN|undefined|—/.test(i.text)),JSON.stringify(S.items));
    assert.ok(A.base.length===3);
  });
}
test("uptrend fixture reads bullish, downtrend fixture reads bearish",()=>{
  assert.equal(T.analyze(F.UP,20).trend.tone,"bull");
  assert.equal(T.analyze(F.DOWN,20).trend.tone,"bear");
});
test("RSI matches a hand-checked value",()=>{
  const c=[44.34,44.09,44.15,43.61,44.33,44.83,45.10,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28];
  assert.ok(Math.abs(T.rsi(c,14)[14]-70.53)<0.1);
});
