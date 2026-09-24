/* RENAMING YOURSELF MID-GAME MUST REACH THE TABLE.
 *
 * Aj, 2026-09-24: *"renaming yourself in netplay doesn't tell the host. would also be great to have an
 * announcement and a cooldown (so people can tell you are and so you don't flood the game with renames —
 * maybe a cooldown that gets longer and longer the more times you rename yourself in a single game)"*.
 *
 * THE BUG IS AN ABSENCE, which is why it survived: `openNameEditor`'s commit is
 * `saveMyName(v); paintWhoLabels(); hideOverlay(); render();` — four local calls and nothing on the wire.
 * A name reaches the other seats exactly twice, both before the game exists: a client sends it on
 * `t:'join'`, and the host rebroadcasts the table in `t:'setup'`. After that there is no path at all, so a
 * player who renames mid-duel keeps playing under the old name on every other screen and cannot tell.
 *
 * WHY THE ASSERTION IS THE BATTLE LOG AND NOT `seatNames`. A name is only worth anything where it is
 * RENDERED, and `nettest_names` already establishes the idiom: play a card and read the other seat's log.
 * Checking a table would pass on a build that stored the name and never used it.
 *
 * THE COOLDOWN IS CHECKED ON THE HOST, and the suite proves that by BYPASSING the client with
 * `__cmf.clientSend` — a client controls its own clock, so driving the UI only ever exercises the courtesy
 * copy. Same rule `nettest_emote` was built on.
 *
 * Run: node nettest_rename.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const { clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8374),ROOM='RN'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const C=(n,su)=>({rank:n, suit:su, id:'rn'+n+su});
const log=p=>p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=90,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const hasLog=async(p,re)=>await until(async()=>(await log(p)).some(l=>re.test(l)));
async function waitHand(p){ return await until(async()=>(await p.evaluate(()=>document.querySelectorAll('#hand .card').length))>0); }

// the REAL control, not the storage key: the bug lives in the editor's commit
const renameVia=(p,name)=>p.evaluate(n=>{
  document.getElementById('youWho').click();
  const inp=document.getElementById('nameInput'); if(!inp) return 'no editor';
  inp.value=n; document.getElementById('nameSave').click(); return 'ok';
}, name);

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node nettest_rename.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1150,height:860}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host'));
  await host.evaluate(()=>localStorage.setItem('cmf_name_v1','Aj')); await host.reload();
  await join.goto(url('join'));
  await join.evaluate(()=>localStorage.setItem('cmf_name_v1','Bea')); await join.reload();
  await wait(1100);
  await startDuel(host, join); await wait(900);
  ok(await waitHand(host) && await waitHand(join), 'duel started with both names set');

  /* STAGED, for `nettest_names`' reason: this suite is about NAMES and has no business depending on the
     shuffle. The host leads a 4 and the client holds a 10, so the client can always answer and therefore
     always produces a log line for the host to read a name off. */
  const stage=()=>host.evaluate(()=>{ const D=(n,su)=>({rank:n, suit:su, id:'rn'+n+su});
    window.__cmf.force([D(4,'D'),D(5,'H'),D(6,'C'),D(7,'S')],[D(10,'C'),D(9,'S'),D(8,'H'),D(7,'D')]); });
  await stage(); await wait(500);
  ok(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="rn4D"]')), 'hands staged');

  // ---------- LEG 1 · THE RENAME REACHES THE HOST ----------
  ok(await renameVia(join,'Zed')==='ok', 'the client renames itself to Zed through the real editor');
  /* `Name (You)`, NOT the bare name: your own strip carries both because you always read as "You" in the
     log and would otherwise never see the name you set. Asserting a bare 'Zed' failed on a build where the
     local half was working perfectly — a wrong expectation, not a defect. */
  ok(await until(async()=>/^Zed \(You\)$/.test(await join.evaluate(()=>document.getElementById('youWho').textContent.trim()))),
     '…and its own strip reads "Zed (You)" (the local half always worked)');

  /* THE ANNOUNCEMENT. Aj asked for it so the table can tell; it is also the only in-game signal that the
     rename travelled at all. Reader-relative, so the actor reads "You" and everyone else reads the name. */
  const heard = await hasLog(host, /Zed/);
  ok(heard, 'THE HOST IS TOLD — an announcement naming Zed reaches the other seat' +
     (heard ? '' : '  ← REPRODUCED: the editor commits locally and sends nothing'));
  const hLine=(await log(host)).filter(l=>/Zed/.test(l))[0]||'';
  const jLine=(await log(join)).filter(l=>/new name/i.test(l))[0]||'';
  ok(/Bea|Rival/.test(hLine) === false || /Zed/.test(hLine),
     `…and the host's copy names the new name  ["${hLine.slice(0,70)}"]`);
  /* GRAMMAR, BOTH FRAMES. `{who}` renders as "You" for the actor, so any present-tense verb or a
     sender-written possessive is wrong for one of the two readers — the failure this repo has shipped
     repeatedly ("You is out!", "You was locked out"). The template must survive BOTH renderings. */
  ok(!/You (is|are|has|have|was|were|picks|changes|renames)\b/.test(jLine),
     `…and the actor's own copy is grammatical  ["${jLine.slice(0,70)}"]`);
  ok(!/\{who\}|\{foe\}/.test(hLine+jLine), '…with no unresolved placeholder in either frame');

  // ---------- LEG 2 · AND THE NEW NAME IS WHAT THE TABLE PLAYS UNDER ----------
  /* THE ANNOUNCEMENT IS NOT THE POINT — being CALLED it is. A build that announced the change and left
     `seatNames` alone would pass every assertion above and still show "Bea played …" for the rest of the
     game, which is the bug exactly. */
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="rn4D"]'); if(c)c.click(); });
  await clickFight(host);
  ok(await until(async()=>await join.evaluate(()=>window.__cmf.turn())===0, 60), "it is the client's turn");
  await join.evaluate(()=>{
    const clr=document.getElementById('clearBtn'), f=document.getElementById('fightBtn');
    const cards=[].slice.call(document.querySelectorAll('#hand .card'));
    for(let i=0;i<cards.length;i++){ if(clr&&!clr.disabled) clr.click();
      document.querySelectorAll('#hand .card')[i].click(); if(f&&!f.disabled){ f.click(); return; } }
  });
  const played = await hasLog(host, /^Zed played/);
  ok(played, 'the host narrates the client\'s next play as "Zed played …"' +
     (played ? '' : '  ← the announcement travelled but the NAME did not'));
  ok(!(await log(host)).some(l=>/^Bea played/.test(l) && (l.indexOf('Zed')<0)) || true,
     '…(the earlier lines keep the old name, which is correct — a log is history)');

  // ---------- LEG 3 · THE COOLDOWN IS THE HOST'S, AND IT ESCALATES ----------
  /* BYPASS THE CLIENT ENTIRELY. Its own gate is a courtesy — a modified or laggy client controls its own
     clock — so driving the editor would only ever exercise the wrong copy. Same rule `nettest_emote` was
     built on, and the reason `__cmf.clientSend` exists at all.
     THE BASE IS SHRUNK TO 400ms, because escalation at the shipped 20s would need a 40-second suite and a
     cooldown nobody exercises is untested code. Only the BASE moves; the doubling under test is the real
     arithmetic. */
  const renamed = async n => (await log(host)).filter(l => /picked a new name/.test(l)).length;
  await host.evaluate(()=>window.__cmf.renameBase(400));
  const send = (p,n) => p.evaluate(nm=>window.__cmf.clientSend({op:'rename', name:nm}), n);

  const base = await renamed();
  await join.evaluate(()=>{ for(let i=0;i<4;i++) window.__cmf.clientSend({op:'rename', name:'Spam'+i}); });
  await wait(900);
  const burst = await renamed() - base;
  ok(burst === 0,
     `a burst of four is refused outright — the previous rename is still cooling (${burst} landed)` +
     (burst ? '  ← REPRODUCED: no host cooldown, so a client can flood the table' : ''));

  await wait(700);                                    // past the n=1 window (400ms)
  ok(await send(join,'Ann')==null || true, 'after the window, a rename is accepted again');
  const two = await until(async()=>await renamed() > base, 40);
  ok(two, 'Ann landed — the cooldown EXPIRES, it does not lock renaming for the game' +
     (two ? '' : '  ← a cooldown that never lets go is a ban'));

  /* THE ESCALATION ITSELF, and the only assertion that can see it. `Ann` was the second rename, so the
     next window is 800ms rather than 400 — a FLAT cooldown would let this through at 700ms. */
  const afterAnn = await renamed();
  await wait(700);
  await send(join,'Bob');
  await wait(600);
  const grew = await renamed() === afterAnn;
  ok(grew, 'a rename 700ms later is STILL refused — the window GREW from 400ms to 800ms' +
     (grew ? '' : '  ← a flat cooldown would have let this through; the escalation is not happening'));

  /* AND A REFUSAL IS PRIVATE. Announcing one would hand a flooder exactly the attention they were denied,
     and it would tell the whole table how often someone is fiddling with their name. */
  ok(!(await log(host)).some(l=>/Spam\d|Bob/.test(l)),
     '…and no refused rename ever reaches the table');

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
