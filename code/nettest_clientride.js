/* A CLIENT CALLS A RIDE AND THE **HOST** GETS THE WINDOW (client-transform-window-undriven, 2026-10-12).
 *
 * `nettest_ridewedge` drives the other direction — the HOST calls a Ride, the CLIENT gets the window — and it
 * exists because that path wedged a real duel. This direction had no suite at all. A client's Ride reaches
 * `hostApplyMove`'s `activate` arm, which settles through `hostSettle` (the host's own window pops its modal; a
 * window owed back to the client parks on `netSettle`) and then `hostRivalContinue`, which must hand the board
 * BACK to the client: a Ride is an activation in its Main Sub-Phase, not the end of its turn. Both defects the
 * stack-model build's transform piece exposed were in driver code of exactly this kind.
 *
 * THREE LEGS, ONE STAGING, varied only in what the windows do:
 *   A  the host DECLINES — the plain case
 *   B  the host ANSWERS with a Quick — its object goes on top and resolves, then the Ride does
 *   C  the host answers and the CLIENT IS ASKED AGAIN (it holds Leyline) — the counter-back park on
 *      `netSettle`, which neither plain case reaches
 * Each leg asserts the window really opened (a window that never opens makes every later line vacuous), that
 * the Ride really landed on BOTH screens, that the two screens agree on the client's hand after its draw, and
 * that the CLIENT gets its board back and the table moves.
 *
 * STAGING, and why each fact is there:
 *   - 3/3 shields: two lost table-wide = numPlayers × 1, which opens the Jack tier (`TRANSFORM_GATE`). At a
 *     fresh 4/4 the Ride is refused and every line after it tests nothing.
 *   - the host's Quick is ARMOR PIERCING (♣7) UNDER HIPPOLYTA (♣Q), with ONE Broadway card for its pitch (one
 *     card → one button). Counter Spell cannot name a Ride — its text says Technique — so it is not castable
 *     here at all, and staging it is how `nettest_ridewedge`'s first cut opened no window.
 *   - `prompts=all`: a Ride is not a shield event, so on the AUTO default nobody would be interrupted and the
 *     windows this suite exists to drive would never open.
 *   - the client's turn comes from `forceAll(turn:1)` taken from a Main Sub-Phase (the deal's, then each leg's
 *     own turn hand-over), so the Ride is legal for it. Its other cards are no Quick at base.
 * Run: node nettest_clientride.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { selectAndFight, respQuicks, clickQuick, windowUp, clickDecline } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8483),ROOM='CR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const EN=(s,t)=>Array.from({length:13},(_,i)=>D(3,s,t+i));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
let host, join;

const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const idsOn=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).sort().join(','));
const clientHandOnHost=()=>host.evaluate(()=>window.__cmf.handOf(1));         // the HOST's copy — the ground truth
const windowOn=windowUp;   // the shared visible-only reads — see fightclick.js
const declineOn=clickDecline;
/* ⚠ VISIBLE, NOT PRESENT. `hideOverlay` hides the modal and leaves its buttons in the DOM, so a bare
   `querySelector` finds the PREVIOUS window's Armor Piercing button long after that window closed — and a
   `.click()` on a hidden button still runs its handler. The first cut of leg C did exactly that: it "cast"
   3ms after the Ride, before the host held priority at all, the engine answered "No response window.", the
   real window then opened unwatched, `netwindows` passed it after its grace, and the leg went GREEN having
   cast nothing. Legs A and B had the same race and won it on timing. */
const quickBtnOn=(p,id)=>respQuicks(p, '.respQuick[data-id="'+id+'"]').then(a=>a.length>0);
const castOn=(p,id)=>clickQuick(p, null, '.respQuick[data-id="'+id+'"]').then(t=>t!=null);
/* THE RIDE ON SCREEN, by name. Collapsed, a zone shows `.formChip` chips; expanded, `.formMini` cards — both
   carry the Form's name in their title, which is the one thing that says WHICH card landed. */
const rideOn=(p,zone,name)=>p.evaluate(a=>[].slice.call(document.querySelectorAll(a.zone+' .formChip.ride, '+a.zone+' .formMini.ride')).some(c=>(c.title||'').indexOf(a.name)===0), {zone, name});
/* LIVENESS, not appearance — select a card, does Fight light up, and click back (a probe that clicks must
   click back; `nettest_actloop` lost runs to a probe that did not). */
const boardUsable=p=>p.evaluate(()=>{
  var rs=((document.getElementById('rivalStatus')||{}).textContent||'').trim();
  if(rs!=='') return false;
  if(/Hold on/.test((document.getElementById('hint')||{}).textContent||'')) return false;
  /* TRY EVERY GROUP, NOT THE FIRST CARD (drag-and-stack step 1). Fight is live only for a LEGAL selection in Main
     now too, so a first card that cannot beat the pile no longer means the board is dead; a live Pass counts as
     well. Every probe click is clicked back — a probe that clicks must leave no selection behind. */
  var f=document.getElementById('fightBtn'), pb=document.getElementById('passBtn');
  var okNow=!!(pb && pb.offsetParent!==null && !pb.disabled && /Pass/.test(pb.textContent||''));
  var gs=[].slice.call(document.querySelectorAll('#hand .group')); if(!gs.length && !okNow) return false;
  for(var i=0;i<gs.length && !okNow;i++){ gs[i].click(); okNow=!!(f && !f.disabled); gs[i].click(); }
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
  if(cx && cx.offsetParent!==null && !cx.disabled && !/off/.test(cx.className) && /Activate/i.test(cx.textContent||'')){ cx.click(); return 'ctx'; }
  return 'not offerable';
}, id);
/* A RED RUN MUST EXPLAIN ITSELF — both boards, in the words each screen is showing. */
const why=p=>p.evaluate(()=>{
  var f=document.getElementById('fightBtn');
  return { rivalStatus:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
           hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,70),
           message:((document.getElementById('message')||{}).textContent||'').trim().slice(0,70),
           turn:(window.__cmf?window.__cmf.turn():null), pending:(window.__cmf?window.__cmf.pending():null),
           fightDisabled:!!(f && f.disabled), window:!!((document.querySelector('#respDecline')||{}).offsetParent), hand:document.querySelectorAll('#hand .card').length };
});
const both=async()=>'host '+JSON.stringify(await why(host))+'  client '+JSON.stringify(await why(join));

const HIPPOLYTA={rank:12,suit:'C',tier:'queen',name:'Hippolyta'};
const HOST_HAND=()=>[D(7,'C','ap'),D(10,'D','hp'),D(4,'H','h')];     // ♣7 Armor Piercing · one Broadway pitch · a filler

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node nettest_clientride.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  /* STAGE, AND VERIFY IT ON BOTH BOARDS — a client still holding a previous leg's cards takes a window
     nobody scripted, and the leg then reports on a board it never set up. */
  async function stage(clientHand){
    const want=[HOST_HAND().map(c=>c.id).sort().join(','), clientHand.map(c=>c.id).sort().join(',')];
    for(let i=0;i<8;i++){
      await host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),{
        hands:[HOST_HAND(), clientHand], energies:[EN('C','he'), EN('D','ce')], shields:[3,3],
        opts:{ round:3, turn:1, forms:{ 0:[HIPPOLYTA], 1:[] } } });   // Hippolyta makes ♣7 a Quick; the client's zone starts empty every leg
      /* …AND THE ZONE IS EMPTY ON BOTH SCREENS: a later leg's "the Ride landed" would otherwise pass on the
         previous leg's Giant Owl. */
      const landed=await until(async()=>(await idsOn(host))===want[0] && (await idsOn(join))===want[1] && (await turnOf(join))===0
                                        && !(await rideOn(join,'#youFormZone','Giant Owl')) && !(await rideOn(host,'#rivalFormZone','Giant Owl')), 16);
      if(landed) return true;
    }
    console.log('   ⏱ stage never landed — host '+(await idsOn(host))+' | client '+(await idsOn(join))+'  want '+want.join(' | '));
    return false;
  }
  /* THE CLIENT CALLS GIANT OWL. Retried, because `busy` swallows a click silently while a mirror settles. */
  async function callRide(){
    let how=null;
    await until(async()=>{ how=await activate(join,'cr11D'); return how==='icon'||how==='ctx'; }, 40);
    return how;
  }
  /* THE TABLE MOVES: the client's next play goes down THROUGH THE HOST (the host's copy of its hand is the
     witness). Any window the play's own transition opens — the host still holds its Quick in leg A, and the
     client's drawn card may be one — is declined on both seats while it happens. */
  async function clientPlays(id){
    let done=false;
    const decl=(async()=>{ while(!done){ await declineOn(host); await declineOn(join); await wait(120); } })();
    const how=await selectAndFight(join,[id]);
    const gone=await until(async()=>(await clientHandOnHost()).indexOf(id)<0, 80);
    done=true; await decl;
    return { how, gone };
  }
  /* WHAT EVERY LEG CLAIMS ONCE ITS WINDOWS ARE DONE — the leg differs only in how it got here. */
  async function afterRide(leg, handBefore){
    ok(await until(()=>rideOn(join,'#youFormZone','Giant Owl'), 80), leg+': the Ride landed — Giant Owl is in the client’s zone on the CLIENT’s screen'+(await rideOn(join,'#youFormZone','Giant Owl')?'':'  ← '+await both()));
    ok(await until(()=>rideOn(host,'#rivalFormZone','Giant Owl'), 40), leg+':   → and on the HOST’s screen');
    /* A Ride DRAWS on resolution (`TRANSFORM_DRAW`), so the J leaves and one card arrives. Polled, because the
       client's copy legitimately trails the host's by one mirror. */
    let h=[], mine=-1;
    const agree=await until(async()=>{ h=await clientHandOnHost(); mine=await join.evaluate(()=>document.querySelectorAll('#hand .card').length); return h.length===handBefore && mine===handBefore && h.indexOf('cr11D')<0; }, 60);
    ok(agree, leg+':   → the client drew for it, and both screens agree on its hand ('+mine+' on its own, '+h.length+' on the host’s, '+handBefore+' expected)');
    const live=await until(async()=>(await turnOf(join))===0 && await boardUsable(join), 80);
    ok(live, leg+': THE CLIENT GETS ITS BOARD BACK — still its turn, and a selection lights Fight'+(live?'':'  ← WEDGED; '+await both()));
    const parked=await until(async()=>/Waiting for opponent/.test((await why(host)).rivalStatus) && (await turnOf(host))===1, 40);
    ok(parked, leg+':   → and the host waits on the client rather than holding a board of its own'+(parked?'':'  ← '+await both()));
    const mv=await clientPlays('c6H');
    ok(mv.gone, leg+': and the table MOVES — the client’s next play lands through the host ('+mv.how+')'+(mv.gone?'':'  ← '+await both()));
  }

  /* ⚠ WAIT OUT THE HOST'S OPENING ROUND CARD BEFORE STAGING. `startDuel` returns once the hands are dealt, and
     the host's "Round 1" card is still flying then; when it lands, `startGame` calls `driveRival()` if the
     turn is not the host's — and with the turn forced to the client, that parks the host on the client by
     itself, ~1.2s after whatever leg A is doing. It RESCUED A BROKEN BUILD: with the hand-back after a
     client's Ride deleted (`hostRivalContinue` dropped from the `activate` arm), legs B and C went red and
     leg A stayed green on exactly this call. `fin()` clears `#roundfx` when the card is done. */
  ok(await until(()=>host.evaluate(()=>!(document.getElementById('roundfx')||{}).className), 80), 'the host’s opening round card has finished, so nothing else can park it on the client');

  // ================= A: the host DECLINES =================
  const handA=[D(11,'D','cr'),D(6,'H','c'),D(8,'S','c'),D(5,'C','c')];
  ok(await stage(handA), 'A: staged — the client holds Giant Owl (J♦) on its turn, the host holds Armor Piercing under Hippolyta');
  const howA=await callRide();
  ok(howA==='icon'||howA==='ctx', 'A: the client can call the Ride (via '+howA+')'+(howA==='not offerable'?'  ← if the TRANSFORM GATE is shut, a Jack needs 2 shields lost table-wide':''));
  const openA=await until(()=>quickBtnOn(host,'ap7C'), 80);
  ok(openA, 'A: the Ride opened a window on the HOST, offering Armor Piercing'+(openA?'':'  ← '+await both()));
  ok(await declineOn(host), 'A: the host declines it');
  await afterRide('A', handA.length);

  // ================= B: the host ANSWERS =================
  const handB=[D(11,'D','cr'),D(6,'H','c'),D(8,'S','c'),D(5,'C','c')];
  ok(await stage(handB), 'B: re-staged — same board');
  const howB=await callRide();
  ok(howB==='icon'||howB==='ctx', 'B: the client calls the Ride again (via '+howB+')');
  ok(await until(()=>quickBtnOn(host,'ap7C'), 80), 'B: the window opens on the host');
  ok(await castOn(host,'ap7C'), 'B: the host ANSWERS with Armor Piercing');
  const spent=await until(async()=>{ const hh=(await idsOn(host)).split(','); return hh.indexOf('ap7C')<0 && hh.indexOf('hp10D')<0; }, 60);
  ok(spent, 'B:   → it really went on the stack: Armor Piercing and its Broadway pitch both left the host’s hand  ['+(await idsOn(host))+']');
  await afterRide('B', handB.length);

  /* ================= C: the host answers, and the CLIENT IS ASKED AGAIN =================
     The client holds Leyline (♦9), the only base Quick castable with nothing to aim at, so once the host's
     Armor Piercing is on top the go-round reaches the client again — `hostSettle` parks on `netSettle` and
     resumes on its decline, the half neither plain leg touches. The script declines every client window and
     answers the host's once; the claim is read off the CLIENT's own ledger, which names what each window
     was against, so a window that came "after" for some other reason cannot pass for this one. */
  const handC=[D(11,'D','cr'),D(9,'D','cl'),D(6,'H','c'),D(8,'S','c')];
  ok(await stage(handC), 'C: staged — the client also holds Leyline (♦9)');
  const ledgerC0=(await join.evaluate(()=>window.__cmf.prioLog())).length;
  const howC=await callRide();
  ok(howC==='icon'||howC==='ctx', 'C: the client calls the Ride (via '+howC+')');
  const events=[]; let answered=false; const tC=Date.now();
  while(Date.now()-tC<30000){
    if(await windowOn(join)){ await declineOn(join); events.push('client'); await wait(250); continue; }
    if(!answered && await quickBtnOn(host,'ap7C')){ answered=await castOn(host,'ap7C'); if(answered) events.push('host'); await wait(250); continue; }
    if(answered && await rideOn(join,'#youFormZone','Giant Owl')) break;
    await wait(100);
  }
  const spentC=await until(async()=>{ const hh=(await idsOn(host)).split(','); return hh.indexOf('ap7C')<0 && hh.indexOf('hp10D')<0; }, 40);
  ok(spentC, 'C: the host ANSWERED — Armor Piercing and its pitch left its hand  [order of windows: '+events.join(' → ')+']'+(spentC?'':'  ← '+await both()));
  const shownC=(await join.evaluate(()=>window.__cmf.prioLog())).slice(ledgerC0).filter(l=>/window SHOWN to you/.test(l));
  const against=shownC.map(l=>(/vs (.+?)\s{2}/.exec(l)||[])[1]||'?');
  ok(against.indexOf('Armor Piercing')>=0, 'C: THE CLIENT WAS ASKED AGAIN, against the host’s Armor Piercing — the counter-back park, resumed by its decline  [client windows vs: '+against.join(', ')+']'+(against.indexOf('Armor Piercing')>=0?'':'  ← '+await both()));
  ok((await clientHandOnHost()).indexOf('cl9D')>=0, 'C:   → and declining spent nothing: Leyline is still in the client’s hand');
  await afterRide('C', handC.length);

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
