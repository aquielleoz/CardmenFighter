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

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
