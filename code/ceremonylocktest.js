/* YOUR BOARD IS LOCKED THROUGH THE ROUND CEREMONY, SO A PLAY CANNOT LAND INSIDE IT (2026-10-20).
 *
 * The cause of `round-ceremony-reruns-with-stale-res`, found by `browsertest`'s stall watchdog: in a duel, a round that
 * ends on the RIVAL's pass is resolved by `finishStep`, whose `drainResolution` clears `busy` before the ceremony runs
 * ("the ceremony manages `busy` itself" — it did not). So Fight and Pass stayed live for the whole ceremony, and a play
 * made there landed in the NEXT round before its cards were dealt. The ceremony then went on to draw and announce over
 * that play: "Round 8 begins" printed AFTER round 8's first jab, every later round one beat out of step, and at the end
 * of round 9 a Clean-up window parked on you that nothing prompted, with every move refused ("The round is over — the
 * next one is about to begin."). The netplay host already refused a GUEST's move mid-ceremony (`CEREMONY_REFUSE`);
 * nothing refused your own.
 *
 * STAGED, NOT HOPED FOR: you lead the apex 2 in round 1 (jabs only), and the Rival holds nothing that beats it and no
 * energy, so it must pass, which ends the round on its pass. From that moment the suite presses Fight on a second jab
 * every 25ms, as a fast player or a harness does. The claim is an ORDER: the second jab lands AFTER "Round 2 begins".
 * The control is that it lands at all — a lock that never lifts would also keep it out of the ceremony.
 *
 * Run: node ceremonylocktest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path = require('path');
const { clickFight } = require('./fightclick');
const URL = 'file://' + path.resolve(__dirname, 'CardmenFighter.html') + '?dbgsolo=1';
const wait = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const b = await chromium.launch(LAUNCH);
  const p = await (await b.newContext({ viewport: { width: 1100, height: 820 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; };

  await p.goto(URL); await wait(700);
  await p.evaluate(() => document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(() => document.getElementById('goFirstBtn').click()); await wait(1200);
  await p.evaluate(() => document.getElementById('logToggle').click()); await wait(200);
  for (let k = 0; k < 60 && await p.evaluate(() => { const r = document.getElementById('roundfx'); return !!(r && r.classList.contains('show')); }); k++) await wait(100);
  await p.evaluate(() => { const st = window.__solo.st(), mk = (r, s, id) => ({ rank: r, suit: s, id: id });
    st.players[0].hand = [mk(2, 'S', 'y0'), mk(5, 'H', 'y1'), mk(6, 'C', 'y2'), mk(9, 'D', 'y3')];
    st.players[1].hand = [mk(3, 'C', 'r0'), mk(4, 'H', 'r1'), mk(6, 'S', 'r2')]; st.players[1].energy = [];
    st.players[0].energy = [3,4,5,6,7,8,10,11,12,13].map((r, i) => mk(r, 'D', 'e' + i));   // Leyline (9♦) castable: every window of the ceremony opens for you, and AUTO passes it
    window.__solo.render(); });
  const staged = await p.evaluate(() => { const st = window.__solo.st(); return st.round === 1 && st.turn === 0 && !st.pile; });
  ok(staged, 'STAGED: round 1, your lead, an empty table, and a Rival that cannot beat a 2');

  await p.evaluate(() => { const g = [...document.querySelectorAll('#hand .group')].filter(el => el.querySelector('.card[data-id="y0"]'))[0]; if (g) g.click(); });
  await wait(200); await clickFight(p);

  /* Press a second jab the moment the board allows, every 25ms, until it leaves your hand or 20s pass. */
  const log = () => p.evaluate(() => [...document.querySelectorAll('#log .le')].map(e => e.textContent.trim()));
  let pressed = 0, landedAt = -1; const end = Date.now() + 20000;
  while (Date.now() < end) {
    const r = await p.evaluate(() => {
      if (!document.querySelector('#hand .card[data-id="y1"]')) return 'gone';
      const g = [...document.querySelectorAll('#hand .group')].filter(el => el.querySelector('.card[data-id="y1"]'))[0];
      if (g && !g.classList.contains('gsel')) g.click();
      const f = document.getElementById('fightBtn'); if (f && !f.disabled && f.offsetParent) { f.click(); return 'pressed'; }
      return 'locked';
    });
    if (r === 'pressed') pressed++;
    if (r === 'gone') { landedAt = Date.now(); break; }
    await wait(25);
  }
  const lines = await log();
  const iPass = lines.findIndex(t => /passed\.$/.test(t)), iRound2 = lines.findIndex(t => /^Round 2 begins/.test(t)),
        iJab2 = lines.findIndex(t => /^You played a Jab - 5♥/.test(t));
  ok(iPass >= 0, '  …the Rival passed, ending round 1 on its pass  [' + (lines[iPass] || 'no pass line') + ']');
  ok(landedAt > 0 && iJab2 >= 0, 'CONTROL: the second jab DOES land once the board is yours again (' + pressed + ' presses)');
  ok(iRound2 >= 0 && iJab2 > iRound2, 'THE SECOND JAB LANDS AFTER "Round 2 begins", NOT INSIDE ROUND 1\'S CEREMONY  ' +
     JSON.stringify(lines.slice(Math.max(0, iPass - 1), iPass + 6)));
  const ledger = await p.evaluate(() => window.__solo.prioLog ? window.__solo.prioLog() : []);
  const bad = ledger.filter(l => /CEREMONY REACHED THE DRAW|ROUND BANNER FIRED WITH A PILE/.test(l));
  ok(bad.length === 0, 'the ledger raises neither the "reached the draw" nor the "banner with a pile" detector' + (bad.length ? '  ' + JSON.stringify(bad) : ''));
  ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs.slice(0, 2).join(' | ') : ''));
  console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });
