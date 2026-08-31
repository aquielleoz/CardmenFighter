/* Netplay DECK PICKER: host and client each choose a DIFFERENT archetype in the lobby; verify the host deals each
 * side the deck it picked (Pure Wizard = all ♦ for the host, Pure Rogue = all ♠ for the client) and that the board
 * deck labels match on both ends. Proves the lobby picks actually drive startGame. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8291,ROOM='DK'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const handSuits=p=>p.evaluate(()=>[].slice.call(document.querySelectorAll('#hand .card')).map(function(c){ var g=c.querySelector('.idx b, .c'); return g?g.textContent.trim():'?'; }));
const label=(p,id)=>p.evaluate(id=>((document.getElementById(id)||{}).textContent||''), id);
async function waitHand(p){ for(let i=0;i<60;i++){ if((await p.evaluate(()=>document.querySelectorAll('#hand .card').length))===6) return true; await wait(150); } return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1000);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  await startDuel(host, join, { hostDeck:'Wizard', clientDeck:'Rogue' });   // host = Pure Wizard (♦), client = Pure Rogue (♠)
  ok(await waitHand(host) && await waitHand(join),'both boards dealt 6 cards after the deck picks');

  const hs=await handSuits(host), js=await handSuits(join);
  ok(hs.length===6 && hs.every(s=>s==='♦'),'host was dealt its Pure Wizard deck (all ♦): '+hs.join(''));
  ok(js.length===6 && js.every(s=>s==='♠'),'client was dealt its Pure Rogue deck (all ♠): '+js.join(''));

  ok(/Wizard/.test(await label(host,'youDeckName')),'host board labels its own deck Wizard');
  ok(/Rogue/.test(await label(host,'rivalDeckName')),'host board labels the rival Rogue');
  ok(/Rogue/.test(await label(join,'youDeckName')),'client board labels its own deck Rogue');
  ok(/Wizard/.test(await label(join,'rivalDeckName')),'client board labels the rival Wizard');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));

  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
