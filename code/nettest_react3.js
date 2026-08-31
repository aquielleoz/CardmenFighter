/* N-PLAYER REACTIVE PARITY (3 players): the host casts a Technique (Gather Energy 1D); a REMOTE OPPONENT (client 1,
 * holding Counter Spell 4D) gets the Counter window on its own board and counters over the wire — proving reactive
 * windows now belong to the remote human in 3–6p, not the auto-resolver. Over BroadcastChannel. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8297,ROOM='RX'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const modalUp=p=>p.evaluate(()=>document.getElementById('overlay').classList.contains('show'));
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await host.waitForTimeout(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await ready(c1); await wait(300); await ready(c2);
  await waitFor(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6),'3-Rider game started, host leads');

  // Stage: host holds Gather Energy (1D); c1 holds Counter Spell (4D) + ♦ energy; c2 plain. Energy covers both.
  const E5=()=>[D(2,'D','e'),D(3,'D','e'),D(4,'C','e'),D(5,'H','e'),D(6,'S','e')];
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, a.en), {
    hands:[[D(1,'D'),D(7,'C'),D(9,'H')], [D(4,'D'),D(5,'C'),D(8,'S')], [D(6,'C'),D(7,'H'),D(9,'S')]],
    en:[E5(),E5(),E5()]
  });
  await wait(500);

  // Host activates Gather Energy → the Counter window should open on client 1 (a remote opponent).
  await host.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="1D"]'); if(c)c.click(); var ca=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn'); if(ca&&ca.offsetParent!==null&&!ca.disabled)ca.click(); else if(ctx&&!ctx.disabled&&/Activate/i.test(ctx.textContent||''))ctx.click(); });
  ok(await waitFor(async()=>await modalUp(c1)),'remote opponent (client 1) got the Counter window from its mirror');
  const clicked=await c1.evaluate(()=>{ var q=document.querySelector('.respQuick'); if(q){ q.click(); return (q.textContent||'').slice(0,14); } return null; });
  ok(clicked && /Counter/i.test(clicked),'client 1 sent a Counter over the wire ('+clicked+')');
  await wait(1200);

  ok(await host.evaluate(()=>window.__cmf.pending())===false,'stack settled on the host after the remote Counter');
  ok(await host.evaluate(()=>/[Cc]ounter/.test((document.getElementById('log')||{}).textContent||'')),'host log records the remote counter');
  ok((await turnOf(host))!=null && (await turnOf(c1))!=null && (await turnOf(c2))!=null,'all three boards still live');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
