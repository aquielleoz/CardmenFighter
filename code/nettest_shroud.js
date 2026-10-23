/* A CLIENT USES HOLY SHROUD'S QUICK ABILITY, AND THE HOST APPLIES IT (v1.35.2.2, epic/loss-all-default).
 *
 * Aj, 2026-10-22: *"it needs to be a quick activatable ability on an equip. So you can decide when to take the counter
 * off and protect the table."* The ability is a board control (⚡ Use on the Equipment), not a card in hand, so it has
 * its own intent, `op:'ability'`, which both host handler families must apply — and a client's own UI must stop for it
 * when its only answer is on the board.
 *
 * Staging: round 2, the host holds a pair, the client holds two singles it cannot answer with, nothing castable, two
 * shields and ONE Holy Shroud on its board. The host leads the pair, the client passes, and the Resolution window opens
 * on the client (struck, the Shroud's stake). The client presses Yes and ⚡ Use. Asserted on the HOST's state (the
 * authority), then on both logs.
 * Run: node nettest_shroud.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { clickFight, clickPass } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8473),ROOM='SH'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  pile:document.querySelectorAll('#pile .card').length,
  hand:document.querySelectorAll('#hand .card').length,
  log:[...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'),
  modal:!!(document.getElementById('respYes') && document.getElementById('respYes').offsetParent),
}));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=120,ms=120){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
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
  ok(await until(async()=>(await snap(host)).hand>0), 'duel started');

  // round 1 is jabs only — reach round 2 before staging a pair
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click(); });
  await clickFight(host);
  ok(await until(async()=>(await snap(join)).yourTurn, 80), 'round 1: the turn reached the client');
  await clickPass(join);
  ok(await until(async()=>(await snap(host)).round>=2, 120), 'round 2 reached, so Specials are unlocked');

  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.forceAll([[C(9,'D','h'),C(9,'H','h'),C(4,'C','h'),C(5,'S','h')], [C(3,'D','c'),C(6,'S','c')]], [[],[]], [4,2],
      { equip:[null, [{ id:'H9', name:'Holy Shroud', counters:1, decay:false, rank:9, suit:'H', quickAbility:{ kind:'ward', immune:true, cantLose:true } }]] });
  });
  await wait(600);
  ok(await until(()=>join.evaluate(()=>!!document.querySelector('#youEquipZone .eq'))), 'STAGED: the client sees its Holy Shroud on its board');

  await host.evaluate(()=>{ ['h9D','h9H'].forEach(id=>{const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click();}); });
  await clickFight(host);
  ok(await until(async()=>(await snap(host)).pile>0, 60), 'the host led a Pair');
  ok(await until(async()=>(await snap(join)).yourTurn, 60), 'the turn reached the client');
  await clickPass(join);

  /* THE CLIENT IS STOPPED FOR THE SHROUD ALONE. Nothing in its hand is castable, so before v1.35.2.2's stop decision a
     window like this auto-passed — and this one owes the client a shield. */
  ok(await until(async()=>(await snap(join)).modal, 100), 'the client\'s Resolution window opens for the Shroud alone (AUTO, its stake)');
  await join.evaluate(()=>{ const y=document.getElementById('respYes'); if(y) y.click(); });
  ok(await until(()=>join.evaluate(()=>{ const u=document.querySelector('#youEquipZone .eqUse'); return !!(u && u.offsetParent); }), 60), 'after Yes the client\'s Shroud carries ⚡ Use');
  await join.evaluate(()=>{ const u=document.querySelector('#youEquipZone .eqUse'); if(u) u.click(); });

  // THE AUTHORITY: the host's own state, not the client's mirror
  ok(await until(async()=>(await snap(host)).round>=3, 120), 'the round resolved on the host');
  const h=await host.evaluate(()=>({ shields:window.__cmf.shieldsOf(1), eq:(window.__cmf.equipOf ? window.__cmf.equipOf(1) : null) }));
  ok(h.shields===2, 'the HOST applied it: the client kept both shields  ('+h.shields+')');
  ok(Array.isArray(h.eq) && h.eq.length===0, 'and the Shroud\'s only counter is spent — it left the client\'s board  ('+JSON.stringify(h.eq)+')');
  const hl=(await snap(host)).log, jl=(await snap(join)).log;
  ok(/removed a Holy Shroud counter — no player can lose a shield this round\./.test(hl), 'the host\'s log names the use');
  ok(/You removed a Holy Shroud counter — no player can lose a shield this round\./.test(jl), 'and the client reads it in its own frame ("You removed…")');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
