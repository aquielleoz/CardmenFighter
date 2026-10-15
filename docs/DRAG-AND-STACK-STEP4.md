# Drag-and-stack step 4: the inventory

*What step 4 of [`DRAG-AND-STACK-DESIGN.md`](DRAG-AND-STACK-DESIGN.md) (answering on the board) has to change, surveyed
before building it. Run 2026-10-15 at Aj's go-ahead as a multi-agent inventory (`wf_4a60160f-f5c`: five readers, a
completeness critic, a synthesizer; about 3.05M subagent tokens). It is a MEASUREMENT of the epic at `dbbe80d` and
ages with it: re-check a symbol before building against it.*

**Checked by hand after the run, and one claim narrowed.** The headline claim that the engine accepts the wrong op in a
window holds **on your own turn**: holding priority over a two-deep stack (your Technique, the Rival's Leyline on
top), `E.pass` returns `transition:'play'` and sets `st.toPlay` instead of refusing, so a Main → Fight crossing is
grafted onto the open window. **On the Rival's turn it refuses** (`"Not your turn."`), measured the same way.

**Question 1 below is answered: ruling 21** (Aj, 2026-10-15). In AUTO a cast on the board passes priority for you,
exactly as today ("no stake, no stop"), and ON is the mode for stacking your own spells. That is the inventory's
option (a), its default. Questions 2-9 are open and carry defaults.

*A read-only survey of the epic at `dbbe80d`, taken 2026-10-15. Four readers covered the solo answering path,
netplay, the board controls and the lessons. A fifth counted the tests, and a critic checked every claim against
the code. Engine behaviour marked "measured" comes from read-only node probes of `engine.js`. Nothing in the
page was run.*

The short version:

- **No new intent is needed.** A board cast in a window is `{op:'respond', id, coid, pitch, target}`. Pass and
  No are `{op:'decline'}`. Yes sends nothing.
- **Every board entry point is wrong in a window today.** Each one either sends the wrong op or is silently
  gated off.
- **The engine does not refuse the wrong op during an ordinary stack window.** It accepts it and grafts a
  Main → Fight crossing onto the open window (measured). So sending Pass to `humanDeclines` fixes a real bug.
  It is not just a wording change.
- **The board needs the `(g, cont)` pair that `promptHumanResponse` was given.** Today that pair exists only
  inside the box's button closures.
- **Two lines in the design doc's Traps section are wrong.** `busy` is not true in every window you answer. netwindows
  reaches 64 suites, not 63: 55 through `nettest_lobby`, not 54. Corrections are below.

### What has to change

#### Solo answering: `promptHumanResponse` and its funnels

- **`promptHumanResponse`, its entry and `cont` default.**
  - Today: one builder serves solo, the host's own seat and a guest. With no `cont`, it resumes the AI driver
    (`resumeRival(g)`).
  - Change: it can no longer finish inside the box. Yes saves an answer record, e.g.
    `answering={g, cont, prioGen, timing, sig}`, and the board's ⚡, Pass and drops finish it later. The record
    is one-shot: clear it before calling `cont`. A record with a stale `prioGen` refuses and reports; it never
    runs an old closure.
- **The cast-hold deferral (ruling 20).**
  - Today: while `castHolding()`, it renders, then re-prompts after the hold if `respondFor` is still `YOU`.
    Otherwise solo and the host call `cont`, and a guest does nothing.
  - Change: none. A board cast starts the hold too (`humanResponds` → `presentOwnCast` →
    `presentStackArrival` → `startCastHold`), so the next prompt waits the same way. The answering branch in
    `updateActions` must sit below `castHolding`.
- **`pend`, `rivalEff`, `rivalName`.**
  - Today: the box names the object by its base effect (`E.effectOf(pend.card)`). The stack object and its
    column caption use the caster's boosted `eff`.
  - Change: read `pend.eff`, so the box and the visualizer cannot describe one object two ways.
- **`promptTiming`.**
  - Today: it checks the boundary first (`upkeep`, `endcleanup`, `cleanup`, `resolution`). Then it uses
    `respond` for an object and `prefight` for the objectless crossing.
  - Change: none. Store the value in the answer record; the sentence, Pass's label and the new ledger lines
    need it. `declineLabel` checks the object first on purpose, so do not unify the two.
- **`eligible`, `quicks`, and the four ledger outcomes.**
  - Today: `eligible=eligibleQuicks()` is the engine's answer. `quicks=promptedQuicks(eligible, promptTiming)`
    only decides whether to stop you.
  - Change: the glow comes from `eligible`, never from `quicks`. Add ledger lines for Yes, a board cast and a
    board Pass. Without them a saved log cannot tell a board answer from a box answer.
- **The `AUTO-PASSED for you` ledger line.**
  - Today: in AUTO it points the reader at *"card reader → 'Ask me to respond…'"*. That control was retired on
    2026-09-30, and this line is the only place the string survives. The own-cast exemption covers only the
    `respond` timing, so an AUTO auto-pass after your own cast at a boundary is logged as `PROMPT OFF`, not
    `YOUR OWN CAST`.
  - Change: fix the wording when the new ledger lines go in.
- **The OFF-mode suppressed-stake `logMsg`.**
  - Today: in OFF, with a staked card in hand, it logs that you passed with a shield at stake.
  - Change: none. OFF never shows the box, so board answering cannot happen in OFF.
- **The auto-pass branch (`!quicks.length`).**
  - Today: a guest sends `{op:'decline', auto:true}`. Solo and the host call `E.declineResponse` and then
    `cont()`, silently.
  - Change: none unless the AUTO ruling changes it, and this is where that ruling bites. After a board cast,
    priority returns to you (the controller), the settle calls `promptHumanResponse` again, and in AUTO
    `promptWanted` passes for you.
- **The `clientNotReady` guard.**
  - Today: it says "Connecting to the host…" and returns without calling `cont`.
  - Change: copy it into every new board entry point that answers, as `humanResponds` and `humanDeclines`
    already have it.
- **`caster`, `aimed`, `aimTxt`.**
  - Today: names the caster. For `HOSTILE_SINGLE` kinds it names the aim via `E.effectTarget` ("at YOU" /
    "at X").
  - Change: kept in the sentence. There is an unmeasured risk; see the Hermes trap.
- **The lead sentence.**
  - Today there are six leads:
    - a trigger ("about to lose a counter");
    - an object ("X cast Y at Z. Play a Quick in response, or let it resolve.");
    - Resolution with no Special or no target;
    - Resolution striking you (the FIGHTER KICK line at 0 shields);
    - Resolution striking others;
    - the generic "You have priority. Play a Quick, or pass."
  - Change: this is what the small box keeps. Reword the "Play a Quick in response…" endings to point at Yes and
    the board. The objectless windows (prefight, Clean-up, End of Clean-up, Upkeep with no tick) all fall back
    to the generic line. Name the moment there, with the words `declineLabel` already uses.
- **`respNotYou` for an object aimed at someone else.**
  - Today: *"It does not target you — countering only helps X."*
  - Change: name no card, e.g. "a Quick here only helps X". After Yes every castable Quick glows (Leyline is
    castable in the same window, measured), and once the buttons are gone this sentence is the only description
    of the choice.
- **The Resolution `respNotYou` and `pendingLossLineHTML(stackPendingLoss())`.**
  - Today: the "You are not struck" line, and ruling 18's "When the stack clears, … lose(s) a shield".
  - Change: both stay. Neither function has another caller.
- **The `.respIncoming` block.**
  - Today: the incoming card's name, symbol and rules text, or the trigger's text.
  - Change: needs a ruling (Questions). The card is now in the visualizer and the reader.
- **The `.respQuick` buttons and their `data-*` attributes.**
  - Today: one button per play, deduped by rank+suit, from exclusive branches:
    - Counter Spell with more than one `E.counterTargets` target (`data-coid`);
    - `E.respondChoices` seats (`data-tseat`) or Equipment (`data-tequip`);
    - a pitch with more than one `E.pitchCands` (`data-pitch`);
    - otherwise a plain `data-id`.
  - Change: deleted from the box. Each branch becomes a board stager: a stack card; a rival panel or your own
    Equipment; the Broadway pick; or no choice, so ⚡ casts. Choice detection must reuse these predicates, not
    Main's `castNeedsChoice`. The dedupe goes away, since every copy glows. The stagers should compose a target
    with a pitch, as Main's `activate` already does through `_opts`; the box's exclusive branches never could.
- **The tutorial dead-end guard (`tutNeedsCounter`).**
  - Today: when `tutAwaitCounter && TUT.isActive()`, a note says "tap Counter Spell", and `#respDecline` renders
    disabled but visible.
  - Change: No is disabled and Yes stays live. The board's Pass is disabled in that window too, with a visible
    hint. Reword the note to "press Yes and cast Counter Spell".
- **`#respDecline`, `peekBtnHTML`/`wirePeek`, `showModal`.**
  - Today: the decline button calls `humanDeclines(g, cont)`, and Peek calls `enterPeek`.
  - Change: the box becomes the heading, the sentence, Yes and No.
    - Keep `id="respDecline"` on **No**.
    - Give Yes a new id, and not the `.respQuick` class.
    - Delete `peekBtnHTML` and `wirePeek`; their only caller is here.
    - Keep `enterPeek`: `#reviewBtn` and `__solo.peek` use it.
- **`humanResponds(g, quickId, cont, coid, pitch, target)`.**
  - Today: a guest hides the box and sends `{op:'respond'}`. Locally it calls `E.respond`. On success it runs
    the flash, `presentOwnCast`, narration, the ledger, `tutAwaitCounter=false`, `TUT.note('respond')`,
    `render()` and `cont()`. On refusal it calls `setMessage` and returns with the window still open.
  - Change: it becomes the ONE funnel for every board cast in a window: ⚡ (`#ctxBtn`, `#cardActivate`, the
    staged ⚡), the column drop, and every picker confirm.
    - Consume the answer record before calling `cont`.
    - After a send, clear `selected`, `staged`, `targetPick`, `pick` and `targeting`.
    - On refusal, keep the record so the player can still pass.
- **`humanDeclines(g, cont)`.**
  - Today: a guest sends `{op:'decline'}`. Locally it calls `E.declineResponse` (the result is not checked),
    then `say('{who} let it resolve.')`, `render()`, `cont()` and `TUT.note('decline')`, and then the dead
    lesson's retry.
  - Change: No and the board's Pass both call it with the stored pair. They call it once, and only while
    `state.respondFor===YOU`. The retry is deleted (Lessons).
- **`quickLabelFor(id)`.**
  - Today: names a hand card by `effectFor` for the guest's ledger line.
  - Change: reuse it for the new board ledger lines.
- **`declineLabel()` and `ACTION_ICONS`.**
  - Today: `declineLabel` names the moment: "Let it resolve", "Let the counter come off", "Start the round",
    "End the round", "Let the round resolve", "Move to the fight". None of the six is in `ACTION_ICONS`.
  - Change: it labels Pass while you hold priority (ruling 4). Add an icon entry for all six (⏭). Without one,
    `setActionLabel` makes the whole sentence the phone's 17px icon, and the action row overflows.
- **`eligibleQuicks()`.**
  - Today: the hand filtered by `E.canCastQuick`, which checks `effectFor`, affordability without the Ride
    delta, the pitch, a legal target and lockout.
  - Change: it becomes the glow's source, recomputed on every render while you answer. `E.castRefusal(state,
    YOU, card)` is exported and gives the reason a card does not glow, for the ⚡ title and `#dropHint`.
- **`promptWanted`, `promptDefault`, `promptedQuicks`, `lessonNamesWindow`, `lessonAllowsWindow`.**
  - Today: in AUTO, `if(timing==='respond' && state.pending.p===YOU) return false` passes you over your own
    cast.
  - Change: none unless the AUTO ruling changes it; that line is where it would change. `nettest_autopass` and
    `prompttest` pin today's behaviour.
- **`shieldSaveOverride`.**
  - Today: forces the box open when `E.stakeFor` finds a stake. OFF overrides it. Its timings are a closed set:
    resolution, respond, prefight and cleanup.
  - Change: none. A forced box's No is now a one-tap shield loss, as "Let it resolve" was.
- **`tableContextHTML()`.**
  - Today: the box's copy of the board ('On the table', 'Your energy', 'On the stack'). It hardcodes "Rival’s".
  - Change: delete it; the box is its only caller. `nettest_priosig`, `resolutiontest_ui` and `quicktest` read
    its text.
- **`stackRowsHTML()` and `stackObjPhrase(o, isTop)`.**
  - Today: `stackRowsHTML` is called only from `tableContextHTML`. `stackObjPhrase` also captions the column.
  - Change: `stackRowsHTML` dies with its caller, and `stackObjPhrase` stays the one definition. Three places
    still name `stackRowsHTML`: `stackrowtest`'s header, CLAUDE.md's `stackrowtest` line and the
    `stackObjPhrase` comment.
- **`settleWindows` and its two human branches.**
  - Today: it drains the AI seats, then calls
    `promptHumanResponse(g, function(){ settleWindows(g, done); })` when you hold priority. Its callers:
    `activate` (twice: the transform and the tail), `doRemove`, `boundaryThen` (inside the round ceremony),
    `runRival`, `drainStrandedWindow`, `drainResolution`, `moveToPlayThen` and `tutCastRivalTech`.
  - Change: none. Nothing advances while you browse the board after Yes, which is correct. Because of
    `boundaryThen`, board answering also happens at Upkeep and Clean-up, under the ceremony's banners.
- **`doCounterfeit` and `rivalMayRespond`.**
  - Today: the only cast continuation that never calls `settleWindows`. It calls `rivalMayRespond`, which
    answers seat 1 with `AI.respondDecision`, and then `render()`. So a Counterfeit's window never reaches
    `promptHumanResponse`, and `NET.hostAfterOwnCast` never runs.
    - Measured in the engine: with ♦9 in your hand, the Counterfeit leaves `respondFor 0` and no box opens.
    - Measured: with ♦4 on seat 1, the AI's answer closes the window.
    - On a host, the AI answers for the remote human.
    - At 3-6 players, a window owed to seat 2+ is left open.
  - Change: route it through `settleWindows` like the other tails. Step 4 has no answer record for this window
    until then. The gap exists on `main` unchanged (`rivalMayRespond(eff.name)` is there), so by CLAUDE.md's
    routing test it is `main` work, but it bites step 4 regardless. `grep 'settleWindows(gen'` cannot find it.
- **`resumeRival(g)`.**
  - Today: the default `cont`. Each call starts a new `runOpponents` loop.
  - Change: none, but it must run exactly once per answered window.
- **The ten callers of `promptHumanResponse`.**
  - Today: `runRival` (twice, with the default `cont`), `settleWindows` (twice), its own cast-hold re-entry,
    `runOpponents`' `step`, NET's `hostSettle` and `hostSettleN`, `driveN`'s `step`, and `clientCheckWindow`
    (with a no-op `cont`).
  - Change: no new argument. All ten get Yes/No through the one function. On a guest, the answer is always the
    wire intent, never `{op:'activate'}` or `{op:'pass'}`.
- **The per-game reset: `resetHandPresentation`, `resetBoardMemory`, `clearBoard`.**
  - Today: `resetHandPresentation` already resets `staged` on both seats (`startGame` and the guest's
    `t:'setup'` both call it), and `versiontest`'s parity scan accepts it.
  - Change: put the answer record and any new picker state in `resetHandPresentation` or `resetBoardMemory`,
    never only in `startGame`. On a guest, also clear it beside `clientWinSig` in `clientBackToLobby`.
- **`#turnTag` in `render()`.**
  - Today: "● your turn", or a hardcoded "Rival’s turn…".
  - Change: when you hold priority off-turn, say so (e.g. "● respond"). The hardcoded name predates step 4.

#### Board controls

- **`doPass` and the `#passBtn` handler.**
  - Today: the handler is `pick ? cancelPick() : doPass()`. `doPass` returns on `busy` and on the stagers. A
    guest sends `{op:'pass'}`. Locally it runs `moveToPlayThen(g, doPassBody, …)`, which calls `E.moveToPlay`
    and then `E.pass`, and you sit the round out.
  - Change: add a first branch, above the `busy` gate and the client branch. While the answer record is live
    for the current `prioGen` and `state.respondFor===YOU`, call `humanDeclines(ctx.g, ctx.cont)`. Key it on
    the record, never on raw `respondFor` (Traps). A pitch pick's Cancel still wins.
- **The engine's `play`, `pass` and `moveToPlay`.**
  - Today: `play` and `pass` refuse only at a round boundary with a window open. `moveToPlay` checks only the
    sub-phase, the turn, `finished` and the boundary.
    - Measured: with your own cast pending (`respondFor 0`), `E.pass` returns
      `{ok:false, transition:'play'}`, leaves `toPlay {origin:0}` and resets `prioPassed`.
    - Measured: after `E.declineResponse`, a Main → Fight window opens that nobody asked for. `E.play` behaves
      the same way.
    - Measured: with another seat on priority, `E.pass` and then `E.moveToPlay` took `prioGen` from 1 to 2 to 3.
  - Change: the UI routing is the fix. Engine hardening is optional (Build order); run a seeded fingerprint
    first.
- **`activate(cardId, _opts)` and the engine's `activate`.**
  - Today: the engine refuses any activation while `respondFor != null`. The template's `activate` returns
    silently on `state.turn!==YOU || busy || castHolding() || pick || targeting || targetPick`, routes choices
    on `E.effectOf`, and on a guest sends `{op:'activate'}`.
    - Live callers: `ctxActionFor`'s `run` (`#ctxBtn`, the staged ⚡ via `onStagedCastClick`, `stageCard`),
      `onActivateClick` (`#cardActivate`), `confirmTargetPick`, and `confirmPick`'s pitch branch.
    - `__solo.activate` exists but is unused. `activateSelected` and `activatableSelected` have no caller.
  - Change: while you answer, no board ⚡ may reach it. Put a window branch ahead of its gates (or in each
    caller) that ends in `humanResponds` and decides on `effectFor`. These Form-granted Quicks depend on it:
    Sanctuary under Hector or Apollo, Back Stab under Perseus or Hermes, Armor Piercing under Hippolyta, and
    Hand-to-Hand Mastery under the Spade King.
- **`doRemove`, `doCounterfeit`, and the Illusion confirm.**
  - Today: they send their own intents and bypass `activate`. None of them is a Quick under any `BOOSTS` patch.
    `E.phantasm` has no window guard at all.
  - Change: disable all three while this seat holds priority. Optionally give `E.phantasm` the `respondFor`
    guard that `activate` has.
- **`busy`, and a predicate for answering.**
  - Today: `busy` is true in most windows: the solo drivers, `moveToPlayThen`, `drainResolution`, the host's
    parks, and a guest's `owedModal`. It is false in a solo or host window opened by your OWN cast, because the
    `activate` tail, the transform branch and `doRemove` call `settleWindows` without setting it. So under
    today's box, Pass and Fight are already live in that case.
  - Change: answering can neither be gated on `!busy` nor clear it. It needs its own predicate, e.g.
    `answerLive() = ctx && ctx.prioGen===state.prioGen && state.respondFor===YOU && !castHolding() && !peeking &&
    !state.finished`, placed ahead of `busy` in every gate it lifts. This corrects the Traps line above that
    says `busy` is true in every window you answer.
- **`updateActions(yourTurn)`.**
  - Today the branches run: pick → lossPick → finished → `TUT.blocking` → `!yourTurn` ("Rival is fighting…") →
    discardPending → `busy` ("Hold on…") → `castHolding` → locked → Main → the Fight verdict. `data-live='1'` is
    set only at the end.
  - Change: an answering branch after `discardPending` and `castHolding`, but before `!yourTurn` and `busy`.
    - Fight is disabled.
    - Pass is enabled and labelled with `declineLabel()`. Under `tutNeedsCounter` it is disabled, with the
      lesson's note.
    - `#ctxBtn` and `#cardActivate` come from the answering `ctxActionFor`. `syncStagedCast` mirrors `#ctxBtn`,
      so the column ⚡ follows for free.
    - The pickers' hints stay.
    - The hint is one line, because `#hint` is pinned to one row in the landscape bands.
    - Set `data-live='1'`.
    - If the branch sat above `castHolding`, a press could land during the art flash, which ruling 20 forbids.
- **`doFight`, `doFightBody`, `canHumanPlay`, `fightDropVerdict`, `playCards`.**
  - Today: `canHumanPlay` has no window check. In a window your own cast opened (`busy` false), a legal Fight
    press or middle drop crosses over the open stack: the measured hazard above.
  - Change: refuse everywhere while you answer. The button is disabled, the middle drop's `#dropHint` says to
    answer or pass first, and `canHumanPlay` returns false.
- **`activatableCard`, `activateBlock`, `activatableCardSelected`, `onActivateClick`.**
  - Today: `activatableCard` is gated on the turn and the stagers, and reads `effectOf`. `activateBlock`
    refuses every Counter Spell ("Nothing to counter — hold it to answer a Rival Technique."), refuses Annoint
    with no Equipment of your own, refuses in the Fight sub-phase, and prices with `rideCostDelta`.
  - Change: none of them decides anything while you answer; use `E.castRefusal` and `E.canCastQuick`.
    `#cardActivate` needs the same window routing as `#ctxBtn`. `respond` charges no Ride delta (Giant Owl,
    Giant Ram), so on your own turn Main's pricing would disagree with it.
- **`ctxActionFor(sel)`, `ctxAction`, `onCtxClick`.**
  - Today: one funnel for the ⚡ button, the drag hover and the staged ⚡. It checks the `TUT.acceptsActivate`
    lock, then open pickers, then a single selection.
  - Change: an answering branch, so the three cannot disagree.
    - A picker opened for an answer confirms through `humanResponds`.
    - One selected card gets either `E.castRefusal`'s reason, or a `run` that casts at once or opens the right
      picker.
    - The label is "⚡ Activate", or "🎯 Choose target" when there is a choice.
    - The TUT lock needs an answering exemption (Lessons).
- **`castNeedsChoice`, `stageCard`, `effNeedsTarget`, `isHostileSingular`.**
  - Today: Main's routing (removeEquip, counterfeit, phantasm, a single hostile target, more than one pitch
    candidate), all on `effectOf`.
  - Change: answering uses its own test on `effectFor`: Counter Spell with more than one `E.counterTargets`, a
    non-null `E.respondChoices`, or more than one `E.pitchCands`. Main's test asks for a rival tap in a duel and
    under Hermes, where `respondChoices` returns null.
- **Back Stab's seat: `targetPick`, `chooseTargetSeat`, `confirmTargetPick`, `renderOpponents`, the duel `#rival`
  click.**
  - Today: Main always opens `promptTargetPick` for a lockout, even in a duel. `confirmTargetPick` nulls the
    picker and then calls `activate(cid, {target})`. Opponent panels are tappable on any turn, but the duel
    `#rival` handler requires `state.turn===YOU`.
  - Change: mark a picker opened for an answer (e.g. `targetPick.answer=true`). Limit its seats to
    `respondChoices.seats`, and confirm through `humanResponds(…, target=seat)` with a local-frame seat. An
    unrouted confirm is a gold ⚡ that does nothing off-turn and loses the choice.
- **Annoint's Equipment: `targeting`, `buildEqBox`, `renderFormsZone`, `renderOpponents`.**
  - Today: `respondChoices` offers `{equip:[own]}` only when you hold more than one Equipment and no strip is on
    the stack. `targeting && !targeting.copy` lights every seat's Equipment and force-opens every opponent panel.
    Annoint cast in Main never asks; the engine picks.
  - Change: a narrowed mode for your own Equipment, either a new variable or a flag that every one of those
    readers excludes. It lights only the `respondChoices` ids and sends `e.id` (the Equipment object id, as the
    `stageRemove` chips use), not a card id. Making Main ask too predates step 4 and is `main` work.
- **The Broadway pitch: `pick{kind:'pitch'}`, `confirmPick`, `cancelPick`.**
  - Today: Main opens the pick, and `confirmPick` calls `activate(pcid, po)`.
  - Change: put an answer flag on the pick and confirm through `humanResponds(…, pitch=id)`. Pick mode renders
    the hand flat, so the glow is gone while you choose; assert no glow in that state.
- **Counter Spell's target, from the visualizer: `renderStack` and `#stackView .stkCard[data-oid]`.**
  - Today:
    - The box sends `data-coid` only when there is more than one target. With one target, the plain button
      sends no `coid`.
    - `E.respond` validates a named `coid` against `counterTargets`. The resolver honours `counterOid`;
      otherwise it takes "the topmost effect beneath".
    - `renderStack` rebuilds only when its signature changes. Each card's click and mouseenter call `showCard`.
      The top card has a gold ring, and a card in flight is `.inbound` (hidden).
  - Change: stage Counter Spell, tap a `.stkCard[data-oid]` that is in `counterTargets` (computed on
    `effectFor`, so the ♦Q's `counterEquip` applies), then ⚡ → `humanResponds(…, coid)`.
    - Reuse `targeting` with a `counter` flag (step 2's Counterfeit precedent) only if the Equipment and Forms
      readers exclude the flag.
    - Paint `.targetable` and `.aimed` on every render, outside the signature gate, as the pile's `copyable`
      and `copyAim` are. Click handlers read the live picker at click time.
    - Never mark triggers, `.trig` cards, Ride/Form objects, `oid==null` boxes or a `.card.stkGhost` (which
      also carries `data-oid`).
    - The rule must out-rank `#stackView .stkCard.top .card`.
    - With one target, pre-stage it and still send its oid. Your own Counter Spell is a legal target too.
    - The oid travels unrotated (`netview`'s `remapStack` keeps it), and the host re-validates it.
- **The reader during the counter pick: `showCard`, `#cardActivate`, `#stagedSlot .stgNote`.**
  - Today: a stack tap swaps the reader to the tapped enemy card, while `#cardActivate` follows the hand
    selection. The reader's ⚡ would then sit under the target's text and cast Counter Spell. At ≤720px and in
    the landscape band, `.stgNote` is hidden, so on a phone the "choose its target" instruction lives only in
    `#message` or the one-line `#hint`.
  - Change: decide what the reader shows during a pick, and give the phone a visible instruction. No suite
    sizes stack cards as tap targets. Not measured.
- **The cast column: `renderCastZone`, `stagedHeld`, `unstage`, `onStagedDown`, `syncStagedCast`,
  `onStagedCastClick`.**
  - Today: the column auto-stages the card a picker holds (ruling 16). `onStagedDown` returns on `busy`.
  - Change: add the counter picker and the Annoint mode to `renderCastZone`'s `held` list, to `stagedHeld` and
    to `unstage`'s cleanup, with a "Choose what to counter" note. Give `onStagedDown` the answering exemption,
    so dragging a card out still takes it back.
- **Hand input: `onPointerDown`, `toggle`, `toggleGroupSelect`, `renderHand`, `#hand.disabled`.**
  - Today: all three handlers return unless `state.turn===YOU`, and two of them also return on `busy`.
    `#hand.disabled` is `opacity:.55; pointer-events:none` off-turn, and `.gsel` is drawn only on your turn.
  - Change: lift all three gates while you answer (pass `yourTurn || answering` to `renderHand`). Keep merges
    allowed, and send drops through the answering verdicts. Lifting only one gate leaves a glowing card you
    cannot tap.
- **`#clearBtn`.**
  - Today: returns on `busy` and is never disabled.
  - Change: give it the answering exemption, so Clear cancels a counter, seat or Equipment pick, or deselects.
- **`highlightTarget` and `onPointerUp`.**
  - Today: over the column it takes one card only and gets its verdict from `ctxActionFor`. Over the middle it
    uses `fightDropVerdict`. The release then stages or fights. (`dropZoneFor` does not exist; the zone is
    `drag.zone`/`drag.playZone`, set here by rect math.)
  - Change: while you answer, the column verdict is the answer verdict (`E.castRefusal`, else "⚡ release to
    stage it"), and the middle refuses with a reason. Without this, every off-turn drop of a castable Quick
    reads "Nothing to activate on that card".
- **`markAfford`, `markTransform`, `markBoost`.**
  - Today: `markAfford` greys effect rows only in Main on your turn, priced with `rideCostDelta`.
    `markTransform` has no turn or sub-phase gate, so any affordable J/Q/K pulses gold.
  - Change: while you answer, skip both, so the glow is the only cast signal. A transform is never castable in a
    window.
- **The glow class and the hand CSS.**
  - Today: several rules already style hand cards.
    - `.sel` and `#hand .group.gsel .card` set a box-shadow.
    - `#hand:not(.disabled) .card:hover` (specificity 1,3,0) sets a box-shadow.
    - `.enter` runs `dealIn` from opacity 0.
    - `.tut-spot` is a gold box-shadow plus `tutPulse`.
    - `.boosted` and `.transformReady` are filters.
    - `#hand .card` transitions box-shadow over 180ms.
  - Change: build the glow the way v1.33.15 fixed `.tut-spot`: an id-qualified rule, a combined `.enter.X`
    animation, a static reduced-motion form, and a colour distinct from gold. Assert it in computed style,
    staging and reading in one `evaluate` on one element, because `renderHand` rebuilds every card on every
    render.
- **Grouped cards and a held Fight's selection: `moveToPlayThen`, `doFightBody`, `heldPlayMessage`.**
  - Today: selection and drag work on the whole group, and the column refuses a multi-card drop. A window opened
    by your own Fight press leaves the pressed cards in `selected` (captured in `pressed`; `heldPlayMessage`
    reads `selectedCards()`).
  - Change: while you answer, tapping a glowing card selects that card alone. A held Fight's selection is set
    aside and restored, so `nettest_heldplay`'s "cards still selected" still holds. Otherwise ⚡ says "Select a
    single effect card to activate it."
- **A Main staging when a window opens.**
  - Today: Pass stays enabled while a card is staged. `stagedHeld` checks only that the card is still in hand,
    not which window it was staged for.
  - Change: decide whether entering an answer unstages it (Questions).
- **`#rivalStatus` while you hold priority.**
  - Today: a host parked in `awaitRival` shows "Waiting for opponent…" and keeps it when a client's cast hands
    it priority. `hostSettleN` writes "<seat> may respond…", and `runOpponents` leaves "<seat> is playing…".
    `render()` clears only the "is deciding / discarding / choosing a target" texts.
  - Change: while the record is live, say it is your priority, or clear the line. The box used to cover the
    stale text.

#### Netplay

- **`clientCheckWindow` and `clientWinSig`.**
  - Today: on each mirror, `sig='resp:'+oid+':'+prioGen` when you hold priority (your own trim comes first). A
    new sig opens `promptHumanResponse(gen, function(){})`. The same sig returns early, which is how the 1.8s
    park beat is de-duped.
  - Change: key the answer record to the sig.
    - The same sig neither re-opens the box nor drops the staging.
    - A new sig (including the re-grant after your own cast) drops the staging and asks again.
    - A null sig (Passo answered, a concede, the game ended) leaves answering mode and clears every picker.
    - Reset the record where `clientWinSig` is reset (`clientBackToLobby`) and at `t:'setup'`, beside
      `resetHandPresentation()`.
- **`applyMirrorNow`: the `busy` formula and `ceremonyHold`.**
  - Today: every mirror recomputes `busy = owedModal || owedLoss || waitingOnTrim || waitingOnLoss ||
    waitingOnRound || (state.turn!==YOU) || finished`. `waitingOnRound` is true for the window's holder too, at
    every boundary. `ceremonyHold` locks your board during your own ceremony, which is where Clean-up, End of
    Clean-up and Upkeep windows land.
  - Change: after Yes, the holder's board must stay live through repeated mirrors. Use the answering predicate in
    each gate rather than clearing `busy`: the park beat would set `busy` again within 1.8s.
- **`applyMirrorNow`'s overlay rule.**
  - Today: keeps any overlay up while a window is owed (`owedModal`, `revealOpen`, `stickyModal`).
  - Change: `owedModal` now means "a window is owed, and the box may already be closed". Only a new sig may show
    the box, never mirror handling. Otherwise every park beat pops Yes/No back over a player answering on the
    board.
- **`humanResponds`, the guest branch.**
  - Today: sends `{op:'respond'}`, sets `busy`, never calls `cont`, and clears no board state.
  - Change: clear the staging. Decide whether that happens at send or on the host's `t:'fx'` echo:
    `stackSourceRect` reads `#stagedSlot .card[data-id]` first, so the choice sets where your own fly-in starts.
- **The guest's `doPass` and `doFight` branches, and the host's re-cross.**
  - Today: `{op:'pass'}` and `{op:'play'}` go out before any window check. The host's transition branch
    re-crosses and re-applies: `hostApplyMove` calls `E.moveToPlay` and then `hostSettle`; `hostApplyMoveN`
    calls `moveToPlayThen` → `hostSettleN`.
  - Change: in a window, Pass sends `{op:'decline'}` (with `pg`), and Fight and the middle drop are disabled. A
    wrong `op:'pass'` at your own crossing replaces the host's parked re-apply of your Fight with a Pass (Traps).
- **`hostApplyMove`, respond and decline (duel).**
  - Today: applies against `netSettle`. An early answer stamped with the current grant is held (`heldAnswer`);
    an older one is dropped. Narration and the counter test read `E.effectOf`.
  - Change: none; a board answer is the same op. Because of the base-effect naming, the log names Form Quicks by
    their base name. Display only.
- **`hostApplyMoveN`, respond and decline (3-6 players).**
  - Today: applies only against a matching `netReact`, and un-rotates a seat as `(t+seat)%n`. It has no `pg`
    check and no `heldAnswer`.
  - Change: none required. Porting the duel's `pg` check (and `heldAnswer`, if any N-player window is shown
    before its park) is worth pairing with step 4 (Build order).
- **The host's turn ops while a window is open.**
  - Today: `play`, `pass` and `phantasm` are processed whatever `hostState.respondFor` is.
  - Change: optional hardening. Refuse them from a seat while a window is open, and say why. The transition
    re-apply is unaffected, because its `done` runs only once `respondFor` is null. Without this the UI is the
    only protection, and a client's gate is a courtesy.
- **The held remote play: `resolveIds` and the re-apply.**
  - Today: `resolveIds` silently drops ids the seat no longer holds. The local `doFightBody` refuses a changed
    hand ("Your cards changed during the crossing — pick your play again."); the remote re-apply does not.
  - Change: compare the resolved count with `it.ids.length`, and hold (`t:'held'`) when they differ. This is
    reachable today in ON through the box; step 4 makes it the natural gesture (drag a card out of your held
    pair onto the column). The path exists on `main`, so it is `main` work by the routing test.
- **The host's own windows: `hostSettle`, `hostSettleN`, `driveN`'s `step`, `awaitRival`, `hostTakeBack`.**
  - Today: each calls `promptHumanResponse(g, cont)` with a continuation that re-enters the settle. This often
    happens while `busy` is true and `#rivalStatus` reads "Waiting for opponent…".
  - Change: the board answer must call `humanResponds` or `humanDeclines` with exactly that stored pair. Do not
    call `hostTakeBack` to free the board: it stops the park beat and clears `duelWait`, which Passo uses to find
    the duel park. Fix the status line instead.
- **`clientSend`.**
  - Today: stamps `pg` on respond and decline, and arms the 5s sync timer for every op except emote, suggest,
    unready and rename. A respond sent with no window open is ignored with only a trace line and no `t:'err'`,
    so the client shows "Not synced with the host…" after 5s.
  - Change: route by `state.respondFor===YOU`, never by "this card is a Quick"; a Quick is also castable in Main.
- **The guest's `t:'err'` handler and the host's refusal.**
  - Today: the guest only shows the message. The host replies with `broadcastMirror()`, which de-dupes an
    unchanged state. The guest's send-time `busy` therefore clears only at the next park beat, and the box never
    returns because the sig is already spent (a latent bug today).
  - Change: on `t:'err'` while you hold priority, re-arm answering (clear the send-time `busy`, keep the
    staging). Or have the host `reassertMirror()` on a refused answer.
- **`CEREMONY_REFUSE` and the dispatch's `roundOver`/`inCeremony` refusal.**
  - Today: refuses `play`, `pass`, `activate` and `phantasm` during a ceremony or a round boundary, with "The
    round is still wrapping up…". Respond, decline and discard go through.
  - Change: none. It is the strongest reason a board cast must travel as `respond` and Pass as `decline`:
    Resolution and Clean-up are where both happen.
- **Passo: `passoStep`, `passoTakeover`, `maybePasso`.**
  - Today: answers a dropped seat's window with an unstamped `respond` (the guard card) or a `decline auto:true`.
  - Change: none. A seat that pressed Yes, dropped and came back finds a new or null sig, which drops its staging
    (above).
- **The brake: `stackMark` and `moveToPlayThen`'s `stopIfActed`.**
  - Today: `stackMark` is `oidSeq - castSeq[me]`, and only `E.respond` bumps `castSeq`. Neither field is on the
    mirror, so a client's `stackMark` is always 0.
  - Change: none, provided a window cast travels as `respond`. Add no client-side brake.
- **`netview.js`'s `mirrorFor`.**
  - Today: projects `respondFor`, `pending`, `stack`, `prioGen`, the boundary flags, `discardPending`,
    `trimPending`, `pendingLossChoice` and `subPhase`. It nulls `toPlay`, and carries no `prioPassed`,
    `castSeq` or `oidSeq`.
  - Change: none. Everything step 4 reads on a client already runs there: the glow via `E.canCastQuick`,
    `respondChoices`, `counterTargets`, `pitchCands`, the sentence and `declineLabel`. Staging stays off state.
    Because `toPlay` is nulled, a client cannot tell from the mirror that its own Fight press opened the window;
    a label saying so would need local memory of the last op sent.
- **Target and pitch values on `op:'respond'`.**
  - Today:
    - A lockout target is a seat in the client's local frame, which the host un-rotates (duel `(t+1)%2`,
      N-player `(t+seat)%n`).
    - Annoint's target is the Equipment object id `e.id`, sent raw. A pitch is a card id, sent raw.
    - The duel's `activate` branch does not rotate at all; it works only because `effectTarget` falls back to
      the one rival.
  - Change: the board pickers produce exactly these values. Do not pre-rotate. Send a target only when
    `respondChoices` returns a choice. A pitch id that is not a candidate is silently replaced by the lowest
    Broadway card (`pitchFor`).
- **`heldAnswer` (duel only).**
  - Today: holds an answer that beats the host's park when it is stamped with the current grant, and applies it
    on the park. It drops the answer if the window was granted again in between.
  - Change: none. Board answers carry `pg` through `clientSend`.
- **The `waitOn` notice and `showTrimWait` (other seats).**
  - Today: every other seat shows "<name> is deciding…" from the rotated `respondFor`, with the play area dimmed
    and the column above the dim.
  - Change: none. A staged card is UI state, and `broadcastMirror` projects only `hostState`, so other seats
    never see it as long as nothing puts staging on state.

#### Lessons

- **`lessonPhasesSteps` step 4 (the counter step).**
  - Today: `hi:'#hand'`; the gate is `t==='respond' && d.countered`; the text says "Spring Counter Spell" and
    never names the box.
  - Change (step 6, but step 4 must not break it): "press Yes, then drop Counter Spell on the cast column, or
    tap it and press ⚡". Spotlight the card itself (`tutPhCounter`, assigned in `tutRigPhases` and never read)
    plus `#castZone`/`#ctxBtn`. The gate only fires if the board answer goes through `humanResponds`.
- **Step 10 (the Leyline step).**
  - Today: the window opens only because a stake forces it (`shieldSaveOverride` bypasses the lesson gate).
    `hi:'#hand'`; the gate is `respond || shield`; the text says "— orange —".
  - Change (step 6): the same rewrite, spotlighting `tutPhLey`, and drop the hue word. The `shield` arm can never
    fire: `TUT.note('shield')` runs only when you win the round, and the Rival wins this one.
- **Steps 3 and 11.**
  - Today: step 3 says "flash yellow". Step 11 describes ON/AUTO/OFF.
  - Change (step 6): drop the hue word, and re-read step 11 after the AUTO ruling.
- **`TUT.acceptsActivate`, read by `ctxActionFor` and `activateBlock`.**
  - Today: a gated step allows an activation only if its `hi` names `#cardActivate` or `#ctxBtn`. Otherwise
    every ⚡ path, the column's drop verdict included, says "Not this step — follow the step above." Both Phases
    answer steps use `hi:'#hand'`.
  - Change (step 4): a board answer must not be refused on a step that gates on `respond`. Either give those
    steps' `hi` the entries `#ctxBtn` and `#castZone` (and have `acceptsActivate` accept `#castZone`), or let a
    respond-gated step accept a cast while `respondFor===YOU`.
- **`TUT.blocking()` and `#hand.tutlock`.**
  - Today: on a read step, Fight, Pass and ⚡ return early or render disabled, and `tutlock` takes pointer events
    off every group except the spotlit one. The box never checked `TUT.blocking`, so a window was always
    answerable from it.
  - Change (step 4): a window you hold is exempt from `TUT.blocking()` and `tutlock`, as the box was. Otherwise a
    stake-forced window on a read step has no exit after Yes.
- **Step `only` lists (`TUT.needCards`), read in `updateActions` and `canHumanPlay`.**
  - Today: while the selection differs from the list, Fight and Pass are disabled, and `only:[]` disables both.
    The box ignored these lists.
  - Change (step 4): Pass in a window ignores `only`, because it is a decline. The one exception is
    `tutNeedsCounter`.
- **The counter window's castable set.**
  - Today: on the rigged board, both Counter Spell (`4D#pC`) and Leyline (`9D#pL`) are castable (measured; one
    counter target). The box already offers Leyline, and spending it makes step 10 unfinishable.
  - Change: the glow makes Leyline look as right as Counter Spell. The lesson needs a list of the answers it
    accepts, the scripted-lesson rule applied to casts (Questions).
- **The `humanDeclines` retry and `tutCastRivalTech`.**
  - Today: after any decline while `tutAwaitCounter && TUT.isActive()`, it shows "let's try again" and calls
    `tutCastRivalTech()` 700ms later. That casts an unscripted Rival Technique, and its continuation sets
    `state.turn=YOU` in the middle of the Rival's turn. Only the disabled `#respDecline` keeps it unreachable.
  - Change (step 4): delete the retry, because step 4 adds two more ways to decline (No and the board's Pass).
    Delete `tutCastRivalTech` with the rest of the dead lesson in step 6.
- **`tutAwaitCounter`.**
  - Today: written by `tutPilotPhases` (live), `tutCastRivalTech`, `humanResponds` and `humanDeclines`. Read by
    `promptHumanResponse` (`tutNeedsCounter`) and by `humanDeclines`' retry. Never reset by `startGame`,
    `startLesson` or `TUT.stop`. Two comments claim `updateActions` reads it; today it does not.
  - Change: step 4's new reader (the board's Pass) must AND `TUT.isActive()`, or the flag must be reset in
    `TUT.stop`/`startGame`. The two comments become true then.
- **`humanResponds` → `TUT.note('respond', {countered})`.**
  - Today: the only live emitter of the event both answer steps gate on. It clears `tutAwaitCounter` before
    `cont`. `activate()` returns silently on the Rival's turn, and `activateBlock` refuses in the Fight
    sub-phase.
  - Change: every board answer reaches `E.respond` through `humanResponds`, never through `activate()`.
- **`runRival`'s `promptHumanResponse(g)` and the Phases pilot.**
  - Today: the box resumes the pilot through its `cont`. The pilot then tries the King, passes, and the lesson
    reaches the step-6/7 holds.
  - Change: the board must call the same stored `cont`, or the lesson stalls before its Resolution hold.
- **`TUT.note('decline')` and `TUT.note('pass')`.**
  - Today: no live gate reads `decline`. Three steps gate on `pass`: initiative 3, twos 6 and phases 9.
  - Change: Pass in a window emits `decline`, never `pass`. Fix the stale comments in `humanDeclines` and
    `lessonPhasesSteps` that describe gates which have since become `hold:` steps.
- **`tutPromptAuto`.**
  - Today: every lesson runs in AUTO, so each lesson cast resolves with no click.
  - Change: none, if AUTO keeps passing for you. If it stops, seven steps leave the player holding priority while
    the next step disables Pass: How to Play 8, Energy 4, Rides 2, Forms 2, The 2 step 3, and Phases 4 and 10.
    Four suites then go red together (rides, forms, twos, phases).
- **`lessonQuicksSteps` and the dead Quicks-lesson code.**
  - Today: no `LESSONS` entry uses `lessonQuicksSteps`. Dead with it: `tutPrepQuick`, `tutQuickId`,
    `tutRigQuicks`, `tutIsTech` and `tutPullShield`. `tutCastRivalTech` lives only through the retry. The dead
    text still says "When the Respond? prompt pops up, tap Counter Spell".
  - Change (step 6): delete it all. CLAUDE.md names `tutCastRivalTech`, `tutPullShield` and `tutIsTech` as live
    in several rules, and DECISIONS.md names one of them once; reword those in the same PR. `__solo` exports no
    `tut*` names.
- **`var tutPhRound` and its comment.**
  - Today: declared and never read. Its comment describes a recovery that no step implements.
    `lessonPhasesSteps` says "six of them gated"; five are.
  - Change (step 6): delete it, or build the recovery.
- **`lessonNamesWindow`, `lessonAllowsWindow`, and the `windows` opt-in.**
  - Today: no lesson sets `windows`, so `lessonNamesWindow` is always false. A comment above `tutPromptAuto`
    says otherwise.
  - Change: the Yes/No decision stays in `promptedQuicks`, which carries both gates; moving it would let
    unscripted windows back into lessons. Step 6 drops the opt-in or fixes the comment.
- **`TUT.finish` and the shared classes.**
  - Today: the "Lesson complete" modal uses `.respQuick` (`#lsnMore`), `.respLet` and `.respOpts`, and the decks
    lesson's `#dbTutNote` uses `.respNotYou`. `showModal` replaces whatever `#modal` holds, and the coach
    outranks the overlay, so in ON, Finish can replace an open box.
  - Change: keep these classes' CSS through step 7. In step 6, Finish either closes an owed window through
    `humanDeclines` or waits for it.
- **`#tutPanel` placement.**
  - Today: at ≥721px the coach docks at `right:16px; top:150px`, over the column holding `#cardView` and
    `#cardActivate`. That is why the activate steps set `stage:true`; the answer steps do not. On a phone the
    coach sits over the hand.
  - Change (step 6, measured in step 5): hit-test `#castZone`, `#cardActivate` and `#ctxBtn` against
    `#tutPanel` on each answer step. This is reasoned, not measured.
- **`.tut-spot` versus the new glow.**
  - Today: a spotlit hand card has a gold box-shadow, pulsing while `.enter`. `lessontest_howto` asserts its
    colour.
  - Change: the glow must use a property or colour the spotlight does not, and win on a spotlit card. Otherwise
    each glow's assertion can read the other's gold ring. The answering branch also lifts `#hand.disabled` and
    `tutlock` from castable cards.
- **The box's Peek and Aj's lesson ruling.**
  - Today: the box carries the only Peek available from a window. Aj's lesson ruling: *"lock actions, leave
    reading. especially allow the peeks, it helps people see the color changes"*.
  - Change: see Questions (the small box over the board).
- **The strip on the Rival's turn (`spIdle`).**
  - Today: the strip reads `spIdle` whenever the Rival holds the turn, even while you hold priority. Phases
    step 1 teaches this, and `lessontest_phases` samples `spIdle` right after the counter window opens.
  - Change: none in step 4. Repainting the strip while you hold priority would move the lesson's step-1 claim
    and the suite's "five distinct states"; decide it in step 5 or 6.

### The test blast radius

Counted by grep across `code/*.js`, plus `relay/`, where nothing touches the box. Each file sits in the group that
needs the most change.

**The helpers (4), which change first:**

- **`fightclick.js`:**
  - `windowUp` splits into a box read and a holds-priority read taken from state
    (`__solo.st().respondFor===0` / `__cmf.roundFlags().respondFor===0`), and drops `.respQuick` from its
    selector.
  - `clickDecline` presses No, or Pass when the box is closed and you hold priority.
  - `respQuicks` becomes a read-only engine answer for polling loops: a debug hook returning `eligibleQuicks()`
    names. Assertions get a separate computed-style glow read.
  - `clickQuick` becomes a board cast: Yes, select, ⚡ or a column drop, then the board picker. It takes
    `{id, oid, seat, equip, pitch}` instead of a `data-*` selector, waits out `castHold()`, and returns a label
    that still contains the effect name.
  - `driveStep` gains a "box closed, priority held → Pass" branch.
  - `clickPass` and `__pressPass` report `'declined'` as distinct from `'passed'`.
  - `clickFight`'s `modalUp` checks need no change while the box still opens at the crossing.
- **`netwindows.js`:** keeps clicking `#respDecline`. Drop the dead `pfDecline`/`sgNo`. Add a second state: the
  box is closed and this seat holds priority past the grace, so press Pass. Restart `seenAt` when the box closes,
  so a suite that just pressed Yes keeps its cast.
- **`lessonlib.js`:**
  - `answerWindow` skips a disabled button and says so, drops the dead ids, and handles the after-Yes state.
  - `passTurn` recognises a decline (`respondFor` leaving 0, or the ledger's "→ you DECLINED") instead of
    pressing again.
  - A new `answerQuick` (Yes, then a board cast) has the same retry and hold wait as the other helpers.
    `lessontest_phases`' local `respond()` moves into it.
  - `finish()` and the play helpers need no change.
- **`nettest_lobby.js`:** no change. `startDuel` installs netwindows for its callers.

netwindows reaches **64** suites. 56 files require `nettest_lobby`, of which `nettest_strip` opts out
(`manualWindows`), leaving 55. Ten install it directly: `nettest_3p`, `deckout3`, `elim3`, `discon3`,
`losspick_remote3`, `parity`, `parkbeat3`, `rtc3`, `losspick3` and `target3`. `nettest_parity` does both, so
55 + 10 − 1 = 64.

**G1: follows the helpers, 67 files.**

- **Through netwindows only (44).** All are `nettest_*`: activate, clientdeal, 3p, customdeck, counterfeit,
  deckpick, dim, desync, discon3, drawfizzle, drag, energy, clientwin, emote, endscreen, full, deckout3,
  losspick3, lobbyback_rtc, log, discard, narrate, names, mirrordrop, elim3, parkbeat3, piles, kick, remotetrim,
  rename, rtc3, losspick_remote3, starter, roundstall, parity, stale, version, phantasm, prioledger, target3,
  trim, relay, rtc_discon, roundlock.
  - `nettest_parity` and `nettest_roundlock` stay green with no edits but cannot see the after-Yes state. They
    are the only suites that assert board liveness while a round window is open.
  - parity's `roundOpen` counts any live control while any seat holds priority at a boundary, so the first leg
    that presses Yes there goes red unless the rule learns the exception.
  - roundlock has no row where the client itself holds priority.
  - Add a Yes leg to each.
- **Through `driveStep` (1):** nettest_ceremony.
- **Through lessonlib (9):** lessontest_howto, rides, energy, initiative, specials, forms, zones, twos and
  pickescape. `pickescape` asserts `answerWindow`'s pick branch, whose return string must not change.
- **Hard-code `#respDecline`, so they follow only if No keeps that id (13):** deckouttest, kicktest and roartest
  (each a tapper that also presses Pass on `turn===0 && pile`, which can now land in a held window),
  fightbeattest, nettest_fightbeat, nettest_strip, nettest_record, exporttest, nettest_sync, nettest_passoduel,
  nettest_parkclobber, nettest_ridewedge and nettest_actloop.
  - Three need edits regardless. `nettest_actloop`'s "the window closed" invariant reads the overlay, so it
    passes vacuously after Yes; read `respondFor` instead. `nettest_sync`'s stall classifier would call a held
    window "GENUINELY WEDGED". `nettest_parkclobber`'s diagnostic reads `.respQuick`.
  - Several of the 13 still list the dead `pfDecline`, `sgNo` or `sgYes`.

**G2: asserts box content that stays, 2 files.**

- `nettest_priosig` checks the Resolution sentence, the striker named in the first `#modal p`, the FIGHTER KICK
  line and the de-duped re-grant. Add a leg: press Yes, re-inject the same grant, and the box stays closed.
- `mptest` checks the `declineLabel` table. Point that claim at the rendered `#passBtn` text while you hold
  priority, and drop the dead ids from its loop.
- G2 parts also sit inside prompttest, quicktest, browsertest, resolutiontest_ui and lessontest_phases.

**G3: asserts or detects removed content, 6 files.**

- `quicktest`: leg 1 asserts a Form-made Quick in the `.respQuick` labels; move it to the glow after Yes. Leg 3
  ("one button per play") loses its subject, so tombstone it with its history, as `prompttest` did.
- `prompttest`: its CONTROL needs "Counter Spell" in the box text, which only the button supplied.
- `nettest_prefightduel`: detects the window by `respQuicks(join).length>0`.
- `nettest_autopass`: leg 1 detects the window by `respQuicks`. Leg 2b must still drive the real No. Leg 3's
  source scan of `say(…{who} let it resolve` (≥2 host sites, each guarded by `!it.auto`) moves if the decline
  line is reworded.
- `castholdtest` leg D: its `boxUp` reads `.respQuick`. A false red here would invite reverting ruling 20's
  defer.
- `stackrowtest`: only its header comments, which say the box and `#stackView` share `stackRowsHTML`.

**G4: casts by clicking a specific `.respQuick`; rewrite it to cast from the board. 18 files:** resolutiontest_ui,
lessontest_phases, nettest_brake, nettest_brake3, nettest_clientride, nettest_clientride3, nettest_heldplay,
nettest_heldplay3, nettest_pitch, nettest_respondtarget3, nettest_guard, nettest_quickwedge, nettest_stackfly,
nettest_counter, nettest_react3, nettest_rtc, nettest_prefight and browsertest. Notes:

- **`resolutiontest_ui`:** A, C, C2 and D move to the glow; A2, B and F cast from the board. F's
  `#modal .ctxStack` read moves to `#stackView` and must assert that the stack is readable while you decide,
  since F exists because it was not. C8b goes vacuous; re-point it at Yes/No, which `hideOverlay` also leaves in
  the page.
- **`nettest_pitch` and `nettest_respondtarget3`:** they lose their subjects (one button per Broadway card, per
  rival, per Equipment). Rewrite them to choose on the board, and keep "chose ≠ default" both ways.
- **`nettest_clientride(3)` and `nettest_heldplay(3)`:** their polls must not press Yes as a side effect inside
  the loop. heldplay casts through `clickQuick` on a `data-id` selector, not through `respQuicks`.
- **`nettest_brake` leg 2:** a raw `#passBtn` click while priority is held is now a decline, not the round pass
  the leg asserts.
- **`nettest_prefight`:** its detector `/about to fight|Back Stab|Spring/` matches only the button's "Back Stab".
  It never chose a lock target, so the rewrite must name one.
- **`browsertest`:** its respond mode presses Yes and then casts or passes, and acts on a held window even when it
  is not "your turn". If the heading loses "Respond?", every overlay falls through to `{unknown}` in all 12
  duels.
- **`lessontest_phases`:** its "NO window was forced open" absence check on `#respDecline` passes vacuously if the
  id is renamed.

**Unaffected (11 pattern hits):** nettest_reveal, revealtest, piletest, phonetest, landscapetest, rulestest,
nettest_suggest, peektest (which never drives the box's Peek), test.js, sweep.js, and engine.js (comments only).
Also checked, with no box use: `relay/*`, netview.test.js, oppbeatstest, phantasmtest, counterfeittest,
nettest_counterfeit, nettest_inpage, dragtest, logtest, viewtest, decktest, lessontest, lessontest_energyorder
and upkeepstrandtest. `phonetest` and `landscapetest` still measure the action row where the new Pass icons land.

**New coverage, where no suite exists to rewrite:**

- Counter Spell's target picked from the visualizer with two objects on the stack, both ways: name the bottom one,
  not the top. `test.js` does this only at the engine level.
- A `dragtest` leg where a drop in a window casts a Quick.
- A computed-style glow check, staged with `.enter` and reduced motion in one `evaluate`, at a phone viewport.
- A netplay leg where Yes then Pass sends `{op:'decline'}`.
- The Yes legs for `nettest_parity` and `nettest_roundlock`.

**Counts.** About 20 UI suites change their assertion counts. Each count is declared twice in CLAUDE.md, and
`docsweep.js --counts` reports a mismatch but never gates, so edit both lines in the same PR. Any assertion added
to `test.js` for engine hardening changes the 713 that `versiontest` checks against CLAUDE.md and
`NEXT-SESSION.md`, and turns versiontest red unless those lines change too.

### Traps

#### Routing a press in a window

- **The engine accepts a wrong op in a window instead of refusing it.** Measured: by the turn holder with its own
  cast pending, `E.pass` returns `transition:'play'` and sets `toPlay` over the stack. With another seat on
  priority, `E.pass` then `E.moveToPlay` took `prioGen` from 1 to 2 to 3. `E.moveToPlay` checks sub-phase, turn,
  `finished` and the boundary, never `respondFor`. `E.phantasm` has no window guard at all.
- **Your own Fight press opens a window you hold first.** `nextPrioHolder` starts at the turn holder. A guest's
  Pass sent there as `op:'pass'` makes `hostSettle` overwrite `netSettle` (and `hostSettleN` overwrite
  `netReact`). The re-apply of your Fight becomes a re-apply of the Pass: you pressed Fight and passed. Nothing
  errors.
- **A misrouted Pass orphans the first window's continuation.** The second settle calls `promptHumanResponse`
  with a new `cont`. On a host, the one it loses is `NET.hostAfterOwnCast(gen)`, which opens a remote seat's
  forced discard, so the table wedges. CLAUDE.md has recorded this `hostAfterOwnCast` family seven times.
- **Do not key on raw `respondFor`.** Refusing Fight and Pass whenever `respondFor != null` was tried once, and
  stalled browsertest past 400s: on some paths `moveToPlayThen`'s settle is what drains the window (commit
  1de7c0b; `drainResolution`'s comment). Key on the answer record for the current `prioGen`.
- **`busy` is not true in every window, and the design doc's own Traps line says it is.** The `activate` tail, the
  transform branch and `doRemove` call `settleWindows` without setting `busy`. So in a solo or host window opened
  by your own cast, Pass (with a pile on the table) and Fight (with a legal selection) are live under today's box.
  Close the box on Yes without an answering branch and `doPass` → `E.moveToPlay` runs over the open stack.
- **A guest's `busy` comes back every 1.8s.** `applyMirrorNow` recomputes it on every mirror, and the park beat
  (`PARK_BEAT_MS=1800`) sends one. `waitingOnRound` is true for the window's own holder, and `ceremonyHold` locks
  the board in its own ceremony. Clearing `busy` works for 1.8s.
- **The host answers while parked.** There `busy` is true and the status reads "Waiting for opponent…".
  `hostTakeBack` would free the board, but it stops the park beat and clears `duelWait`, which Passo reads.
  Clearing only one of `busy` and the status text is a known wedge (v1.31.49).
- **The continuation must be stored, and consumed once.** It lives only in the button closures. `humanDeclines`
  ignores `E.declineResponse`'s result and calls `cont()` unconditionally. That was safe while the button
  vanished on the click. On the board, Pass stays on screen, so a double press starts two drivers
  (`⚠ TWO OPPONENT DRIVERS`). `humanResponds` has the same hole.
- **A guest can queue two waiters during one cast hold.** Two mirrors with two sigs each queue a
  `promptHumanResponse`, and `releaseCastHold` runs both with old closures. The record must belong to the latest
  grant.
- **Main's predicates refuse or mis-ask in a window.** `activate()` returns silently off-turn; on your own turn
  the engine refuses ("Priority is being passed — answer the window instead."). `activateBlock` refuses every
  Counter Spell. `castNeedsChoice` asks for a rival tap for Back Stab in a duel, where `respondChoices` returns
  null. Use `E.castRefusal` and the box's own predicates.
- **Every picker confirm ends in `activate()`.** `confirmTargetPick`, `confirmPick`'s pitch branch and
  `ctxActionFor`'s targeting confirm (`doRemove`/`doCounterfeit`) all reach it, and its first line returns
  off-turn. `confirmTargetPick` nulls the picker first, so the choice is lost and the window stays open.
- **A board answer must be `E.respond`.** Only `E.respond` bumps `castSeq`, the brake's own-cast exemption. The
  host's record counts an answer in the respond handlers (`nettest_counter` and `nettest_react3` assert
  `seats[1].eff.D4===1`). Through any other path the 2026-09-11 self-brake comes back.
- **An answer sent with no window open vanishes.** Both hosts ignore it with a trace line and no `t:'err'`. If the
  host is not parked, no mirror follows either, so the guest shows "Not synced with the host…" after 5s.
- **A refused answer leaves a dead board until the next park beat.** `broadcastMirror()` de-dupes the unchanged
  state, the guest's `busy` clears only on the next beat, and the box never returns because the sig is spent.
- **The 3-6 player host has no grant check.** `hostApplyMoveN` has no `pg` and no `heldAnswer`. An answer meant
  for an earlier grant applies to the current one, and an answer that arrives before the park is lost with its
  sig spent.
- **`resolveIds` shrinks a held remote play silently.** If a client casts or pitches a card from its held pair in
  its own crossing window, the re-apply lands a smaller play on the remote seats only. The local path refuses;
  the remote one does not.
- **`pitchFor` substitutes silently.** A pitch id that is not a candidate pitches the lowest Broadway card, with
  no refusal.
- **The frames differ by target type.** A lockout seat is sent in the local frame and un-rotated by the host. An
  Equipment target is `e.id`, not a card id ("That is not your Equipment." otherwise). Counter oids are
  unrotated. The duel's `activate` branch never rotates. Do not pre-rotate on the client.
- **`CEREMONY_REFUSE` blames the round, not the routing.** A mis-routed `pass` or `activate` at Resolution or
  Clean-up is refused with "The round is still wrapping up…", which reads as a game bug.
- **`doCounterfeit`'s window never settles.** It calls `rivalMayRespond` instead of `settleWindows`, so its window
  gets no box and no answer record, and on a host the AI answers for the remote human. The enumeration grep
  (`settleWindows(gen`) cannot find it because the call is missing. The gap exists on `main`.

#### State, gates and presentation

- **AUTO's own-cast exemption covers only the `respond` timing.** `promptTiming` checks boundary flags before the
  object, and `state.resolution` stays parked until the stack is empty. So a Quick you cast into Resolution or
  Clean-up keeps that timing: in AUTO you are asked again if another card has a stake (`shieldSaveOverride`'s set
  includes both), and passed otherwise. Upkeep and End of Clean-up are not in that set, so you are always passed
  there. In ON you are always asked again. "A cast passes for you in AUTO" is true only at an object window.
- **The box and the column can describe one object two ways.** The box reads `E.effectOf(pend.card)`; the stack
  object and its caption use the boosted `eff`. The aim uses the base kind and `E.effectTarget`, which returns one
  seat. Plausible, not measured: at 3+ players a Back Stab boosted by Hermes' Super (`all:true`) would tell a
  locked seat "It does not target you", and `E.stackTargetOf` names one seat the same way. Measure it first, then
  route it to `main`.
- **Several glow rules collide.** The hover rule (1,3,0) and `.gsel` (1,3,0) replace a (1,2,0) box-shadow glow.
  `.enter`'s `dealIn` starts at opacity 0, and the 180ms box-shadow transition leaves a toggled class mid-fade.
  `#hand.disabled` dims the whole hand. `.tut-spot` is also a gold box-shadow, so two gold glows can each satisfy
  the other's assertion. Read the computed style on the card AND check the hand container.
- **`markTransform` has no gate.** In a window, a J/Q/K that could transform pulses gold beside the castable glow:
  a second "use me" signal, and a false one.
- **Selection is per group, and a held Fight stays selected.** A glowing Quick in a pair is selected with its
  partner, and the column refuses the drop ("one card at a time on the cast column"). In your own crossing window,
  a tap merges the Quick into the pressed pair, and clearing `selected` breaks the held-fight message.
- **A Main staging can outlive its window.** Pass is enabled while a card is staged, and `stagedHeld` never checks
  which window the card was staged for.
- **Answering happens inside ceremonies, and an objectless window hides the column.** `boundaryThen` drives
  windows at Clean-up, End of Clean-up and Upkeep under the ceremony's banners, and `#castZone` is lifted only
  above `waitDim`. With no object (prefight, Clean-up, End of Clean-up, an empty Resolution), the column is hidden
  unless a card is staged or `#table.dragging` is set, so a tap-and-⚡ answer has no visible column.
- **The stack rebuilds only when its signature changes.** `if(sig===stackSig) return;` means a target highlight
  painted inside `renderStack` never repaints when only the picker changes. The click handlers bound to `showCard`
  never stage. A `.stkGhost` carries a stale `data-oid`. `#castZone` scrolls (`overflow-y:auto`), so on a short
  table a target can sit out of view.
- **Counter Spell without an oid resolves by a different rule.** The resolver's fallback skips only non-effect
  kinds, and does not exclude triggers or Ride/Form objects, unlike `counterTargets`. Always send the oid.
- **`declineLabel`'s strings are not icons.** At ≤720px, `#passBtn::before{content:attr(data-icon)}` renders
  "Let the counter come off" at 17px in a 44px slot.
- **`.respQuick` is not the box's alone.** `#againBtn` (the end screen) and `#lsnMore` (lesson complete) use it,
  and so does the shared `.modal .respQuick` CSS. `windowUp` already reads the end screen as an open window, and a
  text-less `clickQuick(p)` would press "Play again".
- **Per-game UI state reset only in `startGame` never resets on a guest.** `versiontest`'s scan names it.
  `resetHandPresentation` and `resetBoardMemory` are the right homes.
- **The board inherits narration that is already wrong.** `humanResponds` says "answered … at instant speed" even
  at a boundary where nothing was cast. `humanDeclines` says "let it resolve" while Pass reads "Move to the fight"
  or "End the round".
- **Deletions the parse check cannot see.** After removing `tableContextHTML`, `stackRowsHTML`, `peekBtnHTML` and
  `wirePeek`, grep `code/*.js` and `docs/`, and run `grep -n 'name:name'` on the export literals. Keep
  `declineLabel`: `declineLabel:declineLabel` sits in `__solo`, and mptest reads it. Run `mptest` before the
  sweep.
- **`shieldSaveOverride`'s closed set lacks `upkeep` and `endcleanup`.** A future stake at either timing is dead
  code unless it is added in the same commit.
- **Nothing to chase in the gate sweep:** `dropZoneFor` does not exist, and `useEquip` has no caller.

#### The harness

- **After Yes, a window is open with no overlay, and the harness cannot see it.** netwindows,
  `lessonlib.answerWindow`, `nettest_sync`'s stall classifier, mptest's loop, browsertest, exporttest,
  `nettest_actloop`'s "window closed" check and `fightclick`'s `modalUp` all key on `#overlay.show` or a visible
  `#respDecline`. A suite that presses Yes and stalls hangs to sweep.js's 300s kill instead of being auto-passed,
  and `nettest_sync` calls it "GENUINELY WEDGED".
- **Reading the glow changes state.** The glow appears only after Yes, so a polling read presses Yes, and the
  `#respDecline` the same loop declines with is gone. Give polling loops the read-only engine answer.
- **A raw Pass while you hold priority is a decline.** `clickPass` and `__pressPass` report "passed".
  `lessonlib.passTurn`'s success test (a `passes` bump or a new round) cannot see a decline, so it presses again,
  and the second press can pass the next turn (the skip already documented there).
- **Renaming No's id is a ~90-file change.** About 15 suites click `#respDecline` by id outside the helpers, and
  so do netwindows (64 suites) and lessonlib.
- **The box detectors key on the heading and lead words.** browsertest uses `/Respond\?/`, prompttest
  `/Respond/ && /in response/`, quicktest `/Respond|answer|Quick/`. Some text came only from the per-card
  buttons: prompttest's CONTROL needs "Counter Spell", and `nettest_prefight` matches only the button's "Back
  Stab".
- **`nettest_priosig` reads the first `#modal p`.** The shrunk box must keep the lead sentence first.
- **`resolutiontest_ui` F exists because the stack was hidden at the moment you were asked.** Dropping the box's
  copy of the stack is safe only if the visualizer is readable while the box is up.
- **C8b goes vacuous, and says so.** The stale-markup trap moves to Yes/No, which `hideOverlay` also leaves in
  `#modal`. Keep the visibility rule (`offsetParent !== null`).
- **quicktest leg 3 loses its subject.** Tombstone it: it encodes Aj's report of four buttons for two plays.
- **The AUTO ruling moves specific claims:** resolutiontest_ui F (three own casts into Resolution in AUTO) and H
  (the "YOUR OWN CAST" ledger label); the C8/C8b pair; nettest_brake leg 3 and nettest_brake3; lessontest_phases
  (whether the box returns after Leyline, which would trip lessonlib's warning); browsertest's respond mode;
  nettest_clientride's "asked again" leg. nettest_counter, react3, rtc and quickwedge also run in AUTO.
- **The guest's box de-dupe is keyed on the box.** After Yes, a later mirror of the same grant must not re-open
  the box, while a re-grant must. `nettest_priosig` covers only the box-up half.
- **Dead ids in hand-rolled lists.** `pfDecline`, `sgNo` and `sgYes` (removed at epic steps 19 and 20) remain in
  netwindows, `answerWindow`, mptest, nettest_sync, nettest_record, nettest_passoduel, exporttest and
  browsertest. browsertest's `/about to fight/` branch calls `getElementById('pfDecline').click()`, which would
  throw if it ever matched.
- **`nettest_autopass` leg 3 scans the template.** If Pass in a window gets its own narration, or the decline line
  names the moment, the scan's guard regex has to move with it.
- **Budgets are sized for a one-click cast.** A board cast adds Yes, a selection, the cast hold, ⚡ and maybe a
  target. Re-measure `nettest_guard`'s 30s and `FIGHT_BUDGET`'s 15s from a passing run rather than guessing.

#### Lessons

- **The lesson lock refuses board answers on the two steps that teach answering.** `TUT.acceptsActivate` looks
  for `#cardActivate` or `#ctxBtn` in `hi`, and both Phases answer steps use `hi:'#hand'`.
- **Leyline glows in the counter window, and the finale needs it.** Measured: `canCastQuick` is true for both 4♦
  and 9♦ over the Rival's Infuse.
- **The dead Quicks lesson still has one live door.** `humanDeclines`' retry calls `tutCastRivalTech`, which casts
  an unscripted Rival Technique and sets `state.turn=YOU` mid-Rival-turn. Only the disabled `#respDecline` keeps
  it shut, and step 4 adds two more decline routes.
- **The box ignored the lesson's holds; the board does not.** `humanResponds` and `humanDeclines` skip
  `TUT.blocking()` and `only`, while `doPass`, `activate` and `tutlock` honour them. A stake-forced window, which
  bypasses the lesson gate on purpose, then has no exit after Yes.
- **Lessons run in AUTO, so the AUTO ruling is a lesson ruling.** Seven steps and four suites (rides, forms, twos,
  phases) depend on it.
- **`tutAwaitCounter` is never reset.** Every reader ANDs `TUT.isActive()`. The new one must too, or a skipped
  lesson disables Pass in the next duel's windows.
- **In a lesson, the turn reads RIVAL during your window.** `tutCastRivalTech` leaves `state.turn=RIVAL` until its
  settle ends, so answering keyed on `state.turn` misses it.
- **`TUT.finish` can replace an owed window.** `showModal` replaces `#modal`, and the coach outranks the overlay.
- **The coach docks over `#cardActivate` on desktop.** That is why the activate steps set `stage:true`, and the
  answer steps do not. `.click()` inside an `evaluate` cannot see a covered control, so hit-test it.

### Build order

Each piece PRs into the epic, keeps the sweep green on its own, covers every seat (solo, the host's own seat, a
guest), and bumps the epic's fourth number when the page changes. Run `browsertest` between pieces, not only at
the end: it is the suite that plays complete duels through the real page.

1. **Rulings first (no code).** The AUTO question and Questions 2-7 change pieces 3-5.
2. **Helpers that read both box shapes (medium).**
   - The `fightclick`, `netwindows` and `lessonlib` changes listed above, each working against today's box AND
     against Yes plus the board.
   - Add the read-only debug hook: grep the `__solo`/`__cmf` literal for the key name first.
   - Move the G4 suites from `data-*` selectors to `clickQuick`'s options object here, while they are still green
     against today's box.
   - The board branches stay dormant until piece 5, so say that in the PR.
   - AUTO does not bite.
3. **Yes joins today's box, with the answer record (medium).**
   - Yes appears beside the per-card buttons for now, so every unedited suite stays green.
   - `promptHumanResponse` stores the record. It is consumed once, reset per game and per sig, and cleared in
     `clientBackToLobby`.
   - `humanResponds` and `humanDeclines` become one-shot with the `respondFor` check. Copy the `clientNotReady`
     guard. Delete the lesson retry in `humanDeclines`.
   - **AUTO bites here** if the ruling is "a board cast never passes in AUTO": the own-cast line in
     `promptWanted`, the auto-decline branch and the `ownCast` ledger flag change here, and the helpers need
     piece 2's priority-held state before that lands.
4. **Pass, No and Fight while you hold priority (medium).**
   - `doPass`'s first branch; Fight, `canHumanPlay` and the middle drop refused.
   - The `updateActions` branch, placed below `castHolding` and above `!yourTurn`/`busy`.
   - `declineLabel` on Pass, with its icons.
   - The answering predicate in the gates, including the guest's `busy` sources.
   - `#turnTag` and `#rivalStatus`.
   - `tutNeedsCounter` on Pass; Pass exempt from `TUT.blocking` and `only`.
   - The `t:'err'` re-arm.
   - **AUTO bites here** too: if your own cast no longer passes for you, this is the piece that makes holding
     priority usable, with Pass as the exit.
5. **Casting on the board (large).**
   - The hand gates, `#clearBtn` and `onStagedDown`.
   - `ctxActionFor`'s answering branch on `E.castRefusal`, and the window choice test.
   - Routing ahead of `activate()`. Disable `doRemove`, `doCounterfeit` and the Illusion confirm.
   - Answer flags on `targetPick` and `pick:'pitch'`, and the own-Equipment mode for Annoint.
   - The column verdict in `highlightTarget`; `markAfford` and `markTransform` skipped.
   - The group tap and the held Fight's selection; a Main staging cleared on entry.
   - `TUT.acceptsActivate`'s exemption, so `lessontest_phases` stays green.
6. **The glow (small).** The class and its CSS, painted from `eligibleQuicks()` on every render, with the
   computed-style assertion and the phone viewport.
7. **Counter Spell's target from the visualizer (medium).** Paint pickable stack cards on every render, use live
   click handlers, exclude ghosts and triggers, always send the oid, decide what the reader shows, and give the
   phone a visible note.
8. **The box shrinks (medium).**
   - Delete the `.respQuick` loop, `tableContextHTML`, `stackRowsHTML`, `peekBtnHTML` and `wirePeek`. Keep the
     `.respQuick` CSS.
   - The sentence edits, the new ledger lines and the stale "Ask me to respond…" text.
   - Remove the helpers' old branch. Rewrite G3 and the rest of G4: resolutiontest_ui F and C8b, the quicktest
     leg 3 tombstone, nettest_pitch, nettest_respondtarget3.
   - Run the deletion greps, then `mptest`, then the sweep.
   - **AUTO bites here:** the suite claims in the Traps list are written against the ruling.
9. **New coverage (medium).** The legs listed under the blast radius, and the suite-count edits in CLAUDE.md.
10. **Hardening, mostly outside the step (medium).**
    - The host refuses turn ops while a window is open.
    - `hostApplyMoveN` gets the `pg` check and `heldAnswer`.
    - The remote held-play count check.
    - `doCounterfeit` through `settleWindows`.
    - The `E.phantasm` guard, and the engine refusals: run a fingerprint first, and update the `test.js` count in
      CLAUDE.md and `NEXT-SESSION.md`.
    - By CLAUDE.md's routing test, the held-play check, the `doCounterfeit` settle, the engine guards and the
      Hermes sentence exist on `main` unchanged, so they are `main` work. File them there and hold the merge
      while the epic is open.

### Questions for Aj

1. **In AUTO, does a cast on the board pass priority for you?**
   - **What that means.** When you cast a Quick, priority comes back to you first, because the new top of the
     stack is yours. "Passes for you" means the game then presses Pass on your behalf at once. Priority moves on
     to the next seat, and you never get to put a second Quick on top of your first.
   - **What happens today:**
     - **ON:** the box asks you again, so you can stack a second Quick or pass.
     - **AUTO, when you answered someone's cast, or cast a Technique in Main while holding a castable Quick:**
       passed for you silently. This is the 2026-09-24 rule.
     - **AUTO at Resolution or Clean-up:** asked again if another card in your hand has a stake, passed
       otherwise.
     - **AUTO at Upkeep or End of Clean-up:** passed.
     - **OFF:** always passed.
   - **The options:**
     - (a) keep it, so "Activate does not pass" holds only in ON;
     - (b) AUTO never passes after your own cast. This overturns the 2026-09-24 rule. Seven lesson steps need a
       "now press Pass" step or a lesson-only auto-pass. Every Technique cast while you hold a castable Quick
       needs a Pass press. `nettest_autopass` and `prompttest` change;
     - (c) don't pass only after an answer, and still pass after a Main activation.
   - **Default: (a).** It is a standing rule, no lesson or suite moves, and ON already gives you the way to stack.
2. **In ON, after your own board cast, does the box come back?** **Default: yes.** The grant is new (a new
   `prioGen` and a new sig), and the code already asks again. Holding priority with no box is invisible to
   netwindows, `windowUp` and lessonlib, so the harness would need a third state.
3. **While the small box is up, can you read the stack, the pile and the phase strip?** `resolutiontest_ui` F
   exists because the stack was hidden at the moment you were asked, and your lesson ruling asked to keep peeks
   for the strip colours. Step 4 removes both the box's copy of the stack and its Peek. **Default: the small box
   sits clear of `#castZone`, the pile and the strip (hit-tested at the `landscapetest`/`phonetest` sizes), on a
   variant of the overlay that does not dim them, so no Peek is needed.** That keeps both reasons for the old
   extras without bringing the extras back.
4. **After Yes, can you get the box back?** **Default: no.** Pass and casting are the only ways out; ✕ and Clear
   only undo a staging or a pick. No and Pass are already two decline routes the lesson guard has to keep
   disabled, and a third would make it three.
5. **Counter Spell with exactly one target: does ⚡ cast it at once?** **Default: yes.** The target is pre-staged,
   ⚡ casts, and the oid is still sent. That follows ruling 11 and step 2's Counterfeit rule, and sending the oid
   avoids the resolver's different fallback.
6. **Tapping a glowing Quick that sits inside a group.** **Default: while you answer, the tap selects that card
   alone, and a held Fight's selection is set aside and restored.** Otherwise the glowing card can be neither
   dropped (the column refuses multi-card drops) nor cast, and a held Fight would merge with the Quick.
7. **A card staged in Main when a window opens for you.** **Default: entering the answer unstages it; nothing was
   spent.** `stagedHeld` does not know which window a card was staged for, and its ⚡ would answer this window
   with a choice made for Main.
8. **The incoming card's rules text (`.respIncoming`).** **Default: drop it.** The card is in the visualizer and
   opens in the reader, and the box keeps only the sentence the design names.
9. **May a lesson step accept only some of the glowing Quicks?** In the Phases counter window both Counter Spell
   and Leyline glow, and spending Leyline makes the finale impossible (true today too, through the box's Leyline
   button). **Default: everything the engine allows still glows, and a step that names its card refuses another
   one with a hint, the way `only` refuses a play.** That keeps "the glow is the engine's answer" and reuses an
   existing lesson rule. The hook lives in step 4's cast path; the step text is step 6's.