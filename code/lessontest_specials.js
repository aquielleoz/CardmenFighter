/* The "Specials" tutorial lesson (Basics #4). Its middle two steps are GATED — one on playing a jab, one on
 * playing a Special — so a rig that fails to deliver a pair leaves the player stuck with no error, the same
 * silent dead end the Quicks lesson had (v1.31.73). The load-bearing assertion here is that `tutEnsurePair`
 * really put a pair in hand: the audit of 2026-08-31 concluded the `specials` rig was safe BECAUSE that helper
 * repairs a miss, and this is what turns that conclusion into a test. Run: node lessontest_specials.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('specials');
  const { p, ok, until, step, at, next, st, playAny } = L;

  ok((await at()||{}).n===6,'6 steps');
  await next();                                                   // "Show me" → the gated jab step
  ok((await at()||{}).i===2,'step 2 is the jab step');
  ok((await step()).spots>0,'…and it spotlights the hand and Fight');
  ok(!(await step()).hasNext,'…with no Next — it is gated on a real play');

  const jab=await playAny(false);
  ok(jab!==null,'a legal jab was available and played');
  ok(await L.atStep(3),'playing a jab advanced the lesson to step 3');

  /* THE RIG-REPAIR ASSERTION. Step 3's prep is `tutEnsurePair`, which searches hand+deck and pulls a matching
   * pair into hand. If it ever returns nothing the step cannot be satisfied — the player is told to "select two
   * matching cards" while holding none. Asserted as the PAIR EXISTING, not as the helper having been called. */
  ok(await until(()=>{ const h=window.__solo.st().players[0].hand, by={};
      h.forEach(c=>by[c.rank]=(by[c.rank]||0)+1); return Object.keys(by).some(k=>by[k]>=2); },'a pair reaches your hand'),
    'tutEnsurePair delivered a pair to your hand');
  ok(await until(()=>{ const s=window.__solo.st(); return s.round>=2 && s.turn===0; },'round 2, your turn'),
    'round 2 arrives with the turn back on you — Specials are unlocked');
  const spec=await L.playPair();
  ok(spec===null,'the pair was playable as a Special'+(spec?' — '+spec:''));
  ok(await L.atStep(4),'playing the Special advanced the lesson to step 4');
  ok(/Shield broken/.test((await step()).text),'step 4 is the "Shield broken!" payoff');
  /* The step CLAIMS a shield broke. The gate only requires that you PLAYED a Special, so this is a real and
   * separate question — `tutRig` is the win-oriented rig, and if that ever stops holding the lesson lies. */
  ok(await until(()=>window.__solo.st().players[1].shields < 2,'the Rival loses a shield'),
    '…and the Rival really did lose a shield, as the step claims');

  await next(); ok(await L.atStep(5),'step 5 (Sort and Hints) is reachable');
  await next(); ok(await L.atStep(6),'step 6 (the cheat sheet) is reachable');
  await next();
  await L.finish('specials');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
