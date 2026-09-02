/* Deterministic netplay ACTIVATE-over-the-wire: the remote client activates a Technique (Gather Energy 1D) on
 * its own turn. Verifies {op:'activate'} reaches the host, the engine applies it (client ramps), the host settles
 * with no counter, the client keeps its turn, and both boards stay error-free and in sync. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8281),ROOM='V'+Date.now().toString().slice(-4);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,tag)=>({rank:n,suit:s,id:(tag||'')+n+s});
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const energyOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.energy():0);
/* THE ART POP IS TRANSIENT (1.15-2.5s and self-clearing), so watch for it rather than sampling. Records the
 * caption of every flash since arming, which is what lets an assertion name WHICH card popped. */
const armFx=p=>p.evaluate(()=>{ window.__fx=[]; var w=document.getElementById('artFlash');
  if(window.__fxObs) window.__fxObs.disconnect();
  window.__fxObs=new MutationObserver(function(){ if(w.classList.contains('show')){ var t=w.querySelector('.afTitle'); window.__fx.push(((t&&t.textContent)||'?').replace(/\s+/g,' ').trim()); } });
  window.__fxObs.observe(w,{attributes:true,attributeFilter:['class']}); });
const fxSeen=async(p,ms)=>{ for(let i=0;i<(ms||4000)/100;i++){ const f=await p.evaluate(()=>window.__fx||[]); if(f.length) return f; await wait(100); } return []; };
const playFirst=p=>p.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); });
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
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
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh:[D(9,'C'),D(9,'H'),D(1,'D','h')],rh:[D(1,'D')].concat(filler),he:energy,re:energy});
  await wait(500);
  const before=await energyOf(join);
  ok((await join.evaluate(()=>window.__cmf.hand())).indexOf('1D')>=0,'client holds Gather Energy (1D)');

  // Client selects 1D and activates — this crosses the wire to the host.
  await armFx(join); await armFx(host);
  await join.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="1D"]'); if(c)c.click();
    var ca=document.getElementById('cardActivate'); var ctx=document.getElementById('ctxBtn');
    if(ca&&ca.offsetParent!==null&&!ca.disabled&&!/off/.test(ca.className)){ ca.click(); }
    else if(ctx&&!ctx.disabled&&!/off/.test(ctx.className)&&/Activate/i.test(ctx.textContent||'')){ ctx.click(); } });
  await wait(1000);

  /* THE CLIENT'S OWN CAST MUST SHOW ITS ART (Aj, 2026-09-02: *"no animation on the client when activating a
   * Jack"*). The client guard sends the intent and RETURNS before any presentation, so the caster saw nothing. */
  const fxJoin=await fxSeen(join);
  ok(fxJoin.length>0,'the CLIENT sees its own cast pop'+(fxJoin.length?' ['+fxJoin.join(' | ')+']':' — NOTHING flashed'));
  /* AND THE HOST MUST SEE IT TOO. Its activate branch only say()s, so a remote seat's effect was invisible on
   * the host as well — the same gap in the other direction. */
  const fxHost=await fxSeen(host);
  ok(fxHost.length>0,'the HOST sees the client\'s cast pop'+(fxHost.length?' ['+fxHost.join(' | ')+']':' — NOTHING flashed'));

  const after=await energyOf(join);
  ok(after>before,'client ramped over the wire — energy '+before+' → '+after+' (Gather Energy resolved on the host)');
  ok(await turnOf(join)===0,'client keeps its turn after the Technique settles');
  /* THE TRANSFORM BRANCH IS A SEPARATE CALL SITE and a different presentation — a Ride/Form pops centre-stage
   * with `flashArt` and never enters the reader, so the Technique above does not cover it. This is Aj's literal
   * report: *"no animation on the client when it activates a Jack"*.
   * The gate is what needs rigging, not the card: TRANSFORM_GATE defaults to 'table', so a Ride needs
   * numPlayers x 1 = 2 shields lost across the table. force()'s hs/rs set them (START_SHIELDS is 4). */
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re,3,3),
    {hh:[D(9,'C'),D(9,'H')],rh:[D(11,'D')].concat(filler),he:energy,re:energy});
  await wait(500);
  await armFx(join); await armFx(host);
  await join.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="11D"]'); if(c)c.click();
    var ca=document.getElementById('cardActivate'); var ctx=document.getElementById('ctxBtn');
    if(ca&&ca.offsetParent!==null&&!ca.disabled&&!/off/.test(ca.className)){ ca.click(); }
    else if(ctx&&!ctx.disabled&&!/off/.test(ctx.className)&&/Activate/i.test(ctx.textContent||'')){ ctx.click(); } });
  const fxRide=await fxSeen(join);
  ok(fxRide.length>0,'the CLIENT sees its own JACK pop'+(fxRide.length?' ['+fxRide.join(' | ')+']':' — NOTHING flashed'));
  /* NOT VACUOUS: the pop above means nothing unless the Ride actually entered the zone — a gated-shut board
   * would refuse the cast and an assertion on the art alone could never tell the difference. */
  // the zone renders COLLAPSED (rank/suit chips, not .card elements) and is display:none while empty, so read visibility
  let rode=false; for(let i=0;i<30;i++){ if(await join.evaluate(()=>{ var z=document.getElementById('youFormZone'); return !!(z && z.offsetParent!==null && z.children.length>1); })){ rode=true; break; } await wait(150); }
  ok(rode,'and the Ride really entered the client\'s zone (so the pop is not for a refused cast)');

  /* THE OTHER DIRECTION: the host's own cast is presented locally but nothing pushes it to the client, so a
   * client never saw ANY effect art — its own or the opponent's. Hand the turn back and cast from the host. */
  for(let i=0;i<30 && await turnOf(join)===0;i++){ await join.evaluate(()=>{ var b=document.getElementById('passBtn'); if(b&&!b.disabled)b.click(); }); await wait(300); }
  let hostTurn=false; for(let i=0;i<40;i++){ if(await turnOf(host)===0){ hostTurn=true; break; } await wait(150); }
  ok(hostTurn,'turn came back to the host');
  // re-stage the host's energy: several rounds have been played since the first force() and it has been spending.
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re),{hh:[D(9,'C'),D(9,'H'),D(1,'D','h')],rh:filler,he:energy,re:energy});
  await wait(400);
  await armFx(join); await armFx(host);
  await host.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="h1D"]'); if(c)c.click();
    var ca=document.getElementById('cardActivate'); var ctx=document.getElementById('ctxBtn');
    if(ca&&ca.offsetParent!==null&&!ca.disabled&&!/off/.test(ca.className)){ ca.click(); }
    else if(ctx&&!ctx.disabled&&!/off/.test(ctx.className)&&/Activate/i.test(ctx.textContent||'')){ ctx.click(); } });
  const fxJoin2=await fxSeen(join);
  ok(fxJoin2.length>0,'the CLIENT sees the HOST\'s cast pop'+(fxJoin2.length?' ['+fxJoin2.join(' | ')+']':' — NOTHING flashed'));

  /* THE FOURTH CALL SITE: the local TRANSFORM branch's broadcast. It is a byte-identical line to the Technique
   * one above, which is exactly why it needs its own coverage — the two sit in different branches of the same
   * function and the transform branch RETURNS early, so a call placed one line later would be dead code that
   * reads as live. This is also the ordinary case of watching an opponent call a Ride. */
  await host.evaluate((a)=>window.__cmf.force(a.hh,a.rh,a.he,a.re,3,3),
    {hh:[D(11,'C','h')].concat(filler),rh:[D(9,'S'),D(9,'D')],he:energy,re:energy});
  await wait(500);
  await armFx(join);
  await host.evaluate(()=>{ var clr=document.getElementById('clearBtn'); if(clr)clr.click(); var c=document.querySelector('#hand .card[data-id="h11C"]'); if(c)c.click();
    var ca=document.getElementById('cardActivate'); var ctx=document.getElementById('ctxBtn');
    if(ca&&ca.offsetParent!==null&&!ca.disabled&&!/off/.test(ca.className)){ ca.click(); }
    else if(ctx&&!ctx.disabled&&!/off/.test(ctx.className)&&/Activate/i.test(ctx.textContent||'')){ ctx.click(); } });
  const fxRide2=await fxSeen(join);
  ok(fxRide2.length>0,'the CLIENT sees the HOST\'s JACK pop'+(fxRide2.length?' ['+fxRide2.join(' | ')+']':' — NOTHING flashed'));
  let rode2=false; for(let i=0;i<30;i++){ if(await join.evaluate(()=>{ var z=document.getElementById('rivalFormZone'); return !!(z && z.offsetParent!==null && z.children.length>1); })){ rode2=true; break; } await wait(150); }
  ok(rode2,'and the host\'s Ride really shows in the client\'s view of its zone');

  const hostPending=await host.evaluate(()=>window.__cmf.pending());
  ok(hostPending===false,'no lingering stack on the host');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
