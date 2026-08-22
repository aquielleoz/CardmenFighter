/* netview.js — per-seat snapshot for host-authoritative netplay.
 *
 * The host owns the engine `state`; it never ships raw state to clients (that would leak every hand).
 * Instead it builds a CURATED, REDACTED snapshot from ONE seat's perspective: that seat sees its own
 * full hand, and every other player is reduced to public info + hidden-zone COUNTS. The snapshot is a
 * plain JSON-serializable object carrying exactly what a client needs to render the board and know which
 * prompt (if any) is open for it. Pure module — no engine mutation, no DOM. Shared by host and client.
 */
(function (root) {
  'use strict';

  function card(c) { return c ? { rank: c.rank, suit: c.suit, id: c.id } : null; }
  function cards(a) { return (a || []).map(card); }
  function equip(e) {
    // equipment entries carry a card plus (optionally) a live counter — both public.
    if (!e) return null;
    var o = { card: card(e.card || e) };
    if (typeof e.counters === 'number') o.counters = e.counters;
    if (typeof e.counter === 'number') o.counters = e.counter;
    return o;
  }

  // What input, if any, seat `s` owes right now. Mirrors the turn-driver gates in the UI, in priority order.
  function promptFor(st, s) {
    if (st.finished) return null;
    if (st.shieldResponse && st.shieldResponse.q === s) return { kind: 'shieldGuard' };
    if (st.discardPending && st.discardPending.player === s) return { kind: 'discard', count: st.discardPending.count || 1 };
    if (st.preFightQ === s) return { kind: 'preFight' };
    if (st.pending && st.respondFor === s) return { kind: 'respond' };
    if (st.turn === s) return { kind: 'turn' };
    return null; // waiting on someone else
  }

  function pile(p) {
    if (!p) return null;
    return {
      byPlayer: p.byPlayer,
      mod: p.mod || 0,
      combo: p.combo ? { type: p.combo.type, value: p.combo.value, size: p.combo.size, cards: cards(p.combo.cards) } : null
    };
  }

  // Build the snapshot seat `seat` should receive.
  function snapshotFor(st, seat) {
    var players = st.players.map(function (pl, i) {
      var mine = (i === seat);
      var o = {
        shields: pl.shields,
        energyCount: (pl.energy || []).length,
        handCount: (pl.hand || []).length,
        deckCount: (pl.deck || []).length,
        shuffleCount: (pl.shuffle || []).length,
        removedCount: (pl.removed || []).length,
        forms: cards(pl.forms),
        equipment: (pl.equipment || []).map(equip),
        eliminated: !!pl.eliminated,
        kicksLanded: pl.kicksLanded || 0,
        deckKey: pl.deckKey || null,
        // round-long flags a client renders as badges (all public)
        shieldImmune: !!pl.shieldImmune,
        cantLoseRound: !!pl.cantLoseRound,
        finishingBlow: !!pl.finishingBlow
      };
      // HIDDEN INFO BOUNDARY: only your own seat's actual hand cards travel. Everyone else = count only.
      if (mine) o.hand = cards(pl.hand);
      return o;
    });
    return {
      v: 1,
      seat: seat,
      numPlayers: st.numPlayers,
      round: st.round,
      turn: st.turn,
      finished: !!st.finished,
      winner: (typeof st.winner === 'number') ? st.winner : null,
      pile: pile(st.pile),
      players: players,
      prompt: promptFor(st, seat)
    };
  }

  // ---- Full mirror: a redacted, seat-ROTATED clone of the engine state so a client can feed the real render().
  // The client's seat becomes index 0 (so all the UI's `=== YOU`/0 checks work), opponents' hidden zones become
  // same-length dummy arrays (hand/deck/shuffle/removed — only their COUNTS are ever shown), and every seat-index
  // field is remapped. Public info (energy, equipment, forms, shields, flags) travels intact.
  function dummies(n, tag) { var a = []; for (var i = 0; i < (n || 0); i++) a.push({ rank: 0, suit: 'x', id: 'hidden:' + tag + ':' + i, hidden: true }); return a; }
  function clonePlayer(pl, mine, tag, rot) {
    var o = {};
    for (var k in pl) if (typeof pl[k] !== 'object' || pl[k] === null) o[k] = pl[k];   // scalar flags copy straight
    o.hand = mine ? cards(pl.hand) : dummies((pl.hand || []).length, tag + 'h');        // your real hand; opponents = face-down count
    o.deck = dummies((pl.deck || []).length, tag + 'd');                                // nobody sees deck order
    o.shuffle = dummies((pl.shuffle || []).length, tag + 's');
    o.removed = dummies((pl.removed || []).length, tag + 'r');
    o.energy = cards(pl.energy);                                                        // public
    o.forms = (pl.forms || []).map(function (f) { return { rank: f.rank, suit: f.suit, tier: f.tier, name: f.name, card: card(f.card) }; });
    o.equipment = (pl.equipment || []).map(function (e) { var c = {}; for (var kk in e) c[kk] = (kk === 'card') ? card(e.card) : e[kk]; return c; });
    if (typeof pl.lastAttacker === 'number') o.lastAttacker = rot(pl.lastAttacker);
    return o;
  }
  function mirrorFor(st, seat) {
    var n = st.numPlayers;
    function rot(i) { return (typeof i === 'number' && i >= 0) ? ((i - seat + n) % n) : i; }
    var players = []; for (var i = 0; i < n; i++) players[rot(i)] = clonePlayer(st.players[i], i === seat, 'p' + i, rot);
    function remapPile(p) { if (!p) return null; return { byPlayer: rot(p.byPlayer), mod: p.mod || 0, phantom: !!p.phantom, combo: p.combo ? { type: p.combo.type, value: p.combo.value, size: p.combo.size, key: (p.combo.key || []).slice(), cards: cards(p.combo.cards) } : null }; }
    function remapStack(s) { return (s || []).map(function (o) { var c = {}; for (var k in o) c[k] = o[k]; if (typeof o.p === 'number') c.p = rot(o.p); if (typeof o.target === 'number') c.target = rot(o.target); if (typeof o.winner === 'number') c.winner = rot(o.winner); if (o.card) c.card = card(o.card); return c; }); }
    function remapSR(sr) { if (!sr) return null; var c = {}; for (var k in sr) c[k] = sr[k]; if (typeof sr.q === 'number') c.q = rot(sr.q); if (typeof sr.winner === 'number') c.winner = rot(sr.winner); return c; }
    return {
      numPlayers: n, players: players, round: st.round, basics: !!st.basics,
      turn: rot(st.turn), initiative: rot(st.initiative), lastPlayer: (st.lastPlayer == null ? null : rot(st.lastPlayer)),
      pile: remapPile(st.pile), passes: st.passes || 0,
      finished: !!st.finished, winner: (typeof st.winner === 'number') ? rot(st.winner) : null,
      pending: st.pending ? remapStack([st.pending])[0] : null, respondFor: (st.respondFor == null ? null : rot(st.respondFor)),
      discardPending: st.discardPending ? { player: rot(st.discardPending.player), count: st.discardPending.count, from: (st.discardPending.from || null) } : null,   // `from` = a dig's looked-at card ids (only the owner's own real ids, which they hold)
      shieldResponse: remapSR(st.shieldResponse), stack: remapStack(st.stack),
      preFightQ: (st.preFightQ == null ? null : rot(st.preFightQ)), preFightHandled: !!st.preFightHandled,
      pendingLossChoice: st.pendingLossChoice ? { winner: rot(st.pendingLossChoice.winner), cands: (st.pendingLossChoice.cands || []).map(rot), comboType: st.pendingLossChoice.comboType } : null,   // winner picks whose shield to strip
      roundWinResult: null,   // ceremony state is host-only; the client renders the settled board
      _mirror: true, _seat: seat
    };
  }

  var api = { snapshotFor: snapshotFor, promptFor: promptFor, mirrorFor: mirrorFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetView = api;
})(typeof window !== 'undefined' ? window : this);
