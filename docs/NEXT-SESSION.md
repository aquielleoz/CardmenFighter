# Cardmen Fighter — backlog & handoff

**Build:** `node build.js` from `code/` inlines engine.js + ai.js + art.js + netview.js + qr.js →
`code/CardmenFighter.html`, then **`cp CardmenFighter.html ../CardmenFighter.html`** yourself — `build.js` writes
only `code/`, and the repo-root copy is the file people download. `faces.js` is NOT inlined (layouts retired in
v0.95; build.js stubs `window.CardFace = {}`). `build.js` parses every inlined script and **refuses to write on a
syntax error** — read its `built … bytes` line before believing a surprising measurement.

**Test gate:** `npm test` = `node test.js` (**378**) + `node netview.test.js` (**34**). Both must end **0 FAIL**;
they run straight on the sources, so run them after a source edit even if you skip the build. Everything else,
including all 43 `nettest_*` suites and the ten `lessontest*` ones, is listed in **CLAUDE.md** with its expected
count — that list is the authority, and if a count there disagrees with a suite, the suite is right.

**Player style:** **PLAYER-PROFILE.md** — a living read on how Aj actually plays (control/value grinder,
Wizard/Cleric, counter-heavy, boost-a-pair kill). Append new exported games to its ingestion log; use it for
AI-tuning, balance, and a future "play like Aj" opponent.

**Current version: v1.31.79.** The 2-apex + Forms **rework is simply the game** — the `REWORK` flag and the
classic pre-rework rules were deleted in v1.23.0 (no `setRework`, no `E.isRework()`). Twenty-one homebrew rules
live behind **Custom rules**, every one defaulting OFF, because `RULE_DEFS.some(ruleOn)` *is* the definition of
"customised".

## ☀️ START HERE — where we left off (2026-09-01)

`main` is at **v1.31.79**, working tree clean, full sweep green at **70 suites**. The only branch is
**`feat/qr-scanning`** (parked; see its BACKLOG entry for what would revive it).

**Sanity check** (from `code/`, ~1 minute):

```bash
npm test && node mptest.js && node landscapetest.js
```

Expect **0 FAIL** from each. The two gate counts in the header above are asserted by `versiontest`, so they
cannot drift; every other suite's expected count lives in **CLAUDE.md**, which is the authority. A full sweep is
70 suites and ~10 minutes — background it, and **never two suites at once** (fixed ports).

**The last four versions:** **v1.31.79** the Demon Lord never spends a card it is about to win with — a tier
BEHAVIOUR, worth a quarter of the knight→demon gap · **v1.31.78** a banked boost commits the turn, and nothing
may spend the play it bought · **v1.31.77** the AI stops throwing away the value boost it just paid for ·
**v1.31.76** the 2 explains itself — reminder text on the card, derived from the live rules, plus a Basics
lesson built on a deliberately illegal deck.

**⚑ WHERE TO PICK UP — the top of the BACKLOG.** The boost line is finished: v1.31.77 stopped the AI passing on
a boost it had paid for, and v1.31.78 stopped anything else in the same turn eating the play it bought
(**0 in 1200 duels**). The general form of it — 166 activations that leave the seat with no legal fight — was
then measured head-to-head and is **not worth fixing**; it lives in [`DECISIONS.md`](DECISIONS.md#ai-strength)
under a new **AI strength** heading, along with the only method in this repo that can measure AI strength at
all. **Read that before proposing any "the AI plays badly here" change** — every existing sim runs the same AI
on both seats and is structurally blind to strength. What is left at the top is small and unambiguous
(`pickValueBoost` boosting a fight it has already won); the **host/client fork** `nettest_sync` catches is the
real open item, still intermittent at roughly one run in four.

**The "The 2" lesson is unusual and a fresh session will otherwise be baffled by it.** Three things it does that
no other lesson does, all documented in the source and in CLAUDE.md:
- it runs on a **deliberately illegal deck** (`tutCard` fabricates cards — the Rival needs six 2s and a seat
  holds four), and `tutDropDupes` keeps the player's HAND looking legal;
- the Rival is flown by a **per-lesson `pilot`** (`lsn.pilot`) instead of `AI.takeTurn`, because a difficulty
  tier cannot promise a sequence;
- each gated step **names the exact cards it accepts** (`only`), so ignoring the instructions cannot dead-end it.
`pilot` and `only` are general hooks but currently serve one lesson — worth revisiting if nothing else needs
them, rather than assuming they earn their keep.

**READ THE FIVE MECHANICAL HABITS IN CLAUDE.md BEFORE STARTING.** They are not engineering lessons; each one cost
real time on 2026-09-01, and one of them cost *Aj* three rounds of screenshots against a stale file. Briefly: use
`Edit` rather than a `python3` heredoc for anchored replacements; absolute paths in every command; `cp` the built
HTML to the repo root after **every** build; never rebuild while a batch is running; and copy the retry when you
add a UI helper.

## BACKLOG (open work only — completed items live in the changelog below)

*Split 2026-08-31: 601 lines → this. Settled decisions, measured dead ends and design notes for shipped
features moved to [`DECISIONS.md`](DECISIONS.md) — that was a third of the section, and its own heading already
said "open work only". Two shipped design specs were deleted outright, since the changelog carries them in
full. **Ranked now: correctness first, then things a playtester meets immediately, then features and balance.**
A struck-through entry does not belong here — if it shipped, move it to the changelog.*

### Correctness

- **`pickValueBoost` NEVER ASKS WHETHER WE ARE ALREADY WINNING** (found 2026-09-01 while measuring the entry
  now in [`DECISIONS.md`](DECISIONS.md#ai-strength)). It casts whenever `boostEnablesWin` finds SOME play the
  boost converts into an overtake, without checking that a legal play already exists — so it can spend a boost,
  and the card carrying it, on a fight already won, and in 3 of 1200 duels the card it spent was one the play
  needed. `counterfeitHelps` has the guard to copy verbatim: `if (beatsCur(pl.hand)) return false;`.
  **Small: worth ~nothing in win rate** (it is 3 of the 166 in that entry, which pool to about a point in
  total). It is here because it is unambiguous — unlike the transform cases, there is no argument that
  spending a card on a fight you had already won is a real choice.
- **★ THE HOST/CLIENT FORK `nettest_sync` CATCHES — STILL OPEN.**
  Measured **1 failure in 8** on 2026-08-30 after the mirror dedupe, and **2-3 in 8** before it. At n=8 those
  are not distinguishable, so **do not read the dedupe as an improvement** — treat the rate as "roughly one run
  in four" until someone runs enough replicates to say better.
  **The failure is PERSISTENT, not a mid-flight window.** The suite already polls until a mismatch clears, so a
  transient disagreement while a mirror is in flight is excluded by construction:
  ```
  DIVERGED: the host thinks the client holds 6 cards; the client holds 4
  DIVERGED: the host thinks the client holds 8 cards; the client holds 6
  ```
  **THE CARD IDS NAME THE GAP EXACTLY — the client is missing precisely that round's DRAW:**
  ```
  HOST   seat1 (8): 5D#16 6H#22 9H#34 10H#38 11D#40 13D#49 1D#1 2D#4
  CLIENT seat0 (6): 5D#16 6H#22 9H#34 10H#38 11D#40             1D#1
  ```
  Always exactly the two dealt cards. So a mirror carrying the deal is **never sent, never received, or applied
  and then overwritten by an older one** — and the first of those is now unlikely, since the host's own trace
  showed it broadcasting the grown hand.
  **THREE HYPOTHESES TESTED AND REJECTED. Do not re-run them:**
  - **A second ceremony discarding a held round mirror.** `clientPlayCeremony` nulls `pendingRoundMirror`,
    which would throw a deal away. Landing the held mirror first made the suite **WORSE — 5 failures in 8** —
    and lifecycle tracing then showed **no `mirror HELD` events at all** during a failure. The client applies
    every mirror it receives.
  - **The broadcast storm.** Real, and fixed in v1.31.65 (97% of mirrors were byte-identical duplicates). The
    failure rate did not move.
  - **The v1.31.64 rules change.** A/B'd against the pre-change build: same rate. It predates it.
  **RE-MEASURED 2026-08-31 ON v1.31.74: 35 RUNS, 35 CLEAN.** That excludes the recorded rate outright —
  P(35 clean) is **0.00%** at 1-in-4 and **0.93%** at 1-in-8 — while **1-in-16 (10.5%) and rarer remain
  possible**, so this is "no longer reproduces at the recorded rate", NOT "fixed". The likely reason it dropped
  is **v1.31.67**, which landed AFTER the last measurement: `isRoundDeal` replaced `handGrew` and added an
  **empty-pile** clause, so a mirror is held far less often — and a held mirror is the only thing
  `clientPlayCeremony` can discard.
  **THE DISCARD PATH STILL EXISTS AND IS NOW TRACED.** `clientPlayCeremony` still does `pendingRoundMirror=null`,
  so a second ceremony arriving before `finishClientCeremony` still throws a deal away. The lifecycle prints
  `mirror HELD` / `mirror HELD -> DISCARDED` / `mirror HELD -> revealRound`, and **`nettest_sync` now dumps both
  hands' card ids, the exact missing ids, and both peers' trace tails on failure** — the previous investigation
  stalled precisely because that detail came from bespoke instrumentation that was then thrown away, which is
  why "no HELD events" could not be re-checked nine versions later.
  **DEMONSTRATED WITH A FORCED DROP:** dropping one deal mirror on purpose leaves the client missing **precisely
  that round's two dealt ids** — the recorded signature, reproduced on demand:
  ```
  HOST   sees seat1 (8): 5C#16 6C#20 7C#25 7C#24 9S#35 10S#38 12S#47 12C#45
  CLIENT own hand   (6): 5C#16       7C#25 7C#24 9S#35 10S#38 12S#47
  IDS THE CLIENT IS MISSING: 6C#20 12C#45
  ```
  **THREE MORE THINGS ARE NOW SETTLED — do not re-derive them:**
  - **A DROPPED MIRROR IS NOT AUTOMATICALLY PERMANENT.** With a forced drop, one run in two recovered on its own,
    because the next host state change produces a fresh mirror. Permanence needs the loss to coincide with the
    host's state going quiet.
  - **"CLEAR THE DEDUPE CACHE ON A ROUND CHANGE" IS A NO-OP.** `round` is in the mirror (`netview.js`), so a round
    boundary always changes content and the deal mirror is never suppressed by dedupe. This was about to be built
    before checking.
  - **THE LINK TO AJ'S "PRESSED PASS AND NOTHING HAPPENED" IS WEAKER THAN THIS ENTRY USED TO CLAIM.** v1.31.74
    fixed a **confirmed** cause of that exact symptom (`updateActions` did not know about `busy`, so Pass rendered
    enabled and swallowed clicks for ~2s), and the stale-intent guard is a second confirmed cause. Do not treat
    that report as evidence for this fork.
  **TRIED AND WITHDRAWN — `reassertMirror()` at the park points.** The idea: `broadcastMirror` dedupes and
  `lastMirror` is otherwise cleared only on channel re-bind, so a park would freeze a stale client forever;
  clearing the cache when the host parks would make any lost mirror self-healing. **It could not be shown to fix
  anything** (5 of 6 forced-drop runs still diverged) and was reverted. The reason is instructive: after a
  forced drop the game is on the **HOST's** turn, and `settle()` gives up before either side acts — so the
  persistence in that experiment is **an artefact of the harness**, not a deadlock. Do not re-propose it without
  an experiment that reproduces true persistence.
  **NEXT STEP — BUILD A PROBE THAT DROPS THE DEAL *AND* LEAVES THE CLIENT TO ACT NEXT.** That is the one
  configuration where a stale client can genuinely deadlock the table (it is `busy` or acting on a board the host
  has moved past, and the host is parked waiting for it), and it is the configuration the current probe never
  reaches. Everything else about this bug is now instrumented; this is the missing experiment.
  **(Superseded) TRACE THE RECEIVE SIDE, and do not instrument the send side again.** The host is already known
  to broadcast the grown hand. Log every mirror's hand length *as it arrives on the client*, next to the `q`
  stamp, and compare against the host's send log for the same window. The question to answer is narrow: **does
  the mirror carrying the deal reach the client at all, and if it does, what happens to it?**
  **Very likely the same root cause as Aj's real-game report of pressing Pass and nothing happening** — both
  are a client acting on a board the host has already moved past. Both peers dump `__cmfTrace()` into the saved
  battle log, so a real game can be compared move-for-move too.
  **`nettest_sync` is the only suite in the repo that compares the two peers to EACH OTHER** rather than each
  to expectations. It found this; nothing else could. Keep it green-or-explained, never disabled.
  **BUT BE ACCURATE ABOUT WHAT IT HAS EARNED (corrected by Aj, 2026-09-01).** The suite was written on
  2026-08-28 out of his *"we can't even get to round 2 legally on the same computer"* — but **that complaint's
  actual cause was the drag-to-play bug**, found the next day by his own A/B (Fight worked, dragging did not)
  and fixed in v1.31.56. This suite did not diagnose it. So its record is: the fork below (real, but **not
  reproducing** — 35/35), and the **stall** found on 2026-09-01, which is a live catch on a clean build. Do not
  write the round-2 complaint and this fork as one lineage; they are three separate things.
- **★ `stateSeq` IS A CLIENT-INTENT COUNTER, NOT A STATE VERSION — AND THAT IS WHY VALID MOVES GET REFUSED.
  ONE JOB, NOT TWO.** (Merged 2026-08-31 from two entries that each described half of it.)
  The stamp is bumped only in `hostApplyMove`, so **the host's own plays and the round draw never advance it** —
  visible in a trace as one `q` carrying two different hand sizes. That is why the v1.31.65 mirror dedupe had to
  compare CONTENT rather than the stamp.
  **The cost is not zero, and the record used to say it was.** CLAUDE.md and the v1.31.54 note claimed *"Measured
  cost: zero (9 sends, 9 received, 0 refused in a full game)"* — measured in the lab, one machine, no latency.
  **In Aj's real game the guard refused five moves:** three emotes (`q=0`, `q=9`, `q=10`) and **two passes**
  (`q=11`, `q=14`) — a player pressing Pass and nothing happening.
  The emote half **SHIPPED in v1.31.57** (emotes and rule suggestions are board-independent, so they are exempt;
  that also un-broke `nettest_emote`, red at 17/2 since v1.31.54). **The two refused PASSES are still open**, and
  exemption is not the answer there — a pass *is* formed against a board, so the stamp itself is wrong.
  **Fix the stamp and the refusal policy together:** once it counts real state changes rather than client
  intents it will refuse far MORE often, so a correct stamp with today's policy is worse than the bug.
  And measure it over a REAL connection, not in the lab — that is the mistake that produced the false "zero".
- **A CLIENT'S HEADER ONCE READ "Round 8 — YOU WON" WHILE THE HOST SAT AT ROUND 5** (Aj, 2026-08-28, third log
  pair). The rest of that report is resolved — the phantom rounds were drag-to-play (v1.31.56), the missing
  lines were the narration audit (v1.31.58), the doubled narration was `sayOnce` (v1.31.53) — but nothing has
  been shown to produce a client running THREE ROUNDS ahead of the host. The stale-mirror guard (v1.31.54) and
  the ceremony teardown (v1.31.67) are both candidates and neither has been demonstrated.
  Likely the same root cause as the `nettest_sync` fork at the top of this list; chase that one first, since it
  reproduces on demand and this does not.
- **A FINISHED NETPLAY GAME LEAVES ITS WIN PAGE BEHIND** (Aj, 2026-08-28): end a netplay game, go back to the
  netplay screen, and you are greeted by the PREVIOUS duel's win page until you press Leave online. The end
  overlay is not cleared when netplay re-renders, so the next lobby is behind a stale modal.
- **STARTING A NEW NETPLAY GAME DROPS YOU INTO THE PREVIOUS DUEL'S END SCREEN** (Aj, 2026-08-29: *"you have to
  press leave then do the whole handshake thing again"* — so the cost is a full re-handshake, not just a stray
  overlay). Reported earlier as "stale win page"; this is the sharper version, and the end screen appears
  **after** the new game starts, not before.
  **What is VERIFIED, and it is an asymmetry worth knowing:**
  - The HOST path is clean. `hostStartRealN` calls `startGame(YOU)`, and `startGame` is the **only** site that
    runs `gen++` (line ~2653) and `hideOverlay()`.
  - The CLIENT path never bumps `gen`. `applyMirrorNow` does `started=true; state=st; … render()` with no
    `gen++` anywhere, so **a stale `setTimeout` continuation from the PREVIOUS game still satisfies `g===gen`**
    and can run against the new one — including a path that ends at `endGame()`.
  - `.overlay` is `z-index:100000` and `#netroot` is `99999`, so anything showing when netplay starts sits on
    top of the lobby; `NET.start` never touches the overlay.
  **NOT FIXED, because there is no repro yet** — the stale-`gen` asymmetry is the leading candidate and it is
  still a theory, and theories have been wrong every time this week. **Get the repro first:** play a netplay
  duel to a finish, start a second one without leaving, and watch whether `endGame()` is re-entered (a
  breakpoint or a `trace()` in `endGame` will say immediately). If it is, giving the client a `gen++` on the
  first mirror of a new game is the fix; if it is not, look at what re-shows the overlay instead.
- **CARDS CAN PAINT BEFORE THEY HAVE A RANK** — two rendered as `0 undefined 0` on Aj's phone and then
  corrected themselves a moment later (*"the undefined cards loaded a bit later"*). Cosmetic, transient, and the
  residue of the 2026-08-28 relay game: **the desync it came with was a real bug and is fixed in v1.31.49** (see
  the changelog — `awaitRival` set two things and every path that handed control back cleared one). Worth
  guarding anyway: a card with no rank should not render at all.
  Note I initially ranked this as *"possibly the more diagnostic of the two"* on the theory that a UI stall
  cannot invent a malformed card. It could and did; the ranking was wrong, and Aj's follow-up ("loaded a bit
  later") is what corrected it.


### Things a playtester meets immediately

- **SEAT 0 ALWAYS LEADS ROUND 1, SO THE HOST ALWAYS LEADS ONLINE** (Aj: *"in net play it seems like the host
  always leads the jabs too"*). Verified: `newGame` sets `turn: 0, initiative: 0` with no roll, and
  `nettest_rtc` encodes it (`'host leads round 1'`). Fine in solo — seat 0 is the player — but online it hands
  the host a permanent first-mover edge in every game. A design question, not a defect: randomise the opening
  seat, alternate it, or decide the edge is acceptable and say so.
- **A NETPLAY DUEL HOST LOGS THE SOLO LINE AND SHOWS AN AI TIER.** `logMsg`/`matchupTag` branch on
  `mpCount>2`, **not on whether this is netplay**, so a 2-player online HOST prints
  *"New duel — you play Pure Cleric vs Dustin (**Fighter**) on Berserker"* and a header ending
  `· Fighter` — where `Fighter` is `DIFF_NAME[difficulty]`, an **AI difficulty tier** that means nothing
  online. The client has its own correct line (*"Online duel — you play X"*, ~6257).
  **Cosmetic, but it cost real debugging time on 2026-08-28:** I read the AI tier as evidence that the host
  was playing a bot, and the deck names as evidence of two seats, and built two confident wrong diagnoses on
  it. Aj spotted both (*"isn t fighter the ai player tag?"*). A label that lies about the mode is worse than
  no label. Fix: branch on netplay, not on player count.
- **THE PHONE PLAY AREA NEEDS A REAL-DEVICE CHECK, and the decided fix may no longer be needed.** The overlap
  MEASURES CLEAN since v1.31.66 (it was caused by the sideways scroll and went away with it), but it was only
  ever reported from Aj's phone and has not been re-checked there. **The zones-move-into-the-panels change was
  DECIDED on 2026-08-29 and is unbuilt** — its motivation has since evaporated, so re-measure before building
  it. The corner-overlay arithmetic, and the collapsing-hand proposal that was considered and declined, are in
  [`DECISIONS.md`](DECISIONS.md#phone-layout).
- **UNVERIFIED LEAD — the "netplay battle log does not scroll" report may not be netplay-specific at all.**
  `#log` is `overflow-y:auto` with no netplay override, so a `min-height:0` chain broken by the `.fighter`
  overflow is a plausible SHARED cause. Measure before filing it as a netplay divergence. (The two seams that
  netplay and solo actually diverge in are mapped in [`DECISIONS.md`](DECISIONS.md#netplay-architecture).)

### Tooling

- **`nettest_full` FAILED ONCE IN SEVEN RUNS on 2026-08-29 and was NOT fully cleared.** It went 4/1 immediately
  after the v1.31.56 change, then 6/6 green. The failing assertion was **not captured**, which is the mistake to
  avoid repeating. Structurally the change cannot reach it — on a client the only path into `playCards` is the
  drag, and that suite drives clicks + Fight, which short-circuits in `doFight` — and the suite has a long
  documented history of intermittency. Recorded as characterised-but-open rather than dismissed: **capture the
  failing assertion next time it goes red.**

### Features

- **OPEN THE BATTLE LOG AS AN OVERLAY, like the 🔍 View card reader** (Aj, 2026-08-31: *"i think for the logs,
  we can open it like how we do the view card? but slightly transparent?"* — agreed at the time and, like the 2s
  tutorial, **never filed; caught 2026-09-01 when he asked what else was missing**).
  **This is NOT the scrolling bug.** v1.31.59 stopped a long log evicting the hand, which fixed the symptom he
  hit; the overlay is the design he actually proposed, and it is still open. The case for it is the phone: the
  log competes with the board for vertical space on exactly the viewport where space is scarcest (see the 340px
  floor and `landscapetest`), and an overlay removes it from the vertical stack entirely instead of rationing it.
  Precedent to copy: the 🔍 View card reader is already a phone-only overlay (`#viewCardBtn` exists only inside
  `@media (max-width:720px) and (max-height:800px)`, which is why `viewtest.js` runs at 390×780).
  Two things to get right, both already recorded as traps: the overlay must outrank `#netroot` — use the
  `--zNetroot`-derived family, never a bare z-index — and **DOM presence is not visibility**, so assert it with
  `elementFromPoint`, not by reading `textContent`.

- **A real one-tap rematch over netplay** (Aj, 2026-08-25 — the `🔄 Rematch?` emote is the expression; this is
  the action). Today the win overlay's "New Game" just calls `openSetup()`, so an online pair must redo the
  whole invite-code exchange to play again. Wants: the host restarting the engine and re-broadcasting `t:'setup'`
  over the **live** connection, seats and decks reused, both sides confirming — plus its own netplay suite. The
  emote set already covers the negotiation ("Rematch?" → "Yes!"), so this is purely the mechanism.
- **THE FAMILY-SHAPE PROGRAMME IS ESSENTIALLY COMPLETE. One cheap piece is left.** (Rewritten 2026-08-31: the
  original entry listed eleven sub-items and **ten had shipped**, including all four it called "still missing
  and NOT yet wanted" — trio+single, four+two, airplane and variable-length straights all landed in v1.31.39.
  Kits v1.31.24-26, Quadro v1.31.29, the chop v1.31.33, chop-strips v1.31.38, tooltips v1.31.35, bulk actions
  and presets v1.31.30. The changelog carries each.)
  **What is actually left: four of a kind + ONE spare** — Big Two's shape, distinct from our 四带二's two spares.
  Named in CLAUDE.md as "the only cheap piece" of a Big Two preset, which was itself considered and declined
  (that reasoning is in CLAUDE.md, not here: Big Two's identity is the poker ladder and suit tiebreaks, and we
  refuse both on principle).
  **The house rules for adding one are settled and live in CLAUDE.md** — group by KIND not by source game, every
  rule defaults OFF, a shape that shares a size signature with another must be a MODE rather than two toggles,
  re-read every PRESET afterwards (a preset is an exact state, so a later rule is implicitly off in it), and
  measure with `mpsim`/`rulesim` expecting **options, not tempo** — eight rules in a row have left pacing
  untouched. Also check the wide panel still fits at 1512×945; there is no slack left.
  Why FLUSH will never be one of them is in [`DECISIONS.md`](DECISIONS.md#balance).
- **Rogue "slash": an on-demand card that LOWERS the current pile's value** (Aj, 2026-08-25 — filed for when
  Rogue needs a boost in balancing; nothing built). Distinct from Caltrops, which is a standing `oppDelta` debuff
  on opponents' cards. Aj's example: pile is a boosted pair of 4s at effective 6, you hold a pair of 5s; a
  "slash 2" drops the pile to 4 and your 5s become legal. The engine already has the hook — `st.pile.mod`,
  folded in by `refreshPile()`.
  - **Measured support (`stucksim.js`):** at 6 players every deck is stuck on ~85% of following turns, and
    **62-72% of those are VALUE-stuck** (right shape, too low) rather than shape-stuck. Pure Rogue is **68%
    value-stuck, the LEAST shape-blocked deck (32%)**, and has the highest share of **deficit-of-one** losses
    (14%) — it misses by a single point more than anyone. A slash-2 would convert roughly **24% of Rogue's stuck
    turns into plays** (~20% of its following turns), against a current 7.2 plays per game.
  - **It is not a Rogue-specific problem.** Every deck is 62-72% value-stuck and a slash-2 would unlock 19-24%
    for any of them, so this works as a *card* (only Rogue holds it) rather than as a fix for a Rogue weakness.
    Rogue benefits slightly more than average, and benefits most from the cheap slash-1.
  - **Corrects an earlier claim:** Rogue's problem was described as "shape, not economy". It is **value**.
  - Also noted: **Caltrops is stronger in multiplayer than its text says.** `equipDelta` sums `oppDelta` across
    *every* opponent, so one Caltrops is -2 to all five at a six-player table. Its text reads "the Rival's
    highest card" (duel wording) and undersells it.
- **A count-up "charge" CLASS** (Aj, 2026-08-25 — his current lean; nothing built). Full analysis in
  **[`docs/COUNT-UP-DESIGN.md`](COUNT-UP-DESIGN.md)**, which came out of his brother asking why the game has
  shields at all and proposing "Kick Coins" — a count-up replacing them wholesale. Aj's landing point: not a
  rules overhaul, **one class whose schtick is counting up**.
  - **The count-up resource already exists twice**, so this needs no tokens and no new zone: the **energy pile**
    already counts up, is card-backed and public — a charge class could gate effects on how much it has *banked*
    rather than spent, which genuinely conflicts with everyone else's "spend energy on effects". And
    `TRANSFORM_GATE='table'` is *already* a count-up (total `shieldsLost` unlocks Rides/Forms).
  - Read the doc's **bias-correction section** before re-opening the wholesale version: the first analysis
    leaned toward the shipped shield design, and four of its objections did not survive re-checking — notably
    "length balloons with player count", which is false if a Special win pays **a coin per opponent beaten**
    (the v1.31.0 fix, mirrored).
  - The one objection that *did* survive: the **leader-snowball is worse under coins**, because a win advances
    only the winner where a shield hit damages everyone, and initiative is already 1.8x concentrated.
- **QR SCANNING IS BUILT, GREEN, AND PARKED on `feat/qr-scanning`** (PR #29, closed 2026-08-25, 21/0).
  **Why it is not merged:** scanning needs an origin that can be granted camera access, and a file opened from
  Android's Downloads is `content://` — an opaque origin — so Chrome rejects `getUserMedia` without ever
  prompting. **MEASURED AND SETTLED 2026-08-28:** the same file over **https is GRANTED** with a live preview.
  **What would revive it:** a decision to host the file. The blocker is no longer technical.
  Full reasoning, the origin experiment, and everything else considered for making joining easier are in
  [`DECISIONS.md`](DECISIONS.md#joining-discovery-and-the-qr-path).

### Balance and design

- **6-player games run 33 rounds; duels run 11. That is probably the root cause.** (2026-08-24, from Aj's
  question "is it weird that everybody mills but not everybody loses a shield?") Under the live
  `SPECIAL_LOSS_MODE='chosen'` + `MILL_SCOPE='targeted'` pairing a Special win costs the table **one** shield
  however many people are at it, so total shields scale with player count while damage does not. Median length
  goes **11 (2p) -> 15 -> 22 -> 33 (6p)**. The engine's own defaults (`all`+`universal`) hold it **flat at ~10
  rounds** at every count.
  - Everything else we chased today — jab-round grind, option starvation (0.5 legal plays when following at
    6p), initiative concentration (1.6-1.9x) — has **three times as long to compound** in a 6-player game.
    Consider fixing length before designing around any of those symptoms.
  - Do NOT just flip to `all`+`universal`: ~9 rounds may be too short for six players, and it is a large rules
    change. The question worth designing is whether something between the corners lands at ~15-18 rounds —
    e.g. a Special win stripping shields from *more than one* rival as the table grows, or `START_SHIELDS`
    scaling down with player count instead.
  - Measure with the one-off in this session's history (median/mean/max rounds by player count for both
    pairings); worth turning into a small committed harness if this is picked up.
- **Initiative has no catch-up, and that is probably the real problem** (Aj, from play — 2026-08-23; the
  finding that came out of testing and REJECTING the jab-cantrip, see the note below). In `engine.js` ~1685 a
  round win does `st.initiative = winner; st.turn = winner;` — **the round winner leads the next round.** That
  is a rich-get-richer loop, and it collides with two other rules:
  - **only a special breaks a shield**, and
  - you may only beat the pile with a **higher value of the SAME shape**.

  So a player who is not winning rounds can almost never *lead*, and therefore can almost never deploy a
  special — their full house is dead weight until somebody else happens to lead a full house at a lower value.
  Aj, mid-game: *"three rounds in a row throwing jab after jab… I didn't want to break my full house to answer
  their pair."* It gets worse with player count, because the pile is contested by more people.

  **The game has CARD catch-up (shields-as-cards, loser-mill) and NO INITIATIVE catch-up.** That asymmetry is
  the thing to attack. Directions, none designed yet:
  - **Rotate the lead** instead of awarding it to the winner — clockwise, or to whoever has led least recently.
    Cheap to try and directly measurable (`mpsim.js`, and watch whether special-cast rates rise).
  - **Let a bigger shape answer a smaller one at a cost** (energy, or reduced banking), so holding a special is
    never structurally dead.
  - **Frame passing as a real choice in the UI.** Aj: *"I think the real strat is really to pass."* The engine
    agrees — a pass spends no hand cards and still banks energy via the loser-mill — but the tutorial currently
    teaches *"leading a jab is the safe way to stock energy"*, which may be teaching the weaker line.
  - **STUDIED 2026-08-23 — the strategic pass does NOT work in multiplayer; the gate stays.** `passsim.js`
    measures it as a within-game A/B (same table, half the seats allowed to pass, seats rotated, one deck and
    one tier for everyone), so deck, tier and seat luck are identical in both arms by construction:

    | case | delta to the passing arm | |
    | --- | --- | --- |
    | demon DUEL | **+17.3 pts** | real — reproduces the original "~59% vs always-contest" |
    | knight duel | +1.5 | noise — the duel edge is a **demon** edge, not a smart-tier one |
    | 6p, thresholds 5→10 (fires up to 8x/game) | +0.6 / −1.7 / +1.7 / −0.9 / −2.2 | all noise |
    | 3p / 4p, 3200 games | +0.9 / −0.1 | noise |

    So the old comment was wrong in an interesting way: it said conceding "hands the trick to several
    opponents", implying **harm**. There is no harm — the policy is **inert**. Conserving a card is a
    **two-body** attrition edge; against five opponents the marginal card stops mattering, so the pass fires
    and changes nothing. Raising the threshold just buys more firings of the same zero.
  - **Aj's own policy was also tested and is the better idea, but still not significant.** The shipped rule
    concedes on *hand size*; Aj was conceding because he *held a full house he meant to lead*. That is a
    different rule (`AI.setStratPassMode('combo')` — concede a jab whenever you hold a Special). It is the only
    variant with a consistently positive sign, **+0.9 at both 3p and 4p over 3200 games** — inside noise. Worth
    revisiting **after** an initiative fix, because its whole premise is "I will get to lead this later", which
    is exactly what the initiative loop denies. A low-power +4.0 regressed to +0.9 at 6x the games; don't be
    fooled by the first run.
  - **Two things the study turned up that matter more than the pass itself:**
    1. **Initiative concentration grows with player count.** The busiest leader holds **40% of rounds at 4p**
       (fair 25%) and **32% at 6p** (fair 17%) — 1.6-1.9x its share. Everyone leads *eventually* across a
       33-round game, but the local streaks are real, and that is the "three rounds in a row" feeling.
       `passsim.js` prints this, so it is the harness to evaluate any initiative fix against.
    2. **The AI is not jab-locked at all — only ~20% of its plays are jabs** (it casts ~56 Specials a game at
       6p). A human felt starved of Specials while the AI was swimming in them. **That asymmetry is the real
       lead**, and it is consistent with the initiative loop: the AI keeps winning rounds, keeps the lead, and
       keeps leading Specials. Find out what the AI does that a human cannot before redesigning anything.
  - The original observation, for the record. `ai.js` 363:
    `if (strategicPass && st.numPlayers === 2 && hand.length <= STRAT_PASS_MAX) return {action:'pass'}` —
    deliberately passing a *winnable* jab to conserve cards is **hard-gated to 1v1**. In a free-for-all no AI
    ever strategic-passes, which is exactly the mode where Aj found passing to be right. Two consequences:
    (a) the AI is probably playing the multiplayer game wrong, and (b) **every free-for-all balance number we
    have was measured with strategic passing switched off**, so `mpsim.js` may not describe the real strategic
    landscape at all. Cheapest possible experiment: drop the `numPlayers === 2` guard, re-run `mpsim.js`, and
    watch both the win rates and how many jab exchanges a game contains. Do this BEFORE designing an initiative
    fix — the jab-spam may be partly an AI artefact rather than a rules problem, and it would be embarrassing
    to redesign initiative to fix a missing `if`.
- **The "outbid" pass model for the AI** (Aj — parked 2026-08-24, may come back). The AI currently picks the
  *lowest safe single* to contest a jab, and never asks *"will this card even survive five opponents?"* Aj's
  reason #3 for passing was exactly that: middling values get outbid, so spending them is waste. Unlike the
  shipped hand-size heuristic (measured inert in multiplayer, see the note below) this signal **gets stronger
  as the table grows**, which is the dimension where the problem actually scales.
  - **Decide by measurement whether it goes on knight AND demon, or demon only** (Aj's explicit question). Do
    not assume it transfers: the *existing* strategic pass measured **+17.3 pts for demon and +1.5 for knight**
    in duels — same code, and the effect was real for one tier and noise for the other. `passsim.js` takes a
    tier argument for exactly this.
  - Implement as a third `setStratPassMode('outbid')` beside `'hand'` and `'combo'` so all three stay
    comparable in one harness.
- **A gacha-style storyline** (Aj, idea — parked, ahead of netplay AI in the queue, not designed). Nothing
  specified yet. Worth noting that **v1.30.0 just built the substrate for it by accident**: a roster of 32
  named characters, grouped into five tiers, each with a distinct play style and a name that already flows
  through the whole naming funnel. A collection/progression layer has something to collect now.

- **Suit ≠ class — future direction** (Aj, design intent, not yet built): the current 1:1 map (♦ Wizard,
  ♥ Cleric, ♣ Fighter, ♠ Rogue) is temporary. There will stay **only 4 suits**, but eventually **more than one
  class per suit**, and **hybrid classes** — e.g. an **assassin** that is *both* Fighter and Rogue, with **its
  own card set** (it does NOT reuse the pure Fighter or pure Rogue cards). This is also the natural home for a
  real **draw engine**, which is what would make the reorderable energy pile matter in more than the ~39% of
  games that currently reach a reshuffle (`node recyclesim.js`).
- **AI use of energy-pile order** — parked (Aj floated Demon Lord only). The Rival still spends FIFO, so the
  public reorder log lines are a human-only tell on purpose. See `ENERGY-REORDER-DESIGN.md`.

### v1.31.79 — the Demon Lord never spends a card it is about to win with

A **tier behaviour**, not a strength patch. `keepsTheWin` — v1.31.78's rule that nothing may spend a card the
committed play needs — now runs **all the time at demon**, where every other tier still applies it only to a
fight already paid for with a boost. Aj's three reasons, and only the last is about win rate: a real behavioural
difference between knight and Demon Lord, something a player can feel across the table and eventually learn to
exploit, and a wider gap between the top two tiers.

**I TALKED HIM OUT OF IT FIRST, WITH A NUMBER THAT MEANT NOTHING.** The measurement said +1.3 points and I
reported it as "too small to be a difficulty lever" — comparing it to nothing at all. Measured against the tier
step itself:

| | knight→demon gap |
| --- | --- |
| before | +6.14 pts, 13.5σ |
| after | **+7.63 pts, 16.7σ** |

**+1.49 points is about a quarter of the entire knight→demon gap.** "Small" is not a property of a number.

**What it looks like at the table.** Knight will, now and then, turn a Queen into a Form while holding the pair
of Queens that would have won the round — a fair trade in the long run, and in character for the tier. The Demon
Lord will not: if a card is part of the play it is about to make, nothing else gets to spend it. Two thirds of
the 166-per-1200 cases this suppresses are exactly that J/Q/K-into-a-Form trade, which is **why it is a
personality and not a fix applied everywhere.**

**One clause is load-bearing and its absence is invisible:** with no pile, or a pile it cannot answer, there is
no fight to protect — and without that early return the Demon Lord reads "removing this card leaves me no legal
play" (true, but only because there never was one) and **refuses every activation for the rest of the turn**. It
would stop ramping, drawing and transforming on exactly the turns it most needs to. Asserted directly: on a
round it cannot contest, it still banks energy.

**Everything else measured flat.** Deck balance at demon over three replicates: spread 10.9/10.4/8.5 before
against 9.2/10.4/9.3 after, Pure Wizard 55.2 → 54.4 mean, all inside the ±1.3 per-deck noise. Persona parity
unaffected. Cost: 0.3% of activations. **Controls: knight-vs-knight and demon-vs-demon both land on exactly
50.00%** over 6000 decided games — the check that two-arm pooling really cancels the seat advantage, which is
worth ~2.3 points here and would otherwise swamp everything above.

**A correction to CLAUDE.md fell out of this: `personasim`'s spread at 900 games is noise.** Three CONTROL runs
— six identical personas, true spread zero — printed **5.6, 1.3 and 4.6**. A single run flagged this change WIDE
on one build and OK on the other, and both were meaningless. Run it three times or do not quote it.

7 assertions in `test.js` (371 → **378**), stable over 40 runs, each verified to discriminate: the tier gate
(2 red with the guard on for everyone) and the nothing-to-protect clause (1 red, and the case that catches it
has to be a pile the seat CANNOT answer — a bare "no pile" board passes either way).

### v1.31.78 — a banked boost commits the turn, and nothing may spend the play it bought

The residue of v1.31.77, and it closes completely: **boost-then-pass goes 10 → 0 in 1200 knight duels.**

`playPhase` banks the boost and keeps looping, and the loop then cannibalised the very play
`boostEnablesWin` had picked. All four survivors were one shape — an activation *after* the boost spending a
card the boosted play needed:

```
["BOOST","DRAW","DESTROY","TRANSFORM","pass"]    transform took a Queen out of the boosted pair
["TRANSFORM","BOOST","EQUIP","DISCARD","pass"]   equip took the 6♣ out of the boosted trio
["TRANSFORM","BOOST","RAMP","DISCARD","pass"]    discardOpp took the 3♦ out of the boosted straight
["BOOST","EQUIP","pass"]                          equip again
```

**THE MECHANISM IS WORTH KNOWING, BECAUSE IT IS THE BOOST THAT UNLOCKS ITS OWN PREDATOR.** `equip` is guarded by
`willFight` — don't burn an own-highest buff right before passing — and `willFight` is FALSE while nothing is
legal, which is exactly the position a boost is cast from. So the equip sits out the first pass, the boost makes
a fight legal, and the equip then becomes eligible and eats the fight it was waiting for.

**`keepsTheWin(c)`: while a boost is banked, no activation may spend a card that would leave no legal fight.**
The test is `legalFightPlays` on a hypothetical hand rather than a remembered card list, for two reasons that
are each asserted:
- the committed play may be a **straight**, which `avoidCombo`'s rank-count rule (`cnt[c.rank] >= 2`, the
  existing "don't break a Special" filter) cannot see at all — every card of a run is a singleton;
- holding a **second** winning play makes spending the card harmless, and a frozen list would refuse it anyway.

Wired into `pick()` (which covers thirteen of the fourteen activation branches) and into the **transform**
branch, which does not go through `pick` and was seed 101's culprit.

**TWO THINGS BIT ON THE WAY, BOTH ALREADY WRITTEN DOWN IN CLAUDE.md, BOTH WALKED INTO ANYWAY:**
- **`effectOf` vs `effectFor`.** The one effect whose cost is not its own card is Ares's Super `reclaim` — **The
  Wheel** — which shuffles the whole hand back into the deck. `wheel` exists *only* as the Super override, so
  the base effect never carries it and the refusal silently never fired. Same trap that hid three Back Stab
  bugs. `keepsTheWin` now reads `effectFor` itself rather than taking the effect as a parameter, so no call site
  can get it wrong.
- **A green test that proved nothing.** The Wheel assertion read "is 8♣ still in hand?" and **passed on the
  broken build** — the Wheel shuffles the *Discard* back in too, so the card it had just spent was dealt
  straight back. It asserts the activation log now. A separate one asserted `forms.length === 0` on a board
  where the Queen tier was shield-gated shut, so it was refusing nothing; the gate is now staged and asserted
  directly.

**A THIRD COST THAT IS NOT THE EFFECT'S OWN CARD, found by the suite rather than by me: the BROADWAY PITCH.**
Critical Hit / Ultima Attack / Armor Piercing discard a 10/J/Q/K/A as well, and the ENGINE picks which — so a
staged hand of three Queens has a Queen pitched every time. It surfaced as a **flaky test**, 2 runs in 40, and
`keepsTheWin` now refuses a `pitchHigh` cast when ANY Broadway card in hand is load-bearing. Naming our own
pitch through `opts.pitch` was built first and then **removed**: no test could tell it from the engine's default
(which already takes the lowest card), and ours could pitch a *higher* card than the engine would. The strict
refusal needs no knowledge of the engine's rule and costs nothing measurable.

**AND THE FLAKE BEFORE THAT ONE WAS THE SUITE'S OWN FAULT: a transform DRAWS A CARD.** If that card is a Jack
the AI transforms again, so `forms.length === 1` was a coin flip on the deck — 8 runs in 40. It counts QUEENS in
the zone now. Both flakes were found by running the gate 40× rather than once; **a suite that is green on one
run is not evidence, and neither of these would have survived to the sweep.**

**Cost of the guard: nothing measurable.** 16,939 → 16,873 activations over 1200 games (0.4%), pacing unchanged
at 11.08 mean rounds. It can only bite in the one turn after a boost is banked.

29 assertions in `test.js` (342 → **371**), stable over 50 consecutive runs, and every part of the guard was
verified to discriminate by reintroducing the defect one piece at a time: the `pick` wiring (5 red), the
transform wiring (2), the `wheel` line (1), `effectFor` (2) and the Broadway pitch (2).

**The general form came out of the measurement and was then measured too**: **166 activations in 1200 duels
throw away the seat's only legal fight**, `transform` being 95 of them — and **0 of the 166 have a boost
banked**, which is what says this fix is complete rather than partial. Protecting the rest is **not worth
doing**: head-to-head over 8000 decided games, the transform-only variant Aj asked about ("unlock the JQK") is
**+0.70 / +0.81 points at knight / demon, under 1.5σ — indistinguishable from zero**, and protecting every
activation is +1.08 / +1.61. Filed in [`DECISIONS.md`](DECISIONS.md#ai-strength) with the method, which is the
durable half: **no existing sim can measure AI strength**, because they all run the same AI on both seats.

### v1.31.77 — the AI stops throwing away the value boost it just paid for

Aj's battle log, knight tier:

```
Rival played a Jab - A♦.          You played a Jab - 2♠.
Rival played a Technique - A♥ Imbue with Power — Increase the value of your next play by 2.
Rival passed.                     You won the round of Jabs.
```

Its 2 sits at 15+2 = **17** against the 2 on the table at 15. It found the winning line, spent a card to enable
it, and then declined to make it. Aj suspected the AI before I did, and was right.

**THE RESPONSE WINDOW WAS THE RECORDED DIAGNOSIS AND IT IS INNOCENT.** The backlog entry said the trigger was the
Technique being counterable — the cast opens a window, `playPhase` returns on `st.pending`, and the resume path
was assumed not to re-run the play decision. It does: staged with a hand of six, the turn suspends four times,
resumes four times and ends in `["BOOST","EQUIP","RAMP","DRAW","play"]`. **The bug reproduces with no window, no
UI and no netplay at all** — one `AI.playPhase` call followed by one `AI.chooseMove`.

**It is `chooseMove`'s jab branch, which has two hold-back rules and neither knows about `nextPlayBoost`:**
- the **strategic pass** concedes a winnable jab whenever the hand is at or under `STRAT_PASS_MAX` (5) — which
  is most late-game hands, and it fires in duels at every smart tier, i.e. the shipped configuration;
- **`safe`** refuses to play a card that anchors a pair, and the boosted winner is often exactly that (a 2 with
  its partner in hand).

Both are good rules about *conserving* a card for later. They are wrong here because **a banked boost has
already been paid for**: `pickValueBoost` casts only when `boostEnablesWin` says the boost converts a losing
follow into an overtake, so the boost *is* a decision to take this fight, made one activation earlier — and
`nextPlayBoost` is cleared by the round reset, so passing does not defer the card, it burns it. Now the
strategic pass is skipped while a boost is banked, and a boosted turn with no `safe` option plays the most
expendable winner rather than passing.

**Measured, 600 knight-tier duels each way, detecting a turn log that holds both a `BOOST` and a `pass`:**
**33 wasted boosts → 4.** Boost casts are unchanged (595 → 594), so the AI is not boosting more, it is finishing
what it starts. The residue is a different bug and is now the top BACKLOG entry: a later activation in the same
turn can spend the card the boost was banked for, and all four survivors have an activation logged between the
`BOOST` and the `pass`.

**The detector is the durable part.** The obvious probe — "after a pass, is `nextPlayBoost` still set?" — reports
**1 in 600 on the broken build**, because a duel pass usually ends the round and the round reset zeroes the
boost before the call returns. That is a null result on a bug firing 33 times. Read the turn's log instead.

Three assertions in `test.js` (333 → 342 with the staging), each verified to discriminate by reintroducing the
defect: the strategic-pass half, the `safe` half, and a **negative** — with nothing banked the strategic pass
must still fire, so the fix cannot be "delete the hold-back". `test.js` **342** / `netview` **34**, 0 FAIL.

### v1.31.76 — the 2 explains itself, on the card and in a lesson of its own

The 2 carries more rules than any other card and, until now, explained none of them anywhere a player looks. Two
halves, and **the card text is the more useful one**.

**THE RULES GO ON THE CARD** (Aj: *"we could put some of those rules on the card... since you know, it does not
have effect text"*). The apex 2 is the only card in the game with **no activated effect** — `effectOf` returns
null for rank 2 by design — so its reader body was blank while it held the most rules. Worse, the fallback
described it as *"No effect — a pure fight card"*, close to the opposite of true. It now reads as an **Apex
trump**, and **every claim is DERIVED from the live rules**: `noSeqTwos` bars the 2 from chains, `highTwos` puts
it back above the A, `apexInf` makes it unbeatable by value, so a static note would be a lie in two of three
settings. `lessontest_twos` asserts the derivation by *switching the rule and requiring the sentence to change*.

**It is REMINDER text, and it is italic** (Aj: *"just so there's a distinction between card effect text and
reminder text"*). What is written there is not something the card *does*, it is how the game *treats* it —
`.cvReminder` keeps that line visible so a rule reminder is never read as an activatable effect. A rules change
also refreshes an open reader; the reachable case is narrow and named in the source so it is not later deleted as
dead (the panel is read-only mid-game, so it bites after a game ends).

**AND A LESSON — Basics #5, straight after `Specials`** (Aj: *"the 2 is a basic tutorial probably after
specials"*), which is where five-card plays first appear and therefore where the 2's second rule starts to
matter. Seven steps of play, in the order Aj specified:

| | you | them |
| --- | --- | --- |
| R1 | lead an **Ace** | answer with a **2** |
| R1 | **activate a boost**, then play your **2** | pass — you take the lead |
| R2 | lead a **pair of Aces** | answer with a **pair of 2s** — they take it back |
| R3 | beat their **full house of 2s** | — |

**The 2 wins twice before it collapses**, as a single and as a pair, so the flip at five cards is earned rather
than asserted — *"just to emphasize that it's not all specials"*. And **the reveal comes before the
instruction**: an earlier draft called their trio "the best trio in the game" and then said "beat it", which
reads as impossible. The rule that makes it beatable now lands in the same step.

**THE TUTORIAL DECK IS DELIBERATELY ILLEGAL** (Aj: *"let's make an illegal deck really. can we do that?"*). The
Rival needs **six** 2s across three rounds and a legal seat holds four, so the rig fabricates cards. This is not
a hack: a class deck already ships duplicate rank+suit with distinct ids (`7D#24`), art is keyed `rank+suit`, and
`EFFECTS` is read by suit+rank — a copy renders, names and plays identically. Verified before building.

**A LESSON MAY FLY THE RIVAL ITSELF.** `lsn.pilot` returns a log in the AI's own shapes, so `buildOppBeats` paces
and narrates it like any opponent turn. It exists because a difficulty tier cannot promise a sequence — measured:
`minion` never uses effects at all, and `knight` does the right things in isolation (20/20) but hits a real bug
in a live game. **That bug is filed at the top of the BACKLOG**: the AI activates a value boost, suspends on the
counterable Technique's response window, then passes and throws the card away.

**YOU CANNOT BREAK IT BY IGNORING THE INSTRUCTIONS** (Aj, having done exactly that in ninety seconds: *"i broke
the tutorial by not following the instructions... can we block that?"*). This lesson spends ten specific cards
over three rounds, so a wrong play burns one the finale needs and the step after it can never be satisfied — a
worse dead end than the Quicks one, because it cannot recover. Each gated step now names the exact cards it
accepts (`only`), and **the controls reflect it**: Fight and Pass go disabled with *"This lesson needs the cards
it just pointed at."* On the boost step `only` is `[]`, so no play is possible at all and the boost cannot be
thrown away as a jab. It generalises the existing `needSpecial` hook rather than adding a second mechanism.
**The check must sit ABOVE `updateActions`' empty-selection early return** — below it, Pass stays live and the
script is still breakable by passing with nothing selected.

**AND THE PLAYER'S HAND MUST NOT LOOK ILLEGAL** (Aj: *"i see we're also letting the player play with an illegal
deck"* — his hand held two 5♦ and two 5♥). Every fabricated card copies a rank+suit that already exists in the
seat's 52, so the original stayed in the deck and was drawn. `tutDropDupes` removes the reals the fabrications
occupy. The RIVAL's hidden zones stay illegal, which Aj confirmed is fine (*"the player can't see that
anyway"*) — but its six 2s are ordered so every combination it PLAYS uses distinct suits (2♥ / 2♠+2♣ /
2♦+2♥+2♠), because those land face-up.

**Six defects of my own, every one found by building it rather than by reading:**
- **A♥ *is* Imbue with Power.** "Give them an Ace to open with" and "give them a boost card" can hand over the
  same card — so it led its boost as a jab and then had nothing. The same trap then bit the player's hand.
  Provisioning is the rig's job; deciding what to play is the pilot's.
- **Losing a round mills your own deck into energy.** The finale's cards were seeded on the deck top for round 3
  to draw, and the catch-up ate them — you lose round 2 by design. Draws and catch-up both take from the top, so
  no ordering survives both. Both hands are dealt in full now, inside `MAX_HAND`.
- **`pairOf` scanned ranks 3-13** and so could not see a pair of Aces, which by round 3 is often the only pair the
  Rival holds; it then had no full house and passed forever.
- **The pilot only answered an Ace**, but the step's gate takes any single — a player leading a 5 stalled the
  lesson silently. It answers any single now, which is also simply true.
- **`playAny`, `activateSpot` and `passTurn` all lacked the retry** every other helper in `lessonlib` has.
  `passTurn` was worse than missing: it reported success on *any* state change, so it masked real failures.
- **A deleted helper left a live reference** (`tutEnsureTwosFullHouse`), which the build's parse check cannot see
  — the lesson simply never started.
- **The suite picked the full house BY RANK**, so a drawn real 5♠ could make it select a set the step did not
  accept and Fight stayed disabled about one run in six. `playSpot()` plays exactly what the step spotlights —
  what a player sees is what the gate takes.

### v1.31.75 — the harness learns to play a whole game, and a lost mirror stops being permanent

**A deadlocked table used to PASS `nettest_sync`.** Its loop only failed on divergence, so when neither side
could act it spun out the full 120s wall clock and fell through with `drift===null` — both assertions green. That
is precisely the shape a lost mirror produces when the mirror carried a turn handover: the hands still **agree**,
so a state comparison is blind to it. The loop now fails if nobody can act for 15s.

**The first thing that detector caught was the harness, not the game** — and that is worth writing down plainly.
`nettest_sync` only ever clicked Fight or Pass, so the moment the host ended a round holding more than `MAX_HAND`
it sat on its own clean-up picker forever. `nettest_trim` already documents that behaviour as by design: every
seat but the local one is auto-trimmed, so *the host's own pick is the only one that stops play*. The client even
displayed "Rival is discarding to hand size…" throughout — the v1.31.69 notice working exactly as intended. The
suite now answers the pick (select until Fight enables, confirm with Fight) and every other window it can meet —
shield guard, pre-fight, Respond? — with the minimal deterministic choice.

**A stall now classifies itself**, which is the difference between a test problem and a game problem:
`HARNESS GAP — an unanswered "shield guard" window is open on the HOST` versus `GENUINELY WEDGED — no window is
open and neither side is on turn`. Verified by disabling the pick handler and checking it named the right cause.

**That forces a correction to yesterday's fork measurement.** "35/35 clean" was reported on a suite where a dead
table passed, and 8 of those 35 ended before the action budget — indistinguishable, after the fact, from a silent
stall. Re-measured on a harness that can finish games: **20/20 clean, 0 stalls**, which excludes a 1-in-4 fork
rate and not a 1-in-8 one.

**And `reassertMirror()` is in, this time with the experiment it lacked.** `broadcastMirror` skips a seat whose
mirror is byte-identical to the last one sent (right — 97% were duplicates, v1.31.65) and `lastMirror` is
otherwise cleared only when a channel is re-bound. Harmless while play continues, because the next state change
makes a fresh mirror. **Not harmless the moment the host PARKS**, because then its state deliberately stops
changing: a client that missed the last mirror has nothing to correct it and no reason to act.

Demonstrated with a probe that drops the first mirror handing the turn to the client:

| | failures |
| --- | --- |
| probe alone | **2 in 8** — persistent past the 6s settle window |
| probe + `reassertMirror` | **0 in 24** |

P(0 in 24 at that rate) = **0.1%**. Cost: one extra mirror per park.

**The probe also refuted the theory it was built to confirm.** The prediction — written down before running it —
was that a lost turn-handover mirror would DEADLOCK the table. It never did: two divergences, zero stalls. So
"the dedupe makes a lost mirror permanent" is right about **persistence** and wrong about **deadlock**, and this
fix is a robustness measure against a demonstrated divergence rather than a cure for the recorded fork. That fork
remains open and unreproduced; note its signature is the client missing its OWN draw, while the probe's is the
client's view of the HOST's hand — the same shape in a different field.

### v1.31.74 — seven lesson suites, and the enabled button that did nothing for two seconds

Seven of the ten tutorial lessons had no test. Four of them have **gated** steps, so a rig or gate regression
leaves a player stuck with no error and no way to finish — the failure mode that hid five defects in the Quicks
lesson until v1.31.73. They are covered now: `lessontest_howto` (24), `lessontest_zones` (21),
`lessontest_initiative` (17), `lessontest_specials` (19), `lessontest_energy` (18), `lessontest_rides` (15),
`lessontest_forms` (15). All ten lessons now have a suite.

`lessonlib.js` is a shared **helper, not a suite** (the `nettest_lobby.js` convention) — seven lessons needed the
same boilerplate, and it carries the traps `lessontest_quicks` had already paid for: `next()` reports when
`#tutNextBtn` is absent, every poll prints on timeout, and `playAny()` tries **every** card rather than gambling
on one.

**Each suite asserts what its lesson CLAIMS, not that the panel rendered.** The steps make factual promises the
gates do not check, and those are the assertions: `specials` and `howto` say a shield broke — so the suites check
the Rival's shield count; `energy` says the card banked and the spend reached the shuffle pile — both asserted;
`rides`/`forms` say the transform sits in your zone — asserted against `players[0].forms`; `initiative` says
*"your cards are all low, so you can't beat their lead"*, which is asserted as `legalFightPlays(...).length===0`,
the engine's own answer. `zones` is a spotlight tour with no gates, so its suite asserts each step's selector
both **exists** and is **carrying `.tut-spot`** — `applySpot` does `querySelectorAll` and silently lights nothing
when an id is renamed, and the tour still clicks happily to the end.

**And the real find: an ENABLED control that did nothing for ~2 seconds.** `updateActions` computes
`yourTurn` as `state.turn===YOU && !state.finished` — **`busy` is not in it** — while `doFight`, `doPass` and
`toggle` all `return` on `busy` **silently**. So from the moment the turn came back to you until the opponent's
beats finished animating, Fight and Pass rendered enabled, the hand rendered interactive, and every click was
dropped without a message. Measured at **2014ms of swallowed Pass clicks** in the Initiative lesson, where the
Rival leads round 1; the same window ate hand clicks, which is what made two of these suites read "Fight is
disabled" with an empty selection.

`updateActions` now disables both controls while `busy` and says *"Hold on — the board is still resolving."* It
sits **after** the `!yourTurn` branch so "Rival is fighting…" still wins when it genuinely is not your turn — the
more specific message should survive.

This is worth knowing beyond the tutorial: **from the outside, an enabled-but-inert control is indistinguishable
from the game having hung**, and it is a plausible contributor to reports that netplay "lagged at the beginning".
The invariant is now asserted directly — `lessontest_initiative` waits for Pass to be enabled, clicks it
**exactly once**, and requires the game to move. Reverting the fix fails that assertion and six more.

A naming trap removed while here: `lessontest_energy.js` tested the **Energy Order** lesson, not Energy. It is
`lessontest_energyorder.js` now, and the real `energy` suite has the obvious name.

### v1.31.73 — the Quicks lesson was broken five ways: three a test found, two Aj found by playing it

The ask was a cleanup: `tutIsTech` — "is this a counterable Technique" — was declared byte-identically in both
halves of the Quicks lesson, so it became one definition. That part is four lines.

**The lesson had no test, and its failure mode is silent**, so verifying the hoist meant writing one
(`lessontest_quicks.js`, 16). Step 2's gate is `t==='respond' && d.countered`, which makes *reaching step 3* proof
that the rig and the show agree — a real assertion rather than a shape check. Then the suite went red one run in
four, and each investigation turned up a separate bug that has been shipping:

**1. About one game in twelve the lesson was unplayable.** `newGame` does
`pl.shieldPile = pl.deck.splice(0, startShields)` — **shields are real cards off the same deck** — and the rig
searched `hand.concat(deck)` for the lone 4♦ Counter Spell. When that card was behind a shield the rig placed
nothing, `eligibleQuicks()` came back empty, the Respond? window never opened, and the player sat on step 2 being
told to counter something that never arrived. `tutPullShield` now lifts it out and swaps a pool card into its
place, so the pile keeps its size. Verified deterministically by forcing the 4♦ behind a shield: **16/0 with the
fix, 8/8 without it.**

The other rigs are exposed to the same hole and survive it by luck: the Ride and Form lessons ask for `J♣ || any
J` and `Q♣ || any Q`, so a shielded club costs them nothing. **A rig that needs a UNIQUE card is the dangerous
shape** — this was the only one.

**2. It cast the first candidate and gave up if that failed.** `foe.hand.filter(tutIsTech)[0]`, then
`if(!r || r.ok===false) return;` — and whether a Technique casts depends on the deal, since the Rival's energy
must cover its cost and colour. Roughly one game in eight the first candidate was unaffordable and the lesson
stalled with `pending=false`. It now tries every candidate. This is the deal-dependence that made three netplay
*suites* flake, in the product instead of a test.

**3. Finishing the lesson could hand you a wedged duel.** Countering opens a window for the **Rival** to answer
your Counter Spell. The lesson's continuation was `function(){ state.turn=YOU; render(); }` — it skipped
`settleWindows`, the one thing every other `promptHumanResponse` call site chains — so nothing drained that
window. State stayed `pending=true, respondFor=1` forever. The lesson still showed its "Countered!" payoff and
still marked itself complete, then returned a board that could never take another action.

Each was diagnosed from state the suite printed on failure (`counterSpell=NOT IN HAND`, then `pending=false` with
it held, then `pending=true respondFor=1`), not from reading the code — and each fix removed exactly that
signature. **A red run explaining itself is what made three bugs cheap instead of three sessions.**

Two throwaway diagnostics fooled me before the suite did: one clicked `#tutNextBtn` before the panel rendered it
and reported 8 straight false failures, and one planted its probe with a non-unique anchor, silently applied
nothing, and produced three green runs I nearly believed. The suite's `next()` now reports when it does not
click, and the plant asserted its anchor count.

**4. You never saw the card being cast.** Aj: *"i never see the opponent's card being cast."* `tutCastRivalTech`
called bare `flashArt` and then opened the Respond? modal **in the same frame** — measured at **51ms**, so the
reveal was covered before a single frame of it was visible. An ordinary duel does not have this bug, because
there the prompt waits for `playBeats` to finish and `buildOppBeats` pairs `revealEffect` with `revealDwell`; the
tutorial bypassed that layer and hand-rolled its own presentation. It now uses the same pair, which both dwells
(2650ms, or 1200ms under reduced motion) **and drops the card into the reader** — the thing you actually need to
read before deciding whether to counter. Asserted in both directions: the flash and the reader must be seen
*before* the modal, and the modal must be at least 80% of `revealDwell`'s own value late. Reverting the fix
reports `51ms, floor 2120`.

**5. "Let it resolve" could still brick it.** Aj: *"i tried breaking the tutorial by letting all the spells
resolve.... it broke."* Declining already re-cast — `humanDeclines` has a retry so the lesson would not brick on
one decline — but **every retry spends the Rival's energy**, so a few declines exhausted it, `E.activate` then
failed for every candidate, and the lesson sat on step 2 with nothing to counter. The step's gate is
`d.countered`, so "Let it resolve" can never satisfy it: an action that cannot satisfy the gate is a dead end by
construction, and the lesson now **disables** it rather than deepening the retry. Disabled and still visible,
with a note saying why — it is a real control in a real window and the lesson is teaching what that window looks
like, and a dead button with no explanation is its own dead end on a phone where there is no tooltip.
The retry is kept: the *auto*-decline path (`!quicks.length`, no modal at all) can still reach it.

**The negative half of that gate is covered by suites that already existed.** `browsertest` and `nettest_actloop`
both click `#respDecline` in ordinary play, so over-broadening the condition turns them red — verified by
forcing it `true`, which gives `browsertest: sim7 did NOT reach an end state` and `nettest_actloop 21/1`. Worth
stating because "I gated it on a tutorial flag" is an assurance, not a test.

### v1.31.72 — one `resolveIds`, not two

`resolveIds` — the host's only defence against a client naming a card it does not hold — was **declared twice in
the same scope**, byte-identical, 190 lines apart: once under the `HOST authority` heading where it belongs, and
once among the lobby helpers between `hideNetroot` and `hostStartRealN`. Two declarations of one name in one
scope means the later one silently wins, so the stray was the live copy and the documented one was dead.

Nothing was broken by it, and that is the whole point: it was harmless **only because the two never drifted**.
An edit to the copy under the heading — the one anyone reading the host-authority section would find — would have
had no effect at all, and the failure mode is a security check that looks tightened and is not. That is the bet
`isChopOf` and `phantasmSolveFor` each exist to refuse.

The stray is gone and the survivor carries a note saying so. Found by grepping the template for any function
name declared more than once; the other seven hits are same-named helpers in genuinely separate closures. One of
those, `isTech`, **is** byte-identical across two adjacent tutorial lessons (`~4840` and `~4859`) — separate
scopes, so not this bug, but the same drift risk in miniature, and worth hoisting when that area is next touched.

### v1.31.71 — a client's Phantasmal Illusion reaches the host, and the Boost button was never real

**Phantasmal Illusion was host-only.** Its picker is a two-step choice — which card to copy, and (optionally)
which of your own cards to swap in — and it resolved by calling the engine **locally**, with no client guard. On
a netplay client that meant the illusion happened on that screen and nowhere else: the host's pile never changed,
so the client was looking at a board only it believed in. It is the same class as the drag-to-play bug of
v1.31.56 and the fourth site found in that sweep: **an entry point that performs an action and never checked
whether it is allowed to.**

The fix follows the funnel rule. `phantasmSolveFor(st, seat, addCard, phantId)` is now the single definition of
"which pile index does this swap replace", so the host re-solves it from **its own** state rather than trusting an
index computed against a rotated mirror — a client's `removeIdx` is meaningless on the host, and sending one
would have been a fabricated-card bug wearing a different hat. A client sends `{op:'phantasm', cardId, addId}`
and nothing else; two host handlers (duel and N-player) resolve the ids the same way every other intent does, so
an imagined card dies in `resolveIds` as usual. `nettest_phantasm.js` (8) drives it over a real connection and
asserts the **host's** pile changed, which is the assertion the old code could never have passed.

**The Boost button was dead code for everyone, and I twice reported it as a client gap.** The claim was that a
client could not use Brilliant Tactic. Measured, it is worse and simpler: `E.play` **never read `opts.boost`** at
all, so attaching a boost to a play did nothing on any seat, and `boostCard()` required `eff.quick` while all
four valueBoost cards (Infuse with Magic, Imbue, Divine Tactics, Brilliant Tactic) are plain Techniques — so
`#boostBtn` **was never rendered for anybody**. Twenty sites deleted: the markup, `boostArmed`, `boostCard()`,
`armedBoostAmount()`, the `fightLegal` branch, the action-row display block, the click handler, the `bId`
threading, and `play()`'s now-unused `opts` parameter.

It is deleted rather than wired **on purpose**: attaching a boost to a play would apply it atomically with the
play and skip the Counter Spell window, and a valueBoost is a Technique — being counterable is the point. Aj's
own game log is the evidence, an Infuse with Magic that lost to Kings because it had been counterspelled.
Boosting works and always did: **activate the card, then play.** `r.boosted` comes from `nextPlayBoost`, which is
what an activation sets.

**This is the third orphaned mechanic in this codebase** after `stopper` (deleted in v1.31.13) and `phantasm`
(which had no card for eighteen versions). All three looked alive in every layer — markup, handler, engine hook
— and none of them could fire. `grep -c` for the thing that would have to be true, then measure it; do not read
the three layers and conclude they connect.

### v1.31.70 — every player picks their own pitches

Aj, on being told the asymmetry: *"no. all players choose what to discard"*. Filed as a design note in v1.31.69
and corrected here — it was a bug, not a trade-off.

`endOfRoundTrimThen` auto-trimmed **every seat but the local one**, so in netplay the host chose its own cards
and every client had its **lowest** cards taken by `discardToLimit`. In a competitive game that is not a detail.

It is a **sequential queue** now. A remote human seat gets the real picker on its own board, reusing the
forced-discard window wholesale — `discardPending` → `{op:'discard'}` → `E.resolveDiscard` — which is safe
because both paths already send discards to the **Energy pile**, so the semantics were identical all along. An
AI seat is still trimmed for it. The local seat is queued **last**, which leaves solo behaviour exactly as it
was.

Sequential rather than simultaneous because that is what the window machinery supports, and it buys a
disconnected seat for free: **Passo already answers a `discard` window** with `ids:[]`, so a dropped player
cannot hang the table.

**The assertion that catches this is not "the hand shrank"** — it shrank either way. It is WHICH cards left. The
client is staged so its lowest card is one it would never choose (3♦ among high cards), it pitches its highest
instead, and the suite checks the 3♦ is **still in hand**. `nettest_trim` 11 → 14, and both new assertions fail
on the previous build.

### v1.31.69 — the table is told who it is waiting on, and Sort stops being turn-gated

Aj: *"the other players don't [get] a prompt saying somebody is still discarding down to max hand… it's just
uhhh what's happening in the middle of rounds"*.

**Why only one seat causes this.** At the end of a round every seat but the local one is auto-trimmed by
`E.discardToLimit` and narrated after the fact. Only the LOCAL player picks which cards to pitch — so in netplay
it is the **host's own** pick that stops the table, and the clients had nothing on screen at all.

`trimPending` is set on state when that pick opens and cleared when it resolves, so it rides the mirror —
`netview` whitelists it explicitly, rotating the seat like every other seat reference. It carries a **seat and a
count, never cards**: a hand must never travel (see `E.takeReveal`), and `netview.test` asserts that.

The status line reads through **`logName`, not `seatName`** — names are reader-relative here as everywhere, so a
duel opponent is "Rival" and not "P2". The first version used `seatName` and a client read *"P2 is discarding to
hand size…"*, which is the same class of mistake as the narration audit.

`netview.test` 28 → **34** (the field, its rotation, and that no card can travel in it). `nettest_trim.js` (8)
drives it end to end with the **host** staged over the cap, since that is the only seat that gets an interactive
pick — verified by removing the render hook, where the client shows "(nothing)" while play is stopped.

**AND NOBODY ELSE MAY ACT WHILE IT WAITS** — Aj: *"it should also block the action buttons for other people"*.
That was a real bug, not just a courtesy: `resolveRoundWin` sets the turn to the round WINNER, and `roundDraw`
runs **after** the trim, so a client that had just won held a live board while the host was still picking and
could play into a round whose cards had not been dealt. `trimPending` now locks every other seat.

**The announcement is on the play-area stage too, dimmed**, sharing `#roundfx` rather than inventing a second
notice layer — Aj: *"might as well put the announcement there"*. It **takes over a leftover ceremony beat** on
purpose: `playPreBeats` leaves its last beat on stage for the Round-N plate to swap into, so by the time a pick
opens the stage is showing something stale, and refusing to overwrite it meant the notice never appeared at all.
A ceremony still mid-sequence wins the race back on its next step, which is right — the beats are the
shorter-lived message. It dims the PLAY AREA only; the hand below stays readable.

**THE NOTICE COVERS EVERY INTERACTIVE DISCARD, and that was Aj's follow-up question** — *"does that also work
if the clients were picking cards to discard as well?"* Two answers:
- **At ROUND END a client never picks.** `endOfRoundTrimThen` auto-trims every seat but the local one, so on a
  host that is every client, and `discardToLimit` chose their LOWEST cards for them. **CORRECTED in v1.31.70** —
  Aj's answer to that note was "no. all players choose what to discard", so it was a bug rather than a
  trade-off. Every seat picks its own pitches now.
- **A FORCED discard does prompt a remote seat**, and until this version the other seats had no notice for it at
  all — the host set its own `rivalStatus` and nothing reached anyone else. Enumerated rather than guessed:
  `discardPending` is set in exactly **two** places (the owner banking looked cards, and `discardOpp` —
  Telekinesis, Outbalance, Discombobulate), so one notice reading either `trimPending` or `discardPending`
  covers every interactive discard in the game. `nettest_discard` (7 → 10) asserts it, and fails 2 without it.

**AND THE COUNTER WORKS FROM EITHER SEAT — asked, then evidenced.** Aj: *"i think i've seen the counterspell fire
off on netplay… but i can't confirm if it was only because it was on the host"*. `nettest_counter` has always
driven a **client** countering over the wire, so the mechanic was never host-only. The doubt is historically
well-founded though: until v1.31.58 the narration went through `logMsg`, so the countering player watched its own
Technique evaporate with no line anywhere. That suite now asserts the **client's own log** records it too
(7 → 10) — backfilled coverage, which passes on the earlier build, so that the question has a checked answer
rather than a remembered one.

**SORT IS NO LONGER TURN-GATED.** Aj: *"i always wondered why i could not sort my hand while the other players
where taking their turns"*. There was no reason for it: sorting reorders your own view of your own hand —
`applySortLayout` writes `handOrder`/`layout`, both local — so it mutates no game state, sends no intent, and
cannot be seen by anyone else. `flipSort` returned early on `state.turn!==YOU || busy`, which blocked it exactly
when a player has time to organise. Peeking still refuses, because peek is inspect-only.

One staging note worth keeping: **a clean-up pick is confirmed with Fight.** `$('fightBtn')` is wired as
`pick ? confirmPick() : doFight()`, so the pick reuses that button; the first version of the suite hunted for a
"Confirm"/"Discard" control that does not exist and timed out on a working build.

### v1.31.68 — a client can take its Ready back

Pressing Ready was one-way: you then waited for the host to start, whether or not you still wanted to play that
game. The host could already remove a seat (`hostDropPlayer`); the player could not.

**It reuses the machinery a rules change already has**, rather than inventing a second notion of "ready": a
rules change stales every readiness stamp with `rulesGen++`, and `readyCount()` only counts seats whose stamp is
current. Un-ready is that, for one seat, on purpose — the host deletes `seatRuleGen[seat]` and re-renders.

**Both documented traps are handled, and both are asserted:**
- **`stopJoinRetry()` comes FIRST.** The join retry re-sends `t:'join'` every 350ms until the game starts, so
  un-readying without stopping it un-readies the seat and silently re-readies it a third of a second later —
  which looks exactly like a dead button. `nettest_unready` waits **past** that window before asserting, so a
  check that fired immediately could not pass by luck.
- **The SEAT is kept.** `hostStartRealN` indexes seats `1..nextSeat-1` — *joined*, never *ready* — precisely so
  a stale seat sitting before a ready one cannot mis-assign decks. The suite asserts the seat NUMBER survives a
  full un-ready/re-ready round trip (Player 2 → Player 2), which is the sharp form of that.

**Un-readying withdraws the seat's rule suggestion**, as agreed: a player stepping out takes their suggestion
with them. That is the one place a suggestion is cleared by someone other than its sender, so the host
re-broadcasts the whole map — suggestions are state, not events.

**The host gets no un-ready button**, also as agreed: its "readiness" is just its own rules choice, so its
equivalent is the existing Leave.

The intent is **board-independent**, so it joins `emote` and `suggest` in never carrying a `stateSeq` stamp, and
is dispatched ahead of `hostApplyMove*` — those return immediately without a `hostState`, which is the entire
lobby, so anything lobby-relevant handled inside them looks right and does nothing.

`nettest_unready.js` (12), verified by removing `stopJoinRetry()`: the suite fails with the exact diagnostic.

### v1.31.67 — the "seizes the initiative" dim comes down

Aj hit this twice in one game: the play area dimmed behind the round banner and never recovered, board
unreadable and unclickable while the hand below kept working. That signature is diagnostic — `#roundfx` is
`position:absolute; inset:0` **inside the play area**, so **board dead but hand alive means the banner, not
`busy`**.

**Two fixes, and the second is the real one.**

`finishClientCeremony`'s fallback armed a 2500ms timer that cleared a flag and, despite its own comment, never
touched the banner. `playPreBeats` deliberately leaves the banner up on its last beat so the Round-N plate can
swap into it, so if nothing revealed the deal, nothing ever called `clearRoundfx()`. **The teardown is
unconditional now.**

And the client identified "the new round was dealt" by the incoming hand being **longer** than the one on
screen. That proxy is false exactly when the end-of-round trim matches the draw: `discardToLimit` runs before
`roundDraw`, so a client that **passed** holding 12 trims to 10 and draws back to 12 — equal, never greater. A
player is on turn with more than ten cards on **78%** of turns. The deal is now identified by **a card id the
client does not already hold, arriving with an empty pile.**

**Two wrong answers on the way, both worth keeping:**
- **The round number.** It advances at *resolution*, not at the draw, so the intermediate mirrors (shield drop,
  pile clear) already carry it and got held too — which broke the shatter animation and the threshold beat in
  three suites.
- **Card ids alone.** A broken shield returning to hand also brings an id the client does not hold, and that
  mirror arrives with the pile still on the table. Holding it stopped the shatter rendering, so
  `checkThresholds` never queued and the ROAR/OVERDRIVE beat never played. Hence the empty-pile clause.

`nettest_dim.js` (8) reproduces it deterministically. **The client must PASS, not play** — playing drops it to
11 and the trim-then-draw returns it to 12, which is *greater* and which the old proxy could see. That
one-card difference is the entire bug, and the first version of the suite played a card and passed on the
broken build. It asserts the **teardown**, never the banner appearing: the banner appearing is the correct half.

### v1.31.66 — the board stops scrolling sideways, and that fixes the clobbered play area too

Two of Aj's phone reports turned out to be **one cause**, and fixing it made the third go away.

**`.fighter` declared `flex-wrap:wrap` and `flex:0 0 auto` together.** The wrap says "I will take two lines if
I have to"; shrink **0** guaranteed it never had to. So the row sat at its max-content width — name + deck name
+ 4 shields + energy + deck count + recycle — and pushed past the screen instead of wrapping: **394px inside a
327px viewport, 416px inside 390px**, with `main` scrolling sideways at both. `flex:0 1 auto` lets the wrap it
already asks for actually fire. Measured after: 283px and 346px, no scroll.

**And that also fixed the play area being clobbered.** The horizontal scroll shifted the whole board, dragging
the corner-pinned Forms/equipment zones across the pile. A/B'd with the zones and a Full House staged:
**5 of 5 pile cards overlapped at 390px before, 0 at every width after.** So the agreed "zones into the panels"
change was **not built** — the measured problem is gone, and shipping a DOM re-parent that nothing needs would
be worse than not shipping it. The spec stays in the BACKLOG in case a real device still shows it.

**The round banner was a second, transient source.** `.rfInner::before` is a deliberately oversized glow
(`width:150%`, centred by a transform) and its right-hand bleed extended the scroll box for the ~1.3s the banner
shows — briefly draggable, and a visible sideways jump at the start of every round. `#roundfx` now clips.

`landscapetest` 117 → **126**, asserting both at three widths, with the zones and a five-card pile **staged** —
with nothing in play the zones do not render at all and the assertion would pass on a board that cannot show the
bug. Verified by stashing only the template: 3 assertions go red (413 vs 327, 481 vs 390, and 22% coverage).

### v1.31.65 — the host stops broadcasting the same mirror 500 times

`broadcastMirror` runs from every render — and a render happens for animations, hovers, effect flashes. Traced
on the host during a real netplay game:

```
9.11s   mirror OUT seat1 q=5 theirHand=4 inMirror=4   x502     ← byte-identical, in 1.4 seconds
10.47s  mirror OUT seat1 q=5 theirHand=6 inMirror=6   x3
```

**Measured over a full game: 1137 calls, 29 actually sent — 97% were byte-identical duplicates.** The client
applies each one, so it falls behind and its board reads stale. This is the host half of the re-render storm in
Aj's logs.

**Deduped by CONTENT, not by `stateSeq`** — deliberately. `stateSeq` counts client *intents*, so the host's own
plays and the round draw never advance it, and a stamp-based skip would drop real updates. Identical bytes
cannot change a client's board, so skipping them is safe by construction. A seat's cache is dropped whenever it
joins or rejoins, so a reconnecting peer is never deduped against state it missed.

**THIS DOES NOT FIX THE `nettest_sync` FORK, and the entry for that stays open.** It still fails ~3 runs in 8,
unchanged. Two hypotheses were tested and rejected on the way here — see the backlog for both, because each
looked right:
- **a second ceremony discarding a held round mirror.** `clientPlayCeremony` nulls `pendingRoundMirror`, which
  would throw away a deal. Fixing it made the suite **worse** (5 failures in 8), and tracing then showed no
  `mirror HELD` events at all during a failure — the client applies every mirror.
- **the storm as the sole cause.** It is not; the failure rate is unchanged.

**And a process note worth more than either.** Several measurements in that session were taken against a
**stale binary**: a comment repair had orphaned its tail onto its own line, `build.js` refused to write, and the
suites happily kept running the previous build. Two arms of an A/B returned identical numbers, which is the
documented signature of a broken instrument — and it was, for the third time in one day. **`node build.js`
prints `built …` on success; if a measurement surprises you, check that line before believing the numbers.**

### v1.31.64 — the 2 plays in sequences, as the low card

**The default changed after playtester feedback.** A player with no chikicha background found it weird that the
2 could not be used in sequences; a chikicha player confirmed it **can** be — as the **lowest** card. Smallest
straight `2-3-4-5-6`, biggest still `10-J-Q-K-A`, smallest full house `222XX`. That is Big Two's rule too.

**v1.31.45's research was incomplete and this corrects it.** Its changelog says *"all three source games
agree"* — but it consulted the games we borrowed *shapes* from and never asked the game this one is based on.
Two of four bar the 2; the other two demote it.

**The generalisation is clean, so this is a rule and not a Chikicha special case.** All four games agree the 2 is
the apex at sizes 1-3 and differ only in plays of 4+, with exactly two answers. The engine already drew that
line: `apexOnlyPlay` has always been scoped to single/pair/trio.

```
seqTwos:  off   barred from every chain     Tiến lên · Dou Dizhu
          low   ranks lowest in plays of 4+  Big Two · CHIKICHA   ← new default
          high  keeps fight value 15         the legacy J-Q-K-A-2, which matches no family
```

**MEASURED BEFORE FLIPPING** (`twosim.js`, new): pacing **unmoved** — 11/20/31 rounds at 2/4/6p in all three
settings, confirmed independently by `rulesim` — jab share within noise, straights played +12% at 6p. Deck
balance showed no reliable signal: two replicates disagreed more than the arms did, which is the per-deck noise
floor CLAUDE.md warns about, so the first run's alarming spread was discarded rather than reported.

**The biggest effect is the full house, not the straight**, and it is easy to miss because a full house is not a
chain. It is keyed by its trio, so a trio of 2s goes from the highest full house in the game to the lowest —
size-4+ plays containing a 2 fall **1942 → 875** at 6p. Aj's chikicha source states it directly.

**Two panel rules, both phrased as the negative of the default**, because every rule must default off —
`RULE_DEFS.some(ruleOn)` *is* the definition of "customised". `noSeqTwos` bars the 2; `highTwos` restores the
legacy ranking and is **dead while `noSeqTwos` is on**, since where the 2 ranks inside a chain is meaningless
once it is not in one. That is a new dependency kind, `deadIf` — the mirror of `needsAny`.

**Consequences Aj called in advance, all three:** the Tiến lên and Dou Dizhu presets now set `noSeqTwos`
explicitly; the preset line moved above **The 2**, because a preset must precede every group it governs and it
now sets a rule there; and the two rules depend on each other.

Migration: a saved `seqTwos` key maps to `highTwos`. **The other half cannot be migrated and does not need to
be** — a key that OMITS the rule meant "barred" before and means "lowest" now, because the default moved. An
old peer and a new one will play the 2 differently unless one says so explicitly, which is what the
build-version handshake exists to warn about.

`test` 325 → 333, `rulestest` 143 → 150 (including both directions of the new dependency).

### v1.31.63 — peek is a real review mode

**Principle, agreed with Aj: peek SHOWS, it never CHANGES.** Anything that only reveals information works;
anything that alters the game stays dead.

**What was wrong.** v1.31.61 made peek's controls clickable again, and a sweep of *every* interactive element
then showed the mode was still half-built: the opponents' panels and their energy piles were never lifted, so
you could inspect your own pile and not theirs — and **every information viewer was reachable but silently
dead.** `openPileView`, `showCheatSheet` and `showHelp` all route through the one shared `showModal`, and
`.overlay.peeking .modal{display:none}` hid it. The controls populated the modal and displayed nothing.

**The structural fix is stash-and-restore.** Peek reuses `.overlay` as its dim, and `.overlay` also hosts every
dialog *including the end screen peek is hiding*, with a single `#modal` between them. `showModal` now stashes
that end screen the first time a dialog opens during peek and marks the overlay `.dlg` so the dialog shows;
closing it restores the stash and drops you back **into** peek. "Exit peek to look at something" never happens.

**Now peeks:** the battle log (expand, scroll, ↓ New, ⤓ Save) · your energy and shuffle piles · **the
opponents' panels and energy piles** · a card group in your hand · 🃏 Specials list · ? How to play ·
**⚙️ Settings, 💡 Hints, 🔊 sound** (Aj: *"header settings are ok not dead i think, also let's you check the
rules"*) · 🏳 Concede / New Duel, which closes peek first and does not re-offer it · ↩ Back.
**Stays dead:** the whole action row — Fight, Pass, ⚡ Activate, Boost, Sort, Clear — plus targeting and the
rename control. Note *dead* means `pointer-events:none`, not "covered": covering them would hide the board.

**← Leave online now asks first**, and the prompt is unconditional rather than peek-only — Leave drops the relay
room and reloads, and it is a known mis-tap (as a floating overlay it covered 79% of the card reader's close
button until v1.31.57). The risk was never peek-specific.

`peektest.js` (31) is new, and `nettest_inpage` (11 → 14) covers the prompt. Two things it records because both
produced a wrong diagnosis first: `__solo.peek()` drives the **real** `enterPeek`, because `showModal`'s peek
branch keys off the `peeking` VARIABLE and a probe that only stages the classes reports the dialog as hidden;
and **the click target in the hand is the `.group`, not the `.card`** — `.group .card{pointer-events:none}` is
by design, so asserting the card reports "inert" on a perfectly working hand.

### v1.31.62 — the client plays the Fighter Kick again

All three `sendCeremony` call sites sat **one line below** the terminal `return endGame()`:

```js
announceRoundWin(r);
if(state.finished){ … return endGame(); }   // Fighter Kick — terminal
sendCeremony(r);                            // ← never reached on the round that ENDS THE GAME
```

`ceremonyResFor` carries `kick:!!res.kick` faithfully — it simply never left the host. The client therefore
reached `endGame()` with `pendingKick` false and cut straight to the win screen: no finisher, no sound. Aj:
*"the client didn't play the rider kick animation even tho they won"*.

**The client's skip is gated on `finished`, NOT on `kick` — Aj caught that from the rules, not the code.**
*"remember each loss is by a kick, so there would be multiple kicks in multiplayer firing off"*. The engine
agrees: `result.kick = true;` then `if (st.numPlayers === 2) st.finished = true; else { eliminatePlayer(...);
if (aliveCount(st) <= 1) st.finished = true; }` — so at 3-6 players **every elimination is a kick** and only the
last one ends the game. A first attempt skipped the beats whenever `res.kick` was set, which would have gone
silent on a mid-game elimination the host still narrates, and stranded `pendingKick` on a seat that never
reaches `endGame()`. `ceremonyResFor` now carries `finished`, because it is not derivable from `kick`.

`nettest_elim3` (15 → 16) guards it, and the diff is exact — the surviving client loses its first beat:
```
fixed   ["P3 won the round with a Straight!", "P3 seizes the initiative!", "Round 3…"]
broken  [                                      "P3 seizes the initiative!", "Round 3…"]
```
Two vacuous versions came first and are recorded there: an "any banner ever" flag stays armed and is set by the
NEXT round's ceremony, and snapshotting as soon as the first banner appears compares one entry against one entry.

The send now happens before the terminal return **and before `broadcastMirror()`** — the channel is ordered, so
the client learns `kick` (setting `pendingKick` inside `announceRoundWin`) before the finished mirror drives it
into `endGame()`. `clientPlayCeremony` returns early on `res.kick` rather than playing beats, which matches the
host exactly: on a terminal round the host plays no pre-draw beats and no Round card either.

`nettest_kick.js` (11) stages it deterministically — the client out of shields, the host holding a pair — and
was verified by reintroducing the bug, where **exactly one** assertion fails: the client still logs the kick
(that line was already broadcast) and still reaches the end screen, only the finisher is missing.

Two staging facts the suite records, because each cost a red run: **round 1 is jabs only**, so a pair staged
immediately is silently refused and the turn never reaches the client; and **the kick fires on the next Special
win AFTER a player is already out of shields**, so leaving the loser on 1 shield merely strips it.

**Also: `nettest_elim3` had been red since v1.31.57 and nobody noticed** — it asserted an eliminated client's
header reads "New Duel", and that button now reads "← Leave" online (the three-state `#newBtn`). The product
moved and the suite did not. Found by finally running **all 39** netplay suites rather than the handful each
change seemed to touch; every one is green, and the counts in CLAUDE.md are now verified rather than
last-known — `sharetest` was 16, not the recorded 14.

### v1.31.61 — peek at the table works again, and the stacking derives from one number

Peek makes `.overlay` nearly invisible (`rgba(10,4,16,.14)`, no blur) and **lifts the panels above it**. Those
lifts were hardcoded — 35 for the panels, 60 for ↩ Back — and chosen when `.overlay` was **30**. v1.31.36 raised
`.overlay` to 100000 so the Custom rules panel would stop opening behind `#netroot`, and buried every peek
control under a backdrop you can see straight through. Hit-tested at 390×780 before the fix: `#peekBar`,
`#logWrap`, `#handWrap` and the hand all returned **`div#overlay`** as the topmost element at their own centre.
The board was fully legible and nothing responded. Aj: *"trapped in limbooooo"*.

**Fixed by derivation, not by re-tuning.** Four layers that only make sense relative to each other now come from
one number:

```css
--zNetroot:99999;                        /* the netplay lobby covers the board            */
--zOverlay:calc(var(--zNetroot) + 1);    /* a dialog must outrank the lobby (v1.31.36)    */
--zPeek:calc(var(--zNetroot) + 2);       /* peek's panels must outrank the dialog backdrop */
--zPeekBar:calc(var(--zNetroot) + 3);    /* ↩ Back must outrank the lifted panels          */
```

The next person to raise the overlay carries peek along automatically — the same reasoning as the version stamp
being read from README rather than declared twice. **Do not reintroduce a bare number there.**

**`#cardFull` joins the lift.** The hand stays tappable during peek, so 🔍 View card can open the full-screen
reader — and at its own `z-index:37` that reader would have opened *behind* the peek backdrop. Same bug, one
layer along, and it had never been reported because peek was unusable anyway.

`landscapetest` grew nine hit-tests (108 → 117) at phone and desktop. **No DOM assertion can see this** — the
elements are present, styled and wired; only `elementFromPoint` says what is actually on top. Verified by
restoring the hardcoded values: nine assertions go red, each naming `overlay` as the topmost element. Its stated
limit: it stages the peek *classes* rather than finishing a duel and pressing 👁 Peek, because the stacking is
pure CSS — it does not cover a JS regression inside `enterPeek` itself.

### v1.31.60 — "↓ New" is reachable, and reading history no longer yanks you away

`logAtBottom()` decides whether a new battle-log entry auto-follows or raises the jump-to-newest button, and its
slack was a flat **80px**. Whenever the log overflowed by *less* than that, every scroll position read as "at the
bottom" — so `setLogNewBtn(true)` was unreachable and the button could never appear, while auto-follow pulled
you back to the newest line as you were reading history.

Measured on desktop in a real solo game: 13 lines overflow by **23px**, and scrolled fully to the **top** the old
test still returned true. The slack is now capped at half the scroll range, so top and bottom stay
distinguishable however short the history is.

Aj reported it as a netplay gap and then checked the desktop himself: *"oh wow… it's not there on desktop
too"*. **That observation is what made it findable** — I had a plausible netplay-specific theory and it was
wrong. Third report this week that turned out to be shared code rather than netplay.

`landscapetest` grew four assertions (104 → 108). The **small-overflow** case is the only discriminating one —
with a long history the old and new rules both raise the button — so the log is padded to an overflow under the
old 80px slack before asserting. Verified by restoring the flat slack: the button stays hidden **and** the
scroll position jumps to 24, which is the yank the fix removes.

Two staging traps are recorded in the suite, because both produced a confidently wrong run first: trimming the
log to a small overflow can overshoot to **zero** overflow (removing one tall entry takes 70px straight to 0),
where every scroll position is legitimately the bottom and the test proves nothing; and playing 14 turns to
build history **finishes the duel**, disabling Fight and Pass so nothing can trigger the final entry. The second
one only surfaced because the assertion prints why it failed.

### v1.31.59 — a long battle log scrolls instead of evicting the hand

Both portrait `#board` blocks declared the play row as `minmax(min-content,1fr)`, so the row grew to whatever
its tallest child needed — and `#log` has no natural height. Measured at 360×740: the row was **4218px inside a
740px viewport**, `#log` never scrolled (`clientHeight === scrollHeight`), and because the portrait board has no
`overflow-y` the hand was not below the fold but **unreachable**. Opening the battle log made the game
unplayable. Reported as a netplay bug; it reproduces in solo, because the layout is shared.

**The fix was already in the file, in one media band only.** The landscape block has used `minmax(0,1fr)` since
it was written and its comment names `min-content` as the cause — *"the phone branch's `minmax(min-content,1fr)`
let the hand force its own minimum and push everything down"*. The two portrait blocks were never updated. That
is the third instance this week of a fix landing in one place and not its siblings, after the two invite
renderers and the three deck-picker defaults: **grep for the pattern, not the symptom.**

Measured after: the row is **228px** at 360×740 and **277px** at 390×780, the log scrolls, and the hand is on
screen. Landscape (139.6px) and desktop (455.1px) are byte-identical to before.

`landscapetest` grew eight assertions (96 → 104) covering **both** phone bands plus landscape and desktop as the
negative half — a global cap and a dead cap both pass a single measurement. Verified by reintroducing the bug,
which reports the hand at *y 4407..4731 of 740*.

### v1.31.58 — the narration audit: nineteen sites that never left the host

Aj's two saved battle logs from the same game (2026-08-29) diverged on **every** Ride, transform, INCARNATION
and counter: the host logged them and the client's log had nothing at all. The cause was `logMsg` where `say`
was needed — `logMsg` is host-local, which is how clients had an empty battle log until v1.28.2.

**Nineteen sites converted**, in two groups. *The local player's own actions*, which run on the host because a
client early-returns to `clientSend`: the discards, the pass, the lock-out, the shield guard and its decline,
the pre-fight pass, Back Stab, the counter and instant-speed answer, and the Ride/transform/INCARNATION line.
*The host narrating a client's action*, which additionally wrote a **name into the template** (the v1.31.53 bug
class): both respond handlers, the N-player play and pass lines, and the host's Back Stab.

Everything moved to **past tense** with `{who}`/`{foe}`, because past tense removes subject-verb agreement and
one string then reads correctly for every seat. `'{who} put a card on top of your deck'` became `…the deck`, for
the same reason a possessive cannot be sender-written.

**`{foe} is out!` is fixed too.** v1.31.55 moved `{who}`'s verb to past tense and left the copula on `{foe}`
alone, so a client reading itself as the foe got **"You is out!"** — Aj hit it in a real game. A verb attached to
`{foe}` needs exactly the same treatment as one attached to `{who}`; neither name's number is known when the
template is written.

**`nettest_narrate.js` (10) is the guard**, and its second half is the durable part. It asserts a host event the
client did not cause reaches the client's log, and then scans the client's log for **sender-baked grammar** —
`You is`, `You has`, `You moves`, `You’s`, each of which has shipped at least once. Verified by reintroducing the
bug: three assertions go red, including the log-length ratio (client 1 line vs host 3).

A note on picking the event to assert: the first version watched for the host's **pass**, which never fires the
converted line in a duel — a host pass always ends the round, so the round announcement covers it. The transform
is the event that actually diverged in Aj's logs, and it needs both seats' shields forced low, because the
transform tiers are gated on total table shields lost.

### v1.31.57 — the floating controls come back into the layout, and emotes stop being refused

Two netplay-only controls were `position:fixed` overlays on `<body>`, deliberately outside `#netroot` (which
`renderNet` rewrites) so they stayed reachable. Being outside the layout, they had no idea what they were
sitting on top of — and on a phone they were sitting on the controls.

**"← Leave" is now the third state of `#newBtn`** — `🏳 Concede` during a live game, `← Leave` when online with
nothing live (the lobby and the end screen), `New Duel` offline. As an overlay it covered the Concede/help row
and, measured at 390×780, **79% of the card reader's CLOSE button with only 17% still clickable**. That one is
not cosmetic: Leave *drops the relay room*, so a player tapping what looked like Close left the game. A header
button cannot float over anything, which is why this is the fix rather than a new z-index — the same reasoning
as the peek regression a raised z-index caused in the first place.

**The label is "← Leave", not "← Leave online", and that is load-bearing.** The header does not wrap above the
phone breakpoint and its buttons are `flex:0 0 auto` (they must never shrink or clip), so a label wider than the
`New Duel` it replaces pushes the last button off screen — measured at 720px, `#newBtn` ran to x=728 in a 720px
viewport. **`header{flex-wrap:wrap}` was tried first and reverted:** it fixed the overflow and cost landscape
~40px of header height, which `landscapetest` caught as five failures (the pile no longer cleared the hand, and
the play area no longer fit a pile card). Landscape is the tightest case in the app; a narrower label costs
nothing anywhere.

**The emote bar is now a member of the `#actions` row**, with its list popping upward. As
`left:10px; bottom:10px` it sat exactly where `#actions` renders on a phone, so 💬 covered Pass. `#actions` is
static markup that `render()` never rewrites, so an injected child survives — which is why it, and not
`#netroot`, is the right home.

**The emote popup is clamped to the viewport.** Neither CSS anchor works on its own, because `#actions` wraps:
the bar sits at the RIGHT on a wide screen, where `left:0` runs off the right edge (4 of 7 emotes reachable at
720px), and near the LEFT once the row wraps, where `right:0` runs off the left (1 of 7 at 327px). Both
measured. `placeEmoteList` lays it out and nudges it back on screen. `nettest_emote` asserts **both** ends of
that range, since either anchor passes at one of them — and it drives the real toggle, because adding `.open`
by hand skips the handler that does the clamping and makes the assertion vacuous.

**Board-independent intents are no longer stamped, which un-breaks emotes over netplay.** v1.31.54's stale-intent
guard ran ahead of the emote dispatch, so an emote — which is not formed against a board, and is handled ahead of
every turn gate precisely because reacting off-turn is the point — could be refused for carrying a stale board
stamp. Rules suggestions had the same problem, and they are a *lobby* act where no board exists at all. Aj's real
game shows three emotes refused (`op=emote q=0 … state is 1`), and **`nettest_emote` had been red since v1.31.54
(17/2) without anyone noticing** — it is 19/0 again, matching its recorded count. Found by A/B against the
pre-change build after the suite failed here: the baseline failed identically, which is what ruled out this PR
and pointed at the guard.

### v1.31.56 — a dragged play goes through the host

`doFight` carried an `isClientActive()` branch that sends an intent to the host; the **drag-to-play release
called `playCards()` directly**, and `playCards` had no client guard. So on a netplay client a dragged play ran
the **local engine**, never reached the host, and left the client narrating a round the host never saw.

That one missing branch accounts for a long tail of reports: phantom rounds in the client's battle log
(`You played a Jab - 7♦` / `Rival passed` / a duplicated `Round 2 begins`), `Pair (NaN, NaN)`, a client that
appears to "race to the game end", and the "lag" that cleared the moment Aj switched to the Fight button.

**Aj found it by changing his own behaviour and watching the symptom move** — the Fight button worked, dragging
did not. That is a cleaner experiment than anything the instrumentation produced, and it beat several days of
theorising about the transport.

The guard now lives in **`playCards`**, the one function that actually plays cards, rather than at each entry
point — `sendClientPlay()` is the single definition and `doFight` calls it too (it must still short-circuit
early, because everything below it is host/rival pre-fight logic a client must never run). Any future way to
play a card is covered for free.

**`nettest_drag.js` (13) is the first suite to drive the drag path at all**, which is why this survived twenty
green netplay suites. It asserts both directions — the client sends an intent and the host receives it, and the
host's own dragging still works — and it was **verified by reintroducing the bug**: the two discriminating
assertions (`clientSend play` in the trace, and the host's board showing the play) both go red, while the
others stay green.

### v1.31.55 — the second name in a line travels as a seat

v1.31.53 fixed the grammar *around* `{who}`. This fixes the **other name**: the second seat a line has to
mention — the one that lost the shield, the one knocked out — was interpolated by the **sender** as literal
text, so it could never be right for a reader. `{foe}` now travels as **seats**, and each end names them in its
own frame.

Staged and verified, with neutral names so nothing is ambiguous:
```
HOST    Rival won with a Pair - You lost a shield.
CLIENT  You won with a Pair - Rival lost a shield.
```
Before, the client read "You won with a Pair - **You** lose a shield".

**A NOTE ON THE EVIDENCE, because it nearly misled me.** The log lines I first pointed to as proof were
confounded: Aj's opponent had literally typed the name **"You"**, so "You won … You lose a shield" may have been
correct on his screen. The bug is real and the fix is right, but it is demonstrated by the staged run above —
**not** by those lines. Worth remembering that a player-typed name can imitate a rendering bug exactly.

Also in `nettest_sync`: a line naming the same side as both winner and loser now fails the suite.

### v1.31.54 — a client cannot act on a board the host has moved past

Aj: *"why is it possible for clients to go on playing without the host's go ahead? imho i think it should be
blocked."* He is right, and nothing prevented it — **mirrors carried no identity at all**, so a client could not
tell a replayed or delayed mirror from a fresh one, and the host could not tell an intent formed against old
state from a current one.

**`stateSeq` stamps every mirror**, and it advances **only when an intent is actually applied** — never per
render, which is what makes it usable: an intent is valid exactly while the board it was formed against is
still current.
- **The client ignores a mirror that goes backwards.** A replayed one carries an older stamp; applying it would
  rewind the board and invite the player to act on a board that no longer exists.
- **The host refuses an intent carrying a stale stamp — and re-broadcasts.** The re-broadcast is not optional: a
  client stuck on an old stamp would otherwise have every future intent refused too, and a silent deadlock is
  worse than the stale move it was protecting against.
- **Only refuses when the client actually sent a stamp**, so an older peer keeps working.

**Measured cost: nothing.** A full game traces **9 sends, 9 received, 0 refused, 0 stale mirrors ignored** — the
stamp does not touch legitimate play. Checked because a guard that intermittently refuses *valid* moves would be
worse than the bug it prevents; the action-count swings in `nettest_sync` turned out to be drive-loop variance,
not refusals.

**AND AJ EXPLAINED THE `NaN` CARDS, correctly:** *"since cards are from the host, at the beginning of the round
(which isn't gated somehow), the client just imagines cards."* Confirmed — the host resolves incoming plays
through `resolveIds`, which maps ids against **its** copy of the hand and drops anything unmatched, so a
fabricated card resolves to nothing and **the play is rejected**. The client's `Pair (NaN, NaN)` was therefore a
purely local narration of a move that never happened. The client was never playing ahead; it was **narrating
ahead about moves the host had already thrown away** — which is why state stayed in sync while the log looked
insane.

### v1.31.53 — one event, one log line, and narration that reads in every frame

**Solved from Aj's saved logs, and the traces were the reason it was findable.** Both traces were healthy end to
end — `move IN` / `hostTakeBack` / `awaitRival` cycling on the host, `mirror IN` / `mirror APPLIED` /
`clientSend` on the client, mirrors strictly monotonic to round 10, and **both headers agreeing on "Reached
Round 10"**. So the transport, the host authority, the relay and the room code were never the problem. The
defect was entirely in narration, which is why it looked catastrophic and measured as nothing.

**Two bugs, and each hid the other.**

**1. A BROADCAST TEMPLATE MUST BE READER-INDEPENDENT.** `say()` sends the template plus the actor's absolute
seat and the receiver rotates `{who}` — that always worked. But the grammar *around* `{who}` was baked in the
sender's perspective, and a receiver cannot undo it:
```
host about itself    "{who} move N cards from your deck"   -> client: "Rival move 1 card from your deck"
host about a client  "{who} moves N cards from their deck" -> client: "You moves 2 cards from their deck"
```
Both forms are in Aj's log character for character. **The fix is PAST TENSE**, which removes subject-verb
agreement altogether so one string reads correctly for every reader — no sender-side branch to get wrong.
Possessives went the same way ("You’s hand" was the other tell). Three templates: the catch-up mill, the
FIGHTER KICK and the returned shield.

**2. ONE EVENT, ONE LOG LINE.** A client narrated every round resolution **twice** — once from its own ceremony
replay (which exists to drive the animation) and once from the host's broadcast. Measured: host 5 round-wins and
5 catch-ups, client **10 and 10**, banners 5 on both. `sayOnce` is `say` on a host or in solo and a no-op on a
netplay client, because **the host is the authority and owns the shared history**.

**THE MEASUREMENT TRAP, which cost most of a session and is the lesson worth keeping.** The two copies are **not
adjacent** — the catch-up line sits between them. So an "adjacent duplicates" probe reports zero, and an A/B
built on it reads as a **null result**. I implemented fix 2 hours earlier, measured adjacency, got null, and
**reverted a correct fix**. The metric that works is the **count ratio against the host**: the host is the
authority, so its count is the truth. `nettest_sync` now asserts exactly that, plus that no line is stuck in
the host's grammar.

**Why no suite caught it:** they check state, controls and each side against expectations. Nothing compared the
two sides' NARRATION. Aj's two saved logs did, in seconds.

### v1.31.52 — Save on the end screen, and the two probes the trace was missing

**⤓ Save the battle log is now ON THE END-OF-GAME SCREEN.** Aj: *"i forgot that it's impossible to get the logs
when the game ends... and i regret not getting it earlier"*. Review-the-board did technically reach the log,
but navigating away at the one moment you have something worth sending is not a path anyone takes — and
v1.31.51 had just put the netplay TRACE in that same file, so an unreachable Save made the whole diagnostic
unreachable exactly when it mattered. Verified end to end: the button is present and visible on the end
screen, produces a file, and confirms.

**THE EXPORT SAID `deckout` WHENEVER AN OPPONENT QUIT.** `lastEndType` defaults to that and the
opponent-concede path never set it, so two of Aj's five exported games are filed under the wrong ending —
and an ingestion log cannot be repaired after the fact. Now `concede`.

**AND THE TRACE KILLED THE LEADING THEORY, which is what it was for.** Two real traces arrived and between
them established that the host received NOTHING (parked at `awaitRival`, never took control back) and that the
client's `isClientActive()` returned **true** — so it was never falling through to the local engine, and both
the `started` theory and the v1.31.50 guard are beside the point for this fault. `clientSend` was never traced,
yet the client's log advanced five further rounds. Something fed it state the host did not send.

So this version adds the two probes that were missing: **`mirror IN` / `mirror APPLIED`** on the client and
**`move IN`** on the host — the latter shouting when the source channel is unknown and the seat had to be
guessed. One more pair of saved logs should name the cause. Four inference-only diagnoses have been wrong now;
the instrument is doing the work the reasoning could not.

### v1.31.51 — a netplay trace, and the cross-check that should have existed

Aj: *"how does it say that no tests failed when we can't even get to round 2 legally on the same computer"*.
Verified by grep rather than argued, and the answer is structural:
- **`nettest_relay` never played a move** — no `fightBtn`, no `passBtn`, no round assertion. It proved a
  connection and a deal and stopped.
- **`nettest_rtc` never touched the relay** — it plays rounds over copy-paste.
So **no suite had ever played one move over the room-code path**, which is how twenty-odd green netplay suites
could not see a client forking a duel.

**And the deeper gap: every suite drives ONE side and asserts against EXPECTATIONS. None compared the two sides
to each other.** Aj's two saved battle logs did that comparison in four seconds and found a divergence nothing
automated could. `nettest_sync.js` is that comparison: it plays a real game over the room code and asserts, at
every step, that the two ends agree on the round and that **each side's view of the other's hand size equals the
other's actual hand** (seat-rotated — a client's own seat is index 0). It reaches round ~14 in ~50 actions, and
**5 runs are green**, so straightforward relay play does not fork. **Reach for this shape whenever two peers
hold state: assert they AGREE, not that each looks plausible.**

**DIVERGENCE MUST PERSIST TO COUNT.** A client's hand changes only when the host's mirror lands, so immediately
after the client plays there is a legitimate window where the host says 5 and the client says 6. The first
version compared mid-flight and reported a fork on the very first move — a false positive that would have
discredited the suite on sight. It polls until the mismatch clears: transient is the system working, persistent
is the bug.

**THE NETPLAY TRACE IS ALWAYS ON, and that is forced by the platform.** A downloaded copy opens as
`content://`, which **cannot carry a query string**, so anything behind `?dbg=1` can never be captured on the
device where the interesting failures happen. So it costs nothing, runs by default, and **lands in the ⤓ Save
file** — the one artifact a player can actually hand over.

It is traced **inside `isClientActive()`** rather than at its call sites: every action funnels through that one
function, so no branch can escape the probe, and `role` and `started` — the two values that decide it — are
recorded on every call. A client reading false there prints
`<< A CLIENT IS ABOUT TO RUN THE LOCAL ENGINE — THIS IS THE FORK`, verified to fire on the real case.

Two flaws found and fixed while building it, both of the kind that make a diagnostic worse than none:
- **The fork warning also fired on the HOST**, where falling through is correct — the host *is* the authority.
  A trace that shouts about a non-bug sends the next reader down a false path.
- **`started=true` logged on every mirror** rather than on the transition: 19 entries for two moves, and it
  would have blown the 500-entry cap in a real game. Transitions only, with consecutive duplicates collapsed
  to `xN`. A real game now traces in single digits.

### v1.31.50 — awaitRival set two things; every path cleared one

Split out of v1.31.49 **specifically so the two builds can be told apart.** Aj was mid-verification on a phone,
the fix had gone into v1.31.49 without a bump, and "still the same" could equally have meant *the fix does not
work* or *you are holding the old download*. A stamp that cannot distinguish them is the one failure the stamp
exists to prevent — see the v1.31.21 note, where a "missing feature" was a stale download and nothing on screen
could say so. **If a fix needs field verification, it needs its own version.**

`awaitRival()` sets **two** things — `busy` and the "Waiting for opponent…" text — and every path that handed
control back cleared only `busy`. So the host's board went live while its screen still said the rival was
thinking: its turn, Pass enabled, and nothing on screen to believe it. Both players then wait for each other
forever with nothing broken underneath, which is what *"the duel was unsalvageable"* looked like.
`hostTakeBack()` clears the pair together at all ten control-return sites.

**Not the v1.31.20 wedge**, though it wears its clothes: that one genuinely left `busy` set, and its fix lives in
`resolveRoundCeremony`, which only runs when a client's move **ends** a round. This is the ordinary case that
fix never covered — a client move that simply passes the turn back. `nettest_clientwin.js` is the deterministic
mirror of `nettest_roundstall.js` (the client answers with the apex 2, so the host cannot reply) and reproduced
it before the fix.

**It predates the relay.** I had explicitly refused to rule the relay out; the repro settled it. Any netplay duel
could hit this, and it waited for a human to play one because **no suite had ever asserted what the status line
SAYS** — they all check state and controls.

**GHOST SEATS — and this one WAS the relay's fault.** Aj's host showed *"Passo is covering Dustin
(auto-passing)"* and a battle log reading *"you play Pure Rogue vs Dustin (Fighter) on Warlock (Wiz+Rog)"* —
**two opponent seats** in what he thought was a duel. His phone had three tabs open; the extras each took a
slot, went dead, and Passo auto-passed for them. So the "Rival passed" he never made was Passo covering a
ghost, and his turn never came back because the game was waiting on a tab nobody was looking at.

**The cause was auto-minting.** After accepting a join the host published a *fresh* offer straight away, so the
room always had an open slot and anything that reloaded joined silently. The copy-paste flow could never do
that — a second player needed the host to hand over a new code. Adding a slot is now the same explicit act
(**＋ Invite another player**), so the relay has the same semantics instead of a quietly open door.
`nettest_relay` asserts a second claim finds nothing **while the room is still open** — and the timing is the
whole assertion: starting the game drops the room, so the first version of this check ran afterwards, got a
404, and would have passed on the broken build.

**THREE COUNTS, AND THEY ARE NOT INTERCHANGEABLE.** `readyCount()` = confirmed, `joinedCount()` = has a seat,
`openChanCount()` = channel up. A seat only exists once the client sends `t:'join'`, which it does when it
presses Ready — so between "their channel opened" and "they confirmed" the host said **"No players yet"** with
somebody plainly sitting there. The roster now says *"● 1 connecting — waiting for them to choose a deck…"* and
the netbar counts the widest of the three, because "N connected" should mean *somebody is here*. Start still
gates on a **seat**, because that is what `hostStartRealN` indexes.

**And "Connection lost (disconnected)" was never ours.** Aj's office wifi isolates clients — the same thing that
made cell 3 of the origin probe unreachable this morning — so WebRTC had no route. On mobile data it connected.
Worth keeping because the symptom points at the code and the cause was the network: **the room code and the
long code produce the same SDP and the same peer connection**, so switching signalling cannot fix a transport
problem. Aj: *"i like the easy invite code... so i'd like to keep it."*

**Also diagnosed from Aj's screenshots, and it is a SYMPTOM, not a second bug:** two cards rendering as
`0 undefined 0` are exactly the two round-2 draws. The client replays the draw ceremony locally and fills the
real cards in from the host's next mirror; when the host stops broadcasting, none arrives and the placeholders
stay. They "loaded a bit later" on the first attempt because a mirror did arrive. **A card should still not
paint before it has a rank** — that guard is in the BACKLOG.

### v1.31.49 — four characters instead of a round trip

**And the first real game found a bug that was never the relay's.** Aj hosted on a laptop against his phone and
sent two screenshots: host on *"Round 1 · YOU · JAB · Rival is fighting… · Waiting for opponent…"*, phone
already on *"Round 2 · You won the round of Jabs"*, and *"the duel was unsalvageable"*.

**`awaitRival()` sets TWO things — `busy` and the "Waiting for opponent…" text — and every path that handed
control back cleared only `busy`.** So the host's board went live while its screen still said the rival was
thinking: its turn, Pass enabled, and no reason on screen to believe any of it. Both players then sit waiting
for each other forever, with nothing actually broken underneath. `hostTakeBack()` clears the pair together at
all ten control-return sites.

**This is NOT the v1.31.20 wedge**, though it wears its clothes. That one genuinely left `busy` set, and its fix
lives in `resolveRoundCeremony` — which only runs when a client's move **ends** the round. This is the ordinary
case that fix never covered: a client move that does not end the round and simply passes the turn back.
`nettest_clientwin.js` is the mirror of `nettest_roundstall.js` and reproduces it deterministically (the client
answers with the apex 2, so the host cannot reply).

**It predates the relay, which is worth stating because I had explicitly refused to rule the relay out.** Any
netplay duel could hit it; it took someone actually playing one to notice, because no suite had ever asserted
what the status line SAYS. The A/B I recommended turned out to be unnecessary — the reproduction settled it —
but recommending it was still right, and the answer came from a deterministic repro rather than from reading
the code, which is the same lesson this file keeps recording.

**A host shows a four-character room code. A joiner types it. That is the whole handshake.** Signalling used to
be a *round trip* — the host makes an invite, a human carries it, the joiner makes a reply, the human carries
that back. Two exchanges in opposite directions. Everything before this made each exchange cheaper (a QR, a
share sheet, codes six times shorter, two columns in landscape) without removing either one, which is why it
still felt bad. Aj, after all of it: *"i don't know how to proceed so that the multiplayer is easierrrrrrrr."*

**The game is still peer-to-peer.** The relay carries the SDP exchange only; once the browsers find each other
they connect directly and the relay is out of the loop for the entire game.

**IT WORKS FROM THE DOWNLOADED FILE, and that is the result that made this worth building.** A `file://` (and
`content://`) page is an opaque origin, and whether it could `fetch` a cross-origin relay was the load-bearing
assumption — tested before a line of the feature was written: **GET 200, POST 201, room created**.
`content://` was left explicitly unverified rather than assumed, and **Aj settled it on a real phone the same
day: a game joined by room code from a `content://` copy** (URL bar `content://media/e…`, live in round 2). So
both opaque origins reach the relay.
`Access-Control-Allow-Origin: *` covers an opaque origin. So the single offline HTML gets room codes with **no
hosting at all** — the thing Aj declined for months turns out not to be required for the feature that needed it.

**Every relay call fails soft, and the manual path is the floor.** No network, a blocked domain, a dead relay or
an older build on the far end all land the player on exactly the previous screen. `nettest_relay` asserts that
in **both** directions — the relay path connects a real game, *and* `norelay=1` plus an unreachable relay each
produce a full invite code with no room code promised.

**The netbar stops lying.** "no server" was true for every previous version, so with a relay carrying the
handshake it would be a lie rather than a stale string. It reads **"relay for the handshake only"** while a room
is open, and "no server" again once it is gone — both asserted. The screen also says outright that connection
details including the IP address pass through the relay while the room is open, and that the invite code avoids
it entirely.

**`dbg=1` NOW IMPLIES NO RELAY unless `relay=` is given.** Every `nettest_*` suite passes `dbg=1`, and without
this each of them would have opened rooms on the **production** relay on every run — test traffic against a
live service, and suites that fail whenever the machine is offline. Hermetic by default; a suite that wants the
relay names it, which is what `nettest_relay` does against `relay/mock.js`.

**AND THE HOST COULD NOT SEE WHO WAS IN THE ROOM** (Aj, on the first real try: *"i cant see who's in the
room ahhaa"*). Two bugs stacked, one of them introduced by this version:
- The roster line lived only in the lobby's `else` branch. That was fine while a host **left** the invite step
  as soon as it pasted a reply — the relay puts it straight back, because it mints the next offer the moment it
  accepts a join, so the host sits on `host-invite` permanently and the roster was unreachable. `Start Duel`
  appearing was the only evidence anyone had arrived. It now renders in **every** branch.
- **`readyCount()` is not a count of connected players.** It counts seats whose `rulesGen` matches, i.e. seats
  that have *confirmed*, so the netbar read **"0 connected"** with somebody sitting in the lobby. Both numbers
  are real and are now reported separately (`joinedCount()` for arrival, `readyCount()` for readiness), because
  the host needs the first to know someone showed up and the second to know whether Start will work. The Start
  button gated on the wrong one too; `hostStartRealN` had always used `nextSeat-1`, so the button was the
  inconsistent half.

**One correction made in passing.** I added a reflow-on-open for the QR, reasoning that a canvas inside a
collapsed `<details>` has no width. Measured: Chrome still gives layout to closed-details content and the
symbol was already the right size (345 CSS px either way). The guard stays — closed details content has no box
in some browsers — but its comment now says it is insurance rather than a fix for an observed bug.

`nettest_relay` is new: **14 assertions**, driving host and joiner through `relay/mock.js` to a real WebRTC
DataChannel with nothing copied or pasted.

### v1.31.48 — the invite goes two columns in landscape

The QR and the code box now sit **side by side** on a landscape phone, instead of stacked with the Copy button
below the fold. Height is the scarce axis there and width is abundant — a centred QR left roughly a thousand
pixels of empty screen either side of it — so the pair goes horizontal. Measured at 915×412, 844×390, 667×375
and 568×320: the QR, the code box and Copy are all on screen together, and the pair fits the viewport height,
which stacked it did not. Portrait and desktop keep the stacked layout, which is right where height is not
scarce.

This is what v1.31.47 was reaching for and did not get. Capping the symbol bought 15% of the height back and
still left the button underneath it; only the layout change reaches it.

**One helper, two call sites.** `sigPairHTML()` wraps QR + code + Copy + Send it, used by the host's invite and
the client's reply, which are the same three controls.

**The QR column has a DEFINITE width, and that is load-bearing.** `qrInto` measures `.qrWrap`, so a
shrink-to-fit flex item would hand it the canvas's own 300px default — the trap CLAUDE.md already records —
and worse, once the canvas sets its own CSS width the wrapper shrinks to match, ratcheting the symbol smaller
on every reflow. A fixed 235px basis breaks the feedback loop, and `qrtest` reflows twice and asserts the size
holds.

**THE INVITE HAS TWO RENDERERS, and the first fix went to the wrong one.** `renderHostRtcLobby` ("Invite a
player — send them this") is the one a real host reaches; the other is the BroadcastChannel path ("Step 1 —
send this invite to your friend"). Patching only the latter produced a measurement reading `stacked` at every
viewport, because `.sigPair` was not in the DOM at all — which is what saved it, since the layout looked
untouched rather than subtly wrong. **`grep qrInto(` before assuming there is one invite screen.**

Also: the QR caption said "or send them the code **below**", which stops being true the moment the code sits
beside it. It just says "the code" now.

`qrtest` 28 → **32**. Verified non-vacuous by forcing the pair back to `display:block` — the side-by-side and
the fits-the-viewport assertions both go red. Note the "all three visible at once" assertion passes even
stacked once the block is scrolled to centre, so the two carrying the weight are those.

### v1.31.47 — the landscape QR stops eating the screen

Aj, holding a phone sideways: *"just barely fits on the screen."* Measured at 915×412, the invite QR was
**263 CSS px — 64% of the viewport height** — at **4.6 CSS px per module**, against the **2.0** that landscape
used to have and that a real phone was confirmed to read. Maximising the symbol was the right call when the
invite was 109 modules and every pixel counted; v1.31.46 packed it down to 49, and the sizing logic went on
spending the surplus on height it no longer needed.

**On a short viewport only, the symbol now stops growing** once each module is comfortably readable: 197 CSS px,
**3.5 px per module, 49% of the viewport**, still a whole 7 device px per module. Desktop and portrait are
untouched — height is not scarce there, and the bigger symbol is the one that reads across a table.

**The cap is per MODULE, not a fraction of the screen.** "Big enough to scan" is a property of the module; a
fraction of the viewport silently means something different at every payload size, which is exactly how the
old code drifted into oversizing when the payload shrank. Quiet zone included, matching how `qrtest` measures.

**`qrtest` 19 → 24, and it asserts BOTH directions**, because neither failure shows up in a single
measurement: a cap that fired everywhere would be a silent shrink of the desktop symbol, and one that never
fired would leave the phone where it was. So the landscape case asserts the cap bit *and* stayed above the
2.5 px camera floor, and a tall viewport asserts it did **not**. Verified non-vacuous by disabling the cap —
two assertions go red.

**AND THE CAP FIXED THE WRONG CONFIGURATION, which only a real phone revealed.** Aj, on a build carrying it:
*"no difference really for me."* The symbol is sized **once, at draw time**, so a page opened in **portrait**
and then turned sideways keeps its portrait size — **85% of a landscape screen**, worse than a page that loads
in landscape, and the cap cannot help because at draw time the viewport was still tall. That is the
configuration a person actually hits: you open the game, then you rotate to show someone. `qrInto` now records
what each canvas is displaying and a debounced `resize`/`orientationchange` handler re-renders it — 351 → 197
CSS px turning sideways, and back again. The redraw is skipped when the bitmap would not change, because
CLAUDE.md's ResizeObserver lesson applies to any resize-driven write.

**A LAB NUMBER IS NOT THE REAL NUMBER.** The **163-char** code quoted in v1.31.46 came from a headless browser
with one network interface. A real phone on 5G *and* wifi emits several candidates including IPv6, so the true
code is longer and the symbol denser than v8. The packing win is real and large; the specific figure is a
**floor**. Trimming the candidate list — the remaining bulk of the payload — is the next lever, and it needs
care, since the candidate that is dropped may be the one that would have connected.

**Not fixed, and worth being straight about it:** the Copy button is still below the fold in landscape. The cap
bought 15% of the viewport back but the invite section is a single column, and on a wide-short screen there is
about a thousand pixels of unused width either side of the QR. A two-column landscape layout is what actually
puts the code box and Copy on screen beside the symbol; it is a layout change rather than a sizing one, and it
is not in this version.

### v1.31.46 — invite codes are six times shorter

**1,036 characters to 163.** The code was base64 of the **whole SDP**, and about 90% of an SDP is boilerplate
every WebRTC stack already knows. Only five things vary: the ICE ufrag, the ICE password, the DTLS
fingerprint, the setup role, and the candidates. The new format carries those and nothing else.

**The insight that makes it a packer and not a compressor**, and it was verified in a throwaway probe *before
any of this was written*: **a remote description does not have to be the bytes the far end produced.** It has
to be valid and mean the same thing. So the reader rebuilds a canonical data-channel SDP rather than trying to
reproduce the original — which is what makes the boilerplate droppable at all. Two `RTCPeerConnection`s
exchanging rebuilt descriptions opened a data channel on the first try; everything after that was detail.

Two things are dropped rather than carried, on the same reasoning: the candidate **priority** (ICE assigns it
by type, so recomputing it from the type preserves the ordering the browser intended) and the trailing
`generation 0 network-cost 999` / `raddr 0.0.0.0 rport 0` boilerplate. Text, not bit-packing, deliberately —
a person pastes this into a chat by hand, and a format they can eyeball is worth more than the last twenty
characters.

**`~` separates the fields, and that is not cosmetic.** The first version used `.`, which shredded every code:
a candidate address is full of dots — an IPv4 address, and the `.local` of an mDNS name. `~` cannot occur in
any field (ice-ufrag and ice-pwd are ALPHA/DIGIT/+// by RFC 5245, the fingerprint is base64url, an address
holds only hex, dots, colons and hyphens), and neither can the `,` and `|` used inside the candidate list.
`nettest_rtc` caught it immediately — 8 failures and a real connection that never formed.

**Old codes still work.** `dec()` tries the compact form, then the old whole-SDP one, so a code from someone's
chat history or from a peer on an older build still joins. The reverse is not fixable: a *new* code pasted into
an *old* build cannot parse, and that build has no way to say so beyond its existing "Could not read that
invite code."

**What it buys, measured.** The QR drops from **v23 / 109 modules** to **v8 / 49** at the ECC level the game
uses (`L`), so every module is **2.2× wider** at the same on-screen size. That lands hardest on the
landscape-phone case, the weakest geometry and the one still unverified by a real camera: about 2 CSS px per
module becomes about 4.6. It also brings the code close to hand-typeable, which was the original point of the
backlog item — that is the fallback when the two devices cannot talk to each other at all.
Note the instrument was validated before the number was believed: re-encoding the **old** 1,036-char payload
reproduces the recorded v23 / 109 exactly. A first run said v26 / 121, because `build()` defaults to a
different ECC than `qrInto` passes — **always encode at `level:'L'` when comparing against a recorded
geometry**, or the arms are not comparable.

**Tests.** `sharetest` 14 → **16**, and its two length floors became **shape** assertions — `>200` was a proxy
that went stale the moment codes shrank, while `/^C1~o~/` and `/^C1~a~/` cannot pass on a truncated or garbled
code either. The new pair covers the half that silently rots: a **legacy whole-SDP code, built from a real
offer**, is still accepted and answered. New codes are exercised by every RTC suite; old ones by nothing else.

### v1.31.45 — the 2 leaves the sequences

**A default change, not a new option.** The 2 can no longer be a link in any run — not a straight, not
consecutive pairs, not consecutive trios — so runs go from 3 up to the Ace. `Sequences can include the 2`
(`seqTwos`) is the opt-in half, and like every rule in the panel it defaults off; unusually, it is phrased
positively, because for once the shipped behaviour genuinely *is* the off value rather than something a
double negative had to describe.

**All three source games agree, which is what made this a default and not a toggle.** Tiến lên and Dou Dizhu
bar it outright and say so of every chain type ([pagat](https://www.pagat.com/climbing/doudizhu.html): *"at
least five cards of consecutive rank, from 3 up to ace… Twos and jokers cannot be used"*, repeated for 连对 and
飞机). Big Two lets a 2 into a run only by demoting it **below the 3**, so its top straight is 10-J-Q-K-A too.
Our `J-Q-K-A-2` window came from none of them — it fell out of ranking the apex at 15 and letting runs read the
same `fightValue`. Aj, on reading the family rules: *"the tien len and dou dizhu rules are looking like what i
remember from my own chikicha games."*

**The bar is on the CHAIN, never the baggage** — Dou Dizhu's rule exactly. A trio of 2s cannot be a link in an
airplane, but a lone 2 is a perfectly good wing; a 2 is still a legal spare on a trio, and a pair or trio of 2s
is untouched. The sharpest statement of the boundary: `A-A-2-2` is **not** a kit and **is** a poker two pair,
from the same four cards, because a two-pair allows gaps and therefore is not a chain.

**Measured, both arms, interleaved seeds.** Pacing does not move — medians 10/19/28 rounds at 2/4/6 players
against 10/18/28 with the 2 allowed — and the jab share shifts 0.1–0.3 points. What moves is texture: straights
played fall **27%** at six players (2638 vs 3626). That is the ninth rule in a row to change options without
changing tempo; treat it as the default expectation. Deck-neutral by construction, since every legal deck holds
exactly four 2s. Note any `rulesim`/`mpsim` row recorded before this version was measured under the old default.

**One implementation trap, since fixed properly, and one instrument bug it exposed.** The bar first reached
`detectKit` and left `A-A-2-2` legal, because the four-card slot had its own inline copy of "are these pairs
consecutive". Aj's question — *"isn't that a slippery slope to technical debt? why doesn't it use detect
combo?"* — was the right one, and the answer was that nothing justified the copy: `detectKit`'s floor is
`n < 4`, so it always covered that size. The slot now delegates to it and keeps only what is genuinely local,
the **mode dispatch** between kit and poker two pair. `test.js` gained the assertion that would have caught it:
a 4-kit and a 6-kit must **agree** about the 2 at both settings — per-size assertions pass with two copies
present, agreement does not. Confirmed non-vacuous by reintroducing the bug and watching it go red. And the panel reorder that pays for the new row *silently did nothing* at
first: `sectionsHTML` filtered `RULE_DEFS`, so a section's `keys` list decided only which rows appeared, never
in what order. It maps over `keys` now, so the list reads the way the panel renders.

**The rule lives in "The 2", not in Shapes** (Aj: *"since no preset use the Sequences can include the 2, can we
move it up to The 2?"*). The preset observation is the tell — every other Shapes row is something a preset
turns on, and this one is about the apex card. It sits after `apexNoStrip`, whose note says "unless the rule
above is also on" and means `apexInf`; that pair has to stay adjacent and in that order.

**The panel fits twenty rules at 1512×945, with no trimming**, and it now does so in **six** rule rows rather
than seven. Two things got it there. The Shapes section leads with its **mode** rows: a mode row is 102px
against a boolean's 46px and a grid row costs its tallest member, so three modes spread across three rows
charged 102px three times — clustering them recovered 112px, and rule twenty needed 108. Then moving `seqTwos`
into The 2 dropped Shapes from three rows to two while costing nothing, since The 2's row had two free columns.
Both orders are defensible on meaning first — the pair-run slot, the pair-run length, the straight's length and
the trio-run are one subject; the 2's rules belong under The 2 — which is the only reason they were acceptable.
**Do not reorder rows by control type to win pixels.**

**No Big Two preset** (Aj, asked and answered). Big Two's identity is the poker ladder and suit tiebreaks, and
we refuse both: our shapes only beat their own type at the same size, and our suits are **classes**, so ranking
them makes one class strictly better. A preset would have set two or three rules and claimed a whole game.
Recorded in CLAUDE.md with the reasoning, including that Pusoy Dos ranks suits ♦>♥>♠>♣ against Big Two's
♠>♥>♣>♦ — the same mechanic with incompatible orders — and that dropping the flush is itself an attested
variation, so our v1.14 removal has precedent inside the family.

### v1.31.44 — the chops get their own section

The rules panel is **five sections**: the chops leave `Shapes & chops` and become **Chops** of their own. They
are not one more shape — every other row in that section adds a play that obeys the shape-matching rule, and
these are the four that bend it. The split pays for itself twice over: the three chop rows drop the
`The chop:` prefix they each carried, because the heading now says it once (the same reason **The game** does
not repeat *Game mode* in its only row).

**The presets move onto their own line, ABOVE the Shapes heading.** They rode the right end of that heading,
which worked only while one section held every rule they set. A preset now spans the Shapes/Chops boundary, so
belonging to either heading would misdescribe it — the dedicated line is the consequence of the split, not a
preference. It went *below* the heading first and Aj corrected it (*"i think the presets should be on top"*),
which is the right read: under the heading it looked like one more thing inside Shapes, the single reading it
must not have. Above it, it governs the two groups that follow instead of belonging to one.
They also drop **"Specials"** from all three names (Chikicha · Tiến lên · Dou Dizhu), since a panel that is
nothing but specials was not distinguishing anything by saying so; a small **PRESETS** label on the line
carries the meaning the suffix used to, at less width.

**And the treadmill again.** A fifth heading plus a full-width preset row cost ~70px, which put a 14-inch MBP
14px over — exactly the failure mode CLAUDE.md warns about. Same fix as last time, in the wide tier only,
where the rows are short: section margins 5→3px, the preset line's own margin 10→3px, preset buttons
6px→5px tall. 1512×945 fits again.

**Three assertions had to invert rather than adjust,** which is the honest shape of a layout change:
`rulestest` asserted the presets sit **inside** a `.ruleSect` heading, and now asserts they are a sibling
between the Shapes heading and its first row; the section and scope-chip counts go 4 → 5. Added with them: the
preset line must **span every column** (measured as rendered width, not computed `grid-column`, which reports
`-1` inconsistently), and a preset must really **light rules in both sections** — driven by clicking Dou Dizhu
and reading which rows came on, then Clear all, so the probe leaves nothing behind. An assertion that read the
preset map back from a hook would have agreed with the renderer by construction.

**Dropped on the way in: chop strength as a mode.** Aj had approved four segments; reading the source rules
killed it (*"tien len likes to complicate things eh? … it's too complex for 'rulesets inspired by X'"*). The
lookup is kept in the BACKLOG entry, because it also settles how faithful we should be: a Tiến lên chop only
ever answers a **2** — never any other card — so the *any shape at all* segment was Dou Dizhu's 炸弹 all along;
and the faithful ladder scales with the **chopper's size** (3 pairs / a quad → a single 2; 5 pairs → a pair of
2s; 7 pairs → three 2s), whose upper rungs measure at **0.51%** and **0.00%** of real turns at six players.
Our flat reach of 2 stands.

### v1.31.43 — a correction: MAX_HAND is a discard limit, not a hand cap

Aj asked why zero chops ever landed on a lone 2. Chasing that produced the answer *and* exposed a measurement
error I had repeated for several versions.

**The lone-2 answer is timing, and neither of the things we guessed.** It is not the AI declining, and not the
damage payoff (with chops stripping vs not it is 172 vs 177 chops taken). Measured over 250 six-player games:

| pile | avg round | avg hand facing it | a chop in hand | taken |
| --- | --- | --- | --- | --- |
| lone 2 | **1.6** | 5.7 cards | 12 of 1103 (1%) | 0 |
| pair of 2s | **8.8** | 12.3 cards | 233 of 766 (30%) | 172 (74%) |

**Round 1 is singles only**, so a lone 2 on the pile is almost entirely a round-1 event — when hands are about
six cards and a chopper is arithmetically out of reach (four of a kind needs four of one value; three consecutive
pairs needs six cards from a six-card hand). By the time anyone holds a chopper, nobody is leading bare 2s. The
opportunity barely exists; the AI is not turning it down.

**And the correction.** That 12.3-card average is above `MAX_HAND`, which sent me to read it: `discardToLimit`
trims **after** your turn, so `MAX_HAND` is an end-of-turn limit, not a cap on what you hold while choosing a
play. **A player is on turn with more than ten cards on 78% of turns**, and 17 has been seen.

So every availability figure I took by dealing a 10-card sample was understated, and two claims in the changelog
were simply wrong:

| shape | claimed (10-card sample) | actual (per real turn, 6p) |
| --- | --- | --- |
| 4 consecutive pairs | 0.0–0.1%, *"decoration"* | **1.5%** |
| airplane, bare | 0.2% | **2.0%** |
| airplane + spares | *"needs your whole hand"* | **2.4%** |
| four + two | 1.0% | **4.2%** |
| trio + 1 | 24.1% of hands | 12.4% of turns |
| four of a kind | 1.1% | 3.7% |

**This matters beyond the numbers:** "the 4-Kit tier is decoration at 0.0–0.1%" was part of my argument for
dropping the trio reach when the choppers became peers. At 1.5% of turns that supporting argument does not hold.
The decision itself stands on its other legs — pagat puts the shapes at the same tier, and a six-card play should
not be strictly worse than a four-card one — but the weak leg is now marked as weak.

Fixed in the player-facing copy too: the airplane and straight notes no longer say "your whole hand".

**The rule, now in CLAUDE.md:** measure a shape's availability **per turn in real games**, never from a dealt
hand. This is the second time the same class of error has appeared — the first was reading a per-hand probability
as a per-turn rate — and both times it made a shape look decorative when it was not.

### v1.31.42 — full houses can be switched off, and the rules cluster shapes before chops

Aj, on being told the full house was a divergence no rule could express: *"in that case let's add a rule to
disable Full Houses."* So `noFullHouse` — phrased as the negative, because every rule in the panel defaults off,
the same inversion as `flatDraw` and `chopStrips`.

**Tiến lên Specials now sets it**, which is the second half of yesterday's audit: that game has no full house,
and until now nothing could say so. Its key is `kits3,quadro,noFullHouse,straightLen=3,chopQuadro,chopKits` —
faithful except for the chop reach, which is the next item.

Measured at six players: pacing barely moves (27.8 → 27.6 rounds) and the option count drops **4.9 → 4.1** per
turn, which is the clearest statement yet that the full house is a *common* shape — 19.6% of hands hold one.

**The rules reordered: every shape, then every chop.** `noFullHouse` landing between the chops and the Dou Dizhu
shapes made the panel read oddly, and rows render in `RULE_DEFS` order (the section's key list is a membership
test, not an ordering). Moving the four chop rules to the end groups the panel properly — and pre-stages the
chops-into-their-own-section PR, which now only has to split a contiguous block.

Nineteen rules took the panel 9px over at 1900px, so the wide-only rhythm was trimmed once more (gap 7→6, row
padding 10→9, section margins 6→5) for **857px** — fits at 1512px and up. The treadmill, on schedule.

Suites: `test` 314 → **318**, `rulestest` 135 → **138**.

### v1.31.41 — Tiến lên Specials was missing its own straights

Aj asked whether the preset had all of that game's specials. It did not: **`straightLen` was missing**, so the
preset played Tiến lên with five-card straights when its sequences run from **three**. The preset shipped in
v1.31.34 and the straight-length rule in v1.31.39 — it was correct when written and went stale a version later.

Audited against [pagat](https://www.pagat.com/climbing/thirteen.html), the game's plays are: single, pair, trio,
sequence of 3+, tứ quý (four of a kind, a bomb) and 3+ đôi thông (consecutive pairs, a bomb). The preset now
covers all of them — `straightLen='3', kits3, quadro, chopKits, chopQuadro` — with the first three always in the
game.

**The general lesson, now in CLAUDE.md: a preset is an exact state, so every rule added afterwards is implicitly
*off* in every existing preset.** That is the behaviour we want and it is what makes a preset button able to read
as active — but it means each preset must be **re-read whenever a shape rule lands**. The assertion checks the
VALUE (`straightLen === '3'`), because "not off" would not have caught this.

Checked the other two while there: Chikicha Specials is deliberately just the pair shapes and four of a kind, and
Dou Dizhu Specials was written after every rule it needs.

**Two divergences no rule can express yet**, recorded rather than hidden: our **full house is always on** and
Tiến lên has none, and its bombs reach only a **lone 2** where ours reach a pair (`chopReach`).

Suites: `rulestest` 134 → **135**.

### v1.31.40 — the pair rows describe the shape instead of naming it

Aj: *"let's call this 2 pairs — [Off] [Consecutive] [Non-consecutive] — and the other button: 3 or more
consecutive pairs."* The last of the naming pass that also gave us "Four of a kind" and "Consecutive trios":
**describe the shape rather than name it.**

| was | now |
| --- | --- |
| `Four-card double pairs` · `Off / 2 Kits / Poker` | **`2 pairs`** · `Off / Consecutive / Non-consecutive` |
| `3 Kits and up — longer runs of consecutive pairs` | **`3 or more consecutive pairs`** |
| `The chop: 3+ Kits beat the 2` | **`The chop: 3+ consecutive pairs beat the 2`** |

**This retires a vocabulary CLAUDE.md defended as load-bearing, and that note is updated rather than left to
contradict the panel.** What it was protecting still holds — the two four-card shapes must not share a name,
since one allows gaps and the other does not — and *Consecutive / Non-consecutive* says exactly that, where "2
Kits vs Poker" required knowing two card games to decode.

**The board name moved with it.** A played `kit` now reads **"2 Consecutive Pairs"**, not "2 Kits" — a player who
ticks one word and sees another played is being told two stories. It is *"N Consecutive Pairs"* rather than the
shorter *"N Pairs"* on purpose: `twopair` is **"Two Pair"** on the board, and two names differing by a single S
would be unreadable in a log line. `rulestest` now asserts the panel contains no "Kits" anywhere.

Internal types (`kit`, `twopair`) and rule keys (`dblPair`, `kits3`, `chopKits`) are untouched: they travel in
saved rule sets and in the netplay string, and stable keys are the habit that saved the `recruit` difficulty tier.

`nettest_suggest` caught the rename by itself — its vote chip asserts the mode's **value label**, so "Poker"
failing there was the suite doing its job, not a break.

Suites: `rulestest` 131 → **134**.

### v1.31.39 — the Dou Dizhu shapes

Four rules, and the first thing worth saying is that **one of the family's shapes was already in the game**: our
**full house is 三带二** — a trio plus a pair, compared by the trio, with the pair as baggage. So these are its
smaller sibling, its bigger relative, the trio version of a run, and a length unlock.

| rule | family | what it is | compared by |
| --- | --- | --- | --- |
| Trio + one spare card | 三带一 | trio + any single, size 4 | the trio |
| Four of a kind + two spare cards | 四带二 | quad + a pair or two singles, size 6 | the quad |
| **Consecutive trios** (a mode) | 飞机 / 飞机带翅膀 | `Off` / `Trios only` / `With spares` | the top trio |
| **Straight length** (a mode) | 单顺 | `Exactly 5` / `3 or more` / `5 or more` | value, at equal length |

**单顺 is not a new shape — it is the straight's MINIMUM LENGTH, and it is a mode** (Aj: *"turns straights into
something similar to the 2 pair group — OFF / 3 or more / 5 or more"*). A five-card chain and our straight are the
same cards, so a parallel type would have been ambiguous; and **"3 or more" is a strict superset of "5 or more"**,
which is exactly the relationship that forced the four-card double-pair slot to be a mode rather than two
booleans. `Exactly 5` is the shipped rule, so "off" here is a *length* like the others, not a disabled state.
`3 or more` is Tiến lên's floor, `5 or more` is Dou Dizhu's 单顺.

`beats()` already demands equal size, so a six-card run and a five-card run never meet — the family's own rule,
and what stops "longer" from meaning "simply better". `detectStraight` was generalised from exactly-5 to any
length ≥3, and the size-3 and size-5 blocks in `detectCombo` had to stop returning `null` early so a run could
still be claimed after the same-value shapes have had their say. **Getting that wrong is what made "3 or more"
see a four-card run but not a three-card one, and made every five-card run illegal** — the matrix across all
three modes is what caught it.

A three-card run is `[1,1,1]` where a trio is `[3]`, so they are never the same cards — but they *are* the same
size, and `beats()` keys on type too, so they cannot answer each other. That is the family's behaviour, asserted.

Measured at 6 players: pacing unmoved (27.9 / 28.4 / 28.3 rounds for off / 5+ / 3+), options per turn 4.9 → 5.0
→ **5.8**, the rise at "3 or more" being simply that short runs are plentiful.

**No mode was needed, because nothing is ambiguous.** Checked before building, by value-count signature:

| size | shapes | signatures |
| --- | --- | --- |
| 4 | Quadro · 2-Kit/two-pair · **trio+1** | `[4]` · `[2+2]` · `[3+1]` |
| 6 | 3-Kit · **four+two** · **airplane** · chain-of-6 | `[2+2+2]` · `[4+2]`/`[4+1+1]` · `[3+3]` · run |

No two shapes share a signature at the same size, so these are independent toggles rather than a mode.

**MY PER-HAND ESTIMATE WAS BADLY WRONG AT A BIG TABLE, and the correction is the useful part.** Availability in
one 10-card hand said trio+1 **24.1%**, four+two **1.0%**, airplane **0.2%** — so I called the last two nearly
decorative. But a six-player game is ~28 rounds with a **six-card draw**, so a player cycles far more cards than
one snapshot holds. Measured over real games, four+two is offered on **5.5% of turns at 6p** (0.4% at 2p) and
trio+1 on **14.2%** (5.5% at 2p), and the AI actually plays four+two **1363 times per 150 six-player games**.
**A per-hand probability is not an availability rate** — the draw and the game's length do most of the work.

**Pacing does not move. Fifth shape rule in a row.** 2p: 10.8 → 11.0 rounds. 6p: 28.4 → 28.1. And the option
count barely moves either — 4.4 → 4.5 offers per turn at 2p, 4.8 → 5.1 at 6p — because `enumerateCombos` emits
**one representative per shape and top value** rather than every combination. A 三带一's strength is its trio, so
every choice of spare is an equal-strength play; enumerating them all would have flooded the hand with dozens of
identical offers. The representative sheds the lowest spare, and any other spare still validates by hand, because
`play()` calls `detectCombo` directly.

**One section, not one per source game.** I first gave these four their own "Dou Dizhu shapes" heading, and Aj
asked why — correctly. **That section was already full of family shapes:** the kits are 连对/đôi thông, the Quadro
is 炸弹/tứ quý, poker's two pair is Big Two. Splitting the newest four out named one section by **kind** and the
other by **provenance**, and it broke the property the sections exist for — a preset belongs in the heading of the
group it changes, and Chikicha Specials sets a shape *and* a chop, so it spanned both. Merged back, and the panel
got **shorter** for it (one fewer heading). Which game a shape came from belongs in its note.

**The panel needed a fourth column, though.** Eighteen rules took it to 1107px in two columns. Four columns from
**1500px** (modal 1340px, growing to 1440px at 1780px) brings it to 826–843px, so it fits at everything from a
14-inch laptop upward. Below that it scrolls, and the assertion says so honestly: at 1280px it checks two columns,
that it *does* scroll, and that the **sticky footer stays pinned and hit-testable** — rather than claiming a fit
the rule count has outgrown.

Suites: `test` 292 → **304**, `rulestest` 109 → **119**. `mpsim` gains `trioone fourtwo airplane chain`.

**"Quadro" is now "Four of a kind" on screen** (Aj, 2026-08-28). With 四带二 sitting two rows away as "Four of a
kind + two spare cards", two names for the same four cards read as two different shapes. Renamed in the rule
label, the chop's label, both preset tooltips and the combo name shown when one is played.
**The key and the internal name stay `quadro`**: the key is in saved rule sets and in the netplay/export string,
and stable keys are the habit that saved the `recruit` difficulty tier from a silent break. So the tests and code
comments still say Quadro, deliberately — that is the shape's name in the engine, not on screen.

**The wings are in, as a mode** (Aj: *"is implementing the wings hard? we can give it the double pair
treatment"*). Not hard, and a mode is right for the same reason as the four-card slot: **"With spares" still
allows the bare form**, so it is a superset rather than an alternative. 飞机带翅膀 gives each trio one extra card —
a single each, or a pair each — and at `MAX_HAND=10` only the two-trio forms fit (**8** cards with singles, **10**
with pairs, your whole hand). Three trios with singles would be twelve, and the `n === 4k` / `n === 5k` arithmetic
excludes that on its own rather than by a special case. The spares must be uniform: eight cards carrying a pair
where two singles belong is nothing.

**Measured, and the wings change WHICH form gets played rather than how fast the game goes.** At six players,
120 games:

| mode | rounds/game | played | by size |
| --- | --- | --- | --- |
| Off | 28.6 | 0 | — |
| Trios only | 28.0 | 573 | 6 → 504, 9 → 69 |
| With spares | 27.9 | 511 | **6 → 18, 8 → 88, 10 → 393** |

Bare airplanes all but vanish (504 → 18) and the ten-card form takes over. The attachment is a **card-shedding
outlet**, which is exactly its job in the game it comes from — and worth noting our win condition is shields, not
an empty hand, so the AI spending ten cards on one round is its own policy rather than something the rule forces.

**And it is playable BY HAND, which nothing had ever checked.** Every other assertion drives the panel or the
engine; the path a person actually uses — selecting cards in the hand — had never been exercised with a large
shape. A ten-card winged airplane is the biggest play the game allows, so it doubles as the selection-cap test:
all ten select, the hint reads *"Special Consecutive Trios — fight!"* (so the rename reaches the board, not just
the panel), Fight lands `airplane/10` and the hand empties. Asserted now.
Worth recording how that nearly went wrong: the first version of the check counted `#hand .card.sel` and reported
**0 selected** while the play still landed — which looked like proof the UI could not do it. The hand renders
**groups** (`.group.gsel`), so the selector was wrong, not the UI. **A test whose result you cannot explain is not
a result** — the vacuous pass and the false failure were the same mistake in opposite directions.

**Renamed "Consecutive trios"** (Aj), like the Quadro pass: the shape is described rather than named. Internal
type stays `airplane`.

**And a Dou Dizhu Specials preset**, now that there is a set to bundle: `kits3, chainLong, trioOne, fourTwo,
airplane, quadro, chopQuadro`. 连对 is our 3 Kits — its floor is three consecutive pairs, so the four-card slot
stays off as in Tiến lên — 单顺 is the unlocked straight, and its 炸弹 is the bare four of a kind, which is why
Quadro arrives with the chop. Its 三带二 needs no rule at all: that is our full house.
**One divergence, recorded rather than papered over:** a Dou Dizhu 炸弹 beats *any* non-bomb play, while our chop
only reaches the all-2s shapes. `chopQuadro` is the closest thing we have, not the same thing.
It is also the sharpest test of "a preset is an exact state": coming from Tiến lên it has to turn `chopKits` back
**off**, which `rulestest` asserts.

**Not built, deliberately:** the winged airplane variants (飞机带翅膀) — a bare airplane already needs six of ten
cards. And the **landlord rule** (斗地主 is literally "fight the landlord": bidding, a 3-card kitty, one player
against two as a team) is a structural change with no home in an engine that has no teams and no asymmetric win
condition. Filed, not folded in.

### v1.31.38 — chops deal no damage, and why that is the default

**A round won by a chop costs nobody a shield.** Aj's reason is a design one, not a balance one:

> *"that'll be lines for players to think. nothing wrong with making them valid shapes… but making them chops is
> more non linear play."*

A chop already bends the one rule every other shape obeys — beat the same shape at a higher value. Its payoff is
therefore the **lead**, not a shield; paying damage as well would make the non-linear play the strongest play
too. This **changes what v1.31.33 shipped**, where chops stripped like any Special.

**The toggle is phrased as the positive — `chopStrips` — and that is load-bearing.** Every rule in the panel
must default OFF, because "is this game customised?" is literally `RULE_DEFS.some(ruleOn)`. A rule whose *off*
state changed the game would break that, so the option is "Chops destroy shields too", exactly the inversion
`flatDraw` uses.

**And the option is inert without a chop to modify** (Aj: *"this option should uncheck if chops were not
available"*). `needsAny:['chopQuadro','chopKits','chopSflush']` is a second kind of dependency alongside `needs`:
the row is dead while none of its group is on — clicking it changes nothing, asserted rather than merely styled —
comes to life when a chop is enabled, and **clears itself when the last one goes off**. A checked box that cannot
do anything is worse than a greyed one, and a rule left switched on for a game nobody is playing is exactly the
kind of thing that makes a rules panel untrustworthy.

Measured: at six players the default costs almost nothing in pacing — 28.5 rounds per game against 28.1 with
chops stripping — which is what you would expect from a rule that fires on ~14% of 2-plays.

**Why it needed a flag on the pile at all** — the thing Aj asked me to elaborate. `apexNoStrip` reads
`hasApex(st.pile.combo.cards)` at resolve time because *"was the winning play made of 2s?"* is a property of the
play **itself**. *"Did this play chop?"* is a property of the play **and what it beat**, and `play()` replaces the
pile the moment a play is accepted. Demonstrated before writing any of it — three different actions, byte-identical
piles:

| what the player did | resulting pile |
| --- | --- |
| led a Quadro into an empty pile | `quadro/4 key [7] byPlayer 0 cards 7D,7H,7C,7S` |
| beat a lower Quadro with it | `quadro/4 key [7] byPlayer 0 cards 7D,7H,7C,7S` |
| **chopped a pair of 2s with it** | `quadro/4 key [7] byPlayer 0 cards 7D,7H,7C,7S` |

So `play()` stamps `st.pile.chopped` between validating against the old pile and replacing it. It travels in
netplay snapshots with the rest of the pile, and a later play in the round overwrites it — correctly, since a chop
that is then beaten did not win. **`isChopOf(cand, cur)` is the single definition of "chops"**, used by `beats()`
to allow the play and by `play()` to record it; as two copies 400 lines apart they would drift, and the failure
would be a no-strip chop that strips.

Note `wonWithCombo=false` drives **both** the shield strip and the mill target, so such a round resolves exactly
like a jab win, as `apexNoStrip` does.

**The wide layout tightened to absorb the fourteenth rule.** Every rule costs a grid row (~76px), which took the
panel to 941px and pushed a 14-inch MacBook Pro back into scrolling. Trimming the wide-only rhythm — gap 9→7px,
row padding 12→10px, section margins 10→6px — brought it to **881px**: fits at 1080p, at 1900×1000 and at
1512×945. A 13-inch Air (1440×900) is 23px over, and 1280×800 scrolls as before. **A treadmill: the next rule
costs another ~76px.**

**Two of my own mistakes, both caught by things built earlier this week.** An edit script that asserts each anchor
and writes once at the end discards *every* earlier edit when a later assert throws — it looked twice like a change
had landed when nothing had been written; write after each edit. And slicing between two anchors that turned out to
be in the opposite order **duplicated** a block of `RULE_DEFS`, which surfaced immediately as a **"Uncategorised"**
section in the panel — the safety net added in v1.31.37 catching the person who added it.

Suites: `test` 287 → **292**, `rulestest` 102 → **104**.

### v1.31.37 — the rules panel gets sections, and the presets move into theirs

Aj: *"i want to bring the preset buttons closer to the rules it actually changes… but how will that look on
mobile?"* The panel is four sections now, and both presets live in the heading of the group they change:

| section | scope | rules |
| --- | --- | --- |
| **The game** | all player counts | Game mode |
| **Table rules** | 3–6 players | the four multiplayer ones |
| **The 2** | all player counts | the apex pair |
| **Shapes & chops** | all player counts | the pair shapes, Quadro, the three chops — **and both presets** |

**The Tiến lên preset is renamed "Tiến lên Specials"** (Aj), matching Chikicha Specials — and the pair reads
right, because that is what both of them are: sets of special shapes, and the only presets that touch nothing
outside this one section. The internal key stays `tienlen`; it is not serialised anywhere (`rulesKey()` carries
the resulting rules), but stable keys are the habit that saved the `recruit` difficulty tier.
On a phone the two buttons wrap onto their own line under the heading, where they are **left-aligned** with it —
the desktop rule pushes them to the right end of the heading, which on a wrapped line read as a stray indent.

**The mobile question answers itself:** a section heading is a full-width row in either layout, so the presets
need no horizontal room at all. On desktop the heading spans the columns and the buttons ride its right end; on a
phone they simply sit under the heading. Nothing about the idea needed the wide modal.

**Two things came free, and one is more than was asked for.**

**Scope moved from thirteen rows to four headings.** Every section turned out to be *scope-homogeneous* —
checked, not assumed: mode=duel, table=3–6, the 2=duel, shapes=duel. So the `3–6 PLAYERS` / `ALL PLAYER COUNTS`
chip is a property of the **section**, and a row repeating it was pure noise. Each row loses a line, and
`rulestest` asserts both halves: four section chips, and zero row chips. The intro line changed with it ("Each
section says which player counts its rules affect") — it now describes the sections rather than the rows.

**Clear all moved to the footer, beside Done, and the footer is STICKY.** Once the presets went down into their
section, a lone Clear all above the sections read like a section heading of its own — and both are whole-panel
actions, so they belong together. Aj asked for either a second copy of the pair at the top or *"one of those
floating things"*: **a sticky footer needs only one of each**, which is the argument for it. A second Done is a
second place to look, and a second Clear all doubles the chance of mis-tapping the destructive one.
It is a **sticky action bar** — the bar rides along pinned while its resting place is off-screen and **docks**
into the flow when you reach it, which is simply what `position: sticky` does. Measured on a phone at three
scroll positions: pinned 1px above the modal edge throughout, docked at the end, and **hit-tested clickable at
every one of them** — a bar that is present but covered is the v1.31.25 stacking bug again, and no DOM assertion
can see that. It bleeds through the modal's 24px padding, or rows would scroll past it in the gap.

**A rule that belongs to no section renders under a visible "Uncategorised" heading rather than vanishing**, and
`rulestest` asserts that heading is absent. The sections own their rule keys — one list to read — and the cost of
that choice is exactly this failure mode, so it is made loud instead of silent.

Panel height: **877px at desktop width and still no scrolling** (the four headings cost ~100px, the dropped row
chips gave most of it back). On a phone it is 1503px, down from 1620 before the notes were hidden.

Suites: `rulestest` 95 → **100**.

### v1.31.36 — the rules panel stops scrolling on a desktop

Aj, with a screenshot: *"what i'd hope to solve was the scrolling on desktop. because really you can fit more
with all this real estate."* Hiding the notes (v1.31.35) fixed the phone and only half-fixed this — the modal
kept a 470px `max-width` while his window was 1900px wide.

| viewport | modal | columns | result |
| --- | --- | --- | --- |
| 2560×1440 · 1920×1080 · 1900×1000 | 1120 | 3 | **fits, no scroll** |
| 1512×945 (MBP 14) · 1440×900 (MBA 13) | 1120 | 3 | **fits, no scroll** |
| 1280×800 | 860 | 2 | scrolls by 213 |
| 1024×768 · 900×1000 | 860 | 1 | scrolls |
| 390×844 | 350 | 1 | scrolls |

Two columns from 1040px, three from 1400px — **and the modal grows to 1120px with the third column**, because at
860px a third column narrows each one enough that the labels wrap more and the rows give back exactly what the
extra column saved. Content went 1050 → 777px.

**Getting the mode rows into the grid was most of the win.** They were spanning the full width to keep their
segmented controls roomy; letting them take a normal cell saved 79px on its own, and a segmented control still
gets 373px at two columns.

**`.modal` is shared by every dialog in the game**, so the width is a class on the rules panel and nothing else,
and `showModal` now **resets `#modal`'s class list** — two dialogs widen themselves (the Codex, and this), and a
reset here means neither can leak its width into whatever opens next, however it was closed. Both halves are
asserted: the setup dialog stays 470px at 1500px wide, and it is still 470px after the rules panel closes.

Small laptops and phones still scroll, which is fine — the modal was built to (v1.31.14), and 13 rules plus an
intro, presets, a warning and a Done button will not fit in 758px however it is arranged.

Suites: `rulestest` 89 → **95**, and `landscapetest` 96 green (its 8 device sizes and the 340px floor are the
guard that a wide-screen change does not disturb the narrow ones).

### v1.31.35 — the rule notes go behind a `?`

Aj's request: *"let's move all these descriptions into tooltips, maybe accessible by click on a `?` next to the
option name."* Thirteen rules with a two-to-three-line note each had turned the panel into a wall of text. The
notes are hidden by default now, and each row carries a `?` that opens its own.

**Measured effect on the panel:** ~2100px → **960px** at desktop width, and **804px** on a 390px phone. That is
the whole point — you can now see the list.

**The `?` is a `<span>`, not a `<button>`, and that is forced.** A boolean rule row *is* a `<button>`, and
nesting buttons is invalid HTML — the same trap the mode rows hit in v1.31.26. So it is a
`<span role="button" tabindex="0">` that calls `stopPropagation()`, because a click that opened a note **and**
toggled the rule would be the worst possible outcome. Asserted directly: the engine's flag is unchanged across
opening a note.

**Reading is the one thing read-only does not disable.** Every other control in this panel is dead mid-game, and
dead for a client that did not choose the rules — but the point of the panel on those seats is to explain the
game you are playing under, so the `?` stays live. Asserted in `rulestest` (mid-game) and `nettest_rules` (the
client). A client that cannot read the rules cannot meaningfully agree to them.

**Click, not hover** — the panel is used on a phone, where hover does not exist. Enter works too; **Space is
deliberately left alone**, because inside a `<button>` row the browser uses it to activate the row, which would
toggle the rule while you were trying to read about it.

**The assertions are about VISIBILITY, not text, and that distinction is the whole test.** `textContent` returns
a hidden note's words perfectly well, so a text assertion would pass on a note nobody can ever reach — exactly
what the BACKLOG entry predicted before this was built. They check `offsetParent` instead. (Nothing was
silently weakened in the event: `grep settingNote *test*.js` was empty, so no existing suite was reading note
text.)

**Layout, as Aj specified it:** the `?` sits **directly after the option name**, and the player-count chip moves
to **its own line** beneath. My first attempt put the `?` after the chip, because straight after the name it
landed mid-sentence on wrapped labels and shoved the chip onto a second line — and Aj's answer dissolves that
instead of working around it: if the chip is on its own line by design, nothing gets shoved. `.settingBody` is
already a column flex, so the chip only had to become a sibling of the label rather than a child.

Suites: `rulestest` 79 → **89**, `nettest_rules` 27 → **28**.

### v1.31.34 — the Tiến lên preset

The second preset, and the one `chopKits` was always for — Aj put 3 Kits-as-a-chopper here rather than in
Chikicha Specials on purpose. Tiến lên's bombs are **đôi thông** (three or more consecutive pairs) and **tứ quý**
(four of a kind), and both chop the *heo*, which in this game is the apex 2. So the preset is exactly:
`kits3, quadro, chopQuadro, chopKits`.

**Deliberately left out:** the four-card double-pair slot, because the family's floor is *three* consecutive
pairs — a 2-kit is not one of its shapes and poker's two pair certainly is not — and the straight-flush chop,
which belongs to Big Two rather than Tiến lên.

That last point is what the new assertions are really for: **switching presets REPLACES the rule set rather than
adding to it.** Coming from Chikicha Specials, Tiến lên has to turn the four-card slot back *off*, which is only
true because a preset is an exact state (v1.31.30). Its active marker moves too, and two presets can never both
read active.

One test-shape fix in passing: the bulk-row assertions indexed `[1]` for Clear all, which a second preset
shifted. They look it up by `id` now — an added preset should not be able to break an unrelated assertion.

Suites: `rulestest` 75 → **79**.

### v1.31.33 — the chop: big shapes beat the 2

The first rule where a shape beats one it **does not match**, and the reason the family's big shapes exist at
all. In Tiến lên a tứ quý or ba đôi thông *chops* the heo — and in this game the heo is the apex 2. So the chop
is what makes the 2 answerable, and what finally gives Quadro a job.

**A chop ticks its own shape on** (Aj: *"1st one should probably auto check the quadros option"*). The engine
already treated a chopper's shape as enabled — `quadroOn()` is `QUADRO || CHOP_Q` — so an unticked Quadro box
beside a ticked "Quadro chops" box was telling the player something **false** about the game they were about to
play. `needs` makes it a real dependency, and it holds in **both** directions: unticking the shape takes its chop
with it, or the panel simply lies the other way round. The Straight Flush chop needs no shape row, being the only
way that shape exists at all.

**Three independent toggles, not one rule and not a mode.** The first pass made it a single boolean, then a
mode row like the four-card slot — both wrong, and Aj caught each: *"we can't actually do it like Four-card
double pairs huh? because we can check just quadro, or all the chops"*, and *"since it functions like a normal
toggle, we can drop the OFF"*. The distinction is **ambiguity**: `4♦4♥5♣5♠` really is both a 2-kit and a poker
two-pair, so that slot has to pick one. A Quadro, a 3-Kit and a same-suit straight are three distinguishable
patterns — nothing forces a choice, so nothing should impose one. Each toggle also **enables its own shape**, so
a chopper you cannot actually play is impossible.

**THE `straightflush` TYPE IS DELETED, and that was the real prize** (Aj: *"i think it's better to remove that
dead code then… i want them to only be detected as bombs and not as a mixed shape for straights and flushes
that beats both. i made a mistake on that one, and it seems i'm still paying for it in technical debt"*). Since
v1.14 a same-suit run has scored as a plain straight, which made the `beats()` clause granting a straight flush
priority over any straight **unreachable dead code** — and I had misread it as live. It is gone, along with the
type, the `NO_STRAIGHT_FLUSH` gate and the orphaned `TYPE` label. A same-suit run is an ordinary straight,
compared by value; being one suit now matters **only** to `chopRank`.
That deletion **halved the mono-suit tilt**: pure decks +0.9 / mixed −0.6 across three interleaved replicates,
down from +1.8 / −1.2 when the type existed. Half the effect was the dead clause waking up; the residue is the
chop's own — single-suit decks assemble the shape more easily — and cannot be removed without removing the
option.

**NO CHOPPER BEATS ANOTHER** (Aj: *"ordering is hard really… let's not make them beat each other for now?"*).
Every chop ranks the same, and a chop is answered **in kind** — its own shape at a higher value, through the
ordinary comparison. Three reasons, in order of weight:
- **[pagat](https://www.pagat.com/climbing/thirteen.html) puts them at the same tier**: three consecutive pairs
  *or* a four of a kind beats a lone 2, with no ranking between them. Secondary sources rank quads higher; others
  drop bomb hierarchy entirely. It is a house call, not a fact to look up — which is exactly why not picking one
  is the honest default.
- **The scarcity argument does not survive measurement.** Of 10-card hands a Quadro appears in **1.1%** and a
  3-Kit in **1.3–1.6%** — the 3-Kit is if anything *more* available. (Play counts implied the opposite by a
  factor of 125, but that was the AI's cheapest-first policy, not availability. Nearly argued from it.)
- **A 3-Kit costs six cards for what a Quadro does with four**, so ranking the Quadro above it made the dearer
  play strictly worse.

**Reach is uniform too:** a lone 2 or a pair of them, for every chopper. The "4+ Kits reach a trio" tier went
with the ladder, and it was decoration regardless — an eight-card consecutive run appears in **0.0–0.1%** of
hands.

**The ladder that was.** 3 Kits and Quadro are both chops in the family — ba đôi thông and tứ quý — and
[pagat](https://www.pagat.com/climbing/thirteen.html) is explicit that either "can beat a single two (but not
any other single card)", with a **pair** of twos needing *five* consecutive pairs and a trio needing *seven*.
**Our reach table is deliberately more generous than that, and it has to be:** five consecutive pairs is ten
cards — the entire maximum hand — and seven is fourteen, which is impossible here. Measured on the shipped
ladder, **0 of 88 chops at six players were against a lone 2**; essentially all were against a pair of 2s. A
faithful ladder would therefore make the chop almost never fire. The finer ordering (does a quad outrank three
pairs?) varies by house anyway, so both the rank order and the reach below are **our** choice:

| | rank | reaches |
| --- | --- | --- |
| 3 Kits (size 6) | 30 | a lone 2 or a pair of them |
| **Quadro** (size 4) | 35 | the same |
| **Five in a row, one suit** | 37 | the same — and it outranks a Quadro, per Big Two |
| 4 Kits (size 8) | 40 | a trio of 2s too — and everything above |
| 5 Kits (size 10) | 50 | the same, and 4 Kits |

A bigger chop answers a smaller one. **Equal rank falls through to the ordinary same-shape/higher-value
comparison**, so a Quadro is chopped by a higher Quadro and 3 Kits by higher 3 Kits — for free, with no new code
(Aj: *"you can actually chop another chop… if you followed the shape and played a value higher"* — that already
works). There was precedent for the cross-shape override sitting right there in `beats()`: a straight flush
already beat a plain straight.

**The chop and "the 2 cannot be beaten" COMPOSE** (Aj: *"a chop would deal with inf 2s btw"*). I had built them
to conflict, with `apexInf` winning — wrong, and the mechanism says why: `apexInf` makes the 2 unbeatable **by
value** (it ranks the card at Infinity), and a chop is not a value answer at all, it is a **shape** answer. So
the chop is precisely the counterplay to an unbeatable 2 — which is what makes `inf` playable without `nostrip`.
Both rows' copy was rewritten to say so, and there is deliberately **no** `APEX_INF` guard in the chop branch.

**Measured — and this is the rule that finally makes Quadro worth playing.** 250 games per cell, same seeds:

| | Quadros played | 3 Kits | 4 Kits | 2-plays chopped | rounds/game |
| --- | --- | --- | --- | --- | --- |
| 6p, shapes only | 17 | 2149 | 528 | 0% | 28.5 |
| 6p, shapes + chop | **956** | 1611 | 902 | **14%** | 28.2 |
| 4p, shapes only | 23 | 365 | 74 | 0% | 18.6 |
| 4p, shapes + chop | **88** | 350 | 109 | **7%** | 18.7 |
| 2p, shapes + chop | 7 | 34 | 1 | ~0% (2 of 498) | 10.9 |

Quadro goes from near-decorative (v1.31.29 measured 0.07 plays/game) to **956 plays in 250 six-player games**,
because it finally answers something. 14% of all 2-plays get chopped at six players. **At two players the chop
is nearly inert** — holding a Quadro or 3 Kits at the moment you face a lone 2 almost never happens in a duel —
so in effect it is a multiplayer rule, though it is correctly tagged as changing all player counts.

**Pacing and initiative do not move** (`rulesim` rows T/U vs A: medians 11/15/20/31, leader share 56/48/39/35,
all within noise). **Fourth shape-rule in a row to say so.** Note the backlog hoped the chop would loosen
initiative concentration by making the apex answerable; it does answer it, and the aggregate number does not
budge.

**My own probe lied first, and the control caught it.** The chop counter matched "a big shape played after a
2-play", which also matches the *lead of the next round* — so it reported chops in the arm where the chop was
**off**. Fixed by reading `g.pile.combo` before the turn, after which the off arm reads a clean 0. **An arm that
should read zero is the cheapest instrument check there is** — same lesson as the identical-A/B and the `flag()`
substring bug.

The chop joins **Chikicha Specials** (Aj: *"the chop would also be checked in chikicha specials"*), which fixes
the preset offering Quadro without the thing that gives it a job.

**And a process note: this entry nearly did not exist.** The script that wrote it asserted on a stale anchor and
threw *before* its write, and I read a confirmation that had not printed. `versiontest` now asserts that
`docs/NEXT-SESSION.md` carries a `### vX.Y.Z` heading for the version in `README.md`, so a missing changelog
fails the gate instead of shipping quietly.

Suites: `test` 263 → **276**, `rulestest` 65, `versiontest` 14 → **15**.

### v1.31.32 — the game mode is a rule now, and online play finally honours it

Aj: *"move this choice to the custom rules. full game is of course the default."* The **Full game / Basics**
segmented control leaves the New Duel dialog and becomes the **first** row of ⚗️ Custom rules — a mode row whose
first value is `full`, so it is "off" by the panel's own definition and a Basics game reads as customised, which
it is.

**It closed a real bug on the way in.** `hostStartRealN` hardcoded `gameBasics=false`, with a comment saying
online is always the Full game — so picking Basics was **silently ignored in every online game**. As a rule it
travels with `rulesKey()` like everything else, so the host's mode is now the table's mode. `nettest_rules`
asserts it on **both** seats, because a host-only Basics game and a client-only one are each a table playing two
different games.

**Basics stays visible from the New Duel screen.** Moving the control there and nothing else would have buried
the beginner ramp behind a menu called *Custom rules* — the mode a new player most needs is the one they would
never find. The hint line under the title now reads the current mode and names where to change it
("Basics — no transforms… **Change it in ⚗️ Custom rules**"), and `rulestest` asserts both halves plus the
absence of the old control.

**One row is not homebrew, and the copy says so.** Basics is the supported way to learn, so its note explains
the mode rather than leaning on the panel's framing, and the intro softened to "**Mostly** not the default…".

**The intro stopped counting rows.** It said "the first four … the last three", then four, then five — it went
stale on every added rule and shipped wrong twice. It now points at the per-row scope tags, which are asserted
directly beneath, so the two cannot disagree.

Migration: a saved `sel.mode==='basics'` is folded into the rules once and dropped from the stored selection, so
a player mid-Basics is not silently moved to the Full game. The tutorial overrides the **runtime** flag only and
deliberately never touches `RULES` — a lesson choosing Basics for you must not rewrite the mode you picked for
your own games.

Suites: `rulestest` 58 → **63**, `nettest_rules` 21 → **27**.

### v1.31.31 — the suggestion layer: everyone suggests, the host decides

Aj's idea, and his own sequence, confirmed: *"they can 'suggest' a rule, it is sent to the host as a suggestion
and then it is broadcast to the rest of the table."* That is the emote path — client intent, host authority,
host broadcast — and both of his answers on scope are in: **the host's picks are the rules** (no self-suggestion
row), and **the whole table can see each other's suggestions**.

A client's lobby panel is no longer read-only. Its controls now edit **its own picks**, each row shows what is
actually in play when that differs, and every row carries a chip naming who wants what.

**The implementation problem was one object.** There was exactly one `RULES`, and joining overwrites it with the
host's key — so a suggestion kept there is clobbered by the host's next edit, or worse, read as the rules in
play. Now:

| | what it is | who writes it |
| --- | --- | --- |
| `RULES` | the rules **in play** | your own edits when you set the rules; the host's key when you are a client |
| `MY_RULES` | **this device's** picks | you, always — never touched by an incoming host key |

`localStorage` holds `MY_RULES`, which is what it always effectively was. When you *are* the one setting the
rules, your picks are the rules, so the panel writes both (`ownRules()`). One `commit()` in the panel decides
which, so the suggest and edit paths cannot drift apart.

**A suggestion is STATE, where an emote is an EVENT** — two consequences, both asserted:
- the host broadcasts the **whole map**, not a delta, so a dropped message and a late joiner both self-heal, and
  `t:'welcome'` carries it for free (the third seat in `nettest_suggest` reads a suggestion made before it
  arrived);
- the rate limit **coalesces** (250ms) instead of dropping. Dropping is right for an event; for state it would
  strand the table on a stale value while the sender's own panel shows something newer. The suite fires five
  suggestions back to back and asserts the host lands on the **last**, not an earlier one.

**Three bugs found by building it, every one of which looked fine in the code:**
1. **Client intents are dead in the lobby.** `hostApplyMove`/`hostApplyMoveN` both return immediately when
   there is no `hostState` — i.e. for the entire lobby, which is the only place a suggestion matters. The
   handlers were in exactly the right-looking place and did nothing; the suggestions that appeared were arriving
   by accident on the **join retry**, which re-sends every 350ms. Dispatch now happens in the `t:'move'`
   handler, ahead of that gate.
2. **`isClientActive()` is `isClient() && started`,** so the send guard was false for the whole lobby too. A
   suggestion needs a client that is *connected*, not one mid-game.
3. **The join retry re-asserted the client's stored preference on a timer,** wiping any suggestion made since —
   a change would appear on the host and vanish within 350ms. The host now takes `sug` only when the seat is
   **new**: a retry is a re-announcement of the same join, not a fresh statement of preference.

**The host validates.** An untrusted client's key goes through the same parser a saved key does, and unknown
rule names and invalid mode values are **dropped** — `keyOf(rulesFromKey(k))` round-trips it clean. A rule from
a newer peer must never be advertised in the panel; that is what the version handshake is for. Asserted with a
key containing `notARule` and `dblPair=banana`.

**A suggestion never un-readies the table.** Only the host's real change does. If it did, one player idly
flipping switches could stop the table from ever starting.

`nettest_rules` changed shape with the feature: it used to assert the client's controls were *dead*, which was
only ever the mechanism. It now asserts the **invariant** — a toggle, a mode, even a whole preset in a client's
panel moves nothing about the rules in play.

New suite `nettest_suggest.js` (**30**), three pages. `nettest_rules` 22 → 21 (two mechanism assertions became
one invariant). Full serial sweep green.

### v1.31.30 — rule presets and Clear all

Nine toggles is enough that setting them one at a time is a chore, so the panel gains a bulk row above the list:
**Chikicha Specials** and **Clear all**.

**A preset is an EXACT state, not an additive one.** Aj named Chikicha Specials as *"kits + quadro and nothing
else"*, so applying it turns everything else **off** as well. That is what lets a preset button read as
**active**: "these are exactly the rules" is a claim you can check, where "at least these" is not. `rulestest`
applies it over a table with all nine rules on, which is the case that would catch an additive implementation.

**The name is "Chikicha Specials", not "Raw Chikicha"** (Aj, 2026-08-27). "Raw" would claim the table is
playing Chikicha, and it is not — this game has a whole layer of card effects that game never had. What the
preset actually turns on is Chikicha's **special shapes**, so that is what it is named after. Worth keeping
straight: a preset names a set of rules, and overclaiming what it is would mislead the person picking it.

**Only one preset ships, and that is deliberate.** Dou Dizhu needs trio+single, four+two and the airplane
first; offering it now would name a rule set this build cannot actually play. More arrive as their shapes do.

**Presets do not serialise.** They only set `RULES`, so `rulesKey()` carries the resulting rules exactly as a
hand-toggled set would (`dblPair=kits,kits3,quadro`) — netplay and the export are untouched, and the other end
never has to recognise a preset's name.

**The bug this surfaced, before it shipped: the bulk row is derived state.** The rows patch themselves in place
rather than re-rendering, so a preset button stayed lit after one further toggle — a lie about what is in play —
and Clear all stayed greyed out after the first rule went on. One `syncBulk()` called from both row handlers
fixes both; a bulk *action* re-opens the panel outright, since nine rows move at once and the per-row handlers
only know how to update themselves. Both symptoms were caught by assertions, not by looking.

Read-only mode disables the bulk buttons too — asserted in `rulestest` (mid-game) and `nettest_rules` (the
client), because a client applying a preset locally is two people playing different games. That is the v1.31.26
lesson applied to a new control shape on purpose rather than after the fact.

**Also fixed: `exporttest` was deal-dependent** (1 failure in 6, reproduced). It played to a fixed four rounds
and then asserted that *both* opponents had recorded fights — but an opponent that passes through those rounds,
or is eliminated in them, records none. Its loop now exits on the condition the assertions need, with the round
cap kept as a safety valve so a pathological game fails loudly instead of spinning. 8/8 after.

Suites: `rulestest` 45 → **58**, `nettest_rules` 21 → **22**.

### v1.31.29 — Quadro, the ninth homebrew rule (and it is nearly decorative without the chop)

Four of a kind, as a **plain shape**: it beats a lower Quadro and nothing else. Default off, for the reason Aj
gave when filing it — *"new players will just break"* — which is a cognitive-load argument, not a balance one.

**It shares the four-card slot with the double-pair modes and cannot collide with them.** Four cards of one
value can never be two pairs or a kit, both of which need two distinct values, so the check sits ahead of the
double-pair block (which returns early for anything that is not two pairs). Asserted in all three modes.

**Quadro is deck-neutral, which is the opposite of the intuition.** "Four of a kind needs four suits" would
make it a Full-Set-only shape — but a class deck is four **copies** of one suit's thirteen cards, so *every*
deck holds exactly four of each value and every deck can make a Quadro at the same rate. Those copies carry
distinct ids (`7D#26`), so the UI can select four of them. Both facts are now asserted, because a change to deck
building would otherwise kill the shape silently.

**Measured, and the honest reading is that it is close to decorative right now.** 200 games per cell, same
seeds:

| | legal on … of turns | Quadros played per game | rounds/game (off → on) | jab share |
| --- | --- | --- | --- | --- |
| 2p | 0.4% | 0.04 | 10.8 → 10.8 | 28% → 28% |
| 4p | 1.7% | 0.04 | 18.4 → 18.4 | 11% → 11% |
| 6p | 3.9% | 0.07 | 28.3 → 28.1 | 7% → 7% |

So it is **offered** regularly at a big table and almost never **taken**. The mechanism is straightforward: the
AI plays the cheapest sufficient Special, and a Quadro spends four cards to win a round a pair would have won.
Reasoning rather than measurement, but it follows from the rules: a Quadro can only be answered by a *higher*
Quadro, which makes leading one a near-unbeatable grab for initiative — a use the AI's cheapest-first policy
never values and a human very well might. **Its real power arrives with the chop**, which is what makes a Quadro
beat shapes it does not match; that stays a separate rule and a separate PR.

Pacing does not move, at any player count (`rulesim` row S vs row A). **Third shape in a row to say so** — kits,
poker two-pair, and now Quadro. Treat "a new shape adds options, not tempo" as the default expectation.

**Fixed in passing: a poker two-pair was labelled "Special".** `TYPE` had no `twopair` entry, so `comboName`
fell through to its generic name for every two-pair played since v1.31.26. `twopair` → "Two Pair" and `quadro` →
"Quadro" now.

Panel copy follows: nine rules, "the first four only change 3–6 player games; the last five change duels too".
Suites: `test` 252 → **263**, `rulestest` 43 → **45**, `mpsim` gains a behavioural `quadro` self-check.

### v1.31.28 — the deck picker stops recommending the Full Set

Aj, on the lobby's deck dropdown: move Full Set to the bottom, make Random the default, and *"make it just a
little bit hard to random into full set"*. Three separate things, and the middle one turned out to be two bugs.

**Order.** Full Set was the *second* option in every picker — the first thing a thumb lands on. It now sits
**last of the decks**, below the ten classes and any saved decks, with only the ✏️ Custom deck… action after it
(that stays last because it is an action, not a deck). 🎲 Random leads, since it is the default.

**Default.** The setup dialog already defaulted to Random. The **netplay lobby did not**: `myDeck` was
initialised to `'full'`, and `boot()` — the `?net=` path, which is what every shared invite and every test suite
uses — hardcoded `deck: q.get('deck') || 'full'`. So most online games were played with all 52 cards without
anybody choosing that. Both default to Random now, as do the host's fallbacks for a seat that never picked.

**Odds — and the answer was "leave it".** Random turned out to be *unable* to reach the Full Set at all:
`resolveDeck` picks from `E.DECK_ORDER`, which holds only the ten class decks. Offered a 1-in-20 chance, Aj's
call was **"impossible is fine actually"** — so the behaviour is unchanged and now deliberate, documented, and
asserted. The reasoning is clean: 🎲 Random means *surprise me with a class*, and the 52-card set is the absence
of a class, so it is something you choose on purpose from the bottom of the list.

Tests: `decktest` 35 → **42** (order, the default on a *fresh* store — a saved pick must still win — and 20,000
rolls asserting the Full Set never comes out, every one of the ten classes does, and nothing else ever does:
no saved deck, no builder sentinel). `nettest_customdeck` 14 → **18**, asserting the lobby default and the
ordering on **both** render paths, host and client. `__solo.resolveDeck` is the new URL-gated hook that makes
the roll testable at all. Full serial sweep green.

### v1.31.27 — the suites could be green and blind: three shapes of it, fixed

v1.31.26 found two suites passing a control they never actually tested. That was worth a sweep of the other 30,
looking for the same class of thing rather than the same instance. It found three shapes, all real:

**1. Assertions that cannot fail.** `nettest_emote` had `ok(await waitLog(...) || true, 'duel started')` —
unfailable by construction — and `nettest_actloop` had `ok(true, offered ? … : …)`, a branch report wearing an
assertion's clothes. The actloop one is now the invariant that holds **either way**: after declining, the host
must have no response window left open. A stuck overlay wedges play, which is the exact failure that suite
exists to catch.

**2. A negative asserted after a fixed wait fails silently.** `nettest_emote`'s cooldown check fired three
emotes immediately after the previous emote, still inside its 1.2s window — so the client's own gate dropped all
three and `added<=1` passed on **added = 0**. It would have passed with the cooldown deleted and the wire dead.
It now waits the window out first and asserts `added === 1`: one gets through, the other two do not. Both
directions, or the test proves nothing.

That fix exposed a real coverage gap next to it. `sendEmote`'s cooldown is a **courtesy** — a client controls its
own clock — and `hostEmote`'s per-seat check is the one that matters, but driving the UI only ever exercises the
courtesy copy. `?dbg=1` now exposes **`__cmf.clientSend(msg)`**, which sends a raw client intent, so the suite
can bypass the client's gate the same way a modified or laggy client does. The host holds: three intents down
the wire, one line logged.

**3. A poll whose result is discarded.** 40-odd `waitFor`/`until` calls are staging steps, so a poll that gave up
was invisible — and surfaced later as an unrelated assertion failing on a board still mid-round-trip. That is
the v1.31.9 `waitTurnEnds` bug in its general form. All **27** helpers now print
`⏱ poll TIMED OUT: <condition source>` when they give up, naming the condition that never came true. And two
suites asserted the *other* peer's state after a fixed wait — `nettest_rtc` (1000ms, then the host's settled
stack) and `nettest_energy` (700ms, then the client's mirror) — both now poll. A slow machine must make a suite
slower, never red.

**Also: `passsim`'s rule flag was positional.** `drawplayers` was read from `process.argv[7]`, the sixth
positional slot, so setting it meant getting five earlier args right and a typo silently ran the default — the
PATCHNOTES 0j trap, and the same family as v1.31.26's substring-matching `flag()`. It is a named, whole-token
flag now, valid in any position and **stripped before the positional slots are read** (otherwise it lands in
`THRESH`'s slot and `parseInt` yields NaN, which the run then reports as its own config). It prints a `CONFIG:`
line like `mpsim`.

Every suite re-run serially and green. Counts that moved: `nettest_emote` 16 → **19**.

### v1.31.26 — the double-pair slot splits into a mode: 2 Kits or Poker

v1.31.24 shipped kits as one boolean meaning "runs of consecutive pairs, any length". Aj asked for the family's
shapes **separately** — 2 kits, 3 kits, and non-consecutive two pair — so the seventh toggle becomes two rules:

| Rule | Shape | Type |
| --- | --- | --- |
| **Four-card double pairs** — `Off` / `2 Kits` / `Poker` | consecutive `4♦4♥5♣5♠`, or any two pairs `4♦4♥9♣9♠` | `kit` / `twopair` |
| **3 Kits and up** | three or more pairs of consecutive values | `kit` |

**The four-card slot had to be a MODE rather than two checkboxes.** Poker's two pair allows gaps, so it is a
strict superset of a 2-kit at the same size: as independent flags they could never beat each other, and
`4♦4♥5♣5♠` would satisfy both with no way to say which shape it is. One segmented row — Aj's own UI answer —
makes exactly one classification live at a time and the ambiguity cannot arise. `3 Kits` stays an independent
boolean because a 3-kit is size 6 and never collides with the 4-card slot; **mode `Off` + `3 Kits` on is the
family's original form** (连对 / đôi thông, runs of three or more only), now playable on its own.

A two-pair is keyed `[highPair, lowPair]`, so `lexCmp` compares the top pair before the bottom for free —
6s+4s beats 6s+3s. As always `beats()` gives the length rule at no cost, since it already required equal `type`
and equal `size`.

**A POKER TWO-PAIR IS A PAIR SINK — that is its whole footprint.** Measured at 2 players over 300 games, same
seeds in every arm:

| | pairs played | two-pairs / kits | singles played | jab share |
| --- | --- | --- | --- | --- |
| Off (live) | 2529 | — | 1299 | 28% |
| 2 Kits | 2237 | 240 | 1398 | 31% |
| Poker | **1681** | **843** | **1788** | **34%** |

Pairs fall by 848 while 843 two-pairs appear — one two-pair per two pairs consumed — and what is left in hand is
odd singles, so jab-led rounds go up. Kits barely do it (240 plays) because gaps are refused. **Pacing does not
move in any configuration**: medians land within ±1 of the LIVE baseline at 2/3/4/6 players (`rulesim` rows N–R,
which are seed-identical and so act as each other's controls). Same "a new shape adds options, not tempo"
result as kits, reached by a different mechanism.

**Migration is handled.** `setKits()` is gone; a saved `kits` key from v1.31.24 — in localStorage, or arriving
from an older peer — maps to `dblPair=kits,kits3` rather than silently reverting to off. `dblPair=poker` is also
the first rule whose serialised form carries a **value**, so the netplay and export key now contains an `=`;
`nettest_rules` propagates a mode specifically, because a client falling back to `'off'` would look identical to
a host who never touched it.

**Two suites were passing a control they never actually tested.** A mode row is a `<div>` wrapping three
`<button>`s (nesting buttons is invalid HTML), so `disabled` lands on the *segments*. `rulestest` and
`nettest_rules` both asserted only `row.disabled`, which a `<div>` never has — so both would have passed a panel
whose segments were still live: a mid-game rules edit, and a netplay client able to change the mode locally,
which means two people playing different games. Both now check the segments, and `rulestest` additionally
asserts that clicking a read-only segment changes nothing in the engine, rather than merely looking greyed out.

**And `mpsim`'s flag parser was matching substrings.** `FLAGS` is the joined argument string and `flag(name)`
was `FLAGS.indexOf(name) >= 0`, so `flag('kits')` matched inside `kits3`: asking for `kits3` alone silently
switched the 2-kit slot on too, making both arms of that comparison the same configuration. Whole-token match
now. It was caught by the behavioural self-check — which counts how many 4-card plays are actually offered from
`4♦4♥5♣5♠` — and would **not** have been caught by an assertion that read the parsed flag back, since that
agrees with the broken parser.

Panel copy follows: eight rules now, "the first four only change 3–6 player games; the last four change duels
too". Suites: `test` 252, `rulestest` 43, `nettest_rules` 21.

### v1.31.25 — the Custom rules panel was invisible in a netplay lobby

Aj, from a host lobby: *"clicking the custom rules doesn't bring up the custom rules modal"*. It was bringing it
up. `.overlay` sat at **z-index 30** while `#netroot` sits at **99999**, so in any netplay lobby the panel opened
correctly, populated correctly, and rendered entirely **behind** the lobby. The overlay is now above netroot,
where a modal belongs.

**Why every test passed.** `nettest_rules` clicked the button and asserted the panel's *DOM* — the rows, their
disabled state, the host/client difference. All of that was true. **DOM presence is not visibility, and no DOM
assertion can see a stacking bug.** The suite now hit-tests the centre of the viewport
(`document.elementFromPoint`) and asserts the modal is what is actually there, for both seats. Verified against
the failure: on the unfixed build those two assertions fail (18/2); fixed, 20/0.

This only ever bit while netroot was on screen — a lobby or signalling screen. Mid-game the netplay board hides
netroot, so response windows and every other modal were fine, which is why it survived since v1.31.22.

### v1.31.24 — kits, as the seventh homebrew toggle

A player asked for them from memory of having played with them — the strongest argument a homebrew rule can
have. A **run of consecutive pairs**: a pair of 4s with a pair of 5s is **2 Kits**, add a pair of 6s for
**3 Kits** — deliberately not "2 Pair", because poker's two pair allows gaps and so names a different shape. Only a higher run of the *same length* beats it, which `beats()` gave for free since it already
required equal type and equal size.

Floor of **two** pairs rather than the family's three (连对, đôi thông), because those games deal 17-20 cards and
this one deals 6 and caps at 10 — a three-pair floor would have made the shape dead on arrival. Values must be
**consecutive**, unlike poker's "two pair", and the panel copy says so.

**Measured before believing anything about it (PATCHNOTES 0o):**
- **Pacing: no effect at all** (11/14/20/31 against 11/14/20/30). I had predicted shorter games, on the grounds
  that a kit is a Special and so should break more shields. Wrong: a kit **replaces** a Special the player would
  have made anyway, and a round still has one winner and one strip. **A new shape adds options, not tempo** —
  which is 0a from another angle.
- **It is not rare enough to be decorative:** 0.75 kits per duel, 13.4 per 6-player game, legal on 4.7-13.8% of
  turns and played on about half of those.
- **Balance: neutral** — 6p spread 12.1 → 13.5 (inside noise), Spearman rho **0.91**. The deck-neutrality
  argument held: every deck is 4 parts × 13 ranks, so all hold 4 copies of each rank value.
- **What they are for:** a lead-side outlet for low cards. A kit cannot answer a pair, so it does *not* touch the
  measured VALUE-stuck problem. Judge on feel and hand-churn.

Internal type is `kit`, and the label is "N Kits".

### v1.31.23 — the apex-2 rules join the menu, as two independent toggles

Measured first (PATCHNOTES 0m), then added — Aj: *"let's run the numbers correctly first before adding it in"*,
and then *"i think we can move forward with adding inf and nostrip."*

| Toggle | Flag | What the measurement said |
| --- | --- | --- |
| The 2 cannot be beaten — not even by a boost | `setApexInfinity` | Pacing-free; widens the duel spread; drops the apex contest rate from ~28% to 1% |
| Fights won with a 2 destroy no shields | `setApexNoStrip` | Tightens the duel spread; keeps the contest rate; makes 6p games ~70% longer |

**They are independent, which they were not before.** The engine used to require `APEX_INF && APEX_NOSTRIP`, so
the standalone no-strip flag was a silent no-op — and that is the variant Aj argued for and the numbers favour: a
2 that deals no damage **but can still be beaten** is a *contestable* tempo play, where the unbeatable version
ends the round outright and nothing can answer it.

**These are the first toggles that change a DUEL, so the panel's copy had to change.** It used to say *"These
change 3–6 player games; a duel plays the same either way"* — true of the original four, false the moment these
landed. It now reads *"The first four only change 3–6 player games; the last two change duels too"*, and every
row carries its own scope tag (`3–6 PLAYERS` / `ALL PLAYER COUNTS`) so nobody has to count. `rulestest` asserts
both the sentence and the tags, which is what will catch the copy next time the set changes.

Costs are stated on each row **qualitatively** — "makes 6-player games much longer" rather than a table of win
rates, following the same call as the Rival warning: measurements belong in PATCHNOTES, not in a player's face.

Still every default OFF, still serialised self-describingly, still stamped into the export.

### v1.31.22 — custom rules, and the export finally records which rules you played

Aj's idea: *"it's not the default or intended way to play the game, but it certainly is A way to play the game."*
Mostly **surfacing** rather than building — the engine already had every one of these behind a setter — which is
why the risk lived entirely in the wiring, and two wiring bugs turned up before this shipped.

**Four toggles, and every default is OFF.** That is deliberate: it makes "is this game customised?" a plain
`.some()` instead of a comparison against a defaults map, and it is why the draw toggle is phrased as the
NEGATIVE of the shipped rule (*"Draw does not scale with the table"*), since draw-scaling ships on.

| Toggle | Flag |
| --- | --- |
| Special fights destroy a shield for each rival | `setSpecialLossMode('all')` |
| All round losers send cards to their Energy Pile | `setMillScope('universal')` |
| Shields scale with the table (2 + players) | `setShieldsPerPlayer(true)` |
| Draw does not scale with the table | `setDrawPerPlayer(false)` |

**The panel admits it is multiplayer-only**, because checking that claim turned out to make it true of all four:
the engine's own comment marks the first two as no-ops at 2 players, `startShieldsFor(2)` is 2+2=4 (the flat
default), and `drawCountFor` at 2 players is `max(2,2)`=2 (also the default). A duel plays identically with every
box ticked, so the panel says so rather than letting someone wonder. **Kits and the apex pair would be the first
duel-relevant rules.**

**One panel, three entry points, one rule about editability** — setup dialog and the host's netplay lobby are
editable; ⚙️ Settings opens the same panel **read-only while a game is live**. That last one is the point of
having it in Settings at all (Aj: *"if something weird happens, i can check why my game is not behaving in the
ruleset i'm expecting"*) while making a mid-duel edit impossible, since it would be either silently ignored or
incoherent.

**A rules change un-readies the table** (Aj: *"yes, un-ready that. so we can ping them again"*). Readiness is
stamped with the rules generation it was given under, and a seat counts as ready only while its stamp is
current. Seat/channel bindings are untouched — un-readying is not a disconnect.

**Two wiring bugs caught before shipping, both of which would have been quiet:**
- `hostStartRealN` **hardcoded `setSpecialLossMode('chosen'); setMillScope('targeted')`**, so every online game
  would have silently ignored the menu — and inconsistently, since it never touched shields or draw. It calls
  `applyRules()` now.
- A first pass replaced `nextSeat-1` with a readiness count **everywhere**, including the start path that
  indexes seats `1..joined` — which would have mis-assigned decks when a stale seat sat before a ready one.
  Readiness gates the Start *button*; it does not renumber seats.

**The export records the rule set (`v:'2.1-mp'`), and that shipped WITH the menu, not after.** An unstamped
homebrew game makes PLAYER-PROFILE.md's ingestion log unreadable — a weird statistic becomes indistinguishable
from a weird ruleset — and it cannot be repaired later because the information was never written down. Exactly
the pre-v1.31.5 mistake. `exporttest` and `nettest_record` were updated for the bump; `exporttest` gained an
assertion for the new field.

**The warning names no decks** (Aj: *"no need to say which ones haha"*). It says the Rival will not adapt and
that some decks suit these rules much better than others, and stops there — the measured figures (Pure Wizard
44% against Pure Rogue 1.7% under `loss=all` at six players) belong in PATCHNOTES, not in a player's face where
they also pre-judge a deck before anyone has tried it.

Also added `E.isSpecialLossMode()` / `E.isMillScope()`, for symmetry with the other rule flags — a rules menu
needs its effect on the engine to be assertable rather than inferred from gameplay.

### v1.31.21 — netplay tells you when the two builds differ

Netplay had **no protocol negotiation at all**: two different builds connected happily and then simply
misbehaved, with nothing on screen to say why. Not hypothetical — a stale downloaded copy already produced one
false bug report ("the client has no name field", from a build two versions old), and it took a headless run at
the reporter's exact viewport to prove the code was fine.

The client now sends its version with `t:'join'` and the host sends its own back on `t:'welcome'`, so **both
seats know within a moment of connecting**. A mismatch shows a banner in the lobby naming both builds, written
from each reader's own side ("you are on X, they are on Y"), and is logged so it survives leaving the lobby.

**It warns; it does not refuse.** A patch-level difference is usually harmless, and locking two friends out of a
game over one would be a worse failure than the mismatch itself. `nettest_version.js` asserts both halves — that
a mismatch is reported on **both** seats with both version numbers, and that matched builds say **nothing at
all**, because a warning that cried wolf would be worse than none.

**This was the prerequisite for the homebrew rules menu.** A peer silently ignoring an unknown rule means two
people playing different games without knowing it, which is worse than having no menu.

Testable because `?ver=` overrides the reported version — dbg-gated, inert in the shipped game.

### v1.31.20 — the host could be locked out of a round it just won

**This was a real netplay bug, and it had been hiding as a flaky test for months.**

In a duel, when the **client's** move ends a round that the **host** wins, the host's board stayed locked: its
own turn, an empty pile, an inert hand, and `rivalStatus` still reading "Waiting for opponent…". Not slow —
*permanently* dead. A real player would simply watch the game stop.

The path is `hostAfterRivalMove → hostFinishRound → resolveRoundCeremony → afterHumanAction`, and
`afterHumanAction` is `if(state.turn!==YOU) driveRival(); else render();` — it never clears `busy`, which
`awaitRival()` set to true when the host handed the turn over. **`driveN` does exactly this clear for 3-6
players; the duel path was missing it.** One line, and the duel was unfinishable whenever the configuration
came up.

**Why it read as an environment flake for so long.** It only fires when the round ends on the *client's* action
AND the host wins — which depends on the deal and the play order, so it looked random. Load never caused it; it
only changed how often that configuration arose. `nettest_full` was reporting a genuine defect every time.

**Aj had hit this in real play and put it down to a laggy connection** (2026-08-26: *"oh fudge! i had that bug!
i thought it was just a laggy connection"*). That is the important part of this story. **It presents as lag from
either seat**: the frozen host stops broadcasting, so the client sits on "Rival is fighting…" indefinitely and
reads it as an opponent who has dropped, while the host sees its own board die and reads it as a disconnect.
Nothing about the symptom suggests the game locked *itself*. So the bug fooled a player and a test harness in
exactly the same way, and both of us blamed the network. **When netplay "lags", check for a stuck `busy` before
believing the transport** — the connection was fine every time.

(The client cannot get permanently stuck this way on its own: `applyMirrorNow` recomputes `busy` from every
mirror it receives, so it self-heals as soon as the host broadcasts again. Only the host could wedge.)

**`nettest_roundstall.js` (new, 9 assertions) reproduces it deterministically** by staging the host with the
apex 2 — unbeatable, so the client *must* pass, which forces the round to end on the client's action with the
host winning. Verified as an A/B: without the fix the suite reports "the host is LOCKED OUT of its own turn";
with it, 9/0.

**Two corrections to yesterday's notes, both mine.** CLAUDE.md recorded "it is not the product" as an
established fact — the reasoning was that the failure reproduced on builds that could not contain the change
under suspicion, which is true but says nothing, because the bug predates all of them. And my first repro used
a fixed 1,200ms wait and failed on the *fixed* build, because the round ceremony legitimately holds the board
for a couple of seconds. It polls now. That is the fourth time in two days that a fixed wait produced a false
signal.

### v1.31.19 — one tap into any chat, and a paste that forgives

Aj, settling on browser-only: *"you can always copy paste the code to a chat program"* — so this automates
exactly that. `navigator.share()` on the invite and reply codes: one tap into whatever chat the two players
already use, instead of select-copy-switch-paste. Where `navigator.share` is absent (desktop Firefox, older
Safari) the button simply is not offered and Copy is untouched.

**It shares the RAW code and nothing else.** A friendly lead-in would read better in the chat, but the recipient
pastes whatever arrives, and a build without the tolerant `dec()` below would reject it. There are demonstrably
stale copies of this game in the wild — one cost us a bug report — so the payload stays exactly what every
version can already parse. `sharetest.js` asserts that byte-for-byte rather than merely asserting "share was
called", because the payload *is* the risk.

**And the paste side now forgives.** A code that has travelled through a chat app arrives with "here you go:" in
front or a stray newline behind, so `dec()` falls back to the longest base64 run in whatever was pasted. The
suite asserts both halves of that: a code wrapped in a sentence is accepted **and produces a real reply** (not
merely "no error was shown" — an error that never renders would make the weaker assertion pass on a broken
build), while actual rubbish is still rejected, so the tolerance is not a wildcard.

### v1.31.18 — the build stamps itself

Aj reported that the client lobby had no name field, with a screenshot. The field had shipped **two versions
earlier**; his phone was holding a `content://` file downloaded before it. The report was honest and the code
was right — and **nothing on either screen could have told us that.** Diagnosing it took a headless run at his
exact viewport to prove the field renders. That is a round-trip that should never have been needed.

So the build now names itself, in the two places a bug report is actually taken from: the **setup dialog**
footer (`Cardmen Fighter v1.31.18`) and the **netplay lobby bar** — the latter specifically because that is the
screen Aj screenshotted, and a netplay mismatch is where a stale copy does real damage.

**The version is derived, not declared.** `build.js` reads it from **README.md's `**Status:**` line** and
substitutes a `__VERSION__` placeholder, and hard-fails if it cannot find one. There is deliberately no second
constant to bump: **a stamp that can drift is worse than no stamp**, because it makes a stale build look
current, and the release checklist already bumps README. Bumping this release's own version was the
demonstration — README changed, the stamp followed, no other edit.

`node versiontest.js` — **10/0** — asserts the whole chain rather than just the presence of some text: README
names a version, no `__VERSION__` survives into the page, the built page's constant equals README's, **the
repo-root copy carries the same stamp** (that is the file people actually download, and a mismatch there would
be the same class of confusion), both screens show it, and each is really rendered rather than merely present
in the DOM.

**The habit worth keeping, which is the reason this exists:** when a shipped feature is reported missing,
**check the reporter's build before reading the code.**

### v1.31.17 — QR invite codes, and a hand-written encoder verified against Apple's

Aj: *"if its qr you can also do that with desktop browsers right?"* — yes, and that is the pairing this is for:
**a desktop hosts, a phone joins.** The host and joiner screens now render the invite code as a QR beside the
text box. Phase 1 is **show only**, exactly as scoped: no camera, no permissions, nothing that can break — it
is an extra rendering of a string the screen already displayed. The text box is untouched and still works.

**`code/qr.js` (new, ~330 lines, inlined by `build.js` via `__QR__`)** — a byte-mode encoder: version pick,
GF(256) Reed-Solomon, the capacity/block tables for all 40 versions × 4 ECC levels, interleaved blocks, all 8
masks scored by the spec's penalty rules, and BCH format/version info. Hand-written rather than vendored
because the game is deliberately zero-dependency and hand-inlined. It renders at **level L** (most payload per
symbol) and throws rather than emitting a silently corrupt symbol if a payload ever exceeds v40.

**The bug worth recording, because it defeated every check except one.** The format bits went in **LSB-first
instead of MSB-first**. Consequences: the symbol was structurally flawless to the eye, and reading the format
bits back by hand produced a *valid published format string* — because reading them in the same wrong order is
self-consistent. A real decoder meanwhile returned nothing at all, at **every** version including v1, which
looks far more like a broken detector than a one-line bug. Two things were needed to get out of that hole:

1. **A control on the instrument.** `BarcodeDetector.getSupportedFormats()` proved the decoder really did
   support `qr_code` here, so "nothing decodes" had to be our fault. Without that, hours could go into
   suspecting headless Chromium.
2. **A reference implementation to diff against.** macOS ships `CIQRCodeGenerator`. `qrref.js` compiles a Swift
   snippet on the fly, reads the version/ECC/mask back out of *Apple's* own format bits, builds the same symbol
   with our encoder and compares **every module**. The first diff pinpointed the reversal immediately, and 32
   reference symbols then settled the exact bit order and the 7/8 split of the second copy — questions that
   memory and code-reading had both got wrong.

A second real bug fell out of the same diff: the second format copy was split **8/7** instead of **7/8**,
writing one bit onto the dark module and leaving `m[8][size-8]` blank. Decoders that fall back to copy 2 would
have failed on symbols that otherwise looked fine.

**Verification.** `node qrref.js` — byte-identical to Apple's encoder up to **v35**, all four ECC levels
(darwin only; it skips with a notice elsewhere, since it corroborates rather than gates). `node qrtest.js` —
**19/0**, every case rendering a real symbol and decoding it back with `BarcodeDetector`, including a full
synthetic invite at v29 and the *actual* invite code from a live host screen.

**Scannability is asserted, because decoding the bitmap cannot tell you about it.** A decoder is handed a
perfect bitmap and will happily read a symbol far too small for any camera. What a camera needs is physical
size and crisp edges, so the QR now renders **1:1 in device pixels**: it asks for the largest whole number of
device px per module that fits its container, then sets the CSS size to exactly that many. The first attempt
looked fine and was not — `padding` with `box-sizing:border-box` shrank the content box and re-introduced
fractional scaling, and measuring "the first ancestor with a real width" found the canvas's own default 300px
placeholder, so every screen size rendered an identical 234px symbol. Now: **3.0 CSS px per module on desktop**
(351px for a v23 symbol), 2.67 on a portrait phone at dpr 3, 2.0 on a landscape phone where height is the
binding constraint. The suite asserts the CSS floor, the whole-number device-pixel ratio, and the 1:1 mapping.

**Measured, so phase 2 can be planned:** the real invite is **1,036 chars → version 23, 109 modules**, against
a single-symbol ceiling of **2,956 bytes** at level L. Shortening the SDP would lower the version and improve
every scannability number at once — that is now the highest-value follow-up.

### v1.31.16 — emotes with sound, and a name field where you can actually see it

**Confirmed first:** Aj tried v1.31.15 on his phone and online play worked — *"swimmingly"*. That closes the
one thing the previous entry said it could not prove (the crash was fixed; the WebRTC handshake completing
between two real devices needed his device).

**Names.** Almost all of this already existed — a persisted `myName`, `t:'join'` carrying it, the host seeding
`seatNames[0]`, and `logName` rendering it per-reader. The gap was only that **Play online never asked**, so
anyone who skipped the New Duel screen hosted as "Rival". A shared `nameRowHTML()` now appears on **every**
lobby screen: the BC lobby, the RTC host lobby, and the client's signalling screen — which is a client's very
first sight of the game. Locked once a client hits Ready, like the deck picker, because the name travels *with*
Ready and editing after that would reach nobody.

**A host "ready ping"** (`🔔 Ping the table`) with its own cue, because the lobby is exactly where someone
wanders off. Same relay shape as an emote but it works *before* the game starts, which is when it is needed.

**Emotes — seven, netplay only.** Aj's five plus two:

| | | why |
| --- | --- | --- |
| 👋 Hi! · 👍 Yes! · 👎 No! · 🤝 GG · 🔄 Rematch? | Aj's set | greeting, agree, disagree, sportsmanship, continue |
| 👏 Nice! | added | reacting to a play is the commonest card-game emote, and the most generous |
| ⏳ One sec | added | netplay has a 90s disconnect grace; "I'm still here" prevents the worst online moment |

They compose: **"Rematch? → Yes!/No!" is a whole negotiation with no extra vocabulary.** `Rematch?` is an
*expression* for now — a real one-tap rematch needs a restart handshake over the live connection, and is filed
below. Sounds are new `CUES` entries in the existing procedural synth, so the file stays asset-free and the
existing SFX mute covers them.

**Built on the existing plumbing rather than a new channel.** A client sends `{op:'emote'}` as an intent; the
host narrates with **`say()`** — which renders `{who}` in each reader's own frame *and* broadcasts the template
— then broadcasts `t:'emote'` so every seat pops the bubble. Consequences worth knowing:
- **Emotes are handled BEFORE every turn gate** in both `hostApplyMove` and `hostApplyMoveN`. Reacting when it
  is *not* your turn is most of the point.
- **A client must never call `showEmote`** — only `emoteFx`. `say()` on the host already broadcast the line, so
  re-logging locally prints every emote twice. The suite asserts the count is exactly 1.
- **Cooldown on both ends**, 1.2s. The host re-checks per seat, because a client controls its own clock.

**The bug worth remembering: a name collision cost the whole feature.** The emote bar is built *inside* the NET
IIFE, so `sendEmote(k)` resolved to NET's own `sendEmote(seat, key)` — passing the emote key as a seat number.
Taps registered, no log line, no bubble, no error. The inner one is now `emoteBroadcast`.

New suite **`nettest_emote.js`** (15): both directions cross the wire, the log is reader-relative ("You" vs the
sender's name), it works off-turn, the double-log is absent, and a three-tap burst yields at most one line.
Full sweep 22/22.

### v1.31.15 — netplay could not be started from a file opened on a phone

Aj, from his phone: tapping **Host** on a downloaded copy of the HTML killed the game outright —
`ERR_FILE_NOT_FOUND`, URL `content://com.and…`.

**Cause.** Netplay was entered by *reloading with a query string*:

```js
$('onHost').addEventListener('click', function(){ location.search='?net=rtchost'; });
```

The code even documented it — *"netplay is entered by a page reload (?net=…)"*. On Android a downloaded file
opens as a **`content://` provider URI, and that scheme cannot carry a query string**. So the tap navigated to
a URI the provider could not resolve and the page was simply gone. Nothing about netplay ran at all; this was
never an online-play bug, it was a navigation bug.

**Fix.** `boot()` split into a URL parser plus an imperative **`start(role, kind, opts)`**, and the Host/Join
buttons call `start` directly — **no navigation, the URL never changes.** `?net=` still works, because links
use it and every `nettest_*` suite enters that way. The Leave control had the same defect (`location.search=''`
is a navigation): it now clears the query only when there *was* one, and otherwise reloads the untouched URL.

Also checked, since a `content://` origin is opaque: every `localStorage` access is already inside a
`try/catch`, so storage being unavailable degrades to the in-memory fallback rather than throwing.

**What this does NOT prove.** It removes the crash — the game stays alive and the invite-code UI appears.
Whether the WebRTC handshake completes between two phones can only be confirmed on real devices; that needs
Aj to try it.

New suite **`nettest_inpage.js`** (10) asserts the thing that actually matters — after tapping Host, netplay is
live **and `location.href` is byte-identical to before** — plus that the `?net=` path still boots.

**Bonus, found while verifying: my own v1.31.9 fix still had an impatient counter in it.** `nettest_full`
guarded stalls with `stalled < 40`, which at 150ms a go is **six seconds** — the same class of bug that rewrite
existed to remove, one layer up. Patience is now measured as **time since progress** (60s), with a resolved
round or a completed action counting as progress. Verified under **five concurrent browser suites**, heavier
than any serial-sweep position: `PASS: 5, acted=21` — it worked harder and still got there.

### v1.31.14 — dialogs are landscape-safe, and the panels track the header

The v1.30.x landscape work fixed the in-game **board** and left every dialog alone. `.modal` had no
`max-height` and no `overflow` while `.overlay` **centres**, so a modal taller than the viewport hung off the
top *and* the bottom with nothing to scroll — the top half simply unreachable. Aj found it in a screenshot.

**Measured before touching anything**, on the setup dialog (812px tall):

| viewport | modal top | bottom | clipped |
| --- | --- | --- | --- |
| 568×320 | −246 | 566 | both edges |
| 844×390 | −211 | 601 | both edges |
| 667×375 | −218 | 594 | both edges |
| **1280×800 desktop** | **−6** | **806** | **both edges** |

So this was never only a landscape bug — the setup dialog overflowed the *desktop* viewport too, just barely.
Capping the height (`max-height:calc(100dvh - 40px); overflow-y:auto`) lets it scroll inside itself, which
makes centring safe at every size. There is only one `.overlay`/`.modal` pair in the markup, so setup,
settings, the codex, the cheat sheet, how-to-play, the win overlay, the name editor and the pile viewers all
got fixed at once.

**`#tutPanel`** had the same uncapped-height bug: 565px tall at a 320px viewport, hanging 247px off the top.
Capped in both its anchorings (bottom-centred, and the desktop right-hand dock at `top:150px`).

**`#disconBar` was pinned at a hardcoded `top:54px`**, which assumed the 56px desktop header. Measured: the
landscape header is **37px** (so it floated 17px low) and a **portrait phone header WRAPS to 92px** (so it sat
38px *inside* the header, over the controls — a bug nobody had reported). Since wrapping depends on content,
no per-breakpoint constant is right either: `--headerH` is now **measured at runtime** and observed.

**The regression this introduced, and how it was caught.** The runtime sync wrote `--headerH` unconditionally,
which re-entered its own `ResizeObserver` every frame and starved the page. It broke **netplay**, not layout:
`nettest_full` went from `client 4` to `client 0` — the client never getting a turn — while every layout
assertion still passed. A/B'ing the actual builds isolated it in two runs (CSS-only build: fine; header sync
on: broken), and the fix is idempotence — write only on a real change. **An unconditional write inside a
ResizeObserver callback is a page-starving loop, and it presents as unrelated flakiness.**

`landscapetest.js` grows from 64 to **96** assertions: every dialog at 568×320 / 844×390 / 667×375 / portrait /
desktop must be fully on screen with its height capped and its last control reachable **after scrolling** (the
same reachability-not-visibility standard the board cases already use), plus `--headerH` tracking the real
header and both panels on screen at every size.

*Two unrelated flakes seen while sweeping:* `exporttest` (once) and `nettest_names` (once), each at a late
sweep position, each passing alone. Same fixed-wait class as the v1.31.9 pair — filed below.

### v1.31.13 — STOPPER deleted, and the netplay record is now the host's

**Two known gaps closed.**

**1. The orphaned STOPPER mechanic is gone.** No card had `kind:'stopper'` — the rework retired it — but the
implementation was still live-looking in three layers. Removed: `stopper()` / `stopperNeed()` and the four
unreachable rank-2 card entries (engine), `pickStoppers()` and the commit branch (ai), and the whole UI flow —
`stopInfo`/`doStopper`/`pickStoppersUI`/`openStopperPick`, the `pick` kind, the context-button branch, the
`stoppers` stat, the dead CSS and art glyph (template). **The build shrank ~12KB.**

Two things deliberately kept: **the apex 2's flavour names** (Skillful Teleport / Divine Intervention / Sleight
of Hand / Masterful Block) as name-only entries, because `cardName()` reads them even though `effectOf()`
returns null — a test caught that removing them stripped the apex of its name; and **`#stopfx`**, which
`quickFlash` has reused since the rework.

*Worth recording how nearly this shipped broken:* the first build after the removal **failed** on a mangled
ternary, and because `build.js` refuses to write on a syntax error, the suites that ran next were testing the
**previous** HTML and all reported green. The 12KB size drop is what gave it away. `build.js`'s output must be
read, not assumed — it is the guard, and it works.

**2. The netplay record is authored by the host and adopted by everyone** (Aj's call over host-only and
per-page-perspective). A client never runs the drivers that count opponents' plays, so a client-written record
reads all-zeroes for every opponent. The host now broadcasts its finished record at game end (`t:'record'`) and
clients store *that* — one canonical game per table. The payload is public: what was played, never anyone's
hand. `adoptedBySeat` is stamped on adoption so later analysis cannot mistake a client's copy for the host's,
while `yourSeat` keeps naming the author.

*And the first version of that test was invalid.* Both netplay pages share one browser context and therefore
**one `localStorage`**, so every assertion about "the client's stored record" passed trivially against the
host's own write — the client's adoption had never happened at all. Verified through a page-local seam
(`__cmf.adopted()`) instead. This trap is already documented in CLAUDE.md; it is easy to walk into anyway.

New suite **`nettest_record.js`** (12). Full sweep 21/21, with `nettest_full` green at position 21.

### v1.31.11 — "STOPPERs have zero engagement" — because STOPPERs are not in the game

A backlog item, from Aj's playtest exports, recorded **0 STOPPER uses across 14 games and 958 log lines** and
treated it as an engagement problem. It is not: **no card has `kind:'stopper'`.** The rework retired the
mechanic (the apex 2 wins by value instead), so `effectOf` on any 2 returns *no effect at all* — the playtest
was measuring a mechanic that had already been removed. Confirmed by simulation too: across 11,149 duel turns
and 69,789 six-player turns, a STOPPER was held **0 times**, while the same 2s were played as the apex 1,017
and 8,163 times.

**This is the SECOND orphaned mechanic found today by the same check**, after Phantasmal Illusion's
`kind:'phantasm'`. The dead code is substantial and looks alive in all three layers: `E.stopper()` /
`stopperNeed()` in engine.js, `pickStoppers()` in ai.js, and a whole UI flow in the template (a `pick` kind, a
`stopperFlash`, the context button, ~65 references). Two live call sites — `E.stopperNeed(state)` and
`E.stopper(...)` — can never fire, because the hand can never hold the card that opens them.

Not deleted here: that is a real removal and wants its own change with the suites run around it. Recorded so
nobody debugs it a third time. **The check that finds this class of bug is `grep -c "kind: 'x'" engine.js`
returning 0** — it is in CLAUDE.md, and it has now paid for itself twice in one day.

### v1.31.10 — the clean-up phase existed only for seat 1

`endOfRoundTrimThen` trimmed and announced **seat 1 only** — `E.discardToLimit(state, RIVAL)` with a hardcoded
`<b>Rival</b>` in the log. At a six-player table that meant seats 2+ were never trimmed by the UI path and
their clean-up was invisible. Now it loops every living opponent and narrates through **`say`**, so the line
renders in each reader's own frame and reaches netplay clients.

Verified in a real 4-player game: seat 2 staged to 15 cards is trimmed to 10 and the log reads
*"Knuckles discarded 5 to hand size → energy pile."* — named, not "Rival".

Worth knowing why this was only a *narration* gap and not lost cards: the engine's own clean-up
(`finishRoundWin`, gated on `!DEFER_DRAW`) already trims **every** seat before the round draw, and
`setDeferRoundDraw` is never called anywhere, so that path is always live. The UI trim is the *post-draw* pass
— `roundDraw` deals `numPlayers` cards with no cap check, so a hand legitimately sits above `MAX_HAND` between
the draw and the next clean-up. The cap is a clean-up threshold, not a hard limit.

### v1.31.9 — the position-dependent netplay suites: it was the TESTS, not the environment

`nettest_full` and `nettest_log` passed alone and failed late in a long serial sweep. This had been recorded as
unexplained environmental accumulation, with three hypotheses tested and disproved (CPU contention, orphaned
ports, stale `chromium_headless_shell` processes).

**The documented failure signature was the clue and nobody read it as one:** `nettest_full` reported
`maxRound=2 acted=80` — it acted on *every* step and none of it landed. `waitTurnEnds()` returned **void**
after 40×80ms = 3.2s, so the caller could not distinguish "the turn ended" from "I gave up", and then acted
into a board still mid-mirror-round-trip. Under load that is every step.

`nettest_log` was one impatient loop: a 9s budget for the turn to reach the client. Blow through it and the
turn assertion fails, the client then finds no legal jab, and both log assertions fail with it — **the "~4
timing assertions" in the old note were one root cause, not four.**

Fixes: `waitTurnEnds` returns a boolean and the driver re-waits rather than acting; the loop is bounded by
**wall clock and productive actions** instead of a raw iteration count (a transition used to burn budget);
budgets are generous; and a missing log line fails an assertion instead of throwing on `undefined`.

Verified **20/20 with `nettest_log` at position 19 and `nettest_full` at position 20** of a serial sweep — the
exact positions they were documented to fail at — and `acted` fell 80 → 10.

**The principle, now in CLAUDE.md: a slow machine should make a suite SLOWER, never red.** Any fixed `wait(n)`
followed by an assertion is this bug waiting to happen. One clean sweep is evidence rather than proof, since
the original failure was intermittent.

### v1.31.8c — did the Back Stab AI work hurt multiplayer? No. (And the first answer was wrong.)

Aj: *"fixing backstab's ai made it worse for multiplayer?"* The honest first answer was **the A/Bs cannot
tell you** — they were powered for spread, not for one deck's share (see 1.31.8b). So a focused instrument:
Pure Rogue at six players, deterministic balanced field, seat **rotated** (seat 0 leads round 1, so pinning a
deck there inflates it), 4,000 games per arm.

| | Pure Rogue at 6p | Back Stab casts |
| --- | --- | --- |
| before all three changes | 9.85% ±0.47 | 6,318 |
| after | 9.53% ±0.46 | 7,871 (**+25%**) |

**−0.3 at 0.5 s.e. — flat.** The AI work is neutral for Rogue in multiplayer, and the ~10% share is real and
long-standing rather than caused by this PR. Also informative: **casting Back Stab 25% more does nothing for
Rogue's win rate** — the card is neither Rogue's problem nor its solution.

**The first version of this measurement was garbage, and the way it failed is worth keeping.** The harness
passed lowercase deck keys (`'rogue'`), which are invalid — and `newGame` does not throw, it falls back to the
full 52-card set. So all six seats played the same Full Set deck, Pure Rogue was never in the game, and both
arms returned an identical **16.65%**, which is exactly 1/6 and looks like a clean null result. The tell was
the counts being identical to the unit. Deck keys are **capitalised** (`E.DECKS`), and the harness now also
counts Back Stab casts so a silent zero cannot pass as a finding.

### v1.31.8b — the per-deck noise floor, measured

Aj, seeing Pure Rogue's 6p share read 10.9 then 8.6 across snapshots: *"it's only been buffs to ai for
backstab so far… why is it dropping?"* It wasn't. The same build, run eight times, puts Pure Rogue at 6p
anywhere from **5.2 to 18.1** — a run-to-run **sd of ~3.3 points**. An 8-run mean carries ~1.2 s.e., so
10.9 → 8.6 is 1.4 s.e. and inside the noise.

Two reasons this is the noisiest cell in the table: `mpsim` assigns decks **randomly per seat**, so one
400-game run gives a given deck only a few hundred games at six players; and Rogue's share is *low* (~10%),
so the same absolute wobble is a larger relative one.

Practical consequence, now in CLAUDE.md: **the standard 8-run A/B is powered for the SPREAD, not for one
low-share deck.** Resolving a 2-point change in Rogue-at-6p at 3σ needs roughly **22 runs per arm** (~8,800
games). Every A/B run this session was correctly powered for what it claimed (spread) and would NOT have
detected a 2-point single-deck move either way.

### v1.31.8a — the engine's own defaults disagreed with the shipped game

`SPECIAL_LOSS_MODE` defaulted to **`'all'`** and `MILL_SCOPE` to **`'universal'`** — the v1.31.0 multiplayer
package that was **REVERTED in v1.31.2**. The template has set `'chosen'` / `'targeted'` explicitly ever
since, so every real consumer was fine, but **any probe, sim or test that did not set them measured a
different game than anyone plays.** That is exactly how a v1.31.8 probe "showed" a Hermes Back Stab stripping
three shields when the shipped game strips one.

Defaults now match the shipped game. Every sim already set them explicitly, so no measurement changes;
`test.js`'s reset-after-block line was restoring the reverted values and now restores the shipped ones.

### v1.31.8 — Back Stab: the AI was buying a round it couldn't spend

Aj asked how Back Stab was doing after the v1.31.4 redesign. Cast rate was healthy (17.3 / 18.3 / 25.8 per
100 games at 2/4/6 players) and casting it correlated with winning the round — but the **duel** number was
oddly weak, +8.6 points over baseline where multiplayer showed +44.

The duel branch of `lockoutWorth` returned `'duel'` **unconditionally**: one rival, so a skipped round is a
free round. That reasoning has a hole. **A lock does not remove their existing pile.** If they already hold
the initiative and you cannot beat it, silencing them changes nothing — you pass, and they take the round
anyway.

Measured over 800 duels, splitting every cast by what the caster could actually follow up with:

| follow-up available | casts | round won |
| --- | --- | --- |
| a Special | 44 | 93.2% |
| only a jab | 11 | 100.0% |
| **nothing** | 51 | **7.8%** |

Baseline round-win is 50%. So **48% of every duel cast was thrown away**, on rounds it then lost.

The fix is one line — `if (!E.legalFightPlays(st, p).length) return 'no-follow-up';` — and note the condition
is **any legal play, not a Special**: a jab wins the round just as reliably (100% vs 93.2%) because a
whole-round lock means nobody can answer it.

**Do NOT read the obvious headline.** "Round-win after casting 58.6% → 94.2%" is close to a **tautology**:
the change removes losing states from the denominator, so the conditional win rate had to rise. It was the
first framing written here and it oversold the result — the same error this repo flags when a 0.00 cast rate
gets read as a verdict. The honest measurement fixes the denominator: **every round where a seat held Back
Stab and could afford it**, counted identically in both arms (~750 rounds per arm, 4000 duels):

| | duel round-win | energy spent that round |
| --- | --- | --- |
| before | 54.5% ±1.9 | 7.68 |
| after | **59.9% ±1.7** | **6.52** |

**+5.4 points at 2.1 s.e. — under the bar.** Suggestive, not proven.

And the "51 casts won 7.8%" group above were states with **no legal play at all** — they were losing those
rounds regardless, so the cast was not *causing* the loss. It was wasting 10 energy in a round already gone.
The one mechanical (not inferred) effect is therefore **1.2 energy saved per chance-round**.

Play rate did **not** improve from that half, and was never meant to: 1v1 **17.2 → 14.0** casts per 100 games,
4p and 6p flat within noise.

**Then Aj: "i want ai to cast it more and win with it… maybe those opportunities just don't come up much."**
He was right, and the funnel puts a number on it. Over ~1,800 evaluations in 800 six-player games:

| what the model saw | share |
| --- | --- |
| **no legal play at all** | **69%** |
| `crowded` — "a high special defends itself" | 15% |
| `plan-vulnerable` → cast | 11% |
| `highs-spent` hold | 4% |

69% of the time the AI holds Back Stab, can afford it, and simply has nothing to follow it with. That is the
ceiling on how often the card can ever fire, and it is a property of the game, not the AI.

The 15% `crowded` bucket was the only large **discretionary** hold, and it measured worthless. Flipping it
(`LOCKOUT_MAX_ALIVE` 3 → 6, i.e. never hold):

| | casts per 100 games (6p) | round-win over the same chance-rounds |
| --- | --- | --- |
| hold at 4+ alive | 25.6 | 24.1% ±1.0 |
| **always cast** | **50.3** | **25.4% ±1.0** |

Double the casts, round-win unchanged (+1.3, 0.9 s.e.), deck spread unmoved (largest 2.0 s.e., 8 runs per
arm; ♠ decks move −1.4 to −0.9, all under 1.0 s.e.). **This is not a buff — it is removing a hold that bought
nothing.** Kept as a knob (`setLockoutMaxAlive`) for future study.

Both halves together, casts per 100 games: **1v1 17.2 → 11.5** (waste removed), **4p 17.8 → 25.9**,
**6p 27.5 → 44.7**.

**Third: Hermes makes the whole target model moot, and the AI didn't know.** Aj: *"if it was in super mode…
you could play the smallest pair (a pair of 3s) and still win with it… does it do that?"* Verified in the
engine — under Hermes every rival skips the round, so a **pair of 3s** wins it outright and strips a shield.
(Note the raw engine default is `loss='all'`; the shipped game sets `'chosen'`, so it is **one** shield, not
the whole table. A probe that skips the template's setup will show three.)

It mostly did — 68% of Hermes turns — but the model's target-specific holds were still running, and they
reason about whether **one** rival can answer when **all** of them are locked:

| Hermes turns at 6p | before | after |
| --- | --- | --- |
| cast | 68% | **76%** (`super-sweep`) |
| `no-follow-up` hold (nothing to play) | 19% | 24% |
| `no-special` hold (only a jab) | 4% | 8% |
| **`thin-hand` / `highs-spent` hold** | **9%** | **0%** |

`lockoutReason` now takes an `all` flag and short-circuits to `super-sweep` before any single-target check.
The two remaining holds are legitimate. `no-special` is deliberately kept: under Hermes a jab would also win
the round, but a jab does not break a shield and this is a 10-energy card.

Balance, 6 runs per arm: spread −0.9 / −3.5 / −0.8 / +0.2, largest 1.5 s.e.; biggest per-deck move Berserker
+2.5 at 6p (1.7 s.e.), right direction and under the bar. The change is small enough that it is **not**
resolvable at this sample size — it is justified as correctness, not as a measured gain.

Multiplayer is untouched by design — it already required a plan; the `no-follow-up` check just names the same
hold earlier, which is why `no-special` collapsed from 361 to 2 in the branch tally. One related tightening:
`!plan` is now tested **before** the Outbalance read, since otherwise a fresh read could license a cast with
nothing to follow it.

Balance, 8 runs per arm: spread 19.1→19.7 (2p), 18.5→17.6 (3p), 17.8→19.9 (4p), 16.7→14.2 (6p) — largest
2.1 s.e. Pure Rogue +1.9 in duels (2.3 s.e.), the right direction and still under the bar. As with Counterfeit:
**the AI plays the card materially better, and no deck's win rate moved measurably.**

Tests: **231** (was 222) — the no-legal-play hold, that leading counts as a follow-up, that a high plan now casts at a full table, and that the old hold is still reachable through the A/B knob.

### v1.31.7 — Counterfeit: the card was fine, the AI's own rule was vetoing it

Aj asked to check Counterfeit after Phantasmal Illusion, expecting the same story. It is **not** the same
story, and the investigation is worth keeping because I got it wrong first.

**What I claimed, and why it was wrong.** I measured every real Counterfeit chance (holding it, following,
round ≥ 2, affordable, and actually losing the fight) and reported that the base card *"can never beat a pair —
0 out of 122"*, concluding it was structurally dead because a copy's rank always already appears in the pile
and ties never win. Aj corrected it: the copy takes the **base card values**, and then **your boosts and
debuffs apply** — the same principle he had just restored on Phantasmal Illusion.

His line, verified in the engine as written:

```
their pair of 10s, effective value with your Caltrops out: 8   (oppDelta −2)
Counterfeit cast: true | copied: 10D
play your pair of 10s: true
you now hold the pile: true | value 10
```

So 0-out-of-122 was a measurement over boards where nobody happened to have a modifier out — reported as if it
were a property of the card. **That is the third time in two sessions a number was quoted as a verdict.**

**What is actually true**, re-measured on the right condition (300 games, an *edge* = my buffs + however much
their pile is debuffed):

| | chances with an edge | Counterfeit helps | helps with no edge |
| --- | --- | --- | --- |
| 1v1 | 4.7% of chances | **25.0%** | 3.7% |
| 6p | 3.1% of chances | **39.4%** | 2.9% |

About **10x more useful when the enabling condition is on the board.** Counterfeit is a **combo card**, and the
combo is in-suit by design — Caltrops is ♠7, Counterfeit ♠8, and a Rogue deck holds both. The AI simply never
sets one up for the other, so the edge exists on ~3% of its chances and the card reads as dead in every sim.

**No card change.** The mechanism Aj designed already works. What is left is either a player who builds the
board, or an AI that values Caltrops as a Counterfeit enabler — the latter is a real option but a large change
for one narrow line, and it would be a competence upgrade that only Rogue decks receive (see the `nice`-flag
lesson in the persona notes before doing it).

**Docs corrected.** `CARD-STATS.md`'s "AI blind spots" paragraph called out three cards as 0.00-cast; all three
lines were stale and two of them caused wrong claims in conversation this week. Each now carries its
re-measured rate and the reason the old number was not a verdict.

**Then the AI half, which is what Aj actually asked for: "how can we teach the ai to use those cards… that
they combo with buffs and debuffs?"** It turned out the AI's *evaluation* was already right — both
`counterfeitHelps` and `tryPhantasm` call `applyEquip`, so they see buffs and debuffs. Two other things were
wrong.

**1. The AI's own guard was vetoing the card.** `pick(pred, avoidCombo)` skips any card whose rank appears
twice in hand — "don't break a Special for this effect". Counterfeit is ♠8, so **holding any second 8
suppressed it entirely**, and at six players that vetoed it on **81% of the turns where it would actually have
won the fight** (35 of 43). It is the wrong rule for the one card whose job is to *make* a Special.

**2. The evaluation counted a card it was about to spend.** `counterfeitHelps` tested
`beatsCur(pl.hand.concat([copy]))` with the ♠8 **still in hand** — so the AI could approve a winning play that
leaned on the very Counterfeit it was casting. It now evaluates the hand minus that card.

Cast rate, `knight`, 400 games: **0.5 → 1.3 (2p), 1.8 → 6.8 (4p), 3.0 → 9.3 (6p)** per 100 games — roughly
Phantasmal Illusion's rate.

**And the combo now happens on its own.** Equipping a debuff updates the LIVE pile (verified: Caltrops drops
their pair of 10s to 8 the instant it lands), and the AI's effect loop `continue`s after equipping, so it can
equip and then copy in the same turn. Of 40 six-player Counterfeit casts: **8 are a same-turn equip→copy
chain**, 18 have equipment already out, 14 are bare shape-completions — **65% now fire with a modifier on the
board.** No "combo logic" was added; removing the veto was enough.

Balance, 8 runs per arm: spread 18.5→18.8 (2p), 16.4→19.3 (3p), 18.8→18.1 (4p), 12.9→14.7 (6p) — largest
2.1 s.e., nothing at the bar. Pure Rogue +1.1 at 2p, not significant: the AI plays the card better, but no deck
win rate moved measurably. The 3p spread is the one to re-check if it drifts again.

Tests: **222** (was 218) — Aj's Caltrops line as a unit test, the no-edge decline, and the spent-card case.

### v1.31.6 — Phantasmal Illusion is the copy again (Aj's original card, restored)

Aj went looking for a tweak to Phantasmal Illusion and did not recognise the card he found. He was right not
to: **♦10 had been a different card since v1.13**, and his design was still sitting in the codebase,
unreachable.

**What happened.** v1.13's balance pass replaced the copy-a-Special `phantasm` mechanic with a clean
**+6 valueBoost**, stated reason: *"The AI pilots valueBoosts, so it's alive now."* The card had shown a 0.00
cast rate in sims. But PATCHNOTES had already written down why that number was not a verdict:

> "Cards whose trigger conditions the bots rarely create will show ~0.00 castRate and no win data. This is a
> **measurement artifact, not a verdict on the card.** Phantasmal Illusion needs to face a straight or full
> house; the AI rarely leads one, so it almost never fires in sims — yet it **correctly strips a shield when
> it resolves** (verified)."

So a working card was traded away to move a number in a sim, against this repo's own written warning. Worth
remembering the next time a card reads 0.00.

**The old implementation was never deleted** — `E.phantasm()`, `tryPhantasm()` in ai.js, a full UI picker, and
the `phantasmPlus` boost hook all keyed off `kind: 'phantasm'`, which **no card had**. Three layers of dead
code carrying the name of a live card, which is what made this so confusing to diagnose.

**Why the original really failed, and why Aj's version doesn't.** The swap was **mandatory** in all three
layers, and one swap cannot raise a matched set — so the card needed a straight or full house on the pile to
do anything at all. That is the narrow trigger, not a dumb AI. Aj's design (which the implementation never
matched): the copy takes the play's **base card values**, is then **subject to boosts and debuffs**, and you
**MAY** swap one card in. Any of the three can carry it, so it answers a pair or trio too.

| route | what it costs |
| --- | --- |
| your Equipment / boost lifts the copy | nothing but the Illusion card |
| a debuff on THEIR play left the pile low | nothing but the Illusion card |
| Odysseus (♦K) conjures it at **+1** | nothing but the Illusion card |
| the optional swap | one real card, into your Energy |

A bare copy with none of them **ties, and ties never win** — confirmed with Aj, and the engine says so in the
refusal text.

**Odysseus points back at the copy** (`phantasmPlus: 1`) instead of upgrading the +6 to +7.

**The illusion is now a pile like any other.** It stores `raw`/`rawKey0`/`lockedDelta` and `refreshPile()` no
longer skips it, so its value tracks equipment coming and going exactly as a real play does. `phantom` still
marks it for the UI and the netplay mirror.

**Measured.** The AI casts it again — **1.8 / 6.3 / 8.3 per 100 games** at 2/4/6 players, against 0.00 for the
version that was deleted for being uncastable. That is *less* than the +6 valueBoost it replaces (2.8 / 11.3 /
25.0), which is expected: it is a conditional answer, not a generic pump.

Balance, 8 runs per arm A/B'd against the +6 build: deck spread **18.6 → 17.4 (2p), 18.6 → 18.0 (3p),
18.1 → 17.7 (4p), 14.7 → 14.1 (6p)** — nothing above 1.1 s.e. One per-deck result sat at the bar, **2p Warlock
+2.7 (3.4 s.e.)**, with a plausible mechanism (Warlock is Wizard+Rogue, and Caltrops debuffing the pile is
exactly what enables a bare copy). **It did not reproduce:** a second independent 8-run sample gave
+1.1 (0.9 s.e.), pooling to +1.9 (2.5 s.e.) over 16 runs — under the bar. Same shape as the Pure Fighter
scare in v1.31.4. A significant-looking single sample with a good story attached is still a single sample.

Tests: **218** (was 208) plus **`phantasmtest.js`** (12), which drives the real page through all three routes
and asserts the bare copy is refused when nothing backs it. Two of the new assertions were passing *vacuously*
at first — they read an unchanged pile — and one raced the Rival's asynchronous turn for the pile; both were
rewritten to poll for the conjure and to check the card actually left hand.

### v1.31.5 — the netplay reveal, an export that knows multiplayer exists, and six duel-only card texts

The three items Aj prioritised, all three of which turned out to be worse than the one-line description.

**1. A netplay CLIENT casting Outbalance now sees the hand.** The effect resolves on the *host*, so the caster
got nothing. The host now pushes a `t:'reveal'` frame to the caster's seat (`hostFlushReveals`), called both
right after the cast and again after windows settle — an Outbalance can sit in a response window and resolve
later. Sweeping every seat is safe because `E.takeReveal(p)` is seat-checked and one-shot: at most one seat
returns anything, and it is always the caster.

**The bug inside the fix, which the test caught and a human would have hated:** `applyMirrorNow()` calls
`hideOverlay()` on every mirror update unless *state* vouches for the open modal — and the reveal is
deliberately not on state. So the first version worked and then the host's very next broadcast wiped it: the
caster saw their hand read for one frame. Fixed with a `revealOpen` flag that the mirror respects, cleared
centrally inside `hideOverlay()` so every dismissal path clears it, and outranked by any window the game
actually owes you.

**Privacy, stated precisely rather than assumed.** `sendTo(seat, …)` is genuinely point-to-point *only* in RTC
hub mode; over BroadcastChannel it falls through to a broadcast that the recipient filters by seat. BC netplay
is same-browser play, where the host tab already holds every hand and devtools reaches it, so this does not
widen that threat model — but it is **not** a transport for players who do not trust each other, and the code
says so at the call site.

**2. The playtest export was duel-shaped in three separate ways**, and every one of them silently corrupted
multiplayer data:
- stats were keyed `'you' | 'rival'`, so **all five opponents at a six-player table merged into one bucket**;
- `bumpFight` had exactly **one call site** — `bumpFight(YOU, …)` — so opponents' jabs and specials were
  **always 0, in duels too**;
- the record carried **no player count at all**, so a duel and a six-player game were indistinguishable, and a
  loss did not say who won.

Now: stats keyed by absolute seat; `numPlayers`, `mode`, `yourSeat`, `winnerSeat`; a `seats[]` array carrying
each seat's name, deck, difficulty, persona, fights, techniques, shields lost, final shields and elimination;
and opponents' fights recorded in `buildOppBeats`, the one place **both** drivers funnel through. `v` is bumped
to `2.0-mp`. The legacy `you`/`rival` fields stay so old analysis parses — but `rival` is now an **honest**
merge of every opponent (it always claimed to be that) and is flagged with `rivalIsMerged`.

**This means earlier conclusions drawn from exported multiplayer logs were drawn from merged opponents and
blank fight counts.** Re-read them with that in mind.

**3. Six cards still spoke duel-only, and four of them UNDERSTATED what they do.** The effects loop over every
opponent while the text named one:
- **Caltrops (♠7)** and **Spiked Armor (♣9)** — `equipDelta` (`engine.js` ~726) sums `oppDelta` across every
  opponent, so one Caltrops is −2 against all five at a six-player table. Now "EVERY Rival's highest card".
- **Giant Ram (♠J)** — `rideCostDelta` (~758) loops every opponent: it taxes the whole table. Now "every
  Rival's first effect".
- **Giant Swan (♥J)** — `swanValue` resists whoever tries to beat your play. Now "when a Rival tries to beat".
- **Armor Piercing (♣7)** resolves on the seat you strike → "the Rival you strike"; **Counterfeit (♠8)** copies
  from the pile whoever owns it → "the current play on the pile".

The house pattern for a single-target card stays **"Target Rival"** (Telekinesis, Ultima Attack, Outbalance,
Critical Hit, Back Stab). `docs/CARD-LIST.md` regenerated.

Tests: two new full-UI suites — **`nettest_reveal.js`** (10, three players over BroadcastChannel) which asserts
the caster sees the right cards named in its **own** frame *and* the negative half, that neither the host nor
the uninvolved third seat pops a reveal; and **`exporttest.js`** (14) which drives a real 3-player game and
asserts the export would contain both opponents' fights per seat. `__solo` gained `stats()`/`record()`/`games()`
so the export can be asserted without playing to a natural finish.

### v1.31.4 — Back Stab locks the ROUND, Outbalance reads the hand, and the AI learns to time it

Aj's redesign of the ♠ lockout line, plus the AI model that makes it a *timing* card rather than a card
nobody casts. His own account of why the old one was dead: *"i personally also don't use backstab a lot. but
the flavor is so good!"*

**The cards** (`engine.js`):

| | before | now |
| --- | --- | --- |
| Back Stab (♠10) | target skips their next **turn** | target skips the whole **round** |
| Outbalance (♠A under Pandora/Q) | they discard 1 more (2 total) | **look at their hand**, they discard 2 |
| Perseus (♠K) | Back Stab → skips the whole round | Back Stab becomes a **Quick** |
| Hermes (♠ Super) | Quick + skips the whole round | Quick **and ALL rivals** skip the round |

The escalation now reads cleanly — base buys a round off one rival, the King buys the *timing*, the Super
buys the *table*. `hostileTargets` honours a card-level `eff.all`, so Hermes is table-wide independently of
the `setDamageAll`/`setLockoutAll` research flags.

**The reveal is deliberately NOT stored on state.** A hand parked on `st` rides along in every netplay
snapshot — including to the player whose hand it is. The engine hands the cards over through a transient
`takeReveal(p)` that is **seat-checked and one-shot**, and persists only a derived *summary* on the caster
(`pl._read[seat] = {round, best, pairs, size}`). It is a pickup rather than a return value because an
Outbalance can sit in a response window: by the time it resolves, `settleWindows()` has long since handed
its caller no result. `test.js` asserts the hand never appears in `JSON.stringify(st)`.

**The AI model** (`ai.js`) is Aj's heuristic, transcribed: *"if they played a high last turn, back stab looks
bad because they wouldn't be able to play higher than me anyway. but if it feels like they're building a high
special on hand, back stab starts looking promising."* Tiers are his — low 3-6, mid 7-10, high 11+.
`lockoutWorth()` answers **"is the play I want to make under threat from THIS rival"**, never "do I hate
them" (that is targeting's job), from two sources: a fresh Outbalance **read**, else what we watched them
play (`observe()` — the pile is public, and like a player the AI only notices the plays it is present for).

**The subtle bug worth remembering: the "plan" must be the CHEAPEST legal special, not the best one.** Read
as the best play, the model's own branch fired **6 times in 200 six-player games** while the crude fallback
fired 24 — because when you are *following*, every legal play already beats the pile and therefore looks
high. Aj's line is *"i'd back stab them, then play my mid special or pair of Js"*: the play under threat is
the modest one. With the fix, `plan-vulnerable` becomes the dominant branch (45 of 50 casts at 6p). Hold
reasons are tallied **by name** (`lockoutStats()`), because *why it didn't fire* is the useful question.

**Balance: neutral, and this time that claim is measured properly.** 8 runs per arm, 400 games, `knight`,
A/B'd against the pre-redesign build in a separate directory:

| | base | new |
| --- | --- | --- |
| 2p spread | 18.4 ±1.05 | 18.3 ±1.06 |
| 3p spread | 19.1 ±0.93 | 17.5 ±0.93 |
| 4p spread | 19.8 ±1.90 | 18.4 ±1.04 |
| 6p spread | 15.9 ±1.55 | 16.0 ±0.94 |

Across all 44 per-deck comparisons **nothing clears 3σ** (largest 2.6). Pure Rogue drifts up everywhere
(2p +1.1, 3p +1.8, 6p +0.8) and none of it is significant — **the redesign does not fix Rogue's 6p problem**
(still 9.8% at a fair share of 16.7%); that is still waiting on the "slash" card in the backlog.

**A first draft of this measurement lied, and the way it lied is instructive.** With the mis-specified plan,
Pure Fighter showed **−6.0 at 3p (3.5 s.e.)** — over the bar, mechanically plausible ("better-aimed
lockouts hurt the deck that contests every fight"), and a completely coherent story. It evaporated when the
model was corrected. A significant-looking result with a good story attached is still just one sample.

**Cast volume went DOWN, on purpose:** 3p 56 → 28 casts per 200 games, 6p 38 → 16. The model holds the card
when the target cannot answer. `read-threat` — the Pandora line, the coolest part — fires about **3 times in
200 six-player games**: it needs Q♠ in the zone *and* an Outbalance on the same target in the same round. It
is a real line, not a common one, and it should be described that way.

**Persona parity holds** (`personasim.js 900 knight`): spread **1.1 points**, well under the 2.8 floor. Worth
recording how that looked at smaller samples on the way there — **5.8 at 150 games, 3.3 at 500, 1.1 at 900**,
with a control (six identical personas) reading 4.3 at 150 and 1.8 at 500. A 150-game persona run cannot tell
a real style effect from noise; don't read one.

**Human UI:** casting Outbalance pops a modal of the revealed hand (`showRevealIfAny`, dismissible, cards
rendered with `cardEl`). **Known gap:** over netplay a *client* casting Outbalance does not see the reveal —
the host resolves it and there is no private-to-one-seat message channel. Filed in the backlog.

Tests: **208** (was 190) plus a new full-UI suite **`revealtest.js`** (12) that drives the real page — casts
Outbalance in a 4-player game, checks the modal shows the right three cards, and checks the hand cannot be
found anywhere in `JSON.stringify(state)`. The unit side covers the four card definitions, the reveal's transience and the summary read, and the
timing model scenario by scenario, including the stale-read and thin-hand vetoes. `mpsim`'s self-check now
also asserts the whole-round lock, so a future edit that silently downgrades it aborts the run.

### v1.31.3 — per-round draw scales with the table (draw = numPlayers)

The one piece of the reverted v1.31.0 package that measures clean, shipped **on its own**. Shields stay flat at
4, `SPECIAL_LOSS_MODE` stays `'chosen'`, `MILL_SCOPE` stays `'targeted'`, apex stays off.

| | 2p | 3p | 4p | 6p |
| --- | --- | --- | --- | --- |
| per-round draw | **2** (unchanged) | 3 | 4 | 6 |

**What it buys:** jab share of all plays falls **22% -> 8%** at six players and **29% -> 12%** at four — Aj's
original complaint, *"three rounds in a row throwing jab after jab"*, cut by two thirds. It also flattens
player-to-player energy inequality, which otherwise *worsens* with table size: richest-vs-poorest goes from
**108% of the pool to 83%** at 6p (43 s.e., 10 runs per arm).

**What it does not buy:** length barely moves, 33 -> 31 rounds at 6p. The length win in the reverted package came
from `loss='all'`, not the draw. Same number of rounds, each more decisive.

**Balance: neutral.** Deck spread +0.3 / +0.8 / -1.6 at 6/4/3p, nothing clearing noise, 10 runs per arm with the
config self-checked behaviourally on every run. **Duels are a mechanical no-op** (`max(2, numPlayers) = 2`),
verified by reading the engine back rather than inferred.

**Two costs, measured and accepted:**
- **Deck energy spread widens 2.6 -> 4.6 cards** at 6p. Investigated: nobody draws more — the draw is uniform.
  Energy is a *balance* of inflow (cards committed by fighting) minus outflow (activations), and extra cards
  amplify the difference between decks that convert cards into energy and decks that do not. Pure Rogue banks
  least because it *commits* least (28 cards played vs Cleric's 54); Pure Wizard is second-lowest for the
  opposite reason — it commits as much as Cleric but *spends* most (19.2 activations). Pile size measures
  hoarding, not strength, which is why this never surfaced as a win-rate effect.
- **Initiative concentration** reads 1.8x -> 2.1x from `rulesim`. **UNVERIFIED and possibly wrong:** a separate
  run says draw=N makes the round leader *win less* (43% -> 38% at 6p), which should rotate initiative more, not
  less. Both cannot be true. Do not build on either until reconciled.

**Two UI bugs fixed with it,** both restored by the revert: the round banner read `E.DRAW_PER_ROUND` (the duel
constant) and would have announced *"Each player draws 2"* at a six-player table drawing 6, and the round-card
subtitle hardcoded the same string. Both now ask `E.drawCountFor(state)`. Verified in the built page — a duel
says "draws 2", a 3-player game says "draws 3".

**New harness `node stucksim.js [players] [games]`** — splits stuck-while-following turns into SHAPE-stuck vs
VALUE-stuck. Built to test Aj's Rogue "slash" idea; see BACKLOG.

### v1.31.2 — REVERT of the MP scaling package: it broke deck balance

**Reverted wholesale**, including the Free-for-All tutorial built on top of it. 3-6 player games are back to
flat 4 shields, draw 2, `SPECIAL_LOSS_MODE='chosen'`, `MILL_SCOPE='targeted'`. **Duels were never affected by
any of it**, in either direction.

**The regression.** 6-player deck spread went **15.5 → 40.7 points**. Pure Wizard won **44.3%** against a fair
share of 16.7%; **Pure Rogue won 1.7%** — a 26x gap between best and worst deck. It was on `main` for a day and
Aj played an evening on it.

**One change caused all of it:** `SPECIAL_LOSS_MODE='all'`. Reverting only that restores the spread to **13.3**
(better than the 15.5 it started at). `all` **multiplies the value of landing a Special by (N-1)**, so at six
players the deck that lands Specials most reliably gains against five people at once and any edge compounds
five-fold. Under `chosen` a Special is worth one shield regardless of table size.

**Why it shipped — a harness bug, not a judgement call.** `mpsim.js` read its ruleset from **positional**
arguments; an edit had dropped the loss-mode argument and left `setSpecialLossMode('chosen')` hardcoded, and the
mill/apex flags read argv positions the commands never filled. **Every arm of both studies ran the identical
config.** "Balance-neutral at 10 runs per arm" was measuring nothing — twice, once for this package and once for
the apex-2 A/B. The printed header said `mill=targeted` throughout and was read past. `mpsim.js` now takes
**named** flags and prints the config it resolved.

**Kept**, none of it dependent on the broken harness: the pacing findings (`rulesim.js` sets flags directly, so
6p length 33 → 15 rounds and jab share 24% → 10% were real), the `optionsim`/`passsim`/`roundsim`/`rulesim`
harnesses and their results, the playtest analysis, and the apex-2 complaint measurement. The scaling flags
survive defaulting **off** so a re-land can be measured one step at a time.

**Scrapped:** the Free-for-All tutorial (Lesson 10) and `lessontest_mp.js` — the lesson taught the reverted
numbers as rules ("everyone has 6 shields and draws 4", "a Special costs every opponent a shield"), so it went
with them rather than being rewritten around a ruleset we no longer trust. `landscapetest.js`'s assertion fix
was re-applied separately: it repaired a **pre-existing** flake, A/B'd against an earlier build, unrelated to
the rules.

**Worth keeping from the wreckage** (PATCHNOTES **0k**): shields should scale **DOWN** with player count, not
up. `max(2, 6 - numPlayers)` gives 4/3/2/2 and median lengths of **11 / 11 / 11 / 17** — flatter than the
reverted package managed — *while keeping* `chosen`, so balance stays near 13.3. With more players you lose
rounds more often, so you need **fewer** shields to die in the same number of rounds. Balance untested. That is
the re-land candidate, and it should go in one flag at a time with a deck-spread run per step.

### ~~v1.31.0~~ (REVERTED in v1.31.2 — broke deck balance) — multiplayer scales with the table: shields, draw, and damage

A 6-player game used to run **33 rounds against a duel's 11**, and the cause was structural: under
`SPECIAL_LOSS_MODE='chosen'` + `MILL_SCOPE='targeted'` a Special win cost the table exactly **one** shield
however many people were sitting at it, so total shields scaled with the player count while damage did not.
Aj's diagnosis in play — *"three rounds in a row throwing jab after jab"* — was a symptom of the length, not an
independent problem.

Four changes, all of which **resolve to today's duel values at 2 players**, so a duel is unchanged:

| | duel (2p) | 3p | 4p | 6p |
| --- | --- | --- | --- | --- |
| shields (`2 + numPlayers`) | **4** (unchanged) | 5 | 6 | 8 |
| per-round draw (`= numPlayers`) | **2** (unchanged) | 3 | 4 | 6 |
| `SPECIAL_LOSS_MODE` | `all` — no-op at 2p | every non-winner loses a shield | | |
| `MILL_SCOPE` | `universal` — no-op at 2p | every non-winner mills | | |

**Measured effect at 6 players:** median length **33 -> 15 rounds**, jab share of all plays **24% -> 10%**,
and relative energy dispersion flattens (the richest-vs-poorest gap falls from 91% of the mean energy pool to
72%, and stops scaling with table size). Options per turn stop collapsing as players are added — 4.5 / 4.1 /
4.3 / 4.4 across 2/3/4/6p, where it used to fall 4.5 / 3.2 / 2.9 / 2.3.

**And it is balance-neutral, settled at 10 runs per arm.** Spread 14.9 ±1.2 -> 15.2 ±0.7 at 6p, 14.2 ±0.9 ->
12.6 ±0.8 at 4p, 13.8 ±0.7 -> 15.6 ±0.9 at 3p — nothing clears 2 s.e., and only 1 of 33 per-deck comparisons
does, which is what chance predicts from 33. So this is a **pure pacing change**: it leaves the deck balance
tuned across many versions alone. (Two earlier 3-run readings claimed a spread tightening at 4p/6p and a
regression at 3p; both were noise. See PATCHNOTES 0g.)

**The pairing choice was a coherence argument, not just a measurement.** `chosen`+`targeted` links punishment to
compensation (hit one, pay that one); `all`+`universal` links them the other way (hit all, pay all). The
mixture Aj spotted — one player hit, everyone paid — leaves the spared players strictly better off than the
struck one on both axes, and was never a design worth shipping.

**One real bug fixed on the way in:** the round banner read `E.DRAW_PER_ROUND`, the flat duel constant, so it
would have announced *"Each player draws 2"* at a 6-player table that actually drew 6. Both that line and the
round-card subtitle now ask `E.drawCountFor(state)`. The how-to-play goal line also hardcoded *"your Rival's 4
shields"* — now scaled, and no longer singular. `E.startShieldsFor(n)` / `E.drawCountFor(st)` are exported
precisely so nothing else reads the constants; two engine tests that hardcoded `4 - 1 = 3` now derive from the
formula.

**It broke the landscape layout, which is exactly why that suite exists.** Scaling shields means a 6-player
game renders **eight** shield pips where there were four — in your own `#handMeta` *and* in every opponent
panel. At the old 11px the row grew and cut the pile's clearance over the hand from ~17px to **3px** at
667x375, failing `landscapetest`'s 8px-margin assertion consistently. Pips are now sized for the 8-pip case
(8x8px + 2px gaps = 78px, and the row shrinks rather than forcing a wrap; 7x9px at the 340px floor). Back to
64/0 across 3 runs. **This is the second time that 8px margin has earned its keep** — it was deliberately set
above zero so an erosion fails outright instead of intermittently.

*Observed once and not reproducing:* `landscapetest`'s "a 10-card hand scrolls" assertion at 568x320 failed in
one run of five and passed in the rest. That case is a **duel**, so it cannot be caused by this change — it is
either pre-existing timing or a genuinely marginal state. Worth watching; do not assume it is this commit.

**Not shipped, still flagged:** the apex-2 rework (`setApexInfinity`, `setApexNoStrip`) — Aj is A/B-ing strip
vs no-strip next. `setShieldsPerPlayer(false)` / `setDrawPerPlayer(false)` restore flat values for sims.

### v1.30.2 — the landscape FLOOR: 568x320 degrades to a scrolling board

Aj dragged a desktop window until landscape broke and said *"but no phone is that thin"* — almost right, and
the exception is worth having in writing. **568x320 is a real device size**: iPhone 5/5s/SE-1st and the iPod
touch 7th gen, which Apple sold until 2022, are all 568x320 in landscape. It broke — the pile drew **34px over
the hand**. **640x360 passes**, so the floor sits between them.

Measured at 568x320: at that width **both `#handMeta` and `#actions` wrap to two rows**, so the hand region
wanted **199px of a 320px viewport** and the play area's `1fr` track collapsed to **32px for 96px of content**.

**Making it genuinely fit would mean hiding real controls** — the ♻ shuffle-pile button, the stat readouts —
which is the wrong trade for a 2016 device. So below **340px** tall the game stops fighting for one screen and
**degrades gracefully instead**: `#board` goes `grid-template-rows:auto auto` with `overflow-y:auto`. Nothing is
ever drawn on top of anything, everything stays reachable by scrolling, and the same fallback covers a desktop
window dragged to **any** absurd height — which is otherwise unbounded, and was exactly what Aj did to find it.

**A second, narrower floor: NARROW and short.** 640x360 was left with **2px** of pile-to-hand clearance, and
every honest way to buy more was measured and rejected — inlining the hint gave a 63px action bar, clipping it
inline still gave 63px (it squeezes the buttons), and `minmax(min-content,1fr)` with a scrolling board put the
action bar **11-117px below the fold on every device**. So `(max-height:364px) and (max-width:720px)` scrolls
too. **800x360 is equally short but WIDE** and fits with 13px to spare, so the rule is narrow-and-short, not
merely short.

Two variability sources are now pinned to a single line each: `#hint` and `#message`. `#message` renders 26px
instead of 13px whenever its text wraps, and the text depends on game state — so a near-zero clearance was an
**intermittent** overlap rather than a stable one. Pinning them also lifted 667x375's clearance from 15px to
**39px**. Full text is always in the battle log.

**The flake, and the lesson.** This assertion failed **twice in 22 runs** while the tightest clearances were
2-8px, and both times the failing line was lost because the run was logged with `tail -1` — the same
truncation mistake twice in one session. After the floor change it has been clean for **16 consecutive runs**.
Absence of a repro is not proof, so the fix is not "it stopped happening": the assertion now demands a **real
8px margin** rather than `>=0`, which converts any future erosion into a deterministic failure. A test that
fails one run in eight trains you to ignore it.

`landscapetest.js` is now **64 assertions** and encodes both contracts. At and below 340px it asserts the
board scrolls, that the hand starts **below** the play area rather than under it, and that the action bar is
reachable — by actually scrolling the board and re-measuring, rather than relaxing the check into something
that would pass on a broken build. Above the floor the original promise stands unchanged: everything on one
screen, no scrolling.

### v1.30.1 — landscape: a phone held sideways was getting the desktop layout in 390px of height

Aj asked whether landscape mobile "won't we just follow the desktop layout?" — it already did, and that was
exactly the bug. The phone branch is gated on `@media (max-width:720px) and (max-height:800px)`, and a phone
in landscape is about **844x390**: it fails that gate on **width**, so it received the full desktop layout
inside 390px of height. Measured, before this change:

| size | what was broken |
| --- | --- |
| 844x390 | header 56 + hand region 213 left the play area **57px** tall — and a card is **66px**, so the pile could not render a single card |
| 667x375 | the hand and the entire action bar sat **136px BELOW the viewport**, unreachable |
| 667x375, 6 players | the opponents strip wrapped to two rows (**172px**) and pushed the action bar **60px** off screen |

**The fix keeps the desktop structure** — three-column board, side panel, hand along the bottom. Landscape did
not become a new layout; height is simply the scarce axis there while width is abundant, so the new block buys
height back from the chrome: slimmer header, tighter gaps, shorter action buttons, a compacted `#handMeta`
(which measured **67px**, the single biggest consumer), and a hand capped by `dvh` so it scrolls instead of
growing. Cards shrink via `--cs`, but `--pm` is raised to compensate so the **pile stays near full size** —
that is what you read mid-play, and it was the part with no room at all.

After: the play area goes **57px → 140px** at 844x390, and on the common iPhone landscape sizes the pile is
**67px**, *larger* than the 55px phone-portrait baseline — the same "cards look smol" reasoning as the desktop
steps, applied to the axis that is actually free here.

Three bands, because the devices genuinely differ:

- `(orientation:landscape) and (max-height:520px)` — the shared reclaim.
- `+ (min-height:380px)` — the roomier 844x390 / 932x430 phones get bigger cards (`--cs:.9 --pm:1.35`).
- `+ (max-width:720px)` — a small phone sideways (667x375 SE). Below 721px the action bar loses its desktop
  spacer and wraps, so the buttons shrink further; the pile drops to its unmultiplied size; and **with six
  players the opponent panels become a single row of name + shields**, the stat line hidden. That last one is
  the hardest case in the game — the opponents strip left the play-area track 49px for 96px of content — and
  nothing else was big enough to cut. The detail is still one tap away, since tapping a panel expands it.

Ordering matters: the landscape block comes **after** the phone branch, because at 667x375 both match and this
one must win. It also replaces the phone branch's `minmax(min-content,1fr)` with `minmax(0,1fr)` — that
`min-content` was what let the hand force its own minimum and push the action bar off screen.

**New suite: `node landscapetest.js` (40 assertions).** Six device/player combinations, each measured in its
**worst** state — battle log open, hand stuffed to `MAX_HAND`, a 5-card special staged — asserting the action
bar is on screen, the pile clears the hand, the play area can fit a pile card, a 5-card special does not wrap,
and an over-full hand scrolls. It also carries the **negative** half of the spec: portrait 390x780, iPad
landscape 1024x768 (landscape but *not* short) and desktop 1400x1000 must all be **unaffected**. That negative
half caught my own bad assertion immediately — I asserted a literal 66px card on desktop, which correctly
serves 78px via the `min-width:1200px` step.

### v1.30.0 — AI personas: every opponent has a name and a temper

Difficulty used to be the whole personality of an opponent: five tiers, and within a tier every AI played
identically. Now each AI seat draws a **persona** at game start — a name plus a targeting style — revealed
**before** the fight, in the header matchup tag and the opening log line. Six per tier (eight Minions), so a
full 6-player table never repeats itself and the cast still cycles between games.

| tier | cast |
| --- | --- |
| Minion | Stuart, Bob, Kevin, Dave, Phil, Tim, Carl, Jorge |
| Squire | Griflet, Beaumains, Owain, Lucan, Sagramore, Dinadan |
| Fighter | Lefty, Bruiser, Slugger, Tank, Duke, Knuckles |
| Knight | Lancelot, Galahad, Gawain, Percival, Bedivere, Bors |
| Demon Lord | Etna, Laharl, Flonne, Rozalin, Adell, Vyers |

**"Recruit" is now displayed as "Squire"** so the ladder reads as a progression — Minion → Squire → Fighter →
Knight → Demon Lord, a squire being what becomes a knight. **The internal key is still `recruit`**: `ai.js`
branches on it and `cmf_setup_v1` stores it, so renaming the key would have silently invalidated every player's
remembered difficulty. Display-only rename.

**Personas vary STYLE, never STRENGTH.** If one persona in a tier won more than its tier-mates, choosing an
opponent would be a hidden difficulty slider and the tier would stop meaning anything. Three knobs, all in
`styleTarget` in `ai.js`: `grudge` 0..1 (how reliably it answers whoever last struck it), `focus`
(`weakest`/`leader`/`random` — where it looks when un-provoked), and `holds` (never lets a grudge go).

**New harness: `node personasim.js [games] [tier]`.** Seats every persona of one tier with the same deck,
rotating seat order to cancel turn-order bias, and prints win% per persona plus the spread. It has a
**`control`** mode (`node personasim.js 150 demon control`) that seats six *identical* personas — whatever
spread that reports is the **noise floor**, currently **2.8 points at 900 games**. Never read a real spread as
meaningful unless it clears the control. All five tiers now sit at or under it: Fighter 1.3, Minion 2.8,
Knight 3.0, Demon Lord 3.3, Squire 3.6.

**It caught a real bug immediately, and the bug was a design error.** Flonne, Galahad and Adell originally had
a **`nice`** flag for Axelrod's "never defect first". Measured, `nice` was worth **+6 points** — replicated
tightly against duplicated control configs — because it bundled two unrelated things: a personality (*never
open hostilities*) and a **competence upgrade** (*preferentially hit whoever is actually attacking*). Only the
nice personas got the upgrade, so "nice" was quietly the strong setting.

The deeper problem is that **"never defect first" is unrepresentable in this game**: winning a round *forces*
you to strike someone, so no persona can decline to open hostilities. The faithful analogue is **TIT FOR TAT**
— answer every strike, carry nothing forward — which is `grudge:1.00` with no `holds`, and is what Flonne and
Galahad now are. The competence half became **shared by every persona**, so it cancels instead of favouring
three of them. There is deliberately no `nice` knob any more; the comment in `ai.js` says why.

Also of note: `focus` and `grudge` were both measured **flat inside noise** once the finish rule
(`FINISH_AT` — nobody above Minion ignores a nearly-dead player) was shared. Minions remain the one tier that
will pass up a handed kill.

Personas are **solo/local only** — and worth being precise about why: **netplay has no AI players at all.**
Every opponent seat is set to `'remote'` when the host starts (`seatCtrl[s2]='remote'`). The
`seatDiffs[s]='fighter'` in that path is only a tier fallback so the round-win shield-target chooser has
something to read; it is a formula input, not a player. And a disconnect does not become an AI — the seat is
held for a grace period and then **concedes** (`onOpponentConcede`), with a later reconnect arriving as a
spectator. **Aj: not now** (2026-08-23) — a dropped seat conceding is the wanted behaviour, and netplay AI
is worth revisiting only **if players actually ask for it**, not on our own initiative. So personas are
solo/local by design rather than by omission. If it ever does happen, the plumbing is already most of the way
there (`AI.drawPersonas` takes the `seatDiffs` array, `AI.setStyles` is keyed by absolute seat); the missing
piece is **broadcasting the drawn names** in the existing `t:'setup'` names table, host-side and as absolute
seats, or seat 2 would be "Etna" on the host and "Laharl" on a client. The tutorial also keeps a plain "Rival" so the lesson stays about the rules.

**A bug from this, caught by `nettest_names` (4 pass / 3 FAIL) and worth remembering:** the guard against
leaking personas into netplay called a `clearPersonas()` that also wiped `seatNames` — in the host's start
path, where that table **already holds the joined players' real names**. Online players would have lost their
names. Split into `clearPersonaStyles()` (styles only, for netplay) and `clearPersonas()` (also resets names to
just `myName`, for the tutorial). The lesson is that "personas are solo-only, so netplay is unaffected" was
exactly the reasoning that made the bug invisible — the shared state was the *name table*, not the personas.

`mptest.js` grew 8 assertions for this (draw, distinctness, correct tier, both reveal sites, and the naming
funnel), and 4 existing ones were rewritten: they hardcoded `"P2"`/`"P3"` and now resolve the seat's name from
the page via a new `__solo.logName`/`__solo.persona` hook — so they run with personas **live** rather than
switched off, each paired with a negative on a *different* seat's name so it cannot pass vacuously.

### v1.29.8 — player names
Aj's idea from the D1 report, and it landed as predicted: **one function**. Every naming site already funnelled through `seatName`/`logName`, so only those two had to answer differently — panels, log lines, the ceremony banner and the announcements all picked names up for free. Doing the naming cleanup *before* this feature is the whole reason it was small.
- **Store:** `cmf_name_v1` in localStorage, through `cleanName()` — caps at 14 chars, strips markup characters. A **"Your name"** field on the New Duel screen saves as you type.
- **Netplay:** the name rides on the existing `{t:'join'}` message; the host **sanitises** it (untrusted client text), adds its own, and rebroadcasts the table with `{t:'setup'}`. No new message type.
- **The rotation catch:** a client's mirror is seat-**rotated**, so the host's table arrives in absolute seats. The client rotates it into its local frame **on arrival**, which means nothing downstream needs rotation awareness — the alternative was every call site knowing about it.
- **A name is for other people.** You always read as "You" in your own frame; your name is what *others* see. Unnamed seats keep `P2`/`P3`/`Rival` exactly as before, so nothing changes if you never set one.
- **Tests:** `mptest` +7 (names reach panels *and* the ceremony banner through the one funnel; you stay "You" to yourself; an unnamed seat keeps its placeholder; a name containing markup is sanitised, not rendered — names are only the second player-typed content in the game after deck names). **NEW `nettest_names.js`** (8) drives the wire both ways: the client sees *"Aj played …"*, the host sees *"Bea played …"*, each reads its own play as *"You played"*.
- **Your own name is visible to you, and the strip is how you change it** (Aj): the board strip showed a bare `You`, so the one person who *cannot* see their name in the log — you always read as "You" there — could not see it at all. It now reads **"Aj (You)"** when set, and clicking it opens a small rename editor (Save / Clear / Enter). The duel's rival label shows their name too. `mptest` +5, including that a typed name with markup is sanitised and capped (`<b>x</b>0123456789abcdef` → `bxb0123456789a`).
- **Also made the ceremony test deterministic.** It had been playing random games until a shield-loss ceremony happened — flaky (~1 run in 3 never reached one, failing 2 assertions) *and* uninformative when it did. `buildPreDrawBeats` is a pure function of the round result, so it is now exposed on the `?dbgsolo=1` hook and asserted directly across four cases, **both directions**: P2-beating-P3 names P3, *and* a genuine "You" case still says "You". A one-directional check would pass on code that says nothing at all. Stable at 3×.


### v1.29.7 — bigger cards on big screens (playtester: "the cards look smol")
Measured before changing anything, and the report was fair: at **1920×1080** — the most common large screen — a hand card was **65×94px, just 3.4% of the width**, with ~970px of board above it mostly empty. The cause was a gap in the steps: **1920 falls just under the old 2000px breakpoint**, so it got the same `--cs:1.42` as a 1600px screen.
- Steps are now **denser and gated on `min-height` as well as `min-width`**, so a wide-but-*short* window (a laptop, a half-height window) never gets cards too tall for its hand row: `1200→1.18`, `1440+800h→1.32`, `1600+860h→1.5`, `1800+900h→1.68`, `2200+1000h→1.9`, `2560+1200h→2.1`.
- Measured card width, before → after: **1440×900** 54→**61** · **1600×900** 65→**69** · **1907×938** (the reporter's size) 65→**77** · **1920×1080** 65→**77** · **2560×1440** 87→**97**. **1366×768 is deliberately unchanged** at 54px — it is short, so growing the cards there would squeeze the hand row.
- **Overflow checked, not assumed:** with a **full 10-card hand** (`MAX_HAND`) at eight viewport sizes, verified no hand overflow, no card past the viewport, no horizontal page scroll, and the action bar still on screen. Phones are untouched (every new step needs ≥1440px width); `viewtest` still 10/0 at 390×780.
- **The PILE was the real offender** (Aj: *"more than the hand, the cards in the center of the play area are small too… those only go up to a max of 5 cards for specials"* — correct on both counts). The pile rendered through `.card.sm` at a **38×55 base — smaller than the hand's 46×66** — so the focal point was the *smallest* thing on screen. It now has its own multiplier **`--pm`** on top of `--cs`, because it never shows more than 5 cards (a straight or a full house) and therefore has room the hand does not.
  - Measured pile-card width, before → after: **1366×768** 45→**72** · **1440×900** 45→**80** · **1907×938** 54→**112** · **1920×1080** 54→**112** · **2560×1440** 72→**140**. The pile is now comfortably larger than the hand (112 vs 77 at 1920), which is the right relationship for the thing you are reading.
  - **Phones are byte-identical to before:** `--pm` stays exactly `1` below 560px and the 38×55 base is unchanged, so nothing shifts on a phone. A first attempt raised the *base* to 46×66 and cost vertical space on a 360×640 screen — caught by measurement, reverted.
- Verified with a **5-card pile + a full 10-card hand** across ten viewports (360×640 → 2560×1440): no card past the viewport, no horizontal page scroll, hand fully visible, action bar on screen.
- **Parked, pre-existing (NOT from this change):** at **360×640** with a 5-card pile *and* a 10-card hand, the action bar is pushed off screen. An A/B confirmed `main` behaves identically — the smallest phone is simply out of vertical room in that worst case. Worth its own look with the landscape/short-viewport work.
- **Then the bigger pile started colliding with the "last played" stash** (Aj: *"can we tweak it so they don't overlap when the battle log is open? maybe don't change the size, just shift the placement"* — exactly right, and placement is the fix). `#beaten` is `position:absolute; left:12px; top:50%`, while `#pile` centres in the **whole** play area — so as the pile grew it reached into the left rail, worst when the log is open and the area is narrow.
  - Moving the stash vertically is not safe: in a duel the left rail is fully occupied — rival forms (top), stash (middle), your forms (bottom). So the pile now **reserves the rail** instead: `padding-left:186px; padding-right:28px` on ≥1200px, and it centres in the clear band.
  - **Asymmetric on purpose.** A symmetric reservation squeezed the band enough to *wrap* the 5-card pile at 1440×900 with the log open. Measured: the right rail's equip zones sit top/bottom and never met the vertically-centred pile — 267px+ of slack — so only the left needs reserving.
  - **Verified across seven widths** (1280 → 2560), log **open and closed**: overlap **0px everywhere**, no wrap anywhere, right-rail clearance always positive (tightest 22px at 1280×720 with the log open).
  - Two false positives worth knowing if you measure this area again: the pile **fans cards with transforms**, so `scrollWidth > clientWidth` reads as overflow at every size on every build, and comparing card `top`s reads as wrapping. Test wrapping by checking each card's `left` against its predecessor's.
- **Then two centring bugs, both mine, both caught by Aj in a minute:** the rail reservation was done with
  `padding`, which shifts *content* rather than narrowing the *box* — so the `"Fight is open — lead a card"`
  line and then **every short pile** (1-3 cards) sat right of its centred `NEW FIGHT` label.
  - **Correct fix:** `max-width:calc(100% - 260px); margin-inline:auto` on ≥1200px. The box is narrower *and*
    centred, so cards stay on the label's axis and still cannot reach the rails.
  - To make that reservation affordable, the stash is slimmed to **3 tiny cards per row** (`max-width:99px`)
    instead of 5 across, and the pile scale eases to `--pm:1.35` in the **1200-1439** band — the tightest case,
    where the log open leaves only ~640px and a 5-card pile at 1.6 wrapped.
  - **Verified 28 cases:** seven widths (1280 → 2560) × log open/closed × 1-card and 5-card piles — centred to
    within 3px, zero overlap, no wrapping anywhere. `mptest.js` now asserts centring, overlap and wrap at both
    card counts, because my earlier assertion enforced the *in-flow* behaviour that caused this.
- **Your play now lingers before an opponent answers** (Aj: *"my play also gets clobbered right away by ai, i know they think fast… but can my play just linger a bit?"*). The duel driver opened with a 650ms pause; the free-for-all driver had **none** and stepped straight into the first AI seat. Both now share one named constant, **`PLAY_HOLD = 1000`** (60ms under reduced motion) via `playHold()`, so they cannot drift apart the way the presentation layer did. Measured after: first opponent line **1051ms** (duel) / **1039ms** (3-player) after your Fight.
- Still open if it is *still* not enough: cards are ~4% of screen **width** even now, because the board itself is mostly empty on a big monitor. Growing them further fights the layout, so the better lever is a **card-size preference in ⚙️ Settings** (the modal already persists prefs like detailed energy pulses) — per-person perception is exactly what a setting is for.


### v1.29.6 — D1 + C2: round results name the real seats (and two bugs found inside them)
The naming pass from [`MP-PARITY-AUDIT.md`](MP-PARITY-AUDIT.md), from Aj's 3-Rider log. **It needed an engine change to be possible at all:** the round result recorded *that* a shield was stripped but never *whose*, so the UI genuinely could not do better than `'a rival'`.
- **`engine.js` now records `result.struck`** at the strip site (plus `result.spared` when a Leyline blanks it). Verified across 60 AI games: **592 strips, 592 carrying the seat.** Every announcement then routes through the existing `logName(seat)`.
- **D1's real bug:** `logCatchUp` derived the loser as `w===YOU?RIVAL:YOU`, so **when P2 beat P3 it told YOU that you lost a shield.** Gone — the broken-shield line and the catch-up mill line now name each affected seat from `res.struck` / `res.milled`.
- **A second bug found in the same function:** a Special that stripped nothing was announced as *"won the round of Jabs"*, because the branch keyed on `res.shieldStripped`. Aj's log round 8 shows it — *"You strike P3's shield with a Special."* then *"You won the round of Jabs."* It now reads **"won with a Full House — no shield was lost."**
- **"Round undefined" solved.** `resolveRoundWin` returns early with `needsLossTarget` and **no `newRound`** (the round is not finished yet), so any path rendering the round card from that interim result printed it. `logRoundDraw` now falls back to `state.round`.
- **The round line is Aj's wording:** **"Round 4 begins. Each player draws 2."** (the count from `DRAW_PER_ROUND`, not a hardcoded "a card"), replacing *"You draw 2, Rival draws 2"* — unphrasable for 3-6 seats, and it named the wrong player in a free-for-all. Your own fizzle warning still follows. Netplay clients get the same neutral line instead of a separate one.
- **C2:** `centerShieldFX` now uses `logName(player)`, so a broken P3 shield no longer reads *"Rival · shield down"*.
- `mptest.js` +8 assertions here, all negative-space checks (no `'a rival'`, no `"Rival's hand"`, no `Round undefined`, no `You draw N, Rival draws N`) plus the neutral round line and "every shield-loss line names a seat". Tested against a **naturally played** 3-player round — forcing a pile mid-round leaves the driver mid-cycle and fails to resolve **identically on `main`**, so that staging was an artifact, not a regression.
- This completes every finding in the audit (A1, A2, A3, B1, C1, C2, D1). **Player names are now a one-function change**, which was the point of routing everything through `logName`.
### v1.29.5 — the Respond? modal says who is being targeted, and targeting confirms before it fires
Two playtest points from Aj on the same screen.
- **"who or what is being targetted? why should i counter it? this lacks some vital information."** The modal said only *"Telekinesis is on the stack"*. Both missing facts were already in `st.pending` — `.p` (the caster) and `.opts` (the target) — the UI simply never read them. Exported the engine's **`effectTarget`** (+ `HOSTILE_SINGLE`) and the modal now leads with **"P3 cast Telekinesis at YOU."**, with the target in red when it is you. When it is *not* aimed at you it says so outright — *"It does not target you — countering only helps P2."* — which is the free-for-all case where the old wording was actively misleading.
- **"when a human player clicks a target… the effects immediately fire off. i think we should confirm it first… always err on the side of confirming first."** Targeting is now **two steps**: tapping a rival only **stages** it (the panel gets a red **🎯 aimed** marker) and the context button becomes **⚡ Activate** to confirm. `Clear` abandons it. Labels walk you through it: `🎯 Choose target` → `🎯 Pick a target` → `⚡ Activate`.
- **The invariant is asserted, since it is the easy thing to get subtly wrong:** after staging, energy is **unchanged** and the target's hand is **untouched**; after `Clear`, still unchanged; only on confirm does energy drop and the effect resolve — **against the seat you aimed at**, not the default next seat. `mptest.js` 31 → **42 assertions**.
- **Two netplay suites needed updating, not fixing.** `nettest_target3` and `nettest_discard` clicked a target and expected instant resolution; they now press the confirm. This is the pattern CLAUDE.md warns about — *ask first whether the product moved and the test didn't* — except this time the product moved on purpose. (These are the same two suites that rotted against v1.24.0's original target-first change.)


### v1.29.4 — the opponent-zone popover no longer flattens the log and description box
Aj, immediately on trying v1.29.2: *"how is opening the player equipments flattening the description box and battle log?"* — a regression from B1, and a nice illustration of why layout needs measuring rather than eyeballing.
- **Cause:** the expanded zones were **in flow** inside the panel. `#opponents` is `flex:0 0 auto` inside `<main>` while `#board` is `flex:1 1 auto; min-height:0`, so every pixel the strip gained came **straight out of the board** — the battle log and the description box shrank by exactly that much.
- **Fix:** the zones are now a **popover** — `position:absolute; top:calc(100% + 4px)` under their panel, with its own border and shadow, so the strip's height never changes. Tapping outside closes it (targeting-forced panels are left alone).
- **Measured, and now asserted:** `#board`, `#logWrap` and `#side` heights are byte-identical before and after opening (744 / 482 / 482), and the popover must compute to `position:absolute`. The old "box stays inside the panel border" assertion was **deliberately replaced** — it enforced the in-flow behaviour that caused this — with "the popover hangs under its own panel, fully on screen".
- `mptest.js` 29 → **31 assertions**.

### v1.29.3 — C1: opponents' turns are actually presented in a free-for-all
The presentation half of [`MP-PARITY-AUDIT.md`](MP-PARITY-AUDIT.md), and the fix for Aj's first report — *"the animation doesn't let my play breathe before the AI plays… the text beneath the play still says i played something… i can see my effects fine, but i'm not seeing the rival's."* All three were one cause.
- **Cause:** `runOpponents` did `AI.takeTurn` → `logOppPlays` → `render()` → `setTimeout(step, 460)`. It **logged and rendered, and nothing else** — no dwell, no `flashArt`/`revealEffect`, no `setMessage`, no `bumpEffect`. Every bit of the v1.25.0/v1.26.0 readability work (longer rival dwells, the ⏩ QUICK cue, the two-phase art flash) had landed on the **2-player path only**.
- **Extracted rather than copied.** The duel's inline beat builder is now **`buildOppBeats(log, seat)`**, shared by `runRival` and `runOpponents`. Copying it is precisely how the free-for-all lost the presentation layer in the first place, so the audit's recommendation was to extract — done, with every hardcoded `'Rival'`/`RIVAL` in it replaced by `logName(seat)` / `say(seat, …)` / `bumpEffect(seat, …)`.
- **`logOppPlays` is deleted**, not left beside it: a second, log-only path is exactly what would drift again. A tombstone comment points at `buildOppBeats`.
- The N-player driver now runs the beats through the same `playBeats` the duel uses, with the round-resolution branches moved **inside** the completion callback so a ceremony can never pre-empt an unplayed beat.
- **`mptest.js` 24 → 29 assertions**, including the one that matters for the report: after your own play, **an opponent's turn overwrites the centre caption with their name** — it used to sit there reading "You played…" under their card.
- Verified the extraction did not disturb the duel: `browsertest` PASS (12 duels), 190 + 28 unit, mptest 29/0.


### v1.29.2 — B1: opponents' Equipment and Forms are reachable in a free-for-all
The reachability half of [`MP-PARITY-AUDIT.md`](MP-PARITY-AUDIT.md). Aj's report: with **Forceful Strip** active the board said *"Tap an Equipment to remove"* but P3's **Caltrops** was unclickable, so the cast could not be completed. The engine had always offered it — `E.removeTargets` returns every seat's equipment — the UI simply had nothing to tap.
- **Cause:** in MP, `#rivalEquipZone` / `#rivalFormZone` are `display:none` and opponents' gear was reduced to plain `<span>` labels in `.oppGear`. The duel builds real zones via `renderEquipZone` / `renderFormsZone`, and those are what carry `.targetable` and the `doRemove()` handlers.
- **Fixed as Aj specified:** tapping a panel's **gear line expands that seat's real zones**, rendered by the *same* two functions the duel uses — so targeting comes along for free rather than being reimplemented. Panels stay collapsed by default (the strip stays compact) and **force-open while a removal is targeting**, so a target can never hide behind a tap.
- **Both renderers now take a `seat`** rather than a `mine` boolean. That also fixes a latent bug: the equipment-FX key was `'rival'` for *every* opponent, so P2's and P3's counter/decay flashes shared one namespace and collided.
- **This unlocks Sabotage too, not just equipment** — `removeTargets` adds zone Rides/Forms when the effect is boosted, and those were equally unreachable.
- **Two layout traps met on the way:** `.equipZone`/`.formZone` are `position:absolute` in the duel layout (they float over the board), so inside a panel they escaped its border until pinned back into normal flow — containment is now a **measured** assertion, not an eyeballed one, after the pile-viewer button-bleed lesson. And the gear tap needs `stopPropagation()` or it doubles as a loss/target seat pick.
- **`mptest.js` 13 → 24 assertions:** the gear line is tappable, zones start collapsed, tapping opens a real `buildEqBox` (not a label) plus the Forms zone, the tap is not a seat pick, the box stays inside the panel border, targeting force-opens the panels, the Caltrops is `.targetable`, and tapping it **actually removes it**.


### v1.29.1 — free-for-all parity A1/A2, and the AI could never use a Form-granted Quick (A3)
The first two gameplay findings from [`MP-PARITY-AUDIT.md`](MP-PARITY-AUDIT.md), plus a third that surfaced while fixing them and matters more than either.
- **A1 — the pre-fight window is offered to whichever seat holds it.** `rivalPreFightThen` gated on `pf.q!==RIVAL`, so from your turn a window belonging to any other seat was silently dropped. The holder is `nextPlayer(st.turn)`, so seat 2 comes up most obviously **once P2 is eliminated** — exactly the board in Aj's report (P2 read `OUT`). Now uses `pf.q`, `diffOf(q)` and `logName(q)`, and defers to netplay for human holders. *Scope correction:* `ai.js` already handled its own turns seat-generically, so this only ever affected **your** fight.
- **A2 — response windows now drain for any AI seat.** `settleWindows` looped on `respondFor===RIVAL` while the other branch handled `respondFor===YOU`, so a window owed to seat 2+ was handled by **neither**: that seat never answered and the turn parked. Verified at engine level that `respondFor` really does become 2 (seat 0 activating `6♦` with only seat 2 able to answer). The loop is now seat-generic, skips human seats (netplay parks those), and the ⏩ cue names the seat that actually answered instead of always "Rival".
- **A3 — the AI has NEVER sprung Back Stab, in any mode.** `lockoutQuick`, `bestQuick` and the immunity filter all read **`E.effectOf`** — the *base* effect — but `quick` can be **granted by a Form**: Back Stab only under Hermes Super, Sanctuary under Hector, Armor Piercing under Hippolyta. Confirmed `effectOf(10♠).quick === false` vs `effectFor(st,2,10♠).quick === true`. All three now read `effectFor`. **This is why A1 went unnoticed** — the seat gate only ever blocked a play the AI was never going to make.
- **Balance measured**, since A3 strengthens the AI (`analysis.js 40 on x knight`, before/after): Back Stab **36.3% → 39.9%** win rate, still **below 50%** — it goes from unusable to merely weak. Quick-response volume flat (1216 → 1211), as expected since Form-granted *response* Quicks are rare. Other cards moved 1-3 points either way, which is noise at that sample. Caveat: `analysis.js` is AI-vs-AI and **symmetric**, so it cannot measure what a human will feel — Knight/Demon locking *you* out of a lead.
- **A scare that was entirely tooling, recorded so it is not re-chased:** after this change `browsertest` appeared to hang with a headless browser at 28% CPU, which looked exactly like the stronger AI locking the duel into a loop. It was not. An A/B of the builds (same probe, 2 runs each) stalled **identically on the pre-change `main`**, so the stall was my probe clicking every 120ms regardless of the `busy` flag; and `browsertest`'s real error was `Target page… has been closed` — my own `pkill -f headless_shell` cleanup killing its page from a concurrent command. Run clean it passes: **12 duels, every one reaching a valid win overlay**. `test.js`'s 300-game AI-vs-AI termination smoke also passes, so the engine terminates fine under the stronger AI.
- **NEW `code/mptest.js`** (13 assertions, local 3-player): P3 in Super really is the pre-fight holder once P2 is out, P3 springs Back Stab and you are genuinely locked, the seat-2 response window drains and the board does not stall, and no opponent action is ever credited to "Rival" in a free-for-all. **Neither A1 nor A2 nor A3 had any coverage before** — which is exactly why all three survived.


### v1.29.0 — reorderable energy pile: two pile viewers, ⤒ Promote to top, public log, Advanced lesson 10
The backlog's energy-reorder item, built to [`ENERGY-REORDER-DESIGN.md`](ENERGY-REORDER-DESIGN.md) with all six of Aj's decisions. **Read the design doc's measured-payoff section first**: only **39%** of games ever reshuffle (`node recyclesim.js`), so this is a long-game / reclaim-deck lever, deliberately shipped because it carries **zero balance risk** — Decision 3 kept `payEnergy` untouched.
- **engine**: `reorderEnergy(st, p, ids)` (ids must be a true permutation — a bad order is an attempt to conjure or delete energy) and `promoteEnergy(st, p, cardId)`. `payEnergy` was already order-driven, so **no cost logic changed at all**. Guards: your turn, and **not** while `pending`/`respondFor` is set. **+18 assertions (172 → 190)**, including the two that matter — a generic cost spends off the front in your order, and a coloured pip takes the earliest card *of that suit*, skipping a promotion.
- **NEW: two pile viewers.** ⚡ and ♻ in your meta row are now buttons opening one modal with two views and **← / →** between them. Energy is ordered and orderable; **shuffle is read-only** and says outright that its reshuffle is random. Nothing in the game could show you a pile before this.
- **The caveat is labelled, not buried**: position 1 is tagged **spent next**, and the first card of each suit is tagged **first ♥ / first ♦** — because a coloured cost reaches past a promotion. Without the tag that reads as the game ignoring you.
- **Tap a card → 🔍 View + ⤒ Promote to top.** View reuses `cardTextHTML`, so boosted Form/Super lines come along and there is no second card renderer. Repeated promotes are a **stack push** — last promoted is spent first.
- **Netplay**: new `{op:'reorderEnergy'}` intent in both host paths, host **re-validates** the permutation (the deck-string lesson from v1.28.0). Four rogue payloads leave the pile byte-identical.
- **Decision 6 needed a channel that did not exist.** Netplay's message types were all state or control, so *a client had never seen the host's log lines for anything*. Added a narrow **`t:'log'` broadcast** so a reorder is genuinely public on every board. First use; other narration could migrate onto it later. Lines are built from rank/suit only, never client text.
- **NEW Advanced lesson 10, "Energy Order"** — the second screen-subject lesson, with its own rig seeding a readable pile. Covers the three things a player can get wrong: the coloured-cost caveat, that the shuffle pile is random and unorderable, and that the log is public.
- **New suites**: `piletest.js` (21), `nettest_energy.js` (10), `lessontest_energy.js` (14).

### Harness note — two suites are position-dependent in a long sweep (not a regression)
`nettest_full` and `nettest_log` pass individually (5/0 in ~3s, 13/0 in ~5s) but fail late in a full 24-suite serial sweep — `nettest_full` times out at >240s, `nettest_log` drops ~4 timing assertions. **A/B of the actual builds settled that it is not the v1.29.1 change**: four runs each, pre-migration 4/4 and post-migration 4/4, all ~3s. Three explanations were tried and all three were wrong — CPU contention (reproduces with nothing else running), orphaned ports from killed runs (reproduces on a clean sweep), and stale headless browsers (reaping between suites changes nothing). Cause still unisolated; **verify any sweep failure by running that suite alone.** Separately: three suites really do share port 8303 (`concede3`/`elim3`/`energy`) and every suite awaits `srv.listen` with no error handler, so a genuine collision hangs silently instead of failing.

### v1.28.2 — netplay's battle log was EMPTY for every client (public narration)
A standalone netplay bug, found while designing the energy-reorder feature but fixed on its own: netplay had **no host→client log channel at all**. Every message type was state (`mirror`/`setup`) or control (`join`/`welcome`/`err`/`peer`/`ceremony`), so the host narrated the whole game to *itself* and **every other player sat in front of a blank battle log for the entire match — including their own moves.** Verified before touching anything: the host log had 4 lines ending in `Rival played a Jab - 6♣`; the client's had **zero**.
- **Why it was never a simple broadcast:** narration is **reader-relative**. The same event is "You played" to the actor and "Rival played" to everyone else, and the host's strings are baked in its own frame — forwarding them verbatim would tell a client *"You played"* about the host's card. That is presumably why nobody just piped the log across.
- **The fix is a template channel.** New top-level **`say(actor, tpl, cls)`**: the template carries a `{who}` placeholder instead of a name; it renders locally through **`logName`** (yourself → "You", a duel opponent → **"Rival"** rather than the raw `P2` that `seatName` gives, otherwise `P<n>`), and as host it broadcasts `{t:'log', actor, tpl, cls}`. Each client resolves `{who}` in **its own rotated frame**. One message, no per-recipient string building.
- **Migrated 24 narration sites** across all three paths — the shared local path (your plays, techniques, shield strikes, counters, phantasms, equipment counters, letting a Quick resolve), the 2-player netplay handler, and the N-player handler (plays, passes, techniques, guards, discards, pre-fight passes, lockouts, concedes).
- **Two frame-specific lines handled separately** rather than forced into a template: a client now writes its **own** opening line when it learns the decks (the host's *"you play X vs Rival Y"* is unshareable), and the round line broadcasts a **neutral** `Round N begins.` because per-seat draw counts differ by reader.
- **NEW `code/nettest_log.js`** (13 assertions): the host's play reads "You played" on the host and **"Rival played" on the client, describing the same card**; the client's own play reads "You played" for it and "Rival played" for the host; the client's log is genuinely populated; no unresolved `{who}` ever leaks; and the client opens with its own duel line, never the host-framed one.
- Two test traps worth recording, since both look exactly like product bugs: a client's mirror is **seat-rotated** so its own turn is `turn===0`, not its absolute seat; and round 1 is jabs-only *and must beat the pile*, so a test has to pick a **legal** card rather than the first in hand.


### v1.28.1 — Advanced lesson 9: Custom Decks (+ build.js now refuses to ship a syntax error)
The follow-up the deck-builder backlog asked for. Aj, on review: *"we should add the related tutorial."*
- **NEW lesson — Advanced #9, "Custom Decks"** (6 steps). It is the **only lesson whose subject is a screen rather than a play**, and it turned out the existing machinery already supports that: `#tutPanel` is `z-index:80` against the overlay's `30`, and `.tut-spot` is `82`, so the coach panel stays readable **on top of** the builder modal and can spotlight controls **inside** it. The rigged duel behind is just scenery.
- Flow: parts explained against your own deck pile → the presets re-read as part-mixes (Pure = 4 of one, Sage = 2+2, Full Set = 1 of each) → the builder opens → **gated**: give Cleric 2 parts (one is not enough; the gate holds) → **gated**: spend the last two, 4/4 or no save → **gated**: name it and save → closing step on where it now appears, including that only the *mix* travels online so an opponent's host builds it correctly without knowing the name.
- **The deck the player builds is real** and stays in their store — the lesson's artifact is a deck they own. Naming copy leans into Aj's framing: the deck sits under **Your class** beside the Wizard and the Rogue, so name it like **a class of your own** ("Twin Cleric", "Battle Priest"). That also settles the earlier open question — the "Your class" label **stays**.
- Two hooks were needed: `TUT.note('deckparts', …)` on a stepper change and `TUT.note('decksaved', …)` on save. The **duplicate refusal also notes** `{duplicate:true}`, so a player who happens to already own that exact mix still advances rather than stalling on an error they cannot clear.
- Saving does not hide the modal (`openDeckBuilder`'s `finish()` only hands the key back), so the lesson **re-opens the builder with a `force` flag** after a save — otherwise the closing step pointed at a "Your saved decks" list still showing the pre-save state.
- **NEW `code/lessontest.js`** (19 assertions): the hub row, the builder opening over the duel, the coach's stacking, spotlighting a control inside the modal, both stepper gates *including that one Cleric part is not enough*, the save gate, the refreshed saved list, completion, the lesson-done flag, and that the built deck is really persisted.

**`build.js` now parses every inlined `<script>` before writing** — and this is why. Adding the lesson to the `LESSONS` array put a new entry after the last element, which had **no trailing comma**; the whole 334KB script then failed to parse and the page came up dead. `build.js` only ever checked that placeholders were replaced, so it shipped that happily, and the UI test reported a scatter of unrelated failures (plus one assertion that *passed* on a broken page, because `document.body.textContent` includes the text of inline `<script>` elements — beware that in tests). The gate refuses to write and names the offending line; verified by re-introducing the exact bug.

### v1.28.0 — custom decks online (the netplay half)
The deck builder now works over the wire, and the design choice from v1.27.0 paid off: because a deck's value everywhere is already its self-describing composition key, the lobby needed **no new message and no protocol change** — the existing `{t:'join', deck:'…'}` string carries the composition, and the host builds from it.
- **Un-gated the lobby pickers.** Both netplay lobbies (BroadcastChannel and WebRTC) now render the full deck list, so saved decks and **"✏️ Custom deck…"** are available online. Building one from the lobby re-renders it via `renderNet()` with the new deck selected. `deckOptionsHTML` lost its `{custom:false}` escape hatch — nothing gates it any more, so the parameter went too rather than rotting.
- **The name is genuinely cosmetic, as designed.** A client picking its saved "Aj Special" gets the deck labelled by that name on its own board; the host — which has never heard of it — shows **"Custom · 1♦ 2♥ 1♣"**, describing what it was handed. Neither side ever shows the player a raw `custom:…` key.
- **Hardened the host's intake (a real pre-existing hole).** The join handler did `seatDeckMap[jseat]=m.deck||'full'` — the client's string went in **unvalidated**, and an unknown key fell through `buildDeck()`'s `|| makeDeck()` to a silent Full Set. It now runs `validDeck()` at intake, so a garbage or hostile value is rejected where it arrives instead of quietly becoming a different deck several layers down. This mattered before custom decks too; compositions just made it worth fixing.
- **NEW `?dbg=1` hook `__cmf.comp(seat)`** — a seat's per-suit tally across every zone (deck/hand/energy/shuffle/shieldPile/forms/equipment/removed). The host's `state` *is* `hostState`, so this makes a seat's real composition assertable from the host, which is the only way to prove the host honoured the wire value rather than its own guess.
- **NEW `code/nettest_customdeck.js`** (14 assertions, 22 netplay suites now). Phase 1: a client picks a composition the host lacks → the host's authoritative state holds **13♦ / 26♥ / 13♣** for that seat, the host keeps its own Pure Wizard, and both labels read sanely. Phase 2: a rogue client appends a bogus `custom:D9` option and sends it → the host seats a **Full Set (13 of each suit, still exactly 52)** and the bogus key never reaches a label.
- Harness note worth keeping: **both pages in a netplay suite share one browser context** (BroadcastChannel requires it) and therefore one `localStorage`. To give one side a deck the other lacks, load that page first, seed and reload it, clear the store, *then* open the other page — otherwise the "host has never heard of this deck" premise is silently false, which is exactly how the first draft of this test failed.

### v1.27.1 — 🔍 View card is disabled when there's nothing to read
Playtest report (Aj): on a tight screen, tapping **🔍 View card** with no card selected opened the full-screen reader on nothing but its own placeholder — *"Tap a card in your hand first, then tap 🔍 View to read it here."* A button whose only outcome is a note telling you it did nothing.
- `showCard` now drives a **`paintViewCardBtn()`**: the button is `disabled` (40% opacity, default cursor) whenever `cvCard` is null, with its tooltip switching to "Tap a card in your hand first". The click handler also refuses on a null `cvCard`, so the empty reader is unreachable either way. Painted once at startup so it begins disabled.
- **Clear deliberately still leaves it enabled** — Clear deselects for play but keeps the last card described, so the reader has something real to show. That's not a leak, and the test pins it.
- **NEW `code/viewtest.js`** (10 assertions): the button's visibility window, disabled-on-load, that a disabled click cannot open the reader, enable-on-select, that the reader then shows a real card rather than the placeholder, and the post-Clear behaviour. It runs at **390×780** because `#viewCardBtn` only exists inside `@media (max-width:720px) and (max-height:800px)` — at 390×844 it is correctly absent, which is worth knowing before writing a test that expects to find it.

### v1.27.0 — custom deck builder ("parts" system), solo & local
The backlog's deck-builder item, solo/local half. Build a deck by choosing how many **parts** of each class it holds — a part is one complete 13-card suit, and a deck is always **4 parts = 52 cards**. Doubling a class gives you two of each of its cards.
- **Presets were already compositions**, which made this a generalisation rather than a parallel system: `buildDeck` computes `perSuit = 4/bases.length`, so Pure X = 4/0/0/0, each two-base mix = 2/2/0/0, and the Full Set = 1/1/1/1. New `E.presetParts(key)` exposes that, and the builder opens **pre-filled from whatever the picker had selected**.
- **engine.js** — new composition layer: `PARTS_TOTAL`/`PARTS_SUITS`, `partsCount`, `partsValid`, `partsKey`, `parseParts`, `isPartsKey`, `buildFromParts`, `presetParts`. `buildDeck` now also accepts a composition key or a raw parts object, so **`newGame` needed no change at all** — the deal absorbs custom decks through the existing `decks:` option.
- **A deck's value everywhere is its composition key** — `'custom:D1H2C1'`, canonical D-H-C-S order, zeros dropped. Dropdown values, `sel`, seat decks and `newGame` all carry that string, so a deck value is **self-describing**: the name is cosmetic and looked up locally, and the netplay follow-up gets the composition on the wire for free rather than a name the host would have to recognise. Compositions are therefore the identity — saving a duplicate mix is refused, naming the clash.
- **UI:** every deck picker gains a **"✏️ Custom deck…"** entry (a sentinel, intercepted on change) plus a **"Your decks"** optgroup. The builder is four steppers with live per-class card counts, a `4 / 4 parts — 52 cards` readout that only lights up when valid, a name field, and a delete list. **Create + delete only** (Aj's call) — to change a deck, delete and rebuild. Cancel restores the previous pick; deleting a deck in use falls everything back to the Full Set. Persisted in `cmf_decks_v1`.
- **Added an `esc()` HTML-escape helper** — deck names are player-typed and go straight into `<option>` markup. It didn't exist before because nothing user-typed had ever been rendered.
- **Two undefined CSS tokens caught:** the new styles reached for `var(--dim)` and `var(--ink)`, neither of which is declared in `:root` (the file uses `--txt` plus `opacity:.7`). Fixed before shipping — worth knowing that those two names look plausible but are dead.
- **NEW `code/decktest.js`** (35 assertions, Playwright): the builder entry, the stepper bounds, save/cancel, the duplicate guard, persistence across a reload, delete-and-fall-back, the Rival picker, the local free-for-all **seat** pickers, and a real duel dealt from a composition proving 13♦/26♥/13♣ on the board. Plus 41 new engine assertions in `test.js` (131 → **172**), including that every preset builds the same suit spread as its composition.
- **Netplay is deliberately untouched:** the lobby's pickers pass `deckOptionsHTML({custom:false})`, so custom decks don't appear online until the wire format is verified. The lobby already sends the deck as a bare string and the host builds from it, so this may work as-is — but that gets a test before it gets shipped.

### v1.26.4 — docs/CARD-LIST.md was stale; gen-cardlist.js now writes where the docs point
Caught during a post-push health check. `gen-cardlist.js` opens with "so it can never drift" — and it had drifted.
- **Cause:** it wrote `CARD-LIST.md` to the **CWD**, so running it from `code/` (as every doc instructs) dropped the generated file beside the sources and left the published `docs/CARD-LIST.md` untouched. Nobody noticed because the stray `code/CARD-LIST.md` was never committed.
- **The drift:** Critical Hit (♠9) still read "Target Rival loses 1 shield" — missing the **v1.22.1 Broadway pitch cost**. That is the *third* thing that same balance change quietly broke (it also rotted `nettest_target3`, fixed in v1.26.2). Regenerated; that one line is the only difference, so nothing else had drifted.
- **Fixed properly:** the generator now writes to `path.join(__dirname,'..','docs','CARD-LIST.md')` — an absolute path, so it lands in `docs/` no matter where it is run from, and re-running it is idempotent. CLAUDE.md notes to re-run it after any card name/cost/text change and never to hand-edit the list.

### Health check at v1.26.4 — everything green
`node build.js` reproduces the committed HTML byte-for-byte (2,839,555 bytes) and both copies are identical · `test.js` **131/0** · `netview.test.js` **28/0** · `browsertest.js` PASS (12 duels, deepest round 22, no runtime errors) · full netplay sweep **21/21** · `docs/CARD-LIST.md` matches `engine.js` · version strings agree across README / NEXT-SESSION / CLAUDE.md · working tree clean.
Two notes for the next session: `browsertest.js` reporting "you: 0 | rival: 12" is **normal** — that harness drives the human seat with a dumb script (first legal card, else pass, never activates an effect), so it is a crash smoke test, not a balance signal. And **run the Playwright suites one at a time** — each starts its own server and drives 2-3 real pages, so they are genuinely load-sensitive (`nettest_rtc` fails at `maxRound=0` under contention, 11/0 alone). CORRECTION to an earlier note: `nettest_full`'s >180s timeout in this health check was first blamed on the browser smoke test running alongside it; the actual cause was three stray `while pgrep …; do :; done` wait loops of mine spinning at ~1% CPU each for up to 45 minutes. `pgrep -f runnet.py` matches the waiting shell's OWN command line, so the loop can never exit. **Never busy-wait on `pgrep` for a pattern that appears in the waiting command itself** — the harness re-invokes on completion anyway, so just poll the output file instead.

### v1.26.3 — nettest_prefight solved: Super Mode needs a RIDE (all 21 netplay suites green)
The long-standing `nettest_prefight` failure (6/7, blamed on the sandbox for ages) was **a stale test, not a product bug** — confirmed by driving three real browser tabs by hand.
- **Root cause:** the test's `HERMES` constant was `[Q♠, K♠]`, but `hasSuper` (engine.js ~190, variant B) requires **any J + any Q + any K — the Ride is mandatory**. With no J the player was never in Super, so `effectFor` never made Back Stab (10♠) a Quick, so `openPreFight` had nothing to offer and the pre-fight modal never opened. Every downstream assertion fell over from that one missing card. Adding the Ride to `HERMES`: **13/0**.
- **Manually verified end-to-end first** (3 tabs, host + 2 clients, `?net=…&dbg=1` on a local server), which is what settled test-vs-product: staged with Q+K only → `hasSuper:false`, no modal, exactly the CI symptom. Re-staged with J+Q+K → the modal opened instantly ("Rival is about to fight — Spring a Quick to lock their turn?", offering Back Stab · 10♠), springing it logged "P2 sprang Back Stab!" on the host, then "You are locked out (Back Stab) — turn skipped", the host's turn was skipped and its card returned to hand. The whole mechanic is sound.
- **Fixed the wording that caused this.** `test.js` asserted *"any Q + any K lights up Super Mode"* — misleading, since its own setup activates a Ride (11D) first. Three assertion messages and two comments now say **J + Q + K** and note the Ride is required. Message-only; 131 still pass. This is exactly the sentence a future test author would copy, and did.
- **Full serial sweep: 21/21 green.** `nettest` (isolation probe, expected ✗ line) · 3p 7 · activate 6 · ceremony 9 · concede3 8 · counter 8 · deckout3 8 · deckpick 8 · discard 7 · discon3 22 · elim3 15 · full 5 · guard 8 · losspick3 7 · losspick_remote3 6 · **prefight 13** · react3 7 · rtc 11 · rtc3 10 · rtc_discon 5 · target3 6 — all FAIL: 0.
- Takeaway now in CLAUDE.md: **when a netplay suite fails, ask first whether the product moved and the test didn't** — that was the answer all three times (discard/v1.24.0, target3/v1.22.1, prefight/the Ride rule), and each failure was silent, with no JS error and a board that just quietly did nothing.

### v1.26.2 — the Playwright suites run again (and two had rotted)
`browsertest.js` and all 21 `nettest_*.js` suites hardcoded `executablePath:'/opt/pw-browsers/chromium'` — the browser path from the sandbox they were written in, which exists on no normal machine. They have therefore been **unrunnable, and silently unrun**, for some time. Now installed, portable, and swept: **20 of 21 green**.
- **NEW `code/pwchrome.js`** — one shared launch-options module, resolving `$PW_CHROMIUM` → `/opt/pw-browsers/chromium` if present (the old sandbox still works) → Playwright's own downloaded browser. All 22 launch sites now `chromium.launch(LAUNCH)`; the three WebRTC suites keep their flags via `Object.assign({}, LAUNCH, {args:[...]})`.
- **NEW `code/package.json`** (private, devDependencies: playwright) + lockfile, with `npm run build` / `npm test` / `npm run test:smoke` / `npm run cardlist` scripts. **The game still has zero runtime dependencies** — it never imports any of this; `node_modules/` is gitignored. `npx playwright install chromium` fetches the browser.
- **`browsertest.js` passes:** 12 duels, deepest round 25, 13 interrupt responses, 11 declines, no runtime errors.
- **FIXED `nettest_discard` (was 5/2).** It never adapted to **v1.24.0**'s target-first change: Telekinesis is `discardOpp` → hostile-singular, so the context button now reads "🎯 Choose target" and the old `/Activate/i` guard matched nothing — the cast simply never happened (silently: no JS error, turn unchanged). Widened the guard and added the opponent-panel tap. **7/0.**
- **FIXED `nettest_target3` (was 5/1).** It never adapted to **v1.22.1**'s Broadway pitch cost on Critical Hit (♠9): the caster's staged hand held 9S/7C/8H with no 10/J/Q/K/A, so the activation was blocked and the chosen opponent never lost a shield. Added a 10♥ to pitch (the engine auto-picks the cheapest Broadway). **6/0.**
- **`nettest_prefight` still fails 6/7 — and the old excuse is dead.** Previous notes called it a sandbox/BroadcastChannel artifact; it fails identically on a real Mac with a real Chromium, so it is either a stale test or a genuine netplay regression. Symptom: neither the remote nor the host pre-fight modal (`#overlay.show`) ever appears, so Back Stab never springs, yet the turn-skip assertions pass. The engine is sound in isolation (`effectFor` → Back Stab `quick:true` under Hermes Super). Ruled out: the lead-lock guard (padding both holders' 1-card hands changes nothing). **Open — needs a 2-tab manual check to decide test-vs-product.**
- **Run the suites serially.** Each starts its own HTTP server and drives 2-3 real pages; concurrently `nettest_rtc` fails at `maxRound=0`, alone it passes 11/0. Full sweep: `nettest` (isolation probe, expected ✗ line, exits 0) · 3p 7/0 · activate 6/0 · ceremony 9/0 · concede3 8/0 · counter 8/0 · deckout3 8/0 · deckpick 8/0 · discard 7/0 · discon3 22/0 · elim3 15/0 · full 5/0 · guard 8/0 · losspick3 7/0 · losspick_remote3 6/0 · prefight **6/7 FAIL** · react3 7/0 · rtc 11/0 · rtc3 10/0 · rtc_discon 5/0 · target3 6/0.
- CLAUDE.md gained the Playwright setup, the run-serially rule, the per-suite status, and a warning that these suites rot silently — when one fails, ask first whether the product moved and the test didn't.

### v1.26.1 — doc & comment truth pass + CLAUDE.md (no gameplay change)
Docs and source comments had drifted behind the code; nothing in the engine's behaviour changed (131 + 28 tests unchanged and green before and after).
- **This file's header fixed:** test count 684 → **131**, `Current version: v1.0-rework` → **v1.26.0** (the `REWORK` flag has been gone since v1.23.0), `faces.js` dropped from the build line (retired in v0.95 — `build.js` stubs `window.CardFace = {}`), the stale `rework` arg removed from the `analysis.js` example, and the manual `cp code/CardmenFighter.html ../CardmenFighter.html` step spelled out (build.js writes only `code/`).
- **Changelog order fixed:** the stranded **v1.19.3** entry sat above v1.26.0 at the top of the log; moved back into version order between v1.19.4 and v1.19.2, so the log is strictly newest-first again.
- **README:** Status v1.23.0 → **v1.26.1**, build block corrected (build.js writes one file + the root copy step), `art.js / faces.js` line fixed, "never hand-edit the generated HTML" called out, `PLAYER-PROFILE.md` added to the docs list.
- **engine.js header comment rewritten.** It still described the *pre-rework* game — "40-card deck, values 1-10, no supreme card", `1-2-3-4-5` straights, "has NO card effects yet". Now documents the real ruleset (52 cards, `fightValue` 3..10/J11/Q12/K13/A14/apex-2=15, straight windows lo 3..11, specials-only shield breaks, `activationCost`, the constants) and the retired flag. Also fixed 9 inline comments that still read "= rank when REWORK off" / "40 cards (off) / 52 cards (REWORK)" / "(REWORK):" card labels. Comment-only edits, no logic touched.
- **NEW `CLAUDE.md`** at the repo root — the generated-file rule, the source→file map, the build/test loop with the pass gates, the rules facts an engine change has to respect (fight value vs rank, no flushes, suits don't beat), the ES5-in-an-IIFE style constraint, and the changelog/version convention. Also records that `browsertest.js` + the `nettest_*` suite need Playwright (`/opt/pw-browsers/chromium`), which is **not installed here** — they exit `MODULE_NOT_FOUND`, which is an environment gap rather than a regression.
- **Restored the missing `.gitignore`** (`*.zip`, `node_modules/`, scratch `shot*`, logs, `.DS_Store`). v1.23.0 recorded adding one but the repo had none — presumably lost in the upload-based first commit.

### v1.26.0 — two-phase flash: art+name, then the effect text
`flashArt` now reveals in two beats: **beat 1** the art + value/suit + name (~850ms), then **beat 2** the card's **effect text rises in on top** (over the bottom scrim) and holds, before fading (~2.5s total). Effect cards get both beats; plain cards keep the quick single beat. The pop/fade animation duration is now driven by a `--flashdur` CSS var set by `flashArt` (was a fixed 1.15s that fought the longer reveal and blanked it early — the bug behind the empty mid-flash). `revealDwell` bumped so the Rival's effect beat waits for both phases (2650ms for text cards). Reduced-motion shows both at once. `.afText` fades/expands via a `.showText` class. Verified with a DOM probe (t=300 name only → t=1000 text fading → t=1600 text full → removed ~2500) and a screenshot.

### v1.25.1 — card label on the flashed art
The center-stage art pop (`flashArt`) now labels itself: the card's **value/suit** (red for ♦/♥) + its **name** (e.g. "A♦ Gather Energy") **overlaid on the bottom of the art** over a gradient scrim, so it reads as part of the card instead of floating below it. Restructured into an `.afStage` (art + caption as one popping unit); `.afCap` is absolutely pinned to the bottom with rounded corners; the fallback drawn-card inserts into the stage before the caption. Name comes from `effectOf(card).name` or `E.cardName`.

### v1.25.0 — readable rival plays + a QUICK response cue
Playtester kept missing what the opponent played, and Quick responses (especially the Rival's) were invisible. Slowed the rival's beats for readability and added a center-stage cue for instant-speed answers.
- **Longer rival dwells:** fight-play beat 950→**1500ms** (the one people missed), pass 650→**950**, phantasm 1000→**1300**; effect-art flash 1150→**1350ms**; inter-beat gap 320→**480ms**. Games are a touch slower on the Rival's turn, but its plays register.
- **NEW `quickFlash(who, name, countered)` cue** — a gold **⏩ QUICK!** banner (cyan when it's you) reusing the retired `#stopfx` overlay. Fires whenever either side plays a Quick in response: your Counter/answer (`humanResponds`), the Rival's answer, and the Rival's shield-guard (Leyline) spring.
- **The Rival's Quick now PAUSES.** `settleWindows` used to resolve the AI's response instantly and log-only; it now flashes the cue, shows a message, and dwells ~1400ms (300ms under reduced-motion) before continuing — so a Counter Spell / instant answer is actually visible. Counter-a-counter chains flash the last response. Verified: cue renders both sides, 131 engine + 28 netview tests pass.

### v1.24.0 — target-first for targeting effects (no more wasted energy on a cancel)
Targeting effects used to spend energy the moment you hit **Activate**, then ask for a target — so backing out cost you the energy. Now they're **target-first**: the context button reads **🎯 Choose target**, clicking it enters a target-select step, and `E.activate` (which spends the energy) only fires once you pick a valid target. **Clear cancels with zero energy spent.**
- New `effNeedsTarget(eff)` = removeEquip / counterfeit / `isHostileSingular` (destroyShield, discardOpp, energyDenyOpp, lockout, recycle-opp). `ctxAction` labels those "🎯 Choose target" instead of "⚡ Activate".
- `activate()`: removeEquip no longer auto-fires on a single target (always taps to confirm); hostile-singular now routes through `promptTargetPick` in **all** modes (was MP-with-2+-opponents only), so even a 2-player duel picks the target before spending.
- **Duel rival panel is now a tap-target:** `#rival` gets `.targetable` + a click handler → `chooseTargetSeat(RIVAL)` while `targetPick` is active (MP already used the opponent panels). New `.fighter.targetable` CSS (purple pulse).
- `targetPick` now blocks hand/fight/pass input and dims the hand like `targeting` did; **Clear** cancels it ("Cancelled — no energy spent"). counterfeit already deferred via its modal (Cancel = no spend) — unchanged.
- Verified headlessly: select → button "🎯 Choose target"; enter target mode → energy unchanged + rival targetable; Clear → energy unchanged; tap rival → fires and spends. 131 engine tests + 28 netview pass.

### v1.23.0 — retire the rework flag (dead-legacy cleanup) + git
The `REWORK` engine flag and the entire classic pre-rework game are gone — the 2-apex + Forms rework is now simply *the* game, always on.
- **engine.js**: folded `REWORK_BASE` into `EFFECTS` permanently (renamed `BASE_OVERRIDES`, merged via a load-time loop); baked the rework rules (52-card deck, 3-apex straight windows `loMin/loMax`, `fightValue` ladder, `activationCost`, transforms-are-free-cost, apex-2-has-no-effect) with the legacy branches deleted; `stopperNeed` is now a flat `return 0` (STOPPER retired). Removed `var REWORK`, `setRework`, `isRework` and their exports.
- **template + ai.js**: simplified the 12 `E.isRework()` guards and 2 `setRework()` calls to the always-true path; `rankLabel` → `REWORK_LABEL[r]||r`; gallery ladder fixed to the rework order.
- **tests/harnesses**: deleted the ~560 classic-game tests from `test.js` (STOPPER, old suit map, 1-10 ladder, 40-card deal — all dead code) and kept the rework + MP suites, re-adding a **300-game AI-vs-AI rework termination smoke** so full-game coverage isn't lost. Dropped every `setRework` from `test.js`, `netview.test.js`, `mpsim.js`, `gen-cardlist.js`; removed the `rework` arg from `analysis.js` (AI diff shifts to arg 5). **Engine tests: 131 pass · netview 28 · nettest_counter 8/0.**
- **nettest_prefight** fails deterministically (6/7) in this sandbox — but the underlying mechanic is verified sound in isolation (`effectFor` gives Back Stab `quick:true` under Hermes Super); it's the browser/BroadcastChannel harness, not the engine. Worth a real 2-tab manual check.
- **Added a git repo** (`.gitignore` excludes `*.zip`, `node_modules/`, scratch `shot*.js`). This is the first commit — a post-cleanup baseline.

### v1.22.1 — Critical Hit gets the Broadway pitch (balance)
Critical Hit (♠9, Rogue destroyShield) was the one shield-strip left *untaxed* when the Broadway-pitch cost was added to the Fighter's Ultima Attack (♣10) and Armor Piercing (♣7). Result: it was the strongest of the three (CARD-STATS: 0.29 cast / **51.8% win**), cheaper (9 vs 10) and unconditional. Added `pitchHigh:true` to Critical Hit's REWORK_BASE entry (S9) with the matching "Additional cost: discard a Broadway card (10, J, Q, K, or A)." text, so all three shield-strips now share the tax. Legacy (non-rework) Critical Hit is unchanged. AI already gates any `pitchHigh` destroyShield on holding a spare Broadway (ai.js line 311) — no AI change needed. Tests: +2 (688 total) — Critical Hit succeeds-with-pitch / blocked-without, plus the pitchHigh assertion now covers S9. Verified in the codex (shows the Additional-cost line). Re-run `node analysis.js` to confirm its win% settles toward ~50%.

### v1.22.0 — start jingle, turn chime, visible cost spend
- **NEW SFX cues.** `gameStart` — a short upbeat rising arpeggio (G-C-E-G + a high-C sparkle + low root) plays as the board comes up (fired in `startGame`, right before the first render). `turnStart` — a gentle rising G5→D6 chime with a faint octave shimmer, fired in `render()` whenever control returns to the local human (`state.turn===YOU && prevTurn!==YOU`). `prevTurn` is seeded to the starting seat in `startGame` so the opening turn doesn't chime (the game-start jingle covers it). Both respect the mute toggle.
- **Paying a cost is now visible in DEFAULT mode too.** Previously `energyPulse` only floated a `+N` on a net energy *gain*; spending was silent (the source of Aj's "no dice" — a cost-only activation showed nothing unless detailed mode was on). Default mode now floats a red **`−N`** (`.nrgGain.spent`) when energy net-drops from a paid cost, symmetric with the cyan `+N`. Detailed mode already showed the by-suit cost pips (verified: a real Brilliant Tactic activation floats `−1♣ −1♦ −1♥`).
- Verified headlessly (`?dbgsolo=1`): `gameStart` logged on start, `turnStart` on turn-return, default cost → red `−2`, detailed cost → by-suit pips.

### v1.21.0 — Settings + detailed energy pulses
- **NEW: ⚙️ Settings modal** (header gear). Currently: **Show detailed energy pulses** (persisted `cmf_pulse_detail_v1`, default OFF) and **Sound effects** (mirrors the header 🔊 mute, kept in sync via `paintSfxBtn`). A "🌐 Language options — coming later" placeholder notes future i18n. The sfx button IIFE was refactored to a named `paintSfxBtn()` so Settings and the header toggle stay in sync.
- **Energy pulses now reconstruct the REAL movements** instead of only the net delta. `signalEnergy` → **`energyPulse(el, player, pl)`**, which diffs per-suit energy + per-suit shuffle + deck + hand counts each render to derive: cost spent (`shuffleΔ` by suit), energy gained (`energyΔ + cost` by suit), and deck→energy mill. `prevNrgSuit/prevShufSuit/prevDeckN/prevHandN` track the baselines (reset on new game).
  - **Default mode:** the net `+N` energy float (unchanged) **plus** — new — a red `−N` off the 🂠 deck whenever cards are milled deck→energy from an **effect** (e.g. Pray for Strength), not just the catch-up. Previously only the catch-up mill floated a deck loss.
  - **Detailed mode:** a two-line float over the ⚡ box — spent line (red, by suit, e.g. `−2♥ −1♠`) over gained line (cyan, by suit, e.g. `+2♦ +1♥ +1♣ +1♠`) — plus the `−N` deck. Matches Aj's target (−3 energy distributed / −5 deck / +5 energy distributed for Pray for Strength).
  - **Deck-float guard:** `deckToEnergy = min(deckLoss, gainTot, deckLoss − handGrowth)`, and it's suppressed during the round ceremony (`inCeremony` flag) where the catch-up mill fires its own explicit `−N` — so a normal end-of-round **draw** (deck→hand) is never mistaken for a mill.
  - Verified headlessly via a Pray-for-Strength-style scenario (`?dbgsolo=1` test hook): default → `+2` energy & `−5` deck; detailed → `−2♥ −1♠` / `+1♣ +2♦ +1♥ +1♠` / `−5` deck.
- A guarded `?dbgsolo=1` test hook (`window.__solo`) exposes `st()/render()/setPulse()` for headless layout/pulse verification — inert in normal play (like the existing `?dbg=1` netplay hook).

### v1.20.0 — mobile layout pass
A real device-width pass across common portrait sizes (360×640, 375×667, 360×780, 390×844, 393×852, 412×915, 430×932), verified with headless Chromium screenshots.
- **Message/meta overlap fixed.** `body{overflow:hidden}` + the play-area grid row being `minmax(0,1fr)` let the play area collapse below its content on short screens, so `#message` ("You have the initiative…") spilled down onto the `#handMeta` "You · class · ⚡ · deck" row. Fix: mobile play-area row is now `minmax(min-content,1fr)` (never collapses below its content), and `main` gets `overflow-y:auto` as a safety valve so if a very short viewport still can't fit everything, it scrolls (the description row scrolls off, never the hand/actions) instead of overlapping. Bumped `#table` min-height to 96px and trimmed `#side` height slightly.
- **Clipped collapsed log label fixed.** The rotated vertical "Battle Log" was taller than the short mobile play-area rail, clipping to "…LE LOG". On ≤720px the collapsed label is now just "LOG" (via `font-size:0` + `::before{content:'LOG'}`), so it always fits.
- **Header no longer clips New Duel.** The single-row header pushed New Duel / ? / 🃏 off the right edge on ≤~400px. On ≤480px the header now wraps (`flex-wrap`), the title shrinks and may stack to two lines (CARDMEN / FIGHTER) when crowded, and the wordy "💡 Hints: Off" collapses to a 💡 icon (on/off still reads via the gold highlight).
- **NEW: "🔍 View card" full-screen reader (Aj).** On really tight/short screens (`max-width:720px and max-height:800px`, catching short portraits + landscape-ish) the inline description strip is dropped to reclaim its vertical space, and a **🔍 View card** button appears beside "Specials list". Tapping it makes the whole page the description box — big art + full rules + the Form/Super upgrade ladder — with an ✕ Close (backdrop tap also closes). Roomy phones (≥~844 tall) keep the live inline strip and show no View button, so nothing regresses there. Impl: `cvCard` tracks the shown card in `showCard`; `renderCardFull`/`openCardFull`/`closeCardFull`; `#cardFull` overlay; `showModal` closes it so it can't linger over a modal.

### v1.19.4 — coach parks over the board on activate steps + Tutorials hub polish
Two tutorial changes. (1) On every "read then activate" step (How to Play, Energy & Effects, Rides transform, Form Changes transform) the coach panel now temporarily parks itself centered over the play area (`stage:true` step flag → `#tutPanel.atStage` CSS) so it no longer covers the card description box the player needs to read, and the ⚡ lightning on that box (`#cardActivate`) is spotlighted alongside the glowing card and the Activate button. Manual drag or a new lesson clears `.atStage`. (2) Tutorials hub reorg: the lesson list now scrolls internally (`.lessons` `max-height:46dvh; overflow-y:auto`) so 8 lessons no longer push the footer buttons off-screen; **Zones of Play** moved to **Basics #2** (runs in Basics mode now); Advanced order is **Quicks → Rides → Form Changes** (Quicks first per Aj). Rides blurb → "a persistent companion that helps you out"; Forms renamed **Form Changes**, blurb → "transformations that upgrade your cards' effects." New Basics order: 1 How to Play · 2 Zones of Play · 3 Initiative · 4 Specials · 5 Energy & Effects.

### v1.19.3 — dim the hand during tutorial read steps
On a READ step the board was already locked, but the hand still looked playable, so testers tapped cards instead of pressing "Got it." Now `renderHand` adds `#hand.tutlock` when `TUT.blocking()`, dimming the hand to ~32% (spotlighted `.tut-spot` cards stay bright) and setting `pointer-events:none`, so the read-then-press flow reads clearly. Clears on gated action steps.

### v1.19.2 — Sort label shows current state
The Sort button label now reflects the **current** arrangement, not the next action (Aj found "next" confusing). States: **Unsorted → Singles → Pairs → Straights → Singles…** (clicking cycles the three sorts). Resets to **Unsorted** on game start and whenever a fresh card is drawn (`syncOrder` detects the new card). `sortMode` (int) replaced by `sortState` (string) + `SORT_NEXT`/`SORT_TITLE` maps.

### v1.19.1 — coach-panel drag fix
Dragging the tutorial coach panel stretched it to full screen height: the mobile CSS pins `bottom:14px`, and the drag set an inline `top` while leaving `bottom` set, so the box spanned top→bottom. Fix: on drag start, clear `bottom`/`right` to `auto` (pin by top/left only); on a new lesson (`TUT.start`) reset them so it re-anchors via CSS. Verified: panel height constant (208px) across a drag in portrait.

### v1.19 — playtester batch: onboarding UX, sort cycle, hints, interactive Quicks
Another round of playtester feedback (two testers).
- **"Mill" jargon removed.** All player-facing text (loser-mill log, Initiative/Energy lessons, Rules) now says "move cards from your deck into energy" instead of "mill."
- **Mid-game Help resumes the duel.** Clicking `?` during a live game now shows a clear **"← Back to the duel"** button (was ambiguous "Got it") and never drops to New Duel. `showHelp` computes `inGame` itself.
- **Netplay is backable.** The Play Online modal has a **← Back** (and click-outside) to New Duel; the netplay signaling screen has a persistent **"← Leave online"** button (fixed on `<body>`, survives re-renders) that reloads back to the plain game.
- **Lesson-complete hand-off.** Finishing a lesson now pops a modal with **Next: <lesson> / All tutorials / Keep playing** buttons (was just a message with no button).
- **Sort button cycles modes.** Sort now cycles **Singles → Pairs → Straights** (low→high), re-laying the hand into pair/trio and straight groups; label shows the next mode. `groupKindKF` now recognizes `straight` so a sorted straight group isn't split by `reconcileLayout`.
- **Play Hints layer (default OFF).** New 💡 header toggle (persisted `cmf_hints_v1`). When on, groups you can't play right now **dim**, and a **dashed** multi-card group means "break me — a card inside can beat the pile." Ported/adapted from ChikiChampions; classification via `E.legalFightPlays`. Rules + Specials lesson mention it.
- **Quicks lesson now SHOWS the Counter Spell flow (interactive).** Rewrote it: rigs a Counter Spell (4♦) + affordable energy, and a scripted step (`tutCastRivalTech`) makes the Rival cast a real Technique, opening the **Respond?** window; the step gates on the player actually **countering** it (new `TUT.note('respond')` hook in `humanResponds`; a decline safety re-casts so it can't brick). Verified end-to-end in Chromium.
- **Tutorial clarity adds:** the **tie rule** ("must play strictly higher; equal ties don't win") is now explicit in Lesson 1; a **zones** tour step (hand/deck/energy/shuffle cycle) added to How-to-Play (zones belong in Basics); the **Sort + Hints** tools are taught in the Specials lesson; the cost line already spells suits out.
- Verified: `test.js` **686/0** (Super-needs-Ride guard etc.), `netview.test.js` 28, `nettest_counter` 8/0 (the response path this batch touched). NOTE: `nettest_full` is ~50% flaky in the headless sandbox (client tab intermittently fails to sync over BroadcastChannel — "client acted 0", no JS errors); this predates the batch (was only ever run once per version) — worth a manual netplay sanity check, but not a logic regression.

### v1.18 — Recruit AI tier + Super-Mode bug fix + win/lose stingers
- **New "Recruit" difficulty** between Minion and Fighter (a playtester quit — the Minion→Fighter jump was too steep). Recruit **leads Specials and contests them**, and plays for **survival + ramp/draw/reclaim**, but skips all of Fighter's pressure plays (equip buffs, value-boost overtakes, transforms/zone game, Finishing Blow, Back Stab, hand/energy disruption). Measured (mirror Full-Set duels, 400 games): **Recruit 99.8% vs Minion**, **Recruit 39% vs Fighter** (Minion is 0% vs Fighter) — a real gentle step. Ladder is now **Minion · Recruit · Fighter · Knight · Demon Lord**. `ai.js`: a `basic` flag gates the pressure branches; `chooseMove` lets Recruit contest Specials; excluded from reactive Back Stab. UI wired through `DIFF_NAME`, `resolveDiff`, `validDiff`, the setup dropdown, MP per-seat strengths, and the Rules text.
- **Super Mode bug fixed (Aj caught it): "why are we incarnating without a ride?"** The engine was lighting **Super on just a Q + K** — the design doc (RIDES-AND-FORMS.md §71) requires a **Ride (J) + a Q + a K**. Added the Ride requirement to `hasSuper`, `effectFor` (the boost that supersedes), and `boostInfo` (the ladder's `active` flag): Variant B (live) = any J + any Q + any K; Variant A = one suit with all three. This makes the earlier Rides/Forms tutorial text ("Ride + two Forms → Super") correct. Tests updated (Super setups now include a J) + a new guard: "Q + K without a Ride is NOT Super." `test.js` **686/0**.
- **Win/lose stingers.** Added `win` (rising major fanfare) and `lose` (slow descending dirge) SFX cues, fired as the result modal appears (`endGame`→`showWin`). On a Fighter Kick they sequence naturally after the kick sound.
- Verified in Chromium (Recruit in the dropdown, no page errors), `netview.test.js` 28, `nettest_full` green, CARD-LIST regenerated.

### v1.17 — sound effects, cost line, deck-mill signal, fly-in, Rides/Forms split, deck-out fix
A big playtest batch (Aj playing through the tutorials live).
- **Sound effects (WebAudio synth, no assets).** New `SFX` module: a procedural synth (oscillator voices + filtered-noise bursts) with 11 cues — draw, jab, special, equip, removal, technique, ride, form, shieldBreak, shieldHeal, kick — wired at universal choke points: `flashArt` (every activated effect/transform, both sides → equip/removal/ride/form/technique by `eff.kind`), the render pile-change block (jab vs special), `animateShields` (break/heal, fires under reduced-motion too), `playFinisher` (kick), and `syncOrder` (draw). Header **🔊/🔇 mute toggle** (persisted `cmf_sfx_muted_v1`); audio context unlocks on first pointerdown (autoplay policy). File size unchanged (nothing embedded).
- **Spelled-out Cost line.** The description box now has a dedicated `Cost:` line — e.g. `Cost: 1♦ (1 diamond energy)` / `Cost: 4♠ + 5 any (4 spades + 5 any energy)` — via `spellCost`/`costLineHTML`. Removed the terse cost from the type line.
- **Deck-mill `−N` signal.** When the loser-mill pulls energy off a fighter's deck, a red `−N` now floats off the 🂠 deck (`floatDeckLoss`, fired from `logCatchUp` on `res.milled` — **only** on a mill, never on plays/draws). Tutorials call it out (Initiative + Energy lessons).
- **Effect-draw fly-in.** Cards drawn by effects didn't visibly deal in — the full-screen effect flash (+ a 2nd synchronous render) ate the animation. `syncOrder` now replays the deal-in ~1.2s later (after the flash clears) when a flash is up. (Round draws already sequenced via `enterDelayBase`.)
- **Tutorial spotlight no longer breaks absolute layout.** `.tut-spot` dropped `position:relative` from CSS; `applySpot` now sets it inline only on *statically*-positioned targets (cleared in `clearSpots`). Fixes the **Forms & Rides zone jumping to center** when spotlighted.
- **Rides/Forms lesson split (now 8 lessons).** Aj noted Rides (persistent aura) and Forms (upgrade your cards) are conceptually different, so **Lesson 5 = Rides** (J, persistent) and new **Lesson 6 = Forms** (Q/K, upgrade effects, opens the Queen tier by rigging the table to 4 shields lost); Quicks→7, Zones→8. Same on-table zone.
- **Quicks lesson demos Counter Spell** specifically (`tutPrepQuick` prefers the `Counter Spell` card = 4♦), per request.
- **Deck-out definition corrected** (Aj): decking out is *drawing when both deck **and** shuffle pile are empty* — not "leading with an empty hand." You can end a round with 0 cards in hand. Fixed the Zones lesson + the Rules screen text.
- **Apex 2 taught first** (from v1.16 refinement carried in): Lesson 1 opens on the value ladder; **energy starts at 0** note added to the Energy lesson.
- Verified in Chromium: 8-lesson hub, Rides transform, Forms transform (Queen gate), Quicks→Counter Spell (⏩), cost line, Forms-zone position fix, mute button, zero page errors. `test.js` **685/0**, `netview.test.js` 28, `nettest_full` green.
- **Parked:** the SFX audio itself and the deck-mill `−N` / fly-in couldn't be confirmed via headless automation (activation/mill are hard to script) — logic is in and error-free; confirm by ear/eye in a real playtest. **Next up:** the clickable, reorderable **energy pile** (FIFO default; peek → click cards to set shuffle-in order) — Aj's paper-game sorting rule.

### v1.16 — Advanced lessons 5–7 + apex-first cheat sheet + near-hand Specials button
Finished the Tutorials hub: the three **Advanced** lessons are now live (Full mode), plus two playtest tweaks.
- **Lesson 5 · Rides & Transforms** — Full-mode rig (`tutRigRides`) that pulls a J into hand and **opens the Ride tier by bleeding the table's shields** (rival knocked to 2 → 2p×lvl1 gate satisfied). `tutPrepRide` marks `announcedThresh.ride` so the ROAR banner doesn't fire spuriously. Interactive: transform the J (gated via a new `TUT.note('activate', eff)` added to the transform branch, which used to `return` before the hook). Teaches persistence, one-per-rank, Super Mode. Verified: gate open, transform enters the Forms zone, coach advances.
- **Lesson 6 · Quicks** — guided read-tour; `tutPrepQuick` pulls a ⏩ Quick into hand and spotlights it, explains response-window plays (the game auto-prompts, so no fragile scripted spring).
- **Lesson 7 · Zones of Play** — a 5-step tour spotlighting Hand → Deck → Play area (`#pile`) → Energy → Shuffle, with the cycle explained. `tutRigZones` seeds energy + shuffle so the counts read.
- **`startLesson` now honors per-lesson mode** (`basics:false` → Full game for 5–7; Advanced keep 4 shields). Hub shows all 7 with ✓/start/soon (Advanced now "start").
- **Apex taught first (playtest ask).** Aj noted the **2** was easy to miss. Lesson 1 now opens its teaching with the **value ladder** (3→10→A→**2 apex**) as the *first* concept after welcome, and the **cheat sheet leads with a ranking strip** — 3…10 · A (gold outline) · **2 (solid-gold apex)** — plus "your two strongest cards are the 2 and the A." (dropped the old buried ladder step).
- **Specials reference by the hand (playtest ask).** Added a spelled-out **🃏 Specials list** button in the hand-meta row (right above the hand) opening the cheat sheet — closer than the header icon. Header 🃏 kept for the pre-game screens. Lesson 1's ladder step + wrap step point at it.
- Verified all four new/changed flows in Chromium (Rides transform, Quicks spotlight, Zones tour, apex-first sheet, near-hand button), `test.js` **685/0**, `netview.test.js` 28, `nettest_full` green.

### v1.15 — Tutorials hub + 4 Basics lessons (playtester onboarding rework)
Playtesters unfamiliar with the game needed more scaffolding. Replaced the single guided duel with a **Tutorials landing page** (`openTutorials()`) — a hub grouped **Basics** (1–4, built) and **Advanced** (5–7, shown as "soon"). Reachable from New Duel (🎓 Tutorials button), Help (🎓 Open the Tutorials), and after finishing any lesson. Per-lesson completion is tracked (`cmf_lesson_<id>_v1` → a ✓ on the hub).
- **Lesson engine generalized.** New `LESSONS` registry: each `{id,num,section,title,blurb,ready,shields,rig,steps}`. `startLesson(lsn)` sets `currentLesson` and `startGame` now uses `currentLesson.rig`/`.steps` (falls back to the legacy `tutSteps`). `TUT.finish` marks the lesson done and nudges to the next. `startTutorial()` kept as a thin wrapper → Lesson 1.
- **Lesson 1 · How to Play** — the flagship full walkthrough, enhanced: 2-shield HP, emphasizes **Specials are the only way to break shields**, **jabs are the safe way to bank energy**, and the **shields → Fighter Kick** win arc; points to the Initiative lesson for losing/passing.
- **Lesson 2 · Initiative** — rigged so the **Rival leads** (`tutRigInitiative`: rival holds 6–8, you hold 3–5, `st.turn=1`). Teaches that you can't win every exchange: **pass to bank energy equal to the winning play**. New `TUT.note('pass')` hook in `doPassBody` gates the pass step. Directly answers the "don't fear losing" feedback.
- **Lesson 3 · Specials** — deeper on combos (pair/trio/straight/full house), only-Specials-break-shields, ends by highlighting the cheat-sheet button.
- **Lesson 4 · Energy & Effects** — the bank→spend cycle, jabs as safe banking, activation cost → shuffle pile → deck reshuffle (don't starve).
- **2-shield tutorial HP.** New engine `opts.shields` override (`newGame` deals a `startShields`-sized shieldPile; `st.startShields` recorded). Tutorials pass `shields:2` so the Kick arc fits a short lesson. The shield renderer now draws `baseShields()` slots (from `state.startShields`) instead of a hardcoded 4 — so a 2-HP game shows **2 pips, both full**, not 2 full + 2 phantom-empty.
- **Specials cheat sheet — both surfaces (per request).** A dedicated **🃏 board button** (header, opens any time mid-duel) and a beefed-up **section inside Help**, plus a link on the Tutorials hub. Shared `cheatSheetHTML()`: jab vs Special, the four Specials, how they rank, "no flushes/straight flushes," and the value ladder.
- **Bug fix (found while building):** advancing to a **gate-only** step (e.g. "press Pass") updated the coach panel but never re-rendered the board, so buttons stayed disabled from the prior read step. `TUT.show()` now repaints the board each step. (Steps with a `prep` re-rendered already; the pass step had none → it bricked.) Verified in-browser: Lesson 2 pass step enables Pass, banks 1 energy (jab rule), and advances.
- Verified end-to-end in Chromium: hub renders, cheat sheet renders, Lesson 1 gated jab unblocks, Lesson 2 rival-leads/pass works, 2-shield display correct, zero page errors. `test.js` **685/0**, `netview.test.js` 28, `nettest_full`/`_ceremony` green.

### v1.14.1 — playtester fixes: jab catch-up rule + 2 UI bugs
From a fresh round of playtest feedback (batch also seeded the big tutorial-landing-page rework, tracked separately).
- **Jab catch-up energy rule (engine).** Question raised: since jabs strip no shield, who banks catch-up energy on a jab? Ruled (per Aj): **every non-winner banks catch-up on a jab** (= winning-play size, so 1 energy). `applyRoundLoss` now mills all losers on a jab regardless of `MILL_SCOPE`; only **Special** wins consult the scope toggle (`targeted` = just the struck shield's owner). Previously the live `targeted` scope milled **nobody** on a jab (strikeTargets empty), so passing/losing a jab banked 0 — this reinforces the "don't fear losing, you still bank energy" lesson. New test: a jab loser banks 1 even under targeted scope. `test.js` **685/0**.
- **Bug: activation flash was a portrait card, not the landscape art.** `#artFlash .af` used `aspect-ratio:375/523` (portrait) + `background-size:contain`, so the landscape art (512×341, confirmed by decoding the webp) letterboxed inside a tall gold card. Fixed to `aspect-ratio:512/341`, `background-size:cover`, width-based sizing (`min(88vw,680px)`, `max-height:74vh`). Verified via standalone screenshot — full-bleed landscape with the glow hugging the image.
- **Bug: no energy pulse/`+N` when you lose a fight.** Same root cause as the jab rule — under `targeted` scope a jab loser milled 0, so energy never grew and `signalEnergy` had no delta to animate. The jab-mill rule fixes it (loser now banks 1 → render pulses). Special losses already pulsed (the struck player mills).

### v1.14 — no flushes, no straight flushes (combo simplification)
Shipped a rulebook simplification: **the straight-flush tier is gone for every deck.** A run of one suit now just scores as a plain straight (ranked by top card only); plain flushes were never a legal special. This is a single universal rule — **no mono-only carve-out** (Aj didn't want deckbuilding-dependent rules).
- **Engine:** new `NO_STRAIGHT_FLUSH` flag **defaults `true`** (shipped). `detectCombo` only emits `straightflush` when it's off; otherwise a same-suit run falls through to `straight`. `setNoStraightFlush(v)` exported and kept **only for A/B sims**. Every live consumer (game, net host, `mpsim`, `netview.test`) inherits the default automatically — no per-entry-point wiring.
- **Sim A/B:** `analysis.js` now runs SF-off by default; `SF=1 node analysis.js …` re-enables the tier for comparison. The measured effect (400 games/matchup, knight): every **pure** deck −0 to −1.1% (Wizard 56.3→55.2, Cleric 50.9→49.9, Rogue 46.9→46.4, Fighter flat), every **mixed** deck flat-to-up (Full Set the biggest single mover, +1.3, since it could never make an SF anyway). Meta ordering essentially unchanged — SF was a feel-bad ceiling perk for pures, not a balance driver. Removing it slightly narrows the pure-vs-mixed gap and is fairer to Full Set.
- **Text:** Rules screen jab/Special line drops "flush … or straight flush" → "pair, trio, straight, or full house" + a note that same suit doesn't matter. Engine header combo doc updated. Dead display labels (`TYPE.straightflush`, `COMBO_LABEL.flush`) left in place (never produced, harmless).
- **Tests:** the ~4 SF unit assertions rewritten to expect a plain straight (same-suit run = straight, low run doesn't beat a higher straight, straights compare by top card only), plus an A/B coverage pair that toggles `setNoStraightFlush(false)` to confirm the SF tier still returns for sims. `test.js` **684/0**, `netview.test.js` 28, `nettest_prefight` 13/0 (built game boots + plays clean).

### v1.13.1 — tutorial polish (playtest)
- **Coach panel docks to the right on desktop.** Bottom-center collided with the hand on wide screens; now `@media (min-width:721px)` anchors it over the empty right-side description column (clear of hand + pile), mobile keeps bottom-center. Still draggable.
- **Fixed raw `<b>` markup** leaking in the "make a Special" hint — it's set via `hint.textContent` (not innerHTML), so HTML tags rendered literally. Stripped to plain text.
- **Corrected the energy lesson wording.** Step 3 said "whoever wins banks that card as energy" — wrong: `play()` banks **every** card you play into *your* energy immediately, win or lose. Reworded (tutorial + the Rules screen's jab line) to "every card you play banks into your energy — win or lose; a jab win just takes the round."

### v1.13 — balance pass (deck round-robin) + revive dead cards
Ran `analysis.js` (now takes a 6th arg = AI tier, default `'knight'` = the old-Demon baseline; `'demon'` is the new top tier and would skew per-card jab stats via apex-hoarding). Old spread: Fighter (♣) weakest deck (45%), Wizard (♦) strongest (54%); Back Stab (S10) & Phantasmal Illusion (D10) sat at **0.00 cast** (dead), Counterfeit near-dead. Fixes:
- **Back Stab now fires (AI, no card change).** It's a plain non-Quick lockout in the rework, but the AI only ever tried to spring lockouts in the pre-fight Quick window (needs Hermes) — so the base card was never played. Added a proactive lockout branch in `playPhase` (1v1: skip the Rival's next turn when they're unlocked and holding ≥2). Cast 0.00 → **0.24**.
- **Phantasmal Illusion reworked** from the complex copy-a-Special `phantasm` mechanic to a clean **+6 valueBoost** (Odysseus/King lifts it to +7). The AI pilots valueBoosts, so it's alive now (0.00 → 0.06, 59% win). The `phantasm()` engine fn + UI branch are now dead code (harmless; no card has kind `phantasm`). Phantasm-specific tests replaced.
- **Fighter buffs (iterative, measured 1-by-1):** Instant Recovery draw 1→2 (undo the prior over-nerf); Superior Training dig 3/keep 1 → **dig 4/keep 2** (net +2 card & +2 energy at cost 5). Result: Superior Training win 46%→**53%**, Pure Fighter 45→**49** (parity), Mage Knight 49→52.5, Paladin 47→49.7.
- - **Wizard trim — tested then REVERTED.** Back to the Books (D6) was a 56.7% overperformer in 1v1; A/B tested a nerf (look 2/keep 1 dropped Pure Wizard 54→52.7). But the **multiplayer sim (`mpsim.js`, knight) showed the meta inverts**: Wizard is the *worst* deck in free-for-alls (x-fair 1.22 at 2p → **0.45 at 6p**, dies first), while Cleric *dominates* and scales with player count (1.08 → **1.61** at 6p) on its survival kit (Sanctuary/Holy Shroud/Holy Bow). Nerfing a Wizard card for 1v1 would kick it while it's down in MP — so D6 was **reverted to baseline** (look 3, keep 2). Net: no Wizard nerf shipped; the 1v1-vs-MP split is an intentional, documented tension (no single knob balances both). Sanctuary considered for an MP tweak but deliberately left as the symmetric "everyone gains a shield".
Counterfeit left as-is (inherently niche — shines copying jabs, hard for the AI). 
Remaining: after the D6 trim the deck spread is ~52.7 (Wizard) down to ~46 (Berserker/Full Set); Berserker (Fig+Rog) & Full Set are the structural laggards (no value engine / few pairs). `test.js` **681/0**, `netview.test.js` 28.

### v1.12 — 4-tier difficulty ladder (Minion · Fighter · Knight · Demon Lord)
Data-driven AI-tier work. A head-to-head sim (mirror decks, alternating starter, 600 games) measured the old **Fighter→Demon at 42/58** — a modest gap, and not enough separation to split Demon in two. Since the owner beats Demon 3–0, the ladder's weak spot was the *top*, so: **renamed the old Demon Lord → "Knight"** (identical behavior) and added a **new, tougher "Demon Lord"** on top. AI model (`ai.js`): `isSmart(diff)` = knight|demon|demonpass (the old top-tier behavior — strategic pass, higher effect thresholds, finisher targeting), `isTop(diff)` = demon only (new extras). Top-tier extras: **deeper resource caps** (drawT 5→6, rampCap 12→15 — digs harder for gas) and **hoards its apex/Aces** (`keepValue` +8 for rank 1/2 so it stops foddering trumps into jab rounds). No hand-peeking/cheating. Re-measured: **Fighter 43 / Knight 57**, **Knight 41 / Demon 59**, **Fighter 35 / Demon 65** — a clean monotonic ladder, Knight reproduces the old Demon exactly, and the new Demon Lord is a real step up (59% vs Knight). UI: setup dropdown + MP per-seat strength opts + `DIFF_NAME` + `resolveDiff`/`validDiff` + rules text all updated to the 4 tiers (`'knight'` threads straight through `AI.takeTurn`/`preFightMove`/`diffOf`). `test.js` **684/0**, `netview.test.js` 28; verified in-browser (4 options, Demon Lord game runs clean). Note: the internal sims (`analysis.js`/`mpsim.js`) now read `'demon'` as the *new* top tier; use `'knight'` for old-Demon comparisons.

### v1.11 — Basics redesign, Holy Bow AI, card flavour names, centered desktop buttons
Playtest batch:
- **Basics mode redesigned** — instead of removing J/Q/K from the deck, Basics now **keeps the whole 52-card deck** (J/Q/K are plain high cards on the full ladder 3→10→J→Q→K→A→2) but **disables transforms**: `transformGateOK`/`transformGateStatus` return a `basics` lock, so `activate` refuses a J/Q/K, the UI shows no ⚡ (`activatableCard` returns false for transforms in Basics), and the card panel describes them as "Plain fight card" (keeping the flavour name). The **transform-unlock ceremonies (ROAR/OVERDRIVE/REDLINE)** are auto-suppressed because `checkThresholds` reads `transformGateStatus().ok` (always false in Basics). The Form/Super **upgrade ladder** is hidden in the card panel in Basics. `st.basics` unchanged as the flag; the old deck-filter was removed.
- **Card flavour names on plain cards** — new `E.cardName(card)` returns the spec name even when a card has no active effect (the apex **2**, or a J/Q/K in Basics). The "Plain fight card" panel now shows e.g. "2♥ · Divine Intervention", "Q♠ · Pandora Form" — flavour on every card.
- **Holy Bow AI fix (Demon Lord)** — the AI equipped an own-highest buff (Holy Bow / Hero's Sword / Javelin) whenever it held one, even right before **passing** to an unbeatable Special (so the +2 did nothing and burned a per-round counter). Now an own-buff (`eqEff.delta>0 && !oppDelta`) is only equipped when it'll actually **fight** this turn (`!st.pile || legalFightPlays().length>0`); debuff sticks (oppDelta) and absorbers (Holy Shroud) stay playable anytime as defensive setup. Verified in node (holds vs an unbeatable SF; equips when leading / contesting a beatable jab).
- **Centered action buttons on desktop** — `#actions::after{flex:1}` at ≥721px mirrors `#hint`'s flex so the Sort/Clear/Activate/Pass/Fight cluster centers instead of pinning far right; mobile (≤720px) unchanged.
- **Tutorial coach panel now defaults to the bottom** (was top-center) so it never covers the played cards; still draggable.
`test.js` **684/0** (Basics test rewritten: J/Q/K stay in deck, transforms gated off, activate refused, `cardName` on the apex 2), `netview.test.js` 28.

### v1.10.1 — guided-tutorial playtest fixes + progressive disclosure
Live-playtest round on the guided duel: (1) **Read steps now lock the board** — while a "Got it / Next" step is showing, Fight/Pass/Activate are disabled (and the entry fns guarded) so the player can't play ahead of the lesson and desync it (`TUT.blocking()` = active && current step has no gate). (2) **Fight is gated to Specials** on the "make a pair" step (`TUT.needSpecial()` → Fight disabled + play rejected for a single card) so you can't jab past the Specials lesson. (3) **Robust effect picker** — step 6 no longer bricks when the rigged A♣ is gone: `tutPickEffect` scans hand+deck for the cheapest **draw**-preferred safe (no-target) effect, moves it to hand, and tops up energy until affordable; wording made effect-agnostic ("spend energy and fire its effect") so it can't mismatch the card. (4) **Draggable coach panel** (`initTutDrag`, grab handle + "· drag to move") so it never blocks the played cards; default moved to top-center, clear of the hand/action bar. (5) **Progressive disclosure**: once the tutorial is **completed** (`TUT.finish` → `setTutDone`) or the player clicks **"I already know how to play →"**, the prominent "▶ Guided first duel" button (and dismiss link) leave the crowded New Duel screen — the guided duel stays reachable as **"▶ Play the guided first duel"** inside Rules / How to play. Persisted via `cmf_tut_done_v1`. All verified in-browser (read-lock, special-gate, draw-pick, drag, declutter + reload persistence); `test.js` **682/0**, zero page errors.

### v1.10 — guided first duel (interactive tutorial, onboarding stage 2)
The parked stage-2 piece: an interactive coached duel that walks a new player through the core loop. Launched from **New Duel → "▶ Guided first duel"** (gold-accented). It forces a **Basics / 2p / Minion** game with a **rigged deal** (`tutRig`) so every lesson reliably works — you get two strong jabs, a rank-5 pair, a cheap effect (A♣ Prepare for Combat), a comfy energy pile, and a weak Rival (hand of rank 3–4 only) so **you win round 1 and lead round 2**. An 8-step coach (`TUT` module + `#tutPanel`) runs on top of the real board: welcome → **lead a jab** (gated) → jab banks energy → **make a pair** (gated) → Special strips a shield → **activate an effect** (gated) → the apex ladder → wrap. Action steps gate on real play via guarded `TUT.note('play'|'activate'|'roundWin', …)` hooks in `playCards`/`activate`/`announceRoundWin` (all no-op when the tutorial's off); read steps advance on a Next button. A **spotlight** (`.tut-spot` gold pulse) highlights the target element(s); since `render()` rebuilds the hand DOM and wipes the class, `TUT.reapply()` is called at the end of `render()` to re-add it each paint, and per-card prep (`tutEnsurePair`/`tutEnsureEffect`, injecting from the deck if needed) is deferred until it's actually your turn. Panel sits top-center (clear of the hand/action bar; phone variant sits just above the hand). Skip ✕ any time; auto-stops on `openSetup`/`endGame`; `tutorialMode` reset in `commitSetup` so normal duels are never rigged. The stale rules screen was also relabeled: **"▶ Guided first duel"** + **"📖 Rules / How to play"** are now distinct. Verified end-to-end in-browser (all 8 steps drive off real actions, spotlight survives re-renders, panel closes on Finish, zero page errors) — see `tutorial-demo.gif`. Pure UI/onboarding; `test.js` **682/0**, `netview.test.js` 28.

### v1.9.1 — setup polish: segmented Mode toggle + drop redundant MP start button
Two small setup asks. **(1)** The Mode **dropdown → two radio-style segmented buttons** ("Full game" / "Basics") in a `.segToggle`, gold-highlighted active state, each with a `title` tooltip ("The complete game — adds the J/Q/K Rides & Form Changes layer…" / "No transforms — a clean 3–10 + A + 2 game…") plus a live `#modeHint` line under the row that restates the selected mode (covers touch, where tooltips don't fire). The **"Mode" row label was dropped** — the toggle spans the full row width (`.modeRow .segToggle{flex:1}`) as a prominent picker right under the title, hint centered. Refactor: mode no longer read from a `<select>.value` — `pickMode(m)` sets `sel.mode`, `paintMode()` toggles `.active`/`aria-checked` and the hint; the old `setMode` change-listener and `.value` reads/writes were removed (reset now calls `paintMode()`). **(2)** In a **3–6p free-for-all**, the "Random start" button (the MP relabel of Go-second) was **redundant with "Roll for initiative"** — both pick a random starter — so it's now hidden in MP (`goSecondBtn` display:none when `mp`); 2p still shows Go first / Roll / Go second. Pure setup-UI change; `test.js` 682/0. Verified in-browser (2p + 3p, tooltip/hint text, Basics selection still starts a transform-free game).

### v1.9 — Basics mode + rewritten tutorial (onboarding, stage 1)
Onboarding pass. **(1) Basics mode.** New Duel now has a **Mode** selector: **Full** (with Rides & Forms) or **Basics** (no transforms). Basics keeps the *entire* real game — the 2-apex / A-14 ladder, every 1-10 archetype effect, equipment, shields, energy, catch-up — and only drops the **J/Q/K transform layer**, so nothing a new player learns has to be un-learned in the Full game (the empty 11-13 rungs between 10 and the A/2 trumps are exactly the space transforms later fill). Engine: `newGame(opts.basics)` filters ranks 11-13 out of every built deck (`c.rank <= 10`) and sets `st.basics`; a full-set Basics deck is 40 cards (52 − 12 faces). Netview mirrors `st.basics`. UI: `sel.mode` persists in setup (`setMode` select, default `full`), flows `commitSetup → gameBasics → startGame → ngOpts.basics`; the header matchup line shows a cyan **BASICS** badge; the tutorial shows a **BASICS MODE** pill when active. Online play is forced to Full for now (`gameBasics=false` in `hostStartRealN`) — Basics is a solo learn-the-ropes mode. Design decision (with the user): the dividing line is *transforms, not number range* — a classic 1-10 game (10 = top) was rejected because it teaches an inverted top-of-ladder. **(2) Tutorial rewrite.** The old "How to play" text was stale (said "0 low…9 high", never mentioned the apex or transforms). Rewritten to be rework-accurate and split into **The basics** (goal/Fighter Kick, jab vs Special, the real ladder 3→10→A→2-apex with strict-beat/ties, shields-as-cards catch-up, the energy cycle incl. the new ⚡ pulse, archetype effects + Quicks, ongoing equipment, deck-out) and **Advanced — Rides & Form Changes** (J=Ride, Q/K=Form Change, Super Mode, examples; explicitly framed as the layer Basics omits), plus a **Setup** section. Sectioned with `.rules h3`; setup button relabeled **📖 Tutorial / How to play**. Tests: 6 new in `test.js` (basics flag, no J/Q/K, apex ladder intact, 40-card count, Full unaffected). `test.js` **682/0**, `netview.test.js` 28. Verified in-browser: setup Mode row, BASICS badge, a Basics hand with no face cards, and the new tutorial all render clean. **PARKED (stage 2):** an interactive *guided first game* — scripted coaching prompts through the first few turns (lead a jab → make a Special → spend energy → …). The user chose "both, in stages"; the rules rewrite is stage 1, the guided game is the follow-up.

### v1.8.2 — energy pile "grew" signal (glow + floating +N)
Game-feel ask: the ⚡ Energy box changed silently when the pile filled. Now any INCREASE in a player's energy count triggers a brief **cyan pulse** on the `.nrgBox` (box-shadow + background flash, `@keyframes nrgGrow` .85s) plus a **floating "+N"** that rises and fades above it (`.nrgGain`, `@keyframes nrgFloat` 1s). Source-agnostic — it just diffs the count between renders (like `animateShields`), so it fires for fought cards banking to Energy (jab/special), a ramp (Gather Energy / Pray for Strength), and the catch-up mill alike. New `prevNrg={}` tracker (reset in `startGame`), `signalEnergy(el, player, n)` called from `render()` for both you and the 2p rival right after `energyChips` paints. Spending energy (a decrease) is silent; `prev==null` (first render of a game) never flashes; respects `reduceMotion()`. The float is appended to the box's persistent parent `.stat` (set `position:relative` on demand) so the box's per-render `innerHTML` rebuild can't wipe it; self-removes after ~1.05s. Pure UI — no engine/logic/netview change; works on host + client since both re-render from state. Verified in-browser: growing 2→7 shows a glowing `7♠` box with a `+5` float, no page errors. `test.js` **676/0**, `netview.test.js` 28.

### v1.8.1 — active-modifier readout on your hand (value vs cost)
Playtest confusion: a J♦ jab beat a rival's boosted 10♣ and looked wrong (11 vs 11), because the board never showed that the J♦ was actually swinging at 12 — Jack (11) + your own Giant Boar (+1, offensive/your turn); the rival's 10♣ defends at 11 (10 + their Javelin; their Boar can't defend, offensive-only). Not a bug — but invisible. Added a **`#playMods` status strip** above your hand that lists what's modifying YOUR plays right now and from where, split into two axes the player asked for: **value** (Giant Boar, equipment ±, a charged pre-fight play) and **cost** (Giant Owl −1 / Giant Ram +1 on your first effect). Same-direction sources net into one chip with the list — "value +3 from Giant Boar, Hero's Sword"; opposing signs split into one chip per source so nothing's hidden — "+1 Giant Boar" (green) / "−2 Spiked Armor" (red); cost chips are blue ("cost −1 Giant Owl"). Backed by two exported engine helpers, `playModifiers(st,p)` / `costModifiers(st,p)`, that itemize exactly what `applyEquip` sums and what `rideCostDelta` applies (so the readout can never drift from the math). Boar correctly appears only on your turn and drops on the rival's; cost chips vanish once your first effect is spent; hidden while spectating / at game over (`#playMods:empty` collapses). `renderPlayMods` runs in `render()`. Verified in-browser (net game, forced board): renders "value +3 from Giant Boar, Hero's Sword" and the mixed value+cost case, no page errors. Tests: 6 new assertions in `test.js` (Boar-on-your-turn, two-source net, opponent debuff, Boar-off-on-rival-turn, Owl/Ram cost, cost clears after first effect). `test.js` **676/0**, `netview.test.js` 28.

### v1.8 — equipment is ONGOING on a standing pile (not locked at play time)
Playtest ask + design clarification: equipment should behave like an enduring enchantment (MTG-style) — its ±value modifier tracks the board continuously, including on a fight ALREADY on the table — while only timing-gated boosts (the pre-fight `+N to next play` and Giant Swan defensive) stay frozen at play time, and Giant Boar (offensive) stays excluded from stored piles. Previously the pile's value locked completely at play time; the only thing that re-valued a standing pile was *removing* an equipment (the old `unapplyEquipFromPile`). So equipping **Spiked Armor** in response to a rival's standing Special didn't blunt it — the user's exact report ("it says BOOSTED +1 but it should say −1": rival's 9♣ pair had Hero's Javelin +1 locked, and the Spiked Armor −2 equipped afterward never applied). Fix: `play()` now stores the pile as `{ combo, byPlayer, raw, rawKey0, lockedDelta, mod }` where `lockedDelta = playBoost + swanValue` (Boar excluded), and a new **`refreshPile(st)`** recomputes the live value from scratch: `combo.value = raw + lockedDelta + equipDelta(st, byPlayer)`. `refreshPile` is called wherever equipment changes — the `equip` resolution (new debuff/buff re-values the table immediately), the removal path (Disarm/Sabotage/Forceful Strip/Plead — replaced `unapplyEquipFromPile`), and `useEquipment` retire. Because it recomputes rather than incrementally patches, add and remove are both correct. Phantom (Illusion) piles are guarded out (`raw == null`), so they keep their own locked value. `refreshPile` is exported for tests. Net effect for the reported hand: equipping Spiked Armor now drops the rival's standing pair to −1 as expected. Tests: 7 new assertions in `test.js` (debuff-after-stand → mod −2; remove → back to raw; buff-after-lead → +1; exact Round-7 Javelin+Armor → −1) and a verified end-to-end `activate`→equip→refresh (rival pile 9→7). `test.js` **670/0**, `netview.test.js` 28 (mirror carries the fresh `combo.value`/`mod`, no netview change needed).

### v1.2 changes — Back Stab pre-fight over netplay, dig-scope fix, UI pass
- **Back Stab pre-fight window in netplay (#3, done).** The pre-fight (Back Stab) window — the one interactive beat that fires BEFORE a fight/pass, owned by the NEXT seat — now travels both ways in 3–6p. `hostPreFight(g, proceed)` opens it: a host holder pops `promptHostPreFight`; a remote holder parks `netReact={kind:'prefight',seat}` and the holder's client pops `promptHumanPreFight` from its mirror (`preFightQ===YOU`), springing over the wire (`{op:'prefight',id}` / `{op:'prefightPass'}`). Wired into both the host's own `doFight`/`doPass` (via `NET.hostPreFight` when `hostLive()&&MP()`) and the remote-turn path (`hostApplyMoveN` runs `hostPreFight` before applying a remote seat's play/pass; a locked active seat is force-skipped). **Engine bug fixed:** a pre-fight Back Stab defaulted its target to `nextPlayer(holder)`, which is only the active player in 2p — in 3p+ it hit the wrong seat. `preFightCast` now defaults `opts.target = st.turn` (the active player). Under REWORK, Back Stab is a Quick only with Hermes Mode (any Q + any K form, cost 10); `eligiblePreFightQuicks` was using form-blind `effectOf` — now uses `effectFor` so the Hermes-empowered 10♠ is recognized. Test: `node nettest_prefight.js` (13).
- **Dig discard is scoped to the looked-at cards (correctness).** Superior Training / Back to the Books / Never Out of Options ("look at top N, bank M to Energy, keep the rest") previously drew N into hand then opened a discard from the WHOLE hand — you could bank a pre-existing card. The engine's `draw` case now records the just-drawn ids and sets `discardPending.from = drawnIds`; `resolveDiscard` restricts (and auto-fills) to that set. UI: the discard `pick` carries `from`, non-eligible hand cards render `.notpick` (dimmed, unclickable), and `togglePick` rejects them. Mirror carries `discardPending.from`. Test: 5 new assertions in `test.js`.
- **UI pass.** (a) "Last played" pile moved from top-left to center-left (`#beaten{top:50%;transform:translateY(-50%)}`) so it no longer overlaps the rival Forms & Rides labels. (b) Equipment indicators now paint the card art behind the text (light scrim for legibility, `.hasArt`), bigger name/effect text, and a compact `◆ N` counter (was a row of pips); hover/tap shows the full card + rules in the description panel. (c) Forms/Rides no longer push "X used Y Form" into the description box — the art still pops center-stage (`flashArt` instead of `revealEffect` for `kind==='transform'`), and a form's full text is read by hovering it in the on-table zone (`renderFormsZone` mouseenter/click → `showCard(f.card)`). `dbgForceAll` extended with `opts.forms` / `opts.equip` for staging these in tests, plus `__cmf.lock(seat)` / `__cmf.handOf(seat)`.
- Regression: `test.js` **659/0**, `netview.test.js` 28, `nettest_prefight.js` 13; existing 2p/3p net suites unchanged.

### v1.2.1 — dead-code cleanup pass (done)
Removed the entire superseded **old functional-board netplay path** from the NET module — the pre-full-UI approach where both ends rendered from a redacted `NetView.snapshotFor` snapshot and submitted high-level intents. It was fully orphaned (the live protocol is join/move/mirror/ceremony; onMsg has no `intent`/`snap` handler). Deleted: `hostStart`, `broadcastAll`, `seats`, `soleOpponent`, `applyIntent`, `submit`, `renderNetOldBoard_UNUSED`, `canAct`, `paintInfo`, `buildHand`, `interactiveHand`, `selIds`, `btn`, `renderActions`, `statusMsg`, `pips`, `oppPanelHTML`, and the orphaned `snap`/`sel` NET vars. **Kept** `resolveIds` (used live by `hostApplyMoveN`) and `NetView.snapshotFor` (app-unused now, but a pure, unit-tested helper — retained for the 28 netview tests, zero runtime cost). Retired the two obsolete test files that drove the old board: `nettest2.js`, `rtctest.js` (superseded by `nettest_full.js` + `nettest_rtc.js`). Build −~10KB. Full regression re-run green: `test.js` 659, `netview.test.js` 28, and the live net suite (`nettest_deckpick` 8, `_3p` 7, `_rtc` 11, `_rtc3` 10, `_counter` 8, `_activate` 6, `_guard` 8, `_ceremony` 9, `_prefight` 13). Residual: ~40 lines of now-unused old-board **CSS** left in `NETCSS` (some classes like `.netmsg` are still shared with the live signaling lobby, so trimming needs a per-class audit — deferred, inert).

### v1.2.2 — Giant Boar offensive/defensive fix
Giant Boar (J♣, the OFFENSIVE super keystone, "+1 on your turn") was baking its +1 into the **stored pile value** in `play()` — so its owner's plays stayed boosted when the *opponent* had to beat them on their turn, i.e. an offensive keystone acting defensively (the job of Giant Swan). Fix: `play()` now strips Boar's contribution back out of the stored pile — `storedDelta = (eff.value − combo.value) − rideValue(Boar) + swanValue(Swan)`. Boar still rides in `eff` to clear the `beats()` check (it helps you attack), but the pile stores the raw value + equipment/pre-fight/Swan only. `boosted` return flag now reflects the stored value (a pure-Boar lead no longer logs/labels "boosted"). Giant Swan (defensive, baked into the pile) unchanged. Tests: 3 new assertions in `test.js` (Boar lead stores raw value; Boar beats a tie but stores raw; verified Swan still stores +1). `test.js` **662/0**.

### v1.5.1 — Forms & Rides = mini-cards; Activate badge off the art (UX)
Two playtest UI asks. (1) **Forms & Rides zone** now renders each Form/Ride as just a compact **mini-card** (`cardEl` art + rank/suit corner index) in a `.formRow`, dropping the inline name/tier label — all the detail (name, tier, full ability) reads in the description box on hover/tap (`showCard(f.card)`, already wired). Much more compact; clears the label/message pile-up in narrow views. Old `.formCard`/`.formName`/`.formTier` styles replaced with `.formMini`. (2) **Activate ⚡** in the description panel was an 84px box pinned mid-image (`top:145px`) — overlapping the art. Now a compact 34px circular gold **corner badge** (`left:22px; top:20px`, `#side` is `position:relative`) tucked in the image's top-left, off the central artwork; mobile strip variant matched. Pure CSS/render; `test.js` 662/0, verified in-browser. (3) **Removed the "X used …" banner** (`cvBanner`) from the description reader — it crowded the box. `revealEffect` still drops the played card into the reader and gives it a flash pop; the play-area message + center-stage art flash already announce who did what. Dead `.cvBanner` CSS removed too. (Note: the game correctly allows only one Form per rank — a new Ride/Queen/King displaces the old one to Energy, engine `transform` case; a screenshot showing two Rides was a `dbgForceAll` test artifact that bypasses the play rules, not reachable in real play.)

### v1.5 — equipment flash on counter change / leaving play (UX)
Equipment counters changed silently (an absorb spent a Holy Shroud counter, or a removal/spend retired it) with no visual cue, so a shroud "vanishing" read as a bug. Now the UI tracks each equip's counter across renders (`equipFx` map, keyed `zone:id`) and: (a) **flashes the box** with a gold glow for ~1.3s when its counter drops, and (b) when an equip LEAVES play (spent to 0 → Energy, or removed by Plead for Peace/Disarm/Sabotage) it holds a faded **"◇ GONE" ghost** in the slot for ~1.3s before disappearing, so the eye catches it. Reason-neutral wording ("gone", not "spent") since the UI can't tell spend from removal — the log has the reason. `scheduleEquipFxClear` fires one delayed re-render so the flash settles even with no other render; `equipFx` resets in `startGame`. Applies to your own zone (all modes) + the 2p rival zone. Pure `renderEquipZone` UI — no engine/logic change; `test.js` 662/0, `nettest_3p` 7. (Prompted by a playtest: a spent Holy Shroud and a Plead-for-Peace'd one both vanished with no cue — both were correct engine behavior, just invisible.)

### v1.4.1 — "Passo": grace-expiry hands the seat to a caretaker AI (not a drop)
Instead of eliminating a timed-out player, the seat is handed to **Passo** — a caretaker AI that only ever PASSES (leads its lowest card when forced to lead) and auto-resolves forced windows the minimal/safe way (smart auto-discard via `resolveDiscard`, take-the-hit on guards, decline responses, pass the pre-fight window). The player's standing (shields, cards, position) is fully preserved, and they **reclaim the seat the instant they reconnect** (`hostOnPeerBack` clears the passo flag; a pending scheduled step no-ops via the `isPasso` guard). Implemented host-side by feeding the SAME intents a remote client would send through `hostApplyMoveN`, so all the tested application + resume machinery is reused — `passoStep(seat)` reads whatever the seat currently owes (`netReact`/`netParked`) and sends the caretaker response; `maybePasso(seat)` is called at every park site so a newly-parked Passo seat auto-acts (on a ~450ms delay, which also breaks recursion across chained passes). The manual **Drop** button remains a hard eliminate (concede) in both the holding and Passo states. Grace-expiry ticker now calls `passoTakeover` (sets `discon[seat].passo`, keeps the seat) instead of `hostDropPlayer`. Banner shows "🤖 Passo is covering P3 (auto-passing) — they can rejoin anytime · [Drop P3]"; bystanders get a `{t:'peer',ev:'passo'}` note. Dbg: `__cmf.passo(seat)`. Test: `nettest_discon3.js` extended to 22 — grace-expiry → Passo (NOT eliminated), Passo auto-passes on its turn (round resolves, no hang), reconnect reclaims the seat, manual Drop still hard-eliminates. Passo's forced-window resolution reuses the `hostApplyMoveN` discard/guard/decline/prefight handlers already covered by `nettest_discard` + `test.js` auto-pick.

### v1.4 — #1 disconnection handling (done)
A dropped peer no longer freezes the table. When a live player's connection drops mid-game, the host **holds their seat for a 90s grace window** (configurable) with a top-of-table banner showing a live countdown + a **Drop <seat>** button; bystander clients show "a player disconnected — waiting…"; the dropped client shows "Reconnecting to the host…". Three ways it resolves: (1) **self-heal** — WebRTC ICE recovers to connected → resume seamlessly, banner clears; (2) **re-join** — the player reconnects with the same `cid` (re-invite) → reclaims their seat and resumes; (3) **drop** — the host clicks Drop, or the 90s window **auto-expires**, and the seat is **conceded** (`E.concede` via `onOpponentConcede` — the tested path: eliminate, clear their obligations, continue driving the survivors; ends the game if one Rider remains). A dropped/eliminated player who reconnects rejoins as a **spectator** (the v1.3.1 view) rather than re-entering the game. Core handlers `hostOnPeerDrop` / `hostOnPeerBack` / `hostDropPlayer` are wired to the real WebRTC events (`lpc.oniceconnectionstatechange` disconnected/failed→drop, connected/completed→back; `ldc.onclose`→drop) and to the client's own `pc` ICE state; the client `{t:'peer'}` broadcast drives the bystander banner; a re-join (`onMsg` 'join', same cid) restores the seat. Dbg hooks: `__cmf.drop/reconnect/dropNow/graceMs/disconShown`. Tests: `node nettest_discon3.js` (19, state machine over BC via hooks — drop→hold, reconnect→resume, grace-expiry auto-drop, spectate-on-reconnect, manual drop ends game) + `node nettest_rtc_discon.js` (5, REAL WebRTC — closing the client's page raises the host banner, proving the production events reach the handlers). `test.js` 662/0; WebRTC hub (`nettest_rtc` 11 / `nettest_rtc3` 10) still connects & plays.

### v1.3.1 — defeated players can spectate
A knocked-out client already kept receiving mirrors (the host broadcasts to every seat); this adds the missing UX so it reads as spectating rather than a frozen/empty board. When `MP() && you.eliminated && !finished`: the turn indicator shows "👁 Spectating — P2’s turn" (tracks whose turn it is live), the action hint shows "💀 You’re out — spectating the rest of the duel.", the (empty) hand fades via `body.spectating`, Fight/Pass stay disabled, and the header offers **New Duel** (leave) instead of Concede (`newBtnLive` returns false once you're eliminated). The board otherwise updates live — opponent panels, pile, ceremonies (ROAR/threshold beats), battle log — so you watch the rest of the duel and the end screen fires normally when it finishes. Assertions folded into `nettest_elim3.js` (now 15). `test.js` 662/0.

### v1.3 — #4 N-player elimination over netplay (done)
Verified (and locked with a test) that a mid-game **Fighter Kick** elimination flows correctly over the wire in 3–6p. The engine already handled it (`resolveRoundWin`→ kick at 0 shields → `eliminatePlayer`, finish only when `aliveCount<=1`); this proves the netplay layer carries it: the kicked client sees itself `eliminated` in its mirror and keeps receiving mirrors as a spectator, `driveN`/`nextPlayer` skip the eliminated seat so control returns to a living player, the survivors advance to the next round, and — in the terminal case — the final kick that reduces the table to one Rider finishes the game and broadcasts the finished mirror to every remaining client (including the already-out spectator). Test: `node nettest_elim3.js` (12) — phase 1 kicks one of three (two continue), phase 2 kicks the last opponent (game over). Added `__cmf.finished()` / `.winner()` / `.eliminated(seat)` dbg accessors (read live `state`, so they work on host and client alike). (Deckout elimination — the other N-player elimination trigger — is now also wire-tested: see v1.6.) `test.js` **662/0**.

### v1.7 — Giant Owl/Ram first-effect bug + collapsible Forms zone
- **Owl/Ram "first effect each turn" was permanently spent (bug fix).** `firstEffectThisTurn` compared `st._effTurn !== st.turn`, but `st.turn` is a seat index that repeats every one of a player's turns — so once a seat activated any effect, `_effUsed` stuck true forever and the Giant Owl −1 discount / Giant Ram +1 tax only ever applied on that seat's very first activation of the whole game. (Symptom: Owl owner with 5♦ couldn't pay Back to the Books, cost 5 — the check used the full 6.) Fixed: `firstEffectThisTurn` is now just `!st._effUsed`, and `_effUsed` is reset to false on **every turn advance** (play/pass/forced-skip/phantasm/round-start/round-win/deckout). Test added: after a turn advance the flag clears so the discount/tax re-applies. `test.js` **663/0**.
- **Collapsible Forms & Rides zone (UX, for narrow/phone crowding).** Each zone now defaults to a compact tap-to-expand **chip strip** — just rank/suit (`J♦ Q♦`), or the single **⚡ INCARNATION** pill when Super is live. Tap the strip → expands to the full mini-cards (tap one to read it); tap anywhere outside → collapses back (`formsOpen` state + a document-level outside-click handler → `collapseForms`). Targeting always forces the full-card view (so Rides/Forms stay clickable for removal). Massively shrinks the left-edge footprint that was colliding with the last-played pile in portrait. `formsOpen` resets on new game.

### v1.6 — deckout elimination over netplay (done)
The other N-player elimination trigger, now wire-verified. A player who wins a round (seizing the lead) but whose deck + shuffle pile are empty and whose hand emptied on that play can't draw at the new round's deal → **deck-out**. In N-player that's an elimination (not game-over): the decked-out client sees itself eliminated → spectator mode, the game continues with the survivors, and control skips the empty seat. Same `finishRoundWin` engine path as before (`result.deckedOut`/`eliminated`), just proven over the wire. `dbgForceAll` extended with `opts.deck`/`opts.shuffle` (per-seat) to stage an empty library deterministically. Test: `node nettest_deckout3.js` (8). `test.js` 662/0.

### v1.6.1 — NETCSS trim + stale deck-count labels
Removed the dead old functional-board CSS from the `NETCSS` string — audited every class against the live lobby/signaling render functions first. Cut: `.netopps`, `.netopp`(+`.active`/`.out`/`.on`/`.ometa`), `.opips`/`.pip`(+`.off`), `.netpile`, `.pilelbl`, `.netmine`/`.mystat`, `.myhand`(+`.card`/`.card.sel`), `.netinfo`(+`.netinfohint`/`.cvText`/`.cvName`/`.cvType`/`.cvUpg`/`.cvUpgName`), `.netactions`. **Kept** everything the live lobby still emits: `#netroot`, `.netbar`, `.ok`/`.wait`, `.netmsg`(+`.err`), `.netbtn`(+`.go`/`.alt`/`.ghost`), `.nethint`, `.netlobby`(+`h3`), `.sigbox`, `.deckSel`(+`:disabled`), `.lobbyStatus`, `code`. Verified the RTC + BC lobbies still render correctly (screenshots). Also fixed two stale **"all 40"** deck-count labels → **52** (the `full` deck option + the how-to text; Full Set = 4 suits × 13 ranks under REWORK). `test.js` 662/0.

### PARKED for next session
- **Manual re-invite UI for a hard drop** — self-heal (transient ICE) and same-cid re-join already work; a fully dead (`failed`) connection now goes to Passo (caretaker AI) at grace end, and the player rejoins as themselves whenever they reconnect. A "re-invite this seat" button (host generates a fresh offer for the held seat mid-game) would speed a hard-dropped player's return over serverless copy-paste signaling. Nice-to-have.

_(Netplay is feature-complete: 2–6p over BroadcastChannel + WebRTC, full interactive parity, deck picker, client ceremony, choose-who-loses-a-shield, targeting, Back Stab pre-fight, both elimination triggers, spectating, disconnect→hold→Passo→reconnect/drop. Dead old-board code + CSS all removed. Remaining items are polish/nice-to-haves.)_

### v1.1 changes — N-PLAYER netplay (3–6 players, BroadcastChannel + WebRTC)
Netplay now runs 2–6 players. All new logic is gated on `MP()` (>2 players) so the 2p path is byte-for-byte the old one.
- **Multi-client lobby + seat assignment.** Each client has a stable `myId` (so the host tells a new joiner from a 350ms retry on the shared bus). Host maps `cid→seat` (1..5; +host = up to 6), stores each seat's deck pick, and assigns seats on `join`. Host lobby shows the joined count and a "Start (N Riders)" button (enabled at ≥1 joined). `hostStartRealN(hostDeck)` builds `seatDecks`/`seatDiffs` per seat, marks joined seats `seatCtrl='remote'`, and starts a real N-player game. Picks stay hidden (no counter-picking); per-seat `{t:'setup', decks}` gives each client its own board label.
- **N-player host driver** (`driveN` + `hostApplyMoveN`, in `var NET`). After the host acts, `driveN` steps the opponent seats: the host's OWN reactive windows pop its modals; opponents' reactive windows auto-resolve (Stage-1, like AI — see limit below); each opponent's turn parks (`netParked`) for its wired move. `hostApplyMoveN(seat, it)` is **seat-authoritative** (only the seat whose turn it is may move; on WebRTC the seat is the channel's bound seat, not client-claimed), applies play/pass/activate for that seat, un-rotates the client's target index back to absolute (`(target+seat)%n`), and runs the per-seat ceremony on a round win.
- **Per-seat mirror + ceremony routing.** `mirrorFor(seat)` and `ceremonyResFor(res, seat)` rotate to each seat's view; `broadcastMirror`/`sendCeremony` now use `sendTo(seat, …)` so **a seat's private hand never reaches another peer** (critical over the internet).
- **WebRTC N-way (host-centered star).** The RTC host runs a **hub** (`hubMode`) of N-1 DataChannels: `hostNewInvite()` creates one PC+DataChannel per invited player (sequential copy-paste invites in the host lobby), `hostAddChannel` feeds each into the hub, `send` broadcasts, `sendTo(seat)` targets one channel via `chanSeat[]`, and the channel a move arrives on is the authoritative seat. Clients each hold one channel to the host (no client↔client links). Joiner UI unchanged.
- **Complete REACTIVE parity (v1.1.1).** Remote opponents now handle their OWN reactive windows in 3–6p — Counter another player's Technique, spring a round-win guard (Leyline), and choose their own forced discards — not just their turn. The client side needed nothing (`clientCheckWindow` already reads the seat's rotated mirror generically). Host-side: `driveN` calls `netOppWindow()` — the next opponent-owed window needing a real choice (auto-resolving no-choice cases, e.g. a shield with no guard) — and **parks** it (`netReact={kind,seat,g,resume}`, broadcast) instead of auto-resolving; `hostApplyMoveN` handles `respond`/`decline`/`guard`/`guardPass`/`discard` gated on `netReact.seat` (a reactive op is valid when it's your window, even if not your turn — separate from the turn-gated play/pass/activate). The host's OWN cast settles via `hostSettleN` (host answers via modal; each opponent's response window parks for that seat). Test: `node nettest_react3.js` (7) — host casts Gather Energy, remote client 1 gets the Counter window from its mirror and counters over the wire.

**Choose-who-loses-a-shield (v1.1.2).** In `chosen` mode (the live 3–6p default), the round winner now PICKS whose shield to strip instead of the engine auto-pressuring the leader. Engine: `resolveRoundWin` splits — when `lossTargetInteractive(st,winner)` says the winner is human, it defers (sets `st.pendingLossChoice={winner,cands,winSize}`, returns `needsLossTarget:true`) and `E.chooseLossTarget(st, seat)` completes the mill+strike via the shared `applyRoundLoss`. Default is auto (predicate null) so 654 tests + AI sims are unchanged; the UI installs `E.setLossTargetInteractive(w=>isHumanSeat(w))` in `startGame`. UI: `promptLossTarget`/`chooseLossSeat` let the winner tap a rival panel (reusing the opponent-panel `targetable` wiring). Single-player MP handles it in `runOpponents`; netplay in `hostResolveWin` — the **host winner** picks locally, a **remote winner** parks (`netReact.kind='loss'`), the mirror carries a rotated `pendingLossChoice`, the client's `clientCheckWindow` pops the picker, and `{op:'lossTarget'}` un-rotates back on the host (`hostSettleRoundThenCeremony` then resolves the struck seat's guard window before the ceremony). Tests: `node nettest_losspick3.js` (7, host picks) + `node nettest_losspick_remote3.js` (6, remote picks over the wire).

**Targeting cards verified.** "Target 1 rival" effects (discardOpp/destroyShield/etc.) hit exactly the chosen seat — confirmed at the engine level (Node) and in netplay: `node nettest_target3.js` (6) — a client picks a specific opponent panel; the rotated index un-rotates to the right absolute seat and only that opponent is hit.
- **Tests:** `node nettest_3p.js` (7, three tabs over BroadcastChannel), `node nettest_rtc3.js` (10, three peers over real WebRTC — two sequential invites, per-seat routing, round sync), `node nettest_react3.js` (7, remote reactive Counter). All 2p tests + single-player unchanged.

### v1.0 changes — NETPLAY interactive windows (full-UI reuse)
Netplay now drives the **real single-player board on both ends** through EVERY interactive window (play/pass, activate, Counter, shield-guard, forced-discard) — full two-way parity.

**Client round ceremony (v1.0.2).** The client used to *snap* through round resolutions — it only got the raw shield-shatter FX (via `render()`→`animateShields`), missing the `#roundfx` banner beats, the round-result message/log, and the threshold-unlock beat (those ran only in the host's `resolveRoundCeremony`). Now the host's two round-resolution paths (`hostFinishRound` for a rival-triggered win, `finishPassRound` for a host-triggered win) call `NET.sendCeremony(res)` → `{t:'ceremony', res}` **before** running their own ceremony; `ceremonyResFor` seat-swaps the display fields (2p) to the client's view. The client's `clientPlayCeremony(res)` reuses the real, purely-visual beat players (`announceRoundWin` + `playPreBeats` + `flushThreshold` + `playRoundCardBeat`) — it sets `holdShields` so the shatter lands ON the "loses a shield" beat, and `flushThreshold` shows the client's OWN tier unlock (ROAR/OVERDRIVE/REDLINE), since `checkThresholds` reads the client's gate. No engine mutation on the client — the authoritative new-round cards arrive via the final mirror. **"Round N" card-banner too**: `res.newRound` is available at event time (set in `finishRoundWin`), but `res.draws` isn't (deferred), and the banner must sync with the card fly-in — so `applyMirror` HOLDS the new-round deal mirror (detected by `handGrew`) while the pre-draw beats play, and `finishClientCeremony`→`revealRound` applies it with `enterDelayBase` set + shows the banner, so the banner leads and the cards deal in behind it (matching the host's deferred draw). Falls back gracefully (banner skipped) if the deal mirror lands outside the window. Test: `node nettest_ceremony.js` (9) — host wins round 2 with a straight; asserts the client shows the pre-draw banner, logs the result, fires the ROAR threshold beat, its shield drops, it advances to round 3, and the "Round N" card banner shows (caught by an in-page watcher).

**Deck picker + lobby (v1.0.1).** Online duels no longer force `full`/`full`. After the transport connects, both sides land in a **deck-picker lobby** (new `renderLobby` in `var NET`) instead of the host auto-starting: the client chooses a deck and clicks **Ready** (sends `{t:'join', deck}`), the host chooses its own and clicks **Start Duel** (enabled once the opponent is ready). `hostStartReal(hostDeck, clientDeck)` resolves each pick (`resolveDeck`, so `random` works) into `youDeck`/`rivalDeck`/`seatDecks` and deals them; a `{t:'setup'}` message hands the client the concrete deck keys for its board labels. **Picks are hidden in the lobby** (no counter-picking — the host sees only "opponent locked in", never which deck); both reveal on the board when the duel starts. The join-retry now carries the deck, and the host re-renders only when readiness actually changes (so 350ms retries don't clobber the host's dropdown). Test hook lobby helper: `nettest_lobby.js` (`startDuel(host, join, {hostDeck, clientDeck})`).
- **Client can ACTIVATE over the wire** — techniques, rides/transforms, Forceful Strip (removeEquip), Counterfeit. Client gates send `{op:'activate', id, target, copyId}`; the host applies `E.activate(hostState, 1, id, opts)` then settles. **Fixed a critical bug**: the host called `E.activate` with the options object in the *cardId* slot, so every client activation failed with "You don't hold that card." Caught by the new deterministic test.
- **Client can COUNTER the host's techniques.** `settleWindows` is now host-aware: a window owed to the remote Rival **parks** (`netSettle`) and broadcasts instead of running the AI; the client's mirror shows `respondFor===YOU`, `clientCheckWindow()` pops the normal **Respond?** modal, and `humanResponds`/`humanDeclines` send `{op:'respond',id}`/`{op:'decline'}`. Host applies and re-enters `hostSettle` (handles counter-a-counter). Host's own windows still pop its normal modal.
- **Remote SHIELD-GUARD (round-win Leyline).** When the host wins a round WITH A COMBO (`wonWithCombo`, so a shield is stripped — jab wins strip nothing, and round 1 is jabs-only) and the losing remote holds an immunity card, `hostAfterRivalMove`/`hostRivalWindows` park (`netGuard`) instead of auto-passing; the client's mirror shows `shieldResponse.q===YOU` and `clientCheckWindow()` pops `openShieldGuardModal`, whose Guard / Take-the-hit buttons send `{op:'guard',id}`/`{op:'guardPass'}`. (No guard offered when there's no guard card — auto-pass.)
- **Remote FORCED-DISCARD (own choice).** When the host casts a discard-opponent Technique, `hostAfterOwnCast`→`hostRivalWindows` park (`netDiscard`); the client gets the real discard PICKER (`promptHumanDiscard`) on its own hand, chooses which cards to pitch, and `confirmPick` sends `{op:'discard',ids}`. **Fixed a bug**: the host handler passed card *objects* to `E.resolveDiscard`, which matches on id *strings* (`choose()`), so nothing was discarded — now passes `it.ids`.
- **Host-side windows** (host's own shield-guard / forced-discard from a Rival technique) still pop the host's normal modals via `hostRivalContinue`. Full two-way parity — every interactive window now belongs to whoever actually owns it.
- **Fixed a modal-flicker bug**: `applyMirror` called `hideOverlay()` on *every* incoming mirror, hiding the client's open modal. Now it keeps the overlay up while a modal window is owed (`owedModal`) and leaves the board unlocked for the discard picker (`owedDiscard`).
- **Test hook** `?dbg=1` → `window.__cmf.force(hostHand, rivalHand, hostEnergy, rivalEnergy)` + `.turn()/.hand()/.pending()/.energy()/.shields()` — **inert without the URL param**. Powers four new deterministic Playwright tests:
  - `node nettest_counter.js` (8) — remote client Counters the host's Technique over the wire.
  - `node nettest_activate.js` (6) — remote client activates a Technique on its own turn.
  - `node nettest_discard.js` (7) — remote client chooses its own pitches for a host discard Technique.
  - `node nettest_guard.js` (8) — remote client springs Leyline to guard a round-win shield loss.
  - `node nettest_deckpick.js` (8) — host picks Pure Wizard, client picks Pure Rogue in the lobby; verifies each side is dealt its own pick (all ♦ / all ♠) and the board labels match.
  - `node nettest_rtc.js` (11) — the whole thing over **real WebRTC**: automates the copy-paste offer/answer signaling, opens the DataChannel, runs a Counter over the wire, then plays rounds. Launch chromium with `--disable-features=WebRtcHideLocalIpsWithMdns` and use `stun=0` so the two tabs connect over loopback ICE with no external STUN/TURN (that's how the test dials `?net=rtchost/rtcjoin&stun=0`).
- Regression: `test.js` **654/0** (single-player byte-identical), `netview.test.js` 28, `browsertest.js` smoke, `nettest_full.js` core loop. (`nettest2.js`/`rtctest.js` retired — they drove the old functional board.)

### v0.96 changes
- **Threshold unlock (ROAR/OVERDRIVE/REDLINE) now gets its OWN beat (Aj).** It used to fire from `animateShields`→`checkThresholds` mid-shatter and overlap the round-win banner. Now `checkThresholds()` QUEUES it (`pendingThreshold`) and `playPreBeats`'s step loop plays it as a standalone beat **immediately after the shield-break beat** (the trigger), clearing `#roundfx` first so it stands alone; `flushThreshold()` covers the reduced-motion path. Verified `threshmon.js`: threshold fires, **0 frames** where `#roundfx` and `#thresholdfx` both show.

### v0.95 changes — ART: raws everywhere, layouts retired (Aj)
- **Layouts (composed card faces / `faces.js`) RETIRED.** They got hard to render with Super forms and we're still balancing. The game now uses the **raw illustrations (`CardArt`) everywhere** — description box (`showCard`), technique flash (`artFlash`), and gallery detail (`openCardDetail`) all switched from `CardFace`→`CardArt`; CSS updated to landscape 3:2 (`.cvBigArt`, `.galFace`). `build.js` no longer inlines `faces.js` (stub `window.CardFace={}`), saving ~435KB.
- **All 40 raws now baked in** (was Cleric+Wizard only). Rebuilt `art.js` from Aj's device folder `~/Downloads/raw/{cleric,fighter,rogue,wizard}` via **`build-art.js`** (`node build-art.js` — resizes to 512w webp q80, ~1.7MB total). Prefix→suit map: **H→♥, F→♣, R→♠, D→♦**, ranks 1-10. J/Q/K transforms have no raws → drawn-card fallback (fine).
- **Sanctuary / Holy Shroud image swap FIXED.** Rework mapping is **9♥ = Holy Shroud (cloak), 10♥ = Sanctuary (dome)**; the old art had them reversed. Aj's renamed files are correct; `build-art.js` skips the stray old-name duplicates still in the folder (`H9 Sanctuary.png`, `H10 Holy Shroud.png`, `D7 Strip.png`). Verified in-game: 9♥ shows the cloak.
- Note: the parked ride/form visual overlap is now largely moot — one-Ride-per-rank means two J's can't coexist anyway; any residual is pure animation overlap.

### v0.94 changes — Rides/Forms zone rework (Aj)
- **Super Forceful Strip → equipment to TOP of deck too (correction).** Base=hand, **Queen=deck-top, Super=deck-top** (plus Super's ride/form-to-hand). Decoupled via a new `eqMode` field (equipment destination) separate from `mode` (zone-target destination), so Super sends equipment to deck-top while still returning a Ride/Form to hand. Verified.
- **One Ride at a time.** Casting a Ride retires any existing Ride(s) to the **Energy pile** (`activate` transform branch: rank 11 clears prior rank-11 forms → energy). Verified.
- **ONE transform per RANK.** A new J/Q/K replaces the existing one of that rank (regardless of suit), retiring the old card to Energy. So the zone holds at most one J, one Q, one K. (Simplified from an earlier per-suit rule — moot under Variant B since any suit powers all suits.) Verified + locked by a test.
- **Form suit-matching — A/B tested, shipped Variant B (Aj's pick).** New toggle `setFormSuitMatch(bool)`. **Default = B (false): any-suit "key"** — a Q/K unlocks its tier for EVERY suit's cards (each card uses its own suit's boost table), and **Super = any Q + any K**. Variant A (true) = same-suit only (Q♦ boosts ♦ only; Super = same-suit Q+K). Sim (`ab-suit.js`): B lifts the weak dual decks — Paladin 43→48% (2p), Sage +5 / Mage Knight +3.7 (3p) — compressing the field; pures single-suit so unaffected directly. Threaded through `effectFor`, `boostInfo`, `hasSuper`. Tests updated (mixed-suit super now valid under B; A re-checked via the toggle). 651 tests.
- **Note:** `ab-suit.js` is the A/B harness (`node ab-suit.js [games] [diff]`).

### v0.92 changes
- **Forceful Strip — Queen (Q♦ Penelope) upgrade reworked (Aj).** Old Queen let it *also return a Ride to hand*; that's weak because J/Q/K recast for FREE. New Queen: it puts the **target Equipment on TOP of its owner's deck** (they must redraw it) instead of into their hand — a real tempo hit. Implemented as `mode:'deckTop'` on `BOOSTS.D.queen[7]` + a `deckTop` branch (`deck.unshift`) in the removeEquip handler. **Super (J+Q+K) is unchanged** — still "return a Ride OR Form to hand," and since Super *supersedes* the Queen patch, equipment at Super still goes to hand. Verified `queencheck.js` (Queen→deck-top, Super→hand); test.js updated (REWORK 4b), now 648.
- **Ride/Form stacking — CONFIRMED behavior (answered Aj).** By design the zone holds *multiple different* transforms (Ride + Q + K = Super, per RIDES-AND-FORMS.md §5). Same transform does NOT double: two Giant Boars = +1, not +2 (`rideValue` uses `.some()`, verified `stackcheck.js`). The J♠-in-a-Pure-Fighter-zone Aj saw is impossible for an all-♣ deck ⇒ **cosmetic overlap** of the human's own J♠ Giant Ram into the Rival panel (still the parked visual bug). **Loose end noted:** the engine does NOT block a 2nd Ride of the same rank (Boar+Ram both J) — their different effects both apply; add a one-Ride-slot rule if that's unwanted.

### v0.91 changes
- **🌐 Play Online button** on the New Duel screen → dialog (Host / Join) that navigates to `?net=rtchost` / `?net=rtcjoin`. Netplay is now discoverable without editing the URL. (`openOnlineDialog`, `#onlineBtn`.)
- **Equipment-strip now weakens the current pile (Aj's call).** `unapplyEquipFromPile(st,q,e)` in engine.js: removing an equipment (Forceful Strip / Disarm / Sabotage / Plead for Peace) subtracts ONLY that equipment's contribution to a pile already on the table — its `.delta` if the pile owner wore it, its `.oppDelta` if an opponent wore it against them. Other locked boosts (Rides like Giant Boar, pre-fight, Giant Swan) stay. Verified `stripcheck.js`: Javelin strip drops a K-pair 15→14 with Giant Boar's +1 intact; simple case 6→5. Wired in the `removeEquip` branch of `resolveEffect`.
- **Still PARKED:** the ride/form visual overlap (J♠ ghost in the Pure-Fighter Rival zone) — see the parked-bug note below; not an engine stack (confirmed: K-pair boost was +2 = Boar+Javelin, not +3).

### 🐞 PARKED BUG (Aj flagged, v0.90) — Rides/Forms effect stacking
Battle log saved: `bug-rideform-stacking-battlelog.txt` (+ two screenshots in the session). Round 9, **Rival = Pure
Fighter**, its Forms & Rides zone shows **J♣ Giant Boar (Ride)** *and* a **J♠** side-by-side. Two concerns: (1) a
**pure Fighter deck is all ♣**, so a **J♠ should not exist** in its cards → likely a rendering artifact (wrong
face/suit drawn, or an opponent card bleeding into the zone); (2) Aj's rule: **you should NOT be able to stack the
effects of multiple Rides/Forms** — need to confirm the engine enforces one active Ride/Form (or the intended cap)
and that the zone render isn't implying a stack that isn't really applied. **Aj said park it for later** — do NOT
fix yet; diagnose engine-vs-visual first (check `forms[]` contents vs what the zone renders).

### Multiplayer — Phase 5-v2: ONLINE NETPLAY (internet P2P, no server) DONE ✅
Cross-machine, 2-player, **WebRTC DataChannel** with **manual copy-paste signaling** — `?net=rtchost&room=CODE`
(host makes an invite code) / `?net=rtcjoin&room=CODE` (paste it, return a reply code, host pastes back →
connected). **No server, no accounts, $0**; codes travel over any chat. Google public STUN for NAT (`&stun=0`
disables for LAN). Transport is pluggable (`{send,setOnMessage,close}`) — BroadcastChannel (same-machine) and
WebRTC (internet) share the same symmetric host-authoritative message layer. Reliability: joiner re-announces
`join` until its first snapshot lands (WebRTC drops pre-open messages). Verified `rtctest.js` 9/9, **6/6 runs**;
shipped game byte-identical, BroadcastChannel netplay still 7/7. **v2 limits/next:** 2 players (WebRTC star for
N-player later); no TURN relay (rare strict-NAT pairs may fail on STUN alone); ~860-char codes (could deflate);
deck picker + pre-fight timing + ornate ceremony still open.

### Multiplayer — Phase 4/5-v1: NETPLAY (human vs human) DONE ✅
Same-machine, 2-player, host-authoritative over **BroadcastChannel**. Launch: open the file twice —
`?net=host&room=CODE` in one tab, `?net=join&room=CODE` in another (works on `file://` and `http://`; validated
`nettest.js`). Host owns the engine and applies **every** seat's intents; both ends render a dedicated netplay
board from `NetView.snapshotFor(state,seat)` (own hand only; opponents = counts — hidden-info boundary, tested)
and submit high-level intents (`play/pass/activate/respond/decline/discard/guard/guardPass`). All additive + gated
behind `?net=`; **shipped single-page game byte-identical without the flag** (647 tests + duel smoke green).
Verified end-to-end by `nettest2.js` (connect, sync, Specials over the wire, interrupts routed to the right seat,
shield loss, knockout, win — 7/7, stable). New files: `netview.js` (+`.test.js`), transport/UI in the template
(`var NET`), harnesses `nettest.js` / `nettest2.js` / `netshot.js`.
**v1 limits (next steps):** 2 players only; pre-fight Quick timing deferred (Quicks still counter activated
effects); round ceremony is a status line, not the ornate animation; host uses the full deck (no picker); same
machine only — LAN (WebSocket) then internet P2P (WebRTC) are the Phase-5 v2/v3 transports (same message schema).
Controller layer (`seatCtrl`/`controllerOf`, `awaitHumanSeat`) is in the template for future AI/remote seat mixing.

### Authoritative card reference
**`CARD-LIST.md`** is the source of truth for live card text — auto-generated from `engine.js` via
`node gen-cardlist.js`. Regenerate it after any card change. The design docs (RIDES-AND-FORMS.md,
Cardmen-Fighter-Design-v0.70.md) are rationale/history and can lag; CARD-LIST.md cannot.

### ⏰ Reminder (Aj)
- **Tutorial / energy:** when we return to the tutorial, remind Aj — he wants to suggest something for the energy (mechanic TBD).
- **Concede button:** DONE (v1.0). The header "New Duel" button becomes "🏳 Concede" (danger tint) during a live duel → confirm → forfeit (opponent wins). Netplay-aware: sends {t:'concede'} so the opponent sees a win. Verified single-player + netplay.

### 🚧 IN PROGRESS — Full single-player UI reuse for netplay (Aj's call: one UI, not two)
Goal: netplay renders the REAL single-player board on BOTH ends so every future UI improvement applies to both.
Architecture (host-authoritative): host runs the real game (`startGame`, real `render()`, real ceremonies) with the
rival's move sourced from the wire via `driveRival()`→`NET.awaitRival()`; client sets `state = NetView.mirrorFor(hostState, seat)`
(redacted, seat-rotated so it's seat 0) and calls the SAME `render()`, with each human handler gated (`NET.isClientActive()`)
to send an intent instead of mutating. `NET.onRender()` (hook at the end of `render()`) broadcasts the mirror after every host render.
- **DONE + tested (core loop):** both ends show the real board (card art, zones, hover-reader, shields); play/beat/pass +
  round resolution with the real ceremony; sync + no errors. `nettest_full.js` (6/6, 163 moves). Single-player byte-identical (654 tests + duel smoke).
- **NEXT stage (interactive windows):** `hostApplyMove` currently handles `play`/`pass` only. Add `activate` (techniques),
  `respond`/`decline` (Counter), `guard`/`guardPass` (shield-guard), `discard` (forced discard), and the client-side modals for
  windows the mirror says are owed to it (drive the existing `openShieldGuardModal`/`promptHumanResponse`/discard-pick, gated to send intents).
- **Stale tests:** `nettest2.js` / `rtctest.js` drove the RETIRED functional board (`#myhand`/`#netactions`) — they now fail by design;
  `nettest_full.js` is the replacement (BC). **`nettest_rtc.js` now covers the WebRTC full-UI path end-to-end** (see v1.0 note). The old `renderNet`/`buildHand` functional board + `applyIntent`/`submit`/`snapshotFor` path is now dead code in `var NET` (kept for the lobby/signaling only) — safe to prune later.

### Multiplayer — Phase 1 (engine core) DONE
The N-player (2–6) engine is in and duel-safe (see `MULTIPLAYER-DESIGN.md`). `newGame({numPlayers})`; `nextPlayer`
skips eliminated; `effectTarget(opts.target)` for singular "the Rival" effects; `SPECIAL_LOSS_MODE` (`all`|`chosen`)
+ `MILL_SCOPE` (`universal`|`targeted`) toggles (setters exported; both no-op at 2p) + `setShieldTargetChooser`;
Fighter Kick → elimination + `player.kicksLanded` (hidden stat, future Assassin) + last-Rider-standing;
deckout → elimination in N-player. **Duel byte-identical** — 639 tests (10 new MP); 30×3p + 20×6p full AI games
crash-free.

### Multiplayer — Phase 2 (AI targeting + response) DONE
Tiered `AI.chooseTarget(st,p,diff)`: Minion 80% random/20% grudge; Fighter kill-secure(≤1) > 1 grudge/game >
leader-focus; Demon finisher>grudge>random. Wired into hostile casts (`opts.target`) + the round-win chosen-mode
strip (`setShieldTargetChooser`, reads `st._diff[winner]`). Grudge = `player.lastAttacker` (set on hostile hits +
shield loss). Response windows now offer **every** living opponent priority in seat order (per-object `passed`
set; new Quick resets it) — non-adjacent seats can Counter. Duel unchanged; 647 tests (8 new); 3p/6p/mixed AI
games crash-free.

### Multiplayer — Phase 3 (UI) DONE — v0.88, PLAYABLE
Setup picks **2–6 players** (`#setPlayers`). 3–6 shows a compact opponent strip (`#opponents`/`renderOpponents`)
in seat order with per-opponent shields/energy/hand/deck/equip/forms/Super/turn-glow/OUT. `render()` branches so
the **duel is byte-identical**; MP hides the single `#rival` panel. `runOpponents()` drives all AI seats (reusing
the round ceremony + shield-guard modal + response/pre-fight prompts via a `resumeRival`→MP branch). Human
**target picker**: singular hostile casts → "tap a rival" (opponent panels clickable → `opts.target`). MP-aware
labels + win overlay (last Rider standing). 647 tests + duel smoke pass; 3–6p verified in-browser (render +
150-turn error-free play). **Deferred polish:** per-opponent shatter FX, richer per-seat beats, hotseat
human-vs-human. **Next: Phase 4 = polish + hotseat; Phase 5 = netplay (LAN → internet P2P).**
**Phase 3 hotfix:** MP loop now handles a rival forcing YOU to discard (`promptHumanDiscard` in `runOpponents`) —
previously an opponent's Outbalance/Telekinesis targeting the human hung the game. Also per-opponent class+strength
pickers in setup (`#oppList`), and hardened battle-log auto-scroll (wider stick threshold + rAF). 5/5 UI games
finish clean.

### Recent changes (v0.87)
- **Worn-out equipment retires to Energy.** When a decaying equip runs out of counters (or Holy Shroud spends
  its last absorb), its card now goes to the owner's **Energy pile** instead of vanishing (`retireEquip` in
  engine; wired into the round-tick decay, `useEquipment`, and `absorbSaved`). Consistent with the game's
  "spent cards become energy" cycle.
- **Equip counter rebalance (the duration lever).** Decaying equips dropped from a flat 5: **Fighter/Rogue → 3**
  (Hero's Javelin, Spiked Armor, Caltrops), **Cleric/Wizard → 4** (Holy Bow, Cursed Pendant). Holy Shroud
  (non-decaying, `decay:false`) untouched. Each equip's `text` now states its duration; the UI already renders
  live ◆ counters on the board, and `CARD-LIST.md` now surfaces the count. *(Counters were always in the engine
  as a balance lever — they just weren't in the docs because the generator pulled only the card `text`, which
  didn't mention them. Fixed.)*

### Recent changes (v0.86)
- **Broadway pitch cost.** **Ultima Attack** (C10) and **Armor Piercing** (C7) now carry an extra activation
  cost: `pitchHigh: true` → you must also **discard a Broadway card (10, J, Q, K, or A)** from hand, which goes
  to the Discard pile (recoverable only via Hippolyta's reclaim-Discard). Engine auto-pitches the least valuable
  (lowest 10 first); UI greys the button if you hold none; AI only casts these when it has a spare Broadway.
  Result: Pure Fighter ~61% → **~58%** (Ultima 57.9→53, Armor Piercing 56.8→51) — the biggest single move on
  Fighter so far.
- **Fighter 5↔6 swap.** Superior Training moved to **rank 5** (cost 5) and re-tuned to dig 3 (look 3, 2→Energy,
  draw 1); **Hero's Javelin** moved to **rank 6** (cost 6). Costs follow rank automatically; the Meleager King
  boost (Javelin +2) moved with it to rank 6. Effect: Javelin's castRate dropped 0.93→~0.78 (pricier to deploy).
- **Back to the Books (D6)** draw 3 → a **dig** (look 3, 1→Energy, keep 2). Was the best non-Fighter card at
  ~54.6%; now ~50.9%. "Broadway" = the game's name for the {10,J,Q,K,A} high-card set (`BROADWAY` const in engine).
- *(Also fixed a latent AI bug: the Sanctuary "don't revive an opponent at 0" guard read `card.shieldAll`
  instead of `effectOf(card).shieldAll`, so it never fired — now uses effectOf.)*

### Recent changes (v0.85)
- **Threshold ceremony + glow.** Transform tiers unlock on total table shields lost and announce center-stage:
  **ROAR** (J, 2 lost in a duel) → **OVERDRIVE** (Q, 4) → **REDLINE** (K, 6). J/Q/K in hand pulse **gold** when
  they can actually be transformed (tier fresh + gate met). Code: `THRESHOLD_TIERS`, `checkThresholds()`,
  `showThreshold()`, `#thresholdfx`; glow via `markTransform()` + `.transformReady` in the template.
- **Sanctuary nerf (H10).** Now `shieldAll: true` — **every** player gains 1 shield (a wash on the race, so it's
  a real decision, not a free-value reflex). Apollo Super's shield-lock stays caster-only. AI won't cast it when
  it would revive an opponent at 0. Pure Cleric fell ~65% → ~48–50%.
- **Fighter/Rogue draw-spell rework.** Fighter #6 Discombobulate → **Superior Training** (dig 4, 3→Energy, draw 1);
  **Instant Recovery** base draw 2→1; **Ares Wheel** draw 10→6. Rogue #6 **Never Out of Options** dig 4/draw 2 →
  dig 3/draw 1.
- **Fighter balance finding (measured, 4k-game harness).** Fighter is over-tuned (~60–62% vs the whole field) but
  **not because of equipment** — zeroing both Fighter equips cost only ~2.6pts. No single subsystem is the driver;
  the kit is **redundant** (draw + persistent equip value + shield finishers each substitute for the others).
  Removing all three together drops it below 50%. Fighter also out-draws every class ~4.5×. **Nerfing equipment
  durations won't work.** The real lever is the **Instant Recovery reclaim engine** (shuffle-back = deck-out
  insurance no one else has). The draw-spell pass above did NOT dent Fighter (Superior Training re-added draw);
  next real move is cutting/gating the reclaim.

### Transform economy (data-driven, v0.84) — FREE · DRAW 1 · TABLE-GATED
Transforming a J/Q/K is now **free** (no energy), **draws 1** (the "refund" that pays back the spent fight
card — the real cost was always giving up a value-11–13 card, not energy), and is **table-gated**: unlocks
when TOTAL shields lost across the table ≥ players × tier (duel: J@2, Q@4, K@6). This lands transformer-vs-
non-transformer at ~50% (a real choice, not a trap or a no-brainer) with the first transform ~round 5–6.
Tunable via `E.setTransformCost/Draw/Gate` + `E.setBoostScale` (all default to the shipped values).
**Key finding:** boost *magnitude* is NOT the lever — 3× the Form boosts moved win-rate by 0.1 pts. The draw
(card economy) is what makes transforming viable; the boosts are flavor/marginal. Aj will add per-Form draw
differences later (draw 1 is the base for all). Analysis hooks in ai.js: `setTransformPolicy`, `setEffectPolicy`,
`setKindBlock` (all default off) for A/B testing.

**⚠ Balance note:** the free+draw economy *widened* the deck spread — Pure Cleric rose to ~65% and Pure
Wizard fell to ~44% (`analysis.js 200 on off rework`). The draw-1 faucet compounds for card-hungry decks
(Cleric/Fighter) and does little for Wizard's tempo. This reinforces that **Cleric/Sanctuary is the next
tuning target** (see below).

---

## ◻ OPEN

### ★ REWORK — the 2-as-apex + Kamen-Rider Forms layer (SHIPPED / LIVE)
The parked STOPPER reframe became the **live game** (design: `RIDES-AND-FORMS.md`; original plan:
`BUILD-PLAN-v0.82.md`; shipped card text: `CARD-LIST.md`; the full narrative: `REWORK-HISTORY.md`).
Ladder is `3 4 5 6 7 8 9 10 J Q K A 2` (52 cards); STOPPER retired (the apex 2 wins by value); A keeps its
old rank-1 effect at cost 1; J/Q/K transform (**free · draw 1 · table-gated**) into the **Forms & Rides
Zone** and empower your cards; any J+Q+K = **Super Mode**. All Form/Super boosts, all four Rides
(Boar/Swan/Owl/Ram), reactive Quick-casting, zone removal, the upgrade-ladder card text, the transform-tier
ceremony (ROAR/OVERDRIVE/REDLINE) + gold glow, and AI transform logic are in and tested. **Default-ON; the
playtest toggle is gone.**

**Still to do on the rework:**
- **Phantasmal Illusion +value** (Odysseus) — DONE (implemented + tested); the AI still rarely casts Phantasmal.
- **Per-Form draw differences** — Aj to add later (draw 1 is the base for all Forms).
- **Variation to try:** Forms *expire once their boost is used* (Aj's idea) instead of persisting — still parked.
- **Art:** Fighter ♣ / Rogue ♠ faces are still placeholders (see Art section below); apex-2 / A face art too.

**Balance status — measured 2026-08-24 on v1.31.4** (`mpsim.js 400 knight`, 8 runs per player count). The
v0.85 numbers that used to sit here (Cleric ~48-50%, Fighter ~60%, Wizard ~44-45%) are superseded; that
history is in `REWORK-HISTORY.md`.

| deck | 1v1 (fair 50%) | 3p (33.3%) | 4p (25%) | 6p (16.7%) |
| --- | --- | --- | --- | --- |
| Pure Cleric | 52.3 | 39.4 | **32.4** | **20.3** |
| Sage (Wiz+Cle) | 53.2 | **41.5** | 31.1 | 19.7 |
| Paladin (Cle+Fig) | 44.7 | 32.9 | 26.2 | **20.6** |
| Mage Knight (Wiz+Fig) | 54.4 | 32.7 | 24.8 | 19.8 |
| Bard (Cle+Rog) | 47.0 | 34.2 | 25.2 | 19.1 |
| Pure Wizard | 54.4 | 33.6 | 27.6 | 17.9 |
| Full Set | 41.7 | 33.3 | 22.8 | 15.9 |
| Pure Fighter | **56.7** | 33.6 | 23.1 | 14.5 |
| Berserker (Fig+Rog) | 40.4 | 32.1 | 17.8 | 13.0 |
| Warlock (Wiz+Rog) | 49.9 | 27.1 | 25.0 | 11.9 |
| Pure Rogue | 54.6 | 28.4 | 19.2 | **9.8** |

Spreads: 2p 16.3 · 3p 14.4 · 4p 14.6 · 6p 10.8 points.

Three patterns, and they are the live balance agenda:
- **Cleric owns multiplayer.** Cleric-containing decks take four of the top five at 6p, while Pure Cleric is
  merely mid-pack in a duel. Extra opponents convert into wins for it.
- **Fighter is the mirror image** — best deck in a duel (56.7%), below fair at 4p and 6p. Winning fights does
  not translate into breaking shields when there are five rivals to strip instead of one.
- **Rogue is the problem and it worsens with every seat:** 1.09x → 0.85x → 0.77x → **0.59x**. Its two hybrids
  are the other bottom entries at 6p. The Rogue "slash" card in the BACKLOG is the intended lever.

Caveat on all of it: this is `knight` AI piloting every deck, so it measures decks *in the AI's hands*.
Cleric's control kit is easy for a bot; Rogue's tempo tricks need a plan. Aj's own games are the check.

### ★ PARKED — "Rival: Aj" signature AI (AFTER balance + cards are done)
A selectable rival that plays like Aj, so people can duel "him" offline. The playstyle profile is already the
spec (from the v0.14–v0.67 log analysis): **tempo aggressor** — specials over jabs (~6.5:3.8), digs with draw
techniques then unloads in a burst, escalates and commits inside exchanges, **races to 0 shields without
flinching** (often wins at 0 himself), light on equipment, high variance. **Signature tell:** spends STOPPERs
*aggressively for initiative — including on JABS* (games 3/5/10/11/12), which no current tier does (the AI only
stoppers shield-threatening specials, need≥2). Implementation: it's a new personality knob-set in ai.js
alongside minion/fighter/demon — crank stopper-aggression (allow 1-STOPPER jab cancels to seize tempo), bias
to specials + escalation, dig-and-dump card usage, no defensive shield-hoarding, minimal equip. Expose as a
selectable opponent. Gated on the card set + balance being final so the personality tunes against real numbers.

### Art — Fighter ♣ + Rogue ♠ (the main pending item)
Wizard ♦ and Cleric ♥ are fully arted; Fighter and Rogue still fall back to the drawn rank/suit card
everywhere (hand thumbnails, Card Codex, description panel, activation flash). Two pipelines feed them,
both already wired — just drop in the images and rebuild:
- **Card faces** (hand + Codex + description): full card-layout PNGs → `layout/fighter` + `layout/rogue`
  → PIL resize 240px WebP q78 → extend the **faces.js** generator (`C1…`, `S1…`) → rebuild.
- **Illustration crops** (the center-stage activation flash): raws → `raw/fighter` + `raw/rogue`
  → PIL resize 460px WebP q80 → extend the **art.js** generator → rebuild.
Once added, every view swaps from the placeholder to the real art automatically — no code changes.
(At 40 arted cards the inlined build lands ≈1.9MB; fine, but external art files are an option if it feels heavy.)

### Playtest confirmations (judge on real hardware)
- **Mobile touch-drag feel** — pointer events cover touch, but the feel on a real phone hasn't been hand-checked.
- **Effect-reading on grouped combos** — a group shows its combo label; double-tap to break it and read a
  single card's effect. User flagged this as the tricky part — confirm it feels OK in real play.

### Balance (not urgent — meta is healthy, 45–56% across all 11 decks; see PATCHNOTES.md)
- **Forceful Strip ~38%** — weakest single card after the v0.40 rotation; candidate for a small buff.
- **Wizard's ramp payoff** — Gather Energy casts ~0.86/game but Wizard wins ~48%; the deck banks energy
  without converting it. Strategic gap (needs a better payoff for hoarded energy), not a number tweak.

### Optional / if-wanted
- **Generalize the pre-fight window** — it's live but gated to Back Stab (the only Quick that wants that
  timing). Widening `preFightHolder` in engine.js opens it for any Quick (matches the §7 design), but would
  prompt the human more often — do it only if another Quick gains a real proactive use.
- **Back Stab reactive timing** — ✅ done in v0.76 (now a Quick + the non-active pre-fight window).

---

## ✓ SHIPPED (newest first)

- **v0.82 — Fighter Kick vs prevention at 0 shields (rules fix) + energy spacing.** Playtest surfaced that
  Leyline prevented the *kick* at 0 shields — where there's no shield to save. New ruling (Aj's call): at 0
  shields, the kick lands UNLESS the effect prevents *losing the round*, not just *losing a shield*. So
  `resolveShieldLossObj` now splits the branches — shields>0 uses any protection; at 0 (the kick) only
  `cantLoseRound` (Leyline, new `cantLose:true` flag + retext "you can't lose this round") or a **Holy Shroud
  counter** (`absorbSaved`, spends a counter — a physical block) survives it. Flat shield-immunity (**Sphere**,
  `shieldImmune`) no longer saves you at 0. `wouldBeSaved`/`shieldGuardCard`/`driveShieldStack` are 0-shield
  aware so the reactive guard window still opens vs the kick when you hold Leyline. Also fixed the prevented
  message's hard-coded "(Legendary Armor)" → generic. **Card text/images: Aj will update Leyline + Holy Shroud
  themselves** (engine text is a placeholder). +6 tests (Sphere kicked / Leyline & Holy Shroud survive /
  reactive-Leyline window) → **554/0**. Energy readout: dropped the redundant `.nrgBox margin-left` so `⚡`
  hugs the box (the `.stat` flex gap already spaces it).
- **v0.81 — energy readout as one box + ⏩ Quick badge on cards.** (1) The status energy went from
  `N⚡ [suit chips]` to `⚡ [ suit chips ]` — the redundant total is gone (it was just the sum of the chips);
  now a single `.nrgBox` holds the per-suit counts after a `⚡` label (`energyChips` shows a dim `0` when
  empty; the breakdown tooltip moved to the box). Removed `#youNrg`/`#rivalNrg` and their setters. (2) A
  `⏩` badge (`.qbadge`, top-right, `--cs`-scaled) now marks every **Quick** card in hand/Codex/description,
  driven by `effectOf(card).quick` in `cardEl` — so you can see at a glance which cards are playable in
  response. Rules-modal legend updated. Verified: badge on Quick cards only (Counter Spell/Leyline/
  Hand-to-Hand yes, a plain card no); energy box renders the breakdown with the total removed.
- **v0.80 — peek fixes: the "↩ Back" pill was unclickable + action buttons live during peek.** Lifting the
  description panel to `z-index:35` (v0.79) trapped the Back pill — it lived *inside* the overlay (a
  `z-index:30` stacking context), so its z-index only ordered it within the overlay, and the raised panel
  painted over it. Fixed by appending `#peekBar` to `<body>` (root stacking context) at `z-index:60`, so it
  beats the lifted panels. Also the `#actions` row (Sort/Clear/Pass/Fight/Activate) was still clickable while
  peeking (Sort reordered the hand) — now `body.peeking-board #actions{pointer-events:none;opacity:.4}` plus a
  `peeking` guard in `flipSort`. Verified: Back is the topmost element at its center and restores the modal;
  Sort no longer reorders during peek.
- **v0.79 — peek is now interactive for review (log + hand inspection).** The v0.78 peek locked the whole
  board (safe, but you couldn't read the Battle Log or your cards). Now, while peeking, the **log**, **hand**,
  and **description panel** lift above the overlay (`body.peeking-board` → `z-index:35`; the hand's
  `pointer-events` is re-enabled even at game over). You can expand/scroll the log and hover/click a card to
  read its effect in the side panel — **inspect-only**: `onGroupClick` shows the card then returns when
  `peeking` (never selects), drag is blocked (`onPointerDown`), and every commit path is guarded
  (`doFight`/`doPass`/`onActivateClick`/`onCtxClick` bail on `peeking`). `↩ Back` restores the modal with no
  stale selection. Verified: log toggle works during peek; clicking a card shows its effect with 0 cards
  selected; Back round-trips.
- **v0.78 — "Peek at the table" + inline decision context + review-after-game.** Decision modals were
  opaque — you couldn't re-check the Rival's play or your energy while deciding. Now:
  - **Inline context box** (`tableContextHTML`) on the shield-guard, Respond, and pre-fight modals: shows
    the current play on the table (pile combo + cards) and your energy (total ⚡ + per-suit breakdown), so
    the basics are right there without dismissing anything.
  - **👁 Peek at the table** button (`enterPeek`/`exitPeek`) on those modals AND the game-over modal
    ("👁 Review the board & log"). It hides the modal but keeps the overlay on top (transparent bg,
    `.overlay.peeking`), so the board/log are visible but non-interactive; a floating "↩ Back" pill
    (`#peekBar`) restores the modal. `hideOverlay` clears the peek state defensively; taps on the exposed
    backdrop are inert while peeking (`overlayDismiss` saved/nulled).
  - Confirmed the engine already gates every Quick/guard window on `canAfford` — you're **never** offered or
    allowed to spring a Quick you can't pay for, so the guard prompt only appears when you can actually afford
    it. (No bug; just surfaced the energy so it's visible.)
  - Verified via seams: context box + peek on a decision modal, and the game-over review peek round-trip.
- **v0.77 — fix: opening Help mid-duel abandoned the game.** The header `?` (`#helpBtn`) handler passed the
  click **event** as `showHelp`'s `fromSetup` arg — always truthy — so closing Help always ran `openSetup()`,
  dumping you to the New Duel screen and killing the in-progress duel. Now `helpBtn` calls
  `showHelp(!(state && !state.finished))`: mid-duel → `fromSetup=false` (close/click-outside = `hideOverlay`,
  resumes the duel, button reads "Got it"); pre-game or finished → back to setup. `overlayDismiss` now mirrors
  the close action in both contexts. Verified in the live UI (hand intact after close, no dump to setup).
- **v0.76 — Back Stab is now a reactive Quick + the pre-fight priority window.** Two phases, one ship:
  - **Phase 1 — Back Stab (♠10) → Quick, skip-one-turn.** `quick:true`; the lockout no longer lasts the
    whole round — it makes the target **skip their next turn** (engine `lockSkip` flag on the player,
    replacing `lockedRound`; `isLocked` reads it; spent/cleared when that locked turn passes, in `pass()`).
    It does **not** counter: an in-flight Technique on the stack still resolves, then the lock lands on the
    target's *next* plays. Reactive via the existing response window (spring it when they cast a Technique).
  - **Phase 2 — the non-active pre-fight window.** New engine API `openPreFight` / `preFightCast` /
    `preFightPass` + `st.preFightQ` / `st.preFightHandled` (one window per active-player fight; survives UI
    suspend/resume; reset on turn advance in `play`/`pass`/`resolveRoundWin`). Before the active player's
    Play Sub-Phase, the **non-active** player may spring a Quick (gated to Back Stab — widen `preFightHolder`
    to open it for any Quick). The sprung Quick goes on the stack so the active player can still Counter it.
    If it resolves, the active player is locked → their fight is a forced skip → initiative passes.
  - **AI:** retired the old proactive playPhase lockout; `takeTurn` now runs the non-active pre-fight window
    (springs Back Stab to deny an opening lead — `aiPreFightLock`: `!pile && round≥2 && hasCombo`), and the
    active player force-skips if locked. `AI.preFightMove` exposes the decision for the UI.
  - **UI:** Case A (you Back Stab the Rival) — `promptHumanPreFight` modal in `runRival` when the Rival is
    about to fight and you hold Back Stab; Case B (Rival Back Stabs you) — `rivalPreFightThen` wraps
    `doFight`/`doPass`, synchronous unless the Rival actually springs it. Both reuse `settleWindows` so the
    Back Stab can itself be Countered. Both directions verified end-to-end in the live UI via a seam.
  - Tests: +6 (Back Stab-as-quick, skip-one-turn, reactive-doesn't-counter, pre-fight open/cast/lock/skip,
    one-shot guard). **548/0**, headless 400-game sanity clean, browser smoke green.
- **v0.75 — catch-up mechanics M1 + M2 (anti-snowball).** Two engine flags, both defaulted OFF (headless
  test/analysis unchanged, still 531 baseline) and both turned ON in the UI init:
  - **M1 `setShieldCards` — shields are cards.** Setup deals `START_SHIELDS` cards from the deck into a
    `shieldPile`; a broken shield returns its card to the owner's **hand** (`resolveShieldLossObj`), a gained
    shield pulls a fresh card into the pile (`case 'shield'`). So the trailing player refuels as they lose.
  - **M2 `setLoserMill` — loser mills to energy.** In `resolveRoundWin`, each loser mills cards from deck →
    Energy Pile equal to the **winning play's size**, restoring the energy the winner banked by making them
    pass. Guardrail: `LOSER_MILL_RESERVE = 4` — never mills below 4 cards of draw runway, so catch-up can't
    deck the loser out (sims: **0% deck-outs**). Per-round mill counts ride on `result.milled` for the UI.
  - **UI:** `logCatchUp()` surfaces both (broken shield → hand; loser mills N → Energy), skipped on a Kick;
    a new rules-modal bullet explains it to playtesters. Shields still render as 4 pips (visualizing them as
    face-down cards is optional future polish).
  - **Why combined:** sims (`snowball.js`) showed M1+M2 together cut the 3+ shield-loss-streak rate from
    **69.6% → 54.5%** (biggest anti-snowball move), kept M1's close finishes (winner margin 0.97 → 0.70,
    photo-finishes 40% → ~49%), added only ~+0.5 rounds, and never distorted balance (~50/50). +9 tests (540/0).
  - **Tuning knob:** `LOSER_MILL_RESERVE` in engine.js. To A/B or revert, flip the two `set…` calls in the
    template init. `snowball.js [N] [base|shieldcards|mill|both|all]` re-measures any time.
- **v0.74 — adaptive card sizing + Critical-Hit-at-0-shields fix.** Two things: (1) Playing cards now
  scale up on large monitors. A `--cs` (card-scale) CSS variable on `:root` steps up at 1200/1600/2000/2560px
  breakpoints (1 → 1.18 → 1.42 → 1.68 → 1.9); every card dimension, inner font, index chip, effect icon,
  and the combo-overlap margin is `calc(...*var(--cs))`, so cards grow proportionally from 46×66 up to
  ~87×125 on a 2560px screen (base still tuned for laptops/tablets; ≤1199px unchanged). Arted `.faced`
  cards are background-images so they scale for free; drawn ♣/♠ placeholders scale via the same var.
  (2) The AI (and the engine's response window) no longer fires a destroyShield — Critical Hit ♠9 /
  Ultima Attack ♣10 — at a Rival already sitting at 0 shields: `ai.js` guard is now `opp.shields>=1 && <=2`,
  and `engine.js` `openResponseWindow` skips opening a guard window for a destroyShield whose target has
  0 shields (it's a pure no-op, so there's no shield to save and nothing to counter). +4 tests (now 531/0).
- **v0.73 — "Go first" / "Go second" on the New Duel screen.** Two ghost buttons now flank "Roll for
  initiative" (`.rollRow`): pick who leads Round 1 and skip the dice. Extracted `commitSetup()` (shared
  deck/difficulty lock-in + control disabling) from `beginRoll`; new `chooseStart(starter)` commits and goes
  straight to `startGame(YOU|RIVAL)`. Also made `startGame`'s initiative log line neutral ("You/​Rival have
  the initiative — Round 1, jabs only") so it reads right for both the rolled and chosen paths.
- **v0.72 — STOPPER now has a visible cue.** A committed STOPPER (either side) previously only wrote a log
  line + a transient message — no flash, no announcement (and even a card flash would've been blank for the
  un-arted ♠/♣ suits). Added an art-independent center-stage `stopperFlash` — a bold "🛑 STOPPER ×N" with a
  glow (red = Rival, cyan = You) and a "cancels the Pair/Trio" subtitle, ~1.2s. Wired into the Rival's
  stopper beat and both human commit paths. Reduced-motion skips it (log/message still convey it).
- **v0.71 — round announcement fleshed out (no longer a mockup).** Fixed the floating white card — the
  Round-N element had a class literally named `card`, colliding with the global `.card` playing-card style;
  renamed to `rfCard`. Added a **dimmed/blurred backdrop** behind the ceremony (radial vignette over the
  play area) so beats no longer clash with board text, and restyled the beats to match the shield-loss
  banner — cyan (you) / red (rival) glow labels that pop in, and a gold "ROUND N" plate with an
  uppercase subtitle under a gold divider. Timing knobs unchanged (`ROUND_BEAT` 750 / `ROUND_HOLD` 1350).
- **v0.70 — ONE Clean-up per round (not per turn), for both players.** Removed the AI's four per-turn
  `discardToLimit` calls (ai.js) and the human's per-play-turn trim (`endTurnDiscardThen` deleted;
  callers → `afterHumanAction`). Hand-limit is now enforced only at the round's Clean-up: engine
  `finishRoundWin` auto-trims every hand before the draw in headless; the UI's `endOfRoundTrimThen`
  auto-trims the Rival and prompts the human. So a hand may exceed MAX_HAND *during* a round (via draw
  effects / the +2 draw) and is trimmed once at round-end. Verified headless: hands reach 12, no per-turn
  trim, every round boundary bounded, 541 rounds/40 games all terminate; 527 tests + smoke green.
  (Matches the reviewed Round Anatomy: Clean-up Phase = both discard to hand size, no priority.)
- **v0.69 — hand-limit trim moved to end of round (before the draw).** The round draw is now deferred: engine
  splits `finishRoundWin` (resolve trick, advance round, fade temps — no draw) from `roundDraw(st,result)`
  (draws + deck-out), gated by `E.setDeferRoundDraw(true)` which the UI sets (headless AI-vs-AI leaves it
  false, so `play`/`pass` stay self-contained → 527 tests unchanged). New flow in `resolveRoundCeremony`:
  win → (shield) → seize beats → **end-of-round hand-limit trim** (pick UI if over MAX_HAND, discards→energy)
  → **Round banner appears (round start)** → **then the new cards fly in** (draw held ~340ms behind the
  banner via `enterDelayBase`). Verified: at the trim the Round card isn't showing and the deck hasn't drawn;
  after the pitch, energy +2 then deck −2, then banner + fly-in. You may hold up to MAX_HAND+2 during a round.
- **v0.68 — discards go to the Energy pile.** Rule: the shuffle pile is only for *spent* energy (or where a
  card's text explicitly says shuffle — Counter Spell, Plead for Peace). All discards now go to Energy so
  the cards stay usable as fuel: `discardChosen` (Outbalance/Telekinesis/Discombobulate + Never Out of
  Options) and `discardToLimit` (end-of-turn hand cap) both push to `pl.energy`. Never Out of Options
  reworded "…into your Energy Pile"; UI discard messages updated; 4 tests updated. This also softens Rogue's
  disruption (forced discards now hand the victim energy) — a likely lever on Rogue being over-tuned.
- **v0.67 — AI Counterfeit fix + battle-log scrolling.** AI: `counterfeitHelps` now only casts Counterfeit
  when copying a card from the Rival's play produces a combo that actually BEATS the pile (via
  `enumerateCombos`+`applyEquip`+`beats`, factoring equipment and a charged `nextPlayBoost`) — previously it
  fired on any rank match, so it wasted the card copying a 4 vs a pair of 4s (only a tie). Verified: no cast
  on a pair without a boost; does cast with a +2 boost or to complete a higher full house. Log: entries
  auto-stick to the newest only when you're already at the bottom (reading history no longer yanks you
  down); expanding the collapsed log jumps to the newest; a gold "↓ New" button appears when you've scrolled
  up and jumps back.
- **v0.66 — ceremony sync fix.** The consequences now land on their beats: removed two premature `render()`
  calls before `finishStep` (they were consuming the drawn-card deal-in early, so cards appeared with the
  shield instead of on the Round card). Added `holdShields` to defer the shield shatter to the "loses a
  shield" beat (revealed on the beat, on skip, or under reduced motion). Verified with a real transition:
  hand grows 6→8 on the Round card, not before.
- **v0.65 — round-announcement ceremony (FIRST PASS — timing to tune).** Center-stage beats on each round
  resolve via `playRoundCeremony`/`buildRoundBeats` over a new `#roundfx` layer: jab = win → seize (2 beats);
  special = win → loser loses a shield → seize (3 beats); then a big gold "Round N" card with a subtitle
  (R1 "Jabs only", R2 "Specials unlocked!", R3+ "Each player draws 2 cards", or "Deck empty…" on a fizzle).
  Round 1 gets the card at duel start. The two freshly-drawn cards' deal-in is delayed (`enterDelayBase`,
  synced off `roundPreDelay`) so they arrive on the Round card. Gates the next actor (no rival acting mid-
  ceremony). Terminal rounds (Fighter Kick / deck-out) skip it and finish on the win. Reduced-motion skips
  the banner; tap the banner to skip. **Tuning knobs:** `ROUND_BEAT` (750ms/beat) and `ROUND_HOLD` (1350ms
  card) near the top of the template — adjust to taste after playtest.
- **v0.64 — New Duel confirmation mid-game.** Clicking the header "New Duel" during an in-progress duel
  (`state && !state.finished`) now pops a confirm ("Start a new duel? … will abandon it") with Cancel /
  Start new duel; Cancel or click-outside returns to the running duel untouched. Before a game or after
  it's finished, it still opens setup directly (no needless prompt).
- **v0.63 — New Duel picks remembered + reset.** The setup screen restores your last Your-class /
  Opponent-strength / Opponent-class picks from this device (`cmf_setup_v1` localStorage), saved on change
  and on roll. A subtle "↺ Reset to defaults" link (right-aligned under the selects) appears only when the
  picks differ from the defaults (random / random / Fighter) and one-click reverts them. Validated on load
  so a stale/edited value falls back to the default.
- **v0.62 — tutorial entry point + full "Cardmen Fighter" rename.** "📖 How to play" ghost button beside
  "Browse all cards" on the New Duel screen, opening the existing rules modal; auto-opens once on the
  first-ever visit (`cmf_seen_help_v1` localStorage flag), returns to setup on close/backdrop. Renamed
  everything from the old "Kamen"/"CardMen" to **Cardmen** (small m): display title/log/rules, the build
  files (`CardmenFighter.html` / `.template.html`), code globals (`CardmenEngine`/`CardmenAI`), and the
  docs (incl. `Cardmen-Fighter-Design-v0.70.md`). Fixed a stale "Bishop"→"Sage" deck name in the rules. Retired
  the old v0.11 `CardMenFighter.html`.
- **v0.61 — equipment reads from your seat.** On-board equipment text is now viewer-relative (the Rival's
  Holy Sword says "Rival's highest +2", their Caltrops "Your highest −2"), and tiles color by benefit —
  your gear green, the Rival's red — since every equip helps its owner.
- **v0.60 — Card Codex + effect icons.** "Browse all cards" button on the New Duel screen (muted, under
  Roll for initiative) opens a gallery: default = all 40 unique cards; class-filter chips narrow to a
  suit's 10 cards with a **×4** deck-multiple badge; tap a card for its full face + rules text. Click
  outside to dismiss (preview → grid → setup); the setup modal itself is not click-outside dismissible.
  Also: the inline-SVG effect-icon system on card bottom-left (base glyph + green +/red − direction badge,
  multiple chips per card) — Leyline = recycle + blue shield, Armor Piercing reads as a Shield−, etc.
- **v0.59 — real card faces on hand + description** (Cleric ♥ + Wizard ♦, 20 cards) via faces.js + the
  `__FACES__` build placeholder. Description = full card layout (desktop) / raw art (mobile); hand = raw
  art + legible corner index.
- **v0.54–0.58 — the true recursive priority stack** (see **STACK-DESIGN-v0.53.md**, fully implemented).
  Techniques/Quicks are stack objects on one `st.stack` + priority driver; Counter-a-Counter works; the
  response prompt offers all eligible quicks; destroyShield answered via the response window (Leyline as a
  response, no double-prompt); visible stack view; AI drains its windows recursively. Value-altering
  effects are technique-speed (not quick); quicks = Leyline, Armor Piercing, Hand-to-Hand Mastery.
- **v0.52–0.53 — card-art activation flash** (art.js + `__ART__`), plus log/glow fixes (rival boost shown
  in log; boost/reduce pile glow) and card names/wording copied from Aj's laid-out cards.
- **v0.50–0.51 — drag-to-play + drag-to-group** and the reactive shield-guard window (spring Leyline to go
  immune). Layout reflow (log-left · table · description-right; hand full-width). One context-aware
  Activate/Stopper/Phantasm button with grey-out reasons. Description panel moved beside the hand with
  Activate under the card image. Sort now works during a forced discard.
- **v0.31–0.49 — all 40 effects live**, player-choice discards, smarter AI, multi-STOPPER prompt,
  suit swap (♦ Wizard · ♥ Cleric · ♣ Fighter · ♠ Rogue), and the balance pass documented in PATCHNOTES.md.

---

## Reference
- **CARD-LIST.md** — authoritative live card list (auto-generated: `node gen-cardlist.js`). Start here.
- **CARD-STATS.md** — latest per-card + per-deck balance snapshot (incl. Rides/Forms). Regenerate: `node analysis.js 120 on x rework`.
- **MULTIPLAYER-DESIGN.md** — design for the next big updates: N-player (3–6) multiplayer + networked play. Decisions locked; build order is engine-first, netcode second.
- **REWORK-HISTORY.md** — narrative of the v0.70→v0.85 rework (why the decisions were made).
- **PATCHNOTES.md** — balance design principles + patch log + snapshots. Read before any
  balance change. Re-measure with `node analysis.js 130 on x rework` (run `node test.js` green first).
- **RIDES-AND-FORMS.md** — design/rationale for the J/Q/K Forms layer.
- **Historical (version-frozen):** STACK-DESIGN-v0.53.md (priority stack), Cardmen-Fighter-Design-v0.70.md
  (classic ruleset), BUILD-PLAN-v0.82.md (rework build plan). **README.md** — project overview.
- Card faces/art raws live in the user's `Downloads/layout/{cleric,wizard}` (+ `fighter`/`rogue` when they arrive).
