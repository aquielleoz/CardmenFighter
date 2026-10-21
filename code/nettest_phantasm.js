/* A CLIENT'S PHANTASMAL ILLUSION MUST GO THROUGH THE HOST (found 2026-08-30 answering Aj's question "what else
 * is a choice for the host, but automated for clients?").
 *
 * `confirmPick`'s phantasm branch called `E.phantasm(state, YOU, opts)` with NO `isClientActive()` guard — the
 * fourth site of the drag-to-play class (v1.31.56). On a client the illusion appeared to work, mutated the
 * mirror, and was wiped by the next broadcast; the host never heard about it.
 *
 * SINCE 2026-10-21 THE ILLUSION IS AN ORDINARY `activate` (Aj ruled it a Counterfeit of the whole play), so the
 * swap, `op:'phantasm'` and the host's re-solve are gone and the cast takes the guarded path every Technique takes.
 * The claim is the same one: the copies must exist on the HOST, and the client must then fight with them there.
 *
 * STAGING NOTE: the host leads a pair of 9s, so two copied 9s only tie; the client's +2 EQUIPMENT is what lets
 * the copies win. Without it the fight is legally refused and the last leg would prove nothing.
 * Run: node nettest_phantasm.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { selectAndFight, clickFight, waitHold } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8411),ROOM='PH'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const pile=p=>p.evaluate(()=>{ const s=window.__cmfNetState||null;
  const n=document.querySelectorAll('#pile .card').length;
  return { cards:n, label:((document.getElementById('pileLabel')||{}).textContent||'').trim() }; });
const hostPile=p=>p.evaluate(()=>{ try{ return window.__cmf.pileOwner!==undefined?null:null; }catch(e){ return null; } });
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=120,ms=130){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
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
  ok(await until(async()=>(await join.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    const nrg=[]; for(let i=0;i<12;i++) nrg.push(C(4,'D','e'+i));
    window.__cmf.forceAll(
      [[C(9,'H','h'),C(9,'C','h'),C(3,'S','h'),C(4,'S','h')],
       [C(10,'D','c'),C(9,'D','c'),C(3,'H','c'),C(5,'S','c')]],
      [nrg, nrg], [4,4],
      { round:3, turn:0, equip:{ 1:[{ id:'eqP', name:'Test Edge', rank:8, suit:'D', delta:2, oppDelta:0, counters:3 }] } });
  });
  await wait(700);
  ok(await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="c10D"]')), 'client holds Phantasmal Illusion (♦10)');

  // host leads a pair of 9s
  await host.evaluate(()=>{ ['h9H','h9C'].forEach(id=>{const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click();}); });
  await clickFight(host);   // two-state button (epic step 20) — see fightclick.js
  ok(await until(async()=>(await pile(join)).cards>=2, 60), 'the host led a Pair, and the client sees it');

  /* SINCE 2026-10-21 THE ILLUSION IS AN ORDINARY ⚡ CAST: select it, ⚡ Activate sends `op:'activate'`, and the HOST
   * conjures the copies into its copy of the client's hand. The client then fights with them like any cards. */
  const hostHand=()=>host.evaluate(()=>window.__cmf.handOf(1));        // the HOST's copy of the client's hand — the ground truth
  const opened = await join.evaluate(()=>{
    const c=document.querySelector('#hand .card[data-id="c10D"]'); if(!c) return 'no card';
    c.click();
    const ctx=document.getElementById('ctxBtn');
    if(!ctx || !ctx.offsetParent || ctx.classList.contains('off') || !/Activate/i.test(ctx.textContent||'')) return 'ctx="'+((ctx&&ctx.textContent)||'')+'" off='+(ctx&&ctx.classList.contains('off'));
    ctx.click(); return 'cast';
  });
  ok(opened==='cast', 'the client casts the Illusion with an ordinary ⚡ Activate ('+opened+')');

  /* THE ASSERTION: the copies exist on the HOST. A client that ran the engine locally would show them on its own
   * screen only, and the host's copy of its hand would not change. */
  const hostCopied = await until(async()=>(await hostHand()).filter(id=>/^PH9/.test(id)).length===2, 90);
  ok(hostCopied, 'the HOST conjured the two copied 9s into the client\'s hand  ['+(await hostHand())+']' +
     (hostCopied?'':'  <-- REPRODUCED: the cast never reached the host'));
  ok(await until(()=>join.evaluate(()=>document.querySelectorAll('#hand .card[data-id^="PH9"]').length===2), 60),
     '  → and the client\'s own board shows them, from the host\'s mirror');
  /* …AND COUNTS IT in the record every seat adopts (record-skips-own-transforms). Seat 1 is the client, absolute. */
  const phRec=await host.evaluate(()=>{ const s=window.__cmf.stats(); return (s&&s.seats) ? s.seats[1].eff : null; });
  ok(!!phRec && phRec.D10===1, 'the host\'s record counts the CLIENT\'s Illusion  '+JSON.stringify(phRec));

  /* The client fights with the two copies: a pair of 9s, lifted over the host's 9s by its +2 Equipment. */
  await waitHold(join);
  const ids=await join.evaluate(()=>[...document.querySelectorAll('#hand .card[data-id^="PH9"]')].map(c=>c.dataset.id));
  await selectAndFight(join, ids);
  ok(await until(async()=>{
       const pl=await host.evaluate(()=>((document.getElementById('pileLabel')||{}).textContent||''));
       return /You/i.test(pl)===false;   // the pile is no longer the host's
     }, 60), 'the client fights with the copies, and the pile changes hands on the HOST');

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
