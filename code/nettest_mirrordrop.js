/* THE MISSING EXPERIMENT for the host/client fork — see DECISIONS.md / the BACKLOG entry.
 *
 * Everything about that fork was instrumented except one configuration, and it is the only one where a stale
 * client can genuinely deadlock a table: the round's DEAL mirror is lost AND the client is the seat that must
 * act next. Every earlier forced-drop probe left the HOST to move, so the "persistence" it showed was the
 * harness giving up, not a deadlock — that is what got `reassertMirror()` withdrawn once on no evidence.
 *
 * Staging (borrowed from nettest_clientwin, which already produces a client-won round deterministically):
 * the host leads a 3, the client answers with the apex 2, the host must pass. `resolveRoundWin` sets the turn
 * to the round WINNER, so the client is on turn for the new round — and we swallow the mirror that carries
 * that round's deal.
 *
 * WHAT IT ASSERTS, and the distinction is the point:
 *   1. the client really is missing that round's dealt cards (the drop worked — otherwise this proves nothing);
 *   2. the table RECOVERS — the two hands agree again, and the client can act — WITHOUT anyone reloading.
 * A failure of 2 with 1 passing is a real deadlock and the fork reproduced on demand.
 * Run: node nettest_mirrordrop.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8341),ROOM='MD'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const snap=p=>p.evaluate(()=>({
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  fightOff:!!(document.getElementById('fightBtn')||{}).disabled,
  passOff:!!(document.getElementById('passBtn')||{}).disabled,
}));
// the host's view of the client's hand, and the client's view of its own — the nettest_sync comparison
const hostSeesClient=p=>p.evaluate(()=>(window.__cmf&&window.__cmf.handOf(1))||[]);
const clientOwn=p=>p.evaluate(()=>(window.__cmf&&window.__cmf.hand())||[]);

(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await snap(host)).round>0), 'duel started');

  // the CLIENT holds the apex 2, so the round it wins is deterministic and the turn lands on the client
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    window.__cmf.force([C(3,'D','h'),C(4,'H','h'),C(5,'C','h'),C(6,'S','h')],
                       [C(2,'D','c'),C(7,'H','c'),C(8,'C','c'),C(9,'S','c')]);
  });
  ok(await until(()=>join.evaluate(()=>!!document.querySelector('#hand .card[data-id="c2D"]'))),
     'hands staged — the client holds the apex 2');

  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h3D"]'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(join)).yourTurn), 'the turn reached the client');
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="c2D"]'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await snap(host)).yourTurn,60), 'the turn returns to the host, which cannot beat a 2');

  /* ARM THE DROP, then pass. Passing ends the round, the client wins it, and the deal + turn handover ride the
   * next mirror — which the host will now swallow while believing it sent it. */
  /* SIX, not one. Measured on the build before the park heartbeat: 3 swallowed mirrors is survivable and 4
   * deadlocks permanently, so the default sits just above the threshold with margin for timing. Override with
   * DROPS=n to re-find the threshold on a future build. */
  const DROPS = parseInt(process.env.DROPS||'6',10);
  const armed = await host.evaluate(n=>window.__cmf.dropMirrors(1,n), DROPS);
  ok(armed===DROPS, 'armed: the next '+DROPS+' mirror(s) to the client will be dropped');
  await host.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  ok(await until(async()=>(await snap(host)).round>=2,140), 'the host advanced to round 2 and dealt');

  /* 1. DID THE DROP LAND? Without this the rest proves nothing — a probe that silently fails to break anything
   *    reports a healthy table and looks like good news. */
  await wait(600);
  const hSaw=await hostSeesClient(host), cSaw=await clientOwn(join);
  const missing=hSaw.filter(id=>cSaw.indexOf(id)<0);
  const rh=(await snap(host)).round, rc=(await snap(join)).round;
  /* WHAT "DIVERGED" MEANS HERE IS NOT THE HAND. A mirror is a full SNAPSHOT, not a delta, so a lost one heals
   * the instant any later mirror arrives and the hands almost never disagree. The damage shows up as the
   * client being a whole ROUND behind — which is the recorded signature read from the other side. */
  ok(missing.length>0 || rc<rh,
     'the drop actually put the client behind  [host round '+rh+' / client round '+rc+
     '; host sees '+hSaw.length+' cards, client holds '+cSaw.length+
     (missing.length?', missing: '+missing.join(' '):'')+']');

  /* 2. DOES IT RECOVER? The host is parked in awaitRival with the turn on the CLIENT, so nothing else is coming
   *    unless the host re-asserts. This is the configuration no earlier probe reached. */
  const healed = await until(async()=>{
    const h=await hostSeesClient(host), c=await clientOwn(join);
    const sh=await snap(host), sc=await snap(join);
    return sc.round>=sh.round && h.length===c.length && h.every(id=>c.indexOf(id)>=0);
  }, 80, 250);
  /* LIVENESS, and the naive form of this check is wrong in a way that reads as a dead board: the round WINNER
   * leads the next round, so Pass is illegal for it, and Fight is disabled until a card is selected. "Both
   * buttons off" is therefore the CORRECT resting state here — it reproduces with zero drops. Select a card
   * and require Fight to light up; that is the difference between a leading seat and a wedged one. */
  const canAct = await until(async()=>{
    const s=await snap(join); if(!s.yourTurn) return false;
    return await join.evaluate(()=>{
      const c=document.querySelector('#hand .card'); if(!c) return false;
      c.click();
      const on=!!(document.getElementById('fightBtn')&&!document.getElementById('fightBtn').disabled);
      document.querySelectorAll('#hand .card.sel').forEach(x=>x.click());   // a probe that clicks must click back
      return on;
    });
  }, 40, 250);
  if(!canAct){ const cs=await snap(join), hs=await snap(host);
    console.log('   client: round '+cs.round+' yourTurn '+cs.yourTurn+' fight '+(cs.fightOff?'off':'on')+' pass '+(cs.passOff?'off':'on'));
    console.log('   host:   round '+hs.round+' yourTurn '+hs.yourTurn+' fight '+(hs.fightOff?'off':'on')+' pass '+(hs.passOff?'off':'on')); }

  if(!healed){
    const h=await hostSeesClient(host), c=await clientOwn(join);
    console.log('   HOST sees client ('+h.length+'): '+h.join(' '));
    console.log('   CLIENT own hand  ('+c.length+'): '+c.join(' '));
    console.log('   STILL MISSING: '+h.filter(id=>c.indexOf(id)<0).join(' '));
    for(const [n,p] of [['host',host],['client',join]]){
      const t=await p.evaluate(()=>{ try{ return window.__cmf.trace().slice(-8); }catch(e){ return ['(no trace)']; } });
      console.log('   '+n+' trace tail: '+t.join(' | '));
    }
  }
  ok(healed, 'THE TABLE RECOVERS from a lost deal mirror with the CLIENT on turn'+
             (healed?'':'  ← DEADLOCK: the fork reproduced, and nothing re-asserts because the host is parked'));
  ok(canAct, 'and the client can actually act'+(canAct?'':'  ← its board is dead'));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
