/* A SEAT WHOSE OWNER LEFT BEFORE START (v1.31.98). `ldc.onclose` and `hostOnPeerDrop` act only while `started`,
 * so a client that presses Ready — taking a seat — and then closes its tab BEFORE the host starts was still
 * dealt in: `hostStartRealN` reads `nextSeat-1` and the table parks forever on a seat nobody is behind. The
 * first lobby has always had this; v1.31.95 made it more visible by putting a table back in that lobby.
 * v1.31.95's `_iceDown` marking is the evidence the guard needs. The fix is to REFUSE Start and name the seat,
 * not to prune and renumber — that is the compaction judged and declined (DECISIONS.md, netplay architecture),
 * because a middle seat means re-welcoming everyone above it.
 * RTC ONLY, and necessarily: BroadcastChannel exposes no channel state at all. Run: node nettest_ghostseat.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8607),ROOM='GS'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'application/javascript'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=200,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const sigOut=p=>p.evaluate(()=>{ var t=document.getElementById('sigOut'); return t?t.value:''; });
const setSigIn=(p,v)=>p.evaluate(v=>{ var t=document.getElementById('sigIn'); if(t) t.value=v; }, v);
const clickGo=p=>p.evaluate(()=>{ var g=document.getElementById('sigGo'); if(g)g.click(); });
const netText=p=>p.evaluate(()=>(document.getElementById('netroot')||{}).textContent||'');
const startBtn=p=>p.evaluate(()=>{ const g=document.getElementById('lobbyGo');
  return g?{present:true, disabled:!!g.disabled, text:(g.textContent||'').trim()}:{present:false}; });
async function invite(host, client){
  const offer=await (async()=>{ for(let i=0;i<120;i++){ const o=await sigOut(host); if(o.length>20) return o; await wait(150);} return ''; })();
  if(!offer) return false;
  await setSigIn(client, offer); await clickGo(client);
  const answer=await (async()=>{ for(let i=0;i<120;i++){ const a=await sigOut(client); if(a.length>20) return a; await wait(150);} return ''; })();
  if(!answer) return false;
  await setSigIn(host, answer); await clickGo(host); return true;
}
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('rtchost')); await join.goto(url('rtcjoin')); await wait(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  ok(await invite(host, join), 'the client connects over WebRTC');
  ok(await until(async()=>await join.evaluate(()=>!!document.getElementById('deckSel')), 100), 'the client reaches the deck-picker lobby');

  // Ready — and STOP. This is the window the bug lives in: seated, but the host has not started.
  await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await until(async()=>!(await startBtn(host)).disabled, 100), 'the host can Start — a seat is claimed');

  /* NOT VACUOUS: without this the assertion below would pass on a build with no guard at all, because Start is
   * already disabled before anyone readies. The seat must be live FIRST. */
  await join.close();
  ok(await until(async()=>(await startBtn(host)).disabled, 200),
     'Start is REFUSED once that seat\'s channel dies'+
     ((await startBtn(host)).disabled ? '' : '  ← REPRODUCED: the host would deal in a seat nobody is behind'));
  const t=await netText(host);
  const why=(t.match(/⚠[^⚠]*left before the game started[^⚠]{0,60}/)||[''])[0].trim();
  ok(/left before the game started/.test(t), '  → and the lobby NAMES the seat ["'+why+'"]');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
