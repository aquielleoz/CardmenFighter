/* REAL WebRTC disconnect wiring (2 players). Connect over an actual DataChannel, start the duel, then CLOSE the client's
 * page — the host's channel-close / ICE handler should fire and raise the hold-the-seat banner. Proves the production
 * WebRTC events reach the same disconnect handlers the state-machine test drives via hooks. stun=0 loopback ICE. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8309),ROOM='RD'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&stun=0&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sigOut=p=>p.evaluate(()=>{ var t=document.getElementById('sigOut'); return t?t.value:''; });
const setSigIn=(p,v)=>p.evaluate(v=>{ var t=document.getElementById('sigIn'); if(t){ t.value=v; } }, v);
const clickGo=p=>p.evaluate(()=>{ var g=document.getElementById('sigGo'); if(g)g.click(); });
const barShown=p=>p.evaluate(()=>window.__cmf?window.__cmf.disconShown():null);
const handCount=p=>p.evaluate(()=>document.querySelectorAll('#hand .card').length);
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,tries=140,ms=200){ for(let i=0;i<tries;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  let join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('rtchost')); await join.goto(url('rtcjoin')); await host.waitForTimeout(600);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  ok(await waitFor(async()=>(await sigOut(host)).length>20, 60, 200),'host generated an invite code');
  const offer=await sigOut(host);
  await setSigIn(join, offer); await clickGo(join);
  ok(await waitFor(async()=>(await sigOut(join)).length>20, 60, 200),'joiner generated a reply code');
  const answer=await sigOut(join);
  await setSigIn(host, answer); await clickGo(host);
  await startDuel(host, join);
  ok(await waitFor(async()=>(await handCount(host))===6 && (await handCount(join))===6, 80, 200),'real DataChannel up, both boards dealt');

  // Pull the plug: close the client's page. The host's channel-close/ICE handler must raise the hold banner.
  await join.close();
  ok(await waitFor(async()=>(await barShown(host))===true, 150, 200),'host raised the disconnect hold banner after the peer dropped (real WebRTC)');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
