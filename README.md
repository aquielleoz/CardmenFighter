# CARDMEN FIGHTER 🦵💥

A dueling TCG built on the ChikiChampions (Chikicha) combat engine, now themed as Kamen Riders.

## Status: PLAYABLE — v0.85 (the "rework": 2-as-apex + Kamen-Rider Forms)

The game is `CardmenFighter.html` — a complete, self-contained duel you can open in any browser
(phone or desktop, offline). Build it with `node build.js` (inlines `engine.js` + `ai.js` + `art.js` +
`faces.js`); test with `node test.js` (620, must be 0 FAIL) + `node browsertest.js` (headless smoke) +
`node analysis.js 130 on x rework` (balance round-robin).

**Where things stand (v0.85):** the game is now the **rework** — a 52-card deck on the ladder
`3 4 5 6 7 8 9 10 J Q K A 2` (the **2** is the apex trump; STOPPER retired), with **J/Q/K transform**
cards that move to a persistent **Forms & Rides Zone** and empower your cards (free · draw 1 · table-gated,
unlocking as **ROAR → OVERDRIVE → REDLINE**). Four suit-archetypes (♦ Wizard · ♥ Cleric · ♣ Fighter ·
♠ Rogue); full recursive priority stack; real card-face art for ♦/♥ (♣/♠ pending). Docs:

- **`CARD-LIST.md`** — the authoritative current card list (auto-generated from `engine.js`). **Start here.**
- **`REWORK-HISTORY.md`** — the narrative of how the rework happened and why.
- **`NEXT-SESSION.md`** — current state, recent changes, and the open backlog.
- **`RIDES-AND-FORMS.md`** — design/rationale for the J/Q/K Forms layer.
- **`PATCHNOTES.md`** — balance principles, patch log, and win-rate snapshots.
- **Historical (version-frozen):** `Cardmen-Fighter-Design-v0.70.md` (the classic 40-card ruleset),
  `STACK-DESIGN-v0.53.md` (the priority-stack design), `BUILD-PLAN-v0.82.md` (the rework build plan).

The detailed per-version changelog below is the historical record from **v0.29 and earlier** (the
v0.30→v0.70 story lives in NEXT-SESSION.md; the v0.70→v0.85 rework story is in REWORK-HISTORY.md).

---

## Version history (v0.29 and earlier)

## v0.29 — STOPPER redesign

New in v0.29: **STOPPERs are reworked into a scaling fight-phase cancel.** Instead of one card
resetting any trick, you now **commit N STOPPERs during a fight to cancel a same-size play** —
**1** vs a single, **2** vs a pair, **3** vs a trio. The play is voided and **you seize the
initiative** (you lead next); **no shield is stripped** by a cancel. **5-card combos (straights,
full houses, straight flushes) are unstoppable.** Each committed STOPPER still pays its own cost
(1 pip of its suit) and is removed from the game. New engine action `E.stopper(cardIds)` /
`E.stopperNeed(state)`; a **Stopper** button appears in the fight bar when you can cancel; the AI
uses it defensively (mostly to cancel pairs it can't beat, ~0.5×/game). Balance held (~14-pt
spread). Tests **452/452**; smoke + round-robin verified.

## v0.28 — deck reads 1–10

New in v0.28: the deck now runs **1–10** instead of 0–9 (like real playing cards). The number is
still both the fight value and the total cost, just one higher — so every card costs **+1** and
there are no free/zero cards (the old STOPPER is a `1`, the top card a `10` = `5♦ + 5 any`).
Combat is a pure relabel (a shown-6 still beats a shown-5; straights are still five-in-a-row), so
balance matches the pip economy — field stays compressed (~13-pt spread, duals interleaved with
pures, Full Set mid-pack), and games run a touch faster (~14.5 rounds) with effect throughput
down ~35% (effects feel more earned). Internally ranks stay 0–9; display and cost add 1. Tests
**442/442**; smoke + round-robin verified. Card list: `../CardMenFighter-cards-v0.28.md`.

## v0.27 — pip suit-cost economy

New in v0.27: the cost model is now **pips**. A card's number is both its fight value and its
total cost; of that cost, some pips must be paid in the card's own suit and the rest is generic
(any suit). Default colored pips = **max(1, floor(cost/2))**, and a 0-cost card is free — so a
♦5 = `2♦ + 3 any`, a ♦9 = `4♦ + 5 any`, a ♦1 = `1♦`. Cards can override with a `pips` number, or
a `cost` map for future multi-suit cards. This replaces strict cost, which over-rewarded the
most-concentrated (pure) decks. Result: the field **compressed from a 25-point spread to ~10** —
two dual decks (Bishop, Paladin) now sit in the top four and the Full Set is viable (~45%), while
pures keep only a slight edge (focus still rewarded). High-cost cards stay castable and premium
(the 9-drops remain top win-rate cards despite 4 colored pips). `E.costReq`, `E.canAfford`,
`E.costHint`, `E.defaultPips`. Tests **441/441**; smoke + round-robin verified. Card list:
`../CardMenFighter-cards-v0.27.md`.

## v0.26 — hand cap + flushes disabled

New in v0.26: **max hand size 10** — you may draw past it, but at the **end of your turn** you
discard down to 10 (your choice via a discard picker; the AI auto-pitches its lowest; discards
go to the shuffle pile). And **plain flushes are no longer a legal special** — five same-suit
cards only count if they're a run (**straight flush**), which still elevates over a straight.
`E.discardToLimit`, `E.MAX_HAND`. Tests 437/437; smoke verified through the discard flow.

⚠️ Balance note: removing flushes did **not** curb pure decks — it (with the hand cap) pushed
all four pures to the top and lifted pure-vs-mixed win rate ~55% → ~62%. Flushes were a tool
*non-pure* decks leaned on (20% of dual wins) more than pures needed. The real pure-dominance
lever remains the planned multi-suit cards. See `../CardMenFighter-handcap-flush-impact.md`.

## v0.24 — pre-game setup + initiative roll

New in v0.24: a proper **New Duel setup screen**. Before each duel you pick **your class**,
the **opponent's strength** (Minion / Fighter / Demon Lord), and the **opponent's class** —
each with a **🎲 Random** option. Then an **animated dual dice roll** decides who leads round 1;
both dice are shown (yours in gold, the Rival's in red), higher roll takes the initiative, ties
re-roll automatically. The chosen matchup shows in the header and next to each fighter. Honors
reduced-motion (dice settle instantly). The old header dropdowns are gone — everything lives in
the setup screen now. Tests 432/432; setup + smoke verified headlessly.

Balance note (v0.23): Cleric's Divine Protection (♥9) reverted to +1 (Wizard's Arcane Protection
♦9 stays +2). Full card list in `../CardMenFighter-cards-v0.23.md`.

## Strict suit-cost + buffs (v0.22)

New in v0.22: the cost economy is now **strict** — a card's **whole cost is paid in its own
suit** (a ♦7 = `7♦`; a future dual card carries an explicit map like `{D:2, H:2}` = `2♦ + 2♥`).
This is what makes deck focus matter: **pures pay for everything (~10 casts/game), duals split
their energy (~7), and the Full Set starves (~3)** — pure Wizard now beats the Full Set 66/34.
Two buffs landed too: **Cursed Pendant (♦7)** is now **−2** and **Arcane/Divine Protection
(♦9/♥9)** now grant **+2 shields**; pure Wizard went from losing to Fighter (hybrid) to beating
it 55/45. `E.canAfford(pl, card)`, `E.costReq(card)`, `E.costHint(card)`. Tests **432/432**;
`node matchups.js` for the breakdown. See `../CardMenFighter-strict-cost-analysis-v0.22.md`.

## v0.21 — hybrid suit-cost economy

New in v0.21: **costs are paid by suit.** A card demands **1 energy pip of each of its
identity suits** (today just its own suit) plus a **generic remainder** of any suit — the
hybrid model (a ♦5 = `1♦ + 4 any`; a future dual ♦♥4 = `1♦ + 1♥ + 2 any`). The cost engine
takes a *list* of identity suits, so multi-suit cards drop in later untouched.
`E.canAfford(pl, cost, suits)`, `E.payEnergy`, `E.costHint`. The energy readout now shows a
per-suit breakdown, and every effect chip shows its suit requirement. Tests: **432/432**.

A 500-games-each matchup sim (`node matchups.js`) shows the economy is **correct and
balanced** (mirrors ~50/50, every game terminates) but, for *single-suit* cards, a **light
touch**: one matching pip is easy to have by mid-game, so effect throughput (~8–10 casts/game)
tracks card *density* more than the suit tax. The rule's real teeth arrive with the planned
multi-suit cards (two required pips is a genuine constraint). Full Set and dual decks are
currently marginally favored over pures; Wizard is the weakest pure (its ♦7 Cursed Pendant and
♦9 shield drag, per the v0.19 analysis). See `../CardMenFighter-hybrid-cost-analysis-v0.21.md`.

## v0.20 — deckbuilding + archetype decks

New in v0.20: **deckbuilding.** Duplicates are now allowed (up to 4 of a card), and each
physical card carries a **unique instance id** so copies stay distinct through selection,
play, and removal. Two new top-bar pickers choose **your deck** and the **Rival's**:

- **Full Set** — the original 40 unique cards.
- **4 pure archetypes** — Wizard, Cleric, **Fighter** (the ♠ suit, formerly labelled
  Paladin), Berserker: 40 cards, 4 of every rank, all one suit.
- **6 dual archetypes** — Bishop (Wiz+Cle), Mage Knight (Wiz+Fig), Sorcerer (Wiz+Ber),
  Paladin (Cle+Fig), Druid (Cle+Ber), Juggernaut (Fig+Ber): 40 cards, 4 of every rank,
  split 2/2 across the two suits.

Every deck is 40 cards with ≥3 (here exactly 4) of each rank, keeping all combo shapes
online. Engine: `E.buildDeck(key)`, `E.DECKS`, `E.DECK_ORDER`; `newGame(rng, {decks:[a,b]})`.
Tests: **419/419** (incl. deck composition, unique-id, duplicate-play, and a mix-vs-pure
duel); the archetype UI smoke (pure Wizard vs pure Fighter) runs with zero runtime errors.
*Note: pure single-suit decks make every 5-card straight a straight flush and any 5 cards a
flush — a known power spike to weigh when balancing.*

## v0.19 — Quick/interrupt stack

New in v0.19: the **Quick/interrupt stack** — reactive responses on the *opponent's* turn.
Two Quicks are now live: **Counter Spell (♦4)** counters a Technique as it's played (the
countered card goes to its owner's Shuffle pile), and **Emergency Maintenance (♠4)** shields
a target Equipment from being destroyed or disarmed until end of round. When a player casts a
Technique the other side can answer, a **response window** opens:

- **You cast, Rival answers:** the Rival's AI auto-decides — it counters real threats
  (Nature's Fury, a removal aimed at its gear) and declines to waste a Quick on your draws.
- **Rival casts, you answer:** the Rival's turn **pauses** and a **Respond?** modal offers
  your eligible Quicks (with reminder text) plus *Let it resolve*; picking one resolves it and
  the Rival's turn resumes.

The window is a **shallow, one-response design** ("Quick = easy mode"): no counter-the-counter.
Quicks are response-only — they no longer clutter the proactive Play bar. Tests: **405/405**
(incl. counter/decline/protect/no-window/AI-response cases); the 12-game browser smoke test
exercises the live modal (respond + decline) with zero runtime errors; a **2,000-game sim**
(`sims.js`) reports ~0.4 responses/game and confirms no seat/effect is broken. See
`../CardMenFighter-effect-analysis-v0.19.md`.

Only the **7 blank cards** remain deferred.

## v0.17 — counter system + Seed Pouch & Legendary Armor

New in v0.17: the **counter system** is formalized. Equipment carries `counters`
with a `decay` flag — decay equipment loses 1 counter at the start of each round
(removed at 0); non-decay equipment keeps its counters. This completes the
equipment set:

- **Seed Pouch (♣6):** 5 counters, no auto-decay — once per round you may spend a
  counter to draw a card (a chip appears in the Play bar; the AI spends them too).
- **Legendary Armor (♠9):** 5 counters (decays) — while equipped you don't lose a
  Shield when you lose a Special fight. (Strong — a 5-round shield lockdown; one to
  watch when you balance.)

Equipment badges now show the live counter count, and once-per-round abilities
reset each round. Tests: 380/380. Still deferred: the two Quicks (interrupt stack),
the four equipment-removal cards (targeting), and the 7 blanks.

## v0.16 — 4-archetype deck, drop-in effects

New in v0.16: the deck is now the **4-archetype system** — ♦ **Wizard**, ♥ **Cleric**,
♠ **Paladin**, ♣ **Berserker** — each suit a unique 0–9 effect set (from the card
sheet). The **drop-in effects** are implemented and playable: STOPPER, the draws
(Frantic Study, Book Smarts, Prayer of Guidance/Peace, Brilliant Strategy, Analysis,
Listen to Nature), ramp (Cultivating Faith, Planting Crops), Gain-Shield (Arcane/Divine
Protection, Nature's Gift, Hero's Resolve), value Equipment with 5 counters (Legendary
Sword +2, Armor of the Wilds +1, Cursed Pendant −1), recycle (Review the Ancient Tome,
Miracle of Healing), Destroy-Shield (Nature's Fury), and Befuddle. Cost = the card's
value. The AI now uses effects **generically** (kind-driven), so it adapts to the deck.

**Deferred → plain fight cards for now** (need the interrupt stack, targeting, or the
counter-spend/lockout systems): both Quicks, the equipment-removal cards, Infused
Rosary, Legendary Armor, Seed Pouch — plus the 7 blank (TBD) cards. Multi-card draw
choices (return/discard) are auto-picked (lowest) for now; manual selection is a later pass.
Tests: 372/372. *(The old starter set in `Cardmen-Fighter-Design-v0.70.md` §9 is superseded by
the card sheet.)*

## v0.15 — suit ranking removed

New in v0.15: **removed the suit tiebreak.** Equal-value plays now **tie** — a play
only beats another of the same shape by having a strictly higher value (e.g. no 9
single beats another 9). Suits still matter for flushes/straight flushes and for
which effect a card carries. Side effect from sims: games are a bit more decisive
(~19 rounds avg, down from ~22), since top cards are now unbeatable leads.

## v0.14 — playtest logging + export

New in v0.14: every finished duel is saved locally (localStorage, with an
in-memory fallback) — difficulty, winner, end type (kick/deckout), rounds,
duration, and per-player counts (jabs, specials, techniques, stoppers, shields
lost, final shields, effect breakdown) plus the full battle log. The **Help (?)**
modal has a **Playtest data** panel with a live summary (incl. "won N using zero
techniques") and **Export JSON / Copy / Clear** so human playtesters can send
their data back.

## v0.13 — chikichallenge-style card faces

New in v0.13: card faces now show the **rank in both the top-left and
bottom-right corners** (rank-only, mirroring the chikichallenge deck), with the
big suit pip still in the center.

## v0.12 — center-stage shield FX

New in v0.12:

- **Center-stage shield flourish** (a mini Fighter Kick): losing a shield plays a
  quick shield **shatter** burst in the middle of the board (shards + red flash,
  "· shield down"); gaining one plays a shield **materialize** (green glow + ring,
  "· shield up"), colored/labelled for whichever fighter it affects. Reduced-motion safe.
- The on-counter shield shatter/shake from v0.11 still fires alongside it, and
  gained shields now pop in on the counter too.

## v0.11 — shield shatter FX + AI difficulty tiers

New in v0.11:

- **Shield shatter + shake:** losing a shield now shatters it (breaks apart, shards
  fly) and shakes the damaged fighter's shield counter. Honors reduced-motion.
- **AI difficulty (top bar selector, default Fighter):**
  - **Minion** — timid; leads only jabs and won't contest your Specials, so it's
    an easy warm-up.
  - **Fighter** — the standard greedy duelist.
  - **Demon Lord** — tanky and relentless: guards early, reinforces past 4 shields
    (the shield row now shows the buffer), ramps harder, and only ever spends a
    STOPPER when a shield is genuinely at risk.
- **Stopper fix:** the AI no longer throws STOPPERs on harmless jab exchanges — it
  saves them for when a Special threatens a shield. (~0.5/game now vs. many before.)

---

## v0.9 — descriptive battle log + "jab/special" vocab

**`CardMenFighter.html`** is a complete, self-contained duel you can open in any
browser (phone or desktop, works offline, add-to-home-screen). Engine + AI are
inlined; no build step or server needed to play.

New in v0.9 (UI only — engine untouched, still 378/378):

- **Renamed** the game to **Cardmen Fighter**.
- **Vocabulary:** a single is now a **jab**, a combo is a **special** — used
  everywhere (stage label, hints, help, log).
- **Descriptive battle log** now names the actual cards played, e.g. *"You played
  a jab with a 9 spade"*, *"Rival played a special pair of 2s (spade heart)"*,
  *"Rival played 2 spade Dig 3 (effect), then a special straight (…)"*. Effect
  activations show the card + *(effect)*. (This also surfaces which card powered
  each Rival effect — added to the AI's move log, no change to its decisions.)
- **Finisher:** the Fighter Kick now shows **YOU WIN / YOU LOSE**; the *"Crisis
  averted."* line lives in the win modal.

Note: as of v0.62 the build sources are named `CardmenFighter.template.html`
(+ `engine.js` / `ai.js` / `art.js` / `faces.js`) and `node build.js` outputs the
playable `CardmenFighter.html`. (Earlier versions used `KamenFighters.*` internally.)

New in v0.8 (UI only — engine/AI untouched, still 378/378):

- **Beaten-card sweep:** when a play is beaten, the trumped cards slide off to a
  small **"· last played"** corner in the top-left of the stage and stay parked
  there (labelled with who played them) until the next beat or a fresh fight, so
  you can always see what just got beaten.
- **Fighter Kick finisher:** landing the kill triggers a full-screen finisher —
  radial ray-burst, giant **FIGHTER KICK** with a spring-scale + screen shake,
  then the win/loss card. Gold **"CRISIS AVERTED"** on your win, red **"YOUR
  FIGHTER IS DOWN"** on a loss.

From v0.7: **card animations** — cards **deal into your hand** with a staggered
slide-in each round; on Fight your cards **fly from their hand slot onto the
stage** (true FLIP) and the Rival's plays **slide in from their side**; springier
**lift + glow** on select. All motion honors `prefers-reduced-motion`, and the
mobile action hint sits on its own line instead of squishing next to the buttons.

New in v0.6: a scrolling **battle log** (round draws, plays, effects, shield
strips, deck-out fizzles), **deck / shuffle counts** on both fighters, a side
**card view** with each card's full effect text, a **Sort** button (FLIP
animation), and **you-choose** selection for Discard 4 and Draw 2's top-of-deck.
A **lead-lock guard** stops you spending or discarding your last card into an
unplayable turn (it's a real deck-out loss only when you're truly out of cards).

Engine/AI verified with 378 assertions (incl. 300 full AI-vs-AI duels that use
effects). The UI was smoke-tested headlessly across many auto-played duels: both
the **Fighter Kick win** and the **loss** overlays render, the human's combo →
shield-strip path fires, and there are zero runtime errors on any path.

Earlier engine/AI notes (still current):

- **40-card 0–9 deck**, four suits. Value ranking 0 (low) → 9 (high); **no supreme card, no
  four-of-a-kind bomb.** Suit tiebreak ♦ > ♥ > ♠ > ♣.
- **Combos:** single, pair, trio, straight, flush, full house, straight flush (match-shape; a
  straight flush beats a straight or a flush). Straights `0-1-2-3-4` … `5-6-7-8-9`.
- **Duel loop:** 4 shields each; draw; lead; Chikicha trick; the last unbeaten play wins the round.
  Winning with a **combo** strips 1 opponent shield; a **single** win just banks energy. At 0
  shields, the next combo win is the **Fighter Kick** → that fighter loses.
- **Energy pile:** every fought card lands in your energy pile.
- **Activation (PLAY phase):** pay energy = the card's value (moved to the shuffle pile), resolve,
  Technique removed from the game. Deck refills from the shuffle pile when empty.
- **All starter effects done:** `0` STOPPER (reset the fight, free) · `♠/♥ 2` dig 3 to energy ·
  `♦/♣ 2` discard 4 to energy · `♠/♣ 4` draw 1 · `♦/♥ 4` draw 2 + top 1 · `♠/♥ 6` GUARD (prevent a
  shield this round) · `♦/♣ 6` +1 shield · `♠/♣ 8` equipment: your highest +1 (2 rounds) ·
  `♦/♥ 8` equipment: opponent's highest −1 (2 rounds).

- **Live turn loop + effect-using AI:** `ai.takeTurn(state, p)` runs a full turn — a PLAY phase
  (ramp / draw / reinforce / guard / equip, and STOPPER to escape a losing exchange) then a FIGHT.
  Across 300 duels the AI uses every effect and ~293/300 end in a Fighter Kick.

## Not built yet (next steps)

- The **reactive Quick stack** — playing a Quick on the opponent's turn (GUARD works proactively on
  your own turn for now).
- Growing the **card pool** beyond the starter set.

## Files

- `CardmenFighter.html` — **the game.** Self-contained, single file. Just open it. ← play this
- `CardmenFighter.template.html` — UI source with `__ENGINE__` / `__AI__` placeholders.
- `engine.js` — pure rules engine (deck, combos, comparison, duel loop). No DOM.
- `ai.js` — greedy, effect-using duel AI (drives the Rival + the test sims).
- `test.js` — engine/AI unit + simulation suite.
- `build.js` — inlines `engine.js` + `ai.js` into the template → `CardmenFighter.html`.

## Run

```
node build.js   # rebuild CardmenFighter.html after editing engine/ai/template
node test.js    # run the engine + AI test suite
```

To play: open `CardmenFighter.html` in a browser.
