const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const { installPageHelpers } = require('./fightclick');
const path = require('path');

(async () => {
  const url = 'file://' + path.resolve('CardmenFighter.html');
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  let games = 0, youWins = 0, rivalWins = 0, maxRound = 0, responded = 0, declined = 0, fought = 0, passedN = 0;

  for (let sim = 0; sim < 12; sim++) {
    const page = await browser.newPage();
    await installPageHelpers(page);   // epic step 20: the two-state Fight button, for drivers that decide inside the page
    // clamp UI animation delays so a full duel runs in seconds (shipped file unchanged)
    await page.addInitScript(() => {
      const _st = window.setTimeout;
      window.setTimeout = (fn, d, ...a) => _st(fn, Math.min(d || 0, 8), ...a);
      try { localStorage.setItem('cmf_seen_help_v1', '1'); } catch (e) {}   // behave as a returning player (skip the first-run rules pop)
    });
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text()); });
    await page.goto(url);
    // roll through the pre-game setup screen (accept defaults: random decks, Fighter AI)
    await page.waitForSelector('#rollBtn', { timeout: 8000 });
    await page.evaluate(() => document.getElementById('rollBtn').click());
    await page.waitForSelector('#hand .card', { timeout: 8000 });

    const init = await page.evaluate(() => ({
      hand: document.querySelectorAll('#hand .card').length,
      youShields: document.querySelectorAll('#youShields .s:not(.lost)').length,
      rivalShields: document.querySelectorAll('#rivalShields .s:not(.lost)').length,
    }));
    if (init.hand !== 6) errors.push('sim'+sim+' bad starting hand: ' + init.hand);
    if (init.youShields !== 4 || init.rivalShields !== 4) errors.push('sim'+sim+' bad shields: '+JSON.stringify(init));

    let steps = 0, done = false, blocked = 0;
    /* COUNT WHAT THE DRIVER ACTUALLY DID (epic step 20). `you: 0 | rival: 12` reads the same whether the
       human seat played badly or never played at all, and step 20 gave the Fight button a second state —
       so a smoke test that quietly stopped fighting would still reach a valid win overlay on every duel
       and print SMOKE TEST PASS. That is the green-and-blind shape this repo keeps paying for. */
    while (steps++ < 20000) {
      const act = await page.evaluate(async (respondMode) => {
        if (document.getElementById('overlay').classList.contains('show')) {
          const m = document.getElementById('modal');
          if (/about to fight/.test(m.textContent)) {            // pre-fight Back Stab window (you may spring a Quick)
            const q = document.querySelector('.respQuick');
            if (respondMode && q) { q.click(); return { responded: true }; }
            document.getElementById('pfDecline').click(); return { declined: true };
          }
          if (/Respond\?/.test(m.textContent)) {                 // interrupt response prompt, not game-over
            const q = document.querySelector('.respQuick');
            if (respondMode && q) { q.click(); return { responded: true }; }
            document.getElementById('respDecline').click(); return { declined: true };
          }
          if (document.getElementById('sgYes')) {                 // reactive shield-guard prompt
            (respondMode ? document.getElementById('sgYes') : document.getElementById('sgNo')).click();
            return { guarded: true };
          }
          /* AN OVERLAY THIS HARNESS CANNOT ANSWER IS A NAMED FAILURE, NOT "the game ended" (epic step 3).
             This used to fall through to `over`, so a window the driver did not know how to work read as an
             end state: the sim stopped early, still counted as a completed game, and understated maxRound.
             The caller's own win regex is the classifier, so there is ONE definition of "this is the end"
             rather than a loose fall-through here and a strict test there. Inert today — every overlay this
             smoke reaches is either handled above or a real end screen. */
          if (/YOU WIN|Rival Wins/i.test(m.textContent)) return { over: true };
          return { unknown: (m.textContent||'').replace(/\s+/g,' ').trim().slice(0,90) };
        }
        // pick/confirm mode (end-of-turn hand-limit discard) — select until Confirm enables
        if (document.getElementById('fightBtn').textContent === 'Confirm') {
          const pc = document.querySelectorAll('#hand .card');
          for (let i = 0; i < pc.length; i++) { const c = document.querySelectorAll('#hand .card')[i]; if (!c) break; c.click(); if (!document.getElementById('fightBtn').disabled) { document.getElementById('fightBtn').click(); return { picked: true }; } }   // a pick CONFIRMS with this button — never the two-state play
          return { blocked: true };
        }
        if (!/your turn/.test(document.getElementById('turnTag').textContent)) return { wait: true };
        const cards = document.querySelectorAll('#hand .card');
        for (let i = 0; i < cards.length; i++) {
          document.getElementById('clearBtn').click();
          const c = document.querySelectorAll('#hand .card')[i];
          if (!c) break;
          c.click();
          if (await window.__pressFight()) return { fought: true };
        }
        document.getElementById('clearBtn').click();
        if (await window.__pressPass()) return { passed: true };
        return { blocked: true };
      }, sim % 2 === 0);
      if (act.responded || act.declined) { if(act.responded) responded++; else declined++; blocked = 0; await page.waitForTimeout(10); continue; }
      if (act.picked) { blocked = 0; await page.waitForTimeout(8); continue; }
      if (act.unknown) { errors.push('sim'+sim+' hit an overlay the harness cannot answer: "'+act.unknown+'" — teach browsertest this window (see the overlay branch at the top of the driver)'); break; }
      if (act.over) { done = true; break; }
      if (act.blocked) { if (++blocked > 200) { errors.push('sim'+sim+' truly stuck'); break; } await page.waitForTimeout(15); continue; }
      if (act.fought) fought++;
      if (act.passed) passedN++;
      blocked = 0;
      await page.waitForTimeout(act.wait ? 12 : 6);
    }
    if (!done && !errors.some(e=>e.includes('sim'+sim))) errors.push('sim'+sim+' did NOT reach an end state');
    if (done) {
      const res = await page.evaluate(() => ({
        modal: document.getElementById('modal').textContent,
        round: parseInt((document.getElementById('roundTag').textContent.match(/\d+/)||[0])[0],10),
      }));
      games++; maxRound = Math.max(maxRound, res.round);
      if (/YOU WIN/.test(res.modal)) youWins++; else if (/Rival Wins/.test(res.modal)) rivalWins++;
      else errors.push('sim'+sim+' ambiguous end: ' + res.modal.slice(0,80));
    }
    await page.close();
  }
  await browser.close();
  console.log('games:', games, '| you:', youWins, '| rival:', rivalWins, '| deepest round:', maxRound, '| interrupt responses:', responded, '| declines:', declined, '| fights:', fought, '| passes:', passedN);
  /* AND IT IS AN ASSERTION, NOT A PRINTOUT. A driver that never fights still reaches a valid win overlay in
     every duel — the Rival simply wins them all — so without this the suite is green and blind. */
  if (fought === 0) errors.push('the human seat never FOUGHT in ' + games + ' duels — the driver is passing its way through, so this smoke test proved nothing');
  if (errors.length) { console.log('ERRORS ('+errors.length+'):'); errors.slice(0,20).forEach(e=>console.log(' -', e)); process.exit(1); }
  console.log('SMOKE TEST PASS — no runtime errors; every duel reached a valid win overlay.');
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
