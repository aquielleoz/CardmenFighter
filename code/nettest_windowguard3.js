/* A WINDOW IS JUDGED BY THE GRANT IT IS ON, AT 3-6 PLAYERS (2026-10-16, filed by the drag-and-stack step 4 inventory).
 * AN ANSWER IS FOR ONE GRANT. The duel host learned both halves on 2026-10-07 (`heldAnswer`, `nettest_parity`): an answer names the grant it was
 * shown (`pg`, the `prioGen` it saw), one stamped for an EARLIER grant must not answer the window parked now, and one
 * that arrives BEFORE the host parks on its grant is held and applied at the park. `hostApplyMoveN` had neither: it
 * applied any respond/decline from the parked seat whatever grant it named, and IGNORED one that came early, with the
 * seat's sig spent, so nothing would ask it again.
 *   A  STAGED: the host casts Gather Energy and parks on client 1, who holds Counter Spell (its box is up)
 *   B  a decline stamped for the PREVIOUS grant is DROPPED — named in the host's trace — and the window stays open
 *   C  CONTROL: the real "Let it resolve" closes the same window
 *   D  an answer that BEATS the park is HELD and APPLIED at it — the window closes, nothing is left waiting.
 *      The host parks in the same tick as its own cast, so the gap only exists at a ceremony boundary, which no
 *      staging reaches on demand; `__cmf.parkDelay` (one-shot, ?dbg=1) opens it: the window is mirrored, and the
 *      park comes late — the shape of the real gap, a seat SHOWN its window before the host PARKS on it.
 *   E  SOURCE SCAN: the OTHER N-player park, `driveN`'s, applies a held answer too — it is not staged here
 * AND A TURN OP IS NOT AN ANSWER: `E.moveToPlay` used to open a fresh go-round over any open window, so a guest's
 * second press while the host held priority in its crossing re-granted the host's window (the epic's
 * `nettest_parity` filmed it every 330ms for a hundred seconds). The engine refuses that now, and so does the host's
 * move dispatch, out loud — `hostApplyMoveN`'s copy, which the epic's duel suite (`nettest_windowlock`) never drives.
 *   F  STAGED: client 1 leads a jab; the crossing opens and the HOST holds priority with Leyline (its box is up)
 *   G  a second play sent RAW is REFUSED — named in the host's trace, NO new grant, and client 1 is told why
 *   H  …and the first play is untouched: once the host says No, the 7♠ lands and the refused 8♥ does not
 * Run: node nettest_windowguard3.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const { clickDecline } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8359),ROOM='WG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await host.waitForTimeout(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  await ready(c1); await wait(300); await ready(c2);
  await waitFor(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await waitFor(async()=>(await host.evaluate(()=>window.__cmf.turn()))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6),'3-Rider game started, host leads');
  await waitFor(async()=>await host.evaluate(()=>!/show/.test((document.getElementById('roundfx')||{}).className||'')), 80);

  const trace=()=>host.evaluate(()=>(window.__cmf.trace?window.__cmf.trace():[]).join('\n'));
  const since=async n=>(await trace()).split('\n').slice(n).join('\n');
  const traceLen=async()=>(await trace()).split('\n').length;
  const pending=()=>host.evaluate(()=>window.__cmf.pending());
  const c1Box=()=>c1.evaluate(()=>{ const d=document.getElementById('respDecline'); return !!(d && d.offsetParent!==null && document.getElementById('overlay').classList.contains('show')); });
  const c1Grant=()=>c1.evaluate(()=>{ const s=window.__cmfNetState; return s && s.respondFor===0 && s.pending ? (s.prioGen||0) : null; });
  /* the host holds Gather Energy (1♦), client 1 Counter Spell (4♦) and the ♦ to cast it; client 2 nothing castable */
  const E5=()=>[D(2,'D','e'),D(3,'D','e'),D(4,'C','e'),D(5,'H','e'),D(6,'S','e')];
  const stage=tag=>host.evaluate((a)=>window.__cmf.forceAll(a.hands, a.en), {
    hands:[[D(1,'D',tag),D(7,'C'),D(9,'H')], [D(4,'D'),D(5,'C'),D(8,'S')], [D(6,'C'),D(7,'H'),D(9,'S')]], en:[E5(),E5(),E5()] });
  const cast=id=>host.evaluate((id)=>{ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); var ca=document.getElementById('cardActivate'), ctx=document.getElementById('ctxBtn'); if(ca&&ca.offsetParent!==null&&!ca.disabled)ca.click(); else if(ctx&&!ctx.disabled&&/Activate/i.test(ctx.textContent||''))ctx.click(); }, id);

  // A
  await stage('a'); await wait(600);
  await cast('a1D');
  const upA=await waitFor(c1Box, 60);
  const gA=await c1Grant();
  ok(upA && gA!=null && gA>0 && await pending(), 'A · STAGED: the host cast, parked on client 1, and its box is up (grant '+gA+')');
  // B
  const nB=await traceLen();
  await c1.evaluate((pg)=>window.__cmf.clientSend({op:'decline', pg:pg}), gA-1);
  const dropped=await waitFor(async()=>/answer DROPPED — it was for an earlier grant/.test(await since(nB-1)), 30);
  await wait(800);
  ok(dropped && await pending() && await c1Box(), 'B · A DECLINE STAMPED FOR THE PREVIOUS GRANT IS DROPPED — named in the host\'s trace, and the window stays open  '+JSON.stringify({dropped, pending:await pending()}));
  // C
  const pressed=await clickDecline(c1);
  ok(pressed && await waitFor(async()=>!(await pending()), 40), 'C · CONTROL: the real "Let it resolve" closes the same window');

  // D
  await wait(600); await stage('d'); await wait(600);
  /* THE PARK IS HELD LONGER THAN THE GUEST'S ART-FLASH HOLD (rebased onto v1.34.0, 2026-10-20). Since drag-and-stack
     step 3 every cast holds a seat's board for its art flash (~2.65s), so the guest's box opens that long after the
     cast. A 2500ms park delay then expired first: the host parked, nobody had answered early, the host stayed parked on
     client 1, and F-H staged onto that stuck table. 8000ms keeps the order this leg needs — box, early answer, park. */
  await host.evaluate(()=>window.__cmf.parkDelay(8000));
  const nD=await traceLen();
  await cast('d1D');
  const delayed=await waitFor(async()=>/park DELAYED \(dbg\)/.test(await since(nD-1)), 40, 50);
  const boxD=await waitFor(c1Box, 150, 50);
  const early=boxD && await clickDecline(c1);
  const held=await waitFor(async()=>/answer HELD — its window is not parked yet/.test(await since(nD-1)), 30, 50);
  const applied=await waitFor(async()=>/held answer APPLIED at the park/.test(await since(nD-1)), 60);
  const closed=await waitFor(async()=>!(await pending()), 40);
  ok(delayed && early && held, 'D · STAGED: the park was held back, client 1\'s box opened from the mirror, and its answer reached the host FIRST — held  '+JSON.stringify({delayed, box:boxD, early, held}));
  ok(applied && closed, '  …and APPLIED at the park: the window closes and nothing is left waiting  '+JSON.stringify({applied, closed}));
  await wait(400);
  /* LIVENESS, not a status string: select a card and Fight must light — then click it back (a probe that clicks must
     leave no selection behind). A host still parked on the seat that answered shows the same turn and no error. */
  const live=await host.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="7C"]'))[0]; if(!g) return {g:false};
    g.click(); const f=document.getElementById('fightBtn'); const r={ fight:!!(f && !f.disabled), hint:((document.getElementById('hint')||{}).textContent||'').trim() };
    [].slice.call(document.querySelectorAll('#hand .group.gsel')).forEach(x=>x.click()); return r; });
  ok((await host.evaluate(()=>window.__cmf.turn()))===0 && live.fight, '  …and the host has its board back — a card selected lights Fight, not parked on a seat that already answered  '+JSON.stringify(live));

  // E
  const src=fs.readFileSync(path.join(DIR,'CardmenFighter.template.html'),'utf8');
  const body=name=>{ const i=src.indexOf('function '+name+'('); return i<0?'':src.slice(i, src.indexOf('\n    function ', i+10)); };
  ok(body('hostSettleN').indexOf('if(applyHeldAnswerN()) return;')>0 && body('driveN').indexOf("if(w.kind==='respond' && applyHeldAnswerN()) return;")>0,
     'E · SOURCE SCAN: both N-player parks (`hostSettleN` and `driveN`) apply a held answer the moment they set `netReact`');

  // F
  const shown=()=>host.evaluate(()=>(window.__cmf.prioLog?window.__cmf.prioLog():[]).filter(l=>/window SHOWN to you/.test(l)).length);
  const hostBox=()=>host.evaluate(()=>{ const d=document.getElementById('respDecline'); return !!(d && d.offsetParent!==null && document.getElementById('overlay').classList.contains('show')); });
  await wait(600);
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const En=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(9,'D','hL'),C(3,'C','h'),C(4,'S','h')], [C(7,'S','g'),C(8,'H','g'),C(5,'C','g')], [C(6,'C','k'),C(7,'H','k'),C(9,'S','k')]],
      [En('D','he'), En('C','ge'), En('H','ke')], null, {round:3, turn:1}); });
  await waitFor(async()=>await c1.evaluate(()=>window.__cmf.turn()===0 && !!document.querySelector('#hand .card[data-id="g7S"]')), 60);
  const sF=await shown();
  await c1.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="g7S"]'))[0]; if(g) g.click(); });
  await wait(250);
  await c1.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f && !f.disabled) f.click(); });
  const upF=await waitFor(hostBox, 80);
  ok(upF && (await shown())===sF+1, 'F · STAGED: client 1 led a jab, the crossing opened, and the HOST holds priority — its box is up');
  // G
  const nG=await traceLen();
  await c1.evaluate(()=>window.__cmf.clientSend({op:'play', ids:['g8H']}));
  const refused=await waitFor(async()=>/move REFUSED — a window is open/.test(await since(nG-1)), 40);
  await wait(500);
  const told=await c1.evaluate(()=>/still deciding/.test((document.getElementById('message')||{}).textContent||''));
  const sG=await shown();
  ok(refused && sG===sF+1 && await hostBox(), 'G · A SECOND PLAY SENT RAW IS REFUSED — named in the host\'s trace, and NO new grant: the host\'s window was shown once  '+JSON.stringify({refused, shownSince:sG-sF}));
  ok(told, '  …and client 1 is told why');
  // H
  await host.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d && d.offsetParent) d.click(); });
  const landed=await waitFor(()=>host.evaluate(()=>[...document.querySelectorAll('#pile .card')].some(c=>c.getAttribute('data-id')==='g7S')), 60);
  const extra=await host.evaluate(()=>[...document.querySelectorAll('#pile .card')].some(c=>c.getAttribute('data-id')==='g8H'));
  ok(landed && !extra, 'H · THE FIRST PLAY IS UNTOUCHED — once the host says No, the 7♠ lands, and the refused 8♥ does not');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.log('HARNESS ERROR: '+e.message); process.exit(2);});
