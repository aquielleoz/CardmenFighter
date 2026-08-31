/* WHEN A SEAT IS DISCARDING TO HAND SIZE, THE OTHERS MUST BE TOLD (Aj, 2026-08-29: "the other players don't
 * [get] a prompt saying somebody is still discarding down to max hand... it's just uhhh what's happening in the
 * middle of rounds").
 *
 * At the end of a round every seat but the local one is auto-trimmed by `E.discardToLimit` and narrated after
 * the fact. Only the LOCAL player picks which cards to pitch — so in netplay it is the HOST's own pick that
 * stops the table, and the clients had nothing on screen to say why.
 *
 * `trimPending` now rides the mirror (seat + count, never cards), so a client can name the seat. Staged with the
 * HOST over the hand cap, because that is the only seat that gets an interactive pick.
 * Run: node nettest_trim.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8401,ROOM='TR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  hand:document.querySelectorAll('#hand .card').length,
  status:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
  dim:/show/.test((document.getElementById('roundfx')||{}).className||''),
  dimText:((document.getElementById('roundfx')||{}).textContent||'').trim(),
  fightOff:!!(document.getElementById('fightBtn')||{}).disabled,
  passOff:!!(document.getElementById('passBtn')||{}).disabled,
  sortLbl:((document.getElementById('sortBtn')||{}).textContent||'').trim(),
  msg:((document.getElementById('message')||{}).textContent||'').trim(),
}));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=120,ms=120){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await snap(host)).hand>0), 'duel started');

  /* THE HOST must be over the cap: it is the only seat that gets an interactive pick, because every other seat
   * is auto-trimmed. 13 cards, one played, leaves 12 against a cap of 10 — so the pick is unavoidable. */
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    const many=[]; [3,4,5,6,7,8,9,10,11,12,13,1,2].forEach((r,i)=>many.push(C(r,'DHCS'[i%4],'h')));
    window.__cmf.force(many, [C(4,'D','c'),C(5,'H','c'),C(6,'C','c'),C(7,'S','c')]);
  });
  await wait(600);
  const hs=(await snap(host)).hand;
  ok(hs>10, `host staged OVER the hand cap (${hs} cards) — the only seat that gets an interactive pick`);

  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(join)).yourTurn, 60), 'the turn reached the client');
  await join.evaluate(()=>{ const p=document.getElementById('passBtn'); if(p&&!p.disabled) p.click(); });

  // the host reaches its clean-up pick
  const picking = await until(async()=>/hand limit|Discard/i.test((await snap(host)).msg), 100);
  ok(picking, 'the host reaches its clean-up pick' + (picking?'':'  (staging problem, not the feature)'));

  /* THE ASSERTION. Play is stopped on the host's pick; the client must be told why rather than shown a gap. */
  const told = await until(async()=>/discarding to hand size/i.test((await snap(join)).status), 80);
  const js = await snap(join);
  ok(told, 'the CLIENT is told who the table is waiting on' +
     (told?` — "${js.status}"`:`  <-- REPRODUCED: the client shows "${js.status||'(nothing)'}" while play is stopped`));
  ok(!/^You/.test(js.status), '  → and it names the OTHER seat, not the reader (reader-relative, like every other label)');

  /* THE PLAY AREA IS DIMMED and carries the same words — Aj: "might as well put the announcement there". */
  ok(js.dim && /discarding to hand size/i.test(js.dimText),
     `  → and the PLAY AREA is dimmed with the announcement on it${js.dim?'':'  <-- no dim'}`);

  /* AND NOBODY ELSE MAY ACT. The turn is already the round WINNER when the pick opens, and `roundDraw` runs
     AFTER the trim — so a client that had just won could otherwise play into a round with no cards dealt. */
  ok(js.fightOff && js.passOff,
     `  → and its action buttons are LOCKED while the table waits (fight ${js.fightOff?'off':'LIVE'}, pass ${js.passOff?'off':'LIVE'})`);

  /* BUT SORT STILL WORKS. It reorders your own view of your own hand — no state, no intent, invisible to
     everyone else — so it is the one control that should survive any wait. */
  const before=js.sortLbl;
  await join.evaluate(()=>{ const b=document.getElementById('sortBtn'); if(b) b.click(); });
  await wait(300);
  const after=(await snap(join)).sortLbl;
  ok(after!==before, `  → but SORT still works while waiting ("${before}" → "${after}")`);

  // and it clears once the host has picked
  /* A PICK IS CONFIRMED WITH FIGHT. `$('fightBtn')` is wired as `pick ? confirmPick() : doFight()`, so the
     clean-up pick reuses the same button — the first version of this suite hunted for a "Confirm"/"Discard"
     control that does not exist and timed out on a working build. */
  await host.evaluate(()=>{
    const cards=[...document.querySelectorAll('#hand .card')];
    for(const c of cards){
      c.click();
      const f=document.getElementById('fightBtn');
      if(f && !f.disabled){ f.click(); return; }
    }
  });
  const cleared = await until(async()=>!/discarding to hand size/i.test((await snap(join)).status), 90);
  ok(cleared, '  → and the message clears when the pick is done, rather than sticking');

  /* ---- AND THE CLIENT PICKS ITS OWN PITCHES TOO (Aj: "no. all players choose what to discard") -------------
     Until v1.31.70 `endOfRoundTrimThen` auto-trimmed every seat but the local one, so the host chose its own
     cards and every client had its LOWEST taken by `discardToLimit`. The assertion that catches it is not "the
     hand shrank" — it shrank either way — but WHICH cards left: staged so the client's lowest card is one it
     would never choose, then check that card is still in hand after it picks something else. */
  await wait(1200);
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    const hh=[C(3,'D','h2'),C(4,'H','h2'),C(5,'C','h2'),C(6,'S','h2')];
    // client is over the cap by exactly 1; its LOWEST card is 3♦, which the auto-trim would take
    const ch=[C(3,'D','c2'),C(9,'H','c2'),C(10,'C','c2'),C(11,'S','c2'),C(12,'D','c2'),C(13,'H','c2'),
              C(1,'C','c2'),C(2,'S','c2'),C(8,'D','c2'),C(7,'H','c2'),C(6,'C','c2')];
    window.__cmf.force(hh, ch);
  });
  await wait(600);
  const cOver = await join.evaluate(()=>document.querySelectorAll('#hand .card').length);
  ok(cOver>10, `client staged over the cap (${cOver} cards), lowest card 3♦`);

  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  await until(async()=>(await snap(join)).yourTurn, 60);
  await join.evaluate(()=>{ const p=document.getElementById('passBtn'); if(p&&!p.disabled) p.click(); });

  const gotPicker = await until(async()=>await join.evaluate(()=>
     /[Dd]iscard/.test((document.getElementById('message')||{}).textContent||'')), 120);
  ok(gotPicker, 'the CLIENT gets its OWN clean-up picker' +
     (gotPicker?'':'  <-- REPRODUCED: its cards were chosen for it by discardToLimit'));

  // it pitches its HIGHEST card instead of the lowest, which the auto-trim would never do
  await join.evaluate(()=>{
    const cards=[...document.querySelectorAll('#hand .card')];
    const hi=cards.find(c=>/2♠|2\u2660/.test(c.textContent||'')) || cards[cards.length-1];
    if(hi) hi.click();
    const f=document.getElementById('fightBtn'); if(f&&!f.disabled) f.click();
  });
  await wait(1200);
  const kept = await join.evaluate(()=>[...document.querySelectorAll('#hand .card')].some(c=>/3♦|3\u2666/.test(c.textContent||'')));
  ok(kept, '  → and the card IT chose left, not the lowest one the engine would have taken (3♦ still in hand)');

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
