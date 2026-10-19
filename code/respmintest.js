/* THE RESPOND? BOX MINIMIZES WHERE IT SITS AT THE TOP (drag-and-stack step 5, ruling 34).
 *
 * On a phone there is no card reader for the small box to sit over (ruling 32), so it takes the top of the screen and
 * covers the Rival's bar; on a 667x375 landscape table it covers the pile and the stack as well. Aj: *"keep it at the
 * top, this will have a minimize/peek right?"*, then *"Add a minimize"*. ▾ shrinks the box to its title, a thin tab;
 * tapping the tab opens it again; the board stays held until Yes or No.
 * Staged as answertest is: in ON your own cast offers you Leyline, so the box opens for YOU on demand.
 *   A  portrait phone 360x740: the box is at the top, covers the Rival's bar, and shows ▾
 *   B  ▾ shrinks it to a tab (its title, ≤40px) that covers none of the Rival's bar; Yes and No are hidden
 *   C  …and the board is still held: Pass, under the tab's backdrop, is not what a tap there reaches
 *   D  tapping the tab opens the box again — Yes and No back — and No still closes the window
 *   E  landscape 667x375: the box covers the pile and the stack; minimized, it covers neither
 *   F  CONTROL, desktop 1280x800: the box sits over the reader, and there is no ▾ to press
 *
 * Run: node respmintest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1&prompts=all';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;}; const errs=[];
  async function openBox(w,h){
    const p=await (await b.newContext({viewport:{width:w,height:h}})).newPage(); p.on('pageerror',e=>errs.push(w+'x'+h+': '+e.message));
    await p.goto(URL); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1800);
    for(let i=0;i<60 && await p.evaluate(()=>!!(document.getElementById('roundfx')||{classList:{contains:()=>false}}).classList.contains('show')); i++) await wait(100);
    await p.evaluate(()=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.stack=[]; st.respondFor=null; st.pending=null; st.round=4; st.turn=0; st.subPhase='main'; st.lastPlayer=null; st.passes=0;
      st.resolution=null; st.cleanup=null; st.endCleanup=null; st.upkeep=null;
      st.pile={ combo:{type:'fullhouse', value:9, size:5, key:[9], cards:[mk(9,'C','p1'),mk(9,'H','p2'),mk(9,'S','p3'),mk(3,'D','p4'),mk(3,'H','p5')] }, byPlayer:1, owner:1 };
      st.players[1].hand=[mk(3,'S','r3S'),mk(6,'H','r6H')]; st.players[1].energy=[];
      st.players[0].hand=[mk(3,'C','bt3C'),mk(9,'H','x9H'),mk(9,'D','ley9D')];
      st.players[0].energy=[3,4,5,6,7,8].map(n=>mk(n,'C','e'+n)).concat([1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','d'+n)));
      window.__solo.render(); });
    await wait(400);
    await p.evaluate(()=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="bt3C"]'))[0]; if(g) g.click(); }); await wait(250);
    await p.evaluate(()=>document.getElementById('ctxBtn').click());
    let up=false; for(let i=0;i<80 && !(up=await p.evaluate(()=>{ const y=document.getElementById('respYes'); return !!(y && y.offsetParent); })); i++) await wait(100);
    return { p, up };
  }
  const R=`const R=el=>{ if(!el||el.offsetParent===null) return null; const r=el.getBoundingClientRect(); return (r.width>1&&r.height>1)?r:null; };
           const cov=(a,b)=>(!a||!b)?0:Math.max(0,Math.min(a.right,b.right)-Math.max(a.left,b.left))*Math.max(0,Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top))/(b.width*b.height);`;
  const look=p=>p.evaluate(new Function(R+`
    const m=document.getElementById('modal'), mr=R(m), y=document.getElementById('respYes'), n=document.getElementById('respDecline'), mn=document.getElementById('respMin');
    const pile=[...document.querySelectorAll('#pile .card')].map(R).filter(Boolean), stk=[...document.querySelectorAll('#stackView .stkCard .card')].map(R).filter(Boolean);
    const pass=document.getElementById('passBtn'), pr=R(pass), hit=pr?document.elementFromPoint(pr.left+pr.width/2, pr.top+pr.height/2):null;
    return { up:document.getElementById('overlay').classList.contains('show'), atTop:m.classList.contains('atTop'), min:m.classList.contains('respMinimized'),
      h:mr?Math.round(mr.height):0, minBtn:!!(mn && mn.offsetParent), yes:!!(y && y.offsetParent), no:!!(n && n.offsetParent),
      rival:Math.round(100*cov(mr, R(document.getElementById('rival')))),
      pile:Math.round(100*Math.max(0,...pile.map(c=>cov(mr,c)))), stack:Math.round(100*Math.max(0,...stk.map(c=>cov(mr,c)))), stackN:stk.length,
      passReached:!!(hit && pass.contains(hit)) };`));

  // A-D: portrait phone
  { const { p, up }=await openBox(360,740);
    const a=await look(p);
    ok(up && a.atTop && a.rival>=50 && a.minBtn, 'A · PORTRAIT 360x740: the box sits at the top, over the Rival\'s bar, and shows ▾  '+JSON.stringify(a));
    await p.evaluate(()=>document.getElementById('respMin').click()); await wait(250);
    const m=await look(p);
    ok(m.min && m.h<=40 && m.rival===0 && !m.yes && !m.no, 'B · ▾ SHRINKS IT TO A TAB: '+m.h+'px tall, covering '+m.rival+'% of the Rival\'s bar, Yes and No hidden  '+JSON.stringify(m));
    ok(m.up && !m.passReached, 'C · …and the board is still HELD: the backdrop is up, and a tap on Pass does not reach it');
    await p.evaluate(()=>document.getElementById('respHead').click()); await wait(250);
    const r=await look(p);
    ok(!r.min && r.yes && r.no && r.h>m.h, 'D · tapping the tab OPENS IT AGAIN, Yes and No back ('+r.h+'px)');
    await p.evaluate(()=>document.getElementById('respDecline').click());
    let closed=false; for(let i=0;i<40 && !(closed=await p.evaluate(()=>!document.getElementById('overlay').classList.contains('show'))); i++) await wait(100);
    ok(closed, '  …and No still answers the window after a minimize — the box closes');
    await p.context().close(); }

  // E: the short landscape table
  { const { p, up }=await openBox(667,375);
    const a=await look(p);
    ok(up && a.atTop && a.minBtn && (a.pile>0 || a.stack>0), 'E · LANDSCAPE 667x375: the box covers the pile or the stack ('+a.pile+'% / '+a.stack+'%) and shows ▾');
    await p.evaluate(()=>document.getElementById('respMin').click()); await wait(250);
    const m=await look(p);
    ok(m.min && m.pile===0 && m.stack===0 && m.stackN>0, '  …minimized, it covers neither (pile '+m.pile+'%, stack '+m.stack+'%, '+m.stackN+' stack card(s) drawn)');
    await p.context().close(); }

  // F: control
  { const { p, up }=await openBox(1280,800);
    const a=await look(p);
    ok(up && !a.atTop && !a.minBtn && a.yes, 'F · CONTROL 1280x800: the box sits over the reader and there is NO ▾ to press  '+JSON.stringify({atTop:a.atTop, minBtn:a.minBtn}));
    await p.context().close(); }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
