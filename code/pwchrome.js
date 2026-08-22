/* Chromium launch options shared by browsertest.js and the nettest_* Playwright suites.
 *
 * These suites used to hardcode executablePath:'/opt/pw-browsers/chromium' — the browser
 * path in the sandbox they were written in, which does not exist on a normal machine.
 * Resolution order now:
 *   1. $PW_CHROMIUM, if set (point it at any Chromium/Chrome binary)
 *   2. /opt/pw-browsers/chromium, if it exists (the old sandbox layout still works)
 *   3. {} — let Playwright use the browser it downloaded itself (`npx playwright install chromium`)
 * Usage: const LAUNCH = require('./pwchrome');  await chromium.launch(LAUNCH);
 * With extra flags: chromium.launch(Object.assign({}, LAUNCH, { args: [...] }))
 */
const fs = require('fs');
const p = process.env.PW_CHROMIUM || '/opt/pw-browsers/chromium';
module.exports = fs.existsSync(p) ? { executablePath: p } : {};
