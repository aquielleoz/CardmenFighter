/* THE BROADWAY PITCH IS CHOSEN, ON A NETPLAY CLIENT (broadway-pitch-chooses-itself, v1.32.6).
 *
 * Aj, from real play: *"oh no it did not let me pick which broadway card.... this is a bug for sure.. and
 * probably more of a problem in multiplayer clients"* — and later a 10 lost out of a full house. The engine
 * took the LOWEST Broadway card with no say from anybody; and a Quick cast (Armor Piercing under Hippolyta,
 * from the Respond? window) paid NO pitch at all.
 *
 * Driven from the CLIENT, because that is where both the choice and the wire are: the host's copy of the
 * client's hand is the ground truth for WHICH card left. Staged so a default and a choice differ — the 10 is
 * the lowest Broadway card, the Ace is the one chosen — so "the hand shrank" is never the assertion.
 *
 *   1  RESPOND? WINDOW — the host casts a Technique; the client answers with Armor Piercing and the window
 *      offers ONE BUTTON PER BROADWAY CARD; it picks the Ace
 *   2  MAIN, CANCEL — the client casts Critical Hit, aims it, gets the Broadway-only pick, and backs out:
 *      nothing spent
 *   3  MAIN, CHOOSE — the same cast, and it chooses the Ace
 *
 * Run: node nettest_pitch.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { clickFight } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8461),ROOM='BP'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
const clientHand=()=>host.evaluate(()=>window.__cmf.handOf(1));        // the HOST's copy — the ground truth
let host, join;

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await host.goto(url('host')); await join.goto(url('join'));
  await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo')));
  await startDuel(host, join);
  ok(await until(()=>host.evaluate(()=>document.querySelectorAll('#hand .card').length>0)), 'duel started');

  // ================= 1: the Respond? window =================
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(6,'H','h'),C(3,'H','h'),C(4,'S','h')], [C(7,'C','c'),C(10,'H','c'),C(1,'S','c'),C(4,'H','c')]],
                          [E('H','he'), E('C','ce')], null, {round:3, turn:0, forms:[null,[{rank:12,suit:'C',tier:'queen',name:'Hippolyta'}]]}); });
  await wait(600);
  ok(JSON.stringify((await clientHand()).sort())===JSON.stringify(['c10H','c1S','c4H','c7C']), 'STAGED: the client holds Armor Piercing, a 10♥ and an A♠, with Hippolyta in its zone');
  // the host casts Divine Tactics on its own turn (no follow-up discard to leave the table waiting); the client is offered the window
  await host.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="h6H"]'); if(c) c.click(); });
  await wait(250);
  await host.evaluate(()=>{ const a=document.getElementById('cardActivate'), x=document.getElementById('ctxBtn'); if(a&&a.offsetParent&&!a.disabled) a.click(); else if(x&&!x.disabled) x.click(); });
  // the host may hold priority first on its own cast — decline it
  const btns=await (async()=>{ for(let i=0;i<80;i++){ await host.evaluate(()=>{ const d=document.getElementById('respDecline'); if(d&&d.offsetParent) d.click(); });
      const bs=await join.evaluate(()=>[...document.querySelectorAll('.respQuick[data-pitch]')].map(b=>({pitch:b.getAttribute('data-pitch'), text:b.textContent.replace(/\s+/g,' ')})));
      if(bs.length) return bs; await wait(150); } return []; })();
  ok(btns.length===2 && btns.some(x=>x.pitch==='c10H') && btns.some(x=>x.pitch==='c1S'), 'the Respond? window offers ONE BUTTON PER BROADWAY CARD  ['+btns.map(x=>x.text.trim()).join(' | ')+']');
  await join.evaluate(()=>{ const b=document.querySelector('.respQuick[data-pitch="c1S"]'); if(b) b.click(); });
  ok(await until(async()=>(await clientHand()).indexOf('c7C')<0, 60), 'the client cast Armor Piercing through the host');
  const h1=await clientHand();
  ok(h1.indexOf('c1S')<0 && h1.indexOf('c10H')>=0, 'the pitch it CHOSE left — the Ace — and the 10 (the default) stayed  ['+h1+']');

  // ================= 2 + 3: the Main-phase picker =================
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(3,'D','h'),C(4,'C','h')], [C(9,'S','c'),C(10,'H','c'),C(10,'D','c'),C(1,'H','c'),C(4,'H','c')]],
                          [E('D','he'), E('S','ce')], [4,4], {round:3, turn:1}); });
  await wait(600);
  ok(await until(()=>join.evaluate(()=>window.__cmf.turn()===0 && !!document.querySelector('#hand .card[data-id="c9S"]')), 60), 'STAGED: the client is on turn holding Critical Hit, a pair of 10s and an Ace');
  async function castCrit(){
    await join.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="c9S"]'); if(c) c.click(); });
    await wait(250);
    await join.evaluate(()=>{ const a=document.getElementById('cardActivate'), x=document.getElementById('ctxBtn'); if(a&&a.offsetParent&&!a.disabled) a.click(); else if(x&&!x.disabled) x.click(); });
    await wait(300);
    await join.evaluate(()=>{ const r=document.getElementById('rival'); if(r) r.click(); });            // aim it at the host
    await wait(250);
    await join.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && /Activate/.test(x.textContent)) x.click(); });   // confirm the target
    return until(()=>join.evaluate(()=>/Broadway/.test((document.getElementById('hint')||{}).textContent||'')), 40);
  }
  const energy0=await join.evaluate(()=>window.__cmf.energy());
  ok(await castCrit(), 'aiming Critical Hit opens the Broadway pick ("'+(await join.evaluate(()=>(document.getElementById('hint')||{}).textContent))+'")');
  const pickable=await join.evaluate(()=>[...document.querySelectorAll('#hand .card')].filter(c=>!c.classList.contains('notpick')).map(c=>c.dataset.id).sort());
  ok(JSON.stringify(pickable)===JSON.stringify(['c10D','c10H','c1H']), '…offering ONLY the Broadway cards, never the casting card  ['+pickable+']');
  ok((await clientHand()).length===5, 'nothing spent yet — the host still sees five cards');
  // 2: cancel
  await join.evaluate(()=>{ const p=document.getElementById('passBtn'); if(p && /Cancel/.test(p.textContent)) p.click(); });
  await wait(500);
  ok((await clientHand()).length===5 && (await join.evaluate(()=>window.__cmf.energy()))===energy0 && !/Broadway/.test(await join.evaluate(()=>(document.getElementById('hint')||{}).textContent||'')),
     'Cancel backs out — no card and no energy spent');
  // 3: choose the Ace
  ok(await castCrit(), 'cast again — the pick reopens');
  await join.evaluate(()=>{ const c=document.querySelector('#hand .card[data-id="c1H"]'); if(c) c.click(); });
  await wait(200);
  await join.evaluate(()=>{ const f=document.getElementById('fightBtn'); if(f && !f.disabled) f.click(); });   // Confirm
  ok(await until(async()=>(await clientHand()).indexOf('c9S')<0, 60), 'Confirm cast Critical Hit through the host');
  const h3=await clientHand();
  ok(h3.indexOf('c1H')<0 && h3.indexOf('c10H')>=0 && h3.indexOf('c10D')>=0, 'the Ace it CHOSE left, and the pair of 10s is intact  ['+h3+']');

  // the duel host narrates a client's cast in full too (client-activation-line-short-form) — `hostApplyMove`'s twin
  const hl=await host.evaluate(()=>[...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'));
  ok(/played a Technique - 9♠ Critical Hit —/.test(hl), 'the duel host narrates the client\'s Critical Hit in full'+(/played a Technique - 9♠ Critical Hit —/.test(hl)?'':'  ← '+((hl.match(/.*Critical Hit.*/)||[''])[0])));
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
