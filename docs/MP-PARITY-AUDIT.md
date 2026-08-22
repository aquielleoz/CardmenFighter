# Cardmen Fighter — duel vs free-for-all parity audit

*What a 2-player duel gives you that a 3–6 player free-for-all silently does not. Written after two
playtest reports in a row turned out to share this root shape. Findings are code-read and spot-verified;
**nothing here is fixed yet.***

> Scope note: "local MP" means a free-for-all against AI seats. "netplay MP" means an online free-for-all
> with a host. **They are different code paths and they have different gaps** — netplay N-player is in
> better shape than local N-player, which is the opposite of what you'd guess.

---

## A. Gameplay — AI seats 2+ are second-class in a LOCAL free-for-all

These are not cosmetic. Cards simply do not function.

### A1. Pre-fight Back Stab never fires for P3+ · **local MP** · `template ~3184`

```js
function rivalPreFightThen(g, proceed){
  var pf=E.openPreFight(state);
  if(!pf.preFightPending || pf.q!==RIVAL){ return proceed(); }     // ← seat 2+ silently skipped
  var mv=AI.preFightMove(state, RIVAL, YOU, difficulty);           // ← hardcoded seat + difficulty
```

The pre-fight window is offered to whichever seat `openPreFight` names, but this gate only acts when that
seat is **RIVAL (1)**. In a free-for-all where the window belongs to seat 2, it returns `proceed()` and the
window is dropped. So **Back Stab — and any Form-granted pre-fight Quick — is dead for P3 and beyond.**

Netplay is fine here: `NET.hostPreFight` handles any seat, host or remote (`doFight`/`doPass` route to it
when `hostLive() && MP()`). The gap is only the local AI path.

> **CORRECTION to this entry's original scope.** It first claimed Back Stab was "dead for P3+" generally.
> Two things narrowed it, both found while implementing:
> - **`ai.js` already handled pre-fight seat-generically** for its own turns (`takeTurn` → `openPreFight` →
>   `aiPreFightLock(st, qq, …)`), and correctly suspends when the holder is a human. So AI-vs-AI was fine.
> - The broken path is **only the UI's `rivalPreFightThen`, i.e. when YOU fight.** The holder is
>   `nextPlayer(st.turn)`, so from your turn it is seat 1 unless seat 1 is skipped — most obviously **when P2
>   has been eliminated**, which is exactly the board in the report (P2 showed `OUT`).
>
> **But the real reason nobody noticed is worse — see A3.**

**Verified, not just code-read** — `openPreFight` on a 3-player board, by starter seat:

```
starter 0 → q=1     (works: q===RIVAL)
starter 1 → q=2     ← DROPPED by the gate
starter 2 → q=0     (works: routed to the human prompt)
```

### A2. Response / counter windows never resolve for P3+ · **local MP** · `template ~3080`

```js
while(state.pending && state.respondFor===RIVAL && guard++<64){    // ← seat 1 only
  var resp=AI.respondDecision(state, RIVAL);
```

`settleWindows` drains response windows for seat 1 only. Later it handles `respondFor===YOU`. **Nothing
handles `respondFor` being 2+**, so an AI seat past the first never answers at instant speed — no Counter
Spell, no instant-speed Quick — and the un-drained window is a stall risk rather than just a missed play.

Netplay again has the N-player equivalent (`NET.hostSettleN`). Local does not.

**Verified, not just code-read** — on a 3-player board, seat 0 activating `6♦` Back to the Books leaves:

```
opponentCanRespond(g, 0) → true
respondFor               → 2      ← handled by NEITHER branch
```

So the window genuinely opens for seat 2 and genuinely goes undrained.

**Worth a test either way:** a local 3-player game where seat 2 holds Counter Spell, asserting it actually
counters. Neither A1 nor A2 has any coverage today, which is why they went unnoticed.

### A3. The AI could never use ANY Form-granted Quick · **all modes** · `ai.js ~463, ~402, ~414`

```js
// lockoutQuick, bestQuick (inside respondDecision), and the immunity filter all did:
var e = E.effectOf(c);            // ← BASE effect
```

`effectOf` is the card's **base** effect. A card's `quick` flag can be **granted by a Form** — Back Stab is a
Quick *only* under Hermes Super, Sanctuary under Hector, Armor Piercing under Hippolyta — and that lives in
`effectFor(st, q, c)`. Reading the base meant the AI's Quick searches could never see any of them.

Verified:

```
E.effectOf(10♠).quick        → false     ← what the AI read
E.effectFor(st, 2, 10♠).quick → true     ← the truth, with J+Q+K in the zone
```

**So the AI has never sprung Back Stab, in any mode, 2-player included** — which is why A1 sat unnoticed: the
seat gate only mattered for a play the AI was never going to make. Fixed by reading `effectFor` at all three
sites.

**Balance:** this genuinely strengthens the AI, so it was measured (`analysis.js 40 on x knight`, before/after):

| | before | after |
| --- | --- | --- |
| Back Stab win rate | 36.3% | **39.9%** |
| Quick responses across all games | 1216 | 1211 |

Back Stab gains ~3.6 points and is still **below 50%**, so it goes from unusable to merely weak — no new
problem. Response volume is flat, as expected: Form-granted *response* Quicks are much rarer than the lockout
case. Other cards drifted 1-3 points in both directions, which is noise at 40 games per matchup. Caveat worth
stating: `analysis.js` is **AI-vs-AI and symmetric**, so a buff to both sides largely cancels — it cannot
measure the thing a human will actually feel, which is Knight/Demon now locking *you* out of a lead.

---

## B. Reachability — opponents' zones are described, not shown

### B1. The rival equip/forms zones are hidden outright · `template ~1912`

```js
if(MP()){
  $('rival').style.display='none'; $('rivalEquipZone').style.display='none'; $('rivalFormZone').style.display='none';
  renderOpponents();
```

In a duel the opponent's equipment and Forms & Rides render as real zones via `renderEquipZone` /
`renderFormsZone`, built from `buildEqBox` and the form minis — which is what carries `.targetable` and the
`doRemove(...)` handlers. In a free-for-all both zones are `display:none` and replaced by plain `<span>`
labels inside `.oppGear`. Consequences:

- **You cannot target an opponent's Equipment** (Aj's report: Forceful Strip said *"Tap an Equipment"*, P3's
  Caltrops was unclickable). The engine was ready the whole time — verified `E.removeTargets(st,0,eff)` in a
  3-player game returns every seat's equipment.
- **You also cannot target an opponent's Ride or Form** — same cause, and *broader than the original report*.
  Sabotage and boosted Forceful Strip can hit zone cards (`removeTargets` adds them when `eff.ride`/`eff.form`),
  and in a free-for-all there is nothing to tap.
- **No equipment counter/decay feedback** for opponents: the `equipFx` counter-change and spent flashes only
  exist inside `buildEqBox`.

Aj's proposed fix: **clicking a player's box expands it** so the gear inside becomes clickable. Reuse
`buildEqBox` rather than writing a second renderer, so targeting cannot drift again. Note equipment targets
are keyed by the equipment entry's own **`e.id`** (*not* `e.card.id`); zone targets use `f.card.id`. An
expanded panel must `stopPropagation()` on inner clicks or a gear tap doubles as a seat pick — `oppNrgBtn`
(v1.29.0) is the working precedent.

---

## C. Presentation — the readability work never crossed over

### C1. Opponents' turns have no beats · `template ~3236` (`runOpponents`)

`runOpponents` does `AI.takeTurn` → `logOppPlays` → `render()` → `setTimeout(step, 460)`. It logs and
renders, and nothing else. The duel path (`resumeRival`, `~3020`) builds paced **beats** with
`revealDwell(card)` / `dwell:1500`, `flashArt` / `revealEffect`, `quickFlash`, `bumpEffect` **and
`setMessage`**. Every bit of the v1.25.0/v1.26.0 readability pass — longer rival dwells, the ⏩ QUICK cue,
the two-phase art flash — landed on the 2-player path only. Reported symptoms:

- your play does not "breathe" before the AI answers (no dwell);
- the caption under the centre stage still reads **"You played a Jab."** under an opponent's card, because
  nothing in the MP path calls `setMessage` — the `P3 · JAB` stage header is the pile rendering and is correct,
  so the two disagree;
- **opponents' effects are invisible** — P3's Caltrops resolved (it is in the exported log) but never flashed;
- `bumpEffect` is never called for opponents in MP either, so the effect indicator stays quiet.

**Fix shape:** extract the beat builder out of `resumeRival` and share it, rather than copying it into
`runOpponents` — copying is how this gap opened. Watch `reduceMotion()` and the early-return ceremony
branches. Aj: *"it's fast so good for testing"* — keep the quick pacing available rather than slowing
everything uniformly.

### C2. The shield flourish calls every opponent "Rival" · `template ~1316`

```js
var who=player===YOU?'You':'Rival';     // centerShieldFX
```

In a free-for-all a broken P3 shield is announced as "Rival · shield down". Should use `logName(player)`,
which already exists and knows about duels vs seats.

---

## Deliberate, not gaps

- **Basics mode is solo-only** — netplay is always the Full game (`hostStartRealN` comments say so).
- **Tutorials are 2-player** — `startLesson` pins `mpCount=2` on purpose; lessons rig a duel.
- **`awaitHumanSeat` is unreachable locally** — a human never occupies an opponent seat outside netplay.

## Suggested order

1. ~~**A1 + A2**~~ — ✅ **DONE in v1.29.1**, along with **A3**, which was found while doing them and mattered
   more than either. New `code/mptest.js` (13 assertions) covers all three.
2. **B1** — unlocks two whole removal effects in free-for-all, and Aj has already specified the UX.
3. **C1** — the biggest visible improvement, and the extraction protects against re-drift.
4. **C2** — one line.
