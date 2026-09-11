/* fightclick.js — a SHARED HELPER, not a suite (the `nettest_lobby.js` / `lessonlib.js` convention).
 * Don't run it directly; `sweep.js` skips it by name.
 *
 * THE FIGHT BUTTON HAS TWO STATES SINCE epic step 20, AND EVERY SUITE THAT DROVE IT HAD ONE CLICK.
 * `▶ Next` in the Main Sub-Phase is a PHASE MOVE — it takes you to the Fight Sub-Phase and passes priority
 * on the way, playing nothing — and the same button then reads `⚔️ Fight`, which is what commits the cards.
 * (They were `Fight` then `Play` for half a day; Aj renamed them on 2026-09-11 because the word FIGHT
 * belongs on the press that throws the cards down, not on the one that walks you to the sub-phase.)
 * So the old idiom (select a card, click Fight, assert) now asserts against a board where nothing was played.
 * That is not a flake and it is not a product bug: it is the design Aj asked for (*"fight now would only
 * initiate moving to the fight sub-phase"*), and 48 suites have to learn the second press.
 *
 * READ THE LABEL; DO NOT COUNT CLICKS. The label IS the sub-phase, which makes this helper correct at three
 * different kinds of site with no per-site knowledge:
 *   - already in the Fight Sub-Phase → the first click plays, the label never becomes `Fight` again, done;
 *   - in the Main Sub-Phase → the first click moves, the label turns `Fight`, the second click plays;
 *   - a CONFIRM site (`pick` mode wires the same button to `confirmPick`) → the label is `Confirm`, never
 *     `Fight`, so the second click can never fire. That is what makes it safe to apply blanket.
 *
 * AND IT RETRIES, BECAUSE `busy` SWALLOWS A CLICK SILENTLY. The transition can open a response window, and
 * the board is dead until that settles — a helper without the retry is this repo's single most-repeated test
 * bug (`playAny`, `activateSpot`, `passTurn` each shipped without one and each presented as a product bug).
 *
 * IT REPORTS WHAT IT DID, for the same reason every other helper here does: a red run should explain itself.
 *   'played'   — the button reached `Fight` and was pressed, so cards really went down
 *   'moved'    — it transitioned but never offered `Fight` (no legal selection, or a window is still open)
 *   'no-move'  — the click did nothing: refused, not your turn, or the board is someone else's
 *   'no-button'— absent or disabled before we touched it
 */
'use strict';

/* A HANG GUARD, NOT A RACE: it returns the instant the label flips, and the `no-move` early exit below means
 * a refused click costs ~150ms rather than the whole budget, so a generous ceiling costs a passing run
 * nothing. That is this repo's poll-budget rule, and the first version of this file broke it at 1200ms.
 * 15s BECAUSE OF `netwindows.js`, NOT BECAUSE OF THE MACHINE, and the arithmetic is the whole point: the
 * transition go-round can open a window for a REMOTE seat, at which the host PARKS — and an unscripted
 * window is answered by `netwindows`' auto-pass only after its **6 second grace**. A 1200ms budget gave up
 * five seconds before the board could possibly come back, so `clickFight` reported `moved`, the play never
 * happened, and nine netplay suites failed on the staging line after it (`nettest_guard`: "control passed
 * to the client" — it never did). The cost is paid ONLY where a seat really holds a castable Quick, which
 * is the 1-turn-in-20 case; everywhere else the transition auto-advances and this returns immediately. */
const FIGHT_BUDGET = 15000;

async function clickFight(page, budgetMs) {
  return page.evaluate(async (budget) => {
    const btn = () => document.getElementById('fightBtn');
    const first = btn();
    if (!first || first.disabled) return 'no-button';
    const label = first.textContent;
    first.click();
    /* ONLY A `Fight` PRESS HAS ANYTHING TO WAIT FOR. `Play` and `Confirm` ARE the action, so polling after
       them is not merely wasted — it is WRONG, and `phantasmtest` is what proved it: the illusion really
       was conjured, then the Rival took the pile back during the time this spent watching a label that was
       never going to change, and the suite read a board one turn too late. The earlier claim that a
       Confirm site was safe "because the second click cannot fire" was true about the CLICK and blind to
       the DELAY. Return the moment the action is done. */
    if (label !== 'Next') return label === 'Fight' ? 'played' : 'confirmed';
    /* AND IT RE-CLICKS, BECAUSE `busy` SWALLOWS A CLICK SILENTLY AND LEAVES THE BUTTON LOOKING LIVE.
       `doFight` returns on `busy` with no message while `updateActions` may not have repainted yet, so the
       press lands on nothing and the board sits in the Main Sub-Phase looking ready — measured at 2014ms
       in the Initiative lesson. The first version of this helper clicked ONCE and read three idle polls as
       "refused", which is the exact bug `playAny` / `activateSpot` / `passTurn` each shipped with; it cost
       nine netplay suites, all reporting a staging line that had never run.
       THE TWO WAITS ARE DIFFERENT AND THE DISTINCTION IS THE WHOLE DESIGN:
         - button DISABLED → the board is working (busy, or the host is parked on a remote seat's window).
           Wait. Do not re-click. This is the case that needs the full budget.
         - button ENABLED and still reading `Next` → our press did nothing. Re-click, bounded, then give
           up — a genuinely refused press must not burn the whole budget. */
    /* THE TWO DISABLED STATES MEAN DIFFERENT THINGS, AND CONFLATING THEM COST A 300s TIMEOUT.
       A disabled `Next` is the board still resolving the transition — which, when a REMOTE seat holds a
       castable Quick, is the host parked until `netwindows` auto-passes after its 6s grace. That one needs
       the full budget.
       A disabled `Fight` means the transition is already DONE and the button is waiting on a selection that
       does not make a legal play — which is the normal answer in a probe loop trying every card in hand.
       Waiting 15s for it is how `browsertest` went from 40s to killed-at-300s. Bound it separately: ~3s
       covers a mid-settle repaint, and anything past that is the board telling you this play is illegal. */
    /* A RETRY MUST STOP THE MOMENT THE ACTION TOOK EFFECT, and an open modal is the loudest way it can.
       `fightenduitest` caught this: the pass landed, the Resolution window opened OVER the board, the
       button underneath was still enabled — and the retry pressed it again, which is a second action
       nobody asked for. A helper that re-clicks is only safe if it can tell "swallowed" from "worked". */
    const modalUp = () => { const o = document.getElementById('overlay'); return !!(o && o.classList.contains('show')); };
    /* THE DEAD-`Fight` CAP IS PAID ONCE PER CARD IN A PROBE LOOP, so it has to be small. At 60 polls (3s)
       it is invisible on a quiet machine and murderous under `-j 4`: `exporttest` bounds itself by 160
       UNPRODUCTIVE iterations, and 160 x 3s is eight minutes against `sweep.js`'s 300s cap — green and 20s
       alone, KILLED in the sweep. That is this repo's own rule inverted ("a slow machine should make a
       suite slower, never red"), and the cost was mine. 20 polls (1s) still covers a mid-settle repaint. */
    const until = Date.now() + budget, playCap = 20;
    let idle = 0, retries = 0, deadPlay = 0;
    while (Date.now() < until) {
      if (modalUp()) return 'moved';                      // a window opened on our press — that IS an effect
      const g = btn();
      if (g && g.textContent === 'Fight') {
        if (!g.disabled) { g.click(); return 'played'; }
        if (++deadPlay >= playCap) return 'moved';        // transitioned, but this selection cannot be played
      } else deadPlay = 0;
      if (g && g.textContent === 'Next' && !g.disabled) {
        if (++idle >= 6) { idle = 0; if (++retries > 12) return 'no-move'; g.click(); }
      } else idle = 0;
      await new Promise(r => setTimeout(r, 50));
    }
    return 'moved';
  }, budgetMs || FIGHT_BUDGET);
}

/* The whole old one-liner in one call: clear any stale selection, click the named cards (or the first card
 * in hand when `ids` is omitted), then drive the two-state button. A LEFTOVER SELECTION IS STAGED AS A
 * FIGHT — the v1.31.74 `nettest_actloop` bug — so the clear is not optional tidiness. */
async function selectAndFight(page, ids, budgetMs) {
  await page.evaluate(function (list) {
    var clr = document.getElementById('clearBtn'); if (clr && !clr.disabled) clr.click();
    [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function (c) { c.click(); });
    if (list && list.length) list.forEach(function (id) { var c = document.querySelector('#hand .card[data-id="' + id + '"]'); if (c) c.click(); });
    else { var one = document.querySelector('#hand .card'); if (one) one.click(); }
  }, ids || null);
  return clickFight(page, budgetMs);
}

/* PASS LIVES ONLY IN THE FIGHT SUB-PHASE SINCE epic step 20 (Aj: *"the Pass button only appears in the Fight
 * sub-phase"*), so in the Main Sub-Phase it is not rendered at all and the way to it is THROUGH Fight.
 * A suite that clicks `#passBtn` at the top of a turn is therefore clicking a button that is not on screen —
 * and `.disabled` is FALSE on a hidden button, so the usual `if(b && !b.disabled) b.click()` guard sails
 * straight past it and the click lands on nothing. `peektest` named it exactly: "DEAD: Pass cannot be pressed
 * [not rendered]".
 * READ `offsetParent`, NOT `disabled` — this repo's own rule for the rules-panel notes, and the same reason:
 * DOM presence is not visibility. The helper moves to the Fight Sub-Phase only when Pass is genuinely absent,
 * so a suite already in that sub-phase pays nothing, and a LOCKED seat (the one case that keeps its Pass in
 * the Main Sub-Phase, because `pass()` exempts it from the transition) is never moved. */
async function clickPass(page, budgetMs) {
  return page.evaluate(async (budget) => {
    const pass = () => document.getElementById('passBtn');
    const shown = () => { const b = pass(); return b && b.offsetParent !== null ? b : null; };
    const until = Date.now() + budget;
    /* SINCE THE AUTO-PASS LANDED, Pass is rendered in BOTH sub-phases, so this branch is dead on today's
       build and kept deliberately: it costs one poll and it is the whole difference between this helper
       and `passBtn.click()` if that rule is ever revisited. */
    if (!shown()) {
      const f = document.getElementById('fightBtn');
      if (f && !f.disabled && f.textContent === 'Next') f.click();
      while (Date.now() < until && !shown()) await new Promise(r => setTimeout(r, 50));
    }
    /* AND IT RETRIES, for the reason `clickFight` does: `doPass` returns on `busy` SILENTLY while
       `#passBtn` still renders enabled, so one click plus an assertion reads as "Pass is broken". */
    const modalUp = () => { const o = document.getElementById('overlay'); return !!(o && o.classList.contains('show')); };
    let idle = 0, clicks = 0;
    while (Date.now() < until) {
      if (clicks && modalUp()) return 'passed';           // a window opened on our press — see clickFight
      const b = shown();
      if (b && !b.disabled) {
        if (clicks === 0) { b.click(); clicks++; idle = 0; }
        else if (++idle >= 6) { idle = 0; if (++clicks > 12) return 'no-move'; b.click(); }
      } else { idle = 0; if (clicks) return 'passed'; }   // it went disabled after our click — the pass landed
      await new Promise(r => setTimeout(r, 50));
    }
    if (!shown()) return 'not-rendered';
    return clicks ? 'passed' : 'disabled';
  }, budgetMs || FIGHT_BUDGET);
}

/* `#fightBtn.disabled` STOPPED MEANING "THIS PLAY IS LEGAL", AND THAT IS THE SUBTLEST HALF OF step 20.
 * A dozen suites probe legality by selecting a card and reading the button: `c.click(); if(!f.disabled)
 * f.click()`. In the FIGHT Sub-Phase that is still exactly right. In the MAIN Sub-Phase the same button is
 * the PHASE MOVE and is enabled with nothing selected at all — so the probe clicks it on the first card it
 * tries, transitions, and reports a play that never happened. `nettest_log` said so precisely: the client
 * "found a legal jab" and then had no log line for it.
 * `enterFight` is the one-line repair, and it is deliberately NOT a rewrite of those loops: once the board
 * is in the Fight Sub-Phase the button reads `Fight` and `disabled` answers the original question again, so
 * every probe keeps its own logic and its own diagnostics. Idempotent — already there, it does nothing.
 * IT NEVER PLAYS. `clickFight` would press a live `Fight` and spend whatever happened to be selected; this
 * only ever presses a button reading `Next`. */
async function enterFight(page, budgetMs) {
  return page.evaluate(async (budget) => {
    const btn = () => document.getElementById('fightBtn');
    if ((btn() || {}).textContent === 'Fight') return 'already';
    const until = Date.now() + budget;
    let idle = 0, clicks = 0;
    while (Date.now() < until) {
      const f = btn();
      if (f && f.textContent === 'Fight') return clicks ? 'entered' : 'already';   // `Fight` at all means we are there — enabled or not
      /* RE-CLICK ONLY WHILE IT LOOKS LIVE, and wait patiently while it is disabled — see `clickFight` for
         why those are two different situations. A swallowed press leaves the button enabled; a working
         board leaves it disabled. */
      if (f && f.textContent === 'Next' && !f.disabled) {
        if (++idle >= 6) { idle = 0; if (++clicks > 12) return 'stuck'; f.click(); }
      } else idle = 0;
      await new Promise(r => setTimeout(r, 50));
    }
    return clicks ? 'stuck' : 'no-button';       // never reached Play: not our turn, locked out, or a pick is open
  }, budgetMs || FIGHT_BUDGET);
}

/* SOME SUITES DRIVE THE BOARD FROM INSIDE THE PAGE, and those cannot call the helpers above at all.
 * `browsertest`, `exporttest`, `nettest_sync`, `prompttest` and friends hand `page.evaluate` one big decision
 * function — look at the board, pick an action, do it — so the two-state button has to be understood in page
 * context. Installing ONE definition beats eight inline copies of the same retry loop, which is how
 * `playAny` / `activateSpot` / `passTurn` each ended up missing theirs.
 * `addInitScript` runs before every document load, so it survives navigation and reload; call it once, right
 * after the page is created, then use `await window.__pressFight()` / `await window.__pressPass()` in place of
 * a bare `fightBtn.click()` / `passBtn.click()`. Both return true only if the ACTION really happened, which is
 * the distinction a driver needs: a transition is not a play. */
/* THE BUDGET IS AN ARGUMENT, AND SOLO DRIVERS MUST NOT PAY THE NETPLAY ONE (2026-09-11).
 * The 15s ceiling exists for ONE situation: a transition that opens a window for a REMOTE seat parks the
 * host until `netwindows` auto-passes after its 6s grace. A SOLO driver has no remote seat and can never
 * park, so every second of that ceiling is waste — and it is waste paid PER ATTEMPT inside a probe loop.
 * `exporttest` bounds itself by 160 UNPRODUCTIVE iterations: at 15s each that is forty minutes, which is
 * why it ran 20s alone and was KILLED at `sweep.js`'s 300s cap twice. The first fix capped only the
 * post-transition case (a disabled `Fight`); the expensive one is PRE-transition, where the button sits
 * disabled and `idle` never advances — `idle` only counts while the button looks live.
 * So: 5s by default, comfortably over the 2014ms busy window measured in the Initiative lesson, and the
 * two in-page drivers that really are netplay pass the long one explicitly. */
async function installPageHelpers(page, budgetMs) {
  await page.addInitScript((budget) => {
    const el = id => document.getElementById(id);
    const nap = () => new Promise(r => setTimeout(r, 50));
    window.__pressFight = async function () {
      const a = el('fightBtn');
      if (!a || a.disabled) return false;
      if (a.textContent === 'Fight') { a.click(); return true; }   // already in the Fight Sub-Phase — that click IS the play
      if (a.textContent !== 'Next') { a.click(); return true; }  // Confirm — the action, with nothing to wait for
      a.click();
      const modalUp = () => { const o = el('overlay'); return !!(o && o.classList.contains('show')); };
      let idle = 0, clicks = 0, deadPlay = 0;
      for (let i = 0, lim = Math.ceil(budget / 50); i < lim; i++) {
        if (modalUp()) return false;                      // a window opened on our press — no play happened yet                             // 15s ceiling: a remote seat's window parks the host for ~6s
        const g = el('fightBtn');
        if (g && g.textContent === 'Fight') {
          if (!g.disabled) { g.click(); return true; }
          if (++deadPlay >= 12) return false;                     // ~600ms — paid once per card in a probe loop, so it must stay small; see clickFight
        } else deadPlay = 0;
        if (g && g.textContent === 'Next' && !g.disabled) {
          if (++idle >= 6) { idle = 0; if (++clicks > 12) return false; g.click(); }   // swallowed by `busy` — press again
        } else idle = 0;
        await nap();
      }
      return false;
    };
    window.__pressPass = async function () {
      const vis = () => { const b = el('passBtn'); return b && b.offsetParent !== null ? b : null; };
      if (!vis()) {                                   // kept for the case Pass is ever gated to one sub-phase again
        const f = el('fightBtn');
        if (f && !f.disabled && f.textContent === 'Next') f.click();
        for (let i = 0, lim = Math.ceil(budget / 50); i < lim && !vis(); i++) await nap();
      }
      const b = vis();
      if (!b || b.disabled) return false;
      b.click();
      return true;
    };
  }, budgetMs || 5000);
}

module.exports = { clickFight, selectAndFight, clickPass, enterFight, installPageHelpers, FIGHT_BUDGET };
