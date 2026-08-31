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
      // The GUARANTEE is that the hand is capped and scrollable, so it can never grow and shove the board off
      // screen. Asserting "it is currently scrolling" was racy: 10 cards fit on one row at these sizes, so
      // whether it overflows depends on how many cards happen to be in hand, and a round tick adds more.
      // Measured failing 1-2 runs in 3 on BOTH this build and the previous one (A/B'd), i.e. pre-existing.
      handCapped:(function(){ var cs=getComputedStyle(hand);
        return /auto|scroll/.test(cs.overflowY) && parseFloat(cs.maxHeight) > 0 &&
               hand.clientHeight <= parseFloat(cs.maxHeight) + 1; })(),
      handOverflows:hand.scrollHeight>hand.clientHeight+1,
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
    ok(g.handCapped && (!g.handOverflows || g.handScrolls),
       `${tag}: the hand is capped and scrollable, so a full hand can never shove the board off screen`);
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


  /* ---- DIALOGS, not the board (v1.31.14) ------------------------------------------------------------------
   * The v1.30.x landscape work fixed the in-game board and left every dialog alone. `.modal` had no max-height
   * and no overflow while `.overlay` CENTRES, so a modal taller than the viewport hung off the top AND the
   * bottom with nothing to scroll — the top half was simply unreachable. Measured on the setup dialog, which
   * is 812px tall: it clipped at 568x320 (top -246), 844x390, 667x375 AND desktop 1280x800. There is only one
   * .overlay/.modal pair in the markup, so setup, settings, the codex, the cheat sheet, the win overlay, the
   * name editor and the pile viewers all share this fix.
   * Reachability is asserted the way the board cases do it: SCROLL, then re-measure. */
  for(const [w,h,what] of [[568,320,'SE-1st/iPod'],[844,390,'iPhone 14'],[667,375,'iPhone 8'],[390,780,'portrait phone'],[1280,800,'desktop']]){
    const p=await open(w,h,2);
    await p.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(400);
    const tag=`dialog ${w}x${h} (${what})`;
    const m=await p.evaluate(()=>{
      const ov=document.getElementById('overlay'), md=document.getElementById('modal');
      if(!ov||!ov.classList.contains('show')) return null;
      const r=md.getBoundingClientRect();
      return { top:Math.round(r.top), bottom:Math.round(r.bottom), vh:window.innerHeight,
               capped:getComputedStyle(md).maxHeight!=='none', scrolls:md.scrollHeight>md.clientHeight+1 };
    });
    ok(!!m, `${tag}: the setup dialog opened`);
    if(m){
      ok(m.top>=0 && m.bottom<=m.vh+1,
         `${tag}: fully on screen — top ${m.top}, bottom ${m.bottom} of ${m.vh} (it used to hang off BOTH edges)`);
      ok(m.capped, `${tag}: the modal height is capped, which is what makes centring safe`);
      // the primary control must be REACHABLE, which below the fold means after scrolling the modal itself
      const reach=await p.evaluate(()=>{
        const md=document.getElementById('modal'); md.scrollTop=md.scrollHeight;
        const btns=md.querySelectorAll('button'); const last=btns[btns.length-1];
        if(!last) return null;
        const r=last.getBoundingClientRect();
        return { on:(r.top>=0 && r.bottom<=window.innerHeight+1), label:last.textContent.trim().slice(0,16) };
      });
      ok(reach && reach.on, `${tag}: its last control is reachable after scrolling ("${reach&&reach.label}")`);
    }
    await p.context().close();
  }

  /* The panels that do NOT go through the shared overlay, so one fix could not cover them.
   * #disconBar was pinned at a hardcoded top:54px, which assumed the 56px DESKTOP header — it floated 17px
   * low in landscape (37px header) and sat 38px INSIDE a wrapped portrait header (92px), over the controls.
   * The header's height depends on wrapping, so it is now MEASURED into --headerH at runtime. */
  for(const [w,h,what] of [[568,320,'landscape'],[844,390,'landscape'],[390,780,'portrait (header wraps)'],[1280,800,'desktop']]){
    const p=await open(w,h,2);
    const g=await p.evaluate(()=>{
      const hd=document.querySelector('header'), db=document.getElementById('disconBar'), tp=document.getElementById('tutPanel');
      const hr=hd.getBoundingClientRect();
      db.style.display='block'; const dr=db.getBoundingClientRect(); db.style.display='';
      tp.style.display='block'; tp.innerHTML='<h3>T</h3>'+'<p>line</p>'.repeat(14);
      const tr=tp.getBoundingClientRect(); const tcap=getComputedStyle(tp).maxHeight!=='none';
      tp.style.display=''; tp.innerHTML='';
      return { headerH:Math.round(hr.height), varH:getComputedStyle(document.documentElement).getPropertyValue('--headerH').trim(),
               dbTop:Math.round(dr.top), tpTop:Math.round(tr.top), tpBottom:Math.round(tr.bottom), tpCapped:tcap, vh:window.innerHeight };
    });
    const tag=`panels ${w}x${h} (${what})`;
    // within 1px: --headerH comes from offsetHeight (integer) and this measures a sub-pixel rect
    const varPx=parseFloat(g.varH)||0;
    ok(Math.abs(varPx-g.headerH)<=1, `${tag}: --headerH tracks the real header (${g.varH} vs ${g.headerH}px measured)`);
    ok(g.dbTop < g.headerH + 6 && g.dbTop > g.headerH - 12,
       `${tag}: #disconBar tucks just under the header at ${g.dbTop}px, not at a hardcoded 54`);
    ok(g.tpCapped && g.tpTop>=0 && g.tpBottom<=g.vh+1,
       `${tag}: the coach panel is capped and on screen — top ${g.tpTop}, bottom ${g.tpBottom} of ${g.vh}`);
    await p.context().close();
  }

  /* ---- A LONG BATTLE LOG MUST SCROLL, NOT GROW ----------------------------------------------------------
     `#board`'s play row was `minmax(min-content,1fr)` in BOTH portrait blocks, so the row grew to whatever its
     tallest child needed — and `#log` has no natural height. Measured at 360x740 before the fix: the row was
     **4218px** inside a 740px viewport, `#log` never scrolled (clientHeight === scrollHeight), and since the
     portrait board has no `overflow-y`, the hand was not below the fold but UNREACHABLE. Opening the log made
     the game unplayable, in solo as well as netplay.
     The landscape band already used `minmax(0,1fr)` and its comment named min-content as the cause; the two
     portrait blocks were never updated — so this asserts BOTH phone bands, and desktop/landscape as the
     negative half, since a global cap and a dead cap both pass a single measurement. */
  for(const [w,h,what] of [[360,740,'portrait phone'],[390,780,'portrait phone (tall band)'],
                           [844,390,'landscape phone'],[1280,800,'desktop']]){
    const p=await open(w,h,2); const tag=`${what} ${w}x${h}`;
    const m=await p.evaluate(()=>{
      const wrap=document.getElementById('logWrap');
      if(wrap.classList.contains('collapsed')) document.getElementById('logToggle').click();
      const log=document.getElementById('log');
      for(let i=0;i<70;i++){ const d=document.createElement('div'); d.className='le'; d.textContent='Rival moved '+i+' cards from deck to Energy — catch-up.'; log.appendChild(d); }
      const vh=document.documentElement.clientHeight, hw=document.getElementById('handWrap').getBoundingClientRect();
      return { vh, logClient:log.clientHeight, logScroll:log.scrollHeight,
               scrolls: log.scrollHeight>log.clientHeight+1, handBottom:Math.round(hw.bottom), handTop:Math.round(hw.top) };
    });
    ok(m.scrolls, `${tag}: a 70-entry log SCROLLS instead of growing (${m.logClient} of ${m.logScroll}px)`);
    ok(m.handBottom<=m.vh+1 && m.handTop>=0,
       `${tag}: and the hand is still on screen (y ${m.handTop}..${m.handBottom} of ${m.vh})`);
    await p.context().close();
  }

  /* ---- "↓ New" MUST BE REACHABLE WHEN THE LOG BARELY OVERFLOWS -------------------------------------------
     `logAtBottom()` decides whether a new entry auto-follows or raises the jump-to-newest button, and its slack
     was a flat 80px. Whenever the log overflowed by LESS than that, every scroll position read as "at the
     bottom" — so the button was unreachable and auto-follow yanked you back while you were reading history.
     Measured on desktop in a real solo game: 13 lines overflow by 23px, and scrolled fully to the TOP the old
     test still returned true. Aj reported it as a netplay gap; it reproduces in solo, because this is shared.
     The small-overflow case is the ONLY discriminating one — with a big history both the old and new rules
     raise the button — so trim the log until the overflow is under the old 80px slack before asserting. */
  {
    const p=await open(1280,620,2);
    await p.evaluate(()=>{ const wr=document.getElementById('logWrap'), t=document.getElementById('logToggle');
      if(wr.classList.contains('collapsed')&&t) t.click(); });
    await wait(300);
    /* Pad the log to a SMALL overflow rather than playing to it. Playing 14 turns also finishes the duel, which
       disables Fight and Pass and leaves nothing to trigger the final entry — the first version of this did
       exactly that, and only said so because the assertion prints why. One real action in round 1 is always
       legal, and the padding supplies the history the assertion needs. */
    const set=await p.evaluate(()=>{ const l=document.getElementById('log');
      while((l.scrollHeight-l.clientHeight)<=4 && l.children.length<400){
        var d=document.createElement('div'); d.className='le'; d.textContent='history'; l.appendChild(d); }
      l.scrollTop=0;
      return { max:Math.round(l.scrollHeight-l.clientHeight), lines:l.children.length }; });
    ok(set.max>4 && set.max<80,
       `log staged with a small overflow: ${set.max}px over ${set.lines} lines (must be under the old 80px slack to discriminate)`);
    const acted=await p.evaluate(()=>{ const l=document.getElementById('log'), n0=l.children.length;
      const c=document.querySelector('#hand .card'); if(c)c.click();
      const f=document.getElementById('fightBtn'), ps=document.getElementById('passBtn');
      if(f&&!f.disabled) f.click(); else if(ps&&!ps.disabled) ps.click();
      else { document.querySelectorAll('#hand .card.sel').forEach(e=>e.click());   // leave no selection behind
             return {ok:false, why:'both Fight and Pass were disabled — game over?', n0}; }
      return {ok:true, n0}; });
    await wait(800);
    const r=await p.evaluate(()=>{ const el=document.getElementById('logNewBtn'), l=document.getElementById('log');
      return { shown:el.classList.contains('show'), visible:el.offsetParent!==null,
               lines:l.children.length, scrollTop:Math.round(l.scrollTop) }; });
    ok(acted.ok && r.lines>acted.n0, `a real log line arrived while reading history (${acted.n0} → ${r.lines} lines${acted.ok?'':'; '+acted.why})`);
    ok(r.shown && r.visible,
       `↓ New appears when a line arrives while you are reading history (shown=${r.shown} visible=${r.visible})`);
    ok(r.scrollTop===0, `  → and you are NOT yanked to the bottom while reading (scrollTop ${r.scrollTop})`);
    await p.context().close();
  }

  /* ---- PEEK AT THE TABLE: EVERY CONTROL MUST BE CLICKABLE -------------------------------------------------
     Peek works by making `.overlay` nearly invisible (`rgba(10,4,16,.14)`, no blur) and LIFTING the panels above
     it. Those lifts were hardcoded — 35 for the panels, 60 for ↩ Back — and chosen when `.overlay` was 30.
     v1.31.36 raised `.overlay` to 100000 so the rules panel would stop opening behind `#netroot`, and buried
     every peek control under a backdrop you can see straight through: the board stayed fully legible and
     nothing responded. Aj: "trapped in limbooooo".
     NO DOM ASSERTION CAN SEE THIS. The elements are present, styled and wired; only a hit test can tell you
     what is actually on top. Since v1.31.61 the layers derive from `--zNetroot`, so this also guards the
     derivation — if someone reintroduces a bare number, one of these goes red.
     LIMIT, stated so nobody trusts it too far: this stages the peek CLASSES rather than finishing a duel and
     pressing 👁 Peek, because the stacking is pure CSS. It does not cover a JS regression in `enterPeek`
     itself (e.g. `#peekBar` never being created). */
  for(const [w,h,what] of [[390,780,'phone'],[1280,800,'desktop']]){
    const p=await open(w,h,2); const tag=`peek ${what} ${w}x${h}`;
    const rows=await p.evaluate(()=>{
      const ov=document.getElementById('overlay');
      ov.classList.add('show'); ov.classList.add('peeking');
      document.body.classList.add('peeking-board');
      if(!document.getElementById('peekBar')){
        const bar=document.createElement('button'); bar.id='peekBar'; bar.className='peekBar'; bar.innerHTML='↩ Back';
        document.body.appendChild(bar); }
      const hit=(el,label)=>{ const rc=el.getBoundingClientRect();
        if(rc.width<2||rc.height<2) return {label, skipped:true};      // e.g. #cardView: the description row is dropped on a phone
        const cx=Math.round(rc.left+rc.width/2), cy=Math.round(rc.top+rc.height/2);
        const top=document.elementFromPoint(cx,cy);
        return {label, z:getComputedStyle(el).zIndex,
                topEl: top?(top.id||top.tagName.toLowerCase()):'null',
                reaches: !!(top && (el===top || el.contains(top) || top.contains(el)))}; };
      const out=[];
      ['peekBar','logWrap','handWrap','cardView'].forEach(id=>{const el=document.getElementById(id); if(el) out.push(hit(el,'#'+id));});
      const card=document.querySelector('#hand .card'); if(card) out.push(hit(card,'a hand card'));
      return out;
    });
    rows.filter(r=>!r.skipped).forEach(r=>
      ok(r.reaches, `${tag}: ${r.label} is clickable (z ${r.z}, topmost there: ${r.topEl})`));
    await p.context().close();
  }

  /* ---- THE BOARD MUST NEVER SCROLL SIDEWAYS, AND THE ZONES MUST NOT COVER THE PILE ---------------------
     Aj, 2026-08-29: "the hand information just bleeds into outer space on my small mobile screen", and a
     separate screenshot of the Forms & Rides label sitting on top of a Full House. Both were the same cause:
     `.fighter` declared `flex-wrap:wrap` AND `flex:0 0 auto`, so the row could never shrink, sat at its
     max-content width (394px inside a 327px screen) and put `main` into horizontal scroll — which then shifted
     the whole board and dragged the corner-pinned zones across the pile. Measured before the fix: 5 of 5 pile
     cards overlapped at 390px. After: 0 at every width.
     The round banner was a second, transient source — `.rfInner::before` is a deliberately oversized glow
     (`width:150%`), and its right-hand bleed extended the scroll box for the ~1.3s the banner shows.
     Zones are STAGED here: with no Forms or equipment in play they do not render at all, and the assertion
     would pass on a board that cannot show the bug. */
  for(const [w,h,what] of [[327,660,'narrow phone'],[390,780,'phone'],[1280,800,'desktop']]){
    const p=await open(w,h,2); const tag=`${what} ${w}x${h}`;
    const m=await p.evaluate(()=>{
      const st=window.__solo.st();
      const F=(r,su,t)=>({rank:r,suit:su,tier:t,name:t==='ride'?'Giant Ram':'Pandora',card:{rank:r,suit:su,id:'f'+r+su}});
      const EQ=(n,r,su)=>({id:'eq'+r+su,name:n,delta:1,oppDelta:0,counters:3,decay:true,card:{rank:r,suit:su,id:'e'+r+su}});
      st.players[0].forms=[F(11,'C','ride'),F(12,'S','queen')];
      st.players[1].forms=[F(11,'D','ride'),F(12,'H','queen')];
      st.players[0].equipment=[EQ("Hero's Javelin",2,'D')];
      st.players[1].equipment=[EQ("Cursed Pendant",8,'D')];
      st.pile={ combo:{type:'fullhouse', value:9, size:5, key:[9],
        cards:[{rank:9,suit:'C',id:'p1'},{rank:9,suit:'H',id:'p2'},{rank:9,suit:'S',id:'p3'},{rank:3,suit:'D',id:'p4'},{rank:3,suit:'H',id:'p5'}] }, owner:1 };
      window.__solo.render();
      const mn=document.querySelector('main');
      const zr=[...document.querySelectorAll('.formZone,.equipZone')].filter(e=>e.getBoundingClientRect().width>2)
                .map(e=>e.getBoundingClientRect());
      const ov=(a,b)=>Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top));
      let worst=0;
      [...document.querySelectorAll('#pile .card')].forEach(c=>{ const cr=c.getBoundingClientRect(), area=cr.width*cr.height;
        let cov=0; zr.forEach(z=>{ cov+=ov(cr,z); }); if(area) worst=Math.max(worst, cov/area); });
      return { scrollW:mn.scrollWidth, clientW:mn.clientWidth, zones:zr.length,
               piles:document.querySelectorAll('#pile .card').length, worst:Math.round(worst*100) };
    });
    ok(m.zones>0 && m.piles>0, `${tag}: staged — ${m.zones} zones and ${m.piles} pile cards on screen`);
    ok(m.scrollW<=m.clientW+1, `${tag}: the board does NOT scroll sideways (${m.scrollW} vs ${m.clientW})`);
    ok(m.worst<5, `${tag}: no pile card is covered by a Forms/equipment zone (worst ${m.worst}%)`);
    await p.context().close();
  }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
