/* COUNTERFEIT IN THE REAL PAGE (v1.31.107) — the picker, and the copy's identity.
 *
 * Aj, from real play, holding a 7♣ and a boosted copy of a 7♦ and being refused: *"i used the counterfeit and
 * cloned a 7... it's a 7 and it should be able to pair up with a 7. and because of giant boar, i should be a
 * total +2 (boar + counterfeit boost)"*.
 *
 * `fightValue` used to add the copy's `valueBonus`, and `detectCombo` groups by `fightValue` — so a boosted
 * copy of a 7 evaluated as an 8 and matched nothing. The rule it broke is the game's spine: **base printed
 * values decide what Specials a card belongs to; modifiers apply on top of the pile.**
 *
 * TWO REASONS THIS IS A UI SUITE AND NOT ONLY AN ENGINE ONE. The symptom is a UI string ("Not a legal
 * combination"), and `promptCounterfeit` — the whole copy-picker flow — was driven by NO suite at all, which is
 * this file's standing rule about an affordance nothing exercises.
 * SINCE DRAG-AND-STACK STEP 2 THE PICK IS ON THE PILE, NOT IN A DIALOG: the Rival's cards on the table pulse as
 * targets, a tap stages one (gold), ⚡ Activate copies it and Clear backs out. The legs below assert each of those,
 * the cast column reaching the same pick, and a one-card pile being staged for you.
 * It also pins the trap that made me misdiagnose it: **`FORM_SUIT_MATCH` is `false`** (variant B), so the
 * CLUB queen in Aj's zone boosts a SPADE Counterfeit. Staged exactly that way on purpose — a same-suit rig
 * would pass on a build where the Form gating was wrong.
 *
 * Run: node counterfeittest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { selectAndFight, clickFight } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:900}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);

  /* Aj's board: J♣ Giant Boar + Q♣ Hippolyta in the zone, ♠8 Counterfeit and a real 7♣ in hand, and the
     Rival's pair of 7s on the table to copy from. */
  const stageBoard=(pile)=>p.evaluate((pile)=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    const you=st.players[0];
    you.forms=[{rank:11,suit:'C',tier:'ride',name:'Giant Boar',card:mk(11,'C','f11C')},
               {rank:12,suit:'C',tier:'queen',name:'Hippolyta',card:mk(12,'C','f12C')}];
    you.hand=[mk(8,'S','cf'),mk(7,'C','my7')];
    you.energy=[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'S','e'+n));
    st.pile={combo:window.CardmenEngine.detectCombo(pile.map(c=>mk(c[0],c[1],c[2]))), byPlayer:1};
    st.round=7; st.turn=0; st.lastPlayer=1; st.passes=0; st.subPhase='main'; st.respondFor=null; st.pending=null; st.stack=[];
    window.__solo.render(); }, pile);
  const PAIR=[[7,'D','p7D'],[7,'H','p7H']];
  const pickState=()=>p.evaluate(()=>{ const pl=[...document.querySelectorAll('#pile .card')];
    const ctx=document.getElementById('ctxBtn'), ov=document.getElementById('overlay'), st=window.__solo.st();
    return { copyable:pl.filter(c=>c.classList.contains('copyable')).map(c=>c.dataset.id),
             aimed:pl.filter(c=>c.classList.contains('copyAim')).map(c=>c.dataset.id),
             glow:pl.length ? getComputedStyle(pl[0]).boxShadow : 'none',
             modal:!!(ov && ov.classList.contains('show')), hint:((document.getElementById('hint')||{}).textContent||'').trim(),
             ctx:(ctx.textContent||'').trim(), ctxLive:!ctx.disabled && !ctx.classList.contains('off') && ctx.style.display!=='none',
             copied:st.players[0].hand.filter(c=>c.counterfeit).length, energy:st.players[0].energy.length,
             cfInHand:st.players[0].hand.some(c=>c.id==='cf') }; });
  const castCf=async()=>{ await p.evaluate(()=>{ [...document.querySelectorAll('#hand .card.sel, #hand .group.gsel')].forEach(e=>e.click());
      const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="cf"]'))[0]; if(g) g.click(); }); await wait(250);
    await p.evaluate(()=>{ const c=document.getElementById('ctxBtn'); if(c) c.click(); }); await wait(400); };
  const tapPile=async(id)=>{ await p.evaluate(id=>{ const c=document.querySelector('#pile .card[data-id="'+id+'"]'); if(c) c.click(); }, id); await wait(300); };
  await stageBoard(PAIR);
  await wait(300);

  /* NOT VACUOUS: the boost has to actually be live, or every assertion below passes on a build where
     Counterfeit was never boosted at all. This is the cross-suit case — club Form, spade card. */
  const boost = await p.evaluate(()=>{ const st=window.__solo.st();
    return (window.CardmenEngine.effectFor(st, 0, {rank:8,suit:'S',id:'cf'})||{}).copyPlus||0; });
  ok(boost===1, `STAGED: the CLUB queen boosts the SPADE Counterfeit (copyPlus ${boost}, variant B)`);

  /* ═══ CLEAR BACKS OUT, WITH NOTHING SPENT ═══ (first, on its own staging, so the main flow below starts clean) */
  await castCf();
  const a0=await pickState();
  ok(!a0.modal && a0.copyable.length===2, 'THE PICK IS ON THE PILE — no dialog, and both of the Rival\'s cards are targets  ['+JSON.stringify({modal:a0.modal, copyable:a0.copyable})+']');
  ok(a0.glow && a0.glow!=='none', '  …and they visibly GLOW (computed box-shadow, not just a class)  ['+String(a0.glow).slice(0,48)+']');
  ok(/Pick a target/.test(a0.ctx) && !a0.ctxLive, '  …and ⚡ Activate waits for a pick  ["'+a0.ctx+'"]');
  /* THE HINT SAYS WHAT THE PICK WAITS FOR. It used to describe the Main sub-phase ("nothing to use yet"),
     because a hand locked for the pick reads as unusable. */
  ok(/pile/i.test(a0.hint) && /copy/i.test(a0.hint) && !/Main sub-phase/.test(a0.hint), '  …and the hint says what it is waiting for  ["'+a0.hint+'"]');
  await tapPile('p7D');
  await p.evaluate(()=>{ const c=document.getElementById('clearBtn'); if(c && !c.disabled) c.click(); }); await wait(300);
  const a1=await pickState();
  ok(a1.copyable.length===0 && a1.aimed.length===0 && a1.copied===0 && a1.cfInHand && a1.energy===a0.energy,
     'CLEAR BACKS OUT — the pile stops glowing, no copy, Counterfeit still in hand, no energy spent  ['+JSON.stringify(a1)+']');

  /* ═══ A ONE-CARD PILE IS NO CHOICE, SO IT IS STAGED FOR YOU ═══ */
  await stageBoard([[9,'D','p9D']]); await wait(300);
  await castCf();
  const a2=await pickState();
  ok(a2.aimed.join()==='p9D' && /Activate/.test(a2.ctx) && a2.ctxLive && a2.copied===0,
     'A ONE-CARD PILE IS STAGED FOR YOU — the 9♦ is picked, ⚡ Activate is live, nothing is cast yet  ['+JSON.stringify(a2)+']');
  await p.evaluate(()=>{ const c=document.getElementById('clearBtn'); if(c && !c.disabled) c.click(); }); await wait(300);

  /* ═══ THE CAST COLUMN REACHES THE SAME PICK ═══ Drop Counterfeit on the column: it stages, the pile lights, and the
     column's own ⚡ reads 🎯 until a card is picked — then ⚡, and it casts. */
  await stageBoard(PAIR); await wait(300);
  const g=await p.evaluate(()=>{ const r=document.querySelector('#hand .card[data-id="cf"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  await p.mouse.move(g.x,g.y); await p.mouse.down(); await p.mouse.move(g.x,g.y-24,{steps:4}); await wait(60);
  const t=await p.evaluate(()=>{ const r=document.getElementById('castZone').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
  await p.mouse.move(t.x,t.y,{steps:14}); await wait(100); await p.mouse.up(); await wait(400);
  const colBtn=()=>p.evaluate(()=>{ const b=document.getElementById('stagedCastBtn'), n=document.querySelector('#stagedSlot .stgNote');
    return { go:b?b.textContent.trim():null, live:!!b && !b.disabled && !b.classList.contains('off'), note:n?n.textContent.trim():'' }; });
  const c0=await colBtn(), a3=await pickState();
  ok(a3.copyable.length===2 && c0.go==='🎯' && /copy/i.test(c0.note), 'A DROP ON THE COLUMN OPENS THE SAME PICK — the pile glows, the column says what to choose, its button reads 🎯  ['+JSON.stringify(c0)+']');
  await tapPile('p7H');
  const c1=await colBtn();
  ok(c1.go==='⚡' && c1.live && /^Copies the 7/.test(c1.note), '  …a tap on the pile lights the column\'s ⚡, and its note names the pick  ['+JSON.stringify(c1)+']');
  await p.evaluate(()=>{ const b=document.getElementById('stagedCastBtn'); if(b) b.click(); }); await wait(500);
  const a4=await p.evaluate(()=>{ const h=window.__solo.st().players[0].hand.filter(c=>c.counterfeit)[0]; return h?h.rank+h.suit:null; });
  ok(a4==='7H', '  …and the column\'s ⚡ copies the card you picked  ['+a4+']');

  /* ═══ THE MAIN FLOW: Aj's board, picking the SECOND card ═══ A tap STAGES the copy; ⚡ Activate copies THAT card.
     Picking the 7♥ rather than the first card is what proves the choice is honoured — a build that took the
     first card would copy the 7♦. */
  await stageBoard(PAIR); await wait(300);
  await castCf();
  await tapPile('p7H');
  const a5=await pickState();
  ok(a5.aimed.join()==='p7H' && a5.copied===0 && /Activate/.test(a5.ctx) && a5.ctxLive, 'a tap only STAGES the copy — the 7♥ turns gold, nothing cast yet, ⚡ Activate is live  ['+JSON.stringify({aimed:a5.aimed, copied:a5.copied, ctx:a5.ctx})+']');
  ok(/Activate/.test(a5.hint) && /Clear/.test(a5.hint), '  …and the hint says how to confirm or back out  ["'+a5.hint+'"]');
  await p.evaluate(()=>{ const c=document.getElementById('ctxBtn'); if(c) c.click(); }); await wait(500);
  const copy = await p.evaluate(()=>{ const h=window.__solo.st().players[0].hand.filter(c=>c.counterfeit)[0];
    return h?{rank:h.rank,suit:h.suit,bonus:h.valueBonus,fv:window.CardmenEngine.fightValue(h),id:h.id}:null; });
  ok(!!copy && copy.suit==='H', `⚡ ACTIVATE COPIED THE CARD YOU PICKED — the 7♥, not the first one  [${copy?copy.rank+copy.suit:'none'}]`);
  ok(!!copy && copy.bonus===1, `the copy entered your hand carrying its +${copy?copy.bonus:'?'} bonus`);
  ok(!!copy && copy.fv===copy.rank, `  → but its fightValue is the PRINTED ${copy?copy.rank:'?'}, not ${copy?copy.rank+1:'?'} — it keeps its identity`);

  // select both 7s — the exact thing Aj was refused
  await p.evaluate(id=>{ [...document.querySelectorAll('#hand .group')].forEach(g=>{
    if(g.querySelector('.card[data-id="my7"]')||g.querySelector('.card[data-id="'+id+'"]')) g.click(); }); }, copy?copy.id:'x');
  await wait(350);
  const ui = await p.evaluate(()=>({
    hint:(document.getElementById('hint').textContent||'').trim(),
    fight:!document.getElementById('fightBtn').disabled,
    mods:[...document.querySelectorAll('#playMods .pmod')].map(e=>e.textContent.replace(/\s+/g,' ').trim()) }));
  ok(!/Not a legal combination/i.test(ui.hint), `THE REPORTED SYMPTOM IS GONE — the hint reads "${ui.hint}"`);
  ok(ui.fight, '  → and Fight is enabled: two 7s are a pair');
  /* Aj counted on +2 — Boar's +1 and the copy's +1 — and the chip row could not see the second one, because a
     card-borne modifier is invisible to a board-only readout. */
  ok(ui.mods.some(t=>/Counterfeit/i.test(t)), `  → the chip row names the copy's bonus (${JSON.stringify(ui.mods)})`);
  ok(ui.mods.some(t=>/Giant Boar/i.test(t)), '  → alongside Giant Boar, so the player can total the +2 they were counting on');

  // and it must actually beat the pair of 7s it was copied from, then hold the pile at +2
  await clickFight(p); await wait(900);   // two-state button (epic step 20) — see fightclick.js
  const pile = await p.evaluate(()=>{ const st=window.__solo.st();
    return st.pile&&st.pile.combo?{by:st.pile.byPlayer,type:st.pile.combo.type,value:st.pile.combo.value}:null; });
  ok(pile && pile.by===0 && pile.type==='pair', `the pair took the pile (${pile?pile.type:'none'})`);
  /* PERSISTS UNTIL THE PILE IS DEFEATED (Aj: "counterfeit's boost is applied to the pile and persists until
     that pile is defeated, like most boosts"). Boar is correctly NOT in it — it only helps you BEAT a pile,
     never hold one — so the standing pile is 7+1, not 7+2. */
  ok(pile && pile.value===8, `  → and holds it at ${pile?pile.value:'?'} — the copy's +1 locked on, Boar correctly not (it is attack-only)`);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
