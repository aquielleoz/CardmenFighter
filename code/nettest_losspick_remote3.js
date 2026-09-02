/* CHOOSE-WHO-LOSES (remote winner, 3p): client 1 is placed as the round-2 leader with a straight; it leads, host & c2
 * can't beat and pass → c1 wins WITH a combo → c1's own board shows the target picker (from its mirror) and c1 picks
 * c2 over the wire → only c2 loses a shield. Exercises the remote loss-choice park + un-rotation. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8300),ROOM='LR'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const shieldsOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.shields():null);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const leadCombo=(p,ids)=>p.evaluate(function(ids){ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); ids.forEach(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); }); var f=document.getElementById('fightBtn'); if(f)f.click(); }, ids);
const passT=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var b=document.getElementById('passBtn'); if(b)b.click(); });
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function waitFor(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await host.waitForTimeout(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await ready(c1); await wait(300); await ready(c2);
  await waitFor(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  await waitFor(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6);

  // Place c1 (seat 1) as the round-2 leader with a straight; everyone at 4 shields.
  await host.evaluate((a)=>window.__cmf.forceAll(a.hands, null, a.sh, a.opts), {
    hands:[[D(2,'H',"h"),D(3,'H',"h"),D(9,'C',"h")], [D(3,'S'),D(4,'S'),D(5,'S'),D(6,'S'),D(7,'S')], [D(2,'D',"c"),D(4,'H',"c"),D(9,'S',"c")]],
    sh:[4,4,4], opts:{ round:2, turn:1 }
  });
  await wait(500);
  ok(await waitFor(async()=>(await turnOf(c1))===0),'c1 is the round-2 leader');
  const sh0=[await shieldsOf(host), await shieldsOf(c1), await shieldsOf(c2)];

  await leadCombo(c1, ['3S','4S','5S','6S','7S']);   // c1 leads a straight
  await waitFor(async()=>(await turnOf(c2))===0); await passT(c2);
  await waitFor(async()=>(await turnOf(host))===0); await passT(host);

  ok(await waitFor(async()=>await c1.evaluate(()=>!!document.querySelector('.oppPanel.targetable'))),'c1 (remote winner) got the picker from its mirror');
  await c1.evaluate(()=>{ var el=document.querySelector('.oppPanel[data-seat="1"]'); if(el)el.click(); });   // c1 picks abs seat 2 (rotated index 1)

  ok(await waitFor(async()=>await shieldsOf(c2)===sh0[2]-1, 80, 150),'the CHOSEN target (c2) lost a shield ('+sh0[2]+' → '+(await shieldsOf(c2))+')');
  ok(await shieldsOf(host)===sh0[0],'the host (un-chosen) kept its shields ('+(await shieldsOf(host))+')');
  ok(await shieldsOf(c1)===sh0[1],'the winner c1 kept its shields');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
