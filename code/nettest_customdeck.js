/* Netplay CUSTOM DECK: a client picks a "parts" deck the HOST has never heard of, and the host must honour the
 * COMPOSITION rather than a saved name.
 *   Phase 1: the client saves 'Aj Special' (1 Wizard + 2 Cleric + 1 Fighter) and picks it in the lobby. The host
 *            must build 13♦/26♥/13♣ for that seat, the client must label it by its own name, and the host — which
 *            has no such deck saved — must show a described fallback rather than a raw 'custom:…' key.
 *   Phase 2: a rogue client sends a garbage deck string. The host must reject it at intake and seat a Full Set
 *            instead of letting an unknown key fall silently through buildDeck().
 * NOTE both pages share one browser context (BroadcastChannel needs it), hence one localStorage: the client is
 * loaded WITH the saved deck and the store is cleared BEFORE the host page loads, so the host is genuinely
 * ignorant of it — which is what a real pair of players looks like. Run: node nettest_customdeck.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8302);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=(r,room)=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${room}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const label=(p,id)=>p.evaluate(id=>((document.getElementById(id)||{}).textContent||''), id);
const hasOpt=(p,v)=>p.evaluate(v=>!!document.querySelector('#deckSel option[value="'+v+'"]'), v);
async function waitHand(p){ for(let i=0;i<60;i++){ if((await p.evaluate(()=>document.querySelectorAll('#hand .card').length))===6) return true; await wait(150); } return false; }
(async()=>{
  await new Promise((r,j)=>{ srv.once('error',e=>j(new Error('cannot bind port '+PORT+' ('+e.code+') — another suite or a stray process has it. sweep.js assigns ports; to run alone use PORT=n node <suite>'))); srv.listen(PORT,r); });
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // ================= PHASE 1 — an unknown composition is honoured =================
  const ROOM1='CD'+Date.now().toString().slice(-4);
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await join.goto(url('join',ROOM1));
  await join.evaluate(()=>localStorage.setItem('cmf_decks_v1', JSON.stringify([{name:'Aj Special',parts:{D:1,H:2,C:1}}])));
  await join.reload(); await wait(400);
  ok(await hasOpt(join,'custom:D1H2C1'),'the client\'s lobby picker offers its saved custom deck');
  ok(await hasOpt(join,'__builddeck__'),'the lobby also offers "✏️ Custom deck…" so you can build one online');
  await join.evaluate(()=>localStorage.removeItem('cmf_decks_v1'));   // the host loads AFTER this → it never sees the deck
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  await host.goto(url('host',ROOM1)); await wait(1100);
  ok(!(await hasOpt(host,'custom:D1H2C1')),'the HOST\'s picker does not offer it — the host has never heard of this deck');

  /* v1.31.28: the LOBBY picker used to default to the Full Set outright (`myDeck='full'`), which is how most
   * online games ended up playing all 52 cards without anyone choosing that. Both seats now default to Random,
   * and Full Set sits last. Asserted on both because the lobby has two render paths (host and client). */
  for(const [pg,who] of [[host,'host'],[join,'client']]){
    ok(await pg.evaluate(()=>{ const s=document.getElementById('deckSel'); return !!s && s.value==='random'; }),
       `the ${who}'s lobby deck picker defaults to 🎲 Random`);
    const ord=await pg.evaluate(()=>[].map.call(document.querySelectorAll('#deckSel option'),o=>o.value));
    ok(ord[0]==='random' && ord.indexOf('full')===ord.length-2 && ord[ord.length-1]==='__builddeck__',
       `  and Full Set is last of the decks there too (${ord.indexOf('full')} of ${ord.length-1})`);
  }

  await startDuel(host, join, { hostDeck:'Wizard', clientDeck:'custom:D1H2C1' });
  ok(await waitHand(host) && await waitHand(join),'both boards dealt 6 cards');

  const comp=await host.evaluate(()=>window.__cmf.comp(1));
  ok(comp && comp.D===13 && comp.H===26 && comp.C===13 && !comp.S,
     'the host built the client\'s COMPOSITION: 13♦ / 26♥ / 13♣ ('+JSON.stringify(comp)+')');
  ok((await host.evaluate(()=>window.__cmf.comp(0))).D===52,'the host still got its own Pure Wizard (52♦)');
  ok(/Aj Special/.test(await label(join,'youDeckName')),'the client labels it by its own saved name ("'+(await label(join,'youDeckName'))+'")');
  const hostSays=await label(host,'rivalDeckName');
  ok(!/custom:/.test(hostSays),'the host never shows the player a raw composition key');
  ok(/♦|♥|♣|Custom/.test(hostSays),'the host DESCRIBES the unknown deck instead ("'+hostSays+'")');
  await host.close(); await join.close();

  // ================= PHASE 2 — a garbage deck string is rejected at intake =================
  const ROOM2='CX'+Date.now().toString().slice(-4);
  const host2=await ctx.newPage(); host2.on('pageerror',e=>errs.push('host2: '+e.message));
  const join2=await ctx.newPage(); join2.on('pageerror',e=>errs.push('join2: '+e.message));
  await host2.goto(url('host',ROOM2)); await join2.goto(url('join',ROOM2)); await wait(1100);
  // a rogue client offers a deck value the engine cannot build (parts do not total 4)
  await join2.evaluate(()=>{
    var s=document.getElementById('deckSel'), o=document.createElement('option');
    o.value='custom:D9'; o.textContent='rogue'; s.appendChild(o); s.value='custom:D9'; s.dispatchEvent(new Event('change'));
  });
  await startDuel(host2, join2, {});
  ok(await waitHand(host2) && await waitHand(join2),'the duel still starts despite the bogus deck');
  const bad=await host2.evaluate(()=>window.__cmf.comp(1));
  const suits=Object.keys(bad||{}).sort().join('');
  ok(bad && bad.D===13 && bad.H===13 && bad.C===13 && bad.S===13,
     'the rogue seat fell back to a Full Set (13 of each suit), not a silent half-deck ('+JSON.stringify(bad)+')');
  ok(Object.keys(bad).reduce((a,k)=>a+bad[k],0)===52,'and it is still exactly 52 cards');
  ok(!/custom:D9/.test(await label(host2,'rivalDeckName')),'the bogus key never reaches the board label');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,3).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
