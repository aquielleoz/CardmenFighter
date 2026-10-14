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

  /* ═══ DRAG-AND-STACK STEP 3: THE BOARD'S STACK IS CARDS ═══
     The Respond? box keeps these rows (step 4 changes it); the board's column shows the CARD of each object,
     newest on top, captioned with the same phrase. A trigger has no card, so it gets a tile. */
  const cards=await p.evaluate(()=>{ const st=window.__solo.st(), E=window.CardmenEngine;
    const find=k=>{ for(const s of ['D','H','C','S']) for(let r=3;r<=14;r++){ const e=E.effectOf({rank:r,suit:s}); if(e&&e.kind===k) return {eff:e, card:{rank:r,suit:s,id:'k'+r+s}}; } return null; };
    st.players[0].equipment=[{id:'eqMine',name:'Holy Bow',counters:3}];
    const strip=find('removeEquip'), ctr=find('counter');
    st.stack=[{oid:'t1', kind:'effect', p:0, name:'Holy Bow', trig:'upkeep'},
              {oid:'s1', kind:'effect', p:1, card:strip.card, eff:strip.eff, opts:{target:'eqMine'}},
              {oid:'s2', kind:'effect', p:0, card:ctr.card, eff:ctr.eff, opts:{}}];
    window.__solo.render();
    const boxes=[...document.querySelectorAll('#stackView .stkCard')];
    return { order:boxes.map(b=>b.getAttribute('data-oid')), top:boxes.map(b=>b.classList.contains('top')),
             ids:boxes.map(b=>{ const c=b.querySelector('.card'); return c?c.dataset.id:(b.querySelector('.stkTrig')?'TRIG':null); }),
             caps:boxes.map(b=>((b.querySelector('.stkCap')||{}).textContent||'').trim()), want:[ctr.card.id, strip.card.id] }; });
  ok(cards.order.join()==='s2,s1,t1' && cards.top.join()==='true,false,false',
     'THE STACK SHOWS AS CARDS, NEWEST ON TOP, the top one marked  ['+cards.order.join(' > ')+']');
  ok(cards.ids[0]===cards.want[0] && cards.ids[1]===cards.want[1] && cards.ids[2]==='TRIG',
     '  …each object showing ITS card, and the upkeep trigger a tile  ['+cards.ids.join(', ')+']');
  ok(/resolves next/.test(cards.caps[0]) && /→\s*your Holy Bow/.test(cards.caps[1]) && /upkeep counter/.test(cards.caps[2]),
     '  …captioned with the row\'s own phrase: who, what, aimed at what, which resolves next  ['+cards.caps.map(c=>c.slice(0,40)).join(' | ')+']');

  /* A NEW OBJECT FLIES IN FROM WHOEVER CAST IT. A ghost in the page's top layer carries it (the column clips its
     own overflow) and the real card waits hidden until it lands. Both directions: the ghost exists during the
     flight, and nothing is left behind after it — and a re-render with nothing new on the stack flies nothing. */
  await wait(1000);   // let the previous leg's own arrivals land first
  const fly=await p.evaluate(async()=>{ const st=window.__solo.st(), E=window.CardmenEngine;
    const find=k=>{ for(const s of ['D','H','C','S']) for(let r=3;r<=14;r++){ const e=E.effectOf({rank:r,suit:s}); if(e&&e.kind===k) return {eff:e, card:{rank:r,suit:s,id:'k'+r+s}}; } return null; };
    const lk=find('lockout'); st.stack.push({oid:'s3', kind:'effect', p:1, card:lk.card, eff:lk.eff, opts:{target:0}});
    window.__solo.render();
    const during={ ghosts:document.querySelectorAll('.stkGhost[data-oid="s3"]').length, others:document.querySelectorAll('.stkGhost:not([data-oid="s3"])').length, inbound:!!document.querySelector('#stackView .stkCard[data-oid="s3"].inbound') };
    await new Promise(r=>setTimeout(r,1100));
    const after={ ghosts:document.querySelectorAll('.stkGhost').length, inbound:!!document.querySelector('#stackView .inbound') };
    window.__solo.render();
    const again=document.querySelectorAll('.stkGhost').length;
    return { during, after, again }; });
  ok(fly.during.ghosts===1 && fly.during.others===0 && fly.during.inbound, 'A NEW CAST FLIES INTO THE STACK — one ghost in the air, the real card waiting  ['+JSON.stringify(fly.during)+']');
  ok(fly.after.ghosts===0 && !fly.after.inbound && fly.again===0, '  …and it lands: no ghost left, the card shown, and a re-render flies nothing  ['+JSON.stringify(fly.after)+', again '+fly.again+']');

  /* THE COLUMN STAYS ABOVE THE WAITING DIM. With another seat on priority the play area dims under "<name> is
     deciding…"; a HIT TEST, not a class check, because only a hit test can see a stacking bug (CLAUDE.md). */
  const dim=await p.evaluate(()=>{ const st=window.__solo.st(); st.respondFor=1; st.pending=true; window.__solo.render();
    const fx=document.getElementById('roundfx'), c=document.querySelector('#stackView .stkCard .card'), r=c.getBoundingClientRect();
    const hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
    const out={ dimmed:/trimwait/.test(fx.className), onColumn:!!(hit && hit.closest && hit.closest('#castZone')), hit:hit?(hit.id||hit.className||hit.tagName):'none' };
    st.respondFor=null; st.pending=null; window.__solo.render(); return out; });
  ok(dim.dimmed && dim.onColumn, 'WHILE ANOTHER SEAT DECIDES, THE STACK IS ABOVE THE DIM — a hit test on a stack card lands on the column  ['+JSON.stringify(dim)+']');

  await p.evaluate(()=>{ window.__solo.st().stack=[]; window.__solo.render(); });
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
