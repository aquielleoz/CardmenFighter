# Phases and priority — CURRENT TRUTH

**This is the live rules model for turn structure and priority.** It is not a snapshot. The three older
design files ([`Cardmen-Fighter-Design-v0.70.md`](Cardmen-Fighter-Design-v0.70.md),
[`STACK-DESIGN-v0.53.md`](STACK-DESIGN-v0.53.md), [`BUILD-PLAN-v0.82.md`](BUILD-PLAN-v0.82.md)) are
historical and are wrong in places about this subject specifically — see *Why this file exists* at the end.

Dictated by Aj, 2026-09-08. **Where this file and the code disagree, this file is the intent and the code has
a bug or a gap** — those are tracked in [`NEXT-SESSION.md`](NEXT-SESSION.md)'s BACKLOG, not restated here.

---

## 1. Vocabulary

- **Active player** — the player whose TURN it is. Nothing else. Not "who is doing something", and not
  "who put the thing on the stack".
  **It CHANGES as turns pass.** The Fight Phase loops turns between players while the pile is climbed, so the
  active player rotates within a single round — it is whoever owns the turn *right now*, re-read at every
  point below that says "active player".
  **And it can be NOBODY.** Once every player has passed their turn, the round has no active player — which is
  exactly the situation in the window before the Fight End Sub-Phase, and the reason that window is Quicks
  only.
- **Turn order** — seat order, fixed at game start by the dice roll. Priority always passes in turn order.
- **Controller** — whoever put an object on the stack. **Priority does not start with them.** It starts with
  the *active player*, whoever that currently is, and passes in turn order from there. A non-active player who
  responds does not thereby get to go first on the next round of priority.
- **The stack** — LIFO. Things that are put on it: a played Technique or Quick, and a **triggered ability**.
- **Quick** — a card that may be put on the stack when it is *not* your turn, or when the stack is not empty.
  Everything else can only be played on your own turn with an **empty stack**.

**The one rule that generates all the others:** *to add to a non-empty stack, or to add at all when it is not
your turn, the card must be a Quick.* That is why cards need `quick` at all.

## 2. The priority dance

This runs identically at every point below that says "priority". It is MTG's model
([reference](https://www.reddit.com/r/magicTCG/comments/4pf4f1/turn_order_priority_the_stack_and_you/)).

1. Something is put on the stack.
2. The **active player** receives priority. They may add more to the stack — **Quicks only, because the stack
   is not empty**. Adding does not resolve anything.
3. When they have nothing further to add, they **pass**.
4. Priority passes **in turn order** to the next player, who may likewise add Quicks (only Quicks: it is not
   their turn *and* the stack is not empty).
5. **Any addition to the stack RESETS the all-passed check.** Everyone gets priority again.
6. When **every player has passed in succession**, the **top** object resolves.
7. **After each resolution, priority returns to the active player**, and we go back to step 2 — the object
   beneath is still waiting and has not been passed on yet.
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
| 8 | active | priority returns to the active player. Passes. |
| 9 | non-active | passes |
| 10 | — | the counter removal — still on the stack — finally resolves |

## 3. The phases

### Beginning Phase

- **Upkeep Sub-Phase.** Triggered abilities that say *"at the beginning of your upkeep"* are put on the stack
  here, then the **priority dance** runs. **Equipment counters tick down here** — at the beginning of the
  turn, not at clean-up.
- **Draw Sub-Phase.** Each player draws. Round 1 is the exception: a 6-card opening hand and no draw.

> **Equipment at 0 counters goes to the Energy Pile — at any time, not only at a phase boundary.**

### Fight Phase

The initiative holder leads. A turn is **Main Sub-Phase → Play Sub-Phase**, looping between players until the
pile stands.

- **Main Sub-Phase.** The active player may activate Techniques and Equipment, and may cast Quicks
  proactively (a Quick with no legal target fizzles on resolution; it is never illegal). Each thing played
  goes on the stack and runs the **priority dance**.

- **The pre-fight window.** This is **not** a special case for one card. It exists because **priority is
  passed around before the active player may make their shedding play** (a single or a Special). **Every
  player's Quicks are available here.**
  - In paper this is the active player announcing they are about to play.
  - In the game it triggers when the player **clicks Fight or drags cards into the play area**.
  - If anyone casts something, **the play is cancelled**, the new effect goes on the stack, and the whole
    priority dance begins again.
  - Afterwards, **because information has changed, players may change the play they intended** and fight
    again.

- **Play Sub-Phase.** The active player plays a fight card or passes. Playing or passing ends the turn.

- **Loop.** The next player takes their turn (Main → Play), climbing the pile. When a player cannot or does
  not beat the pile, the play stands.

- **Before the Fight End Sub-Phase, priority is passed around again** — before *anything* happens: before
  shields are stripped, before initiative is determined. **Every player has already passed their turn by
  this point, so it is NOBODY's turn, and this window is therefore Quicks only.**

- **Fight End Sub-Phase.** **Nobody gets priority inside it** — only before it. The outcome resolves: a
  Special win strips a shield, a Jab win banks energy, and the winner takes initiative.

### Clean-up Phase

Once per round. There is a timing at the **beginning** of clean-up where triggered abilities may be put on
the stack (*"at the beginning of the Clean-up…"*) — **no card has one yet**. If anything is put there, the
priority dance begins anew. Otherwise nothing in clean-up grants priority.

- Every player discards down to hand size, to the Energy Pile.
- Round-long effects expire.

## 4. Shield loss is NOT a stack object

**A shield loss just happens.** It is not put on the stack and it is not responded to directly. What protects
or amplifies it is the **priority window that runs before the Fight End Sub-Phase** — that is where a
defender springs an immunity and where a striker adds to the damage.

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
