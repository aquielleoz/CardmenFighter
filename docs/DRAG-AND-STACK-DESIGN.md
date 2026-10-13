# Drag and stack: playing from the board

**Status: RULED by Aj, 2026-10-13. Nothing is built yet; step 1 is next.** The work lives on
`epic/drag-and-stack`: every step PRs into it, and `main` sees one merge at the end. One question is still open,
and it belongs to step 5: where the stack visualizer sits on a portrait phone.

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

## The design, as ruled

### Two drop zones, and no Next

- **The middle of the play area fights. The right side is the stack visualizer**, and dropping a card on it is
  how you cast. It takes its room from the play area, so the hand and the card-reader pane keep theirs.
- **The Next button is gone; the Fight Sub-Phase stays.** You leave Main by fighting (drop in the middle, or
  select and press Fight) or by Pass. Crossing into the fight is still a priority point: if someone casts there,
  your cards stay selected and you choose again, as today (`nettest_heldplay`).
- **⚡ Activate and Fight stay**, so every drag has a tap equivalent.
- **Where you drop decides what a drag means, not the sub-phase.** That replaces Aj's epic-step-20 rule,
  *"dragging to play activates card effects now, except when in the fight sub-phase"*, and inverts
  `dragtest`'s premise with it.

### The stack visualizer

- Each object shows as a card, newest on top, naming who cast it and at what (the `stackRowsHTML` text, kept).
- Every cast lands there through one presentation: yours, a rival's, an AI's, a guest's. That gives answered
  Quicks the animation they have never had. An object leaves when it resolves.
- **Do not bolt an animation onto the modal path instead.** That would be a third presentation to keep in step.
  And the visualizer and the glow ship together, as Aj asked: shipping one leaves the modal's prose half in place.
- The right edge of the table is also where the Equipment zones sit today, so the visualizer shares that side.

### Staging a cast

- Drop a card on the visualizer, or select it and press ⚡: it sits there **staged**, visible only to you, with
  nothing spent. A card with nothing to choose waits too.
- Make its choices on the board with the existing pickers (a rival's panel, an Equipment, a Broadway card in
  your hand) or, new, a card in the visualizer, for Counter Spell.
- **⚡ Activate sends it**, and only then does it appear for everyone. Until then its ✕, or dragging it back out,
  cancels it. The ✕ goes once it is activated: no takebacks.

### When the game stops for you to answer

- **The Respond? box stays, small.** It carries the decision's sentence — who cast what at whom, *"It does not
  target you — countering only helps …"*, and at Resolution who is about to be struck, the Fighter Kick warning
  included — and two buttons, **Yes** and **No**.
- **Yes** closes it, and the cards you can cast glow. Drop one on the visualizer (or tap it and press ⚡), or
  press **Pass**, which names the moment as today's decline button does (`declineLabel`: "Let it resolve",
  "Move to the fight", "Start the round", "Let the round resolve", "End the round", "Let the counter come off").
- **No** passes, the same as Pass.
- **Activate does not pass.** You keep priority after a cast and can stack another (§2 step 2, *"holding
  priority"*); only Pass or No hands it on.
- **Notifications are unchanged.** ON · AUTO · OFF decide whether the box appears at all.
- The box drops the per-card buttons, the copied table summary and the Peek button: your hand and the board
  are the list now.
- Other seats see the visualizer and who holds priority. They never see a staged card.

## Rulings, 2026-10-13

1. **One cast zone: the stack visualizer, on the right of the play area. The middle fights.** *"this will eat
   up a part of the play area so hands and description pane are not affected... ideally"*
2. **Dropping places a card; Activate casts it.** *"drop to the stack vis and then activate. or you can drag it
   out to clear, or there will be an x button to cancel your attempt. once you activate, that x button
   disappears."*
3. **Next is removed; the Fight Sub-Phase stays.** *"Maybe we remove Next button... But we still keep the
   fight sub-phase of course."* Confirmed when asked.
4. **Pass carries today's per-moment label.** *"the default is ok"*
5. **⚡ and Fight stay.** *"the lightning button and fight button don't disappear"*
6. **Notifications are unchanged.** *"the notifs still work the same"*
7. **A small Respond? box first, then your hand.** *"it becomes Respond? and then yes you go view your hand i
   think that's for every activated card. select no, and it's the same as pass. when you can view your hand..
   pass also is pass."* Confirmed as a Yes / No box when asked.
8. **Phones and landscape: open.** Aj asked *"i guess landscape keeps the modals?"*; the measurements are below.

## Still open

- **Where the visualizer sits on a portrait phone (step 5).** Measured with a full five-card play on the table:

  | viewport | play area | room right of the pile | card size there |
  | --- | --- | --- | --- |
  | desktop 1440×900 | 980×551 | 277px | 80×116 |
  | laptop 1280×800 | 842×460 | 258px | 61×88 |
  | landscape 932×430 | 566×170 | 156px | 46×67 |
  | landscape 844×390 | 506×149 | 126px | 46×67 |
  | portrait 390×844 | 320×267 | 53px | 38×55 |
  | portrait 360×740 | 290×353 | 38px | 38×55 |

  Landscape has the width; what it lacks is height, so several cards in the visualizer would overlap sideways.
  A portrait phone has no width for a right-hand column, but it has spare height under the pile.
  **Recommendation: one design everywhere**, with the visualizer on the right where there is width and under the
  pile on a portrait phone. No layout keeps the old modal, because two answer screens drift apart. The
  Respond? box itself is a small modal on every layout.
- **Counterfeit's picker.** Not ruled. Default: its choice moves onto the board like the other Main pickers.
- **Glow in Main.** Aj's glow is for answering. In Main the board already greys the effects you cannot afford
  (`markAfford`). Default: glow only when answering, unless Aj wants it in Main too.

## Invariants, not up for ruling

These are rules this repo already has (CLAUDE.md):

- **A staged card never touches `st`.** Everything on state travels in netplay snapshots, so staging is UI
  state, like `targetPick`. ⚡ Activate sends today's intents (`activate`, `respond`) with their choices, and
  the host re-resolves them (`resolveIds`). Nothing new goes on the wire.
- **What glows is the engine's answer** (`E.canCastQuick`, `ctxActionFor`), never the notification setting:
  a preference must not decide what is legal.
- **One path for every seat.** The new Respond? box and the board answer render for solo, the host's own seat
  and a guest alike.
- **No takebacks.** The crossing stays irreversible, and so does an activated cast.
- **No legal target, no glow.** Targeting happens on cast.
- **A glow is checked in its computed style**, with `.enter` and reduced motion staged: carrying `.tut-spot`
  was not glowing (v1.33.15).

## What it does not change

The rules, `engine.js`, `ai.js`, `netview.js` and the wire, as far as this draft can see. The engine already
has the stack, the go-round, per-card castability and cast-time targets, and the AI never touches the UI. The
one wire change is a deletion: see the first trap below.

## Traps found while drafting

- **Next has its own wire op.** A guest's Next press sends `{op:'toFight'}`, and both host drivers handle it
  (`hostApplyMove` and `hostApplyMoveN`). With Next gone the op has no sender: delete both handlers in step 1,
  then run the `name:name` grep and a UI suite, per CLAUDE.md's deletion rules.
- **Next is load-bearing in the harness and the lessons.** 9 suites step out of Main through `fightclick`'s
  `enterFight`, which presses Next; 7 more read its label (`fightbeattest`, `nettest_fightbeat`, `phonetest`,
  `peektest` and three lesson suites); 16 template lines tell the player to press it, including the Phases and
  Quicks lesson's "doorway" step. With Next gone, nothing enters the Fight Sub-Phase without playing except the
  held-fight case, so that is the Fight Sub-Phase beat's one remaining trigger.
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
  the Respond? prompt pops up…"*, and nothing calls it. Step 6 deletes it.

## Steps

Each step PRs into the epic and keeps the sweep green on its own; a merge that changes the page bumps the
epic's fourth number. The full sweep runs on the epic before it merges.

1. **The friction fix: two drop zones, and no Next.** The middle fights; a column on the right takes casts,
   with today's stack rows moved into it; the big button is Fight only. Everything that says or presses Next
   changes in the same step: the hint, the lessons' Next steps, `enterFight` and the in-page helpers,
   `fightbeattest`, `nettest_fightbeat`, the `toFight` handlers, and `dragtest` rewritten. Every layout gets a
   basic place for the column, so `phonetest` and `landscapetest` stay green; step 5 refines it. It plays on
   its own, so Aj can try it first.
2. **Staging in Main.** A dropped card waits in the column with its ✕, its choices made on the board, until
   ⚡ Activate. Counterfeit's picker moves onto the board.
3. **The visualizer shows cards**: card art with who cast it and at what, every cast flying in through one
   presentation.
4. **The Respond? box and answering on the board.** The box shrinks to its sentence and Yes / No; Yes lights
   the castable cards (asserted by computed style); No and Pass pass. The test helpers change first
   (`fightclick`, `netwindows`), so most suites follow with no edits; then every seat at once, through
   `promptHumanResponse`.
5. **Phones and landscape**, from the measurements above.
6. **The lessons.** Phases and Quicks rebuilt around the box and the board, every lesson that mentions
   answering re-read (a lesson that narrates a mechanic is an audit of it), and the dead `lessonQuicksSteps`
   deleted.
7. **Delete the old modal path**, sweep on the epic, merge.
