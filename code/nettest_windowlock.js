/* A TURN OP WHILE SOMEBODY ELSE HOLDS PRIORITY IS REFUSED, AND THE GUEST'S BOARD LOCKS (drag-and-stack step 4, piece 9).
 *
 * Found by `nettest_parity`'s Yes leg, 1 duel in 6: the guest, on its own turn in Main, passed; the Main → Fight
 * crossing opened, and the HOST — holding Leyline — held priority. The guest's board stayed LIVE (it locked only for a
 * ROUND window), so its driver pressed Pass again every 330ms, and each `op:'pass'` reached the host's crossing branch,
 * where `E.moveToPlay` (which never looks at `respondFor`) re-opened the go-round with a FRESH GRANT. The host's own
 * window was re-granted faster than it could be answered, and the table sat there for a hundred seconds.
 * TWO HALVES, BOTH PINNED, because either alone leaves the loop reachable: the host REFUSES a turn op while a window is
 * open (the authority — a client's gate is a courtesy, and an older client has none), and the guest's board LOCKS
 * while another seat holds priority (the courtesy copy, so a player is never offered a press that will be refused).
 *   A  STAGED: the guest leads a jab; the crossing opens and the HOST holds priority (its box is up)
 *   B  the guest's board is LOCKED while the host decides: a card selected, and Fight and Pass stay off
 *   C  a second play sent RAW (a double press, an older client) is REFUSED: the host names it in its trace, no new
 *      grant (the host's window was shown once), and the guest is told
 *   D  …and the first play is untouched: once the host says No, it lands
 *
 * Run: node nettest_windowlock.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8491),ROOM='WL'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

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
  await until(()=>host.evaluate(()=>!/show/.test((document.getElementById('roundfx')||{}).className||'')), 80);
  /* netwindows would answer the host's box after its grace; this suite answers it itself, so give it all the time */
  await host.evaluate(()=>{ if(window.__nw) window.__nw.grace=600000; });
  await join.evaluate(()=>{ if(window.__nw) window.__nw.grace=600000; });
  const trace=()=>host.evaluate(()=>(window.__cmf.trace?window.__cmf.trace():[]).join('\n'));
  const shown=()=>host.evaluate(()=>(window.__cmf.prioLog?window.__cmf.prioLog():[]).filter(l=>/window SHOWN to you/.test(l)).length);
  const hostBox=()=>host.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent!==null); });

  // the host holds Leyline and the ♦ to cast it; the guest leads round 3 with a hand of plain fight cards
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(9,'D','hL'),C(3,'C','h'),C(4,'S','h')], [C(7,'S','g'),C(8,'H','g'),C(5,'C','g')]], [E('D','he'), E('C','ge')], null, {round:3, turn:1}); });
  await until(()=>join.evaluate(()=>window.__cmf.turn()===0 && !!document.querySelector('#hand .card[data-id="g7S"]')), 60);
  // A
  const s0=await shown();
  await join.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="g7S"]'))[0]; if(g) g.click(); });
  await wait(250);
  await join.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f && !f.disabled) f.click(); });
  const up=await until(hostBox, 80);
  ok(up && (await shown())===s0+1, 'A · STAGED: the guest led a jab, the crossing opened, and the HOST holds priority — its box is up');
  // B
  await until(()=>join.evaluate(()=>window.__cmfNetState && window.__cmfNetState.respondFor===1), 40);
  const lockB=await join.evaluate(()=>{ const g=document.querySelector('#hand .group'); if(g) g.click();
    const f=document.getElementById('fightBtn'), p=document.getElementById('passBtn');
    const r={ fightOff:!!(f && f.disabled), passOff:!!(p && p.disabled), rf:window.__cmfNetState.respondFor, hint:((document.getElementById('hint')||{}).textContent||'').trim() };
    [].slice.call(document.querySelectorAll('#hand .group.gsel')).forEach(x=>x.click()); return r; });
  ok(lockB.fightOff && lockB.passOff && /is deciding/.test(lockB.hint), 'B · THE GUEST\'S BOARD IS LOCKED while the host decides — a card selected, Fight and Pass stay off, and the hint names who it waits on  '+JSON.stringify(lockB));
  // C
  const t0=(await trace()).split('\n').length;
  await join.evaluate(()=>window.__cmf.clientSend({op:'play', ids:['g8H']}));
  const refused=await until(async()=>/move REFUSED — a window is open/.test((await trace()).split('\n').slice(t0-1).join('\n')), 40);
  await wait(500);
  const told=await join.evaluate(()=>/still deciding/.test((document.getElementById('message')||{}).textContent||''));
  const sC=await shown();
  ok(refused && sC===s0+1 && await hostBox(), 'C · A SECOND PLAY SENT RAW IS REFUSED — named in the host\'s trace, and NO new grant: the host\'s window was shown once  '+JSON.stringify({refused, shownSince:sC-s0}));
  ok(told, '  …and the guest is told why');
  // D
  await host.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d && d.offsetParent) d.click(); });
  const landed=await until(()=>host.evaluate(()=>[...document.querySelectorAll('#pile .card')].some(c=>c.getAttribute('data-id')==='g7S')), 60);
  const extra=await host.evaluate(()=>[...document.querySelectorAll('#pile .card')].some(c=>c.getAttribute('data-id')==='g8H'));
  ok(landed && !extra, 'D · THE FIRST PLAY IS UNTOUCHED — once the host says No, the 7♠ lands, and the refused 8♥ does not');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
