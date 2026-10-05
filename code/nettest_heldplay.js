/* A HELD FIGHT, ON BOTH SEATS (v1.32.4).
 *
 * Aj, 2026-10-05: *"if the player is stopped because priority passing happened, at the end of that stack
 * emptying, the active player will not be asked anymore to press next. the sub-phase will just overtly move to
 * the fight sub-phase - with the fight sub-phase announcement. but since his selected cards might be affected,
 * by what ever happened, the player will be given the choice to reselect their fight cards."* — cards KEPT
 * selected, and a hint that still makes sense in the new phase.
 *
 * The local seat already held (`moveToPlayThen`'s `stopIfActed`); a netplay CLIENT did not — the host
 * re-applied its play once the stack emptied, so its cards went down over whatever had resolved. Both legs
 * are staged with a HUMAN casting into the go-round, because the AI will not cast on demand: ♦9 Leyline is
 * the only base Quick castable on an empty stack, and `prompts=all` puts the window in front of the caster.
 *
 *   A  the HOST presses Fight with a card selected; the CLIENT casts Leyline into its go-round → the host is
 *      held (control: this is the path that already worked, now with the banner and the new message)
 *   B  the CLIENT does the same and the HOST casts → the client must be held too (the change)
 *
 * Each asserts: the card did NOT go down, it is STILL SELECTED, the board is in the Fight Sub-Phase without a
 * Next press, the Fight banner showed, the message says what happened — and then one Fight press plays it.
 *
 * Run: node nettest_heldplay.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8457),ROOM='HP'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
const inHand=(p,id)=>p.evaluate(id=>!!document.querySelector('#hand .card[data-id="'+id+'"]'), id);
// the selection is drawn on the GROUP (`.gsel`), not the card — `.card.sel` does not exist in the hand
const isSel=(p,id)=>p.evaluate(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); const g=c&&c.closest('.group'); return !!(g && g.classList.contains('gsel')); }, id);
const board=p=>p.evaluate(()=>({ label:(document.getElementById('fightBtn').textContent||'').trim(), fightOff:document.getElementById('fightBtn').disabled,
  msg:(document.getElementById('message')||{}).textContent||'', hint:(document.getElementById('hint')||{}).textContent||'' }));
const myTurn=p=>p.evaluate(()=>window.__cmf && window.__cmf.turn()===0);   // each page's mirror/state is in its OWN frame: its seat is 0
/* the CASTER's side: wait for its Respond? window and cast Leyline from it; the COMMITTER's side: decline any
   window of its own (it holds a Leyline too, and the go-round starts with it) and watch for the Fight beat */
async function castLeyline(p, id, ms=12000){ const t0=Date.now(); while(Date.now()-t0<ms){
    if(await p.evaluate(id=>{ const b=document.querySelector('.respQuick[data-id="'+id+'"]'); if(b){ b.click(); return true; } return false; }, id)) return true;
    await wait(60); } return false; }
async function commitAndWatch(committer, caster, cardId, casterQuick){
  await committer.evaluate(id=>{ const clr=document.getElementById('clearBtn'); if(clr&&!clr.disabled) clr.click(); const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) c.click(); }, cardId);
  await wait(250);
  const pre=await board(committer);
  await committer.evaluate(()=>document.getElementById('fightBtn').click());
  let beat=false, cast=false; const t0=Date.now();
  while(Date.now()-t0<14000){
    if(!cast) cast=await caster.evaluate(id=>{ const b=document.querySelector('.respQuick[data-id="'+id+'"]'); if(b){ b.click(); return true; } return false; }, casterQuick);
    if(await committer.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d && d.offsetParent && !d.disabled) d.click();
        const fx=document.getElementById('roundfx'); return !!(fx && /phasefx/.test(fx.className) && /Fight sub-phase/.test(fx.textContent||'')); })) beat=true;
    if(cast && beat && /Someone answered/.test((await board(committer)).msg)) break;
    await wait(50);
  }
  await wait(600);
  return { pre, beat, cast };
}

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
  ok(await until(()=>host.evaluate(()=>document.querySelectorAll('#hand .card').length>0)), 'duel started');

  // both seats hold ♦9 Leyline and ten ♦ energy; the host leads with a 10, the client answers with a Jack
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=t=>[1,2,3,4,5,6,7,8,9,10].map(n=>C(n,'D',t));
    window.__cmf.forceAll([[C(10,'C','h'),C(3,'H','h'),C(4,'S','h'),C(9,'D','hq')], [C(11,'C','c'),C(3,'S','c'),C(4,'H','c'),C(9,'D','cq')]],
                          [E('he'), E('ce')], null, {round:1, turn:0}); });
  await wait(600);
  ok(await inHand(host,'h10C') && await inHand(join,'c11C') && await myTurn(host), 'STAGED: host on turn in Main, both seats holding Leyline');

  // ---------------- A: the HOST commits, the CLIENT casts into its go-round ----------------
  const a=await commitAndWatch(host, join, 'h10C', 'cq9D');
  const ab=await board(host);
  ok(/Fight/.test(a.pre.label), 'A: STAGED — the host pressed ⚔️ Fight with a card selected ('+a.pre.label+')');
  ok(a.cast, 'A: …and the client cast Leyline into that go-round');
  ok(await inHand(host,'h10C'), 'A: the host was HELD — its 10 did not go down');
  ok(await isSel(host,'h10C'), 'A: …and it is STILL SELECTED');
  ok(a.beat, 'A: the Fight sub-phase beat flew in — the host was moved over, not asked to press Next');
  ok(/Someone answered/.test(ab.msg) && /still selected/.test(ab.msg) && /Fight/.test(ab.msg), 'A: the message says why and what to do ("'+ab.msg+'")');
  ok(!/Next|Main/.test(ab.hint) && ab.hint.length>0, 'A: the hint reads for the FIGHT sub-phase, not Main ("'+ab.hint+'")');
  ok(/Fight/.test(ab.label) && !ab.fightOff, 'A: the button reads Fight and is live — one press plays it ('+ab.label+')');
  await host.evaluate(()=>document.getElementById('fightBtn').click());
  ok(await until(async()=>!(await inHand(host,'h10C'))), 'A: …and that press played the 10');

  // ---------------- B: the CLIENT commits, the HOST casts into its go-round ----------------
  ok(await until(()=>myTurn(join), 120), 'B: the turn reached the client');
  await until(()=>join.evaluate(()=>{ const h=(document.getElementById('hint')||{}).textContent||''; return !/Hold on|fighting|Waiting/.test(h); }), 80);
  const bb0=await commitAndWatch(join, host, 'c11C', 'hq9D');
  const bb=await board(join);
  ok(/Fight/.test(bb0.pre.label), 'B: STAGED — the client pressed ⚔️ Fight with a card selected ('+bb0.pre.label+')');
  ok(bb0.cast, 'B: …and the host cast Leyline into that go-round');
  ok(await inHand(join,'c11C'), 'B: the CLIENT was HELD — its Jack did not go down'+((await inHand(join,'c11C'))?'':' ← the host re-applied the play over what resolved'));
  ok(await isSel(join,'c11C'), 'B: …and it is STILL SELECTED');
  ok(bb0.beat, 'B: the Fight sub-phase beat flew in on the client');
  ok(/Someone answered/.test(bb.msg) && /still selected/.test(bb.msg), 'B: the message says why and what to do ("'+bb.msg+'")');
  ok(!/Next|Main/.test(bb.hint) && bb.hint.length>0, 'B: the hint reads for the FIGHT sub-phase, not Main ("'+bb.hint+'")');
  ok(/Fight/.test(bb.label) && !bb.fightOff, 'B: the button reads Fight and is live ('+bb.label+')');
  await join.evaluate(()=>document.getElementById('fightBtn').click());
  ok(await until(async()=>!(await inHand(join,'c11C'))), 'B: …and one press played the Jack through the host');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
