/* THE FIGHTER KICK FLASHES AT EVERY KILL, AND ONLY THE GAME-ENDER IS THE FINALE (kick-flash-only-at-game-end).
 *
 * Aj, 2026-09-24: *"a fighter kick should flash for each kill"*. At 3-6 players EVERY elimination is a kick, and
 * `playFinisher` had one caller — `endGame` — so a kill that left the game running got the words and no flash,
 * while `pendingKick` stayed set and played the full finisher at a LATER deck-out or concede, "YOU WIN/LOSE"
 * credited to a kill rounds old. Three cases, each staged so the right answer differs from the old one:
 *   3p-kill  you kick seat 2 out with seat 1 still standing: the MID-GAME flash, once, naming the victim, with
 *            no WIN/LOSE, before the next round banner — and then a concede must NOT replay a finisher
 *   3p-out   you are the one kicked: the same flash in the LOSE tone, "YOU'RE OUT"
 *   duel     the CONTROL — a game-ending kick is still the full finisher, "YOU WIN", not the mid-game one
 * Sampled from the screen (`#kick`'s class and text) every 60ms, because the flash is a 1-second event.
 *
 * Run: node kicktest.js          (KICK_CASES=3p-out to run one leg; KICK_HOSTILE_DRAW=1 stacks the AIs' decks
 *                                with the draw that once made 3p-out miss — it must stay green, nothing is drawn first) */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { selectAndFight } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const sample=p=>p.evaluate(()=>{ const k=document.getElementById('kick'), rf=document.getElementById('roundfx'), st=window.__solo.st();
    const rr=rf&&rf.querySelector('.rfRound');
    const wd=k&&k.querySelector('.word'), wr=wd?wd.getBoundingClientRect():null;
    return { kick:!!(k&&/\bshow\b/.test(k.className)), cls:k?k.className:'', text:k?(k.textContent||''):'',
             rings:k?k.querySelectorAll('.ring').length:0, fs:wd?parseFloat(getComputedStyle(wd).fontSize):0,
             overflow:wr?Math.round(Math.max(0, wr.right-innerWidth, -wr.left)):0, vw:innerWidth,
             rbanner:!!(rf&&/show/.test(rf.className)&&rr&&/Round/i.test(rr.textContent||'')),
             finished:!!st.finished, out2:!!(st.players[2]&&st.players[2].eliminated), out0:!!st.players[0].eliminated }; });

  async function runCase(MODE){
    const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    if(MODE!=='duel'){ await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await wait(350);
      /* PIN THE TIER: a Minion strikes at random instead of taking the kill (`chooseTarget`), and this leg's kill
         is an AI's choice. The default happens to be Fighter; a suite that depends on a mode should set it. */
      await p.evaluate(()=>{ document.querySelectorAll('#oppList select.strength').forEach(s=>{ s.value='fighter'; s.dispatchEvent(new Event('change')); }); }); await wait(200); }
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);
    await p.evaluate(({MODE,HOSTILE})=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.round=3; st.turn=0; st.pile=null; st.passes=0; st.subPhase='main';
      st.players.forEach(pl=>{ pl.energy=[]; });
      window.__solo.setName(1,'Lefty'); if(st.players[2]) window.__solo.setName(2,'Tank');
      if(MODE==='duel'){ st.players[0].shields=3; st.players[1].shields=0;
        st.players[0].hand=[mk(9,'C','a9'),mk(9,'H','b9'),mk(4,'D','x4')]; st.players[1].hand=[mk(3,'H','r3'),mk(5,'S','r5')]; }
      else if(MODE==='3p-kill'){ st.players[0].shields=3; st.players[1].shields=3; st.players[2].shields=0;
        st.players[0].hand=[mk(9,'C','a9'),mk(9,'H','b9'),mk(4,'D','x4')]; st.players[1].hand=[mk(3,'H','r3'),mk(5,'S','r5')]; st.players[2].hand=[mk(3,'S','s3'),mk(6,'S','s6')]; }
      /* ⚠ THE KILL LANDS IN ROUND 3, BEFORE ANY DRAW (2026-10-08). It used to be "you jab low, seat 1 takes it and
         leads a pair in round 4", so it crossed a round's draw of THREE cards a seat, from the real shuffle — and
         every J/Q/K an AI drew there was a Ride or Form it played first, each a ~2.65s reveal beat. Measured: the
         kick landed at 14.5-19.6s against this leg's 20s budget, in clusters one beat apart, and missed it 1 run
         in 16 (Lefty drew J♣ Q♣ 7♠, Tank a Q♠). Forcing that draw (KICK_HOSTILE_DRAW=1) missed it 4 of 4.
         Now you lead a pair of 3s, seat 1 answers with its 7s (a non-Minion AI always plays the cheapest beating
         Special), seat 2 cannot, and seat 1's strike goes to the seat on 0 shields — so nothing is drawn first. */
      else { st.players[0].shields=0; st.players[1].shields=3; st.players[2].shields=3;
        st.players[0].hand=[mk(3,'C','a3'),mk(3,'D','b3')]; st.players[1].hand=[mk(10,'H','r10'),mk(7,'H','r7a'),mk(7,'S','r7b')]; st.players[2].hand=[mk(3,'S','s3'),mk(4,'S','s4')];
        st.turn=0;
        if(HOSTILE){ st.players[1].deck.unshift(mk(11,'C','hj1'),mk(12,'C','hq1'),mk(7,'D','h71')); st.players[2].deck.unshift(mk(12,'S','hq2'),mk(13,'S','hk2'),mk(11,'S','hj2')); } }
      window.__solo.render(); }, {MODE, HOSTILE:!!process.env.KICK_HOSTILE_DRAW});
    if(MODE!=='duel'){ const tiers=await p.evaluate(()=>{ const d=window.__solo.st()._diff||{}; return [d[1],d[2]]; });
      ok(tiers.every(t=>t && t!=='minion'), '['+MODE+'] STAGED: both opponents play a tier that takes a kill  ['+tiers.join(', ')+']'); }
    await wait(500);
    if(MODE==='3p-out') await selectAndFight(p, ['a3','b3']); else await selectAndFight(p, ['a9','b9']);
    // answer whatever the human is asked: aim the kick at seat 2 and Confirm, decline windows, pass on a lead
    const tapper=setInterval(()=>{ p.evaluate(()=>{
        const el=document.querySelector('.oppPanel.targetable'), f=document.getElementById('fightBtn');
        if(el && !document.querySelector('.oppPanel.aimed')){ (document.querySelector('.oppPanel.targetable[data-seat="2"]')||el).click(); return; }
        if(f && /Confirm/.test(f.textContent) && !f.disabled){ f.click(); return; }
        const d=document.getElementById('respDecline'); if(d && d.offsetParent){ d.click(); return; }
        const ps=document.getElementById('passBtn'), st=window.__solo.st();
        if(st.turn===0 && st.pile && ps && !ps.disabled && !st.players[0].eliminated) ps.click();
      }).catch(()=>{}); }, 300);
    const film=[]; const t0=Date.now(); let killAt=null;
    while(Date.now()-t0<20000){
      const s=await sample(p); s.t=Date.now()-t0; film.push(s);
      const killed = MODE==='duel' ? s.finished : (MODE==='3p-kill' ? s.out2 : s.out0);
      if(killed && killAt==null) killAt=s.t;
      if(killAt!=null && s.t-killAt>6000) break;
      await wait(60);
    }
    clearInterval(tapper);
    const tag='['+MODE+']';
    ok(killAt!=null, tag+' STAGED: the kick landed'+(killAt!=null?' (at '+killAt+'ms)':' (nothing below means anything)'));
    /* A MISSED KICK EXPLAINS ITSELF: how each round was won, and where the board stood when the budget ran out. */
    if(killAt==null) console.log('   WHY: '+JSON.stringify(await p.evaluate(()=>{ const st=window.__solo.st();
      return { round:st.round, turn:st.turn, pile:st.pile?st.pile.combo.type+'@'+st.pile.byPlayer:null, finished:!!st.finished,
               shields:st.players.map(pl=>pl.shields), hands:st.players.map(pl=>pl.hand.length), out:st.players.map(pl=>!!pl.eliminated),
               log:[...document.querySelectorAll('#log .le')].map(e=>e.textContent.trim()).filter(t=>/won|played|passed|round|kick|out/i.test(t)).slice(-14) }; })));
    const fl=film.filter(f=>f.kick);
    let edges=0; for(let i=0;i<film.length;i++) if(film[i].kick && !(i>0&&film[i-1].kick)) edges++;
    if(MODE==='duel'){
      ok(fl.length>0 && fl.some(f=>/YOU WIN/.test(f.text)) && !fl.some(f=>/mid-game/.test(f.cls)),
         tag+' the game-ending kick is still the FULL finisher — "YOU WIN", not the mid-game flash  ['+(fl[0]?fl[0].cls+' · '+fl[0].text:'none')+']');
      ok(edges===1, tag+' …exactly once ('+edges+')');
      /* THE FINALE IS THE BIG ONE (Aj, 2026-10-06: "that's the only kick the 1v1 sees"): its own class, the
         shockwave rings, words larger than the mid-game flash — and never wider than the screen in ANY frame,
         overshoot included, which is what the first cut (150px at 1100 wide) got wrong. */
      ok(fl.length>0 && /\bfinal\b/.test(fl[0].cls) && fl[0].rings===2, tag+' …in the FINALE form — its own class and the shockwave rings  ['+(fl[0]?fl[0].cls+' · rings '+fl[0].rings:'—')+']');
      ok(fl.length>0 && fl[0].fs>116, tag+' …with bigger words than the old 116px finisher at this width ('+(fl[0]?fl[0].fs:'—')+'px)');
      const worst=fl.reduce((m,f)=>Math.max(m,f.overflow),0);
      ok(fl.length>0 && worst===0, tag+' …and the words never run off the screen, in any sampled frame (worst '+worst+'px past the edge)');
    } else {
      const want = MODE==='3p-kill' ? /TANK IS OUT/ : /YOU.RE OUT/, tone = MODE==='3p-kill' ? /\bwin\b/ : /\blose\b/;
      ok(fl.length>0, tag+' the kill FLASHES while the game goes on'+(fl.length?'':'  ← REPRODUCED: the words and no flash'));
      ok(fl.length>0 && want.test(fl[0].text) && !/YOU WIN|YOU LOSE/.test(fl[0].text),
         tag+' …naming who went out, with no WIN/LOSE (the game is not over)  ["'+(fl[0]?fl[0].text:'—')+'"]');
      ok(fl.length>0 && /mid-game/.test(fl[0].cls) && tone.test(fl[0].cls), tag+' …in the '+(MODE==='3p-kill'?'WIN':'LOSE')+' tone, the shorter mid-game form  ['+(fl[0]?fl[0].cls:'—')+']');
      ok(edges===1, tag+' …exactly once ('+edges+')');
      ok(fl.length>0 && fl[0].rings===0 && !/\bfinal\b/.test(fl[0].cls), tag+' …and it is NOT the finale — no shockwave, the finale stays its own event');
      const firstFlash=film.findIndex(f=>f.kick), nextRound=film.findIndex((f,i)=>f.rbanner && i>firstFlash && firstFlash>=0);
      ok(firstFlash>=0 && !film.some(f=>f.kick&&f.rbanner), tag+' …and never on top of a round banner'+(nextRound>=0?' (flash @'+film[firstFlash].t+'ms, next round @'+film[nextRound].t+'ms)':''));
      ok(!film[film.length-1].finished, tag+' the game really is still going');
      if(MODE==='3p-kill'){
        /* THE SECOND BUG: the old queue played the finisher at whatever ended the game next. Concede, and watch. */
        await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
        await p.evaluate(()=>{ const b=[...document.querySelectorAll('#modal button')].find(x=>/Concede/i.test(x.textContent)); if(b) b.click(); });
        const after=[]; const t1=Date.now(); while(Date.now()-t1<3500){ after.push(await sample(p)); await wait(60); }
        ok(after.some(f=>f.finished), tag+' STAGED: the concede ended the game');
        ok(!after.some(f=>f.kick), tag+' …and it plays NO Fighter Kick — the kill was rounds ago'+(after.some(f=>f.kick)?'  ← REPRODUCED: "'+after.find(f=>f.kick).text+'"':''));
      }
    }
    ok(errs.length===0, tag+' no JS errors'+(errs.length?': '+errs.join(' | '):''));
    await p.context().close();
  }

  for(const m of (process.env.KICK_CASES||'3p-kill,3p-out,duel').split(',')) await runCase(m);   // KICK_CASES=3p-out runs one leg alone
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
