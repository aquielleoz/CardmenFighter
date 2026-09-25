# Player Profile — Aj

A living read on how the owner (Aj) actually plays Cardmen Fighter, built from exported game logs. Purpose: ground AI-tuning, balance, and design decisions in real play rather than theory, and seed a future "play like me" opponent. **Append new games to the ingestion log at the bottom; re-derive the summary when the sample grows.**

## The one-liner

Aj is a **tempo-control** player whose signature is the **interrupt-into-combo**: blunt the opponent's key play, seize the initiative, then land his own Special — usually a boosted **pair** — for the **Fighter Kick**. The interrupt tool has tracked the game's versions (double **STOPPER** to cancel a Special in the old ruleset → **Counter Spell / Leyline Ascension / the apex 2** in the rework), but the pattern is the same. Between fights he out-resources with ramp and draw; he cedes jab rounds and leans on catch-up rather than racing. Favors the Wizard (♦) / Cleric (♥) axis and beats Demon Lord consistently. (It's a recognizable, "normal" competitive style — the value is in pinning down *his* specific levers, below.)

## What the games show

**Deck taste — Wizard/Cleric, never the aggro suits.** Across the rework sample he ran Pure Wizard (♦) three times, Bard (Cle+Rog) twice, and Pure/mixed Cleric (♥) twice. He gravitates to the control/value archetypes and has not once picked Pure Fighter (♣) or Pure Rogue (♠) for himself.

**Technique-heavy engine.** Every game leans on a stack of non-fight effects — draw (Pray for Guidance, Back to the Books, Superior Training, Prepare for Combat), ramp (Gather Energy, Pray for Strength), and value boosts (Infuse with Magic, Imbue with Power, Divine Tactics, Brilliant Tactic). He routinely chains two or three techniques in a turn to dig, refuel, and then push a play. Technique counts of 4–7 per game are typical, often outnumbering his own jabs.

**The interrupt-into-combo is the core move.** This is the thing he self-identifies with, and the logs bear it out. In the pre-rework game he committed a double **STOPPER** to cancel the opponent's Special, seized the lead, and immediately dropped his own straight flush. In the rework — where STOPPERs are retired — the same instinct routes through **Counter Spell** (fired repeatedly on the opponent's key techniques: Back to the Books, Caltrops, Armor Piercing, Prepare for Combat), **Leyline Ascension** sprung to hold a shield at the critical beat, and the **apex 2** as the un-interruptable trump. Interrupt their plan, take initiative, land his combo. He plays around the opponent rather than racing them.

**Pairs are the workhorse; the value boost is the closer.** Nearly every won round — and every Fighter Kick in the sample — is a **pair**, frequently a 2♦/2♥ or K/Q pair pushed by a value boost. Trios, full houses, and straight flushes show up but are the exception; the bread-and-butter kill is boost-a-pair.

**Builds the transform layer when the game allows.** He calls Rides (Giant Swan / Boar / Owl), stacks Form Changes (Cassandra, Hector, Penelope, Hippolyta), and reached full **INCARNATION** (Super) once — but treats it as a mid-game power spike layered onto the value engine, not the primary plan.

**Tempo — patient and grindy.** Games run long (9–13 rounds). He's comfortable ceding jab rounds and leaning on the catch-up mechanic (shields back to hand, loser mill) to refuel, then converting to shield strips with Specials once his engine is online.

## Record (rework games)

Clean rework games: **5–0**, every win by Fighter Kick — including **3–0 vs Demon Lord** (a 4th demon game was an instant round-1 concede, treated as noise, not a loss). One pre-rework (v0.40) loss under the old STOPPER/1-low ruleset. So on the current game he is a strong, comfortably-winning player, even against the top AI tier.

## Implications (for AI / balance / design)

- **The AI gets punished for casting into an open window.** Because Aj holds Counter Spell, an AI that fires its most important technique first, unprotected, hands him value. A smarter AI would sequence low-stakes effects first to bait the counter, or hold key techniques for a safer beat. Worth considering for the Demon tier.
- **Ramp/ snowball tuning matters to him specifically.** His whole plan is out-resourcing; the catch-up mechanic and any ramp nerfs/buffs hit his style hardest — watch those in balance runs.
- **Boost-a-pair is the dominant kill.** The interaction between value boosts and the apex (2/A) is his primary lever; keep an eye on it when tuning value-boost magnitudes.
- **A "play like Aj" opponent** would be a Wizard-or-Cleric tempo-control list: heavy draw + ramp, an interrupt (Counter Spell / Leyline, the apex 2 held) saved to blunt the opponent's key play and flip initiative, value boosts, and a patient pair-for-the-kick plan — not an aggro rush.

## Caveats

Small sample (7 logged games, 5 clean rework duels, all vs the AI, all 1v1). Treat as directional, not statistical. No multiplayer or netplay games yet. Re-derive once the sample meaningfully grows.

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

## Bibong — the second player in this file (2026-09-25, 9 games, one export)

**The first corpus attributable to Bibong alone.** Bibong is the playtester named in the 2026-08-22/23 entry
above — knew nothing about chikicha, learned the game from the tutorials — and that corpus stays unattributed:
Aj's diagnostics and Bibong's games are mixed in it and cannot be split. This export is different in kind: Aj
confirmed on 2026-09-25 that it is Bibong's own, and Aj appears in it only as an **opponent**.

**Read the sample before the numbers.** Nine records, 2026-08-29 → 09-14. Two are disconnect concedes against a
third player, Rabbi (round 1 and round 7), so **seven real games**. Every real game's log is exactly 80 lines
— the pre-2026-09-24 render cap — so the play-by-play is the back half of each game; the seat stats and the
activation counts come from separate counters and are sound. **The records carry no build version**, only the
schema stamp, so which builds these were played on is unknown (filed: `export-lacks-build-version`).

| | result |
| --- | --- |
| Solo vs Demon Lord — six games in 26 minutes on 2026-09-10 | **4W–2L**, all six by Fighter Kick |
| Netplay vs Aj (2026-08-29, 13 rounds) | Win by Fighter Kick |
| Netplay vs Rabbi (two games) | both won by Rabbi's disconnect |

A player taught by the tutorials alone went 4–2 against the top tier in six consecutive games, at about five
minutes a game. Worth knowing next to the AI-difficulty question, and small enough to be directional only.

**How Bibong plays**, over the seven real games:

- **Jab-heavier and Technique-lighter than Aj.** Mix **jabs 33% · Specials 39% · Techniques 29%** (Aj's
  2026-09-24 read: 19 / 45 / 36). Casts 3–7 Techniques a game against the Demon's 8–14, so Bibong is being
  out-resourced every game and winning four of six anyway.
- **Same kill as Aj: pair-for-the-kick.** 21 of 30 won rounds were Pairs (Trios 6, Straights 3), and **all five
  Fighter Kicks landed on an unanswered lead** — the opponent passed into them.
- **An equipment war, not a ramp engine.** Cursed Pendant in four of seven games; Sabotage ×3 and Forceful Strip
  ×2 aimed at the opponent's gear. The most-cast cards are the two draw/dig Techniques (Hand-to-Hand Mastery 5,
  Back to the Books 5). Gather Energy only twice. The engine is **cards, not energy** — the opposite of Aj's
  ramp-first plan.
- **The reactive layer IS in use.** Counter Spell ×4 and Leyline Ascension ×5 across seven games. The
  2026-08-22/23 finding that humans leave the defensive layer idle does **not** describe Bibong; whatever it
  measured, it was not this player.
- **Transform layer, lightly.** A Ride most games (Giant Ram, Giant Owl), one Pandora, and a Perseus INCARNATION
  in the game against Aj.
- **Always Warlock (Wiz+Rog)**, nine of nine. For a playtester, unlike for Aj, that may be taste — but a resolved
  🎲 Random roll is indistinguishable from a pick in the export, so it is not a claim.

**Bugs the export surfaced.** One is live and was unfiled: the AI's Phantasmal Illusion narrates as *"a Special
undefined overtakes the pile"* (`phantasm-beat-reads-wrong-field`). Two more are filed from this corpus:
`export-lacks-build-version` and `client-activation-line-short-form` (the host narrates a client's cast as
*"Aj played Giant Ram."* while every other seat gets the full card phrase). Also seen and already covered:
*"Rival discarded 1 card."* in a solo game (`discard-line-hardcodes-rival`), and *"Rival countered your
Technique"* in the 08-29 netplay game, which is the human-counter `logMsg` fixed in v1.31.58. **Not a bug:**
Outbalance discarding two cards under Penelope is the Queen boost working.

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
