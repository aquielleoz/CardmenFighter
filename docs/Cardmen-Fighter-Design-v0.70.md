# CARDMEN FIGHTER — Design Doc

A dueling trading-card game whose combat engine **is** Chikicha (ChikiChampions), adapted. Two Cardmen
Fighters duel; every card is dual-purpose — **fight** with it (it becomes energy) or spend energy to
**activate** its effect. Strip the opponent's shields to zero, then land the finishing **Fighter Kick**.

> This doc reflects the implementation as of **v0.70**. Companion docs:
> **PATCHNOTES.md** (balance principles + patch log + current snapshot), **STACK-DESIGN-v0.53.md** (the priority
> stack), **NEXT-SESSION.md** (backlog). Card values/effects are still being tuned by Aj.

---

## 1. Win condition
- Each Fighter starts with **4 shields**. Shields absorb hits.
- You strip an opponent shield by **winning a SPECIAL fight** (−1 shield). *(Special = any multi-card
  combo; see §7.)*
- **Jab fights** (single cards) never damage shields — their payoff is **energy** (every fought card
  becomes energy).
- At **0 shields**, the **next Special you win** lands the **Fighter Kick → they explode → you win.**
- **Deck-out (Magic-style):** you also lose if it's your turn to lead a fight and you have no cards left
  (deck, shuffle pile, and hand all empty). Fought cards only recycle when you *spend* them as energy, so
  hoarding energy can starve your own deck.
- First build: **1-v-1 vs AI**, with three AI strengths (Minion / Fighter / Demon Lord).

## 2. Components (per player)
- **Nothing is shared.** Each fighter has their **own** deck, hand, energy pile, shuffle pile, equipment
  zone, and shields — two independent 40-card decks that never mix (every pile is player-scoped).
- Card **values are 1–10** — **1 is the lowest, 10 the strongest single.**
- **4 shield tokens.** Start hand **6**; draw **2** each round; hand cap **10** (trimmed at Clean-up, §7).
- Zones: **Deck**, **Hand**, **Energy Pile** (fought/spendable cards, face-up), **Shuffle Pile**,
  **Equipment Zone**, **Removed from game**.
- **Pile rules (important):**
  - **Fought** cards → your **Energy Pile**.
  - **Discards** (forced discards, the Clean-up hand-limit trim, Never Out of Options) → your **Energy
    Pile** too. *The Energy Pile is where cards that leave your hand without being spent go.*
  - The **Shuffle Pile** is **only for spent energy** — energy paid to activate effects — plus the couple
    of cards whose text explicitly names it (Counter Spell's countered card; Plead for Peace).
  - **Deck refill:** when the Deck empties, the Shuffle Pile reshuffles to form the new Deck.

## 3. Card anatomy
- Every card = **value (1–10)** + **suit** + a **type & effect** (determined by its suit-archetype, §6).
- **Fight ranking:** `1 < 2 < … < 10`. **No suit ranking** — equal values **tie**; you beat a play of the
  same shape only with a strictly higher value. (Suits still matter for flushes and for which effect a
  card carries.)
- **Activation cost = the card's value** (a 4's effect costs 4 energy; a 10's costs 10). Some pips must be
  paid in the card's **own suit** (the colored part), the rest generic — e.g. a ♦5 = 2♦ + 3 any.

## 4. Card types
- **Technique** (standard): activate → effect resolves → **removed from the game.**
- **Equipment**: sits in your Equipment Zone with a **counter**; most tick down 1 per round and are removed
  at 0. Effects apply **immediately, including the fight they're played in.**
- **Quick** (super-type on a Technique): may be played **in response to any card** — a fight play *or* an
  effect — and can itself be answered (full priority stack, §8). Quicks are also legal to play
  **proactively** on your own turn (they simply fizzle if there's no target).
- **Dual use:** any card can be **fought** (→ Energy) **or activated** (pay energy = its value; a Technique
  leaves the game, an Equipment goes to the Equipment Zone).

## 5. Fighter Energy
- Every card you **fight** goes to your **Energy Pile**; energy available = cards in that pile.
- To **activate** a card, pay energy **equal to its value** by moving that many cards from your Energy Pile
  to your Shuffle Pile.
- Tension: high cards hit hard in a fight but are pricey to activate; low cards are weak fights but cheap
  effects. Spending energy is also what recycles your cards back toward your deck (Energy → Shuffle → Deck).

## 6. Suits are archetypes
Each **suit is an archetype**, and every value 1–10 in that suit carries that archetype's effect:

- **♦ Wizard** — Tempo / Energy (ramp, card draw, counters, value pumps).
- **♥ Cleric** — Mid-range / Value (value pumps, shields, protection, equipment).
- **♣ Fighter** — Aggro (draw, buffs, shield strips, equipment).
- **♠ Rogue** — Control / Disruption (hand & energy denial, equipment removal, lockout).

The full effect on every card is in §9. Suit still drives the **combat** side too (flushes / straight
flushes are same-suit), so a card's suit determines *both* its archetype effect *and* its flush color.

## 7. Round & turn structure  *(Round Anatomy — reflects v0.70)*

**Beginning Phase**
- **Draw Sub-Phase:** each player draws **2** cards (once per round, not per turn). *Round 1 is the
  exception — both open with a **6-card hand** and there's no draw; the 2-per-round draw starts Round 2.*
- Edge cases resolved here: an empty deck reshuffles the Shuffle Pile back in; if a player must **lead
  with no cards** (deck-out), they lose.

**Fight Phase** — the **initiative** holder leads (dice on the first round; the round winner takes it
after). Players alternate turns; a turn is **Main Sub-Phase → Play Sub-Phase**, and turns loop until the
pile stands.
- **Main Sub-Phase.** The **active** player may activate **Techniques & Equipment** they can afford —
  including value-boost techniques that buff their *next* fight play (consumed in the Play Sub-Phase) — and
  may proactively play **Quicks** (a Quick with no target simply fizzles; still legal). The **non-active**
  player may respond with **Quicks**. *(Under the hood this is a full recursive priority stack — a response
  can itself be answered, counter-a-counter, resolving LIFO — §8. The sub-phase model is the simplified view.)*
- **Play Sub-Phase.** The active player does exactly one of: **play a Fight card** (a **Jab** in Round 1; a
  Jab or a **Special** from Round 2), **pass**, or commit matching **Stoppers** (a Technique — 1 vs a single,
  2 vs a pair, 3 vs a trio; 5-card combos can't be Stoppered) to **cancel** the current play and seize the
  initiative. Playing / cancelling ends the turn.
- **Loop.** The next player takes their turn (Main → Play), climbing the pile. When a player **can't or
  doesn't** beat the pile (passes), the play stands and we move to Fight End.
- **Fight End Sub-Phase.** With the winning play standing, both players get a final **Quick** window —
  e.g. the defender springs **Leyline Ascension** to save a shield, or the winner's **Armor Piercing** fires.
  Then the outcome resolves: a **Special** win strips **1 opponent shield** (the **Fighter Kick** if it hits
  0 → game over); a **Jab** win just banks energy. The winner takes initiative for the next round.

**Clean-up Phase** — happens **once, at the end of the round** (not per turn), with **no priority**:
- **Both** players discard down to hand size (**to the Energy Pile**). *A hand may exceed the cap
  **during** a round — from the +2 draw or draw effects — and is trimmed only here.*
- Round-boundary bookkeeping: Equipment counters tick down (Equipment removed at 0); round-long effects
  (pre-fight boosts, shield immunity, guards, an unused Armor Piercing) expire; Counterfeit copies fade.

## 8. Combat engine & the priority stack
- **Values 1–10**, 1 lowest, no supreme card, no wheel.
- **Combos:** single (Jab), pair, trio, **straight**, **flush**, **full house** (trio-ranked; top is
  trip-10s), **straight flush**. **No four-of-a-kind bomb** — same-rank sets stop at trios; the
  "trump-everything" role is handled by **Stoppers** (a Technique, §7) instead. Only cross-type rule: a
  straight flush beats a straight or a flush.
- **Straights:** `1-2-3-4-5` (lowest) up to `6-7-8-9-10` (highest). No wrap-around.
- **No suit tiebreak** — equal-value plays tie (beat only by strictly higher). Five-card hands are
  match-shape (a straight flush may beat a straight or a flush).
- **Round 1 is Jabs only; Specials unlock from Round 2.**
- **The stack (LIFO):** any Technique/Quick played opens a response window for the opponent. A **Quick**
  can be played in response; the responder's Quick can itself be answered (e.g. **Counter Spell** a
  Counter Spell), and the stack resolves last-in-first-out. Uncontested effects resolve immediately.

## 9. The card set (Aug-12 set — 40 cards, one full effect per suit × value)

**♦ Wizard — Tempo / Energy**

| # | Name | Type | Effect |
|--:|------|------|--------|
| 1 | Gather Energy | Technique | Put the top 3 cards of your deck into your Energy Pile. |
| 2 | Skillful Teleport | Technique | **STOPPER** (see §7). |
| 3 | Telekinesis | Technique | Target Rival discards 2 cards. |
| 4 | Counter Spell | **Quick** | Counter target Technique as it's played (→ owner's Shuffle Pile). |
| 5 | Infuse with Magic | Technique | +4 to the value of your next play. |
| 6 | Back to the Books | Technique | Draw 3 cards. |
| 7 | Forceful Strip | Technique | Return target Equipment to its owner's hand. |
| 8 | Cursed Pendant | Equipment (5) | Your Rivals' highest card each fight is −2. |
| 9 | Leyline Ascension | **Quick** | Shuffle Pile → Deck, then half your deck → Energy; you can't lose a shield this round. |
| 10 | Phantasmal Illusion | Technique | Copy 4 cards from the current play + 1 from hand to form a higher same-size Special. |

**♥ Cleric — Mid / Value**

| # | Name | Type | Effect |
|--:|------|------|--------|
| 1 | Imbue with Power | Technique | +2 to the value of your next play. |
| 2 | Divine Intervention | Technique | **STOPPER**. |
| 3 | Pray for Strength | Technique | Top 5 cards of your deck → Energy Pile. |
| 4 | Pray for Guidance | Technique | Draw 2 cards. |
| 5 | Annoint | **Quick** | Target Equipment can't be destroyed or disarmed until end of round. |
| 6 | Divine Tactics | Technique | +5 to the value of your next play. |
| 7 | Plead for Peace | Technique | Put target Equipment into its owner's Shuffle Pile. |
| 8 | Holy Sword | Equipment (5) | Your highest card each fight is +2. |
| 9 | Sanctuary | Technique | Gain 1 shield. |
| 10 | Holy Shroud | Equipment (1, no decay) | If you would lose a shield, remove a counter from Holy Shroud instead. |

**♣ Fighter — Aggro**

| # | Name | Type | Effect |
|--:|------|------|--------|
| 1 | Prepare for Combat | Technique | Draw 2 cards. |
| 2 | Masterful Block | Technique | **STOPPER**. |
| 3 | Brilliant Tactic | Technique | +2 to the value of your next play. |
| 4 | Disarm | Technique | Move target Equipment to its owner's Energy Pile; its effects stop. |
| 5 | Hero's Sword | Equipment (5) | Your highest card each fight is +1. |
| 6 | Discombobulate | Technique | Target Rival discards 2 cards. |
| 7 | Armor Piercing | **Quick** | The next fight you win this round, the Rival loses 1 additional shield (never overkills). |
| 8 | Instant Recovery | Technique | Shuffle Pile → deck, then draw 1. |
| 9 | Spiked Armor | Equipment (5) | The Rival's highest card each fight is −1. |
| 10 | Ultima Attack | Technique | Target Rival loses 1 shield. |

**♠ Rogue — Control / Disruption**

| # | Name | Type | Effect |
|--:|------|------|--------|
| 1 | Outbalance | Technique | Target Rival discards 1 card. |
| 2 | Sleight of Hand | Technique | **STOPPER**. |
| 3 | Hand-to-Hand Mastery | **Quick** | Draw 2 cards. |
| 4 | Poison the Air | Technique | Move every player's Energy Pile to their Shuffle Pile. |
| 5 | Sabotage | Technique | Destroy target Equipment. |
| 6 | Never Out of Options | Technique | Look at the top 4 of your deck; put 2 into your Energy Pile and draw the other 2. |
| 7 | Caltrops | Equipment (5) | The Rival's highest card each fight is −2. |
| 8 | Counterfeit | Technique | Copy a card from the Rival's current play into your hand; play it this round or it fades at round end. |
| 9 | Critical Hit | Technique | Target Rival loses 1 shield. |
| 10 | Back Stab | **Quick** | Play in response. Target Rival skips their next turn — no fights, no Techniques (an effect already in progress still resolves; it does not counter). |

*Cost = value throughout (activating a 3 costs 3 energy, an 8 costs 8, etc.). "Equipment (N)" = N starting
counters. Discards created by these effects go to the **Energy Pile** (§2).*

## 10. Deck-building
- **Base suit per archetype:** Wizard → ♦, Cleric → ♥, Fighter → ♣, Rogue → ♠ (the internal suit letter
  matches its glyph, so a card's ID is truthful — a 5♣ really is a Fighter card).
- **A deck = 40 cards = 4 of every rank (1–10).** **Pure** decks put all 4 copies in one suit; **dual**
  decks split **2 / 2** across two suits.
- **The ten decks:** Pure Wizard / Cleric / Fighter / Rogue, plus the duals **Sage** (Wiz+Cle),
  **Mage Knight** (Wiz+Fig), **Warlock** (Wiz+Rog), **Paladin** (Cle+Fig), **Bard** (Cle+Rog),
  **Berserker** (Fig+Rog). A **Full Set** (all 40 unique cards, one each) is also selectable.
- A card's suit drives **both** its archetype effect **and** its flush color, so a pure deck flushes/straight-
  flushes easily while a dual deck trades that for two effect suites.

## 11. AI strengths
- **Minion** — timid; won't contest your Specials.
- **Fighter** — the standard duelist (default).
- **Demon Lord** — tanky, ramps hard, and saves its STOPPER for real danger.

## 12. Implementation status
- **All 40 effects are live.** The full recursive **priority stack** is implemented (Counter-a-Counter;
  reactive Quicks; the shield-loss response window). Real **card-face art** for ♦ Wizard and ♥ Cleric;
  ♣ Fighter and ♠ Rogue still use the drawn placeholder until art arrives.
- Balance is tracked in **PATCHNOTES.md** (current snapshot: all 11 decks in a ~45–56% band; Rogue is the
  deck to watch, and the recent discards-→-Energy change is a lever on it). Re-measure with
  `node analysis.js 130` after `node test.js` is green.
- Build: `node build.js` inlines `engine.js` + `ai.js` + `art.js` + `faces.js` into `CardmenFighter.html`.
