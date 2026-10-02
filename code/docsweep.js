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
 * Run: node docsweep.js     (exits 0 always — it reports, it does not gate)
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

let n = 0, flagged = 0, m;
while ((m = entryRe.exec(doc)) !== null) {
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
console.log('\ndocsweep: ' + n + ' backlog entries, ' + flagged + ' naming a symbol the code no longer has.');
console.log('A hit is a LEAD, not a verdict — a browser API or a deliberate tombstone reads the same.');
console.log('And a clean run says nothing about whether an entry\'s REMEDY has already shipped: re-read those.');
