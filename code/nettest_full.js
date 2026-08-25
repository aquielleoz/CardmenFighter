/* Full-UI netplay core loop: two tabs on the REAL board. Turn-driven, patient bot that waits out the async
 * mirror round-trip. Verifies both play, rounds resolve in sync, no errors. */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js'); const http=require('http'),fs=require('fs'),path=require('path');
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
/* Returns TRUE only if the turn really ended. It used to return void after 40x80ms = 3.2s, so under load the
 * caller could not tell "turn over" from "gave up" — and then acted into a board still mid-round-trip. That is
 * the documented position-dependence: late in a long serial sweep this suite reported `maxRound=2 acted=80`,
 * i.e. it acted on every step and none of it landed. The budget is generous on purpose — a slow machine should
 * make the suite SLOWER, never failing. */
async function waitTurnEnds(p){ for(let i=0;i<150;i++){ if(!(await snap(p)).yourTurn) return true; await wait(80); } return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await host.waitForTimeout(1000); await startDuel(host, join);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const hs0=await snap(host), js0=await snap(join);
  ok(hs0.hand.length===6 && js0.hand.length===6,'both real boards dealt 6 cards');

  /* Bound by WALL CLOCK and by productive actions, not by a raw iteration count: a transition or a slow mirror
   * used to burn a step, so the budget could be exhausted without the game ever advancing. */
  /* Patience is measured in TIME SINCE PROGRESS, not in iterations. The first version of this used
   * `stalled < 40` — and at 150ms a go that is six seconds, which is the same impatient-counter bug this
   * rewrite existed to remove, one layer up. Under load the mirror round-trip alone can exceed it. */
  let maxRound=1, acted=0, hostPlayed=0, joinPlayed=0; const beaten={};
  const deadline=Date.now()+180000;
  const STALL_MS=60000; let lastProgress=Date.now();
  const progressed=()=>{ lastProgress=Date.now(); };
  while(maxRound<4 && acted<80 && (Date.now()-lastProgress)<STALL_MS && Date.now()<deadline){
    let who=null; const h=await snap(host), j=await snap(join);
    if(h.yourTurn) who=['host',host]; else if(j.yourTurn) who=['join',join];
    if(!who){ await wait(150); continue; }              // ceremony/transition — costs no action budget

    const [role,p]=who; const s=await snap(p);
    if(s.pile===0){ await play(p, s.hand[0]); acted++; progressed(); role==='host'?hostPlayed++:joinPlayed++; }
    else if(!beaten[role+':'+s.round]){                          // beat once per player per round, else pass (bounds the war)
      beaten[role+':'+s.round]=1;
      await play(p, s.hand[s.hand.length-1]); await wait(300);
      const s2=await snap(p);
      if(s2.yourTurn && s2.hand.length===s.hand.length){ await clear(p); await passT(p); }
      else { role==='host'?hostPlayed++:joinPlayed++; }
      acted++;
    } else { await passT(p); acted++; }
    // if the turn has NOT actually ended, loop round and wait again rather than acting into a stale board
    if(!(await waitTurnEnds(p))){ continue; }           // still their turn: wait again, never act blind
    const hr=(await snap(host)).round, jr=(await snap(join)).round;
    const before=maxRound; maxRound=Math.max(maxRound,hr,jr);
    if(maxRound>before) progressed();                    // a resolved round is the only real progress
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
