/* THE RELAY PROTOCOL SUITE.
 *
 *   node relay/relaytest.js                       # spawns relay/mock.js and tests against it
 *   node relay/relaytest.js https://your.workers.dev   # tests a REAL deployment, same assertions
 *
 * The second form is the point. The mock and the Worker implement the same contract by hand, so a bug in one is
 * invisible to the other — pointing this suite at the deployed Worker is what turns worker.js from reviewed
 * code into tested code. Until that is run, say so.
 *
 * Zero dependencies, like the rest of the repo. */
var http = require('http'), https = require('https'), { spawn } = require('child_process');

var pass = 0, fail = 0;
function ok(c, m) { if (c) { pass++; console.log('✓ ' + m); } else { fail++; console.log('✗ ' + m); } }
function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

var BASE = process.argv[2] || null, child = null;

function req(method, path, body) {
  return new Promise(function (resolve, reject) {
    var u = new URL(BASE + path), lib = u.protocol === 'https:' ? https : http;
    var data = body === undefined ? null : JSON.stringify(body);
    var r = lib.request({ hostname: u.hostname, port: u.port || (u.protocol === 'https:' ? 443 : 80),
                          path: u.pathname + u.search, method: method,
                          headers: data ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) } : {} },
      function (res) {
        var c = [];
        res.on('data', function (x) { c.push(x); });
        res.on('end', function () {
          var t = Buffer.concat(c).toString('utf8'), j = null;
          try { j = t ? JSON.parse(t) : null; } catch (e) {}
          resolve({ status: res.statusCode, body: j, raw: t });
        });
      });
    r.on('error', reject);
    if (data) r.write(data);
    r.end();
  });
}

(async function () {
  if (!BASE) {
    child = spawn(process.execPath, [__dirname + '/mock.js', '8791'], { stdio: 'ignore' });
    BASE = 'http://127.0.0.1:8791';
    await wait(600);
    console.log('testing the MOCK — this proves the protocol, NOT the Worker\'s SQL\n');
  } else {
    console.log('testing a real deployment: ' + BASE + '\n');
  }

  var health = await req('GET', '/');
  ok(health.status === 200 && health.body && health.body.ok, 'the relay answers a liveness check');

  // ---------- the two-player happy path
  var mk = await req('POST', '/new', { offer: 'C1~o~OFFER-ONE' });
  ok(mk.status === 201 && /^[A-Z2-9]{4}$/.test(mk.body.room || ''),
     'POST /new returns a 4-character room code (' + (mk.body && mk.body.room) + ')');
  var room = mk.body.room;
  /* THE CODE IS READ ALOUD AND TYPED, so the ambiguous glyphs must never appear in one. Asserted on the code
   * we actually got — a generator that emitted O or l would be a support problem, not a style one. */
  ok(!/[O0IL1]/.test(room), '  → and contains none of O 0 I L 1, which get misheard and mistyped');

  var claim = await req('POST', '/r/' + room + '/claim');
  ok(claim.status === 200 && claim.body.offer === 'C1~o~OFFER-ONE' && claim.body.slot === 0,
     'a joiner claims the offer out of the room');
  var again = await req('POST', '/r/' + room + '/claim');
  ok(again.status === 204, '  → and a second claim finds nothing, because the first one took it');

  ok((await req('POST', '/r/' + room + '/answer', { slot: 0, answer: 'C1~a~ANSWER-ONE' })).status === 204,
     'the joiner posts its answer into that slot');
  var dup = await req('POST', '/r/' + room + '/answer', { slot: 0, answer: 'C1~a~SOMETHING-ELSE' });
  ok(dup.status === 409, '  → and a SECOND answer for the same slot is refused, not silently overwritten');

  var ans = await req('GET', '/r/' + room + '/answers?since=-1');
  ok(ans.status === 200 && ans.body.answers.length === 1 && ans.body.answers[0].answer === 'C1~a~ANSWER-ONE',
     'the host polls and finds the answer');
  var none = await req('GET', '/r/' + room + '/answers?since=0');
  ok(none.status === 200 && none.body.answers.length === 0,
     '  → and `since` means the host is not handed the same answer twice');

  // ---------- lower case and surrounding junk, because a code arrives inside a message
  var lower = await req('POST', '/r/' + room.toLowerCase() + '/claim');
  ok(lower.status === 204 || lower.status === 200, 'a lower-case room code resolves to the same room');

  // ---------- several players on ONE code, which is the whole reason for slots
  var multi = await req('POST', '/new', { offer: 'OFFER-A' });
  var mroom = multi.body.room;
  await req('POST', '/r/' + mroom + '/offer', { offer: 'OFFER-B' });
  await req('POST', '/r/' + mroom + '/offer', { offer: 'OFFER-C' });
  var got = [];
  for (var i = 0; i < 3; i++) { var c = await req('POST', '/r/' + mroom + '/claim'); got.push(c.body && c.body.offer); }
  ok(got.join(',') === 'OFFER-A,OFFER-B,OFFER-C',
     'three joiners on ONE room code each claim a DIFFERENT offer — a WebRTC offer is not reusable, which is why slots exist');
  ok((await req('POST', '/r/' + mroom + '/claim')).status === 204, '  → and the fourth finds the room drained');

  // ---------- the atomic claim under real concurrency
  /* THE ASSERTION THIS SUITE EXISTS FOR. Read-then-write reads identically to an atomic claim and is wrong
   * exactly when two joiners arrive together — the far end silently answers an offer someone else is using.
   * Fire eight claims at once at four slots and demand four distinct winners. */
  var race = await req('POST', '/new', { offer: 'R0' });
  var rroom = race.body.room;
  for (var k = 1; k < 4; k++) await req('POST', '/r/' + rroom + '/offer', { offer: 'R' + k });
  var results = await Promise.all([0,1,2,3,4,5,6,7].map(function () { return req('POST', '/r/' + rroom + '/claim'); }));
  var wins = results.filter(function (r) { return r.status === 200; }).map(function (r) { return r.body.slot; });
  var uniq = wins.filter(function (v, i, a) { return a.indexOf(v) === i; });
  ok(wins.length === 4 && uniq.length === 4,
     'eight simultaneous claims against four slots produce exactly four winners, all distinct (' +
     wins.length + ' won, ' + uniq.length + ' distinct)');

  // ---------- refusals
  ok((await req('GET', '/r/ZZZZ/answers?since=-1')).status === 404, 'an unknown room code is a 404, not an empty success');
  ok((await req('POST', '/r/' + room + '/answer', { slot: 99, answer: 'x' })).status === 409, 'answering a slot that does not exist is refused');
  ok((await req('POST', '/new', {})).status === 400, 'POST /new without an offer is refused');
  ok((await req('POST', '/new', { offer: 'x'.repeat(5000) })).status === 400,
     'an oversized payload is refused — an invite is a few hundred characters, so anything near the cap is not a game');
  ok((await req('POST', '/r/' + room + '/claim', undefined)).status !== 500, 'a claim with no body does not fault the relay');

  // ---------- the host tidies up after itself
  ok((await req('DELETE', '/r/' + room)).status === 204, 'the host deletes the room once the table is assembled');
  ok((await req('GET', '/r/' + room + '/answers?since=-1')).status === 404,
     '  → and it is gone, so an SDP does not linger longer than the handshake needs');

  console.log('\n' + (fail ? 'FAILED — ' : '') + 'PASS: ' + pass + '  FAIL: ' + fail);
  if (child) child.kill();
  process.exit(fail ? 1 : 0);
})().catch(function (e) {
  console.log('HARNESS ERROR ' + (e && e.stack || e));
  if (child) child.kill();
  process.exit(1);
});
