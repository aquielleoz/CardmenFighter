/* EVERY CAST AND ANSWER ARRIVES IN THE CAST COLUMN, ON EVERY SEAT (drag-and-stack step 3).
 *
 * The board's stack shows each object as a card that flies in from whoever cast it, read off `state.stack` — so a
 * cast that is on the stack at a render arrives the same way on every seat. Two cases cannot be seen that way, and
 * this suite drives both from a real host and a real guest:
 *   A  THE HOST CASTS A TECHNIQUE NOBODY CAN ANSWER. It resolves inside one host call, so no mirror ever carries it
 *      on the stack. The host already announced it (`t:'fx'`, v1.31.93), but only as an art pop; it must now LAND in
 *      the guest's column (`showFx` → `presentStackArrival`).
 *   A2 THE HOST CASTS SABOTAGE AT THE GUEST'S EQUIPMENT. The removal tail never announced at all, so a guest never saw
 *      the host's Sabotage — `presentOwnCast` is now every cast tail's announcement.
 *   B  THE GUEST COUNTERS THE HOST'S TECHNIQUE. An answer had no presentation anywhere — the host only narrated it.
 *      The host now shows it and announces it (`fxBroadcast`), so the Counter Spell lands in BOTH columns.
 * Read by watching for the ghost card each arrival flies (`.stkGhost`, tagged with the card's id), never by timing.
 *
 * Run: node nettest_stackfly.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { clickQuick } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8462),ROOM='SF'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const watch=p=>p.evaluate(()=>{ window.__ghosts=[]; new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{
  if(n.classList && n.classList.contains('stkGhost')) window.__ghosts.push({ card:n.getAttribute('data-card'), how:n.hasAttribute('data-arrive')?'arrive':'stack' }); }))).observe(document.body,{childList:true}); });
const ghostsFor=(p,id)=>p.evaluate(id=>window.__ghosts.filter(g=>g.card===id).length, id);
const howFor=(p,id)=>p.evaluate(id=>window.__ghosts.filter(g=>g.card===id).map(g=>g.how).join(','), id);
let host, join;

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>host.evaluate(()=>document.querySelectorAll('#hand .card').length>0)), 'duel started');
  await until(()=>host.evaluate(()=>!/show/.test((document.getElementById('roundfx')||{}).className||'')), 80);
  await watch(host); await watch(join);
  const cast=async(id)=>{ await host.evaluate(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) (c.closest('.group')||c).click(); }, id);
    await wait(250); await host.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && !x.disabled) x.click(); }); };
  const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});

  // ================= A: the host's Technique, which nobody can answer =================
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(3,'C','h'),C(6,'H','h'),C(9,'S','h')], [C(5,'H','c'),C(7,'S','c')]], [E('C','he'), []], null, {round:3, turn:0}); });
  await wait(600);
  await cast('h3C');
  const aHost=await until(async()=>(await ghostsFor(host,'h3C'))>0, 40);
  const aJoin=await until(async()=>(await ghostsFor(join,'h3C'))>0, 40);
  ok(aHost, 'A: the host\'s own Technique arrives in the HOST\'s column');
  ok(aJoin, 'A: …AND IT LANDS IN THE GUEST\'S, though it resolved in one call and no mirror carried it  [guest: '+(await howFor(join,'h3C'))+'; host: '+(await howFor(host,'h3C'))+']');
  ok(await join.evaluate(()=>window.__ghosts.filter(g=>g.card==='h3C').length===1), '  …exactly once on the guest');

  // ================= A2: the host's Sabotage, a tail that never announced =================
  await wait(2600);
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(5,'S','h'),C(6,'H','h'),C(9,'S','h')], [C(5,'H','c'),C(7,'S','c')]], [E('S','he'), []], null,
      {round:3, turn:0, equip:[null,[{id:'eqG', name:'Holy Bow', rank:8, suit:'H', delta:2}]]}); });
  await wait(600);
  await cast('h5S');
  await wait(400);
  await host.evaluate(()=>{ const e=document.querySelector('.eq.targetable'); if(e) e.click(); });
  await wait(300);
  await host.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && !x.disabled && /Activate/.test(x.textContent||'')) x.click(); });
  const a2Join=await until(async()=>(await ghostsFor(join,'h5S'))>0, 40);
  ok(await host.evaluate(()=>(window.__cmf.equipOf(1)||[]).length===0), 'STAGED: the host\'s Sabotage really destroyed the guest\'s Holy Bow');
  ok(a2Join, 'A2: THE HOST\'S SABOTAGE REACHES THE GUEST\'S COLUMN — the removal tail never announced before'+(a2Join?'':'  ← not announced'));

  // ================= B: the guest counters the host's Technique =================
  await wait(2600);
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(3,'C','hb'),C(6,'H','h'),C(9,'S','h')], [C(4,'D','c'),C(7,'S','c')]], [E('C','he'), E('D','ce')], null, {round:3, turn:0}); });
  await wait(600);
  await cast('hb3C');
  const offered=await until(()=>join.evaluate(()=>[...document.querySelectorAll('.respQuick')].some(b=>b.offsetParent!==null && /Counter/.test(b.textContent||''))), 60);
  ok(offered, 'STAGED: the guest is offered Counter Spell against the host\'s Technique');
  await clickQuick(join, 'Counter');
  const bHost=await until(async()=>(await ghostsFor(host,'c4D'))>0, 40);
  const bJoin=await until(async()=>(await ghostsFor(join,'c4D'))>0, 40);
  ok(bHost, 'B: THE GUEST\'S ANSWER ARRIVES IN THE HOST\'S COLUMN — answers never had a presentation'+(bHost?'':'  ← the host only narrated it'));
  ok(bJoin, 'B: …and in the guest\'s own');
  ok(await host.evaluate(()=>(window.__cmf.handOf(1)||[]).indexOf('c4D')<0), '  …and it really was cast: Counter Spell left the guest\'s hand on the host');

  // ================= C: a guest's own cast holds the GUEST's board for its art flash (ruling 20) =================
  /* The hold starts where every seat presents a cast (`presentStackArrival`), so a guest holds for its own cast when
     the host's announcement comes back. Measured inside the guest's page, from its own ⚡ click. */
  await wait(2600);
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(3,'S','h'),C(6,'H','h')], [C(3,'C','g'),C(9,'H','g')]], [[], E('C','ge')], null, {round:3, turn:1}); });
  await until(()=>join.evaluate(()=>window.__cmf.turn()===0 && !!document.querySelector('#hand .card[data-id="g3C"]')), 60);
  await wait(400);
  const gc=await join.evaluate(async()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const sel=id=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="'+id+'"]'))[0]; if(g) g.click(); return !!g; };
    sel('g3C'); await sleep(250); const cb=document.getElementById('ctxBtn'); if(!cb || cb.disabled) return { err:'⚡ not offered' };
    const t0=performance.now(); cb.click();
    let held=null; for(let i=0;i<100;i++){ const h=(document.getElementById('hint').textContent||''); if(/is being cast/.test(h)){ held=h.trim(); break; } await sleep(20); }
    sel('g9H'); await sleep(100); const fightDuring=!document.getElementById('fightBtn').disabled;
    let at=null; for(let i=0;i<300;i++){ if(!document.getElementById('fightBtn').disabled){ at=performance.now(); break; } await sleep(20); }
    return { held, fightDuring, liveAfter: at==null?null:Math.round(at-t0) }; });
  ok(!gc.err && gc.held && /Brilliant Tactic/.test(gc.held) && !gc.fightDuring,
     'C: A GUEST\'S OWN CAST HOLDS THE GUEST\'S BOARD — Fight off, and the hint names the card  ['+JSON.stringify(gc)+']');
  ok(gc.liveAfter!=null && gc.liveAfter>=2300 && gc.liveAfter<=4500, '  …and it comes back on its own once the flash has run  [live after '+gc.liveAfter+'ms]');

  await wait(2600);
  ok(await host.evaluate(()=>document.querySelectorAll('.stkGhost').length===0) && await join.evaluate(()=>document.querySelectorAll('.stkGhost').length===0), 'no ghost is left behind on either screen');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
