/* REDUCED MOTION MUST CHANGE WHAT IS ANIMATED, NEVER WHAT IS COUNTED (v1.31.98).
 * `shieldsLost` was tallied inside `animateShields`' `if(prev!=null && !reduceMotion())` branch, beside the
 * shatter — so a player with reduced motion on exported every game with `shieldsLost: 0`, for EVERY seat,
 * solo included. That field feeds docs/CARD-STATS.md and the PLAYER-PROFILE ingestion log, so the games most
 * worth reading were the ones silently blank.
 * The tally is driven from the RENDER DIFF, which is what makes it seat-agnostic (it never asks who acted —
 * the one stat the v1.31.96 remote-seat bug did not touch). So it is hoisted above the motion guard rather
 * than moved to an action site, and this suite pins that: the SAME shield drop must count under both settings.
 * Run: node motiontest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// Drop a seat's shields by one and re-render, so animateShields sees n < prev — the exact path the tally lives on.
async function dropAShield(p, seat){
  return p.evaluate((s)=>{
    const st=window.__solo.st(); if(!st||!st.players||!st.players[s]) return null;
    const before=(window.__solo.stats().seats[s]||{}).shieldsLost;
    window.__solo.render();                                   // establish prevShields at the current count
    st.players[s].shields = Math.max(0, st.players[s].shields-1);
    window.__solo.render();                                   // now n < prev
    return { before, after:(window.__solo.stats().seats[s]||{}).shieldsLost };
  }, seat);
}

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const errs=[];

  for(const mode of ['reduce','no-preference']){
    const ctx=await b.newContext({viewport:{width:1100,height:820}, reducedMotion:mode});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(mode+': '+e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1100);

    /* NOT VACUOUS: if the emulation does not reach the page, both arms are the same arm and the suite proves
     * nothing. Assert the page's OWN reduceMotion() reading, not the flag we passed Playwright. */
    const sees = await p.evaluate(()=>window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    ok(sees===(mode==='reduce'), 'the page itself reports prefers-reduced-motion='+sees+' under "'+mode+'"');

    const r = await dropAShield(p, 0);
    ok(!!r, 'a shield drop was staged under "'+mode+'"');
    ok(!!r && r.after === r.before+1,
       'the shield loss is COUNTED under "'+mode+'" ('+(r?r.before+' → '+r.after:'?')+')'+
       (r && r.after===r.before ? '  ← REPRODUCED: the tally sits behind the motion guard' : ''));
    await ctx.close();
  }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
