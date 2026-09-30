/* A FORM-GRANTED QUICK MUST BE OFFERED IN THE RESPOND? WINDOW (v1.31.112).
 *
 * Aj, from real play: *"sanctuary did not prompt use when i was about to lose shields. it's quick now with all
 * the supers activated"*. Two separate windows were at fault; this file covers the general one.
 * `eligibleQuicks()` read `effectOf` — the card's BASE effect — so the SIX Form/Super patches that grant
 * `quick` were invisible to it. That is not a cosmetic miss: `promptHumanResponse` treats an empty list as
 * "nothing to answer with" and **auto-declines for the player**, so no window ever opened and nothing was
 * logged. A silent auto-pass is indistinguishable from a card that simply does not work.
 *
 * WHY A UI SUITE: `test.js` already proves `E.respond` ACCEPTS a Form-made Quick (it has since the Hector
 * block was written) — the engine was never the problem. The bug was entirely in what the UI offered, which
 * is the layer no assertion covered.
 *
 * Run: node quicktest.js */
const { chromium }=require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
const { selectAndFight, clickFight } = require('./fightclick');
/* TWO URLS, AND THE PAIR IS THE POINT (2026-09-30). This suite's subject is ELIGIBILITY — does the offer
   list read `effectFor` — so it needs a window to open at all, and since 2026-09-23 the DEFAULT mode is
   AUTO, which interrupts you only when `stakeFor` says you have one. The Rival here casts a plain
   Technique at a board with no shield event on it, so under AUTO the correct behaviour is SILENCE, and
   this suite went red for asserting the old default rather than for any defect: bisected to `e41e459`,
   green on its parent.
   SO THE FLAG IS NOT A FUDGE, AND THE SECOND LEG IS WHAT KEEPS IT HONEST — `prompts=all` (= mode ON) is
   the only mode in which "is Sanctuary offered" is a question the board can be asked, and LEG 2 runs the
   IDENTICAL staging under AUTO and requires the opposite. Without it, the flag would make this file blind
   to the default every player is actually in, forever.
   AND THE REPORT THIS SUITE COMES FROM IS COVERED ELSEWHERE, deliberately: Aj said *"sanctuary did not
   prompt use when i was about to lose shields"*, which IS a stake, at the `resolution` timing —
   `resolutiontest_ui` scenario C forces exactly that board and is the both-ways pair for it. This file
   owns the `respond` timing and the offer list. */
const BASEURL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const URL=BASEURL+'&prompts=all';
/* ONE STAGING, EVALUATED ON BOTH PAGES. The two legs differ in exactly one thing — the prompt mode — so
   the board has to be identical by construction rather than by two copies staying in step. */
const STAGE = ()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
    const you=st.players[0], riv=st.players[1];
    you.forms=[{rank:13,suit:'H',tier:'king',name:'Hector Form',card:mk(13,'H','f13H')}];
    you.hand=[mk(2,'S','y2'),mk(10,'H','sanc')];
    you.energy=[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'H','e'+n));
    riv.hand=[mk(1,'D','r1'),mk(4,'C','r2')];
    riv.energy=[9,8,7,6,5].map(n=>mk(n,'D','re'+n));
    st.round=4; st.turn=0; st.pile=null; st.lastPlayer=null; st.passes=0;
    window.__solo.render(); };
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:900}});
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);

  /* Hector Form (K♥) in your zone makes Sanctuary (10♥) a Quick. The Rival holds a Technique and the energy
     to cast it, so its turn opens a response window. You lead the apex 2 so the Rival cannot fight back. */
  await p.evaluate(STAGE);
  await wait(300);

  /* NOT VACUOUS: if the Form were not granting `quick`, every assertion below would pass on a build where the
     bug is still present — because the window would correctly never open. Pin the grant first. */
  const grant = await p.evaluate(()=>{ const st=window.__solo.st();
    const base=window.CardmenEngine.effectOf({rank:10,suit:'H',id:'sanc'})||{};
    const patched=window.CardmenEngine.effectFor(st,0,{rank:10,suit:'H',id:'sanc'})||{};
    return { base:!!base.quick, patched:!!patched.quick }; });
  ok(grant.patched && !grant.base,
     `STAGED: Hector makes Sanctuary a Quick (base quick=${grant.base}, with the Form=${grant.patched})`);

  /* THE ⏩ BADGE MUST SAY SO TOO (v1.31.113). `cardEl` read the BASE effect, so a card the Form had just made
     answerable carried no badge — the affordance existed and the card denied it. `cardEl` now takes an
     optional OWNER and the two hand renderers pass YOU; everywhere else (the pile, both seats' zone minis, the
     deck preview) it is omitted on purpose, because judging a RIVAL's card against YOUR zone would be wrong in
     the other direction. The negative is the half that matters: the apex 2 has no effect at all, so a badge on
     it would mean the owner-aware branch is simply badging everything. */
  const badge = await p.evaluate(()=>({
    sanc: !!document.querySelector('#hand .card[data-id="sanc"] .qbadge'),
    two:  !!document.querySelector('#hand .card[data-id="y2"] .qbadge'),
    seen: document.querySelectorAll('#hand .card').length }));
  ok(badge.sanc, `the Form-made Quick carries the ⏩ badge in your hand (${badge.seen} cards rendered)`);
  ok(!badge.two, '  → and the apex 2, which has no effect at all, does not');

  // lead the unbeatable 2 so the Rival must act with an effect rather than a fight
  await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')]
    .filter(el=>el.querySelector('.card[data-id="y2"]'))[0]; if(g) g.click(); }); await wait(250);
  await clickFight(p);   // two-state button (epic step 20) — see fightclick.js

  // poll for the Respond? window — the whole point is that it OPENS
  /* ⚠ NEVER TRUNCATE THE THING YOU ASSERT ON. This captured `.slice(0,260)` and then tested the SLICE for
     "Sanctuary" — so whether it passed depended on how much text happened to sit above the offer buttons,
     which is the rival's card text and therefore the DEAL. It was a latent coin flip that nobody had
     tipped; adding the stack row to `tableContextHTML` on 2026-09-17 spent ~70 of those characters and
     turned it into a sweep failure that would not reproduce alone. Exactly the deal-dependence this repo
     has now paid for in four suites (`nettest_log`, `nettest_full`, `nettest_names`, `exporttest`).
     THE SLICE IS FOR THE MESSAGE, NEVER FOR THE TEST — and the sharper read is the BUTTONS, since "is
     Sanctuary on offer" is a question about the offer list and not about the prose around it. Both are
     kept: the buttons carry the claim, the text is what a red run prints. */
  let modal=null, offers=[];
  for(let i=0;i<160;i++){
    modal = await p.evaluate(()=>{
      const m=document.getElementById('modal');
      if(!m || !m.offsetParent) return null;
      const t=(m.textContent||'');
      return /Respond|answer|Quick/i.test(t) ? t.replace(/\s+/g,' ') : null;
    });
    if(modal){ offers = await p.evaluate(()=>[].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' '))); break; }
    await wait(60);
  }
  ok(!!modal, 'the Respond? window OPENS while you hold a Form-made Quick'+(modal?'':' — it auto-declined instead'));
  ok(offers.some(t=>/Sanctuary/i.test(t)),
     `  → and it offers Sanctuary by name — ${offers.length} button(s): [${offers.map(t=>t.split(' ')[0]).join('|')}]`);

  /* ---------- LEG 2: THE SAME BOARD UNDER AUTO MUST STAY SILENT — and still RECORD.
     Identical staging, no `prompts=all`. Nothing on this board is at stake for you (the Rival casts a
     plain Technique; no shield event), so AUTO's whole promise is that it does not stop you. This is the
     twin CLAUDE.md asks for: "no window opened" is equally true of a build where nothing ever opens one,
     so leg 1 above is what stops this one passing vacuously, and this one is what stops leg 1's flag
     hiding a regression in the default.
     SILENT IS NOT IGNORED. The ledger must still say what it did, for the same reason `nettest_autopass`
     asserts it — an auto-pass that is silent AND unrecorded is indistinguishable from a window that never
     existed, and the mode is only defensible while it can explain itself. */
  const q=await ctx.newPage(); const qerrs=[]; q.on('pageerror',e=>qerrs.push(e.message));
  await q.goto(BASEURL); await wait(700);
  await q.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await q.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);
  await q.evaluate(STAGE); await wait(300);
  const grant2=await q.evaluate(()=>{ const st=window.__solo.st();
    return !!(window.CardmenEngine.effectFor(st,0,{rank:10,suit:'H',id:'sanc'})||{}).quick; });
  ok(grant2, 'AUTO leg: the SAME staging landed — Hector still makes Sanctuary a Quick');
  await q.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')]
    .filter(el=>el.querySelector('.card[data-id="y2"]'))[0]; if(g) g.click(); }); await wait(250);
  await clickFight(q);
  let auto=null;
  for(let i=0;i<50;i++){
    auto = await q.evaluate(()=>{ const m=document.getElementById('modal');
      if(!m || !m.offsetParent) return null;
      const t=(m.textContent||''); return /Respond|answer|Quick/i.test(t) ? t.replace(/\s+/g,' ').slice(0,90) : null; });
    if(auto) break; await wait(60);
  }
  ok(!auto, 'under AUTO the same board does NOT stop you — nothing is at stake'+(auto?' — but a window opened: "'+auto+'"':''));
  const led=await q.evaluate(()=>{ try{ return (window.__solo.prioLog()||[]).join(' | '); }catch(e){ return 'NO LEDGER: '+e.message; } });
  ok(/auto-passed/i.test(led),
     '  → and the ledger still records the auto-pass, so silent is not unexplainable'+(/auto-passed/i.test(led)?'':' — ledger: '+led.slice(-220)));
  ok(qerrs.length===0,'no JS errors on the AUTO leg'+(qerrs.length?': '+qerrs.slice(0,2).join(' | '):''));

  /* ---------- LEG 3: ONE BUTTON PER PLAY, NOT PER CARD INSTANCE (2026-09-30).
     Aj, 2026-09-11: holding TWO Counter Spells against two legal targets rendered FOUR buttons, of which
     two pairs were the same play. Which physical copy leaves your hand changes nothing, so the duplicate
     is a choice you must read and cannot act on differently. Keyed on rank+suit (which IS the effect's
     identity — `EFFECTS` is keyed by suit+rank, and a class deck ships duplicate rank+suit with distinct
     ids like `7D#24`), never on card id.
     ⚠ BOTH WAYS ON ONE BOARD, because "one button" is equally true of a build that dropped the loop: the
     same window is asked for TWO COPIES of one card (expect 1) and then for TWO DIFFERENT Quicks (expect
     2). A dedupe keyed on the wrong thing passes the first and fails the second. */
  const dup=await ctx.newPage(); const derrs=[]; dup.on('pageerror',e=>derrs.push(e.message));
  await dup.goto(URL); await wait(700);
  await dup.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await dup.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1200);
  async function offersFor(hand){
    await dup.evaluate(STAGE); await wait(150);
    await dup.evaluate((h)=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.players[0].hand=[{rank:2,suit:'S',id:'y2'}].concat(h.map((c,i)=>mk(c[0],c[1],'q'+i)));
      /* ⚠ ENERGY IN BOTH SUITS. `STAGE` banks HEARTS, and the control here is ♦9 Leyline — with hearts
         alone it is simply unaffordable, so the window offered one button and the leg reported the
         product deduping too hard when nothing had been staged to dedupe. Affordability is a colour
         question in this game; a two-card control needs energy for both. */
      st.players[0].energy=[]
        .concat([1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'H','eh'+n)))
        .concat([1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'D','ed'+n)));
      window.__solo.render(); }, hand);
    await wait(200);
    await dup.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')]
      .filter(el=>el.querySelector('.card[data-id="y2"]'))[0]; if(g) g.click(); }); await wait(250);
    await clickFight(dup);
    for(let i=0;i<160;i++){
      const got=await dup.evaluate(()=>{ const m=document.getElementById('modal');
        if(!m || !m.offsetParent) return null;
        return [].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' ').split(' ·')[0]); });
      if(got && got.length){ return got; }
      await wait(60);
    }
    return [];
  }
  const twoSame = await offersFor([[10,'H'],[10,'H']]);      // two Sanctuaries — one PLAY
  ok(twoSame.length===1,
     `TWO COPIES OF ONE QUICK OFFER ONE BUTTON (${twoSame.length}: [${twoSame.join('|')}]) — which copy leaves your hand changes nothing`);
  await dup.evaluate(()=>{ const m=document.getElementById('respDecline'); if(m) m.click(); }); await wait(400);
  const twoDiff = await offersFor([[10,'H'],[9,'D']]);       // Sanctuary + Leyline — two PLAYS
  ok(twoDiff.length===2,
     `  …and two DIFFERENT Quicks still offer two (${twoDiff.length}: [${twoDiff.join('|')}]) — the dedupe is on the effect, not on "a card"`);
  ok(derrs.length===0,'no JS errors on the dedupe leg'+(derrs.length?': '+derrs.slice(0,2).join(' | '):''));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
