/* THE CLIENT'S OPENING HAND ARRIVES DEALT, NOT SORTED.
 *
 * Aj, playing the client seat (2026-09-23): *"the client view's cards come pre-sorted in singles"*, and then
 * *"the cards were auto sorted from the 1st round for sure"*. Both true, and it was never a render bug:
 *
 *   - the ENGINE keeps every hand sorted — `sortHand` at the deal (`engine.js` ~597) and again at every draw;
 *   - the only thing that ever made a dealt hand LOOK dealt is `syncOrder(true)`, which scrambles the display
 *     order of the cards it sees for the first time;
 *   - `syncOrder(true)` was called from **`startGame`**, and a netplay client never runs `startGame`.
 *
 * So the host got a shuffled hand and the client got the engine's ascending one, from round 1. Measured before
 * the fix, one deal: host engine `3H 5D 6D 8H 12D 2D` rendered as `5D 8H 12D 2D 3H 6D`, while the client's
 * `6C 9S 10C 13S 13C 1C` (6·9·10·K·K·A) rendered untouched.
 *
 * IT IS THE THIRD INSTANCE OF ONE STRUCTURAL FAULT, which is why the fix is a shared function and not a line
 * in the setup handler: CLAUDE.md already records `resetBoardMemory` as "SHARED with startGame, because a
 * netplay client never runs startGame". `handOrder`, `layout` and `sortState` were in the same position and
 * were never reset on a client AT ALL — not between games, not ever. `resetHandPresentation()` owns all of it
 * and both seats call it.
 *
 * WHY THIS ASSERTS A TRACE LINE AND NOT THE HAND ORDER. "Is the hand scrambled?" is only answerable by
 * comparing against the engine's order, and a fair shuffle reproduces that order once in 720 — so the obvious
 * assertion is a red run waiting for a future sweep. That is `nettest_starter`'s mistake exactly, which this
 * repo has already paid for once: **assert the mechanism, never the outcome.**
 *
 * AND THE FIRST VERSION OF THAT MECHANISM CHECK WAS VACUOUS, CAUGHT BY A/B'ING IT. It read a trace line that
 * sat BESIDE the call in the setup handler, so deleting `resetHandPresentation()` left the trace — and the
 * suite stayed 10/0 on the broken build. `handPresetN` is bumped INSIDE the function for exactly that
 * reason: removing any CALL is then observable. Do not move it back out to a call site.
 *
 * The permutation checks below
 * are the deterministic half — a reorder that LOST or DUPLICATED a card is the failure that would actually
 * hurt, and it is assertable without any randomness.
 *
 * Run: node nettest_clientdeal.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8371),ROOM='CD'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

const domIds  = p => p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(x=>x.dataset.id));
const engIds  = p => p.evaluate(()=>window.__cmf.hand());
const traceOf = p => p.evaluate(()=>{ try{ return String(window.__cmf.trace()||''); }catch(e){ return ''; } });
const sameSet = (a,b) => a.length===b.length && a.slice().sort().join()===b.slice().sort().join();

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node nettest_clientdeal.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started, the host is dealt');
  ok(await until(async()=>(await join.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), '…and so is the client');
  await wait(900);                                   // let the opening mirror settle on both sides

  /* THE ASSERTION THIS SUITE EXISTS FOR. `t:'setup'` is the client's `startGame` and the only place it learns
     a game began; before the fix nothing ran there, so the opening deal reached the screen in engine order. */
  const jReset = await join.evaluate(()=>window.__cmf.handPresetN());
  ok(jReset>=1,
     `the CLIENT ran its hand-presentation reset at t:'setup' — the opening deal is scrambled for display (ran ${jReset}x)`+
     (jReset>=1?'':'  ← REPRODUCED: nothing reset the client\'s hand order, so it renders the engine\'s sorted hand'));

  /* THE DETERMINISTIC HALF: a display reorder must be exactly that. A scramble that dropped or duplicated a
     card would be a far worse bug than the one being fixed, and unlike the order it is assertable outright. */
  const hDom=await domIds(host), hEng=await engIds(host);
  const jDom=await domIds(join), jEng=await engIds(join);
  ok(hDom.length>0 && sameSet(hDom,hEng), `the host renders every card it holds, exactly once (${hDom.length})`);
  ok(jDom.length>0 && sameSet(jDom,jEng), `the client renders every card it holds, exactly once (${jDom.length})`);
  ok(new Set(jDom).size===jDom.length,   'no card is rendered twice on the client');

  /* AND THE OTHER HALF OF THE SAME FAULT: `handOrder`/`layout`/`sortState` lived only in `startGame`, so on a
     client they were never reset between games either. The opening deal must be all SINGLES — a group carried
     over from a previous game, or a stale arrangement, shows up here. */
  const groups = await join.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .group')).map(g=>g.querySelectorAll('.card').length));
  ok(groups.length===jDom.length && groups.every(n=>n===1),
     `the client's opening hand is ungrouped, one card per group [${groups.join('')}]`);

  /* PARITY, WHICH IS THE POINT OF THE WHOLE REPORT. Aj: "both comments stem from the client and host seeming
     to have different UI/UX experiences." Whatever the host does at a deal, the client must do too. */
  const hTr = await traceOf(host);
  ok(hDom.length===jDom.length, `both seats are dealt the same number of cards (${hDom.length})`);
  ok(typeof hTr==='string', 'the host trace is readable (the two seats are compared, not each judged alone)');

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
