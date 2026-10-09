# Player Profile — Aj

A living read on how the owner (Aj) actually plays Cardmen Fighter, built from exported game logs. Purpose: ground AI-tuning, balance, and design decisions in real play rather than theory, and seed a future "play like me" opponent. **Append new games to the ingestion log at the bottom; re-derive the summary when the sample grows.**

## The one-liner

Aj is a **tempo-control** player whose signature is the **interrupt-into-combo**: blunt the opponent's key play, seize the initiative, then land his own Special — usually a boosted **pair** — for the **Fighter Kick**. The interrupt tool has tracked the game's versions (double **STOPPER** to cancel a Special in the old ruleset → **Counter Spell / Leyline Ascension / the apex 2** in the rework), but the pattern is the same. Between fights he out-resources with ramp and draw; he cedes jab rounds and leans on catch-up rather than racing. Favors the Wizard (♦) / Cleric (♥) axis and beats Demon Lord consistently. (It's a recognizable, "normal" competitive style — the value is in pinning down *his* specific levers, below.)

## What the games show

**⚠ DECK CHOICE IS A TESTING SIGNAL, NEVER A PREFERENCE SIGNAL — and this file got it wrong (corrected 2026-09-24).** It used to read *"Deck taste — Wizard/Cleric, never the aggro suits… he gravitates to the control/value archetypes and has not once picked Pure Fighter or Pure Rogue for himself"*. Aj: *"the deck choices are always for testing… even those previous 7 ones, wizard was in a bad spot before"*. He picks whatever needs looking at, so the old claim inferred a preference from behaviour that had an entirely different purpose — and the 2026-09-24 sample makes the error obvious: **ten different classes across twenty games**, near-uniform, including the Rogue and Fighter the file said he never picks.

**What the deck history IS good for, read correctly:** a record of which deck needed attention when. Three Pure Wizard games in August says Wizard was weak in August, not that he likes Wizard. **And the resolved deck is all the export stores, so a 🎲 Random roll is indistinguishable from a deliberate pick** — one more reason never to read taste out of this column.

**The durable read is deck-INDEPENDENT, and that is what makes it trustworthy.** Everything below describes how he plays whatever he is handed; it held across two classes in August and across ten in September.

**The mix, measured over the 13 substantive games of the 2026-09-24 sample: jabs 19% · Specials 45% · Techniques 36%.** Almost exactly what this file already claimed from seven games, now across ten classes — and **Counter Spell is his single most-activated card** (10 casts, ahead of Gather Energy 9 and Infuse with Magic 8), which is the interrupt thesis holding up on four times the data. He plays his games OUT: 11 of 13 solo games ended in a Fighter Kick rather than a concede.

**Technique-heavy engine.** Every game leans on a stack of non-fight effects — draw (Pray for Guidance, Back to the Books, Superior Training, Prepare for Combat), ramp (Gather Energy, Pray for Strength), and value boosts (Infuse with Magic, Imbue with Power, Divine Tactics, Brilliant Tactic). He routinely chains two or three techniques in a turn to dig, refuel, and then push a play. Technique counts of 4–7 per game are typical, often outnumbering his own jabs.

**The interrupt-into-combo is the core move.** This is the thing he self-identifies with, and the logs bear it out. In the pre-rework game he committed a double **STOPPER** to cancel the opponent's Special, seized the lead, and immediately dropped his own straight flush. In the rework — where STOPPERs are retired — the same instinct routes through **Counter Spell** (fired repeatedly on the opponent's key techniques: Back to the Books, Caltrops, Armor Piercing, Prepare for Combat), **Leyline Ascension** sprung to hold a shield at the critical beat, and the **apex 2** as the un-interruptable trump. Interrupt their plan, take initiative, land his combo. He plays around the opponent rather than racing them.

**Pairs are the workhorse; the value boost is the closer.** Nearly every won round — and every Fighter Kick in the sample — is a **pair**, frequently a 2♦/2♥ or K/Q pair pushed by a value boost. Trios, full houses, and straight flushes show up but are the exception; the bread-and-butter kill is boost-a-pair.

**Builds the transform layer when the game allows.** He calls Rides (Giant Swan / Boar / Owl), stacks Form Changes (Cassandra, Hector, Penelope, Hippolyta), and reached full **INCARNATION** (Super) once — but treats it as a mid-game power spike layered onto the value engine, not the primary plan.

**Tempo — patient and grindy.** Games run long (9–13 rounds). He's comfortable ceding jab rounds and leaning on the catch-up mechanic (shields back to hand, loser mill) to refuel, then converting to shield strips with Specials once his engine is online.

## Record

**Against the Demon Lord: 8W–5L over 13 solo games (2026-09-24 sample).** This file used to say **5–0 / 3–0 vs demon** and call him *"comfortably-winning… even against the top AI tier"*. That is no longer true, and the likeliest reason is not the player: **`keepsTheWin` went always-on for the demon tier in v1.31.79**, measured at about a quarter of a whole tier step (knight→demon +6.14 → +7.63). The AI caught up.

**Free-for-all: 0W–3L**, two of them full 14–15 round games. The first multiplayer data in this file — the previous sample had none — and small enough to be directional only. But it has a plausible mechanism rather than being noise: his whole plan is **one well-timed interrupt flipping initiative**, and at three seats a single Counter Spell faces two threats while the third seat profits from whichever exchange he wins. Tempo-control assumes a two-body problem.

**Read the sample before the numbers:** of 20 games, **7 ran under 8 rounds** — concedes and one-rounders from testing, whose profile ("78% jabs, 0% techniques") only means nothing happened. Every figure here is from the **13 real games**.

## Implications (for AI / balance / design)

- **The AI gets punished for casting into an open window.** Because Aj holds Counter Spell, an AI that fires its most important technique first, unprotected, hands him value. A smarter AI would sequence low-stakes effects first to bait the counter, or hold key techniques for a safer beat. Worth considering for the Demon tier.
- **Ramp/ snowball tuning matters to him specifically.** His whole plan is out-resourcing; the catch-up mechanic and any ramp nerfs/buffs hit his style hardest — watch those in balance runs.
- **Boost-a-pair is the dominant kill.** The interaction between value boosts and the apex (2/A) is his primary lever; keep an eye on it when tuning value-boost magnitudes.
- **A "play like Aj" opponent** is a tempo-control PLAN, not a deck list: heavy draw + ramp, an interrupt (Counter Spell / Leyline, the apex 2 held) saved to blunt the opponent's key play and flip initiative, value boosts, and a patient pair-for-the-kick close — not an aggro rush. **This used to name "a Wizard-or-Cleric list" and that half is deleted**: it rested on the deck-taste claim corrected above, and the behaviour it describes has now been observed across ten classes.
- **Free-for-all may need its own read.** 0W–3L is too small to act on, but if it holds, the interesting question is whether the interrupt plan is structurally weaker at 3+ seats rather than whether he played badly.

## Caveats

Still small (20 games as of 2026-09-24, 13 of them substantive, all vs the AI except four netplay). Directional, not statistical.

**Three things in this corpus are NOT usable and each has a reason:**
- **deck choice** — testing, not taste (see above), and a Random roll is indistinguishable from a pick;
- **`shieldsLost` in any 3-6 player game** — `animateShields` carries that tally and runs for seat 0 only at 3+ players, so every free-for-all record undercounts damage. Filed as `shield-diff-skips-seats-past-the-second`. The play-mix and activation counts come from separate counters and ARE sound;
- **logs on records written before 2026-09-24** — the record was built from the RENDERED log panel, which trims to 80 lines, so seven of the nineteen older games lost their early rounds. Fixed that day; anything read out of those logs is a tail, not a game.

## Ingestion log

Games already folded into this profile (so future uploads aren't double-counted):

| Date | Ver | Diff | Your deck | Result | Rounds | Notes |
|------|-----|------|-----------|--------|--------|-------|
| 2026-08-13 | 0.40 | fighter | Bard (Cle+Rog) | Loss (kick) | 11 | pre-rework ruleset; double STOPPER, straight flushes |
| 2026-08-20 | 1.0 | fighter | Bard (Cle+Rog) | Win (kick) | 11 | Swan→Cassandra→Hector INCARNATION; heavy Cleric draw/boost |
| 2026-08-21 | 1.0 | fighter | Pure Wizard (♦) | Win (kick) | 13 | Giant Owl, Penelope; jab-heavy early, pairs late |
| 2026-08-22 | 1.29.0 | ? | Warlock (Wiz+Rog) | Unfinished (r15) | 15 | **3-Rider free-for-all** — first MP game in the log. Jab-heavy, passed a lot into P2/P3 specials; P3 (Paladin) ran the table. Exported mid-game while reporting the MP presentation gap. |
| 2026-08-20 | 1.0 | demon | Pure Cleric (♥) | Concede (r1) | 1 | instant concede — treated as noise |
| 2026-08-20 | 1.0 | demon | Pure Wizard (♦) | Win (kick) | 12 | Giant Boar, Hippolyta; Counter Spell ×2 |
| 2026-08-20 | 1.0 | demon | Pure Wizard (♦) | Win (kick) | 9 | Giant Owl, Penelope; countered Caltrops |
| 2026-08-20 | 1.0 | demon | Cleric/Fighter mix | Win (kick) | 12 | Javelin/Spiked Armor; countered Armor Piercing, sprang Leyline |

### 2026-09-24 — 20 games (one export, Aj only, `cardmen-games (5).json`)

**What it changes:** the deck-taste claim (deleted — testing, not preference), the record (8W–5L vs demon,
not 5–0), and the first free-for-all data in this file (0W–3L). **What it confirms:** the play mix and the
interrupt signature, now across ten classes instead of two.

**Read the shape first:** 13 solo, 4 netplay, 3 local free-for-all; 16 of 20 against the demon tier; 14
ended in a Fighter Kick, 6 in a concede. **Seven ran under 8 rounds** and are testing noise — their
"78% jabs, 0% techniques" means nothing happened, not that he jabs.

| Date | Mode | Diff | Deck (TESTING, not taste) | Result | Rounds |
|------|------|------|---------------------------|--------|--------|
| 2026-08-28 | net | fighter | Rogue | Loss (kick) | 6 |
| 2026-08-29 | net | fighter | Fighter | Win (concede) | 1 |
| 2026-08-29 | net | fighter | Paladin | Loss (concede) | 1 |
| 2026-08-29 | net | fighter | Bard | Win (concede) | 4 |
| 2026-08-31 | local-mp | demon | Paladin | Loss (concede) | 1 |
| 2026-08-31 | solo | demon | Sage | Win (kick) | 15 |
| 2026-09-01 | solo | demon | Cleric | Loss (concede) | 3 |
| 2026-09-04 | solo | demon | MageKnight | Loss (concede) | 1 |
| 2026-09-07 | solo | demon | Berserker | Loss (kick) | 8 |
| 2026-09-07 | solo | demon | MageKnight | Win (kick) | 14 |
| 2026-09-07 | solo | demon | Bard | Win (kick) | 14 |
| 2026-09-07 | solo | demon | Sage | Loss (kick) | 13 |
| 2026-09-07 | solo | demon | Sage | Loss (kick) | 10 |
| 2026-09-07 | solo | demon | Warlock | Win (kick) | 10 |
| 2026-09-10 | solo | demon | MageKnight | Win (kick) | 10 |
| 2026-09-11 | solo | demon | Wizard | Win (kick) | 12 |
| 2026-09-11 | solo | demon | Berserker | Win (kick) | 10 |
| 2026-09-11 | solo | demon | Bard | Win (kick) | 11 |
| 2026-09-24 | local-mp | demon | Warlock | Loss (kick) | 15 |
| 2026-09-24 | local-mp | demon | Warlock | Loss (kick) | 14 |

**Most-activated, whole sample:** Counter Spell 10 · Gather Energy 9 · Hand-to-Hand Mastery 8 · Infuse with
Magic 8 · Pray for Guidance 5 · Never Out of Options 5 · Imbue with Power 3 · Pray for Strength 3 · Prepare
for Combat 3 · Outbalance 3 · Back to the Books 3.

**⚠ DO NOT re-derive damage or early-game behaviour from this export.** `shieldsLost` is broken for seats
2+ in every free-for-all record (`shield-diff-skips-seats-past-the-second`), and nineteen of the twenty
were written before the record kept a full log, so their `log` arrays are the last 80 lines only. The play
mix and activation counts above come from separate counters and are unaffected.

### 2026-08-22/23 — 14 games (2 exports, "bibong+aj", 25 records deduped to 14)

**Caveat from Aj, and it matters for every number here:** two players' games are mixed in this corpus (Aj plus a
playtester who had never seen chikicha and had only played the tutorials), and *"most of this data was
diagnostics instead of serious games."* So read it for **mechanic engagement**, not skill or balance.

Shape of the sample: 14 games, 958 log lines, all recorded `difficulty: 'demon'`, 6 of the 14 were
**free-for-alls** (P2/P3 appear in the log), games ran 1-24 rounds and 0.1-20 minutes. Human side won 8.

**Finding 1 — the reactive layer is almost entirely unused in real play.** Across all 958 lines:

| mechanic | mentions in 14 games |
| --- | --- |
| Counter Spell | 8 |
| Back Stab | 3 |
| Phantasmal Illusion | 1 |
| **STOPPER / cancel** | **0** |
| **Emergency Maintenance** | **0** |
| pre-fight window | 0 |

`stoppers` is **0 in the per-game stats for both sides in all 14 games**, *and* the word never appears in a log
line — so this is genuine non-engagement, not a recording gap. For contrast, `analysis.js` counts ~4,200 Quick
responses across ~7,150 sim games (~0.6/game), which over 14 games predicts ~8 — and Counter Spell alone hits
that, while Emergency Maintenance (about a quarter of sim Quicks) shows up zero times. **The AI uses the
reactive layer at roughly the predicted rate; the humans essentially do not use STOPPERs at all.** Worth
knowing before tuning anything defensive: a whole mechanic is sitting idle in real hands.

**Finding 2 — round wins split 36 jab / 77 special (32% jab).** Consistent with the sim's ~27% jab share of
plays at 2p, so the AI-vs-AI jab rate is not an artefact of the AI.

**Finding 3 — technique use is broad and flat, not focused.** 25 distinct techniques cast across 14 games, the
top three tied at 8 casts (Outbalance, Pray for Strength, Gather Energy). Sim cast rates predict ~13 Gather
Energy over 14 games; observed 8. Humans under-activate relative to the AI, and spread their casts wider — the
opposite of the sim's concentration on the cheapest ramp.

**Bugs the corpus surfaced** (filed in NEXT-SESSION.md; two others in these logs are already fixed):
- The export's `rival` block **cannot represent a free-for-all**. In 2 of the 6 MP games it recorded
  `0/0/0/0` — every opponent stat lost — and in the other 4 it recorded one seat while seats 2+ vanished. There
  is also **no player-count field**, so an MP game is only identifiable by grepping the log for "P2"/"P3".
- `Rival discarded N to hand size → energy pile.` still names "Rival" in a free-for-all
  (`CardmenFighter.template.html` ~3315), and only seat 1's trim is announced. **Not a correctness bug** —
  `finishRoundWin` (`engine.js` ~1726) trims every seat over the cap — but seats 2+ trim silently.
- **16 card texts in `engine.js` say "the Rival's ..."**, which reads wrong at a 6-player table.
- Already fixed, confirmed against current source: the 2-player draw line (`You draw 2, Rival draws 2`) and
  the lowercase `a rival lost a shield` announcement. Both appear in this corpus, neither remains in the code.

### 2026-08-24 — jab vs Special: what decides a round (and who reported what)

**Attribution first, because an earlier version of this entry got it wrong.** Three different people:
- **bibong** — a playtester who knew nothing about chikicha and learned the game by playing the tutorials.
- **Aj** — the owner.
- **Aj's brother** — relayed two pieces of feedback and **has no logs here at all**; his difficulty, player
  count and deck are unknown.

The two export files are **one continuous log**: Aj cleared it, bibong played, then Aj carried on working on the
game. So bibong's games and Aj's diagnostics sit in the same 14 records and **cannot be attributed to either
person** — including the 36-jab / 77-Special round-win split reported here earlier. Treat every per-game number
from that corpus as unattributed. (If anyone wants to try splitting it, there is a 7-hour gap between
`08-22T07:04` and `08-22T14:26` that is the likeliest boundary, but nobody has confirmed it.)

**The brother's two reports, verbatim in substance:** the apex 2s should be unbeatable (in chikicha the 2 is the
outright peak, and here boosts can exceed it), and *"after the initial round of jabs, there was only ever
specials."*

**That second report is confirmed by simulation** — and this part needs no human data at all, so it stands
regardless of attribution. Share of rounds 2+ decided by a jab vs a Special (`roundsim.js`, 200 games per row,
AI vs AI; round 1 is jabs-only by rule so it is counted apart):

| | jab | Special |
| --- | --- | --- |
| knight 2p | 16% | 84% |
| demon 2p | 15% | 85% |
| knight 3p / 4p / 6p | 17% / 15% / 12% | 83% / 85% / 88% |
| demon 6p | 13% | 87% |

**Specials decide 83-88% of rounds after round 1**, at every difficulty and player count.

**This does not contradict Aj's jab complaint.** 20-27% of all *plays* are jabs (`optionsim.js`) while only
12-17% of *rounds* are jab-decided — so jabs are thrown far more often than they decide anything. With ~0.5
legal options while following at 6p and 79% of those turns stuck, a jab is frequently the only legal move, and
then somebody leads a Special next round and takes it. **One report is about what you play, the other about what
wins.**

## Bibong — the second player in this file (two exports, 2026-09-25 and 2026-10-09: 13 games)

**The first corpus attributable to Bibong alone.** Bibong is the playtester named in the 2026-08-22/23 entry
above — knew nothing about chikicha, learned the game from the tutorials — and that corpus stays unattributed:
Aj's diagnostics and Bibong's games are mixed in it and cannot be split. These exports are different in kind:
Aj confirmed on 2026-09-25 that they are Bibong's own, and Aj appears in them only as an **opponent**.

**Read the sample before the numbers.** Thirteen records, 2026-08-29 → 10-08. The 2026-10-09 export is the
whole history: its first nine records are byte-for-byte the nine ingested on 09-25, and four are new. Two are
disconnect concedes against a third player, Rabbi (round 1 and round 7), so **eleven real games**. The first
seven real games' logs are exactly 80 lines — the pre-2026-09-24 render cap — so their play-by-play is the
back half of each game; the four newer logs are complete. The seat stats and activation counts come from
separate counters, **with one hole, below**. The three 2026-10-08 records are the first in this file to carry
a build: **v1.33.1** (the stamp shipped in v1.32.7); the rest predate it.

**⚠ THE RECORDS NEVER COUNT YOUR OWN RIDES AND FORMS, AND THEY COUNT EVERY OPPONENT'S** (found 2026-10-09,
filed `record-skips-own-transforms`). So a record's `techniques` is Techniques for Bibong and Techniques +
Rides/Forms for the Demon Lord, and the first version of this section compared exactly that: *"3–7 Techniques
a game against the Demon's 8–14"*. Split by card rank, the Demon's 8–14 was **7–11 Techniques plus 1–3
Rides/Forms**. Bibong was still out-cast in all six of those games; the gap was smaller than written. A
human-to-human comparison (Aj's mix below) is like for like: neither counts its own.

| | result |
| --- | --- |
| Solo vs Demon Lord — six games in 26 minutes on 2026-09-10 | **4W–2L** |
| Solo vs Demon Lord — one on 09-20, three on 10-08 (v1.33.1) | **3W–1L** |
| Netplay vs Aj (2026-08-29, 13 rounds) | Win by Fighter Kick |
| Netplay vs Rabbi (two games) | both won by Rabbi's disconnect |

**7W–3L against the top tier over ten games, every one decided by a Fighter Kick**, from a player the
tutorials taught. Worth knowing next to the AI-difficulty question, and still small enough to be directional.

**How Bibong plays**, over the eleven real games:

- **Jab-heavier and Technique-lighter than Aj.** Mix **jabs 30% · Specials 41% · Techniques 29%** over all
  eleven (the first seven: 33 / 39 / 29; the newer four: 24 / 46 / 30). Aj's 2026-09-24 read: 19 / 45 / 36.
- **Out-cast by the Demon on 09-10, level with it since.** Techniques alone, per game: Bibong 3–7 against the
  Demon's 7–11 on 09-10, and 3, 3, 7, 3 against 4, 4, 5, 4 in the newer four. The Demon's rate fell from 0.61
  Techniques a round to 0.34. **Do not read that as an AI change yet:** four games, and the decks changed under
  it. Five of the six 09-10 opponents were half Wizard, the ramp class (three Sage, a Warlock, a Mage Knight;
  the sixth Pure Cleric); none of the newer four has a Wizard half (Berserker, Pure Rogue, Paladin, Pure
  Fighter).
- **Pairs win the rounds; the kick comes off anything.** In the four complete logs, Bibong's won Specials were
  9 Pairs, 5 Trios and 2 Straights, and the three kicks came off two Trios and a Straight. **All eight Fighter
  Kicks across both exports landed on an unanswered lead**: the opponent made a play that did not answer it (a
  Form, an Equipment) or none, and passed.
- **An equipment war, not a ramp engine.** Cursed Pendant in four of the first seven games; Sabotage ×3 and
  Forceful Strip ×3 aimed at the opponent's gear; Caltrops in two of the newer four. The most-cast cards are
  the draw/dig Techniques (Hand-to-Hand Mastery 7, Back to the Books 6, Never Out of Options 2). Gather Energy
  only twice in eleven games. The engine is **cards, not energy** — the opposite of Aj's ramp-first plan. The
  one newer loss was the Demon winning that war outright (10-08, below).
- **The reactive layer IS in use.** Counter Spell ×5 and Leyline Ascension ×8 across eleven games. The
  2026-08-22/23 finding that humans leave the defensive layer idle does **not** describe Bibong; whatever it
  measured, it was not this player.
- **Transform layer: a Ride nearly every game.** Giant Ram and Giant Owl throughout, a Penelope Form, one
  Pandora, and a Perseus INCARNATION in the game against Aj. Read the log for these, never the counts (above).
- **Always Warlock (Wiz+Rog)**, thirteen of thirteen. For a playtester, unlike for Aj, that may be taste — but a
  resolved 🎲 Random roll is indistinguishable from a pick in the export, so it is not a claim.

**Bugs the first export surfaced** (2026-09-25): the AI's Phantasmal Illusion narrating as *"a Special
undefined overtakes the pile"*, the missing build stamp, and the host narrating a client's cast in short form
(*"Aj played Giant Ram."*) — all three shipped in v1.32.7. Also seen then: *"Rival countered your Technique"*
in the 08-29 netplay game, the human-counter `logMsg` fixed in v1.31.58. **Not a bug:** Outbalance discarding
two cards under Penelope is the Queen boost working.

**Bugs the second export surfaced** (2026-10-09), all three live on v1.33.1 and filed:
- *"You played a Technique - 3♦ Telekinesis — aimed at Rozalin."* then *"Rival discarded 2 cards."* — the line
  after your own discard effect names nobody. It was seen in the first export too and filed as
  `discard-line-hardcodes-rival`, which a 2026-09-30 fix to a **different** line (the AI's cast) closed by
  mistake. Re-filed under the same id.
- **The opponent's INCARNATION is never announced** (`opponent-incarnation-unannounced`). In three of the four
  newer games the Demon completed J + Q + K, and the log shows only the Form card that finished it; your own
  transform line ends *"JQK — INCARNATION!"*.
- **The records skip your own Rides and Forms** (`record-skips-own-transforms`, above), and the same audit
  found that a netplay host never counts a client's Quick answers.

One more, historical, so nobody re-derives it: **a Leyline sprung in the old shield window was never
counted.** Every *"You sprang Leyline Ascension in response — the shield held."* line in both exports (two on
09-10, one on 09-20) is missing from that game's counts, and every *"answered with … at instant speed"* line
is there. Epic step 19 deleted that window; answers go through one path now, and it counts them. So the Leyline
totals above come from the logs, not the counts.

### Ingestion log — Bibong

| Date | Ver | Diff | Mode | Deck | Opponent | Result | Rounds | Notes |
|------|-----|------|------|------|----------|--------|--------|-------|
| 2026-08-29 | ? | fighter | net | Warlock | Aj (Warlock) | Win (kick) | 13 | Giant Ram, Pandora → Perseus INCARNATION; Counter Spell ×2; Aj dropped and rejoined once |
| 2026-08-29 | ? | fighter | net | Warlock | Rabbi (Berserker) | Win (concede) | 1 | Rabbi disconnected in round 1 — noise |
| 2026-09-10 | ? | demon | solo | Warlock | Etna (Warlock) | Win (kick) | 16 | Leyline ×2 held shields; countered Caltrops; won with the 2-trio |
| 2026-09-10 | ? | demon | solo | Warlock | Rozalin (Sage) | Loss (kick) | 13 | Critical Hit countered; Holy Shroud blanked two wins; **"Special undefined"** phantasm line |
| 2026-09-10 | ? | demon | solo | Warlock | Adell (Cleric) | Loss (kick) | 15 | Straight + two Trios; Divine Tactics pairs beat the A/K pairs; Counterfeit |
| 2026-09-10 | ? | demon | solo | Warlock | Rozalin (Sage) | Win (kick) | 19 | Sabotage + own Cursed Pendant; two Straights; longest game |
| 2026-09-10 | ? | demon | solo | Warlock | Etna (Sage) | Win (kick) | 13 | Infuse with Magic ×2 into boosted pairs; Forceful Strip; *"Rival discarded 1 card."* |
| 2026-09-10 | ? | demon | solo | Warlock | Vyers (MageKnight) | Win (kick) | 14 | Sabotage ×2 on Spiked Armor / Javelin; Leyline ×2; lost only one shield |
| 2026-09-14 | ? | fighter | net | Warlock | Rabbi (Sage) | Win (concede) | 7 | Rabbi dropped four times in round 7, Passo took the seat, then dropped |
| 2026-09-20 | ? | demon | solo | Warlock | Adell (Berserker) | Win (kick) | 11 | Trios of 7s and 8s took two shields by round 3; Giant Owl; Leyline ×2 (one in the old shield window, uncounted); Adell's INCARNATION came the round it lost, unannounced |
| 2026-10-08 | v1.33.1 | demon | solo | Warlock | Vyers (Pure Rogue) | Win (kick) | 14 | Infuse with Magic ×2 into boosted pairs — 8s over Jacks, then Aces over Kings, which win without it; Giant Ram + Poison the Air; both seats on 0 shields, kicked with a trio of 2s; Vyers's JQK INCARNATION unannounced |
| 2026-10-08 | v1.33.1 | demon | solo | Warlock | Rozalin (Paladin) | Win (kick) | 15 | Leyline held a shield; Forceful Strip on Spiked Armor; Penelope Form; Counter Spell on Holy Bow; two Straights, the second the kick; *"Rival discarded 2 cards."*; Rozalin's INCARNATION unannounced |
| 2026-10-08 | v1.33.1 | demon | solo | Warlock | Rozalin (Pure Fighter) | Loss (kick) | 10 | Lost the equipment war: Hero's Javelin, Giant Boar and Spiked Armor took four shields in four rounds; Critical Hit took one of Rozalin's; Disarm stripped Caltrops, then 2s beat 2s for the kick (Spiked Armor's −2 decided it) |
