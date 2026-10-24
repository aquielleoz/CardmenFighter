/* THE VALUE MODIFIERS, AS THE BOARD SHOWS THEM (v1.36.7).
 *
 * Aj, 2026-10-23, from a 6-player game: *"i can't see what debuffs affect the current in play, and i think it's ok to
 * merge the 2 -2s into a -4 here"*. Two readouts, two fixes:
 *   A  the chips under your bar: with modifiers of BOTH signs they drew one chip per source ("+1 Giant Boar · −2 Cursed
 *      Pendant · −2 Caltrops"). Now one chip per direction, each netted with its sources.
 *   B  the caption over the play in the middle shows its total, and at 0 it showed nothing — so Adell's Full House,
 *      +3 (Imbue with Power under Hector) +1 (Giant Swan) −2 −2, read like a play nothing touches. Aj chose "±0".
 * Every claim is a pair off one board: the control (one sign; a pile nothing touches) and the case.
 *
 * Run: node modtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));

(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1300,height:900}})).newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await wait(700);
  await p.evaluate(()=>document.getElementById('newBtn').click()); await wait(350);
  await p.evaluate(()=>document.getElementById('goFirstBtn').click()); await wait(1500);

  /* One board: your turn, a quiet hand, and whatever Forms and Equipment the case names. `rivalPile` has the Rival play a
     9♣ first, through the engine, so the pile is built (and its modifiers locked) the way a real play builds it. */
  async function stage(o){
    await p.evaluate(o=>{ const st=window.__solo.st(), E=window.CardmenEngine, mk=(r,s,id)=>({rank:r,suit:s,id:id});
      st.stack=[]; st.respondFor=null; st.pending=null; st.round=5; st.subPhase='main'; st.pile=null; st.lastPlayer=null; st.passes=0;
      st.players[0].hand=[mk(4,'C','h4'),mk(6,'S','h6'),mk(12,'S','hQ')]; st.players[0].forms=[]; st.players[1].forms=[];
      st.players[0].equipment=[]; st.players[1].equipment=[]; st.players[0].nextPlayBoost=0; st.players[1].nextPlayBoost=0;
      const eq=(owner,id,nm,r,s,d,od)=>st.players[owner].equipment.push({ id:id, name:nm, delta:d||0, oppDelta:od||0, counters:3, card:mk(r,s,'c'+id) });
      (o.eq||[]).forEach(e=>eq.apply(null,e));
      if(o.boar) st.players[0].forms.push({ rank:11, suit:'C', tier:'ride', name:'Giant Boar', card:mk(11,'C','fJC') });
      if(o.swan) st.players[1].forms.push({ rank:11, suit:'H', tier:'ride', name:'Giant Swan', card:mk(11,'H','fJH') });
      if(o.rivalPile){ st.turn=1; st.players[1].nextPlayBoost=o.charge||0; st.players[1].hand=[mk(9,'C','r9'),mk(3,'D','r3')];
        E.play(st, 1, [st.players[1].hand[0]]); }
      st.turn=0; window.__solo.render(); }, o);
    await wait(350);
  }
  const chips=()=>p.evaluate(()=>[...document.querySelectorAll('#playMods .pmod')].map(e=>e.textContent.replace(/\s+/g,' ').trim()));
  const caption=()=>p.evaluate(()=>(document.getElementById('pileLabel').textContent||'').trim());

  // A — the chips. Control: every modifier points one way, which always netted into one chip.
  const PENDANT=[1,'cp','Cursed Pendant',8,'D',0,-2], CALTROPS=[1,'ct','Caltrops',7,'S',0,-2];
  await stage({ eq:[PENDANT, CALTROPS] });
  let c=await chips();
  ok(c.length===1 && /−4/.test(c[0]) && /Cursed Pendant, Caltrops/.test(c[0]), 'A · CONTROL: two −2s alone net into one chip, "−4 from Cursed Pendant, Caltrops"  '+JSON.stringify(c));
  await stage({ eq:[PENDANT, CALTROPS], boar:true });
  c=await chips();
  ok(c.length===2, 'A · Giant Boar\'s +1 beside them: one chip per DIRECTION, not one per source  '+JSON.stringify(c)+(c.length===3?'  ← REPRODUCED: +1 · −2 · −2':''));
  ok(c.some(t=>/\+1/.test(t) && /Giant Boar/.test(t)) && c.some(t=>/−4/.test(t) && /Cursed Pendant, Caltrops/.test(t)), '  …"+1 from Giant Boar" and "−4 from Cursed Pendant, Caltrops"');

  // B — the caption over the play in the middle
  await stage({ rivalPile:true });
  let cap=await caption();
  ok(!/modified|reduced|boosted/i.test(cap), 'B · CONTROL: a play nothing touches has no modifier on its caption  "'+cap+'"');
  await stage({ rivalPile:true, charge:3, swan:true, eq:[[0,'cp','Cursed Pendant',8,'D',0,-2],[0,'ct','Caltrops',7,'S',0,-2]] });
  cap=await caption();
  const mod=await p.evaluate(()=>window.__solo.st().pile.mod);
  ok(mod===0, '(staging: Aj\'s round-18 board — +3 charge, +1 Giant Swan, −2 Cursed Pendant, −2 Caltrops — nets to '+mod+')');
  ok(/modified ±0/i.test(cap), 'B · when they cancel, the caption still says the play is modified: "'+cap+'"'+(/modified/i.test(cap)?'':'  ← REPRODUCED: reads like a play nothing touches'));
  await stage({ rivalPile:true, swan:true, eq:[[0,'ct','Caltrops',7,'S',0,-2]] });
  cap=await caption();
  ok(/reduced −1|reduced -1/i.test(cap) && !/modified/i.test(cap), 'B · a nonzero total still reads as before: "'+cap+'"');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
