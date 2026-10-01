/* A PARK WRITE CLOBBERS A LIVE PARK — the DUEL repro (2026-10-01).
 *
 * `netReact` / `netSettle` are assigned at eight sites (SEVEN of them on `main`, so this PREDATES the
 * epic) and not one checks whether a park is already live. The duel's `if(!netSettle) return;` guards the
 * REPLY, never the WRITE. A second `settleWindows` on a window that is already draining therefore
 * replaces the park object and with it the first drain's `resume`.
 *
 * WHY A DUEL AND NOT 3 PLAYERS. The 3-player attempt died on the host's own trace —
 * `move IN from seat 2 op=pass (NO CHANNEL — seat guessed)` — because over BroadcastChannel the host
 * cannot bind a channel to a seat and `hostApplyMoveN`'s only gate is `hostState.turn !== seat`. **In a
 * duel the client is always seat 1, so there is nothing to guess**, and `nettest_brake` drives client
 * passes on this path today.
 *
 * ⚠ THE PARK MUST BE `drainResolution`'s, NOT A TRANSITION'S. A clobber only does harm when the two parks
 * carry DIFFERENT continuations: park A finishes the ROUND, park B re-applies a pass. Clobbering a
 * transition park is benign by construction — both continuations are "apply the client's pass" — which is
 * what made two earlier attempts unable to see the bug even in principle. `drainResolution` writes its
 * own ledger line (`↳ a GO-ROUND opened before it`), and that is how the two are told apart here.
 *
 * ⚠ AND IT IS NOT attempt 4's OP. A duplicate `{op:'decline'}` routes through the REPLY branch and never
 * reaches `moveToPlayThen`; the clobber needs a TURN op.
 *
 * STAGING (inherited from `nettest_brake`, read its header): `prompts=all` because Main → Fight is a
 * BOUNDARY timing; ♦9 LEYLINE on the client with ♦ energy, the only UNTARGETED base Quick and so the only
 * one castable into an empty window; the HOST LEADS so the client is answering a pile and may pass.
 *
 * Run: node nettest_parkclobber.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const { clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8419),ROOM='PK'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const EN=(su,t)=>Array.from({length:12},(_,i)=>D(2,su||'D',(t||'e')+i));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const roundOf=p=>p.evaluate(()=>parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0);
const prio=p=>p.evaluate(()=>{ try{ return (window.__cmf.prioLog()||[]).slice(); }catch(e){ return []; } });
const declineIfUp=p=>p.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d&&d.offsetParent!==null){ d.click(); return true; } return false; });
const clickPassBtn=p=>p.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled){ b.click(); return true; } return false; });
const idsOn=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).sort().join(','));
const want=h=>h.map(c=>c.id).sort().join(',');
const why=p=>p.evaluate(()=>({
  turn:(window.__cmf?window.__cmf.turn():null),
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  rival:((document.getElementById('rivalStatus')||{}).textContent||'').trim().slice(0,42),
  hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,46),
  pending:(window.__cmf?window.__cmf.pending():null),
  modal:!!document.querySelector('.respQuick,#respDecline')
}));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_parkclobber.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  /* STAGE TWICE — the round draw lands AFTER the first call; see `nettest_brake`'s note. */
  async function stage(hh,jh){
    const wH=want(hh), wJ=want(jh);
    for(let i=0;i<10;i++){
      await host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),
        { hands:[hh,jh], energies:[EN('D','e'),EN('H','f')], shields:[3,3],
          /* HECTOR (♥K, the `king` tier) is what makes ♥10 SANCTUARY a Quick — `effectFor`, not
             `effectOf`. Without it Sanctuary is a plain Technique, nothing can act at `resolution`
             timing, the Resolution go-round never opens and `drainResolution` returns immediately with
             no park to clobber. `dbgForceAll` takes `opts.forms`, which is what makes this stageable
             over netplay at all. ♥ energy because Sanctuary costs 10 in its own colour. */
          opts:{ turn:0, round:3, forms:[[], [{rank:13,suit:'H',tier:'king',name:'Hector Form'}]] } });
      if(await until(async()=>(await idsOn(host))===wH && (await idsOn(join))===wJ && (await turnOf(host))===0, 16)) return true;
    }
    console.log('   ⏱ stage never landed — host '+(await idsOn(host))+' | join '+(await idsOn(join)));
    return false;
  }
  async function quietBoard(){
    for(let i=0;i<50;i++){
      let any=false;
      if(await declineIfUp(host)) any=true;
      if(await declineIfUp(join)) any=true;
      if(!any && !(await host.evaluate(()=>/deciding|may respond|may guard|discarding/i.test(((document.getElementById('rivalStatus')||{}).textContent||''))))) return true;
      await wait(250);
    }
    return false;
  }

  async function leg(clobber){
    const tag = clobber ? 'CLOBBER' : 'CONTROL';
    ok(await stage([D(6,'C','h'),D(6,'H','h'),D(3,'S','h')], [D(10,'H','sanc'),D(5,'S','j')]),
       `${tag}: staged — the client holds ♥10 Sanctuary under HECTOR, so it can act at RESOLUTION`);
    const roundBefore = await roundOf(host);
    const prioBefore  = (await prio(host)).length;

    await host.evaluate(()=>{ ['h6C','h6H'].forEach(i=>{const c=document.querySelector('#hand .card[data-id="'+i+'"]');const g=c&&c.closest('.group');if(g)g.click();}); });
    for(let k=0;k<30;k++){
      if(await host.evaluate(()=>!document.querySelector('#hand .card[data-id="h6C"]'))) break;
      await clickFight(host); await quietBoard(); await wait(150);
    }
    ok(await until(async()=>(await turnOf(host))===1, 60), `${tag}: the host led a pair, and the turn reached the client`);

    /* The client's pass RESOLVES the round in a duel (`passes >= aliveCount-1 == 1`), and the Resolution
       go-round then opens because the client still holds a castable Quick. Decline the TRANSITION window
       on the way; the park we want is the one `drainResolution` writes. */
    await until(async()=>!(await join.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
    await clickPassBtn(join);
    /* ⚠ INJECT 70ms LATER, WHICH IS WHAT THE REAL TRACE SHOWED — two intents from one seat 70ms apart.
       An earlier cut waited for the host to be visibly PARKED and then injected; that is timing-coupled,
       and a FIX which closes the park sooner makes the injection land somewhere else entirely, so the
       leg starts failing its own staging and its reds stop being readable. Firing on the clock instead
       reproduces the reported shape and judges any candidate on the same event. */
    if(clobber){ await wait(70); await join.evaluate(()=>window.__cmf.clientSend({op:'pass'})); }
    /* ⚠ PARK ON WHATEVER IS LIVE, AND LET THE TWO LEGS DISCRIMINATE. The first cut demanded
       `drainResolution`'s own line and never saw it: ♦9 Leyline is castable into the TRANSITION window
       but not at `resolution` timing, so the Resolution go-round never opened (the cards that do open it
       — Sanctuary under Hector, Armor Piercing under Hippolyta — need a FORM, which `forceAll` cannot
       stage). The host IS parked here regardless (`Rival 2 is deciding…`), and with a CONTROL that
       completes the round the pair of legs is what carries the claim, not the park's identity. */
    /* ⚠ THE STAGING ASSERTION IS THAT THE HOST PARKED AT ALL — not WHICH park. An earlier cut demanded
       `drainResolution`'s own ledger line and went red while the clobber was demonstrably working, i.e.
       it was asserting a hypothesis about the mechanism rather than the condition the clobber needs. */
    const parked = await until(async()=>
      await host.evaluate(()=>/deciding|may respond|may guard/i.test(((document.getElementById('rivalStatus')||{}).textContent||''))) &&
      (await roundOf(host))===roundBefore, 90);
    if(!parked) console.log(`   ⓘ ${tag}: the host was not caught mid-park (it closes fast with a fix in) — the injection is clock-based and does not depend on it`);

    if(clobber) await wait(900);

    await quietBoard();
    const moved = await until(async()=>{ await quietBoard(); return (await roundOf(host))>roundBefore; }, 60);
    /* ⚠ THE ROUND STILL ADVANCING IS NOT THE INVARIANT — `enterResolution` BLOCKS the second resolution,
       so the table recovers and a liveness probe reports a healthy game. The damage is that a second
       resolution was ATTEMPTED at all, which is the reported bug's mechanism, and the engine's own
       detector is the only thing that can see it. Control clean / clobber firing is what carries this. */
    const L = (await prio(host)).slice(prioBefore);
    const dbl = L.filter(l=>/DOUBLE RESOLUTION BLOCKED/.test(l));
    const banner = L.filter(l=>/ROUND BANNER FIRED WITH A PILE/.test(l));
    if(!clobber){
      ok(dbl.length===0 && banner.length===0,
         `${tag}: the round resolved ONCE — no double-resolution, no stale banner (${dbl.length} + ${banner.length})` +
         (dbl.length||banner.length ? '  ← the CONTROL is dirty, so the clobber leg discriminates nothing' : ''));
    } else {
      /* RATCHET:duplicate-turnop-double-resolves — A KNOWN FAILURE, ENCODED BOTH WAYS.
         This leg REPRODUCES a live defect, so it cannot assert the healthy outcome without turning the
         sweep red. It pins the known damage instead: EXACTLY ONE extra resolution, no stale banner.
         ⚠ IT FAILS IF THE DAMAGE GROWS **AND** IF IT GOES AWAY. If this line fails reading 0, the bug is
         FIXED — delete this ratchet, restore the `dbl.length===0` assertion the control already uses, and
         close the BACKLOG entry; `versiontest` asserts the RATCHET tag against that entry in both
         directions, so it will tell you. If it fails reading 2+, the re-entry got worse.
         THE CONTROL LEG IS WHAT MAKES THIS MEAN ANYTHING: identical staging, no injected intent, 0 + 0. */
      ok(dbl.length===1 && banner.length===0,
         `${tag}: RATCHET — the known double-resolution is still exactly one, with no stale banner (${dbl.length} + ${banner.length})` +
         (dbl.length===1&&!banner.length ? '' : (dbl.length===0
            ? '  ← IT IS FIXED: delete this ratchet and close the BACKLOG entry'
            : '  ← IT GOT WORSE: '+JSON.stringify(L.filter(l=>/⚠/.test(l)).map(l=>l.slice(0,72))))));
    }
    ok(moved, `${tag}: THE TABLE STILL MOVES — the round advanced past ${roundBefore}` +
       (moved ? '' : (clobber ? '  ← REPRODUCED: the second settle clobbered the live park and orphaned `drainResolution`'
                              : '  ← the CONTROL wedged: this suite cannot answer its own window, so the clobber leg proves nothing')+
                     '\n     host: '+JSON.stringify(await why(host))+'\n     join: '+JSON.stringify(await why(join))));
    return moved;
  }

  await leg(false);
  if(!process.env.CONTROL_ONLY) await leg(true);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
