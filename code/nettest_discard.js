/* Deterministic netplay REMOTE FORCED-DISCARD: the host casts Telekinesis (3D, "target Rival discards 2"); the
 * remote client gets the discard PICKER on its own board and chooses which 2 to pitch. Verifies the picker appears
 * from the mirror, the client's chosen ids resolve on the host, its hand shrinks by 2, and no errors / stays in sync. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8283),ROOM='DC'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const handOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.hand():[]);
const pickerUp=p=>p.evaluate(()=>/discard/i.test((document.getElementById('message')||{}).textContent||'') && document.querySelectorAll('#hand .card').length>0);
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1200); await startDuel(host, join);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  ok(await turnOf(host)===0,'host leads round 1');
  const energy=[D(2,'D','e'),D(3,'D','e'),D(4,'C','e'),D(5,'H','e'),D(6,'S','e')];
  // Host holds Telekinesis (3D); rival holds 4 plain cards (NO Counter Spell 4D → the response window auto-passes).
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh:[D(3,'D'),D(7,'C'),D(9,'H')],rh:[D(2,'C'),D(6,'H'),D(8,'S'),D(9,'C')],he:energy,re:energy});
  await wait(500);
  const before=(await handOf(join)).length;
  ok(before===4,'client starts with 4 cards in hand ('+before+')');

  // Host activates Telekinesis targeting the sole rival.
  await host.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="3D"]'); if(c)c.click();
    var ca=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn');
    if(ca&&ca.offsetParent!==null&&!ca.disabled&&!/off/.test(ca.className)) ca.click();
    else if(ctx&&!ctx.disabled&&/Activate|Choose target/i.test(ctx.textContent||'')) ctx.click(); });

  // v1.24.0 made hostile-singular effects (incl. Telekinesis' discardOpp) TARGET-FIRST: the button reads
  // "🎯 Choose target" and the energy is only spent once a target is picked. Tap the opponent panel.
  await wait(300);
  await host.evaluate(()=>{ var t=document.querySelector('.oppPanel.targetable')||document.querySelector('.oppPanel')||document.querySelector('#rival.targetable'); if(t)t.click(); });
  // v1.29.5: the target tap only STAGES it — confirm with ⚡ Activate before anything resolves.
  await wait(250);
  await host.evaluate(()=>{ var b=document.getElementById('ctxBtn'); if(b && /Activate/i.test(b.textContent||'')) b.click(); });

  // Wait for the discard picker to appear on the CLIENT (may follow a brief auto-declined response window).
  let picker=false; for(let i=0;i<50;i++){ if(await pickerUp(join)){ picker=true; break; } await wait(120); }
  ok(picker,'client discard picker appeared from the mirror');

  /* AND THE SEAT THAT IS WAITING MUST BE TOLD WHY (v1.31.69). Aj asked the symmetric question — the round-end
   * notice covers the HOST picking, so does anything cover a CLIENT picking? It did not: the host set its own
   * `rivalStatus` and no other seat had a notice at all. One notice now covers both kinds of discard. */
  const hw = await host.evaluate(()=>({
    status:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
    dim:/show/.test((document.getElementById('roundfx')||{}).className||''),
    dimText:((document.getElementById('roundfx')||{}).textContent||'').trim() }));
  ok(/is discarding/i.test(hw.status),
     `the WAITING seat is told why play has paused — "${hw.status||'(nothing)'}"`);
  ok(hw.dim && /is discarding/i.test(hw.dimText),
     '  → and its play area is dimmed with the same words');
  ok(!/^You is|^You are discarding/.test(hw.status),
     '  → named reader-relative, not from the sender’s point of view');

  // Client selects 2 cards and confirms.
  const chosen=await join.evaluate(()=>{ var cards=[].slice.call(document.querySelectorAll('#hand .card')).slice(0,2); cards.forEach(c=>c.click()); var f=document.getElementById('fightBtn'); if(f)f.click(); return cards.map(c=>c.dataset.id); });
  await wait(900);

  const after=(await handOf(join)).length;
  ok(after===before-2,'client hand shrank by 2 after choosing its pitches ('+before+' → '+after+', chose '+chosen.join(',')+')');
  ok(await turnOf(host)===0,'still the host\'s turn after the Technique resolves');
  ok(await host.evaluate(()=>window.__cmf.pending())===false,'no lingering stack on the host');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
