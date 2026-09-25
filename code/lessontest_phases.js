/* THE "PHASES" LESSON (Basics #3) — and the Quicks lesson it absorbed.
 *
 * Aj, 2026-09-25: *"add a new tutorial about phases to the basics maybe after zones of play. we'll make sure
 * to explain the notifications button"*, then *"that means we'll have to move quicks to basics and maybe even
 * integrate it"*. A Quick is only meaningful as a thing you cast INTO a window, and the windows are the
 * phases — so the two are one lesson, and this file replaces `lessontest_quicks.js`.
 *
 * WHAT IT ASSERTS, and none of it is "the panel rendered": the hand's colour really CHANGES with the
 * sub-phase (the whole feature the lesson points at), pressing Fight really plays NOTHING, the counter
 * really fizzles their Technique, and Leyline really SAVES the shield. Each is the lesson's own claim.
 *
 * TWO BUGS THIS FOUND WHILE BEING WRITTEN, both worth keeping in mind for the next scripted lesson:
 *   · A step gated on `roundwin` HANGS, because countering resolves the whole round before that step is
 *     ever shown. Anything that happens as a CONSEQUENCE of the previous gate must be narrated, not gated.
 *   · `hi` is what carries `.tut-spot`; `only` merely GATES. A step with `hi:'#hand'` highlights no card, so
 *     "lead your pair" pointed at nothing and `playSpot` had nothing to play.
 *
 * Run: node lessontest_phases.js */
const { openLesson } = require('./lessonlib');
const { clickFight } = require('./fightclick');

(async()=>{
  const L = await openLesson('phases');
  const { p, ok, until, atStep, next, playSpot, passTurn, st, errs } = L;
  const cls = ()=>p.evaluate(()=>((document.getElementById('handWrap')||{}).className||'').match(/sp[A-Z][a-z]+/g)||[]);
  /* ⚠ VISIBLE, NOT MERELY PRESENT. `hideOverlay()` leaves `#modal`'s markup in the DOM, so a plain
     `querySelectorAll('.respQuick')` keeps matching the PREVIOUS window's buttons. Not a harmless miss: it
     returned true, the suite reported the card "offered", and the Leyline claim below then passed against a
     shield that was never at risk — a green assertion observing nothing. */
  const respond = (re)=>p.evaluate(rx=>{ const b=[].slice.call(document.querySelectorAll('.respQuick'))
      .filter(x=>x.offsetParent && new RegExp(rx,'i').test(x.textContent||''))[0]; if(!b) return false; b.click(); return true; }, re);
  /* ONE DEFINITION FOR ALL THREE WINDOWS — the go-round, Resolution and Clean-up.
     ⚠ VISIBILITY, NEVER PRESENCE: `hideOverlay()` leaves `#modal`'s markup in the DOM, so
     `getElementById('respDecline')` keeps finding the PREVIOUS window's button, which is often correctly
     `disabled`. Polling on presence read the dead modal and reported a healthy window as broken. */
  const declineWindow = async(ms=20000)=>{
    const up = await until(()=>{ const b=document.getElementById('respDecline'); return !!(b && b.offsetParent); },
                           'a window to decline', ms);
    if(!up) return false;
    return await p.evaluate(()=>{ const b=document.getElementById('respDecline');
      if(!b || !b.offsetParent || b.disabled) return false; b.click(); return true; });
  };
  const seen = new Set();
  const note = async()=>{ (await cls()).forEach(c=>seen.add(c)); };

  ok(await atStep(1), 'the lesson opens');
  await note();
  ok((await cls())[0]==='spMain', 'step 1 — the hand is painted for the MAIN sub-phase  ['+(await cls()).join(',')+']');

  await next(); ok(await atStep(2), 'step 2 names the blue Main sub-phase');
  await next(); ok(await atStep(3), 'step 3 asks you to press Fight');

  /* THE DOORWAY — the lesson's headline claim, and the one players most misread. Count the hand BEFORE and
     AFTER: the whole point is that Fight moves you a sub-phase and plays NOTHING. */
  const handBefore = (await st()).players[0].hand.length;
  const pileBefore = !!(await st()).pile;
  await clickFight(p);
  ok(await atStep(4), 'pressing Fight advanced the lesson to step 4');
  const s4 = await st();
  ok(s4.players[0].hand.length===handBefore && !s4.pile && !pileBefore,
     'FIGHT PLAYED NOTHING — hand '+handBefore+'→'+s4.players[0].hand.length+', pile still empty. That is the doorway claim');
  ok(s4.subPhase==='play', '…and it really moved you into the Fight sub-phase');
  await note();
  ok(seen.has('spFight'), 'AND THE HAND CHANGED COLOUR with it — the thing the lesson points at  ['+[...seen].join(',')+']');

  const why4 = await playSpot(12000);
  ok(why4===null, 'you led the Ace the step spotlit'+(why4?' — '+why4:''));
  ok(await atStep(5), 'leading it advanced the lesson to step 5');

  /* THE COUNTER — ported from `lessontest_quicks`. The Rival casts Infuse with Magic to push its King past
     your Ace; countering is what makes the next step's claim ("they cannot beat it") literally true. */
  const got = await until(()=>!!document.querySelector('.respQuick'), 'the Respond? window opens', 20000);
  ok(got, 'the Rival cast a Technique and the Respond? window opened');
  /* SAMPLE THE RESTING STRIP WHERE IT IS UNAMBIGUOUS — the Rival holds the turn here, and no boundary is
     open, so this is the one moment in the lesson that MUST be idle. It used to be caught incidentally
     somewhere else, and the deal-hold fix moved that moment under a phase tint; an incidental sample is a
     coin flip dressed as an assertion. */
  await note();
  ok(await respond('Counter Spell'), '…offering Counter Spell, which we spring');
  ok(await atStep(6), 'countering advanced the lesson to step 6');

  /* THE GO-ROUND COMES BACK — step 6, and the reason this lesson could not finish before it existed.
     Countering does not close the window: priority passes round again on the fizzled Technique, a SECOND
     modal opens, and it covers `#tutNextBtn` — so the narration behind it can never be clicked through and
     every assertion after it fails. Measured `respondFor:0 pending:5D#rI`, stable for 12s.
     Assert the modal is REALLY there before declining, or a build that stopped opening it passes by
     skipping straight on. */
  ok(await declineWindow(), 'THE WINDOW CAME BACK — priority goes round again after your Quick resolves');
  ok(await atStep(7), 'declining advanced the lesson to step 7');
  const s6 = await st();
  ok(s6.players[1].shuffle.some(c=>c.rank===5), 'the Technique really fizzled to the Rival\'s shuffle pile');

  const trace = async(tag)=>{ const x=await st();
    console.log('   · '+tag+': round '+x.round+' turn '+x.turn+' init '+x.initiative+' sub '+x.subPhase+' pile '+(x.pile?'set':'empty')); };
  await trace('at step 7');
  console.log('   LOG: ' + (await p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim())
    .filter(t=>/won|round|pass|played|Countered/i.test(t)).slice(-6).join('  ||  '))));
  /* THE TWO PHASE PAUSES — the whole point of naming `resolution` and `cleanup` in the lesson's `windows`.
     Each is a REAL priority window the engine opens at that boundary, and each is declined, so the lesson's
     claim ("a window opens at every boundary, and passing is a legitimate answer") is exercised rather than
     asserted. They sit in ROUND 1 deliberately: a window needs a castable Quick, and the 9♦ is still in
     hand here — by round 2 it is spent and neither boundary would stop for anything.
     AND THE ROUND CANNOT TURN OVER UNTIL BOTH ARE ANSWERED, which is why the "round 2 has begun" poll now
     lives below them rather than beside the counter. */
  /* THE TWO PHASE PAUSES — the point of naming `resolution` and `cleanup` in the lesson's `windows`.
     WAIT FOR EACH BOUNDARY, DO NOT SAMPLE IT: the Rival is still finishing its turn when the step opens, so
     both flags are null for a moment. An earlier cut tested immediately, declined nothing, and concluded
     round 1 had no Resolution window — it has one.
     AND DECLINE UNTIL THE PHASE ENDS, because each boundary's go-round comes back; "declined once" and
     "finished" are different events, which is exactly what the steps' own gates say. */
  const drainPhase = async(flag, label)=>{
    const began = await until(f=>!!window.__solo.st()[f], label+' to begin', 25000, flag);
    if(!began) return { began:false, cleared:0, cls:[] };
    await note(); const c = await cls();
    let cleared = 0;
    for(let i=0;i<6 && await p.evaluate(f=>!!window.__solo.st()[f], flag); i++) if(await declineWindow(20000)) cleared++;
    return { began:true, cleared, cls:c };
  };

  await next(); ok(await atStep(8), 'step 8 is the ORANGE pause — Resolution');
  const res = await drainPhase('resolution', 'Resolution');
  ok(res.began, 'RESOLUTION REALLY IS A BOUNDARY — the engine opens the phase and holds there');
  ok(res.cls.indexOf('spResolve')>=0, 'AND THE HAND IS ORANGE WHILE IT WAITS  ['+res.cls.join(',')+']');
  ok(res.cleared>=1, '…and it stopped for you — '+res.cleared+' window(s) declined before the phase ended');
  ok(await atStep(9), 'finishing Resolution advanced the lesson to step 9 — the yellow pause');

  const cln = await drainPhase('cleanup', 'Clean-up');
  ok(cln.began, 'CLEAN-UP REALLY IS A BOUNDARY TOO');
  ok(cln.cls.indexOf('spCleanup')>=0, 'AND THE HAND IS YELLOW WHILE IT WAITS  ['+cln.cls.join(',')+']');
  ok(cln.cleared>=1, '…and it stopped for you — '+cln.cleared+' window(s) declined before the phase ended');
  ok(await atStep(10), 'finishing Clean-up advanced the lesson to step 10 — the pair');
  ok(await until(()=>window.__solo.st().round>=2, 'the round resolves in your favour', 20000),
     '…and only THEN does round 2 begin  [round '+((await st()).round)+']');
  await note();          // the round-2 deal: the Beginning tint, now held for the whole fly-in
  await trace('at step 10');
  await note();

  /* ROUND 2 — the same structure with nothing to activate, which is the step's whole teaching point. */
  /* WAIT, DO NOT SNAPSHOT. A tour step HOLDS the board (`TUT.blocking()`), so round 2's turn assignment can
     still be in flight when the step opens — reading `turn` immediately catches the previous round's value. */
  await until(()=>window.__solo.st().turn===0, 'round 2 reaches your turn', 15000);
  const r2 = await st();
  ok(r2.turn===0, 'ROUND 2 IS YOURS TO LEAD — you won round 1, so initiative is yours' +
     '  [turn '+r2.turn+', initiative '+r2.initiative+', round '+r2.round+', pile '+(r2.pile?'set':'empty')+']');
  await clickFight(p);
  const why8 = await playSpot(15000);
  ok(why8===null, 'you led the pair the step spotlit'+(why8?' — '+why8:''));
  ok(await atStep(11), 'leading it advanced the lesson to step 11 — the pass');

  /* PASS FIRST — the Rival beating your pair does NOT end the round, and until it ends there is no
     Resolution and nothing for Leyline to answer. Measured on the build before this step existed: Leyline
     still in hand, the log stopping at "Rival 2 played a Special - Pair (8♦, 8♦)", and the shield
     assertion passing because no shield had ever been at risk. */
  ok(await passTurn(20000), 'you passed, which is what ENDS the round');
  ok(await atStep(12), 'passing advanced the lesson to step 12 — the Resolution window');

  /* LEYLINE — the SECOND window, answered by a DIFFERENT Quick. Shields before and after is the claim, and
     it means something only because the pass above put a shield at risk. */
  const shBefore = (await st()).players[0].shields;
  const got2 = await until(()=>!!document.querySelector('.respQuick'), 'the Resolution window opens', 20000);
  ok(got2, 'their pair beat yours, and Resolution opened a window');
  ok(await respond('Leyline'), '…offering Leyline Ascension');
  /* A RED RUN MUST EXPLAIN ITSELF — this is the one assertion in the file with somewhere to hide, because
     "the lesson did not advance" is equally true of a gate that never fired, a modal still covering the
     panel, and a step that advanced somewhere unexpected. Print all three. */
  const stepped = await atStep(13);
  if(!stepped) console.log('   WHY: ' + JSON.stringify(await p.evaluate(()=>{
      const s=window.__solo.st(), b=document.getElementById('respDecline');
      return { panel:((document.querySelector('.tutStep')||{}).textContent||'').trim(),
               wait:((document.querySelector('.tutWait')||{}).textContent||'').trim().slice(0,40),
               modalUp: !!(b && b.offsetParent), quicks:document.querySelectorAll('.respQuick').length,
               nextBtn: !!document.getElementById('tutNextBtn'),
               round:s.round, turn:s.turn, sub:s.subPhase, rf:s.respondFor, pend:!!s.pending,
               resolution:!!s.resolution, cleanup:!!s.cleanup, upkeep:!!s.upkeep,
               shields:s.players[0].shields, hand:s.players[0].hand.map(function(c){return c.id;}),
               log:[].map.call(document.querySelectorAll('#log .le'),function(e){return e.textContent.trim();}).slice(-7) }; })));
  ok(stepped, 'springing it advanced the lesson to step 13');
  /* ⚠ AND PROVE THE SHIELD COULD HAVE BEEN LOST. "Shields unchanged" is equally true of a board where
     nothing was ever at risk — which is exactly how this assertion passed for three runs while Leyline sat
     unplayed in hand and the round had not even resolved. The losing fight is the other half of the claim. */
  /* THE GAME'S OWN SENTENCE CARRIES BOTH HALVES — *"Rival 2 won with a Pair - but the loss was prevented."*
     The win establishes a shield really was on the line; "prevented" establishes Leyline is what stopped it.
     Asserting the shield COUNT alone is what let this pass for three runs with Leyline unplayed in hand and
     the round not even resolved, so the count below is kept as the outcome and this is kept as the stake. */
  const tail = await p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()).slice(-8));
  ok(tail.some(t=>/Rival 2 won/i.test(t) && /prevented/i.test(t)),
     '…on a round you actually LOST, and the log says the loss was PREVENTED  [' + (tail.filter(t=>/prevented/i.test(t))[0]||'no such line') + ']');
  ok((await st()).players[0].shields===shBefore,
     'LEYLINE SAVED THE SHIELD — '+shBefore+' before, '+(await st()).players[0].shields+' after');
  await note();

  ok(await p.evaluate(()=>!!document.querySelector('#promptMode')), 'the 🔔 notifications button exists to be pointed at');
  /* FIVE OF THE SIX STRIP STATES, OBSERVED RATHER THAN ASSUMED — the lesson's headline claim is that the
     strip changes with the phase, and this is the only assertion that can check it. `spIdle` counts: it is
     the RESTING board (no tint, the violet of `--bg` showing through), so seeing it proves the strip goes
     quiet on the Rival's turn rather than holding the last phase's colour.
     ONLY `spBegin` IS ABSENT, and that is a property of the lesson rather than a gap: the Beginning Phase
     deals the new round in with nothing to answer, so no step ever holds still inside it.
     ⚠ ASSERT THE CLASS, NEVER THE COLOUR. The hues are a preference Aj intends to make player-settable,
     so a test reading `background` would break the day anyone retunes a swatch — the same reason the step
     text stopped naming them. */
  ok(['spIdle','spMain','spFight','spResolve','spCleanup'].every(c=>seen.has(c)),
     'the strip painted FIVE distinct states across the lesson  ['+[...seen].sort().join(',')+']');

  /* CARD ACCOUNTING, ported from `lessontest_quicks`: the rig fabricates an exact hand, and a swap that
     dropped or duplicated a card would still play — so count them. */
  const acc = await p.evaluate(()=>{ const s=window.__solo.st(), me=s.players[0];
    const all=[].concat(me.hand,me.deck,me.energy,me.shuffle,me.removed||[],me.shieldPile||[]);
    const ids={}; let dup=0; all.forEach(c=>{ if(ids[c.id]) dup++; ids[c.id]=1; });
    return { dup, shields:(me.shieldPile||[]).length, declared:me.shields }; });
  ok(acc.dup===0, 'no card of yours is duplicated across your zones  ['+acc.dup+' dupes]');

  await next();
  await L.finish('phases');
  await L.done();
})().catch(e=>{ console.error('HARNESS ERROR', e.message); process.exit(2); });
