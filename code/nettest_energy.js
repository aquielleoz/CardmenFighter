/* Netplay ENERGY REORDER: a client promotes an energy card; the host must re-validate the permutation, apply it
 * to its authoritative pile, and narrate it PUBLICLY on every board (the new t:'log' broadcast — netplay had no
 * host→client log channel before this). Also checks a rogue payload cannot conjure or delete energy, and that
 * reordering off-turn is refused. Run: node nettest_energy.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8303,ROOM='EN'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const logOf=p=>p.evaluate(()=>(document.getElementById('log')||{}).textContent||'');
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=60,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1150,height:860}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1100);
  await startDuel(host, join);
  await wait(600);

  // stage seat 1 (the client) with a known energy pile, and give it the turn
  await host.evaluate(()=>{
    const mk=(r,s)=>({rank:r,suit:s,id:r+s+'#e'});
    window.__cmf.forceAll(null, [ [mk(2,'D')], [mk(3,'H'),mk(4,'S'),mk(5,'H'),mk(6,'C')] ], null, { turn:1 });
  });
  /* The mirror is a WIRE round trip, so poll for it. Asserting a fixed 700ms after the host staged the deal is
   * the documented flake shape: on a loaded machine the snapshot simply has not arrived yet. */
  ok(await until(async()=>await join.evaluate(()=>!!(window.__cmfNetState && window.__cmfNetState.players[0].energy.length===4))),
     'the client sees its own 4-card energy pile in the mirror');

  // the client promotes its LAST energy card to the front, through the real UI
  await join.evaluate(()=>document.getElementById('youNrgBtn').click()); await wait(400);
  ok(await join.evaluate(()=>document.querySelectorAll('.pileRow').length===4),'the client can open its energy pile over netplay');
  const targetId=await join.evaluate(()=>{ const rows=document.querySelectorAll('.pileRow'); return rows[rows.length-1].getAttribute('data-id'); });
  await join.evaluate(()=>{ const rows=document.querySelectorAll('.pileRow'); rows[rows.length-1].click(); }); await wait(250);
  ok(await join.evaluate(()=>!!document.getElementById('pvPromote') && !document.getElementById('pvPromote').disabled),'⤒ Promote is enabled on the client on its own turn');
  await join.evaluate(()=>document.getElementById('pvPromote').click()); await wait(900);

  const clientTop=await join.evaluate(()=>window.__cmfNetState.players[0].energy[0].id);
  ok(clientTop===targetId,'the host applied the reorder and the mirror shows it on top ('+clientTop+' vs '+targetId+')');
  const hlog=await logOf(host), jlog=await logOf(join);
  ok(/moved .* to the front of their energy pile/.test(hlog),'the HOST log narrates the client\'s move (public)');
  ok(/moved .* to the front of/.test(jlog),'the CLIENT log shows it too, via the new t:log broadcast');

  // ---- a rogue client cannot conjure or delete energy ----
  const roguePile=await join.evaluate(()=>window.__cmfNetState.players[0].energy.map(c=>c.id).join(','));
  await join.evaluate(room=>{
    const ch=new BroadcastChannel('cardmen:'+room);
    const bad=[{op:'reorderEnergy', ids:['9S#hack','9S#hack','9S#hack','9S#hack']},   // foreign ids
               {op:'reorderEnergy', ids:['6C#e']},                                     // short (would delete 3)
               {op:'reorderEnergy', ids:'nope'},                                       // not an array
               {op:'reorderEnergy'}];                                                  // no ids at all
    bad.forEach(it=>ch.postMessage({t:'move', seat:1, intent:it}));
  }, ROOM);
  await wait(900);
  const afterRogue=await join.evaluate(()=>window.__cmfNetState.players[0].energy.map(c=>c.id).join(','));
  ok(afterRogue===roguePile,'four rogue reorder payloads left the pile byte-identical ('+afterRogue+')');
  ok(await join.evaluate(()=>window.__cmfNetState.players[0].energy.length===4),'…and the pile is still exactly 4 cards');

  // ---- off-turn is refused ----
  await host.evaluate(()=>{ window.__cmf.forceAll(null, null, null, { turn:0 }); }); await wait(700);
  await join.evaluate(()=>{ const d=document.getElementById('pvDone'); if(d) d.click(); }); await wait(200);
  await join.evaluate(()=>document.getElementById('youNrgBtn').click()); await wait(400);
  ok(await join.evaluate(()=>document.querySelectorAll('.pileRow.ro').length>0),'off-turn the client\'s pile is read-only');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
