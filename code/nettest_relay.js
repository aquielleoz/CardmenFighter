/* FULL-UI NETPLAY THROUGH THE RELAY — the room-code path, end to end, with no human in the loop.
 *
 * This is the assertion the whole feature rests on: a host shows four characters, a joiner types them, and a
 * real WebRTC DataChannel opens with NOTHING copied or pasted. Everything before this version needed a person
 * to carry two codes in opposite directions.
 *
 * Runs against relay/mock.js rather than the deployed Worker, so the suite is offline and deterministic. The
 * Worker is covered by relay/relaytest.js, which can be pointed at the real deployment.
 *
 * BOTH DIRECTIONS. A suite that only proved the relay path would let the fallback rot silently — and the
 * fallback is the floor, since the offline file with no network has nothing else. So this also asserts that
 * `norelay=1` and an unreachable relay both land on exactly today's copy-paste screen. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'), fs=require('fs'), path=require('path'), { spawn } = require('child_process');
const DIR=__dirname, PORT=8296, MOCK=8797;
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const RELAY='http://127.0.0.1:'+MOCK;
const url=(r,extra)=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&stun=0&dbg=1&`+(extra||('relay='+encodeURIComponent(RELAY)));
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,tries=80,ms=150){ for(let i=0;i<tries;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const relayPost=p=>new Promise((res,rej)=>{ const r=http.request(RELAY+p,{method:'POST'},x=>{let b='';x.on('data',c=>b+=c);x.on('end',()=>res({status:x.statusCode,body:b}));}); r.on('error',rej); r.end(); });
const relayGet=p=>new Promise((res,rej)=>{ http.get(RELAY+p,r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>res({status:r.statusCode,body:b}));}).on('error',rej); });

let mock=null;
(async()=>{
  mock=spawn(process.execPath,[path.join(DIR,'..','relay','mock.js'),String(MOCK)],{stdio:'ignore'});
  await new Promise(r=>srv.listen(PORT,r)); await wait(700);
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // ---------- the room-code path
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  await host.goto(url('rtchost')); await wait(700);

  ok(await waitFor(()=>host.evaluate(()=>{const e=document.getElementById('roomCodeVal'); return !!e && /^[A-Z0-9]{4}$/.test(e.textContent.trim());}), 60, 250),
     'the host shows a FOUR-CHARACTER room code, with no copy-paste anywhere in sight');
  const code=await host.evaluate(()=>document.getElementById('roomCodeVal').textContent.trim());
  ok(!/[O0IL1]/.test(code), '  → and it avoids O 0 I L 1, because it gets read aloud and typed (' + code + ')');

  /* THE FALLBACK MUST STILL BE THERE, one tap away. Demoted is fine; gone is not — an older build on the far
   * end, or no network, leaves the manual code as the only way in. */
  ok(await host.evaluate(()=>{ const d=document.querySelector('.relayAlt'); const t=document.getElementById('sigOut');
       return !!d && !!t && t.value.length>40; }),
     '  → and the full invite code is still there behind "Or send a full invite code", not removed');

  /* THE NETBAR CLAIM. "no server" was true for every version before this one, so with a relay carrying the
   * handshake it would be a LIE rather than a stale string. Asserted in both directions below, because a tag
   * that always said the honest thing would be just as wrong the other way. */
  ok(await host.evaluate(()=>{ const b=document.querySelector('#netroot .netbar');
       return !!b && !/no server/.test(b.textContent) && /relay/i.test(b.textContent); }),
     'with a room open the netbar stops claiming "no server" and says what the relay actually does');
  ok(await host.evaluate(()=>{ const h=document.querySelector('#netroot .nethint');
       return !!h && /IP address/i.test(document.getElementById('netroot').textContent); }),
     '  → and the screen says outright that connection details, including the IP address, pass through it');

  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await join.goto(url('rtcjoin')); await wait(700);
  ok(await join.evaluate(()=>!!document.getElementById('roomIn')), 'the joiner is asked for a room code first');

  await join.evaluate(c=>{ const i=document.getElementById('roomIn'); i.value=c; document.getElementById('roomGo').click(); }, code);

  /* THE ROSTER (Aj: "i cant see who's in the room"). The relay keeps the host on the invite step, so the
   * branch that used to show who had arrived was never reached — Start Duel appearing was the only clue. */
  ok(await waitFor(()=>host.evaluate(()=>{ const s=document.querySelector('#netroot .lobbyStatus');
       return !!s && /\b1\b/.test(s.textContent) && /(here|connecting)/.test(s.textContent); }), 80, 250),
     'the host can SEE somebody is in the room from the moment the channel opens, not only once they confirm');
  ok(await host.evaluate(()=>/1 connected/.test((document.querySelector('#netroot .netbar')||{}).textContent||'')),
     '  → and the netbar counts them, rather than reporting 0 because nobody has confirmed yet');

  /* THE GHOST-SEAT GUARD (2026-08-28, from a real game). The host used to auto-mint a fresh offer after every
   * join, so the room ALWAYS had an open slot and anything that reloaded joined silently. Aj's phone had three
   * tabs; extra ones took slots, went dead, and Passo auto-passed for them — his "duel" was a three-seat game
   * waiting on a tab nobody was looking at, and the "Rival passed" in his opponent's log was Passo covering a
   * ghost. The copy-paste flow could never do this: a second player needed the host to hand over a new code.
   * TIMING IS THE WHOLE ASSERTION: this must run while the room is still OPEN. Starting the game drops the
   * room, so the same check afterwards returns 404 and passes on a build with the bug — which is exactly what
   * the first version of it did. */
  const second=await relayPost('/r/'+code+'/claim');
  ok(second.status===204,
     'while the room is still open, a SECOND claim finds nothing — a stray tab cannot silently take a seat'+
     (second.status===204?'':'  <-- REGRESSION: a slot is still on offer ('+second.status+')'));

  /* THE POINT OF THE VERSION: a real DataChannel, from four typed characters. */
  await startDuel(host, join);
  const snap=p=>p.evaluate(()=>({ boardUp:!!document.getElementById('hand'),
                                  hand:[].slice.call(document.querySelectorAll('#hand .card')).length }));
  ok(await waitFor(async()=>{const h=await snap(host), j=await snap(join); return h.boardUp&&j.boardUp&&h.hand===6&&j.hand===6;}, 100, 200),
     'a real WebRTC game connected and dealt six cards to both — from four typed characters, nothing pasted');


  /* Prove the claim was genuine and not a copy-paste fallback sneaking in: the joiner never touched #sigIn. */
  ok(await join.evaluate(()=>{ const t=document.getElementById('sigIn'); return !t || !t.value; }),
     '  → and the joiner\'s paste box was never used, so this really was the relay path');

  /* An SDP holds IP addresses, so the room should not outlive the handshake. Asserted against the relay itself. */
  ok(await waitFor(async()=>(await relayGet('/r/'+code+'/answers?since=-1')).status===404, 40, 250),
     'the room is deleted once the table is assembled — an SDP holds IP addresses and should not linger');

  await host.close(); await join.close();

  // ---------- the fallback, both ways it is reached
  const off=await ctx.newPage(); off.on('pageerror',e=>errs.push('norelay: '+e.message));
  await off.goto(url('rtcjoin','norelay=1')); await wait(900);
  ok(await off.evaluate(()=>!document.getElementById('roomIn') && !!document.getElementById('sigIn')),
     'norelay=1 gives exactly the old screen — a paste box and no room code');
  ok(await off.evaluate(()=>{ const b=document.querySelector('#netroot .netbar');
       return !!b && /no server/.test(b.textContent); }),
     '  → and the netbar says "no server" again, because with no relay in play that is once more the truth');
  await off.close();

  /* A DEAD relay is the case that matters most, because it is what the offline file with no network looks
   * like. It must degrade to the manual path, not to an error or a spinner. */
  const dead=await ctx.newPage(); dead.on('pageerror',e=>errs.push('dead: '+e.message));
  await dead.goto(url('rtchost','relay='+encodeURIComponent('http://127.0.0.1:8798'))); await wait(1200);
  ok(await waitFor(()=>dead.evaluate(()=>{const t=document.getElementById('sigOut'); return !!t && t.value.length>40;}), 60, 250),
     'an unreachable relay still produces a full invite code — the manual path is the floor, not a legacy branch');
  ok(await dead.evaluate(()=>!document.getElementById('roomCodeVal')),
     '  → and no room code is promised that cannot be delivered');
  await dead.close();

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); if(mock) mock.kill(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR '+(e&&e.stack||e)); if(mock) mock.kill(); process.exit(1); });
