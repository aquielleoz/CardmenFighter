# Cardmen Fighter 🃏🦵💥

A self-contained, single-file dueling card game — a Kamen-Rider-themed TCG you play in any browser, on desktop or phone, fully offline. Strip your rival's shields with card combos, transform into stronger forms, and land the finishing Fighter Kick.

**Status:** v1.31.44 — playable and complete (solo vs AI, guided tutorials, and local/online 2–6 player).

## Play

Open **`code/CardmenFighter.html`** in any browser — that's the whole game in one file (engine, AI, art, and sound all inlined; no server, no install). Pick a class, roll for initiative, and duel.

New here? Hit **🎓 Tutorials** on the New Duel screen — short guided lessons walk you through the basics (how to play, the zones, initiative, specials, energy) and the advanced layer (quicks, rides, form changes).

## How it plays, in brief

- **The ladder (low → high):** `3 4 5 6 7 8 9 10 J Q K A 2` — the **2 is the apex** and beats everything; the **Ace** is second. To win an exchange you must play the same *shape* at a **strictly higher** value (ties don't win).
- **Jab vs Special:** a single card is a **jab** (wins the exchange, banks energy, never breaks a shield). A **special** — pair, trio, straight, or full house — is the **only** way to break a shield. (Round 1 is jabs only; specials unlock in Round 2.)
- **Shields & the kick:** each fighter starts with shields; break them all and the next special win is the **Fighter Kick** — game over.
- **Energy:** every card you fight with banks into your **energy pile**. Spend energy to activate a card's **effect** (cost = the card's number). Spent energy cycles to your shuffle pile, which refills your deck when it runs dry — so keep fighting and spending or your deck starves.
- **Forms & Rides:** the **J / Q / K** are transforms. Activate one and it moves to your persistent **Forms & Rides Zone**, where a **Ride (J)** is a standing aura and a **Form Change (Q/K)** upgrades your cards' effects. Hold a Ride + a Q + a K and you ignite **Super Mode** — the strongest boost.
- **Four classes** (one per suit): ♦ **Wizard**, ♥ **Cleric**, ♣ **Fighter**, ♠ **Rogue** — each with its own effect set (draw, ramp, shields, equipment, removal, disruption).

The full, authoritative card list lives in [`docs/CARD-LIST.md`](docs/CARD-LIST.md).

## Repo layout

```
CardmenFighter.html      ← the playable game (a copy of the built code/CardmenFighter.html)
code/                    ← source + build + tests
  CardmenFighter.template.html   UI/markup/styles (with __ENGINE__ etc. placeholders)
  engine.js              pure rules engine (deck, combos, duel loop) — no DOM
  ai.js                  the effect-using duel AI (drives the Rival + sims)
  art.js                 inlined card art (faces.js = retired layouts, not inlined)
  netview.js             per-seat redacted snapshots for online play
  qr.js                  byte-mode QR encoder — renders the online invite code as a scannable symbol
  build.js               inlines the modules → code/CardmenFighter.html
  test.js                engine + AI unit/sim suite
  netview.test.js        netplay snapshot tests
  nettest_*.js           full-UI netplay (Playwright) suites
  qrtest.js / qrref.js   the QR encoder: decoded back by a real decoder, and diffed against macOS CoreImage
  analysis.js / mpsim.js balance round-robin + multiplayer sims
docs/                    ← design docs & handoff notes (see below)
assets/                  ← tutorial-demo.gif
```

## Build & test

```bash
cd code
node build.js          # inline engine/ai/art/netview/qr → code/CardmenFighter.html
cp CardmenFighter.html ../CardmenFighter.html   # keep the repo-root copy in sync
node test.js           # engine + AI suite (231 assertions, must be 0 FAIL)
node netview.test.js   # netplay snapshot tests (28)
```

Or via the npm scripts: `npm run build`, `npm test`, `npm run test:smoke`.

The full-UI browser and netplay suites (`browsertest.js`, `nettest_*.js`) need Playwright — `npm install &&
npx playwright install chromium` in `code/`, then run one suite at a time. The **game** has no dependencies;
`code/package.json` exists only for these tests.

`CardmenFighter.html` is generated — edit the sources in `code/` (template + `.js` modules) and re-run `node build.js`. Never hand-edit the generated HTML; the next build overwrites it. `build.js` writes only `code/CardmenFighter.html`, so copy it to the repo root yourself if you want both in sync (`faces.js` is no longer inlined — layouts were retired in v0.95).

## Docs

- [`docs/CARD-LIST.md`](docs/CARD-LIST.md) — the current card list (generated from `engine.js`). Start here.
- [`docs/NEXT-SESSION.md`](docs/NEXT-SESSION.md) — current state, changelog, and the open backlog.
- [`docs/REWORK-HISTORY.md`](docs/REWORK-HISTORY.md) — how the game evolved into its current form.
- [`docs/RIDES-AND-FORMS.md`](docs/RIDES-AND-FORMS.md) — design of the J/Q/K Forms & Rides layer.
- [`docs/ENERGY-REORDER-DESIGN.md`](docs/ENERGY-REORDER-DESIGN.md) — design for the reorderable energy pile (proposed, not built).
- [`docs/MP-PARITY-AUDIT.md`](docs/MP-PARITY-AUDIT.md) — what a duel gives you that a 3–6 player free-for-all does not (audited, not fixed).
- [`docs/PATCHNOTES.md`](docs/PATCHNOTES.md) — balance principles and win-rate history.
- [`docs/PLAYER-PROFILE.md`](docs/PLAYER-PROFILE.md) — a living read on how the game's main player actually plays; used for AI tuning and balance.
