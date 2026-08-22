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
  ok(await p.evaluate(()=>{const t=document.getElementById('tutPanel').getBoundingClientRect();
     return t.width>0 && getComputedStyle(document.getElementById('tutPanel')).zIndex==='80';}),'coach panel sits above the modal (z-index 80)');
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
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
