/* PLAY MUST KEEP MOVING AFTER A TECHNIQUE (netplay duel).
 * The gap this fills: `nettest_full` drives the core loop but only ever jabs and passes, so nothing that goes
 * wrong AROUND an activation is visible to it — and the v1.31.20 host-lockout (the host stranded on a round it
 * had just won) was found through exactly that kind of "does the game still move" check. `nettest_activate`,
 * `nettest_counter` and `nettest_discard` each verify one activation in isolation; none of them then plays on
 * through a round transition, which is where a wedge strands a real game.
 *
 * An earlier attempt bolted random activations onto nettest_full's fight loop and made it fail 5 runs in 10, so
 * this is deliberately a SEPARATE, fully staged suite instead: every hand, energy pile and card is fixed, and
 * the Technique used (Gather Energy, A♦) needs no target and forces no discard — a forced discard is an inline
 * hand picker, not an overlay, and that is precisely what wedged the earlier driver.
 * Run: node nettest_actloop.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8331),ROOM='AL'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const energyOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.energy():0);
const roundOf=p=>p.evaluate(()=>{const t=document.getElementById('roundTag'); return t?parseInt((t.textContent||'').replace(/\D/g,''))||0:0;});
const pileOf=p=>p.evaluate(()=>document.querySelectorAll('#pile .card').length);
/* Poll, never sleep-then-assert: a ceremony legitimately holds the board for seconds, and a fixed wait here is
 * the bug that produced four false signals in two days. */
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=140,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
/* Deselect EVERYTHING before staging anything. Clear alone is not enough: a leftover multi-card selection is
 * staged as a FIGHT ("Special Pair — fight!"), and you cannot activate a pair — both Activate controls go `off`
 * and the attempt reads as "not offerable" forever. That was a 1-in-10 red run, and the culprit was this
 * suite's own board probe leaving a card selected behind it. */
const deselect=p=>p.evaluate(()=>{
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function(c){ c.click(); });
  return document.querySelectorAll('#hand .card.sel').length;
});
const activate=(p,id)=>p.evaluate(cid=>{
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function(c){ c.click(); });
  var c=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!c) return 'no card';
  c.click();
  var ca=document.getElementById('cardActivate'), cx=document.getElementById('ctxBtn');
  if(ca && ca.offsetParent!==null && !ca.disabled && !/off/.test(ca.className)){ ca.click(); return 'icon'; }
  if(cx && !cx.disabled && !/off/.test(cx.className) && /Activate/i.test(cx.textContent||'')){ cx.click(); return 'ctx'; }
  return 'not offerable';
}, id);
const playCard=(p,id)=>p.evaluate(cid=>{
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function(c){ c.click(); });
  var c=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!c) return false;
  c.click();
  var f=document.getElementById('fightBtn');
  if(f && !f.disabled){ f.click(); return true; }
  return false;
}, id);
/* Why an activation was refused. A red run should explain itself — today's whole lesson is that the answer was
 * always in the first trace anyone bothered to capture. */
const whyNot=(p,id)=>p.evaluate(cid=>{
  var ca=document.getElementById('cardActivate'), cx=document.getElementById('ctxBtn');
  var card=document.querySelector('#hand .card[data-id="'+cid+'"]');
  return {
    holdsCard: !!card,
    selected: !!(card && /sel/.test(card.className)),
    energy: (window.__cmf?window.__cmf.energy():-1),
    turn: (window.__cmf?window.__cmf.turn():null),
    pile: document.querySelectorAll('#pile .card').length,
    round: parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
    icon: ca ? { shown: ca.offsetParent!==null, disabled: !!ca.disabled, cls: ca.className } : 'absent',
    ctx: cx ? { text: (cx.textContent||'').slice(0,20), disabled: !!cx.disabled, cls: cx.className } : 'absent',
    hint: ((document.getElementById('hint')||{}).textContent||'').slice(0,60),
    overlay: !!((document.getElementById('overlay')||{}).classList||{contains:()=>0}).contains('show'),
  };
}, id);
const boardUsable=p=>p.evaluate(()=>{
  var rs=((document.getElementById('rivalStatus')||{}).textContent||'').trim();
  if(rs!=='') return false;                                  // still parked on the opponent
  var c=document.querySelector('#hand .card'); if(!c) return false;
  c.click();
  var f=document.getElementById('fightBtn'), okNow=!!(f && !f.disabled);
  c.click();                                                 // put the card back — a probe must not leave state
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  return okNow;
});
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
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  /* Gather Energy is A♦ (cost 1, no target, no forced discard). 2♦ in the energy pile also covers Counter Spell
   * (2♦ + 2 any) for the decline leg below. */
  const energy=()=>[D(2,'D','e'),D(3,'D','e'),D(4,'C','e'),D(5,'H','e'),D(6,'S','e')];
  const stage=(hh,rh)=>host.evaluate(a=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh,rh,he:energy(),re:energy()});

  // ---------- LEG 1: the HOST activates on its own turn, then plays on
  ok(await stage([D(1,'D'),D(4,'H'),D(5,'C')], [D(10,'C'),D(9,'S'),D(8,'H')]), 'staged: host holds Gather Energy (A♦)');
  await until(async()=>await turnOf(host)===0);
  const e0=await energyOf(host);
  /* RETRY until the control is actually offered. Holding the card and having the turn is not the same as the
   * board being interactive — a mirror still settling leaves Activate switched off, and a single-shot attempt
   * turns that into a red run (seen once in 10 before this). Poll for the condition, never assert on attempt 1. */
  let how=null;
  await until(async()=>{ how=await activate(host,'1D'); return how==='icon'||how==='ctx'; }, 60);
  ok(how==='icon'||how==='ctx', `the host can activate a Technique mid-turn (via ${how})`);
  ok(await until(async()=>(await energyOf(host))!==e0), 'the Technique resolved over the wire (energy changed)');
  ok(await turnOf(host)===0, 'and activating did NOT consume the turn — a Technique is not a fight');
  ok(await until(async()=>await boardUsable(host)), 'the board is still usable right after a Technique');

  // ...and the loop continues: host leads, client answers, host passes, the round resolves
  ok(await until(async()=>await playCard(host,'4H')), 'the host still leads a card after activating');
  ok(await until(async()=>await pileOf(join)>0), 'the play reached the client');
  ok(await until(async()=>await turnOf(join)===0), "it is the client's turn");
  ok(await until(async()=>await playCard(join,'10C')), 'the client answers');
  const r0=await roundOf(host);
  ok(await until(async()=>await turnOf(host)===0), 'the turn comes back to the host');
  await host.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });
  ok(await until(async()=>(await roundOf(host))>r0), `the round resolved after an activation (round ${r0} → ${await roundOf(host)})`);
  /* THE WEDGE CHECK, from the client's side this time: the client won, so it must get a usable board. */
  ok(await until(async()=>await boardUsable(join)), 'and the round WINNER can act — no lockout after a Technique');

  // ---------- LEG 2: the CLIENT activates, and the host DECLINES the response window it opens
  /* Stage AFTER the round-2 ceremony has finished. Staged hands set mid-ceremony are clobbered by the new-round
   * deal, which is what made the first version of this leg find no card at all — and the staging must be
   * ASSERTED on the client, not merely assumed from force() returning true. */
  await until(async()=>await host.evaluate(()=>{
    const o=document.getElementById('overlay');
    return !(o && o.classList.contains('show'));
  }));
  let staged=false;
  for(let i=0;i<8 && !staged;i++){
    await stage([D(4,'D'),D(6,'H'),D(7,'C')], [D(1,'D'),D(9,'S'),D(8,'H')]);
    staged=await until(async()=>await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="1D"]')), 12);
  }
  ok(staged, 'staged: the CLIENT really holds Gather Energy (asserted on its own board), host holds Counter Spell (4♦)');

  const gotClient=await until(async()=>await turnOf(join)===0, 30);
  if(!gotClient){                                   // the host leads: hand the turn over first
    await until(async()=>await playCard(host,'6H'));
    await until(async()=>await turnOf(join)===0);
  }
  ok(await until(async()=>await turnOf(join)===0), "reached the client's turn for leg 2");
  ok(await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="1D"]')),
     'and it still holds it now that the turn has arrived');
  const ce0=await energyOf(join);
  let how2=null;
  await until(async()=>{ how2=await activate(join,'1D'); return how2==='icon'||how2==='ctx'; }, 60);
  if(!(how2==='icon'||how2==='ctx')) console.log('   client state when Activate was refused: '+JSON.stringify(await whyNot(join,'1D')));
  ok(how2==='icon'||how2==='ctx', `the client activates over the wire (via ${how2})`);
  // the host may be offered a Counter — decline it, and the client's Technique must still resolve
  const offered=await until(async()=>await host.evaluate(()=>{
    const ov=document.getElementById('overlay');
    return !!(ov && ov.classList.contains('show') && document.getElementById('respDecline'));
  }), 30);
  if(offered) await host.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d)d.click(); });
  /* This was `ok(true, ...)` — not an assertion at all, just a branch report. Both branches are legitimate, so
   * assert the invariant that holds EITHER WAY: after this step the host must have no response window left
   * open. A stuck overlay wedges play, which is exactly the failure mode this suite exists for. */
  ok(await until(async()=>await host.evaluate(()=>{
       const ov=document.getElementById('overlay'); return !(ov && ov.classList.contains('show'));
     }), 30),
     offered ? 'the host was offered a Counter, declined it, and the window closed'
             : 'no response window was owed (host held no springable Quick) — and none is left open');
  /* Gated on the activation having actually been offered. Unconditional, this passed once while NOTHING had
   * been cast — the client's energy had changed for an unrelated reason (a round draw), which is a vacuous
   * assertion of exactly the kind this file exists to avoid. */
  const resolved = (how2==='icon'||how2==='ctx') && await until(async()=>(await energyOf(join))!==ce0);
  ok(resolved, 'the client\'s Technique resolved' + (offered?' after the host declined':'') +
     ((how2==='icon'||how2==='ctx')?'':' — NOT ASSERTED: the activation was never offered'));
  ok(await until(async()=>await turnOf(join)===0), 'the client keeps its turn');
  ok(await until(async()=>await boardUsable(join)), 'and its board is usable — play continues past the window');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
