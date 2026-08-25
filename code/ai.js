/* ============================================================================
 * CARDMEN FIGHTER — Duel AI (v0.1, pure logic)
 * A simple greedy fighter: when leading in a combo round it pushes its strongest
 * combo (to try to win the trick with a combo and strip a shield); otherwise it
 * dumps a low single. When following, it plays the cheapest beating combo, else
 * passes. It uses card effects generically (kind-driven) and answers the
 * opponent's Techniques with Quicks (Counter Spell / Emergency Maintenance).
 * ========================================================================== */
(function (root) {
  'use strict';
  var E = (typeof require !== 'undefined') ? require('./engine.js') : root.CardmenEngine;

  function isHuman(humans, i) { return !!(humans && humans.indexOf(i) !== -1); }

  // Does the hand hold a matching set (pair/trio) — i.e. is a shield-stripping combo likely this turn?
  function hasCombo(hand) { var m = {}; for (var i = 0; i < hand.length; i++) { var r = hand[i].rank; m[r] = (m[r] || 0) + 1; if (m[r] >= 2) return true; } return false; }

  // Counterfeit is worth casting (while following) only if copying a card from the Rival's play turns a
  // LOSING follow into an actual WIN — i.e. the copy completes a combo that BEATS the pile (accounting for
  // our equipment + any charged value boost). Merely matching a rank to TIE it (e.g. copy a 4 vs their pair
  // of 4s → our pair of 4s only ties) is a wasted card, so we skip it unless a boost pushes us over.
  function counterfeitHelps(st, p, pool, cfCard) {
    var pl = st.players[p], cur = st.pile ? st.pile.combo : null;
    if (!cur) return false;
    /* The Counterfeit card is SPENT by the cast, so the play it enables must stand WITHOUT it. Evaluating
     * with it still in hand let the AI approve a winning play that leaned on the very card it was about to
     * spend — e.g. "I'll have a pair of 8s" built on the ♠8 that IS the Counterfeit. */
    var rest = cfCard ? pl.hand.filter(function (c) { return c.id !== cfCard.id; }) : pl.hand;
    var boost = pl.nextPlayBoost || 0;
    function beatsCur(hand) {
      return E.enumerateCombos(hand).some(function (x) {
        if (st.round < 2 && x.combo.size > 1) return false;
        var base = E.applyEquip(x.combo, p, st);
        if (boost) { base = { type: base.type, size: base.size, value: base.value + boost, key: base.key.slice(), cards: base.cards }; base.key[0] += boost; }
        return E.beats(base, cur);
      });
    }
    if (beatsCur(pl.hand)) return false;               // already winning this fight — Counterfeit adds nothing
    var seen = {};
    return pool.some(function (c) {                     // does copying this rank turn the losing follow into a win?
      if (seen[c.rank]) return false; seen[c.rank] = true;
      return beatsCur(rest.concat([{ rank: c.rank, suit: c.suit, id: 'cf#' + c.rank + c.suit }]));
    });
  }

  /* Phantasmal Illusion: copy the current play at its base values and see whether anything we have pushes the
   * copy past it — our Equipment/boosts (applyEquip, the same call the engine makes), Odysseus's +1, or an
   * OPTIONAL one-card swap. Try the free options FIRST: a bare copy that already beats costs no card at all.
   * The swap used to be mandatory here and in the engine, which is why this only ever fired against a straight
   * or a full house — one swap cannot raise a matched set — and therefore effectively never. */
  function phantasmValue(st, p, cards, plus) {
    var cand = E.detectCombo(cards); if (!cand) return null;
    var eff = E.applyEquip ? E.applyEquip(cand, p, st) : cand;
    if (plus) eff = { type: eff.type, size: eff.size, value: eff.value + plus, key: [eff.key[0] + plus].concat(eff.key.slice(1)), cards: eff.cards };
    return eff;
  }
  function tryPhantasm(st, p) {
    if (!st.pile || st.lastPlayer === p || st.pile.combo.size < 2) return null;
    var pl = st.players[p];
    var pc = pl.hand.filter(function (c) { var ef = E.effectOf(c); return ef && ef.impl && ef.kind === 'phantasm' && E.canAfford(pl, c); })[0];
    if (!pc) return null;
    var pp = E.effectFor ? (E.effectFor(st, p, pc).phantasmPlus || 0) : 0;                    // Odysseus: +value on the illusion
    var base = st.pile.combo.cards, i, h, ri;
    var plain = [];
    for (i = 0; i < base.length; i++) plain.push({ rank: base[i].rank, suit: base[i].suit });
    var bare = phantasmValue(st, p, plain, pp);                                               // free: no card spent
    if (bare && E.beats(bare, st.pile.combo)) return { cardId: pc.id };
    if (pl.hand.length - 2 < 1 && (pl.deck.length + pl.shuffle.length) === 0) return null;    // a swap needs a card to spare
    for (ri = 0; ri < base.length; ri++) {
      for (h = 0; h < pl.hand.length; h++) {
        var add = pl.hand[h];
        if (add.id === pc.id) continue;
        var phantom = [];
        for (i = 0; i < base.length; i++) if (i !== ri) phantom.push({ rank: base[i].rank, suit: base[i].suit });
        var cand = phantasmValue(st, p, phantom.concat([{ rank: add.rank, suit: add.suit }]), pp);
        if (cand && E.beats(cand, st.pile.combo)) return { cardId: pc.id, removeIdx: ri, addId: add.id };
      }
    }
    return null;
  }

  // Would a +boost let some play in hand beat the current pile that an unboosted one can't?
  // (Only meaningful when following.) `excludeId` = a card that will be spent to grant the boost.
  function boostEnablesWin(st, p, boost, excludeId) {
    var pl = st.players[p], cur = st.pile ? st.pile.combo : null;
    if (!cur || !boost) return false;
    return E.enumerateCombos(pl.hand).some(function (x) {
      if (excludeId && x.cards.some(function (c) { return c.id === excludeId; })) return false;
      if (st.round < 2 && x.combo.size > 1) return false;
      var base = E.applyEquip(x.combo, p, st);
      var up = { type: base.type, size: base.size, value: base.value + boost, key: base.key.slice(), cards: base.cards }; up.key[0] += boost;
      return !E.beats(base, cur) && E.beats(up, cur);
    });
  }

  // Pre-fight value boost (Imbue/Infuse/Divine Tactic): pick the SMALLEST affordable non-quick
  // boost that turns a losing follow into an overtake — so the +6 gets used when +2 isn't enough.
  function pickValueBoost(st, p) {
    var pl = st.players[p], best = null;
    pl.hand.forEach(function (c) {
      var ef = E.effectOf(c);
      if (!ef || !ef.impl || ef.quick || ef.kind !== 'valueBoost' || !E.canAfford(pl, c)) return;
      var b = ef.boost || 0;
      if (boostEnablesWin(st, p, b, c.id) && (!best || b < best.boost)) best = { id: c.id, boost: b };
    });
    return best;
  }

  // REWORK: choose a J/Q/K to transform into the Forms & Rides Zone (or null). Priorities:
  //   1) complete Super Mode when one tier away (always worth it),
  //   2) otherwise build up a fresh tier when it's safe (not desperate) and there's an energy buffer.
  // AI decks are suit-based, so any transform card it holds empowers cards it actually plays.
  var transformPolicy = null;                          // analysis hook: (st,p)=>bool — may this player transform?
  function setTransformPolicy(fn) { transformPolicy = fn; }
  var effectPolicy = null;                             // analysis hook: (st,p)=>bool — may this player use effects AT ALL (proactive + reactive)?
  function setEffectPolicy(fn) { effectPolicy = fn; }
  function effectsAllowed(st, p) { return !effectPolicy || effectPolicy(st, p); }
  var kindBlock = null;                                // analysis hook: (kind,p)=>bool — block one effect KIND for player p (marginal-value test)
  function setKindBlock(fn) { kindBlock = fn; }
  function kindOK(kind, p) { return !kindBlock || !kindBlock(kind, p); }

  // ---- N-PLAYER TARGETING (Phase 2): which living rival a "choose a rival" effect hits, by difficulty tier ----
  function livingOpponents(st, p) { var a = []; for (var i = 0; i < st.numPlayers; i++) if (i !== p && !st.players[i].eliminated) a.push(i); return a; }
  function anyOpp(st, p, pred) { for (var i = 0; i < st.numPlayers; i++) if (i !== p && !st.players[i].eliminated && pred(st.players[i], i)) return true; return false; }
  function extremeBy(st, cands, cmp) { var b = cands[0]; for (var i = 1; i < cands.length; i++) if (cmp(st.players[cands[i]], st.players[b])) b = cands[i]; return b; }
  function lowestShields(st, cands) { return extremeBy(st, cands, function (a, b) { return a.shields < b.shields; }); }
  function mostShields(st, cands) { return extremeBy(st, cands, function (a, b) { return a.shields > b.shields; }); }
  function grudgeTarget(st, p, cands) { var g = st.players[p].lastAttacker; return (g != null && cands.indexOf(g) >= 0) ? g : -1; }
  function pickRandom(cands) { return cands[Math.floor(Math.random() * cands.length)]; }
  /* PERSONA STYLES. A persona flavours WHO a seat hits — never HOW WELL it plays, which stays the tier's
   * job. Installed from the UI at game start via AI.setStyles({seat:style}); with none set every seat falls
   * through to its tier's default disposition below, so nothing changes for callers that never set one.
   *   grudge 0..1   chance of answering whoever last struck us
   *   focus         'weakest' | 'leader' | 'random' — who we hit while holding no grudge
   *   holds         once a grudge lands, stay locked on that seat until it is out (unforgiving)
   * There is deliberately no "nice" knob. Axelrod's nice strategies never defect first, but a round win here
   * FORCES you to strike someone, so refusing to open hostilities is unrepresentable. The faithful analogue is
   * TIT FOR TAT: grudge 1.0 with no `holds` — answers every strike, carries nothing forward. Flonne, Galahad
   * and Adell are exactly that.
   * KILL-SECURING RUNS FIRST and is tier-gated, so a persona can never make a Demon Lord play below its
   * tier. That is what keeps difficulty meaningful — verify with `node mpsim.js` after touching this. */
  /* AI PERSONAS. A persona is a NAME plus a play STYLE, drawn at random from its difficulty tier at game
   * start and revealed before the fight. Six per tier so a 6-player table (you + 5 AI) never repeats and the
   * cast still cycles between games.
   *
   * The hard rule: personas vary STYLE, NOT STRENGTH. If Etna beat Laharl consistently, picking a persona
   * would be a hidden difficulty slider and the tier would stop meaning anything. Same-tier personas must sit
   * within a few points of each other in `node mpsim.js` — measurable, so it can be enforced rather than hoped.
   *
   * `style` is Axelrod's language, because a free-for-all IS an iterated reciprocity game and the engine
   * already records `lastAttacker` as a grudge signal:
   *   grudge  0..1   how reliably it retaliates against whoever last struck it
   *   focus   'weakest' | 'leader' | 'random'   who it hits when it holds no grudge
   *   nice    true    never opens hostilities — only ever retaliates (Axelrod's "never defect first")
   *   holds   true    once it has a grudge it stays locked on until that seat is out (unforgiving)
   * Axelrod's fourth property — CLEAR — is the design constraint: a style you cannot read is just a dice roll,
   * so these are deliberately few and blunt. */
  var PERSONAS = [
    { name:'Stuart',   tier:'minion',  grudge:0.10, focus:'random'  },
    { name:'Bob',      tier:'minion',  grudge:0.35, focus:'random'  },
    { name:'Kevin',    tier:'minion',  grudge:0.20, focus:'weakest' },
    { name:'Dave',     tier:'minion',  grudge:0.05, focus:'random'  },
    { name:'Phil',     tier:'minion',  grudge:0.30, focus:'leader'  },
    { name:'Tim',      tier:'minion',  grudge:0.15, focus:'random'  },
    { name:'Carl',     tier:'minion',  grudge:0.25, focus:'weakest' },
    { name:'Jorge',    tier:'minion',  grudge:0.12, focus:'random'  },

    { name:'Griflet',   tier:'recruit', grudge:0.25, focus:'weakest' },
    { name:'Beaumains', tier:'recruit', grudge:0.40, focus:'random'  },
    { name:'Owain',     tier:'recruit', grudge:0.20, focus:'leader'  },
    { name:'Lucan',     tier:'recruit', grudge:0.35, focus:'weakest' },
    { name:'Sagramore', tier:'recruit', grudge:0.15, focus:'random'  },
    { name:'Dinadan',   tier:'recruit', grudge:0.30, focus:'leader'  },

    { name:'Lefty',    tier:'fighter', grudge:0.50, focus:'weakest' },
    { name:'Bruiser',  tier:'fighter', grudge:0.80, focus:'weakest', holds:true },
    { name:'Slugger',  tier:'fighter', grudge:0.30, focus:'leader'  },
    { name:'Tank',     tier:'fighter', grudge:0.60, focus:'leader'  },
    { name:'Duke',     tier:'fighter', grudge:0.40, focus:'random'  },
    { name:'Knuckles', tier:'fighter', grudge:0.70, focus:'weakest' },

    { name:'Lancelot', tier:'knight',  grudge:0.60, focus:'weakest' },
    { name:'Galahad',  tier:'knight',  grudge:1.00, focus:'weakest' },            // pure TIT FOR TAT: answers all, forgives all
    { name:'Gawain',   tier:'knight',  grudge:1.00, focus:'leader',  holds:true },
    { name:'Percival', tier:'knight',  grudge:0.50, focus:'leader'  },
    { name:'Bedivere', tier:'knight',  grudge:0.70, focus:'weakest' },
    { name:'Bors',     tier:'knight',  grudge:0.85, focus:'leader',  holds:true },

    // Disgaea cast. Styles read off the characters — correct any reading that is off, Aj knows the games better:
    { name:'Etna',     tier:'demon',   grudge:0.95, focus:'weakest', holds:true },   // vindictive, preys on the weak, never lets it go
    { name:'Laharl',   tier:'demon',   grudge:0.75, focus:'leader'  },               // beating whoever is on top IS the ambition
    { name:'Flonne',   tier:'demon',   grudge:1.00, focus:'weakest' },              // love and justice as TIT FOR TAT: answers every strike, forgives instantly
    { name:'Rozalin',  tier:'demon',   grudge:0.55, focus:'leader'  },               // haughty noble, aims high, above petty grudges
    { name:'Adell',    tier:'demon',   grudge:0.40, focus:'leader'  },              // honourable brawler: slow to anger, never holds a grudge
    { name:'Vyers',    tier:'demon',   grudge:1.00, focus:'random',  holds:true }    // Mid-Boss: fixated on whoever slighted him, forever, theatrically
  ];
  function personasFor(tier){ return PERSONAS.filter(function(x){ return x.tier===tier; }); }
  // Draw one persona per AI seat, no repeats at the table (6 per tier covers you + 5 AI).
  function drawPersonas(diffs){
    var used={}, out=[];
    for(var i=0;i<diffs.length;i++){
      if(!diffs[i]){ out.push(null); continue; }
      var pool=personasFor(diffs[i]).filter(function(x){ return !used[x.name]; });
      if(!pool.length) pool=personasFor(diffs[i]);
      var pick=pool[Math.floor(Math.random()*pool.length)] || null;
      if(pick) used[pick.name]=1;
      out.push(pick);
    }
    return out;
  }
  var FOCUS_LEAN = 0.60;          // 'focus' is a LEAN, not a law — see the note in styleTarget
  var FINISH_AT = 2;              // shields at or below which any persona takes the finish instead of its focus
  var seatStyles = {};
  function setStyles(m) { seatStyles = m || {}; }
  function styleOf(p) { return (seatStyles && seatStyles[p]) ? seatStyles[p] : null; }
  function aggressors(st) { var a = {}, i, la; for (i = 0; i < st.numPlayers; i++) { la = st.players[i].lastAttacker; if (la != null) a[la] = 1; } return a; }
  function styleTarget(st, p, cands, sty) {
    var pl = st.players[p], i;
    if (sty.holds && pl._vendetta != null && cands.indexOf(pl._vendetta) >= 0) return pl._vendetta;   // still locked on
    var grud = grudgeTarget(st, p, cands);
    if (grud >= 0 && Math.random() < (sty.grudge == null ? 0.5 : sty.grudge)) { if (sty.holds) pl._vendetta = grud; return grud; }
    // Punishing whoever is actually throwing punches is COMPETENCE, not personality, so EVERY persona does it.
    // It used to be bundled into `nice`, which measured at +6 points (personasim/_knob replicates) — i.e. the
    // "nice" personas were simply playing better, and the tier stopped meaning anything. Shared, it cancels.
    var agg = aggressors(st), guilty = [];
    for (i = 0; i < cands.length; i++) if (agg[cands[i]]) guilty.push(cands[i]);
    if (guilty.length) cands = guilty;
    if (sty.focus === 'weakest') return lowestShields(st, cands);
    // Nobody above Minion ignores a nearly-dead player. Without this, 'leader'/'random' focus cost real win
    // rate against 'weakest' (personasim: a 10-point spread) — piling on the weak banks kills and shrinks the
    // field, so a persona that always aimed high was quietly the easy setting. Finishing is competence, not
    // style; the style is only where it looks WHEN nothing is nearly dead.
    var soft = lowestShields(st, cands);
    if (st.players[soft].shields <= FINISH_AT) return soft;
    if (Math.random() >= FOCUS_LEAN) return soft;   // even a high-aiming rider takes the soft target sometimes
    if (sty.focus === 'leader') return mostShields(st, cands);
    return pickRandom(cands);
  }
  // Tier model: minion < fighter < KNIGHT < DEMON. 'knight' inherits the old top-tier ("demon") behavior;
  // 'demon' is now the NEW smartest tier — everything knight does PLUS the top-tier extras (isTop). The
  // internal 'demonpass' A/B alias maps to knight (the behavior it originally tested).
  function isSmart(diff) { return diff === 'knight' || diff === 'demon' || diff === 'demonpass'; }
  function isTop(diff) { return diff === 'demon'; }
  // diff = minion | fighter | knight | demon. Returns a living-opponent index, or -1 if none.
  function chooseTarget(st, p, diff) {
    var cands = livingOpponents(st, p);
    if (cands.length <= 1) return cands.length ? cands[0] : -1;
    var sty = styleOf(p);
    if (sty) {                                                      // persona: tier keeps the kill, style picks the rest
      var kill = lowestShields(st, cands);
      if (diff !== 'minion' && st.players[kill].shields <= 1) return kill;   // Minions still fail to notice a kill
      return styleTarget(st, p, cands, sty);
    }
    var grud = grudgeTarget(st, p, cands);
    if (diff === 'minion') {                                        // 80% random · 20% grudge
      if (grud >= 0 && Math.random() < 0.20) return grud;
      return pickRandom(cands);
    }
    if (isSmart(diff)) {                                            // knight/demon: finisher > grudge > random
      var low = lowestShields(st, cands);
      if (st.players[low].shields < st.players[mostShields(st, cands)].shields) return low;   // a clear weakest → finish it
      if (grud >= 0) return grud;
      return pickRandom(cands);
    }
    // fighter (default): secure kills > one grudge/game > pressure the leader
    var weak = lowestShields(st, cands);
    if (st.players[weak].shields <= 1) return weak;                 // kill-secure
    if (grud >= 0 && !st.players[p]._grudgeUsed) { st.players[p]._grudgeUsed = true; return grud; }   // one grudge play per game
    return mostShields(st, cands);                                  // leader-focus
  }
  var HOSTILE_TARGETED = { discardOpp: 1, destroyShield: 1, energyDenyOpp: 1, lockout: 1 };   // singular effects that pick a rival
  // Install the round-win 'chosen'-mode shield-target chooser: uses the winner's own difficulty tier.
  if (E.setShieldTargetChooser) E.setShieldTargetChooser(function (st, winner, cands) {
    var diff = (st._diff && st._diff[winner]) || 'fighter';
    var t = chooseTarget(st, winner, diff);
    return (t >= 0 && cands.indexOf(t) >= 0) ? t : cands[0];
  });
  function pickTransform(st, p) {
    if (transformPolicy && !transformPolicy(st, p)) return null;
    var pl = st.players[p]; if (!pl.forms) pl.forms = [];
    var have = {}; pl.forms.forEach(function (f) { have[f.tier] = true; });
    // candidate = a FRESH tier that is both affordable AND gate-unlocked
    var cands = [];
    pl.hand.forEach(function (c) {
      var ef = E.effectOf(c);
      if (!ef || ef.kind !== 'transform' || have[ef.tier]) return;
      if (!E.canAfford(pl, c)) return;
      if (E.transformGateOK && !E.transformGateOK(st, p, ef.tier)) return;
      cands.push({ c: c, tier: ef.tier });
    });
    if (!cands.length) return null;
    var free = E.effectiveCost ? E.effectiveCost(st, p, cands[0].c) === 0 : false;   // shield-gate modes cost no energy
    if (free) return cands[0].c;                                                       // free transform is near-pure upside — take it when unlocked
    var distinct = (have.ride ? 1 : 0) + (have.queen ? 1 : 0) + (have.king ? 1 : 0);
    if (distinct === 2) return cands[0].c;                                             // one tier from Super — always finish
    if (distinct === 1 && pl.shields >= 2) return cands[0].c;                          // committed — keep pushing
    if (distinct === 0 && (pl.shields >= 3 || st.round <= 6)) return cands[0].c;       // start when comfortable
    return null;
  }

  // Offensive Quick boost (Brilliant Tactic): when we'd otherwise pass, find the cheapest play
  // that beats the pile ONLY with the +boost, and spring it to overtake. Returns {cards, boostId} or null.

  // Pick `need` STOPPER card ids from p's hand that p can fully afford together (each pays its
  // full cost), or null. Dry-runs the payments on a copy of the energy pile.
  function pickStoppers(st, p, need) {
    var pl = st.players[p];
    var stoppers = pl.hand.filter(function (c) { var ef = E.effectOf(c); return ef && ef.kind === 'stopper'; });
    if (stoppers.length < need) return null;
    var probe = { energy: pl.energy.slice(), shuffle: [] }, chosen = [];
    for (var i = 0; i < stoppers.length && chosen.length < need; i++) {
      if (E.canAfford(probe, stoppers[i])) { E.payEnergy(probe, stoppers[i]); chosen.push(stoppers[i].id); }
    }
    return chosen.length === need ? chosen : null;
  }

  function rankCounts(hand) { var m = {}; hand.forEach(function (c) { m[c.rank] = (m[c.rank] || 0) + 1; }); return m; }

  // Demon-Lord "strategic pass": concede a winnable JAB to conserve hand for Specials when running
  // low. A/B tested (mirror Demon duels, 3600 games/threshold) — hand<=5 wins ~59% vs always-contest,
  // independently reproduced in 2026-08 by `passsim.js` at +17.3 points. 1v1 only — see the note below for
  // what that gate really buys, which is not what the old comment claimed.
  /* STUDIED AND SETTLED (2026-08-23, `passsim.js`): the 1v1 gate STAYS, but the reason above was wrong.
   * "Conceding hands the trick to several opponents" implies harm. There is no harm — in a free-for-all the
   * strategic pass is simply INERT. Measured as a within-game A/B (same table, half the seats allowed to pass,
   * seats rotated, one deck and one tier for everyone), win-rate delta to the passing arm:
   *     demon DUEL          +17.3 pts   REAL — and it reproduces the original "~59% vs always-contest"
   *     knight duel          +1.5 pts   noise (so the duel edge is a DEMON edge, not a smart-tier edge)
   *     6p, thresholds 5-10  +0.6 / -1.7 / +1.7 / -0.9 / -2.2   all noise, even firing 8x per game
   *     4p / 3p, 3200 games  -0.1 / +0.9                        noise
   * Why: conserving a card is a TWO-BODY attrition edge. Against five opponents the marginal card stops
   * mattering, so the policy fires and changes nothing. Raising the threshold only makes it fire more often
   * for the same zero.
   * A second policy was tried — Aj's own reasoning from play: concede a jab because you HOLD a Special you
   * mean to lead (`setStratPassMode('combo')`), which has nothing to do with hand size. It is the only variant
   * with a consistent positive sign, +0.9 at both 3p and 4p over 3200 games — still inside noise. A promising
   * low-power reading of +4.0 regressed to +0.9 at 6x the games, which is what noise does.
   * The knobs below stay because `passsim.js` needs them, and because it also reports INITIATIVE
   * CONCENTRATION — the busiest leader holds 1.6-1.9x its fair share of rounds — which is the open question
   * this study actually turned up. See NEXT-SESSION.md. */
  /* How few rivals must remain for a SINGLE-target lockout to be worth 10 energy? Silencing one of five leaves
   * four who can still take the round; silencing one of two leaves one.
   * SWEPT (2026-08-25, thresholds 2/3/4/6 x 6 runs): NO value is distinguishable from another. 6-player spread
   * came out 12.9 / 15.4 / 13.9 / 16.9 with standard errors of 0.6-0.9, and the same config measured twice gave
   * 12.5 and 15.4 — so the metric cannot rank thresholds at this power. What the sweep DOES show is that
   * `hasCombo` alone is not enough: threshold 6 (i.e. no effective count limit) lands where the ungated version
   * did. So the count condition is kept, and 3 is retained as a conservative UNTUNED default. Do not read
   * meaning into the exact number. */
  /* ---- Back Stab: the timing model -----------------------------------------------------------------
   * Base Back Stab now skips the target's WHOLE round (v1.31.4), not a single turn, so it is worth much
   * more than the old turn-skip and the crude "do I hold a combo" gate can go. This models Aj's own
   * heuristic verbatim:
   *   "if they played a high last turn, back stab looks bad because they wouldn't be able to play higher
   *    than me anyway. but if it feels like they're building a high special on hand, back stab starts
   *    looking promising, because they wouldn't be able to retaliate my low cards. i'd back stab them,
   *    then play my mid special or pair of Js."
   * So the question is never "who do I hate" — that is targeting's job — it is "is the play I want to make
   * under threat from THIS rival". Two information sources, best first:
   *   1. a fresh READ from Pandora's Outbalance (pl._read): we have actually seen their hand this round;
   *   2. what we watched them play (st._seen): public, partial, and it expires every round.
   * Tiers are Aj's: low 3-6, mid 7-10, high 11+ (J, Q, K, A and the apex 2). */
  var TIER_MID = 7, TIER_HIGH = 11;
  function tierOf(v) { return v >= TIER_HIGH ? 'high' : (v >= TIER_MID ? 'mid' : 'low'); }
  /* Watch the table. The pile is public, so remembering who put down what gives the AI no information a
   * player at the table would not have — and like a player it only notices the plays it is present for. */
  function observe(st) {
    if (!st.pile || st.pile.byPlayer == null || !st.pile.combo) return;
    var m = st._seen || (st._seen = {}), s = st.pile.byPlayer, e = m[s];
    if (!e || e.round !== st.round) e = m[s] = { round: st.round, hi: 0, n: 0 };
    if (st.pile.combo.value > e.hi) e.hi = st.pile.combo.value;
    e.n++;
  }
  /* The special we would actually THROW, which is the CHEAPEST legal one — not the best one we hold. That
   * distinction is the whole model: if our best special were a pair of Kings we would just play it and never
   * want a Back Stab. Aj's line is "i'd back stab them, then play my mid special or pair of Js" — the play
   * under threat is the modest one. */
  function plannedSpecialValue(st, p) {
    var opts = E.legalFightPlays(st, p), lo = 0;        // NOTE: each entry is {cards, combo} — the value is on .combo
    for (var i = 0; i < opts.length; i++) { var cb = opts[i].combo; if (cb && cb.size > 1 && (lo === 0 || cb.value < lo)) lo = cb.value; }
    return lo;
  }
  /* Which branch fired, tallied for the sims the same way stratPassCount() is — the model is only worth
   * having if its interesting branches actually come up in real games. */
  var lockStats = {};
  function lockoutStats() { return lockStats; }
  function resetLockoutStats() { lockStats = {}; }
  /* Worth silencing `t`? Returns the REASON (handy in a log or a test) or '' for "hold the card". */
  var LOCK_CAST = { duel: 1, 'read-threat': 1, 'plan-vulnerable': 1, 'crowd-thin': 1 };   // anything else is a HOLD
  function lockoutWorth(st, p, t) {
    var why = lockoutReason(st, p, t);
    lockStats[why] = (lockStats[why] || 0) + 1;    // holds are tallied BY NAME: "why didn't it fire" is the useful question
    return LOCK_CAST[why] ? why : '';
  }
  function lockoutReason(st, p, t) {
    if (st.numPlayers === 2) return 'duel';                          // one rival: a skipped round is a free round
    var plan = plannedSpecialValue(st, p), read = st.players[p]._read && st.players[p]._read[t];
    if (read && read.round === st.round) {                           // we have SEEN the hand: no guessing needed
      return (read.pairs >= 1 && read.best > plan) ? 'read-threat' : 'read-harmless';   // can't answer us -> keep the energy
    }
    if (!plan) return 'no-special';                                  // nothing to protect yet
    if (st.players[t].hand.length < 3) return 'thin-hand';           // too few cards left to assemble an answer
    var seen = st._seen && st._seen[t];
    if (seen && seen.round === st.round && tierOf(seen.hi) === 'high') return 'highs-spent';   // their highs are already spent
    if (tierOf(plan) !== 'high') return 'plan-vulnerable';           // a low/mid special is answerable: lock them
    return (E.aliveCount(st) <= LOCKOUT_MAX_ALIVE) ? 'crowd-thin' : 'crowded';   // a high special mostly defends itself
  }

  var LOCKOUT_MAX_ALIVE = 3;
  function setLockoutMaxAlive(n) { LOCKOUT_MAX_ALIVE = n | 0; }
  var STRAT_PASS_MAX = 5;                      // pass a winnable jab when hand length <= this
  var STRAT_PASS_MP = false;                   // allow it in 3+ player games at all
  var STRAT_PASS_SEATS = null;                 // study hook: only these seats may (null = every seat)
  function setStratPassMP(v) { STRAT_PASS_MP = !!v; }
  function setStratPassSeats(m) { STRAT_PASS_SEATS = m || null; }
  /* Study instrumentation: how OFTEN does the pass actually fire? A policy that never triggers measures as
   * "neutral", which is indistinguishable from "harmless" unless you count the firings. */
  /* Two DIFFERENT pass policies, and conflating them is the trap:
   *   'hand'  — the shipped one: concede a jab when the HAND IS LOW, to conserve cards. A duel edge
   *             (+17 pts for demon, measured), and inert in a free-for-all.
   *   'combo' — Aj's, from actual play: concede a jab because you HOLD A SPECIAL you intend to lead, and
   *             answering costs you the pieces. Nothing to do with hand size, and never tested. */
  var STRAT_PASS_MODE = 'hand';
  function setStratPassMode(m) { STRAT_PASS_MODE = (m === 'combo') ? 'combo' : 'hand'; }
  function wantsStratPass(st, p) {
    var pl = st.players[p];
    if (STRAT_PASS_MODE === 'combo') return hasCombo(pl.hand);   // holding a Special: don't spend into a jab
    return pl.hand.length <= STRAT_PASS_MAX;
  }
  var stratPasses = 0;
  function stratPassCount() { return stratPasses; }
  function resetStratPassCount() { stratPasses = 0; }
  function mayStratPass(st, p) {
    // The study override is checked FIRST and at every player count. It used to sit last, after an early
    // `numPlayers === 2 -> true`, which let BOTH seats of a duel pass and made passsim's 2-player arm a
    // comparison of a policy against itself — a vacuous 50/50.
    if (STRAT_PASS_SEATS) return !!STRAT_PASS_SEATS[p];
    if (st.numPlayers === 2) return true;                                   // shipped behaviour: duels only
    return STRAT_PASS_MP;
  }

  function chooseMove(st, p, diff) {
    var strategicPass = isSmart(diff); var top = isTop(diff); if (diff === 'demonpass') diff = 'knight';
    var options = E.legalFightPlays(st, p);
    var leading = !st.pile;
    if (options.length === 0) return leading ? { action: 'stuck' } : { action: 'pass' };

    // "keep score": how much we DON'T want to throw this card away as fodder. Dump the lowest.
    var counts = rankCounts(st.players[p].hand);
    var canStopper = !!pickStoppers(st, p, 1);       // could we actually commit a STOPPER right now?
    var shields = st.players[p].shields;
    function keepValue(card) {
      var v = card.rank;                                         // high cards win fights / anchor combos
      if (top && (card.rank === 1 || card.rank === 2)) v += 8;   // TOP tier: hoard the apex 2 / Ace — don't fodder your trumps into jab rounds
      if (counts[card.rank] >= 2) v += 10 + card.rank;           // part of a Special — prize it (more when higher)
      var ef = E.effectOf(card);
      if (ef) {
        if (ef.kind === 'stopper') {                 // a STOPPER is a scarce interrupt — hold it even
          v += 9;                                    //   before you can afford it (energy accrues as you fight),
          if (canStopper) v += 4;                    //   a bit more once it's actually usable,
          if (shields <= 2) v += 6;                  //   and hard when you're in danger.
        } else if (ef.quick) v += 6;                 // hold a Quick (Counter/Anoint/Brilliant Tactic)
      }
      return v;
    }
    function keepOf(x) { return keepValue(x.cards[0]); }

    var combos = options.filter(function (x) { return x.combo.size > 1; });
    var singles = options.filter(function (x) { return x.combo.size === 1; });
    singles.sort(function (a, b) { return keepOf(a) - keepOf(b); });                // most expendable first

    if (leading) {
      if (diff !== 'minion' && st.round >= 2 && combos.length) {                    // fighter/demon: lead the strongest special
        combos.sort(function (a, b) {
          if (b.combo.size !== a.combo.size) return b.combo.size - a.combo.size;    // bigger special first
          return b.combo.value - a.combo.value;                                     // then stronger
        });
        return { action: 'play', cards: combos[0].cards };
      }
      return { action: 'play', cards: (singles[0] || options[0]).cards };           // dump the most expendable jab (junk, not a STOPPER/combo card)
    }

    // following
    if (st.pile.combo.size === 1) {
      // a jab pile — only higher singles beat it. Win with plain fodder; never spend a card that's
      // worth holding (part of a pair/trio, a STOPPER, or a Quick) just to win a jab. Else pass.
      var safe = singles.filter(function (x) {
        var c = x.cards[0];
        if (counts[c.rank] >= 2) return false;                              // don't break a Special
        var ef = E.effectOf(c);
        if (ef && (ef.kind === 'stopper' || ef.quick)) return false;        // don't burn a STOPPER/Quick on a jab
        return true;
      });
      if (safe.length) {
        // strategic pass (Demon only, 1v1): conserve hand for Specials by conceding a jab when low
        if (strategicPass && mayStratPass(st, p) && wantsStratPass(st, p)) { stratPasses++; return { action: 'pass' }; }
        safe.sort(function (a, b) { return a.combo.value - b.combo.value; }); return { action: 'play', cards: safe[0].cards };
      }
      return { action: 'pass' };
    }
    // a Special pile — only a bigger Special beats it
    if (diff === 'minion') return { action: 'pass' };                              // minion won't contest specials (recruit does — it's the basics-competent tier)
    options.sort(function (a, b) {
      if (a.combo.value !== b.combo.value) return a.combo.value - b.combo.value;    // cheapest beating combo
      return a.cards.length - b.cards.length;
    });
    return { action: 'play', cards: options[0].cards };
  }

  // ---- PLAY phase: decide which effects to activate this turn (kind-driven, so it
  // works no matter which card carries which effect). Priorities: finish (destroy an
  // almost-dead Rival's shield) > survive (gain shields) > power up (equip) > ramp > draw.
  // If an activation opens a response window for a HUMAN opponent, the phase suspends
  // (leaves st.pending set) so the UI can prompt them; the turn resumes on re-entry.
  function playPhase(st, p, log, diff, humans) {
    var pl = st.players[p], guard = 0;
    if (!effectsAllowed(st, p)) return;                // analysis: pure-fighter (no proactive effects/transforms)
    // lowest-cost affordable card whose effect matches `pred`. When `avoidCombo` is set, skip a
    // card that is holding a pair/trio together — so a LOW-value effect won't cannibalise a Special.
    function pick(pred, avoidCombo) {
      var cnt = rankCounts(pl.hand), best = null, bestEff = null;
      pl.hand.forEach(function (c) {
        var ef = E.effectOf(c);
        if (!ef || !ef.impl || !E.canAfford(pl, c) || !pred(ef)) return;   // quicks are proactively castable now; picked by kind below (Counter/Annoint have no proactive pick, so stay held)
        if (avoidCombo && cnt[c.rank] >= 2) return;                        // don't break a Special for this effect
        if (!best || ef.cost < bestEff.cost) { best = c; bestEff = ef; }
      });
      return best;
    }
    // REWORK: does the hand hold a Broadway card (10/J/Q/K/A) to pay a pitch cost, other than exclId?
    function broadwayPitchAvail(exclId) { return pl.hand.some(function (c) { return c.id !== exclId && (c.rank === 1 || c.rank === 10 || c.rank === 11 || c.rank === 12 || c.rank === 13); }); }
    if (diff === 'minion') {                                    // barely uses effects — only a desperate shield gain
      while (guard++ < 3) {
        if (st.pending) return;
        if (pl.shields <= 1) { var s0 = pick(function (ef) { return ef.kind === 'shield'; }); var s0e = s0 && E.effectOf(s0); var s0Safe = !(s0e && s0e.shieldAll && st.players.some(function (q, qi) { return qi !== p && q.shields <= 0; })); if (s0 && s0Safe && act(st, p, s0.id, log, 'SHIELD', humans)) continue; }
        break;
      }
      return;
    }
    var demon = isSmart(diff);                                    // knight + demon share the old top-tier thresholds
    var top = isTop(diff);                                        // demon (new top) digs deeper for gas
    var basic = (diff === 'recruit');                             // RECRUIT: a gentle step above Minion — survival + ramp/draw only, none of Fighter's pressure plays
    var sT = demon ? 3 : 2, drawT = (top ? 6 : demon ? 5 : 3), rampCap = (top ? 15 : demon ? 12 : 9);
    var oppIdx = (p + 1) % st.numPlayers;
    while (guard++ < 6) {
      if (st.pending) return;                                                             // a human response window is open — suspend the turn
      if (st.shieldResponse) return;                                                      // a reactive shield-guard window is open (destroyShield) — suspend
      if (st.discardPending) {                                                            // a forced discard was set (discardOpp)
        if (isHuman(humans, st.discardPending.player)) return;                            // human must choose — suspend
        E.resolveDiscard(st);                                                             // AI target auto-pitches (avoids breaking its Specials)
      }
      var e = pl.energy.length, opp = st.players[oppIdx];
      var re = pick(function (ef) { return ef.kind === 'removeEquip'; });
      if (re && !basic && opp.equipment.length > 0 && act(st, p, re.id, log, 'REMOVE', humans)) continue;    // strip the opponent's equipment
      var ds = pick(function (ef) { return ef.kind === 'destroyShield'; });
      var dsEff = ds && E.effectOf(ds);
      // Ultima Attack (pitchHigh) costs a Broadway discard — only cast it when we hold a spare one.
      if (ds && !basic && anyOpp(st, p, function (o) { return o.shields >= 1 && o.shields <= 2; }) && (!dsEff.pitchHigh || broadwayPitchAvail(ds.id)) && act(st, p, ds.id, log, 'DESTROY', humans)) continue;
      var sh = pick(function (ef) { return ef.kind === 'shield'; });
      // Sanctuary (shieldAll) heals everyone — never cast it when it would revive an opponent sitting at 0 (undoes the kill).
      var shEff = sh && E.effectOf(sh);
      var shSafe = !(shEff && shEff.shieldAll && st.players.some(function (q, qi) { return qi !== p && q.shields <= 0; }));
      if (sh && shSafe && pl.shields <= sT && act(st, p, sh.id, log, 'SHIELD', humans)) continue;   // survive
      var sph = pick(function (ef) { return ef.kind === 'shieldImmune'; });
      if (sph && !pl.shieldImmune && pl.shields <= 2 && act(st, p, sph.id, log, 'SPHERE', humans)) continue;   // Sphere: shield up when in danger
      var wd = pick(function (ef) { return ef.kind === 'ward'; });
      if (wd && pl.shields <= 1 && !pl.cantLoseRound && act(st, p, wd.id, log, 'WARD', humans)) continue;       // Leyline (REWORK base): can't-lose when desperate
      var tr = pickTransform(st, p);
      if (tr && !basic && act(st, p, tr.id, log, 'TRANSFORM', humans)) continue;                                // REWORK: transform into the Forms & Rides Zone (Recruit skips the advanced zone game)
      // Back Stab is now a reactive Quick — the AI springs it in the NON-active pre-fight window
      // (see the pre-fight block in takeTurn), not proactively here.
      var fin = pick(function (ef) { return ef.kind === 'onWin'; });
      var finEff = fin && E.effectOf(fin);
      // Armor Piercing (pitchHigh) costs a Broadway discard — only cast it when we hold a spare one.
      if (fin && !basic && !pl.finishingBlow && st.round >= 2 && !st.pile && anyOpp(st, p, function (o) { return o.shields <= 2; }) && hasCombo(pl.hand) && (!finEff.pitchHigh || broadwayPitchAvail(fin.id)) && act(st, p, fin.id, log, 'FINISH', humans)) continue;   // Finishing Blow: press lethal
      /* Back Stab (proactive, non-Quick lockout): deny a rival their next turn — strong tempo. Activate it, then
       * play; they auto-pass and you take the round.
       * This was gated to `st.numPlayers === 2` with the note "1v1 only (auto-targets)" — i.e. disabled in a
       * free-for-all because the code had no way to choose WHICH rival to silence. `act` has resolved targets
       * via chooseTarget for a while now (lockout is in HOSTILE_TARGETED), so the gate was purely historical,
       * and it made the card cast 0 times in 200 six-player games while casting 44 times in 200 duels — one of
       * Rogue's two signature cards, inert in every multiplayer sim we have ever run.
       * In multiplayer it is BETTER than in a duel: you get to pick which of several threats to shut up, which
       * is exactly what the persona targeting styles are for. Guard and cast share one target so they agree. */
      var lo = pick(function (ef) { return ef.kind === 'lockout'; });
      if (lo && !basic) {
        var loT = (st.numPlayers === 2) ? oppIdx : chooseTarget(st, p, (st._diff && st._diff[p]) || 'fighter');
        var loV = (loT != null && loT >= 0) ? st.players[loT] : null;
        /* WHEN is it worth 10 energy? Silencing your ONLY opponent buys a free round. Silencing one of five
         * leaves four who can still contest it — measured: un-gating this naively made every Back-Stab-holding
         * deck slightly WORSE (Bard -2.1, Rogue -1.0) and widened persona spread, because the AI was simply
         * making a bad play more often. The first fix gated on "hold a combo AND few rivals left"; v1.31.4
         * replaces that with the TIMING model above, which asks whether the play we want to make is under
         * threat from THIS rival. Balance-neutral (8 runs/arm, nothing over 3 s.e. across 44 deck
         * comparisons), and it casts LESS often on purpose: 6p 38 -> 16 casts per 200 games.
         * A lockout that hit EVERY rival would not need any of this — see setLockoutAll. */
        var loWorth = loV ? lockoutWorth(st, p, loT) : '';    // see the timing model above
        if (loV && loWorth && !loV.eliminated && !loV.lockSkip && !loV.lockRound && loV.hand.length >= 2 &&
            act(st, p, lo.id, log, 'LOCKOUT', humans, loT)) continue;
      }
      var eq = pick(function (ef) { return ef.kind === 'equip'; });
      if (eq && !basic && pl.equipment.length === 0) {
        var eqEff = E.effectOf(eq);
        // An own-highest buff (Holy Bow / Hero's Sword / Javelin) only matters on a fight you actually take —
        // don't burn it (and its per-round counter) right before passing to a Special you can't beat. Debuff
        // sticks (oppDelta) and absorbers (Holy Shroud) are defensive setup and stay playable anytime.
        var ownBuff = eqEff && eqEff.delta > 0 && !eqEff.oppDelta;
        var willFight = !st.pile || E.legalFightPlays(st, p).length > 0;                 // leading, or we hold a legal contest
        if ((!ownBuff || willFight) && act(st, p, eq.id, log, 'EQUIP', humans)) continue;    // power up
      }
      var rm = pick(function (ef) { return ef.kind === 'ramp'; }, true);
      if (rm && e < rampCap && act(st, p, rm.id, log, 'RAMP', humans)) continue;                   // ramp (not by breaking a Special)
      var dw = pick(function (ef) { return ef.kind === 'draw'; }, true);
      if (dw && pl.hand.length <= drawT && act(st, p, dw.id, log, 'DRAW', humans)) continue;       // dig for cards (not by breaking a Special)
      if (!basic && !pl.nextPlayBoost) { var vbp = pickValueBoost(st, p); if (vbp && act(st, p, vbp.id, log, 'BOOST', humans)) continue; }   // smallest boost that converts a losing follow into an overtake
      /* NOT `avoidCombo` — that rule ("don't break a Special for this effect") vetoed Counterfeit whenever the
       * hand held a second 8, which at six players suppressed it on 81% of the turns where it would actually
       * have won the fight. It is the wrong rule for the one card whose job is to MAKE a Special, and
       * counterfeitHelps has already proved the resulting play beats the pile without the spent card. */
      var cf = pick(function (ef) { return ef.kind === 'counterfeit'; });
      if (cf && !basic && st.pile && st.pile.byPlayer !== p && st.round >= 2 && counterfeitHelps(st, p, st.pile.combo.cards, cf) && act(st, p, cf.id, log, 'COPY', humans)) continue;   // copy a card from the Rival's play to complete a winning Special
      var dis = pick(function (ef) { return ef.kind === 'discardOpp'; }, true);
      if (dis && !basic && anyOpp(st, p, function (o) { return o.hand.length >= 5; }) && act(st, p, dis.id, log, 'DISCARD', humans)) continue;     // strip a Rival's hand
      var den = pick(function (ef) { return ef.kind === 'energyDenyOpp'; }, true);
      if (den && !basic && anyOpp(st, p, function (o) { return o.energy.length >= 6; }) && act(st, p, den.id, log, 'DENY', humans)) continue;      // deny a Rival's energy
      var rec = pick(function (ef) { return ef.kind === 'recycle'; }, true);                        // Poison the Air: nuke a big enemy energy lead (net gain when they've banked much more)
      if (rec && !basic && anyOpp(st, p, function (o) { return o.energy.length >= 5 && (o.energy.length - pl.energy.length) >= 3; }) && act(st, p, rec.id, log, 'RECYCLE', humans)) continue;
      var rcl = pick(function (ef) { return ef.kind === 'reclaim'; }, true);
      if (rcl && pl.shuffle.length >= 6 && act(st, p, rcl.id, log, 'RECLAIM', humans)) continue;   // refuel from the Shuffle Pile
      var sp = pl.equipment.filter(function (x) { return x.ability === 'draw' && !x.usedThisRound && x.counters > 0; })[0];
      if (sp && pl.hand.length <= drawT) { var rr = E.useEquipment(st, p, sp.id); if (rr.ok) { if (log) log.push({ useEquip: sp.id, name: rr.name }); continue; } }  // spend a Seed Pouch counter
      break;
    }
  }
  // Returns true if the effect resolved (or opened a response window); false if the
  // engine refused it (e.g. the lead-lock guard) so the AI simply moves on. When an
  // activation opens a window for an AI opponent, that opponent's response is resolved
  // right here; when it opens one for a HUMAN, st.pending is left set for the UI.
  /* `tgt` (optional): a target the CALLER already chose. Without it act picks its own via chooseTarget — which
   * uses randomness, so a caller that guards on "is my target worth hitting?" and then lets act re-roll can
   * check one rival and hit another. Back Stab needs the guard and the cast to agree. */
  function act(st, p, id, log, tag, humans, tgt) {
    var c = st.players[p].hand.filter(function (x) { return x.id === id; })[0];
    if (kindBlock && c) { var ke = E.effectOf(c); if (ke && !kindOK(ke.kind, p)) return false; }   // analysis: skip a blocked effect KIND
    var card = c ? { rank: c.rank, suit: c.suit, id: c.id } : null;   // capture before the card leaves the hand
    var opts = {};                                                    // N-player: pick which rival a singular hostile effect hits
    var eff0 = c && E.effectOf(c);
    if (eff0 && st.numPlayers > 2 && (HOSTILE_TARGETED[eff0.kind] || (eff0.kind === 'recycle' && eff0.scope === 'opp'))) {
      var t = (tgt != null && tgt >= 0) ? tgt : chooseTarget(st, p, (st._diff && st._diff[p]) || 'fighter');
      if (t >= 0) opts.target = t;
    }
    var r = E.activate(st, p, id, opts);
    if (!r.ok) return false;
    if (log) log.push({ play: tag, card: card });
    if (r.pending) {
      if (isHuman(humans, st.respondFor)) return true;        // human decides — leave st.pending for the UI
      resolveAIWindows(st, humans, log);                      // AI opponent answers recursively (Counter-a-Counter)
      if (st.pending && isHuman(humans, st.respondFor)) return true;   // the recursion opened a window a human must answer
    }
    // a destroyShield may have opened a reactive shield-guard window (Leyline) for the target:
    // an AI target guards/passes right here; a human target's window is left set for the UI.
    if (st.shieldResponse) shieldGuardAI(st, log, humans);
    return true;
  }

  // AI (player q) decides whether to answer the pending Technique with a Quick. Always
  // resolves the window (respond or decline) so st.pending is cleared. Returns the
  // engine result of whichever it chose.
  function respondDecision(st, q) {
    if (!st.pending || st.respondFor !== q) return null;
    if (!effectsAllowed(st, q)) return E.declineResponse(st, q);   // analysis: pure-fighter never answers with a Quick
    var qp = st.players[q], pend = st.pending, eff = pend.eff;
    function bestQuick(kind) {
      if (!kindOK(kind, q)) return null;               // analysis: blocked reactive kind
      var best = null, bestEff = null;
      qp.hand.forEach(function (c) {
        var ef = E.effectFor(st, q, c);   // effectFor: Forms can GRANT quick (Hector→Sanctuary, Hippolyta→Armor Piercing)
        if (ef && ef.impl && ef.quick && ef.kind === kind && E.canAfford(qp, c) && (!best || ef.cost < bestEff.cost)) { best = c; bestEff = ef; }
      });
      return best;
    }
    // Emergency Maintenance: save our own equipment from a removal aimed at it.
    if (eff.kind === 'removeEquip' && qp.equipment.length > 0) {
      var prot = bestQuick('protect');
      if (prot) { var pr = E.respond(st, q, prot.id); if (pr.ok) return pr; }
    }
    // Reactive Leyline: spring an immunity Quick to blank a destroyShield technique aimed at us.
    if (eff.kind === 'destroyShield' && qp.shields <= 2) {
      var immuneQ = qp.hand.filter(function (c) { var e = E.effectFor(st, q, c); return e && e.impl && e.quick && e.immune && E.canAfford(qp, c); })[0];
      if (immuneQ) { var ir = E.respond(st, q, immuneQ.id); if (ir.ok) return ir; }
    }
    // Counter Spell: negate the genuinely threatening Techniques (not friendly draws/ramp).
    var threat = eff.kind === 'destroyShield'
      || (eff.kind === 'removeEquip' && qp.equipment.length > 0)
      || eff.kind === 'discardOpp'
      || eff.kind === 'energyDenyOpp';
    if (threat) {
      var cs = bestQuick('counter');
      if (cs) { var cr = E.respond(st, q, cs.id); if (cr.ok) return cr; }
    }
    return E.declineResponse(st, q);
  }

  // Drain response windows that belong to AI players (recursively — a Counter-a-Counter can leave a
  // window open for the other player). Stops when no window is open or the open window is a human's
  // (left for the UI to prompt).
  function resolveAIWindows(st, humans, log) {
    var guard = 0;
    while (st.pending && st.respondFor != null && !isHuman(humans, st.respondFor) && guard++ < 64) {
      var q = st.respondFor, rr = respondDecision(st, q);
      if (!rr) break;
      if (log && rr.respondedWith) log.push({ respond: rr.respondKind, respName: rr.respondName, respBy: q, countered: !!rr.countered });
    }
  }

  // ---- take a full turn: PLAY phase, then one FIGHT action (with a STOPPER escape) ----
  // `humans` (optional) = indices the AI must NOT auto-respond for; if a response
  // window opens for one of them the turn suspends (st.pending stays set) and this
  // returns the partial log — call takeTurn again once the human has responded.
  // Resolve a reactive shield-guard window (Leyline) for an AI defender — spring it when a shield matters.
  function shieldGuardAI(st, log, humans) {
    var sr = st.shieldResponse; if (!sr) return log;
    var q = sr.q;
    if (isHuman(humans, q)) return log;                      // a human decides via the UI — suspend
    if (!effectsAllowed(st, q)) { E.shieldGuardPass(st, q); log.push({ shieldGuardPass: true, who: q }); return log; }   // analysis: pure-fighter never guards

    var pl = st.players[q];
    if (pl.shields <= 2) {                                   // save the shield when it matters (Leyline also ramps, rarely wasted)
      var res = E.shieldGuard(st, q, sr.guardId);
      if (res && res.ok === false) { E.shieldGuardPass(st, q); log.push({ shieldGuardPass: true, who: q }); }
      else log.push({ shieldGuard: true, who: q, name: res.guardName });
    } else {
      E.shieldGuardPass(st, q); log.push({ shieldGuardPass: true, who: q });
    }
    return log;
  }
  // The affordable lockout Quick (Back Stab) in q's hand, if any.
  function lockoutQuick(st, q) {
    if (!kindOK('lockout', q)) return null;            // analysis: blocked lockout kind
    // effectFor, NOT effectOf: a card's `quick` can be GRANTED by a Form. Back Stab is only a Quick under
    // Hermes Super, so reading the base effect here meant the AI could never see it — it has never sprung
    // Back Stab in any mode. Same trap applies to every Form-granted Quick.
    return st.players[q].hand.filter(function (c) { var e = E.effectFor(st, q, c); return e && e.impl && e.quick && e.kind === 'lockout' && E.canAfford(st.players[q], c); })[0] || null;
  }
  // Should the NON-active player q spring Back Stab before the active player fights? Deny an opening
  // LEAD: if the active player is about to lead (no pile) and we hold a combo to capitalize, lock them —
  // they skip, we seize the initiative and lead our own Special next.
  function aiPreFightLock(st, q, activeP, diff) {
    if (diff === 'minion' || diff === 'recruit') return false;   // Recruit doesn't spring Back Stab
    if (!effectsAllowed(st, q)) return false;          // analysis: pure-fighter never springs Back Stab
    if (!lockoutQuick(st, q)) return false;
    return st.pile == null && st.round >= 2 && hasCombo(st.players[q].hand);
  }
  function takeTurn(st, p, diff, humans) {
    observe(st);                                        // remember what the table has been playing
    diff = diff || 'fighter';
    (st._diff = st._diff || {})[p] = diff;                          // remember each seat's tier (round-win chooser reads it)
    var log = [];
    if (st.shieldResponse) return shieldGuardAI(st, log, humans);   // a reactive shield-guard window is open
    if (st.pending) {                                               // a response window is open (Counter-a-Counter chain)
      if (isHuman(humans, st.respondFor)) return log;               // human answers via the UI — suspend
      resolveAIWindows(st, humans, log);
      if (st.pending && isHuman(humans, st.respondFor)) return log;
    }
    if (st.discardPending) {                                 // a forced discard from a prior suspended action
      if (isHuman(humans, st.discardPending.player)) return log;   // still needs the human to choose
      var dr0 = E.resolveDiscard(st); if (dr0.ok && dr0.discarded.length) log.push({ forcedDiscard: dr0.discarded.length, who: dr0.player });
    }
    if (E.isLocked(st, p)) {                                  // Back Stab: can't play or activate — pass/skip
      var lr = E.pass(st, p);
      if (!lr.ok) throw new Error('AI locked-pass failed: ' + lr.reason);
      log.push(lr.forcedSkip ? { lockedSkip: true } : { fight: 'pass', locked: true, result: lr });
      return log;
    }
    playPhase(st, p, log, diff, humans);
    if (st.discardPending) return log;                       // a human must choose discards — suspend
    if (st.pending) return log;                              // suspended awaiting a human response
    if (st.shieldResponse) return log;                       // suspended awaiting a human shield-guard response
    // Phase 2 — non-active pre-fight window: the opponent may spring a proactive Quick (Back Stab) before we fight.
    var pf = E.openPreFight(st);
    if (pf.preFightPending) {
      var qq = pf.q;
      if (isHuman(humans, qq)) return log;                   // the human (non-active) decides via the UI — suspend
      if (aiPreFightLock(st, qq, p, diff)) {
        var bs = lockoutQuick(st, qq);
        var card = { rank: bs.rank, suit: bs.suit, id: bs.id };
        var pr = E.preFightCast(st, qq, bs.id, {});
        if (pr && pr.ok !== false) {
          log.push({ preFight: 'lock', by: qq, card: card });
          if (pr.pending) { resolveAIWindows(st, humans, log); if (st.pending && isHuman(humans, st.respondFor)) return log; }
        }
      } else { E.preFightPass(st, qq); }
    }
    if (E.isLocked(st, p)) {                                  // a Back Stab just locked us — our fight is a forced skip
      var lr2 = E.pass(st, p);
      if (!lr2.ok) throw new Error('AI pre-fight locked-pass failed: ' + lr2.reason);
      log.push(lr2.forcedSkip ? { lockedSkip: true } : { fight: 'pass', locked: true, result: lr2 });
      return log;
    }
    var mv = chooseMove(st, p, diff);
    if (mv.action === 'play') { fight(st, p, mv.cards, log); return log; }
    if (mv.action === 'pass') {
      // (Brilliant Tactic is now a technique-speed pre-fight boost — handled proactively in
      // playPhase via pickValueBoost, no reactive overtake here.)
      // Defensive STOPPER (fighter/demon): a pair/trio we can't beat would strip a shield.
      // Commit matching STOPPERs to cancel it and seize the lead, then lead our own play.
      var need = E.stopperNeed(st);
      if (diff !== 'minion' && need >= 2) {                          // don't spend stoppers on a jab (no shield at stake)
        var chosen = pickStoppers(st, p, need);
        if (chosen && st.players[p].hand.length - need >= 1) {
          var sr = E.stopper(st, p, chosen);
          if (sr.ok) {
            log.push({ stopper: need, cancelled: sr.cancelled });
            var lead = chooseMove(st, p, diff);
            if (lead.action === 'play') { fight(st, p, lead.cards, log); return log; }
            st.finished = true; st.winner = (p === 0 ? 1 : 0); log.push({ stuck: true }); return log;  // guard holds a card, so this is unreachable
          }
        }
      }
      // Phantasmal Illusion: warp a Special we can't otherwise beat (a straight) into a higher one.
      if (diff !== 'minion') {
        var ph = tryPhantasm(st, p);
        if (ph) {
          var rp = E.phantasm(st, p, ph);
          if (rp.ok) { log.push({ phantasm: rp.made, value: rp.value }); return log; }
        }
      }
      var pr = E.pass(st, p);
      if (!pr.ok) throw new Error('AI illegal pass: ' + pr.reason);
      log.push({ fight: 'pass', result: pr });
      return log;
    }
    // stuck (must lead but no cards): concede
    st.finished = true; st.winner = (p === 0 ? 1 : 0); log.push({ stuck: true }); return log;
  }
  function fight(st, p, cards, log) {
    var r = E.play(st, p, cards);
    if (!r.ok) throw new Error('AI illegal fight: ' + r.reason);
    log.push({ fight: 'play', combo: r.combo });
    // hand-limit trim happens once at the round's Clean-up (engine finishRoundWin / UI resolveRoundCeremony), not per turn
  }

  // Drive the NON-active player q's pre-fight decision from the UI (the engine window is already open).
  function preFightMove(st, q, activeP, diff) {
    observe(st);
    if (aiPreFightLock(st, q, activeP, diff)) { var bs = lockoutQuick(st, q); if (bs) return { cast: bs.id, card: { rank: bs.rank, suit: bs.suit, id: bs.id } }; }
    return { pass: true };
  }
  var API = { chooseMove: chooseMove, playPhase: playPhase, takeTurn: takeTurn, respondDecision: respondDecision, preFightMove: preFightMove, setStratPassMax: function (n) { STRAT_PASS_MAX = n; }, setLockoutMaxAlive: setLockoutMaxAlive, lockoutWorth: lockoutWorth, observe: observe, counterfeitHelps: counterfeitHelps,
    lockoutStats: lockoutStats, resetLockoutStats: resetLockoutStats, setStratPassMP: setStratPassMP, setStratPassSeats: setStratPassSeats, stratPassCount: stratPassCount, resetStratPassCount: resetStratPassCount, setStratPassMode: setStratPassMode, setTransformPolicy: setTransformPolicy, setEffectPolicy: setEffectPolicy, setKindBlock: setKindBlock, chooseTarget: chooseTarget, setStyles: setStyles, PERSONAS: PERSONAS, personasFor: personasFor, drawPersonas: drawPersonas };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  root.CardmenAI = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
