# Cardmen Fighter — backlog & handoff

**Build:** `node build.js` from `code/` inlines engine.js + ai.js + art.js + netview.js + qr.js →
`code/CardmenFighter.html`, then **`cp CardmenFighter.html ../CardmenFighter.html`** yourself — `build.js` writes
only `code/`, and the repo-root copy is the file people download. `faces.js` is NOT inlined (layouts retired in
v0.95; build.js stubs `window.CardFace = {}`). `build.js` parses every inlined script and **refuses to write on a
syntax error** — read its `built … bytes` line before believing a surprising measurement.

**Test gate:** `npm test` = `node test.js` (**591**) + `node netview.test.js` (**65**). Both must end **0 FAIL**;
they run straight on the sources, so run them after a source edit even if you skip the build. Everything else,
including every `nettest_*` suite and the eleven `lessontest*` ones, is listed in **CLAUDE.md** with its expected
count — that list is the authority, and if a count there disagrees with a suite, the suite is right.

**Player style:** **PLAYER-PROFILE.md** — a living read on how Aj actually plays (control/value grinder,
Wizard/Cleric, counter-heavy, boost-a-pair kill). Append new exported games to its ingestion log; use it for
AI-tuning, balance, and a future "play like Aj" opponent.

**Current version: v1.31.127.10.** The 2-apex + Forms **rework is simply the game** — the `REWORK` flag and the
classic pre-rework rules were deleted in v1.23.0 (no `setRework`, no `E.isRework()`). Twenty-one homebrew rules
live behind **Custom rules**, every one defaulting OFF, because `RULE_DEFS.some(ruleOn)` *is* the definition of
"customised".

## ☀️ START HERE

`main` is at **v1.31.127**. The version is untouched; its two docs commits — Bibong's profile entry and the
three bugs his export surfaced — were carried into the epic on 2026-09-29. All the work below is on
**`epic/priority-windows`**.

**⚡ THE PRIORITY MODEL IS COMPLETE AND SPECIFIED (2026-09-17).** Steps 1-23 are done and merged; the two
boundaries that were still missing — the **end of Clean-up** and the Beginning Phase's **untap queue** —
landed on the 16th and 17th. **The epic's sweep is 100 suites**, derived from `sweep.js`'s own filter — read
the filter rather than a remembered count, and see CLAUDE.md for why one wall-clock figure is not worth
quoting. *(This said "94/94 in ~227s" until 2026-09-29.)*
Sub-branches PR **into** the epic, the version is held until it merges, and `main` is merged **into** it
after any session spent elsewhere (CLAUDE.md → "Branches and PRs"; `checkbranch.js` enforces both).

**THE GAME CHANGED SHAPE, so read this before touching anything:**
- **All SIX priority points in the model now exist** — Upkeep, each cast in the Main Sub-Phase, the
  Main → Fight transition, Resolution, the **beginning** of Clean-up and the **end** of it. `phaseWalk` is
  the only walk; each boundary is a park plus the same five lines. There is no second priority mechanism
  left anywhere. *(This said FIVE until 2026-09-17 — the end-of-Clean-up dance was in
  [`PHASES-AND-PRIORITY.md`](PHASES-AND-PRIORITY.md) §3 from the start and simply was not built.)*
- **The Beginning Phase is MTG's three steps**: Untap → Upkeep → Draw. The untap queue (`BEGIN_ORDER` =
  `roundAdvance` → `equipReset` → `stampRound`) is the one part of the game deliberately closed to
  priority. `equipReset` IS the untap — it clears `usedThisRound` — and it used to run during Clean-up,
  bringing once-per-round abilities back while the previous round was still being torn down.
- **The phases were renamed AND THE CODE FOLLOWED** — `Fight Phase` → **Play Phase** (Main · **Fight** ·
  **Resolution**). Step 23 closed the split on 2026-09-14, so **`fightEnd` in a `.js` file is a genuine
  leftover now**, not the deliberate lag it used to be. *(This paragraph said the opposite until
  2026-09-17 and would have sent a reader the wrong way; CLAUDE.md's docs map has carried the correction
  since the day it landed.)* The one surviving `'fightend'` is the `localStorage` prompt-timing migration,
  which must know the old key by definition.
- **`#fightBtn` has two states: `▶ Next` then `⚔️ Fight`.** Next is the phase move; Fight commits the
  cards. Dragging ACTIVATES in Main and PLAYS in the Fight Sub-Phase.
- **Pass is an auto-pass with a brake** — one press carries you through, and stops if anyone ELSE acts in
  the window it opened. Your own cast never brakes your own pass (`stackMark(st, me)`).
- **The equipment counter tick is the game's FIRST triggered ability**, with Aj's card text on all five
  decaying Equipment. Simultaneous triggers are ordered by the PUSH (active player first, so the last seat
  is on top) — which is why §2 needs no exception for them.
- **The boundary prompts DEFAULT OFF.** Only `respond` stops you. Four suites whose subject is a boundary
  window pass **`?prompts=all`**; if a new suite drives one of those windows and sees nothing, that is why.

**⏭ THE EPIC IS CODE-COMPLETE. WHAT IS LEFT IS THE MERGE ITSELF.** Steps 1-23 are done and the stack-model
build landed on top (#225). The rename landed 2026-09-14 as **one symbol per commit** (`openFightEndWindow` →
`openResolutionWindow`, `drainFightEnd`, `fightEndPushCard`, `fightEndGuardCard`, `enterFightEnd`,
`fightEndResult`, `st.fightEnd` → `st.resolution`, the `'fightend'` prompt id, and both suite files). Code and
docs now agree.
*(All of this was stated TWICE, in near-identical paragraphs thirty lines apart, and the second copy still
said main must NOT be merged into the epic yet — which the epic rule and `checkbranch.js` both contradict,
and which was false by 2026-09-29. Consolidated that day. A header that says a thing twice will eventually
say it two different ways, and the stale copy is the one a reader hits first.)*

**⚠ THE VERSION BUMP IS DELIBERATELY NOT DONE, AND THIS IS THE ORDER THAT MATTERS.** `versiontest` asserts
the handoff's **"`main` is at vX"** line against README, so bumping README to **v1.32.0** while the epic is
still unmerged would force that line to claim something false and the gate would correctly go red.
CLAUDE.md's epic rule says the same thing from the other end: *the version is held for the whole epic and
bumped ONCE at the merge.* **FIGHT-END-PLAN.md's step 23 says to bump it here — that instruction predates
the epic rule and is wrong.** Do it in the epic → `main` PR, in ONE commit:
README `**Status:** v1.32.0` · a `### v1.32.0` heading in `CHANGELOG.md` · this header's **`Current
version:`** and **"`main` is at"** lines · CLAUDE.md's own `Current version:` line. It is a **minor** bump
because the rules moved.

**THE ONE SURVIVING `'fightend'` IS THE `localStorage` MIGRATION** (template, plus its assertion in
`prompttest`). The prompt-timing id is persisted, so the migration must know the OLD name by definition —
deleting that literal to "finish the rename" would orphan every preference a player has ticked, silently,
because an unknown key falls back to the default. `prompttest` is 18 → **22** for it, and the migration
assertions were A/B'd by deleting the migration and rebuilding.

**TWO THINGS THE RENAME NEARLY GOT WRONG, both worth knowing before the next one:**
- **`sweep.js` is a HYBRID, not the pure allowlist this line used to claim** — `nettest_*` and `lessontest*`
  are GLOBBED, everything else is named explicitly. Renaming a NAMED suite without updating it drops that
  suite **silently**, and the sweep still prints a green N/N. *(It also quoted "92, not 90"; the filter
  derives 100 as of 2026-09-29. Read the filter in `sweep.js`, never a remembered count.)*
- **A blanket identifier sweep damaged the one paragraph that was ABOUT the old names** (CLAUDE.md's rename
  note), leaving it reading *"`resolution` in a `.js` file is the old name"*. Prose that discusses a rename
  needs rewriting, never renaming — and dated quotes plus the append-only changelog keep "fight end" on
  purpose.

**WHAT THE STACK-MODEL BUILD CHANGED (#225), all of it settled by Aj's rulings:**
- Shield losses left `st.stack` for **`st.losses`** — a loss is the MOMENT, not an effect (§4).
- **`counterTargets` reads the SOURCE CARD TYPE.** Counter Spell's text is *"Counter target Technique"*;
  Quick is a modifier and a co-type, so counter-a-counter falls out. Rides and Form Changes are excluded by
  **not being named**, which is the design — a card that answers them will name those types.
- **The Queen of Diamonds boost works.** It was a `desc` with no field, while the base card already gave its
  privilege away free. Two bugs cancelling into silence, with `CARD-LIST.md` publishing the promise.
- **A trigger is an `effect` carrying `trig`** — uncounterable by RULE, not by stack tag.
- **Transforms push and grant priority.** A whole card type used to bypass the go-round.
- **The Stack now holds effects and only effects**, which §1 has always claimed. `kind` is constant
  `'effect'` and deliberately left in place: it is on the wire, and removing it is churn.

**⚠ WHAT IS NOT DONE. None of it shows in a green sweep, and none of it blocks the merge:**
- **The auto-pass brake is covered in a DUEL and not at 3-6 players** (`nettest_brake.js`, 22, added
  2026-09-29). Four legs: a quiet window does not brake (the control — without it a build that brakes on
  everything passes every other leg), someone else's cast HOLDS the pass and a second press goes through,
  your OWN cast does not brake you (bug 1), and a REMOTE seat's pass is braked and measured against the
  right seat (bug 2, the duel re-apply at `stackMark(hostState, 1)`).
  **`hostApplyMoveN`'s copy is covered too since 2026-09-29** — `nettest_brake3.js` (15), whose two real
  legs are the SAME mutation from opposite sides: the HOST casting into a client's pass window must brake
  it, and the CLIENT casting into its own must not. Either alone is weak; the pair pins the seat, which is
  what the two-handler-families trap costs when you test only one direction.
- **Drag-to-activate in Main is covered** (`dragtest.js`, 17, added 2026-09-29). The pair is the test: the
  same card, the same staging, only the sub-phase varies, because "a drag activated" is equally true of a
  build that lost the branch and does one thing everywhere. Both refusals are covered too, and they turned
  out to be LIVE (in `#dropHint`, while the card is in the air) rather than a message after release.
- **A transform opening a window for a REMOTE seat is HALF covered.** `nettest_ridewedge` drives the HOST's
  own transform and the client's window. The other direction — a client transform opening a window for the
  host or a third seat — is still undriven, and both defects that shipping piece 5 exposed were in driver
  code of exactly that kind. *(This read "UNTESTED IN NETPLAY" flatly until 2026-09-29; `ridewedge` closed
  half of it in September and nobody came back to narrow the claim.)*
- ~~`kind: 'shieldImmune'` is an ORPHANED effect kind~~ — **the dead branch is deleted (2026-09-30).**
  `sph` in `ai.js`'s `playPhase` could never match, so the AI's "shield up when in danger" move did not
  exist. ⚠ THE FIELD IS ALIVE and must not be confused with the kind: Apollo-Sanctuary sets
  `shieldImmune: true` as a patch and `engine.js` reads it, which is why grepping the word finds plenty
  while grepping the KIND finds nothing. Restoring the branch is two lines if a card ever takes it.
- **"1.21 extra priority windows per game" is a SOLO number.** At 3-6 players more seats can hold a Quick,
  so the real figure is higher and unmeasured.

**⚠ ONE GATE LEFT, AND IT IS NOT STEP 18 (2026-09-29).** Step 18 asked for *one real solo game and one
two-device netplay game*. **Aj supplied the netplay game on 2026-09-29** — a complete nine-round duel,
both ends saved, with the play-by-play IDENTICAL across the two seats and the Main → Fight go-round
opening and being answered in real play at rounds 6, 7 and 8. That is the gate's substance and it is
evidence, not reasoning. The SOLO half is closed on `browsertest`'s twelve complete duels through the
real page — **that part is a judgement call and is marked as one**, so re-open it if a solo report ever
contradicts it.
**WHAT REMAINS IS STEP 22'S**: the version refusal against a genuinely OLD peer, with both sides in the
suite faking the number via `?ver=`. It is **not** blocked on two devices, and it is not blocked on Aj:
the version is HELD for the whole epic, so every build in existence is v1.31 and `verIncompatible`
compares the MINOR — the refusal cannot fire at all until the bump. It is a POST-MERGE check by
construction, and listing it as owed beforehand is what kept it looking blocked.

**READ THE TWO NEW RULES IN CLAUDE.md BEFORE THE NEXT BUILD.** Both are about instruments lying: a seeded
fingerprint proves the ENGINE and never loads the page (it was byte-identical through four commits while two
UI defects sat in the build), and a BASELINE HAS TO BE A BUILD YOU DID NOT WRITE (a three-runs-per-arm A/B
produced six confidently wrong data points and cleared the actual culprit).

**WHAT TO WATCH FOR IN A SOLO GAME.** The saved log's `--- PRIORITY WINDOWS ---` ledger now records every
boundary including the silent auto-advances, names the press that opened a transition (`[Next]`/`[Pass]`),
and uses the current vocabulary. With the boundary prompts off you should be interrupted only when a
Technique is cast — anything else is worth a log.

Other branches: **`feat/qr-scanning`** (parked) and **`exp/shield-gain-guard`** (an unreviewed recovered
stash — it breaks the epic's step-12 proof; read its BACKLOG entry before resuming it). Each has an entry
saying what would revive it.

**Sanity check** (from `code/`, ~1 minute) — expect **0 FAIL** from each:

```bash
npm test && node mptest.js && node landscapetest.js
```

A full sweep is **`npm run sweep`** (four at a time, a couple of minutes); `npm run sweep:fast` skips the six
slow stable suites and `node sweep.js -j 1` is the serial fallback if a parallel run ever looks suspicious.
**The suite list, with every expected count, is in CLAUDE.md and that list is the authority** — if a count there
disagrees with a suite, the suite is right. The two gate counts in the header above are asserted by
`versiontest`, so they cannot drift.

**⚑ WHERE TO PICK UP: the top of `## BACKLOG` below.** It is ranked — correctness first, then what a playtester
meets immediately, then features and balance — so the first ★ is the answer. *This line used to name the
specific item and went stale twice, pointing at work that had already shipped; the ranking is the pointer now.*

**BEFORE STARTING, read CLAUDE.md.** Two sections earn their keep every session: the **five mechanical habits**
(each cost real time on 2026-09-01, and one cost *Aj* three rounds of screenshots against a stale file), and the
**doc routing table** — BACKLOG = someone should do it · `DECISIONS.md` = nobody should redo it · CLAUDE.md =
work differently · [`CHANGELOG.md`](CHANGELOG.md) = what shipped.

**What shipped, and why, is in [`CHANGELOG.md`](CHANGELOG.md)** — newest first. It is not summarised here: a
"last four versions" list lived in this spot and rotted, which is the failure this whole file is now organised
against. **Read the top of that file, not a copy of it.**

## BACKLOG (open work only — shipped items move to [`CHANGELOG.md`](CHANGELOG.md))

*Split 2026-08-31: 601 lines → this. Settled decisions, measured dead ends and design notes for shipped
features moved to [`DECISIONS.md`](DECISIONS.md) — that was a third of the section, and its own heading already
said "open work only". Two shipped design specs were deleted outright, since the changelog carries them in
full. **Ranked now: correctness first, then things a playtester meets immediately, then features and balance.**
A struck-through entry does not belong here — if it shipped, move it to [`CHANGELOG.md`](CHANGELOG.md).*

**EVERY ENTRY CARRIES ONE STATUS TAG, FROM A CLOSED SET, AND `versiontest` ASSERTS IT (2026-09-16).** The tag
answers one question — *what does this need NEXT?* — and it exists because free prose could only be read
carefully, while a fixed vocabulary can be CHECKED. The trigger was a real confusion the same day: an entry
whose root cause was found and written down was summarised back to Aj as needing two devices, from memory,
because the answer sat on line 19 of a 24-line entry. **The tag is not a summary of the entry** — it is the
one fact you would otherwise reconstruct by reading all of it, put where re-reading costs nothing.

| tag | means |
| --- | --- |
| `needs a repro` | we cannot reliably make it happen yet — the next move is to see it, not to fix it |
| `root cause found` | diagnosed and written down; what is left is building the fix |
| `ready to build` | understood, scoped, and nothing is blocking it |
| `needs a decision` | blocked on Aj — a design call, not a technical one |
| `needs a measurement` | the next step is a number, not a change |
| `parked` | deliberately not being done now; the entry says what would revive it |

**A tag is a CLAIM and it goes stale like any other.** `root cause found` on an entry whose diagnosis was
never written into the body is the failure this exists to prevent, wearing a tag. When you touch an entry,
re-read its tag.

### Correctness

> **⚠ WHAT BELONGS ABOVE `### For main`, AND THE TEST IS CHECKABLE (routed 2026-09-30).** Aj, on finding
> two just-built fixes riding the epic: *"it sounds like we could have done that on main."* He was right,
> and it was not two entries — **17 of the 26 here were main work**, so anyone triaging *within* these
> sections (as I did) picks main work and builds it on a long branch, where it reaches players only when
> the branch lands.
> **THE TEST IS NOT "does it feel related to priority". It is: DOES THE THING IT TOUCHES EXIST ON `main`,
> UNCHANGED BY THE EPIC?** If yes it can ship on its own and belongs under `For main`. If no — the
> Resolution model, the go-round, the Main/Fight sub-phase split, a suite the epic added — it cannot, and
> it belongs here. That question has an answer anyone can check with a grep; "is this epic work" does not.
> **WORKED EXAMPLES, because the surprising ones are surprising in both directions.** `nettest_passoduel`
> is a FLAKE, which sounds like tooling — but the epic added that suite, so there is nothing on main to
> fix it in. `go-round-lesson` sounds like a tutorial, which is main work all day — except its subject is
> the priority LOOP, which the epic built. And the Fighter Kick
> flash, the straights sort and the lobby ping all sound like
> netplay or engine work and are none of them priority: they ship on main today.

#### Flaky suites

- `parked`              · **⚠ PARKED 2026-10-01 — IT REVIVES WHEN A SWEEP GOES RED, AND NOTHING ELSE WILL DO IT**
  (Aj: *"it hasn't come up in a while… can we just park those and then bring them up again when we encounter
  them?"*). The solo rate is formally rejected and the only signature left is a LOADED sweep — so there is no
  experiment to run that is not just "run the sweep again", which happens anyway. **Revival condition: this
  suite fails in any `npm run sweep`.** The full sweep on 2026-10-01 was 104/104, so there is currently
  nothing to chase. ⚠ Do NOT re-run a solo series against it: 23/23 already rejected that rate, and a 24th
  clean run licenses nothing it has not already licensed.
  **⚠ THE SOLO RATE IS REJECTED — 23/23 GREEN ON 2026-09-30, AND THE SWEEP SIGNATURE IS WHAT IS LEFT.**
  Twenty-three consecutive solo runs, every one `PASS: 8  FAIL: 0`, 33-51s each. **The run count is the
  point, not the streak:** at the filed 1-in-8, `0.875^23 = 0.046`, so this rejects that rate at 5% — and
  eighteen would NOT have (`0.875^18 = 0.090`, a 9% chance of happening anyway). This file has already
  paid for the round-number version of that mistake twice, in both directions.
  **WHAT IT DOES AND DOES NOT LICENSE.** It says the SOLO rate has changed on this machine. It does NOT
  say the suite is fixed: nobody found a mechanism and nothing was changed to address it. And the entry's
  own next step — *"capture a failing solo run's assertions"* — is now unavailable, because there was no
  failing solo run to capture.
  **SO THE OPEN HALF IS THE SWEEP SIGNATURE, WHICH IS A DIFFERENT MEASUREMENT.** In the sweep it HUNG to
  the 300s cap; solo it returned `PASS: 6  FAIL: 2`. Those may not be the same fault, and nothing today
  touched the loaded case — the next attempt should reproduce it UNDER `-j 4` contention rather than
  solo, since that is the only configuration the failure has been seen in since.
  **AND THE FIRST ATTEMPT AT THIS MEASUREMENT REPORTED TWO REDS THAT WERE NEITHER**: the loop wrapped each
  run in `timeout`, which **macOS does not have**, so both "failures" were `rc=127` in 0s. Caught only
  because the harness printed the return code and the elapsed time. A run series that does not print its
  denominator cannot be read.
  **THE ORIGINAL (2026-09-15):** **`nettest_passoduel` FLAKED AT ROUGHLY 1 IN 8, SOLO — MEASURED AND A/B'd.** It hung a lane
  in one `-j 4` sweep (killed at 300s), and the first instinct was the Resolution shield override that had
  just merged: that change can open a window where none opened before, this suite installs `netwindows`
  via `startDuel`, and each unscripted window costs ~6s of grace — a real mechanism for pushing a suite
  past its budget.
  **IT IS NOT THAT.** A/B'd against merged history rather than against my own work, in a throwaway
  worktree rebuilt from `9e41d94` with browsers killed between runs: **1 red in 8 WITHOUT the fix, 1 red
  in 7 WITH it.** The baseline also emits `netwindows: auto-passed 1 unscripted window(s) — host:1`, so
  unscripted windows in this suite predate the change entirely. Pre-existing, and now recorded.
  **THE SIGNATURE DIFFERS BETWEEN A SWEEP AND A SOLO RUN** — in the sweep it HUNG to the 300s cap; solo it
  came back `PASS: 6  FAIL: 2`. Capture a failing solo run's assertions before theorising, because those
  two may not be the same fault.
  **TWO CONSECUTIVE SWEEPS WERE 91/92 WITH DIFFERENT SUITES RED** (this one, and `lessontest_rides` on its
  documented "the J is spotlit" poll — 5/5 green solo), at **261s and 434s** against a ~240s band. That
  spread is the machine, and this file's own rule applies: the tell that an intermittent is being measured
  badly is the rate moving when the code did not. Do not read a single 91/92 as a regression.
    **⚠ AND THE LOADED HALF IS NOW MEASURED TOO — CONTENTION IS THE WRONG LEVER (2026-10-01).** Eight runs
  with the three heaviest suites (`mptest`, `browsertest`, `landscapetest`) running concurrently, which is
  the shape a `-j 4` lane actually has: **8/8 green, 42-47s**. Solo the same day was **33-51s**. The
  loaded band is TIGHTER than the solo one, so load does not slow this suite measurably at all.
  **THAT REFUTES THE FILED MECHANISM RATHER THAN FAILING TO FIND IT.** The theory was that unscripted
  windows cost ~6s of `netwindows` grace each and could push the suite past its budget under contention.
  Measured: the unscripted window fired in **1 of 8** loaded runs (`auto-passed 1 unscripted window(s) —
  host:1`), cost its ~6s, and that run finished at 44s like the rest. Six seconds cannot become 300.
  **WHY LOAD DOES NOT BITE HERE, which is the reusable part:** this suite's runtime is dominated by
  WALL-CLOCK waits, not CPU — `__cmf.graceMs(300)`, fixed `wait(400)`/`wait(500)` beats, and a poll that
  returns the instant its condition holds. CPU contention does not slow a timer. **Before blaming
  contention for a suite's budget, measure whether contention slows that suite at all** — it is one
  loaded run against one solo run, and here it would have saved two investigations.
  **SO 31 RUNS NOW SEPARATE US FROM THE ONE OBSERVED HANG** (23 solo + 8 loaded, zero reproductions), and
  it has been green in every sweep run on 2026-09-30 and 2026-10-01. **NOT CLOSED**, deliberately: it was
  a real 300s hang in a real sweep, and this file's own rule is that a known-real bug which stops
  reproducing gets its mechanism forced rather than a ghost-closure. What is left to try is the thing no
  harness can stage — catch the next occurrence IN a sweep, where `sweep.js` already SIGKILLs at 300s and
  keeps the suite's output. A port collision is ruled out: `PORT` has been per-job since v1.31.82.
`[id: nettest-passoduel-flaky]`

#### Rules, priority and the stack

- `parked`              · **⚠ PARKED 2026-10-01 — THE DETECTOR IS THE PLAN, AND IT IS ALREADY LIVE.**
  Four attempts have failed to force this, and the thing that will describe the fifth occurrence is already
  built and shipping: `enterResolution` counts a second entry inside one round and `noteBlockedResolves`
  writes **`⚠ DOUBLE RESOLUTION BLOCKED`** into the saved log, the priority ledger is broadcast to every
  seat since 2026-09-30, and the ROUND BOUNDARY trace rules the clean-up family in or out on its own.
  **Revival condition: a saved log carrying that line, or a report of a shield lost to a pile that had
  already resolved.** Nobody has to go looking — the next occurrence arrives diagnosed. **Check for the
  detector line FIRST in any log Aj sends.** Everything below is kept because it is what the next reader
  needs the moment that happens, including four ruled-out families and the staging recipe that works.
  ⚠ A LEAD FROM THIS ENTRY MAY HAVE BEEN CLOSED ELSEWHERE — see `park-write-clobbers-live-park`, which was
  found on 2026-10-01 chasing this and is filed as its own entry because it stands on its own evidence.
  **ROUND 2 RESOLVED TWICE IN A REAL DUEL, AND IT COST A SECOND SHIELD (2026-09-15, unexplained).** From
  Aj's saved logs of one game, BOTH seats, narrated identically:
  ```
  Round 2 begins. Each player draws 2.
  Aj played a Special - Trio (A♦, A♦, A♠).
  Aj won with a Trio - You lost a shield.
  Round 2 begins. Each player draws 2.          ← again, and no play between
  Aj won with a Trio - You lost a shield.       ← again
  Round 3 begins. Each player draws 2.
  ```
  **THE LEDGER AGREES**: two `r2  FIGHT END — round resolved  winner=Aj struck=You` entries, with a full
  extra `MAIN → FIGHT` cycle between them still stamped `r2`, and every other round appearing exactly
  once. `announceRoundWin` is documented as "the one funnel all six round-win paths reach exactly once".
  **AND IT WAS REAL DAMAGE, NOT A DOUBLED LOG LINE** — which is the part that makes this worth chasing. A
  screenshot of round 6 shows the struck seat on **1 of 4 shields**. Losses narrated before round 6 are
  r2, r2-again and r3 = three. A narration-only duplicate would leave 2. The kick then lands in r7 off
  exactly the four strips, so the arithmetic closes on the duplicate being genuine.
  **AJ'S OWN TWO DETAILS ARE THE LEAD, AND THEY NAME ONE FUNCTION** (*"i lost twice to the same play…
  not sure why it never cleared.. but also there was no beginning of round"*). The pile never cleared and
  the round never began — and **`finishCleanup` is the single function that does BOTH**: `st.round += 1`
  and `st.pile = null` are two lines apart in it, along with the initiative hand-off and the round-long
  expiry. Every symptom in this entry is "`finishCleanup` did not run", and a pile still on the table with
  the same winner still standing re-resolves to the same result. **Start there, not at the narration.**
  **IT IS REACHED FROM EXACTLY ONE PLACE, WHICH MAKES IT CHECKABLE:** `finishRoundWin` sets
  `st.cleanup` + `st.cleanupResult` and opens the Clean-up go-round; the drain in `openResponseWindow`
  then unparks and calls `finishCleanup(st, cr)` — **but only `if (cr)`**. A path that reaches the
  Clean-up branch with `st.cleanupResult` already null closes the window and silently does none of the
  round end. That is the shape to hunt.
  **THE ENGINE'S RE-ENTRY GUARDS LOOK RIGHT, so suspect the netplay layer first.** The Resolution branch
  unparks `st.resolution` *before* running `applyRoundLossBody`, with a comment saying precisely why ("a
  still-parked continuation would open a second go-round for a window that has already closed"), and the
  Clean-up branch is built to the same shape. This game was a DUEL, so the relevant seam is
  `drainResolution` and `hostSettle`'s park family — and CLAUDE.md's stated tell for a missed
  `drainResolution` call site is *"a table that parks with the round number unchanged"*, which is
  literally what was observed.
  **RULED OUT ALREADY, so nobody re-checks them:** the transition re-apply is braked on BOTH handlers —
  the duel by a `stackMark` compare around `hostSettle`, the N-player by `moveToPlayThen`'s third
  argument with `seat` passed as the actor (checked 2026-09-15, after first mis-reading the N-player one
  as unbraked). `nettest_roundstall` and `nettest_clientwin` both pass, so it is not the shape either
  stages.
  **⚠ IT HAPPENED AGAIN ON 2026-09-16 AND THIS TIME IT KILLED A PLAYER.** Round 12, same signature — the
  banner twice, no play between, the pile still standing — and the duplicate landed the **FIGHTER KICK**.
  The player had cast **Sanctuary** that round and it worked: the shield he gained is the one the first
  resolution took. The duplicate then killed him at 0. So this does not merely cost a shield; it decides
  games, and it ate a correct defensive play.
  **THE LEDGER NAMES THE MECHANISM NOW, which the first instance could not.** Round 12 carries **two
  `MAIN → FIGHT [Pass]` entries** — `auto-advanced`, then `go-round opened` — two `[clean-up]`s and two
  `FIGHT END`s. That line is written synchronously inside `moveToPlayThen`, so it cannot be a log-ordering
  artefact: **the Pass ran twice.**
  **IT IS NETPLAY-ONLY, AND THAT IS MEASURED RATHER THAN ASSUMED.** The doubling seat is the **HOST**, and
  its trace ends `move IN from seat 1 op=decline q=637` / `op=decline q=640` **70ms apart**, then
  `endGame`. Two attempts to reproduce it solo in the real page both FAILED — staged with the transition
  opening a window, and with Aj's exact `auto-advanced` shape — because two synchronous clicks resolve the
  round exactly once even on the unfixed build: click 1 runs far enough to set `busy` first. **So the
  re-entry arrives over the WIRE, and a netplay repro is the next step**, not another solo probe.
  **ONE ASYMMETRY WAS CLOSED ON THE WAY AND IT IS NOT THE FIX** (PR #230): `drainResolution` was the one
  `settleWindows` hand-off that did not set `busy` first. Real, worth closing, and explicitly NOT shown to
  cure this. Do not read that commit as having fixed this entry.
  **AND ONE FIX SHAPE IS ALREADY RULED OUT, MEASURED:** refusing Fight/Pass while `respondFor != null`
  stalls the board permanently, because `moveToPlayThen`'s settle is what DRAINS the window on some paths.
  `browsertest` went from 70s to past 400s. Lock the board, never forbid the action.
  **A DETECTOR IS NOW LIVE, SO THE THIRD OCCURRENCE ARRIVES DIAGNOSED.** `enterResolution` is the funnel
  both round-win paths reach, and it counts a second entry inside one round (`blockedResolves`);
  `noteBlockedResolves` writes **`⚠ DOUBLE RESOLUTION BLOCKED`** into the saved log. The first two
  occurrences were silent — the shield went and nothing said a round had resolved twice — so the next log
  Aj sends will either carry that line or rule the duplicate out entirely. **Check for it first.**
  **IT DETECTS AND DOES NOT REFUSE, AND THAT IS A HELD DECISION, NOT AN OVERSIGHT.** A refusing version was
  written and pulled the same day: `browsertest` hung twice with it in. The hangs could NOT be pinned on
  it — a counting build then measured **0 duplicates across 12 solo duels**, so the condition never fired
  at all, and both hangs followed probe runs that had left stray browsers on the machine — but "cannot be
  attributed" is not "is safe", and refusing changes what the caller receives at the exact moment a round
  ends. **Ship the refusal when there is a repro to prove it against**; the one-line change is
  `if (st.resolvedRound === st.round) return { ok:true, state:st, alreadyResolved:true }`.
  **AND SOLO IS NOW MEASURED CLEAN, which sharpens the netplay reading:** 0 duplicate resolutions across 12
  full duels in the real page, both declining and casting into every window. Whatever drives the second
  resolution is not reachable by the solo driver.
  **⚠ ATTEMPT 3 (2026-09-30) — A NETPLAY REPRO WITH DUPLICATE RAW INTENTS. IT DID NOT REPRODUCE, AND THE
  INSTRUMENT COULD NOT HAVE SEEN IT ANYWAY.** Staged a duel, host wins with a pair of Aces the client
  cannot answer, then `__cmf.clientSend` a `{op:'pass'}` followed by TWO `{op:'decline'}` 70ms apart — the
  interval measured off the real trace, and sent RAW so the client's courtesy gate cannot swallow the
  duplicate the way the UI would. Result: one round, one shield, detector quiet.
  **THAT RESULT IS WORTH NOTHING ON ITS OWN, AND THE A/B IS HOW WE KNOW.** Removing the duel's re-apply
  brake — `if(it.op==='pass' && stackMark(hostState, 1)!==passMark) return broadcastMirror();` — left the
  suite **still green**, so the staging never reached the braked branch at all. The suite was DELETED
  rather than committed: a repro that cannot fail reads as coverage, which is worse than no suite.
  **AND THE HOST TRACE SAYS EXACTLY WHAT WAS MISSING**, which is what makes attempt 4 cheaper than this one:
  ```
  move IN from seat 1 op=pass q=4
  move IN from seat 1 op=decline q=5   x2      ← both duplicates DID arrive…
  ```
  …and nothing after it. Both declines landed and were no-ops, because **the pass resolved the round
  directly instead of returning `{ok:false, transition:'play'}`** — so `hostSettle`'s re-apply, where the
  brake and the doubling both live, never ran at all.
  **SO THE STAGING FACT TO ADD IS: THE CLIENT MUST PASS FROM THE *MAIN* SUB-PHASE.** The real ledger's two
  lines are `MAIN → FIGHT [Pass]` — `auto-advanced`, then `go-round opened` — and a client already in the
  Fight sub-phase passes straight through without transitioning. Every attempt so far, solo and netplay,
  has passed from Fight. Get the client's turn to BEGIN in Main with the host's Special already on the
  table, and the braked branch becomes reachable; only then does a double decline have anything to race.
  **`__cmf.boardStamp()` DOES NOT CARRY THE SUB-PHASE** (it reads `4:0/pair2/14`), so attempt 4 needs a way
  to SEE it — assert the client is in Main before sending, or the same silent miss repeats.
  **⚠ ATTEMPT 4 (2026-10-01) — THE STAGING FINALLY REACHED THE CHAIN, AND THE WHOLE FAMILY IS NOW RULED
  OUT.** Attempts 1-3 never got the press to land; this one asserts that it did (`1 crossing(s) logged`)
  before asking whether it landed twice, which is the staging assertion attempt 3 lacked. It still does
  not reproduce — and this time that result is worth something, because three separate A/Bs say the
  duplicate-decline mechanism cannot produce it:
  - **BOTH DECLINES ARRIVE AND ARE ACCEPTED.** Measured in the host trace — `op=decline q=19` and
    `op=decline q=22`, 70ms apart, neither refused as stale. So the stamp check is not what absorbs them,
    which was the obvious guess and is wrong.
  - **REMOVING THE DUPLICATE-REPLY DEFENCE CHANGES NOTHING.** `var ns=netSettle; netSettle=null;` is
    commented *"stale/duplicate reply, ignore"* and is the defence by name; deleting the null left the
    suite green. Deleting `moveToPlayThen`'s `if(g!==gen) return;` **as well** — both defences off at once
    — also left it green.
  - **AND A GENUINELY DOUBLED PASS DOES NOT LOSE A QUIET SHIELD, IT BLOWS THE PAGE UP.** Forcing a second
    `E.pass(state, YOU)` in `doPassBody` (non-recursive, guarded by a one-shot flag) gives
    `Maximum call stack size exceeded` on the host. **Aj's game did not crash**, so whatever took the
    second shield is not a doubled `doPassBody`/`E.pass` — which is the family every attempt so far has
    been hunting.
  **⚠ AND THE CROSSING COUNT IS THE WRONG INVARIANT, WHICH IS WHY THIS SUITE WAS NOT COMMITTED EVEN AS A
  SKELETON.** `moveToPlayThen`'s own comment says a held pass is pressed **twice** by design — *"when a
  rival really casts into the window it opened, the pass is held and the board comes back to you… press
  Pass again"* — and every turn handover resets `subPhase` to `main`, so the second press crosses
  Main → Fight again and logs a second line legitimately. **Two `MAIN → FIGHT [Pass]` lines are therefore
  not by themselves the bug.** The signature that IS the bug is the pair of `[clean-up]`s and `FIGHT END`s
  — two *resolutions of one round* — which the detector and the shield count measure and the crossing
  count does not. An attempt 5 that asserts on crossings is asserting the defect's co-occurrence, not the
  defect.
  **THE STAGING RECIPE WORKS AND IS THE EXPENSIVE HALF — DO NOT REDERIVE IT.** Recorded here because the
  suite itself was deleted (a repro that cannot fail reads as coverage):
  ```js
  // forceAll leaves the HOST on turn (measured: turn:0), so the pile is built the way a real game builds it
  hands:[[D(4,'C','h1'),D(5,'C','h2'),D(6,'C','h3')],      // host: a jab to lead, nothing that answers a 10
         [D(10,'S','ca'),D(10,'H','cb'),D(9,'D','ley')]],  // client: a 10 to beat it, ♦9 Leyline for the window
  energies:[13x D(3,'D'), same], shields:[3,3], opts:{ round:4 }
  // 1. host leads h14C through its own UI (enterFight, click the group, click Fight) — retry, `busy` eats clicks
  // 2. client beats via __cmf.clientSend({op:'play', ids:['ca10S']})  ← NOT the UI; see below
  // 3. host presses Pass from Main; client sends two raw {op:'decline'} 70ms apart
  ```
  **TWO TRAPS INSIDE THAT RECIPE, BOTH OF WHICH COST A RUN EACH.** Driving the CLIENT's board does not
  work here — it still read *"Rival is fighting…"* with Fight disabled when the clicks landed, `busy`
  dropped them in silence, and the probe reported `sel:0`, i.e. the suite accusing the product of being
  unable to play; `clientSend` goes round it, and the client's UI is not this bug's subject anyway. And
  the pile label reads **`"Rival · Jab"`** — seat and SHAPE, never the rank — so a `/10/` probe on it
  reports a healthy play as a failure; assert the card LEFT THE HAND instead.
  **⚠ THE `auto-advanced` → `go-round opened` ASYMMETRY IS CLOSED — IT WAS CHASED AND HARDENED IN PR #230,
  AND CHASING IT AGAIN ON 2026-10-01 RE-DERIVED THE SHIPPED FIX.** The mechanism is written verbatim in
  `drainResolution`: `moveToPlayThen`'s auto-advance branch is `if(state.respondFor == null) return
  proceed();` with **no `busy=true`**, so a pass that auto-advanced reached `E.pass`, opened the go-round,
  handed off to `settleWindows` and returned to the event loop with the board still LIVE. That comment is
  explicit that it is HARDENING and not a demonstrated fix. **Read the fix comment before re-chasing a lead
  this entry names** — CLAUDE.md already says to grep every symbol an entry names, and the twin is that a
  mechanism may already be owned by a comment on the function that fixed it.
  **TWO DIAGNOSTIC RULES FOR READING THIS ENTRY'S EVIDENCE, both of which cost a detour on 2026-10-01:**
  - **THE ORDER IS THE DIAGNOSIS.** `go-round opened` → `auto-advanced` is the DOCUMENTED HELD PASS —
    `moveToPlayThen`'s own comment says a pass is pressed twice by design when a rival casts into the
    window it opened — and it is correct. Only `auto-advanced` → `go-round opened` is the bug shape,
    because the first line means the pass already went through (`return proceed()`). `cardmen-battle-log
    (1).txt` r7 carries the benign order and reads alarming.
  - **TWO `[Pass]` TRANSITIONS IN ONE ROUND MEAN NOTHING ABOVE 2 PLAYERS.** `pass` does not remove a seat
    from the round — it bumps `st.passes` and resolves at `>= aliveCount(st) - 1`, and any play in between
    resets the count, so at 3 players passing twice in a round is ordinary. **Only in a DUEL is the first
    pass structurally terminal** (`aliveCount - 1 == 1`). `cardmen-battle-log.txt` r9 has two
    `[Pass] auto-advanced` in one round and is a 3-player game, i.e. not evidence. Check the header's seat
    count before reading any ledger pair as a doubling.
  **AND THE DUEL PATH LOOKS COVERED, WHICH IS WHY ATTEMPT 4 WAS NEGATIVE.** `E.pass` returns
  `resolveRoundWin(st)` BEFORE `st.turn = nextPlayer(st, p)`, so mid-drain the turn is still the passing
  seat and a client turn-op is refused by the engine's own `p !== st.turn`; the host's own second press is
  refused by the `busy` PR #230 now sets. The remaining wire question is filed separately as
  `netplay-intents-bypass-busy`.
  `[id: round-2-resolved-twice]`

- `needs a repro`       · **★ THE DOUBLE RESOLUTION IS STILL UNREPRODUCED — AND THE 2026-10-01 "REPRO" WAS
  MY OWN STAGING (corrected 2026-10-02).** `nettest_parkclobber` reported `⚠ DOUBLE RESOLUTION BLOCKED` on
  its clobber leg and clean on its control, which read as the repro this entry had wanted since
  2026-09-15. It was not. **`forceAll` rewinds `st.round` and does NOT reset `st.resolvedRound`**, so
  staging the second leg at the round the FIRST leg had just resolved left `round === resolvedRound`
  before anybody played — and `enterResolution` counts precisely that as a duplicate on its first entry.
  The detector was right; the staging manufactured the condition it detects.
  **MEASURED WITH THE ROUND NUMBER AS THE ONLY VARIABLE, one clean build, no product change:**

  | clobber leg staged at | detector |
  | --- | --- |
  | round 3 (as shipped 2026-10-01) | **`1 + 0`** |
  | round 6 | **`0 + 0`** |

  **TWO CANDIDATE FIXES WERE JUDGED AGAINST THAT ARTIFACT AND BOTH VERDICTS WERE WRONG.** Refusing a stale
  turn op at the host gate (`if(hostState.resolvedRound === hostState.round && (play|pass|toFight))
  return broadcastMirror();`) was recorded as *"kills the defect but wedges the duplicate"* — the wedge was
  the SAME stale stamp making the guard refuse the leg's own LEGITIMATE pass, which the trace shows
  outright (`STALE TURNOP REFUSED round=3 resolvedRound=3` on the real click, 70ms before the injected
  one). A variant exempting the internal re-apply (`it.__reapply`) measured IDENTICAL and was dropped.
  **Neither is shipped: there is nothing demonstrated to fix.**
  **WHAT STILL STANDS, because it was measured separately and headlessly:** mid-drain the turn sits on the
  seat that passed — `pass` does `return resolveRoundWin(st)` BEFORE `st.turn = nextPlayer(st, p)` — so
  `hostApplyMove`'s only gate is open to that seat's next turn op. That is a real property. What is NOT
  established is that anything harmful follows from it: with distinct round numbers the injected duplicate
  is absorbed, the round resolves once and the table keeps moving.
  **THE SUITE IS KEPT AS A REGRESSION GUARD, NOT A REPRO.** Both legs now assert `0 + 0` plus liveness, and
  its ratchet is deleted — a ratchet pinning an artifact is worse than none, because it makes the artifact
  look like a known product defect. The control leg is what keeps the clobber leg readable.
  **THE RULE THIS COST: A HARNESS THAT REWINDS STATE MUST REWIND ALL OF IT.** `forceAll` sets `round`,
  `turn`, hands, energy, shields and forms, and leaves every other per-round stamp alone. Any assertion
  keyed on one of those stamps is measuring the harness. **Before believing a detector that only fires on
  the SECOND leg of a suite, run that leg FIRST, or give it a fresh round number** — one variable, two
  runs, four minutes.
  `[id: duplicate-turnop-double-resolves]`

- `parked`              · **THE CLEAN-UP → BEGINNING ORDERING IS FIXED; IT IS THE TEST THAT IS STILL OWED (2026-09-16).**
  **⚠ RETAGGED FROM `ready to build` ON 2026-09-30, AND THE ENTRY ITSELF SAYS WHY** — it is not ready to
  build, it is blocked on a card existing. Nothing in the game can put a trigger on the stack during
  Clean-up, so both orders are observationally identical and the test would be vacuous. `parked` is the tag
  whose definition is *deliberately not now, and the entry says what would revive it* — which this one
  already did, in its own last paragraph. A tag is a claim and rots like any other. Aj
  called the mis-ordering a bug rather than a latent one and was right — it was shipped code with the
  wrong order in it. `finishCleanup` ran its events and then `pushUpkeepTicks` in the same breath, so a
  trigger a clean-up event had stacked sat UNDERNEATH the ticks and, The Stack being LIFO, the next
  round's Upkeep resolved before the previous round's Clean-up had finished. The ticks are OWED now
  (`st.upkeepTicks`) and paid by the Upkeep branch, which is reached only once the stack is empty.
  **WHAT CANNOT BE TESTED YET, AND WHY THAT IS NOT AN EXCUSE TO FORGET IT:** nothing in the game can put
  a trigger on the stack during Clean-up — the engine has exactly ONE trigger site and it is the tick
  itself — so both orders are observationally identical today and the seeded fingerprint is unchanged.
  `test.js` guards the refactor (the tick still lands, exactly once, debt cleared) and says in place that
  it cannot guard the order.
  **THE DAY A CARD TRIGGERS OFF A CLEAN-UP EVENT, WRITE THE ORDERING TEST FIRST** — that is the same day
  the old code would have started being wrong, and `E.cleanupOrder()` already names the events
  (`roundAdvance → initiative → pileClear → expire → equipReset → temps → stampRound`) for it to hang off.
  `[id: clean-up-beginning-ordering]`

#### Netplay

#### Phone and layout

#### Tutorials and prompts

### Features

- `parked`              · **A GO-ROUND LESSON — PARKED UNTIL THE CARD POOL HAS MORE QUICKS (Aj, 2026-09-30:
  *"we're only going for number 2 when we have more quicks in the card pool. so that's probably a bit
  later"*).** What no lesson teaches is priority as a LOOP: that it passes seat to seat, that you can HOLD
  it and stack a second Quick of your own, and that passing is what closes the go-round. "Phases and
  Quicks" teaches the two windows a player meets — a cast and Resolution, *"two Quicks, two different
  windows"* — and Main → Fight is named as a priority point since 2026-09-30. None of that is the
  go-round itself.
  **THE REVIVAL CONDITION IS A NUMBER, so nobody has to re-litigate it: there are THREE base Quicks
  today** — ♦4 Counter Spell, ♦9 Leyline Ascension, ♥5 Annoint (plus six Form/Super patches that GRANT
  `quick`). A lesson about holding priority and stacking needs a player to plausibly hold two castable
  Quicks at once, and with three in the pool that staging is a contrivance rather than a game. Re-count
  when the pool grows; if it is still three, it is still parked.
  **AND BUDGET FOR IT WHEN IT COMES.** This repo's own rule: a lesson that narrates a mechanic is an AUDIT
  of that mechanic, and the phases lesson found eleven shipped defects. The go-round is the deepest
  mechanic in the game, so expect the same — a reason to do it, not a reason to avoid it, but not a
  tutorial-sized task.
  **THE SMALL HALF ALREADY SHIPPED**, which is why `tutorials-still-teach-boundary` is closed. Main →
  Fight was the third unnamed boundary and the only one a player actually meets (Upkeep and Clean-up
  default OFF, so naming them teaches a window nobody sees). Step 3 now says crossing the doorway offers
  everyone a chance to act, and `lessontest_phases` asserts it against the LEDGER.
  `[id: go-round-lesson]`

- `parked`              · **A SHIELD GAIN AS A GUARD IS PARKED on `exp/shield-gain-guard`** (2026-09-10). `exp/` and not `parked/`:
  the table reserves `parked/` for work that is **built, green** and deliberately unmerged, and this is an
  unreviewed stash that has never been run — and it may well be reverted, which is what `exp/` is for. Widens `guardEffFor`
  to admit a card that GAINS a shield, so Hector's Sanctuary — a Quick by the Form, but granting no
  immunity — can be sprung at the moment it is for. Aj's own reasoning is in the patch: *"really since it's
  a quick it should be offered everywhere the player gets priority."*
  **Recovered by accident**: a `git stash pop` after a failed `git stash push` applied an earlier session's
  stash into unrelated work. It has never been reviewed or run as shipped.
  **Why it is not merged:** it breaks the epic's step-12 superset proof, measured — base Sanctuary is
  `quick: false`, and the rebuilt window gates on `canAddToStack`, which requires `quick`. Applied on the
  epic, `shadowtest` half A gives 93 counterexamples and half B 108 live violations.
  **WHEN TO COME BACK TO IT: at step 19, and the answer may be "never".** Step 19 *deletes* `guardEffFor` —
  it is on the epic's DELETE table by name, along with `shieldGuardCard` and all four API exports. This
  patch widens a function that is scheduled to stop existing, so it cannot simply be rebased on: the
  question it answers has to be re-asked of the new window.
  **Re-ask it as:** *should base Sanctuary be castable in a priority window?* Under the rebuilt model only
  Quicks are, and base Sanctuary is not one — Hector makes it one, and Hector-Sanctuary is already admitted.
  So the quoted reasoning (*"since it's a quick it should be offered everywhere the player gets priority"*)
  may be **satisfied by the rebuild**, and what is left is a card-design question (should the base card be a
  Quick?) rather than a window question. **Unverified; check at 19, do not assume.**
  Reproduce the failure by applying the patch on `epic/priority-windows` and running `node shadowtest.js`
  (the suite does not exist on `main`, so running it on this branch proves nothing).
  `[id: shield-gain-guard-parked]`

### For main

*Work that is NOT epic work — it touches the shipped game rather than the priority model, and could ship on
its own. Kept separate so it does not get tangled in `epic/priority-windows`, and so whoever picks it up
knows to check whether the epic has already moved the same lines.*

### Correctness

- `ready to build`      · **THE RESPOND? WINDOW DOES NOT SAY WHAT A TARGETED EFFECT IS TARGETING** (Aj, 2026-09-30,
  with a screenshot of the window mid-game: *"what is the strip targeting?"*). It reads
  `Flonne ▸ Forceful Strip · 7♦ (resolves next)` and *"Return Target Equipment to its owner's hand"* — and
  never names the Equipment. **That is the whole decision**: whether to spend Annoint depends entirely on
  WHICH piece is about to be stripped, and the one window that exists to let you decide withholds it.
  **THE DATA IS ALREADY ON THE STACK ENTRY AND THE RENDERER IGNORES IT.** `st.stack.push({ … opts: opts … })`
  carries the cast's `opts`, and `opts.target` is the equipment id; the stack row builds its `label` from
  `eff.name` and its `sym` from `o.card`, and reads neither. **Same shape as the forced-discard line fixed
  the same day** — `ai.js` had recorded `who` and the renderer read only the count. Look for this shape
  whenever a window under-describes something: the field is usually there.
  **USE `pickEquip`, DO NOT RE-DERIVE THE NAME.** Annoint's own resolution already resolves the same
  target with `pickEquip(st, rem.p, rem.opts && rem.opts.target)`, so a label built from that function
  cannot disagree with what answering will actually protect — which is the failure mode that matters here,
  worse than saying nothing. This is the `isChopOf` / `resolveIds` rule: one definition, called twice.
  **IT IS NOT THE ★ STACK VISUALISER, and should not wait for it.** That entry is a presentation overhaul
  (`stack-visualiser`, parked behind `priority-modal-redesign`); this is one missing noun in a line that
  already exists, and it is what makes the current window answerable in the meantime.
  **THE TEST IS BOTH WAYS ON ONE BOARD**, because "names an Equipment" is equally true of a build that
  names the wrong one: stage TWO pieces of Equipment on the target seat, strip a named one, and require
  the row to carry that one AND NOT the other. An untargeted effect on the stack must still render
  unchanged — the row is shared.
  `[id: stack-row-omits-target]`

- `needs a repro`       · **WAS AJ ACTUALLY TELEKINESIS'D, OR WAS SOMEONE ELSE? THE LOG COULD NOT SAY — AND NOW IT CAN
  (2026-09-30).** He reported *"i did not discard any cards despite being telekinesis'd. was it auto picked
  again?"* from a 3-player game with FOUR `Adell played a Technique - 3♦ Telekinesis` lines in it. The
  question was unanswerable, because `buildOppBeats` rendered a forced discard with the CASTER's name — so
  *"Adell discarded 2 cards"* and "somebody was hit and we cannot tell who" were the same text. **That half
  is fixed**: the line names the target (`oppbeatstest`, A/B'd).
  **WHAT IS STILL OPEN is whether a discard owed by the HUMAN ever gets asked for.** Measured on the way:
  the ENGINE is correct — a staged AI cast at seat 0 returns `ok`, sets `discardPending {player:0,count:2}`
  and leaves the hand untouched for the target to choose. So if he WAS the target, the gap is in the UI
  never opening the picker. `runOpponents`' `step()` does check
  `state.discardPending && state.discardPending.player===YOU` first, so it should prompt — which is
  precisely why this needs a repro rather than a patch.
  **THE CHEAP NEXT STEP IS HIS NEXT LOG.** With the naming fixed, one more 3-player game says outright
  whether he is ever the target; if he is and no `You discarded` line follows, the picker is the bug and
  the repro is already half-built. A staged attempt to make the AI cast it did NOT cast — its heuristics
  declined — so drive the engine directly (`E.activate(st, 1, 'tk', {target:0})`) and then let the UI run.
  `[id: telekinesis-target-never-asked]`

- `root cause found`    · **THE HOST'S "🔔 Ping the table" IS INVISIBLE TO THE CLIENT — IT PAINTS BEHIND THE LOBBY (reported in live
  play, 2026-09-15).** The client's handler is `SFX.play('ping'); setMessage(…)`, and `setMessage` writes
  `#message`, which lives **inside the board**. `#netroot` is `position:fixed; inset:0` at `--zNetroot`, so
  in the lobby it covers the viewport and the ping's only visible output lands behind it. The client gets a
  beep and nothing to read — reported as *"the client didn't receive any prompts to ready"*.
  **THE HOST GETS POSITIVE FEEDBACK, WHICH IS WHY IT SHIPPED.** `lobbyPingMsg` *is* inside netroot, so the
  host reads "🔔 Pinged your table." and concludes it worked. Only the receiving seat can see the failure,
  and only while the lobby is up.
  **`hostPing`'s OWN COMMENT NAMES THE WINDOW IT BREAKS IN:** *"it works BEFORE the game starts, which is
  exactly when it is needed"* — which is precisely when its feedback is invisible. Same family as the
  `.overlay`-behind-`#netroot` bug, and the same consequence for testing it: **no DOM assertion can see a
  stacking bug**, so this needs a visibility check, not a presence one.
  **THE FIX RENDERS INTO THE LOBBY**, and must cover BOTH client lobby branches — readied and not — since
  the nudge is aimed at the seat that has *not* pressed Ready yet.
  `[id: ping-invisible-to-client]`

- `needs a repro`       · **⚠ ITS NAMED ROOT WAS FIXED 2026-09-30 — RE-CHECK BEFORE INVESTIGATING FURTHER.**
  The entry `nothing-animates-press-fight` (now closed) said this was *"almost certainly the shanked animations entry as
  well… treat them as one investigation"*, and that root is now closed: `playCards` captures `flipFrom`
  BEFORE its client return, so a client's own play FLIPs from its slot in hand instead of sliding in like
  a rival's. `nettest_drag` asserts the branch both ways (host's card 0 flips, own card 1) and A/B's red.
  **THIS ENTRY IS NOT CLOSED WITH IT, because "shanked" was never pinned to that root** — it is one word
  from one session, and closing a `needs a repro` on a sibling's fix is how a real report gets lost. The
  next move is unchanged and is cheap: play a netplay duel and say which animation still looks wrong, or
  confirm it does not. A suite cannot judge how something LOOKS; it can only say which branch ran.
  **THE ORIGINAL:** Reported twice now without a specific frame, so **the first job is
  to make the report precise** — which beat, which seat, reduced-motion or not — rather than to start
  changing dwells. Two things already known that a vague animation report usually turns out to be:
  `buildOppBeats` is the single funnel both drivers use and a bespoke path silently misses whatever it
  gains (the tutorial's 51ms cast), and a CLIENT does not run `startGame`, so anything reset only there is
  never reset on a client (`resetBoardMemory` is the shared one). Check both before inventing a number.
  `[id: client-animations-shanked]`

- `root cause found`    · **THE "THE 2" LESSON STALLS BECAUSE ITS PILOT LEADS NOTHING — AND THE STALE PILE
  IS THE CONSEQUENCE, NOT THE CAUSE (Aj, 2026-09-17, with a saved log).** *"the rival never plays their full
  house of 2s"* · *"the last play did not clear... i could not click Next because of the pair of 2s in the
  play area."*
  **THE MECHANISM — `tutPilotTwos`'s leading branch:**
  ```js
  if(!cur){                     // LEADING — only ever happens in round 3
    var t3=twos(3), pr=pairOf(2);
    if(t3.length===3 && pr && play(t3.concat(pr))) return log;
  }                             // falls through, returns an empty log, plays NOTHING
  ```
  It needs **three 2s AND a non-2 pair** and guarantees neither. Miss either and the Rival does nothing, so
  the round never resolves and the previous round's pile stays on the table — which the ENGINE still holds,
  not just the UI, which is why the board refuses the player's full house with *"Special Full House —
  doesn't beat the Special Pair."* Step 7 meanwhile insists *"They lead a full house built on three 2s…
  Beat it."* No way out.
  **THE COMMENT DIRECTLY ABOVE IT RECORDS THE SAME BUG, FIXED ONCE:** *"This scanned 3..13 and so could not
  see a pair of Aces… it then had no full house to lead and **passed forever**."* That fix widened the rank
  scan; the hole that remains is having no qualifying pair at all, and the failure is identical.
  **FIVE HYPOTHESES MEASURED AND KILLED 2026-09-17 — the value here is what NOT to re-chase:**

  | hypothesis | how it died |
  | --- | --- |
  | the untap move broke `roundAdvance` | 40 Basics games to round 37, **0 stuck** |
  | `pileClear` broken generally | **1366-1378 round boundaries, 0 stale piles** |
  | the hand-limit trim eats the Rival's pair | it plays as it draws — `8→7→9→7→9`, never reaches the cap of 10 |
  | clean-up skipped for a falsy `cleanupResult` | engine detector, **0 hits in 1366 boundaries** |
  | a falsy return breaking `settleWindows`' loop | `last` is initialised `{ok:true}` and never reassigned |

  **AND ONE THAT LOOKS DAMNING AND IS NOT.** `promptHumanResponse`'s default continuation is `resumeRival`,
  not `settleWindows`, and three call sites take that default — which reads exactly like the tutorial wedge
  CLAUDE.md records. All three sit INSIDE the rival driver's own loop, which re-checks `respondFor` each
  step, so the default is self-draining there. **Do not "fix" it without a failing case.**
  **THE DETECTOR IS LIVE — ASK FOR A SAVED LOG.** A round cannot legitimately begin with a pile on the
  table, so the round-begin path now writes **⚠ ROUND BEGAN WITH A STALE PILE** and **⚠ ROUND BANNER
  REPEATED** into the priority ledger, which rides in the downloaded battle log. The next occurrence will
  say which fired and at which round. ⚠ **It has not been SEEN to fire**: four bespoke probes were written
  chasing this and all four were wrong, `prioNote`'s arity was checked by reading, and 12 duels plus the 2s
  lesson do not trip it — so a silent ledger is weak evidence, not absence.
  **AND THAT DETECTOR CANNOT SEE THE REPORTED FAILURE, WHICH IS WHY A SECOND ONE SHIPPED 2026-09-17.** It
  fires at the ROUND BANNER, so it can only speak when a round BEGINS — and if the boundary never
  completes, no banner is drawn and it has nothing to fire on. "Nothing happened" and "the code never ran"
  are the same absence, which is the rule this repo wrote down for `prioNote` and then rebuilt the hole
  under. Aj named it: *"it all waits on me because you never seem to encounter the pile not clearing."*
  **READ `--- ROUND BOUNDARY ---` IN THE SAVED LOG FIRST.** `bnote` (engine.js) records the boundary
  itself, every time, including the quiet ones. A healthy boundary is
  `CLEANUP enter → initiative → pileClear → expire → temps → exit` then
  `BEGIN enter → roundAdvance → equipReset → stampRound → exit`, each line carrying `pile=`, `turn=` and
  `stack=`. **A SHORT BLOCK IS THE FINDING** — the missing tail names the step it stopped on — and the
  engine reads its own trace for the one case it can judge, writing **⚠ CLEANUP LEFT A PILE** when a pile
  survives `pileClear`.
  It is a module-level ring with a pickup accessor (`E.boundaryTrace()`), NOT on `st`, so it never travels
  in a mirror. Instrument verified by mutation — removing `st.pile = null` from `pileClear` fires 50
  warnings in one game — and `logtest` asserts the section reaches the downloaded file with real rows,
  which is the half that can silently not work (`downloadLog` reads it inside a `try{}catch{}`).
  **AND THE PILOT IS DOWNSTREAM OF ALL OF IT.** With a stale pile present, `tutPilotTwos` sees `cur` set
  where the script expects null, matches no branch (`size===2` but `cards[0].rank` is 2, not the Ace it
  tests for) and passes. **Fixing the pilot to cope would paper over the boundary failure** — which is why
  it was not done when the fix was asked for.
  **THE ENGINE IS EXONERATED, MEASURED — do not re-chase it.** The untap queue had just moved `roundAdvance`
  and was the obvious suspect: **40 solo Basics games, deepest round 37, ZERO stuck rounds**, and **1378
  round boundaries with ZERO stale piles**. `browsertest` independently reached round 28. `pileClear` and
  `roundAdvance` both work; this is the lesson pilot.
  **⚠ AN EARLIER VERSION OF THIS ENTRY BLAMED TURN ORDER AND WAS WRONG.** I read the pile as the Rival
  ANSWERING in-round, and concluded the step assumed the Rival leads. Aj: *"nope, they didn't play anything.
  that was the play from the previous round."* The distinction matters — "the Rival followed with a pair"
  is a script-expectation bug, "the Rival played nothing and the board never cleared" is a stall. **Read a
  stale pile as evidence that a turn never happened, not as evidence of what was played.**
  **`lessontest_twos` IS 29/0 GREEN THROUGH ALL OF IT**, because it plays what each step spotlights and so
  never reaches a hand the pilot cannot lead from. The suite needs a deal where the Rival's non-2 pair is
  absent. Third suite-versus-reality gap found by playing the tutorials today.
  `[id: twos-lesson-pilot-leads-nothing]`

- `root cause found`    · **THE ROUND-BOUNDARY DETECTOR FIRED, AND IT DISPROVES ITS OWN MESSAGE — THE
  CEREMONY RE-RAN, THE BOUNDARY DID NOT FAIL (Aj's 3-player log, 2026-09-24).** The 2026-09-17 detector was
  built precisely because this would not reproduce — five hypotheses measured and killed, with the note
  *"the next occurrence has to explain itself instead."* This is that occurrence, and it does.
  **WHAT THE SAVED LOG CARRIES:**
  ```
  r7  ⚠ ROUND BEGAN WITH A STALE PILE — the clean-up boundary did not complete  round 7 · pile pair · turn 1
  r7  ⚠ ROUND BANNER REPEATED — the round did not advance  round 7 announced twice
  ```
  and in the battle log, *"Round 7 begins. Each player draws 3."* appears **twice** — the second time
  immediately after *"Vyers won with a Pair — You lost a shield"*, which is the play that ENDED round 7.
  There is no "Round 8 begins" line at all.
  **✅ BOTH OF THIS ENTRY'S ACTION ITEMS SHIPPED 2026-09-24 — what is left is the CAUSE, not the work.**
  The wording was corrected (`⚠ ROUND BANNER FIRED WITH A PILE STILL ON THE TABLE`, which states the
  observation instead of a hypothesis), and BOTH re-entry guards are in: `⚠ CLEAN-UP CONTINUATION FIRED
  TWICE — blocked` on the queue's `done()`, and `⚠ ROUND CEREMONY RE-ENTERED for a result it already
  played` via `res.__ceremonyRan`. So a recurrence is now BLOCKED and names the stale caller — the round
  the closure was queued for against the round the board is on. **Nobody has found what makes the ceremony
  re-enter**; the guards buy the next occurrence explaining itself, which is what the 2026-09-17 detector
  bought for the boundary. Leave the entry open for the cause and do not redo the guards.
  **THE DETECTOR'S OWN WORDING WAS WRONG AND HAS BEEN CORRECTED.** The ROUND BOUNDARY trace shows r7's
  clean-up completing in full — `CLEANUP enter → initiative → pileClear → expire → temps → exit` — then
  `r8 BEGIN · roundAdvance`. The boundary did complete. `⚠ CLEANUP LEFT A PILE` never fired either.
  **AND THE ENGINE IS NOT DOUBLE-RESOLVING:** `⚠ DOUBLE RESOLUTION BLOCKED` has **zero** occurrences in the
  file, and `roundAdvance` appears exactly once per round. The engine resolved once and advanced once.
  **SO IT IS THE UI CEREMONY RE-ENTERING WITH A STALE `res`.** `logRoundDraw` has ONE call site, inside the
  nested `playPreBeats → flushThreshold → endOfRoundTrimThen` chain, immediately after
  `E.roundDraw(state, res)`. Its round number is `res.newRound || state.round`. The detector pins the
  second banner to `turn 1` + `pile pair`, which is byte-for-byte `r7 CLEANUP enter` in the trace — i.e.
  BEFORE `pileClear`, `initiative` and `roundAdvance`. At that instant `state.round` is still 7 and the
  pile is still up, which is both warnings at once.
  **WHERE TO LOOK:** that callback chain is guarded by `g!==gen` at every level, so a second entry means
  either a second ceremony was started for one resolution or one closure was invoked twice. The `gen`
  guard cannot see a re-entry within the same generation. Start by counting entries to
  `resolveRoundCeremony` per resolved round — the engine side is already exonerated, so the instrument
  belongs on the UI side.
  **DO NOT RE-KILL THE FIVE DEAD HYPOTHESES.** The comment above the detector lists them (the untap move,
  `pileClear` generally, the hand-limit trim, a falsy `cleanupResult`, a falsy return breaking
  `settleWindows`); the trace now independently rules the whole clean-up path out as well.
  `[id: round-ceremony-reruns-with-stale-res]`

- `needs a decision`    · **THE FIGHTER KICK FLASH DOES NOT FIRE ON A KILL, ONLY AT THE END OF THE GAME
  (Aj, 2026-09-24: *"a fighter kick should flash for each kill... but maybe we can upgrade the final
  fighter kick animations"*, and *"the kick flash can actually be after the epic"*).**
  **`playFinisher` HAS EXACTLY ONE CALLER — `endGame`.** `announceRoundWin` sets `pendingKick=true` on any
  `res.kick`, which at 3-6 players is EVERY elimination (CLAUDE.md: *"`kick` IS NOT `finished`"*), and the
  flag is consumed only when the game ends. So a kill that does not end the game gets the wording — the
  board message and the log line — and no flash at all.
  **AND THE DEFERRAL IS A SECOND, LIVE BUG.** Nothing clears `pendingKick` between the kill and the end
  (`clearBoard`/`startGame` are the only resets, and both are new-game paths), so a free-for-all that ends
  by DECK-OUT or CONCEDE after an earlier elimination still plays the full FIGHTER KICK flourish, credited
  to an event several rounds earlier. Fixing the first half removes this one by construction: once the
  flash fires at the kill, the flag stops being a queue.
  **THE WIN/LOSE WORDING IS WRONG MID-GAME.** `playFinisher` writes `YOU WIN` / `YOU LOSE` under the words
  and colours the flash `win`/`lose` — true for the game-ender, false for a kill that leaves two players
  standing. A mid-game flash wants the VICTIM named instead.
  **SHAPE OF THE BUILD:** parametrise into `playKick({final, youWin, sub}, done)` with `playFinisher` as a
  thin wrapper, so the two occasions cannot drift; fire it from the kick branch when `!state.finished`,
  and set `pendingKick` only when `finished` so the ender still lands with the end screen. A shorter hold
  for the mid-game one (~1.0s against 1.65s) so a live game is not stalled.
  **WHY `needs a decision` AND NOT `ready to build`:** the correctness half above is decided, but *"upgrade
  the final fighter kick animations"* is a visual call nothing can judge from a test — how much bigger,
  longer, louder. Build the correctness half, screenshot both states, and let Aj size the finale from the
  picture. That sequencing is the one this repo learned the expensive way on the notification toggle: a
  measurement says a control is clean, only the person says it reads right.
  `[id: kick-flash-only-at-game-end]`

- `ready to build`      · **THE STRAIGHTS SORT BUILDS THE LOWEST STRAIGHT, NOT THE BEST ONE (Aj,
  2026-09-24: *"i think it should sort by the higher straight"*).** `sortIntoStraights` walks the distinct
  values ASCENDING and claims the first five-in-a-row it finds, so with two overlapping runs available it
  always takes the lower and spends a card the better one needed.
  **REPRODUCED ON HIS HAND, not reasoned:** `4♦ · 6♠7♠8♠9♠ · 10♦10♠10♠ · J♠ · 2♦2♠` sorts to a
  **6-7-8-9-10** with the **J♠ left as a single** — while **7-8-9-10-J** was available and is strictly
  higher. The 6 becomes the spare instead of being spent, which is the whole of the fix: same five slots,
  a better play.
  **WHY IT MATTERS MORE THAN IT LOOKS:** `beats()` compares within a type and size, so a straight is only
  as good as its top card. The sort exists to show you your best plays, and here it actively hides one.
  **THE FIX IS THE LOOP DIRECTION** — take the HIGHEST run first, then repeat on what is left — but check
  two things before calling it done:
  - **the 2.** `fv` ranks the apex at 15 and `seqTwos` (`off` / `low` / `high`) decides whether it chains
    at all and at which end, so "highest run" is rule-dependent and the greedy walk must read the live
    rule rather than the raw value. `sortIntoPairs` has no equivalent hazard; this one does.
  - **greedy is not always optimal.** Taking the highest run first can leave a worse remainder than taking
    a lower one would — with 5-6-7-8-9-10 a single run either way, but overlapping runs plus pairs can
    diverge. Aj's rule is the simple one and is what to build; if a hand is found where it loses, that is
    a second entry, not a reason to delay this.
  **AFTER THE EPIC** (Aj, same message: *"the sorting can wait until after the epic tho"*).
  `[id: straight-sort-picks-the-lowest]`

*Defects in the shipped game. Each was verified present on `main` by grepping the symbols its entry
names — `pitchHigh`, `send`/`_effUsed`/`startShields`, `formsOpen` — rather than assumed, after four
of six entries in the priority cluster turned out to have been closed by the epic without anyone
noticing (2026-09-17). Check the same way before picking one up: an epic step closes entries it
never read.*


- `needs a decision`    · **AN ANSWERED QUICK HAS NO ANIMATION** (Aj, 2026-09-18, from a side-by-side of both seats:
  *"there still are no animations for the answered quicks… maybe it's because we use modals instead of
  prompt the user's hand"*). Filed for `main`. Both logs agreed — *"answered at instant speed with
  Annoint"* on both screens — so this is presentation, not a sync fault.
  **HIS DIAGNOSIS IS THE SAME ONE ALREADY FILED AS A REDESIGN.** A cast made from a MODAL has no card in
  the hand to fly from: `buildOppBeats` pairs `revealEffect` with `revealDwell` for a card played from a
  zone the viewer can see, and a Quick chosen off a button in an overlay never passes through that path.
  That is exactly the premise of **[id: priority-modal-redesign]** — *"instead of having a modal for each
  card… can we just pause the game and highlight the castable quicks?"* — which is postponed until the
  epic is done and which this strengthens: the modal is not only a second presentation of a hand you are
  already looking at, it is the reason the play it produces cannot be animated.
  **SO IT MAY NOT WANT ITS OWN FIX.** Decide it WITH the redesign: pausing and highlighting the hand puts
  the card back on the board, and the existing reveal beats then apply for free. Bolting an animation onto
  the modal path would be a third presentation to keep in step — the mistake CLAUDE.md records about
  inventing a layout rather than restoring the one the compact form was compacted FROM.
  `[id: answered-quick-no-animation]`

- `ready to build`      · **THE DECK BUILDER'S CANCEL IS A LIVE BUTTON THAT CAN ONLY FLICKER.**
  `tutOpenDeckBuilder`'s continuation re-opens the modal 120ms later whenever `TUT.isActive()`,
  deliberately — its comment says *"on a cancel it would otherwise strand the step"*. So pressing Cancel
  during the Custom Decks lesson closes the builder and then watches it come straight back.
  **THIS IS THE RESIDUE OF `tut-panel-buried-by-modal`, WHICH IS CLOSED (2026-09-25).** That entry was a
  TRAP — two exits shut at once, so the lesson could only be finished or reloaded. `Skip ✕` is reachable
  now (`--zTut`, hit-tested in `lessontest`), so the lesson can be left and nobody is stuck. What is left
  is a manners bug, not a trap, which is why it is its own entry rather than a reopened one.
  **THE REMEDY IS THIS REPO'S OWN DOCUMENTED PATTERN** and not a new idea: an action that cannot satisfy
  a gated step should be DISABLED with a visible note, never silently undone — exactly what was done for
  "Let it resolve" in the Quicks lesson. Disable Cancel while the step needs the builder, say why, and
  delete the re-open.
  `[id: decks-cancel-flickers]`

- `ready to build`      · **A CLIENT IS NEVER TOLD ITS OWN DRAW FIZZLED** (found 2026-09-18 by the `logMsg` audit Aj
  asked for after *"i didn't see round 1 jabs only for the client"*). Filed for `main`.
  **TWO ADJACENT LINES IN ONE FUNCTION, ONE PUBLIC AND ONE NOT** — `logRoundDraw`:
  `say(null, 'Round N begins. Each player draws X.')` then
  `if(res.draws[YOU]===0) logMsg('Draw fizzled — your deck & shuffle pile are empty. Spend energy on effects
  to recycle cards back into your deck.')`. The first reaches every seat; the second is host-local.
  **AND IT IS WORSE THAN A MISSING BROADCAST, because `logRoundDraw` runs on the HOST and in SOLO only** —
  `resolveRoundCeremony` is its only caller and a client replays through `clientPlayCeremony` instead. So
  the line does not merely fail to travel: a client whose deck AND shuffle pile are both empty is never
  told, in any game, and never gets the advice about recycling. That is a losing condition with actionable
  guidance attached, which makes it the most consequential of the 24 sites audited.
  **THE FIX NEEDS A COPY DECISION, WHICH IS WHY THIS IS FILED RATHER THAN DONE.** A deck-out is public (the
  🂠 count is on screen for everyone), so a neutral past-tense `say` per fizzling seat would inform the
  table — but the second half of the sentence is ADVICE and only useful to the seat it names. The existing
  comment already credits the wording to Aj (*"One neutral line for everyone (Aj's wording)"*), so the
  split between what is broadcast and what stays local is his call, not a refactor.
  `[id: client-never-told-draw-fizzled]`

- `ready to build`      · **★ THE BROADWAY PITCH CHOOSES ITSELF, FOR BOTH SIDES** (Aj, 2026-09-07, from real play: *"oh no it did not
  let me pick which broadway card.... this is a bug for sure.. and probably more of a problem in multiplayer
  clients"*, then *"the ai should absolutely smart pitch as well... especially for the ones who are smarter"*).
  `pitchHigh` (Critical Hit / Ultima Attack / Armor Piercing) discards a 10/J/Q/K/A as an additional cost, and
  the ENGINE picks it — the **lowest** Broadway card, with no say from anybody. Aj cast Critical Hit and it
  silently pitched his 10♣.
  **THIS IS NOT THE `opts.pitch` DECISION CLAUDE.md ALREADY RECORDS, and the difference is the whole entry.**
  That removal was about the AI naming its own pitch and the reasoning was *"the engine's default already takes
  the lowest card, so no test could separate them, and ours could pitch a higher one"* — i.e. an ARBITRARY choice
  that measured no better than the default, correctly deleted as unexercised code. Neither half below is
  arbitrary, and both are separable by a test that stages the lowest Broadway card as load-bearing (in a straight)
  and a higher one as spare, then asserts WHICH card left.
  - **The human picker.** Keeping a 10 for a straight and pitching the Ace is a real decision and the player
    never gets it. Route it through **`discardPending`** — the existing, documented window for an interactive
    discard, which already works on a remote seat, which is what Aj means about multiplayer clients. Note
    `discardPending` has exactly two sites today (CLAUDE.md); this would be a third.
  - **The AI's smart pitch, tier-gated.** Same shape as **`keepsTheWin`**, and it can reuse its method directly:
    `legalFightPlays` on a hypothetical hand answers "is this Broadway card load-bearing?" — which is precisely
    what the lowest-card default cannot see. Gate on `isTop(diff)` the way the Demon Lord's `keepsTheWin` is, so
    it reads as a tier behaviour rather than a global strength bump; `personasim`/`analysis` measure the tier
    step if it moves at all.
  **THE ENGINE HOOK IS STILL THERE — corrected 2026-09-23, this entry used to say it needed putting BACK.**
  `opts.pitch` is live at `engine.js` ~1274 (`if (opts.pitch) pitchCard = pitchCands.filter(...)`), with a
  fallback to the lowest when the named card is not a legal pitch. What was deleted was the AI's CALLER, not
  the hook — `ai.js` ~591 says so in as many words. So neither option needs an engine change: the human
  picker needs a UI that passes a card id, the smart pitch needs `chooseMove` to pass one, and each of them
  is the exercise the hook has lacked since the caller went.
  **Re-confirmed against the code the same day** (Aj hit it again, this time losing a 10 out of a full house):
  the engine still auto-takes the lowest Broadway card and nothing in the UI names one.
  `[id: broadway-pitch-chooses-itself]`

- `root cause found`    · **★ THE MIRROR-CONTRACT AUDIT'S THREE UNFIXED FINDINGS.** v1.31.114/.115 took the two live bugs and
  v1.31.116 the park heartbeat; these are what the judge left standing. Each is a mirror or transport fault, so
  each is silent on BroadcastChannel and only bites over RTC or at 3–6 players — the same shape as both bugs
  that did ship.
  - **`send()` stringifies OUTSIDE its `try` (template `:7177`).** So a body that will not serialise throws out
    of `send` rather than being caught, and the caller dies with it. The caller that matters is `endGame`: a
    fault there aborts the end screen for everyone. Move the `JSON.stringify` inside, and trace the failure the
    way `broadcastMirror` now does — the loud-failure half of v1.31.115, applied to the other sender.
  - **A ROTATION-DIFFERENTIAL TEST.** Every mirror bug found so far was a field that was copied when it should
    have been projected, or projected when it should have been rotated, and `netview.test.js` can only assert
    the fields someone thought to name. The test that generalises: build `mirrorFor(st, s)` for **every** seat
    of one non-trivial state and require every seat-valued field to differ by exactly the rotation — a field
    that is identical across seats is either public or a bug, and the list of public ones is short and
    reviewable. That inverts the burden from "did we remember this key" to "why is this key not rotating".
  - **THREE FIELDS ARE MISSING FROM THE MIRROR ENTIRELY**, and the third is user-visible at every table of 3+:
    `_effUsed` (so a client cannot tell whether the first-effect discount is still available), `startShields`
    (so a client cannot render the shield track against its start), and **`struck`/`spared` on the round
    result** — without which a client cannot name who lost a shield and falls back to *"a rival lost a
    shield"*. That last one is the v1.29.6 lesson (never infer the loser — read `result.struck`) reappearing
    as a redaction gap rather than a UI one.
  `[id: mirror-contract-findings]`

- `root cause found`  · **THE AI's PHANTASMAL ILLUSION NARRATES AS "a Special undefined overtakes the pile"**
  (Bibong's export, a solo game vs Rozalin on 2026-09-10; see `PLAYER-PROFILE.md` → Bibong). Two fields, one
  event: `takeTurn` in `ai.js` logs the illusion as `{ phantasm: rp.made, value: rp.value }` — the SHAPE rides
  in `phantasm` — and `buildOppBeats` renders it with `kindLabel(e.made)`, a field that event never carries,
  so `TYPE[undefined]` prints the word. The engine-driven sites (the human's own cast, the N-player host path)
  read the engine result's `made` directly and are fine; only the AI-beat path is wrong. One-line fix either
  side; read `e.phantasm` rather than adding a second field. `phantasmtest` drives the human's three routes and
  never the AI's cast — the assertion this needs is that the AI's narrated line names a shape, which is the
  `oppbeatstest` shape rather than a new suite.
  `[id: phantasm-beat-reads-wrong-field]`

- `ready to build`     · **THE PLAYTEST EXPORT CARRIES NO BUILD VERSION.** `recordGame` stamps the SCHEMA
  (`v:'2.1-mp'`) and nothing else, while `GAME_VERSION` sits in the same file. Bibong's nine games span at least
  three builds — 08-29, 09-10, 09-14 — and nothing in the record can say which, so the profile's `Ver` column
  reads `?` nine times and a narration bug seen in one game cannot be told from a fixed one. Add
  `build: GAME_VERSION` to the record; `exporttest` asserts the field is present and equals the README stamp
  (the way `versiontest` already checks the two screens). The netplay handshake carries the build for exactly
  this reason (v1.31.21); the export is the other artefact people send and it does not.
  `[id: export-lacks-build-version]`

- `ready to build`     · **THE HOST NARRATES A CLIENT'S ACTIVATION IN SHORT FORM.** `hostApplyMove`'s activate
  branch says `'{who} played '+aeff.name+'.'`, while the host's own casts and every AI cast go through
  `effPhrase(card)` — type, card and text. Same event, two grammars; in Bibong's 08-29 netplay log the host
  reads *"You played an Equipment - 8♦ Cursed Pendant — Equipment — lasts 4 rounds …"* for itself and *"Aj
  played Giant Ram."* for its opponent. Cosmetic, and it is the kind of asymmetry Aj has flagged before (*"the
  client and host seem to have different UI/UX experiences"*). Route the line through `effPhrase`, and check
  `hostApplyMoveN` for the same short form before calling it done — the two handler families are where a fix
  lands in one and not the other. `nettest_narrate` is where the assertion belongs.
  `[id: client-activation-line-short-form]`
- `needs a decision`   · **THE CLIENT'S CEREMONY IS A SECOND IMPLEMENTATION, AND THAT IS CAUSE 2 OF THE
  HOST/CLIENT DRIFT** (Aj, 2026-09-29: *"why do we keep getting this unsync between host and client?"*).
  The drift has three causes and only one of them could be gated. Cause 1 — `startGame` is the client's
  missing constructor — is closed: `versiontest` now derives both sets from source and fails on the
  difference, and nine more names were moved into `resetBoardMemory` on the way. Cause 3 — narration
  defaulting to `logMsg` instead of `say` — already has the static scan in `nettest_narrate`, with its two
  known gaps filed. **This entry is cause 2, the one a gate cannot reach.**
  **`resolveRoundCeremony` (host/solo) and `clientPlayCeremony` (client) are two hand-written
  presentations of one event**, so anything added to the host's ceremony is invisible on a client until a
  human plays that seat. Known instances: `uiPhase` (the Resolution and Clean-up tints, fixed 2026-09-29 by
  copying the host's marks and its 420ms dwell); `buildOppBeats` before it was extracted, where **every**
  readability feature was missing from the free-for-all driver; and `tutCastRivalTech`, which lost the
  reveal pairing the real drivers have. Three instances, one shape.
  **THE DECISION IS WHETHER TO COLLAPSE THE FORK**, and it is genuinely a decision rather than a cleanup,
  because the two are not the same function wearing different hats: the client has no trim to run, no draw
  to make and no engine to consult — its ceremony is a REPLAY of an outcome the host already computed. A
  shared driver would need a "who owns the work" flag threaded through every beat, and the failure mode of
  getting that wrong is worse than the drift (a client running engine work is the v1.31.56 class).
  **THE CHEAP HALF, IF THE ANSWER IS NO:** make the host's ceremony emit its phase marks and beat
  boundaries through ONE named helper that both paths call, so the next addition has an obvious place to
  go even while the drivers stay separate. That is what `buildOppBeats` did for the opponent beats, and it
  is why that particular drift stopped.
  **WHAT WOULD MEASURE IT:** nothing today compares what the two seats RENDER — `nettest_sync` compares
  state, and state is not the thing that drifts here. A parity probe that samples both strips and both log
  line-counts through one game is the instrument this cause has never had.
  `[id: client-ceremony-is-a-second-impl]`


- `root cause found`    · **★ EXPANDING A ZONE PUSHES THE BOARD PAST ITS HEIGHT ON THE TIGHTEST PHONES** (measured 2026-09-07)
  **✅ THE UNSTABLE NUMBER IS FIXED (2026-10-01) — the overflow itself is what is still open.** This entry
  used to carry *"30px, THEN 60px, THEN 63px ACROSS THREE SWEEPS OF ONE BUILD"* and the instruction *"pin
  the inputs FIRST, then size the cap, then tighten the ratchet"*. That is done: `open()` now pins BOTH
  decks, the reading is **60px on four consecutive runs**, and the cap is tightened 63 → **60** so the
  ratchet can catch a 1px growth. What remains is the real defect — expanding a zone still pushes the
  board 60px past its height at 327x660.
  **⚠ THE ENTRY NAMED TWO CULPRITS AND THE REAL ONE WAS A THIRD.** It blamed the RANDOM PERSONA and the
  DEAL — both already pinned — and the mover was the **deck name**: `DEFAULT_SEL` is
  `{you:'random', rival:'random'}` and at 327px a long name WRAPS `#handMeta` onto a second line, which is
  the whole overflow. A/B'd by pinning the two extremes: `Mage Knight (Wiz+Fig)` → **60px**,
  `Pure Rogue` → **33px**, which are exactly the values the sweeps had been printing. **An entry's guess
  at what is moving is a hypothesis like any other** — the same lesson as `runopponents-window`, where the
  filed mechanism was also wrong while the symptom was right.
  **AND PINNING THE *SHORT* NAME WOULD HAVE SILENTLY LOOSENED THE RATCHET** — 33px passes both the old cap
  and the `over>0` floor, so the suite would have gone quiet-and-green while guarding nothing. Pin the
  worst case, which is the longest name the picker ships.
  `[ratchet: phone-zone-expand-overflow]`
  v1.31.111 made both panel zones expandable; at **327x660 opening a seat's Forms and equipment adds 75px to
  that panel and pushes `#board` 63px past its height** (393x852 goes 10px over; 360x800, 390x780 and 412x915
  stay at 0). Above the 340px floor the stated contract is everything-on-one-screen, so a board that scrolls
  because a user opened an inspector is a contract break, not a nicety.
  **It also makes a measurement unstable, which is how it was found:** once the board overflows, where the
  pile sits relative to the other panel depends on the scroll, so `landscapetest`'s coverage read 0% on ten
  consecutive standalone runs and 33% on about one suite run in five — reported as `youFormZone over card2`.
  The suite now asserts the OVERFLOW instead, which is deterministic, and ratchets it at both sizes; the
  coverage line is deliberately not asserted there until this is fixed.
  **Do not reach for smaller mini-cards** — the arithmetic says the growth is 33px (Forms) + 42px (equipment)
  against 63px of overflow, so trimming card size cannot close it. The candidates are a zone that expands as an
  OVERLAY instead of a layout change, or expanding one zone at a time at these sizes only — and note Aj
  explicitly asked for both zones open at once, so the second needs his say-so.
  `[id: expanding-zone-pushes-board]`

### Tooling

- `ready to build`      · **SUITE COUNTS ARE DECLARED TWICE IN CLAUDE.md AND NOTHING CHECKS EITHER — 27 WERE STALE
  (2026-09-30).** `versiontest` asserts `test` and `netview` only. The verified list had drifted in 3
  places and **the COMMAND LIST in 24**, some wildly: `rulestest` said 36 against a real 150,
  `landscapetest` 96 against 195, `peektest` 31 against 43, `resolutiontest_ui` 46 against 71. All 27 are
  corrected; the DEFECT is that a second hand-maintained copy exists at all, which this repo's own rule
  forbids — a measurement lives in one place, and any second copy must be ASSERTED rather than written.
  **THE FIX IS SMALL AND FOLLOWS AN EXISTING PATTERN:** `sweep.js` already writes `.sweep-times.json`, so
  have it record each suite's `PASS:` count in the same file, and have `docsweep.js` report declared-vs-
  actual. **Report, never gate** — a suite legitimately changes count in the same commit that changes the
  doc, and a gate would fire on the way past.
  **THE COMMAND LIST IS THE ONE THAT MATTERS**, because it is what a session reads first to decide what to
  run — and it was the one nobody was updating. Note a scan that reads only the first line of each `node
  x.js` entry misses five, since several carry the count on a continuation line.
  `[id: suite-counts-declared-twice]`

- `needs a decision`    · **`exporttest` IS TIME-CAPPING IN THE SWEEP — GREEN, BUT TESTING LESS THAN IT
  MEANS TO (2026-09-24).** Surfaced by the sweep's new warnings section, which prints a passing suite's own
  `⚠` lines: *"driver stopped on the 90s WALL CLOCK — the board stopped advancing"*, **twice in one run**,
  ending `PASS: 17  FAIL: 0  (TIME-CAPPED)`. It only showed on the slower of the day's sweeps (295s against
  ~230s), which is exactly when a wall-clock budget bites.
  **✅ CONFIRMED LOAD-DEPENDENT — SECOND DATA POINT 2026-09-25.** The next morning's sweep ran **221s and
  `exporttest` did NOT cap**, against the 295s run where it capped TWICE. Same commit, same suite, same 90s
  budget; the only thing that moved was the machine. So *"does this suite always test short?"* is answered —
  it does not — and what is left is a JUDGEMENT rather than a measurement: **is a suite that silently tests
  less on a slow machine acceptable?**
  **221s clean against 295s capped puts the knee between the two**, so the margin is thin rather than
  absent, and a machine slower than this one would cap every run.
  **THIS IS THE `nettest_sync` SHAPE, ALREADY DOCUMENTED IN CLAUDE.md** — *"a wall-clock-bounded suite tests
  less when the sweep is parallel, and stays green while doing it"* — so the suite is reporting correctly
  and the question is whether 90s is still the right number. **Measure before raising it**, and ask what the
  driver is waiting FOR first: a wait on work stretches under load, a wait on a timer does not, and this
  repo spent a day getting that backwards on `lessontest_quicks`.
  **AND CHECK THE SECOND MESSAGE**: *"the board stopped advancing"* is not the same claim as "it ran out of
  time" — a driver that stops advancing may be parked on something, which would make the cap a symptom.
  `exporttest` already had the v1.31.85 unproductive-iteration fix for a related problem.
  `[id: exporttest-time-capped]`

- `needs a repro`       · **`lessontest_twos` DEAD-ENDS ON AN UNSCRIPTED CLEAN-UP PICK — CAUSE FOUND
  2026-09-24, TRIGGER STILL OPEN.** Filed three times as a poll-budget flake under `-j 4`
  (`PASS: 24  FAIL: 5`, opening on *"you beat it with your own full house — card 5C#t6 has no group
  (retried for 30000ms)"*, 112s in the sweep against 22s solo). **It was never the poll budget.**
  **THE MECHANISM, MEASURED.** `card <id> has no group` means the board is in PICK MODE: `renderHand`'s
  first branch renders bare cards into `#hand` with no `.group` wrapper and is the only writer that does.
  A pick never clears itself, so the retry burns its whole 30s against a board that cannot move. And **the
  lesson sits at 10 of 10 cards at that step — exactly the cap, zero headroom** — so one card left unspent
  by a slipped beat takes the hand to 11 and opens the clean-up trim. The full rule is in CLAUDE.md.
  **WHAT SHIPPED:** `lessonlib.pickMode()` names the state, `answerWindow()` escapes it loudly,
  `lessontest_twos` asserts the rig's own `[10/10]` promise, `nettest_trim` asserts the DOM contract, and
  `lessontest_pickescape` forces the condition so neither guard is untested code. The sweep also surfaces
  warnings from GREEN suites now, so the `⚠` escape line cannot pass unnoticed.
  **WHAT IS STILL OPEN — AND IT IS THE ONLY THING LEFT HERE: WHICH BEAT SLIPS.** Every earlier assertion in
  the suite passed on all three red runs, so the unspent card is not one an assertion covers. The next red
  run will print the hand size (`[11/10]`) and name the pick, which bounds the search to one round
  boundary; until then there is nothing to fix, only something to catch.
  **DO NOT RAISE A POLL BUDGET FOR THIS.** Three occurrences were read as contention because the suite was
  22s solo and 112s loaded; the 112s is the retry burning down, not the machine. The lane-count theory this
  entry used to carry is **withdrawn** — a stable wrong state for thirty seconds is a mode, not a race.
  **`lessontest_forms` (2026-09-24, *"the Q is spotlit for you to activate"*, 13/2, 3/3 solo) is a
  DIFFERENT signature** and is not explained by this; it needs its own repro rather than being folded in.
  `[id: lessontest-twos-poll-under-load]`

- `needs a repro`       · **A LESSON SUITE FAILED ITS COMPLETION ASSERTIONS ONCE, AND I LOST WHICH ONE** (2026-09-10, one `-j 4`
  sweep during epic step 14; not reproduced since). The two failures were `lessonlib`'s shared `finish()`:
  *the completion modal is actually on screen* and *…and the lesson is marked done*. **Everything before
  them passed**, so the lesson ran its steps and then did not reach the completion modal — which points at
  the LAST `next()` not landing, not at a mid-lesson stall. `finish()` polls for a VISIBLE modal, so a
  timeout fails both (the second because `localStorage` was never written).
  **`lessontest_quicks` WAS the first suite to look at, and it no longer exists** — its lesson was absorbed
  into "Phases and Quicks" on 2026-09-25 and the file was deleted, so the suspect this entry named is gone
  without the entry having been closed. Its ~25% rate under `-j 4` had a different signature anyway, and the
  cause is recorded in CLAUDE.md (a hand-rolled priority check that abandoned an open window); that is
  history now, not a lead. *(This read "see the entry above" and pointed at nothing — repaired 2026-09-29.)*
  **The suite name is unknown because I piped that sweep through `tail -4` and the summary line scrolled
  past** — `sweep.js` prints whole lines precisely so this evidence survives, and cropping it cost the
  identification. **Capture the full sweep log.**
  **Not reproduced:** an immediate re-sweep was **89/89**, and **33 runs of all eleven lesson suites
  eleven-at-a-time** (heavier than the sweep's four lanes) were clean. `lessontest_quicks` was the prime
  suspect — step 14 changed the modal it drives — and passed 21/0 both alone and in the green sweep. (That
  suite has since been deleted; the sentence is kept as the record of what was ruled out, not as a lead.)
  **Do not file this as a flake and do not raise a poll budget on it.** This repo's record is that an
  intermittent has been a real dependency every single time. The cheap next move is the one the
  `lessontest_twos` entry above already argues for: make the last step self-diagnosing — have `next()` say
  when it did not click, and have `finish()` print the step it was on when the modal failed to appear. One
  red run would then name both the suite and the step.
  `[id: lesson-suite-lost-name]`

- `needs a repro`       · **`lessontest_twos` FAILED ONCE UNDER LOAD, AND THE SIGNATURE POINTS AT THE PREP, NOT THE POLL** (seen once
  in a `-j 4` sweep, 2026-09-07; 3/3 solo and 86/86 on an immediate re-sweep, so it is rare). Do not file this
  as "flaky" and re-tune a budget — this repo's record is that an intermittent has been a REAL dependency every
  single time, and the captured hint names one:
  `Fight is disabled — hint: Special Full House — doesn't beat the Special Pair.`
  **The pile was a PAIR when the lesson had just claimed the Rival led `222` + a pair.** So the failing thing is
  the PREP playing for the Rival, not the assertion waiting on it: a full house went in and a pair came out,
  which is the shape of a partially-landed play — the documented `busy`-swallows-a-click class that
  `lessonlib`'s helpers retry for and that has already presented as a product bug three times.
  **The cheap first move is to make the prep self-diagnosing** rather than to raise the 30s poll (it timed out
  at its full budget, so the budget is not the constraint): have the Rival-leads step assert WHAT it led and say
  so, the way `why()` prints the refusal state. A prep that reports what it actually did would have named this
  in one run.
  `[id: lessontest-twos-prep]`

- `needs a repro`       · **`lessontest_forms` blew a THIRTY-SECOND poll once under `-j 4` — and 30s is not slowness, it is a dead end**
  (2026-09-07). `⏱ poll TIMED OUT after 30000ms: the Q is spotlit`, in a sweep. **Not reproducible on demand
  and not attributable:** 3/3 alone, **4/4 in parallel on that build AND 4/4 in parallel on `main`**, and the
  change it appeared under does not touch the lesson path (lessons launch by clicking a `.lessonRow`; the dice
  live in the setup dialog's roll).
  **Why 30s matters.** v1.31.84 raised all six lesson polls 9s → 30s precisely to end this class, and the note
  there says a poll budget is a HANG GUARD, not a race — it returns the instant the condition holds. Blowing the
  whole 30s therefore means the condition never became true, not that the machine was slow. The rig is not the
  suspect either: CLAUDE.md measured `tutRigForms` placing a Q **8/8**, with a fallback whose failure needs all
  four jacks behind shields (1 in 270,725).
  **THE ONE THING THAT WOULD SETTLE IT COSTS NOTHING, and should be added before hunting:** on timeout, print
  `step()` — it already returns the step number, its text and `spots`. That separates the two live hypotheses,
  which need completely different fixes: **the lesson never reached that step** (an earlier gate silently failed
  to advance) versus **it is on the right step and the `.tut-spot` selector matched nothing** (a rig or
  spotlight-selector problem). Right now a red run cannot tell you which, which is the whole reason this entry
  exists rather than a fix. Make the suite self-diagnosing; do not write a bespoke probe.
  **IT RECURRED 2026-09-17, AND A HUMAN SIGHTING IN A DIFFERENT LESSON IS NOW THE BETTER LEAD.** One full
  sweep went 92/93 on this suite — both spotlight assertions, *"the Q is spotlit"* and *"…and the spotlit
  card really is the Q"*. The SAME MORNING, Aj hit the same symptom by hand in **How to Play step 8**:
  *"lots of un greyed cards here and no cards are glowing"* — a step that GATES on activating, telling the
  player to select a glowing card that is not there. Two different lessons, one mechanism (`tut-spot` never
  applied), and one of them reproducible by a person rather than 1-in-many in a sweep.
  **CHASE THE HUMAN ONE.** `lessontest_howto` asserts a card is spotlit at step 8 and is GREEN, so the suite
  and the real game disagree — which is worth more than another rate measurement. Start at `tutPickEffect`
  → `tutEnsureEffect` → `tutEffId`: it returns null when nothing passes `tutEffOK`, and `render()` wipes
  `.tut-spot` every paint (`reapply` re-adds it), so either half failing looks identical on screen.
  **A/B'd AND IT PROVED NOTHING, which is worth recording so nobody repeats it.** `clickFight` gained a
  verification step in #251 and `lessonlib` calls it, so it was a fair suspect — but **12 runs per arm at 4
  concurrent reproduced ZERO failures in EITHER arm**. That neither implicates nor clears the change; it
  only re-measures how rare this is. Do not read 0-vs-0 as exoneration.
  `[id: lessontest-forms-poll]`

- `needs a repro`       · **`landscapetest`'s ↓ New log assertion is INTERMITTENT — 2 failures in 26 runs (2026-09-04), and it has a
  fixed wait in it.** Seen only while building v1.31.104: **0/6 on v1.31.103, 2/10 on an intermediate build,
  0/10 on the shipped one**, so it is rare and NOT attributable to the icon row. Deliberately left unfixed:
  there is no reproduction on the current build to verify a fix against, and changing a suite on a hunch is how
  the throwaway-probe entries in CLAUDE.md got written.
  **BOTH ASSERTIONS FAIL TOGETHER AND IT IS ONE CAUSE.** The recorded pair is
  `shown=false visible=false` and `scrollTop 24` — i.e. **the log auto-followed to the bottom**, so
  `logAtBottom()` was true and the ↓ New button correctly did not show. The bug is that the suite stopped
  "reading history", not that the button is broken. Do not chase `setLogNewBtn`.
  **The shape is the documented one, twice over** (`landscapetest.js` ~305): it takes a **deal-dependent action**
  (`if(f&&!f.disabled) f.click(); else if(ps&&!ps.disabled) ps.click()` — Fight and Pass emit different numbers
  of log lines, and a Fight that RESOLVES A ROUND emits a whole ceremony), and then it `wait(800)` before
  asserting. A round that resolves re-renders the log repeatedly inside that window. **Poll for the line and
  re-read `scrollTop` at the same instant**, rather than sleeping — the rule this file already carries.
  Note the staging injects fake `.le` divs straight into `#log` to create the overflow; confirm a re-render does
  not wipe them before assuming the scroll position is the whole story.
  `[id: landscapetest-newlog-flaky]`

### Features

- `ready to build`      · **THE SETUP DIALOG SHOULD BE THREE COLUMNS IN LANDSCAPE** (Aj, 2026-09-07, with a screenshot of New Duel):
  *"can we do this in 3 columns for landscape? player count, name, your deck; opponent strength and decks;
  buttons"*. It is one tall column of five label/control rows plus the roll strip, which is exactly the shape
  that does not fit a short viewport — `landscapetest` already has to assert the dialog *scrolls* to reach its
  last control at 568x320. His grouping is the natural one: your setup, their setup, actions.
  **Precedent to copy, not invent:** the Custom rules panel is the one dialog that already goes multi-column
  (`.modal` is shared by every dialog, so the width lives on a class on that panel alone, and `showModal`
  resets `#modal`'s class list so a wide dialog cannot leak into the next one). Do the same here rather than
  widening `.modal`. Note the rules panel's columns are keyed to WIDTH (1040px/1400px); this one wants short
  and wide, so the query is the landscape band, not a width breakpoint.
  `[id: setup-dialog-three-columns]`

- `needs a decision`    · **THE NARROWEST PHONES STILL HAVE 34px TOUCH TARGETS, AND THE ACTION ROW IS WHY (measured 2026-09-16,
  while fixing the rest).** Everything from 360px up now gets 44px-tall icon buttons and a widened 🔍/⚡
  channel; **at ≤340px nothing changed**, because the row cannot afford it on either axis — the `@media
  (max-width:480px)` block already records it as **2px over budget at 327px**, and `landscapetest`'s
  ratchet on the known expand overflow at 327×660 went **63px → 73px** the moment 44px targets were
  applied there. That ratchet is what caught it, on the first run.
  **SO THE LEVER IS NOT THE BUTTONS, IT IS `sortBtn`.** It is the widest item in the row by a distance
  (86-106px against 30-44px) because it keeps a WORD — the sort state it reports — while every other
  button collapsed to a glyph. The `max-width:480px` block already shaves its padding twice for exactly
  this reason. Freeing ~40px there is what would buy the floor phones the same targets.
  **DO NOT JUST COLLAPSE IT TO ⇅.** v1.31.104's note is explicit that Sort keeps words *because it is the
  state it reports*, and a glyph cannot say "Straights". A rotating one-word label, or moving Sort out of
  the action row entirely, are the two shapes worth costing — both are design calls, not tuning.
  `[id: narrowest-phones-still-34px]`

- `ready to build`      · **OPEN THE BATTLE LOG AS AN OVERLAY, like the 🔍 View card reader** (Aj, 2026-08-31: *"i think for the logs,
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
  `[id: open-battle-log-overlay]`

- `ready to build`      · **THE FAMILY-SHAPE PROGRAMME IS ESSENTIALLY COMPLETE. One cheap piece is left.** (Rewritten 2026-08-31: the
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
  `[id: family-shapes-last-piece]`

- `parked`              · **Rogue "slash": an on-demand card that LOWERS the current pile's value** (Aj, 2026-08-25 — filed for when
  Rogue needs a boost in balancing; nothing built). Distinct from Caltrops, which is a standing `oppDelta`
  debuff on opponents' cards. Aj's example: the pile is a boosted pair of 4s at effective 6 and you hold a pair
  of 5s; a "slash 2" drops the pile to 4 and your 5s become legal. **The engine already has the hook** —
  `st.pile.mod`, folded in by `refreshPile()`, and the value-modifier model it must obey is
  [`DECISIONS.md#value-modifiers`](DECISIONS.md#value-modifiers).
  **The measured support is settled: [`DECISIONS.md#value-stuck`](DECISIONS.md#value-stuck)** — read it there,
  including the correction to an earlier claim about Rogue. Do not re-derive it, and do not copy its numbers
  back here. **What is open is only the card:** cost, whether it is a Quick, and how much it slashes.
  `[id: rogue-slash-demand-card]`

- `parked`              · **A count-up "charge" CLASS** (Aj, 2026-08-25 — his current lean; nothing built). Full analysis in
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
  `[id: count-up-class]`

- `parked`              · **QR SCANNING IS BUILT, GREEN, AND PARKED on `feat/qr-scanning`** (PR #29, closed 2026-08-25, 21/0).
  **Why it is not merged:** scanning needs an origin that can be granted camera access, and a file opened from
  Android's Downloads is `content://` — an opaque origin — so Chrome rejects `getUserMedia` without ever
  prompting. **MEASURED AND SETTLED 2026-08-28:** the same file over **https is GRANTED** with a live preview.
  **What would revive it:** a decision to host the file. The blocker is no longer technical.
  Full reasoning, the origin experiment, and everything else considered for making joining easier are in
  [`DECISIONS.md`](DECISIONS.md#joining-discovery-and-the-qr-path).
  `[id: qr-scanning-built-green]`

- `needs a decision`    · **⏸ BOTH ★ ENTRIES BELOW ARE DEFERRED UNTIL AFTER THE EPIC MERGES** (Aj, 2026-09-30:
  *"those starred entries while fancy for the epic can actually be done after it's merged, so we can defer
  work on them until after the epic"*). **They moved here from the epic's Features section on that
  decision** — they are still wanted, and they are no longer the epic's business.
  **THE TAGS STAY `needs a decision`, because what he settled is WHEN and not WHAT.** The visualiser has no
  design yet, and the modal redesign is explicitly coupled to it (*"do the two together"*), so neither is
  `ready to build` however clearly the second one's shape is described. A tag is a claim about what the
  entry needs NEXT; "scheduled" is not "designed".
  ⚠ **AND STEP 23 USED TO SAY "strike both ★ entries … from the BACKLOG", WHICH WOULD HAVE DELETED THEM.**
  That instruction was written when they were expected to land inside the epic; it now reads as an order to
  bin live work at the one moment nobody is checking. Corrected in `FIGHT-END-PLAN.md` in the same commit —
  step 23 strikes the epic POINTER only.
  `[id: starred-entries-deferred]`

- `needs a decision`    · **★ A STACK VISUALISER, AND IT BELONGS WITH THE ENTRY BELOW** (Aj, 2026-09-11: *"not elegant but it works
  haha i think we need to overhaul this with a stack visualizer in the future"*). The priority window
  currently DESCRIBES the stack in prose on a button — *"counter Holy Bow (Adell)"* — when the stack is the
  one piece of state a player most needs to see laid out, and the epic makes it deeper than it has ever
  been (holding priority stacks several Quicks; §2's worked example runs six grants over two objects).
  **Same move as the entry below**: stop narrating the board in a modal when the board can be shown. Do the
  two together — a visualiser plus in-hand highlighting IS the replacement for the modal, and shipping one
  without the other leaves the prose half in place.
  `[id: stack-visualiser]`

- `needs a decision`    · **★ REPLACE THE PER-CARD PRIORITY MODAL WITH "PAUSE AND HIGHLIGHT THE CASTABLE QUICKS IN HAND"** (Aj,
  2026-09-10, and **explicitly postponed until the epic is done**: *"can we redesign? instead of having a
  modal for each card... can we just like pause the game and highlight the castable quicks? change of
  design i know so we could just postpone this to another feat when the epic is done"*).
  **WHY IT CAME UP:** the epic makes priority a real go-round at several timings, and the current window is
  a MODAL LISTING CARDS — a second, parallel presentation of a hand you are already looking at. He met it
  in a real game (`--- PRIORITY WINDOWS ---` in his saved log, rounds 6 and 7) and both prompts were
  useless: one offered Counter Spell against an empty stack, the other offered Leyline on a jab win with
  nothing at stake. The second is **legal and not a bug** — his words — but it is a modal you must read and
  dismiss to learn there was nothing to do.
  **THE SHAPE:** pause, light up the castable cards in the hand you already have, let the player tap one or
  pass. The engine side is already there — `E.canCastQuick` is the per-card predicate and the window's
  offer list is exactly the cards it admits, so this is a presentation change and not a rules one.
  **⚠ THE ORIGINAL BLOCKER HAS EXPIRED, AND WHAT HOLDS THIS NOW IS A SCHEDULING CALL, NOT A CONSTRAINT.**
  It said *"DO NOT START IT INSIDE THE EPIC"* because it touches `promptHumanResponse`,
  `promptHumanPreFight` and `promptHostPreFight`, *"all three of which epic step 20 is still rewriting"* —
  and **step 20 landed** (`9b8105a`, `3e8bed8`, `0a4fc38`, `3aa5c1e`, `4d1edd1`). The technical reason is
  gone; the deferral above is what holds it. Said apart on purpose: a filed constraint ages exactly as fast
  as the thing it constrained, and reading an expired one as live is how work parks itself indefinitely.
  The CARE it asked for still applies once started — landing a new presentation under freshly-rewritten
  prompt paths is harder to reason about and harder to revert separately.
  `[id: priority-modal-redesign]`

### Balance and design

- `needs a measurement` · **RE-CHECK `setRecycleTech`, AND THE DISCARD PILE NOBODY CAN SEE** (Aj, 2026-09-08, on finding out
  decks thin: *"so were decks actually getting thinner without me noticing? huh?"*). They are, and the
  "without noticing" half is structural rather than careless.
  - **What thins.** `spendCard` is `(RECYCLE_TECH ? pl.shuffle : pl.removed).push(card)` and **`RECYCLE_TECH`
    defaults false**, so every normally-resolved Technique leaves the pool for good. So does the Broadway
    pitch, Counter Spell's own card, Annoint's own card, and anything Sabotage or an equipment-destroy kills.
  - **What does NOT thin, and is the reason this is easy to miss.** Spent **energy returns to the Shuffle
    Pile** (`payEnergy` pushes there, both the coloured pips and the generic remainder), and a **countered**
    card goes there too. So the pile a player watches most closely is the one that cycles perfectly.
  - **Two escape valves, both narrow:** Ares's Super `reclaim` pulls Shuffle + Discard + hand back into the
    deck, and Hippolyta's `reclaimDiscard` pulls the Discard back. Nothing else touches `removed`.
  - **THERE IS NO DISCARD-PILE VIEWER.** `openPileView` is only ever called with `'energy'` and `'shuffle'`
    (⚡ and ♻). The one zone that only ever grows, and that permanently shrinks your game, is the one zone
    you cannot open. **That is almost certainly the whole answer to "without me noticing".**
  - **IT HAS BEEN MEASURED BEFORE — AND THE NUMBER ONLY COVERS DUELS, ON A BUILD FROM BEFORE THE DRAW
    SCALED.** [`ENERGY-REORDER-DESIGN.md`](ENERGY-REORDER-DESIGN.md) records **154/400 = 39% of games ever
    reshuffle**, median first reshuffle **round 12**, **0.41 reshuffles per game**. Read straight, that is the
    answer to *"why did I never notice"*: in ~61% of games the deck never runs dry, so the thinning never
    bites. **Two reasons not to stop there**, and the doc says the second itself (*"at v1.28.1 and will
    drift"*):
    - **`recyclesim` calls `newGame` with no player count, so every one of those games was a DUEL.**
    - **It predates v1.31.3, which scaled the per-round draw to `numPlayers`.** At six players that is a
      **6-card draw against the 2 those games ran on** — three times the rate through the deck, and thinning
      compounds every cycle because `removed` never refills the Shuffle Pile. The duel figure cannot be
      carried across; **re-measure at 3/4/6p before concluding anything about multiplayer.**
    - **HYPOTHESIS, UNTESTED, worth one run rather than an argument:** this may be a thread in ♦'s
      multiplayer dominance, which Aj raised independently (*"the insane win rate in multiplayer"*). Wizard is
      the **ramp/reclaim** class, and reclaim is worth most exactly when the pool is thin and cycling fast —
      which is the 6p condition and not the duel one. `CARD-STATS` already shows Pure Wizard middling in a
      duel and climbing with the table. **This is a lead, not a finding**; the honest test is `analysis.js`
      with `RECYCLE` on and off at 6p, which needs no new code.
  - **Two jobs, and they are separable.** (1) Measure the magnitude — how many cards a real game removes, and
    whether it materially changes deck-out pressure; `recyclesim.js` measures cycling pressure already and
    `analysis.js` takes `RECYCLE` as an argument, so **option "all Techniques recycle" is measurable today
    with no new code**. (2) Decide whether the Discard deserves a viewer, which is a UI question independent
    of the balance one — and cheap, since the pile viewer is already generic over a zone name.
  - **Related, and deliberately NOT bundled:** whether Counter Spell's own card should go to the Shuffle Pile
    instead. Aj: *"let's leave counter spell alone for now."* It is a **buff** rather than a consistency fix
    (every Technique goes to the Discard; ♦ is not singled out), and it lands on the class that already
    scales hardest with player count. The three options are written up on `epic/priority-windows` in
    `FIGHT-END-PLAN.md` → *Where a mid-cast card goes*.
  `[id: re-check-setrecycletech-discard]`

- `needs a measurement` · **GAME LENGTH SCALES WITH PLAYER COUNT AND DAMAGE DOES NOT — the open question is what sits between the
  corners.** Median **11 (2p) → 15 → 22 → 33 (6p)** live; the engine's own defaults hold it flat at ~10. The
  measurement, and why you must NOT simply flip to `all`+`universal`, are settled in
  [`DECISIONS.md`](DECISIONS.md#game-length).
  **What is actually open:** design something that lands at **~15–18 rounds** at six players — e.g. a Special
  win stripping shields from *more than one* rival as the table grows, or `START_SHIELDS` scaling **down** with
  player count (the promising re-land direction, PATCHNOTES 0k). Worth a small committed harness for
  median/mean/max rounds by player count, since the original numbers came from a one-off.
  **RE-MEASURE DECK CYCLING IN THE SAME PASS** (Aj, 2026-09-08: *"maybe we'll retest when we get to fixing
  shield-loss=all"*). The two are coupled and it is not obvious: the only recorded cycling figure — 39% of
  games ever reshuffle — is **duel-only and pre-dates the draw scaling to `numPlayers`**, so nobody knows
  what a six-player deck does. **Anything that changes game LENGTH changes how many times a deck cycles**,
  and every cycle is lossy because spent Techniques go to `removed` and never refill the Shuffle Pile. So a
  length fix and a cycling measurement want the same harness and the same runs — see the `setRecycleTech`
  entry above for the full trace, including the untested ♦-dominance lead.
  `[id: game-length-scales-player]`

- `parked`              · **The "outbid" pass model for the AI** (Aj — parked 2026-08-24, may come back). The AI currently picks the
  *lowest safe single* to contest a jab, and never asks *"will this card even survive five opponents?"* Aj's
  reason #3 for passing was exactly that: middling values get outbid, so spending them is waste. Unlike the
  shipped hand-size heuristic (measured inert in multiplayer, see the note below) this signal **gets stronger
  as the table grows**, which is the dimension where the problem actually scales.
  - **Decide by measurement whether it goes on knight AND demon, or demon only** (Aj's explicit question). Do
    not assume it transfers: the existing strategic pass measured real for ONE TIER and noise for the other in
    duels, on the same code — see [`DECISIONS.md#strategic-pass`](DECISIONS.md#strategic-pass). `passsim.js`
    takes a tier argument for exactly this.
  - Implement as a third `setStratPassMode('outbid')` beside `'hand'` and `'combo'` so all three stay
    comparable in one harness.
  `[id: outbid-pass-model-ai]`

- `parked`              · **A gacha-style storyline** (Aj, idea — parked, ahead of netplay AI in the queue, not designed). Nothing
  specified yet. Worth noting that **v1.30.0 just built the substrate for it by accident**: a roster of 32
  named characters, grouped into five tiers, each with a distinct play style and a name that already flows
  through the whole naming funnel. A collection/progression layer has something to collect now.
  `[id: gacha-style-storyline]`

- `parked`              · **Suit ≠ class — future direction** (Aj, design intent, not yet built): the current 1:1 map (♦ Wizard,
  ♥ Cleric, ♣ Fighter, ♠ Rogue) is temporary. There will stay **only 4 suits**, but eventually **more than one
  class per suit**, and **hybrid classes** — e.g. an **assassin** that is *both* Fighter and Rogue, with **its
  own card set** (it does NOT reuse the pure Fighter or pure Rogue cards). This is also the natural home for a
  real **draw engine**, which is what would make the reorderable energy pile matter in more than the ~39% of
  games that currently reach a reshuffle (`node recyclesim.js`).
  `[id: suit-not-class]`

- `parked`              · **AI use of energy-pile order** — parked (Aj floated Demon Lord only). The Rival still spends FIFO, so the
  public reorder log lines are a human-only tell on purpose. See `ENERGY-REORDER-DESIGN.md`.
  `[id: ai-energy-pile-order]`
