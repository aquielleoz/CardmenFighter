/* DISCONNECT / RECONNECT / DROP (3 players). Drives the host's disconnect state machine via the dbg hooks (BroadcastChannel
 * has no real ICE, so __cmf.drop/reconnect/dropNow/graceMs stand in for the WebRTC connection events that call the SAME
 * handlers in production). Verifies: a drop raises the hold-the-seat banner on host + bystander; a reconnect clears it with
 * nobody eliminated; a grace-window expiry AUTO-DROPS (concede + continue) with survivors playing on; and a manual Drop of the
 * last opponent ends the game. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8307),ROOM='DC'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const barShown=p=>p.evaluate(()=>window.__cmf?window.__cmf.disconShown():null);
const elim=(p,s)=>p.evaluate((s)=>window.__cmf?window.__cmf.eliminated(s):null, s);
const passo=(p,s)=>p.evaluate((s)=>window.__cmf?window.__cmf.passo(s):null, s);
const roundOf=p=>p.evaluate(()=>parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0);
const spectating=p=>p.evaluate(()=>document.body.classList.contains('spectating'));
const leadFirst=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); });
const passT=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var b=document.getElementById('passBtn'); if(b)b.click(); });
const finishedOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.finished():null);
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
  ok(await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6),'3-Rider game started');

  // ---- Phase A: drop → banner holds the seat; reconnect → clears with nobody out ----
  await host.evaluate(()=>window.__cmf.drop(2));
  ok(await waitFor(async()=>(await barShown(host))===true),'host shows the "reconnecting…" hold banner for the dropped seat');
  ok(await waitFor(async()=>(await barShown(c1))===true),'a bystander client (c1) shows the "a player disconnected" banner');
  ok((await elim(host,2))===false,'the dropped seat is NOT eliminated during the grace window — its seat is held');
  await host.evaluate(()=>window.__cmf.reconnect(2));
  ok(await waitFor(async()=>(await barShown(host))===false),'host banner clears on reconnect');
  ok(await waitFor(async()=>(await barShown(c1))===false),'bystander banner clears on reconnect');
  ok((await elim(host,2))===false && (await finishedOf(host))!==true,'after reconnect: nobody eliminated, game still live');

  // ---- Phase B: grace expiry hands the seat to PASSO (caretaker AI) — the player is NOT eliminated ----
  await host.evaluate(()=>window.__cmf.graceMs(500));      // shrink the window so the ticker hands off fast
  await host.evaluate(()=>window.__cmf.drop(2));
  ok(await waitFor(async()=>(await barShown(host))===true),'host holds seat 2 again');
  ok(await waitFor(async()=>(await passo(host,2))===true, 40, 150),'grace expired → PASSO took the seat');
  ok((await elim(host,2))!==true,'the player is NOT eliminated — Passo just caretakes their seat (standing preserved)');
  ok((await barShown(host))===true,'the banner stays up showing Passo is covering');
  // Passo must PASS on its turn: host leads, c1 passes, then seat 2 (Passo) auto-passes → the round resolves.
  const r0=await roundOf(host);
  await leadFirst(host);
  await waitFor(async()=>(await turnOf(c1))===0); await passT(c1);
  ok(await waitFor(async()=>await roundOf(host)>r0, 80, 150),'Passo auto-passed on seat 2’s turn — the round resolved without hanging');
  ok((await elim(host,2))!==true,'seat 2 still in the game after Passo passed (not eliminated)');

  // ---- Phase B2: the player reconnects → reclaims the seat from Passo (human back in control) ----
  await host.evaluate(()=>window.__cmf.reconnect(2));
  ok(await waitFor(async()=>(await passo(host,2))===false),'reconnect clears Passo — the human reclaims the seat');
  ok(await waitFor(async()=>(await barShown(host))===false),'the Passo banner clears on reconnect');
  ok((await elim(host,2))!==true && (await finishedOf(host))!==true,'seat 2 resumes as a live player, game still going');

  // ---- Phase C: manual Drop is still a hard eliminate (host decides a player is truly gone) ----
  await host.evaluate(()=>window.__cmf.graceMs(90000));    // restore a long window; we'll drop manually
  await host.evaluate(()=>window.__cmf.drop(1));
  ok(await waitFor(async()=>(await barShown(host))===true),'host holds c1 on its drop');
  await host.evaluate(()=>window.__cmf.dropNow(1));        // host clicks "Drop" — a hard eliminate
  ok(await waitFor(async()=>(await elim(host,1))===true, 40, 150),'manual Drop hard-eliminates c1');
  ok((await finishedOf(host))!==true,'game continues — host + seat 2 remain');
  // drop the last opponent too → last Rider standing
  await host.evaluate(()=>window.__cmf.drop(2)); await host.evaluate(()=>window.__cmf.dropNow(2));
  ok(await waitFor(async()=>(await finishedOf(host))===true, 40, 150),'dropping the last opponent ends the game (host wins)');
  ok(await waitFor(async()=>(await barShown(host))===false),'banner cleared at game end');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
