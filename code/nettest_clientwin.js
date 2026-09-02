/* THE MIRROR IMAGE OF nettest_roundstall — and the configuration Aj actually hit on the first real relay game.
 *
 * `nettest_roundstall` covers: the CLIENT's action ends a round the HOST wins (host leads the apex 2, client
 * must pass). That was v1.31.20's bug and it is fixed.
 *
 * This covers the twin: the CLIENT's action ends a round the CLIENT wins. Aj's screenshots showed the host on
 * "Round 1 · YOU · JAB · Rival is fighting…" while the phone was already on "Round 2 · You won the round of
 * Jabs" — and the duel was unsalvageable. A client cannot advance a round on its own, so the host resolved,
 * broadcast, and then failed to advance its own screen: the `busy` wedge, one branch over from the fixed one.
 *
 * Deterministic: the host leads a 3, the client answers with the apex 2 (fight value 15, unbeatable), so the
 * host CANNOT answer and the round ends on the client's action with the client winning.
 * Run: node nettest_clientwin.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8331),ROOM='CW'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  pile:document.querySelectorAll('#pile .card').length,
  hand:document.querySelectorAll('#hand .card').length,
  rivalStatus:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
  fightOff:!!(document.getElementById('fightBtn')||{}).disabled,
  passOff:!!(document.getElementById('passBtn')||{}).disabled,
}));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
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
  ok(await until(async()=>(await snap(host)).hand>0), 'duel started');

  /* The CLIENT holds the apex 2 this time. The host holds only 3s and 4s, so once the 2 is on the pile it has
   * no legal answer and the round must end on the client's action — with the client winning. */
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(2,'D','c'),C(7,'H','c'),C(8,'C','c'),C(9,'S','c')]);
  });
  await wait(500);
  ok(await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="c2D"]')), 'hands staged (the CLIENT holds the apex 2)');

  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h3D"]'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(host)).pile>0), 'host led a 3');
  ok(await until(async()=>(await snap(join)).yourTurn), 'the turn reached the client');

  // the client beats it with the unbeatable 2 — the host cannot answer, so this ends the round
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="c2D"]'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });

  /* MEASURED: nothing auto-resolves here. The turn comes BACK to the host, which has no legal answer to a 2, so
   * the round only ends when the host PASSES — and for that the host must be able to tell it is its turn.
   * Check that before pressing anything, because it decides whether a real player would ever find the button. */
  ok(await until(async()=>(await snap(host)).yourTurn, 60), 'the turn returns to the host, which cannot beat a 2');
  const mid = await snap(host);
  const lying = /waiting for opponent/i.test(mid.rivalStatus);
  ok(!lying, '  → and the screen says so, rather than still reading "Waiting for opponent…"' +
             (lying ? '  <-- REPRODUCED: it is your turn and the game says the rival is thinking' : ''));
  ok(!mid.passOff, '  → and Pass is offered, which is the only legal move left');

  await host.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });

  const hostAdvanced = await until(async()=>(await snap(host)).round>=2, 140);
  const joinAdvanced = await until(async()=>(await snap(join)).round>=2, 40);
  /* THE ASSERTION AJ'S SCREENSHOTS MAKE. If the client advances and the host does not, that is precisely the
   * pair of screens he sent: phone in round 2, laptop still in round 1 saying "Rival is fighting…". */
  ok(!(joinAdvanced && !hostAdvanced),
     'the host does not get left behind while the client moves on'+
     (joinAdvanced&&!hostAdvanced ? '  ← REPRODUCED: client in round 2, host still in round 1' : ''));

  const h=await snap(host);
  /* And the board must be USABLE, not merely showing the right number. A wedged host renders the new round and
   * still refuses every control — which is what "unsalvageable" looked like. */
  ok(hostAdvanced && (h.yourTurn ? !(h.fightOff && h.passOff) : true),
     'and its board is alive afterwards'+(hostAdvanced?'':' (never advanced)')+
     ' [round '+h.round+', yourTurn '+h.yourTurn+', fight '+(h.fightOff?'off':'on')+
     ', pass '+(h.passOff?'off':'on')+', rivalStatus "'+h.rivalStatus+'"]');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR '+(e&&e.stack||e)); process.exit(1); });
