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

/* ---- A MIRROR MUST BE A SERIALISABLE TREE, NOT A VIEW ONTO THE HOST (v1.31.114) ----------------------
 * The bug this exists for: `remapSR`/`remapStack` copied every key with `for (var k in o)`, so the mirror
 * carried `result` — which IS `st.roundWinResult`, which holds `state: st`. The mirror pointed back at the
 * raw host state and was CIRCULAR.
 * WHY NOTHING CAUGHT IT. On BroadcastChannel, `postMessage` uses structured clone, which handles cycles
 * happily and simply ships the whole host state; every guard-window suite (nettest_guard, roundstall,
 * clientwin) runs `net=host`, i.e. BroadcastChannel. Only a real RTCDataChannel calls `JSON.stringify`,
 * where it throws — inside a catch that DISCARDS the mirror. So the threatened seat never received the
 * window the host was parked waiting on, and the table wedged, in exactly the configuration no suite ran.
 * These assertions are transport-independent, which is the point: they hold the invariant the wire needs
 * without needing a wire. Reintroduce either blanket copy and the first one goes red immediately. */
(function () {
  var st = E.newGame(null, { starter: 0 });
  var me = st.players[0], foe = st.players[1];
  var L = { rank: 9, suit: 'D', id: 'ley' }, a = { rank: 8, suit: 'H', id: 'p1' }, b = { rank: 8, suit: 'S', id: 'p2' };
  foe.hand = [L, { rank: 3, suit: 'C', id: 'low' }];
  foe.energy = []; for (var i = 1; i <= 12; i++) foe.energy.push({ rank: i, suit: 'D', id: 'fe' + i });
  me.hand = [a, b, { rank: 5, suit: 'C', id: 'x' }];
  st.round = 3; st.turn = 0; st.pile = null; st.lastPlayer = null; st.passes = 0;
  E.play(st, 0, [a, b]); E.pass(st, 1);                      // seat 1 must lose a shield and holds Leyline
  /* NOT VACUOUS: without an OPEN window there is nothing to alias, and every assertion below would pass on
     the broken build. The staging is the half that matters. */
  ok(!!st.shieldResponse && st.shieldResponse.q === 1, 'STAGED: a real round opened the shield-guard window on seat 1');
  ok(!!st.roundWinResult && st.roundWinResult.state === st, '  → and the host result really does hold a back-reference to state');

  for (var seat = 0; seat < st.numPlayers; seat++) {
    var m = NV.mirrorFor(st, seat), serialised = null, threw = '';
    try { serialised = JSON.stringify(m); } catch (e) { threw = e.message.split('\n')[0]; }
    ok(serialised !== null, 'seat ' + seat + ': the mirror is JSON-serialisable with a window open' + (threw ? ' — THREW: ' + threw : ''));
    ok(!m.shieldResponse || m.shieldResponse.result === undefined, 'seat ' + seat + ': the mirror does not carry the host result object');
    ok(m.roundWinResult === null, 'seat ' + seat + ': ceremony state stays host-only (the redaction is real, not aliased around)');
  }
  var m1 = NV.mirrorFor(st, 1);
  ok(m1.shieldResponse.q === 0, 'the threatened seat reads itself as 0, like every other seat reference');
  ok(m1.shieldResponse.guardId === 'ley', '  → and still learns WHICH card it may spring');
  ok(m1.shieldResponse.obj && m1.shieldResponse.obj.source != null, '  → and what is threatening it (obj.source, the one field the modal reads)');
  ok(m1.shieldResponse.obj.target === 0, '  → with the object\'s target ROTATED, not the absolute seat');
  /* THE GENERAL FORM, so a future field cannot reintroduce it quietly: nothing anywhere in a mirror may be
     the host state or a player of it. Checked by identity over the whole tree, not by key name. */
  var hostObjs = [st].concat(st.players), bad = null;
  (function walk(v, path) {
    if (bad || !v || typeof v !== 'object') return;
    for (var h = 0; h < hostObjs.length; h++) if (v === hostObjs[h]) { bad = path; return; }
    for (var k in v) if (Object.prototype.hasOwnProperty.call(v, k)) walk(v[k], path + '.' + k);
  })(NV.mirrorFor(st, 1), 'mirror');
  ok(bad === null, 'no part of a mirror is identity-equal to the host state or one of its players' + (bad ? ' — found at ' + bad : ''));
})();

/* THE HOUSE SUMMARY FORM. This file still had the pre-2026-08-31 version, which printed
   `FAIL: 41  FAIL: 6` on a red run — the PASS count wearing the word FAIL, and no `PASS:` token at all,
   so a sweep grepping for one reports a crash rather than a failure. That was fixed in 59 files and this
   one was missed, which matters more here than most: it is one of the two GATE suites. */
console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
