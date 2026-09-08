# The Fight End priority window — rebuild plan

**The fix is a DELETION.** [`PHASES-AND-PRIORITY.md`](PHASES-AND-PRIORITY.md) §3 says that before the Fight
End Sub-Phase priority is passed around — every player, in turn order, any Quick, before *anything* happens.
What was built instead is a shield-**guard** dialog: `driveShieldStack` (`engine.js`) offers a window to the
**threatened seat only**, `guardEffFor` admits only a card whose patched effect carries `immune` or
`shieldImmune`, `shieldGuardCard` then picks **one** of them (`[0]`) and hands its id to the UI as `guardId`,
and `openShieldGuardModal` (template) renders that one card as *Guard with X / Take the hit*. The two reported
symptoms are one cause. **Sanctuary refused:** under the ♥ King (Hector) the `BOOSTS` patch is `{quick:true}`
**alone** — a Quick whose own boost text says *"cast it in response"* — so `guardEffFor` returns null and the
card is refused. **Armor Piercing unusable reactively:** the ♠7 is `type:'Quick Technique'` at base, and the
striker is never offered a window at all. Neither is a missing flag. The gate asks a different question from
the one the model asks, and the predicate that asks the right one already exists four lines away in spirit:
`canAddToStack` (`engine.js`) — `effectFor` truthy, `impl`, `quick`, `canAfford`. Widening `guardEffFor` to
`e.quick` would just be `canAddToStack` under a misleading name.

**Target state.** One priority window per round, run by `openResponseWindow` — the same loop that already
handles every cast Technique, with real per-object `passed` sets, a global reset on any addition, and
auto-pass for anyone `canAddToStack` refuses. It is expressed as a **sentinel stack object**
(`{oid, kind:'fightend', origin, winner, targets, source, passed:{}}`), because the all-passed bookkeeping
lives *on* an object by construction: `declineResponse` writes `top.passed[q]`, `respond` does
`st.stack.forEach(function (o) { o.passed = {}; })`, and an objectless window has nowhere to record a pass. A
second, parallel loop would rebuild the thing being deleted. The sentinel is pushed by a new `enterFightEnd`
**above** `applyRoundLoss`'s whole body, so the window opens before the mill, before the jab short-circuit and
before `wpl.finishingBlow` is read into `strips` — which is what makes the window open every round (jab, apex
no-strip and chop rounds today reach Fight End with no window of any kind) and what makes a reactive Armor
Piercing actually land. `resolveTopEffect` gains one early branch whose "resolution" is the Fight End outcome
itself. Sanctuary then works by **timing** with no new rule: the shield gain resolves above the sentinel, so
`resolveShieldLossObj`'s `var wasBroken = opp.shields <= 0;` is false and the Fighter Kick branch is never
entered. On the wire nothing is invented — the window travels as the existing `pending` / `respondFor` /
`stack` mirror keys, the client answers with `{op:'respond'}` / `{op:'decline'}`, the host parks it through
`hostSettle` / `hostSettleN`, and `netReact.kind` stays `'respond'` so `passoStep` already answers it.

> **The two judges split, and this document says so rather than picking silently.** The correctness judge
> chose the *strangler* plan (a `FIGHT_END_PRIORITY` flag, a shadow comparator, an `origin` field, and the
> property that every commit before the flip leaves a shippable tree). The fidelity judge chose *risk-first*
> (settle the remote-only silent deadlock first, on the existing window, before anything is deleted; ship the
> UI copy before the switch rather than after). Their graft lists converge, so this plan is the strangler
> **spine** with risk-first's **ordering** for the first three commits and its UI/phone gates folded in. Where
> they genuinely disagreed — the sentinel's `kind` — this plan takes the fidelity judge's `'fightend'`; see
> *The kick* and step 6 for why.

---

## The three tables

Symbols only. A repo gate (`versiontest`) fails any live doc citing `file:NNNN`.

### DELETE

| file | symbol | what it does today | note |
| --- | --- | --- | --- |
| engine.js | `guardEffFor` | returns the patched effect only if it carries `immune` or `shieldImmune`; null otherwise | THE whitelist. Its eighteen-line doc comment spends every line defending the boundary of a question the model says should not be asked. **Do not port the comment** — it argues against the fix. |
| engine.js | `shieldGuardCard` | filters the hand through `guardEffFor` and returns `[0]` | The engine choosing for the player. Also the "first candidate is gambling on the deal" shape CLAUDE.md catalogues. `needCantLose` dies with it. |
| engine.js | `wouldBeSaved` | read-only peek used only to SUPPRESS the window when the loss would be prevented anyway | "Nothing is at stake for you" is not a reason to deny priority. Deleting it also removes a duplicated copy of the prevention ladder that `resolveShieldLossObj` implements independently. After it goes, `findAbsorber` has one caller left — the tell that the peek copy existed only for the whitelist. |
| engine.js | `driveShieldStack` (window branch) | `facingKick` / `canGuard` / `wouldBeSaved` / `shieldGuardCard` / `st.shieldResponse = {...}` / the `shieldResponsePending` return | The bespoke window, opened **per shieldloss object** and offered to that object's target only. |
| engine.js | `shieldGuard` | casts into the guard window — calls `resolveEffect` **directly** | The sprung card never touches the stack, so nobody can Counter Spell it and no priority is re-granted. `respond` already does this correctly (§2 step 5). |
| engine.js | `shieldGuardPass` | declines; **one** seat's pass closes the window outright | `declineResponse` is the analogue: record `top.passed[q]`, re-enter the loop, offer the next seat. |
| engine.js | `openResponseWindow` (`noopDestroy` branch) | suppresses the ENTIRE priority window for a `destroyShield` aimed at a seat already at 0 shields | Whitelist thinking that leaked into the real loop: it asks whether the TARGET has a shield worth saving when the window's job is priority for everyone. Also wrong under `DAMAGE_SPAN` — `effectTarget` names one seat while resolution can strike several. Already filed in the BACKLOG. |
| engine.js | API exports (`shieldGuard`, `shieldGuardPass`, `shieldGuardCard`, `guardEffFor`) | all four on the public engine API | Remove them, do not leave shims — that is the `opponentCanRespond` trap the engine's own comment records: exported dead code that looks canonical and is the first place a reader goes. Removing them is also what forces every caller to be found. |
| template | `openShieldGuardModal` | the whole guard UI: reads `sr.guardId`, renders two buttons, calls back with the round result | Replaced by `promptHumanResponse`. Reads `state`, not `hostState` — that works only because `hostStartRealN` aliases them. |
| template | `openShieldGuardModal` → `#sgYes` handler | client sends `{op:'guard', id}`; host/solo calls `E.shieldGuard` | The `guard` op disappears. The client guard here is present and correct — this is not one of the missing-guard sites. |
| template | `openShieldGuardModal` → `#sgNo` handler | client sends `{op:'guardPass'}`; host/solo calls `E.shieldGuardPass` | Collapses into `respDecline` / `{op:'decline'}`. |
| template | `narrateShieldGuard` | narrates an opponent springing a guard; reads `fr.guardName`, which only `shieldGuard` returns | Its other caller (`rivalMayGuard`) was already deleted in v1.31.125. A priority answer narrates through `settleWindows`' existing `say()` path. |
| template | `driveRival` (round-ending-pass branch) | duel driver auto-resolving the AI's guard window inline with a hardcoded `rpl.shields<=2` | A second, worse copy of `shieldGuardAI`'s policy, in the template. |
| template | `mpResolveAIShieldWindows` | bulk auto-resolve of every AI seat's guard window; a THIRD copy of `shields<=2` | Three call sites in `runOpponents`. `settleWindows`' `AI.respondDecision` loop is already seat-generic. |
| template | `netOppWindow` (shieldResponse branch) | scans for the next remote-owed guard window, auto-passing a seat with no `guardId` | The `respond` branch two lines below covers it, and the engine's own auto-pass replaces the hand-rolled one. |
| template | `hostApplyMove` (duel `guard`/`guardPass` branch) | duel host applying a remote guard answer, then re-entering `hostRivalWindows` | The duel host already has a `respond`/`decline` branch above it. |
| template | `hostRivalWindows` / `netGuard` | the duel's park for a guard owed to seat 1, with its own park variable | A SECOND park mechanism for one window — the duel uses `netGuard`, 3-6p uses `netReact={kind:'guard'}`. That split is exactly the `netDiscard`-vs-`netReact` shape that wedged a real duel in v1.31.91. |
| template | `hostApplyMoveN` (`op==='guard'`) | host-authoritative application of a remote guard | Narrates with `logMsg`, which is HOST-LOCAL — so a remote seat's guard was never seen by anyone else, while the sibling `respond` arm above it correctly uses `say()`. Deleting it silently fixes a v1.31.58-class bug. |
| template | `hostApplyMoveN` (`op==='guardPass'`) | host applying a remote decline | Collapses into the `decline` arm. Nothing to salvage. |
| template | `clientCheckWindow` (`guard:` sig + dispatch) | the `'guard:'+guardId+':'+roundWin` signature and `openShieldGuardModal(null, function(){})` | Both go with the modal. See *Netplay and the mirror* — the `resp:` signature above them needs work of its own. |
| ai.js | `shieldGuardAI` | the AI's ENTIRE answer to the Fight End window: `if (pl.shields <= 2)` spring the engine-chosen card, else take the hit | Never chose a card and never considered anything but immunity. Deleting it leaves the AI with **no Fight End policy at all** — see step 14. Two things must be preserved in the replacement: the `isHuman` suspend and the `effectsAllowed` gate. |
| ai.js | `playPhase` (the `st.shieldResponse` guard in the activation loop) | suspends proactive activation while a guard window is open | The line directly above it, `if (st.pending) return;`, is the general-window equivalent and covers the rebuilt window. **The two are adjacent — it is easy to delete the wrong one.** |
| ai.js | `act` (`if (st.shieldResponse) shieldGuardAI(...)`) | drains the MID-TURN guard window a `destroyShield` may have opened | `resolveAIWindows(st, humans, log)` sits six lines above. See step 4: this path is very likely already dead. |
| ai.js | `takeTurn` (first guard) | a turn that begins with an open guard window answers it and returns | The `st.pending` branch immediately below absorbs it. Note the ORDER: this gate currently outranks the response-window gate; that precedence disappears with the merge. |
| ai.js | `takeTurn` (post-`playPhase` suspend) | suspends when a human owes a guard answer | Its two neighbours (`discardPending`, `pending`) already cover the general case. |
| netview.js | `promptFor` (shieldGuard branch) | reports `{kind:'shieldGuard'}`, ranked first | The `respond` branch four lines down covers it. **Check the reordering, do not assume it** — `shieldGuard` currently outranks `discard` and `preFight` while `respond` ranks below both. |
| netview.js | `remapSR` | rotates `st.shieldResponse` and projects five fields | Dies whole. `respondFor` + `remapStack([st.pending])[0]` already carry strictly more; the only orphan is `guardId`, the whitelist artefact. **MOVE ITS BLOCK COMMENT, do not delete it** — it is the record of the v1.31.114 circular-mirror bug and its rule (project named fields, never `for (var k in …)`) governs every field the sentinel adds. |
| netview.js | `mirrorFor` (`shieldResponse` key) | ships the rotated guard window to the client | Goes with the field. Forces two knock-ons outside this file: `netOppWindow`'s `guardId` auto-pass, and `nettest_guard`. |

### REPOINT

| file | symbol | what it does today | note |
| --- | --- | --- | --- |
| engine.js | `driveShieldStack` (the drain) | pops each shieldloss object and calls `resolveShieldLossObj`, then `finishRoundWin` | **It halves, it does not disappear** — both callers still need it. Once the window runs once, before the loop, it can never return a pending result, which simplifies every caller and kills `openResponseWindow`'s `shieldResponsePending` branch. |
| engine.js | `openResponseWindow` (the `while` guard) | `st.stack[st.stack.length-1].kind === 'effect'` | Must admit `'fightend'`. An empty stack falls straight through — which is why the window needs an object at all. |
| engine.js | `openResponseWindow` (the priority walk) | `for (var k = 1; k < st.numPlayers; k++) { var cand = (top.p + k) % st.numPlayers; … }` | Controller-relative, and `k=1` skips the controller. Take an `origin` **from the object** so existing objects keep byte-identical behaviour: `var from = (typeof top.origin === 'number') ? top.origin : top.p, k0 = (typeof top.origin === 'number') ? 0 : 1;`. **Scope it to the sentinel.** Fixing the general divergence is a separate BACKLOG entry and a strength change. |
| engine.js | `openResponseWindow` (the shieldloss tail / discarded `sres`) | hands a top-of-stack shieldloss to `driveShieldStack`, then **discards** the non-pending result and returns `last` | So a mid-turn `destroyShield`'s `struck`/`prevented`/`spared` never reaches the caller — the repo's own "read `result.struck`" rule failing on the Technique path. Becomes trivial to fix once `shieldResponsePending` is gone; fix it in the same pass. |
| engine.js | `resolveTopEffect` | `var top = st.stack.pop(), pl = st.players[top.p];` then dereferences `top.eff`, `top.card` | Needs an early branch for the sentinel that reads none of those and whose resolution is `applyRoundLossBody`. Its `counter` branch scans for the nearest `kind === 'effect'` beneath, so a sentinel is skipped for free — **assert that**, do not inherit it. |
| engine.js | `respond` | pushes the Quick as a stack object and resets every object's `passed` set | Becomes the single cast path for the Fight End window. Its gate and its `qeff.quick` check are already exactly right; it only has to tolerate the sentinel being `st.pending`. |
| engine.js | `declineResponse` | records `top.passed[q]` and re-enters the loop | Replaces `shieldGuardPass`. Same tolerance requirement. |
| engine.js | `pass` | the only entry into round resolution; `st.passes >= aliveCount-1` → `resolveRoundWin` | The moment the doc calls "nobody's turn". Note `st.turn` is **not** advanced first, so it still points at the LAST PASSER — the one clearly wrong choice for the priority origin. |
| engine.js | `chooseLossTarget` | resumes after the deferred target pick and calls `applyRoundLoss` | The second of two entries into `applyRoundLoss`, which is why `enterFightEnd` is the seam: one edit covers both. |
| engine.js | `applyRoundLoss` (mill + jab short-circuit) | runs `LOSER_MILL`, then `if (!wonWithCombo \|\| !strikeTargets.length) return finishRoundWin(st, result);` | Two conflicts with the model in four lines: the window must open on jab / apex-no-strip / chop rounds, and it must open before the mill. Hoisted above the whole body. |
| engine.js | `applyRoundLoss` (strips / `finishingBlow`) | `var strips = 1; if (wpl.finishingBlow) { strips = 2; wpl.finishingBlow = false; … }`, frozen into each object's `n` | **This, not `guardEffFor`, is the other half of symptom 2.** Delete the whitelist alone and Armor Piercing becomes castable, resolves, logs, and does nothing. |
| engine.js | `resolveEffect` (`case 'onWin'`) | sets `pl.finishingBlow`, read only by `applyRoundLoss` | Leave the write alone; move the read below the window. |
| engine.js | `resolveEffect` (`case 'destroyShield'`) | pushes a shieldloss with `noGuard: true, noKick: true` | `noGuard` becomes meaningless — drop the flag rather than leaving a field nothing reads. `noKick` stays. Its comment's claim that "the target already got a response window" is FALSE when the target is at 0 shields, because of `noopDestroy`. |
| engine.js | `finishRoundWin` | `st.stack = []; st.shieldResponse = null; …` then round/initiative/flags | Drop the `shieldResponse` line. Keep the blunt `st.stack = []` — it is what guarantees a sentinel cannot leak into the next round. |
| engine.js | `newGame` | declares `shieldResponse: null` beside `pending` / `respondFor` | Drop it. The sentinel needs no new state field. |
| engine.js | `concede` | nulls `st.shieldResponse` for the conceding seat | Drop the line — but see *Netplay*: `st.respondFor === seat` covers the new window only if the sentinel sets `respondFor`, and the stack filter below it is a separate hazard. |
| engine.js | `preFightHolder` | `st.finished \|\| st.pending \|\| st.shieldResponse \|\| st.stack.length \|\| st.preFightHandled` → -1; offers to ONE seat; requires `e.kind === 'lockout'` | Drop the `shieldResponse` clause with the field. The rest is the same disease one phase earlier — see Open question 7. |
| engine.js | `openPreFight` / `preFightCast` / `preFightPass` | a third bespoke window with its own state and cast/pass pair | Out of scope for this job, in scope for the decision: doing Fight End and leaving this makes three window shapes instead of two. |
| engine.js | `reorderEnergy` | refuses while `st.pending \|\| st.respondFor != null`, and does **not** check `st.shieldResponse` | A small existing hole the rebuild closes for free. It is already gated `p !== st.turn`, so the new exposure is one seat (the last passer) for the window's duration. See *Disagreements*. |
| template | `openShieldGuardModal` (threat headline) | *"P3's Pair is about to strip one of your shields"* — striker seat + winning combo | v1.31.120 built this specifically so it stops saying "Rival" at 3-6 players. It is the **only thing on screen that says why the window is open**. Port the framing or the rebuild is a UX regression on the axis just fixed. |
| template | `openShieldGuardModal` (guard card blurb) | reads the PATCHED effect and prints `(empowered by your Super)` from `geff.boosted` | The only response-window blurb in the file that uses `effectFor`. |
| template | `promptHumanResponse` | the real window's UI; lists `eligibleQuicks()`, auto-declines when empty | The destination. But its first statement is `var pend=state.pending, rivalEff=E.effectOf(pend.card)||{}` and `effectOf` opens `if (card.temp)` — a **TypeError** on a cardless window. Also its lead computes `aimTxt` only when `E.HOSTILE_SINGLE[rivalEff.kind]` is truthy, so a Fight End strike renders with no target at all. |
| template | `promptHumanResponse` (Quick button loop) | `quicks.forEach(function(c){ var ef=E.effectOf(c); …` | One of CLAUDE.md's three `effectOf` label sites, and it is IN the destination path: Apollo's Sanctuary is selected by `effectFor` and then described with the base card's name, cost and text, losing the empowerment note. Fixing it is a prerequisite, not a polish item. |
| template | `renderStack` | `(state.stack||[]).filter(function(o){return o.kind==='effect';})` | The thing you are being asked about is invisible. The BACKLOG calls it `stackViewHTML`; the live symbol is `renderStack`. Added by the fidelity judge — not in the inventory. |
| template | `settleWindows` | drains AI seats' windows and prompts yours; the single funnel every cast chains | Must drain the Fight End window instead of `mpResolveAIShieldWindows`. **It carries no `isClientActive()` guard** and is safe today only because all five callers return at their own guard first — routing an every-round window through it creates the sixth site of the documented shape. Put the guard at the funnel, the way `playCards` carries it. |
| template | `doPassBody` | solo/duel entry; consumes the engine result via `finishPassRound(fr)` | Must become "the Fight End window is open" and route to `settleWindows`. The continuation contract is the part to preserve. |
| template | `runOpponents` (step gate) | your guard window blocks the driver; AI seats auto-resolve | Becomes a `state.pending && state.respondFor===YOU` check — which the very next lines already have. The two gates merge; that is the point. |
| template | `runOpponents` (loss-target branch) | after YOU pick the loss target at 3-6p, your window opens before the ceremony | **The ORDER here is already correct** and must be preserved verbatim. Only the window's nature changes. |
| template | `runOpponents` (opponent-pass round resolve) | the sibling branch, five lines away, which consumes `res` where the other consumes `fr` | Two siblings that consume the continuation differently — touch both or they drift (the `resolveIds` / `isChopOf` shape). |
| template | `hostRivalContinue` | the remote Rival's `destroyShield` threatens the HOST → local modal | **UNSURE — decide before touching.** v1.31.125 removed `destroyShield`'s ability to open a guard window, so this may already be dead. Verify reachability (step 4), do not assume. |
| template | `hostAfterRivalMove` | the duel Fight End fork: host threatened → modal, remote → park; both continue into `hostFinishRound(fr)` and `hostFinishRound(fr\|\|r)` | THE duel Fight End site. Only the THREATENED seat has an arm; there is no branch for the striker. Must call `hostSettle` first. |
| template | `hostSettle` | the duel's priority-window park | Already the right shape, but its park sets **neither `maybePasso` nor a `$('rivalStatus')` line** — unlike every other park. After the rebuild a duel host parks blind every round, which is indistinguishable from the v1.31.49 wedge the status line exists to prevent. |
| template | `hostSettleN` | the N-player park, with the full `reassertMirror()` + `startParkBeat()` + `maybePasso` ritual | The model park. Any new park copies this line, never a bare `broadcastMirror()`. |
| template | `hostSettleRoundThenCeremony` | THE N-player Fight End host site; recursive | Rebuild in place rather than delete: the recursion, the park discipline, the `fr\|\|r` fallback and the ceremony ordering are all already correct. It has **no `hostState.pending` branch** — that is the gap. |
| template | `hostApplyMoveN` (reactive op whitelist) | `it.op==='respond'\|\|'decline'\|\|'guard'\|\|'guardPass'\|\|'discard'` | Drop `guard`/`guardPass`. **This is a WIRE contract** and netplay only warns on a version mismatch — see Open question 9. |
| template | `driveN` (host guard gate) | sits above the `respondFor===YOU` gate four lines down | Merges into it. The relative ORDER of these gates encodes the phase order — do not reorder discard / prefight / respond. |
| template | `driveN` (park status text) | `' may guard…'` — the ONLY on-board sign that a window is open for someone else | Nothing in `render()` reads the window state. At six players this string is the entire UX for the other four seats, every round. |
| template | `passoStep` | five-way switch on `netReact.kind`, ending in a bare `return;` | The `'guard'` arm becomes nothing; `'respond'` already answers `{op:'decline'}`. **A new kind name here is a silent permanent deadlock** — see *Passo*. |
| template | `hostBackToLobby` | clears every park variable, including `netGuard=null` | Drop the token with the variable. If the variable goes and this line stays, the build parses clean and throws a ReferenceError at runtime — the v1.31.71 shape. |
| template | `applyMirrorNow` (`owedModal`) | keeps an owed window's modal up across mirrors and forces `busy` | Drop the `shieldResponse` disjunct; the `pending`/`respondFor` one covers it. Getting this wrong is invisible to a DOM assertion and shows up as the modal flickering away a frame after it opens. |
| template | `showModal` (peek-stash comment) | names the three windows peek is offered from | Doc-only, but the peek contract is real — both `openShieldGuardModal` and `promptHumanResponse` call `peekBtnHTML()` + `wirePeek()`, so peek survives the swap. |
| ai.js | `respondDecision` (opening lines) | `var qp = st.players[q], pend = st.pending, eff = pend.eff;` then `eff.kind` | **THE SHARPEST HAZARD IN THE FILE.** A TypeError here reaches `AI.takeTurn` → `resolveAIWindows` and kills `test.js`'s 300-game loop and all eleven sims at once — eleven unrelated-looking reds. Needs an explicit early branch **above** the destructure. |
| ai.js | `respondDecision` (reactive-immunity branch) | the only `E.guardEffFor` call outside engine.js; springs an immunity against a `destroyShield` at ≤2 shields | Already inside the GENERAL window, so it survives; only the predicate changes. Keep the `immune \|\| shieldImmune` pair as **one definition**, renamed `immunityEffFor` — letting it decay to `E.effectOf(c).immune` reopens the exact v1.31.112 bug the extraction prevented, and `effectFor` is required because Apollo *grants* `shieldImmune`. |
| ai.js | `respondDecision` → `bestQuick` | cheapest affordable Quick of ONE named kind; reads `effectFor`; honours `kindOK` | Right machinery, wrong question. Widen to take a predicate. **Keep `kindOK`** — `analysis.js` / `personasim.js` block kinds through it and a picker that skips it silently changes every measured arm. |
| ai.js | `THREAT_KIND` / `BENIGN_KIND` | classify the pending effect's kind; `test.js` requires every producible kind to be in exactly one | Cannot answer "is this shield loss worth a Quick" — there is no effect. The severity read must come from the board. **And the completeness sweep will NOT catch a synthetic kind** — see *Missing from all*. |
| netview.js | `remapStack` (`winner` / `n` branches) | exist only for `kind:'shieldloss'` objects | **UNSURE — decide before touching.** The model says a shield loss is not a stack object, yet `kind:'shieldloss'` objects sit on `st.stack` today. If they stay as an internal queue these branches stay live; if they go, these become unreachable code. Do not leave them unreachable — the repo has three recorded cases of an orphaned kind reading as live for many versions. |

### UNCHANGED

| file | symbol | what it does today | note |
| --- | --- | --- | --- |
| engine.js | `canAddToStack` | `effectFor` truthy + `impl` + `quick` + `canAfford` | The replacement predicate, and correct as written: `effectFor` means Form-granted Quicks count, `[].some` auto-passes an empty hand, and it deliberately does **not** consult `isLocked` (§5: a locked player keeps priority). Two blind spots, neither a blocker: it looks only at HAND, so a reactive activated equipment would be silently auto-passed the day one exists. **It is NOT exported** — export it (step 6) or every consumer restates the predicate. |
| engine.js | `pushEffect` | push-then-open; the one-line contract every cast funnels through | Mint the sentinel with the same `newOid`/push shape rather than a parallel construction. |
| engine.js | `resolveRoundWin` (deferred pick) | returns early with `needsLossTarget` and `st.pendingLossChoice`, before any strip | This is decision (b), already correct. Only caution: at 2 players and on a jab win this branch is skipped entirely, so the window must open on those paths too. |
| engine.js | `resolveRoundWin` (`APEX_NOSTRIP` / `chopped && !CHOP_STRIPS`) | clear `wonWithCombo` | Rule layer, untouched — but they are why a large share of rounds reach Fight End with no window at all today. |
| engine.js | `resolveShieldLossObj` | `var wasBroken = opp.shields <= 0;` then the prevention ladder per strip | Where "a shield loss just happens" already lives, and the right shape for the model. Nothing here is a window. Unchanged except for the `obj.n` question in *The kick*. |
| engine.js | `resolveShieldLossObj` (kick branch) | fires only when the seat came in at 0 and only `cantLoseRound` / a Holy Shroud absorb stops it | Precisely the mechanism the Sanctuary fix rides. **Do not add a "Sanctuary prevents a kick" rule.** |
| engine.js | `resolveEffect` (`case 'shield'`) | gains the shield, then `if (eff.shieldImmune) …`, then `draw`, then `spendCard` | **Read to the end: Apollo's immunity IS applied here.** What it does not set is `cantLoseRound` — which is exactly why the whitelist refuses Sanctuary against a kick, and exactly what the timing fix makes irrelevant. |
| engine.js | `resolveEffect` (`case 'ward'`) | Leyline's base branch; sets the two flags the strip ladder consults | Keeps working identically. It is the one card the whitelist got right, which is why the whitelist looked adequate. |
| engine.js | `finishRoundWin` (round-long flags) | clears `shieldImmune`, `cantLoseRound`, `finishingBlow`, … | Correct placement: a Quick sprung in the window must survive until after the strips, and it does, because this runs after the drain. |
| engine.js | `activate` | hard-gated on `p === st.turn` | Correct for the Main Sub-Phase, and the reason the window MUST route through `respond`: at Fight End it is nobody's turn, so every `activate` would be refused with "Not your turn." |
| engine.js | `isLocked` | Back Stab's lock test | Deliberately not consulted by `canAddToStack`, per §5. Do not "tidy" a lock check into the new window. |
| engine.js | `shieldSaved` / `absorbSaved` / `findAbsorber` | the strip-time prevention ladder | Keep all three. Only the peek copy (`wouldBeSaved`) dies. |
| engine.js | `newOid` | stack object id minting | Reuse it for the sentinel so mirror identity stays uniform. |
| engine.js | `chooseShieldTarget` / `setShieldTargetChooser` / `setLossTargetInteractive` | the injectable loss-target choosers | They run before the window and stay before it. |
| engine.js | `EFFECTS.H[10]` + `BOOSTS.H` king/super | Sanctuary: `type:'Technique'`, no `quick`. King grants `{quick:true}` ALONE; Apollo grants `{quick:true, shieldImmune:true}` | No data change. The KING tier is the case that proves the whitelist rather than a missing flag is the bug — and it means **plain Sanctuary stays refused after the rebuild**, correctly, by the Quick test. See Open question 5. |
| engine.js | `EFFECTS.S[7]` / `EFFECTS.C[7]` + `BOOSTS.C` queen | Armor Piercing: `type:'Quick Technique'` at base on the ♠7; Hippolyta grants `quick` on the ♣7 | No data change. A card whose face says *Quick Technique* and which cannot be cast in the one window that exists is the clearest statement that the window is not a priority window. |
| engine.js | `concede` (stack filter) | drops objects where `o.target`, `o.p` or `o.winner` is the conceding seat | Shieldloss objects survive the rebuild. **But this filter will delete a sentinel carrying `winner`** — see *Netplay*. |
| template | `eligibleQuicks` | the UI mirror of `canAddToStack`; v1.31.120 stripped every extra kind filter so the two agree | Already the correct predicate. **Do not add a Fight-End-specific filter here** — that regression is documented in its own comment. |
| template | `humanResponds` | applies the chosen Quick, or sends `{op:'respond'}` on a client | Already the correct application path for any Quick in any window. |
| template | `humanDeclines` / `#respDecline` | passes priority; client-guarded; sends `{op:'decline'}` | Replaces `#sgNo`. Only the label may want changing ("Let it resolve" reads oddly when what resolves is a shield loss), and the tutorial's `tutNeedsCounter` disable hangs off this same button. |
| template | `tableContextHTML` | the pile/energy box shared by the guard modal, Respond? and both pre-fight windows | Survives untouched — but note it hardcodes "Rival's" at 3-6 players, the same bug v1.31.120 fixed one line above it. Pre-existing. |
| template | `eligiblePreFightQuicks` / `promptHumanPreFight` / `promptHostPreFight` | the pre-fight window, narrowed to `kind==='lockout'`, offered to one seat | Out of scope, same defect one phase earlier. Its two button loops are the other two `effectOf` label sites. |
| template | `effIcon` / `EFF_ICON_SVG` | card-face chips, including a `shieldImmune` glyph | Card ART, not the window. Reads `effectOf`, so a Form-granted immunity shows no chip — a separate pre-existing display gap. |
| ai.js | `resolveAIWindows` | drains every AI-owed window recursively, stopping at a human's | Becomes the Fight End drainer for free — it keys on `pending`/`respondFor` and on no effect shape. One thing to check under test rather than assume: `guard++ < 64` bounds it, and a 6-player window re-offers to five seats on every addition. |
| ai.js | `lockoutQuick` | finds the affordable lockout Quick for the pre-fight window; reads `effectFor` | Not a Fight End site — listed because it is the CORRECT pattern to copy. Its comment records why `effectOf` here was a shipped bug. |
| ai.js | `aiPreFightLock` | the AI's only existing "should I act in someone else's window" policy | Copy the SHAPE (difficulty gate → `effectsAllowed` → card availability → board condition), not the content — it answers for exactly one card kind. |
| ai.js | `chooseMove` → `keepValue` | a Quick in hand is worth +6 not-to-throw-away; reads `effectFor` | No code change, but **flag it for balance re-measurement**: +6 was tuned against a window that admitted one whitelisted card. Do not touch it speculatively. |
| ai.js | `playPhase` (proactive Sphere / Leyline picks) | proactive casts of the very cards the window springs reactively | Main Sub-Phase, not window sites. Listed so a keyword sweep does not delete them. Second-order: a genuinely open window makes *holding* them the better line, which is a policy question for step 14. |
| netview.js | `mirrorFor` (`pending` / `respondFor` keys) | `pending: remapStack([st.pending])[0]`, `respondFor: rot(st.respondFor)` | The direct answer to "what replaces `remapSR`": nothing new. `remapStack` rotates `p`, `target`, `winner` and `opts.target` and carries `oid`, `kind`, `source`, `n`, `countered`, `card`, `eff` — a strict superset of what `remapSR` projected. |
| netview.js | `snapshotFor` (player flags) / `clonePlayer` (scalar sweep) | round-long public badges: `shieldImmune`, `cantLoseRound`, `preventShield` | RESULT state, not window state — and they become MORE important after the rebuild, since Sanctuary works by timing and a client must see the flag flip between the window closing and the loss landing. Worth an explicit assertion in whatever replaces `nettest_guard`. |

---

## Where the window sits

### The chain today (solo / duel, the human passes and the Rival's play stands)

1. `doPass` → `rivalPreFightThen(g, doPassBody)` — the **pre-fight** window (the *other* one).
2. `doPassBody` → `E.pass(state, YOU)`.
3. `pass` (engine.js) — `st.passes += 1;` then `if (st.passes >= aliveCount(st) - 1) return resolveRoundWin(st);`. **`st.turn` is not advanced**, so it still points at the last passer.
4. `resolveRoundWin` — computes `winner = st.lastPlayer`, `wonWithCombo`, applies `APEX_NOSTRIP` and `chopped && !CHOP_STRIPS`, then **decides the target**: the early return with `needsLossTarget`, or `chooseShieldTarget`, or all losers.
5. *(deferred branch only)* `promptLossTarget` → `chooseLossSeat` → `E.chooseLossTarget`.
6. `applyRoundLoss` — **mill**, build `result`, **jab short-circuit** `return finishRoundWin(...)`, consume `wpl.finishingBlow` into `strips`, push one shieldloss per struck seat, call `driveShieldStack`.
7. `driveShieldStack` — per object: open the guard window, or pop and resolve.
8. `resolveShieldLossObj` — `wasBroken`, the strips, `struck` / `spared` / `kick` / `eliminated`.
9. `finishRoundWin` — clear the stack, advance round and initiative, expire round-long flags. `DEFER_DRAW` is true in the UI, so no draw here.
10. `finishPassRound` → `announceRoundWin` → `sendCeremony` → `resolveRoundCeremony` (pre-beats, threshold, the Clean-up trim queue, `E.roundDraw`, the card beat).

**Netplay host:** `hostApplyMoveN` → `hostPreFight` → `E.play`/`E.pass` → `hostResolveWin` → `hostSettleRoundThenCeremony` → `hostRunCeremony` → `driveN`. The duel takes the same steps through `hostAfterRivalMove` → `hostFinishRound`.

### Where the new window goes

**Between 4/5 and 6 — at the top of `applyRoundLoss`, not at the top of `driveShieldStack`.** Concretely: a
new `enterFightEnd(st, winner, wonWithCombo, strikeTargets, winSize)` becomes the target of both call sites,
stashes those four arguments, pushes the sentinel and returns `openResponseWindow(st)`. When the sentinel
resolves, `resolveTopEffect` calls `applyRoundLossBody(st, ctx)` — today's body, unchanged.

**`driveShieldStack` looks like the right seam and is one step too late, for two reasons the code makes
explicit.** The mill runs and `finishingBlow` is consumed *before* anything is pushed, and §3 says priority is
passed *"before **anything** happens: before shields are stripped, before initiative is determined"* — the mill
is Fight End resolution (§3 lists a Jab win banking energy as a Fight End outcome). And `applyRoundLoss`
short-circuits the entire stack on a jab win, so a window placed inside `driveShieldStack` cannot satisfy
decision (a), *it opens every round*.

### What breaks

- **A window inside `driveShieldStack` never opens on a jab, apex-no-strip or chop round.** `wonWithCombo` is cleared by both rules in `resolveRoundWin`, and the short-circuit returns before any push.
- **The mill happens before any candidate seam.** A Leyline reclaim cast in the window cannot affect a loser's runway if the mill has already run. (Note `LOSER_MILL` defaults **false** in the shipped configuration, so this is currently moot — see Open question 3.)
- **A reactive Armor Piercing is silently wasted** unless the window is above the `strips` computation.
- **The window resolves one object at a time, interleaved with resolution.** Under `SPECIAL_LOSS_MODE='all'` at 4 players, seat 1's shield is gone before seat 3 is ever offered priority.
- **Every `roundWinner != null` caller assumes the engine returns a finished round.** `finishPassRound` calls `announceRoundWin(res)` (which reads `res.struck`, `res.kick`, `res.shieldStripped`) and then `resolveRoundCeremony`, which calls `E.roundDraw` — dealing the next round. Eight call sites consume the guard functions' return as a round result, several with `fr||r` fallbacks, and two siblings in `runOpponents` consume `fr` and `res` differently. **A wrong-but-truthy return runs the ceremony on stale data rather than throwing.**
- **`st.turn` is the wrong priority origin.** It points at the last passer.

### What does not break

- **The target is decided before the window, and that is already true.** `st.shieldResponse` is only ever assigned inside `driveShieldStack`, and every path there runs through `applyRoundLoss`, which is reached only after the target set is fixed. The rebuild changes the window's nature, not its position. Two caveats worth putting in front of Aj: on a jab round there is no target for the ordering to be true *of*, and the *strip count* half of "the strike aimed at them" is decided pre-window and frozen — which is symptom 2.
- **`resolveShieldLossObj`, the prevention ladder and the kick branch** are already the right shape for "a shield loss just happens".
- **`finishRoundWin`'s flag expiry** already runs after the drain, so a sprung Sanctuary or Leyline survives until after the strips.
- **`resolveTopEffect`'s counter scan** looks for the nearest `kind === 'effect'`, so a `kind:'fightend'` sentinel cannot be Counter Spelled — which is what §4 requires. Assert it rather than inheriting it.

---

## The kick

**`wasBroken` is captured in the right place and does not need to move.** `resolveShieldLossObj` reads
`var wasBroken = opp.shields <= 0;` on its first line, and that call happens *after* the window closes. A
defender at 0 who gains a shield in the window has `wasBroken === false`, the strip takes the gained shield,
and the kick branch is never entered. That is the whole "works by timing" payoff and it needs no code change.

**What is wrong is that `driveShieldStack` decides what to OFFER from the pre-window board.** `facingKick` is
`opp.shields <= 0 && !top.noKick`, and it is passed to `shieldGuardCard` as `needCantLose`, so at 0 shields the
filter demands `e.cantLose` and Sanctuary is refused. Once a shield gain is reachable inside the window,
*"am I facing a kick"* is not knowable until the window closes — the question is circular. The fix is to stop
asking it at offer time: `facingKick`, `canGuard`, `wouldBeSaved` and `shieldGuardCard` all go, the window
opens unconditionally, and `resolveShieldLossObj` decides kick-versus-strip from the post-window board, which
it already does correctly.

**The comment above `guardEffFor` argues the opposite and must not be carried forward.** It says Sanctuary is
*"correctly still not offered against a kick"*. That is an artefact of the whitelist model. So is `test.js`'s
`ok(E.shieldGuardCard(ga, 0, true) === null, …)`, whose own comment reads *"This is the assertion that stops
the next person 'finishing' the fix by loosening the kick branch."* It is aimed at whoever does this work. It
must be **re-argued with Aj and inverted, never deleted quietly** — see Open question 1.

**One genuine decision that is currently an accident.** `wasBroken` is captured **once per object** and
`resolveShieldLossObj` then loops `obj.n` times. Against an Armor Piercing (`n === 2`) on a defender who gains
exactly one shield in the window: `wasBroken=false`; strip 1 → 0 shields; iteration 2 falls to the
`else if (wasBroken && !obj.noKick)` branch, which is false, and does nothing. **So one Sanctuary blanks a
double strike *and* the kick.** That matches the `// no overkill` comment and Armor Piercing's own card text
(*"never overkills"*), so it is defensible — but it was previously unreachable, because a 0-shield defender
could never gain a shield mid-event. Ship it as a stated decision (Open question 2), not as inherited
behaviour.

---

## Passo and the dropped seat

Passo lives in the template, not `ai.js`: `isPasso`, `passoTakeover`, `maybePasso`, `schedulePasso`,
`passoStep`, `passoLead`. `passoStep` is a flat dispatch on `netReact.kind` — `respond` → `{op:'decline'}`,
`guard` → `{op:'guardPass'}`, `discard` → `{op:'discard', ids:[]}`, `prefight` → `{op:'prefightPass'}`, `loss`
→ an auto pick — ending in a **bare `return;`** with no trace and no log line.

**The semantics need nothing new.** A Fight End window routed as `netReact.kind === 'respond'` is answered by
`{op:'decline'}`, which is exactly "this player passes priority" — the correct caretaker act. Passo's whole
policy is to pass, so a wider window changes what it *could* have done, not what it does.

**Three things do need new code.**

1. **A new kind name is a silent permanent deadlock.** Call the window `'fightend'` or `'priority'` and
   `passoStep` matches nothing, hits the bare `return;`, and the table waits forever — the v1.31.91 wedge
   whose only exit is Concede, a recorded loss. **The park heartbeat cannot save it: a heartbeat re-asserts a
   mirror, it does not answer a window.** RULE: route through `kind:'respond'`, or add the kind to
   `passoStep` in the SAME commit. Add a default branch with a `trace` either way.
2. **Passo is structurally inert in a 2-player duel.** `passoStep` reads only `netReact` and `netParked` and
   dispatches through `hostApplyMoveN`; every duel park sets `netSettle` / `netGuard` / `netDiscard` and
   routes to `hostApplyMove`. The sole exception is `hostParkTrim`, which is shared with the N-player path —
   **and CLAUDE.md's line about Passo answering a discard window generalises from exactly that one site.** It
   is not true of `netDiscard` and not true of any duel window. Today this is dormant because the duel respond
   window is rare; after the rebuild it is the round's normal shape.
3. **`hostSettle` has neither `maybePasso` nor a `$('rivalStatus')` line**, unlike every other park. Both must
   be added or a duel host parks blind every round with no caretaker.

**Test coverage, for scoping:** `nettest_discon3` is the only suite that touches Passo, it is 3-player, and it
asserts one thing — that Passo auto-passed on a *turn*. **No suite has ever asserted Passo answering a
window**, of any kind, and there is no 2-player Passo suite at all.

---

## Netplay and the mirror

### The mirror is a clean removal

`remapSR` dies with nothing added to `mirrorFor`. Field by field, the general path already carries more:

| `shieldResponse` field | replacement | rotated? |
| --- | --- | --- |
| `q` | `respondFor` | yes — `rot(st.respondFor)` |
| `winner` | `pending.winner` | yes — `remapStack` rotates `winner` |
| `obj.target` | `pending.target` | yes |
| `obj.n` | `pending.n` | n/a (count) |
| `obj.source` | `pending.source` | n/a (string) |
| `roundWin` | derivable | the only other shieldloss push sets `source: eff.name` with `noGuard:true` |
| `guardId` | **gone** | the whitelist artefact; the client enumerates its own hand via `eligibleQuicks` |

**Two hard constraints on the sentinel.** `remapStack` does `if (o.eff) c.eff = o.eff;` **verbatim, with no
rotation** — so every seat number goes on the object's own rotated fields (`p` / `origin` / `target` /
`winner`), never inside `eff`; a seat inside `eff` reaches every client unrotated and no DOM assertion can see
it. And `remapStack` rotates a **scalar** `target` only, so a `targets` array needs one added line
(`if (o.targets) c.targets = o.targets.map(rot);`) or the client cannot name who is being struck at 3-6p.

`promptFor` / `snapshotFor` are test-and-legacy surface — the live path is `NetView.mirrorFor`, which is the
template's only call.

### The park question

`startParkBeat()` appears at **eleven** sites today (CLAUDE.md's v1.31.116 note says nine — worth a separate
doc check). The rebuild creates **no new park**; it re-routes four chains into two existing ones:

1. **N-player mid-turn** — `netOppWindow` loses its guard branch; `driveN`'s park already covers `{kind:'respond'}`. Free.
2. **N-player round end** — `hostSettleRoundThenCeremony` must call `hostSettleN` before `hostRunCeremony`.
3. **Duel, client's move ends the round** — `hostAfterRivalMove` must call `hostSettle` before `hostFinishRound`.
4. **Duel/solo, the host's own pass ends the round** — `finishPassRound` / `doPassBody` must settle first.

None of those four has a `hostState.pending` branch today. Without the hop, the engine opens the window and
nothing drives it: `respondFor` set, no park, `busy` false, the host's board live and the ceremony running over
an open priority pass. Every hop must copy the full ritual — `busy=true; render(); reassertMirror();
startParkBeat(); maybePasso(seat);` plus a status line — and every exit through `hostTakeBack()`, which clears
`busy`, `rivalStatus` and `stopParkBeat` together.

### The lost-mirror deadlock — the sharpest risk in the job

**`clientCheckWindow` keys its dedupe as `sig='resp:'+((state.pending.card&&state.pending.card.id)||'?')`.**
A Fight End sentinel has no `card`, so **every Fight End window in the game collapses to the constant
`resp:?`**, and `if(sig===clientWinSig) return;` fires before the modal can open. Two ways that kills a table,
both silent:

- **The park beat cannot heal a lost mirror.** This is an **idle** park — nothing animates at Fight End, so the host renders once, parks, and emits **one** mirror. CLAUDE.md's own measurement is that one lost mirror deadlocks permanently at an idle park (against ~4 at a ceremony park, where the render storm heals it). `startParkBeat` re-asserts identical bytes every 1.8s, the client applies them and early-returns on the matching sig. **`nettest_mirrordrop` reaches only the ceremony parks and will pass on a build that deadlocks here.**
- **It bites with no packet loss at all.** `respond` does `st.stack.forEach(function (o) { o.passed = {}; });`, so one object legitimately re-grants priority to the same seat more than once per round. `oid` alone is therefore **not sufficient** — the key needs a priority generation.

`applyMirrorNow` sets `busy = owedModal || …`, so the symptom is a locked board with no window and no
explanation: two peers in perfect agreement, both waiting. That is the shape `nettest_sync` was structurally
blind to until v1.31.75, and it is indistinguishable from a laggy connection — the report shape this repo has
already misdiagnosed twice. **This is a live bug today**, fixable and provable on the existing window with
nothing deleted, which is why it is step 1.

The other direction has no cure either: `clientSend` is fire-and-forget with no intent retry, so a lost
`decline` leaves `syncArm` painting *"Not synced with the host…"* after 5s while the client cannot re-answer.
The mitigation is the **self-heal**: in `applyMirrorNow`, when `owedModal` is true and no overlay is up,
re-drive `clientCheckWindow`. That turns the beat back into a cure and survives a sig scheme nobody
anticipated.

### Two more, both silent

- **`concede`'s stack filter is `o.target !== seat && o.p !== seat && o.winner !== seat`.** A sentinel carrying `winner` is deleted when the **round winner** concedes mid-window, stranding the round with `st.roundWinResult` set. (There is a sibling pre-existing bug: `concede` nulls `st.shieldResponse` but never re-enters `driveShieldStack`. Both disappear if the window moves to `st.pending`, *provided the sentinel is handled here*.)
- **The wire vocabulary changes, and netplay only WARNS on a version mismatch.** An older peer, or a client that reloaded mid-round, sends `{op:'guard'}` at a host with no arm for it; `hostApplyMoveN`'s whitelist drops it with a `react IGNORED` trace and the host parks forever. Open question 9.

---

## The suites

| suite | classification | what specifically |
| --- | --- | --- |
| `test.js` | **rewrite** | Four `E.shieldGuardCard` assertions. `shieldGuardCard(ga,0,true)===null` (the anti-loosening one) must be **inverted and re-argued**; `shieldGuardCard(gb,0,false)===null` stays true for a **new reason** — base 10♥ is a plain Technique, refused by the Quick test, not by a whitelist. The Hector block and the `shieldAll` assertions are unaffected (they already go through `E.respond`). |
| `netview.test.js` | **rewrite** | Six `shieldResponse` reads plus `'shieldResponse.obj.n': 1` in the declared-public differential map. **The CLAIMS all survive** — the mirror serialises with a window open, nothing aliases host state, the threatened seat reads itself as 0 — only the field changes. Its staging (a real round win against a Leyline holder) is the load-bearing half and is unchanged. `prompt.kind === 'shieldGuard'` changes; check the whole precedence order, do not assume. |
| `nettest_guard.js` | **rewrite** | Spine is `#sgYes` and `{op:'guard'}`. Its CLAIM — a remote seat springs a defensive Quick over the wire and keeps its shield — is the only end-to-end coverage of that path and must survive on `.respQuick` / `{op:'respond'}`. Its staging survives: the host's energy after the force cannot afford a Quick, so `canAddToStack` auto-passes it and the window still opens for the client alone. |
| `browsertest.js` | **repair, before the switch** | Its modal driver ends `return { over: true };` for any unrecognised overlay — so an unhandled Fight End modal makes twelve duels each declare themselves finished a few rounds in and the smoke suite goes **GREEN having tested almost nothing**. Worse than red, because nobody looks. Make it an explicit named failure, then break it deliberately to prove the failure fires. |
| `nettest_sync.js` | **repair, before the switch** | Its `WINDOWS` list is a literal three-entry array; reusing `#respDecline` means it answers the new window for free. Its neighbouring comment (*"only the shield guard and the clean-up pick can actually fire"* at 2 players) goes factually stale. **Also update its stall CLASSIFIER**, not just the list — if it cannot see the window on the host, a real deadlock is misfiled as GENUINELY WEDGED, and that split is the detector's whole value. |
| `nettest_record.js` | **repair** | One defensive `sgNo || respDecline || pfDecline` click in the finish loop. Unaffected if the window keeps `#respDecline`; otherwise it spins its 60 iterations and fails with no hint that a window is the cause. |
| `lessonlib.js` (and `lessontest_howto`, `_energy`, `_twos`) | **repair, before the switch** | Measured in the research: those three each resolve a round with seat 0 holding an affordable Quick. With no handler each burns a full 30s poll. Add ONE shared Respond?-answering helper **with the house retry** — `playAny`, `activateSpot` and `passTurn` were each written without it and each presented as a product bug. **But see *Missing from all*: the tutorials are a product surface too, not only suites.** |
| `nettest_kick.js` | **repair** | Stages the host holding 9♦ — Leyline — in the **winner's** hand. With the winner offered priority, whether a window opens depends on host energy the suite does not control: the exact deal-dependence `nettest_log`, `nettest_full` and `nettest_names` were each fixed for. Stage the energy explicitly. |
| `exporttest.js`, `mptest.js` | **repair** | Bounded loops near a window. Re-check for a bare `for (let i=0;i<N;i++)` driving a board and bound by **unproductive** iterations (the v1.31.85 fix). |
| the ~40 other fight-driving suites | **unaffected, by luck** | They drive `fightBtn`/`passBtn` and answer no window id; most stage hands with `__cmf.force()` and will be fine. "Fine by luck" is the documented deal-dependence, which is why step 3 exists. |
| `analysis.js`, `mpsim.js`, `personasim.js`, `passsim.js`, `roundsim.js`, `rulesim.js`, `stucksim.js`, `twosim.js`, `recyclesim.js`, `optionsim.js` | **unaffected if step 2 lands first** | All reach `respondDecision` through `resolveAIWindows`. One TypeError there kills all ten plus `test.js`'s 300-game loop simultaneously — eleven unrelated-looking reds. |
| `versiontest.js` | **repair** | Asserts suite counts declared in CLAUDE.md, a `### vX.Y.Z` changelog heading, the handoff header and the RATCHET tag sets. A new suite and three changed counts turn it red. Its **own** citation-style comment also names `guardEffFor`; the `file:line` gate cannot see a dead symbol. |
| `quicktest.js` | **repair / extend** | 6 assertions on `eligibleQuicks` under a Form — the closest existing suite to the new window's UI layer, and the right home for the modal-copy and stack-view assertions. |
| `landscapetest.js`, `phonetest.js` | **repair** | The Respond? modal goes from rare to every-round. Gate it at the 340px floor and in landscape. |
| `nettest_narrate.js` | **repair** | Its STATIC half must cover any new `say()` template. Past-tense-does-not-rescue-the-copula has shipped eight times, and the runtime half only sees templates a run happens to emit. |
| `nettest_parkbeat3.js` | **extend** | The `DROPS=n` idiom is the only probe that reaches an **idle** park. Aim a copy at the Fight End park. |
| `nettest_discon3.js` | **extend** | The only Passo suite. Needs a window-answering assertion, and a duel one does not exist at all. |

### New assertions

Ordered by how directly each goes red if the whitelist comes back. **★ = would go red on a reintroduced whitelist.**

1. **★ ADMISSIBILITY AS AGREEMENT, NOT A LIST.** For each of the 52 cards as a lone hand, *"is this seat offered the Fight End window"* must equal `E.canAddToStack` exactly. *Catches:* a whitelist in any form — a re-added `immune || shieldImmune` filter disagrees on ~50 of 52. An assertion that "Counter Spell is offered" is satisfiable by widening a list by one; this one is not. **Requires exporting `canAddToStack`**, or the assertion restates the predicate and becomes the second definition (`isChopOf` / `resolveIds` / `guardEffFor`, fourth time).
2. **★ THE WINDOW OPENS FOR THE WINNER.** The striker holds the ♠7 Armor Piercing (a Quick at base), casts it in the window, and the extra strip **lands**. *Catches:* symptom 2's second half — a build that deleted only the whitelist makes the card legal and inert. Nothing anywhere covers the striker's side today.
3. **★ SANCTUARY BY TIMING, AT THE HECTOR TIER, AT 0 SHIELDS.** The patch is `{quick:true}` alone — no immunity of any kind. Assert the gain resolved before the loss (shields read 2 at 1-shield staging) and that **no Fighter Kick fires** at 0, because `wasBroken` is false. *Catches:* an implementation that closes the window after applying the loss, or recomputes `wasBroken` from a pre-window value. Both look correct and both kill a player who saved themselves. This card state is not covered by `test.js` today.
4. **★ THE WINDOW OPENS ON A JAB ROUND AND ON AN APEX-NO-STRIP ROUND.** *Catches:* a window placed inside `driveShieldStack`, which those rounds never reach.
5. **THE LOSS IS NOT ON THE STACK.** During an open window `st.stack` holds no `kind:'shieldloss'` object, **AND** a seat genuinely holds priority so the negative is not vacuous. *Catches:* a half-rebuild that widens who is offered but keeps the pre-window push — passes every UI suite and contradicts the model.
6. **PRIORITY ORDER AND THE RESET, AT n=3.** Record the offer sequence; require origin-then-turn-order; require a Quick from seat C to re-offer A and B; require the sequence to **restart from the origin** after a mid-window resolution (§2 step 7). *Vacuous at 2 players* — the modulus hides it.
7. **A COUNTER SPELL CAST IN THE WINDOW COUNTERS NOTHING** and the round still resolves. *Catches:* a sentinel typed `kind:'effect'`, where the counter scan marks it and `resolveTopEffect`'s countered branch does `pl.shuffle.push(top.card)` on a null card and a `top.p` that is not a seat.
8. **`respondDecision` NEVER THROWS AND NEVER RETURNS UNDEFINED** for a pending window with no `card` and no `eff`. *Catches:* the destructure, by name, at engine-suite speed instead of as a crash inside 300 games.
9. **AN IDLE-PARK DROP PROBE at the Fight End park**, `DROPS=n`, **A/B'd against `main`** so the pre-fix build is shown to deadlock. *Catches:* the `resp:?` collapse. A probe that passes on both builds proves nothing — three earlier drop probes were thrown away for exactly that.
10. **TWO PEERS AGREE** on who holds priority and who has passed — extend `nettest_sync`, do not add a suite; poll until a transient mismatch clears. *Catches:* the priority set failing to rotate.
11. **THE AUTO-PASS COSTS NOTHING.** With no seat holding an affordable Quick: no modal, no park, no wire traffic. *Catches:* a rebuild that prompts unconditionally — a *prompt* rather than a *window*, the distinction Aj drew explicitly.
12. **THE STACK VIEW SHOWS WHAT IS AT STAKE.** `renderStack` filters to `kind==='effect'`; assert the window renders the pending loss, its target and who struck, not an empty `#stackView`.
13. **A CONCEDE MID-WINDOW LEAVES A LIVE TABLE** — both directions: the winner concedes (the stack filter deletes the sentinel) and the seat holding priority concedes (nothing re-enters the loop).
14. **A CLIENT SEES THE IMMUNITY FLAG FLIP** in the mirror between the window closing and the loss landing. Sanctuary works by timing, so without this the payoff is invisible on every client.

---

## Wall clock

The measured open-rates, per-seat auto-pass rates, park multipliers and suite timings from this research
belong in `docs/DECISIONS.md` and are not restated here — the repo rule is that every measurement lives in
exactly one file. The four things that matter for planning:

- **The auto-pass is genuinely free.** `canAddToStack` is evaluated inside the engine loop; when it is false for every seat, `st.pending` is never set and no layer above the engine learns a window was considered. No render, no modal, no mirror, no wire, no dwell.
- **The single highest-leverage decision for wall clock is to reuse `promptHumanResponse` and keep `#respDecline`.** That is the difference between roughly a +6% loop cost and a suite-by-suite stall hunt, and it needs no `netview.js` change.
- **The AI's Fight End cast rate is the largest wall-clock variable in the whole change**, by an order of magnitude, through `settleWindows`' 1400ms dwell. It is a design choice, not a performance one — which is why step 10 ports the old one-line rule verbatim and step 14 changes it separately, against an otherwise-settled build.
- **If wall clock ever becomes the reason to reduce this window, the lever is the dwell, not the window's existence.** Skipping the window changes the rules; shortening a dwell does not. And a *second* skip predicate — "nothing is at stake here" — is the `guardEffFor` mistake in a new costume: a narrower second definition of "may this player act", wrong in a direction that looks like a safety check.

---

## The three standing defects, and what their severity actually is

These three exist in `main` today; the rebuild does not create them. Each was re-checked against the
**shipped configuration** before being scheduled, because the first framing of them — *"live bugs, fix them
on main first"* — did not survive contact with the code. Aj folded them into the epic once the severity was
accurate. **Do not re-derive any of this; that is the whole point of writing it down.**

**1 · `noopDestroy` — a rules deviation, not a wrong outcome. Owned by step 13.**
It suppresses the ENTIRE priority window whenever the named target sits at 0 shields. In the shipped game the
*outcome* is nonetheless right: every `destroyShield` push carries `noKick` and `noGuard`, so the effect
genuinely is a no-op against that seat. What is lost is the window itself — nobody may cast any Quick at that
moment — which is a fault in the model, not in the arithmetic.
The half that DOES produce a wrong outcome needs several struck seats, i.e. `DAMAGE_SPAN > 1` or
`DAMAGE_ALL` — and **neither is wired to the custom rules menu** (grep `setDamageSpan` in the template: no
hits). So no player can reach it; only sims and probes can. That is precisely why this is a step-13 deletion
and not a `fix/` on `main`.

**2 · The discarded `sres` — real, latent today, load-bearing inside this epic. Owned by step 13, asserted in step 11.**
`struck` / `prevented` / `spared` are computed for a mid-turn `destroyShield` and binned. Nothing reads them
on that path today: `settleWindows` does not, the activation handler does not, and `buildPreDrawBeats` — the
one site that does read `struck` — is the ROUND-WIN path, which never enters `openResponseWindow`. Hence no
symptom in `main`.
It stops being latent here, because the rebuild routes shield loss through that same return. And it carries a
**design** question rather than only a fix: once the result reaches the caller, `holdShields` reads
`res.shieldStripped`, so a mid-turn Critical Hit would start playing the shield-shatter beat it does not play
today. Improvement or surprise depending on intent — **Open question 12**.

**3 · `clientCheckWindow`'s window signature — plausible, unproven, and step 1 IS the experiment.**
A response window is keyed `'resp:' + pending.card.id`, and `respond` resets the passed set on **every**
object, so a seat that already passed on object X is legitimately re-granted priority on X after anyone adds
a Quick. If no intervening mirror reaches that client showing a different window (or none), the signature is
unchanged, `clientCheckWindow` returns early, and the modal never re-opens — an owed window silently
swallowed, which at a park is a permanent deadlock.
**Whether it reproduces without a dropped mirror is NOT established.** The intermediate state differs, so it
should normally broadcast. Do not report this as live until step 1's drop probe has run at `DROPS=0..4`
**and** the same probe has been A/B'd against `main` via `git show` — the idiom `nettest_parkbeat3` and
`nettest_mirrordrop` already use. This repo has twice recorded a "flake" that was the environment and twice
recorded one that was real; the probe settles it either way, and reasoning does not.

## Commit sequence

Fifteen small commits, not fifteen version bumps. **Group them into PRs before starting** — the repo rule is
one version bump per PR and the PR title IS the changelog heading, and the grouping decides what a revert
actually reverts. A defensible split: 1-4 (prerequisites), 5-9 (the machine, flag off), 10-11 (AI + suite),
12-13 (the switch and the deletion), 14-15 (policy and docs). Every commit ends with
`node build.js && cp CardmenFighter.html ../CardmenFighter.html` and a clean `git status`.

**1 · fix: a priority window's identity survives being re-granted.**
Re-key `clientCheckWindow` on `pending.oid` **plus** a priority generation (`st.prioGen`, bumped wherever
`respond` resets the passed sets and wherever a window opens), projected as a named scalar in `mirrorFor`
beside `respondFor`. Add the self-heal in `applyMirrorNow`. Ship the drop probe. **This is a live bug today**
and lands with nothing deleted.
*Files:* engine.js, netview.js, CardmenFighter.template.html, netview.test.js, a new `nettest_priosig.js`.
*Gate:* `npm test` — netview.test's declared-public differential firing on `prioGen` is it working. The full
netplay sweep. The probe at `DROPS=0..4` **and** the same probe against `main` via `git show`, to prove the
pre-fix build deadlocks. *Revertable alone:* **yes**.

**2 · fix: every priority consumer tolerates a cardless object, staged and asserted.**
Four sites throw on the first Fight End window, in four layers: `openResponseWindow`'s `top.eff.kind` read
before any kind check; `resolveTopEffect`'s `st.players[top.p]`; `ai.js` `respondDecision`'s
`var eff = pend.eff` followed by `eff.kind`; and the template's `promptHumanResponse` / `humanResponds`
`E.effectOf(pend.card)`. Fix each **and prove it** by staging a synthetic cardless `st.pending`: require
`respondDecision` to return rather than throw, the object to survive `JSON.stringify(st)` and a
`NetView.mirrorFor` round trip, and the Respond? modal to render. `eligibleQuicks` needs no change — it reads
only the hand.
*Files:* engine.js, ai.js, template, test.js, netview.test.js, quicktest.js.
*Gate:* `npm test` with the staged cases; quicktest; nettest_counter; nettest_react3; **`nettest_guard`
untouched and green** (that is how you know nothing leaked early); browsertest; full sweep.
*Revertable alone:* **yes**.

**3 · test: harnesses learn to answer a Respond? window.**
`lessonlib.js` shared handler with the house retry; `browsertest`'s fall-through becomes an explicit named
failure; `nettest_sync`'s `WINDOWS` list, stale comment and stall classifier. A no-op today.
*Files:* lessonlib.js, browsertest.js, nettest_sync.js, nettest_record.js, exporttest.js, mptest.js.
*Gate:* full sweep, **assertion counts UNCHANGED** — this step must be provably inert. Then break
`browsertest` deliberately with an unknown overlay and require the new failure to name it.
*Revertable alone:* **yes**.

**4 · fix: instrument, then delete, the dead mid-turn shield-guard path.**
Every `destroyShield` push carries `noGuard: true` and is the only other `kind:'shieldloss'` push, so
`driveShieldStack`'s window is already fight-only, `sr.roundWin` is a constant `true`, and
`openShieldGuardModal`'s non-roundWin branch, `hostRivalContinue`'s guard branch, `driveRival`'s mid-turn
branch and three `ai.js` gates are all likely unreachable. **A grep is not a reachability test** — this repo
has three recorded cases of an orphaned path reading as live for many versions. Add a dbg-gated counter to all
six, run one full sweep, confirm zero, then delete.
*Files:* ai.js, template. *Gate:* full sweep with the counters; `mptest` as the cheapest post-deletion UI
canary. *Revertable alone:* **yes**.

**5 · refactor: one seam, behind `setFightEndPriority(false)`.**
`enterFightEnd(st, winner, wonWithCombo, strikeTargets, winSize)` becomes the target of both `resolveRoundWin`
and `chooseLossTarget`; `applyRoundLoss`'s body becomes `applyRoundLossBody(st, ctx)`. With the flag off,
`enterFightEnd` calls the body directly and behaviour is identical. Add `st.fightEndResult` and a reader — the
replacement for the eight `cont(fr)` closures — before anything depends on it.
*Files:* engine.js. *Gate:* `npm test` printing **identical** counts; `analysis.js` and `mpsim.js` inside
their bands (a behaviour-identical refactor that moves a win rate is not behaviour-identical); full sweep,
expected no-op. *Revertable alone:* **yes**.

**6 · feat(engine): the sentinel and a parameterised origin, unreachable.**
`FIGHTEND_EFF` as a **static, seat-free literal**; `newFightEndObj`; `openResponseWindow`'s `while` admits
`'fightend'`; the walk takes `origin`/`k0` from the object so existing objects are byte-identical;
`resolveTopEffect`'s early branch. **Export `canAddToStack`.** Nothing mints a sentinel yet.
*Files:* engine.js, test.js. *Gate:* `npm test`, `netview.test`, `sweep:fast`. *Revertable alone:* **yes**.

**7 · test: the shadow comparator, flag still off.**
With the old model live, record both answers wherever `driveShieldStack` would open the window and assert over
N live AI games at 2/3/6 players that the new model's offer set is a strict **superset** of the whitelist's,
and that no seat is offered whom `canAddToStack` refuses. The only artefact that can say the migration is safe
*before* it happens. Costs nothing in the shipped build.
*Files:* engine.js, test.js. *Gate:* `npm test`, `sweep:fast`. *Revertable alone:* **yes**.

**8 · fix: route round resolution through the settle funnel, and fix the park hygiene.**
Insert the `hostSettleN` / `hostSettle` / `settleWindows` hop above the existing `shieldResponse` branches in
`hostSettleRoundThenCeremony`, `hostAfterRivalMove`, `finishPassRound`/`doPassBody` and both `runOpponents`
siblings — provably dead inserts with the flag off. Same commit: `hostSettle` gains `maybePasso` and a status
line; `settleWindows` gains the `isClientActive()` guard **at the funnel**.
*Files:* template. *Gate:* full sweep (the inserts must be inert), plus nettest_roundstall, nettest_clientwin,
nettest_discon3. *Revertable alone:* **yes**.

**9 · feat(ui): the window says what is at stake.**
`promptHumanResponse` gains a null-safe lead and Fight End copy that ports v1.31.120's framing (striker seat +
combo type, via `logName`); its Quick-button loop switches to `effectFor` and carries `boosted`/`boostTier` so
the *(empowered by your Super)* note survives; `renderStack` shows the pending loss; `driveN`'s
`' may guard…'` becomes copy that reads correctly at Fight End; `remapStack` gains the `targets` rotation.
*Files:* template, netview.js, netview.test.js, quicktest.js, nettest_narrate.js. *Gate:* quicktest;
nettest_narrate's static half; landscapetest and phonetest at the 340px floor and in landscape.
*Revertable alone:* **yes**.

**10 · ai: a Fight End branch that changes nothing.**
An explicit early branch in `respondDecision` on the window kind, whose policy is a **verbatim port** of
`shieldGuardAI`'s rule (spring an immunity at ≤2 shields, else pass), keeping the `isHuman` suspend and the
`effectsAllowed` / `kindOK` gates. Rename the `immune || shieldImmune` test `immunityEffFor`.
*Files:* ai.js, test.js. *Gate:* `npm test`; every sim runs to completion; `analysis.js` in band.
*Revertable alone:* **yes**.

**11 · test: `fightendtest.js`, run against the flag ON while the default is off.**
Assertions 1-8, 11-14 above. **Run it 40 times, not once** — two flakes hid in one green run the last time
this AI surface was touched.
*Files:* a new `fightendtest.js`, sweep.js, CLAUDE.md's suite table. *Gate:* 40 clean runs; `npm test`; full
sweep. *Revertable alone:* **yes**.

**12 · flip `FIGHT_END_PRIORITY` on, and gate the old window off in the same commit.**
**Non-negotiable:** the flip must also gate `driveShieldStack`'s window branch behind `!FIGHT_END_PRIORITY`.
Otherwise both windows open in the same round, the table gets two prompts for one decision, and no red run can
tell you which window it was looking at. Gated this way the flag flips the whole model atomically in both
directions and a revert is one boolean.
*Files:* engine.js. *Gate:* full sweep at `-j 4` **and** `-j 1`; `fightendtest` ×20; the idle-park drop probe
re-aimed at the **live** Fight End park; `nettest_sync` reporting neither HARNESS GAP nor TIME-CAPPED; one
**real solo game** and one **two-device netplay game** (see *Missing from all*). *Revertable alone:* **yes** —
one boolean.

**13 · refactor: delete the whitelist model.**
Everything in the DELETE table. Rewrite `test.js`'s four assertions, `netview.test.js`'s six plus the
declared-public entry, and `nettest_guard` onto `{op:'respond'}`. Move `remapSR`'s block comment onto
`remapStack`.
*Files:* engine.js, ai.js, netview.js, template, test.js, netview.test.js, nettest_guard.js.
*Gate:* `grep -i` every removed identifier across `code/` and `docs/`; CLAUDE.md's duplicate-function grep and
the `__cmf`/`NET` object-literal duplicate-key awk; `mptest` as the UI canary (it caught the v1.31.71 deletion
on its third assertion); full sweep. *Revertable alone:* **yes**.

**14 · feat(ai): a real Fight End policy, then measure.**
Build from `bestQuick` widened to a predicate and `aiPreFightLock`'s shape. Severity from the board (target's
shields, kick-or-not, strip count, am-I-the-winner), not from `THREAT_KIND`.
*Files:* ai.js, test.js, fightendtest.js. *Gate:* **three `personasim` CONTROL runs first** to re-establish the
noise floor before reading any spread; then `analysis.js` and `mpsim.js` with the resolved-CONFIG line read,
not assumed; browsertest **timed** before and after; full sweep in band. *Revertable alone:* **yes**.

**15 · chore: remove the flag, and close the docs.**
Delete `FIGHT_END_PRIORITY` and `setFightEndPriority` — a mode flag left behind after the model settles is the
`REWORK` shape this repo deleted once already. Then: README `**Status:**`, a `### vX.Y.Z` heading in
`docs/CHANGELOG.md`, the handoff header, CLAUDE.md's suite-count table, and the **dead-symbol tombstones** —
`guardEffFor`, `shieldGuardCard` and `wouldBeSaved` are named in CLAUDE.md, `docs/NEXT-SESSION.md` and
`versiontest.js`'s own citation-style comment, and the `file:line` gate cannot see a dead name. Close
CLAUDE.md's three-remaining-`effectOf`-label-sites note, since this work fixes one of them. Route by the
CLAUDE.md table: measurements → `DECISIONS.md` (dated, and re-taken after step 14 rather than carried
forward); remaining levers → BACKLOG with `RATCHET:` tags on both sides; rules → CLAUDE.md.
*Files:* engine.js, README.md, docs/CHANGELOG.md, docs/NEXT-SESSION.md, docs/DECISIONS.md, CLAUDE.md,
versiontest.js. *Gate:* `node versiontest.js`. *Revertable alone:* **yes**.

---

## Open questions for Aj

Rules only. Everything the code could settle has been settled above.

1. **Does the Fighter Kick restriction survive?** Today at 0 shields only `cantLoseRound` or a Holy Shroud
   absorb stops the strike, and `test.js` carries an assertion whose comment names whoever does this work.
   Under a true priority window any Quick may be **cast**, so a Hector-Sanctuary is cast, gains a shield, and
   `wasBroken` is false — no kick. **That makes plain shield-gain effectively kick-proof by timing.** Intended,
   or must a gain still fail to save a player at zero?

2. **One Sanctuary blanks BOTH strips of an Armor Piercing and the kick.** `wasBroken` is sampled once per
   object while the loop runs `obj.n` times. It matches the card's own *"never overkills"* text, but it was
   previously unreachable. Confirm the rule, or say the second strip should re-read the board.

3. **Does the mill move below the window?** §3 says priority passes before *anything* happens, and the mill is
   a Fight End outcome (§3: *"a Jab win banks energy"*). Putting the window above it lets a Leyline reclaim
   change a loser's runway before they are milled. **`LOSER_MILL` currently defaults false**, so in the shipped
   configuration this costs nothing today — but the rule is off, not absent.

4. **Who gets priority first when there is no active player?** The plan seeds the walk at the **round winner**
   (`st.lastPlayer`), in turn order, which is the only reading consistent with §1 and is what makes reactive
   Armor Piercing reachable. Alternatives: the struck seat, or the seat after the last to pass. (`st.turn`
   points at the last passer and is the one clearly wrong answer.)

5. **Plain Sanctuary stays refused.** Base 10♥ is `type:'Technique'` with no `quick`; it becomes castable only
   under the ♥ King or Apollo. The King tier is the cleanest demonstration of *timing, not a new rule* — but if
   *"Sanctuary should work"* was meant to include the unboosted card, that is a **data change** (`quick` on the
   base effect) and a different decision.

6. **One window per round, or one per struck seat?** Under `SPECIAL_LOSS_MODE='all'` today,
   `driveShieldStack` opens one per object and resolves object 1 before offering object 2 — so at 4 players
   seat 1's shield is gone before seat 3 is asked. §3 reads as ONE window and that is what this plan builds,
   but it changes who can protect whom.

7. **Rebuild the pre-fight window in the same pass?** Identical defect one phase earlier: `preFightHolder`
   offers to exactly one seat and gives up on that seat's single pass, and `eligiblePreFightQuicks` narrows to
   a whitelist of one kind. The engine's own comment above `preFightHolder` files it. Leaving it turns a
   two-model engine into a three-model one; doing it roughly doubles the blast radius.

8. **Is Passo meant to pass Fight End priority, or spring an immunity for the seat it covers?** Today it takes
   the hit. Passing matches its never-initiates charter, but it means a disconnected player's Leyline never
   saves their last shield from a kick. **Related and separate:** should a Passo-held seat be *offered* the
   window at all, given each offer costs a park, a full-snapshot `reassertMirror` and a fixed 450ms — and is
   that 450ms a wanted readability beat, or incidental (it was sized for turns, which happen once a round)?

9. **Wire tolerance.** After the deletion, keep no-op arms mapping the dead `guard`/`guardPass` ops onto
   `decline`/`respond` for one version, or let them be dropped? Netplay **warns** on a version mismatch rather
   than refusing, so a dropped op is a silent permanent park on a real table.

10. **How often should an AI seat CAST rather than pass here?** There is no existing model to reach for —
    `THREAT_KIND` is keyed on a pending effect's kind and there is no effect at Fight End. This decides how the
    rebuild *feels* more than any UI copy will, and it is also the largest wall-clock variable in the change.

11. **The tap cost.** For a player holding one affordable Quick all game, this is a *prompt* every round, not
    an invisible window — and the answer will almost always be "pass". Do you want an ergonomic mitigation
    designed alongside it (an inline "you may respond" affordance rather than an overlay, a one-tap pass, a
    remembered *auto-pass unless I am struck*), or should it ship as a modal and be judged in play? **None of
    these touches the rules.**

12. **Should a mid-turn Critical Hit play the shield-shatter beat?** Fixing the discarded `sres` (standing
    defect 2) makes `res.shieldStripped` reach the caller, and `holdShields` keys the shatter off it — so a
    Technique's shield loss would animate the way a round loss does. Arguably what should always have
    happened; also a visible change to a card people have played for months. Yes, no, or a quieter beat of
    its own?

---

## Where the judges disagreed, and where this plan disagrees with them

- **Which plan wins.** The correctness judge chose *strangler* (9 v 8), the fidelity judge chose *risk-first*
  (8.5 v 7.5). Aggregate is a tie. This plan takes the strangler **spine** — the flag, the shadow comparator,
  the `origin` field, and the property that no commit before the flip leaves a broken tree — with risk-first's
  **ordering** for commits 1-3 and its UI-before-the-switch and phone gates. Both judges' graft lists asked for
  exactly this, so the disagreement is smaller than the scores suggest.
- **The sentinel's `kind`.** Strangler used `kind:'effect'`; the correctness judge showed that
  `resolveTopEffect`'s counter branch then marks it, and its countered path does `pl.shuffle.push(top.card)`
  with a null card and a `top.p` that is not a seat — a round-killing bug. The fidelity judge's
  `kind:'fightend'` avoids it by construction. **This plan takes `'fightend'` and asserts the immunity
  anyway** (new assertion 7), because protection by construction that nobody wrote down is the shape the next
  tidy-up removes.
- **`reorderEnergy`.** The fidelity judge lists "the window now blocks energy reordering every round" as
  missing from all three, and cites CLAUDE.md's SORT rule. **This plan disagrees on both halves.**
  `reorderEnergy` is already gated `p !== st.turn`, so at Fight End it is refused for every seat but the last
  passer regardless; the new exposure is one seat for the window's duration. And the SORT rule is about a
  view-only reorder that touches no state, whereas `reorderEnergy` mutates the pile a resolution may be
  reading — the existing `st.pending` guard exists for that reason and extending it to this window is correct,
  not a regression.
- **`THREAT_KIND` completeness.** Two of the three plans claimed `test.js`'s kind-completeness sweep would
  name an unfiled `fightend` kind. **Verified: it will not** — the sweep enumerates kinds by calling
  `effectOf` over the 52-card set, and a synthetic kind on a sentinel is never produced by a card. If the
  window carries a kind the AI branches on, that assertion must be extended **by hand** or the branch ships
  unclassified and unnoticed.
- **The tutorials are a product surface, not only suites.** Both judges' suite sections stop at
  `lessonlib.js`. Three lessons resolve a round with the player holding an affordable Quick, so a real player
  mid-lesson gets a Respond? modal the script never mentions — on a surface where a step's `only:[…]` can
  disable Fight and Pass but **cannot disable a modal**, and where spending a Quick burns a card a later step
  needs (Aj broke "The 2" in ninety seconds by playing the wrong card). Either the tutorial runtime auto-passes
  this window, or every gated step gains a Quick allowance. Neither is planned; it belongs in step 9 or its own
  commit and it needs Aj's call, which is why the tap-cost question is Open question 11.

---

## What this run cost

20 agents, 4,129,814 subagent tokens, 424 tool uses, 56 minutes wall clock. Three file-partitioned
inventory lenses, five question agents, an adversarial refute pass over the high-risk sites and the
low-confidence answers, three independent designs, two judges, one synthesizer.

The verify fan-out was capped by SELECTION rather than one-verifier-per-finding, which is what took a
2026-09-08 run to 78 agents and 12.1M tokens against a ~12-agent estimate.
