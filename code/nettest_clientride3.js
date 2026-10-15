/* A CLIENT CALLS A RIDE AT A 3-PLAYER TABLE AND **ANOTHER CLIENT** GETS THE WINDOW
 * (client-transform-window-undriven, 2026-10-12) — `hostApplyMoveN`'s copy, which a duel NEVER reaches.
 *
 * `nettest_clientride` covers the duel, where a client's Ride settles through `hostSettle` →
 * `hostRivalContinue`. At 3-6 players the same intent takes a different road: `hostApplyMoveN`'s `activate`
 * arm applies it and calls `driveN()`, whose `step` prompts the host for its own priority, parks a remote
 * seat's window on `netReact` and resumes on its answer, and finally parks on the CASTER's own turn
 * (`netParked`) — because a Ride is an activation in its Main Sub-Phase, not the end of its turn. The two
 * handler families have been missed four times by fixes that covered one, so each gets its own suite.
 *
 *   A  CLIENT 2 holds the Quick and DECLINES — the remote-window park, nothing else
 *   B  CLIENT 2 ANSWERS, and the HOST holds a Quick too, so the host's own modal opens against client 2's
 *      answer in the middle of client 1's activation — both park kinds in one go-round
 * Each leg asserts the windows really opened, the Ride landed on ALL THREE screens, the screens agree on the
 * caster's hand after its draw, and the CASTER gets its board back while the table moves.
 *
 * Staging is `nettest_clientride`'s, scaled: 3/3/3 shields is three lost table-wide = numPlayers × 1, which
 * opens the Jack tier; client 2's Quick is Armor Piercing under Hippolyta with one Broadway pitch; the host's
 * is Leyline (♦9), castable with nothing to aim at; `prompts=all` because a Ride is not a shield event.
 * Run: node nettest_clientride3.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const { selectAndFight, respQuicks, clickQuick, windowUp, clickDecline } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8484),ROOM='C3'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const EN=(s,t)=>Array.from({length:13},(_,i)=>D(3,s,t+i));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
let host, c1, c2;

const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const idsOn=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).sort().join(','));
const handOnHost=seat=>host.evaluate(s=>window.__cmf.handOf(s), seat);                  // the HOST's copy — the ground truth
const windowOn=windowUp;   // the shared visible-only reads — see fightclick.js
const declineOn=clickDecline;
/* VISIBLE, NOT PRESENT — a hidden modal keeps its buttons; see `nettest_clientride`, whose first cut "cast" a
   previous window's button 3ms after the Ride and went green having cast nothing. */
const quickBtnOn=(p,id)=>respQuicks(p, '.respQuick[data-id="'+id+'"]').then(a=>a.length>0);
const castOn=(p,id)=>clickQuick(p, null, '.respQuick[data-id="'+id+'"]').then(t=>t!=null);
/* THE RIDE ON SCREEN, by name: the caster's own zone on its board, and the gear line of its OPPONENT PANEL on
   every other board (seat numbers are LOCAL to each page, so the panel is found by content, not by index). */
const rideMine=(p,name)=>p.evaluate(n=>[].slice.call(document.querySelectorAll('#youFormZone .formChip.ride, #youFormZone .formMini.ride')).some(c=>(c.title||'').indexOf(n)===0), name);
const rideInPanel=(p,name)=>p.evaluate(n=>[].slice.call(document.querySelectorAll('.oppPanel .oppGear .f')).some(f=>(f.textContent||'').indexOf(n)>=0), name);
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
const why=p=>p.evaluate(()=>{
  var f=document.getElementById('fightBtn');
  return { rivalStatus:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
           hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,60),
           turn:(window.__cmf?window.__cmf.turn():null), pending:(window.__cmf?window.__cmf.pending():null),
           fightDisabled:!!(f && f.disabled), window:!!((document.querySelector('#respDecline')||{}).offsetParent), hand:document.querySelectorAll('#hand .card').length };
});
const all=async()=>'host '+JSON.stringify(await why(host))+'  c1 '+JSON.stringify(await why(c1))+'  c2 '+JSON.stringify(await why(c2));

const HIPPOLYTA={rank:12,suit:'C',tier:'queen',name:'Hippolyta'};
const C1_HAND=()=>[D(11,'D','cr'),D(6,'H','c'),D(8,'S','c'),D(5,'C','c')];            // J♦ Giant Owl + three cards that are no Quick
const C2_HAND=()=>[D(7,'C','ap'),D(10,'D','bp'),D(4,'S','b')];                       // ♣7 Armor Piercing · one Broadway pitch · a filler

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_clientride3.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await wait(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await ready(c1); await wait(300); await ready(c2);
  await until(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6), '3-Rider game started');
  /* ⚠ THE OPENING ROUND CARD MUST LAND FIRST — when it does, `startGame` calls `driveRival()` → `driveN()` if
     the turn is not the host's, which parks the host on the caster by itself. `nettest_clientride` measured
     that rescuing a build with the hand-back deleted. */
  ok(await until(()=>host.evaluate(()=>!(document.getElementById('roundfx')||{}).className), 80), 'the host’s opening round card has finished, so nothing else can drive the table');

  /* STAGE, AND VERIFY IT ON EVERY SEAT, zones included — see `nettest_heldplay3` on half-checked stages. */
  async function stage(hostHand){
    const hands=[hostHand, C1_HAND(), C2_HAND()], pg=[host,c1,c2], want=hands.map(h=>h.map(c=>c.id).sort().join(','));
    for(let i=0;i<8;i++){
      await host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),{
        hands, energies:[EN('D','he'), EN('D','ce'), EN('C','be')], shields:[3,3,3],
        opts:{ round:3, turn:1, forms:{ 0:[], 1:[], 2:[HIPPOLYTA] } } });          // Hippolyta makes client 2's ♣7 a Quick
      const landed=await until(async()=>{
        for(let s=0;s<3;s++){ if((await idsOn(pg[s]))!==want[s]) return false; }
        return (await turnOf(c1))===0 && !(await rideMine(c1,'Giant Owl')) && !(await rideInPanel(host,'Giant Owl')) && !(await rideInPanel(c2,'Giant Owl'));
      }, 16);
      if(landed) return true;
    }
    console.log('   ⏱ stage never landed — '+(await idsOn(host))+' | '+(await idsOn(c1))+' | '+(await idsOn(c2))+'  want '+want.join(' | '));
    return false;
  }
  async function callRide(){
    let how=null;
    await until(async()=>{ how=await activate(c1,'cr11D'); return how==='icon'||how==='ctx'; }, 40);
    return how;
  }
  async function clientPlays(id){
    let done=false;
    const decl=(async()=>{ while(!done){ await declineOn(host); await declineOn(c1); await declineOn(c2); await wait(120); } })();
    const how=await selectAndFight(c1,[id]);
    const gone=await until(async()=>(await handOnHost(1)).indexOf(id)<0, 80);
    done=true; await decl;
    return { how, gone };
  }
  async function afterRide(leg, handBefore){
    ok(await until(()=>rideMine(c1,'Giant Owl'), 80), leg+': the Ride landed — Giant Owl is in client 1’s zone on ITS screen'+(await rideMine(c1,'Giant Owl')?'':'  ← '+await all()));
    ok(await until(()=>rideInPanel(host,'Giant Owl'), 40), leg+':   → and on the HOST’s screen, in client 1’s panel');
    ok(await until(()=>rideInPanel(c2,'Giant Owl'), 40), leg+':   → and on CLIENT 2’s screen');
    let h=[], mine=-1;
    const agree=await until(async()=>{ h=await handOnHost(1); mine=await c1.evaluate(()=>document.querySelectorAll('#hand .card').length); return h.length===handBefore && mine===handBefore && h.indexOf('cr11D')<0; }, 60);
    ok(agree, leg+':   → client 1 drew for it, and its screen agrees with the host’s ('+mine+' on its own, '+h.length+' on the host’s, '+handBefore+' expected)');
    const live=await until(async()=>(await turnOf(c1))===0 && await boardUsable(c1), 80);
    ok(live, leg+': CLIENT 1 GETS ITS BOARD BACK — still its turn, and a selection lights Fight'+(live?'':'  ← WEDGED; '+await all()));
    const parked=await until(async()=>/is playing/.test((await why(host)).rivalStatus) && (await turnOf(host))===1, 40);
    ok(parked, leg+':   → and the host parks on client 1’s turn ("'+(await why(host)).rivalStatus+'")'+(parked?'':'  ← '+await all()));
    const mv=await clientPlays('c6H');
    ok(mv.gone, leg+': and the table MOVES — client 1’s next play lands through the host ('+mv.how+')'+(mv.gone?'':'  ← '+await all()));
  }

  // ================= A: client 2 DECLINES =================
  ok(await stage([D(6,'S','h'),D(4,'H','h'),D(8,'C','h')]), 'A: staged — client 1 holds Giant Owl on its turn, client 2 holds Armor Piercing under Hippolyta, the host holds nothing castable');
  const howA=await callRide();
  ok(howA==='icon'||howA==='ctx', 'A: client 1 can call the Ride (via '+howA+')'+(howA==='not offerable'?'  ← if the TRANSFORM GATE is shut, a Jack needs 3 shields lost table-wide here':''));
  const openA=await until(()=>quickBtnOn(c2,'ap7C'), 80);
  ok(openA, 'A: the Ride opened a window on CLIENT 2, offering Armor Piercing'+(openA?'':'  ← '+await all()));
  ok(await declineOn(c2), 'A: client 2 declines it');
  await afterRide('A', C1_HAND().length);

  /* ================= B: client 2 ANSWERS, and the host is asked against it =================
     The go-round runs 1 → 2 → 0 from the caster. Client 2 answers; its Armor Piercing goes on top and the
     walk reaches the host, whose Leyline is castable against anything — so the host's OWN modal opens in
     the middle of a remote seat's activation. The script answers client 2's window once and declines every
     other window; the host's ledger names what its windows were against. */
  ok(await stage([D(9,'D','hq'),D(4,'H','h'),D(8,'C','h')]), 'B: re-staged — and the host now holds Leyline (♦9)');
  const ledgerB0=(await host.evaluate(()=>window.__cmf.prioLog())).length;
  const howB=await callRide();
  ok(howB==='icon'||howB==='ctx', 'B: client 1 calls the Ride again (via '+howB+')');
  const events=[]; let answered=false; const tB=Date.now();
  while(Date.now()-tB<30000){
    if(!answered && await quickBtnOn(c2,'ap7C')){ answered=await castOn(c2,'ap7C'); if(answered) events.push('c2 answers'); await wait(250); continue; }
    if(await windowOn(host)){ await declineOn(host); events.push('host'); await wait(250); continue; }
    if(answered && await windowOn(c2)){ await declineOn(c2); events.push('c2'); await wait(250); continue; }
    if(await windowOn(c1)){ await declineOn(c1); events.push('c1'); await wait(250); continue; }
    if(answered && await rideMine(c1,'Giant Owl')) break;
    await wait(100);
  }
  const spentB=await until(async()=>{ const hh=await handOnHost(2); return hh.indexOf('ap7C')<0 && hh.indexOf('bp10D')<0; }, 40);
  ok(spentB, 'B: CLIENT 2 ANSWERED — Armor Piercing and its pitch left its hand  [order of windows: '+events.join(' → ')+']'+(spentB?'':'  ← '+await all()));
  const shownB=(await host.evaluate(()=>window.__cmf.prioLog())).slice(ledgerB0).filter(l=>/window SHOWN to you/.test(l));
  const against=shownB.map(l=>(/vs (.+?)\s{2}/.exec(l)||[])[1]||'?');
  ok(against.indexOf('Armor Piercing')>=0, 'B: THE HOST’S OWN WINDOW OPENED against client 2’s answer, inside client 1’s activation  [host windows vs: '+against.join(', ')+']'+(against.indexOf('Armor Piercing')>=0?'':'  ← '+await all()));
  ok((await idsOn(host)).split(',').indexOf('hq9D')>=0, 'B:   → and declining spent nothing: the host still holds Leyline');
  await afterRide('B', C1_HAND().length);

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
