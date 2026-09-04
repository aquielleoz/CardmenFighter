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

    /* ---- THE ACTION ROW COLLAPSES TO SYMBOLS ---- (v1.31.104)
       Measured before building, at 390x780: Sort/Clear/⚡/Pass/Fight wanted THREE rows and 118px, under a hint
       that is itself two lines. 67px and one row after. */
    const ar = await actionRow(p);
    ok(ar.rows===1, `  → the action row fits on ONE row (${ar.rows} row(s), ${ar.h}px)`);
    /* 🔍 View card JOINED THE ROW in v1.31.104, and its gate is NOT the icon breakpoint: it appears only where
       the inline description strip is hidden (`max-width:720px and max-height:800px`), because on a taller phone
       `#side` reads the card inline and the button would open a reader nobody needs. Of the three sizes here only
       360×800 qualifies — so assert the GATE, not a fixed count, or the suite bakes in whichever it saw first. */
    const wantView = (w<=720 && h<=800), n = wantView?6:5;
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
    const wide = await actionRow(p);
    const collapsed = wide.bs.filter(x=>x.fs===0);
    ok(collapsed.length===0, `a 768px tablet keeps the WORDS (${collapsed.map(x=>x.id).join(',')||'none collapsed'})`);
    ok(wide.bs.filter(x=>x.id==='sortBtn')[0].text==='Sort: Pairs' ||
       /^Sort: /.test(wide.bs.filter(x=>x.id==='sortBtn')[0].text),
       `  → including Sort's full label ("${wide.bs.filter(x=>x.id==='sortBtn')[0].text}")`);
    await ctx.close();
  }
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
