# Cardmen Fighter — Full-Stack / Priority Rework — DESIGN DOC (review before coding)

Status: **decisions locked (§0) — ready to implement on "go".** No engine code changed yet. Written at v0.53.

## 0. Locked decisions (Aj, this session)
1. **Fights stay immediate** — a fight play never goes on the stack; only the *shield loss* it
   causes does. ✔
2. **Value-altering effects are NEVER quicks — technique speed only.** Two shapes: *pre-buff your
   planned play* (Infuse `D5`+4, Imbue `H1`+2, Divine Tactics `H6`+5, and now Brilliant Tactic
   `C3`+2) and *decrease an existing play* (a debuff on the current pile — **no card uses this
   yet**, reserved). There are **no value-altering quicks**. ✔
3. **Brilliant Tactic is un-quicked** → becomes a regular technique-speed pre-fight `valueBoost`
   (+2), same family as Infuse/Imbue/Divine Tactics. It loses the "attach at fight time, only
   spent if the play beats" behavior and the AI's reactive overtake use (`quickBoostPlay`). ✔
4. **Proactive casting is fully free** — cast a quick with no legal target; it fizzles on
   resolution, never illegal. ✔
5. **STOPPER is a Technique, played on your turn — never a quick, no last-second window.**
   Committing STOPPERs *is activating the technique's effect*. **MULTISTOPPER:** activating one
   STOPPER lets you activate the effects of other STOPPER cards in hand equal to the number of
   cards in the current fight play (1 vs a single, 2 vs a pair, 3 vs a trio; can't cancel 5-card
   combos). This is exactly today's `stopper()` / multi-commit behavior — **no mechanic change**,
   just documented correctly. Keep the current fight-turn commit path. ✔
6. **Two more cards become Quick** (draw / shield-loss+1 are fine as quicks — not combo-value
   altering, which is the §0.2 rule):
   - **Armor Piercing `C7`** (renamed from *Finishing Blow* — it pierces, it doesn't finish) →
     quick, castable **pre-emptively like any quick** *and* reactively. Effect: **+1 to a
     shield-loss you cause** — it bumps that one shield-loss event from `n` to `n+1`; it does
     **not** create a second, separate hit (matches the current wording, "the Rival loses 1
     additional shield"). Pre-emptive cast (before your win is secured) is a confident bet; it
     charges your next shield-loss this round. It **never overkills**: at 1 rival shield the loss
     is capped at 1 (→0) and the extra does nothing — no kill (§3 no-overkill rule).
   - **Hand-to-Hand Mastery `S3`** → quick. Instant-speed Draw 2; castable proactively or in any
     response window; fizzles only if deck+shuffle are empty.

After this, the **quicks are: Counter Spell (`D4`), Annoint (`H5`), Leyline (`D9`), Armor
Piercing (`C7`), Hand-to-Hand Mastery (`S3`)** — five total. Combo-value-altering cards are never
among them (a shield-loss +1 is not a combo-value change).


Author intent (Aj): quicks are cast at instant speed — playable **proactively** on your own
turn (fizzle if there's no legal target, but never *illegal*) **and** in **response** to things,
including any effect that would cost you a shield (Fighter's **Ultima Attack**, Rogue's
**Critical Hit**, and fight-win strips). Leyline Ascension is a quick. "I was promised full-stack
operation" — so the target is a real priority/response stack, not another one-off window.

---

## 1. Where the code is today (the gap)

There is **no stack.** There are two separate, ad-hoc response mechanisms plus a hard block:

1. **`pending` / `respondFor` — a single, one-level response window** (`engine.js` ~442–491).
   When you `activate()` a non-quick Technique and the opponent *holds a relevant quick*
   (`opponentCanRespond`: Counter Spell vs any Technique; Annoint vs a removal), the effect is
   parked in `st.pending`, the opponent gets `respond()` / `declineResponse()`, then
   `resolvePending()` runs it. You **cannot respond to the response** — it's one level deep.

2. **`shieldResponse` — a bespoke shield window** (`engine.js` ~827–887). Only opens on a
   **fight-win** shield loss (`resolveRoundWin`→ opens window → `doStrips`→ `finishRoundWin`).
   Lets the defender spring Leyline (an `immune` card). **Does not fire** on `destroyShield`
   techniques — Ultima Attack / Critical Hit strip immediately (`resolveEffect` `case
   'destroyShield'`, ~575) with no window.

3. **Proactive quicks are hard-blocked** (`engine.js:416`): `if (eff.quick) return {ok:false,
   reason:'Quicks can only be played in response to a Technique.'}` — and a test asserts it
   (`test.js:598`). This directly contradicts the "quicks are proactively playable, they just
   fizzle" rule.

**Quicks in the set today:** Counter Spell (`D4`, `counter`), Annoint (`H5`, `protect`),
Brilliant Tactic (`C3`, `valueBoost` quick — *attached at fight time via `play(...,{boost})`,
not activated*), and Leyline (`D9`, `reclaim`+`immune` — currently **not** `quick:true`; sprung
via the bespoke shield window).

**Shield-loss sources that should be respondable:** fight-win strip (+Finishing Blow's extra),
`destroyShield` techniques (Ultima Attack `C10`, Critical Hit `S9`), and the Fighter Kick
(strip-to-zero) as a consequence of the above.

---

## 2. Target model — a priority stack

A single LIFO stack + a priority loop replaces both windows and unblocks proactive quicks.

**Stack object**
```
{ id, kind:'effect'|'shieldloss', controller, card?, eff?, opts?, targets?, source?, n? }
```

**Priority loop (1v1 — the only mode that matters here; N-player noted in §8):**
1. Something is **put on the stack** (a played Technique/Quick, or a pending shield-loss).
2. The player who did *not* just add gets **priority**: respond with an eligible quick
   (→ push a new object, priority passes back) or **pass**.
3. When **both players pass in succession**, the **top** object **resolves**.
4. On resolution, re-check the object's target/legality → if invalid, **fizzle** (spent, no
   effect). Otherwise run its body (today's `resolveEffect`).
5. Repeat from step 2 until the stack is empty, then return control to the turn player.

**Key properties this gives us for free:**
- **Proactive quicks:** playing a quick on your own turn just puts it on the stack; if its
  target is absent it fizzles on resolution instead of being rejected. (Delete the `:416` block
  + flip the `test.js:598` assertion.)
- **Respond-to-response:** Counter Spell can counter a quick that was itself a response, etc.
- **Reactive shield defense from any source:** a shield loss is a stack object; the defender
  gets priority and may respond with Leyline (immune). One code path covers fights **and**
  destroyShield techniques.

---

## 3. Shield loss as a stack event (the unify)

Replace `st.shieldResponse` **and** the direct strip in `destroyShield` with a single helper
that *pushes a shield-loss object* and lets the priority loop handle it:

```
queueShieldLoss(st, targetIdx, n, sourceLabel)   // instead of opp.shields -= 1 directly
```
- On resolution of a `shieldloss` object: for each of `n`, run today's save chain
  (`shieldSaved` → Sphere/Holy Shroud/`preventShield`/`protect:'special'`), else `shields -= 1`.
- **Kick / no-overkill rule (§0.6, fixes Finishing Blow):** capture `wasBroken = target.shields
  <= 0` **at the start** of the event. The Fighter Kick (`st.finished`) fires **only if
  `wasBroken`** — i.e. you struck someone already at 0. A single event strips at most the shields
  present and can take a player *to* 0 without killing; the overflow strip just fizzles. Today's
  `doStrips` instead re-checks `shields<=0` mid-loop, so Finishing Blow (2 strips) kills at 1
  shield — that's the bug this rule removes.
- Because Leyline sets `shieldImmune` **when it resolves** (it's higher on the stack, resolves
  first), the shield-loss object below it then sees immunity and fizzles. No special-casing.

**Call sites to convert:**
- `resolveRoundWin`/`doStrips` → push shield-loss object(s) for each loser (fold in
  Finishing Blow's `strips=2`). Delete `resolveRoundWin`↔`doStrips`↔`shieldResponse` split;
  the priority loop subsumes it.
- `resolveEffect case 'destroyShield'` (Ultima Attack / Critical Hit) → `queueShieldLoss`.
- Edge case to fix while here: today `destroyShield` never checks strip-to-zero → **a
  technique that empties your shields may not end the game** (only fight strips call the Kick at
  `:855`). The unified resolver fixes this.

---

## 4. Per-card port table

| Card | id | today | in the stack model |
|---|---|---|---|
| Counter Spell | D4 | `pending` window, `respond` sets `countered` | quick on stack; on resolve, removes its **target stack object** (→ that object's card to owner's Shuffle Pile). Can target any effect/quick. |
| Annoint | H5 | `protect` in `respond` vs a removal | quick on stack targeting an equipment; on resolve sets `protectedRound`. Now also castable proactively (pre-protect your own gear) → fizzles only if no equipment exists. |
| Brilliant Tactic | C3 | `quick:true` `valueBoost`, attached at fight time (`play opts.boost`), spent only if the play beats | **UN-QUICK (§0.3):** drop `quick:true`; becomes a regular technique-speed pre-fight buff via `nextPlayBoost` (+2), identical family to Infuse/Imbue/Divine Tactics. Remove the `play opts.boost` attach path + the AI's `quickBoostPlay` reactive overtake; AI plays it proactively to charge a planned play. Retire the "⚡+2 Boost" fight-time button; it's now activated in the play phase like the other buffs. |
| Leyline Ascension | D9 | `immune` sprung via `shieldResponse` (not `quick:true`) | becomes `quick:true`; respondable to any `shieldloss`; still proactively playable (ramp + immunity) because proactive quicks are now legal. |
| Ultima Attack | C10 | `destroyShield` strips immediately | `queueShieldLoss(target,1)` → defender may respond with Leyline. |
| Critical Hit | S9 | `destroyShield` strips immediately | same as Ultima Attack. |
| Armor Piercing (was Finishing Blow) | C7 | `onWin`: proactively flags `finishingBlow`; next combo win strips +1 (currently can overkill→Kick) | **rename + `quick:true` (proactive & reactive).** On resolve, sets a "**+1 to your next shield-loss this round**" flag (reuse/rename `finishingBlow`). Reactive: cast onto your own queued fight-win `shieldloss` — Armor Piercing sits above it on the stack, resolves first, sets the flag, then the `shieldloss` resolves at `n+1`. Pre-emptive: flag waits for your next shield-loss. The resolver adds the flag's +1 to `n`, caps at available shields, never Kicks from overflow (§3). Retire the `resolveRoundWin :834` `strips=2` special-case (now folded into the flag). |
| Hand-to-Hand Mastery | S3 | `draw:2` Technique | **becomes `quick:true`**: instant-speed Draw 2, proactive or any response window; fizzles if deck+shuffle empty. |
| STOPPERs | x2 | committed during a fight (`stopper()`) | **STOPPER is a Technique (§0.5)** — stop treating it as a separate special case. Mechanics unchanged (multi-commit vs a matched pair/trio → cancel the play + seize initiative; can't cancel 5-card combos). It lives in the unified "responding to a fight play" framework alongside Leyline. **Phase-1 call:** keep it as today's fight-turn commit choice (works, low risk) vs. surface it in the same response window as Leyline. Recommend: keep the commit path, just document it as a Technique-speed reactive play — no alien carve-out. |

---

## 5. Engine API changes

**Add**
- `pushStack(st, obj)` / `topStack(st)` / `resolveTop(st)` — stack primitives.
- `hasPriority(st)` / `passPriority(st)` — priority bookkeeping (`st.stack`, `st.priority`,
  `st.lastPassed`).
- `eligibleResponses(st, q)` — quicks `q` can legally add right now (affordable, target exists
  *or* fizzle-allowed). Generalizes `opponentCanRespond` + `eligibleQuicks`.
- `playQuick(st, q, cardId, opts)` — push a quick (proactive or response). Replaces the special
  `respond()`.
- `queueShieldLoss(st, target, n, source)` — §3.
- `resolveStack(st)` — drive resolution when both pass (returns a step result the UI animates).

**Refactor**
- `activate()` — drop the `:416` quick block; route *all* plays (quick or not) through
  `pushStack`; open priority instead of the bespoke `pending`.
- `resolveEffect()` — unchanged bodies, but `destroyShield` calls `queueShieldLoss`; called by
  `resolveTop` on non-fizzled objects.
- `resolveRoundWin`/`doStrips`/`finishRoundWin` — collapse into: resolve fight → `queueShieldLoss`
  per loser → run priority/stack → `finishRoundWin` when the stack empties.

**Remove / retire**
- `st.pending`, `st.respondFor`, `respond`, `declineResponse`, `resolvePending`,
  `opponentCanRespond`, `st.shieldResponse`, `shieldGuard`, `shieldGuardPass` — all subsumed.
  (Keep thin shims during phase 1 if it lowers test churn.)

**State shape**
```
st.stack = []          // LIFO array of stack objects
st.priority = idx|null // who currently holds priority (null = no open window)
st.lastPassed = idx|null
// delete st.pending, st.respondFor, st.shieldResponse
```

---

## 6. UI changes (`CardmenFighter.template.html`)

- **One priority prompt** replaces `promptHumanResponse` (`respQuick`) **and**
  `openShieldGuardModal` (`sgYes`/`sgNo`). It renders: the current stack (top = resolves next),
  the incoming object's card text, your eligible responses as buttons, and a **Pass** button.
  It can re-open repeatedly as priority bounces — the current code assumes a single window.
- **Stack view:** small vertical list above the pile showing pending objects (who controls each,
  card, "resolves next" marker). Reuses `flashArt`/`cardEl`.
- **Proactive quick** from hand: the Activate button becomes legal for quicks (today
  `activatableCard()` returns false for `eff.quick`, template ~855). On tap it pushes to the
  stack and opens *your opponent's* priority (AI responds or passes), then resolves.
- Resolution beats: extend the existing `beats`/`dwell` animation queue to walk stack
  resolutions (log "X resolves", fizzle → "Y fizzled — no target").

---

## 7. AI changes (`ai.js`)

- Replace `shieldGuardAI` (top-of-`takeTurn` shield check) + the `respond` heuristics with a
  single `takePriority(st, p)`: given an open priority window, decide **respond-with-quick vs
  pass**. Reuse today's rules — Counter the high-value Techniques; Leyline-guard when a
  `shieldloss` targets it and it's at ≤2 shields (or the loss would be lethal); otherwise pass.
- Proactive quick use by AI: mostly **pass** (hold quicks for response) — keep it simple in v1;
  it already values holding quicks (`ai.js:133`).
- The `AI.takeTurn` loop must **yield at each open priority window** so the human (or the other
  AI) can act — same suspend pattern as today's `[YOU]` hand-off.

---

## 8. Risks / open questions

1. ~~Fight plays on the stack?~~ **Resolved (§0.1): fights immediate; only shield loss is queued.**
2. **N-player priority** (3–4 players): the loop needs a full go-around of passes, not just the
   one opponent. 1v1 is the shipped mode; I'll write the loop N-safe but only test 1v1.
3. ~~Brilliant Tactic attach-at-fight?~~ **Resolved (§0.3): un-quicked to a pre-fight buff.**
4. ~~Proactive fizzle semantics?~~ **Resolved (§0.4): fully free, fizzle allowed.**
5. ~~STOPPER commit timing?~~ **Resolved (§0.5): STOPPER is a turn technique; keep the current
   fight-turn commit. MULTISTOPPER documented.**
6. **Test churn**: the interrupt tests (`test.js` ~594–759), the shield-guard tests (~442–466 +
   the v0.51 batch), and the Brilliant-Tactic/boost tests (v0.31 batch) get rewritten. Expect
   the 516 count to move. The `test.js:598` "quick can't be activated proactively" assertion
   flips to "a proactively-cast quick with no target fizzles."
7. **Un-quicking Brilliant Tactic is a balance nudge** — it loses the reactive overtake. It was
   already found ~neutral (NEXT-SESSION v0.31 note), so low concern, but re-run `analysis.js`
   after Phase 2.

---

## 9. Phased rollout (task checklist)

**Phase 1 — stack engine at behavior-parity (no new capabilities, tests green)**
- [x] **DONE (v0.54-wip):** Add stack primitives — `st.stack`, `newOid`, `resolveShieldLossObj`,
      `driveShieldStack`. `st.stack`/`st.roundWinResult` init in `newGame`, cleared in
      `finishRoundWin`.
- [x] **DONE:** Convert fight-win shield loss to a stack of `shieldloss` objects + the guard
      window (`driveShieldStack`); `shieldGuard`/`shieldGuardPass` operate on the stack; Leyline
      still guards. **516 unit + 12-game smoke green; API/fields unchanged (`shieldResponse.q`,
      `.guardId` preserved), zero test churn.** This is the driver the Phase-2 shield features
      (destroyShield, Armor Piercing) plug into.
- [x] **DONE (v0.54):** routed `activate()` Techniques through the stack — `pushEffect` /
      `openEffectWindow` / `resolveEffectStack`; `respond` / `declineResponse` operate on the
      top-of-stack effect object; `resolvePending` retired. `st.pending` / `st.respondFor` kept as
      the open-window aliases the UI + AI read (`pending.card`, `pending.eff`), so **zero test
      churn**. Counter Spell / Annoint unchanged in behavior. **516 unit + 12-game smoke green.**
      Phase-1 is 1-level (no respond-to-response yet — that's Phase 2's proactive/stack work).

**Phase 1 EXIT GATE MET:** both the technique response window and the fight-win shield loss now
run on the single `st.stack`; API/fields/behavior identical to v0.53; 516 tests + smoke green; no
`__kmTest` leak. The backbone is in.

**Phase 2 — the new capabilities — DONE (v0.55–0.56)**
- [x] **v0.55 — renames:** Finishing Blow → **Armor Piercing** (`C7`), Taijutsu Mastery →
      **Hand-to-Hand Mastery** (`S3`).
- [x] **v0.55 — un-quick Brilliant Tactic** (§0.3): now a technique-speed `nextPlayBoost` +2;
      removed `play opts.boost`, AI `quickBoostPlay`, the fight-time Boost button went dormant
      (keys off `ef.quick`); the AI uses it via `pickValueBoost`. v0.31 tests rewritten.
- [x] **v0.55 — destroyShield → shield-loss stack + no-overkill:** Ultima Attack / Critical Hit
      push a `shieldloss` object; Leyline can be sprung in RESPONSE (mid-turn window wired both
      directions — human casts → AI guards inline via `rivalMayGuard`; AI casts → human gets a
      resumable guard modal). `resolveShieldLossObj` never overkills — a single event takes a
      player *to* 0 but only Kicks if they were already broken (`noKick` for destroyShield).
- [x] **v0.56 — proactive quicks + fizzle:** removed the `:416` block; quicks are castable on your
      turn and **fizzle** if there's no target (Counter/Annoint `resolveEffect` fizzle cases);
      `activatableCard` shows Activate for quicks; AI `pick()` no longer excludes quicks (uses
      Leyline/Armor Piercing/Hand-to-Hand via existing reclaim/onWin/draw picks; still holds
      Counter/Annoint for responses). `test.js` proactive-quick assertion flipped.
- [x] **v0.56 — `quick:true`** on Leyline (`D9`), Armor Piercing (`C7`), Hand-to-Hand Mastery (`S3`).
      **521 unit + 12-game smoke green; Playwright-verified:** proactive Leyline ramp+immunity via
      the UI, Counter fizzle, and AI-Critical-Hit → human guard modal → shield held.

**Phase 3 — DONE (v0.57–0.58) — polish + the true recursive stack**
- [x] **v0.57 polish:** fizzle guardrails (Counter/Annoint grey out proactively with a reason);
      Armor Piercing "armed" status tag; Leyline art flashes when sprung (both windows).
- [x] **v0.58 — recursive priority stack:** every activated Technique/Quick is a stack object;
      priority passes active-first, auto-passing anyone with no eligible Quick; the non-controller
      answers with a Quick (which itself goes on the stack) until it resolves. **Counter-a-Counter**
      falls out naturally (`resolveTopEffect` — a Counter counters the effect beneath it).
      **General reactive casting:** the response prompt offers ALL eligible quicks (Leyline,
      Hand-to-Hand, Armor Piercing, Counter, Annoint), so you can answer at instant speed.
      destroyShield techniques are answered via this window (spring Leyline as a response) — their
      shield-loss is `noGuard` so there's no double-prompt; fight-win losses keep the shield-guard
      window. AI drains its own windows recursively (`resolveAIWindows`); the human's turn settles
      via `settleWindows` (handles you-cast → AI-counters → you-counter-back). **Visible stack
      view** (`#stackView`) shows the pending objects, top = resolves next.
- **527 unit + 12-game smoke green; Playwright-verified:** Counter-a-Counter through the UI with
  the stack view showing both objects, then the original Technique resolving.

**Everything in this doc is now implemented.** Remaining is playtest + balance on real hardware.

---

## 10. Confirmations — ALL RESOLVED ✔ (ready to build on "go")
- fights immediate ✔ · proactive fully-free fizzle ✔ · Brilliant Tactic un-quicked ✔ ·
  STOPPER is a turn Technique + MULTISTOPPER ✔ · combo-value-altering never a quick ✔ ·
  Armor Piercing (renamed) & Hand-to-Hand Mastery become quicks ✔ · Armor Piercing = +1 to a
  shield-loss (proactive or reactive), never overkills ✔.
- Quicks after rework: **Counter Spell, Annoint, Leyline, Armor Piercing, Hand-to-Hand Mastery.**
- Priority note: a fight-win `shieldloss` opens the priority loop to **both** players — the
  winner may add Armor Piercing (+1), the loser may add Leyline (immune); LIFO resolution means a
  sprung Leyline lands first and fizzles the whole loss. Falls out of the generic loop (§2), no
  special-casing.
