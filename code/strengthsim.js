/* AI STRENGTH, HEAD-TO-HEAD — the measurement no other harness in this repo can make.
 *
 * WHY THIS FILE EXISTS: `analysis.js`, `mpsim.js`, `personasim.js` and the rest run the SAME AI on every
 * seat, so they are symmetric and structurally blind to "is this change STRONGER?". `DECISIONS.md`
 * ("AI strength") says so outright, lists what a head-to-head needs — and names no file, because the
 * harness that produced its tables was thrown away. It has been rebuilt from scratch at least twice
 * (v1.31.78, v1.31.79). This is the third time; it is committed so there is not a fourth.
 *
 * Usage: node strengthsim.js [pairs] [armA] [armB] [deck] [players=N]   e.g. node strengthsim.js 2000 demon knight
 *   pairs      how many PAIRED games (total decided games = 2 x pairs, since every deal is played twice)
 *   armA/armB  difficulty tiers: minion | fighter | knight | demon
 *   deck       a key from E.DECK_ORDER, or 'full' (default) for the 52-card set on both seats
 * Reads as: armA's share of decided games, in POINTS above the fair share a fair pairing must produce (50.00 in a
 *   duel; 1/N at N players, where every deal is played once per seat — see the rotation note above the loop).
 *
 * THE THREE THINGS IT HAS TO DO, each of which produced a wrong answer before it was fixed (DECISIONS.md):
 *
 * 1. SEED `Math.random` PER GAME. The engine and AI fall back to it outside the rng `newGame` is handed
 *    (`shuffle` with no rng, `chooseTarget`, the persona draw), so seeding the rng ALONE does not make a
 *    game reproducible — measured 2026-09-12 on `personasim`, whose file contains no `Math.random` at all
 *    and which still printed 11.7 / 10.0 / 8.3 / 10.0 for four identical invocations. Pinning it here is
 *    also what PAIRS the two arms, which is most of the variance gone.
 *
 * 2. RUN BOTH ARMS AND POOL. Seat 0 carries a consistent advantage in this game — DECISIONS.md measures it
 *    at ~2.3 points, LARGER than most effects worth testing — so one arm alone reports the seat advantage
 *    as the result. Every deal is played twice: armA on seat 0, then armA on seat 1, same seed both times.
 *
 * 3. PROVE THE INSTRUMENT BEFORE BELIEVING IT, and here that is STRUCTURAL rather than a habit. With
 *    armA === armB the two runs of a pair are the SAME configuration, so they produce the SAME winning
 *    seat — and since armA is seat 0 in one and seat 1 in the other, the pooled share is EXACTLY 50.00%
 *    by construction. Any deviation at all means the pairing is broken (almost always: `Math.random` not
 *    pinned, so the two halves of a pair diverged). That is why a control run is not optional here and
 *    why it prints PASS/FAIL rather than a number to interpret.
 *    Run `node strengthsim.js 400 knight knight` and it must print 50.00 exactly.
 *
 * CALIBRATION, because a control at 50.00 only proves the pairing is fair, not that the harness can SEE a
 * real difference: `knight` vs `demon` is a difference this repo has already measured and recorded, at
 * +7.63 points (DECISIONS.md, after the v1.31.79 demon-only guard). If this file cannot reproduce roughly
 * that, the fault is here, not in the AI.
 *
 * STEP 21 USES IT BY ADDING AN ARM. Today an arm is a difficulty tier, which is the only per-seat AI
 * behaviour that already exists (`takeTurn(st, p, diff)` records `st._diff[p]` itself). A policy flag
 * becomes an arm the moment the policy is written — deliberately not built ahead of time, because an
 * unexercised branch is untested code, not a safeguard.
 */
var E = require('./engine.js');
var AI = require('./ai.js');

E.setShieldCards(true); E.setLoserMill(true);                      // catch-up is ON in the shipped game
E.setSpecialLossMode('chosen'); E.setMillScope('targeted');        // the shipped defaults, stated not assumed

/* `players=N` (2-6, default 2) IS A NAMED FLAG, valid in any position and stripped before the positional slots
   are read — the `passsim` lesson: a positional slot added at the end is the one a typo silently fills with the
   default. See the rotation note above the main loop for what it changes. */
var ARGS = process.argv.slice(2), NP = 2;
ARGS = ARGS.filter(function (a) { var m = /^players=(\d+)$/.exec(a); if (m) { NP = +m[1]; return false; } return true; });
if (NP < 2 || NP > 6) { console.error('players= must be 2-6'); process.exit(1); }
var PAIRS = parseInt(ARGS[0], 10) || 500;
var ARM_A = (ARGS[1] || 'demon').toLowerCase();
var ARM_B = (ARGS[2] || 'knight').toLowerCase();
var DECK  = ARGS[3] || 'full';
var TIERS = { minion: 1, fighter: 1, knight: 1, demon: 1 };
/* AN ARM IS `tier` OR `tier:policies` (epic step 21). `knight` alone is the shipped game — every step-21
   policy on. `knight:none` turns them all off, `knight:hold` / `knight:push` enable exactly one. That is
   what makes two changes shipped together still ATTRIBUTABLE: measure each against `:none`, then both. */
var POLICIES = ['push', 'pitch', 'ownCast'];   // `pitch`: the Demon Lord's smart Broadway pitch (2026-10-05) — demon-gated, so it is a no-op on a knight arm.
                                               // `ownCast`: never answer your own cast (ai-counters-own-cast, 2026-10-09) — every tier; it bites at 3-6 players
function parseArm(spec) {
  var bits = spec.split(':'), tier = bits[0], sel = bits[1];
  if (!TIERS[tier]) { console.error('arms must be tier[:policies] — tiers: ' + Object.keys(TIERS).join(' | ')); process.exit(1); }
  var on = {};
  if (sel === undefined || sel === 'all') POLICIES.forEach(function (k) { on[k] = 1; });
  else if (sel !== 'none') sel.split(',').forEach(function (k) {
    if (POLICIES.indexOf(k) < 0) { console.error('unknown policy: ' + k + '  (' + POLICIES.join(', ') + ', all, none)'); process.exit(1); }
    on[k] = 1;
  });
  return { tier: tier, on: on, label: spec };
}
var A = parseArm(ARM_A), B = parseArm(ARM_B);
var deckKey = (DECK === 'full') ? null : DECK;
if (deckKey && E.DECK_ORDER.indexOf(deckKey) < 0) { console.error('unknown deck: ' + deckKey + '  (' + E.DECK_ORDER.join(', ') + ')'); process.exit(1); }
var CONTROL = (ARM_A === ARM_B);

console.log('CONFIG: ' + PAIRS + ' deals x ' + NP + ' rotations (' + (PAIRS * NP) + ' games, ' + NP + ' players)  |  A=' + ARM_A + '  B=' + ARM_B +
            '  |  deck: ' + (deckKey || 'Full Set') + '  |  catch-up ON, loss=chosen, mill=targeted' +
            (CONTROL ? '  |  *** CONTROL — identical arms, must pool to exactly the fair share, ' + (100 / NP).toFixed(2) + ' ***' : ''));

function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

var realRandom = Math.random;
// One game. `arms` holds one arm per seat; returns the winning SEAT, or null if it never terminated.
function playGame(seed, arms) {
  Math.random = mulberry32(seed);                                  // pin the fallback too — see (1) above
  var decks = arms.map(function () { return deckKey; });
  var g = E.newGame(mulberry32(seed ^ 0x5bf03635), { numPlayers: arms.length, decks: decks });
  var guard = 0;
  AI.setArmPolicy(function (p, name) { return !!arms[p].on[name]; });     // per-seat policy, the whole point
  while (!g.finished && guard++ < 200000) AI.takeTurn(g, g.turn, arms[g.turn].tier);
  Math.random = realRandom;
  return g.finished ? g.winner : null;
}

/* EVERY DEAL IS PLAYED ONCE PER SEAT (2026-10-09): arm A on that seat, arm B on all the others. At two players
   this is exactly the old pair (A on seat 0, then on seat 1), so duel measurements are unchanged. The control
   property survives the generalisation: with identical arms every rotation is the same game, so the same seat
   wins all N, and arm A, holding each seat once, wins exactly one in N. A duel-only head-to-head could not see
   a change that matters at a full table: the AI countering its own cast was 2 of 26 Counter Spells in duels and
   114 of 708 at six players. Read the result against the FAIR share, 1/N, not against 50. */
if (AI.resetPolicyStats) AI.resetPolicyStats();
var aWins = 0, decided = 0, unfinished = 0, mismatch = 0, FAIR = 1 / NP;
for (var i = 0; i < PAIRS; i++) {
  var seed = 1000003 * (i + 1) + 17, ws = [];
  for (var r = 0; r < NP; r++) { var arms = []; for (var s = 0; s < NP; s++) arms.push(s === r ? A : B); ws.push(playGame(seed, arms)); }
  var lost = ws.filter(function (w) { return w == null; }).length;
  if (lost) { unfinished += lost; continue; }
  if (CONTROL && ws.some(function (w) { return w !== ws[0]; })) mismatch++;   // identical arms MUST replay identically
  ws.forEach(function (w, rot) { if (w === rot) aWins++; decided++; });      // arm A held seat `rot` in rotation `rot`
}

var share = decided ? (aWins / decided) : 0;
var points = (share - FAIR) * 100;
var sigma  = decided ? (aWins - decided * FAIR) / Math.sqrt(decided * FAIR * (1 - FAIR)) : 0;
console.log('');
console.log('decided games: ' + decided + (unfinished ? '   (' + unfinished + ' never terminated — investigate)' : ''));
console.log(ARM_A + ' wins ' + (share * 100).toFixed(2) + '%' + (NP > 2 ? ' (fair share ' + (FAIR * 100).toFixed(2) + '%)' : '') + '  =  ' + (points >= 0 ? '+' : '') + points.toFixed(2) +
            ' points' + (CONTROL ? '' : ',  ' + (sigma >= 0 ? '+' : '') + sigma.toFixed(2) + 'σ'));
/* (tally) */
/* THE POLICIES' OWN TALLY, because an exact tie on non-identical arms is usually a policy that never FIRED,
   and a win rate cannot say which (CLAUDE.md — the 139-first-casts / 0-second-casts lesson). Summed over BOTH
   arms' seats, so read it as "how often the behaviour was available at all". */
if (AI.policyStats) console.log('policy tally: ' + JSON.stringify(AI.policyStats()));
if (CONTROL) {
  var exact = (Math.abs(points) < 1e-9) && mismatch === 0;
  console.log(mismatch ? ('  ' + mismatch + ' of ' + PAIRS + ' pairs replayed to a DIFFERENT winner — the pairing is broken, ' +
                          'almost certainly an unpinned Math.random somewhere new') : '  every pair replayed identically');
  console.log(exact ? 'CONTROL PASS — the pairing is fair and the run is reproducible.'
                    : 'CONTROL FAIL — do not read any measurement from this build until this prints the fair share.');
  process.exit(exact ? 0 : 1);
}
console.log('  (|σ| under ~2 is noise. The control run — identical arms — must print exactly the fair share first.)');
