# Settled decisions and analyses

Things that are **not work**. Split out of `docs/NEXT-SESSION.md`'s BACKLOG on 2026-08-31 because that section
says "open work only" in its own heading and had grown to 601 lines, roughly a third of which was reference
material — settled decisions, measured dead ends, and design notes for features that had already shipped. A
backlog you cannot read top-to-bottom before starting work is not doing its job.

**Everything here is either decided or measured. The point of each entry is to stop it being re-argued or
re-derived**, so where an entry says "do not re-propose" or "do not re-run", that is the entry's whole purpose.
Nothing here was paraphrased on the way over — the text is as it was written when the work was done.

## Netplay architecture

- **NETPLAY AND SOLO SHARE THE LAYOUT AND THE CONTROLS. THEY DIVERGE IN EXACTLY TWO SEAMS** (Aj, 2026-08-29:
  *"i always wondered why we're not using the same layouts and controls in netplay and solo"* — the answer is
  that we do, and today proved it: the `.fighter` overflow above reproduces in SOLO). Verified, not assumed:
  `applyMirrorNow` does `state=st` then calls the same global `render()`, and `clientCheckWindow` dispatches to
  the same five solo prompts (`promptHumanResponse` / `openShieldGuardModal` / `promptHumanDiscard` /
  `promptLossTarget` / `promptHumanPreFight`) with the buttons gated to send intents. **Every netplay bug filed
  today sits in one of the two seams, so this is the map to check a new one against:**
  - **~~Netplay-only chrome bolted on OUTSIDE the layout~~ — CLOSED in v1.31.57.** `#netLeave` and `#emoteBar`
    were `position:fixed` on `<body>`, outside `#netroot` because `renderNet` rewrites it, so nothing could push
    them out of the way. Leave is now the third state of `#newBtn` and the emote bar lives in `#actions`. **The
    seam itself is worth keeping in mind: netplay-only chrome that does not participate in the layout cannot
    know what it is covering.**
  - **The orchestration spine** — two ceremony drivers (`resolveRoundCeremony` vs `clientPlayCeremony`) and two
    narrators (`logMsg` vs `say`). The stuck dim and the unnarrated counter are both this.
  The two drivers share the BEATS; what diverges is how each advances between them — solo calls the engine, the
  client waits for a mirror and **infers** what it meant (`handGrew`). That inference is the bug.
  **This is the argument for Aj's animation queue:** it makes the spine identical (an ordered event stream) and
  leaves only the event SOURCE different. Precedent that it works: `buildOppBeats` was extracted for exactly
  this reason — the free-for-all driver only logged, so every readability feature was silently missing at 3-6
  players.

- **AJ'S "DEMOTE CLIENTS TO RENDER + INPUT" PROPOSAL — mostly already true, and the residue is the real bug.**
  (Aj, 2026-08-29: *"maybe we can demote clients to just be renders and input collection. nothing is decided
  clientside."*) Worth writing down so it is not re-argued from scratch:
  - **For game STATE this already holds.** `applyMirrorNow` does `state=st` wholesale from the host, and every
    client input leaves as an intent through `clientSend`. Since v1.31.54 a stale-stamped intent is refused, and
    `resolveIds` drops fabricated cards. The client decides nothing about the game.
  - **The residue is the PRESENTATION layer**, and it cannot simply be moved to the host: the ceremony is a
    750ms-per-beat animation, so it has to be sequenced locally. What must stop is the client's little
    state machine (`clientCeremonyActive` / `pendingRoundMirror` / `awaitingRoundReveal`) **inferring** where
    the host is from `handGrew`. Host sends events; client sequences them; client never guesses.
  - So the overhaul as stated is not needed. The narrower rule that would have prevented this bug, the double
    narration (v1.31.53) and the stale-board actions (v1.31.54) alike: **a client may sequence, but never
    infer.**

- **SEATS ARE RE-CLAIMED, NOT KEPT, WHEN THE TABLE GOES BACK TO THE LOBBY (v1.31.95). Compaction was designed
  and declined.** Aj's words were *"both already joined"*, and the literal reading — keep every seat number
  across games — was worked out in full by two of the three designs judged for the feature: detect a gone peer
  (RTC: `dcs[i].readyState`; BC: a roll-call, since BroadcastChannel has no channel state at all), compact and
  renumber `hostSeatOf`/`seatDeckMap`/`seatNames`/`seatRuleGen`/`seatSuggest`/`chanSeat` together, null the
  stale channel bindings (`sendTo` returns on the FIRST `chanSeat` match, so a closed channel holding a survivor's
  new number would swallow its mirrors), re-send `t:'welcome'` point-to-point to every survivor whose number
  changed, and run it again at Start. ~250 lines and nine functions, every one of which the 48 netplay suites
  pass through. **It was declined because the seat reset gets the same outcome for free**: every client must
  press Ready again anyway (the deck travels on `t:'join'` and the picker is disabled while ready, so
  "pick decks again" REQUIRES un-ready), a peer whose tab is gone never re-joins and is therefore never dealt in,
  and BC needs no special case. What is given up: seat numbers may change between games at a 3+ table, and the
  reopened lobby reads "N connecting — waiting for them to choose a deck…" rather than listing names until each
  seat is re-claimed. Names and decks travel per seat at `t:'setup'`, so nothing mis-assigns. **If "seats kept
  by number" is ever wanted, the compaction design above is the shape, and the `_iceDown` channel mark
  (v1.31.95) is its RTC evidence; BC has none.**
  **Two more things settled in the same pass:** the client's battle log is stashed at lobby time and saveable
  from the lobby (not cleared at `t:'setup'` — the 🎲 roll line is `say`'d BEFORE setup in `hostStartRealN`, so a
  clear at setup erases it in every real game and no suite sees it, because `dbg=1` pins the roll off); and the
  host's `hostStartRealN` message order was NOT changed to make clear-at-setup safe, since the stash removes the
  need and the reorder's supposed benefit (names in the client's dice line) only holds for duels — the client's
  `t:'log'` rotation uses `numPlayers` from a `state` that is null until the first mirror.

## Phone layout

*SHIPPED IN v1.31.110 — the zones-into-panels move below was built, and the overlap is **0% at 327x660,
360x800, 390x780, 393x852 and 412x915**. The arithmetic and the declined proposal are kept because both would
otherwise be re-derived. What is still open is a look at a real device, which is a BACKLOG line, not work.*

- **THE CHIP ALONE DOES NOT FIX IT — MEASURED, so do not propose it as the cheap version of this.** The BACKLOG
  carried *"cheaper alternative worth testing first: render the in-panel equipment as a CHIP rather than a card
  … that alone would cut the panel growth from ~59px to ~20px"*. Both halves were measured on 2026-09-07: the
  chip is real (an `.eq` is **59px** stacked, **24px** as a chip once `.eqEff` is dropped), and it moves the
  collision **91% → 80% at 327x660 and not at all at 393x852**, because **the pile is covered by the FORM zones
  on the left, not the equipment on the right**. It shipped anyway — as the ENABLER, since the panels have to
  absorb whatever they host — but it is not a substitute for the reparent.
- **AND THE FILED NUMBERS WERE STALE BY THREE VERSIONS.** The entry recorded 327x660 as **210% covered** and the
  form zone as a **"20px chip"**. Re-measured on v1.31.109 before any change: **91%**, form zones **37-49px**,
  and a **393x852 collision of 8% that nothing had recorded at all**. The icon row (v1.31.104) and the header
  burger (v1.31.105) had halved it in between and nobody re-read the number. **Re-measure before building
  against a recorded measurement** — it is only true of the build it was taken on.

- **~~THE PLAY AREA IS CLOBBERED ON A NARROW PHONE~~ FIXED in v1.31.110 by the spec below.** It measured clean
  from v1.31.66 (the sideways scroll had been the cause) and came BACK once `landscapetest` stopped measuring an
  animation frame in v1.31.104 — the horizontal collision described here had been there the whole time, unseen.
  Original entry: (Aj, 2026-08-29, screenshot at
  ~327 CSS px: "Round 6" written over the pile label, the rival's FORMS & RIDES header over the pile cards, and
  the Hero's Javelin equip card covering the right half of a Full House). `#table` is a centred flex column with
  **four absolutely-positioned overlays pinned to its corners**:
  ```css
  #roundTag {position:absolute; top:6px; left:12px}
  .formZone {position:absolute; left:8px;  max-width:min(46%,188px)}
  .equipZone{position:absolute; right:8px; max-width:min(48%,180px)}
  #beaten   {position:absolute; top:50%;   left:12px}
  ```
  **Measured:** `#table` is **257px** wide at that viewport, so the two side zones are allowed
  `min(46%,188)=118` + `min(48%,180)=123` = **241px, i.e. 94% of the play area**, leaving 16px in the middle for
  a five-card Full House that needs ~200. The pile has nowhere to go but underneath them.
  The tell is already in the source: `#beaten` carries the comment *"center-left: clears the rival Forms zone
  (top-left) and your Forms zone (bottom-left)"* — a **hand-tuned corner arrangement that assumes a
  desktop-width table.** At 257px the corners ARE the middle.
  **THE FIX HAS A PRECEDENT IN THIS FILE ALREADY:** `.oppPanel .oppZones .formZone{position:static; left:auto;
  right:auto; top:auto; bottom:auto; max-width:100%;}` — the opponents strip de-absolutes the same zone when it
  renders inline. Do that at phone width so the zones flow and the pile owns the centre.
  **DECIDED 2026-08-29, SHIPPED 2026-09-07 (v1.31.110) — ZONES MOVE INTO THE PANELS (phone only).** The rival's Forms/Rides and equipment render
  in the rival panel, yours in your hand panel, reusing `.oppPanel .oppZones`; `#table` then holds only the pile,
  its label and the message, so the pile gets the full 257px. The framing that settled it: **the zones are
  per-player state, the table is shared state** — on a phone the info belongs next to the player it describes,
  which is better rather than merely smaller. Prerequisite: the `.fighter` wrap fix above, since the panels grow
  to 2-3 lines. Second piece already exists — `#handMeta` carries an empty `<span class="equip" id="youEquip">`.
  **As built it is a DOM MOVE, not a second render path**: `placeZones()` reparents the four zones by id under
  `matchMedia('(max-width:720px)')`, so every renderer, listener and animation keeps working untouched. And the
  reason it wins is worth stating, because "move a box between two boxes on the same screen" conjures no height:
  **the panels are wrapping flex rows with horizontal slack**, so a chip rides a line that already exists, where
  the same zone inside a 150px `#table` costs a whole new line the short board cannot pay for.
  **AJ'S COLLAPSING-HAND PROPOSAL WAS CONSIDERED AND DECLINED** (*"make the hand collapse like the mobile
  keyboard … this will mean that the drag to play functionality will be lost"*). It does not address this cause:
  the collision is horizontal, between edge-pinned overlays and the centred pile, so more vertical space does
  not separate them — it would cost drag-to-play and leave the pile clobbered. Recorded so it is not re-proposed.
  Vertical space IS genuinely tight (see the 340px floor and `landscapetest`), but the hand is the thing a card
  player looks at most, so it is the wrong first lever; the secondary chrome is the cheap one.

## The value-modifier model <a id="value-modifiers"></a>

**Settled long ago, implemented, and written down only in a changelog entry — which is why it got re-asked on
2026-09-07 and cost a round trip.** Aj, restating it: *"all modifiers are applied on top of the pile. the card
values, the base ones, what's printed on the card determine what specials it can belong to."* Recorded here so
nobody asks again.

**THE RULE, in two halves:**
1. **A card's PRINTED value decides what Specials it can belong to.** `detectCombo` groups and sequences by
   `fightValue`, so anything that changes a card's value changes its *identity* — a "7 that counts as 8" pairs
   with nothing. Shape is base values, always.
2. **Modifiers apply on top of the PLAY, and persist until that play is defeated** — the pile's value tracks
   them, the cards never do.

**The three flavours, and which layer each lives in:**

| kind | example | where | persists on the pile? |
| --- | --- | --- | --- |
| **conditional, standing** | Giant Boar (+1 **on your turn only**), Giant Swan (defensive) | `rideValue`, via `applyEquip` | **Boar no** — it only helps you BEAT a pile, never hold one, so it is excluded from `lockedDelta`. Swan yes. |
| **one-shot, then locked** | the pre-fight boost, a Counterfeit copy's `copyPlus` | `applyEquip` **and** `lockedDelta` | **yes** — frozen at play time, holds the pile until it is beaten |
| **ongoing, board-tracking** | equipment ± (`delta` / `oppDelta`) | `equipDelta`, re-read by `refreshPile` | **yes, and it keeps moving** — equip a debuff against a standing pile and it blunts it now |

`play()` stores `{raw, rawKey0, lockedDelta, mod}` and `refreshPile(st)` recomputes
`value = raw + lockedDelta + equipDelta(st, byPlayer)` from scratch, so add and remove are both correct.

**THE ONE PLACE THAT VIOLATED IT WAS COUNTERFEIT, and it took a real game to find** (v1.31.107). A boosted copy
carried `valueBonus` on the CARD and `fightValue` added it, so the copy could not pair, trio or run with a real
card of its rank — it could only ever be played as a jab, which inverts the upgrade, since the copy's whole
purpose is completing a set. **Phantasmal Illusion already copied "at base values"**; Counterfeit was the lone
exception. The bonus is a play-level delta now (`copyBonus`), in both `applyEquip` and `lockedDelta`.

**There is currently NO cast Technique that boosts only on the attack and falls off on the opponent's turn.**
Giant Boar does exactly that, but it is a Ride, not a 1-10 effect card (Aj, 2026-09-07). If one is ever added,
it belongs in `applyEquip` and **not** in `lockedDelta` — Boar is the worked example.

## Shapes we deliberately did not build

*Moved out of the handoff header on 2026-08-31. Both were settled by reading the source rules, and both are the
answer to "should we be more faithful here" — so they are worth keeping even though nothing was built.*

   - ~~**CHOP STRENGTH AS A MODE**~~ **DROPPED, 2026-08-28**, by Aj on reading the source rules: *"tien len
     likes to complicate things eh? … it's too complex for 'rulesets inspired by X'."* Worth keeping the
     lookup that killed it, because it is also the answer to "should we be more faithful here":
     - **A Tiến lên chop only ever answers a 2** — never any other card. [pagat](https://www.pagat.com/climbing/thirteen.html):
       *"if someone plays an ace you cannot beat it with your four of a kind, but if the ace has been beaten by
       a two, then your four of a kind can be used to beat the two."* So the fourth segment we had drafted,
       *any shape at all*, was never Tiến lên at all — it is **Dou Dizhu's 炸弹**.
     - **The faithful ladder scales with the CHOPPER'S SIZE**, not its kind: 3 consecutive pairs or a four of a
       kind beat a single 2; 5 pairs or two consecutive quads beat a *pair* of 2s; 7 pairs or three consecutive
       quads beat *three* 2s. That is the table Aj judged too complex, and the measurements agree it would buy
       nothing: re-measured 2026-08-28 on **real turns** (not 10-card hands — see v1.31.43), 5 consecutive pairs
       are offered on **0.51%** of turns at six players and 7 pairs on **0.00%**, so the upper two rungs are

   - **The landlord rule — SHELVED** (Aj, 2026-08-28). 斗地主 = "fight the landlord": bidding, a 3-card kitty,
     one player against two as a team, bombs doubling the stakes. It stays written down because the reasoning is
     worth keeping, but it is not queued: this engine has no teams and no asymmetric win condition, so it is a
     structural change of a different order from any shape rule.
   - **Winged airplanes** (飞机带翅膀). A bare airplane already needs six of ten cards; wings need eight. (The **Tiến lên preset** shipped
   in v1.31.34.)


## Balance

- **`loss=all` IS REPAIRABLE, and the whole avenue is now measured (PATCHNOTES 0n).** Everything below is done;
  do not re-derive it.
  - **The law:** under `all`, any shield-loss mitigation multiplies in value by (N-1), and only **two of four
    classes have any** (♦ Leyline; ♥ Holy Shroud). That is the entire reordering — Wizard/Sage/Cleric to the top,
    Fighter/Rogue/Berserker (the decks with none) to the bottom.
  - **Scaling the OFFENCE does not work and is closed.** `damageAll` and `damageSpan='half'` buy the crushed
    decks 2-3 points and no rank movement; the biggest beneficiary is Warlock, which already had defence.
  - **Sharing the mitigation DOES work.** `WARD_ALL` (Leyline + Holy Shroud + Apollo's caster-only lock protect
    the table, not the owner) takes the 6p spread from 32.1 to **18.3** while keeping the pacing win (30 → 11
    rounds), roughly doubles Fighter/Rogue, and *improves duels* (2p spread 13.2 → 8.4).
  - **Still not the shipped game:** 18.3 vs baseline 13.0, Fighter/Rogue at 8-10% against a 16.7% fair share,
    rho 0.55. Adding shields-2+N trades back (pacing 17 rounds, spread 23.3).
  - **Sanctuary is already symmetric** (`shieldAll`) — an earlier draft of 0n wrongly called it the remaining
    asymmetry. After Leyline and Shroud are shared there is no asymmetric protection CARD left; the only
    remainder is Form-granted (Apollo's caster-only lock), and it is Super-gated and rare.
  - **DO NOT "fix" this by moving mitigation between classes** (Aj, 2026-08-26: *"let colors be colors, we'll
    balance some other way"*). ♦ and ♥ being **allied on shield protection** is legitimate colour-pie design —
    some aspects are shared by every class (draw, some ramp), some are exclusive (buffs/debuffs), and classes
    are allies on one axis and opponents on another. Giving ♣/♠ mitigation, or relocating Leyline to ♥, are the
    same cross-pie mistake from opposite directions. (An earlier draft of this entry recommended the first, off
    a bad analogy: ♦ is the **ramp** class, not a draw class, so Leyline sitting there is not misfiled.)
  - **RETRACTED (2026-08-27): the "one-loss cap" is a NO-OP. Do not re-propose it.** The idea was that under
    `all`, protection should prevent one incoming loss rather than blanking the whole round. But `applyRoundLoss`
    strips **1** shield per struck target (2 only with Finishing Blow) and exactly one play wins a round — so a
    player already loses at most one shield per round under `all`. "Prevent one loss" and "blank the round" are
    the same thing, and the cap changes nothing.
  - **THE ACTUAL MECHANISM IS FREQUENCY, NOT MULTIPLICITY.** Under `chosen` you are the picked target roughly
    **1/(N-1)** of Special rounds, so protection's expected value is a fraction of a shield. Under `all` you are
    hit **every** Special round, so it saves a full shield every time. Protection gets ~(N-1)x more valuable
    because it is *used* every round, not because it blocks more hits at once. And `all` scales offence by (N-1)
    too — but **every class can play Specials while only ♦/♥ have protection**, so a universal multiplier lands
    on an unevenly distributed resource. That is the whole asymmetry, stated properly.
  - **What that leaves.** There is nothing to "cap", so the honest options are: (a) the **shared ward**, which is
    measured and works (6p spread 32.1 → 18.3, pacing 30 → 11 rounds); (b) make protection **less frequently
    usable** — counter-limited or once-per-game — which lowers its total value rather than its per-use value,
    and is untested; (c) leave `all` as the homebrew toggle it already is; (d) give ♣/♠ protection, which Aj has
    ruled out as cross-pie. Anything that makes being hit *less certain* just converges back to `chosen`.
  - The flags (`setWardAll`, `setDamageSpan`) are on `exp/shield-break-all`, default off, with behavioural
    self-checks in `mpsim`.


**WHY FLUSH IS NOT A SHAPE, and never will be.**
  - **FLUSH is optional-and-degenerate, not just unfair.** A Pure deck is **52 cards of one suit** (verified:
`Pure Wizard {"D":52}`), so with flush enabled *every* five cards in its hand is a flush, on demand, every
turn — while a Full Set deck holds 13 per suit and sees one occasionally. Aj's instinct (*"they're
effectively shanking every non mono suit player"*) understates it. Straight flush is trivial for them too.
This is a better reason than "suits do not rank" for why v1.14 cut them.

<a id="round-skew"></a>
- **~~A CLIENT'S HEADER READ "Round 8 — YOU WON" WHILE THE HOST SAT AT ROUND 5~~ — ATTRIBUTED TO DRAG-TO-PLAY,
  CLOSED 2026-09-02.** (Aj, 2026-08-28, third log pair; closed on his own reading: *"i think the 1st one was
  already fixed when drag play was fixed (it was the one that caused the client to play its own game)"*.)
  **A client running its own engine is exactly what produces a header several rounds ahead**, and that is what
  the drag path did until **v1.31.56**: `playCards` had no client guard, so a DRAGGED play ran the local engine
  and never reached the host — phantom rounds in the client's log, `Pair (NaN, NaN)`, a client "racing to the
  game end". Clicking Fight went through `doFight`, which was guarded; dragging did not. That asymmetry is why
  it looked like a sync fault rather than an input-path fault.
  The rest of that same report was resolved separately: the missing log lines were the narration audit
  (v1.31.58) and the doubled narration was `sayOnce` (v1.31.53).
  **NOT INDEPENDENTLY REPRODUCED SINCE**, and that is the honest caveat — no repro was ever built for the
  three-round skew itself, so this is an attribution, not a demonstration. **If it recurs, that attribution is
  wrong and the thing to reach for is the desync banner (v1.31.88)**, which now says so out loud rather than
  letting a client keep playing a board the host never confirmed; the old candidates (the stale-mirror guard,
  the ceremony teardown) were never demonstrated either and should not be re-chased first.

<a id="host-client-fork"></a>
## Giving the controller priority on their own object <a id="controller-priority"></a>

**Measured 2026-09-09, `epic/priority-windows` step 6.** `openResponseWindow` walked `k = 1..n-1` from the
controller, so the player who cast an object was never offered priority on it. `k = 0` fixes the ★ BACKLOG
entry's "skip" half and, by the same character, delivers *holding priority* — you can add to what you just
cast. Three runs of `node analysis.js 200 on` per arm, non-overlapping on both metrics:

| | `k = 1` (before) | `k = 0` (after) |
| --- | --- | --- |
| Quick responses / run | 6857 · 6961 · 6956 | **8172 · 8196 · 8199** |
| deck spread (#1 − #11) | 12.0 · 13.4 · 12.5 | **9.2 · 8.7 · 9.8** |
| Pure Wizard win% | 56.5 · 56.9 · 55.8 | **54.0 · 53.8 · 54.3** |
| avg rounds (Pure Wizard) | 12.2 · 12.3 · 12.3 | 12.2 · 12.2 · 12.3 |

**+18% Quick responses is the DIRECT effect** — one more seat can act in every window — and it is the tightest
number here (three runs within 27 of each other), so it is the one to trust.

**The spread narrowing ~3.4 points is a CONSEQUENCE, not the goal.** More interaction compresses win rates
toward 50%, and the deck with the most to lose is the one that was winning: Pure Wizard drops ~2.3. It is a
welcome direction — deck spread is this repo's primary balance metric, and the v1.31.0 revert happened because
spread blew out to 40.7 — but **this was a rules correctness fix and the balance move is a side effect.** Do
not cite it as a balance lever, and do not "tune" it.

**Pacing does not move**, which is the standing "options, not tempo" result holding for a priority change as
well as for every new shape.

## The strategic pass, and what the study found instead <a id="strategic-pass"></a>

**Moved out of the BACKLOG on 2026-09-07 — it is a measured result, not work.** It had been sitting inside the
open "initiative has no catch-up" entry, where a settled dead end reads as something still to try.

**STUDIED 2026-08-23 — the strategic pass does NOT work in multiplayer; the `numPlayers === 2` gate stays.**
`passsim.js` measures it as a within-game A/B (same table, half the seats allowed to pass, seats rotated, one
deck and one tier for everyone), so deck, tier and seat luck are identical in both arms by construction:

| case | delta to the passing arm | |
| --- | --- | --- |
| demon DUEL | **+17.3 pts** | real — reproduces the original "~59% vs always-contest" |
| knight duel | +1.5 | noise — the duel edge is a **demon** edge, not a smart-tier one |
| 6p, thresholds 5→10 (fires up to 8x/game) | +0.6 / −1.7 / +1.7 / −0.9 / −2.2 | all noise |
| 3p / 4p, 3200 games | +0.9 / −0.1 | noise |

**The old comment was wrong in an interesting way.** It said conceding "hands the trick to several opponents",
implying HARM. There is no harm — the policy is **inert**. Conserving a card is a **two-body** attrition edge;
against five opponents the marginal card stops mattering, so the pass fires and changes nothing. Raising the
threshold just buys more firings of the same zero.

**Aj's own policy is the better idea and still not significant.** The shipped rule concedes on *hand size*; Aj
was conceding because he *held a Special he meant to lead* (`AI.setStratPassMode('combo')`). It is the only
variant with a consistently positive sign — **+0.9 at both 3p and 4p over 3200 games** — inside noise. A
low-power **+4.0 regressed to +0.9 at 6× the games**; do not be fooled by a first run. Worth revisiting only
**after** an initiative fix, because its whole premise is "I will get to lead this later", which is exactly what
the initiative loop denies. That revisit is the open half and stays in the BACKLOG.

### Two findings from that study that matter more than the pass

- **Initiative concentration grows with player count.** The busiest leader holds **40% of rounds at 4p** (fair
  25%) and **32% at 6p** (fair 17%) — 1.6–1.9× its share. Everyone leads *eventually* across a 33-round game,
  but the local streaks are real, and that is the "three rounds in a row" feeling. **`passsim.js` prints this,
  so it is the harness any initiative fix is evaluated against.**
- **The AI is not jab-locked at all — only ~20% of its plays are jabs** (it casts ~56 Specials a game at 6p).
  A human felt starved of Specials while the AI was swimming in them. **That asymmetry is the real lead**, and
  it is consistent with the initiative loop: the AI keeps winning rounds, keeps the lead, keeps leading
  Specials. **Find out what the AI does that a human cannot before redesigning anything.**

## Game length by player count <a id="game-length"></a>

**Measured 2026-08-24, from Aj's question "is it weird that everybody mills but not everybody loses a shield?"**
Moved out of the BACKLOG on 2026-09-07: the measurement is settled, the lever it implies is not.

Under the live `SPECIAL_LOSS_MODE='chosen'` + `MILL_SCOPE='targeted'` pairing, a Special win costs the table
**one** shield however many people are at it — so total shields scale with player count while damage does not.
Median length goes **11 (2p) → 15 → 22 → 33 (6p)**. The engine's own defaults (`all` + `universal`) hold it
**flat at ~10 rounds** at every count.

**Everything else chased that day compounds for three times as long in a 6-player game** — jab-round grind,
option starvation (0.5 legal plays when following at 6p), initiative concentration. Consider length before
designing around any of those symptoms.

**Do NOT just flip to `all` + `universal`.** ~9 rounds may be too short for six players, it is a large rules
change, and `loss='all'` is separately a measured balance disaster — see the [`loss=all`](#balance) entry and
PATCHNOTES 0j. The open design question is whether something between the corners lands at ~15–18 rounds; that
half stays in the BACKLOG.

## Where the deck is stuck: VALUE, not shape <a id="value-stuck"></a>

**Measured with `stucksim.js`, 2026-08-25.** Moved out of the BACKLOG on 2026-09-07 — it is a measurement that
should not be re-run, sitting inside an open card proposal.

At 6 players **every deck is stuck on ~85% of following turns**, and **62–72% of those are VALUE-stuck** (right
shape, too low) rather than shape-stuck.

- **Pure Rogue is 68% value-stuck and the LEAST shape-blocked deck (32%)**, with the highest share of
  **deficit-of-one** losses (14%) — it misses by a single point more than anyone.
- **It is not a Rogue-specific problem.** Every deck is 62–72% value-stuck, so a "slash −2" would unlock
  **19–24%** of stuck turns for *any* of them. That is why the proposal works as a **card** (only Rogue holds
  it) rather than as a fix for a Rogue weakness. Rogue benefits slightly more than average, and benefits most
  from the cheap slash-1.
- **CORRECTS AN EARLIER CLAIM.** Rogue's problem was described as *"shape, not economy"*. It is **value**. Do
  not re-derive this.

## The host/client fork — closed 2026-09-01

- **THE FORK `nettest_sync` CAUGHT IS UNDERSTOOD AND FIXED (v1.31.80), after being open since 2026-08-28.**
  The mechanism, stated plainly: **a mirror is the only thing that can tell a client the round advanced and the
  turn is now its own — and a parked host's state deliberately stops changing.** `reassertMirror()` (v1.31.75)
  re-sends once at the park; if that one is lost too, nothing will ever say it again, both peers sit waiting for
  the other, and the table is dead for good. v1.31.80 adds a **heartbeat while parked**.
  **THE CONFIGURATION THAT MATTERED WAS THE ONE NEVER TESTED**, and the old entry named it correctly as the
  missing experiment: the deal lost AND **the client** to act next. Every earlier forced-drop probe left the
  HOST to move, so what looked like persistence was the harness giving up — which is how `reassertMirror` came
  to be withdrawn once on no evidence, then re-landed.
  `nettest_mirrordrop.js` is that experiment, and it is **permanent this time**. Measured on the build before
  the fix: **3 swallowed mirrors is survivable, 4 deadlocks — deterministically, 3 runs of 3.** With the
  heartbeat the same board recovers at **12**. A/B: 3/3 fail without, 4/4 pass with.
  **WHY 3 IS SURVIVABLE AND WHY THE HANDS USUALLY AGREE: a mirror is a full SNAPSHOT, not a delta.** Any later
  mirror heals a lost one, so the render storm normally papers over the loss — which is exactly why this was so
  hard to catch and why the recorded card-id divergence was rarer than the underlying fault. The damage that
  persists is not a wrong HAND, it is the client sitting a whole ROUND behind with nobody on turn.
  **THE ID-LEVEL DIVERGENCE IN THE OLD REPORTS IS THE SAME BUG SEEN EARLY** — caught in the window before a
  later mirror healed it.
  **THREE HYPOTHESES WERE TESTED AND REJECTED ALONG THE WAY. Do not re-run them:** a second ceremony discarding
  a held round mirror (landing the held mirror first made it WORSE, 5 failures in 8); the broadcast storm (real,
  fixed in v1.31.65, rate did not move); and the v1.31.64 rules change (A/B'd, predates it).
  **AND "CLEAR THE DEDUPE CACHE ON A ROUND CHANGE" IS A NO-OP** — `round` is in the mirror, so a round boundary
  always changes content and the deal mirror is never suppressed by dedupe. This was about to be built twice.
  **IT HAD STOPPED REPRODUCING SPONTANEOUSLY BEFORE IT WAS FIXED, WHICH NEARLY CLOSED IT AS A GHOST.** 35/35
  clean on v1.31.74 and **30/30 on v1.31.79** — 65 consecutive clean runs, which excludes the recorded 1-in-4
  rate at about one in a hundred million. The right response to "it stopped reproducing" was not to close it but
  to **force the mechanism** and ask what the system does. That is what found it.
  **IT IS NOT THE DRAG-TO-PLAY BUG** (Aj asked; worth recording because the two are easy to conflate). Two
  independent proofs: `nettest_sync` never drives the drag path at all — it clicks Fight and Pass — and the fork
  was measured at 2-3 in 8 on **2026-08-30/31**, after the drag fix landed on **2026-08-29** (v1.31.56). What
  the drag bug DID cause is the *"we can't get to round 2 legally"* report that prompted the suite's existence.
  Three separate things: that complaint (drag, fixed v1.31.56), this fork (fixed v1.31.80), and the deadlocked
  table `nettest_sync` caught on 2026-09-01 (fixed v1.31.75).
  **`nettest_sync` remains the only suite that compares the two peers to EACH OTHER** rather than each to
  expectations. Keep it green-or-explained, never disabled.

<a id="ai-strength"></a>
## AI strength

- **~~THE DEMON LORD SHOULD ONLY BOOST WHEN THE RESULT SECURES THE INITIATIVE~~ — BUILT, MEASURED, DECLINED
  (2026-09-02).** Aj's proposal, and a reasonable one: *"if he was to boost and then the final value is still
  middling, i'd like him to consider only for when it is more likely to secure the initiative"*. Built in the
  same shape as `lockoutWorth` — Aj's own tiers (low 3-6 / mid 7-10 / high 11+), the same two public
  information sources (`st._seen` and hand sizes), a REASON string, holds tallied by name — so it reasoned only
  from what a player at the table can see. Head-to-head at demon, 12,000 decided games per row:

  | variant | effect |
  | --- | --- |
  | refuse a mid-or-lower result unless rivals' highs are spent (as specified) | **−0.77 pts, −1.70σ** |
  | refuse only a LOW result (3-6) | −0.07 pts, −0.15σ |

  **The first is actively worse** — roughly half of what the Demon Lord's `keepsTheWin` behaviour bought
  (v1.31.79), and in the wrong direction for the tier gap it was meant to widen. **The second is free but fires
  5 times in 400 duels**, so no player would ever perceive it. Aj: *"don't gimp the demon lord"*.
  **WHY THE INTUITION DOES NOT HOLD, and this is the part worth keeping:** refusing the boost does not save it
  for a better spot — it means **passing**, conceding the round outright. Winning a middling round still takes
  the initiative and can strip a shield, and a rival who takes it back has spent a high card to do so. The
  boost's value only exists against the pile in front of you, so there is no "later" to save it for.
  **A note on the implementation, for anyone rebuilding it:** the `rivals-spent` evidence branch — the part that
  made this a model rather than a bare value threshold — fired **4-5 times in 400 games**. Effectively dead
  code, and by the standing rule that is not a safeguard.
  **The promising direction is WHICH boost it spends, not WHETHER to spend one.**


- **PROTECTING THE AI's LAST LEGAL FIGHT — MEASURED, THEN SHIPPED AS A DEMON-ONLY BEHAVIOUR (v1.31.79).**
  (2026-09-01. Aj: *"will it make the ai win more if we unlocked the JQK? because we might have to fold that
  into the demon lord"*.) **The first answer given was "no, too small to be a difficulty lever", and it was
  wrong — because it compared the effect to nothing.** Against the thing that actually matters, the tier step
  itself, the demon-only guard moves the knight→demon gap from **+6.14 to +7.63 points: about a quarter of the
  whole gap.** Aj shipped it for three reasons, only the third of which is about win rate: a behavioural
  difference between knight and Demon Lord, something a player can feel and then learn to exploit, and a wider
  tier gap. **"Small" is not a property of a number — always name the comparison.**)
  166 activations in 1200 duels leave the seat with no legal fight (`transform` 95 · `equip` 30 ·
  `destroyShield` 13 · rest ≤6 — seeded, so it reproduces exactly), and **0 of them have a boost banked** — which is what says v1.31.78 is
  complete rather than partial. Protecting them measures as follows, paired head-to-head, 8000 decided games
  per row (two arms, guard on seat 0 then on seat 1):

  | variant | knight | demon |
  | --- | --- | --- |
  | protect the **transform** only ("unlock the JQK") | +0.70 pts, 1.25σ | +0.81 pts, 1.45σ |
  | protect **every** activation | +1.08 pts, 1.92σ | +1.61 pts, 2.88σ |

  **The JQK-only variant is indistinguishable from zero**, so what shipped is the blanket one, restricted to
  **demon** (`isTop(diff)`); every other tier keeps the v1.31.78 rule of protecting only a fight it has already
  paid for. In tier terms, measured the same way:

  | | knight→demon gap |
  | --- | --- |
  | before | +6.14 pts, 13.5σ |
  | after | **+7.63 pts, 16.7σ** |

  **Controls: knight-vs-knight and demon-vs-demon both land on exactly 50.00%** over 6000 decided games, which
  is the check that the two-arm pooling really does cancel the seat advantage.
  **It moves nothing else.** Deck balance at demon is unchanged — spread across three replicates 10.9/10.4/8.5
  before against 9.2/10.4/9.3 after, Pure Wizard 55.2 → 54.4 mean, all inside ±1.3 per-deck noise. Persona
  parity is unaffected. It costs 0.3% of activations.
  **The reading to keep: those 166 are near-break-even decisions, not 166 mistakes** — two thirds are a J/Q/K
  going into the Forms zone, which is a fair price for a round. That is exactly why it is a demon PERSONALITY
  and not a fix applied everywhere: at knight, fumbling a winning hand into a Form now and then is in character.
  **`valueBoost` 3 of the 166 IS a real bug and is still open, though it is worth ~nothing on its own:**
  `pickValueBoost` never asks whether we are ALREADY winning, so it can spend a boost on a fight we had won —
  and in those three it spent the card the play needed. `counterfeitHelps` has the guard to copy:
  `if (beatsCur(pl.hand)) return false;`.

  **THE METHOD IS THE DURABLE PART — no existing sim can measure AI strength at all.** `analysis.js`,
  `mpsim.js` and the rest run the SAME AI on every seat, so they are symmetric and structurally blind to "is
  this change stronger?". A head-to-head needs three things, and the first two each produced a wrong answer
  before they were fixed:
  - **Seed `Math.random` per game.** The engine falls back to it (`shuffle` with no rng, `chooseTarget`), so
    runs are not reproducible and the two arms see different shuffles. Seeding it also PAIRS the arms, which
    is most of the variance gone.
  - **Prove the instrumented build is byte-identical when idle** — same wins, exactly, with the flag off. The
    first version was not, and the difference hid inside ordinary noise.
  - **`personasim`'s verdict at 900 games is NOISE, and CLAUDE.md's "2.8 points" reads as a fixed floor when
    it is one draw from a wide distribution.** Three CONTROL runs — six identical personas, so the true spread
    is zero — printed **5.6, 1.3 and 4.6**, straddling both the floor and the WIDE threshold. A single run
    flagged this change WIDE on one build and OK on the other, and both readings were meaningless. **Run it at
    least three times, or do not quote it.**
  - **Run BOTH arms and pool.** Seat 0 carries a consistent ~2.3-point advantage here, which is larger than
    every effect being measured; one arm alone reports it as the result.

## Joining, discovery, and the QR path

*The `feat/qr-scanning` parked branch keeps a short pointer in the BACKLOG, per the rule that a parked branch
needs a backlog entry naming why it is unmerged and what would revive it. The reasoning lives here.*

*One sub-item below is stale and left in place rather than edited: it argues version skew "is worth doing
independently" — that SHIPPED in v1.31.21.*

- **Make joining less of a hassle — ideally "find games on my network"** (Aj, 2026-08-25: *"the code thingies
  are amazing and wow you can really play with anyone anywhere… but it's also a bit of the hassle"*).
  - **The hard limit first, so nobody spends a day on it:** a browser page **cannot discover peers on a LAN.**
    There is no mDNS, no UDP broadcast, and no socket API; WebRTC's local candidates are mDNS-obfuscated on
    purpose. Automatic "games near you" is **not achievable** while the game stays a serverless single file —
    that is a real constraint of the platform, not a missing feature.
  - **What DOES cut the hassle, in rough order of value per effort:**
    1. **QR invite codes — phase 1 SHIPPED (v1.31.17, show only). Phase 2, SCANNING, is BUILT AND GREEN BUT
       DELIBERATELY NOT MERGED** — branch `feat/qr-scanning`, PR #29 closed 2026-08-25, 21/0.
       - **Why it is not in the game.** Scanning needs an origin that can be granted camera access. A file opened
         from Android's Downloads is **`content://` — an opaque origin**, so Chrome rejects `getUserMedia`
         **without ever prompting**. Aj's symptom was exactly that: site settings read "Ask first" and it never
         asked. Confirmed by a clean A/B on the same phone — an https site detects the camera and offers to
         prompt; the `content://` page never gets asked. **This is not a permission that can be un-denied.**
       - **The two real fixes were both declined or impractical.** Hosting the game at a URL (GitHub Pages) makes
         it a permanently public playable link and shifts the project away from "one offline file" — Aj said no.
         A local server app on the phone works (`http://localhost` IS a secure context) but needs a separate app.
         Note that serving over the LAN does **not** work: `http://192.168.x.x` is not a secure context, so the
         obvious "keep it local" idea fails on exactly the thing it would be for.
       - **And desktop-only is not worth it.** The remaining configuration is holding a phone up to a laptop
         webcam, which is not clearly better than copy-pasting into a chat both players already have open. The
         case where scanning genuinely wins is **phone↔phone**, which is the blocked one. Aj, on facing two
         laptops at each other: *"like they're kissing ahahhaa"* — the objection is correct.
       - **Reviving it is a merge, not a rebuild.** The branch is green and rebases onto v1.31.18 cleanly.
         Revisit **only** if the game is ever served from a grantable origin. Do not rebuild it from scratch,
         and do not re-litigate the origin question — it is settled above.
       - **Still unverified by a camera: the LANDSCAPE phone case** for *showing* a QR, the weakest geometry at
         **2.0 CSS px per module** (height-capped on purpose so the whole symbol stays on screen). Desktop is
         3.0, portrait phone 2.67, and `qrtest.js` asserts those floors.

       - Reading needs a camera (`getUserMedia`) plus a decoder. `BarcodeDetector` is **Chromium-only**, so
         Firefox and Safari need an inlined JS decoder behind it — that is the real cost of phase 2, not the
         camera plumbing.
       - **CONFIRMED SCANNABLE on a real phone** (Aj, 2026-08-25: *"wee my phone could read it"*). That was the
         open question phase 1 ended on, and no test could answer it — a decoder is handed a perfect bitmap and
         will read a symbol far too small for any camera. A v23 / 109-module symbol at the shipped geometry
         works with a real camera, so the geometry is no longer a risk to phase 2.
       - **Still unverified: the LANDSCAPE phone case**, which is the weakest geometry at **2.0 CSS px per
         module** (height-capped on purpose, so the whole symbol stays on screen without scrolling). Desktop is
         3.0 and a portrait phone 2.67. `qrtest.js` asserts those floors, so a payload growing past ~v29 shows
         up as a failure rather than as an unscannable code in someone's hand.
       - **Shortening the payload (item 3 below) is no longer a blocker — it is a robustness win.** It shrinks
         the version and improves every number at once, which is what would buy the landscape case and
         scanning at arm's length rather than up close.
    2. ~~**Share-sheet handoff.**~~ **SHIPPED in v1.31.19** — this entry went stale and still read "now the
       TOP item" three versions later; `sharetest.js` has covered it since. Original note: `navigator.share()` on the invite code: one
       tap into whatever chat the two players are already using, instead of select-copy-switch-paste. Aj,
       2026-08-25, on settling for browser-only: *"you can always copy paste the code to a chat program"* —
       which is precisely the manual version of this. Genuinely ~2 lines, works on Android Chrome today, and it
       degrades to the existing Copy button where `navigator.share` is absent (desktop Firefox, older Safari).
       Cheapest real win left in joining.
    3. ~~**Shorter codes.**~~ **SHIPPED in v1.31.46** — 1,036 chars to **163**. See the changelog.
  - **AN ANDROID APK WAS CONSIDERED AND DECLINED (2026-08-25). Do not re-propose it.** It would genuinely solve
    two things: a WebView using `WebViewAssetLoader` serves the page from `https://appassets.androidplatform.net/`,
    a real secure origin, so camera scanning would work; and **native UDP/mDNS makes LAN discovery actually
    possible**, which is impossible for a browser page and was Aj's original ask. It is still a NO:
    - **Android toolchain churn is the dealbreaker** (Aj: *"too much of a hassle with the api churn"*). Target
      API bumps and Gradle churn are permanent recurring maintenance, in a repo whose entire dependency list is
      "Playwright, for tests". The Kotlin side would be ~150 lines; the toolchain is the whole cost.
    - Also: two artifacts to keep in sync, signing/distribution, iPhone players still on the web build anyway,
      and `BarcodeDetector` is **not guaranteed in Android WebView** — so "the APK fixes scanning" was never
      even verified.
    - **Cross-play was NOT the objection, and it is worth knowing why:** a WebView APK runs the same HTML in the
      same Chromium engine, so netplay with desktop Chrome works by construction. The asymmetry would be in
      *discovery only* (app↔app), which lands where it costs least, since desktop pairings are exactly the ones
      where pasting a code is already easy.
    - **The one real cross-play risk it surfaced is worth fixing anyway: VERSION SKEW.** Netplay has no protocol
      version negotiation, so two builds can mismatch and just misbehave. Both sides already exchange
      `t:'join'`/`t:'setup'`, so carrying a version and warning on mismatch is ~20 lines plus a suite. Aj's own
      stale phone build already proved this happens in the wild. **This is worth doing independently.**
  - **The one thing that would give true discovery** is a rendezvous service — even a 20-line local one — and
    that breaks "no server, no install, runs offline", which is the project's whole shape. If it is ever wanted,
    make it strictly **opt-in** and keep the code path as the default.

## Test harness

<a id="sweep-scheduling"></a>
- **LONGEST-FIRST SCHEDULING IN `sweep.js` IS KEPT ON THEORY, NOT ON EVIDENCE (measured 2026-09-02).** Aj asked
  whether the runner's scheduler was pulling its weight. It is textbook LPT — the floor for N lanes is
  `max(total_work / N, longest_single_suite)` and bad ordering strands a slow suite in the tail — but A/B'd
  against the deliberate worst case (shortest first), interleaved so machine drift hits both arms:

  | | run 1 | run 2 | mean |
  | --- | --- | --- | --- |
  | longest-first (shipped) | 235s | 142s | 188s |
  | shortest-first (worst case) | 168s | 157s | 162s |

  **Indistinguishable.** The 26s gap between arms sits inside a 93s spread WITHIN the longest-first arm. It is
  one `.sort()` line reusing the `SLOW` list that `--fast` needs anyway, so it stays — but **do not quote a
  saving for it, and do not delete it expecting a slowdown either.** Resolving a ~26s effect against this
  machine's noise would need many replicates and would be measuring the desktop.
  **THE GENERAL POINT, and it is the second time in two days:** a claim that follows from sound theory is still
  a claim. This one was written into a PR description as fact before anyone measured it.

<a id="sweep-cost"></a>
- **WHERE A FULL SWEEP'S TIME ACTUALLY GOES — timed per suite, 2026-09-01, v1.31.80.** Aj asked; the answer was
  concentrated, and every intuition about it was wrong in a useful way. **Do not re-derive this; re-time it.**

  | | |
  | --- | --- |
  | whole sweep | 72 suites, **637s (10.6 min)** |
  | six slowest (`landscapetest` 97 · `browsertest` 66 · `mptest` 60 · `exporttest` 39 · `rulestest` 25 · `lessontest_twos` 21) | **328s — 51%** |
  | all 44 netplay suites | 196s (31%), 4.5s mean |
  | the other 67 suites | 4.6s mean |

  **The cost was fixed `wait()`, not the 3.1MB page.** `landscapetest` opens a fresh context per viewport —
  thirty of them — each spending 2650ms of sleeps: **79s of its 92s**. Polling took it to 33s (v1.31.81).
  **THE NETPLAY SWEEP IS CHEAP AND MUST NOT BE SKIPPED.** All 44 suites are 196 seconds. v1.31.57 left
  `nettest_elim3` red for five versions because a change "did not look related", so the rule that you run the
  whole netplay sweep after a UI change costs 3¼ minutes and has already paid for itself once.
  **`browsertest` (66s) and `mptest` (60s) are real work** — 12 duels and 82 free-for-all assertions. Not sleeps.

- **~~STUB `art.js` OUT OF THE TEST BUILD~~ — BUILT, VALIDATED, MEASURED AT 1 SECOND, REVERTED (2026-09-01).**
  Aj's proposal, and a reasonable one: the page is 3.1MB, `art.js` is **2.16MB** of it, and a layout suite that
  only measures geometry cannot need it — art is applied **only** as a CSS `background-image`, which never
  affects layout, so a stub build is safe *by construction*. `build.js` already stubs `faces.js`, so the pattern
  existed. It was built (3.1MB → 940KB), pointed at `landscapetest`, and validated with a **fidelity anchor**
  that re-opened one viewport on the real page and compared card/board/hand/pile/actions geometry — identical to
  the pixel.
  **It saved one second: 34s on the real build, 33s on the stub.** Page size is not what these suites spend
  their time on. Reverted rather than kept, because the standing cost is a second build artifact that must never
  go stale, a `.gitignore` entry and six assertions to maintain — for 1s.
  **Do not re-propose this without timing the suites first**, which is the general lesson: the 2.16MB number is
  vivid and the 2650ms-per-viewport number is not, and only one of them mattered.

- **The "fixed-wait flake" list is EMPTY, and it was never about fixed waits.** Three of the four suites had a
  real dependency; the fourth would not reproduce at all.
  - `nettest_full` was reporting an actual game bug (v1.31.20 — the host locked out of a round it won). It ALSO
    had a deal-dependence of its own in the beat branch, fixed separately: it played one arbitrary card and
    passed if that did not land, so "BOTH players led/beat" could fail with `client 0` purely on the shuffle.
    It now tries every card until one lands (14/14, half the runs in sequence).
  - `nettest_log` and `nettest_names` were both **deal-dependent** in the same way: the host played whatever card
    was first in its hand and the suite then required the client to beat it. The apex 2 is unbeatable and an Ace
    nearly always is, so a bad shuffle took out the client-narration assertions together — 4 of them in
    `nettest_log`, 2 in `nettest_names` (measured **2 failures in 10 runs** before the fix, the same two every
    time). Both now stage hands with `__cmf.force()`.
  - `exporttest` **would not reproduce: 10/10 clean.** Left alone deliberately — fixing a suite that is not
    failing is speculation. If it fails again, look for a real dependency before touching a timeout.


- **Two real harness facts found while chasing the (now fixed, v1.31.9) position-dependent suites:** three
  suites share port **8303** (`concede3`/`elim3`/`energy` — fine serially, never concurrently), and every
  suite awaits `srv.listen` with **no error handler**, so a genuine port collision hangs silently instead of
  failing.

<a id="lessontest-twos"></a>
- **`lessontest_twos`' ONE FAILURE: MECHANISM FOUND, FIXED IN v1.31.99, NEVER REPRODUCED.** Filed here rather
  than in the BACKLOG because no work remains — it sat under `## BACKLOG` for two versions and Aj read it and
  asked whether there was anything to do, which is the documented failure mode ("a settled decision left in the
  BACKLOG gets re-argued") happening in real time.
  **What was measured, and it is the transferable part.** Every poll in the lesson harness returns with an
  enormous margin on an idle machine — `atStep` in **0-4ms** of 12000, the Rival's answers in ~1.07s of 30000
  (**28x**) — except one: the full-house wait took **4676ms against 14000, a 3.0x margin, the only poll in the
  harness under 4x.** The single day the suite failed (2026-09-02), it ran **100s against its usual 20s — a 5x
  slowdown.** A 3x margin under a 5x slowdown blows that budget and nothing else, which is precisely the
  observed failure: *"the Rival led a full house built on three 2s"* red (the pile still held the previous pair,
  because the Rival had not led yet), `atStep(8)` red behind it, every other assertion green.
  **The root cause was a PARTIAL FIX.** v1.31.84 raised these polls 9s → 30s and left two explicit overrides
  behind. Both take the default now; the full-house wait sits at **6.4x**. The other six sub-default budgets
  were measured rather than raised on principle — all under 5% of budget — because raising unmeasured budgets is
  how the first partial fix happened.
  **TWO EVENTS HAD BEEN CONFLATED, and that is worth keeping.** v1.31.94 fixed a page-starvation bug of my own
  making that produced an IDENTICAL signature (100s, 23/6) — but it postdates the sighting by a day, so it never
  explained it. Nothing was changed on 2026-09-02; the failure simply stopped happening. An earlier BACKLOG
  entry had also labelled it *"sequence divergence, a fourth timing class"* — a name invented for an undiagnosed
  failure, and wrong.
  **It never reproduced** (12/12 green under six concurrent copies at load 7.5), so this is a mechanism that
  fits every observation plus a fix for the only thin budget — **not a caught bug**. If it recurs the harness
  says so itself: `until` warns on any wait past half its budget in every run, and `LESSONPOLL=1` prints them
  all. The rule this produced is in [`CLAUDE.md`](../CLAUDE.md) — *measure the margin, or the next partial fix
  looks complete.*

## Exported-data facts

- **Old exported logs are v1.0 and merged.** Anything analysed from a multiplayer export before v1.31.5 had
  every opponent collapsed into one bucket and their fight counts stuck at 0. If those files still exist they
  cannot be repaired — the information was never recorded. New exports are `v:'2.0-mp'`; check the field.
- **A duel export still has `rival` = seats[1]** (not merged), so old duel analysis is unaffected.


## Scope decisions

- **Deck editing** — deliberately out (Aj: create + delete only). If it comes back, note a saved deck's
  IDENTITY is its composition key, so "editing" is really delete + re-add, and anything pointing at the old key
  must be migrated.

## The priority design docs vs what actually shipped <a id="priority-divergences"></a>

**Audited 2026-09-08** — 74 findings, 64 confirmed by adversarial verification. The live model is
[`PHASES-AND-PRIORITY.md`](PHASES-AND-PRIORITY.md); the open defects are in the BACKLOG. **This section is the
third bucket: places where the shipped game deliberately differs from `STACK-DESIGN-v0.53.md`, so nobody
re-argues them or "restores" the doc.**

- **The base Quick list is THREE, not the doc's five.** §0.6 and §10 lock *Counter Spell, Annoint, Leyline,
  Armor Piercing, Hand-to-Hand Mastery*. `BASE_OVERRIDES` is baked over `EFFECTS` (the `BASE_OVERRIDES` bake, engine.js) and strips
  `quick` from **Armor Piercing ♣7** and **Hand-to-Hand Mastery ♠3**, leaving **D4, D9, H5**. Deliberate:
  the override blocks say so in comments (*"Armor Piercing loses Quick (moved to Hippolyta)"*), instant speed
  became a **Form reward**, and a `test.js` assertion locks it (`REWORK base: Armor Piercing / Hand-to-Hand / Back Stab lose Quick`) — a verifier reversed it and took the suite to 392/1.
  **The doc's five-card list is stale spec.** Note this narrows the reactive-AP gap: it only bites a player
  holding Hippolyta.
- **STOPPER was deleted, not kept.** §0.5 explicitly recommended keeping the fight-turn commit path; the
  mechanic was removed outright in v1.31.13. §0.5 and the §4 STOPPERs row are stale spec.
- **`st.priority` / `st.lastPassed` were never built, on purpose.** `st.pending` / `st.respondFor` survive as
  **aliases** for "top object" and "who holds priority" — §9's own Phase-1 note gives the reason (zero test
  churn, and the UI + AI read them). A grep for the design's names therefore says nothing about whether the
  design shipped; see CLAUDE.md.
- **The pre-fight window is an extension beyond the doc.** It appears in no section of `STACK-DESIGN`. Aj's
  model explains what it actually is — the priority pass before the shedding play — so it is not a Back Stab
  carve-out, but the *narrowing to lockout Quicks* in both layers is a deliberate gate, not an oversight.
- **§2's priority loop shipped step-for-step**, LIFO resolution and Counter-a-Counter included, and §3's
  **no-overkill / `wasBroken`** rule shipped exactly as written. Recorded here because both were doubted.

**`destroyShield` being `noKick` is CORRECT, and the round trip is worth recording.** The audit classified it
as a deliberate divergence. I overruled it on a misreading of Aj's *"the techniques are shield losses. player
loss is only through kicks. kicks only happen when there are no shields left"* — reading it as *a technique
striking a 0-shield player should kick*. He meant the opposite: techniques cause **shield** losses only, and
**player** loss happens exclusively through the Fighter Kick, which is a FIGHT outcome. *"no shield loss
technique is a kick. none can be turned into kicks... check the wording please."* The wording is
**"Target Rival loses 1 shield."** — nothing more, on both cards.
**The lesson is mine, not the audit's: when a designer's answer would REVERSE a verified finding, re-read the
card before acting on it.** The finding survived adversarial verification and I discarded it on one ambiguous
sentence. What remains is a genuine defect of a different shape — the cast is legal, fully paid for, and does
nothing — and it is filed in the BACKLOG as a refusal, not a kick.

## Initiative catch-up — DECLINED, and it was never Aj's report <a id="initiative-catchup"></a>

**Struck off 2026-09-08.** Aj: *"i never put the initiative catch up on the backlog myself. i don't think
there is a problem with how initiative is gained right now. you can come back to me with more concrete data
if you want. otherwise, strike it off."*

The entry sat under ★ Correctness for two weeks proposing three undesigned rules changes to the core round
loop — rotate the lead, let a bigger shape answer a smaller one at a cost, reframe passing in the UI — on the
strength of one mid-game remark (*"three rounds in a row throwing jab after jab"*) that had been written up
as a structural finding. **The designer did not think the mechanic was broken, and was never asked.**

**The habit this is here to break:** an observation from play is DATA; the diagnosis attached to it is a
CLAIM, and this one was promoted to a starred correctness item without measurement and without the one
person who could say whether it was a problem. A ★ means "someone should do this next" — putting an
undesigned rules change there gives it standing it never earned. **Attribute a backlog entry to whoever
actually asked for it, and when that is nobody, say so in the entry.**

**What would revive it:** concrete data, not a report. [`#strategic-pass`](#strategic-pass) already carries
the harness that prints initiative concentration and the finding that the AI is *not* jab-locked while a
human feels starved — so the question is answerable by measurement, and that measurement is the price of
re-opening it. The rich-get-richer reading of `st.initiative = winner` stays true as a description; what was
never established is that it costs the game anything.

## Historical

*Recently closed (see the changelog): the **deck builder** parts system (v1.27.0/v1.28.0) and its lesson
(v1.28.1) · the **reorderable energy pile** + both pile viewers + Advanced lesson 10 (v1.29.0) · netplay's
**public battle log** (v1.28.2) · and the **entire MP parity audit** — A1/A2/A3 (v1.29.1), B1 (v1.29.2),
C1 (v1.29.3), C2+D1 (v1.29.6). `MP-PARITY-AUDIT.md` is now a record, not a to-do list.*


*Two long design notes were DELETED rather than moved here, because the changelog carries each in full and a
spec for a shipped feature is not reference material: the client rule-suggestion design (shipped v1.31.31, see
that changelog entry) and the end-of-round discard notice (shipped v1.31.69).*

