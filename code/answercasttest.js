/* CASTING ON THE BOARD WHILE THE WINDOW IS YOURS (drag-and-stack step 4, piece 5).
 *
 * Ruling 7 (Aj, 2026-10-13): *"it becomes Respond? and then yes you go view your hand"*. Piece 2 gave the box its Yes
 * and the board its Pass; this piece lets the board CAST. A board cast in a window is the box's own cast —
 * `humanResponds`, so `E.respond` — never Main's `activate()`, which refuses off-turn and asks Main's questions.
 * Every leg below is a gesture a player makes after pressing Yes:
 *   A  on the RIVAL's turn the hand answers: it is live, Fight is off, ⚡ is on the row
 *   B  ruling 27: tapping a castable Quick inside a group takes it OUT of the group and selects it alone
 *   C  a card that is not a Quick is refused with the engine's own reason (`E.castRefusal`)
 *   D  the middle refuses a drop: a play would cross over the open stack
 *   E  ⚡ casts it — on the Rival's turn, where `activate()` returns silently — and in ON the box comes back for the
 *      new grant (ruling 22)
 *   F  a drop on the cast column STAGES it, and the column's ⚡ casts it
 *   G  Annoint asks which of YOUR Equipment it protects — the Rival's is not offered — and the choice reaches the stack
 *   H  Armor Piercing under a Queen asks which Broadway card to pitch, and that card is the one that goes
 *   I  your own Fight press opens a window you hold first; tapping a Quick borrows the selection, and Pass gives the
 *      pressed cards back before the play lands
 *   J  (piece 7) Counter Spell never casts on the tap (ruling 26): ⚡ opens the pick, its one target is pre-chosen on
 *      the STACK, and only a second ⚡ casts it — aimed at that object's oid
 *   K  with two targets nothing is pre-chosen: both stack cards light (the top one too, over its gold ring), and the
 *      one you TAP is the one countered — the lower one here, which the box's old "the thing beneath" default would miss
 *
 * Run: node answercasttest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { clickFight, clickDecline } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1&prompts=all';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;}; const errs=[];
  const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);

  const settle=async()=>{ for(let i=0;i<60 && await p.evaluate(()=>window.__solo.castHold()); i++) await wait(100); };
  /* ONE BOARD, MANY HANDS. Round 4 (Specials allowed), your Main, an empty pile and stack; energy in every suit. */
  const stage=async(you, riv, extra)=>{ await settle();
    await p.evaluate(a=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.stack=[]; st.respondFor=null; st.pending=null; st.round=4; st.turn=0; st.subPhase='main'; st.pile=null; st.lastPlayer=null; st.passes=0;
      st.resolution=null; st.cleanup=null; st.endCleanup=null; st.upkeep=null; st.prioPassed={};
      const E=s=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,s,s+'e'+n));
      st.players[0].hand=a.you.map(c=>mk(c[0],c[1],c[2])); st.players[0].energy=E('D').concat(E('H'),E('C'),E('S'),E('D').map(c=>mk(c.rank,'D','x'+c.id)));   // two Leylines' worth of ♦: a cast is paid in its own suit
      st.players[1].hand=a.riv.map(c=>mk(c[0],c[1],c[2])); st.players[1].energy=E('D');
      st.players[0].forms=[]; st.players[1].forms=[]; st.players[0].equipment=[]; st.players[1].equipment=[]; st.players[0].nextPlayBoost=0;
      if(a.extra && a.extra.queen) st.players[0].forms=[{rank:12,suit:'C',tier:'queen',name:'Hippolyta Form',card:mk(12,'C','fQC')}];
      if(a.extra && a.extra.equip){ const eq=(id,nm,r)=>({id:id,name:nm,delta:1,oppDelta:0,counters:3,decay:true,card:mk(r,'C','c'+id)});
        st.players[0].equipment=[eq('eqA','Hero’s Javelin',2),eq('eqB','Spiked Armor',6)]; st.players[1].equipment=[eq('eqR','Holy Bow',9)]; }
      window.__solo.render(); }, {you:you, riv:riv, extra:extra||null});
    await wait(400); };
  const groupOf=id=>p.evaluate(id=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="'+id+'"]'))[0];
    return g ? { n:g.querySelectorAll('.card').length, sel:g.classList.contains('gsel') } : null; }, id);
  const tap=id=>p.evaluate(id=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="'+id+'"]'))[0]; if(g) g.click(); }, id);
  const boxUp=()=>p.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); });
  const waitBox=async(n)=>{ for(let i=0;i<(n||80);i++){ if(await boxUp()) return true; await wait(100); } return false; };
  const yes=async()=>{ await p.evaluate(()=>document.getElementById('respYes').click()); await wait(300); };
  const castMain=async(id)=>{ await tap(id); await wait(250); await p.evaluate(()=>document.getElementById('ctxBtn').click()); };
  const row=()=>p.evaluate(()=>{ const c=document.getElementById('ctxBtn'), f=document.getElementById('fightBtn'), h=document.getElementById('hand'), st=window.__solo.st();
    return { ctx:(c.textContent||'').trim(), ctxShown:c.style.display!=='none' && !!c.offsetParent, ctxOff:c.classList.contains('off'), ctxGold:c.classList.contains('gold'), ctxTitle:c.title,
      fightOff:f.disabled, handLive:!h.classList.contains('disabled'), answering:window.__solo.answering(), turn:st.turn, rf:st.respondFor,
      hint:(document.getElementById('hint').textContent||'').trim(), hand:st.players[0].hand.map(c=>c.id),
      stack:(st.stack||[]).map(o=>({p:o.p, id:o.card&&o.card.id, t:o.opts&&o.opts.target, pitch:o.pitched&&o.pitched.id})) }; });
  const ledger=()=>p.evaluate(()=>window.__solo.prioLog());
  async function dragTo(id, where){
    const g=await p.evaluate(id=>{ const el=document.querySelector('#hand .card[data-id="'+id+'"]'); if(!el) return null; const r=el.getBoundingClientRect(); return {cx:r.left+r.width/2, cy:r.top+r.height/2}; }, id);
    if(!g) return null;
    await p.mouse.move(g.cx, g.cy); await p.mouse.down(); await p.mouse.move(g.cx, g.cy-24, {steps:4}); await wait(60);
    const t=await p.evaluate(w=>{ const el=document.getElementById(w==='column'?'castZone':'pile'); if(!el) return null; const r=el.getBoundingClientRect(); return {x:r.left+r.width/2, y:r.top+r.height/2}; }, where);
    if(!t){ await p.mouse.up(); return null; }
    await p.mouse.move(t.x, t.y, {steps:14}); await wait(80);
    const z=await p.evaluate(()=>{ const dh=document.getElementById('dropHint'), tb=document.getElementById('table'), cz=document.getElementById('castZone');
      return { hint:((dh||{}).textContent||'').trim(), midNo:tb.classList.contains('pz-no'), colOk:!!(cz && cz.classList.contains('cz-ok')) }; });
    await p.mouse.up(); await wait(300); return z; }

  // ================= the Rival's turn: you lead the apex 2, the Rival casts Gather Energy, you hold Leyline =================
  /* A SPARE LEYLINE KEEPS THE STACK STILL. With nothing else castable, your answer resolves inside `E.respond` the moment
     nobody can add, so the stack is empty before anyone can look. Holding a second Quick hands priority back to you
     (the controller first) and, in ON, the box returns over a stack that still holds what you cast. */
  await stage([[2,'S','y2'],[9,'D','ley9D'],[9,'S','x9S'],[9,'D','ley9X']], [[1,'D','r1D'],[4,'C','r4C']]);
  /* the pair is a GROUP for ruling 27: built the way a player builds one, by dropping one card on the other */
  { const a=await p.evaluate(()=>{ const r=document.querySelector('#hand .card[data-id="x9S"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    const t=await p.evaluate(()=>{ const r=document.querySelector('#hand .card[data-id="ley9D"]').getBoundingClientRect(); return {x:r.left+r.width/2,y:r.top+r.height/2}; });
    await p.mouse.move(a.x,a.y); await p.mouse.down(); await p.mouse.move(a.x,a.y-24,{steps:4}); await p.mouse.move(t.x,t.y,{steps:12}); await wait(60); await p.mouse.up(); await wait(350); }
  const pair=await groupOf('ley9D');
  if(pair && pair.sel){ await tap('ley9D'); await wait(450); }   // a freshly built pair is selected; a single tap (after the double-tap wait) lets it go
  /* leading opens the Main → Fight window first, which you hold (you can add Leyline): let it go, then the Rival — who
     cannot beat the 2 — casts on its own turn. `selected` is replaced by the lead, which is what pressing Fight does. */
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="y2"]'))[0]; if(g) g.click(); }); await wait(250);
  await clickFight(p);
  let up1=false, s1=null;
  for(let i=0;i<200;i++){ await wait(100); s1=await row(); const up=await boxUp();
    if(up && s1.turn===1){ up1=true; break; } if(up && s1.turn===0) await clickDecline(p); }
  ok(up1 && s1.turn===1 && s1.rf===0 && pair && pair.n===2, 'STAGED: a window on the RIVAL\'s turn is yours, the box is up, and your 9♦ Leyline sits in a pair  ['+JSON.stringify({box:up1, turn:s1&&s1.turn, rf:s1&&s1.rf, pair:pair, stack:s1&&s1.stack})+']');
  // A
  await yes();
  const a=await row();
  ok(a.answering && a.handLive && a.fightOff && a.ctxShown, 'A · AFTER YES THE HAND ANSWERS ON THE RIVAL\'S TURN: it is live, Fight is off, ⚡ is on the row  ['+JSON.stringify({answering:a.answering, handLive:a.handLive, fightOff:a.fightOff, ctx:a.ctx, turn:a.turn})+']');
  // B
  await tap('ley9D'); await wait(450);
  const bl=await groupOf('ley9D'), bs=await groupOf('x9S'), b1=await row();
  ok(bl && bl.n===1 && bl.sel && bs && bs.n===1 && !bs.sel, 'B · RULING 27: TAPPING THE QUICK IN ITS PAIR TAKES IT OUT AND SELECTS IT ALONE  ['+JSON.stringify({leyline:bl, nine:bs})+']');
  ok(b1.ctx==='⚡ Activate' && !b1.ctxOff, '  …and ⚡ offers to cast it  ['+JSON.stringify({ctx:b1.ctx, off:b1.ctxOff, hint:b1.hint})+']');
  // C
  await tap('x9S'); await wait(250);
  const c=await row();
  ok(c.ctxOff && /not a Quick/i.test(c.ctxTitle) && /not a Quick/i.test(c.hint), 'C · A CARD THAT IS NOT A QUICK IS REFUSED with the engine\'s own reason  ['+JSON.stringify({off:c.ctxOff, title:c.ctxTitle, hint:c.hint})+']');
  // D
  await tap('ley9D'); await wait(250);
  const d=await dragTo('ley9D', 'pile'); const d2=await row();
  ok(d && d.midNo && /window is yours/.test(d.hint) && d2.hand.indexOf('ley9D')>=0 && d2.answering, 'D · THE MIDDLE REFUSES A DROP while the window is yours, and nothing is played  ['+JSON.stringify({drop:d, still:d2.hand.indexOf('ley9D')>=0, answering:d2.answering})+']');
  // E
  await tap('ley9D'); await wait(250);
  const e0=await row();
  if(!(e0.ctx==='⚡ Activate' && !e0.ctxOff)){ await tap('ley9D'); await wait(250); }
  /* YOUR ANSWER FLASHES LIKE A CAST (answer-art-flash): the reader lights, and no "⏩ QUICK" banner is laid over the art.
     Sampled from the click, because the banner was transient (1.4s). The reader's class is cleared first, so an
     earlier reveal cannot answer for this one. */
  await p.evaluate(()=>{ const cv=document.getElementById('cardView'); if(cv) cv.classList.remove('reveal','you'); });
  await p.evaluate(()=>document.getElementById('ctxBtn').click());
  let e=null, eQuick=false, eReader=false;
  for(let i=0;i<60;i++){ await wait(100); e=await row();
    const fx=await p.evaluate(()=>({ quick:!!document.querySelector('#stopfx.show') && /QUICK/.test((document.querySelector('#stopfx .stx')||{}).textContent||''), reader:!!document.querySelector('#cardView.reveal') }));
    if(fx.quick) eQuick=true; if(fx.reader) eReader=true;
    if(e.hand.indexOf('ley9D')<0 && i>=8) break; }
  const led=await ledger();
  ok(e.hand.indexOf('ley9D')<0 && e.stack.some(o=>o.p===0 && o.id==='ley9D') && e.turn===1 && led.some(l=>/→ you CAST Leyline Ascension/.test(l)),
     'E · ⚡ CASTS IT IN ANSWER ON THE RIVAL\'S TURN — Leyline is on the stack as yours, and the ledger records the cast  ['+JSON.stringify({hand:e.hand, stack:e.stack, turn:e.turn})+']');
  ok(eReader && !eQuick, '  …and it flashes like a cast: the card drops into the reader, with no "⏩ QUICK" banner over it  '+JSON.stringify({reader:eReader, quickBanner:eQuick}));
  ok(await waitBox(80), '  …and in ON the box comes back for the new grant (ruling 22)');
  await clickDecline(p);
  for(let i=0;i<120 && (await p.evaluate(()=>window.__solo.st().respondFor!=null)); i++){ await clickDecline(p); await wait(100); }

  // ================= your own turn: Brilliant Tactic opens a window you hold first =================
  /* A FRESH PAGE: the Rival's turn above leaves its driver running, and a board staged under a live driver answers
     whatever window that driver opens next rather than the one the leg means. */
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
  // F
  await stage([[3,'C','bt3C'],[9,'D','ley9D'],[6,'S','x6S'],[9,'D','ley9X']], [[3,'S','r3S']]);
  await castMain('bt3C'); await waitBox(80); await yes();
  const f=await dragTo('ley9D', 'column');
  const f1=await p.evaluate(()=>({ staged:!!document.querySelector('#stagedSlot .card[data-id="ley9D"]'), go:!!(document.getElementById('stagedCastBtn')||{}).offsetParent }));
  ok(f && f.colOk && /stage/.test(f.hint) && f1.staged && f1.go, 'F · A DROP ON THE CAST COLUMN STAGES THE ANSWER, with ⚡ beside it  ['+JSON.stringify({drop:f, slot:f1})+']');
  await p.evaluate(()=>document.getElementById('stagedCastBtn').click());
  let f2=null; for(let i=0;i<60;i++){ await wait(100); f2=await row(); if(f2.hand.indexOf('ley9D')<0) break; }
  ok(f2.hand.indexOf('ley9D')<0 && f2.stack.some(o=>o.p===0 && o.id==='ley9D') && !(await p.evaluate(()=>!!document.querySelector('#stagedSlot .card[data-id="ley9D"]'))),
     '  …and the column\'s ⚡ casts it; the staging goes with the answer  ['+JSON.stringify({hand:f2.hand, stack:f2.stack})+']');
  for(let i=0;i<120 && (await p.evaluate(()=>window.__solo.st().respondFor!=null)); i++){ await clickDecline(p); await wait(100); }

  // G
  await stage([[3,'C','bt3C'],[5,'H','ann5H'],[6,'S','x6S'],[9,'D','ley9X']], [[3,'S','r3S']], {equip:true});
  await castMain('bt3C'); await waitBox(80); await yes();
  await tap('ann5H'); await wait(250);
  const g0=await row();
  await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(350);
  const g1=await p.evaluate(()=>({ mine:[...document.querySelectorAll('.eq.targetable')].length,
    rival:[...document.querySelectorAll('#rivalEquipZone .eq.targetable')].length }));
  ok(g0.ctx==='🎯 Choose target' && g1.mine===2 && g1.rival===0, 'G · ANNOINT ASKS WHICH OF YOUR EQUIPMENT IT PROTECTS — both of yours lit, the Rival\'s not  ['+JSON.stringify({ctx:g0.ctx, lit:g1})+']');
  await p.evaluate(()=>{ const bx=[...document.querySelectorAll('.eq.targetable')].filter(x=>/Spiked Armor/.test(x.textContent))[0]; if(bx) bx.click(); }); await wait(250);
  const g2=await row();
  await p.evaluate(()=>document.getElementById('ctxBtn').click());
  let g3=null; for(let i=0;i<60;i++){ await wait(100); g3=await row(); if(g3.hand.indexOf('ann5H')<0) break; }
  ok(g2.ctx==='⚡ Activate' && g2.ctxGold && g3.stack.some(o=>o.p===0 && o.id==='ann5H' && o.t==='eqB'), '  …and the Equipment you tapped is the one on the stack  ['+JSON.stringify({ctx:g2.ctx, gold:g2.ctxGold, stack:g3.stack})+']');
  for(let i=0;i<120 && (await p.evaluate(()=>window.__solo.st().respondFor!=null)); i++){ await clickDecline(p); await wait(100); }

  // H
  await stage([[3,'C','bt3C'],[7,'C','ap7C'],[1,'S','pA'],[13,'H','pK'],[9,'D','ley9X']], [[3,'S','r3S']], {queen:true});
  await castMain('bt3C'); await waitBox(80); await yes();
  await tap('ap7C'); await wait(250);
  await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(350);
  const h0=await p.evaluate(()=>({ flat:!document.querySelector('#hand .group'), fight:(document.getElementById('fightBtn').textContent||'').trim(), pass:(document.getElementById('passBtn').textContent||'').trim() }));
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="pK"]'); if(c) c.click(); }); await wait(200);
  await p.evaluate(()=>document.getElementById('fightBtn').click());
  let h1=null; for(let i=0;i<60;i++){ await wait(100); h1=await row(); if(h1.hand.indexOf('ap7C')<0) break; }
  ok(h0.flat && h0.fight==='Confirm' && h0.pass==='Cancel', 'H · ARMOR PIERCING UNDER A QUEEN ASKS WHICH BROADWAY CARD TO PITCH  ['+JSON.stringify(h0)+']');
  ok(h1.stack.some(o=>o.p===0 && o.id==='ap7C') && h1.hand.indexOf('pK')<0 && h1.hand.indexOf('pA')>=0, '  …and the King you chose is the card that goes  ['+JSON.stringify({hand:h1.hand, stack:h1.stack})+']');
  for(let i=0;i<120 && (await p.evaluate(()=>window.__solo.st().respondFor!=null)); i++){ await clickDecline(p); await wait(100); }

  // I
  await stage([[6,'C','f6C'],[9,'D','ley9D']], [[3,'S','r3S']]);
  await tap('f6C'); await wait(250); await clickFight(p);
  const iUp=await waitBox(80); await yes();
  await tap('ley9D'); await wait(300);
  const i0=await groupOf('ley9D'), i0f=await groupOf('f6C');
  /* THE GIVE-BACK IS READ WHERE THE BOARD HOLDS STILL: reopening the box ends the board answer the same way a cast or a
     Pass does. After a Pass the Fight flash is instant (ruling 17) and the play lands in the same tick, so the moment
     the pressed card is handed back is not there to sample. */
  await p.evaluate(()=>document.getElementById('respondBtn').click()); await wait(250);
  const iSel=await p.evaluate(()=>{ const sel=id=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="'+id+'"]'))[0]; return !!(g && g.classList.contains('gsel')); };
    return { sel:sel('f6C'), leySel:sel('ley9D'), box:document.getElementById('overlay').classList.contains('show') }; });
  await clickDecline(p);
  let iEnd=null; for(let i=0;i<80;i++){ await wait(100); iEnd=await p.evaluate(()=>{ const st=window.__solo.st(); return { pile:st.pile?st.pile.combo.cards.map(c=>c.id):[], hand:st.players[0].hand.map(c=>c.id) }; }); if(iEnd.pile.length) break; }
  ok(iUp && i0 && i0.sel && i0f && !i0f.sel, 'I · YOUR OWN FIGHT OPENS A WINDOW YOU HOLD FIRST; tapping Leyline borrows the selection from the pressed 6♣  ['+JSON.stringify({box:iUp, leyline:i0, six:i0f})+']');
  ok(iSel.box && iSel.sel && !iSel.leySel, '  …and leaving the board answer gives the pressed card back  ['+JSON.stringify(iSel)+']');
  ok(iEnd.pile.indexOf('f6C')>=0 && iEnd.hand.indexOf('ley9D')>=0, '  …and once the window is let go, the play lands as pressed  ['+JSON.stringify(iEnd)+']');

  // J
  const stackIds=()=>p.evaluate(()=>(window.__solo.st().stack||[]).map(o=>({oid:o.oid, p:o.p, id:o.card&&o.card.id, coid:o.opts&&o.opts.counterOid})));
  const declineAll=async()=>{ for(let i=0;i<120 && (await p.evaluate(()=>window.__solo.st().respondFor!=null)); i++){ await clickDecline(p); await wait(100); } };
  /* a fresh page again: leg I's play handed the Rival its turn, and its driver would answer the next leg's windows */
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
  await stage([[3,'C','bt3C'],[4,'D','cs4D'],[6,'S','x6S'],[9,'D','ley9X']], [[3,'S','r3S']]);
  await castMain('bt3C'); await waitBox(80); await yes();
  const btOid=(await stackIds()).filter(o=>o.id==='bt3C').map(o=>o.oid)[0];
  await tap('cs4D'); await wait(250);
  const j0=await row();
  await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(350);
  const j1=await row(), jAim=await p.evaluate(()=>[...document.querySelectorAll('#stackView .stkCard.aimed')].map(b=>b.getAttribute('data-oid')));
  ok(j0.ctx==='🎯 Choose target' && j1.hand.indexOf('cs4D')>=0 && j1.ctx==='⚡ Activate' && j1.ctxGold && jAim.length===1 && jAim[0]===btOid,
     'J · RULING 26: ⚡ ON COUNTER SPELL OPENS THE PICK — its one target is pre-chosen ON THE STACK, and nothing is cast yet  ['+JSON.stringify({first:j0.ctx, then:j1.ctx, aimed:jAim, bt:btOid, inHand:j1.hand.indexOf('cs4D')>=0})+']');
  await p.evaluate(()=>document.getElementById('ctxBtn').click());
  let j2=null; for(let i=0;i<60;i++){ await wait(100); j2=await stackIds(); if(j2.some(o=>o.id==='cs4D')) break; }
  ok(j2.some(o=>o.id==='cs4D' && o.p===0 && o.coid===btOid), '  …and the second ⚡ casts it, aimed at that object\'s oid  ['+JSON.stringify(j2)+']');
  await declineAll();
  // K
  await stage([[3,'C','bt3C'],[9,'D','ley9D'],[4,'D','cs4D'],[6,'S','x6S'],[9,'D','ley9X']], [[3,'S','r3S']]);
  await castMain('bt3C'); await waitBox(80); await yes();
  await tap('ley9D'); await wait(250); await p.evaluate(()=>document.getElementById('ctxBtn').click());
  await waitBox(80); await yes();
  const k0=await stackIds(), kBt=k0.filter(o=>o.id==='bt3C').map(o=>o.oid)[0], kLey=k0.filter(o=>o.id==='ley9D').map(o=>o.oid)[0];
  await tap('cs4D'); await wait(250); await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(350);
  const k1=await p.evaluate(()=>[...document.querySelectorAll('#stackView .stkCard[data-oid]')].map(b=>({oid:b.getAttribute('data-oid'), top:b.classList.contains('top'), t:b.classList.contains('targetable'), a:b.classList.contains('aimed'),
    purple:getComputedStyle(b.querySelector('.card')).boxShadow.indexOf('rgba(201, 139, 255')>=0 })));
  const k1r=await row();
  ok(k1.length===2 && k1.every(b=>b.t && !b.a && b.purple) && k1.some(b=>b.top) && !k1r.ctxGold && k1r.ctx==='🎯 Pick a target',
     'K · WITH TWO TARGETS NOTHING IS PRE-CHOSEN: both stack cards light, the top one too, in computed style  ['+JSON.stringify({cards:k1, ctx:k1r.ctx})+']');
  await p.evaluate(oid=>{ const c=document.querySelector('#stackView .stkCard[data-oid="'+oid+'"] .card'); if(c) c.click(); }, kBt); await wait(300);
  await p.evaluate(()=>document.getElementById('ctxBtn').click());
  let k2=null; for(let i=0;i<60;i++){ await wait(100); k2=await stackIds(); if(k2.some(o=>o.id==='cs4D')) break; }
  ok(k2.some(o=>o.id==='cs4D' && o.coid===kBt) && kLey && kBt!==kLey, '  …and the card you TAP is the one countered — the lower one, not the top  ['+JSON.stringify({stack:k2, tapped:kBt, top:kLey})+']');
  await declineAll();

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
