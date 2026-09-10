/* THE SHADOW COMPARATOR — epic/priority-windows, step 12.
 *
 * Step 18 replaces the Fight End shield-GUARD window with the priority go-round step 11 built. This is the
 * artefact that says that migration is safe BEFORE it happens: whoever the old whitelist lets answer, the
 * new walk must let answer too. If it goes red, step 18 would take an answer away from somebody who has
 * one today — silently, because a window nobody is offered looks exactly like a window nobody wanted.
 *
 * TWO HALVES, AND THE STATIC ONE IS THE PROOF.
 *   A · EXHAUSTIVE (no sampling): the old gate is `guardEffFor` = `immune || shieldImmune`, which does NOT
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
         `effectFor(...).immune || .shieldImmune` — a copy of `guardEffFor`'s body — and a mutant that
         widened the REAL gate sailed past this half entirely while half B caught it. One definition, called;
         the same rule as `isChopOf` and `counterTargets`, and it failed here first time of asking. */
      var e = E.guardEffFor(g, 0, c);
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

var obs = 0, violations = [], refused = [], oldTotal = 0, newTotal = 0, extraBy = {}, obsBy = {};

COUNTS.forEach(function (np) {
  extraBy[np] = 0; obsBy[np] = 0;
  for (var g = 0; g < GAMES; g++) {
    var st = E.newGame(null, { numPlayers: np });
    st._diff = {}; for (var i = 0; i < np; i++) st._diff[i] = DIFF;
    var guard = 0;
    while (!st.finished && guard++ < 200000) {
      if (st.shieldResponse) {
        var sr = st.shieldResponse;
        /* THE OLD WINDOW IS ALWAYS EXACTLY ONE SEAT — the threatened one, and only when it holds a card
           `guardEffFor` admits. That single-seat shape IS the defect the epic exists to fix (§3: priority is
           passed around; it is not a prompt to the victim), so this compares one seat against a walk. */
        var OLD = [sr.q];
        var NEW = newOfferSet(st, (typeof sr.winner === 'number') ? sr.winner : st.turn);
        obs++; obsBy[np]++;
        oldTotal += OLD.length; newTotal += NEW.length;
        OLD.forEach(function (s) { if (NEW.indexOf(s) < 0) violations.push({ np: np, seat: s, guardId: sr.guardId, offered: NEW.slice(), round: st.round }); });
        // "by construction" is what every silently-wrong invariant in this repo was called first
        NEW.forEach(function (s) { if (st.players[s].eliminated || !E.canAddToStack(st, s)) refused.push({ np: np, seat: s, elim: !!st.players[s].eliminated }); });
        extraBy[np] += NEW.filter(function (s) { return OLD.indexOf(s) < 0; }).length;
      }
      AI.takeTurn(st, st.turn, DIFF);
    }
  }
});

/* A GREEN RUN ON ZERO OBSERVATIONS PROVES NOTHING — the shape this repo has shipped twice (a vacuous
   `|| true`, a negative asserted inside the previous cooldown). So the floor is asserted before the
   comparisons that depend on it.
   THE FLOOR IS A TOTAL, NOT PER COUNT, AND THAT IS DELIBERATE. Measured across runs, 2 players yields only
   ~5 openings in 200 duels (1, 5, 6, 8 on four runs): the window needs a Special win against a seat holding
   an AFFORDABLE Leyline, and a duel deals two random decks. A per-count floor would therefore be a
   probabilistic assertion — an intermittent red by construction, which this repo has already filed once as
   a phantom product bug. The duel is not left unproven: half A covers every card at every count
   deterministically, and it is half A that carries the claim. */
ok(obs >= 60,
   'B · the driver REACHED the old window ' + obs + ' times (2p ' + obsBy[2] + ' / 3p ' + obsBy[3] + ' / 6p ' + obsBy[6] + ')' +
   (obs >= 60 ? '' : '  ← too few to conclude anything; raise GAMES, or the staging has drifted'));

ok(violations.length === 0,
   'B · SUPERSET holds in live play: every seat the old whitelist offers, the new go-round offers (' + oldTotal + ' old offers)' +
   (violations.length ? '  ← ' + violations.length + ' VIOLATIONS, e.g. ' + JSON.stringify(violations[0]) +
    '  — step 18 would take an answer away from a player who has one today' : ''));

ok(refused.length === 0,
   'B · the new walk never offers a seat the engine would refuse (eliminated, or no affordable Quick)' +
   (refused.length ? '  ← ' + refused.length + ', e.g. ' + JSON.stringify(refused[0]) : ''));

/* THE POINT OF THE MIGRATION, QUANTIFIED — and deliberately NOT a threshold. The number moves with cards,
   decks and AI policy, so a ratchet on it would go red for reasons that are not defects. It is asserted
   only as "> 0" because a superset that widened NOTHING would satisfy every assertion above while
   delivering none of what step 18 claims. */
var delta = newTotal - oldTotal;
ok(delta > 0,
   'B · the new window is genuinely WIDER, not merely not-narrower: ' + oldTotal + ' → ' + newTotal + ' offers (+' + delta + ')' +
   '  [extra seats: 2p ' + extraBy[2] + ' / 3p ' + extraBy[3] + ' / 6p ' + extraBy[6] + ']');

console.log((fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail + '  · ' + (GAMES * COUNTS.length) + ' games, ' + obs + ' windows');
process.exit(fail ? 1 : 0);
