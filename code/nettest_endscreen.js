/* THE END SCREEN, all three halves — see the BACKLOG entries "A FINISHED NETPLAY GAME LEAVES ITS WIN PAGE BEHIND",
 * "STARTING A NEW NETPLAY GAME DROPS YOU INTO THE PREVIOUS DUEL'S END SCREEN", and (v1.31.95) "★ BACK TO THE LOBBY
 * AFTER AN ONLINE GAME".
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
 *
 * HALF THREE (v1.31.95) IS THE ROUND TRIP. The host's end-screen button reopens the LOBBY for the whole table:
 * connections kept, every seat re-claimed with Ready (which is how a deck is re-picked), a second game dealt and
 * played a full round. The client's button ASKS — the 🔄 emote — and that emote used to be dropped by the host the
 * moment a game was finished, which this suite asserts in both directions. Every visibility claim is a HIT-TEST:
 * `#netroot` exists from the first lobby onward and `.overlay` outranks it, so neither presence nor display alone
 * can tell a lobby from an end screen left on top of one.
 * Run: node nettest_endscreen.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8437),ROOM='ES'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=200,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const view=p=>p.evaluate(()=>({
  overlay:!!(document.getElementById('overlay')||{}).classList.contains('show'),
  head:((document.querySelector('#modal h2')||{}).textContent||'').trim(),
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  finished:window.__cmf?window.__cmf.finished():null,
}));
const endGameEntries=p=>p.evaluate(()=>{ try{ return window.__cmf.trace().filter(l=>/endGame/.test(l)); }catch(e){ return []; } });
const traceOf=p=>p.evaluate(()=>{ try{ return window.__cmf.trace(); }catch(e){ return []; } });
const liveLog=p=>p.evaluate(()=>window.__cmf.log());
const lastLog=p=>p.evaluate(()=>window.__cmf.lastLog());
const netText=p=>p.evaluate(()=>(document.getElementById('netroot')||{}).textContent||'');
/* DOM PRESENCE IS NOT VISIBILITY. `#netroot` is created by NET.start and merely hidden for the game, and `.overlay`
 * is `--zNetroot + 1`, so a lobby with an end screen still on top of it passes a display check. Hit-test the centre. */
const lobbyVisible=p=>p.evaluate(()=>{ const nr=document.getElementById('netroot'); if(!nr) return false;
  if(getComputedStyle(nr).display==='none') return false;
  const el=document.elementFromPoint(Math.floor(innerWidth/2), Math.floor(innerHeight/2));
  return !!(el && nr.contains(el)); });
const boardCards=p=>p.evaluate(()=>({ hand:document.querySelectorAll('#hand .card').length, pile:document.querySelectorAll('#pile .card').length,
                                      forms:document.querySelectorAll('#youFormZone *, #rivalFormZone *').length }));
const click=(p,id)=>p.evaluate(id=>{ const b=document.getElementById(id); if(b && !b.disabled){ b.click(); return true; } return false; }, id);

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
  /* Game one on a NAMED deck, so game two can be given a DIFFERENT one and the re-pick has something to change. */
  const labelOf=await join.evaluate(()=>{ const o={}; [].forEach.call(document.querySelectorAll('#deckSel option'), x=>{ o[x.value]=x.textContent.trim(); }); return o; });
  await startDuel(host, join, { clientDeck:'Wizard' });
  ok(await until(async()=>(await view(host)).round>0), 'duel started');
  ok(await join.evaluate(l=>document.getElementById('youDeckName').textContent.trim()===l, labelOf.Wizard), 'the client plays the deck it picked (Wizard)');

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

  /* ── HALF THREE: THE ROUND TRIP (v1.31.95). The end screen says what it does, and does it. */
  const btn=p=>p.evaluate(()=>((document.getElementById('againBtn')||{}).textContent||'').trim());
  ok(/Back to the lobby/.test(await btn(host)), 'the HOST\'s end-screen button reads "↩ Back to the lobby"  ["'+(await btn(host))+'"]');
  ok(/Ask for a rematch/.test(await btn(join)), 'the CLIENT\'s reads "🔄 Ask for a rematch" — it cannot move the table, so it asks  ["'+(await btn(join))+'"]');
  ok(await host.evaluate(()=>!!document.getElementById('endLeaveBtn') && !document.getElementById('setPlayers')),
     '  → the end screen offers "← Leave online" and no solo pickers, which would do nothing here');

  /* THE ASK MUST REACH THE HOST — and it did not, on every build before this one: `hostApplyMove*` return on
   * `hostState.finished` BEFORE their emote line, so a client's 🔄 from its end screen was dropped silently. Read
   * the count FIRST and require it to go 0 → 1, so a line already present cannot pass this. */
  const asks=async p=>(await liveLog(p)).filter(l=>/wants a rematch/.test(l)).length;
  ok((await asks(host))===0, 'no rematch line on the host yet (so the next assertion cannot pass vacuously)');
  ok(await click(join,'againBtn'), 'the client asks for a rematch');
  ok(await until(async()=>(await asks(host))===1, 60), 'the host\'s log gains the ask — the emote is HEARD from behind a finished game'+
     ((await asks(host))===1?'':'  ← REPRODUCED: the drivers dropped it on hostState.finished'));
  ok(await host.evaluate(()=>/wants a rematch/.test((document.getElementById('rematchAsk')||{}).textContent||'')),
     '  → and the host\'s END SCREEN names the asker (the overlay covers the bubble and the log)');
  ok(/Asked/.test(await btn(join)), '  → and the client\'s button reads "✓ Asked" — one-shot, so a swallowed second tap cannot lie');

  /* Captured BEFORE the host acts: the client's last applied mirror (a finished game) — the very thing a straggler
   * would carry. `__cmfNetState` is nulled on the lobby return, so this is the only moment to take it. */
  const stale=await join.evaluate(()=>window.__cmfNetState);
  ok(!!(stale && stale.finished), 'staged: the client holds game one\'s finished mirror to replay as a straggler');
  const clientLogBefore=(await liveLog(join)).length;

  ok(await click(host,'againBtn'), 'the host presses ↩ Back to the lobby');
  ok(await until(()=>lobbyVisible(host), 60), 'the host\'s LOBBY is on screen — hit-tested, not merely present');
  const hb=await boardCards(host), hv=await view(host);
  ok(hb.hand===0 && hb.pile===0 && hb.forms===0 && hv.finished===null,
     '  → and the finished board is torn down, state included  [hand '+hb.hand+', pile '+hb.pile+', forms '+hb.forms+', state '+(hv.finished===null?'null':'present')+']');
  const ht=await netText(host);
  ok(/Back in the lobby/.test(ht) && /You won the last game/.test(ht), '  → the lobby says it is a RETURN and who won  ["'+(ht.match(/↩[^]*?seat\./)||[''])[0].slice(0,90)+'…"]');
  ok(await host.evaluate(()=>{ const g=document.getElementById('lobbyGo'); return !!(g && g.disabled); }) && /Waiting for players/.test(ht),
     '  → Start is DISABLED until a seat is re-claimed: every seat must press Ready again (that is how a deck is re-picked)');
  ok(await host.evaluate(()=>/← Leave/.test((document.getElementById('newBtn')||{}).textContent||'')), '  → the header button reads "← Leave" (render() returns on a null state, so this had to be repainted explicitly)');

  ok(await until(()=>lobbyVisible(join), 60), 'the CLIENT lands in the lobby too — the host told it to'+
     ((await lobbyVisible(join))?'':'  ← nothing told the client to come back'));
  const jt=await netText(join);
  const jl=await join.evaluate(()=>({ ready:/Ready/.test((document.getElementById('lobbyGo')||{}).textContent||''), unready:!!document.getElementById('lobbyUnready'),
                                      pickerOn:!(document.getElementById('deckSel')||{disabled:true}).disabled, save:!!document.getElementById('lobbySaveLog') }));
  ok(jl.ready && !jl.unready && jl.pickerOn, '  → un-readied: "Ready ▶" is offered, no "↩ Not ready", and the deck picker is LIVE  ['+JSON.stringify(jl)+']');
  ok(/Back in the lobby/.test(jt) && /Rival won the last game/.test(jt), '  → and it is told who won, reader-relative ("Rival won")');
  ok(jl.save && await host.evaluate(()=>!!document.getElementById('lobbySaveLog')), '  → both lobbies offer "⤓ Save the last battle log"');
  const jLast=await lastLog(join), hLast=await lastLog(host);
  ok(jLast.length>=clientLogBefore && /Rival reopened the lobby/.test(jLast[jLast.length-1]||''),
     'the client\'s stashed log ends with "Rival reopened the lobby" — said BEFORE started flipped, or nobody hears it  [last: "'+(jLast[jLast.length-1]||'')+'"]');
  ok(/You reopened the lobby/.test(hLast[hLast.length-1]||''), '  → the host\'s ends with "You reopened the lobby" (the same template, each end\'s own frame)');
  ok((await liveLog(join)).length===0 && (await liveLog(host)).length===0, '  → and both LIVE logs are empty — game two starts clean on both ends (a client never runs startGame)');

  /* THE STRAGGLER. Hand the client game one's finished mirror through the REAL handler. Without the guard,
   * applyMirrorNow sets started=true, re-installs the dead state, hides the lobby and paints the end screen back.
   * The TRACE clause proves the message reached the handler — three green negatives on an inject that did nothing
   * would prove nothing. */
  await join.evaluate(s=>window.__cmf.inject({t:'mirror', seat:0, q:null, bs:'x', st:s}), stale);
  await wait(500);
  const sv=await view(join);
  ok(await lobbyVisible(join) && sv.finished===null && (await boardCards(join)).hand===0,
     'a straggler mirror of game one is IGNORED in the lobby — the client stays put'+
     ((await lobbyVisible(join))?'':'  ← REPRODUCED: the stale mirror dragged the client back onto the dead board'));
  const tr=await traceOf(join), lobbyAt=tr.findIndex(l=>/lobby IN/.test(l));
  ok(lobbyAt>=0 && tr.slice(lobbyAt).some(l=>/mirror IGNORED — in the lobby/.test(l)), '  → and the trace says it was refused, not lost');
  ok(lobbyAt>=0 && !tr.slice(lobbyAt).some(l=>/mirror APPLIED/.test(l)), '  → no mirror has been APPLIED since the lobby returned');

  /* RE-PICK AND RE-READY. The deck travels on t:'join', so Ready is both consent and the re-pick. */
  await join.evaluate(()=>{ const s=document.getElementById('deckSel'); s.value='Rogue'; s.dispatchEvent(new Event('change')); });
  ok(await click(join,'lobbyGo'), 'the client picks Rogue and presses Ready');
  ok(await until(()=>host.evaluate(()=>{ const g=document.getElementById('lobbyGo'); return !!(g && !g.disabled); }), 60), 'the host can start again — the seat was re-claimed');
  ok(await until(async()=>/you are Player 2/i.test(await netText(join)), 40), '  → the client was re-welcomed into a seat (Player 2)');
  ok(await click(host,'lobbyGo'), 'the host starts game two');
  ok(await until(async()=>(await view(host)).round>0 && (await view(join)).round>0, 100), 'game two is dealt on both ends');
  ok(await host.evaluate(()=>getComputedStyle(document.getElementById('netroot')).display==='none') &&
     await join.evaluate(()=>getComputedStyle(document.getElementById('netroot')).display==='none'), '  → and both lobbies are hidden again');
  const yd=await join.evaluate(()=>document.getElementById('youDeckName').textContent.trim());
  ok(yd===labelOf.Rogue && yd!==labelOf.Wizard, '  → the client plays the deck it RE-PICKED  ["'+yd+'"]');
  const jl2=await liveLog(join);
  ok(jl2.filter(l=>/Online duel/.test(l)).length===1 && !jl2.some(l=>/reopened the lobby/.test(l)),
     '  → the client\'s log holds ONE opening line and nothing from game one  ('+jl2.length+' lines)');

  /* GAME TWO PLAYS A FULL ROUND — the backlog's own test for the risky half. Any stale park, a wedged `busy`, a
   * stale window signature or a dropped mirror shows here as a turn that never lands. */
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click(); const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await view(join)).yourTurn, 100), 'the host leads game two and the turn reaches the client');
  ok(await until(()=>join.evaluate(()=>{ const p=document.getElementById('passBtn'); return !!(p && !p.disabled); }), 40), '  → the client\'s controls are LIVE (Pass enabled)');
  await click(join,'passBtn');
  ok(await until(async()=>(await view(host)).round>=2 && (await view(join)).round>=2, 120), 'game two reaches round 2 on both ends — the second game plays a full round');
  const hostEG2=(await endGameEntries(host)).filter(l=>!/ALREADY SHOWN/.test(l)), joinEG2=(await endGameEntries(join)).filter(l=>!/ALREADY SHOWN/.test(l));
  ok(hostEG2.length===1 && joinEG2.length===1, 'endGame has still run exactly once per end — the lobby transition re-entered nothing  ('+hostEG2.length+'/'+joinEG2.length+')');

  /* ── HALF FOUR: THE OLD GAME IS GONE, NOT MERELY COVERED (Aj: *"why is the previous game still there in the
   * back?"*). Until `clearBoard()` there was no teardown at all — `state` was assigned when a game began and
   * never cleared, so a finished board sat behind whatever floated on top of it, and `leaveOnline` "worked"
   * only because it reloads the page. Asserting the CARDS are gone, not that something covers them.
   * AND THE SOLO FUNNEL STILL TEARS THE GAME DOWN (the v1.31.90 guard). This drives `openSetup()` directly
   * through the dbg surface — two earlier attempts were worse: calling it as a global silently threw (it is
   * inside the closure) and asserted against an untouched board, and asserting after a page reload would only
   * prove that reloading clears the DOM. LAST, because it wrecks the host page. */
  await host.evaluate(()=>{ try{ window.__cmf.openSetup(); }catch(e){} });
  await wait(400);
  const behind = await boardCards(host);
  ok(behind.hand===0 && behind.pile===0 && behind.forms===0,
     'the solo funnel tears the finished board down    [hand '+behind.hand+', pile '+behind.pile+', forms '+behind.forms+']');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
