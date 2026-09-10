/* THE IDLE PARK, AT THREE PLAYERS — the half of the park-heartbeat question `nettest_mirrordrop` cannot reach.
 *
 * `nettest_mirrordrop` swallows mirrors around a CEREMONY (a client-won round), and a ceremony keeps rendering:
 * banner, shatter, deal. Each render makes a fresh mirror, so the dedupe never suppresses and the table heals on
 * its own — measured, eight swallowed mirrors and the pre-heartbeat build still recovered. That is why it only
 * ever discriminated at `awaitRival`, and why the other seven parks were never covered by anything.
 *
 * THE PARK THIS FILE TARGETS IS THE IDLE ONE: `driveN`'s remote-human-turn park (template, `netParked`). Nothing
 * animates there. The host renders once, parks, and its state deliberately stops changing — so the mirror that
 * says "the turn is yours" is the ONLY thing the seat will ever be told, and `broadcastMirror` has already
 * poisoned `lastMirror[s]` with a body it did not send. Lose it and both peers wait for each other for good:
 * the client's board still shows the host on turn, the host's still says the client is playing.
 *
 * Structurally this is `awaitRival`'s twin — the duel park for the same situation — and v1.31.80 measured that
 * one at 3 swallowed mirrors survivable, 4 permanently deadlocked. It had a heartbeat from that day; this one
 * did not, until v1.31.116.
 *
 * WHAT IT ASSERTS, in the order that makes the result mean something:
 *   1. the host really parked on seat 1 (staging — otherwise the drops land on a seat nobody is waiting for);
 *   2. the drop really blinded that seat (the control — a probe that breaks nothing reports a healthy table);
 *   3. the seat is told again, WITHOUT anyone reloading, and can really play into the round.
 * A/B it against a build with no beat at that park (`git show main:code/CardmenFighter.template.html`), never by
 * hand-editing: 3 goes red there and green here, or the change is a tidy-up rather than a fix.
 * Run: node nettest_parkbeat3.js   ·   DROPS=n to re-find the threshold */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const autoAnswerWindows=require('./netwindows.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8453),ROOM='PB'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
/* A CLIENT'S MIRROR IS SEAT-ROTATED: its own seat is index 0, so "it is my turn" is `turn()===0` on a client and
 * `turn()===1` on the host talking about seat 1. Getting that backwards looks exactly like a product bug. */
const snap=p=>p.evaluate(()=>({
  turn: window.__cmf ? window.__cmf.turn() : null,
  hand: [].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.dataset.id),
  pile: document.querySelectorAll('#pile .card').length,
  round: parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  passOff: !!(document.getElementById('passBtn')||{}).disabled,
  status: ((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
}));
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join'));
  /* ANSWER WINDOWS THIS SUITE DOES NOT SCRIPT — see `netwindows.js`. The duel suites get this from
     `startDuel`; the 3-player ones hand-roll their lobby, so they install it themselves. Without it a
     client seat offered priority at Fight End parks the host forever: `nettest_3p` hung 4 times in 8
     runs the day the prompt default widened, against 8/8 on the build before it. */
  await autoAnswerWindows(host,'host'); await autoAnswerWindows(c1,'c1'); await autoAnswerWindows(c2,'c2');
  await until(()=>c2.evaluate(()=>!!document.getElementById('lobbyGo')));

  await ready(c1); await wait(300); await ready(c2);
  ok(await until(()=>host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); })),
     'the host lobby shows a 3-Rider game ready to start');
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g&&!g.disabled)g.click(); });
  ok(await until(async()=>{ for(const p of [host,c1,c2]){ if((await snap(p)).hand.length!==6) return false; } return true; }, 80, 200),
     'all three boards dealt 6 cards');
  /* `dbg=1` PINS THE OPENER to seat 0, so the host leads round 1 and the turn lands on seat 1 next. If that ever
   * stops being true this assertion says so instead of the drops silently landing on an idle seat. */
  ok((await snap(host)).turn===0, 'the host opens (dbg pins the die), so seat 1 is next');

  /* ARM BEFORE THE PLAY. The drops must cover every mirror the play itself renders — the pile landing, the hand
   * shrinking — as well as the park's own. Six is the duel threshold plus margin; DROPS=n re-finds it. */
  const DROPS=parseInt(process.env.DROPS||'6',10);
  ok(await host.evaluate(n=>window.__cmf.dropMirrors(1,n), DROPS)===DROPS,
     'armed: the next '+DROPS+' mirrors to seat 1 will be swallowed');
  const before=await snap(c1);
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });

  // 1. STAGING: the host must actually be parked on seat 1, or nothing below is about the park.
  const parked=await until(async()=>{ const h=await snap(host); return h.turn===1 && /is playing/.test(h.status); }, 60, 200);
  const hs=await snap(host);
  ok(parked, 'the host led and parked on seat 1  ["'+hs.status+'", turn '+hs.turn+', pile '+hs.pile+']');

  /* 2. THE CONTROL. A forced-drop probe that quietly fails to break anything reports a healthy table and reads
   *    as good news — this is the assertion that stops that. Seat 1 must still be looking at the OLD board. */
  await wait(900);
  const blind=await snap(c1);
  ok(blind.turn!==0 && blind.pile===before.pile,
     'the drop blinded seat 1 — it has not been told the turn is its own'+
     '  [c1 turn '+blind.turn+' (0 would mean its own), pile '+blind.pile+' vs '+before.pile+' before the lead]'+
     (blind.turn===0?'  ← THE DROP DID NOT LAND: raise DROPS, this run proves nothing':''));

  /* 3. THE QUESTION. Nothing on the host is going to change state — it is parked waiting on this seat — so the
   *    only thing that can free the table is the park re-asserting on a timer. */
  const told=await until(async()=>(await snap(c1)).turn===0, 120, 250);
  const live=await until(async()=>{ const s=await snap(c1); return s.turn===0 && s.pile>0 && !s.passOff; }, 20, 250);
  if(!told||!live){
    for(const [n,p] of [['host',host],['c1',c1]]){
      const t=await p.evaluate(()=>{ try{ return window.__cmf.trace().slice(-8); }catch(e){ return ['(no trace)']; } });
      console.log('   '+n+' trace tail: '+t.join(' | '));
    }
    const s=await snap(c1); console.log('   c1: turn '+s.turn+' pile '+s.pile+' round '+s.round+' pass '+(s.passOff?'off':'on'));
  }
  ok(told, 'the parked host TELLS SEAT 1 AGAIN after the lost mirrors'+
           (told?'':'  ← DEADLOCK: the park never re-asserts, and both peers now wait for each other'));
  ok(live, 'and seat 1 has a live board to act on (pile visible, Pass legal while following)'+(live?'':'  ← its board is dead'));

  // …and it really can play into the round: the host must take the turn onward to seat 2.
  await c1.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  ok(await until(async()=>(await snap(host)).turn===2, 60, 250),
     'seat 1 acts and the table moves on to seat 2 — the park was cleared, not merely repainted');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail+' · DROPS='+DROPS);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
