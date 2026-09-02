/* N-PLAYER netplay (3 players) over BroadcastChannel: host + two clients share a room; each client picks a deck &
 * readies, the host starts a 3-Rider free-for-all. A patient bot drives whichever seat's turn it is on the real
 * board. Verifies seat assignment, per-seat mirrors, N-player turn routing, round advance, and cross-board sync. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8295),ROOM='T3'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function snap(p){ return p.evaluate(()=>({
  mine: window.__cmf ? (window.__cmf.turn()===0) : false,
  hand: [].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.dataset.id),
  pile: document.querySelectorAll('#pile .card').length,
  round: parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  finished: /win|knocked|defeat|victor/i.test((document.getElementById('turnTag')||{}).textContent||''),
})); }
const clear=p=>p.evaluate(()=>{var c=document.getElementById('clearBtn'); if(c)c.click();});
const passT=p=>p.evaluate(()=>{var c=document.getElementById('clearBtn'); if(c)c.click(); var b=document.getElementById('passBtn'); if(b)b.click();});
const play=(p,id)=>p.evaluate(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); }, id);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
async function turnOff(p){ for(let i=0;i<40;i++){ if(!(await snap(p)).mine) return; await wait(80); } }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await host.waitForTimeout(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // Lobby: both clients ready → host sees 2 joined → host starts a 3-Rider game.
  await ready(c1); await wait(300); await ready(c2);
  const hostSees2 = await waitFor(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g && !g.disabled && /3 Riders|Riders/.test(g.textContent||'')); }));
  ok(hostSees2,'host lobby shows a 3-Rider game ready to start');
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g&&!g.disabled)g.click(); });

  const dealt = await waitFor(async()=>{ for(const p of [host,c1,c2]){ const s=await snap(p); if(s.hand.length!==6) return false; } return true; }, 80, 200);
  ok(dealt,'all three boards dealt 6 cards');
  ok(await host.evaluate(()=>window.__cmfNetState?window.__cmfNetState:true) && await c1.evaluate(()=>!!window.__cmfNetState) && await c2.evaluate(()=>!!window.__cmfNetState),'both clients are running mirrors');

  // Play: drive whichever seat's turn it is. Beat once per player per round, else pass (bounds the war).
  const pages={host,c1,c2}; let maxRound=1; const acted={host:0,c1:0,c2:0}, beaten={};
  for(let step=0; step<140 && maxRound<4; step++){
    let who=null; for(const k of ['host','c1','c2']){ if((await snap(pages[k])).mine){ who=k; break; } }
    if(!who){ await wait(150); continue; }
    const p=pages[who], s=await snap(p);
    if(s.pile===0){ await play(p, s.hand[0]); acted[who]++; }
    else if(!beaten[who+':'+s.round]){ beaten[who+':'+s.round]=1; await play(p, s.hand[s.hand.length-1]); await wait(300);
      const s2=await snap(p); if(s2.mine && s2.hand.length===s.hand.length){ await clear(p); await passT(p); } acted[who]++; }
    else { await passT(p); acted[who]++; }
    await turnOff(p);
    for(const k of ['host','c1','c2']) maxRound=Math.max(maxRound,(await snap(pages[k])).round);
    if(errs.length) break;
  }
  const rs=await Promise.all([snap(host),snap(c1),snap(c2)]);
  ok(Math.max(rs[0].round,rs[1].round,rs[2].round)-Math.min(rs[0].round,rs[1].round,rs[2].round)<=1,'all three boards in round-sync ('+rs.map(r=>r.round).join('/')+')');
  ok(maxRound>=3,'advanced multiple rounds (reached '+maxRound+')');
  ok(acted.host>0 && acted.c1>0 && acted.c2>0,'all three seats took turns (host '+acted.host+', c1 '+acted.c1+', c2 '+acted.c2+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail+' · maxRound='+maxRound);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
