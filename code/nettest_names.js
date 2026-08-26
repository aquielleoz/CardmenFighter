/* Netplay PLAYER NAMES: each side sets its own name, and the other side sees it instead of "Rival"/"P2".
 * The wire path is: client sends `name` on join → host sanitises and collects it (plus its own) → host
 * rebroadcasts the table in `setup` → the client ROTATES it into its own frame, because its mirror is
 * seat-rotated. That rotation is the part most likely to be wrong, so it is asserted from both ends.
 * Run: node nettest_names.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8314,ROOM='NM'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const log=p=>p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()));
const hasLog=async(p,re)=>{ for(let i=0;i<60;i++){ if((await log(p)).some(l=>re.test(l))) return true; await wait(150);} return false; };
async function waitHand(p){ for(let i=0;i<60;i++){ if((await p.evaluate(()=>document.querySelectorAll('#hand .card').length))>0) return true; await wait(150);} return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1150,height:860}}); const errs=[];
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));

  // each side stores its own name before connecting (the setup field writes this key)
  await host.goto(url('host'));
  await host.evaluate(()=>localStorage.setItem('cmf_name_v1','Aj')); await host.reload();
  await join.goto(url('join'));
  await join.evaluate(()=>localStorage.setItem('cmf_name_v1','Bea')); await join.reload();
  await wait(1100);
  await startDuel(host, join); await wait(900);
  ok(await waitHand(host) && await waitHand(join),'duel started with both names set');

  /* STAGE BOTH HANDS. This suite is about NAMES, and it had no business depending on the shuffle — but it did:
   * the host played whatever card happened to be first in its hand and the client then had to find something
   * that beat it. The apex 2 is unbeatable (value 15) and an Ace nearly always is, so a bad deal meant the
   * client never played, and the two assertions about ITS narration failed together. Measured before this fix:
   * 2 failures in 10 runs, both times exactly those two assertions — the same deal-dependence found in
   * nettest_log the same day. Host leads a 4, the client holds a 10, so an answer is guaranteed. */
  await host.evaluate(()=>{
    const C=(n,su)=>({rank:n, suit:su, id:'nm'+n+su});
    window.__cmf.force([C(4,'D'),C(5,'H'),C(6,'C'),C(7,'S')],
                       [C(10,'C'),C(9,'S'),C(8,'H'),C(7,'D')]);
  });
  await wait(400);
  ok(await host.evaluate(()=>!!document.querySelector('#hand .card[data-id="nm4D"]')),
     'hands staged, so this suite no longer depends on the deal');

  // the HOST plays: the client must see "Aj", never "Rival"
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="nm4D"]'); if(c)c.click();
    const f=document.getElementById('fightBtn'); if(f&&!f.disabled)f.click(); });
  ok(await hasLog(join,/^Aj played/),'the client sees the host by name ("Aj played …"), not "Rival"');
  ok(!(await log(join)).some(l=>/^Rival played/.test(l)),'…and no line falls back to "Rival"');
  ok(await hasLog(host,/^You played/),'the host still reads its own play as "You played"');

  // the CLIENT plays: the host must see "Bea"
  for(let i=0;i<60 && (await join.evaluate(()=>window.__cmf?window.__cmf.turn():null))!==0;i++) await wait(150);
  await join.evaluate(()=>{
    const clr=document.getElementById('clearBtn'), f=document.getElementById('fightBtn');
    const cards=[].slice.call(document.querySelectorAll('#hand .card'));
    for(let k=0;k<cards.length;k++){ if(clr)clr.click(); document.querySelectorAll('#hand .card')[k].click(); if(f&&!f.disabled){ f.click(); return; } }
  });
  ok(await hasLog(host,/^Bea played/),'the host sees the client by name ("Bea played …")');
  ok(await hasLog(join,/^You played/),'…while the client reads its own play as "You played"');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\nCLIENT LOG:'); (await log(join)).forEach(l=>console.log('   '+l.slice(0,80)));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
