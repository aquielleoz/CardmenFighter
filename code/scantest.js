/* QR CAMERA SCANNING (v1.31.19, phase 2). Phase 1 put the invite on screen; this reads one off another screen,
 * which is the half that removes the copy-paste. The point of this suite is that a camera feature is otherwise
 * only checkable by hand, and a feature only checkable by hand rots — three suites in this repo already did.
 *
 * How it is made testable: Chromium can be pointed at a Y4M file INSTEAD of a camera
 * (`--use-file-for-fake-video-capture`), so a frame containing a QR built by our own (reference-verified)
 * encoder is fed in as if held up to the lens. That flag is read at launch, which forces a two-phase run:
 *   1. launch, open a HOST page, take its REAL invite offer, close;
 *   2. write that offer into a Y4M, relaunch with the fake camera, and drive the JOINER through scanning it.
 * A synthetic string would have proved the plumbing; a real offer proves the whole path, because the joiner
 * accepts it and produces a genuine answer. The host being gone by then is fine — createAnswer needs no peer.
 *
 * Run: node scantest.js */
const { chromium } = require('playwright'); const BASE = require('./pwchrome');
const fs=require('fs'), os=require('os'), path=require('path');
const QR=require('./qr.js');
const HTML=path.resolve(__dirname,'CardmenFighter.html');
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const W=1280,H=720;

/* One QR, centred and framed as a person would frame it, repeated as a few identical frames. */
function writeY4M(text, file){
  const q=QR.build(text,'L'), quiet=4, total=q.size+quiet*2;
  const scale=Math.floor(Math.min(W,H)*0.95/total);
  const side=total*scale, ox=(W-side)>>1, oy=(H-side)>>1;
  const Y=Buffer.alloc(W*H,255);
  for(let r=0;r<q.size;r++) for(let c=0;c<q.size;c++){
    if(!q.modules[r][c]) continue;
    for(let dy=0;dy<scale;dy++) for(let dx=0;dx<scale;dx++){
      const y=oy+(r+quiet)*scale+dy, x=ox+(c+quiet)*scale+dx;
      if(y>=0&&y<H&&x>=0&&x<W) Y[y*W+x]=0;
    }
  }
  const U=Buffer.alloc((W>>1)*(H>>1),128), V=Buffer.alloc((W>>1)*(H>>1),128);
  const fr=[]; for(let i=0;i<6;i++) fr.push(Buffer.from('FRAME\n'),Y,U,V);
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F25:1 Ip A1:1 C420mpeg2\n`),...fr]));
  return { version:q.version, modules:q.size, pxPerModule:scale };
}
/* An empty feed, for the paths that must work when there is NOTHING to scan. Without this the Cancel test is
 * a race against the decoder, which reads the code on the first frame. */
function writeBlankY4M(file){
  const Y=Buffer.alloc(W*H,200), U=Buffer.alloc((W>>1)*(H>>1),128), V=Buffer.alloc((W>>1)*(H>>1),128);
  const fr=[]; for(let i=0;i<6;i++) fr.push(Buffer.from('FRAME\n'),Y,U,V);
  fs.writeFileSync(file, Buffer.concat([Buffer.from(`YUV4MPEG2 W${W} H${H} F25:1 Ip A1:1 C420mpeg2\n`),...fr]));
}
const camArgs=file=>['--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',
                     '--use-file-for-fake-video-capture='+file];
async function openHostRtc(page){
  await page.goto('file://'+HTML+'?dbg=1'); await wait(500);
  await page.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
  await page.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
  await page.evaluate(()=>{ const h=document.getElementById('onHost'); if(h)h.click(); });
}
(async()=>{
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'scantest-'));
  const cam=path.join(dir,'cam.y4m');

  // ---------- phase 1: a real invite offer, from a real host page
  let offer='';
  { const b=await chromium.launch(BASE);
    const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
    await openHostRtc(p);
    for(let i=0;i<120;i++){
      offer=await p.evaluate(()=>{ const t=document.getElementById('sigOut'); return t?t.value:''; });
      if(offer) break; await wait(200);
    }
    await b.close(); }
  ok(offer.length>200, `captured a real invite offer from a host page (${offer.length} chars)`);
  if(!offer){ console.log('\nFAIL: cannot continue without an offer'); process.exit(1); }
  const geom=writeY4M(offer, cam);
  ok(true, `and rendered it into a fake camera feed — v${geom.version}, ${geom.modules} modules, ${geom.pxPerModule} camera px per module`);

  // ---------- phase 2: the joiner scans it
  const b=await chromium.launch(Object.assign({}, BASE, { args:camArgs(cam) }));
  const ctx=await b.newContext({ viewport:{width:390,height:820}, permissions:['camera'] });
  const p=await ctx.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(e.message));

  await p.goto('file://'+HTML+'?dbg=1'); await wait(500);
  await p.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
  await p.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
  await p.evaluate(()=>{ const j=document.getElementById('onJoin'); if(j)j.click(); }); await wait(700);
  ok(await p.evaluate(()=>!!document.getElementById('sigIn')), 'the joiner reaches the "paste the invite code" step');

  /* The probe is async and re-renders when it resolves, so poll rather than assuming a frame has passed. */
  let ready=false;
  for(let i=0;i<40;i++){ ready=await p.evaluate(()=>!!document.getElementById('scanBtn')); if(ready) break; await wait(150); }
  ok(ready, 'and offers a Scan button — the capability probe checked qr_code support, not just the constructor');
  ok(await p.evaluate(()=>window.__cmf.scanReady()===true), 'the page agrees scanning is available');
  ok(await p.evaluate(()=>window.__cmf.scanLive()===false), 'no camera is running before the button is pressed');

  await p.evaluate(()=>document.getElementById('scanBtn').click());
  let live=false;
  for(let i=0;i<40;i++){ live=await p.evaluate(()=>window.__cmf.scanLive()); if(live) break; await wait(150); }
  ok(live, 'pressing it starts the camera');
  ok(await p.evaluate(()=>{ const el=document.getElementById('scanPanel'); return !!el && el.classList.contains('open'); }),
     'and opens the viewfinder panel');

  // the decisive one: the code comes off the video and lands in the box
  let got='';
  for(let i=0;i<120;i++){
    got=await p.evaluate(()=>{ const t=document.getElementById('sigIn'); return t?t.value:''; });
    if(got) break; await wait(150);
  }
  ok(got===offer, got ? (got===offer ? `the scanned code is byte-identical to the host's invite (${got.length} chars)`
                                     : `MISMATCH: scanned ${got.length} chars, expected ${offer.length}`)
                      : 'nothing was scanned off the video feed');

  /* A scan advances without a second tap — so the joiner should now be producing its reply. */
  let answered='';
  for(let i=0;i<140;i++){
    answered=await p.evaluate(()=>{ const t=document.getElementById('sigOut'); return t?t.value:''; });
    if(answered) break; await wait(150);
  }
  ok(answered.length>200, `the scan auto-advanced and the joiner produced a real reply (${answered.length} chars) — no second tap`);
  ok(answered!==offer, 'and the reply is its own answer, not an echo of the offer');

  // the camera must not survive a successful scan
  let off=false;
  for(let i=0;i<30;i++){ off=await p.evaluate(()=>window.__cmf.scanLive()===false); if(off) break; await wait(150); }
  ok(off, 'the camera is stopped after a successful scan — no light left on');

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  await b.close();

  /* ---------- pointing at NOTHING: the scanner must sit there patiently, and Cancel must stop it. Tested on a
   * blank feed because the real feed decodes on the first frame, which would make this a race. */
  { const blank=path.join(dir,'blank.y4m'); writeBlankY4M(blank);
    const b3=await chromium.launch(Object.assign({}, BASE, { args:camArgs(blank) }));
    const c3=await b3.newContext({ viewport:{width:390,height:820}, permissions:['camera'] });
    const p3=await c3.newPage(); const errs3=[]; p3.on('pageerror',e=>errs3.push(e.message));
    await p3.goto('file://'+HTML+'?dbg=1'); await wait(500);
    await p3.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
    await p3.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
    await p3.evaluate(()=>{ const j=document.getElementById('onJoin'); if(j)j.click(); }); await wait(700);
    for(let i=0;i<40;i++){ if(await p3.evaluate(()=>!!document.getElementById('scanBtn'))) break; await wait(150); }
    await p3.evaluate(()=>document.getElementById('scanBtn').click());
    let live3=false;
    for(let i=0;i<40;i++){ live3=await p3.evaluate(()=>window.__cmf.scanLive()); if(live3) break; await wait(150); }
    ok(live3, 'with nothing to scan the camera still starts');
    await wait(1500);
    ok(await p3.evaluate(()=>{ const t=document.getElementById('sigIn'); return !t.value; }),
       'and nothing is invented — the paste box stays empty while it finds no code');
    ok(await p3.evaluate(()=>window.__cmf.scanLive()===true), 'it keeps looking rather than giving up or crashing');
    await p3.evaluate(()=>document.getElementById('scanCancel').click());
    ok(await p3.evaluate(()=>window.__cmf.scanLive()===false), 'Cancel stops the camera');
    ok(await p3.evaluate(()=>{ const el=document.getElementById('scanPanel'); return !!el && !el.classList.contains('open'); }),
       'and closes the viewfinder');
    ok(errs3.length===0,'no JS errors on the nothing-to-scan path'+(errs3.length?': '+errs3.slice(0,2).join(' | '):''));
    await b3.close(); }

  // ---------- and the graceful absence: no BarcodeDetector, no button, paste still works
  { const b2=await chromium.launch(BASE);
    const c2=await b2.newContext({viewport:{width:390,height:820}});
    await c2.addInitScript(()=>{ try{ delete window.BarcodeDetector; }catch(e){ window.BarcodeDetector=undefined; } });
    const p2=await c2.newPage();
    await p2.goto('file://'+HTML+'?dbg=1'); await wait(500);
    await p2.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
    await p2.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
    await p2.evaluate(()=>{ const j=document.getElementById('onJoin'); if(j)j.click(); }); await wait(900);
    ok(await p2.evaluate(()=>!document.getElementById('scanBtn')), 'with no BarcodeDetector the Scan button is not offered');
    ok(await p2.evaluate(()=>!!document.getElementById('sigIn')), 'and the paste box is still there — the feature is strictly additive');
    await b2.close(); }

  try{ fs.rmSync(dir,{recursive:true,force:true}); }catch(e){}
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
