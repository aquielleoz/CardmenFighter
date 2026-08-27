/* THE BUILD STAMP (v1.31.18). Aj reported a missing name field that had shipped two versions earlier — his
 * phone held a `content://` file downloaded before it. The code was right, the report was honest, and nothing
 * on screen could have told either of us apart from reading the source. So the build now stamps itself.
 *
 * What this suite protects is the property that makes a stamp worth having: it must be TRUE. A stamp that can
 * drift is worse than none, because it makes a stale build look current. So the version is substituted by
 * build.js from README.md's `**Status:**` line rather than kept as a second constant, and this asserts the
 * whole chain — README → build → the two screens a bug report is actually taken from.
 * Run: node versiontest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const fs=require('fs'), path=require('path');
const HTML=path.resolve(__dirname,'CardmenFighter.html');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // ---- the chain, before any browser: README is the one source of truth
  const readme=fs.readFileSync(path.resolve(__dirname,'..','README.md'),'utf8');
  const want=(readme.match(/\*\*Status:\*\*\s*(v\d+\.\d+\.\d+[a-z]?)/)||[])[1];
  ok(!!want, `README.md's **Status:** line names a version (${want||'NONE — build.js would refuse to build'})`);
  /* THE CHANGELOG IS PART OF THE GATE NOW. v1.31.33 nearly shipped without an entry: the script writing it
   * asserted on a stale anchor and threw BEFORE its write, and a confirmation that never printed was read as
   * though it had. The version stamp is derived and therefore cannot drift; the changelog is hand-written and
   * silently can, which is exactly the asymmetry this closes. */
  const handoff=fs.readFileSync(path.resolve(__dirname,'..','docs','NEXT-SESSION.md'),'utf8');
  ok(want ? handoff.indexOf('### '+want) >= 0 : false,
     `docs/NEXT-SESSION.md carries a "### ${want}" changelog heading — a shipped version with no entry is how a change becomes unfindable`);
  const built=fs.readFileSync(HTML,'utf8');
  ok(!built.includes('__VERSION__'), 'no unsubstituted __VERSION__ survived into the built page');
  const stamped=(built.match(/GAME_VERSION='([^']+)'/)||[])[1];
  ok(stamped===want, `the built page is stamped with README's version ("${stamped}" vs "${want}")`);
  /* Both copies must agree, or a player downloading from the repo root gets a different build from the one
   * tested here — which is the same class of confusion this feature exists to end. */
  const rootCopy=fs.readFileSync(path.resolve(__dirname,'..','CardmenFighter.html'),'utf8');
  ok((rootCopy.match(/GAME_VERSION='([^']+)'/)||[])[1]===want, 'the repo-root copy carries the same stamp — that is the file people download');

  /* THE BUILD MUST BE CURRENT. build.js inlines each module VERBATIM between its placeholders, so the built page
   * must literally contain the text of every source file. That makes staleness exactly checkable — and it needed
   * checking: on 2026-08-26 two engine commits shipped to main with an HTML built before them. `test.js` passed
   * (it runs on engine.js directly), `versiontest` passed (the stamp was right), and nothing noticed that the
   * page and the source had diverged. The flags involved were default-off so no behaviour changed, which is
   * exactly why it went unseen. */
  for (const mod of ['engine.js','ai.js','netview.js','qr.js']) {
    const src=fs.readFileSync(path.resolve(__dirname,mod),'utf8');
    ok(built.indexOf(src)>=0, `the built page contains the CURRENT ${mod} verbatim — a stale build cannot hide behind default-off flags`);
  }

  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  await p.goto('file://'+HTML+'?dbgsolo=1'); await wait(500);

  // ---- screen 1: the setup dialog, which every game starts from
  await p.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(350);
  const setup=await p.evaluate(()=>{
    const el=document.querySelector('.modal .verRow');
    if(!el) return null;
    const cs=getComputedStyle(el);
    return { text:el.textContent.trim(), shown:cs.display!=='none'&&cs.visibility!=='hidden'&&el.offsetHeight>0 };
  });
  ok(!!setup && setup.text.includes(want), `the setup dialog shows it — "${setup?setup.text:'(absent)'}"`);
  ok(!!setup && setup.shown, 'and it is actually rendered, not just present in the DOM');

  /* ---- screen 2: the netplay lobby bar. This is the exact screen Aj screenshotted, so it is the one that has
   * to carry the stamp for a report like his to be answerable at a glance. */
  await p.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(350);
  await p.evaluate(()=>{ const h=document.getElementById('onHost'); if(h)h.click(); });
  const gotBar=await waitFor(async()=>await p.evaluate(()=>!!document.querySelector('#netroot .netbar .verStamp')));
  ok(gotBar, 'the netplay lobby bar shows it too — the screen a netplay bug report is taken from');
  if(gotBar){
    const bar=await p.evaluate(()=>{
      const el=document.querySelector('#netroot .netbar .verStamp');
      return { text:el.textContent.trim(), bar:el.parentNode.textContent.trim().replace(/\s+/g,' '), h:el.offsetHeight };
    });
    ok(bar.text===want, `and it reads exactly the built version ("${bar.text}")`);
    ok(bar.h>0, `rendered in the bar: "${bar.bar}"`);
  }
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
