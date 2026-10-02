/* READY IS CONSENT, AND THE RTC HOST LOBBY DID NOT CHECK IT (2026-09-17).
 *
 * The two host lobbies disagreed about what Start means. `renderLobby` (BroadcastChannel) gates on
 * `readyCount()` — has CONFIRMED — while `renderHostRtcLobby` gated on `joinedCount()` / `nextSeat-1` — has
 * A SEAT — on the button AND in the click handler. `renderNet` routes every RTC host to the second one
 * unconditionally, so **the only lobby a real internet host ever reaches was the one that never checked
 * readiness**, and a game could be dealt to a seat that had not consented. `hostBackToLobby`'s own comment
 * says nobody is dealt in "without confirming".
 *
 * WHY THIS SUITE EXISTS AT ALL, rather than an assertion bolted onto `nettest_rtc`: `nettest_unready`
 * already makes exactly this claim — *"after un-readying, the host can NO LONGER start"* — but it runs on
 * `?net=host`, i.e. BroadcastChannel, where the gate was already right. None of the RTC suites asserted it.
 * That is this repo's documented TWO-RENDERERS trap with the TEST applied to one of them only, and the fix
 * was not finished until the other renderer carried the assertion. `nettest_rtc` cannot: it calls
 * `startDuel`, which swallows the whole lobby moment — ready and Start happen inside it.
 *
 * READINESS IS DROPPED WITHOUT DROPPING THE SEAT, DELIBERATELY, IN TWO PLACES — `hostUnready`
 * (`delete seatRuleGen[seat]`, `nextSeat` untouched) and `hostRulesChanged` (`rulesGen++`, invalidating
 * every stamp). Either takes `readyCount()` to 0 while `joinedCount()` stays 1, which is the exact state
 * that separates the two gates. The seat MUST survive: `hostStartRealN` indexes `nextSeat-1`, and a
 * readiness-based index would renumber the table and mis-assign decks.
 *
 * stun=0 + mDNS disabled → the two tabs connect over loopback ICE, no external STUN/TURN.
 * Run: node nettest_rtcready.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8367),ROOM='RR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&stun=0&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sigOut=p=>p.evaluate(()=>{ var t=document.getElementById('sigOut'); return t?t.value:''; });
const setSigIn=(p,v)=>p.evaluate(v=>{ var t=document.getElementById('sigIn'); if(t){ t.value=v; } }, v);
const clickGo=p=>p.evaluate(()=>{ var g=document.getElementById('sigGo'); if(g)g.click(); });
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,tries=80,ms=150){ for(let i=0;i<tries;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* READ THE BUTTON, NOT A COUNTER. The claim is about what the HOST can do, and `disabled` on the real
 * control is the only thing a player experiences. A hook reporting `readyCount()` would agree with the
 * gate by construction and pass on a build where the button ignores it — which is the bug itself. */
const hostStart=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo');
  return g ? { there:true, enabled:!g.disabled, text:(g.textContent||'').trim() } : { there:false }; });
const joinLobby=p=>p.evaluate(()=>({
  ready:   !!document.getElementById('lobbyGo'),
  unready: !!document.getElementById('lobbyUnready'),
  seat:    (function(){ var m=((document.getElementById('netroot')||{}).textContent||'').match(/Player\s*(\d+)/); return m?+m[1]:null; })()
}));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node nettest_rtcready.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('rtchost')); await join.goto(url('rtcjoin')); await host.waitForTimeout(600);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // ---- the real signalling handshake: host offer → joiner answer → host accept
  ok(await waitFor(async()=>(await sigOut(host)).length>20, 60, 200),'host generated an invite code (offer)');
  await setSigIn(join, await sigOut(host)); await clickGo(join);
  ok(await waitFor(async()=>(await sigOut(join)).length>20, 60, 200),'joiner generated a reply code (answer)');
  await setSigIn(host, await sigOut(join)); await clickGo(host);

  ok(await waitFor(()=>join.evaluate(()=>!!document.getElementById('lobbyGo'))),'the DataChannel opened and the client reached the RTC lobby');

  /* THE GATE MUST START SHUT. A seat exists the moment the channel binds, so if Start is live HERE the
     lobby is gating on `joinedCount()` and the rest of this suite proves nothing. */
  const s0=await hostStart(host);
  ok(s0.there && !s0.enabled, 'BEFORE the client readies, the RTC host CANNOT start'+
     (s0.enabled?'  ← REPRODUCED: gated on having a SEAT, not on consent':''));

  await join.evaluate(()=>document.getElementById('lobbyGo').click());
  ok(await waitFor(async()=>(await hostStart(host)).enabled),'the client readies, and the host can start');
  const seatBefore=(await joinLobby(join)).seat;

  await join.evaluate(()=>{ var u=document.getElementById('lobbyUnready'); if(u) u.click(); });
  /* PAST the 350ms join retry on purpose — it re-sends the join payload on a timer, and checking
     immediately passes on a build where the retry silently re-readies the seat. `nettest_unready` pays
     the same 1.6s for the same reason. */
  await wait(1600);
  const s1=await hostStart(host);
  ok(!s1.enabled, 'after un-readying, the RTC host can NO LONGER start'+
     (s1.enabled?'  ← REPRODUCED: this is the renderer a real internet host reaches, and it ignored readiness':''));

  /* THE SEAT MUST SURVIVE, and the sharp way to say so is the seat NUMBER — `hostStartRealN` indexes
     `nextSeat-1`, so a freed seat would renumber the table and mis-assign decks. */
  await join.evaluate(()=>document.getElementById('lobbyGo').click());
  ok(await waitFor(async()=>(await hostStart(host)).enabled),'re-readying works, and the host can start again');
  const seatAfter=(await joinLobby(join)).seat;
  ok(seatAfter===seatBefore, `  → and it is the SAME seat (${seatBefore} → ${seatAfter}): un-ready must not free it, or hostStartRealN mis-assigns decks`);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
