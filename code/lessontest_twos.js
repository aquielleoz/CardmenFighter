/* The "The 2" tutorial lesson (Basics #5) — and the apex card text that goes with it.
 *
 * WHY THE LESSON EXISTS: the 2's two rules contradict each other on first hearing. It is the apex at sizes 1-3
 * and the LOWEST card in plays of four or more. So the lesson shows the same three 2s failing as a full house
 * one step after a lone 2 has beaten an Ace.
 *
 * NOTHING IN IT IS SCRIPTED. The rig puts the cards in the Rival's hand and a KNIGHT-tier opponent plays them in
 * the right order by itself — measured on that hand: opens with the Ace 25/25, boosts over your apex 2 20/20,
 * leads the 222+pair full house 20/20 (minion, the default tutorial tier, does neither: it "barely uses
 * effects" by design). Two earlier drafts forced those plays from step preps and could not work, because the
 * framework defers a GATED step's prep until the player's turn — by which time the AI has already acted.
 * SO THIS SUITE ASSERTS EACH BEAT THE AI IS RELIED ON FOR. If a policy change stops the Rival boosting, this
 * goes red rather than the lesson quietly telling the player something that did not happen.
 * Run: node lessontest_twos.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('twos');
  const { p, ok, until, step, at, next, playAny } = L;

  ok((await at()||{}).n===8,'8 steps');
  /* THE ILLEGAL DECK IS THE POINT: the Rival needs SIX 2s across three rounds (one to beat your Ace, two for
   * the pair, three for the full house) and a legal seat holds four. Assert the fabricated hand outright. */
  ok(await p.evaluate(()=>window.__solo.st().players[1].hand.filter(c=>c.rank===2).length===6),
    'the Rival opens holding SIX 2s — the deck is deliberately illegal');
  ok(await p.evaluate(()=>window.__solo.st().players[0].hand.filter(c=>c.rank===1).length===3),
    'you hold three Aces — one to lead, two for the pair');

  await next();
  ok(await L.atStep(2),'step 2 asks you to lead the Ace');
  /* Play what the step SPOTLIGHTS — that is what a player sees, and what the step's `only` will accept. */
  ok(await L.playSpot()===null,'you led the Ace the step pointed at');
  ok(await L.atStep(3),'leading it advanced the lesson to step 3');
  /* CLAIM: "they answered with a 2, and your Ace could not touch it." */
  ok(await until(()=>{ const s=window.__solo.st(); return !!s.pile && s.pile.combo.size===1 && s.pile.combo.cards[0].rank===2; },'the Rival answers with a 2'),
    'the Rival answered your Ace with a 2 — the apex at one card');

  const why3=await L.activateSpot();
  ok(why3===null,'you activated the boost'+(why3?' — '+why3:''));
  ok(await L.atStep(4),'activating advanced the lesson to step 4');
  ok(await L.playSpot()===null,'you played your boosted 2');
  ok(await L.atStep(5),'…which advanced the lesson to step 5');
  /* CLAIM: "you took the round, so you lead." */
  ok(await until(()=>window.__solo.st().initiative===0,'you take the initiative'),
    '…and your boosted 2 really took the round');

  /* THE HALF THIS LESSON EXISTS TO ADD: the demotion is NOT all specials. At two cards the 2 is still apex. */
  ok(await L.playSpot()===null,'you led the pair of Aces');
  ok(await L.atStep(6),'leading it advanced the lesson to step 6');
  ok(await until(()=>{ const s=window.__solo.st();
      return !!s.pile && s.pile.combo.size===2 && s.pile.combo.cards.every(c=>c.rank===2); },'the Rival answers with a pair of 2s'),
    'the Rival answered with a PAIR OF 2s — still apex at two cards');
  const pr2=await p.evaluate(()=>window.__solo.st().pile.combo.cards.map(c=>c.suit));
  ok(pr2.length===2 && pr2[0]!==pr2[1], `…two DIFFERENT 2s, not one card shown twice  [${pr2}]`);
  ok(await p.evaluate(()=>window.CardmenEngine.legalFightPlays(window.__solo.st(),0).length===0),
    '…and nothing you hold beats it, as the step says');
  /* FORCE THE PILOT'S HOLE (twos-lesson-pilot-leads-nothing). The round-3 lead needs three 2s AND a non-2 pair,
     and before the repair a short hand fell through to `E.pass` in silence — the lesson then waited forever for
     the full house below. The rig supplies both on a good day, so thirty green runs proved only that. Strip the
     Rival's non-2 cards and empty its deck + shuffle pile (so the round draw cannot hand the pair back), and the
     full-house assertion below must STILL pass — through the repair, which the ledger names. */
  const forced=await p.evaluate(()=>{ const f=window.__solo.st().players[1];
    f.hand=f.hand.filter(c=>c.rank===2); f.deck=[]; f.shuffle=[];
    return { n:f.hand.length, nonTwo:f.hand.filter(c=>c.rank!==2).length, deck:f.deck.length }; });
  ok(forced.nonTwo===0 && forced.deck===0 && forced.n>=3, `STAGED: the Rival holds only its 2s and has nothing to draw  [${forced.n} cards]`);
  ok(await L.passTurn()!==null,'you passed');
  ok(await L.atStep(7),'passing advanced the lesson to step 7');

  /* AND THE FLIP, at five cards, with the reveal in the step BEFORE the instruction. */
  const ledFh=await until(()=>{ const s=window.__solo.st();
      return !!s.pile && s.pile.combo.type==='fullhouse' && s.pile.combo.cards.filter(c=>c.rank===2).length===3; },'the Rival leads 222 + a pair');   // no override: the default 30s. At 4.7s idle this was the only poll in the harness under a 4x margin
  ok(ledFh,'the Rival led a full house built on three 2s'+(ledFh?'':'  ← REPRODUCED: the pilot passed with a short hand'));
  ok(await p.evaluate(()=>window.__solo.prioLog().some(l=>/TWOS PILOT REPAIRED/.test(typeof l==='string'?l:JSON.stringify(l)))),
     '…through the REPAIR, which the ledger names — the forced hole really was reached');
  const fhCards=await p.evaluate(()=>{ const s=window.__solo.st(); return s.pile?s.pile.combo.cards.map(c=>c.rank+c.suit):[]; });
  ok(new Set(fhCards).size===fhCards.length, `…and the repaired play is suit-distinct — no card shown twice  [${fhCards}]`);
  const s7=(await step()).text;
  ok(/four cards or more/i.test(s7) && /lowest/i.test(s7),'step 7 explains the flip BEFORE asking you to beat it');
  ok(/smallest full house/i.test(s7),'…and calls theirs the smallest, not the best');
  /* THE RIG'S OWN PROMISE, ASSERTED — it claims "ten cards, exactly what the lesson spends, and `MAX_HAND`
     is 10 so none of it is trimmed", and nothing checked it. A hand over the limit opens the clean-up PICK,
     which renders bare ungrouped cards, so `playSpot` below reports `card 5C#t6 has no group` and retries
     its whole 30s budget against a modal state that never clears — the signature filed three times as a
     poll-budget flake. Assert the CAUSE here, where it is one number, rather than reading the symptom there.
     MEASURED: the hand is at **10 of 10 here — exactly the cap, zero headroom**, which is the whole story.
     The rig deals 10 and the lesson spends all 10, so the four round draws are pure surplus; ONE card left
     unspent by a slipped beat takes it to 11. Do not "fix" that by dealing fewer — every one of the ten is
     played. The graceful half lives in `lessonlib.answerWindow`, which answers such a pick and says so. */
  const handNow=await p.evaluate(()=>({ n:window.__solo.st().players[0].hand.length, max:window.CardmenEngine.MAX_HAND }));
  ok(handNow.n<=handNow.max,
     `your hand is within the limit, so no clean-up pick can open  [${handNow.n}/${handNow.max}]`);
  const pm=await L.pickMode();
  ok(pm===null, 'the board is not sitting on an unscripted pick'+(pm?' — '+pm:''));
  const fhWhy=await L.playSpot();
  ok(fhWhy===null,'you beat it with your own full house'+(fhWhy?' — '+fhWhy:''));
  ok(await L.atStep(8),'beating it advanced the lesson to step 8');
  ok(await p.evaluate(()=>{ const s=window.__solo.st();
      return !!s.pile && s.pile.combo.type==='fullhouse' && s.pile.combo.cards.filter(c=>c.rank===2).length===0; }),
    '…and YOUR full house holds the table');

  await next();
  await L.finish('twos');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
