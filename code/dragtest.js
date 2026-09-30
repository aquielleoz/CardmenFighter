/* DRAGGING A CARD TO THE TABLE MEANS TWO DIFFERENT THINGS, AND THE SUB-PHASE DECIDES WHICH.
 *
 * Epic step 20 (Aj: *"dragging to play activates card effects now, except when in the fight sub-phase"*).
 * In the FIGHT sub-phase a drag PLAYS the card; in MAIN the same gesture ACTIVATES it — which is also the
 * way into targeting and the Phantasmal picker, so it is not a shortcut for a subset of cards.
 *
 * ONLY HALF OF THAT WAS TESTED. `nettest_drag` drives drag-to-PLAY and says in its own comment that it
 * steps OUT of Main first, because its subject — a dragged play going through the host — does not happen
 * there. So the Main half, the one that CHANGED at step 20, has been driven by nothing at all, and the
 * handoff has listed it as an uncovered gesture since.
 *
 * WHY THE PAIR IS THE TEST, not two separate ones: "a drag activated" and "a drag played" are each true of
 * a build that has lost the branch entirely and does the same thing in both sub-phases. Every leg below
 * runs the SAME CARD from the SAME staging and differs only in the sub-phase, so the assertion is about
 * the branch rather than about either outcome. That is the both-ways habit `resolutiontest_ui` is built on.
 *
 * AND THE REFUSALS ARE PART OF THE FEATURE. The handler has two, both with player-facing copy: a
 * multi-card group in Main ("one card at a time") and a card with nothing to activate. A silent no-op is
 * the failure mode a drag cannot explain — there is no tooltip on a phone — so each is asserted by its
 * message AND by the board not moving.
 *
 * ✅ A/B'd BY DELETING THE BRANCH — `if(state.subPhase==='play')` removed from the drop handler, so a drag
 * always PLAYS:  14/3, all three reds in leg 1, with the dump reading `pile:1` and energy 6 -> 7 (banked,
 * not spent) on a board still in MAIN.
 * **LEG 2 STAYS GREEN THROUGH THAT MUTATION**, which is the whole argument for the pair: a suite that only
 * checked "a drag plays in the Fight Sub-Phase" would not notice the branch had gone. Four clean runs.
 *
 * Run: node dragtest.js */
const { chromium }=require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
const { clickFight } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* The same gesture `nettest_drag` uses — mouse down on the card, a small move to arm `drag.moved`, then
   into `#table` so the drop zone reads `ok`. Anything less and the release is treated as a click. */
/* ⚠ THE REFUSALS ARE LIVE, NOT POST-HOC — read `#dropHint` BEFORE releasing. `highlightTarget` asks the
   question the release will ask (step 20 made that two questions: PLAY in the Fight sub-phase, ACTIVATE
   in Main), sets `drag.playZone` from the answer, and writes the reason into the drop hint while the card
   is still in the air. A refused release therefore does nothing AND says nothing afterwards, which is
   correct and is not what the first cut of this suite asserted: it waited for a `#message` that by design
   never comes, and read the resulting silence as a broken feature.
   THIS ALSO MAKES `setMessage('One card at a time…')` IN THE DROP HANDLER UNREACHABLE — a multi-card
   group in Main can never reach `playZone==='ok'`, so that line cannot fire. Harmless (the live hint says
   the same thing, sooner and better) but dead, and worth knowing before anyone "fixes" a refusal that is
   already working. */
async function dragToTable(page, id){
  const g = await page.evaluate((cid)=>{
    const el=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!el) return null;
    const r=el.getBoundingClientRect(), t=document.getElementById('table').getBoundingClientRect();
    return { cx:r.left+r.width/2, cy:r.top+r.height/2, tx:t.left+t.width/2, ty:t.top+t.height/2 };
  }, id);
  if(!g) return null;
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx, g.cy-24, {steps:4});
  await page.mouse.move(g.tx, g.ty, {steps:14});
  await wait(80);
  const zone = await page.evaluate(()=>{
    const dh=document.getElementById('dropHint'), tb=document.getElementById('table');
    const r=dh?dh.getBoundingClientRect():null, t=tb.getBoundingClientRect(), de=document.documentElement;
    return {
      hint:((dh||{}).textContent||'').trim(),
      ok:tb.classList.contains('pz-ok'),
      no:tb.classList.contains('pz-no'),
      /* GEOMETRY, captured for every leg even though only leg 5 asserts it — the pill's overflow was
         invisible to a text assertion, which is why it shipped. */
      spill: r ? Math.round(Math.max(0, t.left - r.left) + Math.max(0, r.right - t.right)) : 0,
      overflow: de.scrollWidth - de.clientWidth };
  });
  await page.mouse.up();
  return zone;
}

/* Drag card A onto card B — the merge gesture, as opposed to dragging into `#table`. */
async function dragOnto(page, idA, idB){
  const g = await page.evaluate((a)=>{
    const x=document.querySelector('#hand .card[data-id="'+a.idA+'"]'), y=document.querySelector('#hand .card[data-id="'+a.idB+'"]');
    if(!x||!y) return null;
    const r=x.getBoundingClientRect(), t=y.getBoundingClientRect();
    return { cx:r.left+r.width/2, cy:r.top+r.height/2, tx:t.left+t.width/2, ty:t.top+t.height/2 };
  }, {idA:idA, idB:idB});
  if(!g) return false;
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx, g.cy-24, {steps:4});
  await page.mouse.move(g.tx, g.ty, {steps:14});
  await wait(60);
  await page.mouse.up();
  return true;
}

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:900}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);

  const snap=()=>p.evaluate(()=>{ const st=window.__solo.st(); return {
    hand:st.players[0].hand.length, energy:st.players[0].energy.length,
    pile:st.pile?st.pile.combo.cards.length:0, sub:st.subPhase||'main', turn:st.turn,
    msg:((document.getElementById('message')||{}).textContent||'').trim() }; });

  /* ♦1 Pray for Guidance-style draw is not what we want — the cleanest subject is a card whose activation
     is UNMISTAKABLE on the state: energy goes down and the card leaves hand WITHOUT reaching the pile.
     ♣3 Brilliant Tactic (`valueBoost`, cost 3) is untargeted, always legal on your own turn in Main, and
     banks `nextPlayBoost`, which is a field no PLAY would ever set. */
  /* `mk` BUILDS THE COMPOSITE ID the DOM uses (`tag+rank+suit`), the way the netplay suites' `D()` does.
     Taking the id literally is what the first cut did, so every `[data-id="act3C"]` selector missed and
     four legs reported the product broken when the staging had simply named the cards something else. */
  const stage=()=>p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,t)=>({rank:r,suit:s,id:t+r+s});
    const you=st.players[0];
    you.hand=[mk(3,'C','act'), mk(6,'H','plain1'), mk(6,'D','plain2'), mk(2,'C','dead')];   // ♣2: the apex has NO activated effect by design, and ♣ keeps affordability out of it
    you.energy=[3,4,5,6,7,8].map(n=>mk(n,'C','e'+n));
    you.nextPlayBoost=0;
    st.round=3; st.turn=0; st.subPhase=null; st.pile=null; st.lastPlayer=null; st.passes=0;
    var m=document.getElementById('message'); if(m) m.textContent='';   // a stale line must not satisfy a refusal assertion
    window.__solo.render(); });

  /* ⚠ STAGING DOES NOT CLEAR `busy`, AND `busy` SWALLOWS A DRAG IN SILENCE. `forceAll`-style staging
     rewrites state and re-renders, but the previous leg's rival animation is still running, so the drop
     handler never sees the gesture and the board simply does not move — which reads exactly like "the
     feature is broken". Measured: two legs failing with an empty `#message` and the hint reading
     *"Hold on — the board is still resolving."*, and the same two legs passing when reordered, which is
     the tell that it is contamination and not the product. This is CLAUDE.md's `busy` rule (a UI helper
     must retry, because a swallowed click is indistinguishable from a dead control) applied between legs
     rather than within one. */
  const settle=()=>until(async()=>await p.evaluate(()=>{
    const h=((document.getElementById('hint')||{}).textContent||'');
    return !/still resolving|is fighting/i.test(h) && window.__solo.st().turn===0;
  }), 60, 200);

  // ═══ LEG 1 — IN MAIN, A DRAG ACTIVATES ═══
  await stage(); await wait(350); await settle();
  const before1 = await snap();
  ok(before1.sub!=='play' && before1.hand===4 && before1.pile===0,
     'staged in the MAIN sub-phase, 4 cards, empty pile  ['+JSON.stringify(before1)+']');
  const z1 = await dragToTable(p,'act3C');
  ok(z1 && z1.ok && /release to use/i.test(z1.hint), 'the zone offered USE while the card was in the air  ['+(z1?z1.hint:'no drag')+']');
  const activated = await until(async()=>{ const s=await p.evaluate(()=>window.__solo.st().players[0].nextPlayBoost||0); return s>0; }, 40);
  const after1 = await snap();
  ok(activated, 'IN MAIN, A DRAG ACTIVATES — the boost is banked' +
     (activated ? '' : '  ← nothing was activated; '+JSON.stringify(after1)));
  /* THE OTHER HALF OF "ACTIVATED", and the one that separates it from a PLAY: the card must not be on the
     table. A build that played it would also empty the hand slot. */
  ok(after1.pile===0, '  …and the card did NOT reach the pile — an activation is not a play');
  ok(after1.energy < before1.energy, '  …and it cost energy  ['+before1.energy+' → '+after1.energy+']');

  // ═══ LEG 2 — THE SAME CARD, THE SAME DRAG, IN THE FIGHT SUB-PHASE: IT PLAYS ═══
  /* IDENTICAL STAGING, ONE VARIABLE. Without this leg, leg 1 passes on a build that has lost the branch
     and activates in BOTH sub-phases — the outcome would look right and the feature would be gone. */
  await stage(); await wait(350); await settle();
  await clickFight(p);                                    // empty selection → the doorway, Main → Fight
  ok(await until(async()=>(await snap()).sub==='play', 40), 'stepped into the FIGHT sub-phase with the same hand');
  const before2 = await snap();
  const z2 = await dragToTable(p,'act3C');
  ok(z2 && z2.ok && /release to fight/i.test(z2.hint), '  …and there the zone offers FIGHT, not USE  ['+(z2?z2.hint:'no drag')+']');
  const played = await until(async()=>(await snap()).pile>0, 40);
  const after2 = await snap();
  ok(played, 'IN THE FIGHT SUB-PHASE, THE SAME DRAG PLAYS — the card is on the table' +
     (played ? '' : '  ← '+JSON.stringify(after2)));
  ok(await p.evaluate(()=>(window.__solo.st().players[0].nextPlayBoost||0))===0,
     '  …and it did NOT activate — no boost was banked, so the branch really is the sub-phase');
  /* ⚠ A PLAY **BANKS** ENERGY — it does not leave it alone, and it certainly does not spend it. *"Every
     card you play banks into your ⚡ energy — win or lose."* The first cut asserted `===` here, encoding a
     rule the game does not have, and went red against a correct build. That is the shape CLAUDE.md warns
     about from the other side: a suite can pin a defect, and it can equally pin a belief. The banked card
     is also a SHARPER separator than "no energy spent" — activate goes DOWN, play goes UP. */
  ok(after2.energy > before2.energy, '  …and the played card BANKED into energy, the opposite of a cast  ['+before2.energy+' → '+after2.energy+']');

  // ═══ LEG 3 — A CARD WITH NOTHING TO ACTIVATE IS REFUSED, OUT LOUD ═══
  await stage(); await wait(350); await settle();
  /* ⚠ NOT VACUOUS, AND THE FIRST SUBJECT WAS THE WRONG ONE. The refusal has to be *"nothing to
     activate"*, never *"you cannot afford it"* — from the outside those read identically, and a ♠4 against
     ♣ energy produces the second while looking like the first (measured: `impl:true, afford:false`).
     The apex 2 is the clean subject: `effectOf` returns null for rank 2 BY DESIGN, and ♣2 shares the suit
     of the staged energy so affordability cannot be the reason. */
  const dead = await p.evaluate(()=>{ const st=window.__solo.st();
    const c=st.players[0].hand.filter(function(x){ return x.id==='dead2C'; })[0];
    const e=c?window.CardmenEngine.effectOf(c):null;
    return { has:!!c, noEffect:!e||!e.impl }; });
  ok(dead.has && dead.noEffect, 'staged the apex 2 — a card with no activated effect at all  ['+JSON.stringify(dead)+']');
  const b4 = await snap();
  ok(b4.msg==='', '  …on a board with no stale message, so the refusal below cannot be someone else\'s line');
  const z4 = await dragToTable(p,'dead2C');
  await wait(300);
  const a4 = await snap();
  /* ⚠ THE COPY IS WRONG FOR THIS GESTURE AND THE ASSERTION DELIBERATELY ACCEPTS IT. The hint reads
     *"Select a card, then activate its effect."* — `ctxActionFor`'s fallback, written for the BUTTON, where
     nothing is selected yet. Dragged, the player has selected a card; being told to select one is the
     apex 2's reader problem in a new place, on the game's most important card. Filed as
     `[id: apex-drag-hint-says-select]`; the regex accepts either wording so the fix does not red this. */
  ok(z4 && z4.no && !z4.ok && /nothing to activate|activate its effect/i.test(z4.hint),
     'A CARD WITH NOTHING TO ACTIVATE IS REFUSED WHILE IT IS STILL IN THE AIR  ["'+(z4?z4.hint:'no drag')+'"]');
  ok(a4.pile===0 && a4.hand===b4.hand && a4.energy===b4.energy,
     '  …and releasing it does nothing at all — no play, no activation, no energy');

  // ═══ LEG 4 — A MULTI-CARD GROUP IN MAIN IS REFUSED, OUT LOUD ═══
  /* A drag has no tooltip, so a silent refusal is indistinguishable from a broken control — the v1.31.74
     lesson about an enabled-but-inert button, in the one gesture that cannot explain itself. */
  await stage(); await wait(350); await settle();
  /* CLICKING TWO CARDS SELECTS THEM; IT DOES NOT GROUP THEM. A group is formed by dragging one card ONTO
     another (`canMergeKF` + `mergeGroups`), which is the gesture a player uses — so the staging for this
     leg is itself a second drag path, and getting it wrong reported "staging problem" rather than a
     product one. Two 6s merge because they are the same rank. */
  await dragOnto(p,'plain16H','plain26D');
  await wait(300);
  const merged = await p.evaluate(()=>{
    var gs=[].slice.call(document.querySelectorAll('#hand .group'));
    for(var i=0;i<gs.length;i++) if(gs[i].querySelectorAll('.card').length>1) return gs[i].querySelector('.card').getAttribute('data-id');
    return null; });
  if(merged){
    const b3 = await snap();
    const z3 = await dragToTable(p, merged);
    await wait(300);
    const a3 = await snap();
    ok(z3 && z3.no && !z3.ok && /one card at a time/i.test(z3.hint),
       'A MULTI-CARD GROUP IN MAIN IS REFUSED WHILE IT IS STILL IN THE AIR  ["'+(z3?z3.hint:'no drag')+'"]');
    ok(a3.hand===b3.hand && a3.pile===0 && a3.energy===b3.energy,
       '  …and nothing happened — no play, no activation, no energy spent');
  } else {
    const groups = await p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .group')).map(g=>
      [].slice.call(g.querySelectorAll('.card')).map(c=>c.getAttribute('data-id')).join('+')));
    ok(false, 'could not form a multi-card group to drag — groups are ['+groups.join(' , ')+']');
    ok(false, '  (the refusal assertion could not run)');
  }

  /* ---------- LEG 5: A LONG REFUSAL MUST NOT COST YOU THE BOARD (2026-09-30).
     The live refusal is the feature — `highlightTarget` feeds `ctxActionFor(...).reason` into the pill so
     you learn WHY while the card is still in the air — and the pill was built for four fixed short
     strings: `white-space:nowrap`, no `max-width`. A full engine sentence therefore hung off both edges
     of the play area, and, because the pill is hidden by OPACITY rather than `display`, `clearZone()`
     stripping only the class left that text in the layout at full nowrap width FOR THE REST OF THE GAME.
     One drag over an unaffordable card widened the document permanently and every later frame was
     scrolled sideways, with no drag in progress and nothing on screen to explain it.
     ⚠ MEASURE, DO NOT LOOK — and that is the whole reason this went unnoticed: after the drag the element
     is INVISIBLE, so the only evidence it is still there is `scrollWidth` against `clientWidth`. A text
     assertion reads '' on the broken build too... no: it reads the stale text, which is exactly what the
     second assertion pins. The first pins the cap; they fail independently and are fixed independently. */
  /* ⚠ AND IT IS MEASURED AT A NARROW VIEWPORT, WHICH IS THE ONLY PLACE THE BUG EXISTS. The first cut ran
     this at the suite's own 1100px and **passed 22/0 with `white-space:nowrap` and the cap both put back**
     — at that width the sentence fits on one line and nothing overflows, so two geometry assertions were
     measuring nothing. That is the green-and-blind shape this repo keeps paying for: the reported
     screenshots were of a NARROW play area, and a viewport nobody measures is a viewport nobody fixes.
     760px stays above the 720px phone gate on purpose — the desktop layout is where it was reported, and
     it keeps this leg from silently becoming a phone-layout test. */
  const LONG = /Broadway card/i;                       // `pitchHigh` — the longest reason the engine gives
  await p.setViewportSize({width:760,height:900}); await wait(250);
  await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    const you=st.players[0];
    /* Ultima Attack (10♣) with NO 10/J/Q/K/A beside it, so the Broadway pitch has nothing to spend and
       `ctxActionFor` returns the long sentence rather than a short one. Energy is ample on purpose: the
       refusal under test must be the PITCH, not affordability, which has its own much shorter copy. */
    you.hand=[mk(10,'C','ulti'), mk(3,'D','lowA'), mk(4,'D','lowB')];
    you.energy=[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'C','pe'+n));
    st.subPhase='main'; st.turn=0; st.pile=null; st.round=4;
    window.__solo.render(); });
  await wait(250);
  const z5 = await dragToTable(p,'ulti');
  ok(!!z5 && LONG.test(z5.hint||''),
     'the long Broadway refusal really is what the pill shows  ["'+(z5?z5.hint:'no drag')+'"]');
  ok(!!z5 && z5.spill===0,
     '  …and it stays INSIDE the play area — '+(z5?z5.spill:'?')+'px hanging off the edges (cap + wrap)');
  await wait(200);
  /* ⚠ THE DOCUMENT-LEVEL SCROLLBAR IS NOT ASSERTED, AND THAT IS A MEASUREMENT RATHER THAN AN OVERSIGHT.
     The filed entry called it "the second half and the worse one" and said to verify with
     `scrollWidth` against `clientWidth`. Measured 2026-09-30 on a build with BOTH halves broken, at
     eleven widths (1100/900/820/760/730/700/600/500/430/390/360): the spill off the play area is real
     and grows as the viewport narrows — 19px at 820 up to 229px at 360 — and the document overflow is
     **0 everywhere, during the drag and after it**. So an assertion on it would be green on the broken
     build too, which is the vacuous shape this repo keeps catching. The MECHANISM is pinned instead
     (stale text left in a layout that is hidden by opacity), because that is what would produce the
     scrollbar wherever it does.
     The entry's screenshot is from 2026-09-11 and nineteen versions of layout work ago; a filed
     measurement ages exactly as fast as the thing it measured. Re-open it with a repro, not from the
     screenshot. And note the non-monotonic row: 700 and 600 spill ZERO because the phone layout gives
     `#table` most of the width and the sentence is ~490px wide — it is the TABLE's width that decides
     this, never the viewport's. */
  const after = await p.evaluate(()=>{ const de=document.documentElement;
    return { text:((document.getElementById('dropHint')||{}).textContent||''),
             overflow: de.scrollWidth - de.clientWidth }; });
  ok(after.text==='',
     'the hidden pill holds NO text after the drag — it is hidden by opacity, so stale text still occupies the layout  ["'+after.text.slice(0,52)+'"]');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
