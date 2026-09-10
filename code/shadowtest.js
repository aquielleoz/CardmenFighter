/* THE SHADOW COMPARATOR — epic/priority-windows, step 12.
 *
 * Step 18 replaces the Fight End shield-GUARD window with the priority go-round step 11 built. This is the
 * artefact that says that migration is safe BEFORE it happens: whoever the old whitelist lets answer, the
 * new walk must let answer too. If it goes red, step 18 would take an answer away from somebody who has
 * one today — silently, because a window nobody is offered looks exactly like a window nobody wanted.
 *
 * TWO HALVES, AND THE STATIC ONE IS THE PROOF.
 *   A · EXHAUSTIVE (no sampling): the old gate is `immunityEffFor` = `immune || shieldImmune`, which does NOT
 *       require `quick`; the new gate is `canAddToStack`, which DOES. So the whole superset claim reduces to
 *       one question — can any card pass the old gate without being a Quick? Every card is evaluated in
 *       every Form context, so the answer is a proof rather than an observation.
 *   B · LIVE: real AI games at 2/3/6p, comparing the two offer sets wherever the old window actually opens.
 *       It corroborates A on the dimensions A cannot see (affordability, elimination, the walk itself) and
 *       it MEASURES the widening — the thing step 18 is actually for.
 *
 * WHY BOTH, when A is the stronger claim: A is a statement about the CARDS and B is a statement about the
 * WALK, and step 18 changes the walk. A alone would still pass on a walk that offered nobody at all.
 *
 * THE LIVE HALF NEEDS NO ENGINE CHANGE, WHICH IS WHY IT CAN BE TRUSTED. `driveShieldStack` sets
 * `st.shieldResponse` and returns; `takeTurn` answers it at the top of the NEXT call. So the open window is
 * plainly readable on state between two `takeTurn`s. A probe that had to patch the engine to see the thing
 * it measures would be measuring the patch.
 *
 * AND IT USES THE ENGINE'S OWN WALK, never a copy — `nextPrioHolder`, called repeatedly with each answer
 * marked passed, which is what a real go-round does. Restating the loop here is the `isChopOf` mistake.
 *
 * THE BASELINE IS POST-STEP-6, NOT `main`: step 6 changed who is offered on ordinary objects too, so "the
 * old behaviour" means the epic's current behaviour, which is what driving the epic's engine gives.
 *
 * Run: node shadowtest.js          Env: GAMES=n (per player count, default 200)
 */
var E = require('./engine.js'), AI = require('./ai.js');

var GAMES = +(process.env.GAMES || 200), COUNTS = [2, 3, 6], DIFF = 'knight';
var pass = 0, fail = 0;
function ok(c, m) { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; }

// ---------------------------------------------------------------- A · the exhaustive half
/* Every card, in every Form context up to three Forms — singles, pairs (which are NOT a Super) and triples
   (which are, since `FORM_SUIT_MATCH` is false: any J + any Q + any K). Three is the ceiling that matters
   because a Super is the strongest patch available and nothing stacks past it; the pairs are in because a
   patch that applies without a Super is exactly the case a Super-only enumeration would miss. */
(function () {
  var SU = ['D', 'H', 'C', 'S'], cards = [], pool = [];
  for (var s = 0; s < 4; s++) for (var r = 1; r <= 13; r++) cards.push({ rank: r, suit: SU[s], id: r + SU[s] });
  for (var s2 = 0; s2 < 4; s2++) [11, 12, 13].forEach(function (r2) { pool.push({ rank: r2, suit: SU[s2], id: 'f' + r2 + SU[s2] }); });

  var ctxs = [[]];
  for (var i = 0; i < pool.length; i++) {
    ctxs.push([pool[i]]);
    for (var j = i + 1; j < pool.length; j++) {
      ctxs.push([pool[i], pool[j]]);
      for (var k = j + 1; k < pool.length; k++) ctxs.push([pool[i], pool[j], pool[k]]);
    }
  }

  var admitted = {}, notQuick = [], evals = 0, superCtxs = 0;
  ctxs.forEach(function (forms) {
    var g = E.newGame(null, { numPlayers: 2 });
    g.players[0].forms = forms;
    if (E.hasSuper(g.players[0])) superCtxs++;    // note the signature: hasSuper takes a PLAYER, not (st, seat)
    cards.forEach(function (c) {
      evals++;
      /* CALL THE OLD GATE, DO NOT RESTATE IT. The first draft of this line tested
         `effectFor(...).immune || .shieldImmune` — a copy of `immunityEffFor`'s body — and a mutant that
         widened the REAL gate sailed past this half entirely while half B caught it. One definition, called;
         the same rule as `isChopOf` and `counterTargets`, and it failed here first time of asking. */
      var e = E.immunityEffFor(g, 0, c);
      if (!e) return;                                            // the old gate refuses it — not our problem
      admitted[c.rank + c.suit] = (admitted[c.rank + c.suit] || 0) + 1;
      if (!e.quick) notQuick.push({ card: c.rank + c.suit, name: e.name, forms: forms.map(function (f) { return f.rank + f.suit; }).join('+') || 'none' });
    });
  });

  var names = Object.keys(admitted).sort();
  ok(names.length > 0,
     'A · staging holds — the old whitelist admits something at all (' + names.join(', ') + ' over ' + ctxs.length + ' Form contexts, ' + evals + ' evaluations)' +
     (names.length ? '' : '  ← nothing admitted, so the assertion below would be vacuous'));

  /* THE ENUMERATION MUST REALLY REACH SUPER MODE, and this is asserted rather than reasoned because half A
     is otherwise blind to exactly the case that matters most. A Form can GRANT `quick` — CLAUDE.md lists six
     such patches — so a context set containing no Supers would evaluate every card at its BASE effect,
     find one whitelist entry (Leyline, already Quick) and report a clean superset while never having tested
     a Form-granted Quick at all. Measured: 64 of 299 contexts are Supers, and Sanctuary is admitted in
     exactly those 64 and in no other context, so this assertion is load-bearing rather than decorative. */
  ok(superCtxs > 0 && admitted['10H'],
     'A · the enumeration REACHES Super Mode (' + superCtxs + ' of ' + ctxs.length + ' contexts) and a Form-granted guard really appears in it' +
     (superCtxs > 0 && admitted['10H'] ? '' : '  ← without a Super, every card is evaluated at its base effect and the whole half is vacuous'));

  ok(notQuick.length === 0,
     'A · EXHAUSTIVE: every card the old whitelist admits is also a Quick, so `canAddToStack` cannot refuse it' +
     (notQuick.length ? '  ← ' + notQuick.length + ' counterexample(s), e.g. ' + JSON.stringify(notQuick[0]) +
      '  — that card can guard today and could NOT answer after step 18' : ''));
})();

// ---------------------------------------------------------------- B · the live half
/* Every seat the Fight End go-round would offer, from `origin`, in order — by RUNNING the engine's walk and
   passing for each seat in turn. `prioPassed` is saved and restored: this observes a live game that must go
   on to play normally, and a comparator that perturbs the game it measures is measuring something else. */
function newOfferSet(st, origin) {
  var saved = st.prioPassed;
  st.prioPassed = {};
  var out = [], q, guard = 0;
  while ((q = E.nextPrioHolder(st, origin)) >= 0 && guard++ < 12) { out.push(q); st.prioPassed[q] = true; }
  st.prioPassed = saved;
  return out;
}

/* ---- HALF B CHANGED MEANING AT STEP 18, AND SAYING SO IS THE POINT ----
   Until the switch this half compared the two windows side by side in live play. It cannot any more, and
   not because it broke: `driveShieldStack`'s guard window is GONE, so `st.shieldResponse` is never set and
   the comparison has nothing on its left-hand side. Deleting the half would throw away the only live
   evidence in the file; leaving it red would be a suppression. So it flips to the claim that is now the
   useful one — **the old window is gone AND the new one is really running** — and keeps the two things
   half A cannot see: that the walk never offers a seat the engine would refuse, and how wide it actually is.
   THE OLD-WINDOW COUNT IS ASSERTED AT ZERO rather than deleted, which makes this the live counterpart of
   `fightendtest`'s whitelist canary: reinstate the guard window and this goes red naming it.
   AND THE ZERO IS NOT ALLOWED TO STAND ALONE. "Nothing opened the old window" is also true of a build where
   nothing happens at all, which is the vacuous shape this repo has shipped twice — so the go-round floor
   below is what makes the zero mean something. */
var obs = 0, oldWindows = 0, refused = [], offerTotal = 0, obsBy = {}, offBy = {}, multi = 0;

COUNTS.forEach(function (np) {
  obsBy[np] = 0; offBy[np] = 0;
  for (var g = 0; g < GAMES; g++) {
    var st = E.newGame(null, { numPlayers: np });
    st._diff = {}; for (var i = 0; i < np; i++) st._diff[i] = DIFF;
    var guard = 0;
    while (!st.finished && guard++ < 200000) {
      if (st.shieldResponse) oldWindows++;
      /* THE SAME OBSERVATION POINT AS BEFORE, AND IT SURVIVES FOR THE SAME REASON: a round-winning pass
         leaves the window open and `takeTurn` returns (P6), so the next call is what drains it. The window
         is therefore plainly readable on state between two turns, with no engine patch to measure. */
      if (st.fightEnd && st.respondFor != null) {
        var NEW = newOfferSet(st, st.fightEnd.origin);
        obs++; obsBy[np]++; offerTotal += NEW.length; offBy[np] += NEW.length;
        if (NEW.length > 1) multi++;
        NEW.forEach(function (s) { if (st.players[s].eliminated || !E.canAddToStack(st, s)) refused.push({ np: np, seat: s, elim: !!st.players[s].eliminated }); });
      }
      AI.takeTurn(st, st.turn, DIFF);
    }
  }
});

ok(obs >= 60,
   'B · the driver REACHED the Fight End go-round ' + obs + ' times (2p ' + obsBy[2] + ' / 3p ' + obsBy[3] + ' / 6p ' + obsBy[6] + ')' +
   (obs >= 60 ? '' : '  ← too few to conclude anything; raise GAMES, or the staging has drifted'));

ok(oldWindows === 0,
   'B · THE OLD WHITELIST WINDOW IS GONE — `shieldResponse` was never set once in ' + (GAMES * COUNTS.length) + ' live games' +
   (oldWindows === 0 ? '' : '  ← opened ' + oldWindows + ' times: `driveShieldStack` is still minting a guard window, so BOTH windows are live in one round and no red run can say which it saw'));

ok(refused.length === 0,
   'B · the walk never offers a seat the engine would refuse (eliminated, or no affordable Quick)' +
   (refused.length ? '  ← ' + refused.length + ', e.g. ' + JSON.stringify(refused[0]) : ''));

/* THE WIDENING, QUANTIFIED — and deliberately NOT a threshold beyond "it happens". The old window offered
   exactly ONE seat, always, and only when that seat held a card the whitelist admitted; so a run in which
   no window ever offers a second seat would be indistinguishable from the model step 18 replaced. The
   number itself moves with cards, decks and AI policy, which is why it is recorded rather than ratcheted. */
ok(multi > 0,
   'B · the window is genuinely WIDER than the one seat the whitelist offered: ' + multi + ' of ' + obs +
   ' go-rounds offered more than one seat, ' + offerTotal + ' offers in all' +
   '  [offers: 2p ' + offBy[2] + ' / 3p ' + offBy[3] + ' / 6p ' + offBy[6] + ']');

console.log((fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail + '  · ' + (GAMES * COUNTS.length) + ' games, ' + obs + ' go-rounds');
process.exit(fail ? 1 : 0);
