/* THE HOST ACTIVATES A **RIDE** ON ITS OWN TURN, AND THE CLIENT DECLINES THE WINDOW IT OPENS.
 *
 * Aj hit this in a real duel (2026-09-16, both ends of the log saved): round 8, the client played a Special
 * Pair, the host called a Ride — Giant Owl — on its own turn, the client declined, and the HOST WEDGED. Its
 * board read "your turn" with "Hold on — the board is still resolving", i.e. `busy` left set; the client sat
 * correctly on "Rival is fighting…" receiving `startParkBeat`'s mirror every 1.8s forever. The backlog entry
 * is `[id: duel-activate-wedge]`.
 *
 * WHY A NEW SUITE RATHER THAN A LEG IN `nettest_actloop`: that suite's LEG 1 already covers a host activating
 * on its own turn and asserts the board stays usable afterwards — and it is GREEN. It activates a **Technique**
 * (Gather Energy, A♦). Aj's case was a **Ride**, and the transform branch is a different path: CLAUDE.md lists
 * "the transform/Ride branch" among the five sites that each needed their own client guard added separately,
 * and `keepsTheWin` is wired into `pick()` AND the transform branch because "transform does not go through
 * `pick`". So the covered path and the reported path only look alike.
 *
 * TWO THINGS THE STAGING MUST GET RIGHT, both of which make the suite pass vacuously if missed:
 *   - THE TRANSFORM GATE. `TRANSFORM_GATE` defaults to 'table': a tier opens only once total shields lost
 *     across the table reaches `numPlayers × lvl`. A Jack is tier 1, so a duel needs TWO shields lost before a
 *     Ride can be called at all — hence the staged 3/3. At a fresh 4/4 the Ride is simply refused and the
 *     suite would report "no wedge" having never activated anything.
 *   - THE WINDOW MUST ACTUALLY OPEN. If the client cannot respond there is nothing to decline and nothing to
 *     resume from, so the wedge cannot occur. The client is staged holding a Quick and the window is asserted
 *     on the CLIENT's own board before the decline.
 *
 * IT REPRODUCED, AND THE FIX IS IN THE SAME COMMIT. Before: 8 pass / 1 fail, with the captured state matching
 * Aj's two screenshots exactly — host `turn=0 pending=false fightDisabled=true`, hint "Hold on — the board is
 * still resolving", message "You called your Ride — Giant Owl enters"; client "Rival is fighting…". After: 9/0.
 * `pending:false` is the decisive half — the stack was EMPTY and no window was open, so nothing was left to
 * resolve and the host had simply never cleared `busy`.
 * THE CAUSE: the `transform` branch of the activation path settled with a bare `render()`, while every other
 * effect goes through `NET.hostAfterOwnCast` → `hostRivalWindows` → `hostTakeBack()`. Its comment still read
 * "persists, no response window" — true once, false since the stack model.
 * TWO STAGING FACTS THIS SUITE PAID FOR, both of which make it pass VACUOUSLY if lost:
 *   - THE TRANSFORM GATE. 3/3 shields = two lost table-wide = `numPlayers × 1`, which is what opens the Jack
 *     tier. At a fresh 4/4 the Ride is refused and the run reports "no wedge" having activated nothing.
 *   - THE CLIENT'S QUICK MUST BE UNTARGETED. The first version staged Counter Spell (4♦) and NO window opened,
 *     because Counter Spell targets an effect on the stack and `canCastQuick` refuses a cast with no legal
 *     target. Armor Piercing (♣7 under Hippolyta ♣Q) is `onWin` and targets nothing — which is exactly why the
 *     reported game's client was offered it. Its `pitchHigh` also needs a Broadway card in hand.
 * Run: node nettest_ridewedge.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { enterFight } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8365),ROOM='RW'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* LIVENESS, not appearance. "Both Fight and Pass disabled" is the CORRECT resting state for a seat that just
 * won a round (nettest_mirrordrop documents it), so the only honest probe is: select a card, does Fight light
 * up — and click back, because a probe that clicks must click back. */
const boardUsable=p=>p.evaluate(()=>{
  var rs=((document.getElementById('rivalStatus')||{}).textContent||'').trim();
  if(rs!=='') return false;                                  // still parked on the opponent
  var c=document.querySelector('#hand .card'); if(!c) return false;
  c.click();
  var f=document.getElementById('fightBtn'), okNow=!!(f && !f.disabled);
  c.click();
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  return okNow;
});
const activate=(p,id)=>p.evaluate(cid=>{
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function(c){ c.click(); });
  var c=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!c) return 'no card';
  c.click();
  var ca=document.getElementById('cardActivate'), cx=document.getElementById('ctxBtn');
  if(ca && ca.offsetParent!==null && !ca.disabled && !/off/.test(ca.className)){ ca.click(); return 'icon'; }
  if(cx && !cx.disabled && !/off/.test(cx.className) && /Activate/i.test(cx.textContent||'')){ cx.click(); return 'ctx'; }
  return 'not offerable';
}, id);
/* A RED RUN MUST EXPLAIN ITSELF — today's whole lesson is that the answer was in the first trace anyone
 * bothered to capture. Print the refusal state rather than a bare false. */
const why=p=>p.evaluate(()=>{
  var f=document.getElementById('fightBtn');
  return {
    rivalStatus: ((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
    hint: ((document.getElementById('hint')||{}).textContent||'').trim().slice(0,80),
    message: ((document.getElementById('message')||{}).textContent||'').trim().slice(0,80),
    turn: (window.__cmf?window.__cmf.turn():null),
    pending: (window.__cmf?window.__cmf.pending():null),
    fightDisabled: !!(f && f.disabled),
    handCards: document.querySelectorAll('#hand .card').length
  };
});
const declineOn=p=>p.evaluate(()=>{ var b=document.getElementById('respDecline'); if(b && b.offsetParent!==null){ b.click(); return true; } return false; });
const windowOpenOn=p=>p.evaluate(()=>{ var b=document.getElementById('respDecline'); return !!(b && b.offsetParent!==null); });

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node '+'nettest_ridewedge.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  /* 3/3 shields = TWO lost table-wide, which is exactly `numPlayers × 1` and opens the Jack (Ride) tier.
   * The client holds Counter Spell (4♦) so the window it is offered is real rather than an auto-pass. */
  /* THE CLIENT'S QUICK IS **ARMOR PIERCING (♣7) UNDER HIPPOLYTA (♣Q)**, copied from `resolutiontest_ui`'s
     `stagePierce`, and the first version of this probe got it wrong in an instructive way. It staged COUNTER
     SPELL (4♦) and no window opened at all — because Counter Spell **targets an effect on the stack**, and
     `canCastQuick` refuses a cast with no legal target, so it was never castable against a transform. Armor
     Piercing is `onWin` and targets nothing, which is why the reported game's client was offered it.
     The pitch card is load-bearing too: Armor Piercing carries `pitchHigh`, so the hand needs a Broadway
     card (10/J/Q/K/A) or the cast is refused for a reason that looks like "no window opened". */
  const energy=n=>{ const e=[]; for(let i=0;i<13;i++) e.push(D(3,n,'e'+i)); return e; };
  const stage=()=>host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),{
    hands:[[D(11,'D'),D(9,'C'),D(6,'S')],                      // host: J♦ = Giant Owl, the Ride that wedged
           [D(7,'C','ap'),D(10,'D','pitch'),D(8,'H')]],        // client: ♣7 Armor Piercing + a Broadway pitch
    energies:[energy('D'), energy('C')],
    shields:[3,3],                                             // two lost table-wide = numPlayers × 1 → Jack tier open
    opts:{ forms:{ 1:[{rank:12,suit:'C',tier:'queen',name:'Hippolyta'}] } }   // Hippolyta makes ♣7 a Quick
  });

  let staged=false;
  for(let i=0;i<8 && !staged;i++){
    await stage();
    staged=await until(async()=>await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="11D"]')), 12)
        && await until(async()=>await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="ap7C"]')), 12);
  }
  /* ASSERT THE STAGING ON BOTH BOARDS, not from force() returning true — a client that does not actually
     hold the Quick produces "no window opened", which reads as the bug being absent. */
  ok(staged, 'staged: host holds Giant Owl (J♦) and the CLIENT holds Armor Piercing (♣7), both asserted on their own boards');
  const elig=await join.evaluate(()=>{ const c=window.__cmf; return c&&c.handOf?c.handOf(0).length:-1; });
  ok(elig>0, `the client's hand reached it (${elig} cards)`);
  ok(await until(async()=>await turnOf(host)===0, 60), "it is the host's turn");

  let how=null;
  await until(async()=>{ how=await activate(host,'11D'); return how==='icon'||how==='ctx'; }, 60);
  ok(how==='icon'||how==='ctx', `the host can call the Ride on its own turn (via ${how})`+(how && how!=='icon' && how!=='ctx' ? '  ← '+how+'; if "not offerable" the TRANSFORM GATE is shut — a Jack is tier 1 and a duel needs 2 shields lost table-wide' : ''));

  /* THE WINDOW MUST REALLY OPEN ON THE CLIENT, or there is nothing to decline and the wedge cannot occur —
   * a suite that skipped this would report a healthy board and prove nothing. */
  const opened=await until(async()=>await windowOpenOn(join), 60);
  ok(opened, 'the Ride opened a response window on the CLIENT');
  ok(await declineOn(join), 'the client declines it');

  /* THE ASSERTION THIS SUITE EXISTS FOR. `hostTakeBack()` is the only thing that clears `busy`, and in the
   * reported game it was never reached: the host sat on its own live turn with a dead board while the park
   * beat re-broadcast an unchanging mirror every 1.8s, which is why the connection looked fine. */
  const live=await until(async()=>await boardUsable(host), 80);
  ok(live, 'THE HOST TAKES CONTROL BACK after its own Ride resolves — no wedge'+(live?'':'  ← WEDGED; host: '+JSON.stringify(await why(host))+'  client: '+JSON.stringify(await why(join))));

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
