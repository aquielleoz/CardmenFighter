/* IS THIS ENGINE SWITCH REAL, PER DECK, AT N PLAYERS? — the PAIRED free-for-all (2026-10-12).
 *
 * `mpsim` deals a random deck to every seat and pins nothing, so one deck's win share moves ~3 points run to
 * run at six players — larger than most effects worth measuring. `rulepair.js` fixes that for a DUEL across two
 * checkouts. This is its in-process sibling for a switch the engine already has: every deal is played TWICE,
 * arm A then arm B, with the deal's rng AND `Math.random` pinned PER GAME, so the two arms see the same
 * shuffle, the same personas and the same tie-breaks until the rules themselves make them differ. A deck's change
 * is then read over the games whose winner FLIPPED: net = (wins gained − wins lost), z = net / √flips, i.e.
 * against flips that are coin tosses — the same statistic `rulepair` reports.
 *
 * RUN THE CONTROL FIRST: `control` plays arm A on both sides and must print 0 flipped games, or the pinning is
 * broken and nothing below means anything. It exits non-zero if not.
 *
 * Usage: node flagpair.js [games=600] [players=6] [a=SPEC] [b=SPEC] [tier=knight] [seed=424242] [control]
 *        node flagpair.js ... flag=recycle          the original form: a=base b=recycle
 *   SPEC is `base` (the shipped game) or rule tokens joined by `+` (2026-10-21, the `loss=all` review):
 *     recycle      spent Techniques go to the Shuffle Pile instead of the Exile (`setRecycleTech`)
 *     lossall      a Special win strikes EVERY rival (`setSpecialLossMode('all')`, the `lossAll` custom rule)
 *     wardall      Leyline, Holy Shroud and Apollo's lock protect the table, not the owner (`setWardAll`)
 *     damageall    Critical Hit / Ultima Attack hit every rival (`setDamageAll`)
 *     damagehalf   ...or ceil(living rivals / 2) of them (`setDamageSpan('half')`)
 *     shp          start shields = 2 + players (`setShieldsPerPlayer`, the reverted v1.31.0 scaling)
 *     shdown       start shields = max(2, 6 − players): 4/3/2/2 at 2/3/4/6 (PATCHNOTES 0k), via newGame's `shields`
 *     sh<k>        start shields = k at every player count, e.g. sh3
 *   e.g. `a=lossall b=lossall+wardall` reads what the ward does to a `loss=all` game.
 * Engine defaults are the LIVE game (`mpsim`'s setup): shields-as-cards, loser mill, loss=chosen, mill=targeted.
 * Every arm is applied IN FULL before each game, so a switch one arm sets can never leak into the other. */
'use strict';
var E = require('./engine.js'), AI = require('./ai.js');
var ARGS = process.argv.slice(2).join(' ');
function opt(name, dflt) { var m = ARGS.match(new RegExp('\\b' + name + '=([a-z0-9+]+)')); return m ? m[1] : dflt; }
var GAMES = +opt('games', 600), P = +opt('players', 6), TIER = opt('tier', 'knight');
var CONTROL = /\bcontrol\b/.test(ARGS);
var LEGACY = opt('flag', null);                                          // flag=X is a=base b=X
var SPEC_A = opt('a', 'base'), SPEC_B = opt('b', LEGACY || (opt('a', null) ? 'base' : 'recycle'));
if (CONTROL) SPEC_B = SPEC_A;
var TOKENS = ['recycle', 'lossall', 'wardall', 'damageall', 'damagehalf', 'shp', 'shdown'];
function parseSpec(s) {
  var c = { recycle: false, lossall: false, wardall: false, damageall: false, damagehalf: false, shp: false, shdown: false, sh: 0 };
  if (s === 'base') return c;
  s.split('+').forEach(function (t) {
    var m = /^sh(\d)$/.exec(t);
    if (m) { c.sh = +m[1]; return; }
    if (TOKENS.indexOf(t) < 0) { console.error('unknown rule token `' + t + '` in `' + s + '` (known: base, ' + TOKENS.join(', ') + ', sh<k>)'); process.exit(2); }
    c[t] = true;
  });
  if (c.damageall && c.damagehalf) { console.error('`' + s + '`: damageall and damagehalf are alternatives'); process.exit(2); }
  if ((c.shp ? 1 : 0) + (c.shdown ? 1 : 0) + (c.sh ? 1 : 0) > 1) { console.error('`' + s + '`: shp, shdown and sh<k> are alternatives'); process.exit(2); }
  return c;
}
var CFG_A = parseSpec(SPEC_A), CFG_B = parseSpec(SPEC_B);
if (!(P >= 2 && P <= 6)) { console.error('players must be 2-6'); process.exit(2); }

E.setShieldCards(true); E.setLoserMill(true);
E.setMillScope('targeted');
function apply(c) {
  E.setRecycleTech(c.recycle);
  E.setSpecialLossMode(c.lossall ? 'all' : 'chosen');
  E.setWardAll(c.wardall);
  E.setDamageAll(c.damageall);
  E.setDamageSpan(c.damagehalf ? 'half' : 1);
  E.setShieldsPerPlayer(c.shp);
}
function shieldsOpt(c, n) { return c.shdown ? Math.max(2, 6 - n) : (c.sh || null); }   // null = the engine's own count
function gameOpts(c, n, decks) { var o = { numPlayers: n }; if (decks) o.decks = decks; var s = shieldsOpt(c, n); if (s != null) o.shields = s; return o; }

function mulberry32(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var pinA = 0;
Math.random = function () { pinA |= 0; pinA = pinA + 0x6D2B79F5 | 0; var t = Math.imul(pinA ^ pinA >>> 15, 1 | pinA); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* SELF-CHECK — every switch must change BEHAVIOUR, not merely accept a value (mpsim's rule), and it is run for
 * BOTH arms: an arm whose engine state did not match its spec is the 2026-08-25 failure, where every arm of two
 * studies silently ran the same rules. The loss, ward and damage probes are mpsim's, at 4 players because a
 * duel cannot tell one rival from all of them. */
function probe(c) {
  apply(c);
  var mk = function (r, su) { return { rank: r, suit: su, id: 'chk' + r + su }; }, i, out = {};
  // recycle: cast a Technique and read where the spent card went
  var g = E.newGame(mulberry32(7), gameOpts(c, P)), me = g.players[0];
  g.round = 3; g.turn = 0; g.pile = null;
  me.hand = [mk(1, 'D'), mk(9, 'C')]; me.energy = [mk(3, 'D'), mk(4, 'D')];
  var r = E.activate(g, 0, 'chk1D', {});
  while (g.respondFor != null) E.declineResponse(g, g.respondFor);
  out.recycle = !!(r && r.ok) && me.shuffle.some(function (x) { return x.id === 'chk1D'; }) && !me.removed.some(function (x) { return x.id === 'chk1D'; });
  out.cast = !!(r && r.ok);
  // shields: the count every seat starts the game on, at the run's player count
  out.shields = E.newGame(mulberry32(7), gameOpts(c, P)).players[0].shields;
  // loss: seat 0 wins a Special at 4 players — how many rivals lose a shield?
  var lg = E.newGame(null, gameOpts(c, 4));
  lg.round = 3; lg.pile = null; lg.turn = 0; lg.passes = 0;
  lg.players[0].hand = [mk(9, 'H'), mk(9, 'D')];
  for (i = 1; i < 4; i++) lg.players[i].hand = [mk(3, 'S')];
  var lb = [1, 2, 3].map(function (q) { return lg.players[q].shields; });
  E.play(lg, 0, [mk(9, 'H'), mk(9, 'D')]);
  for (i = 1; i < 4 && !lg.finished; i++) { if (lg.turn === i) E.pass(lg, i); }
  while (lg.respondFor != null) E.declineResponse(lg, lg.respondFor);
  if (lg.pendingLossChoice) E.chooseLossTarget(lg, lg.pendingLossChoice.cands ? lg.pendingLossChoice.cands[0] : 1);
  out.struck = [1, 2, 3].filter(function (q, k) { return lg.players[q].shields < lb[k]; }).length;
  // damage: Critical Hit at 4 players — how many rivals lose a shield?
  var hg = E.newGame(null, gameOpts(c, 4));
  hg.round = 3; hg.turn = 0; hg.pile = null;
  hg.players[0].hand = [mk(9, 'S'), mk(13, 'S'), mk(5, 'S'), mk(6, 'S')];
  hg.players[0].energy = []; for (i = 0; i < 9; i++) hg.players[0].energy.push(mk(4, 'S'));
  var hb = [1, 2, 3].map(function (q) { return hg.players[q].shields; });
  E.activate(hg, 0, 'chk9S', { target: 1, pitch: 'chk13S' });
  while (hg.respondFor != null) E.declineResponse(hg, hg.respondFor);
  out.hit = [1, 2, 3].filter(function (q, k) { return hg.players[q].shields < hb[k]; }).length;
  // ward: one Leyline at 4 players — how many players does it protect?
  var wg = E.newGame(null, gameOpts(c, 4));
  wg.round = 3; wg.turn = 0; wg.pile = null;
  wg.players[0].hand = [mk(9, 'D'), mk(5, 'C')];
  wg.players[0].energy = []; for (i = 0; i < 14; i++) wg.players[0].energy.push(mk(4, 'D'));
  E.activate(wg, 0, 'chk9D', {});
  while (wg.respondFor != null) E.declineResponse(wg, wg.respondFor);
  out.warded = [0, 1, 2, 3].filter(function (q) { return !!wg.players[q].cantLoseRound; }).length;
  return out;
}
function expect(c) {
  /* The shield count is restated here rather than read from `shieldsOpt`: an expectation computed by the code
   * it checks agrees with that code by construction, and a mutant that broke `shdown` passed until it was. */
  return { recycle: c.recycle, cast: true, shields: c.shp ? 2 + P : (c.shdown ? Math.max(2, 6 - P) : (c.sh || 4)), struck: c.lossall ? 3 : 1,
           hit: c.damageall ? 3 : (c.damagehalf ? 2 : 1), warded: c.wardall ? 4 : 1 };
}
(function selfCheck() {
  var bad = false;
  [['A', SPEC_A, CFG_A], ['B', SPEC_B, CFG_B]].forEach(function (arm) {
    var got = probe(arm[2]), want = expect(arm[2]), keys = Object.keys(want);
    var miss = keys.filter(function (k) { return got[k] !== want[k]; });
    console.log('SELF-CHECK arm ' + arm[0] + ' (' + arm[1] + '): ' + keys.map(function (k) { return k + '=' + got[k]; }).join(' ') +
                (miss.length ? '   *** expected ' + miss.map(function (k) { return k + '=' + want[k]; }).join(' ') : '   ok'));
    if (miss.length) bad = true;
  });
  apply(CFG_A);
  if (bad) { console.log('*** SELF-CHECK FAILED — an arm did not take effect. These numbers would be worthless. ***'); process.exit(3); }
})();

var POOL = [null].concat(E.DECK_ORDER);
function label(k) { return k === null ? 'Full Set' : E.DECKS[k].name; }
function play(keys, seed, gn, c) {
  apply(c);
  pinA = Math.imul(gn, 0x9E3779B1) | 0;                                   // the per-game pin, identical in both arms
  var g = E.newGame(mulberry32(seed), gameOpts(c, P, keys));
  g._diff = {}; for (var i = 0; i < P; i++) g._diff[i] = TIER;
  var guard = 0;
  while (!g.finished) { if (++guard > 500000) throw new Error('no terminate'); AI.takeTurn(g, g.turn, TIER); }
  return { winner: g.winner, rounds: g.round };
}

console.log('CONFIG: games=' + GAMES + ' players=' + P + ' seed=' + +opt('seed', 424242) + ' tier=' + TIER + ' a=' + SPEC_A + ' b=' + SPEC_B + (CONTROL ? ' CONTROL (arm A on both sides)' : ''));
var SEED = +opt('seed', 424242), deal = mulberry32(SEED), stat = {}, flippedGames = 0, roundsA = [], roundsB = [], t0 = Date.now();
POOL.forEach(function (k) { stat[label(k)] = { n: 0, wA: 0, wB: 0, gain: 0, loss: 0 }; });
for (var gn = 1; gn <= GAMES; gn++) {
  var keys = []; for (var s = 0; s < P; s++) keys.push(POOL[Math.floor(deal() * POOL.length)]);
  var seed = SEED * 7919 + gn;
  var a = play(keys, seed, gn, CFG_A), b = play(keys, seed, gn, CFG_B);
  roundsA.push(a.rounds); roundsB.push(b.rounds);
  if (a.winner !== b.winner) flippedGames++;
  for (var q = 0; q < P; q++) {
    var st = stat[label(keys[q])], wa = a.winner === q ? 1 : 0, wb = b.winner === q ? 1 : 0;
    st.n++; st.wA += wa; st.wB += wb; if (wb > wa) st.gain++; if (wa > wb) st.loss++;
  }
}
apply(parseSpec('base'));
function median(xs) { var s = xs.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }
function mean(xs) { return xs.reduce(function (t, x) { return t + x; }, 0) / (xs.length || 1); }
var fair = 100 / P, rows = Object.keys(stat).map(function (L) { var s = stat[L]; return { L: L, s: s, net: s.gain - s.loss, flips: s.gain + s.loss, pa: s.n ? 100 * s.wA / s.n : 0, pb: s.n ? 100 * s.wB / s.n : 0 }; });
function spread(k) { var v = rows.filter(function (r) { return r.s.n; }).map(function (r) { return r[k]; }); return Math.max.apply(null, v) - Math.min.apply(null, v); }
console.log('\n' + P + '-player free-for-all, ' + GAMES + ' paired games (' + Math.round((Date.now() - t0) / 1000) + 's) · fair win share ' + fair.toFixed(1) + '%');
console.log('games whose winner flipped: ' + flippedGames + ' of ' + GAMES + ' · median rounds ' + median(roundsA) + ' → ' + median(roundsB) +
            ' · mean ' + mean(roundsA).toFixed(1) + ' → ' + mean(roundsB).toFixed(1) + ' · deck spread ' + spread('pa').toFixed(1) + ' → ' + spread('pb').toFixed(1));
console.log('deck                    seats     win% A    win% B    net  flips      z');
rows.sort(function (x, y) { return y.pa - x.pa; })
  .forEach(function (r) {
    var s = r.s, z = r.flips ? r.net / Math.sqrt(r.flips) : 0;
    console.log(r.L.padEnd(22) + String(s.n).padStart(7) + (r.pa.toFixed(1) + '%').padStart(11) + (r.pb.toFixed(1) + '%').padStart(10) +
      ((r.net >= 0 ? '+' : '') + r.net).padStart(7) + String(r.flips).padStart(7) + ((z >= 0 ? '+' : '') + z.toFixed(2)).padStart(7));
  });
if (CONTROL) {
  if (flippedGames !== 0) { console.log('\n*** CONTROL FAILED — identical arms flipped ' + flippedGames + ' games; the pairing is broken. ***'); process.exit(4); }
  console.log('\nCONTROL OK — identical arms flipped 0 games, so every flip in a real run is the switch.');
}
