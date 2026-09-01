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

## Phone layout

*The bug that prompted this analysis MEASURES CLEAN since v1.31.66 — the overlap was caused by the sideways
scroll and went away with it. The corner-overlay arithmetic and the declined proposal are kept because both
would otherwise be re-derived; the unbuilt zone move is tracked in the BACKLOG, where its motivation is now in
doubt.*

- **~~THE PLAY AREA IS CLOBBERED ON A NARROW PHONE~~ MEASURED CLEAN since v1.31.66 — the overlap was caused by the sideways scroll, and went away with it. The zones-into-panels spec below was NOT built; keep it only if a real device still shows the problem.** Original entry: (Aj, 2026-08-29, screenshot at
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
  **DECIDED 2026-08-29 — ZONES MOVE INTO THE PANELS (phone only).** The rival's Forms/Rides and equipment render
  in the rival panel, yours in your hand panel, reusing `.oppPanel .oppZones`; `#table` then holds only the pile,
  its label and the message, so the pile gets the full 257px. The framing that settled it: **the zones are
  per-player state, the table is shared state** — on a phone the info belongs next to the player it describes,
  which is better rather than merely smaller. Prerequisite: the `.fighter` wrap fix above, since the panels grow
  to 2-3 lines. Second piece already exists — `#handMeta` carries an empty `<span class="equip" id="youEquip">`.
  **AJ'S COLLAPSING-HAND PROPOSAL WAS CONSIDERED AND DECLINED** (*"make the hand collapse like the mobile
  keyboard … this will mean that the drag to play functionality will be lost"*). It does not address this cause:
  the collision is horizontal, between edge-pinned overlays and the centred pile, so more vertical space does
  not separate them — it would cost drag-to-play and leave the pile clobbered. Recorded so it is not re-proposed.
  Vertical space IS genuinely tight (see the 340px floor and `landscapetest`), but the hand is the thing a card
  player looks at most, so it is the wrong first lever; the secondary chrome is the cheap one.

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

<a id="ai-strength"></a>
## AI strength

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

## Exported-data facts

- **Old exported logs are v1.0 and merged.** Anything analysed from a multiplayer export before v1.31.5 had
  every opponent collapsed into one bucket and their fight counts stuck at 0. If those files still exist they
  cannot be repaired — the information was never recorded. New exports are `v:'2.0-mp'`; check the field.
- **A duel export still has `rival` = seats[1]** (not merged), so old duel analysis is unaffected.


## Scope decisions

- **Deck editing** — deliberately out (Aj: create + delete only). If it comes back, note a saved deck's
  IDENTITY is its composition key, so "editing" is really delete + re-add, and anything pointing at the old key
  must be migrated.

## Historical

*Recently closed (see the changelog): the **deck builder** parts system (v1.27.0/v1.28.0) and its lesson
(v1.28.1) · the **reorderable energy pile** + both pile viewers + Advanced lesson 10 (v1.29.0) · netplay's
**public battle log** (v1.28.2) · and the **entire MP parity audit** — A1/A2/A3 (v1.29.1), B1 (v1.29.2),
C1 (v1.29.3), C2+D1 (v1.29.6). `MP-PARITY-AUDIT.md` is now a record, not a to-do list.*


*Two long design notes were DELETED rather than moved here, because the changelog carries each in full and a
spec for a shipped feature is not reference material: the client rule-suggestion design (shipped v1.31.31, see
that changelog entry) and the end-of-round discard notice (shipped v1.31.69).*

