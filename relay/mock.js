/* A LOCAL STAND-IN FOR THE RELAY — same protocol, in memory, zero dependencies.
 *
 *   node relay/mock.js 8790
 *
 * Two jobs. It lets `relaytest.js` test the CONTRACT without deploying anything, and it lets the client side of
 * the game be built and driven in tests before a Worker exists at all.
 *
 * WHAT IT DOES NOT DO: prove the D1 SQL in worker.js. The two implement the same contract by hand, so a bug in
 * one is invisible here — which is exactly why relaytest.js takes a base URL and can be pointed at the real
 * deployment. Treat green-against-mock as "the protocol is coherent", never as "the Worker works". */
var http = require('http');

var ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', CODE_LEN = 4;
var ROOM_TTL = 10 * 60, MAX_PAYLOAD = 4096, MAX_SLOTS = 8;
var rooms = {};                                    // code -> { expires, slots: [ {offer, answer, claimed} ] }

function now() { return Math.floor(Date.now() / 1000); }
function makeCode() {
  var s = '';
  for (var i = 0; i < CODE_LEN; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return s;
}
function cleanCode(raw) {
  var up = String(raw || '').toUpperCase().split('').filter(function (c) { return ALPHABET.indexOf(c) >= 0; }).join('');
  return up.length === CODE_LEN ? up : null;
}
function checkPayload(v) {
  if (typeof v !== 'string' || !v.length) return 'missing';
  if (v.length > MAX_PAYLOAD) return 'too long';
  return null;
}
function live(code) {
  var r = rooms[code];
  if (r && r.expires < now()) { delete rooms[code]; return null; }
  return r || null;
}

var CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
             'Access-Control-Allow-Headers': 'Content-Type' };
function send(res, status, body) {
  var h = Object.assign({ 'Cache-Control': 'no-store' }, CORS);
  if (body === undefined) { res.writeHead(status, h); return res.end(); }
  h['Content-Type'] = 'application/json';
  res.writeHead(status, h); res.end(JSON.stringify(body));
}

function handle(req, res, body) {
  var u = new URL(req.url, 'http://x'), parts = u.pathname.split('/').filter(Boolean);
  var data = null; try { data = body ? JSON.parse(body) : null; } catch (e) { data = null; }

  if (req.method === 'OPTIONS') return send(res, 204);
  if (req.method === 'GET' && !parts.length) return send(res, 200, { ok: true, service: 'cardmen-relay-mock', v: 1 });

  if (req.method === 'POST' && parts[0] === 'new' && parts.length === 1) {
    var e1 = checkPayload(data && data.offer);
    if (e1) return send(res, 400, { error: 'offer ' + e1 });
    var code; do { code = makeCode(); } while (rooms[code]);
    rooms[code] = { expires: now() + ROOM_TTL, slots: [{ offer: data.offer, answer: null, claimed: 0 }] };
    return send(res, 201, { room: code, slot: 0, expires: rooms[code].expires });
  }

  if (parts[0] !== 'r' || !parts[1]) return send(res, 404, { error: 'not found' });
  var code2 = cleanCode(parts[1]);
  if (!code2) return send(res, 400, { error: 'that is not a room code' });
  var tail = parts[2] || '';

  if (req.method === 'DELETE' && !tail) { delete rooms[code2]; return send(res, 204); }

  var room = live(code2);
  if (!room) return send(res, 404, { error: 'no such room — it may have expired' });

  if (req.method === 'POST' && tail === 'offer') {
    var e2 = checkPayload(data && data.offer);
    if (e2) return send(res, 400, { error: 'offer ' + e2 });
    if (room.slots.length >= MAX_SLOTS) return send(res, 409, { error: 'that room is full' });
    room.slots.push({ offer: data.offer, answer: null, claimed: 0 });
    return send(res, 201, { slot: room.slots.length - 1 });
  }

  if (req.method === 'POST' && tail === 'claim') {
    /* Node is single-threaded per tick, so this is atomic here for free. That is a property of the MOCK, not of
     * the protocol — the Worker has to earn it with a single UPDATE ... RETURNING, and relaytest asserts the
     * behaviour so the real thing can be held to it. */
    for (var i = 0; i < room.slots.length; i++) {
      if (!room.slots[i].claimed) {
        room.slots[i].claimed = 1;
        return send(res, 200, { slot: i, offer: room.slots[i].offer });
      }
    }
    return send(res, 204);
  }

  if (req.method === 'POST' && tail === 'answer') {
    var e3 = checkPayload(data && data.answer);
    if (e3) return send(res, 400, { error: 'answer ' + e3 });
    var slot = Number(data && data.slot);
    if (!Number.isInteger(slot) || slot < 0 || !room.slots[slot]) return send(res, 409, { error: 'no such slot' });
    if (room.slots[slot].answer !== null) return send(res, 409, { error: 'that slot is already answered' });
    room.slots[slot].answer = data.answer;
    return send(res, 204);
  }

  if (req.method === 'GET' && tail === 'answers') {
    var since = Number(u.searchParams.get('since'));
    if (!Number.isInteger(since)) since = -1;
    var out = [];
    room.slots.forEach(function (s, i) { if (s.answer !== null && i > since) out.push({ slot: i, answer: s.answer }); });
    return send(res, 200, { answers: out });
  }

  if (req.method === 'GET' && !tail) {
    return send(res, 200, { room: code2, slots: room.slots.length,
                            answered: room.slots.filter(function (s) { return s.answer !== null; }).length });
  }
  return send(res, 404, { error: 'not found' });
}

var PORT = parseInt(process.argv[2], 10) || 8790;
http.createServer(function (req, res) {
  var chunks = [];
  req.on('data', function (c) { chunks.push(c); });
  req.on('end', function () {
    try { handle(req, res, Buffer.concat(chunks).toString('utf8')); }
    catch (e) { send(res, 500, { error: 'mock error: ' + e.message }); }
  });
}).listen(PORT, '127.0.0.1', function () {
  console.log('relay mock on http://127.0.0.1:' + PORT);
});

module.exports = { ALPHABET: ALPHABET, CODE_LEN: CODE_LEN };
