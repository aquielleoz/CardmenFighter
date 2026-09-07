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
 * It also pins the trap that made me misdiagnose it: **`FORM_SUIT_MATCH` is `false`** (variant B), so the
 * CLUB queen in Aj's zone boosts a SPADE Counterfeit. Staged exactly that way on purpose — a same-suit rig
 * would pass on a build where the Form gating was wrong.
 *
 * Run: node counterfeittest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
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
  await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    const you=st.players[0];
    you.forms=[{rank:11,suit:'C',tier:'ride',name:'Giant Boar',card:mk(11,'C','f11C')},
               {rank:12,suit:'C',tier:'queen',name:'Hippolyta',card:mk(12,'C','f12C')}];
    you.hand=[mk(8,'S','cf'),mk(7,'C','my7')];
    you.energy=[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'S','e'+n));
    st.pile={combo:window.CardmenEngine.detectCombo([mk(7,'D','p7D'),mk(7,'H','p7H')]), byPlayer:1};
    st.round=7; st.turn=0; st.lastPlayer=1; st.passes=0;
    window.__solo.render(); });
  await wait(300);

  /* NOT VACUOUS: the boost has to actually be live, or every assertion below passes on a build where
     Counterfeit was never boosted at all. This is the cross-suit case — club Form, spade card. */
  const boost = await p.evaluate(()=>{ const st=window.__solo.st();
    return (window.CardmenEngine.effectFor(st, 0, {rank:8,suit:'S',id:'cf'})||{}).copyPlus||0; });
  ok(boost===1, `STAGED: the CLUB queen boosts the SPADE Counterfeit (copyPlus ${boost}, variant B)`);

  // cast it, and pick the 7♦ out of the real picker
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')]
    .filter(el=>el.querySelector('.card[data-id="cf"]'))[0]; if(g) g.click(); }); await wait(250);
  await p.evaluate(()=>{ const c=document.getElementById('ctxBtn'); if(c) c.click(); }); await wait(400);
  ok(await p.evaluate(()=>document.querySelectorAll('.cfPick').length>0), 'the Counterfeit picker opens with the pile\'s cards to choose from');
  await p.evaluate(()=>{ const b=[...document.querySelectorAll('.cfPick')][0]; if(b) b.click(); }); await wait(500);

  const copy = await p.evaluate(()=>{ const h=window.__solo.st().players[0].hand.filter(c=>c.counterfeit)[0];
    return h?{rank:h.rank,bonus:h.valueBonus,fv:window.CardmenEngine.fightValue(h),id:h.id}:null; });
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
  await p.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f&&!f.disabled) f.click(); }); await wait(900);
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
