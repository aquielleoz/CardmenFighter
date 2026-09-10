#!/usr/bin/env node
/* BRANCH GATE — two rules, both of which were prose first and were broken.
 *   1. the branch NAME (prefixes; below)
 *   2. the INTEGRATION path — `main` and every `epic/*` move only through a PR (see the block below `branch`)
 * BRANCH-NAME GATE. CLAUDE.md documents six prefixes and no synonyms; that rule sat on the honour system and
 * was broken twice in two days by inventing `perf/` mid-session — once already unerasable from history.
 * Aj, 2026-09-02: *"who knows what other sorts of prefix we'll get into? a wild wild west is out there when an
 * llm doesn't even follow it's own rules"*.
 * Every other rule in this repo is a gate rather than a paragraph — build.js hard-fails on a missing version,
 * versiontest asserts the doc chain, the sweep diffs suite counts against CLAUDE.md. This is that, for naming.
 * Run directly, or let .githooks/pre-push run it. */
const { execSync } = require('child_process');
const OK = ['feat/', 'fix/', 'docs/', 'exp/', 'parked/', 'epic/'];   // keep in step with CLAUDE.md's table
const branch = (process.argv[2] || execSync('git rev-parse --abbrev-ref HEAD').toString()).trim();

/* ---- THE INTEGRATION GATE: an epic and `main` MOVE ONLY THROUGH A PR (added 2026-09-10, Aj).
 * CLAUDE.md's epic rules already said "sub-branches PR INTO the epic, never into `main`" — and every merge
 * of `epic/priority-windows`, all eleven steps, was a local `git merge` pushed straight up. The rule was
 * prose, so it lasted exactly as long as the prefix rule did on the honour system.
 * WHY A PUSH IS THE RIGHT THING TO CATCH, and it is the whole trick: a PR merge happens SERVER-SIDE, so a
 * correctly-run epic never receives a push from anyone's machine at all. "Did this branch move locally?" and
 * "did this skip its PR?" are therefore the same question, and this is the only hook that can see it.
 * THE ONE LEGITIMATE LOCAL PUSH is CLAUDE.md's own "merge `main` INTO the epic after every session spent
 * elsewhere", which has no PR to hang off. It gets a NAMED escape rather than a hole: `EPIC_PUSH=1`, which
 * says out loud what it is for and leaves a reason in the shell history. */
function pushRefs() {
  // pre-push feeds `<localref> <localsha> <remoteref> <remotesha>` on stdin. Run by hand there is none, and
  // reading fd 0 from a terminal would HANG — which would make the gate look like a broken push.
  try {
    if (process.stdin.isTTY) return [];
    return require('fs').readFileSync(0, 'utf8').split('\n').filter(Boolean);
  } catch (e) { return []; }                      // no stdin at all (e.g. `node checkbranch.js`) — nothing to gate
}
var blocked = null;
pushRefs().forEach(function (line) {
  var f = line.trim().split(/\s+/), rref = f[2] || '', rsha = f[3] || '';
  var protectedRef = rref === 'refs/heads/main' || rref.indexOf('refs/heads/epic/') === 0;
  if (!protectedRef) return;
  if (/^0+$/.test(rsha)) return;                  // the ref does not exist yet — creating an epic is fine
  if (process.env.EPIC_PUSH === '1') { console.error('⚠ EPIC_PUSH=1 — pushing straight to ' + rref.replace('refs/heads/', '') + '. Use this ONLY to carry `main` into an epic.'); return; }
  blocked = rref.replace('refs/heads/', '');
});
if (blocked) {
  console.error('✗ refusing to push directly to "' + blocked + '" — it moves through a PULL REQUEST.');
  console.error('  A PR merge happens on the server, so this branch should never receive a local push.');
  console.error('  What you almost certainly want, from your sub-branch:');
  console.error('      git push -u origin <your-branch>');
  console.error('      gh pr create --base ' + blocked + ' --title "..." --body-file <file>');
  console.error('      gh pr merge --merge --delete-branch');
  console.error('  (--body-file, never --body: backticks in a double-quoted shell string are EXECUTED, and');
  console.error('   that has already shipped a mangled PR body in this repo.)');
  console.error('  The one exception is carrying `main` into an epic, which has no PR:  EPIC_PUSH=1 git push');
  console.error('  Rule: CLAUDE.md → "Branches and PRs" → epic/. Eleven step-merges skipped it before this');
  console.error('  gate existed, which is why it is a gate and not a paragraph.');
  process.exit(1);
}

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
console.error(`  A further prefix is fine IF IT IS AGREED FIRST — no surprises. Propose it, then add it here`);
console.error(`  and to CLAUDE.md's table in the same commit. This gate exists because one was not.`);
console.error(`  epic/ was the sixth and was added that way (2026-09-08); perf/ was not, and is in history.`);
process.exit(1);
