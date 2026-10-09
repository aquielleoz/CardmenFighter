/* AFTER THE CLEAN-UP DWELL THE PHASE STRIP COMES FROM THE GAME, ON EVERY SEAT (strip-from-state-after-cleanup).
 *
 * The round ceremony holds the strip on Clean-up with a UI flag (`uiPhase`) for its dwell, and the two seats let
 * go of that flag at different moments: a guest at the end of its own beats, the host only at its deal. So the
 * strip read the GAME on one seat and the CEREMONY on the other, and two cases came out wrong:
 *   LEG 1 — the host picks its end-of-round discards. Nothing on the table is a priority window, so the guest,
 *           already off the flag, fell through to the turn colour (Idle or Main) instead of Clean-up.
 *   LEG 2 — an Upkeep window parks inside the host's ceremony, waiting on the guest. The host, still on the flag,
 *           painted Clean-up, because `uiPhase==='cleanup'` outranks `state.upkeep` in `paintPhaseStrip`.
 * Both are staged deterministically, and each leg also asserts the OTHER seat, which was already right, so a
 * fix that moves the error from one seat to the other cannot pass.
 * Run: node nettest_strip.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { selectAndFight, clickPass } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8477),STAMP=Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=(r,room,extra)=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${room}&dbg=1${extra||''}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=150,ms=100){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
const strip=p=>p.evaluate(()=>{ const hw=document.getElementById('handWrap'); return hw ? ((hw.className.match(/\bsp[A-Z][a-zA-Z]*/)||[])[0]||'none') : 'none'; });
const flags=p=>p.evaluate(()=>window.__cmf && window.__cmf.roundFlags ? window.__cmf.roundFlags() : null);
/* EVERY STRIP CHANGE, filmed with the flags that painted it — a red run prints this so it says which state was on screen. */
function installFilm(){ window.__strip=[]; const hw=document.getElementById('handWrap'); let last=null;
  new MutationObserver(()=>{ const m=(hw.className.match(/\bsp[A-Z][a-zA-Z]*/)||[])[0]||null; if(m && m!==last){ last=m;
      const f=window.__cmf.roundFlags(); window.__strip.push(m.replace(/^sp/,'')+(f.trim?'[trim]':'')+(f.upkeep?'[upkeep]':'')+(f.cleanup||f.endCleanup?'[cleanup]':'')); } })
    .observe(hw,{attributes:true, attributeFilter:['class']}); }
const film=p=>p.evaluate(()=>(window.__strip||[]).join(' → '));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH); const errs=[];
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  /* ---- LEG 1: THE HOST PICKS ITS DISCARDS — the guest must read Clean-up, not the turn ---- */
  { const ctx=await b.newContext({viewport:{width:1100,height:820}}); const room='SA'+STAMP;
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    await host.goto(url('host',room)); await join.goto(url('join',room));
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await startDuel(host, join);
    /* THE HOST over the cap: it is the only seat that gets an interactive pick (every other seat is trimmed for
       it). 13 cards, one played, leaves 12 against a cap of 10 — the pick cannot be skipped. No Quick on either
       side, so no priority window opens anywhere in the boundary: the pick is the only thing the table waits on. */
    await host.evaluate(C=>{ const mk=eval(C); const many=[]; [3,4,5,6,7,8,10,11,12,13,1,2,3].forEach((r,i)=>many.push(mk(r,'CS'[i%2],'h'+i)));
      window.__cmf.force(many, [mk(4,'C','c'),mk(6,'H','c'),mk(7,'S','c'),mk(8,'C','c')]); }, String(C));
    await host.evaluate(installFilm); await join.evaluate(installFilm);
    await wait(500);
    ok((await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>10, 'leg 1 staged: the host is over the hand cap');
    await selectAndFight(host, ['h03C']);                                 // a 3 — the guest will pass rather than answer
    ok(await until(async()=>/your turn/.test(await join.evaluate(()=>(document.getElementById('turnTag')||{}).textContent||'')), 100), 'the turn reached the guest');
    await clickPass(join);
    const picking = await until(async()=>/hand limit|Discard/i.test(await host.evaluate(()=>(document.getElementById('message')||{}).textContent||'')), 150);
    ok(picking, 'the host reaches its end-of-round pick' + (picking?'':'  (staging problem, not the feature)'));
    /* THE MOMENT THAT MATTERS: the guest has finished its OWN beats and dropped the ceremony's flag (its deal step),
       while the host is still picking. Before that the guest is legitimately showing its own Clean-up dwell. */
    const atDeal = await until(async()=>{ const h=await join.evaluate(()=>window.__cmf.ceremonyHold()); return !!(h && h.awaiting); }, 100);
    const gf = await flags(join);
    ok(atDeal && gf && gf.trim, 'leg 1 staged: the guest is waiting on the host\'s deal AND knows the host is picking  ' + JSON.stringify({awaiting:atDeal, trim:gf&&gf.trim}));
    await wait(300);
    const gs = await strip(join), hs = await strip(host);
    ok(gs==='spCleanup', 'the GUEST\'s strip shows Clean-up while the host picks its discards — read ' + gs +
       (gs==='spCleanup' ? '' : '  ← REPRODUCED: the guest fell through to the turn colour  [' + await film(join) + ']'));
    ok(hs==='spCleanup', '  → and the host\'s own strip shows Clean-up too — read ' + hs + (hs==='spCleanup' ? '' : '  [' + await film(host) + ']'));
    /* confirm the pick: select until FIGHT enables (it is the pick's confirm), then press it */
    /* THE ROUND NUMBER IS NO LIVENESS CHECK HERE: it advances at Resolution, so it already reads the new round
       during the pick. The deal is what the pick unblocks, and the deal is the Beginning tint on both films. */
    const n0h = await host.evaluate(()=>window.__strip.length), n0j = await join.evaluate(()=>window.__strip.length);
    await host.evaluate(async()=>{ const f=()=>document.getElementById('fightBtn');
      for(const c of [].slice.call(document.querySelectorAll('#hand > .card'))){ if(f() && !f().disabled) break; c.click(); await new Promise(r=>setTimeout(r,60)); }
      if(f() && !f().disabled) f().click(); });
    const dealt = await until(async()=>(await host.evaluate(n=>window.__strip.slice(n).some(x=>/^Begin/.test(x)), n0h)) &&
                                       (await join.evaluate(n=>window.__strip.slice(n).some(x=>/^Begin/.test(x)), n0j)), 150);
    ok(dealt, 'the pick confirms and both strips move on to the Beginning tint for the deal  [host ' + await film(host) + ' | guest ' + await film(join) + ']');
    /* AND THE OPENING STILL READS AS RESOLUTION. Ranking the engine's phases above the ceremony's flag must not
       drag the deal's ANIMATION up with them: the first cut did, and both seats flashed Begin over the Resolution
       beat whenever a card had just entered a hand. Begin straight before Resolve is that flash. */
    const fh1 = await film(host), fj1 = await film(join);
    ok(!/Begin → Resolve/.test(fh1) && !/Begin → Resolve/.test(fj1), 'the ceremony opens on Resolution on both seats, with no Begin flash before it  [host ' + fh1 + ' | guest ' + fj1 + ']');
    await ctx.close();
  }

  /* ---- LEG 2: AN UPKEEP WINDOW INSIDE THE HOST'S OWN CEREMONY — the host must read Beginning, not Clean-up ----
     A boundary window can only park INSIDE a ceremony when it did not exist at Resolution: a seat that could act
     at Resolution opens that window first, and the host drains the whole boundary before its ceremony starts —
     the first cut of this leg staged exactly that and read a correct strip, with the host's ceremony not even
     running (`inCeremony` false). The natural way in is a broken SHIELD: the template plays with shield cards on
     (`setShieldCards(true)`), so the card under a broken shield returns to its owner's hand. Make it Leyline,
     give the owner the energy, and the Clean-up and Upkeep windows open only after Resolution — inside the
     ceremony, after its Clean-up dwell, which is where the flag outranked `state.upkeep`.
     So, round 3 (Specials are legal): the guest leads a pair, the host cannot answer it and passes, the host's
     shield breaks and hands it Leyline. The host is stopped at every window it can act in (`prompts=all`). */
  { const ctx=await b.newContext({viewport:{width:1100,height:820}}); const room='SB'+STAMP;
    const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
    const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
    await host.goto(url('host',room,'&prompts=all')); await join.goto(url('join',room));
    await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
    await startDuel(host, join, {manualWindows:true});                    // this suite answers the host's windows itself, below
    await host.evaluate(C=>{ const mk=eval(C); const he=[]; for(let i=0;i<12;i++) he.push(mk(3,'D','e'+i));
      window.__cmf.forceAll([[mk(3,'H','h'),mk(5,'S','h'),mk(6,'C','h')], [mk(8,'H','g'),mk(8,'C','g'),mk(4,'S','g'),mk(3,'C','g')]],
                            [he, []], [null, 2],
                            { round:3, turn:1, shieldPile:[[mk(10,'C','sp'), mk(9,'D','L')], null] }); }, String(C));
    await host.evaluate(installFilm); await join.evaluate(installFilm);
    /* THE HOST'S ANSWERS, in the page: every window is declined at once EXCEPT Upkeep, which is held 2.5s so both
       strips can be read while the host's own ceremony waits on it. */
    await host.evaluate(()=>{ window.__held=null; setInterval(()=>{
        const d=document.getElementById('respDecline'); if(!d || !d.offsetParent || d.disabled) return;
        const f=window.__cmf.roundFlags();
        if(f && f.upkeep){ if(!window.__held) window.__held=Date.now(); if(Date.now()-window.__held<2500) return; }
        d.click(); }, 120); });
    await wait(400);
    ok(await host.evaluate(()=>!document.querySelector('#hand .card[data-id="L9D"]')), 'leg 2 staged: Leyline is under the host\'s shield, not in its hand');
    await selectAndFight(join, ['g8H','g8C']);                            // the guest leads a pair of 8s
    ok(await until(async()=>/your turn/.test(await host.evaluate(()=>(document.getElementById('turnTag')||{}).textContent||'')), 120), 'the turn reached the host');
    await clickPass(host);                                               // the HOST cannot answer the pair, so its pass ends the round
    const held = await until(()=>host.evaluate(()=>!!window.__held), 200);
    const hf = await flags(host), inCer = await host.evaluate(()=>window.__cmf.ceremony());
    ok(held && hf && hf.upkeep && hf.respondFor===0 && inCer, 'leg 2 staged: the host holds Leyline from its broken shield, and its Upkeep window is open INSIDE its ceremony  ' +
       JSON.stringify({held:held, upkeep:hf&&hf.upkeep, respondFor:hf&&hf.respondFor, inCeremony:inCer}));
    await wait(300);
    const hs = await strip(host), gs = await strip(join);
    ok(hs==='spBegin', 'the HOST\'s strip shows the Beginning tint while it decides at Upkeep — read ' + hs +
       (hs==='spBegin' ? '' : '  ← REPRODUCED: the ceremony\'s Clean-up flag outranks the Upkeep window  [' + await film(host) + ']'));
    ok(gs==='spBegin', '  → and the guest\'s strip shows it too — read ' + gs + (gs==='spBegin' ? '' : '  [' + await film(join) + ']'));
    const fh2 = await film(host), fj2 = await film(join);
    ok(!/Begin → Resolve/.test(fh2) && !/Begin → Resolve/.test(fj2), '  → and neither seat flashed Begin before Resolution  [host ' + fh2 + ' | guest ' + fj2 + ']');
    /* the winner leads the next round: the deal happened and play goes on */
    ok(await until(async()=>/your turn/.test(await join.evaluate(()=>(document.getElementById('turnTag')||{}).textContent||'')), 200),
       'the host answers, the round is dealt, and the guest (the winner) leads the next one');
    await ctx.close();
  }

  ok(errs.length===0, 'no page errors' + (errs.length ? '  ' + errs.slice(0,3).join(' | ') : ''));
  await b.close(); srv.close();
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+(e&&e.stack||e)); process.exit(1); });
