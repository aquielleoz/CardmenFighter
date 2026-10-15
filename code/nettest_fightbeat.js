/* THE FIGHT SUB-PHASE FLASHES ON A NETPLAY **CLIENT'S** CROSSING TOO — NO BANNER, NO PAUSE (drag-and-stack, 2026-10-14).
 *
 * `fightbeattest` proves it on the local seat. A CLIENT cannot see its own crossing: its quiet crossing and the play
 * it carries happen inside ONE host call, so no mirror ever shows "your turn, Fight Sub-Phase". So the HOST says so
 * (`t:'crossed'`, ahead of the mirror) and the client flashes its own strip. Ruling 10 first held the move ~700ms
 * under a banner; Aj: *"the pause for the announcement for the fight is really jarring... keep the yellow color and
 * skip the announcement"* — so the host now applies the move the moment it tells the client, and the client flashes.
 *
 * TWO LEGS, the two ways a client's crossing completes on the host:
 *   1. QUIET — nobody can add to the stack, so the host tells the client and applies the move at once.
 *   2. THROUGH A WINDOW — the client holds ♦9 Leyline, so the go-round starts at IT (the controller), it passes,
 *      and the host re-applies the play. Without the Quick this leg would be a second copy of leg 1, which is why
 *      the staging is asserted.
 * Each asserts EXACTLY ONE flash on the client (read from `__cmf.fightFlashes()`, which records the hand at the
 * flash, because the flash and the landing mirror arrive in one burst), taken while the card was STILL IN HAND, NO
 * banner, and then the card leaving. "Exactly one" also catches a client that flashes for both the notice and a
 * mirror edge.
 *
 * Run: node nettest_fightbeat.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { clickFight, clickPass } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8455),ROOM='FB'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const myTurn=p=>p.evaluate(()=>window.__cmf && window.__cmf.turn()===0);   // a client's mirror is seat-ROTATED: its own seat is 0
const inHand=(p,id)=>p.evaluate(id=>!!document.querySelector('#hand .card[data-id="'+id+'"]'), id);
// "ready" = nothing is resolving. NOT "Fight is enabled": it waits for a selection now
const ready=p=>p.evaluate(()=>{ const h=(document.getElementById('hint')||{}).textContent||'', fx=document.getElementById('roundfx');
  return !/Hold on|fighting|Waiting/.test(h) && !(fx && /show/.test(fx.className)); });
// any Fight banner the client shows — there must be none since 2026-10-14
const recordBeats=p=>p.evaluate(()=>{ window.__banners=0; const fx=document.getElementById('roundfx');
  new MutationObserver(ms=>{ ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.classList && n.classList.contains('rfBeat') && /Fight sub-phase/i.test(n.textContent||'')) window.__banners++; })); })
    .observe(fx,{childList:true, subtree:true}); });
// drive the client's play to completion, declining any window it is offered on the way (leg 2 holds a Quick on purpose)
async function playAndWatch(p, id, ms){ await p.evaluate(()=>{ window.__banners=0; window.__t0=Date.now(); });
  await p.evaluate(id=>{ [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(c=>c.click());
    const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) c.click(); }, id);
  await wait(200);
  await clickFight(p);
  const t0=Date.now();
  while(Date.now()-t0<ms){
    const gone=await p.evaluate(id=>{ const d=document.getElementById('respDecline'); if(d && d.offsetParent!==null && !d.disabled) d.click();
      return !document.querySelector('#hand .card[data-id="'+id+'"]'); }, id);
    if(gone) break; await wait(40); }
  await wait(900);   // a second flash would land here
  return p.evaluate(()=>({ flashes:window.__cmf.fightFlashes().filter(f=>f.at>=window.__t0), banners:window.__banners })); }
function judge(ok, name, w, id, gone){
  const fs=w.flashes, f0=fs[0]||{};
  ok(fs.length===1, name+': the client FLASHED ITS STRIP EXACTLY ONCE ('+fs.length+')'+(fs.length===0?' ← the client never sees its own Fight Sub-Phase':''));
  ok(fs.length>0 && (f0.hand||[]).indexOf(id)>=0, name+': …while its card was still in hand — the crossing came first  [hand '+(f0.hand||[]).join(',')+']');
  ok(w.banners===0, name+': …and NO banner  ['+w.banners+']');
  ok(gone, name+': …and then the card went down');
}

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>host.evaluate(()=>document.querySelectorAll('#hand .card').length>0)), 'duel started');
  await recordBeats(join);

  /* LEG 1 STAGING: the host holds only low cards and no Quick, the client high ones and NO energy — so nobody
     can add to the stack at the client's crossing and it auto-advances. */
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(10,'H','c'),C(11,'C','c'),C(12,'S','c'),C(13,'D','c')], [], []); });
  await wait(500);
  ok(await inHand(join,'c10H'), 'hands staged');
  // whoever opened, get the turn to the client with the host's 3 on the pile
  if(!(await myTurn(join))){ await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h3D"]'); if(c)c.click(); }); await clickFight(host); }
  ok(await until(()=>myTurn(join)), 'the turn reached the client');
  await until(()=>ready(join), 80);
  /* WHICH KIND OF CROSSING IT WAS IS READ OFF THE CLIENT'S OWN LEDGER: the duel host crosses a remote seat inside
     `E.play` and writes no `MAIN → FIGHT` line for it, but the client records the window it was owed there
     (`[main→fight] AUTO-PASSED for you …`) — absent on a quiet crossing, present when one opened. */
  const winLines=(n)=>join.evaluate(n=>(window.__cmf.prioLog()||[]).slice(n).filter(l=>/\[main→fight\]/.test(l)).join(' | '), n);
  const led1=await join.evaluate(()=>window.__cmf.prioLog().length);
  const bs1=await playAndWatch(join, 'c10H', 8000);
  const cross1=await winLines(led1);
  ok(!cross1, 'STAGED: the client\'s crossing was QUIET — no window opened at it'+(cross1?'  ['+cross1.slice(0,110)+']':''));
  judge(ok, 'quiet', bs1, 'c10H', !(await inHand(join,'c10H')));

  // the host cannot beat a 10 — it passes, the client wins the round and leads the next one
  await until(()=>host.evaluate(()=>window.__cmf.turn()===0), 80);
  await clickPass(host);
  ok(await until(async()=>(await myTurn(join)) && await join.evaluate(()=>!document.querySelector('#pile .card')), 150), 'the client won the round and leads the next one');
  await until(()=>ready(join), 150);

  /* LEG 2 STAGING: the client now holds ♦9 Leyline and the energy to cast it. The go-round starts at the
     CONTROLLER, so its own crossing offers IT priority first; once it passes, the host re-applies the play. */
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h')],
                       [C(11,'C','c'),C(12,'S','c'),C(13,'D','c'),C(9,'D','cq')], null, [1,2,3,4,5,6,7,8,9,10].map(n=>C(n,'D','ce'))); });
  await wait(500);
  ok(await inHand(join,'cq9D'), 'STAGED: the client holds ♦9 Leyline with the energy to cast it');
  await until(()=>ready(join), 80);
  const led2=await join.evaluate(()=>window.__cmf.prioLog().length);
  const bs2=await playAndWatch(join, 'c11C', 15000);
  const cross2=await winLines(led2);
  ok(/Leyline/.test(cross2), 'STAGED: the client\'s crossing OPENED a window, offering it Leyline  ['+cross2.slice(0,110)+']');
  judge(ok, 'through a window', bs2, 'c11C', !(await inHand(join,'c11C')));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
