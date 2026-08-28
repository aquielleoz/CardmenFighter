/* THE CARDMEN FIGHTER SIGNALLING RELAY — a Cloudflare Worker over D1.
 *
 * It carries the WebRTC handshake and nothing else. Once two browsers have exchanged an offer and an answer
 * they connect directly; the relay is out of the loop for the whole game. It never sees a card, a name or a
 * rule set.
 *
 * WHY POLLING AND NOT A WEBSOCKET. Durable Objects are on the free plan and a socket would be tidier, but it
 * is a second billing dimension and a lifecycle to get wrong. Polling's cost is a number you can multiply in
 * your head: ~70 requests per handshake against 100,000/day. See docs/RELAY-DESIGN.md.
 *
 * WHY A MAILBOX OF SLOTS AND NOT ONE OFFER. WebRTC offers are not reusable — a host at a 6-player table mints
 * one per peer. So a room holds a sequence of slots and a joiner CLAIMS one. The claim is a single
 * `UPDATE ... WHERE claimed = 0 ... RETURNING`, which is what stops two joiners taking the same offer; with
 * separate read-then-write, one of them silently answers an offer the other is already using.
 */

/* No O/0 and no I/1/L: the code gets read aloud and typed by hand, so ambiguous glyphs are a bug. 31^4 is
 * ~920k combinations and rooms live ten minutes, so a collision is rare and handled by retrying the insert. */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LEN = 4;
const ROOM_TTL = 10 * 60;          // seconds. Long enough to fumble a code, short enough to forget an SDP.
const MAX_PAYLOAD = 4096;          // an invite is ~163-350 chars; anything near this is not a game
const MAX_SLOTS = 8;               // 6 players plus slack — a bound on what one room can cost

const CORS = {
  /* The game runs from file://, content:// and https:// copies, all of which are different origins (or no
   * origin at all), so this cannot be an allow-list. It is safe here BECAUSE the relay holds nothing worth
   * stealing and nothing is authenticated: knowing a room code is the only capability there is. */
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400'
};

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS }
  });
}
function empty(status = 204) { return new Response(null, { status, headers: { ...CORS } }); }
function bad(msg, status = 400) { return json({ error: msg }, status); }

function now() { return Math.floor(Date.now() / 1000); }

function makeCode() {
  const b = new Uint8Array(CODE_LEN);
  crypto.getRandomValues(b);
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += ALPHABET[b[i] % ALPHABET.length];
  return s;
}

/* Codes are typed by hand, so accept lower case and strip anything that is not in the alphabet — a pasted
 * "room 7qx4." should work. Returns null when what is left is not a plausible code. */
function cleanCode(raw) {
  const up = String(raw || '').toUpperCase().split('').filter(c => ALPHABET.indexOf(c) >= 0).join('');
  return up.length === CODE_LEN ? up : null;
}

function checkPayload(v) {
  if (typeof v !== 'string' || !v.length) return 'missing';
  if (v.length > MAX_PAYLOAD) return 'too long';
  return null;
}

/* Lazy sweep: any request may clear a little expired state, so there is no cron job to deploy or forget.
 * Bounded so one unlucky request cannot pay for everyone's garbage. */
async function sweep(db) {
  const t = now();
  await db.batch([
    db.prepare('DELETE FROM slots WHERE code IN (SELECT code FROM rooms WHERE expires < ? LIMIT 50)').bind(t),
    db.prepare('DELETE FROM rooms WHERE expires < ? LIMIT 50').bind(t)
  ]);
}

async function liveRoom(db, code) {
  const r = await db.prepare('SELECT code FROM rooms WHERE code = ? AND expires >= ?').bind(code, now()).first();
  return !!r;
}

async function readJson(req) {
  try { return await req.json(); } catch (e) { return null; }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return empty(204);
    if (!env.DB) return bad('relay is misconfigured: no database binding', 500);

    const url = new URL(req.url);
    const parts = url.pathname.split('/').filter(Boolean);
    const db = env.DB;

    try {
      /* A cheap liveness check, so the game can decide whether to offer the room-code path at all before it
       * shows the player a control that cannot work. */
      if (req.method === 'GET' && parts.length === 0) return json({ ok: true, service: 'cardmen-relay', v: 1 });

      // POST /new  {offer} -> {room, slot, expires}
      if (req.method === 'POST' && parts[0] === 'new' && parts.length === 1) {
        const body = await readJson(req);
        const err = checkPayload(body && body.offer);
        if (err) return bad('offer ' + err);
        await sweep(db);
        const t = now(), expires = t + ROOM_TTL;
        /* Retry on collision rather than checking first — the insert is the authority, and a SELECT then
         * INSERT would race with another host claiming the same code between the two statements. */
        for (let attempt = 0; attempt < 6; attempt++) {
          const code = makeCode();
          try {
            await db.batch([
              db.prepare('INSERT INTO rooms (code, created, expires) VALUES (?, ?, ?)').bind(code, t, expires),
              db.prepare('INSERT INTO slots (code, slot, offer) VALUES (?, 0, ?)').bind(code, body.offer)
            ]);
            return json({ room: code, slot: 0, expires }, 201);
          } catch (e) { /* PRIMARY KEY collision — try another code */ }
        }
        return bad('could not allocate a room code, try again', 503);
      }

      if (parts[0] !== 'r' || !parts[1]) return bad('not found', 404);
      const code = cleanCode(parts[1]);
      if (!code) return bad('that is not a room code', 400);
      const tail = parts[2] || '';

      // DELETE /r/<code>
      if (req.method === 'DELETE' && !tail) {
        await db.batch([
          db.prepare('DELETE FROM slots WHERE code = ?').bind(code),
          db.prepare('DELETE FROM rooms WHERE code = ?').bind(code)
        ]);
        return empty(204);
      }

      if (!(await liveRoom(db, code))) return bad('no such room — it may have expired', 404);

      // POST /r/<code>/offer  {offer} -> {slot}
      if (req.method === 'POST' && tail === 'offer') {
        const body = await readJson(req);
        const err = checkPayload(body && body.offer);
        if (err) return bad('offer ' + err);
        const n = await db.prepare('SELECT COUNT(*) AS n FROM slots WHERE code = ?').bind(code).first();
        if (n && n.n >= MAX_SLOTS) return bad('that room is full', 409);
        /* max(slot)+1 rather than a counter: the row is the state, so nothing can drift out of step with it. */
        const m = await db.prepare('SELECT COALESCE(MAX(slot), -1) AS m FROM slots WHERE code = ?').bind(code).first();
        const slot = (m ? m.m : -1) + 1;
        await db.prepare('INSERT INTO slots (code, slot, offer) VALUES (?, ?, ?)').bind(code, slot, body.offer).run();
        return json({ slot }, 201);
      }

      // POST /r/<code>/claim -> {slot, offer} | 204
      if (req.method === 'POST' && tail === 'claim') {
        /* THE ATOMIC BIT. One statement, so two joiners racing cannot both take the same slot: whichever UPDATE
         * lands second matches no row, because `claimed` is no longer 0. Do not split this into a SELECT and an
         * UPDATE — it reads identically and is wrong exactly when it matters. */
        const got = await db.prepare(
          'UPDATE slots SET claimed = 1 WHERE code = ? AND slot = ' +
          '(SELECT MIN(slot) FROM slots WHERE code = ? AND claimed = 0) RETURNING slot, offer'
        ).bind(code, code).first();
        if (!got) return empty(204);                       // nothing free: the host has not posted one yet
        return json({ slot: got.slot, offer: got.offer });
      }

      // POST /r/<code>/answer  {slot, answer}
      if (req.method === 'POST' && tail === 'answer') {
        const body = await readJson(req);
        const err = checkPayload(body && body.answer);
        if (err) return bad('answer ' + err);
        const slot = Number(body && body.slot);
        if (!Number.isInteger(slot) || slot < 0) return bad('missing slot');
        const r = await db.prepare('UPDATE slots SET answer = ? WHERE code = ? AND slot = ? AND answer IS NULL')
                          .bind(body.answer, code, slot).run();
        /* Refuse to overwrite an answer. A second one for the same slot means a stale client retrying, and
         * letting it through would hand the host an answer for a peer it has already connected. */
        if (r && r.meta && r.meta.changes === 0) return bad('that slot is already answered or does not exist', 409);
        return empty(204);
      }

      // GET /r/<code>/answers?since=n -> {answers:[{slot, answer}]}
      if (req.method === 'GET' && tail === 'answers') {
        const since = Math.max(-1, Number(url.searchParams.get('since') || -1) | 0);
        const rs = await db.prepare(
          'SELECT slot, answer FROM slots WHERE code = ? AND answer IS NOT NULL AND slot > ? ORDER BY slot'
        ).bind(code, since).all();
        return json({ answers: (rs && rs.results) || [] });
      }

      // GET /r/<code> -> {slots, answered} — a status peek, for a host reopening its own lobby
      if (req.method === 'GET' && !tail) {
        const s = await db.prepare(
          'SELECT COUNT(*) AS slots, COUNT(answer) AS answered FROM slots WHERE code = ?'
        ).bind(code).first();
        return json({ room: code, slots: (s && s.slots) || 0, answered: (s && s.answered) || 0 });
      }

      return bad('not found', 404);
    } catch (e) {
      /* Never leak SQL or stack traces to a public endpoint; the message is for the player, not the developer. */
      return bad('relay error', 500);
    }
  }
};
