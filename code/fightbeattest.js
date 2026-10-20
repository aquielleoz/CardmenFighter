/* THE FIGHT SUB-PHASE FLASHES ON EVERY CROSSING OF YOURS — NO BANNER, NO PAUSE (drag-and-stack, 2026-10-14).
 *
 * Ruling 10 (Aj, 2026-10-13: *"Show Fight briefly every turn"*) first shipped as a banner over a ~700ms hold.
 * Playing it, Aj: *"the pause for the announcement for the fight is really jarring... can we just keep the yellow
 * color and skip the announcement?"* and *"if no one plays a card it's like hitting a speed bump at full speed"*.
 * So the strip flashes the Fight yellow (`flashFight`) and the play lands at once.
 *
 * WHAT EACH LEG ASSERTS, off ONE staging: the crossing flashed EXACTLY ONCE, on your turn with the cards still in
 * hand (read from `__solo.fightFlashes()`, because the flash and the play land in one task and no observer can see
 * the order); NO Fight banner; and the move landed. "Exactly once" is also the negative half: the Rival's own
 * crossing, which follows yours, must not flash YOUR strip. The QUIET and PASS legs also assert NO PAUSE: the old
 * hold rendered "Hold on — the board is still resolving." with your cards still in hand, so any such hint while
 * they are held is the speed bump coming back. The window legs are exempt — a priority window is a real stop.
 * The netplay client's half (the host's `t:'crossed'` notice) is `nettest_fightbeat`.
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

  /* ANY FIGHT BANNER (there must be none) and any "Hold on" hint while the cards being played are still in hand
     (a pause). Both observed in the page, from the moment each leg stages. */
  await p.evaluate(()=>{ window.__banners=0; window.__holds=[]; window.__held=[];
    new MutationObserver(ms=>ms.forEach(m=>m.addedNodes.forEach(n=>{ if(n.classList && n.classList.contains('rfBeat') && /Fight sub-phase/i.test(n.textContent||'')) window.__banners++; })))
      .observe(document.getElementById('roundfx'),{childList:true, subtree:true});
    /* THE SPEED BUMP IS THE CROSSED BOARD HELD ON SCREEN: your turn, the Fight Sub-Phase, the move not yet landed,
       with "Hold on" up. The old hold painted exactly that for ~700ms; landing at once never paints it at all. */
    new MutationObserver(()=>{ const st=window.__solo.st(), h=(document.getElementById('hint')||{}).textContent||'', hand=st.players[0].hand.map(c=>c.id);
      if(/Hold on/.test(h) && st.turn===0 && st.subPhase==='play' && window.__held.every(id=>hand.indexOf(id)>=0)) window.__holds.push(h.slice(0,40)); })
      .observe(document.getElementById('hint'),{childList:true, characterData:true, subtree:true}); });
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
    window.__solo.render(); window.__banners=0; window.__holds=[]; window.__flash0=window.__solo.fightFlashes().length; }, [withPile, rivalQuick, myQuick]);
  // let any ceremony from the previous leg finish — a press while `busy` is swallowed silently
  async function settle(){ const t0=Date.now(); while(Date.now()-t0<20000){
      const quiet=await p.evaluate(()=>{ const fx=document.getElementById('roundfx'), h=(document.getElementById('hint')||{}).textContent||'';
        const d=document.getElementById('respDecline'); if(d && d.offsetParent!==null && !d.disabled){ d.click(); return false; }   // a boundary window ON mode shows — answer it, or the board waits on us forever
        const strip=(document.getElementById('handWrap')||{}).className||'';
        return !(fx && /show/.test(fx.className)) && !/Hold on|fighting/.test(h) && window.__solo.st().turn===0 && !/spResolve|spCleanup|spBegin/.test(strip); });
      if(quiet) return true; await wait(150); }
    const why=await p.evaluate(()=>{ const st=window.__solo.st(), fx=document.getElementById('roundfx');
      return 'turn='+st.turn+' sub='+st.subPhase+' fin='+st.finished+' resp='+st.respondFor+' strip='+((document.getElementById('handWrap')||{}).className||'')+
             ' fx="'+(fx?fx.className:'')+'" hint="'+((document.getElementById('hint')||{}).textContent||'').slice(0,80)+'"'; });
    console.log('   ⏱ settle TIMED OUT  '+why); return false; }
  const selectPair=()=>p.evaluate(()=>{ ['a9','b9'].forEach(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) c.click(); }); });
  // the flashes since the leg staged — the log is capped at 20, so count from the tail rather than an index
  const flashes=()=>p.evaluate(()=>{ const all=window.__solo.fightFlashes(); return all.filter(f=>f.at>=window.__stagedAt); });
  const press=(sel, held)=>p.evaluate(([sel,held])=>{ window.__held=held; window.__stagedAt=Date.now(); document.getElementById(sel).click(); }, [sel, held]);
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
  // one leg's verdict: exactly one flash, on your turn with `held` still in hand, no banner, the move landed — and,
  // where nobody could answer, no pause
  async function judge(name, held, landed, quiet){
    const fs=await flashes(), f0=fs[0]||{}, banners=await p.evaluate(()=>window.__banners), holds=await p.evaluate(()=>window.__holds.slice());
    ok(fs.length===1, name+': the crossing FLASHED THE STRIP EXACTLY ONCE ('+fs.length+')'+(fs.length>1?' ← the Rival\'s crossing flashed yours too':'')+(fs.length===0?' ← an invisible Fight Sub-Phase':''));
    ok(fs.length>0 && f0.turn===0 && held.every(id=>(f0.hand||[]).indexOf(id)>=0), name+': …on your turn, the cards still in hand — the crossing came first  [hand '+(f0.hand||[]).join(',')+']');
    ok(banners===0, name+': …and NO banner — the Fight Sub-Phase is a flash, not an announcement  ['+banners+']');
    if(quiet) ok(holds.length===0, name+': …and NO PAUSE — the board never said "Hold on" with your cards still in hand'+(holds.length?'  ← the speed bump: '+holds.join(' | '):''));
    ok(landed, name+': …and then the move went through');
  }

  // ---- leg 1: a quiet crossing — nobody can add to the stack, so it auto-advances inside one engine call
  await settle(); await stage(false); await wait(400);
  let ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  await selectPair(); await wait(250);
  ok(/^Fight$/.test(await p.evaluate(()=>(document.getElementById('fightBtn').textContent||'').trim())), 'STAGED: a pair selected in Main, the button reads Fight');
  await press('fightBtn', ['a9','b9']);
  await runOut(8000);
  ok(/nobody could add/.test(await ledgerSince(ledN)), 'STAGED: the crossing was QUIET  ['+(await ledgerSince(ledN)).slice(0,120)+']');
  await judge('quiet', ['a9','b9'], await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9')), true);

  // ---- leg 2: the crossing OPENS A WINDOW — the Rival holds Leyline, so it may answer at Main → Fight and lets it through
  await settle(); await stage(false, true); await wait(400);
  ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  await selectPair(); await wait(250);
  await press('fightBtn', ['a9','b9']);
  await runOut(10000);
  const cross2=await ledgerSince(ledN);
  ok(cross2 && !/nobody could add/.test(cross2), 'STAGED: the crossing really OPENED a window — the Rival could answer  ['+cross2.slice(0,120)+']');
  await judge('rival window', ['a9','b9'], await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9')), false);

  // ---- leg 3: YOU hold the Quick. The go-round starts at the controller (epic step 6), so the crossing offers
  // priority to you first; declining it closes the go-round, and the board renders in Fight before the play
  await settle(); await stage(false, false, true); await wait(400);
  await p.evaluate(()=>window.__solo.setPromptMode && window.__solo.setPromptMode('on'));
  ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  await selectPair(); await wait(250);
  await press('fightBtn', ['a9','b9']);
  await runOut(10000);
  await p.evaluate(()=>window.__solo.setPromptMode && window.__solo.setPromptMode('auto'));
  console.log('   leg 3 ledger: '+(await ledgerSince(ledN)).slice(0,200));
  await judge('your window', ['a9','b9'], await p.evaluate(()=>!window.__solo.st().players[0].hand.some(c=>c.id==='a9')), false);

  // ---- leg 4: Pass crosses too — from Main one press crosses into the Fight Sub-Phase and then sits out
  await settle(); await stage(true); await wait(400);
  ledN=await p.evaluate(()=>window.__solo.prioLog().length);
  ok(await p.evaluate(()=>{ const b=document.getElementById('passBtn'); return !!b && b.offsetParent!==null && !b.disabled; }), 'STAGED: following a 5, Pass is live in Main');
  await press('passBtn', []);   // a pass plays nothing, so nothing is "held"; the crossed board is the bump
  await runOut(8000);
  ok(/\[Pass\]/.test(await ledgerSince(ledN)), 'STAGED: the ledger records a crossing opened by Pass  ['+(await ledgerSince(ledN)).slice(0,120)+']');
  const fs4=await flashes(), holds4=await p.evaluate(()=>window.__holds.slice());
  ok(fs4.length===1 && fs4[0].turn===0, 'pass: the crossing FLASHED THE STRIP EXACTLY ONCE, on your turn, before the pass handed it on ('+fs4.length+')');
  ok(holds4.length===0 && (await p.evaluate(()=>window.__banners))===0, 'pass: …with no banner and NO PAUSE'+(holds4.length?'  ← '+holds4.join(' | '):''));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
