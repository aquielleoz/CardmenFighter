/* "NOT SYNCED" MUST BE SAID OUT LOUD (Aj, 2026-09-02: *"i think it's better to just warn the client that their
 * game has not synced instead of let them continue the game"*).
 *
 * WHAT THIS IS NOT: a check for gaps in the mirror sequence. A mirror is a full SNAPSHOT, not a delta, so any
 * later mirror makes a missed one irrelevant — warning on a gap would fire constantly on the render storm's
 * ordinary behaviour. That was the first design and it was wrong.
 * WHAT IT IS: this seat acted and nothing came back. The client already sets `busy` when it sends, so input is
 * ALREADY blocked — what was missing is any indication of WHY, which is exactly the "I pressed Pass and nothing
 * happened" report. The board is not slow, it is showing a state the host has not confirmed.
 *
 * Both directions are asserted, because a banner that never clears would pass the first half alone.
 * Run: node nettest_desync.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8443),ROOM='DS'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=140,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const view=p=>p.evaluate(()=>({
  bar:(()=>{const b=document.getElementById('disconBar'); return b&&b.classList.contains('show')?(b.textContent||'').trim():'';})(),
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  fightOff:!!(document.getElementById('fightBtn')||{}).disabled,
  passOff:!!(document.getElementById('passBtn')||{}).disabled,
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
}));

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
  ok(await until(async()=>(await view(host)).round>0), 'duel started');

  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await view(join)).yourTurn, 80), 'the turn reached the client');
  ok((await view(join)).bar==='', 'no banner while everything is normal');

  /* Swallow every mirror to this seat, then act. Forty is far more than the ~5s window needs — the point is
   * that NOTHING comes back, not that a particular number is lost. */
  await host.evaluate(()=>window.__cmf.dropMirrors(1,40));
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });

  const warned = await until(async()=>/not synced/i.test((await view(join)).bar), 80);
  ok(warned, 'the client is TOLD its board is unconfirmed'+(warned?'':'  ← it just sits there silently, which is the report'));
  const v = await view(join);
  ok(v.fightOff && v.passOff, '  → and it is not invited to keep playing on it  [fight '+(v.fightOff?'off':'ON')+', pass '+(v.passOff?'off':'ON')+']');

  /* THE OTHER DIRECTION. A warning that never lifts would satisfy everything above and be worse than none —
   * stop dropping, push one mirror, and require the banner to go. */
  await host.evaluate(()=>window.__cmf.dropMirrors(1,0));
  /* A REAL STATE CHANGE, not a bare re-render. `broadcastMirror` dedupes by CONTENT and the dropped sends had
   * already recorded that content as delivered (`lastMirror[s]` is set before the drop, modelling a host that
   * believes it sent) — so nothing goes out until the state actually moves. That is the same property
   * `reassertMirror` exists for at the park points, and it is why the first version of this assertion hung. */
  await host.evaluate(()=>{ try{ window.__cmf.forceAll(null,null,[4,2],{}); }catch(e){} });
  const cleared = await until(async()=>(await view(join)).bar==='', 80);
  ok(cleared, 'and the banner LIFTS as soon as a mirror lands'+(cleared?'':'  ← a stuck warning is worse than none'));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
