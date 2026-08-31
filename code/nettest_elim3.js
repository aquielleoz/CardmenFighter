/* N-PLAYER ELIMINATION OVER NETPLAY (3 players). In 'chosen' mode the round winner picks the target; here the
 * chosen target is already at 0 shields, so the strike is the FIGHTER KICK — that player is eliminated and the
 * remaining two continue. Verifies: the eliminated client sees itself OUT (mirror.eliminated), the game is NOT
 * finished (2 alive), the host keeps driving, and the survivors advance to the next round. Over BroadcastChannel. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8303,ROOM='EL'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const shieldsOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.shields():null);
const roundOf=p=>p.evaluate(()=>parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0);
const elimSelf=p=>p.evaluate(()=>window.__cmf?window.__cmf.eliminated(0):null);   // seat 0 = "me" on both host and (rotated) client state
const finishedOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.finished():null);    // reads live `state.finished` — works on host and client
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const leadFirst=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); });
const leadCombo=(p,ids)=>p.evaluate(function(ids){ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); ids.forEach(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); }); var f=document.getElementById('fightBtn'); if(f)f.click(); }, ids);
const passT=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var b=document.getElementById('passBtn'); if(b)b.click(); });
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
  await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6);

  // Round 1 (jabs): host leads, c1 & c2 pass → host wins → round 2, host leads.
  await leadFirst(host);
  await waitFor(async()=>(await turnOf(c1))===0); await passT(c1);
  await waitFor(async()=>(await turnOf(c2))===0); await passT(c2);
  ok(await waitFor(async()=>await roundOf(host)>=2 && (await turnOf(host))===0),'reached round 2, host leads');

  // Round 2: host holds a straight; c2 is on its LAST legs at 0 shields (host=4, c1=4, c2=0).
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, null, a.sh), {
    hands:[[D(3,'C'),D(4,'C'),D(5,'C'),D(6,'C'),D(7,'C')], [D(2,'H',"a"),D(3,'S',"a"),D(9,'H',"a")], [D(2,'S',"b"),D(4,'H',"b"),D(9,'C',"b")]],
    sh:[4,4,0]
  });
  await wait(500);

  // Host leads the straight; c1 & c2 pass → host wins WITH a combo → loss-target pick.
  await leadCombo(host,['3C','4C','5C','6C','7C']);
  await waitFor(async()=>(await turnOf(c1))===0); await passT(c1);
  await waitFor(async()=>(await turnOf(c2))===0); await passT(c2);
  ok(await waitFor(async()=>await host.evaluate(()=>!!document.querySelector('.oppPanel.targetable'))),'host got the choose-a-target prompt');

  /* A MID-GAME KICK MUST STILL PLAY THE ROUND CEREMONY ON THE SURVIVORS. At 3-6 players EVERY elimination is
     a Fighter Kick and only the LAST one ends the game, so a client that skips its beats whenever `res.kick`
     is set would go silent here while the host plays them — and would strand `pendingKick` on a seat that
     never reaches endGame(), firing a stray finisher later. v1.31.62 gates that skip on `finished`, not `kick`.
     Aj spotted the distinction from the rules ("each loss is by a kick, so there would be multiple kicks").
     Armed BEFORE the kick and read after, because the banner shows for ~1.3s and polling for it would race. */
  await c1.evaluate(()=>{ window.__banners=[];
    var fx=document.getElementById('roundfx'); if(!fx) return;
    new MutationObserver(function(){
      var t=(fx.textContent||'').trim().replace(/\s+/g,' ');
      if(/show/.test(fx.className||'') && t && window.__banners[window.__banners.length-1]!==t) window.__banners.push(t);
    }).observe(fx, {attributes:true, childList:true, subtree:true, characterData:true});
  });

  // Host picks client 2 (absolute seat 2) — already at 0 shields → FIGHTER KICK → elimination.
  await host.evaluate(()=>{ var el=document.querySelector('.oppPanel[data-seat="2"]'); if(el)el.click(); });

  ok(await waitFor(async()=>(await elimSelf(c2))===true, 80, 150),'the kicked client (c2) sees itself ELIMINATED in its mirror');
  ok(await waitFor(async()=>await c2.evaluate(()=>document.body.classList.contains('spectating'))),'c2 enters SPECTATOR mode (body.spectating) — keeps watching the live duel');
  ok(await c2.evaluate(()=>/[Ss]pectating/.test((document.getElementById('turnTag')||{}).textContent||'')),'c2 turn indicator reads "Spectating — …"');
  /* The header button must stop offering Concede once this seat is out — but ONLINE it reads "← Leave", not
     "New Duel". Since v1.31.57 `#newBtn` has three states (Concede while a game is live · ← Leave when online
     with nothing live · New Duel offline), because Leave used to be a floating overlay covering the controls.
     "New Duel" would be wrong here anyway: it opens the SOLO setup dialog in the middle of an online game. */
  const c2btn = await c2.evaluate(()=>((document.getElementById('newBtn')||{}).textContent||'').trim());
  ok(!/Concede/.test(c2btn) && /Leave/.test(c2btn),
     `c2 header offers "← Leave" (not Concede) — it is already out, and it is online [read "${c2btn}"]`);
  ok((await finishedOf(host))!==true && (await finishedOf(c1))!==true,'the game is NOT over — two Riders remain');
  ok((await finishedOf(c2))!==true,'c2 keeps receiving mirrors as a spectator (game not marked finished for it either)');
  ok(await waitFor(async()=>{ var t=await turnOf(host); return t===0||t===1; }, 60, 150),'control returned to a LIVING seat (host or c1), skipping the eliminated one');
  ok(await waitFor(async()=>await roundOf(host)>=3, 80, 150),'the survivors advanced to the next round');
  /* Pin it to the round the KICK resolved into (round 2 → "Round 3"). An "any banner ever" flag is vacuous:
     it stays armed, so the NEXT round's ceremony sets it and the assertion passes on the broken build too —
     measured, it did. */
  /* Let the whole ceremony finish before reading it: snapshotting as soon as the first banner appears captures
     one entry and compares nothing (measured — both builds returned a single, different, entry). */
  await wait(2500);
  const seen = await c1.evaluate(()=>window.__banners.slice());
  ok(seen.some(t=>/won the round with/i.test(t)) && seen.some(t=>/seizes the initiative/i.test(t)),
     `the SURVIVING client played the FULL round ceremony after a mid-game kick — a kick that does not end the game is not a terminal round (saw ${JSON.stringify(seen)})`);
  // Sanity: the two survivors keep their shields; nobody else was kicked.
  ok((await shieldsOf(host))===4 && (await shieldsOf(c1))===4,'both survivors kept their 4 shields');

  // ===== Phase 2: host kicks the LAST opponent → the game ends (last Rider standing) =====
  // Only ONE living opponent remains (c1), so the winner's strike auto-targets it — no pick prompt.
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, null, a.sh, a.opts), {
    hands:[[D(3,'D'),D(4,'D'),D(5,'D'),D(6,'D'),D(7,'D')], [D(2,'S',"x"),D(3,'H',"x"),D(8,'S',"x")], []],
    sh:[4,0,0], opts:{ turn:0 }
  });
  await wait(500);
  await leadCombo(host,['3D','4D','5D','6D','7D']);
  await waitFor(async()=>(await turnOf(c1))===0, 60); await passT(c1);
  ok(await waitFor(async()=>(await elimSelf(c1))===true, 90, 150),'the final kick eliminates the last opponent (c1)');
  ok(await waitFor(async()=>(await finishedOf(host))===true, 60, 150),'the game is now finished on the host — one Rider left');
  ok(await waitFor(async()=>(await finishedOf(c1))===true, 40, 150) && await waitFor(async()=>(await finishedOf(c2))===true, 40, 150),'both clients (the just-kicked c1 and the earlier-out c2) receive the finished mirror');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
