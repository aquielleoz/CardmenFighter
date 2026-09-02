/* Netplay CLIENT CEREMONY: when the host wins a round with a combo (stripping the client's shield), the client
 * should REPLAY the round ceremony — the #roundfx banner beats + the round-result log — not just snap. We reach
 * round 2 (combos legal), have the host win with a straight the client can't beat, and assert the client shows the
 * banner, logs the result, and its shield actually drops. (No Leyline, so the shield really falls.) */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
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
const leadCombo=(p,ids)=>p.evaluate(function(ids){ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); ids.forEach(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); }); var f=document.getElementById('fightBtn'); if(f)f.click(); }, ids);
const leadFirst=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); });
const passC=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var b=document.getElementById('passBtn'); if(b)b.click(); });
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,tries=70,ms=120){ for(let i=0;i<tries;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1000);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await startDuel(host, join);
  // In-page watchers catch the transient banners reliably (they show for ~1.3s, faster than sequential polling).
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
  ok(await waitFor(async()=>await shieldsOf(join) === cliShieldsBefore-1, 60, 150),'client shield actually dropped ('+cliShieldsBefore+' → '+(cliShieldsBefore-1)+')');
  // after the beats, the client should get the "Round N" card banner (caught by the in-page watcher)
  ok(await waitFor(async()=>await roundOf(join)>=3, 60, 150),'client advanced to the next round');
  ok(await waitFor(async()=>await join.evaluate(()=>!!window.__sawRoundBanner), 40, 120),'client showed the "Round N" card banner');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
