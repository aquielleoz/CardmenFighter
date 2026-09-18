/* Netplay CLIENT CEREMONY: when the host wins a round with a combo (stripping the client's shield), the client
 * should REPLAY the round ceremony — the #roundfx banner beats + the round-result log — not just snap. We reach
 * round 2 (combos legal), have the host win with a straight the client can't beat, and assert the client shows the
 * banner, logs the result, and its shield actually drops. (No Leyline, so the shield really falls.) */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const { selectAndFight, clickFight, clickPass } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8292),ROOM='CM'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const shieldsOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.shields():null);
const roundOf=p=>p.evaluate(()=>parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0);
const bannerUp=p=>p.evaluate(()=>{ var fx=document.getElementById('roundfx'); return !!(fx && /show/.test(fx.className) && fx.querySelector('.rfBeat')); });
const threshUp=p=>p.evaluate(()=>{ var fx=document.getElementById('thresholdfx'); return !!(fx && /show/.test(fx.className) && /ROAR|OVERDRIVE|REDLINE/.test(fx.textContent||'')); });
const roundBannerUp=p=>p.evaluate(()=>{ var fx=document.getElementById('roundfx'); var el=fx&&fx.querySelector('.rfRound'); return !!(fx && /show/.test(fx.className) && el && /Round/i.test(el.textContent||'')); });
const enteringCards=p=>p.evaluate(()=>document.querySelectorAll('#hand .card.enter').length);
const logText=p=>p.evaluate(()=>(document.getElementById('log')||{}).textContent||'');
const leadCombo=(p,ids)=>selectAndFight(p, ids);            // two-state button since epic step 20 — see fightclick.js
const leadFirst=p=>selectAndFight(p);                       // two-state button since epic step 20 — see fightclick.js
const passC=async p=>{ await p.evaluate(()=>{ var c=document.getElementById('clearBtn'); if(c&&!c.disabled)c.click(); });
                     return clickPass(p); };   // Pass lives only in the Fight Sub-Phase now — see fightclick.js
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,tries=70,ms=120){ for(let i=0;i<tries;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1000);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await startDuel(host, join);
  // In-page watchers catch the transient banners reliably (they show for ~1.3s, faster than sequential polling).
  /* AND RECORD **WHICH ROUND** THE THRESHOLD BEAT LANDS IN (2026-09-18). Aj, from a live duel: *"the roar
     is late for the client. overdrive seemed to have fired at the same time for both… i'm sensing a pattern
     here."* This suite already stages the exact case — the CLIENT loses a shield and it crosses the ROAR
     line — and it was GREEN, because it asserted only that the beat APPEARS: `waitFor(threshUp)` then
     `waitFor(roundOf>=3)`, sequential waits with generous budgets. A beat that shows up a round late
     satisfies both, in that order, every time.
     "IT HAPPENED" AND "IT HAPPENED WHEN IT SHOULD" ARE DIFFERENT CLAIMS, and only the second is the
     feature. The watcher stamps the round AT THE MOMENT the beat first shows, so the assertion can compare
     it against the round the shield actually broke instead of against the clock. */
  await join.evaluate(()=>{ window.__sawRoundBanner=false; setInterval(function(){ var e=document.querySelector('#roundfx .rfRound'); if(e && /Round/.test(e.textContent||'')) window.__sawRoundBanner=true; }, 40); });
  ok(await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6),'duel started');

  // Round 1 (jabs only): host leads a jab, client passes → host wins round 1 → round 2.
  await leadFirst(host);
  await waitFor(async()=>await turnOf(join)===0);
  await passC(join);
  ok(await waitFor(async()=>await roundOf(host)>=2 && await turnOf(host)===0),'reached round 2');

  // Round 2: host wins with a straight (combo) → strips the client's shield → CLIENT ceremony should fire.
  // Pre-set shields so the client's impending loss crosses the ROAR line: host 3 (lost 1) + client 4 → after the
  // loss the table has lost 2 total (2p × ride-level 1) → threshold unlocks, on the CLIENT's own perspective.
  const hostE=[D(2,'C','e'),D(3,'C','e')], cliE=[D(2,'C','e'),D(3,'C','e')];
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re,a.hs,a.rs),{hh:[D(3,'C'),D(4,'C'),D(5,'C'),D(6,'C'),D(7,'C')],rh:[D(9,'H'),D(2,'S'),D(3,'H')],he:hostE,re:cliE,hs:3,rs:4});
  await wait(400);
  const cliShieldsBefore=await shieldsOf(join);
  /* SAMPLE THE TRANSITION, because three hypotheses about WHY the beat is late have now been refuted by
     reading and one by a fix that did not move it. What is missing is the ORDER of three things on the
     client: its shield count dropping (which is what `animateShields` diffs and `checkThresholds` reads),
     the ceremony banner, and the beat. This records all three on one clock. */
  const sample=pg=>pg.evaluate(()=>{ var fx=document.getElementById('thresholdfx');
      return { t:Date.now(), sh:(window.__cmf?window.__cmf.shields():null),
               rd:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
               beat:!!(fx && /show/.test(fx.className) && /ROAR|OVERDRIVE|REDLINE/.test(fx.textContent||'')) }; });
  /* BOTH SEATS ON ONE CLOCK. Aj's report is RELATIVE — *"the roar is late for the client. overdrive seemed
     to have fired at the same time for both"* — so an absolute "which round tag" reading can agree with
     the product and still miss what he saw. Film the host too and compare the moments. */
  const hostFilm=[]; const filmingHost=(async()=>{ for(let i=0;i<260;i++){ hostFilm.push(await sample(host)); await wait(50); } })();
  const film=[]; const filming=(async()=>{ for(let i=0;i<260;i++){
    film.push(await join.evaluate(()=>{ var fx=document.getElementById('thresholdfx');
      return { t:Date.now(), sh:(window.__cmf?window.__cmf.shields():null),
               rd:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
               cer:!!(document.getElementById('roundfx')||{}).className.match(/show/),
               beat:!!(fx && /show/.test(fx.className) && /ROAR|OVERDRIVE|REDLINE/.test(fx.textContent||'')) }; }));
    await wait(50); } })();
  await leadCombo(host,['3C','4C','5C','6C','7C']);
  await waitFor(async()=>await turnOf(join)===0);
  await passC(join);


  ok(await waitFor(async()=>await bannerUp(join)),'client shows the #roundfx ceremony banner (pre-draw beats)');
  ok(await waitFor(async()=>/lost a shield|won the round|won with/i.test(await logText(join))),'client logs the round result (announceRoundWin ran)');
  ok(await waitFor(async()=>await threshUp(join), 70, 120),'client shows the threshold unlock beat (ROAR/OVERDRIVE/REDLINE)');
  const heldTrace=await join.evaluate(()=>{ const t=(window.__cmf&&window.__cmf.trace)?window.__cmf.trace():[];
    return t.filter(l=>/HELD/.test(l)).slice(-4); });
  /* AND THE DISCARD IS GONE WITH IT, WHICH IS THE HALF THAT MATTERS BEYOND THE BEAT. The mirror that used
     to be held here is the one `clientPlayCeremony` then threw away — *"the client loses that round's
     deal"*, permanently, because `broadcastMirror` dedupes by content and never re-asserts it. That
     discard is the recorded LEADING CANDIDATE for the `nettest_sync` fork; not holding the mirror in the
     first place removes the only chance to discard it in this sequence.
     ASSERTED, NOT ASSUMED: this exact sequence produced a `DISCARDED` line on every run before the fix
     (3 of 3) and none after. If it ever returns, the beat assertion above may still pass while the deal
     is silently lost — which is why this is its own line. */
  ok(!heldTrace.some(l=>/DISCARDED/.test(l)),
     'and no held mirror was DISCARDED — the `nettest_sync` fork\'s leading candidate does not fire here any more'+
     (heldTrace.some(l=>/DISCARDED/.test(l))?'  ← REPRODUCED: the client just lost that round\'s deal permanently\n      '+heldTrace.join('\n      '):''));
  ok(await waitFor(async()=>await shieldsOf(join) === cliShieldsBefore-1, 60, 150),'client shield actually dropped ('+cliShieldsBefore+' → '+(cliShieldsBefore-1)+')');
  // after the beats, the client should get the "Round N" card banner (caught by the in-page watcher)
  ok(await waitFor(async()=>await roundOf(join)>=3, 60, 150),'client advanced to the next round');
  ok(await waitFor(async()=>await join.evaluate(()=>!!window.__sawRoundBanner), 40, 120),'client showed the "Round N" card banner');
  await filming; await filmingHost;
  /* THE CLAIM IS RELATIVE, AND MY FIRST VERSION OF IT WAS NOT (2026-09-18). Aj's report is *"the roar is
     late **for the client**. overdrive seemed to have fired **at the same time for both**"* — a comparison
     between two screens. I first asserted an ABSOLUTE thing instead: which round TAG was showing when the
     beat played. That reads 3 on BOTH seats, because the round counter advances at resolution
     (`roundAdvance` is a BEGIN event) — normal semantics, identical either side, and nothing to do with
     the bug. It would have ratcheted a non-defect forever.
     MEASURED A/B ON ONE BUILD SEQUENCE, which is what settled it:
        without `isRoundDeal`'s shield clause → client beat **0.52s** after the host
        with it                               → **0.00s**, four runs of four
     So the lateness is the held mirror, and the fix closes it. The threshold is 250ms because the observed
     split is 520ms vs 0ms and there is no third value — wide enough that a loaded sweep does not trip it,
     far below the defect it is guarding against. */
  const gap = (()=>{ const hb=hostFilm.filter(f=>f.beat)[0], cb=film.filter(f=>f.beat)[0];
    return (hb&&cb) ? (cb.t-hb.t) : null; })();
  ok(gap!=null && gap<250,
     `the beat reaches BOTH seats together — client ${gap==null?'never showed it':gap+'ms after the host'} (defect measured at 520ms)`+
     (gap!=null&&gap<250?'':'  ← REGRESSED: the client is waiting on a held mirror again — see `isRoundDeal`\'s shield clause'));
  { const hb=hostFilm.filter(f=>f.beat)[0], cb=film.filter(f=>f.beat)[0];
    const hd=hostFilm.find(f=>f.sh!==hostFilm[0].sh), cd=film.find(f=>f.sh!==film[0].sh);
    console.log('   ↳ BOTH SEATS — when did each show the beat, and at what round tag?');
    console.log(`      HOST   shields ${hostFilm[0].sh}→${hd?hd.sh:'?'} at round ${hd?hd.rd:'?'};  BEAT at round ${hb?hb.rd:'never'}`);
    console.log(`      CLIENT shields ${film[0].sh}→${cd?cd.sh:'?'} at round ${cd?cd.rd:'?'};  BEAT at round ${cb?cb.rd:'never'}`);
    if(hb&&cb) console.log(`      beat gap: client is ${((cb.t-hb.t)/1000).toFixed(2)}s after the host`); }
  {/* print the transition once, compressed to state CHANGES — a 260-row dump is unreadable and a changes-only
      view is what makes an ordering visible at a glance. */
   const t0=film[0]?film[0].t:0; let prev=null; const rows=[];
   film.forEach(f=>{ const k=f.sh+'|'+f.rd+'|'+f.cer+'|'+f.beat; if(k!==prev){ prev=k;
     rows.push(`      +${String(f.t-t0).padStart(5)}ms  shields=${f.sh}  round=${f.rd}  ceremony=${f.cer?'Y':'n'}  BEAT=${f.beat?'Y':'n'}`); } });
   console.log('   ↳ client transition (state changes only):\n'+rows.join('\n')); }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
