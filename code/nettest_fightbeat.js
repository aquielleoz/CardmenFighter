/* THE FIGHT SUB-PHASE BEAT ON A NETPLAY **CLIENT** (fight-announce-on-commit, v1.32.3).
 *
 * Aj, live game 2026-10-02: *"fight sub phase announcement flew in when i clicked fight. it should only fly in
 * for next"*. `fightbeattest` proves SOLO cannot produce this — locally the sub-phase flips and the play lands
 * before any render sees your turn in the Fight Sub-Phase. A CLIENT is different: it sends its play, the HOST
 * crosses over and re-applies it, and a mirror can arrive in between showing "your turn, Fight Sub-Phase" —
 * which is exactly the edge `notePhaseEdge` announces. That is why the entry insists the suppression be set
 * on the client's send too ("two parks of nine").
 *
 * BOTH DIRECTIONS, ON THE CLIENT: `▶ Next` with nothing selected MUST announce, and `⚔️ Fight` with a card
 * selected must NOT. Round 1 is jabs only, and one selected card is still a cross-AND-commit.
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
const beatUp=p=>p.evaluate(()=>{ const fx=document.getElementById('roundfx'); return !!(fx && /phasefx/.test(fx.className) && /Fight sub-phase/.test(fx.textContent||'')); });
// watches for the beat, and DECLINES any window the client is offered on the way (it holds a Quick on purpose)
async function watchBeat(p, ms){ let seen=false; const t0=Date.now(); while(Date.now()-t0<ms){
    if(await p.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d && d.offsetParent && !d.disabled) d.click(); const fx=document.getElementById('roundfx'); return !!(fx && /phasefx/.test(fx.className) && /Fight sub-phase/.test(fx.textContent||'')); })) seen=true;
    await wait(40); } return seen; }
const myTurn=p=>p.evaluate(()=>window.__cmf && window.__cmf.turn()===0);   // a client's mirror is seat-ROTATED: its own seat is 0
const label=p=>p.evaluate(()=>(document.getElementById('fightBtn').textContent||'').trim());
// "ready" = nothing is resolving. NOT "Fight is enabled": in the Fight Sub-Phase with nothing selected it is correctly off
const ready=p=>p.evaluate(()=>{ const f=document.getElementById('fightBtn'), h=(document.getElementById('hint')||{}).textContent||'', fx=document.getElementById('roundfx');
  return !!f && !/Hold on|fighting|Waiting/.test(h) && !(fx && /show/.test(fx.className) && !/phasefx/.test(fx.className)); });   // the Fight beat itself is non-blocking — it is not 'busy'

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

  // the host holds only low cards, the client high ones: the host leads, the client answers, the host cannot
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(10,'H','c'),C(11,'C','c'),C(12,'S','c'),C(13,'D','c'),C(9,'D','cq')],
                       null, [1,2,3,4,5,6,7,8,9,10].map(n=>C(n,'D','ce'))); });
  /* THE CLIENT HOLDS ♦9 LEYLINE AND THE ENERGY TO CAST IT — the shape that reproduces the report. The go-round
     starts at the CONTROLLER, so the client's own crossing offers IT priority first; its pass closes the
     go-round and a mirror lands on "your turn, Fight Sub-Phase" before the host re-applies the play. Without a
     Quick the crossing auto-advances and no such mirror exists, so the leg could not fail. */
  await wait(500);
  ok(await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="c10H"]')), 'hands staged');
  // whoever opened, get the turn to the client with the host's 3 on the pile
  if(!(await myTurn(join))){ await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h3D"]'); if(c)c.click(); }); await clickFight(host); }
  ok(await until(()=>myTurn(join)), 'the turn reached the client');
  await until(()=>ready(join), 80);

  // ---- leg 1: ▶ Next with nothing selected — the beat is the point
  await join.evaluate(()=>{ [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(c=>c.click()); });
  ok(/Next/.test(await label(join)), 'STAGED: client in Main with nothing selected, the button reads Next ('+(await label(join))+')');
  await join.evaluate(()=>document.getElementById('fightBtn').click());
  ok(await watchBeat(join, 5000), 'client: ▶ Next brought in the "Fight sub-phase" beat');
  // now play into the Fight Sub-Phase (Fight, with a card) so the round goes on
  await until(()=>ready(join), 80);
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="c10H"]'); if(c)c.click(); });
  await clickFight(join);
  ok(await until(()=>join.evaluate(()=>!document.querySelector('#hand .card[data-id="c10H"]'))), 'the client played its 10');
  // the host cannot beat a 10 — it passes, the client wins the round and leads the next one
  await until(()=>host.evaluate(()=>window.__cmf.turn()===0), 80);
  await clickPass(host);
  ok(await until(async()=>(await myTurn(join)) && await join.evaluate(()=>!document.querySelector('#pile .card')), 150), 'the client won the round and leads the next one');
  await until(()=>ready(join), 150);

  // ---- leg 2: ⚔️ Fight with a card selected in Main — one press crosses AND plays, so no beat
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="c11C"]'); if(c)c.click(); });
  await wait(250);
  ok(/Fight/.test(await label(join)), 'STAGED: client in Main with a card selected, the button reads Fight ('+(await label(join))+')');
  await join.evaluate(()=>document.getElementById('fightBtn').click());
  const beat2=await watchBeat(join, 4000);
  ok(await join.evaluate(()=>!document.querySelector('#hand .card[data-id="c11C"]')), 'one ⚔️ Fight press played the card');
  ok(!beat2, 'client: the "Fight sub-phase" beat did NOT fly in over the card it had just played'+(beat2?' ← REPRODUCED':''));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
