/* The "Rides" tutorial lesson (Advanced). Its second step is GATED on actually transforming — `t==='activate'
 * && d.kind==='transform'` — so if the rig fails to put a J in hand, or the transform tier is not open, the
 * step never advances and the lesson dead-ends with no error (the Quicks failure mode, v1.31.73).
 * The 2026-08-31 rig audit found this rig safe BECAUSE `tutPull(pool,11,'C') || tutPull(pool,11)` falls back
 * to ANY J when the club one is behind a shield. This turns that measurement into a test.
 * Run: node lessontest_rides.js */
const { openLesson } = require('./lessonlib');
(async()=>{
  const L=await openLesson('rides');
  const { p, ok, until, step, at, next, activateSpot } = L;

  ok((await at()||{}).n===4,'4 steps');
  /* THE AUDIT'S CONCLUSION AS A TEST: the rig's fallback must deliver a J whichever one is shielded. */
  ok(await p.evaluate(()=>window.__solo.st().players[0].hand.some(c=>c.rank===11)),
    'the rig delivered a J to your hand (the "|| any J" fallback)');

  await next();
  ok((await at()||{}).i===2,'step 2 is the transform step');
  ok(!(await step()).hasNext,'…gated on a real transform, no Next');
  const spotlit=await until(()=>!!document.querySelector('#hand .card.tut-spot'),'the J is spotlit');
  if(!spotlit) console.log('   WHY: spots='+await p.evaluate(()=>[].map.call(document.querySelectorAll('.tut-spot'),e=>e.id||e.className).join(',')));
  ok(spotlit,'the J is spotlit for you to activate');
  ok(await p.evaluate(()=>{ const c=document.querySelector('#hand .card.tut-spot');
      return !!c && (window.__solo.st().players[0].hand.filter(x=>x.id===c.dataset.id)[0]||{}).rank===11; }),
    '…and the spotlit card really is the J, not something else');

  const why=await activateSpot();
  ok(why===null,'the ⚡ Activate control was offered and fired'+(why?' — '+why:''));
  ok(await L.atStep(3),'transforming advanced the lesson to step 3');
  /* The step says the Rides now sits in the zone. Assert the ENGINE agrees — the gate only checks that an
   * activate happened, so "it is in the zone" is a separate and real question. */
  ok(await until(()=>window.__solo.st().players[0].forms.some(f=>f.tier==='ride'),'the zone gains the ride'),
    "…and the engine really holds a 'ride' in your zone, as the step claims");

  await next(); ok(await L.atStep(4),'step 4 is reachable');
  await next();
  await L.finish('rides');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
