/* IS THIS RULES CHANGE REAL? — the PAIRED class round-robin (2026-10-12, DECISIONS.md#pitch-to-energy).
 *
 * `analysis.js` runs one build and pins nothing, so two runs of the SAME code move every deck by up to 0.8
 * points — as large as most rules changes. This plays the same games on TWO builds (two checkouts: `git
 * worktree add <dir> main` gives the baseline), with `Math.random` pinned PER GAME, and counts the games whose
 * winner flipped. A deck's net change is read over its flipped games, and z = net / √flips, i.e. against flips
 * that are coin tosses.
 *
 * PER GAME, NOT PER PROCESS: a process-wide pin desynchronises at the first game the change alters, and every
 * game after it then starts from a different stream, so the two arms stop being paired. Reseeding at every
 * `newGame` from a game counter keeps each game paired, and a game the change never touches comes out identical.
 *
 * It measures an ENGINE change with the AI held fixed. For "is this AI stronger?" use `strengthsim.js`.
 * RUN THE CONTROL FIRST: the same directory twice must print 0 flipped games, or the instrument is broken.
 *
 * Usage: node rulepair.js <codeDirA> <codeDirB> [gamesPerMatchup=400] [tier=knight]
 *        (games are the 2-player class round-robin of `analysis.js`, catch-up on, mirrors kept but not scored) */
var path = require('path'), cp = require('child_process');

function arm(dir, N, tier) {
  var E = require(path.resolve(dir, 'engine.js')), AI = require(path.resolve(dir, 'ai.js'));
  if (E.setShieldCards) E.setShieldCards(true);
  if (E.setLoserMill) E.setLoserMill(true);
  if (E.setNoStraightFlush) E.setNoStraightFlush(true);
  var a = 0;
  Math.random = function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  function mulberry32(s) { return function () { s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var DECKS = [null].concat(E.DECK_ORDER), labels = DECKS.map(function (k) { return k === null ? 'Full Set' : E.DECKS[k].name; });
  var games = [], seed = 1, gn = 0, rounds = 0;
  for (var i = 0; i < DECKS.length; i++) for (var j = i; j < DECKS.length; j++) for (var n = 0; n < N; n++) {
    var s = seed++; gn++; a = Math.imul(gn, 0x9E3779B1) | 0;                 // the per-game pin
    var g = E.newGame(mulberry32(s), { starter: s % 2, decks: [DECKS[i], DECKS[j]] }), guard = 0;
    while (!g.finished) { if (++guard > 300000) throw new Error('no terminate'); AI.takeTurn(g, g.turn, tier); }
    games.push([i, j, g.winner]); rounds += g.round;
  }
  return { labels: labels, games: games, rounds: rounds };
}

if (process.argv[2] === '--arm') {
  process.stdout.write(JSON.stringify(arm(process.argv[3], +process.argv[4], process.argv[5])));
} else {
  var dirA = process.argv[2], dirB = process.argv[3], N = +process.argv[4] || 400, tier = process.argv[5] || 'knight';
  if (!dirA || !dirB) { console.error('usage: node rulepair.js <codeDirA> <codeDirB> [gamesPerMatchup=400] [tier=knight]'); process.exit(2); }
  console.log('CONFIG: A=' + path.resolve(dirA) + '  B=' + path.resolve(dirB) + '  games/matchup=' + N + '  tier=' + tier + '  (Math.random pinned per game)');
  var run = function (d) { return JSON.parse(cp.execFileSync(process.execPath, [__filename, '--arm', d, String(N), tier], { maxBuffer: 1 << 28 }).toString()); };
  var A = run(dirA), B = run(dirB), L = A.labels;
  if (A.games.length !== B.games.length || A.labels.join() !== B.labels.join()) { console.error('the two builds did not play the same schedule'); process.exit(1); }
  var net = {}, flipsOf = {}, played = {}, flips = 0;
  L.forEach(function (l) { net[l] = 0; flipsOf[l] = 0; played[l] = 0; });
  A.games.forEach(function (g, k) {
    var h = B.games[k]; if (g[0] === g[1]) return;                             // mirrors: scored by symmetry, skipped
    var x = L[g[0]], y = L[g[1]]; played[x]++; played[y]++;
    if (g[2] === h[2]) return;
    flips++; flipsOf[x]++; flipsOf[y]++;
    var w = h[2] === 0 ? x : y, l = h[2] === 0 ? y : x; net[w]++; net[l]--;
  });
  console.log('games ' + A.games.length + ' · winners flipped ' + flips + ' · avg rounds A ' + (A.rounds / A.games.length).toFixed(2) + ' → B ' + (B.rounds / B.games.length).toFixed(2) + '\n');
  console.log('deck                        net   points   flips      z');
  L.slice().sort(function (p, q) { return net[q] - net[p]; }).forEach(function (l) {
    var z = flipsOf[l] ? net[l] / Math.sqrt(flipsOf[l]) : 0;
    console.log((l + '                            ').slice(0, 26) + ('     ' + net[l]).slice(-5) + ('        ' + (100 * net[l] / played[l]).toFixed(2)).slice(-9) + ('        ' + flipsOf[l]).slice(-8) + ('       ' + z.toFixed(1)).slice(-7));
  });
  if (path.resolve(dirA) === path.resolve(dirB)) console.log('\nCONTROL: the same build twice — ' + (flips === 0 ? 'PASS, 0 flipped' : 'FAIL, ' + flips + ' flipped: the instrument is not deterministic'));
  process.exit(path.resolve(dirA) === path.resolve(dirB) && flips !== 0 ? 1 : 0);
}
