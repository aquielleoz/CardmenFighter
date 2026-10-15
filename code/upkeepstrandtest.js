/* A WINDOW OWED TO THE RIVAL MUST NOT SURVIVE THE ROUND CEREMONY (solo-upkeep-window-stranded, 2026-10-15).
 *
 * Found as `browsertest` timing out at 300s in two full sweeps in one day. A load probe caught five dumps of one
 * shape: a new round has begun and it is your turn, but `st.upkeep` is open with priority on the Rival, so every
 * move is refused ("The round is over — the next one is about to begin.") and nothing ever drains it. The ledger
 * read `parked[upkeep,+parkedResult] prio=<Rival>` from the ceremony's very first beat. It predates drag-and-stack:
 * the same probe wedged the epic as it stood after step 2.
 * WHY: the ceremony's boundary drain (`boundaryThen`) returned as soon as the round was STAMPED, and the round is
 * stamped in the Beginning Phase's untap queue — BEFORE the Upkeep window parks. So a parked Upkeep went undrained,
 * the draw ran over it, and the board went to you.
 *
 * STAGED, BECAUSE THE NATURAL TRIGGER IS RARE (about 2 duels in 100, under load) and was not found by brute force
 * over 384 staged Rival hands. The ENGINE STATE is what the dumps show, so the suite produces exactly that state:
 * a real round end (you lead a King, the Rival cannot answer and passes), and the call that ends it leaves Upkeep
 * parked with the Rival on priority and the round stamped. Everything after that is the real ceremony.
 * Claims, each a pair:
 *   A  CONTROL — the same round with nothing parked runs as it always did, and no floor line is written.
 *   B  WITH UPKEEP PARKED the ceremony answers it BEFORE the draw (the spec: Untap → Upkeep → Draw), the round
 *      advances and the board comes back to you live; the hand-back floor never has to fire.
 * A/B by mutant: with the root fix removed, the draw runs over an open Upkeep and the floor catches it (its line is
 * the tell); with both removed, the board stays dead.
 *
 * Run: node upkeepstrandtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;}; const errs=[];
  const leg=async(inject)=>{
    const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350); await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
    await p.evaluate((inject)=>{ const E=window.CardmenEngine, st0=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      window.__drawSawUpkeep=null; window.__injected=false;
      const draw=E.roundDraw; E.roundDraw=function(st){ if(window.__drawSawUpkeep===null) window.__drawSawUpkeep=!!st.upkeep; return draw.apply(this, arguments); };
      const pass=E.pass; E.pass=function(st, q){ const r=pass.apply(this, arguments);
        /* the dumped state, after a REAL round end: stamped, no Resolution go-round, Upkeep parked, the Rival on priority */
        if(inject && !window.__injected && q===1 && r && r.roundWinner===0 && r.newRound!=null && !st.upkeep && st.respondFor==null){
          window.__injected=true; st.upkeep={ origin:0 }; st.prioPassed={}; st.respondFor=1; st.upkeepResult=r; }
        return r; };
      st0.respondFor=null; st0.pending=null; st0.stack=[]; st0.round=6; st0.turn=0; st0.initiative=0; st0.subPhase='main'; st0.pile=null; st0.lastPlayer=null; st0.passes=0;
      st0.players[0].hand=[mk(13,'S','yK'),mk(4,'S','y4'),mk(5,'H','y5')]; st0.players[0].energy=[];
      st0.players[1].hand=[mk(3,'H','r3'),mk(4,'H','r4')]; st0.players[1].energy=[];
      window.__solo.render(); }, inject);
    await wait(400);
    await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="yK"]'))[0]; if(g) g.click(); }); await wait(200);
    await p.evaluate(()=>document.getElementById('fightBtn').click());
    /* the round ends on the Rival's pass, the ceremony runs, and the board must come back LIVE: your turn in the
       new round, nothing owed to anybody, and a selected card can fight */
    let s=null; for(let i=0;i<120;i++){ s=await p.evaluate(()=>{ const st=window.__solo.st(); return { round:st.round, turn:st.turn, rf:st.respondFor, upkeep:!!st.upkeep, injected:window.__injected, drawSawUpkeep:window.__drawSawUpkeep, hint:(document.getElementById('hint').textContent||'').trim() }; });
      if(s.round===7 && s.turn===0 && s.rf==null && !s.upkeep && s.drawSawUpkeep!==null) break; await wait(150); }
    let live=false; for(let i=0;i<60 && !live;i++){ await wait(150);   // the Round card still holds the board for a beat
      live=await p.evaluate(()=>{ const c=[...document.querySelectorAll('#hand .group')][0]; if(!c) return false; c.click();
        const f=document.getElementById('fightBtn'); const on=!!f && !f.disabled; c.click(); return on; }); }
    const ledger=await p.evaluate(()=>window.__solo.prioLog());
    await p.close();
    return { s, live, floor:ledger.some(l=>/WAS STILL OPEN AT THE HAND-BACK/.test(l)), waited:ledger.some(l=>/ceremony WAITING for the round boundary/.test(l)) };
  };

  const a=await leg(false);
  ok(a.s.round===7 && a.s.turn===0 && a.s.rf==null && a.live, 'A · CONTROL: a round with nothing parked ends, the new one starts, your board is live  ['+JSON.stringify(a.s)+']');
  ok(!a.floor && a.s.drawSawUpkeep===false, '  …and nothing was open at the draw, and the hand-back floor stayed silent');

  const bb=await leg(true);
  ok(bb.s.injected, 'B · STAGED: the Rival\'s round-ending pass left Upkeep parked with the Rival on priority and the round stamped');
  ok(bb.s.drawSawUpkeep===false, 'B · THE CEREMONY ANSWERS THE PARKED UPKEEP BEFORE THE DRAW — the spec\'s Untap → Upkeep → Draw  [upkeep open at the draw: '+bb.s.drawSawUpkeep+']');
  ok(bb.s.round===7 && bb.s.turn===0 && bb.s.rf==null && !bb.s.upkeep && bb.live,
     'B · …and the new round starts with nothing owed and YOUR BOARD LIVE, not refusing every move  ['+JSON.stringify(bb.s)+']');
  ok(bb.waited && !bb.floor, '  …drained by the ceremony itself (its "WAITING for the round boundary" line), so the hand-back floor never fired');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
