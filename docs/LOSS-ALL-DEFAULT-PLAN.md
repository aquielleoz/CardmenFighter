# The `loss=all` package as the default — inventory (2026-10-22)

**What this is.** The inventory taken before building Aj's 2026-10-22 ruling: the measured `loss=all` package
becomes the rules of EVERY game, 2 to 6 players, solo and online. It lists every site, lesson, suite, sim and doc
that moves, the card text and rules rows to approve, the questions for Aj, and the build order. It is a
measurement of `main` at `3db7701` (v1.35.2); re-check anything here before building on it.
The evidence for the package is [`DECISIONS.md#loss-all-remeasured`](DECISIONS.md#loss-all-remeasured) and is not
repeated here.

**BUILT ON `epic/loss-all-default`** (2026-10-22, Aj: an epic, ticking the fourth version number per merge): the
build order below is its first merge, v1.35.2.1, and the Holy Shroud ability (Aj, the same day) its second. It lands on
`main` as v1.36.0. Where the build went beyond this inventory, the changelog entry at the end of this file says so.

**Aj's rulings (2026-10-22).**
- The package: `lossall` + `wardall` + shields 2 + players (`shp`) + `damageall`.
- The default for every game, duels included: *"it must apply even to duels. i do not want to print different
  wordings for the same card when the game changes from duel to multi"*. Each card gets one text, true at every
  table size; in a duel "every Rival" is your one Rival.
- No AI tuning in this work. The parked `ai-answers-others-casts` entry follows after shipping.
- Card tweaks beyond what the package needs come later.

## What changes for a player

| | duel | 3-6 players |
| --- | --- | --- |
| A Special win | strikes your one Rival (as now) | strikes **every** Rival, not one the winner picks |
| Starting shields | 4 (as now) | **2 + players**: 5 / 6 / 7 / 8 |
| Leyline Ascension | **nobody** loses a shield this round, you or your Rival | nobody at the table loses a shield this round |
| Holy Shroud | eats the next shield loss **either** player would take, the struck player's own Shroud first | the same, for anyone at the table |
| Sanctuary under Apollo | nobody loses a shield until end of round | the same, table-wide |
| Critical Hit, Ultima Attack | hit your one Rival (as now), cast on the tap: today you tap the Rival first | hit **every** Rival; no target to pick |

So a duel's rules change only through the three ward cards, which the study measured (about 1 duel in 18 flips;
Pure Wizard about −3, the attack decks about +2), plus one fewer tap for the two attack cards. Everything else is a
3-6 player change.

**The sharpest duel consequence, as a scenario.** You hold Holy Shroud (1 counter) on your side of the table. Your
Rival has no Shroud and 2 shields. You win a round with a pair. Today your Rival goes to 1 shield. Under the
shared ward, **your** Shroud absorbs the hit and retires to your energy, and your Rival keeps 2. If your Rival is
already on 0, your Shroud absorbs your own Fighter Kick the same way, so a Shroud on your side delays your win by a
round. The same holds for Leyline: cast it at any point in a round and your own Special wins that round break
nothing either. This is what `wardall` measured and what Aj accepted; it is listed here because a player will meet
it in their first duel.

**⚑ SUPERSEDED FOR HOLY SHROUD THE SAME DAY.** Reading this scenario, Aj made the Shroud a Quick ability on the
Equipment (*"So you can decide when to take the counter off and protect the table. Especially if you were the one
winning the round"*): it absorbs nothing by itself any more, so your Shroud never eats your own strike. Built as
v1.35.2.2, the epic's second merge. The Leyline half of the scenario stands.

## Questions for Aj

**ANSWERED 2026-10-22: Aj approved all six card texts and all five recommendations exactly as drafted** (*"Approve
the six card texts and the five recommendations as drafted"*). The build follows them; the questions are kept as
asked, so the reasons stay beside the answers.

1. **Card text.** Approve, or edit, the six drafts in [Card text](#card-text).
2. **Which old rules stay as Custom rules rows.** Recommended: keep **two** as rows phrased as the negative of the
   new default, so every row still defaults off (the `flatDraw` precedent):
   - *"A Special win strikes only one rival"* (`strikeOne`), which keeps the winner's pick and its whole UI
     (`lossPick`, `pendingLossChoice`, the two losspick suites) alive behind the row;
   - *"Shields do not scale with the table"* (`flatShields`).
   And **no** row for the ward or the every-rival damage, because those change what a card does, and a row that
   makes a printed card text false is what the one-wording ruling exists to prevent. The alternative is deleting
   the winner's-pick UI outright, which is a large deletion (about twenty template sites, `netview`, Passo, two
   netplay suites) for no player-visible gain; recommended only if you want the rule gone, not merely off.
3. **`millAll` ("All round losers send cards to their Energy Pile").** Under every-rival strikes it does nothing:
   every loser is struck, and every struck loser already mills. Recommended: keep it, inert until `strikeOne` is
   on, using the existing `needsAny` dependency (the `chopStrips` precedent). The alternative is deleting it.
4. **Whose Holy Shroud saved whom.** The round line reads *"Holy Shroud saved Rival 2"* and does not say whose
   Shroud it was. Under the shared ward it can be yours saving your opponent from you. Recommended: name the owner
   when it is not the saved player — *"Your Holy Shroud saved Rival 2"* — which needs the engine to record the
   owner beside the card name.
5. **The How to play page.** It states only duel rules today (and already says "draw 2", which is wrong at 3+).
   Recommended: one added line — *"At 3–6 players: everyone starts with 2 + players shields, a Special win strikes
   every rival, and every player draws one card per player each round."* No change to its duel lines.

## Card text <a id="card-text"></a>

Current text is what the card reader and `docs/CARD-LIST.md` show today (`BASE_OVERRIDES` and `BOOSTS` in
`engine.js`). House style read from the existing cards: *"Target Rival"*, *"EVERY Rival's"* (Caltrops),
*"each Rival you strike"* (Armor Piercing), *"Every player gains 1 Shield"* (Sanctuary).

| card | today | draft |
| --- | --- | --- |
| **Leyline Ascension** ♦9 (Quick) | You can't lose this round — no shield loss, and at 0 shields no Fighter Kick either. | **No player can lose a shield this round — and no one at 0 shields can take the Fighter Kick.** |
| **Holy Shroud** ♥9 (Equipment) | If you would lose a shield (or take the Kick at 0), remove 1 counter from Holy Shroud instead. | ~~If any player would lose a shield … A player's own Holy Shroud is used before anyone else's.~~ (shipped in v1.35.2.1) → since v1.35.2.2, at Aj's call: **Quick ability — remove 1 counter from Holy Shroud: no player can lose a shield this round, and no one at 0 shields can take the Fighter Kick. At 0 counters it retires to your Energy.** |
| **Critical Hit** ♠9 | Additional cost: discard a Broadway card (10, J, Q, K, or A). Target Rival loses 1 shield. | **Additional cost: discard a Broadway card (10, J, Q, K, or A). Every Rival loses 1 shield.** |
| **Ultima Attack** ♣10 | Additional cost: discard a Broadway card (10, J, Q, K, or A). Target Rival loses 1 shield. | **Additional cost: discard a Broadway card (10, J, Q, K, or A). Every Rival loses 1 shield.** |
| Ultima Attack under **Ares Mode** (Super) | The Rival loses 1 additional shield (2 total). | **Every Rival loses 1 additional shield (2 total).** |
| Sanctuary under **Apollo Mode** (Super) | Sanctuary becomes a Quick, and you can't lose a shield until end of round. | **Sanctuary becomes a Quick, and no player can lose a shield until end of round.** |

Checked and **unchanged**, because they are already true at every table size under the package:
- **Armor Piercing** ♣7 — *"each Rival you strike loses 1 additional shield"*: under every-rival strikes that is
  every Rival, which is what the card already says (fixed 2026-09-24 for exactly this).
- **Sanctuary** ♥10 — *"Every player gains 1 Shield."*
- **Back Stab** ♠10 — still *"Target Rival"*: the package does not include `lockoutall`.
- Leyline under **Athena Mode** — its patch adds the recycle and says nothing about whom the ward covers.

Each drafted text is what the engine already does with the switch on; nothing in the draft needs new behaviour.
Two engine facts the drafts rest on, read from the code: Leyline's `cantLoseRound` blocks both the strip and the
Kick (`resolveShieldLossObj`), and Apollo's `shieldImmune` blocks the strip only, never the Kick — which is why the
Apollo draft says "lose a shield" and does not mention the Kick. Holy Shroud tries the struck player's own Shroud
first, then the first other living player's in seat order (`findAbsorber`).

## Custom rules rows

Drafts for question 2, in the **Table rules** section (3–6 players; every row there is a no-op in a duel):

| key | label | note |
| --- | --- | --- |
| `strikeOne` (replaces `lossAll`) | A Special win strikes only one rival | Normally a Special win costs every rival a shield. With this on, the winner picks one rival to strike — the rule before v1.36. Leyline, Holy Shroud and the attack cards still cover every rival. |
| `millAll` (kept, `needsAny:['strikeOne']`) | All round losers send cards to their Energy Pile | Only matters with "strikes only one rival" on: by default every loser is struck, and every struck loser already does. |
| `flatShields` (replaces `shieldScale`) | Shields do not scale with the table | Normally everyone starts with 2 + players shields (4 in a duel, 8 at six). With this on, 4 at every player count. |
| `flatDraw` (unchanged) | Draw does not scale with the table | unchanged |

The `strikeOne` note says out loud that the row restores the **strike rule**, not the v1.35 game: the ward and the
every-rival damage stay on. That combination was never measured; it is homebrew, like every row.

**Migration** (`rulesFromKey`, the one place a key is read — saved keys in `localStorage` and suggestions):
- `lossAll` → dropped (it is the default now). `shieldScale` → dropped.
- `millAll` with no `strikeOne` → dropped, so a stale key cannot carry an inert rule that marks the game
  "customised" (`customRules()` is `RULE_DEFS.some(ruleOn)`).
- A key that **omits** `lossAll` meant the winner's pick and now means every-rival. That half cannot be migrated
  and should not be: it is the default moving, the `seqTwos` precedent. Migrating it would put every existing
  player on the old rule for good.
- The wire needs nothing: v1.36.0 refuses a v1.35 peer (`verIncompatible`, the minor number).

**Presets** (`RULE_PRESETS`) are exact states that name only shape rules, so each now plays the package. That is
correct — they never named table rules — and `rulestest` should assert it for one preset.

**The playtest export.** A record's `rules` key is `''` for the shipped game, and `''` now means the package.
Records already carry `build`, so a reader can tell; recommended anyway: bump `v:'2.1-mp'` to `'2.2-mp'` so the
schema says the meaning of an empty key moved, and note it in `PLAYER-PROFILE.md`'s ingestion log.

## Engine (`engine.js`)

- **Defaults:** `SPECIAL_LOSS_MODE` `'chosen'` → `'all'`; `SHIELDS_PER_PLAYER` → `true`; `WARD_ALL` → `true`;
  `DAMAGE_ALL` → `true`. `MILL_SCOPE` stays `'targeted'` (it does nothing under `all`). Rewrite the comments at
  each: the file header (lines ~21-22), `SHIELDS_PER_PLAYER` ("OFF: … reverted"), `WARD_ALL` ("Flag, default off"),
  and the `DEFAULTS MATCH THE SHIPPED GAME` block above `SPECIAL_LOSS_MODE`.
- **Card text:** `BASE_OVERRIDES` D9, H9, S9, C10; `BOOSTS` `H.super[10].desc`, `C.super[10].desc`. The dead
  base `EFFECTS` entries they override stay as they are.
- **`stackTargetOf`:** a `destroyShield` returns `{ seat }` today. Under `DAMAGE_ALL` it must return
  `{ allRivals:true }` at 3+ players (the Hermes Back Stab branch) so the stack caption and the Respond? box say
  "every rival" instead of naming one seat. In a duel it can keep naming the seat.
- Unchanged and checked: the `destroyShield` cast gate (refused only when **no** rival holds a shield), `stakeFor`'s
  `respond` branch (already reads `hostileTargets`, so every struck seat has its stake), the Fighter Kick rule
  (`noKick` on Technique losses), `chooseShieldTarget` / `lossTargetInteractive` (kept for `strikeOne`).
- `preventShield` and `protect:'special'` are read in `resolveShieldLossObj` and set by no card: dead hooks,
  out of scope.

## Template (`CardmenFighter.template.html`) <a id="template"></a>

- **Boot:** the two lines setting `setSpecialLossMode('chosen')` / `setMillScope('targeted')` at load. `applyRules`
  sets both at every game start; the load-time copy should go or say the package.
- **`RULE_DEFS` / `RULE_SECTIONS` / `rulesFromKey` / `applyRules`:** the rows and migration above. `applyRules`
  sets `setWardAll(true)` and `setDamageAll(true)` explicitly, so the page never depends on the engine's load-time
  state. Both game starts call it (`startGame`, `hostStartRealN`); nothing new to wire. The header comment that
  says *"All four are MULTIPLAYER-ONLY"* and the `rulestest` copy assertions move with the rows.
- **Critical Hit and Ultima Attack stop asking for a target.** `isHostileSingular` treats `destroyShield` as
  targeted, so today the player taps a rival first. Under `damageall` the tap is meaningless (`hostileTargets`
  ignores it). It drives `effNeedsTarget`, `castNeedsChoice` and the activation path; the Broadway pitch pick
  still happens when there is more than one Broadway card. The ⚡ casts on the tap, like any untargeted card.
- **Stack caption and Respond? box:** "→ every rival" from the engine change above (the box's `aim` line already
  has the `allRivals` case).
- **Round narration:** question 4.
- **How to play:** question 5.
- **The Phases lesson** quotes Leyline's text — see [Lessons](#lessons).

`ai.js` and `netview.js` need no change. `ai.js` still picks a target for Critical Hit, which the engine ignores;
that and the rest of the AI's view of the package belong to the AI follow-up.

**The `aimed` AI policy becomes unreachable in the shipped game.** It holds Leyline back from a Critical Hit aimed
at someone else, and under `damageall` no Critical Hit is aimed at someone else; under the shared ward, springing
Leyline would protect that someone anyway. Measured on a scratch copy of the engine with the four defaults
flipped: `test.js` goes **747 / 3**, and the three reds are exactly the `aimed elsewhere` legs. They are not a
regression; their staging cannot happen any more. Recommended: the legs set `setDamageAll(false)` and
`setWardAll(false)` around themselves (the rules under which the branch is reachable) and say so, and the
`ai-answers-others-casts` entry decides whether `aimed` stays. `netview.test.js` stays **74 / 0**.

## Lessons <a id="lessons"></a>

Every lesson is a duel, so `lossall`, `shp` and `damageall` change nothing in them; only the shared ward can.
Grepped every step's text for Leyline, Shroud, Critical Hit, Ultima, shields, strike and Kick:

- **Phases and Quicks** (Basics #3), the Leyline step: *"…press ⚡ Activate: <i>you can’t lose this round.</i>"*
  quotes today's card text and becomes false under the new wording. It changes to quote the approved text. The
  next step, *"Shield saved."*, stays true: the player is the one struck, and the Rival, as the round's winner, has
  nothing to lose. `lessontest_phases` asserts the save, not the sentence.
- **How to Play, Specials, Initiative, Energy** state *"only Specials break shields"*, *"strip both shields"*,
  *"Winning it made the Rival lose a shield"*: all true in a duel under the package. Only the Phases rig deals a
  ward card, and to the player (`tutRigPhases`, ♦9). An AI Rival can still draw and cast one; its own Leyline
  already protects the Rival today, so the shared ward only adds protection for the **player**, and no lesson gates
  on the player losing a shield except Phases, where the player holds the Leyline. The lesson suites below are the
  check.
- No lesson mentions Holy Shroud, Critical Hit or Ultima Attack.

## Suites <a id="suites"></a>

**Measured, not read.** Two full sweeps of `main` at `3db7701` in a throwaway worktree (`git worktree add`, the
real checkout untouched): the first with the four engine defaults flipped and `applyRules` forcing the package;
the second adding the Critical Hit / Ultima Attack change (no target pick, and `stackTargetOf` saying "every
rival"). **137 suites: 129 green, then 128.** Every red is below with its cause, read from its
`code/.sweep-fail-*.log`. None is a product defect: each asserts the old rules, or stages a board the package
changes.

| suite | result | cause | how it moves |
| --- | --- | --- | --- |
| `test.js` | 747 / 3, then 746 / 4 | the three `aimed elsewhere` legs (above); then one more, *"every hostile single-target AI cast carries the seat it hit … or every rival for a Super Back Stab"*, once Critical Hit's stack target became "every rival" | pin `setDamageAll(false)` / `setWardAll(false)` around the `aimed` legs; let the log check accept "every rival" for a `destroyShield` under `damageall` |
| `versiontest` | 32 / 3 | only that `test.js` was not green, so its count could not be read | nothing; green once `test.js` is |
| `rulestest` | 148 / 4 | asserts the old defaults (*"chosen / targeted / flat shields"*), a preset returning the engine to them, and a saved key containing `lossAll` | moves with the rows: new default state, new keys, and the migration asserted both ways |
| `nettest_losspick3`, `nettest_losspick_remote3` | 5 / 3, 5 / 2 | the winner's pick is never offered by default | start the game with `strikeOne` on; deleted with the pick if question 2 goes the other way |
| `nettest_elim3` | 16 / 9 | its premise is the winner's pick (*"In 'chosen' mode the round winner picks the target"*), and it asserts the survivors *"kept their 4 shields"* | run under `strikeOne`; assert the survivors' shields **unchanged** (a 3-player game now starts on 5). The default-rules mid-game kick is already covered: `kicktest` stayed 29 / 0 in both sweeps |
| `nettest_target3` | 12 / 1, then 9 / 4 | its subject is seat rotation for a **single-target** cast, and its card is Critical Hit, which now hits both rivals and is cast as "aimed at every rival" | restage on a card that is still single-target (Telekinesis ♦3, counted by hand size); add a leg where Critical Hit hits **both** rivals and every frame's cast line says "every rival" |
| `roartest` | 30 / 2 | stages a 3-player seat on 4 shields, one short of the new full row of 5, so the struck seat ends on 2 hollow pips, not 1 | stage the seat on a full row (`startShieldsFor`), or count only the pips lost in the round |
| `dragtest` | 43 / 0, then 42 / 1 | used Ultima Attack as *"a card with a choice"* and requires the column's button to read 🎯; its only choice is now the Broadway pitch, during which the button reads ⚡ | restage on a still-targeted card. A pitch-only choice is not new: Armor Piercing has always had one, so what the column shows then is v1.35 behaviour, not this change's |

**Green in both sweeps and worth naming,** because they are where a rules change would show: `kicktest`,
`deckouttest`, `mptest` (133), `resolutiontest` and `resolutiontest_ui`, `exporttest`, `landscapetest` and
`phonetest` (the wider shield rows), `nettest_parity`, `nettest_rules`, `nettest_suggest`, and every lesson suite
including `lessontest_phases` and `lessontest_phonepass`.

**What the sweeps could not see**, so step by step the build must re-run the named suites:
- **The rows themselves.** `nettest_rules` and `nettest_suggest` stayed green only because the `lossAll` row still
  existed: they click `[data-rule="lossAll"]` and read `isSpecialLossMode()`. Renaming the row moves both, and
  `rulestest`'s copy, section and preset assertions with it.
- **The card text.** No suite asserts any of the six texts (grepped every `code/*.js`), so the new text needs its
  own check: `node gen-cardlist.js` output read by eye, and the Phases lesson's quote updated with it.
- **Narration, the How to play line, the export `v`** (questions 4-5): `logtest`, `exporttest`.
- The scratch build changed only the defaults and the targeting. Rebuilding the real thing is the measurement
  that counts; these two sweeps size the job, they do not replace the final one.

## Sims and harnesses <a id="sims"></a>

Every sim measures "the shipped game" one of two ways, and both break:
- **Hardcoded `'chosen'`, labelled as the live game** — `strengthsim` (*"the shipped defaults, stated not
  assumed"*), `personasim` (*"matches the live game"*), `twosim`, `optionsim`, `passsim`, `recyclesim`,
  `roundsim`, `stucksim`. After the change each measures the v1.35 game while saying it is the live one. Fix: stop
  overriding the engine defaults (which are the shipped game), or set the package by name.
- **Flags that default off** — `mpsim`'s `loss=` defaults to `chosen` and `damageall`/`wardall` are opt-in, unlike
  `shp`/`dpp`, which already default to the engine's values. Fix: default all four to the engine and add `noshp`-style
  negatives (`loss=chosen` already exists; add `nowardall`, `nodamageall`). `rulesim`'s rows labelled **LIVE** are
  `chosen` rows; relabel them and add a live row. `flagpair`'s `base` arm is the v1.35 game; say so in its header
  and add a `shipped` alias for `lossall+wardall+damageall+shp`.
- **Engine defaults** — `analysis.js`, `forcesim.js`, `rulepair.js`: these move with the engine by themselves. All
  are duel harnesses, so only the ward moves them.

Every number already recorded in `DECISIONS.md`, `CARD-STATS.md` and `PATCHNOTES.md` was taken on the old rules.
That is history and stays; `DECISIONS.md#loss-all-remeasured` gets one line saying the package shipped in
v1.36.0 and that later "shipped" arms are the package.

## Docs

- `docs/CHANGELOG.md` — `### v1.36.0 — the loss=all package is the default`; `README.md` **Status:** v1.36.0.
- `docs/NEXT-SESSION.md` — `game-length-scales-player` closes (this is its answer). `ai-answers-others-casts`
  stops being parked: its tag moves to `ready to build`, with the `aimed` note from [Template](#template) added to it. File a new
  entry for the persona re-measure (personas' `focus` knob mostly chose the strike target, which is gone).
- `docs/DECISIONS.md` — the line above; the `loss-all` balance entry gets a pointer that it shipped.
- `docs/PATCHNOTES.md` — a new balance entry: the package, its spreads and lengths, linking the study.
- `docs/CARD-LIST.md` — regenerated (`node gen-cardlist.js`).
- `docs/MULTIPLAYER-DESIGN.md` line ~54 — *"the winner picks one rival to lose a shield"* describes the old rule.
- `CLAUDE.md` — *"3-6 player scaling was tried and REVERTED"*, *"The engine's defaults are the SHIPPED rules
  (`SPECIAL_LOSS_MODE='chosen'`…)"*, *"Shields stay flat 4 at every count"* and the rules-facts defaults line all
  state the old game; the docs map gets this file.
- `docs/PLAYER-PROFILE.md` — the ingestion note for the export.

## Version and netplay

v1.36.0: a rules change bumps the minor number, so a v1.36 build refuses a v1.35 peer online and both players are
told to download the same build. That is the handshake doing its job; nothing to add. `nettest_version` needs no
change (it overrides the version with `?ver=`).

## Build order

One PR, `feat/loss-all-default`, one version (v1.36.0). Each step ends green on `npm test` and on the UI suites it
names before the next starts (`CLAUDE.md`: a fingerprint and `test.js` cannot see the page).

1. **Engine defaults + card text + `stackTargetOf`**, with `test.js`'s two moves (see [Suites](#suites)).
   `npm test`.
2. **Template rules:** rows, sections, migration, `applyRules`, boot lines. `rulestest`, `nettest_rules`,
   `nettest_suggest`, the two losspick suites and `nettest_elim3` (all three onto `strikeOne`), `mptest`.
3. **Critical Hit / Ultima untargeted** in the UI. `nettest_target3` and `dragtest` restaged; `answercasttest`,
   `stackrowtest`, `mptest`.
4. **Narration and How to play** (questions 4-5), **the Phases lesson** text, `roartest`'s staging.
   `lessontest_phases`, `logtest`, `exporttest`, `roartest`.
5. **Sims** (see [Sims and harnesses](#sims)).
6. **Docs**, `gen-cardlist`, version bump, build, `cp` to the root copy.
7. **Full sweep**, one at a time, nothing else on the machine. Reds explained from `code/.sweep-fail-*.log`.

It fits one PR: one rules change, one version, and the measured blast radius is nine suites (one of them,
`versiontest`, only a cascade), every one a staging or an assertion of the old rules.

## Out of scope, noticed on the way

For the later card-tweak pass, not this one (both fixed in v1.35.2.4, Aj approving the texts as drafted on
2026-10-22):
- **Spiked Armor under the ♣ King** reads *"The Rival's highest card each fight drops 1 further (to −3)"*, while the
  card itself hits EVERY Rival. A sixth instance of the table-text class; it is wrong today, independent of the
  package.
- **Poison the Air under Pandora** reads *"Poison only the Rival"* where the house form for one target is
  *"Target Rival"*.

## The changelog entry, for when the epic lands <a id="changelog"></a>

An epic gets ONE changelog entry, written into `CHANGELOG.md` when it merges to `main` and the minor bumps
(`CLAUDE.md`, the `epic/` rules); until then it waits here. Update it with each merge into the epic.

#### v1.36.0 — the loss=all package is the default, duels included

**What you'll see at 3–6 players:** a Special win strikes **every** rival instead of one the winner picks; everyone
starts with **2 + players** shields (5 / 6 / 7 / 8); Critical Hit and Ultima Attack hit every rival and no longer ask
for a target. Games run about **11 / 12 / 14 / 15** rounds at 3 / 4 / 5 / 6 players, against 14 / 20 / 26 / 31.

**What you'll see in a duel:** the three cards that protect shields now protect **everyone**. Leyline Ascension means
nobody loses a shield that round, your own Special wins included; Sanctuary under Apollo locks every player's
shields. Critical Hit and Ultima Attack cast on the tap, without the target tap.

**Holy Shroud is a Quick ability on the Equipment** (Aj, the same day: *"So you can decide when to take the counter off
and protect the table. Especially if you were the one winning the round"*). It no longer absorbs anything by itself:
its owner presses **⚡ Use** on the Shroud — in a window that is theirs after Yes, or in their own Main — the counter
comes off, and the table gets Leyline's ward for the round. AUTO stops you for it when you are struck or a strike card
is aimed at you, even with nothing castable in hand. It cannot be countered (it is not a Technique).

**Why:** Aj chose the package on 2026-10-22 after `DECISIONS.md#loss-all-remeasured`: it is the first `loss=all`
measured tighter than the shipped game at every table size from 3 to 6 (spread 8.3 / 9.9 / 10.8 / 9.9 against
15.1 / 17.4 / 15.0 / 12.5, knight self-play). It applies to duels too because Aj would not print two wordings of one
card: *"i do not want to print different wordings for the same card when the game changes from duel to multi"*.
The duel cost was measured with it (about 1 duel in 18 flips; Pure Wizard about −3, the attack decks about +2).

**The card text, one wording at every table size:** Leyline Ascension *"No player can lose a shield this round — and no
one at 0 shields can take the Fighter Kick."* · Holy Shroud *"Quick ability — remove 1 counter from Holy Shroud: no
player can lose a shield this round, and no one at 0 shields can take the Fighter Kick. At 0 counters it retires to your
Energy."* · Critical
Hit and Ultima Attack *"… Every Rival loses 1 shield."* · Ares Mode on Ultima *"Every Rival loses 1 additional shield
(2 total)."* · Apollo Mode on Sanctuary *"…and no player can lose a shield until end of round."*

**Custom rules:** the old rules stay as rows phrased as negatives, so every row still defaults off — *"A Special win
strikes only one rival"* (`strikeOne`, which keeps the winner's pick) and *"Shields do not scale with the table"*
(`flatShields`). *"All round losers send cards to their Energy Pile"* does nothing unless `strikeOne` is on. The
shared ward and the every-rival attack cards have no row, because the cards print what they do. A saved rule set
from before drops `lossAll`, `shieldScale` and a lone `millAll`.

**Also:** a Shroud's use reads *"You removed a Holy Shroud counter — no player can lose a shield this round."* on every
seat, a netplay client sends it as its own intent (`op:'ability'`), and Passo uses a dropped player's Shroud. How to play gains a line for 3–6 players. The
playtest export moves to schema `2.2-mp`, because an empty rules key now means the package. A v1.36 build refuses a
v1.35 peer online. Every sim that called `'chosen'` the live game now states the package (`rulesim` keeps its old
rows, relabelled v1.35; `flagpair`'s `base` arm is v1.35, with a new `shipped` alias). The inventory behind all of
this is [`LOSS-ALL-DEFAULT-PLAN.md`](LOSS-ALL-DEFAULT-PLAN.md).

**The AI stops protecting rivals** (v1.35.2.3, Aj's "no" from 2026-10-09): Counter Spell and Annoint answer only a
threat aimed at the AI itself. Measured before shipping, with no harm and a small lean in its favour
([`DECISIONS.md#ai-no-aid`](DECISIONS.md#ai-no-aid)). The AI uses a Holy Shroud only to guard, on Leyline's rule (two
shields or fewer).

**Two Form texts name the table** (v1.35.2.4): Spiked Armor under Meleager reads *"Every Rival's highest card each fight
drops 1 further (to −3)."*, which is what it always did, and Poison the Air under Pandora reads *"Only Target Rival's
Energy Pile moves to their Shuffle Pile — yours stays."*

**Not in it:** the balance numbers were measured with the old, passive Holy Shroud and the AI before `noAid`;
re-measuring is `v136-live-measurements`.

