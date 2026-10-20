/* THE PORTRAIT-PHONE HAND (2026-09-04). Aj played a real game on his phone: *"it's really crowding there…
 * especially with rides and forms and the equipment and then the targeting"*.
 * `landscapetest` guards the SIDEWAYS phone (short and wide). Nothing guarded PORTRAIT with a real hand — and
 * a real hand is not six cards: `MAX_HAND` is an END-OF-TURN discard limit, so a player is on turn holding
 * more than ten on 78% of turns, and 17 has been seen.
 *
 * MEASURED BEFORE BUILDING, at 393x852 with 13 cards: four rows of 66px plus 18px of gaps = 270px of cards
 * inside a 187px box, so 83px of the hand was scrolled out of sight — on a board where the play area was
 * simultaneously starved. Wrapped rows now ride over the one above (`--handLap`), which shrinks the hand's
 * FOOTPRINT rather than fitting more into the same box: at 360x800 the hand went 172 -> 146px and the play
 * area 181 -> 207px.
 * Two details the measurement forced, neither of them guessable:
 *   - a `.group` is [cards][label], so pulling the next row up covers the LABEL first — 2 of 3 "Pair" labels
 *     were hidden until the label moved above the cards. Labels only render in the PAIRS/STRAIGHTS sort, so a
 *     hand of distinct ranks tests nothing: this suite sorts first.
 *   - one row must not move at all; the saving only exists from the second row on.
 * Run: node phonetest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const SIZES=[[393,852,'iPhone-class portrait'],[360,800,'small Android portrait'],[412,915,'Pixel-class portrait']];
// three pairs + a trio + singles, so the PAIRS sort really produces labelled groups
const GROUPED=[[5,'D'],[5,'S'],[7,'C'],[7,'H'],[9,'D'],[9,'C'],[9,'S'],[4,'H'],[6,'S'],[10,'D'],[11,'C'],[12,'H'],[13,'S']];

const stage = (p,hand) => p.evaluate((H)=>{ const st=window.__solo.st();
  st.players[0].hand=H.map((c,i)=>({rank:c[0],suit:c[1],id:'g'+i})); window.__solo.render(); }, hand);
const sortToPairs = async p => { for(let i=0;i<4;i++){
  const t=await p.evaluate(()=>{ const b=document.getElementById('sortBtn'); if(b)b.click();
    return (document.getElementById('sortBtn')||{}).textContent||''; });
  await wait(250); if(/Pairs/.test(t)) return true; } return false; };

const read = p => p.evaluate(()=>{
  const hand=document.getElementById('hand'); const hb=hand.getBoundingClientRect();
  const cards=[...hand.querySelectorAll('.card')], lbls=[...hand.querySelectorAll('.glabel')];
  const kids=[...hand.querySelectorAll('*')];
  // a label is LOST if a card that paints later (a lower row) sits on top of it
  const covered=lbls.filter(l=>{ const lr=l.getBoundingClientRect(); if(lr.width===0) return false;
    const li=kids.indexOf(l);
    return cards.some(c=>{ const cr=c.getBoundingClientRect();
      return kids.indexOf(c)>li && cr.left<lr.right-1 && cr.right>lr.left+1 && cr.top<lr.bottom-1 && cr.bottom>lr.top+1; }); });
  return { h:Math.round(hb.height), clipped:hand.scrollHeight-Math.round(hb.height),
           rows:new Set(cards.map(c=>Math.round(c.getBoundingClientRect().top))).size,
           labels:lbls.length, covered:covered.length,
           table:Math.round(document.getElementById('table').getBoundingClientRect().height) };
});

/* THE ACTION ROW (v1.31.104). Reads what each button actually SHOWS — the ::before that `font-size:0` swaps in
 * — alongside the text still in the DOM, so the suite can tell "collapsed to a symbol" from "lost its label". */
const actionRow = p => p.evaluate(()=>{
  const ids=['sortBtn','clearBtn','viewCardBtn','ctxBtn','passBtn','fightBtn'];
  const bs=ids.map(id=>{ const e=document.getElementById(id); if(!e) return {id,gone:true};
    const r=e.getBoundingClientRect(); if(!r.width) return {id,hidden:true};
    const cs=getComputedStyle(e), before=getComputedStyle(e,'::before').content;
    return { id, y:Math.round(r.top), w:Math.round(r.width), text:(e.textContent||'').trim(),
             fs:parseFloat(cs.fontSize), icon:(before&&before!=='none')?before.replace(/^"|"$/g,''):'',
             data:e.getAttribute('data-icon')||'' }; }).filter(x=>!x.gone&&!x.hidden);
  /* BUCKET THE ROWS, NEVER `new Set(top)`. Buttons on the SAME visual row differ by a pixel — `#sortBtn` holds
     text and the others hold a ::before glyph, so their boxes baseline-align 1px apart, and a distinct-top count
     called a perfectly good single row TWO. Found the moment 🔍 made it six buttons. */
  const tops=bs.map(x=>x.y).sort((a,b)=>a-b), rows=tops.length?1+tops.filter((y,i)=>i&&y-tops[i-1]>6).length:0;
  return { bs, rows, h:Math.round(document.getElementById('actions').getBoundingClientRect().height) };
});

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const errs=[];
  for(const [w,h,label] of SIZES){
    const ctx=await b.newContext({viewport:{width:w,height:h}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(label+': '+e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1100);
    /* NO MOVE TO THE FIGHT SUB-PHASE NEEDED ANY MORE. This file measures the ACTION ROW, and it used to step out
       of Main first because `#fightBtn` was the always-enabled `Next` there (no off state to compare) and Pass
       was hidden. Since drag-and-stack step 1 Main renders the whole row and Fight rests disabled until a legal
       selection, so both claims hold in Main. */

    await stage(p, GROUPED); ok(await sortToPairs(p), `${label} ${w}×${h}: sorted by pairs`);
    await wait(300);
    const many = await read(p);
    /* NOT VACUOUS: without labels on screen the coverage check proves nothing, and without MULTIPLE ROWS the
     * overlap is not exercised at all — a one-row hand is correctly untouched. */
    ok(many.labels>0, `  → the pairs sort really produced ${many.labels} group labels`);
    ok(many.rows>1, `  → 13 cards really wrap to ${many.rows} rows`);
    ok(many.covered===0, `  → no group label is covered by the row below it (${many.covered} of ${many.labels})`);
    ok(many.clipped===0, `  → the whole hand is visible, nothing scrolled out of sight (clipped ${many.clipped}px)`);

    // one row must be untouched: the saving starts at the second row
    await stage(p, GROUPED.slice(0,4)); await wait(300);
    const few = await read(p);
    ok(few.rows===1 && few.clipped===0, `  → a one-row hand is left alone (${few.rows} row, clipped ${few.clipped})`);

    /* ---- THE HEADER IS ONE ROW AND THE WORDMARK STACKS ---- (v1.31.105)
       Measured before building, at 390×780 / 360×800 / 414×896: 92px in all three — 11.8% of the screen at 390
       — with a 157px title alone on line 1 and six buttons wrapping beside and below it. 54px after. */
    const hdr = await p.evaluate(()=>{
      const h=document.querySelector('header'), r=h.getBoundingClientRect();
      /* HEIGHT, not width. `header .spacer` is `flex:1` — full width and ZERO height — so it reports a top
         halfway down the bar and a width-only filter counted a perfectly good single row as two. */
      const kids=[...h.children].filter(e=>e.getBoundingClientRect().height>3)
        .map(e=>({id:e.id||e.tagName.toLowerCase(), y:Math.round(e.getBoundingClientRect().top)}));
      const tops=kids.map(k=>k.y).sort((a,b)=>a-b);
      const words=[...h.querySelectorAll('h1 .tWord')].map(e=>Math.round(e.getBoundingClientRect().top));
      return { h:Math.round(r.height), rows:tops.length?1+tops.filter((y,i)=>i&&y-tops[i-1]>8).length:0,
               buttons:[...h.querySelectorAll(':scope > button, :scope > * > button')]
                 .filter(e=>e.getBoundingClientRect().width>0).map(e=>e.id),
               wordLines:new Set(words).size,
               headerH:getComputedStyle(document.documentElement).getPropertyValue('--headerH').trim() };});
    ok(hdr.rows===1, `  → the header is ONE row (${hdr.rows}), ${hdr.h}px`);
    ok(hdr.h<70, `  → and it is well under the 92px it used to cost (${hdr.h}px)`);
    /* THE WORDMARK. `white-space:normal` only PERMITTED the wrap and it never fired, because the buttons wrapped
       first — so assert the two words land on DIFFERENT lines, not merely that the rule is present. */
    ok(hdr.wordLines===2, `  → CARDMEN / FIGHTER stacks onto ${hdr.wordLines} lines`);
    /* ONLY ☰ AND New Duel ARE LOOSE. A build that left the five in the bar would still be "one row" on a wide
       enough phone, so name what is allowed rather than counting rows alone. */
    ok(hdr.buttons.length===1 && hdr.buttons[0]==='menuBtn',
       `  → and ☰ is the only control left in the bar (${hdr.buttons.join(', ')||'none'})`);
    ok(hdr.headerH===hdr.h+'px', `  → --headerH tracked the change to ${hdr.headerH} (#disconBar hangs off it)`);
    /* THE SHEET OPENS, AND A DIALOG CLOSES IT. `showModal` does that for every dialog at once rather than per
       call site, so this covers the entries added later too. */
    await p.evaluate(()=>document.getElementById('menuBtn').click()); await wait(250);
    ok(await p.evaluate(()=>!document.getElementById('menuSheet').hidden), '  → ☰ opens the sheet');
    await p.evaluate(()=>document.getElementById('settingsBtn').click()); await wait(400);
    ok(await p.evaluate(()=>document.getElementById('menuSheet').hidden &&
         document.getElementById('overlay').classList.contains('show')),
       '  → and choosing an entry opens its dialog AND closes the sheet behind it');
    await p.evaluate(()=>{ const d=document.getElementById('setDone')||document.getElementById('rulesDone');
      if(d) d.click(); else window.__solo && document.getElementById('overlay').click(); }); await wait(400);

    /* ---- THE ACTION ROW COLLAPSES TO SYMBOLS ---- (v1.31.104)
       Measured before building, at 390x780: Sort/Clear/⚡/Pass/Fight wanted THREE rows and 118px, under a hint
       that is itself two lines. 67px and one row after. */
    const ar = await actionRow(p);
    ok(ar.rows===1, `  → the action row fits on ONE row (${ar.rows} row(s), ${ar.h}px)`);
    /* 🔍 View card JOINED THE ROW in v1.31.104, and its gate is NOT the icon breakpoint: it appears only where
       the inline description strip is hidden — since drag-and-stack ruling 32 (step 5), EVERY phone (`max-width:720px`;
       it was `and max-height:800px`, which left the two taller sizes here with a 170px strip under the hand). So all
       three sizes here qualify now. Still assert the GATE, not a fixed count, or the suite bakes in whichever it saw first. */
    const wantView = (w<=720), n = wantView?6:5;
    const hasView = ar.bs.some(x=>x.id==='viewCardBtn');
    ok(ar.bs.length===n, `  → all ${n} buttons are on it (${ar.bs.map(x=>x.id.replace('Btn','')).join(' ')})`);
    ok(hasView===wantView, `  → 🔍 View card is ${wantView?'present':'correctly absent'} at ${w}×${h} (inline reader ${wantView?'hidden':'shown'})`);
    /* BOTH HALVES. A button showing nothing at all would also be "one row", and a build that simply deleted the
       labels would pass a glyph check while destroying the accessible name — the words must still be in the DOM. */
    const mute = ar.bs.filter(x=>x.fs!==0), blank = ar.bs.filter(x=>!x.icon), wordless = ar.bs.filter(x=>!x.text);
    ok(mute.length===0, `  → every label is collapsed (${mute.map(x=>x.id).join(',')||'none left showing text'})`);
    ok(blank.length===0, `  → and every one shows a symbol instead (${ar.bs.map(x=>x.icon).join(' ')})`);
    ok(wordless.length===0, `  → while keeping its word in the DOM for the accessible name`);
    /* THE ICON MUST TRACK THE LABEL, which is the whole reason this is `attr(data-icon)` and not a per-id
       ::before. Two labels that really change, both reachable by clicking:
       — Sort reports STATE, so its compact form keeps the word. The hand above is sorted to Pairs by now. */
    const sortBtn = ar.bs.filter(x=>x.id==='sortBtn')[0];
    ok(/Pairs/.test(sortBtn.icon), `  → Sort still reports its state when compact ("${sortBtn.icon}")`);
    /* — and the context button carries four labels. 10♦ is Phantasmal Illusion, which labels it "Phantasm" on
         BOTH branches of ctxAction, so it needs no pile staged. A static ⚡ would survive this; the map cannot. */
    await stage(p, [[10,'D'],[4,'H'],[6,'S'],[13,'C']]); await wait(250);
    await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>
      el.querySelector('.card[data-id="g0"]'))[0]; if(g) g.click(); }); await wait(300);
    const ctxB = (await actionRow(p)).bs.filter(x=>x.id==='ctxBtn')[0];
    ok(ctxB && ctxB.text==='Phantasm' && ctxB.icon==='🌀',
       `  → the symbol follows the label, not the button (Phantasm → "${ctxB?ctxB.icon:'—'}")`);

    /* ---- ENABLED MUST NOT LOOK LIKE DISABLED ---- (v1.31.104)
       Aj: *"the fight button is all grey and the change from inactive to active is very subtle"*. The cause was
       not missing CSS — `#fightBtn{background:var(--gold)}` had been in the file all along and LOST TO
       `#actions button` ON SPECIFICITY, (0,1,0,0) against (0,1,0,1). So assert the COMPUTED background of a real
       enabled button: reading the stylesheet, or checking the rule exists, passes on the broken build.
       A card is selected right now (the phantasm click above), so Fight is live in round 1. */
    const paint = () => p.evaluate(()=>{
      const gold=getComputedStyle(document.documentElement).getPropertyValue('--gold').trim();
      const px=h=>{const m=h.replace('#','');return 'rgb('+[0,2,4].map(i=>parseInt(m.substr(i,2),16)).join(', ')+')';};
      const f=document.getElementById('fightBtn'), ps=document.getElementById('passBtn'), c=getComputedStyle(f);
      return { goldRGB:px(gold), fightBg:c.backgroundColor, fightOff:f.disabled,
               passLit:/232, 195, 122/.test(getComputedStyle(ps).borderColor), passOff:ps.disabled||ps.classList.contains('off') };});
    const lit = await paint();
    ok(!lit.fightOff && lit.fightBg===lit.goldRGB,
       `  → an ENABLED Fight is actually gold, not the panel colour (${lit.fightBg} vs ${lit.goldRGB})`);
    /* AND THE OFF STATE MUST DIFFER — a build that painted every Fight gold would pass the line above. */
    await p.evaluate(()=>{ const c=document.getElementById('clearBtn'); if(c && !c.disabled) c.click(); }); await wait(350);
    const dark = await paint();
    ok(dark.fightOff && dark.fightBg!==lit.goldRGB,
       `  → and a DISABLED Fight is not (${dark.fightBg}), so the two states are told apart`);
    await ctx.close();
  }

  /* THE NEGATIVE HALF, and it is not optional: a rule with no upper bound would strip the words off a desktop
     too, and every assertion above would still be green. 768 is a portrait tablet — above the 480 breakpoint. */
  {
    const ctx=await b.newContext({viewport:{width:768,height:1024}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push('768: '+e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1100);
    /* NO MOVE TO THE FIGHT SUB-PHASE NEEDED ANY MORE. This file measures the ACTION ROW, and it used to step out
       of Main first because `#fightBtn` was the always-enabled `Next` there (no off state to compare) and Pass
       was hidden. Since drag-and-stack step 1 Main renders the whole row and Fight rests disabled until a legal
       selection, so both claims hold in Main. */
    const wide = await actionRow(p);
    const collapsed = wide.bs.filter(x=>x.fs===0);
    ok(collapsed.length===0, `a 768px tablet keeps the WORDS (${collapsed.map(x=>x.id).join(',')||'none collapsed'})`);
    ok(wide.bs.filter(x=>x.id==='sortBtn')[0].text==='Sort: Pairs' ||
       /^Sort: /.test(wide.bs.filter(x=>x.id==='sortBtn')[0].text),
       `  → including Sort's full label ("${wide.bs.filter(x=>x.id==='sortBtn')[0].text}")`);
    await ctx.close();
  }

  /* ---- THE PHONE BAR DECLUTTER (phone-declutter-rest) ----
     Aj, 2026-10-02: *"we can probably make shields a number… maybe we don't need all that info on display all the
     time? i think the most important one is shields, then energy, then effects affecting the board"*; and of the
     ⊘, 2026-10-12: *"behind the tap with the other counts"*. On a portrait phone your shields read as a NUMBER and
     the deck name, 🂠, ♻ and ⊘ go behind one 🂠 tap.
     PINNED BOTH WAYS: a tablet and the landscape band keep the full bar, and a rotation moves the counts back —
     a rule with no edge would pass every phone line below while stripping the counts off a desktop too. Staged
     with the LONGEST deck name and real piles, so "off the bar" is not true of nodes that were empty anyway. */
  const vis=(p,sel)=>p.evaluate(s=>{ const e=document.querySelector(s); if(!e||e.offsetParent===null) return false; const r=e.getBoundingClientRect(); return r.width>0&&r.height>0; }, sel);
  async function barPage(w,h){
    const ctx=await b.newContext({viewport:{width:w,height:h}});
    const p=await ctx.newPage(); p.on('pageerror',e=>errs.push(w+'x'+h+' bar: '+e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>{ ['setYouDeck','setRivalDeck'].forEach(function(id){ var s=document.getElementById(id); if(s) s.value='MageKnight'; }); });
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);
    await p.evaluate(()=>{ const st=window.__solo.st(); const mk=(r,s,t)=>({rank:r,suit:s,id:r+s+t});
      st.players[0].removed=[mk(5,'S','#x'),mk(8,'H','#x')]; st.players[0].shuffle=[mk(3,'D','#s')]; st.players[0].shields=3; window.__solo.render(); });
    await wait(600);
    return { ctx, p };
  }
  const COUNTS=['#youDeckName','#handMeta .stat.deck','#youShufBtn','#youExBtn'];
  for(const [w,h] of [[390,780],[327,660]]){
    const { ctx, p }=await barPage(w,h); const tag=`${w}x${h}`;
    ok(await vis(p,'#youShieldsNum') && !(await vis(p,'#youShields')), `${tag}: your shields read as a NUMBER, the pips hidden`);
    ok((await p.evaluate(()=>(document.querySelector('#youShieldsNum b')||{}).textContent))==='3', `  → and the number is the real count (3)`);
    const off=[]; for(const s of COUNTS) if(await vis(p,s)) off.push(s);
    ok(off.length===0 && await vis(p,'#pilesBtn'), `${tag}: the deck name, 🂠, ♻ and ⊘ are OFF the bar, behind the 🂠 button`+(off.length?'  ← still showing: '+off.join(', '):''));
    /* ONE LINE: everything left on the bar shares the name's row — the point of the change, in pixels */
    const row=await p.evaluate(()=>{ const t=id=>{ const e=document.getElementById(id); return e?Math.round(e.getBoundingClientRect().top):-999; }; return { who:t('youWho'), num:t('youShieldsNum'), btn:t('pilesBtn'), nrg:t('youNrgBtn') }; });
    ok(Math.max(row.num,row.btn,row.nrg)-row.who<14, `  → and the bar is ONE row: name, shields, energy and 🂠 share it (${JSON.stringify(row)})`);
    await p.evaluate(()=>{ const x=document.getElementById('pilesBtn'); if(x) x.click(); }); await wait(250);
    const on=[]; for(const s of COUNTS) if(await vis(p,s)) on.push(s);
    const sheet=await p.evaluate(()=>{ const sh=document.getElementById('pilesSheet'); if(!sh) return { left:-1, right:-1, vw:0, txt:'(no sheet)' }; const r=sh.getBoundingClientRect();
      return { left:Math.round(r.left), right:Math.round(r.right), vw:document.documentElement.clientWidth, txt:sh.textContent.replace(/\s+/g,' ').trim() }; });
    ok(on.length===COUNTS.length, `${tag}: tapping 🂠 shows all four ("${sheet.txt}")`);
    ok(/Mage Knight/.test(sheet.txt) && /deck/.test(sheet.txt) && /1 shuffle pile/.test(sheet.txt) && /2 exile/.test(sheet.txt), `  → the deck name and the three counts, labelled, with the real numbers`);
    ok(sheet.left>=0 && sheet.right<=sheet.vw, `  → and the sheet stays ON SCREEN (${sheet.left}..${sheet.right} of ${sheet.vw})`);
    await p.mouse.click(Math.round(w/2), 120); await wait(200);
    ok(await p.evaluate(()=>{ const sh=document.getElementById('pilesSheet'); return !!(sh && sh.hidden); }), `  → a tap outside closes it`);
    await p.evaluate(()=>{ const x=document.getElementById('pilesBtn'); if(x) x.click(); }); await wait(200);
    await p.evaluate(()=>document.getElementById('youExBtn').click()); await wait(350);
    ok(await p.evaluate(()=>{ const sh=document.getElementById('pilesSheet'); return /Exile/.test((document.querySelector('#modal h2')||{}).textContent||'') && !!(sh && sh.hidden); }),
       `  → ⊘ inside it opens the Exile, and the sheet gets out of the way`);
    await p.evaluate(()=>{ const d=document.getElementById('pvDone'); if(d) d.click(); }); await wait(200);
    /* THE NUMBER FOLLOWS A BREAK, and turns at zero — the shields line is what a player reads first */
    await p.evaluate(()=>{ const st=window.__solo.st(); st.players[0].shields=0; window.__solo.render(); }); await wait(300);
    ok(await p.evaluate(()=>{ const n=document.getElementById('youShieldsNum'); return !!(n && (n.querySelector('b')||{}).textContent==='0' && n.classList.contains('zero')); }),
       `  → the number follows a break, and marks zero`);
    await ctx.close();
  }
  /* THE NEGATIVE HALF: a portrait tablet and the landscape band keep the full bar */
  for(const [w,h,what] of [[768,1024,'a 768px tablet'],[844,390,'the 844x390 landscape band']]){
    const { ctx, p }=await barPage(w,h);
    const kept=[]; for(const s of COUNTS) if(await vis(p,s)) kept.push(s);
    ok(await vis(p,'#youShields') && !(await vis(p,'#youShieldsNum')) && kept.length===COUNTS.length && !(await vis(p,'#pilesBtn')),
       `${what} keeps the full bar — pips, deck name, 🂠, ♻ and ⊘, and no 🂠 button`+(kept.length<COUNTS.length?'  ← missing: '+COUNTS.filter(s=>kept.indexOf(s)<0).join(', '):''));
    await ctx.close();
  }
  /* AND A ROTATION MOVES THEM BACK, and forth — `placeZones` re-runs on the media change */
  {
    const { ctx, p }=await barPage(390,844);
    await p.setViewportSize({width:844,height:390}); await wait(500);
    const back=[]; for(const s of COUNTS) if(await vis(p,s)) back.push(s);
    ok(back.length===COUNTS.length && !(await vis(p,'#pilesBtn')), `turning a 390x844 phone sideways puts the counts back on the bar (${back.length}/${COUNTS.length})`);
    await p.setViewportSize({width:390,height:844}); await wait(500);
    const again=[]; for(const s of COUNTS) if(await vis(p,s)) again.push(s);
    ok(again.length===0 && await vis(p,'#pilesBtn'), `  → and upright again, they go back behind the 🂠 tap`);
    await ctx.close();
  }
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
