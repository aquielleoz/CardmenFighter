/* A PRIORITY WINDOW'S IDENTITY MUST SURVIVE BEING RE-GRANTED — epic/priority-windows, step 1.
 *
 * `respond` clears EVERY object's `passed` set, so an object lower on the stack is legitimately re-offered to
 * a seat that already passed it: same oid, same holder, same card, same everything a mirror carries. The
 * client's `clientCheckWindow` de-dupes on that signature so fifty identical mirrors open one modal — and
 * before this fix the signature could not tell a re-grant from the window it had just handled, so the second
 * one was swallowed and the table waited forever on a window nobody was shown.
 *
 * WHY THE MIRRORS ARE DROPPED, and it is the whole reason this needed a probe rather than a game. With the
 * intervening mirror delivered, the client sees a frame with no window owed, its signature clears to null,
 * and the re-grant opens fine EVEN ON THE BROKEN BUILD. The defect needs that frame to go missing — which is
 * not exotic: `nettest_parkbeat3` measures ONE lost mirror deadlocking a 3-player table permanently. So the
 * drop is not a contrivance, it is the documented failure mode this repo already ships two suites for.
 *
 * THE SEQUENCE IS THE REAL ONE: window opens -> the player passes -> the frame that would have cleared the
 * signature is lost -> the same object is re-granted. Injection is used only to make it deterministic; every
 * message goes through the REAL handler (`__cmf.inject` -> `onMsg`).
 *
 * Both injects assert they were APPLIED. Three green negatives on an inject that did nothing would prove
 * nothing — the `nettest_endscreen` lesson, and the reason the trace clauses are here.
 * Run: node nettest_priosig.js
 */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8437),ROOM='PS'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

// The Respond? window is the only modal this suite opens, so "an overlay carrying a Quick button" is a
// sufficient and unambiguous read. Asserted by ROLE, never by copy — the wording is step 9's to change.
const respOpen=p=>p.evaluate(()=>{
  const ov=document.getElementById('overlay');
  return !!(ov && ov.classList.contains('show') && document.getElementById('respDecline'));
});
const traceOf=p=>p.evaluate(()=>(window.__cmf&&window.__cmf.trace)?window.__cmf.trace():[]);
/* COUNT the APPLIED lines, never `.some()`. The first draft of this suite asserted
   `trace.some(/mirror APPLIED/)` after an inject that never reached the handler at all — and it passed,
   because the duel's own opening mirror had already logged one. A delta is the only honest form. */
const appliedCount=async p=>(await traceOf(p)).filter(l=>/mirror APPLIED/.test(l)).length;

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>join.evaluate(()=>!!(window.__cmfNetState&&window.__cmfNetState.round>0))), 'duel started, client has a mirror');

  /* Swallow the host's own mirrors to the client for the rest of the run, so the only frames the client sees
     are the ones this suite injects. Without it the host's next render delivers the very frame whose loss the
     defect depends on, and the probe would report a healthy table on a broken build. */
  await host.evaluate(()=>window.__cmf.dropMirrors(1, 200));

  /* Build the two grants from the client's OWN current mirror, so everything except the window is real state.
     The client's frame is seat-rotated — it is always index 0 to itself — hence respondFor:0. The hand is
     staged with a Counter Spell it can afford, because `promptHumanResponse` AUTO-DECLINES when
     `eligibleQuicks()` is empty: with nothing to answer with there is no modal to re-open and the whole probe
     would pass vacuously on every build. */
  /* ADDRESSED TO SEAT 1 AND STAMPED FORWARD, both of which the dispatch enforces. `m.seat===mySeat` gates
     every mirror and a duel joiner is seat 1 — `nettest_endscreen` injects `seat:0` precisely because there
     it wants a NON-match. And `m.q` must not go backwards or the stale guard drops it. Get either wrong and
     the inject is silently ignored, which is what the applied-count delta below exists to catch. */
  let seq=9000;
  const mk=(gen)=>join.evaluate((g)=>{
    const st=JSON.parse(JSON.stringify(window.__cmfNetState));
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'p')+n+su});
    const E=window.CardmenEngine;
    st.players[0].hand=[C(4,'D'),C(6,'C')];
    st.players[0].energy=[C(4,'D','e'),C(4,'D','e2'),C(4,'D','e3'),C(4,'D','e4')];
    const tele=C(3,'D','t');
    st.pending={ oid:'oPRIO', kind:'effect', p:1, card:tele, eff:E.effectOf(tele), opts:{}, countered:false };
    st.respondFor=0;
    st.prioGen=g;                                  // absent entirely on a pre-fix build — that is the A/B
    st.finished=false;
    return { t:'mirror', seat:1, q:0, bs:'x', st:st };
  }, gen).then(m=>{ m.q=++seq; return m; });

  // ---- grant one
  const a0=await appliedCount(join);
  await join.evaluate(m=>window.__cmf.inject(m), await mk(1));
  ok(await until(async()=>(await appliedCount(join))>a0), 'grant 1: the injected mirror reaches the handler and is APPLIED');
  ok(await until(()=>respOpen(join)), 'grant 1: the Respond? window opens');

  // ---- the player passes; the frame that would clear the signature never arrives
  await join.evaluate(()=>document.getElementById('respDecline').click());
  ok(await until(async()=>!(await respOpen(join))), 'the player passes and the window closes');

  /* THE RE-GRANT. Same oid, same holder, same card — only the generation differs. This is the assertion the
     whole step exists for: keyed on the card id alone the two grants are indistinguishable, this frame is
     de-duped away, and the modal never comes back. */
  const a1=await appliedCount(join);
  await join.evaluate(m=>window.__cmf.inject(m), await mk(2));
  const applied=await until(async()=>(await appliedCount(join))>a1);
  ok(applied, 'the re-grant mirror reaches the handler (so a red below is the client, not the wire)');
  const reopened=await until(()=>respOpen(join));
  ok(reopened,
     'THE RE-GRANT RE-OPENS THE WINDOW — same object, same seat, new generation'+
     (reopened?'':'  ← REPRODUCED: the second grant was de-duped away; the table would wait forever on a window nobody was shown'));

  /* THE NEGATIVE HALF. A signature that changed on EVERY mirror would pass everything above and destroy the
     de-dupe that stops fifty identical frames opening fifty modals — so re-injecting the SAME generation must
     be a no-op. Asserted by closing the window first: if the repeat re-opened it, that is the regression. */
  await join.evaluate(()=>document.getElementById('respDecline').click());
  await until(async()=>!(await respOpen(join)));
  await join.evaluate(m=>window.__cmf.inject(m), await mk(2));
  await wait(400);
  ok(!(await respOpen(join)), 'a REPEAT of the same generation is still de-duped — the fix did not break the thing the signature is for');

  /* AN OBJECTLESS WINDOW STILL RENDERS (epic step 2). A Fight End go-round runs on an empty stack, so
     `respondFor` is set and `pending` is null. Every consumer used to require the OBJECT, so such a window was
     INVISIBLE — not a crash, a silently parked table. Nothing mints one until step 11, which is exactly why it
     is injected here: otherwise this surface goes untested until the day it goes live. The WORDING is step
     14's; all this asserts is that the window opens and the player can act. */
  await join.evaluate(()=>document.getElementById('respDecline').click());
  await until(async()=>!(await respOpen(join)));
  const aOl=await appliedCount(join);
  const objectless=await join.evaluate((q)=>{
    const st=JSON.parse(JSON.stringify(window.__cmfNetState));
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'p')+n+su});
    st.players[0].hand=[C(4,'D'),C(6,'C')];
    st.players[0].energy=[C(4,'D','e'),C(4,'D','e2'),C(4,'D','e3'),C(4,'D','e4')];
    st.pending=null; st.respondFor=0; st.prioGen=77; st.finished=false;   // a window, and no object at all
    return { t:'mirror', seat:1, q:q, bs:'x', st:st };
  }, ++seq);
  await join.evaluate(m=>window.__cmf.inject(m), objectless);
  ok(await until(async()=>(await appliedCount(join))>aOl), 'objectless window: the mirror is APPLIED');
  const olOpen=await until(()=>respOpen(join));
  ok(olOpen, 'objectless window: the Respond? window still OPENS with no object'+
     (olOpen?'':'  ← the window is invisible to the client, so nobody answers and the table parks'));
  ok(!errs.some(e=>/Cannot read|undefined/.test(e)), 'objectless window: rendering it threw nothing'+(errs.length?'  ← '+errs.slice(0,2).join(' | '):''));

  /* THE FIGHT END WINDOW'S COPY (epic step 14). Nothing MINTS such a window until step 18, so without
     staging one here the wording ships unrendered — and the whole point of the copy is that a player facing
     a strike can see who is striking and with what (`openShieldGuardModal` learned this in v1.31.120: at
     3-6 players "Rival" names nobody). Injected exactly like the objectless window above; the client's frame
     is seat-rotated, so seat 1 is the other player and `strikeTargets:[0]` means YOU are struck. */
  async function feWindow(shields, targets, q) {
    return join.evaluate((a) => {
      const st = JSON.parse(JSON.stringify(window.__cmfNetState));
      const C = (n, su, t) => ({ rank: n, suit: su, id: (t || 'p') + n + su });
      /* LEYLINE (9D), NOT COUNTER SPELL — step 15 changed what this window offers, and correctly.
         Prompt preferences default the Fight End timing ON only for cards that already guarded there;
         Counter Spell guards nothing, so with it as the only Quick this window now AUTO-PASSES and the
         modal never appears. That is the "annoying very quick" case being off by default, working.
         Leyline is the realistic card at this timing and is wanted by default, so this also asserts the
         DEFAULT rather than fiddling with a preference. Cost 9, hence nine diamond energy — five is not
         enough, and an unaffordable card is silently not a Quick here (measured the hard way in
         `nettest_passoduel`). */
      st.players[0].hand = [C(9,'D','g'), C(6,'C')];
      st.players[0].energy = [1,2,3,4,5,6,7,8,9,10].map(function(i){ return C(2,'D','e'+i); });
      st.players[0].shields = a.shields;
      st.pile = { byPlayer: 1, mod: 0, combo: { type: 'pair', value: 9, size: 2, key: [9], cards: [C(9,'C','x'), C(9,'S','y')] } };
      st.pending = null; st.respondFor = 0; st.prioGen = a.gen; st.finished = false;
      st.fightEnd = { origin: 1, winner: 1, wonWithCombo: true, strikeTargets: a.targets, winSize: 2 };
      return { t:'mirror', seat:1, q:a.q, bs:'x', st:st };
    }, { shields: shields, targets: targets, q: q, gen: 900 + q });
  }
  const modalText = () => join.evaluate(() => { const m=document.getElementById('modal'); return m?m.textContent:''; });
  /* READ THE LEAD PARAGRAPH, NOT THE WHOLE MODAL. The first version matched /Rival/ against `modalText()`
     and passed a mutant that replaced the striker's name with "Someone" — because `tableContextHTML()`
     renders "Rival's Pair" further down the same modal. An assertion about the LEAD has to read the lead. */
  const leadText = () => join.evaluate(() => { const p=document.querySelector('#modal p'); return p?p.textContent:''; });
  const stackText = () => join.evaluate(() => { const v=document.getElementById('stackView'); return (v && v.style.display!=='none') ? v.textContent : ''; });

  await join.evaluate(()=>document.getElementById('respDecline').click());
  await until(async()=>!(await respOpen(join)));
  const aFe=await appliedCount(join);
  await join.evaluate(m=>window.__cmf.inject(m), await feWindow(3, [0], ++seq));
  ok(await until(async()=>(await appliedCount(join))>aFe), 'fight end copy: the mirror is APPLIED');
  ok(await until(()=>respOpen(join)), 'fight end copy: the window opens');
  const t1 = await modalText();
  ok(/about to strip/i.test(t1) && /YOUR/.test(t1),
     'fight end copy: it says a shield of YOURS is about to be stripped' + (/about to strip/i.test(t1)?'':'  ← got: '+t1.slice(0,120)));
  const lead1 = await leadText();
  const named = /^(.+?)’s Pair is about to strip/.exec(lead1);
  const strikerName = named ? named[1] : null;
  ok(!!strikerName && !/^(Someone|The winner)$/.test(strikerName),
     'fight end copy: the LEAD names the striker ("' + strikerName + '") and the play, not "a Special"' +
     (strikerName ? '' : '  ← lead read: "' + lead1.slice(0, 140) + '"'));

  /* THE STACK VIEW SHOWS THE PENDING LOSS. The go-round runs on an EMPTY stack, so before this the panel
     was blank during the one window where something is at stake. */
  const sv = await stackText();
  ok(/loses a shield/i.test(sv), 'fight end copy: the stack view shows the pending loss' + (/loses a shield/i.test(sv)?'':'  ← stackView read: "'+sv.slice(0,120)+'"'));

  /* AT ZERO SHIELDS IT IS THE KICK, and saying "a shield" there would understate the only decision that
     can end the game. Same window, one field different. */
  await join.evaluate(()=>document.getElementById('respDecline').click());
  await until(async()=>!(await respOpen(join)));
  await join.evaluate(m=>window.__cmf.inject(m), await feWindow(0, [0], ++seq));
  ok(await until(()=>respOpen(join)), 'fight end copy: the window re-opens at 0 shields');
  const t2 = await modalText();
  ok(/FIGHTER KICK/.test(t2),
     'fight end copy: at ZERO shields it names the FIGHTER KICK, not "a shield"' + (/FIGHTER KICK/.test(t2)?'':'  ← got: '+t2.slice(0,140)));

  ok(errs.length===0, 'no page errors'+(errs.length?'  ← '+errs.slice(0,3).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); srv.close(); process.exit(1); });
