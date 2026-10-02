# Cardmen Fighter — The Second Set of Classes (design draft)

*Drafted 2026-09-24, revised the same day after Aj's Norse and Ride decisions. Pure design: nothing is built.
Filed as a draft for Aj to review. The numbers are measured on the CURRENT game (knight AI, shipped rules,
random class decks) by `code/classprobe.js` and `code/transformprobe.js`, which only read `engine.js`/`ai.js`;
they size the keywords, they do not balance the cards. Every cost, threshold and counter count below is a
first guess for a sim to move.*

*Open rulings for Aj are marked ⚖. Designs Aj asked to keep in reserve are under "Back pocket".*

---

## 1. What a suit is

**The hard answer: a suit is a colour of energy.** About half of a card's cost must be paid in its own suit's
energy (a ♦5 is 2♦ + 3 any; transforms are all generic). That is the one place a suit is mechanically
load-bearing besides choosing the effect table, and it is what makes two classes in one suit coherent: a
class is a way of *spending* a colour. Wizard + Alchemist has no colour tension; Wizard + Fighter does.

**The soft answer: four poles, four shared regions.** Every effect faces somewhere and bends something.
Read the 36 effect cards that way and the suits fall out as poles:

| pole | suit | tarot | the law the current cards keep |
| --- | --- | --- | --- |
| **the self** | ♥ | Cups (water) | never strikes a shield |
| **the economy** | ♦ | Coins (earth) | the only suit that can say no to an effect |
| **the rivals** | ♠ | Swords (air) | never raises its own number |
| **the fight** | ♣ | Wands (fire) | owns no protection and no base Quick — it races |

Between neighbours sit four shared regions. Every suit lives in exactly two:

| region | owned by | what lives there today |
| --- | --- | --- |
| **KEEP** (self × economy) | ♥ ♦ | ramp (Gather Energy / Pray for Strength), digs, shield protection (Leyline / Holy Shroud) |
| **TAKE** (rivals × economy) | ♦ ♠ | hand attack (Telekinesis / Outbalance), counter and tax (Counter Spell / Giant Ram), equipment removal, copying from the table (Phantasm / Counterfeit) |
| **BREAK** (rivals × fight) | ♠ ♣ | debuffs (Caltrops / Spiked Armor), shield strips with the Broadway price (Critical Hit / Ultima), lockout, the extra strip |
| **GROW** (self × fight) | ♣ ♥ | boosts (Brilliant Tactic / Imbue), buff equipment (Javelin / Holy Bow), adding counters |

The Rides say the same thing in miniature: Owl and Ram bend costs (the economy poles), Boar and Swan bend
fight values (the fight-facing pair). Opposite poles share nothing: ♥/♠ and ♦/♣ never appear in the same
region. Bard and Mage Knight are the decks built of opposites.

**Strays, honestly.** KEEP's cheap forms (draw, small digs) are universal; that matches "some aspects are
shared by every class". The genuine strays are Infuse with Magic (♦ in GROW), Cursed Pendant (♦ in BREAK) and
Plead for Peace (♥ in TAKE). Wizard is the "Combo" class and reaches across. None of them move: this is a lens
for the new set, not a cleanup of the old one.

### How one effect belongs to more than one suit

1. **A verb belongs to a region, and every region has two suits.** Only the poles are exclusive: shield gain
   and absorb (♥), the hard counter (♦), lockout and energy denial (♠), the extra strip on a win (♣).
2. **When two suits share a verb, the suit shows in the object, destination, direction, price or condition.**
   The four equipment removals are the textbook: ♦ returns it to hand, ♥ to the Shuffle Pile, ♣ to Energy,
   ♠ destroys it. Copying: ♦ conjures the whole play for itself, ♠ steals one card out of it.
3. **A suit may borrow a verb through its Forms that it cannot own at base.** Every ♣ Quick is Form-granted
   (the ⤵ pattern in `RIDES-AND-FORMS.md`).

**The failure mode is the twin**: same verb, same price, same destination. Ultima Attack and Critical Hit are
identical; Superior Training and Never Out of Options nearly so. A dual deck holding both gets redundancy, not
richness. Rule for the new set: **no card may be a twin of any of the other 43**, in its own suit or a
neighbour's — a shared verb must differ in at least one of object / destination / direction / price /
condition.

### The tarot fold-in — what to take and what to leave

Etymology makes the mapping free: the French suits descend from the Latin ones (batons→♣, cups→♥,
coins→♦, swords→♠; "spade" is Italian *spade*, swords). Three touches are real:

- **Coins settles an old argument.** The Magic analogy called ♦ the draw class and `DECISIONS.md` corrected it
  to the ramp class. Coins is wealth and building; tarot never makes that mistake.
- **Active/receptive is protection/destruction.** Fire and Air are tarot's active pair; the game's shield
  destruction lives only in ♣♠. Water and Earth are receptive; shield protection lives only in ♦♥. The law
  behind the whole `loss=all` study falls on tarot's oldest line.
- **The "blocked" states are designed weaknesses.** Wands burn out (the Fighter races with no protection);
  Coins hoard (the Alchemist starves its own deck); Swords freeze (Rogue is the most value-stuck deck we
  measured — cuts everyone down, never builds itself up); Cups drown (Sanctuary heals your enemy). **A new
  class should die of its own excess**, not of a hole another suit fills.

One line does not touch: tarot's elemental dignities call Fire/Water and Air/Earth enemies, and the game makes
those pairs allies (GROW, TAKE). But look at the alliances — Boar and Swan are one +1 pointed opposite ways;
Wizard counters the Rogue's tricks while Rogue strips the Wizard's transforms. Tarot's enemies are the game's
uneasy allies. **Take the psychology, leave the elemental physics, import no iconography**, and never let it
near a balance number. The Rides do not carry the elements either: a beast named for what the class *does*
beat a beast dressed in an element (below).

---

## 2. The second set — four economies

The first four classes are **temperaments** (aggro / combo / midrange / control). The second four are
**economies**: each lives on a number the game already has and nothing reads. Two of them are mirror images
of each other, which the measurements below made obvious rather than clever.

**Naming: Norse, one pantheon per set.** Set one is Greek (Giant animal · two mortals · an Olympian); set two
is Norse (a **named beast** for the Ride · two **saga heroes** for the Forms · a **god** for the Super). The
persona roster already works this way — Arthurian squires and knights, boxers, Disgaea demons, one universe
per tier — so this is the game's own habit one level up, and a third set gets a third mythology. Anglicised,
as set one is (Odysseus, not Ὀδυσσεύς): Fafnir, Jormungandr, Volund, Egil. The first set's Rides are **not**
retro-named: "Giant Owl" against "Fenrir" tells a player which set a class is from, and those names are in
shipped tutorial text.

**The four Rides are two mirror pairs, on the same suit axes as set one.** Owl/Ram are ♦↔♠ and Boar/Swan are
♣↔♥; here Saehrimnir/Sleipnir are ♦↔♠ on *the fate of a Technique* and Jormungandr/Fenrir are ♥↔♣ on *the
identity of a shield*. Each pair is one verb pointed two ways, the economy Owl and Ram already have. Neither
dimension is touched by anything in set one.

**Set-two transforms dig instead of drawing.** A first-set transform draws 1; a second-set J/Q/K entering the
zone lets you **look at the top 2 cards of your deck, keep 1, and put the other into your Shuffle Pile.** A
filtered draw — quality up, count unchanged, the reject feeds the reshuffle — and a new destination for a dig
(every existing dig banks its rejects). It is set two's texture, arguably a hair stronger than set one's, and
the guard is in §5.

### What the current game measures (the numbers the keywords are sized against)

Two probes, knight vs knight, shipped rules, 400 duels and 250 games each at 4p and 6p:

| at the acting player's turn | 2p | 4p | 6p |
| --- | --- | --- | --- |
| mean Energy Pile | 7.4 | 9.4 | 12.0 |
| bank ≥ 8 | 46% | 55% | 63% |
| bank ≥ 10 | 33% | 45% | 56% |
| bank ≥ 12 | 21% | 35% | 47% |

Duel bank by round: 1.3 at r2 → 6.3 at r4 → 9.7 at r6 → ~10 from r8. **Everyone is broke for three rounds and
comfortable from round six.** The deck empties around r10–11 in a duel (37% of duels reshuffle, first at
r11) and at r6–8 at a table (100% reshuffle); the shuffle pile that refills it holds ~18 cards at r10 in a duel
because the AI *spends*. A hoarder's would be nearly empty.

| shapes and stakes | 2p | 4p | 6p |
| --- | --- | --- | --- |
| Specials of 3+ cards, share of all Specials | 22% | 57% | 86% |
| rounds 2+ won by a 3+ card Special | 24% | 65% | 85% |
| turns (r2+) with a 3+ card Special in hand | 26% | 63% | 83% |
| lead changed hands, rounds 2+ | 38% | 52% | 60% |
| player-rounds at ≤ 1 shield · at 0 | 30% · 13% | 18% · 9% | 12% · 6% |
| shields lost per living player per round | 0.34 | 0.25 | 0.19 |
| seats reaching a Ride · Super (round) | 89% · 42% (r10.7) | 92% · 39% (r18) | 83% · 33% (r26) |

Two of these overturned a premise I had written down the day before; see §3.

---

### ♦ Alchemist — the bank

*Coins. KEEP + TAKE. The Wizard makes energy and spends it; the Alchemist is paid for holding it.*

**Keyword — Charged:** 10 or more cards in your Energy Pile as you cast (checked before paying). Cheap Charged
cards keep you charged; expensive ones drop you out. Every activation is spend-or-hold. This is the parked
count-up class with no new zone: the bank is already public and card-backed.

**Dies of its own excess:** spent energy is what refills the deck, so a hoarder starves — measured, the deck
runs out at r10–11 in a duel and r6–8 at a table, and the Alchemist has nothing to reshuffle. It *must* spend
on a clock. Poison the Air and Pandora wipe the bank (Rogue polices the Alchemist, as control already polices
transforms), and a rich rival simply pays the Leaden Ward tax.

| # | Name | Effect |
| --- | --- | --- |
| A | Transmute | Put the top 2 cards of your deck into your Energy Pile. Charged: the top 3. |
| 3 | Catalyst | Your next play is +1. Charged: +3. |
| 4 | Leaden Ward *(Quick)* | Counter target Technique unless its owner moves 3 more cards from their Energy Pile to their Shuffle Pile. |
| 5 | Assay | Look at the top 3 cards of your deck. Put any number into your Energy Pile and the rest into your hand. |
| 6 | Overflow | Draw 2. Charged: draw 3. |
| 7 | Ward of Stone *(Quick)* | Charged only: you can't lose a shield this round. |
| 8 | Mother Lode *(Equipment, 3 rounds)* | At each upkeep, put the top 3 cards of your deck into your Energy Pile. |
| 9 | Gilded Blow | Your next play is +3. Charged: +6. |
| 10 | Philosopher's Stone *(Equipment, no decay)* | While equipped, you are Charged. |
| 2 | Draupnir | *apex — no effect (the ring that drips new gold)* |

- **Ride — Saehrimnir** (the boar eaten every night in Valhalla and whole by morning): while in your zone,
  the first Technique you activate on each of your turns goes to your Shuffle Pile when it resolves instead of
  leaving the game. *A ward cast in a rival's window is not on your turn and does not come back — the right
  edge for the class to feel. Nidhoggr, who eats the dead, is the famous name for the same idea.*
- **Queen — Regin Form** (the smith who reforged the sword): Transmute 3 / Charged 4 · Leaden Ward's tax is 5 ·
  Overflow also banks 1 when Charged.
- **King — Volund Form** (the master smith of the Edda): Catalyst +2 / Charged +4 · Mother Lode banks 4 ·
  Assay looks at 4.
- **Super — Odin Mode** (hoarder of wisdom: the mead, the runes, Mimir's well): Leaden Ward counters outright
  and can counter Equipment · Philosopher's Stone also draws 1 at each upkeep.
  ⚖ *Odin also owns sacrifice, which is the Guardian's engine; if you would rather he sat there, the wealth
  gods Freyr or Njord take this seat.*

Notes. Leaden Ward is usually a *tax*, not a counter — banks sit at 6+ on 60–73% of turns — and that is the
design; Regin makes it bite. Philosopher's Stone is Equipment on purpose: Sabotage, Disarm and Forceful Strip
all end it. Saehrimnir complements the kit without erasing the clock: a recycled Technique is one card back
into the cycle, the energy it cost is five to ten. The class will run stronger at big tables (mean bank
7.4 → 12.0), the same tilt Cleric has today; measure the drift before believing the threshold.

---

### ♥ Guardian — shields as a purse

*Cups. KEEP + GROW. The Cleric gains shields and protects them; the Guardian spends and gives them.*

**Keyword — Sacrifice:** move one of your shield cards to your hand. It is **not a shield lost**: the transform
gate does not tick. (Shields are already face-down cards off your deck and a broken one already returns to
hand; the keyword is one sentence.) Half the class rewards *not* spending — that is the tension.

**Dies of its own excess:** at 0 shields one Special loss ends you, and 13% of duel player-rounds are already
spent at 0 by everyone. Direct strips (♣) are the predator; the engine is Equipment, which the TAKE suits
strip.

| # | Name | Effect |
| --- | --- | --- |
| A | Offering | Sacrifice a shield. Draw 1. |
| 3 | Bulwark | Your next play is +1 for each shield you have beyond the first (max +3). |
| 4 | Rampart *(Equipment, 2 rounds)* | If you would lose a shield, remove a counter from Rampart instead. |
| 5 | Aegis *(Quick)* | Until end of round, no player loses a shield. |
| 6 | Bestow | Move one of your shields to target player. If that player is a Rival, draw 3. |
| 7 | Ironclad *(Equipment, 3 rounds)* | Your highest card each fight is +1. Whenever a shield of yours breaks, add a counter. |
| 8 | Bastion *(Equipment, 3 rounds)* | Whenever you sacrifice a shield, put the top 2 cards of your deck into your Energy Pile. |
| 9 | Last Stand *(Quick)* | If you have 1 or fewer shields, your plays fight at +3 until end of round. |
| 10 | Resurgence | Sacrifice any number of shields. For each, draw 2 and put the top 2 cards of your deck into your Energy Pile. |
| 2 | Gjallarhorn | *apex — no effect* ⚖ *or, darker, Mistilteinn — the one thing that got past Baldr's guard, which is what an apex card is* |

- **Ride — Jormungandr** (the ring around the world): while in your zone, your shield cards are face-up to you,
  and when you sacrifice a shield you choose which one. *Offering becomes a tutor — take the shield whose card
  completes your pair, give Bestow the dud. The shields become a second hand.*
- **Queen — Brynhild Form** (the shieldmaiden behind the wall of flame): Offering draws 2 · Aegis also gains you
  1 shield · Bastion banks 3.
- **King — Gunnar Form** (harp in the snake pit): Bulwark max +5 · Last Stand at 2 or fewer shields · Bestow
  draws 4.
- **Super — Baldr Mode** (the one nothing could harm): Aegis also gives every player with fewer shields than
  you 1 shield · Resurgence gains you 1 shield afterwards.
  ⚖ *Frigg, who took oaths from every thing to protect him, is the other reading; Odin if he moves here.*

Notes. Rampart is Holy Shroud on a different clock (Shroud waits forever for one hit; Rampart covers the next
two rounds and leaves) — same verb, different price. Aegis is the shared ward from the `loss=all` study, which
measured balance-neutral on shipped rules, as one class's Quick; in a duel it is a stall that protects both
players, which is what a symmetric card should be. Bestow replaced a buy-a-shield card: water takes the shape
of its container, and it leaves shield *gain* exclusive to the Cleric at base. Last Stand's window is real —
30% of duel player-rounds are at ≤1 shield, 12% at six players.

---

### ♣ Barbarian — the burn

*Wands. GROW + BREAK. The Fighter breaks shields with Techniques; the Barbarian burns its bank to do it, and is
strongest with nothing left. The Alchemist's mirror image.*

**Keywords — Burn N:** move N more cards from your Energy Pile to your Shuffle Pile as an additional cost.
**Spent:** 3 or fewer cards in your Energy Pile (checked as you cast; continuously for Equipment).

**Why this and not "size":** see §3. The bank curve is the real finding — everyone is Spent for the first
three rounds (mean bank 1.3 at r2), so the class is strongest in the opening and must burn to get back there.
That is the aggro curve, measured rather than asserted. Burning is also deck-*healthy* (it refills the shuffle
pile), so its weakness is tempo, not the deck.

**Dies of its own excess:** an empty bank casts nothing next turn and cannot pay Leaden Ward's tax — the
Alchemist counters a Spent Barbarian outright, so the mirror pair polices each other. Poison the Air wipes a
bank it was saving to burn.

| # | Name | Effect |
| --- | --- | --- |
| A | Spark | Your next play is +1. Spent: draw 2 as well. |
| 3 | Rage | Burn any number: your next play is +1 per 2 burned (max +6). |
| 4 | Second Wind | Draw 2. Spent: draw 4. |
| 5 | Furnace *(Equipment, 3 rounds)* | Whenever you win a fight, put the top card of your deck into your Energy Pile. |
| 6 | Smash | Burn 5: target Rival loses 1 shield. |
| 7 | Wildfire | Burn 4: every Rival's highest card each fight is −2 until end of round. |
| 8 | Frenzy *(Equipment, 3 rounds)* | Your highest card each fight is +1; +3 while you are Spent. |
| 9 | Blaze | Burn any number: draw 1 per 3 burned, and your next play is +1 per 3 burned (max 4 each). |
| 10 | Pyroclasm | Burn 6: target Rival loses 1 shield. Burn 12 instead: 2 shields (never overkills). |
| 2 | Mjolnir | *apex — no effect* |

- **Ride — Fenrir** (the unbound): while in your zone, when you would break a Rival's shield, look at their
  shield cards and choose which one breaks. *A broken shield's card returns to its owner's hand, so this is
  choosing which card the victim gets back — the wolf hands them the 3, not the Ace. The aggro class's damage
  refuels the victim less, and you learn four cards that are not in their hand.* ⚖ *Scope at a table: the
  target's shields after you have chosen whom to strike (the mirror with Jormungandr argues for this), or every
  rival's before you choose. The peek is private, like Pandora's hand read.*
- **Queen — Bodvar Bjarki Form** (the bear-berserker): Spark: Spent draws 3 · Second Wind: Spent draws 5 ·
  Furnace banks 2 per win.
- **King — Sigurd Form** (Fafnir's slayer — the ♣ hero kills the ♦ beast, which is the mechanical rivalry of the
  mirror pair told in the myth): Rage also draws 1 per 4 burned · Smash: Burn 3 · Frenzy +4 while Spent.
- **Super — Thor Mode**: Pyroclasm: Burn 6 strips 2 · Rage has no maximum. ⚖ *The no-maximum is the apex
  complaint in one line; it is Super-gated and rare (a third to two-fifths of seats, late). Surtr, the
  world-burner, is the truer fire but a giant, not a god.*

Notes. Smash is Ultima Attack with the price changed from a Broadway card to energy — same verb, different
price, not a twin. Furnace pays every fight win including jabs; the global jab cantrip was rejected for
cannibalising the draw cards, and this is one class's three-round Equipment, which is a different thing.
Keeps ♣'s law: no base Quick.

---

### ♠ Trickster — the lead and the victim

*Swords. TAKE + BREAK. The Rogue takes cards, energy, equipment, a round; the Trickster takes the two things
nothing can touch today — who leads, and who gets hit.*

Grounded twice: initiative concentration sits at 1.8× fair share with exactly one cause (the round winner
leads next — measured here as the lead staying put on 62% of duel rounds), and the shipped loss mode lets the
winner *choose* the victim. It also carries the parked slash card.

**Dies of its own excess:** it never raises its own number, so the tempo it steals must be converted with plain
cards, and every trick is a Technique — Counter Spell and Leaden Ward eat them. Wizard polices the Trickster.

| # | Name | Effect |
| --- | --- | --- |
| A | Pickpocket | Look at the top card of target Rival's deck. You may put it into their Shuffle Pile. |
| 3 | Undercut | The current play fights at −2 until it is beaten. |
| 4 | Read the Table | Look at target Rival's hand. Then you may put a card from your hand on the bottom of your deck and draw 1. |
| 5 | Hex *(Equipment, 3 rounds)* | Target Rival's first Technique each round costs 2 more. |
| 6 | Cut In | After this round resolves, you take the initiative for the next round, whoever won. |
| 7 | Decoy *(Equipment, 3 rounds)* | When a Rival's Special win would strike you, they must strike another Rival instead; if there is none, they discard a card to strike you. Remove a counter either way. |
| 8 | Snatch | Look at target Rival's hand and take a card from it. |
| 9 | Stacked Deck | Until end of round, you may answer a Special with a Special one size larger that contains its shape (a trio on a pair, a full house on a trio). A round won that way strips no shield. |
| 10 | Turnabout *(Quick)* | If you would lose a shield this round, target Rival loses it instead. It is never a Kick. |
| 2 | Laevateinn | *apex — no effect* |

- **Ride — Sleipnir** (Loki's own child, the swiftest): while in your zone, when a Rival activates their first
  Technique on each of their turns, the top card of their deck goes to their Shuffle Pile.
  ⚖ *The shape is right and the destination is kind: deck-to-Shuffle is a cycle in this game, not a loss — the
  card returns at the reshuffle, and against an Alchemist it feeds the very refill the hoarder is short of.
  Two ways to give it teeth, both keeping the mirror with Saehrimnir (yours is conserved, theirs is spent):
  the card **leaves the game** with the Technique, or **you look at it** before it goes, which makes the mill
  aimed. Gentle as written is also a legitimate choice — Ram's tax is gentle and measured as the weakest
  transform without being wrong.*
- **Queen — Hervor Form** (went disguised into the barrow): Undercut −3 · Pickpocket looks at 2 and may mill
  both · Snatch: they also discard 1.
- **King — Egil Form** (ransomed his own head with a poem): Cut In also draws 1 · Decoy keeps its counter when
  it deflects · Read the Table draws 2.
- **Super — Loki Mode**: Undercut becomes a Quick, cast as a play lands · Turnabout also hands you the
  initiative. *See Back pocket for the stronger version of this Super.*

⚖ **Stacked Deck** presses on "matching is aikido". The case for it: a containing shape does meet the attack,
and the no-strip clause prices it the way the chop is priced — it buys the lead, not damage. It is a duel card
in practice: piles are pairs 57% of the time in a duel, so "a trio on a pair" is the live case, while at six
players 84% of piles are already five cards and nothing larger exists. If you read it as doing your own thing
rather than reacting, cut it; the class loses nothing structural.

⚖ **Turnabout** is the card most likely to need a leash. Option, straight from the Swords shadow: *...instead.
You skip your next turn.* The blade cuts both ways.

Undercut is the slash card exactly as filed: not a Quick at base, the Super buys that. Snatch is Outbalance
with the destination changed from their Energy Pile to your hand.

---

### Back pocket — designs kept in reserve, at Aj's request

Displaced by the mirror-pair Rides, each with a natural landing if wanted later:

- **Instant speed, once per round** — *once per round, you may activate one Technique during a Rival's turn, as
  if it were a Quick.* Was Sleipnir; is a better **Loki Mode** than "Undercut becomes a Quick", and keeps the
  Trickster's Super about timing.
- **The gate skip** — *your Form Changes unlock one tier early.* Was Fenrir. A Ride cannot skip its own gate, so
  it fits a Form boost: **Bodvar Bjarki** could unlock the Barbarian's King at the Queen's threshold — the
  Super rush without touching the J. Measured against today's gates that brings Thor to about round 7 of an
  11-round duel instead of round 10 or 11; the strongest single effect in this document.
- **Fafnir** — Rivals' effects can't take your Energy Pile below 4. Softens Poison the Air without erasing it.
- **A hand limit of 12** for the Guardian — its burst draws hit the cap, and the cap is the one card-economy
  lever the sims said would bite.
- **Tanngrisnir**, Thor's own goat — the first card you Burn each turn is drawn instead.
- **Acting immediately after the round's leader** — the freshest space of all (seat order), table-only.

---

## 3. What the measurements said — including the premise they killed

**The ♣ class was going to be a "Gladiator" that rewarded 3+ card Specials, on the argument that the AI plays
the cheapest sufficient Special and nothing pays for size. That argument was over-generalised from the
Quadro finding and the probe falsified it.** Specials of 3+ cards are 22% of Specials in a duel, 57% at four
players and **86% at six**, where full houses alone are most of all plays (8,225 of 14,240 Specials). A
condition that is true 85% of the time is not a condition, and it scales with the table because the
per-round draw is the player count. Size is a live condition only in duels and always-on at a table — a
class built on it would be weak in the mode most games are played in and over-tuned in the other. The
Barbarian replaces it, and the bank curve it is built on is the same measurement that sizes the Alchemist.

Other things the probes settled, so nobody re-derives them:

- **Charged moved from 8 to 10.** At 8 it is on for 46–63% of turns — the late-game default, not a decision;
  at 10 it is 33–56%. Mean bank rises with table size (7.4 → 12.0), so the class drifts stronger at tables.
- **The deck-out clock is real and sharp.** Duel deck empties r10–11; table deck r6–8; the refill is the
  shuffle pile the AI builds by spending (~18 cards at r10). A hoarder must spend before then or die.
- **Sacrifice is expensive.** Players lose 0.34 shields per round in a duel and spend 30% of rounds at ≤1
  shield already. Every Guardian card that costs a shield is priced against that.
- **Initiative is sticky in duels (winner keeps it 62%) and churns at tables (40%).** Cut In is worth more in a
  duel; at a table its value is political rather than tempo.
- **Transforms are not a void.** 99% of duel seats transform, 89% reach a Ride by ~r6.5, 42% reach Super at
  ~r10.7 against an 11-round game. A "transform race" ♣ class was considered and dropped: it would
  accelerate something that already happens to everyone.
- **The zone holds one card per rank.** A new J replaces the old J (the retired card banks as Energy). Two
  Rides never occurred in 900 games.

---

## 4. Rules decisions the set forces

Rules, not build decisions. Each changes the design above if it goes the other way.

- **Forms key by CLASS, not suit.** Regin names Alchemist cards; Penelope names Wizard cards, and they share a
  suit. "Each Form upgrades its own suit's cards" becomes "its own class's cards". The Super rule is unchanged.
- **One transform per rank stays.** Its justifying comment ("with any-suit boosts, holding two same-rank
  Forms adds nothing") stops being true once Forms key by class, but the rule is still right: a
  Wizard + Alchemist deck choosing *which* Queen to hold is a real choice, and the zone stays three cards.
- **Set-two transforms dig** (look at 2, keep 1, the other to your Shuffle Pile) **where set-one transforms
  draw 1.** A property of the class's J/Q/K, not of the zone.
- **Same-colour mixes become possible** (Wizard + Alchemist is mono-♦ with two effect suites and no colour
  tax). Magic's guild; probably a feature; the pip rule makes them strictly easier to cast than any two-suit
  mix.
- **A deck part is a class.** The six mix names stay attached to the six original pairs; the other pairs go
  unnamed.
- **Sacrifice does not tick the transform gate.** Otherwise the Guardian accelerates every rival's Forms.
- **A redirected loss is never a Kick.** Turnabout moves a shield, not a death.
- **A shield peek is private.** Jormungandr shows you your own shields; Fenrir shows you the target's. Nobody
  else at the table sees either.
- **Thresholds are provisional:** Charged 10, Spent 3, and every Burn cost, to be moved by a sim.
- **Shield gain stays a Cleric exclusive at base.** The Guardian gains shields only through its Forms.
- **The Assassin stays a ♣♠ hybrid** with its own card set, grown from `kicksLanded`. Fifth design, not one of
  these four.

**Verbs the engine does not have yet, one or two per class:** a threshold read on the bank (Charged / Spent);
a voluntary shield-to-hand move; choosing *which* shield card breaks or is sacrificed (one verb, both Rides);
an additional energy cost (Burn); a Technique that returns to the Shuffle Pile; a mill on a rival's first
Technique; an initiative override; a strike redirect and a strike deflection; a counter-unless-they-pay.
None is exotic. That is the normal price of a class.

**The AI must be taught each class before any sim may judge it.** The Alchemist holds where the AI spends
greedily; the Guardian trades life for cards; the Barbarian chooses how much to burn; the Trickster values a
lead and a victim. Until each has a pilot, a 0.00 cast rate on these cards is the Counterfeit and Phantasmal
Illusion lesson, not a verdict.

## 5. What to measure first, when it comes to that

1. **Set two's average share against set one's**, before anything per-class. The transform dig is a uniform
   edge on four classes and shows up as a set-wide shift. If it clears a couple of points, give the dig to both
   sets rather than touching cards; if it does not, it is the signature it was meant to be.
2. The eight-pure round-robin spread, three runs minimum, ten for any per-deck claim (`PATCHNOTES` 0c).
3. The Alchemist's deck-out rate and the Barbarian's Spent share of turns — the two curves the mirror pair
   stands on.
4. Whether Cut In moves the busiest leader's share at all (`PATCHNOTES` 0h says only one line can).
5. Table drift: each class's win share at 2p versus 6p, since two of the four are built on numbers that scale
   with the table.
