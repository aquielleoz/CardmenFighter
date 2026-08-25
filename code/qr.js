/* QR encoder — byte mode, versions 1-40, ECC level L/M/Q/H. Hand-written on purpose: the game is a single
 * self-contained file with zero runtime dependencies, and vendoring a library would be the first exception.
 * That is only a safe choice because the encoder is SELF-VERIFYING — `qrtest.js` renders a symbol and decodes
 * its own output with the browser's BarcodeDetector, asserting the string round-trips. A subtly wrong QR looks
 * perfectly fine to a human, so that test is the entire safety argument for writing this by hand.
 *
 * Why it exists: netplay invites are a ~1,036-character code that players currently copy, paste and message to
 * each other. A single QR holds ~2,953 bytes, so the invite fits with ~2.8x headroom — a phone can just scan
 * the host's screen.
 *
 * Plain ES5 in an IIFE, exported as module.exports AND a global, exactly like engine.js/netview.js, because it
 * has to run identically in node and inlined in a <script> tag. */
(function () {
  'use strict';

  // ---- GF(256) arithmetic for Reed-Solomon (primitive polynomial 0x11d) -------------------------------
  var EXP = new Array(512), LOG = new Array(256);
  (function () {
    var x = 1;
    for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 0x100) x ^= 0x11d; }
    for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
  })();
  function gmul(a, b) { return (a === 0 || b === 0) ? 0 : EXP[LOG[a] + LOG[b]]; }

  // generator polynomial for `deg` EC codewords
  function rsGen(deg) {
    var p = [1];
    for (var i = 0; i < deg; i++) {
      var np = new Array(p.length + 1); for (var k = 0; k < np.length; k++) np[k] = 0;
      for (var j = 0; j < p.length; j++) { np[j] ^= gmul(p[j], 1); np[j + 1] ^= gmul(p[j], EXP[i]); }
      p = np;
    }
    return p;
  }
  function rsEncode(data, ecLen) {
    var gen = rsGen(ecLen), res = new Array(ecLen);
    for (var i = 0; i < ecLen; i++) res[i] = 0;
    for (i = 0; i < data.length; i++) {
      var factor = data[i] ^ res[0];
      res.shift(); res.push(0);
      if (factor !== 0) for (var j = 0; j < gen.length - 1; j++) res[j] ^= gmul(gen[j + 1], factor);
    }
    return res;
  }

  /* ---- capacity tables -------------------------------------------------------------------------------
   * Per version 1..40: total data codewords for each ECC level, then the block layout as
   * [ecCodewordsPerBlock, group1Blocks, group2Blocks]. group2 blocks each hold one MORE data codeword than
   * group1 — that asymmetry is the part everyone gets wrong, so it is derived rather than tabulated. */
  var DATA_CW = {   // total DATA codewords, index by [version-1], per level
    L: [19,34,55,80,108,136,156,194,232,274,324,370,428,461,523,589,647,721,795,861,932,1006,1094,1174,1276,1370,1468,1531,1631,1735,1843,1955,2071,2191,2306,2434,2566,2702,2812,2956],
    M: [16,28,44,64,86,108,124,154,182,216,254,290,334,365,415,453,507,563,627,669,714,782,860,914,1000,1062,1128,1193,1267,1373,1455,1541,1631,1725,1812,1914,1992,2102,2216,2334],
    Q: [13,22,34,48,62,76,88,110,132,154,180,206,244,261,295,325,367,397,445,485,512,568,614,664,718,754,808,871,911,985,1033,1115,1171,1231,1286,1354,1426,1502,1582,1666],
    H: [9,16,26,36,46,60,66,86,100,122,140,158,180,197,223,253,283,313,341,385,406,442,464,514,538,596,628,661,701,745,793,845,901,961,986,1054,1096,1142,1222,1276]
  };
  var BLOCKS = {   // [ecPerBlock, group1Blocks, group2Blocks] per version
    L: [[7,1,0],[10,1,0],[15,1,0],[20,1,0],[26,1,0],[18,2,0],[20,2,0],[24,2,0],[30,2,0],[18,2,2],[20,4,0],[24,2,2],[26,4,0],[30,3,1],[22,5,1],[24,5,1],[28,1,5],[30,5,1],[28,3,4],[28,3,5],[28,4,4],[28,2,7],[30,4,5],[30,6,4],[26,8,4],[28,10,2],[30,8,4],[30,3,10],[30,7,7],[30,5,10],[30,13,3],[30,17,0],[30,17,1],[30,13,6],[30,12,7],[30,6,14],[30,17,4],[30,4,18],[30,20,4],[30,19,6]],
    M: [[10,1,0],[16,1,0],[26,1,0],[18,2,0],[24,2,0],[16,4,0],[18,4,0],[22,2,2],[22,3,2],[26,4,1],[30,1,4],[22,6,2],[22,8,1],[24,4,5],[24,5,5],[28,7,3],[28,10,1],[26,9,4],[26,3,11],[26,3,13],[26,17,0],[28,17,0],[28,4,14],[28,6,14],[28,8,13],[28,19,4],[28,22,3],[28,3,23],[28,21,7],[28,19,10],[28,2,29],[28,10,23],[28,14,21],[28,14,23],[28,12,26],[28,6,34],[28,29,14],[28,13,32],[28,40,7],[28,18,31]],
    Q: [[13,1,0],[22,1,0],[18,2,0],[26,2,0],[18,2,2],[24,4,0],[18,2,4],[22,4,2],[20,4,4],[24,6,2],[28,4,4],[26,4,6],[24,8,4],[20,11,5],[30,5,7],[24,15,2],[28,1,15],[28,17,1],[26,17,4],[30,15,5],[28,17,6],[30,7,16],[30,11,14],[30,11,16],[30,7,22],[28,28,6],[30,8,26],[30,4,31],[30,1,37],[30,15,25],[30,42,1],[30,10,35],[30,29,19],[30,44,7],[30,39,14],[30,46,10],[30,49,10],[30,48,14],[30,43,22],[30,34,34]],
    H: [[17,1,0],[28,1,0],[22,2,0],[16,4,0],[22,2,2],[28,4,0],[26,4,1],[26,4,2],[24,4,4],[28,6,2],[24,3,8],[28,7,4],[22,12,4],[24,11,5],[24,11,7],[30,3,13],[28,2,17],[28,2,19],[26,9,16],[28,15,10],[30,19,6],[24,34,0],[30,16,14],[30,30,2],[30,22,13],[30,33,4],[30,12,28],[30,11,31],[30,19,26],[30,23,25],[30,23,28],[30,19,35],[30,11,46],[30,59,1],[30,22,41],[30,2,64],[30,24,46],[30,42,32],[30,10,67],[30,20,61]]
  };
  // alignment-pattern centre coordinates per version (v1 has none)
  var ALIGN = [[],[6,18],[6,22],[6,26],[6,30],[6,34],[6,22,38],[6,24,42],[6,26,46],[6,28,50],[6,30,54],[6,32,58],[6,34,62],[6,26,46,66],[6,26,48,70],[6,26,50,74],[6,30,54,78],[6,30,56,82],[6,30,58,86],[6,34,62,90],[6,28,50,72,94],[6,26,50,74,98],[6,30,54,78,102],[6,28,54,80,106],[6,32,58,84,110],[6,30,58,86,114],[6,34,62,90,118],[6,26,50,74,98,122],[6,30,54,78,102,126],[6,26,52,78,104,130],[6,30,56,82,108,134],[6,34,60,86,112,138],[6,30,58,86,114,142],[6,34,62,90,118,146],[6,30,54,78,102,126,150],[6,24,50,76,102,128,154],[6,28,54,80,106,132,158],[6,32,58,84,110,136,162],[6,26,54,82,110,138,166],[6,30,58,86,114,142,170]];

  function bytesFor(str) {                                  // UTF-8 bytes
    var out = [], i, c;
    for (i = 0; i < str.length; i++) {
      c = str.charCodeAt(i);
      if (c < 0x80) out.push(c);
      else if (c < 0x800) { out.push(0xC0 | (c >> 6), 0x80 | (c & 63)); }
      else if (c < 0xD800 || c >= 0xE000) { out.push(0xE0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63)); }
      else {                                                 // surrogate pair
        i++; var c2 = str.charCodeAt(i); var cp = 0x10000 + (((c & 0x3FF) << 10) | (c2 & 0x3FF));
        out.push(0xF0 | (cp >> 18), 0x80 | ((cp >> 12) & 63), 0x80 | ((cp >> 6) & 63), 0x80 | (cp & 63));
      }
    }
    return out;
  }

  function pickVersion(len, level) {
    for (var v = 1; v <= 40; v++) {
      var cap = DATA_CW[level][v - 1];
      var lenBits = (v < 10) ? 8 : 16;
      var need = Math.ceil((4 + lenBits + len * 8) / 8);
      if (need <= cap) return v;
    }
    return 0;                                                // does not fit in any version at this level
  }

  // ---- bit stream -> data codewords ------------------------------------------------------------------
  function makeCodewords(data, ver, level) {
    var cap = DATA_CW[level][ver - 1], lenBits = (ver < 10) ? 8 : 16;
    var bits = [];
    function push(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >>> i) & 1); }
    push(4, 4);                                              // byte mode
    push(data.length, lenBits);
    for (var i = 0; i < data.length; i++) push(data[i], 8);
    var capBits = cap * 8;
    for (i = 0; i < 4 && bits.length < capBits; i++) bits.push(0);          // terminator
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (i = 0; i < bits.length; i += 8) {
      var b = 0; for (var j = 0; j < 8; j++) b = (b << 1) | bits[i + j];
      cw.push(b);
    }
    var pad = [0xEC, 0x11], p = 0;
    while (cw.length < cap) { cw.push(pad[p++ % 2]); }
    return cw;
  }

  /* Split into blocks, RS-encode each, then INTERLEAVE. Group 2 blocks hold one more data codeword than group
   * 1 — that is the rule the spec buries and the usual source of "scans on one phone, not another". */
  function interleave(cw, ver, level) {
    var spec = BLOCKS[level][ver - 1], ecLen = spec[0], g1 = spec[1], g2 = spec[2];
    var totalBlocks = g1 + g2, g1Len = Math.floor(cw.length / totalBlocks), g2Len = g1Len + 1;
    var blocks = [], ecs = [], off = 0, i, j;
    for (i = 0; i < totalBlocks; i++) {
      var n = (i < g1) ? g1Len : g2Len;
      var blk = cw.slice(off, off + n); off += n;
      blocks.push(blk); ecs.push(rsEncode(blk, ecLen));
    }
    var out = [];
    for (j = 0; j < g2Len; j++) for (i = 0; i < totalBlocks; i++) if (j < blocks[i].length) out.push(blocks[i][j]);
    for (j = 0; j < ecLen; j++) for (i = 0; i < totalBlocks; i++) out.push(ecs[i][j]);
    return out;
  }

  // ---- module matrix ---------------------------------------------------------------------------------
  function newMatrix(size) {
    var m = new Array(size);
    for (var i = 0; i < size; i++) { m[i] = new Array(size); for (var j = 0; j < size; j++) m[i][j] = null; }
    return m;
  }
  function placeFinder(m, r, c) {
    for (var i = -1; i <= 7; i++) for (var j = -1; j <= 7; j++) {
      var rr = r + i, cc = c + j; if (rr < 0 || cc < 0 || rr >= m.length || cc >= m.length) continue;
      var on = (i >= 0 && i <= 6 && (j === 0 || j === 6)) || (j >= 0 && j <= 6 && (i === 0 || i === 6)) || (i >= 2 && i <= 4 && j >= 2 && j <= 4);
      m[rr][cc] = on ? 1 : 0;
    }
  }
  function placeAlign(m, r, c) {
    for (var i = -2; i <= 2; i++) for (var j = -2; j <= 2; j++) {
      var on = (Math.max(Math.abs(i), Math.abs(j)) !== 1);
      m[r + i][c + j] = on ? 1 : 0;
    }
  }
  var FMT_MASK = 0x5412, FMT_GEN = 0x537, VER_GEN = 0x1f25;
  function bchFormat(fmt) {
    var d = fmt << 10;
    while (bitLen(d) - 11 >= 0) d ^= FMT_GEN << (bitLen(d) - 11);
    return ((fmt << 10) | d) ^ FMT_MASK;
  }
  function bchVersion(ver) {
    var d = ver << 12;
    while (bitLen(d) - 13 >= 0) d ^= VER_GEN << (bitLen(d) - 13);
    return (ver << 12) | d;
  }
  function bitLen(x) { var n = 0; while (x) { n++; x >>>= 1; } return n; }

  var LEVEL_BITS = { L: 1, M: 0, Q: 3, H: 2 };

  function build(str, level, force) {
    level = level || 'M';
    if (!LEVEL_BITS.hasOwnProperty(level)) throw new Error('bad ECC level ' + level);
    var data = bytesFor(String(str));
    var ver = pickVersion(data.length, level);
    if (!ver) throw new Error('too long for one QR at level ' + level + ' (' + data.length + ' bytes)');
    var cw = interleave(makeCodewords(data, ver, level), ver, level);
    var size = ver * 4 + 17, m = newMatrix(size), i, j;

    placeFinder(m, 0, 0); placeFinder(m, 0, size - 7); placeFinder(m, size - 7, 0);
    var al = ALIGN[ver - 1];
    for (i = 0; i < al.length; i++) for (j = 0; j < al.length; j++) {
      var r = al[i], c = al[j];
      if ((r <= 8 && c <= 8) || (r <= 8 && c >= size - 9) || (r >= size - 9 && c <= 8)) continue;   // clash with a finder
      placeAlign(m, r, c);
    }
    for (i = 8; i < size - 8; i++) { var bit = (i % 2 === 0) ? 1 : 0; m[6][i] = bit; m[i][6] = bit; }   // timing
    m[size - 8][8] = 1;                                                                                 // dark module
    // reserve the format areas so data placement skips them
    for (i = 0; i <= 8; i++) { if (m[8][i] === null) m[8][i] = 0; if (m[i][8] === null) m[i][8] = 0; }
    for (i = 0; i < 8; i++) { if (m[8][size - 1 - i] === null) m[8][size - 1 - i] = 0; if (m[size - 1 - i][8] === null) m[size - 1 - i][8] = 0; }
    if (ver >= 7) {
      var vb = bchVersion(ver);
      for (i = 0; i < 18; i++) {
        var b = (vb >> i) & 1;
        m[Math.floor(i / 3)][size - 11 + (i % 3)] = b;
        m[size - 11 + (i % 3)][Math.floor(i / 3)] = b;
      }
    }

    // data placement: two-module columns, right to left, alternating upward/downward
    var reserved = newMatrix(size);
    for (i = 0; i < size; i++) for (j = 0; j < size; j++) reserved[i][j] = (m[i][j] !== null);
    var bitIdx = 0, total = cw.length * 8;
    function dataBit(n) { return n < total ? ((cw[n >> 3] >> (7 - (n & 7))) & 1) : 0; }
    var up = true;
    for (var col = size - 1; col > 0; col -= 2) {
      if (col === 6) col--;                                  // skip the vertical timing column
      for (var t = 0; t < size; t++) {
        var row = up ? (size - 1 - t) : t;
        for (var k = 0; k < 2; k++) {
          var cc = col - k;
          if (reserved[row][cc]) continue;
          m[row][cc] = dataBit(bitIdx++);
        }
      }
      up = !up;
    }

    /* masking: try all 8, keep the lowest penalty. `force` pins one mask instead — the seam the reference-diff
     * test uses to compare this matrix against a symbol built by a different implementation. */
    var best = null, bestPen = Infinity, bestMask = 0;
    for (var mk = (force == null ? 0 : force); mk < (force == null ? 8 : force + 1); mk++) {
      var cand = applyMask(m, reserved, mk, size);
      placeFormat(cand, size, LEVEL_BITS[level], mk);
      var pen = penalty(cand, size);
      if (pen < bestPen) { bestPen = pen; best = cand; bestMask = mk; }
    }
    return { size: size, version: ver, level: level, mask: bestMask, modules: best };
  }

  function maskAt(mk, r, c) {
    switch (mk) {
      case 0: return (r + c) % 2 === 0;
      case 1: return r % 2 === 0;
      case 2: return c % 3 === 0;
      case 3: return (r + c) % 3 === 0;
      case 4: return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0;
      case 5: return ((r * c) % 2) + ((r * c) % 3) === 0;
      case 6: return (((r * c) % 2) + ((r * c) % 3)) % 2 === 0;
      default: return (((r + c) % 2) + ((r * c) % 3)) % 2 === 0;
    }
  }
  function applyMask(m, reserved, mk, size) {
    var out = newMatrix(size);
    for (var r = 0; r < size; r++) for (var c = 0; c < size; c++) {
      out[r][c] = reserved[r][c] ? m[r][c] : (m[r][c] ^ (maskAt(mk, r, c) ? 1 : 0));
    }
    return out;
  }
  function placeFormat(m, size, lvlBits, mk) {
    var fmt = bchFormat((lvlBits << 3) | mk);
    /* MSB FIRST: bit 14 goes at (8,0) and at (size-1,8), not bit 0. Reversing this is invisible to the eye and
     * to a structural check — the finders, timing and dark module all still look perfect — and it makes the
     * symbol undecodable, which is exactly why this file is verified against a reference implementation. */
    for (var i = 0; i < 15; i++) {
      var b = (fmt >> (14 - i)) & 1;
      // copy 1, around the top-left finder
      if (i < 6) m[8][i] = b;
      else if (i === 6) m[8][7] = b;
      else if (i === 7) m[8][8] = b;
      else if (i === 8) m[7][8] = b;
      else m[14 - i][8] = b;
      /* copy 2: bits 0-6 run UP the left column, bits 7-14 run along row 8 from col size-8. The split is 7/8,
       * not 8/7 — an 8/7 split writes bit 7 onto the dark module and leaves m[8][size-8] blank, which is a
       * corrupt second copy that decoders fall back to. */
      if (i < 7) m[size - 1 - i][8] = b;
      else m[8][size - 15 + i] = b;
    }
    m[size - 8][8] = 1;                                      // the dark module is not part of the format
  }
  function penalty(m, size) {
    var p = 0, r, c, run, i;
    for (r = 0; r < size; r++) {                             // rule 1: runs of 5+
      run = 1;
      for (c = 1; c < size; c++) { if (m[r][c] === m[r][c - 1]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
    }
    for (c = 0; c < size; c++) {
      run = 1;
      for (r = 1; r < size; r++) { if (m[r][c] === m[r - 1][c]) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; }
    }
    for (r = 0; r < size - 1; r++) for (c = 0; c < size - 1; c++) {   // rule 2: 2x2 blocks
      var v = m[r][c];
      if (v === m[r][c + 1] && v === m[r + 1][c] && v === m[r + 1][c + 1]) p += 3;
    }
    var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0];             // rule 3: finder-like 1:1:3:1:1 + 4 light
    function hasPat(get, len) {
      var n = 0;
      for (var s = 0; s + pat.length <= len; s++) {
        var ok = true;
        for (var k = 0; k < pat.length; k++) if (get(s + k) !== pat[k]) { ok = false; break; }
        if (ok) n++;
        ok = true;
        for (k = 0; k < pat.length; k++) if (get(s + k) !== pat[pat.length - 1 - k]) { ok = false; break; }
        if (ok) n++;
      }
      return n;
    }
    for (r = 0; r < size; r++) p += 40 * hasPat(function (x) { return m[r][x]; }, size);
    for (c = 0; c < size; c++) p += 40 * hasPat(function (x) { return m[x][c]; }, size);
    var dark = 0;                                            // rule 4: dark/light balance
    for (r = 0; r < size; r++) for (c = 0; c < size; c++) if (m[r][c]) dark++;
    var pct = dark * 100 / (size * size);
    p += Math.floor(Math.abs(pct - 50) / 5) * 10;
    return p;
  }

  /* Render to an existing <canvas>. `quiet` is the mandatory light border — 4 modules per spec, and leaving it
   * out is the classic "my QR won't scan" bug. Colours are fixed black-on-white on purpose: a themed QR is a
   * QR that fails in some scanner's contrast check. */
  function toCanvas(canvas, str, opts) {
    opts = opts || {};
    var q = build(str, opts.level || 'M');
    var quiet = (opts.quiet == null) ? 4 : opts.quiet;
    var total = q.size + quiet * 2;
    var px = Math.max(1, Math.floor((opts.px || 320) / total));
    var dim = total * px;
    canvas.width = dim; canvas.height = dim;
    var g = canvas.getContext('2d');
    g.fillStyle = '#fff'; g.fillRect(0, 0, dim, dim);
    g.fillStyle = '#000';
    for (var r = 0; r < q.size; r++) for (var c = 0; c < q.size; c++) {
      if (q.modules[r][c]) g.fillRect((c + quiet) * px, (r + quiet) * px, px, px);
    }
    return q;
  }

  var API = { build: build, toCanvas: toCanvas, capacityBytes: function (level) { return DATA_CW[level || 'M'][39]; } };
  if (typeof module !== 'undefined' && module.exports) module.exports = API;
  if (typeof window !== 'undefined') window.CardmenQR = API;
})();
