# Cardmen Fighter — backlog & handoff

Build: `node build.js` (run from `code/`) inlines engine.js + ai.js + art.js + **netview.js** → **code/CardmenFighter.html** (self-contained). `faces.js` is NOT inlined (layouts retired in v0.95 — build.js stubs `window.CardFace = {}`). The repo-root `CardmenFighter.html` is a manual copy of the built file — `cp code/CardmenFighter.html ./CardmenFighter.html` after a build so the two stay identical.
Test: `node test.js` (PASS / 0 FAIL, currently **131**) · `node netview.test.js` (**28**, snapshot redaction) · `node browsertest.js` (headless duel smoke) · the `nettest_*.js` Playwright suite (full-UI netplay — `nettest_full`/`_counter`/`_activate`/`_discard`/`_guard`/`_ceremony`/`_deckpick` 2p, `_3p`/`_rtc`/`_rtc3`/`_react3`/`_target3`/`_losspick3`/`_losspick_remote3`/`_concede3`/`_prefight` N-player) · `node analysis.js 130 on` (balance round-robin — args `N catchup recycle difficulty`; the old `rework` flag was removed in v1.23.0) · `node mpsim.js` (3/4/6p free-for-all balance — args `games difficulty`).
Player style: **PLAYER-PROFILE.md** — a living read on how Aj actually plays (control/value grinder, Wizard/Cleric, counter-heavy, boost-a-pair kill). Append new exported games to its ingestion log; use it for AI-tuning / balance / a future "play like me" opponent.
<<<<<<< HEAD
Current version: **v1.28.2**. The 2-apex + Forms **rework is simply the game** — the `REWORK` flag and the classic pre-rework rules were deleted in v1.23.0 (no `setRework`, no `E.isRework()`). Live MP rules: `chosen`/`targeted` toggles, set in the template.
||||||| parent of 280b11e (v1.29.0 — Advanced lesson 10 "Energy Order" + docs)
Current version: **v1.28.1**. The 2-apex + Forms **rework is simply the game** — the `REWORK` flag and the classic pre-rework rules were deleted in v1.23.0 (no `setRework`, no `E.isRework()`). Live MP rules: `chosen`/`targeted` toggles, set in the template.
=======
Current version: **v1.29.0**. The 2-apex + Forms **rework is simply the game** — the `REWORK` flag and the classic pre-rework rules were deleted in v1.23.0 (no `setRework`, no `E.isRework()`). Live MP rules: `chosen`/`targeted` toggles, set in the template.
>>>>>>> 280b11e (v1.29.0 — Advanced lesson 10 "Energy Order" + docs)

## BACKLOG (proposed, not built)
- **Mobile layout — landscape follow-up** (optional): the v1.20.0 pass covered portrait phones. Landscape phones are *wide* (>720px) but *short*, so the `max-width:720px` mobile rules don't apply — they fall into the 3-column desktop layout with a cramped height. If landscape matters, add a short-viewport branch (e.g. `@media (max-height:520px)`) that collapses to a single scroll column + the 🔍 View reader regardless of width. Not blocking; portrait is the common case.
- **Suit ≠ class — future direction** (Aj, design intent, not yet built): the current 1:1 map (♦ Wizard, ♥ Cleric, ♣ Fighter, ♠ Rogue) is temporary. There will stay **only 4 suits**, but eventually **more than one class per suit**, and **hybrid classes** — e.g. an **assassin** that is *both* Fighter and Rogue, with **its own card set** (it does NOT reuse the pure Fighter or pure Rogue cards). Implication for copy & code: **don't tie a card's effect to its suit** ("each card carries its own effect," not "its suit's effect" — already scrubbed from the Energy lesson). When the deck-builder/parts work lands, revisit whether "parts" are keyed by *class* rather than *suit*, since a suit may host several classes. Keep archetype (`ef.archetype`) as the class identity, distinct from `suit`.
- **Reorderable energy pile** (Aj) — 📋 **DESIGNED, not built**: full design in [`ENERGY-REORDER-DESIGN.md`](ENERGY-REORDER-DESIGN.md), open for review. Summary: spending is **already order-driven** (`payEnergy` takes the first card of a required suit, then `shift()`s the front), and the netplay mirror **already** ships a seat its own ordered energy — so reordering the pile *is* the whole feature. The cost is that **no energy-pile viewer exists** (the ⚡ readout is per-suit counts, the shuffle pile a bare `♻ N`), so that surface has to be built first. Five decisions await Aj's call in the doc — chiefly click-to-promote vs drag, and whether colored pips should honour the player's order (a balance change) or just be labelled.
  - Your-turn-only, to keep netplay sequencing simple. The shuffle→deck reshuffle stays random.
  - **Measured payoff is thin** (`node recyclesim.js`): only **39%** of games ever reshuffle and the median first reshuffle is **round 12**, past the median 11-round game. Reclaim effects (`8♣`, `9♦` under Athena, `4♠`) are the second, player-chosen trigger that makes ordering matter sooner. Aj's "micromanager's nightmare" read is data-supported — the doc lays out build-as-is / pair-with-a-draw-engine / ship-viewers-only.
  - Follow-up once built: add an **Advanced tutorial lesson** teaching energy sorting (peek → set recycle order).
- **Deck builder — "parts" system** — ✅ **BUILT** in v1.27.0 (solo/local) + v1.28.0 (netplay). See those changelog entries. Follow-up still open:
  - ~~Advanced tutorial lesson on custom decks~~ — ✅ **BUILT** in v1.28.1 (Advanced lesson 9).
  - **Deck editing** was deliberately left out (Aj: create + delete only). If it ever comes back, note that a saved deck's IDENTITY is its composition key, so "editing" is really delete + re-add and anything pointing at the old key must be migrated.

<<<<<<< HEAD
### v1.28.2 — netplay's battle log was EMPTY for every client (public narration)
A standalone netplay bug, found while designing the energy-reorder feature but fixed on its own: netplay had **no host→client log channel at all**. Every message type was state (`mirror`/`setup`) or control (`join`/`welcome`/`err`/`peer`/`ceremony`), so the host narrated the whole game to *itself* and **every other player sat in front of a blank battle log for the entire match — including their own moves.** Verified before touching anything: the host log had 4 lines ending in `Rival played a Jab - 6♣`; the client's had **zero**.
- **Why it was never a simple broadcast:** narration is **reader-relative**. The same event is "You played" to the actor and "Rival played" to everyone else, and the host's strings are baked in its own frame — forwarding them verbatim would tell a client *"You played"* about the host's card. That is presumably why nobody just piped the log across.
- **The fix is a template channel.** New top-level **`say(actor, tpl, cls)`**: the template carries a `{who}` placeholder instead of a name; it renders locally through **`logName`** (yourself → "You", a duel opponent → **"Rival"** rather than the raw `P2` that `seatName` gives, otherwise `P<n>`), and as host it broadcasts `{t:'log', actor, tpl, cls}`. Each client resolves `{who}` in **its own rotated frame**. One message, no per-recipient string building.
- **Migrated 24 narration sites** across all three paths — the shared local path (your plays, techniques, shield strikes, counters, phantasms, equipment counters, letting a Quick resolve), the 2-player netplay handler, and the N-player handler (plays, passes, techniques, guards, discards, pre-fight passes, lockouts, concedes).
- **Two frame-specific lines handled separately** rather than forced into a template: a client now writes its **own** opening line when it learns the decks (the host's *"you play X vs Rival Y"* is unshareable), and the round line broadcasts a **neutral** `Round N begins.` because per-seat draw counts differ by reader.
- **NEW `code/nettest_log.js`** (13 assertions): the host's play reads "You played" on the host and **"Rival played" on the client, describing the same card**; the client's own play reads "You played" for it and "Rival played" for the host; the client's log is genuinely populated; no unresolved `{who}` ever leaks; and the client opens with its own duel line, never the host-framed one.
- Two test traps worth recording, since both look exactly like product bugs: a client's mirror is **seat-rotated** so its own turn is `turn===0`, not its absolute seat; and round 1 is jabs-only *and must beat the pile*, so a test has to pick a **legal** card rather than the first in hand.

||||||| parent of 280b11e (v1.29.0 — Advanced lesson 10 "Energy Order" + docs)
=======
### v1.29.0 — reorderable energy pile: two pile viewers, ⤒ Promote to top, public log, Advanced lesson 10
The backlog's energy-reorder item, built to [`ENERGY-REORDER-DESIGN.md`](ENERGY-REORDER-DESIGN.md) with all six of Aj's decisions. **Read the design doc's measured-payoff section first**: only **39%** of games ever reshuffle (`node recyclesim.js`), so this is a long-game / reclaim-deck lever, deliberately shipped because it carries **zero balance risk** — Decision 3 kept `payEnergy` untouched.
- **engine**: `reorderEnergy(st, p, ids)` (ids must be a true permutation — a bad order is an attempt to conjure or delete energy) and `promoteEnergy(st, p, cardId)`. `payEnergy` was already order-driven, so **no cost logic changed at all**. Guards: your turn, and **not** while `pending`/`respondFor` is set. **+18 assertions (172 → 190)**, including the two that matter — a generic cost spends off the front in your order, and a coloured pip takes the earliest card *of that suit*, skipping a promotion.
- **NEW: two pile viewers.** ⚡ and ♻ in your meta row are now buttons opening one modal with two views and **← / →** between them. Energy is ordered and orderable; **shuffle is read-only** and says outright that its reshuffle is random. Nothing in the game could show you a pile before this.
- **The caveat is labelled, not buried**: position 1 is tagged **spent next**, and the first card of each suit is tagged **first ♥ / first ♦** — because a coloured cost reaches past a promotion. Without the tag that reads as the game ignoring you.
- **Tap a card → 🔍 View + ⤒ Promote to top.** View reuses `cardTextHTML`, so boosted Form/Super lines come along and there is no second card renderer. Repeated promotes are a **stack push** — last promoted is spent first.
- **Netplay**: new `{op:'reorderEnergy'}` intent in both host paths, host **re-validates** the permutation (the deck-string lesson from v1.28.0). Four rogue payloads leave the pile byte-identical.
- **Decision 6 needed a channel that did not exist.** Netplay's message types were all state or control, so *a client had never seen the host's log lines for anything*. Added a narrow **`t:'log'` broadcast** so a reorder is genuinely public on every board. First use; other narration could migrate onto it later. Lines are built from rank/suit only, never client text.
- **NEW Advanced lesson 10, "Energy Order"** — the second screen-subject lesson, with its own rig seeding a readable pile. Covers the three things a player can get wrong: the coloured-cost caveat, that the shuffle pile is random and unorderable, and that the log is public.
- **New suites**: `piletest.js` (21), `nettest_energy.js` (10), `lessontest_energy.js` (14).
>>>>>>> 280b11e (v1.29.0 — Advanced lesson 10 "Energy Order" + docs)

### v1.28.1 — Advanced lesson 9: Custom Decks (+ build.js now refuses to ship a syntax error)
The follow-up the deck-builder backlog asked for. Aj, on review: *"we should add the related tutorial."*
- **NEW lesson — Advanced #9, "Custom Decks"** (6 steps). It is the **only lesson whose subject is a screen rather than a play**, and it turned out the existing machinery already supports that: `#tutPanel` is `z-index:80` against the overlay's `30`, and `.tut-spot` is `82`, so the coach panel stays readable **on top of** the builder modal and can spotlight controls **inside** it. The rigged duel behind is just scenery.
- Flow: parts explained against your own deck pile → the presets re-read as part-mixes (Pure = 4 of one, Sage = 2+2, Full Set = 1 of each) → the builder opens → **gated**: give Cleric 2 parts (one is not enough; the gate holds) → **gated**: spend the last two, 4/4 or no save → **gated**: name it and save → closing step on where it now appears, including that only the *mix* travels online so an opponent's host builds it correctly without knowing the name.
- **The deck the player builds is real** and stays in their store — the lesson's artifact is a deck they own. Naming copy leans into Aj's framing: the deck sits under **Your class** beside the Wizard and the Rogue, so name it like **a class of your own** ("Twin Cleric", "Battle Priest"). That also settles the earlier open question — the "Your class" label **stays**.
- Two hooks were needed: `TUT.note('deckparts', …)` on a stepper change and `TUT.note('decksaved', …)` on save. The **duplicate refusal also notes** `{duplicate:true}`, so a player who happens to already own that exact mix still advances rather than stalling on an error they cannot clear.
- Saving does not hide the modal (`openDeckBuilder`'s `finish()` only hands the key back), so the lesson **re-opens the builder with a `force` flag** after a save — otherwise the closing step pointed at a "Your saved decks" list still showing the pre-save state.
- **NEW `code/lessontest.js`** (19 assertions): the hub row, the builder opening over the duel, the coach's stacking, spotlighting a control inside the modal, both stepper gates *including that one Cleric part is not enough*, the save gate, the refreshed saved list, completion, the lesson-done flag, and that the built deck is really persisted.

**`build.js` now parses every inlined `<script>` before writing** — and this is why. Adding the lesson to the `LESSONS` array put a new entry after the last element, which had **no trailing comma**; the whole 334KB script then failed to parse and the page came up dead. `build.js` only ever checked that placeholders were replaced, so it shipped that happily, and the UI test reported a scatter of unrelated failures (plus one assertion that *passed* on a broken page, because `document.body.textContent` includes the text of inline `<script>` elements — beware that in tests). The gate refuses to write and names the offending line; verified by re-introducing the exact bug.

### v1.28.0 — custom decks online (the netplay half)
The deck builder now works over the wire, and the design choice from v1.27.0 paid off: because a deck's value everywhere is already its self-describing composition key, the lobby needed **no new message and no protocol change** — the existing `{t:'join', deck:'…'}` string carries the composition, and the host builds from it.
- **Un-gated the lobby pickers.** Both netplay lobbies (BroadcastChannel and WebRTC) now render the full deck list, so saved decks and **"✏️ Custom deck…"** are available online. Building one from the lobby re-renders it via `renderNet()` with the new deck selected. `deckOptionsHTML` lost its `{custom:false}` escape hatch — nothing gates it any more, so the parameter went too rather than rotting.
- **The name is genuinely cosmetic, as designed.** A client picking its saved "Aj Special" gets the deck labelled by that name on its own board; the host — which has never heard of it — shows **"Custom · 1♦ 2♥ 1♣"**, describing what it was handed. Neither side ever shows the player a raw `custom:…` key.
- **Hardened the host's intake (a real pre-existing hole).** The join handler did `seatDeckMap[jseat]=m.deck||'full'` — the client's string went in **unvalidated**, and an unknown key fell through `buildDeck()`'s `|| makeDeck()` to a silent Full Set. It now runs `validDeck()` at intake, so a garbage or hostile value is rejected where it arrives instead of quietly becoming a different deck several layers down. This mattered before custom decks too; compositions just made it worth fixing.
- **NEW `?dbg=1` hook `__cmf.comp(seat)`** — a seat's per-suit tally across every zone (deck/hand/energy/shuffle/shieldPile/forms/equipment/removed). The host's `state` *is* `hostState`, so this makes a seat's real composition assertable from the host, which is the only way to prove the host honoured the wire value rather than its own guess.
- **NEW `code/nettest_customdeck.js`** (14 assertions, 22 netplay suites now). Phase 1: a client picks a composition the host lacks → the host's authoritative state holds **13♦ / 26♥ / 13♣** for that seat, the host keeps its own Pure Wizard, and both labels read sanely. Phase 2: a rogue client appends a bogus `custom:D9` option and sends it → the host seats a **Full Set (13 of each suit, still exactly 52)** and the bogus key never reaches a label.
- Harness note worth keeping: **both pages in a netplay suite share one browser context** (BroadcastChannel requires it) and therefore one `localStorage`. To give one side a deck the other lacks, load that page first, seed and reload it, clear the store, *then* open the other page — otherwise the "host has never heard of this deck" premise is silently false, which is exactly how the first draft of this test failed.

### v1.27.1 — 🔍 View card is disabled when there's nothing to read
Playtest report (Aj): on a tight screen, tapping **🔍 View card** with no card selected opened the full-screen reader on nothing but its own placeholder — *"Tap a card in your hand first, then tap 🔍 View to read it here."* A button whose only outcome is a note telling you it did nothing.
- `showCard` now drives a **`paintViewCardBtn()`**: the button is `disabled` (40% opacity, default cursor) whenever `cvCard` is null, with its tooltip switching to "Tap a card in your hand first". The click handler also refuses on a null `cvCard`, so the empty reader is unreachable either way. Painted once at startup so it begins disabled.
- **Clear deliberately still leaves it enabled** — Clear deselects for play but keeps the last card described, so the reader has something real to show. That's not a leak, and the test pins it.
- **NEW `code/viewtest.js`** (10 assertions): the button's visibility window, disabled-on-load, that a disabled click cannot open the reader, enable-on-select, that the reader then shows a real card rather than the placeholder, and the post-Clear behaviour. It runs at **390×780** because `#viewCardBtn` only exists inside `@media (max-width:720px) and (max-height:800px)` — at 390×844 it is correctly absent, which is worth knowing before writing a test that expects to find it.

### v1.27.0 — custom deck builder ("parts" system), solo & local
The backlog's deck-builder item, solo/local half. Build a deck by choosing how many **parts** of each class it holds — a part is one complete 13-card suit, and a deck is always **4 parts = 52 cards**. Doubling a class gives you two of each of its cards.
- **Presets were already compositions**, which made this a generalisation rather than a parallel system: `buildDeck` computes `perSuit = 4/bases.length`, so Pure X = 4/0/0/0, each two-base mix = 2/2/0/0, and the Full Set = 1/1/1/1. New `E.presetParts(key)` exposes that, and the builder opens **pre-filled from whatever the picker had selected**.
- **engine.js** — new composition layer: `PARTS_TOTAL`/`PARTS_SUITS`, `partsCount`, `partsValid`, `partsKey`, `parseParts`, `isPartsKey`, `buildFromParts`, `presetParts`. `buildDeck` now also accepts a composition key or a raw parts object, so **`newGame` needed no change at all** — the deal absorbs custom decks through the existing `decks:` option.
- **A deck's value everywhere is its composition key** — `'custom:D1H2C1'`, canonical D-H-C-S order, zeros dropped. Dropdown values, `sel`, seat decks and `newGame` all carry that string, so a deck value is **self-describing**: the name is cosmetic and looked up locally, and the netplay follow-up gets the composition on the wire for free rather than a name the host would have to recognise. Compositions are therefore the identity — saving a duplicate mix is refused, naming the clash.
- **UI:** every deck picker gains a **"✏️ Custom deck…"** entry (a sentinel, intercepted on change) plus a **"Your decks"** optgroup. The builder is four steppers with live per-class card counts, a `4 / 4 parts — 52 cards` readout that only lights up when valid, a name field, and a delete list. **Create + delete only** (Aj's call) — to change a deck, delete and rebuild. Cancel restores the previous pick; deleting a deck in use falls everything back to the Full Set. Persisted in `cmf_decks_v1`.
- **Added an `esc()` HTML-escape helper** — deck names are player-typed and go straight into `<option>` markup. It didn't exist before because nothing user-typed had ever been rendered.
- **Two undefined CSS tokens caught:** the new styles reached for `var(--dim)` and `var(--ink)`, neither of which is declared in `:root` (the file uses `--txt` plus `opacity:.7`). Fixed before shipping — worth knowing that those two names look plausible but are dead.
- **NEW `code/decktest.js`** (35 assertions, Playwright): the builder entry, the stepper bounds, save/cancel, the duplicate guard, persistence across a reload, delete-and-fall-back, the Rival picker, the local free-for-all **seat** pickers, and a real duel dealt from a composition proving 13♦/26♥/13♣ on the board. Plus 41 new engine assertions in `test.js` (131 → **172**), including that every preset builds the same suit spread as its composition.
- **Netplay is deliberately untouched:** the lobby's pickers pass `deckOptionsHTML({custom:false})`, so custom decks don't appear online until the wire format is verified. The lobby already sends the deck as a bare string and the host builds from it, so this may work as-is — but that gets a test before it gets shipped.

### v1.26.4 — docs/CARD-LIST.md was stale; gen-cardlist.js now writes where the docs point
Caught during a post-push health check. `gen-cardlist.js` opens with "so it can never drift" — and it had drifted.
- **Cause:** it wrote `CARD-LIST.md` to the **CWD**, so running it from `code/` (as every doc instructs) dropped the generated file beside the sources and left the published `docs/CARD-LIST.md` untouched. Nobody noticed because the stray `code/CARD-LIST.md` was never committed.
- **The drift:** Critical Hit (♠9) still read "Target Rival loses 1 shield" — missing the **v1.22.1 Broadway pitch cost**. That is the *third* thing that same balance change quietly broke (it also rotted `nettest_target3`, fixed in v1.26.2). Regenerated; that one line is the only difference, so nothing else had drifted.
- **Fixed properly:** the generator now writes to `path.join(__dirname,'..','docs','CARD-LIST.md')` — an absolute path, so it lands in `docs/` no matter where it is run from, and re-running it is idempotent. CLAUDE.md notes to re-run it after any card name/cost/text change and never to hand-edit the list.

### Health check at v1.26.4 — everything green
`node build.js` reproduces the committed HTML byte-for-byte (2,839,555 bytes) and both copies are identical · `test.js` **131/0** · `netview.test.js` **28/0** · `browsertest.js` PASS (12 duels, deepest round 22, no runtime errors) · full netplay sweep **21/21** · `docs/CARD-LIST.md` matches `engine.js` · version strings agree across README / NEXT-SESSION / CLAUDE.md · working tree clean.
Two notes for the next session: `browsertest.js` reporting "you: 0 | rival: 12" is **normal** — that harness drives the human seat with a dumb script (first legal card, else pass, never activates an effect), so it is a crash smoke test, not a balance signal. And **run the Playwright suites one at a time** — each starts its own server and drives 2-3 real pages, so they are genuinely load-sensitive (`nettest_rtc` fails at `maxRound=0` under contention, 11/0 alone). CORRECTION to an earlier note: `nettest_full`'s >180s timeout in this health check was first blamed on the browser smoke test running alongside it; the actual cause was three stray `while pgrep …; do :; done` wait loops of mine spinning at ~1% CPU each for up to 45 minutes. `pgrep -f runnet.py` matches the waiting shell's OWN command line, so the loop can never exit. **Never busy-wait on `pgrep` for a pattern that appears in the waiting command itself** — the harness re-invokes on completion anyway, so just poll the output file instead.

### v1.26.3 — nettest_prefight solved: Super Mode needs a RIDE (all 21 netplay suites green)
The long-standing `nettest_prefight` failure (6/7, blamed on the sandbox for ages) was **a stale test, not a product bug** — confirmed by driving three real browser tabs by hand.
- **Root cause:** the test's `HERMES` constant was `[Q♠, K♠]`, but `hasSuper` (engine.js ~190, variant B) requires **any J + any Q + any K — the Ride is mandatory**. With no J the player was never in Super, so `effectFor` never made Back Stab (10♠) a Quick, so `openPreFight` had nothing to offer and the pre-fight modal never opened. Every downstream assertion fell over from that one missing card. Adding the Ride to `HERMES`: **13/0**.
- **Manually verified end-to-end first** (3 tabs, host + 2 clients, `?net=…&dbg=1` on a local server), which is what settled test-vs-product: staged with Q+K only → `hasSuper:false`, no modal, exactly the CI symptom. Re-staged with J+Q+K → the modal opened instantly ("Rival is about to fight — Spring a Quick to lock their turn?", offering Back Stab · 10♠), springing it logged "P2 sprang Back Stab!" on the host, then "You are locked out (Back Stab) — turn skipped", the host's turn was skipped and its card returned to hand. The whole mechanic is sound.
- **Fixed the wording that caused this.** `test.js` asserted *"any Q + any K lights up Super Mode"* — misleading, since its own setup activates a Ride (11D) first. Three assertion messages and two comments now say **J + Q + K** and note the Ride is required. Message-only; 131 still pass. This is exactly the sentence a future test author would copy, and did.
- **Full serial sweep: 21/21 green.** `nettest` (isolation probe, expected ✗ line) · 3p 7 · activate 6 · ceremony 9 · concede3 8 · counter 8 · deckout3 8 · deckpick 8 · discard 7 · discon3 22 · elim3 15 · full 5 · guard 8 · losspick3 7 · losspick_remote3 6 · **prefight 13** · react3 7 · rtc 11 · rtc3 10 · rtc_discon 5 · target3 6 — all FAIL: 0.
- Takeaway now in CLAUDE.md: **when a netplay suite fails, ask first whether the product moved and the test didn't** — that was the answer all three times (discard/v1.24.0, target3/v1.22.1, prefight/the Ride rule), and each failure was silent, with no JS error and a board that just quietly did nothing.

### v1.26.2 — the Playwright suites run again (and two had rotted)
`browsertest.js` and all 21 `nettest_*.js` suites hardcoded `executablePath:'/opt/pw-browsers/chromium'` — the browser path from the sandbox they were written in, which exists on no normal machine. They have therefore been **unrunnable, and silently unrun**, for some time. Now installed, portable, and swept: **20 of 21 green**.
- **NEW `code/pwchrome.js`** — one shared launch-options module, resolving `$PW_CHROMIUM` → `/opt/pw-browsers/chromium` if present (the old sandbox still works) → Playwright's own downloaded browser. All 22 launch sites now `chromium.launch(LAUNCH)`; the three WebRTC suites keep their flags via `Object.assign({}, LAUNCH, {args:[...]})`.
- **NEW `code/package.json`** (private, devDependencies: playwright) + lockfile, with `npm run build` / `npm test` / `npm run test:smoke` / `npm run cardlist` scripts. **The game still has zero runtime dependencies** — it never imports any of this; `node_modules/` is gitignored. `npx playwright install chromium` fetches the browser.
- **`browsertest.js` passes:** 12 duels, deepest round 25, 13 interrupt responses, 11 declines, no runtime errors.
- **FIXED `nettest_discard` (was 5/2).** It never adapted to **v1.24.0**'s target-first change: Telekinesis is `discardOpp` → hostile-singular, so the context button now reads "🎯 Choose target" and the old `/Activate/i` guard matched nothing — the cast simply never happened (silently: no JS error, turn unchanged). Widened the guard and added the opponent-panel tap. **7/0.**
- **FIXED `nettest_target3` (was 5/1).** It never adapted to **v1.22.1**'s Broadway pitch cost on Critical Hit (♠9): the caster's staged hand held 9S/7C/8H with no 10/J/Q/K/A, so the activation was blocked and the chosen opponent never lost a shield. Added a 10♥ to pitch (the engine auto-picks the cheapest Broadway). **6/0.**
- **`nettest_prefight` still fails 6/7 — and the old excuse is dead.** Previous notes called it a sandbox/BroadcastChannel artifact; it fails identically on a real Mac with a real Chromium, so it is either a stale test or a genuine netplay regression. Symptom: neither the remote nor the host pre-fight modal (`#overlay.show`) ever appears, so Back Stab never springs, yet the turn-skip assertions pass. The engine is sound in isolation (`effectFor` → Back Stab `quick:true` under Hermes Super). Ruled out: the lead-lock guard (padding both holders' 1-card hands changes nothing). **Open — needs a 2-tab manual check to decide test-vs-product.**
- **Run the suites serially.** Each starts its own HTTP server and drives 2-3 real pages; concurrently `nettest_rtc` fails at `maxRound=0`, alone it passes 11/0. Full sweep: `nettest` (isolation probe, expected ✗ line, exits 0) · 3p 7/0 · activate 6/0 · ceremony 9/0 · concede3 8/0 · counter 8/0 · deckout3 8/0 · deckpick 8/0 · discard 7/0 · discon3 22/0 · elim3 15/0 · full 5/0 · guard 8/0 · losspick3 7/0 · losspick_remote3 6/0 · prefight **6/7 FAIL** · react3 7/0 · rtc 11/0 · rtc3 10/0 · rtc_discon 5/0 · target3 6/0.
- CLAUDE.md gained the Playwright setup, the run-serially rule, the per-suite status, and a warning that these suites rot silently — when one fails, ask first whether the product moved and the test didn't.

### v1.26.1 — doc & comment truth pass + CLAUDE.md (no gameplay change)
Docs and source comments had drifted behind the code; nothing in the engine's behaviour changed (131 + 28 tests unchanged and green before and after).
- **This file's header fixed:** test count 684 → **131**, `Current version: v1.0-rework` → **v1.26.0** (the `REWORK` flag has been gone since v1.23.0), `faces.js` dropped from the build line (retired in v0.95 — `build.js` stubs `window.CardFace = {}`), the stale `rework` arg removed from the `analysis.js` example, and the manual `cp code/CardmenFighter.html ../CardmenFighter.html` step spelled out (build.js writes only `code/`).
- **Changelog order fixed:** the stranded **v1.19.3** entry sat above v1.26.0 at the top of the log; moved back into version order between v1.19.4 and v1.19.2, so the log is strictly newest-first again.
- **README:** Status v1.23.0 → **v1.26.1**, build block corrected (build.js writes one file + the root copy step), `art.js / faces.js` line fixed, "never hand-edit the generated HTML" called out, `PLAYER-PROFILE.md` added to the docs list.
- **engine.js header comment rewritten.** It still described the *pre-rework* game — "40-card deck, values 1-10, no supreme card", `1-2-3-4-5` straights, "has NO card effects yet". Now documents the real ruleset (52 cards, `fightValue` 3..10/J11/Q12/K13/A14/apex-2=15, straight windows lo 3..11, specials-only shield breaks, `activationCost`, the constants) and the retired flag. Also fixed 9 inline comments that still read "= rank when REWORK off" / "40 cards (off) / 52 cards (REWORK)" / "(REWORK):" card labels. Comment-only edits, no logic touched.
- **NEW `CLAUDE.md`** at the repo root — the generated-file rule, the source→file map, the build/test loop with the pass gates, the rules facts an engine change has to respect (fight value vs rank, no flushes, suits don't beat), the ES5-in-an-IIFE style constraint, and the changelog/version convention. Also records that `browsertest.js` + the `nettest_*` suite need Playwright (`/opt/pw-browsers/chromium`), which is **not installed here** — they exit `MODULE_NOT_FOUND`, which is an environment gap rather than a regression.
- **Restored the missing `.gitignore`** (`*.zip`, `node_modules/`, scratch `shot*`, logs, `.DS_Store`). v1.23.0 recorded adding one but the repo had none — presumably lost in the upload-based first commit.

### v1.26.0 — two-phase flash: art+name, then the effect text
`flashArt` now reveals in two beats: **beat 1** the art + value/suit + name (~850ms), then **beat 2** the card's **effect text rises in on top** (over the bottom scrim) and holds, before fading (~2.5s total). Effect cards get both beats; plain cards keep the quick single beat. The pop/fade animation duration is now driven by a `--flashdur` CSS var set by `flashArt` (was a fixed 1.15s that fought the longer reveal and blanked it early — the bug behind the empty mid-flash). `revealDwell` bumped so the Rival's effect beat waits for both phases (2650ms for text cards). Reduced-motion shows both at once. `.afText` fades/expands via a `.showText` class. Verified with a DOM probe (t=300 name only → t=1000 text fading → t=1600 text full → removed ~2500) and a screenshot.

### v1.25.1 — card label on the flashed art
The center-stage art pop (`flashArt`) now labels itself: the card's **value/suit** (red for ♦/♥) + its **name** (e.g. "A♦ Gather Energy") **overlaid on the bottom of the art** over a gradient scrim, so it reads as part of the card instead of floating below it. Restructured into an `.afStage` (art + caption as one popping unit); `.afCap` is absolutely pinned to the bottom with rounded corners; the fallback drawn-card inserts into the stage before the caption. Name comes from `effectOf(card).name` or `E.cardName`.

### v1.25.0 — readable rival plays + a QUICK response cue
Playtester kept missing what the opponent played, and Quick responses (especially the Rival's) were invisible. Slowed the rival's beats for readability and added a center-stage cue for instant-speed answers.
- **Longer rival dwells:** fight-play beat 950→**1500ms** (the one people missed), pass 650→**950**, phantasm 1000→**1300**; effect-art flash 1150→**1350ms**; inter-beat gap 320→**480ms**. Games are a touch slower on the Rival's turn, but its plays register.
- **NEW `quickFlash(who, name, countered)` cue** — a gold **⏩ QUICK!** banner (cyan when it's you) reusing the retired `#stopfx` overlay. Fires whenever either side plays a Quick in response: your Counter/answer (`humanResponds`), the Rival's answer, and the Rival's shield-guard (Leyline) spring.
- **The Rival's Quick now PAUSES.** `settleWindows` used to resolve the AI's response instantly and log-only; it now flashes the cue, shows a message, and dwells ~1400ms (300ms under reduced-motion) before continuing — so a Counter Spell / instant answer is actually visible. Counter-a-counter chains flash the last response. Verified: cue renders both sides, 131 engine + 28 netview tests pass.

### v1.24.0 — target-first for targeting effects (no more wasted energy on a cancel)
Targeting effects used to spend energy the moment you hit **Activate**, then ask for a target — so backing out cost you the energy. Now they're **target-first**: the context button reads **🎯 Choose target**, clicking it enters a target-select step, and `E.activate` (which spends the energy) only fires once you pick a valid target. **Clear cancels with zero energy spent.**
- New `effNeedsTarget(eff)` = removeEquip / counterfeit / `isHostileSingular` (destroyShield, discardOpp, energyDenyOpp, lockout, recycle-opp). `ctxAction` labels those "🎯 Choose target" instead of "⚡ Activate".
- `activate()`: removeEquip no longer auto-fires on a single target (always taps to confirm); hostile-singular now routes through `promptTargetPick` in **all** modes (was MP-with-2+-opponents only), so even a 2-player duel picks the target before spending.
- **Duel rival panel is now a tap-target:** `#rival` gets `.targetable` + a click handler → `chooseTargetSeat(RIVAL)` while `targetPick` is active (MP already used the opponent panels). New `.fighter.targetable` CSS (purple pulse).
- `targetPick` now blocks hand/fight/pass input and dims the hand like `targeting` did; **Clear** cancels it ("Cancelled — no energy spent"). counterfeit already deferred via its modal (Cancel = no spend) — unchanged.
- Verified headlessly: select → button "🎯 Choose target"; enter target mode → energy unchanged + rival targetable; Clear → energy unchanged; tap rival → fires and spends. 131 engine tests + 28 netview pass.

### v1.23.0 — retire the rework flag (dead-legacy cleanup) + git
The `REWORK` engine flag and the entire classic pre-rework game are gone — the 2-apex + Forms rework is now simply *the* game, always on.
- **engine.js**: folded `REWORK_BASE` into `EFFECTS` permanently (renamed `BASE_OVERRIDES`, merged via a load-time loop); baked the rework rules (52-card deck, 3-apex straight windows `loMin/loMax`, `fightValue` ladder, `activationCost`, transforms-are-free-cost, apex-2-has-no-effect) with the legacy branches deleted; `stopperNeed` is now a flat `return 0` (STOPPER retired). Removed `var REWORK`, `setRework`, `isRework` and their exports.
- **template + ai.js**: simplified the 12 `E.isRework()` guards and 2 `setRework()` calls to the always-true path; `rankLabel` → `REWORK_LABEL[r]||r`; gallery ladder fixed to the rework order.
- **tests/harnesses**: deleted the ~560 classic-game tests from `test.js` (STOPPER, old suit map, 1-10 ladder, 40-card deal — all dead code) and kept the rework + MP suites, re-adding a **300-game AI-vs-AI rework termination smoke** so full-game coverage isn't lost. Dropped every `setRework` from `test.js`, `netview.test.js`, `mpsim.js`, `gen-cardlist.js`; removed the `rework` arg from `analysis.js` (AI diff shifts to arg 5). **Engine tests: 131 pass · netview 28 · nettest_counter 8/0.**
- **nettest_prefight** fails deterministically (6/7) in this sandbox — but the underlying mechanic is verified sound in isolation (`effectFor` gives Back Stab `quick:true` under Hermes Super); it's the browser/BroadcastChannel harness, not the engine. Worth a real 2-tab manual check.
- **Added a git repo** (`.gitignore` excludes `*.zip`, `node_modules/`, scratch `shot*.js`). This is the first commit — a post-cleanup baseline.

### v1.22.1 — Critical Hit gets the Broadway pitch (balance)
Critical Hit (♠9, Rogue destroyShield) was the one shield-strip left *untaxed* when the Broadway-pitch cost was added to the Fighter's Ultima Attack (♣10) and Armor Piercing (♣7). Result: it was the strongest of the three (CARD-STATS: 0.29 cast / **51.8% win**), cheaper (9 vs 10) and unconditional. Added `pitchHigh:true` to Critical Hit's REWORK_BASE entry (S9) with the matching "Additional cost: discard a Broadway card (10, J, Q, K, or A)." text, so all three shield-strips now share the tax. Legacy (non-rework) Critical Hit is unchanged. AI already gates any `pitchHigh` destroyShield on holding a spare Broadway (ai.js line 311) — no AI change needed. Tests: +2 (688 total) — Critical Hit succeeds-with-pitch / blocked-without, plus the pitchHigh assertion now covers S9. Verified in the codex (shows the Additional-cost line). Re-run `node analysis.js` to confirm its win% settles toward ~50%.

### v1.22.0 — start jingle, turn chime, visible cost spend
- **NEW SFX cues.** `gameStart` — a short upbeat rising arpeggio (G-C-E-G + a high-C sparkle + low root) plays as the board comes up (fired in `startGame`, right before the first render). `turnStart` — a gentle rising G5→D6 chime with a faint octave shimmer, fired in `render()` whenever control returns to the local human (`state.turn===YOU && prevTurn!==YOU`). `prevTurn` is seeded to the starting seat in `startGame` so the opening turn doesn't chime (the game-start jingle covers it). Both respect the mute toggle.
- **Paying a cost is now visible in DEFAULT mode too.** Previously `energyPulse` only floated a `+N` on a net energy *gain*; spending was silent (the source of Aj's "no dice" — a cost-only activation showed nothing unless detailed mode was on). Default mode now floats a red **`−N`** (`.nrgGain.spent`) when energy net-drops from a paid cost, symmetric with the cyan `+N`. Detailed mode already showed the by-suit cost pips (verified: a real Brilliant Tactic activation floats `−1♣ −1♦ −1♥`).
- Verified headlessly (`?dbgsolo=1`): `gameStart` logged on start, `turnStart` on turn-return, default cost → red `−2`, detailed cost → by-suit pips.

### v1.21.0 — Settings + detailed energy pulses
- **NEW: ⚙️ Settings modal** (header gear). Currently: **Show detailed energy pulses** (persisted `cmf_pulse_detail_v1`, default OFF) and **Sound effects** (mirrors the header 🔊 mute, kept in sync via `paintSfxBtn`). A "🌐 Language options — coming later" placeholder notes future i18n. The sfx button IIFE was refactored to a named `paintSfxBtn()` so Settings and the header toggle stay in sync.
- **Energy pulses now reconstruct the REAL movements** instead of only the net delta. `signalEnergy` → **`energyPulse(el, player, pl)`**, which diffs per-suit energy + per-suit shuffle + deck + hand counts each render to derive: cost spent (`shuffleΔ` by suit), energy gained (`energyΔ + cost` by suit), and deck→energy mill. `prevNrgSuit/prevShufSuit/prevDeckN/prevHandN` track the baselines (reset on new game).
  - **Default mode:** the net `+N` energy float (unchanged) **plus** — new — a red `−N` off the 🂠 deck whenever cards are milled deck→energy from an **effect** (e.g. Pray for Strength), not just the catch-up. Previously only the catch-up mill floated a deck loss.
  - **Detailed mode:** a two-line float over the ⚡ box — spent line (red, by suit, e.g. `−2♥ −1♠`) over gained line (cyan, by suit, e.g. `+2♦ +1♥ +1♣ +1♠`) — plus the `−N` deck. Matches Aj's target (−3 energy distributed / −5 deck / +5 energy distributed for Pray for Strength).
  - **Deck-float guard:** `deckToEnergy = min(deckLoss, gainTot, deckLoss − handGrowth)`, and it's suppressed during the round ceremony (`inCeremony` flag) where the catch-up mill fires its own explicit `−N` — so a normal end-of-round **draw** (deck→hand) is never mistaken for a mill.
  - Verified headlessly via a Pray-for-Strength-style scenario (`?dbgsolo=1` test hook): default → `+2` energy & `−5` deck; detailed → `−2♥ −1♠` / `+1♣ +2♦ +1♥ +1♠` / `−5` deck.
- A guarded `?dbgsolo=1` test hook (`window.__solo`) exposes `st()/render()/setPulse()` for headless layout/pulse verification — inert in normal play (like the existing `?dbg=1` netplay hook).

### v1.20.0 — mobile layout pass
A real device-width pass across common portrait sizes (360×640, 375×667, 360×780, 390×844, 393×852, 412×915, 430×932), verified with headless Chromium screenshots.
- **Message/meta overlap fixed.** `body{overflow:hidden}` + the play-area grid row being `minmax(0,1fr)` let the play area collapse below its content on short screens, so `#message` ("You have the initiative…") spilled down onto the `#handMeta` "You · class · ⚡ · deck" row. Fix: mobile play-area row is now `minmax(min-content,1fr)` (never collapses below its content), and `main` gets `overflow-y:auto` as a safety valve so if a very short viewport still can't fit everything, it scrolls (the description row scrolls off, never the hand/actions) instead of overlapping. Bumped `#table` min-height to 96px and trimmed `#side` height slightly.
- **Clipped collapsed log label fixed.** The rotated vertical "Battle Log" was taller than the short mobile play-area rail, clipping to "…LE LOG". On ≤720px the collapsed label is now just "LOG" (via `font-size:0` + `::before{content:'LOG'}`), so it always fits.
- **Header no longer clips New Duel.** The single-row header pushed New Duel / ? / 🃏 off the right edge on ≤~400px. On ≤480px the header now wraps (`flex-wrap`), the title shrinks and may stack to two lines (CARDMEN / FIGHTER) when crowded, and the wordy "💡 Hints: Off" collapses to a 💡 icon (on/off still reads via the gold highlight).
- **NEW: "🔍 View card" full-screen reader (Aj).** On really tight/short screens (`max-width:720px and max-height:800px`, catching short portraits + landscape-ish) the inline description strip is dropped to reclaim its vertical space, and a **🔍 View card** button appears beside "Specials list". Tapping it makes the whole page the description box — big art + full rules + the Form/Super upgrade ladder — with an ✕ Close (backdrop tap also closes). Roomy phones (≥~844 tall) keep the live inline strip and show no View button, so nothing regresses there. Impl: `cvCard` tracks the shown card in `showCard`; `renderCardFull`/`openCardFull`/`closeCardFull`; `#cardFull` overlay; `showModal` closes it so it can't linger over a modal.

### v1.19.4 — coach parks over the board on activate steps + Tutorials hub polish
Two tutorial changes. (1) On every "read then activate" step (How to Play, Energy & Effects, Rides transform, Form Changes transform) the coach panel now temporarily parks itself centered over the play area (`stage:true` step flag → `#tutPanel.atStage` CSS) so it no longer covers the card description box the player needs to read, and the ⚡ lightning on that box (`#cardActivate`) is spotlighted alongside the glowing card and the Activate button. Manual drag or a new lesson clears `.atStage`. (2) Tutorials hub reorg: the lesson list now scrolls internally (`.lessons` `max-height:46dvh; overflow-y:auto`) so 8 lessons no longer push the footer buttons off-screen; **Zones of Play** moved to **Basics #2** (runs in Basics mode now); Advanced order is **Quicks → Rides → Form Changes** (Quicks first per Aj). Rides blurb → "a persistent companion that helps you out"; Forms renamed **Form Changes**, blurb → "transformations that upgrade your cards' effects." New Basics order: 1 How to Play · 2 Zones of Play · 3 Initiative · 4 Specials · 5 Energy & Effects.

### v1.19.3 — dim the hand during tutorial read steps
On a READ step the board was already locked, but the hand still looked playable, so testers tapped cards instead of pressing "Got it." Now `renderHand` adds `#hand.tutlock` when `TUT.blocking()`, dimming the hand to ~32% (spotlighted `.tut-spot` cards stay bright) and setting `pointer-events:none`, so the read-then-press flow reads clearly. Clears on gated action steps.

### v1.19.2 — Sort label shows current state
The Sort button label now reflects the **current** arrangement, not the next action (Aj found "next" confusing). States: **Unsorted → Singles → Pairs → Straights → Singles…** (clicking cycles the three sorts). Resets to **Unsorted** on game start and whenever a fresh card is drawn (`syncOrder` detects the new card). `sortMode` (int) replaced by `sortState` (string) + `SORT_NEXT`/`SORT_TITLE` maps.

### v1.19.1 — coach-panel drag fix
Dragging the tutorial coach panel stretched it to full screen height: the mobile CSS pins `bottom:14px`, and the drag set an inline `top` while leaving `bottom` set, so the box spanned top→bottom. Fix: on drag start, clear `bottom`/`right` to `auto` (pin by top/left only); on a new lesson (`TUT.start`) reset them so it re-anchors via CSS. Verified: panel height constant (208px) across a drag in portrait.

### v1.19 — playtester batch: onboarding UX, sort cycle, hints, interactive Quicks
Another round of playtester feedback (two testers).
- **"Mill" jargon removed.** All player-facing text (loser-mill log, Initiative/Energy lessons, Rules) now says "move cards from your deck into energy" instead of "mill."
- **Mid-game Help resumes the duel.** Clicking `?` during a live game now shows a clear **"← Back to the duel"** button (was ambiguous "Got it") and never drops to New Duel. `showHelp` computes `inGame` itself.
- **Netplay is backable.** The Play Online modal has a **← Back** (and click-outside) to New Duel; the netplay signaling screen has a persistent **"← Leave online"** button (fixed on `<body>`, survives re-renders) that reloads back to the plain game.
- **Lesson-complete hand-off.** Finishing a lesson now pops a modal with **Next: <lesson> / All tutorials / Keep playing** buttons (was just a message with no button).
- **Sort button cycles modes.** Sort now cycles **Singles → Pairs → Straights** (low→high), re-laying the hand into pair/trio and straight groups; label shows the next mode. `groupKindKF` now recognizes `straight` so a sorted straight group isn't split by `reconcileLayout`.
- **Play Hints layer (default OFF).** New 💡 header toggle (persisted `cmf_hints_v1`). When on, groups you can't play right now **dim**, and a **dashed** multi-card group means "break me — a card inside can beat the pile." Ported/adapted from ChikiChampions; classification via `E.legalFightPlays`. Rules + Specials lesson mention it.
- **Quicks lesson now SHOWS the Counter Spell flow (interactive).** Rewrote it: rigs a Counter Spell (4♦) + affordable energy, and a scripted step (`tutCastRivalTech`) makes the Rival cast a real Technique, opening the **Respond?** window; the step gates on the player actually **countering** it (new `TUT.note('respond')` hook in `humanResponds`; a decline safety re-casts so it can't brick). Verified end-to-end in Chromium.
- **Tutorial clarity adds:** the **tie rule** ("must play strictly higher; equal ties don't win") is now explicit in Lesson 1; a **zones** tour step (hand/deck/energy/shuffle cycle) added to How-to-Play (zones belong in Basics); the **Sort + Hints** tools are taught in the Specials lesson; the cost line already spells suits out.
- Verified: `test.js` **686/0** (Super-needs-Ride guard etc.), `netview.test.js` 28, `nettest_counter` 8/0 (the response path this batch touched). NOTE: `nettest_full` is ~50% flaky in the headless sandbox (client tab intermittently fails to sync over BroadcastChannel — "client acted 0", no JS errors); this predates the batch (was only ever run once per version) — worth a manual netplay sanity check, but not a logic regression.

### v1.18 — Recruit AI tier + Super-Mode bug fix + win/lose stingers
- **New "Recruit" difficulty** between Minion and Fighter (a playtester quit — the Minion→Fighter jump was too steep). Recruit **leads Specials and contests them**, and plays for **survival + ramp/draw/reclaim**, but skips all of Fighter's pressure plays (equip buffs, value-boost overtakes, transforms/zone game, Finishing Blow, Back Stab, hand/energy disruption). Measured (mirror Full-Set duels, 400 games): **Recruit 99.8% vs Minion**, **Recruit 39% vs Fighter** (Minion is 0% vs Fighter) — a real gentle step. Ladder is now **Minion · Recruit · Fighter · Knight · Demon Lord**. `ai.js`: a `basic` flag gates the pressure branches; `chooseMove` lets Recruit contest Specials; excluded from reactive Back Stab. UI wired through `DIFF_NAME`, `resolveDiff`, `validDiff`, the setup dropdown, MP per-seat strengths, and the Rules text.
- **Super Mode bug fixed (Aj caught it): "why are we incarnating without a ride?"** The engine was lighting **Super on just a Q + K** — the design doc (RIDES-AND-FORMS.md §71) requires a **Ride (J) + a Q + a K**. Added the Ride requirement to `hasSuper`, `effectFor` (the boost that supersedes), and `boostInfo` (the ladder's `active` flag): Variant B (live) = any J + any Q + any K; Variant A = one suit with all three. This makes the earlier Rides/Forms tutorial text ("Ride + two Forms → Super") correct. Tests updated (Super setups now include a J) + a new guard: "Q + K without a Ride is NOT Super." `test.js` **686/0**.
- **Win/lose stingers.** Added `win` (rising major fanfare) and `lose` (slow descending dirge) SFX cues, fired as the result modal appears (`endGame`→`showWin`). On a Fighter Kick they sequence naturally after the kick sound.
- Verified in Chromium (Recruit in the dropdown, no page errors), `netview.test.js` 28, `nettest_full` green, CARD-LIST regenerated.

### v1.17 — sound effects, cost line, deck-mill signal, fly-in, Rides/Forms split, deck-out fix
A big playtest batch (Aj playing through the tutorials live).
- **Sound effects (WebAudio synth, no assets).** New `SFX` module: a procedural synth (oscillator voices + filtered-noise bursts) with 11 cues — draw, jab, special, equip, removal, technique, ride, form, shieldBreak, shieldHeal, kick — wired at universal choke points: `flashArt` (every activated effect/transform, both sides → equip/removal/ride/form/technique by `eff.kind`), the render pile-change block (jab vs special), `animateShields` (break/heal, fires under reduced-motion too), `playFinisher` (kick), and `syncOrder` (draw). Header **🔊/🔇 mute toggle** (persisted `cmf_sfx_muted_v1`); audio context unlocks on first pointerdown (autoplay policy). File size unchanged (nothing embedded).
- **Spelled-out Cost line.** The description box now has a dedicated `Cost:` line — e.g. `Cost: 1♦ (1 diamond energy)` / `Cost: 4♠ + 5 any (4 spades + 5 any energy)` — via `spellCost`/`costLineHTML`. Removed the terse cost from the type line.
- **Deck-mill `−N` signal.** When the loser-mill pulls energy off a fighter's deck, a red `−N` now floats off the 🂠 deck (`floatDeckLoss`, fired from `logCatchUp` on `res.milled` — **only** on a mill, never on plays/draws). Tutorials call it out (Initiative + Energy lessons).
- **Effect-draw fly-in.** Cards drawn by effects didn't visibly deal in — the full-screen effect flash (+ a 2nd synchronous render) ate the animation. `syncOrder` now replays the deal-in ~1.2s later (after the flash clears) when a flash is up. (Round draws already sequenced via `enterDelayBase`.)
- **Tutorial spotlight no longer breaks absolute layout.** `.tut-spot` dropped `position:relative` from CSS; `applySpot` now sets it inline only on *statically*-positioned targets (cleared in `clearSpots`). Fixes the **Forms & Rides zone jumping to center** when spotlighted.
- **Rides/Forms lesson split (now 8 lessons).** Aj noted Rides (persistent aura) and Forms (upgrade your cards) are conceptually different, so **Lesson 5 = Rides** (J, persistent) and new **Lesson 6 = Forms** (Q/K, upgrade effects, opens the Queen tier by rigging the table to 4 shields lost); Quicks→7, Zones→8. Same on-table zone.
- **Quicks lesson demos Counter Spell** specifically (`tutPrepQuick` prefers the `Counter Spell` card = 4♦), per request.
- **Deck-out definition corrected** (Aj): decking out is *drawing when both deck **and** shuffle pile are empty* — not "leading with an empty hand." You can end a round with 0 cards in hand. Fixed the Zones lesson + the Rules screen text.
- **Apex 2 taught first** (from v1.16 refinement carried in): Lesson 1 opens on the value ladder; **energy starts at 0** note added to the Energy lesson.
- Verified in Chromium: 8-lesson hub, Rides transform, Forms transform (Queen gate), Quicks→Counter Spell (⏩), cost line, Forms-zone position fix, mute button, zero page errors. `test.js` **685/0**, `netview.test.js` 28, `nettest_full` green.
- **Parked:** the SFX audio itself and the deck-mill `−N` / fly-in couldn't be confirmed via headless automation (activation/mill are hard to script) — logic is in and error-free; confirm by ear/eye in a real playtest. **Next up:** the clickable, reorderable **energy pile** (FIFO default; peek → click cards to set shuffle-in order) — Aj's paper-game sorting rule.

### v1.16 — Advanced lessons 5–7 + apex-first cheat sheet + near-hand Specials button
Finished the Tutorials hub: the three **Advanced** lessons are now live (Full mode), plus two playtest tweaks.
- **Lesson 5 · Rides & Transforms** — Full-mode rig (`tutRigRides`) that pulls a J into hand and **opens the Ride tier by bleeding the table's shields** (rival knocked to 2 → 2p×lvl1 gate satisfied). `tutPrepRide` marks `announcedThresh.ride` so the ROAR banner doesn't fire spuriously. Interactive: transform the J (gated via a new `TUT.note('activate', eff)` added to the transform branch, which used to `return` before the hook). Teaches persistence, one-per-rank, Super Mode. Verified: gate open, transform enters the Forms zone, coach advances.
- **Lesson 6 · Quicks** — guided read-tour; `tutPrepQuick` pulls a ⏩ Quick into hand and spotlights it, explains response-window plays (the game auto-prompts, so no fragile scripted spring).
- **Lesson 7 · Zones of Play** — a 5-step tour spotlighting Hand → Deck → Play area (`#pile`) → Energy → Shuffle, with the cycle explained. `tutRigZones` seeds energy + shuffle so the counts read.
- **`startLesson` now honors per-lesson mode** (`basics:false` → Full game for 5–7; Advanced keep 4 shields). Hub shows all 7 with ✓/start/soon (Advanced now "start").
- **Apex taught first (playtest ask).** Aj noted the **2** was easy to miss. Lesson 1 now opens its teaching with the **value ladder** (3→10→A→**2 apex**) as the *first* concept after welcome, and the **cheat sheet leads with a ranking strip** — 3…10 · A (gold outline) · **2 (solid-gold apex)** — plus "your two strongest cards are the 2 and the A." (dropped the old buried ladder step).
- **Specials reference by the hand (playtest ask).** Added a spelled-out **🃏 Specials list** button in the hand-meta row (right above the hand) opening the cheat sheet — closer than the header icon. Header 🃏 kept for the pre-game screens. Lesson 1's ladder step + wrap step point at it.
- Verified all four new/changed flows in Chromium (Rides transform, Quicks spotlight, Zones tour, apex-first sheet, near-hand button), `test.js` **685/0**, `netview.test.js` 28, `nettest_full` green.

### v1.15 — Tutorials hub + 4 Basics lessons (playtester onboarding rework)
Playtesters unfamiliar with the game needed more scaffolding. Replaced the single guided duel with a **Tutorials landing page** (`openTutorials()`) — a hub grouped **Basics** (1–4, built) and **Advanced** (5–7, shown as "soon"). Reachable from New Duel (🎓 Tutorials button), Help (🎓 Open the Tutorials), and after finishing any lesson. Per-lesson completion is tracked (`cmf_lesson_<id>_v1` → a ✓ on the hub).
- **Lesson engine generalized.** New `LESSONS` registry: each `{id,num,section,title,blurb,ready,shields,rig,steps}`. `startLesson(lsn)` sets `currentLesson` and `startGame` now uses `currentLesson.rig`/`.steps` (falls back to the legacy `tutSteps`). `TUT.finish` marks the lesson done and nudges to the next. `startTutorial()` kept as a thin wrapper → Lesson 1.
- **Lesson 1 · How to Play** — the flagship full walkthrough, enhanced: 2-shield HP, emphasizes **Specials are the only way to break shields**, **jabs are the safe way to bank energy**, and the **shields → Fighter Kick** win arc; points to the Initiative lesson for losing/passing.
- **Lesson 2 · Initiative** — rigged so the **Rival leads** (`tutRigInitiative`: rival holds 6–8, you hold 3–5, `st.turn=1`). Teaches that you can't win every exchange: **pass to bank energy equal to the winning play**. New `TUT.note('pass')` hook in `doPassBody` gates the pass step. Directly answers the "don't fear losing" feedback.
- **Lesson 3 · Specials** — deeper on combos (pair/trio/straight/full house), only-Specials-break-shields, ends by highlighting the cheat-sheet button.
- **Lesson 4 · Energy & Effects** — the bank→spend cycle, jabs as safe banking, activation cost → shuffle pile → deck reshuffle (don't starve).
- **2-shield tutorial HP.** New engine `opts.shields` override (`newGame` deals a `startShields`-sized shieldPile; `st.startShields` recorded). Tutorials pass `shields:2` so the Kick arc fits a short lesson. The shield renderer now draws `baseShields()` slots (from `state.startShields`) instead of a hardcoded 4 — so a 2-HP game shows **2 pips, both full**, not 2 full + 2 phantom-empty.
- **Specials cheat sheet — both surfaces (per request).** A dedicated **🃏 board button** (header, opens any time mid-duel) and a beefed-up **section inside Help**, plus a link on the Tutorials hub. Shared `cheatSheetHTML()`: jab vs Special, the four Specials, how they rank, "no flushes/straight flushes," and the value ladder.
- **Bug fix (found while building):** advancing to a **gate-only** step (e.g. "press Pass") updated the coach panel but never re-rendered the board, so buttons stayed disabled from the prior read step. `TUT.show()` now repaints the board each step. (Steps with a `prep` re-rendered already; the pass step had none → it bricked.) Verified in-browser: Lesson 2 pass step enables Pass, banks 1 energy (jab rule), and advances.
- Verified end-to-end in Chromium: hub renders, cheat sheet renders, Lesson 1 gated jab unblocks, Lesson 2 rival-leads/pass works, 2-shield display correct, zero page errors. `test.js` **685/0**, `netview.test.js` 28, `nettest_full`/`_ceremony` green.

### v1.14.1 — playtester fixes: jab catch-up rule + 2 UI bugs
From a fresh round of playtest feedback (batch also seeded the big tutorial-landing-page rework, tracked separately).
- **Jab catch-up energy rule (engine).** Question raised: since jabs strip no shield, who banks catch-up energy on a jab? Ruled (per Aj): **every non-winner banks catch-up on a jab** (= winning-play size, so 1 energy). `applyRoundLoss` now mills all losers on a jab regardless of `MILL_SCOPE`; only **Special** wins consult the scope toggle (`targeted` = just the struck shield's owner). Previously the live `targeted` scope milled **nobody** on a jab (strikeTargets empty), so passing/losing a jab banked 0 — this reinforces the "don't fear losing, you still bank energy" lesson. New test: a jab loser banks 1 even under targeted scope. `test.js` **685/0**.
- **Bug: activation flash was a portrait card, not the landscape art.** `#artFlash .af` used `aspect-ratio:375/523` (portrait) + `background-size:contain`, so the landscape art (512×341, confirmed by decoding the webp) letterboxed inside a tall gold card. Fixed to `aspect-ratio:512/341`, `background-size:cover`, width-based sizing (`min(88vw,680px)`, `max-height:74vh`). Verified via standalone screenshot — full-bleed landscape with the glow hugging the image.
- **Bug: no energy pulse/`+N` when you lose a fight.** Same root cause as the jab rule — under `targeted` scope a jab loser milled 0, so energy never grew and `signalEnergy` had no delta to animate. The jab-mill rule fixes it (loser now banks 1 → render pulses). Special losses already pulsed (the struck player mills).

### v1.14 — no flushes, no straight flushes (combo simplification)
Shipped a rulebook simplification: **the straight-flush tier is gone for every deck.** A run of one suit now just scores as a plain straight (ranked by top card only); plain flushes were never a legal special. This is a single universal rule — **no mono-only carve-out** (Aj didn't want deckbuilding-dependent rules).
- **Engine:** new `NO_STRAIGHT_FLUSH` flag **defaults `true`** (shipped). `detectCombo` only emits `straightflush` when it's off; otherwise a same-suit run falls through to `straight`. `setNoStraightFlush(v)` exported and kept **only for A/B sims**. Every live consumer (game, net host, `mpsim`, `netview.test`) inherits the default automatically — no per-entry-point wiring.
- **Sim A/B:** `analysis.js` now runs SF-off by default; `SF=1 node analysis.js …` re-enables the tier for comparison. The measured effect (400 games/matchup, knight): every **pure** deck −0 to −1.1% (Wizard 56.3→55.2, Cleric 50.9→49.9, Rogue 46.9→46.4, Fighter flat), every **mixed** deck flat-to-up (Full Set the biggest single mover, +1.3, since it could never make an SF anyway). Meta ordering essentially unchanged — SF was a feel-bad ceiling perk for pures, not a balance driver. Removing it slightly narrows the pure-vs-mixed gap and is fairer to Full Set.
- **Text:** Rules screen jab/Special line drops "flush … or straight flush" → "pair, trio, straight, or full house" + a note that same suit doesn't matter. Engine header combo doc updated. Dead display labels (`TYPE.straightflush`, `COMBO_LABEL.flush`) left in place (never produced, harmless).
- **Tests:** the ~4 SF unit assertions rewritten to expect a plain straight (same-suit run = straight, low run doesn't beat a higher straight, straights compare by top card only), plus an A/B coverage pair that toggles `setNoStraightFlush(false)` to confirm the SF tier still returns for sims. `test.js` **684/0**, `netview.test.js` 28, `nettest_prefight` 13/0 (built game boots + plays clean).

### v1.13.1 — tutorial polish (playtest)
- **Coach panel docks to the right on desktop.** Bottom-center collided with the hand on wide screens; now `@media (min-width:721px)` anchors it over the empty right-side description column (clear of hand + pile), mobile keeps bottom-center. Still draggable.
- **Fixed raw `<b>` markup** leaking in the "make a Special" hint — it's set via `hint.textContent` (not innerHTML), so HTML tags rendered literally. Stripped to plain text.
- **Corrected the energy lesson wording.** Step 3 said "whoever wins banks that card as energy" — wrong: `play()` banks **every** card you play into *your* energy immediately, win or lose. Reworded (tutorial + the Rules screen's jab line) to "every card you play banks into your energy — win or lose; a jab win just takes the round."

### v1.13 — balance pass (deck round-robin) + revive dead cards
Ran `analysis.js` (now takes a 6th arg = AI tier, default `'knight'` = the old-Demon baseline; `'demon'` is the new top tier and would skew per-card jab stats via apex-hoarding). Old spread: Fighter (♣) weakest deck (45%), Wizard (♦) strongest (54%); Back Stab (S10) & Phantasmal Illusion (D10) sat at **0.00 cast** (dead), Counterfeit near-dead. Fixes:
- **Back Stab now fires (AI, no card change).** It's a plain non-Quick lockout in the rework, but the AI only ever tried to spring lockouts in the pre-fight Quick window (needs Hermes) — so the base card was never played. Added a proactive lockout branch in `playPhase` (1v1: skip the Rival's next turn when they're unlocked and holding ≥2). Cast 0.00 → **0.24**.
- **Phantasmal Illusion reworked** from the complex copy-a-Special `phantasm` mechanic to a clean **+6 valueBoost** (Odysseus/King lifts it to +7). The AI pilots valueBoosts, so it's alive now (0.00 → 0.06, 59% win). The `phantasm()` engine fn + UI branch are now dead code (harmless; no card has kind `phantasm`). Phantasm-specific tests replaced.
- **Fighter buffs (iterative, measured 1-by-1):** Instant Recovery draw 1→2 (undo the prior over-nerf); Superior Training dig 3/keep 1 → **dig 4/keep 2** (net +2 card & +2 energy at cost 5). Result: Superior Training win 46%→**53%**, Pure Fighter 45→**49** (parity), Mage Knight 49→52.5, Paladin 47→49.7.
- - **Wizard trim — tested then REVERTED.** Back to the Books (D6) was a 56.7% overperformer in 1v1; A/B tested a nerf (look 2/keep 1 dropped Pure Wizard 54→52.7). But the **multiplayer sim (`mpsim.js`, knight) showed the meta inverts**: Wizard is the *worst* deck in free-for-alls (x-fair 1.22 at 2p → **0.45 at 6p**, dies first), while Cleric *dominates* and scales with player count (1.08 → **1.61** at 6p) on its survival kit (Sanctuary/Holy Shroud/Holy Bow). Nerfing a Wizard card for 1v1 would kick it while it's down in MP — so D6 was **reverted to baseline** (look 3, keep 2). Net: no Wizard nerf shipped; the 1v1-vs-MP split is an intentional, documented tension (no single knob balances both). Sanctuary considered for an MP tweak but deliberately left as the symmetric "everyone gains a shield".
Counterfeit left as-is (inherently niche — shines copying jabs, hard for the AI). 
Remaining: after the D6 trim the deck spread is ~52.7 (Wizard) down to ~46 (Berserker/Full Set); Berserker (Fig+Rog) & Full Set are the structural laggards (no value engine / few pairs). `test.js` **681/0**, `netview.test.js` 28.

### v1.12 — 4-tier difficulty ladder (Minion · Fighter · Knight · Demon Lord)
Data-driven AI-tier work. A head-to-head sim (mirror decks, alternating starter, 600 games) measured the old **Fighter→Demon at 42/58** — a modest gap, and not enough separation to split Demon in two. Since the owner beats Demon 3–0, the ladder's weak spot was the *top*, so: **renamed the old Demon Lord → "Knight"** (identical behavior) and added a **new, tougher "Demon Lord"** on top. AI model (`ai.js`): `isSmart(diff)` = knight|demon|demonpass (the old top-tier behavior — strategic pass, higher effect thresholds, finisher targeting), `isTop(diff)` = demon only (new extras). Top-tier extras: **deeper resource caps** (drawT 5→6, rampCap 12→15 — digs harder for gas) and **hoards its apex/Aces** (`keepValue` +8 for rank 1/2 so it stops foddering trumps into jab rounds). No hand-peeking/cheating. Re-measured: **Fighter 43 / Knight 57**, **Knight 41 / Demon 59**, **Fighter 35 / Demon 65** — a clean monotonic ladder, Knight reproduces the old Demon exactly, and the new Demon Lord is a real step up (59% vs Knight). UI: setup dropdown + MP per-seat strength opts + `DIFF_NAME` + `resolveDiff`/`validDiff` + rules text all updated to the 4 tiers (`'knight'` threads straight through `AI.takeTurn`/`preFightMove`/`diffOf`). `test.js` **684/0**, `netview.test.js` 28; verified in-browser (4 options, Demon Lord game runs clean). Note: the internal sims (`analysis.js`/`mpsim.js`) now read `'demon'` as the *new* top tier; use `'knight'` for old-Demon comparisons.

### v1.11 — Basics redesign, Holy Bow AI, card flavour names, centered desktop buttons
Playtest batch:
- **Basics mode redesigned** — instead of removing J/Q/K from the deck, Basics now **keeps the whole 52-card deck** (J/Q/K are plain high cards on the full ladder 3→10→J→Q→K→A→2) but **disables transforms**: `transformGateOK`/`transformGateStatus` return a `basics` lock, so `activate` refuses a J/Q/K, the UI shows no ⚡ (`activatableCard` returns false for transforms in Basics), and the card panel describes them as "Plain fight card" (keeping the flavour name). The **transform-unlock ceremonies (ROAR/OVERDRIVE/REDLINE)** are auto-suppressed because `checkThresholds` reads `transformGateStatus().ok` (always false in Basics). The Form/Super **upgrade ladder** is hidden in the card panel in Basics. `st.basics` unchanged as the flag; the old deck-filter was removed.
- **Card flavour names on plain cards** — new `E.cardName(card)` returns the spec name even when a card has no active effect (the apex **2**, or a J/Q/K in Basics). The "Plain fight card" panel now shows e.g. "2♥ · Divine Intervention", "Q♠ · Pandora Form" — flavour on every card.
- **Holy Bow AI fix (Demon Lord)** — the AI equipped an own-highest buff (Holy Bow / Hero's Sword / Javelin) whenever it held one, even right before **passing** to an unbeatable Special (so the +2 did nothing and burned a per-round counter). Now an own-buff (`eqEff.delta>0 && !oppDelta`) is only equipped when it'll actually **fight** this turn (`!st.pile || legalFightPlays().length>0`); debuff sticks (oppDelta) and absorbers (Holy Shroud) stay playable anytime as defensive setup. Verified in node (holds vs an unbeatable SF; equips when leading / contesting a beatable jab).
- **Centered action buttons on desktop** — `#actions::after{flex:1}` at ≥721px mirrors `#hint`'s flex so the Sort/Clear/Activate/Pass/Fight cluster centers instead of pinning far right; mobile (≤720px) unchanged.
- **Tutorial coach panel now defaults to the bottom** (was top-center) so it never covers the played cards; still draggable.
`test.js` **684/0** (Basics test rewritten: J/Q/K stay in deck, transforms gated off, activate refused, `cardName` on the apex 2), `netview.test.js` 28.

### v1.10.1 — guided-tutorial playtest fixes + progressive disclosure
Live-playtest round on the guided duel: (1) **Read steps now lock the board** — while a "Got it / Next" step is showing, Fight/Pass/Activate are disabled (and the entry fns guarded) so the player can't play ahead of the lesson and desync it (`TUT.blocking()` = active && current step has no gate). (2) **Fight is gated to Specials** on the "make a pair" step (`TUT.needSpecial()` → Fight disabled + play rejected for a single card) so you can't jab past the Specials lesson. (3) **Robust effect picker** — step 6 no longer bricks when the rigged A♣ is gone: `tutPickEffect` scans hand+deck for the cheapest **draw**-preferred safe (no-target) effect, moves it to hand, and tops up energy until affordable; wording made effect-agnostic ("spend energy and fire its effect") so it can't mismatch the card. (4) **Draggable coach panel** (`initTutDrag`, grab handle + "· drag to move") so it never blocks the played cards; default moved to top-center, clear of the hand/action bar. (5) **Progressive disclosure**: once the tutorial is **completed** (`TUT.finish` → `setTutDone`) or the player clicks **"I already know how to play →"**, the prominent "▶ Guided first duel" button (and dismiss link) leave the crowded New Duel screen — the guided duel stays reachable as **"▶ Play the guided first duel"** inside Rules / How to play. Persisted via `cmf_tut_done_v1`. All verified in-browser (read-lock, special-gate, draw-pick, drag, declutter + reload persistence); `test.js` **682/0**, zero page errors.

### v1.10 — guided first duel (interactive tutorial, onboarding stage 2)
The parked stage-2 piece: an interactive coached duel that walks a new player through the core loop. Launched from **New Duel → "▶ Guided first duel"** (gold-accented). It forces a **Basics / 2p / Minion** game with a **rigged deal** (`tutRig`) so every lesson reliably works — you get two strong jabs, a rank-5 pair, a cheap effect (A♣ Prepare for Combat), a comfy energy pile, and a weak Rival (hand of rank 3–4 only) so **you win round 1 and lead round 2**. An 8-step coach (`TUT` module + `#tutPanel`) runs on top of the real board: welcome → **lead a jab** (gated) → jab banks energy → **make a pair** (gated) → Special strips a shield → **activate an effect** (gated) → the apex ladder → wrap. Action steps gate on real play via guarded `TUT.note('play'|'activate'|'roundWin', …)` hooks in `playCards`/`activate`/`announceRoundWin` (all no-op when the tutorial's off); read steps advance on a Next button. A **spotlight** (`.tut-spot` gold pulse) highlights the target element(s); since `render()` rebuilds the hand DOM and wipes the class, `TUT.reapply()` is called at the end of `render()` to re-add it each paint, and per-card prep (`tutEnsurePair`/`tutEnsureEffect`, injecting from the deck if needed) is deferred until it's actually your turn. Panel sits top-center (clear of the hand/action bar; phone variant sits just above the hand). Skip ✕ any time; auto-stops on `openSetup`/`endGame`; `tutorialMode` reset in `commitSetup` so normal duels are never rigged. The stale rules screen was also relabeled: **"▶ Guided first duel"** + **"📖 Rules / How to play"** are now distinct. Verified end-to-end in-browser (all 8 steps drive off real actions, spotlight survives re-renders, panel closes on Finish, zero page errors) — see `tutorial-demo.gif`. Pure UI/onboarding; `test.js` **682/0**, `netview.test.js` 28.

### v1.9.1 — setup polish: segmented Mode toggle + drop redundant MP start button
Two small setup asks. **(1)** The Mode **dropdown → two radio-style segmented buttons** ("Full game" / "Basics") in a `.segToggle`, gold-highlighted active state, each with a `title` tooltip ("The complete game — adds the J/Q/K Rides & Form Changes layer…" / "No transforms — a clean 3–10 + A + 2 game…") plus a live `#modeHint` line under the row that restates the selected mode (covers touch, where tooltips don't fire). The **"Mode" row label was dropped** — the toggle spans the full row width (`.modeRow .segToggle{flex:1}`) as a prominent picker right under the title, hint centered. Refactor: mode no longer read from a `<select>.value` — `pickMode(m)` sets `sel.mode`, `paintMode()` toggles `.active`/`aria-checked` and the hint; the old `setMode` change-listener and `.value` reads/writes were removed (reset now calls `paintMode()`). **(2)** In a **3–6p free-for-all**, the "Random start" button (the MP relabel of Go-second) was **redundant with "Roll for initiative"** — both pick a random starter — so it's now hidden in MP (`goSecondBtn` display:none when `mp`); 2p still shows Go first / Roll / Go second. Pure setup-UI change; `test.js` 682/0. Verified in-browser (2p + 3p, tooltip/hint text, Basics selection still starts a transform-free game).

### v1.9 — Basics mode + rewritten tutorial (onboarding, stage 1)
Onboarding pass. **(1) Basics mode.** New Duel now has a **Mode** selector: **Full** (with Rides & Forms) or **Basics** (no transforms). Basics keeps the *entire* real game — the 2-apex / A-14 ladder, every 1-10 archetype effect, equipment, shields, energy, catch-up — and only drops the **J/Q/K transform layer**, so nothing a new player learns has to be un-learned in the Full game (the empty 11-13 rungs between 10 and the A/2 trumps are exactly the space transforms later fill). Engine: `newGame(opts.basics)` filters ranks 11-13 out of every built deck (`c.rank <= 10`) and sets `st.basics`; a full-set Basics deck is 40 cards (52 − 12 faces). Netview mirrors `st.basics`. UI: `sel.mode` persists in setup (`setMode` select, default `full`), flows `commitSetup → gameBasics → startGame → ngOpts.basics`; the header matchup line shows a cyan **BASICS** badge; the tutorial shows a **BASICS MODE** pill when active. Online play is forced to Full for now (`gameBasics=false` in `hostStartRealN`) — Basics is a solo learn-the-ropes mode. Design decision (with the user): the dividing line is *transforms, not number range* — a classic 1-10 game (10 = top) was rejected because it teaches an inverted top-of-ladder. **(2) Tutorial rewrite.** The old "How to play" text was stale (said "0 low…9 high", never mentioned the apex or transforms). Rewritten to be rework-accurate and split into **The basics** (goal/Fighter Kick, jab vs Special, the real ladder 3→10→A→2-apex with strict-beat/ties, shields-as-cards catch-up, the energy cycle incl. the new ⚡ pulse, archetype effects + Quicks, ongoing equipment, deck-out) and **Advanced — Rides & Form Changes** (J=Ride, Q/K=Form Change, Super Mode, examples; explicitly framed as the layer Basics omits), plus a **Setup** section. Sectioned with `.rules h3`; setup button relabeled **📖 Tutorial / How to play**. Tests: 6 new in `test.js` (basics flag, no J/Q/K, apex ladder intact, 40-card count, Full unaffected). `test.js` **682/0**, `netview.test.js` 28. Verified in-browser: setup Mode row, BASICS badge, a Basics hand with no face cards, and the new tutorial all render clean. **PARKED (stage 2):** an interactive *guided first game* — scripted coaching prompts through the first few turns (lead a jab → make a Special → spend energy → …). The user chose "both, in stages"; the rules rewrite is stage 1, the guided game is the follow-up.

### v1.8.2 — energy pile "grew" signal (glow + floating +N)
Game-feel ask: the ⚡ Energy box changed silently when the pile filled. Now any INCREASE in a player's energy count triggers a brief **cyan pulse** on the `.nrgBox` (box-shadow + background flash, `@keyframes nrgGrow` .85s) plus a **floating "+N"** that rises and fades above it (`.nrgGain`, `@keyframes nrgFloat` 1s). Source-agnostic — it just diffs the count between renders (like `animateShields`), so it fires for fought cards banking to Energy (jab/special), a ramp (Gather Energy / Pray for Strength), and the catch-up mill alike. New `prevNrg={}` tracker (reset in `startGame`), `signalEnergy(el, player, n)` called from `render()` for both you and the 2p rival right after `energyChips` paints. Spending energy (a decrease) is silent; `prev==null` (first render of a game) never flashes; respects `reduceMotion()`. The float is appended to the box's persistent parent `.stat` (set `position:relative` on demand) so the box's per-render `innerHTML` rebuild can't wipe it; self-removes after ~1.05s. Pure UI — no engine/logic/netview change; works on host + client since both re-render from state. Verified in-browser: growing 2→7 shows a glowing `7♠` box with a `+5` float, no page errors. `test.js` **676/0**, `netview.test.js` 28.

### v1.8.1 — active-modifier readout on your hand (value vs cost)
Playtest confusion: a J♦ jab beat a rival's boosted 10♣ and looked wrong (11 vs 11), because the board never showed that the J♦ was actually swinging at 12 — Jack (11) + your own Giant Boar (+1, offensive/your turn); the rival's 10♣ defends at 11 (10 + their Javelin; their Boar can't defend, offensive-only). Not a bug — but invisible. Added a **`#playMods` status strip** above your hand that lists what's modifying YOUR plays right now and from where, split into two axes the player asked for: **value** (Giant Boar, equipment ±, a charged pre-fight play) and **cost** (Giant Owl −1 / Giant Ram +1 on your first effect). Same-direction sources net into one chip with the list — "value +3 from Giant Boar, Hero's Sword"; opposing signs split into one chip per source so nothing's hidden — "+1 Giant Boar" (green) / "−2 Spiked Armor" (red); cost chips are blue ("cost −1 Giant Owl"). Backed by two exported engine helpers, `playModifiers(st,p)` / `costModifiers(st,p)`, that itemize exactly what `applyEquip` sums and what `rideCostDelta` applies (so the readout can never drift from the math). Boar correctly appears only on your turn and drops on the rival's; cost chips vanish once your first effect is spent; hidden while spectating / at game over (`#playMods:empty` collapses). `renderPlayMods` runs in `render()`. Verified in-browser (net game, forced board): renders "value +3 from Giant Boar, Hero's Sword" and the mixed value+cost case, no page errors. Tests: 6 new assertions in `test.js` (Boar-on-your-turn, two-source net, opponent debuff, Boar-off-on-rival-turn, Owl/Ram cost, cost clears after first effect). `test.js` **676/0**, `netview.test.js` 28.

### v1.8 — equipment is ONGOING on a standing pile (not locked at play time)
Playtest ask + design clarification: equipment should behave like an enduring enchantment (MTG-style) — its ±value modifier tracks the board continuously, including on a fight ALREADY on the table — while only timing-gated boosts (the pre-fight `+N to next play` and Giant Swan defensive) stay frozen at play time, and Giant Boar (offensive) stays excluded from stored piles. Previously the pile's value locked completely at play time; the only thing that re-valued a standing pile was *removing* an equipment (the old `unapplyEquipFromPile`). So equipping **Spiked Armor** in response to a rival's standing Special didn't blunt it — the user's exact report ("it says BOOSTED +1 but it should say −1": rival's 9♣ pair had Hero's Javelin +1 locked, and the Spiked Armor −2 equipped afterward never applied). Fix: `play()` now stores the pile as `{ combo, byPlayer, raw, rawKey0, lockedDelta, mod }` where `lockedDelta = playBoost + swanValue` (Boar excluded), and a new **`refreshPile(st)`** recomputes the live value from scratch: `combo.value = raw + lockedDelta + equipDelta(st, byPlayer)`. `refreshPile` is called wherever equipment changes — the `equip` resolution (new debuff/buff re-values the table immediately), the removal path (Disarm/Sabotage/Forceful Strip/Plead — replaced `unapplyEquipFromPile`), and `useEquipment` retire. Because it recomputes rather than incrementally patches, add and remove are both correct. Phantom (Illusion) piles are guarded out (`raw == null`), so they keep their own locked value. `refreshPile` is exported for tests. Net effect for the reported hand: equipping Spiked Armor now drops the rival's standing pair to −1 as expected. Tests: 7 new assertions in `test.js` (debuff-after-stand → mod −2; remove → back to raw; buff-after-lead → +1; exact Round-7 Javelin+Armor → −1) and a verified end-to-end `activate`→equip→refresh (rival pile 9→7). `test.js` **670/0**, `netview.test.js` 28 (mirror carries the fresh `combo.value`/`mod`, no netview change needed).

### v1.2 changes — Back Stab pre-fight over netplay, dig-scope fix, UI pass
- **Back Stab pre-fight window in netplay (#3, done).** The pre-fight (Back Stab) window — the one interactive beat that fires BEFORE a fight/pass, owned by the NEXT seat — now travels both ways in 3–6p. `hostPreFight(g, proceed)` opens it: a host holder pops `promptHostPreFight`; a remote holder parks `netReact={kind:'prefight',seat}` and the holder's client pops `promptHumanPreFight` from its mirror (`preFightQ===YOU`), springing over the wire (`{op:'prefight',id}` / `{op:'prefightPass'}`). Wired into both the host's own `doFight`/`doPass` (via `NET.hostPreFight` when `hostLive()&&MP()`) and the remote-turn path (`hostApplyMoveN` runs `hostPreFight` before applying a remote seat's play/pass; a locked active seat is force-skipped). **Engine bug fixed:** a pre-fight Back Stab defaulted its target to `nextPlayer(holder)`, which is only the active player in 2p — in 3p+ it hit the wrong seat. `preFightCast` now defaults `opts.target = st.turn` (the active player). Under REWORK, Back Stab is a Quick only with Hermes Mode (any Q + any K form, cost 10); `eligiblePreFightQuicks` was using form-blind `effectOf` — now uses `effectFor` so the Hermes-empowered 10♠ is recognized. Test: `node nettest_prefight.js` (13).
- **Dig discard is scoped to the looked-at cards (correctness).** Superior Training / Back to the Books / Never Out of Options ("look at top N, bank M to Energy, keep the rest") previously drew N into hand then opened a discard from the WHOLE hand — you could bank a pre-existing card. The engine's `draw` case now records the just-drawn ids and sets `discardPending.from = drawnIds`; `resolveDiscard` restricts (and auto-fills) to that set. UI: the discard `pick` carries `from`, non-eligible hand cards render `.notpick` (dimmed, unclickable), and `togglePick` rejects them. Mirror carries `discardPending.from`. Test: 5 new assertions in `test.js`.
- **UI pass.** (a) "Last played" pile moved from top-left to center-left (`#beaten{top:50%;transform:translateY(-50%)}`) so it no longer overlaps the rival Forms & Rides labels. (b) Equipment indicators now paint the card art behind the text (light scrim for legibility, `.hasArt`), bigger name/effect text, and a compact `◆ N` counter (was a row of pips); hover/tap shows the full card + rules in the description panel. (c) Forms/Rides no longer push "X used Y Form" into the description box — the art still pops center-stage (`flashArt` instead of `revealEffect` for `kind==='transform'`), and a form's full text is read by hovering it in the on-table zone (`renderFormsZone` mouseenter/click → `showCard(f.card)`). `dbgForceAll` extended with `opts.forms` / `opts.equip` for staging these in tests, plus `__cmf.lock(seat)` / `__cmf.handOf(seat)`.
- Regression: `test.js` **659/0**, `netview.test.js` 28, `nettest_prefight.js` 13; existing 2p/3p net suites unchanged.

### v1.2.1 — dead-code cleanup pass (done)
Removed the entire superseded **old functional-board netplay path** from the NET module — the pre-full-UI approach where both ends rendered from a redacted `NetView.snapshotFor` snapshot and submitted high-level intents. It was fully orphaned (the live protocol is join/move/mirror/ceremony; onMsg has no `intent`/`snap` handler). Deleted: `hostStart`, `broadcastAll`, `seats`, `soleOpponent`, `applyIntent`, `submit`, `renderNetOldBoard_UNUSED`, `canAct`, `paintInfo`, `buildHand`, `interactiveHand`, `selIds`, `btn`, `renderActions`, `statusMsg`, `pips`, `oppPanelHTML`, and the orphaned `snap`/`sel` NET vars. **Kept** `resolveIds` (used live by `hostApplyMoveN`) and `NetView.snapshotFor` (app-unused now, but a pure, unit-tested helper — retained for the 28 netview tests, zero runtime cost). Retired the two obsolete test files that drove the old board: `nettest2.js`, `rtctest.js` (superseded by `nettest_full.js` + `nettest_rtc.js`). Build −~10KB. Full regression re-run green: `test.js` 659, `netview.test.js` 28, and the live net suite (`nettest_deckpick` 8, `_3p` 7, `_rtc` 11, `_rtc3` 10, `_counter` 8, `_activate` 6, `_guard` 8, `_ceremony` 9, `_prefight` 13). Residual: ~40 lines of now-unused old-board **CSS** left in `NETCSS` (some classes like `.netmsg` are still shared with the live signaling lobby, so trimming needs a per-class audit — deferred, inert).

### v1.2.2 — Giant Boar offensive/defensive fix
Giant Boar (J♣, the OFFENSIVE super keystone, "+1 on your turn") was baking its +1 into the **stored pile value** in `play()` — so its owner's plays stayed boosted when the *opponent* had to beat them on their turn, i.e. an offensive keystone acting defensively (the job of Giant Swan). Fix: `play()` now strips Boar's contribution back out of the stored pile — `storedDelta = (eff.value − combo.value) − rideValue(Boar) + swanValue(Swan)`. Boar still rides in `eff` to clear the `beats()` check (it helps you attack), but the pile stores the raw value + equipment/pre-fight/Swan only. `boosted` return flag now reflects the stored value (a pure-Boar lead no longer logs/labels "boosted"). Giant Swan (defensive, baked into the pile) unchanged. Tests: 3 new assertions in `test.js` (Boar lead stores raw value; Boar beats a tie but stores raw; verified Swan still stores +1). `test.js` **662/0**.

### v1.5.1 — Forms & Rides = mini-cards; Activate badge off the art (UX)
Two playtest UI asks. (1) **Forms & Rides zone** now renders each Form/Ride as just a compact **mini-card** (`cardEl` art + rank/suit corner index) in a `.formRow`, dropping the inline name/tier label — all the detail (name, tier, full ability) reads in the description box on hover/tap (`showCard(f.card)`, already wired). Much more compact; clears the label/message pile-up in narrow views. Old `.formCard`/`.formName`/`.formTier` styles replaced with `.formMini`. (2) **Activate ⚡** in the description panel was an 84px box pinned mid-image (`top:145px`) — overlapping the art. Now a compact 34px circular gold **corner badge** (`left:22px; top:20px`, `#side` is `position:relative`) tucked in the image's top-left, off the central artwork; mobile strip variant matched. Pure CSS/render; `test.js` 662/0, verified in-browser. (3) **Removed the "X used …" banner** (`cvBanner`) from the description reader — it crowded the box. `revealEffect` still drops the played card into the reader and gives it a flash pop; the play-area message + center-stage art flash already announce who did what. Dead `.cvBanner` CSS removed too. (Note: the game correctly allows only one Form per rank — a new Ride/Queen/King displaces the old one to Energy, engine `transform` case; a screenshot showing two Rides was a `dbgForceAll` test artifact that bypasses the play rules, not reachable in real play.)

### v1.5 — equipment flash on counter change / leaving play (UX)
Equipment counters changed silently (an absorb spent a Holy Shroud counter, or a removal/spend retired it) with no visual cue, so a shroud "vanishing" read as a bug. Now the UI tracks each equip's counter across renders (`equipFx` map, keyed `zone:id`) and: (a) **flashes the box** with a gold glow for ~1.3s when its counter drops, and (b) when an equip LEAVES play (spent to 0 → Energy, or removed by Plead for Peace/Disarm/Sabotage) it holds a faded **"◇ GONE" ghost** in the slot for ~1.3s before disappearing, so the eye catches it. Reason-neutral wording ("gone", not "spent") since the UI can't tell spend from removal — the log has the reason. `scheduleEquipFxClear` fires one delayed re-render so the flash settles even with no other render; `equipFx` resets in `startGame`. Applies to your own zone (all modes) + the 2p rival zone. Pure `renderEquipZone` UI — no engine/logic change; `test.js` 662/0, `nettest_3p` 7. (Prompted by a playtest: a spent Holy Shroud and a Plead-for-Peace'd one both vanished with no cue — both were correct engine behavior, just invisible.)

### v1.4.1 — "Passo": grace-expiry hands the seat to a caretaker AI (not a drop)
Instead of eliminating a timed-out player, the seat is handed to **Passo** — a caretaker AI that only ever PASSES (leads its lowest card when forced to lead) and auto-resolves forced windows the minimal/safe way (smart auto-discard via `resolveDiscard`, take-the-hit on guards, decline responses, pass the pre-fight window). The player's standing (shields, cards, position) is fully preserved, and they **reclaim the seat the instant they reconnect** (`hostOnPeerBack` clears the passo flag; a pending scheduled step no-ops via the `isPasso` guard). Implemented host-side by feeding the SAME intents a remote client would send through `hostApplyMoveN`, so all the tested application + resume machinery is reused — `passoStep(seat)` reads whatever the seat currently owes (`netReact`/`netParked`) and sends the caretaker response; `maybePasso(seat)` is called at every park site so a newly-parked Passo seat auto-acts (on a ~450ms delay, which also breaks recursion across chained passes). The manual **Drop** button remains a hard eliminate (concede) in both the holding and Passo states. Grace-expiry ticker now calls `passoTakeover` (sets `discon[seat].passo`, keeps the seat) instead of `hostDropPlayer`. Banner shows "🤖 Passo is covering P3 (auto-passing) — they can rejoin anytime · [Drop P3]"; bystanders get a `{t:'peer',ev:'passo'}` note. Dbg: `__cmf.passo(seat)`. Test: `nettest_discon3.js` extended to 22 — grace-expiry → Passo (NOT eliminated), Passo auto-passes on its turn (round resolves, no hang), reconnect reclaims the seat, manual Drop still hard-eliminates. Passo's forced-window resolution reuses the `hostApplyMoveN` discard/guard/decline/prefight handlers already covered by `nettest_discard` + `test.js` auto-pick.

### v1.4 — #1 disconnection handling (done)
A dropped peer no longer freezes the table. When a live player's connection drops mid-game, the host **holds their seat for a 90s grace window** (configurable) with a top-of-table banner showing a live countdown + a **Drop <seat>** button; bystander clients show "a player disconnected — waiting…"; the dropped client shows "Reconnecting to the host…". Three ways it resolves: (1) **self-heal** — WebRTC ICE recovers to connected → resume seamlessly, banner clears; (2) **re-join** — the player reconnects with the same `cid` (re-invite) → reclaims their seat and resumes; (3) **drop** — the host clicks Drop, or the 90s window **auto-expires**, and the seat is **conceded** (`E.concede` via `onOpponentConcede` — the tested path: eliminate, clear their obligations, continue driving the survivors; ends the game if one Rider remains). A dropped/eliminated player who reconnects rejoins as a **spectator** (the v1.3.1 view) rather than re-entering the game. Core handlers `hostOnPeerDrop` / `hostOnPeerBack` / `hostDropPlayer` are wired to the real WebRTC events (`lpc.oniceconnectionstatechange` disconnected/failed→drop, connected/completed→back; `ldc.onclose`→drop) and to the client's own `pc` ICE state; the client `{t:'peer'}` broadcast drives the bystander banner; a re-join (`onMsg` 'join', same cid) restores the seat. Dbg hooks: `__cmf.drop/reconnect/dropNow/graceMs/disconShown`. Tests: `node nettest_discon3.js` (19, state machine over BC via hooks — drop→hold, reconnect→resume, grace-expiry auto-drop, spectate-on-reconnect, manual drop ends game) + `node nettest_rtc_discon.js` (5, REAL WebRTC — closing the client's page raises the host banner, proving the production events reach the handlers). `test.js` 662/0; WebRTC hub (`nettest_rtc` 11 / `nettest_rtc3` 10) still connects & plays.

### v1.3.1 — defeated players can spectate
A knocked-out client already kept receiving mirrors (the host broadcasts to every seat); this adds the missing UX so it reads as spectating rather than a frozen/empty board. When `MP() && you.eliminated && !finished`: the turn indicator shows "👁 Spectating — P2’s turn" (tracks whose turn it is live), the action hint shows "💀 You’re out — spectating the rest of the duel.", the (empty) hand fades via `body.spectating`, Fight/Pass stay disabled, and the header offers **New Duel** (leave) instead of Concede (`newBtnLive` returns false once you're eliminated). The board otherwise updates live — opponent panels, pile, ceremonies (ROAR/threshold beats), battle log — so you watch the rest of the duel and the end screen fires normally when it finishes. Assertions folded into `nettest_elim3.js` (now 15). `test.js` 662/0.

### v1.3 — #4 N-player elimination over netplay (done)
Verified (and locked with a test) that a mid-game **Fighter Kick** elimination flows correctly over the wire in 3–6p. The engine already handled it (`resolveRoundWin`→ kick at 0 shields → `eliminatePlayer`, finish only when `aliveCount<=1`); this proves the netplay layer carries it: the kicked client sees itself `eliminated` in its mirror and keeps receiving mirrors as a spectator, `driveN`/`nextPlayer` skip the eliminated seat so control returns to a living player, the survivors advance to the next round, and — in the terminal case — the final kick that reduces the table to one Rider finishes the game and broadcasts the finished mirror to every remaining client (including the already-out spectator). Test: `node nettest_elim3.js` (12) — phase 1 kicks one of three (two continue), phase 2 kicks the last opponent (game over). Added `__cmf.finished()` / `.winner()` / `.eliminated(seat)` dbg accessors (read live `state`, so they work on host and client alike). (Deckout elimination — the other N-player elimination trigger — is now also wire-tested: see v1.6.) `test.js` **662/0**.

### v1.7 — Giant Owl/Ram first-effect bug + collapsible Forms zone
- **Owl/Ram "first effect each turn" was permanently spent (bug fix).** `firstEffectThisTurn` compared `st._effTurn !== st.turn`, but `st.turn` is a seat index that repeats every one of a player's turns — so once a seat activated any effect, `_effUsed` stuck true forever and the Giant Owl −1 discount / Giant Ram +1 tax only ever applied on that seat's very first activation of the whole game. (Symptom: Owl owner with 5♦ couldn't pay Back to the Books, cost 5 — the check used the full 6.) Fixed: `firstEffectThisTurn` is now just `!st._effUsed`, and `_effUsed` is reset to false on **every turn advance** (play/pass/forced-skip/phantasm/round-start/round-win/deckout). Test added: after a turn advance the flag clears so the discount/tax re-applies. `test.js` **663/0**.
- **Collapsible Forms & Rides zone (UX, for narrow/phone crowding).** Each zone now defaults to a compact tap-to-expand **chip strip** — just rank/suit (`J♦ Q♦`), or the single **⚡ INCARNATION** pill when Super is live. Tap the strip → expands to the full mini-cards (tap one to read it); tap anywhere outside → collapses back (`formsOpen` state + a document-level outside-click handler → `collapseForms`). Targeting always forces the full-card view (so Rides/Forms stay clickable for removal). Massively shrinks the left-edge footprint that was colliding with the last-played pile in portrait. `formsOpen` resets on new game.

### v1.6 — deckout elimination over netplay (done)
The other N-player elimination trigger, now wire-verified. A player who wins a round (seizing the lead) but whose deck + shuffle pile are empty and whose hand emptied on that play can't draw at the new round's deal → **deck-out**. In N-player that's an elimination (not game-over): the decked-out client sees itself eliminated → spectator mode, the game continues with the survivors, and control skips the empty seat. Same `finishRoundWin` engine path as before (`result.deckedOut`/`eliminated`), just proven over the wire. `dbgForceAll` extended with `opts.deck`/`opts.shuffle` (per-seat) to stage an empty library deterministically. Test: `node nettest_deckout3.js` (8). `test.js` 662/0.

### v1.6.1 — NETCSS trim + stale deck-count labels
Removed the dead old functional-board CSS from the `NETCSS` string — audited every class against the live lobby/signaling render functions first. Cut: `.netopps`, `.netopp`(+`.active`/`.out`/`.on`/`.ometa`), `.opips`/`.pip`(+`.off`), `.netpile`, `.pilelbl`, `.netmine`/`.mystat`, `.myhand`(+`.card`/`.card.sel`), `.netinfo`(+`.netinfohint`/`.cvText`/`.cvName`/`.cvType`/`.cvUpg`/`.cvUpgName`), `.netactions`. **Kept** everything the live lobby still emits: `#netroot`, `.netbar`, `.ok`/`.wait`, `.netmsg`(+`.err`), `.netbtn`(+`.go`/`.alt`/`.ghost`), `.nethint`, `.netlobby`(+`h3`), `.sigbox`, `.deckSel`(+`:disabled`), `.lobbyStatus`, `code`. Verified the RTC + BC lobbies still render correctly (screenshots). Also fixed two stale **"all 40"** deck-count labels → **52** (the `full` deck option + the how-to text; Full Set = 4 suits × 13 ranks under REWORK). `test.js` 662/0.

### PARKED for next session
- **Manual re-invite UI for a hard drop** — self-heal (transient ICE) and same-cid re-join already work; a fully dead (`failed`) connection now goes to Passo (caretaker AI) at grace end, and the player rejoins as themselves whenever they reconnect. A "re-invite this seat" button (host generates a fresh offer for the held seat mid-game) would speed a hard-dropped player's return over serverless copy-paste signaling. Nice-to-have.

_(Netplay is feature-complete: 2–6p over BroadcastChannel + WebRTC, full interactive parity, deck picker, client ceremony, choose-who-loses-a-shield, targeting, Back Stab pre-fight, both elimination triggers, spectating, disconnect→hold→Passo→reconnect/drop. Dead old-board code + CSS all removed. Remaining items are polish/nice-to-haves.)_

### v1.1 changes — N-PLAYER netplay (3–6 players, BroadcastChannel + WebRTC)
Netplay now runs 2–6 players. All new logic is gated on `MP()` (>2 players) so the 2p path is byte-for-byte the old one.
- **Multi-client lobby + seat assignment.** Each client has a stable `myId` (so the host tells a new joiner from a 350ms retry on the shared bus). Host maps `cid→seat` (1..5; +host = up to 6), stores each seat's deck pick, and assigns seats on `join`. Host lobby shows the joined count and a "Start (N Riders)" button (enabled at ≥1 joined). `hostStartRealN(hostDeck)` builds `seatDecks`/`seatDiffs` per seat, marks joined seats `seatCtrl='remote'`, and starts a real N-player game. Picks stay hidden (no counter-picking); per-seat `{t:'setup', decks}` gives each client its own board label.
- **N-player host driver** (`driveN` + `hostApplyMoveN`, in `var NET`). After the host acts, `driveN` steps the opponent seats: the host's OWN reactive windows pop its modals; opponents' reactive windows auto-resolve (Stage-1, like AI — see limit below); each opponent's turn parks (`netParked`) for its wired move. `hostApplyMoveN(seat, it)` is **seat-authoritative** (only the seat whose turn it is may move; on WebRTC the seat is the channel's bound seat, not client-claimed), applies play/pass/activate for that seat, un-rotates the client's target index back to absolute (`(target+seat)%n`), and runs the per-seat ceremony on a round win.
- **Per-seat mirror + ceremony routing.** `mirrorFor(seat)` and `ceremonyResFor(res, seat)` rotate to each seat's view; `broadcastMirror`/`sendCeremony` now use `sendTo(seat, …)` so **a seat's private hand never reaches another peer** (critical over the internet).
- **WebRTC N-way (host-centered star).** The RTC host runs a **hub** (`hubMode`) of N-1 DataChannels: `hostNewInvite()` creates one PC+DataChannel per invited player (sequential copy-paste invites in the host lobby), `hostAddChannel` feeds each into the hub, `send` broadcasts, `sendTo(seat)` targets one channel via `chanSeat[]`, and the channel a move arrives on is the authoritative seat. Clients each hold one channel to the host (no client↔client links). Joiner UI unchanged.
- **Complete REACTIVE parity (v1.1.1).** Remote opponents now handle their OWN reactive windows in 3–6p — Counter another player's Technique, spring a round-win guard (Leyline), and choose their own forced discards — not just their turn. The client side needed nothing (`clientCheckWindow` already reads the seat's rotated mirror generically). Host-side: `driveN` calls `netOppWindow()` — the next opponent-owed window needing a real choice (auto-resolving no-choice cases, e.g. a shield with no guard) — and **parks** it (`netReact={kind,seat,g,resume}`, broadcast) instead of auto-resolving; `hostApplyMoveN` handles `respond`/`decline`/`guard`/`guardPass`/`discard` gated on `netReact.seat` (a reactive op is valid when it's your window, even if not your turn — separate from the turn-gated play/pass/activate). The host's OWN cast settles via `hostSettleN` (host answers via modal; each opponent's response window parks for that seat). Test: `node nettest_react3.js` (7) — host casts Gather Energy, remote client 1 gets the Counter window from its mirror and counters over the wire.

**Choose-who-loses-a-shield (v1.1.2).** In `chosen` mode (the live 3–6p default), the round winner now PICKS whose shield to strip instead of the engine auto-pressuring the leader. Engine: `resolveRoundWin` splits — when `lossTargetInteractive(st,winner)` says the winner is human, it defers (sets `st.pendingLossChoice={winner,cands,winSize}`, returns `needsLossTarget:true`) and `E.chooseLossTarget(st, seat)` completes the mill+strike via the shared `applyRoundLoss`. Default is auto (predicate null) so 654 tests + AI sims are unchanged; the UI installs `E.setLossTargetInteractive(w=>isHumanSeat(w))` in `startGame`. UI: `promptLossTarget`/`chooseLossSeat` let the winner tap a rival panel (reusing the opponent-panel `targetable` wiring). Single-player MP handles it in `runOpponents`; netplay in `hostResolveWin` — the **host winner** picks locally, a **remote winner** parks (`netReact.kind='loss'`), the mirror carries a rotated `pendingLossChoice`, the client's `clientCheckWindow` pops the picker, and `{op:'lossTarget'}` un-rotates back on the host (`hostSettleRoundThenCeremony` then resolves the struck seat's guard window before the ceremony). Tests: `node nettest_losspick3.js` (7, host picks) + `node nettest_losspick_remote3.js` (6, remote picks over the wire).

**Targeting cards verified.** "Target 1 rival" effects (discardOpp/destroyShield/etc.) hit exactly the chosen seat — confirmed at the engine level (Node) and in netplay: `node nettest_target3.js` (6) — a client picks a specific opponent panel; the rotated index un-rotates to the right absolute seat and only that opponent is hit.
- **Tests:** `node nettest_3p.js` (7, three tabs over BroadcastChannel), `node nettest_rtc3.js` (10, three peers over real WebRTC — two sequential invites, per-seat routing, round sync), `node nettest_react3.js` (7, remote reactive Counter). All 2p tests + single-player unchanged.

### v1.0 changes — NETPLAY interactive windows (full-UI reuse)
Netplay now drives the **real single-player board on both ends** through EVERY interactive window (play/pass, activate, Counter, shield-guard, forced-discard) — full two-way parity.

**Client round ceremony (v1.0.2).** The client used to *snap* through round resolutions — it only got the raw shield-shatter FX (via `render()`→`animateShields`), missing the `#roundfx` banner beats, the round-result message/log, and the threshold-unlock beat (those ran only in the host's `resolveRoundCeremony`). Now the host's two round-resolution paths (`hostFinishRound` for a rival-triggered win, `finishPassRound` for a host-triggered win) call `NET.sendCeremony(res)` → `{t:'ceremony', res}` **before** running their own ceremony; `ceremonyResFor` seat-swaps the display fields (2p) to the client's view. The client's `clientPlayCeremony(res)` reuses the real, purely-visual beat players (`announceRoundWin` + `playPreBeats` + `flushThreshold` + `playRoundCardBeat`) — it sets `holdShields` so the shatter lands ON the "loses a shield" beat, and `flushThreshold` shows the client's OWN tier unlock (ROAR/OVERDRIVE/REDLINE), since `checkThresholds` reads the client's gate. No engine mutation on the client — the authoritative new-round cards arrive via the final mirror. **"Round N" card-banner too**: `res.newRound` is available at event time (set in `finishRoundWin`), but `res.draws` isn't (deferred), and the banner must sync with the card fly-in — so `applyMirror` HOLDS the new-round deal mirror (detected by `handGrew`) while the pre-draw beats play, and `finishClientCeremony`→`revealRound` applies it with `enterDelayBase` set + shows the banner, so the banner leads and the cards deal in behind it (matching the host's deferred draw). Falls back gracefully (banner skipped) if the deal mirror lands outside the window. Test: `node nettest_ceremony.js` (9) — host wins round 2 with a straight; asserts the client shows the pre-draw banner, logs the result, fires the ROAR threshold beat, its shield drops, it advances to round 3, and the "Round N" card banner shows (caught by an in-page watcher).

**Deck picker + lobby (v1.0.1).** Online duels no longer force `full`/`full`. After the transport connects, both sides land in a **deck-picker lobby** (new `renderLobby` in `var NET`) instead of the host auto-starting: the client chooses a deck and clicks **Ready** (sends `{t:'join', deck}`), the host chooses its own and clicks **Start Duel** (enabled once the opponent is ready). `hostStartReal(hostDeck, clientDeck)` resolves each pick (`resolveDeck`, so `random` works) into `youDeck`/`rivalDeck`/`seatDecks` and deals them; a `{t:'setup'}` message hands the client the concrete deck keys for its board labels. **Picks are hidden in the lobby** (no counter-picking — the host sees only "opponent locked in", never which deck); both reveal on the board when the duel starts. The join-retry now carries the deck, and the host re-renders only when readiness actually changes (so 350ms retries don't clobber the host's dropdown). Test hook lobby helper: `nettest_lobby.js` (`startDuel(host, join, {hostDeck, clientDeck})`).
- **Client can ACTIVATE over the wire** — techniques, rides/transforms, Forceful Strip (removeEquip), Counterfeit. Client gates send `{op:'activate', id, target, copyId}`; the host applies `E.activate(hostState, 1, id, opts)` then settles. **Fixed a critical bug**: the host called `E.activate` with the options object in the *cardId* slot, so every client activation failed with "You don't hold that card." Caught by the new deterministic test.
- **Client can COUNTER the host's techniques.** `settleWindows` is now host-aware: a window owed to the remote Rival **parks** (`netSettle`) and broadcasts instead of running the AI; the client's mirror shows `respondFor===YOU`, `clientCheckWindow()` pops the normal **Respond?** modal, and `humanResponds`/`humanDeclines` send `{op:'respond',id}`/`{op:'decline'}`. Host applies and re-enters `hostSettle` (handles counter-a-counter). Host's own windows still pop its normal modal.
- **Remote SHIELD-GUARD (round-win Leyline).** When the host wins a round WITH A COMBO (`wonWithCombo`, so a shield is stripped — jab wins strip nothing, and round 1 is jabs-only) and the losing remote holds an immunity card, `hostAfterRivalMove`/`hostRivalWindows` park (`netGuard`) instead of auto-passing; the client's mirror shows `shieldResponse.q===YOU` and `clientCheckWindow()` pops `openShieldGuardModal`, whose Guard / Take-the-hit buttons send `{op:'guard',id}`/`{op:'guardPass'}`. (No guard offered when there's no guard card — auto-pass.)
- **Remote FORCED-DISCARD (own choice).** When the host casts a discard-opponent Technique, `hostAfterOwnCast`→`hostRivalWindows` park (`netDiscard`); the client gets the real discard PICKER (`promptHumanDiscard`) on its own hand, chooses which cards to pitch, and `confirmPick` sends `{op:'discard',ids}`. **Fixed a bug**: the host handler passed card *objects* to `E.resolveDiscard`, which matches on id *strings* (`choose()`), so nothing was discarded — now passes `it.ids`.
- **Host-side windows** (host's own shield-guard / forced-discard from a Rival technique) still pop the host's normal modals via `hostRivalContinue`. Full two-way parity — every interactive window now belongs to whoever actually owns it.
- **Fixed a modal-flicker bug**: `applyMirror` called `hideOverlay()` on *every* incoming mirror, hiding the client's open modal. Now it keeps the overlay up while a modal window is owed (`owedModal`) and leaves the board unlocked for the discard picker (`owedDiscard`).
- **Test hook** `?dbg=1` → `window.__cmf.force(hostHand, rivalHand, hostEnergy, rivalEnergy)` + `.turn()/.hand()/.pending()/.energy()/.shields()` — **inert without the URL param**. Powers four new deterministic Playwright tests:
  - `node nettest_counter.js` (8) — remote client Counters the host's Technique over the wire.
  - `node nettest_activate.js` (6) — remote client activates a Technique on its own turn.
  - `node nettest_discard.js` (7) — remote client chooses its own pitches for a host discard Technique.
  - `node nettest_guard.js` (8) — remote client springs Leyline to guard a round-win shield loss.
  - `node nettest_deckpick.js` (8) — host picks Pure Wizard, client picks Pure Rogue in the lobby; verifies each side is dealt its own pick (all ♦ / all ♠) and the board labels match.
  - `node nettest_rtc.js` (11) — the whole thing over **real WebRTC**: automates the copy-paste offer/answer signaling, opens the DataChannel, runs a Counter over the wire, then plays rounds. Launch chromium with `--disable-features=WebRtcHideLocalIpsWithMdns` and use `stun=0` so the two tabs connect over loopback ICE with no external STUN/TURN (that's how the test dials `?net=rtchost/rtcjoin&stun=0`).
- Regression: `test.js` **654/0** (single-player byte-identical), `netview.test.js` 28, `browsertest.js` smoke, `nettest_full.js` core loop. (`nettest2.js`/`rtctest.js` retired — they drove the old functional board.)

### v0.96 changes
- **Threshold unlock (ROAR/OVERDRIVE/REDLINE) now gets its OWN beat (Aj).** It used to fire from `animateShields`→`checkThresholds` mid-shatter and overlap the round-win banner. Now `checkThresholds()` QUEUES it (`pendingThreshold`) and `playPreBeats`'s step loop plays it as a standalone beat **immediately after the shield-break beat** (the trigger), clearing `#roundfx` first so it stands alone; `flushThreshold()` covers the reduced-motion path. Verified `threshmon.js`: threshold fires, **0 frames** where `#roundfx` and `#thresholdfx` both show.

### v0.95 changes — ART: raws everywhere, layouts retired (Aj)
- **Layouts (composed card faces / `faces.js`) RETIRED.** They got hard to render with Super forms and we're still balancing. The game now uses the **raw illustrations (`CardArt`) everywhere** — description box (`showCard`), technique flash (`artFlash`), and gallery detail (`openCardDetail`) all switched from `CardFace`→`CardArt`; CSS updated to landscape 3:2 (`.cvBigArt`, `.galFace`). `build.js` no longer inlines `faces.js` (stub `window.CardFace={}`), saving ~435KB.
- **All 40 raws now baked in** (was Cleric+Wizard only). Rebuilt `art.js` from Aj's device folder `~/Downloads/raw/{cleric,fighter,rogue,wizard}` via **`build-art.js`** (`node build-art.js` — resizes to 512w webp q80, ~1.7MB total). Prefix→suit map: **H→♥, F→♣, R→♠, D→♦**, ranks 1-10. J/Q/K transforms have no raws → drawn-card fallback (fine).
- **Sanctuary / Holy Shroud image swap FIXED.** Rework mapping is **9♥ = Holy Shroud (cloak), 10♥ = Sanctuary (dome)**; the old art had them reversed. Aj's renamed files are correct; `build-art.js` skips the stray old-name duplicates still in the folder (`H9 Sanctuary.png`, `H10 Holy Shroud.png`, `D7 Strip.png`). Verified in-game: 9♥ shows the cloak.
- Note: the parked ride/form visual overlap is now largely moot — one-Ride-per-rank means two J's can't coexist anyway; any residual is pure animation overlap.

### v0.94 changes — Rides/Forms zone rework (Aj)
- **Super Forceful Strip → equipment to TOP of deck too (correction).** Base=hand, **Queen=deck-top, Super=deck-top** (plus Super's ride/form-to-hand). Decoupled via a new `eqMode` field (equipment destination) separate from `mode` (zone-target destination), so Super sends equipment to deck-top while still returning a Ride/Form to hand. Verified.
- **One Ride at a time.** Casting a Ride retires any existing Ride(s) to the **Energy pile** (`activate` transform branch: rank 11 clears prior rank-11 forms → energy). Verified.
- **ONE transform per RANK.** A new J/Q/K replaces the existing one of that rank (regardless of suit), retiring the old card to Energy. So the zone holds at most one J, one Q, one K. (Simplified from an earlier per-suit rule — moot under Variant B since any suit powers all suits.) Verified + locked by a test.
- **Form suit-matching — A/B tested, shipped Variant B (Aj's pick).** New toggle `setFormSuitMatch(bool)`. **Default = B (false): any-suit "key"** — a Q/K unlocks its tier for EVERY suit's cards (each card uses its own suit's boost table), and **Super = any Q + any K**. Variant A (true) = same-suit only (Q♦ boosts ♦ only; Super = same-suit Q+K). Sim (`ab-suit.js`): B lifts the weak dual decks — Paladin 43→48% (2p), Sage +5 / Mage Knight +3.7 (3p) — compressing the field; pures single-suit so unaffected directly. Threaded through `effectFor`, `boostInfo`, `hasSuper`. Tests updated (mixed-suit super now valid under B; A re-checked via the toggle). 651 tests.
- **Note:** `ab-suit.js` is the A/B harness (`node ab-suit.js [games] [diff]`).

### v0.92 changes
- **Forceful Strip — Queen (Q♦ Penelope) upgrade reworked (Aj).** Old Queen let it *also return a Ride to hand*; that's weak because J/Q/K recast for FREE. New Queen: it puts the **target Equipment on TOP of its owner's deck** (they must redraw it) instead of into their hand — a real tempo hit. Implemented as `mode:'deckTop'` on `BOOSTS.D.queen[7]` + a `deckTop` branch (`deck.unshift`) in the removeEquip handler. **Super (J+Q+K) is unchanged** — still "return a Ride OR Form to hand," and since Super *supersedes* the Queen patch, equipment at Super still goes to hand. Verified `queencheck.js` (Queen→deck-top, Super→hand); test.js updated (REWORK 4b), now 648.
- **Ride/Form stacking — CONFIRMED behavior (answered Aj).** By design the zone holds *multiple different* transforms (Ride + Q + K = Super, per RIDES-AND-FORMS.md §5). Same transform does NOT double: two Giant Boars = +1, not +2 (`rideValue` uses `.some()`, verified `stackcheck.js`). The J♠-in-a-Pure-Fighter-zone Aj saw is impossible for an all-♣ deck ⇒ **cosmetic overlap** of the human's own J♠ Giant Ram into the Rival panel (still the parked visual bug). **Loose end noted:** the engine does NOT block a 2nd Ride of the same rank (Boar+Ram both J) — their different effects both apply; add a one-Ride-slot rule if that's unwanted.

### v0.91 changes
- **🌐 Play Online button** on the New Duel screen → dialog (Host / Join) that navigates to `?net=rtchost` / `?net=rtcjoin`. Netplay is now discoverable without editing the URL. (`openOnlineDialog`, `#onlineBtn`.)
- **Equipment-strip now weakens the current pile (Aj's call).** `unapplyEquipFromPile(st,q,e)` in engine.js: removing an equipment (Forceful Strip / Disarm / Sabotage / Plead for Peace) subtracts ONLY that equipment's contribution to a pile already on the table — its `.delta` if the pile owner wore it, its `.oppDelta` if an opponent wore it against them. Other locked boosts (Rides like Giant Boar, pre-fight, Giant Swan) stay. Verified `stripcheck.js`: Javelin strip drops a K-pair 15→14 with Giant Boar's +1 intact; simple case 6→5. Wired in the `removeEquip` branch of `resolveEffect`.
- **Still PARKED:** the ride/form visual overlap (J♠ ghost in the Pure-Fighter Rival zone) — see the parked-bug note below; not an engine stack (confirmed: K-pair boost was +2 = Boar+Javelin, not +3).

### 🐞 PARKED BUG (Aj flagged, v0.90) — Rides/Forms effect stacking
Battle log saved: `bug-rideform-stacking-battlelog.txt` (+ two screenshots in the session). Round 9, **Rival = Pure
Fighter**, its Forms & Rides zone shows **J♣ Giant Boar (Ride)** *and* a **J♠** side-by-side. Two concerns: (1) a
**pure Fighter deck is all ♣**, so a **J♠ should not exist** in its cards → likely a rendering artifact (wrong
face/suit drawn, or an opponent card bleeding into the zone); (2) Aj's rule: **you should NOT be able to stack the
effects of multiple Rides/Forms** — need to confirm the engine enforces one active Ride/Form (or the intended cap)
and that the zone render isn't implying a stack that isn't really applied. **Aj said park it for later** — do NOT
fix yet; diagnose engine-vs-visual first (check `forms[]` contents vs what the zone renders).

### Multiplayer — Phase 5-v2: ONLINE NETPLAY (internet P2P, no server) DONE ✅
Cross-machine, 2-player, **WebRTC DataChannel** with **manual copy-paste signaling** — `?net=rtchost&room=CODE`
(host makes an invite code) / `?net=rtcjoin&room=CODE` (paste it, return a reply code, host pastes back →
connected). **No server, no accounts, $0**; codes travel over any chat. Google public STUN for NAT (`&stun=0`
disables for LAN). Transport is pluggable (`{send,setOnMessage,close}`) — BroadcastChannel (same-machine) and
WebRTC (internet) share the same symmetric host-authoritative message layer. Reliability: joiner re-announces
`join` until its first snapshot lands (WebRTC drops pre-open messages). Verified `rtctest.js` 9/9, **6/6 runs**;
shipped game byte-identical, BroadcastChannel netplay still 7/7. **v2 limits/next:** 2 players (WebRTC star for
N-player later); no TURN relay (rare strict-NAT pairs may fail on STUN alone); ~860-char codes (could deflate);
deck picker + pre-fight timing + ornate ceremony still open.

### Multiplayer — Phase 4/5-v1: NETPLAY (human vs human) DONE ✅
Same-machine, 2-player, host-authoritative over **BroadcastChannel**. Launch: open the file twice —
`?net=host&room=CODE` in one tab, `?net=join&room=CODE` in another (works on `file://` and `http://`; validated
`nettest.js`). Host owns the engine and applies **every** seat's intents; both ends render a dedicated netplay
board from `NetView.snapshotFor(state,seat)` (own hand only; opponents = counts — hidden-info boundary, tested)
and submit high-level intents (`play/pass/activate/respond/decline/discard/guard/guardPass`). All additive + gated
behind `?net=`; **shipped single-page game byte-identical without the flag** (647 tests + duel smoke green).
Verified end-to-end by `nettest2.js` (connect, sync, Specials over the wire, interrupts routed to the right seat,
shield loss, knockout, win — 7/7, stable). New files: `netview.js` (+`.test.js`), transport/UI in the template
(`var NET`), harnesses `nettest.js` / `nettest2.js` / `netshot.js`.
**v1 limits (next steps):** 2 players only; pre-fight Quick timing deferred (Quicks still counter activated
effects); round ceremony is a status line, not the ornate animation; host uses the full deck (no picker); same
machine only — LAN (WebSocket) then internet P2P (WebRTC) are the Phase-5 v2/v3 transports (same message schema).
Controller layer (`seatCtrl`/`controllerOf`, `awaitHumanSeat`) is in the template for future AI/remote seat mixing.

### Authoritative card reference
**`CARD-LIST.md`** is the source of truth for live card text — auto-generated from `engine.js` via
`node gen-cardlist.js`. Regenerate it after any card change. The design docs (RIDES-AND-FORMS.md,
Cardmen-Fighter-Design-v0.70.md) are rationale/history and can lag; CARD-LIST.md cannot.

### ⏰ Reminder (Aj)
- **Tutorial / energy:** when we return to the tutorial, remind Aj — he wants to suggest something for the energy (mechanic TBD).
- **Concede button:** DONE (v1.0). The header "New Duel" button becomes "🏳 Concede" (danger tint) during a live duel → confirm → forfeit (opponent wins). Netplay-aware: sends {t:'concede'} so the opponent sees a win. Verified single-player + netplay.

### 🚧 IN PROGRESS — Full single-player UI reuse for netplay (Aj's call: one UI, not two)
Goal: netplay renders the REAL single-player board on BOTH ends so every future UI improvement applies to both.
Architecture (host-authoritative): host runs the real game (`startGame`, real `render()`, real ceremonies) with the
rival's move sourced from the wire via `driveRival()`→`NET.awaitRival()`; client sets `state = NetView.mirrorFor(hostState, seat)`
(redacted, seat-rotated so it's seat 0) and calls the SAME `render()`, with each human handler gated (`NET.isClientActive()`)
to send an intent instead of mutating. `NET.onRender()` (hook at the end of `render()`) broadcasts the mirror after every host render.
- **DONE + tested (core loop):** both ends show the real board (card art, zones, hover-reader, shields); play/beat/pass +
  round resolution with the real ceremony; sync + no errors. `nettest_full.js` (6/6, 163 moves). Single-player byte-identical (654 tests + duel smoke).
- **NEXT stage (interactive windows):** `hostApplyMove` currently handles `play`/`pass` only. Add `activate` (techniques),
  `respond`/`decline` (Counter), `guard`/`guardPass` (shield-guard), `discard` (forced discard), and the client-side modals for
  windows the mirror says are owed to it (drive the existing `openShieldGuardModal`/`promptHumanResponse`/discard-pick, gated to send intents).
- **Stale tests:** `nettest2.js` / `rtctest.js` drove the RETIRED functional board (`#myhand`/`#netactions`) — they now fail by design;
  `nettest_full.js` is the replacement (BC). **`nettest_rtc.js` now covers the WebRTC full-UI path end-to-end** (see v1.0 note). The old `renderNet`/`buildHand` functional board + `applyIntent`/`submit`/`snapshotFor` path is now dead code in `var NET` (kept for the lobby/signaling only) — safe to prune later.

### Multiplayer — Phase 1 (engine core) DONE
The N-player (2–6) engine is in and duel-safe (see `MULTIPLAYER-DESIGN.md`). `newGame({numPlayers})`; `nextPlayer`
skips eliminated; `effectTarget(opts.target)` for singular "the Rival" effects; `SPECIAL_LOSS_MODE` (`all`|`chosen`)
+ `MILL_SCOPE` (`universal`|`targeted`) toggles (setters exported; both no-op at 2p) + `setShieldTargetChooser`;
Fighter Kick → elimination + `player.kicksLanded` (hidden stat, future Assassin) + last-Rider-standing;
deckout → elimination in N-player. **Duel byte-identical** — 639 tests (10 new MP); 30×3p + 20×6p full AI games
crash-free.

### Multiplayer — Phase 2 (AI targeting + response) DONE
Tiered `AI.chooseTarget(st,p,diff)`: Minion 80% random/20% grudge; Fighter kill-secure(≤1) > 1 grudge/game >
leader-focus; Demon finisher>grudge>random. Wired into hostile casts (`opts.target`) + the round-win chosen-mode
strip (`setShieldTargetChooser`, reads `st._diff[winner]`). Grudge = `player.lastAttacker` (set on hostile hits +
shield loss). Response windows now offer **every** living opponent priority in seat order (per-object `passed`
set; new Quick resets it) — non-adjacent seats can Counter. Duel unchanged; 647 tests (8 new); 3p/6p/mixed AI
games crash-free.

### Multiplayer — Phase 3 (UI) DONE — v0.88, PLAYABLE
Setup picks **2–6 players** (`#setPlayers`). 3–6 shows a compact opponent strip (`#opponents`/`renderOpponents`)
in seat order with per-opponent shields/energy/hand/deck/equip/forms/Super/turn-glow/OUT. `render()` branches so
the **duel is byte-identical**; MP hides the single `#rival` panel. `runOpponents()` drives all AI seats (reusing
the round ceremony + shield-guard modal + response/pre-fight prompts via a `resumeRival`→MP branch). Human
**target picker**: singular hostile casts → "tap a rival" (opponent panels clickable → `opts.target`). MP-aware
labels + win overlay (last Rider standing). 647 tests + duel smoke pass; 3–6p verified in-browser (render +
150-turn error-free play). **Deferred polish:** per-opponent shatter FX, richer per-seat beats, hotseat
human-vs-human. **Next: Phase 4 = polish + hotseat; Phase 5 = netplay (LAN → internet P2P).**
**Phase 3 hotfix:** MP loop now handles a rival forcing YOU to discard (`promptHumanDiscard` in `runOpponents`) —
previously an opponent's Outbalance/Telekinesis targeting the human hung the game. Also per-opponent class+strength
pickers in setup (`#oppList`), and hardened battle-log auto-scroll (wider stick threshold + rAF). 5/5 UI games
finish clean.

### Recent changes (v0.87)
- **Worn-out equipment retires to Energy.** When a decaying equip runs out of counters (or Holy Shroud spends
  its last absorb), its card now goes to the owner's **Energy pile** instead of vanishing (`retireEquip` in
  engine; wired into the round-tick decay, `useEquipment`, and `absorbSaved`). Consistent with the game's
  "spent cards become energy" cycle.
- **Equip counter rebalance (the duration lever).** Decaying equips dropped from a flat 5: **Fighter/Rogue → 3**
  (Hero's Javelin, Spiked Armor, Caltrops), **Cleric/Wizard → 4** (Holy Bow, Cursed Pendant). Holy Shroud
  (non-decaying, `decay:false`) untouched. Each equip's `text` now states its duration; the UI already renders
  live ◆ counters on the board, and `CARD-LIST.md` now surfaces the count. *(Counters were always in the engine
  as a balance lever — they just weren't in the docs because the generator pulled only the card `text`, which
  didn't mention them. Fixed.)*

### Recent changes (v0.86)
- **Broadway pitch cost.** **Ultima Attack** (C10) and **Armor Piercing** (C7) now carry an extra activation
  cost: `pitchHigh: true` → you must also **discard a Broadway card (10, J, Q, K, or A)** from hand, which goes
  to the Discard pile (recoverable only via Hippolyta's reclaim-Discard). Engine auto-pitches the least valuable
  (lowest 10 first); UI greys the button if you hold none; AI only casts these when it has a spare Broadway.
  Result: Pure Fighter ~61% → **~58%** (Ultima 57.9→53, Armor Piercing 56.8→51) — the biggest single move on
  Fighter so far.
- **Fighter 5↔6 swap.** Superior Training moved to **rank 5** (cost 5) and re-tuned to dig 3 (look 3, 2→Energy,
  draw 1); **Hero's Javelin** moved to **rank 6** (cost 6). Costs follow rank automatically; the Meleager King
  boost (Javelin +2) moved with it to rank 6. Effect: Javelin's castRate dropped 0.93→~0.78 (pricier to deploy).
- **Back to the Books (D6)** draw 3 → a **dig** (look 3, 1→Energy, keep 2). Was the best non-Fighter card at
  ~54.6%; now ~50.9%. "Broadway" = the game's name for the {10,J,Q,K,A} high-card set (`BROADWAY` const in engine).
- *(Also fixed a latent AI bug: the Sanctuary "don't revive an opponent at 0" guard read `card.shieldAll`
  instead of `effectOf(card).shieldAll`, so it never fired — now uses effectOf.)*

### Recent changes (v0.85)
- **Threshold ceremony + glow.** Transform tiers unlock on total table shields lost and announce center-stage:
  **ROAR** (J, 2 lost in a duel) → **OVERDRIVE** (Q, 4) → **REDLINE** (K, 6). J/Q/K in hand pulse **gold** when
  they can actually be transformed (tier fresh + gate met). Code: `THRESHOLD_TIERS`, `checkThresholds()`,
  `showThreshold()`, `#thresholdfx`; glow via `markTransform()` + `.transformReady` in the template.
- **Sanctuary nerf (H10).** Now `shieldAll: true` — **every** player gains 1 shield (a wash on the race, so it's
  a real decision, not a free-value reflex). Apollo Super's shield-lock stays caster-only. AI won't cast it when
  it would revive an opponent at 0. Pure Cleric fell ~65% → ~48–50%.
- **Fighter/Rogue draw-spell rework.** Fighter #6 Discombobulate → **Superior Training** (dig 4, 3→Energy, draw 1);
  **Instant Recovery** base draw 2→1; **Ares Wheel** draw 10→6. Rogue #6 **Never Out of Options** dig 4/draw 2 →
  dig 3/draw 1.
- **Fighter balance finding (measured, 4k-game harness).** Fighter is over-tuned (~60–62% vs the whole field) but
  **not because of equipment** — zeroing both Fighter equips cost only ~2.6pts. No single subsystem is the driver;
  the kit is **redundant** (draw + persistent equip value + shield finishers each substitute for the others).
  Removing all three together drops it below 50%. Fighter also out-draws every class ~4.5×. **Nerfing equipment
  durations won't work.** The real lever is the **Instant Recovery reclaim engine** (shuffle-back = deck-out
  insurance no one else has). The draw-spell pass above did NOT dent Fighter (Superior Training re-added draw);
  next real move is cutting/gating the reclaim.

### Transform economy (data-driven, v0.84) — FREE · DRAW 1 · TABLE-GATED
Transforming a J/Q/K is now **free** (no energy), **draws 1** (the "refund" that pays back the spent fight
card — the real cost was always giving up a value-11–13 card, not energy), and is **table-gated**: unlocks
when TOTAL shields lost across the table ≥ players × tier (duel: J@2, Q@4, K@6). This lands transformer-vs-
non-transformer at ~50% (a real choice, not a trap or a no-brainer) with the first transform ~round 5–6.
Tunable via `E.setTransformCost/Draw/Gate` + `E.setBoostScale` (all default to the shipped values).
**Key finding:** boost *magnitude* is NOT the lever — 3× the Form boosts moved win-rate by 0.1 pts. The draw
(card economy) is what makes transforming viable; the boosts are flavor/marginal. Aj will add per-Form draw
differences later (draw 1 is the base for all). Analysis hooks in ai.js: `setTransformPolicy`, `setEffectPolicy`,
`setKindBlock` (all default off) for A/B testing.

**⚠ Balance note:** the free+draw economy *widened* the deck spread — Pure Cleric rose to ~65% and Pure
Wizard fell to ~44% (`analysis.js 200 on off rework`). The draw-1 faucet compounds for card-hungry decks
(Cleric/Fighter) and does little for Wizard's tempo. This reinforces that **Cleric/Sanctuary is the next
tuning target** (see below).

---

## ◻ OPEN

### ★ REWORK — the 2-as-apex + Kamen-Rider Forms layer (SHIPPED / LIVE)
The parked STOPPER reframe became the **live game** (design: `RIDES-AND-FORMS.md`; original plan:
`BUILD-PLAN-v0.82.md`; shipped card text: `CARD-LIST.md`; the full narrative: `REWORK-HISTORY.md`).
Ladder is `3 4 5 6 7 8 9 10 J Q K A 2` (52 cards); STOPPER retired (the apex 2 wins by value); A keeps its
old rank-1 effect at cost 1; J/Q/K transform (**free · draw 1 · table-gated**) into the **Forms & Rides
Zone** and empower your cards; any J+Q+K = **Super Mode**. All Form/Super boosts, all four Rides
(Boar/Swan/Owl/Ram), reactive Quick-casting, zone removal, the upgrade-ladder card text, the transform-tier
ceremony (ROAR/OVERDRIVE/REDLINE) + gold glow, and AI transform logic are in and tested. **Default-ON; the
playtest toggle is gone.**

**Still to do on the rework:**
- **Phantasmal Illusion +value** (Odysseus) — DONE (implemented + tested); the AI still rarely casts Phantasmal.
- **Per-Form draw differences** — Aj to add later (draw 1 is the base for all Forms).
- **Variation to try:** Forms *expire once their boost is used* (Aj's idea) instead of persisting — still parked.
- **Art:** Fighter ♣ / Rogue ♠ faces are still placeholders (see Art section below); apex-2 / A face art too.

**Balance status** — see "Recent changes (v0.85)" up top for the current picture. In short: Cleric retuned to
~48–50% (Sanctuary made symmetric), **Fighter over-tuned ~60%** (redundancy finding — the Instant Recovery
reclaim engine is the open lever, NOT equipment durations), Wizard low ~44–45%. Re-measure with
`analysis.js 130 on x rework`. *(The old v0.7x snapshot that used to live here — Cleric #1 62.8%, Fighter
"fixed" at 51.8% — is superseded; that history is in `REWORK-HISTORY.md`.)*

### ★ PARKED — "Rival: Aj" signature AI (AFTER balance + cards are done)
A selectable rival that plays like Aj, so people can duel "him" offline. The playstyle profile is already the
spec (from the v0.14–v0.67 log analysis): **tempo aggressor** — specials over jabs (~6.5:3.8), digs with draw
techniques then unloads in a burst, escalates and commits inside exchanges, **races to 0 shields without
flinching** (often wins at 0 himself), light on equipment, high variance. **Signature tell:** spends STOPPERs
*aggressively for initiative — including on JABS* (games 3/5/10/11/12), which no current tier does (the AI only
stoppers shield-threatening specials, need≥2). Implementation: it's a new personality knob-set in ai.js
alongside minion/fighter/demon — crank stopper-aggression (allow 1-STOPPER jab cancels to seize tempo), bias
to specials + escalation, dig-and-dump card usage, no defensive shield-hoarding, minimal equip. Expose as a
selectable opponent. Gated on the card set + balance being final so the personality tunes against real numbers.

### Art — Fighter ♣ + Rogue ♠ (the main pending item)
Wizard ♦ and Cleric ♥ are fully arted; Fighter and Rogue still fall back to the drawn rank/suit card
everywhere (hand thumbnails, Card Codex, description panel, activation flash). Two pipelines feed them,
both already wired — just drop in the images and rebuild:
- **Card faces** (hand + Codex + description): full card-layout PNGs → `layout/fighter` + `layout/rogue`
  → PIL resize 240px WebP q78 → extend the **faces.js** generator (`C1…`, `S1…`) → rebuild.
- **Illustration crops** (the center-stage activation flash): raws → `raw/fighter` + `raw/rogue`
  → PIL resize 460px WebP q80 → extend the **art.js** generator → rebuild.
Once added, every view swaps from the placeholder to the real art automatically — no code changes.
(At 40 arted cards the inlined build lands ≈1.9MB; fine, but external art files are an option if it feels heavy.)

### Playtest confirmations (judge on real hardware)
- **Mobile touch-drag feel** — pointer events cover touch, but the feel on a real phone hasn't been hand-checked.
- **Effect-reading on grouped combos** — a group shows its combo label; double-tap to break it and read a
  single card's effect. User flagged this as the tricky part — confirm it feels OK in real play.

### Balance (not urgent — meta is healthy, 45–56% across all 11 decks; see PATCHNOTES.md)
- **Forceful Strip ~38%** — weakest single card after the v0.40 rotation; candidate for a small buff.
- **Wizard's ramp payoff** — Gather Energy casts ~0.86/game but Wizard wins ~48%; the deck banks energy
  without converting it. Strategic gap (needs a better payoff for hoarded energy), not a number tweak.

### Optional / if-wanted
- **Generalize the pre-fight window** — it's live but gated to Back Stab (the only Quick that wants that
  timing). Widening `preFightHolder` in engine.js opens it for any Quick (matches the §7 design), but would
  prompt the human more often — do it only if another Quick gains a real proactive use.
- **Back Stab reactive timing** — ✅ done in v0.76 (now a Quick + the non-active pre-fight window).

---

## ✓ SHIPPED (newest first)

- **v0.82 — Fighter Kick vs prevention at 0 shields (rules fix) + energy spacing.** Playtest surfaced that
  Leyline prevented the *kick* at 0 shields — where there's no shield to save. New ruling (Aj's call): at 0
  shields, the kick lands UNLESS the effect prevents *losing the round*, not just *losing a shield*. So
  `resolveShieldLossObj` now splits the branches — shields>0 uses any protection; at 0 (the kick) only
  `cantLoseRound` (Leyline, new `cantLose:true` flag + retext "you can't lose this round") or a **Holy Shroud
  counter** (`absorbSaved`, spends a counter — a physical block) survives it. Flat shield-immunity (**Sphere**,
  `shieldImmune`) no longer saves you at 0. `wouldBeSaved`/`shieldGuardCard`/`driveShieldStack` are 0-shield
  aware so the reactive guard window still opens vs the kick when you hold Leyline. Also fixed the prevented
  message's hard-coded "(Legendary Armor)" → generic. **Card text/images: Aj will update Leyline + Holy Shroud
  themselves** (engine text is a placeholder). +6 tests (Sphere kicked / Leyline & Holy Shroud survive /
  reactive-Leyline window) → **554/0**. Energy readout: dropped the redundant `.nrgBox margin-left` so `⚡`
  hugs the box (the `.stat` flex gap already spaces it).
- **v0.81 — energy readout as one box + ⏩ Quick badge on cards.** (1) The status energy went from
  `N⚡ [suit chips]` to `⚡ [ suit chips ]` — the redundant total is gone (it was just the sum of the chips);
  now a single `.nrgBox` holds the per-suit counts after a `⚡` label (`energyChips` shows a dim `0` when
  empty; the breakdown tooltip moved to the box). Removed `#youNrg`/`#rivalNrg` and their setters. (2) A
  `⏩` badge (`.qbadge`, top-right, `--cs`-scaled) now marks every **Quick** card in hand/Codex/description,
  driven by `effectOf(card).quick` in `cardEl` — so you can see at a glance which cards are playable in
  response. Rules-modal legend updated. Verified: badge on Quick cards only (Counter Spell/Leyline/
  Hand-to-Hand yes, a plain card no); energy box renders the breakdown with the total removed.
- **v0.80 — peek fixes: the "↩ Back" pill was unclickable + action buttons live during peek.** Lifting the
  description panel to `z-index:35` (v0.79) trapped the Back pill — it lived *inside* the overlay (a
  `z-index:30` stacking context), so its z-index only ordered it within the overlay, and the raised panel
  painted over it. Fixed by appending `#peekBar` to `<body>` (root stacking context) at `z-index:60`, so it
  beats the lifted panels. Also the `#actions` row (Sort/Clear/Pass/Fight/Activate) was still clickable while
  peeking (Sort reordered the hand) — now `body.peeking-board #actions{pointer-events:none;opacity:.4}` plus a
  `peeking` guard in `flipSort`. Verified: Back is the topmost element at its center and restores the modal;
  Sort no longer reorders during peek.
- **v0.79 — peek is now interactive for review (log + hand inspection).** The v0.78 peek locked the whole
  board (safe, but you couldn't read the Battle Log or your cards). Now, while peeking, the **log**, **hand**,
  and **description panel** lift above the overlay (`body.peeking-board` → `z-index:35`; the hand's
  `pointer-events` is re-enabled even at game over). You can expand/scroll the log and hover/click a card to
  read its effect in the side panel — **inspect-only**: `onGroupClick` shows the card then returns when
  `peeking` (never selects), drag is blocked (`onPointerDown`), and every commit path is guarded
  (`doFight`/`doPass`/`onActivateClick`/`onCtxClick` bail on `peeking`). `↩ Back` restores the modal with no
  stale selection. Verified: log toggle works during peek; clicking a card shows its effect with 0 cards
  selected; Back round-trips.
- **v0.78 — "Peek at the table" + inline decision context + review-after-game.** Decision modals were
  opaque — you couldn't re-check the Rival's play or your energy while deciding. Now:
  - **Inline context box** (`tableContextHTML`) on the shield-guard, Respond, and pre-fight modals: shows
    the current play on the table (pile combo + cards) and your energy (total ⚡ + per-suit breakdown), so
    the basics are right there without dismissing anything.
  - **👁 Peek at the table** button (`enterPeek`/`exitPeek`) on those modals AND the game-over modal
    ("👁 Review the board & log"). It hides the modal but keeps the overlay on top (transparent bg,
    `.overlay.peeking`), so the board/log are visible but non-interactive; a floating "↩ Back" pill
    (`#peekBar`) restores the modal. `hideOverlay` clears the peek state defensively; taps on the exposed
    backdrop are inert while peeking (`overlayDismiss` saved/nulled).
  - Confirmed the engine already gates every Quick/guard window on `canAfford` — you're **never** offered or
    allowed to spring a Quick you can't pay for, so the guard prompt only appears when you can actually afford
    it. (No bug; just surfaced the energy so it's visible.)
  - Verified via seams: context box + peek on a decision modal, and the game-over review peek round-trip.
- **v0.77 — fix: opening Help mid-duel abandoned the game.** The header `?` (`#helpBtn`) handler passed the
  click **event** as `showHelp`'s `fromSetup` arg — always truthy — so closing Help always ran `openSetup()`,
  dumping you to the New Duel screen and killing the in-progress duel. Now `helpBtn` calls
  `showHelp(!(state && !state.finished))`: mid-duel → `fromSetup=false` (close/click-outside = `hideOverlay`,
  resumes the duel, button reads "Got it"); pre-game or finished → back to setup. `overlayDismiss` now mirrors
  the close action in both contexts. Verified in the live UI (hand intact after close, no dump to setup).
- **v0.76 — Back Stab is now a reactive Quick + the pre-fight priority window.** Two phases, one ship:
  - **Phase 1 — Back Stab (♠10) → Quick, skip-one-turn.** `quick:true`; the lockout no longer lasts the
    whole round — it makes the target **skip their next turn** (engine `lockSkip` flag on the player,
    replacing `lockedRound`; `isLocked` reads it; spent/cleared when that locked turn passes, in `pass()`).
    It does **not** counter: an in-flight Technique on the stack still resolves, then the lock lands on the
    target's *next* plays. Reactive via the existing response window (spring it when they cast a Technique).
  - **Phase 2 — the non-active pre-fight window.** New engine API `openPreFight` / `preFightCast` /
    `preFightPass` + `st.preFightQ` / `st.preFightHandled` (one window per active-player fight; survives UI
    suspend/resume; reset on turn advance in `play`/`pass`/`resolveRoundWin`). Before the active player's
    Play Sub-Phase, the **non-active** player may spring a Quick (gated to Back Stab — widen `preFightHolder`
    to open it for any Quick). The sprung Quick goes on the stack so the active player can still Counter it.
    If it resolves, the active player is locked → their fight is a forced skip → initiative passes.
  - **AI:** retired the old proactive playPhase lockout; `takeTurn` now runs the non-active pre-fight window
    (springs Back Stab to deny an opening lead — `aiPreFightLock`: `!pile && round≥2 && hasCombo`), and the
    active player force-skips if locked. `AI.preFightMove` exposes the decision for the UI.
  - **UI:** Case A (you Back Stab the Rival) — `promptHumanPreFight` modal in `runRival` when the Rival is
    about to fight and you hold Back Stab; Case B (Rival Back Stabs you) — `rivalPreFightThen` wraps
    `doFight`/`doPass`, synchronous unless the Rival actually springs it. Both reuse `settleWindows` so the
    Back Stab can itself be Countered. Both directions verified end-to-end in the live UI via a seam.
  - Tests: +6 (Back Stab-as-quick, skip-one-turn, reactive-doesn't-counter, pre-fight open/cast/lock/skip,
    one-shot guard). **548/0**, headless 400-game sanity clean, browser smoke green.
- **v0.75 — catch-up mechanics M1 + M2 (anti-snowball).** Two engine flags, both defaulted OFF (headless
  test/analysis unchanged, still 531 baseline) and both turned ON in the UI init:
  - **M1 `setShieldCards` — shields are cards.** Setup deals `START_SHIELDS` cards from the deck into a
    `shieldPile`; a broken shield returns its card to the owner's **hand** (`resolveShieldLossObj`), a gained
    shield pulls a fresh card into the pile (`case 'shield'`). So the trailing player refuels as they lose.
  - **M2 `setLoserMill` — loser mills to energy.** In `resolveRoundWin`, each loser mills cards from deck →
    Energy Pile equal to the **winning play's size**, restoring the energy the winner banked by making them
    pass. Guardrail: `LOSER_MILL_RESERVE = 4` — never mills below 4 cards of draw runway, so catch-up can't
    deck the loser out (sims: **0% deck-outs**). Per-round mill counts ride on `result.milled` for the UI.
  - **UI:** `logCatchUp()` surfaces both (broken shield → hand; loser mills N → Energy), skipped on a Kick;
    a new rules-modal bullet explains it to playtesters. Shields still render as 4 pips (visualizing them as
    face-down cards is optional future polish).
  - **Why combined:** sims (`snowball.js`) showed M1+M2 together cut the 3+ shield-loss-streak rate from
    **69.6% → 54.5%** (biggest anti-snowball move), kept M1's close finishes (winner margin 0.97 → 0.70,
    photo-finishes 40% → ~49%), added only ~+0.5 rounds, and never distorted balance (~50/50). +9 tests (540/0).
  - **Tuning knob:** `LOSER_MILL_RESERVE` in engine.js. To A/B or revert, flip the two `set…` calls in the
    template init. `snowball.js [N] [base|shieldcards|mill|both|all]` re-measures any time.
- **v0.74 — adaptive card sizing + Critical-Hit-at-0-shields fix.** Two things: (1) Playing cards now
  scale up on large monitors. A `--cs` (card-scale) CSS variable on `:root` steps up at 1200/1600/2000/2560px
  breakpoints (1 → 1.18 → 1.42 → 1.68 → 1.9); every card dimension, inner font, index chip, effect icon,
  and the combo-overlap margin is `calc(...*var(--cs))`, so cards grow proportionally from 46×66 up to
  ~87×125 on a 2560px screen (base still tuned for laptops/tablets; ≤1199px unchanged). Arted `.faced`
  cards are background-images so they scale for free; drawn ♣/♠ placeholders scale via the same var.
  (2) The AI (and the engine's response window) no longer fires a destroyShield — Critical Hit ♠9 /
  Ultima Attack ♣10 — at a Rival already sitting at 0 shields: `ai.js` guard is now `opp.shields>=1 && <=2`,
  and `engine.js` `openResponseWindow` skips opening a guard window for a destroyShield whose target has
  0 shields (it's a pure no-op, so there's no shield to save and nothing to counter). +4 tests (now 531/0).
- **v0.73 — "Go first" / "Go second" on the New Duel screen.** Two ghost buttons now flank "Roll for
  initiative" (`.rollRow`): pick who leads Round 1 and skip the dice. Extracted `commitSetup()` (shared
  deck/difficulty lock-in + control disabling) from `beginRoll`; new `chooseStart(starter)` commits and goes
  straight to `startGame(YOU|RIVAL)`. Also made `startGame`'s initiative log line neutral ("You/​Rival have
  the initiative — Round 1, jabs only") so it reads right for both the rolled and chosen paths.
- **v0.72 — STOPPER now has a visible cue.** A committed STOPPER (either side) previously only wrote a log
  line + a transient message — no flash, no announcement (and even a card flash would've been blank for the
  un-arted ♠/♣ suits). Added an art-independent center-stage `stopperFlash` — a bold "🛑 STOPPER ×N" with a
  glow (red = Rival, cyan = You) and a "cancels the Pair/Trio" subtitle, ~1.2s. Wired into the Rival's
  stopper beat and both human commit paths. Reduced-motion skips it (log/message still convey it).
- **v0.71 — round announcement fleshed out (no longer a mockup).** Fixed the floating white card — the
  Round-N element had a class literally named `card`, colliding with the global `.card` playing-card style;
  renamed to `rfCard`. Added a **dimmed/blurred backdrop** behind the ceremony (radial vignette over the
  play area) so beats no longer clash with board text, and restyled the beats to match the shield-loss
  banner — cyan (you) / red (rival) glow labels that pop in, and a gold "ROUND N" plate with an
  uppercase subtitle under a gold divider. Timing knobs unchanged (`ROUND_BEAT` 750 / `ROUND_HOLD` 1350).
- **v0.70 — ONE Clean-up per round (not per turn), for both players.** Removed the AI's four per-turn
  `discardToLimit` calls (ai.js) and the human's per-play-turn trim (`endTurnDiscardThen` deleted;
  callers → `afterHumanAction`). Hand-limit is now enforced only at the round's Clean-up: engine
  `finishRoundWin` auto-trims every hand before the draw in headless; the UI's `endOfRoundTrimThen`
  auto-trims the Rival and prompts the human. So a hand may exceed MAX_HAND *during* a round (via draw
  effects / the +2 draw) and is trimmed once at round-end. Verified headless: hands reach 12, no per-turn
  trim, every round boundary bounded, 541 rounds/40 games all terminate; 527 tests + smoke green.
  (Matches the reviewed Round Anatomy: Clean-up Phase = both discard to hand size, no priority.)
- **v0.69 — hand-limit trim moved to end of round (before the draw).** The round draw is now deferred: engine
  splits `finishRoundWin` (resolve trick, advance round, fade temps — no draw) from `roundDraw(st,result)`
  (draws + deck-out), gated by `E.setDeferRoundDraw(true)` which the UI sets (headless AI-vs-AI leaves it
  false, so `play`/`pass` stay self-contained → 527 tests unchanged). New flow in `resolveRoundCeremony`:
  win → (shield) → seize beats → **end-of-round hand-limit trim** (pick UI if over MAX_HAND, discards→energy)
  → **Round banner appears (round start)** → **then the new cards fly in** (draw held ~340ms behind the
  banner via `enterDelayBase`). Verified: at the trim the Round card isn't showing and the deck hasn't drawn;
  after the pitch, energy +2 then deck −2, then banner + fly-in. You may hold up to MAX_HAND+2 during a round.
- **v0.68 — discards go to the Energy pile.** Rule: the shuffle pile is only for *spent* energy (or where a
  card's text explicitly says shuffle — Counter Spell, Plead for Peace). All discards now go to Energy so
  the cards stay usable as fuel: `discardChosen` (Outbalance/Telekinesis/Discombobulate + Never Out of
  Options) and `discardToLimit` (end-of-turn hand cap) both push to `pl.energy`. Never Out of Options
  reworded "…into your Energy Pile"; UI discard messages updated; 4 tests updated. This also softens Rogue's
  disruption (forced discards now hand the victim energy) — a likely lever on Rogue being over-tuned.
- **v0.67 — AI Counterfeit fix + battle-log scrolling.** AI: `counterfeitHelps` now only casts Counterfeit
  when copying a card from the Rival's play produces a combo that actually BEATS the pile (via
  `enumerateCombos`+`applyEquip`+`beats`, factoring equipment and a charged `nextPlayBoost`) — previously it
  fired on any rank match, so it wasted the card copying a 4 vs a pair of 4s (only a tie). Verified: no cast
  on a pair without a boost; does cast with a +2 boost or to complete a higher full house. Log: entries
  auto-stick to the newest only when you're already at the bottom (reading history no longer yanks you
  down); expanding the collapsed log jumps to the newest; a gold "↓ New" button appears when you've scrolled
  up and jumps back.
- **v0.66 — ceremony sync fix.** The consequences now land on their beats: removed two premature `render()`
  calls before `finishStep` (they were consuming the drawn-card deal-in early, so cards appeared with the
  shield instead of on the Round card). Added `holdShields` to defer the shield shatter to the "loses a
  shield" beat (revealed on the beat, on skip, or under reduced motion). Verified with a real transition:
  hand grows 6→8 on the Round card, not before.
- **v0.65 — round-announcement ceremony (FIRST PASS — timing to tune).** Center-stage beats on each round
  resolve via `playRoundCeremony`/`buildRoundBeats` over a new `#roundfx` layer: jab = win → seize (2 beats);
  special = win → loser loses a shield → seize (3 beats); then a big gold "Round N" card with a subtitle
  (R1 "Jabs only", R2 "Specials unlocked!", R3+ "Each player draws 2 cards", or "Deck empty…" on a fizzle).
  Round 1 gets the card at duel start. The two freshly-drawn cards' deal-in is delayed (`enterDelayBase`,
  synced off `roundPreDelay`) so they arrive on the Round card. Gates the next actor (no rival acting mid-
  ceremony). Terminal rounds (Fighter Kick / deck-out) skip it and finish on the win. Reduced-motion skips
  the banner; tap the banner to skip. **Tuning knobs:** `ROUND_BEAT` (750ms/beat) and `ROUND_HOLD` (1350ms
  card) near the top of the template — adjust to taste after playtest.
- **v0.64 — New Duel confirmation mid-game.** Clicking the header "New Duel" during an in-progress duel
  (`state && !state.finished`) now pops a confirm ("Start a new duel? … will abandon it") with Cancel /
  Start new duel; Cancel or click-outside returns to the running duel untouched. Before a game or after
  it's finished, it still opens setup directly (no needless prompt).
- **v0.63 — New Duel picks remembered + reset.** The setup screen restores your last Your-class /
  Opponent-strength / Opponent-class picks from this device (`cmf_setup_v1` localStorage), saved on change
  and on roll. A subtle "↺ Reset to defaults" link (right-aligned under the selects) appears only when the
  picks differ from the defaults (random / random / Fighter) and one-click reverts them. Validated on load
  so a stale/edited value falls back to the default.
- **v0.62 — tutorial entry point + full "Cardmen Fighter" rename.** "📖 How to play" ghost button beside
  "Browse all cards" on the New Duel screen, opening the existing rules modal; auto-opens once on the
  first-ever visit (`cmf_seen_help_v1` localStorage flag), returns to setup on close/backdrop. Renamed
  everything from the old "Kamen"/"CardMen" to **Cardmen** (small m): display title/log/rules, the build
  files (`CardmenFighter.html` / `.template.html`), code globals (`CardmenEngine`/`CardmenAI`), and the
  docs (incl. `Cardmen-Fighter-Design-v0.70.md`). Fixed a stale "Bishop"→"Sage" deck name in the rules. Retired
  the old v0.11 `CardMenFighter.html`.
- **v0.61 — equipment reads from your seat.** On-board equipment text is now viewer-relative (the Rival's
  Holy Sword says "Rival's highest +2", their Caltrops "Your highest −2"), and tiles color by benefit —
  your gear green, the Rival's red — since every equip helps its owner.
- **v0.60 — Card Codex + effect icons.** "Browse all cards" button on the New Duel screen (muted, under
  Roll for initiative) opens a gallery: default = all 40 unique cards; class-filter chips narrow to a
  suit's 10 cards with a **×4** deck-multiple badge; tap a card for its full face + rules text. Click
  outside to dismiss (preview → grid → setup); the setup modal itself is not click-outside dismissible.
  Also: the inline-SVG effect-icon system on card bottom-left (base glyph + green +/red − direction badge,
  multiple chips per card) — Leyline = recycle + blue shield, Armor Piercing reads as a Shield−, etc.
- **v0.59 — real card faces on hand + description** (Cleric ♥ + Wizard ♦, 20 cards) via faces.js + the
  `__FACES__` build placeholder. Description = full card layout (desktop) / raw art (mobile); hand = raw
  art + legible corner index.
- **v0.54–0.58 — the true recursive priority stack** (see **STACK-DESIGN-v0.53.md**, fully implemented).
  Techniques/Quicks are stack objects on one `st.stack` + priority driver; Counter-a-Counter works; the
  response prompt offers all eligible quicks; destroyShield answered via the response window (Leyline as a
  response, no double-prompt); visible stack view; AI drains its windows recursively. Value-altering
  effects are technique-speed (not quick); quicks = Leyline, Armor Piercing, Hand-to-Hand Mastery.
- **v0.52–0.53 — card-art activation flash** (art.js + `__ART__`), plus log/glow fixes (rival boost shown
  in log; boost/reduce pile glow) and card names/wording copied from Aj's laid-out cards.
- **v0.50–0.51 — drag-to-play + drag-to-group** and the reactive shield-guard window (spring Leyline to go
  immune). Layout reflow (log-left · table · description-right; hand full-width). One context-aware
  Activate/Stopper/Phantasm button with grey-out reasons. Description panel moved beside the hand with
  Activate under the card image. Sort now works during a forced discard.
- **v0.31–0.49 — all 40 effects live**, player-choice discards, smarter AI, multi-STOPPER prompt,
  suit swap (♦ Wizard · ♥ Cleric · ♣ Fighter · ♠ Rogue), and the balance pass documented in PATCHNOTES.md.

---

## Reference
- **CARD-LIST.md** — authoritative live card list (auto-generated: `node gen-cardlist.js`). Start here.
- **CARD-STATS.md** — latest per-card + per-deck balance snapshot (incl. Rides/Forms). Regenerate: `node analysis.js 120 on x rework`.
- **MULTIPLAYER-DESIGN.md** — design for the next big updates: N-player (3–6) multiplayer + networked play. Decisions locked; build order is engine-first, netcode second.
- **REWORK-HISTORY.md** — narrative of the v0.70→v0.85 rework (why the decisions were made).
- **PATCHNOTES.md** — balance design principles + patch log + snapshots. Read before any
  balance change. Re-measure with `node analysis.js 130 on x rework` (run `node test.js` green first).
- **RIDES-AND-FORMS.md** — design/rationale for the J/Q/K Forms layer.
- **Historical (version-frozen):** STACK-DESIGN-v0.53.md (priority stack), Cardmen-Fighter-Design-v0.70.md
  (classic ruleset), BUILD-PLAN-v0.82.md (rework build plan). **README.md** — project overview.
- Card faces/art raws live in the user's `Downloads/layout/{cleric,wizard}` (+ `fighter`/`rogue` when they arrive).
