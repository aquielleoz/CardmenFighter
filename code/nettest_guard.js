/* Deterministic netplay REMOTE SHIELD-GUARD (Leyline). Round 1 is jabs-only, so we first resolve round 1 (host
 * leads a jab, client passes → host wins, no shield lost), THEN in round 2 stage a host combo win (5-card straight
 * the client can't beat) that threatens the client's shield. The client holds Leyline (9D) and springs it OVER THE
 * WIRE. Verifies the guard modal pops from the mirror, resolves on the host, and the client keeps its shield. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8285),ROOM='G'+Date.now().toString().slice(-4);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const shieldsOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.shields():null);
const roundOf=p=>p.evaluate(()=>parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0);
const modalUp=p=>p.evaluate(()=>document.getElementById('overlay').classList.contains('show'));
const leadCombo=(p,ids)=>p.evaluate(function(ids){ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); ids.forEach(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); }); var f=document.getElementById('fightBtn'); if(f)f.click(); }, ids);
const leadFirst=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); });
const passC=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var b=document.getElementById('passBtn'); if(b)b.click(); });
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn){ for(let i=0;i<60;i++){ if(await fn()) return true; await wait(120); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1200); await startDuel(host, join);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // --- Round 1 (jabs only): host leads a jab, client passes → host wins round 1 (no shield lost) → round 2. ---
  ok(await turnOf(host)===0,'host leads round 1');
  await leadFirst(host);
  await waitFor(async()=>await turnOf(join)===0);
  await passC(join);
  const gotR2=await waitFor(async()=>await roundOf(host)>=2 && await turnOf(host)===0);
  ok(gotR2,'reached round 2 with the host leading');

  // --- Round 2: stage a host combo win vs a client holding Leyline. ---
  const hostE=[D(2,'C','e'),D(3,'C','e')];
  const cliE=[D(2,'D','e'),D(3,'D','e'),D(4,'D','e'),D(5,'D','e'),D(6,'D','e'),D(7,'C','e'),D(8,'C','e'),D(9,'C','e'),D(10,'H','e'),D(2,'H','e'),D(3,'S','e'),D(4,'S','e')];
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh:[D(3,'C'),D(4,'C'),D(5,'C'),D(6,'C'),D(7,'C')],rh:[D(9,'D'),D(2,'C'),D(3,'H')],he:hostE,re:cliE});
  await wait(500);
  const shBefore=await shieldsOf(join);
  ok(shBefore!=null,'read client shields before the combo ('+shBefore+')');

  await leadCombo(host,['3C','4C','5C','6C','7C']);   // host leads a straight (combos legal in round 2)
  const cliTurn=await waitFor(async()=>await turnOf(join)===0);
  ok(cliTurn,'control passed to the client to answer the combo');
  await passC(join);                                   // client can't beat it → passes → host wins WITH a combo → shield threatened

  const guardModal=await waitFor(async()=>await modalUp(join));
  ok(guardModal,'client shield-guard modal appeared from the mirror');
  const clicked=await join.evaluate(()=>{ var y=document.getElementById('sgYes'); if(y){ y.click(); return 'guard'; } return null; });
  ok(clicked==='guard','client sprang Leyline over the wire');
  await wait(1800);

  const shAfter=await shieldsOf(join);
  ok(shAfter===shBefore,'client kept its shield via Leyline ('+shBefore+' → '+shAfter+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
