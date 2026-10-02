/* AN AUTO-PASS IS NOT A CHOICE — the host must not narrate one as "{who} let it resolve."
 *
 * Aj's duel, 2026-09-23. His battle log shows him letting a Technique resolve SEVEN times in rounds 6-7.
 * He chose ONCE. The other six were the prompt-preference auto-pass firing at boundary timings whose
 * boxes are unticked — windows he never saw — and his opponent's log said the same seven, because the
 * host is the one narrating.
 *
 * THE CHAIN: the auto-pass sent `{op:'decline'}`, the IDENTICAL intent a player clicking "Let it resolve"
 * sends, and the host answered every decline with `say(seat, '{who} let it resolve.', 'dim')`. Nothing on
 * the wire distinguished them, so the host could not. `{op:'decline', auto:true}` is the distinction.
 *
 * THE TELL THAT FOUND IT WAS THE CLOCK, not the wording: five `clientSend decline` entries 0.2s apart in
 * the netplay trace. A human clicking seven modals does not produce that spacing, and the ledger's six
 * `AUTO-PASSED — PROMPT OFF` lines accounted for them exactly.
 *
 * WHY BOTH DIRECTIONS, AND WHY THE SECOND ONE IS THE IMPORTANT HALF. Suppressing a log line is trivial to
 * do by accident — by dropping the decline. So this asserts the deliberate decline STILL narrates, and
 * that the silent one STILL APPLIES: the window closes and the game moves. "Silent" and "ignored" look
 * identical in a log and are opposite in a game.
 *
 * IT DRIVES `__cmf.clientSend` RATHER THAN THE UI, deliberately. The client's own gate is a courtesy and
 * the host's handler is the thing under test — this repo's rule for any host-side authority check. It also
 * makes the pair EXACT: the same window, answered twice, differing in one field.
 *
 * Run: node nettest_autopass.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8372),ROOM='AP'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

const hostLog = p => p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'), e=>e.textContent.trim()));
const resolveLines = async p => (await hostLog(p)).filter(l=>/let it resolve/.test(l));
const respQuicks = p => p.evaluate(()=>[].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' ')));
const armCast=(p,id)=>p.evaluate(cid=>{
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function(c){ c.click(); });
  var c=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!c) return 'no card';
  c.click();
  var ca=document.getElementById('cardActivate'), cx=document.getElementById('ctxBtn');
  if(ca && ca.offsetParent!==null && !ca.disabled && !/off/.test(ca.className)){ ca.click(); return 'icon'; }
  if(cx && !cx.disabled && !/off/.test(cx.className) && /Activate/i.test(cx.textContent||'')){ cx.click(); return 'ctx'; }
  return 'not offerable';
}, id);
const tapTarget=p=>p.evaluate(()=>{ var t=document.querySelector('.targetable'); if(!t) return false; t.click(); return true; });
/* WINDOW STATE IS READ OFF THE HOST, NOT THE CLIENT'S DOM. `__cmf.clientSend` deliberately bypasses the
   client UI, so nothing calls `hideOverlay()` there and the `.respQuick` buttons stay on screen after the
   intent is answered. The first cut polled those buttons: leg 1's stale modal satisfied leg 2's "the window
   opened again" check, leg 2 never cast anything, and the silence assertion passed having observed nothing.
   The host's `pending()` is the authority and cannot go stale this way. */
const hostPending = p => p.evaluate(()=>!!window.__cmf.pending());

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node nettest_autopass.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  const energy=n=>{ const e=[]; for(let i=0;i<13;i++) e.push(D(3,n,'e'+i)); return e; };
  /* SAME STAGING AS `nettest_quickwedge`, and for its reasons: Sabotage is TARGETED so the cast is two
     steps, and the client must OWN Equipment or `quickTargets`' protect branch has no legal target, the
     cast is refused, and the run reports "no window" having cast nothing. */
  const stage=()=>host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),{
    hands:[[D(5,'S','sab'),D(5,'S','sab2'),D(5,'S','sab3'),D(9,'C'),D(6,'S')],   // BOTH ♠5 — Sabotage is the SPADE 5; a ♣5 is a different card entirely, and staging one made leg 2 fail to arm
           [D(5,'H','ann'),D(10,'D'),D(8,'C')]],
    energies:[energy('S'), energy('H')],
    shields:[3,3],
    opts:{ equip:{ 1:[{ id:'bow', name:'Holy Bow', delta:2, counters:3 },{ id:'bow2', name:'Holy Bow', delta:2, counters:3 },{ id:'bow3', name:'Holy Bow', delta:2, counters:3 }] } }
  });
  let staged=false;
  for(let i=0;i<8 && !staged;i++){
    await stage();
    staged=await until(async()=>await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="sab5S"]')), 12)
        && await until(async()=>await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="ann5H"]')), 12);
  }
  ok(staged, 'staged: the host holds two Sabotages, the client holds Annoint and two pieces of Equipment');

  // ---------- LEG 1 · A DELIBERATE DECLINE STILL NARRATES ----------
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 60), "it is the host's turn");
  let how=null;
  await until(async()=>{ how=await armCast(host,'sab5S'); return how==='icon'||how==='ctx'; }, 60);
  ok(how==='icon'||how==='ctx', `the host casts Sabotage (via ${how})`);
  ok(await until(async()=>await tapTarget(host), 40), '…and taps the Equipment — the second step of a targeted cast');
  ok(await until(async()=>(await respQuicks(join)).length>0, 60), 'a response window opens on the CLIENT');

  const before = (await resolveLines(host)).length;
  await join.evaluate(()=>window.__cmf.clientSend({op:'decline'}));
  const narrated = await until(async()=>(await resolveLines(host)).length>before, 60);
  const line = (await resolveLines(host)).slice(-1)[0]||'';
  ok(narrated, 'LEG 1 · a DELIBERATE decline is still narrated by the host'+
     (narrated?`  ["${line.slice(0,60)}"]`:'  ← the fix went too far: a real choice stopped being reported'));

  // ---------- LEG 2 · AN AUTO-PASS IS SILENT, AND STILL APPLIES ----------
  /* WAIT FOR LEG 1'S WINDOW TO CLOSE FIRST. Without this the "opens again" poll below is satisfied by the
     STALE buttons still on screen, leg 2 never casts anything, and the silence assertion passes having
     observed nothing — which is exactly what the first run of this suite did. */
  ok(await until(async()=>!(await hostPending(host)), 80), 'leg 1\'s window really closed on the HOST before leg 2 stages');
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 120), 'control came back to the host');
  await until(async()=>{ how=await armCast(host,'sab25S'); return how==='icon'||how==='ctx'; }, 60);   // `D(5,'S','sab2')` builds the id as t+n+s
  ok(how==='icon'||how==='ctx', 'the host casts the SECOND Sabotage — the same window again');
  ok(await until(async()=>await tapTarget(host), 40), '…and taps the remaining Equipment');
  ok(await until(async()=>await hostPending(host), 60), 'the response window opens again — read off the host, so a stale client modal cannot fake it');

  const before2 = (await resolveLines(host)).length;
  const pendBefore = await hostPending(host);
  await join.evaluate(()=>window.__cmf.clientSend({op:'decline', auto:true}));
  /* THE APPLIED HALF FIRST — poll for the window actually closing, so a silent-but-dropped decline fails
     here rather than passing the silence assertion below. */
  const applied = await until(async()=>!(await hostPending(host)), 60);
  ok(pendBefore && applied,
     'LEG 2 · the auto-pass is APPLIED — the window closes and play moves on'+
     (applied?'':'  ← REPRODUCED the opposite bug: suppressing the line dropped the decline'));
  await wait(900);                                    // give any late narration time to land before asserting its absence
  const after2 = (await resolveLines(host)).length;
  /* `pendBefore` IS PART OF THE CLAIM, not decoration. Twice while writing this suite the silence
     assertion went green because leg 2 never opened a window at all — no window, no line, "pass". An
     assertion that something did NOT happen has to assert that it COULD have. */
  ok(pendBefore && after2===before2,
     'LEG 2 · …and the host does NOT narrate it as a choice — Aj chose once and his log said seven'+
     (!pendBefore ? '  ← VACUOUS: no window was ever open, so this proved nothing'
      : after2===before2 ? '' : `  ← REPRODUCED: ${after2-before2} "let it resolve" line(s) for a window the player never saw`));

  /* ---------- LEG 2b · THE CLIENT RECORDS ITS OWN ACTION ----------
     `humanDeclines` sent the intent and RETURNED above its `prioNote`, so a client's ledger held what it
     was offered and never what it did — Aj's log: 15 entries, zero `→ you` lines, seven declines in the
     battle log beside it. This drives the REAL `#respDecline` button rather than `__cmf.clientSend`,
     because the early return being fixed is in the UI path and clientSend jumps over it — the two legs
     above deliberately bypass it and so cannot see this at all. */
  ok(await until(async()=>!(await hostPending(host)), 80), 'the auto-pass window closed before leg 2b stages');
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 120), 'control is back with the host');
  /* RE-STAGE. Two casts and two go-rounds have consumed the opening hand by now, so the third Sabotage is
     simply not there — the first cut of this leg timed out arming it and then satisfied its "window
     opened" poll from leg 2's STALE client modal, which is the same vacuum this suite has already fallen
     into twice. Re-stage, and read the window off the host. */
  let staged2=false;
  for(let i=0;i<8 && !staged2;i++){
    await stage();
    staged2=await until(async()=>await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="sab35S"]')), 12);
  }
  ok(staged2, 'leg 2b re-staged: a third Sabotage is back in the host\'s hand');
  await until(async()=>{ how=await armCast(host,'sab35S'); return how==='icon'||how==='ctx'; }, 60);
  ok(how==='icon'||how==='ctx', 'the host casts a THIRD Sabotage');
  ok(await until(async()=>await tapTarget(host), 40), '…and taps the last Equipment');
  ok(await until(async()=>await hostPending(host), 60), 'the window is open on the host — read there, so a stale client modal cannot fake it');
  const ledBefore = (await join.evaluate(()=>window.__cmf.prioLog())).length;
  await join.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d) d.click(); });
  const grew = await until(async()=>(await join.evaluate(()=>window.__cmf.prioLog())).some(l=>/→ you DECLINED/.test(l)), 60);
  const led = await join.evaluate(()=>window.__cmf.prioLog());
  ok(grew, `LEG 2b · the CLIENT's own ledger records its decline (${ledBefore} → ${led.length} entries)`+
     (grew?'  ['+(led.filter(l=>/→ you/.test(l))[0]||'').slice(0,60)+']':'  ← REPRODUCED: the client logs what it was offered and never what it did'));

  /* ---------- LEG 3 · THE STATIC HALF, BECAUSE A DUEL DRIVES ONLY ONE OF THE TWO HANDLERS ----------
     `hostApplyMove` (duel) and `hostApplyMoveN` (3-6 players) are separate paths — the trap this repo has
     already paid for three times — and BOTH narrate a decline. The A/B for this fix proves the duel one:
     delete its guard and leg 2 goes red. Deleting the N-PLAYER guard changes nothing here, because a duel
     never reaches it, and the first A/B of this suite duly passed 15/0 against a half-broken build.
     A 3-player leg would cost a whole second table for one boolean. The source scan costs nothing, covers
     BOTH handlers, and covers the next one someone adds — the same reason `nettest_narrate` grew a static
     half after two hand-written greps missed the Fighter Kick line. */
  const src = fs.readFileSync(path.join(DIR,'CardmenFighter.template.html'),'utf8');
  const sayLines = src.split('\n').filter(l=>/say\([^)]*\{who\} let it resolve/.test(l));
  /* `say(YOU, …)` IS EXEMPT, AND THE SCAN FINDING IT IS THE POINT. There are THREE sites, not two: the two
     host handlers, and `humanDeclines` narrating the LOCAL seat's own click. That third one has no `it` to
     read and is by definition a choice the player just made — it is the solo path that was already correct
     and is the parity this whole fix restores. Discriminating on the ACTOR says exactly that: a seat
     narrating ITSELF knows it chose; a host narrating on behalf of ANOTHER seat cannot know, and must be
     told. The first cut of this scan required the guard everywhere and failed on the correct line. */
  const remote = sayLines.filter(l=>!/say\(\s*YOU\s*,/.test(l));
  ok(remote.length>=2, `LEG 3 · found every HOST-SIDE "let it resolve" site (${remote.length} of ${sayLines.length}; the local one narrates your own click and is exempt)`+
     (remote.length>=2?'':'  ← expected the duel and N-player handlers; did one get renamed?'));
  const unguarded = remote.filter(l=>!/if\s*\(\s*!it\.auto\s*\)/.test(l));
  ok(unguarded.length===0,
     'LEG 3 · …and EVERY one is guarded by `!it.auto`, including the N-player handler this duel cannot reach'+
     (unguarded.length?'  ← UNGUARDED: '+unguarded.map(l=>l.trim().slice(0,70)).join(' // '):''));

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
