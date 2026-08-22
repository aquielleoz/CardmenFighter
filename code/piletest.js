/* Energy / Shuffle pile viewers + ⤒ Promote to top (ENERGY-REORDER-DESIGN.md).
 * Covers: ⚡ opens the ordered energy pile, the "spent next" and "first <suit>" tags (decision 3's labelling
 * of the colored-pip caveat), real card thumbnails, tap → 🔍 View + ⤒ Promote, that View shows the full
 * description-box text and ← Back keeps the selection, that a promote moves the card to the front AND writes a
 * public log line, that a second promote pushes the first down (stack, not queue), ← / → between the two views,
 * that the shuffle pile is read-only with no promote button, and that the energy pile is read-only off-turn.
 * Run: node piletest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await p.waitForTimeout(1100);
  // give ourselves an energy pile
  await p.evaluate(()=>{ const st=window.__solo.st(); const mk=(r,s)=>({rank:r,suit:s,id:r+s+'#x'});
    st.players[0].energy=[mk(3,'H'),mk(4,'S'),mk(5,'H'),mk(6,'C'),mk(7,'D')];
    st.players[0].shuffle=[mk(9,'S'),mk(2,'D')]; window.__solo.render(); });
  await p.waitForTimeout(300);
  await p.evaluate(()=>document.getElementById('youNrgBtn').click()); await p.waitForTimeout(350);
  ok(await p.evaluate(()=>!!document.querySelector('.pileList')),'⚡ opens the energy pile viewer');
  ok(await p.evaluate(()=>document.querySelectorAll('.pileRow').length===5),'it lists all 5 energy cards');
  ok(await p.evaluate(()=>/3♥/.test(document.querySelector('.pileRow .pvName').textContent)),'in pile order, 3♥ first');
  ok(await p.evaluate(()=>!!document.querySelector('.pileRow:first-child .pvTag.next')),'position 1 is tagged "spent next"');
  const tags=await p.evaluate(()=>[].map.call(document.querySelectorAll('.pileRow'),r=>({n:r.querySelector('.pvName').textContent.trim().split(' ')[0], pip:!!r.querySelector('.pvTag.pip')})));
  ok(tags.filter(t=>t.pip).length===4,'exactly one "first <suit>" tag per suit present ('+tags.filter(t=>t.pip).length+')');
  ok(await p.evaluate(()=>!!document.querySelector('.pileRow .card.mini')),'each row shows a real card thumbnail');
  // select → context row
  await p.evaluate(()=>document.querySelectorAll('.pileRow')[4].click()); await p.waitForTimeout(250);
  ok(await p.evaluate(()=>!!document.getElementById('pvView') && !!document.getElementById('pvPromote')),'tapping a card offers 🔍 View + ⤒ Promote to top');
  await p.evaluate(()=>document.getElementById('pvView').click()); await p.waitForTimeout(250);
  ok(await p.evaluate(()=>!!document.querySelector('.pvRead')),'🔍 View shows the card text');
  ok(await p.evaluate(()=>/Gather Energy|Energy|effect|Technique/i.test(document.querySelector('.pvRead').textContent)),'…the full description-box text');
  await p.evaluate(()=>document.getElementById('pvBack').click()); await p.waitForTimeout(250);
  // Back keeps the card selected (tapping the same row again would DESELECT it), so promote straight away.
  ok(await p.evaluate(()=>!!document.getElementById('pvPromote')),'← Back keeps the card selected');
  await p.evaluate(()=>document.getElementById('pvPromote').click()); await p.waitForTimeout(400);
  const order=await p.evaluate(()=>window.__solo.st().players[0].energy.map(c=>c.id));
  ok(order[0]==='7D#x','⤒ Promote moves it to the front ('+order.join(',')+')');
  ok(await p.evaluate(()=>/moved .*7♦.* to the front/.test(document.getElementById('log').textContent)),'a PUBLIC log line records the move');
  // second promote = stack push
  await p.evaluate(()=>{ const rows=document.querySelectorAll('.pileRow'); rows[rows.length-1].click(); }); await p.waitForTimeout(200);
  await p.evaluate(()=>document.getElementById('pvPromote').click()); await p.waitForTimeout(400);
  const o2=await p.evaluate(()=>window.__solo.st().players[0].energy.map(c=>c.id));
  ok(o2[0]!=='7D#x' && o2[1]==='7D#x','a second promote takes the top and pushes the first down ('+o2.join(',')+')');
  // ← / → to the shuffle pile
  await p.evaluate(()=>document.getElementById('pvNext').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Shuffle pile/.test(document.querySelector('#modal h2').textContent)),'→ switches to the shuffle pile');
  ok(await p.evaluate(()=>document.querySelectorAll('.pileRow.ro').length===2),'the shuffle pile is read-only (2 cards)');
  await p.evaluate(()=>document.querySelectorAll('.pileRow')[0].click()); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!document.getElementById('pvPromote')),'…and offers no promote button');
  ok(await p.evaluate(()=>/shuffled at random/.test(document.querySelector('.pileHint').textContent)),'…and says the reshuffle is random');
  await p.evaluate(()=>document.getElementById('pvPrev').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Energy pile/.test(document.querySelector('#modal h2').textContent)),'← switches back to energy');
  // off-turn: read-only
  await p.evaluate(()=>{ const st=window.__solo.st(); st.turn=1; window.__solo.render(); }); await p.waitForTimeout(200);
  await p.evaluate(()=>document.getElementById('pvDone').click()); await p.waitForTimeout(200);
  await p.evaluate(()=>document.getElementById('youNrgBtn').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>document.querySelectorAll('.pileRow.ro').length>0),'off-turn the energy pile is read-only');
  ok(await p.evaluate(()=>/on <b>your own turn<\/b>/.test(document.querySelector('.pileHint').innerHTML)),'…and says so');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
