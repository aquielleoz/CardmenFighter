-- D1 schema for the Cardmen Fighter signalling relay.
--   wrangler d1 execute cardmen-relay --file relay/schema.sql --remote
--
-- A room is a MAILBOX OF SLOTS, not a single offer/answer pair, because WebRTC offers are not reusable: a host
-- at a 6-player table must mint one per peer. One room code covers the whole table, which is the point — the
-- code is the thing a human handles and it must not change per player.
CREATE TABLE IF NOT EXISTS rooms (
  code    TEXT PRIMARY KEY,
  created INTEGER NOT NULL,
  expires INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS slots (
  code    TEXT    NOT NULL,
  slot    INTEGER NOT NULL,
  offer   TEXT    NOT NULL,
  answer  TEXT,
  -- `claimed` is what makes the handshake safe with several joiners at once: a claim is
  -- `UPDATE ... WHERE claimed = 0 ... RETURNING`, one statement, so two joiners can never take the same offer.
  -- Without it one of them silently answers an offer the other is already using.
  claimed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (code, slot)
);

-- The host polls `answers?since=n`, so this is the hot path.
CREATE INDEX IF NOT EXISTS slots_by_room ON slots (code, slot);
-- Expiry is swept lazily on any request rather than by a cron job — one less moving part to deploy.
CREATE INDEX IF NOT EXISTS rooms_by_expiry ON rooms (expires);
