/* Energy / Shuffle / Exile pile viewers + ⤒ Promote to top (ENERGY-REORDER-DESIGN.md; the Exile since v1.33.11).
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
  // Aj hit this: .modal .ghostBtn sets width:100%, so 🔍 View claimed the whole row, squeezed ⤒ Promote below
  // its text width, and white-space:nowrap spilled the label outside the gold button. Measure, don't eyeball.
  const fits=await p.evaluate(()=>['pvView','pvPromote','pvDone'].every(id=>{ const b=document.getElementById(id);
    return !b || b.scrollWidth <= Math.ceil(b.getBoundingClientRect().width)+1; }));
  ok(fits,'neither context button overflows its own box (no text bleeding past the button)');
  ok(await p.evaluate(()=>{ const v=document.getElementById('pvView'), pr=document.getElementById('pvPromote');
     return v.getBoundingClientRect().width < pr.getBoundingClientRect().width; }),'🔍 View sizes to its content rather than hogging the row');
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
  // ---- an opponent's pile is viewable, but VIEW ONLY (Aj: energy is open information) ----
  await p.evaluate(()=>{ const d=document.getElementById('pvDone'); if(d)d.click(); }); await p.waitForTimeout(200);
  await p.evaluate(()=>{ const st=window.__solo.st(); const mk=(r,s)=>({rank:r,suit:s,id:r+s+'#r'});
    st.players[1].energy=[mk(8,'D'),mk(9,'C'),mk(2,'S')]; st.turn=0; window.__solo.render(); }); await p.waitForTimeout(250);
  await p.evaluate(()=>document.getElementById('rivalNrgBtn').click()); await p.waitForTimeout(400);
  ok(await p.evaluate(()=>/Energy pile/.test(document.querySelector('#modal h2').textContent)),'the Rival\'s ⚡ opens their energy pile');
  ok(await p.evaluate(()=>document.querySelectorAll('.pileRow').length===3),'…showing all 3 of THEIR cards');
  ok(await p.evaluate(()=>/8♦/.test(document.querySelector('.pileRow .pvName').textContent)),'…in their order, 8♦ spent next');
  ok(await p.evaluate(()=>document.querySelectorAll('.pileRow.ro').length===3),'…and every row is read-only');
  ok(await p.evaluate(()=>/open information/.test(document.querySelector('.pileHint').textContent)),'…with a hint saying energy is open information');
  await p.evaluate(()=>document.querySelectorAll('.pileRow')[0].click()); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!document.getElementById('pvPromote')),'…and no promote button on someone else\'s pile');
  ok(await p.evaluate(()=>window.__solo.st().players[1].energy[0].id==='8D#r'),'…their pile is untouched');

  /* ---- THE EXILE (v1.33.11): the pile gone for good gets its own button, and everyone's is open ----
     Aj, 2026-10-12: a SEPARATE button, and every seat's Exile viewable — "so were decks actually getting thinner
     without me noticing?" was the report, and the one pile that only grows was the one nobody could open.
     Staged with a used Technique and a destroyed Equipment, the two things the Exile holds. */
  await p.evaluate(()=>{ const d=document.getElementById('pvDone'); if(d)d.click(); }); await p.waitForTimeout(200);
  await p.evaluate(()=>{ const st=window.__solo.st(); const mk=(r,s,t)=>({rank:r,suit:s,id:r+s+t});
    st.players[0].removed=[mk(5,'S','#ex'),mk(8,'H','#ex')]; st.players[1].removed=[mk(9,'D','#rx')]; st.turn=0; window.__solo.render(); }); await p.waitForTimeout(250);
  ok(await p.evaluate(()=>(document.getElementById('youEx')||{}).textContent==='2'),'your bar carries a ⊘ Exile count (2)');
  await p.evaluate(()=>document.getElementById('youExBtn').click()); await p.waitForTimeout(350);
  ok(await p.evaluate(()=>/Exile/.test(document.querySelector('#modal h2').textContent)),'⊘ opens your Exile');
  ok(await p.evaluate(()=>document.querySelectorAll('.pileRow').length===2 && document.querySelectorAll('.pileRow.ro').length===2),'…listing both exiled cards, read-only');
  ok(await p.evaluate(()=>/for good/.test(document.querySelector('.pileHint').textContent) && /Hippolyta/.test(document.querySelector('.pileHint').textContent)),'…with a hint that they are gone for good, and the one way back');
  await p.evaluate(()=>document.querySelectorAll('.pileRow')[0].click()); await p.waitForTimeout(200);
  ok(await p.evaluate(()=>!document.getElementById('pvPromote')),'…and no promote button');
  /* THE RING, both ways from the Exile — energy is spent INTO the Shuffle Pile, the Exile is where nothing returns */
  await p.evaluate(()=>document.getElementById('pvPrev').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Shuffle pile/.test(document.querySelector('#modal h2').textContent)),'← from the Exile goes to the shuffle pile');
  await p.evaluate(()=>document.getElementById('pvNext').click()); await p.waitForTimeout(300);
  await p.evaluate(()=>document.getElementById('pvNext').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>/Energy pile/.test(document.querySelector('#modal h2').textContent)),'→ from the Exile wraps round to the energy pile');
  await p.evaluate(()=>document.getElementById('pvDone').click()); await p.waitForTimeout(200);
  await p.evaluate(()=>document.getElementById('rivalExBtn').click()); await p.waitForTimeout(350);
  ok(await p.evaluate(()=>/Exile/.test(document.querySelector('#modal h2').textContent) && document.querySelectorAll('.pileRow').length===1 && /9♦/.test(document.querySelector('.pileRow .pvName').textContent)),'the Rival\'s ⊘ opens THEIR Exile (9♦)');
  ok(await p.evaluate(()=>/view only/.test(document.querySelector('.pileHint').textContent)),'…marked view only');
  await p.evaluate(()=>{ const d=document.getElementById('pvDone'); if(d)d.click(); }); await p.waitForTimeout(200);

  /* AT 3-6 PLAYERS the opponent panels carry it too — the panel is the only place an opponent's piles live there */
  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await p.waitForTimeout(350);
  await p.evaluate(()=>{ const b=document.getElementById('goFirstBtn'); if(b)b.click(); }); await p.waitForTimeout(1200);
  ok(await p.evaluate(()=>!!(window.__solo && window.__solo.st() && window.__solo.st().numPlayers===3)),'STAGED: a 3-player game');
  await p.evaluate(()=>{ const st=window.__solo.st(); st.players[2].removed=[{rank:4,suit:'C',id:'4C#p2'},{rank:6,suit:'S',id:'6S#p2'},{rank:3,suit:'H',id:'3H#p2'}]; window.__solo.render(); }); await p.waitForTimeout(300);
  const ob=await p.evaluate(()=>{ const b=document.querySelector('.oppPanel[data-seat="2"] .oppExBtn'); return b?b.textContent.trim():null; });
  ok(ob==='⊘3','the seat-2 opponent panel carries a ⊘ Exile button with its count ('+ob+')');
  await p.evaluate(()=>document.querySelector('.oppPanel[data-seat="2"] .oppExBtn').click()); await p.waitForTimeout(350);
  ok(await p.evaluate(()=>/Exile/.test(document.querySelector('#modal h2').textContent) && document.querySelectorAll('.pileRow').length===3),'…which opens that seat\'s Exile (3 cards)');
  ok(await p.evaluate(()=>!(document.querySelector('.oppPanel[data-seat="2"] .oppZones')||{className:''}).className.match(/\bopen\b/)),'…and the click did not also open the panel\'s zones behind it');

  /* ON A PORTRAIT PHONE YOUR ⊘ IS BEHIND THE 🂠 TAP (phone-declutter-rest; Aj, 2026-10-12: *"behind the tap with the
     other counts"*). It replaced the narrow-phone exception this block used to pin — your ⊘ hidden under 340px —
     so the claim moved with it: hidden on the bar at EVERY portrait width, shown and working once the sheet is
     open. The RIVAL's bar was not part of the declutter, so its exception stands, still pinned both ways:
     hidden at 327 (no room), on screen at 390. `phonetest` carries the rest of the declutter. */
  async function narrow(w,h){
    const q=await (await b.newContext({viewport:{width:w,height:h}})).newPage(); q.on('pageerror',e=>errs.push(e.message));
    await q.goto(URL); await q.waitForTimeout(700);
    await q.evaluate(()=>document.getElementById('newBtn').click()); await q.waitForTimeout(350);
    await q.evaluate(()=>document.getElementById('goFirstBtn').click()); await q.waitForTimeout(1100);
    return q;
  }
  for(const [w,h,rivalShown] of [[327,660,false],[390,780,true]]){
    const q=await narrow(w,h);
    ok(await q.evaluate(()=>document.getElementById('youExBtn').offsetParent===null && !!document.getElementById('pilesBtn') && document.getElementById('pilesBtn').offsetParent!==null),
       `at ${w}px your ⊘ is off the bar, behind the 🂠 button`);
    await q.evaluate(()=>{ const x=document.getElementById('pilesBtn'); if(x) x.click(); }); await q.waitForTimeout(250);
    ok(await q.evaluate(()=>document.getElementById('youExBtn').offsetParent!==null), `  → and the 🂠 tap shows it`);
    await q.evaluate(()=>document.getElementById('youExBtn').click()); await q.waitForTimeout(350);
    ok(await q.evaluate(()=>/Exile/.test((document.querySelector('#modal h2')||{}).textContent||'')), `  → which opens the Exile from inside the sheet`);
    ok(await q.evaluate(()=>document.getElementById('rivalExBtn').offsetParent!==null)===rivalShown,
       `  → while the rival's ⊘ is ${rivalShown?'on screen':'hidden — its bar has no room under 340px'}`);
    await q.close();
  }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
