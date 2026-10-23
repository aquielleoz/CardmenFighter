/* A DUEL GUEST WHO CANNOT DRAW LOSES, AND BOTH SCREENS SAY SO (v1.37.0; this was `nettest_drawfizzle`).
 *
 * Aj, 2026-10-23: *"deck out are game loss... regardless of shield count"*. The draw at the start of a round used to
 * FIZZLE for a seat whose deck and Shuffle Pile were both empty, and this suite asserted that a guest was told so
 * ("Draw fizzled for You", with advice to recycle). That line no longer exists: the first card a seat cannot draw puts
 * it out, and in a duel that is the game. Same staging, the new claims: the guest decks out, the host WINS with the
 * guest's shields still up, each screen names the deck-out in its own frame, and neither says "fizzled".
 *
 * Run: node nettest_deckoutduel.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { clickFight, clickPass } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8463),ROOM='DO'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const logOf=p=>p.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>host.evaluate(()=>document.querySelectorAll('#hand .card').length>0)), 'duel started');

  // the CLIENT's deck and shuffle pile are empty; the host leads a 3 the client cannot answer, so the round ends
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.forceAll([[C(13,'D','h'),C(5,'H','h'),C(6,'S','h')], [C(3,'S','c'),C(4,'H','c'),C(4,'C','c')]], null, null,
      {round:1, turn:0, deck:[[C(7,'D','hd'),C(8,'D','hd'),C(9,'D','hd'),C(7,'H','hd')], []], shuffle:[[],[]]}); });
  await wait(600);
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h13D"]'); if(c) c.click(); });
  await clickFight(host);
  ok(await until(()=>join.evaluate(()=>window.__cmf.turn()===0), 80), 'the host led a King and the turn reached the client');
  /* FILM EACH SEAT'S ROUND CARD (v1.33.0): its title and subtitle, as shown. */
  const filmRoundCards=()=>{ window.__rf=[]; const fx=document.getElementById('roundfx');
    new MutationObserver(()=>{ const r=fx.querySelector('.rfRound'), s=fx.querySelector('.rfSub');
      if(r&&s){ const t=r.textContent+' | '+s.textContent; if(window.__rf[window.__rf.length-1]!==t) window.__rf.push(t); } })
      .observe(fx,{subtree:true,childList:true,characterData:true}); };
  await clickPass(join);
  const joinOut=await until(async()=>/You decked out — could not draw a card\./.test(await logOf(join)), 120);
  const jl=await logOf(join), hl=await logOf(host);
  ok(joinOut, 'the GUEST reads its own deck-out: "You decked out — could not draw a card."'+(joinOut?'':'  ← '+(/fizzled/.test(jl)?'REPRODUCED: the draw just fizzled':'no line')));
  ok(/Rival 2 decked out — could not draw a card\./.test(hl), 'the HOST reads it about the guest, in its own frame ("Rival 2 decked out — could not draw a card.")');
  if(!joinOut || !/Rival 2 decked out/.test(hl)) console.log('   WHY: guest log tail '+JSON.stringify(jl.split('\n').slice(-6))+'\n        host log tail '+JSON.stringify(hl.split('\n').slice(-6)));
  ok(!/fizzled/i.test(jl) && !/fizzled/i.test(hl), 'neither screen says the draw "fizzled" — a missed draw is a deck-out now');
  const endUp=await until(async()=>(await host.evaluate(()=>{ const m=document.getElementById('modal'); return !!m && !!m.offsetParent && /WIN/.test(m.textContent); })) &&
                                  (await join.evaluate(()=>{ const m=document.getElementById('modal'); return !!m && !!m.offsetParent && /Wins/.test(m.textContent); })), 120);
  const hEnd=await host.evaluate(()=>((document.querySelector('#modal h2')||{}).textContent||'').trim()), jEnd=await join.evaluate(()=>((document.querySelector('#modal h2')||{}).textContent||'').trim());
  ok(endUp, 'the duel is OVER on both screens: the host reads "'+hEnd+'", the guest "'+jEnd+'"');
  const hs=await host.evaluate(()=>({ fin:!!window.__cmf.finished(), w:window.__cmf.winner(), sh:window.__cmf.shieldsOf(1) }));
  ok(hs.fin && hs.w===0 && hs.sh>0, 'the host\'s engine: finished, the host won, and the guest still had shields ('+hs.sh+') — a deck-out ignores them  '+JSON.stringify(hs));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
