/* The "Initiative" tutorial lesson (Basics #3). It is the ONE lesson with its own rig whose promise is a
 * NEGATIVE: `tutRigInitiative` makes the Rival lead round 1 with cards you cannot beat, so that passing is the
 * honest play — the step literally says "your cards are all low, so you can't beat their lead". If the rig ever
 * deals you a beat, that sentence is false and the lesson teaches the wrong thing while still completing, since
 * its gate only asks for a pass. Asserting the negative is the point. Run: node lessontest_initiative.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('initiative');
  const { p, ok, until, step, at, next, passTurn } = L;
  ok((await at()||{}).n===7,'7 steps');   // 5 until 2026-09-17, when the lesson stopped ending on a promise

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
  /* PASS LIVES IN THE FIGHT SUB-PHASE NOW (epic step 20), so the move-to-Fight press comes first — it plays
   * nothing, it only changes sub-phase. The invariant below is untouched and is still the point: whatever
   * renders ENABLED must work on a single click. */
  await until(()=>{ const f=document.getElementById('fightBtn'); return !!f && !f.disabled; },'the turn comes back and Fight goes live');
  await p.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f && !f.disabled && f.textContent==='Next') f.click(); });
  ok(await until(()=>{ const b=document.getElementById('passBtn'); return !!b && b.offsetParent!==null && !b.disabled; },'Pass becomes enabled'),
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

  /* THE LESSON USED TO END HERE, ON A PROMISE (2026-09-17). Five steps, three of them spent making you PASS
   * and lose the lead on purpose, and then "when you do win a round, initiative swings to you" — the losing
   * half of its own subject, described rather than played. Aj: "before the tutorial for initiative ends, we
   * should let the player take the initiative".
   * THE RIG MAKES WINNING IMPOSSIBLE BY DESIGN (you hold 3-5, the Rival 6-8), so the payoff is provisioned
   * at the step: `tutArmInitiativeWin` hands over the 2 and strips the Rival to cards that cannot answer a
   * single. A gated step the board can refuse is a dead end, and this one gates on an OUTCOME. */
  /* WAIT FOR THE CARD, DO NOT TRUST THE SPOTLIGHT'S TIMING. The framework DEFERS a gated step's prep until
   * the player's turn, so `hi`/`only` — both keyed on the id the prep sets — resolve to nothing on the
   * first paint and `playSpot` reports "no spotlit cards in hand". Poll for the 2 to actually arrive, then
   * play it by id. Same lesson as every other rig here: assert the card is THERE before driving it. */
  ok(await until(()=>window.__solo.st().players[0].hand.some(c=>c.rank===2),'the step hands you a 2'),
     'the payoff step really provisions the 2 — the rig makes winning impossible without it');
  const twoId = await p.evaluate(()=>(window.__solo.st().players[0].hand.filter(c=>c.rank===2)[0]||{}).id);
  const won = await L.playIds([twoId]);
  ok(won===null || won===undefined, 'the 2 the step hands you is playable'+(won?' — '+won:''));
  ok(await until(()=>{ const s=window.__solo.st(); return s.initiative===0; },'the initiative swings to you'),
     'winning the round really DOES hand you the initiative — the claim the lesson used to only make in prose');
  ok(await L.atStep(6),'…and that is what advances the lesson, not a Next button');

  await p.evaluate(()=>{ const b=document.getElementById('sortBtn'); if(b) b.click(); });
  ok(await L.atStep(7),'tapping Sort advances to the closing step — the shape is a choice you make');

  await next();
  await L.finish('initiative');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
