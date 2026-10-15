/* WHERE YOU DROP DECIDES WHAT A DRAG MEANS, NOT THE SUB-PHASE (drag-and-stack step 1).
 *
 * Aj, 2026-10-13: *"the idea is to be able to drag cards to the right side of the play area to activate and
 * drag to the middle of the play area to fight"*, and ruling 2: *"drop to the stack vis and then activate. or
 * you can drag it out to clear, or there will be an x button to cancel your attempt. once you activate, that x
 * button disappears."* So the play area has two drop zones: the MIDDLE fights, and the CAST COLUMN on the right
 * (`#castZone`) takes casts — and a card dropped there is STAGED, not cast: it waits with its ✕ until ⚡
 * Activate (ruling 9). A ⚡ tap still casts at once (ruling 11); this suite is about the drag.
 * This REPLACES epic step 20's rule (*"dragging to play activates card effects now, except when in the fight
 * sub-phase"*), and the suite that pinned that rule is rewritten rather than patched.
 *
 * WHY EVERY CLAIM IS A PAIR OFF ONE STAGING: "a drag cast" and "a drag played" are each true of a build that
 * lost the branch and does one thing everywhere. So the SAME CARD from the SAME staging is dropped in BOTH
 * zones and only the zone changes — and then the same two drops again in the Fight Sub-Phase, where the column
 * refuses (effects are a Main-half move) and the middle still plays. The sub-phase still decides what is LEGAL;
 * the zone decides what you ASKED FOR.
 *
 * AND THE REFUSALS ARE LIVE, IN `#dropHint`, WHILE THE CARD IS IN THE AIR. `highlightTarget` asks the question
 * the release will ask, so a refused release does nothing and says nothing afterwards; assert the hint before
 * releasing, never a `#message` after.
 *
 * Run: node dragtest.js */
const { chromium }=require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* THE GESTURE: mouse down on the card, a small move to arm `drag.moved` (which is also what shows the cast
   column), then onto the zone. The zone's rect is read AFTER the drag starts, because the column is only laid
   out as a target while a drag is on. `where` is 'middle' (aim at the pile) or 'column' (aim at `#castZone`).
   The hover state is captured before the release — the refusals live there. */
async function dragTo(page, id, where, from){
  const g = await page.evaluate((a)=>{
    const el=document.querySelector(a.from+' .card[data-id="'+a.id+'"]'); if(!el) return null;
    const r=el.getBoundingClientRect(); return { cx:r.left+r.width/2, cy:r.top+r.height/2 };
  }, {id:id, from:from||'#hand'});
  if(!g) return null;
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx, g.cy-24, {steps:4});
  await wait(60);
  const t = await page.evaluate((w)=>{
    if(w==='hand'){ const h=document.getElementById('hand').getBoundingClientRect(); return { x:h.left+12, y:h.top+h.height/2 }; }
    const el=document.getElementById(w==='column'?'castZone':'pile'); if(!el) return null;
    const r=el.getBoundingClientRect(); return { x:r.left+r.width/2, y:r.top+r.height/2 };
  }, where);
  if(!t){ await page.mouse.up(); return null; }
  await page.mouse.move(t.x, t.y, {steps:14});
  await wait(80);
  const zone = await page.evaluate(()=>{
    const dh=document.getElementById('dropHint'), tb=document.getElementById('table'), cz=document.getElementById('castZone');
    const r=dh?dh.getBoundingClientRect():null, tr=tb.getBoundingClientRect(), de=document.documentElement;
    return {
      hint:((dh||{}).textContent||'').trim(),
      midOk:tb.classList.contains('pz-ok'), midNo:tb.classList.contains('pz-no'),
      colOk:!!(cz && cz.classList.contains('cz-ok')), colNo:!!(cz && cz.classList.contains('cz-no')),
      spill: r ? Math.round(Math.max(0, tr.left - r.left) + Math.max(0, r.right - tr.right)) : 0,
      overflow: de.scrollWidth - de.clientWidth };
  });
  await page.mouse.up();
  return zone;
}

/* Drag card A onto card B — the merge gesture, which forms a multi-card group. */
async function dragOnto(page, idA, idB){
  const g = await page.evaluate((a)=>{
    const x=document.querySelector('#hand .card[data-id="'+a.idA+'"]'), y=document.querySelector('#hand .card[data-id="'+a.idB+'"]');
    if(!x||!y) return null;
    const r=x.getBoundingClientRect(), t=y.getBoundingClientRect();
    return { cx:r.left+r.width/2, cy:r.top+r.height/2, tx:t.left+t.width/2, ty:t.top+t.height/2 };
  }, {idA:idA, idB:idB});
  if(!g) return false;
  await page.mouse.move(g.cx, g.cy);
  await page.mouse.down();
  await page.mouse.move(g.cx, g.cy-24, {steps:4});
  await page.mouse.move(g.tx, g.ty, {steps:14});
  await wait(60);
  await page.mouse.up();
  return true;
}

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:900}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);

  const snap=()=>p.evaluate(()=>{ const st=window.__solo.st(); return {
    hand:st.players[0].hand.length, energy:st.players[0].energy.length, boost:st.players[0].nextPlayBoost||0,
    pile:st.pile?st.pile.combo.cards.length:0, sub:st.subPhase||'main', turn:st.turn,
    staged:[].slice.call(document.querySelectorAll('#stagedSlot .card')).map(c=>c.dataset.id),
    msg:((document.getElementById('message')||{}).textContent||'').trim() }; });

  /* THE SUBJECT IS A CARD WHOSE CAST IS UNMISTAKABLE ON THE STATE: ♣3 Brilliant Tactic (`valueBoost`, cost 3)
     is untargeted, always legal on your own turn in Main, and banks `nextPlayBoost` — a field no PLAY sets, while
     a PLAY banks the card into energy. Cast: energy DOWN and a boost; play: energy UP and no boost.
     `mk` builds the composite id the DOM uses (`tag+rank+suit`). */
  /* EVERY CAST HOLDS THE BOARD FOR ITS ART FLASH (drag-and-stack ruling 20), so a leg that follows a cast waits the
     hold out before staging, or it stages into a board that refuses everything for the next 2.5s. */
  const waitHold=async()=>{ for(let i=0;i<60;i++){ if(!(await p.evaluate(()=>window.__solo.castHold()))) return; await wait(100); } };
  const stage=async(sub)=>{ await waitHold(); return stageNow(sub); };
  const stageNow=(sub)=>p.evaluate((sub)=>{ const st=window.__solo.st(), mk=(r,s,t)=>({rank:r,suit:s,id:t+r+s});
    const you=st.players[0];
    you.hand=[mk(3,'C','act'), mk(6,'H','plain1'), mk(6,'D','plain2'), mk(2,'C','dead')];   // ♣2: the apex has NO activated effect by design
    you.energy=[3,4,5,6,7,8].map(n=>mk(n,'C','e'+n));
    you.nextPlayBoost=0;
    st.round=3; st.turn=0; st.subPhase=sub||'main'; st.pile=null; st.lastPlayer=null; st.passes=0; st.respondFor=null; st.pending=null;
    st.resolution=null; st.resolutionResult=null; st.cleanup=null; st.endCleanup=null; st.upkeep=null; st.toPlay=null; st.stack=[];
    var m=document.getElementById('message'); if(m) m.textContent='';   // a stale line must not satisfy a refusal assertion
    window.__solo.render(); }, sub||null);

  /* STAGING DOES NOT CLEAR `busy`, AND `busy` SWALLOWS A DRAG IN SILENCE — wait out the previous leg's
     animations (and the Rival's turn) before the next drag, or the board does not move and it reads as broken. */
  const settle=()=>until(async()=>await p.evaluate(()=>{
    const h=((document.getElementById('hint')||{}).textContent||'');
    return !/still resolving|is fighting/i.test(h) && window.__solo.st().turn===0 && !window.__solo.castHold();   // …and no cast's art flash still holding the board (ruling 20)
  }), 80, 200);

  // ═══ LEG 1 — MAIN, DROPPED ON THE COLUMN: STAGED, NOT CAST ═══
  await stage(); await wait(350); await settle();
  const b1=await snap();
  ok(b1.sub==='main' && b1.hand===4 && b1.pile===0 && b1.staged.length===0, 'staged in the MAIN sub-phase, 4 cards, empty pile, nothing staged  ['+JSON.stringify(b1)+']');
  const z1=await dragTo(p,'act3C','column');
  ok(z1 && z1.colOk && /stage/i.test(z1.hint), 'over the COLUMN the zone offers to STAGE the card  ['+(z1?z1.hint:'no drag')+']');
  await wait(250);
  const a1=await snap();
  ok(a1.staged.indexOf('act3C')>=0, 'IN MAIN, A DROP ON THE COLUMN STAGES — the card sits in the column  ['+a1.staged.join(',')+']');
  ok(a1.energy===b1.energy && a1.boost===0 && a1.pile===0, '  …and NOTHING IS SPENT: no energy, no boost, no play  ['+b1.energy+' → '+a1.energy+']');
  ok(await p.evaluate(()=>document.getElementById('fightBtn').disabled), '  …and Fight is OFF while a card is staged — it cannot be fought by accident');
  /* ⚡ ACTIVATE SENDS IT. The ctx button is the confirm, exactly as a ⚡ tap on a selected card. */
  const sent=await p.evaluate(()=>{ const a=document.getElementById('cardActivate'); if(a && a.offsetParent!==null && !a.disabled && !/off/.test(a.className)){ a.click(); return 'cardActivate'; }
    const cb=document.getElementById('ctxBtn'); if(cb && !cb.disabled && !/off/.test(cb.className) && cb.offsetParent!==null){ cb.click(); return 'ctxBtn'; } return null; });
  ok(!!sent, '  …and ⚡ Activate is there to send it ('+sent+')');
  const cast1=await until(async()=>(await snap()).boost>0, 40);
  const c1=await snap();
  ok(cast1 && c1.energy<b1.energy, '⚡ ACTIVATE CASTS THE STAGED CARD — the boost is banked and it cost energy  ['+b1.energy+' → '+c1.energy+']');
  ok(c1.staged.length===0 && c1.pile===0, '  …and the column is empty again, and the card did NOT reach the pile');

  // ═══ LEG 2 — MAIN, THE SAME CARD DROPPED IN THE MIDDLE: IT FIGHTS ═══
  await stage(); await wait(350); await settle();
  const b2=await snap();
  const z2=await dragTo(p,'act3C','middle');
  ok(z2 && z2.midOk && /release to fight/i.test(z2.hint), 'over the MIDDLE the same card is offered as a FIGHT  ['+(z2?z2.hint:'no drag')+']');
  const played2=await until(async()=>(await snap()).pile>0, 40);
  const a2=await snap();
  ok(played2, 'IN MAIN, A DROP IN THE MIDDLE PLAYS — one drop crossed into the Fight Sub-Phase and fought'+(played2?'':'  ← '+JSON.stringify(a2)));
  ok(a2.boost===0 && a2.energy>b2.energy && a2.staged.length===0, '  …and it did NOT cast: no boost, the card BANKED into energy, nothing staged  ['+b2.energy+' → '+a2.energy+']');

  // ═══ LEG 3 — THE FIGHT SUB-PHASE, THE COLUMN: REFUSED, BECAUSE EFFECTS ARE A MAIN-HALF MOVE ═══
  await settle(); await stage('play'); await wait(350);
  const b3=await snap();
  const z3=await dragTo(p,'act3C','column');
  await wait(250);
  const a3=await snap();
  ok(z3 && z3.colNo && !z3.colOk && /fight has begun|Main-half/i.test(z3.hint), 'IN THE FIGHT SUB-PHASE THE COLUMN REFUSES, while the card is in the air  ["'+(z3?z3.hint:'no drag')+'"]');
  ok(a3.staged.length===0 && a3.energy===b3.energy && a3.boost===0 && a3.pile===0, '  …and releasing there does nothing at all');

  // ═══ LEG 4 — THE FIGHT SUB-PHASE, THE MIDDLE: THE SAME CARD STILL FIGHTS ═══
  await stage('play'); await wait(350);
  const b4=await snap();
  const z4=await dragTo(p,'act3C','middle');
  ok(z4 && z4.midOk && /release to fight/i.test(z4.hint), 'in the Fight Sub-Phase the middle still offers FIGHT  ['+(z4?z4.hint:'no drag')+']');
  const played4=await until(async()=>(await snap()).pile>0, 40);
  const a4=await snap();
  ok(played4 && a4.energy>b4.energy && a4.boost===0, '  …and the drop plays it, banked, not cast'+(played4?'':'  ← '+JSON.stringify(a4)));

  // ═══ LEG 5 — A CARD WITH NOTHING TO ACTIVATE IS REFUSED BY THE COLUMN, OUT LOUD ═══
  await settle(); await stage(); await wait(350);
  const b5=await snap();
  ok(b5.msg==='', '  (a board with no stale message, so the refusal below cannot be someone else\'s line)');
  const z5=await dragTo(p,'dead2C','column');
  await wait(250);
  const a5=await snap();
  ok(z5 && z5.colNo && !z5.colOk && /nothing to activate/i.test(z5.hint), 'THE APEX 2 IS REFUSED BY THE COLUMN — it has nothing to activate  ["'+(z5?z5.hint:'no drag')+'"]');
  ok(z5 && !/activate its effect/i.test(z5.hint||''), '  …and it does NOT tell a player who is holding a card to select one');
  ok(a5.staged.length===0 && a5.pile===0 && a5.energy===b5.energy, '  …and releasing it does nothing at all');

  // ═══ LEG 6 — A PAIR: THE COLUMN REFUSES IT, THE MIDDLE FIGHTS WITH IT ═══
  await stage(); await wait(350); await settle();
  await dragOnto(p,'plain16H','plain26D'); await wait(300);
  const merged=await p.evaluate(()=>{ var gs=[].slice.call(document.querySelectorAll('#hand .group'));
    for(var i=0;i<gs.length;i++) if(gs[i].querySelectorAll('.card').length>1) return gs[i].querySelector('.card').getAttribute('data-id');
    return null; });
  ok(!!merged, 'formed a two-card group (the merge drag) to drop');
  if(merged){
    const b6=await snap();
    const z6=await dragTo(p, merged, 'column');
    await wait(250);
    const a6=await snap();
    ok(z6 && z6.colNo && /one card at a time/i.test(z6.hint), 'A PAIR DROPPED ON THE COLUMN IS REFUSED — one card at a time  ["'+(z6?z6.hint:'no drag')+'"]');
    ok(a6.staged.length===0 && a6.pile===0 && a6.energy===b6.energy, '  …and nothing happened');
    const z6b=await dragTo(p, merged, 'middle');
    const played6=await until(async()=>(await snap()).pile===2, 40);
    ok(z6b && z6b.midOk && played6, 'THE SAME PAIR DROPPED IN THE MIDDLE FIGHTS — the zone decided, not the sub-phase  ["'+(z6b?z6b.hint:'no drag')+'"]');
  }

  // ═══ LEG 7 — A STAGED CARD IS TAKEN BACK BY ITS ✕, WITH NOTHING SPENT ═══
  await settle(); await stage(); await wait(350);
  const b7=await snap();
  await dragTo(p,'act3C','column'); await wait(250);
  ok((await snap()).staged.indexOf('act3C')>=0, 'staged ♣3 in the column again');
  /* AJ, 2026-10-14: *"i'd like another [lightning bolt] beside the take back. we can reduce the take back to an X
     button"*. Read BEFORE the ✕ is pressed: both visible, on one row (their vertical centres within a few px), the
     ✕ carrying no words. */
  const r7=await p.evaluate(()=>{ const go=document.getElementById('stagedCastBtn'), x=document.getElementById('unstageBtn');
    if(!go || !x || go.offsetParent===null || x.offsetParent===null) return { ok:false, go:!!go, x:!!x };
    const a=go.getBoundingClientRect(), c=x.getBoundingClientRect(), dy=Math.abs((a.top+a.height/2)-(c.top+c.height/2));
    const out={ go:go.textContent.trim(), x:x.textContent.trim(), dy:Math.round(dy), leftOf:a.right<=c.left+1 };
    out.ok = out.go==='⚡' && out.x==='✕' && dy<4 && out.leftOf; return out; });
  const x7=await p.evaluate(()=>{ const x=document.getElementById('unstageBtn'); if(!x || x.offsetParent===null) return false; x.click(); return true; });
  await wait(250);
  const a7=await snap();
  ok(x7, 'the staged card carries its ✕');
  ok(r7.ok, 'THE ⚡ SITS BESIDE THE ✕, UNDER THE CARD, and the ✕ is an icon  ['+JSON.stringify(r7)+']');
  ok(a7.staged.length===0 && a7.hand===b7.hand && a7.energy===b7.energy && a7.boost===0, 'THE ✕ TAKES IT BACK — the column is empty, the card is in hand, nothing was spent');

  // ═══ LEG 8 — …AND SO DOES DRAGGING IT BACK OUT OF THE COLUMN ═══
  await dragTo(p,'act3C','column'); await wait(250);
  ok((await snap()).staged.indexOf('act3C')>=0, 'staged ♣3 once more');
  await dragTo(p,'act3C','hand','#stagedSlot'); await wait(250);
  const a8=await snap();
  ok(a8.staged.length===0 && a8.energy===b7.energy && a8.boost===0 && a8.pile===0, 'DRAGGING THE STAGED CARD OUT OF THE COLUMN TAKES IT BACK — nothing spent, nothing played  ['+JSON.stringify(a8)+']');

  // ═══ LEG 8b — THE COLUMN'S OWN ⚡ CASTS THE STAGED CARD ═══
  /* It must CAST, not just exist: a ⚡ wired to nothing would pass r7 above. Same card, same staging as leg 1, and
     the same proof — the boost is banked and it cost energy, and the card never reached the pile. */
  await settle(); await stage(); await wait(350);
  const b8b=await snap();
  await dragTo(p,'act3C','column'); await wait(250);
  ok((await snap()).staged.indexOf('act3C')>=0, 'staged ♣3 for the column\'s ⚡');
  const go8b=await p.evaluate(()=>{ const go=document.getElementById('stagedCastBtn'); if(!go || go.offsetParent===null || go.disabled) return false; go.click(); return true; });
  const cast8b=await until(async()=>(await snap()).boost>0, 40);
  const a8b=await snap();
  ok(go8b && cast8b && a8b.energy<b8b.energy && a8b.pile===0 && a8b.staged.length===0,
     'THE COLUMN\'S ⚡ CASTS IT — the boost is banked, it cost energy, the column is empty and nothing was played  ['+b8b.energy+' → '+a8b.energy+', boost '+a8b.boost+']');

  // ═══ LEG 9 — A CARD WITH A CHOICE STAGES INTO ITS PICKER, AND ✕ BACKS OUT OF BOTH ═══
  /* Ultima Attack (10♣) with TWO Broadway cards beside it, so its pitch has something to choose: dropped on the
     column it is staged AND today's pitch picker opens (Fight reads Confirm, Pass reads Cancel), and nothing is
     spent until that is confirmed. */
  await settle();
  await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    const you=st.players[0];
    you.hand=[mk(10,'C','ult'), mk(11,'H','jA'), mk(12,'S','qB'), mk(4,'D','lowC')];
    you.energy=[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'C','pe'+n));
    st.subPhase='main'; st.turn=0; st.pile=null; st.round=4; st.stack=[]; st.respondFor=null;
    window.__solo.render(); });
  await wait(300);
  const b9=await snap();
  const z9=await dragTo(p,'ult','column');
  await wait(300);
  /* ITS FIRST CHOICE IS THE TARGET, then the pitch — `activate`'s own order (a hostile single-target card picks the
     rival before anything else). So the leg asserts "a picker opened", read off the staged card's note, rather than
     naming one: the column's job is to hand the card to whichever stager it already had. */
  const a9=await p.evaluate(()=>({ staged:[].slice.call(document.querySelectorAll('#stagedSlot .card')).map(c=>c.dataset.id),
    note:((document.querySelector('#stagedSlot .stgNote')||{}).textContent||'').trim(),
    ctx:((document.getElementById('ctxBtn')||{}).textContent||'').trim(),
    ctxIcon:((document.getElementById('ctxBtn')||{getAttribute:()=>''}).getAttribute('data-icon')||''),
    go:((document.getElementById('stagedCastBtn')||{}).textContent||'').trim(),
    energy:window.__solo.st().players[0].energy.length }));
  ok(z9 && z9.colOk, 'Ultima Attack is offered to the column  ['+(z9?z9.hint:'no drag')+']');
  ok(a9.staged.indexOf('ult')>=0 && /^Choose/.test(a9.note), 'A CARD WITH A CHOICE STAGES INTO ITS PICKER — in the column, its first choice open  [note "'+a9.note+'", ⚡ "'+a9.ctx+'"]');
  ok(a9.energy===b9.energy, '  …and nothing is spent while the choice is open');
  /* THE COLUMN'S ⚡ IS THE ACTION ROW'S BUTTON, NOT A SECOND ONE: while a choice is open it reads what that button
     reads (🎯), never a ⚡ that would not cast. */
  ok(!!a9.go && a9.go===a9.ctxIcon && a9.go!=='⚡', '  …and the column\'s button MIRRORS the action row\'s — "'+a9.go+'" beside "'+a9.ctx+'"');
  await p.evaluate(()=>{ const x=document.getElementById('unstageBtn'); if(x) x.click(); });
  await wait(250);
  const c9=await p.evaluate(()=>({ staged:document.querySelectorAll('#stagedSlot .card').length,
    ctx:((document.getElementById('ctxBtn')||{}).textContent||'').trim(), energy:window.__solo.st().players[0].energy.length }));
  ok(c9.staged===0 && !/Pick a target|Choose target/.test(c9.ctx) && c9.energy===b9.energy, '  …and ✕ backs out of the picker AND the column, nothing spent  [⚡ "'+c9.ctx+'"]');

  // ═══ LEG 9b — A ⚡ TAP ON A CARD WITH A CHOICE SHOWS IT IN THE COLUMN TOO ═══
  /* Aj, 2026-10-14, asked whether a tapped card that needs a target should also sit in the column while you pick:
     *"Yes, show it in the column"*. The SAME Ultima board, opened by selecting it and pressing the action row's ⚡
     rather than by a drop. The card a picker holds is the staged card whichever gesture opened it. */
  await settle();
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="ult"]'))[0]; if(g) g.click(); });
  await wait(250);
  await p.evaluate(()=>{ const c=document.getElementById('ctxBtn'); if(c && !c.disabled) c.click(); });
  await wait(350);
  const a9b=await p.evaluate(()=>({ staged:[].slice.call(document.querySelectorAll('#stagedSlot .card')).map(c=>c.dataset.id),
    note:((document.querySelector('#stagedSlot .stgNote')||{}).textContent||'').trim(),
    shown:document.getElementById('castZone').classList.contains('show'), energy:window.__solo.st().players[0].energy.length }));
  ok(a9b.shown && a9b.staged.indexOf('ult')>=0 && /^Choose/.test(a9b.note) && a9b.energy===b9.energy,
     'A ⚡ TAP ON A CARD WITH A CHOICE SHOWS IT IN THE COLUMN while its picker is open, nothing spent  ['+JSON.stringify(a9b)+']');
  await p.evaluate(()=>{ const x=document.getElementById('unstageBtn'); if(x) x.click(); });
  await wait(250);
  const c9b=await p.evaluate(()=>({ staged:document.querySelectorAll('#stagedSlot .card').length,
    ctx:((document.getElementById('ctxBtn')||{}).textContent||'').trim(), energy:window.__solo.st().players[0].energy.length }));
  ok(c9b.staged===0 && !/Pick a target|Choose target/.test(c9b.ctx) && c9b.energy===b9.energy, '  …and its ✕ backs out of the tap\'s picker too, nothing spent  [⚡ "'+c9b.ctx+'"]');
  // a red run must not leave the picker open for the legs below — back out with Clear if the ✕ was not there
  await p.evaluate(()=>{ const c=document.getElementById('ctxBtn'); if(c && /Pick a target|Choose target/.test(c.textContent||'')){ const k=document.getElementById('clearBtn'); if(k && !k.disabled) k.click(); } });
  await wait(200);
  /* THE CONTROL — ruling 11's other half: a card with NOTHING to choose still casts on the tap and never reaches the
     column. Without it, a build that staged every tap would pass the leg above. */
  await settle(); await stage(); await wait(350);
  const b9c=await snap();
  await p.evaluate(()=>{ window.__colSeen=false; const cz=document.getElementById('stagedSlot');
    window.__colObs=new MutationObserver(()=>{ if(cz.querySelector('.card[data-id="act3C"]')) window.__colSeen=true; }); window.__colObs.observe(cz,{childList:true,subtree:true});
    const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="act3C"]'))[0]; if(g) g.click(); });
  await wait(250);
  await p.evaluate(()=>{ const c=document.getElementById('ctxBtn'); if(c && !c.disabled) c.click(); });
  const cast9c=await until(async()=>(await snap()).boost>0, 40);
  const seen9c=await p.evaluate(()=>{ window.__colObs.disconnect(); return window.__colSeen; });
  ok(cast9c && (await snap()).energy<b9c.energy && !seen9c, '  CONTROL: a ⚡ tap on a card with nothing to choose still CASTS AT ONCE and never enters the column (ruling 11)  [column seen: '+seen9c+']');

  /* ---------- LEG 10: A LONG REFUSAL MUST NOT COST YOU THE BOARD (2026-09-30).
     The live refusal feeds `ctxActionFor(...).reason` into the pill, and the pill was built for short strings:
     a full engine sentence once hung off both edges of the play area, and because the pill is hidden by
     OPACITY, stale text left in it widened the document for the rest of the game. MEASURE, DO NOT LOOK, and
     at a NARROW viewport, which is the only place the bug exists (at 1100px the sentence fits on one line and
     the assertions measured nothing). 760px stays above the 720px phone gate on purpose. */
  const LONG = /Broadway card/i;                       // `pitchHigh` — the longest reason the engine gives
  await settle();   // the previous leg's cast may still be holding the board (ruling 20)
  await p.setViewportSize({width:760,height:900}); await wait(250);
  await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    const you=st.players[0];
    /* Ultima Attack with NO 10/J/Q/K/A beside it, so the pitch has nothing to spend and `ctxActionFor` returns
       the long sentence. Energy is ample: the refusal under test must be the PITCH, not affordability. */
    you.hand=[mk(10,'C','ulti'), mk(3,'D','lowA'), mk(4,'D','lowB')];
    you.energy=[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'C','pe'+n));
    st.subPhase='main'; st.turn=0; st.pile=null; st.round=4;
    window.__solo.render(); });
  await wait(250);
  const z10=await dragTo(p,'ulti','column');
  ok(!!z10 && LONG.test(z10.hint||''), 'the long Broadway refusal really is what the pill shows  ["'+(z10?z10.hint:'no drag')+'"]');
  ok(!!z10 && z10.spill===0, '  …and it stays INSIDE the play area — '+(z10?z10.spill:'?')+'px hanging off the edges (cap + wrap)');
  await wait(200);
  const after=await p.evaluate(()=>({ text:((document.getElementById('dropHint')||{}).textContent||'') }));
  ok(after.text==='', 'the hidden pill holds NO text after the drag — hidden by opacity, stale text would still occupy the layout  ["'+after.text.slice(0,52)+'"]');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
