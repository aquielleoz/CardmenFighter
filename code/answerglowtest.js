/* THE ANSWER GLOW (drag-and-stack step 4, piece 6).
 *
 * Ruling 7 (Aj, 2026-10-13): *"you cards that can be cast glow"*. After Yes, every card in your hand that the ENGINE
 * says you may cast in this window (`E.canCastQuick`) glows green. The claim is what the player SEES, so every leg
 * reads the COMPUTED style, never the class: carrying `.tut-spot` was not glowing (v1.33.15), because the hover,
 * `.sel`/`.gsel` and `.enter` rules each won the cascade over a one-class glow. Staged and read in ONE evaluate, on
 * ONE element, because `renderHand` rebuilds every card on every render.
 *   A  the box is up: nothing glows yet — the glow is Yes's
 *   B  after Yes, exactly the engine's castable set glows (`castableQuicks`): the two Leylines; a fight card does not,
 *      and neither does Annoint with no Equipment to protect — no legal target, no glow
 *   C  a card still flying in (`.enter`) keeps the pulse after its deal-in
 *   D  a selected glowing card still glows, under its gold selection outline
 *   E  a hovered glowing card still glows
 *   F  a lesson's spotlight and the glow are BOTH drawn on one card (one keyframe, two rings)
 *   G  a staged card holds the board (ruling 29): the other Leyline stops glowing, and ✕ brings it back
 *   H  once you pass, nothing glows
 *   R  reduced motion: no animation, and a STATIC ring that still wins on a selected and a hovered card
 *   P  a portrait phone: the same glow, in computed style
 *
 * Run: node answerglowtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1&prompts=all';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const GREEN='rgb(82, 224, 143)', GOLD='rgb(232, 195, 122)';

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;}; const errs=[];
  async function open(ctxOpts){
    const p=await (await b.newContext(Object.assign({viewport:{width:1280,height:800}}, ctxOpts||{}))).newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
    return p; }
  /* your Main, round 4: Brilliant Tactic cast in ON opens a window you hold first. Two Leylines (castable), a fight
     card, and Annoint with no Equipment of yours (a Quick with no legal target). Energy for both Leylines. */
  async function stage(p){
    for(let i=0;i<60 && await p.evaluate(()=>window.__solo.castHold()); i++) await wait(100);
    await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.stack=[]; st.respondFor=null; st.pending=null; st.round=4; st.turn=0; st.subPhase='main'; st.pile=null; st.lastPlayer=null; st.passes=0;
      st.resolution=null; st.cleanup=null; st.endCleanup=null; st.upkeep=null; st.prioPassed={};
      const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,s,(t||'')+s+'e'+n));
      st.players[0].hand=[mk(3,'C','bt3C'),mk(9,'D','ley9D'),mk(6,'S','x6S'),mk(5,'H','ann5H'),mk(9,'D','ley9X')];
      st.players[0].energy=E('D').concat(E('H'),E('C'),E('S'),E('D','x'));
      st.players[1].hand=[mk(3,'S','r3S')]; st.players[1].energy=E('D');
      st.players[0].forms=[]; st.players[1].forms=[]; st.players[0].equipment=[]; st.players[1].equipment=[]; st.players[0].nextPlayBoost=0;
      window.__solo.render(); });
    await wait(400);
    await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="bt3C"]'))[0]; if(g) g.click(); }); await wait(250);
    await p.evaluate(()=>document.getElementById('ctxBtn').click());
    for(let i=0;i<80;i++){ if(await p.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); })) return true; await wait(100); }
    return false; }
  const yes=async p=>{ await p.evaluate(()=>document.getElementById('respYes').click()); await wait(350); };
  // the computed glow of every hand card, read in one go
  const glow=p=>p.evaluate(()=>{ const o={}; document.querySelectorAll('#hand .card[data-id]').forEach(el=>{ const cs=getComputedStyle(el);
    o[el.getAttribute('data-id')]={ cls:el.classList.contains('answerable'), shadow:cs.boxShadow, anim:cs.animationName, outline:cs.outlineColor }; }); return o; });
  const lit=(g,id)=>!!(g[id] && g[id].shadow.indexOf('rgb(82, 224, 143)')>=0);
  const tap=(p,id)=>p.evaluate(id=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="'+id+'"]'))[0]; if(g) g.click(); }, id);

  // ===================== desktop =====================
  const p=await open();
  ok(await stage(p), 'STAGED: your own cast opened a window you hold, and the box is up');
  // A — RENDER FIRST: the box opens without a render, so reading the hand as it was would pass on a build that glows
  // under the box. A guest re-renders on every mirror while its box is up, so this is the state a player can reach.
  await p.evaluate(()=>window.__solo.render()); await wait(100);
  const a=await glow(p);
  ok(!Object.keys(a).some(id=>a[id].cls || lit(a,id)), 'A · WITH THE BOX UP NOTHING GLOWS — the glow is what Yes gives you  ['+Object.keys(a).filter(id=>a[id].cls).join(',')+']');
  // B
  await yes(p);
  const bg=await glow(p), want=(await p.evaluate(()=>window.__solo.castableQuicks().map(q=>q.id))).sort();
  const got=Object.keys(bg).filter(id=>lit(bg,id)).sort();
  ok(JSON.stringify(got)===JSON.stringify(want) && got.indexOf('ley9D')>=0 && got.indexOf('ley9X')>=0,
     'B · AFTER YES EXACTLY THE ENGINE\'S CASTABLE SET GLOWS, in computed style  ['+JSON.stringify({glowing:got, engine:want})+']');
  ok(!lit(bg,'x6S') && !lit(bg,'ann5H') && !bg.ann5H.cls, '  …a fight card does not, and nor does Annoint with no Equipment to protect (no legal target, no glow)  ['+JSON.stringify({six:bg.x6S&&bg.x6S.shadow.slice(0,40), annoint:bg.ann5H&&bg.ann5H.shadow.slice(0,40)})+']');
  // C
  const c=await p.evaluate(()=>{ const el=document.querySelector('#hand .card[data-id="ley9X"]'); el.classList.add('enter'); const an=getComputedStyle(el).animationName; el.classList.remove('enter'); return an; });
  ok(/dealIn/.test(c) && /answerPulse/.test(c), 'C · A CARD STILL FLYING IN KEEPS THE PULSE after its deal-in  ['+c+']');
  // D
  await tap(p,'ley9D'); await wait(450);
  const d=await glow(p);
  const dSel=await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="ley9D"]'))[0]; return !!(g && g.classList.contains('gsel')); });
  ok(dSel && lit(d,'ley9D') && d.ley9D.outline===GOLD, 'D · A SELECTED GLOWING CARD STILL GLOWS, under its gold selection outline  ['+JSON.stringify({sel:dSel, shadow:d.ley9D.shadow.slice(0,60), outline:d.ley9D.outline})+']');
  // E
  { const r=await p.evaluate(()=>{ const x=document.querySelector('#hand .card[data-id="ley9X"]').getBoundingClientRect(); return {x:x.left+x.width/2, y:x.top+x.height/2}; });
    await p.mouse.move(r.x, r.y); await wait(250); }
  const e=await glow(p);
  ok(lit(e,'ley9X'), 'E · A HOVERED GLOWING CARD STILL GLOWS  ['+e.ley9X.shadow.slice(0,60)+']');
  await p.mouse.move(5,5);
  // F
  const f=await p.evaluate(()=>{ const el=document.querySelector('#hand .card[data-id="ley9X"]'); el.classList.add('tut-spot'); const s=getComputedStyle(el).boxShadow; el.classList.remove('tut-spot'); return s; });
  ok(f.indexOf(GREEN)>=0 && f.indexOf(GOLD)>=0, 'F · A LESSON\'S SPOTLIGHT AND THE GLOW ARE BOTH DRAWN on one card  ['+f.slice(0,90)+']');
  // G
  { const r=await p.evaluate(()=>{ const x=document.querySelector('#hand .card[data-id="ley9D"]').getBoundingClientRect(); return {x:x.left+x.width/2, y:x.top+x.height/2}; });
    const t=await p.evaluate(()=>{ const z=document.getElementById('castZone').getBoundingClientRect(); return {x:z.left+z.width/2, y:z.top+z.height/2}; });
    await p.mouse.move(r.x,r.y); await p.mouse.down(); await p.mouse.move(r.x,r.y-24,{steps:4}); await p.mouse.move(t.x,t.y,{steps:14}); await wait(80); await p.mouse.up(); await wait(400); }
  const g1=await glow(p), staged=await p.evaluate(()=>!!document.querySelector('#stagedSlot .card[data-id="ley9D"]'));
  await p.evaluate(()=>document.getElementById('unstageBtn').click()); await wait(350);
  const g2=await glow(p);
  ok(staged && !lit(g1,'ley9X') && lit(g2,'ley9X'), 'G · A STAGED CARD HOLDS THE BOARD: the other Leyline stops glowing, and ✕ brings it back  ['+JSON.stringify({staged:staged, whileStaged:lit(g1,'ley9X'), afterX:lit(g2,'ley9X')})+']');
  // H
  await p.evaluate(()=>document.getElementById('passBtn').click()); await wait(500);
  const h=await glow(p);
  ok(!Object.keys(h).some(id=>h[id].cls || lit(h,id)), 'H · ONCE YOU PASS, NOTHING GLOWS  ['+Object.keys(h).filter(id=>h[id].cls).join(',')+']');

  // ===================== reduced motion =====================
  const r=await open({reducedMotion:'reduce'});
  await stage(r); await yes(r);
  const r1=await glow(r);
  await tap(r,'ley9D'); await wait(450);
  { const x=await r.evaluate(()=>{ const q=document.querySelector('#hand .card[data-id="ley9X"]').getBoundingClientRect(); return {x:q.left+q.width/2, y:q.top+q.height/2}; }); await r.mouse.move(x.x,x.y); await wait(250); }
  const r2=await glow(r);
  ok(r1.ley9D && r1.ley9D.anim==='none' && lit(r1,'ley9D'), 'R · REDUCED MOTION: no animation, and the ring is still drawn  ['+JSON.stringify({anim:r1.ley9D&&r1.ley9D.anim, shadow:r1.ley9D&&r1.ley9D.shadow.slice(0,50)})+']');
  ok(lit(r2,'ley9D') && lit(r2,'ley9X'), '  …and the static ring still wins on a SELECTED card and a HOVERED one  ['+JSON.stringify({selected:r2.ley9D.shadow.slice(0,50), hovered:r2.ley9X.shadow.slice(0,50)})+']');

  // ===================== portrait phone =====================
  const ph=await open({viewport:{width:390,height:844}, isMobile:true, hasTouch:true});
  await stage(ph); await yes(ph);
  const pg=await glow(ph);
  ok(lit(pg,'ley9D') && lit(pg,'ley9X') && !lit(pg,'x6S'), 'P · A PORTRAIT PHONE: the same glow, in computed style  ['+Object.keys(pg).filter(id=>lit(pg,id)).join(',')+']');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
