/* SHARED HARNESS for the per-lesson tutorial suites. This is a HELPER, NOT A SUITE — do not run it directly
 * (same convention as nettest_lobby.js). It exists because seven lessons needed the same twenty lines of
 * boilerplate, and `lessontest_quicks.js` had already paid for the traps:
 *   - `next()` REPORTS when #tutNextBtn is absent. A silent `if(b)b.click()` leaves the lesson on the previous
 *     step and every later assertion then fails for a reason unrelated to the product.
 *   - every poll PRINTS on timeout, or a staging step that gave up surfaces later as an unrelated failure.
 *   - `playAny()` tries EVERY card rather than gambling on one, because a suite that plays hand[0] depends on
 *     the shuffle whether it means to or not (the root cause of three netplay suites' flakes).
 * Deliberately no assertions of its own beyond "the hub lists it" and "it started" — a shared helper that
 * asserts product behaviour makes one bug look like seven. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';

async function openLesson(id, viewport){
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:viewport||{width:1200,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0, fail=0;
  const ok=(c,m)=>{ console.log((c?'✓':'✗')+' '+m); c?pass++:fail++; return !!c; };
  const until=async(fn,src,ms=9000,arg)=>{ const t0=Date.now();
    while(Date.now()-t0<ms){ if(await p.evaluate(fn,arg)) return true; await p.waitForTimeout(80); }
    console.log('⏱ poll TIMED OUT: '+src); return false; };
  const step=()=>p.evaluate(()=>{ const t=document.getElementById('tutPanel');
    return { n:(t&&t.querySelector('.tutStep')||{}).textContent||'', text:(t&&t.querySelector('.tutText')||{}).textContent||'',
             hasNext:!!(t&&t.querySelector('#tutNextBtn')), spots:document.querySelectorAll('.tut-spot').length }; });
  const at=async()=>{ const m=/(\d+)\s*\/\s*(\d+)/.exec((await step()).n); return m?{i:+m[1],n:+m[2]}:null; };
  const next=async()=>{ const hit=await p.evaluate(()=>{ const btn=document.getElementById('tutNextBtn'); if(!btn) return false; btn.click(); return true; });
    if(!hit) console.log('⚠ next(): #tutNextBtn was not present — the lesson did not advance'); return hit; };
  const atStep=(k)=>until(i=>{ const m=/(\d+)\s*\/\s*(\d+)/.exec((document.querySelector('.tutStep')||{}).textContent||''); return !!m && +m[1]>=i; }, 'reach step '+k, 12000, k);
  const st=()=>p.evaluate(()=>window.__solo.st());
  /* Clear any selection. `clearBtn` alone is not enough — it can be disabled — so click every selected group
   * too. A leftover selection stages a FIGHT and makes unrelated controls read as dead. */
  const deselect=()=>p.evaluate(()=>{ const c=document.getElementById('clearBtn'); if(c && !c.disabled) c.click();
    document.querySelectorAll('#hand .group.gsel').forEach(g=>g.click()); });
  /* Play any legal single, trying every group in turn. Returns the label played, or null. */
  const playAny=async(multi)=>{ const gids=await p.evaluate(m=>[].map.call(document.querySelectorAll('#hand .group'+(m?'.multi':':not(.multi)')),g=>g.dataset.gid), !!multi);
    for(const gid of gids){ await deselect();
      const armed=await p.evaluate(g=>{ const el=document.querySelector('#hand .group[data-gid="'+g+'"]'); if(!el) return null; el.click();
        const f=document.getElementById('fightBtn'); return f && !f.disabled ? (document.getElementById('hint')||{}).textContent||'' : null; }, gid);
      if(armed!==null){ await p.evaluate(()=>document.getElementById('fightBtn').click()); return armed||'played'; } }
    await deselect(); return null; };
  /* Play a pair by CARD ID, selecting each card's group. The hand only groups a pair into one `.group.multi`
   * in the "Pairs" SORT MODE — the default layout is singles, so "click the multi group" finds nothing and
   * looks exactly like a rig that failed to deliver a pair. Cost me one red run to learn. */
  const playPair=async(ms=9000)=>{
    const ids=await p.evaluate(()=>{ const h=window.__solo.st().players[0].hand, by={};
      h.forEach(c=>{ (by[c.rank]=by[c.rank]||[]).push(c.id); });
      const k=Object.keys(by).find(k=>by[k].length>=2); return k?by[k].slice(0,2):null; });
    if(!ids) return 'no pair in hand';
    /* RETRY, for the same reason `passTurn` does: `toggle()` refuses a hand click SILENTLY while `busy` is set,
     * and the hand still renders as interactive, so the clicks land on nothing and the report reads "Fight is
     * disabled" with an empty selection. Measured: the window after the Rival's turn is ~2s. */
    const t0=Date.now(); let last='never attempted';
    while(Date.now()-t0<ms){ last=await attemptPair(ids); if(last===null) return null; await p.waitForTimeout(200); }
    return last+' (retried for '+ms+'ms)';
  };
  const attemptPair=async(ids)=>{
    await deselect();
    return p.evaluate(list=>{
      const seen=new Set();
      for(const id of list){ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(!c) return 'card '+id+' is not rendered';
        const g=c.closest('.group'); if(!g) return 'card '+id+' has no group';
        if(seen.has(g)) continue;                                  // both cards already live in this one group
        seen.add(g); if(!g.classList.contains('gsel')) g.click(); }
      const f=document.getElementById('fightBtn');
      if(!f || f.disabled){
        /* A red run must explain itself: report the whole hand layout and what is selected, since "Fight is
         * disabled" alone cannot distinguish a bad selection from an illegal play. */
        const lay=[].map.call(document.querySelectorAll('#hand .group'),g=>
          (g.classList.contains('gsel')?'[SEL]':'')+[].map.call(g.querySelectorAll('.card'),c=>c.dataset.id).join('+')).join(' ');
        return 'Fight is disabled — wanted '+list.join('+')+' | layout: '+lay+' | hint: '+((document.getElementById('hint')||{}).textContent||'');
      }
      f.click(); return null; }, ids);
  };
  /* RETRY UNTIL IT LANDS, and report how long it took. `doPass` returns SILENTLY on `busy` (and on peeking /
   * pick / targeting), while `#passBtn` is NOT disabled in those states — so one click on an enabled-looking
   * button can do nothing at all. A single click plus an assertion reads as "Pass is broken". Returns the ms it
   * took, or null if it never landed. */
  const passTurn=async(ms=8000)=>{ const t0=Date.now();
    const before=await p.evaluate(()=>{ const s=window.__solo.st(); return {round:s.round, turn:s.turn, nrg:s.players[0].energy.length}; });
    while(Date.now()-t0<ms){
      await p.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b && !b.disabled) b.click(); });
      const moved=await p.evaluate(b=>{ const s=window.__solo.st();
        return s.round!==b.round || s.turn!==b.turn || s.players[0].energy.length!==b.nrg; }, before);
      if(moved) return Date.now()-t0;
      await p.waitForTimeout(150);
    }
    console.log('⏱ Pass never took effect in '+ms+'ms'); return null; };
  /* Activate the spotlit card: select it, then press the ⚡ control. Both halves matter — the control only
   * appears for a selected, affordable effect card. */
  const activateSpot=async()=>{ await deselect();
    return p.evaluate(()=>{ const c=document.querySelector('#hand .card.tut-spot') || document.querySelector('#hand .group.tut-spot .card') || document.querySelector('#hand .card.transformReady');
      if(!c) return 'no spotlit card';
      const grp=c.closest('.group'); if(!grp) return 'card has no group'; grp.click();
      const a=document.getElementById('cardActivate'); if(!a || a.style.display==='none' || a.disabled) return 'activate control not offered';
      a.click(); return null; }); };

  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>{ const x=[].find.call(document.querySelectorAll('button'),y=>/Tutorials/.test(y.textContent)); if(x)x.click(); }); await p.waitForTimeout(450);
  const listed=await p.evaluate(i=>!!document.querySelector('.lessonRow[data-lesson="'+i+'"]'), id);
  ok(listed,'the hub lists the "'+id+'" lesson');
  if(listed) await p.evaluate(i=>document.querySelector('.lessonRow[data-lesson="'+i+'"]').click(), id);
  ok(await until(()=>/ \/ /.test((document.querySelector('.tutStep')||{}).textContent||''),'the lesson starts'),'the lesson starts');

  return { b, p, ok, until, step, at, atStep, next, st, deselect, playAny, playPair, passTurn, activateSpot, errs,
    /* Finish: the completion modal must be VISIBLE, not merely present in the DOM — asserted the naive way
     * (`/Lesson complete/.test(document.body.textContent)`) this passes on a lesson stuck mid-way. */
    async finish(lessonId){
      ok(await until(()=>{ const m=document.getElementById('modal'); return !!m && !!m.offsetParent && /Lesson complete/.test(m.textContent); },'the completion modal appears'),
        'the completion modal is actually on screen');
      ok(await p.evaluate(i=>localStorage.getItem('cmf_lesson_'+i+'_v1')==='1', lessonId),'…and the lesson is marked done');
    },
    async done(){ ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
      console.log('\nPASS: '+pass+'  FAIL: '+fail); await b.close(); process.exit(fail?1:0); } };
}
module.exports = { openLesson, URL };
