/* N-PLAYER TARGETING (3 players): a client (seat 1) casts a "target 1 rival" card (Back Stab, 10S = lockout; Critical
 * Hit until v1.36.0, when it came to hit every rival) and picks a SPECIFIC opponent panel. Verifies the seat-rotation is un-rotated correctly on the host so the chosen
 * opponent is the one hit (and nobody else). Over BroadcastChannel. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const autoAnswerWindows=require('./netwindows.js'); const http=require('http'),fs=require('fs'),path=require('path');
const { selectAndFight, clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8298),ROOM='TG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const shieldsOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.shields():null);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const leadFirst=p=>selectAndFight(p);                       // two-state button since epic step 20 — see fightclick.js
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await host.waitForTimeout(1200);
  /* ANSWER WINDOWS THIS SUITE DOES NOT SCRIPT — see `netwindows.js`. The duel suites get this from
     `startDuel`; the 3-player ones hand-roll their lobby, so they install it themselves. Without it a
     client seat offered priority at Fight End parks the host forever: `nettest_3p` hung 4 times in 8
     runs the day the prompt default widened, against 8/8 on the build before it. */
  await autoAnswerWindows(host,'host'); await autoAnswerWindows(c1,'c1'); await autoAnswerWindows(c2,'c2');
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await ready(c1); await wait(300); await ready(c2);
  await waitFor(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6);

  // Host leads (round 1 jab) → turn passes to c1.
  await leadFirst(host);
  ok(await waitFor(async()=>(await turnOf(c1))===0),'turn reached client 1');

  /* TWO CARDS SINCE v1.36.0. The suite's first subject — a client picks a SPECIFIC opponent panel and the host
     un-rotates it to the right absolute seat — needs a card that still has one target, and Critical Hit no longer
     does: "Every Rival loses 1 shield" (DAMAGE_ALL ships on), so it casts on the tap. Leg A is therefore BACK STAB
     (♠10, "Target Rival skips the whole round"); leg B is Critical Hit, asserting what it does now — both rivals
     hit, every frame reading "aimed at every rival", and the pitched card still named.
     Stage: c1 holds Back Stab (10S), Critical Hit (9S), ONE Broadway card (10H) so the pitch needs no pick, and
     ample ♠ energy for both; host & c2 plain (no counters). Everyone at 4 shields. */
  const spade=()=>{ var a=[]; for(var i=0;i<20;i++) a.push(D((i%9)+1,'S','e'+i)); return a; };
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, a.en, a.sh), {
    hands:[[D(2,'C',"h0"),D(3,'C',"h0"),D(6,'H',"h0")], [D(10,'S'),D(9,'S'),D(7,'C',"h1"),D(8,'H',"h1"),D(10,'H',"h1")], [D(2,'D',"h2"),D(3,'H',"h2"),D(4,'C',"h2")]],
    en:[[],spade(),[]], sh:[4,4,4]
  });
  await wait(500);
  const sh0=[await shieldsOf(host), await shieldsOf(c1), await shieldsOf(c2)];   // [host, c1, c2] each is that page's own shields
  const castOn=(page,id)=>page.evaluate((id)=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); var ca=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn'); if(ca&&ca.offsetParent!==null&&!ca.disabled)ca.click(); else if(ctx&&!ctx.disabled&&/Activate/i.test(ctx.textContent||''))ctx.click(); }, id);
  const logOf=page=>page.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'));
  const lockOf=seat=>host.evaluate(s=>window.__cmf.lock(s), seat);

  // ---------- LEG A: Back Stab, one target. c1 targets c2 (absolute seat 2 → on c1's rotated board that's panel data-seat="1").
  await castOn(c1,'10S');
  ok(await waitFor(async()=>await c1.evaluate(()=>!!document.querySelector('.oppPanel[data-seat="1"].targetable'))),'c1 entered target-pick mode');
  await c1.evaluate(()=>{ var el=document.querySelector('.oppPanel[data-seat="1"]'); if(el)el.click(); });   // pick the rotated panel = absolute seat 2
  // v1.29.5: tapping a target only STAGES it — confirm with ⚡ Activate. Nothing is spent until this click.
  await wait(250);
  await c1.evaluate(()=>{ var b=document.getElementById('ctxBtn'); if(b && /Activate/i.test(b.textContent||'')) b.click(); });
  // Response windows auto-decline (no counters); c2 is locked out, the host and c1 are not.
  ok(await waitFor(async()=>await lockOf(2)===true, 80, 150),'the CHOSEN opponent (c2, absolute seat 2) is locked out');
  ok(await lockOf(0)===false,'the host was NOT locked');
  ok(await lockOf(1)===false,'the caster c1 was NOT locked');
  /* THE REMOTE SEAT'S TECHNIQUE MUST REACH THE HOST'S TALLY (v1.31.96). `hostApplyMoveN` resolves a client's
   * activation and narrates it; every bumpEffect call site is a LOCAL path (your own actions, the response
   * windows, and buildOppBeats — which covers AI seats only), so seat 1's Techniques read 0 in the record that
   * every seat ADOPTS. This is the N-PLAYER half; nettest_record covers the duel half. Read live from the host
   * rather than from a finished record, because this suite does not play to a game end. */
  const cStats = await host.evaluate(()=>{ const s=window.__cmf.stats(); return s && s.seats && s.seats[1]; });
  ok(!!cStats && cStats.techniques>0,
     'the client\'s Technique is counted on the host ('+((cStats&&cStats.techniques)||0)+') — hostApplyMoveN tallies a remote seat');
  /* THE CLIENT'S CAST IS NARRATED IN FULL (client-activation-line-short-form) — `hostApplyMoveN` said
     "Rival 2 played Critical Hit." while the host's own casts and every AI cast read type, card and text. The
     line is broadcast, so the OTHER client reads the same wording. */
  let hLog=await logOf(host), c1Log=await logOf(c1), c2Log=await logOf(c2);
  const longA=t=>/played a Technique - 10♠ Back Stab —/.test(t);
  ok(longA(hLog), 'the host narrates the client\'s cast in full ("…played a Technique - 10♠ Back Stab — …")'+(longA(hLog)?'':'  ← '+((hLog.match(/.*Back Stab.*/)||[''])[0])));
  ok(longA(c2Log), '…and so does the OTHER client');
  /* …AND IT SAYS WHO WAS HIT, IN EACH READER'S OWN FRAME (cast-line-names-no-target; Aj: "i was the target i
     guess but it's not on the log"). The target travels as a `{foe}` SEAT, so the struck client reads "You" and
     every other seat reads its own name for seat 2 — default names are frame-relative, so the host calls it
     "Rival 3" and the caster c1 calls it "Rival 2". A sender-baked name would read "Rival 3" on all three. */
  const aimA=t=>((t.match(/10♠ Back Stab —[^\n]*?— aimed at (.+?)(?: — |\.)/)||[])[1]||'(no target named)');
  ok(aimA(hLog)==='Rival 3', `the HOST's cast line names the target: "aimed at ${aimA(hLog)}"`);
  ok(aimA(c1Log)==='Rival 2', `the CASTER's names it in its own frame: "aimed at ${aimA(c1Log)}"`);
  ok(aimA(c2Log)==='You', `and the client that was HIT reads "aimed at You": "aimed at ${aimA(c2Log)}"`);

  // ---------- LEG B: Critical Hit hits EVERY rival — no target pick, both rivals lose a shield, the caster none.
  /* EVERY CAST HOLDS THE GAME FOR ITS ART FLASH (castholdtest): a second cast pressed inside Back Stab's hold is
     refused, so wait the hold out, then retry until the card has left the hand. */
  await waitFor(async()=>(await c1.evaluate(()=>window.__cmf.castHold ? window.__cmf.castHold() : 0))===0);
  await waitFor(async()=>{ if(await c1.evaluate(()=>!document.querySelector('#hand .card[data-id="9S"]'))) return true; await castOn(c1,'9S'); await wait(300); return false; }, 40, 200);
  ok(await c1.evaluate(()=>!document.querySelector('.oppPanel.targetable')),'Critical Hit asks for NO target — it casts on the tap');
  const bothDropped = await waitFor(async()=>await shieldsOf(c2) === sh0[2]-1 && await shieldsOf(host) === sh0[0]-1, 80, 150);
  ok(bothDropped,'BOTH rivals lost a shield (host '+sh0[0]+' → '+(await shieldsOf(host))+', c2 '+sh0[2]+' → '+(await shieldsOf(c2))+')');
  ok(await shieldsOf(c1) === sh0[1],'the caster c1 was NOT hit ('+(await shieldsOf(c1))+')');
  hLog=await logOf(host); c1Log=await logOf(c1); c2Log=await logOf(c2);
  const aimB=t=>((t.match(/9♠ Critical Hit —[^\n]*?— aimed at (.+?)(?: — |\.)/)||[])[1]||'(no target named)');
  ok([hLog, c1Log, c2Log].every(l=>aimB(l)==='every rival'),
     `every frame's cast line reads "aimed at every rival": ${[hLog, c1Log, c2Log].map(aimB).join(' / ')}`);
  /* THE TARGET IS NO LONGER THE END OF THE LINE (pitch-named-in-log, 2026-10-12). The capture ran to the full
     stop, so naming the pitched card turned "Rival 3" into "Rival 3 — pitched 10♥" and these three went red on
     a correct line. It stops at the next " — " now, and the pitch gets its own assertion: this is the only suite
     that reaches `hostApplyMoveN`'s cast line, so the 3-player half of that fix is pinned here. */
  const pitchOf=t=>((t.match(/9♠ Critical Hit —[^\n]*?— pitched ([^.\n]+)\./)||[])[1]||'(no pitch named)');
  ok([hLog, c1Log, c2Log].every(l=>pitchOf(l)==='10♥'),
     `…and all three name the Broadway card it pitched, the 10♥: ${[hLog, c1Log, c2Log].map(pitchOf).join(' / ')}`);
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
