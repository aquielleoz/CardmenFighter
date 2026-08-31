/* The "Quicks" tutorial lesson (Advanced #6) — the interactive Counter Spell demo. It is the one lesson whose
 * two halves are COUPLED: `tutRigQuicks` stocks the Rival's hand with counterable Techniques and
 * `tutCastRivalTech` searches that hand for one. Both used to carry a byte-identical copy of the "is this a
 * counterable Technique" test; v1.31.73 hoisted it to a single `tutIsTech`.
 *
 * WHY THIS SUITE EXISTS: had those copies drifted, `tutCastRivalTech` would hit its `if(!tech) return;`, no
 * Respond? window would ever open, and the lesson would sit on step 2 forever — no JS error, no failed
 * assertion, just a dead cue. Step 2's gate is `t==='respond' && d.countered`, so REACHING STEP 3 is itself the
 * proof that the rig and the show agree. That is the assertion this suite is built around; the rest is scaffold.
 * Run: node lessontest_quicks.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1200,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const step=()=>p.evaluate(()=>{const t=document.getElementById('tutPanel');
    return {n:(t.querySelector('.tutStep')||{}).textContent||'', text:(t.querySelector('.tutText')||{}).textContent||'', hasNext:!!t.querySelector('#tutNextBtn')};});
  /* RETURNS whether it actually clicked. A silent `if(b)b.click()` on a button that has not rendered yet leaves
   * the lesson on the previous step, and every later assertion then fails for a reason that has nothing to do
   * with the product — which is exactly how a throwaway diagnostic for this suite fooled me three runs deep. */
  const next=async()=>{const hit=await p.evaluate(()=>{const b=document.getElementById('tutNextBtn'); if(!b)return false; b.click(); return true;});
    if(!hit) console.log('⚠ next(): #tutNextBtn was not present — the lesson did not advance');
    return hit;};
  /* A red run must explain itself: print the refusal state rather than leaving "the window never opened" as the
   * whole report. `eligibleQuicks()` gating on affordability is the likely cause, and it is invisible otherwise. */
  const why=()=>p.evaluate(()=>{const E=window.CardmenEngine, st=window.__solo.st(), me=st.players[0];
    const cs=me.hand.filter(c=>(E.effectOf(c)||{}).name==='Counter Spell')[0];
    return 'step='+((document.querySelector('.tutStep')||{}).textContent||'?')
      +' turn='+st.turn+' pending='+!!st.pending+' respondFor='+st.respondFor
      +' | energy='+me.energy.map(c=>c.suit).join('')+' counterSpell='+(cs?('held cost'+(E.effectOf(cs).cost||'?')):'NOT IN HAND')
      +' | msg="'+((document.getElementById('message')||{}).textContent||'').slice(0,80)+'"';});
  /* poll, never a fixed wait before an assertion — and SAY SO when it gives up, or a later assertion fails on a
   * board still mid-transition and the report blames the wrong thing. */
  const until=async(fn,src,ms=6000,arg)=>{const t0=Date.now();while(Date.now()-t0<ms){if(await p.evaluate(fn,arg))return true;await p.waitForTimeout(100);}console.log('⏱ poll TIMED OUT: '+src);return false;};

  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>{const b=[].find.call(document.querySelectorAll('button'),x=>/Tutorials/.test(x.textContent)); if(b)b.click();}); await p.waitForTimeout(450);
  ok(await p.evaluate(()=>!!document.querySelector('.lessonRow[data-lesson="quicks"]')),'the hub lists a "Quicks" lesson');
  await p.evaluate(()=>document.querySelector('.lessonRow[data-lesson="quicks"]').click()); await p.waitForTimeout(1400);
  ok(/1 \/ 3/.test((await step()).n),'lesson started, 3 steps');

  /* An INDEPENDENT property, deliberately weaker than the hoisted predicate — asserting the whole predicate here
   * would just plant a third copy of it. This says the rig put SOMETHING castable in the Rival's hand; whether
   * the show can find it is settled behaviourally below. */
  ok(await p.evaluate(()=>{const E=window.CardmenEngine, foe=window.__solo.st().players[1];
      return foe.hand.filter(c=>{const e=E.effectOf(c); return e && e.impl && !e.quick && /Technique/.test(e.type||'');}).length>0;}),
    'the rig stocked the Rival with at least one non-Quick Technique');
  ok(await p.evaluate(()=>{const E=window.CardmenEngine, me=window.__solo.st().players[0];
      return me.hand.filter(c=>(E.effectOf(c)||{}).name==='Counter Spell').length>0;}),
    'step 1 put Counter Spell in your hand');
  /* GUARDS THE SHIELD SWAP. `tutPullShield` lifts the 4♦ out of the shield pile and drops a pool card in its
   * place; a swap that dropped a card instead would shrink the pile or lose a card from the deal, and the lesson
   * would still play fine. Count both. */
  ok(await p.evaluate(()=>{const st=window.__solo.st(), me=st.players[0];
      return (me.shieldPile||[]).length===me.shields;}),
    'the shield pile still matches the shield count');
  ok(await p.evaluate(()=>{const me=window.__solo.st().players[0];
      const n=me.hand.length+me.deck.length+me.energy.length+(me.shuffle||[]).length+(me.shieldPile||[]).length+(me.zone||[]).length;
      const ids=new Set(); [me.hand,me.deck,me.energy,me.shuffle||[],me.shieldPile||[],me.zone||[]].forEach(l=>l.forEach(c=>ids.add(c.id)));
      return n===52 && ids.size===52;}),
    'your 52 cards are all still accounted for, none duplicated');

  ok(await next(),'step 1 offered "Show me ▸"');   // → step 2 runs tutCastRivalTech
  const opened=await until(()=>!!document.querySelector('.respQuick'),'the Respond? window opens');
  if(!opened) console.log('   WHY: '+await why());
  ok(opened,'the Rival cast a Technique and the Respond? window opened');
  ok(await p.evaluate(()=>[].some.call(document.querySelectorAll('.respQuick'),x=>/Counter Spell/.test(x.textContent))),
    '…offering Counter Spell');
  const shufBefore=await p.evaluate(()=>window.__solo.st().players[1].shuffle.length);

  await p.evaluate(()=>{const q=[].find.call(document.querySelectorAll('.respQuick'),x=>/Counter Spell/.test(x.textContent)); if(q)q.click();});
  /* THE LOAD-BEARING ONE. Step 2's gate is `respond && d.countered`, so step 3 is unreachable unless the rig and
   * the show agreed about what a counterable Technique is. */
  ok(await until(()=>/3 \/ 3/.test((document.querySelector('.tutStep')||{}).textContent||''),'step 3 reached'),
    'countering advanced the lesson to step 3 — the rig and the show agree');
  ok(/Countered/.test((await step()).text),'step 3 is the "Countered!" payoff');
  /* POLL these two rather than riding step 3's poll. Reaching step 3 means the GATE saw `countered`; the fizzle
   * and the window teardown land a beat later, and asserting them on step 3's timing failed 1 run in ~4 — the
   * "never assert after someone else's wait" rule, self-inflicted in a brand-new suite. */
  const fizzled=await until(s=>window.__solo.st().players[1].shuffle.length>s,'the Technique reaches the shuffle pile',10000,shufBefore);
  if(!fizzled) console.log('   WHY: '+await why()+' | shuffle='+await p.evaluate(()=>window.__solo.st().players[1].shuffle.map(c=>c.id).join(',')));
  ok(fizzled,'the Technique really fizzled to the Rival\'s shuffle pile');
  const closed=await until(()=>!window.__solo.st().pending,'the response window closes',10000);
  if(!closed) console.log('   WHY: '+await why());
  ok(closed,'…and no response window is left open');

  await next(); await p.waitForTimeout(700);
  /* VISIBILITY, not textContent. Asserted the naive way (`/Lesson complete/.test(document.body.textContent)`)
   * this PASSED on a build where the lesson was stuck on step 2 forever — the string lives in the DOM whether or
   * not anything is on screen. Same trap as the rules panel's `?` notes. */
  ok(await p.evaluate(()=>{const m=document.getElementById('modal');
      return !!m && !!m.offsetParent && /Lesson complete/.test(m.textContent);}),
    'the completion modal is actually on screen');
  ok(await p.evaluate(()=>localStorage.getItem('cmf_lesson_quicks_v1')==='1'),'…and is marked done');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\nPASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
