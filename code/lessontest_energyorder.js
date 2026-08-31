/* The "Energy Order" tutorial lesson (Advanced #10) — the second screen-subject lesson, teaching the energy
 * queue through the ⚡ pile viewer. Pins: the hub row, the rig seeding a readable pile (5 energy / 2 shuffle),
 * the viewer opening from a step, the gate on a real promote, and that the copy actually covers the three
 * things a player can get wrong — the coloured-cost caveat, that the shuffle pile is random and unorderable,
 * and that the log is public. Run: node lessontest_energy.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const step=()=>p.evaluate(()=>{const t=document.getElementById('tutPanel');
    return {n:(t.querySelector('.tutStep')||{}).textContent||'', text:(t.querySelector('.tutText')||{}).textContent||'', hasNext:!!t.querySelector('#tutNextBtn')};});
  const next=()=>p.evaluate(()=>{const b=document.getElementById('tutNextBtn'); if(b)b.click();});
  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>{const b=[].find.call(document.querySelectorAll('button'),x=>/Tutorials/.test(x.textContent)); if(b)b.click();}); await p.waitForTimeout(450);
  ok(await p.evaluate(()=>!!document.querySelector('.lessonRow[data-lesson="energyorder"]')),'the hub lists an "Energy Order" lesson');
  await p.evaluate(()=>document.querySelector('.lessonRow[data-lesson="energyorder"]').click()); await p.waitForTimeout(1400);
  ok(/1 \/ 6/.test((await step()).n),'lesson started, 6 steps');
  ok(await p.evaluate(()=>window.__solo.st().players[0].energy.length===5),'the rig seeded a 5-card energy pile');
  ok(await p.evaluate(()=>window.__solo.st().players[0].shuffle.length===2),'…and a 2-card shuffle pile');
  await next(); await p.waitForTimeout(800);
  ok(await p.evaluate(()=>!!document.querySelector('.pileList')),'step 2 opened the energy pile viewer');
  await next(); await p.waitForTimeout(400);
  ok(!(await step()).hasNext,'step 3 is gated on an actual promote');
  await p.evaluate(()=>{ document.querySelectorAll('.pileRow')[3].click(); }); await p.waitForTimeout(250);
  await p.evaluate(()=>document.getElementById('pvPromote').click()); await p.waitForTimeout(600);
  ok(/4 \/ 6/.test((await step()).n),'promoting advanced the lesson');
  ok(await p.evaluate(()=>window.__solo.st().players[0].energy[0].id==='6C#tut'),'the promote really happened');
  ok(/first ♥|colour/.test((await step()).text),'step 4 explains the coloured-cost caveat');
  await next(); await p.waitForTimeout(400);
  ok(/shuffled at random/.test((await step()).text),'step 5 explains the shuffle pile is random and unorderable');
  await next(); await p.waitForTimeout(400);
  ok(/opponents see it/.test((await step()).text),'step 6 says the log is public');
  await next(); await p.waitForTimeout(700);
  ok(await p.evaluate(()=>/Lesson complete/.test(document.body.textContent)),'the lesson completes');
  ok(await p.evaluate(()=>localStorage.getItem('cmf_lesson_energyorder_v1')==='1'),'…and is marked done');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
