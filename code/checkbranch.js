#!/usr/bin/env node
/* BRANCH-NAME GATE. CLAUDE.md documents five prefixes and no synonyms; that rule sat on the honour system and
 * was broken twice in two days by inventing `perf/` mid-session — once already unerasable from history.
 * Aj, 2026-09-02: *"who knows what other sorts of prefix we'll get into? a wild wild west is out there when an
 * llm doesn't even follow it's own rules"*.
 * Every other rule in this repo is a gate rather than a paragraph — build.js hard-fails on a missing version,
 * versiontest asserts the doc chain, the sweep diffs suite counts against CLAUDE.md. This is that, for naming.
 * Run directly, or let .githooks/pre-push run it. */
const { execSync } = require('child_process');
const OK = ['feat/', 'fix/', 'docs/', 'exp/', 'parked/'];   // keep in step with CLAUDE.md's table
const branch = (process.argv[2] || execSync('git rev-parse --abbrev-ref HEAD').toString()).trim();

if (branch === 'main' || branch === 'HEAD') process.exit(0);
if (OK.some(p => branch.startsWith(p))) {
  const rest = branch.slice(branch.indexOf('/') + 1);
  const words = rest.split('-').filter(Boolean);
  if (!/^[a-z0-9-]+$/.test(rest)) { console.error(`✗ branch "${branch}": kebab-case only after the prefix`); process.exit(1); }
  if (words.length < 2 || words.length > 4) {
    // A warning, not a gate: "two to four words" is a style note in CLAUDE.md, and a hard stop on it would be
    // the rule bullying the work. The PREFIX is the part that must not drift.
    console.error(`⚠ branch "${branch}": CLAUDE.md asks for two to four words naming the OUTCOME (got ${words.length})`);
  }
  process.exit(0);
}
console.error(`✗ branch "${branch}" uses an undocumented prefix.`);
console.error(`  Allowed (CLAUDE.md → "Branches and PRs"): ${OK.join(' ')}`);
console.error(`  There is no perf/, chore/, refactor/ or test/ — harness work is a fix/ (a suite too slow to run`);
console.error(`  is a defect in the suite), and a change that may be reverted is an exp/.`);
console.error(`  If a sixth prefix is genuinely needed, that is a conversation, not a commit.`);
process.exit(1);
