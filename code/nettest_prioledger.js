/* THE HOST'S PHASE WALK REACHES THE CLIENT'S LEDGER — AND IS NAMED IN THE CLIENT'S FRAME.
 *
 * Aj's host log carried ten `MAIN → FIGHT … auto-advanced — nobody could add to the stack (origin=You)`
 * lines and his client log carried ZERO, while both carried their eight `FIGHT END` lines. So the ledger
 * was not dead on a client: the phase walk is host-side authority, recorded where it happens, and nothing
 * told the other seats. A reader diffing two saved logs — the method that has found several defects here —
 * met a 10-vs-0 gap that was expected and looked alarming. Aj chose to broadcast the lines.
 *
 * ⚠ THE NAMES ARE THE WHOLE RISK, AND THIS SUITE EXISTS FOR THEM. `logName` renders the reader as "You",
 * so a host-written `origin=You` shipped verbatim would tell the CLIENT it opened a go-round the HOST
 * opened — the sender-baked-perspective bug this repo has already shipped three times (`{who}`, `{foe}`,
 * the `You is` copula). A broadcast ledger line therefore carries `{sN}` ABSOLUTE-seat tokens and each end
 * renders them. Asserting only that the client HAS the line would pass on the verbatim build, which is the
 * bug; so the client's copy must name the host as a rival AND must not say "You".
 *
 * Run: node nettest_prioledger.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { enterFight } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8397),ROOM='PL'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let f=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(f,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const walk=p=>p.evaluate(()=>{ try{ return (window.__cmf.prioLog()||[]).filter(function(l){ return /MAIN → FIGHT/.test(l); }); }catch(e){ return ['NO LEDGER: '+e.message]; } });

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+')'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  /* Drive the host through ONE Main → Fight transition. `enterFight` is the shared helper for the
     two-state button, so this makes no assumption about which press opens it. */
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 60), "it is the host's turn");
  await enterFight(host).catch(()=>{});
  const hostWalk = await until(async()=>(await walk(host)).length>0, 60);
  ok(hostWalk, 'the HOST records the phase walk, as it always did  ['+((await walk(host))[0]||'')+']');

  const got = await until(async()=>(await walk(join)).length>0, 60);
  const cLine = ((await walk(join))[0]||'');
  ok(got, `the CLIENT's ledger carries it too — the 10-vs-0 gap is closed  ["${cLine.slice(30)}"]`);

  /* ⚠ THE NAMING, WHICH IS WHY A "the line arrived" ASSERTION IS NOT ENOUGH. The host is the ORIGIN, so in
     the CLIENT's frame it must read as a rival, never as "You". A verbatim broadcast passes the assertion
     above and fails this one — which is exactly the build this change exists to avoid. */
  const hLine = ((await walk(host))[0]||'');
  ok(/origin=You/.test(hLine),
     `  …and the HOST still reads itself as "You"  ["${hLine.slice(30)}"]`);
  ok(cLine && !/origin=You/.test(cLine),
     `  …while the CLIENT does NOT — the origin is named in ITS frame` +
     (cLine && !/origin=You/.test(cLine) ? '' : '  ← REPRODUCED: the host\'s perspective shipped verbatim'));
  ok(/origin=/.test(cLine) && !/\{s\d+\}/.test(cLine),
     `  …and every seat token was rendered, none left raw  ["${cLine.slice(30)}"]`);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
