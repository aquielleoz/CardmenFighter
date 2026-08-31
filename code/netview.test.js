/* Tests for netview.js — the per-seat redacted snapshot AND the full seat-rotated mirror. Run: node netview.test.js */
var E = require('./engine.js');
var AI = require('./ai.js');
var NV = require('./netview.js');
E.setShieldCards(true); E.setLoserMill(true);

var pass = 0, fail = 0;
function ok(cond, msg) { if (cond) { pass++; } else { fail++; console.log('  FAIL:', msg); } }

// A live 3-player board for the snapshot tests.
var g = E.newGame(null, { numPlayers: 3 });
g._diff = { 0: 'fighter', 1: 'fighter', 2: 'fighter' };
for (var t = 0; t < 40 && !g.finished; t++) AI.takeTurn(g, g.turn, 'fighter');
if (g.finished) g = E.newGame(null, { numPlayers: 3 });

// ---- snapshotFor: redaction ----
var snap0 = NV.snapshotFor(g, 0);
ok(Array.isArray(snap0.players[0].hand), 'snapshot: own hand present');
ok(snap0.players[0].hand.length === g.players[0].hand.length, 'snapshot: own hand length matches');
ok(snap0.players[1].hand === undefined, 'snapshot: opponent 1 hand not sent');
ok(snap0.players[2].hand === undefined, 'snapshot: opponent 2 hand not sent');
ok(snap0.players[1].handCount === g.players[1].hand.length, 'snapshot: opponent hand COUNT sent');
var json0 = JSON.stringify(snap0);
var leaked = [];
[1, 2].forEach(function (i) {
  var pub = {}; (g.pile && g.pile.combo ? g.pile.combo.cards : []).forEach(function (x) { pub[x.id] = 1; });
  g.players.forEach(function (p) { (p.forms || []).forEach(function (f) { if (f.card) pub[f.card.id] = 1; }); (p.equipment || []).forEach(function (e) { pub[(e.card || e).id] = 1; }); });
  g.players[0].hand.forEach(function (x) { pub[x.id] = 1; });
  g.players[i].hand.forEach(function (c) { if (!pub[c.id] && json0.indexOf('"' + c.id + '"') !== -1) leaked.push(i + ':' + c.id); });
});
ok(leaked.length === 0, 'snapshot: no hidden opponent hand-card id leaks (' + leaked.join(',') + ')');
ok(snap0.turn === g.turn && snap0.numPlayers === 3, 'snapshot: public turn/numPlayers match');
[0, 1, 2].forEach(function (i) { ok(snap0.players[i].shields === g.players[i].shields, 'snapshot: seat ' + i + ' shields'); ok(snap0.players[i].energyCount === g.players[i].energy.length, 'snapshot: seat ' + i + ' energy count'); });
var snap1 = NV.snapshotFor(g, 1);
ok(Array.isArray(snap1.players[1].hand) && snap1.players[0].hand === undefined, 'snapshot: each seat sees its own hand');
ok(snap0.seat === 0 && snap1.seat === 1, 'snapshot: tags its own seat');
ok(JSON.stringify(JSON.parse(json0)) === json0, 'snapshot: round-trips through JSON');

// ---- prompts ----
var g2 = E.newGame(null, { numPlayers: 3 });
g2.discardPending = { player: 2, count: 2 };
ok(NV.snapshotFor(g2, 2).prompt.kind === 'discard' && NV.snapshotFor(g2, 2).prompt.count === 2, 'prompt: discard to the owed seat with count');
ok(!NV.snapshotFor(g2, 0).prompt || NV.snapshotFor(g2, 0).prompt.kind !== 'discard', 'prompt: discard not shown to others');
g2.discardPending = null; g2.turn = 1;
ok(NV.snapshotFor(g2, 1).prompt.kind === 'turn' && NV.snapshotFor(g2, 0).prompt === null, 'prompt: active seat=turn, others=null');
g2.shieldResponse = { q: 0 };
ok(NV.snapshotFor(g2, 0).prompt.kind === 'shieldGuard', 'prompt: shieldGuard takes priority');

// ---- mirrorFor: full redacted, seat-rotated state for the client's render() ----
var gm = E.newGame(null, { numPlayers: 2 });
gm.players[0].hand = [{ rank: 7, suit: 'D', id: '7D' }, { rank: 9, suit: 'C', id: '9C' }];
gm.players[1].hand = [{ rank: 3, suit: 'S', id: '3S' }, { rank: 4, suit: 'H', id: '4H' }, { rank: 5, suit: 'D', id: '5D' }];
gm.turn = 0; gm.pile = { combo: { type: 'single', value: 7, size: 1, key: [7], cards: [{ rank: 7, suit: 'D', id: '7D' }] }, byPlayer: 0, mod: 0 };
var m = NV.mirrorFor(gm, 1);   // client is seat 1 → becomes index 0
ok(m.players[0].hand.length === 3 && m.players[0].hand[0].id === '3S', 'mirror: client (seat 1) sits at index 0 with its real hand');
ok(m.players[1].hand.every(function (c) { return c.hidden; }) && m.players[1].hand.length === 2, 'mirror: opponent hand redacted to face-down dummies of the right count');
var mj = JSON.stringify(m);   // 7D is on the pile (public); 9C is hidden in the opponent's hand and must NOT appear
ok(mj.indexOf('"9C"') === -1, 'mirror: hidden opponent hand card id does NOT leak');
ok(m.turn === 1, 'mirror: turn remapped (real seat 0 → view index 1)');
ok(m.pile.byPlayer === 1, 'mirror: pile.byPlayer remapped');
ok(m.players[0].deck.every(function (c) { return c.hidden; }), 'mirror: even your own deck is face-down (order hidden)');
ok(JSON.stringify(JSON.parse(mj)) === mj, 'mirror: round-trips through JSON');
var g3 = E.newGame(null, { numPlayers: 3 }); g3.turn = 1;
ok(NV.mirrorFor(g3, 2).turn === (1 - 2 + 3) % 3, 'mirror(3p): turn rotates by seat offset');

/* trimPending: the seat the table is waiting on while it trims to hand size, ROTATED like every other seat
 * reference, and carrying a COUNT rather than cards. It exists so the seats that are NOT picking can say why
 * play has paused (v1.31.69); before it they saw an unexplained gap mid-round. */
(function(){
  var st = E.newGame(null, { numPlayers: 3 });
  st.trimPending = { player: 2, need: 3 };
  var m1 = NV.mirrorFor(st, 1);
  ok(!!m1.trimPending, 'the mirror carries trimPending');
  ok(m1.trimPending.player === 1, '  → and ROTATES the seat (absolute 2 reads as 1 from seat 1)');
  ok(m1.trimPending.need === 3, '  → and carries the count');
  var m2 = NV.mirrorFor(st, 2);
  ok(m2.trimPending.player === 0, '  → the picking seat sees itself as 0, like every other seat reference');
  ok(!/[0-9]+[DHCS]#/.test(JSON.stringify(m2.trimPending)), '  → and no card ever travels in it');
  st.trimPending = null;
  ok(NV.mirrorFor(st, 1).trimPending === null, 'and it is null when nobody is trimming');
})();

console.log((fail === 0 ? '\nPASS' : '\nFAIL') + ': ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
