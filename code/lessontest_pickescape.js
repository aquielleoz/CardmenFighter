/* THE CLEAN-UP PICK, AND THE LESSON HARNESS'S ESCAPE FROM IT — the branch no lesson reaches on a good day.
 *
 * WHY THIS EXISTS. `lessontest_twos` was filed three times as a poll-budget flake under `-j 4`, always with
 * the same opening line: *"you beat it with your own full house — card 5C#t6 has no group (retried for
 * 30000ms)"*. It is not a poll problem. `renderHand`'s FIRST branch renders bare cards straight into `#hand`
 * with no `.group` wrapper — "pick mode: flat individual cards, no grouping/drag" — and it is the only
 * writer that does. So `card <id> has no group` means the board is sitting on a PICK, every helper that
 * reaches for `.closest('.group')` reports it for every id, and the state never clears itself: the retry
 * spends its whole 30s budget against a board that cannot move, then fails with a message describing a DOM
 * bug that is not there.
 *
 * WHAT OPENS IT. Measured: "The 2" sits at **10 of 10 cards** at its last step — exactly the cap, zero
 * headroom. The rig deals ten and the lesson spends all ten, so the four round draws are pure surplus and
 * ONE card left unspent by a slipped beat takes the hand to 11 and opens the clean-up pick. That is why it
 * only ever bites under load, and why it always surfaces three steps after the beat that actually slipped.
 *
 * TWO GUARDS, AND THE SECOND IS WHY THIS FILE IS A SUITE RATHER THAN A PROBE. `pickMode()` NAMES the state,
 * and `answerWindow()` ESCAPES it so a slipped beat degrades into a warning instead of a dead end. Neither
 * fires in a healthy lesson, so both are untested code unless something forces the condition — and this repo
 * has already paid for throwing such a probe away three times over (see `__cmf.dropMirrors`).
 *
 * IT ASSERTS ITS OWN STAGING. If the extra cards do not actually push the hand over `MAX_HAND`, or the pick
 * never opens, it fails loudly rather than reporting a pass on a build where nothing was exercised.
 * The DOM contract the diagnosis rests on is asserted separately, in `nettest_trim` — the only suite in the
 * repo that reaches a real pick through ordinary play.
 *
 * Run: node lessontest_pickescape.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('twos');
  const { p, ok, until, atStep, next, playSpot, activateSpot, pickMode, answerWindow } = L;

  await next(); await atStep(2);
  await playSpot(); await atStep(3);
  await activateSpot(); await atStep(4);

  /* `__solo.st()` hands back `state` BY REFERENCE, which is what lets a suite stage this without a new hook.
     FIVE cards, not one: the hand is at 8 here, so a smaller push lands on exactly 10 and trims nothing —
     the first cut of this staging did that and reported a clean miss, which is the assertion below working. */
  const staged=await p.evaluate(()=>{
    const s=window.__solo.st(), h=s.players[0].hand;
    for(let i=0;i<5;i++) h.push({rank:9,suit:'SDHC'[i%4],id:'probe'+i});
    return { n:h.length, max:window.CardmenEngine.MAX_HAND };
  });
  ok(staged.n>staged.max, `STAGING: the hand is pushed over the cap  [${staged.n}/${staged.max}]`);

  await playSpot();                          // finish round 1 — the trim runs at the round boundary
  const opened=await until(()=>!!document.querySelector('#hand > .card'),'a clean-up pick opens',15000);
  ok(opened, 'STAGING: the clean-up pick opens, and the hand renders as bare ungrouped cards');

  /* THE DIAGNOSIS. Before this, the only thing a lesson suite could say was `card <id> has no group`. */
  const pm=await pickMode();
  ok(!!pm && /PICK MODE \(clean-up over the hand limit\)/.test(pm),
     'pickMode() NAMES the board state instead of blaming the DOM'+(pm?`  — ${pm}`:'  ← it returned null while a pick was up'));
  ok(!!pm && /hand \d+\/\d+/.test(pm||''), '…and carries the hand size, which is the number that explains it');

  /* THE ESCAPE. It must take `need` cards in ONE go: the first cut clicked a single card, found FIGHT
     enabled and pressed it, so the pick took one, was still over the cap and re-opened — the board never
     left pick mode (measured: 13 cards, "Discard 3", escaped with 12 still up). */
  const ret=await answerWindow();
  ok(/^clean-up pick \(\d+\)$/.test(ret||''), `answerWindow() ANSWERS the pick  [returned "${ret}"]`);
  const cleared=await until(()=>!document.querySelector('#hand > .card'),'pick mode clears',10000);
  ok(cleared, 'the board LEAVES pick mode — not merely one card lighter');
  const after=await pickMode();
  ok(after===null, 'and pickMode() agrees it is gone'+(after?`  — ${after}`:''));

  /* A SPOTLIT CARD IS THE LAST THING PITCHED. The pick takes any card, and throwing away the one the next
     step asks for swaps one dead end for another. */
  const keptSpot=await p.evaluate(()=>{ const s=window.__solo.st();
    return s.players[0].hand.filter(c=>/#t/.test(c.id)).length; });
  ok(keptSpot>0, `the lesson's own rigged cards survived the pitch  [${keptSpot} still in hand]`);

  await L.done();
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
