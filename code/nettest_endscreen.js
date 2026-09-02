/* THE END SCREEN, both halves — see the BACKLOG entries "A FINISHED NETPLAY GAME LEAVES ITS WIN PAGE BEHIND"
 * and "STARTING A NEW NETPLAY GAME DROPS YOU INTO THE PREVIOUS DUEL'S END SCREEN".
 *
 * Aj: *"you have to press leave then do the whole handshake thing again"*. The standing theory was a stale
 * `setTimeout` continuation surviving on the client because it never bumps `gen`. It was something plainer, and
 * a trace in `endGame` said so immediately: **`endGame` had no latch**, so in netplay it re-ran on EVERY
 * incoming mirror — measured on a real duel at 0.81s, 1.50s and 3.74s on the client, and again five seconds
 * later on the host. Pressing New Duel DOES open the setup dialog; ~1.8s later a re-entry painted the win
 * screen back over it.
 *
 * The latch then exposed a second bug it had been masking: `applyMirrorNow` calls `hideOverlay()` for anything
 * that is not an owed response window, so a mirror arriving after the finish WIPED the end screen — the
 * repeated `endGame` had simply been painting it back. Both are asserted here, because either fix alone leaves
 * a broken end screen.
 * Run: node nettest_endscreen.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8437),ROOM='ES'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=140,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const view=p=>p.evaluate(()=>({
  overlay:!!(document.getElementById('overlay')||{}).classList.contains('show'),
  head:((document.querySelector('#modal h2')||{}).textContent||'').trim(),
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  finished:window.__cmf?window.__cmf.finished():null,
}));
const endGameEntries=p=>p.evaluate(()=>{ try{ return window.__cmf.trace().filter(l=>/endGame/.test(l)); }catch(e){ return []; } });

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host'));
  /* openSetup auto-shows the rules ONCE per browser profile (`cmf_seen_help_v1`), which would sit on top of the
   * New Duel dialog and make the assertion below read the wrong heading. Seed it — a real player sees this once
   * and never again, so asserting around it would be asserting a first-run artifact. */
  await host.evaluate(()=>{ try{ localStorage.setItem('cmf_seen_help_v1','1'); }catch(e){} });
  await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await view(host)).round>0), 'duel started');

  // round 1 is jabs only — reach round 2 before staging a pair (nettest_kick's lesson)
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  await until(async()=>(await view(join)).yourTurn, 80);
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  ok(await until(async()=>(await view(host)).round>=2, 120), 'round 2 reached, so Specials are unlocked');

  // the client at ZERO shields, so the host's pair lands the Fighter Kick and the duel ends
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(9,'D','h'),C(9,'H','h'),C(4,'C','h'),C(5,'S','h')],
                       [C(3,'D','c'),C(6,'H','c'),C(7,'C','c'),C(8,'S','c')], null,null, 4, 0);
  });
  await wait(600);
  await host.evaluate(()=>{ ['h9D','h9H'].forEach(id=>{const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click();});
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  await until(async()=>(await view(join)).yourTurn, 80);
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  ok(await until(async()=>(await view(host)).finished===true, 140), 'the duel finished on the host');
  ok(await until(async()=>(await view(join)).finished===true, 100), 'and on the client');
  ok(await until(async()=>(await view(join)).overlay===true, 80), 'the client is shown its end screen');

  /* ── HALF ONE: the end screen must SURVIVE the mirrors that keep arriving after the finish. Four seconds is
   * several mirrors; before the fix `hideOverlay()` wiped it on the first one and only a re-entered `endGame`
   * painted it back. */
  await wait(4000);
  const jv = await view(join);
  ok(jv.overlay===true && /Wins|WIN/i.test(jv.head),
     'the client STILL has its end screen four seconds later  [overlay '+jv.overlay+', "'+jv.head+'"]');

  /* ── HALF TWO: `endGame` runs ONCE. The trace records every entry and marks the ignored ones, so this counts
   * real entries rather than inferring them. */
  const hostEG = (await endGameEntries(host)).filter(l=>!/ALREADY SHOWN/.test(l));
  const joinEG = (await endGameEntries(join)).filter(l=>!/ALREADY SHOWN/.test(l));
  ok(hostEG.length===1, 'endGame ran exactly once on the host  (got '+hostEG.length+')');
  ok(joinEG.length===1, 'endGame ran exactly once on the client  (got '+joinEG.length+')');

  /* ── HALF THREE: the report itself. New Duel must open AND STAY — the re-entry landed ~1.8s later, so a check
   * that reads the dialog immediately would pass on the broken build. */
  await host.evaluate(()=>{ const b=document.getElementById('againBtn'); if(b)b.click(); });
  ok(await until(async()=>/New Duel/i.test((await view(host)).head), 40), 'New Duel opens on the host');
  /* A REGRESSION GUARD, NOT A DISCRIMINATOR — said plainly because the difference matters. The host's late
   * re-entry was observed at +5.15s on a real duel (and clobbered the dialog ~1.8s after the click), but I
   * could not make it fire on demand: `endGame` is reached from the turn drivers and the mirror path, not from
   * a bare render, so provoking one with `forceAll` does not reproduce it and this assertion passes on the
   * broken build too. **The discriminating evidence for the latch is the endGame COUNT above** (host 2 and
   * client 3 without it, 1 and 1 with). This one guards the user-visible symptom in case another path reaches
   * `endGame` later; do not read it as proof. */
  await host.evaluate(()=>{ try{ window.__cmf.forceAll(null,null,null,{}); }catch(e){} });
  await wait(1200);
  const hv = await view(host);
  ok(/New Duel/i.test(hv.head),
     'and it is STILL open three seconds later, not painted over by the win screen  [saw "'+hv.head+'"]'+
     (/WIN|Wins/i.test(hv.head)?'  ← REPRODUCED: endGame re-entered and clobbered it':''));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
