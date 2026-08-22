/* v0.22 full analysis — deck standings (round-robin) + per-card performance.
 * Strict suit-cost, effects + interrupts on. Two questions:
 *   1. Which DECKS perform well?  → round-robin: every deck vs every other, starter
 *      alternated to neutralize initiative; rank by overall win%.
 *   2. Which CARDS perform well?  → aggregated over every game: how often a card is
 *      cast when it's available (throughput under strict) and its win correlation. */
var E = require('./engine.js');
var AI = require('./ai.js');

var N = parseInt(process.argv[2], 10) || 200;   // games per ordered matchup
// Catch-up (M1 shields-as-cards + M2 loser-mill) is ON in the shipped game but defaults OFF in headless —
// enable it here so the standings reflect what people actually play. `node analysis.js N off` compares without.
var CATCHUP = (process.argv[3] || 'on').toLowerCase() !== 'off';
if (E.setShieldCards) E.setShieldCards(CATCHUP);
if (E.setLoserMill) E.setLoserMill(CATCHUP);
// 4th arg 'recycle' → used Techniques/STOPPERs go to the Shuffle Pile instead of exiling (experiment).
var RECYCLE = (process.argv[4] || '').toLowerCase() === 'recycle';
if (E.setRecycleTech) E.setRecycleTech(RECYCLE);
// 5th arg = AI difficulty for both seats (default 'knight' = the historical top-tier behavior all prior balance
// runs used; 'demon' is the smartest tier with apex-hoarding, which would skew per-card jab stats).
// (The game is always the 2-apex + Forms rework now — the old rework flag is retired.)
var DIFF = (process.argv[5] || 'knight').toLowerCase();
var SF_ON = process.env.SF === '1';   // straight flushes are OFF in the shipped game; set SF=1 to A/B them back on
if (E.setNoStraightFlush) E.setNoStraightFlush(!SF_ON);
console.log('catch-up: ' + (CATCHUP ? 'ON (M1+M2)' : 'off') + '  |  techniques: ' + (RECYCLE ? 'RECYCLE (no exile)' : 'exile') + '  |  AI: ' + DIFF + '  |  straight-flush: ' + (SF_ON ? 'ON (A/B)' : 'disabled'));
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

// deck roster: Full Set + 4 pures + 6 duals
var DECKS = [null].concat(E.DECK_ORDER);
function label(k) { return k === null ? 'Full Set' : E.DECKS[k].name; }
function suitsOf(k) { return k === null ? ['C', 'D', 'H', 'S'] : E.DECKS[k].bases.map(function (b) { return E.BASE_SUIT[b]; }); }

// card catalog (proactive impl effects; quicks tracked separately as responses)
var CATALOG = {}, SUIT_PROACTIVE = { C: [], D: [], H: [], S: [] };
['C', 'D', 'H', 'S'].forEach(function (s) {
  for (var r = 1; r <= 13; r++) {   // 1..13 so REWORK's J/Q/K Rides/Forms (11/12/13, kind 'transform') are tracked too
    var ef = E.effectOf({ suit: s, rank: r, id: r + s });
    if (ef && ef.impl) { CATALOG[ef.id] = { id: ef.id, name: ef.name, arch: ef.archetype, cost: ef.cost, kind: ef.kind, quick: ef.quick, suit: s }; if (!ef.quick) SUIT_PROACTIVE[s].push(ef.id); }
  }
});

// tallies
var deckWins = {}, deckGames = {}, deckRounds = {}, deckCasts = {};
DECKS.forEach(function (k) { var L = label(k); deckWins[L] = 0; deckGames[L] = 0; deckRounds[L] = 0; deckCasts[L] = 0; });
var card = {};                 // id -> { acts, avail, winUsed, loseUsed }
function C(id) { return card[id] || (card[id] = { acts: 0, avail: 0, winUsed: 0, loseUsed: 0 }); }
var respByKind = { counter: 0, protect: 0 };

var seedBase = 1;
function playGame(kA, kB, seed) {
  var rng = mulberry32(seed);
  var g = E.newGame(rng, { starter: seed % 2, decks: [kA, kB] });
  var sA = suitsOf(kA), sB = suitsOf(kB), suits = [sA, sB];
  var used = [{}, {}];
  var guard = 0;
  while (!g.finished) {
    if (++guard > 300000) throw new Error('no terminate');
    var p = g.turn;
    var log = AI.takeTurn(g, p, DIFF);
    log.forEach(function (e) {
      if (e.play && e.card) { var ef = E.effectOf(e.card); if (ef) { C(ef.id).acts++; used[p][ef.id] = true; } }
      if (e.respond) { if (e.countered) respByKind.counter++; else respByKind.protect++; }
    });
  }
  // availability: each proactive card is "available" to a player whose deck holds its suit
  [0, 1].forEach(function (p) { suits[p].forEach(function (s) { SUIT_PROACTIVE[s].forEach(function (id) { C(id).avail++; }); }); });
  var w = g.winner, l = w === 0 ? 1 : 0;
  Object.keys(used[w]).forEach(function (id) { C(id).winUsed++; });
  Object.keys(used[l]).forEach(function (id) { C(id).loseUsed++; });
  return { winner: w, rounds: g.round, castW: Object.keys(used[w]).length };
}

// round-robin (unordered pairs incl. mirrors excluded from standings but kept for card data)
var pairSeed = 1;
for (var i = 0; i < DECKS.length; i++) {
  for (var j = i; j < DECKS.length; j++) {
    var isMirror = (i === j);
    var LA = label(DECKS[i]), LB = label(DECKS[j]);
    for (var n = 0; n < N; n++) {
      var res = playGame(DECKS[i], DECKS[j], pairSeed++);
      // card stats always accumulate; standings skip mirrors (they're 50% by symmetry)
      if (!isMirror) {
        deckGames[LA]++; deckGames[LB]++;
        deckRounds[LA] += res.rounds; deckRounds[LB] += res.rounds;
        if (res.winner === 0) deckWins[LA]++; else deckWins[LB]++;
      }
    }
  }
}

function pct(x) { return (100 * x).toFixed(1); }
function pad(s, n) { s = '' + s; while (s.length < n) s += ' '; return s; }
function padL(s, n) { s = '' + s; while (s.length < n) s = ' ' + s; return s; }

// ---- DECK STANDINGS ----
console.log('=== DECK STANDINGS — strict cost — round-robin, ' + N + ' games/matchup ===\n');
var standings = DECKS.map(function (k) { var L = label(k); return { L: L, w: deckWins[L], g: deckGames[L], wr: deckGames[L] ? deckWins[L] / deckGames[L] : 0, rnd: deckGames[L] ? deckRounds[L] / deckGames[L] : 0, suits: suitsOf(k).length }; });
standings.sort(function (a, b) { return b.wr - a.wr; });
console.log(pad('rank  deck', 26) + padL('win%', 7) + padL('games', 8) + padL('avg rounds', 12) + padL('type', 7));
standings.forEach(function (r, idx) {
  var type = r.suits === 4 ? 'full' : (r.suits === 1 ? 'pure' : 'dual');
  console.log(pad('#' + (idx + 1) + '  ' + r.L, 26) + padL(pct(r.wr), 7) + padL(r.g, 8) + padL(r.rnd.toFixed(1), 12) + padL(type, 7));
});

// ---- CARD PERFORMANCE ----
console.log('\n=== CARD PERFORMANCE — strict cost — all ' + Object.values(deckGames).reduce(function (a, b) { return a + b; }, 0) / 2 + '+ games ===');
console.log('castRate = activations per game the card was available (throughput); win% = win rate of players who used it (base 50%).\n');
var rows = Object.keys(CATALOG).filter(function (id) { return !CATALOG[id].quick; }).map(function (id) {
  var c = CATALOG[id], d = card[id] || { acts: 0, avail: 0, winUsed: 0, loseUsed: 0 };
  var gamesUsed = d.winUsed + d.loseUsed;
  return { id: id, name: c.name, arch: c.arch, cost: c.cost, kind: c.kind, castRate: d.avail ? d.acts / d.avail : 0, winPct: gamesUsed ? d.winUsed / gamesUsed : 0, used: gamesUsed };
});
rows.sort(function (a, b) { if (a.arch !== b.arch) return a.arch < b.arch ? -1 : 1; return a.cost - b.cost; });
console.log(pad('id', 4) + pad('name', 22) + pad('archetype', 11) + padL('cost', 5) + padL('castRate', 10) + padL('win%', 8) + '  kind');
rows.forEach(function (r) {
  console.log(pad(r.id, 4) + pad(r.name.slice(0, 21), 22) + pad(r.arch, 11) + padL(r.cost, 5) + padL(r.castRate.toFixed(2), 10) + padL(r.used ? pct(r.winPct) : '—', 8) + '  ' + r.kind);
});
console.log('\nQuick responses across all games: ' + (respByKind.counter + respByKind.protect) + ' (Counter Spell ' + respByKind.counter + ' / Emergency Maintenance ' + respByKind.protect + ').');
