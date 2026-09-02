/* CHOOSE-WHO-LOSES-A-SHIELD (3 players): in 'chosen' mode the round winner picks whose shield to strip. Host wins
 * round 2 with a straight (a combo) and PICKS client 2 as the target; verify only c2 loses a shield. Exercises the
 * whole path (needsLossTarget → promptLossTarget → chooseLossTarget → ceremony) over BroadcastChannel. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8299),ROOM='LP'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const shieldsOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.shields():null);
const roundOf=p=>p.evaluate(()=>parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0);
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
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
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

  // Round 2: host holds a straight; everyone at 4 shields.
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, null, a.sh), {
    hands:[[D(3,'C'),D(4,'C'),D(5,'C'),D(6,'C'),D(7,'C')], [D(2,'H',"a"),D(3,'S',"a"),D(9,'H',"a")], [D(2,'S',"b"),D(4,'H',"b"),D(9,'C',"b")]],
    sh:[4,4,4]
  });
  await wait(500);
  const sh0=[await shieldsOf(host), await shieldsOf(c1), await shieldsOf(c2)];

  // Host leads the straight; c1 & c2 pass → host wins WITH a combo → loss-target pick.
  await leadCombo(host,['3C','4C','5C','6C','7C']);
  await waitFor(async()=>(await turnOf(c1))===0); await passT(c1);
  await waitFor(async()=>(await turnOf(c2))===0); await passT(c2);

  ok(await waitFor(async()=>await host.evaluate(()=>!!document.querySelector('.oppPanel.targetable'))),'host got the choose-a-target prompt');
  // Host picks client 2 (absolute seat 2).
  await host.evaluate(()=>{ var el=document.querySelector('.oppPanel[data-seat="2"]'); if(el)el.click(); });

  ok(await waitFor(async()=>await shieldsOf(c2)===sh0[2]-1, 80, 150),'the CHOSEN target (c2) lost a shield ('+sh0[2]+' → '+(await shieldsOf(c2))+')');
  ok(await shieldsOf(c1)===sh0[1],'the un-chosen rival (c1) kept its shield ('+(await shieldsOf(c1))+')');
  ok(await shieldsOf(host)===sh0[0],'the winner (host) kept its shields');
  ok(await waitFor(async()=>await roundOf(host)>=3),'game advanced past the pick');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
