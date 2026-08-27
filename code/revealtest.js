/* Outbalance's HAND READ, in the real built page (v1.31.4). Pandora's boost on ♠A promises "look at the
 * target's hand", and a promise like that is only kept if the UI actually shows it — the engine hands the
 * cards over exactly once through E.takeReveal(seat), so a dropped pickup loses them silently with no error.
 * Also asserts the thing that must NEVER happen: the revealed hand must not be reachable from `state`, because
 * anything on state rides along in a netplay snapshot — including back to the player whose hand it is.
 * Run: node revealtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1400,height:1000}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
  const waitFor=async (fn,n)=>{ for(let i=0;i<(n||60);i++){ if(await fn()) return true; await wait(150);} pollTimedOut(fn); return false; };

  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>{ const s=document.getElementById('setPlayers'); s.value='4'; s.dispatchEvent(new Event('change')); }); await wait(350);
  await p.evaluate(()=>{ const g=document.getElementById('goFirstBtn'); if(g)g.click(); }); await wait(1200);
  ok(await p.evaluate(()=>!!(window.__solo&&window.__solo.st()&&window.__solo.st().numPlayers===4)), '4-player free-for-all started');

  // Stage it: you hold Outbalance (♠A) with Pandora (Q♠) in the zone; seat 2 holds a pair of Kings and a junk card.
  const staged=await p.evaluate(()=>{
    const st=window.__solo.st(), E=window.CardmenEngine;
    const mk=(r,s,t)=>({rank:r,suit:s,id:(t||'')+r+s});
    st.round=3; st.turn=0; st.pile=null; st.passes=0; st.pending=null; st.respondFor=null; st.stack=[];
    st.players[0].hand=[mk(1,'S'),mk(5,'S'),mk(6,'S')];
    st.players[0].forms=[{rank:12,suit:'S',tier:'queen',name:'Q',id:'zQS'}];    // Pandora
    st.players[0].energy=Array.from({length:12},(_,i)=>mk(4,'S','e'+i));
    st.players[1].hand=[mk(3,'C'),mk(4,'C'),mk(7,'C')]; st.players[1].energy=[];   // nobody else can answer
    st.players[2].hand=[mk(13,'H'),mk(13,'D'),mk(4,'C')]; st.players[2].energy=[];
    st.players[3].hand=[mk(3,'D'),mk(5,'H'),mk(8,'H')]; st.players[3].energy=[];
    window.__solo.render();
    const eff=E.effectFor(st,0,mk(1,'S'));
    return { reveal:!!eff.reveal, n:eff.n };
  });
  ok(staged.reveal===true && staged.n===2, 'Pandora makes ♠A a reveal-and-discard-2 (reveal='+staged.reveal+' n='+staged.n+')');

  // Cast it at seat 2. Targeting is confirm-first: tap the target, then press the context button (⚡ Activate).
  await p.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="1S"]'); if(c)c.click();
    const a=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn');
    if(a&&a.offsetParent!==null&&!a.disabled) a.click(); else if(ctx&&!ctx.disabled) ctx.click(); });
  await wait(500);
  // Targeting is confirm-first (v1.29.5): the cast must NOT have fired yet — no energy spent, card still in hand.
  const staging=await p.evaluate(()=>{
    const st=window.__solo.st();
    return { energy: st.players[0].energy.length, holdsIt: st.players[0].hand.some(c=>c.id==='1S'),
             msg: ((document.getElementById('message')||{}).textContent||'').trim() };
  });
  ok(staging.energy===12 && staging.holdsIt, 'nothing is spent until a target is confirmed ("'+staging.msg+'")');
  await p.evaluate(()=>{ const o=document.querySelector('[data-seat="2"], .oppCard[data-opp="2"], #opp2'); if(o)o.click(); });
  await wait(300);
  await p.evaluate(()=>{ const ctx=document.getElementById('ctxBtn'); if(ctx&&!ctx.disabled) ctx.click(); });

  const shown=await waitFor(()=>p.evaluate(()=>{
    const ov=document.getElementById('overlay');
    return !!(ov&&ov.classList.contains('show')&&document.getElementById('revealHand'));
  }));
  ok(shown, 'the reveal modal opens on the cast');
  const seen=await p.evaluate(()=>{
    const box=document.getElementById('revealHand'); if(!box) return null;
    return { n: box.querySelectorAll('.card').length,
             ids: [].map.call(box.querySelectorAll('.card'),c=>c.dataset.id).sort().join(','),
             head: (document.querySelector('#modal h2')||{}).textContent||'' };
  });
  ok(seen && seen.n===3, 'it shows all three of the cards they were holding (showed '+(seen&&seen.n)+')');
  ok(seen && seen.ids==='13D,13H,4C', 'and they are the RIGHT cards — the pair of Kings is visible ('+(seen&&seen.ids)+')');
  ok(seen && /hand/i.test(seen.head) && !/^\s*$/.test(seen.head), 'the modal names whose hand it is ("'+(seen&&seen.head.trim())+'")');

  // The read must be derived-only on state, never the cards themselves.
  const leak=await p.evaluate(()=>{
    const st=window.__solo.st();
    let s=''; try{ s=JSON.stringify(st); }catch(e){ return {err:String(e)}; }
    return { hasRevealed: s.indexOf('revealed')>=0, read: st.players[0]._read||null };
  });
  ok(leak && leak.hasRevealed===false, 'the revealed hand is NOT on state (a netplay snapshot cannot carry it)');
  ok(leak && leak.read && leak.read['2'] && leak.read['2'].best===13 && leak.read['2'].pairs===1,
     'the caster keeps only a SUMMARY read of it (best=13, pairs=1)');

  // One look, not a permanent window: dismissing it does not re-open, and the pickup is spent.
  await p.evaluate(()=>{ const bn=document.getElementById('revOk'); if(bn)bn.click(); }); await wait(400);
  ok(await p.evaluate(()=>!document.getElementById('overlay').classList.contains('show')), 'Got it dismisses it');
  ok(await p.evaluate(()=>window.CardmenEngine.takeReveal(0)===null), 'the reveal is one-shot — a second pickup returns nothing');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
