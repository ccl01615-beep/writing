/* Trendline analysis engine: pure functions, no DOM. Shared by the overlay window and tests. */
(function(root){
"use strict";
/* ---------- math ---------- */
const NaNs=n=>new Array(n).fill(NaN);
function sma(a,n){const o=NaNs(a.length);let s=0;for(let i=0;i<a.length;i++){s+=a[i];if(i>=n)s-=a[i-n];if(i>=n-1)o[i]=s/n}return o}
function ema(a,n){const o=NaNs(a.length),k=2/(n+1);let first=a.findIndex(x=>!isNaN(x));if(first<0||a.length-first<n)return o;let s=0;for(let i=first;i<first+n;i++)s+=a[i];let e=s/n;o[first+n-1]=e;for(let i=first+n;i<a.length;i++){e=a[i]*k+e*(1-k);o[i]=e}return o}
function rsi(c,n=14){const o=NaNs(c.length);if(c.length<=n)return o;let g=0,l=0;for(let i=1;i<=n;i++){const d=c[i]-c[i-1];d>0?g+=d:l-=d}g/=n;l/=n;o[n]=l===0?100:100-100/(1+g/l);for(let i=n+1;i<c.length;i++){const d=c[i]-c[i-1];g=(g*(n-1)+Math.max(d,0))/n;l=(l*(n-1)+Math.max(-d,0))/n;o[i]=l===0?100:100-100/(1+g/l)}return o}
function stdev(a){const m=a.reduce((x,y)=>x+y,0)/a.length;return Math.sqrt(a.reduce((x,y)=>x+(y-m)**2,0)/Math.max(1,a.length-1))}
function rollStd(a,n){const o=NaNs(a.length);for(let i=n-1;i<a.length;i++){const w=a.slice(i-n+1,i+1),m=w.reduce((x,y)=>x+y,0)/n;o[i]=Math.sqrt(w.reduce((x,y)=>x+(y-m)**2,0)/n)}return o}
function quantile(sorted,q){if(!sorted.length)return NaN;const p=(sorted.length-1)*q,lo=Math.floor(p),hi=Math.ceil(p);return sorted[lo]+(sorted[hi]-sorted[lo])*(p-lo)}
const last=a=>a[a.length-1];

/* ---------- analysis ---------- */
function analyze(rows,H,opts){
  const YR=(opts&&opts.periodsPerYear)||252;  // trading days a year: 252 for stocks, 365 for crypto
  const n=rows.length,c=rows.map(r=>r.c),hi=rows.map(r=>r.h),lo=rows.map(r=>r.l),vol=rows.map(r=>r.v);
  const px=c[n-1];
  const s20=sma(c,20),s50=sma(c,50),s200=sma(c,200);
  const sd20=rollStd(c,20),bbU=s20.map((m,i)=>m+2*sd20[i]),bbL=s20.map((m,i)=>m-2*sd20[i]),bbW=s20.map((m,i)=>4*sd20[i]/m);
  const r14=rsi(c);
  const e12=ema(c,12),e26=ema(c,26),macd=e12.map((x,i)=>x-e26[i]),sig=ema(macd,9),hist=macd.map((x,i)=>x-sig[i]);
  const tr=rows.map((r,i)=>i?Math.max(r.h-r.l,Math.abs(r.h-c[i-1]),Math.abs(r.l-c[i-1])):r.h-r.l);
  const atr=last(sma(tr,Math.min(14,n)));const atrPct=atr/px;
  const lr=[];for(let i=1;i<n;i++)lr.push(Math.log(c[i]/c[i-1]));
  const sdD=stdev(lr.slice(-Math.min(60,lr.length))),annVol=sdD*Math.sqrt(YR);
  const hasVol=vol.some(v=>v>0);

  // trend regression on log price
  const L=Math.min(90,n),x0=n-L;let sx=0,sy=0,sxx=0,sxy=0;
  for(let i=0;i<L;i++){const y=Math.log(c[x0+i]);sx+=i;sy+=y;sxx+=i*i;sxy+=i*y}
  const slope=(L*sxy-sx*sy)/(L*sxx-sx*sx),icpt=(sy-slope*sx)/L;
  let ssr=0,sst=0;const my=sy/L;
  for(let i=0;i<L;i++){const y=Math.log(c[x0+i]),f=icpt+slope*i;ssr+=(y-f)**2;sst+=(y-my)**2}
  const r2=sst?1-ssr/sst:0,resSd=Math.sqrt(ssr/Math.max(1,L-2)),annTrend=Math.exp(slope*YR)-1;
  const reg={x0,L,slope,icpt,r2,resSd,annTrend};

  // projection cone from the latest close
  const cone=[];for(let t=0;t<=H;t++){const m=Math.log(px)+slope*t,s=sdD*Math.sqrt(t);cone.push({t,mid:Math.exp(m),lo68:Math.exp(m-s),hi68:Math.exp(m+s),lo95:Math.exp(m-1.96*s),hi95:Math.exp(m+1.96*s)})}

  // swings
  const k=5,swH=[],swL=[];
  for(let i=k;i<n-k;i++){let isH=true,isL=true;for(let j=i-k;j<=i+k;j++){if(hi[j]>hi[i])isH=false;if(lo[j]<lo[i])isL=false}if(isH)swH.push(i);if(isL)swL.push(i)}

  // support / resistance clusters
  const from=Math.max(0,n-Math.round(YR*1.03)),piv=[...swH.filter(i=>i>=from).map(i=>({p:hi[i],i})),...swL.filter(i=>i>=from).map(i=>({p:lo[i],i}))].sort((a,b)=>a.p-b.p);
  const tol=Math.max(.012,atrPct*.8),clusters=[];
  for(const p of piv){const cl=last(clusters);if(cl&&p.p<=cl.ref*(1+tol)){cl.items.push(p)}else clusters.push({ref:p.p,items:[p]})}
  const levels=clusters.map(cl=>({p:cl.items.reduce((a,b)=>a+b.p,0)/cl.items.length,touches:cl.items.length,lastI:Math.max(...cl.items.map(q=>q.i))}));
  const above=levels.filter(l=>l.p>px*1.004).sort((a,b)=>a.p-b.p).slice(0,2);
  const below=levels.filter(l=>l.p<px*.996).sort((a,b)=>b.p-a.p).slice(0,2);
  const hi52=Math.max(...hi.slice(-YR)),lo52=Math.min(...lo.slice(-YR));
  const hi20=Math.max(...hi.slice(-21,-1)),lo20=Math.min(...lo.slice(-21,-1));

  // swing structure
  const lastH=swH.slice(-2),lastL=swL.slice(-2);let structure=null;
  if(lastH.length===2&&lastL.length===2){
    const hh=hi[lastH[1]]>hi[lastH[0]],hl=lo[lastL[1]]>lo[lastL[0]];
    structure=hh&&hl?"HH-HL":!hh&&!hl?"LH-LL":!hh&&hl?"contracting":"expanding";
  }

  // signals
  const S=[],add=(tone,title,detail,w=0)=>S.push({tone,title,detail,w});
  const a50=last(s50),a200=last(s200),a20=last(s20);
  if(!isNaN(a200)){
    const s50up=s50[n-1]>s50[n-11];
    if(px>a50&&a50>a200)add("bull","Stacked above its averages",`Price ${f$(px)} > 50-day ${f$(a50)} > 200-day ${f$(a200)}. The 50-day is ${s50up?"rising":"flattening"}.`,2);
    else if(px<a50&&a50<a200)add("bear","Stacked below its averages",`Price ${f$(px)} < 50-day ${f$(a50)} < 200-day ${f$(a200)}. Rallies tend to stall at the averages in this setup.`,-2);
    else add("neutral","Averages are mixed",`Price ${f$(px)}, 50-day ${f$(a50)}, 200-day ${f$(a200)}. No clean alignment, which usually means a transition or a range.`,px>a200?.5:-.5);
    for(let i=n-1;i>=Math.max(1,n-30);i--){
      const now=s50[i]-s200[i],prev=s50[i-1]-s200[i-1];
      if(now>0&&prev<=0){add("bull","Golden cross",`The 50-day crossed above the 200-day ${n-1-i} sessions ago. A slow signal: it confirms a turn more than it predicts one.`,1);break}
      if(now<0&&prev>=0){add("bear","Death cross",`The 50-day crossed below the 200-day ${n-1-i} sessions ago. A slow signal: it confirms weakness more than it predicts it.`,-1);break}
    }
  }else if(!isNaN(a50)){
    add(px>a50?"bull":"bear",px>a50?"Above the 50-day average":"Below the 50-day average",`Price ${f$(px)} vs 50-day ${f$(a50)}. Load 200+ days of data to use the 200-day average too.`,px>a50?1:-1);
  }
  const tpct=pct(annTrend);
  if(r2>=.5)add(slope>0?"bull":"bear",slope>0?"Clean uptrend channel":"Clean downtrend channel",`The last ${L} sessions fit a straight line well (R² ${r2.toFixed(2)}), sloping ${tpct} a year.`,slope>0?1.5:-1.5);
  else if(r2<.2)add("neutral","No clean trend",`The last ${L} sessions barely fit a line (R² ${r2.toFixed(2)}). Price is chopping or turning.`,0);
  else add(slope>0?"bull":"bear",slope>0?"Loose uptrend":"Loose downtrend",`The last ${L} sessions lean ${slope>0?"up":"down"} (${tpct} a year) with a lot of noise (R² ${r2.toFixed(2)}).`,slope>0?.75:-.75);
  if(structure==="HH-HL")add("bull","Higher highs and higher lows",`Latest swing high ${f$(hi[lastH[1]])} beat ${f$(hi[lastH[0]])}; latest swing low ${f$(lo[lastL[1]])} held above ${f$(lo[lastL[0]])}.`,1);
  else if(structure==="LH-LL")add("bear","Lower highs and lower lows",`Latest swing high ${f$(hi[lastH[1]])} fell short of ${f$(hi[lastH[0]])}; latest swing low ${f$(lo[lastL[1]])} undercut ${f$(lo[lastL[0]])}.`,-1);
  else if(structure==="contracting")add("watch","Narrowing swings (triangle)",`Lower highs and higher lows: ${f$(hi[lastH[1]])} to ${f$(lo[lastL[1]])}. Coils like this tend to resolve with a sharp move out of the range.`,0);
  else if(structure==="expanding")add("watch","Widening swings",`Higher highs but lower lows. Volatility is growing and neither side is in control.`,0);
  const r=last(r14);
  if(r>=70)add("watch",`Overbought (RSI ${r.toFixed(0)})`,`Momentum is stretched. In strong uptrends RSI can stay above 70 for weeks, but pullbacks or pauses often follow.`,.25);
  else if(r<=30)add("watch",`Oversold (RSI ${r.toFixed(0)})`,`Selling is stretched. Bounces are common from here, but in downtrends RSI can stay low for a while.`,-.25);
  else add(r>=50?"bull":"bear",`Momentum ${r>=50?"positive":"negative"} (RSI ${r.toFixed(0)})`,r>=50?"RSI is above 50, which is where it sits during most advances.":"RSI is below 50, which is where it sits during most declines.",r>=50?.5:-.5);
  let mx=null;for(let i=n-1;i>=n-6&&i>0;i--){if(hist[i]>0&&hist[i-1]<=0){mx={t:"bull",i};break}if(hist[i]<0&&hist[i-1]>=0){mx={t:"bear",i};break}}
  if(mx)add(mx.t,mx.t==="bull"?"MACD turned up":"MACD turned down",`The MACD line crossed ${mx.t==="bull"?"above":"below"} its signal line ${n-1-mx.i===0?"today":(n-1-mx.i)+" sessions ago"}.`,mx.t==="bull"?.75:-.75);
  const wHist=bbW.slice(-Math.min(YR,n)).filter(x=>!isNaN(x)).sort((a,b)=>a-b),wNow=last(bbW),wPct=wHist.length?wHist.filter(x=>x<=wNow).length/wHist.length:NaN;
  if(wPct<=.15)add("watch","Volatility squeeze",`Bollinger Band width is in its lowest ${Math.max(1,Math.round(wPct*100))}% of the past year. Quiet stretches like this often come before a larger move. The squeeze itself doesn't say which direction.`,0);
  const vAvg=hasVol?sma(vol,20)[n-2]:NaN,vRel=hasVol?vol[n-1]/vAvg:NaN,vTxt=hasVol&&isFinite(vRel)?` on ${vRel.toFixed(1)}× average volume${vRel>=1.5?", which adds conviction":vRel<1?", which is light":""}`:"";
  if(px>hi20)add("bull","20-day breakout",`Closed at ${f$(px)}, above the prior 20-session high of ${f$(hi20)}${vTxt}.`,1);
  else if(px<lo20)add("bear","20-day breakdown",`Closed at ${f$(px)}, below the prior 20-session low of ${f$(lo20)}${vTxt}.`,-1);
  const recH=swH.filter(i=>i>=n-70).slice(-2),recL=swL.filter(i=>i>=n-70).slice(-2);
  if(recH.length===2&&hi[recH[1]]>hi[recH[0]]&&r14[recH[1]]<r14[recH[0]]-3)add("watch","Bearish RSI divergence",`Price made a higher high (${f$(hi[recH[1]])}) but RSI made a lower one (${r14[recH[1]].toFixed(0)} vs ${r14[recH[0]].toFixed(0)}). The advance is losing force.`,-.5);
  if(recL.length===2&&lo[recL[1]]<lo[recL[0]]&&r14[recL[1]]>r14[recL[0]]+3)add("watch","Bullish RSI divergence",`Price made a lower low (${f$(lo[recL[1]])}) but RSI made a higher one (${r14[recL[1]].toFixed(0)} vs ${r14[recL[0]].toFixed(0)}). Selling is losing force.`,.5);
  if(px>=hi52*.97)add("bull","Near its 52-week high",`${pct(px/hi52-1)} from the high of ${f$(hi52)}. Stocks near highs have little overhead supply.`,.5);
  else if(px<=lo52*1.03)add("bear","Near its 52-week low",`${pct(px/lo52-1)} above the low of ${f$(lo52)}.`,-.5);

  // verdicts
  const score=S.reduce((a,s)=>a+s.w,0);
  const trend=score>=3?{v:"Uptrend",tone:"bull",s:"strong"}:score>=1.25?{v:"Uptrend",tone:"bull",s:"moderate"}:score<=-3?{v:"Downtrend",tone:"bear",s:"strong"}:score<=-1.25?{v:"Downtrend",tone:"bear",s:"moderate"}:{v:"Sideways",tone:"neutral",s:"no clear edge"};
  const momentum=r>=70?{v:"Stretched",tone:"watch",s:`RSI ${r.toFixed(0)}`}:r<=30?{v:"Washed out",tone:"watch",s:`RSI ${r.toFixed(0)}`}:(r>=50&&last(hist)>0)?{v:"Positive",tone:"bull",s:`RSI ${r.toFixed(0)}, MACD up`}:(r<50&&last(hist)<0)?{v:"Negative",tone:"bear",s:`RSI ${r.toFixed(0)}, MACD down`}:{v:"Mixed",tone:"neutral",s:`RSI ${r.toFixed(0)}`};
  const volatility=wPct<=.15?{v:"Compressed",tone:"watch",s:`${pct(annVol,0)} a year`}:wPct>=.85?{v:"Elevated",tone:"watch",s:`${pct(annVol,0)} a year`}:{v:"Normal",tone:"neutral",s:`${pct(annVol,0)} a year`};

  // history base rates: forward H-session returns in similar past states
  const bucket=v=>v<30?0:v<50?1:v<70?2:3,bucketName=["RSI under 30","RSI 30–50","RSI 50–70","RSI over 70"];
  const align=i=>!isNaN(s200[i])?(c[i]>s50[i]?1:0)+(s50[i]>s200[i]?2:0):!isNaN(s50[i])?(c[i]>s50[i]?1:0):null;
  const alignName=v=>!isNaN(a200)?["below both averages, 50 under 200","above the 50-day, 50 under 200","below the 50-day, 50 over 200","above both averages, 50 over 200"][v]:v?"above the 50-day":"below the 50-day";
  const nowB=bucket(r),nowA=align(n-1),groups=[{name:"Any day",f:()=>true},{name:bucketName[nowB],f:i=>!isNaN(r14[i])&&bucket(r14[i])===nowB},{name:"Price "+alignName(nowA),f:i=>align(i)===nowA}];
  const base=groups.map(g=>{const f=[];for(let i=20;i<n-H;i++)if(g.f(i))f.push(c[i+H]/c[i]-1);f.sort((a,b)=>a-b);return{name:g.name,n:f.length,med:quantile(f,.5),up:f.length?f.filter(x=>x>0).length/f.length:NaN,p10:quantile(f,.1),p90:quantile(f,.9)}});

  return {n,px,s20,s50,s200,bbU,bbL,bbW,r14,macd,sig,hist,atr,atrPct,sdD,annVol,reg,cone,swH,swL,levels,above,below,hi52,lo52,hi20,lo20,structure,signals:S,score,trend,momentum,volatility,base,H,hasVol,wPct};
}

function scenarios(A){
  const R1=A.above[0],R2=A.above[1],S1=A.below[0],S2=A.below[1],end=last(A.cone);
  const upT=R1?R1.p:Math.max(A.hi20,A.px*(1+A.atrPct));
  const upGoal=[R2&&R2.p,end.hi68,upT+2*A.atr].filter(v=>v&&v>upT*1.005).sort((a,b)=>a-b)[0]||upT+2*A.atr;
  const dnT=S1?S1.p:Math.min(A.lo20,A.px*(1-A.atrPct));
  const dnGoal=[S2&&S2.p,end.lo68,dnT-2*A.atr].filter(v=>v&&v<dnT*.995&&v>0).sort((a,b)=>b-a)[0]||Math.max(.01,dnT-2*A.atr);
  const lean=A.score>=1.25?"bull":A.score<=-1.25?"bear":"base";
  const midChg=end.mid/A.px-1;
  return {lean,items:[
    {k:"bull",title:"Bullish path",text:`A daily close above <b>${f$(upT)}</b>${R1?` (resistance tested ${R1.touches}×)`:" (recent high)"} would open room toward <b>${f$(upGoal)}</b>. It weakens if price slips back under ${f$(upT)} within a few sessions, which would mark a failed breakout.`},
    {k:"base",title:"Trend continues",text:`If the ${A.reg.L}-day trend and recent volatility hold, price lands near <b>${f$(end.mid)}</b> (${pct(midChg)}) in ${A.H} sessions. About two out of three outcomes would fall between <b>${f$(end.lo68)}</b> and <b>${f$(end.hi68)}</b>.`},
    {k:"bear",title:"Bearish path",text:`A daily close below <b>${f$(dnT)}</b>${S1?` (support tested ${S1.touches}×)`:" (recent low)"} would put <b>${f$(dnGoal)}</b> in play. Recovering back above ${f$(dnT)} quickly would turn it into a shakeout.`}
  ]};
}

/* ---------- formatting ---------- */
function f$(v){if(!isFinite(v))return "—";if(Math.abs(v)<1&&v!==0)return "$"+v.toFixed(Math.min(12,Math.max(2,3-Math.floor(Math.log10(Math.abs(v))))));const d=v>=1000?0:2;return "$"+v.toLocaleString("en-US",{minimumFractionDigits:d,maximumFractionDigits:d})}
function pct(v,d=1){if(!isFinite(v))return "—";return (v>0?"+":v<0?"−":"")+Math.abs(v*100).toFixed(d)+"%"}
function esc(s){return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
const MONTHS=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
function fDate(iso){const [y,m,d]=iso.split("-");return `${MONTHS[+m-1]} ${+d}, ${y}`}


const api={analyze,scenarios,sma,ema,rsi,f$,pct,esc,fDate,MONTHS,last};
if(typeof module!=="undefined"&&module.exports)module.exports=api;
root.TrendAnalysis=api;
})(typeof globalThis!=="undefined"?globalThis:this);
