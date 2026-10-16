/* YES, AND ANSWERING FROM THE BOARD (drag-and-stack step 4, piece 2).
 *
 * Ruling 7 (Aj, 2026-10-13): a small Respond? box first, then your hand. This piece adds the box's YES, which closes
 * it and leaves the window yours; the board then answers. Until the board can cast (piece 5), Pass declines from the
 * board and "Respond?" in the action row brings the box back (ruling 24).
 * Staged as castholdtest D is: in ON your own cast offers you Leyline, so the box opens for YOU on demand.
 *   A  the box shows Yes and No (since piece 8 it lists no Quicks)
 *   B  Yes closes it, the window stays yours, and the board says so: Pass is live and named for the moment
 *      ("Let it resolve"), Fight is off, Respond? is offered
 *   C  Respond? reopens the box (ruling 24)
 *   D  Pass from the board DECLINES PRIORITY — the Technique resolves and it is still your Main — and does NOT sit
 *      you out of the round, which is what Pass used to do (E.pass)
 *   E  a reopened box still leads to an answer (Yes, then the board), and the cast consumes the record
 *   A1 (piece 8) THE SMALL BOX: no Quick buttons, no Peek, the card being cast beside the sentence (ruling 25), No
 *      reading "No" with the moment's name as its title
 *   A2 (piece 8, ruling 23) the box sits CLEAR of the pile, the cast column and the hand's phase strip, on an overlay
 *      that does not dim them — and G repeats it on a portrait phone, where the box moves under the hand
 *   F  (piece 8, ruling 25) the sentence names what the cast is aimed at when that is not a seat: your Sabotage "at
 *      Rival’s Holy Bow"
 *
 * Run: node answertest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { clickQuick } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1&prompts=all';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;}; const errs=[];
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
  const stage=async()=>{ for(let i=0;i<60 && await p.evaluate(()=>window.__solo.castHold()); i++) await wait(100);
    await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.stack=[]; st.respondFor=null; st.pending=null; st.round=4; st.turn=0; st.subPhase='main'; st.pile=null; st.lastPlayer=null; st.passes=0;
      st.resolution=null; st.cleanup=null; st.endCleanup=null; st.upkeep=null;
      st.players[1].hand=[mk(3,'S','r3S'),mk(6,'H','r6H')]; st.players[1].energy=[];
      st.players[0].hand=[mk(3,'C','bt3C'),mk(9,'H','x9H'),mk(9,'D','ley9D')];
      st.players[0].energy=[3,4,5,6,7,8].map(n=>mk(n,'C','e'+n)).concat([1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','d'+n)));
      st.players[0].nextPlayBoost=0; window.__solo.render(); });
    await wait(400); };
  const castBT=async()=>{ await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="bt3C"]'))[0]; if(g) g.click(); }); await wait(250);
    await p.evaluate(()=>document.getElementById('ctxBtn').click());
    for(let i=0;i<60 && !(await p.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); })); i++) await wait(100); };
  const board=()=>p.evaluate(()=>{ const f=document.getElementById('fightBtn'), pb=document.getElementById('passBtn'), r=document.getElementById('respondBtn'), st=window.__solo.st();
    return { box:document.getElementById('overlay').classList.contains('show'), answering:window.__solo.answering(), holds:window.__solo.holdsPriority(),
      fightOff:f.disabled, passOn:!pb.disabled, passLabel:(pb.textContent||'').trim(), respond:!!(r && r.offsetParent!==null && !r.disabled),
      hint:(document.getElementById('hint').textContent||'').trim(), live:document.getElementById('actions').getAttribute('data-live'),
      turn:st.turn, sub:st.subPhase, rf:st.respondFor, boost:st.players[0].nextPlayBoost||0, hand:st.players[0].hand.map(c=>c.id) }; });
  const log=()=>p.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent.trim()));
  // the box against what ruling 23 protects: overlap area (px²) with each, and whether the overlay paints anything behind it
  const clearOf=pg=>pg.evaluate(()=>{ const m=document.getElementById('modal').getBoundingClientRect(), ov=document.getElementById('overlay');
    const ov2=id=>{ const e=document.getElementById(id); if(!e || e.offsetParent===null) return null; const a=e.getBoundingClientRect();
      return Math.round(Math.max(0,Math.min(a.right,m.right)-Math.max(a.left,m.left))*Math.max(0,Math.min(a.bottom,m.bottom)-Math.max(a.top,m.top))); };
    const cs=getComputedStyle(ov);
    return { pile:ov2('pile'), cast:ov2('castZone'), strip:ov2('handWrap'), bg:cs.backgroundColor, blur:cs.backdropFilter }; });
  const clean=c=>c.pile===0 && c.cast===0 && c.strip===0 && /rgba\(0, 0, 0, 0\)|transparent/.test(c.bg) && (c.blur==='none' || !c.blur);

  // A
  await stage(); await castBT();
  const a=await p.evaluate(()=>({ yes:!!(document.querySelector('#respYes')||{}).offsetParent, decline:!!(document.querySelector('#respDecline')||{}).offsetParent }));
  ok(a.yes && a.decline, 'A · THE BOX OFFERS YES AND NO  ['+JSON.stringify(a)+']');
  const a1=await p.evaluate(()=>{ const m=document.getElementById('modal'), d=document.getElementById('respDecline');
    return { quicks:m.querySelectorAll('.respQuick').length, peek:!!document.getElementById('peekBtn'), card:!!m.querySelector('#respCardSlot .card[data-id="bt3C"]'),
             no:(d.textContent||'').trim(), title:d.title, lead:((m.querySelector('.respWhat p')||{}).textContent||'').trim() }; });
  ok(a1.quicks===0 && !a1.peek && a1.card && a1.no==='No' && a1.title==='Let it resolve' && /You cast Brilliant Tactic/.test(a1.lead),
     'A1 · THE SMALL BOX: no Quick buttons, no Peek, the card being cast beside its sentence, and No titled with the moment  ['+JSON.stringify(a1)+']');
  const a2=await clearOf(p);
  ok(clean(a2), 'A2 · RULING 23: the box is CLEAR of the pile, the cast column and the phase strip, and nothing dims them  ['+JSON.stringify(a2)+']');
  // B
  await p.evaluate(()=>document.getElementById('respYes').click()); await wait(300);
  const bb=await board();
  ok(!bb.box && bb.answering && bb.holds && bb.rf===0, 'B · YES CLOSES THE BOX AND THE WINDOW STAYS YOURS — answering from the board  ['+JSON.stringify({box:bb.box,answering:bb.answering,holds:bb.holds,rf:bb.rf})+']');
  ok(bb.passOn && bb.passLabel==='Let it resolve' && bb.fightOff && bb.respond && bb.live==='1',
     '  …and the board says so: Pass is live and named for the moment, Fight is off, Respond? is offered  ['+JSON.stringify({pass:bb.passLabel,passOn:bb.passOn,fightOff:bb.fightOff,respond:bb.respond,hint:bb.hint})+']');
  // C
  await p.evaluate(()=>document.getElementById('respondBtn').click()); await wait(300);
  const c=await p.evaluate(()=>({ box:document.getElementById('overlay').classList.contains('show'), yes:!!(document.getElementById('respYes')||{}).offsetParent, answering:window.__solo.answering() }));
  ok(c.box && c.yes && !c.answering, 'C · RESPOND? REOPENS THE BOX (ruling 24) — and while it is up, the box is the answer, not the board  ['+JSON.stringify(c)+']');
  // D
  await p.evaluate(()=>document.getElementById('respYes').click()); await wait(300);
  const log0=(await log()).length;
  await p.evaluate(()=>document.getElementById('passBtn').click());
  let d=null; for(let i=0;i<60;i++){ await wait(100); d=await board(); if(d.rf!==0 && d.boost>0) break; }
  const ledger=await p.evaluate(()=>window.__solo.prioLog());
  const lines=(await log()).slice(log0);
  ok(d.rf!==0 && d.boost>0 && !d.answering, 'D · PASS FROM THE BOARD DECLINES PRIORITY — the window closes and Brilliant Tactic resolves  ['+JSON.stringify({rf:d.rf,boost:d.boost})+']');
  ok(d.turn===0 && d.sub==='main' && !lines.some(l=>/You passed/.test(l)) && ledger.some(l=>/you passed from the board/.test(l)) && ledger.some(l=>/→ you DECLINED/.test(l)),
     '  …and it did NOT sit you out of the round: still your Main, no "You passed."  ['+JSON.stringify({turn:d.turn,sub:d.sub,lines:lines.slice(-3)})+']');
  // E
  await stage(); await castBT();
  await p.evaluate(()=>document.getElementById('respYes').click()); await wait(300);
  await p.evaluate(()=>document.getElementById('respondBtn').click()); await wait(300);
  await clickQuick(p, /Leyline/);   // the reopened box's Yes, then the board (piece 8: the box lists no Quicks)
  let e=null; for(let i=0;i<60;i++){ await wait(100); e=await board(); if(e.hand.indexOf('ley9D')<0) break; }
  ok(e.hand.indexOf('ley9D')<0 && !e.answering, 'E · ANSWERING THROUGH THE REOPENED BOX CASTS IT, and the record is spent  ['+JSON.stringify({hand:e.hand, answering:e.answering})+']');

  // F — your own Sabotage at the Rival's Holy Bow, in ON, opens a window you hold (you have Leyline): the box names the target
  await p.evaluate(()=>{ const c=document.getElementById('respDecline'); if(c && c.offsetParent) c.click(); });
  for(let i=0;i<60 && await p.evaluate(()=>window.__solo.st().respondFor!=null); i++){ await p.evaluate(()=>{ const c=document.getElementById('respDecline'); if(c && c.offsetParent) c.click(); const pb=document.getElementById('passBtn'); if(window.__solo.answering() && pb && !pb.disabled) pb.click(); }); await wait(150); }
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
  await stage();
  await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    st.players[0].hand=[mk(5,'S','sab5S'),mk(9,'D','ley9D'),mk(6,'H','x6H')];
    st.players[0].energy=[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'S','s'+n)).concat([1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','d'+n)));
    st.players[1].equipment=[{id:'eqR', name:'Holy Bow', delta:1, oppDelta:0, counters:3, decay:true, card:mk(9,'D','cBow')}];
    window.__solo.render(); });
  await wait(300);
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="sab5S"]'))[0]; if(g) g.click(); }); await wait(250);
  await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(300);
  await p.evaluate(()=>{ const e=document.querySelector('.eq.targetable[data-eid="eqR"]'); if(e) e.click(); }); await wait(250);
  await p.evaluate(()=>document.getElementById('ctxBtn').click());
  for(let i=0;i<60 && !(await p.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); })); i++) await wait(100);
  const f=await p.evaluate(()=>((document.querySelector('#modal .respWhat p')||{}).textContent||'').replace(/\s+/g,' ').trim());
  ok(/You cast Sabotage at [^.]+’s Holy Bow\./.test(f), 'F · RULING 25: THE SENTENCE NAMES WHAT THE CAST IS AIMED AT — an Equipment, not a seat  ["'+f+'"]');
  // G — the same box on a portrait phone, where it sits under the hand
  { const ph=await (await b.newContext({viewport:{width:390,height:844}, isMobile:true, hasTouch:true})).newPage(); ph.on('pageerror',e=>errs.push('phone: '+e.message));
    await ph.goto(URL); await wait(700);
    await ph.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await ph.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
    await ph.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.stack=[]; st.respondFor=null; st.pending=null; st.round=4; st.turn=0; st.subPhase='main'; st.pile=null; st.prioPassed={};
      st.players[0].hand=[mk(3,'C','bt3C'),mk(9,'H','x9H'),mk(9,'D','ley9D')];
      st.players[0].energy=[3,4,5,6,7,8].map(n=>mk(n,'C','e'+n)).concat([1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','d'+n))); window.__solo.render(); });
    await wait(400);
    await ph.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="bt3C"]'))[0]; if(g) g.click(); }); await wait(250);
    await ph.evaluate(()=>document.getElementById('ctxBtn').click());
    for(let i=0;i<60 && !(await ph.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); })); i++) await wait(100);
    const g=await clearOf(ph);
    ok(clean(g), 'G · …and on a portrait phone the box is clear of them too  ['+JSON.stringify(g)+']'); }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
