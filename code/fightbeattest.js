/* THE FIGHT SUB-PHASE BEAT FIRES FOR `Next`, NOT FOR A COMMIT (fight-announce-on-commit, v1.32.3).
 *
 * Aj, live game 2026-10-02: *"fight sub phase announcement flew in when i clicked fight. it should only fly
 * in for next"*. With cards selected in Main the button reads `⚔️ Fight`, and ONE press crosses into the
 * Fight Sub-Phase AND plays — so `notePhaseEdge` announced *"throw your cards down"* over cards already down.
 *
 * BOTH DIRECTIONS OFF ONE STAGING, because each alone passes on a broken build: "Next announces" passes on a
 * build where the beat fires for everything, and "Fight does not" passes on one where the beat was deleted.
 *
 * Run: node fightbeattest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);

  // a fresh Main Sub-Phase on your turn; `pile` optionally the Rival's 5 (so Pass means something)
  const stage=(withPile, rivalQuick, myQuick)=>p.evaluate(([withPile, rivalQuick, myQuick])=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    st.round=3; st.turn=0; st.passes=0; st.subPhase='main'; st.respondFor=null; st.pending=null;
    st.players.forEach(pl=>{ pl.energy=[]; });
    st.players[0].hand=[mk(9,'C','a9'),mk(9,'H','b9'),mk(10,'D','x10')];
    st.players[1].hand=[mk(3,'H','r3'),mk(4,'S','r4')];
    if(myQuick){ st.players[0].hand.push(mk(9,'D','mq9')); st.players[0].energy=[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','me'+n)); }
    if(rivalQuick){ st.players[1].hand.push(mk(9,'D','rq9')); st.players[1].energy=[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','re'+n)); }
    st.pile = withPile ? {combo:window.CardmenEngine.detectCombo([mk(5,'S','p5')]), byPlayer:1} : null;
    if(withPile) st.lastPlayer=1;
    const fx=document.getElementById('roundfx'); if(fx) fx.className='';
    window.__solo.render(); }, [withPile, rivalQuick, myQuick]);
  // let any ceremony from the previous leg finish — a press while `busy` is swallowed silently
  async function settle(){ const t0=Date.now(); while(Date.now()-t0<20000){
      const quiet=await p.evaluate(()=>{ const fx=document.getElementById('roundfx'), h=(document.getElementById('hint')||{}).textContent||'';
        return !(fx && /show/.test(fx.className) && !/phasefx/.test(fx.className)) && !/Hold on|fighting/.test(h) && window.__solo.st().turn===0; });
      if(quiet) return true; await wait(150); } console.log('   ⏱ settle TIMED OUT'); return false; }
  const fightLabel=()=>p.evaluate(()=>(document.getElementById('fightBtn').textContent||'').trim());
  // watch the stage for the beat for `ms` after a press
  async function beatShown(ms){ const t0=Date.now(); while(Date.now()-t0<ms){
      if(await p.evaluate(()=>{ const fx=document.getElementById('roundfx'); return !!(fx && /phasefx/.test(fx.className) && /Fight sub-phase/.test(fx.textContent||'')); })) return true;
      await wait(50); } return false; }
  const sub=()=>p.evaluate(()=>window.__solo.st().subPhase);

  // ---- leg 1: Next with nothing selected — the beat IS the point
  await settle(); await stage(false); await wait(400);
  ok(/Next/.test(await fightLabel()), 'STAGED: Main Sub-Phase, nothing selected, the button reads Next ('+(await fightLabel())+')');
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  const n1=await beatShown(2500);
  ok(await sub()==='play', '▶ Next moved you into the Fight Sub-Phase');
  ok(n1, '…and the "Fight sub-phase" beat flew in — Next is what it exists for');
  await wait(1500);

  // ---- leg 2: Fight with a pair selected — crosses AND plays in one press, so no beat
  await settle(); await stage(false); await wait(400);
  await p.evaluate(()=>{ ['a9','b9'].forEach(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) c.click(); }); });   // the card, as fightclick does
  await wait(250);
  ok(/Fight/.test(await fightLabel()), 'STAGED: a pair selected in Main, the button reads Fight ('+(await fightLabel())+')');
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  const n2=await beatShown(2500);
  const played=await p.evaluate(()=>{ const st=window.__solo.st(); return !st.players[0].hand.some(c=>c.id==='a9') || (st.pile && st.pile.combo && st.pile.combo.type==='pair'); });
  ok(played, 'one ⚔️ Fight press crossed over AND played the pair');
  ok(!n2, '…and the Fight sub-phase beat did NOT fly in over cards already down'+(n2?' ← REPRODUCED':''));
  await wait(2500);

  // ---- leg 2b: the same press when the crossing OPENS A WINDOW — the Rival holds Leyline, so somebody can
  // add to the stack at Main → Fight, the board renders with you already in the Fight Sub-Phase BEFORE the
  // play lands, and that render is where the beat used to fire. This is the shape that reproduces the report.
  await settle(); await stage(false, true); await wait(400);
  const ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  await p.evaluate(()=>{ ['a9','b9'].forEach(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) c.click(); }); });
  await wait(250);
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  const t2=Date.now(); let n2b=false, opened=false;
  while(Date.now()-t2<6000){ const r=await p.evaluate(()=>{ const st=window.__solo.st(), fx=document.getElementById('roundfx');
      return { beat:!!(fx && /phasefx/.test(fx.className) && /Fight sub-phase/.test(fx.textContent||'')), win:st.respondFor!=null }; });
    if(r.beat) n2b=true; if(r.win) opened=true; await wait(40); }
  const played2=await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9'));
  const crossing=await p.evaluate((n)=>window.__solo.prioLog().slice(n).map(l=>typeof l==='string'?l:(l.text||JSON.stringify(l))).filter(t=>/MAIN → FIGHT/.test(t)).join(' | '), ledN);
  ok(crossing && !/nobody could add/.test(crossing), 'STAGED: the crossing really OPENED a window — the Rival could answer ('+crossing.slice(0,140)+')');
  ok(played2, '…and the pair still went down (the Rival let it through)');
  ok(!n2b, '…and with a window in the way the beat STILL did not fly in over the commit'+(n2b?' ← REPRODUCED':''));
  await wait(2500);

  // ---- leg 2c: YOU hold the Quick. The go-round starts at the CONTROLLER (epic step 6), so the crossing
  // offers priority to you first; your pass (auto or clicked) closes the go-round and the board renders on
  // your turn in the Fight Sub-Phase BEFORE the play is applied.
  await settle(); await stage(false, false, true); await wait(400);
  const ledN3=await p.evaluate(()=>window.__solo.prioLog().length);
  await p.evaluate(()=>{ ['a9','b9'].forEach(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) c.click(); }); });
  await wait(250);
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  const t3=Date.now(); let n2c=false;
  while(Date.now()-t3<6000){
    if(await p.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d && d.offsetParent){ d.click(); } const fx=document.getElementById('roundfx'); return !!(fx && /phasefx/.test(fx.className) && /Fight sub-phase/.test(fx.textContent||'')); })) n2c=true;
    await wait(40); }
  const cross3=await p.evaluate((n)=>window.__solo.prioLog().slice(n).map(l=>typeof l==='string'?l:(l.text||JSON.stringify(l))).filter(t=>/MAIN → FIGHT/.test(t)).join(' | '), ledN3);
  console.log('   leg 2c ledger: '+cross3.slice(0,200));
  ok(await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9')), 'STAGED: holding a Quick of your own, one ⚔️ Fight press still played the pair');
  ok(!n2c, '…and the beat did not fly in over it'+(n2c?' ← REPRODUCED':''));
  await wait(2500);

  // (no Pass leg: Pass is not rendered in the Main Sub-Phase since epic step 20, so it cannot cross AND commit)

  // ---- leg 4: and Next STILL announces after a suppressed commit — the one-shot must not leak
  await wait(2500);
  await settle(); await stage(false); await wait(400);
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  ok(await beatShown(2500), 'a later ▶ Next still announces — the suppression is one-shot');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
