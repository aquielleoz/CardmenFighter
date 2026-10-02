/* PROMPT PREFERENCES — epic/priority-windows, step 15 (Q11).
 *
 * Aj: *"i imagine that it will get annoying very quick (pun intended). by default, all prompts will be off,
 * but in the card reader box you can check when you'd like to be prompted."* The rebuilt Fight End window
 * offers EVERY Quick to everyone holding priority, so without this a player is asked about every card they
 * hold, every round.
 *
 * THE TWO CLAIMS THIS SUITE EXISTS FOR, and they pull in opposite directions:
 *   1. EVERY LEGAL TIMING PROMPTS BY DEFAULT (changed 2026-09-10 — this claim used to read "the default
 *      experience is today's", and the assertion carrying it now requires the OPPOSITE; see the long note
 *      at `counterResolution` for why, because a reversed assertion with no reason is worse than none).
 *      Aj: *"players can really look at all their cards and decide which effects to activate. legal mind
 *      you at the timing it's being asked at."* A suite that only proved the checkboxes work would happily
 *      pass on a build that had silenced a card.
 *   2. AN UNCHECKED TIMING IS AN AUTO-PASS, NOT A SKIPPED WINDOW. The window still opens and priority is
 *      genuinely passed — this is a notification layer, not a rules layer. Asserted as the game CONTINUING
 *      after the prompt is suppressed, because a window nobody answers looks identical to one nobody wanted
 *      right up until the table deadlocks.
 *
 * Run: node prompttest.js
 */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const { clickFight, installPageHelpers } = require('./fightclick');
const path = require('path');
const fs = require('fs');
const URL = 'file://' + path.resolve(__dirname, 'CardmenFighter.html') + '?dbgsolo=1';
const wait = ms => new Promise(r => setTimeout(r, ms));
function pollTimedOut(fn) { console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g, ' ').slice(0, 110)); }
async function until(fn, t = 100, ms = 100) { for (let i = 0; i < t; i++) { if (await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* START A GAME BY POLLING FOR EACH STEP, NEVER BY SLEEPING PAST IT. The first version of this suite used
   `wait(300)` after New and `wait(1500)` after Deal, and went red on run 10 of 40: on a loaded machine the
   dialog is not up when the click lands, so no game starts and every later assertion fails for a reason
   that has nothing to do with the feature. CLAUDE.md states this exactly — "any fixed wait(n) followed by
   an assertion is this bug waiting to happen" — and a suite added to the sweep is a LOADED machine by
   definition. Each step waits for the thing it needs and reports if it never arrives. */
async function freshGame(p) {
  if (!await until(() => p.evaluate(() => !!document.getElementById('newBtn')), 100, 100)) return false;
  await p.evaluate(() => document.getElementById('newBtn').click());
  if (!await until(() => p.evaluate(() => { const b = document.getElementById('goFirstBtn'); return !!(b && b.offsetParent); }), 100, 100)) return false;
  await p.evaluate(() => document.getElementById('goFirstBtn').click());
  return await until(() => p.evaluate(() => !!(window.__solo && window.__solo.st() && window.__solo.st().players)), 150, 100);
}

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await b.newPage(); const errs = [];
  await installPageHelpers(p);   // epic step 20: the two-state Fight button, for drivers that decide inside the page
  p.on('pageerror', e => errs.push(e.message));
  let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; };

  /* A GAME MUST BE RUNNING BEFORE ANY DEFAULT CAN BE READ, and the first version of this suite did not start
     one. `promptDefault` asks the ENGINE whether a card can guard (`immunityEffFor`), which needs live state —
     so with no game every Fight End default came back false and Leyline looked silenced. The suite was
     wrong, not the defaults. Same startup as `peektest`. */
  await p.goto(URL);
  await until(() => p.evaluate(() => !!window.__solo));
  await p.reload();
  await until(() => p.evaluate(() => !!window.__solo));
  ok(await freshGame(p), 'a solo game is running — defaults are readable');

  /* ---- 1 · THE DEFAULTS, read through the same helper the prompt sites use. A fresh device has no stored
     preferences at all, so every answer here is a DEFAULT and not a remembered tick. */
  const D = await p.evaluate(() => {
    const C = (r, su) => ({ rank: r, suit: su, id: '' + r + su });
    const q = (c, t) => window.__solo.promptWanted(c, t);      // does it STOP you?
    const L = (c, t) => window.__solo.promptLegal(c, t);       // does the row EXIST at all?
    return {
      counterRespond: q(C(4, 'D'), 'respond'),    // Counter Spell — the classic response timing
      counterResolution: q(C(4, 'D'), 'resolution'),  // …and NOW at Fight End too — see the assertion below
      leylineResolution: q(C(9, 'D'), 'resolution'),  // Leyline guards, so it always spoke here
      leylineRespond:  q(C(9, 'D'), 'respond'),
      counterPrefight: q(C(4, 'D'), 'prefight'),  // legal since step 20 — see the assertion below
      legalCounterResolution: L(C(4, 'D'), 'resolution'),
      legalCounterPrefight: L(C(4, 'D'), 'prefight'),
      legalLeylineResolution: L(C(9, 'D'), 'resolution'),
      legalCounterUpkeep:   L(C(4, 'D'), 'upkeep'),
      legalCounterCleanup:  L(C(4, 'D'), 'cleanup'),
    };
  });

  /* the "a fresh device stores nothing" assertion went with the store it read — there is no per-card
     preference to store now, so every answer below is a default by construction rather than by luck. */
  /* ⚠ THIS ASSERTION NAMED A BOARD IT NEVER STAGED, and that is why it read as the blocker on the
     stake-driven default for three weeks. It said *"when a Technique is cast"* and then queried
     `promptWanted` on an EMPTY board — no stack, nothing to counter. Under the old unconditional default
     (`timing === 'respond'`) it passed for a reason that had nothing to do with its own sentence; under a
     stake-driven one it correctly returns false, because a Counter Spell with nothing to counter has no
     stake. THE SUITE WAS PINNING THE OLD DEFAULT, which is this repo's documented "a suite can pin a
     belief" shape: when a rule and a suite disagree, the RULE wins and the suite says so in its comment.
     Split in two — the bare default is asserted as what it now is, and the sentence the old one CLAIMED
     is asserted for real one block below, against a stack with an opponent's Technique on it. */
  ok(D.counterRespond === false,
     'default: Counter Spell does NOT stop you on an empty stack — there is nothing to counter, so no stake' +
     (D.counterRespond === false ? '' : '  ← the default is still unconditional'));

  /* ---- 1b · THE SENTENCE THE ASSERTION ABOVE USED TO MAKE, NOW STAGED. An opponent's Technique really is
     on the stack, so Counter Spell really does have a stake and really must stop you. This is the claim
     that matters for a player, and nothing asserted it before today. */
  const staged = await p.evaluate(() => {
    const st = window.__solo.st(), C = (r, su, t) => ({ rank: r, suit: su, id: (t || '') + r + su });
    const eff = window.CardmenEngine.effectOf(C(1, 'D', 'riv'));         // A♦ Imbue with Power — a plain Technique
    st.stack = [{ kind: 'effect', p: 1, oid: 'o1', card: C(1, 'D', 'riv'), eff: eff }];
    st.pending = st.stack[0]; st.respondFor = 0;
    window.__solo.render();
    return { onStack: st.stack.length,
             mine: !!window.CardmenEngine.stakeFor(st, 0, C(4, 'D'), 'respond'),
             stops: window.__solo.promptWanted(C(4, 'D'), 'respond') };
  });
  ok(staged.onStack === 1 && !!staged.mine,
     "1b · staged — an OPPONENT's Technique is on the stack, so Counter Spell has a real stake" +
     (staged.mine ? '' : '  ← no stake found; the assertion below would pass vacuously'));
  ok(staged.stops === true,
     '1b · …and AUTO stops you for it — the sentence the old default only claimed');

  /* THE BOUNDARIES DEFAULT OFF SINCE 2026-09-11 (Aj: *"flip the boundary prompt defaults off"*). Only
     `respond` stops you out of the box — something has just HAPPENED there. The four boundaries fire on a
     schedule, several times a round now that all five points exist, so stopping at each by default is a
     development setting rather than a game. */
  ok(D.leylineResolution === false, 'default: a BOUNDARY does not stop you out of the box — Leyline stays quiet at Resolution');
  /* THE POLICY CHANGED ON 2026-09-10, AND THIS ASSERTION IS WHERE IT IS RECORDED — it used to require the
     OPPOSITE, and reversing it silently would erase the reason.
     WHY IT WAS `false`: step 15's aim was that cards keep pinging exactly where they pinged before the
     epic, and before the epic the Fight End window WAS the `immunityEffFor` whitelist. So `promptDefault`
     asked that predicate.
     WHY IT IS `true` NOW: step 18 DELETED that whitelist and the default went on describing it, which made
     the two cards the epic exists to fix — Sanctuary under Hector, Armor Piercing under Hippolyta —
     silently auto-declined by default. Aj's ruling: *"players can really look at all their cards and
     decide which effects to activate. legal mind you at the timing it's being asked at."* Every legal
     timing prompts; the checkbox is noise reduction, not capability.
     THE "annoying very quick" RISK IS REAL AND IS NOW THE PLAYER'S LEVER rather than ours — which is what
     the checkboxes were built for. The suppression half is asserted further down, both ways, and
     `resolutiontest_ui` scenario C proves an unchecked card is RECORDED in the saved log rather than
     vanishing without trace. */
  ok(D.counterResolution === false && D.counterPrefight === false,
     'default: the other boundaries are quiet too (resolution ' + D.counterResolution + ', prefight ' + D.counterPrefight + ')');
  /* AND THE HALF THAT MATTERS MOST: quiet is NOT the same as illegal. Aj confirmed it explicitly — "off"
     must mean the window opens and you pass automatically, never that the card becomes uncastable. With
     the defaults flipped that distinction stops being theoretical for a handful of cards and starts being
     load-bearing for every one of them, so it is asserted directly at all five timings. */
  ok(D.legalCounterResolution && D.legalCounterPrefight && D.legalLeylineResolution &&
     D.legalCounterUpkeep && D.legalCounterCleanup,
     'default OFF ≠ ILLEGAL — every timing a Quick is legal at still EXISTS as a row you can tick' +
     ' (resolution ' + D.legalCounterResolution + ', prefight ' + D.legalCounterPrefight +
     ', upkeep ' + D.legalCounterUpkeep + ', cleanup ' + D.legalCounterCleanup + ')');
  /* THIS REQUIRED `false` UNTIL EPIC STEP 20, AND THE REVERSAL IS THE POINT. `promptLegal` gated the
     pre-fight row to `kind==='lockout'`, so Counter Spell had no such timing — matching an engine that
     offered that window to one seat and only for Back Stab. `PHASES-AND-PRIORITY.md` §3 says verbatim
     *"Every player's Quicks are available here"*, and step 20 made the code agree: the transition is an
     ordinary priority window, so EVERY Quick has all three timings. Recorded rather than flipped, because
     a reversed assertion with no reason reads as a test bent to fit. */
  ok(D.legalCounterPrefight === true,
     'EVERY Quick HAS the pre-fight timing — the `lockout` gate is gone (step 20); it is merely unticked' +
     (D.legalCounterPrefight === true ? '' : '  ← still gated; grep promptLegal for a `kind` test that should not be there'));

  /* ---- 2, 3 AND 4 ARE DELETED (2026-09-30) — THEY TESTED THE PER-CARD CHECKBOXES, AND THE CHECKBOXES ARE
     GONE (Aj: *"we can retire the per card prompts now actually, i'm liking the auto and on"*). They
     asserted that the reader renders six rows, that ticking one persists an OVERRIDE rather than the
     resolved value, and that an unchecked timing really suppresses the modal both ways.
     ⚠ WHAT WENT WITH THEM IS WORTH NAMING RATHER THAN QUIETLY LOSING: section 4 was "the load-bearing
     one", added because a mutant proved it missing, and the store assertions were the guard against
     writing a RESOLVED value (which would have frozen a device on today's defaults forever). Neither claim
     has a subject any more — there is no store and no row — but the SHAPE is worth re-reading before any
     per-card preference is ever reintroduced.
     WHAT REPLACES THEM is section 5's tri-state coverage plus 1b, which stages the board the old default
     only claimed. The migration blocks below went too: they guarded the `'fightend'` -> `'resolution'`
     rename of a PERSISTED id, and nothing is persisted now. */

  /* ---- 5 · THE ASSERTION THIS SUITE WAS MISSING, and a mutant proved it. Everything above tests the
     PREFERENCE; nothing tested that the preference SUPPRESSES A PROMPT. Deleting the filter from
     `promptHumanResponse` — the whole live wiring — left all 15 assertions green, because the "keeps
     moving" loop happily clicks `respDecline` when a modal it did not expect appears. A suite that cannot
     tell "no modal" from "a modal I dismissed" is not testing this feature at all.
     So: stage a REAL response window (the Rival casts a Technique while you hold Counter Spell and the
     energy for it) and assert the modal's presence BOTH WAYS. `quicktest`'s staging idiom — lead the apex 2
     so the Rival cannot fight back and must act with an effect. */
  async function stageCast() {
    /* A FRESH GAME EVERY TIME. Section 4 deliberately plays the game out — 13 actions, 7 rounds, often to a
       finish — so staging onto that state produced no window at all and the CONTROL failed. Re-dealing is
       the honest fix: this is asserting what happens when a cast lands, not what survives a played-out
       board. (The control failing is what surfaced it; a suite with only the negative half would have
       reported "no modal" and called it a pass.) */
    /* RELOAD, don't click New — section 4 can finish the game, and on the end screen `#newBtn` is not there
       to click (v1.31.57 gave it a third state). A reload is the one restart that works from any screen,
       and the preferences survive it by design, which is the whole point of them being per-device. */
    await p.reload();
    await until(() => p.evaluate(() => !!window.__solo));
    if (!await freshGame(p)) { lastBoard = 'freshGame() never started a game'; return null; }
    await p.evaluate(() => {
      const st = window.__solo.st(), mk = (r, s, id) => ({ rank: r, suit: s, id: id });
      const you = st.players[0], riv = st.players[1];
      you.hand = [mk(2, 'S', 'y2'), mk(4, 'D', 'cs')];
      you.energy = [1,2,3,4,5,6,7,8,9,10,11,12].map(n => mk(n, 'D', 'e' + n));
      riv.hand = [mk(1, 'D', 'r1'), mk(4, 'C', 'r2')];
      riv.energy = [9,8,7,6,5].map(n => mk(n, 'D', 're' + n));
      st.round = 4; st.turn = 0; st.pile = null; st.lastPlayer = null; st.passes = 0;
      st.pending = null; st.respondFor = null;
      window.__solo.render();
    });
    await wait(250);
    await p.evaluate(() => { const g = [...document.querySelectorAll('#hand .group')].filter(el => el.querySelector('.card[data-id="y2"]'))[0]; if (g) g.click(); });
    await wait(200);
    await clickFight(p);   // two-state button (epic step 20) — see fightclick.js
    /* POLL GENEROUSLY AND SAY WHY ON FAILURE. Measured: the window opens at ~4.0s — `revealDwell` is 2650ms
       and the Rival's turn runs before it — so the first budget here (6.3s) was only 1.6x the real figure,
       which CLAUDE.md's own margin rule calls a green run one slow machine away from red. 15s, and a
       null return carries the board state, because "no modal" and "no cast" fail identically otherwise. */
    for (let i = 0; i < 150; i++) {
      const m = await p.evaluate(() => {
        const el = document.getElementById('modal');
        if (!el || !el.offsetParent) return null;
        /* RETURN THE WHOLE TEXT. Slicing to 160 chars cut off before the BUTTONS — the modal leads with the
           cast and the table context, so "Counter Spell" appears well past that. The control then failed on
           a window that had opened correctly, which reads exactly like the feature being broken. */
        /* MATCH THE *RESPOND* WINDOW, NOT ANY MODAL TITLED "Respond?" (epic step 18). Fight End is now a
           go-round in the SAME modal, and the staged lead here is the apex 2 — unbeatable, so the Rival
           passes and the round ends in the very next beat. A bare /Respond/ therefore matched
           "You won the round with Jab — no shield is lost", which is a DIFFERENT timing with its own
           preference: the negative below failed while the feature worked, and the control could have
           passed on that same wrong window. "in response" is the cast lead's own wording. */
        const t = (el.textContent || '').replace(/\s+/g, ' ');
        return /Respond/i.test(t) && /in response/i.test(t) ? t : null;
      });
      if (m) return m;
      await wait(100);
    }
    lastBoard = await p.evaluate(() => { const st = window.__solo.st();
      return st ? ('turn=' + st.turn + ' pending=' + !!st.pending + ' respondFor=' + st.respondFor + ' finished=' + !!st.finished) : 'no state'; });
    return null;
  }
  let lastBoard = '';

  // (a) the CONTROL — with the default preference ON, the window must appear. Without this half, (b) below
  //     passes on a build where the window never opens for any reason at all.
  /* THE TWO PER-CARD SETUP LINES THAT SAT HERE WENT WITH THE ROWS (2026-09-30). They ticked `respond` on
     and `resolution` off for Counter Spell so each half of the pair meant one thing; with no rows, the
     timing a card speaks at is decided by its STAKE and there is nothing to tick. */
  const withPrompt = await stageCast();
  ok(!!withPrompt && /Counter Spell/.test(withPrompt),
     'CONTROL: with the prompt ON, the Rival’s cast opens the Respond? window offering Counter Spell' +
     (withPrompt ? '' : '  ← no window opened, so the negative below would prove nothing. Board: ' + lastBoard));
  await p.evaluate(() => { const d = document.getElementById('respDecline'); if (d && !d.disabled) d.click(); });
  await wait(400);

  /* (b) IS DELETED, AND ITS HISTORY IS WHY THAT IS WORTH A TOMBSTONE RATHER THAN A QUIET REMOVAL. It
     asserted *"A LIVE STAKE OUTRANKS AN UNTICKED BOX"*, and it had already INVERTED once — on 2026-09-25,
     when Aj gave Counter Spell a stake and a card with a live stake stopped being suppressible by a
     checkbox. I briefly "fixed" that red by narrowing the stake override to shields, which made the
     checkbox work and broke the model; Aj asked *"why?"* and the rule answered it.
     WITH NO BOX THERE IS NOTHING FOR A STAKE TO OUTRANK, so the assertion has no subject left. Its
     substance — a rival's Technique opens the window and offers Counter Spell — is (a) above, and the
     SUPPRESSION half is asserted immediately below by the MODE, which is where it belonged all along.
     A twice-inverted assertion earns a note: read this before ever reintroducing a per-card preference. */
  /* …AND OFF IS THE ONE PLACE THAT DECLINES A STAKE. Same staging, mode switched — so the pair isolates
     the MODE as the only difference, which is the whole claim. */
  await p.evaluate(() => { window.__solo.setPromptMode('off'); });
  const modeOff = await stageCast();
  ok(modeOff === null,
     'SUPPRESSED BY THE MODE: with notifications OFF the same cast opens no modal — it is auto-passed' +
     (modeOff === null ? '' : '  ← still prompted with: ' + modeOff.slice(0, 140)));
  ok(await until(() => p.evaluate(() => { const st = window.__solo.st(); return !!st && st.respondFor == null; })),
     '…and no response window is left owed — the pass really happened');
  await p.evaluate(() => { window.__solo.setPromptMode('auto'); });

  ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('HARNESS ERROR: ' + e.message); process.exit(1); });
