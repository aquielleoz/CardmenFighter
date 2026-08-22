# Cardmen Fighter — Patch Notes & Balance Learnings

This file records balance changes and, more importantly, **why** they worked. The
principles at the top are the reusable lessons — read them before making future
balance changes so we don't relearn them the hard way. The patch log beneath is the
evidence trail. All win% figures come from `node analysis.js 130` (round-robin, every
deck vs every other, ~7,150 games, Demon-strength AI, strict suit-cost).

---

## Balance Design Principles (the durable learnings)

### 1. To move a DECK, nerf its workhorse — not its flashy top-end.
A deck's win rate is driven by its **high-cast-rate** cards, not its splashy finishers.
Cards that only cast ~0.1 times per game cannot move a deck's overall win rate no matter
how hard you tune them.

- **Cleric** fell from 62% → 50% only when **Sanctuary** (cast 0.28/game, the engine)
  was nerfed — not from touching its rare cards.
- **Rogue** barely moved (62% → 61.5%) when we nerfed **Never Out of Options** (cast
  0.13). It dropped to 55.5% the instant we nerfed **Outbalance** (cast 0.68 — nearly
  every game).
- **Wizard** didn't budge (44.0 → 44.1) from buffing **Infuse** (cast 0.04).

**Rule of thumb:** before tuning a card to fix a deck, check its castRate. If it's under
~0.2, it's a leaf, not a lever. Find the 0.5–0.9 cast card instead.

### 2. Value boosts are priced by RATE, not magnitude.
A "+N value boost at cost M" is only worth casting when N is favorable against M (roughly
N ≥ M). A big boost parked at an expensive slot is dead on arrival because you pay more
energy than you gain.

- **Imbue** (+2 at cost 1) is great — you gain more than you spend.
- **Divine Tactic** (+6 at cost 9) and **Infuse** (+2 at cost 7) were dead (~44%, ~0.02
  cast) because the rate is a losing trade.
- The fix is **relocation to a cheaper slot**, not a bigger number. Divine Tactic → cost 6
  (+5) went from dead to 50%. Infuse → cost 5 (+4) went from 0.04 cast to 0.11.

**Rule of thumb:** never fix a dead boost by pumping its number at the same slot. Move it
down the curve until the rate is fair.

### 3. Situational cards read as 0.00 in AI sweeps — that's a blind spot, not weakness.
Cards whose trigger conditions the bots rarely create will show ~0.00 castRate and no win
data. This is a **measurement artifact**, not a verdict on the card.

- **Phantasmal Illusion** needs to face a straight or full house; the AI rarely leads one,
  so it almost never fires in sims — yet it correctly strips a shield when it resolves
  (verified: an overtake that holds wins the round like any Special).
- **Counterfeit** needs a matching rank in the Rival's current play.

**Rule of thumb:** do not tune situational/answer cards from sweep numbers. Flag them as
"playtest by hand" and judge them from real games.

### 4. Merge dead top-end cards to free design space.
Two dead high-cost cards can become one live card plus an open slot.
- **Sphere of Invulnerability** (31%) + **Light the Pylons** (38%) → merged into
  **Leyline Ascension** (reclaim + shield immunity, ~49%), which freed slot 10 for the new
  **Phantasmal Illusion**. The merge lifted the whole Wizard top-end instead of leaving two
  corpses on the curve.

### 5. Fix the AI before trusting the numbers.
A low castRate frequently means "the AI doesn't know how to use this," not "the card is
weak." We taught the AI to hold STOPPERs, protect Specials, value combos, reach for the
right-sized value boost, and (Demon only) strategically concede jabs — *before* reading
balance data. Several "weak" cards were just un-piloted.

**Rule of thumb:** if a card's castRate is surprisingly low, first ask whether the AI has a
heuristic to use it, then re-measure, then tune.

### 6. A redundant kit can't be nerfed by one lever — measure marginal vs combined.
When a deck has multiple overlapping win engines, disabling any ONE barely moves it: the
others compensate. Marginal single-lever tests will all read "~2 points" and mislead you into
thinking nothing matters. You must test the levers **together**.

- **Fighter** (rework, ~62% vs the field) survived losing its whole equipment value (−2.6pts),
  its draw engine (−3.7), OR its shield finishers (−0.3) — each alone left it ~60%. Only
  removing draw + equip + finishers **together** dropped it below 50% (47%). Its three engines
  are substitutes, not additives.
- **Corollary:** to actually retune such a deck, cut TWO pillars, and prefer the ones that also
  fix an identity problem (Fighter shouldn't be the game's biggest card-drawer *and* best
  leverager). The single highest-value target is the one no other class has — Fighter's
  Instant Recovery reclaim (deck-out insurance), not equipment durations.

**Rule of thumb:** if every single-lever nerf reads ~2pts, stop tuning magnitudes — the deck's
strength is redundancy. Measure combined removal to find the real floor.

---

## Balance Patch Log

Baseline (v0.33): Cleric ~62% and Rogue ~59% over-tuned; Wizard ~39% under-tuned;
middle eight decks healthy. Sanctuary 66%, Divine Tactic 44%, Sphere 31%, Poison the Air
unusable at cost 8.

### v0.34 — Divine Tactic rehab
- **Divine Tactic** (Cleric) moved slot 9 → 6, boost +6 → +5; swapped places with **Holy
  Sword** (6 → 9). *Rate fix (Principle 2).* Divine Tactic dead → ~50%.

### v0.35 — Cleric nerf, Wizard merge, Rogue reshuffle, two new cards
- **Sanctuary** (Cleric) moved slot 8 → 9 and nerfed Gain 2 → **Gain 1 shield**. *Workhorse
  nerf (Principle 1).* Cleric 62% → 50.5%; Sanctuary 66% → 49%. **Holy Sword** → slot 8.
- **Leyline Ascension** (Wizard 9): merged Light the Pylons (reclaim half) + Sphere of
  Invulnerability (shield immunity) into one card. *Merge (Principle 4).*
- **Phantasmal Illusion** (Wizard 10): NEW. Copy the Rival's whole play, swap one card to
  form a higher same-size Special.
- **Counterfeit** (Rogue 8): NEW. Copy a card into your hand; must play it that round.
- Rogue reshuffle: **Poison the Air** 8 → 4 (unusable → castable), **Sabotage** 4 → 5,
  **Chi Block** cut.
- Result: Wizard 39% → 42.4%. New outlier: Rogue ~62%.

### v0.36 — Copy-card rework
- **Counterfeit** and **Phantasmal Illusion** now copy from the Rival's **current play**
  (the pile), not the energy pile. Phantasmal confirmed to flip full houses (copy 88899,
  drop an 8, add your 9 → 99988) as well as slide straights.

### v0.37 — Never Out of Options trim (partial lesson)
- **Never Out of Options** (Rogue) dig-5-keep-3 → **dig-4-keep-2**. Card 66% → 58%, but
  Rogue only moved 62% → 61.5%. *This is the evidence for Principle 1: low-cast card can't
  move the deck.*

### v0.38 — Outbalance nerf (the real Rogue lever)
- **Outbalance** (Rogue) discard 2 → **discard 1** (cost 1). *Workhorse nerf (Principle 1).*
  Rogue 61.5% → 55.5%; Outbalance 57% → 52%. Rogue rejoined the pack.

### v0.39 — Infuse bump (partial lesson)
- **Infuse with Magic** +2 → **+3** at cost 7. Marginal: 41% → 44%, Wizard 44.0 → 44.1.
  *Evidence for Principle 2: bad rate at an expensive slot stays dead even with a bigger
  number.*

### v0.40 — Wizard rotation (rate fix + off the floor)
- **Infuse with Magic** moved slot 7 → 5, boost → **+4**. *Relocation, not a bigger number
  (Principle 2).* Cast 0.04 → 0.11, win 44% → 49.5%.
- **Back to the Books** moved slot 5 → 6, draw 2 → **3**.
- **Forceful Strip** moved slot 6 → 7 (effect unchanged; accepted a small dip to ~38% as
  the trade for rehabbing Infuse).
- Result: Wizard 44.1% → **46.5%** — off the floor and into the pack.

### v0.41 — Suit swap (cosmetic identity, zero balance impact)
- **Fighter ↔ Rogue suits swapped:** Fighter is now **♣ clubs** (internal suit `C`), Rogue is
  now **♠ spades** (internal suit `S`). Done the clean way — the effect blocks moved with the
  archetypes, so the internal letter still matches its symbol (`C`=♣, `S`=♠) and every card ID
  stays truthful (a `5♣` Fighter card is genuinely suit `C`). This matters for the art phase:
  card IDs now match the printed suit.
- Pure relabel — suits don't break fight ties and costs are symmetric, so deck win rates are
  unchanged (the ~1pt wobble in the snapshot below vs v0.40 is representative-card ordering
  noise, not a real shift). Final suit map: **♦ Wizard · ♥ Cleric · ♣ Fighter · ♠ Rogue.**

> **Gap:** the 2-as-apex + J/Q/K Rides/Forms rework (v0.70–v0.85) is not logged card-by-card here —
> that arc lives in **NEXT-SESSION.md**. The rework-era entries below are the balance-relevant highlights only.

### v0.84 — Transform economy (rework)
- J/Q/K transforms set to **FREE · draw 1 · table-gated** (unlock at total table shields lost:
  duel J@2 / Q@4 / K@6). Data-driven: lands transformer-vs-non at ~50% (a real choice, not a trap).
  *Boost magnitude proved NOT to be the lever — 3× boosts moved win% ~0.1pt.*

### v0.85 — Sanctuary symmetric + Fighter draw pass + the redundancy finding
- **Sanctuary (Cleric H10)** → heals **every** player +1 (Principle 1: nerf the workhorse). It was a
  free personal shield the AI auto-cast; symmetric makes it a wash on the race. **Pure Cleric ~65% → ~48–50%**,
  Sanctuary's own win-correlation ~52% → ~39%.
- **Fighter/Rogue draw spells:** Fighter #6 Discombobulate → **Superior Training** (dig 4, 3→Energy, draw 1);
  Instant Recovery draw 2→1; Ares Wheel draw 10→6. Rogue **Never Out of Options** dig 4/draw 2 → dig 3/draw 1.
  *Net effect on Fighter: negligible (~62% → ~61%) — Superior Training re-added draw. See Principle 6.*
- **Redundancy finding (Principle 6, new).** Fighter is over-tuned but no single subsystem carries it;
  equipment durations are a dead lever (~2pts). Real target = the Instant Recovery reclaim engine. **Open.**

### v0.86 — Broadway pitch cost on the Fighter finishers
- **Ultima Attack** and **Armor Piercing** gained an additional cost: discard a **Broadway** card
  (10/J/Q/K/A) from hand → the Discard pile. This attacks Fighter's redundancy from a new angle (Principle 6):
  the finishers now cost a *high card* — one you'd rather fight or transform with — so spamming them is a real
  sacrifice, not free reach. **Pure Fighter ~61% → ~58%** (Ultima 57.9→53, Armor Piercing 56.8→51). First
  single pass to meaningfully move Fighter.
- **Back to the Books** draw 3 → dig (look 3, 1→Energy, keep 2). The best non-Fighter card (~54.6%) → ~50.9%.
- Design note: "win by fighting, not drawing/boosting." The pitch cost deliberately taxes Fighter's *high-card
  economy* rather than its equipment, matching the intended identity. Fighter is still ~58% (top) — the
  Instant Recovery reclaim engine remains the open lever for the next pass.

---

## Current Balance Snapshot (v0.41)

Round-robin, 130 games/matchup (~7,150 games), Demon AI, strict suit-cost.

| Rank | Deck | Win% | Type |
|-----:|------|-----:|------|
| 1 | Pure Rogue | 56.0 | pure |
| 2 | Pure Fighter | 54.2 | pure |
| 3 | Pure Cleric | 53.9 | pure |
| 4 | Berserker (Fig+Rog) | 50.2 | dual |
| 5 | Bard (Cle+Rog) | 49.5 | dual |
| 6 | Paladin (Cle+Fig) | 49.0 | dual |
| 7 | Mage Knight (Wiz+Fig) | 48.7 | dual |
| 8 | Warlock (Wiz+Rog) | 48.5 | dual |
| 9 | Pure Wizard | 47.8 | pure |
| 10 | Sage (Wiz+Cle) | 46.7 | dual |
| 11 | Full Set (all 40) | 45.4 | full |

**Spread: 10.6 points (45.4–56.0).** All eleven decks inside a 45–56% band — a healthy meta.
Full Set trailing is expected (a jack-of-all-trades vs focused archetypes).

### Known soft spots to revisit later (not urgent)
- **Wizard's ramp identity**: Gather Energy casts ~0.86/game but wins only ~48% — the deck
  banks energy without converting it. This is a *strategic* gap (needs a better payoff for
  hoarded energy), not a numbers tweak. The clearest remaining lever if Wizard needs more.
- **Forceful Strip** (~38%) is now the weakest single card after the v0.40 rotation —
  acceptable as a situational answer, but a candidate if it wants a small buff.

### How to re-measure
`cd CardmenFighter && node analysis.js 130` — deck standings + per-card castRate and win%.
`node test.js` must show PASS with 0 FAIL before trusting any run.
