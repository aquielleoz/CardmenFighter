/* THE CLIENT DISCARDS TO HAND SIZE AND THE HOST MUST CARRY ON — Aj's worst report, 2026-09-02, from a real
 * online duel. His host trace ends here and never resumes:
 *
 *     269.82s  move IN from seat 1 op=pass q=96
 *     498.86s  move IN from seat 1 op=discard q=226      <- last entry, ever
 *
 * No `hostTakeBack`, no `awaitRival`. Meanwhile his client received a mirror every ~1.8s forever (the v1.31.80
 * park heartbeat, faithfully re-asserting a board that would never move) with `myHand=11` unchanged. The only
 * escape was Concede — a wedged game shows no Leave button, so the exit costs a recorded loss.
 *
 * WHY NO SUITE CAUGHT IT: `nettest_trim` stages the HOST over the hand cap, because that is the seat that gets
 * an interactive pick in solo. Every other seat is auto-trimmed. Nobody had ever staged a REMOTE seat over the
 * cap, which is the branch that parks the host on `netReact` and waits for a `{op:'discard'}` from the wire.
 * Run: node nettest_remotetrim.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8451),ROOM='RT'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=150,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const view=p=>p.evaluate(()=>({
  round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  yourTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  hand:document.querySelectorAll('#hand .card').length,
  msg:((document.getElementById('message')||{}).textContent||'').trim(),
  status:((document.getElementById('rivalStatus')||{}).textContent||'').trim(),
  fightOff:!!(document.getElementById('fightBtn')||{}).disabled,
  passOff:!!(document.getElementById('passBtn')||{}).disabled,
}));
const tail=p=>p.evaluate(()=>{ try{ return window.__cmf.trace().slice(-8); }catch(e){ return ['(no trace)']; } });

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
  ok(await until(async()=>(await view(host)).round>0), 'duel started');

  /* THE CLIENT over the hand cap — the mirror image of nettest_trim, and the case nothing covered. 13 cards
   * against a cap of 10 leaves it over even after playing one, so the pick is unavoidable. */
  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    const many=[]; [3,4,5,6,7,8,9,10,11,12,13,1,2].forEach((r,i)=>many.push(C(r,'DHCS'[i%4],'c')));
    window.__cmf.force([C(4,'D','h'),C(5,'H','h'),C(6,'C','h'),C(7,'S','h')], many);
  });
  await wait(600);
  ok(await until(async()=>(await view(join)).hand>=12, 40), 'the CLIENT is staged over the hand cap  (hand '+(await view(join)).hand+')');

  // play the round out so the end-of-round clean-up fires
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card'); if(c)c.click();
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await view(join)).yourTurn, 80), 'the turn reached the client');
  await join.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); });

  /* The client should now be handed the real picker on its own board. */
  const gotPicker = await until(async()=>/[Dd]iscard|[Cc]lean-up|hand limit/.test((await view(join)).msg), 90);
  ok(gotPicker, 'the client is given its own clean-up pick'+(gotPicker?'':'  [msg: "'+(await view(join)).msg+'"]'));
  ok(/discarding to hand size/i.test((await view(host)).status), '  → and the host says who it is waiting on  [status: "'+(await view(host)).status+'"]');

  /* AND IT MUST BE TOLD THE TRUTH ABOUT IT (Aj's report 1, same screenshot as the wedge). The trim reuses the
   * forced-discard window, so it used to announce itself as a Telekinesis — "Rival forces a discard" — and name
   * the wrong pile: `discardChosen` pushes to ENERGY, and the picker's own hint said Energy while this line
   * said Shuffle, contradicting itself on screen. */
  const jm = (await view(join)).msg;
  ok(!/forces a discard/i.test(jm), 'the client is not told a Rival forced this — it is the clean-up  [msg: "'+jm+'"]');
  ok(/Energy/i.test(jm) && !/Shuffle/i.test(jm), '  → and it names the ENERGY pile, which is where the cards actually go');

  // confirm the pick the way a player does: select until Fight enables, then Fight
  await join.evaluate(()=>{
    const cards=[...document.querySelectorAll('#hand .card')];
    for(const c of cards){ c.click();
      const f=document.getElementById('fightBtn'); if(f && !f.disabled){ f.click(); return; } }
  });

  /* THE ASSERTION. Aj's host stopped here forever. Anything that moves is enough: the round advancing, or the
   * host getting its board back — a wedge produces neither. */
  /* THE ROUND NUMBER IS NOT PROOF, and the first version of this assertion accepted it — passing vacuously on
   * a genuinely wedged host. `resolveRoundWin` advances the round at RESOLUTION, before the clean-up trim runs,
   * so `round>=2` is already true while the host sits parked. The thing that only clears when the discard is
   * actually APPLIED is the status line the host set when it parked. */
  const moved = await until(async()=>!/discarding to hand size/i.test((await view(host)).status), 120);
  if(!moved){
    const h=await view(host), j=await view(join);
    console.log('   HOST  round '+h.round+' yourTurn '+h.yourTurn+' status "'+h.status+'" fight '+(h.fightOff?'off':'on')+' pass '+(h.passOff?'off':'on'));
    console.log('   CLIENT round '+j.round+' hand '+j.hand+' msg "'+j.msg+'"');
    console.log('   host trace: '+(await tail(host)).join(' | '));
    console.log('   join trace: '+(await tail(join)).join(' | '));
  }
  ok(moved, 'THE TABLE CARRIES ON after the client discards'+
            (moved?'':'  ← REPRODUCED: the host is wedged, and a wedged game offers no Leave — only Concede'));

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log((fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(1); });
