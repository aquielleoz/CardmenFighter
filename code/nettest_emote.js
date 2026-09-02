/* EMOTES OVER NETPLAY (v1.31.16). Seven of them: Hi! / Nice! / Yes! / No! / One sec / GG / Rematch? — Aj's set
 * plus "Nice!" (reacting to a play is the commonest card-game emote) and "One sec" (netplay has a 90s
 * disconnect grace, so "I'm still here" prevents the worst online moment).
 * They ride the EXISTING plumbing rather than a new channel: a client sends an intent, the host narrates with
 * say() — which renders {who} in each reader's own frame and broadcasts the template — and then broadcasts a
 * t:'emote' so every seat pops the bubble and hears the cue.
 * Verifies: both directions cross the wire, the log is reader-relative ("You" vs the sender's name), it works
 * when it is NOT your turn, the double-log trap is absent, and the cooldown holds.
 * Run: node nettest_emote.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const startDuel=require('./nettest_lobby.js');
const http=require('http'),fs=require('fs'),path=require('path');
const DIR=__dirname,PORT=+(process.env.PORT||8321),ROOM='EM'+Date.now().toString().slice(-3);
const srv=http.createServer((q,r)=>{let p=path.join(DIR,q.url.split('?')[0]==='/'?'/CardmenFighter.html':q.url.split('?')[0]);fs.readFile(p,(e,b)=>{if(e){r.writeHead(404);r.end();}else{r.writeHead(200,{'Content-Type':p.endsWith('.html')?'text/html':'application/javascript'});r.end(b);}});});
const url=r=>`http://localhost:${PORT}/CardmenFighter.html?net=${r}&room=${ROOM}&dbg=1`;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const log=p=>p.evaluate(()=>[].map.call(document.querySelectorAll('#log .le'),e=>e.textContent.trim()));
const emote=(p,k)=>p.evaluate(k=>{ const b=document.querySelector('#emoteBar .emoteBtn[data-em="'+k+'"]'); if(b) b.click(); return !!b; }, k);
const turnOf=p=>p.evaluate(()=>window.__cmf?window.__cmf.turn():null);
async function waitLog(p,re,t=80){ for(let i=0;i<t;i++){ if((await log(p)).some(l=>re.test(l))) return true; await wait(150); } return false; }
(async()=>{
  await new Promise(r=>srv.listen(PORT,r));
  const b=await chromium.launch(LAUNCH);
  const ctx=await b.newContext({viewport:{width:1100,height:820}}); const errs=[];
  const host=await ctx.newPage(); host.on('pageerror',e=>errs.push('host: '+e.message));
  const join=await ctx.newPage(); join.on('pageerror',e=>errs.push('join: '+e.message));
  await host.goto(url('host')); await join.goto(url('join')); await wait(1200);
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};

  // names, so the log lines are checkable and reader-relative
  await host.evaluate(()=>{ const el=document.getElementById('netName'); if(el){ el.value='Koya'; el.dispatchEvent(new Event('input')); } });
  await join.evaluate(()=>{ const el=document.getElementById('netName'); if(el){ el.value='Aj'; el.dispatchEvent(new Event('input')); } });
  ok(await host.evaluate(()=>!!document.getElementById('netName')), 'the lobby offers a name field (host)');
  ok(await join.evaluate(()=>!!document.getElementById('netName')), 'the lobby offers a name field (client)');
  await startDuel(host, join);
  ok(await waitLog(host,/Round 1/i), 'duel started');   // `|| true` used to make this pass unconditionally
  ok(await host.evaluate(()=>!!document.getElementById('emoteBar')), 'the emote bar exists in netplay');
  ok(await host.evaluate(()=>document.querySelectorAll('#emoteBar .emoteBtn').length===7), 'all seven emotes are offered');

  /* …AND ALL SEVEN ARE ON SCREEN. The bar lives in `#actions` (v1.31.57), and `#actions` wraps on a narrow
   * phone, so the bar sits at the RIGHT on a wide screen and near the LEFT once the row wraps. Measured, a
   * fixed CSS anchor hangs off one edge or the other at every width — `left:0` gave 4 of 7 at 720px, `right:0`
   * gave 1 of 7 at 327px — so the popup is nudged back on screen by `placeEmoteList`. Checked at BOTH ends of
   * that range, because either anchor passes at one of them. Drive the real TOGGLE: adding `.open` by hand
   * skips the handler that does the clamping, and then this assertion tests nothing. */
  const emotesOnScreen = async (w)=>{ await host.setViewportSize({width:w, height:780}); await wait(250);
    return host.evaluate(()=>{ const bar=document.getElementById('emoteBar');
      if(bar.classList.contains('open')) document.getElementById('emoteToggle').click();
      document.getElementById('emoteToggle').click();
      const vw=document.documentElement.clientWidth;
      const all=[...document.querySelectorAll('#emoteBar .emoteBtn')];
      const on=all.filter(x=>{const r=x.getBoundingClientRect(); return r.left>=-1 && r.right<=vw+1;}).length;
      document.getElementById('emoteToggle').click();      // leave no selection/state behind
      return {on, total:all.length}; }); };
  const narrow = await emotesOnScreen(327), wide = await emotesOnScreen(720);
  ok(narrow.on===narrow.total, 'every emote is reachable on a NARROW phone where the row wraps ('+narrow.on+'/'+narrow.total+')');
  ok(wide.on===wide.total,     '  → and on a WIDE screen where the bar sits at the right edge ('+wide.on+'/'+wide.total+')');
  await host.setViewportSize({width:1100, height:820});

  // ---- HOST -> CLIENT
  ok(await emote(host,'hi'), 'host taps Hi!');
  ok(await waitLog(host,/^You says hi!|^You say/i), 'the host reads its own emote as "You"');
  ok(await waitLog(join,/Koya says hi!/), 'the CLIENT sees it attributed to the host by NAME');
  const dupe=(await log(join)).filter(l=>/says hi!/.test(l)).length;
  ok(dupe===1, 'and exactly ONCE on the client — the host\'s say() broadcast is not re-logged locally ('+dupe+')');

  // ---- CLIENT -> HOST, and specifically while it is NOT the client's turn
  const t=await turnOf(join);
  ok(t!==0, 'it is NOT the client\'s turn (turn '+t+' in its own frame) — emotes must work anyway');
  await wait(1300);                                     // clear the 1.2s cooldown
  ok(await emote(join,'nice'), 'client taps Nice! out of turn');
  ok(await waitLog(host,/Aj says nice play!/), 'the HOST sees the client\'s emote by NAME, off-turn');
  ok(await waitLog(join,/^You says nice play!|^You say/i), 'and the client reads its own as "You"');

  /* ---- the cooldown. THIS USED TO BE VACUOUS: it fired the burst immediately after the emote above, still
   * inside that 1.2s window, so the client's own gate dropped all three and `added<=1` passed on added=0 —
   * an assertion that would also have passed with the cooldown deleted and the wire dead. It now waits the
   * window out first, so ONE must get through and the other two must not: both directions, or nothing. */
  await wait(1300);
  const before=(await log(host)).length;
  await emote(join,'no'); await emote(join,'yes'); await emote(join,'gg');   // three in a row, instantly
  let arrived=false;
  for(let i=0;i<60;i++){ if((await log(host)).length>before){ arrived=true; break; } await wait(150); }
  ok(arrived, 'the first of a burst DOES reach the host — so the count below is not measuring an empty wire');
  await wait(900);                                     // settle: give the other two every chance to appear
  const added=(await log(host)).length - before;
  ok(added===1, 'and the cooldown drops the rest — three instant taps produced exactly one line ('+added+')');

  /* ---- the HOST's per-seat gate, which is the half that matters: a client controls its own clock, so
   * `sendEmote`'s check is a courtesy and `hostEmote`'s is the real one. Going through NET.clientSend skips the
   * client-side gate entirely — the same thing a modified or laggy client does by accident. */
  await wait(1300);
  const before2=(await log(host)).length;
  ok(await join.evaluate(()=>{
    if(!(window.__cmf && __cmf.clientSend)) return false;
    ['no','yes','gg'].forEach(function(k){ __cmf.clientSend({op:'emote', key:k}); });
    return true;
  }), 'the client sends three emote intents straight down the wire, bypassing its own cooldown');
  let arrived2=false;
  for(let i=0;i<60;i++){ if((await log(host)).length>before2){ arrived2=true; break; } await wait(150); }
  ok(arrived2, 'the host accepts the first of them');
  await wait(900);
  const added2=(await log(host)).length - before2;
  ok(added2===1, 'and the HOST\'s own per-seat cooldown drops the other two ('+added2+') — it does not trust the client\'s clock');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAILED — ':'')+'PASS: '+pass+'  FAIL: '+fail);
  await b.close(); srv.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
