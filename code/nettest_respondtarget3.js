/* A QUICK FROM THE RESPOND? WINDOW CHOOSES ITS TARGET, FROM A 3-PLAYER CLIENT (respond-quick-target-never-asked, v1.32.8).
 *
 * `respond` used to push only a Counter Spell's `counterOid`, so Back Stab cast from a Respond? window locked
 * the NEXT rival and Annoint protected your FIRST Equipment — while the same cards cast in Main let you
 * choose. Now: one button per target (the Counter Spell shape), validated by the host.
 * At 3 players because Back Stab's choice only exists with two rivals, and because `hostApplyMoveN` must
 * un-rotate a SEAT target the client sends in its own frame. Both legs are staged so the CHOICE differs from
 * the old default — or "chose" and "defaulted" would read the same.
 *   1  Back Stab (a Quick under a King): client 1 locks out the HOST, where the default is client 2 (next seat)
 *   2  Annoint: client 1 protects its SECOND piece of Equipment, where the default is the first
 *
 * Run: node nettest_respondtarget3.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const { clickFight } = require('./fightclick');
const DIR=__dirname,PORT=+(process.env.PORT||8465),ROOM='RT'+Date.now().toString().slice(-3);
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
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — sweep.js assigns ports; to run alone use PORT=n node nettest_respondtarget3.js'))); srv.listen(PORT,r); });
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



  const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su});
  const castOnHost=async id=>{ await host.evaluate(i=>{ const c=document.querySelector('#hand .card[data-id="'+i+'"]'); if(c) c.click(); }, id); await wait(250);
    await host.evaluate(()=>{ const a=document.getElementById('cardActivate'), x=document.getElementById('ctxBtn'); if(a&&a.offsetParent&&!a.disabled) a.click(); else if(x&&!x.disabled) x.click(); }); };
  const buttonsOn=async(p,attr)=>{ for(let i=0;i<80;i++){ await declineIfUp(host); await declineIfUp(c2);
      const bs=await p.evaluate(a=>[...document.querySelectorAll('.respQuick['+a+']')].map(b=>({v:b.getAttribute(a), t:b.textContent.replace(/\s+/g,' ').trim()})), attr);
      if(bs.length) return bs; await wait(150); } return []; };
  const HE=s=>Array.from({length:12},(_,i)=>D(i+1,s,'e'+s+i));

  // ===== 1: Back Stab =====
  await host.evaluate(a=>window.__cmf.forceAll(a.h,a.e,[3,3,3],{turn:0, round:3, forms:[null,[{rank:13,suit:'S',tier:'king',name:'King'}],null]}),
    { h:[[D(6,'H','h'),D(3,'C','h')],[D(10,'S','a'),D(4,'H','a')],[D(5,'S','b'),D(4,'S','b')]], e:[HE('H'),HE('S'),[]] });
  await wait(700);
  await castOnHost('h6H');
  const b1=await buttonsOn(c1,'data-tseat');
  ok(b1.length===2, 'client 1 is offered Back Stab once PER RIVAL  ['+b1.map(x=>x.t).join(' | ')+']');
  // client 1's frame is rotated: the host (absolute 0) is its seat 2, client 2 (absolute 2) its seat 1
  await c1.evaluate(()=>{ const b=document.querySelector('.respQuick[data-tseat="2"]'); if(b) b.click(); });
  ok(await until(async()=>await host.evaluate(()=>window.__cmf.lock(0)===true), 60), 'it locked the HOST — the rival it chose');
  ok(await host.evaluate(()=>window.__cmf.lock(2)===false), '…and NOT client 2, the old default (the next seat)');

  // ===== 2: Annoint =====
  await host.evaluate(a=>window.__cmf.forceAll(a.h,a.e,[3,3,3],{turn:0, round:3, forms:[[],[],[]],
      equip:[[],[{id:'eqA',name:'Holy Bow',rank:9,suit:'D'},{id:'eqB',name:'Holy Shroud',rank:9,suit:'H'}],[]]}),
    { h:[[D(6,'H','h'),D(3,'C','h')],[D(5,'H','a'),D(4,'D','a')],[D(5,'S','b'),D(4,'S','b')]], e:[HE('H'),HE('H'),[]] });
  await wait(700);
  await castOnHost('h6H');
  const b2=await buttonsOn(c1,'data-tequip');
  ok(b2.length===2 && b2.some(x=>/Holy Shroud/.test(x.t)), 'client 1 is offered Annoint once PER PIECE of Equipment  ['+b2.map(x=>x.t).join(' | ')+']');
  await c1.evaluate(()=>{ const b=document.querySelector('.respQuick[data-tequip="eqB"]'); if(b) b.click(); });
  const prot=async()=>host.evaluate(()=>{ const r=window.__cmf.roundNow(), e=window.__cmf.equipOf(1)||[]; return { r, A:(e.find(x=>x.id==='eqA')||{}).protectedRound, B:(e.find(x=>x.id==='eqB')||{}).protectedRound }; });
  ok(await until(async()=>{ const x=await prot(); return x.B===x.r; }, 60), 'it protected the SECOND piece — the one it chose  '+JSON.stringify(await prot()));
  const pz=await prot();
  ok(pz.A!==pz.r, '…and NOT the first, the old default');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
