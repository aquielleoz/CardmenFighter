/* WHO OPENS AN ONLINE GAME — see the BACKLOG entry "SEAT 0 ALWAYS LEADS ROUND 1".
 *
 * `newGame` has always honoured `opts.starter`; the netplay path simply never passed one, so the host opened
 * every online game forever. Aj: *"in net play it seems like the host always leads the jabs too"*.
 *
 * MEASURED BEFORE CHANGING ANYTHING, because the entry's premise ("a permanent first-mover edge") turned out to
 * be wrong. Same AI on both seats, 8000 duels per arm, leading round 1 is worth: fighter **-4.81** points,
 * knight **-2.61**, demon **+6.45**. It is not an edge, it is an amplifier — leading commits a card and
 * information before the opponent answers, which punishes weak play and rewards strong. The sign is therefore
 * unknowable for two humans, and irrelevant to the fix: whatever it is, it must not land on the same seat every
 * game. Random first, then alternate.
 *
 * THIS SUITE IS THE ONE THAT ASKS FOR THE SHIPPED BEHAVIOUR (`?starter=rotate`). Every other netplay suite
 * stages from "the host leads round 1", so `dbg=1` pins seat 0 — the same rule the relay follows, for the same
 * reason. Without that, nineteen suites become coin flips.
 * Run: node nettest_starter.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8447),ROOM='SR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=140,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const dealt=p=>p.evaluate(()=>document.querySelectorAll('#hand .card').length>0);

async function openerOnce(b, room, rotate){
  const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${room}&dbg=1`+(rotate?'&starter=rotate':'');
  const ctx=await b.newContext({viewport:{width:1000,height:800}});
  const host=await ctx.newPage(), join=await ctx.newPage();
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  await until(()=>dealt(host));
  const t=await turnOf(host);                    // the HOST's frame is absolute: 0 = host opens, 1 = client opens
  const logs=async pg=>pg.evaluate(()=>((document.getElementById('log')||{}).textContent||''));
  const dice=async pg=>pg.evaluate(()=>{const l=document.getElementById('log'); if(!l) return '';
    const hit=[...l.children].map(e=>e.textContent).filter(t=>/🎲/.test(t)); return hit.length?hit[0]:'';});
  const out={ t:t, hostLog:await logs(host), joinLog:await logs(join), hostDice:await dice(host), joinDice:await dice(join) };
  await ctx.close();
  return out;
}

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  /* 1. THE DEFAULT UNDER dbg IS PINNED, and this has to be asserted or the other nineteen suites are resting on
   *    an undocumented accident. */
  const pinned=[];
  for(let i=0;i<3;i++) pinned.push((await openerOnce(b, ROOM+'p'+i, false)).t);
  ok(pinned.every(t=>t===0), 'under dbg=1 the opener is pinned to seat 0, so staged suites stay deterministic  ['+pinned.join(', ')+']');

  /* 2. WITH THE SHIPPED BEHAVIOUR ASKED FOR, the opener is not always the host. Six fresh rooms: each starts
   *    from a coin flip, so seeing BOTH seats open is the assertion. P(all six identical) = 1/32 by chance,
   *    so this is a real test rather than a hopeful one. */
  const runs=[]; for(let i=0;i<6;i++) runs.push(await openerOnce(b, ROOM+'r'+i, true));
  const rotated=runs.map(r=>r.t);
  const sawBoth = rotated.some(t=>t===0) && rotated.some(t=>t===1);
  ok(sawBoth, 'with ?starter=rotate the opener varies between the seats  ['+rotated.join(', ')+']'+
              (sawBoth?'':'  ← the host is still opening every game'));
  ok(rotated.every(t=>t===0||t===1), '  → and it is always a real seat, never out of range  ['+rotated.join(', ')+']');

  /* 3. AND IT IS ANNOUNCED, which is the whole point of rolling rather than quietly alternating (Aj: *"why can
   *    we not just roll dice like in solo play?"*). Solo has always shown the roll; online used to just decide.
   *    Reader-relative, so the seat that won it reads "You" and the other reads the opponent's name — assert
   *    that split, not merely that a line exists, because a sender-baked name is the failure this repo keeps
   *    hitting ("You is out!"). */
  const both = runs.filter(r=>/🎲/.test(r.hostLog) && /🎲/.test(r.joinLog));
  ok(both.length===runs.length, 'the roll is announced on BOTH screens  ('+both.length+'/'+runs.length+' games)');
  /* THE FIRST VERSION OF THIS ASSERTION WAS WRONG, and the product was fine — worth recording, because it is
   * the same trap as a vacuous assertion seen from the other side. It required exactly ONE screen to contain
   * "You rolled", but the line names BOTH players' dice, so both screens legitimately do:
   *     HOST  🎲 You rolled 6, Rival rolled 5 — You will lead round 1.
   *     JOIN  🎲 Rival rolled 6, You rolled 5 — Rival will lead round 1.
   * What reader-relative actually means here is that the two renderings DIFFER and each seat sees itself as
   * "You" — so assert that instead. */
  const framed = runs.filter(r=>{
    const h=(r.hostDice||''), j=(r.joinDice||'');
    return h && j && h!==j && /You/.test(h) && /You/.test(j);
  });
  ok(framed.length===runs.length,
     'and each seat reads it in ITS OWN frame — the two renderings differ, and each says "You"  ('+framed.length+'/'+runs.length+')'+
     (framed.length?'':'\n     host: '+(runs[0].hostDice||'(none)')+'\n     join: '+(runs[0].joinDice||'(none)')));

  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
