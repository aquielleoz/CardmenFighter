/* Validate the transport primitive: can two tabs exchange messages via BroadcastChannel,
 * both when the page is SERVED over http and when opened as a file:// URL?
 * Decides whether the local two-client rehearsal can use BroadcastChannel. */
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

function serve(dir, port){
  const srv = http.createServer((req,res)=>{
    let p = path.join(dir, req.url==='/'?'/probe.html':req.url.split('?')[0]);
    fs.readFile(p,(e,buf)=>{ if(e){res.writeHead(404);res.end('nf');} else {res.writeHead(200,{'Content-Type':'text/html'});res.end(buf);} });
  });
  return new Promise(r=>srv.listen(port,()=>r(srv)));
}

const PROBE = `<!doctype html><meta charset=utf8><body><script>
  window.__bc = new BroadcastChannel('probe-room');
  window.__got = [];
  window.__bc.onmessage = e => { window.__got.push(e.data); };
  window.__send = m => window.__bc.postMessage(m);
</script></body>`;

(async()=>{
  const dir='/tmp/nettest'; fs.mkdirSync(dir,{recursive:true}); fs.writeFileSync(path.join(dir,'probe.html'),PROBE);
  const browser = await chromium.launch({ executablePath:'/opt/pw-browsers/chromium' });

  async function trial(label, url1, url2){
    const ctx = await browser.newContext();
    const a = await ctx.newPage(); await a.goto(url1);
    const b = await ctx.newPage(); await b.goto(url2);
    await a.waitForTimeout(150);
    await a.evaluate(()=>window.__send({from:'A',n:1}));
    await b.evaluate(()=>window.__send({from:'B',n:2}));
    await a.waitForTimeout(250);
    const aGot = await a.evaluate(()=>window.__got);
    const bGot = await b.evaluate(()=>window.__got);
    console.log(label);
    console.log('  A received:', JSON.stringify(aGot));
    console.log('  B received:', JSON.stringify(bGot));
    const ok = aGot.some(m=>m.from==='B') && bGot.some(m=>m.from==='A');
    console.log('  cross-tab delivery:', ok ? 'WORKS ✓' : 'FAILS ✗');
    await ctx.close();
    return ok;
  }

  const srv = await serve(dir, 8199);
  await trial('[served http://] same context, two tabs', 'http://localhost:8199/probe.html', 'http://localhost:8199/probe.html');

  const fileUrl = 'file://'+path.join(dir,'probe.html');
  await trial('[file://] same context, two tabs', fileUrl, fileUrl);

  // also: two SEPARATE contexts over http (simulates two independent browser windows/incognito)
  const ctxA = await browser.newContext(); const pa = await ctxA.newPage(); await pa.goto('http://localhost:8199/probe.html');
  const ctxB = await browser.newContext(); const pb = await ctxB.newPage(); await pb.goto('http://localhost:8199/probe.html');
  await pa.waitForTimeout(150);
  await pa.evaluate(()=>window.__send({from:'A',n:1})); await pb.evaluate(()=>window.__send({from:'B',n:2}));
  await pa.waitForTimeout(250);
  const aG=await pa.evaluate(()=>window.__got), bG=await pb.evaluate(()=>window.__got);
  console.log('[served http://] SEPARATE contexts (two windows)');
  console.log('  cross delivery:', (aG.some(m=>m.from==='B')&&bG.some(m=>m.from==='A'))?'WORKS ✓':'FAILS ✗ (expected — contexts are isolated)');

  await browser.close(); srv.close();
})();
