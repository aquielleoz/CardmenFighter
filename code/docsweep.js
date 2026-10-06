#!/usr/bin/env node
/* THE DOCS STALENESS SWEEP — the mechanical half, which is the only half that needs no judgement.
 *
 * Splits the BACKLOG on its `[id: …]` lines, pulls every backticked identifier out of each entry, and
 * greps the live code for it. A symbol an entry names that no longer exists is the cheapest possible proof
 * that the entry has moved on — CLAUDE.md: *"`grep -n preFightHolder engine.js` answered one of these in
 * three seconds"*, on the day four of six entries in one cluster turned out stale.
 *
 * ⚠ WHAT IT CANNOT SEE IS THE HALF THAT ROTS. An entry whose symbols all still exist while its ACTION has
 * already shipped passes this cleanly — 2026-09-24's one real finding was exactly that shape. Run it to
 * clear the mechanical axis in a second, then re-read the REMEDY each surviving entry names.
 *
 * Run: node docsweep.js            (exits 0 always — it reports, it does not gate)
 *      node docsweep.js --counts   only the suite-count half — the sweep runs this at its end
 */
const fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const doc = fs.readFileSync(path.join(ROOT, 'docs/NEXT-SESSION.md'), 'utf8');

/* The live code surface: every tracked .js plus the template. NOT the generated HTML (it is a copy, so a
   dead symbol would still be found there) and not the `_`-prefixed scratch probes. */
let code = '';
[path.join(ROOT, 'code'), path.join(ROOT, 'relay')].forEach(dir => {
  fs.readdirSync(dir).filter(f => /\.js$/.test(f) && f[0] !== '_')
    .forEach(f => { code += fs.readFileSync(path.join(dir, f), 'utf8') + '\n'; });
});
code += fs.readFileSync(path.join(ROOT, 'code/CardmenFighter.template.html'), 'utf8');

const TAG = '(?:needs a repro|root cause found|ready to build|needs a decision|needs a measurement|parked)';
const entryRe = new RegExp('\\n- `' + TAG + '`\\s*·([\\s\\S]*?)`\\[id: ([a-z0-9-]+)\\]`', 'g');
/* >=5 chars and containing a lower-case letter, so `MAX_HAND` and one-word prose are skipped; a filename
   or a commit trailer word is not a code symbol either. */
const identRe = /`([A-Za-z_$][A-Za-z0-9_$]{4,})`/g;
const skip = /\.(js|md|html|json|toml)$|^(?:true|false|null|undefined|needs|closes|files|updates)$/;

const COUNTS_ONLY = process.argv.includes('--counts');   // what `sweep.js` runs at its end: only the suite-count half
let n = 0, flagged = 0, m;
while (!COUNTS_ONLY && (m = entryRe.exec(doc)) !== null) {
  n++;
  const body = m[1], id = m[2], names = new Set();
  let k; identRe.lastIndex = 0;
  while ((k = identRe.exec(body)) !== null) {
    const name = k[1];
    if (skip.test(name) || !/[a-z]/.test(name)) continue;
    names.add(name);
  }
  const missing = [...names].sort().filter(name => !new RegExp('\\b' + name.replace(/\$/g, '\\$') + '\\b').test(code));
  if (missing.length) { flagged++; console.log('  ' + id.padEnd(36) + ' names, and the code does not have: ' + missing.join(', ')); }
}
/* ---- DECLARED SUITE COUNTS vs WHAT THE SUITES PRINT (suite-counts-declared-twice) --------------------
   CLAUDE.md writes every suite's count twice — the COMMAND LIST (what a session reads first to decide what to
   run) and the "Counts verified" list — and 27 had drifted by 2026-09-30, the command list worst. `sweep.js`
   records each green suite's real PASS count in `.sweep-counts.json`; this diffs both lists against it.
   A REPORT, NEVER A GATE: a suite changes count in the same commit as the doc, and a gate would fire on the way past.
   The command list is parsed per BLOCK — from one `node x.js` line to the next — because several entries carry
   their count on a continuation line, and a first-line-only scan misses five. A block's own count is the
   first `(N)` before it names any other suite; a backticked suite name followed closely by `(N)` declares
   THAT suite's count (the heldplay block also declares heldplay3's). */
const claude = fs.readFileSync(path.join(ROOT, 'CLAUDE.md'), 'utf8');
let actual = null; try { actual = JSON.parse(fs.readFileSync(path.join(__dirname, '.sweep-counts.json'), 'utf8')); } catch (e) {}
function suiteCountReport() {
  if (!actual) { console.log('\nsuite counts: no `.sweep-counts.json` yet — run `node sweep.js` once, then this.'); return; }
  const decl = [];                                        // [file, n, where]
  const lines = claude.split('\n'); let blk = null;
  const flush = () => { if (!blk) return;
    const txt = blk.text, named = /`((?:nettest_|lessontest)[a-z0-9_]*|[a-z_]+test(?:_[a-z]+)?)`[^`(\n]{0,24}\((\d+)(?: assertions)?\)/g;
    const firstOther = txt.search(/`(?:nettest_|lessontest)[a-z0-9_]*`|`[a-z_]+test(?:_[a-z]+)?`/);
    const own = /\((\d+)(?: assertions)?\)/.exec(firstOther < 0 ? txt : txt.slice(0, firstOther));
    if (own) decl.push([blk.file, +own[1], 'command list']);
    let k; while ((k = named.exec(txt)) !== null) { const f = k[1] + '.js'; if (f !== blk.file) decl.push([f, +k[2], 'command list (inside ' + blk.file + ')']); }
    blk = null; };
  let inFence = false;
  lines.forEach(l => {
    if (/^```/.test(l)) { flush(); inFence = !inFence; return; }
    if (!inFence) return;
    const m = /^node ((?:\.\.\/relay\/)?[a-zA-Z0-9_.]+\.js)\b(.*)$/.exec(l);
    if (m) { flush(); blk = { file: m[1].replace('../relay/', '../relay/'), text: m[2] }; return; }
    if (blk && /^\s*#/.test(l)) blk.text += ' ' + l;
  });
  flush();
  // the verified list: names before "netplay suites:" are `<name>.js`, after it `nettest_<name>.js`
  const vb = (claude.split('Counts verified:')[1] || '').split('**A DEADLOCKED')[0];
  const [solo, net] = vb.split(/netplay suites:/);
  const pairRe = /`([a-z0-9_.]+)` (\d+)/g; let k;
  while ((k = pairRe.exec(solo || '')) !== null) decl.push([(k[1] === 'netview' ? 'netview.test' : k[1]) + '.js', +k[2], 'verified list']);   // `netview` is the one short name that is not its file's
  while ((k = pairRe.exec(net || '')) !== null) decl.push([(/^nettest_/.test(k[1]) ? '' : 'nettest_') + k[1] + '.js', +k[2], 'verified list']);   // `nettest_3p` is written in full
  let off = 0, checked = 0;
  decl.forEach(([f, want, where]) => {
    if (!(f in actual)) return;
    checked++;
    if (actual[f] !== want) { off++; console.log('  ' + f.padEnd(30) + ' declared ' + String(want).padStart(4) + ' in the ' + where + ', the suite printed ' + actual[f]); }
  });
  // a suite LISTED TWICE in the verified list (2026-10-01: `narrate` was both 11 and 12) — the count diff finds the
  // stale copy and passes the fresh one, so the duplicate itself has to be named
  const seenV = {}; decl.filter(d => d[2] === 'verified list').forEach(d => { seenV[d[0]] = (seenV[d[0]] || 0) + 1; });
  Object.keys(seenV).filter(f => seenV[f] > 1).forEach(f => { off++; console.log('  ' + f.padEnd(30) + ' is listed ' + seenV[f] + ' times in the verified list'); });
  const declared = new Set(decl.map(d => d[0]));
  const never = Object.keys(actual).filter(f => !declared.has(f) && f !== 'browsertest.js');
  console.log('\nsuite counts: ' + checked + ' declarations checked against the last green sweep, ' + off + ' stale.' +
              (never.length ? '  Declared NOWHERE: ' + never.join(', ') : ''));
}
if (!COUNTS_ONLY) console.log('\ndocsweep: ' + n + ' backlog entries, ' + flagged + ' naming a symbol the code no longer has.');
if (!COUNTS_ONLY) console.log('A hit is a LEAD, not a verdict — a browser API or a deliberate tombstone reads the same.');
if (!COUNTS_ONLY) console.log('And a clean run says nothing about whether an entry\'s REMEDY has already shipped: re-read those.');
suiteCountReport();
