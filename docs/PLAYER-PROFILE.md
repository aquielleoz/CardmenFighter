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
