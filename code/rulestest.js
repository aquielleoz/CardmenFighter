/* THE CUSTOM RULES MENU (v1.31.22), solo side.
 * Aj: "it's not the default or intended way to play the game, but it certainly is A way to play the game."
 * The engine already had every one of these behind a setter, so this feature is mostly SURFACING — which means
 * the risk is not in the rules themselves but in the wiring: a toggle that does not reach the engine, a game
 * that starts under the wrong rules, or an export that forgets which rules it was played under.
 *
 * That last one is why the export stamp ships with the menu rather than after it: an unstamped homebrew game
 * poisons PLAYER-PROFILE.md's ingestion log, and it cannot be repaired afterwards because the information was
 * never written down. Exactly the pre-v1.31.5 mistake.
 * Run: node rulestest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const HTML='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const flags=p=>p.evaluate(()=>({
  loss: CardmenEngine.isSpecialLossMode(), mill: CardmenEngine.isMillScope(),
  shieldScale: CardmenEngine.isShieldsPerPlayer(), drawScales: CardmenEngine.isDrawPerPlayer(),
  apexInf: CardmenEngine.isApexInfinity(), apexNoStrip: CardmenEngine.isApexNoStrip(),
  dblPair: CardmenEngine.isDoublePair(), kits3: CardmenEngine.isKits3(), quadro: CardmenEngine.isQuadro(),
}));
const openRules=async p=>{ await p.evaluate(()=>document.getElementById('rulesBtn').click()); await wait(300); };
const toggle=(p,k)=>p.evaluate(k=>{ const b=document.querySelector('.settingRow[data-rule="'+k+'"]'); if(b)b.click(); return !!b; }, k);
(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const ctx=await b.newContext({viewport:{width:900,height:1000}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(HTML); await wait(500);

  // ---------- defaults: the shipped game, and EVERY toggle off
  ok(JSON.stringify(await flags(p))===JSON.stringify({loss:'chosen',mill:'targeted',shieldScale:false,drawScales:true,
       apexInf:false, apexNoStrip:false, dblPair:'off', kits3:false, quadro:false}),
     'the shipped defaults are chosen / targeted / flat shields / scaling draw / no apex rules / no pair shapes');
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
  ok(await p.evaluate(()=>!!document.getElementById('rulesBtn')), 'the setup dialog offers ⚗️ Custom rules');
  await openRules(p);
  const keys=await p.evaluate(()=>[].map.call(document.querySelectorAll('.settingRow[data-rule]'),b=>b.getAttribute('data-rule')));
  ok(JSON.stringify(keys)===JSON.stringify(['lossAll','millAll','shieldScale','flatDraw','apexInf','apexNoStrip','dblPair','kits3','quadro']),
     `nine rules, in order (${keys.join(', ')})`);
  /* ORDER IS LOAD-BEARING here: apexNoStrip's note says "unless the rule above is also on", meaning apexInf.
   * Kits were first inserted between them, which silently pointed that sentence at the wrong rule. */
  ok(keys.indexOf('apexNoStrip')===keys.indexOf('apexInf')+1,
     'the apex pair stays adjacent — apexNoStrip\'s note refers to "the rule above"');
  ok(await p.evaluate(()=>[].every.call(document.querySelectorAll('.settingRow[data-rule]'),b=>!/\bon\b/.test(b.className))),
     'and every one of them is OFF by default — so "customised?" is just "is anything on?"');
  /* The panel must be honest about SCOPE. It used to say a duel plays the same either way, which was true while
   * every toggle was a 2-player no-op — and became FALSE the moment the apex rules landed, since those are the
   * first two that change a duel. This assertion is what forces the copy to keep up. */
  ok(await p.evaluate(()=>/first four only change 3–6 player games/i.test((document.querySelector('.ruleIntro')||{}).textContent||'')),
     'the panel distinguishes the multiplayer-only toggles from the ones that change duels');
  const scopes=await p.evaluate(()=>[].map.call(document.querySelectorAll('.settingRow[data-rule] .ruleScope'),e=>e.textContent.trim()));
  ok(scopes.length===9 && scopes.slice(0,4).every(t=>/3–6/.test(t)) && scopes.slice(4).every(t=>/all player counts/i.test(t)),
     `and every row carries its own scope tag (${scopes.join(' | ')})`);
  ok(await p.evaluate(()=>/tuned for the default rules/i.test((document.querySelector('.ruleWarn')||{}).textContent||'')),
     'and warns that the Rival does not adapt');

  // ---------- each toggle must actually reach the engine
  for(const [key, field, want] of [['lossAll','loss','all'],['millAll','mill','universal'],
                                   ['shieldScale','shieldScale',true],['flatDraw','drawScales',false],
                                   ['apexInf','apexInf',true],['apexNoStrip','apexNoStrip',true],
                                   ['kits3','kits3',true],['quadro','quadro',true]]){
    ok(await toggle(p,key), `toggling ${key}`);
    await wait(120);
    const f=await flags(p);
    ok(f[field]===want, `  → the engine now reports ${field}=${JSON.stringify(f[field])}`);
  }
  /* THE MODE ROW IS DRIVEN BY ITS SEGMENTS, not by clicking the row — a mode row is a <div> wrapping three
   * <button>s, because nesting buttons is invalid HTML. So the panel has two interaction shapes and both need
   * covering; a suite that only clicked rows would silently never exercise the segments. */
  const seg=(p,k,v)=>p.evaluate(([k,v])=>{
    const b=document.querySelector('.segBtn[data-mode-for="'+k+'"][data-mode-v="'+v+'"]');
    if(b) b.click(); return !!b;
  },[k,v]);
  for(const v of ['kits','poker']){
    ok(await seg(p,'dblPair',v), `picking dblPair=${v}`);
    await wait(120);
    ok((await flags(p)).dblPair===v, `  → the engine now reports dblPair=${v}`);
  }
  ok(await p.evaluate(()=>{
    const a=[].filter.call(document.querySelectorAll('.segBtn[data-mode-for="dblPair"]'),b=>b.classList.contains('active'));
    return a.length===1 && a[0].getAttribute('data-mode-v')==='poker' && a[0].getAttribute('aria-checked')==='true';
  }), 'and exactly ONE segment reads active — the modes are alternatives, never both');
  ok((await p.evaluate(()=>localStorage.getItem('cmf_rules_v1')))==='lossAll,millAll,shieldScale,flatDraw,apexInf,apexNoStrip,dblPair=poker,kits3,quadro',
     'the choice is serialised self-describingly, like the custom-deck key — the mode row carries its VALUE');
  /* The v1.31.24 boolean `kits` meant "consecutive runs of any length", which is now two settings. An old saved
   * key — or one from an older peer — must land on both halves, not silently turn the rule off. */
  ok(await p.evaluate(()=>{ window.__solo.setRulesFromKey('kits');
    return CardmenEngine.isDoublePair()==='kits' && CardmenEngine.isKits3()===true; }),
     'and a legacy `kits` key migrates to dblPair=kits + kits3, rather than quietly reverting to off');
  await p.evaluate(()=>window.__solo.setRulesFromKey('lossAll,millAll,shieldScale,flatDraw,apexInf,apexNoStrip,dblPair=poker,kits3,quadro'));

  // ---------- presets + Clear all (v1.31.30): one row that moves every rule at once
  const bulk = p => p.evaluate(() => [].map.call(document.querySelectorAll('.ruleBulk .bulkBtn'),
    b => ({ preset: b.getAttribute('data-preset'), id: b.id, txt: b.textContent.trim(), off: b.disabled, active: b.classList.contains('active') })));
  let row = await bulk(p);
  ok(row.length === 2 && row[0].preset === 'chikicha' && row[1].id === 'ruleClear',
     `the panel offers a preset and a Clear all (${row.map(r => r.txt).join(' | ')})`);
  ok(!row[1].off, 'Clear all is live while rules are on');
  /* A PRESET IS AN EXACT STATE, not an additive one — Aj named Raw Chikicha as "kits + quadro and nothing
   * else", so applying it over a table full of other rules must turn those OFF. Every rule is on at this point
   * in the suite, which is exactly the case that would catch an additive implementation. */
  await p.evaluate(() => document.querySelector('.bulkBtn[data-preset="chikicha"]').click()); await wait(250);
  const after = await flags(p);
  ok(after.dblPair === 'kits' && after.kits3 === true && after.quadro === true,
     'Raw Chikicha turns on 2 Kits, 3 Kits and Quadro');
  ok(after.loss === 'chosen' && after.mill === 'targeted' && after.shieldScale === false
     && after.drawScales === true && after.apexInf === false && after.apexNoStrip === false,
     'and turns everything else back OFF — "and nothing else" is part of the preset');
  ok((await p.evaluate(() => window.__solo.rulesKey())) === 'dblPair=kits,kits3,quadro',
     'the serialised key is exactly the preset, so netplay and the export carry the rules and not its name');
  row = await bulk(p);
  ok(row[0].active, 'and the preset button reads active, because "exactly these rules" is a checkable claim');
  await toggle(p, 'lossAll'); await wait(150);
  ok(!(await bulk(p))[0].active, 'one further change and it stops reading active');

  await p.evaluate(() => document.getElementById('ruleClear').click()); await wait(250);
  ok((await p.evaluate(() => window.__solo.rulesKey())) === '', 'Clear all empties the whole rule set');
  ok(JSON.stringify(await flags(p)) === JSON.stringify({ loss: 'chosen', mill: 'targeted', shieldScale: false,
       drawScales: true, apexInf: false, apexNoStrip: false, dblPair: 'off', kits3: false, quadro: false }),
     'and the engine is back on the shipped game, mode rows included');
  ok((await p.evaluate(() => localStorage.getItem('cmf_rules_v1'))) === '', 'the cleared state is saved too');
  ok((await bulk(p))[1].off, 'and Clear all disables itself once there is nothing to clear');
  ok(await p.evaluate(() => !/· on/.test((document.getElementById('rulesBtn') || {}).textContent || '')),
     'the setup button drops its "· on" marker');

  // put a customised set back, since the rest of the suite plays a game under it
  await p.evaluate(() => window.__solo.setRulesFromKey('shieldScale,flatDraw'));
  await p.evaluate(() => document.getElementById('ruleDone').click()); await wait(200);
  await openRules(p);

  // ---------- a real game must be played under them
  await p.evaluate(()=>document.getElementById('ruleDone').click()); await wait(300);
  ok(await p.evaluate(()=>/· on/.test((document.getElementById('rulesBtn')||{}).textContent||'')),
     'and the setup button now says "· on", so a customised game is never a surprise');
  await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='4'; s.dispatchEvent(new Event('change')); }); await wait(300);
  await p.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); });
  ok(await until(async()=>!!(await p.evaluate(()=>window.__solo && window.__solo.st()))), 'a 4-player game starts');
  const live=await p.evaluate(()=>{ const st=window.__solo.st();
    return { players:st.numPlayers, shields:st.players[0].shields, draw:CardmenEngine.drawCountFor(st) }; });
  ok(live.shields===6, `shields scaled with the table: ${live.shields} at ${live.players} players (default would be 4)`);
  ok(live.draw===2, `and the draw did NOT scale: ${live.draw} (default at 4 players would be 4)`);

  // ---------- mid-game the panel is READ-ONLY: an edit now would be ignored or incoherent
  await p.evaluate(()=>document.getElementById('settingsBtn').click()); await wait(300);
  ok(await p.evaluate(()=>!!document.getElementById('setRules')), 'Settings offers the rules too — where you look when a game feels wrong');
  await p.evaluate(()=>document.getElementById('setRules').click()); await wait(300);
  /* BOTH SHAPES. A mode row is a <div>, which cannot be `disabled` at all — its SEGMENTS carry it, and the
   * click wiring is skipped wholesale. Checking only `row.disabled` would have passed a panel whose segments
   * were still live, which is exactly the mid-game edit this is here to prevent. */
  ok(await p.evaluate(()=>[].every.call(document.querySelectorAll('.settingRow[data-rule]'),
       r=>r.hasAttribute('data-mode') ? [].every.call(r.querySelectorAll('.segBtn'),b=>b.disabled) : r.disabled)),
     'and mid-game every row is disabled — rules are chosen before a game, not during one');
  ok(await p.evaluate(()=>[].every.call(document.querySelectorAll('.ruleBulk .bulkBtn'),b=>b.disabled)),
     'and so are the preset and Clear all buttons — a bulk edit is still an edit');
  ok(await p.evaluate(()=>{
    const before=CardmenEngine.isDoublePair();
    const other=[].filter.call(document.querySelectorAll('.segBtn[data-mode-for="dblPair"]'),b=>!b.classList.contains('active'))[0];
    if(other) other.click();
    return CardmenEngine.isDoublePair()===before;
  }), 'and clicking a read-only segment changes nothing in the engine — not merely greyed out');
  ok(await p.evaluate(()=>/already running/i.test((document.querySelector('.modal .netmsg')||{}).textContent||'')),
     'with a line saying why, rather than a dead control');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  await ctx.close();

  // ---------- the choice survives a reload (it is the host's preference, not a per-game accident)
  { const c2=await b.newContext({viewport:{width:900,height:1000}});
    const p2=await c2.newPage();
    await p2.goto(HTML); await wait(400);
    await p2.evaluate(()=>{ try{ localStorage.setItem('cmf_rules_v1','lossAll,flatDraw'); }catch(e){} });
    await p2.reload(); await wait(600);
    const f=await flags(p2);
    ok(f.loss==='all' && f.drawScales===false && f.mill==='targeted' && f.shieldScale===false,
       `a saved rule set is restored exactly (loss=${f.loss}, drawScales=${f.drawScales}, mill=${f.mill})`);
    await c2.close(); }

  /* ---------- the EXPORT must record which rules the game was played under. Asserted from a REAL record via
   * the same seam exporttest uses — an earlier draft of this checked the SOURCE TEXT for `rules:rulesKey()`,
   * which would have passed just as happily if the field never reached a record. */
  { const c3=await b.newContext({viewport:{width:900,height:1000}});
    const p3=await c3.newPage(); const e3=[]; p3.on('pageerror',e=>e3.push(e.message));
    await p3.goto(HTML); await wait(400);
    await p3.evaluate(()=>{ try{ localStorage.setItem('cmf_rules_v1','lossAll,shieldScale'); localStorage.removeItem('cmf_games_v1'); }catch(e){} });
    await p3.reload(); await wait(600);
    await p3.evaluate(()=>document.getElementById('newBtn').click()); await wait(250);
    await p3.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await wait(250);
    await p3.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); });
    await until(async()=>!!(await p3.evaluate(()=>window.__solo && window.__solo.st())));
    const rec=await p3.evaluate(()=>{
      const st=window.__solo.st();
      if(!st.finished){ st.finished=true; st.winner=1; }     // end it so the record has a winner to name
      window.__solo.record();
      const g=window.__solo.games(); return g[g.length-1]||null;
    });
    ok(!!rec, 'a real game record was written');
    ok(!!rec && rec.v==='2.1-mp', `the schema is bumped so pre-rules files stay identifiable ("${rec&&rec.v}")`);
    ok(!!rec && rec.rules==='lossAll,shieldScale',
       `and it records the RULE SET the game was played under ("${rec&&rec.rules}") — without this a homebrew game is indistinguishable from a weird one`);
    ok(e3.length===0,'no JS errors on the export path'+(e3.length?': '+e3.slice(0,2).join(' | '):''));
    await c3.close(); }

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
