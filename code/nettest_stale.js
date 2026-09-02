/* THE STALE-INTENT GUARD, both halves — see the BACKLOG entry "stateSeq IS A CLIENT-INTENT COUNTER".
 *
 * The old guard refused ANY intent whose counter did not match, and the counter advanced on any client intent
 * at all — so a second action sent before the first mirror came back was swallowed silently. Aj's real game
 * shows two passes refused (`q=11`, `q=14`): a player pressing Pass and nothing happening.
 *
 * What replaced it splits the job in two: `mirrorSeq` orders mirrors, `boardStamp` (round + the pile being
 * answered) decides whether an intent still means what the player meant. Only a PLAY can be stale, because
 * only a play changes meaning when the pile changes — cards picked to answer a pair of 5s become a LEAD if
 * that round resolved first. Everything else is engine-validated and always was.
 *
 * Both halves are asserted, and the second is the one that keeps this honest: a guard that refuses nothing
 * would pass the first assertion on its own.
 * Run: node nettest_stale.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8421),ROOM='ST'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const snap=p=>p.evaluate(()=>({
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  msg:((document.getElementById('message')||{}).textContent||'').trim(),
  hand:document.querySelectorAll('#hand .card').length,
}));

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
  ok(await until(async()=>(await snap(host)).round>0), 'duel started');

  // the host leads a LOW card, so the client has both options in front of it: a legal beat and a legal pass
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(7,'H','c'),C(8,'C','c'),C(9,'S','c'),C(10,'D','c')]);
  });
  await wait(400);
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h3D"]'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(join)).yourTurn), 'the turn reached the client, with a beatable 3 on the pile');

  /* ── HALF TWO FIRST, because it needs the pile intact. A PLAY aimed at a pile that has moved on must be
   * refused AND the player told — without this, half one below could be satisfied by a guard that refuses
   * nothing at all. */
  const stamp = await host.evaluate(()=>window.__cmf.boardStamp());
  await join.evaluate(()=>window.__cmf.forceBS('9:99/pair2/9.9'));      // a board that never existed
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  const told = await until(async()=>/board moved on|could not be made/i.test((await snap(join)).msg), 60);
  ok(told, 'a PLAY aimed at a pile that moved on is refused AND the client is told why'+
           (told?'':'  ← a silent refusal reads as a dropped click'));
  ok(stamp===(await host.evaluate(()=>window.__cmf.boardStamp())), '  → and the refused play did not reach the board');

  /* ── HALF ONE: A STALE PASS MUST STILL GO THROUGH. Aj's bug, forced deterministically — the client is told it
   * is looking at a board that never existed, then passes. A pass is engine-validated (turn, game-over, lock),
   * so being a mirror behind cannot make it wrong. */
  ok(await until(async()=>(await snap(join)).yourTurn, 60), 'the client still holds the turn after the refusal');
  const before = await host.evaluate(()=>window.__cmf.turn());
  await join.evaluate(()=>window.__cmf.forceBS('1:lead-STALE'));
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  const passLanded = await until(async()=>(await host.evaluate(()=>window.__cmf.turn()))!==before, 60);
  ok(passLanded, 'a PASS sent against a stale board is APPLIED — the engine judges it, not a counter'+
                 (passLanded?'':'  ← REPRODUCED: the player pressed Pass and nothing happened'));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
