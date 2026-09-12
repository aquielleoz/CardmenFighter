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
const DIR=__dirname,PORT=+(process.env.PORT||8341);
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
  return el && /Build mismatch|Different versions/i.test(el.textContent||'') ? el.textContent.replace(/\s+/g,' ').trim() : '';
});
const logHas=(p,re)=>p.evaluate(r=>[].some.call(document.querySelectorAll('#log .le'),e=>new RegExp(r,'i').test(e.textContent||'')), re.source||re);
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const shipped=(fs.readFileSync(path.resolve(DIR,'CardmenFighter.html'),'utf8').match(/GAME_VERSION='([^']+)'/)||[])[1];
  ok(!!shipped, `the built page reports a version (${shipped})`);
  /* THE TWO KINDS OF DIFFERENCE, DERIVED FROM THE SHIPPED VERSION so they cannot go stale on a bump
     (epic step 22). The compatibility line is the MINOR number: a patch sibling still plays and still
     warns; a minor difference is refused outright. A hardcoded "v0.0.1-ancient" used to stand for
     "different" and now means REFUSED, which is exactly the contract change this suite has to pin. */
  const vp=(shipped.match(/^v?(\d+)\.(\d+)\.(\d+)/)||[]).slice(1).map(Number);
  const patchSibling='v'+vp[0]+'.'+vp[1]+'.'+(vp[2]+1);
  const minorOther  ='v'+vp[0]+'.'+(vp[1]>0?vp[1]-1:vp[1]+1)+'.0';
  ok(vp.length===3, `and it parses into major/minor/patch (${vp.join('.')}) — patch sibling ${patchSibling}, minor other ${minorOther}`);

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

  /* ---------- A PATCH DIFFERENCE still plays, and still warns. The client reports a fake version via
     ?ver= (dbg-gated, inert in the game). This is the half that must NOT change: locking two friends out
     over a patch is the worse failure, and that reasoning survives step 22 intact. */
  { const room='VX'+Date.now().toString().slice(-4);
    const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    await host.goto(`http://localhost:${PORT}/CardmenFighter.html?net=host&room=${room}&dbg=1`);
    await join.goto(`http://localhost:${PORT}/CardmenFighter.html?net=join&room=${room}&dbg=1&ver=${patchSibling}`);
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });   // Ready → sends join

    const hostSaw=await until(async()=>!!(await banner(host)));
    ok(hostSaw, 'the HOST is warned that the joiner is on a different build');
    const hb=await banner(host);
    ok(hb.indexOf(patchSibling)>=0, `and the banner names THEIR version ("${hb.slice(0,72)}")`);
    ok(hb.indexOf(shipped)>=0, 'and its own, so the report is actionable without guessing');

    const clientSaw=await until(async()=>!!(await banner(join)));
    ok(clientSaw, 'the CLIENT is warned too — it learns the host\'s version from the welcome');
    const cb=await banner(join);
    ok(cb.indexOf(patchSibling)>=0 && cb.indexOf(shipped)>=0, `and its banner names both builds ("${cb.slice(0,72)}")`);

    ok(await logHas(host,/Build mismatch/), 'the host also logs it, so it survives leaving the lobby');
    /* It must WARN, not refuse — locking two friends out over a patch difference is the worse failure. */
    ok(await join.evaluate(()=>!!document.getElementById('lobbyGo') || !!document.getElementById('netroot')),
       'and the mismatch does NOT block the connection — it warns, it does not refuse');
    ok(errs.length===0, 'no JS errors on the mismatch path'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
    await ctx.close(); }

  /* ---------- A MINOR DIFFERENCE IS REFUSED (epic step 22). Aj: "in different versions, the handshake is
     refused and both players are recommended to update." The granularity is the SECOND number, because that
     is what this project's scheme already means by "the rules moved" — and two people playing different
     rules while both believe they are fine is the exact failure the handshake exists to prevent.
     BOTH DIRECTIONS ARE DRIVEN, and the second is the one that matters: an OLDER host does not know how to
     refuse, so the CLIENT has to stop by itself. Here the client carries the odd version, which means the
     host's refusal path runs; the client-side check is asserted by the banner it raises from `welcome`. */
  { const room='VR'+Date.now().toString().slice(-4);
    const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    await host.goto(`http://localhost:${PORT}/CardmenFighter.html?net=host&room=${room}&dbg=1`);
    await join.goto(`http://localhost:${PORT}/CardmenFighter.html?net=join&room=${room}&dbg=1&ver=${minorOther}`);
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });

    ok(await until(async()=>!!(await banner(host))), 'the HOST refuses a minor-version difference');
    const hb=await banner(host);
    ok(/Different versions/i.test(hb), `and says so in the REFUSAL wording, not the warning ("${hb.slice(0,80)}")`);
    ok(hb.indexOf(minorOther)>=0 && hb.indexOf(shipped)>=0, 'and names BOTH builds, so each player knows what to download');
    ok(/download the same build/i.test(hb), 'and tells them what to do about it');

    ok(await until(async()=>!!(await banner(join))), 'the CLIENT is told too — it does not sit waiting on a host that refused it');
    const cb=await banner(join);
    ok(/Different versions/i.test(cb) && cb.indexOf(shipped)>=0, `and its banner names both builds ("${cb.slice(0,80)}")`);

    /* THE REFUSAL MUST BE REAL, NOT COSMETIC. A banner over a table that still deals is worse than no
       banner at all, so drive the host's Start and require that NOTHING deals on either side. */
    await wait(600);
    await host.evaluate(()=>{ const s=document.getElementById('startBtn')||document.getElementById('lobbyGo'); if(s && !s.disabled) s.click(); });
    await wait(1200);
    const dealt=await join.evaluate(()=>document.querySelectorAll('#hand .card').length);
    ok(dealt===0, `and no game starts for the refused client (${dealt} cards dealt — must be 0)`);
    const hostDealt=await host.evaluate(()=>document.querySelectorAll('#hand .card').length);
    ok(hostDealt===0, `nor for the host, since the seat was never allocated (${hostDealt} cards)`);
    ok(errs.length===0, 'no JS errors on the refusal path'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
    await ctx.close(); }

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
