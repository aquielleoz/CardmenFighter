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
  /* ⚠ PARSE THE FOURTH SEGMENT HERE TOO. This regex stopped at three and so could not tell an epic build
     from the main build it forks from — the very distinction the legs below exist to assert, and the same
     shape of bug as the invite code's IPv6 truncation: a pattern that succeeds on a prefix and drops the
     part that carries the meaning. */
  const vm=shipped.match(/^v?(\d+)\.(\d+)\.(\d+)(?:\.(\d+))?/)||[];
  const vp=vm.slice(1,4).map(Number);
  const epicN=vm[4]==null?null:Number(vm[4]);
  const isEpic=epicN!=null;
  const mainBase    ='v'+vp[0]+'.'+vp[1]+'.'+vp[2];
  const kind        = isEpic ? '.'+epicN : '';   // keep a derived peer on OUR side of the epic line...
  /* ...so each leg isolates exactly ONE clause of `verIncompatible`. Without the suffix, a derived peer of
     an epic build is 3-part and therefore cross-kind, so the patch leg would be refused (red) and the minor
     leg would be refused for two reasons at once (green, and proving half of what it claims). */
  const patchSibling='v'+vp[0]+'.'+vp[1]+'.'+(vp[2]+1)+kind;
  const minorOther  ='v'+vp[0]+'.'+(vp[1]>0?vp[1]-1:vp[1]+1)+'.0'+kind;
  /* THE FOURTH SEGMENT IS THE EPIC MARKER. `vX.Y.Z.a` = "based on main's X.Y.Z, epic build a"; a main
     build has three numbers. `crossKind` is therefore a build of the OTHER kind at the SAME X.Y.Z —
     derived in both directions so this file needs no edit when the epic merges and the shipped build
     goes back to three. `epicA`/`epicB` are two builds of the same epic, several merges apart. */
  const crossKind   = isEpic ? mainBase : mainBase+'.1';
  const epicA       = mainBase+'.7', epicB = mainBase+'.8';
  ok(vp.length===3 && vp.every(n=>!isNaN(n)), `and it parses as ${isEpic?'an EPIC build ('+mainBase+', build '+epicN+')':'a MAIN build ('+mainBase+')'} — patch sibling ${patchSibling}, minor other ${minorOther}, cross-kind ${crossKind}`);

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
    /* It must WARN, not refuse — locking two friends out over a patch difference is the worse failure.
       THIS USED TO ASK WHETHER #lobbyGo OR #netroot WAS STILL THERE, which is very nearly vacuous: #netroot
       exists for the whole of netplay, so the assertion stayed green on a build that had refused. Drive
       Start and require a real deal — the exact mirror of the refusal legs' `dealt===0`. */
    await wait(600);
    await host.evaluate(()=>{ const s=document.getElementById('startBtn')||document.getElementById('lobbyGo'); if(s && !s.disabled) s.click(); });
    ok(await until(async()=>(await join.evaluate(()=>document.querySelectorAll('#hand .card').length))>0),
       'and the mismatch does NOT block the connection — it warns, it does not refuse, and the game really deals');
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

  /* ---------- AN EPIC BUILD REFUSES AGAINST THE MAIN BUILD IT FORKS FROM (2026-09-30). Aj: "refuse against
     main, increment per merge." An epic HOLDS its minor for the whole branch — that is the point of the
     four-number scheme, and `versiontest` asserts the handoff's "`main` is at vX.Y.Z" line against README to
     keep it honest — so an epic build and the main build it forks from share a major AND a minor while
     genuinely disagreeing about the rules. The minor check above is therefore structurally blind to the one
     pair of builds MOST likely to meet: a tester on the branch and a friend on the download.
     THE HOST IS THE REAL ARTIFACT — no ?ver= — because the claim is about the build people actually get, and
     `crossKind` is derived in both directions, so this leg survives the epic→main merge without an edit. */
  { const room='VE'+Date.now().toString().slice(-4);
    const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    await host.goto(`http://localhost:${PORT}/CardmenFighter.html?net=host&room=${room}&dbg=1`);
    await join.goto(`http://localhost:${PORT}/CardmenFighter.html?net=join&room=${room}&dbg=1&ver=${crossKind}`);
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });

    ok(await until(async()=>!!(await banner(host))),
       `the HOST reports something across the epic line (${shipped} vs ${crossKind}) — same minor, different rules`);
    /* DELIBERATELY LOOSE, and it says so: `banner()` matches either wording, so this one only establishes
       that the handshake NOTICED. Whether it refused or merely warned is the next assertion's job — with
       the epic clause deleted this stays green and that one reds, which is the split that names the bug. */
    const hb=await banner(host);
    ok(/Different versions/i.test(hb), `and it is the REFUSAL wording, not the patch warning ("${hb.slice(0,80)}")`);
    ok(hb.indexOf(crossKind)>=0 && hb.indexOf(shipped)>=0, 'and it names BOTH builds');
    ok(/download the same build/i.test(hb), 'and tells them what to do about it');

    ok(await until(async()=>!!(await banner(join))), 'the CLIENT is told too, from the welcome');
    const cb=await banner(join);
    ok(/Different versions/i.test(cb) && cb.indexOf(shipped)>=0, `and its banner names both builds ("${cb.slice(0,80)}")`);

    /* REAL, NOT COSMETIC — same reason as the minor leg: a banner over a table that still deals is worse
       than no banner at all. */
    await wait(600);
    await host.evaluate(()=>{ const s=document.getElementById('startBtn')||document.getElementById('lobbyGo'); if(s && !s.disabled) s.click(); });
    await wait(1200);
    const dealt=await join.evaluate(()=>document.querySelectorAll('#hand .card').length);
    const hostDealt=await host.evaluate(()=>document.querySelectorAll('#hand .card').length);
    ok(dealt===0 && hostDealt===0, `and nothing deals on either side (client ${dealt}, host ${hostDealt} — both must be 0)`);
    ok(errs.length===0, 'no JS errors on the epic-vs-main path'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
    await ctx.close(); }

  /* ---------- TWO EPIC BUILDS ONLY WARN, and that is a decision, not an oversight: two testers may be
     several merges apart and locking them out of the branch they are testing is the worse failure, while the
     warning already names both versions. This is also the assertion that stops the refusal above from being
     "simplified" into `a[3]!==b[3]`, which would pass every assertion in the leg above and break the branch
     for everyone on it.
     BOTH SIDES ARE STAGED HERE, because `?ver=` is read by whichever page carries it — which is the only
     reason this leg can exist on a main build, where no 4-part artifact is shipped to host it. */
  { const room='VS'+Date.now().toString().slice(-4);
    const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    await host.goto(`http://localhost:${PORT}/CardmenFighter.html?net=host&room=${room}&dbg=1&ver=${epicA}`);
    await join.goto(`http://localhost:${PORT}/CardmenFighter.html?net=join&room=${room}&dbg=1&ver=${epicB}`);
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });

    ok(await until(async()=>!!(await banner(host))), `two epic builds still report the difference (${epicA} vs ${epicB})`);
    const hb=await banner(host);
    ok(/Build mismatch/i.test(hb) && !/Different versions/i.test(hb),
       `and it is the WARNING, not the refusal ("${hb.slice(0,80)}")`);
    ok(hb.indexOf(epicA)>=0 && hb.indexOf(epicB)>=0, 'and it names both epic builds');
    /* AND THE PERMISSION MUST BE REAL, which is the exact mirror of the refusal legs' `dealt===0`. The
       obvious check — "is #lobbyGo or #netroot still there" — is very nearly VACUOUS, because #netroot
       exists for the whole of netplay: it stays green when the handshake has refused. Drive Start and
       require that a game actually DEALS. */
    await wait(600);
    await host.evaluate(()=>{ const s=document.getElementById('startBtn')||document.getElementById('lobbyGo'); if(s && !s.disabled) s.click(); });
    const dealt=await until(async()=>(await join.evaluate(()=>document.querySelectorAll('#hand .card').length))>0);
    ok(dealt, 'and it does NOT refuse — a tester is not locked out of the branch they are testing, and the game really deals');
    ok(errs.length===0, 'no JS errors on the epic-sibling path'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
    await ctx.close(); }

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
