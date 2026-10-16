/* A CLIENT'S BOARD IS LOCKED WHILE A ROUND WINDOW IS OPEN — UPKEEP INCLUDED (2026-10-07).
 *
 * `applyMirrorNow` locks a client's board while its mirror shows a round window open with somebody on priority
 * (`waitingOnRound`), the courtesy copy of the engine refusing every board op there. Upkeep was left out, on
 * the reasoning that an intent pressed there came back as a transition re-applied inside the same round.
 * v1.32.21's `moveToPlay` refuses over any open boundary, which made that transition meaningless, and the
 * engine now refuses a play or pass into an open Upkeep window outright (`test.js` covers that half). This is
 * the client's half: the NEW round's leader, whose turn it already is, read a live board for as long as
 * somebody else's Upkeep window stayed open. `nettest_parity` filmed it as a controls edge — 12ms there,
 * because the host passed its Upkeep window at once; as long as the window lasts when it is prompted.
 *
 * STAGED, NOT PLAYED: the client is handed a mirror through its REAL message handler (`__cmf.inject`), so each
 * row differs from the control by the one window it opens. Reaching a prompted Upkeep window through play needs
 * a seat holding a Quick in ON mode at the right moment, and the probe that found this could not hold one open.
 *
 * TWO NEGATIVES KEEP IT HONEST:
 *   - the CONTROL — the same board with nothing open — must be LIVE, or "locked" is true of a board that can
 *     never be used and every row passes on a broken staging;
 *   - a STALLED Upkeep (flag set, nobody on priority) must stay live too. That exemption is the lock's other
 *     half: a boundary nobody holds must not lock the board for good.
 * Each injected mirror is checked to have LANDED, because a mirror the handler drops (a wrong seat) leaves
 * the previous board on screen and would read as whatever that board was.
 *
 * AND THE CLIENT'S OWN WINDOW (drag-and-stack step 4, piece 9). Every row above is owed to the HOST. When the window
 * is the client's own, the board is locked while the Respond? box is up — and after Yes it is LIVE again, because the
 * board is now the answer: Pass declines (named for the moment), Fight stays off. The same mirror re-sent, as a park
 * beat re-sends it, must neither pop the box back nor take the board away. The client holds Leyline here, with prompts
 * ON, or `promptHumanResponse` passes for it and there is no box to press Yes on.
 *
 * Run: node nettest_roundlock.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8385),ROOM='RL'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node nettest_roundlock.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host')); await join.goto(url('join')+'&prompts=all');   // the client's own window must show its box (piece 9's rows)
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>join.evaluate(()=>!!(window.__cmfNetState && window.__cmfNetState.players && document.querySelectorAll('#hand .card').length))),
     'STAGED: the duel started and the client holds a mirror and a hand');
  await wait(900);                                   // let the opening mirrors settle

  /* Every row is the client's OWN turn (seat 0 in its rotated frame), leading round 2 in the Main sub-phase,
     with nothing on the stack — and then one round window opened on top, owed to the HOST (seat 1). */
  const rows = await join.evaluate(()=>{
    const base=JSON.parse(JSON.stringify(window.__cmfNetState));
    /* LIVENESS IS "SELECT A CARD, DOES FIGHT LIGHT UP" (CLAUDE.md), AND SINCE drag-and-stack step 1 THAT IS THE
       ONLY READING. This used to count the board live when Fight was enabled with nothing selected — which was
       `Next`, the empty crossing. With Next gone a leader on an empty pile has BOTH buttons disabled at rest
       (Skip, and a Fight waiting for a selection), so the CONTROL and STALLED rows would read dead on a live
       board. Probe with one card, and click it back: a probe that clicks must leave no selection behind. */
    const board=()=>{ const fb=document.getElementById('fightBtn'), pb=document.getElementById('passBtn');
      const g=document.querySelector('#hand .group'); if(g) g.click();
      const res={ fight: fb ? fb.textContent.trim()+(fb.disabled?' (off)':' (on)') : null, pass: pb ? (pb.disabled?'off':'on') : null,
               live: !!((fb && !fb.disabled && fb.offsetParent) || (pb && !pb.disabled && pb.offsetParent)) };
      [].slice.call(document.querySelectorAll('#hand .group.gsel')).forEach(x=>x.click());
      return res; };
    const row=(name, set, want)=>{
      const s=JSON.parse(JSON.stringify(base));
      Object.assign(s, { round:2, turn:0, initiative:0, pile:null, passes:0, lastPlayer:null, subPhase:'main', finished:false,
                         pending:null, respondFor:null, stack:[], resolution:null, cleanup:null, endCleanup:null, upkeep:null,
                         pendingLossChoice:null, discardPending:null, trimPending:null });
      set(s);
      window.__cmf.inject({ t:'mirror', seat:1, st:s });   // the client is seat 1 in a duel; no `q`, so the stale check is not involved
      const now=window.__cmfNetState;
      const landed = now!==null && now.round===2 && now.turn===0 && now.respondFor===s.respondFor &&
                     !!now.upkeep===!!s.upkeep && !!now.resolution===!!s.resolution && !!now.cleanup===!!s.cleanup && !!now.endCleanup===!!s.endCleanup;
      return Object.assign({ name, want, landed }, board());
    };
    const out=[
      row('CONTROL — your turn, nothing open', ()=>{}, 'live'),
      row('Upkeep, the host on priority',          s=>{ s.upkeep={origin:0};     s.respondFor=1; }, 'locked'),
      row('Resolution, the host on priority',      s=>{ s.resolution={origin:0, winner:0, wonWithCombo:false, strikeTargets:[]}; s.respondFor=1; }, 'locked'),
      row('Clean-up, the host on priority',        s=>{ s.cleanup={origin:0};    s.respondFor=1; }, 'locked'),
      row('the end of Clean-up, the host on priority', s=>{ s.endCleanup={origin:0}; s.respondFor=1; }, 'locked'),
      row('a STALLED Upkeep — nobody on priority', s=>{ s.upkeep={origin:0};     s.respondFor=null; }, 'live'),
    ];
    return out;
  });

  ok(rows.every(r=>r.landed), 'STAGED: every injected mirror LANDED on the client'+
     (rows.every(r=>r.landed) ? '' : '  ← not applied: '+rows.filter(r=>!r.landed).map(r=>r.name).join('; ')));
  rows.forEach(r=>{
    const got = r.live ? 'live' : 'locked';
    ok(got===r.want, `${r.name}: the board is ${r.want.toUpperCase()}  [Fight ${r.fight} · Pass ${r.pass}]`+
       (got===r.want ? '' : '  ← it is '+got.toUpperCase()+
        (/^Upkeep/.test(r.name) ? ' — REPRODUCED: the next leader can press into somebody else\'s Upkeep window, and the engine refuses it' : '')));
  });

  // ---- the client's OWN Upkeep window: the box, then Yes, then the same mirror again
  const mine = ()=>join.evaluate(()=>{
    const s=JSON.parse(JSON.stringify(window.__cmfNetState)), mk=(r,su,id)=>({rank:r,suit:su,id:id});
    Object.assign(s, { round:2, turn:0, initiative:0, pile:null, passes:0, lastPlayer:null, subPhase:'main', finished:false,
                       pending:null, stack:[], resolution:null, cleanup:null, endCleanup:null, pendingLossChoice:null, discardPending:null, trimPending:null,
                       upkeep:{origin:0}, respondFor:0, prioGen:77 });
    s.players[0].hand=[mk(9,'D','rlLey'),mk(6,'C','rl6C')];
    s.players[0].energy=[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>mk(n,'D','rle'+n));
    window.__cmf.inject({ t:'mirror', seat:1, st:s });
    const now=window.__cmfNetState; return !!(now && now.respondFor===0 && now.upkeep && now.prioGen===77); });
  const look = ()=>join.evaluate(()=>{ const fb=document.getElementById('fightBtn'), pb=document.getElementById('passBtn'), y=document.getElementById('respYes');
    const g=document.querySelector('#hand .group'); if(g) g.click();
    const res={ box:!!(y && y.offsetParent!==null), answering:window.__cmf.answering(), fightOff:!!(fb && fb.disabled),
                pass:pb ? (pb.textContent||'').trim()+(pb.disabled?' (off)':' (on)') : null, live:!!(pb && !pb.disabled && pb.offsetParent) };
    [].slice.call(document.querySelectorAll('#hand .group.gsel')).forEach(x=>x.click());
    return res; });
  const landedMine = await mine();
  ok(landedMine && await until(()=>join.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent!==null); }), 40),
     'STAGED: an Upkeep window owed to the CLIENT landed, and its Respond? box opened');
  const m1 = await look();
  ok(m1.box && !m1.live, 'your own Upkeep window, the box up: the board under it is LOCKED  '+JSON.stringify(m1));
  await join.evaluate(()=>document.getElementById('respYes').click()); await wait(300);
  const m2 = await look();
  ok(!m2.box && m2.answering && m2.live && m2.fightOff && /^Start the round/.test(m2.pass),
     'after Yes the board is LIVE as the answer: Pass declines, named for the moment, and Fight stays off  '+JSON.stringify(m2));
  const again = await mine(); await wait(400);
  const m3 = await look();
  ok(again && !m3.box && m3.answering && m3.live, 'the SAME mirror again (a park beat) neither pops the box back nor takes the board away  '+JSON.stringify(m3));

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
