/* THE PLAYTEST RECORD OVER NETPLAY (v1.31.13). A client never runs the drivers that count opponents' plays —
 * every bumpFight/bumpEffect call site is in the local drivers — so a client writing its own record would
 * store a game with every opponent at zero. Aj's call: the HOST broadcasts its finished record at game end and
 * clients adopt it, so every seat keeps the same canonical game. The payload is public (plays, never hands).
 *
 * CAREFUL, and this invalidated the first version of this suite: both netplay pages share ONE browser context
 * and therefore ONE localStorage, so reading the games list cannot tell the host's write from the client's —
 * every assertion about "the client's store" passed trivially against the host's own record. The client's
 * adoption is verified through the `__cmf.adopted()` seam instead, which is page-local.
 * Run: node nettest_record.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8317,ROOM='RC'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'application/javascript'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const games=p=>p.evaluate(()=>{ try{ return JSON.parse(localStorage.getItem('cmf_games_v1')||'[]'); }catch(e){ return []; } });
const finished=p=>p.evaluate(()=>{ const st=window.__cmfNetState||null; return !!(st&&st.finished); });
async function waitFor(fn,t=200,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await wait(1200);
  await host.evaluate(()=>{ try{ localStorage.removeItem('cmf_games_v1'); }catch(e){} });
  await join.evaluate(()=>{ try{ localStorage.removeItem('cmf_games_v1'); }catch(e){} });
  await startDuel(host, join);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  ok(await waitFor(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'online duel started');

  /* End it fast and for real: hand the host a winning position on the host's authoritative state, then let the
   * normal flow run to the game-over overlay so endGame() — and therefore the record — actually fires. */
  await host.evaluate(()=>{
    const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
    window.__cmf.forceAll([[D(9,'S'),D(9,'H'),D(4,'C')],[D(3,'D'),D(4,'H'),D(5,'C')]],
                          [Array.from({length:10},(_,i)=>D(4,'S','e'+i)), []], [4,0], {round:3, turn:0});   // client at 0: the next Special win is the KICK
  });
  await wait(600);
  // host plays its pair; the client can't answer, so the round resolves and strips the last shield
  await host.evaluate(()=>{ const clr=document.getElementById('clearBtn'); if(clr)clr.click();
    ['9S','9H'].forEach(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); });
    const f=document.getElementById('fightBtn'); if(f&&!f.disabled){ f.click(); if(/Confirm/i.test(f.textContent||'')&&!f.disabled) f.click(); } });
  for(let i=0;i<60;i++){
    await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled) b.click();
      const d=document.getElementById('sgNo')||document.getElementById('respDecline')||document.getElementById('pfDecline'); if(d)d.click(); });
    if(await host.evaluate(()=>document.getElementById('overlay').classList.contains('show'))) break;
    await wait(200);
  }
  const ended=await waitFor(async()=>(await games(host)).length>0, 60);
  ok(ended, 'the host wrote a record when the game ended');

  const hg=await games(host);
  ok(hg.length===1, 'exactly one record was written for the game ('+hg.length+')');

  // The client's ADOPTION, read from the page itself — not from the shared storage.
  const got=await waitFor(async()=>!!(await join.evaluate(()=>window.__cmf.adopted())), 60);
  ok(got, 'the CLIENT adopted the host\'s record — this is the fix');
  const jr=await join.evaluate(()=>window.__cmf.adopted());
  ok(!!jr && jr.ts===hg[0].ts, 'and it is the HOST\'s record (same timestamp) — one canonical game, not two views');
  ok(!!jr && Array.isArray(jr.seats) && jr.seats.length>=2, 'the adopted record carries per-seat data ('+((jr&&jr.seats)?jr.seats.length:0)+' seats)');
  /* The decisive check. In the adopted record, seat 0 is the HOST — the client's OPPONENT — and the host
   * played a pair to win. A client-written record counts only its own plays, so this would be 0. */
  const hostSeat = jr && jr.seats && jr.seats[0];
  const oppFights = hostSeat ? (hostSeat.jabs + hostSeat.specials) : 0;
  ok(oppFights>0, 'it contains the HOST\'s plays — data a client-written record could not have ('+oppFights+')');
  ok(!!jr && jr.adoptedBySeat===1, 'the adopter stamps its OWN seat, so analysis cannot mistake a client copy for the host\'s (adoptedBySeat='+(jr&&jr.adoptedBySeat)+')');
  ok(!!jr && jr.yourSeat===0, 'while `yourSeat` still names the AUTHOR (the host), stored verbatim');
  ok(!!jr && jr.v==='2.1-mp', 'and it keeps the v2.1-mp schema ("'+((jr&&jr.v)||'(none)')+'")');
  ok(await host.evaluate(()=>!window.__cmf.adopted()), 'the HOST adopted nothing — it authored its own');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
