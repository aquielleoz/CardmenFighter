/* THE "X SEIZES THE INITIATIVE!" DIM MUST COME DOWN — Aj hit this twice in one game, 2026-08-29.
 *
 * `#roundfx` is `position:absolute; inset:0` INSIDE the play area, so a stuck banner dims and eats clicks on
 * the pile while the hand below keeps working. That signature is diagnostic: board dead but hand alive means
 * the banner, not `busy`.
 *
 * THE CASE THAT BROKE IT: the client identified "the new round was dealt" by the incoming hand being BIGGER
 * than the one on screen. That proxy is false exactly when the end-of-round trim is at least as big as the
 * draw — `discardToLimit` runs BEFORE `roundDraw`, so a client at the cap trims 11 to 10 and draws back to 10.
 * A player is on turn holding more than ten cards on 78% of turns, so this was common. So the client is staged
 * OVER THE CAP here on purpose; with a small hand the bug cannot happen and the suite would prove nothing.
 *
 * ASSERT THE TEARDOWN, NOT THE BANNER. A test that waits for the banner to appear passes on the broken build —
 * the banner appearing is the correct half. Poll for it going AWAY.
 * Run: node nettest_dim.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8381),ROOM='DM'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  hand:document.querySelectorAll('#hand .card').length,
  pile:document.querySelectorAll('#pile .card').length,
  dim:/show/.test((document.getElementById('roundfx')||{}).className||''),
  dimText:((document.getElementById('roundfx')||{}).textContent||'').trim().slice(0,40),
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

  /* The client holds TWELVE cards — over MAX_HAND. At the end of the round it trims to 10 and draws 2, landing
   * back on 12: the incoming hand is EQUAL to the one on screen, never greater. That is the configuration the
   * old `handGrew` proxy could not see. The host holds four low cards so the round resolves quickly. */
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    const many=[]; [3,4,5,6,7,8,9,10,12,13,1,2].forEach((r,i)=>many.push(C(r, 'DHCS'[i%4], 'c')));
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')], many);
  });
  await wait(600);
  const staged=(await snap(join)).hand;
  ok(staged>10, `client staged OVER the hand cap (${staged} cards) — the trim will match the draw, which is the case that broke`);

  // play the round out: host leads, client answers, host passes → the round resolves and the ceremony runs
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h3D"]'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(join)).yourTurn, 60), 'the turn reached the client');
  /* THE CLIENT MUST PASS, NOT PLAY. Playing drops it to 11, and the trim-then-draw brings it back to 12 —
     GREATER than what was on screen, which the old proxy could see. Passing keeps all 12, so the trim takes it
     to 10 and the draw returns it to 12: EQUAL, never greater. That one-card difference is the whole bug, and
     the first version of this suite played a card and passed on the broken build. */
  await join.evaluate(()=>{ const p=document.getElementById('passBtn'); if(p&&!p.disabled) p.click(); });

  // the banner SHOULD appear — that half was never broken
  const shown = await until(async()=>(await snap(join)).dim, 60);
  ok(shown, 'the client plays the round-end banner');

  /* THE ASSERTION. The banner must come DOWN. `playPreBeats` deliberately leaves it up on its last beat, so the
   * only question is whether anything takes it away. 12s is far longer than the ceremony (beats 750ms each plus
   * a 1350ms Round card) and far shorter than "it never clears". */
  const cleared = await until(async()=>!(await snap(join)).dim, 100, 120);
  const end = await snap(join);
  ok(cleared, 'and the banner comes DOWN again' +
     (cleared?'':`  <-- REPRODUCED: stuck on "${end.dimText}" — the board is dimmed and unclickable while the hand still works`));
  ok(end.round>=2, `  → and the client reached the next round (round ${end.round})`);
  ok(end.hand>0, `  → with a usable hand (${end.hand} cards)`);

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
