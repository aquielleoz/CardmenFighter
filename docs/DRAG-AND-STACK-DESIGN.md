# Drag and stack: playing from the board

**Status: RULED by Aj, 2026-10-13, and rechecked against the code the same day. Step 1 is BUILT and merged into
the epic (PR #421, 2026-10-14, v1.33.16.1), step 2 merged (#422, v1.33.16.2), and step 3 is built (v1.33.16.3);
step 4 is next.** The work lives on `epic/drag-and-stack`: every step
PRs into it, and `main` sees one merge at the end. The recheck corrected several counts in this doc and found traps
it had missed; Aj ruled four more questions on the back of it (rulings 9 to 12; 9 and 10 make step 1 larger), and
four more after playing step 1 (13 to 16). Two questions are still open: whether a cast
passes priority in AUTO (step 4), and where the stack visualizer sits on a portrait phone (step 5).

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
   **Dragging makes it worse.** In Main a drag can only activate, so a dragged pair is refused while it is still
   in the air (`#dropHint`: *"one card at a time in the Main sub-phase"*), and a dragged card that has an effect
   gets activated instead of played. A player who drags learns to press Next every turn. (The two release
   messages that say *"press Next"*, in `onPointerUp`, are unreachable: the hover refuses first.)
   **Fight in Main has the same accident.** It stays enabled for an *illegal* selection: pressing it crosses into
   the Fight Sub-Phase (`moveToPlayThen` runs before `playCards` refuses) and then plays nothing. Removing Next
   does not fix that on its own.
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
- **Main's casting choices are already on the board, in three stagers.** `targetPick` stages a rival and
  `confirmTargetPick` spends; `targeting` stages an Equipment, Ride or Form for a `removeEquip` card
  (`stageRemove`, confirmed through `doRemove`, a third cast tail); `pick` modes cover the Broadway pitch, the
  Phantasmal swap and discards. The one Main-side choice made in a dialog was Counterfeit's (`promptCounterfeit`, deleted at step 2: the copy is
  picked on the pile now).
  Phantasmal Illusion is the odd one out today: it has its own intent (`{op:'phantasm'}`), never goes on the
  stack and ends like a play. Ruling 12 puts it on the stack.
- **One window builder for every seat.** `promptHumanResponse` renders the window for solo, the netplay host's
  own seat and a guest. It offers the engine's eligibility (`eligibleQuicks` → `E.canCastQuick`) and asks the
  notification setting only whether to stop you (`promptedQuicks`). Answers go through `humanResponds` /
  `humanDeclines`; a guest sends `{op:'respond', id, coid, pitch, target}` or `{op:'decline'}` (with `auto:true`
  on an auto-pass, and `clientSend` adds the `pg` grant to both), and the host re-validates. A board answer must
  keep sending all of them.
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
- **Fight in Main is live only for a legal play.** With nothing selected, or a selection that cannot be played,
  it is disabled, so the irreversible crossing can only be started by a play that will land (or by Pass). A
  middle drop asks the same whole question while the card is in the air.
- **The Fight Sub-Phase shows on every crossing** (ruling 10). Today a quiet crossing auto-advances inside one
  engine call, so no render ever paints Fight; after step 1 your own crossing paints the Fight colour and its
  beat briefly every time, before the play lands.
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
  That is true of a duel on desktop and in landscape; on a portrait phone the zones live in the seat panels, and
  at 3-6 players only your own Equipment sits there (bottom right).

### Staging a cast

- Drop a card on the visualizer: it sits there **staged**, visible only to you, with nothing spent. A card with
  nothing to choose waits too. This ships in step 1 (ruling 9), so the first build never casts on release.
  A tap is unchanged (ruling 11): select a card and press ⚡, and it casts at once, or enters today's stager if it
  has something to choose.
- Make its choices on the board with the existing pickers (a rival's panel, an Equipment, a Broadway card in
  your hand) or, new in step 4, a card in the visualizer, for Counter Spell. Counter Spell is never castable in
  Main (`activateBlock` refuses it there), so that picker has nothing to do before answering moves onto the
  board.
- Today's stagers refuse a new drag while they are open (`onPointerDown` returns on `pick`, `targeting` and
  `targetPick`), so dragging a staged card back out needs a pointer source in the column itself.
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
  priority"*); only Pass or No hands it on. **True today only in ON**: in AUTO, the default, your own cast never
  stops you (`promptWanted` returns false when `state.pending.p===YOU`), so you are passed straight on. See
  "Still open".
- **Pass in a window must decline priority.** Today's Pass button runs `doPass` → `E.pass`, which sits you out of
  the round; answering on the board needs it to call `humanDeclines` → `E.declineResponse` while a window is
  yours.
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
9. **Staging moves into step 1** (2026-10-13, after the recheck). Asked whether step 1 should cast a no-choice
   card the moment it is dropped (today's Main drag) or wait for ⚡, Aj picked *"Pull staging into step 1"*: every
   drop on the column waits for ⚡ Activate and has its ✕ from the first build.
10. **Show the Fight Sub-Phase briefly on every crossing** (2026-10-13). Asked whether a quiet turn should go
    straight from Main to the next player, Aj picked *"Show Fight briefly every turn"*: your strip paints Fight and
    the beat plays on every crossing of yours, not only a contested or held one. This replaces the 2026-10-02 rule
    that the beat *"should only fly in for next"*, which has no Next left to apply to. Opponents' crossings were not
    asked about. **Ruling 17 changes how it shows: a flash on the hand, no banner, no pause.**
11. **A ⚡ tap still casts at once; only a drop stages** (2026-10-14). Asked whether select + ⚡ should also put
    the card in the column and need a second ⚡, Aj picked *"Tap casts at once"*: selecting the card is already
    the moment to change your mind (Clear undoes it), as today. Cards with a choice still enter today's stagers
    on the tap, as they do now.
12. **Phantasmal Illusion is a cast that goes on the stack, and its resolution crosses into the fight**
    (2026-10-14). In Aj's words: *"fully activating the phastasmal illusion puts the effect on the stack. it's a
    copy+fight as you mentioned. an opponent can still try to backstab you at that point. and since we resolve
    in lifo, back stab effectively cancels the fight part of the phantasmal illusion. also, resolving phantasmal
    illusion also causes the phase change, and resolving it does the priority dance before changing subphases and
    before it resolves. this is just a complex card"*. So it takes the cast column, not the middle. The engine half
    is a rules change: today `E.phantasm` never touches the stack and resolves on the spot. It is not part of step
    1, which keeps today's engine behaviour and only routes the drop to the column; it is filed with the Illusion
    sub-phase leak in `main`'s BACKLOG (`illusion-leaks-fight-subphase`), since the code it touches is unchanged
    by the epic.
13. **A staged card carries ⚡ and ✕ side by side** (2026-10-14, after playing step 1): *"can we add a lightning
    bolt near the card. i know the description box already has a lightning bolt but i'd like another beside the
    take back. we can reduce the take back to an X button probably"*. Built in #421: the column's ⚡ runs the
    action row's own ⚡ Activate and copies its state (gold when it would cast, 🎯 while a target is owed), so it
    is a second place to press, not a second cast path.
14. **The Fight beat does not dim the board; the round banners still do** (2026-10-14): *"having the fight
    sub-phase dim is kinda annoying. letting the hand flash yellow for the fly in is fine tho"*, then *"keep the
    round banners dimmed"*. Ruling 10 made the beat fire on every crossing, which is why its dim became the
    cost. Built in #421: the banner keeps a dark plate behind its words only.
15. **Equipment moves left, beside Forms & Rides; the right edge holds only the stack** (2026-10-14). Seeing
    Hero's Javelin sit under the cast column: *"the equips should not sit there. they look like they're still
    resolving"*. Asked where it should go, Aj chose *"Left, beside Forms & Rides"* over chips in the seat bars.
    What is in play sits on the left and what is resolving on the right. Built in step 2 (#422), on Aj's call to do
    it then (*"nope, do it now please"*): `placeEquipZones` sets each seat's Equipment 12px past its own Forms zone,
    on desktop and tablet. **The landscape band keeps the right corners for now**: its left column already holds
    both Forms zones, and a five-card pile is about 203px wide and centred, so Equipment beside the Forms there would
    run under the pile. That band, where the column also has only the gap between the two Equipment chips, is step 5.
16. **A ⚡ tap on a card with a choice shows it in the column while you choose** (2026-10-14). Seeing the targeting
    screenshots, Aj noted *"your screenshots don't show the stack visualizer"*; asked whether a tapped card that
    needs a target should also sit in the column while its target is picked, Aj chose *"Yes, show it in the
    column"*. This refines ruling 11 and does not reverse it: a card with nothing to choose still casts on the
    tap. Built in step 2: the card a picker holds is the staged card, whichever gesture opened the picker.
17. **The Fight Sub-Phase is a yellow flash on the hand, with no banner and no pause** (2026-10-14, after playing
    step 3). Aj: *"the pause for the announcement for the fight is really jarring... can we just keep the yellow
    color and skip the announcement?"* and *"if no one plays a card it's like hitting a speed bump at full
    speed"*. This replaces ruling 10's beat: every crossing still SHOWS, as `flashFight()` on `#handWrap`, but
    the play lands at once. Built in step 3.
18. **A shield loss is not drawn in the stack visualizer** (2026-10-14). Aj: *"pending shield loss? those aren't
    part of the stack!"* PHASES-AND-PRIORITY §1 and §4 say the same: the Stack holds effects only. The red
    "loses a shield" row rendered in the column and under the Respond? box's "On the stack" label. *Built in step
    3:* it is in neither; when an effect is also waiting, the box says the stake in a sentence of its own
    (`pendingLossLineHTML`), and with the stack empty the box's lead already says it.
19. **A triggered ability shows the card it comes from** (2026-10-14). Aj, on the Equipment upkeep tick: *"since
    we have a visualizer now, let's add the cursed pendant card image to the visualizer"*. The tick shows as a
    text tile (`.stkTrig`). The tick belongs only at Upkeep (Aj: *"upkeep tick... should happen during the
    upkeep"*). *Built in step 3:* the column draws the Equipment's card (`trigCard`, by the tick's `eqId`, which
    `netview` now carries), marked ⏳; the tile is left only for a trigger whose Equipment a Disarm has taken.
    Measured: in 600 AI games at 2, 3, 4 and 6 players, a trigger was on the stack at 2,596 checks, every one
    of them inside Upkeep.
20. **Every cast holds the game for the art flash** (2026-10-14). Asked how long a cast should stay in the
    visualizer, Aj: *"as long as the art flash should be good"*. Asked whether your own casts and other humans'
    casts should also hold the game for it (today only an AI's cast does, through `revealDwell`), Aj: *"yes"*.
    So the card stays in the column for the flash's length (`flashArt`'s 2500ms with effect text, 1350ms
    without, 900ms reduced motion) and nobody acts until it ends, on every seat. *Built in step 3:* one hold, started
    where every seat presents a cast (`presentStackArrival`), for that card's flash length (`artFlashMs`). While it
    runs the seat's board refuses plays, casts and passes, the hint reads "Hold on — <card> is being cast.", a
    Respond? box waits, and solo's AI seats wait to answer. Selecting cards stays free. Each seat holds for its own
    flash, so a netplay host never waits on the wire for it. The ghost that lands a resolved cast in the column now
    rests there for the same length.
21. **In AUTO a cast on the board passes priority for you, as today; ON is the mode for stacking your own** (2026-10-15).
    Asked whether a cast from the board should keep priority with you or pass it on in AUTO, Aj accepted *"in AUTO,
    the game auto-passes priority after your cast just like it does now, preserving the 'no stake, no stop' rule,
    while ON remains the mode for stacking your own spells"* with *"ahh yea that sounds about right"*. So
    "Activate does not pass" holds in ON only, and the 2026-09-24 rule stands.
22. **In ON, after you answer from the board, the small Respond? modal comes back**, so you can stack on your own
    answer (2026-10-15, Aj: *"yes, your read is right"*). AUTO does not (ruling 21).
23. **The small modal leaves the board readable**: the cast column, the pile and the phase strip stay visible and
    undimmed behind it, so there is no Peek button (Aj: *"yes, that works"*).
24. **After Yes you can reopen the small modal** (Aj: *"Yes, you can re-open."*). Default control: a small "Respond?"
    button beside Pass while you hold priority.
25. **The small modal shows the card being cast and its target**, not its rules text (Aj: *"for the small modal, we
    can have card being cast + target."*).
26. **Counter Spell never casts on the tap, even with one possible target**; you confirm its target first (Aj:
    *"counterspell, not cast strait away"*). An exception to ruling 11 for Counter Spell.
27. **Tapping a glowing Quick that sits inside a group breaks the group and selects just that card** (Aj: *"breaks
    that special and then selects the card"*).
28. **Lessons refuse the wrong glowing card with a hint.** Everything the engine allows still glows, but a step that
    names its card refuses any other (Aj: *"yes, please make tutorials as painless as possible for new players.
    activating the wrong cards is painful."*). The hook is step 4's; the step text is step 6's.
29. **While a card is staged, nothing else can be cast and Fight stays off; ✕ is the way out** (Aj: *"nah we can keep
    fight not being usable. pressing X is better"* and *"you should not be able to activate sabotage because
    something else is being staged (just like the fight case)"*). Measured: that is already true (with a second
    card selected every ⚡ is off). Dropping a second card on the column swaps it in, the first back to hand with
    nothing spent. So no window can open over a staged card, and the inventory's question about one dissolves.
    One wording fix is owed: with a second card selected the hint still says "⚡ Activate casts it" while that ⚡
    is off.
30. **Landscape: Equipment moves to the left column, on its seat's Forms, in a collapsible** (2026-10-19). Shown three
    casts on an 844x390 table wedged into the 30-50px between the two corner Equipment chips, Aj: *"left, under forms
    in a collapsible. is that possible?"*. The Rival's chip sits under its Forms, yours just above your Forms (under
    yours is the table's edge); collapsed it shows its counter over its art, and a tap opens the desktop box as a
    popover. Where the table is too short for both (667x375), each sits beside its own Forms. The right edge is then
    the stack's alone. *Built in step 5, piece 1.*
31. **Landscape: the stack is smaller cards, no captions** (2026-10-19, Aj's pick of three). Every card takes the
    same scale, the largest at which all of them fit; when one per row would be under about 23x33px they share rows,
    newest first. Tapping a card still reads it. *Built in step 5, piece 1.*
32. **Portrait phones hide the card reader** (2026-10-19). Asked where the stack goes on a 390x844 phone, Aj asked
    *"why is there a description box at the bottom?"*, then chose to hide it: every portrait phone reads a card
    through 🔍 View, as the ones under 800px tall already do. *Built in step 5, piece 2.*
33. **On a narrow portrait phone the pile laps like a group in your hand, and the stack stays on the right** (Aj:
    *"can we overlap the in play cards similar to the grouping up in the hand? only for narrow screens?"*, confirmed
    as the pile, and *"stack should be on the right still"*). The lapped pile stops reaching under the column.
    *Built in step 5, piece 2:* at least a hand group's lap, and further when the play is long or the table narrow
    (`lapPile`), so any play centred on the table ends clear of the column.
34. **On a narrow phone the Respond? box stays at the top and gets a minimize** (Aj: *"keep it at the top, this will
    have a minimize/peek right?"*, then *"Add a minimize"* over relying on Yes). It shrinks the box to a thin tab
    that opens it again, so the Rival's bar is readable while you decide. *Built in step 5, piece 3:* ▾ shows only
    while the box is at the top (`atTop`); minimized, it is its title, ≤40px, clear of the Rival's bar, and of the
    pile and the stack on a 667x375 table. The backdrop still holds the board until Yes or No.
35. **A portrait phone's stack is the landscape one: smaller cards, no captions, fitted to the column** (2026-10-19).
    Shown three casts at 360x740, where the 76px column wrapped each caption onto 4-5 lines and fitted two of three,
    Aj chose *"Like landscape"*. *Built in step 5, piece 2.*

## Still open

- ~~**Does a cast on the board pass priority in AUTO (step 4)?**~~ Ruled: ruling 21, it passes for you, as today.
- ~~**Where the visualizer sits on a portrait phone (step 5).**~~ Ruled 2026-10-19: rulings 30-34. Re-measured that day
  in a browser before building: the column was 26-57px tall in the landscape band (one of three casts in view) and
  covered 71-100% of the pile's last card on a portrait phone. The original measurements, for the record:

  | viewport | play area | room right of the pile | card size there |
  | --- | --- | --- | --- |
  | desktop 1440×900 | 980×551 | 277px | 80×116 |
  | laptop 1280×800 | 842×460 | 258px | 61×88 |
  | landscape 932×430 | 566×170 | 156px | 46×67 |
  | landscape 844×390 | 506×149 | 126px | 46×67 |
  | portrait 390×844 | 320×267 | 53px | 38×55 |
  | portrait 360×740 | 290×353 | 38px | 38×55 |

  The "room" column is measured to the pile's cards, so it is a fixed slot only from 1200px wide, where
  `#pile{max-width:calc(100% - 260px)}` keeps the pile box 130px clear of each edge whatever it holds. Below that
  it shrinks as the pile grows, and custom rules allow plays of up to ten cards (by the CSS, a ten-card straight
  at 844×390 leaves about 21px). On a portrait phone `placeZones` moves the Equipment and Forms zones out of the
  table into the seat panels, and a 3-6 player table hides the rival zones, so neither has anything on the
  table's right edge. At 800×360 the band between the two corner Equipment chips is ~31-33px by the CSS, not
  enough for one card. Re-measure all of this in a browser before step 5 builds against it.
  Landscape has the width; what it lacks is height, so several cards in the visualizer would overlap sideways.
  A portrait phone has no width for a right-hand column, but it has spare height under the pile.
  **Recommendation: one design everywhere**, with the visualizer on the right where there is width and under the
  pile on a portrait phone. No layout keeps the old modal, because two answer screens drift apart. The
  Respond? box itself is a small modal on every layout.
- **Glow in Main.** Aj's glow is for answering. In Main the board already greys the effects you cannot afford
  (`markAfford`). Default: glow only when answering, unless Aj wants it in Main too. *Built that way in piece 6.*

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

The rules, `ai.js` and `netview.js`. The engine already has the stack, the go-round, per-card castability and
cast-time targets, and the AI never touches the UI; removing Next changes nothing the AI does (`takeTurn` calls
`E.moveToPlay` itself). Two places the recheck found it is not quite "nothing":

- **`engine.js`, optionally.** `E.play` crosses into the Fight Sub-Phase *before* it checks the play (its
  `moveToPlay` call comes ahead of the combo and `beats` checks), so a guest's stale or illegal play still
  crosses. Step 1's disabled Fight covers every honest client; validating before crossing is the only engine
  change in sight, and it is hardening rather than a requirement.
- **The wire, at step 3.** Staging adds nothing (it is UI state, sent as today's intents), and step 1's one wire
  change is a deletion (`toFight`). But step 3's "every cast lands through one presentation" needs the host to
  tell the other seats when an *answer* is cast, and nothing does today (see the traps).

## Traps

Found while drafting, then corrected and extended by the 2026-10-13 recheck against the code.

- **Next has its own wire op.** A guest's Next press sends `{op:'toFight'}` (the client branch of `doFight` is
  its only sender), both host drivers handle it inline (`hostApplyMove` and `hostApplyMoveN`), and the NET-scope
  `CEREMONY_REFUSE` map names it too. Delete the sender, both handlers and the key in step 1. The handlers are
  inline blocks, not functions, so the `name:name` grep has nothing to find; run a UI suite afterwards anyway.
  `moveToPlayThen`'s ledger default `via||'Next'` is left naming a deleted button.
- **Next is load-bearing in the harness, more than first counted: about 22 suites.**
  - 9 step out of Main through `fightclick`'s `enterFight`, which presses Next (`nettest_ridewedge` only
    imports it).
  - 6 depend on the Next label: `fightbeattest`, `nettest_fightbeat`, `phonetest`, `peektest`,
    `lessontest_phases` and `lessontest_initiative`. `lessontest_howto` reads the label with a card selected,
    so it reads "Fight" and is unaffected.
  - More read "Fight is enabled with nothing selected" as a live board, which is Next's state:
    `fightclick`'s `driveStep` (so `mptest`, whose phase-strip leg needs that press to ever see Fight, and
    `nettest_ceremony`), `nettest_roundlock` and `nettest_parity`.
  - `resolutiontest_ui` scenario H presses Next to cross; `nettest_prefightduel` has a dead second press.
  - `lessontest_phases` cannot wait for step 6: its doorway leg presses Next.
  - `fightbeattest`'s positive legs are the only solo proof that the beat fires, and a held fight cannot be
    staged solo. Ruling 10 gives them a new trigger: every crossing.
- **10 template lines put the board's Next in front of the player, not 16**: the two dead release messages in
  `onPointerUp`, the two Main hints in `updateActions` (`mptest` asserts their wording), and steps of three
  lessons: How to Play (two), Energy & Effects (one), and the Phases and Quicks doorway (its text, `onlyHint` and
  `wait`). Seven more sites put the word on a label or in the ledger: `ACTION_ICONS`, three `setActionLabel`
  calls (one of them the resting default every disabled state shows), and the ledger's `[Next]`.
- **Three live docs state the rules step 1 deletes**, and change in the same PR: `PHASES-AND-PRIORITY.md` §3
  (Fight "plays nothing"; "THE SUB-PHASE DECIDES WHAT A GESTURE MEANS"), which is the spec and says the code is
  the bug wherever they disagree; `NEXT-SESSION.md`'s facts block (`#fightBtn` has two states); and
  `DECISIONS.md#main-autoadvance` ("Next and Pass are different buttons").
- **Four lesson steps that teach ⚡ Activate carry no `only`**: How to Play, Energy & Effects, Rides and Forms.
  Today a Main drag of the glowing card activates it; after step 1 a middle drop fights it away and the step
  cannot finish (a Ride needs a second J to recover). They need `only:[]`, or the middle must refuse the
  spotlit card.
- **A held Pass also leaves you in the Fight Sub-Phase with nothing played** (`doPass`: *"your pass is on
  hold"*), so the held fight was never the beat's only remaining trigger. Ruling 10 settles it: every crossing
  shows Fight.
- **A drag only starts on your turn, and that is one of three gates.** `onPointerDown` returns unless
  `state.turn === YOU` (and on `busy` and the three stagers); `#hand.disabled` takes pointer events away
  entirely off your turn; and tap-to-select (`toggle`, `toggleGroupSelect`) is turn-gated too. A response is
  usually cast on someone else's turn, so step 4 has to lift all three.
- **`updateActions` turns everything off when it is not your turn** (*"Rival is fighting…"*), and its `busy`
  branch does the same. **`busy` is NOT true in every window you are asked to answer** (corrected by the step-4
  inventory, 2026-10-15): the `activate` tail, the transform branch and `doRemove` call `settleWindows` without
  setting it, so in a solo or host window opened by your own cast, Pass and Fight are live under today's box; and a
  guest recomputes `busy` on every mirror (`busy = owedModal …`). Holding priority needs its own branch.
- **`#stackView` is `display:none` while the stack is empty**, so it cannot be the drop target itself: the column
  is a box that is always there, with the rows moved inside it. No suite measures such a box today, so
  `phonetest` and `landscapetest` staying green means nothing until the column joins their overlap checks.
- **`netwindows` answers a window by clicking `#respDecline`, and 64 suites install it** (55 through
  `nettest_lobby`, which `nettest_strip` opts out of with `manualWindows`; 10 directly; `nettest_parity` both —
  recounted 2026-10-15). Its list still names two deleted modals (`pfDecline`, `sgNo`), and so
  do `lessonlib`'s `answerWindow` and several suites that hand-roll the same list.
- **About 36 suites drive the Respond? window**, through `fightclick`'s `windowUp` / `respQuicks` /
  `clickQuick` / `clickDecline` or straight through its DOM, and `lessonlib`'s `answerWindow` is a third helper
  that answers it for the lesson suites. `lessontest_phases` drives it most among the lessons: the Phases and
  Quicks lesson has the player spring Counter Spell and then Leyline Ascension from it.
- **Nothing tells the other seats to animate an answer (step 3).** The host's respond handlers only `say()`,
  `t:'fx'` is sent only for activations, and an answer that resolves inside one `E.respond` call never reaches
  a mirror at all.
- **`lessonQuicksSteps` is dead code.** It holds the deleted Quicks lesson's steps, still describing *"When
  the Respond? prompt pops up…"*, and nothing calls it. Step 6 deletes it.
- **A shipped bug the recheck found on the way, routed to `main`.** `E.phantasm` hands the turn on without
  resetting `subPhase`, where every other hand-off does, so after an AI's Illusion the next seat's turn starts in
  the Fight Sub-Phase and every Main effect is refused. Measured in the engine, 4 of 4. It is not this design's
  to fix, but step 1's tests will meet it.

## Steps

Each step PRs into the epic and keeps the sweep green on its own; a merge that changes the page bumps the
epic's fourth number. The full sweep runs on the epic before it merges.

1. **The friction fix: two drop zones, no Next, and staging.** The middle fights; a column on the right takes
   casts, with today's stack rows moved into it; the big button is Fight only, live only for a legal play; and
   your own crossing shows the Fight Sub-Phase every time (ruling 10). A card dropped on the column waits there
   staged with its ✕, its choices made on the board, until ⚡ Activate (ruling 9); a ⚡ tap still casts at once
   (ruling 11).
   Everything that says or presses Next changes in the same step: the hints, the three lessons' Next steps and
   the four Activate steps' `only`, the three live docs, `fightclick` (`enterFight`, `driveStep`, the in-page
   helpers) and the ~22 suites in the traps, the `toFight` sender, handlers and `CEREMONY_REFUSE` key, and
   `dragtest` rewritten for "where you drop decides". Every layout gets a basic place for the column, measured
   by `phonetest` and `landscapetest` rather than merely not breaking them; step 5 refines it. Phantasmal
   Illusion takes the column (ruling 12); its engine change is filed on `main`, not built here. It plays on its
   own, so Aj can try it first.
2. **Counterfeit's picker moves onto the board**, the last Main-side choice made in a dialog. *Built (v1.33.16.2):*
   the cards in the Rival's play pulse as targets, a tap stages one (gold), ⚡ Activate copies it and Clear backs
   out; one distinct card on the pile is staged for you. It reuses the removal's `targeting` state, so every guard
   that holds the board for a removal holds it for this. A guest's Counterfeit now names the copied card in every
   log, which only the local path did before (`sayCounterfeit`). Ruling 16 rides with it: a tapped card that
   opens a picker sits in the column while you choose, as a dropped one does. And ruling 15's Equipment move,
   everywhere but the landscape band. (Staging itself
   moved into step 1 by ruling 9; the step keeps its number so references to later steps stay true.)
3. **The visualizer shows cards**: card art with who cast it and at what, every cast flying in through one
   presentation, which needs the host to announce answers to the other seats. Some stack rows have no card to
   show (a triggered Equipment upkeep counter), and the play-area dim covers the visualizer while another seat
   holds priority. *Built (v1.33.16.3):* each object shows its card, newest on top, captioned with the row's own
   phrase (`stackObjPhrase`, shared with the Respond? box); a trigger shows as a tile; the column sits above the
   waiting dim. A cast on the stack flies in from its caster, read off `state.stack` so every seat presents it the
   same way; a cast that resolves before any render arrives through `presentStackArrival`, which every presentation
   path calls (`showFx`, the cast tails, an AI's cast and answer, the tutorial). The host now announces the cast
   tails that never did (Equipment removal, Counterfeit, your own answer) and every guest's answer, and an AI's
   answer carries its card (`respondCard`). The art pop used to sit over the column the card was landing in; Aj: *"shift if there's
   enough space, shrink if not?"* `placeArtFlash` centres it left of the column, shrinking it only when that room is
   narrower than the art (measured: shifted at 1440 and 1280 wide, shrunk from 1100 wide down to phones). The ghost that
   lands a resolved cast was a `.card`, whose `position:relative` beat `.stkGhost`'s `position:fixed`, so it sat in
   the page's flow below the hand and moved the hand up by its height: Aj's report after a King form (*"a weird banner
   appeared underneath my hand? or my hand moved up"*), reproduced at 71px and fixed (`.card.stkGhost`).
4. **The Respond? box and answering on the board.** The box shrinks to its sentence and Yes / No; Yes lights
   the castable cards (asserted by computed style); No and Pass pass, and Pass in a window declines priority
   rather than sitting the round out. Counter Spell's target is picked from a card in the visualizer. The test
   helpers change first (`fightclick`, `netwindows`, `lessonlib`), so most suites follow with no edits; then
   every seat at once, through `promptHumanResponse`. The AUTO question is ruled (ruling 21). **The inventory taken
   before building it is [`DRAG-AND-STACK-STEP4.md`](DRAG-AND-STACK-STEP4.md)**: what changes, the test blast radius,
   the traps, a ten-piece build order, and eight open questions with defaults. *Piece 1 built (v1.33.16.4):* the test helpers learn to name a
   choice rather than a box button. `clickQuick` takes `{name, id, seat, equip, pitch, oid}`, which maps onto today's
   `data-*` attributes and is where piece 5 routes a board cast; the seven suites that passed raw selectors use it.
   `castableQuicks` and `holdsPriority` (read-only hooks on `__solo` and `__cmf`, read through `fightclick`) give
   the engine's answer and "a window is owed to me" without reading the box. The dead `pfDecline` / `sgNo` ids
   left `netwindows` and `lessonlib`. The board branches the inventory lists for these helpers (Yes, then Pass) are
   deliberately NOT written yet: they have nothing to drive until piece 3 adds Yes, and an unexercised branch is
   untested code. *Piece 2 built (v1.33.16.5):* the box gains **Yes**, which closes it and leaves the
   window yours; an answer record (`answering`, live only while `answerLive()`: the grant's `prioGen`, priority still
   yours, no hold, no box up) carries the window's continuation past the box and is consumed once. The board then
   answers: **Pass declines priority** (`humanDeclines`, not `E.pass`), named by `declineLabel`; Fight is off; and
   **Respond?** in the action row reopens the box (ruling 24). The helpers learned the after-Yes state (`windowUp`,
   `clickDecline`, `driveStep`, `netwindows`, `lessonlib`'s `answerWindow`). *Piece 5 built (v1.33.16.6):* **the
   board casts.** After Yes, the hand is live on any turn, and a card cast from it is the box's own cast
   (`humanResponds`, so `{op:'respond'}` on a guest), decided by the box's questions: `E.castRefusal` for whether, and
   `E.respondChoices` / `E.pitchCands` for whether a choice comes first. `answerActionFor` is the one verdict for the
   ⚡ button, the reader's ⚡, the column's ⚡ and the drop; `answerCast` opens the answer's pickers (Back Stab's seat
   limited to `respondChoices`, a narrowed `targeting.protect` mode that lights only YOUR Equipment for Annoint, and the
   Broadway pitch), each flagged `answer` and confirmed back into the answer, never into `activate()`. Ruling 27: a
   tap takes the castable Quick out of its group (`pullFromGroup`). The selection you had (a held Fight's cards) is
   set aside on the first answering tap and given back when the answer ends or its grant goes away (`endAnswerUI`,
   run from `render`). The middle refuses a drop; `doRemove`, `doCounterfeit` and the Illusion refuse; a Main staging
   does not survive into a window; a window you hold is exempt from a lesson's read-step lock, as the box was; a
   step may name the answers it accepts (`answers`, ruling 28's hook — Phases' counter and Leyline steps do); and a
   guest whose answer the host refuses gets the window back (`rearmAnswer` on `t:'err'`). **Not yet: Counter Spell**
   — ruling 26 puts its target on the stack, which is piece 7, so until then the board says to choose it in Respond?.
   *Piece 6 built (v1.33.16.7):* **the glow.** After Yes, every card `E.canCastQuick` allows glows GREEN
   (`.answerable`), painted in `renderHand` on every render while the board is the answer — not under the box, not
   while an answer's picker holds the board, not while a card is staged (ruling 29). Green because gold already means
   a selection, a lesson's spotlight and a ready transform. It is an animation, combined with `.enter`'s deal-in and
   with `.tut-spot`'s ring, and falls back to a static ring under reduced motion that still wins on a selected or
   hovered card; `answerglowtest` reads all of it in computed style. Built as the default for "Glow in Main" below:
   answering only. *Piece 7 built (v1.33.16.8):* **Counter Spell's target, from the visualizer** (ruling 26). ⚡ on
   Counter Spell never casts it: it opens `targeting.counter`, and the stack cards in `E.counterTargets` (on
   `effectFor`, so the ♦Q's widening counts) pulse in the pick-purple every other target pick uses — the top card's gold
   ring included. A tap aims one (red ring); one target is pre-aimed, but a second ⚡ still confirms. The highlight is
   painted every render outside `renderStack`'s signature gate (`paintCounterAims`), the click reads the live picker,
   and only the visualizer's own boxes are candidates, never a ghost in flight. The oid travels as the box's did,
   unrotated, and the host re-validates it; a guest's `clientSend` trace now names it (`coid=`). The Equipment, Forms
   and opponent-zone readers of `targeting` ignore the counter mode. *Piece 8 built (v1.33.16.9):* **the box
   shrinks** (rulings 7, 23 and 25). It carries its sentence — who cast what, and at what, an Equipment or an effect as
   well as a seat (`stackTargetPhrase`) — with the card being cast beside it, and Yes / No; No's title names the moment,
   which the board's Pass carries as its label. The per-card buttons, `tableContextHTML`, `stackRowsHTML`, the rules-text
   paragraph and the Peek button are deleted. It sits over the card reader (`placeRespondBox`, measured on every show and
   resize; the top of the screen where the reader is hidden) on an overlay that neither dims nor blurs, so the pile, the
   cast column and the phase strip stay readable; the backdrop still takes the clicks, because a live Pass behind it
   would cross over the open stack. The harness moved first and the box second: `fightclick.clickQuick` casts from the
   board (Yes, the card, ⚡, the target clicked on the board, confirm) and `respQuicks` reads the engine's offer for the
   window shown, so the suites that named their choice followed with no edits; nine that clicked the box's buttons
   directly were rewritten against the board, and quicktest's one-button-per-play leg is tombstoned.
   *Piece 9 built (v1.33.16.10):* **coverage, and the loop it found.** Most of the inventory's new-coverage list had
   already landed with pieces 5-8 (the lower stack target, the glow at every setting, Yes then Pass on a guest). What
   was left: `nettest_priosig` (the same grant re-sent after Yes keeps the box closed, a new one opens it),
   `nettest_roundlock` (the client's OWN window: locked under its box, live as the answer after Yes) and
   `nettest_parity`, where every seat now answers via Yes then the board (`netwindows`' `viaYes`), the duel's guest
   holding Leyline with prompts ON so windows really open. That leg found a LOOP, 1 duel in 6: a guest's board stayed
   live while the host held priority in the guest's own crossing, its repeated Pass reached the host's crossing branch,
   and `E.moveToPlay` — which never checks `respondFor` — re-granted the host's window every time. Fixed both ways
   (piece 10's first hardening item, pulled forward): the host refuses a play, pass or Illusion from a seat while a
   window is open, and a guest's board locks while another seat holds priority, its hint naming who
   (`nettest_windowlock`, both halves A/B'd). *Piece 10, the epic's half (v1.33.16.11):* the three hardening items
   whose code the epic had rewritten. **Counterfeit settles**: `doCounterfeit` was the one cast continuation with no
   `settleWindows` — it called `rivalMayRespond`, which let the AI answer for seat 1, a human guest on a netplay host,
   and asked nobody else — and now ends like `doRemove`; `rivalMayRespond` is deleted. **A held remote play is held,
   not shrunk**: a seat that casts a Quick out of its own pressed cards is not braked (rightly), and the re-apply then
   resolved fewer ids and landed a smaller play; both host handlers hold it now. **Hermes reads "every rival"**:
   `E.stackTargetOf` returns `{allRivals:true}` for a seat-targeted effect carrying `all`, and the caption, the box
   (which read the card's BASE effect) and the cast line say so. The engine guards and `hostApplyMoveN`'s grant check
   exist on `main` unchanged, so they are `main` work, held while the epic is open.
5. **Phones and landscape**, from the measurements above, ruled as 30-34. *Piece 1 built (v1.33.16.12):* the landscape
   band (rulings 30-31). `placeEquipZones` stacks each seat's Equipment on its Forms as a counter chip that a tap
   opens (`equipCollapsible`); `placeCastZone` clears any zone that reaches into the column's width, not only the
   corner ones, and fits the stack's cards to it (`--stkCs`, `.stkWrap`); the band's message drops the column's
   extra padding. `landscapetest` now puts three objects on the stack at every size but a portrait phone and
   requires all three in view, clear of the pile and every zone. *Piece 2 built (v1.33.16.13):* portrait phones
   (rulings 32, 33, 35). Every phone hides the reader strip; the pile laps (`lapPile`); the stack is fitted and
   uncaptioned there too (`compactStack`, one query for the CSS and the measure), with stack cards sized from the fit
   scale because under 380px wide `.card` is a fixed 40x58 that ignores it. `landscapetest`'s column leg now covers
   portrait phones. With no reader, the small Respond? box moved to the top of a tall phone and reached over the
   column's top card; the column now starts below a box at the top while 120px of column is left. *Piece 3 built
   (v1.33.16.14):* the box's minimize (ruling 34), pinned by the new `respmintest`. Step 5 is done.
6. **The lessons.** Phases and Quicks rebuilt around the box and the board, every lesson that mentions
   answering re-read (a lesson that narrates a mechanic is an audit of it), and the dead `lessonQuicksSteps`
   deleted. *Built (v1.33.16.15), Phases and Quicks only, by Aj's call (2026-10-19: "Phases only, others later"):*
   the counter and Leyline steps name Yes and ⚡ Activate and spotlight the card (the counter step also their card
   on the stack); the hue word is gone and the never-firing `shield` arm with it. Playing it found the coach panel
   COVERING the box: on a desktop both docked over the card reader, so Yes and No were under the coach, and on a
   phone the coach sat over the Quick you were told to tap. An answer step now places the coach itself
   (`coach:'answer'`, `placeAnswerCoach`: the least-covering of a few spots, re-measured as the box opens and
   closes; a drag takes over), and `lessontest_phases` hit-tests it at both sizes. Deleted: the Quicks lesson
   (`lessonQuicksSteps`, its rig, `tutCastRivalTech` and the decline retry that was its last caller,
   `tutPullShield`, `tutIsTech`), and the dead `tutPhRound`; two stale comments corrected.
6b. **The other ten lessons** (added 2026-10-19, Aj: *"do we have a step for the other tutorials?"*, then "others
   later"). Play each at desktop and phone size and fix any step the epic made untrue. Already known: Zones of
   Play never shows the cast column, the zone the epic added, and calls the play area simply "where the fight
   happens"; Form Changes says *"hover any card — its description shows…"*, which a phone has neither of since
   ruling 32. *Built (v1.33.16.16):* every step's text read against the build. Zones of Play is a six-zone tour with
   the cast column (shown while it is pointed at), and the play area is "the middle of the table". The wording that
   explained the missing Next button is cut (Aj: *"no need to call attention really that there is no next button"*):
   Phases 3 and 8, How to Play 3. Form Changes reads instead of hovering; Rides puts the Ride in "your Forms & Rides
   zone", not "on the left"; How to Play says where the Specials list is on a phone. Playing all ten at 1200x900 and
   390x844 with a coach audit found the coach over the named card or button on a phone in five lessons; step 6's
   placement now covers every step (`placeCoach`, run wherever the spotlight lands), `lessonlib` asserts it in every
   lesson suite, and `lessontest_phonepass` reruns those five at phone size.
7. **Delete the old modal path**, sweep on the epic, merge. *The deletion (v1.33.16.17):* step 4's piece 8 had already
   removed the modal's per-Quick buttons, its copy of the stack and its Peek, so what was left was the name. The gold
   dialog button kept the old `.respQuick` class (the end screen's play-again, a lesson's "next lesson"), and six suites
   plus `fightclick` still asked "is a window up?" as `.respQuick,#respDecline`, which since piece 8 matched only those
   two buttons: an end screen could read as an open window. The class is `.modalGo` now, the checks ask for the box's
   own Yes or No, and `answertest`'s "no Quick buttons" counts the box's buttons other than Yes, No and ▾, so it can
   still fail. A dead-code check found six never-called functions, all dead on `main` too, so they are filed as main
   work (`dead-template-functions`), not deleted here.
