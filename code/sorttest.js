/* THE STRAIGHTS SORT SHOWS THE BEST LEGAL STRAIGHT (straight-sort-picks-the-lowest, v1.32.10).
 *
 * Aj, 2026-09-24: *"i think it should sort by the higher straight"* — on his hand `4 · 6789♠ · 10 10 10 · J♠ · 2 2`
 * the sort built 6-7-8-9-10 and left the J♠ single while 7-8-9-10-J was available. And because it walked raw
 * fight values (the apex 2 is 15), it could never show the DEFAULT-legal 2-3-4-5-6. (Its walk also computed the
 * illegal J-Q-K-A-2, but the page never showed that as a group — case 3 is a guard, not a reproduction.) Read from the hand the page RENDERS, after pressing Sort into Straights — not from a helper.
 *
 * AND EVERY SORT FOLLOWS THE CUSTOM RULES THAT ARE ON (sort-follows-rules, v1.36.1). Aj, 2026-10-23, with
 * "Straight length" on and 8-9-10-J-Q-K-A in hand: *"can we make the sorting also account for activated custom
 * rules?"* — the sort grouped only 10-J-Q-K-A. Every claim below is a PAIR off ONE hand: the rule off, then on, and
 * the grouping must differ, because "the sort shows the longest straight" is also true of a build that never shows
 * anything but five. Rulings: Straights shows the LONGEST run, then the highest; Pairs JOINS the sets a rule makes one
 * play; dragging BUILDS any shape a rule makes legal; and Sort: Match groups every play with the shape and size of
 * the one on the table, highest first, and is skipped while nothing is on the table.
 *
 * Run: node sorttest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1300,height:900}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);

  const label=()=>p.evaluate(()=>document.getElementById('sortBtn').textContent);
  const groups=()=>p.evaluate(()=>[...document.querySelectorAll('#hand .group')].map(g=>({ ids:[...g.querySelectorAll('.card')].map(c=>c.dataset.id),
    label:(g.querySelector('.glabel')||{}).textContent||'' })));
  /* Stage a hand, the rules and the play on the table, then press Sort until it reads `mode`. Every rule is put back
     to its default first, so a case can never inherit the last one's. `pile` is [[rank,suit,id]…] or null. */
  async function stage(hand, rules, pile){
    await p.evaluate(([hand, rules, pile])=>{ const E=window.CardmenEngine, st=window.__solo.st();
      E.setSeqTwos('low'); E.setStraightMin('off'); E.setQuadro(false); E.setKits3(false); E.setDoublePair('off'); E.setAirplane('off'); E.setTrioOne(false);
      if(rules.seq) E.setSeqTwos(rules.seq); if(rules.len) E.setStraightMin(rules.len); if(rules.quadro) E.setQuadro(true); if(rules.kits3) E.setKits3(true);
      if(rules.dbl) E.setDoublePair(rules.dbl); if(rules.airplane) E.setAirplane(rules.airplane); if(rules.trioOne) E.setTrioOne(true);
      const mk=a=>a.map(([r,s,id])=>({rank:r,suit:s,id}));
      st.players[0].hand=mk(hand); st.turn=0;
      if(pile){ const c=E.detectCombo(mk(pile)); st.pile={ combo:c, byPlayer:1, raw:c.value, rawKey0:c.key[0], lockedDelta:0, mod:0, chopped:false }; }
      else st.pile=null;
      window.__solo.render(); }, [hand, rules||{}, pile||null]);
    await wait(300);
  }
  async function sortTo(mode, hand, rules, pile){
    await stage(hand, rules, pile);
    const re=new RegExp(mode,'i');
    // cycle OUT of the mode first: re-staging does not re-sort, so a mode left on from the last case would read stale groups
    for(let i=0;i<6 && re.test(await label());i++){ await p.evaluate(()=>document.getElementById('sortBtn').click()); await wait(300); }
    for(let i=0;i<6 && !re.test(await label());i++){ await p.evaluate(()=>document.getElementById('sortBtn').click()); await wait(350); }
    return groups();
  }
  const ids=gs=>gs.map(g=>g.ids);
  const multi=gs=>gs.filter(g=>g.ids.length>1);
  const runOf=gs=>ids(gs).filter(g=>g.length===5);
  const has=(gs,want)=>gs.some(g=>g.ids.length===want.length && want.every(id=>g.ids.indexOf(id)>=0));
  const show=gs=>JSON.stringify(multi(gs).map(g=>g.ids.join(' ')+(g.label?' ('+g.label+')':'')));

  // 1: Aj's hand
  let gs=await sortTo('Straight', [[4,'D','a4'],[6,'S','s6'],[7,'S','s7'],[8,'S','s8'],[9,'S','s9'],[10,'D','d10'],[10,'S','s10'],[10,'H','h10'],[11,'S','sJ'],[2,'D','d2'],[2,'S','s2']]);
  let runs=runOf(gs);
  ok(runs.length===1 && runs[0].indexOf('sJ')>=0 && runs[0].indexOf('s7')>=0 && runs[0].indexOf('s6')<0,
     'Aj\'s hand sorts to 7-8-9-10-J — the HIGHER straight — with the 6 spare  '+JSON.stringify(runs)+(runs[0]&&runs[0].indexOf('s6')>=0?'  ← REPRODUCED: 6-7-8-9-10':''));
  ok(ids(gs).some(g=>g.length===1 && g[0]==='s6'), '…the 6 is now the single, not the J');

  // 2: the 2 chains LOW by default — 2-3-4-5-6 is a straight
  gs=await sortTo('Straight', [[2,'D','d2'],[3,'S','s3'],[4,'H','h4'],[5,'C','c5'],[6,'D','d6'],[13,'S','sK']], {seq:'low'});
  runs=runOf(gs);
  ok(runs.length===1 && runs[0].indexOf('d2')>=0 && runs[0].indexOf('sK')<0, 'with the default rule, 2-3-4-5-6 is shown as a straight  '+JSON.stringify(runs));

  // 3: J-Q-K-A-2 is NOT a straight by default
  const JQKA2=[[11,'D','dJ'],[12,'S','sQ'],[13,'H','hK'],[1,'C','cA'],[2,'D','d2'],[4,'S','s4']];
  gs=await sortTo('Straight', JQKA2, {seq:'low'});
  ok(runOf(gs).length===0, 'with the default rule, J-Q-K-A-2 is NOT offered — the engine refuses it  '+JSON.stringify(runOf(gs)));

  // 4: …and it IS under the "2 chains high" rule
  gs=await sortTo('Straight', JQKA2, {seq:'high'});
  ok(runOf(gs).length===1, 'with the 2 chaining HIGH, J-Q-K-A-2 is shown — the sort reads the live rule  '+JSON.stringify(runOf(gs)));

  // 5: STRAIGHT LENGTH — Aj's report. 8-9-10-J-Q-K-A in hand: five long with the rule off, all seven with it on.
  const LONG=[[4,'C','c4'],[4,'S','s4'],[6,'S','s6'],[8,'C','c8'],[9,'S','s9'],[10,'D','d10'],[11,'H','hJ'],[12,'C','cQ'],[13,'S','sK'],[1,'C','cA'],[2,'C','c2']];
  const SEVEN=['c8','s9','d10','hJ','cQ','sK','cA'], TOP5=['d10','hJ','cQ','sK','cA'];
  gs=await sortTo('Straight', LONG);
  ok(has(gs,TOP5) && multi(gs).length===1, 'Straight length OFF: the run sorts to 10-J-Q-K-A, the 8 and 9 single  '+show(gs));
  gs=await sortTo('Straight', LONG, {len:'5'});
  ok(has(gs,SEVEN), '"5 or more": the same hand sorts to all seven, 8-9-10-J-Q-K-A  '+show(gs)+(has(gs,TOP5)?'  ← REPRODUCED: five only':''));
  gs=await sortTo('Straight', LONG, {len:'3'});
  ok(has(gs,SEVEN) && multi(gs).length===1, '"3 or more": the LONGEST run, not three short ones  '+show(gs));
  // 6: …and a run the default rule cannot make at all
  const SHORT=[[3,'D','d3'],[4,'S','s4'],[5,'H','h5'],[9,'C','c9'],[13,'S','sK']];
  gs=await sortTo('Straight', SHORT);
  ok(multi(gs).length===0, 'Straight length OFF: 3-4-5 is not a straight  '+show(gs));
  gs=await sortTo('Straight', SHORT, {len:'3'});
  ok(has(gs,['d3','s4','h5']), '"3 or more": 3-4-5 is grouped as one  '+show(gs));

  // 7: FOUR OF A KIND — Pairs joins the four 7s only while the rule makes them one play
  const QUAD=[[7,'C','c7'],[7,'D','d7'],[7,'H','h7'],[7,'S','s7'],[9,'S','s9']];
  gs=await sortTo('Pairs', QUAD);
  ok(multi(gs).length===2 && multi(gs).every(g=>g.ids.length===2), 'Four of a kind OFF: the four 7s sort to two Pairs  '+show(gs));
  gs=await sortTo('Pairs', QUAD, {quadro:true});
  ok(has(gs,['c7','d7','h7','s7']) && /four of a kind/i.test(multi(gs)[0].label), 'Four of a kind ON: one group of four, named "Four of a Kind"  '+show(gs));
  await p.evaluate(()=>window.__solo.render()); await wait(200);
  gs=await groups();
  ok(has(gs,['c7','d7','h7','s7']), '…and it survives the next render (a group the old hand code called invalid was broken into singles)  '+show(gs));

  // 8: CONSECUTIVE PAIRS — 4-4 5-5 6-6
  const KITS=[[4,'C','c4'],[4,'S','s4'],[5,'D','d5'],[5,'H','h5'],[6,'C','c6'],[6,'S','s6'],[13,'D','dK']];
  gs=await sortTo('Pairs', KITS);
  ok(multi(gs).length===3 && multi(gs).every(g=>g.ids.length===2), 'consecutive pairs OFF: three Pairs  '+show(gs));
  gs=await sortTo('Pairs', KITS, {kits3:true});
  ok(has(gs,['c4','s4','d5','h5','c6','s6']) && /3 Consecutive Pairs/.test(multi(gs)[0].label), '"3 or more consecutive pairs": one group of six, named "3 Consecutive Pairs"  '+show(gs));
  gs=await sortTo('Pairs', KITS, {dbl:'kits'});
  ok(has(gs,['d5','h5','c6','s6']) && has(gs,['c4','s4']), '"2 pairs: Consecutive": the HIGHER two join (5-5 6-6), the 4s stay a Pair  '+show(gs));
  gs=await sortTo('Pairs', KITS, {dbl:'poker'});
  ok(multi(gs).length===3 && multi(gs).every(g=>g.ids.length===2), '"2 pairs: Non-consecutive": still three Pairs — any two would do, so none is chosen  '+show(gs));

  // 9: CONSECUTIVE TRIOS — 7-7-7 8-8-8
  const PLANE=[[7,'C','c7'],[7,'D','d7'],[7,'H','h7'],[8,'C','c8'],[8,'D','d8'],[8,'S','s8'],[3,'S','s3']];
  gs=await sortTo('Pairs', PLANE);
  ok(multi(gs).length===2 && multi(gs).every(g=>g.ids.length===3), 'consecutive trios OFF: two Trios  '+show(gs));
  gs=await sortTo('Pairs', PLANE, {airplane:'bare'});
  ok(has(gs,['c7','d7','h7','c8','d8','s8']) && multi(gs).length===1, 'consecutive trios ON: one group of six  '+show(gs));

  // 10: SORT: MATCH — every play shaped like the one on the table, highest first
  const RUN=[[5,'C','c5'],[6,'S','s6'],[7,'C','c7'],[8,'S','s8'],[9,'H','h9'],[10,'S','s10'],[11,'C','cJ'],[12,'D','dQ'],[13,'D','dK'],[1,'C','cA'],[4,'S','s4'],[4,'H','h4']];
  const PSTRAIGHT=[[8,'D','p8'],[9,'D','p9'],[10,'C','p10'],[11,'H','pJ'],[12,'S','pQ']], PPAIR=[[7,'D','p7a'],[7,'H','p7b']];
  const HI5=['s10','cJ','dQ','dK','cA'], LO5=['c5','s6','c7','s8','h9'];
  gs=await sortTo('Match', RUN, {}, PSTRAIGHT);
  ok(/Match/.test(await label()) && has(gs,HI5) && has(gs,LO5), 'a straight on the table: Match groups BOTH five-card straights, the highest claimed first  '+show(gs));
  gs=await sortTo('Match', RUN, {}, PPAIR);
  ok(has(gs,['s4','h4']) && multi(gs).length===1, 'the same hand with a PAIR on the table: Match groups the Pair and no straight  '+show(gs));
  gs=await sortTo('Straight', RUN, {len:'3'}, PSTRAIGHT);
  const tenLong=multi(gs).filter(g=>g.ids.length===10);
  ok(tenLong.length===1 && tenLong[0].ids.indexOf('cA')>=0, '"3 or more", Straights: one run of ten, 5 to A (ten is the longest a play can be)  '+show(gs));
  gs=await sortTo('Match', RUN, {len:'3'}, PSTRAIGHT);
  ok(has(gs,HI5) && has(gs,LO5), '…and Match on the same hand: the pile\'s length, five, twice  '+show(gs));
  // nothing on the table → the cycle skips Match
  await stage(RUN, {}, null);
  const seen=[]; for(let i=0;i<6;i++){ await p.evaluate(()=>document.getElementById('sortBtn').click()); await wait(250); seen.push((await label()).replace('Sort: ','')); }
  ok(seen.indexOf('Match')<0 && seen.indexOf('Straights')>=0, 'nothing on the table: the cycle never reads Match  '+seen.join(' → '));
  await stage(RUN, {}, PSTRAIGHT);
  const seen2=[]; for(let i=0;i<6;i++){ await p.evaluate(()=>document.getElementById('sortBtn').click()); await wait(250); seen2.push((await label()).replace('Sort: ','')); }
  ok(seen2.indexOf('Match')>=0, '…and with a play on the table it does  '+seen2.join(' → '));

  // 11: DRAG BUILDS A SHAPE A RULE TURNS ON — the 4♠ dropped onto 9-9-9
  async function dragOnto(idA, idB){
    const g=await p.evaluate((a)=>{ const x=document.querySelector('#hand .card[data-id="'+a.idA+'"]'), y=document.querySelector('#hand .card[data-id="'+a.idB+'"]');
      if(!x||!y) return null; const r=x.getBoundingClientRect(), t=y.getBoundingClientRect();
      return { cx:r.left+r.width/2, cy:r.top+r.height/2, tx:t.left+t.width/2, ty:t.top+t.height/2 }; }, {idA, idB});
    if(!g) return false;
    await p.mouse.move(g.cx, g.cy); await p.mouse.down(); await p.mouse.move(g.cx, g.cy-24, {steps:4}); await p.mouse.move(g.tx, g.ty, {steps:14});
    await wait(60); await p.mouse.up(); await wait(300); return true;
  }
  const TRIO=[[9,'C','c9'],[9,'D','d9'],[9,'H','h9'],[4,'S','s4'],[13,'D','dK']];
  await sortTo('Pairs', TRIO);
  ok(await dragOnto('s4','d9'), '(staging: dragged the 4♠ onto the trio, rule off)');
  gs=await groups();
  ok(has(gs,['c9','d9','h9']) && !has(gs,['c9','d9','h9','s4']), 'Trio + one OFF: the drop is refused, the trio stays a Trio  '+show(gs));
  await sortTo('Pairs', TRIO, {trioOne:true});
  ok(await dragOnto('s4','d9'), '(staging: the same drag, rule on)');
  gs=await groups();
  ok(has(gs,['c9','d9','h9','s4']) && /Trio \+ 1/.test((gs.filter(g=>g.ids.length===4)[0]||{}).label||''), 'Trio + one ON: the drop builds one group, named "Trio + 1"  '+show(gs));

  await p.evaluate(()=>{ const E=window.CardmenEngine; E.setSeqTwos('low'); E.setStraightMin('off'); E.setQuadro(false); E.setKits3(false); E.setDoublePair('off'); E.setAirplane('off'); E.setTrioOne(false); });
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
