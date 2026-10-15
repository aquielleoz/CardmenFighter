/* A NETPLAY CLIENT CAN SEE ITS OWN SHUFFLE PILE AND ANYONE'S EXILE (v1.33.11).
 *
 * The mirror sent both piles as face-down dummies "because only their COUNTS are ever shown" — true until the ♻
 * viewer shipped. Measured 2026-10-12 on v1.33.9: a client's bar read "♻ 3" and its viewer said "This pile is
 * empty.", while solo and the host showed the cards. The Exile viewer (Aj, 2026-10-12: a separate button, and
 * everyone's pile open) would have inherited exactly that, so the two are fixed together in `netview`.
 *
 * NOTHING HERE STAGES THE EXILE DIRECTLY. Each seat really casts Divine Tactics (♥6) — a plain Technique with no
 * follow-up modal — so the used card has to land in the Exile, travel in the mirror and render in the viewer,
 * end to end. The Shuffle Pile is staged with three cards and then grows by the energy each cast spends, so the
 * assertion is that the viewer lists EXACTLY as many cards as the bar counts, staged ones included.
 * Neither seat holds a Quick, so no window opens and the casts resolve on the spot.
 * Run: node nettest_piles.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8486),ROOM='PL'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const EN=(s,t)=>Array.from({length:12},(_,i)=>D(3,s,t+i));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const idsOn=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).sort().join(','));
const txt=(p,id)=>p.evaluate(i=>((document.getElementById(i)||{}).textContent||'').trim(), id);
const cast=(p,id)=>p.evaluate(cid=>{
  var clr=document.getElementById('clearBtn'); if(clr && !clr.disabled) clr.click();
  [].slice.call(document.querySelectorAll('#hand .card.sel')).forEach(function(c){ c.click(); });
  var c=document.querySelector('#hand .card[data-id="'+cid+'"]'); if(!c) return 'no card';
  c.click();
  var ca=document.getElementById('cardActivate'), cx=document.getElementById('ctxBtn');
  if(ca && ca.offsetParent!==null && !ca.disabled && !/off/.test(ca.className)){ ca.click(); return 'icon'; }
  if(cx && cx.offsetParent!==null && !cx.disabled && !/off/.test(cx.className) && /Activate/i.test(cx.textContent||'')){ cx.click(); return 'ctx'; }   // VISIBLE: a cast's hold hides it with its label intact (ruling 20)
  return 'not offerable';
}, id);
/* WHAT A VIEWER SHOWS: its title, the rows it lists, and its hint — read off the open modal, then closed. */
const viewOf=(p,btn)=>p.evaluate(b=>{
  var x=document.getElementById(b); if(!x) return { missing:true };
  x.click();
  var out={ title:(document.querySelector('#modal h2')||{}).textContent||'',
            ids:[].slice.call(document.querySelectorAll('#pileList .pileRow')).map(function(r){ return r.getAttribute('data-id'); }),
            empty:!!document.querySelector('.pileEmpty'), hint:(document.querySelector('.pileHint')||{}).textContent||'' };
  var d=document.getElementById('pvDone'); if(d) d.click();
  return out;
}, btn);

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_piles.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'duel started');
  await until(()=>host.evaluate(()=>!(document.getElementById('roundfx')||{}).className), 80);   // the opening round card first — see nettest_clientride

  // ---- stage: Divine Tactics in both hands, ♥ energy to pay for it, and three cards in the CLIENT's Shuffle Pile ----
  const H=[D(6,'H','h'),D(3,'H','h'),D(4,'S','h')], C=[D(6,'H','c'),D(3,'C','c'),D(4,'S','c')];
  let staged=false;
  for(let i=0;i<8 && !staged;i++){
    await host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,null,a.opts),{ hands:[H,C], energies:[EN('H','he'),EN('H','ce')],
      opts:{ round:3, turn:0, shuffle:{ 1:[D(5,'H','s'),D(7,'C','s'),D(9,'S','s')] } } });
    staged=await until(async()=>(await idsOn(host))==='h3H,h4S,h6H' && (await idsOn(join))==='c3C,c4S,c6H' && (await txt(join,'youShuf'))==='3', 16);
  }
  ok(staged, 'STAGED: both seats hold Divine Tactics (♥6), and the CLIENT’s bar reads ♻ 3');

  /* ---- THE MEASURED BUG FIRST, before anything else touches the pile: a client's own ♻ viewer ---- */
  const sh=await viewOf(join,'youShufBtn');
  ok(!sh.empty && sh.ids.length===3 && ['s5H','s7C','s9S'].every(id=>sh.ids.indexOf(id)>=0),
     'the CLIENT’s ♻ viewer lists its 3 staged cards'+(sh.empty?'  ← REPRODUCED: "This pile is empty." under a bar that says ♻ 3':'  ['+sh.ids.join(',')+']'));

  // ---- the host casts Divine Tactics on its own turn → its Exile ----
  let how=null;
  await until(async()=>{ how=await cast(host,'h6H'); return how==='icon'||how==='ctx'; }, 40);
  ok(await until(async()=>(await txt(host,'youEx'))==='1', 60), 'the host cast Divine Tactics ('+how+') and its own ⊘ count reads 1 — a used Technique is exiled');

  // ---- then the client's turn: it casts its own ----
  await host.evaluate(()=>window.__cmf.forceAll(null,null,null,{ turn:1 }));
  ok(await until(async()=>(await turnOf(join))===0, 60), 'the turn reached the client');
  how=null;
  await until(async()=>{ how=await cast(join,'c6H'); return how==='icon'||how==='ctx'; }, 40);
  ok(await until(async()=>(await txt(join,'youEx'))==='1', 60), 'the client cast Divine Tactics ('+how+') and its ⊘ count reads 1');

  // ---- what every viewer shows, on both screens ----
  const ex=await viewOf(join,'youExBtn');
  ok(/Exile/.test(ex.title) && ex.ids.length===1 && ex.ids[0]==='c6H', 'the CLIENT’s ⊘ viewer shows its own used Divine Tactics ['+ex.ids.join(',')+']'+(ex.empty?'  ← it travelled as a face-down dummy':''));
  const bar=+(await txt(join,'youShuf')), sh2=await viewOf(join,'youShufBtn');
  ok(bar>=9 && sh2.ids.length===bar && sh2.ids.indexOf('s9S')>=0, 'the CLIENT’s ♻ viewer lists exactly what its bar counts, now with the energy the cast spent ('+sh2.ids.length+' listed, ♻ '+bar+')');
  const rx=await viewOf(join,'rivalExBtn');
  ok(/Exile/.test(rx.title) && rx.ids.length===1 && rx.ids[0]==='h6H' && /view only/.test(rx.hint), 'the CLIENT can open the HOST’s Exile — view only ['+rx.ids.join(',')+']');
  const hx=await viewOf(host,'rivalExBtn');
  ok(/Exile/.test(hx.title) && hx.ids.length===1 && hx.ids[0]==='c6H', 'and the HOST can open the CLIENT’s ['+hx.ids.join(',')+']');
  /* THE CONTROL: the hidden zone beside them stays hidden. Read off the client's OWN state — its copy of the host's
     hand — which must be face-down dummies of the right count (3 dealt, Divine Tactics cast). A first cut read
     `__cmf.adopted()`, which is the end-of-game RECORD and null mid-game, so it could never have failed. */
  const hh=await join.evaluate(()=>window.__cmf.handOf(1));
  ok(hh.length===2 && hh.every(id=>/^hidden:/.test(id)), 'the host’s HAND still reaches the client face-down only, while its piles travel ['+hh.join(',')+']');

  ok(errs.length===0, 'no JS errors'+(errs.length?' — '+errs.slice(0,2).join(' | '):''));
  await b.close(); srv.close();
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
