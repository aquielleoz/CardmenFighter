#!/usr/bin/env node
/* THE SWEEP RUNNER — parallel, and the reason it can be is that every suite now takes `PORT` from the
 * environment (default unchanged, so running a suite by hand is exactly as it was).
 *
 * Why this exists: timed per suite on 2026-09-01 the sweep was 637s, and 67 of the 72 suites average 4.6s and
 * were serial ONLY because each bound a hardcoded port. Five port groups actually collided
 * (8296/8303/8319/8331/8341), so "run them one at a time" was load-bearing, not caution.
 *
 *   node sweep.js              # everything, 4 at a time
 *   node sweep.js -j 6         # more lanes
 *   node sweep.js --fast       # skip the six slow STABLE suites (layout/smoke/parity/export) — the iteration
 *                              # loop. A full sweep still gates a PR, and Aj's rule is one complete sweep per
 *                              # day of coding.
 *   node sweep.js -j 1         # the old serial behaviour, for when a parallel run looks suspicious
 *
 * LONGEST FIRST, and since 2026-09-24 the lengths are MEASURED rather than declared (see COST below). The
 * floor for N lanes is max(total_work / N, longest_single_suite), and bad ordering strands a slow suite in
 * the tail; standard LPT scheduling, one line, and it cannot make things worse.
 * DO NOT EXPECT A WALL-CLOCK WIN FROM IT. A/B'd against the WORST case (shortest first), interleaved, it
 * measured as **indistinguishable**: longest 235s/142s vs shortest 168s/157s — a 26s gap between arms
 * against a 93s spread WITHIN one arm. This machine's desktop load swamps it. Note that A/B ran on the
 * half-inverted hand-written list, so it compared "roughly sorted" against "reverse sorted" rather than
 * anything clean — which weakens it further. The reason to get the order right is not the total: it is that
 * the head of the queue is the most contended window in the sweep, and what lands there matters to the
 * suites with the thinnest margins. */
const { spawn } = require('child_process');
const path = require('path'), fs = require('fs');

const args = process.argv.slice(2);
const jobs = Math.max(1, parseInt((args[args.indexOf('-j') + 1]) || '4', 10) || 4);
const fast = args.includes('--fast');
/* A PER-SUITE TIMEOUT, because the runner was the other half of the silent-hang problem. `srv.listen` now
 * rejects on EADDRINUSE (fixed the same day), but a suite can still wedge for other reasons — a browser
 * that never launches, a poll that never settles — and without this it would hold a lane forever while the
 * sweep looked merely slow. Generous on purpose: the slowest suite is ~66s alone and `nettest_sync` has
 * reached 125s under load, so 300s is 2.4x the worst seen. SIGKILL the whole process GROUP, not just node:
 * the child spawns chromium, and a killed parent cannot clean those up. */
const TIMEOUT_MS = (parseInt(args[args.indexOf('--timeout') + 1], 10) || 300) * 1000;

/* TWO LISTS, BECAUSE `SLOW` WAS ANSWERING TWO DIFFERENT QUESTIONS AND ONLY ONE OF THEM ROTS.
 * It drove BOTH the longest-first schedule ("what costs the most?" — a MEASUREMENT) and `--fast` ("what is
 * stable enough to skip while iterating?" — a JUDGEMENT). Measured 2026-09-24, the six it named were:
 * mptest 63s, browsertest 59s, landscapetest 44s, lessontest_twos 22s, exporttest 15s, **rulestest 11s** —
 * while `nettest_passoduel` 44s, `prompttest` 43s, `nettest_sync` 28s and `resolutiontest_ui` 24s were not in
 * it at all. So the scheduler was putting an 11s suite at the head of the queue and leaving a 44s one to
 * readdir order: longest-first was inverted for half its entries.
 * CONFLATING THEM MADE EVERY NEW HEAVY SUITE A BAD CHOICE — add it and `--fast` skips the code you are
 * actively changing, leave it out and the scheduler mis-orders. The epic added three of the seven slowest
 * suites and none could be added for exactly that reason. */

/* `--fast` SKIPS THESE: layout / smoke / multiplayer-parity / export / rules — they change rarely, so the
 * iteration loop can do without them. A full sweep still gates a PR. This is a judgement call and stays
 * hand-maintained. NEVER put a netplay suite in here — all 44 together are 196s, and nettest_elim3 once sat
 * red for five versions because a change "did not look related" — and never put a suite here because it is
 * SLOW: that is what the cost file below is for. */
const FAST_SKIP = ['landscapetest.js', 'browsertest.js', 'mptest.js', 'exporttest.js', 'rulestest.js'];

/* SCHEDULING COST IS MEASURED AND NEVER DECLARED. A hand-written cost list is the exact shape this repo has
 * watched rot over and over — CLAUDE.md: "if a number genuinely must appear twice, make the second copy
 * ASSERTED, not written". So every run records what each suite took and the next run schedules by it; a list
 * that maintains itself cannot go stale, and a new suite needs no bookkeeping.
 * THE MINIMUM, NOT THE LAST TIME, and that is the part that matters. A time measured under contention is
 * inflated, and scheduling longest-first puts a suite into the MOST contended window — so recording the last
 * time creates a feedback loop where a suite is slow because it is scheduled early and scheduled early
 * because it is slow. `lessontest_twos` is the live example: it was recorded at 112s under load, which is
 * three times its real 22s, and it has been starting alongside the three heaviest suites in the repo ever
 * since. The minimum across runs converges on the uncontended cost and breaks the loop.
 * UNMEASURED GOES FIRST: a suite with no record might be the longest, and stranding a long one in the tail is
 * the single thing longest-first exists to prevent. It costs one badly-ordered run, once. */
const TIMES_FILE = path.join(here, '.sweep-times.json');
function readTimes() { try { return JSON.parse(fs.readFileSync(TIMES_FILE, 'utf8')); } catch (e) { return {}; } }
function writeTimes(prev, runs) {
  const out = Object.assign({}, prev);
  runs.forEach(r => { const s = +r.secs; if (s > 0 && !r.failed) out[r.file] = Math.min(out[r.file] || Infinity, s); });   // a failed suite's time is not its cost
  try { fs.writeFileSync(TIMES_FILE, JSON.stringify(out, null, 1) + '\n'); } catch (e) {}
}

const here = __dirname;
const all = fs.readdirSync(here)
  .filter(f => /\.js$/.test(f))
  .filter(f => /^(nettest_|lessontest)/.test(f) || ['test.js','netview.test.js','mptest.js','rulestest.js','landscapetest.js','decktest.js','viewtest.js','piletest.js','revealtest.js','phantasmtest.js','exporttest.js','versiontest.js','sharetest.js','qrtest.js','peektest.js','logtest.js','motiontest.js','phonetest.js','oppbeatstest.js','counterfeittest.js','quicktest.js','shadowtest.js','prompttest.js','resolutiontest.js','resolutiontest_ui.js','browsertest.js'].includes(f))
  .filter(f => !['nettest_lobby.js','nettest.js','lessonlib.js','fightclick.js'].includes(f));   // helpers, and the BroadcastChannel probe that is not a suite
const TIMES = readTimes();
const cost = f => (f in TIMES) ? TIMES[f] : Infinity;                           // unmeasured sorts first — see above
const suites = all.concat(['../relay/relaytest.js'])
  .filter(f => !(fast && FAST_SKIP.includes(f)))
  .sort((a, b) => cost(b) - cost(a));                                           // longest first, by measurement

const t0 = Date.now();
const results = [];
let next = 0, port = 8600;

function runOne(file, lane) {
  return new Promise(res => {
    const started = Date.now();
    const p = spawn('node', [file], { cwd: here, detached: true, env: Object.assign({}, process.env, { PORT: String(port++) }) });
    let out = '', timedOut = false;
    const killer = setTimeout(() => {
      timedOut = true;
      try { process.kill(-p.pid, 'SIGKILL'); } catch (e) { try { p.kill('SIGKILL'); } catch (e2) {} }
    }, TIMEOUT_MS);
    p.stdout.on('data', d => out += d); p.stderr.on('data', d => out += d);
    p.on('close', code => {
      clearTimeout(killer);
      if (timedOut) out += `\nFAILED — KILLED after ${TIMEOUT_MS / 1000}s (hung; it held a lane). Run it alone to see where.\n`;
      const secs = ((Date.now() - started) / 1000).toFixed(0);
      /* THE WHOLE SUMMARY LINE, not just the PASS/FAIL fragment. Suites append their own evidence there —
       * `nettest_sync` reports `· rounds N, actions M` — and truncating it hid a real effect: under parallel
       * load that suite stopped hitting its 60-action cap and started hitting its 120s WALL CLOCK, i.e. it
       * went green having tested less. A runner that crops the evidence makes that invisible. */
      const line = (out.match(/^.*PASS: \d+\s+FAIL: \d+.*$/m) || [null])[0];
      const m = out.match(/PASS: (\d+)\s+FAIL: (\d+)/);
      const failed = timedOut || code !== 0 || /^FAILED/m.test(out) || (m && +m[2] > 0);
      results.push({ file, code, secs, out, failed, counts: m ? m[0] : '(no PASS line)' });
      console.log(`${failed ? '✗' : '✓'} ${file.padEnd(30)} ${String(secs).padStart(3)}s  ${timedOut ? 'TIMED OUT — killed' : (line ? line.trim() : '')}`);
      res();
    });
  });
}
async function lane(i) { while (next < suites.length) { const f = suites[next++]; await runOne(f, i); } }

(async () => {
  console.log(`sweep: ${suites.length} suites, ${jobs} at a time${fast ? `  (--fast: ${FAST_SKIP.length} slow stable suites skipped)` : ''}\n`);
  await Promise.all(Array.from({ length: jobs }, (_, i) => lane(i)));
  const bad = results.filter(r => r.failed);
  const wall = ((Date.now() - t0) / 1000).toFixed(0);
  writeTimes(TIMES, results);
  /* A GREEN SUITE'S OWN WARNINGS WERE BEING THROWN AWAY, which is the same mistake as cropping the summary
   * line, one step earlier: a suite that PASSED while telling you it nearly did not is invisible. Every one
   * of these lines exists because somebody was bitten by the thing it reports — `lessonlib` prints
   * "OVER HALF THE BUDGET" precisely so a poll returning at 13.4s of 14s is visible before the day it returns
   * at 14.1s; `netwindows` prints how many unscripted windows it auto-passed; `nettest_sync` says when it
   * stopped on the WALL CLOCK having tested less. All of them only ever printed into a buffer that was
   * discarded unless the suite went red. */
  const warned = results.filter(r => !r.failed).map(r => ({ file: r.file,
    lines: r.out.split('\n').filter(l => /OVER HALF THE BUDGET|TIME-CAPPED|WALL CLOCK|poll TIMED OUT|⚠/.test(l)) })).filter(r => r.lines.length);
  if (warned.length) {
    console.log('\n──── warnings (these suites PASSED) ────');
    warned.forEach(r => { console.log(`\n=== ${r.file}`); console.log(r.lines.slice(0, 6).map(l => l.trim()).join('\n')); });
  }
  if (bad.length) {
    console.log('\n──── failures ────');
    bad.forEach(r => { console.log(`\n=== ${r.file} (exit ${r.code})`); console.log(r.out.split('\n').filter(l => /^✗|FAILED|TIMED OUT|ERROR|⚠|⏱/.test(l)).slice(0, 16).join('\n')); });   // ⚠ and ⏱ too: suites print their OWN diagnosis, and cropping it is how a failure arrives unexplained
  }
  console.log(`\n${bad.length ? 'FAILED — ' : ''}${suites.length - bad.length}/${suites.length} suites green in ${wall}s`);
  process.exit(bad.length ? 1 : 0);
})();
