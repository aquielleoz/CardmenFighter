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
  await join.evaluate(()=>{ window.__threshAtRound=null;
    setInterval(function(){ if(window.__threshAtRound!=null) return;
      var fx=document.getElementById('thresholdfx');
      if(fx && /show/.test(fx.className) && /ROAR|OVERDRIVE|REDLINE/.test(fx.textContent||''))
        window.__threshAtRound=parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0;
    }, 40); });
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
  await leadCombo(host,['3C','4C','5C','6C','7C']);
  await waitFor(async()=>await turnOf(join)===0);
  await passC(join);

  ok(await waitFor(async()=>await bannerUp(join)),'client shows the #roundfx ceremony banner (pre-draw beats)');
  ok(await waitFor(async()=>/lost a shield|won the round|won with/i.test(await logText(join))),'client logs the round result (announceRoundWin ran)');
  ok(await waitFor(async()=>await threshUp(join), 70, 120),'client shows the threshold unlock beat (ROAR/OVERDRIVE/REDLINE)');
  /* …IN THE ROUND THE SHIELD ACTUALLY BROKE. The loss happens in round 2, so the beat belongs to round 2.
     `checkThresholds()` fires off `renderShields`' diff, which on a client runs when the MIRROR lands — and
     a broken shield returning to the client's own hand brings a card the client does not hold, which is
     what `isRoundDeal` keys on. Its empty-pile clause was added for exactly that mirror, on the assumption
     the return always arrives with the pile still on the table; if it arrives after `pileClear`, the clause
     does not catch it, the mirror is HELD, and the shatter — and the beat with it — defers to the next
     round's reveal.
     WHY THIS IS THE ASYMMETRY AJ SAW: ROAR crossed when HE lost the shield (a card enters his hand),
     OVERDRIVE when the host did (nothing enters his hand, nothing is held, beat on time). */
  /* RATCHET:threshold-beat-late-on-client — PINNED IN THE BROKEN DIRECTION, and deliberately not fixed here.
     THE BEAT LANDS IN ROUND 3 WHEN THE SHIELD BROKE IN ROUND 2. Reproduced deterministically, which is the
     thing Aj's report needed and which this suite could not do before: it asserted only that the beat
     APPEARS, and a beat a round late satisfies that in the same order every time.
     AND THE CAUSE IS NOT WHAT I FILED — TWICE. The first guess was "the loss shares a mirror with the
     deal"; the second was "a broken shield returning to hand looks like a deal to `isRoundDeal`". The
     client's own trace refutes both: the hold reads **"(ceremony active)"**, a different hold path
     entirely, and it is followed by
       `mirror HELD -> DISCARDED  a new ceremony arrived first; the client loses that round's deal`
     which is `clientPlayCeremony` throwing a held mirror away.
     THAT DISCARD IS ALREADY ON THE BOOKS AS SOMETHING BIGGER. Its own comment calls it *"THE LEADING
     CANDIDATE FOR THE `nettest_sync` FORK, and this is the only place it can happen"*, with the client
     short that round's deal PERMANENTLY, because `broadcastMirror` dedupes by content and never re-asserts
     what was thrown away. So the late ROAR is a visible symptom of a known invisible bug — which is the
     most useful thing a cosmetic report has done here.
     WHY THIS IS A RATCHET AND NOT A FIX: the obvious repair is recorded as already having been tried and
     having made things WORSE — *"NOT changed to land-it-first: that was tried and made the suite WORSE
     (5 failures in 8)"*. A second guess at it at the end of a long session is exactly the move this file
     warns about. The ratchet fails BOTH ways: the day the beat lands in round 2, this line goes red saying
     the fix landed, and the entry `[id: threshold-beat-late-on-client]` gets closed with it. */
  const atRound=await join.evaluate(()=>window.__threshAtRound);
  const heldTrace=await join.evaluate(()=>{ const t=(window.__cmf&&window.__cmf.trace)?window.__cmf.trace():[];
    return t.filter(l=>/HELD/.test(l)).slice(-4); });
  ok(atRound===3,
     `RATCHET: the threshold beat lands a round LATE — shield broke in round 2, beat shown in round ${atRound}`+
     (atRound===2?'  ← THE FIX LANDED: flip this to `ok(atRound===2, …)` and close [id: threshold-beat-late-on-client]':''));
  ok(heldTrace.some(l=>/DISCARDED/.test(l)),
     'RATCHET: …and a HELD MIRROR IS DISCARDED in the same sequence — the `nettest_sync` fork\'s leading candidate, now deterministic'+
     (heldTrace.some(l=>/DISCARDED/.test(l))?'':'  ← no discard this run; if that is now reliable, the fork candidate may be gone — re-measure before deleting this')+
     '\n      ' + heldTrace.join('\n      '));
  ok(await waitFor(async()=>await shieldsOf(join) === cliShieldsBefore-1, 60, 150),'client shield actually dropped ('+cliShieldsBefore+' → '+(cliShieldsBefore-1)+')');
  // after the beats, the client should get the "Round N" card banner (caught by the in-page watcher)
  ok(await waitFor(async()=>await roundOf(join)>=3, 60, 150),'client advanced to the next round');
  ok(await waitFor(async()=>await join.evaluate(()=>!!window.__sawRoundBanner), 40, 120),'client showed the "Round N" card banner');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
