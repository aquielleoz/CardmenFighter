# Count-up instead of count-down — the "Kick Coin" branch

**Status: OPEN DESIGN QUESTION, nothing built.** Raised 2026-08-25 by Aj's brother; analysed the same day.
Aj's current lean at the end of that conversation: **not a global rules change — make it one CLASS's schtick.**
See "The narrow version" at the bottom, which is where this should probably start.

---

## The proposal

Aj's brother asked why the game has shields at all, and proposed replacing them with a count-**up**:

> Every time someone won, they'd get a **Kick Coin** (losers would still draw a card), and at X Kick Coins they'd
> kick everybody the next time they won a Special fight. Basically a count-up instead of a count-down.

Aj's first-pass translations of the shield-touching cards:
- **Sanctuary** ("every player gains 1 Shield") → take a Kick Coin away from everybody
- **Rogue/Fighter shield-strip techs** → gain a Kick Coin (or +1 on your next Special win)
- **Leyline Ascension** → next time this round a player other than you would gain a coin, they don't

## Why the game has shields today (the honest answer)

Aj's answer was taste — he liked the mechanic in Pokémon, Digimon and Duel Masters. Structurally, though, shields
in *this* game are not HP. They are load-bearing for three other systems:

1. **The catch-up engine.** `setShieldCards(true)`: a broken shield's card returns to its owner's **hand**
   (`engine.js` ~1468). Damage refuels the victim.
2. **The escalation clock.** `TRANSFORM_GATE = 'table'` unlocks Rides and Forms from `shieldsLost` summed across
   the whole table (`engine.js` ~1663). **The J/Q/K layer is gated on shield damage.**
3. **The targeting signal.** A visible "who is nearly dead" is what makes the table choose victims — it is why
   the AI's `weakest` focus exists and why elimination games feel political.

Replacing the counter is easy. Replacing those three jobs is the actual work.

## Checking the translations

**Sanctuary → "everyone loses a coin"** is a clean inversion, and better than it looks. A shield is worth more
at 1 than at 6, so today it is the trailing player's card; minus-one-coin-for-all hurts whoever is nearest X, so
it is *still* the trailing player's card — but it flips from **defensive** to **disruptive**. One wrinkle: at 0
coins it does nothing, so it is dead early and strong late, where today it is live from the first broken shield.

**The attack techs — the mirror Aj picked breaks the symmetry.** Critical Hit and Ultima Attack are *"Target
Rival loses 1 shield."* Mapping them to "gain a coin yourself" converts a **targeted attack into solitaire
ramp** and deletes the interaction. The faithful mirror of *make an opponent lose a shield* is **make an opponent
lose a coin** — same targeting, same politics, card still does what its name says.

**Leyline Ascension and Holy Shroud** are damage-*prevention*. If losing a round costs nothing, there is nothing
to prevent. BUT if coins can be removed (per the Sanctuary reading) they translate cleanly after all:
**"you can't lose coins this round, and the Kick can't resolve."** Re-pointing, not redesigning.

Scope note: this is not three cards. **9 cards mention shields or the Kick (4 defensive, 4 offensive)**, plus the
engine's defensive layer — 9 `absorb` sites, 11 `shieldImmune`, 5 `preventShield`, 9 `cantLoseRound`.

## Tracking — the brother's own objection, and the fix

He pointed out that coins need **physical tracking tokens**, on top of the counters already on equipment,
because shields were represented by cards. Checked, and it is worse than that:

**Every accumulating resource in this game is a pile of cards** — `hand, deck, energy, shuffle, equipment,
removed, forms, shieldPile` — and `shields` is literally `shieldPile.length`. Equipment counters are the only
non-card counter, and they are *timers* that count down and retire **into energy**, so even they resolve back
into cards. Kick Coins would be **the game's first pure abstract accumulating token**.

**Fix: make the charge a card zone.** On a Special win, move a card face-up into a Charge zone. That is
self-tracking (count the cards), visible to the table (the political signal a count-up needs), carries a real
cost (charging competes with fighting), mirrors shields structurally (cards you *add to* a pile rather than
*lose from* one), and is dead-on flavour — you are collecting Medals to insert, and the Kick spends them.

## Flavour: what Kamen Rider actually does

The original 1971 Rider Kick is a physical technique, not a charge; it lands at the end for story reasons.
From Heisei onward finishers are explicitly *activated*, and the gesture is almost always **inserting or
scanning a consumable** — Ryuki's Advent cards, Faiz's Mission Memory, W's Gaia Memory, OOO's Core Medals,
Fourze's switch, Gaim's Lock Seeds, Build's Full Bottles, Zi-O's Ridewatches.

**Charge language is everywhere** in the belts — *Exceed Charge* (Faiz), *Full Charge* (Den-O), *Scanning Charge*
(OOO); Ex-Aid's whole conceit is video-game gauges. What is absent is a **visible meter that gates access** to
the finisher: the charge is instantaneous on insert.

So the flavour to reach for is **collecting the components you insert**, not filling a battery. Which is also
what the card-zone fix above produces.

## ⚠️ A bias correction, kept deliberately

The first version of this analysis was **biased toward the existing (shield) design**, which I had spent the
week building. Aj asked me to re-evaluate and four things were wrong:

1. **Taste was dressed up as fidelity.** "Your instinct was faithful to the source" — but Pokémon, Digimon and
   Duel Masters are not Kamen Rider. Copying mechanics you enjoyed is not fidelity.
2. **"The shows have no charge framing" was overstated** — see the belt announcements above.
3. **A criticism the brother had already answered was reused:** "a coin race has no getting-back-up" ignores
   *losers still draw a card*, which fires every round rather than only on a break — arguably more consistent
   than shields-as-cards.
4. **The length objection is not inherent.** "Coins make length scale as N × X rounds" is true only if a win is
   worth ONE coin. The direct mirror of `all` mode — a Special win costing *every* opponent a shield — is that
   **the winner gains a coin per opponent beaten**. At 6 players a Special is worth 5 coins, so charge scales
   with table size and length stays flat. That is exactly the v1.31.0 fix pointed the other way.

**What survives the re-check:** the `TRANSFORM_GATE` dependency; the tracking problem (with the card-zone fix);
the defensive layer needing re-pointing; elimination disappearing (a real trade — nobody sits out, but the table
never shrinks and never accelerates); and one genuine asymmetry — **the leader-snowball is worse under coins.**
Under shields + `all`, a win damages *everyone*, shortening the game without concentrating advantage. Under
coins a win advances *only* the winner, and initiative concentration is already **1.8x** fair share. That one
is real and unaddressed.

## The narrow version — Aj's current lean (2026-08-25)

> "Right now I am just partial to creating a class that likes counting up — that can be that whole class'
> schtick."

This is a much better place to start than a rules overhaul, and **the count-up resource already exists twice
over**, so it needs no new tokens and no new zones:

- **The energy pile already counts up**, is card-backed, and is public information. A charge class could gate its
  effects on **how much energy it has banked** rather than on spending it. That is a real strategic identity with
  zero new mechanics: everyone else spends energy for effects, this class **hoards** it to cross thresholds — and
  the two goals genuinely conflict. Tune against measured reality: mean energy per living player runs ~7-8 at 6
  players today (`optionsim.js`), and ~14 if draw-scaling is ever pushed further.
- **`TRANSFORM_GATE='table'` is already a count-up** — total `shieldsLost` across the table unlocks Rides and
  Forms. The game therefore *already* contains an escalation counter that counts up; a charge class could read
  it, or have its own private version of it.

Open questions for the class version: does its charge sit in energy (no new zone) or a dedicated face-up Charge
zone (clearer, but a new zone)? Does it interact with shields at all, or is it a parallel win condition? And if
it is a fifth class, note the standing backlog item on **suit ≠ class / hybrid classes** — a charge class may
want to be a *hybrid* rather than a new suit, since there are only four suits.
