/* AN OPPONENT'S EFFECTS MUST BE SEEN BEFORE THE ROUND ENDS ON TOP OF THEM (v1.31.106).
 *
 * Aj, from real play: *"the enemy played caltrops then passed. i didn't get to see his actions because the
 * round end and round begin animations started to fire off"*. The duel driver's round-ending-pass path
 * (`finishStep`) hand-rolled two `logMsg` lines and went straight to `announceRoundWin`, so the cast was
 * logged and buried in the same frame — while `buildOppBeats`, with its `revealEffect` and `revealDwell`,
 * sat in the OTHER arm of the same `if` and never ran.
 *
 * WHY THIS SUITE EXISTS AND `nettest_*` DOES NOT COVER IT: the bug is in the SOLO duel driver, and the log
 * LINE was always there — only its timing and its wording were wrong. **So assert the ORDER, never the
 * presence.** A suite that greps the log for "played a Technique" is green on the broken build; that is
 * precisely why nothing caught this for as long as it existed.
 *
 * Run: node oppbeatstest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { selectAndFight, clickFight } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* Stage the one turn that reaches the bug: YOU lead the apex 2 (unbeatable, and legal in round 1 where only
   jabs are), so the Rival cannot fight and must pass — and a duel pass against a lead RESOLVES the round.
   It holds A♦ Gather Energy and the fuel to cast it, which measured 8/8 across fresh deals. */
const stage = p => p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
  st.players[0].hand=[mk(2,'S','y0'),mk(5,'H','y1'),mk(6,'C','y2')];
  st.players[1].hand=[mk(1,'D','r0'),mk(3,'C','r1'),mk(4,'H','r2')];
  st.players[1].energy=[mk(9,'D','e1'),mk(8,'D','e2'),mk(7,'D','e3'),mk(6,'D','e4'),mk(5,'D','e5')];
  window.__solo.render(); });

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);
  await p.evaluate(()=>document.getElementById('logToggle').click()); await wait(200);
  await stage(p);

  /* THE PERSONA NAME HAS TO EXIST, or the naming assertions below are vacuous — a duel with no persona is
     CORRECTLY allowed to say "Rival", so a run without one would pass on the broken build too. */
  const rival = await p.evaluate(()=>window.__solo.persona(1)||'');
  ok(!!rival && rival!=='Rival', `the Rival drew a persona name to be called by ("${rival||'none'}")`);

  // lead the 2, then WATCH — poll fast enough to time the log rather than just read it at the end
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')]
    .filter(el=>el.querySelector('.card[data-id="y0"]'))[0]; if(g) g.click(); }); await wait(250);
  const t0 = Date.now();
  await clickFight(p);   // two-state button (epic step 20) — see fightclick.js

  /* Record WHEN each line first appears, and whether the card reader ever lit up. `revealEffect` adds
     `.reveal` to #cardView and pops #artFlash; both are transient, so they are sampled, not read at the end. */
  const seen={}; let sawReveal=false;
  for(let i=0;i<180;i++){
    const s = await p.evaluate(()=>({
      log:[...document.querySelectorAll('#log .le')].map(e=>e.textContent.trim()),
      reveal:!!document.querySelector('#cardView.reveal') || !!document.querySelector('#artFlash.show') }));
    if(s.reveal) sawReveal=true;
    s.log.forEach(t=>{
      if(seen.eff==null && /played an? (Technique|Equipment|Ride|Form)/i.test(t)) seen.eff=Date.now()-t0;
      if(seen.pass==null && /\bpassed\.$/.test(t)) seen.pass=Date.now()-t0;
      if(seen.round==null && /won the round|lost a shield|won with a/i.test(t)) seen.round=Date.now()-t0;
    });
    if(seen.round!=null) break;
    await wait(40);
  }

  ok(seen.eff!=null, `STAGED: the Rival cast an effect before its round-ending pass (at ${seen.eff}ms)`);
  ok(seen.round!=null, `  → and the pass really did resolve the round (at ${seen.round}ms)`);

  /* THE BUG, AND THE ONLY ASSERTION THAT DISCRIMINATES. On the broken build the cast, the pass and the round
     announcement were all logged in ONE frame — measured at a 0ms gap — so the player never saw the card.
     `revealDwell` is 2650ms with effect text and 1200 under reduced motion, and the pass beat adds 950; the
     floor is set at 800 so it cannot pass on a same-frame build at ANY motion setting, while leaving room for
     a slow machine to be slow rather than red. */
  const gap = (seen.eff!=null && seen.round!=null) ? seen.round-seen.eff : -1;
  ok(gap>=800, `the effect is SHOWN before the round resolves on top of it (${gap}ms between them, floor 800)`);
  ok(sawReveal, '  → and the card reader actually lit up for it (revealEffect ran, not just a log line)');

  /* THE NAMING HALF. `finishStep` hardcoded "Rival" while every other line goes through `logName`, which
     returns the persona name — so one log named the same opponent two ways in a single round, and 9 of 26
     opponent lines in Aj's log 3 read "Rival". A scan is cheaper than re-reading every template. */
  const lines = await p.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent.trim()));
  const wrong = lines.filter(t=>/\bRival\b/.test(t));
  ok(wrong.length===0, `no log line calls the opponent "Rival" when it has a name${wrong.length?': '+JSON.stringify(wrong.slice(0,3)):''}`);
  ok(lines.some(t=>t.indexOf(rival)>=0), `  → they use "${rival}" instead (not vacuous: the log does name it)`);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
