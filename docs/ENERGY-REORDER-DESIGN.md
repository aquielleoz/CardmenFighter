# Cardmen Fighter — Reorderable Energy Pile (design)

> ✅ **BUILT in v1.29.0** — the engine op, both pile viewers, ⤒ Promote to top, the public log lines, the
> netplay intent, and Advanced lesson 10 "Energy Order". Opponent piles became view-only in the same pass.
> Kept for the *reasoning* — especially the measured payoff below, which is the argument for pairing this
> with a real draw engine. Still open: the AI using pile order (Demon Lord only, if ever).

*Design doc for the reorderable energy pile, written before implementation so the decisions were reviewable
while they were still cheap.*

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

**2. The netplay mirror already carries EVERY pile, in order.** `netview.js`'s `clonePlayer` does
`o.energy = cards(pl.energy)` for **every** seat, commented "public" — hands, decks, shuffle and removed piles
become face-down dummies, but energy travels intact for all players. So a host-side reorder reaches the owning
client through the existing mirror, and every client already holds every opponent's real pile.
No `netview.js` change at all.

> **CORRECTION.** An earlier draft of this doc claimed opponents receive "only `energyCount`". That was wrong —
> it came from reading `snapshotFor` (a lighter snapshot) instead of `mirrorFor`/`clonePlayer`, which is what
> clients actually get. Two things followed from the error and are now fixed: the "public log lines leak pile
> composition" worry was **overstated** (the pile was always public data), and view-only opponent inspection was
> filed as *deferred* on a false size estimate when it is in fact nearly free — the data is already client-side,
> so it is pure UI.

**3. The reshuffle is untouched.** Refilling the deck from the shuffle pile stays random, exactly as today.

### The one nuance to communicate

Costs are **part colored, part generic**: `costReq` requires `defaultPips(cost) = max(1, floor(cost/2))` pips of
the card's own suit, the rest being any suit (transforms J/Q/K are fully generic). A colored requirement takes
the earliest card **of that suit**, skipping past anything else you promoted.

So "put what you want recycled at the front" is true, with one honest caveat: **promoting a ♠ does not shield a
♥ from a ♥ pip requirement.** That is coherent rather than broken, but the UI has to make it visible or the
control will feel like it is being ignored. See *Decision 3*.

---

## How much is this actually worth? (measured)

Aj's review raised the real question: *nothing much accelerates the deck, so how often does ordering the shuffle
pile ever pay off?* Measured, not guessed — 400 AI-vs-AI games at default settings, instrumented for deck refills:

| | |
| --- | --- |
| median game length | **11 rounds** (max 25) |
| games that ever reshuffled | **154 / 400 = 39%** |
| median round of the first reshuffle | **12** |
| avg reshuffles per game | **0.41** |
| avg cards spent energy→shuffle | **24.1** of 52 |

**So in ~61% of games the deck never runs dry, and the median first reshuffle (round 12) lands *after* the median
game has already ended.** Ordering the pile pays off only in long games. Aj's instinct — that this is a
micromanager's nightmare relative to its payoff — is supported by the data.

And the acceleration really is thin. Every draw/mill effect in the game, one line per class:

| Class | Deck acceleration |
| --- | --- |
| ♦ Wizard | `A♦` Gather Energy (mill 3 → energy), `6♦` Back to the Books (draw 3) |
| ♥ Cleric | `3♥` Pray for Strength (mill 5 → energy), `4♥` Pray for Guidance (draw 2) |
| ♣ Fighter | `A♣` Prepare for Combat (draw 2), `5♣` Superior Training (draw 4), `8♣` Instant Recovery (draw 2 + reclaim) |
| ♠ Rogue | `3♠` Hand-to-Hand Mastery (draw 2), `4♠` Poison the Air (recycle), `6♠` Never Out of Options (draw 3) |

Two or three cards each, on top of a flat `DRAW_PER_ROUND = 2`. No class is a real engine.

### The second trigger, which changes the picture

Deck-out is not the only way the shuffle pile comes back. **Reclaim effects pull the shuffle pile into the deck
on demand** (`engine.js` ~1073: `pl.deck = pl.deck.concat(shuffle(pl.shuffle))`) — `8♣` Instant Recovery,
`9♦` Leyline under Athena, `4♠` Poison the Air. That trigger is **chosen by the player**, not waited on, so a
deck built around reclaim makes ordering matter immediately rather than at round 12.

### What to do about it — for Aj

- **(i) Build it as designed and accept it is a long-game / reclaim-deck lever.** Cheap, honest, no balance risk.
  The pile viewer alone is worth having (nothing today answers "what is in my pile?").
- **(ii) Build it, and pair it with a card-set nudge** that rewards cycling — the "suit ≠ class / hybrid classes"
  direction is the natural place for a genuine draw engine, and this feature would gain value automatically.
- **(iii) Defer the reorder half; ship only the viewers.** The viewer is the useful, low-risk part; reordering
  waits until something in the card set makes cycling common.

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

## Decisions — settled (Aj, review of this doc)

**1. Interaction: click, then a two-button context row.** Clicking a card in the pile opens **🔍 View** (read
the card — people forget effects) and **⤒ Promote to top**. Not drag. This reuses the existing description/context
pattern rather than inventing a gesture, and serialises as a plain permutation.

- **Promote semantics (Aj):** the newly promoted card **becomes the top** and everything else shifts down. So
  repeated promotes mean **last tapped is spent first** — a stack push, not a queue. One rule, it matches the
  button's label, and the pile stays a single permutation.
- **🔍 View shows the full text, exactly like the description box (Aj)** — the same `cardTextHTML` the board uses,
  including the **Form/Super boosted** lines for your current zone. No second, reduced card renderer.

**2. Two viewers, not one panel.** The energy pile and the shuffle pile get **separate** views, moved between
with **← / →** buttons. **The shuffle pile is not orderable** — it is a read-only look at what is queued to come
back. (Supersedes the earlier "show both side by side" recommendation.)

**3. Colored pips: label them, never make them strict.** Aj: *"we can't make it strict if it's not the expected
suit."* A ♥ pip requirement takes the earliest **♥**; the viewer marks what would claim each card so a skipped
promotion is visible rather than mysterious. **No engine change to `payEnergy`, and therefore no balance risk.**

**4. Unlimited reorders while it is your turn.** No confirm step, no per-turn cap.

**5. AI: parked.** The Rival keeps spending FIFO (today's behaviour, so nothing regresses). Aj floated giving it
only to **Demon Lord** later — deliberately parked as possibly too big for this feature.

**6. NEW — log every reorder.** Aj: the energy pile *"isn't really hidden information in paper play"*, and
logging makes usage trends trackable. See **Logging** below; this one has an open sub-question.

---

## Logging (Decision 6) — settled

Every promote writes a **public battle-log line**, visible to all players — e.g.
*"P2 moved 7♥ to the front of their energy pile."* Aj: the pile is not hidden information in paper play, and
public lines make usage trends trackable (for balance, and for `PLAYER-PROFILE.md`, which already ingests
exported games).

**Opponents' piles ARE viewable, view-only** (Aj: *"i thought we agreed that opponent could see the piles but
view only"*). Recorded wrongly as deferred in an earlier draft — the misreading is mine. It is cheap because the
mirror already ships every pile (see the correction above), so it is UI only: tapping a rival's ⚡ opens their
pile with every row read-only and no promote button.

### The consequence, stated plainly

Public log lines mean the **information model has already changed**: each reorder reveals one card of your pile to
everyone, so across a long game an attentive opponent can reconstruct much of it. Given that, keeping
*"no opponent-pile inspection"* as a **non-goal** would be incoherent — the information is already leaving, just
slowly and in prose. Per Aj that non-goal is therefore **struck as a principle and recorded as deferred scope**
(see *Deferred*).

Two follow-ons, both deliberately out of scope here:

- **It is a human-only tell until the AI reads it.** Decision 5 parks the AI, so the Rival will not act on your
  reorders — in solo play the information flows one way, from you to nobody. That is the safe direction, but the
  asymmetry is on purpose, not an oversight.
- **`netview.js` stays untouched.** Opponents still receive `energyCount` only; the log line is the sole channel.
  That holds this feature's netplay surface to exactly one new intent op.


## Non-goals

- **No change to the reshuffle** — shuffle→deck stays random.
- **No change to costs, `canAfford`, or `costReq`** — Decision 3 settled this: pips stay greedy-by-suit and get labelled, so `payEnergy` is untouched and there is no balance risk.
- ~~No opponent-pile inspection~~ — **struck.** Energy is open information, as it is on a table: opponents'
  piles are viewable, **view-only** (no promote button, no interaction). `netview.js` is untouched because it
  already sends every pile in order.
- **No reordering off-turn**, including during a response window — that is what keeps netplay sequencing simple.

---

## Rough size

| Piece | Size |
| --- | --- |
| Pile viewer UI — two views (energy orderable, shuffle read-only) + ← / → | **large** — the bulk |
| `reorderEnergy` + validation | small |
| Netplay intent op + host re-validation | small |
| Reorder logging (public battle-log lines; `netview.js` untouched) | small |
| Tests (engine, UI, netplay) | medium |
| Tutorial lesson + test | small, now that the pattern exists |

Comparable to v1.27.0 + v1.28.0 together — roughly one focused session, landing as ~3 commits (viewer, reorder +
netplay, lesson).

---

## Deferred (explicitly not "never")

- **The AI reading an opponent's pile.** The information is on the table for humans now; `ai.js` still ignores
  it (Decision 5), so it is a human-only advantage on purpose.
- **AI use of pile order**, possibly Demon Lord only (Decision 5).
- **A real draw engine** — the thing that would make ordering matter in more than 39% of games. Natural home is
  the *suit ≠ class / hybrid classes* direction already in the backlog.
