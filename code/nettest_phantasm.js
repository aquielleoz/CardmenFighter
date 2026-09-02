/* A CLIENT'S PHANTASMAL ILLUSION MUST GO THROUGH THE HOST (found 2026-08-30 answering Aj's question "what else
 * is a choice for the host, but automated for clients?").
 *
 * `confirmPick`'s phantasm branch called `E.phantasm(state, YOU, opts)` with NO `isClientActive()` guard — the
 * fourth site of the drag-to-play class (v1.31.56). On a client the illusion appeared to work, mutated the
 * mirror, and was wiped by the next broadcast; the host never heard about it.
 *
 * The host re-solves the swap from `addId` alone, because an index computed by an untrusted client is not
 * evidence — the same reason `resolveIds` re-resolves ordinary card ids.
 *
 * STAGING NOTE: one swap cannot raise a matched set on its own (that is why the card measured as dead until
 * v1.31.6), so the client is given an EQUIPMENT DELTA. Without it the illusion is legally refused and the suite
 * would pass on any build.
 * Run: node nettest_phantasm.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
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
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await join.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');

  await host.evaluate(()=>{
    const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
    const nrg=[]; for(let i=0;i<12;i++) nrg.push(C(4,'D','e'+i));
    window.__cmf.forceAll(
      [[C(9,'H','h'),C(9,'C','h'),C(3,'S','h'),C(4,'S','h')],
       [C(10,'D','c'),C(9,'D','c'),C(3,'H','c'),C(5,'S','c')]],
      [nrg, nrg], [4,4],
      { round:3, turn:0, equip:{ 1:[{ id:'eqP', name:'Test Edge', rank:8, suit:'D', delta:2, oppDelta:0, counters:3 }] } });
  });
  await wait(700);
  ok(await join.evaluate(()=>!!document.querySelector('#hand .card[data-id="c10D"]')), 'client holds Phantasmal Illusion (♦10) and a ♦9 to swap in');

  // host leads a pair of 9s
  await host.evaluate(()=>{ ['h9H','h9C'].forEach(id=>{const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click();});
                            const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await until(async()=>(await pile(join)).cards>=2, 60), 'the host led a Pair, and the client sees it');

  /* Select the illusion → the context button becomes "Phantasm" → confirm the swap. */
  const opened = await join.evaluate(()=>{
    const c=document.querySelector('#hand .card[data-id="c10D"]'); if(!c) return 'no card';
    c.click();
    const ctx=document.getElementById('ctxBtn');
    if(!ctx || ctx.disabled || !/Phantasm/i.test(ctx.textContent||'')) return 'ctx="'+((ctx&&ctx.textContent)||'')+'" disabled='+(ctx&&ctx.disabled);
    ctx.click(); return 'opened';
  });
  ok(opened==='opened', 'the client is offered the illusion ('+opened+')');

  const sent = await join.evaluate(()=>{
    const add=document.querySelector('#hand .card[data-id="c9D"]'); if(add) add.click();
    const f=document.getElementById('fightBtn');
    if(f && !f.disabled){ f.click(); return true; }
    return false;
  });
  ok(sent, 'and confirms the swap');

  /* THE ASSERTION: the HOST's own board must show the illusion. On the broken build the client's pile changed
   * locally and the host's never did. */
  const hostSaw = await until(async()=>{
    const l=await host.evaluate(()=>((document.getElementById('log')||{}).textContent||''));
    return /Phantasmal Illusion/i.test(l);
  }, 90);
  ok(hostSaw, 'the HOST records the illusion' +
     (hostSaw?'':'  <-- REPRODUCED: the client ran E.phantasm locally and the host never heard about it'));
  ok(await until(async()=>{
       const pl=await host.evaluate(()=>((document.getElementById('pileLabel')||{}).textContent||''));
       return /You/i.test(pl)===false;   // the pile is no longer the host's
     }, 40), '  → and the pile changed hands on the HOST, not just on the client');

  ok(errs.length===0, 'no JS errors'+(errs.length?': '+errs[0]:''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
