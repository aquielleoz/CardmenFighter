/* THE PRE-FIGHT WINDOW IN A **DUEL** — the case `nettest_prefight` does not cover.
 *
 * Backlog `[id: duel-prefight-abandoned]`, filed `root cause found`: *"a 2-player netplay pre-fight window
 * is set on the client and abandoned by the host — the duel `t:'move'` handler has no op for it"*, rated a
 * permanent hang. It has sat open because **nothing tests it**: `nettest_prefight` says so in its own first
 * line — *"N-PLAYER PRE-FIGHT (Back Stab) OVER NETPLAY (3 players)"* — so the duel path had no suite at all.
 *
 * THE FILED MECHANISM IS GONE, WHICH IS NOT THE SAME AS THE BUG BEING GONE. Epic step 20 deleted the
 * standalone pre-fight window (`eligiblePreFightQuicks`, `promptHumanPreFight`, `humanSpringsPreFight`) and
 * folded it into the Main → Fight transition, so there is no `prefight` op on the wire for a handler to be
 * missing — measured: `grep "op:'prefight'"` finds nothing. The transition now routes through
 * `settleWindows`, which dispatches to `hostSettle` (duel, parks `netSettle`) or `hostSettleN` (N-player,
 * parks `netReact`). So the entry SHOULD be closed. This suite is what says so with evidence instead of
 * with reasoning — and if it hangs instead, it is the repro the entry never had.
 *
 * ✅ MEASURED 2026-09-24: IT DOES NOT HANG. The client is offered the window, answers it, the host's fight
 * resolves, the turn passes, the client plays and control returns. The entry is closed on evidence.
 * KEEP THE SUITE ANYWAY — the duel path had none, which is the only reason a `root cause found` hang could
 * sit open for eight days without anyone being able to say whether it was still real.
 *
 * THREE STAGING FACTS, each of which makes this pass vacuously if lost:
 *   - `prompts=all`. The Main → Fight window is a BOUNDARY timing and those default OFF, so without the
 *     flag the client auto-passes and nothing is ever tested. CLAUDE.md's own rule for this suite family.
 *   - HERMES NEEDS THE RIDE. Back Stab is a Quick only under Super = any J + any Q + any K
 *     (`hasSuper`, variant B). A Q+K pair is the exact staging error that once cost `nettest_prefight` its
 *     whole point: no Super, no Quick, no window, green suite.
 *   - ENERGY FOR THE SUPER COST. Super Back Stab costs 10, so twelve ♠ energy — a short pile refuses the
 *     cast and the run reports "no window" having offered nothing.
 *
 * Run: node nettest_prefightduel.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const { clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8376),ROOM='PD'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const HERMES=[{rank:11,suit:'S',tier:'ride'},{rank:12,suit:'S',tier:'queen'},{rank:13,suit:'S',tier:'king'}];
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* LIVENESS, NOT APPEARANCE — copied from `nettest_ridewedge`: "both buttons disabled" is a legitimate
   resting state, so only a selection proves the board answers. A probe that clicks must click back. */
const boardUsable=p=>p.evaluate(()=>{
  var rs=((document.getElementById('rivalStatus')||{}).textContent||'').trim();
  if(rs!=='') return false;
  var c=document.querySelector('#hand .card'); if(!c) return false;
  var g=c.closest('.group'); if(!g) return false;
  g.click();
  var f=document.getElementById('fightBtn'), okNow=!!(f && !f.disabled);
  g.click();
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  return okNow;
});
const why=p=>p.evaluate(()=>{
  var f=document.getElementById('fightBtn');
  return { rivalStatus:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
           hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,70),
           turn:(window.__cmf?window.__cmf.turn():null),
           fightDisabled:!!(f&&f.disabled), hand:document.querySelectorAll('#hand .card').length };
});
const respQuicks=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' ')));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_prefightduel.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  const EN=n=>Array.from({length:12},(_,i)=>D(2,n,'e'+i));
  const stage=()=>host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),{
    hands:[[D(6,'D','h1'),D(7,'D','h2'),D(9,'C','h3')],          // host: something ordinary to fight with
           [D(10,'S','bs'),D(4,'H','c1'),D(8,'C','c2')]],        // CLIENT holds Back Stab (♠10)
    energies:[EN('D'), EN('S')],                                  // ♠ energy for the client: super Back Stab costs 10
    shields:[3,3],
    opts:{ forms:{ 1:HERMES }, turn:0, round:3 }                  // the CLIENT is in Super — Back Stab becomes a Quick
  });
  let staged=false;
  for(let i=0;i<8 && !staged;i++){
    await stage();
    staged = await until(async()=>await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="bs10S"]')), 12);
  }
  ok(staged, 'staged: the CLIENT holds Back Stab in Super (J+Q+K), with ♠ energy for its 10 cost');
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.turn())===0, 60), "it is the host's turn");

  /* THE HOST FIGHTS. In a duel this crosses Main → Fight, which is the window the deleted pre-fight one
     became — and the moment the filed entry says the host abandons the client. */
  await host.evaluate(()=>{
    const clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
    const c=document.querySelector('#hand .card[data-id="h16D"]'); const g=c && c.closest('.group'); if(g) g.click();
  });
  await clickFight(host);
  await wait(600);
  await clickFight(host);                                   // two-state button: Next then Fight (see fightclick.js)

  const offered = await until(async()=>(await respQuicks(join)).length>0, 60);
  const names = await respQuicks(join);
  ok(offered, 'the CLIENT is offered the window at the Main → Fight boundary' +
     (offered ? `  [${names.map(t=>t.split(' ')[0]).join('|')}]` : '  ← nothing offered; check the Super staging and `prompts=all`'));

  /* THE ASSERTION THE ENTRY EXISTS FOR. Filed as a permanent hang: the client answers and the host never
     resumes, because a duel resumes from `netSettle` and a window parked in the N-player family
     (`netReact`) is silently dropped — the trap that has cost this repo three bugs. */
  /* ⚠ THE LIVENESS CHECK IS "THE TABLE MOVES", NOT "THE HOST'S BOARD IS LIVE" — the first cut of this
     suite got that wrong and nearly reported a hang that was not one. `nettest_ridewedge` and
     `nettest_quickwedge` assert `boardUsable(host)` because in those the host cast on its OWN turn and
     must resume it. Here the host FOUGHT: its card leaves its hand, the play resolves, and the turn
     passes to the client — so "Waiting for opponent…" with `turn=1` is the CORRECT resting state, and
     reading it as a wedge is the same mistake CLAUDE.md records for "both buttons disabled".
     THE REAL QUESTION IS WHETHER PLAY CONTINUES. Drive the client's turn and require the host to come
     back. A genuinely abandoned window fails this, because nothing on either side ever resumes. */
  const before = await host.evaluate(()=>window.__cmf.turn());
  await join.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d) d.click(); });
  const handed = await until(async()=>await host.evaluate(()=>window.__cmf.turn())===1, 60);
  ok(handed, 'the window is ANSWERED and the host\'s fight resolves — the turn passes to the client' +
     (handed ? '' : '  ← the decline was dropped; host: '+JSON.stringify(await why(host))));
  const clientLive = await until(async()=>await boardUsable(join), 60);
  ok(clientLive, '…the client\'s board is genuinely playable, not merely un-stuck' +
     (clientLive ? '' : '  ← client: '+JSON.stringify(await why(join))));
  /* AND THE ROUND-TRIP CLOSES. The client plays; control must return to the host. An abandoned window
     shows up here rather than above, because the host is parked on a resume that never fires. */
  await join.evaluate(()=>{
    const clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
    const cards=[].slice.call(document.querySelectorAll('#hand .card'));
    for(let i=0;i<cards.length;i++){
      if(clr && !clr.disabled) clr.click();
      const g=document.querySelectorAll('#hand .card')[i].closest('.group'); if(g) g.click();
      const f=document.getElementById('fightBtn'); if(f && !f.disabled){ f.click(); return; }
    }
    const ps=document.getElementById('passBtn'); if(ps && !ps.disabled) ps.click();
  });
  const back = await until(async()=>await boardUsable(host), 90);
  ok(back, 'AND CONTROL RETURNS TO THE HOST — the window was not abandoned' +
     (back ? '' : '  ← HUNG; host: '+JSON.stringify(await why(host))+'  client: '+JSON.stringify(await why(join))));

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
