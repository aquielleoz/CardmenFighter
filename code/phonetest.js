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
    await ctx.close();
  }
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
