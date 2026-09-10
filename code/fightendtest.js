/* THE FIGHT END MODEL — epic/priority-windows, step 17.
 *
 * WHAT THIS FILE DOES *NOT* DO, and the omission is deliberate. Four of the six things step 17 lists are
 * already asserted in `test.js`, by name, under "THE FIGHT END GO-ROUND (epic step 11)":
 *   · the origin at n>=3          — the worked example there IS a 3-player table
 *   · holding priority            — step 6/7's controller-first assertions
 *   · Counter Spell naming its target — step 8's `counterTargets` block
 *   · the empty-stack boundary    — "the sub-phase opens NO further go-round"
 * Copying them here would create the second copy that drifts, which is this repo's most-repeated lesson
 * (`isChopOf`, `resolveIds`, `immunityEffFor`). **Read `test.js` for those.** This file asserts the two
 * things nothing anywhere asserts, plus the end-to-end shape no unit test covers.
 *
 * Run: node fightendtest.js          — and run it FORTY TIMES, not once (step 17's own instruction: two
 * flakes hid in one green run the last time this surface was touched, and `prompttest` was 8/40 today
 * while looking fine on the first go).
 */
var E = require('./engine.js'), AI = require('./ai.js');
var pass = 0, fail = 0;
function ok(c, m) { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; }
function sc(r, su, t) { return { rank: r, suit: su, id: (t || '') + r + su }; }

// ---------------------------------------------------------------- 1 · SIMULTANEOUS KICKS
/* `PHASES-AND-PRIORITY.md` §4: *"everyone loses the shield at the same time. which is after everyone is
 * asked"* — and the consequence Aj drew from it himself: **two players both at zero and both struck are
 * eliminated TOGETHER**, which at 3-6 players can end a game in a way sequential resolution cannot.
 * Step 10 MEASURED this as already true and shipped no assertion, so it has been an undefended property
 * ever since. This is that assertion.
 * WHY BOTH DYING IS THE SIMULTANEITY CLAIM, not merely a damage claim: the engine refuses overkill, and
 * *"was this player already broken?"* has to be sampled for EVERY target BEFORE ANY strip lands. Sample it
 * per-target as each resolves and the second read sees a board the first strip already changed — so a
 * sequential implementation spares somebody. Both dying, and both credited, is what says it did not. */
(function () {
  E.setSpecialLossMode('all');
  var g = E.newGame(null, { numPlayers: 3 });
  g.round = 3; g.turn = 0; g.pile = null; g.passes = 0; g.lastPlayer = null;
  g.players[0].shields = 3; g.players[1].shields = 0; g.players[2].shields = 0;
  g.players[0].hand = [sc(9, 'C', 'a'), sc(9, 'S', 'b')];
  g.players[1].hand = [sc(4, 'C', 'c')];
  g.players[2].hand = [sc(5, 'D', 'd')];

  var pr = E.play(g, 0, [g.players[0].hand[0], g.players[0].hand[1]]);
  ok(pr && pr.ok !== false, 'kicks: staged — p0 leads a Pair with BOTH rivals already at zero shields' + (pr && pr.ok === false ? '  ← ' + pr.reason : ''));
  E.pass(g, 1);
  var r = E.pass(g, 2);

  ok(g.players[1].eliminated === true && g.players[2].eliminated === true,
     'SIMULTANEOUS KICKS: both zero-shield seats are eliminated by the one Special' +
     ((g.players[1].eliminated && g.players[2].eliminated) ? '' :
      '  ← p1 ' + !!g.players[1].eliminated + ', p2 ' + !!g.players[2].eliminated +
      ': a sequential resolution spares whoever is sampled second'));
  ok(g.players[0].kicksLanded === 2,
     'kicks: BOTH are credited to the striker (kicksLanded ' + g.players[0].kicksLanded + ')');
  ok(g.finished === true && g.winner === 0, 'kicks: one Rider left standing — the game ends on that round');
  ok(r && r.kick === true, 'kicks: the round result reports a kick');
  E.setSpecialLossMode('chosen');
})();

// ---------------------------------------------------------------- 2 · THE WHITELIST CANARY
/* THE ASSERTION THAT GOES RED IF THE WHITELIST COMES BACK. The old Fight End window offered exactly one
 * seat — the threatened one — and only a card passing `immunityEffFor` (then called `guardEffFor`). The
 * rebuilt go-round offers ANY affordable Quick to ANY seat holding priority; step 12 measured that widening
 * at +106 offers over 600 games.
 * It is asserted as the POSITIVE property that replaced the whitelist, because that is the one a
 * reintroduction cannot satisfy: a seat whose only Quick GUARDS NOTHING must still be offered the window.
 * Under any guard-only predicate that seat is skipped and this goes red — which is the whole point, since
 * the alternative (asserting the whitelist is absent) passes on a build that offers nobody at all. */
(function () {
  var g = E.newGame(null, { numPlayers: 3 });
  g.round = 3; g.turn = 1; g.stack = []; g.prioPassed = {}; g.pending = null; g.respondFor = null;
  for (var i = 0; i < 3; i++) { g.players[i].hand = []; g.players[i].energy = []; g.players[i].shields = 3; }
  /* SEAT 1 HOLDS ONLY HAND-TO-HAND MASTERY — a Quick that guards nothing, made Quick by the ♠K.
     IT USED TO BE COUNTER SPELL, and that stopped staging the claim on 2026-09-10 when targeting became
     part of casting: on an EMPTY stack a Counter Spell has no legal target and cannot be cast at all, so
     the seat is correctly not offered and this canary would have gone red for a reason that has nothing
     to do with the whitelist. The replacement is a STRONGER canary, not merely a working one — a
     Form-granted Quick is exactly the kind the old `guardEffFor` refused (its patch is `{quick:true}`
     alone), so it is the same species as Sanctuary-under-Hector rather than a base card. */
  g.players[1].hand = [sc(3, 'S', 'hh')];
  g.players[1].forms = [sc(13, 'S', 'spadeK')];
  for (var e = 0; e < 6; e++) g.players[1].energy.push(sc(4, 'S', 'e' + e));
  g.pile = { p: 2, combo: { type: 'pair', size: 2, value: 9, cards: [sc(9, 'C', 'x'), sc(9, 'S', 'y')] } };
  g.lastPlayer = 2;

  var guards = E.immunityEffFor(g, 1, g.players[1].hand[0]);
  ok(!guards, 'canary: staged — seat 1 holds a Quick that the OLD whitelist would refuse (guards nothing)');
  ok(E.canAddToStack(g, 1) === true, 'canary: …and the engine agrees it can add to the stack');

  E.openFightEndWindow(g, 2, true, [0], 2);
  ok(g.respondFor === 1,
     'WHITELIST CANARY: a seat whose only Quick guards NOTHING is still offered the Fight End window' +
     (g.respondFor === 1 ? '' : '  ← offered ' + g.respondFor + '. The whitelist is back: only guard cards ' +
      'reach this window, and every other Quick is silently unplayable at Fight End'));

  // and the window is genuinely answerable — a canary that opens a window nobody can use proves nothing
  var rr = E.respond(g, 1, 'hh3S');
  ok(rr && rr.ok !== false, 'canary: …and they can actually cast into it' + (rr && rr.ok === false ? '  ← ' + rr.reason : ''));
})();

// ---------------------------------------------------------------- 3 · THE WHOLE WINDOW, END TO END
/* The unit assertions in `test.js` each hold one property still. This drives a complete Fight End window at
 * three players with real cards — open, walk, cast, resolve, restart, close, outcomes — and asserts the one
 * thing no unit test can: that the sequence TERMINATES with the round advanced and nothing owed. Every
 * failure mode this epic fears (a parked table, a second go-round, an unresolved object) shows up here as a
 * hang or a leftover, not as a wrong value. */
(function () {
  var g = E.newGame(null, { numPlayers: 3 });
  g.round = 3; g.turn = 1; g.stack = []; g.prioPassed = {}; g.pending = null; g.respondFor = null;
  /* HAND-TO-HAND MASTERY under the ♠K, not Counter Spell — see the canary's note. It is the right card
     for THIS block for a second reason: its effect is a draw, so it perturbs nothing the assertions read.
     Leyline would be castable too and would PREVENT the very shield loss the outcome assertion checks. */
  for (var i = 0; i < 3; i++) {
    g.players[i].hand = [sc(3, 'S', 'h' + i)];
    g.players[i].forms = [sc(13, 'S', 'k' + i)];
    g.players[i].energy = []; for (var e = 0; e < 6; e++) g.players[i].energy.push(sc(4, 'S', 'e' + i + e));
    g.players[i].shields = 3;
  }
  g.pile = { p: 2, combo: { type: 'pair', size: 2, value: 9, cards: [sc(9, 'C', 'x'), sc(9, 'S', 'y')] } };
  g.lastPlayer = 2;

  var round0 = g.round, shields0 = g.players[0].shields;
  E.openFightEndWindow(g, 2, true, [0], 2);
  ok(g.respondFor === 2, 'end-to-end: the window opens on the winner');

  var seen = [], guard = 0;
  while (g.respondFor != null && guard++ < 20) { seen.push((g.pending ? 'obj' : 'empty') + ':' + g.respondFor); E.declineResponse(g, g.respondFor); }
  ok(guard < 20, 'end-to-end: the window TERMINATES — it did not spin (' + seen.length + ' grants)');
  ok(g.respondFor === null && g.pending === null && g.stack.length === 0 && !g.fightEnd,
     'end-to-end: nothing left owed — no window, no object, empty stack, nothing parked');
  ok(g.round === round0 + 1 && g.players[0].shields === shields0 - 1,
     'end-to-end: the outcomes landed exactly once (round ' + round0 + '→' + g.round +
     ', struck seat ' + shields0 + '→' + g.players[0].shields + ')');
})();

// ---------------------------------------------------------------- 4 · THE AI DRAINS IT
/* Step 16's branch is unreachable in a real game until step 18, so this is the only place it runs at all.
 * `resolveAIWindows` is not exported, so its loop is reproduced — the same shape `test.js` uses for P1. */
(function () {
  var g = E.newGame(null, { numPlayers: 3 });
  g.round = 3; g.turn = 1; g.stack = []; g.prioPassed = {}; g.pending = null; g.respondFor = null;
  /* HAND-TO-HAND MASTERY under the ♠K, not Counter Spell — see the canary's note. It is the right card
     for THIS block for a second reason: its effect is a draw, so it perturbs nothing the assertions read.
     Leyline would be castable too and would PREVENT the very shield loss the outcome assertion checks. */
  for (var i = 0; i < 3; i++) {
    g.players[i].hand = [sc(3, 'S', 'h' + i)];
    g.players[i].forms = [sc(13, 'S', 'k' + i)];
    g.players[i].energy = []; for (var e = 0; e < 6; e++) g.players[i].energy.push(sc(4, 'S', 'e' + i + e));
    g.players[i].shields = 3;
  }
  g.pile = { p: 2, combo: { type: 'pair', size: 2, value: 9, cards: [sc(9, 'C', 'x'), sc(9, 'S', 'y')] } };
  g.lastPlayer = 2;
  E.openFightEndWindow(g, 2, true, [0], 2);

  var spins = 0;
  while (g.respondFor != null && spins++ < 64) { var rr = AI.respondDecision(g, g.respondFor); if (!rr) break; }
  ok(spins < 12, 'AI: the Fight End window drains without spinning (' + spins + ' iterations)');
  ok(g.respondFor === null, 'AI: …and ends with no window owed');
  ok(g.round === 4, 'AI: …and the sub-phase ran, so the round advanced');
})();

console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
