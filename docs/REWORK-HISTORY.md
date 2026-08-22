# Cardmen Fighter — The Rework: A History

*How Cardmen Fighter went from a 40-card classic duel to the 52-card, 2-as-apex, Kamen-Rider-Forms game
that ships today. This is the narrative arc — the "why" behind the decisions. For the exact current cards
see `CARD-LIST.md`; for the balance-learning principles see `PATCHNOTES.md`; for the live state and open
threads see `NEXT-SESSION.md`.*

---

## Where it started (the classic game, through v0.70)

The original Cardmen Fighter was a two-player dueling TCG built on the Chikicha combat engine. Every card
was dual-purpose: you could **fight** with it (after which it became energy) or spend energy to **activate**
its effect. You won by stripping the opponent's four shields to zero and landing a finishing Fighter Kick.

The deck was 40 cards — ranks 1 through 10 in four suits, each suit an archetype: ♦ Wizard (combo/ramp),
♥ Cleric (midrange value), ♣ Fighter (aggro), ♠ Rogue (control). Rank 2 in every suit was a **STOPPER**:
a reset-the-fight technique that let you seize the initiative. Two catch-up systems kept losing players in
the game — shields were real cards that returned to your hand when broken, and the round's loser milled cards
into energy to match what the winner banked.

By v0.70 the classic game was fully playable and balanced across its eleven decks. Two structural pieces had
also been rebuilt along the way: a proper **recursive priority stack** for responses (Counter Spell, Quick
techniques) designed in `STACK-DESIGN-v0.53.md` and implemented across v0.54–v0.58, and a long balance arc
(`PATCHNOTES.md`) that taught the durable lessons — nerf a deck's workhorse not its finishers, price value
boosts by rate not magnitude, and fix the AI before trusting the numbers.

## The idea: reframe the STOPPER as an apex

The rework began with a single design itch: the STOPPER on rank 2 was mechanically strong but conceptually
odd — a "2" that reset fights. The reframe was to make the **2 the apex of the fight ladder** instead. Rather
than a technique, the 2 simply became the single highest fight value in the game — a vanilla trump. STOPPER
retired as an activated effect.

Once the 2 was the top of the ladder, the natural move was to open the deck all the way up. The rework
expanded to a full **52-card deck** — 13 ranks per suit — with a new ordering:

```
3  4  5  6  7  8  9  10  J  Q  K  A  2
low ───────────────────────────────► apex
```

The Ace keeps its old rank-1 effect (at cost 1) but now sits second-from-top on the ladder — a near-apex
trump that also ramps, draws, or disrupts cheaply. And the three face cards, J/Q/K, became something entirely
new.

## Kamen Riders: the Rides & Forms layer

The face cards are the Rider gimmicks. Instead of being played only as high fight cards, a J, Q, or K can be
**transformed** — moved into a persistent **Forms & Rides Zone** where it stays (no decay, unlike Equipment)
and empowers a set of your cards for the rest of the game:

- **Ride (J)** — a persistent, always-on battlefield modifier (Giant Boar's +1 on your turn, Giant Swan's
  defensive +1, Giant Owl's cost reduction, Giant Ram's tax on the opponent). Also the keystone for Super.
- **Queen Form (Q)** and **King Form (K)** — each upgrades a handful of that suit's base cards while it sits
  in the zone (Cassandra, Hector, Hippolyta, Meleager, and so on).
- **Super Mode** — hold a J *and* a Q *and* a K in the zone at once and you enter your archetype's Super
  (Athena / Apollo / Ares / Hermes), whose boosts supersede the individual Forms.

The design is deliberately suit-agnostic on activation but suit-loyal on payoff: any Form empowers only its
own suit's cards, so a mono-suit deck gets the cleanest Super. Every J/Q/K stays dual-purpose — a live "fight
with it now, or transform with it" decision on every turn. `RIDES-AND-FORMS.md` holds the full boost tables;
`BUILD-PLAN-v0.82.md` was the phased implementation plan that kept the shipped game working the whole way.

## The transform-economy saga (v0.84)

The hardest design question wasn't *what* the Forms did — it was *what transforming should cost*. The first
locked answer was simple: **each J/Q/K costs 10 energy to activate**, so a full Super was 30 energy plus three
cards plus the tempo. That steep price was meant to be the built-in balance.

Data disagreed. Running thousands of AI-vs-AI games with A/B hooks surfaced three findings that reshaped the
whole economy:

1. **The real cost of transforming was never the energy — it was giving up a value-11-to-13 fight card.**
   Spending your King on a Form means you can't fight with a King. That opportunity cost is the actual price;
   the 10 energy was double-taxing it.
2. **Boost magnitude is not the balance lever.** Tripling every Form boost moved win rate by about 0.1
   points. The boosts are flavor; they don't decide games.
3. **Card economy is what makes transforming viable.** A small draw attached to the transform — a refund that
   replaces the spent fight card — is what turns it from a trap into a real choice.

So the economy converged, empirically, on **free · draw 1 · table-gated**. Transforming costs no energy, draws
one card, and unlocks only once the *table* has bled enough shields — total shields lost across all players
must reach players × tier (in a duel: J at 2 lost, Q at 4, K at 6). That gate stops turn-one transforms and
makes Forms an escalation you earn as the fight heats up. Measured, it lands transformer-versus-non-transformer
right around 50% — a genuine decision rather than a no-brainer or a trap — with the first transform usually
around round five or six. All of it stayed tunable (`setTransformCost/Draw/Gate`, `setBoostScale`).

## Going live, and the polish pass

With the economy settled, the rework stopped being a flagged experiment and **became the game**. The playtest
toggle was removed, `E.setRework(true)` went default-on, and the card gallery grew to show all 52 cards in
ladder order. A cluster of smaller changes landed alongside: the Fighter's Hero's Sword was renamed **Hero's
Javelin**, its Form boosts were swapped (Armor Piercing → Quick moved to the Hippolyta Queen; Hero's Javelin +2
moved to the Meleager King), and **Phantasmal Illusion** (the Wizard's Odysseus payoff) finally got its
+value implementation.

Two pieces of presentation polish made the Forms legible in play. The transform thresholds got **named and
announced** — as the table bleeds, a center-stage banner fires **ROAR** (J unlocked) → **OVERDRIVE** (Q) →
**REDLINE** (K), a bike/engine escalation that still fits a beast-mount Rider. And J/Q/K cards in hand now
**pulse gold** the moment they can actually be transformed, so the option reads at a glance.

## The balance era (v0.85)

With the rework shipped, tuning turned to the deck spread.

**Cleric came down first.** Pure Cleric was dominating around 65%, and the culprit was **Sanctuary** — a free
personal +1 shield the AI auto-cast every chance it got. The fix matched the design instinct that a free shield
was mindless: Sanctuary now heals **every** player +1, making it a wash on the shield race and therefore a real
decision instead of a reflex. Cleric fell to a healthy ~48–50%, and Sanctuary's own win-correlation dropped from
~52% to ~39% (the AI now casting it mostly when it's already behind).

**Fighter was the harder problem, and it produced a new durable lesson.** Pure Fighter was winning ~60–62%
against the entire field. The intuition was that its persistent Equipment (Hero's Javelin, Spiked Armor) was
carrying it — but a 4,000-game harness proved otherwise: zeroing both equips cost only ~2.6 points. No single
subsystem was the driver. Disabling its draw engine cost ~3.7 points, its equipment ~2.1, its shield finishers
~0.3 — each alone left Fighter near 60%. Only removing draw *and* equipment *and* finishers **together** finally
dropped it below even (47%). The kit is **redundant**: three overlapping win engines that substitute for each
other, so no one nerf can crack it. (This became Principle 6 in `PATCHNOTES.md`: if every single-lever nerf
reads ~2 points, the deck's strength is redundancy — measure combined removal to find the real floor.) The
harness also confirmed a design smell — Fighter, the melee class, was drawing about 4.5× more cards than any
other archetype.

A first pass at the draw suite followed, reshaping Fighter and Rogue's card-advantage toward *selection* rather
than raw churn: Fighter's Discombobulate became **Superior Training** (dig the top 4, keep 1, feed 3 to Energy),
Instant Recovery's draw dropped 2→1, the Ares Wheel dropped a fresh-10 to a fresh-6, and Rogue's Never Out of
Options tightened from dig-4/keep-2 to dig-3/keep-1. Honest result: it barely moved Fighter (~62% → ~61%),
because Superior Training re-added a draw source. The measurement pointed at the real lever — Fighter's
**Instant Recovery reclaim** (shuffling the discard back into the deck is deck-out insurance no other class
has) — which is the next thing to cut or gate.

## Where it stands

The rework is the shipped game (v0.85). The open threads, roughly in priority order: bring **Fighter** to ~50%
by trimming its reclaim engine rather than its equipment; keep an eye on **Cleric** and the low-sitting
**Wizard** (~44–45%); add the per-Form draw differences that are still on the base draw-1 for every Form; and
the long-standing content items — **Fighter ♣ / Rogue ♠ art** (still placeholder faces), the parked
**"Rival: Aj" signature AI**, and the **"Forms expire once their boost is used"** variation.

The through-line of the whole rework: the design decisions that mattered were settled by measurement, not by
intuition. The 10-energy cost, the boost magnitudes, the "equipment must be what makes Fighter strong" — each
felt right and each was wrong. The game that shipped is the one the data kept pointing at.
