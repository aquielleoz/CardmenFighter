/* THE "FREE-FOR-ALL" LESSON (Advanced #10) — the first tutorial with more than two players.
 *
 * Every other lesson is a duel, which is why none of them needed touching when multiplayer scaling shipped in
 * v1.31.0. This one declares `players:4`, so it is the only lesson that exercises `startLesson`'s N-seat path,
 * the opponents strip, the N-player driver and the confirm-first targeting flow.
 *
 * It asserts the lesson's CLAIMS, not just that the steps advance — a tutorial that completes while telling
 * you something false is worse than one that stalls. Three things it checks that bit during development:
 *   - the table really starts at 2 + numPlayers shields (the launcher used to default to a flat 4, which made
 *     the "everyone has 6 shields here" line a lie),
 *   - a Special win really costs EVERY opponent a shield (that is the headline claim of the whole lesson),
 *   - 3♦ Telekinesis really stands alone in hand (any other rank-3 card groups with it, and then the
 *     instruction "select 3♦" selects a pair and the step cannot be completed at all).
 * Run: node lessontest_mp.js */
const { chromium }=require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>{const x=document.getElementById('helpBtn'); if(x)x.click();}); await wait(450);
  await p.evaluate(()=>{const x=document.getElementById('helpTutBtn'); if(x)x.click();}); await wait(600);
  const listed=await p.evaluate(()=>{
    const els=[].slice.call(document.querySelectorAll('#modal button, #modal a, #modal .lsnCard, #modal [data-lsn]'));
    const hit=els.find(e=>/Free-for-All/i.test(e.textContent||'')); if(hit){ hit.click(); return true; } return false;
  });
  ok(listed, 'the lesson is listed in the tutorial hub and launches');
  await wait(1700);

  const setup=await p.evaluate(()=>{
    const st=window.__solo.st(), E=window.CardmenEngine;
    return { n:st.numPlayers, shields:st.players[0].shields, expShields:E.startShieldsFor(st.numPlayers),
             draw:E.drawCountFor(st), panels:document.querySelectorAll('#opponents .oppPanel').length,
             tut:!!document.getElementById('tutPanel'),
             oppShields:[1,2,3].map(i=>st.players[i]?st.players[i].shields:-1) };
  });
  ok(setup.n===4, 'it seats FOUR players (the only lesson that is not a duel): got '+setup.n);
  ok(setup.panels===3, '...with three opponent panels on the strip');
  // the launcher used to default to a flat 4 shields, which contradicted the lesson's own text
  ok(setup.shields===setup.expShields && setup.shields===6,
     'the table starts at the REAL 2+numPlayers shields, so the lesson\'s "everyone has 6 shields" is true: '+setup.shields);
  ok(setup.draw===4, '...and draws numPlayers per round, matching the same step: '+setup.draw);
  ok(setup.oppShields.every(s=>s===6), '...and every opponent starts level with you: '+JSON.stringify(setup.oppShields));

  const step=()=>p.evaluate(()=>{
    const t=document.getElementById('tutPanel'); if(!t) return null;
    const m=(t.textContent||'').match(/Tutorial · (\d+) \/ (\d+)/);
    return { n:m?+m[1]:0, of:m?+m[2]:0, hasNext:!!document.getElementById('tutNextBtn') };
  });
  let last=-1, stuck=0, reached=0, shieldsBeforePair=null, shieldsAfterPair=null;
  const tel7={labels:[], threes:null, energyAtEntry:null, energyAtStage:null};
  for(let i=0;i<150;i++){
    const s=await step(); if(!s) break;
    if(s.n!==last){ reached=Math.max(reached,s.n); last=s.n; stuck=0; } else stuck++;
    if(stuck>28){ ok(false,'STALLED on step '+s.n+' of '+s.of); break; }
    if(s.n===5 && shieldsBeforePair===null){
      shieldsBeforePair=await p.evaluate(()=>{const st=window.__solo.st(); return [1,2,3].map(i=>st.players[i].shields);});
    }
    // Track the LOWEST shields seen from the Special step onward, rather than sampling the instant step 6
    // appears: the strip lands when the round resolves, which is several beats after the play.
    if(s.n>=5){
      const now=await p.evaluate(()=>{const st=window.__solo.st(); return [1,2,3].map(i=>st.players[i].shields);});
      shieldsAfterPair = shieldsAfterPair ? shieldsAfterPair.map((v,i)=>Math.min(v,now[i])) : now;
    }
    if(s.n===7){
      // Observe the REAL targeting flow as the driver walks it, rather than poking the DOM from the side:
      // record every context-button label seen, whether a seat ever got staged (.aimed), and the energy at
      // the moment of staging — energy must not move until the confirm press.
      const snap=await p.evaluate(()=>{
        const st=window.__solo.st(); const c=document.getElementById('ctxBtn');
        return { lab:c?c.textContent.trim():'', aimed:!!document.querySelector('#opponents .oppPanel.aimed'),
                 energy:st.players[0].energy.length, threes:st.players[0].hand.filter(x=>x.rank===3).length };
      });
      tel7.labels.push(snap.lab);
      // take the MAX across the step: the first sample can beat the prep's render, and if this ever reads 2
      // the "select 3♦" instruction is broken because the 3s would group into a pair.
      if(tel7.threes===null || snap.threes>tel7.threes) tel7.threes=snap.threes;
      if(snap.aimed && tel7.energyAtStage===null) tel7.energyAtStage=snap.energy;
      if(tel7.energyAtEntry===null) tel7.energyAtEntry=snap.energy;
    }
    if(s.n>=10 && s.hasNext){ await p.evaluate(()=>document.getElementById('tutNextBtn').click()); await wait(600); reached=10; break; }
    if(s.hasNext){ await p.evaluate(()=>document.getElementById('tutNextBtn').click()); await wait(550); continue; }
    await p.evaluate((n)=>{
      const st=window.__solo.st(); if(!st || st.turn!==0) return;
      const cards=()=>[].slice.call(document.querySelectorAll('#hand .card'));
      const id=c=>c.dataset.id||''; const rank=c=>((id(c).match(/^(\d+)/)||[])[1]);
      const fight=()=>document.getElementById('fightBtn'), ctx=()=>document.getElementById('ctxBtn');
      const clear=()=>{const c=document.getElementById('clearBtn'); if(c&&!c.disabled) c.click();};
      if(n===3){ clear(); const j=cards().find(c=>id(c).indexOf('3D')!==0); if(j) j.click();
                 const f=fight(); if(f&&!f.disabled) f.click(); return; }
      if(n===5){ clear(); const cs=cards(), seen={}; let a=null,b2=null;
                 for(const c of cs){ const r=rank(c); if(r==null) continue; if(seen[r]){ a=seen[r]; b2=c; break; } seen[r]=c; }
                 if(a&&b2){ a.click(); b2.click(); const f=fight(); if(f&&!f.disabled) f.click(); } return; }
      if(n===7){ const aimed=document.querySelector('#opponents .oppPanel.aimed');
                 const lab=(ctx()?(ctx().textContent||''):'').trim();
                 if(aimed){ const c=ctx(); if(c&&!c.disabled) c.click(); return; }
                 if(/Pick a target|Choose target/i.test(lab)){ const op=document.querySelector('#opponents .oppPanel'); if(op) op.click(); return; }
                 clear(); const tel=cards().find(c=>id(c).indexOf('3D')===0); if(tel) tel.click();
                 const c2=ctx(); if(c2&&!c2.disabled) c2.click(); return; }
      if(n===9){ const ps=document.getElementById('passBtn'); if(ps&&!ps.disabled){ ps.click(); return; }
                 clear(); const c0=cards()[0]; if(c0) c0.click(); const f=fight(); if(f&&!f.disabled) f.click(); return; }
    }, s.n);
    await wait(600);
  }

  // THE headline claim of the lesson
  if(shieldsBeforePair && shieldsAfterPair){
    const dropped=shieldsBeforePair.filter((v,i)=>shieldsAfterPair[i]<v).length;
    ok(dropped===3, 'a Special win costs EVERY opponent a shield — the lesson\'s headline claim: '+
       JSON.stringify(shieldsBeforePair)+' -> '+JSON.stringify(shieldsAfterPair));
  } else ok(false,'never reached the Special step, so the headline claim went unchecked');

  if(tel7.labels.length){
    ok(tel7.threes===1, '3♦ stands ALONE in hand, so tapping it selects one card and not a pair of 3s (rank-3 count: '+tel7.threes+')');
    ok(tel7.labels.some(l=>/target/i.test(l)),
       '...and the step really enters the TARGET flow — labels seen: '+JSON.stringify([...new Set(tel7.labels)]));
    ok(tel7.energyAtStage!==null && tel7.energyAtStage===tel7.energyAtEntry,
       '...and staging a target spends NOTHING (confirm-first): energy '+tel7.energyAtEntry+' -> '+tel7.energyAtStage);
  } else ok(false,'never reached the targeting step');

  ok(reached===10, 'all 10 steps complete without stalling (reached '+reached+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
