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
  /* STAGED WHERE MIRRORS ACTUALLY FLOW. The first version of this ran right after the deal, when the host
   * holds the turn and is not parked — so nothing was being broadcast and the modal survived WITH OR WITHOUT
   * the fix: an assertion that could not fail. The host parks the moment it hands the turn over, and its
   * heartbeat then re-asserts every 1.8s, which is the condition Aj hit.
   * A DIALOG THE PLAYER OPENED MUST SURVIVE THAT (Aj: *"concede modal closes too fast on client
   * side even without clicking anything"*). Mirrors arrive constantly in netplay — every 1.8s even on a parked
   * host — and `applyMirrorNow` closes anything not on its owed-window list. Four seconds is several mirrors. */
  await join.evaluate(()=>{ const b=document.getElementById('newBtn'); if(b)b.click(); });
  /* CHECK THE OVERLAY, NOT THE HEADING. `hideOverlay()` only removes the `show` class — `#modal`'s innerHTML
   * stays exactly where it was — so a heading test passes on a modal nobody can see, and this assertion was
   * green with the fix removed. Third time today an assertion read something that outlives the thing under
   * test (the spent 8♣ back in hand, the round number advancing before the trim, and now this). */
  const shown = async()=>{ const v=await view(join); return v.overlay && /Concede this/i.test(v.head); };
  const conceOpen = await until(shown, 40);
  ok(conceOpen, 'the client can open the concede confirm');
  await wait(4000);
  const stillOpen = await shown();
  ok(stillOpen, 'and it is STILL open after several mirrors, not wiped by one'+
                (stillOpen?'':'  ← REPRODUCED: applyMirrorNow closed a dialog the player opened'));
  await join.evaluate(()=>{ const b=document.getElementById('cancelCon'); if(b)b.click(); });
  ok(await until(async()=>!(await view(join)).overlay, 40), '  → and "Keep playing" still closes it');

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
  /* ONLINE IT MUST NOT BE THE SOLO SETUP (v1.31.92). Not merely the wrong dialog: nothing guards `commitSetup`,
   * so pressing Go there would start a LOCAL solo game while `role` is still 'host', and the host would keep
   * broadcasting mirrors of a game the client is not in. */
  ok(await until(async()=>/New online game/i.test((await view(host)).head), 40), 'online, New Duel offers the ONLINE path, not the solo setup');
  ok(await host.evaluate(()=>!!document.getElementById('againLeave')), '  → and offers Leave online, the one route that works today');
  ok(await host.evaluate(()=>!document.getElementById('setPlayers')), '  → with no solo deck/difficulty pickers, which would do nothing here');
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
  ok(/New online game/i.test(hv.head),
     'and it is STILL open three seconds later, not painted over by the win screen  [saw "'+hv.head+'"]'+
     (/WIN|Wins/i.test(hv.head)?'  ← REPRODUCED: endGame re-entered and clobbered it':''));

  /* ── HALF FOUR: THE OLD GAME IS GONE, NOT MERELY COVERED (Aj: *"why is the previous game still there in the
   * back?"*). Until `clearBoard()` there was no teardown at all — `state` was assigned when a game began and
   * never cleared, so a finished board sat behind whatever floated on top of it, and `leaveOnline` "worked"
   * only because it reloads the page. Asserting the CARDS are gone, not that something covers them. */
  /* AND THE SOLO FUNNEL STILL TEARS THE GAME DOWN (the v1.31.90 guard). Online now routes to Leave instead, and
   * the board deliberately stays behind that confirm so "← Back" returns you to your end screen — so this drives
   * `openSetup()` directly through the dbg surface. Two earlier attempts were worse: calling it as a global
   * silently threw (it is inside the closure) and asserted against an untouched board, and asserting after a
   * page reload would only prove that reloading clears the DOM. */
  await host.evaluate(()=>{ try{ window.__cmf.openSetup(); }catch(e){} });
  await wait(400);
  const behind = await host.evaluate(()=>({
    hand:document.querySelectorAll('#hand .card').length,
    pile:document.querySelectorAll('#pile .card').length,
    forms:document.querySelectorAll('#youFormZone *, #rivalFormZone *').length,
  }));
  ok(behind.hand===0 && behind.pile===0 && behind.forms===0,
     'the solo funnel tears the finished board down    [hand '+behind.hand+', pile '+behind.pile+', forms '+behind.forms+']');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
