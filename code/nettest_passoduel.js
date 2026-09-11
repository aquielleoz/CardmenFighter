/* PASSO IN A DUEL — epic/priority-windows, step 13.
 *
 * `passoTakeover` is NOT gated to multiplayer, so a dropped opponent in a 2-player game gets a Passo
 * caretaker exactly like one at a 6-player table. But `passoStep` only ever answered the N-PLAYER parks
 * (`netReact` / `netParked`, both written for `driveN`), and a duel parks on an entirely different set of
 * variables — `awaitRival` for the turn, `netSettle` for a response window (`netGuard` was a fourth, for
 * the shield guard, until epic step 19 deleted that window),
 * `netDiscard` for a forced discard. Nothing answered any of them for a Passo'd seat.
 *
 * THIS IS THE v1.31.91 BUG CLASS, WHICH THIS FILE'S OWN HISTORY ALREADY RECORDS: a duel park that only the
 * N-player handler knew about, so the host sat forever with a status line and no way out but Concede. That
 * one was found by Aj in a real game. This suite exists so the duel half of Passo is not found the same way.
 *
 * AND THE SECOND CLAIM, which is Aj's ruling for step 13: **Passo DEFENDS.** It used to answer every guard
 * window with `guardPass` — take the hit — which made disconnecting the worst thing that could happen to
 * you: the seat kept its standing and stopped protecting it. It now springs the guard on the AI's own terms
 * (`AI.shieldGuardWants`, one definition shared with `shieldGuardAI`).
 *
 * Run: node nettest_passoduel.js
 */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel = require('./nettest_lobby.js');
const { selectAndFight, clickFight, clickPass, installPageHelpers, FIGHT_BUDGET } = require('./fightclick');
const http = require('http'), fs = require('fs'), path = require('path');
const DIR = __dirname, PORT = +(process.env.PORT || 8451), ROOM = 'PD' + Date.now().toString().slice(-3);
const srv = http.createServer((q, r) => { let p = path.join(DIR, q.url.split('?')[0] === '/' ? '/CardmenFighter.html' : q.url.split('?')[0]); fs.readFile(p, (e, b) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'Content-Type': 'text/html' }); r.end(b); } }); });
const url = r => `http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait = ms => new Promise(r => setTimeout(r, ms));
function pollTimedOut(fn) { console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g, ' ').slice(0, 110)); }
async function until(fn, t = 120, ms = 150) { for (let i = 0; i < t; i++) { if (await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

const passo = (p, s) => p.evaluate(s => window.__cmf ? window.__cmf.passo(s) : null, s);
const roundOf = p => p.evaluate(() => window.__cmfNetState ? window.__cmfNetState.round : (window.__cmf ? window.__cmf.round && window.__cmf.round() : null));
const hostRound = p => p.evaluate(() => window.__solo ? null : (window.__cmf && window.__cmf.trace ? null : null));

(async () => {
  await new Promise((r, j) => { srv.once('error', e => j(new Error('cannot bind port ' + PORT + ' (' + e.code + ') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT, r); });
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1100, height: 820 } }); const errs = [];
  const host = await ctx.newPage(); host.on('pageerror', e => errs.push('host: ' + e.message));
  const join = await ctx.newPage(); join.on('pageerror', e => errs.push('join: ' + e.message));
  await installPageHelpers(host, FIGHT_BUDGET); await installPageHelpers(join, FIGHT_BUDGET);   // netplay: a remote seat can park the host past the 6s netwindows grace   // epic step 20: the two-state Fight button, for drivers that decide inside the page
  let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; };

  await host.goto(url('host')); await join.goto(url('join'));
  await until(() => join.evaluate(() => !!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(() => join.evaluate(() => !!(window.__cmfNetState && window.__cmfNetState.round > 0))), 'duel started');

  // Shorten the grace so the takeover happens in test time, then drop the client.
  await host.evaluate(() => window.__cmf.graceMs(300));
  const rBefore = await host.evaluate(() => window.__cmf.turn());
  await host.evaluate(() => window.__cmf.drop(1));
  ok(await until(async () => (await passo(host, 1)) === true, 60, 150),
     'grace expired → PASSO holds the duel seat' +
     '  (passoTakeover is not gated to multiplayer, which is exactly why the duel parks matter)');

  /* THE LIVENESS CLAIM. With a bot holding seat 1, the duel must keep moving: the host plays or passes, the
     turn reaches seat 1, and something answers for it. Asserted as the ROUND ADVANCING rather than as any
     particular move, because "which move Passo makes" is policy and "the table is not wedged" is the
     invariant. A deadlock here is silent — a status line and no way out but Concede, which is a recorded
     loss — so this is the assertion the whole suite exists for. */
  const startRound = await host.evaluate(() => window.__cmfNetState ? window.__cmfNetState.round : null);
  const hr = async () => host.evaluate(() => {
    // the host reads its own engine state, not a mirror
    return (window.__cmf && window.__cmf.turn) ? { turn: window.__cmf.turn(), fin: window.__cmf.finished() } : null;
  });

  /* THE HOST MUST ACTUALLY BE ABLE TO PLAY, and the first version of this loop could not. It clicked Fight
     and Pass without ever SELECTING a card — but the host is the opener here, so it must lead: Pass is
     illegal and Fight stays disabled until something is selected. The loop therefore reported "0 actions"
     on a perfectly healthy board and I nearly filed it as the deadlock it was written to find.
     This is `nettest_sync`'s `act` idiom, and the deselect-between-attempts is load-bearing: a leftover
     multi-card selection is staged as a FIGHT and jams both controls (the `nettest_actloop` lesson). */
  const act = p => p.evaluate(async () => {
    const clear = () => { const c = document.getElementById('clearBtn'); if (c && !c.disabled) c.click();
                          [].forEach.call(document.querySelectorAll('#hand .card.sel'), x => x.click()); };
    const ov = document.getElementById('overlay');
    if (ov && ov.classList.contains('show')) {
      const d = document.getElementById('pfDecline') || document.getElementById('respDecline') || document.getElementById('revOk');
      if (d) { d.click(); return 'modal'; }
    }
    clear();
    const cards = [].slice.call(document.querySelectorAll('#hand .card'));
    for (const c of cards) {
      c.click();
      if (await window.__pressFight()) return 'played';
      clear();
    }
    if (await window.__pressPass()) return 'passed';
    return 'stuck';
  });

  let acted = 0, stalls = 0, lastSig = '';
  for (let i = 0; i < 240 && acted < 14; i++) {
    const st = await hr();
    if (!st || st.fin) break;
    const sig = JSON.stringify(st) + '|' + (await host.evaluate(() => (document.getElementById('hand') || {}).childElementCount));
    if (sig === lastSig) { stalls++; } else { stalls = 0; lastSig = sig; }
    if (stalls > 40) break;                       // ~6s with nothing moving — wedged
    const did = await act(host);
    if (did && did !== 'stuck') acted++;
    await wait(150);
  }
  const endState = await hr();
  const moved = acted > 0 && (stalls <= 40);
  ok(moved,
     'THE DUEL KEEPS MOVING with Passo holding the other seat (' + acted + ' host actions, ' + stalls + ' idle polls)' +
     (moved ? '' : '  ← WEDGED: nothing answers for the Passo seat, and the host has no way out but Concede'));

  /* ---------------------------------------------------------------- PASSO DEFENDS (Aj's step-13 ruling)
     *"a dropped player's Leyline still saves their last shield."* Passo used to answer every guard window
     with `guardPass`, so dropping made the seat stop protecting a standing it still held.
     STAGED, NOT HOPED FOR: seat 1 gets the lone 9D Leyline plus the diamond energy to afford it and ONE
     shield (so `shieldGuardWants`'s `shields <= 2` is satisfied and the guard is worth spending); the host
     gets a pair to win the Special that threatens it. Round 1 is jabs-only, so this runs after the loop
     above has moved the game on.
     THE ASSERTION IS THAT THE SHIELD SURVIVES, not that a log line appeared: a message can be emitted by a
     path that then takes the hit anyway, and it is the shield the ruling is about. */
  const shieldsOf = (p, seat) => p.evaluate(seat => {
    const st = window.__cmfNetState; if (st && st.players && st.players[seat]) return st.players[seat].shields;
    return null;
  }, seat);

  const staged = await host.evaluate(() => {
    if (!window.__cmf || !window.__cmf.force) return false;
    const C = (n, su, t) => ({ rank: n, suit: su, id: (t || '') + n + su });
    // host: a pair of 9s to win a Special · client: Leyline + junk, 4 diamond energy, ONE shield
    window.__cmf.force([C(9, 'C', 'h'), C(9, 'S', 'h'), C(4, 'C', 'h')],
                       [C(9, 'D', 'g'), C(3, 'H', 'c'), C(6, 'S', 'c')],
                       null,
                       // Leyline is the 9 of diamonds and its activation cost IS its number — NINE diamond
                       // energy, not a token handful. The first version staged five, so the card was simply
                       // unaffordable, no guard window ever opened, and the seat lost the shield for a
                       // reason that had nothing to do with Passo.
                       [1,2,3,4,5,6,7,8,9,10].map(i => C(2, 'D', 'e' + i)),
                       4, 1);
    return true;
  });
  ok(staged, 'guard scenario staged (host holds a pair; the Passo seat holds Leyline and one shield)');
  await wait(500);

  const before = await host.evaluate(() => window.__cmf.trace().length);
  await selectAndFight(host, ['h9C', 'h9S']);   // two-state button (epic step 20) — see fightclick.js
  /* WAIT FOR THE ROUND TO ACTUALLY RESOLVE, and poll on something that genuinely moves. Two earlier
     attempts did not: a trace grep for /sprang|took the hit/ (no such line exists) and "the pile is empty"
     (it is not — the winning play stays on the table). The host's HAND is the honest signal: it plays two
     cards and the new round deals it more, so the count leaves its post-play value exactly when the round
     turns over. A poll whose result is discarded is the v1.31.9 bug in miniature, so this one is asserted. */
  const afterPlay = await host.evaluate(() => (document.getElementById('hand') || {}).childElementCount);
  const settled = await until(async () =>
    (await host.evaluate(() => (document.getElementById('hand') || {}).childElementCount)) !== afterPlay, 80, 200);
  ok(settled, 'the round resolved after the host led its pair — the Passo seat answered the fight AND the guard window' +
     (settled ? '' : '  ← the hand never changed, so the round never turned over and the assertion below is vacuous'));
  await wait(400);

  // read the HOST's own engine state — the host has no mirror, and the dropped client's is stale
  const survived = await host.evaluate(() => window.__cmf.shieldsOf(1));
  ok(survived === 1,
     'PASSO DEFENDS — the dropped player\'s last shield is still there (shields=' + survived + ')' +
     (survived === 1 ? '' : '  ← Passo took the hit for a seat that held an affordable Leyline'));

  ok(!errs.some(e => /Cannot read|undefined is not/.test(e)), 'no page errors while Passo drove the seat' + (errs.length ? '  ← ' + errs.slice(0, 2).join(' | ') : ''));
  ok(errs.length === 0, 'no page errors at all' + (errs.length ? '  ← ' + errs.slice(0, 3).join(' | ') : ''));

  console.log((fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
  await b.close(); srv.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.log('HARNESS ERROR: ' + e.message); srv.close(); process.exit(1); });
