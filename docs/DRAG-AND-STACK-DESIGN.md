# Drag and stack: playing from the board

**Status: DRAFT, waiting on Aj's rulings (2026-10-13). Nothing here is built.** The work lives on
`epic/drag-and-stack`: every step PRs into it, and `main` sees one merge at the end. Each **⚖** below is a
ruling for Aj. The default beside it is a recommendation, not a decision.

## In Aj's words

The design, 2026-10-13:

> the idea is to be able to drag cards to the right side of the play area to activate and drag to the middle
> of the play area to fight. … when a card is activated, a representation of the card is put into this stack
> visualizer down at the bottom. and then the priority is passed around right? if you're a player that can
> respond, you cards that can be cast glow. and you can drag those cards to the stack visualizer and it puts
> your card on the stack. … when you drag it here sorry, it doesn't activate yet. it puts the card there and
> you can select targets. and after the targets are selected, you then see the activate button. that sends
> your planned activation to the host and that's when the card is put into the stack for everyone else. that
> way you can start activating it but dragging to the stack visualizer but then cancel it if you change your
> mind.

On the modal alternative, and what actually bothers him: *"the way yugioh does it, it has modals and we really could still
go that route... but i feel like there's some friction with the next button"*. The friction, in his words:
*"accidentally, pressing next and then being unable to go back to main to activate abilities. punishes casual
players (i.e. no takebacks). rules-wise, there are no takebacks."*

The three earlier asks this answers:
- *"can we redesign? instead of having a modal for each card... can we just like pause the game and highlight
  the castable quicks?"* (2026-09-10)
- *"not elegant but it works haha i think we need to overhaul this with a stack visualizer in the future"*
  (2026-09-11)
- *"there still are no animations for the answered quicks… maybe it's because we use modals instead of prompt
  the user's hand"* (2026-09-18, from a side-by-side of both seats)

## The three problems

1. **An irreversible press that is easy to make by accident.** In Main the big gold button reads ▶ Next
   whenever nothing is selected, and pressing it ends your chance to use anything Main-only this turn. That
   is the rule, and it stays. What changes is how easy it is to do by mistake.
   **Dragging makes it worse.** In Main a drag can only activate, so a dragged pair is refused with *"One card
   at a time in the Main sub-phase — press Next to move to the Fight sub-phase."*, and a dragged card that has
   an effect gets activated instead of played. A player who drags learns to press Next every turn.
2. **A window that hides the board it is about.** The Respond? modal covers the middle of the table and dims
   everything behind it, so it carries copies of the board: `tableContextHTML` repeats the pile, your energy
   and the stack *"because this box is shown in the Respond modal and the board's copy is behind it"*, and a
   👁 Peek at the table button exists to see the rest. It also lists your hand back to you as buttons, one per
   play: each counter target, each seat to lock out, each Equipment to protect, each Broadway card to pitch.
   In a real game (Aj's saved log, rounds 6 and 7) both prompts were useless: Counter Spell offered against an
   empty stack (since refused at cast), and Leyline on a jab win with nothing at stake. That second one is
   **legal and not a bug**, his words, but it was a modal you read and dismiss to learn there was nothing to do.
3. **A stack written in prose.** `#stackView` is text rows above the pile, shown only while the stack is
   non-empty. A Quick answered from the modal has no card on the board to fly from, so it never reaches
   `buildOppBeats`' `revealEffect` + `revealDwell`: answered Quicks have never animated.

## What already exists, so none of it is rebuilt

- **The spec already describes staging.** [`PHASES-AND-PRIORITY.md`](PHASES-AND-PRIORITY.md) §2 step 2, on
  why Counter Spell targets, quotes Aj — *"you will need to choose a target for your counterspell before it
  gets put onto the stack"* — and says *"targeting is confirm-first (`targetPick.chosen`, then the context
  button reads ⚡ Activate), so nothing is spent until the pick is confirmed."* Placing a card on the stack
  before pressing Activate is that rule, made visible.
- **Main's casting choices are already on the board.** `targetPick` stages a target and `confirmTargetPick`
  spends; `pick` modes cover the Broadway pitch, the Phantasmal swap and discards. The one Main-side choice
  made in a dialog is Counterfeit's (`promptCounterfeit`).
- **One window builder for every seat.** `promptHumanResponse` renders the window for solo, the netplay host's
  own seat and a guest. It offers the engine's eligibility (`eligibleQuicks` → `E.canCastQuick`) and asks the
  notification setting only whether to stop you (`promptedQuicks`). Answers go through `humanResponds` /
  `humanDeclines`; a guest sends `{op:'respond', id, coid, pitch, target}` or `{op:'decline'}`, and the host
  re-validates.
- **Stack rows already name their targets** (`stackRowsHTML`, shared by `#stackView` and the modal).
- **Drags already explain a refusal in the air.** `highlightTarget` asks the question the release will ask
  and writes the reason into `#dropHint` while the card is still being dragged.

## The design

### Two drop zones

- **The middle of the play area fights.** It runs what the Fight button runs with a selection: from Main it
  crosses into the Fight Sub-Phase, the go-round at the crossing included, then plays; in the Fight Sub-Phase
  it plays. If someone casts into the crossing, you are held in the Fight Sub-Phase with the cards still
  selected, as today (`nettest_heldplay`).
- **The cast zone activates.** In Main it runs `ctxAction()`'s own `run`; while you hold priority in a window,
  it answers the window. Both zones are live in both sub-phases, and a refusal shows in `#dropHint` (a
  Technique dropped there in the Fight Sub-Phase: *"The fight has begun — effects are a Main-half move."*).
- **Where you drop decides what a drag means, not the sub-phase.** That replaces Aj's epic-step-20 rule,
  *"dragging to play activates card effects now, except when in the fight sub-phase"*, and inverts
  `dragtest`'s premise with it.

### The stack strip

- A strip at the bottom of the play area that shows each object as a card, newest on top, each naming who cast
  it and at what (the `stackRowsHTML` text, kept).
- Every cast lands there through one presentation: yours, a rival's, an AI's, a guest's. That gives answered
  Quicks the animation they have never had. An object leaves the strip when it resolves.
- **Do not bolt an animation onto the modal path instead.** That would be a third presentation to keep in step.
  And the strip and the glow ship together, as Aj asked: shipping one leaves the modal's prose half in place.
- **The window's sentence moves here**, because it is the decision's context: who cast what at whom, *"It does
  not target you — countering only helps …"*, and at Resolution who is about to be struck, the Fighter Kick
  warning included.

### Priority on the board

- When you hold priority and can act, the cards you can cast glow and Pass is live. The table waits for you,
  and nothing covers the board.
- **Activate does not pass.** You keep priority after a cast and can stack another (§2 step 2, *"holding
  priority"*); only Pass hands it on.
- Other seats see the strip and who holds priority. They never see a staged card.

### Staging

- Drop a card on the stack, or tap it (⚖5): it sits there **staged**, visible only to you, with nothing spent.
- Make its choices on the board with the existing pickers: a rival's panel, an Equipment, a Broadway card in
  your hand, or (new) a card on the strip, for Counter Spell.
- ⚡ Activate sends it, and only then does it appear for everyone. Cancel, or dragging it back to your hand,
  returns it.

## Rulings needed

1. **⚖ One cast zone or two?** The message names "the right side of the play area" to activate and "the stack
   visualizer down at the bottom" to respond. **Default: one.** The strip is the cast zone everywhere, so
   *drop on the stack = cast* is a single rule, in Main and in every window. If two: is "the right side" the
   right edge of the table, where the Equipment zones sit today, or the card reader panel beside it?
2. **⚖ Does a card with nothing to choose still wait for ⚡ Activate?** **Default: yes. Dropping never spends;
   Activate always does.** That is what makes every drop cancellable. It costs one more press for an
   untargeted cast, which a Main drag casts at once today.
3. **⚖ The accidental Next.** No takebacks, so the guard goes on the press. Options:
   - (a) **Glow first.** In Main, the cards you can still use glow; Next stays plain while any of them is
     Main-only and lights up when none is. Costs nothing, prevents nothing.
   - (b) **Confirm only when it costs something.** While anything Main-only is still usable, the first press
     of Next (or Pass) turns the button into "Leave Main? ▸" for a few seconds, and a second press crosses.
     A Quick does not count, since crossing does not lose it. With nothing Main-only usable it is one press,
     as today, so a dead Main gains no chore (the September ruling, *"don't auto advance @\_@ they can pass
     from fight"*, stands).
   - (c) **Hold to cross.** A half-second press while anything Main-only is still usable.
   - (d) **Demote Next.** The big button only fights; crossing without playing moves to a smaller control.

   **Default: (a) + (b).** With the drop zones, most turns never touch Next at all.
4. **⚖ Where Pass lives in a window.** **Default: the action row's Pass button**, carrying today's per-window
   label (`declineLabel`: "Let it resolve", "Move to the fight", "Start the round", "Let the round resolve",
   "End the round", "Let the counter come off"). Fight is off while you hold priority in a window.
5. **⚖ Taps.** Every drag needs a tap equivalent: for phones, for players who click, and for the suites, which
   mostly click. **Default: tap a glowing card and press ⚡ to stage it**, the way ⚡ Activate works in Main
   today. The Fight button is unchanged.
6. **⚖ Notifications.** **Default: ON · AUTO · OFF keep their meaning.** They decide whether the table waits
   for you (cards glow, Pass live) or passes for you. What glows is always the engine's answer, never the
   setting. One question this raises, not a proposal: with no modal, being stopped costs far less, so is
   AUTO still the right default?
7. **⚖ Scope.** **Default:** the Respond? window (every priority point) and Counterfeit's picker go. The
   Outbalance hand read, the pile viewer, the end screen and the menus stay dialogs.
8. **⚖ Phones and landscape.** Measured at 390×844 portrait: the play area is 320×267 with the pile 165px
   wide and about 75px to its right. Landscape has no spare height at all (that is `landscapetest`'s whole
   job). **Default: on a phone the strip overlays the bottom of the play area only while the stack is
   non-empty, and the strip is the cast zone**, which is why ⚖1 matters most there. Measured before it is
   built.

## Invariants, not up for ruling

These are rules this repo already has (CLAUDE.md):

- **A staged card never touches `st`.** Everything on state travels in netplay snapshots, so staging is UI
  state, like `targetPick`. ⚡ Activate sends today's intents (`activate`, `respond`) with their choices, and
  the host re-resolves them (`resolveIds`). Nothing new goes on the wire.
- **What glows is the engine's answer** (`E.canCastQuick`, `ctxActionFor`), never the notification setting:
  a preference must not decide what is legal.
- **One path for every seat.** The replacement for the modal renders for solo, the host's own seat and a
  guest alike.
- **No takebacks.** The crossing stays irreversible; any guard is UI only.
- **No legal target, no glow.** Targeting happens on cast.
- **A glow is checked in its computed style**, with `.enter` and reduced motion staged: carrying `.tut-spot`
  was not glowing (v1.33.15).

## What it does not change

The rules, `engine.js`, `ai.js`, `netview.js` and the wire, as far as this draft can see. The engine already
has the stack, the go-round, per-card castability and cast-time targets, and the AI never touches the UI.

## Traps found while drafting

- **A drag only starts on your turn.** `onPointerDown` returns unless `state.turn === YOU`, and a response is
  usually cast on someone else's turn.
- **`updateActions` turns everything off when it is not your turn** (*"Rival is fighting…"*), so holding
  priority on another seat's turn needs its own branch.
- **`netwindows` answers a window by clicking `#respDecline`, and 64 suites install it.** Its list still names
  two deleted modals (`pfDecline`, `sgNo`).
- **About 36 suites drive the Respond? window**, through `fightclick`'s `windowUp` / `respQuicks` /
  `clickQuick` / `clickDecline` or straight through its DOM. `lessontest_phases` drives it most: the Phases and
  Quicks lesson has the player spring Counter Spell and then Leyline Ascension from it.
- **`lessonQuicksSteps` is dead code.** It holds the deleted Quicks lesson's steps, still describing *"When
  the Respond? prompt pops up…"*, and nothing calls it. Step 7 deletes it.

## Steps

Each step PRs into the epic; a merge that changes the page bumps the epic's fourth number. The full sweep runs
on the epic before it merges.

1. **The friction fix: drop zones and the Next guard (⚖1–3).** `dragtest` rewritten. It plays on its own, so
   Aj can try it first.
2. **Glow**, in Main and in windows, asserted by computed style.
3. **The stack strip**, replacing `#stackView`'s rows, with every cast flying in through one presentation.
4. **Staging for Main casts**, and Counterfeit's picker onto the board.
5. **Windows on the board.** The test helpers first (`fightclick`, `netwindows`), so most suites follow with no
   edits; then the board version of `promptHumanResponse` for every seat, the tap path and the labelled Pass.
6. **Phones and landscape.**
7. **The lessons.** Phases and Quicks rebuilt around the board, every lesson that mentions the window re-read
   (a lesson that narrates a mechanic is an audit of it), and the dead `lessonQuicksSteps` deleted.
8. **Delete the modal path**, sweep on the epic, merge.
