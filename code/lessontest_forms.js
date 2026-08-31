/* The "Forms" tutorial lesson (Advanced). Its second step is GATED on actually transforming — `t==='activate'
 * && d.kind==='transform'` — so if the rig fails to put a Q in hand, or the transform tier is not open, the
 * step never advances and the lesson dead-ends with no error (the Quicks failure mode, v1.31.73).
 * The 2026-08-31 rig audit found this rig safe BECAUSE `tutPull(pool,12,'C') || tutPull(pool,12)` falls back
 * to ANY Q when the club one is behind a shield. This turns that measurement into a test.
 * Run: node lessontest_forms.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('forms');
  const { p, ok, until, step, at, next, activateSpot } = L;

  ok((await at()||{}).n===4,'4 steps');
  /* THE AUDIT'S CONCLUSION AS A TEST: the rig's fallback must deliver a Q whichever one is shielded. */
  ok(await p.evaluate(()=>window.__solo.st().players[0].hand.some(c=>c.rank===12)),
    'the rig delivered a Q to your hand (the "|| any Q" fallback)');

  await next();
  ok((await at()||{}).i===2,'step 2 is the transform step');
  ok(!(await step()).hasNext,'…gated on a real transform, no Next');
  const spotlit=await until(()=>!!document.querySelector('#hand .card.tut-spot'),'the Q is spotlit');
  if(!spotlit) console.log('   WHY: spots='+await p.evaluate(()=>[].map.call(document.querySelectorAll('.tut-spot'),e=>e.id||e.className).join(',')));
  ok(spotlit,'the Q is spotlit for you to activate');
  ok(await p.evaluate(()=>{ const c=document.querySelector('#hand .card.tut-spot');
      return !!c && (window.__solo.st().players[0].hand.filter(x=>x.id===c.dataset.id)[0]||{}).rank===12; }),
    '…and the spotlit card really is the Q, not something else');

  const why=await activateSpot();
  ok(why===null,'the ⚡ Activate control was offered and fired'+(why?' — '+why:''));
  ok(await L.atStep(3),'transforming advanced the lesson to step 3');
  /* The step says the Forms now sits in the zone. Assert the ENGINE agrees — the gate only checks that an
   * activate happened, so "it is in the zone" is a separate and real question. */
  /* The tier for a Q is `'queen'`, NOT `'form'` — the engine's tiers are ride / queen / king / super, and
   * "Form" is the player-facing word for the Q and K tiers together. Asserting `'form'` fails on a working
   * build, which is exactly what it did on the first run of this suite. */
  ok(await until(()=>window.__solo.st().players[0].forms.some(f=>f.tier==='queen'),"the zone gains the 'queen' tier"),
    "…and the engine really holds a 'queen' tier in your zone, as the step claims");

  await next(); ok(await L.atStep(4),'step 4 is reachable');
  await next();
  await L.finish('forms');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
