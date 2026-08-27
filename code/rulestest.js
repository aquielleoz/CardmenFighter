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
  chopQuadro: CardmenEngine.isChopQuadro(), chopKits: CardmenEngine.isChopKits(), chopSflush: CardmenEngine.isChopSflush(),
  chopStrips: CardmenEngine.isChopStrips(),
  trioOne: CardmenEngine.isTrioOne(), fourTwo: CardmenEngine.isFourTwo(),
  airplane: CardmenEngine.isAirplane(), chainLong: CardmenEngine.isChainLong(),
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
       apexInf:false, apexNoStrip:false, dblPair:'off', kits3:false, quadro:false,
       chopQuadro:false, chopKits:false, chopSflush:false, chopStrips:false,
       trioOne:false, fourTwo:false, airplane:false, chainLong:false}),
     'the shipped defaults are chosen / targeted / flat shields / scaling draw / no apex rules / no pair shapes');
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
  ok(await p.evaluate(()=>!!document.getElementById('rulesBtn')), 'the setup dialog offers ⚗️ Custom rules');
  await openRules(p);
  const keys=await p.evaluate(()=>[].map.call(document.querySelectorAll('.settingRow[data-rule]'),b=>b.getAttribute('data-rule')));
  ok(JSON.stringify(keys)===JSON.stringify(['basics','lossAll','millAll','shieldScale','flatDraw','apexInf','apexNoStrip','dblPair','kits3','quadro','chopQuadro','chopKits','chopSflush','chopStrips','trioOne','fourTwo','airplane','chainLong']),
     `eighteen rules, the game mode first and the Dou Dizhu shapes last (${keys.join(', ')})`);
  /* ORDER IS LOAD-BEARING here: apexNoStrip's note says "unless the rule above is also on", meaning apexInf.
   * Kits were first inserted between them, which silently pointed that sentence at the wrong rule. */
  ok(keys.indexOf('apexNoStrip')===keys.indexOf('apexInf')+1,
     'the apex pair stays adjacent — apexNoStrip\'s note refers to "the rule above"');
  ok(await p.evaluate(()=>[].every.call(document.querySelectorAll('.settingRow[data-rule]'),b=>!/\bon\b/.test(b.className))),
     'and every one of them is OFF by default — so "customised?" is just "is anything on?"');
  /* The panel must be honest about SCOPE. It used to say a duel plays the same either way, which was true while
   * every toggle was a 2-player no-op — and became FALSE the moment the apex rules landed, since those are the
   * first two that change a duel. This assertion is what forces the copy to keep up. */
  /* THE INTRO NO LONGER COUNTS ROWS. It used to say "the first four … the last three", and went stale on every
   * added rule — twice shipping a wrong number. It now points at the per-row scope tags, which are asserted
   * just below, so the two cannot disagree. */
  ok(await p.evaluate(()=>/each section says which player counts/i.test((document.querySelector('.ruleIntro')||{}).textContent||'')
                       && !/first (four|five|three)/i.test((document.querySelector('.ruleIntro')||{}).textContent||'')),
     'the intro points at the sections\' scope, and still counts nothing');
  const scopes=await p.evaluate(()=>[].map.call(document.querySelectorAll('.ruleSect .ruleScope'),e=>e.textContent.trim()));
  /* SCOPE MOVED TO THE SECTION (v1.31.37). Every section holds rules of one scope — checked, all four are
   * homogeneous — so thirteen identical chips became four, and a row carries none. */
  ok(scopes.length===4 && /all player counts/i.test(scopes[0]) && /3–6/.test(scopes[1])
     && scopes.slice(2).every(t=>/all player counts/i.test(t)),
     `four section scope tags, not eighteen row ones (${scopes.join(' | ')})`);
  ok(await p.evaluate(()=>document.querySelectorAll('.settingRow .ruleScope').length===0),
     'and no row repeats what its section already said');
  const sects = await p.evaluate(()=>[].map.call(document.querySelectorAll('.ruleSect .sectName'),e=>e.textContent.trim()));
  ok(JSON.stringify(sects)===JSON.stringify(['The game','Table rules','The 2','Shapes & chops']),
     `the panel is four sections — shapes are grouped by KIND, not by which game they came from (${sects.join(' | ')})`);
  ok(sects.indexOf('Uncategorised')<0,
     'and no rule fell outside them — an unclaimed rule renders under a visible Uncategorised heading, never vanishes');
  ok(await p.evaluate(()=>{
       const b=document.querySelector('.ruleBulk'); if(!b) return false;
       const sec=b.closest('.ruleSect'); const nm=sec&&sec.querySelector('.sectName');
       return !!nm && nm.textContent.trim()==='Shapes & chops';
     }), 'the presets sit in the heading of the group they change — which is the whole point of the sections');
  ok(await p.evaluate(()=>/tuned for the default rules/i.test((document.querySelector('.ruleWarn')||{}).textContent||'')),
     'and warns that the Rival does not adapt');

  // ---------- each toggle must actually reach the engine
  for(const [key, field, want] of [['lossAll','loss','all'],['millAll','mill','universal'],
                                   ['shieldScale','shieldScale',true],['flatDraw','drawScales',false],
                                   ['apexInf','apexInf',true],['apexNoStrip','apexNoStrip',true],
                                   ['kits3','kits3',true],['quadro','quadro',true],
                                   ['chopQuadro','chopQuadro',true],['chopKits','chopKits',true],
                                   ['chopSflush','chopSflush',true],
                                   ['chopStrips','chopStrips',true],
                                   ['trioOne','trioOne',true],['fourTwo','fourTwo',true],
                                   ['airplane','airplane',true],['chainLong','chainLong',true]]){
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
  ok((await p.evaluate(()=>localStorage.getItem('cmf_rules_v1')))==='lossAll,millAll,shieldScale,flatDraw,apexInf,apexNoStrip,dblPair=poker,kits3,quadro,chopQuadro,chopKits,chopSflush,chopStrips,trioOne,fourTwo,airplane,chainLong',
     'the choice is serialised self-describingly, like the custom-deck key — the mode row carries its VALUE');
  /* The v1.31.24 boolean `kits` meant "consecutive runs of any length", which is now two settings. An old saved
   * key — or one from an older peer — must land on both halves, not silently turn the rule off. */
  ok(await p.evaluate(()=>{ window.__solo.setRulesFromKey('kits');
    return CardmenEngine.isDoublePair()==='kits' && CardmenEngine.isKits3()===true; }),
     'and a legacy `kits` key migrates to dblPair=kits + kits3, rather than quietly reverting to off');
  await p.evaluate(()=>window.__solo.setRulesFromKey('lossAll,millAll,shieldScale,flatDraw,apexInf,apexNoStrip,dblPair=poker,kits3,quadro,chop'));

  /* ---------- THE CHOP DEPENDENCY (v1.31.33). The engine treats a chopper's shape as enabled either way
   * (`quadroOn()` is `QUADRO || CHOP_Q`), so an unticked Quadro box next to a ticked "Quadro chops" box told the
   * player something FALSE about the game. The panel ticks it with them — and unticking the shape must take its
   * chop with it, or the display lies again in the other direction. */
  await p.evaluate(()=>window.__solo.setRulesFromKey('')); await wait(120);
  await p.evaluate(()=>document.getElementById('ruleDone').click()); await wait(150);
  await openRules(p);
  const rulesOn = () => p.evaluate(()=>[].filter.call(document.querySelectorAll('.settingRow[data-rule]'),
    r=>/\bon\b/.test(r.className)).map(r=>r.getAttribute('data-rule')));
  await toggle(p,'chopQuadro'); await wait(200);
  let depOn = await rulesOn();
  ok(depOn.indexOf('quadro')>=0 && depOn.indexOf('chopQuadro')>=0,
     `turning on the Quadro chop ticks Quadro with it (${depOn.join(', ')})`);
  ok((await flags(p)).quadro===true, '  and the engine agrees, so the box is not decorative');
  await toggle(p,'quadro'); await wait(200);
  depOn = await rulesOn();
  ok(depOn.indexOf('quadro')<0 && depOn.indexOf('chopQuadro')<0,
     `unticking Quadro takes its chop with it (${depOn.join(', ')||'none'}) — the dependency holds both ways`);
  await toggle(p,'chopKits'); await wait(200);
  depOn = await rulesOn();
  ok(depOn.indexOf('kits3')>=0 && depOn.indexOf('chopKits')>=0, '3 Kits behaves the same way');
  await toggle(p,'chopSflush'); await wait(200);
  depOn = await rulesOn();
  ok(depOn.indexOf('chopSflush')>=0 && depOn.length===3,
     'while the Straight Flush chop needs no shape row — it is the only way that shape exists');

  /* `needsAny` — "Chops destroy shields too" means nothing with no chop enabled (Aj: "this option should
   * uncheck if chops were not available"), so it is inert until one is, and clears itself when the last goes
   * off. A checked box that cannot do anything is worse than a greyed one. */
  const stripRow = () => p.evaluate(()=>{ const r=document.querySelector('.settingRow[data-rule="chopStrips"]');
    return { inert: !!r.disabled, checked: /\bon\b/.test(r.className), engine: CardmenEngine.isChopStrips() }; });
  await p.evaluate(()=>window.__solo.setRulesFromKey('')); await wait(120);
  await p.evaluate(()=>document.getElementById('ruleDone').click()); await wait(150);
  await openRules(p);
  let sr = await stripRow();
  ok(sr.inert && !sr.checked, 'with no chop enabled, "Chops destroy shields too" is inert');
  await toggle(p,'chopStrips'); await wait(200);
  sr = await stripRow();
  ok(!sr.checked && sr.engine === false, '  and clicking it does nothing at all — not merely styled as dead');
  await toggle(p,'chopQuadro'); await wait(250);
  ok(!(await stripRow()).inert, 'enabling a chop brings it to life');
  await toggle(p,'chopStrips'); await wait(250);
  sr = await stripRow();
  ok(sr.checked && sr.engine === true, '  and then it takes');
  await toggle(p,'chopQuadro'); await wait(250);
  sr = await stripRow();
  ok(!sr.checked && sr.engine === false && sr.inert,
     'turning the last chop off clears it and returns it to inert — a live setting for a rule nobody is playing');
  await p.evaluate(()=>window.__solo.setRulesFromKey('lossAll,millAll,shieldScale,flatDraw,apexInf,apexNoStrip,dblPair=poker,kits3,quadro,chopQuadro,chopKits,chopSflush,chopStrips'));
  await p.evaluate(()=>document.getElementById('ruleDone').click()); await wait(150);
  await openRules(p);

  ok(await p.evaluate(()=>/Straight Flush beats the 2/.test(
       (document.querySelector('.settingRow[data-rule="chopSflush"] .settingLbl')||{}).textContent||'')),
     'and it is named for the shape a player would call it, with the definition in the note');
  await p.evaluate(()=>window.__solo.setRulesFromKey('lossAll,millAll,shieldScale,flatDraw,apexInf,apexNoStrip,dblPair=poker,kits3,quadro,chopQuadro,chopKits,chopSflush'));
  await p.evaluate(()=>document.getElementById('ruleDone').click()); await wait(150);
  await openRules(p);

  /* ---------- NOTES BEHIND A `?` (v1.31.35). Thirteen rules with a two-to-three-line note each was a wall of
   * text. These assertions are about VISIBILITY, not text: `textContent` still returns a hidden note's words, so
   * a text assertion would pass on a note nobody can ever reach — the exact trap the BACKLOG entry warned about
   * before this was built. offsetParent is null for a display:none element. */
  const qCount = await p.evaluate(()=>document.querySelectorAll('.ruleQ[data-note-for]').length);
  const rowCount = await p.evaluate(()=>document.querySelectorAll('.settingRow[data-rule]').length);
  ok(qCount === rowCount && rowCount === 18, `every rule carries a ? (${qCount} of ${rowCount})`);
  const noteShown = k => p.evaluate(k=>{
    const n=document.querySelector('.settingRow[data-rule="'+k+'"] .settingNote');
    return !!(n && n.offsetParent);
  }, k);
  const clickQ = k => p.evaluate(k=>{ const q=document.querySelector('.ruleQ[data-note-for="'+k+'"]'); if(q)q.click(); return !!q; }, k);
  ok((await noteShown('quadro'))===false, 'notes start hidden — the panel is a scannable list, not a wall');
  const wasOn = await p.evaluate(()=>CardmenEngine.isQuadro());
  ok(await clickQ('quadro'), 'the ? is clickable');
  await wait(150);
  ok(await noteShown('quadro'), 'and it opens that note');
  ok((await p.evaluate(()=>CardmenEngine.isQuadro()))===wasOn,
     'WITHOUT toggling the rule underneath — the row IS a <button>, so the ? has to stop propagation');
  ok((await noteShown('chopKits'))===false, 'and only that one — each note opens on its own');
  await clickQ('quadro'); await wait(150);
  ok((await noteShown('quadro'))===false, 'clicking it again closes the note');
  /* KEYBOARD: Enter only. Space is deliberately left alone, because inside a <button> row the browser uses it to
   * activate the row itself, which would toggle the rule while you were trying to read about it. */
  await p.evaluate(()=>{ const q=document.querySelector('.ruleQ[data-note-for="quadro"]');
    q.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true})); }); await wait(150);
  ok(await noteShown('quadro'), 'Enter opens it too');
  await clickQ('quadro'); await wait(150);

  // ---------- presets + Clear all (v1.31.30): one row that moves every rule at once
  /* Both containers: the presets live in their section's heading now, Clear all with Done in the footer. */
  const bulk = p => p.evaluate(() => [].map.call(document.querySelectorAll('.modal .bulkBtn'),
    b => ({ preset: b.getAttribute('data-preset'), id: b.id, txt: b.textContent.trim(), off: b.disabled, active: b.classList.contains('active') })));
  let row = await bulk(p);
  ok(row.length === 4 && row[0].preset === 'chikicha' && row[1].preset === 'tienlen'
     && row[2].preset === 'doudizhu' && row.filter(r => r.id === 'ruleClear').length === 1,
     `three presets and a Clear all (${row.map(r => r.txt).join(' | ')})`);
  ok(await p.evaluate(()=>{
       const c=document.getElementById('ruleClear'); const f=c&&c.closest('.ruleFoot');
       return !!(f && f.querySelector('#ruleDone'));
     }), 'Clear all sits with Done, both being whole-panel actions rather than rules');
  /* AND IT STAYS PUT WHILE SCROLLING (Aj asked for either a second copy at the top or a floating bar; a bar
   * needs only one of each button). Hit-tested, not merely measured — a bar that is present but covered is the
   * v1.31.25 stacking bug all over again, and no DOM assertion can see it. */
  const footAt = async top => p.evaluate(t => {
    const m = document.getElementById('modal'); m.scrollTop = t;
    const f = document.querySelector('.ruleFoot'), mr = m.getBoundingClientRect(), fr = f.getBoundingClientRect();
    const el = document.elementFromPoint(Math.round(fr.left + fr.width / 2), Math.round(fr.top + fr.height / 2));
    return { pinned: Math.abs(mr.bottom - fr.bottom) <= 2, clickable: !!(el && f.contains(el)) };
  }, top);
  const scrollable = await p.evaluate(() => { const m = document.getElementById('modal'); return m.scrollHeight > m.clientHeight + 1; });
  if (scrollable) {
    const a = await footAt(0), mid = await footAt(300), end = await footAt(99999);
    ok(a.pinned && mid.pinned && end.pinned, 'the footer stays pinned to the modal edge at every scroll position');
    ok(a.clickable && mid.clickable && end.clickable, '  and is hit-testable there, not merely present in the DOM');
    await p.evaluate(() => { document.getElementById('modal').scrollTop = 0; });
  } else {
    /* At this viewport the panel fits, so there is nothing to stick to — assert the invariant that holds either
     * way rather than reporting a branch (see nettest_actloop's `ok(true, ...)`). */
    ok((await footAt(0)).clickable, 'the panel fits at this size, and the footer is reachable regardless');
  }
  ok(!row.filter(b => b.id === 'ruleClear')[0].off, 'Clear all is live while rules are on');
  /* A PRESET IS AN EXACT STATE, not an additive one — Aj named Chikicha Specials as "kits + quadro and nothing
   * else", so applying it over a table full of other rules must turn those OFF. Every rule is on at this point
   * in the suite, which is exactly the case that would catch an additive implementation. */
  /* DOU DIZHU is the fullest set — six shapes plus the bomb's chop — so it is also the sharpest test that a
   * preset REPLACES rather than adds: coming from Tiến lên it must turn chopKits back off, and the four-card slot
   * must stay off, because 连对's floor is three consecutive pairs. */
  await p.evaluate(() => document.querySelector('.bulkBtn[data-preset="doudizhu"]').click()); await wait(250);
  const dd = await flags(p);
  ok(dd.kits3 && dd.chainLong && dd.trioOne && dd.fourTwo && dd.airplane && dd.quadro && dd.chopQuadro,
     'Dou Dizhu turns on 3 Kits, long straights, trio+1, four+two, the airplane and the bomb');
  ok(dd.dblPair === 'off' && dd.chopKits === false && dd.chopSflush === false,
     'and nothing else — the four-card slot stays off (连对 needs three pairs) and Tiến lên\'s kit-chop is cleared');
  ok((await p.evaluate(() => window.__solo.rulesKey())) === 'kits3,quadro,chopQuadro,trioOne,fourTwo,airplane,chainLong',
     'so the three presets are three exact states, not three accumulations');
  ok((await bulk(p)).filter(b => b.active).length === 1, 'and exactly one reads active at a time');

  await p.evaluate(() => document.querySelector('.bulkBtn[data-preset="chikicha"]').click()); await wait(250);
  const after = await flags(p);
  ok(after.dblPair === 'kits' && after.kits3 === true && after.quadro === true && after.chopQuadro === true
     && after.chopKits === false && after.chopSflush === false,
     'Chikicha Specials turns on 2 Kits, 3 Kits, Quadro and the QUADRO chop only (Aj: 3 Kits as a chopper belongs to a Tiến lên preset, not this one)');
  ok(after.loss === 'chosen' && after.mill === 'targeted' && after.shieldScale === false
     && after.drawScales === true && after.apexInf === false && after.apexNoStrip === false,
     'and turns everything else back OFF — "and nothing else" is part of the preset');
  ok((await p.evaluate(() => window.__solo.rulesKey())) === 'dblPair=kits,kits3,quadro,chopQuadro',
     'the serialised key is exactly the preset, so netplay and the export carry the rules and not its name');
  row = await bulk(p);
  ok(row[0].active && !row[1].active,
     'and only THAT preset reads active — "exactly these rules" is a checkable claim, so two cannot both be it');
  /* TIẾN LÊN is where `chopKits` belongs (Aj put it here rather than in Chikicha Specials). It is also the
   * check that a second preset does not inherit the first's rules: the four-card double-pair slot must go OFF,
   * since the family's floor is three consecutive pairs, not two. */
  await p.evaluate(() => document.querySelector('.bulkBtn[data-preset="tienlen"]').click()); await wait(250);
  const tl = await flags(p);
  ok(tl.kits3 === true && tl.quadro === true && tl.chopKits === true && tl.chopQuadro === true,
     'Tiến lên turns on both of the family\'s bombs and chops with both');
  ok(tl.dblPair === 'off' && tl.chopSflush === false,
     'and leaves out the four-card slot and the straight-flush chop — neither is a Tiến lên shape');
  ok((await p.evaluate(() => window.__solo.rulesKey())) === 'kits3,quadro,chopQuadro,chopKits',
     'so switching presets REPLACES the rule set rather than adding to it');
  row = await bulk(p);
  ok(row[1].active && !row[0].active, 'and the active marker moves with it');
  await p.evaluate(() => document.querySelector('.bulkBtn[data-preset="chikicha"]').click()); await wait(250);
  await toggle(p, 'lossAll'); await wait(150);
  ok(!(await bulk(p))[0].active, 'one further change and it stops reading active');

  await p.evaluate(() => document.getElementById('ruleClear').click()); await wait(250);
  ok((await p.evaluate(() => window.__solo.rulesKey())) === '', 'Clear all empties the whole rule set');
  ok(JSON.stringify(await flags(p)) === JSON.stringify({ loss: 'chosen', mill: 'targeted', shieldScale: false,
       drawScales: true, apexInf: false, apexNoStrip: false, dblPair: 'off', kits3: false, quadro: false,
       chopQuadro: false, chopKits: false, chopSflush: false, chopStrips: false,
       trioOne: false, fourTwo: false, airplane: false, chainLong: false }),
     'and the engine is back on the shipped game, mode rows included');
  ok((await p.evaluate(() => localStorage.getItem('cmf_rules_v1'))) === '', 'the cleared state is saved too');
  ok((await bulk(p)).filter(b => b.id === 'ruleClear')[0].off,
     'and Clear all disables itself once there is nothing to clear');   // by id: an added preset shifts indices
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
  /* READING IS THE ONE THING READ-ONLY MUST NOT DISABLE. The point of a mid-game panel is to explain the rules
   * you are playing under, so the ? stays live while every other control is dead. */
  ok((await p.evaluate(()=>{
       const n=document.querySelector('.settingRow[data-rule="quadro"] .settingNote'); return !!(n&&n.offsetParent);
     }))===false, 'mid-game the notes start hidden as usual');
  await p.evaluate(()=>{ const q=document.querySelector('.ruleQ[data-note-for="quadro"]'); if(q)q.click(); }); await wait(150);
  ok(await p.evaluate(()=>{
       const n=document.querySelector('.settingRow[data-rule="quadro"] .settingNote'); return !!(n&&n.offsetParent);
     }), 'but the ? still opens one — read-only disables editing, not reading');
  ok(await p.evaluate(()=>{
    const before=CardmenEngine.isDoublePair();
    const other=[].filter.call(document.querySelectorAll('.segBtn[data-mode-for="dblPair"]'),b=>!b.classList.contains('active'))[0];
    if(other) other.click();
    return CardmenEngine.isDoublePair()===before;
  }), 'and clicking a read-only segment changes nothing in the engine — not merely greyed out');
  ok(await p.evaluate(()=>/already running/i.test((document.querySelector('.modal .netmsg')||{}).textContent||'')),
     'with a line saying why, rather than a dead control');
  /* ---------- THE GAME MODE (v1.31.32), moved here out of the setup dialog. It is only observable on a live
   * game, so this starts one — and it is the row that closed a real gap: hostStartRealN used to hardcode
   * gameBasics=false, so an online game silently ignored the choice. Rules travel to clients, so now it cannot. */
  const p4=await ctx.newPage(); p4.on('pageerror',e=>errs.push('p4: '+e.message));
  await p4.goto(HTML); await wait(500);
  await p4.evaluate(()=>window.__solo.setRulesFromKey('basics=basics'));
  ok((await p4.evaluate(()=>window.__solo.rulesKey()))==='basics=basics',
     'Basics serialises like any other mode rule, so it reaches a netplay client and the export');
  await p4.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
  ok(await p4.evaluate(()=>/Basics/.test((document.getElementById('modeHint')||{}).textContent||'')
                       && /Custom rules/.test((document.getElementById('modeHint')||{}).textContent||'')),
     'the setup dialog still SHOWS the mode and names where to change it — Basics is the beginner ramp, so it must not go invisible');
  ok(!(await p4.evaluate(()=>!!document.getElementById('setMode'))),
     'and the old segmented control is gone from the setup dialog');
  await p4.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); });
  ok(await until(async()=>!!(await p4.evaluate(()=>window.__solo && window.__solo.st()))), 'a duel starts under it');
  ok(await p4.evaluate(()=>window.__solo.st().basics===true),
     'and the game is really in Basics — the rule reaches newGame, not just the panel');
  await p4.evaluate(()=>window.__solo.setRulesFromKey(''));

  /* ---------- WIDE SCREENS (v1.31.36). Aj, with a screenshot: "what i'd hope to solve was the scrolling on
   * desktop. because really you can fit more with all this real estate." Hiding the notes fixed the phone; this
   * fixes the desktop. Two columns from 1040px, three from 1400px with the modal growing to match so a column
   * keeps its width — otherwise the labels wrap more and the rows give back what the extra column saved. */
  const layout = async vp => {
    const c = await b.newContext({ viewport: vp });
    const q = await c.newPage(); q.on('pageerror', e => errs.push('wide: ' + e.message));
    await q.goto(HTML); await wait(450);
    await q.evaluate(() => document.getElementById('newBtn').click()); await wait(220);
    const setupW = await q.evaluate(() => Math.round(document.getElementById('modal').getBoundingClientRect().width));
    await q.evaluate(() => document.getElementById('rulesBtn').click()); await wait(220);
    const out = await q.evaluate(() => {
      const m = document.getElementById('modal');
      const rows = [].slice.call(document.querySelectorAll('.settingRow[data-rule]'));
      const f = document.querySelector('.ruleFoot');
      const mr = m.getBoundingClientRect(), fr = f.getBoundingClientRect();
      const el = document.elementFromPoint(Math.round(fr.left + fr.width / 2), Math.round(fr.top + fr.height / 2));
      return { setup: 0, w: Math.round(m.getBoundingClientRect().width),
               cols: new Set(rows.map(r => Math.round(r.getBoundingClientRect().left))).size,
               fits: m.scrollHeight <= m.clientHeight + 1,
               footPinned: Math.abs(mr.bottom - fr.bottom) <= 2 && !!(el && f.contains(el)) };
    });
    out.setup = setupW;
    /* THE LEAK GUARD: the width is a class on the shared #modal, so the dialog that opens NEXT must not inherit
     * it. showModal resets the class list for exactly this reason. */
    await q.evaluate(() => document.getElementById('ruleDone').click()); await wait(250);
    out.afterW = await q.evaluate(() => Math.round(document.getElementById('modal').getBoundingClientRect().width));
    await c.close();
    return out;
  };
  const wide = await layout({ width: 1500, height: 950 });
  ok(wide.cols === 4, `at 1500px the rules go four columns (${wide.cols})`);
  ok(wide.fits, 'and the whole panel fits — eighteen rules need the fourth column to do that');
  ok(wide.setup === 470, `while the SETUP dialog stays narrow (${wide.setup}px) — .modal is shared by every dialog`);
  ok(wide.afterW === 470, `and the width does not leak into the next dialog (${wide.afterW}px after Done)`);
  /* WHERE IT GENUINELY DOES NOT FIT, the sticky footer is what keeps the panel usable — asserted by hit-test at a
   * size below the four-column tier, rather than claiming a fit that the rule count has outgrown. */
  const tight = await layout({ width: 1280, height: 800 });
  ok(tight.cols === 2 && !tight.fits, `at 1280px it is two columns and does scroll (${tight.cols} col)`);
  ok(tight.footPinned, '  and the sticky footer stays pinned and clickable there');
  const mid = await layout({ width: 1100, height: 900 });
  ok(mid.cols === 2, `at 1100px it is two columns (${mid.cols})`);
  const narrow = await layout({ width: 900, height: 1000 });
  ok(narrow.cols === 1, `and below the breakpoint it stays a single column (${narrow.cols})`);

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
