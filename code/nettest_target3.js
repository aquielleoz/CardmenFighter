/* N-PLAYER TARGETING (3 players): a client (seat 1) casts a "target 1 rival" card (Critical Hit, 9S = destroyShield)
 * and picks a SPECIFIC opponent panel. Verifies the seat-rotation is un-rotated correctly on the host so the chosen
 * opponent is the one hit (and nobody else). Over BroadcastChannel. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8298,ROOM='TG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const shieldsOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.shields():null);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const leadFirst=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); });
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } return false; }
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

  // Host leads (round 1 jab) → turn passes to c1.
  await leadFirst(host);
  ok(await waitFor(async()=>(await turnOf(c1))===0),'turn reached client 1');

  // Stage: c1 holds Critical Hit (9S) + a Broadway card (10H) to pay its v1.22.1 pitch cost (engine auto-picks the
  // cheapest Broadway in hand) + ample ♠ energy; host & c2 plain (no counters). Everyone at 4 shields.
  const spade=()=>{ var a=[]; for(var i=0;i<10;i++) a.push(D((i%9)+1,'S','e')); return a; };
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, a.en, a.sh), {
    hands:[[D(2,'C',"h0"),D(3,'C',"h0"),D(6,'H',"h0")], [D(9,'S'),D(7,'C',"h1"),D(8,'H',"h1"),D(10,'H',"h1")], [D(2,'D',"h2"),D(3,'H',"h2"),D(4,'C',"h2")]],
    en:[[],spade(),[]], sh:[4,4,4]
  });
  await wait(500);
  const sh0=[await shieldsOf(host), await shieldsOf(c1), await shieldsOf(c2)];   // [host, c1, c2] each is that page's own shields

  // c1 targets c2 (absolute seat 2 → on c1's rotated board that's panel data-seat="1").
  await c1.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="9S"]'); if(c)c.click(); var ca=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn'); if(ca&&ca.offsetParent!==null&&!ca.disabled)ca.click(); else if(ctx&&!ctx.disabled&&/Activate/i.test(ctx.textContent||''))ctx.click(); });
  ok(await waitFor(async()=>await c1.evaluate(()=>!!document.querySelector('.oppPanel[data-seat="1"].targetable, .oppPanel[data-seat="1"]'))),'c1 entered target-pick mode');
  await c1.evaluate(()=>{ var el=document.querySelector('.oppPanel[data-seat="1"]'); if(el)el.click(); });   // pick the rotated panel = absolute seat 2
  // v1.29.5: tapping a target only STAGES it — confirm with ⚡ Activate. Nothing is spent until this click.
  await wait(250);
  await c1.evaluate(()=>{ var b=document.getElementById('ctxBtn'); if(b && /Activate/i.test(b.textContent||'')) b.click(); });

  // Response windows auto-decline (no counters); c2's shield should drop, host & c1 unchanged.
  const c2Dropped = await waitFor(async()=>await shieldsOf(c2) === sh0[2]-1, 80, 150);
  ok(c2Dropped,'the CHOSEN opponent (c2) lost a shield ('+sh0[2]+' → '+(await shieldsOf(c2))+')');
  ok(await shieldsOf(host) === sh0[0],'the host was NOT hit ('+(await shieldsOf(host))+')');
  ok(await shieldsOf(c1) === sh0[1],'the caster c1 was NOT hit ('+(await shieldsOf(c1))+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
