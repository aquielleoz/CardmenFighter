/* IS THIS ENGINE SWITCH REAL, PER DECK, AT N PLAYERS? — the PAIRED free-for-all (2026-10-12).
 *
 * `mpsim` deals a random deck to every seat and pins nothing, so one deck's win share moves ~3 points run to
 * run at six players — larger than most effects worth measuring. `rulepair.js` fixes that for a DUEL across two
 * checkouts. This is its in-process sibling for a switch the engine already has: every deal is played TWICE,
 * switch off then switch on, with the deal's rng AND `Math.random` pinned PER GAME, so the two arms see the same
 * shuffle, the same personas and the same tie-breaks until the switch itself makes them differ. A deck's change
 * is then read over the games whose winner FLIPPED: net = (wins gained − wins lost), z = net / √flips, i.e.
 * against flips that are coin tosses — the same statistic `rulepair` reports.
 *
 * RUN THE CONTROL FIRST: `control` plays both arms with the switch OFF and must print 0 flipped games, or the
 * pinning is broken and nothing below means anything. It exits non-zero if not.
 *
 * Usage: node flagpair.js [games=600] [players=6] [flag=recycle] [tier=knight] [seed=424242] [control]
 *   flag=recycle   spent Techniques go to the Shuffle Pile instead of the Exile (`setRecycleTech`)
 * Engine defaults are the LIVE game (`mpsim`'s setup): shields-as-cards, loser mill, loss=chosen, mill=targeted. */
'use strict';
var E = require('./engine.js'), AI = require('./ai.js');
var ARGS = process.argv.slice(2).join(' ');
function opt(name, dflt) { var m = ARGS.match(new RegExp('\\b' + name + '=([a-z0-9]+)')); return m ? m[1] : dflt; }
var GAMES = +opt('games', 600), P = +opt('players', 6), FLAG = opt('flag', 'recycle'), TIER = opt('tier', 'knight');
var CONTROL = /\bcontrol\b/.test(ARGS);
var SWITCHES = { recycle: function (on) { E.setRecycleTech(on); } };
if (!SWITCHES[FLAG]) { console.error('unknown flag=' + FLAG + ' (known: ' + Object.keys(SWITCHES).join(', ') + ')'); process.exit(2); }
if (!(P >= 2 && P <= 6)) { console.error('players must be 2-6'); process.exit(2); }

E.setShieldCards(true); E.setLoserMill(true);
E.setSpecialLossMode('chosen'); E.setMillScope('targeted');

function mulberry32(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
var pinA = 0;
Math.random = function () { pinA |= 0; pinA = pinA + 0x6D2B79F5 | 0; var t = Math.imul(pinA ^ pinA >>> 15, 1 | pinA); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };

/* SELF-CHECK — the switch must change BEHAVIOUR, not merely accept a value (mpsim's rule). Cast a Technique and
 * read where the spent card went. */
(function selfCheck() {
  function where(on) {
    SWITCHES[FLAG](on);
    var g = E.newGame(mulberry32(7), { numPlayers: P }), me = g.players[0];
    g.round = 3; g.turn = 0; g.pile = null;
    me.hand = [{ rank: 1, suit: 'D', id: 'chk1D' }, { rank: 9, suit: 'C', id: 'chk9C' }];
    me.energy = [{ rank: 3, suit: 'D', id: 'chkE1' }, { rank: 4, suit: 'D', id: 'chkE2' }];
    var r = E.activate(g, 0, 'chk1D', {});
    while (g.respondFor != null) E.declineResponse(g, g.respondFor);
    return { ok: !!(r && r.ok), exile: me.removed.some(function (c) { return c.id === 'chk1D'; }), shuffle: me.shuffle.some(function (c) { return c.id === 'chk1D'; }) };
  }
  var off = where(false), on = where(true); SWITCHES[FLAG](false);
  console.log('SELF-CHECK (' + FLAG + '): off → ' + (off.exile ? 'Exile' : off.shuffle ? 'Shuffle Pile' : '?') + ', on → ' + (on.exile ? 'Exile' : on.shuffle ? 'Shuffle Pile' : '?'));
  if (!(off.ok && on.ok && off.exile && !off.shuffle && on.shuffle && !on.exile)) { console.log('*** SELF-CHECK FAILED — the switch did not take effect. ***'); process.exit(3); }
})();

var POOL = [null].concat(E.DECK_ORDER);
function label(k) { return k === null ? 'Full Set' : E.DECKS[k].name; }
function play(keys, seed, gn, on) {
  SWITCHES[FLAG](on);
  pinA = Math.imul(gn, 0x9E3779B1) | 0;                                   // the per-game pin, identical in both arms
  var g = E.newGame(mulberry32(seed), { numPlayers: P, decks: keys });
  g._diff = {}; for (var i = 0; i < P; i++) g._diff[i] = TIER;
  var guard = 0;
  while (!g.finished) { if (++guard > 500000) throw new Error('no terminate'); AI.takeTurn(g, g.turn, TIER); }
  return { winner: g.winner, rounds: g.round };
}

console.log('CONFIG: games=' + GAMES + ' players=' + P + ' seed=' + +opt('seed', 424242) + ' flag=' + FLAG + ' tier=' + TIER + (CONTROL ? ' CONTROL (both arms OFF)' : ' (arm A off, arm B on)'));
var SEED = +opt('seed', 424242), deal = mulberry32(SEED), stat = {}, flippedGames = 0, roundsA = [], roundsB = [], t0 = Date.now();
POOL.forEach(function (k) { stat[label(k)] = { n: 0, wA: 0, wB: 0, gain: 0, loss: 0 }; });
for (var gn = 1; gn <= GAMES; gn++) {
  var keys = []; for (var s = 0; s < P; s++) keys.push(POOL[Math.floor(deal() * POOL.length)]);
  var seed = SEED * 7919 + gn;
  var a = play(keys, seed, gn, false), b = play(keys, seed, gn, CONTROL ? false : true);
  roundsA.push(a.rounds); roundsB.push(b.rounds);
  if (a.winner !== b.winner) flippedGames++;
  for (var q = 0; q < P; q++) {
    var st = stat[label(keys[q])], wa = a.winner === q ? 1 : 0, wb = b.winner === q ? 1 : 0;
    st.n++; st.wA += wa; st.wB += wb; if (wb > wa) st.gain++; if (wa > wb) st.loss++;
  }
}
SWITCHES[FLAG](false);
function median(xs) { var s = xs.slice().sort(function (x, y) { return x - y; }); return s.length ? s[Math.floor(s.length / 2)] : 0; }
var fair = 100 / P;
console.log('\n' + P + '-player free-for-all, ' + GAMES + ' paired games (' + Math.round((Date.now() - t0) / 1000) + 's) · fair win share ' + fair.toFixed(1) + '%');
console.log('games whose winner flipped: ' + flippedGames + ' of ' + GAMES + ' · median rounds ' + median(roundsA) + ' → ' + median(roundsB));
console.log('deck                    seats   win% off   win% on    net  flips      z');
Object.keys(stat).map(function (L) { var s = stat[L]; return { L: L, s: s, net: s.gain - s.loss, flips: s.gain + s.loss }; })
  .sort(function (x, y) { return (y.s.wA / (y.s.n || 1)) - (x.s.wA / (x.s.n || 1)); })
  .forEach(function (r) {
    var s = r.s, z = r.flips ? r.net / Math.sqrt(r.flips) : 0;
    console.log(r.L.padEnd(22) + String(s.n).padStart(7) + ((s.n ? 100 * s.wA / s.n : 0).toFixed(1) + '%').padStart(11) + ((s.n ? 100 * s.wB / s.n : 0).toFixed(1) + '%').padStart(10) +
      ((r.net >= 0 ? '+' : '') + r.net).padStart(7) + String(r.flips).padStart(7) + ((z >= 0 ? '+' : '') + z.toFixed(2)).padStart(7));
  });
if (CONTROL) {
  if (flippedGames !== 0) { console.log('\n*** CONTROL FAILED — identical arms flipped ' + flippedGames + ' games; the pairing is broken. ***'); process.exit(4); }
  console.log('\nCONTROL OK — identical arms flipped 0 games, so every flip in a real run is the switch.');
}
