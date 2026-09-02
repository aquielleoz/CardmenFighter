/* RULE SUGGESTIONS OVER NETPLAY (v1.31.31). The host's picks are the rules; everyone else SUGGESTS, and the
 * whole table can see the suggestions — Aj, 2026-08-27: "i think it's ok for people to see each other's
 * suggestions", and his sequence, confirmed: a player suggests -> the intent goes to the host -> the host
 * broadcasts it to the table. That is the emote path, with two differences that matter, both asserted here:
 * a suggestion is STATE, so the host broadcasts the WHOLE MAP (a late joiner and a dropped message both
 * self-heal) and the rate limit COALESCES rather than dropping (dropping strands the table on a stale value).
 * Run: node nettest_suggest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8357),ROOM='SG'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=80,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }

const openRules=p=>p.evaluate(()=>{ const b=document.getElementById('lobbyRules'); if(b)b.click(); return !!b; });
const closeRules=p=>p.evaluate(()=>{ const b=document.getElementById('ruleDone'); if(b)b.click(); });
const toggle=(p,k)=>p.evaluate(k=>{ const b=document.querySelector('.settingRow[data-rule="'+k+'"]'); if(b&&b.click)b.click(); return !!b; },k);
const seg=(p,k,v)=>p.evaluate(([k,v])=>{ const b=document.querySelector('.segBtn[data-mode-for="'+k+'"][data-mode-v="'+v+'"]'); if(b)b.click(); return !!b; },[k,v]);
const votes=(p,k)=>p.evaluate(k=>{
  const r=document.querySelector('.settingRow[data-rule="'+k+'"]');
  return r ? [].map.call(r.querySelectorAll('.ruleVote'),e=>e.textContent.trim()) : null;
},k);
const inPlayTag=(p,k)=>p.evaluate(k=>{
  const r=document.querySelector('.settingRow[data-rule="'+k+'"]'); const e=r&&r.querySelector('.ruleLive');
  return e?e.textContent.trim():'';
},k);
const flags=p=>p.evaluate(()=>({ loss:CardmenEngine.isSpecialLossMode(), dblPair:CardmenEngine.isDoublePair(),
                                 quadro:CardmenEngine.isQuadro() }));
const startEnabled=p=>p.evaluate(()=>{ const g=document.getElementById('lobbyGo'); return !!(g&&!g.disabled&&/Start/i.test(g.textContent||'')); });
const setName=(p,n)=>p.evaluate(n=>{ const i=document.getElementById('netName'); if(!i) return false;
  i.value=n; i.dispatchEvent(new Event('input')); i.dispatchEvent(new Event('change')); return true; },n);

(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:1000}}); const errs=[];
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const c1=await ctx.newPage(); c1.on('pageerror',e=>errs.push('c1: '+e.message));
  await host.goto(url('host')); await c1.goto(url('join'));
  // one shared localStorage in this context, so clear the rules once and reload both
  for(const p of [host,c1]){ await p.evaluate(()=>{ try{ localStorage.removeItem('cmf_rules_v1'); }catch(e){} }); await p.reload(); }
  ok(await until(()=>c1.evaluate(()=>!!document.getElementById('lobbyGo'))), 'host and one client reach the lobby');
  await setName(host,'Koya'); await setName(c1,'Aj'); await wait(200);
  await c1.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });   // ready → sends join
  ok(await until(()=>startEnabled(host)), 'the client readies, so the host could Start');

  // ---------- the client's panel SUGGESTS, and never touches the game
  ok(await openRules(c1), 'the client is offered the rules panel');
  await wait(300);
  ok(await c1.evaluate(()=>/suggestion/i.test((document.querySelector('#modal h2')||{}).textContent||'')
                        || /suggestion/i.test((document.querySelector('.netmsg')||{}).textContent||'')),
     'and it is presented as SUGGESTIONS, not as the rules');
  ok(await c1.evaluate(()=>![].every.call(document.querySelectorAll('.settingRow[data-rule]'),r=>
       r.hasAttribute('data-mode') ? [].every.call(r.querySelectorAll('.segBtn'),x=>x.disabled) : r.disabled)),
     'the controls are LIVE for a client now — it used to be read-only');
  const before=await flags(c1);
  await toggle(c1,'lossAll'); await wait(250);
  ok(JSON.stringify(await flags(c1))===JSON.stringify(before),
     'toggling one changes NOTHING about the rules in play on the client — it is only an opinion');
  ok((await inPlayTag(c1,'lossAll'))!=='', `and the row says what is actually in play (${await inPlayTag(c1,'lossAll')})`);
  /* IMMEDIATELY, with no wait. The chip is derived state and the rows patch themselves in place, so it used to
   * appear only when the host's echo re-rendered the whole panel — i.e. ~250ms late, and never at all for a
   * client that is not connected. Waiting here would let the echo hide that. */
  await c1.evaluate(()=>{ const r=document.querySelector('.settingRow[data-rule="apexInf"]'); if(r&&r.click)r.click(); });
  ok((await inPlayTag(c1,'apexInf'))!=='', 'the in-play line appears at once on a local toggle, not on the host\'s echo');
  await c1.evaluate(()=>{ const r=document.querySelector('.settingRow[data-rule="apexInf"]'); if(r&&r.click)r.click(); });
  ok((await inPlayTag(c1,'apexInf'))==='', 'and goes away again when your pick matches what is in play');

  // ---------- the host sees it, by name, on that row
  ok(await openRules(host), 'the host opens its own panel');
  await wait(300);
  ok(await until(async()=>{ const v=await votes(host,'lossAll'); return !!(v&&v.length); }),
     'the suggestion reaches the HOST\'s panel');
  const hv=await votes(host,'lossAll');
  ok(hv && /Aj/.test(hv.join(' ')), `and names who wants it (${JSON.stringify(hv)})`);
  ok(!(await votes(host,'millAll') || []).length, 'a rule nobody suggested carries no chip');

  // ---------- a MODE suggestion has to carry its VALUE: "2 want this" is meaningless on a three-way row
  ok(await seg(c1,'dblPair','poker'), 'the client suggests a MODE');
  /* The chip carries the mode's VALUE LABEL, so a rename of the segment shows up here — which is the point:
     "2 want this" says nothing about a three-way row. */
  ok(await until(async()=>{ const v=await votes(host,'dblPair'); return !!(v&&v.length && /Non-consecutive/i.test(v.join(' '))); }),
     'the host sees the mode\'s VALUE, not just that someone wants the row');
  ok((await flags(host)).dblPair==='off', 'and the host\'s own rules are untouched by it — its picks are the rules');

  // ---------- a suggestion must NOT un-ready the table
  ok(await startEnabled(host), 'the table is STILL ready — a suggestion changes nothing about the game');

  // ---------- the host adopting one goes through the normal rules path
  await toggle(host,'lossAll'); await wait(300);
  ok((await flags(host)).loss==='all', 'the host adopts the suggestion by toggling it for real');
  /* CLOSING the panel is what broadcasts (`back` → hostRulesChanged), exactly as in nettest_rules. Without it
   * the client still ends up on the new rules — the join RETRY keeps pulling a fresh t:'welcome' — but it is
   * never un-readied, which is the difference this pair of assertions is about. */
  await closeRules(host); await wait(400);
  ok(await until(async()=>(await flags(c1)).loss==='all'), 'and the CLIENT adopts it over the wire as usual');
  ok(await until(async()=>await c1.evaluate(()=>{
       const g=document.getElementById('lobbyGo'); return !!(g&&/Ready/i.test(g.textContent||''));
     })), 'THAT un-readies the table, because the rules really changed');

  await openRules(host); await wait(300);

  // ---------- THE TWO-STORE SPLIT: the host's rules arriving must not eat the client's own picks
  await wait(300);
  const stillMine=await c1.evaluate(()=>window.__cmf && window.__cmf.myRulesKey ? window.__cmf.myRulesKey() : null);
  ok(stillMine && /dblPair=poker/.test(stillMine) && /lossAll/.test(stillMine),
     `the client's own picks SURVIVED the host's rules arriving (${stillMine}) — one RULES object would have lost them`);

  // ---------- a third seat sees the second seat's suggestion (the table-visible half)
  const c2=await ctx.newPage(); c2.on('pageerror',e=>errs.push('c2: '+e.message));
  await c2.goto(url('join')); await wait(400);
  await setName(c2,'Mina'); await wait(150);
  await c2.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await until(()=>c2.evaluate(()=>!!document.getElementById('lobbyRules'))), 'a third seat joins');
  await openRules(c2); await wait(400);
  ok(await until(async()=>{ const v=await votes(c2,'dblPair'); return !!(v&&v.length && /Non-consecutive/i.test(v.join(' '))); }),
     'and it can see ANOTHER seat\'s suggestion — a late joiner gets the whole map, not just changes since it arrived');
  ok(await until(async()=>{ const v=await votes(host,'quadro'); return !!(v&&v.length); },10)===false,
     'nothing is invented: a rule nobody suggested still carries no chip');

  /* Reader-relative, like every other name in this game. The host is never in the map — its picks are the
   * rules — so this only ever shows on a client, and getting it wrong would have you reading your own vote as
   * a stranger's. */
  ok(await until(async()=>{ const v=await votes(c1,'lossAll'); return !!(v&&v.length && /You/.test(v.join(' '))); }),
     'a client reads its OWN suggestion as "You", not by name');
  ok(!(await votes(c1,'lossAll')||[]).join(' ').includes('Aj'),
     'and not as both at once');

  // ---------- the host VALIDATES: an untrusted client's key is sanitised, not displayed
  ok(await c2.evaluate(()=>{
       if(!(window.__cmf && __cmf.clientSend)) return false;
       __cmf.clientSend({op:'suggest', key:'lossAll,notARule,dblPair=banana,quadro'});
       return true;
     }), 'a client sends a key containing rules this build does not have');
  ok(await until(async()=>{ const v=await votes(host,'quadro'); return !!(v&&v.length && /Mina/.test(v.join(' '))); }),
     'the real rules in it are kept');
  ok(await host.evaluate(()=>!/notARule|banana/i.test(document.getElementById('modal').textContent||'')),
     'and the junk is DROPPED rather than shown — an unknown rule from a newer peer must not be advertised');
  const modeVotes=await votes(host,'dblPair');
  ok(!/banana/i.test((modeVotes||[]).join(' ')), `an invalid mode value falls away too (${JSON.stringify(modeVotes)})`);

  // ---------- a burst COALESCES to the latest value, rather than the table being stranded on an early one
  ok(await c2.evaluate(()=>{
       ['lossAll','millAll','shieldScale','flatDraw','apexInf'].forEach(function(k){
         __cmf.clientSend({op:'suggest', key:k});
       });
       return true;
     }), 'the client fires five suggestions back to back, bypassing its own UI');
  ok(await until(async()=>{ const v=await votes(host,'apexInf'); return !!(v&&v.length && /Mina/.test(v.join(' '))); }),
     'the host lands on the LAST of them — state coalesces, where an emote burst would have been dropped');
  ok(!(await votes(host,'shieldScale') || []).join(' ').includes('Mina'),
     'and not on an earlier one — a dropped-burst rate limit would have stranded the table there');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
