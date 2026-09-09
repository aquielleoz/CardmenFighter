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

  /* A CARD'S IDENTITY IS NOT JUST rank/suit/id (v1.31.115). This whitelist was three fields, and the engine
   * attaches three more that decide what the card IS rather than what it looks like — so a client received a
   * DIFFERENT CARD from the one the host held:
   *   `temp`        — `effectOf` short-circuits on it (engine.js:1017, :1022): a Counterfeit or Illusion copy
   *                   is a pure fight body with NO effect. Stripped, the client's copy resolved to the
   *                   ORIGINAL card's effect, so the reader printed a full Technique — name, cost, rules —
   *                   and `activatableCard` lit the ⚡ Activate button. The host then refused the intent,
   *                   because ITS card still had `temp`. Silent on both ends.
   *   `valueBonus`  — `copyBonus` sums it (engine.js:1122) and it feeds `applyEquip`, which `fightLegal`
   *                   uses to decide whether Fight lights up. Stripped, a client computed the play a point
   *                   or two short and Fight stayed dark for a play the host would have accepted. This is
   *                   the exact number v1.31.107 was added to make visible.
   *   `counterfeit` — the marker the copy is identified by.
   * Copied only when PRESENT, so an ordinary card's mirror shape is unchanged. This is not a redaction
   * boundary being widened: a hidden card never comes through here, it comes from `dummies()`. */
  function card(c) {
    if (!c) return null;
    var o = { rank: c.rank, suit: c.suit, id: c.id };
    if (c.temp) o.temp = true;
    if (c.counterfeit) o.counterfeit = true;
    if (c.valueBonus) o.valueBonus = c.valueBonus;
    return o;
  }
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
    /* SAME TREATMENT for the stack. The blanket copy carried `eff` and `opts` by reference — `opts.target`
       is an ABSOLUTE seat (engine.js effectTarget reads it) reaching a client whose own seat is 0, and
       `passed` is a map keyed by absolute seat. `eff` is static card data so it is safe to pass through,
       but it is named here rather than swept up, so the next key added to a stack object does not travel
       by accident. A seat that is not on the mirror cannot be silently misread. */
    function remapStack(s) {
      return (s || []).map(function (o) {
        var c = { oid: o.oid, kind: o.kind, source: o.source || null };
        if (typeof o.p === 'number') c.p = rot(o.p);
        if (typeof o.target === 'number') c.target = rot(o.target);
        if (typeof o.winner === 'number') c.winner = rot(o.winner);
        if (typeof o.n === 'number') c.n = o.n;
        if (o.countered != null) c.countered = !!o.countered;
        if (o.card) c.card = card(o.card);
        if (o.eff) c.eff = o.eff;                                  // static EFFECTS data — no seats, no cycles
        if (o.opts) c.opts = { target: rot(o.opts.target) };       // the only seat-bearing opt a client reads
        return c;
      });
    }
    /* PROJECT, NEVER COPY THE KEYS (v1.31.114). This was `for (var k in sr) c[k] = sr[k]`, which carried
       `obj` (an alias INTO st.stack) and `result` (which IS st.roundWinResult, and that holds `state: st`).
       So the mirror pointed back at the raw host state and was CIRCULAR — verified through a real round:
       `JSON.stringify(mirrorFor(st,1))` throws. On BroadcastChannel structured clone swallows the cycle and
       ships the whole host state; on a real RTCDataChannel the send throws inside a catch that discards it,
       so the threatened seat never receives the window it is being waited on for, and the table wedges.
       It also silently defeated the `roundWinResult: null` redaction three lines below, since that is the
       very object `result` aliased. Everything else in this file names its fields; these two helpers were
       the exceptions, and both were the bug. `obj` is projected down to the ONE property the client reads
       (`sr.obj.source`, template openShieldGuardModal) with its seat rotated. */
    function remapSR(sr) {
      if (!sr) return null;
      return {
        q: rot(sr.q), winner: rot(sr.winner), guardId: sr.guardId || null, roundWin: !!sr.roundWin,
        obj: sr.obj ? { source: sr.obj.source || null, n: sr.obj.n || 0, target: rot(sr.obj.target) } : null
      };
    }
    return {
      numPlayers: n, players: players, round: st.round, basics: !!st.basics,
      turn: rot(st.turn), initiative: rot(st.initiative), lastPlayer: (st.lastPlayer == null ? null : rot(st.lastPlayer)),
      pile: remapPile(st.pile), passes: st.passes || 0,
      finished: !!st.finished, winner: (typeof st.winner === 'number') ? rot(st.winner) : null,
      pending: st.pending ? remapStack([st.pending])[0] : null, respondFor: (st.respondFor == null ? null : rot(st.respondFor)), prioGen: st.prioGen || 0,   // NOT seat-valued: a counter, same for every seat, so it is declared PUBLIC rather than rotated
      discardPending: st.discardPending ? { player: rot(st.discardPending.player), count: st.discardPending.count, from: (st.discardPending.from || null) } : null,   // `from` = a dig's looked-at card ids (only the owner's own real ids, which they hold)
      shieldResponse: remapSR(st.shieldResponse), stack: remapStack(st.stack),
      preFightQ: (st.preFightQ == null ? null : rot(st.preFightQ)), preFightHandled: !!st.preFightHandled,
      pendingLossChoice: st.pendingLossChoice ? { winner: rot(st.pendingLossChoice.winner), cands: (st.pendingLossChoice.cands || []).map(rot), comboType: st.pendingLossChoice.comboType } : null,   // winner picks whose shield to strip
      /* WHO THE TABLE IS WAITING ON while a seat trims to hand size. Seat + COUNT only, never cards — a hand
       * must never travel (see E.takeReveal). Every seat but the local one is auto-trimmed, so this is only
       * ever set for the seat actually picking, and it exists so the OTHER seats can say why play has paused
       * instead of showing an unexplained gap mid-round. */
      trimPending: st.trimPending ? { player: rot(st.trimPending.player), need: st.trimPending.need } : null,
      /* TWO PUBLIC STATE SCALARS THAT NEVER TRAVELLED (v1.31.118). Neither is hidden information — they are
         facts about the GAME, not about a hand — and a client renders them wrong without them:
           `startShields` — `baseShields()` (template) draws the shield track from it and falls back to
                            `E.START_SHIELDS` (4). So a tutorial (2) or a table with shields-per-player on
                            (2+n, i.e. 8 at six players) renders four slots on every client.
           `_effUsed`     — `firstEffectThisTurn` is `!st._effUsed`, and it drives the Giant Owl −1 discount
                            and the Giant Ram +1 tax. Without it a client prices this turn's activation as
                            though the discount were always still available. */
      startShields: st.startShields, _effUsed: !!st._effUsed,
      roundWinResult: null,   // ceremony state is host-only; the client renders the settled board
      _mirror: true, _seat: seat
    };
  }

  var api = { snapshotFor: snapshotFor, promptFor: promptFor, mirrorFor: mirrorFor };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NetView = api;
})(typeof window !== 'undefined' ? window : this);
