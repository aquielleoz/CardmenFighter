/* Deterministic netplay ACTIVATE-over-the-wire: the remote client activates a Technique (Gather Energy 1D) on
 * its own turn. Verifies {op:'activate'} reaches the host, the engine applies it (client ramps), the host settles
 * with no counter, the client keeps its turn, and both boards stay error-free and in sync. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8281,ROOM='V'+Date.now().toString().slice(-4);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const energyOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.energy():0);
const playFirst=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); });
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1200); await startDuel(host, join);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // Hand initiative to the client: host leads round 1 with a plain card so it becomes the client's turn.
  for(let i=0;i<20 && await turnOf(host)===0;i++){ await playFirst(host); await wait(500); }
  let gotClient=false; for(let i=0;i<30;i++){ if(await turnOf(join)===0){ gotClient=true; break; } await wait(150); }
  ok(gotClient,'reached the client\'s turn');

  // Stage the client\'s hand with Gather Energy (1D) + energy to pay for it, then read its energy before activating.
  const filler=[D(3,'C'),D(6,'H'),D(8,'S')];
  const energy=[D(2,'D','e'),D(3,'D','e'),D(4,'C','e'),D(5,'H','e'),D(6,'S','e')];
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh:[D(9,'C'),D(9,'H')],rh:[D(1,'D')].concat(filler),he:energy,re:energy});
  await wait(500);
  const before=await energyOf(join);
  ok((await join.evaluate(()=>window.__cmf.hand())).indexOf('1D')>=0,'client holds Gather Energy (1D)');

  // Client selects 1D and activates — this crosses the wire to the host.
  await join.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="1D"]'); if(c)c.click();
    var ca=document.getElementById('cardActivate'); var ctx=document.getElementById('ctxBtn');
    if(ca&&ca.offsetParent!==null&&!ca.disabled&&!/off/.test(ca.className)){ ca.click(); }         // the always-available Activate icon (works while facing a pile)
    else if(ctx&&!ctx.disabled&&!/off/.test(ctx.className)&&/Activate/i.test(ctx.textContent||'')){ ctx.click(); } });
  await wait(1000);

  const after=await energyOf(join);
  ok(after>before,'client ramped over the wire — energy '+before+' → '+after+' (Gather Energy resolved on the host)');
  ok(await turnOf(join)===0,'client keeps its turn after the Technique settles');
  const hostPending=await host.evaluate(()=>window.__cmf.pending());
  ok(hostPending===false,'no lingering stack on the host');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
