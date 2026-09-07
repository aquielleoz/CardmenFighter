/* A FORM-GRANTED QUICK MUST BE OFFERED IN THE RESPOND? WINDOW (v1.31.112).
 *
 * Aj, from real play: *"sanctuary did not prompt use when i was about to lose shields. it's quick now with all
 * the supers activated"*. Two separate windows were at fault; this file covers the general one.
 * `eligibleQuicks()` read `effectOf` — the card's BASE effect — so the SIX Form/Super patches that grant
 * `quick` were invisible to it. That is not a cosmetic miss: `promptHumanResponse` treats an empty list as
 * "nothing to answer with" and **auto-declines for the player**, so no window ever opened and nothing was
 * logged. A silent auto-pass is indistinguishable from a card that simply does not work.
 *
 * WHY A UI SUITE: `test.js` already proves `E.respond` ACCEPTS a Form-made Quick (it has since the Hector
 * block was written) — the engine was never the problem. The bug was entirely in what the UI offered, which
 * is the layer no assertion covered.
 *
 * Run: node quicktest.js */
const { chromium }=require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
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

  /* Hector Form (K♥) in your zone makes Sanctuary (10♥) a Quick. The Rival holds a Technique and the energy
     to cast it, so its turn opens a response window. You lead the apex 2 so the Rival cannot fight back. */
  await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    const you=st.players[0], riv=st.players[1];
    you.forms=[{rank:13,suit:'H',tier:'king',name:'Hector Form',card:mk(13,'H','f13H')}];
    you.hand=[mk(2,'S','y2'),mk(10,'H','sanc')];
    you.energy=[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'H','e'+n));
    riv.hand=[mk(1,'D','r1'),mk(4,'C','r2')];
    riv.energy=[9,8,7,6,5].map(n=>mk(n,'D','re'+n));
    st.round=4; st.turn=0; st.pile=null; st.lastPlayer=null; st.passes=0;
    window.__solo.render(); });
  await wait(300);

  /* NOT VACUOUS: if the Form were not granting `quick`, every assertion below would pass on a build where the
     bug is still present — because the window would correctly never open. Pin the grant first. */
  const grant = await p.evaluate(()=>{ const st=window.__solo.st();
    const base=window.CardmenEngine.effectOf({rank:10,suit:'H',id:'sanc'})||{};
    const patched=window.CardmenEngine.effectFor(st,0,{rank:10,suit:'H',id:'sanc'})||{};
    return { base:!!base.quick, patched:!!patched.quick }; });
  ok(grant.patched && !grant.base,
     `STAGED: Hector makes Sanctuary a Quick (base quick=${grant.base}, with the Form=${grant.patched})`);

  // lead the unbeatable 2 so the Rival must act with an effect rather than a fight
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')]
    .filter(el=>el.querySelector('.card[data-id="y2"]'))[0]; if(g) g.click(); }); await wait(250);
  await p.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f&&!f.disabled) f.click(); });

  // poll for the Respond? window — the whole point is that it OPENS
  let modal=null;
  for(let i=0;i<160;i++){
    modal = await p.evaluate(()=>{
      const m=document.getElementById('modal');
      if(!m || !m.offsetParent) return null;
      const t=(m.textContent||'');
      return /Respond|answer|Quick/i.test(t) ? t.replace(/\s+/g,' ').slice(0,260) : null;
    });
    if(modal) break;
    await wait(60);
  }
  ok(!!modal, 'the Respond? window OPENS while you hold a Form-made Quick'+(modal?'':' — it auto-declined instead'));
  ok(!!modal && /Sanctuary/i.test(modal), `  → and it offers Sanctuary by name ["${(modal||'').slice(0,90)}"]`);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
