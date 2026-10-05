/* A CLIENT IS TOLD ITS DRAW FIZZLED (client-never-told-draw-fizzled, v1.32.7).
 *
 * The line lived in `logRoundDraw` as one host-local `logMsg`, and that function runs on the host and in solo
 * only — so a client whose deck AND shuffle pile were empty was never told, in any game. Aj's wording splits it:
 * the FACT goes to the table ("Draw fizzled for {who} — no cards left in the deck or shuffle pile."), the ADVICE
 * only to the seat it helps ("Spend energy on effects to recycle cards back into your deck.").
 *
 * BOTH DIRECTIONS: the client must get both lines, the host must get the public one, and the host must NOT get
 * the advice — a broadcast advice line passes "the client was told" while telling everyone.
 *
 * Run: node nettest_drawfizzle.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { clickFight, clickPass } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8463),ROOM='DF'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const logOf=p=>p.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>host.evaluate(()=>document.querySelectorAll('#hand .card').length>0)), 'duel started');

  // the CLIENT's deck and shuffle pile are empty; the host leads a 3 the client cannot answer, so the round ends
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.forceAll([[C(13,'D','h'),C(5,'H','h'),C(6,'S','h')], [C(3,'S','c'),C(4,'H','c'),C(4,'C','c')]], null, null,
      {round:1, turn:0, deck:[[C(7,'D','hd'),C(8,'D','hd'),C(9,'D','hd'),C(7,'H','hd')], []], shuffle:[[],[]]}); });
  await wait(600);
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h13D"]'); if(c) c.click(); });
  await clickFight(host);
  ok(await until(()=>join.evaluate(()=>window.__cmf.turn()===0), 80), 'the host led a King and the turn reached the client');
  await clickPass(join);
  const told=await until(async()=>/Draw fizzled for You/.test(await logOf(join)), 120);
  const jl=await logOf(join), hl=await logOf(host);
  ok(told, 'the CLIENT is told its draw fizzled ("Draw fizzled for You — …")'+(told?'':'  ← REPRODUCED: never told'));
  ok(/Spend energy on effects to recycle cards back into your deck/.test(jl), '…and gets the advice');
  ok(/Draw fizzled for Rival 2/.test(hl), 'the HOST reads the public line about the client ("Draw fizzled for Rival 2 — …")');
  ok(!/Spend energy on effects to recycle/.test(hl), '…and NOT the advice, which is the client\'s alone');
  ok(!/Draw fizzled for You/.test(hl), 'the host did not fizzle — no line about itself');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
