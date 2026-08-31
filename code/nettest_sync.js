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
  /* A RED RUN MUST NAME ITS OWN CAUSE. This used to report the mismatch SENTENCE and nothing else, so the
   * card-id detail and the mirror lifecycle in the backlog entry came from bespoke instrumentation that was
   * then thrown away — which is exactly why the investigation could not be resumed from the record, and why
   * conclusions like "no HELD events" could not be re-checked nine versions later. Now a failure dumps both
   * hands' card IDS (the gap names the round's deal outright) and the tail of BOTH peers' traces, where the
   * `mirror IN` / `mirror HELD` / `mirror HELD -> DISCARDED` / `mirror APPLIED` sequence lives. */
  if(drift){
    /* `__cmf.hand()` / `handOf()` ALREADY RETURN ID STRINGS — they map `c.id` internally. The first draft here
     * mapped `c=>c.id` again, so every id came out `undefined`: the dump printed blank hands AND the "missing
     * ids" line then confidently reported "the gap is elsewhere". A diagnostic that states a wrong conclusion
     * is worse than one that states nothing, so the guard below refuses to conclude when the ids are unusable. */
    const ids=p=>p.evaluate(()=>({ mine:(window.__cmf&&window.__cmf.hand())||[],
                                   theirs:(window.__cmf&&window.__cmf.handOf(1))||[] }));
    /* `traceDump()` already returns formatted STRINGS ("12.34s  mirror APPLIED …  x3"), timestamped and with
     * repeats collapsed — so take them as they are. An earlier draft here mapped over `.line`/`.n` as though
     * they were objects; it happened to work via String(e) and would have quietly implied a shape that does
     * not exist. */
    const tr=p=>p.evaluate(()=>(window.__cmfTrace?window.__cmfTrace():[]).slice(-24));
    const hi=await ids(host), ji=await ids(join), ht=await tr(host), jt=await tr(join);
    console.log('\n--- DIVERGENCE DETAIL -------------------------------------------------');
    console.log('HOST   own hand   ('+hi.mine.length+'): '+hi.mine.join(' '));
    console.log('HOST   sees seat1 ('+hi.theirs.length+'): '+hi.theirs.join(' '));
    console.log('CLIENT own hand   ('+ji.mine.length+'): '+ji.mine.join(' '));
    console.log('CLIENT sees seat1 ('+ji.theirs.length+'): '+ji.theirs.join(' '));
    const usable=hi.theirs.every(x=>typeof x==='string' && x) && ji.mine.every(x=>typeof x==='string' && x);
    if(!usable) console.log('IDS UNUSABLE — cannot say what is missing (host '+JSON.stringify(hi.theirs.slice(0,3))+' client '+JSON.stringify(ji.mine.slice(0,3))+')');
    else { const missing=hi.theirs.filter(x=>ji.mine.indexOf(x)<0);
      console.log('IDS THE CLIENT IS MISSING: '+(missing.length?missing.join(' '):'(none — the counts differ but the ids agree, so the gap is elsewhere)')); }
    console.log('--- HOST trace (last 24) ---');   ht.forEach(l=>console.log('   '+l));
    console.log('--- CLIENT trace (last 24) ---'); jt.forEach(l=>console.log('   '+l));
    console.log('----------------------------------------------------------------------\n');
  }
  ok(drift===null, 'the two sides never diverge while a real game is played over the relay'+(drift?'  ← DIVERGED: '+drift:''));
  ok(worst>=2, 'and the game got past round 1 legally — round '+worst+' reached, '+acted+' actions');

  /* ONE EVENT, ONE LOG LINE. A client used to narrate every round resolution twice — once from its own
   * ceremony replay, once from the host's broadcast — so its log ran at exactly 2x the host's for round wins
   * and catch-ups (measured host 5/5, client 10/10).
   * THE METRIC MATTERS: the two copies are NOT adjacent (the catch-up line sits between them), so an
   * "adjacent duplicates" check reports zero and an A/B on it reads as a null result. That mistake cost most of
   * a session. Compare COUNTS against the host instead — the host is the authority, so its count is the truth. */
  const lines=p=>p.evaluate(()=>{
    const L=[].slice.call(document.querySelectorAll('#log > *')).map(e=>e.textContent.trim());
    const k=t=>L.filter(x=>t.test(x)).length;
    return { roundwin:k(/won the round|won with a/), catchup:k(/catch-up/), banner:k(/^Round \d+ begins/) };
  });
  const lh=await lines(host), lj=await lines(join);
  ok(lh.roundwin>0 && lj.roundwin===lh.roundwin,
     'the client narrates each round result ONCE, like the host ('+lh.roundwin+' vs '+lj.roundwin+')');
  ok(lj.catchup===lh.catchup,
     '  → and each catch-up once ('+lh.catchup+' vs '+lj.catchup+') — 2x here means the ceremony is narrating locally as well');
  /* A BROADCAST TEMPLATE MUST READ CORRECTLY IN EVERY FRAME. `say()` rotates {who} for the reader, but the
   * grammar AROUND it used to be baked in the sender's perspective, so a client saw "You moves 2 cards from
   * their deck" and "Rival move 1 card from your deck". Past tense removes the agreement entirely. */
  const bad=await join.evaluate(()=>[].slice.call(document.querySelectorAll('#log > *'))
    .map(e=>e.textContent.trim())
    .filter(l=>/You moves|Rival move \d|from your deck|You’s|You's/.test(l)));
  ok(bad.length===0, 'and no line is stuck in the HOST\'s grammar'+(bad.length?('  ← '+bad[0]):''));
  /* THE SECOND NAME. {who} was always rotated; the OTHER seat in a line was interpolated by the host as
   * literal text, so a client read the host's word for it: "You won with a Pair - You lose a shield", both
   * of them 'You'. Seats travel now and each end names them. A line naming the same side twice is the tell. */
  const selfref=await join.evaluate(()=>[].slice.call(document.querySelectorAll('#log > *'))
    .map(e=>e.textContent.trim())
    .filter(l=>/You won with .* You lost a shield|You landed the FIGHTER KICK — You is out|[{]foe[}]/.test(l)));
  ok(selfref.length===0, 'and no line names the same side as both winner and loser'+(selfref.length?('  ← '+selfref[0]):''));

  const h=await view(host), j=await view(join);
  ok(h.round===j.round, 'they finish agreeing on the round (host '+h.round+', client '+j.round+')');
  ok(h.bad===0 && j.bad===0, 'and neither side ever held a card with no rank');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail+'  · rounds '+worst+', actions '+acted);
  await b.close(); srv.close(); if(mock) mock.kill(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR '+(e&&e.stack||e)); if(mock) mock.kill(); process.exit(1); });
