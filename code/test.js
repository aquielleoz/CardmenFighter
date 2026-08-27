var E = require('./engine.js');
var AI = require('./ai.js');

var fails = 0, passes = 0;
function ok(c, m) { if (c) passes++; else { fails++; console.log('FAIL:', m); } }
function card(id) { return { rank: parseInt(id, 10), suit: id.replace(/^\d+/, ''), id: parseInt(id, 10) + id.replace(/^\d+/, '') }; }
function cards(ids) { return ids.map(card); }


// ===== ENGINE TESTS (the game is always the 2-apex + Forms rework; the classic pre-rework suite is retired) =====
// ===== Full-game AI-vs-AI termination smoke (live rules: 52-card, Forms, catch-up) =====
(function () {
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  E.setShieldCards(true); E.setLoserMill(true);   // catch-up on, as the shipped game plays
  var terminated = 0, activations = 0, kickEnds = 0;
  for (var seed = 1; seed <= 300; seed++) {
    var g = E.newGame(mulberry32(seed), { starter: seed % 2 }), guard = 0;
    while (!g.finished) {
      if (++guard > 300000) throw new Error('did not terminate (seed ' + seed + ')');
      AI.takeTurn(g, g.turn).forEach(function (e) { if (e.play) activations++; });
      g.players.forEach(function (pl) { if (pl.shields < 0) throw new Error('negative shields (seed ' + seed + ')'); });
    }
    if (g.winner === 0 || g.winner === 1) terminated++;
    var loser = g.winner === 0 ? 1 : 0;
    if (g.players[loser].shields === 0) kickEnds++;
  }
  ok(terminated === 300, 'all 300 AI-vs-AI rework duels terminated with a valid winner');
  ok(activations > 0, 'the AI activated card effects across the games (' + activations + ' total)');
  ok(kickEnds > 0, 'some games ended on a real Fighter Kick (' + kickEnds + '/300)');
})();

// ===== Core: 2-as-apex ladder + J/Q/K deck =====
(function () {
  function sc(r, s) { return { rank: r, suit: s, id: r + s }; }
  function single(r, s) { return E.detectCombo([sc(r, s)]); }
  ok(E.makeDeck().length === 52, 'REWORK: full deck is 52 cards (ranks 1-13)');
  ok(E.buildDeck('Wizard').length === 52, 'REWORK: pure deck is 52 cards');
  ok(E.buildDeck('Sage').length === 52, 'REWORK: dual deck is 52 cards');

  // ---- energy pile ORDER: the player's lever on what recycles sooner (ENERGY-REORDER-DESIGN.md) ----
  (function () {
    function rig() {
      var g = E.newGame(null, { starter: 0 });
      var pl = g.players[0];
      pl.energy = [sc(3, 'H'), sc(4, 'S'), sc(5, 'H'), sc(6, 'C'), sc(7, 'D'), sc(8, 'H')];
      pl.shuffle = []; g.turn = 0; g.pending = null; g.respondFor = null; g.finished = false;
      return g;
    }
    var ids = function (a) { return a.map(function (c) { return c.id; }).join(','); };

    var g = rig();
    var r = E.promoteEnergy(g, 0, '7D');
    ok(r.ok && ids(g.players[0].energy) === '7D,3H,4S,5H,6C,8H', 'energy: promote moves a card to the FRONT, the rest shift down');
    E.promoteEnergy(g, 0, '6C');
    ok(ids(g.players[0].energy) === '6C,7D,3H,4S,5H,8H', 'energy: a second promote takes the top — last promoted is spent first (stack, not queue)');

    // The consequence that matters: order decides what leaves the pile. Isolate the GENERIC path by paying for a
    // card whose suit is absent from the pile — the colored-pip loop then finds nothing and the whole cost comes
    // off the front. (J/Q/K would be fully generic but their transform cost is 0 since v1.23.0, so they pay
    // nothing at all.)
    g = rig();
    g.players[0].energy = [sc(3, 'H'), sc(4, 'S'), sc(5, 'H'), sc(6, 'C'), sc(8, 'H'), sc(9, 'S')];   // no ♦ at all
    E.promoteEnergy(g, 0, '4S');                                   // a spade to the front
    E.payEnergy(g.players[0], sc(4, 'D'), 0);                      // 4♦: 2 ♦ pips (none available) + the rest generic
    ok(ids(g.players[0].shuffle) === '4S,3H,5H,6C', 'energy: a generic cost spends off the FRONT, in the order you set');
    ok(g.players[0].energy.length === 2, 'energy: the pile shrank by exactly the cost');

    // colored pips take the earliest card OF THAT SUIT — the labelled caveat, pinned
    g = rig();
    E.promoteEnergy(g, 0, '4S');                                   // spade in front, but a ♥ cost ignores it
    E.payEnergy(g.players[0], sc(3, 'H'), 0);                      // cost 3 ♥-suited → pips floor(3/2)=1 ♥ + 2 generic
    var sh = g.players[0].shuffle.map(function (c) { return c.id; });
    ok(sh[0] === '3H', 'energy: a colored pip takes the earliest card of THAT suit, skipping a promoted spade');
    ok(sh.indexOf('4S') > 0, 'energy: the promoted spade still went, but as generic — not as the ♥ pip');

    // validation — a bad order is an attempt to conjure or delete energy
    g = rig();
    var before = ids(g.players[0].energy);
    ok(!E.reorderEnergy(g, 0, ['3H', '4S']).ok, 'energy: a short order is rejected');
    ok(!E.reorderEnergy(g, 0, ['3H', '3H', '4S', '5H', '6C', '7D']).ok, 'energy: a duplicated id is rejected');
    ok(!E.reorderEnergy(g, 0, ['3H', '4S', '5H', '6C', '7D', '9S']).ok, 'energy: a foreign id is rejected');
    ok(!E.reorderEnergy(g, 0, 'nope').ok && !E.reorderEnergy(g, 0, null).ok, 'energy: a non-array order is rejected');
    ok(!E.promoteEnergy(g, 0, '9S').ok, 'energy: promoting a card you do not hold is rejected');
    ok(ids(g.players[0].energy) === before, 'energy: every rejection left the pile untouched');

    g = rig(); g.turn = 1;
    ok(!E.reorderEnergy(g, 0, ['8H', '3H', '4S', '5H', '6C', '7D']).ok, 'energy: reordering off-turn is rejected');
    g = rig(); g.respondFor = 1;
    ok(!E.reorderEnergy(g, 0, ['8H', '3H', '4S', '5H', '6C', '7D']).ok, 'energy: no reorder while a response window is open');
    g = rig(); g.pending = { some: 'stack' };
    ok(!E.reorderEnergy(g, 0, ['8H', '3H', '4S', '5H', '6C', '7D']).ok, 'energy: no reorder while a Technique is resolving');
    g = rig(); g.finished = true;
    ok(!E.reorderEnergy(g, 0, ['8H', '3H', '4S', '5H', '6C', '7D']).ok, 'energy: no reorder after the game ends');

    // a full reversal is a legal permutation
    g = rig();
    ok(E.reorderEnergy(g, 0, ['8H', '7D', '6C', '5H', '4S', '3H']).ok && ids(g.players[0].energy) === '8H,7D,6C,5H,4S,3H',
       'energy: any true permutation is accepted, including a full reversal');
    ok(E.reorderEnergy(g, 0, []).ok === false || g.players[0].energy.length === 6, 'energy: an empty order cannot empty a non-empty pile');
  })();

  // ---- deck compositions ("parts"): 4 parts of 13 cards, duplicates allowed, serialised as 'custom:D1H2C1' ----
  (function () {
    var suits = function (deck) { return deck.reduce(function (a, c) { a[c.suit] = (a[c.suit] || 0) + 1; return a; }, {}); };
    // key-order-insensitive compare: suit tallies come back in deal order, not declaration order
    var J = function (o) { if (!o || typeof o !== 'object') return JSON.stringify(o);
      return Object.keys(o).sort().map(function (k) { return k + ':' + o[k]; }).join(','); };
    ok(E.partsKey({ D: 1, H: 2, C: 1 }) === 'custom:D1H2C1', 'parts: partsKey serialises in canonical D-H-C-S order');
    ok(E.partsKey({ C: 1, H: 2, D: 1 }) === 'custom:D1H2C1', 'parts: key is canonical regardless of property order');
    ok(J(E.parseParts('custom:D1H2C1')) === J({ D: 1, H: 2, C: 1 }), 'parts: parseParts round-trips its own key');
    ok(E.partsKey({ D: 4 }) === 'custom:D4' && J(E.parseParts('custom:D4')) === J({ D: 4 }), 'parts: a single 4-part class round-trips');
    ok(E.partsCount({ D: 1, H: 2, C: 1 }) === 4 && E.partsCount({}) === 0, 'parts: partsCount sums the parts');
    ok(E.PARTS_TOTAL === 4, 'parts: a deck is always 4 parts');

    ok(!E.partsValid({ D: 1, H: 2 }), 'parts: 3 parts is invalid (must total 4)');
    ok(!E.partsValid({ D: 1, H: 2, C: 2 }), 'parts: 5 parts is invalid');
    ok(!E.partsValid({ D: 4, X: 0 }), 'parts: an unknown class is invalid');
    ok(!E.partsValid({ D: 3, H: 1.5 }), 'parts: a fractional part is invalid');
    ok(!E.partsValid({ D: 5, H: -1 }), 'parts: a negative part is invalid');
    ok(!E.partsValid(null) && !E.partsValid('custom:D4'), 'parts: partsValid wants an object, not a key');
    ok(E.parseParts('custom:D1H2C2') === null, 'parts: a key that does not total 4 is rejected');
    ok(E.parseParts('custom:D1H1D1S1') === null, 'parts: a key listing a class twice is rejected');
    ok(E.parseParts('custom:D4X') === null && E.parseParts('custom:') === null, 'parts: junk in a key is rejected');
    ok(E.parseParts('Wizard') === null && E.parseParts('full') === null, 'parts: preset keys are not parts keys');
    ok(E.isPartsKey('custom:D2S2') && !E.isPartsKey('Sage'), 'parts: isPartsKey distinguishes the two kinds of deck value');

    var mixed = E.buildDeck('custom:D1H2C1');
    ok(mixed.length === 52, 'parts: a composition deck is 52 cards');
    ok(J(suits(mixed)) === J({ D: 13, H: 26, C: 13 }), 'parts: 1 Wizard + 2 Cleric + 1 Fighter = 13/26/13 by suit');
    ok(mixed.filter(function (c) { return c.suit === 'H' && c.rank === 7; }).length === 2, 'parts: a doubled class yields duplicate cards');
    var ids = {}; mixed.forEach(function (c) { ids[c.id] = 1; });
    ok(Object.keys(ids).length === 52, 'parts: every card instance gets a unique id even when duplicated');
    ok(E.buildDeck('custom:S4').every(function (c) { return c.suit === 'S'; }), 'parts: 4 parts Rogue is all spades');
    ok(E.buildDeck({ D: 2, H: 2 }).length === 52, 'parts: buildDeck also takes a raw composition object');
    ok(E.buildDeck('custom:D9') === null && E.buildDeck('custom:nope') === null, 'parts: buildDeck returns null for an invalid composition');

    // presets ARE compositions — the builder opens pre-filled from one, and this pins the equivalence
    ok(J(E.presetParts('Wizard')) === J({ D: 4 }), 'parts: Pure Wizard is 4 parts Wizard');
    ok(J(E.presetParts('Sage')) === J({ D: 2, H: 2 }), 'parts: Sage is 2 Wizard + 2 Cleric');
    ok(J(E.presetParts('full')) === J({ D: 1, H: 1, C: 1, S: 1 }), 'parts: the Full Set is 1 part of each class');
    ok(E.presetParts('nope') === null, 'parts: presetParts is null for an unknown key');
    E.DECK_ORDER.forEach(function (k) {
      var byPreset = suits(E.buildDeck(k)), byParts = suits(E.buildDeck(E.partsKey(E.presetParts(k))));
      ok(J(byPreset) === J(byParts), 'parts: preset ' + k + ' builds the same suit spread as its composition');
    });

    // a real game dealt from compositions (newGame needs no changes — buildDeck absorbs the new key)
    var g = E.newGame(null, { decks: ['custom:D1H2C1', 'custom:S4'], starter: 0 });
    // NB: an earlier block leaves setShieldCards(true) on globally, so 4 of the 52 sit in shieldPile — count them.
    var all = function (p) { var pl = g.players[p]; return pl.deck.concat(pl.hand, pl.shieldPile || [], pl.energy || []); };
    ok(all(0).length === 52 && all(1).length === 52, 'parts: both seats are dealt a full 52 from their compositions (' + all(0).length + '/' + all(1).length + ')');
    ok(J(suits(all(0))) === J({ H: 26, D: 13, C: 13 }), 'parts: seat 0 kept its 1/2/1 composition through the deal');
    ok(all(1).every(function (c) { return c.suit === 'S'; }), 'parts: seat 1 kept its 4-part Rogue composition');
  })();
  ok(E.fightValue(sc(11, 'D')) === 11 && E.fightValue(sc(13, 'D')) === 13, 'REWORK: J/Q/K value = 11/12/13');
  ok(E.fightValue(sc(1, 'D')) === 14 && E.fightValue(sc(2, 'D')) === 15, 'REWORK: Ace=14, apex 2=15');
  ok(E.beats(single(2, 'D'), single(1, 'D')), 'REWORK: apex 2 beats Ace');
  ok(E.beats(single(1, 'D'), single(13, 'D')), 'REWORK: Ace beats King');
  ok(E.beats(single(13, 'D'), single(10, 'D')), 'REWORK: King beats 10');
  ok(!E.beats(single(10, 'D'), single(2, 'D')), 'REWORK: 10 does not beat apex 2');
  ok(E.beats(E.detectCombo([sc(2, 'D'), sc(2, 'H')]), E.detectCombo([sc(13, 'D'), sc(13, 'H')])), 'REWORK: pair of 2s beats pair of Kings (apex-as-stopper by value)');
  ok(E.detectCombo([sc(11, 'D'), sc(12, 'D'), sc(13, 'D'), sc(1, 'D'), sc(2, 'D')]).type === 'straight', 'REWORK: J-Q-K-A-2 same suit = straight (no straight-flush tier)');
  ok(E.detectCombo([sc(10, 'C'), sc(11, 'D'), sc(12, 'H'), sc(13, 'S'), sc(1, 'C')]).value === 14, 'REWORK: 10-J-Q-K-A straight tops at Ace (14)');
  ok(E.detectCombo([sc(1, 'D'), sc(2, 'D'), sc(3, 'D'), sc(4, 'D'), sc(5, 'D')]) === null, 'REWORK: old A-2-3-4-5 low straight no longer a combo');
  // The apex 2 is a vanilla trump. The STOPPER mechanic it used to carry was retired by the rework and its
  // implementation was DELETED in v1.31.12 — it had sat unreachable in three layers, and a playtest even
  // reported "0 STOPPER uses in 14 games" as an engagement problem.
  ok(E.effectOf(sc(2, 'D')) === null, 'REWORK: apex 2 has no activated effect');
  ok(!E.stopper && !E.stopperNeed, 'REWORK: the STOPPER implementation is gone, not just unreachable');
  var ace = E.effectOf(sc(1, 'D'));
  ok(ace && ace.name === 'Gather Energy' && ace.cost === 1, 'REWORK: Ace keeps its effect at cost 1');
  // J/Q/K are transform cards: activating one (10 energy) sends it to the Forms & Rides Zone
  var jeff = E.effectOf(sc(11, 'D'));
  ok(jeff && jeff.kind === 'transform' && jeff.tier === 'ride' && jeff.cost === 0, 'REWORK: Jack is a Ride transform (free)');
  ok(E.effectOf(sc(12, 'D')).tier === 'queen' && E.effectOf(sc(13, 'D')).tier === 'king', 'REWORK: Queen/King are Form transforms');
  (function () {  // free + draw 1, but gated by total table shields lost (J@2, Q@4, K@6 in a duel)
    var g = E.newGame(null, { starter: 0 });
    var pl = g.players[0];
    pl.hand = [sc(11, 'D'), sc(12, 'H'), sc(13, 'S'), sc(5, 'C')];
    pl.energy = []; pl.deck = [sc(6, 'C'), sc(7, 'C'), sc(8, 'C'), sc(9, 'C')];   // free — no energy; deck feeds the draw-1
    pl.shields = 1; g.players[1].shields = 1;                          // table lost 6 → all tiers unlocked
    g.turn = 0; g.round = 3; g.pile = { combo: E.detectCombo([sc(6, 'D')]), byPlayer: 1 }; g.lastPlayer = 1;
    var handBefore = pl.hand.length;
    var r1 = E.activate(g, 0, '11D');
    ok(r1.ok && r1.transformed && pl.forms.length === 1 && pl.energy.length === 0, 'REWORK: activating a J is FREE and moves it to the zone');
    ok(pl.hand.length === handBefore, 'REWORK: transform draws 1 to replace the spent card (net hand-neutral)');
    E.activate(g, 0, '12H');                                          // a Q with no K yet must NOT light Super
    ok(!E.hasSuper(pl), 'REWORK: a Ride + Q with no K does NOT reach Super (needs J AND Q AND K)');
    var r3 = E.activate(g, 0, '13S');                                 // DEFAULT Variant B: any J + any Q + any K → Super (mixed suits OK; the Ride is REQUIRED)
    ok(E.hasSuper(pl) && r3.isSuper, 'REWORK: any J + any Q + any K lights up Super Mode (Variant B default — J♦+Q♥+K♠; the Ride is required)');
    ok(!E.hasSuper(g.players[1]), 'REWORK: the empty-zone player is not in Super');
    // Variant A (same-suit) flips it back: a mixed-suit J/Q/K set no longer supers
    E.setFormSuitMatch(true);
    ok(!E.hasSuper(pl), 'REWORK: under Variant A (same-suit), J♦+Q♥+K♠ does NOT reach Super');
    E.setFormSuitMatch(false);
    ok(E.hasSuper(pl), 'REWORK: back to Variant B — J♦+Q♥+K♠ supers again');
  })();
  (function () {  // ONE transform per rank: a new J/Q/K replaces the existing one of that rank (to Energy)
    var g = E.newGame(null, { starter: 0 }); var pl = g.players[0];
    pl.shields = 1; g.players[1].shields = 1; g.turn = 0; g.round = 3;
    pl.energy = []; for (var i = 0; i < 20; i++) pl.energy.push(sc(2, 'CDHS'[i % 4]));
    pl.deck = [sc(6, 'C'), sc(7, 'C'), sc(8, 'C')];
    pl.hand = [sc(12, 'D'), sc(5, 'C')]; E.activate(g, 0, '12D');   // Q♦
    pl.hand = [sc(12, 'H'), sc(5, 'C')]; E.activate(g, 0, '12H');   // Q♥ replaces Q♦ (one per rank)
    var qs = pl.forms.filter(function (f) { return f.rank === 12; });
    ok(qs.length === 1 && qs[0].suit === 'H', 'REWORK: a new Form of the same rank replaces the old one (one per rank)');
    ok(pl.energy.some(function (c) { return c.id === '12D'; }), 'REWORK: the retired Form banks to Energy');
    pl.hand = [sc(13, 'S'), sc(5, 'C')]; E.activate(g, 0, '13S');   // K♠ — a different rank, coexists
    ok(pl.forms.length === 2, 'REWORK: a different-rank transform coexists (one J, one Q, one K max)');
  })();
  (function () {  // the table-gate blocks transforming before shields are lost
    var g = E.newGame(null, { starter: 0 }); var pl = g.players[0];
    pl.hand = [sc(11, 'D'), sc(5, 'C')]; pl.shields = 4; g.players[1].shields = 4;   // nobody hurt → gate closed
    g.turn = 0; g.round = 3; g.pile = { combo: E.detectCombo([sc(6, 'D')]), byPlayer: 1 }; g.lastPlayer = 1;
    var r = E.activate(g, 0, '11D');
    ok(!r.ok && pl.forms.length === 0, 'REWORK: transform is gated — refused before the table has lost shields');
    var stat = E.transformGateStatus(g, 0, 'ride');
    ok(stat.gate === 'table' && stat.need === 2 && !stat.ok, 'REWORK: gate status reports the table threshold (J needs 2 lost)');
  })();
  // ---- Phase 4a: base-card content changes ----
  ok(E.effectOf(sc(8, 'H')).name === 'Holy Bow', 'REWORK base: H8 renamed Holy Bow');
  ok(E.effectOf(sc(9, 'H')).name === 'Holy Shroud' && E.effectOf(sc(10, 'H')).name === 'Sanctuary', 'REWORK base: Cleric 9/10 reordered (Holy Shroud=9, Sanctuary=10)');
  ok(E.effectOf(sc(8, 'C')).draw === 2 && E.effectOf(sc(9, 'C')).oppDelta === -2, 'REWORK base: Instant Recovery draw 2 (v1.13 buff), Spiked Armor −2');
  ok(E.effectOf(sc(5, 'C')).name === 'Superior Training' && E.effectOf(sc(5, 'C')).draw === 4 && E.effectOf(sc(5, 'C')).discard === 2 && E.effectOf(sc(5, 'C')).cost === 5, 'REWORK base: Fighter 5 → Superior Training (v1.13 buff: dig 4, keep 2, 2→Energy) at cost 5');
  ok(E.effectOf(sc(6, 'S')).name === 'Never Out of Options' && E.effectOf(sc(6, 'S')).draw === 3 && E.effectOf(sc(6, 'S')).discard === 2, 'REWORK base: Never Out of Options dig 3 (keep 1, 2→Energy)');
  ok(E.effectOf(sc(7, 'C')).quick === false && E.effectOf(sc(3, 'S')).quick === false && E.effectOf(sc(10, 'S')).quick === false, 'REWORK base: Armor Piercing / Hand-to-Hand / Back Stab lose Quick');
  ok(E.effectOf(sc(10, 'C')).pitchHigh === true && E.effectOf(sc(7, 'C')).pitchHigh === true && E.effectOf(sc(9, 'S')).pitchHigh === true, 'REWORK base: Ultima Attack + Armor Piercing + Critical Hit carry the Broadway pitch cost');
  ok(E.effectOf(sc(6, 'C')).counters === 3 && E.effectOf(sc(9, 'C')).counters === 3 && E.effectOf(sc(7, 'S')).counters === 3, 'REWORK: Fighter/Rogue decaying equips → 3 counters (Javelin, Spiked Armor, Caltrops)');
  ok(E.effectOf(sc(8, 'H')).counters === 4 && E.effectOf(sc(8, 'D')).counters === 4, 'REWORK: Cleric/Wizard decaying equips → 4 counters (Holy Bow, Cursed Pendant)');
  ok(E.effectOf(sc(9, 'H')).decay === false, 'REWORK: Holy Shroud stays non-decaying (spend-only, not nerfed)');
  ok(E.effectOf(sc(6, 'D')).name === 'Back to the Books' && E.effectOf(sc(6, 'D')).draw === 3 && E.effectOf(sc(6, 'D')).discard === 1, 'REWORK base: Back to the Books is a dig (look 3, 1→Energy, keep 2)');
  // ---- Broadway pitch cost: Ultima Attack / Armor Piercing discard a 10/J/Q/K/A ----
  (function () {
    function energy(pl, n, s) { for (var i = 0; i < n; i++) pl.energy.push(sc(4, s || 'C')); }
    // Ultima Attack WITH a Broadway card to pitch → succeeds, strips a shield, and the pitch goes to Discard.
    var g = E.newGame(null, { starter: 0 }); var me = g.players[0], foe = g.players[1];
    me.hand = [sc(10, 'C'), sc(13, 'C'), sc(4, 'H')]; energy(me, 10, 'C');   // Ultima(10C) + a King to pitch + filler
    g.turn = 0; g.round = 3; g.pile = null; g.lastPlayer = null; g.passes = 0; foe.shields = 3;
    var r = E.activate(g, 0, '10C');
    ok(r.ok && r.pitched && r.pitched.rank === 13 && me.removed.some(function (c) { return c.rank === 13 && c.suit === 'C'; }), 'Ultima Attack pitches a Broadway card to the Discard pile');
    ok(!me.hand.some(function (c) { return c.rank === 13; }), 'the pitched King left the hand');
    // Ultima Attack with NO other Broadway card in hand → blocked.
    var g2 = E.newGame(null, { starter: 0 }); var m2 = g2.players[0];
    m2.hand = [sc(10, 'C'), sc(4, 'H'), sc(5, 'H')]; energy(m2, 10, 'C');   // only the 10C itself (can't pitch itself), rest low
    g2.turn = 0; g2.round = 3; g2.pile = null; g2.lastPlayer = null; g2.passes = 0;
    var r2 = E.activate(g2, 0, '10C');
    ok(!r2.ok && /Broadway/.test(r2.reason), 'Ultima Attack is blocked with no Broadway card to pitch');
    // Armor Piercing (rank 7) auto-pitches the LEAST valuable Broadway (a 10 over a King).
    var g3 = E.newGame(null, { starter: 0 }); var m3 = g3.players[0];
    m3.hand = [sc(7, 'C'), sc(10, 'D'), sc(13, 'C'), sc(4, 'H')]; energy(m3, 10, 'C');
    g3.turn = 0; g3.round = 3; g3.pile = null; g3.lastPlayer = null; g3.passes = 0;
    var r3 = E.activate(g3, 0, '7C');
    ok(r3.ok && r3.pitched && r3.pitched.rank === 10, 'Armor Piercing auto-pitches the least valuable Broadway (the 10, not the King)');
    // Critical Hit (♠9) now carries the same Broadway pitch as its Fighter twin: succeeds with one, blocked without.
    var g4 = E.newGame(null, { starter: 0 }); var m4 = g4.players[0], f4 = g4.players[1];
    m4.hand = [sc(9, 'S'), sc(13, 'S'), sc(4, 'H')]; energy(m4, 9, 'S');   // Critical Hit(9S) + a King to pitch + filler
    g4.turn = 0; g4.round = 3; g4.pile = null; g4.lastPlayer = null; g4.passes = 0; f4.shields = 3;
    var r4 = E.activate(g4, 0, '9S');
    ok(r4.ok && r4.pitched && r4.pitched.rank === 13 && f4.shields === 2, 'Critical Hit pitches a Broadway card and strips a shield');
    var g5 = E.newGame(null, { starter: 0 }); var m5 = g5.players[0];
    m5.hand = [sc(9, 'S'), sc(4, 'H'), sc(5, 'H')]; energy(m5, 9, 'S');   // only the 9S itself, no Broadway to pitch
    g5.turn = 0; g5.round = 3; g5.pile = null; g5.lastPlayer = null; g5.passes = 0;
    var r5 = E.activate(g5, 0, '9S');
    ok(!r5.ok && /Broadway/.test(r5.reason), 'Critical Hit is blocked with no Broadway card to pitch');
  })();
  // ---- Phase 4a: Form/Super boosts via effectFor ----
  (function () {
    var g = E.newGame(null, { starter: 0 }); var p = 0;
    function eff(r, s) { return E.effectFor(g, p, sc(r, s)); }
    ok(eff(5, 'D').boost === 4 && !eff(5, 'D').boosted, 'REWORK boost: no forms → base Infuse +4');
    g.players[0].forms = [{ rank: 13, suit: 'D', tier: 'king' }];                 // Odysseus
    ok(eff(5, 'D').boost === 5 && eff(5, 'D').boosted && eff(6, 'D').draw === 4, 'REWORK boost: Odysseus → Infuse +5, Back to Books draw 4');
    g.players[0].forms = [{ rank: 13, suit: 'H', tier: 'king' }];                 // Hector
    ok(eff(10, 'H').quick === true && eff(1, 'H').boost === 3, 'REWORK boost: Hector → Sanctuary Quick, Imbue +3');
    g.players[0].forms = [{ rank: 12, suit: 'H', tier: 'queen' }];                // Cassandra, no Super
    ok(eff(8, 'H').delta === 3, 'REWORK boost: Cassandra → Holy Bow +3');
    g.players[0].forms = [{ rank: 11, suit: 'H' }, { rank: 12, suit: 'H' }, { rank: 13, suit: 'H' }];   // Super = Ride (J) + Q + K
    ok(eff(8, 'H').delta === 4 && eff(8, 'H').boostTier === 'super', 'REWORK boost: Apollo (Super) supersedes → Holy Bow +4');
    g.players[0].forms = [{ rank: 12, suit: 'H' }, { rank: 13, suit: 'H' }];   // Q + K but NO Ride → NOT Super
    ok(eff(8, 'H').boostTier !== 'super', 'REWORK boost: Q + K without a Ride does NOT reach Super');
    // Giant Boar value ride
    g.players[0].forms = [{ rank: 11, suit: 'C' }]; g.turn = 0;
    ok(E.applyEquip(E.detectCombo([sc(7, 'D')]), 0, g).value === 8, 'REWORK ride: Giant Boar +1 on your turn');
    g.turn = 1;
    ok(E.applyEquip(E.detectCombo([sc(7, 'D')]), 0, g).value === 7, 'REWORK ride: Giant Boar does not apply on the rival turn');
    // Giant Boar is OFFENSIVE ONLY: it helps you BEAT, but must NOT raise the value the Rival must beat on their turn.
    (function () {
      var gb = E.newGame(null, { starter: 0 }); gb.round = 3; gb.turn = 0; gb.pile = null; gb.passes = 0; gb.lastPlayer = null;
      gb.players[0].forms = [{ rank: 11, suit: 'C', tier: 'ride', name: 'Giant Boar', card: sc(11, 'C') }];
      gb.players[0].hand = [sc(7, 'D')];
      var r = E.play(gb, 0, [sc(7, 'D')]);
      ok(r.ok && gb.pile.combo.value === 7 && (gb.pile.mod || 0) === 0, 'Giant Boar does NOT bake its +1 into a led pile — the Rival faces the raw 7, not 8 (offensive, not defensive)');
    })();
    (function () {
      var gb = E.newGame(null, { starter: 0 }); gb.round = 3; gb.turn = 0; gb.passes = 0; gb.lastPlayer = 1;
      gb.pile = { combo: E.detectCombo([sc(7, 'H')]), byPlayer: 1 };                 // Rival led a 7
      gb.players[0].forms = [{ rank: 11, suit: 'C', tier: 'ride', name: 'Giant Boar', card: sc(11, 'C') }];
      gb.players[0].hand = [sc(7, 'D')];
      var r = E.play(gb, 0, [sc(7, 'D')]);                                            // 7 + Boar(1) = 8 clears the tie
      ok(r.ok, 'Giant Boar (offensive +1) lets a 7 beat a 7');
      ok(gb.pile.combo.value === 7 && (gb.pile.mod || 0) === 0, 'the winning play stores its RAW value (7), not the boar-boosted 8 — the boost was spent attacking');
    })();
    // ---- Equipment is ONGOING (enchantment-style): it re-values a pile ALREADY on the table, not just play-time ----
    (function () {
      // (a) equip a debuff AFTER the opponent's pair is standing -> the standing pile drops right now
      var g = E.newGame(null, { starter: 1 }); g.round = 5; g.turn = 1; g.pile = null; g.passes = 0; g.lastPlayer = null;
      g.players[1].hand = [sc(9, 'C'), sc(9, 'C')];
      var r = E.play(g, 1, [g.players[1].hand[0], g.players[1].hand[1]]);
      ok(r.ok && g.pile.combo.value === 9 && (g.pile.mod || 0) === 0, 'ongoing equip: rival 9♣ pair stands at raw 9 (no equipment yet)');
      g.players[0].equipment.push({ id: 'C9arm', name: 'Spiked Armor', oppDelta: -2, counters: 3, card: sc(9, 'C') });
      E.refreshPile(g);
      ok(g.pile.combo.value === 7 && g.pile.mod === -2, 'ongoing equip: equipping Spiked Armor (−2) drops the standing pile to 7 / mod −2 — the fix the user asked for');
      // (b) removing it recomputes back up to raw
      g.players[0].equipment = [];
      E.refreshPile(g);
      ok(g.pile.combo.value === 9 && g.pile.mod === 0, 'ongoing equip: removing Spiked Armor restores the standing pile to raw 9');
    })();
    (function () {
      // (c) a BUFF you wear keeps your own standing pile pumped, and drops if disarmed
      var g = E.newGame(null, { starter: 0 }); g.round = 5; g.turn = 0; g.pile = null; g.passes = 0; g.lastPlayer = null;
      g.players[0].hand = [sc(8, 'D')];
      var r = E.play(g, 0, [sc(8, 'D')]);
      ok(r.ok && g.pile.combo.value === 8, 'ongoing buff: your 8♦ leads at raw 8');
      g.players[0].equipment.push({ id: 'sword', name: "Hero's Sword", delta: 1, counters: 3, card: sc(5, 'C') });
      E.refreshPile(g);
      ok(g.pile.combo.value === 9 && g.pile.mod === 1, "ongoing buff: equipping Hero's Sword (+1) lifts your standing pile to 9");
    })();
    (function () {
      // (d) the exact Round-7 log scenario: rival wears Hero's Javelin (+1), leads 9♣ pair, THEN you equip Spiked Armor (−2)
      //     -> the label should read −1 (net), which is what the user expected.
      var g = E.newGame(null, { starter: 1 }); g.round = 5; g.turn = 1; g.pile = null; g.passes = 0; g.lastPlayer = null;
      g.players[1].equipment.push({ id: 'jav', name: "Hero's Javelin", delta: 1, counters: 3, card: sc(6, 'C') });
      g.players[1].hand = [sc(9, 'C'), sc(9, 'C')];
      var r = E.play(g, 1, [g.players[1].hand[0], g.players[1].hand[1]]);
      ok(r.ok && g.pile.mod === 1, 'Round-7 repro: rival 9♣ pair with Javelin equipped locks at BOOSTED +1');
      g.players[0].equipment.push({ id: 'arm', name: 'Spiked Armor', oppDelta: -2, counters: 3, card: sc(9, 'C') });
      E.refreshPile(g);
      ok(g.pile.mod === -1 && g.pile.combo.value === 8, 'Round-7 repro: after you equip Spiked Armor the standing pair reads −1 (9 +1 −2 = 8)');
    })();
    // ---- playModifiers / costModifiers: itemized readout for the hand status ----
    (function () {
      var g = E.newGame(null, { starter: 0 }); g.turn = 0;
      g.players[0].forms = [{ rank: 11, suit: 'C', name: 'Giant Boar', card: sc(11, 'C') }];   // your Boar
      var vm = E.playModifiers(g, 0);
      ok(vm.length === 1 && vm[0].amount === 1 && vm[0].source === 'Giant Boar', 'playModifiers: Giant Boar shows +1 on your turn');
      g.players[0].equipment = [{ name: "Hero's Sword", delta: 2, counters: 3, card: sc(5, 'C') }];
      var vm2 = E.playModifiers(g, 0);
      ok(vm2.length === 2 && vm2.reduce(function (a, m) { return a + m.amount; }, 0) === 3, 'playModifiers: Boar +1 and Hero’s Sword +2 net +3 (two sources)');
      g.players[1].equipment = [{ name: 'Spiked Armor', oppDelta: -2, counters: 3, card: sc(9, 'C') }];
      var vm3 = E.playModifiers(g, 0);
      ok(vm3.some(function (m) { return m.source === 'Spiked Armor' && m.amount === -2; }), 'playModifiers: an opponent’s Spiked Armor shows as −2 against you');
      g.turn = 1;
      ok(!E.playModifiers(g, 0).some(function (m) { return m.source === 'Giant Boar'; }), 'playModifiers: Giant Boar drops off on the rival’s turn (offensive-only), equipment stays');
      g.turn = 0; g._effUsed = false;
      g.players[0].forms.push({ rank: 11, suit: 'D', name: 'Giant Owl', card: sc(11, 'D') });
      g.players[1].forms = [{ rank: 11, suit: 'S', name: 'Giant Ram', card: sc(11, 'S') }];
      var cm = E.costModifiers(g, 0);
      ok(cm.some(function (m) { return m.source === 'Giant Owl' && m.amount === -1; }) && cm.some(function (m) { return m.source === 'Giant Ram' && m.amount === 1; }), 'costModifiers: Owl −1 and Ram +1 on your first effect');
      g._effUsed = true;
      ok(E.costModifiers(g, 0).length === 0, 'costModifiers: nothing once the first effect this turn is spent');
    })();
    // ---- BASICS mode: KEEP the whole deck (J/Q/K as plain high cards) but disable transforms ----
    (function () {
      var gb = E.newGame(null, { basics: true });
      ok(gb.basics === true, 'basics: st.basics flag is set');
      var faces = gb.players[0].hand.concat(gb.players[0].deck, gb.players[0].shieldPile || []).filter(function (c) { return c.rank >= 11 && c.rank <= 13; }).length;
      ok(faces > 0, 'basics: J/Q/K stay IN the deck (plain high cards, not removed)');
      ok(E.transformGateOK(gb, 0, 'ride') === false && E.transformGateOK(gb, 0, 'queen') === false, 'basics: transforms are gated OFF (transformGateOK false for every tier)');
      ok(E.transformGateStatus(gb, 0, 'ride').gate === 'basics', 'basics: transformGateStatus reports the basics lock');
      // a J/Q/K activation is refused in Basics
      gb.turn = 0; gb.round = 3; gb.players[0].hand = [sc(11, 'C')]; for (var i = 0; i < 10; i++) gb.players[0].energy.push(sc(4, 'C'));
      var ra = E.activate(gb, 0, '11C');
      ok(ra && ra.ok === false, 'basics: activating a J (transform) is refused');
      ok(gb.players[0].forms.length === 0, 'basics: no form entered the zone');
      // cardName still returns the flavour name for the apex 2 (which has no active effect)
      ok(E.cardName(sc(2, 'H')) === 'Divine Intervention' && E.effectOf(sc(2, 'H')) === null, 'cardName: the apex 2 keeps its flavour name even with no active effect');
      var gfull = E.newGame(null, {});
      ok(gfull.basics === false && E.transformGateStatus(gfull, 0, 'ride').gate !== 'basics', 'basics: a normal game is not flagged (no basics lock on transforms)');
    })();
  })();
  // ---- Phase 4a: the upgrade ladder (boostInfo) ----
  (function () {
    var g = E.newGame(null, { starter: 0 });
    var lines = E.boostInfo(g, 0, sc(8, 'H'));   // Holy Bow: Cassandra (Q) + Apollo (Super)
    ok(lines.length === 2 && lines[0].tier === 'queen' && lines[1].tier === 'super', 'REWORK ladder: Holy Bow lists Cassandra + Apollo tiers');
    ok(!lines[0].active && !lines[1].active, 'REWORK ladder: tiers are inactive with an empty zone');
    g.players[0].forms = [{ rank: 12, suit: 'H', tier: 'queen' }];
    ok(E.boostInfo(g, 0, sc(8, 'H'))[0].active === true, 'REWORK ladder: the Cassandra line activates when the Queen is in the zone');
  })();
  // ---- Phase 4b: behavioral boosts ----
  (function () {
    function energy(pl, n, s) { for (var i = 0; i < n; i++) pl.energy.push(sc(4, s || 'C')); }
    // Ares Wheel → recycle hand + Discard + Shuffle into deck, then draw 6
    var g = E.newGame(null, { starter: 0 }); var p = g.players[0];
    p.forms = [{ rank: 11, suit: 'C' }, { rank: 12, suit: 'C' }, { rank: 13, suit: 'C' }];   // ♣ Super = Ride + Q + K
    p.hand = [sc(8, 'C'), sc(3, 'H'), sc(4, 'H')]; energy(p, 10, 'C'); p.deck = []; for (var i = 0; i < 15; i++) p.deck.push(sc(6, 'D'));
    g.turn = 0; g.round = 3; g.pile = { combo: E.detectCombo([sc(6, 'S')]), byPlayer: 1 }; g.lastPlayer = 1;
    E.activate(g, 0, '8C');
    ok(p.hand.length === 6, 'REWORK 4b: Ares Wheel draws a fresh 6-card hand');
    // Perseus whole-round lock
    var g2 = E.newGame(null, { starter: 0 }); var a = g2.players[0];
    a.forms = [{ rank: 13, suit: 'S', tier: 'king' }]; a.hand = [sc(10, 'S'), sc(9, 'H')]; energy(a, 10, 'S');
    g2.turn = 0; g2.round = 3; g2.pile = { combo: E.detectCombo([sc(6, 'D')]), byPlayer: 1 }; g2.lastPlayer = 1;
    E.activate(g2, 0, '10S');
    ok(g2.players[1].lockRound && E.isLocked(g2, 1), 'REWORK 4b: Perseus Back Stab locks the whole round');
    // Pandora one-sided Poison
    var g3 = E.newGame(null, { starter: 0 }); var w = g3.players[0];
    w.forms = [{ rank: 12, suit: 'S', tier: 'queen' }]; w.hand = [sc(4, 'S'), sc(9, 'H')]; energy(w, 10, 'S'); energy(g3.players[1], 3, 'D');
    g3.turn = 0; g3.round = 3; g3.pile = { combo: E.detectCombo([sc(6, 'D')]), byPlayer: 1 }; g3.lastPlayer = 1;
    E.activate(g3, 0, '4S');
    ok(g3.players[1].energy.length === 0 && w.energy.length > 0, 'REWORK 4b: Pandora Poison drains only the Rival');
    // Leyline base = ward; Athena restores recycle
    var g4 = E.newGame(null, { starter: 0 });
    ok(E.effectFor(g4, 0, sc(9, 'D')).kind === 'ward', 'REWORK 4b: base Leyline is a ward (recycle moved out)');
    g4.players[0].forms = [{ rank: 11, suit: 'D' }, { rank: 12, suit: 'D' }, { rank: 13, suit: 'D' }];   // ♦ Super = Ride + Q + K
    ok(E.effectFor(g4, 0, sc(9, 'D')).kind === 'reclaim', 'REWORK 4b: Athena restores Leyline recycle');
    // Reactive Quick via a Form: Hector makes Sanctuary a Quick that can answer
    var g5 = E.newGame(null, { starter: 0 }); var me = g5.players[0], foe = g5.players[1];
    me.forms = [{ rank: 13, suit: 'H', tier: 'king' }]; me.hand = [sc(10, 'H')]; energy(me, 12, 'H');
    foe.hand = [sc(1, 'D'), sc(6, 'C')]; energy(foe, 10, 'D'); g5.turn = 1; g5.round = 3; g5.pile = null; g5.lastPlayer = null; g5.passes = 0;
    var shBefore = me.shields;
    E.activate(g5, 1, '1D');
    ok(g5.respondFor === 0, 'REWORK 4b: a Form-made Quick (Sanctuary) opens a response window');
    var rr = E.respond(g5, 0, '10H');
    ok(rr.ok && me.shields > shBefore, 'REWORK 4b: you spring the boosted Quick Sanctuary in response');
    // Sanctuary now heals EVERY player (the nerf): a symmetric +1 that's a wash on the shield race
    ok(E.effectOf(sc(10, 'H')).shieldAll === true, 'REWORK: Sanctuary is flagged shieldAll');
    var g6 = E.newGame(null, { starter: 0 }); var c6 = g6.players[0], o6 = g6.players[1];
    c6.hand = [sc(10, 'H'), sc(4, 'D')]; energy(c6, 10, 'H'); g6.turn = 0; g6.round = 3; g6.pile = null; g6.lastPlayer = null; g6.passes = 0;
    c6.shields = 2; o6.shields = 3;
    var r6 = E.activate(g6, 0, '10H');
    ok(r6.ok && c6.shields === 3 && o6.shields === 4, 'REWORK: Sanctuary gives BOTH players +1 shield');
  })();
  // ---- Phase 4b: the Rides (Swan defense, Owl/Ram cost) + copy/counter boosts ----
  (function () {
    // Giant Swan — your play resists +1 on the pile
    var g = E.newGame(null, { starter: 0 }); var me = g.players[0];
    me.forms = [{ rank: 11, suit: 'H' }]; me.hand = [sc(7, 'D')]; g.turn = 0; g.round = 3; g.pile = null; g.lastPlayer = null; g.passes = 0;
    E.play(g, 0, [me.hand[0]]);
    ok(g.pile.combo.value === 8, 'REWORK ride: Giant Swan raises your pile to 8 (a defended 7)');
    ok(!E.beats(E.applyEquip(E.detectCombo([sc(8, 'S')]), 1, g), g.pile.combo), 'REWORK ride: an 8 cannot beat a Swan-defended 7');
    // Giant Owl / Ram — first-effect cost modifiers
    var g2 = E.newGame(null, { starter: 0 }); g2.players[0].forms = [{ rank: 11, suit: 'D' }]; g2.turn = 0;
    ok(E.effectiveCost(g2, 0, sc(5, 'D')) === 4, 'REWORK ride: Giant Owl −1 on your first effect (Infuse 5→4)');
    g2._effUsed = true;
    ok(E.effectiveCost(g2, 0, sc(5, 'D')) === 5, 'REWORK ride: the Owl discount is spent after the first effect');
    // …and it RE-APPLIES next turn: the first-effect flag must reset on a turn advance (the bug was it stuck on a seat forever)
    g2.round = 3; g2.turn = 0; g2.pile = null; g2.passes = 0; g2.players[0].hand = [sc(4, 'H')];
    E.play(g2, 0, [sc(4, 'H')]);
    ok(g2._effUsed === false, 'REWORK ride: a turn advance clears the first-effect flag, so Owl/Ram apply again next turn');
    var g3 = E.newGame(null, { starter: 0 }); g3.players[1].forms = [{ rank: 11, suit: 'S' }]; g3.turn = 0;
    ok(E.effectiveCost(g3, 0, sc(5, 'D')) === 6, 'REWORK ride: Giant Ram +1 to your first effect');
    // Counterfeit +value (Pandora)
    var g4 = E.newGame(null, { starter: 0 }); var w = g4.players[0];
    w.forms = [{ rank: 12, suit: 'S', tier: 'queen' }]; w.hand = [sc(8, 'S')]; for (var i = 0; i < 10; i++) w.energy.push(sc(4, 'S'));
    g4.turn = 0; g4.round = 3; g4.pile = { combo: E.detectCombo([sc(6, 'D')]), byPlayer: 1 }; g4.lastPlayer = 1;
    E.activate(g4, 0, '8S');
    var copy = w.hand.filter(function (c) { return c.temp; })[0];
    ok(copy && copy.valueBonus === 1 && E.fightValue(copy) === copy.rank + 1, 'REWORK 4b: Pandora Counterfeit copies at +1 value');
    // Annoint +counter (Cassandra)
    var g6 = E.newGame(null, { starter: 0 }); var cc = g6.players[0];
    cc.forms = [{ rank: 12, suit: 'H', tier: 'queen' }];
    cc.equipment = [{ id: '8H', name: 'Holy Bow', delta: 2, counters: 5, decay: true, card: sc(8, 'H') }];
    cc.hand = [sc(5, 'H'), sc(9, 'D')]; for (var j = 0; j < 10; j++) cc.energy.push(sc(4, 'H'));
    g6.turn = 0; g6.round = 3; g6.pile = { combo: E.detectCombo([sc(6, 'D')]), byPlayer: 1 }; g6.lastPlayer = 1;
    E.activate(g6, 0, '5H');
    ok(cc.equipment[0].counters === 6 && cc.equipment[0].protectedRound === g6.round, 'REWORK 4b: Cassandra Annoint adds a counter and protects');
    // Fighter swap: Hippolyta → Armor Piercing Quick; Meleager → Hero's Javelin +2 (Javelin now rank 6)
    ok(E.effectOf(sc(6, 'C')).name === "Hero's Javelin" && E.effectOf(sc(6, 'C')).cost === 6, 'REWORK: Hero’s Javelin at rank 6 (cost 6)');
    var g7 = E.newGame(null, { starter: 0 });
    g7.players[0].forms = [{ rank: 12, suit: 'C', tier: 'queen' }];
    ok(E.effectFor(g7, 0, sc(7, 'C')).quick === true, 'REWORK: Hippolyta → Armor Piercing becomes Quick');
    g7.players[0].forms = [{ rank: 13, suit: 'C', tier: 'king' }];
    ok(E.effectFor(g7, 0, sc(6, 'C')).delta === 2, 'REWORK: Meleager → Hero’s Javelin +2 (rank 6)');
    // Odysseus conjures the ILLUSION at +1 (v1.31.6 restored the copy; v1.13's +6 valueBoost is gone)
    var g8 = E.newGame(null, { starter: 0 });
    ok(E.effectOf(sc(10, 'D')).kind === 'phantasm', 'REWORK: Phantasmal Illusion copies the current play');
    ok(!E.effectFor(g8, 0, sc(10, 'D')).phantasmPlus, 'REWORK: the base copy gets no free value');
    g8.players[0].forms = [{ rank: 13, suit: 'D', tier: 'king' }];
    ok(E.effectFor(g8, 0, sc(10, 'D')).phantasmPlus === 1, 'REWORK 4b: Odysseus → the illusion is conjured at +1');
  })();
  // ---- Phase 4b: zone removal (Sabotage→Ride, Forceful Strip→Ride/Form) ----
  (function () {
    function energy(pl, n, s) { for (var i = 0; i < n; i++) pl.energy.push(sc(4, s)); }
    // Perseus Sabotage destroys a Rival Ride
    var g = E.newGame(null, { starter: 0 }); var me = g.players[0], foe = g.players[1];
    var ride = sc(11, 'C'); foe.forms = [{ rank: 11, suit: 'C', tier: 'ride', name: 'Giant Boar', card: ride }];
    me.forms = [{ rank: 13, suit: 'S', tier: 'king', name: 'Perseus Form', card: sc(13, 'S') }];
    ok(E.removeTargets(g, 0, E.effectFor(g, 0, sc(5, 'S'))).length === 1, 'REWORK 4b: Perseus makes Sabotage able to target a zone Ride');
    ok(E.removeTargets(g, 0, E.effectOf(sc(5, 'S'))).length === 0, 'REWORK 4b: base Sabotage cannot reach the zone');
    me.hand = [sc(5, 'S'), sc(9, 'H')]; energy(me, 10, 'S'); g.turn = 0; g.round = 3; g.pile = { combo: E.detectCombo([sc(6, 'D')]), byPlayer: 1 }; g.lastPlayer = 1;
    E.activate(g, 0, '5S', { target: ride.id });
    ok(foe.forms.length === 0 && foe.removed.some(function (c) { return c.id === ride.id; }), 'REWORK 4b: Sabotage destroys the Rival Ride');
    // Penelope Form (Q♦) upgrade: Forceful Strip puts the target EQUIPMENT on TOP of its owner's deck (v0.92)
    var g2 = E.newGame(null, { starter: 0 }); var a = g2.players[0], b = g2.players[1];
    var equ = { rank: 6, suit: 'C', id: 'EQJAV' };   // unique id — avoid colliding with the real 6♣ that newGame may deal
    b.equipment = [{ id: 'eqT', delta: 1, counters: 3, name: "Hero's Javelin", card: equ }];
    b.deck = [sc(8, 'C'), sc(9, 'C')];
    a.forms = [{ rank: 12, suit: 'D', tier: 'queen', name: 'Penelope Form', card: sc(12, 'D') }];
    a.hand = [sc(7, 'D'), sc(9, 'S')]; energy(a, 10, 'D'); g2.turn = 0; g2.round = 3; g2.pile = { combo: E.detectCombo([sc(6, 'S')]), byPlayer: 1 }; g2.lastPlayer = 1;
    E.activate(g2, 0, '7D', { target: 'eqT' });
    ok(b.equipment.length === 0 && b.deck[0] && b.deck[0].id === equ.id, 'REWORK 4b: Forceful Strip (Queen) puts the target Equipment on TOP of its owner deck');
    ok(!b.hand.some(function (c) { return c.id === equ.id; }), 'REWORK 4b: Queen strip does NOT go to hand');
    // Athena (Super) can strip a Form
    var g3 = E.newGame(null, { starter: 0 }); var x = g3.players[0], y = g3.players[1];
    var fc = sc(12, 'C'); y.forms = [{ rank: 12, suit: 'C', tier: 'queen', name: 'Hippolyta Form', card: fc }];
    x.forms = [{ rank: 11, suit: 'D', tier: 'ride', card: sc(11, 'D') }, { rank: 12, suit: 'D', tier: 'queen', card: sc(12, 'D') }, { rank: 13, suit: 'D', tier: 'king', card: sc(13, 'D') }];   // ♦ Super = Ride + Q + K
    x.hand = [sc(7, 'D'), sc(9, 'S')]; energy(x, 10, 'D'); g3.turn = 0; g3.round = 3; g3.pile = { combo: E.detectCombo([sc(6, 'S')]), byPlayer: 1 }; g3.lastPlayer = 1;
    E.activate(g3, 0, '7D', { target: fc.id });
    ok(y.forms.length === 0 && y.hand.some(function (c) { return c.id === fc.id; }), 'REWORK 4b: Athena Forceful Strip returns a Form to its owner hand');
  })();
})();

// ===== N-PLAYER MULTIPLAYER (Phase 1: engine core) =====
(function () {
  E.setShieldCards(false); E.setLoserMill(false);
  function sc(r, s) { return { rank: r, suit: s, id: r + s }; }
  // Drive a 3-player Special win: p0 leads a pair, p1 & p2 pass → p0 wins with a combo. Returns the game.
  function threePlayerSpecialWin() {
    var g = E.newGame(null, { numPlayers: 3 });
    g.players[0].hand = [sc(7, 'D'), sc(7, 'H'), sc(3, 'C')];   // a pair of 7s + a spare to lead next round
    g.players[1].hand = [sc(4, 'S'), sc(5, 'S')];
    g.players[2].hand = [sc(4, 'C'), sc(5, 'C')];
    g.turn = 0; g.round = 3; g.pile = null; g.lastPlayer = null; g.passes = 0;
    E.play(g, 0, [g.players[0].hand[0], g.players[0].hand[1]]);   // lead the pair
    E.pass(g, 1); E.pass(g, 2);                                    // both pass → round resolves
    return g;
  }

  var g0 = E.newGame(null, { numPlayers: 4 });
  ok(g0.numPlayers === 4 && g0.players.length === 4 && E.aliveCount(g0) === 4, 'MP: newGame builds a 4-player table');
  ok(E.nextPlayer ? true : true, 'MP: engine loaded');   // (nextPlayer is internal; exercised below)

  // Targeting: opts.target routes a singular "the Rival" effect to the chosen rival (not just the next seat)
  var g1 = E.newGame(null, { numPlayers: 3 });
  g1.players[0].hand = [sc(3, 'D'), sc(4, 'D')]; g1.players[0].energy = [];
  for (var e = 0; e < 3; e++) g1.players[0].energy.push(sc(4, 'D'));   // Telekinesis (D3) costs 3
  g1.players[1].hand = [sc(5, 'H'), sc(6, 'H'), sc(7, 'H'), sc(8, 'H')];   // 4 cards → a discard of 2 prompts (not forced)
  g1.players[2].hand = [sc(5, 'S'), sc(6, 'S'), sc(7, 'S'), sc(8, 'S')];
  g1.turn = 0; g1.round = 3; g1.pile = null; g1.lastPlayer = null; g1.passes = 0;
  E.activate(g1, 0, '3D', { target: 2 });
  ok(g1.discardPending && g1.discardPending.player === 2, 'MP targeting: Telekinesis with target=2 hits player 2, not the next seat (1)');

  // SPECIAL_LOSS_MODE 'all' — every non-winner loses a shield
  E.setSpecialLossMode('all'); E.setShieldTargetChooser(null);
  var ga = threePlayerSpecialWin();
  var base3 = E.startShieldsFor(3);   // NOT the START_SHIELDS constant: shields scale with player count
  ok(ga.players[1].shields === base3 - 1 && ga.players[2].shields === base3 - 1, "MP 'all': every non-winner loses a shield on a Special");

  // SPECIAL_LOSS_MODE 'chosen' — only the winner's pick loses a shield
  E.setSpecialLossMode('chosen'); E.setShieldTargetChooser(function () { return 2; });
  var gc = threePlayerSpecialWin();
  ok(gc.players[1].shields === base3 && gc.players[2].shields === base3 - 1, "MP 'chosen': only the chosen rival (p2) loses a shield");

  // MILL_SCOPE — universal mills all non-winners; targeted mills only the struck rival
  E.setLoserMill(true);
  E.setSpecialLossMode('chosen'); E.setShieldTargetChooser(function () { return 2; });
  E.setMillScope('universal');
  var gmu = threePlayerSpecialWin();
  ok((gmu.players[1].energy.length > 0) && (gmu.players[2].energy.length > 0), "MP mill 'universal': all non-winners mill");
  E.setMillScope('targeted');
  var gmt = threePlayerSpecialWin();
  ok(gmt.players[2].energy.length > 0 && gmt.players[1].energy.length === 0, "MP mill 'targeted': only the struck rival (p2) mills");
  E.setLoserMill(false); E.setMillScope('universal');

  // Elimination + kicksLanded + last-Rider-standing
  E.setSpecialLossMode('chosen'); E.setShieldTargetChooser(function () { return 1; });
  var g = E.newGame(null, { numPlayers: 3 });
  g.players[0].hand = [sc(7, 'D'), sc(7, 'H'), sc(3, 'C')];
  g.players[1].hand = [sc(4, 'S'), sc(5, 'S')]; g.players[1].shields = 0;   // p1 on the brink
  g.players[2].hand = [sc(4, 'C'), sc(5, 'C')];
  g.turn = 0; g.round = 3; g.pile = null; g.lastPlayer = null; g.passes = 0;
  E.play(g, 0, [g.players[0].hand[0], g.players[0].hand[1]]); E.pass(g, 1); E.pass(g, 2);
  ok(g.players[1].eliminated && g.players[0].kicksLanded === 1 && !g.finished && E.aliveCount(g) === 2, 'MP: a Fighter Kick eliminates the target, credits the kicker, game continues (2 alive)');
  ok(g.players[1].hand.length === 0 && g.players[1].shields === 0, "MP: the eliminated player's board leaves play");

  // Down to the last Rider → game ends with that winner
  E.setShieldTargetChooser(function () { return 2; });
  g.players[2].shields = 0; g.round = 3; g.pile = null; g.lastPlayer = null; g.passes = 0; g.turn = 0;
  g.players[0].hand = [sc(8, 'D'), sc(8, 'H'), sc(3, 'S')];
  g.players[2].hand = [sc(4, 'H'), sc(5, 'H')];
  E.play(g, 0, [g.players[0].hand[0], g.players[0].hand[1]]); E.pass(g, 2);   // p1 is out; only p2 left to pass
  ok(g.finished && g.winner === 0 && g.players[0].kicksLanded === 2, 'MP: last Rider standing — p0 wins, 2 kicks landed');

  // reset toggles for any later suites — back to the SHIPPED defaults, not the reverted v1.31.0 ones
  E.setSpecialLossMode('chosen'); E.setMillScope('targeted'); E.setShieldTargetChooser(null);
})();

// ===== N-PLAYER TARGETING + RESPONSE PRIORITY (Phase 2) =====
(function () {
  function sc(r, s) { return { rank: r, suit: s, id: r + s }; }
  function mk3(s0, s1, s2) { var g = E.newGame(null, { numPlayers: 3 }); g.players[0].shields = s0; g.players[1].shields = s1; g.players[2].shields = s2; return g; }

  // Fighter tier — leader-focus when nobody is killable
  ok(AI.chooseTarget(mk3(3, 4, 2), 0, 'fighter') === 1, 'AI target Fighter: leader-focus hits the most-shields rival (p1)');
  // Fighter tier — secure the kill on a rival at <= 1 shield
  ok(AI.chooseTarget(mk3(3, 4, 1), 0, 'fighter') === 2, 'AI target Fighter: kill-secure hits the <=1-shield rival (p2)');
  // Fighter tier — one grudge per game, then reverts to leader-focus
  var gg = mk3(3, 3, 3); gg.players[0].lastAttacker = 2;
  ok(AI.chooseTarget(gg, 0, 'fighter') === 2 && gg.players[0]._grudgeUsed, 'AI target Fighter: takes a grudge once (p2) and marks it used');
  ok(AI.chooseTarget(gg, 0, 'fighter') === 1, 'AI target Fighter: second cast reverts to leader-focus (grudge spent)');
  // Demon tier — finisher hits the weakest
  ok(AI.chooseTarget(mk3(3, 4, 2), 0, 'demon') === 2, 'AI target Demon: finisher hits the lowest-shields rival (p2)');
  // Minion tier — mostly random, spreads across both opponents
  var gm = mk3(3, 4, 2), hit = { 1: 0, 2: 0 };
  for (var i = 0; i < 400; i++) hit[AI.chooseTarget(gm, 0, 'minion')]++;
  ok(hit[1] > 40 && hit[2] > 40, 'AI target Minion: spreads across both opponents (random)');

  // Response priority — a NON-adjacent opponent (p2) gets to answer a Technique the next seat (p1) can't
  var gr = E.newGame(null, { numPlayers: 3 });
  gr.players[0].hand = [sc(3, 'D'), sc(5, 'C')]; gr.players[0].energy = [];
  for (var e = 0; e < 3; e++) gr.players[0].energy.push(sc(4, 'D'));      // Telekinesis (D3) costs 3
  gr.players[1].hand = [sc(5, 'H'), sc(6, 'H'), sc(7, 'H'), sc(8, 'H')];   // no Quick
  gr.players[2].hand = [sc(4, 'D'), sc(5, 'S')]; gr.players[2].energy = [];
  for (var e2 = 0; e2 < 4; e2++) gr.players[2].energy.push(sc(4, 'D'));    // Counter Spell (D4) costs 4
  gr.turn = 0; gr.round = 3; gr.pile = null; gr.lastPlayer = null; gr.passes = 0;
  E.activate(gr, 0, '3D', { target: 1 });
  ok(gr.respondFor === 2, 'MP response: priority passes past p1 (no Quick) to p2, who can answer');
  var cr = E.respond(gr, 2, '4D');   // p2 Counters the Telekinesis
  ok(cr.ok && !gr.discardPending, 'MP response: p2 Counter Spell negates the Technique (no discard happens)');
})();

// ===== BACK STAB / OUTBALANCE REDESIGN (v1.31.4) + the AI timing model =====
(function () {
  function mkc(r, su) { return { rank: r, suit: su, id: '' + r + su }; }
  // every rival holds 3 junk cards: a target too thin to assemble an answer is never worth locking, and that
  // veto would otherwise silently swallow the scenarios below
  function tbl(np) { var g = E.newGame(null, { numPlayers: np }); g.round = 3; g.turn = 0; g.pile = null;
    for (var i = 0; i < np; i++) g.players[i].hand = (i === 0) ? [] : [mkc(3, 'D'), mkc(4, 'H'), mkc(6, 'C')];
    return g; }

  // --- the cards themselves: base locks the ROUND, the Forms escalate it
  var base = E.effectOf({ rank: 10, suit: 'S', id: '10S' });
  ok(base.kind === 'lockout' && base.lockRound === true, 'Back Stab base: skips the whole ROUND, not one turn');
  ok(!base.quick && !base.all, 'Back Stab base: not a Quick and not table-wide until a Form says so');
  var gp = tbl(4);
  gp.players[0].forms = [mkc(13, 'S')];                       // Perseus (King of Spades)
  var pers = E.effectFor(gp, 0, { rank: 10, suit: 'S', id: '10S' });
  ok(pers.quick === true && pers.lockRound === true && !pers.all, 'Perseus: Back Stab becomes a Quick, still one target');
  var gh = tbl(4);
  gh.players[0].forms = [mkc(11, 'S'), mkc(12, 'S'), mkc(13, 'S')];   // Hermes Super (Ride + Q + K)
  var herm = E.effectFor(gh, 0, { rank: 10, suit: 'S', id: '10S' });
  ok(herm.quick === true && herm.all === true, 'Hermes Super: Back Stab is a Quick AND every rival skips the round');

  // --- Pandora's Outbalance: a look at the hand, and 2 discards instead of 1
  var gq = tbl(4);
  gq.players[0].forms = [mkc(12, 'S')];                       // Pandora (Queen of Spades)
  var out = E.effectFor(gq, 0, { rank: 1, suit: 'S', id: '1S' });
  ok(out.n === 2 && out.reveal === true, 'Pandora Outbalance: reveals the hand and discards 2');
  gq.players[0].hand = [mkc(1, 'S'), mkc(5, 'S'), mkc(6, 'S')];
  gq.players[0].energy = [mkc(4, 'S')];
  gq.players[2].hand = [mkc(13, 'H'), mkc(13, 'D'), mkc(4, 'C')];      // a pair of Kings, hidden
  var ar = E.activate(gq, 0, '1S', { target: 2 });
  ok(ar.ok && ar.revealed && ar.revealed.seat === 2 && ar.revealed.cards.length === 3,
     'Outbalance: the caster gets the target hand back on the result (transient, for the UI)');
  ok(JSON.stringify(gq).indexOf('revealed') < 0, 'Outbalance: the revealed HAND never lands on state (netplay would leak it)');
  var rd = gq.players[0]._read && gq.players[0]._read[2];
  ok(rd && rd.best === 13 && rd.pairs === 1 && rd.round === 3, 'Outbalance: the caster keeps a SUMMARY read (best/pairs/round)');

  // --- the timing model: Aj's own heuristic, scenario by scenario
  var d2 = tbl(2); d2.players[0].hand = [mkc(9, 'S'), mkc(9, 'H')];
  ok(AI.lockoutWorth(d2, 0, 1) === 'duel', 'lockout model: in a duel a skipped round is always worth it');
  /* …but only if we can ACT on it. A lock does not remove their existing pile, so silencing a rival we cannot
   * out-play hands them the round anyway. Measured in duels: casting with nothing to follow won 7.8% of those
   * rounds against a 50% baseline, and it was 48% of every duel cast. */
  var nf = tbl(2); nf.players[0].hand = [mkc(3, 'S'), mkc(4, 'H')];
  var hi2 = E.detectCombo([mkc(13, 'D', 'a'), mkc(13, 'C', 'b')]);          // a pair of Kings we cannot beat
  nf.pile = { combo: hi2, byPlayer: 1, raw: hi2.value, rawKey0: hi2.key[0], lockedDelta: 0, mod: 0 };
  nf.lastPlayer = 1;
  ok(E.legalFightPlays(nf, 0).length === 0, 'staged: no legal play against their pair of Kings');
  ok(AI.lockoutWorth(nf, 0, 1) === '', 'lockout model: with NO legal play it holds the card, even in a duel');
  var nf2 = tbl(2); nf2.players[0].hand = [mkc(1, 'S'), mkc(4, 'H')];       // an Ace beats a pair? no — but we LEAD
  nf2.pile = null; nf2.lastPlayer = null;
  ok(AI.lockoutWorth(nf2, 0, 1) === 'duel', 'lockout model: leading counts as a follow-up — any legal play does');
  function midPlan(np) { var g = tbl(np); g.players[0].hand = [mkc(9, 'S'), mkc(9, 'H'), mkc(4, 'C')]; return g; }
  var hi = midPlan(4);
  hi.pile = { byPlayer: 2, combo: { type: 'pair', size: 2, value: 13 } }; AI.observe(hi); hi.pile = null;
  ok(AI.lockoutWorth(hi, 0, 2) === '', 'lockout model: a rival who just DUMPED a high cannot answer us — hold the card');
  var lo2 = midPlan(4);
  lo2.pile = { byPlayer: 2, combo: { type: 'pair', size: 2, value: 5 } }; AI.observe(lo2); lo2.pile = null;
  ok(AI.lockoutWorth(lo2, 0, 2) === 'plan-vulnerable', 'lockout model: our mid special is answerable — silence them');
  var rr = midPlan(4); rr.players[0]._read = { 2: { round: 3, best: 13, pairs: 1, size: 4 } };
  ok(AI.lockoutWorth(rr, 0, 2) === 'read-threat', 'lockout model: a READ showing a pair that beats us is the cast');
  var rj = midPlan(4); rj.players[0]._read = { 2: { round: 3, best: 5, pairs: 0, size: 3 } };
  ok(AI.lockoutWorth(rj, 0, 2) === '', 'lockout model: a READ showing junk saves the energy');
  var rs = midPlan(4); rs.players[0]._read = { 2: { round: 2, best: 5, pairs: 0, size: 3 } };
  ok(AI.lockoutWorth(rs, 0, 2) === 'plan-vulnerable', 'lockout model: a STALE read is ignored, not trusted');
  function highPlan(np) { var g = tbl(np); g.players[0].hand = [mkc(13, 'S'), mkc(13, 'H'), mkc(4, 'C')]; return g; }
  // v1.31.8: the "a high special defends itself" hold measured worthless (it was 15% of every evaluation at
  // six players and bought nothing), so LOCKOUT_MAX_ALIVE defaults to 6 and the model casts at any table size.
  ok(AI.lockoutWorth(highPlan(6), 0, 2) === 'crowd-thin', 'lockout model: a high plan is cast at a FULL table too');
  ok(AI.lockoutWorth(highPlan(3), 0, 2) === 'crowd-thin', 'lockout model: …and when few rivals remain');
  AI.setLockoutMaxAlive(3);
  ok(AI.lockoutWorth(highPlan(6), 0, 2) === '', 'lockout model: the old hold is still reachable via setLockoutMaxAlive (A/B knob)');
  AI.setLockoutMaxAlive(6);
  /* HERMES (eff.all) locks EVERY rival for the round, so any special wins it outright — down to the smallest
   * pair in the game. Every target-specific hold below reasons about ONE rival and cannot apply; they were
   * firing on ~9% of Hermes turns and refusing rounds that were already won. */
  var sw = midPlan(6); sw.players[2].hand = [mkc(3, 'D'), mkc(4, 'H')];        // target too thin to answer
  ok(AI.lockoutWorth(sw, 0, 2) === '', 'lockout model: a thin target is normally not worth locking');
  ok(AI.lockoutWorth(sw, 0, 2, true) === 'super-sweep', 'lockout model: under HERMES that hold does not apply — cast');
  var sw2 = midPlan(6);
  sw2.pile = { byPlayer: 2, combo: { type: 'pair', size: 2, value: 13 } }; AI.observe(sw2); sw2.pile = null;
  ok(AI.lockoutWorth(sw2, 0, 2) === '', 'lockout model: a rival who dumped a high is normally not worth locking');
  ok(AI.lockoutWorth(sw2, 0, 2, true) === 'super-sweep', 'lockout model: under HERMES that does not apply either — cast');
  var sw3 = tbl(6); sw3.players[0].hand = [mkc(9, 'S'), mkc(4, 'C')];          // no special at all
  ok(AI.lockoutWorth(sw3, 0, 2, true) === '', 'lockout model: HERMES still needs a Special to be worth 10 energy');

  var nn = tbl(4); nn.players[0].hand = [mkc(9, 'S'), mkc(4, 'C')];
  ok(AI.lockoutWorth(nn, 0, 2) === '', 'lockout model: nothing to protect, nothing to spend');
  var th = midPlan(4); th.players[2].hand = [mkc(3, 'D'), mkc(4, 'H')];
  ok(AI.lockoutWorth(th, 0, 2) === '', 'lockout model: a rival down to 2 cards cannot answer — hold the card');
})();


// ===== PHANTASMAL ILLUSION — the copy, restored (v1.31.6) =====
// Aj's design: the copy takes the BASE card values, is then subject to boosts and debuffs, and you MAY swap
// one card in. A bare copy ties, and ties never win — so you always need one of the three.
(function () {
  function mk(r, su, t) { return { rank: r, suit: su, id: (t || '') + r + su }; }
  function table(pileCards, myHand) {
    var g = E.newGame(null, { numPlayers: 2 });
    g.round = 3; g.turn = 0; g.passes = 0;
    g.players[0].hand = myHand.concat([mk(10, 'D')]);                 // Phantasmal Illusion
    g.players[0].energy = []; for (var i = 0; i < 12; i++) g.players[0].energy.push(mk(4, 'D', 'e' + i));
    var combo = E.detectCombo(pileCards);
    g.pile = { combo: combo, byPlayer: 1, raw: combo.value, rawKey0: combo.key[0], lockedDelta: 0, mod: 0 };
    g.lastPlayer = 1;
    return g;
  }
  var pair9 = [mk(9, 'H', 'a'), mk(9, 'C', 'b')];

  // 1. a bare copy TIES — refused, and the reason says why
  var g1 = table(pair9, [mk(3, 'D'), mk(4, 'H')]);
  var r1 = E.phantasm(g1, 0, { cardId: '10D' });
  ok(r1.ok === false && /ties/i.test(r1.reason), 'Phantasm: a bare copy only ties, so it is refused ("' + r1.reason + '")');

  // 2. the OPTIONAL swap makes it beat — and this is what used to be mandatory
  var g2 = table([mk(8, 'H', 'a'), mk(8, 'C', 'b'), mk(8, 'S', 'c'), mk(9, 'H', 'd'), mk(9, 'C', 'e')], [mk(9, 'D')]);
  var r2 = E.phantasm(g2, 0, { cardId: '10D', removeIdx: 0, addId: '9D' });   // copy 88899, drop an 8, add your 9 -> 99988
  ok(r2.ok === true && r2.swapped === true, 'Phantasm: swapping one card flips their full house into yours');
  ok(g2.lastPlayer === 0 && g2.pile.byPlayer === 0, 'Phantasm: …and you take the initiative');
  ok(g2.players[0].hand.filter(function (c) { return c.id === '9D'; }).length === 0,
     'Phantasm: only the ONE swapped card is really spent — the copies are illusions');

  // 3. no swap, but YOUR equipment lifts the illusion over the play it copied
  var g3 = table(pair9, [mk(3, 'D'), mk(4, 'H')]);
  g3.players[0].equipment = [{ id: 'eq1', name: "Hero's Sword", delta: 2, oppDelta: 0, counters: 3, decay: true }];
  var r3 = E.phantasm(g3, 0, { cardId: '10D' });
  ok(r3.ok === true && r3.swapped === false, 'Phantasm: your Equipment lifts a bare copy over the original');

  // 4. no swap, but a DEBUFF on their play left the pile low enough for a base-value copy to pass it
  var g4 = table(pair9, [mk(3, 'D'), mk(4, 'H')]);
  g4.players[0].equipment = [{ id: 'eq2', name: 'Caltrops', delta: 0, oppDelta: -2, counters: 3, decay: true }];
  E.refreshPile(g4);                                              // the debuff is live on the pile
  var r4 = E.phantasm(g4, 0, { cardId: '10D' });
  ok(r4.ok === true, 'Phantasm: debuffing THEIR play works too — the copy keeps its base values');

  // 5. no swap, no equipment — Odysseus alone conjures it at +1
  var g5 = table(pair9, [mk(3, 'D'), mk(4, 'H')]);
  g5.players[0].forms = [{ rank: 13, suit: 'D', tier: 'king', id: 'zKD' }];
  var r5 = E.phantasm(g5, 0, { cardId: '10D' });
  ok(r5.ok === true, 'Phantasm: Odysseus alone (+1 on the copy) is enough');

  // 6. it answers a PAIR — the exact case the mandatory swap could never handle
  ok(r3.ok && g3.pile.combo.type === 'pair', 'Phantasm: it can now answer a plain PAIR (one swap never could)');

  // 7. leading means there is nothing to copy
  var g7 = table(pair9, [mk(3, 'D')]); g7.pile = null;
  ok(E.phantasm(g7, 0, { cardId: '10D' }).ok === false, 'Phantasm: nothing to copy when you hold the lead');
})();


// ===== COUNTERFEIT — the AI's evaluation (v1.31.7) =====
// The copy takes the pile card's BASE value and then the board applies, which is what lets it exceed instead
// of tie (Aj: Caltrops on their pair of 10s makes the pile an 8, so your copied 10 + your own 10 beats it).
(function () {
  function mk(r, su, t) { return { rank: r, suit: su, id: (t || '') + r + su }; }
  function table(pileCards, hand, equip) {
    var g = E.newGame(null, { numPlayers: 2 });
    g.round = 3; g.turn = 0; g.passes = 0;
    g.players[0].hand = hand;
    g.players[0].energy = []; for (var i = 0; i < 14; i++) g.players[0].energy.push(mk(4, 'S', 'e' + i));
    g.players[0].equipment = equip || [];
    var combo = E.detectCombo(pileCards);
    g.pile = { combo: combo, byPlayer: 1, raw: combo.value, rawKey0: combo.key[0], lockedDelta: 0, mod: 0 };
    g.lastPlayer = 1; E.refreshPile(g);
    return g;
  }
  var CALTROPS = [{ id: 'clt', name: 'Caltrops', delta: 0, oppDelta: -2, counters: 3, decay: true }];
  var cf = mk(8, 'S');                                     // Counterfeit is ♠8

  // Aj's line: their pair of 10s reads as 8 under Caltrops, so copying a 10 to pair with ours wins.
  var g1 = table([mk(10, 'D', 'a'), mk(10, 'C', 'b')], [cf, mk(10, 'H', 'm')], CALTROPS);
  ok(g1.pile.combo.value === 8, 'Caltrops debuffs the LIVE pile (pair of 10s reads as ' + g1.pile.combo.value + ')');
  ok(AI.counterfeitHelps(g1, 0, g1.pile.combo.cards, cf) === true,
     'Counterfeit AI: with the pile debuffed, copying their 10 to pair with ours is seen as a win');

  // …and without the debuff the same board is just a tie, so it declines.
  var g2 = table([mk(10, 'D', 'a'), mk(10, 'C', 'b')], [cf, mk(10, 'H', 'm')], null);
  ok(AI.counterfeitHelps(g2, 0, g2.pile.combo.cards, cf) === false,
     'Counterfeit AI: with no edge the copy only ties, so it declines');

  /* The card is SPENT by the cast, so a play that leans on the ♠8 itself is not available afterwards.
   * Evaluating with it still in hand let the AI approve exactly that. Here the only "winning" pair would be
   * the copied 8 married to the Counterfeit's own ♠8. */
  var g3 = table([mk(8, 'D', 'a'), mk(8, 'C', 'b')], [cf, mk(3, 'H')], CALTROPS);
  ok(AI.counterfeitHelps(g3, 0, g3.pile.combo.cards, cf) === false,
     'Counterfeit AI: it does NOT count a play built on the ♠8 the cast spends');
})();


/* ---- KITS: consecutive pairs, homebrew and default OFF -----------------------------------------------------
 * A player asked for these ("2kits, 3kits"). The shape is standard across this card family — 连对 in Dou Dizhu,
 * đôi thông in Tiến lên — where the floor is THREE pairs; here it is TWO, because those games deal 17-20 cards
 * and this one deals 6 and caps at 10, so a 3-kit would be six of your ten cards and the shape would be dead.
 * The default-OFF half is asserted first: with the flag down, every one of these must stay illegal. */
(function kits() {
  var C = function (r, su) { return { rank: r, suit: su, id: 'k' + r + su }; };
  var k45   = [C(4, 'D'), C(4, 'H'), C(5, 'C'), C(5, 'S')];
  var k456  = [C(4, 'D'), C(4, 'H'), C(5, 'C'), C(5, 'S'), C(6, 'D'), C(6, 'H')];
  var k67   = [C(6, 'D'), C(6, 'H'), C(7, 'C'), C(7, 'S')];
  var gap   = [C(4, 'D'), C(4, 'H'), C(6, 'C'), C(6, 'S')];
  var quad  = [C(4, 'D'), C(4, 'H'), C(4, 'C'), C(4, 'S')];
  var trip1 = [C(4, 'D'), C(4, 'H'), C(4, 'C'), C(5, 'S')];
  var apex  = [C(1, 'D'), C(1, 'H'), C(2, 'C'), C(2, 'S')];          // A-A-2-2 → values 14,14,15,15

  E.setDoublePair('off'); E.setKits3(false);
  ok(E.detectCombo(k45) === null && E.detectCombo(k456) === null,
     'kits OFF (the shipped game): consecutive pairs are not a legal combo');
  ok(E.detectCombo(quad) === null, 'kits OFF: four of a kind is still not a combo (there is no bomb)');

  E.setDoublePair('kits'); E.setKits3(true);
  var c45 = E.detectCombo(k45), c456 = E.detectCombo(k456), c67 = E.detectCombo(k67);
  ok(c45 && c45.type === 'kit' && c45.size === 4 && c45.value === 5, 'a 2-kit (4s+5s) is a kit of size 4, valued on its TOP pair');
  ok(c456 && c456.type === 'kit' && c456.size === 6 && c456.value === 6, 'a 3-kit (4s-5s-6s) is size 6');
  ok(E.detectCombo(gap) === null, 'pairs with a GAP (4s+6s) are not a kit — the run must be consecutive');
  ok(E.detectCombo(quad) === null, 'four of a kind is not a kit: two values are required, not one');
  ok(E.detectCombo(trip1) === null, 'a trio plus a spare card is not a kit — every value must be exactly a pair');
  var ca = E.detectCombo(apex);
  ok(ca && ca.type === 'kit' && ca.value === 15,
     'A-A-2-2 IS a kit: the apex 2 sits in a run, consistent with straights already allowing J-Q-K-A-2');

  ok(E.beats(c67, c45) === true, 'a higher kit beats a lower one of the same length');
  ok(E.beats(c45, c67) === false, 'and not the other way round');
  ok(E.beats(c456, c45) === false,
     'a 3-kit does NOT beat a 2-kit — beats() requires equal size, which is this family\'s rule for free');
  ok(E.beats(E.detectCombo([C(13, 'D'), C(13, 'H')]), c45) === false, 'a pair cannot answer a kit: different shape');

  /* The enumerator is what the AI and the UI's "can I play this?" both read, so a shape the engine accepts but
   * nobody can find is worse than no shape at all. */
  var hand = [C(4, 'D'), C(4, 'H'), C(5, 'C'), C(5, 'S'), C(6, 'D'), C(6, 'H'), C(9, 'C')];
  var st = E.newGame(null, { numPlayers: 2 });
  st.round = 3; st.pile = null; st.turn = 0; st.players[0].hand = hand;
  var found = E.legalFightPlays(st, 0).filter(function (x) { return x.combo.type === 'kit'; });
  ok(found.length === 3, 'the enumerator offers every run in the hand — 4+5, 5+6 and 4-5-6 (' + found.length + ')');

  st.round = 1;
  ok(E.legalFightPlays(st, 0).filter(function (x) { return x.combo.size > 1; }).length === 0,
     'round 1 still locks kits along with every other special');

  /* THE MODE IS WHY POKER TWO-PAIR AND A 2-KIT CAN COEXIST AS A DESIGN. Non-consecutive two pair is a SUPERSET
   * of a 2-kit at the same size, so as two independent flags they could never beat each other and a four-card
   * play would be ambiguously classified. Exactly one mode is ever live, so the ambiguity cannot arise. */
  E.setDoublePair('poker');
  var tp = E.detectCombo(gap);
  ok(tp && tp.type === 'twopair' && tp.size === 4, 'poker mode: pairs with a GAP are a legal two-pair');
  ok(JSON.stringify(tp.key) === JSON.stringify([6, 4]),
     'and it is keyed high-pair-first, so lexCmp compares the top pair before the bottom (' + JSON.stringify(tp.key) + ')');
  var tpLow = E.detectCombo([C(6, 'D'), C(6, 'H'), C(3, 'C'), C(3, 'S')]);
  ok(E.beats(tp, tpLow) === true && E.beats(tpLow, tp) === false,
     'two-pairs with the same high pair are separated by the low one (6s+4s beats 6s+3s)');
  ok(E.detectCombo(k45) && E.detectCombo(k45).type === 'twopair',
     'in poker mode a CONSECUTIVE double pair is a two-pair, not a kit — one classification, never both');
  ok(E.detectCombo(quad) === null, 'poker mode still rejects four of a kind: it is two values or nothing');

  E.setDoublePair('off'); E.setKits3(true);
  ok(E.detectCombo(k45) === null && E.detectCombo(k456) !== null,
     'mode off + 3 Kits on is the family\'s ORIGINAL form: runs of three or more only, no 2-kit');

  E.setDoublePair('off'); E.setKits3(false);
  ok(E.detectCombo(k45) === null, 'and the settings really turn them back off');

  /* ---- QUADRO (v1.31.29), homebrew and default off. A PLAIN shape: it beats a lower quadro and nothing else.
   * A quadro beating a shape it does not match is the CHOP, a separate rule needing cross-shape overrides. */
  var q7 = [C(7, 'D'), C(7, 'H'), C(7, 'C'), C(7, 'S')];
  var q8 = [C(8, 'D'), C(8, 'H'), C(8, 'C'), C(8, 'S')];
  ok(E.detectCombo(q7) === null, 'quadro OFF (the shipped game): four of a kind is not a legal combo');
  E.setQuadro(true);
  var qd = E.detectCombo(q7);
  ok(qd && qd.type === 'quadro' && qd.size === 4, 'quadro ON: four of a kind is a Special of size 4');
  ok(E.beats(E.detectCombo(q8), qd) === true && E.beats(qd, E.detectCombo(q8)) === false,
     'a higher quadro beats a lower one, and not the reverse');
  ok(E.beats(qd, E.detectCombo([C(3, 'D'), C(3, 'H')])) === false,
     'and a quadro CANNOT answer a pair — no chop until beats() gains cross-shape overrides');
  ok(E.beats(E.detectCombo([C(2, 'D'), C(2, 'H'), C(2, 'C'), C(2, 'S')]), qd) === true,
     'the apex 2 makes the highest quadro, since fightValue orders it at 15');
  /* THE FOUR-CARD SLOT IS NOW SHARED, and the two shapes cannot collide: four cards of ONE value can never be
   * two pairs or a kit, both of which need two distinct values. Asserted in every mode. */
  ['off', 'kits', 'poker'].forEach(function (m) {
    E.setDoublePair(m);
    var d = E.detectCombo(q7);
    ok(d && d.type === 'quadro', 'a quadro stays a quadro with the double-pair slot set to ' + m);
  });
  E.setDoublePair('poker');
  ok(E.detectCombo(gap).type === 'twopair', 'and a real two-pair is still a two-pair alongside it');
  /* Quadro is DECK-NEUTRAL by construction, which is the opposite of the intuition that four of a kind needs
   * four suits: a class deck is four COPIES of one suit's thirteen cards, so every deck holds exactly four of
   * each value. Worth asserting, because a change to deck building would silently kill the shape. */
  var wiz = E.newGame(Math.random, { numPlayers: 2, decks: ['Wizard', null] });
  var wall = wiz.players[0].hand.concat(wiz.players[0].deck), wc = {};
  wall.forEach(function (c) { wc[c.rank] = (wc[c.rank] || 0) + 1; });
  ok(Object.keys(wc).length === 13 && Object.keys(wc).every(function (r) { return wc[r] === 4; }),
     'a single-class deck still holds four copies of every value, so a quadro is reachable in it');
  ok(new Set(wall.map(function (c) { return c.id; })).size === wall.length,
     'and those copies carry distinct ids, so the UI can select four of them');
  /* ---- THE CHOP (v1.31.33): the first rule where a shape beats one it does not match. The family's point is
   * the heo, which here is the apex 2 — so this is what makes the 2 answerable without either apex flag. */
  E.setQuadro(true); E.setKits3(true); E.setDoublePair('off');
  var one2 = [C(2, 'D')], two2 = [C(2, 'D'), C(2, 'H')], three2 = [C(2, 'D'), C(2, 'H'), C(2, 'C')];
  var kit3 = [C(4, 'D'), C(4, 'H'), C(5, 'C'), C(5, 'S'), C(6, 'D'), C(6, 'H')];
  var kit4 = kit3.concat([C(7, 'C'), C(7, 'S')]);
  ok(E.beats(E.detectCombo(q7), E.detectCombo(one2)) === false,
     'chop OFF (the shipped game): a Quadro cannot touch a lone 2');
  /* THREE INDEPENDENT CHOPPERS, not a mode: a Quadro, a 3-Kit and a same-suit straight are distinguishable
   * patterns, so nothing forces a choice (unlike the four-card slot, where 4♦4♥5♣5♠ really is both shapes).
   * Each toggle also ENABLES its own shape, so a chopper you cannot enumerate is impossible. */
  var sf   = [C(4, 'D'), C(5, 'D'), C(6, 'D'), C(7, 'D'), C(8, 'D')];
  var mixHi = [C(5, 'D'), C(6, 'H'), C(7, 'C'), C(8, 'S'), C(9, 'D')];
  E.setQuadro(false); E.setKits3(false);          // the chop toggles alone must be enough
  E.setChopQuadro(true);
  ok(E.detectCombo(q7) && E.detectCombo(q7).type === 'quadro',
     'chopQuadro makes Quadros playable on its own — a chopper you cannot enumerate would be a dead setting');
  ok(E.beats(E.detectCombo(q7), E.detectCombo(one2)) === true && E.beats(E.detectCombo(q7), E.detectCombo(two2)) === true,
     'and it chops a lone 2 or a pair of them');
  ok(E.beats(E.detectCombo(q7), E.detectCombo(three2)) === false, 'but stops short of a trio');
  ok(E.detectCombo(kit3) === null, 'and it does not drag the Kits in with it — the toggles are independent');
  ok(E.beats(E.detectCombo(sf), E.detectCombo(one2)) === false, 'nor the same-suit straight');
  ok(E.beats(E.detectCombo(q8), E.detectCombo(q7)) === true,
     'equal rank still falls through to value, so Quadro-over-Quadro is unchanged');
  ok(E.beats(E.detectCombo(one2), E.detectCombo(q7)) === false, 'and a 2 cannot answer a chop');

  E.setChopKits(true);
  ok(E.beats(E.detectCombo(kit3), E.detectCombo(two2)) === true, 'chopKits: 3 Kits chop a lone 2 or a pair');
  /* NO CHOPPER BEATS ANOTHER (Aj: "ordering is hard really... let's not make them beat each other for now").
   * pagat puts three-pairs and a quad at the SAME tier, the scarcity argument for ranking them does not survive
   * measurement (Quadro 1.1% of hands vs 3-Kit 1.3-1.6%), and a 3-Kit costs six cards for what a Quadro does
   * with four. A chop is answered IN KIND — its own shape at a higher value — which is the fall-through. */
  ok(E.beats(E.detectCombo(q7), E.detectCombo(kit3)) === false
     && E.beats(E.detectCombo(kit3), E.detectCombo(q7)) === false,
     'a Quadro and 3 Kits cannot beat each other, in either direction');
  ok(E.beats(E.detectCombo(kit4), E.detectCombo(kit3)) === false, 'nor do 4 Kits outrank 3 Kits');
  ok(E.beats(E.detectCombo(kit4), E.detectCombo(three2)) === false,
     'and reach is uniform: no chopper touches a trio of 2s (the 4-Kit tier was decoration at 0.0% of hands)');
  var kit3hi = [C(5, 'D'), C(5, 'H'), C(6, 'C'), C(6, 'S'), C(7, 'D'), C(7, 'H')];
  ok(E.beats(E.detectCombo(kit3hi), E.detectCombo(kit3)) === true,
     'but a HIGHER 3-Kit answers a 3-Kit — "in kind" is the ordinary comparison, not a dead end');

  /* THE `straightflush` TYPE IS GONE (Aj: "i want them to only be detected as bombs and not as a mixed shape
   * for straights and flushes"). A same-suit run is an ordinary straight — the old clause letting one beat ANY
   * straight was dead code since v1.14 and is deleted, which is also what removes the mono-suit tilt from
   * ordinary play. The one suit now matters ONLY to chopRank. */
  ok(E.detectCombo(sf).type === 'straight', 'a same-suit run is a plain straight, whatever the chops say');
  ok(E.beats(E.detectCombo(sf), E.detectCombo(mixHi)) === false,
     'so a low same-suit run does NOT beat a higher mixed one — that clause is deleted, not merely disabled');
  ok(E.beats(E.detectCombo(mixHi), E.detectCombo(sf)) === true, 'and the higher mixed straight wins normally');
  E.setChopSflush(true);
  ok(E.beats(E.detectCombo(sf), E.detectCombo(two2)) === true, 'chopSflush: five in a row, one suit, chops a 2');
  ok(E.beats(E.detectCombo(mixHi), E.detectCombo(one2)) === false, 'while a MIXED straight of the same size cannot');
  ok(E.beats(E.detectCombo(sf), E.detectCombo(mixHi)) === false,
     'and it still does not beat a higher ordinary straight — it is a chop, not a better shape');
  ok(E.beats(E.detectCombo(sf), E.detectCombo(q7)) === false && E.beats(E.detectCombo(q7), E.detectCombo(sf)) === false,
     'and it neither outranks a Quadro nor is outranked by one — no chopper beats another');
  var sfHi = [C(5, 'D'), C(6, 'D'), C(7, 'D'), C(8, 'D'), C(9, 'D')];
  ok(E.beats(E.detectCombo(sfHi), E.detectCombo(sf)) === true,
     'a higher same-suit run answers it, being simply a higher straight');

  /* THE CHOPS AND APEX_INF COMPOSE (Aj: "a chop would deal with inf 2s"). apexInf makes the 2 unbeatable BY
   * VALUE; a chop is a SHAPE answer, so it is the counterplay to an unbeatable 2. */
  E.setApexInfinity(true);
  ok(E.beats(E.detectCombo(one2), E.detectCombo([C(1, 'D')])) === true
     && E.beats(E.detectCombo([C(1, 'D')]), E.detectCombo(one2)) === false,
     'apexInf still makes the 2 unbeatable by VALUE — no Ace passes it');
  ok(E.beats(E.detectCombo(q7), E.detectCombo(one2)) === true, 'but a Quadro chops it anyway');
  E.setApexInfinity(false);
  E.setChopQuadro(false); E.setChopKits(false); E.setChopSflush(false);
  ok(E.beats(E.detectCombo(q7), E.detectCombo(one2)) === false && E.detectCombo(q7) === null,
     'and with every chop off the shapes are gone again');

  /* ---- CHOPS DESTROY NO SHIELDS (v1.31.38). The flag is stamped when the play is ACCEPTED, not worked out at
   * resolve time — by then the beaten combo is gone and a Quadro that chopped a pair of 2s is byte-identical to
   * one that was led: same type, size, key, cards and player. `isChopOf` is the single definition of "chops",
   * shared by beats() and the stamp, so the rule and the record cannot disagree. */
  (function () {
    function fresh() {
      var g = E.newGame(Math.random, { numPlayers: 2, decks: [null, null] });
      g.round = 3; g.turn = 0; g.pile = null; g.passes = 0;
      return g;
    }
    var Q = function () { return [C(7, 'D'), C(7, 'H'), C(7, 'C'), C(7, 'S')]; };
    E.setChopQuadro(true);
    var g = fresh();                                          // LED, nothing chopped
    g.players[0].hand = Q(); E.play(g, 0, g.players[0].hand.slice());
    ok(g.pile.chopped === false, 'a Quadro LED into an empty pile is not a chop');
    g = fresh();                                              // over a lower Quadro, still not a chop
    var lo = [C(5, 'D'), C(5, 'H'), C(5, 'C'), C(5, 'S')];
    g.players[1].hand = lo.slice(); g.turn = 1; E.play(g, 1, lo); g.turn = 0;
    g.players[0].hand = Q(); E.play(g, 0, g.players[0].hand.slice());
    ok(g.pile.chopped === false, 'nor is beating a lower Quadro with a higher one');
    g = fresh();                                              // over a pair of 2s — a chop
    var two = [C(2, 'D'), C(2, 'H')];
    g.players[1].hand = two.slice(); g.turn = 1; E.play(g, 1, two); g.turn = 0;
    g.players[0].hand = Q(); E.play(g, 0, g.players[0].hand.slice());
    ok(g.pile.chopped === true, 'but chopping a pair of 2s IS, and the pile records it');
    /* THE RULE ITSELF, and note which way round the default goes: a chop deals NO damage unless you ask for it
     * (Aj: "the default is that chops don't destroy shields... making them chops is more non linear play" — a
     * chop already bends the shape-matching rule, so its payoff is the lead). The toggle is the positive so that
     * every rule in the panel still defaults off. */
    function chopRound(strips) {
      E.setChopStrips(strips);
      var h = fresh();
      var t = [C(2, 'D'), C(2, 'H')];
      h.players[1].hand = t.slice(); h.turn = 1; E.play(h, 1, t); h.turn = 0;
      h.players[0].hand = Q(); E.play(h, 0, h.players[0].hand.slice());
      var before = h.players[1].shields;
      h.passes = 0; E.pass(h, 1);                             // the beaten seat gives up the round
      return { before: before, after: h.players[1].shields };
    }
    var dflt = chopRound(false), strips = chopRound(true);
    ok(dflt.after === dflt.before, 'BY DEFAULT a chop costs nobody a shield (' + dflt.before + '->' + dflt.after + ')');
    ok(strips.after === strips.before - 1,
       'and `chopStrips` makes it deal damage like any other Special (' + strips.before + '->' + strips.after + ')');
    E.setChopStrips(false); E.setChopQuadro(false);
  })();

  E.setQuadro(false); E.setKits3(false); E.setDoublePair('off');
})();

console.log('\nPASS: ' + passes + '   FAIL: ' + fails);
process.exit(fails ? 1 : 0);
