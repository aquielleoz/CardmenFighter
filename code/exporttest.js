/* THE PLAYTEST EXPORT, at 3 players (v1.31.5). The exported record used to be duel-shaped in three ways, and
 * all three silently corrupted every multiplayer game Aj collected:
 *   - stats were keyed 'you' | 'rival', so every opponent at a 3-6 player table merged into ONE bucket;
 *   - bumpFight had a single call site (bumpFight(YOU, ...)), so opponents' jabs and specials were ALWAYS 0 —
 *     in duels too;
 *   - the record carried no player count at all, so a duel and a six-player game were indistinguishable.
 * This drives a real 3-player game far enough for the opponents to act, then asserts the export would contain
 * them. Run: node exporttest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  /* A FRESH 3-PLAYER GAME, and we may need more than one — see the retry below. */
  async function startGame(){
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await wait(350);
    await p.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); }); await wait(1200);
    return p.evaluate(()=>!!(window.__solo&&window.__solo.st()&&window.__solo.st().numPlayers===3));
  }
  ok(await startGame(), '3-player game started');

  /* RETRY OVER GAMES, NOT A BIGGER ROUND BUDGET. The per-seat assertion needs BOTH opponents to have fought,
   * and it cannot be weakened: a seat showing zero is indistinguishable from the merged-bucket bug this suite
   * exists to catch. But some deals never give one of them a recorded fight — it passes through, or is
   * eliminated first — and this file already documented that at "about 1 run in 6" while leaving the round cap
   * as a valve. A longer cap is still a gamble; an eliminated seat will never fight however long you wait.
   * So: drive a game, and if a deal did not produce what the assertion needs, deal ANOTHER one. Bounded, and
   * it reports what each attempt achieved so a genuine regression still fails loudly instead of retrying into
   * a timeout. */
  let prog={round:0,o1:0,o2:0}, attempts=[];
  for(let game=1; game<=4; game++){
    if(game>1){ await startGame(); }
    prog=await driveOne();
    attempts.push('game '+game+': round '+prog.round+', opp1 '+prog.o1+', opp2 '+prog.o2);
    if(prog.o1>0 && prog.o2>0) break;
  }
  if(!(prog.o1>0 && prog.o2>0)) console.log('   ⚠ no deal produced a fight for both opponents:\n     '+attempts.join('\n     '));

  async function driveOne(){
  // Pass whenever we can. The opponents then actually fight, which is what has to get recorded.
  /* BOUNDED BY UNPRODUCTIVE ITERATIONS, NOT RAW ONES. A flat `i<160` counts iterations, and an iteration whose
   * click is swallowed by `busy` costs budget while advancing nothing — so on a loaded machine the game simply
   * stops short and the per-seat assertion below fails on a game that never got going. That is the v1.31.9
   * lesson (`nettest_full`: "a transition used to burn budget") in a suite that predates the fix, and it is how
   * this went red once under `sweep.js -j 4` while passing 5/5 alone and 1/1 under deliberate load.
   * `stuck` resets on any progress, so a slow machine now takes MORE iterations rather than fewer rounds. */
  for(let i=0, stuck=0, seen=''; i<900 && stuck<160; i++){
    const done=await p.evaluate(()=>{ const st=window.__solo.st(); return !st||st.finished; });
    if(done) break;
    await p.evaluate(()=>{
      const ov=document.getElementById('overlay');
      if(ov&&ov.classList.contains('show')){
        const d=document.getElementById('pfDecline')||document.getElementById('respDecline')||document.getElementById('revOk');
        if(d){ d.click(); return; }
      }
      const pb=document.getElementById('passBtn'); if(pb&&!pb.disabled){ pb.click(); return; }
      // holding the initiative means passing is illegal — lead the lowest card instead
      const clr=document.getElementById('clearBtn'); if(clr)clr.click();
      const c=document.querySelector('#hand .card'); if(c)c.click();
      const f=document.getElementById('fightBtn');
      if(f&&!f.disabled){ f.click(); if(/Confirm/i.test(f.textContent||'') && !f.disabled) f.click(); }
    });
    await wait(120);
    /* EXIT ON WHAT THE ASSERTIONS NEED, not on a round count. "Four rounds is plenty of opponent turns" is
     * true usually — and usually is how a suite becomes deal-dependent: an opponent that passes through those
     * rounds, or is eliminated in them, records no fight at all, and the per-seat assertion below then fails
     * about 1 run in 6. Measured, not guessed. The round cap stays as a safety valve so a pathological game
     * fails the assertion loudly instead of spinning. */
    const prog=await p.evaluate(()=>{
      const s=window.__solo.stats(), st=window.__solo.st();
      const f=i=>(s&&s.seats&&s.seats[i])?(s.seats[i].jabs+s.seats[i].specials):0;
      return { round: st?st.round:0, o1:f(1), o2:f(2) };
    });
    if(prog.round>=4 && prog.o1>0 && prog.o2>0) return prog;
    if(prog.round>=14) return prog;
    const sig=prog.round+'/'+prog.o1+'/'+prog.o2;
    if(sig===seen) stuck++; else { stuck=0; seen=sig; }     // progress resets the budget; only a wedged board spends it
  }
  return { round:0, o1:0, o2:0 };
  }

  const seatStats=await p.evaluate(()=>{
    const s=window.__solo.stats(); if(!s||!s.seats) return null;
    return s.seats.slice(0,3).map(x=>({jabs:x.jabs, specials:x.specials, tech:x.techniques}));
  });
  ok(seatStats!==null, 'stats are keyed by seat, not by "you"/"rival"');
  const oppFights=seatStats ? (seatStats[1].jabs+seatStats[1].specials+seatStats[2].jabs+seatStats[2].specials) : 0;
  ok(oppFights>0, 'OPPONENTS\' fights are counted — the bug was that this was always 0 ('+oppFights+' recorded)');
  ok(seatStats && seatStats[1] && seatStats[2] && (seatStats[1].jabs+seatStats[1].specials)>0 && (seatStats[2].jabs+seatStats[2].specials)>0,
     'and they are counted PER SEAT — both opponents have their own fights, not one merged pile');

  // Now the record an export would actually write.
  const rec=await p.evaluate(()=>{
    const st=window.__solo.st();
    if(!st.finished){ st.finished=true; st.winner=2; }      // end it so recordGame has a winner to name
    window.__solo.record();
    const g=window.__solo.games(); return g[g.length-1]||null;
  });
  ok(rec!==null, 'a game record was written');
  ok(rec && rec.numPlayers===3, 'the record knows the PLAYER COUNT ('+(rec&&rec.numPlayers)+') — a duel and a 6-player game used to look identical');
  ok(rec && Array.isArray(rec.seats) && rec.seats.length===3, 'it carries one entry per seat ('+(rec&&rec.seats&&rec.seats.length)+')');
  ok(rec && rec.winnerSeat===2, 'it records WHICH seat won ('+(rec&&rec.winnerSeat)+'), not just "rival"');
  ok(rec && rec.v==='2.1-mp', 'the version string is bumped so old files stay identifiable ("'+(rec&&rec.v)+'")');
  ok(rec && typeof rec.rules==='string', 'and it records the RULE SET ("'+(rec&&rec.rules)+'") — v2.1-mp added this so a homebrew game cannot be mistaken for a weird one');
  ok(rec && rec.mode==='local-mp', 'it records the mode ("'+(rec&&rec.mode)+'")');
  ok(rec && rec.rivalIsMerged===true, 'the legacy `rival` field is explicitly FLAGGED as a merge at 3+ players');
  const merged=rec && rec.rival, s1=rec&&rec.seats[1], s2=rec&&rec.seats[2];
  ok(merged && s1 && s2 && merged.jabs===(s1.jabs+s2.jabs) && merged.specials===(s1.specials+s2.specials),
     'and that merge is now HONEST — it sums the opponents instead of reporting zeros');
  ok(rec && rec.seats.every(x=>typeof x.seat==='number' && 'finalShields' in x), 'each seat entry carries its own seat number and final shields');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
