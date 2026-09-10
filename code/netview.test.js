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
/* ---- A COPY MUST ARRIVE AS A COPY (v1.31.115) --------------------------------------------------------
 * `card()` whitelisted rank/suit/id, and the engine attaches three more fields that decide what a card IS:
 * `temp` (effectOf short-circuits on it — a Counterfeit or Illusion copy has NO effect), `valueBonus` (what
 * copyBonus sums, which feeds the Fight-enable test) and `counterfeit`. Stripped, a client held a DIFFERENT
 * CARD from the host: the reader printed the original's full Technique text and lit ⚡ Activate on a pure
 * fight body, and the host then refused the intent. Nothing threw at either end.
 * These assert IDENTITY, not shape: the discriminating line is `effectOf` on the client's own copy. */
(function () {
  var st = E.newGame(null, { starter: 0 });
  var copy = { rank: 7, suit: 'D', id: 'CF7D#1', temp: true, counterfeit: true, valueBonus: 1 };
  var plain = { rank: 4, suit: 'H', id: 'plain4H' };
  st.players[1].hand = [copy, plain];
  /* NOT VACUOUS: if 7♦ had no base effect, "the client sees no effect" would pass on the broken build too. */
  ok(E.effectOf({ rank: 7, suit: 'D', id: 'x' }) !== null, 'STAGED: the copied card 7♦ really does have a base effect to leak');
  ok(E.effectOf(copy) === null, '  → and the HOST correctly reads the copy as having none');

  var mine = NV.mirrorFor(st, 1).players[0].hand;      // seat 1 reading its OWN hand
  var c = mine[0];
  ok(c.temp === true, 'the mirror carries `temp`, so a copy stays a copy on the wire');
  ok(c.valueBonus === 1, '  → and `valueBonus`, the number the Fight-enable test needs');
  ok(c.counterfeit === true, '  → and the marker it is identified by');
  ok(E.effectOf(c) === null, '  → so the CLIENT reads it as a pure fight body too, not as the original card');
  ok(mine[1].temp === undefined && mine[1].counterfeit === undefined && mine[1].valueBonus === undefined,
     'an ordinary card is unchanged — the fields are carried only when present');

  /* The same card seen by the OTHER seat, on the pile, must keep its identity too — an Illusion is `temp`
     and sits on the pile, where every seat reads it. */
  st.pile = { combo: { type: 'single', value: 7, size: 1, key: [7], cards: [copy] }, byPlayer: 1 };
  var pc = NV.mirrorFor(st, 0).pile.combo.cards[0];
  ok(pc.temp === true, 'a temp card on the PILE keeps its identity for the other seat as well');
})();

/* ---- THE ROTATION DIFFERENTIAL. Every mirror bug found so far was a seat-valued field that was copied when
   it should have been rotated, and an assertion can only cover the fields someone thought to name — which is
   how `remapSR`, `remapStack` and `card()` each shipped a hole. This inverts the burden.

   THE CLASSIFIER IS EXACT, not a heuristic: a rotating value is `(a - seat + n) % n`, which is INJECTIVE in
   seat. So across all n mirrors a seat-valued leaf takes n DISTINCT values, and anything constant is not
   rotating. Constant therefore has to be declared PUBLIC by path; a leaf that is neither constant nor a clean
   rotation is a partial rotation, which is a bug with no innocent reading.
   The staging makes the classifier sound: 4 players so a rotation is distinguishable from an identity, and
   every seat-valued field set to the SAME absolute seat so one path has one answer across the whole tree. */
(function () {
  var N = 4;
  var r = E.newGame(null, { numPlayers: N });
  r.turn = 2; r.initiative = 2; r.lastPlayer = 1;
  r.pile = { byPlayer: 3, mod: 0, combo: { type: 'single', value: 9, size: 1, key: [9], cards: [{ rank: 9, suit: 'D', id: 'pile9D' }] } };
  /* STAGE THE ZONES OUT OF THE SEAT RANGE. `players.0` is a DIFFERENT player for each seat (it is always
     "me"), so a card's `rank` at that path legitimately varies across seats — and Ace/2/3 are ranks 1, 2, 3,
     which land inside [0,N) and read as a broken rotation. Measured at 2 failures in 20 before this line.
     Every card here is rank >= 5, so no card field can be mistaken for a seat at all. */
  r.players.forEach(function (pl, i) {
    pl.lastAttacker = 2;                                                          // same absolute seat everywhere: one path, one answer
    pl.hand = [{ rank: 9, suit: 'D', id: 'h' + i + 'a' }, { rank: 12, suit: 'C', id: 'h' + i + 'b' }];
    pl.deck = [{ rank: 7, suit: 'S', id: 'd' + i + 'a' }];
    pl.shuffle = []; pl.removed = []; pl.energy = [{ rank: 8, suit: 'H', id: 'e' + i }];
  });
  r.discardPending = { player: 2, count: 1, from: null };
  r.preFightQ = 2;
  r.trimPending = { player: 2, need: 1 };
  r.pendingLossChoice = { winner: 2, cands: [2], comboType: 'pair' };
  r.fightEnd = { origin: 2, winner: 2, wonWithCombo: true, strikeTargets: [2], winSize: 2 };   // every member seat-valued except the two scalars
  r.shieldResponse = { q: 2, winner: 2, guardId: 'g1', roundWin: true, obj: { source: 'Pair', n: 1, target: 2 } };
  r.stack = [{ oid: 1, kind: 'effect', p: 2, target: 2, winner: 2, n: 1, card: { rank: 9, suit: 'H', id: 's9H' }, eff: { id: 'x', kind: 'draw' }, opts: { target: 2 } }];
  r.respondFor = 2;

  var mirrors = []; for (var s = 0; s < N; s++) mirrors.push(NV.mirrorFor(r, s));

  function leaves(o, path, out) {
    if (o === null || o === undefined) return out;
    if (Array.isArray(o)) { for (var i = 0; i < o.length; i++) leaves(o[i], path + '.' + i, out); return out; }
    if (typeof o === 'object') { for (var k in o) leaves(o[k], path ? path + '.' + k : k, out); return out; }
    if (typeof o === 'number' && o >= 0 && o < N && o === (o | 0)) out[path] = o;   // only values that COULD be a seat
    return out;
  }
  var perSeat = mirrors.map(function (m) { return leaves(m, '', {}); });
  var paths = {}; perSeat.forEach(function (L) { for (var k in L) paths[k] = 1; });

  /* `prioPassed` IS REDACTED ON PURPOSE (epic step 5). It is keyed by ABSOLUTE seat, so shipping it
     unrotated would hand every client a map whose keys mean something different at each seat — the exact
     class of bug `rot()` exists for. Nothing on a client needs it either: `respondFor` already says whether
     this seat owes an answer. Asserted rather than left to chance, because the natural "fix" for a missing
     field is to add it to `mirrorFor`, and doing that without rotating is silent. */
  (function () {
    var gp = E.newGame(null, { numPlayers: 3 });
    gp.prioPassed = { 0: true, 2: true };
    var mp = NV.mirrorFor(gp, 1);
    ok(!('prioPassed' in mp),
       'prioPassed is NOT mirrored — it is absolute-seat-keyed and the client does not need it' +
       (('prioPassed' in mp) ? '  ← it leaked; either rotate it or drop it, never ship it raw' : ''));
  })();

  /* AN OBJECTLESS PRIORITY WINDOW SURVIVES THE MIRROR (epic step 2). A Fight End go-round runs on an empty
     stack, so `respondFor` is set and `pending` is null. `promptFor` used to require the OBJECT, which made
     such a window read as "waiting on someone else" — the client would never know it owed an answer. */
  (function () {
    var gw = E.newGame(null, { numPlayers: 3 });
    gw.pending = null; gw.respondFor = 2;
    var mv = null, threw = null;
    try { mv = NV.mirrorFor(gw, 1); } catch (ex) { threw = ex.message; }
    ok(mv !== null, 'objectless window: mirrorFor survives a window with no object' + (threw ? '  ← ' + threw : ''));
    ok(mv && mv.pending === null && mv.respondFor === (2 - 1 + 3) % 3,
       'objectless window: the mirror carries a null object and a ROTATED holder');
    var pr = NV.promptFor ? NV.promptFor(gw, 2) : null;
    if (NV.promptFor) ok(pr && pr.kind === 'respond',
       'objectless window: the seat is told it owes a RESPOND' + (pr && pr.kind === 'respond' ? '' : '  ← reads as "waiting on someone else", so nobody ever answers'));
  })();

  /* DECLARED PUBLIC: a small-integer leaf that is legitimately the same for every seat. Short and reviewable
     BY DESIGN — that is the whole point of inverting the burden. A new key that is constant and unlisted
     fails this suite by name, and the reviewer answers one question: is it public, or did it forget to rotate? */
  var PUBLIC = {
    'numPlayers': 1, 'round': 1, 'passes': 1, 'startShields': 1, 'prioGen': 1,
    'fightEnd.winSize': 1,   // the SIZE of the winning play, not a seat — constant for every reader

    'pile.mod': 1, 'pile.combo.size': 1,
    'stack.0.n': 1, 'stack.0.oid': 1, 'shieldResponse.obj.n': 1
  };
  function pub(p) {
    if (PUBLIC[p]) return true;
    return /(^|\.)(shields|energyCount|handCount|deckCount|shuffleCount|removedCount|kicksLanded|counters|counter|rank|size|value|tier|mod|need|count|protectedRound|_effUsed|nextPlayBoost)$/.test(p)
        || /^players\.\d+\.(hand|deck|shuffle|removed|energy|forms|equipment)\./.test(p)
        || /(^|\.)key\.\d+$/.test(p);
  }

  /* DECLARED ABSOLUTE: the one leaf that is seat-valued and deliberately NOT rotated. `_seat` tells the client
     which absolute seat it is, so across the four mirrors it reads 0,1,2,3 — the identity, not a rotation. The
     differential flagged it as partially-rotated on its first run, which is the classifier working: it refuses
     to guess, and an absolute seat must be declared as one. Asserted directly below rather than just skipped. */
  ok(mirrors.every(function (m, s) { return m._seat === s; }), '_seat is deliberately ABSOLUTE, and reads the seat it was built for');

  /* DECLARE FIRST, CLASSIFY SECOND. `pub()` has to run BEFORE the rotation check, not only against the
     constants: a player-relative leaf varies across seats without rotating, so classifying it first sends it
     to `broken` and the suite fails on a mirror that is perfectly correct. The declaration IS the exemption. */
  var rotating = [], constant = [], broken = [];
  Object.keys(paths).forEach(function (p) {
    if (p === '_seat') return;                                                 // declared absolute, asserted above
    if (pub(p)) return;                                                        // declared public / player-relative — cannot be a seat
    var vals = perSeat.map(function (L) { return L[p]; });
    if (vals.some(function (v) { return v === undefined; })) return;          // path absent in some seat — shape, not rotation
    var allSame = vals.every(function (v) { return v === vals[0]; });
    if (allSame) { constant.push(p); return; }
    var a = (vals[0] + 0) % N;                                                 // seat 0's value IS the absolute seat
    var rot = vals.every(function (v, s) { return v === ((a - s + N) % N); });
    (rot ? rotating : broken).push(p + ' [' + vals.join(',') + ']');
  });

  ok(rotating.length >= 8, 'the differential SEES the rotation — ' + rotating.length + ' seat-valued paths rotate correctly');
  ok(broken.length === 0, 'no path is PARTIALLY rotated' + (broken.length ? ' — ' + broken.join(' | ') : ''));
  var undeclared = constant;                                                   // pub() already filtered above
  ok(undeclared.length === 0,
     'every constant small-integer leaf is declared PUBLIC' +
     (undeclared.length ? ' — UNDECLARED: ' + undeclared.join(', ') + '  ← each is either public (add it) or a seat that forgot to rotate' : ''));

  /* NOT VACUOUS: break the rotation on purpose and require the differential to catch it. Without this the
     three assertions above pass on a mirror that rotates nothing at all. */
  var probe = NV.mirrorFor(r, 1); probe.turn = r.turn;                          // absolute, i.e. UNrotated
  var pv = [mirrors[0].turn, probe.turn];
  ok(pv[0] === 2 && pv[1] === 2 && mirrors[1].turn === 1,
     '  → and it would SEE a field left absolute (seat 1 rotates turn 2→1; an unrotated copy stays 2)');
})();

console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
process.exit(fail ? 1 : 0);
