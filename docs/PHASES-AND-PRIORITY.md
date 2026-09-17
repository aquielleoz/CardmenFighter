# Phases and priority — CURRENT TRUTH

**This is the live rules model for turn structure and priority.** It is not a snapshot. The three older
design files ([`Cardmen-Fighter-Design-v0.70.md`](Cardmen-Fighter-Design-v0.70.md),
[`STACK-DESIGN-v0.53.md`](STACK-DESIGN-v0.53.md), [`BUILD-PLAN-v0.82.md`](BUILD-PLAN-v0.82.md)) are
historical and are wrong in places about this subject specifically — see *Why this file exists* at the end.

Dictated by Aj, 2026-09-08. **Where this file and the code disagree, this file is the intent and the code has
a bug or a gap** — those are tracked in [`NEXT-SESSION.md`](NEXT-SESSION.md)'s BACKLOG, not restated here.

**RENAMED 2026-09-11, and this file is the new vocabulary.** Aj: the phase you spend your turn in is the
**Play Phase**, because playing is what you do there; its middle sub-phase is the **Fight Sub-Phase**, and
what used to be called Fight End is the **Resolution Sub-Phase**. So: `Fight Phase` → **Play Phase**,
`Play Sub-Phase` → **Fight Sub-Phase**, `Fight End` → **Resolution**.
**The dated quotes below are left exactly as spoken and still say "fight end"** — a quote is a record, not
prose to edit, and rewriting one would make it impossible to tell what was actually said. Read those as
*Resolution*. **The CODE still spells it the old way** (`st.resolution`, `openResolutionWindow`, `resolutiontest`,
the `'resolution'` prompt-timing id) and is renamed at step 23, with its own `localStorage` migration — so a
grep that turns up `resolution` in a `.js` file has found the old name, not a missed rename.

---

## 1. Vocabulary

- **Active player** — the player whose TURN it is. Nothing else. Not "who is doing something", and not
  "who put the thing on the stack".
  **It CHANGES as turns pass.** The Play Phase loops turns between players while the pile is climbed, so the
  active player rotates within a single round — it is whoever owns the turn *right now*, re-read at every
  point below that says "active player".
  **And it can be NOBODY** — but NOT where this file first said it was. The window before the Resolution
  Sub-Phase **does** have an active player: the round winner (§3). The genuinely ownerless stretch is **inside
  the Resolution Sub-Phase**, once the losses land — and it stays ownerless until the next round, when the
  initiative holder takes over. That correction matters because the two states behave differently on an empty
  stack: one runs a final go-round, the other just proceeds.
  It is also not the reason the pre-Resolution window is Quicks-only; see that window's own entry.
- **Turn order** — seat order, fixed at game start by the dice roll. Priority always passes in turn order.
- **Controller** — whoever put an object on the stack. **PRIORITY STARTS WITH THEM**, and passes in turn
  order from there.
  **⚠ THIS ENTRY SAID THE EXACT OPPOSITE UNTIL 2026-09-08, IN BOLD** — *"Priority does not start with them.
  It starts with the active player."* Aj reversed it when shown the case that separates the two readings
  (X casts A, Y answers with quick B, X answers with quick C; C resolves, and the top is now **Y's** B):
  *"in this case, it should be the controller."* The old line is quoted here rather than deleted because it
  is what anyone who read this file before that date is carrying in their head.
  **THE ENGINE IMPLEMENTS THE CONTROLLER RULE AS OF THE PRIORITY-WINDOWS EPIC** — this note used to say the
  engine *still* implemented the old one, and that stopped being true without the note noticing.
  `nextPrioHolder(st, top.p)` starts every go-round at the top object's controller (verified 2026-09-14). **The controller-origin rule is the current one; §2 step 7 is its full
  statement.**
  On an **empty** stack there is no controller, so the origin falls to the active player — and where there is
  no active player either, there is no go-round at all (§3, the boundary rule).
- **The Stack** — LIFO, and **it holds EFFECTS. Only effects.** (Aj, 2026-09-08: *"The Stack was only ever
  meant to contain the effects of cards. not the cards themselves. just the effects."*)
  What goes on it: the **effect** of a played Technique or Quick, and the **effect** of a triggered ability —
  which is still a card's effect, the equipment's. Nothing else is eligible, ever.
  **The card is not on The Stack.** Tying an effect to the card that produced it is how you *draw* it and how
  a countered effect knows which card to return, and that convenience is fine — but it is a pointer, not
  membership. Say "the effect of the 9♠", never "the 9♠ is on the stack".
  **This is a rules statement with teeth, because it settles three questions at once by refusing them:**
  a **shield loss** is not an effect, so it is never on The Stack (§4); the **pass bookkeeping** for a
  go-round is not an effect, so it lives on the window, not on an object; and a **sentinel** standing in for
  "we are at Resolution" is not an effect, so it could never have belonged there either — which is a better
  reason to have dropped it than "we found we did not need it".
  **The engine's `st.stack` is not the same thing today** — it also carries `kind:'shieldloss'` entries,
  which are a work QUEUE and not effects at all. After the rebuild it holds one kind and the `kind`
  discriminator can go with them.
- **MID-CAST** — where the CARD is while its effect sits on The Stack (Aj, 2026-09-08: *"it is mid-cast"*).
  Not in hand, not in a pile, not on The Stack. It is a real place, not a gap in the model, and it is where a
  card can be acted on **as a card** rather than as an effect.
  Nothing reaches into it today, which is why the engine can get away with hanging the card off the stack
  entry. **It stops being free the moment a card wants to touch a card mid-cast** — Aj expects exactly that
  when the suits are expanded: *"some diamond cards ... might send it back to the hand"*. Build the
  destination as a **property of the resolution**, not as `push` calls scattered through `resolveTopEffect`,
  or every such card becomes a new branch there.
  **A countered card goes to its owner's SHUFFLE PILE** (Aj, 2026-09-08, confirming the code). So being
  countered is a partial refund: the tempo and the energy are lost, the card comes back. A **spent** card is
  different — every normally-resolved Technique goes to Removed while `RECYCLE_TECH` is off, which is the
  shipped default. **Open, and tracked in the plan:** whether Counter Spell's own card should join the
  countered card in the Shuffle Pile, which would make it the only recurring Technique in the game.

  **If some other part of the ARCHITECTURE wants a stack, it may have one** (Aj: *"we don't need to use The
  Stack for that, but if it would be beneficial for our architecture use a stack, then by all means"*) — just
  never `st.stack`, and never called The Stack.
- **Quick** — a card that may be put on the stack when it is *not* your turn, or when the stack is not empty.
  Everything else can only be played on your own turn with an **empty stack**.

**The one rule that generates all the others:** *to add to a non-empty stack, or to add at all when it is not
your turn, the card must be a Quick.* That is why cards need `quick` at all.

**AND A SECOND RULE SITS BESIDE IT, ABOUT TIMING RATHER THAN THE STACK:**

> **At a transition between sub-phases, only a Quick is ever legal** — whatever the stack holds, and
> whoever is active.

Aj's reason, given for the pre-Resolution window: *"this timing is only the transition between sub-phases."*
It bites where the rule above would otherwise permit more — the **active player facing an empty stack**,
who by that rule could play a Technique and here cannot.

**⚠ THIS WAS WRITTEN AS "exactly one exception" UNTIL 2026-09-11, AND IT WAS NEVER AN EXCEPTION — IT WAS A
RULE WITH ONE INSTANCE VISIBLE.** The file named only the pre-Resolution window and said *"do not try to
derive that case from the rule above; it does not follow from it"*, which was true and incomplete: it does
not follow from the STACK rule because it is a separate rule about TRANSITIONS. The second instance
appeared the moment the pre-fight window was rebuilt — moving to the Fight Sub-Phase is a transition too, so
the same reason applies to it unchanged, and two instances of one reason is not an exception.
**Both transitions now in the model:** Main → Play (see *the pre-fight window* in §3) and the one before the
Resolution Sub-Phase. A third will arrive the day a phase boundary does; it needs no new rule.

## 2. The priority dance

This runs identically at every point below that says "priority". It is MTG's model
([reference](https://www.reddit.com/r/magicTCG/comments/4pf4f1/turn_order_priority_the_stack_and_you/))
**with one deliberate deviation, in step 7: we restart a go-round at the CONTROLLER of the top object where
MTG restarts at the active player.** Flagged because the similarity is otherwise close enough that someone
could "correct" our engine toward MTG and think they were fixing a bug.

1. Something is put on the stack.
2. **The controller of that object** receives priority — the player who put it there (see step 7: the
   origin is always the top object's controller, never the active player as such; they are usually the same
   seat, which is why this is easy to write down wrongly). They may add more to the stack — **Quicks only,
   because the stack is not empty**. Adding does not resolve anything.
   - **YOU MAY ADD SEVERAL THINGS BEFORE PASSING — "holding priority"** (Aj, 2026-09-08). Adding does not
     hand priority on; you keep it until you pass. So one player can stack two or three Quicks in a row and
     only then let anyone else speak. Uncommon, and legal.
   - **THAT IS WHY COUNTER SPELL HAS TO TARGET.** With one object on the stack, "counter the thing beneath
     me" is unambiguous and the card can be cast as a pure reaction. The moment a player can stack two,
     **the counterer must say WHICH one** — so the target is chosen *before* the Counter Spell goes on the
     stack, not after. Aj called this out himself as the cost of holding priority: *"you will need to choose
     a target for your counterspell before it gets put onto the stack (instead of just being able to react
     instantly to another player's activation)."* The game already has the shape for it — targeting is
     confirm-first (`targetPick.chosen`, then the context button reads ⚡ Activate), so nothing is spent
     until the pick is confirmed.
3. When they have nothing further to add, they **pass**.
4. Priority passes **in turn order** to the next player, who may likewise add Quicks (only Quicks: it is not
   their turn *and* the stack is not empty).
5. **Any addition to the stack RESETS the all-passed check.** Everyone gets priority again.
6. When **every player has passed in succession**, the **top** object resolves.
7. **After each resolution, priority goes to the CONTROLLER OF THE NEW TOP OBJECT**, and we go back to
   step 2 — the object beneath is still waiting and has not been passed on yet. When the resolution leaves
   the stack **empty**, priority goes to the **active player** instead; if there is no active player, there
   is no go-round and the phase simply proceeds (see the boundary rule in §3).
   - **SETTLED 2026-09-08, and it used to read "the active player" here.** Aj, shown the one case where the
     two readings part company (X casts A, Y answers with quick B, X answers with quick C; C resolves and
     the top is now **Y's** B): *"in this case, it should be the controller."* So there is **one rule and no
     Resolution special case** — this step is the general form and §3 does not restate it.
8. Repeat until the stack is empty.

### Worked example (Aj's, verbatim in substance)

An equipment's *"At the beginning of your next upkeep, remove one counter"* triggers.

| # | who | what |
| --- | --- | --- |
| 1 | — | the counter removal is put on the stack as a triggered ability |
| 2 | active | holds priority, may cast **Quicks only** (stack is not empty). Passes. |
| 3 | non-active | may add Quicks. Casts a **quick draw** effect → it goes on the stack **and does not resolve** |
| 4 | — | the addition **resets** the all-passed check |
| 5 | non-active | passes |
| 6 | active | priority regained. Could Counter Spell the draw. Chooses to pass. |
| 7 | — | both have passed since the draw was added → **the draw resolves** (top of stack) |
| 8 | active | priority returns to **the controller of the new top** — the counter removal is the active player's own equipment trigger, so here that is the same seat. Passes. |
| 9 | non-active | passes |
| 10 | — | the counter removal — still on the stack — finally resolves |

### A TRIGGERED ABILITY STARTS THE DANCE, IN ANY PHASE, AT ANY TIME

**This corrects an earlier version of this file, which said in two places that a given phase grants nobody
priority** (Aj, 2026-09-08: *"i actually made a booboo by saying that nobody gets priority in this or that
phase.... actually if a triggered ability is put onto the stack at anytime, it starts the priority dance"*).

There is no phase, and no sub-phase, that is closed to priority. **Anything put on the stack opens the dance
where it stands.** Aj's example: an equipment reading *"when you lose a shield, remove 1 counter from this
equipment and draw a card"* triggers **inside the Resolution Sub-Phase** the moment its controller loses a
shield — the ability goes on the stack, the dance runs, and players may add Quicks there.

So a phase is not "a window, then the outcome". A phase runs **until the stack is empty and everyone has
passed**, however many times its own outcomes re-fill the stack.

### A TRIGGER GOES ON THE STACK; NOTHING IN THE GAME CAN ANSWER IT YET (Aj, 2026-09-12)

Two rulings, taken together, because each is meaningless without the other. They were prompted by building
the equipment counter tick — the game's first triggered ability — and finding that **the Upkeep go-round is a
real priority point whose stack holds only objects nobody can interact with.**

**A TRIGGERED ABILITY IS NOT COUNTERABLE — AND THE REASON IS THE TARGETING RESTRICTION, NOT THE STACK
ENTRY'S TYPE** (Aj, 2026-09-14, correcting the first version of this entry): *"some triggers put effects onto
the stack. it is uncounterable only because we don't have cards that target triggered effects yet. counter
spell does not target effects, it targets techniques and equipments — the card type source of the effect."*

So the model is: **the stack holds effects, and every effect has a SOURCE.** Counter Spell's restriction is on
that source — a Technique or an Equipment that was cast or activated. A triggered ability's effect has no such
source, so nothing in today's card set can target it. **The door is open for a card printed to answer
triggered effects**, and such a card needs no new machinery — only a different targeting restriction.

**⚠ THE CODE GETS THE RIGHT ANSWER FOR THE WRONG REASON TODAY.** `counterTargets` filters `kind === 'effect'`
and the equipment tick is pushed as `kind: 'tick'`, so a tick is excluded by its stack TYPE rather than by its
source. That is a latent reversal: **the moment someone models the next trigger the way this file describes —
as an effect, which is what it is — Counter Spell can target it**, and the ruling flips silently. The fix is
to make the tick an ordinary effect, carry its SOURCE on the stack entry, and let `counterTargets` read that.

**ANNOINT DOES NOT SAVE AN EQUIPMENT FROM TICKING TO ZERO.** Its text is *"can't be destroyed or disarmed"*,
and a counter coming off is **neither** — the tick is the equipment's lifespan running out, not an attack on
it. `resolveUpkeepTick` decrements and retires without consulting `protectedRound`, and that is correct.
Annoint answers `removeEquip` (Plead for Peace and its kin) and nothing else.

**THE CONSEQUENCE, WHICH IS THE POINT OF WRITING THIS DOWN:** at Upkeep the only castable Quicks are the
untargeted ones — **Leyline Ascension** at base, plus whatever a seat's Form has granted — and none of them
engages with the tick on the stack. So the honest AI policy at Upkeep is a **hard decline**, and that is a
decision rather than an oversight. **It stops being true the moment a card is printed that answers a trigger,
or any untargeted Quick worth holding priority for**, so whatever implements the decline must name the
condition it is asserting rather than simply never casting. *(Epic step 21 owns that policy.)*

### THE BOUNDARY: AN EMPTY-STACK GO-ROUND NEEDS AN ACTIVE PLAYER, AND RESOLUTION HAS NONE

Aj, 2026-09-08: *"when shields are broken DURING fight end, no one is the active player and the phases and
sub-phases just continue to change."* So there are two different situations and only one of them ends in a
polite go-round:

| | before Resolution (the window) | inside Resolution (after the losses land) |
| --- | --- | --- |
| active player | the **round winner** | **nobody** |
| stack empties | a final go-round runs — winner, then turn order — and the sub-phase begins only when all pass | **a go-round runs too**, origin = the **round winner**; the phase proceeds once everyone has passed |
| stack non-empty | dance, origin = controller of the top | dance, origin = controller of the top |

**⚠ THE RIGHT-HAND CELL SAID "no go-round. The phase simply proceeds" UNTIL 2026-09-14, AND AJ REVERSED IT:**
*"this is wrong. the correct behavior is: when the stack empties, nobody is active, a go-round runs and the
phase proceeds after everyone passes priority."* The old line is kept here because anyone who read this file
before that date is carrying the reversed rule.

**THE ORIGIN IS THE ROUND WINNER** (Aj, 2026-09-14). §2 step 7 offers two clauses — the controller of the top
object, or the active player on an empty stack — and this case matches **neither**, so the origin had to be
ruled rather than derived. Three candidates were weighed:
- **the round winner** — RULED. A fact fixed before the window opened and unchanged for the whole sub-phase.
- **the initiative holder** — REJECTED, and the reason is a timing trap worth keeping: `st.initiative` is
  assigned in `finishCleanup`, which runs at the END of the round, *after* this moment. So at the instant of
  the ownerless go-round it still names the **PREVIOUS** round's winner. It would hand the first word to the
  wrong seat — invisibly in a duel, and only at 3-6 players where those are different people.
- **a fixed anchor (seat 0 / turn order)** — REJECTED: no seat privilege, and unexplainable out loud.

**"NOBODY IS ACTIVE" NEEDS NO REPRESENTATION, AND MUST NOT GET A SENTINEL.** `phaseWalk(st, origin)` takes the
origin as a parameter, so in this engine a go-round's origin has never *been* the active player — it is a
property of the window. Measured while designing this: `nextPrioHolder(st, undefined)` and `(st, -1)` **throw**
at `st.players[cand].eliminated`, while `(st, null)` and `(st, 99)` do **not** throw and silently resolve to
**seat 0**. The two natural sentinels crash and the two that do not quietly name a real seat. Pass the winner.

**TERMINATION IS NOT A WORRY, AND THE OLD RULE'S REASON WAS TOO STRONG.** That cell existed to stop "an endless
series of empty go-rounds" when a trigger resolves inside the sub-phase. A go-round in which everyone passes
**ends**; it only runs again if somebody actually casts, and casting is bounded by cards and energy. The fear
was real and the remedy deleted the window instead of bounding it.

**AND THE FIZZLE NEEDS NO FALLBACK HERE — CONFIRMED FROM THE CODE, 2026-09-14.** `openResolutionWindow` has
exactly ONE call site, in the round-win path, and it always carries a winner. A fizzled round never reaches
Resolution at all: `pass` → `finishRoundWin` → the **Clean-up** window. So Clean-up is the boundary that needs
the fizzle fallback, and it already has it — `roundWinner != null ? roundWinner : st.initiative`. Do not copy
that formula to Resolution; its second half would be a branch nothing can reach.

Nobody is active again **until the next round, when it becomes the initiative holder** — which is the round
winner, since winning the round *is* taking the initiative. So the same seat that was active for the window
becomes active again a moment later, by a different route. Do not collapse the two: between them lies the
sub-phase where nobody is, and that is exactly where a shield-loss trigger fires.

## 3. The phases

### Beginning Phase

**Three steps, and they are MTG's** (Aj, 2026-09-16, naming it: *"ah it's untapping in mtg. that's gotta be
up there in the beginning phase too. let's build that queue there... this is before the upkeep timing"*):
**Untap → Upkeep → Draw.**

- **Untap Sub-Phase.** A queue of events with **no priority at all** — the only part of the game that is
  closed to it, exactly as MTG's untap step is, and the upkeep dance below remains the phase's first
  priority point. `BEGIN_ORDER` = `roundAdvance` → `equipReset` → `stampRound`.
  **`equipReset` IS THE UNTAP.** It clears `usedThisRound`, which is the only thing standing between an
  equipment's activated ability and "once ever" — Seed Pouch is the lone user today. It lived in Clean-up
  until 2026-09-16, which meant a once-per-round ability came back *while the previous round was still
  being torn down*, before a window a player may legally cast into.
  **`roundAdvance` AND `stampRound` MOVED WITH IT, AND MUST STAY ADJACENT IN THAT ORDER.**
  `result.newRound` is read two ways — the round card renders it, and two sites compute `newRound - 1` to
  recover the round that just ended — so the stamped VALUE must not move. Splitting the pair stamps the old
  number and makes those two double-subtract.
  **`initiative` STAYS IN CLEAN-UP** (Aj: *"yes, that is correct"*): it is decided by the round that just
  ended, and `pileClear` must follow it because the fizzle branch reads `st.initiative`.
  > The tell that found all this was a list: `CLEANUP_ORDER` had seven members and **six of them END the
  > round**. `roundAdvance` was the only one that starts the next, sitting first in a pile of teardown.
- **Upkeep Sub-Phase.** Triggered abilities that say *"at the beginning of your upkeep"* are put on the stack
  here, then the **priority dance** runs. **Equipment counters tick down here** — at the beginning of the
  ROUND, not at clean-up.
  **AND THE TICK IS ITSELF ONE OF THOSE TRIGGERS, AS OF 2026-09-11 — the first in the game.** Aj wrote the
  card text for it: *"At the beginning of each round's upkeep, remove a counter from this equipment."* So
  it is not bookkeeping that happens before anyone can act: the trigger goes on the stack, the dance runs,
  and only then does the counter come off. Equipment reaching 0 retires to Energy as part of that
  resolution.
  **SIMULTANEOUS TRIGGERS ARE ORDERED BY THE PUSH, AND §2 THEN NEEDS NO EXCEPTION.** They all happen at
  once, so something must order them; the ACTIVE PLAYER's goes on the stack first and turn order follows,
  which puts the LAST seat's on top. Aj, working it through: *"3 players had equipment and the initiative
  was player A's, then Player B and Player C come after in the turn order. So player A as the active
  player puts their triggered ability first on the stack, then B, then C. since C's trigger is at the top,
  they gain priority first, then it's passed around in turn order."*
  **⚠ AN EARLIER CUT STARTED THE GO-ROUND AT THE ACTIVE PLAYER INSTEAD, AND THAT CONTRADICTED §2** — the
  stack is not empty at Upkeep, so "a go-round starts at the controller of the top stack object" already
  applied. Aj caught it: *"wait... that's an inconsistency right? because the stack isn't empty yet"*. It
  was. Ordering the PUSH fixes it without amending anything: the controller of the top object is then
  exactly the seat that should act first, and the starting seat stops being an artifact of iteration
  order — which is what a per-object exception would have left behind.
  The once-per-round `usedThisRound` reset is NOT a trigger and stays immediate: nobody can respond to it.
  **⚠ THIS SAID "the beginning of the TURN" until 2026-09-10, and Aj corrected it himself** — *"you're
  right i was thinking of magic. beginning of the round actually makes more sense here. that's where the
  upkeep lives."* The distinction is invisible at 2 players and real at 3-6, where the Play Phase loops
  several turns inside one round. **The engine was already right**: `roundDraw` does
  `if (e.decay) e.counters -= 1` as it deals the new round, so this was a doc defect and not a code one —
  checked before changing either.
- **Draw Sub-Phase.** Each player draws. Round 1 is the exception: a 6-card opening hand and no draw.

> **Equipment at 0 counters goes to the Energy Pile — at any time, not only at a phase boundary.**

### Play Phase

The initiative holder leads. A turn is **Main Sub-Phase → Fight Sub-Phase**, looping between players until the
pile stands.

- **Main Sub-Phase.** The active player may activate Techniques and Equipment, and may cast Quicks
  proactively (a Quick with no legal target fizzles on resolution; it is never illegal). Each thing played
  goes on the stack and runs the **priority dance**.

- **The pre-fight window.** This is **not** a special case for one card. It exists because **priority is
  passed around before the active player may make their shedding play** (a single or a Special). **Every
  player's Quicks are available here.**
  - In paper this is the active player announcing they are about to play.
  - **⚠ THE INTERACTION WAS REDESIGNED 2026-09-11 AND THE THREE BULLETS BELOW ARE SUPERSEDED.** They read:
    *"it triggers when the player clicks Fight or drags cards into the play area"*; *"if anyone casts
    something, **the play is cancelled**"*; and *"afterwards… players may change the play they intended and
    fight again."* That is sound as RULES and poor as an interface — Aj: *"seems jarring for the player to
    select cards to fight with and then be stopped because someone decided to cast a quick."*
  - **THE WINDOW IS A PHASE TRANSITION, NOT AN ANNOUNCED PLAY** (Aj, 2026-09-11, after MTG Arena's
    move-to-combat button):
    1. the active player clicks **Fight**, which ONLY moves them from the Main Sub-Phase to the Play
       Sub-Phase — it plays nothing;
    2. the active player passes priority;
    3. the other players pass priority;
    4. the Fight Sub-Phase begins, and only now is a shedding play made.
    **Nothing is cancelled because nothing was selected** — the cancellation rule existed only to undo an
    announcement that no longer happens. The old reason it was needed is still worth knowing: a shedding
    play is **not an effect**, so it never goes on The Stack (§1) and there is nothing for responses to
    resolve above; an announced fight has no state anywhere, which is why it could never simply "wait".
  - **AUTO-ADVANCE WHEN NOBODY CAN ACT** (Aj's call). Measured: the active player can cast at their own
    transition on **2.9% of turns with the full set and 4.8% as Pure Wizard at 2 players — 0.4 and 0.7
    prompts per GAME** (16.5% / 4.1 per game at 6p). A step the player meets twice in five duels must not
    cost a click on every turn; the engine already auto-passes a seat that cannot act (`canAddToStack`) and
    this is the same principle applied to the transition.
  - **THE SUB-PHASE DECIDES WHAT A GESTURE MEANS** (Aj, 2026-09-11). In the **Main Sub-Phase**, dragging a
    card to the play area **activates** it — including the cards that need choices, so it is also how
    targeting (confirm-first: stage into `targetPick.chosen`, then the context button) and the Phantasmal
    Illusion picker are entered. In the **Fight Sub-Phase**, dragging plays the card as the shedding play.
    One gesture, two meanings, chosen by the phase — which is why the sub-phase must live on STATE.

- **Fight Sub-Phase.** The active player plays a fight card or passes. Playing or passing ends the turn.

- **Loop.** The next player takes their turn (Main → Play), climbing the pile. When a player cannot or does
  not beat the pile, the play stands.

- **Before the Resolution Sub-Phase, priority is passed around again** — before *anything* happens: before
  shields are stripped, before initiative is determined. **This window is Quicks only.**
  - *Careful with the reason, because this file gave a wrong one first.* It is not "nobody's turn, therefore
    Quicks" — the **round winner IS the active player for this window** (§3, the go-round). It is Aj's
    reason: *"this timing is only the transition between sub-phases"*, so nothing but a Quick is ever legal
    here, whatever the stack holds and whoever is active. The §2 test (non-empty stack, or not your turn) is
    not what does the work at this one timing.
  - **IT OPENS EVERY ROUND** (Aj, 2026-09-08). Not only when something is at stake. In practice a player
    holding no castable Quick is auto-passed — the engine already does that, `canAddToStack` — so it costs an
    empty-handed player nothing and is invisible to them. It is a *window*, not a *prompt*.
  - **AND THE LOSS TARGET IS PICKED BEFORE IT** — before priority is passed at all — *"so that people will know
    if they want to activate shield protection or no."* A defender deciding whether to spend a card must know
    the strike is aimed at them; asking first and revealing after would make the decision a coin flip.
    **This is the order the code already has**, which is worth knowing before rebuilding the window:
    `resolveRoundWin` returns early with `needsLossTarget` (`engine.js`) before any strip, and
    `st.shieldResponse` is only set once the pick has completed (inside `driveShieldStack`). The rebuild changes the window's
    NATURE — a whitelist of guard cards becomes a priority window admitting any Quick — and not its position.

- **THE GO-ROUND AT RESOLUTION, IN FULL** (Aj, 2026-09-08, worked through card by card). No turn is in
  progress, so two things a normal turn supplies for free have to be stated: who the **active player** is,
  and where each go-round **starts**.
  1. The **round winner is the active player — for THIS WINDOW, which runs BEFORE the sub-phase**, not
     inside it (Aj, 2026-09-08: *"player c is the active player BEFORE fight end. remember, the priorities
     are passed around before the sub-phase changes"*). The distinction is load-bearing; see the boundary
     rule below.
  2. The winner **picks who takes the hit first**, before any priority is passed — and **does not get to
     re-pick** later, however long the sub-phase runs.
  3. **A go-round starts at the controller of the top stack object**, or at the **active player when the
     stack is empty**. It runs in turn order and ends when it comes back to where it started.
  4. Coming back round with objects on the stack resolves the **top** one. Coming back round with an
     **empty** stack ends the sub-phase.
  5. **Quicks only, always** — including for the active player facing an empty stack, *"because this timing
     is only the transition between sub-phases."* This is the one place §2's test ("the stack is not empty,
     or it is not your turn") is not what does the work: here nothing but a Quick is ever legal.

  Worked example — turn order A → B → C, and **C won the round**:

  | # | stack | who | what |
  | --- | --- | --- | --- |
  | 1 | empty | **C** (active) | picks **A** to take the hit. Adds nothing. Passes. |
  | 2 | empty | A | adds a **draw Quick** — *"they'll be gaining energy later anyway from the shield hit"*. Passes. |
  | 3 | A-draw | B | passes |
  | 4 | A-draw | C | passes → the go-round began at **A** (top's controller) → **A's draw resolves** |
  | 5 | empty | **C** (active) | stack empty, so the go-round restarts at the active player. Passes. |
  | 6 | empty | A | passes |
  | 7 | empty | B | passes |
  | 8 | — | — | **the sub-phase proceeds. A loses the shield C chose.** |

  Had **B** added something at step 3, the go-round would have restarted at **B**: C, A, back to B → B's
  resolves. Then the top is A's draw again, so the next go-round starts at **A**: B, C, back to A → A's
  resolves. Only then is the stack empty and only then does it return to C.

- **Resolution Sub-Phase.** ~~Nobody gets priority inside it~~ — **that was wrong, see the trigger rule
  above.** No priority is handed out for the outcomes *themselves*, but any outcome that TRIGGERS something
  puts it on the stack and the dance runs there. The outcome resolves: a
  Special win strips a shield, a Jab win banks energy, and the winner takes initiative. **The catch-up energy
  and the shield-draw happen here too** (Aj, 2026-09-08) — i.e. *below* the window, so a player casting into
  the window is doing so knowing the energy is still to come. **The order of the outcomes inside the
  sub-phase does not matter yet**, because no card has a timing that references one; do not invent one.

### Clean-up Phase

Once per round. There is a timing at the **beginning** of clean-up where triggered abilities may be put on
the stack (*"at the beginning of the Clean-up…"*) — **no card has one yet**. If anything is put there, the
priority dance begins anew.
**AND THE DANCE RUNS THERE WHETHER OR NOT ANYTHING IS PUT ON THE STACK, AS OF 2026-09-11.** Aj ruled both
round boundaries REAL priority points rather than trigger-only hooks: a seat holding a Quick may cast it at
the end of a round, and *"yes, those are legal"*. So clean-up grants priority unconditionally, starting at
the **round winner** — the seat about to take the initiative — and a fizzled round leaves it with whoever
holds initiative already.
**THIS BOUNDARY WAS UNBUILDABLE UNTIL THE ROUND END WAS SPLIT.** `finishRoundWin` opened with
`st.stack = []`, so anything cast into clean-up was silently discarded — the plan recorded it as the reason
the loop could not live there. The spent shield-loss objects are cleared BEFORE the window is parked now,
once, and nothing clears the stack again; the round-long expiry, the round advance and the Draw all happen
after the go-round closes rather than before it. **And per the trigger rule above, clean-up's own outcomes can trigger abilities
too** — a discard-to-hand-size is a real event a future card may care about — so "nothing in clean-up grants
priority" is a statement about today's card set, never about the phase.

- Every player discards down to hand size, to the Energy Pile.
- Round-long effects expire.

**AND THERE IS A SECOND DANCE AT THE *END* OF CLEAN-UP — BUILT 2026-09-16, and it is the sixth timing.**
The paragraph above already ruled **both** round boundaries real priority points; only the first was in the
engine, so the round boundary was being crossed without a dance. Aj, reading the fix for the clean-up →
beginning ordering: *"wasn't there a priority dance at the end of clean up?"* — there was in the model and
not in the code. It is `st.endCleanup`, it grants priority **unconditionally** like its twin, and its origin
is the seat that has just taken the initiative.

**IT IS ITS OWN WINDOW AND NOT THE UPKEEP ONE**, though they are adjacent, because the round boundary sits
between them: a Quick cast here resolves **before the Draw**, one cast at Upkeep resolves after. Aj accepted
the adjacency deliberately — *"some of these can get tiring especially having the before clean up and end of
round when you have nothing to do. but that is really how the cookie crumbles. people will be thankful they
can uncheck it."*

**THE ORDER, AND THE TICKS ARE WHAT PROVE IT:**

```
clean-up dance (origin = round winner) → clean-up events → The Stack is worked through
  → END-OF-CLEAN-UP DANCE → Beginning Phase → the upkeep ticks are pushed → upkeep dance
```

The Beginning Phase does not exist while this window is open, so **no tick may be on the stack and no
counter may have moved** — asserted directly in `test.js`. `finishCleanup` *owes* the ticks (`upkeepTicks`)
and the Upkeep branch is the only thing that pays the debt; paying it any earlier puts the next round's
triggers on a stack this dance is still answering.

> **"The Stack is worked through" is not a drain** (Aj, 2026-09-16: *"it doesn't just drain... a window
> opens. players can activate effects here because priority is passed"*). It is §2 steps 5-8: a dance per
> object, any addition resets the all-passed check, the top resolves, and priority goes to the controller of
> the new top. The stack can grow while it is being worked through.

✅ **`st.round` IS THE ROUND THAT IS ENDING WHILE THIS WINDOW IS OPEN — and it was not, until the untap
queue landed (2026-09-17).** A Quick cast here belongs to the round it is ending, and the priority ledger
stamps it that way.

| | before the untap move | now |
| --- | --- | --- |
| during the end-of-Clean-up window | **2** ✗ | **1** ✓ |
| during Upkeep | 2 | 2 ✓ |

**It was fixed as a SIDE EFFECT, not on purpose.** `roundAdvance` was a clean-up event, so it ran *before*
this window and a cast at the end of round 1 was stamped round 2 — the off-by-one this repo already calls
harmful. Moving it into the Beginning Phase, for the entirely separate reason that it starts a round rather
than ending one, put it after the window and corrected the stamp for free. Aj found the misfiling by asking
*"roundAdvance? doesn't that happen in the beginning phase?"*; the stamp was never the argument for moving
it, and is the better evidence that the move was right.

⚠ **THIS PARAGRAPH SAID THE OPPOSITE FOR ABOUT AN HOUR**, and that is worth leaving here: the warning was
written accurately on 2026-09-16, and the untap queue made it false the next morning. Nothing mechanical
catches that — `versiontest` gates names, counts and the doc chain, never a CLAIM. `test.js` now asserts
the table above, so this is a second copy that is ASSERTED rather than written.

## 4. Shield loss is NOT a stack object

**A shield loss just happens.** It is not put on the stack and it is not responded to directly.

**⚠ AND THE ENGINE VIOLATES THAT TODAY — SETTLED 2026-09-14.** Aj, asked which of the two a shield loss is:
*"what is shield loss? is it an effect that removes shields? or is it the moment that a shield is lost by
losing to a special. if its the former, let's change the type to effect. if it's the latter... this is not
according to the spec."* **It is the latter** — this section's own first line says so — so `st.stack` carrying
`kind: 'shieldloss'` entries is a spec violation rather than a modelling choice. They are a work QUEUE and
belong on their own field, leaving The Stack holding **only effects**, which is what §1 has always said.
**THE EPIC MOVED AWAY FROM THAT GOAL RATHER THAN TOWARD IT**: the stack held two kinds before it
(`effect`, `shieldloss`) and holds three after, because `tick` joined them. The two corrections — a tick
becoming an ordinary effect with a trigger source, and the shield-loss queue leaving the stack — are one
cleanup seen from two sides, and after it the `kind` discriminator can go. What protects
or amplifies it is the **priority window that runs before the Resolution Sub-Phase** — that is where a
defender springs an immunity and where a striker adds to the damage.

**AND EVERY SHIELD LOSS IN A ROUND HAPPENS AT THE SAME TIME** (Aj, 2026-09-08): *"everyone loses the shield at
the same time. which is after everyone is asked. phases and sub-phases only proceed when the stack is
empty."* So at a table where a Special strips several seats at once, **no strip lands until the window has
closed for everybody** — which is the whole point, because it is what lets a third player protect someone
else. Two consequences that follow from simultaneity rather than from any new rule:
- **Kicks are simultaneous too.** Two players both at zero and both struck are eliminated together, not one
  then the other. At 3-6 players that can end a game in a way sequential resolution cannot.
- **"Was this player already broken?" must be sampled for EVERY target before ANY strip is applied.** Sample
  it as each target resolves and the second read sees a board the first strip already changed.

**Player loss is only ever through the Fighter Kick.** A kick happens only when the struck player has **no
shields left**. Techniques that destroy shields cause shield losses like anything else, so they are equally
capable of setting up a kick. Some cards prevent loss even at zero shields.

## 5. Locked players (Back Stab)

A locked player **keeps priority**. Back Stab denies them **fights and Techniques** — it does not remove them
from the game for a round.

**Equipment are neither fights nor Techniques**, so a locked player may still activate equipment (and there
will likely be more activated equipment in future). They must pass when *trying to fight*; they are not
without options.

---

## Why this file exists

The model above was recorded in **two** places and neither pointed at the other: the phase structure with its
priority windows in `Cardmen-Fighter-Design-v0.70.md` §7, and the stack loop in `STACK-DESIGN-v0.53.md` §2 —
the file actually *titled* "Priority Rework", which never mentions a phase boundary at all. Both are listed in
CLAUDE.md's docs map as *"historical snapshots, not current truth"*, so by the project's own rules there was
**no** current-truth statement of how priority works.

The cost was not hypothetical. On 2026-09-07 a session read `STACK-DESIGN` alone, concluded the priority loop
had never been built, and told Aj so twice — while `openResponseWindow` had been running it the whole time.
The same gap left the pre-fight window looking like a Back Stab special case rather than what it is: the
priority pass before the shedding play.

**Two things were also simply missing from both files** and are recorded here for the first time: the
**Upkeep Sub-Phase**, and the rule that **priority is passed for every object before it resolves** rather than
once per phase.
