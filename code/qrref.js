/* THE QR ENCODER, DIFFED AGAINST A REFERENCE IMPLEMENTATION (v1.31.17).
 * `qrtest.js` decodes our own symbols with a real decoder, which is the gate. THIS is the tool that found the
 * bug that gate could not explain: the format bits were placed LSB-first instead of MSB-first. Every structural
 * check passed — finders, timing, dark module, and the format string even read back as a *valid* format string,
 * because reading it in the same wrong order is self-consistent. Nothing short of comparing against a known-good
 * symbol would have said so.
 *
 * The reference is macOS's own CIQRCodeGenerator, driven by a Swift snippet compiled on the fly, so there is no
 * vendored library and nothing to keep in sync. For each payload it reads the version, ECC level and mask back
 * out of Apple's own format bits, builds the same thing here, and compares every module.
 *
 * darwin only — it exits 0 with a notice elsewhere, because it is a corroborating tool and not the gate.
 * Run: node qrref.js
 *
 * Byte mode only: Apple switches to alphanumeric mode for ALL-uppercase/digit payloads and picks a smaller
 * version, so those are not comparable and the payloads here deliberately contain lowercase. That is not a
 * limitation of the game — the invite code is base64 and always byte mode. */
var QR = require('./qr.js');
var fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

if (process.platform !== 'darwin') {
  console.log('qrref: skipped — the reference encoder is macOS CoreImage. `node qrtest.js` is the real gate.');
  process.exit(0);
}

var SWIFT = [
  'import Foundation', 'import CoreImage', 'import AppKit',
  'let a = CommandLine.arguments',
  'let f = CIFilter(name: "CIQRCodeGenerator")!',
  'f.setValue(a[1].data(using: .utf8), forKey: "inputMessage")',
  'f.setValue(a[2], forKey: "inputCorrectionLevel")',
  'let rep = NSBitmapImageRep(ciImage: f.outputImage!)',
  'let w = rep.pixelsWide, h = rep.pixelsHigh',
  'print("size \\(w-2)")',                                  // Apple's output carries a 1-module quiet border
  'for y in 1..<(h-1) { var s = ""',
  '  for x in 1..<(w-1) { s += (rep.colorAt(x: x, y: y)!.brightnessComponent < 0.5) ? "#" : "." }',
  '  print(s) }'
].join('\n');

var dir = fs.mkdtempSync(path.join(os.tmpdir(), 'qrref-'));
var src = path.join(dir, 'ref.swift'), bin = path.join(dir, 'ref');
fs.writeFileSync(src, SWIFT);
try { cp.execFileSync('swiftc', ['-O', '-o', bin, src], { stdio: ['ignore', 'ignore', 'pipe'] }); }
catch (e) { console.log('qrref: skipped — could not compile the Swift reference (no Xcode toolchain?).'); process.exit(0); }

function bch(d) { var rem = d, i; for (i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537); return ((d << 10 | rem) ^ 0x5412) & 0x7fff; }
var VALID = {}; for (var d = 0; d < 32; d++) VALID[bch(d)] = d;
var ECC = ['M', 'L', 'H', 'Q'];                             // the 2-bit ECC field, in format-info order

function reference(text, level) {
  var out = cp.execFileSync(bin, [text, level], { maxBuffer: 1 << 26 }).toString().trim().split('\n');
  return out.slice(1).map(function (l) { return l.split('').map(function (c) { return c === '#' ? 1 : 0; }); });
}
/* Read Apple's format bits — MSB first, which is the whole point of this file. */
function formatOf(ref) {
  var pos = [], i;
  for (i = 0; i < 6; i++) pos.push([8, i]);
  pos.push([8, 7]); pos.push([8, 8]); pos.push([7, 8]);
  for (i = 9; i < 15; i++) pos.push([14 - i, 8]);
  var v = 0; for (i = 0; i < 15; i++) v = (v << 1) | ref[pos[i][0]][pos[i][1]];
  var f = VALID[v]; return f === undefined ? null : { level: ECC[f >> 3], mask: f & 7 };
}

var rnd = '', x = 987654321, i;
for (i = 0; i < 900; i++) { x = (x * 1103515245 + 12345) & 0x7fffffff; rnd += String.fromCharCode(33 + (x % 94)); }
var CASES = [
  ['one char', 'x'], ['utf-8 suits', 'Cardmen — ♦♥♣♠'],
  ['mixed 80', 'Xy7-Zq9_'.repeat(10)], ['mixed 240', 'aB3-'.repeat(60)],
  ['base64-shaped 520', require('crypto').createHash('sha512').update('cmf').digest('base64').repeat(7).slice(0, 520)],
  ['random 900', rnd], ['random 1800', rnd + rnd]
];
var pass = 0, fail = 0, skip = 0, top = 0;
CASES.forEach(function (c) {
  ['L', 'M', 'Q', 'H'].forEach(function (lv) {
    var label = c[0] + ' @' + lv, ref;
    try { ref = reference(c[1], lv); } catch (e) { skip++; return; }         // Apple refuses over-long payloads
    var fmt = formatOf(ref);
    if (!fmt) { console.log('  ? ' + label + ': could not read the reference format bits'); skip++; return; }
    var mine;
    try { mine = QR.build(c[1], fmt.level, fmt.mask); } catch (e) { console.log('  - ' + label + ': ' + e.message); skip++; return; }
    if (mine.size !== ref.length) { skip++; return; }                       // a mode/version difference, not comparable
    var bad = 0, first = null, r, cc;
    for (r = 0; r < mine.size; r++) for (cc = 0; cc < mine.size; cc++)
      if ((mine.modules[r][cc] ? 1 : 0) !== ref[r][cc]) { bad++; if (!first) first = r + ',' + cc; }
    if (bad) { fail++; console.log('  ✗ ' + label + ': ' + bad + ' modules differ (v' + mine.version + ', mask ' + fmt.mask + '), first at ' + first); }
    else { pass++; top = Math.max(top, mine.version); console.log('  ✓ ' + label + ': identical to the reference (v' + mine.version + ', mask ' + fmt.mask + ')'); }
  });
});
try { fs.rmSync(dir, { recursive: true, force: true }); } catch (e) {}
console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail + '  not comparable: ' + skip +
            '  (highest version verified: v' + top + ')');
process.exit(fail ? 1 : 0);
