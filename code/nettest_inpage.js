/* NETPLAY MUST START WITHOUT NAVIGATING (v1.31.15). Aj, from his phone: tapping Host on a downloaded HTML
 * killed the game with ERR_FILE_NOT_FOUND. Cause: netplay was entered by RELOADING with a query string
 * (`location.search='?net=rtchost'`), and on Android a downloaded file opens as `content://…` — a scheme that
 * cannot carry a query. The browser navigated to a URI the content provider could not resolve, so the game
 * simply vanished.
 * This asserts the fix in the shape that matters: the URL must not change. `?net=` still has to work too,
 * because every other nettest_* suite enters that way — so both paths are checked here.
 * Run: node nettest_inpage.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8319;
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'application/javascript'});r.end(b);}});});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:390,height:780}});   // a phone, which is where this bit
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // No query at all — exactly how a downloaded file is opened.
  await p.goto(`http://localhost:${PORT}/CardmenFighter.html`); await wait(700);
  const url0 = await p.evaluate(()=>location.href);
  ok(!/[?&]net=/.test(url0), 'opened with NO query string, like a file tapped from Downloads');

  await p.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(350);
  ok(await p.evaluate(()=>!!document.getElementById('onlineBtn')), 'the setup dialog offers Play online');
  await p.evaluate(()=>document.getElementById('onlineBtn').click()); await wait(350);
  ok(await p.evaluate(()=>!!document.getElementById('onHost')), 'the online dialog offers Host');

  await p.evaluate(()=>document.getElementById('onHost').click());
  /* netplay is live when it has injected its root AND the header button has flipped to Leave. That button used
   * to be a floating `#netLeave` overlay; since v1.31.57 it is the third state of `#newBtn`, because as an
   * overlay it covered the card reader's close button — and Leave drops the relay room, so the mis-tap ended
   * the game rather than closing a panel. */
  const leaveLabel = ()=>p.evaluate(()=>((document.getElementById('newBtn')||{}).textContent||'').trim());
  const started = await waitFor(async()=>await p.evaluate(()=>!!document.getElementById('netroot')) && /Leave/.test(await leaveLabel()));
  ok(started, 'tapping Host starts netplay in-page — this is the bug that is fixed');

  const url1 = await p.evaluate(()=>location.href);
  ok(url1===url0, `and the URL did NOT change — no navigation, so a content:// page survives\n     (${url0} -> ${url1})`);
  ok(await p.evaluate(()=>!/[?&]net=/.test(location.search)), 'specifically: no ?net= was appended');
  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));

  /* The Leave control must also avoid navigating when we entered in-page — clearing a query that was never
   * there would be a no-op on http but a broken URL on content://, so it reloads instead. */
  ok(/Leave/.test(await leaveLabel()), 'the Leave control is the HEADER button, not a floating overlay');
  ok(!(await p.evaluate(()=>!!document.getElementById('netLeave'))),
     '  → and no fixed #netLeave overlay is created, so it cannot cover the card reader’s close button');

  // ?net= must still work, because every other netplay suite depends on it
  const p2=await ctx.newPage(); const errs2=[]; p2.on('pageerror',e=>errs2.push(e.message));
  await p2.goto(`http://localhost:${PORT}/CardmenFighter.html?net=host&room=IP1`); await wait(900);
  ok(await waitFor(async()=>await p2.evaluate(()=>!!document.getElementById('netroot'))),
     'the ?net= path still boots netplay (every other nettest_* suite enters this way)');
  ok(errs2.length===0, 'no JS errors on the ?net= path'+(errs2.length?': '+errs2.slice(0,2).join(' | '):''));

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
