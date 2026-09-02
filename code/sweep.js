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
 * LONGEST FIRST — kept on theory, NOT on measurement, and the distinction is deliberate. The floor for N lanes
 * is max(total_work / N, longest_single_suite), and bad ordering strands a slow suite in the tail; standard LPT
 * scheduling, one line, and it cannot make things worse. But A/B'd against the WORST case (shortest first),
 * interleaved, it measured as **indistinguishable**: longest 235s/142s vs shortest 168s/157s — a 26s gap
 * between arms against a 93s spread WITHIN one arm. This machine's desktop load swamps it.
 * So: do not quote a number for this, and do not remove it expecting a slowdown either. */
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

/* The six slowest, measured. `--fast` skips them: they are layout / smoke / multiplayer-parity / export, they
 * change rarely, and they are 51% of the wall clock. NEVER put a netplay suite in here — all 44 together are
 * 196s, and nettest_elim3 once sat red for five versions because a change "did not look related". */
const SLOW = ['landscapetest.js', 'browsertest.js', 'mptest.js', 'exporttest.js', 'rulestest.js', 'lessontest_twos.js'];

const here = __dirname;
const all = fs.readdirSync(here)
  .filter(f => /\.js$/.test(f))
  .filter(f => /^(nettest_|lessontest)/.test(f) || ['test.js','netview.test.js','mptest.js','rulestest.js','landscapetest.js','decktest.js','viewtest.js','piletest.js','revealtest.js','phantasmtest.js','exporttest.js','versiontest.js','sharetest.js','qrtest.js','peektest.js','browsertest.js'].includes(f))
  .filter(f => !['nettest_lobby.js','nettest.js','lessonlib.js'].includes(f));   // helpers, and the BroadcastChannel probe that is not a suite
const suites = all.concat(['../relay/relaytest.js'])
  .filter(f => !(fast && SLOW.includes(f)))
  .sort((a, b) => (SLOW.includes(b) ? 1 : 0) - (SLOW.includes(a) ? 1 : 0));      // longest first

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
  console.log(`sweep: ${suites.length} suites, ${jobs} at a time${fast ? '  (--fast: six slow stable suites skipped)' : ''}\n`);
  await Promise.all(Array.from({ length: jobs }, (_, i) => lane(i)));
  const bad = results.filter(r => r.failed);
  const wall = ((Date.now() - t0) / 1000).toFixed(0);
  if (bad.length) {
    console.log('\n──── failures ────');
    bad.forEach(r => { console.log(`\n=== ${r.file} (exit ${r.code})`); console.log(r.out.split('\n').filter(l => /^✗|FAILED|TIMED OUT|ERROR|⚠|⏱/.test(l)).slice(0, 16).join('\n')); });   // ⚠ and ⏱ too: suites print their OWN diagnosis, and cropping it is how a failure arrives unexplained
  }
  console.log(`\n${bad.length ? 'FAILED — ' : ''}${suites.length - bad.length}/${suites.length} suites green in ${wall}s`);
  process.exit(bad.length ? 1 : 0);
})();
