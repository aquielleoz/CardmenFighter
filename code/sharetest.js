/* THE SHARE SHEET, AND A TOLERANT PASTE (v1.31.19). Aj, settling on browser-only: "you can always copy paste
 * the code to a chat program" — so this automates exactly that. `navigator.share` is stubbed rather than
 * invoked for real, because a real share sheet is an OS dialog no headless browser can dismiss; what matters is
 * that the right payload reaches it.
 *
 * The payload assertion is the point of this suite. Sharing a friendly sentence around the code would read
 * better in a chat and would BREAK any recipient running a build without the tolerant dec() — and stale copies
 * of this game demonstrably exist in the wild. So it shares the raw code, and that is asserted byte-for-byte
 * rather than merely "share was called".
 * Run: node sharetest.js */
const { chromium } = require('playwright'); const LAUNCH=require('./pwchrome'); const path=require('path');
const HTML=path.resolve(__dirname,'CardmenFighter.html');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function hostTo(page){
  await page.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
  await page.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
  await page.evaluate(()=>{ const h=document.getElementById('onHost'); if(h)h.click(); });
  for(let i=0;i<120;i++){
    if(await page.evaluate(()=>{ const t=document.getElementById('sigOut'); return !!(t&&t.value); })) return true;
    await wait(200);
  }
  return false;
}
(async()=>{
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const b=await chromium.launch(LAUNCH);

  // ---------- with a share sheet available
  { const ctx=await b.newContext({viewport:{width:390,height:840}});
    await ctx.addInitScript(()=>{
      window.__shared=[];
      navigator.share=function(d){ window.__shared.push(d); return Promise.resolve(); };
    });
    const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));
    await p.goto('file://'+HTML+'?dbg=1'); await wait(500);
    ok(await hostTo(p), 'a host screen with an invite code is up');
    ok(await p.evaluate(()=>!!document.getElementById('sigShare')), 'a Send button is offered when navigator.share exists');
    ok(await p.evaluate(()=>!!document.getElementById('sigCopy')), 'and Copy is still there — the share sheet is additive');

    await p.evaluate(()=>document.getElementById('sigShare').click()); await wait(300);
    const shared=await p.evaluate(()=>window.__shared);
    ok(shared.length===1, `tapping it hands the payload to the share sheet exactly once (${shared.length})`);
    const code=await p.evaluate(()=>document.getElementById('sigOut').value);
    ok(shared[0] && shared[0].text===code,
       shared[0] ? (shared[0].text===code ? `and shares the RAW code, byte-for-byte (${code.length} chars)`
                                          : `WRONG PAYLOAD: shared ${shared[0].text.length} chars vs a ${code.length}-char code`)
                 : 'nothing was handed over');
    ok(shared[0] && !shared[0].title && !shared[0].url,
       'with no title or url wrapped around it — a recipient on an older build must still be able to paste it');

    // a cancelled share rejects; that must not surface as an error
    await p.evaluate(()=>{ navigator.share=function(){ return Promise.reject(new Error('AbortError')); }; });
    await p.evaluate(()=>document.getElementById('sigShare').click()); await wait(400);
    ok(errs.length===0, 'a cancelled share is silent, not an error'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
    await ctx.close(); }

  // ---------- without one, nothing changes
  { const ctx=await b.newContext({viewport:{width:1100,height:900}});
    await ctx.addInitScript(()=>{ try{ delete navigator.share; }catch(e){} 
      try{ Object.defineProperty(navigator,'share',{value:undefined,configurable:true}); }catch(e){} });
    const p=await ctx.newPage();
    await p.goto('file://'+HTML+'?dbg=1'); await wait(500);
    ok(await hostTo(p), 'a host screen comes up on a browser with no share sheet');
    ok(await p.evaluate(()=>!document.getElementById('sigShare')), 'no Send button is offered there');
    ok(await p.evaluate(()=>!!document.getElementById('sigCopy')), 'and Copy is untouched — the flow is unchanged');
    await ctx.close(); }

  /* ---------- the tolerant paste. A code that has been through a chat app arrives with words and newlines
   * around it, so dec() falls back to the longest base64 run. Each case needs its OWN joiner page: a code that
   * is accepted advances past the paste box, which is itself the proof it worked. */
  async function joiner(){
    const p=await (await b.newContext({viewport:{width:390,height:840}})).newPage();
    await p.goto('file://'+HTML+'?dbg=1'); await wait(500);
    await p.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
    await p.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
    await p.evaluate(()=>{ const j=document.getElementById('onJoin'); if(j)j.click(); }); await wait(700);
    return p;
  }
  async function feed(p, text){
    await p.evaluate(t=>{ const box=document.getElementById('sigIn'); if(box) box.value=t;
      const g=document.getElementById('sigGo'); if(g) g.click(); }, text);
    for(let i=0;i<40;i++){
      const st=await p.evaluate(()=>({
        reply: (document.getElementById('sigOut')||{}).value||'',      // advanced to "send your reply back"
        err: (document.querySelector('#netroot .netmsg.err')||{}).textContent||''
      }));
      if(st.reply || st.err) return st;
      await wait(150);
    }
    return { reply:'', err:'' };
  }
  { const h=await (await b.newContext()).newPage();
    await h.goto('file://'+HTML+'?dbg=1'); await wait(500);
    ok(await hostTo(h), 'a third host screen, for a real code to mangle');
    const code=await h.evaluate(()=>document.getElementById('sigOut').value);
    ok(code.length>200, `captured it (${code.length} chars)`);

    /* Accepted is asserted by the joiner PRODUCING A REPLY, not merely by the absence of an error message —
     * an error that never renders would make a weaker assertion pass on a broken build. */
    const wrapped=await feed(await joiner(), 'here you go: '+code+'  \nsee you there');
    ok(wrapped.reply.length>200,
       wrapped.reply.length>200 ? `a code pasted inside a sentence is accepted and produces a real reply (${wrapped.reply.length} chars)`
                                : `rejected: "${(wrapped.err||'(no reply, no error)').slice(0,60)}"`);

    const junk=await feed(await joiner(), 'lol what code');
    ok(/not valid/i.test(junk.err) && !junk.reply,
       junk.err ? `while actual rubbish is still rejected — the tolerance is not a wildcard ("${junk.err.slice(0,44)}")`
                : 'rubbish was NOT rejected — the tolerance is too loose'); }

  await b.close();
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
