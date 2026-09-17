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
 * CLAUDE.md's epic rules already said "sub-branches PR INTO the epic, never into `main`". COUNTED rather
 * than guessed, after the first version of this comment claimed all eleven steps had skipped it and Aj
 * pointed at the PR list: steps 1-9 each had one (#184-#191), and FOUR merges skipped — two docs branches,
 * plus the flag-residue fix and STEP 11, both on the day the gate was written. So the rule held for nine
 * consecutive code steps and broke on the two fastest days, losing the merge the plan calls the cliff.
 * WHY A PUSH IS THE RIGHT THING TO CATCH, and it is the whole trick: a PR merge happens SERVER-SIDE, so a
 * correctly-run epic never receives a push from anyone's machine at all. "Did this branch move locally?" and
 * "did this skip its PR?" are therefore the same question, and this is the only hook that can see it.
 * THE ONE LEGITIMATE LOCAL PUSH is CLAUDE.md's own "merge `main` INTO the epic after every session spent
 * elsewhere", which has no PR to hang off. It gets a NAMED escape rather than a hole: `EPIC_PUSH=1`, which
 * says out loud what it is for and leaves a reason in the shell history. */
var _refs = null;
function pushRefs() {
  // pre-push feeds `<localref> <localsha> <remoteref> <remotesha>` on stdin. Run by hand there is none, and
  // reading fd 0 from a terminal would HANG — which would make the gate look like a broken push.
  /* MEMOISED, AND THAT IS LOAD-BEARING RATHER THAN TIDY (2026-09-16). stdin is a STREAM: the first read
     DRAINS it, so a second caller gets an empty string and its gate silently does nothing. The backlog gate
     below is a second caller, and without this it passed every negative case — a gate that cannot fail, which
     is the "green and blind" shape CLAUDE.md already catalogues, reached by a one-word cause. */
  if (_refs) return _refs;
  try {
    if (process.stdin.isTTY) return (_refs = []);
    return (_refs = require('fs').readFileSync(0, 'utf8').split('\n').filter(Boolean));
  } catch (e) { return (_refs = []); }            // no stdin at all (e.g. `node checkbranch.js`) — nothing to gate
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

/* ---- THE BACKLOG GATE: a PR must SAY what it did to the backlog (2026-09-16, Aj: *"we should probably add
 * a gate during pr to check the backlog if the related entry hasn't been cleared/moved to the correct
 * tracking document"*).
 * THIS IS THE RATCHET ASYMMETRY, GENERALISED. CLAUDE.md already records why a known failure needed tagging on
 * BOTH sides: deleting a ratchet is a HAPPY act done inside the suite, and the doc is nowhere in the author's
 * view at that moment — so no amount of "remember to check the BACKLOG" survives it. Closing a backlog entry
 * has exactly that shape, and it has already happened here: on the day this landed, a cull pass found an entry
 * describing a bug fixed EARLIER THE SAME DAY, and another whose five findings the epic had closed one by one
 * without anyone touching the doc.
 * WHAT IT CAN AND CANNOT DO, stated plainly because the weak half matters. It verifies a `closes` CLAIM — say
 * you closed an entry and the gate checks the entry is really gone. It CANNOT catch silent omission: nothing
 * can tell whether `Backlog: none` is true. What it buys is that the question is asked once per PR, out loud,
 * in a place that ends up in the history — and that the claim, once made, is checked. That is the same bargain
 * the ratchet registry makes, and it is strictly better than the paragraph it replaces.
 * The id lives on its own line at the end of each entry (`[id: slug]`), out of the scannable tag column. */
function backlogAt(sha) {
  try { return execSync('git show ' + sha + ':docs/NEXT-SESSION.md', { stdio: ['ignore','pipe','ignore'] }).toString(); }
  catch (e) { return null; }                      // the doc is absent at that commit — nothing to check against
}
function baseFor(lsha, rsha) {
  if (rsha && !/^0+$/.test(rsha)) return rsha;    // updating an existing branch: only the new commits
  /* A BRAND-NEW BRANCH HAS NO REMOTE SIDE, so fall back to the NEAREST integration point — this repo has two
   * (`main` and whichever epic is live), and picking the wrong one would drag in an epic's whole history. */
  var best = null, bestN = Infinity;
  execSync('git for-each-ref --format="%(refname)" refs/remotes/origin/main refs/remotes/origin/epic').toString()
    .split('\n').filter(Boolean).forEach(function (ref) {
      try {
        var mb = execSync('git merge-base ' + ref.trim() + ' ' + lsha).toString().trim();
        var n = parseInt(execSync('git rev-list --count ' + mb + '..' + lsha).toString().trim(), 10);
        if (n < bestN) { bestN = n; best = mb; }
      } catch (e) {}
    });
  return best;
}
pushRefs().forEach(function (line) {
  if (process.env.EPIC_PUSH === '1') return;
  var f = line.trim().split(/\s+/), lsha = f[1] || '', rref = f[2] || '', rsha = f[3] || '';
  if (!lsha || /^0+$/.test(lsha)) return;                                   // a deletion
  if (rref === 'refs/heads/main' || rref.indexOf('refs/heads/epic/') === 0) return;   // already refused above
  var base = baseFor(lsha, rsha); if (!base) return;
  var msgs;
  try { msgs = execSync('git log --format=%B ' + base + '..' + lsha).toString(); } catch (e) { return; }
  if (!msgs.trim()) return;
  /* EVERY TRAILER, NOT THE FIRST ONE (2026-09-17). This was `msgs.match(...)` with no `/g`, which returns
   * the FIRST match across all the commits being pushed — so a PR closing six entries could declare six
   * and have exactly one verified, and the other five were free to be typos or to name entries still
   * sitting in the doc. The gate reporting success at precisely its own job, for the second time: the
   * first was the `pushRefs()` stdin drain, and the shape is the same both times — a check that runs, says
   * nothing, and is read as a pass.
   * FOUND BY NEEDING IT. A cluster PR closed six entries and there was no way to say so; the limit was not
   * visible from reading the gate, only from trying to use it. */
  var all = msgs.match(/^Backlog:[ \t]*(none|closes|updates|files)([ \t]+([a-z0-9-]+))?[ \t]*$/gmi) || [];
  if (!all.length) {
    console.error('✗ branch "' + branch + '": no `Backlog:` trailer on any commit being pushed.');
    console.error('  Every PR states what it did to the backlog — the entry does not close itself, and a fix');
    console.error('  that ships while its entry stays open is how a doc starts lying. One of:');
    console.error('      Backlog: closes  <id>     (and the entry must be GONE from docs/NEXT-SESSION.md)');
    console.error('      Backlog: updates <id>     (rewritten against what is true now)');
    console.error('      Backlog: files   <id>     (this PR adds the entry)');
    console.error('      Backlog: none             (nothing in the backlog relates to this)');
    console.error('  Ids are the `[id: slug]` line at the end of each BACKLOG entry:  grep "\\[id: " docs/NEXT-SESSION.md');
    process.exit(1);
  }
  var doc = backlogAt(lsha); if (doc === null) return;
  var before = backlogAt(base);
  all.forEach(function (line) {
  var m = line.match(/^Backlog:[ \t]*(none|closes|updates|files)([ \t]+([a-z0-9-]+))?[ \t]*$/i);
  var verb = m[1].toLowerCase(), slug = m[3] || '';
  if (verb === 'none') return;
  if (!slug) { console.error('✗ `Backlog: ' + verb + '` needs an id — e.g. `Backlog: ' + verb + ' drop-hint-overflows-board`'); process.exit(1); }
  var present = doc.indexOf('[id: ' + slug + ']') >= 0;
  if (verb === 'closes') {
    if (present) {
      console.error('✗ `Backlog: closes ' + slug + '` — but that entry is STILL in docs/NEXT-SESSION.md.');
      console.error('  Either delete it (the work is done), or say `updates ' + slug + '` if it only shrank.');
      console.error('  Closing is the half that rots: the fix ships, the entry stays, and the doc quietly lies.');
      process.exit(1);
    }
    /* A TYPO MUST NOT READ AS A CLOSE, and the first version of this gate let one through: an id that never
     * existed is "gone" by the same test as one you deleted, so `closes drop-hint-overflowss` passed and the
     * real entry stayed open — the gate reporting success at precisely its own job. Found by testing the
     * thing rather than reading it, which is this repo's standing result. So a close must show the entry was
     * THERE BEFORE and is gone NOW. */
    if (before !== null && before.indexOf('[id: ' + slug + ']') < 0) {
      console.error('✗ `Backlog: closes ' + slug + '` — no entry with that id existed before this push either.');
      console.error('  That is a typo, not a close: the gate cannot tell "I deleted it" from "it never existed".');
      console.error('  Check the slug:  grep "\\[id: " docs/NEXT-SESSION.md');
      process.exit(1);
    }
  }
  if (verb !== 'closes' && !present) {
    console.error('✗ `Backlog: ' + verb + ' ' + slug + '` — no entry with that id in docs/NEXT-SESSION.md.');
    console.error('  Check the slug:  grep "\\[id: " docs/NEXT-SESSION.md');
    process.exit(1);
  }
  });
});

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
