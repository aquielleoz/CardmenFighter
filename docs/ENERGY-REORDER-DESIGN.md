# Cardmen Fighter — Reorderable Energy Pile (design)

*Design doc for the backlog's "reorderable energy pile" item. Written before any implementation, so the
decisions are reviewable while they are still cheap. Nothing here is built yet.*

> ⚠️ **Design/rationale doc, not the source of truth.** File and line references are to the state of `main`
> at v1.28.1 and will drift; re-check before relying on them.

---

## The concept (from the backlog)

Your **energy pile** is a queue. Spending energy takes cards off it and pushes them to the **shuffle pile**,
which refills your deck when it runs dry. So *which* energy cards you spend decides *which cards come back to
you sooner* — and right now you have no say in it.

The feature: on your own turn, open your energy pile and **promote cards to the front**, choosing what gets
spent (and therefore recycled) next. The shuffle→deck reshuffle stays **random** — this controls only the order
in which energy cards leave the energy pile.

**Your-turn-only**, to keep netplay sequencing simple.

---

## What already works, for free

Three things fell out of how the game is already built, and they carry most of the feature:

**1. Spending is already order-driven.** `payEnergy` (`engine.js`) takes colored pips as *the first card of the
required suit in pile order*, then the generic remainder as `pl.energy.shift()` — the front of the queue:

```js
for (var s in req) for (var k = 0; k < req[s]; k++) {          // colored pips: FIRST card of that suit, in order
  var idx = -1; for (var i = 0; i < pl.energy.length; i++) if (pl.energy[i].suit === s) { idx = i; break; }
  if (idx >= 0) { pl.shuffle.push(pl.energy.splice(idx, 1)[0]); colored++; }
}
for (var g = colored; g < cost && pl.energy.length; g++) pl.shuffle.push(pl.energy.shift());   // generic: the front
```

So **pile order already fully determines what is spent**, for both halves of a cost. Reordering the pile *is*
the feature; no change to spending logic, cost validation, or `canAfford` is needed.

**2. The netplay mirror already carries the ordered pile.** `netview.js` sends a seat its **own** energy as a
real ordered array (`o.energy = cards(pl.energy)`, public) and gives opponents only `energyCount`. A host-side
reorder therefore reaches the owning client through the existing mirror, and leaks nothing to anyone else.
No `netview.js` change, no new message type for the *result*.

**3. The reshuffle is untouched.** Refilling the deck from the shuffle pile stays random, exactly as today.

### The one nuance to communicate

Costs are **part colored, part generic**: `costReq` requires `defaultPips(cost) = max(1, floor(cost/2))` pips of
the card's own suit, the rest being any suit (transforms J/Q/K are fully generic). A colored requirement takes
the earliest card **of that suit**, skipping past anything else you promoted.

So "put what you want recycled at the front" is true, with one honest caveat: **promoting a ♠ does not shield a
♥ from a ♥ pip requirement.** That is coherent rather than broken, but the UI has to make it visible or the
control will feel like it is being ignored. See *Decision 3*.

---

## What has to be built

### A. The energy-pile viewer — the bulk of the work

**There is no pile viewer anywhere in the game today.** The ⚡ readout is per-suit counts with a tooltip
(`energyChips` / `energyBreakdown`), and it is not clickable. The shuffle pile is a bare `♻ N` count. So the
"peek" the backlog assumes has to be built first, and it is the part with real design in it:

- An **ordered** view of the pile — not counts. Front-of-queue must read unmistakably as "spent next".
- It must survive **20+ cards on a phone**. The existing full-screen reader (`#cardFull`, added v1.20.0 for
  tight screens) is the closest precedent for "the whole page becomes one panel", and worth reusing.
- Read-only when it is not your turn, so it doubles as a plain "what's in my pile?" answer — useful on its own
  and the reason this is worth building even apart from reordering.

### B. Engine: one operation

`reorderEnergy(st, p, ids)` — validate it is `p`'s turn, validate `ids` is a **permutation of the current pile**
(same multiset, same length — no injection, no duplication, no deletion), then apply. ~30 lines with guards.

Because spending already follows order, that is the entire engine change.

### C. Netplay: one intent op

Eleven intent ops exist (`play`, `pass`, `activate`, `respond`, `decline`, `discard`, `guard`, `guardPass`,
`lossTarget`, `prefight`, `prefightPass`), each handled in `hostApplyMove` (2p) and `hostApplyMoveN` (N-player).
Add a twelfth, then rebroadcast the mirror.

**The host must re-validate.** A client is untrusted: this is the same lesson as the deck-string intake fixed in
v1.28.0, where an unvalidated client value fell through to a silent wrong result. A rogue `ids` array is an
attempt to conjure or delete energy, so the permutation check belongs on the host, not only in the UI.

### D. Tests

- **engine** (`test.js`): permutation accepted; wrong length, duplicate id, foreign id, and not-your-turn all
  rejected; and the consequence test that matters — reorder, then spend, and assert the *promoted* cards landed
  in the shuffle pile, including a mixed colored+generic cost.
- **UI** (new suite, in the style of `decktest.js` / `viewtest.js`): the viewer opens, shows the pile in order,
  promotes on click, is read-only off-turn.
- **netplay** (new `nettest_*`): a client reorders → the host's authoritative pile matches; a rogue `ids`
  payload is rejected and the pile is untouched.
- **tutorial** lesson + its `lessontest`-style suite (see below).

### E. Tutorial lesson

The backlog asks for an Advanced lesson on energy sorting. This is now cheap: **lesson 9 (Custom Decks, v1.28.1)
proved a lesson can take a screen rather than a play as its subject** — `#tutPanel` is `z-index:80` over the
overlay's `30` and `.tut-spot` is `82`, so the coach sits above a modal and can spotlight controls inside it.
Same shape here: open the pile viewer, gate on a promote, gate on a spend, show the promoted card in the shuffle
pile.

---

## Decisions needed

**1. Interaction: click-to-promote, or drag-to-reorder?**
**Recommendation: click-to-promote.** Tap a card, it moves to the front (tap again → next-most-recent behind it,
or a simple "selected order" list). It is one clear rule, works on a phone, and is trivially serialisable as a
permutation. Drag-to-reorder is much fiddlier and this codebase has been bitten there before — the coach-panel
drag bug in v1.19.1 stretched the panel full-height because of a `bottom`/`top` interaction.

**2. Does the viewer show the shuffle pile too?**
**Recommendation: yes, read-only, beside the energy pile.** The whole point is "what comes back to me sooner",
and the shuffle pile is currently invisible (`♻ N`). Showing both makes the consequence legible instead of
theoretical. It reveals no hidden information — it is your own pile.

**3. How do we handle the colored-pip caveat?**
Options:
- **(a) Label it.** Leave `payEnergy` greedy-by-suit and mark each card in the viewer with what would take it
  ("next ♥"), so the player sees why a promoted card was skipped. *Recommended* — no balance change.
- **(b) Make pips honour your order strictly.** A small engine change, but it makes costs materially more
  controllable, which is a **balance** change and would want an `analysis.js` round-robin before shipping.

**4. How many reorders per turn?**
**Recommendation: unlimited while it is your turn**, no confirm step. It is pure information-free rearrangement
of your own resource, it cannot be baited by the opponent, and a limit would only add UI. Cheap to restrict
later if it proves fiddly.

**5. Does the Rival (AI) use it?**
**Recommendation: not in v1.** `ai.js` would need a heuristic for "which energy do I want back sooner", and a
bad one is worse than none. The AI keeps spending FIFO, which is exactly today's behaviour, so nothing
regresses. Worth revisiting once there is a sense of how humans use it.

---

## Non-goals

- **No change to the reshuffle** — shuffle→deck stays random.
- **No change to costs, `canAfford`, or `costReq`** (unless Decision 3 goes to option (b)).
- **No opponent-pile inspection.** Opponents keep `energyCount` only; this feature must not become an
  information leak.
- **No reordering off-turn**, including during a response window — that is what keeps netplay sequencing simple.

---

## Rough size

| Piece | Size |
| --- | --- |
| Pile viewer UI (new surface) | **large** — the bulk |
| `reorderEnergy` + validation | small |
| Netplay intent op + host re-validation | small |
| Tests (engine, UI, netplay) | medium |
| Tutorial lesson + test | small, now that the pattern exists |

Comparable to v1.27.0 + v1.28.0 together — roughly one focused session, landing as ~3 commits (viewer, reorder +
netplay, lesson).
