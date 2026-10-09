/* AN OPPONENT'S EFFECTS MUST BE SEEN BEFORE THE ROUND ENDS ON TOP OF THEM (v1.31.106).
 *
 * Aj, from real play: *"the enemy played caltrops then passed. i didn't get to see his actions because the
 * round end and round begin animations started to fire off"*. The duel driver's round-ending-pass path
 * (`finishStep`) hand-rolled two `logMsg` lines and went straight to `announceRoundWin`, so the cast was
 * logged and buried in the same frame — while `buildOppBeats`, with its `revealEffect` and `revealDwell`,
 * sat in the OTHER arm of the same `if` and never ran.
 *
 * WHY THIS SUITE EXISTS AND `nettest_*` DOES NOT COVER IT: the bug is in the SOLO duel driver, and the log
 * LINE was always there — only its timing and its wording were wrong. **So assert the ORDER, never the
 * presence.** A suite that greps the log for "played a Technique" is green on the broken build; that is
 * precisely why nothing caught this for as long as it existed.
 *
 * Run: node oppbeatstest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const { selectAndFight, clickFight } = require('./fightclick');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

/* Stage the one turn that reaches the bug: YOU lead the apex 2 (unbeatable, and legal in round 1 where only
   jabs are), so the Rival cannot fight and must pass — and a duel pass against a lead RESOLVES the round.
   It holds A♦ Gather Energy and the fuel to cast it, which measured 8/8 across fresh deals. */
const stage = p => p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
  st.players[0].hand=[mk(2,'S','y0'),mk(5,'H','y1'),mk(6,'C','y2')];
  st.players[1].hand=[mk(1,'D','r0'),mk(3,'C','r1'),mk(4,'H','r2')];
  st.players[1].energy=[mk(9,'D','e1'),mk(8,'D','e2'),mk(7,'D','e3'),mk(6,'D','e4'),mk(5,'D','e5')];
  window.__solo.render(); });

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);
  await p.evaluate(()=>document.getElementById('logToggle').click()); await wait(200);
  await stage(p);

  /* THE PERSONA NAME HAS TO EXIST, or the naming assertions below are vacuous — a duel with no persona is
     CORRECTLY allowed to say "Rival", so a run without one would pass on the broken build too. */
  const rival = await p.evaluate(()=>window.__solo.persona(1)||'');
  ok(!!rival && rival!=='Rival', `the Rival drew a persona name to be called by ("${rival||'none'}")`);

  // lead the 2, then WATCH — poll fast enough to time the log rather than just read it at the end
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')]
    .filter(el=>el.querySelector('.card[data-id="y0"]'))[0]; if(g) g.click(); }); await wait(250);
  const t0 = Date.now();
  await clickFight(p);   // two-state button (epic step 20) — see fightclick.js

  /* Record WHEN each line first appears, and whether the card reader ever lit up. `revealEffect` adds
     `.reveal` to #cardView and pops #artFlash; both are transient, so they are sampled, not read at the end. */
  /* ⚠ BOUNDED BY THE CLOCK, NOT BY 180 ITERATIONS (2026-10-07). 180 x (40ms + an evaluate) is about 9s, and a
     quiet run measured the round at 4.7s, 4.7s and 7.3s — the 7.3s deal had the Rival cast twice, one more
     `revealDwell` (2650ms). So a green run used 80% of the budget and a loaded sweep went red at
     "(at undefinedms)". What this waits for is beats, which load does not shrink; the ceiling is a hang
     guard and returns the moment the round line lands. */
  const seen={}; let sawReveal=false; const pollEnd=Date.now()+30000;
  while(Date.now()<pollEnd){
    const s = await p.evaluate(()=>({
      log:[...document.querySelectorAll('#log .le')].map(e=>e.textContent.trim()),
      reveal:!!document.querySelector('#cardView.reveal') || !!document.querySelector('#artFlash.show') }));
    if(s.reveal) sawReveal=true;
    s.log.forEach(t=>{
      if(seen.eff==null && /played an? (Technique|Equipment|Ride|Form)/i.test(t)) seen.eff=Date.now()-t0;
      if(seen.pass==null && /\bpassed\.$/.test(t)) seen.pass=Date.now()-t0;
      if(seen.round==null && /won the round|lost a shield|won with a/i.test(t)) seen.round=Date.now()-t0;
    });
    if(seen.round!=null) break;
    await wait(40);
  }

  ok(seen.eff!=null, `STAGED: the Rival cast an effect before its round-ending pass (at ${seen.eff}ms)`);
  ok(seen.round!=null, `  → and the pass really did resolve the round (at ${seen.round}ms)`+
     (seen.round!=null ? '' : `  ← no round line within ${Date.now()-t0}ms of the lead`));

  /* THE BUG, AND THE ONLY ASSERTION THAT DISCRIMINATES. On the broken build the cast, the pass and the round
     announcement were all logged in ONE frame — measured at a 0ms gap — so the player never saw the card.
     `revealDwell` is 2650ms with effect text and 1200 under reduced motion, and the pass beat adds 950; the
     floor is set at 800 so it cannot pass on a same-frame build at ANY motion setting, while leaving room for
     a slow machine to be slow rather than red. */
  const gap = (seen.eff!=null && seen.round!=null) ? seen.round-seen.eff : -1;
  ok(gap>=800, `the effect is SHOWN before the round resolves on top of it (${gap}ms between them, floor 800)`);
  ok(sawReveal, '  → and the card reader actually lit up for it (revealEffect ran, not just a log line)');

  /* THE NAMING HALF. `finishStep` hardcoded "Rival" while every other line goes through `logName`, which
     returns the persona name — so one log named the same opponent two ways in a single round, and 9 of 26
     opponent lines in Aj's log 3 read "Rival". A scan is cheaper than re-reading every template. */
  const lines = await p.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent.trim()));
  const wrong = lines.filter(t=>/\bRival\b/.test(t));
  ok(wrong.length===0, `no log line calls the opponent "Rival" when it has a name${wrong.length?': '+JSON.stringify(wrong.slice(0,3)):''}`);
  ok(lines.some(t=>t.indexOf(rival)>=0), `  → they use "${rival}" instead (not vacuous: the log does name it)`);

  /* ---------- A FORCED DISCARD NAMES THE TARGET, NOT THE CASTER (2026-09-30).
     Aj, from a 3-player game: *"i did not discard any cards despite being telekinesis'd. was it auto
     picked again?"* — and the log could not answer him. `buildOppBeats`' `seat` is the seat whose TURN is
     being presented, i.e. the CASTER, so a Telekinesis Adell cast at somebody else rendered as
     *"Adell discarded 2 cards."* about Adell's own hand. Four casts in that game, not one naming a target.
     THE TARGET WAS ALREADY IN THE DATA: `ai.js` pushes `{ forcedDiscard: n, who: dr0.player }` and only the
     count was read.
     ⚠ DRIVEN THROUGH THE RENDERER, NOT THROUGH A GAME. Getting the AI to actually cast Telekinesis depends
     on its heuristics — a staged attempt did not cast at all — so this feeds `buildOppBeats` the log entry
     ai.js produces and asserts the line it renders. That is the layer that was wrong, and it makes the
     assertion independent of whether any given deal tempts the AI.
     BOTH NAMES ARE REQUIRED, because "names the target" is also true of a build that names everyone the
     same: the line must carry seat 2's name AND NOT the caster's. */
  await p.evaluate(()=>{ window.__solo.setName(1,'Caster'); window.__solo.setName(2,'Victim'); window.__solo.render(); });
  const beforeN = await p.evaluate(()=>document.querySelectorAll('#log .le').length);
  await p.evaluate(()=>window.__solo.oppBeats([{ forcedDiscard:2, who:2 }], 1));
  await wait(1400);
  const dline = await p.evaluate(n=>[...document.querySelectorAll('#log .le')].slice(n).map(e=>e.textContent.trim())
                                   .filter(t=>/discarded/.test(t))[0]||'', beforeN);
  ok(/Victim/.test(dline),
     `a forced discard names the TARGET  ["${dline}"]` + (/Victim/.test(dline)?'':'  ← REPRODUCED: the log cannot say who was hit'));
  ok(dline && !/Caster/.test(dline),
     '  …and NOT the caster — the seat whose turn is being presented is not the seat that discarded');

  /* THE AI's CAST LINE NAMES ITS TARGET (cast-line-names-no-target). The cast line echoed the card's text —
     "Target Rival discards 1 card" — so Aj could not tell he was the one hit. `ai.js` now logs the activation's
     `r.target` beside the card, and this feeds `buildOppBeats` that exact entry, like the legs around it.
     THREE TARGETS, ONE CASTER: you ("You", in your frame), another seat (its name), and a card target, whose
     owner rides as a seat too and gets NO possessive — `{foe}’s` would render "You’s". */
  const castLine = async (target)=>{ const n0=await p.evaluate(()=>document.querySelectorAll('#log .le').length);
    await p.evaluate(t=>window.__solo.oppBeats([{ play:'tk', card:{rank:3,suit:'D',id:'tk3D'}, target:t }], 1), target);
    await wait(3000);
    return p.evaluate(n=>[...document.querySelectorAll('#log .le')].slice(n).map(e=>e.textContent.trim()).filter(t=>/played a/.test(t))[0]||'', n0); };
  const atYou=await castLine({seat:0}), atOther=await castLine({seat:2}), atCard=await castLine({equip:{name:'Holy Bow', owner:0}});
  ok(/^Caster played .* — aimed at You\.$/.test(atYou), `an AI cast aimed at you SAYS so  ["${atYou}"]`+(/aimed at/.test(atYou)?'':'  ← REPRODUCED: the card\'s text and no target'));
  ok(/— aimed at Victim\.$/.test(atOther), `…aimed at another seat names THAT seat  ["${atOther}"]`);
  ok(/— aimed at Holy Bow \(owned by You\)\.$/.test(atCard) && !/You’s|You's/.test(atCard), `…and a card target names the card and its owner, with no "You’s"  ["${atCard}"]`);

  /* THE AI's PHANTASMAL ILLUSION NAMES A SHAPE (phantasm-beat-reads-wrong-field). Bibong's export read
     "a Special undefined overtakes the pile": `ai.js` logs `{ phantasm: rp.made }` and the renderer read
     `e.made`. Fed the exact entry ai.js produces, like the forced-discard leg above. */
  const beforeP = await p.evaluate(()=>document.querySelectorAll('#log .le').length);
  await p.evaluate(()=>window.__solo.oppBeats([{ phantasm:'fullhouse', value:9 }], 1));
  await wait(1600);
  const pline = await p.evaluate(n=>[...document.querySelectorAll('#log .le')].slice(n).map(e=>e.textContent.trim()).filter(t=>/Phantasmal/.test(t))[0]||'', beforeP);
  ok(/Full House/i.test(pline) && !/undefined/.test(pline), `the AI's illusion names the shape it made  ["${pline}"]` + (/undefined/.test(pline)?'  ← REPRODUCED':''));

  /* AN AI's INCARNATION IS ANNOUNCED (opponent-incarnation-unannounced). In Bibong's 2026-10-08 games the Demon
     completed J + Q + K three times and the log showed only the Form card that did it, while your own transform
     line ends "JQK — INCARNATION!". Fed the entry `ai.js` now produces for the completing transform (test.js
     asserts it does), and its twin without the flag, which must stay a plain cast line: "the line says
     INCARNATION" is also true of a build that says it on every transform. */
  const xformLine = async (extra)=>{ const n0=await p.evaluate(()=>document.querySelectorAll('#log .le').length);
    await p.evaluate(x=>window.__solo.oppBeats([Object.assign({ play:'TRANSFORM', card:{rank:13,suit:'C',id:'xk13C'}, target:null }, x)], 1), extra);
    await wait(3000);
    return p.evaluate(n=>[...document.querySelectorAll('#log .le')].slice(n).map(e=>e.textContent.trim()).filter(t=>/played a Form Change/.test(t))[0]||'', n0); };
  const superLine=await xformLine({ isSuper:true }), plainLine=await xformLine({});
  ok(/^Caster played a Form Change - K♣ .*\. Transformation Requirements Complete! JQK — INCARNATION!$/.test(superLine),
     `an AI transform that completes J + Q + K says INCARNATION  ["${superLine.slice(0,48)}…${superLine.slice(-60)}"]`+(/INCARNATION/.test(superLine)?'':'  ← REPRODUCED: the Form card and nothing else'));
  ok(!!plainLine && !/INCARNATION/.test(plainLine), `  …and one that does not complete the set stays a plain cast line  ["…${plainLine.slice(-50)}"]`);
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
