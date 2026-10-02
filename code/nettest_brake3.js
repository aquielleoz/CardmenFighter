/* THE AUTO-PASS BRAKE AT 3-6 PLAYERS — `hostApplyMoveN`'s copy, which a duel never reaches.
 *
 * `nettest_brake.js` covers the brake in a DUEL and says in its own closing note what it cannot reach:
 * the duel drives `hostApplyMove`, whose re-apply keys on `stackMark(hostState, 1)` because in a duel the
 * client is always seat 1. The N-player handler is a different function with a different mechanism — it
 * passes the acting seat into `moveToPlayThen` as its fourth argument — and a fix or a regression in one
 * family is invisible to the other. That split has cost this repo four bugs (CLAUDE.md: "there are two
 * park families and a duel cannot read the N-player one"), and `nettest_autopass` had to add a source scan
 * for exactly this reason after its first A/B passed 15/0 with the N-player guard deleted.
 *
 * THE DISCRIMINATOR IS WHOSE CASTS ARE SUBTRACTED, so both legs below are the SAME mutation seen from
 * opposite sides — `moveToPlayThen`'s `actor` defaulting to YOU (the host) instead of the passing seat:
 *   - LEG 2, the HOST casts into a CLIENT's pass window. Correct: `stackMark(st,1)` moves, because the
 *     host's cast bumps `oidSeq` and not `castSeq[1]` -> braked. Wrong actor: `stackMark(st,0)` subtracts
 *     the host's own cast -> unchanged -> the client's pass completes through a cast it never saw.
 *   - LEG 3, the CLIENT casts into its OWN pass window. Correct: `castSeq[1]` moves with `oidSeq` ->
 *     unchanged -> the pass still goes through. Wrong actor: the mark moves -> the seat brakes itself.
 * One of these alone is weak; the pair pins the seat.
 *
 * STAGING, and every line of it is load-bearing — see `nettest_brake.js` for the full reasoning:
 *   - `prompts=all`, because Main -> Fight is a BOUNDARY timing and those default OFF.
 *   - ♦9 LEYLINE, the only UNTARGETED base Quick, so the only one castable into an empty transition
 *     window. Back Stab cannot test a brake at all: a lockout hits the early return one line ABOVE it.
 *   - ♦ energy, 12 of it — Leyline costs 9 and a short pile refuses the cast silently.
 *   - THE PASSING SEAT MUST BE ANSWERING A PILE (`pass.disabled=leading`), so the host leads first.
 *
 * ✅ A/B'd WITH THE ONE MUTATION THIS SUITE EXISTS FOR — `moveToPlayThen`'s fourth argument in
 * `hostApplyMoveN` changed from `seat` to `null`, so `actor` falls back to the host:
 *     13/2 — leg 2 *"the pass completed"* AND leg 3 *"seat 1 braked itself"*, in OPPOSITE directions,
 *     with the control untouched. That is what a pair of legs buys over either one alone.
 *
 * Run: node nettest_brake3.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const { clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8402),ROOM='B3'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const EN=()=>Array.from({length:12},(_,i)=>D(2,'D','e'+i));       // ♦ energy: Leyline costs 9
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const respQuicks=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' ')));
const declineIfUp=p=>p.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d&&d.offsetParent!==null){ d.click(); return true; } return false; });
const clickPassBtn=p=>p.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled){ b.click(); return true; } return false; });
const why=p=>p.evaluate(()=>({
  turn:(window.__cmf?window.__cmf.turn():null),
  msg:((document.getElementById('message')||{}).textContent||'').trim().slice(0,70),
  hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,55),
  passDisabled:!!((document.getElementById('passBtn')||{}).disabled),
  hand:document.querySelectorAll('#hand .card').length,
  modal:!!document.querySelector('.respQuick,#respDecline')
}));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_brake3.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await wait(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await ready(c1); await wait(300); await ready(c2);
  await until(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await until(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6), '3-Rider game started, host leads');

  /* VERIFY THE STAGING ON EVERY SEAT, not one — the duel suite lost three runs in five to a half-checked
     stage that let a leg run against the PREVIOUS leg's hands. A seat still holding an old Quick takes a
     window nobody is watching and the leg reports the brake broken. */
  const idsOn=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).sort().join(','));
  const want=h=>h.map(c=>c.id).sort().join(',');
  /* ⚠ `cer` IS LOAD-BEARING — see `nettest_brake`'s note. Every other field here is perfectly STABLE while
     a round ceremony plays its beats, because the deferred draw lands only at the very end, so a settle
     without it returns early and stages onto a board about to gain cards. This suite shows zero misses
     today and the blindness is identical, so it is fixed preventively: leaving one of two sibling suites
     without the check is how the pair drifts apart. */
  const snap=()=>host.evaluate(()=>JSON.stringify({t:window.__cmf.turn(),cer:window.__cmf.ceremony(),h:document.querySelectorAll('#hand .card').length,m:!!document.querySelector('.respQuick,#respDecline')}));
  async function quiet(){ let last=null,same=0; for(let i=0;i<80;i++){ const n=await snap(); same=(n===last && !JSON.parse(n).cer)?same+1:0; last=n; if(same>=4) return true; await wait(250);} console.log('   ⏱ never settled: '+last); return false; }
  async function stage(h0,h1,h2){
    const w=[want(h0),want(h1),want(h2)], pg=[host,c1,c2];
    for(let i=0;i<10;i++){
      await host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),
        { hands:[h0,h1,h2], energies:[EN(),EN(),EN()], shields:[3,3,3], opts:{ turn:0, round:3 } });
      const landed = await until(async()=>{
        for(let s=0;s<3;s++){ if((await idsOn(pg[s]))!==w[s]) return false; }
        return (await turnOf(host))===0;
      }, 16);
      if(landed) return true;
    }
    console.log('   ⏱ stage never landed — '+(await idsOn(host))+' | '+(await idsOn(c1))+' | '+(await idsOn(c2))+'  want '+w.join(' | '));
    return false;
  }
  /* The host LEADS so the next seat is answering a pile and may therefore Pass. Its own transition can
     offer it a window when it holds the Quick, so decline on every page while driving it. */
  async function hostLeads(id){
    await host.evaluate(i=>{ const c=document.querySelector('#hand .card[data-id="'+i+'"]'); const g=c&&c.closest('.group'); if(g) g.click(); }, id);
    const gone=()=>host.evaluate(i=>!document.querySelector('#hand .card[data-id="'+i+'"]'), id);
    for(let k=0;k<40;k++){
      if(await gone()) return true;
      await clickFight(host);
      await declineIfUp(host); await declineIfUp(c1); await declineIfUp(c2);
      await wait(300);
    }
    console.log('   ⏱ the host never led '+id);
    return false;
  }

  // ═══ LEG 1 — THE CONTROL: with nothing castable, a client's pass goes straight through ═══
  /* Without this, a build that brakes on EVERYTHING passes leg 2 and the suite says nothing. */
  let staged = await stage([D(6,'C','h'),D(7,'C','h')], [D(4,'H','a'),D(8,'C','a')], [D(5,'S','b'),D(9,'S','b')]);
  ok(staged, 'LEG 1 staged — nobody holds a Quick, so seat 1\'s pass opens a window with nothing in it');
  await hostLeads('h6C');
  ok(await until(async()=>(await turnOf(host))===1, 60), '  the host led, and the turn reached seat 1');
  await until(async()=>!(await c1.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
  await clickPassBtn(c1);
  const through = await until(async()=>(await turnOf(host))===2, 60);
  ok(through, 'A QUIET WINDOW DOES NOT BRAKE A REMOTE SEAT — seat 1\'s pass went through to seat 2' +
     (through ? '' : '  ← host: '+JSON.stringify(await why(host))+'  c1: '+JSON.stringify(await why(c1))));

  // ═══ LEG 2 — THE HOST CASTS INTO A CLIENT'S PASS WINDOW: braked ═══
  /* THE SEAT-SENSITIVITY LEG. With `actor` defaulting to the host, the host's own cast is subtracted from
     its own mark and the client's pass completes through a cast it never saw. */
  await quiet();
  staged = await stage([D(9,'D','h'),D(6,'C','h')], [D(4,'H','a'),D(8,'C','a')], [D(5,'S','b'),D(9,'S','b')]);
  ok(staged, 'LEG 2 staged — the HOST holds ♦9 Leyline; seat 1 holds none and will be the one passing');
  await hostLeads('h6C');
  ok(await until(async()=>(await turnOf(host))===1, 60), '  the host led, and the turn reached seat 1');
  await until(async()=>!(await c1.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
  await clickPassBtn(c1);
  const hostOffered = await until(async()=>(await respQuicks(host)).length>0, 60);
  ok(hostOffered, '  seat 1\'s pass opened the window and the HOST was offered it' +
     (hostOffered ? '  ['+(await respQuicks(host)).map(t=>t.split(' ')[0]).join('|')+']' : '  ← nothing offered; the leg below would pass vacuously'));
  await host.evaluate(()=>{ const q=document.querySelector('.respQuick'); if(q) q.click(); });
  const hostCast = await until(async()=>!(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="h9D"]'))), 60);
  ok(hostCast, '  …and the host really cast it — Leyline has left its hand');
  await wait(1200);
  const braked = (await turnOf(host))===1;
  ok(braked, 'ANOTHER SEAT CAST — THE CLIENT\'S PASS IS BRAKED, and seat 1 decides again' +
     (braked ? '' : '  ← REPRODUCED bug 2 at N players: the pass completed; host: '+JSON.stringify(await why(host))));

  // ═══ LEG 3 — THE CLIENT CASTS INTO ITS OWN PASS WINDOW: not braked ═══
  /* THE SAME MUTATION FROM THE OTHER SIDE. A seat's own cast must never brake its own pass; with the wrong
     actor the mark moves and seat 1 brakes itself. Host holds no Quick here, so only seat 1 can act and
     the window cannot be answered by anyone else. */
  await quiet();
  staged = await stage([D(6,'C','h'),D(7,'C','h')], [D(9,'D','a'),D(4,'H','a')], [D(5,'S','b'),D(9,'S','b')]);
  ok(staged, 'LEG 3 staged — now SEAT 1 holds the Quick, so its own pass opens a window for itself');
  await hostLeads('h6C');
  ok(await until(async()=>(await turnOf(host))===1, 60), '  the host led, and the turn reached seat 1');
  await until(async()=>!(await c1.evaluate(()=>!!document.getElementById('passBtn').disabled)), 60);
  await clickPassBtn(c1);
  const selfOffered = await until(async()=>(await respQuicks(c1)).length>0, 60);
  ok(selfOffered, '  seat 1\'s own pass opened the window for seat 1 itself' +
     (selfOffered ? '' : '  ← nothing offered; the leg below would pass vacuously'));
  await c1.evaluate(()=>{ const q=document.querySelector('.respQuick'); if(q) q.click(); });
  const selfCast = await until(async()=>!(await c1.evaluate(()=>!!document.querySelector('#hand .card[data-id="a9D"]'))), 60);
  ok(selfCast, '  …and seat 1 really cast it');
  const ownThrough = await until(async()=>(await turnOf(host))===2, 60);
  ok(ownThrough, 'A REMOTE SEAT\'S OWN CAST DOES NOT BRAKE IT — the pass still went through to seat 2' +
     (ownThrough ? '' : '  ← REPRODUCED bug 2 inverted: seat 1 braked itself; host: '+JSON.stringify(await why(host))+'  c1: '+JSON.stringify(await why(c1))));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
