/* Netplay PUBLIC BATTLE LOG. Before this, every message type was state (mirror/setup) or control
 * (join/welcome/err/peer/ceremony) — the host narrated everything locally and a client's log was
 * EMPTY all game, even for its own moves. Narration now goes through say(actor, '{who} …'), which
 * broadcasts the TEMPLATE plus the actor's absolute seat so each side renders it in its own frame:
 * the actor reads "You played", everyone else reads "Rival played" (or "P3" in a free-for-all).
 * Run: node nettest_log.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8313),ROOM='LG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const log=p=>p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()));
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
async function waitHand(p){ for(let i=0;i<60;i++){ if((await p.evaluate(()=>document.querySelectorAll('#hand .card').length))>0) return true; await wait(150); } return false; }
/* Budgets are deliberately generous. This suite is one of the two documented as "position-dependent" — it
 * passes alone and fails ~4 assertions late in a long serial sweep. The cascade starts at ONE place: the wait
 * for the turn to reach the client was 60x150ms = 9s, and a slow mirror round-trip blows through it. Then the
 * turn assertion fails, the client finds no legal jab, and both log assertions fail with it — four failures
 * from one impatient loop. A slow machine should make this suite slower, never red. */
async function waitLog(p,re){ for(let i=0;i<150;i++){ if((await log(p)).some(l=>re.test(l))) return true; await wait(150); } return false; }
async function waitTurn(p,seat){ for(let i=0;i<200;i++){ if((await turnOf(p))===seat) return true; await wait(150); } return false; }
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH); const ctx=await b.newContext({viewport:{width:1150,height:860}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  for(let i=0;i<80;i++){ if(await join.evaluate(()=>!!document.getElementById('lobbyGo'))) break; await wait(150); }   // lobby up
  await startDuel(host, join);
  ok(await waitHand(host) && await waitHand(join),'duel started, both boards dealt');

  /* STAGE BOTH HANDS. This suite is about NARRATION, and it has no business depending on the shuffle — but it
   * did, completely. The host played whatever card happened to be first in its hand; when that was unbeatable
   * the client had no legal answer and FOUR assertions fell together (the legal-jab one, both client-log ones,
   * and the log-length one). That is the documented "9 pass / 4 fail" signature, and it was mis-recorded for
   * months as an impatient-wait flake: it fails ALONE, at any position, whenever the deal goes against it.
   * The apex 2 is always fatal (nothing beats value 15) and an Ace nearly always is.
   * Measured before the fix: leads of 6♦/3♥/6♥/Q♠/8♠ all passed; the failing run had led 2♣.
   * Now the host leads a 4 and the client holds a 10, so the answer is guaranteed and the deal is irrelevant. */
  await host.evaluate(()=>{
    const C=(n,su)=>({rank:n, suit:su, id:'lg'+n+su});
    window.__cmf.force([C(4,'D'),C(5,'H'),C(6,'C'),C(7,'S'),C(8,'D'),C(9,'H')],    // host leads the 4
                       [C(10,'C'),C(9,'S'),C(8,'H'),C(7,'D'),C(6,'S'),C(5,'C')]);  // client can always answer
  });
  await wait(400);                                  // let the forced mirror reach the client
  ok(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="lg4D"]')),
     'hands staged, so this suite no longer depends on the deal');

  // the HOST plays: the host reads "You", the client must read "Rival"
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="lg4D"]'); if(c)c.click(); const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await waitLog(host,/^You played/),'host log: "You played …"');
  ok(await waitLog(join,/^Rival played/),'CLIENT log now shows the host\'s play as "Rival played …" (was empty before)');
  const hp=(await log(host)).find(l=>/^You played/.test(l)), jp=(await log(join)).find(l=>/^Rival played/.test(l));
  // guard: if either line is missing the assertion should FAIL, not throw and abort the remaining checks
  ok(!!hp && !!jp && hp.replace(/^You played/,'')===jp.replace(/^Rival played/,''),
     'both sides describe the same card ('+(hp||'(missing)')+' / '+(jp||'(missing)')+')');

  // the CLIENT plays: mirrored phrasing
  // the client's mirror is ROTATED so its own seat is index 0 — its turn is turn===0, not 1
  ok(await waitTurn(join,0),'it is now the client\'s turn (rotated seat 0)');
  // round 1 is jabs only and the play must BEAT the pile — try each card until Fight enables
  const played=await join.evaluate(()=>{
    const clr=document.getElementById('clearBtn'), f=document.getElementById('fightBtn');
    const cards=[].slice.call(document.querySelectorAll('#hand .card'));
    for(let i=0;i<cards.length;i++){
      if(clr) clr.click();
      document.querySelectorAll('#hand .card')[i].click();
      if(f && !f.disabled){ f.click(); return true; }
    }
    return false;
  });
  ok(played,'the client found a legal jab to answer with');
  ok(await waitLog(join,/^You played/),'CLIENT log shows its OWN play as "You played …"');
  ok(await waitLog(host,/^Rival played/),'host log shows the client\'s play as "Rival played …"');

  // the client's log is genuinely populated, not just one line
  const jl=await log(join);
  ok(jl.length>=3,'the client has a real log, '+jl.length+' lines');
  ok(jl.some(l=>/^Online duel/.test(l)),'…opening with its own duel line, written in its own frame');
  ok(!jl.some(l=>/vs Rival Full Set|initiative/.test(l)),'…and never the host-framed opening line');
  ok(!jl.some(l=>/\{who\}/.test(l)),'no unresolved {who} placeholder leaked into any line');
  /* MEASUREMENT, NOT A FIX (v1.31.98). The BACKLOG carried an UNVERIFIED lead: "the netplay battle log does not
   * scroll". `#log` is `overflow-y:auto` with no netplay override, so a broken `min-height:0` chain would be a
   * SHARED cause, not a netplay divergence — and the entry said to measure before filing it as one. `logtest.js`
   * already shows the solo log scrolling (hundreds of px of range once expanded); this is the netplay side of
   * the same measurement, so the two can be compared instead of argued about. */
  const scrollRange = p => p.evaluate(()=>{
    const w=document.getElementById('logWrap'); if(w && w.classList.contains('collapsed')){ const t=document.getElementById('logToggle'); if(t) t.click(); }
    const l=document.getElementById('log');
    return l ? { range:l.scrollHeight-l.clientHeight, lines:l.children.length, overflowY:getComputedStyle(l).overflowY } : null;
  });
  await wait(300);
  const hostScroll=await scrollRange(host), joinScroll=await scrollRange(join);
  console.log('   [measured] host '+JSON.stringify(hostScroll)+'  client '+JSON.stringify(joinScroll));
  ok(!!hostScroll && hostScroll.overflowY==='auto' && !!joinScroll && joinScroll.overflowY==='auto',
     'the battle log is scrollable on BOTH netplay seats (overflow-y auto, no netplay override)');
  /* AND MAKE IT CONCLUSIVE. Range 0 above only means "this short game produced 4 lines" — consistent with a
   * healthy log AND with a broken one. Overflow it and require real range, which is what distinguishes
   * "nothing to scroll" from "cannot scroll" (the `min-height:0` chain the lead suspected would show here). */
  const filled = p => p.evaluate(()=>{ for(var i=0;i<40;i++) window.__cmf.addLog('filler '+i);
    const l=document.getElementById('log'); return { range:l.scrollHeight-l.clientHeight, lines:l.children.length }; });
  const hf=await filled(host), jf=await filled(join);
  console.log('   [measured, filled] host '+JSON.stringify(hf)+'  client '+JSON.stringify(jf));
  ok(hf.range>100 && jf.range>100,
     'and it really scrolls once it overflows — host '+hf.range+'px, client '+jf.range+'px of range'+
     ((hf.range>100&&jf.range>100)?'  → the "netplay log does not scroll" lead does NOT reproduce':'  ← REPRODUCED'));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\nCLIENT LOG:'); jl.forEach(l=>console.log('   '+l.slice(0,88)));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
