/* A HELD FIGHT AT 3+ PLAYERS (v1.32.4) — `hostApplyMoveN`'s copy, which a duel NEVER reaches.
 *
 * Aj's held-fight rule (see `nettest_heldplay`): a Fight press whose go-round someone ELSE acts in is held —
 * moved into the Fight Sub-Phase with the banner, cards still selected, choose again. The duel suite covers
 * `hostApplyMove`; this file exists because the two handler families have now been missed four times, and the
 * first A/B of `nettest_autopass` passed 15/0 with the N-player guard deleted.
 * Staging: the host leads, CLIENT 1 answers with a Jack, and the HOST casts ♦9 Leyline (the only base Quick
 * castable on an empty stack) into client 1's go-round. Client 2 holds nothing castable.
 *
 * Run: node nettest_heldplay3.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const { clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8459),ROOM='H3'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const D=(n,s,t)=>({rank:n,suit:s,id:(t||'')+n+s});
const EN=()=>Array.from({length:12},(_,i)=>D(2,'D','e'+i));       // ♦ energy: Leyline costs 9
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,110)); }
async function until(fn,t=120,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
const ready=p=>p.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
const respQuicks=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('.respQuick')).map(b=>b.textContent.replace(/\s+/g,' ')));
const declineIfUp=p=>p.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d&&d.offsetParent!==null){ d.click(); return true; } return false; });
const clickPassBtn=p=>p.evaluate(()=>{ const b=document.getElementById('passBtn'); if(b&&!b.disabled){ b.click(); return true; } return false; });
const why=p=>p.evaluate(()=>({
  turn:(window.__cmf?window.__cmf.turn():null),
  msg:((document.getElementById('message')||{}).textContent||'').trim().slice(0,70),
  hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,55),
  passDisabled:!!((document.getElementById('passBtn')||{}).disabled),
  hand:document.querySelectorAll('#hand .card').length,
  modal:!!document.querySelector('.respQuick,#respDecline')
}));

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_heldplay3.js'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join')); await c2.goto(url('join')); await wait(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await ready(c1); await wait(300); await ready(c2);
  await until(async()=>await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Riders/.test(g.textContent||'')); }));
  await host.evaluate(()=>{ var g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await until(async()=>(await turnOf(host))===0 && (await host.evaluate(()=>document.querySelectorAll('#hand .card').length))===6), '3-Rider game started, host leads');

  /* VERIFY THE STAGING ON EVERY SEAT, not one — the duel suite lost three runs in five to a half-checked
     stage that let a leg run against the PREVIOUS leg's hands. A seat still holding an old Quick takes a
     window nobody is watching and the leg reports the brake broken. */
  const idsOn=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.getAttribute('data-id')).sort().join(','));
  const want=h=>h.map(c=>c.id).sort().join(',');
  /* ⚠ `cer` IS LOAD-BEARING — see `nettest_brake`'s note. Every other field here is perfectly STABLE while
     a round ceremony plays its beats, because the deferred draw lands only at the very end, so a settle
     without it returns early and stages onto a board about to gain cards. This suite shows zero misses
     today and the blindness is identical, so it is fixed preventively: leaving one of two sibling suites
     without the check is how the pair drifts apart. */
  const snap=()=>host.evaluate(()=>JSON.stringify({t:window.__cmf.turn(),cer:window.__cmf.ceremony(),h:document.querySelectorAll('#hand .card').length,m:!!document.querySelector('.respQuick,#respDecline')}));
  async function quiet(){ let last=null,same=0; for(let i=0;i<80;i++){ const n=await snap(); same=(n===last && !JSON.parse(n).cer)?same+1:0; last=n; if(same>=4) return true; await wait(250);} console.log('   ⏱ never settled: '+last); return false; }
  async function stage(h0,h1,h2){
    const w=[want(h0),want(h1),want(h2)], pg=[host,c1,c2];
    for(let i=0;i<10;i++){
      await host.evaluate(a=>window.__cmf.forceAll(a.hands,a.energies,a.shields,a.opts),
        { hands:[h0,h1,h2], energies:[EN(),EN(),EN()], shields:[3,3,3], opts:{ turn:0, round:3 } });
      const landed = await until(async()=>{
        for(let s=0;s<3;s++){ if((await idsOn(pg[s]))!==w[s]) return false; }
        return (await turnOf(host))===0;
      }, 16);
      if(landed) return true;
    }
    console.log('   ⏱ stage never landed — '+(await idsOn(host))+' | '+(await idsOn(c1))+' | '+(await idsOn(c2))+'  want '+w.join(' | '));
    return false;
  }
  /* The host LEADS so the next seat is answering a pile and may therefore Pass. Its own transition can
     offer it a window when it holds the Quick, so decline on every page while driving it. */
  async function hostLeads(id){
    await host.evaluate(i=>{ const c=document.querySelector('#hand .card[data-id="'+i+'"]'); const g=c&&c.closest('.group'); if(g) g.click(); }, id);
    const gone=()=>host.evaluate(i=>!document.querySelector('#hand .card[data-id="'+i+'"]'), id);
    for(let k=0;k<40;k++){
      if(await gone()) return true;
      await clickFight(host);
      await declineIfUp(host); await declineIfUp(c1); await declineIfUp(c2);
      await wait(300);
    }
    console.log('   ⏱ the host never led '+id);
    return false;
  }


  const gsel=(p,id)=>p.evaluate(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); const g=c&&c.closest('.group'); return !!(g && g.classList.contains('gsel')); }, id);
  const inHand=(p,id)=>p.evaluate(id=>!!document.querySelector('#hand .card[data-id="'+id+'"]'), id);
  const staged=await stage([D(6,'C','h'),D(3,'H','h'),D(9,'D','hq')], [D(11,'C','a'),D(4,'H','a')], [D(5,'S','b'),D(4,'S','b')]);
  ok(staged, 'staged — the host holds Leyline; client 1 holds a Jack; client 2 holds nothing castable');
  await hostLeads('h6C');
  ok(await until(async()=>(await turnOf(host))===1, 60), 'the host led, and the turn reached client 1');
  await until(async()=>!/Hold on|fighting|Waiting/.test((await why(c1)).hint), 60);
  await c1.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="a11C"]'); if(c) c.click(); });
  await wait(250);
  const pre=(await c1.evaluate(()=>document.getElementById('fightBtn').textContent||'')).trim();
  await c1.evaluate(()=>document.getElementById('fightBtn').click());
  let cast=false, beat=false; const t0=Date.now();
  while(Date.now()-t0<15000){
    if(!cast) cast=await host.evaluate(()=>{ const b=document.querySelector('.respQuick[data-id="hq9D"]'); if(b){ b.click(); return true; } return false; });
    await declineIfUp(c2);
    if(await c1.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d&&d.offsetParent) d.click(); const fx=document.getElementById('roundfx'); return !!(fx && /phasefx/.test(fx.className) && /Fight sub-phase/.test(fx.textContent||'')); })) beat=true;
    if(cast && beat && /Someone answered/.test((await why(c1)).msg)) break;
    await wait(50);
  }
  await wait(600);
  const w=await why(c1);
  ok(/Fight/.test(pre), 'STAGED — client 1 pressed ⚔️ Fight with the Jack selected ('+pre+')');
  ok(cast, '…and the host cast Leyline into that go-round');
  ok(await inHand(c1,'a11C'), 'client 1 was HELD — its Jack did not go down'+((await inHand(c1,'a11C'))?'':' ← hostApplyMoveN re-applied the play'));
  ok(await gsel(c1,'a11C'), '…and it is STILL SELECTED');
  ok(beat, 'the Fight sub-phase beat flew in on client 1');
  ok(/Someone answered/.test(w.msg), 'the message says why ("'+w.msg+'")');
  await c1.evaluate(()=>document.getElementById('fightBtn').click());
  ok(await until(async()=>!(await inHand(c1,'a11C')), 60), 'one Fight press then played the Jack through the host');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
