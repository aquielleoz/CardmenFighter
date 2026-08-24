/* ============================================================================
 * CARDMEN FIGHTER — Engine core (pure logic, no DOM)
 * ----------------------------------------------------------------------------
 * The rules engine for the Cardmen Fighter TCG. The 2-apex + Forms "rework" IS
 * the game — the old REWORK flag and the classic 1-10 ruleset were deleted in
 * v1.23.0, so there is only one ruleset here.
 *   - 52-card deck per player: ranks A,2,3..10,J,Q,K in four suits. One suit =
 *     one class (♦ Wizard, ♥ Cleric, ♣ Fighter, ♠ Rogue). Suits DO NOT beat
 *     each other; SUIT_RANK is representative/display ordering only.
 *   - Fight value (`fightValue`): 3..10 as themselves, J=11, Q=12, K=13,
 *     A=14, and the **2 is the apex at 15**. To win an exchange you must match
 *     the shape at a STRICTLY higher value (ties do not win).
 *   - Combos: single (a "jab"), pair, trio, straight (5), full house. NO flush
 *     and NO straight flush (retired in v1.14) — a same-suit run is just a
 *     straight, the same rule for every deck.
 *   - Straights: 5-card windows over fight value, lo 3..11 → 3-4-5-6-7 (lowest)
 *     .. J-Q-K-A-2 (highest); no wrap.
 *   - Duel: START_SHIELDS=4 each, START_HAND=6, DRAW_PER_ROUND=2, MAX_HAND=10.
 *   - Those are the values at EVERY player count. The v1.31.0 scaling package (shields 2+numPlayers, draw =
 *     numPlayers, loss 'all', mill 'universal') was REVERTED in v1.31.2: it fixed pacing but broke deck
 *     balance badly (PATCHNOTES 0j). The scaling remains behind setShieldsPerPlayer()/setDrawPerPlayer() for
 *     A/B only. Read values via startShieldsFor(n)/drawCountFor(st) regardless — the UI must never read the
 *     bare constants, which is how a round banner once announced "draws 2" at a table drawing 6.
 *     A round is draw → one player leads → the fight is a trick; the last
 *     unbeaten play wins. A SPECIAL (multi-card) win strips 1 shield; a jab
 *     only banks energy. Specials are locked in round 1. At 0 shields the next
 *     special win is the FIGHTER KICK → that player loses.
 *   - Energy: every card you fight banks into your energy pile. Activating a
 *     card's effect costs its number (`activationCost`): 3-10 cost themselves,
 *     A costs 1, J/Q/K cost a flat TRANSFORM_COST to move into the Forms &
 *     Rides zone, and the apex 2 has no activated effect. Spent energy cycles
 *     to the shuffle pile, which refills the deck when it runs dry.
 *   - Effects, equipment, Forms/Rides, quicks and the MP layer all live here
 *     too (EFFECTS + BASE_OVERRIDES). Still deliberately UI-free.
 * Exported as `CardmenEngine` on the global and via `module.exports`.
 * ========================================================================== */
(function (root) {
  'use strict';

  var SUITS = ['C', 'D', 'H', 'S'];
  var SUIT_SYMBOL = { C: '♣', D: '♦', H: '♥', S: '♠' };
  var SUIT_RANK = { D: 3, H: 2, S: 1, C: 0 }; // display/representative ordering only — suits DO NOT break fight ties anymore
  function suitVal(s) { return SUIT_RANK[s]; }
  function maxSuitVal(cards) { return cards.reduce(function (m, c) { return Math.max(m, suitVal(c.suit)); }, -1); }
  function lexCmp(a, b) {
    var n = Math.min(a.length, b.length);
    for (var i = 0; i < n; i++) { if (a[i] !== b[i]) return a[i] - b[i]; }
    return a.length - b.length;
  }

  function makeDeck() {
    var d = [], hi = 13;   // ranks 1-13 (adds J/Q/K = 11/12/13) → 52 cards
    for (var s = 0; s < SUITS.length; s++)
      for (var v = 1; v <= hi; v++)
        d.push({ rank: v, suit: SUITS[s], id: v + SUITS[s] });
    return d;
  }
  function shuffle(arr, rng) {
    rng = rng || Math.random;
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(rng() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function sortHand(hand) {
    return hand.slice().sort(function (a, b) {
      var va = fightValue(a), vb = fightValue(b);   // sort by ladder value (3..10, J, Q, K, A=14, 2=15) so Ace/2 sort up top
      return va !== vb ? va - vb : suitVal(b.suit) - suitVal(a.suit);
    });
  }

  // ---- combo detection ----
  function detectStraight(cards) {
    if (cards.length !== 5) return null;
    // Ordered by FIGHT VALUE — contiguous 3..15 (3..10, J=11, Q=12, K=13, A=14, apex 2=15)
    // (…10, J=11, Q=12, K=13, A=14, 2=15), so a run is 5 consecutive values just like the old 1..10.
    var rs = cards.map(fightValue).sort(function (a, b) { return a - b; });
    for (var i = 1; i < 5; i++) if (rs[i] !== rs[i - 1] + 1) return null; // consecutive & distinct
    var top = rs[4];
    var topCard = cards.filter(function (c) { return fightValue(c) === top; })[0];
    return { top: top, topCard: topCard };
  }
  function detectCombo(cards) {
    if (!cards || !cards.length) return null;
    var n = cards.length, ranks = cards.map(fightValue);   // "ranks" here = fight VALUES, not raw ranks (A=14, 2=15)
    var same = ranks.every(function (r) { return r === ranks[0]; });
    if (n === 1) return { type: 'single', value: ranks[0], size: 1, key: [ranks[0]], cards: cards };
    if (n === 2) return same ? { type: 'pair', value: ranks[0], size: 2, key: [ranks[0]], cards: cards } : null;
    if (n === 3) return same ? { type: 'trio', value: ranks[0], size: 3, key: [ranks[0]], cards: cards } : null;
    if (n === 5) {
      var counts = {}; ranks.forEach(function (r) { counts[r] = (counts[r] || 0) + 1; });
      var keys = Object.keys(counts);
      if (keys.length === 2) {
        var a = +keys[0], b = +keys[1];
        var trio = counts[a] === 3 ? a : (counts[b] === 3 ? b : null);
        var ok = (counts[a] === 3 && counts[b] === 2) || (counts[a] === 2 && counts[b] === 3);
        return (trio !== null && ok) ? { type: 'fullhouse', value: trio, size: 5, key: [trio], cards: cards } : null;
      }
      var sameSuit = cards.every(function (c) { return c.suit === cards[0].suit; });
      var st = detectStraight(cards);
      if (sameSuit && st && !NO_STRAIGHT_FLUSH) return { type: 'straightflush', value: st.top, size: 5, key: [st.top], cards: cards };
      // Plain flushes are NOT a legal special (never were). Straight flushes are also disabled by
      // default (NO_STRAIGHT_FLUSH) — a same-suit run just scores as a straight. Same rule for all decks.
      if (st) return { type: 'straight', value: st.top, size: 5, key: [st.top], cards: cards };
      return null;
    }
    return null; // 4 cards or 6+ = not a legal combo (no bomb)
  }
  function beats(cand, cur) {
    if (!cand) return false;
    if (!cur) return true;
    if (cand.type === 'straightflush' && (cur.type === 'straight' || cur.type === 'flush')) return true;
    if (cand.type !== cur.type || cand.size !== cur.size) return false;
    return lexCmp(cand.key, cur.key) > 0;
  }

  // ---- combо enumeration (representatives; used by AI + move validation) ----
  function combinations(arr, k) {
    var res = [];
    (function rec(start, acc) {
      if (acc.length === k) { res.push(acc.slice()); return; }
      for (var i = start; i < arr.length; i++) { acc.push(arr[i]); rec(i + 1, acc); acc.pop(); }
    })(0, []);
    return res;
  }
  function enumerateCombos(hand) {
    var out = [], byRank = {};                                                      // keyed by FIGHT VALUE (see fightValue: 2 is the apex)
    hand.forEach(function (c) { var v = fightValue(c); (byRank[v] = byRank[v] || []).push(c); });
    Object.keys(byRank).forEach(function (r) { byRank[r].sort(function (a, b) { return suitVal(b.suit) - suitVal(a.suit); }); });
    hand.forEach(function (c) { out.push([c]); });                                  // singles
    Object.keys(byRank).forEach(function (r) {                                      // pairs / trios
      var g = byRank[r];
      if (g.length >= 2) out.push([g[0], g[1]]);
      if (g.length >= 3) out.push([g[0], g[1], g[2]]);
    });
    var trioRanks = Object.keys(byRank).filter(function (r) { return byRank[r].length >= 3; });
    var pairRanks = Object.keys(byRank).filter(function (r) { return byRank[r].length >= 2; });
    trioRanks.forEach(function (tr) {                                               // full houses
      pairRanks.forEach(function (pr) { if (pr !== tr) out.push([byRank[tr][0], byRank[tr][1], byRank[tr][2], byRank[pr][0], byRank[pr][1]]); });
    });
    // straight windows over fight VALUE: 3-7 .. J-Q-K-A-2 (lo 3..11)
    var loMin = 3, loMax = 11;
    for (var lo = loMin; lo <= loMax; lo++) {
      var window = [lo, lo + 1, lo + 2, lo + 3, lo + 4];
      if (window.every(function (v) { return byRank[v]; })) out.push(window.map(function (v) { return byRank[v][0]; }));
    }
    var bySuit = {};
    hand.forEach(function (c) { (bySuit[c.suit] = bySuit[c.suit] || []).push(c); });
    Object.keys(bySuit).forEach(function (s) {                                      // flushes / straight flushes
      var cs = bySuit[s];
      if (cs.length >= 5) {
        var asc = cs.slice().sort(function (a, b) { return fightValue(a) - fightValue(b); });
        out.push(asc.slice(0, 5)); out.push(asc.slice(asc.length - 5));
      }
    });
    return out.map(function (cards) { return { cards: cards, combo: detectCombo(cards) }; }).filter(function (x) { return x.combo; });
  }

  // Legal fight plays for a player right now (respects: combos only from round 2,
  // must beat the pile / anything when leading).
  function legalFightPlays(state, p) {
    var cur = state.pile ? state.pile.combo : null; // pile combo is already equipment-adjusted
    var noCombos = state.round < 2;
    return enumerateCombos(state.players[p].hand).filter(function (x) {
      if (noCombos && x.combo.size > 1) return false;
      return beats(applyEquip(x.combo, p, state), cur);
    });
  }

  // ---- game state ----
  var START_HAND = 6, DRAW_PER_ROUND = 2, START_SHIELDS = 4, MAX_HAND = 10;
  /* SHIELDS = 2 + numPlayers (Aj, 2026-08-24) — flag, A/B only.
   * Companion to `all`+`universal`: that pairing makes damage scale with the table, which holds game length
   * flat at ~10 rounds but may be too SHORT for six players (live pairing runs 33). Scaling the shield pool
   * with the table gives the middle ground: 2p keeps exactly today's 4, 6p gets 8. */
  var SHIELDS_PER_PLAYER = false;     // OFF: shipping this broke deck balance and was reverted in v1.31.2 (PATCHNOTES 0j).
  function setShieldsPerPlayer(v) { SHIELDS_PER_PLAYER = !!v; }
  function isShieldsPerPlayer() { return SHIELDS_PER_PLAYER; }
  function startShieldsFor(n) { return SHIELDS_PER_PLAYER ? (2 + n) : START_SHIELDS; }
  /* APEX-2 REWORK (Aj's brother, 2026-08-24) — flag, A/B only, and explicitly a FEEL change as much as a
   * balance one. A play containing a 2 becomes UNBEATABLE (rank infinity) but strips NO shield. It converts
   * the apex from a damage tool into an INITIATIVE tool, which is interesting because initiative is the
   * scarcest thing in a free-for-all (concentration 1.6-1.9x, and 0.5 legal plays when following at 6p).
   * Two 2s of the same shape cannot beat each other — infinity is not strictly greater than infinity — so an
   * apex play is genuinely final for that round. */
  /* Aj (2026-08-24) on where the feedback comes from: in the original **chikicha** the 2 is the outright peak.
   * Here it is only 15, and boosts stack ON TOP of fightValue — a boosted Ace at 14+7 beats it (Aj has run a
   * +7). So the apex is not actually an apex, which is the complaint. That makes the minimal fix "no boost may
   * exceed the apex", and it is SEPARATE from the no-strip half of the proposal:
   *   APEX_INF     — a 2 ranks at infinity, so no boost can pass it. Shields still work normally.
   *   APEX_NOSTRIP — additionally, a winning play containing a 2 strips no shield (the literal proposal).
   * Split because the length cost measured earlier belongs entirely to the second half: an unbeatable play
   * that also deals no damage ends a round without progressing the game. */
  var APEX_INF = false, APEX_NOSTRIP = false;
  function setApexInfinity(v) { APEX_INF = !!v; }
  function setApexNoStrip(v) { APEX_NOSTRIP = !!v; }
  function isApexInfinity() { return APEX_INF; }
  function isApexNoStrip() { return APEX_NOSTRIP; }
  function hasApex(cards) { for (var i = 0; i < (cards || []).length; i++) if (cards[i] && cards[i].rank === 2) return true; return false; }
  /* "DRAW EQUAL TO THE NUMBER OF PLAYERS" (Aj's idea, 2026-08-24) — a flag, for A/B only.
   * Aimed at the constraint `optionsim.js` actually found: legal plays per turn FALL as players rise (4.5 at
   * 2p to 2.3 at 6p) because the pile is raised more times before it reaches you. A fixed draw of 2 does not
   * scale with that, so this makes the draw scale with the table instead: draw = numPlayers.
   * Note it is not simply "more cards" — hands already sit at the MAX_HAND cap 43-53% of the time in a
   * free-for-all, so the extra draw largely converts into SELECTION (you see more of your deck and keep the
   * best 10) and into CYCLING (the surplus is discarded to energy each round). Both plausibly raise option
   * quality without raising hand size. Measure with optionsim / recyclesim / mpsim. */
  var DRAW_PER_PLAYER = false;        // OFF: reverted with it — not the culprit, but part of the same package.
  function setDrawPerPlayer(v) { DRAW_PER_PLAYER = !!v; }
  function isDrawPerPlayer() { return DRAW_PER_PLAYER; }
  function drawCountFor(st) { return DRAW_PER_PLAYER ? Math.max(DRAW_PER_ROUND, st.numPlayers) : DRAW_PER_ROUND; }

  // End-of-turn hand limit: discard down to MAX_HAND. `ids` = the player's chosen cards
  // to pitch (auto-picks lowest values if omitted / short). Discards go to the ENERGY pile
  // (the shuffle pile is only for spent energy) — pitched cards stay usable as fuel.
  function discardToLimit(st, p, ids) {
    var pl = st.players[p], over = pl.hand.length - MAX_HAND;
    if (over <= 0) return { ok: true, discarded: [], over: 0 };
    var chosen = [];
    if (ids && ids.length) { var set = {}; ids.forEach(function (id) { set[id] = true; }); chosen = pl.hand.filter(function (c) { return set[c.id]; }); }
    if (chosen.length < over) {                                  // top up with the lowest cards not already chosen
      var have = {}; chosen.forEach(function (c) { have[c.id] = true; });
      sortHand(pl.hand).forEach(function (c) { if (chosen.length < over && !have[c.id]) { chosen.push(c); have[c.id] = true; } });
    }
    chosen = chosen.slice(0, over);
    var dset = {}; chosen.forEach(function (c) { dset[c.id] = true; });
    pl.hand = pl.hand.filter(function (c) { return !dset[c.id]; });
    chosen.forEach(function (c) { pl.energy.push(c); });   // discards -> Energy pile (not shuffle)
    return { ok: true, discarded: chosen, over: over };
  }

  function newPlayer() { return { hand: [], deck: [], energy: [], shuffle: [], equipment: [], removed: [], forms: [], shields: START_SHIELDS, preventShield: false, pendingTop: false, nextPlayBoost: 0, shieldImmune: false, cantLoseRound: false, finishingBlow: false, lockSkip: false, lockRound: false, eliminated: false, kicksLanded: 0, lastAttacker: null }; }
  // REWORK: Super Mode is live while the Forms & Rides Zone holds a Ride (J/11) + a Queen (12) + a King (13) — any suits.
  // Super is now a SAME-SUIT unlock: a suit's Super is on when both its Q and its K sit in the zone. "hasSuper"
  // (used for the UI Super badge / transform return flag) means at least one suit has reached that Q+K pair.
  function hasSuper(pl) {
    var r = {}, q = {}, k = {}, anyR = false, anyQ = false, anyK = false;
    (pl.forms || []).forEach(function (f) { if (f.rank === 11) { r[f.suit] = 1; anyR = true; } else if (f.rank === 12) { q[f.suit] = 1; anyQ = true; } else if (f.rank === 13) { k[f.suit] = 1; anyK = true; } });
    if (FORM_SUIT_MATCH) return Object.keys(q).some(function (s) { return k[s] && r[s]; });   // A: one suit with its J + Q + K
    return anyR && anyQ && anyK;                                                               // B: any J + any Q + any K (a Ride is REQUIRED — suits otherwise irrelevant)
  }

  function newGame(rng, opts) {
    opts = opts || {};
    var np = Math.max(2, Math.min(6, opts.numPlayers || 2));       // N-player: 2–6 (default duel)
    var st = { numPlayers: np, players: [], round: 1, turn: 0, initiative: 0, pile: null, passes: 0, lastPlayer: null, finished: false, winner: null, log: [], pending: null, respondFor: null, discardPending: null, shieldResponse: null, stack: [], roundWinResult: null, preFightQ: null, preFightHandled: false, basics: !!opts.basics };
    var deckKeys = opts.decks || [];               // per-player archetype deck keys; falsy = the full 40-card set
    var startShields = (opts.shields != null) ? Math.max(1, opts.shields | 0) : startShieldsFor(np);   // tutorials shorten this (e.g. 2) so the shields→Fighter Kick arc is reachable in a quick guided duel
    st.startShields = startShields;
    for (var p = 0; p < np; p++) {
      var pl = newPlayer();
      var base = (deckKeys[p] && buildDeck(deckKeys[p])) || makeDeck();   // BASICS mode keeps the whole deck (J/Q/K included, as plain high cards) — transforms are disabled in the engine, not removed from the deck
      pl.deckKey = deckKeys[p] || 'full';
      pl.deck = shuffle(base, rng);
      pl.hand = sortHand(pl.deck.splice(0, START_HAND));
      pl.shields = startShields;
      if (SHIELD_CARDS) { pl.shieldPile = pl.deck.splice(0, startShields); pl.shields = pl.shieldPile.length; }   // Mechanic 1: shields are real cards drawn from the deck
      st.players.push(pl);
    }
    st.turn = st.initiative = (opts.starter != null ? opts.starter : 0);
    return st;
  }

  function nextPlayer(st, i) {                                    // next player in seat order, skipping eliminated (N-player)
    var n = st.numPlayers;
    for (var k = 1; k <= n; k++) { var j = (i + k) % n; if (!st.players[j].eliminated) return j; }
    return i;                                                     // no one else alive (game should already be finished)
  }
  function aliveCount(st) { var c = 0; for (var i = 0; i < st.numPlayers; i++) if (!st.players[i].eliminated) c++; return c; }
  function lastAlive(st) { for (var i = 0; i < st.numPlayers; i++) if (!st.players[i].eliminated) return i; return 0; }
  // A player takes the Fighter Kick (or decks out): they leave play. Their board no longer affects fights.
  function eliminatePlayer(st, q) {
    var pl = st.players[q];
    pl.eliminated = true;
    pl.hand = []; pl.equipment = []; pl.forms = []; pl.shields = 0;   // gear/forms stop affecting the table
  }
  // A player forfeits (netplay concede / N-player). Eliminate them, drop any obligation they owed or that pointed at
  // them, and — since a mid-round exit can leave a partial fight — reset to a clean lead by the next living player.
  // Returns { ok, finished, winner } / { ok, eliminated, turn }. 2p callers should just end the game (last one wins).
  function concede(st, seat) {
    if (!st || st.finished || !st.players[seat] || st.players[seat].eliminated) return { ok: false };
    eliminatePlayer(st, seat);
    st.stack = (st.stack || []).filter(function (o) { return o.target !== seat && o.p !== seat && o.winner !== seat; });
    if (st.shieldResponse && st.shieldResponse.q === seat) st.shieldResponse = null;
    if (st.discardPending && st.discardPending.player === seat) st.discardPending = null;
    if (st.respondFor === seat) st.respondFor = null;
    if (st.pending && st.pending.p === seat) { st.pending = null; st.respondFor = null; }
    if (st.pendingLossChoice && st.pendingLossChoice.winner === seat) st.pendingLossChoice = null;
    if (st.preFightQ === seat) { st.preFightQ = null; st.preFightPending = false; }
    if (aliveCount(st) <= 1) { st.finished = true; st.winner = lastAlive(st); return { ok: true, finished: true, winner: st.winner }; }
    var lead = nextPlayer(st, seat);
    st.turn = lead; st.initiative = lead; st.pile = null; st.passes = 0; st.lastPlayer = null; st.preFightHandled = false; st.roundWinResult = null; st._effUsed = false;
    return { ok: true, eliminated: seat, turn: lead };
  }
  function isLocked(st, p) { return !!(st.players[p].lockSkip || st.players[p].lockRound); }   // Back Stab: skip next turn (lockSkip, cleared on pass) or, if boosted, the whole round (lockRound, cleared at round end)
  // Holy Shroud: spend one of its counters to EAT the hit (a physical absorb — works vs a shield loss OR,
  // at 0 shields, the Fighter Kick). Returns true (and spends a counter) if an absorber is available.
  function retireEquip(pl, e) { if (e && e.card) pl.energy.push(e.card); }   // worn-out / spent Equipment → its card becomes Energy (recyclable via the shuffle cycle)
  function absorbSaved(st, q) {
    var pl = st.players[q];
    var shroud = pl.equipment.filter(function (e) { return e.absorb && e.counters > 0; })[0];
    if (!shroud) return false;
    shroud.counters -= 1; if (shroud.counters <= 0) { retireEquip(pl, shroud); pl.equipment = pl.equipment.filter(function (e) { return e !== shroud; }); }
    return true;
  }
  // Would player q's shield loss be prevented WITHOUT costing a shield? Sphere = free round-long
  // shield immunity; Holy Shroud = an equipped absorber that spends one of its own counters instead.
  function shieldSaved(st, q) {
    var pl = st.players[q];
    if (pl.shieldImmune) return true;                                            // Sphere of Invulnerability (shield loss only)
    return absorbSaved(st, q);                                                   // Holy Shroud absorber
  }
  // Read-only peek: would q's loss be prevented anyway (no side effects)? Used to gate the reactive window.
  // At 0 shields the incoming loss is a KICK, which only "can't lose this round" (cantLoseRound) prevents —
  // plain shield-immunity can't save a shield you don't have, so it must NOT suppress the guard window there.
  function wouldBeSaved(st, q) {
    var pl = st.players[q];
    var hasAbsorb = pl.equipment.some(function (e) { return e.absorb && e.counters > 0; });
    if (pl.shields <= 0) return !!pl.cantLoseRound || hasAbsorb;                  // at 0, the kick is prevented only by "can't lose this round" or a Holy Shroud counter
    if (pl.shieldImmune || pl.cantLoseRound || pl.preventShield) return true;
    if (hasAbsorb || pl.equipment.some(function (e) { return e.protect === 'special'; })) return true;
    return false;
  }

  function drawOne(pl) {
    if (pl.deck.length === 0) { if (pl.shuffle.length === 0) return null; pl.deck = shuffle(pl.shuffle); pl.shuffle = []; }
    return pl.deck.shift();
  }
  function drawCards(pl, n) {
    var got = 0;
    for (var i = 0; i < n; i++) { var c = drawOne(pl); if (!c) break; pl.hand.push(c); got++; }
    pl.hand = sortHand(pl.hand);
    return got; // number actually drawn (may be < n if deck + shuffle are empty)
  }
  // ---- Pip suit-cost economy ----------------------------------------------------
  // The card's number is BOTH its fight value and its total cost. Of that cost, some
  // pips must be paid in the card's own suit (the "colored" part), and the rest is
  // generic (any suit). Default colored pips = max(1, floor(cost/2)); a 0-cost card is
  // free. Any card may override with `pips` (a number) or `cost` (an explicit per-suit
  // map, for future multi-suit cards). e.g. a ♦5 = 2♦ + 3 any; a ♦9 = 4♦ + 5 any.
  function idSuits(card) { return (card && card.suits) || (card ? [card.suit] : []); }
  function countSuit(pile, s) { var n = 0; for (var i = 0; i < pile.length; i++) if (pile[i].suit === s) n++; return n; }
  function defaultPips(cost) { return cost <= 0 ? 0 : Math.max(1, Math.floor(cost / 2)); }
  // Per-suit COLORED pip requirement (not the full cost — the rest is generic).
  function costReq(card) {
    if (card && card.cost && typeof card.cost === 'object') return card.cost;   // explicit multi-suit map
    if (card && card.rank >= 11 && card.rank <= 13) return {};          // transforms: 10 flat, all generic (any energy)
    var r = card ? activationCost(card) : 0;                                      // activation cost (card number; J/Q/K = TRANSFORM_COST, A = 1)
    if (r <= 0) return {};                                                       // 0-cost = free
    var pips = (card && card.pips != null) ? card.pips : defaultPips(r);
    var m = {}; m[card.suit] = Math.min(pips, r); return m;                      // never more pips than the total cost
  }
  /* Energy pile ORDER is the player's lever on what recycles sooner. payEnergy above spends colored pips as
   * the earliest card of the required suit and the generic remainder as energy.shift() — the front of the pile —
   * so re-ordering the pile fully determines which cards leave it, without touching cost logic at all.
   * `ids` is the pile's intended new order and must be a PERMUTATION of the current pile: same length and the
   * same multiset of ids (ids can repeat legitimately — Counterfeit copies). Anything else is rejected, since a
   * bad order is an attempt to conjure or delete energy. ON YOUR TURN ONLY, and not while a stack/response
   * window is open, so the pile cannot shift underneath a resolution that is mid-flight. */
  function reorderEnergy(st, p, ids) {
    if (st.finished) return { ok: false, reason: 'Game over.' };
    if (p !== st.turn) return { ok: false, reason: 'You can only reorder your energy on your own turn.' };
    if (st.pending || st.respondFor != null) return { ok: false, reason: 'Not while a Technique is resolving.' };
    var pl = st.players[p];
    if (!Array.isArray(ids) || ids.length !== pl.energy.length) return { ok: false, reason: 'Bad order — that is not your whole energy pile.' };
    var have = {}, i, j;
    for (i = 0; i < pl.energy.length; i++) have[pl.energy[i].id] = (have[pl.energy[i].id] || 0) + 1;
    var seen = {};
    for (i = 0; i < ids.length; i++) {
      seen[ids[i]] = (seen[ids[i]] || 0) + 1;
      if (!have[ids[i]] || seen[ids[i]] > have[ids[i]]) return { ok: false, reason: 'Bad order — unknown or duplicated card.' };
    }
    var pool = pl.energy.slice(), out = [];                 // same length + no id over its own multiplicity ⇒ a true permutation
    for (i = 0; i < ids.length; i++)
      for (j = 0; j < pool.length; j++) if (pool[j].id === ids[i]) { out.push(pool.splice(j, 1)[0]); break; }
    pl.energy = out;
    return { ok: true, order: out.map(function (c) { return c.id; }) };
  }
  // "⤒ Promote to top": the named card BECOMES the front and everything else shifts down, so repeated promotes
  // mean last-promoted-is-spent-first (a stack push, not a queue).
  function promoteEnergy(st, p, cardId) {
    var pl = st.players[p];
    if (!pl.energy.some(function (c) { return c.id === cardId; })) return { ok: false, reason: 'That card is not in your energy pile.' };
    var ids = [cardId];
    pl.energy.forEach(function (c) { if (c.id !== cardId) ids.push(c.id); });
    return reorderEnergy(st, p, ids);
  }
  function canAfford(pl, card, delta) {
    var cost = card ? Math.max(0, activationCost(card) + (delta || 0)) : 0;       // delta = ride cost modifier (Owl −1 / Ram +1)
    if (cost <= 0) return true;
    if (pl.energy.length < cost) return false;                                   // enough total pips
    var req = costReq(card);
    for (var s in req) if (countSuit(pl.energy, s) < req[s]) return false;       // colored pips present
    return true;                                                                 // generic remainder is then coverable
  }
  function payEnergy(pl, card, delta) {
    var cost = card ? Math.max(0, activationCost(card) + (delta || 0)) : 0;
    if (cost <= 0) return;
    var req = costReq(card), colored = 0;
    for (var s in req) for (var k = 0; k < req[s]; k++) {                        // colored pips of the exact suit(s)
      var idx = -1; for (var i = 0; i < pl.energy.length; i++) if (pl.energy[i].suit === s) { idx = i; break; }
      if (idx >= 0) { pl.shuffle.push(pl.energy.splice(idx, 1)[0]); colored++; }
    }
    for (var g = colored; g < cost && pl.energy.length; g++) pl.shuffle.push(pl.energy.shift());  // generic remainder
  }
  // Human-readable requirement, e.g. "2♦ + 3 any", "4♦ + 5 any", or "free".
  function costHint(card, delta) {
    var cost = card ? Math.max(0, activationCost(card) + (delta || 0)) : 0;
    if (cost <= 0) return 'free';
    var req = costReq(card), parts = [], colored = 0;
    for (var s in req) { parts.push(req[s] + SUIT_SYMBOL[s]); colored += req[s]; }
    var gen = cost - colored; if (gen > 0) parts.push(gen + ' any');
    return parts.join(' + ');
  }

  /* --------------------------------------------------------------------------
   * Card effects (PLAY phase). A card's activation cost = its value; you pay by
   * moving that many cards from your Energy pile to your Shuffle pile. Techniques
   * are removed from the game after resolving. (Equipment / 8s and the reactive
   * Quick stack are the next pass — 8s currently have no effect.)
   * ------------------------------------------------------------------------ */
  // Four archetypes = four suits. Each (suit, value) is a unique card. Effects whose
  // machinery already exists ("drop-ins") are impl:true and resolve in activate(); the
  // rest (Quicks, targeting, counter-spend, lockouts) are impl:false = plain fight cards
  // for now. Activation cost = the card's value.
  var ARCHETYPE = { D: 'Wizard', H: 'Cleric', S: 'Rogue', C: 'Fighter' };

  // ---- Deckbuilding: pure + dual archetype decks --------------------------------
  // Base archetype -> its suit (suit still drives combos; archetype drives the effect).
  // A deck is 40 cards = 4 of every rank (1-10); pures put all 4 in one suit, mixes
  // split 2/2 across their two suits. Duplicates are allowed up to 4 (a pure sits at
  // the cap). Each physical card gets a UNIQUE instance id so copies stay distinct.
  var BASE_SUIT = { Wizard: 'D', Cleric: 'H', Fighter: 'C', Rogue: 'S' };
  var DECKS = {
    Wizard:     { name: 'Pure Wizard',           bases: ['Wizard'] },
    Cleric:     { name: 'Pure Cleric',           bases: ['Cleric'] },
    Fighter:    { name: 'Pure Fighter',          bases: ['Fighter'] },
    Rogue:      { name: 'Pure Rogue',            bases: ['Rogue'] },
    Sage:       { name: 'Sage (Wiz+Cle)',        bases: ['Wizard', 'Cleric'] },
    MageKnight: { name: 'Mage Knight (Wiz+Fig)', bases: ['Wizard', 'Fighter'] },
    Warlock:    { name: 'Warlock (Wiz+Rog)',     bases: ['Wizard', 'Rogue'] },
    Paladin:    { name: 'Paladin (Cle+Fig)',     bases: ['Cleric', 'Fighter'] },
    Bard:       { name: 'Bard (Cle+Rog)',        bases: ['Cleric', 'Rogue'] },
    Berserker:  { name: 'Berserker (Fig+Rog)',   bases: ['Fighter', 'Rogue'] }
  };
  var DECK_ORDER = ['Wizard', 'Cleric', 'Fighter', 'Rogue', 'Sage', 'MageKnight', 'Warlock', 'Paladin', 'Bard', 'Berserker'];
  // ---- deck compositions ("parts") --------------------------------------------------------------------
  // A deck is always 4 PARTS, and a part is one complete 13-card suit (ranks 1-13, i.e. A..K with the apex 2)
  // of one class. Parts stack and may repeat: {D:1,H:2,C:1} = 13♦ + 26♥ + 13♣ = 52 cards. This GENERALISES the
  // presets rather than sitting beside them — Pure X is 4 parts of one class, each two-base mix is 2+2, and the
  // Full Set is 1 of each. A composition serialises to a self-describing key ('custom:D1H2C1') so netplay can
  // carry the composition itself instead of a saved deck name the host would have to recognise.
  var PARTS_TOTAL = 4, PARTS_PREFIX = 'custom:';
  var PARTS_SUITS = ['D', 'H', 'C', 'S'];   // canonical order = Wizard, Cleric, Fighter, Rogue (the builder's stepper order)
  function partsCount(parts) {
    var n = 0;
    for (var i = 0; i < PARTS_SUITS.length; i++) n += (parts && parts[PARTS_SUITS[i]]) || 0;
    return n;
  }
  function partsValid(parts) {
    if (!parts || typeof parts !== 'object') return false;
    for (var k in parts) {                                     // reject unknown suits outright
      if (!Object.prototype.hasOwnProperty.call(parts, k)) continue;
      if (PARTS_SUITS.indexOf(k) < 0) return false;
      var v = parts[k];
      if (typeof v !== 'number' || v !== Math.floor(v) || v < 0 || v > PARTS_TOTAL) return false;
    }
    return partsCount(parts) === PARTS_TOTAL;
  }
  function partsKey(parts) {
    if (!partsValid(parts)) return null;
    var s = '';
    for (var i = 0; i < PARTS_SUITS.length; i++) { var n = parts[PARTS_SUITS[i]] || 0; if (n) s += PARTS_SUITS[i] + n; }
    return PARTS_PREFIX + s;
  }
  function parseParts(key) {
    if (typeof key !== 'string' || key.indexOf(PARTS_PREFIX) !== 0) return null;
    var body = key.slice(PARTS_PREFIX.length), parts = {}, re = /([DHCS])([0-9])/g, m, used = 0;
    while ((m = re.exec(body))) {
      if (parts[m[1]] !== undefined) return null;              // the same class listed twice
      parts[m[1]] = +m[2]; used += m[0].length;
    }
    if (used !== body.length) return null;                     // junk or an unparsed remainder
    return partsValid(parts) ? parts : null;
  }
  function isPartsKey(key) { return !!parseParts(key); }
  function buildFromParts(parts) {
    if (!partsValid(parts)) return null;
    var out = [], n = 0;
    for (var v = 1; v <= 13; v++)
      for (var i = 0; i < PARTS_SUITS.length; i++) {
        var su = PARTS_SUITS[i], reps = parts[su] || 0;
        for (var k = 0; k < reps; k++) out.push({ rank: v, suit: su, id: v + su + '#' + (n++) });   // unique instance id
      }
    return out;                                                // 52 cards
  }
  // The composition behind a preset key (or 'full'), so the builder can open pre-filled from one.
  function presetParts(key) {
    if (key === 'full' || key === null || key === undefined) return { D: 1, H: 1, C: 1, S: 1 };
    var spec = DECKS[key]; if (!spec) return null;
    var per = PARTS_TOTAL / spec.bases.length, parts = {};
    for (var i = 0; i < spec.bases.length; i++) {
      var su = BASE_SUIT[spec.bases[i]];
      parts[su] = (parts[su] || 0) + per;
    }
    return parts;
  }
  function buildDeck(key) {
    if (key && typeof key === 'object') return buildFromParts(key);        // a raw composition
    var asParts = parseParts(key); if (asParts) return buildFromParts(asParts);
    var spec = DECKS[key]; if (!spec) return null;
    var suits = spec.bases.map(function (b) { return BASE_SUIT[b]; });
    var perSuit = 4 / suits.length;                // pure -> 4, mix -> 2
    var out = [], n = 0, hi = 13;    // 13 ranks/suit (adds J/Q/K) → 52 cards
    for (var v = 1; v <= hi; v++)
      for (var si = 0; si < suits.length; si++)
        for (var k = 0; k < perSuit; k++)
          out.push({ rank: v, suit: suits[si], id: v + suits[si] + '#' + (n++) });   // unique instance id
    return out;                                     // 52 cards
  }
  // EFFECTS are keyed by the card's NUMBER (1..10) — which is now also its internal rank and its cost.
  // Aug-12 card set. Cards whose machinery already exists are impl:true; the genuinely new
  // mechanics (value boost, round-long shield immunity, on-win trigger, full lockout, shield-absorb
  // equipment) are impl:false for now — they sit in the deck as plain fight bodies until wired.
  var STOPPER_TEXT = 'During a fight, commit matching Stoppers (1 vs a single, 2 vs a pair, 3 vs a trio) to cancel the play and seize the Initiative. This cannot cancel 5 card combos.';
  var EFFECTS = {
    D: { // Wizard — Tempo / Energy
      1: { kind: 'ramp', n: 3, name: 'Gather Energy', type: 'Technique', impl: true, text: 'Put the top 3 cards of your deck into your Energy Pile.' },
      2: { kind: 'stopper', name: 'Skillful Teleport', type: 'Technique', impl: true, text: STOPPER_TEXT },
      3: { kind: 'discardOpp', n: 2, name: 'Telekinesis', type: 'Technique', impl: true, text: 'Target Rival discards 2 cards.' },
      4: { kind: 'counter', quick: true, name: 'Counter Spell', type: 'Quick Technique', impl: true, text: "Counter target Technique as it is played. The countered card goes to its owner's Shuffle Pile." },
      5: { kind: 'valueBoost', boost: 4, name: 'Infuse with Magic', type: 'Technique', impl: true, text: 'Increase the value of your next play by 4.' },
      6: { kind: 'draw', draw: 3, name: 'Back to the Books', type: 'Technique', impl: true, text: 'Draw 3 cards.' },
      7: { kind: 'removeEquip', mode: 'hand', name: 'Forceful Strip', type: 'Technique', impl: true, text: "Return Target Equipment to its owner's hand." },
      8: { kind: 'equip', oppDelta: -2, counters: 5, name: 'Cursed Pendant', type: 'Equipment', impl: true, text: "At the beginning of each round, remove 1 counter from Cursed Pendant. Your Rivals' highest card each fight has its value reduced by 2." },
      9: { kind: 'reclaim', half: true, immune: true, cantLose: true, quick: true, name: 'Leyline Ascension', type: 'Quick Technique', impl: true, text: "Shuffle your Shuffle Pile into your Deck and then put half of your deck into your Energy Pile. You can't lose this round (no shield loss — and at 0 shields, no Fighter Kick either)." },
      10: { kind: 'valueBoost', boost: 6, name: 'Phantasmal Illusion', type: 'Technique', impl: true, text: 'Conjure a phantom of your strike — increase the value of your next play by 6.' }
    },
    H: { // Cleric — Mid / value
      1: { kind: 'valueBoost', boost: 2, name: 'Imbue with Power', type: 'Technique', impl: true, text: 'Increase the value of your next play by 2.' },
      2: { kind: 'stopper', name: 'Divine Intervention', type: 'Technique', impl: true, text: STOPPER_TEXT },
      3: { kind: 'ramp', n: 5, name: 'Pray for Strength', type: 'Technique', impl: true, text: 'Put the top 5 cards of your deck into your Energy Pile.' },
      4: { kind: 'draw', draw: 2, name: 'Pray for Guidance', type: 'Technique', impl: true, text: 'Draw 2 cards.' },
      5: { kind: 'protect', quick: true, name: 'Annoint', type: 'Quick Technique', impl: true, text: "Target Equipment can't be destroyed or disarmed until the end of the round." },
      6: { kind: 'valueBoost', boost: 5, name: 'Divine Tactics', type: 'Technique', impl: true, text: 'Increase the value of your next play by 5.' },
      7: { kind: 'removeEquip', mode: 'shuffle', name: 'Plead for Peace', type: 'Technique', impl: true, text: "Put target Equipment into its owner's Shuffle Pile." },
      8: { kind: 'equip', delta: 2, counters: 5, name: 'Holy Sword', type: 'Equipment', impl: true, text: 'At the beginning of each round, remove 1 counter from Holy Sword. Your highest card each fight has its value increased by 2.' },
      9: { kind: 'shield', shield: 1, name: 'Sanctuary', type: 'Technique', impl: true, text: 'Gain 1 Shield.' },
      10: { kind: 'equip', absorb: true, counters: 1, decay: false, name: 'Holy Shroud', type: 'Equipment', impl: true, text: 'If you would lose a shield, remove 1 counter from Holy Shroud instead.' }
    },
    S: { // Rogue — Control / disruption   (♠ spades)
      1: { kind: 'discardOpp', n: 1, name: 'Outbalance', type: 'Technique', impl: true, text: 'Target Rival discards 1 card.' },
      2: { kind: 'stopper', name: 'Sleight of Hand', type: 'Technique', impl: true, text: STOPPER_TEXT },
      3: { kind: 'draw', draw: 2, quick: true, name: 'Hand-to-Hand Mastery', type: 'Quick Technique', impl: true, text: 'Draw 2 cards.' },
      4: { kind: 'recycle', scope: 'all', name: 'Poison the Air', type: 'Technique', impl: true, text: "Move every player's Energy Pile to their Shuffle Pile." },
      5: { kind: 'removeEquip', mode: 'destroy', name: 'Sabotage', type: 'Technique', impl: true, text: 'Destroy target Equipment.' },
      6: { kind: 'draw', draw: 4, discard: 2, name: 'Never Out of Options', type: 'Technique', impl: true, text: 'Look at the top 4 cards of your deck. Put 2 into your Energy Pile and draw the other 2.' },
      7: { kind: 'equip', oppDelta: -2, counters: 5, name: 'Caltrops', type: 'Equipment', impl: true, text: "While equipped, the Rival's highest card each fight has its value reduced by 2." },
      8: { kind: 'counterfeit', name: 'Counterfeit', type: 'Technique', impl: true, text: "Copy a card from the Rival's current play into your hand. You must play the copy in a fight this round — at the round's end it fades away." },
      9: { kind: 'destroyShield', n: 1, name: 'Critical Hit', type: 'Technique', impl: true, text: 'Target Rival loses 1 shield.' },
      10: { kind: 'lockout', quick: true, name: 'Back Stab', type: 'Quick Technique', impl: true, text: "Play in response. Target Rival skips their next turn — no fights, no Techniques (an effect already in progress still resolves)." }
    },
    C: { // Fighter — Aggro   (♣ clubs)
      1: { kind: 'draw', draw: 2, name: 'Prepare for Combat', type: 'Technique', impl: true, text: 'Draw 2 cards.' },
      2: { kind: 'stopper', name: 'Masterful Block', type: 'Technique', impl: true, text: STOPPER_TEXT },
      3: { kind: 'valueBoost', boost: 2, name: 'Brilliant Tactic', type: 'Technique', impl: true, text: 'Increase the value of your next play by 2.' },
      4: { kind: 'removeEquip', mode: 'energy', name: 'Disarm', type: 'Technique', impl: true, text: "Disarm target Equipment: move it to its owner's Energy Pile and its effects stop." },
      5: { kind: 'equip', delta: 1, counters: 5, name: "Hero's Sword", type: 'Equipment', impl: true, text: 'While equipped, your highest card each fight has its value increased by 1.' },
      6: { kind: 'discardOpp', n: 2, name: 'Discombobulate', type: 'Technique', impl: true, text: 'Target Rival discards 2 cards.' },
      7: { kind: 'onWin', extraShield: 1, quick: true, name: 'Armor Piercing', type: 'Quick Technique', impl: true, text: 'The next fight you win this round, the Rival loses 1 additional shield (never overkills).' },
      8: { kind: 'reclaim', draw: 1, name: 'Instant Recovery', type: 'Technique', impl: true, text: 'Shuffle your Shuffle Pile into your deck, then draw 1 card.' },
      9: { kind: 'equip', oppDelta: -1, counters: 5, name: 'Spiked Armor', type: 'Equipment', impl: true, text: "While equipped, the Rival's highest card each fight has its value reduced by 1." },
      10: { kind: 'destroyShield', n: 1, name: 'Ultima Attack', type: 'Technique', impl: true, text: 'Target Rival loses 1 shield.' }
    }
  };
  // REWORK: J/Q/K (rank 11/12/13) are transform cards — activating one (10 energy) sends it to the Forms &
  // Rides Zone where it empowers a set of your cards. The per-card BOOSTS are Phase 4; here they're keystones.
  var TRANSFORM_NAMES = {
    D: { 11: 'Giant Owl',  12: 'Penelope Form',   13: 'Odysseus Form' },
    H: { 11: 'Giant Swan', 12: 'Cassandra Form',  13: 'Hector Form' },
    C: { 11: 'Giant Boar', 12: 'Hippolyta Form',  13: 'Meleager Form' },
    S: { 11: 'Giant Ram',  12: 'Pandora Form',   13: 'Perseus Form' }
  };
  var RIDE_TEXT = {
    D: 'While in your zone: the first effect you activate each turn costs 1 less energy. (Super keystone.)',
    H: 'While in your zone: your plays are +1 value when the Rival tries to beat them — defensive. (Super keystone.)',
    C: 'While in your zone: your plays fight at +1 value on your turn — offensive. (Super keystone.)',
    S: "While in your zone: the Rival's first effect each turn costs 1 more energy. (Super keystone.)"
  };
  (function () {
    var tier = { 11: 'ride', 12: 'queen', 13: 'king' }, tname = { 11: 'Ride', 12: 'Form Change', 13: 'Form Change' };
    ['D', 'H', 'C', 'S'].forEach(function (su) {
      [11, 12, 13].forEach(function (r) {
        EFFECTS[su][r] = { kind: 'transform', tier: tier[r], name: TRANSFORM_NAMES[su][r], type: tname[r], impl: true,
          text: 'Transform — move this to your Forms & Rides Zone, where it persists (no decay). ' + (r === 11 ? RIDE_TEXT[su] : 'A Form Change empowers a set of your cards while it sits in the zone.') };
      });
    });
  })();
  // Base-card content changes (player-independent) — some base cards were nerfed/renamed/reordered, with the
  // removed power moved into Forms. These are full-spec replacements, merged into EFFECTS below (see the merge loop).
  var BASE_OVERRIDES = {
    D: {  // Wizard: Back to the Books draw 3 → a dig (look 3, 1→Energy, keep 2); Cursed Pendant 5→4 counters; Leyline Ascension loses its recycle/ramp (moved to Athena)
      6: { kind: 'draw', draw: 3, discard: 1, name: 'Back to the Books', type: 'Technique', impl: true, text: 'Look at the top 3 cards of your deck. Put 1 into your Energy Pile and draw the other 2.' },
      8: { kind: 'equip', oppDelta: -2, counters: 4, name: 'Cursed Pendant', type: 'Equipment', impl: true, text: "Equipment — lasts 4 rounds (1 counter spent at the start of each round; then it retires to your Energy). Your Rivals' highest card each fight has its value reduced by 2." },
      9: { kind: 'ward', immune: true, cantLose: true, quick: true, name: 'Leyline Ascension', type: 'Quick Technique', impl: true, text: "You can't lose this round — no shield loss, and at 0 shields no Fighter Kick either." }
    },
    H: {  // Cleric: rename Holy Sword→Holy Bow; swap 9/10 so Holy Shroud=9, Sanctuary=10
      8:  { kind: 'equip', delta: 2, counters: 4, name: 'Holy Bow', type: 'Equipment', impl: true, text: 'Equipment — lasts 4 rounds (1 counter spent at the start of each round; then it retires to your Energy). Your highest card each fight has its value increased by 2.' },
      9:  { kind: 'equip', absorb: true, counters: 1, decay: false, name: 'Holy Shroud', type: 'Equipment', impl: true, text: 'If you would lose a shield (or take the Kick at 0), remove 1 counter from Holy Shroud instead.' },
      10: { kind: 'shield', shield: 1, shieldAll: true, name: 'Sanctuary', type: 'Technique', impl: true, text: 'Every player gains 1 Shield.' }
    },
    C: {  // Fighter: Hero's Sword renamed Hero's Javelin; Discombobulate→Superior Training (a dig); Armor Piercing loses Quick (moved to Hippolyta); Instant Recovery draw 2 (v1.13 restored the over-nerf to 1); Spiked Armor −1→−2
      5: { kind: 'draw', draw: 4, discard: 2, name: 'Superior Training', type: 'Technique', impl: true, text: 'Look at the top 4 cards of your deck. Put 2 into your Energy Pile and draw the other 2.' },
      6: { kind: 'equip', delta: 1, counters: 3, name: "Hero's Javelin", type: 'Equipment', impl: true, text: 'Equipment — lasts 3 rounds (1 counter spent at the start of each round; then it retires to your Energy). While equipped, your highest card each fight has its value increased by 1.' },
      7: { kind: 'onWin', extraShield: 1, pitchHigh: true, name: 'Armor Piercing', type: 'Technique', impl: true, text: 'Additional cost: discard a Broadway card (10, J, Q, K, or A). The next fight you win this round, the Rival loses 1 additional shield (never overkills).' },
      8: { kind: 'reclaim', draw: 2, name: 'Instant Recovery', type: 'Technique', impl: true, text: 'Shuffle your Shuffle Pile into your deck, then draw 2 cards.' },
      9: { kind: 'equip', oppDelta: -2, counters: 3, name: 'Spiked Armor', type: 'Equipment', impl: true, text: "Equipment — lasts 3 rounds (retires to your Energy after). While equipped, the Rival's highest card each fight has its value reduced by 2." },
      10: { kind: 'destroyShield', n: 1, pitchHigh: true, name: 'Ultima Attack', type: 'Technique', impl: true, text: 'Additional cost: discard a Broadway card (10, J, Q, K, or A). Target Rival loses 1 shield.' }
    },
    S: {  // Rogue: Hand-to-Hand and Back Stab lose Quick (moved to Perseus / Hermes); Never Out of Options dig 4→3; Caltrops 5→3 counters
      3:  { kind: 'draw', draw: 2, name: 'Hand-to-Hand Mastery', type: 'Technique', impl: true, text: 'Draw 2 cards.' },
      6:  { kind: 'draw', draw: 3, discard: 2, name: 'Never Out of Options', type: 'Technique', impl: true, text: 'Look at the top 3 cards of your deck. Put 2 into your Energy Pile and draw the other 1.' },
      7:  { kind: 'equip', oppDelta: -2, counters: 3, name: 'Caltrops', type: 'Equipment', impl: true, text: "Equipment — lasts 3 rounds (retires to your Energy after). While equipped, the Rival's highest card each fight has its value reduced by 2." },
      9:  { kind: 'destroyShield', n: 1, pitchHigh: true, name: 'Critical Hit', type: 'Technique', impl: true, text: 'Additional cost: discard a Broadway card (10, J, Q, K, or A). Target Rival loses 1 shield.' },
      10: { kind: 'lockout', name: 'Back Stab', type: 'Technique', impl: true, text: 'Target Rival skips their next turn — no fights, no Techniques.' }
    }
  };
  // Bake the overrides into EFFECTS permanently (the game has one card set — the classic pre-rework table is retired).
  (function () { for (var su in BASE_OVERRIDES) for (var r in BASE_OVERRIDES[su]) EFFECTS[su][r] = BASE_OVERRIDES[su][r]; })();
  // Form/Super boosts (Phase 4a: numeric + Quick upgrades). [suit][tier][rank] = field patch merged onto
  // the effect while that Form sits in your zone. Super supersedes (its patch overrides the Form-tier patch).
  // Behavioral boosts (target-scope, the Wheel, copy-plus, whole-round, cost/defensive Rides) land in 4b.
  var SUPER_NAMES = { D: 'Athena Mode', H: 'Apollo Mode', C: 'Ares Mode', S: 'Hermes Mode' };
  var BOOSTS = {
    D: {
      queen: { 1: { n: 4, desc: 'Gather 1 more — put the top 4 of your deck into Energy.' }, 4: { desc: 'Counter Spell can also counter an Equipment as it is played.' }, 7: { eqMode: 'deckTop', desc: "Forceful Strip puts the target Equipment on TOP of its owner's deck (they must redraw it) instead of into their hand." } },
      king:  { 5: { boost: 5, desc: 'Boost your next play by 1 more (to +5).' }, 6: { draw: 4, desc: 'Look 1 deeper — top 4, keep 3 (draw 2→3).' }, 10: { boost: 7, desc: 'The illusion swells — boost your next play by 1 more (to +7).' } },
      super: { 7: { ride: true, form: true, eqMode: 'deckTop', desc: "Forceful Strip puts a stripped Equipment on TOP of its owner's deck, and can also return a Ride OR a Form to its owner's hand." }, 9: { kind: 'reclaim', half: true, immune: true, cantLose: true, desc: 'Also recycle — shuffle your Shuffle Pile into your deck and ramp half of it into Energy.' } }
    },
    H: {
      queen: { 3: { n: 6, desc: 'Dig 1 deeper — put the top 6 of your deck into Energy.' }, 5: { addCounter: 1, desc: 'Also add 1 counter to that Equipment.' }, 8: { delta: 3, desc: 'Your highest card each fight gains an additional +1 (to +3).' } },
      king:  { 1: { boost: 3, desc: 'Boost your next play by 1 more (to +3).' }, 4: { draw: 3, desc: 'Draw 1 more (draw 3).' }, 10: { quick: true, desc: 'Sanctuary becomes a Quick — cast it in response.' } },
      super: { 8: { delta: 4, desc: 'Your highest card each fight gains a further +1 (to +4).' }, 10: { quick: true, shieldImmune: true, desc: "Sanctuary becomes a Quick, and you can't lose a shield until end of round." } }
    },
    C: {
      queen: { 1: { draw: 3, desc: 'Draw 1 more (draw 3).' }, 7: { quick: true, desc: 'Armor Piercing becomes a Quick.' }, 8: { reclaimDiscard: true, desc: 'Also shuffle your Discard (spent cards) back into your deck before drawing.' } },
      king:  { 3: { boost: 3, desc: 'Boost your next play by 1 more (to +3).' }, 6: { delta: 2, desc: 'Your highest card each fight gains an additional +1 (to +2).' }, 9: { oppDelta: -3, desc: "The Rival's highest card each fight drops 1 further (to −3)." } },
      super: { 8: { wheel: true, draw: 6, desc: 'The Wheel — shuffle your hand, your Discard, and your Shuffle Pile back into your deck, then draw 6 fresh cards.' }, 10: { n: 2, desc: 'The Rival loses 1 additional shield (2 total).' } }
    },
    S: {
      queen: { 1: { n: 2, desc: 'The Rival discards 1 more (2 total).' }, 4: { scope: 'opp', desc: 'Poison only the Rival — their Energy Pile goes to their Shuffle Pile (you keep yours).' }, 8: { copyPlus: 1, desc: 'The copy enters your hand at +1 value.' } },
      king:  { 3: { quick: true, desc: 'Hand-to-Hand Mastery becomes a Quick.' }, 5: { ride: true, desc: 'Sabotage can also destroy a Ride.' }, 10: { lockRound: true, desc: 'The target skips the WHOLE round, not just their next turn.' } },
      super: { 8: { copyPlus: 2, desc: 'The copy enters your hand at +2 value.' }, 10: { quick: true, lockRound: true, desc: 'Back Stab becomes a Quick AND the target skips the whole round.' } }
    }
  };
  // The card's flavour name from the spec — available even when it has NO activated effect (the apex 2, or a
  // J/Q/K in Basics where transforms are off). Lets the UI keep every card's name for flavour.
  function cardName(card) {
    if (!card || card.temp) return null;
    var spec = EFFECTS[card.suit] && EFFECTS[card.suit][card.rank];
    return (spec && spec.name) || null;
  }
  function effectOf(card) {
    if (card.temp) return null;                        // Counterfeit copies / illusions are pure fight bodies — no activated effect
    if (card.rank === 2) return null;                  // apex "2" is a vanilla trump — STOPPER retired as an activated effect
    var spec = EFFECTS[card.suit] && EFFECTS[card.suit][card.rank];
    if (!spec) return null;                          // blanks / no effect = plain fight card
    var out = { id: card.suit + card.rank, cost: activationCost(card), quick: !!spec.quick, impl: !!spec.impl, archetype: ARCHETYPE[card.suit] };
    for (var k in spec) out[k] = spec[k];
    return out;
  }
  // Player-aware effect: base effect + any Form/Super boosts from player p's Forms & Rides Zone.
  // Suit-agnostic activation, but each Form boosts ITS OWN suit's cards; Super applies when p is in Super
  // Mode AND that suit's Queen or King is in the zone. Sets .boosted / .boostTier so the UI can glow the card.
  function effectFor(st, p, card) {
    var eff = effectOf(card);
    if (!eff || !st || p == null) return eff;
    var pl = st.players[p], forms = pl.forms || [];
    if (!forms.length) return eff;
    var su = card.suit, r = card.rank, tbl = BOOSTS[su];
    if (!tbl) return eff;
    var qOn = forms.some(function (f) { return f.rank === 12 && (!FORM_SUIT_MATCH || f.suit === su); });
    var kOn = forms.some(function (f) { return f.rank === 13 && (!FORM_SUIT_MATCH || f.suit === su); });
    var rideOn = forms.some(function (f) { return f.rank === 11 && (!FORM_SUIT_MATCH || f.suit === su); });
    var sOn = qOn && kOn && rideOn;   // Super needs a RIDE (J) + a Q + a K (A: all same suit as the card; B: any of each)
    var patch = null, tier = null;
    if (qOn && tbl.queen[r]) { patch = tbl.queen[r]; tier = 'queen'; }
    if (kOn && tbl.king[r]) { patch = tbl.king[r]; tier = 'king'; }              // ranks never overlap Q/K within a suit
    if (sOn && tbl.super[r]) { patch = tbl.super[r]; tier = 'super'; }            // Super supersedes
    if (!patch) return eff;
    var out = {}; for (var k in eff) out[k] = eff[k];
    for (var k2 in patch) {
      if (k2 === 'desc') continue;                                                 // desc is display metadata, not an effect field
      if (BOOST_SCALE !== 1 && BOOST_NUM[k2] && typeof patch[k2] === 'number' && typeof eff[k2] === 'number')
        out[k2] = eff[k2] + Math.round(BOOST_SCALE * (patch[k2] - eff[k2]));       // A/B: scale the boost INCREMENT (patched − base)
      else out[k2] = patch[k2];
    }
    if (patch.quick) out.type = 'Quick Technique';
    out.boosted = true; out.boostTier = tier;
    return out;
  }
  // The full upgrade ladder for a card — every Form/Super tier that empowers it, with whether that tier is
  // currently ACTIVE (its Form is in player p's zone). Drives the always-visible greyed/lit tier lines in the UI.
  function boostInfo(st, p, card) {
    if (!card) return [];
    var su = card.suit, r = card.rank, tbl = BOOSTS[su]; if (!tbl) return [];
    var forms = (st && p != null && st.players[p] && st.players[p].forms) || [];
    var qOn = forms.some(function (f) { return f.rank === 12 && (!FORM_SUIT_MATCH || f.suit === su); });
    var kOn = forms.some(function (f) { return f.rank === 13 && (!FORM_SUIT_MATCH || f.suit === su); });
    var rideOn = forms.some(function (f) { return f.rank === 11 && (!FORM_SUIT_MATCH || f.suit === su); });
    var sOn = qOn && kOn && rideOn;   // Super needs a Ride (J) + Q + K
    var lines = [];
    if (tbl.queen[r]) lines.push({ tier: 'queen', name: TRANSFORM_NAMES[su][12], desc: tbl.queen[r].desc, active: qOn });
    if (tbl.king[r])  lines.push({ tier: 'king',  name: TRANSFORM_NAMES[su][13], desc: tbl.king[r].desc,  active: kOn });
    if (tbl.super[r]) lines.push({ tier: 'super', name: SUPER_NAMES[su],          desc: tbl.super[r].desc, active: sOn });
    return lines;
  }

  // Equipment value modifier for player p's plays: sum of own equipment `delta`
  // (e.g. Legendary Sword +2) plus opponents' `oppDelta` (e.g. Cursed Pendant -1).
  function equipDelta(st, p) {
    var d = 0;
    st.players[p].equipment.forEach(function (e) { if (e.delta) d += e.delta; });
    for (var q = 0; q < st.numPlayers; q++) if (q !== p)
      st.players[q].equipment.forEach(function (e) { if (e.oppDelta) d += e.oppDelta; });
    return d;
  }
  // Pending pre-fight value boost (Infuse / Imbue / Divine Tactic): adds to the value of
  // player p's next fight play. Folded into applyEquip so it is reflected in move
  // enumeration and the beats() check, then consumed by play().
  function playBoost(st, p) { return (st.players[p] && st.players[p].nextPlayBoost) || 0; }
  // REWORK Ride value modifiers: Giant Boar (J♣) = +1 to your plays on YOUR turn (offensive). Giant Swan
  // (defensive, on the opponent's turn) is wired in 4b where the defending-value hook lives.
  function rideValue(st, p) {
    var forms = st.players[p] && st.players[p].forms; if (!forms || !forms.length) return 0;
    var d = 0;
    if (st.turn === p && forms.some(function (f) { return f.rank === 11 && f.suit === 'C'; })) d += 1;   // Giant Boar: +1 on YOUR turn (attack)
    return d;
  }
  // Giant Swan (J♥): your play resists +1 while it sits on the pile and the Rival tries to beat it (defense).
  // Baked into the STORED pile value, NOT into your own beats() check — it never helps you attack.
  function swanValue(st, p) {
    var forms = st.players[p] && st.players[p].forms; if (!forms || !forms.length) return 0;
    return forms.some(function (f) { return f.rank === 11 && f.suit === 'H'; }) ? 1 : 0;
  }
  // Cost Rides (Owl / Ram): only the ACTIVE player's FIRST proactive effect each turn is modified.
  // st._effUsed: has the CURRENT active player already spent an effect this turn? Reset to false on every turn advance
  // (a plain seat compare fails — st.turn is a seat index that repeats each of a player's turns, so the flag would
  // stick and the Owl discount / Ram tax would only ever apply on a seat's very first activation of the whole game).
  function firstEffectThisTurn(st) { return !st._effUsed; }
  function rideCostDelta(st, p, card) {
    if (card == null || (card.rank >= 11 && card.rank <= 13)) return 0;   // transforms are a flat 10, unaffected
    if (p !== st.turn || !firstEffectThisTurn(st)) return 0;
    var d = 0, mine = st.players[p].forms || [];
    if (mine.some(function (f) { return f.rank === 11 && f.suit === 'D'; })) d -= 1;    // Giant Owl: your first effect −1
    for (var q = 0; q < st.numPlayers; q++) if (q !== p && (st.players[q].forms || []).some(function (f) { return f.rank === 11 && f.suit === 'S'; })) d += 1;   // Giant Ram: +1 to the opponent's first effect
    return d;
  }
  function effectiveCost(st, p, card) { return Math.max(0, activationCost(card) + rideCostDelta(st, p, card)); }
  function applyEquip(combo, p, st) {
    var d = equipDelta(st, p) + playBoost(st, p) + rideValue(st, p);
    if (!d || !combo) return combo;
    var key = combo.key.slice(); key[0] += d;
    return { type: combo.type, size: combo.size, value: combo.value + d, key: key, cards: combo.cards };
  }
  // Itemize the SAME value modifiers applyEquip() sums for player p's play, each with its source name, so the
  // UI can show "+1 from Giant Boar" / "+3 from Giant Boar, Hero's Sword" / "−2 from Spiked Armor". Offensive
  // context (your play on your turn): Giant Boar (+1, your turn only), your own equipment `delta`, opponents'
  // `oppDelta` against you, and a charged pre-fight boost. Totals to the same number applyEquip adds.
  function playModifiers(st, p) {
    var out = [];
    if (st.turn === p) {
      var forms = st.players[p].forms || [];
      if (forms.some(function (f) { return f.rank === 11 && f.suit === 'C'; })) out.push({ amount: 1, source: 'Giant Boar' });
    }
    st.players[p].equipment.forEach(function (e) { if (e.delta) out.push({ amount: e.delta, source: e.name }); });
    for (var q = 0; q < st.numPlayers; q++) if (q !== p)
      st.players[q].equipment.forEach(function (e) { if (e.oppDelta) out.push({ amount: e.oppDelta, source: e.name }); });
    var pb = playBoost(st, p); if (pb) out.push({ amount: pb, source: 'charged play' });
    return out;
  }
  // Itemize the COST modifiers on p's activations this turn (a different axis from value): Giant Owl (−1 to your
  // first effect) and Giant Ram (+1 to the opponent's first effect). Turn-level readout — only meaningful while
  // p is active and hasn't spent their first effect yet; transforms (flat 10) are exempt from these in practice.
  function costModifiers(st, p) {
    var out = [];
    if (st.turn !== p || !firstEffectThisTurn(st)) return out;
    if ((st.players[p].forms || []).some(function (f) { return f.rank === 11 && f.suit === 'D'; })) out.push({ amount: -1, source: 'Giant Owl' });
    for (var q = 0; q < st.numPlayers; q++) if (q !== p && (st.players[q].forms || []).some(function (f) { return f.rank === 11 && f.suit === 'S'; })) out.push({ amount: 1, source: 'Giant Ram' });
    return out;
  }
  // Equipment is ONGOING (like an enchantment), not locked at play time: while a Special/jab sits on the table,
  // its value tracks the current equipment on the board — equip a debuff (Spiked Armor) in response and it blunts
  // the pile right now; disarm a buff (Hero's Sword) and the pile drops. Only the TIMING-gated boosts stay frozen
  // at play time: the pre-fight boost and Giant Swan (defensive) are baked into `lockedDelta`; Giant Boar
  // (offensive) is deliberately excluded (it only helps you attack, never holds a pile). refreshPile recomputes
  // the live equipment contribution from scratch, so it's correct whether an equipment was just added or removed.
  function refreshPile(st) {
    if (!st.pile || !st.pile.combo || st.pile.phantom || st.pile.raw == null) return;   // phantom (Illusion) piles lock their own value
    var totalDelta = (st.pile.lockedDelta || 0) + equipDelta(st, st.pile.byPlayer);
    var c = st.pile.combo;
    c.value = st.pile.raw + totalDelta;
    if (c.key && c.key.length) c.key[0] = st.pile.rawKey0 + totalDelta;
    st.pile.mod = c.value - st.pile.raw;
  }
  // All equipment on the board (for targeting). own=true means it belongs to player p.
  function equipTargets(st, p) {
    var out = [];
    for (var q = 0; q < st.numPlayers; q++)
      st.players[q].equipment.forEach(function (e) { out.push({ playerIdx: q, id: e.id, name: e.name, own: q === p, protect: !!e.protect }); });
    return out;
  }
  // REWORK: everything a removal effect can hit — equipment always, plus zone Rides/Forms when the effect is
  // boosted (Penelope/Athena Forceful Strip, Perseus Sabotage). A zone target is keyed by its card's id.
  function removeTargets(st, p, eff) {
    var out = equipTargets(st, p);
    if (eff && (eff.ride || eff.form)) {
      for (var q = 0; q < st.numPlayers; q++) (st.players[q].forms || []).forEach(function (f) {
        if (!f.card) return;
        var isRide = f.tier === 'ride';
        if ((isRide && eff.ride) || (!isRide && eff.form)) out.push({ playerIdx: q, id: f.card.id, name: f.name, own: q === p, zone: isRide ? 'ride' : 'form' });
      });
    }
    return out;
  }
  // Choose the equipment a removal card hits: an explicit id, else auto (opponent's
  // protection equipment first, then any opponent equipment, then anything).
  function pickEquip(st, p, targetId) {
    var all = [];
    for (var q = 0; q < st.numPlayers; q++) st.players[q].equipment.forEach(function (e) { all.push({ q: q, e: e }); });
    if (targetId) return all.filter(function (t) { return t.e.id === targetId; })[0] || null;
    var opp = all.filter(function (t) { return t.q !== p; });
    return opp.filter(function (t) { return t.e.protect; })[0] || opp[0] || all[0] || null;
  }

  // Activate a card's effect from hand. opts: { discard:[ids], toTop:id } for the
  // effects that need a choice (auto-picks lowest cards if omitted).
  function activate(st, p, cardId, opts) {
    opts = opts || {};
    if (st.finished) return { ok: false, reason: 'Game over.' };
    if (p !== st.turn) return { ok: false, reason: 'Not your turn.' };
    if (isLocked(st, p)) return { ok: false, reason: 'You are locked out (Back Stab) — you skip this turn.' };
    var pl = st.players[p];
    var card = pl.hand.filter(function (c) { return c.id === cardId; })[0];
    if (!card) return { ok: false, reason: "You don't hold that card." };
    var eff = effectFor(st, p, card);                  // REWORK: apply this player's Form/Super boosts to the effect
    if (!eff) return { ok: false, reason: 'That card has no effect.' };
    if (!eff.impl) return { ok: false, reason: 'That effect is not available yet.' };
    // Quicks are castable proactively too (they fizzle if there's no valid target — never illegal, §0.4).
    if (eff.kind === 'stopper') return { ok: false, reason: 'STOPPERs are committed during a fight (see stopper()), not activated.' };
    if (eff.kind === 'phantasm') return { ok: false, reason: 'Phantasmal Illusion is cast during a fight (see phantasm()), not activated.' };
    if (eff.kind === 'counterfeit' && (!st.pile || st.pile.byPlayer === p)) return { ok: false, reason: "Counterfeit needs the Rival's current play to copy — cast it while facing an attack." };
    if (eff.kind === 'removeEquip' && removeTargets(st, p, eff).length === 0) return { ok: false, reason: 'No Equipment or zone card on the board to target.' };
    if (eff.kind === 'transform' && !transformGateOK(st, p, eff.tier)) return { ok: false, reason: 'Transformation requirements not met yet (shield threshold).' };
    var costDelta = (eff.kind === 'transform') ? 0 : rideCostDelta(st, p, card);   // Owl/Ram: first proactive effect of the turn
    if (!canAfford(pl, card, costDelta)) return { ok: false, reason: 'Not enough Fighter Energy of the right suit (need ' + costHint(card, costDelta) + ').' };

    // REWORK: Broadway pitch cost — Ultima Attack / Armor Piercing ALSO require discarding a Broadway card
    // (10, J, Q, K, or A) from hand as an additional cost. The pitched card goes to the Discard pile (a real
    // sacrifice — recoverable only via Hippolyta's reclaim-Discard). Auto-picks the least valuable (lowest 10 first).
    var pitchCard = null;
    if (eff.pitchHigh) {
      var pitchCands = pl.hand.filter(function (c) { return c.id !== cardId && BROADWAY[c.rank]; });
      if (!pitchCands.length) return { ok: false, reason: 'Also requires a Broadway card (10, J, Q, K, or A) in hand to discard.' };
      if (opts.pitch) pitchCard = pitchCands.filter(function (c) { return c.id === opts.pitch; })[0];
      if (!pitchCard) pitchCard = pitchCands.slice().sort(function (a, b) { return fightValue(a) - fightValue(b); })[0];
    }

    // Lead-lock guard: an activation must not leave you with an empty hand when you
    // would then have to LEAD a fresh fight — unless you are genuinely out of cards
    // everywhere (deck + shuffle empty), which is a real deck-out. This stops you
    // spending or discarding your last card into an unplayable turn.
    var leadAfter = (st.pile == null);
    var hasReserve = (pl.deck.length + pl.shuffle.length) > 0;
    if (leadAfter && hasReserve) {
      var minLeft;
      if (eff.kind === 'draw') minLeft = pl.hand.length - 1 + (eff.draw || 0) - (eff.top || 0) - (eff.discard || 0);
      else if (eff.kind === 'reclaim') minLeft = pl.hand.length - 1 + (eff.draw || 0);   // Instant Recovery refills; half-ramp does not
      else if (eff.kind === 'counterfeit') minLeft = pl.hand.length;   // nets a card (spend Counterfeit, gain the copy)
      else minLeft = pl.hand.length - 1; // ramp/shield/equip/recycle/discardOpp/destroyShield remove only the effect card
      if (eff.pitchHigh) minLeft -= 1;   // the Broadway pitch removes a second card
      if (minLeft <= 0) return { ok: false, reason: 'That would leave you with no card to lead the next fight — keep at least one in hand.' };
    }

    // remove the activated card from hand, pay the cost (the card is now "on the stack")
    pl.hand = pl.hand.filter(function (c) { return c.id !== cardId; });
    payEnergy(pl, card, costDelta);
    if (pitchCard) { pl.hand = pl.hand.filter(function (c) { return c.id !== pitchCard.id; }); pl.removed.push(pitchCard); }   // Broadway pitch → Discard pile
    if (eff.kind !== 'transform') { st._effUsed = true; }   // this turn's first-effect discount/tax is now spent

    // REWORK transform: J/Q/K go straight to the Forms & Rides Zone (persist, no decay, no counters/response).
    if (eff.kind === 'transform') {
      // ONE transform per RANK: a new J/Q/K replaces the existing one of that rank regardless of suit (with
      // Variant B any-suit boosts, holding two same-rank Forms adds nothing). The retired card banks as Energy.
      var displaced = pl.forms.filter(function (f) { return f.rank === card.rank; });
      pl.forms = pl.forms.filter(function (f) { return f.rank !== card.rank; });
      displaced.forEach(function (f) { if (f.card) pl.energy.push(f.card); });   // retired transform's card banks as Energy
      pl.forms.push({ rank: card.rank, suit: card.suit, tier: eff.tier, name: eff.name, card: card });
      if (TRANSFORM_DRAW) drawCards(pl, TRANSFORM_DRAW);   // on-cast draw (A/B: e.g. draw 5)
      return { ok: true, transformed: true, tier: eff.tier, name: eff.name, isSuper: hasSuper(pl), card: card, displaced: displaced.length };
    }

    // --- push the activated effect onto the stack; the opponent may answer with a Quick before it resolves ---
    var res = pushEffect(st, p, card, eff, opts);
    if (pitchCard && res) res.pitched = { rank: pitchCard.rank, suit: pitchCard.suit, id: pitchCard.id };
    return res;
  }

  // Would ANY living opponent both want and be able to answer this pending Technique? (N-player)
  function opponentCanRespond(st, p, eff) {
    for (var q = 0; q < st.numPlayers; q++) {
      if (q === p || st.players[q].eliminated) continue;
      var opp = st.players[q];
      var holds = function (kind) { return opp.hand.some(function (c) { var ef = effectFor(st, q, c); return ef && ef.impl && ef.kind === kind && canAfford(opp, c); }); };
      if (holds('counter')) return true;                                                     // Counter Spell answers any Technique
      if (holds('protect') && eff.kind === 'removeEquip' && opp.equipment.length > 0) return true; // Emergency Maintenance vs removal
    }
    return false;
  }

  // ---- effect stack: an activated Technique/Quick is a stack object; players pass priority
  // (active-first, auto-passing anyone with no Quick) answering with Quicks until it resolves —
  // Counter-a-Counter falls out naturally. st.pending / st.respondFor are the open-window aliases
  // the UI + AI read (the top object + who currently holds priority). ----
  function pushEffect(st, p, card, eff, opts) {
    st.stack.push({ oid: newOid(st), kind: 'effect', p: p, card: card, eff: eff, opts: opts, countered: false });
    return openResponseWindow(st);
  }
  // ---- PRE-FIGHT WINDOW (Phase 2): before the ACTIVE player's Play Sub-Phase, the NON-active player
  // may spring a proactive Quick. Gated to Back Stab (the lockout Quick — the card whose whole point is
  // this timing); widen preFightHolder to open it for any Quick. The sprung Quick goes on the stack, so
  // the active player still gets to answer it (e.g. Counter Spell the Back Stab). ----
  function preFightHolder(st) {
    if (st.finished || st.pending || st.shieldResponse || st.stack.length || st.preFightHandled) return -1;   // one window per active-player fight (survives UI suspend/resume)
    var q = nextPlayer(st, st.turn), opp = st.players[q];
    if (isLocked(st, q)) return -1;                                    // a player skipping their own turn can't interject
    var has = opp.hand.some(function (c) { var e = effectFor(st, q, c); return e && e.impl && e.quick && e.kind === 'lockout' && canAfford(opp, c); });   // Hermes makes Back Stab a Quick
    return has ? q : -1;
  }
  function openPreFight(st) {
    var q = preFightHolder(st);
    st.preFightQ = (q < 0) ? null : q;
    return { preFightPending: q >= 0, q: q };
  }
  function preFightCast(st, q, cardId, opts) {
    if (st.preFightQ !== q) return { ok: false, reason: 'No pre-fight window.' };
    var qp = st.players[q];
    var card = qp.hand.filter(function (c) { return c.id === cardId; })[0];
    if (!card) return { ok: false, reason: "You don't hold that card." };
    var eff = effectFor(st, q, card);
    if (!eff || !eff.impl || !eff.quick) return { ok: false, reason: 'That is not a Quick.' };
    if (!canAfford(qp, card)) return { ok: false, reason: 'Not enough Fighter Energy (need ' + costHint(card) + ').' };
    st.preFightQ = null; st.preFightHandled = true;
    qp.hand = qp.hand.filter(function (c) { return c.id !== cardId; });
    payEnergy(qp, card);
    var o = opts || {};
    if (o.target == null) o.target = st.turn;                          // a pre-fight Back Stab always locks the ACTIVE player (in 2p that's nextPlayer(q); in 3p+ they differ)
    return pushEffect(st, q, card, eff, o);                            // opens a response window for the active player
  }
  function preFightPass(st, q) { if (st.preFightQ === q) st.preFightQ = null; st.preFightHandled = true; return { ok: true, state: st }; }

  // Can player q put a Quick on the stack right now (any affordable impl Quick)? Used to decide
  // whether to open a response window or AUTO-PASS them (priority auto-passes players with no action).
  function canAddToStack(st, q) {
    var qp = st.players[q];
    return qp.hand.some(function (c) { var e = effectFor(st, q, c); return e && e.impl && e.quick && canAfford(qp, c); });   // effectFor: a Form can make a card Quick
  }
  // Priority loop (1v1): while an effect sits on top of the stack, prompt its NON-controller if they
  // can add a Quick; otherwise resolve the top and re-grant priority (active-first, auto-passing a
  // player with no action). A destroyShield loss underneath is handed to driveShieldStack once the
  // effects clear. Returns a pending result (window open) or the last resolution result.
  function openResponseWindow(st) {
    var last = { ok: true, state: st };
    while (st.stack.length && st.stack[st.stack.length - 1].kind === 'effect') {
      var top = st.stack[st.stack.length - 1];
      if (!top.passed) top.passed = {};                                 // per-object set of opponents who have passed this window
      // a destroyShield aimed at a target already at 0 shields is a no-op — never open a guard window (no shield to save)
      var dsTarget = top.eff.kind === 'destroyShield' ? effectTarget(st, top.p, top.opts) : -1;
      var noopDestroy = dsTarget >= 0 && st.players[dsTarget].shields <= 0;
      var q = -1;
      if (!noopDestroy) {                                               // offer priority to each living opponent in seat order after the controller
        for (var k = 1; k < st.numPlayers; k++) {
          var cand = (top.p + k) % st.numPlayers;
          if (st.players[cand].eliminated || top.passed[cand]) continue;
          if (canAddToStack(st, cand)) { q = cand; break; }
        }
      }
      if (q >= 0) {
        st.pending = top; st.respondFor = q;
        return { ok: true, state: st, effect: top.eff.id, kind: top.eff.kind, pending: true };
      }
      last = resolveTopEffect(st);                                      // everyone passed → resolve, then re-loop
      if (st.finished) return last;
    }
    if (st.stack.length && st.stack[st.stack.length - 1].kind === 'shieldloss') {
      var sres = driveShieldStack(st);
      if (sres && sres.shieldResponsePending) return sres;
    }
    return last;
  }
  // Resolve the single top effect object. A countered object fizzles to its owner's Shuffle Pile; a
  // Counter Spell counters the effect beneath it; Annoint shields the equipment a removal below aims
  // at (or your own); everything else runs its body.
  function resolveTopEffect(st) {
    var top = st.stack.pop(), pl = st.players[top.p];
    if (top.countered) { pl.shuffle.push(top.card); return { ok: true, effect: top.eff.id, kind: top.eff.kind, countered: true, state: st }; }
    if (top.eff.kind === 'counter') {
      for (var i = st.stack.length - 1; i >= 0; i--) { if (st.stack[i].kind === 'effect') { st.stack[i].countered = true; break; } }   // counter the effect beneath
      pl.removed.push(top.card);
      return { ok: true, effect: top.eff.id, kind: 'counter', state: st };
    }
    if (top.eff.kind === 'protect') {
      var rem = null;
      for (var j = st.stack.length - 1; j >= 0; j--) { if (st.stack[j].kind === 'effect' && st.stack[j].eff.kind === 'removeEquip') { rem = st.stack[j]; break; } }
      var prot = null;
      if (rem) { var t = pickEquip(st, rem.p, rem.opts && rem.opts.target); if (t) prot = t.e; }
      else { prot = pl.equipment.filter(function (e) { return !(top.opts && top.opts.target) || e.id === top.opts.target; })[0]; }
      if (prot) { prot.protectedRound = st.round; if (top.eff.addCounter) prot.counters += top.eff.addCounter; }   // Cassandra: also add a counter
      pl.removed.push(top.card);
      return { ok: true, effect: top.eff.id, kind: 'protect', state: st };
    }
    return resolveEffect(st, top.p, top.card, top.eff, top.opts);
  }
  // Player q answers the open window with a Quick: it goes on the stack (so it can itself be
  // answered), then priority re-opens.
  function respond(st, q, quickCardId) {
    if (!st.pending || st.respondFor !== q) return { ok: false, reason: 'No response window.' };
    var qp = st.players[q];
    var qcard = qp.hand.filter(function (c) { return c.id === quickCardId; })[0];
    if (!qcard) return { ok: false, reason: "You don't hold that card." };
    var qeff = effectFor(st, q, qcard);                // effectFor: honor a Form that made this card Quick
    if (!qeff || !qeff.impl || !qeff.quick) return { ok: false, reason: 'That is not a Quick.' };
    if (!canAfford(qp, qcard)) return { ok: false, reason: 'Not enough Fighter Energy of the right suit.' };
    qp.hand = qp.hand.filter(function (c) { return c.id !== quickCardId; });
    payEnergy(qp, qcard);
    st.stack.push({ oid: newOid(st), kind: 'effect', p: q, card: qcard, eff: qeff, opts: {}, countered: false });
    st.stack.forEach(function (o) { o.passed = {}; });                 // a Quick changed the board — everyone gets fresh priority on every object
    st.pending = null; st.respondFor = null;
    var res = openResponseWindow(st);
    res.respondedWith = qeff.id; res.respondKind = qeff.kind; res.respondName = qeff.name;
    return res;
  }
  // Player q passes the window: the top effect resolves (the controller had already passed by
  // casting it), then priority re-opens for whatever is now on top.
  function declineResponse(st, q) {
    if (!st.pending || st.respondFor !== q) return { ok: false, reason: 'No response window.' };
    var top = st.pending;
    if (!top.passed) top.passed = {};
    top.passed[q] = true;                            // q passes; other opponents may still answer this object (N-player)
    st.pending = null; st.respondFor = null;
    return openResponseWindow(st);                    // offer to the next opponent, or resolve when all have passed
  }

  // Resolve an effect body — called immediately, or after a response window closes.
  // Which single rival a "the Rival" effect hits. opts.target names it (human/AI choice); default = next living
  // opponent. At 2 players this is always the sole opponent, so singular effects are unchanged in a duel.
  function effectTarget(st, p, opts) {
    if (opts && opts.target != null && opts.target !== p && st.players[opts.target] && !st.players[opts.target].eliminated) return opts.target;
    return nextPlayer(st, p);
  }
  var HOSTILE_SINGLE = { discardOpp: 1, destroyShield: 1, energyDenyOpp: 1, lockout: 1 };   // singular effects that make a grudge
  function resolveEffect(st, p, card, eff, opts) {
    opts = opts || {};
    var pl = st.players[p], oppIdx = effectTarget(st, p, opts);
    if (st.players[oppIdx] && (HOSTILE_SINGLE[eff.kind] || (eff.kind === 'recycle' && eff.scope === 'opp'))) st.players[oppIdx].lastAttacker = p;   // grudge signal
    switch (eff.kind) {
      case 'ramp':
        for (var i = 0; i < eff.n; i++) { var c = drawOne(pl); if (c) pl.energy.push(c); }
        spendCard(pl, card); break;
      case 'draw':
        var beforeDraw = {}; pl.hand.forEach(function (c) { beforeDraw[c.id] = true; });
        drawCards(pl, eff.draw);
        var drawnIds = pl.hand.filter(function (c) { return !beforeDraw[c.id]; }).map(function (c) { return c.id; });   // the cards this dig just LOOKED AT
        if (eff.oppDraw) for (var q = 0; q < st.numPlayers; q++) if (q !== p) drawCards(st.players[q], eff.oppDraw);
        if (eff.top) {                                  // return N to the top of the deck (auto-picks lowest)
          var backs = choose(pl.hand, opts.toTop, eff.top), bset = {};
          backs.forEach(function (c) { bset[c.id] = true; });
          pl.hand = pl.hand.filter(function (c) { return !bset[c.id]; });
          backs.forEach(function (c) { pl.deck.unshift(c); });
        }
        if (eff.discard) {                              // dig: keep (draw − discard) of the LOOKED cards, bank the rest to Energy — only the looked cards are eligible
          var keepN = Math.max(0, (eff.draw || 0) - eff.discard);
          var dnSelf = Math.max(0, drawnIds.length - keepN);
          if (dnSelf > 0) {
            if (opts.discard || dnSelf >= drawnIds.length) {           // explicit pick, or no real choice (bank them all)
              var allowSet = {}; drawnIds.forEach(function (id) { allowSet[id] = true; });
              discardChosen(pl, (opts.discard || drawnIds).filter(function (id) { return allowSet[id]; }), dnSelf);
            }
            else { st.discardPending = { player: p, count: dnSelf, from: drawnIds }; }   // the owner picks which of the LOOKED cards to bank
          }
        }
        spendCard(pl, card); break;
      case 'shield':
        var sgain = (eff.shield || 1);
        var stargets = eff.shieldAll ? st.players : [pl];   // Sanctuary: shieldAll → every player gains, so it's a wash on the shield race (the nerf)
        for (var sti = 0; sti < stargets.length; sti++) {
          var swho = stargets[sti];
          if (SHIELD_CARDS && swho.shieldPile) { for (var sgi = 0; sgi < sgain; sgi++) { var sgc = drawOne(swho); if (sgc) swho.shieldPile.push(sgc); swho.shields += 1; } }   // Mechanic 1: a gained shield pulls a card from that player's own deck
          else swho.shields += sgain;
        }
        if (eff.shieldImmune) pl.shieldImmune = true;      // Apollo (Super): Sanctuary also locks the CASTER's shields for the round (caster-only)
        if (eff.draw) drawCards(pl, eff.draw);
        spendCard(pl, card); break;
      case 'ward':                                         // Leyline base: pure can't-lose, no ramp/recycle
        if (eff.immune) pl.shieldImmune = true;
        if (eff.cantLose) pl.cantLoseRound = true;
        spendCard(pl, card); break;
      case 'valueBoost':                                  // Infuse / Imbue / Divine Tactic: charge your next play
        pl.nextPlayBoost = (pl.nextPlayBoost || 0) + (eff.boost || 0);
        spendCard(pl, card); break;
      case 'shieldImmune':                                // Sphere of Invulnerability: no shield loss this round
        pl.shieldImmune = true; spendCard(pl, card); break;
      case 'onWin':                                       // Finishing Blow: your next combo win strips an extra shield
        pl.finishingBlow = true; spendCard(pl, card); break;
      case 'lockout':                                     // Back Stab: the target skips their NEXT turn (no fights, no Techniques)
        st.players[oppIdx].lockSkip = true;
        if (eff.lockRound) st.players[oppIdx].lockRound = true;   // Perseus / Hermes: skip the WHOLE round
        spendCard(pl, card); break;
      case 'equip':
        pl.equipment.push({
          id: eff.id, name: eff.name,
          delta: eff.delta || 0, oppDelta: eff.oppDelta || 0,
          counters: eff.counters || 5,
          decay: eff.decay !== false,        // default true; Holy Shroud sets decay:false (spend-only)
          ability: eff.ability || null,      // 'draw' — spend a counter for the ability
          protect: eff.protect || null,      // 'special' — no shield loss on Special defeats
          absorb: eff.absorb || false,       // Holy Shroud: spend a counter to absorb a shield loss
          usedThisRound: false, card: card
        });
        refreshPile(st);                                   // a new debuff/buff immediately re-values any pile already on the table (ongoing, not locked at play time)
        break;
      case 'recycle':
        var recyc = function (q) { var P = st.players[q]; P.shuffle = P.shuffle.concat(P.energy); P.energy = []; };
        if (eff.scope === 'all') { for (var q2 = 0; q2 < st.numPlayers; q2++) recyc(q2); }
        else if (eff.scope === 'opp') { recyc(oppIdx); }   // Pandora: Poison hits only the Rival
        else recyc(p);
        spendCard(pl, card); break;
      case 'discardOpp':                                  // Telekinesis / Discombobulate / Outbalance
        var oppD = st.players[oppIdx], dn = Math.min(eff.n || 2, oppD.hand.length);
        if (dn > 0) {
          if (opts.oppDiscard || dn >= oppD.hand.length) { discardChosen(oppD, opts.oppDiscard, dn); }  // forced-all needs no choice
          else { st.discardPending = { player: oppIdx, count: dn }; }   // the TARGET chooses which to pitch
        }
        spendCard(pl, card); break;
      case 'energyDenyOpp':                               // Chi Block: up to N of the Rival's Energy -> their Shuffle
        var oppE = st.players[oppIdx], take = Math.min(eff.n || 5, oppE.energy.length);
        for (var iE = 0; iE < take; iE++) oppE.shuffle.push(oppE.energy.shift());
        spendCard(pl, card); break;
      case 'reclaim':                                     // Leyline Ascension / Instant Recovery
        if (eff.wheel) {                                  // Ares (Super): the Wheel — dump hand + Discard + Shuffle into the deck, then draw fresh
          pl.deck = pl.deck.concat(shuffle(pl.shuffle.concat(pl.removed).concat(pl.hand)));
          pl.shuffle = []; pl.removed = []; pl.hand = [];
        } else {
          pl.deck = pl.deck.concat(shuffle(pl.shuffle)); pl.shuffle = [];   // Shuffle Pile back into the deck
          if (eff.reclaimDiscard) { pl.deck = pl.deck.concat(shuffle(pl.removed)); pl.removed = []; }   // Hippolyta: also pull your Discard (spent cards) back
        }
        if (eff.half) { var half = Math.floor(pl.deck.length / 2); for (var iH = 0; iH < half; iH++) { var hc = pl.deck.shift(); if (hc) pl.energy.push(hc); } }
        if (eff.draw) drawCards(pl, eff.draw);
        if (eff.immune) pl.shieldImmune = true;           // Leyline Ascension folds in Sphere's round-long shield immunity
        if (eff.cantLose) pl.cantLoseRound = true;        // …and, unlike Sphere, also blocks the Fighter Kick at 0 shields ("can't lose this round")
        spendCard(pl, card); break;
      case 'counterfeit':                                 // Counterfeit: copy a card from the Rival's current play into hand as a temp
        var poolCF = (st.pile && st.pile.byPlayer !== p) ? st.pile.combo.cards : null, srcCF = null;
        if (poolCF) {
          if (opts.copyId) srcCF = poolCF.filter(function (c) { return c.id === opts.copyId; })[0];
          if (!srcCF && opts.copyIdx != null) srcCF = poolCF[opts.copyIdx];
          if (!srcCF) srcCF = counterfeitPick(pl, poolCF);
        }
        if (srcCF) {
          st.copySeq = (st.copySeq || 0) + 1;
          pl.hand.push({ rank: srcCF.rank, suit: srcCF.suit, id: 'CF' + srcCF.rank + srcCF.suit + '#' + st.copySeq, temp: true, counterfeit: true, valueBonus: eff.copyPlus || 0 });   // Pandora/Hermes: copy at +value
          pl.hand = sortHand(pl.hand);
        }
        spendCard(pl, card); break;
      case 'destroyShield':                               // Ultima Attack / Critical Hit: the target already got a response window vs this technique (spring Leyline there); the loss itself no longer opens a second guard window
        st.stack.push({ oid: newOid(st), kind: 'shieldloss', target: oppIdx, n: (eff.n || 1), winner: p, source: eff.name, noKick: true, noGuard: true });
        spendCard(pl, card); break;
      case 'counter':                                     // proactively cast Counter Spell with nothing on the stack to counter — fizzles
        spendCard(pl, card); break;
      case 'protect':                                     // proactively cast Annoint — shield your own equipment for the round (fizzles if you have none)
        var ownEq = pl.equipment.filter(function (e) { return !opts.target || e.id === opts.target; })[0];
        if (ownEq) { ownEq.protectedRound = st.round; if (eff.addCounter) ownEq.counters += eff.addCounter; }   // Cassandra: also add a counter
        spendCard(pl, card); break;
      case 'befuddle':
        var opp2 = st.players[oppIdx];
        for (var i3 = 0; i3 < (eff.n || 6); i3++) { var bc = drawOne(opp2); if (bc) opp2.energy.push(bc); }
        spendCard(pl, card); break;
      case 'removeEquip':
        if ((eff.ride || eff.form) && opts.target) {          // REWORK: the target may be a zone Ride/Form
          var zHit = false;
          for (var zq = 0; zq < st.numPlayers && !zHit; zq++) {
            var zf = st.players[zq].forms.filter(function (f) { return f.card && f.card.id === opts.target; })[0];
            if (zf) {
              var zRide = zf.tier === 'ride';
              if ((zRide && eff.ride) || (!zRide && eff.form)) {
                st.players[zq].forms = st.players[zq].forms.filter(function (f) { return f !== zf; });
                if (eff.mode === 'hand') { st.players[zq].hand.push(zf.card); st.players[zq].hand = sortHand(st.players[zq].hand); }   // Forceful Strip
                else st.players[zq].removed.push(zf.card);                                                                            // Sabotage (destroy)
                zHit = true;
              }
            }
          }
          if (zHit) { spendCard(pl, card); break; }
        }
        var tgt2 = pickEquip(st, p, opts.target);
        if (tgt2 && tgt2.e.protectedRound !== st.round) {   // Emergency Maintenance can shield the target this round
          var ownerPl = st.players[tgt2.q];
          ownerPl.equipment = ownerPl.equipment.filter(function (x) { return x !== tgt2.e; });
          refreshPile(st);   // a pile already on the table loses this equipment's contribution (recomputed live)
          var ecard = tgt2.e.card;
          if (ecard) {
            var em = eff.eqMode || eff.mode;   // equipment destination (eqMode lets a boost redirect the equipment without touching the zone-target destination)
            if (em === 'hand') ownerPl.hand.push(ecard);
            else if (em === 'deckTop') ownerPl.deck.unshift(ecard);      // Forceful Strip (Queen/Super): on TOP of the deck — they must redraw it
            else if (em === 'deck') ownerPl.deck.push(ecard);           // returned to deck (bottom)
            else if (em === 'shuffle') ownerPl.shuffle.push(ecard);      // Plead for Peace -> Shuffle Pile
            else if (em === 'energy') ownerPl.energy.push(ecard);
            else ownerPl.removed.push(ecard);                            // destroy
          }
        }
        spendCard(pl, card); break;
    }
    // Genuine deck-out: activating your last card while you must lead (no reserve) is a loss.
    if (!pl.pendingTop && st.turn === p && st.pile == null && pl.hand.length === 0) {
      st.finished = true; st.winner = nextPlayer(st, p);
    }
    return { ok: true, state: st, effect: eff.id, kind: eff.kind, deckedOut: st.finished || undefined };
  }

  // Resolve a deferred DRAW2TOP1 top-of-deck choice (opts.pickTop). The UI calls
  // this after the player taps the card they want back on top of their deck.
  function chooseTop(st, p, cardId) {
    var pl = st.players[p];
    if (!pl.pendingTop) return { ok: false, reason: 'No pending top-of-deck choice.' };
    var c = pl.hand.filter(function (x) { return x.id === cardId; })[0];
    if (!c) return { ok: false, reason: "You don't hold that card." };
    pl.hand = pl.hand.filter(function (x) { return x.id !== cardId; });
    pl.deck.unshift(c);
    pl.pendingTop = false;
    return { ok: true, state: st };
  }

  // Spend a counter on an equipped ability (Seed Pouch: draw a card), once per round.
  function useEquipment(st, p, equipId) {
    if (st.finished) return { ok: false, reason: 'Game over.' };
    if (p !== st.turn) return { ok: false, reason: 'Not your turn.' };
    var pl = st.players[p];
    var e = pl.equipment.filter(function (x) { return x.id === equipId; })[0];
    if (!e || !e.ability) return { ok: false, reason: 'No usable equipment ability.' };
    if (e.usedThisRound) return { ok: false, reason: 'Already used this round.' };
    if (e.counters <= 0) return { ok: false, reason: 'No counters left.' };
    if (e.ability === 'draw') drawCards(pl, 1);
    e.counters -= 1; e.usedThisRound = true;
    if (e.counters <= 0) { retireEquip(pl, e); pl.equipment = pl.equipment.filter(function (x) { return x !== e; }); refreshPile(st); }   // a spent stat-stick leaving play re-values a standing pile
    return { ok: true, state: st, ability: e.ability, name: e.name };
  }

  // pick `n` cards: prefer the given ids, else auto-pick the lowest by value.
  function choose(hand, ids, n) {
    if (ids && ids.length) {
      var set = {}; ids.forEach(function (id) { set[id] = true; });
      return hand.filter(function (c) { return set[c.id]; }).slice(0, n);
    }
    return autoDiscardPick(hand, n);
  }
  // Auto-pick `n` cards to pitch that tries NOT to break up a Special: prefer true singletons
  // (ranks you hold exactly one of) lowest-first, and only dip into paired ranks if forced.
  function autoDiscardPick(hand, n) {
    if (n <= 0) return [];
    var byRank = {}; hand.forEach(function (c) { (byRank[c.rank] = byRank[c.rank] || []).push(c); });
    var singles = [], paired = [];
    hand.forEach(function (c) { (byRank[c.rank].length === 1 ? singles : paired).push(c); });
    var asc = function (a, b) { return a.rank - b.rank; };
    singles.sort(asc); paired.sort(asc);
    return singles.concat(paired).slice(0, n);
  }
  // Counterfeit auto-target: from the given pool (the Rival's current play), copy the card
  // that best helps us form a Special — prefer a rank we already hold, highest first; else highest.
  function counterfeitPick(pl, pool) {
    if (!pool || !pool.length) return null;
    var have = {}; pl.hand.forEach(function (c) { have[c.rank] = (have[c.rank] || 0) + 1; });
    var cands = pool.slice().sort(function (a, b) { return b.rank - a.rank; });
    for (var i = 0; i < cands.length; i++) if (have[cands[i].rank]) return cands[i];
    return cands[0];
  }
  // Move `n` chosen (or auto-picked) cards from a player's hand to their Shuffle pile.
  function discardChosen(pl, ids, n) {
    var chosen = choose(pl.hand, ids, n), dset = {};
    chosen.forEach(function (c) { dset[c.id] = true; });
    pl.hand = pl.hand.filter(function (c) { return !dset[c.id]; });
    chosen.forEach(function (c) { pl.energy.push(c); });   // discards -> Energy pile (shuffle is only for spent energy)
    return chosen;
  }
  // Complete a deferred discard (st.discardPending): the affected player pitches `count`
  // cards — the ids they chose, or an auto-pick that avoids breaking up a Special.
  function resolveDiscard(st, ids) {
    var dp = st.discardPending;
    if (!dp) return { ok: false, reason: 'No discard pending.' };
    var pl = st.players[dp.player], chosenIds = ids;
    if (dp.from && dp.from.length) {                                   // dig: only the just-looked cards are eligible to bank
      var allow = {}; dp.from.forEach(function (id) { allow[id] = true; });
      var inScope = (ids || []).filter(function (id) { return allow[id]; });
      if (inScope.length < dp.count) {                                // top up from the eligible looked cards (lowest first)
        var have = {}; inScope.forEach(function (id) { have[id] = true; });
        sortHand(pl.hand.filter(function (c) { return allow[c.id] && !have[c.id]; })).forEach(function (c) { if (inScope.length < dp.count) { inScope.push(c.id); have[c.id] = true; } });
      }
      chosenIds = inScope.slice(0, dp.count);
    }
    var discarded = discardChosen(pl, chosenIds, dp.count);
    st.discardPending = null;
    return { ok: true, discarded: discarded, player: dp.player };
  }

  // Fight plays resolve immediately. Value modifiers (equipment + pre-fight boosts like Infuse /
  // Imbue / Divine Tactics / Brilliant Tactic, all technique-speed via nextPlayBoost) fold in via
  // applyEquip; there are no fight-time attached Quick boosts (§STACK-DESIGN §0.2/0.3).
  function play(st, p, cards, opts) {
    opts = opts || {};
    if (st.finished) return { ok: false, reason: 'Game over.' };
    if (p !== st.turn) return { ok: false, reason: 'Not your turn.' };
    if (isLocked(st, p)) return { ok: false, reason: 'You are locked out (Back Stab) — you skip this turn.' };
    if (!cards || !cards.length) return { ok: false, reason: 'No cards.' };
    var pl = st.players[p];
    var owns = cards.every(function (c) { return pl.hand.some(function (h) { return h.id === c.id; }); });
    if (!owns) return { ok: false, reason: "You don't hold those cards." };
    var combo = detectCombo(cards);
    if (!combo) return { ok: false, reason: 'Not a legal combination.' };
    if (st.round < 2 && combo.size > 1) return { ok: false, reason: 'Round 1 is singles only.' };
    var eff = applyEquip(combo, p, st);                                 // equipment + pre-fight boost + Giant Boar (offensive) — used ONLY to clear the beats check
    if (!beats(eff, st.pile ? st.pile.combo : null)) return { ok: false, reason: "Doesn't beat the current play." };
    var ids = {}; cards.forEach(function (c) { ids[c.id] = true; });
    pl.hand = pl.hand.filter(function (c) { return !ids[c.id]; });
    cards.forEach(function (c) { pl.energy.push(c); });                 // fought cards -> energy pile
    // The pile stores the RAW combo plus a `lockedDelta` of the timing-gated boosts frozen at play time:
    // the pre-fight boost (playBoost) + Giant Swan (defensive). Giant Boar (offensive) is excluded — it only
    // helps you BEAT a pile, never hold one. Equipment is NOT frozen here; refreshPile() layers the live
    // equipment delta on top, so the pile's value keeps tracking the board as equipment is added or removed.
    var swan = swanValue(st, p), lockedDelta = playBoost(st, p) + swan;
    var stored = { type: combo.type, size: combo.size, value: combo.value, key: combo.key.slice(), cards: eff.cards };
    st.pile = { combo: stored, byPlayer: p, raw: combo.value, rawKey0: combo.key[0], lockedDelta: lockedDelta, mod: 0 };
    refreshPile(st);                                                    // fold in the current equipment contribution (== play-time value, and re-evaluated whenever equipment changes)
    pl.nextPlayBoost = 0;                                               // a pre-fight boost is spent by the play it powers
    st.lastPlayer = p; st.passes = 0;
    st.turn = nextPlayer(st, p); st.preFightHandled = false; st._effUsed = false;           // fresh pre-fight window for the next active player
    return { ok: true, state: st, combo: combo, boosted: stored.value !== combo.value };
  }

  function pass(st, p) {
    if (st.finished) return { ok: false, reason: 'Game over.' };
    if (p !== st.turn) return { ok: false, reason: 'Not your turn.' };
    if (!st.pile) {
      // Normally you must lead. A locked-out player (Back Stab) can't play, so leading falls
      // through to the next player instead of dead-locking the round. Spending this skip clears the lock.
      if (isLocked(st, p)) { st.players[p].lockSkip = false; st.turn = nextPlayer(st, p); st.preFightHandled = false; st._effUsed = false; return { ok: true, state: st, forcedSkip: true }; }
      return { ok: false, reason: 'You must lead — cannot pass.' };
    }
    if (isLocked(st, p)) st.players[p].lockSkip = false;    // a locked follower's forced pass spends the skip
    st.passes += 1;
    if (st.passes >= aliveCount(st) - 1) return resolveRoundWin(st);          // all OTHER living players have passed → last to play wins
    st.turn = nextPlayer(st, p); st.preFightHandled = false; st._effUsed = false;
    return { ok: true, state: st };
  }

  // STOPPER retired — the apex "2" is the stopper by value now, not an activated cancel. Always 0.
  function stopperNeed(st) { return 0; }
  // Commit N STOPPERs to cancel the current play. N must equal the play's size (1/2/3).
  // Each committed STOPPER pays its own cost (1 pip of its suit) and is removed from the game.
  // The play is voided and you seize the initiative (you lead next). No shield is stripped.
  function stopper(st, p, ids) {
    if (st.finished) return { ok: false, reason: 'Game over.' };
    if (p !== st.turn) return { ok: false, reason: 'Not your turn.' };
    var pl = st.players[p];
    if (!st.pile) return { ok: false, reason: 'Nothing to cancel — you have the lead.' };
    var need = stopperNeed(st);
    if (need === 0) return { ok: false, reason: 'STOPPERs cannot cancel a 5-card combo.' };
    if (!ids || ids.length !== need) return { ok: false, reason: 'Commit exactly ' + need + ' STOPPER' + (need > 1 ? 's' : '') + ' to cancel a ' + st.pile.combo.type + '.' };
    var cards = [], seen = {};
    for (var i = 0; i < ids.length; i++) {
      if (seen[ids[i]]) return { ok: false, reason: 'Duplicate card.' };
      seen[ids[i]] = true;
      var c = pl.hand.filter(function (h) { return h.id === ids[i]; })[0];
      if (!c) return { ok: false, reason: "You don't hold that card." };
      var ef = effectOf(c);
      if (!ef || ef.kind !== 'stopper') return { ok: false, reason: 'That is not a STOPPER.' };
      cards.push(c);
    }
    if (pl.hand.length - need < 1) return { ok: false, reason: 'Cancelling would leave you no card to lead — keep at least one.' };
    // Each STOPPER is a Technique: you pay its FULL cost (its value — colored pips of its suit
    // plus a generic remainder), like any other card. Dry-run on a copy of the pile first so a
    // partial multi-STOPPER commit can never over-draw your energy.
    var probe = { energy: pl.energy.slice(), shuffle: [] };
    for (var j = 0; j < cards.length; j++) {
      if (!canAfford(probe, cards[j])) return { ok: false, reason: 'Not enough Fighter Energy to commit those STOPPERs (each costs ' + costHint(cards[j]) + ').' };
      payEnergy(probe, cards[j]);
    }
    cards.forEach(function (c) {
      pl.hand = pl.hand.filter(function (h) { return h.id !== c.id; });
      payEnergy(pl, c);                                          // pay the STOPPER's full cost
      spendCard(pl, c);                                        // Techniques recycle (spendCard)
    });
    var cancelled = st.pile.combo.type;
    st.pile = null; st.lastPlayer = p; st.passes = 0; st.turn = p; // voided; you take the initiative — no shield stripped
    return { ok: true, state: st, cancelled: cancelled, committed: need };
  }

  // Phantasmal Illusion: conjure a copy of the Rival's WHOLE current play, then swap one card —
  // drop one of theirs, add one from your hand — to make a same-size Special that overtakes it.
  // Only the one added card is really spent (into Energy); the copied cards are illusions that
  // vanish. Because you swap just one card, it can slide a straight up OR flip a full house
  // (copy 88899, drop an 8, add your 9 -> 99988). It can't beat a plain pair/trio: one swap
  // can't raise a matched set.
  function phantasm(st, p, opts) {
    opts = opts || {};
    if (st.finished) return { ok: false, reason: 'Game over.' };
    if (p !== st.turn) return { ok: false, reason: 'Not your turn.' };
    if (isLocked(st, p)) return { ok: false, reason: 'You are locked out (Back Stab) — you skip this turn.' };
    if (!st.pile) return { ok: false, reason: 'There is no current play to copy — you have the lead.' };
    if (st.lastPlayer === p) return { ok: false, reason: 'You already hold the initiative.' };
    var pl = st.players[p];
    var pc = pl.hand.filter(function (c) { return c.id === opts.cardId; })[0];
    if (!pc) return { ok: false, reason: "You don't hold Phantasmal Illusion." };
    var pe = effectFor(st, p, pc);                     // effectFor: Odysseus (K♦) conjures the illusion at +value
    if (!pe || pe.kind !== 'phantasm') return { ok: false, reason: 'That is not Phantasmal Illusion.' };
    if (!canAfford(pl, pc)) return { ok: false, reason: 'Not enough Fighter Energy (need ' + costHint(pc) + ').' };
    var add = pl.hand.filter(function (c) { return c.id === opts.addId; })[0];
    if (!add || add.id === pc.id) return { ok: false, reason: 'Choose a card from your hand to add to the illusion.' };
    var base = st.pile.combo.cards;
    if (opts.removeIdx == null || opts.removeIdx < 0 || opts.removeIdx >= base.length) return { ok: false, reason: 'Choose which copied card to drop.' };
    if (pl.hand.length - 2 < 1 && (pl.deck.length + pl.shuffle.length) === 0) return { ok: false, reason: 'Keep a card to lead — not enough cards to spend on the illusion.' };
    var phantom = [];
    for (var i = 0; i < base.length; i++) {
      if (i === opts.removeIdx) continue;
      st.copySeq = (st.copySeq || 0) + 1;
      phantom.push({ rank: base[i].rank, suit: base[i].suit, id: 'PH' + base[i].rank + base[i].suit + '#' + st.copySeq, temp: true });
    }
    var candCards = phantom.concat([{ rank: add.rank, suit: add.suit, id: add.id }]);
    var cand = detectCombo(candCards);
    if (!cand) return { ok: false, reason: 'That swap does not form a legal Special.' };
    if (pe.phantasmPlus) cand = { type: cand.type, size: cand.size, value: cand.value + pe.phantasmPlus, key: [cand.key[0] + pe.phantasmPlus].concat(cand.key.slice(1)), cards: cand.cards };   // Odysseus: +value
    if (!beats(cand, st.pile.combo)) return { ok: false, reason: "The new Special doesn't beat the current play." };
    pl.hand = pl.hand.filter(function (c) { return c.id !== pc.id; }); payEnergy(pl, pc); spendCard(pl, pc);   // the Illusion card is spent
    pl.hand = pl.hand.filter(function (c) { return c.id !== add.id; }); pl.energy.push(add);                     // your one real card is really played
    st.pile = { combo: cand, byPlayer: p, phantom: true };
    st.lastPlayer = p; st.passes = 0; st.turn = nextPlayer(st, p); st._effUsed = false;
    return { ok: true, state: st, made: cand.type, value: cand.value };
  }

  // A held card that can be SPRUNG in response to a shield threat to become immune this round (Leyline Ascension).
  // needCantLose: at 0 shields the threat is a KICK, so only a "can't lose this round" card qualifies.
  function shieldGuardCard(st, q, needCantLose) {
    var pl = st.players[q];
    return pl.hand.filter(function (c) { var e = effectOf(c); return e && e.impl && e.immune && (!needCantLose || e.cantLose) && canAfford(pl, c); })[0] || null;
  }
  // ---- shield-loss stack (the priority backbone; §STACK-DESIGN) ----
  // A shield loss is a stack object; the threatened player may respond (spring Leyline) before it
  // resolves. resolveRoundWin queues one object per loser, then drives the stack: each object
  // either opens a guard window (target holds an immunity card) or resolves (strips its shields).
  function newOid(st) { st.oidSeq = (st.oidSeq || 0) + 1; return 'o' + st.oidSeq; }
  // Apply one shield-loss object's strips to its target (parity with the old doStrips inner loop).
  function resolveShieldLossObj(st, obj, result) {
    var q = obj.target, opp = st.players[q];
    var wasBroken = opp.shields <= 0;                       // already at 0 coming in = a finishing strike
    for (var s2 = 0; s2 < obj.n && !st.finished; s2++) {
      if (opp.shields > 0) {                                                                            // you still have a shield to protect
        if (opp.cantLoseRound) { result.prevented = true; (result.spared = result.spared || []).push(q); continue; }   // Leyline: "can't lose this round"
        if (shieldSaved(st, q)) { result.prevented = true; continue; }                                 // Sphere / Holy Shroud
        if (opp.equipment.some(function (e) { return e.protect === 'special'; })) { result.prevented = true; continue; }
        if (opp.preventShield) { opp.preventShield = false; result.prevented = true; continue; }
        opp.shields -= 1; result.shieldStripped = true; opp.lastAttacker = obj.winner;                  // take a shield (+ grudge the striker)
        (result.struck = result.struck || []).push(q);   // WHO lost it — the UI could only say "a rival" without this
        if (SHIELD_CARDS && opp.shieldPile && opp.shieldPile.length) {                                  // Mechanic 1: the broken shield's card returns to its owner's hand
          opp.hand = sortHand(opp.hand.concat([opp.shieldPile.pop()]));
          result.shieldToHand = (result.shieldToHand || 0) + 1;
        }
      }
      else if (wasBroken && !obj.noKick) {                                                             // struck while already at 0 = the Fighter Kick
        if (opp.cantLoseRound || absorbSaved(st, q)) { result.prevented = true; break; }               // "can't lose this round" (Leyline) or a Holy Shroud counter absorbs the killing blow; plain shield-immunity (Sphere) can't save a shield you don't have
        st.players[obj.winner].kicksLanded = (st.players[obj.winner].kicksLanded || 0) + 1;            // hidden per-player stat (seeds the future Assassin)
        result.kick = true; (result.eliminated = result.eliminated || []).push(q);
        if (st.numPlayers === 2) { st.finished = true; st.winner = obj.winner; }                       // duel: the kick ends it (unchanged)
        else {                                                                                          // N-player: the kick is a death — eliminate, last Rider standing wins
          eliminatePlayer(st, q);
          if (aliveCount(st) <= 1) { st.finished = true; st.winner = lastAlive(st); }
        }
        break;
      }
      // else: overflow past 0 within one event — no overkill (Armor Piercing / destroyShield never kill)
    }
  }
  // Drive the shield-loss stack: open a guard window for the top object's target if they can spring
  // an immunity card; otherwise resolve it. Round-win context (st.roundWinResult set) finishes the
  // round when the stack empties; a mid-turn destroyShield just returns control.
  function driveShieldStack(st) {
    var roundWin = !!st.roundWinResult;
    var result = st.roundWinResult || { ok: true, state: st };
    while (st.stack.length && st.stack[st.stack.length - 1].kind === 'shieldloss') {
      var top = st.stack[st.stack.length - 1];
      var q = top.target, opp = st.players[q];
      var facingKick = opp.shields <= 0 && !top.noKick;                                       // at 0 shields, this strip is the Fighter Kick
      var canGuard = opp.shields > 0 || facingKick;                                           // guard a real shield, OR spring a "can't lose this round" card vs the kick
      if (!st.finished && !top.noGuard && canGuard && !wouldBeSaved(st, q)) {                 // read-only peek — don't consume a Holy Shroud here
        var guard = shieldGuardCard(st, q, facingKick);                                       // vs a kick, only a cantLose guard (Leyline) qualifies
        if (guard) {
          st.shieldResponse = { q: q, winner: top.winner, obj: top, result: result, guardId: guard.id, roundWin: roundWin };
          return { ok: true, state: st, roundWinner: result.roundWinner, wonWithCombo: roundWin || undefined, comboType: result.comboType, shieldResponsePending: true, threatened: q, guardId: guard.id, guardName: effectOf(guard).name };
        }
      }
      st.stack.pop();
      resolveShieldLossObj(st, top, result);
    }
    if (roundWin) return finishRoundWin(st, result);
    return result;
  }
  function livingNonWinners(st, winner) { var a = []; for (var i = 0; i < st.numPlayers; i++) if (i !== winner && !st.players[i].eliminated) a.push(i); return a; }
  var lossTargetInteractive = null;                    // predicate(st, winner) → true to DEFER a 'chosen' loss pick to a UI/remote choice (default null = always auto)
  function setLossTargetInteractive(fn) { lossTargetInteractive = fn; }
  function resolveRoundWin(st) {
    var winner = st.lastPlayer;
    st.preFightHandled = false;                                                // new round → fresh pre-fight windows
    var wonWithCombo = st.pile.combo.size > 1;                                 // only Specials strip shields
    if (APEX_INF && APEX_NOSTRIP && hasApex(st.pile.combo.cards)) wonWithCombo = false;   // only the no-strip variant declaws the apex
    var losers = livingNonWinners(st, winner);
    // who takes a shield loss (Specials only): 'all' = every loser; 'chosen' = the winner's one pick
    var strikeTargets = [];
    if (wonWithCombo) {
      if (SPECIAL_LOSS_MODE === 'chosen' && st.numPlayers > 2) {
        var cands = losers.slice();
        if (cands.length > 1 && lossTargetInteractive && lossTargetInteractive(st, winner)) {   // let a human (local or remote) choose whose shield to strip
          st.pendingLossChoice = { winner: winner, cands: cands, comboType: st.pile.combo.type, winSize: st.pile.combo.size };
          return { ok: true, state: st, roundWinner: winner, wonWithCombo: true, comboType: st.pile.combo.type, needsLossTarget: true, cands: cands.slice() };
        }
        var ct = chooseShieldTarget(st, winner); if (ct >= 0) strikeTargets = [ct];
      }
      else strikeTargets = losers.slice();
    }
    return applyRoundLoss(st, winner, wonWithCombo, strikeTargets, st.pile.combo.size);
  }
  // Complete a deferred 'chosen' loss pick (from resolveRoundWin's needsLossTarget). `target` is the struck seat.
  function chooseLossTarget(st, target) {
    var pc = st.pendingLossChoice; if (!pc) return { ok: false, reason: 'No loss choice pending.' };
    if (pc.cands.indexOf(target) < 0) target = pc.cands[0];                    // guard: must be one of the candidates
    st.pendingLossChoice = null;
    return applyRoundLoss(st, pc.winner, true, [target], pc.winSize);
  }
  // Apply the round result: mill the loser(s), strip the struck shield(s), then finish. Shared by the immediate and
  // the deferred (chosen-target) paths so behaviour is identical either way.
  function applyRoundLoss(st, winner, wonWithCombo, strikeTargets, winSize) {
    var losers = livingNonWinners(st, winner);
    // Jab wins strip no shield, so there is no "struck" target — but the round loser(s) still bank catch-up
    // energy equal to the winning play (1 card on a jab). So a jab always mills EVERY non-winner; only Special
    // wins consult MILL_SCOPE ('targeted' = just the struck shield's owner, 'universal' = every loser).
    var millTargets = !wonWithCombo ? losers : ((MILL_SCOPE === 'targeted') ? strikeTargets : losers);
    var milledThisRound = null;
    if (LOSER_MILL) {                                                          // Mechanic 2: mill (winning-play size) into Energy
      millTargets.forEach(function (lm) {
        var lp = st.players[lm];
        var runway = lp.deck.length + lp.shuffle.length;                       // cards it can still draw before decking out
        var mill = Math.min(winSize, Math.max(0, runway - LOSER_MILL_RESERVE));
        for (var mi = 0; mi < mill; mi++) { var mc = drawOne(lp); if (mc) lp.energy.push(mc); }
        if (mill > 0) { (milledThisRound = milledThisRound || {})[lm] = mill; }
      });
    }
    var result = { ok: true, state: st, roundWinner: winner, wonWithCombo: wonWithCombo, comboType: st.pile.combo.type, shieldStripped: false, kick: false };
    if (milledThisRound) result.milled = milledThisRound;                      // per-round mill counts, for the UI
    if (!wonWithCombo || !strikeTargets.length) return finishRoundWin(st, result);   // jab win (or no valid target): nobody loses a shield
    var wpl = st.players[winner];
    var strips = 1;
    if (wpl.finishingBlow) { strips = 2; wpl.finishingBlow = false; result.finishingBlow = true; }   // Finishing Blow: one extra
    st.roundWinResult = result;
    strikeTargets.forEach(function (q) {
      st.stack.push({ oid: newOid(st), kind: 'shieldloss', target: q, n: strips, winner: winner, source: 'fight' });
    });
    return driveShieldStack(st);
  }
  // Spring the reactive immunity card (Leyline) to save the threatened shield, then finish the round.
  function shieldGuard(st, q, cardId) {
    var sr = st.shieldResponse;
    if (!sr || sr.q !== q) return { ok: false, reason: 'No shield response window.' };
    var pl = st.players[q];
    var card = pl.hand.filter(function (c) { return c.id === cardId; })[0];
    if (!card) return { ok: false, reason: "You don't hold that card." };
    var eff = effectOf(card);
    if (!eff || !eff.immune) return { ok: false, reason: 'That card cannot guard a shield.' };
    if (!canAfford(pl, card)) return { ok: false, reason: 'Not enough Fighter Energy (need ' + costHint(card) + ').' };
    pl.hand = pl.hand.filter(function (c) { return c.id !== cardId; });
    payEnergy(pl, card);
    resolveEffect(st, q, card, eff, {});                                     // reclaim + round-long shield immunity
    st.shieldResponse = null;
    var res = driveShieldStack(st);                                          // the guarded object now fizzles (immune)
    res.guarded = true; res.guardName = eff.name; res.guardedBy = q;
    return res;
  }
  // Decline the shield-guard window: take the hit (resolve the object), then finish the round.
  function shieldGuardPass(st, q) {
    var sr = st.shieldResponse;
    if (!sr || sr.q !== q) return { ok: false, reason: 'No shield response window.' };
    st.shieldResponse = null;
    var idx = st.stack.indexOf(sr.obj);                                      // resolve the object they declined to guard
    if (idx >= 0) { st.stack.splice(idx, 1); resolveShieldLossObj(st, sr.obj, sr.result); }   // sr.result: round-win result, or a mid-turn placeholder
    return driveShieldStack(st);
  }
  // When true, finishRoundWin resolves the round but does NOT draw the new hand — the caller (the UI) draws
  // later via roundDraw(), so an end-of-round hand-limit discard can happen BEFORE the new cards are drawn.
  // Headless AI-vs-AI (test/analysis/sims) leave this false, so play()/pass() stay self-contained.
  var DEFER_DRAW = false;
  function setDeferRoundDraw(v) { DEFER_DRAW = !!v; }
  // CATCH-UP MECHANIC 1 (experimental, default OFF): shields ARE cards. At setup each player
  // deals START_SHIELDS cards into a face-down shieldPile; when a shield breaks its card goes to
  // the owner's hand (the trailing player refuels), and a gained shield pulls a fresh card into
  // the pile. Toggled by sims via setShieldCards; the shipped UI leaves it off.
  var SHIELD_CARDS = false;
  function setShieldCards(v) { SHIELD_CARDS = !!v; }
  // CATCH-UP MECHANIC 2 (experimental, default OFF): when a player LOSES a round, they mill cards
  // from their deck into their Energy Pile equal to the winning play's size — restoring the energy
  // the winner banked by making them pass. Guardrail: never mill below LOSER_MILL_RESERVE cards of
  // draw runway (deck+shuffle), so the catch-up can't itself deck the trailing player out.
  var LOSER_MILL = false, LOSER_MILL_RESERVE = 4;
  function setLoserMill(v) { LOSER_MILL = !!v; }
  // ---- N-PLAYER round-resolution toggles (both are no-ops at numPlayers===2) ----
  // SPECIAL_LOSS_MODE: on a Special win, 'all' = every non-winner loses a shield; 'chosen' = winner strips one rival.
  // MILL_SCOPE: 'universal' = all non-winners mill each round; 'targeted' = only the struck rival(s) mill.
  var SPECIAL_LOSS_MODE = 'all', MILL_SCOPE = 'universal';
  function setSpecialLossMode(m) { SPECIAL_LOSS_MODE = (m === 'chosen') ? 'chosen' : 'all'; }
  function setMillScope(m) { MILL_SCOPE = (m === 'targeted') ? 'targeted' : 'universal'; }
  // Who the round-winner strips in 'chosen' mode. Injectable (AI tiers / human UI set it); default = the leader
  // (most shields) among living opponents. At 2 players there's only one opponent, so it's a no-op.
  var shieldTargetChooser = null;
  function setShieldTargetChooser(fn) { shieldTargetChooser = fn; }
  function chooseShieldTarget(st, winner) {
    var cands = []; for (var i = 0; i < st.numPlayers; i++) if (i !== winner && !st.players[i].eliminated) cands.push(i);
    if (!cands.length) return -1;
    if (cands.length === 1) return cands[0];
    if (shieldTargetChooser) { var t = shieldTargetChooser(st, winner, cands); if (cands.indexOf(t) >= 0) return t; }
    var best = cands[0]; for (var c = 1; c < cands.length; c++) if (st.players[cands[c]].shields > st.players[best].shields) best = cands[c];
    return best;   // default: pressure the leader
  }
  // EXPERIMENT (default OFF): don't exile used Techniques/STOPPERs — send the spent card to the Shuffle
  // Pile so it can recycle back into the deck (like the apex "2" will, once it's a plain card, not a
  // self-exiling STOPPER technique). spendCard() is the single disposal hook.
  var RECYCLE_TECH = false;
  function setRecycleTech(v) { RECYCLE_TECH = !!v; }
  function spendCard(pl, card) { (RECYCLE_TECH ? pl.shuffle : pl.removed).push(card); }
  var NO_STRAIGHT_FLUSH = true;    // SHIPPED: no straight-flush tier — a same-suit run scores as a plain straight (universal rule, same for every deck). Plain flushes were never a legal special. Setter kept for A/B sims only.
  function setNoStraightFlush(v) { NO_STRAIGHT_FLUSH = !!v; }
  // Transform economy (tunable for A/B balance tests; defaults = the shipped rework: cost 10, no draw, energy-gated).
  //   gate 'energy' = pay TRANSFORM_COST energy.  'self' = free but unlocked by YOUR shields lost (J/Q/K at 1/2/3).
  //   'table' = free but unlocked by TOTAL shields lost across the table (numPlayers × 1/2/3 for J/Q/K).
  var BROADWAY = { 1: 1, 10: 1, 11: 1, 12: 1, 13: 1 };   // the "Broadway" high cards: 10, J, Q, K, A — the pitch-cost set
  var TRANSFORM_COST = 0, TRANSFORM_DRAW = 1, TRANSFORM_GATE = 'table';   // shipped rework economy: free · draw 1 · escalation-gated by total table shields lost
  function setTransformCost(n) { TRANSFORM_COST = n | 0; }
  function setTransformDraw(n) { TRANSFORM_DRAW = n | 0; }
  function setTransformGate(m) { TRANSFORM_GATE = m || 'energy'; }
  // A/B: scale the Form/Super numeric boost INCREMENTS (e.g. 2 = double every +1/+2 boost). 1 = shipped.
  var BOOST_SCALE = 1, BOOST_NUM = { boost: 1, draw: 1, n: 1, delta: 1, oppDelta: 1 };
  function setBoostScale(s) { BOOST_SCALE = (typeof s === 'number' && s > 0) ? s : 1; }
  // A/B: Form→card suit matching. true (Variant A) = a Q/K boosts only its OWN suit's cards, Super needs a Q+K of
  // the same suit. false (Variant B) = a Q/K is a generic "key" that unlocks that tier for EVERY suit's cards
  // (each card still uses its own suit's boost table), and Super needs any Q + any K. Only affects multi-suit zones.
  var FORM_SUIT_MATCH = false;   // DEFAULT: Variant B (any-suit key) — sim-healthier; a Form lifts all suits, Super = any Q + any K. setFormSuitMatch(true) for Variant A (same-suit).
  function setFormSuitMatch(v) { FORM_SUIT_MATCH = (v !== false); }
  var TRANSFORM_TIER_LEVEL = { ride: 1, queen: 2, king: 3 };
  function shieldsLost(pl) { return Math.max(0, START_SHIELDS - pl.shields); }
  function transformGateOK(st, p, tier) {
    if (st && st.basics) return false;                 // BASICS: transforms disabled — J/Q/K are plain high cards
    var lvl = TRANSFORM_TIER_LEVEL[tier] || 1;
    if (TRANSFORM_GATE === 'self') return shieldsLost(st.players[p]) >= lvl;
    if (TRANSFORM_GATE === 'table') { var tot = 0; for (var q = 0; q < st.numPlayers; q++) tot += shieldsLost(st.players[q]); return tot >= st.numPlayers * lvl; }
    return true;   // 'energy' gate: no shield requirement (affordability is the gate)
  }
  // UI helper: is this tier unlocked, and the threshold progress (have/need shields lost). gate='none' when energy-gated.
  function transformGateStatus(st, p, tier) {
    if (st && st.basics) return { gate: 'basics', ok: false, have: 0, need: 0 };   // BASICS: transforms off
    var lvl = TRANSFORM_TIER_LEVEL[tier] || 1;
    if (TRANSFORM_GATE === 'self') return { gate: 'self', ok: shieldsLost(st.players[p]) >= lvl, have: shieldsLost(st.players[p]), need: lvl };
    if (TRANSFORM_GATE === 'table') { var tot = 0; for (var q = 0; q < st.numPlayers; q++) tot += shieldsLost(st.players[q]); return { gate: 'table', ok: tot >= st.numPlayers * lvl, have: tot, need: st.numPlayers * lvl }; }
    return { gate: 'none', ok: true, have: 0, need: 0 };
  }
  function transformCost() { return TRANSFORM_COST; }
  function transformDraw() { return TRANSFORM_DRAW; }
  // Ladder (low->high): 3 4 5 6 7 8 9 10 J(11) Q(12) K(13) A(1) 2 . Rank stays the card's identity (1-13).
  function fightValue(card) {
    var r = card.rank, v = (r >= 3 && r <= 13) ? r : (r === 1 ? 14 : (r === 2 ? 15 : r));   // 3..10, J, Q, K, A(14), 2(15 apex)
    if (APEX_INF && r === 2) return Infinity;   // apex rework: a 2 is unbeatable (and strips no shield — see applyRoundLoss)
    return v + (card.valueBonus || 0);   // Counterfeit copies can carry a +value bonus (Pandora/Hermes)
  }
  // Energy to activate a card's effect. J/Q/K cost a flat 10 to transform into the zone; Ace keeps cost 1;
  // 3-10 cost their number; 2 has no activated effect (returns 15 defensively but is never activated).
  function activationCost(card) {
    var r = card.rank;
    if (r >= 11 && r <= 13) return TRANSFORM_COST;   // J/Q/K transform cost (default 10; tunable for A/B)
    if (r === 1) return 1;
    return r;
  }
  // Draw DRAW_PER_ROUND for every player and run the deck-out check. Idempotent per result.
  function roundDraw(st, result) {
    result = result || {};
    if (result.drawn) return result;
    result.draws = [];
    var perRound = drawCountFor(st);
    for (var r = 0; r < st.numPlayers; r++) result.draws[r] = st.players[r].eliminated ? 0 : drawCards(st.players[r], perRound);
    result.drawn = true;
    // deck-out: the new leader has no card to lead with. Duel → they lose; N-player → they're eliminated.
    if (st.players[st.turn].hand.length === 0) {
      if (st.numPlayers === 2) { st.finished = true; st.winner = nextPlayer(st, st.turn); result.deckedOut = true; }
      else {
        var dq = st.turn; eliminatePlayer(st, dq); result.deckedOut = true; (result.eliminated = result.eliminated || []).push(dq);
        if (aliveCount(st) <= 1) { st.finished = true; st.winner = lastAlive(st); }
        else { st.turn = nextPlayer(st, dq); st.initiative = st.turn; st._effUsed = false; }
      }
    }
    return result;
  }
  function finishRoundWin(st, result) {
    st.stack = []; st.shieldResponse = null; st.roundWinResult = null;      // shield-loss stack is spent by here
    if (st.finished) return result;
    var winner = result.roundWinner;
    st.round += 1;
    st.initiative = winner; st.turn = winner; st.lastPlayer = null; st.pile = null; st.passes = 0; st._effUsed = false;
    st.players.forEach(function (pl) { pl.preventShield = false; pl.nextPlayBoost = 0; pl.shieldImmune = false; pl.cantLoseRound = false; pl.finishingBlow = false; pl.lockRound = false; }); // GUARD, pre-fight boost, immunity, can't-lose, Finishing Blow, and a whole-round lock all last only their round
    st.players.forEach(function (pl) {                               // counters: decay ones lose 1/round; all reset once-per-round; worn-out ones retire to Energy
      pl.equipment.forEach(function (e) { if (e.decay) e.counters -= 1; e.usedThisRound = false; });
      pl.equipment.filter(function (e) { return e.counters <= 0; }).forEach(function (e) { retireEquip(pl, e); });
      pl.equipment = pl.equipment.filter(function (e) { return e.counters > 0; });
    });
    st.players.forEach(function (pl) {                               // Counterfeit copies are illusions: any temp card still around fades at round's end
      var real = function (c) { return !c.temp; };
      pl.hand = pl.hand.filter(real); pl.energy = pl.energy.filter(real);
      pl.deck = pl.deck.filter(real); pl.shuffle = pl.shuffle.filter(real); pl.removed = pl.removed.filter(real);
    });
    result.newRound = st.round;
    if (!DEFER_DRAW) {                         // headless: one Clean-up (trim EVERY hand to the cap) then draw. The UI does this itself.
      for (var ci = 0; ci < st.numPlayers; ci++) if (st.players[ci].hand.length > MAX_HAND) discardToLimit(st, ci);
      roundDraw(st, result);
    }
    return result;
  }

  var API = {
    SUITS: SUITS, SUIT_SYMBOL: SUIT_SYMBOL, suitVal: suitVal,
    makeDeck: makeDeck, shuffle: shuffle, sortHand: sortHand,
    detectCombo: detectCombo, beats: beats, detectStraight: detectStraight,
    enumerateCombos: enumerateCombos, legalFightPlays: legalFightPlays, combinations: combinations,
    newGame: newGame, play: play, pass: pass, stopper: stopper, stopperNeed: stopperNeed, phantasm: phantasm, drawCards: drawCards, isLocked: isLocked,
    setDeferRoundDraw: setDeferRoundDraw, roundDraw: roundDraw, setShieldCards: setShieldCards, setLoserMill: setLoserMill, setRecycleTech: setRecycleTech,
    setSpecialLossMode: setSpecialLossMode, setMillScope: setMillScope, setShieldTargetChooser: setShieldTargetChooser, setLossTargetInteractive: setLossTargetInteractive, chooseLossTarget: chooseLossTarget, concede: concede, aliveCount: aliveCount, lastAlive: lastAlive,
    setNoStraightFlush: setNoStraightFlush, fightValue: fightValue, activationCost: activationCost, hasSuper: hasSuper, effectFor: effectFor, boostInfo: boostInfo, rideCostDelta: rideCostDelta, effectiveCost: effectiveCost, removeTargets: removeTargets,
    setTransformCost: setTransformCost, setTransformDraw: setTransformDraw, setTransformGate: setTransformGate, transformGateOK: transformGateOK, transformGateStatus: transformGateStatus, transformCost: transformCost, transformDraw: transformDraw, setBoostScale: setBoostScale, setFormSuitMatch: setFormSuitMatch,
    openPreFight: openPreFight, preFightCast: preFightCast, preFightPass: preFightPass,
    effectTarget: effectTarget,   // who a pending effect is aimed at — the UI needs it to say so out loud
    HOSTILE_SINGLE: HOSTILE_SINGLE,
    shieldGuard: shieldGuard, shieldGuardPass: shieldGuardPass, shieldGuardCard: shieldGuardCard,
    DECKS: DECKS, DECK_ORDER: DECK_ORDER, BASE_SUIT: BASE_SUIT, buildDeck: buildDeck,
    PARTS_TOTAL: PARTS_TOTAL, PARTS_SUITS: PARTS_SUITS, PARTS_PREFIX: PARTS_PREFIX,
    partsCount: partsCount, partsValid: partsValid, partsKey: partsKey, parseParts: parseParts,
    isPartsKey: isPartsKey, buildFromParts: buildFromParts, presetParts: presetParts,
    canAfford: canAfford, payEnergy: payEnergy, costReq: costReq, reorderEnergy: reorderEnergy, promoteEnergy: promoteEnergy, idSuits: idSuits, costHint: costHint, countSuit: countSuit, defaultPips: defaultPips,
    discardToLimit: discardToLimit, MAX_HAND: MAX_HAND,
    effectOf: effectOf, cardName: cardName, activate: activate, respond: respond, declineResponse: declineResponse, opponentCanRespond: opponentCanRespond, useEquipment: useEquipment, equipTargets: equipTargets, chooseTop: chooseTop, resolveDiscard: resolveDiscard, applyEquip: applyEquip, equipDelta: equipDelta, refreshPile: refreshPile, playModifiers: playModifiers, costModifiers: costModifiers,
    START_HAND: START_HAND, DRAW_PER_ROUND: DRAW_PER_ROUND, START_SHIELDS: START_SHIELDS,
    setShieldsPerPlayer: setShieldsPerPlayer, isShieldsPerPlayer: isShieldsPerPlayer,
    drawCountFor: drawCountFor, startShieldsFor: startShieldsFor,   // the UI must show the SCALED numbers, not the constants
    setApexInfinity: setApexInfinity, isApexInfinity: isApexInfinity,
    setApexNoStrip: setApexNoStrip, isApexNoStrip: isApexNoStrip,
    setDrawPerPlayer: setDrawPerPlayer, isDrawPerPlayer: isDrawPerPlayer
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.CardmenEngine = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
