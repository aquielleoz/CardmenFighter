/* 🔍 View card reader gating (tight screens). The button only exists in its ≤720w/≤800h window, and it
 * must be DISABLED whenever there is no selected card — otherwise it opens the full-screen reader on nothing
 * but its own "Tap a card in your hand first" placeholder (reported by Aj against v1.27.0). Note that Clear
 * deselects for play but deliberately leaves the last card described, so the button correctly stays enabled
 * there. Run: node viewtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:390,height:780}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await p.waitForTimeout(1100);
  const st=()=>p.evaluate(()=>{const b=document.getElementById('viewCardBtn');
    return {shown:!!(b&&b.offsetParent!==null), disabled:b&&b.disabled, title:b&&b.title,
            readerOpen:document.getElementById('cardFull').classList.contains('show')};});
  let s=await st();
  ok(s.shown,'the 🔍 View button is visible at 390×780 (its ≤720w/≤800h window)');
  ok(s.disabled===true,'it starts DISABLED with nothing selected');
  ok(/Tap a card/.test(s.title),'its tooltip says to tap a card first');
  await p.evaluate(()=>document.getElementById('viewCardBtn').click()); await p.waitForTimeout(250);
  ok((await st()).readerOpen===false,'clicking it while disabled does NOT open the empty reader');
  await p.evaluate(()=>document.querySelector('#hand .card').click()); await p.waitForTimeout(300);
  s=await st();
  ok(s.disabled===false,'selecting a card ENABLES it');
  await p.evaluate(()=>document.getElementById('viewCardBtn').click()); await p.waitForTimeout(300);
  s=await st();
  ok(s.readerOpen===true,'it now opens the reader');
  ok(await p.evaluate(()=>!document.querySelector('#cardFull .cfEmpty')),'the reader shows a real card, not the placeholder');
  await p.evaluate(()=>document.getElementById('cardFullClose').click()); await p.waitForTimeout(250);
  // Clear deselects for play but deliberately leaves the last card described, so the reader still has
  // something real to show — the button stays enabled and that is correct, not a leak.
  await p.evaluate(()=>{const c=document.getElementById('clearBtn'); if(c)c.click();}); await p.waitForTimeout(350);
  ok((await st()).disabled===false,'after Clear the last-read card is still readable (reader is not empty)');
  await p.evaluate(()=>document.getElementById('viewCardBtn').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!document.querySelector('#cardFull .cfEmpty')),'and it still opens on a real card, never the placeholder');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
