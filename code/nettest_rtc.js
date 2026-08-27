/* Full-UI netplay over REAL WebRTC (the internet path), automated end-to-end: drives the copy-paste offer/answer
 * signaling, waits for the DataChannel, then (a) exercises an INTERACTIVE WINDOW over the wire — the client Counters
 * the host's Technique — and (b) plays a couple of rounds. Verifies both ends stay in sync with no errors.
 * stun=0 (host candidates only) + mDNS disabled → the two tabs connect over loopback ICE, no external STUN/TURN. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8290,ROOM='R'+Date.now().toString().slice(-4);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&stun=0&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const sigOut=p=>p.evaluate(()=>{ var t=document.getElementById('sigOut'); return t?t.value:''; });
const setSigIn=(p,v)=>p.evaluate(v=>{ var t=document.getElementById('sigIn'); if(t){ t.value=v; } }, v);
const clickGo=p=>p.evaluate(()=>{ var g=document.getElementById('sigGo'); if(g)g.click(); });
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const modalUp=p=>p.evaluate(()=>document.getElementById('overlay').classList.contains('show'));
async function snap(p){ return p.evaluate(()=>({
  boardUp: !!document.getElementById('hand'),
  hand: [].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.dataset.id),
  yourTurn: /your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  pile: document.querySelectorAll('#pile .card').length,
  round: parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
})); }
const clear=p=>p.evaluate(()=>{var c=document.getElementById('clearBtn'); if(c)c.click();});
const passT=p=>p.evaluate(()=>{var c=document.getElementById('clearBtn'); if(c)c.click(); var b=document.getElementById('passBtn'); if(b)b.click();});
const play=(p,id)=>p.evaluate(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); }, id);
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,tries=80,ms=150){ for(let i=0;i<tries;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
async function waitTurnEnds(p){ for(let i=0;i<50;i++){ if(!(await snap(p)).yourTurn) return; await wait(80); } }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('rtchost')); await join.goto(url('rtcjoin')); await host.waitForTimeout(600);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // 1) Signaling: host offer → joiner answer → host accept.
  ok(await waitFor(async()=>(await sigOut(host)).length>20, 60, 200),'host generated an invite code (offer)');
  const offer=await sigOut(host);
  await setSigIn(join, offer); await clickGo(join);
  ok(await waitFor(async()=>(await sigOut(join)).length>20, 60, 200),'joiner generated a reply code (answer)');
  const answer=await sigOut(join);
  await setSigIn(host, answer); await clickGo(host);
  await startDuel(host, join);   // DataChannel opens → deck-picker lobby → client Ready, host Start
  ok(await waitFor(async()=>{ const h=await snap(host), j=await snap(join); return h.boardUp&&j.boardUp&&h.hand.length===6&&j.hand.length===6; }, 80, 200),'DataChannel opened and the real board dealt 6 cards on both ends');

  // 2) INTERACTIVE WINDOW over WebRTC: host casts Gather Energy (1D); the remote client Counters it (4D) over the DataChannel.
  ok(await turnOf(host)===0,'host leads round 1');
  const energy=[D(2,'D','e'),D(3,'D','e'),D(4,'C','e'),D(5,'H','e'),D(6,'S','e')];
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh:[D(1,'D'),D(3,'C'),D(6,'H')],rh:[D(4,'D'),D(5,'C'),D(7,'H')],he:energy,re:energy});
  await wait(500);
  await host.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="1D"]'); if(c)c.click(); var ca=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn'); if(ca&&ca.offsetParent!==null&&!ca.disabled)ca.click(); else if(ctx&&!ctx.disabled&&/Activate/i.test(ctx.textContent||''))ctx.click(); });
  ok(await waitFor(async()=>await modalUp(join), 50, 150),'client response modal appeared over WebRTC');
  const clicked=await join.evaluate(()=>{ var q=document.querySelector('.respQuick'); if(q){ q.click(); return true; } return false; });
  ok(clicked,'client sent a Counter over the DataChannel');
  /* POLL, never a fixed wait, for anything that has to cross the wire — a slow machine must make this suite
   * SLOWER, not red. This pair used to assert 1000ms after the client's click. */
  ok(await waitFor(async()=>await host.evaluate(()=>window.__cmf.pending())===false, 60, 150),
     'stack settled on the host after the wire Counter');
  ok(await waitFor(async()=>await host.evaluate(()=>/[Cc]ounter/.test((document.getElementById('log')||{}).textContent||'')), 40, 150),
     'host log records the counter');

  // 3) Core loop over the wire — a couple of rounds.
  let maxRound=(await snap(host)).round, hostPlayed=0, joinPlayed=0; const beaten={};
  for(let step=0; step<60 && maxRound<3; step++){
    let who=null; const h=await snap(host), j=await snap(join);
    if(h.yourTurn) who=['host',host]; else if(j.yourTurn) who=['join',join];
    if(!who){ await wait(150); continue; }
    const [role,p]=who; const s=await snap(p);
    if(s.pile===0){ await play(p, s.hand[0]); role==='host'?hostPlayed++:joinPlayed++; }
    else if(!beaten[role+':'+s.round]){ beaten[role+':'+s.round]=1; await play(p, s.hand[s.hand.length-1]); await wait(300);
      const s2=await snap(p); if(s2.yourTurn && s2.hand.length===s.hand.length){ await clear(p); await passT(p); } else { role==='host'?hostPlayed++:joinPlayed++; } }
    else { await passT(p); }
    await waitTurnEnds(p);
    maxRound=Math.max(maxRound,(await snap(host)).round,(await snap(join)).round);
    if(errs.length) break;
  }
  const hf=await snap(host), jf=await snap(join);
  ok(Math.abs(hf.round-jf.round)<=1,'host/client rounds in sync over WebRTC ('+hf.round+'/'+jf.round+')');
  ok(hostPlayed>0 && joinPlayed>0,'BOTH players acted over WebRTC (host '+hostPlayed+', client '+joinPlayed+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));

  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail+' · maxRound='+maxRound);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
