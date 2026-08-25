/* Netplay PUBLIC BATTLE LOG. Before this, every message type was state (mirror/setup) or control
 * (join/welcome/err/peer/ceremony) — the host narrated everything locally and a client's log was
 * EMPTY all game, even for its own moves. Narration now goes through say(actor, '{who} …'), which
 * broadcasts the TEMPLATE plus the actor's absolute seat so each side renders it in its own frame:
 * the actor reads "You played", everyone else reads "Rival played" (or "P3" in a free-for-all).
 * Run: node nettest_log.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8313,ROOM='LG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const log=p=>p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()));
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
async function waitHand(p){ for(let i=0;i<60;i++){ if((await p.evaluate(()=>document.querySelectorAll('#hand .card').length))>0) return true; await wait(150); } return false; }
/* Budgets are deliberately generous. This suite is one of the two documented as "position-dependent" — it
 * passes alone and fails ~4 assertions late in a long serial sweep. The cascade starts at ONE place: the wait
 * for the turn to reach the client was 60x150ms = 9s, and a slow mirror round-trip blows through it. Then the
 * turn assertion fails, the client finds no legal jab, and both log assertions fail with it — four failures
 * from one impatient loop. A slow machine should make this suite slower, never red. */
async function waitLog(p,re){ for(let i=0;i<150;i++){ if((await log(p)).some(l=>re.test(l))) return true; await wait(150); } return false; }
async function waitTurn(p,seat){ for(let i=0;i<200;i++){ if((await turnOf(p))===seat) return true; await wait(150); } return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH); const ctx=await b.newContext({viewport:{width:1150,height:860}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  for(let i=0;i<80;i++){ if(await join.evaluate(()=>!!document.getElementById('lobbyGo'))) break; await wait(150); }   // lobby up
  await startDuel(host, join);
  ok(await waitHand(host) && await waitHand(join),'duel started, both boards dealt');

  // the HOST plays: the host reads "You", the client must read "Rival"
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click(); const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await waitLog(host,/^You played/),'host log: "You played …"');
  ok(await waitLog(join,/^Rival played/),'CLIENT log now shows the host\'s play as "Rival played …" (was empty before)');
  const hp=(await log(host)).find(l=>/^You played/.test(l)), jp=(await log(join)).find(l=>/^Rival played/.test(l));
  // guard: if either line is missing the assertion should FAIL, not throw and abort the remaining checks
  ok(!!hp && !!jp && hp.replace(/^You played/,'')===jp.replace(/^Rival played/,''),
     'both sides describe the same card ('+(hp||'(missing)')+' / '+(jp||'(missing)')+')');

  // the CLIENT plays: mirrored phrasing
  // the client's mirror is ROTATED so its own seat is index 0 — its turn is turn===0, not 1
  ok(await waitTurn(join,0),'it is now the client\'s turn (rotated seat 0)');
  // round 1 is jabs only and the play must BEAT the pile — try each card until Fight enables
  const played=await join.evaluate(()=>{
    const clr=document.getElementById('clearBtn'), f=document.getElementById('fightBtn');
    const cards=[].slice.call(document.querySelectorAll('#hand .card'));
    for(let i=0;i<cards.length;i++){
      if(clr) clr.click();
      document.querySelectorAll('#hand .card')[i].click();
      if(f && !f.disabled){ f.click(); return true; }
    }
    return false;
  });
  ok(played,'the client found a legal jab to answer with');
  ok(await waitLog(join,/^You played/),'CLIENT log shows its OWN play as "You played …"');
  ok(await waitLog(host,/^Rival played/),'host log shows the client\'s play as "Rival played …"');

  // the client's log is genuinely populated, not just one line
  const jl=await log(join);
  ok(jl.length>=3,'the client has a real log, '+jl.length+' lines');
  ok(jl.some(l=>/^Online duel/.test(l)),'…opening with its own duel line, written in its own frame');
  ok(!jl.some(l=>/vs Rival Full Set|initiative/.test(l)),'…and never the host-framed opening line');
  ok(!jl.some(l=>/\{who\}/.test(l)),'no unresolved {who} placeholder leaked into any line');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\nCLIENT LOG:'); jl.forEach(l=>console.log('   '+l.slice(0,88)));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
