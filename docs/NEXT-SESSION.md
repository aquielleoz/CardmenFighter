# Cardmen Fighter — backlog & handoff

**Build:** `node build.js` from `code/` inlines engine.js + ai.js + art.js + netview.js + qr.js →
`code/CardmenFighter.html`, then **`cp CardmenFighter.html ../CardmenFighter.html`** yourself — `build.js` writes
only `code/`, and the repo-root copy is the file people download. `faces.js` is NOT inlined (layouts retired in
v0.95; build.js stubs `window.CardFace = {}`). `build.js` parses every inlined script and **refuses to write on a
syntax error** — read its `built … bytes` line before believing a surprising measurement.

**Test gate:** `npm test` = `node test.js` (**437**) + `node netview.test.js` (**64**). Both must end **0 FAIL**;
they run straight on the sources, so run them after a source edit even if you skip the build. Everything else,
including every `nettest_*` suite and the eleven `lessontest*` ones, is listed in **CLAUDE.md** with its expected
count — that list is the authority, and if a count there disagrees with a suite, the suite is right.

**Player style:** **PLAYER-PROFILE.md** — a living read on how Aj actually plays (control/value grinder,
Wizard/Cleric, counter-heavy, boost-a-pair kill). Append new exported games to its ingestion log; use it for
AI-tuning, balance, and a future "play like Aj" opponent.

**Current version: v1.31.127.** The 2-apex + Forms **rework is simply the game** — the `REWORK` flag and the
classic pre-rework rules were deleted in v1.23.0 (no `setRework`, no `E.isRework()`). Twenty-one homebrew rules
live behind **Custom rules**, every one defaulting OFF, because `RULE_DEFS.some(ruleOn)` *is* the definition of
"customised".

## ☀️ START HERE

`main` is at **v1.31.127**, working tree clean.

**⚡ THE PRIORITY WORK LIVES ON `epic/priority-windows` — GO THERE BEFORE TOUCHING ANY WINDOW.** The two ★
priority entries below are **answered but not built**: Aj settled twelve rules questions on 2026-09-08 and
they are recorded on that branch, not here. Read
[`FIGHT-END-PLAN.md`](FIGHT-END-PLAN.md) *(on the epic)* for the enumeration, the disposition tables and the
commit sequence, and [`PHASES-AND-PRIORITY.md`](PHASES-AND-PRIORITY.md) — **which the epic has newer than
`main` does** — for the rules themselves. The epic is the integration branch: sub-branches PR **into** it,
the version is held until it merges, and `main` is merged **into** it after any session spent elsewhere
(CLAUDE.md → "Branches and PRs").

**⏭ NEXT UP IS STEP 18, AND IT IS ALREADY HALF-WRITTEN ON `exp/step18-switch`** (pushed, unmerged,
2026-09-10). The ENGINE half of the switch works — go-round live, old guard window removed in the same
change, `test.js`/`netview.test`/`fightendtest` all green, and the seeded fingerprint MOVES, which is the
switch genuinely changing the game. The NETPLAY half **wedges**: `nettest_guard` measures a client
springing Leyline over the wire with the round never turning over (2 → 2 through twelve seconds of
draining). `shieldResponsePending` is read at **seven** sites and only some are handled on that branch.
**Read step 18's ⚠ block in [`FIGHT-END-PLAN.md`](FIGHT-END-PLAN.md) first** — it names the seven sites and
the two pieces the attempt proved are needed either way. **Its gate also needs Aj:** one real solo game and
one two-device netplay game, so 18 cannot be closed by suites alone.

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

### Correctness

- **`lessontest_quicks` IS RED ~25% OF THE TIME AT `-j 4`, AND NEVER SERIALLY — MEASURED 2026-09-10.**
  Eleven runs across one day, on three different builds: **2 red in 8 at four lanes, 0 red in 3 at `-j 1`.**
  One of the reds was on `epic/priority-windows` before any of that day's prompt work, so it **predates**
  the Fight End changes and is not caused by them.
  **THE SHAPE IS IDENTICAL EVERY TIME — `PASS: 10  FAIL: 11`** — and it starts at one poll:
  `⏱ poll TIMED OUT: the Respond? window opens`, after which every assertion that depends on that window
  falls with it, ending in `lessonlib`'s two `finish()` failures. So there is ONE thing to find: why
  `tutCastRivalTech`'s window does not open under load. The suite's own notes are the place to start —
  that lesson has a documented history of the Rival's cast failing on energy (`tutCastRivalTech` used to
  take `[0]` and give up) and of the lone 4♦ Counter Spell hiding behind a shield (`tutPullShield`).
  **NOT the same failure as the entry below**, whose signature is the two completion assertions with
  everything before them PASSING — that one points at a last `next()`, this one at a mid-lesson stall.
  They may still share a cause; do not assume either way.

- **A LESSON SUITE FAILED ITS COMPLETION ASSERTIONS ONCE, AND I LOST WHICH ONE** (2026-09-10, one `-j 4`
  sweep during epic step 14; not reproduced since). The two failures were `lessonlib`'s shared `finish()`:
  *the completion modal is actually on screen* and *…and the lesson is marked done*. **Everything before
  them passed**, so the lesson ran its steps and then did not reach the completion modal — which points at
  the LAST `next()` not landing, not at a mid-lesson stall. `finish()` polls for a VISIBLE modal, so a
  timeout fails both (the second because `localStorage` was never written).
  **See the `lessontest_quicks` entry above** — measured at ~25% under `-j 4` with a different signature.
  It is the first suite to look at if this recurs, but it does not close this entry.
  **The suite name is unknown because I piped that sweep through `tail -4` and the summary line scrolled
  past** — `sweep.js` prints whole lines precisely so this evidence survives, and cropping it cost the
  identification. **Capture the full sweep log.**
  **Not reproduced:** an immediate re-sweep was **89/89**, and **33 runs of all eleven lesson suites
  eleven-at-a-time** (heavier than the sweep's four lanes) were clean. `lessontest_quicks` was the prime
  suspect — step 14 changed the modal it drives — and passed 21/0 both alone and in the green sweep.
  **Do not file this as a flake and do not raise a poll budget on it.** This repo's record is that an
  intermittent has been a real dependency every single time. The cheap next move is the one the
  `lessontest_twos` entry above already argues for: make the last step self-diagnosing — have `next()` say
  when it did not click, and have `finish()` print the step it was on when the modal failed to appear. One
  red run would then name both the suite and the step.

- **`lessontest_twos` FAILED ONCE UNDER LOAD, AND THE SIGNATURE POINTS AT THE PREP, NOT THE POLL** (seen once
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

- **RE-CHECK `setRecycleTech`, AND THE DISCARD PILE NOBODY CAN SEE** (Aj, 2026-09-08, on finding out
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

- **★ THE FIGHT END WINDOW IS A SHIELD-GUARD, NOT A PRIORITY WINDOW.** *(replaces the old "should a shield
  GAIN qualify" entry, which was misfiled as a rules question — Aj answered it and it is a build.)*
  [`PHASES-AND-PRIORITY.md`](PHASES-AND-PRIORITY.md) §3: **before** the Fight End Sub-Phase priority is passed
  around, every player's Quicks are available, and it is nobody's turn so the window is Quicks-only. The code
  offers a fixed *Guard with X / Take the hit* dialog to the **threatened seat only**, admitting only
  `immune || shieldImmune` (`guardEffFor`, engine.js). Five confirmed findings, one cause:
  - only **one** guard card is ever offered — the engine picks it, so holding Leyline *and* an Apollo-Sanctuary
    means hand order chooses for you (`shieldGuardCard` picks it, engine.js);
  - the winner gets no window at all, so Armor Piercing can never be added reactively even under Hippolyta,
    which the old design named explicitly (`resolveRoundWin`, engine.js);
  - a shield GAIN never qualifies, which is Aj's original Sanctuary report;
  - the stack view is filtered to effect objects, so the thing you are being asked about is invisible
    (`stackViewHTML`, template);
  - **note the model: a shield loss is NOT a stack object** (Aj, 2026-09-08) — *"it just happens; it's the
    priority windows around that that prevent/increase shield loss."* So the fix is the WINDOW, not putting
    the loss on the stack. Old `STACK-DESIGN` §3 said the opposite and the code half-implements it.
    **The code's `kind:'shieldloss'` objects are a QUEUE wearing a stack's clothes** — `applyRoundLoss` pushes
    one per struck target and `driveShieldStack` drains them in order — and Aj's 2026-09-08 ruling that every
    loss in a round lands **simultaneously** removes the only thing that ordering was for. After the rebuild
    the pending losses are plain data on state and the stack holds real objects only.
  - **⚡ ANSWERED AND SCHEDULED on `epic/priority-windows`.** All five findings, plus four more the design pass
    found. Do not start from this entry.

- **★ PRIORITY IS OFFERED TO THE WRONG PLAYERS, IN THE WRONG ORDER.** **⚡ Scheduled on
  `epic/priority-windows`, and the model below CHANGED on 2026-09-08 — read the epic's copy of
  [`PHASES-AND-PRIORITY.md`](PHASES-AND-PRIORITY.md), not this summary.** Aj reversed the origin rule:
  priority now starts with the **CONTROLLER of the top stack object**, and with the active player only when
  the stack is empty. This entry previously said the opposite (*"priority starts with the active player"*),
  which was correct when it was written and is quoted here only so the reversal is visible. The rest of the
  entry stands: the code diverges from the model in the ways below, and the fix now lands in the epic's
  step 6 rather than on its own.
  - `openResponseWindow` walks from `(top.p + k)`, i.e. from the **controller**, with `k` starting at **1**.
    That is TWO divergences, and they hide for different reasons (`openResponseWindow`, engine.js):
    **the skip** — `k=1` means the controller never gets priority back on their own object, so the active
    player cannot add to something they just cast. Present at **every** player count; invisible only because
    they usually have nothing more to add, and the code never offers, so nobody learns they could have.
    **the starting point** — walking from the controller instead of the active player. **The modulus hides
    this, not the player count in any interesting sense:** at n=2, `(controller+1) % 2` is always the other
    player, so when a non-active player responds, "next after the controller" *is* the active player by
    arithmetic and the order cannot be wrong. From **n=3** they come apart as soon as the controller is not the
    active player — A casts, B answers, and the code offers **C → A** where the model says **A → B → C**.
  - The **pre-fight window is offered to one seat only** and gives up rather than passing it on, so at 3-6p a
    human in seat 3+ can never spring it (`preFightHolder`, engine.js).
  - **`pushEffect` adds to the stack without resetting `passed`**, and `activate()` has no open-window guard —
    unreachable through the solo UI, reachable on a netplay host (`pushEffect`, engine.js).
  - **`noopDestroy` suppresses priority for EVERYONE** and is computed from one target while the effect can
    resolve against many (`openResponseWindow`'s `noopDestroy`, engine.js).
  - **A Back-Stab-locked player may cast Techniques.** Aj, 2026-09-08: they **keep priority** — equipment are
    neither a fight nor a Technique, and activated equipment is coming — but Back Stab's text denies fights and
    **Techniques**, and `respond()` accepts one today (`respond`, engine.js).

- **A SHIELD-LOSS TECHNIQUE CAN BE CAST AT A RIVAL WITH NO SHIELDS, AND SILENTLY DOES NOTHING.** Critical Hit
  ♠9 and Ultima Attack ♣10 both read *"Target Rival loses 1 shield."* Against a rival on 0 the ⚡ is fully lit,
  you pay the energy **and** the Broadway pitch, and nothing happens.
  **The fix is to refuse the cast, NOT to make it kick.** `noKick` on `destroyShield` is correct and the audit
  classified it correctly: *"no shield loss technique is a kick. none can be turned into kicks — check the
  wording"* (Aj, 2026-09-08). The Fighter Kick is a FIGHT outcome — a Special win against a rival already at 0
  — and the card text never claims otherwise. A Technique can take you to 0 and never past it.
  `activateBlock` is the home: it already carries fizzle guardrails for `counter` and `protect`.
- **THE ENGINE AND THE UI DISAGREE ABOUT WHO MAY RESPOND.** `canAddToStack` (engine.js) admits any
  affordable Quick; the UI's `eligibleQuicks` is narrower, so the engine opens a window the screen then
  auto-declines — e.g. an Annoint holder against a non-removal. Solo it is invisible; **on a netplay client it
  costs a visible round trip**, the board going busy waiting on a decline the player never chose. One predicate,
  two definitions — the `resolveIds` lesson.

- **"RIVAL" IS HARDCODED IN THE PRIORITY MODALS, WRONG AT 3-6 PLAYERS.** `openShieldGuardModal`
  (template) says *"Rival's Special is about to strip one of your shields"* — naming a player who is not
  at the table and withholding the one fact you need. **Aj's fix is broader than the string:** default names
  become **Rival + a number** for *everyone*, host and human seats included, so an un-renamed seat is still
  identifiable. Names stay dynamic.

- **TWO AI HEURISTICS MISS QUICKS THEY HOLD.**
  - `respondDecision`'s threat list (`respondDecision`'s `THREAT_KIND`, ai.js) is four kinds — `destroyShield`, `removeEquip`, `discardOpp`,
    `energyDenyOpp` — and **`lockout` is not among them**, so the AI declines Back Stab while holding Counter
    Spell and then sits out the round. Losing your whole turn is the one hostile effect it does not rate.
    **Derive "threat" rather than adding a fifth item**, or the next hostile kind repeats it.
  - Its reactive immunity filter tests only `e.immune` (`respondDecision`'s reactive-immunity branch, ai.js) and never `e.shieldImmune`, so an AI in
    Apollo Mode holding Sanctuary takes the hit — the `effectFor`-family shape again, third instance.

- **A 2-PLAYER NETPLAY PRE-FIGHT WINDOW IS SET ON THE CLIENT AND ABANDONED BY THE HOST** (the duel `t:'move'` handler, template) — the
  duel move handler has no op for it. Needs a client holding a Form-granted lockout Quick, so it is narrow, but
  the audit rates it a permanent hang.

- **ARMOR PIERCING IS "+1 TO YOUR NEXT FIGHT WIN", NOT "+1 TO A SHIELD LOSS YOU CAUSE"** (`resolveEffect`'s `onWin` case, engine.js). Arm
  it, then cast Ultima Attack or Critical Hit, and the +1 does not apply — the flag survives to your next fight
  win instead. The card text agrees with the code; the design intended the other reading. Also `extraShield: 1`
  is declared and never read, so a second cast cannot stack and a Form patch raising it would do nothing.

- **COUNTER SPELL DOES NOT TARGET** (`resolveTopEffect`, engine.js) — it always counters the object immediately beneath it.
  Indistinguishable from the design in a duel with a 2-deep stack; at 3-6p a 3-deep stack is reachable (A casts,
  B answers with a non-counter Quick, C counters) and C's Counter Spell hits the wrong object.

- **THE PRIORITY UI SHOWS NO STACK.** The prompt names only the top object, and the stack view that would fix
  it sits behind an opaque overlay (`stackViewHTML` vs `.overlay`, template). In a Counter-a-Counter chain the player being asked for
  priority cannot see what they are responding to.

- **★ THE MIRROR-CONTRACT AUDIT'S THREE UNFIXED FINDINGS.** v1.31.114/.115 took the two live bugs and
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

- **★ EXPANDING A ZONE PUSHES THE BOARD PAST ITS HEIGHT ON THE TIGHTEST PHONES** (measured 2026-09-07)
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

- **THE SETUP DIALOG SHOULD BE THREE COLUMNS IN LANDSCAPE** (Aj, 2026-09-07, with a screenshot of New Duel):
  *"can we do this in 3 columns for landscape? player count, name, your deck; opponent strength and decks;
  buttons"*. It is one tall column of five label/control rows plus the roll strip, which is exactly the shape
  that does not fit a short viewport — `landscapetest` already has to assert the dialog *scrolls* to reach its
  last control at 568x320. His grouping is the natural one: your setup, their setup, actions.
  **Precedent to copy, not invent:** the Custom rules panel is the one dialog that already goes multi-column
  (`.modal` is shared by every dialog, so the width lives on a class on that panel alone, and `showModal`
  resets `#modal`'s class list so a wide dialog cannot leak into the next one). Do the same here rather than
  widening `.modal`. Note the rules panel's columns are keyed to WIDTH (1040px/1400px); this one wants short
  and wide, so the query is the landscape band, not a width breakpoint.

- **★ THE BROADWAY PITCH CHOOSES ITSELF, FOR BOTH SIDES** (Aj, 2026-09-07, from real play: *"oh no it did not
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
  **Both need `opts.pitch` BACK in the engine**, which is the thing that was deleted — and each of them is the
  exercise it lacked.

### Tooling

- **`lessontest_forms` blew a THIRTY-SECOND poll once under `-j 4` — and 30s is not slowness, it is a dead end**
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

- **`landscapetest`'s ↓ New log assertion is INTERMITTENT — 2 failures in 26 runs (2026-09-04), and it has a
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
  Rogue needs a boost in balancing; nothing built). Distinct from Caltrops, which is a standing `oppDelta`
  debuff on opponents' cards. Aj's example: the pile is a boosted pair of 4s at effective 6 and you hold a pair
  of 5s; a "slash 2" drops the pile to 4 and your 5s become legal. **The engine already has the hook** —
  `st.pile.mod`, folded in by `refreshPile()`, and the value-modifier model it must obey is
  [`DECISIONS.md#value-modifiers`](DECISIONS.md#value-modifiers).
  **The measured support is settled: [`DECISIONS.md#value-stuck`](DECISIONS.md#value-stuck)** — read it there,
  including the correction to an earlier claim about Rogue. Do not re-derive it, and do not copy its numbers
  back here. **What is open is only the card:** cost, whether it is a Quick, and how much it slashes.

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
- **A SHIELD GAIN AS A GUARD IS PARKED on `exp/shield-gain-guard`** (2026-09-10). `exp/` and not `parked/`:
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

- **QR SCANNING IS BUILT, GREEN, AND PARKED on `feat/qr-scanning`** (PR #29, closed 2026-08-25, 21/0).
  **Why it is not merged:** scanning needs an origin that can be granted camera access, and a file opened from
  Android's Downloads is `content://` — an opaque origin — so Chrome rejects `getUserMedia` without ever
  prompting. **MEASURED AND SETTLED 2026-08-28:** the same file over **https is GRANTED** with a live preview.
  **What would revive it:** a decision to host the file. The blocker is no longer technical.
  Full reasoning, the origin experiment, and everything else considered for making joining easier are in
  [`DECISIONS.md`](DECISIONS.md#joining-discovery-and-the-qr-path).

### Balance and design

- **GAME LENGTH SCALES WITH PLAYER COUNT AND DAMAGE DOES NOT — the open question is what sits between the
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

- **The "outbid" pass model for the AI** (Aj — parked 2026-08-24, may come back). The AI currently picks the
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
