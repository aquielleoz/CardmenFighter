/* THE CLIENT MUST PLAY THE FIGHTER KICK FINISHER — Aj, 2026-08-29: "the client didn't play the rider kick
 * animation even tho they won".
 *
 * All three `sendCeremony` call sites sat ONE LINE BELOW the terminal `return endGame()`, so on the single
 * round that ends the game the client never received the ceremony. `ceremonyResFor` carries `kick` faithfully;
 * it simply never left the host. The client therefore reached `endGame()` with `pendingKick` false and went
 * straight to the win screen — no finisher, no sound.
 *
 * Deterministic staging: the client is put on ONE shield, the host holds a pair and the client holds only
 * singles, so the host's pair wins the round, strips the last shield and lands the Fighter Kick. No deal can
 * change it.
 * Run: node nettest_kick.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8371,ROOM='KK'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  pile:document.querySelectorAll('#pile .card').length,
  hand:document.querySelectorAll('#hand .card').length,
  log:((document.getElementById('log')||{}).textContent||''),
  kickShown:/show/.test((document.getElementById('kick')||{}).className||''),
  kickText:((document.getElementById('kick')||{}).textContent||'').trim(),
  kicking:document.body.classList.contains('kicking'),
  endShown:(document.getElementById('overlay')||{}).classList.contains('show'),
}));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=120,ms=120){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
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

  /* ROUND 1 IS JABS ONLY — specials are locked — so get to round 2 before staging the pair. The first version
     of this suite staged a pair immediately and the play was silently refused: the turn never reached the
     client and five assertions fell together. */
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(join)).yourTurn, 80), 'round 1: the turn reached the client');
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  ok(await until(async()=>(await snap(host)).round>=2, 120), 'round 2 reached, so Specials are unlocked');

  /* Host: a pair of 9s. Client: unmatched singles it cannot answer a pair with, and ONE shield left — so the
   * host's pair lands the FIGHTER KICK. Shields are forced to ZERO, not one: the kick fires on the next
   * Special win AFTER a player is already out of shields, so leaving them on 1 only strips it (measured — the
   * first version staged 1 and the round ended normally). */
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(9,'D','h'),C(9,'H','h'),C(4,'C','h'),C(5,'S','h')],
                       [C(3,'D','c'),C(6,'H','c'),C(7,'C','c'),C(8,'S','c')],
                       null, null, 4, 0);
  });
  await wait(600);
  ok(await join.evaluate(()=>document.querySelectorAll('#youShields .s.on').length===0), 'hands and shields staged (the client is out of shields)');

  await host.evaluate(()=>{ ['h9D','h9H'].forEach(id=>{const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click();});
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(host)).pile>0, 60), 'the host led a Pair');
  ok(await until(async()=>(await snap(join)).yourTurn, 60), 'the turn reached the client');
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });

  // the host's own finisher — the control, and proof the round really was terminal
  const hostKick = await until(async()=>{ const s=await snap(host); return s.kickShown || /FIGHTER KICK/i.test(s.log); }, 80);
  ok(hostKick, 'the round ended in a FIGHTER KICK on the host');

  /* THE ASSERTION. The client is the LOSER here, so it must see the finisher too — the animation is how the
   * game tells you the duel is over, and it is what never arrived. */
  const joinKick = await until(async()=>{ const s=await snap(join); return s.kickShown || s.kicking; }, 90);
  ok(joinKick, 'the CLIENT plays the Fighter Kick finisher' + (joinKick?'':'  <-- REPRODUCED: the ceremony never reached it, so pendingKick was false at endGame()'));

  const js = await snap(join);
  ok(/FIGHTER KICK/i.test(js.log) || /FIGHTER KICK/i.test(js.kickText),
     '  → and its battle log records the kick');
  ok(await until(async()=>(await snap(join)).endShown, 60), '  → and it still reaches the end screen afterwards');

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
