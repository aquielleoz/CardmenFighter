/* A GUEST ANSWERS FROM THE BOARD (drag-and-stack step 4, piece 2), over a real netplay duel.
 *
 * The box's Yes closes it and leaves the window the guest's; the board's Pass then declines priority, which on a guest
 * must travel as `{op:'decline'}` — never `{op:'pass'}`, the round pass it used to send. And a guest that presses Yes
 * and walks away must not hang the table: `netwindows` passes that window too after its grace.
 * Staged as `nettest_stackfly` B: the host casts a Technique, the guest holds Leyline, prompts are ON on both seats.
 *   A  the guest presses Yes, its board answers (Pass named for the moment), Pass sends a DECLINE, the window closes,
 *      and the host's Technique resolves
 *   B  the guest presses Yes and does nothing: netwindows declines it from the board after its grace
 *   C  (piece 5) the guest presses Yes, taps Leyline and presses ⚡: it travels as `{op:'respond'}` — never Main's
 *      `{op:'activate'}`, which the host would refuse off-turn — and the host narrates the answer
 *   D  (piece 7) the guest counters from its board: ⚡ opens the stack pick, its one target pre-chosen, and the second
 *      ⚡ sends `{op:'respond'}` WITH that object's oid — the host's own id, unrotated — so the host counters it
 *
 * Run: node nettest_answer.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { clickDecline } = require('./fightclick');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8487),ROOM='AN'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1&prompts=all`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=100,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
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
  await until(()=>host.evaluate(()=>!/show/.test((document.getElementById('roundfx')||{}).className||'')), 80);
  const stage=()=>host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(3,'C','hb'),C(6,'H','h'),C(9,'S','h')], [C(9,'D','cq'),C(7,'S','c')]], [E('C','he'), E('D','ce')], null, {round:3, turn:0}); });
  const cast=async(id)=>{ await host.evaluate(id=>{ const c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c) (c.closest('.group')||c).click(); }, id);
    await wait(250); await host.evaluate(()=>{ const x=document.getElementById('ctxBtn'); if(x && !x.disabled) x.click(); }); };
  /* the go-round for the host's cast starts at the host (ruling: the controller first); in ON its own box opens —
     decline it, then the guest is offered Leyline */
  const toGuestBox=async()=>{ for(let i=0;i<120;i++){ await clickDecline(host);
      if(await join.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); })) return true; await wait(150); } return false; };
  const trace=()=>host.evaluate(()=>(window.__cmfTrace?window.__cmfTrace():[]).join('\n'));

  // ================= A: Yes, then Pass from the board =================
  await stage(); await wait(600);
  await cast('hb3C');
  ok(await toGuestBox(), 'STAGED: the guest is offered the window, with Yes in its box');
  await join.evaluate(()=>document.getElementById('respYes').click()); await wait(300);
  const jb=await join.evaluate(()=>{ const pb=document.getElementById('passBtn'), r=document.getElementById('respondBtn');
    return { box:document.getElementById('overlay').classList.contains('show'), answering:window.__cmf.answering(), pass:(pb.textContent||'').trim(), passOn:!pb.disabled, respond:!!(r&&r.offsetParent) }; });
  ok(!jb.box && jb.answering && jb.passOn && jb.pass==='Let it resolve' && jb.respond, 'A: YES CLOSES THE GUEST\'S BOX AND ITS BOARD ANSWERS — Pass named for the moment, Respond? offered  ['+JSON.stringify(jb)+']');
  const before=(await trace()).split('\n').length;
  await join.evaluate(()=>document.getElementById('passBtn').click());
  const closed=await until(()=>host.evaluate(()=>window.__cmf.pending()===false || window.__cmf.pending()==null), 60);
  const sent=(await trace()).split('\n').slice(before-1).join('\n');
  ok(/op=decline/.test(sent) && !/op=pass\b/.test(sent), 'A: THE GUEST\'S PASS TRAVELS AS A DECLINE, not a round pass  ['+((sent.match(/move IN[^\n]*/g)||[]).join(' | ')||'nothing')+']');
  ok(closed, '  …and the window closes on the host, so its Technique resolves');
  ok(await join.evaluate(()=>!window.__cmf.answering()), '  …and the guest is no longer answering');

  // ================= B: Yes, then nothing — netwindows must not let the table hang =================
  await wait(2800);
  await stage(); await wait(600);
  await cast('hb3C');
  ok(await toGuestBox(), 'STAGED: the window is the guest\'s again');
  const n0=await join.evaluate(()=>window.__nw ? window.__nw.n : null);
  await join.evaluate(()=>document.getElementById('respYes').click());
  const passedB=await until(async()=>(await join.evaluate(()=>window.__nw ? window.__nw.n : null))>n0, 120);
  const lastB=await join.evaluate(()=>window.__nw ? window.__nw.last : null);
  ok(passedB && lastB==='answer-from-the-board', 'B: A GUEST THAT PRESSES YES AND WALKS AWAY IS PASSED FROM THE BOARD after netwindows\' grace  ['+JSON.stringify({passed:passedB, last:lastB})+']');
  ok(await until(()=>host.evaluate(()=>!window.__cmf.pending()), 60), '  …and the host\'s window closes, so the table moves on');

  // ================= C: Yes, then CAST from the board =================
  await wait(2800);
  await stage(); await wait(600);
  await cast('hb3C');
  ok(await toGuestBox(), 'STAGED: the window is the guest\'s again');
  await join.evaluate(()=>document.getElementById('respYes').click()); await wait(300);
  await join.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="cq9D"]'))[0]; if(g) g.click(); }); await wait(300);
  const jc=await join.evaluate(()=>{ const c=document.getElementById('ctxBtn'); return { ctx:(c.textContent||'').trim(), off:c.classList.contains('off'), shown:!!c.offsetParent }; });
  const beforeC=(await trace()).split('\n').length;
  await join.evaluate(()=>document.getElementById('ctxBtn').click());
  const castC=await until(()=>host.evaluate(()=>/answered[^\n]*Leyline/.test([...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'))), 80);
  const sentC=(await trace()).split('\n').slice(beforeC-1).join('\n');
  ok(jc.shown && jc.ctx==='⚡ Activate' && !jc.off && /op=respond/.test(sentC) && !/op=activate/.test(sentC),
     'C: THE GUEST CASTS LEYLINE FROM ITS BOARD and it travels as a RESPOND, not Main\'s activate  ['+JSON.stringify(jc)+' '+((sentC.match(/move IN[^\n]*/g)||[]).join(' | ')||'nothing sent')+']');
  ok(castC && await until(()=>join.evaluate(()=>window.__cmf.hand().indexOf('cq9D')<0), 40), '  …and the host narrates the answer, and the card leaves the guest\'s hand');

  // ================= D: Yes, then COUNTER from the board, picking the target on the stack =================
  await until(()=>host.evaluate(()=>!window.__cmf.pending()), 60); await wait(2800);
  await host.evaluate(()=>{ const C=(n,su,t)=>({rank:n,suit:su,id:(t||'')+n+su}); const E=(s,t)=>[1,2,3,4,5,6,7,8,9,10,11,12].map(n=>C(n,s,t));
    window.__cmf.forceAll([[C(3,'C','hb'),C(6,'H','h'),C(9,'S','h')], [C(4,'D','cs'),C(7,'S','c')]], [E('C','he'), E('D','ce')], null, {round:3, turn:0}); });
  await wait(600);
  await cast('hb3C');
  ok(await toGuestBox(), 'STAGED: the guest holds Counter Spell and the window is its own');
  await join.evaluate(()=>document.getElementById('respYes').click()); await wait(300);
  await join.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="cs4D"]'))[0]; if(g) g.click(); }); await wait(300);
  await join.evaluate(()=>document.getElementById('ctxBtn').click()); await wait(400);
  const jd=await join.evaluate(()=>({ aimed:[...document.querySelectorAll('#stackView .stkCard.aimed')].map(b=>b.getAttribute('data-oid')), ctx:(document.getElementById('ctxBtn').textContent||'').trim(), inHand:window.__cmf.hand().indexOf('cs4D')>=0 }));
  const beforeD=(await trace()).split('\n').length;
  await join.evaluate(()=>document.getElementById('ctxBtn').click());
  const castD=await until(()=>host.evaluate(()=>/countered with Counter Spell/.test([...document.querySelectorAll('#log .le')].map(e=>e.textContent).join('\n'))), 80);
  const sentD=(await trace()).split('\n').slice(beforeD-1).join('\n');
  ok(jd.aimed.length===1 && jd.ctx==='⚡ Activate' && jd.inHand, 'D: THE GUEST\'S ⚡ OPENS THE STACK PICK, its one target pre-chosen, and nothing is sent yet  ['+JSON.stringify(jd)+']');
  const jTrace=await join.evaluate(()=>(window.__cmfTrace?window.__cmfTrace():[]).join('\n'));
  const sentCoid=((jTrace.match(/clientSend[^\n]*respond[^\n]*/g)||[]).pop()||'');
  ok(castD && /op=respond/.test(sentD) && jd.aimed[0] && sentCoid.indexOf('coid='+jd.aimed[0])>=0,
     '  …and the second ⚡ sends the answer WITH the aimed oid, which the host applies as a COUNTER  ['+((sentD.match(/move IN[^\n]*/g)||[]).join(' | ')||'nothing sent')+' · guest sent: '+sentCoid.slice(-60)+']');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
