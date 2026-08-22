/* N-PLAYER CONCEDE (3p): client 1 concedes mid-game; verify it's ELIMINATED (not "everyone else loses"), the game
 * keeps going for the host + client 2, and both their boards show c1 as out. Over BroadcastChannel. */
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8303,ROOM='CN'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const finishedOf=p=>p.evaluate(()=>!!(window.__cmfNetState&&window.__cmfNetState.finished) || /win|knocked|conced|defeat/i.test((document.getElementById('turnTag')||{}).textContent||''));
const deadPanel=(p,seat)=>p.evaluate(s=>{ var el=document.querySelector('.oppPanel[data-seat="'+s+'"]'); return !!(el && (/dead/.test(el.className) || /OUT/.test(el.textContent||''))); }, seat);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
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
  ok(await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6),'3-Rider game started');

  // c1 concedes via the button → confirm.
  await c1.evaluate(()=>{ var n=document.getElementById('newBtn'); if(n)n.click(); });
  await waitFor(async()=>await c1.evaluate(()=>!!document.getElementById('confirmCon')));
  await c1.evaluate(()=>{ var y=document.getElementById('confirmCon'); if(y)y.click(); });
  await wait(1000);

  ok(await waitFor(async()=>await deadPanel(host,1)),'host board shows c1 (seat 1) as OUT');
  ok(!(await finishedOf(host)),'the game did NOT end for the host — it continues');
  ok(await waitFor(async()=>await deadPanel(c2,2)),'c2 board shows c1 as OUT (rotated seat 2)');
  ok(!(await finishedOf(c2)),'the game did NOT end for c2');
  ok(await finishedOf(c1),'c1 sees its own game as over (conceded)');
  // the survivors should be able to keep playing (someone has the turn)
  ok(await waitFor(async()=>(await turnOf(host))===0 || (await turnOf(c2))===0),'a surviving player has the turn — play continues');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
