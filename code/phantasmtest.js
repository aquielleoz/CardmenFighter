/* PHANTASMAL ILLUSION, in the real built page (v1.31.6). The card copies the current play at its BASE values;
 * your boosts and Equipment then apply, Odysseus conjures it at +1, and you MAY swap one card in. A bare copy
 * ties, and ties never win — so at least one of the three has to be there.
 * The swap used to be MANDATORY in all three layers, which is why the card needed a straight or full house on
 * the pile to do anything (one swap cannot raise a matched set) and was replaced outright in v1.13. Every
 * assertion below is a case that version could not reach. Run: node phantasmtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); }); await wait(1100);
  ok(await p.evaluate(()=>!!(window.__solo&&window.__solo.st())), 'duel started');

  /* A conjure hands the turn to the Rival, whose turn runs asynchronously — re-staging on top of that leaves
   * the board `busy` and the next case silently does nothing. Each case gets a fresh duel instead. */
  const fresh=async()=>{
    await p.goto(URL); await wait(600);          // reload: a leftover overlay would swallow the New-game click
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
    await p.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); }); await wait(1000);
  };

  /* Stage: the Rival's pair of 9s is on the pile and it is your turn. You hold Phantasmal Illusion (♦10).
   * `equip` decides which of the three routes is available. */
  const stage=(equip, odysseus)=>p.evaluate(a=>{
    const st=window.__solo.st(), E=window.CardmenEngine;
    const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=3; st.turn=0; st.passes=0; st.finished=false;
    st.players[0].hand=[mk(10,'D'), mk(3,'H'), mk(9,'D')];
    st.players[0].energy=[]; for(let i=0;i<12;i++) st.players[0].energy.push(mk(4,'D','e'+i));
    st.players[0].equipment = a.equip ? [{id:'eqT', name:a.equip.name, delta:a.equip.delta||0, oppDelta:a.equip.oppDelta||0, counters:3, decay:true}] : [];
    st.players[0].forms = a.odysseus ? [{rank:13,suit:'D',tier:'king',name:'Odysseus',id:'zKD'}] : [];
    const combo=E.detectCombo([mk(9,'H','x'), mk(9,'C','y')]);
    st.pile={ combo:combo, byPlayer:1, raw:combo.value, rawKey0:combo.key[0], lockedDelta:0, mod:0 };
    st.lastPlayer=1;
    if(E.refreshPile) E.refreshPile(st);
    window.__solo.render();
    return true;
  }, {equip, odysseus});

  // the hand keeps its selection between cases, so clicking the same card twice would DESELECT it
  const sel=async id=>{ await p.evaluate(i=>{ const clr=document.getElementById('clearBtn'); if(clr)clr.click();
    const c=document.querySelector('#hand .card[data-id="'+i+'"]'); if(c)c.click(); }, id); await wait(250); };
  const ctx=()=>p.evaluate(()=>{ const b=document.getElementById('ctxBtn');
    return { shown:!!(b&&b.style.display!=='none'), label:(b&&b.textContent||'').trim(), off:!!(b&&b.classList.contains('off')) }; });
  const hint=()=>p.evaluate(()=>((document.getElementById('hint')||{}).textContent||'').trim());
  const pileNow=()=>p.evaluate(()=>{ const st=window.__solo.st();
    return st.pile?{by:st.pile.byPlayer, type:st.pile.combo.type, value:st.pile.combo.value, phantom:!!st.pile.phantom}:null; });
  /* Read the pile the moment the illusion lands, not later: conjuring hands the turn to the Rival, whose turn
   * runs asynchronously and can re-take the pile within a few hundred ms. Poll for OUR ownership instead of
   * sampling once and hoping. `spent` is the durable half — the Illusion card cannot come back to hand. */
  const conjured=async()=>{
    let seen=null;
    for(let i=0;i<40;i++){ const q=await pileNow(); if(q && q.by===0){ seen=q; break; } await wait(50); }
    const spent=await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='10D'));
    return { pile:seen, spent:spent };
  };

  // ---- 1. no equipment, no Odysseus: a bare copy only ties, and nothing in hand completes a higher pair
  await stage(null,false); await wait(300);
  await sel('10D');
  let c1=await ctx();
  ok(c1.shown && /phantasm/i.test(c1.label), 'the Phantasm action appears when you hold ♦10 facing a Special');
  await p.evaluate(()=>{ const b=document.getElementById('ctxBtn'); if(b)b.click(); }); await wait(300);
  const untouched=await p.evaluate(()=>({ by:window.__solo.st().pile.byPlayer, hand:window.__solo.st().players[0].hand.length,
                                          picking:/Phantasmal Illusion —/.test((document.getElementById('hint')||{}).textContent||'') }));
  ok(untouched.by===1 && untouched.hand===3 && !untouched.picking,
     'with no edge at all it refuses outright — a bare copy ties, and ties never win (nothing spent, no picker)');

  await fresh();
  // ---- 2. Equipment lifts the bare copy over the play it copied: NO card spent
  await stage({name:"Hero's Sword", delta:2}, false); await wait(300);
  await sel('10D');
  await p.evaluate(()=>{ const b=document.getElementById('ctxBtn'); if(b)b.click(); }); await wait(350);
  ok(/Confirm to conjure|Confirm to copy/i.test(await hint()), 'with a buff up it offers to conjure WITHOUT a swap ("'+(await hint()).slice(0,60)+'…")');
  const handBefore=await p.evaluate(()=>window.__solo.st().players[0].hand.length);
  await p.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f&&!f.disabled) f.click(); });
  const c2r=await conjured();
  ok(c2r.pile && c2r.pile.phantom===true, 'Confirm with NO card selected conjures the illusion and takes the initiative');
  ok(c2r.spent, 'the Illusion card is spent');
  const handAfter=await p.evaluate(()=>window.__solo.st().players[0].hand.length);
  ok(handAfter===handBefore-1, 'and it is the ONLY card that left your hand — the copies are illusions ('+handBefore+'→'+handAfter+')');
  ok(c2r.pile && c2r.pile.type==='pair', 'it answered a plain PAIR — the case a mandatory swap could never reach');

  await fresh();
  // ---- 3. Odysseus alone (+1 on the copy), no equipment
  await stage(null,true); await wait(300);
  await sel('10D');
  await p.evaluate(()=>{ const b=document.getElementById('ctxBtn'); if(b)b.click(); }); await wait(300);
  await p.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f&&!f.disabled) f.click(); });
  const c3r=await conjured();
  ok(c3r.pile && c3r.spent, 'Odysseus alone conjures the illusion at +1 — enough on its own');

  await fresh();
  // ---- 4. the swap still works, and still costs exactly the one card
  await stage(null,false); await wait(300);
  await p.evaluate(()=>{
    const st=window.__solo.st(), mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    const E=window.CardmenEngine;
    st.players[0].hand=[mk(10,'D'), mk(9,'D'), mk(3,'H')];
    const combo=E.detectCombo([mk(8,'H','a'),mk(8,'C','b'),mk(8,'S','c'),mk(9,'H','d'),mk(9,'C','e')]);   // their full house
    st.pile={ combo:combo, byPlayer:1, raw:combo.value, rawKey0:combo.key[0], lockedDelta:0, mod:0 };
    st.lastPlayer=1; window.__solo.render();
  }); await wait(300);
  await sel('10D');
  await p.evaluate(()=>{ const b=document.getElementById('ctxBtn'); if(b)b.click(); }); await wait(300);
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="9D"]'); if(c)c.click(); }); await wait(250);
  await p.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f&&!f.disabled) f.click(); });
  const sw=(await conjured()).pile;
  ok(sw && sw.type==='fullhouse', 'swapping one card still flips their full house into yours (88899 → 99988)');
  ok(await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='9D')), '…and the swapped card is the only real card spent');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
