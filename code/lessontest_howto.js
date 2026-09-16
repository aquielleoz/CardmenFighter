/* The "How to Play" tutorial lesson (Basics #1) — the full guided duel, and the longest lesson at ten steps.
 * THREE of them are gated: on leading a jab, on playing a Special, and on activating an effect. It is the first
 * thing a new player touches, and until now nothing tested it: a rig or gate regression leaves them stuck on
 * step 3 of the game's front door with no error and no way out. Run: node lessontest_howto.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('howto');
  const { p, ok, until, step, at, next, playAny, activateSpot } = L;

  ok((await at()||{}).n===10,'10 steps');
  await next(); ok(await L.atStep(2),'step 2 (the value ladder) is reachable');
  await next(); ok(await L.atStep(3),'step 3 is the gated jab step');
  ok(!(await step()).hasNext,'…gated on a real play, no Next');

  /* THE STEP NAMES THE BUTTON THAT IS ACTUALLY ON SCREEN (2026-09-16). Epic step 20 made Fight two-state —
     the first press only crosses Main → Fight and plays nothing, and the button relabels `Next` → `Fight`
     to say which press you are on — but every lesson still read "press Fight" at a moment the button reads
     **Next**. Telling a beginner to press a button that is not there is the dead-end shape this file exists
     to catch, and no suite could see it because `playAny`/`__pressFight` drive both presses by design.
     ASSERT THE DERIVATION, NOT THE SENTENCE: read the label off the live button and require the step text
     to name it. A hardcoded "the text says Next" would pass on a build where the button went back to
     one-state and the lesson became wrong again. */
  const jab = { label: await p.evaluate(()=>document.getElementById('fightBtn').textContent.trim()),
                text : (await step()).text };
  ok(jab.text.indexOf(jab.label)>=0,
     `the jab step names the button the player can actually see ("${jab.label}")` +
     (jab.text.indexOf(jab.label)>=0 ? '' : `  ← the step says press something else; text: "${jab.text.slice(0,90)}"`));
  ok(/Fight/.test(jab.text),
     '…and it names the SECOND press too, so the player is not left on the transition');

  ok(await playAny(false)!==null,'a legal jab was available and played');
  ok(await L.atStep(4),'leading a jab advanced to step 4');
  await next(); ok(await L.atStep(5),'step 5 is the gated Special step');
  ok(!(await step()).hasNext,'…gated on a real Special, no Next');

  /* Step 5's prep is `tutEnsurePair`. Assert the PAIR, not the helper — if it delivers nothing, the player is
   * told to "select two cards of the same number" while holding none. */
  ok(await until(()=>{ const h=window.__solo.st().players[0].hand, by={};
      h.forEach(c=>by[c.rank]=(by[c.rank]||0)+1); return Object.keys(by).some(k=>by[k]>=2); },'a pair reaches your hand'),
    'tutEnsurePair delivered a pair to your hand');
  ok(await until(()=>{ const s=window.__solo.st(); return s.round>=2 && s.turn===0; },'round 2, your turn'),
    'round 2 arrives with the turn back on you — Specials are unlocked');
  const spec=await L.playPair();
  ok(spec===null,'the pair was playable as a Special'+(spec?' — '+spec:''));
  ok(await L.atStep(6),'playing the Special advanced to step 6');
  /* Step 6 says winning it "made the" Rival lose a shield — a claim the gate does not check. */
  ok(await until(()=>window.__solo.st().players[1].shields<2,'the Rival loses a shield'),
    '…and the Rival really did lose a shield, as step 6 claims');

  await next(); ok(await L.atStep(7),'step 7 is reachable');
  await next(); ok(await L.atStep(8),'step 8 is the gated activate step');
  const spotlit=await until(()=>!!document.querySelector('#hand .card.tut-spot'),'a CARD is spotlit');
  ok(spotlit,'a card is spotlit to activate — tutPickEffect found one');
  const why=await activateSpot();
  ok(why===null,'the ⚡ Activate control was offered and fired'+(why?' — '+why:''));
  ok(await L.atStep(9),'activating advanced to step 9');

  await next(); ok(await L.atStep(10),'step 10 (the loop recap) is reachable');
  await next();
  await L.finish('howto');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
