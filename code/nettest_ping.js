/* THE HOST'S PING IS VISIBLE ON THE CLIENT (ping-invisible-to-client, v1.32.11).
 *
 * Reported in live play: *"the client didn't receive any prompts to ready"*. The client's ping handler wrote
 * `#message`, which lives INSIDE the board — and in the lobby `#netroot` covers the viewport, so the client got
 * a beep and nothing to read, while the host saw "🔔 Pinged your table." and concluded it worked.
 * ⚠ ASSERTED BY HIT-TEST, NOT PRESENCE. No DOM assertion can see a stacking bug (CLAUDE.md, the `.overlay`
 * behind `#netroot` case) — `elementFromPoint` at the notice's centre must land ON the notice.
 * Both client branches: not ready (the seat the nudge is FOR) and ready.
 *
 * Run: node nettest_ping.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8467),ROOM='PG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=90,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
// is the notice really on screen — the topmost thing at its own centre?
const seen=p=>p.evaluate(()=>{ const n=document.getElementById('lobbyPingIn'); if(!n) return { present:false };
  const r=n.getBoundingClientRect(), hit=document.elementFromPoint(r.left+r.width/2, r.top+r.height/2);
  return { present:true, visible:!!hit && (hit===n || n.contains(hit)), text:n.textContent }; });

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  ok(await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo'))), 'the client reaches the lobby (not ready yet)');
  ok(await until(()=>host.evaluate(()=>!!document.getElementById('lobbyPing'))), 'the host has the 🔔 Ping button');
  ok(!(await seen(join)).present, 'CONTROL: no ping notice before the host pings');

  // 1: the seat the nudge is FOR — not ready
  await host.evaluate(()=>document.getElementById('lobbyPing').click());
  ok(await until(async()=>(await seen(join)).present, 40), 'the client gets a ping notice');
  let s=await seen(join);
  ok(s.visible, 'it is VISIBLE — the topmost element at its centre, not painted behind the lobby'+(s.visible?'':'  ← REPRODUCED'));
  ok(/Ready/.test(s.text||''), 'and it tells a not-ready seat what to do ("'+(s.text||'').trim()+'")');

  // 2: a readied seat still learns the host is set
  await join.evaluate(()=>document.getElementById('lobbyGo').click());
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyUnready')), 40);
  await wait(400);
  await host.evaluate(()=>{ const b=document.getElementById('lobbyPing'); if(b) b.click(); });
  ok(await until(async()=>/ready to start/.test(((await seen(join)).text)||''), 40), 'a READIED client gets it too, worded for its state ("'+(((await seen(join)).text)||'').trim()+'")');
  ok((await seen(join)).visible, '…and visible');
  // it clears itself
  ok(await until(async()=>!(await seen(join)).present, 70, 150), 'the notice clears itself after a few seconds');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
