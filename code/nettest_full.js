/* Full-UI netplay core loop: two tabs on the REAL board. Turn-driven, patient bot that waits out the async
 * mirror round-trip. Verifies both play, rounds resolve in sync, no errors. */
const { chromium } = require('playwright'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8273,ROOM='F'+Date.now().toString().slice(-4);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function snap(p){ return p.evaluate(()=>({
  yourTurn: /your turn/.test((document.getElementById('turnTag')||{}).textContent||''),
  pile: document.querySelectorAll('#pile .card').length,
  round: parseInt(((document.getElementById('roundTag')||{}).textContent||'').replace(/\D/g,''))||0,
  hand: [].slice.call(document.querySelectorAll('#hand .card')).map(c=>c.dataset.id),
})); }
const clear=p=>p.evaluate(()=>{var c=document.getElementById('clearBtn'); if(c)c.click();});
const passT=p=>p.evaluate(()=>{var b=document.getElementById('passBtn'); if(b)b.click();});
const play=(p,id)=>p.evaluate(function(id){ var c=document.querySelector('#hand .card[data-id="'+id+'"]'); if(c)c.click(); var f=document.getElementById('fightBtn'); if(f)f.click(); }, id);
async function waitTurnEnds(p){ for(let i=0;i<40;i++){ if(!(await snap(p)).yourTurn) return; await wait(80); } }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium'});
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1000); await startDuel(host, join);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const hs0=await snap(host), js0=await snap(join);
  ok(hs0.hand.length===6 && js0.hand.length===6,'both real boards dealt 6 cards');

  let maxRound=1, acted=0, hostPlayed=0, joinPlayed=0; const beaten={};
  for(let step=0; step<80 && maxRound<4; step++){
    let who=null; const h=await snap(host), j=await snap(join);
    if(h.yourTurn) who=['host',host]; else if(j.yourTurn) who=['join',join];
    if(!who){ await wait(150); continue; }   // ceremony/transition
    const [role,p]=who; const s=await snap(p);
    if(s.pile===0){ await play(p, s.hand[0]); acted++; role==='host'?hostPlayed++:joinPlayed++; }
    else if(!beaten[role+':'+s.round]){                          // beat once per player per round, else pass (bounds the war)
      beaten[role+':'+s.round]=1;
      await play(p, s.hand[s.hand.length-1]); await wait(300);
      const s2=await snap(p);
      if(s2.yourTurn && s2.hand.length===s.hand.length){ await clear(p); await passT(p); }
      else { role==='host'?hostPlayed++:joinPlayed++; }
      acted++;
    } else { await passT(p); acted++; }
    await waitTurnEnds(p);
    const hr=(await snap(host)).round, jr=(await snap(join)).round; maxRound=Math.max(maxRound,hr,jr);
    if(errs.length) break;
  }
  const hf=await snap(host), jf=await snap(join);
  ok(Math.abs(hf.round-jf.round)<=1,'host/client round numbers in sync ('+hf.round+'/'+jf.round+')');
  ok(maxRound>=3,'advanced multiple rounds (reached '+maxRound+')');
  ok(hostPlayed>0 && joinPlayed>0,'BOTH players led/beat on the real board (host '+hostPlayed+', client '+joinPlayed+')');
  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail+' · maxRound='+maxRound+' acted='+acted);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('ERR',e);process.exit(2);});
