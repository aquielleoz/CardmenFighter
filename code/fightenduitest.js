/* THE TWO BUGS THE EPIC EXISTS FOR, PLAYED THROUGH THE REAL PAGE — epic/priority-windows, step 18.
 *
 * `fightendtest.js` asserts the MODEL headlessly. This asserts the two things a player actually reported,
 * end to end in the built HTML, because neither had ever been played through a UI by anything:
 *
 *   A · SANCTUARY UNDER HECTOR SURVIVES THE FIGHTER KICK. The ♥K patch is `{quick:true}` **alone** — a
 *       Quick whose own boost text says *"cast it in response"* — with no `immune` and no `shieldImmune`.
 *       `immunityEffFor` (then `guardEffFor`) therefore returned null and the old window REFUSED the card.
 *       Apollo's Super patch does carry `shieldImmune` and was admitted, so testing Apollo proves nothing:
 *       **Hector is the case, precisely because its patch is the bare `quick`.**
 *       It works now by TIMING and no new rule — the shield gain resolves above the strike, so
 *       `resolveShieldLossObj`'s `wasBroken` is false and the kick branch is never entered.
 *
 *   B · ARMOR PIERCING LANDS REACTIVELY. **It is the ♣7, and it is NOT a Quick at base** — the plan and
 *       an earlier draft of this file both said "the ♠7 is `type:'Quick Technique'` at base", and both
 *       were wrong twice over: ♠7 is Caltrops, and the Fighter block strips Quick from Armor Piercing and
 *       adds the Broadway pitch. It becomes a Quick under **Hippolyta (♣Q)**. Measured, not read off the
 *       table's layout — which is CLAUDE.md's own rule about `copyPlus`, and it caught this.
 *       That makes both reported symptoms the SAME class: a Form-granted Quick that `immunityEffFor`
 *       refuses. What B adds over A is the other half of the walk — A is the THREATENED seat, B is the
 *       WINNER, who the old window never offered anything to at all.
 *       AND IT PROVES THE WINDOW MOVED RATHER THAN MERELY WIDENED: `applyRoundLossBody` reads
 *       `wpl.finishingBlow` into `strips` **before** it pushes the shieldloss objects, so a guard window
 *       living inside `driveShieldStack` was already too late. Cast in the go-round, the extra strip lands.
 *
 * EVERY CLAIM IS A BOTH-WAYS PAIR, and that is the whole design. "You survived" is also true of a board
 * that was never lethal, and "they lost 2" is also true of a striker that always strips 2 — so each
 * scenario is run twice off identical staging, once DECLINING and once CASTING, and the assertion is the
 * DIFFERENCE. A build where the window opens and the cast does nothing passes every one-sided version.
 *
 * Run: node fightenduitest.js
 */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, 'CardmenFighter.html') + '?dbgsolo=1';
const wait = ms => new Promise(r => setTimeout(r, ms));
function pollTimedOut(fn) { console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g, ' ').slice(0, 110)); }
async function until(fn, t = 200, ms = 100) { for (let i = 0; i < t; i++) { if (await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* POLL FOR EVERY STEP, NEVER SLEEP PAST ONE — `prompttest` went red on run 10 of 40 doing that, and a suite
   in the sweep is a loaded machine by definition. */
async function freshGame(p) {
  if (!await until(() => p.evaluate(() => !!document.getElementById('newBtn')))) return false;
  await p.evaluate(() => document.getElementById('newBtn').click());
  if (!await until(() => p.evaluate(() => { const b = document.getElementById('goFirstBtn'); return !!(b && b.offsetParent); }))) return false;
  await p.evaluate(() => document.getElementById('goFirstBtn').click());
  return await until(() => p.evaluate(() => !!(window.__solo && window.__solo.st() && window.__solo.st().players)));
}
const modalText = p => p.evaluate(() => { const m = document.getElementById('modal');
  return (m && m.offsetParent) ? (m.textContent || '').replace(/\s+/g, ' ') : null; });
const quickBtns = p => p.evaluate(() => [].slice.call(document.querySelectorAll('.respQuick')).map(b => b.textContent.replace(/\s+/g, ' ')));

(async () => {
  const b = await chromium.launch(LAUNCH);
  let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; };
  const errs = [];

  // ---------------------------------------------------------------- A · SANCTUARY vs THE FIGHTER KICK
  /* Staged rather than played: the Rival's winning pair is put on the table directly and YOU end the round
     by passing, so the scenario cannot drift with a deal. That also routes through `finishPassRound`'s
     drain, which is the human-pass half of step 18 (B covers `finishStep`, the driver half). */
  async function stageKick(p, prompt) {
    return await p.evaluate((prompt) => {
      const st = window.__solo.st(), E = window.CardmenEngine;
      const C = (r, s, t) => ({ rank: r, suit: s, id: (t || '') + r + s });
      const you = st.players[0], riv = st.players[1];
      you.shields = 0; riv.shields = 4;
      you.hand = [C(10, 'H', 'sanc')];                       // ♥10 Sanctuary — a Technique at base
      you.energy = []; for (let i = 0; i < 13; i++) you.energy.push(C(3, 'H', 'e' + i));   // hearts: costReq wants its own suit
      you.forms = [C(13, 'H', 'hector')];                    // ♥K Hector → patches Sanctuary to {quick:true} ALONE
      riv.hand = []; riv.energy = [];                        // the Rival can add nothing, so priority reaches you
      st.round = 3; st.turn = 0; st.passes = 0; st.lastPlayer = 1; st.preFightHandled = true;
      st.pending = null; st.respondFor = null; st.stack = []; st.prioPassed = {}; st.fightEnd = null; st.fightEndResult = null;
      const cards = [C(9, 'C', 'x'), C(9, 'S', 'y')];
      st.pile = { p: 1, byPlayer: 1, combo: { type: 'pair', size: 2, value: 9, key: [9], cards: cards } };
      /* SET THE PREFERENCE EXPLICITLY RATHER THAN LEANING ON THE DEFAULT, so this suite tests the
         MECHANISM and `prompttest` owns the policy. It matters that they stay separate: when this file was
         written the default was `immunityEffFor` — the whitelist step 18 deleted — and it auto-declined
         both of the cards the epic exists to fix. That is what scenario C below caught. The default is
         now "every legal timing prompts" (Aj, 2026-09-10), so `true` here is a no-op; it stays because a
         suite that silently depends on a default cannot tell you when the default moves. */
      window.__solo.setPromptPref('H10', 'fightend', !!prompt);
      window.__solo.render();
      const sanc = you.hand[0];
      return { quick: !!(E.effectFor(st, 0, sanc) || {}).quick,
               whitelisted: !!E.immunityEffFor(st, 0, sanc),
               afford: E.canAfford(you, sanc), shields: you.shields };
    }, prompt);
  }

  { const p = await b.newPage(); p.on('pageerror', e => errs.push('A: ' + e.message));
    await p.goto(URL);
    ok(await freshGame(p), 'A · a solo game is running');
    const s = await stageKick(p, true);
    /* THE STAGING IS THE CLAIM. `quick && !whitelisted` IS the bug: a card the go-round must offer and the
       old gate had to refuse. If `whitelisted` ever comes back true this scenario silently stops testing
       Hector and starts testing Apollo, and would pass on the build that shipped the bug. */
    ok(s.quick && !s.whitelisted && s.afford && s.shields === 0,
       'A · staged the exact refused case — Hector makes Sanctuary a Quick, the OLD whitelist refuses it ' +
       `(quick=${s.quick} whitelisted=${s.whitelisted}), it is affordable, and you are at 0 shields` +
       (s.quick && !s.whitelisted ? '' : '  ← not the reported bug any more; re-read the ♥K patch in BOOSTS'));

    await p.evaluate(() => document.getElementById('passBtn').click());
    const up = await until(async () => !!(await modalText(p)));
    ok(up, 'A · the Fight End window opens on the seat about to be kicked');
    const txt = await modalText(p) || '';
    ok(/FIGHTER KICK/i.test(txt),
       'A · …and it says out loud that this is the KICK, not an ordinary shield' +
       (/FIGHTER KICK/i.test(txt) ? '' : '  ← said: "' + txt.slice(0, 120) + '"'));
    const offered = await quickBtns(p);
    ok(offered.some(t => /Sanctuary/i.test(t)),
       'A · SANCTUARY IS OFFERED — the card the whitelist refused for the whole of its existence' +
       (offered.length ? '  [' + offered.join(' | ').slice(0, 80) + ']' : '  ← no Quick buttons at all'));

    // (a) DECLINE — the control. Without it "you survived" below is true of a board that was never lethal.
    await p.evaluate(() => { const d = document.getElementById('respDecline'); if (d) d.click(); });
    const died = await until(() => p.evaluate(() => { const st = window.__solo.st(); return !!st.finished; }));
    ok(died, 'A · CONTROL: declining, the kick lands and the game ends — the staging really was lethal');
    await p.close(); }

  { const p = await b.newPage(); p.on('pageerror', e => errs.push('A2: ' + e.message));
    await p.goto(URL);
    if (!await freshGame(p)) ok(false, 'A · second board for the cast');
    await stageKick(p, true);
    await p.evaluate(() => document.getElementById('passBtn').click());
    await until(async () => !!(await modalText(p)));
    const clicked = await p.evaluate(() => { const y = [].slice.call(document.querySelectorAll('.respQuick'))
      .filter(x => /Sanctuary/i.test(x.textContent))[0]; if (y) { y.click(); return true; } return false; });
    ok(clicked, 'A · the same board again — this time Sanctuary is cast');
    /* THE ROUND MUST RESOLVE BEFORE "you survived" MEANS ANYTHING — with the go-round open the outcomes have
       not run, so `finished === false` would be true merely because nothing had happened yet. This is the
       vacuous shape step 18 already found in `nettest_guard`. */
    const resolved = await until(() => p.evaluate(() => { const st = window.__solo.st(); return st.round > 3 || st.finished; }));
    ok(resolved, 'A · the round RESOLVED after the cast — so the reading below is not vacuous');
    const out = await p.evaluate(() => { const st = window.__solo.st();
      return { finished: !!st.finished, elim: !!st.players[0].eliminated, shields: st.players[0].shields, round: st.round }; });
    /* THE LEDGER IS THE THING AJ SENDS BACK, so it is asserted rather than eyeballed — `logtest` measured
       the Save button's HEIGHT at three viewports and never clicked it, and the log it produced was the
       single line "[object PointerEvent]" for fifteen versions. */
    const led = await p.evaluate(() => window.__solo.feLog());
    ok(led.some(l => /SUB-PHASE opens/.test(l) && /struck=You/.test(l)) && led.some(l => /window SHOWN to you/.test(l) && /Sanctuary/.test(l)),
       'A · the saved-log ledger records the sub-phase and the offer' +
       (led.length ? '  [' + led.slice(0, 2).join(' // ').slice(0, 130) + ']' : '  ← the ledger is EMPTY'));
    ok(!out.finished && !out.elim,
       `A · SURVIVED THE FIGHTER KICK by casting Sanctuary in the window (round ${out.round}, shields ${out.shields})` +
       (out.finished ? '  ← still died: the shield gain is not resolving above the strike' : ''));
    await p.close(); }

  // ---------------------------------------------------------------- B · ARMOR PIERCING, REACTIVELY
  /* Played rather than staged: YOU lead a pair of Aces and the Rival must pass, so this goes through
     `runRival` → `finishStep` → the drain — the driver half of step 18, and the half that presents beats. */
  async function stagePierce(p) {
    return await p.evaluate(() => {
      const st = window.__solo.st(), E = window.CardmenEngine;
      const C = (r, s, t) => ({ rank: r, suit: s, id: (t || '') + r + s });
      const you = st.players[0], riv = st.players[1];
      you.shields = 4; riv.shields = 4;
      /* A pair of NINES to lead, not Aces: Armor Piercing carries the Broadway pitch (`pitchHigh`), the
         engine picks the lowest Broadway in hand for it, and a leftover Ace would be spent instead of the
         ♦10 that is here to be spent. The ♣Q is Hippolyta — one Queen, so `queen` tier and NOT Super. */
      you.hand = [C(9, 'C', 'n1'), C(9, 'D', 'n2'), C(7, 'C', 'ap'), C(10, 'D', 'pitch')];
      you.energy = []; for (let i = 0; i < 13; i++) you.energy.push(C(3, 'C', 'e' + i));
      you.forms = [C(12, 'C', 'hippo')];
      riv.hand = [C(3, 'H', 'r1')];                          // a lone 3 cannot answer a pair → the AI must pass
      riv.energy = []; riv.forms = [];
      st.round = 3; st.turn = 0; st.passes = 0; st.lastPlayer = null; st.pile = null; st.preFightHandled = true;
      st.pending = null; st.respondFor = null; st.stack = []; st.prioPassed = {}; st.fightEnd = null; st.fightEndResult = null;
      window.__solo.setPromptPref('C7', 'fightend', true);   // see the note in stageKick — the default is the old whitelist
      window.__solo.render();
      const ap = you.hand[2];
      return { quick: !!(E.effectFor(st, 0, ap) || {}).quick, afford: E.canAfford(you, ap), rivShields: riv.shields,
               whitelisted: !!E.immunityEffFor(st, 0, ap) };
    });
  }
  async function leadAces(p) {
    await p.evaluate(() => {
      const clr = document.getElementById('clearBtn'); if (clr) clr.click();
      ['n19C', 'n29D'].forEach(id => { const c = document.querySelector('#hand .card[data-id="' + id + '"]'); if (c) c.click(); });
      const f = document.getElementById('fightBtn'); if (f && !f.disabled) f.click();
    });
  }

  { const p = await b.newPage(); p.on('pageerror', e => errs.push('B: ' + e.message));
    await p.goto(URL);
    if (!await freshGame(p)) ok(false, 'B · a solo game is running');
    const s = await stagePierce(p);
    ok(s.quick && !s.whitelisted && s.afford && s.rivShields === 4,
       `B · staged — Hippolyta makes Armor Piercing a Quick, the OLD whitelist refuses it, it is affordable, the Rival holds ${s.rivShields} shields` +
       (s.quick && !s.whitelisted && s.afford && s.rivShields === 4 ? '' : `  ← quick=${s.quick} whitelisted=${s.whitelisted} afford=${s.afford} rivShields=${s.rivShields}`));
    await leadAces(p);
    const up = await until(async () => !!(await modalText(p)));
    ok(up, 'B · THE WINNER IS OFFERED THE WINDOW — the striker was never offered one under the old model');
    const offered = await quickBtns(p);
    ok(offered.some(t => /Armor Piercing/i.test(t)),
       'B · …and Armor Piercing is among its Quicks' + (offered.length ? '  [' + offered.join(' | ').slice(0, 80) + ']' : '  ← no Quick buttons at all'));

    await p.evaluate(() => { const y = [].slice.call(document.querySelectorAll('.respQuick'))
      .filter(x => /Armor Piercing/i.test(x.textContent))[0]; if (y) y.click(); });
    const done = await until(() => p.evaluate(() => { const st = window.__solo.st(); return st.round > 3 || st.finished; }));
    ok(done, 'B · the round resolved after the cast');
    const cast = await p.evaluate(() => window.__solo.st().players[1].shields);
    ok(cast === 2,
       `B · THE EXTRA STRIP LANDED — the Rival lost 2 shields, not 1 (4 → ${cast})` +
       (cast === 2 ? '' : '  ← `finishingBlow` is being read BEFORE the window, which is the whole reason the window had to move'));
    await p.close(); }

  { const p = await b.newPage(); p.on('pageerror', e => errs.push('B2: ' + e.message));
    await p.goto(URL);
    if (!await freshGame(p)) ok(false, 'B · second board for the control');
    await stagePierce(p);
    await leadAces(p);
    await until(async () => !!(await modalText(p)));
    await p.evaluate(() => { const d = document.getElementById('respDecline'); if (d) d.click(); });
    await until(() => p.evaluate(() => { const st = window.__solo.st(); return st.round > 3 || st.finished; }));
    const dec = await p.evaluate(() => window.__solo.st().players[1].shields);
    ok(dec === 3,
       `B · CONTROL: declining the same board strips ONE (4 → ${dec}), so the 2 above is the cast and not the staging`);
    await p.close(); }

  // ------------------------------------------------- C · THE SILENT AUTO-PASS IS NO LONGER SILENT
  /* THE BUG THAT HID FOR MONTHS WAS AN ABSENCE OF EVIDENCE. `promptHumanResponse` auto-declines when its
     offer list comes back empty, and it did that whether you held nothing or held the answer and were not
     asked — identical silence, completely different faults. A saved log could not tell them apart, which
     is why "sanctuary did not prompt use" took a code read to diagnose rather than a log.
     This is the same lethal board as A with the prompt switched OFF: no modal, you die, and the ledger
     says so IN WORDS, naming the card you could have cast. That line is what a log has to carry for the
     next report of this shape to be answerable from the file alone. */
  { const p = await b.newPage(); p.on('pageerror', e => errs.push('C: ' + e.message));
    await p.goto(URL);
    if (!await freshGame(p)) ok(false, 'C · a board for the suppressed prompt');
    await stageKick(p, false);
    await p.evaluate(() => document.getElementById('passBtn').click());
    const died = await until(() => p.evaluate(() => !!window.__solo.st().finished));
    ok(died, 'C · with the prompt OFF the window is auto-passed and the kick lands — no modal at all');
    const led = await p.evaluate(() => window.__solo.feLog());
    const line = led.filter(l => /PROMPT OFF/.test(l))[0];
    ok(!!line && /Sanctuary/.test(line),
       'C · …and the ledger names the card you were never asked about — the evidence that did not exist before' +
       (line ? '  [' + line.slice(0, 110) + ']' : '  ← no PROMPT OFF line; a saved log still cannot tell this from "held nothing"'));
    await p.close(); }

  // ------------------------------------------------- D · AN UNCHECKED CARD IS STILL CASTABLE
  /* THE HALF AJ ASKED FOR, and the one no suite covered: *"players can really look at all their cards and
     decide which effects to activate."* One filter was answering two questions — should this window stop
     me, and what may I play once stopped — so unchecking a card made it UNCASTABLE, a capability gate
     wearing a notification's clothes. You could be stopped by card X and find card Y missing from the
     window even though the engine says it is legal.
     STAGED WITH TWO QUICKS AND ONE OF THEM SILENCED, which is the only shape that can tell the two apart:
     the window must still open (Leyline stopped you) AND Sanctuary must still be on offer (the rules say
     it is legal). With the old behaviour the window opens and Sanctuary is simply absent — every
     one-sided version of this test passes on that build. */
  { const p = await b.newPage(); p.on('pageerror', e => errs.push('D: ' + e.message));
    await p.goto(URL);
    if (!await freshGame(p)) ok(false, 'D · a board for the two-Quick case');
    const st = await p.evaluate(() => {
      const st = window.__solo.st(), E = window.CardmenEngine;
      const C = (r, s, t) => ({ rank: r, suit: s, id: (t || '') + r + s });
      const you = st.players[0], riv = st.players[1];
      you.shields = 2; riv.shields = 4;
      /* Leyline is the ♦9, NOT the ♥9 — the Cleric block swaps 9/10 so ♥9 is Holy Shroud and ♥10 is
         Sanctuary. Measured; the first draft of this scenario guessed ♥9 and staged a card that is not a
         Quick at all, which made the window fail to open for a reason that had nothing to do with the
         claim. Costs need their OWN suit's pips, so the energy is mixed. */
      you.hand = [C(10, 'H', 'sanc'), C(9, 'D', 'ley')];    // Sanctuary (Quick via Hector) + Leyline (Quick at base)
      you.energy = [];
      for (let i = 0; i < 12; i++) you.energy.push(C(3, 'H', 'eh' + i));
      for (let i = 0; i < 12; i++) you.energy.push(C(3, 'D', 'ed' + i));
      you.forms = [C(13, 'H', 'hector')];
      riv.hand = []; riv.energy = [];
      st.round = 3; st.turn = 0; st.passes = 0; st.lastPlayer = 1; st.preFightHandled = true;
      st.pending = null; st.respondFor = null; st.stack = []; st.prioPassed = {}; st.fightEnd = null; st.fightEndResult = null;
      st.pile = { p: 1, byPlayer: 1, combo: { type: 'pair', size: 2, value: 9, key: [9], cards: [C(9, 'C', 'x'), C(9, 'S', 'y')] } };
      window.__solo.setPromptPref('H10', 'fightend', false);   // SILENCED — must not stop me, must still be playable
      window.__solo.setPromptPref('D9', 'fightend', true);     // this one is what opens the window
      window.__solo.render();
      return { eligible: E.eligibleQuicks ? null : null,
               sancQuick: !!(E.effectFor(st, 0, you.hand[0]) || {}).quick,
               leyQuick: !!(E.effectFor(st, 0, you.hand[1]) || {}).quick };
    });
    ok(st.sancQuick && st.leyQuick, `D · staged — both cards are legal Quicks here (Sanctuary ${st.sancQuick}, Leyline ${st.leyQuick})`);
    await p.evaluate(() => document.getElementById('passBtn').click());
    ok(await until(async () => !!(await modalText(p))), 'D · the window still opens — the un-silenced card stopped you');
    const offered = await quickBtns(p);
    ok(offered.some(t => /Leyline/i.test(t)), 'D · …and Leyline, the card that stopped you, is offered');
    ok(offered.some(t => /Sanctuary/i.test(t)),
       'D · …AND THE SILENCED CARD IS STILL ON OFFER — the checkbox is notification, not capability' +
       (offered.some(t => /Sanctuary/i.test(t)) ? '' : '  ← unchecking made it unplayable; the offer list is being filtered by the prompt preference again  [' + offered.join(' | ').slice(0, 80) + ']'));
    await p.close(); }

  ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('HARNESS ERROR: ' + e.message); process.exit(1); });
