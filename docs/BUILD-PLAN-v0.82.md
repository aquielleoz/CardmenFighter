# Cardmen Fighter — Rework Build Plan (J/Q/K + 2-as-apex)

*Implementation roadmap for the design locked in `RIDES-AND-FORMS.md`. Grounded in the current
`engine.js` (v0.82, 1100 lines, 554 passing tests). Built in flagged phases so the shipped game never
breaks mid-development.*

---

## Strategy: develop behind `setRework`, flip the default last

Same pattern as catch-up (`setShieldCards` / `setLoserMill` / `setRecycleTech`):

- `var REWORK = false; function setRework(v){ REWORK = !!v; }` + API export.
- **Flag OFF** → byte-for-byte v0.82: 40 cards, ranks 1–10, STOPPER active, no zone. All 554 existing tests
  run with the flag off and must stay green throughout.
- **Flag ON** → the new system: 52 cards, new ladder, STOPPER retired, Forms & Rides zone live. New tests
  cover this path.
- Once the rework is validated and tuned, flip the UI default to ON (like catch-up is ON in the UI, off in
  headless), then eventually retire the old path in a cleanup pass.

This keeps every step shippable and every regression catchable.

---

## The core representation decision

Today the engine holds one invariant: **a card's number is its rank, its fight value, and its energy cost,
all at once** (`engine.js` header lines 5–7; `effectOf` sets `cost: card.rank`, line 375). The rework breaks
that invariant, so the whole build hinges on introducing two accessors that everything routes through:

- **`fightValue(card)`** — the effective base value for combat comparison. Mapping (flag ON):
  `3–10 → 3–10`, `J/Q/K (rank 11/12/13) → 11/12/13`, `A (rank 1) → 14`, `2 → 15` (apex). Flag OFF → `card.rank`.
- **`activationCost(card)`** — energy to activate the card's effect. Mapping (flag ON): `3–10 → rank`,
  `J/Q/K → 10 flat`, `A → 1`, `2 → no effect`. Flag OFF → `card.rank`.

Ranks stay the card's stable identity (1–13); value and cost become derived. Every raw `card.rank` read in a
value or cost path migrates to one of these accessors. The two chokepoints from the architecture map make
this tractable: **all value math funnels through `applyEquip`→`beats`**, and **all cost math through
`costReq`/`canAfford`/`payEnergy`**.

---

## Phases

### Phase 1 — Indirection layer + flag  *(safe foundation, no behavior change)*
- Add `REWORK` flag + `setRework`, export it.
- Add `fightValue(card)` and `activationCost(card)` with the mappings above; export both.
- **Do not wire them into the engine yet** — this phase only introduces and unit-tests the accessors, so the
  flag-OFF game is untouched and all 554 tests pass trivially.
- Verify the mapping (flag ON) returns the ladder `3<4<…<10<J<Q<K<A<2`.

### Phase 2 — Deck expansion + ladder + retire STOPPER  *(behind the flag)*
- `makeDeck` / `buildDeck`: when `REWORK`, generate ranks **1–13** (adds J/Q/K); 13 cards/suit, 52 total.
- Route `detectCombo`, `beats`, `applyEquip`, `costReq`/`canAfford`/`payEnergy`, `effectOf.cost` through
  `fightValue` / `activationCost`.
- **Retire STOPPER as an activated effect** (delete the four rank-2 `kind:'stopper'` catalog entries +
  `stopper()`/`stopperNeed()` + the `activate` guard + exports) and instead make **the highest effective
  value inherently win its single-fight** via a check in `beats()` — "the strongest card is the stopper" as a
  property. (Old path keeps STOPPER when flag OFF — so gate the retire behind `REWORK`.)
- **A** keeps its old rank-1 effect at cost 1; **2** becomes a vanilla apex trump (no effect).
- Add rework-path tests (deck size, ladder ordering, apex unbeatable, A-at-cost-1).

### Phase 3 — Forms & Rides Zone + activation  *(behind the flag)*
- Add persistent `forms:[]` to `newPlayer` (clone the equipment lifecycle: init → resolve case →
  `finishRoundWin` handling → temp-cleanup filter). **No decay** (unlike equipment).
- New `resolveEffect` path: activating a J/Q/K pays 10 energy and pushes it to the zone.
- **Super detection** = any J + any Q + any K present (suits irrelevant).
- **Dual-purpose**: J/Q/K remain legal fight plays (as singles — see open question below).
- **Zone removal**: extend `removeEquip` targeting so Wizard's Forceful Strip → Ride, Rogue's Sabotage →
  Ride/Form, Athena → Form can reach the zone.

### Phase 4 — Form / Super boost application  *(behind the flag)*
- A boost table keyed by `(suit, tier)` → per-card upgraded effects, driven by what's in the zone.
  Suit-agnostic: each Form upgrades **its own suit's** cards; Super supersedes Form.
- Implement the four new primitives:
  - **±1 activation-cost Rides** (Giant Owl −1 your first effect / Giant Ram +1 opponent's first) — a new
    `costMod(st,p,card)` threaded through the cost functions.
  - **Turn-keyed value Rides** (Giant Boar +1 on your turn / Giant Swan +1 on rival turns) — hook into
    `applyEquip`/`equipDelta` alongside `nextPlayBoost`.
  - **Ares "Wheel"** (discard hand, shuffle hand+discard+shuffle into deck, draw 10) — new `resolveEffect`
    case composing existing draw/reclaim primitives; respect `MAX_HAND=10`.
  - Copy-into-bigger upgrades (Phantasmal +value+1, Counterfeit +value) — extend existing `phantasm` /
    `counterfeit` kinds.
- Fill in all four suits' Queen/King/Super boosts from the design doc.

### Phase 5 — AI + UI + tests + balance
- `ai.js`: value and activate Rides/Forms, weigh transform-vs-fight, and **fix Phantasmal Illusion** (AI
  never casts it today → its K♦ boost is dead in sims).
- Template UI: render the Forms & Rides zone; show Super state.
- Extend `test.js` (rework cases) and `browsertest.js` (zone interactions).
- Re-run `node analysis.js` on the new numbers; tune the flagged hotspots (Apollo, Athena, Ace-at-cost-1,
  Ares wheel). Update `NEXT-SESSION.md`, bump version, `node build.js`.

---

## Open implementation questions (surfaced by the code — need a ruling before Phase 2)

1. **Can J/Q/K/A/2 form combos, or fight as singles only?** The design frames them as "play as a high card,"
   which reads as *singles only*. If they can pair/trio/straight, the "apex unbeatable" rule and combo
   enumeration get materially more complex (e.g. is a pair of 2s unbeatable? there are four 2s).
   *Recommend: the five top cards fight as **singles only** — no pairs/trios/straights with them.* Simplest,
   and it matches "fight with your King as a high card."
2. **Do straights extend past 10?** Currently straights are `3-4-5-6-7 … 6-7-8-9-10` inside the 1–10 body
   (enumerate windows, lines 120–122). *Recommend: **no** — straights stay within 3–10; the top five cards
   don't participate in runs.* (Follows from #1.)
3. **"Strongest card is the stopper" only bites in single-fights.** Because comparison is match-shape (a
   single only meets singles), a lone 2 is unbeatable *as a single*, but a leader can still choose to fight a
   pair/trio the 2 can't answer. That's the honest reading of the reframe and it's fine — just confirming
   that's the intended scope, not a bug.
4. **52-card deck composition.** `buildDeck` currently deals ranks 1–10 per suit (pure = 10/suit; dual =
   split). With 1–13 it becomes 13/suit. Confirm the pure/dual/full deckbuilding rules for the bigger set,
   and whether `START_HAND=6` / `DRAW_PER_ROUND=2` / energy math still feel right at 52 cards (a balance
   question for Phase 5, flagged now).

I'll pause for your answers on #1–#4 before expanding the deck in Phase 2. Phase 1 (below) doesn't depend on
any of them, so I'm starting it now.
