/* THE NETPLAY VERSION HANDSHAKE (v1.31.21).
 * Netplay had no protocol negotiation: two different builds connected happily and then simply misbehaved, with
 * nothing on screen to say why. That is not hypothetical — a stale downloaded copy already produced one false
 * bug report ("the client has no name field", from a build two versions old), and the planned homebrew rules
 * menu makes it worse, because a peer silently ignoring an unknown rule means two people playing different
 * games without knowing.
 *
 * It WARNS, it does not refuse: a patch-level difference is usually harmless and locking two friends out of a
 * game would be the worse failure. So this asserts both halves — that a mismatch is reported on BOTH seats, and
 * that matched builds say nothing at all (a warning that cried wolf would be worse than none).
 * Run: node nettest_version.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8341;
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const banner=p=>p.evaluate(()=>{
  const el=document.querySelector('#netroot .netmsg.err');
  return el && /Build mismatch/i.test(el.textContent||'') ? el.textContent.replace(/\s+/g,' ').trim() : '';
});
const logHas=(p,re)=>p.evaluate(r=>[].some.call(document.querySelectorAll('#log .le'),e=>new RegExp(r,'i').test(e.textContent||'')), re.source||re);
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const shipped=(fs.readFileSync(path.resolve(DIR,'CardmenFighter.html'),'utf8').match(/GAME_VERSION='([^']+)'/)||[])[1];
  ok(!!shipped, `the built page reports a version (${shipped})`);

  /* ---------- MATCHED builds: the handshake must be silent. */
  { const room='VM'+Date.now().toString().slice(-4);
    const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    const u=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${room}&dbg=1`;
    await host.goto(u('host')); await join.goto(u('join'));
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await startDuel(host, join);
    ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'matched builds connect and deal');
    ok(await banner(host)==='' , 'the HOST shows no mismatch banner when the builds match');
    ok(await banner(join)==='' , 'and neither does the client');
    ok(!(await logHas(host,/Build mismatch/)), 'nothing in the host log either — the warning does not cry wolf');
    ok(errs.length===0, 'no JS errors on the matched path'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
    await ctx.close(); }

  /* ---------- MISMATCHED builds: the client reports a fake version via ?ver= (dbg-gated, inert in the game). */
  { const room='VX'+Date.now().toString().slice(-4);
    const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    await host.goto(`http://localhost:${PORT}/CardmenFighter.html?net=host&room=${room}&dbg=1`);
    await join.goto(`http://localhost:${PORT}/CardmenFighter.html?net=join&room=${room}&dbg=1&ver=v0.0.1-ancient`);
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });   // Ready → sends join

    const hostSaw=await until(async()=>!!(await banner(host)));
    ok(hostSaw, 'the HOST is warned that the joiner is on a different build');
    const hb=await banner(host);
    ok(/v0\.0\.1-ancient/.test(hb), `and the banner names THEIR version ("${hb.slice(0,72)}")`);
    ok(hb.indexOf(shipped)>=0, 'and its own, so the report is actionable without guessing');

    const clientSaw=await until(async()=>!!(await banner(join)));
    ok(clientSaw, 'the CLIENT is warned too — it learns the host\'s version from the welcome');
    const cb=await banner(join);
    ok(/v0\.0\.1-ancient/.test(cb) && cb.indexOf(shipped)>=0, `and its banner names both builds ("${cb.slice(0,72)}")`);

    ok(await logHas(host,/Build mismatch/), 'the host also logs it, so it survives leaving the lobby');
    /* It must WARN, not refuse — locking two friends out over a patch difference is the worse failure. */
    ok(await join.evaluate(()=>!!document.getElementById('lobbyGo') || !!document.getElementById('netroot')),
       'and the mismatch does NOT block the connection — it warns, it does not refuse');
    ok(errs.length===0, 'no JS errors on the mismatch path'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
    await ctx.close(); }

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
