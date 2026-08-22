/* DECKOUT ELIMINATION OVER NETPLAY (3 players). A player wins a jab (seizing initiative to lead next), but their
 * deck + shuffle pile are empty and their hand emptied on that play — so at the new round's deal they can't draw and
 * must lead with nothing = DECK-OUT. In N-player that's an elimination, not a game-over: verify the decked-out client
 * sees itself eliminated (spectator), the game continues with the survivors, and control skips the empty seat. BC. */
const { chromium } = require('playwright'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8319,ROOM='DO'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const elim=(p,s)=>p.evaluate((s)=>window.__cmf?window.__cmf.eliminated(s):null, s);
const finishedOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.finished():null);
const spectating=p=>p.evaluate(()=>document.body.classList.contains('spectating'));
const roundOf=p=>p.evaluate(()=>parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const lead=(p,id)=>p.evaluate(function(id){ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); }, id);
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
  ok(await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6),'3-Rider game started');

  // Stage: c2 (seat 2) leads with its LAST card and an EMPTY deck+shuffle, so winning the jab decks it out next deal.
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, null, null, a.opts), {
    hands:[[D(4,'D'),D(5,'D')], [D(6,'C'),D(7,'C')], [D(3,'S')]],
    opts:{ turn:2, deck:[null,null,[]], shuffle:[null,null,[]] }
  });
  await wait(500);
  ok(await waitFor(async()=>(await turnOf(c2))===0),'c2 leads the fight (empty deck + one card)');

  // c2 leads its only card; host & c1 pass → c2 wins the jab → new round deal → c2 can't draw → DECK-OUT.
  await lead(c2, '3S');
  await waitFor(async()=>(await turnOf(host))===0); await passT(host);
  await waitFor(async()=>(await turnOf(c1))===0); await passT(c1);

  ok(await waitFor(async()=>(await elim(host,2))===true, 80, 150),'c2 decked out and was ELIMINATED (host authority)');
  ok((await finishedOf(host))!==true,'game continues — two Riders remain after the deckout');
  ok(await waitFor(async()=>(await spectating(c2))===true, 60, 150),'the decked-out client (c2) drops into spectator mode');
  ok(await waitFor(async()=>{ var t=await turnOf(host); return t===0||t===1; }, 60, 150),'control rests on a living seat (host or c1) — the empty seat is skipped');
  ok((await elim(host,0))!==true && (await elim(host,1))!==true,'the two survivors are still in');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
