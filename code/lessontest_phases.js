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
  const { p, ok, until, atStep, next, playSpot, st, errs } = L;
  const cls = ()=>p.evaluate(()=>((document.getElementById('handWrap')||{}).className||'').match(/sp[A-Z][a-z]+/g)||[]);
  const respond = (re)=>p.evaluate(rx=>{ const b=[].slice.call(document.querySelectorAll('.respQuick'))
      .filter(x=>new RegExp(rx,'i').test(x.textContent||''))[0]; if(!b) return false; b.click(); return true; }, re);
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
  ok(await respond('Counter Spell'), '…offering Counter Spell, which we spring');
  ok(await atStep(6), 'countering advanced the lesson to step 6');
  const s6 = await st();
  ok(s6.players[1].shuffle.some(c=>c.rank===5), 'the Technique really fizzled to the Rival\'s shuffle pile');
  ok(s6.round>=2, '…and the round resolved in your favour, so round 2 has begun  [round '+s6.round+']');

  const trace = async(tag)=>{ const x=await st();
    console.log('   · '+tag+': round '+x.round+' turn '+x.turn+' init '+x.initiative+' sub '+x.subPhase+' pile '+(x.pile?'set':'empty')); };
  await trace('at step 6');
  console.log('   LOG: ' + (await p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim())
    .filter(t=>/won|round|pass|played|Countered/i.test(t)).slice(-6).join('  ||  '))));
  await next(); ok(await atStep(7), 'step 7 names the orange and yellow phases that went by');
  await trace('at step 7');
  await next(); ok(await atStep(8), 'step 8 asks for the pair');
  await trace('at step 8');
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
  ok(await atStep(9), 'leading it advanced the lesson to step 9');

  /* LEYLINE — the SECOND window, answered by a DIFFERENT Quick. Shields before and after is the claim. */
  const shBefore = (await st()).players[0].shields;
  const got2 = await until(()=>!!document.querySelector('.respQuick'), 'the Resolution window opens', 20000);
  ok(got2, 'their pair beat yours, and Resolution opened a window');
  ok(await respond('Leyline'), '…offering Leyline Ascension');
  ok(await atStep(10), 'springing it advanced the lesson to step 10');
  ok((await st()).players[0].shields===shBefore,
     'LEYLINE SAVED THE SHIELD — '+shBefore+' before, '+(await st()).players[0].shields+' after');
  await note();

  ok(await p.evaluate(()=>!!document.querySelector('#promptMode')), 'the 🔔 notifications button exists to be pointed at');
  ok(seen.has('spMain') && seen.has('spFight'),
     'the hand painted more than one phase across the lesson  ['+[...seen].sort().join(',')+']');

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
