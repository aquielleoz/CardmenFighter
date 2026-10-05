/* ROAR ON THE HOST/SOLO ROUND CEREMONY (roar-never-announced, v1.32.2).
 *
 * Aj, live solo 3-player game vs AIs, 2026-10-02: *"no roar…"* — every seat on 3 of 4, the Ride tier open
 * (`transformGateStatus` ok, 3 of 3), Vyers riding a J, and the banner that announces it never shown.
 *
 * MECHANISM, measured with trace lines before any fix: the tier check is a DEBT (`thresholdOwed`) incurred
 * when a shield drop is seen while the ceremony holds the shatter, and it was only ever paid by a RENDER.
 * The ceremony lifts the hold with `revealShields()` and reaches `flushThreshold` through a Clean-up beat
 * that only REPAINTS — so the flush found the debt unpaid and nothing queued. At 3 players the drop always
 * arrives with the hold up; in a duel it was seen one render earlier, which is why the duel worked and why
 * the first probe (a duel) reported nothing. THE SEAT COUNT WAS THE DISCRIMINATOR, again.
 *
 * Three cases, one staging shape each: the duel (the CONTROL — it worked before the fix and must keep
 * working), a 3-player round YOU win (through the confirm-first shield pick), and one an AI wins.
 * Each asserts the banner SHOWS, shows INSIDE the ceremony (before the next round's banner — a ROAR a round
 * late is the other half of the bug), never overlaps the round banner, and fires exactly ONCE.
 *
 * Run: node roartest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { selectAndFight } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  async function runCase(MODE){
    const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    if(MODE!=='duel'){ await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await wait(350); }
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);
    /* The table sits ONE shield short of the Ride line (`numPlayers x 1` lost), nobody holds energy (so no
       effect can intervene), and the opponents hold only cards that cannot answer what is led. */
    await p.evaluate((MODE)=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.round=3; st.turn=0; st.pile=null; st.passes=0; st.subPhase='main';
      st.players.forEach(pl=>{ pl.energy=[]; });
      if(MODE==='duel'){ st.players[0].shields=3; st.players[1].shields=4;
        st.players[0].hand=[mk(9,'C','a9'),mk(9,'H','b9'),mk(4,'D','x4')]; st.players[1].hand=[mk(3,'H','r3'),mk(5,'S','r5')]; }
      else if(MODE==='3p-you'){ st.players[0].shields=3; st.players[1].shields=3; st.players[2].shields=4;
        st.players[0].hand=[mk(9,'C','a9'),mk(9,'H','b9'),mk(4,'D','x4')]; st.players[1].hand=[mk(3,'H','r3'),mk(5,'S','r5')]; st.players[2].hand=[mk(3,'S','s3'),mk(6,'S','s6')]; }
      else { st.players[0].shields=3; st.players[1].shields=3; st.players[2].shields=4;   // you jab low, seat 1 takes it, then leads a pair nobody answers
        st.players[0].hand=[mk(3,'C','a3'),mk(4,'D','x4')]; st.players[1].hand=[mk(10,'H','r10'),mk(7,'H','r7a'),mk(7,'S','r7b')]; st.players[2].hand=[mk(3,'S','s3'),mk(4,'S','s4')]; }
      window.__solo.render(); }, MODE);
    await wait(500);
    const gate0=await p.evaluate(()=>window.CardmenEngine.transformGateStatus(window.__solo.st(),0,'ride'));
    ok(gate0 && !gate0.ok, '['+MODE+'] STAGED: the Ride tier is shut before the round ('+gate0.have+'/'+gate0.need+')');

    if(MODE==='3p-ai') await selectAndFight(p, ['a3']); else await selectAndFight(p, ['a9','b9']);
    // answer whatever the human is asked: the shield pick (aim seat 2, Confirm), a lead to pass on, a window to decline
    const tapper=setInterval(()=>{ p.evaluate(()=>{
        const el=document.querySelector('.oppPanel.targetable'), f=document.getElementById('fightBtn');
        if(el && !document.querySelector('.oppPanel.aimed')){ (document.querySelector('.oppPanel.targetable[data-seat="2"]')||el).click(); return; }
        if(f && /Confirm/.test(f.textContent) && !f.disabled){ f.click(); return; }
        const d=document.getElementById('respDecline'); if(d && d.offsetParent){ d.click(); return; }
        const ps=document.getElementById('passBtn'), st=window.__solo.st();
        if(st.turn===0 && st.pile && ps && !ps.disabled) ps.click();
      }).catch(()=>{}); }, 300);

    const film=[]; const t0=Date.now(); let gateAt=null;
    while(Date.now()-t0<25000){
      const s=await p.evaluate(()=>{ const fx=document.getElementById('thresholdfx'), rf=document.getElementById('roundfx'), st=window.__solo.st();
        const rr=rf&&rf.querySelector('.rfRound');
        return { roar:!!(fx&&/show/.test(fx.className)&&/ROAR/.test(fx.textContent||'')),
                 rbanner:!!(rf&&/show/.test(rf.className)&&rr&&/Round/i.test(rr.textContent||'')),
                 banner:!!(rf&&/show/.test(rf.className)&&rf.querySelector('.rfBeat, .rfRound')),
                 gate:window.CardmenEngine.transformGateStatus(st,0,'ride').ok }; });
      s.t=Date.now()-t0; film.push(s);
      if(s.gate && gateAt==null) gateAt=s.t;
      if(gateAt!=null && s.t-gateAt>9000) break;                    // well past any ceremony
      await wait(70);
    }
    clearInterval(tapper);
    const gateOpen=film.some(f=>f.gate);
    ok(gateOpen, '['+MODE+'] the shield fell and the Ride gate OPENED (if not, nothing below means anything)');
    // the NEXT round's banner after the strip — a ROAR after it is a round late (the staging may play a jab round first)
    const firstRoar=film.findIndex(f=>f.roar), firstR4=film.findIndex(f=>f.rbanner && gateAt!=null && f.t>=gateAt);
    ok(firstRoar>=0, '['+MODE+'] the ROAR banner was shown'+(firstRoar>=0?'':' ← REPRODUCED: the tier unlocked and nobody was told'));
    ok(firstRoar>=0 && (firstR4<0 || firstRoar<firstR4), '['+MODE+'] …INSIDE the ceremony, before the next round banner (roar @'+(firstRoar>=0?film[firstRoar].t:'—')+'ms, next round @'+(firstR4>=0?film[firstR4].t:'—')+'ms)');
    ok(!film.some(f=>f.roar&&f.banner), '['+MODE+'] …and never on top of the round banner');
    let edges=0; for(let i=0;i<film.length;i++) if(film[i].roar && !(i>0&&film[i-1].roar)) edges++;
    ok(edges===1, '['+MODE+'] …exactly once ('+edges+')');
    ok(errs.length===0, '['+MODE+'] no JS errors'+(errs.length?': '+errs.join(' | '):''));
    await p.context().close();
  }

  for(const m of ['duel','3p-you','3p-ai']) await runCase(m);
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
