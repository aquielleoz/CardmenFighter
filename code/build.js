/* Build the self-contained CardmenFighter.html from the template + engine + AI. */
const fs = require('fs');
const tpl = fs.readFileSync('CardmenFighter.template.html', 'utf8');
const eng = fs.readFileSync('engine.js', 'utf8');
const ai  = fs.readFileSync('ai.js', 'utf8');
const art = fs.existsSync('art.js') ? fs.readFileSync('art.js', 'utf8') : 'window.CardArt = {};';   // raw illustrations — hand/pile card thumbnails
const faces = 'window.CardFace = {};';   // LAYOUTS RETIRED (v0.95) — the game uses raw art everywhere; faces.js is no longer inlined (saves ~435KB)
const netview = fs.readFileSync('netview.js', 'utf8');   // per-seat redacted snapshots for netplay
const qr = fs.readFileSync('qr.js', 'utf8');              // hand-written QR encoder — netplay invites as a scannable code
if (!tpl.includes('__ENGINE__') || !tpl.includes('__AI__') || !tpl.includes('__ART__') || !tpl.includes('__FACES__') || !tpl.includes('__NETVIEW__') || !tpl.includes('__QR__')) { console.error('template missing placeholders'); process.exit(1); }
const out = tpl.replace('__ENGINE__', eng).replace('__AI__', ai).replace('__ART__', () => art).replace('__FACES__', () => faces).replace('__QR__', () => qr).replace('__NETVIEW__', () => netview);
if (out.includes('__ENGINE__') || out.includes('__AI__') || out.includes('__ART__') || out.includes('__FACES__') || out.includes('__NETVIEW__') || out.includes('__QR__')) { console.error('placeholder left unreplaced'); process.exit(1); }
// SYNTAX GATE: parse every inlined <script> before writing. build.js used to check only that the
// placeholders were replaced, so a typo in the template (e.g. a missing comma in the LESSONS array)
// shipped a page whose whole script failed to parse — a blank, dead game that every UI test then
// reported as a pile of unrelated failures. Fail loudly here instead.
const vm = require('vm');
const scripts = out.match(/<script>([\s\S]*?)<\/script>/g) || [];
scripts.forEach(function (block, i) {
  const code = block.replace(/^<script>/, '').replace(/<\/script>$/, '');
  try { new vm.Script(code, { filename: 'inlined-script-' + i + '.js' }); }
  catch (e) {
    console.error('SYNTAX ERROR in inlined script #' + i + ' — NOT written:\n  ' + e.message);
    if (e.stack) console.error(String(e.stack).split('\n').slice(0, 4).join('\n'));
    process.exit(1);
  }
});
fs.writeFileSync('CardmenFighter.html', out);
console.log('built CardmenFighter.html —', out.length, 'bytes (self-contained,', scripts.length, 'script block(s) parsed OK)');
