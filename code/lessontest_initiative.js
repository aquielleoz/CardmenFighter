/* The "Initiative" tutorial lesson (Basics #3). It is the ONE lesson with its own rig whose promise is a
 * NEGATIVE: `tutRigInitiative` makes the Rival lead round 1 with cards you cannot beat, so that passing is the
 * honest play — the step literally says "your cards are all low, so you can't beat their lead". If the rig ever
 * deals you a beat, that sentence is false and the lesson teaches the wrong thing while still completing, since
 * its gate only asks for a pass. Asserting the negative is the point. Run: node lessontest_initiative.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('initiative');
  const { p, ok, until, step, at, next, passTurn } = L;
  ok((await at()||{}).n===5,'5 steps');

  ok(await until(()=>{ const s=window.__solo.st(); return !!s.pile && s.turn===0; },'the Rival leads and it is your turn'),
    'the rig really made the Rival lead — there is a pile and the turn is yours');
  /* THE RIG'S FACTUAL CLAIM. `legalFightPlays` is the engine's own answer to "can I beat this", so this is not a
   * restatement of the rig's code. */
  ok(await p.evaluate(()=>window.CardmenEngine.legalFightPlays(window.__solo.st(),0).length===0),
    "…and you genuinely cannot beat it, as step 2 claims (`legalFightPlays` is empty)");

  await next(); ok(await L.atStep(2),'step 2 (whose initiative) is reachable');
  await next(); ok(await L.atStep(3),'step 3 is the "pass to step aside" step');
  ok(!(await step()).hasNext,'…gated on a real pass, no Next');

  const before=await p.evaluate(()=>{ const me=window.__solo.st().players[0]; return {nrg:me.energy.length, deck:me.deck.length}; });
  /* THE INVARIANT v1.31.74 ESTABLISHES: AN ENABLED CONTROL MUST WORK. Before it, `updateActions` computed
   * `yourTurn` from `state.turn` alone, so Pass rendered ENABLED for the whole ~2s the Rival's beats were
   * playing while `doPass` refused on `busy` — silently. This suite is what found it: its click had to be
   * retried for 2014ms. So: wait for Pass to be enabled, click it exactly ONCE, and require the game to move.
   * Not vacuous in either direction — if Pass were never enabled the wait times out, and on the pre-fix build
   * the single click is swallowed. */
  ok(await until(()=>{ const b=document.getElementById('passBtn'); return !!b && !b.disabled; },'Pass becomes enabled'),
    'Pass eventually renders enabled');
  const shot=await p.evaluate(()=>{ const s=window.__solo.st(), me=s.players[0];
    const snap={round:s.round, turn:s.turn, nrg:me.energy.length};
    document.getElementById('passBtn').click(); return snap; });
  ok(await until(b=>{ const s=window.__solo.st();
      return s.round!==b.round || s.turn!==b.turn || s.players[0].energy.length!==b.nrg; },'the single click takes effect',8000,shot),
    'ONE click on an enabled Pass takes effect — there is no enabled-but-inert window');
  ok(await L.atStep(4),'passing advanced the lesson to step 4');
  /* Step 3's claim: you still bank energy. Step 4's claim: the catch-up moves cards OFF YOUR DECK into energy.
   * Both are assertions about the engine, and the gate checks neither. */
  ok(await until(b=>window.__solo.st().players[0].energy.length>b.nrg,'energy grows after passing',9000,before),
    '…and you still banked energy, as step 3 promises');
  const shrank=await until(b=>window.__solo.st().players[0].deck.length<b.deck,'the deck shrinks',9000,before);
  if(!shrank) console.log('   WHY: before deck='+before.deck+' nrg='+before.nrg+' | after '+JSON.stringify(
    await p.evaluate(()=>{ const s=window.__solo.st(), me=s.players[0];
      return {deck:me.deck.length, nrg:me.energy.length, hand:me.hand.length, shuf:me.shuffle.length, round:s.round, turn:s.turn}; })));
  ok(shrank,'…and the catch-up really moved cards off your deck, as step 4 claims');

  await next(); ok(await L.atStep(5),'step 5 is reachable');
  await next();
  await L.finish('initiative');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
