/* THE HOST CAN BE LOCKED OUT OF A ROUND IT JUST WON (netplay duel).
 * Found 2026-08-26 by tracing the intermittent nettest_full failure, which was NOT a harness flake: the trace
 * showed the host sitting on `your turn` with an empty pile and a dead board for 57 seconds, with rivalStatus
 * still reading "Waiting for opponent…".
 *
 * Mechanism: when the CLIENT's action ends a round the HOST wins, resolution runs
 *   hostAfterRivalMove -> hostFinishRound -> resolveRoundCeremony -> afterHumanAction
 * and afterHumanAction does `if(state.turn!==YOU) driveRival(); else render();` — it never clears `busy`, which
 * awaitRival() set to true when the host handed the turn over. The N-player driver (driveN) clears busy in
 * exactly this situation; the duel path does not. The board stays locked and the game is dead.
 *
 * Deterministic here: the host leads the apex 2 (nothing beats it), so the client MUST pass, so the round always
 * ends on the client's action with the host winning — the precise configuration that triggers it.
 * Run: node nettest_roundstall.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8329,ROOM='RS'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  pile:document.querySelectorAll('#pile .card').length,
  hand:document.querySelectorAll('#hand .card').length,
  rivalStatus:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
}));
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
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

  /* Stage it: the host holds the apex 2 (fight value 15 — unbeatable), the client holds only 3s. The client
   * therefore CANNOT answer and must pass, which is what puts the round-end on the client's action. */
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(2,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(3,'D','c'),C(3,'H','c'),C(3,'C','c'),C(3,'S','c')]);
  });
  await wait(500);
  ok(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="h2D"]')), 'hands staged (host holds the apex 2)');

  // host leads the apex 2
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h2D"]'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(host)).pile>0), 'host led the apex 2');
  ok(await until(async()=>(await snap(join)).yourTurn), 'the turn reached the client');

  // the client cannot beat it, so it passes — this is what ends the round on the CLIENT's action
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  const advanced = await until(async()=>(await snap(host)).round>=2, 120);
  ok(advanced, 'the round resolved and a new round began');

  /* THE ASSERTION. The host won, so it leads the new round — its board must become usable. POLL for it rather
   * than sleeping: the round ceremony legitimately holds the board for a couple of seconds, and a fixed wait
   * here fails on a healthy build while a generous poll still catches the bug outright (when it bites, the host
   * never recovers — the original trace sat dead for 57 seconds until the harness gave up). */
  const usable = await until(async()=>await host.evaluate(()=>{
    const rs=((document.getElementById('rivalStatus')||{}).textContent||'').trim();
    if(rs!=='') return false;                       // still parked on the client
    const c=document.querySelector('#hand .card'); if(!c) return false;
    c.click();
    const f=document.getElementById('fightBtn');
    return !!(f && !f.disabled);
  }), 140);                                          // ~21s: far beyond any ceremony, far under the 57s stall
  const st=await snap(host);
  ok(st.yourTurn, `it is the host's turn again (round ${st.round})`);
  ok(usable, usable ? 'the host can play the round it just won — board handed back'
                    : `the host is LOCKED OUT of its own turn (rivalStatus "${st.rivalStatus}", Fight disabled)`);
  const landed=await host.evaluate(()=>{
    const before=document.querySelectorAll('#hand .card').length;
    const f=document.getElementById('fightBtn'); if(f&&!f.disabled) f.click();
    return before;
  });
  ok(await until(async()=>(await snap(host)).hand<landed), 'and the play actually lands, so the game continues');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
