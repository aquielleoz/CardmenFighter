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
  /* THE DICE THEMSELVES (v1.31.109). Sampled DURING the roll, because the overlay closes itself when it lands —
     read afterwards there is nothing to see. Both seats must show the SAME faces, each in its OWN order, since
     the host owns the roll and a client generating its own numbers would show a different game than it plays. */
  const faces=pg=>pg.evaluate(()=>{const d=document.getElementById('diceArea');
    return d?[...d.querySelectorAll('.die')].map(e=>e.textContent).join(''):''; });
  const diceSeen={host:[], join:[]};
  const sampler=setInterval(()=>{ [['host',host],['join',join]].forEach(([k,pg])=>{
    faces(pg).then(f=>{ if(f && diceSeen[k][diceSeen[k].length-1]!==f) diceSeen[k].push(f); }).catch(()=>{}); }); }, 60);
  await startDuel(host, join);
  await until(()=>dealt(host));
  clearInterval(sampler);
  const t=await turnOf(host);                    // the HOST's frame is absolute: 0 = host opens, 1 = client opens
  const logs=async pg=>pg.evaluate(()=>((document.getElementById('log')||{}).textContent||''));
  const dice=async pg=>pg.evaluate(()=>{const l=document.getElementById('log'); if(!l) return '';
    const hit=[...l.children].map(e=>e.textContent).filter(t=>/🎲/.test(t)); return hit.length?hit[0]:'';});
  /* THE OPENER'S OWN TRACE LINE is what makes this deterministic: `opener seat N rolled a/b` when a die
     really decided it, `opener seat 0 (dbg: pinned)` when dbg pinned it. Asserting the MECHANISM beats
     asserting the OUTCOME — see the note on assertion 2. */
  const trace=await host.evaluate(()=>{ try{ return (window.__cmf.trace()||[]).filter(l=>/\bopener\b/.test(l)).pop()||''; }catch(e){ return ''; } });
  const out={ t:t, trace:trace, hostFaces:diceSeen.host, joinFaces:diceSeen.join,
              hostLog:await logs(host), joinLog:await logs(join), hostDice:await dice(host), joinDice:await dice(join) };
  await ctx.close();
  return out;
}

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  /* 1. THE DEFAULT UNDER dbg IS PINNED, and this has to be asserted or the other nineteen suites are resting on
   *    an undocumented accident. */
  const pinnedRuns=[]; for(let i=0;i<3;i++) pinnedRuns.push(await openerOnce(b, ROOM+'p'+i, false));
  const pinned=pinnedRuns.map(r=>r.t);
  ok(pinned.every(t=>t===0), 'under dbg=1 the opener is pinned to seat 0, so staged suites stay deterministic  ['+pinned.join(', ')+']');
  ok(pinnedRuns.every(r=>/\(dbg: pinned\)/.test(r.trace)), '  → and it is PINNED, not a die that happened to land on 0 three times');

  /* 2. WITH THE SHIPPED BEHAVIOUR ASKED FOR, A DIE REALLY DECIDES IT — asserted as the MECHANISM, not as an
   *    outcome. This used to play six rooms and require both seats to appear, and its own comment did the
   *    arithmetic that condemns it: **P(all six identical) = 1/32**, treated as acceptable. It is not — that is
   *    a suite that goes red on ~3% of sweeps by construction, and on 2026-09-07 it did, was filed as a
   *    load-related product bug, and cost a diagnosis. Measured then: 20 solo runs, ONE `[0,0,0,0,0,0]`.
   *    The opener is a fresh die every game (deliberately — the roll is shown, it does not alternate), so
   *    "both seats appeared" is a statistical side-effect. `opener seat N rolled a/b` is the CAUSE, and it
   *    proves more in one game than six games of coin flips: a die was rolled, the two faces differ (ties
   *    re-roll), and THE HIGHER ROLL OPENED. Three rooms, because the assertion no longer needs luck. */
  const runs=[]; for(let i=0;i<3;i++) runs.push(await openerOnce(b, ROOM+'r'+i, true));
  const rotated=runs.map(r=>r.t);
  const rolls=runs.map(r=>{ const m=/opener seat (\d+) rolled (\d+)\/(\d+)/.exec(r.trace); return m?{seat:+m[1],a:+m[2],b:+m[3]}:null; });
  ok(rolls.every(Boolean), 'with ?starter=rotate a DIE decides the opener, not the dbg pin  ['+runs.map(r=>r.trace||'no trace').join(' | ')+']');
  ok(rolls.every(r=>r && r.a!==r.b), '  → and the faces always differ, so a tie really did re-roll');
  ok(rolls.every(r=>r && r.seat===(r.a>r.b?0:1)), '  → and the HIGHER roll opened, which is the whole claim  ['+rolls.map(r=>r?`${r.a}/${r.b}→${r.seat}`:'—').join(', ')+']');
  ok(rotated.every(t=>t===0||t===1), '  → and it is always a real seat, never out of range  ['+rotated.join(', ')+']');

  /* THE ROLL IS WATCHABLE ON BOTH SEATS (v1.31.109). Aj: *"might be better too if people can see the dice being
     rolled like in single player"*. The host owns the roll, so the CLIENT must land on the host's numbers — a
     client rolling its own would animate a different game than the one it is about to play. Each seat renders
     them in ITS OWN order (index 0 is the reader), so the two strings are REVERSES of each other in a duel:
     host `⚅⚀`, client `⚀⚅`. Asserting "same faces, own order" catches both a client that invents numbers and a
     rotation that forgets whose die is whose. */
  const bothSaw = runs.filter(r=>r.hostFaces.length && r.joinFaces.length);
  ok(bothSaw.length===runs.length, `both seats actually SAW dice tumbling (${bothSaw.length}/${runs.length} games)`);
  const mirrored = runs.every(r=>{ const h=r.hostFaces[r.hostFaces.length-1]||'', j=r.joinFaces[r.joinFaces.length-1]||'';
    return h.length===2 && j.length===2 && h===j.split('').reverse().join(''); });
  ok(mirrored, '  → and they are the SAME dice, each seat reading its own first  ['+
     runs.map(r=>(r.hostFaces[r.hostFaces.length-1]||'—')+'/'+(r.joinFaces[r.joinFaces.length-1]||'—')).join(' ')+']');
  /* Printed, NOT asserted. Which seats actually came up is luck; a human reading a green run should still see
     it, but it must never be the thing that fails. */
  console.log('   · observed openers across the three rooms: ['+rotated.join(', ')+'] (informational — luck, not an assertion)');

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
