/* THE FIGHT SUB-PHASE SHOWS ON EVERY CROSSING OF YOURS, BEFORE THE MOVE LANDS (drag-and-stack ruling 10).
 *
 * Aj, 2026-10-13, asked whether a quiet turn should go straight from Main to the next player once Next was
 * gone: *"Show Fight briefly every turn"*. That REPLACES the 2026-10-02 rule this suite used to pin (*"it
 * should only fly in for next"*, v1.32.3), which swallowed the beat on a press that crossed and committed —
 * and with Next removed, that rule would have left the Fight Sub-Phase invisible on nearly every turn,
 * because a quiet crossing auto-advances inside one engine call and no render ever sees it.
 *
 * WHAT EACH LEG ASSERTS, off ONE staging: the crossing raised EXACTLY ONE beat; at that beat the cards being
 * played were STILL IN HAND and the strip read Fight (so it came before the move landed — `afterCrossing`'s
 * dwell); and the move then landed. "Exactly one" is also the negative half: the Rival's own crossing, which
 * follows yours on its turn, must not raise YOUR beat, and a build that announced everything would count two.
 * The legs cover every way a crossing completes: quiet, through a window the Rival declines, through a window
 * you decline yourself, and by Pass.
 * The netplay client's half (the host's `t:'crossed'` notice and the held mirror) is `nettest_fightbeat`.
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

  /* EVERY BEAT, AS IT IS INSERTED, with the hand and the strip at that instant — the evidence for "before the
     move landed" has to be taken at the beat, not afterwards. */
  await p.evaluate(()=>{ window.__beats=[]; const fx=document.getElementById('roundfx');
    new MutationObserver(ms=>{ ms.forEach(m=>m.addedNodes.forEach(n=>{
      if(n.classList && n.classList.contains('rfBeat') && /Fight sub-phase/.test(n.textContent||'')){
        const st=window.__solo.st();
        window.__beats.push({ at:Date.now(), turn:st.turn, hand:st.players[0].hand.map(c=>c.id),
                              strip:(document.getElementById('handWrap')||{}).className||'' }); } })); })
      .observe(fx,{childList:true, subtree:true}); });

  // a fresh Main Sub-Phase on your turn; `pile` optionally the Rival's 5 (so Pass means something)
  const stage=(withPile, rivalQuick, myQuick)=>p.evaluate(([withPile, rivalQuick, myQuick])=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    st.round=3; st.turn=0; st.passes=0; st.subPhase='main'; st.respondFor=null; st.pending=null;
    /* AND NO ROUND BOUNDARY LEFT OVER FROM THE PREVIOUS LEG: a leg whose pair ends the round leaves Resolution or
       Clean-up open, which paints the strip and makes the engine refuse the next crossing ("the round is over"). */
    st.resolution=null; st.resolutionResult=null; st.cleanup=null; st.endCleanup=null; st.upkeep=null; st.toPlay=null;
    st.stack=[]; st.roundWinResult=null; st.discardPending=null; st.pendingLossChoice=null; st.trimPending=null;
    st.players.forEach(pl=>{ pl.energy=[]; });
    st.players[0].hand=[mk(9,'C','a9'),mk(9,'H','b9'),mk(10,'D','x10')];
    st.players[1].hand=[mk(3,'H','r3'),mk(4,'S','r4')];
    if(myQuick){ st.players[0].hand.push(mk(9,'D','mq9')); st.players[0].energy=[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','me'+n)); }
    if(rivalQuick){ st.players[1].hand.push(mk(9,'D','rq9')); st.players[1].energy=[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','re'+n)); }
    st.pile = withPile ? {combo:window.CardmenEngine.detectCombo([mk(5,'S','p5')]), byPlayer:1} : null;
    if(withPile) st.lastPlayer=1;
    const fx=document.getElementById('roundfx'); if(fx) fx.className='';
    window.__solo.render(); window.__beats.length=0; }, [withPile, rivalQuick, myQuick]);
  // let any ceremony from the previous leg finish — a press while `busy` is swallowed silently
  async function settle(){ const t0=Date.now(); while(Date.now()-t0<20000){
      const quiet=await p.evaluate(()=>{ const fx=document.getElementById('roundfx'), h=(document.getElementById('hint')||{}).textContent||'';
        const d=document.getElementById('respDecline'); if(d && d.offsetParent!==null && !d.disabled){ d.click(); return false; }   // a boundary window ON mode shows — answer it, or the board waits on us forever
        const strip=(document.getElementById('handWrap')||{}).className||'';
        return !(fx && /show/.test(fx.className) && !/phasefx/.test(fx.className)) && !/Hold on|fighting/.test(h) && window.__solo.st().turn===0 && !/spResolve|spCleanup|spBegin/.test(strip); });
      if(quiet) return true; await wait(150); }
    const why=await p.evaluate(()=>{ const st=window.__solo.st(), fx=document.getElementById('roundfx');
      return 'turn='+st.turn+' sub='+st.subPhase+' fin='+st.finished+' resp='+st.respondFor+' strip='+((document.getElementById('handWrap')||{}).className||'')+
             ' fx="'+(fx?fx.className:'')+'" hint="'+((document.getElementById('hint')||{}).textContent||'').slice(0,80)+'"'; });
    console.log('   ⏱ settle TIMED OUT  '+why); return false; }
  const selectPair=()=>p.evaluate(()=>{ ['a9','b9'].forEach(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) c.click(); }); });
  const beats=()=>p.evaluate(()=>window.__beats.slice());
  const ledgerSince=n=>p.evaluate((n)=>window.__solo.prioLog().slice(n).map(l=>typeof l==='string'?l:(l.text||JSON.stringify(l))).filter(t=>/MAIN → FIGHT/.test(t)).join(' | '), n);
  /* Drive whatever window opens (pass it), and stop once the Rival's turn is over and the board is yours again
     — that span includes the Rival's own crossing, which must not add a beat. */
  async function runOut(ms){ const t0=Date.now(); let sawRival=false;
    while(Date.now()-t0<ms){
      const r=await p.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d && d.offsetParent!==null && !d.disabled) d.click();
        return window.__solo.st().turn; });
      if(r!==0) sawRival=true; else if(sawRival) break;
      await wait(60); }
    await wait(400); }
  // one leg's verdict: exactly one beat, taken while `held` was still in hand and the strip read Fight, and the move landed
  function judge(name, bs, held, landed){
    const b0=bs[0]||{};
    ok(bs.length===1, name+': the crossing raised EXACTLY ONE Fight beat ('+bs.length+')'+(bs.length>1?' ← the Rival\'s crossing raised yours too':'')+(bs.length===0?' ← REPRODUCED: an invisible Fight Sub-Phase':''));
    ok(bs.length>0 && b0.turn===0 && held.every(id=>b0.hand.indexOf(id)>=0),
       name+': …BEFORE the move landed — the cards were still in hand at the beat'+(bs.length?'  [hand '+b0.hand.join(',')+']':''));
    ok(bs.length>0 && /spFight/.test(b0.strip), name+': …and the strip read Fight at that moment  ['+(b0.strip||'')+']');
    ok(landed, name+': …and then the move went through');
  }

  // ---- leg 1: a quiet crossing — nobody can add to the stack, so it auto-advances inside one engine call
  await settle(); await stage(false); await wait(400);
  let ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  await selectPair(); await wait(250);
  ok(/^Fight$/.test(await p.evaluate(()=>(document.getElementById('fightBtn').textContent||'').trim())), 'STAGED: a pair selected in Main, the button reads Fight');
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  await runOut(8000);
  ok(/nobody could add/.test(await ledgerSince(ledN)), 'STAGED: the crossing was QUIET  ['+(await ledgerSince(ledN)).slice(0,120)+']');
  judge('quiet', await beats(), ['a9','b9'], await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9')));

  // ---- leg 2: the crossing OPENS A WINDOW — the Rival holds Leyline, so it may answer at Main → Fight and lets it through
  await settle(); await stage(false, true); await wait(400);
  ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  await selectPair(); await wait(250);
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  await runOut(10000);
  const cross2=await ledgerSince(ledN);
  ok(cross2 && !/nobody could add/.test(cross2), 'STAGED: the crossing really OPENED a window — the Rival could answer  ['+cross2.slice(0,120)+']');
  judge('rival window', await beats(), ['a9','b9'], await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9')));

  // ---- leg 3: YOU hold the Quick. The go-round starts at the controller (epic step 6), so the crossing offers
  // priority to you first; declining it closes the go-round, and the board renders in Fight before the play
  await settle(); await stage(false, false, true); await wait(400);
  await p.evaluate(()=>window.__solo.setPromptMode && window.__solo.setPromptMode('on'));
  ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  await selectPair(); await wait(250);
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  await runOut(10000);
  await p.evaluate(()=>window.__solo.setPromptMode && window.__solo.setPromptMode('auto'));
  console.log('   leg 3 ledger: '+(await ledgerSince(ledN)).slice(0,200));
  judge('your window', await beats(), ['a9','b9'], await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9')));

  // ---- leg 4: Pass crosses too — from Main one press crosses into the Fight Sub-Phase and then sits out
  await settle(); await stage(true); await wait(400);
  ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  ok(await p.evaluate(()=>{ const b=document.getElementById('passBtn'); return !!b && b.offsetParent!==null && !b.disabled; }), 'STAGED: following a 5, Pass is live in Main');
  await p.evaluate(()=>document.getElementById('passBtn').click());
  await runOut(8000);
  ok(/\[Pass\]/.test(await ledgerSince(ledN)), 'STAGED: the ledger records a crossing opened by Pass  ['+(await ledgerSince(ledN)).slice(0,120)+']');
  const bs4=await beats();
  ok(bs4.length===1, 'pass: the crossing raised EXACTLY ONE Fight beat ('+bs4.length+')');
  ok(bs4.length>0 && /spFight/.test(bs4[0].strip) && bs4[0].turn===0, 'pass: …on your turn, with the strip on Fight, before the pass handed the turn on');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
