/* HOST AND CLIENT MUST SHOW THE SAME CEREMONY (client-ceremony-is-a-second-impl).
 *
 * Aj, 2026-09-29: *"why do we keep getting this unsync between host and client?"* The host's round ceremony
 * (`resolveRoundCeremony`) and the client's (`clientPlayCeremony`) were two hand-written presentations of one
 * event, so anything added to one was invisible on the other until a human played that seat. `nettest_sync`
 * compares STATE, and state is not what drifts here — what each screen RENDERS is. This is that instrument.
 *
 * Both pages FILM their presentation through a real duel, as tokens, in seat-neutral terms:
 *   SP:<phase>        the phase strip changing (spMain, spFight, spResolve, spCleanup, spBegin, spIdle)
 *   RF:beat / RF:round<N>   a round-ceremony beat, and the "Round N" card
 *   TH:<word>         a transform-tier banner (ROAR, OVERDRIVE…)
 *   KICK              the Fighter Kick
 *   MILL:<host|client> a deck-mill float, named by WHOSE deck it is, not which panel it sits on
 *   SHATTER:<host|client> a shield shattering, likewise
 * Then each round's ceremony — from the Resolution tint to the next Round card — must be the SAME SEQUENCE
 * on both seats. Phases during ordinary play are filtered out (a client legitimately sees fewer intermediate
 * states, because mirrors coalesce); the CEREMONY is the thing that was forked, so the ceremony is compared.
 *
 * AND TWO CLAIMS THE FIX RESTS ON: neither seat's controls go LIVE inside its own ceremony (Resolution tint to
 * its Round card), and the host never has to REFUSE a current client's board op as "mid-ceremony" — the
 * client's hold releases on the host's own `cer:false`, so it is causally later than the host's.
 *
 * Run: node nettest_parity.js       (ROUNDS=n to play longer; PARITY_DUMP=1 to print every ceremony) */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const { installPageHelpers, FIGHT_BUDGET } = require('./fightclick');
const autoAnswerWindows=require('./netwindows.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8471),STAMP=Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=(r,room)=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${room}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ROUNDS=+(process.env.ROUNDS||7);

/* The film. `me` is this page's own seat name in the neutral vocabulary, so a token about "my deck" on the
   host and "their deck" on the client both come out as MILL:host. */
function installFilm(me, them){
  window.__film=[];
  const push=t=>{ window.__film.push({t:t, at:Date.now()}); };
  const hw=document.getElementById('handWrap'); let lastSp=null;
  new MutationObserver(()=>{ const m=(hw.className.match(/\bsp[A-Z][a-zA-Z]*/)||[])[0]||null; if(m!==lastSp){ lastSp=m; if(m) push('SP:'+m); } })
    .observe(hw,{attributes:true, attributeFilter:['class']});
  const rf=document.getElementById('roundfx'), inner=rf.querySelector('.rfInner'); let lastRf='';
  /* THE WAITING NOTICE IS NOT A CEREMONY BEAT. "Rival 2 is deciding…" / "…is discarding to hand size…" shares
     #roundfx (class `trimwait`) and is READER-RELATIVE by design: it is shown to the seats that wait and never
     to the one deciding. So it is filmed as WAIT and not compared — it is supposed to differ. */
  new MutationObserver(()=>{ if(!/show/.test(rf.className)) { lastRf=''; return; }
      if(/trimwait/.test(rf.className)){ if(lastRf!=='WAIT'){ lastRf='WAIT'; push('WAIT'); } return; }
      const r=inner.querySelector('.rfRound'), b=inner.querySelector('.rfBeat');
      /* KEYED BY THE WHOLE TEXT. The first cut keyed a beat by its text LENGTH, and names are READER-RELATIVE
         ("You" here, "Rival 2" there), so two different beats could tie in length on one seat and not the other
         — one beat vanished on that side, flipping with whose shield broke. A false drift, measured three times. */
      const key = r ? 'RF:round'+(r.textContent||'').replace(/\D/g,'') : (b ? 'RF:beat\u0000'+(b.textContent||'') : '');
      if(key && key!==lastRf){ lastRf=key; push(r ? key : 'RF:beat'); (window.__beatTexts=window.__beatTexts||[]).push((b||r).textContent.trim().slice(0,70)); } })
    .observe(rf,{attributes:true, childList:true, subtree:true, characterData:true});
  const th=document.getElementById('thresholdfx'); let thOn=false;
  new MutationObserver(()=>{ const on=/show/.test(th.className)&&!!th.textContent.trim(); if(on&&!thOn) push('TH:'+(th.querySelector('.thName')||th).textContent.trim().split(/\s+/)[0]); thOn=on; })
    .observe(th,{attributes:true, childList:true, subtree:true});
  /* THE CONTROLS, filmed as LIVE/DEAD edges: "can this seat act right now". A board that goes live under its
     own ceremony is the bug this suite found first; the timestamps are checked against the ceremony windows. */
  const fb=document.getElementById('fightBtn'), pb=document.getElementById('passBtn'); let ctl=null;
  const live=()=>!!((fb && !fb.disabled && fb.offsetParent) || (pb && !pb.disabled && pb.offsetParent));
  const ctlCheck=()=>{ const l=live(); if(l!==ctl){ ctl=l; push(l?'CTRL:live':'CTRL:dead'); } };
  new MutationObserver(ctlCheck).observe(document.getElementById('actions')||document.body,{attributes:true, subtree:true, childList:true});
  setInterval(ctlCheck, 40);                                         // a style flip on a parent is not always an attribute on the button
  const k=document.getElementById('kick'); let kOn=false;
  new MutationObserver(()=>{ const on=/\bshow\b/.test(k.className); if(on&&!kOn) push('KICK'); kOn=on; }).observe(k,{attributes:true});
  new MutationObserver(ms=>{ ms.forEach(m=>m.addedNodes.forEach(n=>{
      if(!n.classList) return;
      if(n.classList.contains('deckLoss')){ const mine=!!(n.parentNode && n.parentNode.querySelector && n.parentNode.querySelector('#youDeck')); push('MILL:'+(mine?me:them)); }
      if(n.classList.contains('shards')){ const mine=!!(n.closest && n.closest('#youShields')); push('SHATTER:'+(mine?me:them)); }
    })); }).observe(document.body,{childList:true, subtree:true});
}
/* WHAT A PLAYER COULD SEE, NOT WHAT A MUTATION OBSERVER SAW. A phase or a banner that is replaced within 60ms
   never reached anybody's eyes, and the two seats produce such flickers DIFFERENTLY BY CONSTRUCTION: the host
   walks a Resolution window that nobody answers inside ONE task (its observer only sees the final class), while
   the client receives each intermediate state as a separate mirror and paints every one. Measured: a 9ms
   Resolution -> Clean-up -> Beginning burst on the client alone, plus 12ms of "Rival 2 is deciding…", right
   before a ceremony that was otherwise identical to the frame. Not a drift; a property of the transport. */
function settled(film){
  return film.filter((f,i)=>{
    const kind=f.t.slice(0,3);
    if(kind!=='SP:' && kind!=='RF:') return true;
    for(let j=i+1;j<film.length;j++){ if(film[j].t.slice(0,3)===kind) return film[j].at-f.at>=60; }
    return true; });
}
/* One ceremony = from a Resolution tint to the Round card that ends it (or to the next Resolution). */
function ceremonies(film){
  film=settled(film);
  const out=[]; let cur=null;
  film.forEach(f=>{
    if(f.t==='SP:spResolve'){ if(cur) out.push(cur); cur=[]; }
    if(!cur) return;
    if(/^SP:sp(Main|Fight|Idle)$/.test(f.t)) return;            // ordinary-play phases: mirrors coalesce, not compared
    if(/^ACT:/.test(f.t)) return;                                 // the DRIVER's own marks: when a press returned, not what the screen showed
    if(/^CTRL:/.test(f.t)) return;                                // checked against the ceremony WINDOWS below, not as a sequence
    if(/^MILL:/.test(f.t)) return;                                // compared as COUNTS per deck owner below: a float lands within ms of a boundary
    if(f.t==='WAIT') return;                                      // the waiting notice is reader-relative by design
    cur.push(f.t.replace(/^SHATTER:(me|other)$/,'SHATTER'));      // at 3+ seats "me"/"other" is each seat's own frame — compare the event
    if(/^RF:round/.test(f.t)){ out.push(cur); cur=null; }
  });
  if(cur && cur.length) out.push(cur);
  /* A REPAINT OF THE SAME PHASE IS NOT AN EVENT — but two beats in a row ARE two events. This collapsed every
     consecutive duplicate, so three beats with nothing between them read as one: on a seat whose shatter had
     fired early the beats were adjacent and merged, which looked exactly like "the client is missing beats". */
  return out.map(c=>c.filter((t,i)=>!(t===c[i-1] && /^SP:/.test(t))));
}

const act=p=>p.evaluate(async ()=>{
  const clear=()=>{ const c=document.getElementById('clearBtn'); if(c&&!c.disabled)c.click(); [].forEach.call(document.querySelectorAll('#hand .group.gsel, #hand .card.sel'),x=>x.click()); };
  if(document.querySelector('#hand > .card')){                       // a clean-up pick: select until Fight confirms
    for(const c of [].slice.call(document.querySelectorAll('#hand > .card'))){ c.click(); const f=document.getElementById('fightBtn'); if(f&&!f.disabled){ f.click(); return 'pick'; } }
    return 'stuck-pick';
  }
  clear();
  /* A PAIR FIRST. A driver that only ever jabs never breaks a shield — only a Special does — so the richest
     ceremony (the shatter beat, the shield line, a transform tier's banner, a kick) was never filmed at all:
     the first green runs had zero shatters on either seat. Card ids lead with the rank (`7D`, `7D#24`). */
  const cards=[].slice.call(document.querySelectorAll('#hand .card')), byRank={};
  cards.forEach(c=>{ const r=(c.getAttribute('data-id')||'').match(/^\d+/); if(r) (byRank[r[0]]=byRank[r[0]]||[]).push(c); });
  /* …BUT ONLY WHEN LEADING, from round 2: a pair answers only a pair, and pressing Fight with one that cannot
     still opens the Main → Fight go-round and then waits the helper's whole budget (15s) for cards that never
     leave the hand. That turned a 3-player table into one round per 150s. Leading, from round 2, a pair is
     always legal. */
  const leading=!document.querySelector('#pile .card'), rnd=parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0;
  if(leading && rnd>=2) for(const r of Object.keys(byRank)){ const g=byRank[r]; if(g.length<2) continue;
    /* SELECTION LIVES ON THE `.group` AS `gsel`, not on the `.card` (a card's click bubbles to its group), so
       count the cards inside selected groups — counting `.card.sel` read 0 and no pair was ever tried. */
    const nSel=()=>document.querySelectorAll('#hand .group.gsel .card, #hand .card.sel').length;
    g[0].click(); if(nSel()<2) g[1].click();                                                // a click may select the whole group
    if(nSel()>=2 && await window.__pressFight()) return 'played pair';
    clear(); }
  for(const c of cards){ c.click(); if(await window.__pressFight()) return 'played'; clear(); }
  if(await window.__pressPass()) return 'passed';
  return 'stuck';
});
const view=p=>p.evaluate(()=>({ round:parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  myTurn:/your turn/.test((document.getElementById('turnTag')||{}).textContent||''), finished:window.__cmf?window.__cmf.finished():null }));

/* THE STATE-BASED CONTROL CHECK. A window runs from a seat's Resolution tint to its next Round card plus most of
   that card's hold (ROUND_HOLD is 1350ms; 1100 leaves the release's own render room). The board must be DEAD for
   all of it.
   STATE, NOT EDGES. The first cut counted only DEAD→LIVE edges inside a window, and main passed it: there the
   client's board went live within milliseconds of the ceremony starting (the very mirror that starts it says
   "your turn") and simply STAYED live, so no edge ever fell inside. +150ms of grace at the start: the press that
   ENDED the round is still settling then, and that is not the ceremony's doing. */
function liveUnder(f){ const bad=[]; bad.windows=0;
  const wins=[]; let open=null;
  f.forEach(x=>{ if(x.t==='SP:spResolve'){ open={from:x.at+150, to:Infinity}; wins.push(open); }
                 else if(open && /^RF:round/.test(x.t) && open.to===Infinity){ open.to=x.at+1100; } });
  wins.forEach(w=>{ if(w.to===Infinity) return; bad.windows++;
    let st=false; f.forEach(x=>{ if(x.at<=w.from && /^CTRL:/.test(x.t)) st=(x.t==='CTRL:live'); });   // the state as the window opens
    if(st){ bad.push(0); return; }
    const e=f.find(x=>x.t==='CTRL:live' && x.at>w.from && x.at<w.to); if(e) bad.push(e.at-w.from+150); });
  return bad; }

async function runTable(b, N, ok, errs){
  const tag=N===2?'duel':N+'p', room='PY'+N+STAMP;
  const ctx=await b.newContext({viewport:{width:1100,height:820}});
  const pages=[];
  for(let i=0;i<N;i++){ const p=await ctx.newPage(); const nm=i===0?'host':'c'+i; p.on('pageerror',e=>errs.push(tag+' '+nm+': '+e.message)); await installPageHelpers(p, FIGHT_BUDGET); pages.push(p); }
  const host=pages[0], clients=pages.slice(1), names=pages.map((p,i)=>i===0?'host':(N===2?'client':'c'+i));
  await host.goto(url('host',room)); for(const c of clients) await c.goto(url('join',room));
  if(N===2){ await startDuel(host, clients[0]); }
  else {
    for(const p of pages) await autoAnswerWindows(p, names[pages.indexOf(p)]);
    for(const c of clients){ for(let i=0;i<60 && !(await c.evaluate(()=>!!document.getElementById('lobbyGo')));i++) await wait(150); await c.evaluate(()=>document.getElementById('lobbyGo').click()); await wait(300); }
    for(let i=0;i<80;i++){ if(await host.evaluate(()=>{ const g=document.getElementById('lobbyGo'); return !!(g && !g.disabled && /Riders/.test(g.textContent||'')); })) break; await wait(150); }
    await host.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g && !g.disabled) g.click(); });
  }
  let started=false; for(let i=0;i<120 && !started;i++){ started=true; for(const p of pages) if((await view(p)).round<1) started=false; if(!started) await wait(150); }
  ok(started, `[${tag}] the game started on every seat`);
  for(let i=0;i<N;i++) await pages[i].evaluate(`(${installFilm})(${JSON.stringify(N===2?names[i]:'me')},${JSON.stringify(N===2?names[1-i]:'other')})`);

  const t0=Date.now(); let idle=0, loopRound=-1, loopActs=0, loopDumped=false;
  while(Date.now()-t0<150000){
    const vs=[]; for(const p of pages) vs.push(await view(p));
    if(vs.some(v=>v.finished) || Math.min(...vs.map(v=>v.round))>ROUNDS){
      console.log(`   ⓘ [${tag}] drive ended: `+(vs.some(v=>v.finished)?'a seat reports the game FINISHED':'played past round '+ROUNDS)+'  rounds '+vs.map(v=>v.round).join('/')+' after '+Math.round((Date.now()-t0)/1000)+'s');
      break; }
    let did=null;
    /* A ROUND WINNER CHOOSING WHO LOSES THE SHIELD IS NOT "your turn" — at 3+ players under the default
       `chosen` loss mode the winner taps a rival and confirms. Answered on whichever seat is asked, first. */
    for(let i=0;i<N && !did;i++){ const t=await pages[i].evaluate(()=>{ const el=document.querySelector('.oppPanel.targetable'), f=document.getElementById('fightBtn');
        if(!el) return null; if(!document.querySelector('.oppPanel.aimed')){ el.click(); return 'aimed'; }
        if(f && /Confirm/.test(f.textContent) && !f.disabled){ f.click(); return 'confirmed a strike'; } return null; });
      if(t) did=t; }
    /* A CLEAN-UP PICK IS NOT "your turn" EITHER: the host's end-of-round trim hands a remote seat over the
       hand limit the real picker (`● choose cards`), and the table waits on it. `act` answers a pick first. */
    for(let i=0;i<N && !did;i++) if(await pages[i].evaluate(()=>!!document.querySelector('#hand > .card'))){ const t=await act(pages[i]); if(t && !/stuck/.test(t)) did=t; }
    for(let i=0;i<N && !did;i++) if(vs[i].myTurn){ did=await act(pages[i]); if(did && !/stuck/.test(did)) await pages[i].evaluate(d=>window.__film.push({t:'ACT:'+d, at:Date.now()}), did); }
    if(did && !/stuck/.test(did)) idle=0; else idle++;
    /* A LOOP DESCRIBES ITSELF TOO. Twice in nine duel runs the host's driver logged 300+ "successful" presses
       while the round stood still and the client acted five times — the stall detector above cannot see it,
       because something IS acting. Once per table, on the 40th press in a round that has not moved: dump the
       acting seat's board, its last log lines and refusals, and the host's trace and ledger tails. */
    { const rr=Math.min(...vs.map(v=>v.round)); if(rr!==loopRound){ loopRound=rr; loopActs=0; } else if(did && !/stuck/.test(did)) loopActs++;
      if(loopActs===40 && !loopDumped){ loopDumped=true; console.log(`   ⚠ [${tag}] 40 presses in round ${rr} and it has not moved — last: "${did}"`);
        for(let i=0;i<N;i++) console.log('     '+names[i].padEnd(6)+' '+JSON.stringify(await pages[i].evaluate(()=>({
          turn:window.__cmf?window.__cmf.turn():null, turnTag:((document.getElementById('turnTag')||{}).textContent||'').trim().slice(0,40),
          msg:((document.getElementById('message')||{}).textContent||'').trim().slice(0,90), hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,70),
          fight:(()=>{const f=document.getElementById('fightBtn'); return f?(f.textContent+(f.disabled?' (off)':' (on)')):null;})(),
          pass:(()=>{const f=document.getElementById('passBtn'); return f?(f.disabled?'off':'on'):null;})(),
          pile:[...document.querySelectorAll('#pile .card')].map(c=>c.getAttribute('data-id')).join(' '), hand:document.querySelectorAll('#hand .card').length,
          hold:window.__cmf&&window.__cmf.ceremonyHold?window.__cmf.ceremonyHold():null, flags:window.__cmf&&window.__cmf.roundFlags?window.__cmf.roundFlags():null, log:[...document.querySelectorAll('#log > *')].slice(-6).map(e=>(e.textContent||'').trim().slice(0,90)) }))));
        console.log('     host trace tail: '+JSON.stringify([].concat(await host.evaluate(()=>window.__cmf.trace())).slice(-10)));
        console.log('     host ledger tail: '+JSON.stringify([].concat(await host.evaluate(()=>window.__cmf.prioLog?window.__cmf.prioLog():[])).slice(-8))); } }
    if(idle>120){ console.log(`   ⚠ [${tag}] no seat could act for ~30s — stopping the drive here`);
      /* A STALL DESCRIBES ITSELF: every seat's turn, status, hint and any open window, plus the host's trace tail
         — "the drive stopped" alone cannot tell a driver that met a state it does not play from a wedged table. */
      for(let i=0;i<N;i++) console.log('     '+names[i].padEnd(6)+' '+JSON.stringify(await pages[i].evaluate(()=>({
        turn:window.__cmf?window.__cmf.turn():null, turnTag:((document.getElementById('turnTag')||{}).textContent||'').trim().slice(0,40),
        status:((document.getElementById('rivalStatus')||{}).textContent||'').trim().slice(0,40), hint:((document.getElementById('hint')||{}).textContent||'').trim().slice(0,60),
        overlay:!!(document.getElementById('overlay')&&document.getElementById('overlay').classList.contains('show')),
        btns:[...document.querySelectorAll('#modal button')].filter(b=>b.offsetParent).map(b=>b.id||b.textContent.trim().slice(0,14)),
        fight:(()=>{const f=document.getElementById('fightBtn'); return f?(f.textContent+(f.disabled?' (off)':' (on)')):null;})(),
        pickMode:!!document.querySelector('#hand > .card'), hold:window.__cmf&&window.__cmf.ceremonyHold?window.__cmf.ceremonyHold():null }))));
      const tr=await host.evaluate(()=>window.__cmf.trace()); console.log('     host trace tail: '+JSON.stringify([].concat(tr).slice(-8)));
      break; }
    await wait(250);
  }
  if(Date.now()-t0>=150000) console.log(`   ⓘ [${tag}] drive ended on the 150s WALL CLOCK`);
  await wait(4500);                                                   // let the last ceremony finish on every seat
  const films=[]; for(const p of pages) films.push(await p.evaluate(()=>window.__film));
  const cers=films.map(ceremonies), hc=cers[0];
  for(let k=1;k<N;k++){
    const jc=cers[k], n=Math.min(hc.length, jc.length);
    ok(n>=2, `[${tag}] STAGED: at least two round ceremonies were filmed on the host and ${names[k]} (${hc.length} / ${jc.length})`);
    let firstDiff=-1; for(let i=0;i<n;i++) if(JSON.stringify(hc[i])!==JSON.stringify(jc[i])){ firstDiff=i; break; }
    if(process.env.PARITY_DUMP || firstDiff>=0){ for(let i=0;i<n;i++){ console.log(`   [${tag}] ceremony ${i+1}`+(JSON.stringify(hc[i])===JSON.stringify(jc[i])?'  same':'  DIFFERS')); console.log('     host   '+hc[i].join(' ')); console.log('     '+names[k].padEnd(6)+' '+jc[i].join(' ')); } }
    if(firstDiff>=0){ const bt=await Promise.all([host,pages[k]].map(p=>p.evaluate(()=>(window.__beatTexts||[]).slice(-12))));
      console.log('     beat texts host:  '+JSON.stringify(bt[0])); console.log('     beat texts '+names[k]+': '+JSON.stringify(bt[1]));
      console.log('     '+names[k]+' eliminated: '+(await pages[k].evaluate(()=>window.__cmf.eliminated(0)))); }
    ok(firstDiff<0, `[${tag}] every filmed ceremony is the SAME SEQUENCE on the host and ${names[k]} (${n} compared)`+(firstDiff<0?'':'  ← DRIFT at ceremony '+(firstDiff+1)));
  }
  const kinds=f=>{ const o={}; f.forEach(x=>{ const k=x.t.replace(/:.*/,''); o[k]=(o[k]||0)+1; }); return o; };
  console.log(`   [${tag}] token counts — `+names.map((nm,i)=>nm+' '+JSON.stringify(kinds(films[i]))).join('  '));
  const per=(f,t)=>f.filter(x=>x.t===t).length;
  if(N===2){
    /* THE SAME FLOATS, BY WHOSE DECK THEY ARE. Position is not compared (a float lands within milliseconds of a
       ceremony boundary on either side of it); the COUNT is, and the count is what main got wrong: the client
       showed a render-diff −N under every Round banner that the host suppresses (host 1, client 5, measured).
       Duel only: at 3-6 players each seat draws only ITS OWN deck's float, so the counts differ by design. */
    const mills=['MILL:host','MILL:client'].map(t=>[t, per(films[0],t), per(films[1],t)]);
    ok(mills.every(m=>m[1]===m[2]), `[${tag}] both seats show the same deck-mill floats, by whose deck  `+mills.map(m=>m[0]+' host '+m[1]+' / client '+m[2]).join(' · '));
    const shat=['SHATTER:host','SHATTER:client'].map(t=>[t, per(films[0],t), per(films[1],t)]);
    ok(shat.every(m=>m[1]===m[2]), `[${tag}] both seats shatter the same shields  `+shat.map(m=>m[0]+' host '+m[1]+' / client '+m[2]).join(' · '));
  } else {
    /* At 3-6 players every board draws EVERY seat's shield break (its own, and the opponent panels since
       v1.32.20), so the TOTAL must agree across seats even though "mine" and "theirs" do not. */
    const tot=films.map(f=>f.filter(x=>/^SHATTER:/.test(x.t)).length);
    ok(tot.every(t=>t===tot[0]), `[${tag}] every seat shatters the same number of shields  `+names.map((nm,i)=>nm+' '+tot[i]).join(' / '));
  }
  for(let i=0;i<N;i++){
    const lb=liveUnder(settled(films[i]));
    ok(lb.length===0 && lb.windows>=2, `[${tag}] ${names[i]}'s controls never go live under its own ceremony (${lb.windows} windows checked)`+(lb.length?'  ← live '+lb.length+'x, at +'+lb.slice(0,4).join('/')+'ms into a ceremony':''));
  }
  /* AND THE HOST NEVER HAS TO REFUSE ONE. The host turns a board op away while its ceremony is on screen; a
     CURRENT client's hold is causally later than the host's (it waits for the host's own `cer:false`), so a
     refusal here means the two disagree about when the ceremony ends. */
  const refusals=(JSON.stringify(await host.evaluate(()=>window.__cmf.trace()))).match(/move REFUSED — the round ceremony/g)||[];
  ok(refusals.length===0, `[${tag}] a current client never sends a board op the host must refuse mid-ceremony (${refusals.length} refused)`);
  await ctx.close();
}

(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH); const errs=[];
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  for(const N of (process.env.PARITY_N ? process.env.PARITY_N.split(',').map(Number) : [2,3])) await runTable(b, N, ok, errs);
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{ console.log('HARNESS ERROR: '+e.message); process.exit(2); });
