# Cardmen Fighter — Patch Notes & Balance Learnings

This file records balance changes and, more importantly, **why** they worked. The
principles at the top are the reusable lessons — read them before making future
balance changes so we don't relearn them the hard way. The patch log beneath is the
evidence trail. All win% figures come from `node analysis.js 130` (round-robin, every
deck vs every other, ~7,150 games, Demon-strength AI, strict suit-cost).

---

## Balance Design Principles (the durable learnings)

### 0g. Aj's package: scaling shields with the table is the middle ground. NOT SHIPPED. (2026-08-24)
Three flags, all defaulting **OFF** — `setShieldsPerPlayer` (START_SHIELDS = 2 + numPlayers),
`setDrawPerPlayer` (draw = numPlayers), `setApexInfinity`. Measured with `rulesim.js`,
`median(max) rounds | jab % of plays | busiest-leader share`, 90 games per cell:

| config | 2p | 3p | 4p | 6p |
| --- | --- | --- | --- | --- |
| A live (`chosen`+`targeted`, draw2, sh4) | 11 j27 L56 | 16 j34 L46 | 22 j29 L39 | **33 j24 L31** |
| B symmetric (`all`+`universal`) | 11 j28 L56 | 10 j34 L48 | 10 j33 L41 | **9 j29 L35** |
| C + shields 2+P | 11 j28 L56 | 12 j36 L44 | 13 j29 L38 | **16 j23 L29** |
| D + draw=players | 11 j27 L56 | 11 j24 L46 | 12 j15 L39 | **15 j10 L31** |
| E + apex-2 infinity | 12 j27 L56 | 15 j19 L45 | 21 j11 L37 | **35 j10 L32** |
| F live + apex-2 | 12 j27 L56 | 19 j32 L46 | 30 j28 L40 | **48 j21 L31** |

**Shields = 2 + players works exactly as intended.** The symmetric pairing alone overshoots (flat 9 rounds at
6p); scaling the shield pool pulls it back to a gentle 11/12/13/16, so more players means a longer game without
the live rules' 33-round balloon. **Duels are untouched** — 2p resolves to 4 shields, today's value.

**Package D halves the jab problem.** Jab share at 6p falls **24% -> 10%**, at 15 rounds. That is Aj's original
complaint ("three rounds in a row throwing jab after jab") measured and cut in half. Balance, 3 runs per arm:
spread **16.4 -> 13.6** at 6p and **15.7 -> 13.7** at 4p, but **13.8 -> 16.6 (worse) at 3p**, with overlapping
ranges — suggestive, not settled. Bottom decks rise consistently (Pure Wizard +3.7, Pure Rogue +3.7, Warlock
+3.0), top decks come down (Paladin -3.7, Bard -3.5, Cleric -2.5).

### 0h. Initiative concentration is invariant to every lever we have tried. (2026-08-24)
The busiest leader's share of a game's rounds, against a fair share of 1/P, sits at **~1.8x at 6 players in all
six configs above** (L29-L35) — including both apex-2 variants. (Those were measured for initiative because
*we* were curious, not because the idea promised anything about it; see the correction below.) Winning a round
with an unbeatable 2 does not distribute initiative — it changes *who* gets the streak, because `engine.js`
~1685 still hands the next lead to the round winner.

**So initiative concentration has exactly one cause and it will not fall out of a side lever.** If it is worth
fixing, `st.initiative = winner` is the line to change — rotate the lead, or give it to a player who has led
least recently. Everything else is a symptom.

**On the apex-2 rework — and a correction worth keeping, because it is a mistake about how to read feedback.**
This came from Aj's brother as **playtest feedback**, not as a proposed fix for anything. It was first written
up here as "fails its own rationale (initiative)" — but that rationale was *ours*, invented and then attached
to someone else's report so it could be scored against it. **Playtest feedback does not arrive with a
hypothesis; it arrives with a feeling.** The job is to price it, not to grade it.

Priced, then. What it costs: 6-player length roughly doubles (package 15 -> 35 rounds; live 33 -> 48), because
an unbeatable-but-harmless play ends a round without draining a shield, and there are four 2s per deck. What it
gives: jab share at 6p drops to 10%, though `draw=players` already achieves that at under half the length. What
it does *not* do is spread initiative — but nobody claimed it would, and concentration averages could not see
"I could seize the lead at a moment I chose" even if it did.

**The motivating complaint, now recorded (Aj, 2026-08-24):** in the original **chikicha** the 2 is the outright
peak. Here it is merely 15, and **boosts stack on top of `fightValue`** — a boosted Ace at 14+7 beats it, and Aj
has run a +7 in a real game. So the apex is not an apex. That is wish #2 ("a 2 should be unbeatable"), not #1,
and it makes the minimal fix **"no boost may exceed the apex"**.

**Split in two, the proposal has a free half and an expensive half** (`rulesim.js`, configs G/H vs E/F):

| 6-player median rounds | |
| --- | --- |
| A live | 33 |
| **G live + apex unbeatable, still strips** | **34** |
| F live + apex unbeatable, NO strip | 50 |
| D Aj's package | 15 |
| **H package + apex unbeatable, still strips** | **15** |
| E package + apex unbeatable, NO strip | 38 |

**Making the apex unbeatable is FREE** — 33 -> 34, and 15 -> 15. The whole length cost (+17 on live, +23 on the
package) belongs to the **no-strip** half, because an unbeatable play that also deals no damage ends a round
without progressing the game. So the half that answers the actual complaint costs nothing, and the half that
does not is the only one that hurts. **Lesson: split a proposal into its independent parts before pricing it —
bundled, this looked like an expensive idea, and the part that mattered was free.**

Kept for reference, the other reading: "Plays with 2s should not
strip shields" and "a 2 should be unbeatable" are two separate wishes, and they point at different fixes: the
first sounds like *being crushed by an apex feels arbitrary*, the second like *the apex does not feel apex
enough*. Variants worth trying once the actual complaint is known: only the FIRST 2 each round is unbeatable; a
2 wins unbeatably **and** still strips (a true finisher); or playing a 2 as apex costs energy.


### 0d. RE-TESTED: `MILL_SCOPE='universal'` is not the loser it was recorded as. (2026-08-24)
Carried belief (from an earlier session): universal milling "opened a huge win-rate spread in multiplayer while
targeted keeps the decks close", so the live game uses `'targeted'`. Re-measured with 3 runs per arm — mandatory
now, see 0c — and it **does not reproduce**; the direction is the opposite at 3p and 6p:

| spread (top-bottom), mean [min-max] | targeted (live) | universal |
| --- | --- | --- |
| 6p | 17.3 [12.1-22.1] | **12.9 [11.9-14.0]** |
| 4p | **13.8 [11.0-15.6]** | 15.1 [12.0-17.9] |
| 3p | 17.1 [10.9-21.6] | **12.6 [10.5-13.7]** |

Note the *variance* as much as the means: targeted swings 10-11 points run to run, universal 2. And universal
moves decks the way `MULTIPLAYER-DESIGN.md` always predicted it would — Pure Rogue 10.3 -> 13.1, Bard
14.0 -> 16.9, Pure Cleric reined in 27.1 -> 24.8. Bottom up, top down: the "healthy economy" the design doc
describes.

**CORRECTION, same day — that comparison was the wrong one.** Aj: *"is that weird that everybody mills but not
everybody loses a shield?"* It is, and it exposes that `chosen`+`universal` is an **incoherent corner** of a 2x2:
one player eats the shield while all five get paid, so the spared players are strictly better off than the
struck one on both axes. The coherent designs are:
- **`chosen`+`targeted`** (live) — hit one, compensate that one. Punishment and consolation are linked.
- **`all`+`universal`** (the engine's own defaults) — hit everyone, pay everyone.

Re-run as coherent pairs, 3 runs each, they are close on balance, with the symmetric one slightly tighter and
much steadier: spread 12.5 [10.8-13.4] vs 13.0 [10.1-16.8] at 6p, 14.7 vs 18.0 at 4p, 15.4 vs 18.1 at 3p.
So the original "universal opens a huge spread" claim is not reproduced — but neither is my own overstated
reading of it, because I had measured a pairing nobody would ship. **Lesson: a balance finding has a shelf
life — re-date it before reusing it to veto an idea — and check that the arm you are testing is a design
someone would actually ship.**

### 0f. The live loss/mill pairing is why a 6-player game runs 3x as long as a duel. (2026-08-24)
Chasing Aj's shields question turned up the biggest number of the session. Median game length, 120 games each:

| | live (`chosen`+`targeted`) | symmetric (`all`+`universal`) |
| --- | --- | --- |
| 6p | **33 rounds** (max 49) | **9** (max 14) |
| 4p | 22 (max 36) | 10 (max 21) |
| 3p | 15 (max 25) | 10 (max 19) |
| 2p | 11 | 11 — identical; both modes are no-ops in a duel |

Under the live pairing a special win costs the table exactly **one** shield no matter how many people are
sitting at it, so total shields scale with player count while damage does not — game length balloons
**11 -> 15 -> 22 -> 33**. Under the symmetric pairing damage scales with the table too, and length is **flat at
~10 rounds** at every count, i.e. duel length.

**This reframes the whole "jab after jab" complaint.** It is not primarily an initiative problem or an options
problem: a 6-player game is simply **three times longer than the game the numbers are balanced around**, so the
grind, the option starvation (`optionsim.js`) and the 1.6-1.9x initiative concentration all have three times as
long to compound. Fix the length and several symptoms may go with it.

Not shipped — this is a large rules change and 9 rounds may be too *short* for six players; the interesting
question is whether something between the two corners (e.g. `all` scaled down, or `chosen` striking more than
one shield as the table grows) lands at ~15-18 rounds. But **length, not balance, is the axis to argue about**,
and the live setting was chosen without this number on the table.



### 0e. Jab rounds are the grind, and their LENGTH is the lever — not the reward. (2026-08-24)
Aj's complaint was "three rounds in a row throwing jab after jab". Measured (`optionsim.js`), plays per jab
round rise with the table: **1.72 (2p) -> 2.79 -> 2.92 -> 3.12 (6p)**, while special rounds stay ~1.6-2.1. So
jab rounds really are the long ones, and they get longer as players are added.

Aj's own prediction about `DRAW_PER_ROUND = numPlayers` was half right, and the right half is the useful one:
- **Confirmed:** jab rounds get **33% shorter** at 6p (3.12 -> 2.08) — at six players they collapse to exactly
  the length of a special round (2.08 vs 2.09). More turns with *no legal play* is what shortens them, so that
  metric is not purely a cost, which is how it was first read.
- **Refuted:** he expected the energy gap between passers and contesters to *narrow* (fewer chances to pass).
  It **widens**, 7.9 -> 10.3 cards, because everyone commits more cards per round overall.

Also worth having on record: in the **shipped** game the energy gap already scales hard with table size —
**3.0 / 5.2 / 6.1 / 7.9** cards (2p/3p/4p/6p) between richest and poorest living player. At six players the
leader sits ~8 energy ahead, which compounds with the 1.6-1.9x initiative concentration. **Attack jab-round
LENGTH, not the jab's payoff** — the cantrip failed precisely because it paid the jab instead of shortening it.


### 0c. `mpsim` / `analysis` are NOT deterministic — never trust a single run. (2026-08-24)
The **engine** takes a seeded rng; the **AI does not**. `ai.js` calls bare `Math.random()` in five places
(`pickRandom`, the persona `grudge` roll, `FOCUS_LEAN`, `drawPersonas`). So the same command with the same seeds
gives different answers. Measured, three consecutive `node mpsim.js 1200 knight` runs put Pure Cleric at
**28.0% / 24.9% / 24.1%** in the 6-player table — a ~4-point spread on identical input, well beyond the ~2-point
sampling error at 360 games per deck.

This invalidated a conclusion in the very session that found it: a `DRAW_PER_ROUND = numPlayers` A/B looked like
it tightened the 6-player spread from 18.5 to 14.4 points, but the 18.5 baseline was simply a high outlier and
the "improvement" sat inside run-to-run noise.

**So:** for any per-deck claim, run each arm **3+ times and compare ranges**, or seed the AI. Prefer a
**within-game paired** design where possible — `passsim.js` and `personasim.js` both put the arms in the *same*
games, which cancels this entirely and is why their numbers are trustworthy at one run. `personasim.js` also has
a `control` mode that measures the noise floor directly; there is no equivalent for `mpsim` yet.


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
