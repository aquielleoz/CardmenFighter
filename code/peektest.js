/* PEEK AT THE TABLE — the review mode, spec agreed with Aj 2026-08-30.
 *
 * PRINCIPLE: peek SHOWS, it never CHANGES. Anything that only reveals information works; anything that alters
 * the game stays dead.
 *
 * Two things make this worth its own suite. First, peek was completely dead for 25 versions (v1.31.36 raised
 * `.overlay` above the hardcoded lifts that peek's own panels used) and NO DOM ASSERTION COULD SEE IT — the
 * controls were present, styled and wired, just buried. Everything here hit-tests or reads computed style.
 * Second, every information viewer routes through the ONE shared `#modal`, which peek hides to show the board;
 * so "open a pile viewer during peek" has to stash the end screen and put it back.
 *
 * Uses `__solo.peek()` — the REAL enterPeek, not a staged class list. That distinction is load-bearing:
 * showModal's peek branch keys off the `peeking` VARIABLE, so a probe that only adds the classes reports the
 * dialog as hidden and looks like a bug in the fix. It cost one wrong diagnosis before the hook existed.
 * Run: node peektest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const errs=[];
  const ctx=await b.newContext({viewport:{width:1280,height:800}});
  const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
  await p.evaluate(()=>{const s=document.getElementById('setPlayers'); if(s){s.value='4'; s.dispatchEvent(new Event('change'));}}); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);

  const enter = ()=>p.evaluate(()=>window.__solo.peek());
  /* Expand the log first: `#saveLogBtn` is `display:none` while `#logWrap.collapsed`, and the log starts
     collapsed at this width — asserting it there measures the collapse, not peek. */
  await p.evaluate(()=>{ const w=document.getElementById('logWrap'), t=document.getElementById('logToggle');
    if(w.classList.contains('collapsed')&&t) t.click(); });
  await wait(300);
  /* CLICKABLE means: not pointer-events:none, and topmost at its own centre. Both halves matter — the action
     row is inert while sitting visually on top, and the header was on top of nothing while fully enabled. */
  const state = ()=>p.evaluate(()=>{
    const hit=(el)=>{ if(!el) return 'absent';
      const rc=el.getBoundingClientRect(); if(rc.width<3||rc.height<3) return 'not rendered';
      if(getComputedStyle(el).pointerEvents==='none') return 'inert';
      const t=document.elementFromPoint(Math.round(rc.left+rc.width/2), Math.round(rc.top+rc.height/2));
      return (t && (el===t || el.contains(t))) ? 'live' : 'blocked'; };
    const g=id=>hit(document.getElementById(id));
    return { peeking:window.__solo.peeking(),
      log:g('logToggle'), save:g('saveLogBtn'), yourNrg:g('youNrgBtn'), yourShuf:g('youShufBtn'),
      specials:g('specialsRefBtn'), help:g('helpBtn'), settings:g('settingsBtn'), sfx:g('sfxBtn'),
      hints:g('hintsBtn'), newBtn:g('newBtn'), peekBar:g('peekBar'),
      oppNrg:hit(document.querySelector('.oppNrgBtn')), oppPanel:hit(document.querySelector('.oppPanel')),
      /* The GROUP is the click target, not the card: `.group .card{pointer-events:none}` by design, so the
         whole stack of a pair reacts as one. Asserting the card reports "inert" on a perfectly working hand. */
      handCard:hit(document.querySelector('#hand .group')),
      fight:g('fightBtn'), pass:g('passBtn'), sort:g('sortBtn'), clear:g('clearBtn'), ctx:g('ctxBtn'),
      modalShown:window.__solo.modalShown(), modalText:(document.getElementById('modal').textContent||'').trim().slice(0,24) };
  });

  ok(await enter(), 'entered peek through the real enterPeek()');
  let s = await state();

  // ---- WHAT PEEKS ----
  const peeks=[['log','the battle log toggle'],['save','⤓ Save'],['yourNrg','your energy pile'],
    ['yourShuf','your shuffle pile'],['specials','🃏 Specials list'],['help','? How to play'],
    ['settings','⚙️ Settings — Aj: "also let\'s you check the rules"'],['sfx','🔊 sound'],['hints','💡 Hints'],
    ['newBtn','🏳 Concede / New Duel'],['peekBar','↩ Back'],['oppNrg',"an opponent's energy pile"],
    ['oppPanel',"an opponent's panel"],['handCard','a card group in your hand']];
  peeks.forEach(([k,label])=>ok(s[k]==='live', `PEEKS: ${label} is clickable [${s[k]}]`));

  // ---- WHAT STAYS DEAD ---- (inert, not merely covered: covering it would also hide the board)
  [['fight','Fight'],['pass','Pass'],['sort','Sort'],['clear','Clear'],['ctx','⚡ Activate']]
    .forEach(([k,label])=>ok(s[k]==='inert', `DEAD: ${label} cannot be pressed [${s[k]}]`));

  // ---- A VIEWER OPENED DURING PEEK MUST BE VISIBLE ----
  await p.evaluate(()=>document.getElementById('youNrgBtn').click()); await wait(250);
  s = await state();
  ok(s.modalShown, 'a pile viewer opened DURING peek is actually VISIBLE'+(s.modalShown?'':'  <-- it populated the shared #modal and stayed hidden'));
  ok(/Energy/i.test(s.modalText), '  → and it is the pile viewer, not the end screen behind it');

  // ---- CLOSING IT FALLS BACK INTO PEEK, END SCREEN INTACT ----
  await p.evaluate(()=>document.getElementById('overlay').click()); await wait(250);
  s = await state();
  ok(s.peeking, 'closing that viewer returns you INTO peek, not out of it');
  ok(!s.modalShown, '  → the end screen is hidden again');
  ok(/END SCREEN/i.test(s.modalText), '  → and it was restored, not overwritten by the viewer');
  ok(s.peekBar==='live', '  → and ↩ Back is still there');

  // ---- ↩ BACK LEAVES PEEK AND RESTORES THE END SCREEN ----
  await p.evaluate(()=>document.getElementById('peekBar').click()); await wait(250);
  s = await state();
  ok(!s.peeking, '↩ Back leaves peek');
  ok(s.modalShown && /END SCREEN/i.test(s.modalText), '  → and the end screen is showing again');

  // ---- CONCEDE / NEW DUEL CLOSES PEEK RATHER THAN ACTING UNDER IT ----
  await enter(); await wait(200);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(400);
  ok(!(await p.evaluate(()=>window.__solo.peeking())), 'New Duel / Concede pressed during peek closes peek first');
  ok(!(await p.evaluate(()=>!!document.getElementById('peekBar'))), '  → and peek is not offered again on the screen it opens');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
