/* THE STACK ROW NAMES WHAT AN EFFECT IS AIMED AT, IN THE REAL PAGE (stack-row-omits-target, v1.32.5).
 *
 * Aj, with a screenshot of the Respond? window: *"what is the strip targeting?"* — the row read
 * `Flonne ▸ Forceful Strip · 7♦ (resolves next)` and never named the Equipment, which is the whole decision
 * about spending Annoint. `test.js` asserts `E.stackTargetOf` per kind; this asserts the ROW, in the page,
 * reader-relative. The board's #stackView and the Respond? modal's "On the stack" box are the same function
 * (`stackRowsHTML`), so reading one reads both.
 *
 * BOTH WAYS ON ONE BOARD: two pieces of Equipment on one rival, the strip aimed at one — the row must name it
 * AND NOT the other. Plus: your own piece reads "your …", and an untargeted row is unchanged (the row is shared).
 *
 * Run: node stackrowtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);
  await p.evaluate(()=>{ window.__solo.setName(1,'Flonne'); window.__solo.setName(2,'Tank'); });

  // stage the stack directly and read the rows — the cast path is not what is under test, the row is
  const rowsFor=(spec)=>p.evaluate((spec)=>{ const st=window.__solo.st(), E=window.CardmenEngine;
    const find=k=>{ for(const s of ['D','H','C','S']) for(let r=3;r<=14;r++){ const e=E.effectOf({rank:r,suit:s}); if(e&&e.kind===k) return {eff:e, card:{rank:r,suit:s,id:'k'+r+s}}; } return null; };
    st.players[2].equipment=[{id:'eqA',name:'Caltrops',counters:3},{id:'eqB',name:'Spiked Armor',counters:3}];
    st.players[0].equipment=[{id:'eqMine',name:'Holy Bow',counters:3}];
    const x=find(spec.kind);
    st.stack=[{oid:'s1', kind:'effect', p:spec.p, card:x.card, eff:x.eff, opts:spec.opts||{}}];
    window.__solo.render();
    const el=document.getElementById('stackView');
    return { text:(el&&el.textContent)||'', shown:!!(el && el.style.display!=='none'), name:x.eff.name };
  }, spec);

  const r1=await rowsFor({kind:'removeEquip', p:1, opts:{target:'eqB'}});
  ok(r1.shown && r1.text.indexOf(r1.name)>=0, 'STAGED: the strip is on the stack and its row is showing ("'+r1.text.trim()+'")');
  ok(/→\s*Tank’s Spiked Armor/.test(r1.text), 'the row names the target: "→ Tank’s Spiked Armor"');
  ok(!/Caltrops/.test(r1.text), '…and NOT the other piece on the same seat (both ways, one board)');

  const r2=await rowsFor({kind:'removeEquip', p:1, opts:{target:'eqMine'}});
  ok(/→\s*your Holy Bow/.test(r2.text), 'aimed at YOUR piece it reads "→ your Holy Bow" ("'+r2.text.trim()+'")');

  const r3=await rowsFor({kind:'lockout', p:1, opts:{target:0}});
  ok(/→\s*You\b/.test(r3.text), 'a seat-targeted effect aimed at you reads "→ You" ("'+r3.text.trim()+'")');

  const r4=await rowsFor({kind:'draw', p:1, opts:{}});
  ok(r4.shown && !/→/.test(r4.text), 'an UNTARGETED effect renders exactly as before — no arrow ("'+r4.text.trim()+'")');

  await p.evaluate(()=>{ window.__solo.st().stack=[]; window.__solo.render(); });
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
