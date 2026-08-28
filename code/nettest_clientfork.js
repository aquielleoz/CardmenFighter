/* A CLIENT MUST NEVER RUN THE LOCAL GAME — the fork that produced two divergent duels over one open channel.
 *
 * Found 2026-08-28 from Aj's two saved battle logs, which is the only reason it was findable at all:
 *   host:   "You played a Jab - 4♥."           and nothing after it, ever
 *   client: "Aj played a Jab - 4♥." → "You played a Jab - 9♦." → "Rival passed." → "You won the round of Jabs."
 *           → … → "You played a Jab - NaN." → four more rounds, all resolved locally
 *
 * Mechanism: every action reads `isClientActive()` = `isClient() && started` and, when false, FALLS THROUGH to
 * the single-player engine. Correct for a solo page; catastrophic for a client whose board is live while
 * `started` is still false. Its inputs stop reaching the host and start driving a local game: "Rival passed" is
 * the LOCAL AI, the resolutions are local, and "Jab - NaN" is drawing from a mirror whose opponent cards are
 * redacted placeholders.
 *
 * The trigger for `started === false` is still unexplained. This asserts the CONSEQUENCE is contained: refusing
 * is always correct, because if a client is not started the host is not listening either way.
 * `__cmf.unstart()` forces the state, which is otherwise unreachable through the UI.
 * Run: node nettest_clientfork.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8333,ROOM='CF'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  hand:document.querySelectorAll('#hand .card').length,
  bad:[].slice.call(document.querySelectorAll('#hand .card')).filter(c=>/undefined|NaN/.test(c.textContent)).length,
  logLines:document.querySelectorAll('#log > *').length,
  msg:((document.getElementById('message')||{}).textContent||'').trim(),
}));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: '+String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
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
  ok(await until(async()=>(await snap(join)).hand>0), 'duel started, the client has a board');

  /* IT MUST BE THE CLIENT'S TURN FIRST, or this suite proves nothing. The host leads round 1, so the client's
   * Fight button is disabled — the first version of this test clicked a dead button and then congratulated
   * itself that the round had not advanced. Have the host lead, wait for the turn to arrive, and only then
   * force the bad state. */
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(()=>join.evaluate(()=>/your turn/.test((document.getElementById('turnTag')||{}).textContent||'')), 80),
     'the host led, so it is now the CLIENT\'s turn — its controls are live');
  ok(await join.evaluate(()=>{ const f=document.getElementById('fightBtn'); return !!f && !f.disabled; }) ||
     await join.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
       const f=document.getElementById('fightBtn'); const on=!!f&&!f.disabled;
       [].forEach.call(document.querySelectorAll('#hand .card.sel'),function(x){x.click();}); return on; }),
     '  → and Fight really is clickable, so a refusal below is the guard and not a dead button');

  ok(await join.evaluate(()=>!!(window.__cmf&&window.__cmf.unstart&&window.__cmf.unstart())),
     'forced the unreachable state: a live client board with `started` false');
  const before=await snap(join);

  /* THE ASSERTION. Before the fix this ran the local engine: the round advanced, the local AI passed, and the
   * client drifted into a private game while the host waited on a move that never came. */
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  await wait(2500);
  const after=await snap(join);
  ok(after.round===before.round,
     'clicking Fight does NOT advance the client\'s round on its own ('+before.round+' → '+after.round+')');
  ok(after.bad===0, '  → and no NaN/undefined cards appear, which is what a local draw off a redacted mirror produces');
  ok(/connecting to the host/i.test(after.msg),
     '  → and it says why it refused, rather than silently doing nothing ("'+after.msg.slice(0,50)+'")');

  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  await wait(2000);
  const after2=await snap(join);
  ok(after2.round===before.round && after2.bad===0,
     'and Pass is refused the same way — it was the other path that resolved rounds locally');

  /* The HOST must be untouched by any of it: no phantom move, no round, nothing. */
  const h=await snap(host);
  ok(h.round<=1, 'the host saw nothing at all from the refused inputs (round '+h.round+')');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR '+(e&&e.stack||e)); process.exit(1); });
