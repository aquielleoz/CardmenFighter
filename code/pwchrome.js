/* Chromium launch options shared by browsertest.js and the nettest_* Playwright suites.
 *
 * These suites used to hardcode executablePath:'/opt/pw-browsers/chromium' — the browser
 * path in the sandbox they were written in, which does not exist on a normal machine.
 * Resolution order now:
 *   1. $PW_CHROMIUM, if set (point it at any Chromium/Chrome binary)
 *   2. /opt/pw-browsers/chromium, if it exists (the old sandbox layout still works)
 *   3. {} — let Playwright use the browser it downloaded itself (`npx playwright install chromium`)
 * Usage: const LAUNCH = require('./pwchrome');  await chromium.launch(LAUNCH);
 * With extra flags: chromium.launch(Object.assign({}, LAUNCH, { args: LAUNCH.args.concat([...]) })) — CONCAT, never
 * replace: a suite that passes its own `args` would otherwise drop the shared ones below.
 *
 * NO AUDIO OUTPUT (2026-10-20). The game makes a WebAudio context for its sound effects, and every test page opened
 * a real output on the machine's default device. With Aj's Bluetooth headphones as that device, `coreaudiod` sat at
 * ~350% CPU holding 294 outputs after three sweeps, and those sweeps went red in unrelated suites. Measured:
 * `--disable-audio-output` opens none; `--mute-audio` still opens one (it silences, it does not disconnect).
 */
const fs = require('fs');
const p = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
module.exports = Object.assign(fs.existsSync(p) ? { executablePath: p } : {}, { args: ['--disable-audio-output'] });
