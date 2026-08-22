/* Local FREE-FOR-ALL parity: the two gameplay gaps from MP-PARITY-AUDIT.md, which had no coverage — which
 * is exactly why they survived. Both are UI-side call sites that hardcoded seat 1 (RIVAL):
 *   A1  rivalPreFightThen gated on `pf.q!==RIVAL`, so when the pre-fight holder resolved to another seat
 *       (e.g. P2 eliminated → P3 is next) Back Stab was silently dropped on YOUR fight.
 *   A2  settleWindows drained only `respondFor===RIVAL`; the other branch handles YOU, so a window owed to
 *       seat 2+ was handled by NEITHER — that seat never countered and the window stayed pending.
 * NOTE ai.js already handled both correctly for AI-vs-AI turns; only the human-acts paths were broken.
 * Run: node mptest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const log=()=>p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()));
  const hasLog=async re=>{ for(let i=0;i<60;i++){ if((await log()).some(l=>re.test(l))) return true; await wait(150);} return false; };
  const msg=()=>p.evaluate(()=>((document.getElementById('message')||{}).textContent||'').trim());
  const waitFor=async (fn,n)=>{ for(let i=0;i<(n||60);i++){ if(await fn()) return true; await wait(150);} return false; };

  async function start3p(){
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='3'; s.dispatchEvent(new Event('change')); }); await wait(350);
    // aiPreFightLock refuses on minion/recruit, so pin the opponents to knight
    await p.evaluate(()=>{ document.querySelectorAll('#oppList select.strength').forEach(s=>{ s.value='knight'; s.dispatchEvent(new Event('change')); }); }); await wait(300);
    await p.evaluate(()=>{ const b=document.getElementById('goFirstBtn'); if(b)b.click(); }); await wait(1200);
    return p.evaluate(()=>!!(window.__solo && window.__solo.st() && window.__solo.st().numPlayers===3));
  }

  // ================= A1: P3 springs Back Stab on your fight when P2 is out =================
  ok(await start3p(), '3-player free-for-all started');
  const staged=await p.evaluate(()=>{
    const st=window.__solo.st(), E=window.CardmenEngine;
    const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=3; st.turn=0; st.pile=null; st.passes=0; st.preFightHandled=false; st.preFightQ=null;
    st.players[1].eliminated=true;                                   // P2 is OUT — so P3 becomes the pre-fight holder
    st.players[0].hand=[mk(5,'D'),mk(9,'H')];
    const p3=st.players[2];
    p3.hand=[mk(10,'S'),mk(8,'S','a'),mk(8,'H','b')];                // Back Stab + a pair (aiPreFightLock wants hasCombo)
    p3.forms=[{rank:11,suit:'S',tier:'ride',name:'J'},{rank:12,suit:'S',tier:'queen',name:'Q'},{rank:13,suit:'S',tier:'king',name:'K'}];  // Hermes Super → Back Stab is a Quick
    p3.energy=Array.from({length:14},(_,i)=>mk(2,'S','e'+i));
    window.__solo.render();
    return { holder: E.openPreFight(st).q, super: E.hasSuper(p3) };
  });
  ok(staged.super===true, 'P3 is in Super Mode (J+Q+K), so Back Stab is a Quick');
  ok(staged.holder===2, 'the pre-fight holder really is seat 2, not 1 ('+staged.holder+') — the case the old gate dropped');
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
    const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await hasLog(/P3.*sprang Back Stab/i), 'P3 sprang Back Stab against your fight (was silently skipped before)');
  ok(await p.evaluate(()=>{ const st=window.__solo.st(); return !!(st.players[0].lockSkip||st.players[0].lockRound); }), '…and you are actually locked out');
  ok(!(await log()).some(l=>/Rival sprang/.test(l)), '…and it is credited to P3, never to "Rival"');

  // ================= A2: P3 counters your Technique =================
  ok(await start3p(), '3-player game restarted for the response window');
  const s2=await p.evaluate(()=>{
    const st=window.__solo.st();
    const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=3; st.turn=0; st.pending=null; st.respondFor=null; st.stack=[];
    st.players[0].hand=[mk(6,'D')];                                  // Back to the Books — a plain Technique
    st.players[0].energy=Array.from({length:12},(_,i)=>mk(6,'D','y'+i));
    st.players[1].hand=[mk(3,'C')];                                  // P2 holds nothing reactive
    st.players[1].energy=[];
    const p3=st.players[2];
    p3.hand=[mk(4,'D')];                                            // Counter Spell
    p3.energy=Array.from({length:12},(_,i)=>mk(4,'D','z'+i));
    window.__solo.render();
    return true;
  });
  ok(s2, 'staged: only P3 can answer');
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="6D"]'); if(c)c.click();
    const a=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn');
    if(a&&a.offsetParent!==null&&!a.disabled) a.click(); else if(ctx&&!ctx.disabled) ctx.click(); });
  ok(await hasLog(/You played a Technique - 6♦/), 'your Technique resolved');
  // The window OPENS for seat 2 (verified at engine level: respondFor===2). The fix is that it now DRAINS.
  // P3 declines here because Back to the Books is a harmless draw — respondDecision only counters real
  // threats — so the observable proof is the drain, not a counter line.
  ok(await p.evaluate(()=>{ const st=window.__solo.st(); return !st.pending && st.respondFor==null; }),
     'the seat-2 response window DRAINED (before the fix nothing handled respondFor 2+ and the turn parked)');
  ok(await p.evaluate(()=>window.__solo.st().turn===0), '…and it is still your turn, not a stalled board');
  ok(!(await log()).some(l=>/Rival countered|Rival answered/.test(l)), 'no opponent action is credited to "Rival" in a free-for-all');

  // ================= B1: an opponent's Equipment and Forms are reachable =================
  ok(await start3p(), '3-player game restarted for opponent-zone targeting');
  await p.evaluate(()=>{
    const st=window.__solo.st(); const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=4; st.turn=0; st.pile=null; st.pending=null; st.respondFor=null;
    st.players[0].hand=[mk(7,'D'),mk(4,'C')];                         // Forceful Strip + a spare: the engine refuses to empty your hand
    st.players[0].energy=Array.from({length:14},(_,i)=>mk(7,'D','y'+i));
    st.players[1].equipment=[]; st.players[1].forms=[];
    st.players[2].equipment=[{ id:'eq-caltrops', card:mk(7,'S'), name:'Caltrops', counters:1, oppDelta:-2 }];
    st.players[2].forms=[{rank:12,suit:'S',tier:'queen',name:'Pandora Form',card:mk(12,'S')}];
    window.__solo.render();
  }); await wait(400);
  ok(await p.evaluate(()=>!!document.querySelector('.oppPanel .oppGear.tappable')), 'the gear line on an opponent panel is tappable');
  ok(await p.evaluate(()=>!document.querySelector('.oppPanel .oppZones.open')), '…and its zones start collapsed, keeping the strip compact');
  // Aj hit this: expanding IN FLOW grew #opponents, and since it is flex:0 0 auto while #board is flex:1 1 auto,
  // the board lost exactly that much height — visibly flattening the battle log and the description box.
  const hBefore=await p.evaluate(()=>({board:Math.round(document.getElementById('board').getBoundingClientRect().height),
    log:Math.round(document.getElementById('logWrap').getBoundingClientRect().height),
    side:Math.round(document.getElementById('side').getBoundingClientRect().height)}));
  await p.evaluate(()=>{ const g=[].find.call(document.querySelectorAll('.oppPanel'),el=>/Caltrops/.test(el.textContent)).querySelector('.oppGear'); g.click(); });
  await wait(400);
  ok(await p.evaluate(()=>!!document.querySelector('.oppPanel .oppZones.open .eq')), 'tapping it opens that seat\'s real Equipment zone (a buildEqBox, not a label)');
  ok(await p.evaluate(()=>!!document.querySelector('.oppPanel .oppZones.open .formZone')), '…and their Forms & Rides zone');
  ok(await p.evaluate(()=>window.__solo.st().turn===0), '…without the tap registering as a seat pick');
  const hAfter=await p.evaluate(()=>({board:Math.round(document.getElementById('board').getBoundingClientRect().height),
    log:Math.round(document.getElementById('logWrap').getBoundingClientRect().height),
    side:Math.round(document.getElementById('side').getBoundingClientRect().height)}));
  ok(hBefore.board===hAfter.board && hBefore.log===hAfter.log && hBefore.side===hAfter.side,
     'opening the zones does NOT flatten the battle log or description box ('+JSON.stringify(hBefore)+' → '+JSON.stringify(hAfter)+')');
  ok(await p.evaluate(()=>getComputedStyle(document.querySelector('.oppZones.open')).position==='absolute'),
     '…because the zones float as a popover instead of expanding in flow');
  // The zones are a POPOVER below the panel (in-flow expansion stole height from the board), so the box is
  // deliberately outside the panel box. What must hold: it hangs under its own panel and stays on screen.
  ok(await p.evaluate(()=>{
    const pnl=[].find.call(document.querySelectorAll('.oppPanel'),el=>/Caltrops/.test(el.textContent));
    const pr=pnl.getBoundingClientRect(), pop=pnl.querySelector('.oppZones.open').getBoundingClientRect();
    const onScreen = pop.left>=0 && pop.right<=window.innerWidth+1 && pop.top>=0;
    return Math.abs(pop.left-pr.left)<=2 && pop.top>=pr.bottom-1 && onScreen;
  }), '…and the popover hangs under its own panel, fully on screen');

  // now cast Forceful Strip and actually remove their Caltrops — the original report
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="7D"]'); if(c)c.click();
    const a=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn');
    if(a&&a.offsetParent!==null&&!a.disabled) a.click(); else if(ctx&&!ctx.disabled) ctx.click(); });
  await wait(500);
  ok(await p.evaluate(()=>document.querySelectorAll('.oppPanel .oppZones.open').length>0), 'targeting force-opens the panels so the target cannot hide');
  const tgt=await p.evaluate(()=>!!document.querySelector('.oppPanel .oppZones .eq.targetable'));
  ok(tgt, 'their Caltrops is marked .targetable (it was unclickable before — the whole reported bug)');
  await p.evaluate(()=>{ const t=document.querySelector('.oppPanel .oppZones .eq.targetable'); if(t)t.click(); });
  await wait(700);
  ok(await p.evaluate(()=>window.__solo.st().players[2].equipment.length===0), 'tapping it REMOVED their Caltrops');
  ok(await hasLog(/Forceful Strip/i), '…and the play is logged');

  // ================= C1: opponents' turns are actually presented =================
  ok(await start3p(), '3-player game restarted for turn presentation');
  await p.evaluate(()=>{
    const st=window.__solo.st(); const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=3; st.turn=0; st.pile=null; st.pending=null; st.respondFor=null;
    st.players[0].hand=[mk(4,'H'),mk(5,'C')];
    st.players[1].hand=[mk(9,'S')]; st.players[1].energy=[];
    st.players[2].hand=[mk(10,'H')]; st.players[2].energy=[];
    window.__solo.render();
  }); await wait(300);
  // your own play writes the caption; an opponent's turn must then OVERWRITE it
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="4H"]'); if(c)c.click();
    const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  // NB: your own fight does not set the centre caption (the log carries it) — the caption after your play is a
  // prompt/status line. What matters for C1 is that an opponent's turn WRITES one at all, asserted next.
  ok(await hasLog(/^You played/), 'your own play is logged');
  // an opponent then acts — the caption must name THEM, never still say "You played"
  const capt=await waitFor(async()=>{ const m=await msg(); return /P2|P3/.test(m); }, 90);
  ok(capt, 'an opponent\'s turn OVERWRITES the caption with their name (it used to stay "You played…"): "'+(await msg()).slice(0,60)+'"');
  ok(!/^You played/.test(await msg()), '…so the stage and the caption no longer disagree');
  ok(await p.evaluate(()=>window.__solo.st().round>=3), 'the game progressed through the opponents\' turns');

  // ================= targeting is CONFIRM-FIRST (Aj: "always err on the side of confirming first") =================
  ok(await start3p(), '3-player game restarted for target confirmation');
  await p.evaluate(()=>{
    const st=window.__solo.st(); const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=3; st.turn=0; st.pile=null; st.pending=null; st.respondFor=null;
    st.players[0].hand=[mk(3,'D'),mk(5,'C')];                          // Telekinesis (discardOpp → needs a target)
    st.players[0].energy=Array.from({length:10},(_,i)=>mk(3,'D','y'+i));
    st.players[1].hand=[mk(9,'S'),mk(8,'S','b')]; st.players[2].hand=[mk(10,'H'),mk(7,'H','c')];
    window.__solo.render();
  }); await wait(300);
  const nrg0=await p.evaluate(()=>window.__solo.st().players[0].energy.length);
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="3D"]'); if(c)c.click(); }); await wait(200);
  ok(/Choose target/i.test(await p.evaluate(()=>(document.getElementById('ctxBtn')||{}).textContent||'')), 'a targeting effect offers "🎯 Choose target"');
  await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(300);
  ok(/Pick a target/i.test(await p.evaluate(()=>(document.getElementById('ctxBtn')||{}).textContent||'')), 'entering target mode asks you to pick one');
  await p.evaluate(()=>{ const t=document.querySelector('.oppPanel[data-seat="2"]'); if(t)t.click(); }); await wait(300);
  ok(await p.evaluate(()=>!!document.querySelector('.oppPanel.aimed')), 'tapping a rival STAGES it (marked "aimed")');
  ok(await p.evaluate(()=>window.__solo.st().players[0].energy.length)===nrg0, '…and spends NOTHING yet');
  ok(await p.evaluate(()=>window.__solo.st().players[2].hand.length===2), '…and does not resolve the effect yet');
  ok(/Activate/i.test(await p.evaluate(()=>(document.getElementById('ctxBtn')||{}).textContent||'')), '…the button becomes ⚡ Activate to confirm');
  // Clear must abandon it with nothing spent
  await p.evaluate(()=>document.getElementById('clearBtn').click()); await wait(250);
  ok(await p.evaluate(()=>window.__solo.st().players[0].energy.length)===nrg0, 'Clear cancels with nothing spent');
  ok(await p.evaluate(()=>!document.querySelector('.oppPanel.aimed')), '…and un-aims the target');
  // re-aim and confirm for real
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="3D"]'); if(c)c.click(); }); await wait(200);
  await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(250);
  await p.evaluate(()=>{ const t=document.querySelector('.oppPanel[data-seat="2"]'); if(t)t.click(); }); await wait(250);
  await p.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(700);
  ok(await p.evaluate(()=>window.__solo.st().players[0].energy.length)<nrg0, 'confirming with ⚡ Activate finally spends the energy');
  ok(await p.evaluate(()=>window.__solo.st().players[2].hand.length<2), '…and resolves against the seat you aimed at (P3, not the default next seat)');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
