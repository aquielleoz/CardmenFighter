/* THE STRAIGHTS SORT SHOWS THE BEST LEGAL STRAIGHT (straight-sort-picks-the-lowest, v1.32.10).
 *
 * Aj, 2026-09-24: *"i think it should sort by the higher straight"* — on his hand `4 · 6789♠ · 10 10 10 · J♠ · 2 2`
 * the sort built 6-7-8-9-10 and left the J♠ single while 7-8-9-10-J was available. And because it walked raw
 * fight values (the apex 2 is 15), it could never show the DEFAULT-legal 2-3-4-5-6. (Its walk also computed the
 * illegal J-Q-K-A-2, but the page never showed that as a group — case 3 is a guard, not a reproduction.) Read from the hand the page RENDERS, after pressing Sort into Straights — not from a helper.
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

  // stage a hand, then press Sort until it reads Straights; returns the rendered groups as id lists
  async function straightsOf(hand, seq){
    await p.evaluate(([hand, seq])=>{ const st=window.__solo.st(); if(seq) window.CardmenEngine.setSeqTwos(seq);
      st.players[0].hand=hand.map(([r,s,id])=>({rank:r,suit:s,id})); st.turn=0; window.__solo.render(); }, [hand, seq||null]);
    await wait(300);
    // cycle OUT of Straights first: re-staging does not re-sort, so a mode left on from the last case would read stale groups
    for(let i=0;i<5 && /Straight/i.test(await p.evaluate(()=>document.getElementById('sortBtn').textContent));i++){ await p.evaluate(()=>document.getElementById('sortBtn').click()); await wait(300); }
    for(let i=0;i<5 && !/Straight/i.test(await p.evaluate(()=>document.getElementById('sortBtn').textContent));i++){ await p.evaluate(()=>document.getElementById('sortBtn').click()); await wait(350); }
    // the label names the CURRENT mode after the click that set it — press once more if it names the next one
    return p.evaluate(()=>[...document.querySelectorAll('#hand .group')].map(g=>[...g.querySelectorAll('.card')].map(c=>c.dataset.id)));
  }
  const runOf=gs=>gs.filter(g=>g.length===5);

  // 1: Aj's hand
  let gs=await straightsOf([[4,'D','a4'],[6,'S','s6'],[7,'S','s7'],[8,'S','s8'],[9,'S','s9'],[10,'D','d10'],[10,'S','s10'],[10,'H','h10'],[11,'S','sJ'],[2,'D','d2'],[2,'S','s2']]);
  let runs=runOf(gs);
  ok(runs.length===1 && runs[0].indexOf('sJ')>=0 && runs[0].indexOf('s7')>=0 && runs[0].indexOf('s6')<0,
     'Aj\'s hand sorts to 7-8-9-10-J — the HIGHER straight — with the 6 spare  '+JSON.stringify(runs)+(runs[0]&&runs[0].indexOf('s6')>=0?'  ← REPRODUCED: 6-7-8-9-10':''));
  ok(gs.some(g=>g.length===1 && g[0]==='s6'), '…the 6 is now the single, not the J');

  // 2: the 2 chains LOW by default — 2-3-4-5-6 is a straight
  gs=await straightsOf([[2,'D','d2'],[3,'S','s3'],[4,'H','h4'],[5,'C','c5'],[6,'D','d6'],[13,'S','sK']], 'low');
  runs=runOf(gs);
  ok(runs.length===1 && runs[0].indexOf('d2')>=0 && runs[0].indexOf('sK')<0, 'with the default rule, 2-3-4-5-6 is shown as a straight  '+JSON.stringify(runs));

  // 3: J-Q-K-A-2 is NOT a straight by default
  gs=await straightsOf([[11,'D','dJ'],[12,'S','sQ'],[13,'H','hK'],[1,'C','cA'],[2,'D','d2'],[4,'S','s4']], 'low');
  ok(runOf(gs).length===0, 'with the default rule, J-Q-K-A-2 is NOT offered — the engine refuses it  '+JSON.stringify(runOf(gs)));

  // 4: …and it IS under the "2 chains high" rule
  gs=await straightsOf([[11,'D','dJ'],[12,'S','sQ'],[13,'H','hK'],[1,'C','cA'],[2,'D','d2'],[4,'S','s4']], 'high');
  ok(runOf(gs).length===1, 'with the 2 chaining HIGH, J-Q-K-A-2 is shown — the sort reads the live rule  '+JSON.stringify(runOf(gs)));
  await p.evaluate(()=>window.CardmenEngine.setSeqTwos('low'));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
