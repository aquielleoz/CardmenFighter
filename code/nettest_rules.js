/* CUSTOM RULES OVER NETPLAY (v1.31.22): the host owns them, the client adopts them, and a change UN-READIES the
 * table. Aj asked for that last part explicitly — "yes, un-ready that. so we can ping them again" — because if
 * the host edits the rules after you readied, you agreed to a different game.
 *
 * The host's rules are the game's rules, so a client can only LOOK: a client toggling them would be a lie, and
 * the version handshake (v1.31.21) exists for the same reason — a peer quietly playing different rules is worse
 * than no menu at all.
 * Run: node nettest_rules.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=8351,ROOM='RL'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':'text/html'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
/* A TIMED-OUT POLL NOW SAYS SO. Most call sites discard this boolean (they are staging steps), so a poll
 * that gave up used to be invisible and surfaced later as an unrelated assertion failing on a board that
 * was still mid-round-trip — the v1.31.9 waitTurnEnds bug, in the general case. A red run must explain
 * itself, so name the condition that never came true. */
function pollTimedOut(fn){ console.log('   ⏱ poll TIMED OUT: ' + String(fn).replace(/\s+/g,' ').slice(0,100)); }
async function until(fn,t=90,ms=150){ for(let i=0;i<t;i++){ if(await fn()) return true; await wait(ms); } pollTimedOut(fn); return false; }
/* IS THE MODAL ACTUALLY ON SCREEN? DOM presence is not visibility, and that distinction was a real shipped bug:
 * `.overlay` sat at z-index 30 while `#netroot` sits at 99999, so in a netplay lobby the Custom rules modal
 * opened correctly and rendered entirely BEHIND the lobby. Every DOM assertion passed. This hit-tests the centre
 * of the viewport instead, which is the only thing that can tell "open" from "open and visible". */
const modalOnTop=p=>p.evaluate(()=>{
  const m=document.getElementById('modal');
  if(!m || !document.getElementById('overlay').classList.contains('show')) return false;
  const el=document.elementFromPoint(Math.round(innerWidth/2), Math.round(innerHeight/2));
  return !!(el && m.contains(el));
});
const flags=p=>p.evaluate(()=>({ loss:CardmenEngine.isSpecialLossMode(), shieldScale:CardmenEngine.isShieldsPerPlayer(), dblPair:CardmenEngine.isDoublePair() }));
const startEnabled=p=>p.evaluate(()=>{ const g=document.getElementById('lobbyGo'); return !!(g && !g.disabled && /Start/i.test(g.textContent||'')); });
const readyBtn=p=>p.evaluate(()=>{ const g=document.getElementById('lobbyGo'); return !!(g && /Ready/i.test(g.textContent||'')); });
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:900}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  // both start from the shipped defaults, so any change below is unambiguous
  await host.goto(url('host')); await join.goto(url('join'));
  await host.evaluate(()=>{ try{ localStorage.removeItem('cmf_rules_v1'); }catch(e){} });
  await join.evaluate(()=>{ try{ localStorage.removeItem('cmf_rules_v1'); }catch(e){} });
  await host.reload(); await join.reload();
  ok(await until(()=>join.evaluate(()=>!!document.getElementById('lobbyGo'))), 'both reach the lobby');
  ok((await flags(host)).loss==='chosen' && (await flags(join)).loss==='chosen', 'both start on the shipped rules');

  ok(await join.evaluate(()=>!!document.getElementById('lobbyRules')), 'the client is offered a way to READ the rules');
  await join.evaluate(()=>document.getElementById('lobbyRules').click()); await wait(350);
  ok(await modalOnTop(join), 'the panel is actually VISIBLE over the lobby, not just present in the DOM');
  /* A MODE row is a <div> and cannot be `disabled` — its segments carry it (see rulestest). Checking only
   * `row.disabled` would pass a client that could still change the mode locally, which over netplay means two
   * people playing different games: the whole failure the version handshake exists to prevent. */
  ok(await join.evaluate(()=>[].every.call(document.querySelectorAll('.settingRow[data-rule]'),
       r=>r.hasAttribute('data-mode') ? [].every.call(r.querySelectorAll('.segBtn'),b=>b.disabled) : r.disabled)),
     'and it is read-only for the client — only the host\'s rules count');
  ok(await join.evaluate(()=>[].every.call(document.querySelectorAll('.ruleBulk .bulkBtn'),b=>b.disabled)),
     '  including the presets and Clear all — a client applying a preset locally is two different games');
  ok(await join.evaluate(()=>/host chooses the rules/i.test((document.querySelector('.modal .netmsg')||{}).textContent||'')),
     'with a line saying the host decides, rather than a dead control');
  await join.evaluate(()=>document.getElementById('ruleDone').click()); await wait(250);

  // ---------- the client readies
  await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await until(async()=>await startEnabled(host)), 'the client readies and the host can Start');

  // ---------- the host changes a rule
  ok(await host.evaluate(()=>!!document.getElementById('lobbyRules')), 'the host is offered ⚗️ Custom rules in the lobby');
  await host.evaluate(()=>document.getElementById('lobbyRules').click()); await wait(350);
  ok(await modalOnTop(host), 'and visible for the HOST too — this is the seat the bug was reported from');
  ok(await host.evaluate(()=>![].every.call(document.querySelectorAll('.settingRow[data-rule]'),x=>x.disabled)),
     'and for the HOST it is editable');
  await host.evaluate(()=>{ const r=document.querySelector('.settingRow[data-rule="lossAll"]'); if(r)r.click(); }); await wait(200);
  /* A MODE rule as well, because it is the first rule whose serialised form carries a VALUE (`dblPair=poker`).
   * The key is split on ',' and then on '=', so a mode crossing the wire exercises a parser path that no
   * boolean rule ever touches — and a client that silently fell back to 'off' would look identical to a host
   * who never changed it. */
  await host.evaluate(()=>{ const b=document.querySelector('.segBtn[data-mode-for="dblPair"][data-mode-v="poker"]'); if(b)b.click(); }); await wait(200);
  await host.evaluate(()=>document.getElementById('ruleDone').click()); await wait(400);
  ok((await flags(host)).loss==='all' && (await flags(host)).dblPair==='poker', 'the host\'s engine takes the new rules');

  // ---------- the decisive pair: the client adopts it, and is un-readied
  ok(await until(async()=>(await flags(join)).loss==='all'), 'the CLIENT adopts the host\'s rules over the wire');
  ok((await flags(join)).dblPair==='poker',
     'including the MODE rule\'s value, not just a boolean — `dblPair=poker` survives the round trip');
  ok(await until(async()=>await readyBtn(join)),
     'and the client is UN-READIED — it agreed to a different game, so it must confirm again');
  ok(!(await startEnabled(host)), 'so the host cannot Start until the table re-readies');
  ok(await until(async()=>await join.evaluate(()=>/changed the rules/i.test((document.getElementById('message')||{}).textContent||''))),
     'the client is told why it was un-readied');
  ok(await join.evaluate(()=>/· on/.test((document.getElementById('lobbyRules')||{}).textContent||'')),
     'and its rules button shows "· on", so the custom game is visible without opening anything');

  // ---------- re-readying works, and the game then starts under the host's rules
  await join.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g)g.click(); });
  ok(await until(async()=>await startEnabled(host)), 're-readying re-enables Start');
  await host.evaluate(()=>{ const g=document.getElementById('lobbyGo'); if(g && !g.disabled)g.click(); });
  ok(await until(async()=>(await host.evaluate(()=>document.querySelectorAll('#hand .card').length))>0), 'the duel starts');
  ok((await flags(host)).loss==='all',
     'and it is played under the custom rules — hostStartRealN used to hardcode the defaults here and would have silently ignored the menu');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
