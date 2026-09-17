/* THE HOST CASTS A **TARGETED** TECHNIQUE AND THE CLIENT **ANSWERS** IT — and the host never comes back.
 *
 * Aj hit this in a real online duel (2026-09-18, BOTH ends of the log saved, which is what made it
 * diagnosable at all). Round 10: the host cast **Sabotage** (♠5, `removeEquip`) at the client's **Holy Bow**,
 * the client answered at instant speed with **Annoint** (♥5, `protect`), and the HOST WwEDGED. Backlog entry
 * `[id: duel-hangs-after-client-quick]`.
 *
 * WHAT THE LOGS PROVED, and it is why this suite is shaped the way it is:
 *   - the host RECEIVED it — `move IN from seat 1 op=respond`, and that was the LAST line of its trace:
 *     no `hostTakeBack`, no `awaitRival`;
 *   - the host APPLIED it — the client's hand went **5 → 4** on the very next mirror;
 *   - the host then PARKED FOREVER — ~160s of mirrors at exactly **1.8s**, which is `startParkBeat()`;
 *   - the ROUND BOUNDARY trace showed r9 → r10 COMPLETE, both queues reaching `exit`, which ruled the
 *     stale-pile family out rather than merely leaving it unsuspected.
 * So the wedge is AFTER the respond was applied, inside the settle continuation.
 *
 * WHY A NEW SUITE AND NOT A LEG IN `nettest_ridewedge`. That one is the mirror image and is GREEN: the host
 * activates and the client **DECLINES**. Here the client **RESPONDS**, which is a different continuation —
 * `respond` pushes an object and re-opens the go-round, where `declineResponse` resolves and closes it. A
 * suite that declines cannot see this, and `nettest_actloop` LEG 1 cannot either: it activates an untargeted
 * Technique and nothing answers it.
 *
 * THREE STAGING FACTS, EACH OF WHICH MAKES THIS PASS VACUOUSLY IF LOST:
 *   - THE CLIENT MUST OWN EQUIPMENT. `quickTargets`'s `protect` branch returns a legal target only when an
 *     incoming `removeEquip` on the stack resolves through `pickEquip` — with no equipment there is nothing
 *     to remove, the host's cast is refused outright, and the run reports "no window" having cast nothing.
 *   - THE HOST'S CAST IS TWO STEPS. `removeEquip` does not go through `targetPick`/`confirmTargetPick`; it
 *     sets the `targeting` variable and waits for a tap on a `.targetable` box, which lands in `doRemove`.
 *     Pressing ⚡ alone leaves the cast unmade.
 *   - THE CLIENT MUST **RESPOND**, NOT DECLINE. Declining is the path `nettest_ridewedge` already proves
 *     green; this asserts the Annoint button is really there and clicks THAT.
 *
 * Run: node nettest_quickwedge.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8369),ROOM='QW'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* LIVENESS, NOT APPEARANCE — copied deliberately from `nettest_ridewedge`, because "both buttons disabled"
 * is a legitimate resting state and only a selection proves the board answers. A probe that clicks must
 * click back. */
const boardUsable=p=>p.evaluate(()=>{
  var rs=((document.getElementById('rivalStatus')||{}).textContent||'').trim();
  if(rs!=='') return false;
  var c=document.querySelector('#hand .card'); if(!c) return false;
  c.click();
  var f=document.getElementById('fightBtn'), okNow=!!(f && !f.disabled);
  c.click();
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  return okNow;
});
const why=p=>p.evaluate(()=>{
  var f=document.getElementById('fightBtn');
  return { rivalStatus:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
           hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,80),
           message:((document.getElementById('message')||{}).textContent||'').trim().slice(0,80),
           turn:(window.__cmf?window.__cmf.turn():null),
           pending:(window.__cmf?window.__cmf.pending():null),
           fightDisabled:!!(f&&f.disabled),
           handCards:document.querySelectorAll('#hand .card').length };
});
// step 1 of the host's cast: pick the card and press ⚡, which only enters `targeting`
const armCast=(p,id)=>p.evaluate(cid=>{
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function(c){ c.click(); });
  var c=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!c) return 'no card';
  c.click();
  var ca=document.getElementById('cardActivate'), cx=document.getElementById('ctxBtn');
  if(ca && ca.offsetParent!==null && !ca.disabled && !/off/.test(ca.className)){ ca.click(); return 'icon'; }
  if(cx && !cx.disabled && !/off/.test(cx.className) && /Activate/i.test(cx.textContent||'')){ cx.click(); return 'ctx'; }
  return 'not offerable';
}, id);
// step 2: tap the target. `.targetable` exists only while `targeting` is live, so this doubles as proof of step 1.
const tapTarget=p=>p.evaluate(()=>{ var t=document.querySelector('.targetable'); if(!t) return false; t.click(); return true; });
const respQuicks=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' ')));
const respondWith=(p,re)=>p.evaluate(src=>{
  var b=[].slice.call(document.querySelectorAll('.respQuick')).filter(x=>new RegExp(src,'i').test(x.textContent))[0];
  if(!b) return false; b.click(); return true;
}, re);

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node nettest_quickwedge.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  const energy=n=>{ const e=[]; for(let i=0;i<13;i++) e.push(D(3,n,'e'+i)); return e; };
  const stage=()=>host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),{
    hands:[[D(5,'S','sab'),D(9,'C'),D(6,'S')],                 // host: ♠5 Sabotage — removeEquip, TARGETED
           [D(5,'H','ann'),D(10,'D'),D(8,'C')]],               // client: ♥5 Annoint — protect, a Quick at base
    energies:[energy('S'), energy('H')],
    shields:[3,3],
    // the client OWNS the Equipment Sabotage aims at — without it the cast is refused and nothing opens
    opts:{ equip:{ 1:[{ id:'bow', name:'Holy Bow', delta:2, counters:3 }] } }
  });

  let staged=false;
  for(let i=0;i<8 && !staged;i++){
    await stage();
    staged=await until(async()=>await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="sab5S"]')), 12)
        && await until(async()=>await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="ann5H"]')), 12);
  }
  ok(staged, 'staged: host holds Sabotage (♠5) and the CLIENT holds Annoint (♥5), each asserted on its own board');
  const eq=await host.evaluate(()=>{ const c=window.__cmf; return (c&&c.equipOf)?c.equipOf(1).length:document.querySelectorAll('.targetable, .eqBox, .eq').length; });
  ok(eq>0, `the client's Equipment is on the board for Sabotage to aim at (${eq})`);
  ok(await until(async()=>await turnOf(host)===0, 60), "it is the host's turn");

  let how=null;
  await until(async()=>{ how=await armCast(host,'sab5S'); return how==='icon'||how==='ctx'; }, 60);
  ok(how==='icon'||how==='ctx', `the host arms Sabotage on its own turn (via ${how})`+(how==='icon'||how==='ctx'?'':'  ← '+how));
  /* `.targetable` only exists while `targeting` is set, so tapping it proves the two-step cast really
     entered its second step rather than having been played outright. */
  ok(await until(async()=>await tapTarget(host), 40), 'and taps the client’s Equipment — the second step of a targeted cast (doRemove)');

  const opened=await until(async()=>(await respQuicks(join)).length>0, 60);
  const offers=await respQuicks(join);
  ok(opened, 'Sabotage opened a response window on the CLIENT'+(opened?'':'  ← nothing offered; check the Equipment staging'));
  ok(offers.some(t=>/Annoint/i.test(t)), `…offering Annoint by name [${offers.map(t=>t.split(' ')[0]).join('|')}]`);
  ok(await respondWith(join,'Annoint'), 'the client ANSWERS with it — this is the path `nettest_ridewedge` does not cover, which declines');

  /* THE ASSERTION THIS SUITE EXISTS FOR. In the reported game `hostTakeBack()` was never reached: the host
     sat on its own live turn with a dead board while `startParkBeat` re-broadcast an unchanging mirror every
     1.8s — which is why the connection looked perfectly healthy from both seats. */
  const live=await until(async()=>await boardUsable(host), 90);
  ok(live, 'THE HOST TAKES CONTROL BACK after the client answers its targeted Technique — no wedge'+
     (live?'':'  ← WEDGED; host: '+JSON.stringify(await why(host))+'  client: '+JSON.stringify(await why(join))));

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
