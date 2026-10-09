// FORCESIM — A FORCED-POSITION A/B FOR ONE AI DECISION THAT REAL GAMES NEVER REACH (2026-10-09).
//
// THE QUESTION IT ANSWERS: should an AI seat answer a strike card (Critical Hit / Ultima Attack) aimed at it with
// Sanctuary under HECTOR — the Form that makes Sanctuary a Quick without making it immunity? The shipped AI does not
// (`respondDecision` picks with `immunityEffFor`), and the board never arises naturally: 0 times in ~9,600 AI games,
// because by the time an AI holds Hector it nearly always holds the Jack and Queen too, and Apollo's Sanctuary IS
// immunity. So `strengthsim` cannot see it — the arms never diverge. This FORCES the board instead:
//   1. play a real game until a strike card is aimed at an AI seat on 1-2 shields (the branch's own condition);
//   2. right after the cast, before anyone answers, give that seat Hector (only if that does not complete Apollo),
//      an affordable Sanctuary, and the energy for it;
//   3. play the SAME game twice from that position: arm B is the shipped AI, arm A answers the forced strike with
//      the Sanctuary at the seat's FIRST action on it, whatever that action was — which is exactly what widening
//      the strike answer would do, since that branch runs before the Counter Spell one. Substituted HERE, so
//      `ai.js` carries no switch for an unshipped behaviour;
//   4. compare how the forced seat finishes — wins (paired, McNemar), placing, turns survived — overall and split
//      by what the shipped AI did instead: Counter Spell, or take the hit.
// Math.random and the engine rng are pinned per deal, so the two arms are the same game up to that one decision;
// a CONTROL replays arm B and must match exactly, or the result is not to be read.
// THE ANSWER IS IN DECISIONS.md#ai-strength: it loses. Re-run it if Sanctuary's text changes — "every player gains
// 1 shield" is what makes the answer cost.
//
// usage: node forcesim.js <players 2-6> <deals> [tier]
var E = require('./engine.js'), AI = require('./ai.js');
var NP = +process.argv[2] || 6, DEALS = +process.argv[3] || 1000, TIER = process.argv[4] || 'knight';
if (!(NP >= 2 && NP <= 6) || !(DEALS > 0)) { console.error('usage: node forcesim.js <players 2-6> <deals> [tier]'); process.exit(1); }
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var realRandom = Math.random, LEY = { rank: 9, suit: 'D', id: 'probeLeyline' };   // Leyline as a probe card: stakeFor says whom a strike is aimed at
var forcing = false, armA = false, staged = null, substituted = false, instead = null;

var origActivate = E.activate;
E.activate = function (st, p, id, opts) {                          // the cast opens the window; force the board before anyone answers
  var r = origActivate.apply(this, arguments);
  if (!forcing || staged || !r || !r.ok || !r.pending) return r;
  var top = st.pending; if (!top || !top.eff || top.eff.kind !== 'destroyShield') return r;
  for (var q = 0; q < st.numPlayers; q++) {
    if (q === p) continue; var qp = st.players[q];
    if (qp.eliminated || qp.shields < 1 || qp.shields > 2) continue;
    if (!E.stakeFor(st, q, LEY, 'respond')) continue;              // the strike is not aimed at q
    var tiers = {}; (qp.forms || []).forEach(function (f) { tiers[f.tier] = 1; });
    if (tiers.king || (tiers.ride && tiers.queen)) { staged = { skip: 'king-or-apollo' }; return r; }   // Hector would not be "alone"
    if (qp.hand.some(function (c) { return E.immunityEffFor(st, q, c) && E.canAfford(qp, c); })) { staged = { skip: 'holds-immunity' }; return r; }   // both arms would answer alike
    qp.forms = (qp.forms || []).concat([{ rank: 13, suit: 'H', tier: 'king', name: 'Hector Form', card: { rank: 13, suit: 'H', id: 'forcedK' } }]);
    var sanct = { rank: 10, suit: 'H', id: 'forcedSanct' };
    qp.hand = E.sortHand(qp.hand.concat([sanct]));
    for (var i = 0; i < 10; i++) qp.energy.push({ rank: 3, suit: 'H', id: 'forcedE' + i });
    var ok = !!E.lossAnswerFor(st, q, sanct) && E.canAfford(qp, sanct) && !E.immunityEffFor(st, q, sanct) && !!E.stakeFor(st, q, sanct, 'respond');
    staged = { q: q, ok: ok, oid: top.oid, round: st.round, shields: qp.shields };
    return r;
  }
  return r;
};
function atForced(st, q) { return armA && staged && !staged.skip && !substituted && q === staged.q && st.pending && st.pending.oid === staged.oid; }
var origRespond = E.respond, origDecline = E.declineResponse;
E.respond = function (st, q, id) {                                 // arm A: whatever the seat reaches for first, it plays the Sanctuary
  if (id !== 'forcedSanct' && atForced(st, q)) {
    var c = st.players[q].hand.filter(function (x) { return x.id === id; })[0];
    var r = origRespond.call(this, st, q, 'forcedSanct');
    if (r && r.ok) { substituted = true; instead = c ? ((E.effectOf(c) || {}).name || id) : id; return r; }
  }
  return origRespond.apply(this, arguments);
};
E.declineResponse = function (st, q) {
  if (atForced(st, q)) {
    var r = origRespond.call(this, st, q, 'forcedSanct');
    if (r && r.ok) { substituted = true; instead = 'took the hit'; return r; }
  }
  return origDecline.apply(this, arguments);
};

function play(seed, a) {
  Math.random = mulberry32(seed); armA = a; staged = null; substituted = false; instead = null; forcing = true;
  var g = E.newGame(mulberry32(seed ^ 0x5bf03635), { numPlayers: NP }), guard = 0, out = {}, step = 0;
  while (!g.finished && guard++ < 200000) {
    AI.takeTurn(g, g.turn, TIER); step++;
    g.players.forEach(function (pl, s) { if (pl.eliminated && out[s] == null) out[s] = step; });
  }
  Math.random = realRandom; forcing = false;
  return { done: g.finished, winner: g.winner, staged: staged, out: out, steps: step, answered: substituted, instead: instead };
}
function rankOf(res, q) {                                          // 1 = won; otherwise 1 + the seats that outlasted q
  if (res.winner === q) return 1;
  var mine = res.out[q] == null ? Infinity : res.out[q], better = 0;
  for (var s = 0; s < NP; s++) { if (s === q) continue; var t = res.out[s] == null ? Infinity : res.out[s]; if (t > mine || s === res.winner) better++; }
  return 1 + better;
}

var positions = 0, notReached = 0, skips = {}, badStage = 0, mismatch = 0, unfinished = 0, controlRuns = 0;
function bucket() { return { n: 0, winA: 0, winB: 0, onlyA: 0, onlyB: 0, rankSum: 0, rankSq: 0, rankUp: 0, rankDown: 0, survSum: 0, survSq: 0 }; }
var ALL = bucket(), BY = {};
for (var i = 0; i < DEALS; i++) {
  var seed = 7919 * (i + 1) + 31;
  var B = play(seed, false);
  if (!B.staged || B.staged.skip) { if (B.staged) skips[B.staged.skip] = (skips[B.staged.skip] || 0) + 1; else notReached++; continue; }
  if (!B.staged.ok) { badStage++; continue; }
  if (controlRuns < 40) { var B2 = play(seed, false); controlRuns++; if (B2.winner !== B.winner || JSON.stringify(B2.out) !== JSON.stringify(B.out)) mismatch++; }
  var A = play(seed, true);
  if (!A.staged || A.staged.q !== B.staged.q || A.staged.round !== B.staged.round) { mismatch++; continue; }   // must be the same position
  if (!A.done || !B.done) { unfinished++; continue; }
  positions++;
  if (!A.answered) continue;                                       // the forced seat never got to decline it (someone answered first)
  var q = B.staged.q, wa = A.winner === q, wb = B.winner === q;
  var d = rankOf(B, q) - rankOf(A, q);                             // > 0: answering placed HIGHER
  var sv = (A.out[q] == null ? A.steps : A.out[q]) - (B.out[q] == null ? B.steps : B.out[q]);
  [ALL, BY[A.instead] || (BY[A.instead] = bucket())].forEach(function (b) {
    b.n++; if (wa) b.winA++; if (wb) b.winB++; if (wa && !wb) b.onlyA++; if (wb && !wa) b.onlyB++;
    b.rankSum += d; b.rankSq += d * d; if (d > 0) b.rankUp++; if (d < 0) b.rankDown++; b.survSum += sv; b.survSq += sv * sv;
  });
}
function meanSe(sum, sq, n) { var m = n ? sum / n : 0, sd = n > 1 ? Math.sqrt(Math.max(0, (sq - n * m * m) / (n - 1))) : 0; return { m: m, se: n ? sd / Math.sqrt(n) : 0 }; }
function pct(x, n) { return n ? (100 * x / n).toFixed(2) + '%' : '–'; }
console.log('CONFIG: ' + NP + ' players, ' + DEALS + ' deals, tier ' + TIER + ', Full Set  |  forced at the first strike aimed at a seat on 1-2 shields: Hector alone + an affordable Sanctuary');
console.log('positions ' + positions + ' · the forced seat acted on the strike in ' + ALL.n + ' · skipped ' + JSON.stringify(skips) + ' · no such strike ' + notReached + ' · bad staging ' + badStage + ' · unfinished ' + unfinished);
console.log('control: ' + controlRuns + ' replays of arm B, ' + mismatch + ' mismatches' + (mismatch ? '  ← DO NOT READ THE RESULT' : ' — the arms are the same game up to the decision'));
function report(label, b) {
  var rk = meanSe(b.rankSum, b.rankSq, b.n), sv = meanSe(b.survSum, b.survSq, b.n), z = (b.onlyA + b.onlyB) ? (b.onlyA - b.onlyB) / Math.sqrt(b.onlyA + b.onlyB) : 0;
  console.log(label + ' (' + b.n + '): won answering ' + pct(b.winA, b.n) + ' vs shipped ' + pct(b.winB, b.n) + ' (only by answering ' + b.onlyA + ', only shipped ' + b.onlyB + ', z ' + z.toFixed(2) + ')' +
              ' · placing ' + (rk.m >= 0 ? '+' : '') + rk.m.toFixed(3) + ' ± ' + rk.se.toFixed(3) + ' · survival ' + (sv.m >= 0 ? '+' : '') + sv.m.toFixed(2) + ' ± ' + sv.se.toFixed(2) + ' turns');
}
report('ALL', ALL);
Object.keys(BY).sort().forEach(function (k) { report('  instead of ' + k, BY[k]); });
process.exit(mismatch ? 1 : 0);
