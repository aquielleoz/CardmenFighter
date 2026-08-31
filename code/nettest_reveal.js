/* OUTBALANCE'S HAND READ OVER NETPLAY (3 players). Pandora's ♠A says "look at the target's hand", but the
 * effect resolves on the HOST — so before v1.31.5 a client that cast it paid the energy and saw nothing.
 * The host now pushes a `t:'reveal'` frame to the caster's seat.
 * Verifies: the CASTER (a client) sees the modal with the target's real cards; the target is named in the
 * caster's OWN frame (absolute seats are rotated on arrival, like the log channel); and — the half that
 * matters — neither the uninvolved third seat nor the host pops a reveal for someone else's read.
 * Over BroadcastChannel. Run: node nettest_reveal.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8311,ROOM='RV'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'application/javascript'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const revealBox=p=>p.evaluate(()=>{
  const ov=document.getElementById('overlay'), box=document.getElementById('revealHand');
  if(!ov||!ov.classList.contains('show')||!box) return null;
  return { n: box.querySelectorAll('.card').length,
           ids: [].map.call(box.querySelectorAll('.card'),c=>c.dataset.id).sort().join(','),
           head: ((document.querySelector('#modal h2')||{}).textContent||'').trim() };
});
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await host.waitForTimeout(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await ready(c1); await wait(300); await ready(c2);
  await waitFor(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await waitFor(async()=>(await turnOf(host))===0), '3-player online table started');

  /* Seat 1 (c1) casts, seat 2 (c2) is the target and holds a pair of Kings. Seat 0 (host) is the bystander
   * whose screen must stay clean. Round 3 so Techniques are live; turn handed to seat 1. */
  const energy=Array.from({length:12},(_,i)=>D(4,'S','e'+i));
  const hands=[ [D(9,'C'),D(8,'C'),D(7,'C')],          // seat 0 — host, bystander
                [D(1,'S'),D(5,'S'),D(6,'S')],          // seat 1 — the caster, holding Outbalance (♠A)
                [D(13,'H'),D(13,'D'),D(4,'C')] ];      // seat 2 — the target: a pair of Kings
  const staged=await host.evaluate(function(a){
    return window.__cmf.forceAll(a.hands, [a.energy, a.energy, []], null,
      { forms:{ 1:[{rank:12,suit:'S',tier:'queen',name:'Pandora'}] }, round:3, turn:1 });
  }, { hands, energy });
  ok(staged===true, 'staged: seat 1 holds ♠A under Pandora, seat 2 holds a pair of Kings');
  await wait(600);
  ok(await waitFor(async()=>(await turnOf(c1))===0), 'it is the caster seat\'s turn (its own frame reads turn 0)');

  // Cast it. Targeting is confirm-first: select, activate, tap the target panel, then confirm.
  await c1.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click();
    var c=document.querySelector('#hand .card[data-id="1S"]'); if(c)c.click();
    var ca=document.getElementById('cardActivate'), cx=document.getElementById('ctxBtn');
    if(ca&&ca.offsetParent!==null&&!ca.disabled&&!/off/.test(ca.className)) ca.click();
    else if(cx&&!cx.disabled&&/Activate|Choose target/i.test(cx.textContent||'')) cx.click(); });
  await wait(400);
  /* Tap seat 2 in the CASTER's frame. The client's mirror is seat-rotated (its own seat is 0), so the
   * absolute seat 2 is local seat 1 here — pick the panel by its data-seat rather than by position. */
  await c1.evaluate(()=>{ var t=document.querySelector('.oppPanel[data-seat="1"]')||document.querySelector('.oppPanel.targetable')||document.querySelector('.oppPanel'); if(t)t.click(); });
  await wait(300);
  await c1.evaluate(()=>{ var b=document.getElementById('ctxBtn'); if(b && /Activate/i.test(b.textContent||'')) b.click(); });

  const got=await waitFor(async()=>!!(await revealBox(c1)));
  ok(got, 'the CASTER (a client) gets the reveal — this is the bug that is fixed');
  const seen=await revealBox(c1);
  ok(seen && seen.n===3, 'it shows all three cards the target held (showed '+(seen&&seen.n)+')');
  ok(seen && seen.ids==='13D,13H,4C', 'and they are the RIGHT cards — the pair of Kings is visible ('+(seen&&seen.ids)+')');
  ok(seen && /hand/i.test(seen.head) && !/undefined/i.test(seen.head),
     'the target is named in the caster\'s own frame ("'+(seen&&seen.head)+'")');

  // The half that matters: nobody else's screen shows a hand they were not entitled to.
  await wait(700);
  const bystander=await revealBox(host), target=await revealBox(c2);
  ok(bystander===null, 'the HOST does not pop a reveal for a read that is not its own');
  ok(target===null, 'the uninvolved third seat does not pop one either');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
