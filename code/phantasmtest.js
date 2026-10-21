/* PHANTASMAL ILLUSION, in the real built page (2026-10-21). Aj ruled the card a Counterfeit of the whole play: it is
 * an ordinary ⚡ cast in Main that goes on the stack, and resolving it conjures the current play into your HAND. You
 * then fight with the copies, alone or with your own cards, through an ordinary Fight; any you keep fade with the
 * round, and their effects can't be activated.
 * It replaced a card with its own "Phantasm" button, an optional one-card swap and no window at all (v1.31.6 → v1.34.6).
 * Every leg here drives the page a player drives: the ⚡, the hand, Fight. Run: node phantasmtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { selectAndFight, waitHold } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  /* Each case gets a fresh duel: a fight hands the turn to the Rival, whose turn runs asynchronously. */
  const fresh=async()=>{
    await p.goto(URL); await wait(600);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
    await p.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); }); await wait(1000);
    await p.waitForFunction(()=>{ const r=document.getElementById('roundfx'); return !r || !r.classList.contains('show'); }, null, {timeout:8000}).catch(()=>{});
  };
  /* The Rival's full house 8-8-8-9-9 is on the pile, it is your turn in Main, and you hold the Illusion (♦10), a 9♦ and
   * a 3♥. `rivalHand` lets a case give the Rival a Counter Spell. */
  const stage=(pile, rivalHand)=>p.evaluate(a=>{
    const st=window.__solo.st(), E=window.CardmenEngine;
    const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=3; st.turn=0; st.passes=0; st.finished=false; st.subPhase='main'; st.toPlay=null;
    st.stack=[]; st.prioPassed={}; st.pending=null; st.respondFor=null;
    st.players[0].hand=[mk(10,'D'), mk(9,'D'), mk(3,'H')];
    st.players[0].energy=[]; for(let i=0;i<12;i++) st.players[0].energy.push(mk(4,'D','e'+i));
    st.players[0].equipment=[]; st.players[0].forms=[];
    st.players[1].hand=(a.rivalHand||[[3,'S'],[6,'H']]).map(x=>mk(x[0],x[1],'r'));
    st.players[1].energy=[]; for(let i=0;i<8;i++) st.players[1].energy.push(mk(4,'D','f'+i));
    const combo=E.detectCombo(a.pile.map((x,i)=>mk(x[0],x[1],'p'+i)));
    st.pile={ combo:combo, byPlayer:1, raw:combo.value, rawKey0:combo.key[0], lockedDelta:0, mod:0 };
    st.lastPlayer=1;
    window.__solo.render();
    return true;
  }, {pile, rivalHand});
  const FH=[[8,'H'],[8,'C'],[8,'S'],[9,'H'],[9,'C']];
  const sel=async id=>{ await p.evaluate(i=>{ const clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
    [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(c=>c.click());
    const c=document.querySelector('#hand .card[data-id="'+i+'"]'); if(c)c.click(); }, id); await wait(250); };
  const ctx=()=>p.evaluate(()=>{ const b=document.getElementById('ctxBtn');
    return { shown:!!(b && b.offsetParent), label:(b&&b.textContent||'').trim(), off:!!(b&&b.classList.contains('off')), title:(b&&b.title)||'' }; });
  const board=()=>p.evaluate(()=>{ const st=window.__solo.st();
    return { copies:st.players[0].hand.filter(c=>c.temp).map(c=>c.id), shown:[...document.querySelectorAll('#hand .card')].filter(c=>/^PH/.test(c.dataset.id)).length,
             spent:!st.players[0].hand.some(c=>c.id==='10D'), pileBy:st.pile?st.pile.byPlayer:null, pileType:st.pile?st.pile.combo.type:null,
             sub:st.subPhase, turn:st.turn, shuffle:st.players[0].shuffle.some(c=>c.id==='10D'), stack:(st.stack||[]).length }; });
  const press=()=>p.evaluate(()=>{ const b=document.getElementById('ctxBtn'); if(b && b.offsetParent && !b.classList.contains('off')) { b.click(); return true; } return false; });

  // ---- 1. facing their full house: the Illusion is an ordinary ⚡ Activate, and one tap conjures the copies
  await fresh(); await stage(FH); await wait(300);
  await sel('10D');
  const c1=await ctx();
  ok(c1.shown && /Activate/.test(c1.label) && !c1.off, 'holding the Illusion facing a Special shows an ordinary live ⚡ Activate  (label "'+c1.label+'")');
  const castBefore=await p.evaluate(()=>window.__solo.stats().seats[0].eff.D10||0);
  ok(await press(), '…and the ⚡ can be pressed');
  await waitHold(p);
  let b1=null; for(let i=0;i<40;i++){ b1=await board(); if(b1.copies.length) break; await wait(100); }
  ok(b1.copies.length===5 && b1.shown===5, 'the tap conjures the whole play into your HAND — five copies, all on screen  ('+b1.copies.length+' in state, '+b1.shown+' drawn)');
  ok(b1.spent && b1.pileBy===1, 'the Illusion card is spent and the pile is still the Rival\'s — nothing was fought yet');
  ok(b1.sub==='main' && b1.turn===0, 'you are still in Main on your own turn (sub-phase '+b1.sub+')');
  const castAfter=await p.evaluate(()=>window.__solo.stats().seats[0].eff.D10||0);
  ok(castAfter-castBefore===1, 'the record counts the cast  ('+castBefore+' → '+castAfter+')');

  // ---- 2. a copy carries no effect: selecting one offers no ⚡
  await sel(b1.copies[0]);
  const c2=await ctx();
  ok(!(c2.shown && /Activate/.test(c2.label) && !c2.off), 'a copy\'s effect can\'t be activated — no live ⚡ for it  (label "'+c2.label+'", off '+c2.off+')');
  const rd=await p.evaluate(()=>((document.getElementById('cardView')||{}).innerText||'').replace(/\s+/g,' ').trim());
  ok(/Conjured copy/i.test(rd) && /can.t be activated/.test(rd) && /fades/.test(rd), '…and the card reader says so: a conjured copy, no activation, fades  ["'+rd.slice(0,70)+'…"]');

  // ---- 3. fight with two copied 9s, your own 9♦ and two copied 8s: 999-88 beats their 888-99
  const nines=await p.evaluate(()=>window.__solo.st().players[0].hand.filter(c=>c.temp && c.rank===9).map(c=>c.id));
  const eights=await p.evaluate(()=>window.__solo.st().players[0].hand.filter(c=>c.temp && c.rank===8).map(c=>c.id));
  await selectAndFight(p, nines.concat(['9D'], eights.slice(0,2)));
  let b3=null; for(let i=0;i<40;i++){ b3=await board(); if(b3.pileBy===0) break; await wait(50); }
  ok(b3.pileBy===0 && b3.pileType==='fullhouse', 'Fight with the copies and your own 9♦ takes the pile with 999-88  (pile by '+b3.pileBy+', '+b3.pileType+')');

  // ---- 4. facing a jab, the ⚡ greys with the engine's reason (Specials only)
  await fresh(); await stage([[9,'H']]); await wait(300);
  await sel('10D');
  const c4=await ctx();
  ok(c4.off && /Special/.test(c4.title), 'facing a jab the ⚡ is greyed: "'+c4.title+'"');
  ok(!(await press()) && (await board()).copies.length===0, '…and nothing is cast');

  // ---- 5. the Rival counters it: the Illusion copies THEIR play, so the AI's Counter Spell answers it
  await fresh(); await stage(FH, [[4,'D'],[3,'S']]); await wait(300);
  await sel('10D'); await press();
  let b5=null; for(let i=0;i<80;i++){ await waitHold(p); b5=await board(); if(b5.shuffle && !b5.stack) break; await wait(100); }
  ok(b5.shuffle && b5.copies.length===0, 'the Rival counters an Illusion of its own play: no copies, and the card is in your Shuffle Pile');
  ok(b5.sub==='main' && b5.turn===0 && b5.pileBy===1, '…and it never resolved, so you never crossed: still Main, still your turn  (sub-phase '+b5.sub+', turn '+b5.turn+')');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
