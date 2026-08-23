# Cardmen Fighter — Patch Notes & Balance Learnings

This file records balance changes and, more importantly, **why** they worked. The
principles at the top are the reusable lessons — read them before making future
balance changes so we don't relearn them the hard way. The patch log beneath is the
evidence trail. All win% figures come from `node analysis.js 130` (round-robin, every
deck vs every other, ~7,150 games, Demon-strength AI, strict suit-cost).

---

## Balance Design Principles (the durable learnings)

### 0a. The binding constraint is OPTIONS, not cards. Check which resource is scarce before tuning it. (2026-08-24)
Two card-economy experiments in a row measured inert — the **jab cantrip** (below) and making the AI's
**strategic pass** work in multiplayer (`passsim.js`). Same reason, and `optionsim.js` names it:

| | hand size | legal plays/turn | turns with NO legal play | following a pile: stuck |
| --- | --- | --- | --- | --- |
| 2p | 7.6 | 4.5 | 40% | 67% |
| 3p | 7.6 | 3.2 | 50% | 68% |
| 4p | 8.1 | 2.9 | 56% | 73% |
| **6p** | **8.7** | **2.3** | **65%** | **79%** (82% facing a Special) |

**Hand size RISES with player count while legal plays FALL.** A 6-player hand is *fuller* than a duel hand and
has *half* the options; when you are not leading you average **0.5 legal plays** and are stuck **79%** of turns.
With more players the pile is raised several times before it reaches you, so the bar is higher and fewer of your
cards qualify. That is the shape-and-value rule biting, not scarcity. **A full hand with no legal play is
functionally an empty hand.**

Corroborated from the other side by `passsim.js`: hands sit **at** the 10-card `MAX_HAND` cap **43% (4p) to 53%
(6p)** of the time, within one of it 55-65%. So conserving cards buys cards you would discard anyway, and
drawing extra cards is gated off by the cap. **Any future card-economy lever will also measure inert** until
the cap or the draw rate moves. Aj's "jab after jab" was never a strategy choice — it was the absence of
choices.

The lever that would actually bite is **options**: e.g. letting a bigger shape answer a smaller one at a cost,
so a full house is not dead against a pair. Untested.

### 0b. The energy economy pays for PARTICIPATION; initiative pays for WINNING. (2026-08-24)
Traced card by card through the engine on a real line Aj described. Energy gained in a round is simply **cards
committed** — a played card goes hand→energy, a milled card goes deck→energy:

- Aj passes twice while two opponents trade jabs → **Aj 1, opp1 3, opp2 2** (opp1 committed two plays plus a
  mill; opp2 won so it never mills).
- Aj instead **un-passes and wins** the jab round → **Aj 1, opp1 3, opp2 2**. *Identical.*

So **the winner of a jab round banks the least** (just the card it played) while a player who contested twice
and lost banks three. Winning buys **initiative**, not energy. Two currencies pulling opposite ways, and
"passing is a tempo loss" is not quite right: passing is energy-**neutral** and swaps deck depletion for hand
depletion. Its real cost is the initiative, which compounds (see `NEXT-SESSION.md`).

**Do not re-run `MILL_SCOPE='universal'`** as a fix for this. Aj: already measured in a previous session —
`'targeted'` won, because universal milling opened a large win-rate spread in multiplayer while targeted keeps
the decks close.


### 0. A free bonus on the BORING action makes the boring action mandatory. (2026-08-23)
Tested and **rejected**: *"each jab is a cantrip"* — a single-card play also draws a card. The measurements
were fine and the change still failed, which is the interesting part.

**What it did (1500 / 1300 / 660-game A/Bs, flag in `play()` gated on `MAX_HAND`):**

| | off | on |
| --- | --- | --- |
| games that reshuffle at all | 36% | **42%** |
| median round of first reshuffle | 13 | **11** |
| reshuffles per game | 0.38 | 0.44 |
| longest game | 28 rounds | 20 rounds |
| duel win-rate spread | 12.3 pts | **11.3 pts** |
| Full Set (the default deck) | 46.7% (#10) | **49.5% (#7)** |
| Quick responses | 4217 | 4396 (+4.2%) |

So it did what it was designed to do: cycling up, spread tighter, the long tail gone, and the **default deck
moved toward fair**. Free-for-all was neutral, every deck inside noise.

**Why it was rejected anyway — three reasons, and the third is the real one:**

1. **It cannibalised an entire archetype.** The six biggest cast-rate declines in the whole card set were
   *exactly the six draw cards* (Hand-to-Hand Mastery −0.05, Back to the Books −0.04 with win% 60.0→56.1, Pray
   for Guidance, Prepare for Combat, Superior Training, Never Out of Options). Paying a card **and** energy for
   "draw a card" is bad when jabs do it free. **Any free effect prices out the cards that sell that effect.**
2. **Card advantage is a tempo tax.** Pure Fighter fell 52.4% → 47.2% (#3 → #9) — the only real loser — while
   the value/utility decks rose (Warlock +2.8, Full Set +2.8, Mage Knight +2.4). When everyone can afford to
   hold an answer, the deck whose edge is closing fast loses that edge. Expect this from *any* global draw.
3. **It subsidised the least interesting action in the game.** A playtester had already said jabs were boring,
   and Aj hit the reason in play: with 3+ players you jab over and over because you cannot get the initiative
   to lead your own special, and you will not break a full house to answer a pair. The correct line is often to
   **pass**. So the common exchange is already jab-versus-passes — and paying players to jab makes the boring
   line *more* attractive. **Check what an incentive rewards, not just what it balances.** A change can pass
   every metric and still push play toward the part of the game nobody enjoys.

The root cause it exposed is recorded as an open item in `NEXT-SESSION.md`: **the round winner keeps the
initiative** (`engine.js` ~1685, `st.initiative = winner`), and the game has card catch-up but **no initiative
catch-up**. Fix that and jabs may stop being the default action on their own — without paying anyone to throw
them.

Re-testing this or a variant is ~15 minutes: a `JAB_CANTRIP` flag beside `MAX_HAND`, one line in `play()` after
the cards move to energy (`combo.size === 1 && pl.hand.length < MAX_HAND`), `cantrip` on the play result, and a
`cantrip`/`nocantrip` arg in `analysis.js` / `mpsim.js` / `recyclesim.js`. Narrower variants worth measuring if
it ever comes back: draw only on a **leading** jab, only when the jab **wins**, or **once per round**.


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
