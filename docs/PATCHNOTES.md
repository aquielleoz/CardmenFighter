# Cardmen Fighter — Patch Notes & Balance Learnings

This file records balance changes and, more importantly, **why** they worked. The
principles at the top are the reusable lessons — read them before making future
balance changes so we don't relearn them the hard way. The patch log beneath is the
evidence trail. All win% figures come from `node analysis.js 130` (round-robin, every
deck vs every other, ~7,150 games, Demon-strength AI, strict suit-cost).

---

## Balance Design Principles (the durable learnings)

### 0j. POST-MORTEM: v1.31.0 shipped a balance regression, and a harness bug is why. (2026-08-25)
**Reverted in v1.31.2.** This is the most expensive mistake in the project's history so far — it shipped to
`main`, Aj played an evening on it, and the study that cleared it was incapable of detecting the problem.

**What shipped (v1.31.0):** for 3-6 players, shields = 2 + numPlayers, per-round draw = numPlayers,
`SPECIAL_LOSS_MODE='all'`, `MILL_SCOPE='universal'`. All four are no-ops at 2 players, so duels were never
affected.

**What it did to balance.** Deck-spread at 6 players went from **15.5 to 40.7 points**. Pure Wizard won
**44.3%** of games against a fair share of 16.7%; **Pure Rogue won 1.7%**. A 26x gap between best and worst deck.

**Isolated to one change.** Reverting each part separately, 6-player spread:

| config | spread |
| --- | --- |
| shipped (all four) | 40.7 |
| minus draw=numPlayers | 32.9 |
| minus shields 2+N | 35.9 |
| mill back to `targeted` | 41.3 |
| **loss back to `chosen`** | **13.3** |
| pre-ship (all four off) | 15.5 |

**`SPECIAL_LOSS_MODE='all'` was the whole regression.** The mechanism, obvious afterwards: `all` **multiplies
the value of landing a Special by (N-1)**. At six players the deck that lands Specials most reliably gains
against five people at once, so any edge in landing them compounds five-fold. Under `chosen` a Special is worth
one shield regardless of table size, so deck edges are not amplified.

**Why the study missed it — the actual root cause.** `mpsim.js` took its ruleset from **positional arguments**,
and an edit had dropped the loss-mode argument and left `setSpecialLossMode('chosen')` hardcoded. The mill and
apex flags read argv positions the commands never filled. **So every arm of both studies ran the IDENTICAL
config** and dutifully reported "no measurable difference" — twice, once for the v1.31.0 package and once for
the apex-2 A/B. The header printed `mill=targeted` the whole time and it was read past.

**Fixes applied:** `mpsim.js` now takes **named** flags and **prints the config it resolved** on every run. If
the printed config is not what you asked for, the numbers are worthless.

**The four lessons, in order of how much they cost:**
1. **A harness that can silently run the wrong configuration is worse than no harness** — it manufactures
   false confidence. Print the resolved config, and read it.
2. **"No measurable difference" is the signature of a broken A/B**, not just of a neutral change. When arms
   come back identical, suspect the harness before believing the result. Two studies in a row said "neutral"
   and both were measuring nothing.
3. **A pacing win and a balance check are different experiments.** The pacing numbers (`rulesim.js`, which
   sets flags directly) were correct throughout — 6p length 33 -> 15 rounds, jab share 24% -> 10% — and they
   are what made the package look good. Do not let a valid measurement of one axis carry a change past an
   invalid measurement of another.
4. **Ship the reversible thing first.** The package was a default-on rules change across four dimensions with
   a tutorial built on top of it. A flag left off, plus one deck-spread run, would have caught this for free.

**What was NOT wrong, and is kept:** the pacing findings; `optionsim`/`passsim`/`roundsim`/`rulesim` and their
results; the playtest analysis; the apex-2 complaint measurement. And the design insight that fell out of the
post-mortem, which is worth more than the reverted package:

### 0k. Shields should scale DOWN with player count, not up. (2026-08-25)
The reverted package reasoned "more players, longer game, so give everyone more shields." Backwards. Measured
median rounds under `loss=chosen` with a fixed shield count:

| | 2 shields | 3 | 4 | 5 | 6 |
| --- | --- | --- | --- | --- | --- |
| 2p | 6 | 8 | **11** | 13 | 16 |
| 3p | 8 | **11** | 14 | 18 | 20 |
| 4p | **11** | 15 | 19 | 23 | 27 |
| 6p | **17** | 24 | 29 | 36 | 42 |

`shields = max(2, 6 - numPlayers)` gives 4/3/2/2 and lengths of **11 / 11 / 11 / 17** — flatter than the
reverted package managed, *while keeping `chosen`* so deck balance stays near 13.3. With more players you lose
rounds more often, so you need **fewer** shields to die in the same number of rounds. **Untested for balance —
that run has not been done.** This is the candidate for a re-land, one flag at a time, with a deck-spread run
per step.


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
complaint ("three rounds in a row throwing jab after jab") measured and cut in half.

**SETTLED 2026-08-25 at 10 runs per arm: the package is BALANCE-NEUTRAL at every player count.** Spread, mean
+/- standard error of the mean over 10 runs:

| | live | C shields 2+P | D full package | H + apex unbeatable |
| --- | --- | --- | --- | --- |
| 6p | 14.9 +/-1.2 | 16.0 +/-0.8 | 15.2 +/-0.7 | 16.0 +/-1.0 |
| 4p | 14.2 +/-0.9 | 14.3 +/-1.0 | 12.6 +/-0.8 | 14.3 +/-1.0 |
| 3p | 13.8 +/-0.7 | 14.9 +/-1.0 | 15.6 +/-0.9 | 15.2 +/-1.2 |

Nothing clears 2 s.e. **Both earlier 3-run readings were noise** — the "spread tightens 16.4 -> 13.6 at 6p" was
really 14.9 -> 15.2, and the 3-player regression that looked like it might sink the package (13.8 -> 16.6) is
13.8 -> 15.6 +/-1.1. Across all 33 per-deck comparisons exactly **one** clears 2 s.e. (Warlock +1.7 at 4p),
which is what chance predicts from 33 comparisons, so there is no real per-deck movement either. The "bottom
decks rise, top decks fall" pattern read off 3 runs did not survive.

**This is the best available outcome for a change of this kind:** it moves length (33 -> 15 rounds at 6p), jab
share (24% -> 10%) and energy dispersion, and leaves the deck balance — tuned across many versions — alone. A
pure PACING change. The apex-2 fix is neutral here too, so it is free on balance as well as on length.

**And it is a third strike for single-run readings.** Every 3-run balance claim made on 2026-08-24 has now been
overturned by 10 runs. Treat 3 runs as a smoke test, not evidence.

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

Re-run as coherent pairs, 3 runs each, they looked close with the symmetric one slightly tighter: spread 12.5
vs 13.0 at 6p, 14.7 vs 18.0 at 4p, 15.4 vs 18.1 at 3p. **At 10 runs per arm (2026-08-25) even that difference
vanishes** — see 0g, where `all`+`universal`+shields is 16.0 +/-0.8 against live's 14.9 +/-1.2 at 6p, i.e. no
measurable difference. A 0.5-point gap read off 3 runs was never meaningful given a per-arm s.e. of ~1.0.
So the original "universal opens a huge spread" claim is not reproduced, *and* neither is any tightening: the
loss/mill pairing is a **length** lever, not a balance one. **Lesson: a balance finding has a shelf
life — re-date it before reusing it to veto an idea — and check that the arm you are testing is a design
someone would actually ship.**

### 0n. `loss=all` is broken by a DEFENSIVE card, not by unscaled offence. (2026-08-26)

Following 0m's rank finding — that `all` does not widen the deck table but **reorders** it, with Wizard/Cleric up
and Fighter/Rogue/Berserker collapsing — Aj asked the obvious next question: if the offensive decks lose because
their damage does not scale, does scaling it fix them? Two dials, both measured, both no.

- **`damageAll`** — Critical Hit (Rogue) and Ultima Attack (Fighter) hit every living rival.
- **`damageSpan='half'`** (new, Aj's suggestion when `all` looked too harsh) — those cards hit
  `ceil(living rivals / 2)`: the chosen target plus the rivals with the **most shields**, so the splash scales
  toward the leaders rather than by seat order, which would bake positional bias into every measurement.
  Note it is a **no-op at 3 players** (2 rivals → ceil(2/2) = 1 = shipped), which the numbers show.

Spread, 6 interleaved runs of 1,500 games:

| | base | `all` | `all`+half | `all`+dmgAll |
| --- | --- | --- | --- | --- |
| 3p | 13.4 | 23.5 | 24.1 | 16.0 |
| 4p | 16.5 | 29.0 | 27.3 | 24.1 |
| 6p | 12.6 | **33.5** | **26.2** | **26.8** |

6p per-deck, sorted by baseline rank — the three intended beneficiaries and the runaway leader:

| deck | base | `all` | `all`+half | `all`+dmgAll |
| --- | --- | --- | --- | --- |
| Pure Wizard | 16.0% | **36.4% (#1)** | **31.8% (#1)** | **32.8% (#1)** |
| Pure Fighter | 16.4% | 4.3% | 6.4% (#11) | 6.5% (#11) |
| Pure Rogue | 9.5% | 4.1% | 6.5% (#10) | 6.5% (#10) |
| Berserker | 13.7% | 3.8% | 7.4% (#9) | 6.8% (#9) |
| Warlock (Wiz+Rog) | 13.6% | 17.2% | 20.7% (#4) | 22.4% (#3) |

Both dials buy the offensive decks **2-3 points and no rank movement**, they leave the spread at roughly double
baseline, and Spearman rho against the baseline order gets *worse* (0.36 → 0.31 → 0.22). The clearest tell is
that the biggest beneficiary is **Warlock** — Rogue offence *plus* Wizard defence — not the pure attackers.

**THE MECHANISM: `Leyline Ascension` (♦9) is the only card in the game that prevents shield loss.** Checked all
four suits; Hearts, Clubs and Spades have nothing. Under `chosen` a blank saves a shield only on the rounds you
happen to be picked. Under `all` you are hit on **every** Special round, so the blank saves one **every time** —
its value multiplies by (N-1) in exactly the same way `all` multiplies the value of landing a Special. Pure
Wizard holds **four copies**, and it is a Quick, so it can be sprung reactively.

**So `all` is not an offence-scaling problem, and no amount of tuning the attack cards will fix it.** The
symmetric lever is the defensive one: under `all`, make protection *not* scale — e.g. Leyline blanks a single
incoming loss rather than the whole round. That is the experiment worth running next; scaling the offence is
finished and the answer was no.

**Instrument note:** `mpsim`'s hostile SELF-CHECK aborted the first `half` run, expecting Critical Hit to strike
1 when it struck 2. That is the check working — it had no knowledge of the new span. Taught it (`DALL ? 3 :
DHALF ? 2 : 1` at the 4-player probe) and the CONFIG line now prints `damageSpan=1|half|all` instead of a
boolean.

### 0m. The apex-2 flags, measured — and two framing errors of mine corrected. (2026-08-26)

These were the only never-measured flags in the engine; their "balance-neutral at 10 runs" claim came from the
broken positional-flag study (0j). Aj: *"let's run the numbers correctly first before adding it in."*

**The complaint being fixed is real:** the apex 2 is only **15**, and boosts stack on top of `fightValue`, so a
boosted Ace at 14+7 beats it. The apex is not an apex.
- `APEX_INF` — a 2 ranks at infinity, so no boost can pass it. Shields still strip.
- `APEX_NOSTRIP` — a winning play containing a 2 strips no shield.

**CORRECTION 1: I reported that no-strip is "inert without infinity". That was a statement about the ENGINE, not
the design, and I passed it off as the latter.** The engine gated it (`APEX_INF && APEX_NOSTRIP`), so the
standalone flag did nothing — but the *variant* is coherent, and Aj's case for it is the interesting one: a 2
that deals no damage **but can still be beaten** is a *contestable* tempo play. You take the lead for free; a
rival who sees the opening escalates with a boosted pair of Aces, takes the round back, and puts the damage on
you. The unbeatable version cannot produce that exchange at all, because nothing answers it. **The gate is now
removed** (engine ~1512) so the variant can exist and be measured.

**CORRECTION 2: I measured whether no-strip reduces initiative CONCENTRATION and reported "does not fix
initiative, which was its whole rationale". Nobody claimed that.** The framing came from a comment in `rulesim`
("judge it on initiative"), not from the proposal. Adding an initiative *tool* and flattening the busiest
leader's *share* are different things, and L was the wrong metric for the claim.

**PACING** (`rulesim`, median rounds, 5 runs). `rulesim` seeds the deal but `ai.js` uses unseeded
`Math.random()`, so it is stable to about ±1 round, **not** exact — an earlier draft of this entry claimed
"seeded, so exact" off a single run.

| config | 2p | 3p | 4p | 6p | 6p jab% |
| --- | --- | --- | --- | --- | --- |
| A live baseline | 11 | 14–15 | 19–20 | 30–31 | j8–9 |
| E + `inf` | 11 | 14–15 | 19–20 | **30** | j9–10 |
| F + `inf`+`nostrip` | 12 | 19 | 30–33 | **52–55** | j15 |
| G + `nostrip` only | 12 | 18 | 29 | **51–52** | j13 |

`inf` is **indistinguishable from baseline**. Both no-strip forms cost roughly **+70% at 6p** — and making the 2
beatable barely helps, which surprised me.

**WHY, quantified.** A dedicated probe counted apex plays and what happened to them:

| arm | contested % (apex plays beaten in the same round) | rounds won by an apex play |
| --- | --- | --- |
| baseline | 9 / 16 / 28 (2p/4p/6p) | 19 / 36 / 48% |
| `inf` only | 0 / 1 / 1 | 21 / 37 / 49% |
| `inf`+`nostrip` | 0 / 1 / 1 | 20 / 39 / 49% |
| `nostrip` only | **7 / 19 / 27** | 20 / 35 / 45% |

**Aj's exchange is real and frequent** — about one apex play in five contested at 4p, one in four at 6p — and
`inf` destroys it, dropping the contest rate to 1%. So no-strip-only is the variant that matches the design
intent, and infinity is what kills it.

**But the length cost is arithmetic.** At 6p, **~45% of rounds end on a play containing a 2**. Under no-strip
those rounds deal no damage, so the game needs about `1/(1-0.45)` ≈ 1.8x as many rounds: 30 → ~54, against a
measured 51–52. The 27% contest rate is nowhere near enough to offset it. **The length is not a side effect to
be tuned away — it is the share of rounds that stop dealing damage.**

**BALANCE** (`mpsim`, arms INTERLEAVED, spread = max-min win% across decks; 8 runs of 1,200 games):

| | base | `inf` | `nostrip` only | both |
| --- | --- | --- | --- | --- |
| 2p | 15.8 ± 1.0 | 18.2 ± 2.3 *(+2.4, 2.7σ)* | **12.8 ± 0.8** *(−3.0, 6.7σ)* | 11.3 ± 2.2 |
| 3p | 13.5 ± 2.0 | 11.2 ± 2.1 | **17.9 ± 2.0** *(+4.4, 4.4σ)* | 16.1 ± 3.1 |
| 4p | 16.7 ± 2.3 | 16.1 ± 2.8 | 19.5 ± 2.6 *(+2.8, 2.3σ)* | 18.6 ± 2.5 |
| 6p | 13.2 ± 1.2 | 13.8 ± 2.4 | 14.2 ± 1.7 | 13.6 ± 1.6 |

The two flags pull in **opposite directions**: `inf` widens the duel spread and slightly tightens 3–4p;
`nostrip`-only tightens the duel and widens 3p. A separate, better-powered run (8 × 2,000) put `inf`'s duel cost
at +4.4 (7.1σ). **Spread magnitudes are not comparable across game counts** — fewer games per deck inflates
spread — so compare only within a study.

**Instrument bug found and fixed:** `mpsim`'s CONFIG line printed `apex=off` whenever infinity was off, *even
with no-strip set*, because the print encoded the old pairing. The flag was applied correctly, but the report
denied it — and this file's own rule is "check the printed CONFIG". Now printed independently.

**And a replication failure worth keeping:** a first pass (10 × 800) had 3p improving under `inf` by −4.6 at
3.4σ. It did not replicate (−0.6, 0.7σ). **A 3σ result from one study is a hypothesis, not a finding.**

**INTERACTIONS with `loss=all` and `mill=universal`** (Aj's question, 2026-08-26). The mechanism first, because
it explains everything below: no-strip sets `wonWithCombo = false`, and that **one variable drives both**
downstream decisions — the shield strip *and* `millTargets`. So under no-strip an apex win is resolved **exactly
like a jab win**: no shield comes off (so `SPECIAL_LOSS_MODE` is bypassed entirely) and *every* loser mills
(so `MILL_SCOPE` is bypassed too, in the universal direction).

Median rounds:

| config | 2p | 3p | 4p | 6p |
| --- | --- | --- | --- | --- |
| A baseline | 11 | 15 | 20 | 31 |
| B `loss=all` alone | 11 | 9 | 9 | **9** (the documented overshoot) |
| G `nostrip` alone | 12 | 18 | 28 | **52** |
| H `all` + `nostrip` | 12 | 12 | 14 | **19** |
| I `universal` + `nostrip` | 12 | 18 | 31 | 47 |
| J `all` + `universal` + `nostrip` | 12 | 12 | 14 | 21 |

**`mill=universal` is nearly redundant with no-strip** — predicted by the code and confirmed: 52 → 47 alone, and
adding it on top of H changes nothing (19 → 21). No-strip already forces universal milling on apex rounds.

**`loss=all` + `nostrip` is a genuinely attractive PACING pairing.** Each fixes the other's failure: `all` alone
is far too short at 6p (9 rounds), `nostrip` alone far too long (52), and together they land at **12/12/14/19 —
flat across player counts**, better than baseline's 11/15/20/31.

**And it does NOT rescue `all`'s balance.** Spread, 6 interleaved runs of 1,000 games:

| | base | `all` | `all`+`nostrip` | `nostrip` |
| --- | --- | --- | --- | --- |
| 2p | 15.7 ± 1.2 | 15.9 ± 2.5 | 14.1 ± 3.1 | 13.9 ± 1.4 |
| 3p | 13.0 ± 2.2 | 22.4 ± 1.4 | 25.3 ± 2.0 | 15.6 ± 3.6 |
| 4p | 17.1 ± 2.2 | 29.5 ± 2.5 | 32.7 ± 2.1 | 17.1 ± 4.3 |
| 6p | 13.6 ± 3.0 | **32.8 ± 2.0** | **31.2 ± 1.2** | 14.9 ± 1.3 |

`all`+`nostrip` sits at **31.2 against `all`'s 32.8 (Δ1.6, 1.7σ — no difference)** and is *worse* than `all` alone
at 3p and 4p. So the pairing inherits the entire reason `all` was reverted in v1.31.2, and 0j's mechanism holds:
`all` multiplies the value of landing a Special by (N-1), and suppressing damage on the ~45% of rounds that end
on an apex is nowhere near enough to defuse it. **A tempting pacing result that does not survive the balance
check — which is exactly the trap 0j was written about.**

**AND THE SPREAD IS NOT THE SAME ORDER MADE WIDER — `all` REORDERS THE TABLE** (Aj's question). Spearman rho
against the baseline order is **0.36** for `all` and 0.77 for `all`+`nostrip`. Per-deck 6p win%, 6 runs of 1,500,
sorted by baseline rank:

| deck | base | `all` | `all`+`nostrip` |
| --- | --- | --- | --- |
| Paladin (Cle+Fig) | 21.7% (#1) | 10.1% (#8) | 17.3% (#4) |
| Sage (Wiz+Cle) | 21.1% (#2) | **36.3% (#1)** | 34.1% (#1) |
| Pure Cleric | 20.1% (#3) | 27.4% (#3) | 31.2% (#2) |
| Mage Knight (Wiz+Fig) | 17.9% (#4) | 15.3% (#6) | 17.0% (#5) |
| Full Set | 17.4% (#5) | 12.3% (#7) | 12.6% (#7) |
| Bard (Cle+Rog) | 16.6% (#6) | 15.4% (#5) | 16.8% (#6) |
| Pure Fighter | 16.5% (#7) | **4.1% (#10)** | 5.3% (#9) |
| Pure Wizard | 15.6% (#8) | **35.3% (#2)** | 30.0% (#3) |
| Berserker (Fig+Rog) | 13.6% (#9) | 4.3% (#9) | 3.4% (#10) |
| Warlock (Wiz+Rog) | 13.1% (#10) | 17.7% (#4) | 12.5% (#8) |
| Pure Rogue | 9.3% (#11) | 3.9% (#11) | 2.5% (#11) |
| **spread** | **12.4** | **32.4** | **31.6** |

The direction is systematic and mechanical: the winners are the **Wizard/Cleric** decks and the losers are
**Fighter/Rogue**. When every Special win costs *every* opponent a shield, a deck that can protect shields
survives the crossfire and a deck that can only attack gets shredded — precisely what the `HOSTILE_ALL` note in
CLAUDE.md predicted about "the classes whose whole kit is offensive and who own no shield protection at all".
This reproduces 0j's Pure Wizard / Pure Rogue headline with the whole table behind it.

`all`+`nostrip` keeps the width but sits closer to the baseline ORDER (rho 0.77): same top three and bottom
three as `all`, mid-table roughly restored. So no-strip softens the reshuffle without touching the extremes,
which is another way of saying it does not address the mechanism.

`nostrip` alone stays close to baseline at every count. (Its duel improvement replicates in direction across two
studies — −3.0 at 6.7σ and −1.8 at 2.4σ — so call it real but modest.) **`mill=universal`'s balance was not
measured separately here**; 0j isolated the damage to `loss=all` alone, so it is the lower risk of the two.

**Verdict: none of the three belongs in the DEFAULT rules, and all three are legitimate opt-in toggles.**
`inf` alone is the cheapest — pacing-free, fixes the boost-beats-apex complaint — but it costs duel balance and
kills the contested exchange. `nostrip`-only is the variant that actually plays the way the proposal imagines,
and it *improves* duel balance, but it makes a 6-player game ~70% longer for arithmetic reasons that cannot be
tuned out. That is a taste call, not a numbers call, which is exactly what a homebrew menu is for.

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
