/* BACK TO THE LOBBY OVER REAL WebRTC, WITH A PEER THAT LEFT (v1.31.95). The half of the lobby return that
 * BroadcastChannel cannot exercise: a client CLOSES ITS TAB after the game, so its DataChannel closes. On the old
 * seat model that seat would still be counted, listed and DEALT INTO game two — `hostStartRealN` indexes seats
 * 1..nextSeat-1 contiguously, `endGame`→`clearDiscon()` has already forgotten who dropped, so `driveN` parks on a
 * ghost forever. Seats are re-claimed with Ready instead, so a gone peer simply never re-joins.
 * Then "players addable": the host mints a fresh invite from the reopened lobby, a NEW client joins it, and game two
 * deals a DUEL (not a 3-Rider table with a corpse in seat 1) and plays a full round.
 * Modelled on nettest_rtc_discon (close the page to close the channel) and nettest_rtc3 (the invite() helper).
 * Run: node nettest_lobbyback_rtc.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8449),ROOM='LB'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&stun=0&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=200,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const sigOut=p=>p.evaluate(()=>{ var t=document.getElementById('sigOut'); return t?t.value:''; });
const setSigIn=(p,v)=>p.evaluate(v=>{ var t=document.getElementById('sigIn'); if(t) t.value=v; }, v);
const clickGo=p=>p.evaluate(()=>{ var g=document.getElementById('sigGo'); if(g)g.click(); });
const click=(p,id)=>p.evaluate(id=>{ const b=document.getElementById(id); if(b && !b.disabled){ b.click(); return true; } return false; }, id);
const view=p=>p.evaluate(()=>({
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  hand:document.querySelectorAll('#hand .card').length,
  finished:window.__cmf?window.__cmf.finished():null,
  overlay:!!(document.getElementById('overlay')||{}).classList.contains('show'),
}));
const netText=p=>p.evaluate(()=>(document.getElementById('netroot')||{}).textContent||'');
const lobbyVisible=p=>p.evaluate(()=>{ const nr=document.getElementById('netroot'); if(!nr) return false;
  if(getComputedStyle(nr).display==='none') return false;
  const el=document.elementFromPoint(Math.floor(innerWidth/2), Math.floor(innerHeight/2));
  return !!(el && nr.contains(el)); });
/* The copy-paste handshake, from nettest_rtc3: host shows an offer, the client answers it, the host connects. */
async function invite(host, client, prevOffer){
  const offer=await (async()=>{ for(let i=0;i<120;i++){ const o=await sigOut(host); if(o.length>20 && o!==prevOffer) return o; await wait(150);} return ''; })();
  if(!offer) return {ok:false, offer:prevOffer};
  await setSigIn(client, offer); await clickGo(client);
  const answer=await (async()=>{ for(let i=0;i<120;i++){ const a=await sigOut(client); if(a.length>20) return a; await wait(150);} return ''; })();
  if(!answer) return {ok:false, offer};
  await setSigIn(host, answer); await clickGo(host);
  return {ok:true, offer};
}
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('rtchost')); await join.goto(url('rtcjoin')); await host.waitForTimeout(600);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  const i1=await invite(host, join, '');
  ok(i1.ok, 'player 1 connected over a real DataChannel');
  /* A name, so "not listed" below is a real negative rather than an empty string matching nothing. */
  await join.evaluate(()=>{ const el=document.getElementById('netName'); if(el){ el.value='Dustin'; el.dispatchEvent(new Event('input')); } });
  await startDuel(host, join);
  ok(await until(async()=>(await view(host)).hand===6 && (await view(join)).hand===6, 100), 'game one dealt on both ends');
  ok(await until(async()=>/Dustin/.test(await host.evaluate(()=>(document.getElementById('rivalWho')||{}).textContent||'')), 40), '  → the host knows the client by name');

  // round 1 is jabs only — reach round 2, then stage the kick (the nettest_endscreen shape)
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click(); const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  await until(async()=>(await view(join)).yourTurn, 100);
  await click(join,'passBtn');
  ok(await until(async()=>(await view(host)).round>=2, 120), 'round 2 reached');
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(9,'D','h'),C(9,'H','h'),C(4,'C','h'),C(5,'S','h')],
                       [C(3,'D','c'),C(6,'H','c'),C(7,'C','c'),C(8,'S','c')], null,null, 4, 0);
  });
  await wait(600);
  await host.evaluate(()=>{ ['h9D','h9H'].forEach(id=>{const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click();}); const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  await until(async()=>(await view(join)).yourTurn, 100);
  await click(join,'passBtn');
  ok(await until(async()=>(await view(host)).finished===true, 140), 'game one finished on the host');
  ok(await until(async()=>(await view(join)).overlay===true, 100), 'the client sees its end screen');

  /* THE PEER LEAVES. Closing the page closes its DataChannel; the host's onclose handler fires, and — the game
   * being finished — records nothing (hostOnPeerDrop returns on hostState.finished). Whatever the host knows about
   * this seat at lobby time, it knows from the channel alone. */
  await join.close();
  ok(await click(host,'againBtn'), 'the host presses ↩ Back to the lobby');
  ok(await until(()=>lobbyVisible(host), 60), 'the host\'s lobby is on screen (hit-tested)');
  /* The channel close can trail the page close by a moment; poll the roster rather than reading it once. */
  ok(await until(async()=>/No players yet/.test(await netText(host)) && /0 connected/.test(await netText(host)), 200),
     'the gone peer is NOT at the table: "No players yet", "0 connected"'+
     (/Dustin/.test(await netText(host))?'  ← REPRODUCED: a closed channel still holds a seat':''));
  const ht=await netText(host);
  ok(!/Dustin/.test(ht), '  → and it is not listed by name');
  ok(await host.evaluate(()=>{ const g=document.getElementById('lobbyGo'); return !!(g && g.disabled); }), '  → Start is disabled — nothing to deal a duel against');
  ok(/press ＋ Invite a player to get a code/.test(ht), '  → the roster says how to get a code, since the room was dropped at Start and there is none "above"');
  ok(await host.evaluate(()=>/Invite a player/.test((document.getElementById('inviteBtn')||{}).textContent||'')), '  → "＋ Invite a player" (not "another") is offered');

  /* PLAYERS ADDABLE: a fresh invite from the reopened lobby, a new player, game two as a DUEL. */
  ok(await click(host,'inviteBtn'), 'the host mints a new invite');
  const join2=await ctx.newPage(); join2.on('pageerror',e=>errs.push('join2: '+e.message));
  await join2.goto(url('rtcjoin'));
  const i2=await invite(host, join2, i1.offer);
  ok(i2.ok && i2.offer!==i1.offer, 'a NEW player connects on a new offer (not game one\'s)');
  await join2.evaluate(()=>{ const el=document.getElementById('netName'); if(el){ el.value='Cass'; el.dispatchEvent(new Event('input')); } });
  await startDuel(host, join2);
  ok(await until(async()=>(await view(host)).round>0 && (await view(join2)).round>0, 120), 'game two is dealt on both ends');
  const seats=await host.evaluate(()=>({ s1:(window.__cmf.handOf(1)||[]).length, s2:window.__cmf.handOf(2) }));
  ok(seats.s1===6 && seats.s2===null, '  → it is a DUEL: seat 1 holds 6 cards and there is no seat 2  [s1 '+seats.s1+', s2 '+(seats.s2===null?'none':'PRESENT — a ghost was dealt in')+']');
  ok(await until(async()=>/Cass/.test(await host.evaluate(()=>(document.getElementById('rivalWho')||{}).textContent||'')), 40), '  → and the host knows the NEW player by name, in seat 1');
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click(); const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await view(join2)).yourTurn, 100), 'the host leads game two and the turn reaches the new player');
  await click(join2,'passBtn');
  ok(await until(async()=>(await view(host)).round>=2 && (await view(join2)).round>=2, 120), 'game two reaches round 2 on both ends — a full round');
  const tr=await host.evaluate(()=>window.__cmf.trace());
  ok(tr.filter(l=>/started: true -> FALSE/.test(l)).length===1, 'the host flipped started exactly once (the lobby return)');
  ok(!(await join2.evaluate(()=>window.__cmf.trace())).some(l=>/mirror IGNORED/.test(l)), 'the new player ignored no mirror — the host sent nothing stale after nulling hostState');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
