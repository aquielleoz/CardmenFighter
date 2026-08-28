/* THE QR ENCODER, VERIFIED BY DECODING ITS OWN OUTPUT (v1.31.17).
 * `qr.js` is hand-written because the game has zero runtime dependencies and vendoring a library would be the
 * first exception. That is only a defensible choice with THIS test: every case renders a real symbol and then
 * decodes it with the browser's BarcodeDetector, asserting the string comes back byte-identical. A subtly wrong
 * QR — one bad mask, one mis-tabulated block layout — looks perfectly fine to a human and fails in someone
 * else's camera, so eyeballing it proves nothing.
 *
 * It also asserts the thing that decides whether this feature works at all: the REAL netplay invite code fits
 * in one symbol. That was 1,036 chars when measured headless with STUN on, and a machine with more network
 * interfaces will produce a longer offer — so the length is asserted here rather than discovered in someone's
 * hand.
 * Run: node qrtest.js */
const { chromium } = require('playwright'); const LAUNCH = require('./pwchrome'); const path=require('path');
const URL='file://'+path.resolve(__dirname,'CardmenFighter.html')+'?dbgsolo=1';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
  const b=await chromium.launch(LAUNCH);
  const p=await (await b.newContext({viewport:{width:1100,height:900}})).newPage();
  const errs=[]; p.on('pageerror',e=>errs.push(e.message));
  let pass=0,fail=0; const ok=(c,m)=>{console.log((c?'✓':'✗')+' '+m);c?pass++:fail++;};
  await p.goto(URL); await wait(600);

  ok(await p.evaluate(()=>typeof CardmenQR!=='undefined'), 'the QR encoder is inlined in the page');
  const hasDetector=await p.evaluate(()=>typeof window.BarcodeDetector!=='undefined');
  ok(hasDetector, 'BarcodeDetector is available, so the encoder can be checked against a real decoder');

  /* Render `text` into a canvas and decode that canvas. Returns what the decoder read, so a mismatch shows the
   * actual bytes rather than just "false". */
  const roundTrip = (text, level) => p.evaluate(async a=>{
    let cv=document.getElementById('qrProbe');
    if(!cv){ cv=document.createElement('canvas'); cv.id='qrProbe'; document.body.appendChild(cv); }
    const info=CardmenQR.toCanvas(cv, a.text, { px:520, level:a.level, quiet:4 });
    const det=new BarcodeDetector({ formats:['qr_code'] });
    const bmp=await createImageBitmap(cv);
    const found=await det.detect(bmp);
    return { got: found.length ? found[0].rawValue : null, n: found.length, version: info.version, size: info.size, mask: info.mask };
  }, {text, level});

  // --- a spread of lengths and versions, each decoded back
  const cases=[
    ['x', 'L', 'one character'],
    ['HELLO WORLD', 'M', 'a short string'],
    ['Cardmen Fighter — ♦♥♣♠ 2 is the apex', 'M', 'multi-byte UTF-8 (suits and an em dash)'],
    ['A'.repeat(120), 'Q', '120 chars at ECC Q'],
    ['B'.repeat(700), 'L', '700 chars — a mid-size symbol'],
  ];
  for(const [text, level, label] of cases){
    const r=await roundTrip(text, level);
    ok(r.got===text, `${label}: round-trips through a real decoder (v${r.version}, mask ${r.mask}${r.got===text?'':', got '+JSON.stringify((r.got||'').slice(0,40))})`);
  }

  // --- a pseudo-random payload, because structured text can hide bit-order bugs
  const rnd=await p.evaluate(async ()=>{
    let s=''; let x=12345;
    for(let i=0;i<400;i++){ x=(x*1103515245+12345)&0x7fffffff; s+=String.fromCharCode(33+(x%94)); }
    let cv=document.getElementById('qrProbe');
    const info=CardmenQR.toCanvas(cv, s, { px:520, level:'M', quiet:4 });
    const det=new BarcodeDetector({ formats:['qr_code'] });
    const found=await det.detect(await createImageBitmap(cv));
    return { same: found.length? found[0].rawValue===s : false, version: info.version };
  });
  ok(rnd.same, `400 pseudo-random printable chars round-trip (v${rnd.version}) — catches bit-order and interleave bugs`);

  // --- THE case this feature exists for: a real netplay invite code
  const inv=await p.evaluate(()=>{
    // build the same payload shape the host sends: {"t":"offer","s":<sdp>} base64'd
    const sdp='v=0\r\no=- 7207630775883609314 2 IN IP4 127.0.0.1\r\ns=-\r\nt=0 0\r\n'+
      'a=group:BUNDLE 0\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\nc=IN IP4 0.0.0.0\r\n'+
      ('a=candidate:842163049 1 udp 1677729535 203.0.113.7 54321 typ srflx raddr 192.168.1.20 rport 54321 generation 0 network-cost 999\r\n'.repeat(6))+
      'a=ice-ufrag:AbCd\r\na=ice-pwd:0123456789abcdef0123456789\r\na=fingerprint:sha-256 '+
      Array.from({length:32},(_,i)=>('0'+((i*7)%256).toString(16)).slice(-2).toUpperCase()).join(':')+'\r\n'+
      'a=setup:actpass\r\na=mid:0\r\na=sctp-port:5000\r\n';
    return btoa(JSON.stringify({t:'offer', s:sdp}));
  });
  console.log('   (synthetic invite payload: '+inv.length+' chars)');
  const ir=await roundTrip(inv, 'L');
  ok(ir.got===inv, `a full netplay invite round-trips in ONE symbol (${inv.length} chars → v${ir.version}, ${ir.size}×${ir.size} modules)`);
  ok(ir.version<=40, 'and it stays inside the version-40 ceiling — no multi-part QR needed');

  // --- the guard that tells us if the payload ever outgrows a single symbol
  const cap=await p.evaluate(()=>CardmenQR.capacityBytes('L'));
  ok(cap>=2900, `single-symbol capacity at ECC L is ${cap} bytes — the invite must stay under this`);
  const over=await p.evaluate(()=>{ try{ CardmenQR.build('Z'.repeat(4000),'L'); return 'no-throw'; }catch(e){ return 'threw'; } });
  ok(over==='threw', 'an over-long payload throws instead of rendering a silently corrupt symbol');

  // --- the UI actually paints one on the invite screen
  await p.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
  await p.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
  await p.evaluate(()=>{ const h=document.getElementById('onHost'); if(h)h.click(); });
  let painted=false, box=null;
  for(let i=0;i<120;i++){
    box=await p.evaluate(()=>{
      const cv=document.getElementById('qrInvite'), t=document.getElementById('sigOut');
      if(!cv||!t||!t.value) return null;
      return { w:cv.width, h:cv.height, codeLen:t.value.length };
    });
    if(box && box.w>0){ painted=true; break; }
    await wait(200);
  }
  ok(painted, 'the host invite screen paints a QR canvas'+(box?` (${box.w}×${box.h}px for a ${box.codeLen}-char code)`:''));
  if(box) ok(box.codeLen<2900, `the REAL invite code is ${box.codeLen} chars — inside the single-symbol ceiling`);

  /* SCANNABILITY, which decoding the bitmap cannot tell us — the decoder is handed a perfect bitmap and will
   * read a symbol far too small for any real camera. What a camera actually needs is PHYSICAL size (CSS px per
   * module) plus crisp edges (a whole number of device px per module). The 1,036-char invite is version 23 =
   * 109 modules, so both are tight, and if the payload ever grows past ~v29 this is what says so.
   * These run at the suite's 1100×900 viewport, where the symbol is NOT capped. The short-viewport cap added
   * in v1.31.47 is asserted separately below, in both directions. */
  let geomTall=null;
  if(painted){
    const geom=await p.evaluate(()=>{
      const cv=document.getElementById('qrInvite');
      const info=CardmenQR.build(document.getElementById('sigOut').value,'L');
      const total=info.size+8;                                  // a 4-module quiet zone on each side
      const dpr=window.devicePixelRatio||1, cssW=parseFloat(cv.style.width)||0;
      return { devPerModule: cv.width/total, cssPerModule: cssW/total, cssW, bitmap: cv.width,
               modules: info.size, version: info.version, dpr };
    });
    ok(geom.cssPerModule>=2.5, `each module is ${geom.cssPerModule.toFixed(2)} CSS px — physically big enough for a camera (v${geom.version}, ${geom.modules} modules)`);
    ok(Number.isInteger(geom.devPerModule) && geom.devPerModule>=2,
       `and a whole ${geom.devPerModule} device px per module — no fractional scaling to smear the edges`);
    ok(Math.abs(geom.cssW*geom.dpr - geom.bitmap)<1.5, `the CSS size maps 1:1 onto the bitmap (${geom.cssW}css × ${geom.dpr}dpr = ${geom.bitmap}px)`);
    geomTall=geom;
  }
  if(painted){
    const live=await p.evaluate(async ()=>{
      const cv=document.getElementById('qrInvite'), t=document.getElementById('sigOut');
      const det=new BarcodeDetector({ formats:['qr_code'] });
      const found=await det.detect(await createImageBitmap(cv));
      return found.length ? (found[0].rawValue===t.value) : false;
    });
    ok(live, 'and THAT canvas decodes back to the exact invite code a player would paste');
  }

  /* THE SHORT-VIEWPORT CAP (v1.31.47), asserted in BOTH directions — a cap that fired everywhere would be a
   * silent shrink of the desktop symbol, and a cap that never fired would leave the landscape phone exactly
   * where it was. Neither failure is visible from a single measurement, which is why this compares the two. */
  {
    const land=await (await b.newContext({viewport:{width:915,height:412},deviceScaleFactor:2})).newPage();
    await land.goto(URL); await wait(600);
    await land.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
    await land.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
    await land.evaluate(()=>{ const h=document.getElementById('onHost'); if(h)h.click(); });
    await land.waitForFunction(()=>{const cv=document.getElementById('qrInvite'); return cv&&cv.width>0;},{timeout:30000}).catch(()=>{});
    const g=await land.evaluate(()=>{
      const cv=document.getElementById('qrInvite');
      const info=CardmenQR.build(document.getElementById('sigOut').value,'L'), total=info.size+8;
      return { css:(parseFloat(cv.style.width)||0)/total, dev:cv.width/total,
               frac:(parseFloat(cv.style.height)||0)/window.innerHeight };
    });
    ok(g.css>=2.5, 'a landscape phone still clears the camera floor ('+g.css.toFixed(2)+' CSS px per module)');
    ok(g.css<=4, '  → but is CAPPED rather than filling the screen — it reached 4.6 before, and pushed Copy off');
    ok(Number.isInteger(g.dev) && g.dev>=2, '  → and keeps a whole '+g.dev+' device px per module, which is what a camera needs');
    ok(g.frac<=0.55, '  → taking '+Math.round(g.frac*100)+'% of the viewport height, not the 64% it took before');
    /* the negative half: the cap must NOT reach a viewport with height to spare. */
    ok(!!geomTall && geomTall.cssPerModule>g.css+1,
       'and a tall viewport is untouched — '+(geomTall?geomTall.cssPerModule.toFixed(2):'0')+' CSS px per module there, so the cap is not a global shrink');
    /* TWO COLUMNS (v1.31.48) — the thing that actually gets Copy above the fold. Capping the QR bought height
     * back and still left the button underneath, because the pair was stacked. Assert all three are on screen
     * AT ONCE: any one of them alone was already true before. */
    /* Scroll to the invite block first, the way a host reaches it — it sits below the deck picker, so
     * measuring at scroll 0 tests the page length, not the layout. The scroll-INDEPENDENT claim is asserted
     * too: the pair must FIT in the viewport height at all, which stacked it did not.  */
    await land.evaluate(()=>{const e=document.querySelector(".sigPair"); if(e) e.scrollIntoView({block:"center"});});
    await wait(400);
    const seen=await land.evaluate(()=>{
      const pair=document.querySelector('.sigPair');
      const on=el=>{ if(!el) return false; const r=el.getBoundingClientRect(); return r.top>=0 && r.bottom<=innerHeight; };
      return { flex: !!pair && getComputedStyle(pair).display==='flex',
               qr:on(document.getElementById('qrInvite')), box:on(document.getElementById('sigOut')),
               copy:on(document.getElementById('sigCopy')) };
    });
    const fits=await land.evaluate(()=>{ const p=document.querySelector('.sigPair');
      return !!p && p.getBoundingClientRect().height<=window.innerHeight; });
    ok(seen.flex, 'the QR and the code sit side by side in landscape, where width is the abundant axis');
    ok(seen.qr && seen.box && seen.copy,
       '  → and the QR, the code box AND Copy are all on screen at once (qr '+seen.qr+', box '+seen.box+', copy '+seen.copy+')');
    ok(fits, '  → and the whole pair FITS the viewport height, which stacked it did not');
    /* THE RATCHET GUARD. qrInto measures .qrWrap, so a shrink-to-fit column would feed the canvas's own width
     * back in and shrink the symbol a little on every reflow. The column has a definite basis to stop that;
     * this proves it by reflowing twice and checking the size holds. */
    const s1=await land.evaluate(()=>parseFloat(document.getElementById('qrInvite').style.width)||0);
    await land.setViewportSize({width:916,height:412}); await wait(400);
    await land.setViewportSize({width:915,height:412}); await wait(400);
    const s2=await land.evaluate(()=>parseFloat(document.getElementById('qrInvite').style.width)||0);
    ok(Math.abs(s1-s2)<1, '  → and the symbol does not ratchet smaller across reflows ('+Math.round(s1)+' then '+Math.round(s2)+' CSS px)');
    await land.context().close();
  }

  /* ROTATION (v1.31.47). THE CASE A PERSON ACTUALLY HITS: you open the game, then you turn the phone sideways
   * to show someone the code. The symbol is sized once at draw time, so before this it kept its PORTRAIT size
   * in landscape — 85% of the screen, worse than a page that loads in landscape, and the short-viewport cap
   * could not help because at draw time the viewport was still tall. Aj, on a build with the cap: "no
   * difference really for me", which is exactly what a fix aimed at the wrong configuration looks like.
   * Asserted in BOTH directions: rotating back must restore the portrait size, or this is a one-way shrink. */
  {
    const rot=await (await b.newContext({viewport:{width:412,height:915},deviceScaleFactor:2})).newPage();
    await rot.goto(URL); await wait(600);
    await rot.evaluate(()=>{ const n=document.getElementById('newBtn'); if(n)n.click(); }); await wait(300);
    await rot.evaluate(()=>{ const o=document.getElementById('onlineBtn'); if(o)o.click(); }); await wait(300);
    await rot.evaluate(()=>{ const h=document.getElementById('onHost'); if(h)h.click(); });
    await rot.waitForFunction(()=>{const cv=document.getElementById('qrInvite'); return cv&&cv.width>0;},{timeout:30000}).catch(()=>{});
    const read=()=>rot.evaluate(()=>{
      const cv=document.getElementById('qrInvite');
      const info=CardmenQR.build(document.getElementById('sigOut').value,'L'), total=info.size+8;
      const w=parseFloat(cv.style.width)||0;
      return { css:w, per:w/total, dev:cv.width/total, frac:w/window.innerHeight };
    });
    const port=await read();
    await rot.setViewportSize({width:915,height:412}); await wait(700);
    const land=await read();
    ok(land.css<port.css, 'turning the phone sideways RE-RENDERS the QR ('+Math.round(port.css)+' -> '+Math.round(land.css)+' CSS px)');
    ok(land.frac<=0.55, '  → so it takes '+Math.round(land.frac*100)+'% of the landscape screen, not the 85% a stale portrait symbol took');
    ok(land.per>=2.5 && Number.isInteger(land.dev), '  → and is still scannable: '+land.per.toFixed(2)+' CSS px and a whole '+land.dev+' device px per module');
    await rot.setViewportSize({width:412,height:915}); await wait(700);
    const back=await read();
    ok(Math.abs(back.css-port.css)<1, '  → and rotating back restores the portrait size, so it is not a one-way shrink');
    await rot.context().close();
  }

  ok(errs.length===0,'no JS errors'+(errs.length?': '+errs.slice(0,2).join(' | '):''));
  console.log('\n'+(fail?'FAIL':'PASS')+': '+pass+'  FAIL: '+fail);
  await b.close(); process.exit(fail?1:0);
})().catch(e=>{console.error('HARNESS ERROR',e);process.exit(2);});
