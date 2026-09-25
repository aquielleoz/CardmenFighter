/* The "Custom Decks" tutorial lesson (Advanced #9) — the only lesson whose subject is a SCREEN rather than
 * a play, so it is worth pinning end to end: the hub row, the builder opening over the rigged duel, the coach
 * panel staying above the modal, spotlighting a control INSIDE the modal, both stepper gates (including that
 * one part is not enough), the save gate, completion, and that the deck the player built is really saved.
 * Run: node lessontest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const step=()=>p.evaluate(()=>{const t=document.getElementById('tutPanel');
    return {shown:t.classList.contains('show'), n:(t.querySelector('.tutStep')||{}).textContent||'',
            text:(t.querySelector('.tutText')||{}).textContent||'', wait:(t.querySelector('.tutWait')||{}).textContent||'',
            hasNext:!!t.querySelector('#tutNextBtn')};});
  const next=()=>p.evaluate(()=>{const b=document.getElementById('tutNextBtn'); if(b)b.click();});
  await p.goto(URL); await p.waitForTimeout(700);
  // open Tutorials hub
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>{const b=[].find.call(document.querySelectorAll('button'),x=>/Tutorials/.test(x.textContent)); if(b)b.click();}); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>/Custom Decks/.test(document.body.textContent)),'the Tutorials hub lists "Custom Decks"');
  ok(await p.evaluate(()=>!!document.querySelector('.lessonRow[data-lesson="decks"]')),'it has a lesson row of its own');
  await p.evaluate(()=>document.querySelector('.lessonRow[data-lesson="decks"]').click()); await p.waitForTimeout(1400);
  let s=await step();
  ok(s.shown,'lesson started, coach panel up');
  ok(/1 \/ 6/.test(s.n),'6 steps ('+s.n.replace(/\s+/g,' ')+')');
  ok(/4 parts/.test(s.text),'step 1 explains parts');
  await next(); await p.waitForTimeout(700);
  s=await step();
  ok(await p.evaluate(()=>!!document.querySelector('.deckBuild')),'step 2 opened the deck builder');
  /* ⚠ THIS ASSERTED `zIndex === '80'` AND CALLED IT "sits above the modal" (fixed 2026-09-17, Aj: *"phew
     can't exit out of the custom deck tutorial"*). It pinned a NUMBER where the claim is a RELATIONSHIP,
     and the number stopped meaning what it meant: `#tutPanel` is 80, and `.overlay` was **30** when this
     line was written — genuinely above. v1.31.36 raised the overlay to 100000 to get dialogs over
     `#netroot`, which buried the coach panel and every control on it, and this assertion stayed green
     because 80 is still 80.
     THAT IS THE INCIDENT CLAUDE.md ALREADY RECORDS — *"when you raise a z-index, hit-test every layer
     positioned relative to it, not just the one that prompted the change"* — and the coach panel is the
     layer that was missed. It also breaks the companion rule the same file gives: **no DOM assertion can
     see a stacking bug**, so where visibility is what matters, hit-test it.
     SO HIT-TEST IT. `elementFromPoint` at the panel's own centre answers the question a player asks — can
     I click this — which a computed z-index cannot. */
  const panelHit = await p.evaluate(()=>{
    const t=document.getElementById('tutPanel'); if(!t) return {there:false};
    const r=t.getBoundingClientRect(); if(!(r.width>0)) return {there:true, sized:false};
    const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    const skip=document.getElementById('tutSkipBtn');
    const sr=skip?skip.getBoundingClientRect():null;
    const skipHit=sr?document.elementFromPoint(sr.left+sr.width/2, sr.top+sr.height/2):null;
    return { there:true, sized:true,
             reachable: !!(hit && t.contains(hit)),
             skipReachable: !!(skip && skipHit && (skip===skipHit || skip.contains(skipHit))),
             covering: hit ? (hit.id||hit.className||hit.tagName) : null,
             panelZ:getComputedStyle(t).zIndex,
             overlayZ:getComputedStyle(document.getElementById('overlay')).zIndex };
  });
  /* THE COACH PANEL IS REACHABLE OVER A MODAL — THIS WAS A RATCHET AND THE FIX LANDED (2026-09-25).
     It was pinned in the BROKEN direction: the panel sat under the builder, `Skip ✕` was unclickable, and
     because `tutOpenDeckBuilder`'s continuation re-opens the modal while `TUT.isActive()`, the builder's
     own Cancel could not leave either — so the only exits were finishing the deck or reloading. Aj,
     2026-09-17: *"phew can't exit out of the custom deck tutorial"*.
     IT FAILED FOR THE RIGHT REASON, which is the whole point of writing one that fails both ways: `Skip`
     became reachable, the ratchet went red saying THE FIX LANDED, and these lines are now the positives
     it asked for. `[id: tut-panel-buried-by-modal]` is closed and the `RATCHET:` tag is gone with it.
     ⚠ AND THE OLD COMMENT'S WARNING IS KEPT AS AN ASSERTION, not just honoured: *"do not fix this by
     raising `#tutPanel` alone — the z-index family derives from `--zNetroot` and the peek panels sit at
     +2/+3, so the fix has to hit-test peek as well."* `--zTut` is +5, above the peek panels and the
     dialog opened during peek, and `--zPeekBar` moved to +6 so ↩ Back still outranks everything and peek
     can never become a trap of its own. That ordering is asserted below rather than assumed. */
  ok(panelHit.reachable,
     'the coach panel is ON TOP of the builder — hit-tested  (panel z '+panelHit.panelZ+
     ' vs overlay '+panelHit.overlayZ+', the point hits "'+panelHit.covering+'")');
  ok(panelHit.skipReachable,
     '…so "Skip ✕" can be clicked and the lesson can be LEFT, not only finished or reloaded');
  /* ⚠ RESOLVE THE calc(), DO NOT parseInt IT. `--zTut` is `calc(var(--zNetroot) + 5)`, so
     `getPropertyValue` hands back that literal string and `parseInt` gives NaN — which compares false and
     reported a correct stylesheet as broken on the first run. A throwaway element makes the browser do
     the arithmetic. */
  ok(await p.evaluate(()=>{
       function z(v){ var d=document.createElement('div');
         d.style.cssText='position:fixed;z-index:'+v; document.body.appendChild(d);
         var n=parseInt(getComputedStyle(d).zIndex,10); d.parentNode.removeChild(d); return n; }
       return z('var(--zPeekBar)') > z('var(--zTut)');
     }),
     '…and ↩ Back still outranks the coach panel, so peek cannot become a trap in its place');
  await next(); await p.waitForTimeout(500);
  s=await step();
  ok(/Cleric/.test(s.text) && !s.hasNext,'step 3 is a GATED step asking for 2 Cleric parts');
  ok(await p.evaluate(()=>document.querySelector('.dbRow[data-su="H"] [data-d="1"]').classList.contains('tut-spot')),'the Cleric + button is spotlighted inside the modal');
  await p.evaluate(()=>document.querySelector('.dbRow[data-su="H"] [data-d="1"]').click()); await p.waitForTimeout(250);
  ok(/3 \/ 6/.test((await step()).n),'one Cleric part is not enough — the gate holds on step 3');
  await p.evaluate(()=>document.querySelector('.dbRow[data-su="H"] [data-d="1"]').click()); await p.waitForTimeout(400);
  ok(/4 \/ 6/.test((await step()).n),'two Cleric parts advanced to step 4');
  await p.evaluate(()=>{document.querySelector('.dbRow[data-su="D"] [data-d="1"]').click();}); await p.waitForTimeout(200);
  await p.evaluate(()=>{document.querySelector('.dbRow[data-su="C"] [data-d="1"]').click();}); await p.waitForTimeout(400);
  ok(/5 \/ 6/.test((await step()).n),'spending all 4 parts advanced to step 5');
  ok(/class of your own/.test((await step()).text),'step 5 tells you to name it like a class');
  await p.evaluate(()=>{const n=document.getElementById('dbName'); n.value='Battle Priest'; n.dispatchEvent(new Event('input'));});
  await p.evaluate(()=>document.getElementById('dbSave').click()); await p.waitForTimeout(600);
  ok(/6 \/ 6/.test((await step()).n),'saving advanced to the final step');
  ok(await p.evaluate(()=>{const r=[].map.call(document.querySelectorAll('.dbSavedRow .dbSavedName'),x=>x.textContent);
     return r.indexOf('Battle Priest')>=0;}),'the final step shows the deck they just built in "Your saved decks"');
  await next(); await p.waitForTimeout(700);
  ok(await p.evaluate(()=>/Lesson complete/.test(document.body.textContent)),'the lesson completes');
  ok(await p.evaluate(()=>{const a=JSON.parse(localStorage.getItem('cmf_decks_v1')||'[]'); return a.length===1 && a[0].name==='Battle Priest' && a[0].parts.H===2;}),'the deck the player built in the lesson is really saved');
  ok(await p.evaluate(()=>localStorage.getItem('cmf_lesson_decks_v1')==='1'),'the lesson is marked done');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
