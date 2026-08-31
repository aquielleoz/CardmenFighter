/* The "Energy & Effects" tutorial lesson (Basics #5). Two GATED steps — one on leading a jab, one on activating
 * an effect — so a rig that leaves you with nothing activatable is a silent dead end. This is also the lesson
 * the 2026-08-31 rig audit leaned on: `tutRig`'s A♣ is missing ~8% of deals (it can be behind a shield) and the
 * lesson survives only because `tutPickEffect` searches hand+deck and `tutEnsureEffect` tops up energy until the
 * card it found is affordable. That conclusion is what this asserts. Run: node lessontest_energy.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('energy');
  const { p, ok, until, step, at, next, playAny, activateSpot } = L;

  ok((await at()||{}).n===6,'6 steps');
  await next();
  ok((await at()||{}).i===2,'step 2 is the "lead a jab" step');
  ok(!(await step()).hasNext,'…gated on a real play, no Next');

  const nrgBefore=await p.evaluate(()=>window.__solo.st().players[0].energy.length);
  ok(await playAny(false)!==null,'a legal jab was available and played');
  ok(await L.atStep(3),'leading a jab advanced the lesson to step 3');
  /* The lesson's actual claim — "every card you fight banks into your energy pile". Asserted, because a step
   * that says "see the ⚡ box pulse with a +N" is a lie if it did not. */
  ok(await until(n=>window.__solo.st().players[0].energy.length>n,'energy grows',9000,nrgBefore),
    '…and the card really banked into your energy pile, as step 3 claims');

  await next();
  ok(await L.atStep(4),'step 4 is the activate step');
  /* THE AUDIT'S CONCLUSION, AS A TEST. `tutEnsureEffect` must leave a spotlit card that is actually affordable —
   * it searches hand+deck (so A♣ being shielded is survivable) and tops up energy until it can be paid for. If
   * either half stops working the step cannot be satisfied and the lesson dead-ends. */
  /* NOT `spots>0` — this step also spotlights `#ctxBtn` and `#cardActivate`, so that count is satisfied even
   * when `tutEffId` is null and the highlight falls back to the whole `#hand`. Require the CARD. */
  const spotlit=await until(()=>!!document.querySelector('#hand .card.tut-spot'),'a CARD is spotlit');
  if(!spotlit) console.log('   WHY: hand itself spotlit='+await p.evaluate(()=>!!document.querySelector('#hand.tut-spot'))
    +' spots='+await p.evaluate(()=>document.querySelectorAll('.tut-spot').length)
    +' | '+await p.evaluate(()=>[].map.call(document.querySelectorAll('.tut-spot'),e=>e.id||e.className).join(',')));
  ok(spotlit,'a card is spotlit for you to activate — tutPickEffect found one');
  ok(await p.evaluate(()=>{ const E=window.CardmenEngine, me=window.__solo.st().players[0];
      const c=document.querySelector('#hand .card.tut-spot'); if(!c) return false;
      const card=me.hand.filter(x=>x.id===c.dataset.id)[0]; return !!card && E.canAfford(me,card,0); }),
    '…and it is affordable — tutEnsureEffect topped the energy up');

  const shufBefore=await p.evaluate(()=>window.__solo.st().players[0].shuffle.length);
  const why=await activateSpot();
  ok(why===null,'the ⚡ Activate control was offered and fired'+(why?' — '+why:''));
  ok(await L.atStep(5),'activating advanced the lesson to step 5');
  /* Step 6's claim: spent energy moves to the shuffle pile. */
  ok(await until(n=>window.__solo.st().players[0].shuffle.length>n,'spent energy reaches the shuffle pile',9000,shufBefore),
    '…and the spent energy really moved to your shuffle pile');

  await next(); ok(await L.atStep(6),'step 6 (the shuffle pile) is reachable');
  await next();
  await L.finish('energy');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
