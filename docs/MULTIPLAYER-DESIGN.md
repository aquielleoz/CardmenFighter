# Cardmen Fighter — Multiplayer & Netplay Design

*Design doc for the two big post-v0.87 updates: (1) N-player multiplayer (3–6, cap 6), and (2) networked
human-vs-human play. Status: **design — not yet implemented.** Decisions by Aj are locked in §1; open questions
with proposed defaults are in §3. Build order: **multiplayer engine first, networking second** (the netcode
should sync the final N-player model, not a temporary 1v1 one).*

---

## 0. Why this order

Multiplayer is a game-logic + rules problem; networking is plumbing. If we net-sync 1v1 first and then rework the
engine to N players, the sync layer (whose turn, who you can target, who won) has to be rebuilt. So: make the
engine + UI + AI truly N-player and ship it as **local hotseat / vs-AI** (zero networking, instant playtest
iteration), nail the 3-way and 6-player rules, then wrap the finished model in host-authoritative netcode.

The engine is already partly ready: `numPlayers` is threaded through, `nextPlayer` cycles, and the **table-gated
transforms already scale with player count** (J unlocks at players×1 shields lost, Q at ×2, K at ×3). The work is
auditing every place that assumes a single opponent.

---

## 1. Locked decisions (Aj)

**Targeting.** Every effect worded "the Rival" (singular) becomes **choose a rival** — the caster picks which
opponent it hits (Telekinesis, Outbalance, Ultima Attack, Critical Hit, Armor Piercing's extra strip, Back Stab,
Spiked Armor/Caltrops' target, etc.). Effects worded plural — "Rivals'", "every player", "all" — still hit
**all** opponents (Cursed Pendant, Poison the Air, Giant Ram's tax, etc.).

**Win condition.** **Last Rider standing** (elimination). The game ends when only one player remains.

**Fighter Kick = a death (knockout).** A Fighter Kick knocks **one** player out of the game. This is separated
from game-end: a kick removes a player; the game ends only when one remains. Kicks are tracked as a **hidden
per-player, per-game stat** (`kicksLanded`) — seeds a future **Assassin** suit/class that grows stronger the
more kicks it has landed.

**Turn order & seating.** Rolled by dice at the start; players are sorted into that order. In a human's view,
opponents are laid out so the player who takes their turn **immediately after you is leftmost** and the one who
takes their turn **immediately before you is rightmost** — i.e. play reads left→right across the opponents and
loops back to you (bottom). After round 1, **initiative passes to whoever won the previous round.**

**Loser mill (catch-up).** **Everyone who did not win the round mills** (tops cards into Energy to match the
winner's bank) — not just players who passed without getting to play. (Scope is a testable toggle — see below.)

**Round-resolution toggles (for playtesting — both collapse to current behavior at 2 players).**
Two independent tunables, so we can mix and measure at 3–6 players:
- **`SPECIAL_LOSS_MODE`** — on a Special win: `all` = every non-winner loses a shield (bloodbath, fast); `chosen`
  = the winner picks one rival to lose a shield (targeted, political).
> **2026-08-24:** the "healthy economy" reading of `universal` was RE-MEASURED and holds up better than the
> live `targeted` setting at 3p and 6p (tighter spread, and a 2-point run-to-run range against targeted's
> 10-11). See PATCHNOTES principle 0d before acting on it — 3 runs per arm is the minimum and 4p overlapped.

- **`MILL_SCOPE`** — who catch-up mills each round: `universal` = all non-winners mill (healthy economy);
  `targeted` = only the struck rival(s) mill (cutthroat; untargeted losers tread water).
- *Property:* at `numPlayers === 2` both toggles are no-ops — the single loser loses a shield and mills either
  way — so the shipped 1v1 game is unaffected no matter the setting.

**AI targeting (which rival a "choose a rival" effect hits) — tiered by difficulty.** Starting tier for the
build is **Fighter**.
- **Minion:** 80% random · 20% grudge (hit whoever last hurt me).
- **Fighter (default):** mostly **leader-focus** (attack whoever's closest to winning); **secures kills** when a
  rival is ≤ 1 shield (take the kick); plus **one grudge play per game** as a personality tell.
- **Demon Lord:** priority cascade **finisher > grudge > random** (secure the weakest/killable first, else
  avenge, else random).

---

## 2. Networking direction

**Host-authoritative.** Because `engine.js` is pure deterministic logic with a thin UI, one player's machine runs
the engine as the source of truth; other clients send **inputs** (play / activate / respond / target choices) and
receive **broadcast state**. No prediction/rollback netcode needed — the host decides, everyone renders.

- **LAN (same network):** $0. Host runs a small WebSocket server; others join by IP or a discovered room.
- **Internet:** no paid game server ever. Use **WebRTC peer-to-peer** with a tiny **signaling** handshake (fits
  free tiers; public STUN servers exist). A **TURN relay** is only a fallback for strict-NAT peers (a bit of
  plumbing/bandwidth, largely avoidable). Matchmaking/lobby, if any, is minimal and free-tier-able.
- **Caveat:** the cost is engineering (P2P through home routers), not hosting dollars.

Build LAN first (simplest, proves the sync model), internet P2P second.

### 2a. Concrete netcode architecture (decided during the Phase-4 build)

**Transport validated.** `BroadcastChannel` carries messages between two tabs on **both `http://` and `file://`
origins** (verified headlessly, `nettest.js`) — so the local two-client rehearsal *and* same-machine two-player
need **no server at all**, straight from the downloaded file. It only fails across fully separate browser profiles
(a Playwright-context artifact, not real tabs). Cross-*machine* play is Phase 5 (LAN WebSocket / WebRTC); the same
message schema rides whatever transport is underneath.

**Curated redacted snapshots, not raw state (`netview.js`, tested — 24 cases).** The host owns the engine and
never ships raw `state` (that would leak every hand). `NetView.snapshotFor(state, seat)` builds a per-seat,
JSON-serializable view: that seat sees its **own full hand**; every other player is reduced to public info +
hidden-zone **counts**. It also computes the one `prompt` (turn / discard / preFight / respond / shieldGuard) that
seat owes. This is the hidden-info security boundary and it's pure logic, so it's unit-tested without a browser.

**Client = snapshot consumer + intent sender (this removes the scary refactor).** Originally we feared having to
generalize the whole `YOU === 0` renderer so a human could sit in any seat. Not needed: the **client is a new view
fed by `snapshotFor` data**, and the host applies the client's inputs by calling the *existing* engine ops
(`play/activate/pass/respond/…`) with that seat's index — the engine already acts as any player. So the host's own
UI (seat 0) stays byte-identical, and the client is additive. Flow per remote move:
`client renders snapshot → sends high-level intent → host applies via engine op for that seat → host re-broadcasts
a fresh snapshot to every seat.` The turn driver's `awaitHumanSeat(p)` hook (already in place) is where the host
parks until a remote seat's intent arrives.

---

## 3. Resolved (all §2/§3 questions now answered)

1. **Shield loss on a Special** — a toggle (`SPECIAL_LOSS_MODE`: `all` | `chosen`). See §1.
2. **Fight/trick model with 3+ players** — keep the engine's shared pile: lead, others beat-or-pass in turn
   order, **last to play the pile wins the trick.** True Chikicha; no new combat model. **Confirmed.**
3. **Eliminated player's stuff** — hand, equipment (its effects end), forms, and shields all leave play; turn
   order closes up around the empty seat; any of their effects on the stack fizzle. **Confirmed.**
4. **AI targeting** — tiered by difficulty (Minion / Fighter / Demon), Fighter is the build's starting tier. See §1.
5. **Jabs vs Specials** — Jabs bank energy only (already implemented); only Specials strip a shield. Milling per
   `MILL_SCOPE`. **Confirmed.**

Design is **locked** — ready to start the engine audit (Phase 1 below).

---

## 4. Rough implementation phases (multiplayer engine first)

1. **Engine core — ✅ DONE (Phase 1).** `newGame({numPlayers:2–6})`; `nextPlayer` skips eliminated;
   `effectTarget(opts.target)` routes singular "the Rival" effects (auto at 2p); `SPECIAL_LOSS_MODE` +
   `MILL_SCOPE` toggles + `setShieldTargetChooser` (chosen-mode target hook); Fighter Kick → elimination +
   `kicksLanded` + last-Rider-standing; deckout → elimination in N-player; round-end counts living players.
   **Duel is byte-identical (all toggles no-op at 2p).** Verified: 639 tests (10 new MP), and 30×3p + 20×6p full
   AI games run crash-free with correct end states (kicks = eliminations-to-winner). *No UI/AI-targeting yet.*
2. **AI targeting + response — ✅ DONE (Phase 2).** Tiered `AI.chooseTarget(st,p,diff)`: Minion 80% random /
   20% grudge; Fighter kill-secure (rival ≤1) > one grudge/game > leader-focus; Demon finisher > grudge > random.
   Wired into every hostile cast (`opts.target`) and into the round-win `chosen`-mode strip (via
   `setShieldTargetChooser`, reading each seat's tier from `st._diff`). Cast-gates now consider *any* opponent.
   Engine grudge signal: `player.lastAttacker` set on hostile hits + shield loss. **N-player response priority:**
   `openResponseWindow` now offers every living opponent priority in seat order (per-object `passed` set; a new
   Quick resets priority) — a non-adjacent seat can Counter. `opponentCanRespond` checks all opponents.
   **Duel unchanged** (all no-ops at 2p). Verified: 647 tests (8 new); 25× each tier at 3p + 15× 6p + mixed-tier
   tables run crash-free (kicks = eliminations-to-winner).
3. **UI — ✅ DONE (Phase 3, v1).** Setup picks **2–6 players** (`#setPlayers`); 3–6 shows a compact **opponent
   strip** (`#opponents` / `renderOpponents`) in seat order (next-after-you leftmost), each panel with
   shields/energy/hand/deck/shuffle/equipment/forms/Super + turn glow + OUT overlay. `render()` branches: duel
   path untouched, MP hides the single `#rival` panel. Turn driver `runOpponents()` plays every AI seat (reusing
   the round ceremony, shield-guard modal, response/pre-fight prompts via `resumeRival`→MP branch). Human
   **target picker**: singular hostile casts prompt "tap a rival" (opponent panels become clickable →
   `opts.target`); the round-win chosen strip uses the AI chooser. MP-aware labels (pile owner, matchup, win
   overlay, round announce). **Duel byte-identical** (647 tests + duel smoke pass); 3–6p games verified in-browser
   (rendering + 150-turn error-free play incl. target-picks / responses / discards / ceremonies).
   *v1 scope: opponents use a compact strip (not the ornate on-table zones); per-opponent shield-shatter FX and
   richer per-seat turn beats are deferred polish. Human seat is always seat 0.*
4. **Controller abstraction + local two-client test (Phase 4).** Per-seat **controller** (`ai` / `local-human` /
   `remote`), defaulting every opponent seat to `ai` so vs-AI multiplayer stays byte-identical (turn driver
   `runOpponents` runs unchanged unless a seat is explicitly set to human). Generalize the UI's `=== YOU` (seat-0)
   input assumptions — target picker, response prompts, discard prompts — to "whichever seat's controller is a
   local human." Validate with **two local browser contexts**, each rendering only its own seat's private view
   over an in-page channel — a networking-free dress rehearsal for netplay that already solves hidden hands. Plus
   deeper 3-way/6-player playtest + tune §1 toggles.
   **Decision (Aj): NO shared-screen hotseat.** A single shared screen can't hide hands, and Chikicha's interrupt
   windows (Quick/Counter, pre-fight, shield-guard) would force a pass-the-device curtain on nearly every beat.
   Human-vs-human is therefore **one player per device only**; hotseat is dropped as a shipped mode (its only real
   value was as a no-netcode scaffold, which the two-local-client private-view rig covers instead).
5. **Netplay (Phase 5).**
   - **v1 — ✅ DONE (same-machine, 2-player).** Host-authoritative over `BroadcastChannel`, gated behind
     `?net=host&room=CODE` / `?net=join&room=CODE`. The host owns the engine and applies every seat's intents;
     both ends render a dedicated netplay board from `NetView.snapshotFor` (own hand only, opponents = counts) and
     submit high-level intents (`play/pass/activate/respond/decline/discard/guard/guardPass`). Live rules
     (rework + chosen/targeted). Verified: two-tab Playwright harness (`nettest2.js`) — connect, sync, Specials
     over the wire, interrupts routed to the right seat, shield loss, knockout, win — 7/7 checks, stable over
     repeated runs, zero JS errors. Shipped single-page game byte-identical when `?net=` is absent (647 tests +
     duel smoke green). *v1 limitations: 2 players only; pre-fight Quick timing deferred (Quicks still work as
     responses to activated effects); round ceremony is a status line, not the ornate animation; no deck picker
     (host = full deck).*
   - **v2 — ✅ DONE (cross-machine, internet P2P, no server).** Transport is now **pluggable** (`{send, setOnMessage,
     close}`): BroadcastChannel for same-machine (`?net=host/join`), **WebRTC DataChannel for the internet**
     (`?net=rtchost` / `?net=rtcjoin`). Signaling is **manual copy-paste** — host generates an invite code (base64
     offer+ICE, non-trickle), friend pastes it and returns a reply code, host pastes that → connected peer-to-peer.
     **No game server, no accounts, $0** — the code travels over any chat the players already use; Google public
     STUN handles NAT (`&stun=0` disables it for LAN/loopback). Symmetric host-authoritative model unchanged; only
     the transport swaps. Reliability fix: the joiner re-announces `join` until its first snapshot lands (WebRTC
     drops messages that arrive before the channel opens, so a one-shot join could be lost). Verified: `rtctest.js`
     drives the full copy-paste handshake between two headless peers and plays a complete game over the DataChannel
     — 9/9 checks, **6/6 consecutive runs** after the fix, zero JS errors. Shipped game still byte-identical
     (647 + duel smoke); BroadcastChannel netplay still 7/7.
     *v2 limits / next: still 2 players (WebRTC star topology for N-player later); TURN relay not configured (a
     minority of strict-symmetric-NAT pairs may fail on STUN alone — free public TURN / a tiny relay is the
     fallback); codes ~860 chars (could deflate); deck picker + pre-fight timing + ornate ceremony still open.*

**Known Phase-1 follow-ups (deferred):** response-window priority currently offers a Technique response only to
the *next* living seat, not all opponents (fine for headless; fix in Phase 2). The chosen-mode shield target uses
the default leader-heuristic until the AI tiers (Phase 2) / human picker (Phase 3) set `shieldTargetChooser`.

Balance note: the current 1v1 tuning (v0.87) will need re-checking at 3–6 players — targeting, elimination, and
"everyone mills" change the math a lot. Expect a fresh balance pass after the local milestone.
