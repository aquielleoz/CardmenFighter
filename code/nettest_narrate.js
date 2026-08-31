/* PUBLIC NARRATION MUST REACH THE OTHER SEAT — the v1.31.58 audit, in the shape that catches the next one.
 *
 * Aj's two saved logs (2026-08-29) diverged on every Ride, transform, INCARNATION and counter: the host logged
 * them, the client never saw them. Cause was `logMsg` where `say` was needed — `logMsg` is host-local, which is
 * how clients had an empty battle log until v1.28.2. Nineteen sites were converted.
 *
 * Two assertions, and the second is the durable one:
 *   1. a HOST action the client did not cause must appear in the CLIENT's log;
 *   2. the client's log must contain no sender-baked grammar. A template written from the sender's point of
 *      view ("{foe} is out") renders as "You is out" for the seat that IS the foe — v1.31.55 fixed that for
 *      {who} and missed the copula on {foe}, and Aj hit it in a real game.
 * Run: node nettest_narrate.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8361,ROOM='NR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const snap=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  pile:document.querySelectorAll('#pile .card').length,
  hand:document.querySelectorAll('#hand .card').length,
  log:((document.getElementById('log')||{}).textContent||''),
  lines:[...document.querySelectorAll('#log .le')].map(e=>(e.textContent||'').trim()),
}));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* Sender-baked grammar, as it renders for the seat the sender called "them". Each of these has been shipped at
 * least once: "You moves", "You's hand", "You is out". They are cheap to scan for and they never have a
 * legitimate reading, so this list is a standing guard rather than a snapshot of today's bugs. */
const BAD = [/\bYou is\b/, /\bYou has\b/, /\bYou moves\b/, /\bYou plays\b/, /\bYou passes\b/, /\bYou wins\b/,
             /\bYou lose[s]\b/, /\bYou’s\b/, /\bYou's\b/, /\bYou were locked out\b.*\bthey\b/, /\bYou are locked\b/];
const badLines = lines => lines.filter(l => BAD.some(rx => rx.test(l)));

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

  /* A HOST TRANSFORM is the event this suite exists for: Aj's two logs (2026-08-29) diverged on exactly this
   * at rounds 5, 8 and 12 — the host logged "You transformed — Pandora Form activated" and the client's log had
   * nothing at all. It went through `logMsg`, which is host-local.
   * Shields are forced LOW on both seats because the transform tiers are gated on total table shields lost
   * (`TRANSFORM_GATE='table'`); at 1 shield each, every tier is unlocked and a Ride is legal immediately. */
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(11,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(2,'D','c'),C(7,'H','c'),C(8,'C','c'),C(9,'S','c')],
                       [C(3,'C','he'),C(4,'C','he'),C(5,'C','he')], [C(3,'H','ce')], 1, 1);
  });
  await wait(500);
  ok(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="h11D"]')), 'hands staged (the host holds a Jack to Ride)');

  const joinBefore=(await snap(join)).lines.length;
  const acted = await host.evaluate(()=>{
    const c=document.querySelector('#hand .card[data-id="h11D"]'); if(!c) return 'no card';
    c.click();
    const ca=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn');
    if(ca && ca.offsetParent!==null && !ca.disabled && !/off/.test(ca.className)){ ca.click(); return 'cardActivate'; }
    if(ctx && !ctx.disabled && !/off/.test(ctx.className) && /Activate/i.test(ctx.textContent||'')){ ctx.click(); return 'ctxBtn'; }
    document.querySelectorAll('#hand .card.sel').forEach(e=>e.click());   // leave no selection behind
    return 'refused: ctx="'+((ctx&&ctx.textContent)||'')+'" disabled='+(ctx&&ctx.disabled);
  });
  ok(/Activate|ctxBtn/.test(acted), 'the host could activate the Ride ('+acted+')');
  ok(await until(async()=>/Ride|transform/i.test((await snap(host)).log), 40), '  → and the HOST logged it');

  /* THE ASSERTION. */
  const sawRide = await until(async()=>/Ride|transform/i.test((await snap(join)).log), 60);
  ok(sawRide, 'the CLIENT sees the HOST call a Ride' + (sawRide?'':'  <-- REPRODUCED: a public event narrated only on the host'));
  const jlNow=(await snap(join)).lines.length;
  ok(jlNow>joinBefore, '  → and its log actually grew ('+joinBefore+' → '+jlNow+' lines)');

  const jl=(await snap(join)).lines, hl=(await snap(host)).lines;
  const jb=badLines(jl), hb=badLines(hl);
  ok(jb.length===0, 'the CLIENT log has no sender-baked grammar'+(jb.length?': '+JSON.stringify(jb[0]):''));
  ok(hb.length===0, 'the HOST log has no sender-baked grammar'+(hb.length?': '+JSON.stringify(hb[0]):''));

  /* Both ends narrate the same public events, so neither log should be a fraction of the other. A ratio, not
   * an exact match: the host legitimately logs a few things a client cannot know (peer drops, its own hand). */
  const ratio = jl.length / Math.max(1, hl.length);
  ok(ratio>=0.5 && ratio<=1.6, '  → and the two logs are comparable in length (client '+jl.length+' vs host '+hl.length+')');

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
