// Synthetic price series for tests and screenshots. Not real market data.
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
function gauss(r){let u=0;while(!u)u=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*r())}
function bizDaysEnding(end,n){const out=[];let d=new Date(end+"T00:00:00Z");while(out.length<n){const w=d.getUTCDay();if(w&&w!==6)out.push(d.toISOString().slice(0,10));d=new Date(d.getTime()-864e5)}return out.reverse()}
function makeSeries(seed,start,regimes,end="2026-09-25"){
  const r=mulberry32(seed),n=regimes.reduce((a,b)=>a+b[0],0),dates=bizDaysEnding(end,n);
  let c=start,i=0;const rows=[];const f=x=>Math.round(x*100)/100;
  for(const [len,mu,sig] of regimes)for(let k=0;k<len;k++,i++){
    const o=c*(1+gauss(r)*sig*.3),ret=mu+sig*gauss(r),cl=o*Math.exp(ret);
    const h=Math.max(o,cl)*(1+Math.abs(gauss(r))*sig*.45),l=Math.min(o,cl)*(1-Math.abs(gauss(r))*sig*.45);
    rows.push({d:dates[i],o:f(o),h:f(h),l:f(l),c:f(cl),v:Math.round(2e6*(.75+.5*r())*(1+Math.min(3,Math.abs(ret)/sig*.7)))});c=cl;
  }
  return rows;
}
const UP=makeSeries(7,48,[[130,.0011,.017],[45,-.0032,.024],[95,.0002,.013],[85,.0017,.015],[40,.0002,.007],[22,.0028,.012]]);
const DOWN=makeSeries(21,132,[[190,.0009,.015],[170,0,.013],[55,-.0028,.021],[35,-.0004,.022]]);
const SHORT=makeSeries(3,20,[[60,.001,.02]]);
if(typeof module!=="undefined")module.exports={makeSeries,UP,DOWN,SHORT};
if(typeof window!=="undefined")window.TestFixtures={makeSeries,UP,DOWN,SHORT};
