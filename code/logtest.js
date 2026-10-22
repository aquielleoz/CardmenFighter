/* THE BATTLE LOG'S "JUMP TO NEWEST" (Aj, 2026-09-02: *"scroll back to read something and there is no way back
 * to the live end except scrolling"*). The control already existed — markup, CSS, handler, scroll listener —
 * and a 2026-08-29 fix made `logAtBottom` honest about short logs. What was missing is the AFFORDANCE: the only
 * thing that ever SHOWED the button was a new line ARRIVING while you were scrolled away, so it was a
 * new-message indicator and never a way to navigate. Scroll up with the game waiting on you and nothing
 * appears at all.
 * The two states are different information and both are asserted: scrolled away (navigate) vs scrolled away
 * WITH new entries behind you (notify). Run: node logtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path'); const fs=require('fs');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1100,height:820}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1100);

  // The log ships COLLAPSED (`<aside id="logWrap" class="collapsed">`) and the button is display:none while it
  // is, so expand it first — otherwise every assertion below reads a panel that cannot scroll and passes
  // vacuously (which is exactly what the first run of this suite did).
  await p.evaluate(()=>document.getElementById('logToggle').click()); await wait(250);
  ok(await p.evaluate(()=>!document.getElementById('logWrap').classList.contains('collapsed')),'the log panel is expanded');

  // Fill the log well past its own height, from the bottom, so auto-follow keeps us at the newest entry.
  await p.evaluate(()=>{ for(var i=0;i<40;i++) window.__solo.log('filler line '+i); });
  await wait(200);
  const geom=await p.evaluate(()=>{ const l=document.getElementById('log');
    return { max:l.scrollHeight-l.clientHeight, top:l.scrollTop }; });
  ok(geom.max>160,'the log overflows enough to scroll ('+geom.max+'px of range)');
  ok(geom.max-geom.top<10,'and auto-follow left us at the newest entry');

  /* READ THE COMPUTED COLOUR, not just the class. Asserting `fresh` alone passes with the styling deleted —
   * measured — and the whole point of the state is that the two look different. */
  const btn=()=>p.evaluate(()=>{ const b=document.getElementById('logNewBtn'), cs=getComputedStyle(b);
    return { shown:b.classList.contains('show'), fresh:b.classList.contains('fresh'),
             label:(b.textContent||'').trim(), visible:b.offsetParent!==null,
             colour:cs.color+'/'+cs.borderTopColor }; });
  let s=await btn();
  ok(!s.shown,'at the newest entry the button is hidden — nothing to jump to');

  // SCROLL AWAY WITH NOTHING NEW ARRIVING. This is Aj's case exactly, and the old build showed nothing.
  await p.evaluate(()=>{ const l=document.getElementById('log'); l.scrollTop=0; l.dispatchEvent(new Event('scroll')); });
  await wait(150);
  s=await btn();
  ok(s.shown && s.visible,'scrolled to the top with NO new entry, the jump control is offered'+(s.shown?'':' — NOTHING shown'));
  ok(!s.fresh,'and it does not claim anything is new ('+s.label+')');
  const calmColour=s.colour;

  // It must actually work.
  await p.evaluate(()=>document.getElementById('logNewBtn').click()); await wait(200);
  const back=await p.evaluate(()=>{ const l=document.getElementById('log'); return l.scrollHeight-l.clientHeight-l.scrollTop; });
  ok(back<10,'clicking it returns to the newest entry ('+back+'px from the end)');
  s=await btn();
  ok(!s.shown,'and the button hides again once you are back');

  // THE OTHER STATE: scrolled away AND something arrived behind you. Still a jump control, but it says so.
  await p.evaluate(()=>{ const l=document.getElementById('log'); l.scrollTop=0; l.dispatchEvent(new Event('scroll')); });
  await wait(120);
  await p.evaluate(()=>window.__solo.log('something happened while you were reading'));
  await wait(150);
  s=await btn();
  ok(s.shown && s.fresh,'a new entry arriving while scrolled away marks it NEW ('+s.label+')');
  ok(/New/.test(s.label),'and the label says so, not just the colour');
  ok(s.colour!==calmColour,'and it LOOKS different from the calm state ('+calmColour+' vs '+s.colour+')');

  // Returning to the bottom must clear the fresh state, or it cries wolf forever.
  await p.evaluate(()=>document.getElementById('logNewBtn').click()); await wait(200);
  await p.evaluate(()=>{ const l=document.getElementById('log'); l.scrollTop=0; l.dispatchEvent(new Event('scroll')); });
  await wait(150);
  s=await btn();
  ok(s.shown && !s.fresh,'after catching up, scrolling away again is NOT marked new ('+s.label+')');

  /* THE LABEL GOT WIDER ("↓ New" → "↓ Newest") and the log head is clamped to as little as 160px in the
   * landscape band, with "Battle Log" and three buttons already in it.
   * MEASURE THE HEIGHT, NOT THE WIDTH. The head never overflows horizontally — the button WRAPS instead, so
   * `scrollWidth - clientWidth` stays 0 while the control silently grows: measured at 844×390, a deliberately
   * over-long label left the head at 208px wide and **104px tall**, with the button at 92px against Save's 32px.
   * A width guard passes on that build, which is why this compares the two buttons' heights. */
  await p.evaluate(()=>{ const l=document.getElementById('log'); l.scrollTop=0; l.dispatchEvent(new Event('scroll')); });
  for(const [w,h] of [[1100,820],[844,390],[667,375]]){
    await p.setViewportSize({width:w,height:h}); await wait(250);
    const fit=await p.evaluate(()=>{ const hd=document.getElementById('logHead'),
        b=document.getElementById('logNewBtn'), sv=document.getElementById('saveLogBtn');
      return { headH:Math.round(hd.getBoundingClientRect().height),
               btnH:Math.round(b.getBoundingClientRect().height), saveH:Math.round(sv.getBoundingClientRect().height),
               btnShown:b.classList.contains('show') }; });
    // NOT VACUOUS: a header with the button hidden fits trivially, so require it to be present for the measurement.
    ok(fit.btnH<=fit.saveH+2 && fit.btnShown, 'the jump control stays one line at '+w+'×'+h+' (button '+fit.btnH+'px vs Save '+fit.saveH+'px, head '+fit.headH+'px'+(fit.btnShown?'':', BUT THE BUTTON WAS HIDDEN')+')');
  }
  await p.setViewportSize({width:1100,height:820}); await wait(200);

  /* THE SOLO CONTROL for v1.31.98's netplay label fix. The AI tier is CORRECT against a bot and must survive —
   * a fix that removed it everywhere would look identical in the netplay suite. `nettest_names` holds the
   * online half; this is the half that proves the branch, not a deletion. */
  const soloTag = await p.evaluate(()=>(document.getElementById('matchupTag')||{}).textContent||'');
  const soloOpen = await p.evaluate(()=>{ const e=document.querySelector('#log > *'); return e?(e.textContent||''):''; });
  const TIER = '(?:Squire|Recruit|Fighter|Knight|Demon Lord)';
  ok(new RegExp('·\\s*'+TIER+'\\s*$').test(soloTag.trim()),
     'solo still shows the AI tier in the header ["'+soloTag.trim()+'"]');
  ok(new RegExp('vs\\s+\\S+\\s*\\('+TIER+'\\)').test(soloOpen) || /New duel/.test(soloOpen),
     '  → and the solo opening line still reads "New duel …" with the tier ["'+soloOpen.slice(0,70)+'"]');

  /* ⤓ SAVE MUST CONTAIN THE LOG (2026-09-07). This suite already measured the Save button — its HEIGHT — and
   * never once clicked it, so for fifteen versions it downloaded a file whose entire body was the single line
   * `[object PointerEvent]`: `downloadLog(lines)` was passed straight to `addEventListener`, the event landed
   * in `lines`, and `lines||fullLog` preferred it. Nothing threw, the file arrived, the name was right.
   * Aj found it by sending me one.
   * CAPTURED THROUGH `Blob`, not through a real download: the text handed to the Blob is exactly what gets
   * written, and it needs no download plumbing, no temp dir and no wait. Assert BOTH directions — the log
   * lines are present AND the event string is absent — because a body that is empty for some other reason
   * would pass a check for the absence alone. */
  const saved = await p.evaluate(()=>{
    var cap=null, B=window.Blob;
    window.Blob=function(parts,opts){ cap=String((parts&&parts[0])||''); return new B(parts,opts); };
    try{ document.getElementById('saveLogBtn').click(); } finally { window.Blob=B; }
    return cap;
  });
  const liveLines = await p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()).filter(Boolean));
  ok(!!saved && /Cardmen Fighter — Battle Log/.test(saved), 'the ⤓ Save button produces a file with the log header');
  ok(!/PointerEvent|\[object /.test(saved||''),
     '  → and NOT a stringified event'+(/\[object /.test(saved||'')?' — GOT: '+saved.split('\n').filter(l=>/\[object /.test(l))[0]:''));
  ok(liveLines.length>0 && saved.indexOf(liveLines[liveLines.length-1])>=0,
     `  → it really carries the battle log (${liveLines.length} lines on screen; looked for "${(liveLines[liveLines.length-1]||'').slice(0,44)}")`);

  /* AND IT CARRIES THE ROUND BOUNDARY (2026-09-17) — the section added so a stale pile can be diagnosed
     from a saved log instead of from Aj happening to see it. The engine records it; this is the half that
     gets it into the file, and it is exactly the half that can silently not work — `E.boundaryTrace` is
     read inside a `try{}catch(e){}` in `downloadLog`, so a scope or naming slip produces a file that looks
     completely normal and is missing the thing it was built for. That is the `downloadLog` bug's own shape
     (fifteen versions of `[object PointerEvent]`, header right, nothing wrong on the surface).
     ASSERT A REAL ROW, not just the heading: a heading with an empty body is what a broken accessor gives
     you, and it would read as "no boundaries happened" rather than as a fault. */
  /* IT IS OMITTED WHEN THE TRACE IS EMPTY, WHICH IS CORRECT AND IS WHY THIS NEEDS A ROUND FIRST. The first
     draft asserted the section straight after `goFirstBtn` and went red — rightly: round 1 had not ended,
     so no boundary existed and there was nothing to print. A labelled empty section would read as "no
     boundaries happened" rather than as a fault, so the omission stays; the SUITE is what had to change.
     Driven through the engine rather than the buttons: this suite is about the saved FILE, and a round is
     staging here, not the subject. */
  await p.evaluate(()=>{ const E=window.CardmenEngine, A=window.CardmenAI, st=window.__solo.st();
    let guard=0; const r0=st.round;
    while(st.round===r0 && guard++<40 && !st.finished) A.takeTurn(st, st.turn);
    window.__solo.render();
  });
  const saved2 = await p.evaluate(()=>{
    var cap=null, B=window.Blob;
    window.Blob=function(parts,opts){ cap=String((parts&&parts[0])||''); return new B(parts,opts); };
    try{ document.getElementById('saveLogBtn').click(); } finally { window.Blob=B; }
    return cap;
  });
  ok(/--- ROUND BOUNDARY \(\d+ entries/.test(saved2||''),
     '  → after a round turns over, the ROUND BOUNDARY section is in the file'+(/ROUND BOUNDARY/.test(saved2||'')?'':'  ← missing: E.boundaryTrace() threw or returned empty inside downloadLog'));
  const bline=(saved2||'').split('\n').filter(l=>/CLEANUP · pileClear/.test(l))[0]||'';
  ok(/pile=/.test(bline) && /^r\d+ /.test(bline),
     `  → …with real rows, not an empty heading ["${bline.slice(0,72)}"]`);
  ok(/CLEANUP exit/.test(saved2||'') && /BEGIN exit/.test(saved2||''),
     '  → …and the boundary in it is COMPLETE — both queues reach their exit line, which is what makes a SHORT block the finding');
  /* AND THE TRACE IS PER-GAME (2026-10-20). `E.resetBoundaryTrace` was exported when the trace was written and never
     called, so Aj's saved log opened its ROUND BOUNDARY section with 23 lines of the PREVIOUS game's rounds 1-3 and then
     round 1 again. Start a fresh game the way a player does — concede, Again, Go first — and the trace must be empty.
     The vacuity guard comes first: it has to hold entries before, or "empty after" proves nothing. */
  const before = await p.evaluate(()=>window.CardmenEngine.boundaryTrace().length);
  ok(before > 0, `  STAGED: this game's trace holds ${before} boundary lines before a new game starts`);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(300);
  await p.evaluate(()=>{ const c=document.getElementById('confirmCon'); if(c) c.click(); }); await wait(600);
  await p.evaluate(()=>{ const a=document.getElementById('againBtn'); if(a) a.click(); }); await wait(400);
  await p.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g) g.click(); }); await wait(1100);
  const fresh = await p.evaluate(()=>({ round: window.__solo.st().round, finished: window.__solo.st().finished, trace: window.CardmenEngine.boundaryTrace() }));
  ok(fresh.round === 1 && !fresh.finished && fresh.trace.length === 0,
     '  → a NEW GAME starts with an empty boundary trace, so the saved log cannot carry the last game\'s rounds  ' +
     (fresh.trace.length ? '← still holds ' + fresh.trace.length + ': ' + JSON.stringify(fresh.trace.slice(0, 2)) : '(round ' + fresh.round + ')'));

  /* ---- THE PLAYTEST RECORD KEEPS THE WHOLE LOG, NOT THE RENDERED 80 (2026-09-24) ----
     `logMsg` trims the PANEL to 80 entries, which is right — it is a view. The game record was built from
     `$('log').children`, i.e. that same trimmed view, so every game longer than 80 lines silently lost its
     EARLY rounds while `fullLog`, the uncapped history ⤓ Save already uses, sat beside it.
     MEASURED ON AJ'S REAL EXPORT before the fix: 7 of 19 games sat exactly at 80, including a 15-round
     3-player game whose log began mid-round-8. The same shape as the `downloadLog` PointerEvent bug — the
     artefact that exists to collect evidence was the thing destroying it — and worse here, because a
     battle log is saved by someone who just noticed something, while a record is read months later by
     someone who cannot go back and get it again.
     IT LIVES IN THIS SUITE, NOT `exporttest`, because that one drives a full 3-player game against a 90s
     cap and the probe's state depended on how far it got; the trim is a LOG behaviour and this file owns
     the log. Driven PAST 80 on purpose: at or under the cap the two sources agree, so a shorter game
     cannot tell them apart.
     ⚠ `__solo.log(text)` APPENDS; `__cmf.log()` READS. The two debug hooks use one key for opposite jobs. */
  const rec = await p.evaluate(()=>{
    for(let i=0;i<140;i++) window.__solo.log('probe line '+i);
    const st=window.__solo.st(); if(st && !st.finished){ st.finished=true; st.winner=0; }
    window.__solo.record();
    const g=window.__solo.games(), r=g[g.length-1]||{}, lg=r.log||[];
    return { dom:document.querySelectorAll('#log .le').length, stored:lg.length,
             first:lg.some(l=>/probe line 0\b/.test(l)), last:lg.some(l=>/probe line 139\b/.test(l)) };
  });
  ok(rec.dom<=80, `the PANEL is still trimmed to 80 (${rec.dom}) — capping the view is correct`);
  ok(rec.stored>80, `but the RECORD keeps the whole history (${rec.stored} lines)` +
     (rec.stored>80 ? '' : '  ← REPRODUCED: the record is built from the trimmed DOM'));
  ok(rec.first && rec.last,
     'including both ENDS of it — the early game is exactly what the trim threw away' +
     (rec.first ? '' : '  ← the oldest lines are gone, which is the bug'));

  /* ---- THE CEREMONY RE-ENTRY GUARDS EXIST AND ARE WIRED (2026-09-24) ----
     These are DETECTORS for a bug that has resisted five measured hypotheses, and their whole value is
     being there on the day it recurs. A detector that was quietly unwired would be worse than none — it
     would read as "the bug did not happen".
     A SOURCE SCAN, AND ITS LIMIT STATED PLAINLY: it proves the guards are present and that the trim queue
     routes through `done()` rather than calling `cb()` directly, which is the exact regression a later
     edit would make. It does NOT exercise them — firing a stale resume needs a closure no hook reaches.
     Same shape and same honesty as `nettest_autopass` leg 3, which exists because a duel can only drive
     one of two handlers. */
  const src = fs.readFileSync(path.join(__dirname,'CardmenFighter.template.html'),'utf8');
  ok(/CLEAN-UP CONTINUATION FIRED TWICE/.test(src),
     'the clean-up continuation guard is present');
  ok(/ROUND CEREMONY RE-ENTERED/.test(src),
     'the ceremony re-entry guard is present');
  ok(/if\(!queue\.length\)\{[^}]*return done\(\);/.test(src),
     'the trim queue routes its continuation through the guard, not straight to `cb()`' +
     (/if\(!queue\.length\)\{[^}]*return cb\(\);/.test(src) ? '  ← REPRODUCED: it calls cb() directly again' : ''));
  ok(!/the clean-up boundary did not complete/.test(src),
     'and the stale-pile detector no longer asserts a cause the trace disproved');

  /* ---- WHOSE HOLY SHROUD SAVED WHOM (v1.36.0) ----
     The shared ward lets YOUR Shroud eat the shield you just broke on your Rival, and the round line only named the
     card ("Holy Shroud saved Rival 2"), so the player whose counter went was never told it was theirs. Aj approved
     "Your Holy Shroud saved Rival 2". Staged as the duel it happens in: you lead a pair the Rival cannot answer,
     you wear a one-counter Shroud, the Rival wears none. Asserted on the BOARD first (the Rival keeps its shields,
     your Shroud is gone), so the narration legs cannot pass on a round where nothing was saved. */
  { const { selectAndFight } = require('./fightclick');
    const ps=await (await b.newContext({viewport:{width:1100,height:820}})).newPage(); const e4=[]; ps.on('pageerror',e=>e4.push(e.message));
    await ps.goto(URL); await wait(700);
    await ps.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await ps.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);
    await ps.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.round=3; st.turn=0; st.pile=null; st.passes=0; st.subPhase='main';
      st.players.forEach(pl=>{ pl.energy=[]; pl.equipment=[]; });
      st.players[0].shields=3; st.players[1].shields=3;
      st.players[0].hand=[mk(9,'C','a9'),mk(9,'H','b9'),mk(4,'D','x4')]; st.players[1].hand=[mk(3,'H','r3'),mk(5,'S','r5')];
      st.players[0].equipment=[{ id:'shr', name:'Holy Shroud', absorb:true, counters:1, decay:false, card:mk(9,'H','shr') }];
      window.__solo.render(); });
    await wait(400);
    await selectAndFight(ps, ['a9','b9']);
    const tapper=setInterval(()=>{ ps.evaluate(()=>{
        const d=document.getElementById('respDecline'); if(d && d.offsetParent){ d.click(); return; }
        const pb=document.getElementById('passBtn'), st=window.__solo.st();
        if(st.turn===0 && st.pile && pb && !pb.disabled) pb.click();
      }).catch(()=>{}); }, 300);
    let seen=null; const t0=Date.now();
    while(Date.now()-t0<20000){
      seen=await ps.evaluate(()=>({ log:[...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'),
        msg:(document.getElementById('message')||{}).textContent||'', rival:window.__solo.st().players[1].shields,
        shroud:window.__solo.st().players[0].equipment.length }));
      if(/spent a Holy Shroud counter/.test(seen.log)) break;
      await wait(150);
    }
    clearInterval(tapper);
    ok(seen && seen.rival===3 && seen.shroud===0, `shared ward: YOUR Holy Shroud absorbed the shield your pair broke on the Rival, and retired  [rival ${seen&&seen.rival}, shroud ${seen&&seen.shroud?'kept':'spent'}]`);
    ok(seen && /won with a Pair - but Holy Shroud saved \S/.test(seen.log), 'the round line names the card that saved the Rival  ['+((seen&&seen.log.match(/.*Holy Shroud saved.*/)||[''])[0])+']');   // the Rival is a persona ("Tank"), so its name is not matched
    ok(seen && /You spent a Holy Shroud counter to save \S/.test(seen.log), '…and a line of its own says whose counter it was, agreement-free  ['+((seen&&seen.log.match(/.*spent a Holy Shroud counter.*/)||[''])[0])+']');
    ok(seen && !/You’s|You's/.test(seen.log), '…with no "You’s" anywhere — the possessive the broadcast template cannot carry');
    ok(e4.length===0,'no JS errors on the Shroud leg'+(e4.length?': '+e4.slice(0,2).join(' | '):''));
  }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
