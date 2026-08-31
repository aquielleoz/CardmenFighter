/* A CLIENT CAN TAKE ITS READY BACK (Aj, 2026-08-30). Until now, pressing Ready was one-way: you waited for the
 * host to start whether or not you still wanted to play. The host could already remove a seat; the player could
 * not.
 *
 * This is the per-seat form of what a rules change already does to the whole table, so it reuses `seatRuleGen`
 * rather than inventing a second notion of "ready". Two things it must NOT do, and both are asserted:
 *   · it must not free the SEAT — `hostStartRealN` indexes joined seats, never ready ones, precisely so a stale
 *     seat before a ready one cannot mis-assign decks;
 *   · it must not be undone by the join retry, which re-sends `t:'join'` every 350ms until the game starts. A
 *     button that un-readies and then silently re-readies a third of a second later looks exactly like a dead
 *     button, so the assertions WAIT past that window rather than checking immediately.
 * Run: node nettest_unready.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8391,ROOM='UR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=90,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const hostView=p=>p.evaluate(()=>({
  startEnabled: !!(document.getElementById('lobbyGo') && !document.getElementById('lobbyGo').disabled),
  text: (document.getElementById('netroot')||{}).textContent||'',
}));
const joinView=p=>p.evaluate(()=>{
  const t=(document.getElementById('netroot')||{}).textContent||'';
  const m=/you are Player (\d+)/i.exec(t);
  return { hasReady: !!document.getElementById('lobbyGo'),
           hasUnready: !!document.getElementById('lobbyUnready'),
           seat: m?+m[1]:null, text:t };
});
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  ok(await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo'))), 'the client reaches the lobby');
  ok(!(await joinView(join)).hasUnready, '  → and there is nothing to un-ready before it has readied');

  await join.evaluate(()=>document.getElementById('lobbyGo').click());
  ok(await until(async()=>(await hostView(host)).startEnabled), 'the client readies, and the host can start');
  const beforeSeat=(await joinView(join)).seat;
  ok((await joinView(join)).hasUnready, '  → and the client is offered "↩ Not ready"');
  ok(beforeSeat!==null, `  → and it has been given a seat (Player ${beforeSeat})`);

  await join.evaluate(()=>document.getElementById('lobbyUnready').click());
  /* PAST the 350ms join retry on purpose: checking immediately would pass on a build where the retry silently
     re-readies the seat, which is the exact failure this button is prone to. */
  await wait(1600);
  const h=await hostView(host), j=await joinView(join);
  ok(!h.startEnabled, 'after un-readying, the host can NO LONGER start' +
     (h.startEnabled?'  <-- REPRODUCED: the join retry re-readied the seat, or the host never cleared it':''));
  ok(j.hasReady && !j.hasUnready, '  → and the client is back to offering Ready');
  ok(await host.evaluate(()=>/no longer ready/i.test((document.getElementById('log')||{}).textContent||'')),
     '  → and the host LOGS it, so a host watching the lobby can see why Start went away');

  /* THE SEAT MUST SURVIVE. Un-ready is not a disconnect: the roster still shows a player present, because
     `hostStartRealN` indexes joined seats and renumbering here would mis-assign decks. */
  /* THE SEAT MUST SURVIVE, and the sharp way to assert that is the seat NUMBER: if un-ready freed the seat,
     re-readying would take a different one, and `hostStartRealN` — which indexes joined seats — would hand out
     the wrong decks and names. Checked after the round trip, below. */

  await join.evaluate(()=>document.getElementById('lobbyGo').click());
  ok(await until(async()=>(await hostView(host)).startEnabled), 're-readying works, and the host can start again');
  const afterSeat=(await joinView(join)).seat;
  ok((await joinView(join)).hasUnready, '  → and "↩ Not ready" is offered once more');
  ok(afterSeat===beforeSeat && afterSeat!==null,
     `  → and it is the SAME seat (Player ${beforeSeat} → Player ${afterSeat}): un-ready must not free the seat, or hostStartRealN mis-assigns decks`);

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
