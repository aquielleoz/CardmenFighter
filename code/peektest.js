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

  /* ---- THE REAL END SCREEN, WHICH IS THE ONE THAT MATTERS (v1.31.103) ----
   * Everything above ran against `__solo.peek()`'s staged `<h2>END SCREEN</h2>` — a bare heading with no
   * buttons, so it could not see either bug Aj hit on his phone. Concede to get the REAL screen, whose buttons
   * are wired with addEventListener AFTER showModal, and drive the whole round trip through it. */
  await p.evaluate(()=>document.getElementById('confirmCon').click()); await wait(900);
  const g=id=>p.evaluate(i=>{ const el=document.getElementById(i); if(!el) return 'absent';
    const rc=el.getBoundingClientRect(); if(rc.width<3||rc.height<3) return 'not rendered';
    if(getComputedStyle(el).pointerEvents==='none') return 'inert';
    const t=document.elementFromPoint(Math.round(rc.left+rc.width/2), Math.round(rc.top+rc.height/2));
    return (t && (el===t || el.contains(t))) ? 'live' : 'blocked'; }, id);
  ok(await p.evaluate(()=>!!document.getElementById('reviewBtn')), 'conceding reaches the REAL end screen');
  await p.evaluate(()=>document.getElementById('reviewBtn').click()); await wait(300);
  ok(await p.evaluate(()=>window.__solo.peeking()), '  → 👁 Review the board & log enters peek');

  /* PHONE SIZE FOR THIS ONE, because that is where the symptom lives: at 1280x800 the desktop layout leaves a
     centred dialog clear of the lifted panels whichever build you are on. Aj's phone is 390 wide. */
  await p.setViewportSize({width:390,height:780}); await wait(400);
  /* A SHORT DIALOG CLEARS THE LIFTED PANELS BY LUCK — measured: with a nearly empty pile the modal spans
     y253-526 on this phone and nothing covers its Done button on the BROKEN build, so that hit-test proves
     nothing. Aj's pile held 17 cards. Stage a real one so the dialog is full height, the way his was. */
  await p.evaluate(()=>{ const st=window.__solo.st(), me=st.players[0];
    me.energy = me.energy.concat(me.deck.splice(0, 18)); });
  await p.evaluate(()=>document.getElementById('youNrgBtn').click()); await wait(350);
  /* THE STACKING BUG. The peek lifts put the header, hand, log and player panels above `--zOverlay`; a viewer
     those panels LAUNCH then opened underneath them. A DOM assertion cannot see this — the viewer is present,
     populated and wired — so walk the dialog's centre line and require the dialog itself to answer. */
  const covered = await p.evaluate(()=>{ const m=document.querySelector('#overlay .modal'), r=m.getBoundingClientRect();
    const cx=Math.round(r.left+r.width/2), out=[];
    [['top',r.top+8],['middle',r.top+r.height/2],['bottom',r.bottom-8]].forEach(([where,y])=>{
      const t=document.elementFromPoint(cx, Math.round(y));
      if(!(t && (m===t || m.contains(t)))) out.push(where+':'+(t?(t.id||t.className||t.tagName):'nothing')); });
    return out; });
  ok(covered.length===0, 'a full-height viewer opened during peek is ON TOP down its whole height'+
     (covered.length?'  <-- covered at '+covered.join(', '):''));
  ok(await p.evaluate(()=>{ const m=document.querySelector('#overlay .modal'), r=m.getBoundingClientRect();
       return r.top>=0 && r.bottom<=innerHeight+1; }),
     '  → and making room for the pill did not push the dialog off the screen');
  const zs = await p.evaluate(()=>{ const n=el=>parseInt(getComputedStyle(el).zIndex,10)||0;
    return { ov:n(document.getElementById('overlay')), hdr:n(document.querySelector('header')),
             hand:n(document.getElementById('handWrap')), bar:n(document.getElementById('peekBar')) }; });
  ok(zs.ov>zs.hdr && zs.ov>zs.hand, `  → and it outranks the lifted panels (dialog ${zs.ov} > header ${zs.hdr}, hand ${zs.hand})`);
  ok(zs.bar>zs.ov, `  → while ↩ Back still outranks IT, so peek is never a trap (bar ${zs.bar})`);
  ok(await g('peekBar')==='live', '  → and ↩ Back is genuinely clickable over the dialog');

  /* THE DEAD-LISTENER BUG. Restoring the stashed screen with innerHTML rebuilt the nodes and dropped every
     handler, so the end screen came back looking perfect and doing nothing. Assert BEHAVIOUR: press the
     restored button and require it to act. Existence passes on the broken build. */
  await p.evaluate(()=>document.getElementById('pvDone').click()); await wait(300);
  ok(await p.evaluate(()=>window.__solo.peeking()), 'Done on the viewer falls back INTO peek');
  await p.evaluate(()=>document.getElementById('peekBar').click()); await wait(300);
  ok(await p.evaluate(()=>!window.__solo.peeking() && !!document.getElementById('againBtn')),
     '  → ↩ Back restores the real end screen');
  await p.evaluate(()=>document.getElementById('reviewBtn').click()); await wait(300);
  ok(await p.evaluate(()=>window.__solo.peeking()),
     '  → and its buttons STILL WORK — the restored nodes kept their listeners');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
