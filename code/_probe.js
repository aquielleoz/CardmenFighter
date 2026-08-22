const { chromium } = require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1300,height:950}})).newPage();
  p.on('pageerror',e=>console.log('PAGEERR:',e.message));
  await p.goto('file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1'); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
  await p.evaluate(()=>{ const d=document.getElementById('setDiff'); d.value='knight'; d.dispatchEvent(new Event('change')); }); await wait(250);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);
  // dumb driver: play first legal card else pass, like browsertest
  let stuckAt=null;
  for(let i=0;i<400;i++){
    const s=await p.evaluate(()=>{
      const f=document.getElementById('fightBtn'), ps=document.getElementById('passBtn');
      const st=window.__solo.st();
      return { finished:!!st.finished, round:st.round, turn:st.turn, busy:!!document.querySelector('#hand.tutlock'),
               fightOff:!f||f.disabled, passOff:!ps||ps.disabled, msg:(document.getElementById('message')||{}).textContent.slice(0,70),
               modal:document.getElementById('overlay').classList.contains('show'), locked:!!(st.players[0].lockSkip||st.players[0].lockRound),
               pending:!!st.pending, respondFor:st.respondFor, shieldResp:!!st.shieldResponse, preFightQ:st.preFightQ,
               preFightHandled:!!st.preFightHandled, discardPending:!!st.discardPending, stack:(st.stack||[]).length,
               rivalStatus:(document.getElementById('rivalStatus')||{}).textContent, lockR:!!st.players[1].lockRound, lockS:!!st.players[1].lockSkip };
    });
    if(s.finished){ console.log('FINISHED at round', s.round, 'after', i, 'steps'); stuckAt=null; break; }
    if(s.fightOff && s.passOff){
      if(!stuckAt) stuckAt={...s, step:i};
      if(i-stuckAt.step>60){ console.log('STUCK — both buttons disabled for 60 polls:', JSON.stringify(stuckAt)); break; }
    } else stuckAt=null;
    await p.evaluate(()=>{
      const clr=document.getElementById('clearBtn'); const f=document.getElementById('fightBtn'), ps=document.getElementById('passBtn');
      const cards=[].slice.call(document.querySelectorAll('#hand .card'));
      for(let k=0;k<cards.length;k++){ if(clr)clr.click(); document.querySelectorAll('#hand .card')[k].click(); if(f&&!f.disabled){ f.click(); return; } }
      if(clr)clr.click(); if(ps&&!ps.disabled) ps.click();
    });
    await wait(120);
  }
  await b.close();
})();
