/* fightclick.js — a SHARED HELPER, not a suite (the `nettest_lobby.js` / `lessonlib.js` convention).
 * Don't run it directly; `sweep.js` skips it by name.
 * It also carries the visible-only Respond? window reads (`respQuicks`, `clickQuick`, `windowUp`,
 * `clickDecline`) — see the end of the file for why a plain `querySelector` is wrong there.
 *
 * THE FIGHT BUTTON HAS ONE STATE AGAIN SINCE drag-and-stack step 1. From epic step 20 it read `▶ Next` in the
 * Main Sub-Phase (a phase move that played nothing) and `⚔️ Fight` once there; Next is gone, so the button only
 * ever reads `Fight` (or `Confirm`, when a `pick` wires it to `confirmPick`). It is ENABLED ONLY FOR A LEGAL
 * SELECTION in either sub-phase, so with nothing chosen it is disabled — the empty crossing a suite used to
 * make with it no longer exists, and `enterFight`, the helper that made it, is deleted.
 * One press from Main still crosses into the Fight Sub-Phase first (a priority point) and then plays; when
 * somebody else casts into that crossing the play is HELD, the cards stay selected, and nothing went down.
 *
 * AND IT RETRIES, BECAUSE `busy` SWALLOWS A CLICK SILENTLY. The crossing can open a response window, and
 * the board is dead until that settles — a helper without the retry is this repo's single most-repeated test
 * bug (`playAny`, `activateSpot`, `passTurn` each shipped without one and each presented as a product bug).
 *
 * IT REPORTS WHAT IT DID, for the same reason every other helper here does: a red run should explain itself.
 *   'played'    — the selected cards left the hand (or a window opened over the board on our press)
 *   'confirmed' — the button was a `Confirm` and was pressed
 *   'waiting'   — the press took effect and the table is waiting on ANOTHER seat's answer at the crossing
 *   'no-move'   — the click did nothing: refused, held, not your turn, or the board is someone else's
 *   'no-button' — absent or disabled before we touched it (with nothing selected, it always is)
 */
'use strict';

/* A HANG GUARD, NOT A RACE: it returns the instant the cards leave the hand, so a generous ceiling costs a
 * passing run nothing. That is this repo's poll-budget rule, and the first version of this file broke it at
 * 1200ms. 15s BECAUSE OF `netwindows.js`, NOT BECAUSE OF THE MACHINE: the crossing go-round can open a window
 * for a REMOTE seat, at which the host PARKS — and an unscripted window is answered by `netwindows`'
 * auto-pass only after its **6 second grace**. The cost is paid ONLY where a seat really holds a castable
 * Quick, which is the 1-turn-in-20 case; everywhere else the crossing auto-advances. */
const FIGHT_BUDGET = 15000;

/* EVERY CAST HOLDS THE BOARD FOR ITS ART FLASH (drag-and-stack ruling 20), and Fight and Pass are DISABLED while it
   runs — so a press made inside it is not swallowed, it is refused, and `clickFight` reads that as 'no-button'.
   Both helpers wait the hold out first, inside the page, through whichever hook the page has. A hold is at most a
   card's flash (2.5s), so this is a wait on a TIMER and never stretches with load. Written out in both helpers,
   because a `page.evaluate` body cannot call a function defined out here.
   ⚠ AND IT WAITS ONE BEAT PAST THE HOLD. The board is re-rendered by a timer ~15ms AFTER the hold's end, so for
   that moment `castHold()` reads 0 while Fight is still the disabled button the hold drew — and `.click()` on a
   disabled button does nothing at all. `nettest_heldplay3` lost exactly that race about one run in five. */

async function clickFight(page, budgetMs) {
  return page.evaluate(async (budget) => {
    const hold = () => { const h = (window.__cmf && window.__cmf.castHold) || (window.__solo && window.__solo.castHold); return h ? h() : 0; };
    if (hold() > 0) { for (let i = 0; i < 120 && hold() > 0; i++) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 80)); }   // a cast's art flash still holds the board — then one beat for its re-render
    const btn = () => document.getElementById('fightBtn');
    const first = btn();
    if (!first || first.disabled) return 'no-button';
    const label = first.textContent;
    const modalUp0 = function () { const o = document.getElementById('overlay'); return !!(o && o.classList.contains('show')); };
    /* REMEMBER WHAT WE ARE PLAYING, so a swallowed `Fight` can be told from a played one (2026-09-16) —
       the cards leaving the hand is the only evidence that distinguishes them. */
    /* A GROUP SELECTION MARKS THE GROUP (`.gsel`), NOT ITS CARDS (`.sel`), so read both — reading `.card.sel`
       alone saw a selected PAIR as "nothing selected" (measured: four lesson suites reported a pair that had in
       fact been played as never landing). The old helper hid it by calling any such press 'played'. */
    const sel = [].slice.call(document.querySelectorAll('#hand .card.sel, #hand .group.gsel .card')).map(function (c) { return c.dataset.id; })
      .filter(function (id, i, a) { return id && a.indexOf(id) === i; });
    const stillHeld = function () { return sel.some(function (id) { return !!document.querySelector('#hand .card[data-id="' + id + '"]'); }); };
    first.click();
    /* ONLY A `Fight` PRESS HAS ANYTHING TO WAIT FOR. `Play` and `Confirm` ARE the action, so polling after
       them is not merely wasted — it is WRONG, and `phantasmtest` is what proved it: the illusion really
       was conjured, then the Rival took the pile back during the time this spent watching a label that was
       never going to change, and the suite read a board one turn too late. The earlier claim that a
       Confirm site was safe "because the second click cannot fire" was true about the CLICK and blind to
       the DELAY. Return the moment the action is done. */
    /* A `Fight` PRESS WAS FIRE-AND-FORGET, AND THAT IS WHERE `nettest_guard`'S FLAKE LIVED (2026-09-16).
       `busy` swallows a Fight click silently, so a swallowed press returned `'played'`, the caller believed
       it, and the failure surfaced SEVEN SECONDS LATER at whatever assertion waited on the turn: `control
       passed to the client to answer the combo`, which is why it read as a transport fault. Measured on the
       epic before this fix: 4 red in 8 SOLO.
       VERIFY THE ACTION, DO NOT TRUST THE CLICK. The cards leaving the hand is the effect; a modal opening
       over the board is one too. Re-click ONLY while the cards are still in hand AND the button is still an
       enabled `Fight`, because a blind re-click is a second play nobody asked for. (A press HELD by somebody
       else's cast also leaves an enabled `Fight` over the still-selected cards; the re-click then plays them
       in the Fight Sub-Phase, which is what the old helper did too.)
       THE TWO WAITS ARE DIFFERENT, AND CONFLATING THEM ONCE COST A 300s TIMEOUT:
         - button DISABLED → the board is working: the crossing's go-round may have parked the host on a
           REMOTE seat's window until `netwindows` passes it after its 6s grace. Wait the full budget.
         - button ENABLED and our cards still in hand → the press did nothing. Re-click, bounded, then give
           up — a genuinely refused press must not burn the whole budget. Before drag-and-stack step 1 this
           branch was capped at 4s, which was safe only because suites crossed with `Next` first; a press from
           Main can park now, so the cap moved onto the enabled case alone. */
    if (label === 'Fight') {
      if (!sel.length) return 'no-move';                    // unreachable while enabled — the button needs a legal selection
      const until = Date.now() + budget;
      let tries = 0;
      /* ANOTHER SEAT DECIDING IS AN ANSWER TOO. When the crossing opens a window for a REMOTE seat, the host parks
         and its play waits on that seat; the page says so ("<name> is deciding…" on the play area's notice
         layer). Waiting out the whole budget there blocked the caller past `netwindows`' 6s grace, so the
         window it meant to drive was auto-passed before it could look (`nettest_prefightduel`). Report it. */
      const othersDeciding = () => { const fx = document.getElementById('roundfx'); return !!(fx && /trimwait/.test(fx.className) && /deciding/.test(fx.textContent || '')); };
      while (Date.now() < until) {
        if (modalUp0()) return 'played';
        if (!stillHeld()) return 'played';
        if (othersDeciding()) return 'waiting';
        const g2 = btn();
        if (g2 && !g2.disabled && g2.textContent === 'Fight') { if (++tries > 8) return 'no-move'; g2.click(); }
        await new Promise(r => setTimeout(r, 60));
      }
      return stillHeld() ? 'no-move' : 'played';
    }
    return 'confirmed';                                     // `Confirm` IS the action — return the moment it is done
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

/* PASS IS RENDERED IN BOTH SUB-PHASES (the auto-pass, Aj 2026-09-11), and from Main one press crosses into the
 * Fight Sub-Phase and passes. READ `offsetParent`, NOT `disabled`: `.disabled` is FALSE on a hidden button, so
 * the usual `if(b && !b.disabled) b.click()` guard sails past a button that is not on screen (`peektest` once
 * named it: "DEAD: Pass cannot be pressed [not rendered]"). The old fallback that reached a hidden Pass through
 * `Next` went with Next (drag-and-stack step 1); a hidden Pass now just waits to be shown. */
async function clickPass(page, budgetMs) {
  return page.evaluate(async (budget) => {
    const hold = () => { const h = (window.__cmf && window.__cmf.castHold) || (window.__solo && window.__solo.castHold); return h ? h() : 0; };
    if (hold() > 0) { for (let i = 0; i < 120 && hold() > 0; i++) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 80)); }   // a cast's art flash still holds the board — then one beat for its re-render
    const pass = () => document.getElementById('passBtn');
    const shown = () => { const b = pass(); return b && b.offsetParent !== null ? b : null; };
    const until = Date.now() + budget;
    while (Date.now() < until && !shown()) await new Promise(r => setTimeout(r, 50));
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

/* `enterFight` WAS HERE AND IS DELETED (drag-and-stack step 1). It pressed `Next` to step out of Main, because
 * from epic step 20 `#fightBtn.disabled` stopped meaning "this play is legal" in Main (the button was the phase
 * move and was enabled with nothing selected), and a dozen probes read legality by selecting a card and
 * reading the button. Fight is enabled only for a legal selection in BOTH sub-phases now, so that probe
 * answers its own question again from Main, and there is no crossing left to make without playing. */

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
      const modalUp = () => { const o = el('overlay'); return !!(o && o.classList.contains('show')); };
      /* A `Fight` PRESS IS NOT ALWAYS A SYNCHRONOUS PLAY (2026-09-16). From the MAIN Sub-Phase it opens the
         Main → Fight go-round and plays when that auto-advances, and HOLDS the play if somebody acts. So
         `a.click(); return true;` would report a play that had not happened yet and might never happen,
         which breaks this helper's one promise: *"returns true only if the ACTION really happened."*
         WATCH THE CARDS LEAVE THE HAND, not the button. The selected ids are the precise evidence: a hand
         COUNT can be restored by the round draw, and the label reads `Fight` either way. An enabled `Fight`
         always has a selection since drag-and-stack step 1 — the empty crossing that was `Next` is gone. */
      if (a.textContent === 'Fight') {
        const selIds = [].slice.call(document.querySelectorAll('#hand .card.sel, #hand .group.gsel .card')).map(e => e.dataset.id)
          .filter((id, i, a) => id && a.indexOf(id) === i);           // a group selection marks the GROUP — see clickFight
        if (!selIds.length) return false;                         // unreachable while enabled; never a move
        a.click();
        for (let i = 0, lim = Math.ceil(budget / 50); i < lim; i++) {
          if (modalUp()) return false;                            // held by somebody's answer — no play happened
          if (selIds.every(id => !document.querySelector('#hand .card[data-id="' + id + '"]'))) return true;
          await nap();
        }
        return false;
      }
      a.click(); return true;                                     // Confirm — the action, with nothing to wait for
    };
    window.__pressPass = async function () {
      const vis = () => { const b = el('passBtn'); return b && b.offsetParent !== null ? b : null; };
      for (let i = 0, lim = Math.ceil(budget / 50); i < lim && !vis(); i++) await nap();
      const b = vis();
      if (!b || b.disabled) return false;
      b.click();
      return true;
    };
  }, budgetMs || 5000);
}

/* ---- THE RESPOND? WINDOW: VISIBLE, NEVER MERELY PRESENT (respquick-hidden-button-clicks, 2026-10-12) ----
 * A CLOSED WINDOW LEAVES ITS BUTTONS IN THE PAGE. `hideOverlay()` only takes `show` off `#overlay`; `#modal`'s
 * markup stays until the next `showModal` replaces it (`m.innerHTML=html`), and `.click()` on a hidden button
 * still runs its handler. So `querySelector('.respQuick')` finds the PREVIOUS window's button the moment it
 * looks. Measured once, and it went GREEN: `nettest_clientride`'s first cut "cast" Armor Piercing 3ms after the
 * Ride, before the host held priority; the engine answered "No response window.", the real window then opened
 * unwatched, `netwindows` passed it after its grace, and the leg passed having cast nothing.
 * `offsetParent` is null inside the hidden overlay, and that is the whole test. It is ALSO null for a
 * `position:fixed` element. None of these buttons is one, but `#tutPanel` is, so do not borrow the idiom there
 * (`lessontest_phases` measures that panel with its rect).
 * TWO SHAPES NEED NO HELPER. A read behind `#overlay.show` or a visible `#modal` in the SAME `evaluate` is
 * already visible-only, because that window's markup replaced the old one when it opened. And a NEGATIVE check
 * on a fresh page ("no window ever opened") is the one place PRESENCE is right: a closed window's button still
 * proves it opened, so presence can only fail loudly, never pass by accident.
 * Inside a larger `evaluate`, inline the same test:
 *   [].some.call(document.querySelectorAll('.respQuick,#respDecline'), b => b.offsetParent !== null) */
/* WHAT THIS SEAT IS OFFERED IN THE WINDOW ON SCREEN (drag-and-stack step 4, piece 8). The box stops listing the Quicks
 * (it shrinks to its sentence and Yes / No), so reading its buttons would see nothing. This is the engine's castable
 * list, named, but ONLY while a window is SHOWN to this seat — its box is up, or it pressed Yes and answers from the
 * board. Reading the engine alone would also see a window an AUTO seat is about to pass, which a suite asserting
 * silence must not. Each entry is `"<effect name> · <card id>"`. */
function respQuicks(page) {
  return page.evaluate(() => {
    const H = window.__cmf || window.__solo; if (!H || !H.castableQuicks) return [];
    const d = document.getElementById('respDecline'), shown = !!(d && d.offsetParent !== null) || !!(H.answering && H.answering());
    if (!shown || !(H.holdsPriority && H.holdsPriority())) return [];
    return H.castableQuicks().map(q => q.name + ' · ' + q.id);
  });
}
/* CAST A QUICK INTO THIS SEAT'S WINDOW, FROM THE BOARD (drag-and-stack step 4, piece 8). `text` is the effect name (a
 * RegExp, or a string matched without case) or an options object `{name, id, seat, equip, pitch, oid}`: WHAT you mean to
 * cast and at what — `seat` a rival, `equip` your Equipment, `pitch` the Broadway card, `oid` the stack object a Counter
 * Spell names. It presses Yes (waiting out the cast's flash, which the box waits for too), taps the card, presses ⚡,
 * makes the answer's choice by clicking the real target — the rival's panel, the Equipment box, the card to pitch, the
 * stack card — and confirms. Returns a label starting with the effect name, or null when nothing was cast.
 * IT CHECKS THE CARD IS CASTABLE BEFORE IT PRESSES YES. Several suites call this in a polling loop; pressing Yes on a
 * window the caller did not mean to answer would leave that window open on the board, where only `netwindows`' grace
 * would pass it. A choice left unnamed takes the first candidate, which is what the box's first button was. */
function clickQuick(page, text, sel) {
  let o = {};
  if (text && typeof text === 'object' && !(text instanceof RegExp)) o = Object.assign({}, text);
  else if (text != null) o.name = text;
  const nameSrc = o.name == null ? null : (o.name instanceof RegExp ? o.name.source : String(o.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  const nameFlags = o.name instanceof RegExp ? o.name.flags : 'i';
  return page.evaluate(async (a) => {
    const W = ms => new Promise(r => setTimeout(r, ms)), vis = el => !!(el && el.offsetParent !== null);
    const H = window.__cmf || window.__solo; if (!H || !H.castableQuicks) return null;
    const holds = () => !!(H.holdsPriority && H.holdsPriority()), answering = () => !!(H.answering && H.answering());
    if (!holds()) return null;                                             // no window is this seat's
    const want = q => (a.id == null || q.id === a.id) && (a.nameSrc == null || new RegExp(a.nameSrc, a.nameFlags).test(q.name)) &&
      (a.seat == null || q.kind === 'lockout') && (a.equip == null || q.kind === 'protect') && (a.oid == null || q.kind === 'counter') && (a.pitch == null || q.pitch);
    const q = H.castableQuicks().filter(want)[0]; if (!q) return null;     // not castable here: change nothing
    const t0 = Date.now();
    while (!answering() && Date.now() - t0 < 9000) {                       // the box opens when the cast's flash ends
      const y = document.getElementById('respYes');
      if (vis(y) && !y.disabled) { y.click(); await W(150); continue; }
      if (!holds()) return null;
      await W(80);
    }
    if (!answering()) return null;
    const card = document.querySelector('#hand .card[data-id="' + q.id + '"]'), grp = card && card.closest('.group');
    if (!grp) return null;
    grp.click(); await W(150);
    const ctx = document.getElementById('ctxBtn');
    if (!vis(ctx) || ctx.disabled || ctx.classList.contains('off')) return null;
    ctx.click(); await W(200);
    let label = q.name;
    const pk = H.answerPick && H.answerPick();
    if (pk) {                                                              // the answer's choice: make it, then confirm
      const v = pk.kind === 'counter' ? (a.oid != null ? a.oid : (pk.chosen != null ? pk.chosen : pk.cands[0]))
        : pk.kind === 'seat' ? (a.seat != null ? a.seat : pk.cands[0])
        : pk.kind === 'equip' ? (a.equip != null ? a.equip : pk.cands[0])
        : (a.pitch != null ? a.pitch : pk.cands[0]);
      const el = pk.kind === 'counter' ? document.querySelector('#stackView .stkCard[data-oid="' + v + '"] .card')
        : pk.kind === 'seat' ? (document.querySelector('.oppPanel[data-seat="' + v + '"]') || document.getElementById('rival'))
        : pk.kind === 'equip' ? document.querySelector('.eq.targetable[data-eid="' + v + '"]')
        : document.querySelector('#hand .card[data-id="' + v + '"]');
      if (!el) return null;
      if (!(pk.kind === 'counter' && pk.chosen === v)) { el.click(); await W(150); }
      const go = document.getElementById(pk.kind === 'pitch' ? 'fightBtn' : 'ctxBtn');
      if (!go || go.disabled || go.classList.contains('off')) return null;
      go.click();
      label += ' · ' + pk.kind + ' ' + v;
    }
    return label;
  }, { id: o.id == null ? null : o.id, nameSrc: nameSrc, nameFlags: nameFlags, seat: o.seat == null ? null : o.seat,
       equip: o.equip == null ? null : o.equip, pitch: o.pitch == null ? null : o.pitch, oid: o.oid == null ? null : o.oid });
}
/* THE ENGINE'S ANSWER, NOT THE BOX'S BUTTONS (step 4, piece 1): what this seat could cast into the window right now,
   `[{id, name}]`, read through `castableQuicks` on `__cmf` (netplay) or `__solo`. The box stops listing them in step 4,
   so a suite that asks "is Leyline on offer?" asks this instead. */
function castableQuicks(page) {
  return page.evaluate(() => { const h = (window.__cmf && window.__cmf.castableQuicks) || (window.__solo && window.__solo.castableQuicks); return h ? h() : null; });
}
// does this seat hold priority right now (a window is owed to it), whether or not a box is on screen
function holdsPriority(page) {
  return page.evaluate(() => { const h = (window.__cmf && window.__cmf.holdsPriority) || (window.__solo && window.__solo.holdsPriority); return h ? h() : null; });
}
/* A Respond? window is open for this seat: its box is on screen, OR the seat pressed Yes and is answering from the
   board (drag-and-stack step 4, `answering()`), which leaves no box up. */
function windowUp(page) {
  return page.evaluate(() => [].some.call(document.querySelectorAll('.respQuick,#respDecline'), b => b.offsetParent !== null) ||
    !!((window.__cmf && window.__cmf.answering && window.__cmf.answering()) || (window.__solo && window.__solo.answering && window.__solo.answering())));
}
/* Decline the window: the box's "Let it resolve" while it is on screen and live, or — after Yes — the board's Pass,
   which declines priority there. True when one was pressed. */
function clickDecline(page) {
  return page.evaluate(() => {
    const d = document.getElementById('respDecline');
    if (d && d.offsetParent !== null && !d.disabled) { d.click(); return true; }
    const ans = (window.__cmf && window.__cmf.answering) || (window.__solo && window.__solo.answering), pb = document.getElementById('passBtn');
    if (ans && ans() && pb && !pb.disabled) { pb.click(); return true; }
    return false;
  });
}

/* ---- ONE DRIVER STEP: keep an ordinary game moving, whatever the board is waiting on (2026-10-13) ----
 * Born as `mptest`'s `driveOnce` and moved here when `nettest_ceremony` needed the same thing: its wait for the
 * strip to leave Clean-up timed out in a sweep, because a seat sat on its end-of-round pick and nothing in that
 * suite answers one. A second hand-rolled copy is how two answers drift apart, so both suites call this.
 * In order: decline a VISIBLE Respond? window; answer a pick; press an enabled Fight; try each group; pass.
 * A PICK (a forced discard, the clean-up trim) RENDERS BARE CARDS, NO GROUPS — so the group loop can never
 * answer it, and `mptest`'s driver sat there until its idle guard fired. Its own stall line named it on the
 * first sweep: `discard:{player:0,count:2}`, Fight reading "Confirm (off)". Select eligible cards until Confirm
 * lights, then confirm (mptest-phase-strip-stalls-under-load). It PASSES and never casts, like `netwindows`,
 * because choosing a card would change what the calling suite measures. */
function driveStep(page) {
  return page.evaluate(() => {
    const d = document.getElementById('respDecline');
    if (d && d.offsetParent && !d.disabled) { d.click(); return; }
    const fb = document.getElementById('fightBtn'), pb = document.getElementById('passBtn');
    const ans = (window.__cmf && window.__cmf.answering) || (window.__solo && window.__solo.answering);
    if (ans && ans()) { if (pb && !pb.disabled) pb.click(); return; }   // after Yes: Pass declines priority (step 4)
    if (fb && /Confirm/.test(fb.textContent)) {
      if (!fb.disabled) { fb.click(); return; }
      for (const c of [].slice.call(document.querySelectorAll('#hand .card:not(.notpick):not(.picked)'))) { c.click(); if (!fb.disabled) { fb.click(); return; } }
      return;
    }
    if (fb && !fb.disabled) { fb.click(); return; }
    for (const g of [].slice.call(document.querySelectorAll('#hand .group'))) {
      g.click(); if (fb && !fb.disabled) { fb.click(); return; }
      const c = document.getElementById('clearBtn'); if (c && !c.disabled) c.click(); }
    if (pb && !pb.disabled) pb.click();
  });
}

/* WAIT OUT A CAST'S HOLD (ruling 20). For a suite that casts and then acts in its own code rather than through
   `clickFight` / `clickPass`: the next play, cast or pass is refused until the flash ends. True when it ended. */
async function waitHold(page, budgetMs) {
  return page.evaluate(async (budget) => {
    const hold = () => { const h = (window.__cmf && window.__cmf.castHold) || (window.__solo && window.__solo.castHold); return h ? h() : 0; };
    const until = Date.now() + budget;
    if (hold() > 0) { while (hold() > 0 && Date.now() < until) await new Promise(r => setTimeout(r, 50)); await new Promise(r => setTimeout(r, 80)); }   // …and one beat for the board's re-render
    return hold() === 0;
  }, budgetMs || 6000);
}

module.exports = { clickFight, selectAndFight, clickPass, installPageHelpers, FIGHT_BUDGET, waitHold,
                   respQuicks, clickQuick, windowUp, clickDecline, driveStep, castableQuicks, holdsPriority };
