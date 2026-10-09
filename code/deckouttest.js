/* A DECK-OUT AT 3-6 PLAYERS ENDS ONE SEAT, NOT THE GAME (deckout-ends-game-midway).
 *
 * At 3+ players `roundDraw` ELIMINATES a seat that must lead with no card, and the game goes on while two or more
 * remain. The ceremony ran `endGame()` on ANY deck-out, so in solo the human got the END SCREEN under a message
 * naming a winner the engine had not set, and the table stopped: the ceremony returned into the end screen instead
 * of handing the turn on, so the AI that should lead next never did. Six-player deck-outs run ~0.07 per game in
 * real play (DECISIONS.md#deck-cycling), about one game in fourteen.
 *
 * STAGED in round 3 at three seats: you lead a pair of 3s; seat 1 (Lefty) answers with its LAST two cards, a pair
 * of 7s, with an empty deck and shuffle pile; seat 2 (Tank) cannot beat it. Lefty wins the round, the deal gives it
 * nothing, and it must lead with no card: decked out. Tank, the next seat, leads the new round — an AI, so the game
 * only goes on if the ceremony hands the table on. That is the half a netplay host, whose own turn comes next in
 * `nettest_deckout3`, cannot show.
 *
 * Run: node deckouttest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { selectAndFight } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await wait(350);
  /* PIN THE TIER: a non-Minion AI answers a Special with its cheapest beating one, which is what makes Lefty spend
     its last two cards. The default happens to be Fighter; a suite that depends on a mode should set it. */
  await p.evaluate(()=>{ document.querySelectorAll('#oppList select.strength').forEach(s=>{ s.value='fighter'; s.dispatchEvent(new Event('change')); }); }); await wait(200);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);
  await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    st.round=3; st.turn=0; st.pile=null; st.passes=0; st.subPhase='main';
    st.players.forEach(pl=>{ pl.energy=[]; pl.shields=3; });
    window.__solo.setName(1,'Lefty'); window.__solo.setName(2,'Tank');
    st.players[0].hand=[mk(3,'C','a3'),mk(3,'D','b3'),mk(9,'H','y9')];
    st.players[1].hand=[mk(7,'H','r7a'),mk(7,'S','r7b')]; st.players[1].deck=[]; st.players[1].shuffle=[];
    st.players[2].hand=[mk(4,'S','s4'),mk(5,'S','s5'),mk(6,'D','s6')];
    window.__solo.render(); });
  const tiers=await p.evaluate(()=>{ const d=window.__solo.st()._diff||{}; return [d[1],d[2]]; });
  ok(tiers.every(t=>t && t!=='minion'), 'STAGED: both opponents play a tier that answers a Special  ['+tiers.join(', ')+']');
  await wait(500);
  await selectAndFight(p, ['a3','b3']);
  // answer what the human is asked: decline windows, pass on any lead that is not ours
  const tapper=setInterval(()=>{ p.evaluate(()=>{
      const d=document.getElementById('respDecline'); if(d && d.offsetParent){ d.click(); return; }
      const ps=document.getElementById('passBtn'), st=window.__solo.st();
      if(st.turn===0 && st.pile && ps && !ps.disabled && !st.players[0].eliminated) ps.click();
    }).catch(()=>{}); }, 300);
  const sample=()=>p.evaluate(()=>{ const st=window.__solo.st();
    return { out1:!!st.players[1].eliminated, finished:!!st.finished, round:st.round,
             end:!!document.getElementById('againBtn'), msg:((document.getElementById('message')||{}).textContent||'').trim(),
             pileBy:(st.pile?st.pile.byPlayer:null) }; });
  const t0=Date.now(); let outAt=null, endAt=null, tankLed=null, outRound=null; const msgs=[];
  while(Date.now()-t0<30000){
    const s=await sample(); const t=Date.now()-t0;
    if(s.out1 && outAt==null){ outAt=t; outRound=s.round; }
    if(outAt!=null){
      if(s.end && endAt==null) endAt=t;
      if(msgs[msgs.length-1]!==s.msg) msgs.push(s.msg);
      if(s.pileBy===2 && s.round>=outRound && tankLed==null) tankLed=t;
      if(t-outAt>9000) break;
    }
    await wait(60);
  }
  clearInterval(tapper);
  const last=await sample();
  const log=await p.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent.trim()));
  ok(outAt!=null && log.some(l=>/Lefty decked out/.test(l)), 'STAGED: Lefty won the round with its last cards and DECKED OUT'+(outAt!=null?' (at '+outAt+'ms)':' — nothing below means anything'));
  if(outAt==null) console.log('   WHY: '+JSON.stringify({ round:last.round, pileBy:last.pileBy, finished:last.finished, log:log.filter(l=>/won|played|passed|round|out/i.test(l)).slice(-10) }));
  ok(!last.finished, 'the game is still going — two Riders remain');
  ok(endAt==null, 'and no END SCREEN came up for it'+(endAt!=null?'  ← REPRODUCED: the end screen at '+endAt+'ms, mid-game':''));
  ok(!msgs.some(m=>/\bwins?\b|you win/i.test(m)), 'and no message named a winner  '+JSON.stringify(msgs.slice(0,4)));
  ok(tankLed!=null, 'and Tank, the next seat, LED the new round: the ceremony handed the table on'+(tankLed!=null?' (at '+tankLed+'ms)':'  ← REPRODUCED: nobody led, the table stopped'));
  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs.join(' | '):''));

  /* …AND THE DECK-OUT THAT ENDS A GAME STILL ENDS IT. The fix narrows `endGame()` to `state.finished`, so the
     other half needs pinning too, and nothing else stages it: in a DUEL a deck-out loses. You lead your last
     card, an apex 2 nobody can beat, with an empty deck and shuffle pile; you win the round, draw nothing, and
     cannot lead. The end screen must come up, and name the winner. */
  const q=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(); const errs2=[]; q.on('pageerror',e=>errs2.push(e.message));
  await q.goto(URL); await wait(700);
  await q.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await q.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='2'; s.dispatchEvent(new Event('change')); }); await wait(350);
  await q.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);
  await q.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    st.round=3; st.turn=0; st.pile=null; st.passes=0; st.subPhase='main';
    st.players.forEach(pl=>{ pl.energy=[]; pl.shields=3; });
    window.__solo.setName(1,'Lefty');
    st.players[0].hand=[mk(2,'S','ap2')]; st.players[0].deck=[]; st.players[0].shuffle=[];
    st.players[1].hand=[mk(5,'H','r5'),mk(9,'C','r9')];
    window.__solo.render(); });
  await wait(500);
  await selectAndFight(q, ['ap2']);
  let done2=null; const t2=Date.now();
  while(Date.now()-t2<20000){
    const s=await q.evaluate(()=>{ const st=window.__solo.st();
      return { finished:!!st.finished, winner:st.winner, end:!!document.getElementById('againBtn'),
               title:((document.querySelector('#modal h2')||{}).textContent||'').trim(), msg:((document.getElementById('message')||{}).textContent||'').trim() }; });
    if(s.end){ done2=s; break; }
    await wait(80);
  }
  const fin2=await q.evaluate(()=>({ finished:!!window.__solo.st().finished, winner:window.__solo.st().winner }));
  ok(fin2.finished && fin2.winner===1, '[duel] STAGED: you decked out and the engine ended the game, Lefty the winner  '+JSON.stringify(fin2));
  ok(!!done2, '[duel] the END SCREEN came up for it'+(done2?'  ["'+done2.title+'"]':'  ← the deck-out that ends a duel no longer ends it on screen'));
  ok(!!done2 && /decked out — Lefty wins/.test(done2.msg), '[duel] and the message names the winner  ["'+(done2?done2.msg:'—')+'"]');
  /* …AND THE TITLE NAMES THEM THE SAME WAY (v1.33.3). A duel's end screen said the constant "Rival Wins" over a
     message naming Lefty; the title now reads the winner's name, as the 3-6 player one always did. */
  ok(!!done2 && done2.title==='Lefty Wins', '[duel] and the end screen\'s TITLE names the same winner  ["'+(done2?done2.title:'—')+'"]');
  ok(errs2.length===0, '[duel] no JS errors'+(errs2.length?': '+errs2.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
