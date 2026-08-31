/* The "Zones of Play" tutorial lesson (Basics #2). It has no gates — it is a five-step spotlight tour — so the
 * only thing that can silently break it is a SELECTOR that stops matching: `applySpot` does
 * `querySelectorAll(sel)` and adds `.tut-spot` to whatever it finds, so a renamed or restructured id highlights
 * NOTHING and the tour still clicks happily to the end. That is the whole point of this suite: every step's
 * spotlight must land on a real element. Run: node lessontest_zones.js */
const { openLesson } = require('./lessonlib');
const TARGETS=[['#hand','your hand'],['#handMeta .stat.deck','the deck counter'],['#pile','the play area'],
               ['#youNrgSuits','the energy pile'],['#youShuf','the shuffle pile']];
(async()=>{
  const L=await openLesson('zones');
  const { p, ok, until, step, at, next } = L;
  ok((await at()||{}).n===TARGETS.length,TARGETS.length+' steps');
  for(let i=0;i<TARGETS.length;i++){
    const [sel,what]=TARGETS[i];
    ok(await L.atStep(i+1),'step '+(i+1)+' ('+what+') is reachable');
    /* Both halves: the element the step names must EXIST, and it must actually be carrying the spotlight. The
     * first alone passes if `applySpot` silently stopped working; the second alone passes if some other step's
     * target is lit. */
    ok(await p.evaluate(s=>!!document.querySelector(s),sel),'…'+sel+' exists');
    ok(await until(s=>{ const e=document.querySelector(s); return !!e && e.classList.contains('tut-spot'); },
      'the spotlight reaches '+sel, 6000, sel), '…and the spotlight is on it');
    if(i<TARGETS.length-1) await next();
  }
  await next();
  await L.finish('zones');
  await L.done();
})().catch(e=>{console.error('ERR',e);process.exit(2);});
