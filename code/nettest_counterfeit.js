/* COUNTERFEIT'S PICK ON THE PILE, FROM A NETPLAY CLIENT (drag-and-stack step 2).
 *
 * Step 2 moved Counterfeit's choice out of a dialog (`promptCounterfeit`, deleted) and onto the pile: the cards in
 * the Rival's play pulse as targets, a tap stages one, ⚡ Activate copies it. The wire did not change — the client
 * sends `{op:'activate', id, copyId}` and the host re-resolves the copy from its OWN pile — but no suite had ever
 * driven a client's Counterfeit at all, and the path to that message is new.
 *
 * Driven from the CLIENT, and judged on the HOST's copy of the client's hand, which is the ground truth for WHICH
 * card was copied. The host leads a pair of 7s and the client picks the SECOND one (the 7♥): a build that copied
 * the first card, or ignored the client's pick, copies the 7♦ and fails.
 *
 * LEG B (drag-and-stack step 4, piece 10): THE HOST's own Counterfeit must SETTLE its window like every other cast.
 * It used to call `rivalMayRespond`, which asked the AI to answer for seat 1 — the HUMAN guest here — so the guest
 * holding Leyline was never shown its window and an AI decided for it. Now the guest's box opens, its Leyline is still
 * in its hand, and once it declines the host has its board back (`NET.hostAfterOwnCast`).
 *
 * Run: node nettest_counterfeit.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { selectAndFight, clickDecline } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8460),ROOM='CF'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;   // leg B's guest must be SHOWN its window; leg A stages no Quick, so nothing changes there
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
let host, join;
const clientHand=()=>host.evaluate(()=>window.__cmf.handOf(1));        // the HOST's copy — the ground truth

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>host.evaluate(()=>document.querySelectorAll('#hand .card').length>0)), 'duel started');
  // stage after the host's opening Round card has landed (CLAUDE.md: `fin()` clears `#roundfx`)
  await until(()=>host.evaluate(()=>!/show/.test((document.getElementById('roundfx')||{}).className||'')), 80);

  /* THE HOST leads a pair of 7s; THE CLIENT holds ♠8 Counterfeit and the spades to pay for it. Round 3, so the
     pair is a legal Special. Nobody holds a Quick, so no window opens on the way. */
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(7,'D','h'),C(7,'H','h'),C(3,'C','h')], [C(8,'S','c'),C(7,'C','c'),C(4,'H','c')]],
                          [E('D','he'), E('S','ce')], null, {round:3, turn:0}); });
  await wait(600);
  ok(JSON.stringify((await clientHand()).sort())===JSON.stringify(['c4H','c7C','c8S']), 'STAGED: the client holds Counterfeit (♠8), a 7♣ and a 4♥');
  await selectAndFight(host, ['h7D','h7H']);
  ok(await until(()=>join.evaluate(()=>window.__cmf.turn()===0 && document.querySelectorAll('#pile .card').length===2), 80),
     'the host led its pair of 7s and the turn reached the client');
  await until(()=>join.evaluate(()=>!/Hold on|fighting|Waiting/.test((document.getElementById('hint')||{}).textContent||'')), 60);

  // the client casts Counterfeit: the pick opens ON THE PILE, not in a dialog
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="c8S"]'); if(c) (c.closest('.group')||c).click(); });
  await wait(250);
  await join.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && !x.disabled) x.click(); });
  const open=await until(()=>join.evaluate(()=>document.querySelectorAll('#pile .card.copyable').length===2), 40);
  const modal=await join.evaluate(()=>{ const o=document.getElementById('overlay'); return !!(o && o.classList.contains('show')); });
  ok(open && !modal, 'ON THE CLIENT, THE PICK IS ON THE PILE — both of the host\'s 7s are targets, and no dialog opened');

  // a tap stages the 7♥ — the SECOND card — and sends nothing
  await join.evaluate(()=>{ const c=document.querySelector('#pile .card[data-id="h7H"]'); if(c) c.click(); });
  await wait(600);
  const staged=await join.evaluate(()=>({ aimed:[...document.querySelectorAll('#pile .card.copyAim')].map(c=>c.dataset.id),
    ctx:((document.getElementById('ctxBtn')||{}).textContent||'').trim() }));
  ok(staged.aimed.join()==='h7H' && /Activate/.test(staged.ctx), 'a tap STAGES the 7♥ on the client  ['+JSON.stringify(staged)+']');
  ok((await clientHand()).indexOf('c8S')>=0 && !(await clientHand()).some(id=>/^CF/.test(id)), '  …and sends nothing: the host still has Counterfeit in the client\'s hand, and no copy');

  // ⚡ Activate sends it; the HOST makes the copy, of the card the client picked
  await join.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && !x.disabled) x.click(); });
  const copied=await until(async()=>(await clientHand()).some(id=>/^CF/.test(id)), 60);
  const h=await clientHand();
  ok(copied && h.some(id=>/^CF7H#/.test(id)), 'THE HOST COPIED THE CARD THE CLIENT PICKED — the 7♥, not the first one  ['+h+']');
  ok(h.indexOf('c8S')<0, '  …and Counterfeit itself left the client\'s hand');
  ok(await until(()=>join.evaluate(()=>!!document.querySelector('#hand .card[data-id^="CF7H"]') && !document.querySelector('#pile .card.copyable, #pile .card.copyAim')), 40),
     '  …and the client\'s own board shows the copy in hand, with the pile no longer lit');
  await wait(800);   // the host's narration rides a broadcast; give it a beat to land on the client
  const logs=await Promise.all([host,join].map(p=>p.evaluate(()=>{ const l=window.__cmf.log(); return (Array.isArray(l)?l:[l]).map(x=>typeof x==='string'?x:(x&&(x.text||x.t||JSON.stringify(x)))).join(' | '); })));
  if(process.env.CF_LOGDUMP) logs.forEach((l,i)=>console.log('   LOG['+(i?'join':'host')+']: '+l.split(' | ').filter(x=>/ounterfeit|7♥/.test(x)).join(' || ')));
  ok(logs.every(l=>/counterfeited a 7♥/.test(l)), 'BOTH battle logs name the copied card ("counterfeited a 7♥")  ['+logs.map(l=>(l.match(/[^|]*counterfeited[^|]*/)||['none'])[0].trim()).join(' / ')+']');

  // ================= B: the HOST's own Counterfeit settles its window — the guest is ASKED, not answered for =================
  await wait(2600);
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(8,'S','H'),C(7,'C','H'),C(4,'H','H')], [C(7,'D','G'),C(7,'H','G'),C(9,'D','G')]],
                          [E('S','hs'), E('D','gd')], null, {round:3, turn:1}); });
  await wait(600);
  await selectAndFight(join, ['G7D','G7H']);
  for(let i=0;i<40 && !(await host.evaluate(()=>window.__cmf.turn()===0 && document.querySelectorAll('#pile .card').length===2)); i++){ await clickDecline(join); await wait(200); }   // the guest's own crossing offers it Leyline — let it go
  ok(await until(()=>host.evaluate(()=>window.__cmf.turn()===0 && document.querySelectorAll('#pile .card').length===2), 60), 'B · STAGED: the guest led a pair of 7s holding Leyline, and the turn reached the host');
  await until(()=>host.evaluate(()=>!/Hold on|fighting|Waiting/.test((document.getElementById('hint')||{}).textContent||'')), 60);
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="H8S"]'); if(c) (c.closest('.group')||c).click(); }); await wait(250);
  await host.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && !x.disabled) x.click(); }); await wait(300);
  await host.evaluate(()=>{ const c=document.querySelector('#pile .card[data-id="G7H"]'); if(c) c.click(); }); await wait(250);
  await host.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && !x.disabled) x.click(); });
  const askedB=await until(()=>join.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); }), 80);
  ok(askedB, 'B · THE HOST\'S COUNTERFEIT ASKS THE GUEST — its Respond? box opens on its own board');
  ok((await clientHand()).indexOf('G9D')>=0, '  …and nobody answered for it: the guest\'s Leyline is still in its hand');
  await clickDecline(join);
  const copiedB=await until(()=>host.evaluate(()=>window.__cmf.hand().some(id=>/^CF/.test(id))), 60);   // the copy is made as Counterfeit RESOLVES, after the window
  const backB=await until(()=>host.evaluate(()=>{ const a=document.getElementById('actions'); return !!(a && a.getAttribute('data-live')==='1') && window.__cmf.turn()===0; }), 60);
  ok(copiedB && backB, '  …and once the guest says No, Counterfeit resolves and the host has its board back  '+JSON.stringify({copied:copiedB, back:backB}));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
