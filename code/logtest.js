/* THE BATTLE LOG'S "JUMP TO NEWEST" (Aj, 2026-09-02: *"scroll back to read something and there is no way back
 * to the live end except scrolling"*). The control already existed — markup, CSS, handler, scroll listener —
 * and a 2026-08-29 fix made `logAtBottom` honest about short logs. What was missing is the AFFORDANCE: the only
 * thing that ever SHOWED the button was a new line ARRIVING while you were scrolled away, so it was a
 * new-message indicator and never a way to navigate. Scroll up with the game waiting on you and nothing
 * appears at all.
 * The two states are different information and both are asserted: scrolled away (navigate) vs scrolled away
 * WITH new entries behind you (notify). Run: node logtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
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

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
