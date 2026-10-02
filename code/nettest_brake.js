/* THE AUTO-PASS BRAKE — one press carries you through, and stops if anyone ELSE acts.
 *
 * Pass is an auto-pass: it crosses Main → Fight, and on the 19 turns in 20 where nobody can add to the
 * stack it simply goes through. When someone DOES cast into the window that press opened, the pass is held
 * and the board comes back so you can look at what changed. `moveToPlayThen`'s third argument is the brake
 * and `stackMark` is the predicate.
 *
 * WHY THIS SUITE EXISTS: the brake has been WRONG TWICE, in opposite directions, and nothing covers it.
 *   1. It braked on the passer's OWN cast. `stackMark` returned `oidSeq` alone, so a seat that passed and
 *      then sprang a Quick into its own window braked itself — the pass held, the Quick paid for, and the
 *      round it was no longer passing on protected anyway. Fixed by subtracting `castSeq[me]`.
 *   2. It measured the WRONG SEAT for a remote pass. `moveToPlayThen` defaults `actor` to YOU, so a host
 *      running the funnel for a client's pass compared the HOST's casts against the CLIENT's pass.
 * Both are silent: the wrong answer is a pass that completes or doesn't, with no error either way.
 *
 * WHY NETPLAY RATHER THAN A SOLO PAGE. The brake's whole subject is *somebody else acting*, and in solo
 * that somebody is the AI — `respondDecision` decides whether to cast, so the leg that matters would be a
 * coin flip on the deal. A client is a page this suite clicks, so every cast here is deterministic.
 *
 * THREE STAGING FACTS, each of which makes a leg pass VACUOUSLY if lost:
 *   - `prompts=all`. Main → Fight is a BOUNDARY timing and those default OFF, so without the flag every
 *     seat auto-passes the window, nothing is ever cast, and the brake is never asked a question.
 *   - THE QUICK IS ♦9 LEYLINE ASCENSION, and the choice is load-bearing. Asked directly, the engine says
 *     there are exactly THREE base Quicks — ♦4 Counter Spell, ♦9 Leyline, ♥5 Annoint — and Leyline is the
 *     only one of the three that is UNTARGETED, so it is the only one castable into an empty transition
 *     window at all (`canCastQuick` refuses a targeted Quick with no legal target — the trap that made
 *     `nettest_ridewedge` pass while casting nothing). It also does not LOCK.
 *     ⚠ DO NOT GUESS A CARD FROM THE EFFECTS TABLE. The first cut of this suite used ♣3 for
 *     "Hand-to-Hand Mastery" on the strength of a grep for `quick: true`; ♣3 is Brilliant Tactic, the
 *     quick entry belongs to another block, and the window simply never opened — a red that reads like a
 *     broken brake. `E.effectOf({rank,suit})` over all 52 answers it in a second.
 *     Back Stab — the obvious pick, and what `nettest_prefight` uses — is the one Quick that cannot test
 *     this: a lockout hits the early return one line ABOVE the brake
 *     (`if(E.isLocked(state, YOU)) return finishPassRound(...)`), so the pass completes as a forced skip
 *     and the brake is never reached. That would look exactly like "no brake".
 *   - YOU CANNOT PASS WHILE LEADING (`pass.disabled=leading`), so every leg has the other seat lead first.
 *
 * ✅ A/B'd, ONE MUTATION AT A TIME, AND EACH ONE REDS ONLY ITS OWN LEG — which is what says these legs
 * are about the brake rather than about the board happening to move:
 *   - `stackMark` returning bare `oidSeq` (bug 1)                 -> 21/1, leg 3 alone, and the dump reads
 *     *"Someone answered — your pass is on hold"* on a board whose only caster was the passer itself.
 *   - the duel re-apply keyed on `stackMark(hostState, 0)` (bug 2) -> 20/2, leg 4 alone.
 * Six consecutive clean runs on the real build.
 *
 * Run: node nettest_brake.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const { clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8388),ROOM='BR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const EN=(n,s)=>Array.from({length:n},(_,i)=>D(2,s,'e'+s+i));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

const respQuicks=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' ')));
/* A RED RUN MUST EXPLAIN ITSELF — CLAUDE.md's standing rule, and the one that turned `nettest_guard` from
   three investigations into one red run. Everything the brake reads, plus what the player would see. */
const why=p=>p.evaluate(()=>({
  turn:(window.__cmf?window.__cmf.turn():null),
  msg:((document.getElementById('message')||{}).textContent||'').trim().slice(0,70),
  hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,60),
  fightLabel:((document.getElementById('fightBtn')||{}).textContent||'').trim(),
  passDisabled:!!((document.getElementById('passBtn')||{}).disabled),
  hand:document.querySelectorAll('#hand .card').length,
  modal:!!document.querySelector('.respQuick,#respDecline')
}));
const held=p=>p.evaluate(()=>/pass is on hold/i.test((document.getElementById('message')||{}).textContent||''));
const clickPassBtn=p=>p.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled){ b.click(); return true; } return false; });
/* DECLINE ANYTHING THE OTHER SEAT IS OFFERED, so an unscripted window cannot be mistaken for the braked
   state this suite is measuring. `prompts=all` buys windows nobody asked for — CLAUDE.md, `nettest_guard`. */
const declineIfUp=p=>p.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d&&d.offsetParent!==null){ d.click(); return true; } return false; });
/* LEADING A CARD CROSSES MAIN → FIGHT TOO, so a seat holding a Quick is offered ITS OWN window on the way
   in. That window is not this suite's subject — decline it, or the lead never lands and every later
   assertion measures a board that is still waiting on a modal. */
/* ⚠ AND THE WINDOW IT OPENS MAY BELONG TO THE OTHER SEAT, WHICH IS WHAT BROKE LEG 3 FIRST TIME. The
   transition offers priority to whoever can add to the stack, so when the seat that is about to PASS is
   the one holding the Quick, the LEAD leaves a modal sitting on it — the turn never arrives, and the next
   assertion reads a board waiting on a dialog. Decline on both pages. */
/* ⚠ AND IT KEEPS DECLINING UNTIL THE CARD IS GONE, rather than a fixed number of tries. The other seat's
   modal does not appear the instant Fight is pressed — it arrives over a mirror — so a three-shot loop
   raced it and the lead silently never landed, which reads downstream as "the brake is broken". The
   `netwindows` helper would eventually auto-pass it, but only after its grace delay, by which time the
   poll waiting on the turn has already expired (CLAUDE.md: a suite that sets `prompts=all` must budget for
   at least one grace it did not ask for). Drive it until the card leaves the hand. */
async function lead(p, id, other){
  await p.evaluate(i=>{ const c=document.querySelector('#hand .card[data-id="'+i+'"]'); const g=c&&c.closest('.group'); if(g) g.click(); }, id);
  const gone=()=>p.evaluate(i=>!document.querySelector('#hand .card[data-id="'+i+'"]'), id);
  for(let i=0;i<40;i++){
    if(await gone()) return true;
    await clickFight(p);
    await declineIfUp(p); if(other) await declineIfUp(other);
    await wait(300);
  }
  console.log('   ⏱ lead('+id+') never left the hand');
  return false;
}

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_brake.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  /* `forceAll` is re-applied until the CLIENT's mirror shows the staged card: a single call can land before
     the client has adopted the deal, and staging that silently misses makes a run pass having exercised
     nothing (CLAUDE.md, the `lessontest_quicks` forced-condition rule). */
  /* ⚠ VERIFY THE STAGING ON **BOTH** PAGES, NOT ONE. The first version checked a single probe card plus
     the turn, and in the one leg whose probe lives on the HOST that left the CLIENT's hand unchecked — so
     a mirror that had not landed yet, or a round-end deal from the previous leg, left the client holding
     the PREVIOUS leg's cards (including its Quick). It then took its own transition window, sat on a
     modal nobody was watching, and the leg reported the brake broken: measured 3 reds in 5 runs, all with
     `modal:true` on the client and a round the suite never played.
     A half-checked stage is the "staging that silently misses" trap in CLAUDE.md, and the tell is a
     failure whose state belongs to an EARLIER leg. Compare the exact id sets on both seats. */
  const idsOn=p2=>p2.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).sort().join(','));
  const want=h=>h.map(c=>c.id).sort().join(',');   // `D()` already builds the id as tag+rank+suit
  async function stage(hostHand, joinHand, turn){
    const wantH=want(hostHand), wantJ=want(joinHand);
    const force = () => host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),{
      hands:[hostHand, joinHand], energies:[EN(12,'D'), EN(12,'D')], shields:[3,3],   // ♦ energy: Leyline costs 9
      opts:{ turn:turn, round:3 }
    });
    /* ⚠ STAGE TWICE, ON PURPOSE — THE ROUND DRAW LANDS **AFTER** THE FIRST ONE (measured 2026-09-29).
       Every leg but the first follows a completed round, and a duel deals two cards each at the boundary.
       So `forceAll` set the hand to exactly two cards and the game then added two more: the verify saw
       `12H#44,6S#22,h6C,h7C` where it wanted `h6C,h7C` — MY two cards plus the deal's. The outer retry
       hid it, landing on attempt 2 every time, and the sweep reported it as three `poll TIMED OUT` lines
       that read like a suite nearly failing.
       IT IS ORDER, NOT SLOWNESS, WHICH IS WHY "WAIT LONGER" IS THE WRONG FIX AND WAS MEASURED AS SUCH:
       a ~1s settle gave 3 misses per run and a ~2s settle gave 1 — helping, never reaching zero, so any
       delay I picked would be tuned to this machine. Wait for the EVENT instead: let the hands stop
       moving, then stage again onto a board with nothing in flight. The outer loop stays as a hang guard,
       and a miss now means something real rather than a deal arriving on schedule. */
    for(let i=0;i<10;i++){
      await force();
      const landed = await until(async()=>
        (await idsOn(host))===wantH && (await idsOn(join))===wantJ &&
        (await host.evaluate(()=>window.__cmf.turn()))===turn, 16);
      if(landed){ if(i) console.log('   ⓘ stage landed on attempt '+(i+1)); return true; }
      /* WHICH HALF MISSED? A retry that just loops tells you the staging is flaky and nothing else, and a
         suite that passes on attempt four is one slow machine from passing on attempt eleven. Name the
         unmet condition on every failed attempt so the margin is readable in a GREEN run. */
      console.log('   ⓘ stage attempt '+(i+1)+' missed: ' +
        [ (await idsOn(host))!==wantH ? 'HOST hand ('+(await idsOn(host))+' ≠ '+wantH+')' : null,
          (await idsOn(join))!==wantJ ? 'CLIENT hand ('+(await idsOn(join))+' ≠ '+wantJ+')' : null,
          (await host.evaluate(()=>window.__cmf.turn()))!==turn ? 'turn ('+(await host.evaluate(()=>window.__cmf.turn()))+' ≠ '+turn+')' : null
        ].filter(Boolean).join(' · '));
    }
    console.log('   ⏱ stage never landed — host '+(await idsOn(host))+' want '+wantH+
                ' | join '+(await idsOn(join))+' want '+wantJ+' | turn '+(await host.evaluate(()=>window.__cmf.turn()))+' want '+turn);
    return false;
  }
  /* A LEG MUST NOT START INSIDE THE PREVIOUS LEG'S CEREMONY, and "is the board quiet?" has to be asked as
     a STABILITY question rather than a state one. The first version of this helper was
     `rivalStatus===''  ||  turn()!=null` — trivially true, so it returned instantly, `forceAll` landed
     mid-ceremony and the round-end deal overwrote the staged hands. The symptom was leg 3 reporting the
     brake broken while the log said *"Rival 2 won the round of Jabs"*: a different round entirely.
     A poll whose condition is always true is the same bug as no poll at all. */
  /* ⚠ AND THE SNAPSHOT MUST INCLUDE "IS A CEREMONY RUNNING", which was the whole bug (measured
     2026-09-29). Everything else here is perfectly STABLE while a round ceremony plays its beats — the
     hand count does not move until the DEFERRED DRAW lands at the very end — so this returned early,
     `forceAll` set a two-card hand, and the deal then added two more. The verify saw
     `12H#44,6S#22,h6C,h7C` where it wanted `h6C,h7C`: my cards plus the deal's.
     THE RETRY HID IT, landing on attempt 2 every run, and the sweep printed it as three `poll TIMED OUT`
     lines that read like a suite nearly failing.
     WAITING LONGER IS THE WRONG FIX AND WAS MEASURED AS SUCH — a ~1s settle gave 3 misses per run, ~2s
     gave 1: helping, never zero, so any delay would be tuned to this machine. Staging TWICE around a
     settle was also tried and changed nothing, because the ceremony was still running through both.
     `inCeremony` is the actual event, so ask for it. */
  const snap=()=>host.evaluate(()=>JSON.stringify({
    t:window.__cmf.turn(),
    cer:window.__cmf.ceremony(),
    h:[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).join(','),
    rs:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
    m:!!document.querySelector('.respQuick,#respDecline')
  }));
  async function quiet(){
    let last=null, same=0;
    for(let i=0;i<80;i++){
      const now=await snap();
      same = (now===last && !JSON.parse(now).cer) ? same+1 : 0; last=now;   // a running ceremony is never 'quiet', however still the board looks
      if(same>=4) return true;
      await wait(250);
    }
    console.log('   ⏱ the board never settled: '+last);
    return false;
  }

  // ═══ LEG 1 — THE CONTROL: a quiet window does not brake, and one press is enough ═══
  /* Without this the whole suite is unfalsifiable: a build whose brake fires on EVERYTHING would pass
     every "the pass was held" assertion below. The client holds no Quick, so nothing can be added. */
  let staged = await stage([D(6,'C','h'),D(7,'C','h')], [D(4,'H','c'),D(8,'C','c')], 1);
  ok(staged, 'LEG 1 staged — the client holds NO Quick, so the transition window has nothing to offer');
  await lead(join, 'c4H', host);
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 60), '  the client led, and the turn reached the host');
  await declineIfUp(host);
  const r1 = await until(async()=>!(await host.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
  ok(r1, '  the host can Pass (it is answering a pile, not leading)');
  await clickPassBtn(host);
  const went = await until(async()=>await host.evaluate(()=>window.__cmf.turn())!==0, 60);
  ok(went && !(await held(host)),
     'A QUIET WINDOW DOES NOT BRAKE — one press and the pass went through' +
     (went ? '' : '  ← the pass never took effect; host: '+JSON.stringify(await why(host))));

  /* ── AND THAT PASS MUST BE NARRATED, ON BOTH SEATS (Aj's two-device log, 2026-09-29) ──
     This leg's pass ENDS the round — the client led and the host answered by passing — which is precisely
     the case `finishPassRound` used to swallow: its narration sat below `if(r.roundWinner!=null){ … return; }`
     so only a pass that did NOT end the round was ever logged. In a duel the second pass always ends it, so
     the hole covered most passes in every game, solo included.
     THE MEASUREMENT THAT NAMED IT: Aj pressed Pass five times, the priority ledger recorded five, and the
     battle log carried ZERO on either screen — while the CLIENT's four passes appeared on both, because a
     remote pass is narrated by the host before it resolves. Assert both frames: the host's own line, and
     that it travelled. */
  const passLines = async pg => (await pg.evaluate(()=>window.__cmf.log()||[])).filter(l=>/passed/i.test(l));
  const hostSaid = await until(async()=>(await passLines(host)).length>0, 40);
  ok(hostSaid, '  …AND THE PASS IS NARRATED — the host logs its own round-ending pass' +
     (hostSaid ? '  ['+(await passLines(host)).slice(-1)[0]+']' : '  ← REPRODUCED: the round-ending pass was swallowed'));
  const clientSaw = await until(async()=>(await passLines(join)).length>0, 40);
  ok(clientSaw, '  …and it reaches the CLIENT too — a pass is public' +
     (clientSaw ? '  ['+(await passLines(join)).slice(-1)[0]+']' : '  ← the host narrated it locally only'));

  await quiet();
  // ═══ LEG 2 — SOMEBODY ELSE CASTS: the pass is HELD ═══
  staged = await stage([D(6,'C','h'),D(7,'C','h')], [D(9,'D','q'),D(4,'H','c')], 1);
  ok(staged, 'LEG 2 staged — the CLIENT holds ♦9 Leyline, a base, untargeted, non-locking Quick; the host holds none');
  await lead(join, 'c4H', host);
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 60), '  the client led, and the turn reached the host');
  await declineIfUp(host);
  await until(async()=>!(await host.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
  const turnBefore = await host.evaluate(()=>window.__cmf.turn());
  await clickPassBtn(host);
  const offered = await until(async()=>(await respQuicks(join)).length>0, 60);
  ok(offered, '  the host\'s Pass opened the Main → Fight window and the CLIENT was offered it' +
     (offered ? '  ['+(await respQuicks(join)).map(t=>t.split(' ')[0]).join('|')+']' : '  ← nothing offered; check `prompts=all` and the ♣ energy'));
  await join.evaluate(()=>{ const q=document.querySelector('.respQuick'); if(q) q.click(); });
  const wasHeld = await until(async()=>await held(host), 60);
  ok(wasHeld, 'SOMEONE ELSE CAST — THE PASS IS HELD, and the board says so' +
     (wasHeld ? '' : '  ← the pass completed through a rival cast; host: '+JSON.stringify(await why(host))));
  ok(await host.evaluate(()=>window.__cmf.turn())===turnBefore,
     '  …and it really is still the host\'s decision — the pass did not take effect');
  /* THE OTHER HALF, and without it "held" could mean "wedged": a second press must go through. */
  await declineIfUp(host);
  await until(async()=>!(await host.evaluate(()=>!!document.getElementById('passBtn').disabled)), 40);
  await clickPassBtn(host);
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())!==turnBefore, 60),
     '  …and pressing Pass again goes through with it — held, not wedged');

  await quiet();
  // ═══ LEG 3 — YOUR OWN CAST IS NOT "SOMETHING HAPPENING" TO YOU ═══
  /* BUG 1, EXACTLY. `stackMark` returned `oidSeq` alone, so a seat that passed and then sprang a Quick into
     the window its own pass had opened braked ITSELF — and the Quick it had just paid for protected a round
     it was no longer passing on. `nettest_guard` reproduced it as a round that never resolved. Now the HOST
     is the one holding Leyline, so the transition window comes to IT. */
  staged = await stage([D(9,'D','h'),D(7,'C','h')], [D(4,'H','c'),D(8,'C','c')], 1);
  ok(staged, 'LEG 3 staged — this time the HOST holds the Quick, so its own pass opens a window for itself');
  await lead(join, 'c4H', host);
  const reached3 = await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 60);
  ok(reached3, '  the client led, and the turn reached the host' +
     (reached3 ? '' : '  ← host: '+JSON.stringify(await why(host))+'  join: '+JSON.stringify(await why(join))));
  await until(async()=>!(await host.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
  const turn3 = await host.evaluate(()=>window.__cmf.turn());
  await clickPassBtn(host);
  const selfOffered = await until(async()=>(await respQuicks(host)).length>0, 60);
  ok(selfOffered, '  the host\'s own Pass opened the window for the host itself' +
     (selfOffered ? '  ['+(await respQuicks(host)).map(t=>t.split(' ')[0]).join('|')+']' : '  ← nothing offered; the leg below would pass vacuously'));
  await host.evaluate(()=>{ const q=document.querySelector('.respQuick'); if(q) q.click(); });
  /* NOT VACUOUS: prove the cast actually happened before reading the brake. A cast that was refused leaves
     the mark unchanged for the RIGHT reason and the assertion below would pass on a broken build. */
  const reallyCast = await until(async()=>!(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="h9D"]'))), 60);
  ok(reallyCast, '  …and the host really cast it — Leyline has left its hand');
  const ownWent = await until(async()=>await host.evaluate(()=>window.__cmf.turn())!==turn3, 60);
  ok(ownWent && !(await held(host)),
     'YOUR OWN CAST DOES NOT BRAKE YOU — the pass still went through' +
     (ownWent ? '' : '  ← REPRODUCED bug 1: the seat braked itself; host: '+JSON.stringify(await why(host))));

  await quiet();
  // ═══ LEG 4 — THE BRAKE REACHES A REMOTE SEAT, MEASURED AGAINST THE RIGHT SEAT ═══
  /* BUG 2. `moveToPlayThen` defaults `actor` to YOU, so a host running the funnel for a CLIENT's pass
     compared the HOST's own casts against the client's pass — the mark then moves when the host casts and
     stands still when anyone else does, i.e. exactly inverted. The duel path re-applies the intent through
     `stackMark(hostState, 1)` and BROADCASTS rather than replying with an error, because nothing was
     illegal: the intent is simply spent against a board that has changed. */
  staged = await stage([D(9,'D','h'),D(6,'C','h')], [D(4,'H','c'),D(8,'C','c')], 0);
  ok(staged, 'LEG 4 staged — the HOST holds the Quick and leads; the CLIENT will be the one passing');
  await lead(host, 'h6C', join);
  ok(await until(async()=>await join.evaluate(()=>window.__cmf.turn())===0, 60), '  the host led, and the turn reached the client (its own frame reads 0)');
  await until(async()=>!(await join.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
  const jHand = await join.evaluate(()=>document.querySelectorAll('#hand .card').length);
  await clickPassBtn(join);
  const hostOffered = await until(async()=>(await respQuicks(host)).length>0, 60);
  ok(hostOffered, '  the CLIENT\'s pass opened the window, and the HOST was offered it' +
     (hostOffered ? '' : '  ← nothing offered; host: '+JSON.stringify(await why(host))));
  await host.evaluate(()=>{ const q=document.querySelector('.respQuick'); if(q) q.click(); });
  await until(async()=>!(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="h9D"]'))), 60);
  /* THE CLIENT'S PASS MUST NOT HAVE BEEN COMPLETED. Read the CLIENT's own frame: its seat is rotated to 0,
     so "still my turn" is `turn()===0` there. A completed pass hands the turn away and ends the round. */
  const clientKept = await until(async()=>await join.evaluate(()=>window.__cmf.turn())===0, 60);
  ok(clientKept, 'A REMOTE SEAT\'S PASS IS BRAKED TOO — the host cast, so the client decides again' +
     (clientKept ? '' : '  ← REPRODUCED bug 2: the pass completed through the host\'s cast; client: '+JSON.stringify(await why(join))));
  ok(await join.evaluate(()=>document.querySelectorAll('#hand .card').length)===jHand,
     '  …and it really did not pass — the client\'s hand is untouched');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
