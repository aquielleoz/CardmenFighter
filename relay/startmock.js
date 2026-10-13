/* START relay/mock.js ON A PORT THIS RUN OWNS, OR FAIL LOUDLY — a shared test helper, not a suite (2026-10-13).
 *
 *   var mock = await require('../relay/startmock.js')(port);   // resolves with the child process
 *
 * THE SUITES USED TO SPAWN THE MOCK BLIND: `stdio:'ignore'` and a fixed `wait(700)`. A mock that cannot bind its
 * port exits on EADDRINUSE, and with its output ignored nobody saw it, so the suite carried on against whatever
 * held the port. Two copies of `nettest_sync` at once (a four-lane batch of one suite) therefore shared ONE mock
 * on its hardcoded 8835, and when the copy that owned it exited it killed the mock under any copy still
 * mid-handshake: the host had its room, the guest's claim reached nothing, and the run timed out in `startDuel`
 * as `FAILED — PASS: 8  FAIL: 4  · rounds 0, actions 0`, 2 runs in 54 (`nettest-sync-never-deals`). Forced by
 * holding the port with a foreign mock and killing it once the host had its room code: the same line, the same
 * 81 seconds. A plain sweep never saw it, because it runs one copy of each suite.
 * SO TWO RULES, ONE PER HALF: the CALLER derives the port from PORT, which the sweep and every batch already make
 * unique (PORT + 500 keeps the old by-hand defaults and clears the sweep's 8600-8723 page ports); and THIS waits
 * for the mock's own listen line and rejects, naming the port, if the process exits first. */
var spawn = require('child_process').spawn, path = require('path');

module.exports = function startMock(port, budgetMs) {
  budgetMs = budgetMs || 8000;   // a hang guard, not a race: it returns on the listen line
  return new Promise(function (resolve, reject) {
    var ch = spawn(process.execPath, [path.join(__dirname, 'mock.js'), String(port)], { stdio: ['ignore', 'pipe', 'pipe'] });
    var out = '', settled = false;
    function finish(err) { if (settled) return; settled = true; clearTimeout(timer); if (err) reject(err); else resolve(ch); }
    var timer = setTimeout(function () {
      finish(new Error('relay mock did not report listening on port ' + port + ' within ' + budgetMs + 'ms'));
      try { ch.kill(); } catch (e) {}
    }, budgetMs);
    ch.stdout.on('data', function (d) { out += d; if (/relay mock on /.test(out)) finish(null); });
    ch.stderr.on('data', function (d) { out += d; });
    ch.on('exit', function (code) {
      finish(new Error('relay mock could not take port ' + port +
        (/EADDRINUSE/.test(out) ? ' (EADDRINUSE: another run of this suite, or a stray mock, holds it)' : ' (it exited ' + code + ')') +
        ' — each run derives its mock port from PORT, so concurrent runs need distinct PORTs'));
    });
  });
};
