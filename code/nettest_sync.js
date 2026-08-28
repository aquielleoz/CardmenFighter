/* THE CROSS-CHECK: play real rounds over the ROOM-CODE path and make the two sides prove they agree.
 *
 * Aj, 2026-08-28: "how does it say that no tests failed when we can't even get to round 2 legally on the same
 * computer". The answer was structural and worth writing down:
 *   · nettest_relay proves a CONNECTION and a deal, then stops — no move is ever played over the relay.
 *   · nettest_rtc plays rounds, but over the copy-paste path; it never touches the relay.
 * So no suite had ever played a single move over the room-code path, and twenty-odd green netplay suites could
 * not see a client forking the duel into a private local game.
 *
 * The deeper gap: every other suite drives ONE side and asserts against expectations. Not one compares the two
 * sides AGAINST EACH OTHER. Aj's two saved battle logs did that in four seconds and immediately exposed a
 * divergence nothing else could. This suite is that comparison, automated:
 *   - the two sides must report the SAME round;
 *   - each side's view of the other's hand size must equal the other's ACTUAL hand size (seat-rotated: a
 *     client's own seat is index 0, so host.handOf(1) is the client and client.handOf(1) is the host);
 *   - neither side may hold a card with no rank — NaN/undefined is what a local draw off a redacted mirror
 *     produces, and it was the visible symptom of the fork.
 * Run: node nettest_sync.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path'),{ spawn }=require('child_process');
const DIR=__dirname,PORT=8335,MOCK=8835;
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const RELAY='http://127.0.0.1:'+MOCK;
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&stun=0&dbg=1&relay=${encodeURIComponent(RELAY)}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: '+String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

/* Everything needed for the comparison, from one evaluate so the two reads cannot straddle a mirror. */
const view=p=>p.evaluate(()=>({
  round: parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  mine: (window.__cmf&&window.__cmf.hand()) ? window.__cmf.hand().length : -1,
  theirs: (window.__cmf&&window.__cmf.handOf(1)) ? window.__cmf.handOf(1).length : -1,
  bad: [].slice.call(document.querySelectorAll('#hand .card')).filter(c=>/undefined|NaN/.test(c.textContent)).length,
  turn: window.__cmf ? window.__cmf.turn() : null,
  finished: window.__cmf ? window.__cmf.finished() : null,
  myTurn: /your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
}));
/* Act if it is our turn: lead/beat if anything is legal, otherwise pass. Deselects between attempts, because a
 * leftover selection is staged as a FIGHT and jams the controls (the nettest_actloop lesson). */
const act=p=>p.evaluate(()=>{
  const clear=()=>{ const c=document.getElementById('clearBtn'); if(c&&!c.disabled)c.click();
                    [].forEach.call(document.querySelectorAll('#hand .card.sel'),x=>x.click()); };
  const ov=document.getElementById('overlay');
  if(ov&&ov.classList.contains('show')){
    const d=document.getElementById('pfDecline')||document.getElementById('respDecline')||document.getElementById('revOk');
    if(d){ d.click(); return 'modal'; }
  }
  clear();
  const cards=[].slice.call(document.querySelectorAll('#hand .card'));
  for(const c of cards){
    c.click();
    const f=document.getElementById('fightBtn');
    if(f&&!f.disabled){ f.click(); return 'played'; }
    clear();
  }
  const pb=document.getElementById('passBtn'); if(pb&&!pb.disabled){ pb.click(); return 'passed'; }
  return 'stuck';
});

let mock=null;
(async()=>{
  mock=spawn(process.execPath,[path.join(DIR,'..','relay','mock.js'),String(MOCK)],{stdio:'ignore'});
  await new Promise(r=>srv.listen(PORT,r)); await wait(700);
  const b=await chromium.launch(Object.assign({}, LAUNCH, { args:['--disable-features=WebRtcHideLocalIpsWithMdns'] }));
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));

  await host.goto(url('rtchost')); await wait(900);
  ok(await until(()=>host.evaluate(()=>{const e=document.getElementById('roomCodeVal'); return !!e&&/^[A-Z0-9]{4}$/.test(e.textContent.trim());}),60,250),
     'host has a room code');
  const code=await host.evaluate(()=>document.getElementById('roomCodeVal').textContent.trim());
  await join.goto(url('rtcjoin')); await wait(800);
  await join.evaluate(c=>{ const i=document.getElementById('roomIn'); i.value=c; document.getElementById('roomGo').click(); }, code);
  await startDuel(host, join);
  ok(await until(async()=>(await view(host)).mine===6 && (await view(join)).mine===6, 100, 200),
     'a game dealt over the ROOM CODE — six cards each');

  /* PLAY. Bounded by wall clock and productive actions, never by a raw iteration count: a transition should not
   * burn budget (the v1.31.9 lesson). Whoever holds the turn acts. */
  /* DIVERGENCE MUST PERSIST TO COUNT. A client's hand only changes when the host's mirror arrives, so straight
   * after the client plays there is a LEGITIMATE window where the host says 5 and the client still says 6.
   * The first version of this compared mid-flight and reported a fork on the very first move — a false
   * positive, and exactly the mistake that would have discredited the whole suite. So: on a mismatch, poll
   * until it clears. Transient is the system working; persistent is the fork. */
  function mismatch(h,j){
    if(h.round!==j.round) return 'round: host '+h.round+' vs client '+j.round;
    if(h.theirs!==j.mine) return 'the host thinks the client holds '+h.theirs+' cards; the client holds '+j.mine;
    if(j.theirs!==h.mine) return 'the client thinks the host holds '+j.theirs+' cards; the host holds '+h.mine;
    if(h.bad||j.bad)      return 'cards with no rank in hand (host '+h.bad+', client '+j.bad+')';
    return null;
  }
  async function settle(ms){
    const end=Date.now()+ms; let last=null;
    while(Date.now()<end){
      const h=await view(host), j=await view(join);
      last=mismatch(h,j);
      if(!last) return { ok:true, h:h, j:j };
      await wait(250);
    }
    return { ok:false, why:last };
  }
  const t0=Date.now(); let acted=0, drift=null, worst=0;
  while(Date.now()-t0 < 120000 && acted < 60){
    /* Six seconds is far longer than a mirror round-trip on loopback and far shorter than "somebody played a
     * whole evening", so it separates the two cases cleanly. */
    const st=await settle(6000);
    if(!st.ok){ drift=st.why; break; }
    if(st.h.finished || st.j.finished) break;
    worst=Math.max(worst,st.h.round);
    if(st.h.myTurn){ const r=await act(host); if(r==='played'||r==='passed') acted++; }
    else if(st.j.myTurn){ const r=await act(join); if(r==='played'||r==='passed') acted++; }
    else await wait(200);
  }
  ok(drift===null, 'the two sides never diverge while a real game is played over the relay'+(drift?'  ← DIVERGED: '+drift:''));
  ok(worst>=2, 'and the game got past round 1 legally — round '+worst+' reached, '+acted+' actions');

  const h=await view(host), j=await view(join);
  ok(h.round===j.round, 'they finish agreeing on the round (host '+h.round+', client '+j.round+')');
  ok(h.bad===0 && j.bad===0, 'and neither side ever held a card with no rank');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail+'  · rounds '+worst+', actions '+acted);
  await b.close(); srv.close(); if(mock) mock.kill(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR '+(e&&e.stack||e)); if(mock) mock.kill(); process.exit(1); });
