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
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } return false; }
const flags=p=>p.evaluate(()=>({
  loss: CardmenEngine.isSpecialLossMode(), mill: CardmenEngine.isMillScope(),
  shieldScale: CardmenEngine.isShieldsPerPlayer(), drawScales: CardmenEngine.isDrawPerPlayer(),
  apexInf: CardmenEngine.isApexInfinity(), apexNoStrip: CardmenEngine.isApexNoStrip(),
  kits: CardmenEngine.isKits(),
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
       apexInf:false, apexNoStrip:false, kits:false}),
     'the shipped defaults are chosen / targeted / flat shields / scaling draw / no apex rules / no kits');
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
  ok(await p.evaluate(()=>!!document.getElementById('rulesBtn')), 'the setup dialog offers ⚗️ Custom rules');
  await openRules(p);
  const keys=await p.evaluate(()=>[].map.call(document.querySelectorAll('.settingRow[data-rule]'),b=>b.getAttribute('data-rule')));
  ok(JSON.stringify(keys)===JSON.stringify(['lossAll','millAll','shieldScale','flatDraw','apexInf','apexNoStrip','kits']),
     `seven toggles, in order (${keys.join(', ')})`);
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
  ok(scopes.length===7 && scopes.slice(0,4).every(t=>/3–6/.test(t)) && scopes.slice(4).every(t=>/all player counts/i.test(t)),
     `and every row carries its own scope tag (${scopes.join(' | ')})`);
  ok(await p.evaluate(()=>/tuned for the default rules/i.test((document.querySelector('.ruleWarn')||{}).textContent||'')),
     'and warns that the Rival does not adapt');

  // ---------- each toggle must actually reach the engine
  for(const [key, field, want] of [['lossAll','loss','all'],['millAll','mill','universal'],
                                   ['shieldScale','shieldScale',true],['flatDraw','drawScales',false],
                                   ['apexInf','apexInf',true],['apexNoStrip','apexNoStrip',true],
                                   ['kits','kits',true]]){
    ok(await toggle(p,key), `toggling ${key}`);
    await wait(120);
    const f=await flags(p);
    ok(f[field]===want, `  → the engine now reports ${field}=${JSON.stringify(f[field])}`);
  }
  ok((await p.evaluate(()=>localStorage.getItem('cmf_rules_v1')))==='lossAll,millAll,shieldScale,flatDraw,apexInf,apexNoStrip,kits',
     'the choice is serialised self-describingly, like the custom-deck key');

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
  ok(await p.evaluate(()=>[].every.call(document.querySelectorAll('.settingRow[data-rule]'),b=>b.disabled)),
     'and mid-game every row is disabled — rules are chosen before a game, not during one');
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
