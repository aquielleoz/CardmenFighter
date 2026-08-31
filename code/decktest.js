/* Custom deck builder ("parts" system) — full-UI test of the solo/local path.
 * Drives the New Duel screen: the "✏️ Custom deck…" entry opens the builder, four steppers must total
 * 4 parts, saving persists to localStorage and selects the new deck in every picker, and a duel dealt
 * from the composition really holds 13/26/13 by suit. Also covers cancel, the duplicate guard, delete,
 * and reload persistence. Run: node decktest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, 'CardmenFighter.html') + '?dbgsolo=1';
(async () => {
  const b = await chromium.launch(LAUNCH);
  const ctx = await b.newContext({ viewport: { width: 1100, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(e.message));
  let pass = 0, fail = 0; const ok = (c, m) => { console.log((c ? '✓' : '✗') + ' ' + m); c ? pass++ : fail++; };
  const openSetup = async () => { await p.evaluate(() => { var b = document.getElementById('newBtn'); if (b) b.click(); }); await p.waitForTimeout(350); };
  const pick = async (id, v) => { await p.evaluate(a => { var s = document.getElementById(a.id); s.value = a.v; s.dispatchEvent(new Event('change')); }, { id, v }); await p.waitForTimeout(300); };
  const plus = su => p.evaluate(s => document.querySelector('.dbRow[data-su="' + s + '"] [data-d="1"]').click(), su);
  const minus = su => p.evaluate(s => document.querySelector('.dbRow[data-su="' + s + '"] [data-d="-1"]').click(), su);
  const store = () => p.evaluate(() => JSON.parse(localStorage.getItem('cmf_decks_v1') || '[]'));
  // the builder pre-fills from whatever the picker had selected, so zero it before building a fresh mix
  const reset = () => p.evaluate(() => { for (var i = 0; i < 8; i++) Array.prototype.forEach.call(
    document.querySelectorAll('.deckBuild .dbRow [data-d="-1"]'), function (b) { if (!b.disabled) b.click(); }); });

  await p.goto(URL); await p.waitForTimeout(700);
  await openSetup();
  ok(await p.evaluate(() => !!document.querySelector('#setYouDeck option[value="__builddeck__"]')), 'the "✏️ Custom deck…" entry is in the deck picker');
  ok(await p.evaluate(() => document.querySelectorAll('#setYouDeck optgroup').length === 0), 'no "Your decks" group until one is saved');

  // ---- build 1 Wizard + 2 Cleric + 1 Fighter ----
  await pick('setYouDeck', '__builddeck__');
  ok(await p.evaluate(() => !!document.querySelector('.deckBuild')), 'the builder opens');
  ok(await p.evaluate(() => document.querySelectorAll('.deckBuild .dbRow').length === 4), 'four class steppers (one per suit)');
  ok(await p.evaluate(() => document.getElementById('dbSave').disabled === true), 'Save is disabled below 4 parts');
  ok(await p.evaluate(() => document.querySelector('.dbRow[data-su="D"] [data-d="-1"]').disabled === true), '− is disabled at 0 parts');
  await reset();
  await plus('D'); await plus('H'); await plus('H'); await plus('C');
  ok(await p.evaluate(() => /4 \/ 4 parts — 52 cards/.test(document.getElementById('dbTotal').textContent)), 'the total reads "4 / 4 parts — 52 cards"');
  ok(await p.evaluate(() => document.getElementById('dbSave').disabled === false), 'Save enables at exactly 4 parts');
  ok(await p.evaluate(() => document.querySelector('.dbRow[data-su="S"] [data-d="1"]').disabled === true), '+ is disabled once all 4 parts are spent');
  ok(await p.evaluate(() => document.querySelector('.dbRow[data-su="H"] .dbCards').textContent === '26 cards'), 'a doubled class shows 26 cards');
  await minus('H');
  ok(await p.evaluate(() => document.getElementById('dbSave').disabled === true), 'Save disables again after removing a part');
  await plus('H');
  await p.evaluate(() => { var n = document.getElementById('dbName'); n.value = 'Twin Cleric'; n.dispatchEvent(new Event('input')); });
  await p.evaluate(() => document.getElementById('dbSave').click()); await p.waitForTimeout(450);

  ok(JSON.stringify(await store()) === JSON.stringify([{ name: 'Twin Cleric', parts: { D: 1, H: 2, C: 1 } }]), 'saved to localStorage as {name, parts}');
  ok(await p.evaluate(() => document.getElementById('setYouDeck').value === 'custom:D1H2C1'), 'the new deck is selected in the picker it was opened from');
  ok(await p.evaluate(() => !!document.querySelector('#setYouDeck optgroup[label="Your decks"] option[value="custom:D1H2C1"]')), 'it appears under a "Your decks" group');
  ok(await p.evaluate(() => /Twin Cleric/.test(document.querySelector('#setYouDeck option[value="custom:D1H2C1"]').textContent)), 'the option shows its name');
  ok(await p.evaluate(() => !!document.querySelector('#setRivalDeck option[value="custom:D1H2C1"]')), 'the Rival picker offers it too');

  // ---- cancel leaves the previous pick alone ----
  await pick('setYouDeck', 'Sage');
  await pick('setYouDeck', '__builddeck__');
  await p.evaluate(() => document.getElementById('dbCancel').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(() => document.getElementById('setYouDeck').value === 'Sage'), 'cancelling the builder restores the previous selection');
  ok((await store()).length === 1, 'cancelling saves nothing');

  // ---- the duplicate-composition guard ----
  await pick('setYouDeck', '__builddeck__');
  ok(await p.evaluate(() => document.querySelector('.dbRow[data-su="D"] .dbN').textContent === '2'), 'the builder opens pre-filled from the current pick (Sage = 2 Wizard + 2 Cleric)');
  await reset();
  await plus('D'); await plus('H'); await plus('H'); await plus('C');
  await p.evaluate(() => { var n = document.getElementById('dbName'); n.value = 'Another Name'; n.dispatchEvent(new Event('input')); });
  await p.evaluate(() => document.getElementById('dbSave').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(() => /already have that exact mix/.test(document.getElementById('dbErr').textContent)), 'saving a duplicate composition is refused with a reason');
  ok((await store()).length === 1, 'the duplicate was not stored');
  await p.evaluate(() => document.getElementById('dbCancel').click()); await p.waitForTimeout(350);

  // ---- a real duel dealt from the composition ----
  await pick('setYouDeck', 'custom:D1H2C1');
  await p.evaluate(() => { var b = document.getElementById('goFirstBtn'); if (b) b.click(); }); await p.waitForTimeout(1000);
  const comp = await p.evaluate(() => {
    // every zone a card can be in at deal time — the shipped UI runs shield cards, so 4 of the 52 are in shieldPile
    var pl = window.__solo.st().players[0], all = [];
    ['deck', 'hand', 'energy', 'shuffle', 'shieldPile', 'forms', 'equipment', 'removed'].forEach(function (z) { if (pl[z]) all = all.concat(pl[z]); });
    return all.reduce(function (a, c) { a[c.suit] = (a[c.suit] || 0) + 1; return a; }, {});
  });
  ok(comp.D === 13 && comp.H === 26 && comp.C === 13 && !comp.S, 'the duel deals 13♦ / 26♥ / 13♣ from the composition (' + JSON.stringify(comp) + ')');
  ok(await p.evaluate(() => /Twin Cleric/.test((document.getElementById('youDeckName') || {}).textContent || '')), 'the in-duel HUD shows the deck name');

  // ---- persistence across a reload, then delete ----
  await p.goto(URL); await p.waitForTimeout(700); await openSetup();
  ok(await p.evaluate(() => !!document.querySelector('#setYouDeck option[value="custom:D1H2C1"]')), 'the saved deck survives a reload');
  await pick('setYouDeck', '__builddeck__');
  ok(await p.evaluate(() => document.querySelectorAll('.deckBuild .dbSavedRow').length === 1), 'the builder lists the saved deck with a delete button');
  p.on('dialog', d => d.accept());
  await p.evaluate(() => document.querySelector('.deckBuild .dbDel').click()); await p.waitForTimeout(450);
  ok((await store()).length === 0, 'deleting removes it from storage');
  await p.evaluate(() => { var c = document.getElementById('dbCancel'); if (c) c.click(); }); await p.waitForTimeout(400);
  ok(await p.evaluate(() => !document.querySelector('#setYouDeck option[value="custom:D1H2C1"]')), 'the deleted deck is gone from the pickers');
  ok(await p.evaluate(() => document.getElementById('setYouDeck').value !== 'custom:D1H2C1'), 'a picker pointing at the deleted deck fell back');

  // ---- the local free-for-all seat pickers are wired separately from the two duel selects ----
  await pick('setPlayers', '3');
  ok(await p.evaluate(() => !!document.querySelector('#oppList select[data-k="deck"]')), 'a 3-player setup shows a per-seat deck picker');
  ok(await p.evaluate(() => !!document.querySelector('#oppList select[data-k="deck"] option[value="__builddeck__"]')), 'the seat picker offers the builder too');
  await p.evaluate(() => { var s = document.querySelector('#oppList select[data-k="deck"]'); s.value = '__builddeck__'; s.dispatchEvent(new Event('change')); });
  await p.waitForTimeout(350);
  ok(await p.evaluate(() => !!document.querySelector('.deckBuild')), 'the builder opens from a seat picker');
  await reset(); await plus('S'); await plus('S'); await plus('S'); await plus('S');
  await p.evaluate(() => { var n = document.getElementById('dbName'); n.value = 'All Rogue'; n.dispatchEvent(new Event('input')); });
  await p.evaluate(() => document.getElementById('dbSave').click()); await p.waitForTimeout(500);
  ok(await p.evaluate(() => document.querySelector('#oppList select[data-k="deck"]').value === 'custom:S4'), 'the seat now holds the deck built for it');
  ok(await p.evaluate(() => { var o = JSON.parse(localStorage.getItem('cmf_setup_v1') || '{}'); return !!(o.opps && o.opps[0] && o.opps[0].deck === 'custom:S4'); }), 'the seat pick persists to the setup store');
  ok(await p.evaluate(() => document.querySelectorAll('#setPlayers option').length > 0 && document.getElementById('setPlayers').value === '3'), 'the player count survives the builder round-trip');

  /* ---- the picker's ORDER and its DEFAULT (v1.31.28). Full Set used to be the second option, so it was the
   * first thing a thumb landed on, and it was the netplay lobby's default outright. */
  const opts = await p.evaluate(() => [].map.call(document.querySelectorAll('#setYouDeck option'), o => o.value));
  ok(opts[0] === 'random', `🎲 Random leads the list (${opts[0]})`);
  const iFull = opts.indexOf('full'), iBuild = opts.indexOf('__builddeck__');
  ok(iFull === iBuild - 1 && iBuild === opts.length - 1,
     `Full Set is the LAST deck, with only the ✏️ Custom deck… action after it (full at ${iFull} of ${opts.length - 1})`);
  ok(opts.indexOf('Wizard') > 0 && opts.indexOf('Wizard') < iFull, 'and every class deck sits above it');
  /* On a FRESH store — a saved pick must still win, which is why this clears cmf_setup_v1 first rather than
   * asserting mid-suite where an earlier custom deck is legitimately remembered. */
  await p.evaluate(() => { try { localStorage.removeItem('cmf_setup_v1'); } catch (e) {} });
  await p.goto(URL); await p.waitForTimeout(700); await openSetup();
  ok(await p.evaluate(() => document.getElementById('setYouDeck').value === 'random'
                         && document.getElementById('setRivalDeck').value === 'random'),
     'on a first run both setup pickers default to Random, not to the Full Set');

  /* 🎲 Random means "surprise me with a CLASS" — it must never roll the 52-card set (Aj: "impossible is fine
   * actually"), nor a saved deck, nor the builder sentinel. 20k rolls, so a 1-in-20 leak would show up ~1000
   * times and even a 1-in-2000 one would almost certainly appear at least once. */
  const roll = await p.evaluate(() => {
    const n = 20000, tally = {};
    for (let i = 0; i < n; i++) { const d = window.__solo.resolveDeck('random'); tally[d] = (tally[d] || 0) + 1; }
    return { n, tally, classes: CardmenEngine.DECK_ORDER.slice() };
  });
  ok(!roll.tally.full, `Random never rolls the Full Set (${roll.tally.full || 0} of ${roll.n})`);
  ok(roll.classes.every(k => (roll.tally[k] || 0) > 0), 'and every one of the ten class decks is reachable');
  ok(Object.keys(roll.tally).every(k => roll.classes.indexOf(k) >= 0),
     'nothing else comes out of it either — no saved deck, no builder sentinel');

  ok(errs.length === 0, 'no JS errors' + (errs.length ? ': ' + errs.slice(0, 3).join(' | ') : ''));
  console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
  await b.close(); process.exit(fail ? 1 : 0);
})().catch(e => { console.error('ERR', e); process.exit(2); });
