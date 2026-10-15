/* EVERY CAST HOLDS THE GAME FOR ITS ART FLASH (drag-and-stack ruling 20, 2026-10-14).
 *
 * Aj, asked how long a cast should stay in the visualizer: *"as long as the art flash should be good"*; asked
 * whether your own casts and other humans' casts should hold the game for it too (only an AI's did, through
 * `revealDwell`): *"yes"*. So a cast starts a hold as long as its art flash, and while it runs this seat's board
 * refuses plays, casts and passes, says why, and a Respond? box waits for it to end.
 *
 * Every claim is a pair:
 *   A  CONTROL — with no cast, the same board goes live at once (or nothing below measures the hold).
 *   B  YOUR OWN CAST holds your board: Fight off, the hint names the card, a Fight click does nothing, and the
 *      board comes back on its own after about the flash's 2.5s.
 *   C  THE HOLD IS THE FLASH'S LENGTH, not a constant: under reduced motion the flash is 0.9s and so is the hold.
 *   D  A RESPOND? BOX WAITS FOR IT: in ON your own cast offers you a Quick, and the box opens only once the flash
 *      has run, where it used to open on top of it.
 * The netplay half (a guest's own cast holds the guest) is `nettest_stackfly` leg C.
 *
 * Run: node castholdtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;}; const errs=[];
  const open=async(q)=>{ const p=await (await b.newContext({viewport:{width:1280,height:800}})).newPage(); p.on('pageerror',e=>errs.push(e.message));
    await p.goto(URL+(q||'')); await wait(700);
    await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
    await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1600);
    return p; };
  /* A board where nobody else can answer: the Rival holds two plain cards and no energy. ABSOLUTE values, and the
     hold of any earlier cast waited out first. `quick` adds Leyline Ascension (♦9, untargeted) and the energy for it. */
  const stage=async(p, quick)=>{ for(let i=0;i<60 && await p.evaluate(()=>window.__solo.castHold()); i++) await wait(100);
    await p.evaluate((quick)=>{ const st=window.__solo.st(), mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.stack=[]; st.respondFor=null; st.pending=null; st.round=4; st.turn=0; st.subPhase='main'; st.pile=null; st.lastPlayer=null; st.passes=0;
      st.resolution=null; st.cleanup=null; st.endCleanup=null; st.upkeep=null;
      st.players[1].hand=[mk(3,'S','r3S'),mk(6,'H','r6H')]; st.players[1].energy=[];
      st.players[0].hand=[mk(3,'C','bt3C'),mk(9,'H','x9H')].concat(quick?[mk(9,'D','ley9D')]:[]);
      st.players[0].energy=[3,4,5,6,7,8].map(n=>mk(n,'C','e'+n)).concat(quick?[1,2,3,4,5,6,7,8,9,10].map(n=>mk(n,'D','d'+n)):[]);
      st.players[0].nextPlayBoost=0; window.__solo.render(); }, !!quick);
    await wait(400); };
  /* Measured INSIDE the page, from the click, so the round trip is not in the number. */
  const castAndWatch=(p, opts)=>p.evaluate(async(opts)=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms));
    const sel=id=>{ const g=[...document.querySelectorAll('#hand .group')].filter(el=>el.querySelector('.card[data-id="'+id+'"]'))[0]; if(g) g.click(); return !!g; };
    const fight=()=>document.getElementById('fightBtn'), boxUp=()=>[...document.querySelectorAll('.respQuick')].some(x=>x.offsetParent!==null);
    const t0=performance.now(); let castAt=null;
    if(opts.cast){ sel('bt3C'); await sleep(250); const cb=document.getElementById('ctxBtn'); if(!cb || cb.disabled) return { err:'⚡ not offered' }; castAt=performance.now(); cb.click(); await sleep(120); }
    const during={ hold:window.__solo.castHold(), hint:(document.getElementById('hint').textContent||'').trim(), boost:window.__solo.st().players[0].nextPlayBoost||0, box:boxUp(),
                   onStack:(window.__solo.st().stack||[]).some(o=>o.card && o.card.id==='bt3C') };
    if(opts.box){ let at=null; for(let i=0;i<300;i++){ if(boxUp()){ at=performance.now(); break; } await sleep(20); }
      const r={ during, boxAfter: at==null?null:Math.round(at-castAt) }; const d=document.getElementById('respDecline'); if(d && d.offsetParent!==null) d.click(); return r; }
    sel('x9H'); await sleep(150);
    during.fightOn=!fight().disabled; fight().click(); await sleep(200);
    during.pile=window.__solo.st().pile ? window.__solo.st().pile.combo.cards.length : 0;
    let at=null; for(let i=0;i<300;i++){ if(!fight().disabled){ at=performance.now(); break; } await sleep(20); }
    const liveAfter = at==null ? null : Math.round(at-(castAt||t0));
    fight().click(); await sleep(300);
    return { during, liveAfter, played:(window.__solo.st().pile && window.__solo.st().pile.combo.cards[0].id)||null }; }, opts);

  const p=await open();
  // A · CONTROL
  await stage(p);
  const a=await castAndWatch(p, {cast:false});
  ok(a.during.hold===0 && a.during.fightOn && a.during.pile===1,
     'A · CONTROL: with no cast the board is live at once — the very same Fight click plays the 9  ['+JSON.stringify(a.during)+']');
  // B · YOUR OWN CAST
  await stage(p);
  const bb=await castAndWatch(p, {cast:true});
  ok(!bb.err && bb.during.boost>0, 'B · STAGED: Brilliant Tactic was cast and banked its boost  ['+JSON.stringify(bb.during)+']');
  ok(bb.during.hold>0 && /Brilliant Tactic is being cast/.test(bb.during.hint) && !bb.during.fightOn,
     'B · YOUR CAST HOLDS YOUR BOARD — Fight is off and the hint names the card  ["'+bb.during.hint+'"]');
  ok(bb.during.pile===0, '  …and a Fight click during it does nothing (pile '+bb.during.pile+')');
  ok(bb.liveAfter!=null && bb.liveAfter>=2300 && bb.liveAfter<=3400 && bb.played==='x9H',
     '  …and the board comes back on its own after the flash, and the 9 plays  [live after '+bb.liveAfter+'ms, played '+bb.played+']');
  await p.close();

  // C · THE HOLD IS THE FLASH'S LENGTH
  const pr=await open(); await pr.emulateMedia({reducedMotion:'reduce'});
  await stage(pr);
  const c=await castAndWatch(pr, {cast:true});
  ok(!c.err && c.during.hold>0 && c.liveAfter!=null && c.liveAfter>=700 && c.liveAfter<=1700,
     'C · UNDER REDUCED MOTION THE FLASH IS 0.9s AND SO IS THE HOLD — it is the flash\'s length, not a constant  [live after '+c.liveAfter+'ms]');
  await pr.close();

  // D · A RESPOND? BOX WAITS FOR IT (ON: your own cast offers you Leyline)
  const po=await open('&prompts=all');
  await stage(po, true);
  const d=await castAndWatch(po, {cast:true, box:true});
  ok(!d.err && d.during.onStack && d.during.hold>0 && !d.during.box, 'D · STAGED: cast in ON, it waits on the stack for your answer, and no box is up while the flash runs  ['+JSON.stringify(d.during)+']');
  ok(d.boxAfter!=null && d.boxAfter>=2300, 'D · THE RESPOND? BOX OPENS ONLY ONCE THE FLASH HAS RUN  [after '+d.boxAfter+'ms]');
  await po.close();

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
