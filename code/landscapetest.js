/* LANDSCAPE / SHORT-VIEWPORT layout. A phone held sideways is ~844x390, which MISSES the phone branch
 * (@media max-width:720px and max-height:800px) because it is 844 WIDE — so it got the full desktop layout
 * inside 390px of height. Measured before the landscape block existed:
 *   844x390 : header 56 + hand region 213 left the play area 57px tall — and a card is 66px, so the pile
 *             could not render a single card.
 *   667x375 : the hand and the whole action bar sat 136px BELOW the viewport, unreachable.
 *   667x375 6p : the opponents strip wrapped to two rows (172px) and pushed the action bar 60px off screen.
 * The fix keeps the DESKTOP STRUCTURE (three-column board, side panel, hand along the bottom) and only
 * reclaims vertical space inside it — so these assertions check reachability and collisions, not a new layout.
 *
 * Every case is the WORST case for its size: battle log OPEN, hand stuffed to MAX_HAND, 5-card pile staged.
 * Run: node landscapetest.js */
const { chromium }=require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
// [w, h, players, label]
/* 568x320 is the FLOOR — iPhone 5/5s/SE-1st and the iPod touch 7th gen (sold to 2022) are all this size in
 * landscape. It cannot fit on one screen without hiding real controls, so below 340px tall the contract
 * changes: the board SCROLLS and nothing overlaps, rather than everything fitting. 640x360 still fits. */
const CASES=[
  [568,320,2,'SE-1st/iPod'], [568,320,6,'SE-1st/iPod 6p'],
  [640,360,6,'budget Android 6p'],
  [667,375,2,'iPhone SE'], [667,375,6,'iPhone SE 6p'],
  [800,360,4,'Android 4p'], [844,390,2,'iPhone 13/14'], [844,390,6,'iPhone 13/14 6p'],
  [932,430,6,'14 Pro Max 6p'],
];
(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const errs=[];

  async function open(w,h,np){
    const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage();
    p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL); await wait(600);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
    if(np>2){ await p.evaluate(n=>{const s=document.getElementById('setPlayers'); s.value=String(n); s.dispatchEvent(new Event('change'));},np); await wait(350); }
    await p.evaluate(()=>{const g=document.getElementById('goFirstBtn'); if(g)g.click();}); await wait(1400);
    return p;
  }
  // worst case: log open + full hand + a 5-card pile
  async function stress(p){
    await p.evaluate(()=>{const t=document.getElementById('logToggle')||document.querySelector('#logWrap .logTab,#logWrap button'); if(t)t.click();}); await wait(350);
    await p.evaluate(()=>{ const st=window.__solo.st(), E=window.CardmenEngine;
      const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
      st.players[0].hand=[3,4,5,6,7,8,9,10,11,12].map((r,i)=>mk(r,'HDCS'[i%4],'h'+i));
      st.pile={ combo:E.detectCombo([mk(3,'D','p'),mk(4,'D','p'),mk(5,'D','p'),mk(6,'D','p'),mk(7,'D','p')]), byPlayer:1 };
      window.__solo.render(); }); await wait(450);
  }
  const geom=p=>p.evaluate(()=>{
    const R=s=>{const e=document.querySelector(s); if(!e) return null; const c=getComputedStyle(e);
      if(c.display==='none') return {none:true}; const r=e.getBoundingClientRect();
      return {t:Math.round(r.top),b:Math.round(r.bottom),l:Math.round(r.left),r:Math.round(r.right),h:Math.round(r.height),w:Math.round(r.width)};};
    const pileCards=[].map.call(document.querySelectorAll('#pile .card'),c=>c.getBoundingClientRect());
    let wrapped=false; for(let i=1;i<pileCards.length;i++) if(pileCards[i].left<=pileCards[i-1].left) wrapped=true;
    const hand=document.getElementById('hand');
    return { vh:innerHeight, vw:innerWidth, pile:R('#pile'), table:R('#table'), handWrap:R('#handWrap'),
      actions:R('#actions'), side:R('#side'), opp:R('#opponents'), log:R('#logWrap'),
      nPile:pileCards.length, pileCardH:pileCards.length?Math.round(pileCards[0].height):0, pileWrapped:wrapped,
      boardScrolls:(()=>{const b=document.getElementById('board'); return b.scrollHeight>b.clientHeight+1;})(),
      handScrolls:hand.scrollHeight>hand.clientHeight+1,
      handCardH:(()=>{const c=document.querySelector('#hand .card'); return c?Math.round(c.getBoundingClientRect().height):0;})() };
  });

  for(const [w,h,np,label] of CASES){
    const p=await open(w,h,np); await stress(p);
    const g=await geom(p);
    const tag=`${label} ${w}x${h}`;
    // Below the floor the promise is reachable-by-scrolling, not all-on-one-screen. Two ways to be below it:
    // very short (<=340px, any width), or NARROW and short (<=364px and <=720px). 800x360 is equally short but
    // wide, and fits with room to spare — so width is part of the rule, not just height.
    const FLOOR = h<=340 || (h<=364 && w<=720);
    // 1. THE action bar must be REACHABLE — this is what was broken outright (136px and 60px off screen).
    //    At the floor that means "after scrolling the board", so scroll it and re-measure rather than
    //    relaxing the check into something that proves nothing.
    if(!FLOOR){
      ok(g.actions.b<=g.vh+1, `${tag}: the action bar is on screen (bottom ${g.actions.b} <= ${g.vh})`);
    } else {
      ok(g.boardScrolls, `${tag}: the board scrolls instead of overlapping (the floor's contract)`);
      const reach=await p.evaluate(()=>{ const b=document.getElementById('board');
        b.scrollTop=b.scrollHeight; const r=document.getElementById('actions').getBoundingClientRect();
        return {b:Math.round(r.bottom), t:Math.round(r.top), vh:innerHeight}; });
      ok(reach.b<=reach.vh+1 && reach.t>=0, `${tag}: the action bar is reachable by scrolling (${reach.t}-${reach.b} in ${reach.vh})`);
    }
    // 2. the pile must not be drawn over the hand — the play-area track collapsing under a tall hand region.
    //    Asserted with a real MARGIN, not >=0. This assertion flaked twice in 22 runs back when the tightest
    //    clearance was 2-8px: #message and #hint change height with game state, so a near-zero margin fails
    //    intermittently and trains you to ignore the suite. Requiring 8px turns any future erosion into a
    //    deterministic failure instead. Current clearances: 13px at 800x360 (tightest), 29-51px elsewhere.
    const SLACK=8;
    ok(g.handWrap.t-g.pile.b>=SLACK, `${tag}: the pile clears the hand by >=${SLACK}px (got ${g.handWrap.t-g.pile.b}px)`);
    // 3. the play area must be tall enough to actually SHOW a pile card, the original 57px-vs-66px failure
    ok(g.table.h>=g.pileCardH+8, `${tag}: the play area fits a pile card (${g.table.h}px area, ${g.pileCardH}px card)`);
    // and at the floor, confirm the degradation is the SCROLL and not a silently clipped board
    if(FLOOR) ok(g.handWrap.t>=g.table.b-1, `${tag}: the hand starts below the play area, never on top of it (${g.handWrap.t} >= ${g.table.b})`);
    // 4. a 5-card special must stay on one row (it is the widest thing the pile ever shows)
    ok(g.nPile===5 && !g.pileWrapped, `${tag}: a 5-card special does not wrap (${g.nPile} cards)`);
    // 5. an over-full hand scrolls rather than growing without bound
    ok(g.handScrolls, `${tag}: a 10-card hand scrolls instead of pushing the board off screen`);
    // 6. it is still the DESKTOP layout: the card-description column stays wherever width allows it
    if(w>=721) ok(!g.side.none, `${tag}: keeps the desktop side panel (width is the abundant axis here)`);
    else ok(!!g.side.none, `${tag}: below 721px the phone branch still hides the side panel`);
    await p.context().close();
  }

  /* Portrait and tall screens must be untouched — the branch is gated on orientation AND max-height:520px,
   * so this is the negative half of the spec. iPad landscape is 768 tall: landscape, but NOT short. */
  for(const [w,h,what,expectFull] of [[390,780,'portrait phone',true],[1024,768,'iPad landscape',true],[1400,1000,'desktop',true]]){
    const p=await open(w,h,2);
    const g=await geom(p);
    // >=66 rather than ===66: 1400x1000 correctly gets the min-width:1200px step (66 x 1.18 = 78). What
    // matters is that nothing here is SHRUNK by the landscape block.
    ok(g.handCardH>=66, `${what} ${w}x${h} is NOT shrunk by the landscape block: hand card ${g.handCardH}px (>=66)`);
    await p.context().close();
  }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
