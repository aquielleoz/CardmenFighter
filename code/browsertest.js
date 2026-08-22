const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const path = require('path');

(async () => {
  const url = 'file://' + path.resolve('CardmenFighter.html');
  const browser = await chromium.launch(LAUNCH);
  const errors = [];
  let games = 0, youWins = 0, rivalWins = 0, maxRound = 0, responded = 0, declined = 0;

  for (let sim = 0; sim < 12; sim++) {
    const page = await browser.newPage();
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
    while (steps++ < 20000) {
      const act = await page.evaluate((respondMode) => {
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
          return { over: true };
        }
        // pick/confirm mode (end-of-turn hand-limit discard) — select until Confirm enables
        if (document.getElementById('fightBtn').textContent === 'Confirm') {
          const pc = document.querySelectorAll('#hand .card');
          for (let i = 0; i < pc.length; i++) { const c = document.querySelectorAll('#hand .card')[i]; if (!c) break; c.click(); if (!document.getElementById('fightBtn').disabled) { document.getElementById('fightBtn').click(); return { picked: true }; } }
          return { blocked: true };
        }
        if (!/your turn/.test(document.getElementById('turnTag').textContent)) return { wait: true };
        const cards = document.querySelectorAll('#hand .card');
        for (let i = 0; i < cards.length; i++) {
          document.getElementById('clearBtn').click();
          const c = document.querySelectorAll('#hand .card')[i];
          if (!c) break;
          c.click();
          if (!document.getElementById('fightBtn').disabled) { document.getElementById('fightBtn').click(); return { fought: true }; }
        }
        document.getElementById('clearBtn').click();
        if (!document.getElementById('passBtn').disabled) { document.getElementById('passBtn').click(); return { passed: true }; }
        return { blocked: true };
      }, sim % 2 === 0);
      if (act.responded || act.declined) { if(act.responded) responded++; else declined++; blocked = 0; await page.waitForTimeout(10); continue; }
      if (act.picked) { blocked = 0; await page.waitForTimeout(8); continue; }
      if (act.over) { done = true; break; }
      if (act.blocked) { if (++blocked > 200) { errors.push('sim'+sim+' truly stuck'); break; } await page.waitForTimeout(15); continue; }
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
  console.log('games:', games, '| you:', youWins, '| rival:', rivalWins, '| deepest round:', maxRound, '| interrupt responses:', responded, '| declines:', declined);
  if (errors.length) { console.log('ERRORS ('+errors.length+'):'); errors.slice(0,20).forEach(e=>console.log(' -', e)); process.exit(1); }
  console.log('SMOKE TEST PASS — no runtime errors; every duel reached a valid win overlay.');
})().catch(e => { console.error('HARNESS ERROR:', e); process.exit(2); });
