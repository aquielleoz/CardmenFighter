/* ANSWER PRIORITY WINDOWS THE SUITE DID NOT SCRIPT — shared helper, NOT a suite (the `nettest_lobby.js`
 * and `lessonlib.js` convention). Don't run it directly.
 *
 * WHY IT EXISTS, measured 2026-09-10. When the Fight End prompt default widened to "every legal timing",
 * `nettest_3p` began HANGING — 4 times in 8 runs, against 8/8 clean on the build before it, at any port and
 * at `-j 1` as well as `-j 4`. The mechanism was an absence: that file contains no reference to a modal at
 * all, so a client seat was offered priority, nobody answered, and the host parked until `sweep.js`
 * SIGKILLed it at 300 seconds.
 * IT WAS NEVER ONE SUITE. **27 netplay suites drive play and never answer a window**, and all of them were
 * green only because the old Fight End window opened for a threatened seat holding a whitelisted card —
 * rare. Widen the window and 27 suites are one unlucky deal from a 300s hang. That is worse than a red
 * suite: an unreliable sweep makes every OTHER result unreadable.
 * This is CLAUDE.md's `nettest_sync` lesson generalised — *the harness must be able to play the whole
 * game, or its green runs mean less than they look* — and the same move `lessonlib` already made for the
 * tutorials.
 *
 * A GRACE DELAY RATHER THAN AN OPT-OUT FLAG, and that is the whole design. Ten suites drive these windows
 * DELIBERATELY (`nettest_guard` springs Leyline, `nettest_priosig` asserts a re-grant), so a poller that
 * clicked the moment a modal appeared would steal their windows and turn one flake into ten. A suite that
 * means to act does so in milliseconds; an unscripted window sits open forever. So this waits `graceMs`
 * (default 6s) of one window being CONTINUOUSLY open before passing it — no per-suite bookkeeping, safe by
 * construction, and a slow machine costs a late pass rather than a stolen one. `manualWindows` is still
 * there as an explicit escape for a suite that wants a window to stay open longer than that.
 *
 * IT PASSES, IT NEVER CASTS. `.respQuick` is never clicked: choosing a card for a suite would silently
 * change what the suite measures. It answers with the decline button and nothing else.
 *
 * AND IT SAYS SO OUT LOUD. A suite that auto-passed forty windows has drifted from what it claims to test,
 * and silence would hide that — the same reason `lessonlib` prints its ⚠ line. First occurrence and then
 * every 25th, so the sweep output stays readable while the scale is still visible.
 */
/* `NETWINDOWS_GRACE=<ms>` overrides the delay — and it exists because the FIRST ten-run check of this
   helper came back 10/10 green with zero auto-passes, which is exactly what "it fixed the hang" and "it
   never fired and I got lucky" both look like. Setting it enormous arms the helper without letting it act,
   which is the only way to A/B the helper against itself with every other code path identical. */
const GRACE_MS = +(process.env.NETWINDOWS_GRACE || 6000);

async function install(page, label, opts) {
  opts = opts || {};
  const grace = opts.graceMs != null ? opts.graceMs : GRACE_MS;
  await page.evaluate(function (grace) {
    if (window.__nw) return;                       // idempotent: a suite may install twice via startDuel
    window.__nw = { n: 0, seenAt: 0, kind: null, last: null };
    var PASS = [['respDecline', 'Respond?'], ['pfDecline', 'pre-fight'], ['sgNo', 'shield guard']];
    setInterval(function () {
      var ov = document.getElementById('overlay');
      if (!ov || !ov.classList.contains('show')) { window.__nw.seenAt = 0; return; }
      var btn = null, kind = null;
      for (var i = 0; i < PASS.length; i++) {
        var el = document.getElementById(PASS[i][0]);
        if (el && el.offsetParent && !el.disabled) { btn = el; kind = PASS[i][1]; break; }
      }
      if (!btn) { window.__nw.seenAt = 0; return; }          // some other modal (discard picker, end screen)
      var now = Date.now();
      if (!window.__nw.seenAt) { window.__nw.seenAt = now; window.__nw.kind = kind; return; }
      if (now - window.__nw.seenAt < grace) return;          // the suite still has time to drive it itself
      btn.click(); window.__nw.n++; window.__nw.last = kind; window.__nw.seenAt = 0;
    }, 250);
  }, grace);
  /* VERIFY THE INSTRUMENT, because a helper that silently installed nothing is indistinguishable from a
     game that never opened a window — and the first ten-run check of this file reported 10/10 green with
     ZERO auto-passes logged, which is exactly what both look like. `page.evaluate` on a page that has not
     navigated yet would do precisely that. CLAUDE.md: a throwaway diagnostic is the least trustworthy code
     in the room, and any probe that patches must assert its anchor. */
  const armed = await page.evaluate(() => !!window.__nw);
  if (!armed) throw new Error('netwindows[' + label + ']: install did not take — is the page navigated yet?');

  let reported = 0;
  const timer = setInterval(async () => {
    try {
      const s = await page.evaluate(() => window.__nw ? { n: window.__nw.n, last: window.__nw.last } : null);
      if (s) install._seen[label] = s.n;
      if (!s || s.n === reported) return;
      if (s.n === 1 || s.n % 25 === 0) console.log('   ⚠ netwindows[' + label + ']: auto-passed a ' + s.last + ' window the suite does not script (' + s.n + ' so far)');
      reported = s.n;
    } catch (e) { clearInterval(timer); }                    // the page closed — nothing left to watch
  }, 1000);
  if (timer.unref) timer.unref();                            // never hold the process open
  /* AND SAY THE TOTAL ON THE WAY OUT. Suites end in `process.exit()`, so the 1s poller above can miss the
     last windows entirely — which is why the first version of this file looked like it had never fired.
     An `exit` handler runs on an explicit exit, but cannot await, so it prints the last count the poller
     saw. A suite auto-passing dozens of windows has drifted from what it claims to test; that must not be
     silent. */
  if (!install._exitHooked) {
    install._exitHooked = true;
    process.on('exit', function () {
      var tot = Object.keys(install._seen).reduce(function (a, k) { return a + install._seen[k]; }, 0);
      if (tot > 0) console.log('   ⚠ netwindows: auto-passed ' + tot + ' unscripted window(s) — ' +
        Object.keys(install._seen).map(function (k) { return k + ':' + install._seen[k]; }).join(' '));
    });
  }
  return () => clearInterval(timer);
}

install._seen = {};
module.exports = install;
module.exports.install = install;
module.exports.count = p => p.evaluate(() => (window.__nw ? window.__nw.n : 0)).catch(() => 0);
