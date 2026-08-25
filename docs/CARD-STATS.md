# Cardmen Fighter — Card & Deck Stats (v0.86 snapshot)

> **Stale on the ♠ lockout line as of v1.31.4.** This snapshot predates two changes: the AI *does* cast Back
> Stab now (v1.29.1 fixed the `effectOf`/`effectFor` bug that stopped it springing any Form-granted Quick, and
> v1.29.7 un-gated it in multiplayer), and the card itself was redesigned — base Back Stab is a **plain
> round-long lockout, not a Quick**; the Quick moved to Perseus. So the "0.00 cast / reactive Quick" rows below
> describe a card that no longer exists. Current cast volume, `knight`, 200 games: **2p 31, 3p 28, 6p 16**.

*Point-in-time balance snapshot. Regenerate with `node analysis.js 120 on x rework` (round-robin, every deck
vs every other, Demon-strength AI, catch-up on, strict suit-cost). ~6,600 games this run. Numbers are noisy at
this sample — treat ±2 pts as noise. Date: 2026-08-19.*

**Reading the two columns:**
- **castRate** — activations per game the card was available (how much the AI *wants* it; throughput). Often the
  more honest signal, since it isn't confounded by who's winning.
- **win%** — win rate of players who used the card (50% = neutral). Confounded: strong decks use strong cards,
  and "when you're behind" cards (recovery/shield) look weak because you cast them while losing.

Transforms (J/Q/K Rides & Forms) show cost 0 (free) and a castRate = share of games the suit was in the deck
where that tier got played.

---

## Deck standings

| Rank | Deck | Win% | Type |
|---:|---|---:|---|
| 1 | Pure Fighter | 55.1 | pure |
| 2 | Pure Cleric | 53.3 | pure |
| 3 | Mage Knight (Wiz+Fig) | 51.2 | dual |
| 4 | Pure Rogue | 50.1 | pure |
| 5 | Warlock (Wiz+Rog) | 49.7 | dual |
| 6 | Sage (Wiz+Cle) | 49.5 | dual |
| 7 | Paladin (Cle+Fig) | 49.5 | dual |
| 8 | Pure Wizard | 49.3 | pure |
| 9 | Berserker (Fig+Rog) | 48.9 | dual |
| 10 | Bard (Cle+Rog) | 48.4 | dual |
| 11 | Full Set | 45.1 | full |

Spread is 45–55 — the tightest it's been. Fighter still #1 but much closer to the pack; Full Set the lone low
outlier (52 cards dilute its consistency at specials).

---

## Card performance by archetype

### ♣ Fighter
| Card | Cost | Cast | Win% | Kind |
|---|---:|---:|---:|---|
| Giant Boar (Ride, J) | 0 | 0.48 | **53.4** | transform |
| Hippolyta Form (Q) | 0 | 0.43 | 50.2 | transform |
| Meleager Form (K) | 0 | 0.35 | 50.1 | transform |
| Prepare for Combat | 1 | 0.25 | 49.3 | draw |
| Brilliant Tactic | 3 | 0.24 | 52.5 | valueBoost |
| Disarm | 4 | 0.52 | 49.7 | removeEquip |
| Hero's Javelin | 5 | **0.93** | 49.9 | equip |
| Superior Training | 6 | 0.10 | 54.2 | draw/dig |
| Armor Piercing | 7 | 0.26 | 48.4 | onWin (Broadway pitch) |
| Instant Recovery | 8 | 0.13 | **44.1** | reclaim |
| Spiked Armor | 9 | 0.21 | 46.2 | equip |
| Ultima Attack | 10 | 0.17 | 49.9 | destroyShield (Broadway pitch) |

### ♦ Wizard
| Card | Cost | Cast | Win% | Kind |
|---|---:|---:|---:|---|
| Giant Owl (Ride, J) | 0 | 0.55 | 48.2 | transform |
| Penelope Form (Q) | 0 | 0.53 | 48.7 | transform |
| Odysseus Form (K) | 0 | 0.42 | 48.4 | transform |
| Gather Energy | 1 | **0.91** | 47.3 | ramp |
| Telekinesis | 3 | 0.75 | 50.7 | discardOpp |
| Infuse with Magic | 5 | 0.29 | 51.1 | valueBoost |
| Back to the Books | 6 | 0.16 | 52.4 | draw/dig |
| Forceful Strip | 7 | 0.44 | 43.7 | removeEquip |
| Cursed Pendant | 8 | 0.48 | 49.4 | equip |
| Phantasmal Illusion | 10 | 0.00 | — | phantasm — **stale, see the banner: 1.8/6.3/8.3 per 100 games as of v1.31.6** |

### ♥ Cleric
| Card | Cost | Cast | Win% | Kind |
|---|---:|---:|---:|---|
| Giant Swan (Ride, J) | 0 | 0.53 | 49.8 | transform |
| Cassandra Form (Q) | 0 | 0.50 | 49.7 | transform |
| Hector Form (K) | 0 | 0.40 | 50.3 | transform |
| Imbue with Power | 1 | 0.28 | 49.2 | valueBoost |
| Pray for Strength | 3 | 0.84 | 49.3 | ramp |
| Pray for Guidance | 4 | 0.22 | 52.5 | draw |
| Divine Tactics | 6 | 0.19 | 53.0 | valueBoost |
| Plead for Peace | 7 | 0.45 | 48.1 | removeEquip |
| Holy Bow | 8 | 0.52 | 50.6 | equip |
| Holy Shroud | 9 | 0.23 | 53.8 | equip |
| Sanctuary | 10 | 0.28 | **36.7** | shield (symmetric) |

### ♠ Rogue
| Card | Cost | Cast | Win% | Kind |
|---|---:|---:|---:|---|
| Giant Ram (Ride, J) | 0 | 0.50 | 47.6 | transform |
| Pandora Form (Q) | 0 | 0.45 | 48.6 | transform |
| Perseus Form (K) | 0 | 0.37 | 49.8 | transform |
| Outbalance | 1 | 0.76 | 48.1 | discardOpp |
| Hand-to-Hand Mastery | 3 | 0.24 | 48.0 | draw |
| Poison the Air | 4 | 0.22 | 49.2 | recycle |
| Sabotage | 5 | 0.47 | 48.1 | removeEquip |
| Never Out of Options | 6 | 0.10 | 49.1 | draw/dig |
| Caltrops | 7 | 0.67 | 47.2 | equip |
| Counterfeit | 8 | 0.01 | 38.3 | counterfeit (AI barely uses) |
| Critical Hit | 9 | 0.29 | 51.8 | destroyShield |
| Back Stab | 10 | 0.00 | — | lockout (reactive Quick — tracked below) |

**Quick responses** (tracked separately, not proactive casts): 4,178 total — Counter Spell 2,247, Emergency
Maintenance 1,919.

---

## What the numbers say

**The card set is flat and healthy** — nearly everything sits 44–54%. The remaining imbalance is at the *deck*
level (Fighter's diffuse redundancy), not any single broken card.

**Workhorses** (high castRate = the AI reaches for them constantly): Hero's Javelin (0.93), Gather Energy (0.91),
Pray for Strength (0.84), Outbalance (0.76), Telekinesis (0.75), Caltrops (0.67). These matter far more to a
deck's win rate than any flashy finisher.

**The floor:** Sanctuary at ~37% (post–symmetric-nerf; the AI only casts it when already losing).

**Transforms are neutral** — every Ride/Form sits ~48–53%, confirming transforming is a real choice, not a trap
or a no-brainer. The standout is **Giant Boar** (Fighter's Ride) at 53.4% — the best transform, mirroring
Fighter's overall lead.

**Instant Recovery is NOT carrying Fighter** — 44.1% win, 0.13 castRate (rarely cast). This walks back the earlier
"the reclaim engine is Fighter's hidden lever" hypothesis: if it were, the AI would lean on it and it would
correlate with winning. It does neither. Part of the low win% is the recovery-card confound (cast when starving),
but the low castRate says the AI mostly doesn't want it. Fighter's real edge now reads as **Giant Boar + persistent
equipment + broad competence**, not one engine.

**AI blind spots** (0.00 cast, not necessarily weak) — *all three lines below are superseded; re-measured
2026-08-25:*
- **Back Stab** — no longer a reactive Quick at base (v1.31.4 made it a round-long lockout). Casts **19.5 / 18.5
  / 24.3 per 100 games** at 2/4/6 players, roughly Critical Hit's band in a duel.
- **Phantasmal Illusion** — "the AI never pilots it" was true of the *mandatory-swap* version and was the stated
  reason it was replaced in v1.13. Restored in v1.31.6 with the swap optional; casts **1.8 / 6.3 / 8.3**.
- **Counterfeit** — the 0.01 is real but it is **not** a verdict. It is a COMBO card: measured over 300 games,
  when the caster has an edge on the board (their own buff, or the pile debuffed by e.g. Caltrops) Counterfeit
  helps on **25% (2p) / 39.4% (6p)** of its chances — about 10x the no-edge rate. That edge exists on only ~3%
  of chances **in AI play**, because the bots never set Caltrops (♠7) up for Counterfeit (♠8), though a Rogue
  deck holds both. A sim will always under-report a card whose combo it does not build.

---

## Multiplayer balance — first free-for-all sweep (v0.88, `mpsim.js`)

Random deck per seat, `numPlayers` 3/4/6, elimination to last-Rider-standing, catch-up mill on. Win% is
normalized to a **fair share** (a perfectly balanced deck wins `100/P`% of a P-player game), so **x-fair** is the
headline number: 1.00x = exactly fair, >1 = overperforming.

**★ LIVE default (v0.88+) — SPECIAL_LOSS=chosen, MILL=targeted, Fighter AI (2600/2000/1600/1100 games):**
This is the shipped ruleset — the victor strips/mills *one chosen rival*, not the whole table.

| deck | 2p x-fair | 3p x-fair | 4p x-fair | 6p x-fair |
|---|---|---|---|---|
| Pure Cleric | 1.05 | 1.17 | 1.25 | 1.22 |
| Pure Wizard | 1.06 | 1.02 | 1.09 | 1.05 |
| Sage (Wiz+Cle) | 1.00 | 1.01 | 0.96 | 1.18 |
| Paladin (Cle+Fig) | 0.99 | 1.06 | 0.99 | 1.06 |
| Full Set | 0.96 | 0.96 | 1.02 | 1.09 |
| Mage Knight (Wiz+Fig) | 1.04 | 0.97 | 0.98 | 0.97 |
| Bard (Cle+Rog) | 0.94 | 1.05 | 1.01 | 0.91 |
| Pure Fighter | 1.06 | 0.93 | 0.94 | 0.97 |
| Warlock (Wiz+Rog) | 0.93 | 0.95 | 1.00 | 0.78 |
| Berserker (Fig+Rog) | 0.94 | 0.97 | 0.85 | 0.92 |
| Pure Rogue | 1.02 | 0.93 | 0.93 | 0.83 |

**The whole field now fits one band: ~0.85–1.25x at every player count** (barring Warlock 0.78x at 6p). No
dominant deck, no dead deck. Cleric is still the strongest (1.05→1.25→1.22x) but is now "the best deck," not
oppressive. **Rogue is the headline fix** — from unplayable under the old rules (0.44x at 6p) to dead-fair at
2–4p and only mildly soft at 6p (0.83x). The one remaining soft spot is the 6-player table, where the two most
tempo-dependent decks (Warlock 0.78x, Rogue 0.83x) still sag because 6-way games run long enough that they can't
close before the healers stabilize — a gentle slope, not the old cliff.

---

**Old default for reference — SPECIAL_LOSS=all, MILL=universal (the bloodbath, pre-v0.88):**

| deck | 3p | 4p | 6p |  | deck | 3p | 4p | 6p |
|---|---|---|---|---|---|---|---|---|
| Pure Cleric | 1.16 | 1.47 | **1.84** |  | Mage Knight | 0.98 | 0.83 | 0.84 |
| Pure Wizard | 1.17 | 1.27 | 1.38 |  | Warlock | 0.86 | 0.87 | 0.68 |
| Sage | 1.17 | 1.18 | 1.50 |  | Berserker | 0.92 | 0.83 | 0.50 |
| Pure Fighter | 0.92 | 1.01 | 1.04 |  | Pure Rogue | 0.87 | 0.67 | **0.44** |
| Paladin | 1.00 | 0.97 | 0.99 |  | Full Set | 0.95 | 0.99 | 0.82 |
| Bard | 1.00 | 0.93 | 0.84 |  | | | | |

**Why the old default polarized: it rewarded sustain and punished tempo, worse with each added player.**
Cleric/Wizard healing climbed to 1.38–1.84x at 6p; aggro/disruption (Rogue, Berserker) collapsed to 0.44–0.50x.
With everyone attacking everyone and catch-up mill topping losers back up, a fast kill just handed the survivors a
free share — *outlasting* the table beat *racing* it, and Rogue's thin shields made it the easiest kick. Switching
the victor's strip+mill from the whole table to **one chosen rival** removed the gang-up on the aggro decks and
killed "just heal and wait," compressing the field to the live band above. (2p is a no-op for both toggles, so the
duel is byte-identical either way — see the flat 2p column.)

*Caveats: decks are assigned uniformly at random per seat, so mirror/among-3-healers dynamics are averaged in;
seating is initiative-rolled; the AI targets by the Fighter/Demon tier heuristic, not human politics (real tables
gang the leader, which would pull the healers back toward fair on its own).*
