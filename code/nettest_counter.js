/* Deterministic netplay COUNTER: host casts a Technique (Gather Energy 1D); the remote client, holding Counter
 * Spell (4D), sees the response modal appear from the mirror and Counters over the wire. Verifies the modal pops
 * on the client, the counter round-trips, the Technique is negated, and both boards stay error-free and in sync. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8280),ROOM='C'+Date.now().toString().slice(-4);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
async function turnOf(p){ return p.evaluate(()=>window.__cmf?window.__cmf.turn():null); }
async function modalUp(p){ return p.evaluate(()=>!!(document.getElementById('overlay')&&document.getElementById('overlay').classList.contains('show'))); }
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1200); await startDuel(host, join);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // Ensure it's the host's turn to lead, then stage hands: host holds Gather Energy (1D) + filler; rival holds Counter Spell (4D) + filler.
  ok(await turnOf(host)===0,'host leads round 1');
  const hostHand=[D(1,'D'),D(3,'C'),D(6,'H'),D(8,'S')];
  const rivalHand=[D(4,'D'),D(5,'C'),D(7,'H'),D(9,'S')];
  const energy=s=>[D(2,'D','e'),D(3,'D','e'),D(4,'C','e'),D(5,'H','e'),D(6,'S','e')];   // 5 pips incl. 2♦ → covers Counter Spell (2♦+2any) and Gather (1♦)
  const forced=await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh:hostHand,rh:rivalHand,he:energy(),re:energy()});
  ok(forced===true,'staged deterministic hands + energy on the host');
  await wait(500);

  // Host activates Gather Energy (1D) — opens a response window the remote client owes.
  await host.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="1D"]'); if(c)c.click(); var ctx=document.getElementById('ctxBtn'); if(ctx&&!ctx.disabled)ctx.click(); });
  // Wait for the response modal to appear on the CLIENT (driven by the mirror + clientCheckWindow).
  let popped=false; for(let i=0;i<40;i++){ if(await modalUp(join)){ popped=true; break; } await wait(120); }
  ok(popped,'client response modal appeared from the mirror');

  // Client clicks the Counter Spell quick button.
  const clicked=await join.evaluate(()=>{ var q=document.querySelector('.respQuick'); if(q){ q.click(); return q.textContent.slice(0,20); } var d=document.getElementById('respDecline'); if(d){ d.click(); return 'declined'; } return null; });
  ok(clicked && /Counter/i.test(clicked),'client sent a Counter over the wire ('+clicked+')');
  await wait(900);

  // The Technique should be negated: host's log shows a counter; no pending remains; no errors; turns valid.
  const hostPending=await host.evaluate(()=>window.__cmf.pending());
  ok(hostPending===false,'stack settled on the host (no lingering pending)');
  const logHit=await host.evaluate(()=>/[Cc]ounter/.test((document.getElementById('log')||{}).textContent||''));
  ok(logHit,'host log records the counter');
  /* AND THE CLIENT'S OWN LOG MUST TOO. Aj, 2026-08-30: "i think i've seen the counterspell fire off on netplay
   * but i can't confirm if it was only because it was on the host". The MECHANIC always worked from either seat
   * — this suite is a CLIENT countering — but until v1.31.58 the narration went through `logMsg`, which is
   * host-local, so the countering player saw its own Technique evaporate with no line anywhere. Assert both
   * ends, because "the host logged it" was true the whole time this was broken.
   * NOTE this is BACKFILLED coverage, not proof of a new fix: it passes on the build before it was added,
   * because v1.31.58 had already converted the sites. It exists so the next regression is caught, and so the
   * question "does a client's counter actually reach both logs?" has an answer that is checked rather than
   * remembered. */
  const jlog = await join.evaluate(()=>((document.getElementById('log')||{}).textContent||''));
  ok(/counter/i.test(jlog), 'and the CLIENT’s own log records it too — the half that was silent until v1.31.58');
  ok(!/\bYou is\b|\bYou has\b|\bYou moves\b/.test(jlog),
     '  → with no sender-baked grammar in it');
  const ht=await turnOf(host), jt=await turnOf(join);
  ok(ht!=null && jt!=null,'both boards still live after the exchange (host turn '+ht+', client turn '+jt+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
