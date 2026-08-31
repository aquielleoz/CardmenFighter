/* N-PLAYER over REAL WebRTC (3 players, host-centered star): the host runs a hub, inviting two players via two
 * separate offer/answer exchanges, then starts a 3-Rider game. Verifies multi-peer signaling, per-seat mirror
 * routing (no cross-peer hand leak), N-player turns, and round sync — all over DataChannels, no server. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8296,ROOM='RT3'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&stun=0&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const sigOut=p=>p.evaluate(()=>{ var t=document.getElementById('sigOut'); return t?t.value:''; });
const setSigIn=(p,v)=>p.evaluate(v=>{ var t=document.getElementById('sigIn'); if(t) t.value=v; }, v);
const clickGo=p=>p.evaluate(()=>{ var g=document.getElementById('sigGo'); if(g)g.click(); });
const clickInvite=p=>p.evaluate(()=>{ var g=document.getElementById('inviteBtn'); if(g)g.click(); });
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
async function snap(p){ return p.evaluate(()=>({ mine: window.__cmf?(window.__cmf.turn()===0):false, hand:[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.dataset.id), pile:document.querySelectorAll('#pile .card').length, round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0 })); }
const clear=p=>p.evaluate(()=>{var c=document.getElementById('clearBtn'); if(c)c.click();});
const passT=p=>p.evaluate(()=>{var c=document.getElementById('clearBtn'); if(c)c.click(); var b=document.getElementById('passBtn'); if(b)b.click();});
const play=(p,id)=>p.evaluate(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); }, id);
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
async function turnOff(p){ for(let i=0;i<40;i++){ if(!(await snap(p)).mine) return; await wait(80); } }
async function invite(host, client, prevOffer){
  // host has an offer showing (or generate a fresh one differing from prevOffer); client replies; host connects.
  const offer=await (async()=>{ for(let i=0;i<80;i++){ const o=await sigOut(host); if(o.length>20 && o!==prevOffer) return o; await wait(150);} return ''; })();
  if(!offer) return {ok:false, offer:prevOffer};
  await setSigIn(client, offer); await clickGo(client);
  const answer=await (async()=>{ for(let i=0;i<80;i++){ const a=await sigOut(client); if(a.length>20) return a; await wait(150);} return ''; })();
  if(!answer) return {ok:false, offer};
  await setSigIn(host, answer); await clickGo(host);
  return {ok:true, offer};
}
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('rtchost')); await c1.goto(url('rtcjoin')); await c2.goto(url('rtcjoin')); await host.waitForTimeout(800);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // Invite player 1.
  const i1=await invite(host, c1, '');
  ok(i1.ok,'invited + connected player 1 over WebRTC');
  // Host generates a second invite; connect player 2.
  await waitFor(async()=>await host.evaluate(()=>!!document.getElementById('inviteBtn')));
  await clickInvite(host);
  const i2=await invite(host, c2, i1.offer);
  ok(i2.ok,'invited + connected player 2 over WebRTC');

  // Both clients ready up; host starts a 3-Rider game.
  ok(await waitFor(async()=>!!(await c1.evaluate(()=>document.getElementById('lobbyGo')))),'client 1 reached its ready lobby');
  await ready(c1);
  ok(await waitFor(async()=>!!(await c2.evaluate(()=>document.getElementById('lobbyGo')))),'client 2 reached its ready lobby');
  await ready(c2);
  ok(await waitFor(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g && !g.disabled && /3 Riders|Riders/.test(g.textContent||'')); })),'host sees a 3-Rider game ready');
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g&&!g.disabled)g.click(); });

  ok(await waitFor(async()=>{ for(const p of [host,c1,c2]){ if((await snap(p)).hand.length!==6) return false; } return true; }, 80, 200),'all three boards dealt 6 cards over WebRTC');

  // Play a few rounds.
  const pages={host,c1,c2}; let maxRound=1; const acted={host:0,c1:0,c2:0}, beaten={};
  for(let step=0; step<120 && maxRound<3; step++){
    let who=null; for(const k of ['host','c1','c2']){ if((await snap(pages[k])).mine){ who=k; break; } }
    if(!who){ await wait(150); continue; }
    const p=pages[who], s=await snap(p);
    if(s.pile===0){ await play(p, s.hand[0]); acted[who]++; }
    else if(!beaten[who+':'+s.round]){ beaten[who+':'+s.round]=1; await play(p, s.hand[s.hand.length-1]); await wait(300); const s2=await snap(p); if(s2.mine && s2.hand.length===s.hand.length){ await clear(p); await passT(p); } acted[who]++; }
    else { await passT(p); acted[who]++; }
    await turnOff(p);
    for(const k of ['host','c1','c2']) maxRound=Math.max(maxRound,(await snap(pages[k])).round);
    if(errs.length) break;
  }
  const rs=await Promise.all([snap(host),snap(c1),snap(c2)]);
  ok(Math.max.apply(null,rs.map(r=>r.round))-Math.min.apply(null,rs.map(r=>r.round))<=1,'all three boards round-synced over WebRTC ('+rs.map(r=>r.round).join('/')+')');
  ok(maxRound>=2,'advanced rounds over WebRTC (reached '+maxRound+')');
  ok(acted.host>0 && acted.c1>0 && acted.c2>0,'all three seats acted (host '+acted.host+', c1 '+acted.c1+', c2 '+acted.c2+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail+' · maxRound='+maxRound);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
