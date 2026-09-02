/* N-PLAYER PRE-FIGHT (Back Stab) OVER NETPLAY (3 players).
 * Under REWORK, Back Stab (10♠) is a Quick only with Hermes Mode (any Q + any K form). The pre-fight window is the
 * one interactive beat that fires BEFORE a fight/pass resolves, owned by the NEXT seat. This proves it travels both ways:
 *   Phase 1 (Path A): a REMOTE opponent holds Back Stab; the HOST fights → the remote gets the pre-fight modal on its own
 *                     board, springs over the wire, and the host (active) is locked → its turn is force-skipped.
 *   Phase 2 (Path B): the HOST holds Back Stab; a REMOTE opponent fights → the HOST gets its own pre-fight modal, springs,
 *                     and the remote (active) is locked → force-skipped.
 * Over BroadcastChannel. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8301),ROOM='PF'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const HERMES=[{rank:11,suit:'S',tier:'ride',name:'J'},{rank:12,suit:'S',tier:'queen',name:'Q'},{rank:13,suit:'S',tier:'king',name:'K'}];   // Super (Hermes) = any J + any Q + any K.
// The RIDE IS REQUIRED (engine.js hasSuper, variant B) — this constant used to be Q+K only, so hasSuper was false,
// Back Stab was never a Quick, and no pre-fight window ever opened. That was the whole 6/7 failure.
const EN=()=>Array.from({length:12},(_,i)=>D(2,'S','e'+i));                                         // 12 ♠ energy — covers the 10-cost super Back Stab
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const modalUp=p=>p.evaluate(()=>document.getElementById('overlay').classList.contains('show'));
const modalTxt=p=>p.evaluate(()=>{ var o=document.getElementById('overlay'); return (o&&o.classList.contains('show'))?(o.textContent||''):''; });
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


  // ============ PHASE 1 — Path A: remote holder (c1) springs on the host's fight ============
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, a.en, null, a.opts), {
    hands:[[D(3,'D'),D(7,'C'),D(9,'H')], [D(10,'S')], [D(6,'C'),D(7,'H'),D(9,'S')]],   // c1 = seat1 holds Back Stab
    en:[EN(),EN(),EN()],
    opts:{ turn:0, forms:[null, HERMES, null] }                                        // c1 has Hermes → 10♠ is a Quick lockout
  });
  await wait(500);

  // Host leads a jab → the pre-fight window should open for the NEXT seat (c1, remote).
  await host.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="3D"]'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await waitFor(async()=>await modalUp(c1) && /about to fight|Back Stab|Spring/i.test(await modalTxt(c1))),'remote holder (c1) got the pre-fight modal from its mirror');
  const sprang=await c1.evaluate(()=>{ var q=document.querySelector('.respQuick'); if(q){ q.click(); return (q.textContent||'').slice(0,14); } return null; });
  ok(sprang && /Back Stab/i.test(sprang),'c1 sprang Back Stab over the wire ('+sprang+')');
  await wait(1600);
  // The lock is spent the instant the active player is force-skipped, so prove the skip by its effects:
  // the host never played its fight card (3D still in hand) and the turn passed to the next seat.
  ok(await waitFor(async()=>(await turnOf(host))===1, 24, 150),'host turn was force-skipped by the Back Stab (advanced to seat 1)');
  ok(await host.evaluate(()=>window.__cmf.handOf(0)).then(h=>h&&h.indexOf('3D')>=0),'host never got to fight — its selected card is still in hand');
  ok(await host.evaluate(()=>/[Bb]ack [Ss]tab|locked/.test((document.getElementById('log')||{}).textContent||'')),'host log records the Back Stab lockout');

  // ============ PHASE 2 — Path B: host holder springs on a remote's fight ============
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, a.en, null, a.opts), {
    hands:[[D(10,'S')], [D(4,'C'),D(5,'H'),D(8,'D')], [D(6,'C'),D(7,'H'),D(9,'S')]],   // host = seat0 holds Back Stab
    en:[EN(),EN(),EN()],
    opts:{ turn:2, forms:[HERMES, null, null] }                                        // host has Hermes; seat2 (c2) is active
  });
  await wait(600);
  ok(await waitFor(async()=>(await turnOf(c2))===0),'c2 now leads (its own board shows its turn)');

  // c2 leads a jab → the host (next seat after 2) should get its OWN pre-fight modal.
  await c2.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="6C"]'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await waitFor(async()=>await modalUp(host) && /about to fight|Back Stab|Spring/i.test(await modalTxt(host))),'host holder got its own pre-fight modal');
  const hostSprang=await host.evaluate(()=>{ var q=document.querySelector('.respQuick'); if(q){ q.click(); return (q.textContent||'').slice(0,14); } return null; });
  ok(hostSprang && /Back Stab/i.test(hostSprang),'host sprang Back Stab ('+hostSprang+')');
  await wait(1800);
  // c2 (remote active) is force-skipped: it never played its fight card (6C still in hand) and the turn passed to the host.
  ok(await waitFor(async()=>(await turnOf(host))===0, 26, 150),'c2 turn was force-skipped by the Back Stab (advanced to the host, seat 0)');
  ok(await host.evaluate(()=>window.__cmf.handOf(2)).then(h=>h&&h.indexOf('6C')>=0),'c2 never got to fight — its selected card is still in hand');

  ok((await turnOf(host))!=null && (await turnOf(c1))!=null && (await turnOf(c2))!=null,'all three boards still live');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
