/* N-PLAYER ELIMINATION OVER NETPLAY (3 players). In 'chosen' mode the round winner picks the target; here the
 * chosen target is already at 0 shields, so the strike is the FIGHTER KICK — that player is eliminated and the
 * remaining two continue. Verifies: the eliminated client sees itself OUT (mirror.eliminated), the game is NOT
 * finished (2 alive), the host keeps driving, and the survivors advance to the next round. Over BroadcastChannel. */
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
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
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
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

  // Host picks client 2 (absolute seat 2) — already at 0 shields → FIGHTER KICK → elimination.
  await host.evaluate(()=>{ var el=document.querySelector('.oppPanel[data-seat="2"]'); if(el)el.click(); });

  ok(await waitFor(async()=>(await elimSelf(c2))===true, 80, 150),'the kicked client (c2) sees itself ELIMINATED in its mirror');
  ok(await waitFor(async()=>await c2.evaluate(()=>document.body.classList.contains('spectating'))),'c2 enters SPECTATOR mode (body.spectating) — keeps watching the live duel');
  ok(await c2.evaluate(()=>/[Ss]pectating/.test((document.getElementById('turnTag')||{}).textContent||'')),'c2 turn indicator reads "Spectating — …"');
  ok((await c2.evaluate(()=>(document.getElementById('newBtn')||{}).textContent||'')).indexOf('New Duel')>=0,'c2 header offers "New Duel" (not Concede) — it is already out');
  ok((await finishedOf(host))!==true && (await finishedOf(c1))!==true,'the game is NOT over — two Riders remain');
  ok((await finishedOf(c2))!==true,'c2 keeps receiving mirrors as a spectator (game not marked finished for it either)');
  ok(await waitFor(async()=>{ var t=await turnOf(host); return t===0||t===1; }, 60, 150),'control returned to a LIVING seat (host or c1), skipping the eliminated one');
  ok(await waitFor(async()=>await roundOf(host)>=3, 80, 150),'the survivors advanced to the next round');
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
