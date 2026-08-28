# The origin experiment

**Status: instrument built and validated, not yet run on a phone.** Aj, 2026-08-28: *"let's do an exp on that."*

## Why this exists

Camera scanning is built, green, and deliberately unmerged (`feat/qr-scanning`, PR #29 closed). It is parked on
one claim:

> A file opened from Android's Downloads is `content://` — an opaque origin — so Chrome rejects `getUserMedia`
> **without ever prompting**.

That claim decides a real product question (whether to host the game at a URL), and it has only ever been
checked by watching the *game* fail. Watching a feature fail cannot separate **"the origin refused"** from
**"our code is wrong"** — and this project has already been burned by exactly that confusion twice: the QR
encoder that "no decoder could read" (our bit order), and the `navigator.share` button I argued could not be
rendering (it was, and Aj was looking at it).

So the experiment isolates the variable. `code/origin-probe.html` is one self-contained file with **no game
code** that reports what a browser will actually grant a given origin.

## How to run it

Three cells. **Reading them together is the point** — any one alone tells you almost nothing.

```bash
node code/serve.js 8080
```

Then, in a second terminal:

```bash
cloudflared tunnel --url http://localhost:8080
```

A quick tunnel needs **no account and no config**, prints a `https://<random>.trycloudflare.com` URL, and dies
when you stop it. That is what makes this cheap: an https origin without hosting anything permanently or
creating a lasting public link.

| # | how to open it on the phone | origin | what we expect |
| --- | --- | --- | --- |
| 1 | open `<tunnel>/origin-probe.html?dl=1` (forces a real download), then open it from **Downloads** | `content://` | not secure, **no** `mediaDevices` |
| 2 | the **tunnel** URL | `https://` | secure, camera **prompts** |
| 3 | `http://<laptop LAN IP>:8080` | `http://192.168.x.x` | not secure — the "keep it local" idea failing |

## Results

Fill this in. Empty means not yet run. **Cell 2 ran 2026-08-28 and the camera was GRANTED**, with a live
preview rendering — so an https origin can scan, confirmed on real hardware rather than argued from spec.

| row | 1 · content:// | 2 · https tunnel | 3 · LAN http |
| --- | --- | --- | --- |
| secure context | | | |
| origin (opaque?) | | | |
| `navigator.mediaDevices` | | | |
| camera: prompt or instant refusal | | **GRANTED after 250ms** | |
| `BarcodeDetector` supports `qr_code` | | | |
| `navigator.share` | | | |
| `localStorage` persists across reloads | | | |

**The camera row is the one that decides things, and the WAY it fails is the evidence.** The probe times the
rejection: a human declining takes a second or more, while an instant `NotAllowedError` means no prompt was
ever shown — the origin refusing rather than a person. That distinction is the entire question, and it is not
visible from inside the game.

## What each outcome implies

- **Cell 2 prompts, cell 1 does not.** The parked claim is confirmed with real evidence, and hosting is the
  only route to scanning. The decision becomes purely *"is a public URL acceptable"* — see the BACKLOG, where
  Aj has said no once, and CLAUDE.md, where the PWA-is-also-offline counter-argument is recorded.
- **Cell 1 prompts too.** The claim is wrong, the branch can simply be merged, and no hosting is needed. This
  is the cheap upside and the reason to run the experiment before deciding anything.
- **Cell 2 does not prompt either.** Something other than the origin is wrong, and the scanning branch would
  not have worked hosted either. Better to learn that from a 8KB file than from a deploy.
- **`qr_code` missing anywhere** — that browser cannot decode without the inlined JS decoder, which is the
  real cost of scanning phase 2 and is unrelated to the origin.

Rows 5-7 are here because I asserted them from spec on 2026-08-28 and was wrong about `navigator.share`, which
discredits the reasoning rather than only that line. Measured, they stop being guesses.

## Why the tunnel is an instrument, not a product

It needs a machine running `cloudflared` for the whole session. For two phones in a room that is worse than
copy-paste. It answers the question; it does not ship.
