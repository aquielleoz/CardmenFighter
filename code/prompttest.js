/* PROMPT PREFERENCES — epic/priority-windows, step 15 (Q11).
 *
 * Aj: *"i imagine that it will get annoying very quick (pun intended). by default, all prompts will be off,
 * but in the card reader box you can check when you'd like to be prompted."* The rebuilt Fight End window
 * offers EVERY Quick to everyone holding priority, so without this a player is asked about every card they
 * hold, every round.
 *
 * THE TWO CLAIMS THIS SUITE EXISTS FOR, and they pull in opposite directions:
 *   1. THE DEFAULT EXPERIENCE IS TODAY'S. Every prompt is on for the timing that card already had and off
 *      for the rest, so a player who never opens the reader sees no change at all. A suite that only proved
 *      the checkboxes work would happily pass on a build that had silenced Counter Spell.
 *   2. AN UNCHECKED TIMING IS AN AUTO-PASS, NOT A SKIPPED WINDOW. The window still opens and priority is
 *      genuinely passed — this is a notification layer, not a rules layer. Asserted as the game CONTINUING
 *      after the prompt is suppressed, because a window nobody answers looks identical to one nobody wanted
 *      right up until the table deadlocks.
 *
 * Run: node prompttest.js
 */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const path = require('path');
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
  p.on('pageerror', e => errs.push(e.message));
  let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; };

  /* A GAME MUST BE RUNNING BEFORE ANY DEFAULT CAN BE READ, and the first version of this suite did not start
     one. `promptDefault` asks the ENGINE whether a card can guard (`guardEffFor`), which needs live state —
     so with no game every Fight End default came back false and Leyline looked silenced. The suite was
     wrong, not the defaults. Same startup as `peektest`. */
  await p.goto(URL);
  await until(() => p.evaluate(() => !!window.__solo));
  await p.evaluate(() => { try { localStorage.removeItem('cmf_prompts_v1'); } catch (e) {} });
  await p.reload();
  await until(() => p.evaluate(() => !!window.__solo));
  ok(await freshGame(p), 'a solo game is running — defaults are readable');

  /* ---- 1 · THE DEFAULTS, read through the same helper the prompt sites use. A fresh device has no stored
     preferences at all, so every answer here is a DEFAULT and not a remembered tick. */
  const D = await p.evaluate(() => {
    const C = (r, su) => ({ rank: r, suit: su, id: '' + r + su });
    const q = (c, t) => window.__solo.promptWanted(c, t);
    return {
      stored:        JSON.stringify(window.__solo.promptPrefs()),
      counterRespond: q(C(4, 'D'), 'respond'),    // Counter Spell — the classic response timing
      counterFightEnd: q(C(4, 'D'), 'fightend'),  // …but NOT at Fight End: it guards nothing
      leylineFightEnd: q(C(9, 'D'), 'fightend'),  // Leyline guards, so it still speaks — today's behaviour
      leylineRespond:  q(C(9, 'D'), 'respond'),
      counterPrefight: q(C(4, 'D'), 'prefight'),  // not a lockout Quick — the timing is not even legal
    };
  });

  ok(D.stored === '{}', 'a fresh device stores NO preferences — every answer below is a default (' + D.stored + ')');
  ok(D.counterRespond === true, 'default: Counter Spell is still offered when a Technique is cast — today’s experience');
  ok(D.leylineFightEnd === true, 'default: Leyline still speaks when shields are about to break — today’s experience');
  ok(D.counterFightEnd === false,
     'default: Counter Spell does NOT newly prompt at Fight End' +
     (D.counterFightEnd === false ? '' : '  ← the "annoying very quick" case: every Quick asking every round'));
  ok(D.counterPrefight === false, 'a timing that is not legal for the card is never wanted (Counter Spell pre-fight)');

  /* ---- 2 · THE READER RENDERS THE ROWS, and only for Quicks. `promptLegal` decides which rows exist, so a
     card with no legal timing must show no block at all rather than an empty one. */
  const R = await p.evaluate(() => {
    const C = (r, su) => ({ rank: r, suit: su, id: '' + r + su });
    const html = t => { window.__solo.showCard(t); const el = document.getElementById('cardView'); return el ? el.innerHTML : ''; };
    const quick = html(C(4, 'D'));            // Counter Spell — a Quick
    const plain = html(C(3, 'D'));            // Telekinesis — a Technique, not a Quick
    return {
      quickRows: (quick.match(/class="promptPref"/g) || []).length,
      quickHasHead: /Ask me to respond/.test(quick),
      plainHasBlock: /cvPrompts/.test(plain),
      note: /never changes the rules/.test(quick),
    };
  });
  ok(R.quickHasHead && R.quickRows === 2,
     'the reader offers the legal timings for a Quick (' + R.quickRows + ' rows: respond + fightend)');
  ok(!R.plainHasBlock, 'a non-Quick gets no block at all — a timing it can never be cast at is not a choice');
  ok(R.note, 'the reader says out loud that unchecked never changes the rules — it is a notification layer');

  /* ---- 3 · TICKING A BOX PERSISTS, and stores an OVERRIDE rather than the resolved value. Storing the
     resolved value would freeze today's defaults onto the device forever. */
  await p.evaluate(() => {
    const C = (r, su) => ({ rank: r, suit: su, id: '' + r + su });
    window.__solo.showCard(C(4, 'D'));
    const box = document.querySelector('.promptPref[data-timing="fightend"]');
    box.checked = true; box.dispatchEvent(new Event('change', { bubbles: true }));
  });
  const afterTick = await p.evaluate(() => ({
    stored: JSON.stringify(window.__solo.promptPrefs()),
    wanted: window.__solo.promptWanted({ rank: 4, suit: 'D', id: '4D' }, 'fightend'),
  }));
  ok(afterTick.wanted === true, 'ticking Fight End for Counter Spell takes effect');
  ok(/"fightend":true/.test(afterTick.stored) && !/"respond"/.test(afterTick.stored),
     'only the OVERRIDE is stored, not the resolved row (' + afterTick.stored + ')' +
     (/"respond"/.test(afterTick.stored) ? '  ← a later change to the DEFAULTS could never reach this device' : ''));

  /* A reload drops the game, which is fine here: this asserts PERSISTENCE, and `respond`/`prefight`
     defaults do not consult state. Re-start a game before anything reads a Fight End default again. */
  await p.reload();
  await until(() => p.evaluate(() => !!window.__solo));
  ok(await p.evaluate(() => window.__solo.promptWanted({ rank: 4, suit: 'D', id: '4D' }, 'fightend')) === true,
     '…and it survives a reload — the preference is per DEVICE');
  await freshGame(p);

  /* ---- 4 · THE LOAD-BEARING ONE. Unchecking a card's live timing must AUTO-PASS, and the game must keep
     moving. Counter Spell's `respond` row is the one timing that is live today, so switching it off and
     playing on is the only way to prove the suppression is a pass and not a stall. A deadlock here is
     silent — the board simply stops — which is exactly why this is asserted as PROGRESS, not as a modal
     being absent. */
  await p.evaluate(() => {
    window.__solo.setPromptPref('D4', 'respond', false);
    window.__solo.setPromptPref('D9', 'fightend', false);
  });
  ok(await p.evaluate(() => window.__solo.promptWanted({ rank: 4, suit: 'D', id: '4D' }, 'respond')) === false,
     'Counter Spell’s live timing is switched OFF');

  const moved = await p.evaluate(async () => {
    const $ = i => document.getElementById(i);
    const clear = () => { const c = $('clearBtn'); if (c && !c.disabled) c.click();
                          [].forEach.call(document.querySelectorAll('#hand .card.sel'), x => x.click()); };
    /* BOUNDED BY UNPRODUCTIVE ITERATIONS, NEVER BY A RAW COUNT — CLAUDE.md, v1.31.85 (`exporttest`):
       "an iteration whose click `busy` swallows spends budget while advancing nothing… bound by
       UNPRODUCTIVE iterations (reset the count on any progress) so a slow machine takes MORE of them
       rather than doing less."
       MEASURED, on this suite, in that order: a raw `i < 400` cap gave 8 failures in 40. Raising the stall
       tolerance from 25 to 100 while KEEPING the cap made it 14 in 40 — worse, because the loop then
       tolerated long busy stretches and still died at 400 iterations, exiting with too few actions and no
       diagnostic (its `stuck` run never reached 100 consecutively). The cap was the binding constraint the
       whole time; the two fixes I tried before this were reasoned from rules rather than from a captured
       failure, and both were wrong.
       `stuck` is the real budget: 100 x 70ms = 7s of NO progress, against a busy window CLAUDE.md measures
       at 2014ms. The wall clock is only a backstop so a genuinely wedged board ends the suite instead of
       hanging it, and the action target is 12 because the assertion needs 6. */
    let acted = 0, stuck = 0, blocked = null, r0 = window.__solo.st().round;
    const deadline = Date.now() + 180000;
    while (acted < 8 && Date.now() < deadline) {
      const ov = $('overlay');
      if (ov && ov.classList.contains('show')) {
        const d = $('respDecline') || $('pfDecline') || $('sgNo') || $('revOk');
        if (d && !d.disabled) { d.click(); await new Promise(r => setTimeout(r, 60)); continue; }
      }
      if (window.__solo.st().finished) break;
      /* SELECT CUMULATIVELY — the old loop cleared between every card, so it could only ever offer ONE.
         THE EVIDENCE: the captured stall read `handN: 12` against a `MAX_HAND` of 10. That is the
         end-of-round CLEAN-UP TRIM, and a pick is confirmed with FIGHT (`nettest_trim`) — but Fight does
         not enable until enough cards are selected, so a two-card pitch could never be satisfied one card
         at a time and the board sat with both controls disabled forever.
         CLAUDE.md records this exact gap for `nettest_sync`: "the host ending a round over MAX_HAND sat on
         its own clean-up picker forever", fixed by "select until Fight enables, confirm with FIGHT".
         Accumulating also covers ordinary play: a jab enables Fight on the first card, a Special on the
         second, and an illegal combination simply never enables it — so this is strictly more capable, not
         a different policy. */
      clear();
      let did = false;
      const cards = [].slice.call(document.querySelectorAll('#hand .card'));
      for (const c of cards) { c.click(); const f = $('fightBtn'); if (f && !f.disabled) { f.click(); did = true; break; } }
      if (!did) { clear(); const pb = $('passBtn'); if (pb && !pb.disabled) { pb.click(); did = true; } }
      if (did) { acted++; stuck = 0; } else { stuck++; }
      /* 100 iterations x 70ms = ~7s BEFORE calling it a stall, and the number is not arbitrary: the board
         legitimately disables Fight AND Pass while it animates, saying "Hold on — the board is still
         resolving", and CLAUDE.md measured that window at **2014ms** in the Initiative lesson. The first
         version of this detector gave up at 25 iterations — **1.75s, shorter than the documented busy
         window on an IDLE machine** — so it reported a stalled table on a board that was simply mid-beat.
         That was 8 failures in 40 runs, and it is the actual cause; the fixed startup waits I replaced
         first were not (the polled build failed at exactly the same rate, which is what said so).
         A real stall still fails, just 7s later, and the loop's 400-iteration ceiling is unchanged. */
      /* IS IT STUCK, OR MERELY SLOW? Wait a further 20s before calling it, and record whether the board
         RECOVERED. `handN: 12` in the captured stalls is a red herring — CLAUDE.md: "MAX_HAND is an
         END-OF-TURN discard limit, not a hand cap… a player is on turn with more than ten cards on 78% of
         turns" — so the only real signal is `busy` staying true with both controls disabled on YOUR turn.
         MEASURED, and it settles the question: the board RECOVERS after **9.2s** — the stall was a Rival
         turn running long ("Rival is fighting…", turn 1), not a wedge and not step 15's auto-pass. So the
         budget is 400 unproductive iterations (~28s, 3x the observed worst case) and the wall clock is
         180s. A poll budget is a HANG GUARD, not a race: it returns the instant the board frees up, so a
         generous ceiling costs a passing run nothing, and this suite is destined for a four-lane sweep
         where every beat is slower.
         WHY THE EARLIER RAISE FAILED: tolerance went 25 -> 100 while a raw `i < 400` cap was still in
         place, so the loop tolerated the wait and then died of iteration count instead — 14/40, worse than
         the 8/40 it started at. The cap had to go FIRST; only then does the budget matter. */
      if (stuck > 400) {                      // 28s — see the measurement above
        const ov2 = $('overlay');
        blocked = {
          overlay: !!(ov2 && ov2.classList.contains('show')),
          modal: (() => { const m = $('modal'); return m && m.offsetParent ? m.textContent.replace(/\s+/g, ' ').slice(0, 120) : null; })(),
          hint: (($('hint') || {}).textContent || '').slice(0, 80),
          msg: (($('message') || {}).textContent || '').slice(0, 80),
          turn: window.__solo.st().turn,
          fight: (() => { const f = $('fightBtn'); return f ? (f.disabled ? 'disabled' : 'enabled') : 'absent'; })(),
          pass: (() => { const b = $('passBtn'); return b ? (b.disabled ? 'disabled' : 'enabled') : 'absent'; })(),
          handN: document.querySelectorAll('#hand .card').length
        };
        // one long look before giving up: does it EVER come back?
        for (let w = 0; w < 100; w++) {
          await new Promise(r => setTimeout(r, 200));
          const f2 = $('fightBtn'), p2 = $('passBtn');
          if ((f2 && !f2.disabled) || (p2 && !p2.disabled)) { blocked.recoveredAfterMs = 7000 + w * 200; break; }
        }
        if (!blocked.recoveredAfterMs) blocked.recoveredAfterMs = 'never (27s)';
        break;
      }
      await new Promise(r => setTimeout(r, 70));
    }
    const st = window.__solo.st();
    if (!blocked && acted < 12 && Date.now() >= deadline) blocked = { why: 'wall clock: 90s elapsed with ' + acted + ' actions' };
    return { acted: acted, rounds: st.round - r0, finished: !!st.finished, blocked: blocked };
  });
  ok(moved.acted > 5 && (moved.rounds > 0 || moved.finished),
     'THE GAME KEEPS MOVING with the prompt suppressed — the window is passed, not left open' +
     ' (' + moved.acted + ' actions, ' + moved.rounds + ' rounds' + (moved.finished ? ', finished' : '') + ')' +
     ((moved.acted > 5 && (moved.rounds > 0 || moved.finished)) ? '' :
       '  ← STALLED. What was on screen: ' + JSON.stringify(moved.blocked)));

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
    await p.evaluate(() => { const f = document.getElementById('fightBtn'); if (f && !f.disabled) f.click(); });
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
        return /Respond/i.test(el.textContent || '') ? el.textContent.replace(/\s+/g, ' ') : null;
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
  await p.evaluate(() => { window.__solo.setPromptPref('D4', 'respond', true); });
  const withPrompt = await stageCast();
  ok(!!withPrompt && /Counter Spell/.test(withPrompt),
     'CONTROL: with the prompt ON, the Rival’s cast opens the Respond? window offering Counter Spell' +
     (withPrompt ? '' : '  ← no window opened, so the negative below would prove nothing. Board: ' + lastBoard));
  await p.evaluate(() => { const d = document.getElementById('respDecline'); if (d && !d.disabled) d.click(); });
  await wait(400);

  // (b) the CLAIM — switched OFF, the same staged cast must produce NO modal, and the game must go on.
  await p.evaluate(() => { window.__solo.setPromptPref('D4', 'respond', false); });
  const withoutPrompt = await stageCast();
  ok(withoutPrompt === null,
     'SUPPRESSED: with the prompt OFF, the same cast opens no modal — it is auto-passed' +
     (withoutPrompt === null ? '' : '  ← still prompted: the filter is not wired into the live path'));
  ok(await until(() => p.evaluate(() => { const st = window.__solo.st(); return !!st && st.respondFor == null; })),
     '…and no response window is left owed — the pass really happened');

  ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('HARNESS ERROR: ' + e.message); process.exit(1); });
