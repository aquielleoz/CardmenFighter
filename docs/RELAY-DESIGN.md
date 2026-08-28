# The relay

**Status: protocol designed and tested against a local mock. Worker written, NOT yet deployed.**

Aj, 2026-08-28: *"let's do it, the relay. the no server really wasn't a hard rule. i just am not able to pay for
hosting costs."*

## What it is for

Today **you** are the signalling channel, and it is a round trip: the host makes an invite, you carry it to the
other player, they make a reply, you carry it back. Two exchanges in opposite directions. Every improvement so
far — the QR, the share sheet, codes six times shorter, two-column landscape — made each exchange cheaper
without removing either one. That is why it still felt bad.

The relay removes the carrying. A host gets a **four-character room code**; a joiner types it. One exchange, one
direction, short enough to say out loud.

**The game itself stays peer-to-peer.** The relay carries only the handshake. Once the two browsers have found
each other they connect directly and the relay is out of the loop for the whole game — exactly as now.

## Cost, which is the binding constraint

Free tier, and not marginally ([pricing](https://developers.cloudflare.com/workers/platform/pricing/),
[limits](https://developers.cloudflare.com/workers/platform/limits/index.md)):

| | free allowance | what a handshake costs |
| --- | --- | --- |
| Workers requests | **100,000 / day** | ~70 (host polls ~1/1.5s while waiting) |
| D1 reads/writes | **5M / month** | ~70 reads, 3 writes |

That is roughly **1,400 games a day** before anything is exceeded, and nothing auto-upgrades — a Worker over
its limit is throttled, not billed. There is no path here where this costs money without deliberately choosing
a paid plan.

**Deliberately NOT used:**
- **WebSockets + Durable Objects.** DO *is* free (SQLite backend, 1M requests/month), and a socket would be
  more elegant than polling. It is also a second billing dimension, a lifecycle to reason about, and a thing
  to get wrong. Polling's cost is a number you can multiply in your head. Boring wins.
- **KV.** 100K reads/writes a day would be plenty, but KV is **eventually consistent** — up to ~60s to
  propagate. A handshake is the one workload that cannot tolerate that.

## The problem worth getting right

A naive room holds one offer and one answer. **That does not work for 3-6 players**, because WebRTC offers are
not reusable: the host must mint a *separate* offer per peer (which is exactly what `hostNewInvite()` already
does today).

So a room is a **mailbox of slots**, not a single pair:

- the host posts an offer into a new slot
- a joiner **claims** the next unclaimed slot and answers it
- the host collects answers and immediately posts a fresh offer, so the next joiner always has one waiting

The claim must be atomic or two joiners take the same offer and one of them silently fails. `UPDATE ... WHERE
claimed = 0 ... RETURNING` gives that in one statement — SQLite supports `RETURNING`, so no transaction is
needed.

One room code covers a whole 6-player table, which is the point: the code is what a human handles, and it
should not change per player.

## Protocol (v1)

JSON over HTTPS. `<base>` is the deployed Worker.

| | | |
| --- | --- | --- |
| `POST /new` | `{offer}` | → `{room:"7QX4", slot:0, expires}` — creates the room and its first slot |
| `POST /r/<code>/offer` | `{offer}` | → `{slot:n}` — the host adds another slot for the next player |
| `POST /r/<code>/claim` | — | → `{slot:n, offer}` or `204` if none free. **Atomic.** |
| `POST /r/<code>/answer` | `{slot, answer}` | → `204` |
| `GET /r/<code>/answers?since=n` | — | → `{answers:[{slot, answer}]}` — the host polls this |
| `DELETE /r/<code>` | — | → `204`, once the table is assembled |

**Codes are 4 characters** from a 31-char alphabet with the ambiguous glyphs removed (no `O`/`0`, no `I`/`1`/`L`)
— about 920,000 combinations, and rooms live minutes, so collisions are rare and handled by retrying the
insert. Four characters is the whole point: sayable over voice, typeable without care.

## Deliberate limits

- **Rooms expire after 10 minutes** and are deleted the moment the host is done. Expired rows are swept lazily
  on any request, so no cron job is needed.
- **Payloads are capped at 4KB.** An invite is ~163-350 characters; anything near the cap is not a game.
- **Nothing identifies a player.** The relay stores an SDP and a room code, nothing else — no names, no decks,
  no game state.

## Privacy, stated plainly

**An SDP contains IP addresses.** Today only the two players see them; with a relay, the relay sees them for the
minutes a room lives. That is a real change and it should be said in the UI rather than buried here — the
netbar's "no server" becomes false and must be rewritten to something accurate.

## The fallback is not optional

If the relay is unreachable, or the player is using the downloaded offline file with no network, **the manual
copy-paste flow must still work exactly as it does today.** The relay is an additional front door, never a
replacement — the single self-contained HTML remains the artifact you can hand someone with no internet at all.

## Runbook — deploying and redeploying

Written down because it is a once-every-few-months task and nobody remembers it. **Run everything from
`relay/`**, because `main` in `wrangler.toml` is relative to that file.

### First time on a machine

```bash
npx wrangler login
```

That is the **only** per-machine step. The account cache it writes lands in `.wrangler/`, which is gitignored —
it holds the account id and name, no token, but there is no reason for it to be public.

### Deploying a change

```bash
npx wrangler deploy
```

### Things that already exist and must NOT be redone

- **`wrangler d1 create`** — the database exists, and its `database_id` is committed in `wrangler.toml`, so a
  fresh clone is already configured. Running `create` again makes a **second, empty** database and you will
  deploy against the wrong one.
- **The `workers.dev` subdomain** — account-wide and effectively permanent, since changing it breaks every
  existing URL. It is deliberately named after Aj rather than after this game: every future Worker shares it.
- **The schema** — already applied. `schema.sql` is `CREATE TABLE IF NOT EXISTS` throughout, so re-running it is
  harmless if you are unsure.

### Where it runs

**On Cloudflare, not on your machine.** This is the whole difference from the Cloudflare *tunnel* experiment
(`docs/ORIGIN-EXPERIMENT.md`), where the server WAS the laptop and had to stay running. Once deployed the relay
is up whether any of your machines are on or not, which is what makes it a product rather than an instrument.

### After deploying

```bash
node relaytest.js https://cardmen-relay.<subdomain>.workers.dev
```

Twenty assertions against the real thing. **This is the step that turns `worker.js` from reviewed code into
tested code** — the mock and the Worker implement the same contract by hand, so a bug in one is invisible to
the other.

## What is tested, and what is not

`relay/relaytest.js` tests the **protocol**, including the atomic claim under concurrency, against
`relay/mock.js` — a zero-dependency Node server implementing the same contract. The same suite can be pointed
at a real deployment (`node relaytest.js https://…`), which is how the Worker itself gets verified.

**Be honest about the gap:** until it is deployed and that suite is run against it, `relay/worker.js` is
reviewed code, not tested code. The mock proves the protocol and the client can be built against it; it does
not prove the D1 SQL.
