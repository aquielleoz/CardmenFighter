/* 🔍 View card reader gating (tight screens). The button only exists in its ≤720w/≤800h window, and it
 * must be DISABLED whenever there is no selected card — otherwise it opens the full-screen reader on nothing
 * but its own "Tap a card in your hand first" placeholder (reported by Aj against v1.27.0). Note that Clear
 * deselects for play but deliberately leaves the last card described, so the button correctly stays enabled
 * there. Run: node viewtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:390,height:780}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await p.waitForTimeout(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await p.waitForTimeout(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await p.waitForTimeout(1100);
  const st=()=>p.evaluate(()=>{const b=document.getElementById('viewCardBtn');
    return {shown:!!(b&&b.offsetParent!==null), disabled:b&&b.disabled, title:b&&b.title,
            readerOpen:document.getElementById('cardFull').classList.contains('show')};});
  let s=await st();
  ok(s.shown,'the 🔍 View button is visible at 390×780 (its ≤720w/≤800h window)');
  ok(s.disabled===true,'it starts DISABLED with nothing selected');
  ok(/Tap a card/.test(s.title),'its tooltip says to tap a card first');
  await p.evaluate(()=>document.getElementById('viewCardBtn').click()); await p.waitForTimeout(250);
  ok((await st()).readerOpen===false,'clicking it while disabled does NOT open the empty reader');
  await p.evaluate(()=>document.querySelector('#hand .card').click()); await p.waitForTimeout(300);
  s=await st();
  ok(s.disabled===false,'selecting a card ENABLES it');
  await p.evaluate(()=>document.getElementById('viewCardBtn').click()); await p.waitForTimeout(300);
  s=await st();
  ok(s.readerOpen===true,'it now opens the reader');
  ok(await p.evaluate(()=>!document.querySelector('#cardFull .cfEmpty')),'the reader shows a real card, not the placeholder');
  /* WHERE the close button IS, not just that it works. This suite already clicked it and never measured it —
     the inverse of `logtest`'s Save button, which was measured for fifteen versions and never clicked. Both
     halves matter: a control can be reachable by script and out of reach for a thumb. */
  const cb = await p.evaluate(()=>{ const b=document.getElementById('cardFullClose'),
      r=b.getBoundingClientRect(), R=document.getElementById('cardFull').getBoundingClientRect();
    return { off:Math.abs((r.left+r.width/2)-(R.left+R.width/2)), frac:(r.top+r.height/2-R.top)/R.height, h:Math.round(r.height) }; });
  ok(cb.off<8, 'the reader\'s close button is horizontally CENTRED ('+Math.round(cb.off)+'px off centre)');
  ok(cb.frac>0.66, '  → and sits in the bottom third, beside the 🔍 that opened it and the hand ('+Math.round(cb.frac*100)+'% down)');
  ok(cb.h>=44, '  → and is a real thumb target ('+cb.h+'px tall)');

  await p.evaluate(()=>document.getElementById('cardFullClose').click()); await p.waitForTimeout(250);
  // Clear deselects for play but deliberately leaves the last card described, so the reader still has
  // something real to show — the button stays enabled and that is correct, not a leak.
  await p.evaluate(()=>{const c=document.getElementById('clearBtn'); if(c)c.click();}); await p.waitForTimeout(350);
  ok((await st()).disabled===false,'after Clear the last-read card is still readable (reader is not empty)');
  await p.evaluate(()=>document.getElementById('viewCardBtn').click()); await p.waitForTimeout(300);
  ok(await p.evaluate(()=>!document.querySelector('#cardFull .cfEmpty')),'and it still opens on a real card, never the placeholder');
  /* TAPPING A ZONE CARD OPENS THE READER — BUT ONLY WHERE THE OVERLAY *IS* THE READER (v1.31.122).
     Aj: *"when we click equipments on the board, can we open the card viewer?"* `readCard` gates on whether
     `#viewCardBtn` is on screen, which is exactly the rule that hides `#side`, so there is no second
     breakpoint to drift.
     BOTH DIRECTIONS OR THIS PROVES NOTHING: a build that always opened the overlay would pass the positive
     half, and throwing a full-screen panel over a desktop board on every zone tap is the obvious way to get
     this wrong. The negative half runs at a size where the side panel exists. */
  await p.evaluate(()=>{
    const st=window.__solo.st();
    st.players[0].forms=[{rank:12,suit:'C',tier:'queen',name:'Hippolyta',card:{rank:12,suit:'C',id:'zf12C'}}];
    window.__solo.render();
  });
  await p.waitForTimeout(250);
  const zoneTap = await p.evaluate(()=>{
    /* `.formChip` on a phone (the collapsed strip), `.formMini` where the zone renders full cards —
       same gesture on the same thing, which is why both route through `readCard`. */
    const m=document.querySelector('.formChip, .formMini'); if(!m) return {staged:false, open:false, body:''};
    document.getElementById('cardFull').classList.remove('show');
    m.click();
    return { staged:true, open:document.getElementById('cardFull').classList.contains('show'),
             body:(document.querySelector('#cardFull .cfText')||{}).textContent||'' };
  });
  ok(zoneTap.staged, 'STAGED: a Forms mini-card is on the board to tap');
  ok(zoneTap.open===true, 'tapping a zone card OPENS the full reader where there is no side panel');
  ok(/Hippolyta|Q♣|12/.test(zoneTap.body) || zoneTap.body.length>0, '  → and the reader is showing that card, not an empty shell');

  /* EQUIPMENT, WHICH IS THE THING AJ ACTUALLY ASKED ABOUT, and it is the TWO-tap path: v1.31.111 made the
     collapsed chip's first tap "expand into the card", so the read is the SECOND tap. Same `readCard`, but
     asserted separately — "it is the same helper" is exactly the reasoning that has been wrong all day. */
  await p.evaluate(()=>{
    const st=window.__solo.st();
    st.players[0].equipment=[{ id:'ze1', name:'Caltrops', counters:3, card:{rank:7,suit:'S',id:'ze7S'} }];
    window.__solo.render();
  });
  await p.waitForTimeout(250);
  const eqTap = await p.evaluate(()=>{
    document.getElementById('cardFull').classList.remove('show');
    const chip=document.querySelector('.equipZone .eq'); if(!chip) return {staged:false, open:false, twoTap:false};
    chip.click();                                                      // 1st tap: expand the chip
    const expanded=document.querySelector('.equipZone .eq.eqOpen') || document.querySelector('.equipZone .eq');
    const afterFirst=document.getElementById('cardFull').classList.contains('show');
    expanded.click();                                                  // 2nd tap: read it
    return { staged:true, afterFirst:afterFirst,
             open:document.getElementById('cardFull').classList.contains('show') };
  });
  ok(eqTap.staged, 'STAGED: an equipment chip is on the board');
  ok(eqTap.afterFirst===false, '  → the FIRST tap expands the chip and does not open the reader (v1.31.111 behaviour intact)');
  ok(eqTap.open===true, '  → and the SECOND tap opens the card viewer — Aj\'s "when we click equipments on the board, can we open the card viewer?"');
  await p.evaluate(()=>document.getElementById('cardFull').classList.remove('show'));

  // …and the negative: where the side panel EXISTS, the tap must fill it and NOT throw an overlay up.
  await p.evaluate(()=>document.getElementById('cardFull').classList.remove('show'));
  await p.setViewportSize({width:1100, height:820}); await p.waitForTimeout(300);
  await p.evaluate(()=>window.__solo.render()); await p.waitForTimeout(200);
  const deskTap = await p.evaluate(()=>{
    const m=document.querySelector('.formChip, .formMini'); if(!m) return {staged:false, open:false};
    m.click();
    const side=document.getElementById('side');
    return { staged:true, open:document.getElementById('cardFull').classList.contains('show'),
             panelShown:!!(side && side.offsetParent!==null),
             btnShown:!!(document.getElementById('viewCardBtn')||{}).offsetParent };
  });
  ok(deskTap.staged && deskTap.panelShown && !deskTap.btnShown, 'STAGED: at 1100x820 the side panel is present and the 🔍 is not');
  ok(deskTap.open===false, '  → so the same tap does NOT throw the overlay up — it fills the panel, as before');
  await p.setViewportSize({width:390, height:780}); await p.waitForTimeout(200);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
