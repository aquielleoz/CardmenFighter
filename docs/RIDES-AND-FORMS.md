# Cardmen Fighter — Rides & Form Changes (rework design — filled in)

*Design doc for the J/Q/K layer of the 2-as-apex rework. Boost slots filled by Aj; corrections and
clarifications from review folded in.*

> ⚠️ **This is a design/rationale doc, not the source of truth.** For the exact live card text, the authoritative
> reference is **`CARD-LIST.md`** (auto-generated from `engine.js` — run `node gen-cardlist.js` to refresh).
> Some sections below were superseded after playtest/balance work:
> - **Transform economy is now FREE · draw 1 · table-gated** (thresholds **ROAR** J / **OVERDRIVE** Q / **REDLINE** K), *not* "10 energy." The "10 energy" prose below is the original locked design that data replaced.
> - **Fighter Form boosts were later swapped** (Meleager King now carries Hero's Javelin +2; Hippolyta Queen carries Armor Piercing → Quick).
> - **Sanctuary** now heals *every* player +1 (symmetric). **Ares Wheel** draws **6**, not 10. **Instant Recovery** base draws **1**. **Fighter #6** is **Superior Training** (a dig), replacing Discombobulate.

---

## The concept

They're **Kamen Riders**. The new J/Q/K cards are the Rider gimmicks:

- **J = Ride** (the Mount / motorcycle) — one per suit.
- **Q = Form Change** · **K = Form Change** — one each per suit (two forms per suit).
- New zone: the **Forms & Rides Zone**, holding the Ride + any Form Changes.
- **Form Change:** when played it goes to the zone and **empowers a set of your cards** (they gain boosted
  effects) while it sits there.
- **Super Mode:** a **Ride + 2 *different* Form Changes** in the zone unlocks it — a third, **top-tier**
  boost that **supersedes** the Form-level boosts.

**Why it's clean:** J/Q/K are *modifiers of existing cards*, not 12 new effects. One boost-layer to tune.

### Activation rule (locked)

- **J / Q / K each cost 10 energy to activate.**
- Activating **moves the card into the Forms & Rides Zone**, where it grants its buff for as long as it's there.
- Zone cards **do not decay** like Equipment (no counters).
- So: one Form = 10 energy + a card + a turn. Full **Super = Ride + 2 Forms = 30 energy** plus three cards
  and the tempo. That steep cost is the built-in balance — "transform now vs. fight now."

**Variation (parked):** Forms still *expire*, but only once their boost has actually been **used** — a
one-shot window rather than a permanent fixture. Costs bookkeeping (track "has this Form fired yet?"). Decide
later; the locked rule above is the baseline. Note: since ramp didn't give Wizard an edge pre-rework even at
10-cost, the expensive activation looks affordable enough to be worth testing as-is.

---

## Where these sit in the 2-as-apex ladder

low → high: `3  4  5  6  7  8  9  10  [J Ride]  [Q Form]  [K Form]  [A]  [2]`

- **3–10:** current effects stay on their numbers.
- **1 → A (locked):** the current "1" effect follows it to the Ace slot (2nd-highest) — and it still
  activates at **cost 1**. A cheap, powerful effect riding a near-apex fight card. (See balance flag below.)
- **2 → apex (locked):** 2 becomes a **pure high-value trump with no activated effect.** STOPPER is retired
  as a card technique — being the top card, 2 is *inherently* the stopper. The reframe lands: "the strongest
  card is the stopper" is now a property of the value system, not a played effect. The four old STOPPER cards
  (Skillful Teleport, Divine Intervention, Masterful Block, Sleight of Hand) become vanilla apex trumps.
- **J / Q / K:** the only *truly new* cards.

---

## Decisions

**Locked:**

1. **Removal / interaction — YES, and it's the control suits' job.** The zone is strippable: Wizard's
   *Forceful Strip → Ride* (Athena → *Form*) and Rogue's *Sabotage → Ride* reach into it. So a Super is not
   unkillable — but only Wizard and Rogue can dismantle one. Fighter and Cleric have no zone interaction and
   must race a transform instead of answering it. (Intended asymmetry: control polices transformation.)
2. **Boost type — defined per-card upgrade.** Each Form names specific cards → specific upgraded effects.
3. **Super stacking — supersede.** The Super tier replaces the Form boost on any card it also touches.
4. **No suit-matching anywhere.** A Q/K grants its printed boosts **regardless of its own suit** — each Form
   is self-contained. You do *not* need a matching Ride or matching deck to use it.
5. **Super Mode trigger — any J + any Q + any K in the zone.** One of each *rank*, suits irrelevant. So a
   dual deck can run J♦ + Q♥ + K♠ and still reach Super.
   - **Mixed-suit Super (locked):** in a mixed-suit zone, each Form upgrades to *its own suit's* Super tier —
     e.g. Q♥ + K♠ under Super gives you **Apollo** boosts (Cleric cards) **and Hermes** boosts (Rogue cards)
     at once; the J is just the key that flips Super on. A suit's Super (Athena, etc.) applies only if that
     suit's Q or K is actually in the zone.
   - **Balance alt to try later:** if two simultaneous Supers prove too strong, fall back to a *single*-Super
     gate (only one Form's Super applies, or tie the Super to the Ride's suit). Test during tuning.

6. **Fight-or-transform — dual-purpose.** Every J/Q/K can *either* be played as a plain high fight card (its
   ladder value) *or* be activated for 10 energy into the zone. "Do I fight with my King or transform with
   it?" is a live decision every turn, and it keeps the setup cost real — the card you spend transforming is
   a card you didn't swing with.

*(All design decisions are now locked — no open items.)*

---

## The Rides — two mirrored pairs

Rides stay **distinct from Equipment**: Equipment = ± to your combat number; Rides = tempo / cost / value
benders, and the **Super keystone**. They landed as two clean mirror pairs:

| | Cost-benders (control) | Value-benders (combat) |
|---|---|---|
| **You** | **Giant Owl (♦)** — your first effect each turn costs 1 less | **Giant Boar (♣)** — your plays fight as +1 value, **on your turn only** (helps you *beat* an opponent's play; does **not** apply on their turn) |
| **Them** | **Giant Ram (♠)** — opponents' first effect each turn costs 1 more | **Giant Swan (♥)** — your plays count as +1 value **on Rival turns only** (purely *defensive* — protects your plays; does **not** help you beat theirs) |

> **"Plays" = the jabs and specials you fight with — not effect activations.** Boar is the attacking buff
> (your turn), Swan is the defending buff (rival turn); they're deliberately one-sided mirrors.

---

## ♦ Wizard — Tempo / Energy

| # | Name | Effect (current) |
|--:|------|------|
| 1 | Gather Energy | top 3 of deck → Energy |
| 2 | Skillful Teleport | **STOPPER** |
| 3 | Telekinesis | Rival discards 2 |
| 4 | Counter Spell | **Quick** — counter a Technique |
| 5 | Infuse with Magic | +4 to next play |
| 6 | Back to the Books | draw 3 |
| 7 | Forceful Strip | return an Equipment to hand |
| 8 | Cursed Pendant | Equipment — Rival highest −2 |
| 9 | Leyline Ascension | **Quick** — can't-lose-round  ⤵ *(recycle moved to Athena)* |
| 10 | Phantasmal Illusion | copy a Special into a bigger one *(AI must be fixed to cast this)* |

- **Ride — J♦ · Giant Owl:** your first effect each turn costs 1 less to activate.
- **Queen Form — Q♦ · Penelope:**
  - Gather Energy → top **4** → Energy
  - Counter Spell → counter a Technique **or Equipment**
  - Forceful Strip → return an Equipment **or Ride**
- **King Form — K♦ · Odysseus:**
  - Infuse with Magic → **+5**
  - Back to the Books → draw **4**
  - Phantasmal Illusion → copy special **+ value +1**
- **Super — Athena** *(supersedes; tune post-build — reads thinner than the other Supers):*
  - Forceful Strip → return an Equipment **or Ride or Form**
  - Leyline Ascension → **Quick** — **recycle + can't-lose-round**

## ♥ Cleric — Mid / Value

| # | Name | Effect (current) |
|--:|------|------|
| 1 | Imbue with Power | +2 to next play |
| 2 | Divine Intervention | **STOPPER** |
| 3 | Pray for Strength | top 5 of deck → Energy |
| 4 | Pray for Guidance | draw 2 |
| 5 | Annoint | **Quick** — protect an Equipment |
| 6 | Divine Tactics | +5 to next play |
| 7 | Plead for Peace | Equipment → its owner's Shuffle |
| 8 | Holy Bow | Equipment — your highest +2 *(renamed from Holy Sword)* |
| 9 | Holy Shroud | Equipment — absorb a shield loss / the kick |
| 10 | Sanctuary | **every player** gains 1 shield *(symmetric — a wash on the race; the nerf)* |

- **Ride — J♥ · Giant Swan:** your plays count as +1 value on Rival turns (defensive only — see note above).
- **Queen Form — Q♥ · Cassandra:**
  - Pray for Strength → top **6** → Energy  *(was a typo as "5"; corrected)*
  - Annoint → protect **and add 1 counter** to that Equipment
  - Holy Bow → your highest **+3**
- **King Form — K♥ · Hector:**
  - Imbue with Power → **+3**
  - Pray for Guidance → draw **3**
  - Sanctuary → **Quick**
- **Super — Apollo** *(supersedes; tune post-build — compounds with Cleric's catch-up tilt, watch closely):*
  - Holy Bow → your highest **+4**
  - Sanctuary → **Quick** + can't lose a shield until end of round

## ♣ Fighter — Aggro

| # | Name | Effect (current) |
|--:|------|------|
| 1 | Prepare for Combat | draw 2 |
| 2 | Masterful Block | **STOPPER** |
| 3 | Brilliant Tactic | +2 to next play |
| 4 | Disarm | Equipment → owner's Energy, effects off |
| 5 | Superior Training | dig top 3: 2 → Energy, draw 1 *(replaced Discombobulate; a filter that feeds Energy, not raw draw)* |
| 6 | Hero's Javelin | Equipment — your highest +1 |
| 7 | Armor Piercing | next win strips +1 shield  ⤵ *(Quick moved to Meleager)* |
| 8 | Instant Recovery | recycle Shuffle → deck, draw 1 |
| 9 | Spiked Armor | Equipment — Rival highest −2 |
| 10 | Ultima Attack | Rival loses 1 shield |

- **Ride — J♣ · Giant Boar:** on your turn, your cards fight as +1 value (offensive only — see note above).
- **Queen Form — Q♣ · Hippolyta:**
  - Prepare for Combat → draw **3**
  - Armor Piercing → **Quick**
  - Instant Recovery → recycle **Discard + Shuffle** → deck, draw 1
- **King Form — K♣ · Meleager:**
  - Brilliant Tactic → **+3**
  - Hero's Javelin → your highest **+2**
  - Spiked Armor → Rival highest **−3**
- **Super — Ares** *(supersedes):*
  - Instant Recovery → **the Wheel**: shuffle your hand + Discard + Shuffle back into the deck,
    **draw 6 fresh cards**
  - Ultima Attack → Rival loses **2** shields

## ♠ Rogue — Control / Disruption

| # | Name | Effect (current) |
|--:|------|------|
| 1 | Outbalance | Rival discards 1 |
| 2 | Sleight of Hand | **STOPPER** |
| 3 | Hand-to-Hand Mastery | draw 2  ⤵ *(Quick moved to Perseus)* |
| 4 | Poison the Air | everyone's Energy → Shuffle |
| 5 | Sabotage | destroy an Equipment |
| 6 | Never Out of Options | dig top 3: 2 → Energy, draw 1 *(shares its dig with Fighter's Superior Training)* |
| 7 | Caltrops | Equipment — Rival highest −2 |
| 8 | Counterfeit | copy a card from the Rival's play |
| 9 | Critical Hit | Rival loses 1 shield |
| 10 | Back Stab | target skips the **whole round**  ⤵ *(Quick moved to Perseus)* |

- **Ride — J♠ · Giant Ram:** opponents' first effect each turn costs 1 more to activate.
- **Queen Form — Q♠ · Pandora:**
  - Outbalance → **look at the target's hand**, they discard **2**
  - Poison the Air → **target Rival's** Energy → Shuffle *(base is symmetric; boost makes it one-sided)*
  - Counterfeit → copy one card **+ value +1**
- **King Form — K♠ · Perseus:**
  - Hand-to-Hand Mastery → **Quick**
  - Sabotage → destroy an Equipment **or Ride**
  - Back Stab → **Quick** *(the round-long lock is now the base card)*
- **Super — Hermes** *(supersedes):*
  - Counterfeit → copy **+ value +2**
  - Back Stab → **Quick and ALL rivals** skip the round *(the Super's add over Perseus is the whole table)*

---

## Base cards nerfed, riders moved into Forms (the ⤵ pattern)

| Card | Base now | Rider lives in |
|------|----------|----------------|
| Leyline Ascension (♦9) | Quick — can't-lose-round | **recycle** → Athena (Super) |
| Armor Piercing (♣7) | next win strips +1 shield | **Quick** → Meleager (K) |
| Hand-to-Hand Mastery (♠3) | draw 2 | **Quick** → Perseus (K) |
| Back Stab (♠10) | skips the whole round | **Quick** → Perseus (K); **all rivals** → Hermes (Super) |

Pattern is coherent: the base stays playable, transforming buys back the spice, and each number stays an
independent tuning knob.

---

## Notes / follow-ups

- **Rogue slot 6 (Never Out of Options)** — now a near-identical twin of Fighter's Superior Training: both
  dig 3, put 2 to Energy, keep 1 (Never Out at cost 6, Superior Training at cost 5). Revisit if the overlap
  feels redundant in play.
- **Phantasmal Illusion AI** — the AI never casts it today, so Odysseus's third boost is dead for AI decks.
  Fix the AI (or reassign that K♦ slot) before trusting sim numbers on Wizard.
- **Apollo & Athena** — flagged for post-build tuning (Apollo likely too strong given Cleric's catch-up tilt;
  Athena likely too thin next to Ares/Apollo). Placeholder-good, not final.
- **Ares "Wheel"** — new engine primitive: recycle **hand → deck** (we've only ever pushed to `removed`/
  `shuffle`, never pulled the hand back). Draw a fresh 10 into MAX_HAND=10.
- **Cost-bender Rides (Owl / Ram)** — need a per-activation energy-cost system the zone can bend ±1; distinct
  from the flat 10-energy activation cost of J/Q/K themselves.
- **Value-bender Rides (Boar / Swan)** — persistent, one-sided combat modifiers keyed to whose turn it is.
- **Ace at cost 1 (balance flag)** — A is the 2nd-highest fight card *and* fires the old "1" effect for just
  1 energy (Gather Energy / Imbue / Prepare for Combat / Outbalance). With Giant Owl's −1, that effect is
  effectively free. A near-apex trump that also ramps/draws/disrupts for nothing is efficient — watch it.
- **Catch-up interaction** — v0.82 run had Cleric #1 (~60%) and Rogue at the bottom. Form boosts that pile
  onto Cleric's shield engine (Sanctuary/Apollo) or Wizard's ramp compound with that. Re-run
  `node analysis.js` once the layer exists and tune against the *new* numbers.

### v1.31.4 — the ♠ lockout line, re-laid

Base Back Stab was a turn-skip that nobody cast, and the two Forms above it spent their boosts re-buying
things the base could have had. The line now escalates along one axis each step: **base buys a round off one
rival, Perseus buys the timing (Quick), Hermes buys the table (all rivals).** Pandora's Outbalance gained the
**hand read** that makes the timing decidable — you can now see whether the rival you are about to silence
actually holds an answer. The AI's version of that judgement is `lockoutWorth` in `ai.js`; measured
balance-neutral (8 runs/arm, nothing over 3σ across 44 deck comparisons).
