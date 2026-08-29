/* DRAG-TO-PLAY MUST GO THROUGH THE HOST — the bug Aj found by playing, 2026-08-29.
 *
 * `doFight` carried an `isClientActive()` branch that sends an intent; the drag-to-play release called
 * `playCards()` directly and `playCards` had no client guard. So on a client a DRAGGED play ran the local
 * engine, never reached the host, and left the client narrating a round the host never saw — phantom rounds in
 * the battle log, `Pair (NaN, NaN)`, and a client that appears to "race to the game end".
 *
 * Aj isolated it by changing his own behaviour and watching the symptom move: the Fight button worked, dragging
 * did not. NO SUITE HAD EVER DRIVEN THE DRAG PATH, which is why it survived twenty green netplay suites.
 *
 * Asserted in BOTH directions, because a guard that kills dragging everywhere would also pass a
 * client-only test: the CLIENT must send an intent and not resolve locally, and the HOST must still play.
 * Run: node nettest_drag.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8341,ROOM='DG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  pile:document.querySelectorAll('#pile .card').length,
  pileLabel:((document.getElementById('pileLabel')||{}).textContent||'').trim(),
  hand:document.querySelectorAll('#hand .card').length,
  log:((document.getElementById('log')||{}).textContent||''),
}));
const trace=p=>p.evaluate(()=>{ try{ return (window.__cmfTrace()||[]).join('\n'); }catch(e){ return ''; } });
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* A REAL pointer drag: Chromium synthesises pointerdown/move/up from mouse input, which is what
 * attachGroupHandlers listens for. The first small move clears the 8px threshold that arms `drag.moved`;
 * without it the release is treated as a click (selection) and nothing is ever dragged. */
async function dragToTable(page, id){
  const g = await page.evaluate((cid)=>{
    const el=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!el) return null;
    const r=el.getBoundingClientRect(), t=document.getElementById('table').getBoundingClientRect();
    return { cx:r.left+r.width/2, cy:r.top+r.height/2, tx:t.left+t.width/2, ty:t.top+t.height/2 };
  }, id);
  if(!g) return false;
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx, g.cy-24, {steps:4});     // arm drag.moved
  await page.mouse.move(g.tx, g.ty, {steps:14});       // into #table → drag.playZone='ok'
  await wait(60);
  await page.mouse.up();
  return true;
}

(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await snap(host)).hand>0), 'duel started');

  // Host holds only low cards; the client holds a 9 that beats the host's lead and a 4 it cannot play yet.
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(9,'D','c'),C(7,'H','c'),C(8,'C','c'),C(10,'S','c')]);
  });
  await wait(500);
  ok(await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="c9D"]')), 'hands staged (the client holds a 9)');

  // ---- HOST leads by DRAGGING. The negative half: the guard must not kill dragging for the host. ----
  const hostRoundBefore=(await snap(host)).round;
  ok(await dragToTable(host,'h3D'), 'the host card was draggable');
  const hostPlayed = await until(async()=>(await snap(host)).pile>0, 60);
  ok(hostPlayed, 'HOST: dragging to the table still plays the card');
  ok(await until(async()=>(await snap(join)).pile>0, 60), '  → and the client sees it, so the host path is unbroken');
  ok(await until(async()=>(await snap(join)).yourTurn, 60), 'the turn reached the client');

  // ---- CLIENT plays by DRAGGING. This is the bug. ----
  const joinRoundBefore=(await snap(join)).round;
  ok(await dragToTable(join,'c9D'), 'the client card was draggable');

  const sent = await until(async()=>/clientSend play/.test(await trace(join)), 40);
  ok(sent, 'CLIENT: a dragged play SENDS AN INTENT (trace shows `clientSend play`)' +
           (sent?'':'  <-- REPRODUCED: the drag resolved locally and the host was never told'));

  const hostSaw = await until(async()=>{ const s=await snap(host); return s.pile>0 && /9/.test(s.pileLabel+s.log); }, 60);
  ok(hostSaw, '  → and the HOST actually received it (its board shows the client’s play)');

  // The client must not have advanced the round on its own — that is the phantom-round signature.
  const jr=(await snap(join)).round, hr=(await snap(host)).round;
  ok(jr<=hr, '  → and the client did not advance past the host on its own (client '+jr+' vs host '+hr+')');

  const jlog=(await snap(join)).log;
  ok(!/NaN|undefined/.test(jlog), '  → and no NaN/undefined card appears, which a local play off a redacted mirror produces');
  ok(jr>=joinRoundBefore && hostRoundBefore>=0, '  → and the client’s round is coherent, not rewound');

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\nPASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})();
